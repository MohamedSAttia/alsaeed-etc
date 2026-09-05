/* ============================================================
   منصة السعيد — الخادم
   حسابات · اشتراكات · دفع بتحقّق من الخادم · شهادات قابلة للتحقّق
   ============================================================ */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
/* Railway/Caddy أمام التطبيق — يلزم لعمل rate-limit بعناوين المستخدمين الحقيقية */
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const SITE = process.env.SITE_URL || `http://localhost:${PORT}`;

/* ═══════════ قاعدة البيانات ═══════════ */
const db = new Database(process.env.DB_PATH || path.join(__dirname, 'alsaeed.db'));
db.pragma('journal_mode = WAL');
/* ترقية آمنة للجداول القائمة */

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
  pass TEXT NOT NULL, role TEXT DEFAULT 'student', phone TEXT,
  active INTEGER DEFAULT 1, last_login INTEGER, created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, package_id TEXT NOT NULL,
  source TEXT, expires INTEGER, created INTEGER NOT NULL,
  UNIQUE(user_id, package_id)
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, package_id TEXT NOT NULL,
  amount INTEGER NOT NULL, currency TEXT NOT NULL,
  status TEXT DEFAULT 'pending', gateway TEXT, gateway_id TEXT,
  created INTEGER NOT NULL, paid_at INTEGER
);
CREATE TABLE IF NOT EXISTS progress (
  user_id TEXT NOT NULL, package_id TEXT NOT NULL, data TEXT NOT NULL,
  updated INTEGER NOT NULL, PRIMARY KEY (user_id, package_id)
);
CREATE TABLE IF NOT EXISTS lessons (
  package_id TEXT NOT NULL, idx INTEGER NOT NULL,
  title TEXT, title_en TEXT, chapter INTEGER, duration TEXT, vimeo TEXT, free INTEGER DEFAULT 0,
  notes TEXT, notes_en TEXT,
  PRIMARY KEY (package_id, idx)
);
CREATE TABLE IF NOT EXISTS certificates (
  no TEXT PRIMARY KEY, user_id TEXT NOT NULL, package_id TEXT NOT NULL,
  name TEXT NOT NULL, course TEXT, hours INTEGER, issued INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, name TEXT, email TEXT, subject TEXT, body TEXT, created INTEGER
);
`);

/* مشرف أول — لا توجد كلمة مرور افتراضية داخل الكود */
const admins = db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin'").get();
if (!admins.c) {
  const mail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const pass = String(process.env.ADMIN_PASSWORD || '');
  if (mail && pass.length >= 10) {
    db.prepare('INSERT INTO users (id,name,email,pass,role,created) VALUES (?,?,?,?,?,?)')
      .run(uid(), 'مشرف المنصة', mail, bcrypt.hashSync(pass, 12), 'admin', Date.now());
    console.log(`
