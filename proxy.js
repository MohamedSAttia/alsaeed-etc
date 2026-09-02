import http from 'http';
import { spawn } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_PORT = Number(process.env.PORT || 3000);
const INTERNAL_PORT = Number(process.env.INTERNAL_APP_PORT || 3001);
const SITE = String(process.env.SITE_URL || 'https://al-ltc.com').replace(/\/$/, '');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'alsaeed.db');
const JWT_SECRET = process.env.JWT_SECRET || '';
const PAYMENT_GATEWAY = String(process.env.PAYMENT_GATEWAY || 'kashier').toLowerCase();
const PANEL = String(process.env.ADMIN_PANEL_PATH || 'manage-x7k').replace(/^\/+|\/+$/g, '');

// Run the existing application on an internal port. The public proxy keeps the
// existing app unchanged, adjusts Referrer-Policy for Vimeo, owns Kashier
// checkout, and exposes the protected LMS content builder.
const child = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(INTERNAL_PORT) },
  stdio: 'inherit'
});

child.on('exit', (code, signal) => {
  console.error(`Application process exited (code=${code}, signal=${signal || 'none'})`);
  process.exit(code ?? 1);
});

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY, package_id TEXT NOT NULL,
  domain TEXT, topic TEXT, difficulty TEXT DEFAULT 'medium', type TEXT DEFAULT 'mcq',
  question_ar TEXT NOT NULL, question_en TEXT,
  options TEXT NOT NULL, correct TEXT NOT NULL,
  explanation_ar TEXT, explanation_en TEXT, reference TEXT,
  active INTEGER DEFAULT 1, created INTEGER NOT NULL, updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_package ON questions(package_id);
CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY, package_id TEXT NOT NULL, title TEXT NOT NULL,
  kind TEXT DEFAULT 'mini', duration INTEGER DEFAULT 60,
  question_count INTEGER DEFAULT 50, pass_score INTEGER DEFAULT 70,
  config TEXT DEFAULT '{}', active INTEGER DEFAULT 1,
  created INTEGER NOT NULL, updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exams_package ON exams(package_id);
CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY, package_id TEXT NOT NULL, title TEXT NOT NULL,
  type TEXT DEFAULT 'link', url TEXT, note TEXT, sort INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1, created INTEGER NOT NULL, updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_resources_package ON resources(package_id);
