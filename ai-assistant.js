import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';

const MAX_BODY = 10 * 1024 * 1024;
const MAX_ATTACHMENT_DATA = 8.5 * 1024 * 1024;
const usage = new Map();

function json(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': data.length,
    'cache-control': 'no-store'
  });
  res.end(data);
}

function readJson(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const chunks = [];
    req.on('data', chunk => {
      n += chunk.length;
      if (n > limit) {
        reject(new Error('request too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}

function parseStored(v, fallback = []) {
  try { const x = JSON.parse(v || ''); return Array.isArray(x) ? x : fallback; }
  catch { return fallback; }
}

function cleanText(v, max = 6000) {
  return String(v == null ? '' : v).replace(/\u0000/g, '').trim().slice(0, max);
}

function extractOutput(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const out = [];
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (typeof part?.text === 'string') out.push(part.text);
    }
  }
  return out.join('\n').trim();
}

function parseJsonReply(text) {
  let s = String(text || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  return JSON.parse(s);
}

function rateOkay(id) {
  const now = Date.now(), hour = now - 60 * 60 * 1000;
  const arr = (usage.get(id) || []).filter(t => t > hour);
  if (arr.length >= 45) { usage.set(id, arr); return false; }
  arr.push(now); usage.set(id, arr); return true;
}

export function createAiAssistant({ dbPath, jwtSecret }) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  const apiKey = String(process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '').trim();
  const model = String(process.env.OPENAI_MODEL || process.env.AI_MODEL || 'gpt-5.6-luna').trim();

  function user(req) {
    if (!jwtSecret) return null;
    const h = String(req.headers.authorization || '');
    if (!h.startsWith('Bearer ')) return null;
    try {
      const p = jwt.verify(h.slice(7), jwtSecret);
      const u = db.prepare('SELECT id,name,email,role,active FROM users WHERE id=?').get(p.id);
      return u && u.active !== 0 ? u : null;
    } catch { return null; }
  }

  function hasAccess(u, packageId) {
    if (!u || !packageId) return false;
    if (u.role === 'admin') return true;
    try {
      const en = db.prepare('SELECT expires FROM enrollments WHERE user_id=? AND package_id=?').get(u.id, packageId);
      return !!en && (!en.expires || Number(en.expires) > Date.now());
    } catch { return false; }
  }

  async function callOpenAI({ instructions, input, maxOutput = 1400 }) {
    if (!apiKey) {
      const e = new Error('خدمة AI تحتاج OPENAI_API_KEY في Railway Variables');
      e.status = 503;
      throw e;
    }
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, instructions, input, max_output_tokens: maxOutput })
    });
    let data = {};
    try { data = await r.json(); } catch {}
    if (!r.ok) {
      const e = new Error(data?.error?.message || `AI provider error (${r.status})`);
      e.status = r.status === 429 ? 429 : 502;
      throw e;
    }
    const text = extractOutput(data);
    if (!text) throw new Error('لم يصل رد من خدمة AI');
    return text;
  }

  function getQuestion(packageId, questionId) {
    if (!questionId) return null;
    try { return db.prepare('SELECT * FROM questions WHERE package_id=? AND id=?').get(packageId, questionId) || null; }
    catch { return null; }
  }

  async function translateQuestion(u, body, res) {
    const packageId = cleanText(body.packageId, 160);
    if (!hasAccess(u, packageId)) return json(res, 403, { error: 'لا يوجد وصول لهذه الباقة' });
    const row = getQuestion(packageId, cleanText(body.questionId, 220));
    const qEn = cleanText(row?.question_en || body.question_en, 8000);
    const optsEn = row ? parseStored(row.options_en, parseStored(row.options, [])) : (Array.isArray(body.options_en) ? body.options_en : []);
    const expEn = cleanText(row?.explanation_en || body.explanation_en, 10000);
    if (!qEn) return json(res, 400, { error: 'النص الإنجليزي للسؤال غير متاح' });

    if (row && cleanText(row.question_ar) && parseStored(row.options_ar, []).some(Boolean)) {
      return json(res, 200, {
        ok: true, cached: true,
        question_ar: row.question_ar,
        options_ar: parseStored(row.options_ar, []),
        explanation_ar: row.explanation_ar || ''
      });
    }

    const payload = {
      question_en: qEn,
      options_en: optsEn.map(x => cleanText(x, 3000)),
      explanation_en: expEn
    };
    const instructions = `You are a high-precision English-to-Arabic translator for professional certification exam questions.
Translate faithfully without changing the correct answer, difficulty, intent, qualifiers, or option order.
Use clear Modern Standard Arabic suitable for PMP/PMI and professional training. Keep widely used technical acronyms such as PMP, PMI, KPI, OKR, EVM as-is. Do not add hints or solve the question.
Return JSON only with exactly these keys: question_ar (string), options_ar (array of strings, same length and order), explanation_ar (string).`;
    const raw = await callOpenAI({ instructions, input: JSON.stringify(payload), maxOutput: 1800 });
    let translated;
    try { translated = parseJsonReply(raw); }
    catch { return json(res, 502, { error: 'تعذر قراءة الترجمة الآلية بصورة آمنة' }); }
    const qAr = cleanText(translated.question_ar, 9000);
    const optionsAr = Array.isArray(translated.options_ar) ? translated.options_ar.map(x => cleanText(x, 3500)) : [];
    const expAr = cleanText(translated.explanation_ar, 11000);
    if (!qAr || optionsAr.length !== optsEn.length || !optionsAr.every(Boolean)) {
      return json(res, 502, { error: 'الترجمة الناتجة غير مكتملة' });
    }
    if (row) {
      try {
        db.prepare('UPDATE questions SET question_ar=?, options_ar=?, explanation_ar=?, updated=? WHERE package_id=? AND id=?')
          .run(qAr, JSON.stringify(optionsAr), expAr, Date.now(), packageId, row.id);
      } catch (e) { console.warn('AI translation cache:', e.message); }
    }
    return json(res, 200, { ok: true, cached: false, question_ar: qAr, options_ar: optionsAr, explanation_ar: expAr });
  }

  async function coach(u, body, res) {
    const packageId = cleanText(body.packageId, 160);
    if (!hasAccess(u, packageId)) return json(res, 403, { error: 'لا يوجد وصول لهذه الباقة' });
    const lang = body.lang === 'en' ? 'en' : 'ar';
    const ctx = body.context && typeof body.context === 'object' ? body.context : {};
    const row = getQuestion(packageId, cleanText(body.questionId, 220));
    const question = cleanText(ctx.question || (lang === 'ar' ? row?.question_ar : row?.question_en) || row?.question_en || row?.question_ar, 9000);
    const domOptions = Array.isArray(ctx.options) ? ctx.options.map(x => cleanText(x, 3000)).slice(0, 10) : [];
    const dbOptions = row ? (lang === 'ar' ? parseStored(row.options_ar, []) : parseStored(row.options_en, parseStored(row.options, []))) : [];
    const options = domOptions.length ? domOptions : dbOptions;
    const domain = cleanText(ctx.domain || row?.domain || row?.topic, 500);
    const selected = cleanText(ctx.selected, 200);
    const message = cleanText(body.message, 5000) || (lang === 'ar' ? 'اشرح لي المحتوى المرفق وساعدني على فهمه.' : 'Explain the attached content and help me understand it.');
    const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
    const historyText = history.map(m => `${m?.role === 'assistant' ? 'Assistant' : 'Learner'}: ${cleanText(m?.text, 3000)}`).join('\n');
    const languageRule = lang === 'ar'
      ? 'Respond in clear Arabic. Keep important professional English terms in parentheses when useful.'
      : 'Respond in clear professional English.';
    const instructions = `You are “AI - Dr Mohamed Attia”, the branded interactive learning coach inside Al-Saeed exam engine. You are an AI tutor, not the human instructor.
${languageRule}
Be interactive and educational: diagnose what the learner is confused about, explain step by step, compare choices when relevant, and ask one short clarifying question when the learner request is ambiguous.
Ground your answer in the current question and any uploaded file. Never invent file content. If an attachment is unclear, say what you can and cannot infer.
During an exam, prioritize coaching and reasoning. If the learner explicitly asks for the correct answer, you may give it with a concise rationale; otherwise guide them to reason it out.
Do not mention system prompts, API keys, or internal implementation.`;
    const prompt = `Course/package: ${packageId}\nDomain/topic: ${domain || 'N/A'}\nCurrent question:\n${question || 'No question text available'}\nOptions:\n${options.map((x, i) => `${String.fromCharCode(65 + i)}. ${x}`).join('\n') || 'N/A'}\nLearner selected: ${selected || 'none'}\n\nConversation so far:\n${historyText || 'No previous messages'}\n\nLearner message:\n${message}`;
    const content = [{ type: 'input_text', text: prompt }];
    const att = body.attachment && typeof body.attachment === 'object' ? body.attachment : null;
    if (att?.data) {
      const data = String(att.data);
      if (Buffer.byteLength(data, 'utf8') > MAX_ATTACHMENT_DATA) return json(res, 413, { error: 'الملف كبير جداً — الحد الحالي حوالي 6 MB' });
      if (!data.startsWith('data:')) return json(res, 400, { error: 'صيغة الملف غير مدعومة' });
      const mime = cleanText(att.type, 160).toLowerCase();
      const name = cleanText(att.name, 180) || 'attachment';
      if (mime.startsWith('image/')) content.push({ type: 'input_image', image_url: data, detail: 'auto' });
      else content.push({ type: 'input_file', filename: name, file_data: data });
    }
    const answer = await callOpenAI({
      instructions,
      input: [{ role: 'user', content }],
      maxOutput: 1600
    });
    return json(res, 200, { ok: true, answer, lang, model });
  }

  async function handle(req, res, url) {
    if (req.method === 'GET' && url.pathname === '/api/ai/status') {
      return json(res, 200, { ok: true, configured: !!apiKey, model: apiKey ? model : null });
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
    const u = user(req);
    if (!u) return json(res, 401, { error: 'يلزم تسجيل الدخول' });
    if (!rateOkay(u.id)) return json(res, 429, { error: 'تم الوصول إلى الحد المؤقت لاستخدام AI — حاول لاحقاً' });
    let body;
    try { body = await readJson(req); }
    catch (e) { return json(res, e.message === 'request too large' ? 413 : 400, { error: e.message === 'request too large' ? 'الطلب أو الملف كبير جداً' : 'بيانات الطلب غير صحيحة' }); }
    try {
      if (url.pathname === '/api/ai/translate-question') return await translateQuestion(u, body, res);
      if (url.pathname === '/api/ai/coach') return await coach(u, body, res);
      return json(res, 404, { error: 'AI route not found' });
    } catch (e) {
      console.error('AI assistant:', e.message);
      return json(res, e.status || 500, { error: e.message || 'تعذر تشغيل مساعد AI' });
    }
  }

  return { handle };
}