✅ تم إنشاء حساب المشرف: ${mail}
`);
  } else {
    console.warn(`\n⚠️ لا يوجد حساب مشرف. اضبط ADMIN_EMAIL و ADMIN_PASSWORD (10 أحرف على الأقل) ثم أعد تشغيل الخادم.\n`);
  }
}

function uid() { return crypto.randomBytes(9).toString('base64url'); }

/* ═══════════ الحماية ═══════════ */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 30,
  message: { error: 'محاولات كثيرة — انتظر قليلاً' } }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 120 }));

function sign(u) {
  return jwt.sign({ id: u.id, role: u.role }, JWT_SECRET, { expiresIn: '30d' });
}
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });
  try {
    const p = jwt.verify(t, JWT_SECRET);
    req.user = db.prepare('SELECT id,name,email,role,phone,created FROM users WHERE id=?').get(p.id);
    if (!req.user) return res.status(401).json({ error: 'الحساب غير موجود' });
    next();
  } catch (e) { res.status(401).json({ error: 'الجلسة منتهية — سجّل الدخول من جديد' }); }
}
function admin(req, res, next) {
  if (!req.user || req.user.role !== 'admin')
    return res.status(403).json({ error: 'هذه العملية للمشرفين' });
  next();
}
const setting = k => { const r = db.prepare('SELECT v FROM settings WHERE k=?').get(k); return r ? r.v : ''; };
const setSetting = (k, v) => db.prepare('INSERT INTO settings (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=?').run(k, v, v);

/* ترحيل V15: يستبدل قائمة العرض القديمة فقط، ثم تبقى تعديلات المشرف محفوظة. */
const DEFAULT_PROMOS_V15 = [
  { code:'ALSAEED10', schemaVersion:15, pct:10, until:'2026-12-31', desc:'خصم عام' },
  { code:'STUDENT20', schemaVersion:15, pct:20, until:'2026-12-31', desc:'خصم الطلاب' },
  { code:'GROUP25', schemaVersion:15, pct:25, until:'2026-12-31', desc:'خصم المجموعات (3+)' },
  { code:'WELCOME15', schemaVersion:15, pct:15, until:'2027-12-31', desc:'خصم الترحيب بالمنصة المطوّرة' }
];
const V15_COURSE_IDS = ['pmp','rmp','acp','grcp','p3o','pba','lss'];
const readList = key => {
  try { const value = JSON.parse(setting(key) || '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
};
let v15Catalog = { courses:[], packages:[], systems:[], promos:DEFAULT_PROMOS_V15 };
try {
  const parsed = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'v15-catalog.json'), 'utf8'));
  if (parsed && parsed.schemaVersion === 15) v15Catalog = parsed;
} catch (e) { console.warn('تعذّر تحميل كتالوج V15:', e.message); }

const savedCourses = readList('content_courses');
const savedCourseIds = savedCourses.map(x => x.id).filter(Boolean).sort();
const validCourseIds = V15_COURSE_IDS.slice().sort();
if (JSON.stringify(savedCourseIds) !== JSON.stringify(validCourseIds) && v15Catalog.courses.length)
  setSetting('content_courses', JSON.stringify(v15Catalog.courses));

const savedPackages = readList('content_packages');
if ((!savedPackages.length || !savedPackages.every(x => x.schemaVersion === 15 && V15_COURSE_IDS.includes(x.course))) && v15Catalog.packages.length) {
  setSetting('content_packages', JSON.stringify(v15Catalog.packages));
  setSetting('catalog', JSON.stringify(v15Catalog.packages.filter(p => p.active !== false).map(p => ({
    id:p.id, ar:p.ar, en:p.en || '', code:p.code || p.id, price:p.price,
    currency:p.currency || 'USD', days:p.days, hours:p.hours, cert:!!p.cert, type:p.type
  }))));
}

const savedSystems = readList('content_systems');
if ((!savedSystems.length || !savedSystems.every(x => x.schemaVersion === 15)) && v15Catalog.systems.length)
  setSetting('content_systems', JSON.stringify(v15Catalog.systems));

const savedPromos = readList('content_promos');
if (!savedPromos.length || !savedPromos.every(x => x.schemaVersion === 15))
  setSetting('content_promos', JSON.stringify(v15Catalog.promos.length ? v15Catalog.promos : DEFAULT_PROMOS_V15));

/* ═══════════ الحسابات ═══════════ */
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, phone } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: 'الاسم والبريد وكلمة المرور مطلوبة' });
  if (String(password).length < 10)
    return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 10 أحرف على الأقل' });
  const mail = String(email).trim().toLowerCase();
  if (db.prepare('SELECT id FROM users WHERE email=?').get(mail))
    return res.status(409).json({ error: 'هذا البريد مسجّل — سجّل الدخول' });
  const id = uid();
  db.prepare('INSERT INTO users (id,name,email,pass,role,phone,created) VALUES (?,?,?,?,?,?,?)')
    .run(id, String(name).trim(), mail, bcrypt.hashSync(password, 12), 'student', phone || null, Date.now());
  const u = db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(id);
  res.json({ token: sign(u), user: u });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(email || '').trim().toLowerCase());
  if (!u || !bcrypt.compareSync(String(password || ''), u.pass))
    return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });
  if (u.active === 0)
    return res.status(403).json({ error: 'هذا الحساب معطّل — تواصل مع الإدارة' });
  res.json({ token: sign(u), user: { id: u.id, name: u.name, email: u.email, role: u.role } });
});

app.get('/api/me', auth, (req, res) => {
  const packs = db.prepare('SELECT package_id, source, expires, created FROM enrollments WHERE user_id=?')
    .all(req.user.id);
  res.json({ user: req.user, packages: packs });
});

app.post('/api/me/password', auth, (req, res) => {
  const { current, next } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!bcrypt.compareSync(String(current || ''), u.pass))
    return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
  if (String(next || '').length < 10) return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 10 أحرف على الأقل' });
  db.prepare('UPDATE users SET pass=? WHERE id=?').run(bcrypt.hashSync(next, 12), u.id);
  res.json({ ok: true });
});

/* ═══════════ التقدّم ═══════════ */
app.get('/api/progress/:pkg', auth, (req, res) => {
  const r = db.prepare('SELECT data FROM progress WHERE user_id=? AND package_id=?')
    .get(req.user.id, req.params.pkg);
  res.json(r ? JSON.parse(r.data) : { lessons: {}, weeks: {}, exams: {} });
});
app.put('/api/progress/:pkg', auth, (req, res) => {
  const owns = db.prepare('SELECT id FROM enrollments WHERE user_id=? AND package_id=?')
    .get(req.user.id, req.params.pkg);
  if (!owns) return res.status(403).json({ error: 'لست مشتركاً في هذه الباقة' });
  db.prepare(`INSERT INTO progress (user_id,package_id,data,updated) VALUES (?,?,?,?)
    ON CONFLICT(user_id,package_id) DO UPDATE SET data=?, updated=?`)
    .run(req.user.id, req.params.pkg, JSON.stringify(req.body || {}), Date.now(),
         JSON.stringify(req.body || {}), Date.now());
  res.json({ ok: true });
});

/* ═══════════ الدروس والفيديو — لا تُسلَّم إلا لمشترك ═══════════ */
app.get('/api/lessons/:pkg', (req, res) => {
  const rows = db.prepare('SELECT idx,title,title_en,chapter,duration,vimeo,free,notes,notes_en FROM lessons WHERE package_id=? ORDER BY idx')
    .all(req.params.pkg);
  let enrolled = false;
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) {
    try {
      const p = jwt.verify(h.slice(7), JWT_SECRET);
      enrolled = !!db.prepare('SELECT id FROM enrollments WHERE user_id=? AND package_id=?')
        .get(p.id, req.params.pkg);
    } catch (e) {}
  }
  /* رقم الفيديو يُحجب عن غير المشترك — وهذا ما يمنع نسخ الروابط */
  res.json(rows.map(r => ({ ...r, vimeo: (enrolled || r.free) ? r.vimeo : null })));
});

/* ═══════════ الدفع — التحقّق يتمّ هنا لا في المتصفح ═══════════ */
const GATEWAYS = {
  /* ── Paymob (مصر) — كروت · ميزة · محافظ · فوري ── */
  paymob: {
    create: async (order, pkg) => {
      const key = process.env.PAYMOB_SECRET_KEY;
      const methods = (process.env.PAYMOB_INTEGRATION_IDS || '')
        .split(',').map(x => parseInt(x.trim())).filter(Boolean);
      if (!key) throw new Error('مفتاح Paymob غير مضبوط');
      if (!methods.length) throw new Error('معرّفات طرق الدفع غير مضبوطة');
      const r = await fetch('https://accept.paymob.com/v1/intention/', {
        method: 'POST',
        headers: { 'Authorization': 'Token ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(order.amount * 100),
          currency: order.currency,
          payment_methods: methods,
          items: [{ name: (pkg.ar || order.package_id).slice(0, 50),
                    amount: Math.round(order.amount * 100), quantity: 1 }],
          billing_data: {
            first_name: (order.name || 'Student').split(' ')[0],
            last_name: (order.name || 'Student').split(' ').slice(1).join(' ') || 'Learner',
            email: order.email, phone_number: order.phone || '+201000000000',
            country: 'EG', city: 'Cairo', street: 'NA', building: 'NA',
            floor: 'NA', apartment: 'NA'
          },
          extras: { order_id: order.id, user_id: order.user_id, package_id: order.package_id },
          special_reference: order.id,
          notification_url: `${SITE}/api/pay/webhook`,
          redirection_url: `${SITE}/api/pay/return?order=${order.id}`
        })
      });
      const d = await r.json();
      if (!r.ok || !d.client_secret)
        throw new Error(d.detail || d.message || 'تعذّر إنشاء الدفعة');
      const pk = process.env.PAYMOB_PUBLIC_KEY || '';
      return { url: `https://accept.paymob.com/unifiedcheckout/?publicKey=${pk}&clientSecret=${d.client_secret}`,
               gatewayId: d.id || order.id };
    },
    verify: async (id, ref) => {
      const key = process.env.PAYMOB_SECRET_KEY;
      /* الاستعلام بالمرجع الخاص للطلب */
      const r = await fetch(`https://accept.paymob.com/api/ecommerce/orders/transaction_inquiry`, {
        method: 'POST',
        headers: { 'Authorization': 'Token ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant_order_id: ref || id })
      });
      const d = await r.json().catch(() => ({}));
      return { paid: d.success === true && d.pending === false, raw: d };
    }
  },

  moyasar: {
    create: async (order, pkg) => {
      const key = process.env.MOYASAR_SECRET_KEY;
      if (!key) throw new Error('مفتاح ميسر غير مضبوط');
      const r = await fetch('https://api.moyasar.com/v1/invoices', {
        method: 'POST',
        headers: { 'Authorization': 'Basic ' + Buffer.from(key + ':').toString('base64'),
                   'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: order.amount * 100, currency: order.currency,
          description: pkg.ar || order.package_id,
          callback_url: `${SITE}/api/pay/return?order=${order.id}`,
          metadata: { order_id: order.id, user_id: order.user_id, package_id: order.package_id }
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || 'تعذّر إنشاء الفاتورة');
      return { url: d.url, gatewayId: d.id };
    },
    verify: async id => {
      const key = process.env.MOYASAR_SECRET_KEY;
      const r = await fetch(`https://api.moyasar.com/v1/invoices/${id}`, {
        headers: { 'Authorization': 'Basic ' + Buffer.from(key + ':').toString('base64') } });
      const d = await r.json();
      return { paid: d.status === 'paid', raw: d };
    }
  },
  tap: {
    create: async (order, pkg) => {
      const key = process.env.TAP_SECRET_KEY;
      if (!key) throw new Error('مفتاح تاب غير مضبوط');
      const r = await fetch('https://api.tap.company/v2/charges', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: order.amount, currency: order.currency,
          description: pkg.ar || order.package_id,
          reference: { order: order.id },
          customer: { first_name: 'Student', email: order.email || 'student@al-ltc.com' },
          source: { id: 'src_all' },
          redirect: { url: `${SITE}/api/pay/return?order=${order.id}` },
          post: { url: `${SITE}/api/pay/webhook` }
        })
      });
      const d = await r.json();
      if (!d.transaction) throw new Error(d.errors ? d.errors[0].description : 'تعذّر إنشاء الدفعة');
      return { url: d.transaction.url, gatewayId: d.id };
    },
    verify: async id => {
      const r = await fetch(`https://api.tap.company/v2/charges/${id}`, {
        headers: { 'Authorization': 'Bearer ' + process.env.TAP_SECRET_KEY } });
      const d = await r.json();
      return { paid: d.status === 'CAPTURED', raw: d };
    }
  }
};