`);

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade'
]);

const setting = key => {
  try {
    const row = db.prepare('SELECT v FROM settings WHERE k=?').get(key);
    return row ? row.v : '';
  } catch {
    return '';
  }
};
const setSetting = (key, value) => {
  db.prepare(`INSERT INTO settings (k,v) VALUES (?,?)
    ON CONFLICT(k) DO UPDATE SET v=?`).run(key, value, value);
};

function uid() {
  return crypto.randomBytes(9).toString('base64url');
}

function sendJson(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': data.length,
    'cache-control': 'no-store'
  });
  res.end(data);
}

async function readJson(req, limit = 3 * 1024 * 1024) {
  return await new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('request too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

function tokenPayload(req) {
  if (!JWT_SECRET) return null;
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  try { return jwt.verify(header.slice(7), JWT_SECRET); }
  catch { return null; }
}

function authenticatedUser(req) {
  const payload = tokenPayload(req);
  if (!payload) return null;
  try {
    return db.prepare('SELECT id,name,email,phone,role,active FROM users WHERE id=?').get(payload.id) || null;
  } catch { return null; }
}

function authenticatedAdmin(req) {
  const payload = tokenPayload(req);
  if (!payload || payload.role !== 'admin') return null;
  try {
    const u = db.prepare("SELECT id,name,email,role,active FROM users WHERE id=? AND role='admin'").get(payload.id);
    return u && u.active !== 0 ? u : null;
  } catch { return null; }
}

function getPackages() {
  try {
    const rich = setting('content_packages');
    if (rich) {
      const a = JSON.parse(rich);
      if (Array.isArray(a)) return a;
    }
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

function normalizePackage(body, old = {}) {
  const id = String(old.id || body.id || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{2,80}$/.test(id)) throw new Error('معرّف الباقة يجب أن يكون إنجليزياً وبدون مسافات');
  const ar = String(body.ar ?? old.ar ?? '').trim();
  if (!ar) throw new Error('اسم الباقة بالعربية مطلوب');
  const chapters = Array.isArray(body._chapters) ? body._chapters.map(x => String(x).trim()).filter(Boolean) : (old._chapters || []);
  return {
    ...old,
    id,
    code: String(body.code ?? old.code ?? id).trim(),
    ar,
    en: String(body.en ?? old.en ?? '').trim(),
    desc: String(body.desc ?? old.desc ?? '').trim(),
    price: Math.max(0, Number(body.price ?? old.price ?? 0) || 0),
    currency: String(body.currency ?? old.currency ?? 'USD').toUpperCase(),
    days: Math.max(1, Number(body.days ?? old.days ?? 90) || 90),
    hours: Math.max(0, Number(body.hours ?? old.hours ?? 0) || 0),
    image: String(body.image ?? old.image ?? '').trim(),
    _chapters: chapters,
    active: body.active === undefined ? old.active !== false : !!body.active,
    featured: body.featured === undefined ? !!old.featured : !!body.featured,
    updated: Date.now(),
    created: old.created || Date.now()
  };
}

function kashierConfig() {
  return {
    mid: String(process.env.KASHIER_MERCHANT_ID || '').trim(),
    paymentKey: String(process.env.KASHIER_PAYMENT_API_KEY || '').trim(),
    mode: String(process.env.KASHIER_MODE || 'test').trim().toLowerCase() === 'live' ? 'live' : 'test',
    allowedMethods: String(process.env.KASHIER_ALLOWED_METHODS || 'card,wallet').trim(),
    baseUrl: 'https://checkout.kashier.io/'
  };
}

function kashierOrderHash(mid, orderId, amount, currency, paymentKey) {
  const pathToSign = `/?payment=${mid}.${orderId}.${amount}.${currency}`;
  return crypto.createHmac('sha256', paymentKey).update(pathToSign).digest('hex');
}

function kashierCallbackPayload(q) {
  return [
    ['paymentStatus', q.paymentStatus], ['cardDataToken', q.cardDataToken],
    ['maskedCard', q.maskedCard], ['merchantOrderId', q.merchantOrderId],
    ['orderId', q.orderId], ['cardBrand', q.cardBrand],
    ['orderReference', q.orderReference], ['transactionId', q.transactionId],
    ['amount', q.amount], ['currency', q.currency]
  ].map(([key, value]) => `${key}=${value ?? ''}`).join('&');
}

function validKashierSignature(q, paymentKey) {
  const supplied = String(q.signature || '').toLowerCase();
  if (!supplied || !/^[a-f0-9]{64}$/.test(supplied)) return false;
  const expected = crypto.createHmac('sha256', paymentKey)
    .update(kashierCallbackPayload(q)).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
  } catch { return false; }
}

function grant(userId, pkgId, days, source) {
  const expires = days ? Date.now() + Number(days) * 86400000 : null;
  db.prepare(`INSERT INTO enrollments (id,user_id,package_id,source,expires,created)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(user_id,package_id) DO UPDATE SET expires=?, source=?`)
    .run(uid(), userId, pkgId, source || 'Kashier', expires, Date.now(), expires, source || 'Kashier');
}

function markOrderPaid(order) {
  if (!order || order.status === 'paid') return;
  let catalog = [];
  try { catalog = JSON.parse(setting('catalog') || '[]'); } catch {}
  const pkg = catalog.find(p => p.id === order.package_id) || {};
  const tx = db.transaction(() => {
    const current = db.prepare('SELECT status FROM orders WHERE id=?').get(order.id);
    if (!current || current.status === 'paid') return;
    db.prepare("UPDATE orders SET status='paid', paid_at=? WHERE id=?").run(Date.now(), order.id);
    grant(order.user_id, order.package_id, pkg.days || 90, 'Kashier');
  });
  tx();
}

async function handleKashierCreate(req, res) {
  const cfg = kashierConfig();
  if (!cfg.mid || !cfg.paymentKey) {
    return sendJson(res, 503, { error: 'بوابة Kashier لم تكتمل بعد. أضف مفاتيح Kashier في Railway.' });
  }
  const user = authenticatedUser(req);
  if (!user) return sendJson(res, 401, { error: 'يلزم تسجيل الدخول' });
  if (user.active === 0) return sendJson(res, 403, { error: 'هذا الحساب معطّل' });
  let body;
  try { body = await readJson(req); }
  catch { return sendJson(res, 400, { error: 'بيانات الطلب غير صحيحة' }); }
  const packageId = String(body.packageId || '').trim();
  let catalog = [];
  try { catalog = JSON.parse(setting('catalog') || '[]'); } catch {}
  const pkg = catalog.find(p => p.id === packageId);
  if (!pkg) return sendJson(res, 404, { error: 'الباقة غير موجودة' });
  const enrolled = db.prepare('SELECT id FROM enrollments WHERE user_id=? AND package_id=?').get(user.id, packageId);
  if (enrolled) return sendJson(res, 409, { error: 'أنت مشترك في هذه الباقة' });
  const numericAmount = Number(pkg.price);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return sendJson(res, 400, { error: 'سعر الباقة غير صالح للدفع الإلكتروني' });
  const amount = numericAmount.toFixed(2);
  const currency = String(pkg.currency || 'USD').toUpperCase();
  const orderId = 'ORD-' + uid().toUpperCase();
  db.prepare(`INSERT INTO orders (id,user_id,package_id,amount,currency,status,gateway,gateway_id,created)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(orderId, user.id, packageId, numericAmount, currency, 'pending', 'kashier', orderId, Date.now());
  const hash = kashierOrderHash(cfg.mid, orderId, amount, currency, cfg.paymentKey);
  const params = new URLSearchParams({
    merchantId: cfg.mid, orderId, amount, currency, hash,
    merchantRedirect: `${SITE}/api/pay/kashier/return/${encodeURIComponent(orderId)}`,
    metaData: JSON.stringify({ customerName: user.name || '', customerEmail: user.email || '', customerPhone: user.phone || '', packageId }),
    allowedMethods: cfg.allowedMethods, failureRedirect: 'true', redirectMethod: 'get', display: 'ar',
    brandColor: 'rgba(240, 116, 26, 1)', mode: cfg.mode
  });
  return sendJson(res, 200, { orderId, paymentUrl: `${cfg.baseUrl}?${params.toString()}`, gateway: 'kashier', mode: cfg.mode });
}

