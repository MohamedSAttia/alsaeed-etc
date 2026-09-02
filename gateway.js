import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import { createPmpEngine } from './pmp-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_PORT = Number(process.env.PORT || 3000);
const INNER_PROXY_PORT = Number(process.env.INNER_PROXY_PORT || 3101);
const INNER_APP_PORT = Number(process.env.INNER_APP_PORT || 3102);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'alsaeed.db');
const JWT_SECRET = process.env.JWT_SECRET || '';

// Keep the proven production proxy (Kashier + Vimeo + Admin) intact on an
// internal port. This outer gateway only owns the new PMP 2026 APIs.
const child = spawn(process.execPath, ['proxy.js'], {
  env: {
    ...process.env,
    PORT: String(INNER_PROXY_PORT),
    INTERNAL_APP_PORT: String(INNER_APP_PORT)
  },
  stdio: 'inherit'
});
child.on('exit', (code, signal) => {
  console.error(`Inner proxy exited (code=${code}, signal=${signal || 'none'})`);
  process.exit(code ?? 1);
});

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

function setting(key) {
  try { const r = db.prepare('SELECT v FROM settings WHERE k=?').get(key); return r ? r.v : ''; }
  catch { return ''; }
}
function setSetting(key, value) {
  db.prepare(`INSERT INTO settings (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=?`)
    .run(key, value, value);
}
function getPackages() {
  try {
    const a = JSON.parse(setting('content_packages') || '[]');
    if (Array.isArray(a) && a.length) return a;
  } catch {}
  try {
    const a = JSON.parse(setting('catalog') || '[]');
    return Array.isArray(a) ? a : [];
  } catch { return []; }
}
function savePackages(list) {
  const safe = Array.isArray(list) ? list : [];
  setSetting('content_packages', JSON.stringify(safe));
  setSetting('catalog', JSON.stringify(safe.filter(p => p.active !== false).map(p => ({
    id: p.id,
    ar: p.ar || p.title_ar || p.id,
    en: p.en || p.title_en || '',
    code: p.code || p.id,
    price: Number(p.price || 0),
    currency: String(p.currency || 'USD').toUpperCase(),
    days: Number(p.days || 90),
    hours: Number(p.hours || 0)
  }))));
}

const pmp = createPmpEngine({ db, JWT_SECRET, getPackages, savePackages });

function sendJson(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': data.length,
    'cache-control': 'no-store'
  });
  res.end(data);
}
async function readJson(req, limit = 12 * 1024 * 1024) {
  return await new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', c => {
      n += c.length;
      if (n > limit) { reject(new Error('request too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new Error('invalid json')); }
    });
    req.on('error', reject);
  });
}
function adminFromToken(req) {
  if (!JWT_SECRET) return null;
  const h = String(req.headers.authorization || '');
  if (!h.startsWith('Bearer ')) return null;
  try {
    const p = jwt.verify(h.slice(7), JWT_SECRET);
    if (p.role !== 'admin') return null;
    const u = db.prepare("SELECT id,name,email,role,active FROM users WHERE id=? AND role='admin'").get(p.id);
    return u && u.active !== 0 ? u : null;
  } catch { return null; }
}
function normalizeType(t) {
  const s = String(t || '').toLowerCase();
  if (s === 'm' || s === 'multiple' || s === 'multi') return 'multiple';
  return 'single';
}
function letters(indices) {
  return (Array.isArray(indices) ? indices : []).map(i => String.fromCharCode(65 + Number(i))).join(',');
}
function validDomain(d) {
  const x = String(d || '').toLowerCase();
  return ['people','process','business'].includes(x) ? x : '';
}