/* يفتح الباقة — يُستدعى فقط بعد تحقّق حقيقي من البوابة */
function grant(userId, pkgId, days, source) {
  const exp = days ? Date.now() + days * 86400000 : null;
  db.prepare(`INSERT INTO enrollments (id,user_id,package_id,source,expires,created)
    VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,package_id) DO UPDATE SET expires=?`)
    .run(uid(), userId, pkgId, source || 'شراء', exp, Date.now(), exp);
}

app.post('/api/pay/create', auth, async (req, res) => {
  const { packageId, promoCode } = req.body || {};
  const catalog = JSON.parse(setting('catalog') || '[]');
  const pkg = catalog.find(p => p.id === packageId);
  if (!pkg) return res.status(404).json({ error: 'الباقة غير موجودة' });
  if (db.prepare('SELECT id FROM enrollments WHERE user_id=? AND package_id=?').get(req.user.id, packageId))
    return res.status(409).json({ error: 'أنت مشترك في هذه الباقة' });

  let amount = pkg.price;
  if (promoCode) {
    let promos = [];
    try { promos = JSON.parse(setting('content_promos') || '[]'); } catch (e) {}
    const code = String(promoCode).trim().toUpperCase();
    const promo = promos.find(x => String(x.code).toUpperCase() === code);
    const validUntil = promo && (!promo.until ||
      new Date(promo.until + 'T23:59:59Z').getTime() >= Date.now());
    if (!promo || !validUntil)
      return res.status(400).json({ error: 'كود الخصم غير صالح أو منتهٍ' });
    amount = Math.max(0, Math.round(pkg.price * (1 - Math.min(100, Math.max(0, promo.pct)) / 100)));
  }
  const order = { id: 'ORD-' + uid().toUpperCase(), user_id: req.user.id, package_id: packageId,
    amount, currency: pkg.currency || 'USD',
    email: req.user.email, name: req.user.name, phone: req.user.phone };
  db.prepare(`INSERT INTO orders (id,user_id,package_id,amount,currency,status,gateway,created)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(order.id, order.user_id, order.package_id, order.amount, order.currency,
         'pending', setting('gateway') || 'moyasar', Date.now());

  const gw = GATEWAYS[setting('gateway') || 'moyasar'];
  if (!gw) return res.status(500).json({ error: 'بوابة الدفع غير مضبوطة' });
  try {
    const { url, gatewayId } = await gw.create(order, pkg);
    db.prepare('UPDATE orders SET gateway_id=? WHERE id=?').run(gatewayId, order.id);
    res.json({ orderId: order.id, paymentUrl: url });
  } catch (e) {
    db.prepare("UPDATE orders SET status='failed' WHERE id=?").run(order.id);
    res.status(502).json({ error: e.message });
  }
});

/* إشعار البوابة — هنا يُفتح المحتوى */
app.post('/api/pay/webhook', express.json(), async (req, res) => {
  try {
    const b = req.body || {};
    const gwName = setting('gateway') || 'moyasar';
    const gwId = b.id || (b.data && b.data.id);
    const orderId = (b.metadata && b.metadata.order_id) ||
                    (b.reference && b.reference.order) ||
                    (b.data && b.data.metadata && b.data.metadata.order_id);
    if (!orderId) return res.status(400).json({ error: 'no order' });
    const order = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
    if (!order) return res.status(404).json({ error: 'order not found' });
    if (order.status === 'paid') return res.json({ ok: true, already: true });

    /* التحقّق المستقل من البوابة — لا نثق بمحتوى الإشعار وحده */
    const { paid } = await GATEWAYS[gwName].verify(gwId || order.gateway_id, order.id);
    if (!paid) return res.json({ ok: true, paid: false });

    const catalog = JSON.parse(setting('catalog') || '[]');
    const pkg = catalog.find(p => p.id === order.package_id) || {};
    db.prepare("UPDATE orders SET status='paid', paid_at=? WHERE id=?").run(Date.now(), order.id);
    grant(order.user_id, order.package_id, pkg.days || 90, 'شراء');
    res.json({ ok: true, paid: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* عودة المستخدم من البوابة */
app.get('/api/pay/return', async (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.query.order);
  if (order && order.status !== 'paid' && order.gateway_id) {
    try {
      const { paid } = await GATEWAYS[order.gateway].verify(order.gateway_id, order.id);
      if (paid) {
        const catalog = JSON.parse(setting('catalog') || '[]');
        const pkg = catalog.find(p => p.id === order.package_id) || {};
        db.prepare("UPDATE orders SET status='paid', paid_at=? WHERE id=?").run(Date.now(), order.id);
        grant(order.user_id, order.package_id, pkg.days || 90, 'شراء');
      }
    } catch (e) {}
  }
  const o2 = db.prepare('SELECT status,package_id FROM orders WHERE id=?').get(req.query.order);
  res.redirect(`/#learn/${o2 ? o2.package_id : ''}?paid=${o2 && o2.status === 'paid' ? '1' : '0'}`);
});

app.get('/api/orders/:id', auth, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  res.json(o || { error: 'غير موجود' });
});