function handleKashierReturn(req, res, requestUrl) {
  const cfg = kashierConfig();
  const match = requestUrl.pathname.match(/^\/api\/pay\/kashier\/return\/([^/]+)$/);
  const orderId = match ? decodeURIComponent(match[1]) : '';
  const q = Object.fromEntries(requestUrl.searchParams.entries());
  const order = orderId ? db.prepare('SELECT * FROM orders WHERE id=?').get(orderId) : null;
  let paid = false, reason = 'invalid';
  if (order && cfg.paymentKey && validKashierSignature(q, cfg.paymentKey)) {
    const sameOrder = String(q.merchantOrderId || '') === String(order.id);
    const sameCurrency = String(q.currency || '').toUpperCase() === String(order.currency || '').toUpperCase();
    const sameAmount = Math.abs(Number(q.amount) - Number(order.amount)) < 0.001;
    const status = String(q.paymentStatus || '').toUpperCase();
    const successful = ['SUCCESS', 'PAID', 'CAPTURED'].includes(status);
    if (sameOrder && sameCurrency && sameAmount && successful) {
      markOrderPaid(order); paid = true; reason = 'paid';
    } else if (!successful) reason = 'not-paid';
    else reason = 'mismatch';
  } else if (order && order.status === 'paid') { paid = true; reason = 'already-paid'; }
  const pkgId = order ? order.package_id : '';
  res.writeHead(302, { location: `${SITE}/#learn/${encodeURIComponent(pkgId)}?paid=${paid ? '1' : '0'}&gateway=kashier&reason=${encodeURIComponent(reason)}`, 'cache-control': 'no-store' });
  res.end();
}

function serveContentAdmin(res) {
  const f = path.join(__dirname, 'public', 'content-admin.html');
  if (!fs.existsSync(f)) return sendJson(res, 404, { error: 'صفحة إدارة المحتوى غير موجودة' });
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}