async function importPmpBank(req, res) {
  const admin = adminFromToken(req);
  if (!admin) return sendJson(res, 401, { error: 'يلزم تسجيل دخول المشرف' });

  let body;
  try { body = await readJson(req); }
  catch { return sendJson(res, 400, { error: 'تعذر قراءة ملف بنك الأسئلة' }); }

  const rows = Array.isArray(body.questions) ? body.questions.slice(0, 5000) : [];
  if (!rows.length) return sendJson(res, 400, { error: 'لا توجد أسئلة للاستيراد' });

  const packageId = pmp.packageId;
  const clean = rows.map((q, i) => ({
    id: 'PMP-' + String(q.id ?? (i + 1)).padStart(4, '0'),
    domain: validDomain(q.dm),
    topic: String(q.ch || '').trim(),
    type: normalizeType(q.t),
    question: String(q.q || '').trim(),
    options: Array.isArray(q.o) ? q.o.slice(0, 8).map(x => String(x)) : [],
    correct: Array.isArray(q.c) ? q.c.map(Number) : [],
    explanation: String(q.f || '').trim(),
    approach: String(q.ap || '').trim(),
    sourceExam: String(q.ex || '').trim(),
    originalId: q.id ?? (i + 1)
  })).filter(q => q.question && q.domain && q.options.length >= 2 && q.correct.length);

  if (clean.length < Math.min(rows.length, 100)) {
    return sendJson(res, 400, { error: 'صيغة بنك الأسئلة غير متوافقة مع PMPBank' });
  }

  const ins = db.prepare(`INSERT OR REPLACE INTO questions
    (id,package_id,domain,topic,difficulty,type,question_ar,question_en,options,correct,
     explanation_ar,explanation_en,reference,active,created,updated,approach,source_exam,source_id,correct_json,meta)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const replace = body.replace !== false;
  const now = Date.now();
  const tx = db.transaction(() => {
    if (replace) {
      db.prepare("DELETE FROM questions WHERE package_id=? AND (source_id LIKE 'PMP-%' OR id LIKE 'PMP-%')")
        .run(packageId);
    }
    for (const q of clean) {
      const meta = {
        source: 'AlSaeed_PMP_Platform upload',
        originalId: q.originalId,
        approach: q.approach,
        sourceExam: q.sourceExam,
        chapter: q.topic
      };
      ins.run(
        q.id, packageId, q.domain, q.topic, 'medium', q.type,
        q.question, q.question, JSON.stringify(q.options), letters(q.correct),
        q.explanation, q.explanation, '', 1, now, now,
        q.approach, q.sourceExam, q.id, JSON.stringify(q.correct), JSON.stringify(meta)
      );
    }
  });
  tx();

  const stats = db.prepare(`SELECT domain,type,COUNT(*) n FROM questions
    WHERE package_id=? AND active=1 GROUP BY domain,type`).all(packageId);
  const total = db.prepare('SELECT COUNT(*) c FROM questions WHERE package_id=? AND active=1').get(packageId).c;

  return sendJson(res, 200, {
    ok: true,
    packageId,
    imported: clean.length,
    total,
    stats,
    expectedSimulation: {
      totalQuestions: 180,
      durationMinutes: 240,
      domains: { people: 59, process: 74, business: 47 },
      breaks: [{ after: 10, minutes: 5 }, { after: 96, minutes: 10 }]
    }
  });
}

function forward(req, res) {
  const headers = { ...req.headers };
  delete headers.connection;
  headers.host = req.headers.host || 'al-ltc.com';
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: INNER_PROXY_PORT,
    method: req.method,
    path: req.url,
    headers
  }, up => {
    res.writeHead(up.statusCode || 502, up.headers);
    up.pipe(res);
  });
  upstream.on('error', err => {
    console.error('Gateway upstream error:', err.message);
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Temporary upstream error' }));
  });
  req.pipe(upstream);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'POST' && url.pathname === '/api/pmp-2026/admin/import') {
      return await importPmpBank(req, res);
    }
    if (url.pathname.startsWith('/api/pmp-2026')) {
      return await pmp.handle(req, res, url);
    }
    return forward(req, res);
  } catch (err) {
    console.error('Gateway request error:', err);
    if (!res.headersSent) return sendJson(res, 500, { error: 'حدث خطأ أثناء تنفيذ الطلب' });
    res.end();
  }
});

server.listen(PUBLIC_PORT, '0.0.0.0', () => {
  console.log(`AL-SAEED gateway on ${PUBLIC_PORT}; proxy=${INNER_PROXY_PORT}; app=${INNER_APP_PORT}; PMP=${pmp.packageId}`);
});