/* ═══════════ الشهادات ═══════════ */
app.post('/api/certificate/:pkg', auth, (req, res) => {
  const owns = db.prepare('SELECT id FROM enrollments WHERE user_id=? AND package_id=?')
    .get(req.user.id, req.params.pkg);
  if (!owns) return res.status(403).json({ error: 'لست مشتركاً في هذه الباقة' });
  const catalog = JSON.parse(setting('catalog') || '[]');
  const pkg = catalog.find(x => x.id === req.params.pkg) || {};
  if (!pkg.cert)
    return res.status(400).json({ error: 'شهادة الحضور متاحة للباقة الكاملة فقط' });
  const pr = db.prepare('SELECT data FROM progress WHERE user_id=? AND package_id=?')
    .get(req.user.id, req.params.pkg);
  const p = pr ? JSON.parse(pr.data) : {};
  if (!(p.exams && p.exams.full && p.exams.full.passed))
    return res.status(400).json({ error: 'يلزم اجتياز الاختبار الشامل أولاً' });

  const ex = db.prepare('SELECT no FROM certificates WHERE user_id=? AND package_id=?')
    .get(req.user.id, req.params.pkg);
  if (ex) return res.json({ no: ex.no, verify: `${SITE}/verify/${ex.no}` });

  const no = 'AS-' + new Date().getFullYear() + '-' + uid().toUpperCase().slice(0, 6);
  db.prepare('INSERT INTO certificates (no,user_id,package_id,name,course,hours,issued) VALUES (?,?,?,?,?,?,?)')
    .run(no, req.user.id, req.params.pkg, req.user.name, pkg.ar || '', pkg.hours || 0, Date.now());
  res.json({ no, verify: `${SITE}/verify/${no}` });
});