async function handleContentAdmin(req, res, requestUrl) {
  const admin = authenticatedAdmin(req);
  if (!admin) return sendJson(res, 401, { error: 'يلزم تسجيل دخول المشرف' });
  const prefix = `/${PANEL}/api/content-admin`;
  const sub = requestUrl.pathname.slice(prefix.length) || '/';
  const parts = sub.split('/').filter(Boolean);
  const method = req.method || 'GET';

  if (method === 'GET' && sub === '/boot') {
    const packages = getPackages();
    const stats = {
      lessons: db.prepare('SELECT COUNT(*) c FROM lessons').get().c,
      questions: db.prepare('SELECT COUNT(*) c FROM questions').get().c,
      exams: db.prepare('SELECT COUNT(*) c FROM exams').get().c,
      resources: db.prepare('SELECT COUNT(*) c FROM resources').get().c,
      enrollments: db.prepare('SELECT COUNT(*) c FROM enrollments').get().c
    };
    return sendJson(res, 200, { packages, stats });
  }

  if (parts[0] === 'packages') {
    const list = getPackages();
    if (method === 'POST' && parts.length === 1) {
      let body; try { body = await readJson(req); } catch { return sendJson(res, 400, { error: 'بيانات غير صحيحة' }); }
      try {
        const p = normalizePackage(body);
        if (list.some(x => x.id === p.id)) return sendJson(res, 409, { error: 'معرّف الباقة مستخدم بالفعل' });
        list.push(p); savePackages(list);
        return sendJson(res, 200, { ok: true, package: p });
      } catch (e) { return sendJson(res, 400, { error: e.message }); }
    }
    if (parts.length === 2) {
      const id = decodeURIComponent(parts[1]);
      const i = list.findIndex(x => x.id === id);
      if (i < 0) return sendJson(res, 404, { error: 'الباقة غير موجودة' });
      if (method === 'PUT') {
        let body; try { body = await readJson(req); } catch { return sendJson(res, 400, { error: 'بيانات غير صحيحة' }); }
        try { list[i] = normalizePackage(body, list[i]); savePackages(list); return sendJson(res, 200, { ok: true, package: list[i] }); }
        catch (e) { return sendJson(res, 400, { error: e.message }); }
      }
      if (method === 'DELETE') {
        list[i] = { ...list[i], active: false, updated: Date.now() };
        savePackages(list);
        return sendJson(res, 200, { ok: true, archived: true });
      }
    }
  }

  if (parts[0] === 'questions') {
    if (method === 'GET' && parts.length === 2) {
      const rows = db.prepare('SELECT * FROM questions WHERE package_id=? ORDER BY created,id').all(decodeURIComponent(parts[1]));
      return sendJson(res, 200, rows.map(r => ({ ...r, options: JSON.parse(r.options || '[]'), active: !!r.active })));
    }
    if (method === 'POST' && parts.length === 1) {
      let b; try { b = await readJson(req); } catch { return sendJson(res, 400, { error: 'بيانات غير صحيحة' }); }
      if (!b.package_id || !String(b.question_ar || '').trim()) return sendJson(res, 400, { error: 'الباقة ونص السؤال مطلوبان' });
      const id = uid(), now = Date.now(), options = Array.isArray(b.options) ? b.options.slice(0, 8) : [];
      db.prepare(`INSERT INTO questions (id,package_id,domain,topic,difficulty,type,question_ar,question_en,options,correct,explanation_ar,explanation_en,reference,active,created,updated)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,b.package_id,b.domain||'',b.topic||'',b.difficulty||'medium',b.type||'mcq',String(b.question_ar).trim(),b.question_en||'',JSON.stringify(options),String(b.correct||'A').toUpperCase(),b.explanation_ar||'',b.explanation_en||'',b.reference||'',b.active===false?0:1,now,now);
      return sendJson(res, 200, { ok: true, id });
    }
    if (method === 'POST' && parts.length === 3 && parts[2] === 'bulk') {
      const pkg = decodeURIComponent(parts[1]);
      let b; try { b = await readJson(req); } catch { return sendJson(res, 400, { error: 'بيانات غير صحيحة' }); }
      const rows = Array.isArray(b.rows) ? b.rows.slice(0, 5000) : [];
      const ins = db.prepare(`INSERT INTO questions (id,package_id,domain,topic,difficulty,type,question_ar,question_en,options,correct,explanation_ar,explanation_en,reference,active,created,updated)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      const tx = db.transaction(() => rows.forEach(q => {
        if (!String(q.question_ar || '').trim()) return;
        const now = Date.now();
        ins.run(uid(),pkg,q.domain||'',q.topic||'',q.difficulty||'medium',q.type||'mcq',String(q.question_ar).trim(),q.question_en||'',JSON.stringify(Array.isArray(q.options)?q.options:[]),String(q.correct||'A').toUpperCase(),q.explanation_ar||'',q.explanation_en||'',q.reference||'',1,now,now);
      }));
      tx(); return sendJson(res, 200, { ok: true, count: rows.length });
    }
    if (parts.length === 2) {
      const id = decodeURIComponent(parts[1]);
      if (method === 'PUT') {
        let b; try { b = await readJson(req); } catch { return sendJson(res, 400, { error: 'بيانات غير صحيحة' }); }
        const old = db.prepare('SELECT * FROM questions WHERE id=?').get(id);
        if (!old) return sendJson(res, 404, { error: 'السؤال غير موجود' });
        db.prepare(`UPDATE questions SET package_id=?,domain=?,topic=?,difficulty=?,type=?,question_ar=?,question_en=?,options=?,correct=?,explanation_ar=?,explanation_en=?,reference=?,active=?,updated=? WHERE id=?`)
          .run(b.package_id||old.package_id,b.domain??old.domain,b.topic??old.topic,b.difficulty||old.difficulty,b.type||old.type,b.question_ar??old.question_ar,b.question_en??old.question_en,JSON.stringify(Array.isArray(b.options)?b.options:JSON.parse(old.options||'[]')),String(b.correct||old.correct).toUpperCase(),b.explanation_ar??old.explanation_ar,b.explanation_en??old.explanation_en,b.reference??old.reference,b.active===false?0:1,Date.now(),id);
        return sendJson(res, 200, { ok: true });
      }
      if (method === 'DELETE') { db.prepare('DELETE FROM questions WHERE id=?').run(id); return sendJson(res, 200, { ok: true }); }
    }
  }

  if (parts[0] === 'exams') {
    if (method === 'GET' && parts.length === 2) {
      return sendJson(res, 200, db.prepare('SELECT * FROM exams WHERE package_id=? ORDER BY created').all(decodeURIComponent(parts[1])).map(x => ({ ...x, active: !!x.active })));
    }
    if (method === 'POST' && parts.length === 1) {
      let b; try { b = await readJson(req); } catch { return sendJson(res, 400, { error: 'بيانات غير صحيحة' }); }
      if (!b.package_id || !String(b.title||'').trim()) return sendJson(res, 400, { error: 'الباقة وعنوان الاختبار مطلوبان' });
      const id=uid(),now=Date.now();
      db.prepare(`INSERT INTO exams (id,package_id,title,kind,duration,question_count,pass_score,config,active,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .run(id,b.package_id,String(b.title).trim(),b.kind||'mini',Math.max(1,+b.duration||60),Math.max(1,+b.question_count||50),Math.min(100,Math.max(1,+b.pass_score||70)),JSON.stringify(b.config||{}),b.active===false?0:1,now,now);
      return sendJson(res, 200, { ok:true,id });
    }
    if (parts.length === 2) {
      const id=decodeURIComponent(parts[1]); const old=db.prepare('SELECT * FROM exams WHERE id=?').get(id);
      if (!old) return sendJson(res,404,{error:'الاختبار غير موجود'});
      if (method === 'PUT') { let b;try{b=await readJson(req)}catch{return sendJson(res,400,{error:'بيانات غير صحيحة'})}db.prepare(`UPDATE exams SET package_id=?,title=?,kind=?,duration=?,question_count=?,pass_score=?,active=?,updated=? WHERE id=?`).run(b.package_id||old.package_id,b.title||old.title,b.kind||old.kind,Math.max(1,+b.duration||old.duration),Math.max(1,+b.question_count||old.question_count),Math.min(100,Math.max(1,+b.pass_score||old.pass_score)),b.active===false?0:1,Date.now(),id);return sendJson(res,200,{ok:true}); }
      if (method === 'DELETE') { db.prepare('DELETE FROM exams WHERE id=?').run(id); return sendJson(res,200,{ok:true}); }
    }
  }

  if (parts[0] === 'resources') {
    if (method === 'GET' && parts.length === 2) return sendJson(res,200,db.prepare('SELECT * FROM resources WHERE package_id=? ORDER BY sort,created').all(decodeURIComponent(parts[1])).map(x=>({...x,active:!!x.active})));
    if (method === 'POST' && parts.length === 1) { let b;try{b=await readJson(req)}catch{return sendJson(res,400,{error:'بيانات غير صحيحة'})}if(!b.package_id||!String(b.title||'').trim())return sendJson(res,400,{error:'الباقة والعنوان مطلوبان'});const id=uid(),now=Date.now();db.prepare(`INSERT INTO resources (id,package_id,title,type,url,note,sort,active,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id,b.package_id,String(b.title).trim(),b.type||'link',b.url||'',b.note||'',+b.sort||0,b.active===false?0:1,now,now);return sendJson(res,200,{ok:true,id}); }
    if (parts.length===2){const id=decodeURIComponent(parts[1]),old=db.prepare('SELECT * FROM resources WHERE id=?').get(id);if(!old)return sendJson(res,404,{error:'المورد غير موجود'});if(method==='PUT'){let b;try{b=await readJson(req)}catch{return sendJson(res,400,{error:'بيانات غير صحيحة'})}db.prepare(`UPDATE resources SET package_id=?,title=?,type=?,url=?,note=?,sort=?,active=?,updated=? WHERE id=?`).run(b.package_id||old.package_id,b.title||old.title,b.type||old.type,b.url??old.url,b.note??old.note,+b.sort||old.sort,b.active===false?0:1,Date.now(),id);return sendJson(res,200,{ok:true})}if(method==='DELETE'){db.prepare('DELETE FROM resources WHERE id=?').run(id);return sendJson(res,200,{ok:true})}}
  }

  if (parts[0] === 'enroll' && (method === 'POST' || method === 'DELETE')) {
    let b; try { b = await readJson(req); } catch { return sendJson(res,400,{error:'بيانات غير صحيحة'}); }
    const email=String(b.email||'').trim().toLowerCase(), pkg=String(b.packageId||'').trim();
    const u=db.prepare("SELECT id,name,email FROM users WHERE email=? AND role='student'").get(email);
    if(!u)return sendJson(res,404,{error:'لا يوجد طالب بهذا البريد'});
    if(!pkg)return sendJson(res,400,{error:'اختر الباقة'});
    if(method==='POST'){grant(u.id,pkg,Math.max(1,+b.days||365),String(b.source||'إضافة إدارية'));return sendJson(res,200,{ok:true,user:u})}
    db.prepare('DELETE FROM enrollments WHERE user_id=? AND package_id=?').run(u.id,pkg);return sendJson(res,200,{ok:true,user:u});
  }

  if (parts[0] === 'students' && method === 'GET') {
    const q=`%${String(requestUrl.searchParams.get('q')||'').trim()}%`;
    const rows=db.prepare(`SELECT id,name,email,phone,active FROM users WHERE role='student' AND (name LIKE ? OR email LIKE ?) ORDER BY created DESC LIMIT 50`).all(q,q);
    const ens=db.prepare('SELECT user_id,package_id,source,expires FROM enrollments').all();
    return sendJson(res,200,rows.map(u=>({...u,enrollments:ens.filter(e=>e.user_id===u.id)})));
  }

  return sendJson(res, 404, { error: 'مسار إدارة المحتوى غير معروف' });
}

function forwardToApp(req, res) {
  const headers = { ...req.headers };
  delete headers.connection;
  headers.host = req.headers.host || 'al-ltc.com';
  headers['x-forwarded-proto'] = req.headers['x-forwarded-proto'] || 'https';
  headers['x-forwarded-host'] = req.headers.host || '';
  const upstream = http.request({ hostname:'127.0.0.1',port:INTERNAL_PORT,method:req.method,path:req.url,headers }, upstreamRes => {
    const outHeaders = {};
    for (const [key,value] of Object.entries(upstreamRes.headers)) if (!HOP_BY_HOP.has(key.toLowerCase()) && value !== undefined) outHeaders[key]=value;
    outHeaders['referrer-policy']='strict-origin-when-cross-origin';
    res.writeHead(upstreamRes.statusCode || 502, outHeaders); upstreamRes.pipe(res);
  });
  upstream.on('error', err => { console.error('Proxy upstream error:', err.message); if(!res.headersSent)res.writeHead(502,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:'Temporary upstream error'})); });
  req.pipe(upstream);
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && requestUrl.pathname === `/${PANEL}/content`) return serveContentAdmin(res);
    if (requestUrl.pathname.startsWith(`/${PANEL}/api/content-admin`)) return await handleContentAdmin(req,res,requestUrl);
    if (PAYMENT_GATEWAY === 'kashier' && req.method === 'POST' && requestUrl.pathname === '/api/pay/create') return await handleKashierCreate(req,res);
    if (PAYMENT_GATEWAY === 'kashier' && req.method === 'GET' && requestUrl.pathname.startsWith('/api/pay/kashier/return/')) return handleKashierReturn(req,res,requestUrl);
    return forwardToApp(req,res);
  } catch (err) {
    console.error('Proxy request error:', err);
    if (!res.headersSent) sendJson(res,500,{error:'حدث خطأ بالخادم أثناء تنفيذ العملية'}); else res.end();
  }
});

server.listen(PUBLIC_PORT,'0.0.0.0',()=>{
  console.log(`Public proxy listening on ${PUBLIC_PORT}; app on ${INTERNAL_PORT}; payments=${PAYMENT_GATEWAY}; content-admin=/${PANEL}/content`);
});