/* التحقّق العام — يجعل الشهادة ذات قيمة حقيقية */
app.get('/api/verify/:no', (req, res) => {
  const c = db.prepare('SELECT no,name,course,hours,issued FROM certificates WHERE no=?').get(req.params.no);
  if (!c) return res.status(404).json({ valid: false, error: 'لا توجد شهادة بهذا الرقم' });
  res.json({ valid: true, ...c, issuedText: new Date(c.issued).toLocaleDateString('ar-SA') });
});

/* ═══════════ الإدارة ═══════════ */
app.get('/api/admin/stats', auth, admin, (req, res) => {
  res.json({
    students: db.prepare("SELECT COUNT(*) c FROM users WHERE role='student'").get().c,
    orders: db.prepare('SELECT COUNT(*) c FROM orders').get().c,
    paid: db.prepare("SELECT COUNT(*) c FROM orders WHERE status='paid'").get().c,
    revenue: db.prepare("SELECT COALESCE(SUM(amount),0) s FROM orders WHERE status='paid'").get().s,
    certificates: db.prepare('SELECT COUNT(*) c FROM certificates').get().c
  });
});
app.get('/api/admin/users', auth, admin, (req, res) => {
  const users = db.prepare('SELECT id,name,email,role,phone,created FROM users ORDER BY created DESC').all();
  const en = db.prepare('SELECT user_id,package_id,source,expires,created FROM enrollments').all();
  res.json(users.map(u => ({ ...u, packages: en.filter(e => e.user_id === u.id) })));
});

function progressSummary(userId, packageId, enrollmentCreated) {
  const row = db.prepare('SELECT data,updated FROM progress WHERE user_id=? AND package_id=?').get(userId, packageId);
  let data = { lessons:{}, weeks:{}, exams:{} };
  if (row) { try { data = JSON.parse(row.data); } catch (e) {} }
  const lessonTotal = db.prepare('SELECT COUNT(*) c FROM lessons WHERE package_id=?').get(packageId).c || 0;
  const lessonDone = Object.values(data.lessons || {}).filter(Boolean).length;
  const exams = Object.values(data.exams || {}).filter(Boolean);
  const scores = exams.map(x => Number(x.score)).filter(Number.isFinite);
  const avgExam = scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : 0;
  const weeksDone = Object.values(data.weeks || {}).filter(Boolean).length;
  let progress = lessonTotal ? Math.round(Math.min(1, lessonDone/lessonTotal)*85 + Math.min(15, exams.filter(x=>x.passed).length*5)) : Math.min(100, weeksDone*10 + exams.filter(x=>x.passed).length*10);
  return { progress, avgExam:Math.round(avgExam*10)/10, lessonDone, lessonTotal, examsAttempted:exams.length, lastActivity:(row&&row.updated)||enrollmentCreated||0 };
}

app.get('/api/admin/overview', auth, admin, (req, res) => {
  const now=Date.now();
  const users=db.prepare("SELECT id,name,email,phone,created FROM users WHERE role='student' ORDER BY created DESC").all();
  const enrollments=db.prepare('SELECT user_id,package_id,source,expires,created FROM enrollments').all();
  const catalog=JSON.parse(setting('catalog')||'[]');
  const names=new Map(catalog.map(x=>[x.id,x.ar||x.id]));
  const students=users.map(u=>{
    const ens=enrollments.filter(e=>e.user_id===u.id);
    const details=ens.map(e=>({...e,...progressSummary(u.id,e.package_id,e.created)}));
    const progress=details.length?Math.round(details.reduce((a,x)=>a+x.progress,0)/details.length):0;
    const examVals=details.map(x=>x.avgExam).filter(x=>x>0);
    const avgExam=examVals.length?Math.round(examVals.reduce((a,b)=>a+b,0)/examVals.length):0;
    const lastActivity=Math.max(u.created,...details.map(x=>x.lastActivity||0));
    const future=ens.map(x=>x.expires).filter(x=>x&&x>now).sort((a,b)=>a-b);
    return { ...u, enrollments:ens.length, progress, avgExam, lastActivity, nearestExpiry:future[0]||null };
  });
  const orders=db.prepare(`SELECT o.*,u.name user_name,u.email user_email FROM orders o LEFT JOIN users u ON u.id=o.user_id ORDER BY o.created DESC LIMIT 20`).all().map(o=>({...o,package_name:names.get(o.package_id)||o.package_id}));
  const activeEnrollments=enrollments.filter(e=>!e.expires||e.expires>now).length;
  res.json({
    stats:{students:users.length,orders:db.prepare('SELECT COUNT(*) c FROM orders').get().c,paid:db.prepare("SELECT COUNT(*) c FROM orders WHERE status='paid'").get().c,revenue:db.prepare("SELECT COALESCE(SUM(amount),0) s FROM orders WHERE status='paid'").get().s,certificates:db.prepare('SELECT COUNT(*) c FROM certificates').get().c,activeEnrollments},
    students,recentOrders:orders
  });
});

app.get('/api/admin/users/:id/activity', auth, admin, (req,res)=>{
  const u=db.prepare('SELECT id,name,email,phone,role,created FROM users WHERE id=?').get(req.params.id);
  if(!u)return res.status(404).json({error:'المستخدم غير موجود'});
  const ens=db.prepare('SELECT package_id,source,expires,created FROM enrollments WHERE user_id=? ORDER BY created DESC').all(u.id).map(e=>({...e,...progressSummary(u.id,e.package_id,e.created)}));
  const certs=db.prepare('SELECT no,package_id,course,hours,issued FROM certificates WHERE user_id=? ORDER BY issued DESC').all(u.id);
  const orders=db.prepare('SELECT id,package_id,amount,currency,status,gateway,created,paid_at FROM orders WHERE user_id=? ORDER BY created DESC LIMIT 50').all(u.id);
  res.json({user:u,enrollments:ens,certificates:certs,orders});
});

app.post('/api/admin/users', auth, admin, (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'الاسم والبريد وكلمة المرور مطلوبة' });
  if (String(password).length < 10) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 10 أحرف على الأقل' });
  const mail = String(email).trim().toLowerCase();
  if (db.prepare('SELECT id FROM users WHERE email=?').get(mail))
    return res.status(409).json({ error: 'البريد مسجّل' });
  const id = uid();
  db.prepare('INSERT INTO users (id,name,email,pass,role,created) VALUES (?,?,?,?,?,?)')
    .run(id, name, mail, bcrypt.hashSync(password, 12), role || 'student', Date.now());
  res.json({ id });
});
/* تعديل بيانات مستخدم */
app.put('/api/admin/users/:id', auth, admin, (req, res) => {
  const { name, email, phone, role, password, active } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'المستخدم غير موجود' });
  if (email && email.toLowerCase() !== u.email) {
    const dup = db.prepare('SELECT id FROM users WHERE email=? AND id!=?')
      .get(email.toLowerCase(), u.id);
    if (dup) return res.status(409).json({ error: 'البريد مستخدم لحساب آخر' });
  }
  /* لا يُسمح بتخفيض آخر مشرف */
  if (role && role !== 'admin' && u.role === 'admin') {
    const n = db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin'").get().c;
    if (n <= 1) return res.status(400).json({ error: 'لا يمكن تخفيض آخر مشرف في النظام' });
  }
  db.prepare(`UPDATE users SET name=?, email=?, phone=?, role=?, active=? WHERE id=?`)
    .run(name || u.name, (email || u.email).toLowerCase(), phone !== undefined ? phone : u.phone,
         role || u.role, active === undefined ? (u.active === undefined ? 1 : u.active) : (active ? 1 : 0), u.id);
  if (password && String(password).length >= 6)
    db.prepare('UPDATE users SET pass=? WHERE id=?').run(bcrypt.hashSync(password, 10), u.id);
  res.json({ ok: true });
});

/* تعطيل / تفعيل */
app.post('/api/admin/users/:id/toggle', auth, admin, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'غير موجود' });
  if (u.role === 'admin') return res.status(400).json({ error: 'لا يمكن تعطيل حساب مشرف' });
  const nv = (u.active === 0) ? 1 : 0;
  db.prepare('UPDATE users SET active=? WHERE id=?').run(nv, u.id);
  res.json({ ok: true, active: nv });
});

/* إعادة تعيين كلمة المرور */
app.post('/api/admin/users/:id/reset', auth, admin, (req, res) => {
  const u = db.prepare('SELECT id FROM users WHERE id=?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'غير موجود' });
  const tmp = 'AS' + Math.random().toString(36).slice(2, 8).toUpperCase() + '!';
  db.prepare('UPDATE users SET pass=? WHERE id=?').run(bcrypt.hashSync(tmp, 10), u.id);
  res.json({ ok: true, password: tmp });
});

/* تفاصيل مستخدم مع تقدّمه */
app.get('/api/admin/users/:id', auth, admin, (req, res) => {
  const u = db.prepare('SELECT id,name,email,role,phone,created,active FROM users WHERE id=?')
    .get(req.params.id);
  if (!u) return res.status(404).json({ error: 'غير موجود' });
  const en = db.prepare('SELECT * FROM enrollments WHERE user_id=?').all(u.id);
  const or = db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created DESC').all(u.id);
  const pr = db.prepare('SELECT package_id,data,updated FROM progress WHERE user_id=?').all(u.id);
  const ce = db.prepare('SELECT no,package_id,issued FROM certificates WHERE user_id=?').all(u.id);
  res.json({ user: u, enrollments: en, orders: or,
    progress: pr.map(p => ({ ...p, data: JSON.parse(p.data || '{}') })), certificates: ce });
});

/* عمليات جماعية */
app.post('/api/admin/bulk', auth, admin, (req, res) => {
  const { action, ids, packageId, days } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'لا مستخدمين محدّدين' });
  let n = 0;
  if (action === 'grant' && packageId) {
    ids.forEach(id => { try { grant(id, packageId, days || 365, 'منح جماعي'); n++; } catch (e) {} });
  } else if (action === 'revoke' && packageId) {
    ids.forEach(id => {
      const r = db.prepare('DELETE FROM enrollments WHERE user_id=? AND package_id=?').run(id, packageId);
      n += r.changes;
    });
  } else if (action === 'disable') {
    ids.forEach(id => {
      const r = db.prepare("UPDATE users SET active=0 WHERE id=? AND role!='admin'").run(id);
      n += r.changes;
    });
  } else if (action === 'enable') {
    ids.forEach(id => { n += db.prepare('UPDATE users SET active=1 WHERE id=?').run(id).changes; });
  } else if (action === 'delete') {
    ids.forEach(id => {
      const r = db.prepare("DELETE FROM users WHERE id=? AND role!='admin'").run(id);
      if (r.changes) { db.prepare('DELETE FROM enrollments WHERE user_id=?').run(id);
        db.prepare('DELETE FROM progress WHERE user_id=?').run(id); n++; }
    });
  } else return res.status(400).json({ error: 'إجراء غير معروف' });
  res.json({ ok: true, affected: n });
});

/* تصدير المستخدمين CSV */
app.get('/api/admin/users.csv', auth, admin, (req, res) => {
  const rows = db.prepare(`SELECT u.name,u.email,u.phone,u.role,u.created,u.active,
    (SELECT COUNT(*) FROM enrollments e WHERE e.user_id=u.id) packages
    FROM users u ORDER BY u.created DESC`).all();
  const head = 'الاسم,البريد,الهاتف,الدور,تاريخ التسجيل,الحالة,عدد الباقات';
  const body = rows.map(r => [r.name, r.email, r.phone || '', r.role,
    new Date(r.created).toLocaleDateString('ar-EG'),
    r.active === 0 ? 'معطّل' : 'نشط', r.packages]
    .map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="alsaeed-users.csv"');
  res.send('\ufeff' + head + '\n' + body);
});

app.delete('/api/admin/users/:id', auth, admin, (req, res) => {
  db.prepare('DELETE FROM users WHERE id=? AND role!=?').run(req.params.id, 'admin');
  db.prepare('DELETE FROM enrollments WHERE user_id=?').run(req.params.id);
  res.json({ ok: true });
});
app.post('/api/admin/grant', auth, admin, (req, res) => {
  const { userId, packageId, days } = req.body || {};
  if (!userId || !packageId) return res.status(400).json({ error: 'ناقص' });
  grant(userId, packageId, days || 365, 'منح إداري');
  res.json({ ok: true });
});
app.delete('/api/admin/grant', auth, admin, (req, res) => {
  db.prepare('DELETE FROM enrollments WHERE user_id=? AND package_id=?')
    .run(req.body.userId, req.body.packageId);
  res.json({ ok: true });
});
app.get('/api/admin/orders', auth, admin, (req, res) => {
  res.json(db.prepare(`SELECT o.*, u.name user_name, u.email user_email
    FROM orders o LEFT JOIN users u ON u.id=o.user_id ORDER BY o.created DESC LIMIT 500`).all());
});
app.put('/api/admin/lessons/:pkg', auth, admin, (req, res) => {
  const list = req.body || [];
  const del = db.prepare('DELETE FROM lessons WHERE package_id=?');
  const ins = db.prepare(`INSERT INTO lessons (package_id,idx,title,title_en,chapter,duration,vimeo,free,notes,notes_en)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  db.transaction(() => {
    del.run(req.params.pkg);
    list.forEach((l, i) => ins.run(req.params.pkg, i,
      l.t || l.title || '', l.t_en || l.title_en || '',
      l.ch || 0, l.dur || l.duration || '', l.vimeo || '', l.free ? 1 : 0,
      l.notes || '', l.notes_en || ''));
  })();
  res.json({ ok: true, count: list.length });
});
app.get('/api/admin/settings', auth, admin, (req, res) => {
  res.json({
    gateway: setting('gateway') || process.env.PAYMENT_GATEWAY || 'kashier',
    hasPaymob: !!process.env.PAYMOB_SECRET_KEY,
    hasMoyasar: !!process.env.MOYASAR_SECRET_KEY,
    hasTap: !!process.env.TAP_SECRET_KEY,
    publishableKey: setting('publishable_key') || '',
    catalogCount: JSON.parse(setting('catalog') || '[]').length
  });
});
app.put('/api/admin/settings', auth, admin, (req, res) => {
  const { gateway, publishableKey, catalog } = req.body || {};
  if (gateway) setSetting('gateway', gateway);
  if (publishableKey !== undefined) setSetting('publishable_key', publishableKey);
  if (catalog) setSetting('catalog', JSON.stringify(catalog));
  res.json({ ok: true });
});
app.get('/api/admin/messages', auth, admin, (req, res) => {
  res.json(db.prepare('SELECT * FROM messages ORDER BY created DESC LIMIT 200').all());
});

/* ═══════════ المحتوى القابل للتحرير (CMS) ═══════════ */
app.get('/api/content', (req, res) => {
  const out = {};
  ['cms', 'courses', 'packages', 'academic', 'consulting', 'tracks', 'modes', 'systems', 'promos'].forEach(k => {
    const v = setting('content_' + k);
    if (v) { try { out[k] = JSON.parse(v); } catch (e) {} }
  });
  res.json(out);
});
app.put('/api/admin/content', auth, admin, (req, res) => {
  const body = req.body || {};
  Object.keys(body).forEach(k => {
    if (['cms', 'courses', 'packages', 'academic', 'consulting', 'tracks', 'modes', 'systems', 'promos'].includes(k))
      setSetting('content_' + k, JSON.stringify(body[k]));
  });
  /* الكتالوج يُشتق من الباقات ليتحقّق الدفع من السعر */
  if (body.packages) {
    setSetting('catalog', JSON.stringify(body.packages.filter(p => p.active !== false).map(p =>
      ({ id: p.id, ar: p.ar, en:p.en || '', code:p.code || p.id, price: p.price,
         currency: p.currency, days: p.days, hours: p.hours, cert: !!p.cert, type: p.type }))));
  }
  res.json({ ok: true });
});

/* ═══════════ عام ═══════════ */
app.post('/api/contact', (req, res) => {
  const { name, email, subject, body } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'الاسم والبريد مطلوبان' });
  db.prepare('INSERT INTO messages (id,name,email,subject,body,created) VALUES (?,?,?,?,?,?)')
    .run(uid(), name, email, subject || '', body || '', Date.now());
  res.json({ ok: true });
});
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nDisallow: /${PANEL}\nDisallow: /api/\nAllow: /\n`);
});
app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));

/* ═══ لوحة الإدارة المستقلة على مسار سرّي ═══ */
import { mountAdmin } from './admin.js';
const PANEL = mountAdmin(app, db, {
  JWT_SECRET, SITE,
  panelFile: path.join(__dirname, 'public', 'panel.html')
});

/* الملفات الثابتة */
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/verify/:no', (req, res) => res.sendFile(path.join(__dirname, 'public', 'verify.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n🚀 منصة السعيد تعمل على ${SITE}`);
  console.log(`   البوابة: ${setting('gateway') || process.env.PAYMENT_GATEWAY || 'kashier'} · ` +
    `المفتاح السرّي: ${process.env.KASHIER_PAYMENT_API_KEY || process.env.PAYMOB_SECRET_KEY || process.env.MOYASAR_SECRET_KEY || process.env.TAP_SECRET_KEY ? 'مضبوط ✅' : 'غير مضبوط ⚠️'}\n`);
});
