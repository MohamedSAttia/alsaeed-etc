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
import { mountCorporateWorkflow } from './corporate-workflow.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
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
CREATE TABLE IF NOT EXISTS reminder_preferences (
  user_id TEXT PRIMARY KEY, enabled INTEGER DEFAULT 0, days INTEGER DEFAULT 3,
  last_sent INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS lessons (
  package_id TEXT NOT NULL, idx INTEGER NOT NULL,
  title TEXT, title_en TEXT, chapter INTEGER, duration TEXT, vimeo TEXT, free INTEGER DEFAULT 0,
  notes TEXT, notes_en TEXT,
  PRIMARY KEY (package_id, idx)
);
CREATE TABLE IF NOT EXISTS lesson_files (
  id TEXT PRIMARY KEY, package_id TEXT NOT NULL, name TEXT NOT NULL,
  mime TEXT NOT NULL, bytes BLOB NOT NULL, created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS quiz_images (
  id TEXT PRIMARY KEY, package_id TEXT NOT NULL, mime TEXT NOT NULL,
  bytes BLOB NOT NULL, created INTEGER NOT NULL
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
if (!db.pragma('table_info(lessons)').some(col => col.name === 'files'))
  db.exec("ALTER TABLE lessons ADD COLUMN files TEXT DEFAULT '[]'");
if (!db.pragma('table_info(lessons)').some(col => col.name === 'quiz'))
  db.exec("ALTER TABLE lessons ADD COLUMN quiz TEXT DEFAULT '[]'");

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
app.use(express.json({ limit: '16mb' }));
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
  const owns = db.prepare('SELECT expires FROM enrollments WHERE user_id=? AND package_id=?')
    .get(req.user.id, req.params.pkg);
  if (!owns || (owns.expires && owns.expires <= Date.now()))
    return res.status(403).json({ error: 'لا يوجد اشتراك فعّال في هذه الباقة' });
  const incoming = req.body || {};
  const old = db.prepare('SELECT data FROM progress WHERE user_id=? AND package_id=?').get(req.user.id, req.params.pkg);
  if (old) {
    const saved = JSON.parse(old.data);
    for (const [key, answer] of Object.entries(saved.essayAnswers || {})) {
      if (answer.status === 'graded' && incoming.essayAnswers?.[key]) incoming.essayAnswers[key] = answer;
    }
  }
  db.prepare(`INSERT INTO progress (user_id,package_id,data,updated) VALUES (?,?,?,?)
    ON CONFLICT(user_id,package_id) DO UPDATE SET data=?, updated=?`)
    .run(req.user.id, req.params.pkg, JSON.stringify(incoming), Date.now(),
         JSON.stringify(incoming), Date.now());
  res.json({ ok: true });
});
const reminderReady = () => !!(process.env.RESEND_API_KEY && process.env.REMINDER_FROM);
app.get('/api/reminders', auth, (req,res) => {
  const row=db.prepare('SELECT enabled,days FROM reminder_preferences WHERE user_id=?').get(req.user.id);
  res.json({ enabled:!!row?.enabled, days:row?.days || 3, emailReady:reminderReady() });
});
app.put('/api/reminders', auth, (req,res) => {
  const enabled=req.body?.enabled === true, days=Number(req.body?.days);
  if (![1,3,7].includes(days)) return res.status(400).json({ error:'اختر تكرار التذكير' });
  if (enabled && !reminderReady()) return res.status(503).json({ error:'التذكير بالبريد لم يُفعّل بعد؛ يجب ربط خدمة البريد أولاً' });
  db.prepare(`INSERT INTO reminder_preferences (user_id,enabled,days) VALUES (?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,days=excluded.days`)
    .run(req.user.id, enabled?1:0, days);
  res.json({ enabled,days,emailReady:reminderReady() });
});
let reminderRunning = false;
async function deliverStudyReminders() {
  if (!reminderReady() || reminderRunning) return;
  reminderRunning = true;
  try {
    const now=Date.now();
    const packages=JSON.parse(setting('content_packages') || '[]');
    const users=db.prepare(`SELECT r.user_id,r.days,r.last_sent,u.email,u.name
      FROM reminder_preferences r JOIN users u ON u.id=r.user_id
      WHERE r.enabled=1 AND u.active=1 AND r.last_sent<? LIMIT 100`).all(now-7*86400000);
    for (const user of users) {
      const courses=db.prepare(`SELECT e.package_id,e.created,p.data,p.updated
        FROM enrollments e LEFT JOIN progress p ON p.user_id=e.user_id AND p.package_id=e.package_id
        WHERE e.user_id=? AND (e.expires IS NULL OR e.expires>?)`).all(user.user_id,now);
      const pending=courses.find(c=>{
        if (now-(c.updated || c.created) < user.days*86400000) return false;
        const variant=packages.find(p=>p.id===c.package_id);
        const source=variant?.sourcePackageId && packages.some(p=>p.id===variant.sourcePackageId)
          ? variant.sourcePackageId : c.package_id;
        const videos=db.prepare("SELECT idx FROM lessons WHERE package_id=? AND TRIM(COALESCE(vimeo,''))<>''").all(source);
        if(!videos.length) return false;
        let progress={};try{progress=JSON.parse(c.data||'{}')}catch{}
        return videos.some(l=>!progress.lessons?.[l.idx]);
      });
      if(!pending)continue;
      const claimed=db.prepare('UPDATE reminder_preferences SET last_sent=? WHERE user_id=? AND enabled=1 AND last_sent=?')
        .run(now,user.user_id,user.last_sent).changes;
      if(!claimed)continue;
      try {
        const response=await fetch('https://api.resend.com/emails',{
          method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},
          body:JSON.stringify({from:process.env.REMINDER_FROM,to:[user.email],
            subject:'تذكير بخطة دراستك — منصة السعيد',
            text:`مرحباً ${user.name}، لديك فيديوهات لم تُكملها بعد. عد إلى خطتك وتابع من آخر درس: ${SITE}/#learn/${encodeURIComponent(pending.package_id)}\nيمكنك إيقاف هذه الرسائل من لوحة المتدرب.`}),
          signal:AbortSignal.timeout(12000)
        });
        if(!response.ok)throw Error('Email service returned '+response.status);
      }catch(error){
        db.prepare('UPDATE reminder_preferences SET last_sent=? WHERE user_id=? AND last_sent=?')
          .run(user.last_sent,user.user_id,now);
        console.warn('Study reminder delivery failed:',error.message);
      }
    }
  }finally{reminderRunning=false}
}
setTimeout(()=>deliverStudyReminders().catch(console.error),30000);
setInterval(()=>deliverStudyReminders().catch(console.error),60*60*1000);
app.get('/api/admin/essay-answers', auth, admin, (req, res) => {
  const rows = db.prepare('SELECT p.user_id,p.package_id,p.data,u.name FROM progress p JOIN users u ON u.id=p.user_id').all();
  res.json(rows.flatMap(row => Object.entries(JSON.parse(row.data).essayAnswers || {}).map(([key,answer]) => ({
    userId:row.user_id, packageId:row.package_id, name:row.name, key, ...answer
  }))));
});
app.put('/api/admin/essay-answers/:user/:pkg', auth, admin, (req, res) => {
  const { key, score, feedback } = req.body || {};
  if (typeof key !== 'string' || !Number.isInteger(score) || score < 0 || score > 100)
    return res.status(400).json({ error:'درجة التقييم غير صحيحة' });
  const row = db.prepare('SELECT data FROM progress WHERE user_id=? AND package_id=?').get(req.params.user, req.params.pkg);
  if (!row) return res.status(404).json({ error:'الإجابة غير موجودة' });
  const data = JSON.parse(row.data), answer = data.essayAnswers?.[key];
  if (!answer) return res.status(404).json({ error:'الإجابة غير موجودة' });
  Object.assign(answer,{ status:'graded', score, feedback:String(feedback || '').slice(0,2000), gradedAt:Date.now() });
  const examKey = key.slice(0, key.lastIndexOf(':'));
  if (data.exams?.[examKey]) {
    const pending = Object.entries(data.essayAnswers).filter(([k,a]) => k.startsWith(examKey + ':') && a.status !== 'graded');
    data.exams[examKey].pendingReview = pending.length;
    if (!pending.length) {
      const grades = Object.entries(data.essayAnswers).filter(([k]) => k.startsWith(examKey + ':')).map(([,a]) => a.score);
      const exam = data.exams[examKey];
      data.exams[examKey].score = Math.round(((exam.autoCorrect || 0)*100 + grades.reduce((a,b)=>a+b,0)) /
        ((exam.autoCount || 0) + grades.length));
      data.exams[examKey].passed = data.exams[examKey].score >= 65;
    }
  }
  db.prepare('UPDATE progress SET data=?,updated=? WHERE user_id=? AND package_id=?')
    .run(JSON.stringify(data),Date.now(),req.params.user,req.params.pkg);
  res.json({ ok:true });
});

/* ═══════════ الدروس والفيديو — لا تُسلَّم إلا لمشترك ═══════════ */
app.get('/api/lessons/:pkg', (req, res) => {
  const publishedPackages = JSON.parse(setting('content_packages') || '[]');
  const variant = publishedPackages.find(p => p.id === req.params.pkg);
  const source = variant?.sourcePackageId && publishedPackages.some(p => p.id === variant.sourcePackageId)
    ? variant.sourcePackageId : req.params.pkg;
  const rows = db.prepare('SELECT idx,title,title_en,chapter,duration,vimeo,free,notes,notes_en,files,quiz FROM lessons WHERE package_id=? ORDER BY idx')
    .all(source);
  let enrolled = false;
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) {
    try {
      const p = jwt.verify(h.slice(7), JWT_SECRET);
      const subscription = db.prepare('SELECT expires FROM enrollments WHERE user_id=? AND package_id=?')
        .get(p.id, req.params.pkg);
      enrolled = !!subscription && (!subscription.expires || subscription.expires > Date.now());
    } catch (e) {}
  }
  /* رقم الفيديو يُحجب عن غير المشترك — وهذا ما يمنع نسخ الروابط */
  res.json(rows.map(r => ({ ...r, files: (enrolled || r.free) ? JSON.parse(r.files || '[]') : [],
    quiz: (enrolled || r.free) ? JSON.parse(r.quiz || '[]') : [],
    vimeo: (enrolled || r.free) ? r.vimeo : null })));
});
app.get('/api/lesson-files/:id', auth, (req, res) => {
  const file = db.prepare('SELECT * FROM lesson_files WHERE id=?').get(req.params.id);
  if (!file) return res.status(404).json({ error: 'الملف غير موجود' });
  const published = JSON.parse(setting('content_packages') || '[]');
  const allowed = db.prepare('SELECT package_id,free FROM lessons WHERE package_id=? AND files LIKE ?')
    .all(file.package_id, '%' + file.id + '%').some(lesson => {
      if (req.user.role === 'admin' || lesson.free) return true;
      const ids = [lesson.package_id, ...published.filter(p => p.sourcePackageId === lesson.package_id).map(p => p.id)];
      return ids.some(id => {
        const sub = db.prepare('SELECT expires FROM enrollments WHERE user_id=? AND package_id=?').get(req.user.id, id);
        return sub && (!sub.expires || sub.expires > Date.now());
      });
    });
  if (!allowed) return res.status(403).json({ error: 'لا يوجد اشتراك فعّال لهذا الملف' });
  res.set({ 'Content-Type': file.mime, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
  res.send(file.bytes);
});
app.get('/api/quiz-images/:id', auth, (req, res) => {
  const image = db.prepare('SELECT * FROM quiz_images WHERE id=?').get(req.params.id);
  if (!image) return res.status(404).end();
  const lessons = db.prepare('SELECT free,quiz FROM lessons WHERE package_id=?').all(image.package_id);
  const referenced = lessons.filter(l => (JSON.parse(l.quiz || '[]')).some(q => q.imageId === image.id));
  if (!referenced.length && req.user.role !== 'admin') return res.status(404).end();
  const published = JSON.parse(setting('content_packages') || '[]');
  const packages = [image.package_id, ...published.filter(p => p.sourcePackageId === image.package_id).map(p => p.id)];
  const enrolled = packages.some(id => {
    const row = db.prepare('SELECT expires FROM enrollments WHERE user_id=? AND package_id=?').get(req.user.id, id);
    return row && (!row.expires || row.expires > Date.now());
  });
  if (req.user.role !== 'admin' && !enrolled && !referenced.some(l => l.free)) return res.status(403).end();
  res.set({ 'Content-Type': image.mime, 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff' });
  res.send(image.bytes);
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

// One idempotent transaction is used by both webhooks and browser returns.
// This prevents duplicate callbacks from granting access more than once or
// leaving the order paid while enrollment creation fails.
function finalizePaidOrder(order, source = 'شراء') {
  if (!order) return false;
  const catalog = JSON.parse(setting('catalog') || '[]');
  const pkg = catalog.find(p => p.id === order.package_id) || {};
  let changed = false;
  db.transaction(() => {
    const update = db.prepare("UPDATE orders SET status='paid', paid_at=? WHERE id=? AND status!='paid'")
      .run(Date.now(), order.id);
    if (!update.changes) return;
    grant(order.user_id, order.package_id, pkg.days || 90, source);
    changed = true;
  })();
  return changed;
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
    const promo = promos.find(x => String(x.code).toUpperCase() === code && x.active !== false);
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
         'pending', setting('gateway') || process.env.PAYMENT_GATEWAY || 'kashier', Date.now());

  const gw = GATEWAYS[setting('gateway') || process.env.PAYMENT_GATEWAY || 'kashier'];
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
    const gwId = b.id || (b.data && b.data.id);
    const orderId = (b.metadata && b.metadata.order_id) ||
                    (b.reference && b.reference.order) ||
                    (b.data && b.data.metadata && b.data.metadata.order_id);
    if (!orderId) return res.status(400).json({ error: 'no order' });
    const order = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
    if (!order) return res.status(404).json({ error: 'order not found' });
    if (order.status === 'paid') return res.json({ ok: true, already: true });

    /* Verify with the gateway stored on the order. The active gateway may have
       changed while the customer still had an older checkout page open. */
    const gwName = String(order.gateway || '').toLowerCase();
    const gateway = GATEWAYS[gwName];
    if (!gateway) return res.status(400).json({ error: 'unsupported gateway' });
    const { paid } = await gateway.verify(gwId || order.gateway_id, order.id);
    if (!paid) return res.json({ ok: true, paid: false });
    const changed = finalizePaidOrder(order, `شراء عبر ${gwName}`);
    res.json({ ok: true, paid: true, already: !changed });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* عودة المستخدم من البوابة */
app.get('/api/pay/return', async (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.query.order);
  if (order && order.status !== 'paid' && order.gateway_id) {
    try {
      const { paid } = await GATEWAYS[order.gateway].verify(order.gateway_id, order.id);
      if (paid) {
        finalizePaidOrder(order, `شراء عبر ${order.gateway}`);
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
  const total = db.prepare('SELECT COUNT(*) c FROM lessons WHERE package_id=? AND TRIM(COALESCE(vimeo,\'\'))<>\'\'').get(req.params.pkg).c;
  const watched = db.prepare('SELECT idx FROM lessons WHERE package_id=? AND TRIM(COALESCE(vimeo,\'\'))<>\'\'').all(req.params.pkg);
  if (!total || !watched.every(l => p.lessons?.[l.idx]))
    return res.status(400).json({ error: 'يلزم إكمال مشاهدة جميع الفيديوهات أولاً' });

  const ex = db.prepare('SELECT no,name FROM certificates WHERE user_id=? AND package_id=?')
    .get(req.user.id, req.params.pkg);
  if (ex) return res.json({ no: ex.no, name: ex.name, verify: `${SITE}/verify/${ex.no}` });

  const englishName = String(req.body?.englishName || '').trim().replace(/\s+/g, ' ');
  if (!/^[A-Za-z][A-Za-z .'-]{2,99}$/.test(englishName))
    return res.status(400).json({ error: 'اكتب اسمك بالإنجليزية كما تريد ظهوره في الشهادة' });

  const no = 'AS-' + new Date().getFullYear() + '-' + uid().toUpperCase().slice(0, 6);
  db.prepare('INSERT INTO certificates (no,user_id,package_id,name,course,hours,issued) VALUES (?,?,?,?,?,?,?)')
    .run(no, req.user.id, req.params.pkg, englishName, pkg.en || pkg.ar || '', pkg.hours || 0, Date.now());
  res.json({ no, name:englishName, verify: `${SITE}/verify/${no}` });
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
  const videoRows = db.prepare("SELECT idx FROM lessons WHERE package_id=? AND TRIM(COALESCE(vimeo,''))<>''").all(packageId);
  const lessonTotal = videoRows.length;
  const lessonDone = videoRows.filter(l => data.lessons?.[l.idx]).length;
  const exams = Object.values(data.exams || {}).filter(Boolean);
  const scores = exams.map(x => Number(x.score)).filter(Number.isFinite);
  const avgExam = scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : 0;
  const weeksDone = Object.values(data.weeks || {}).filter(Boolean).length;
  let progress = lessonTotal ? Math.round(Math.min(1, lessonDone/lessonTotal)*100) : Math.min(100, weeksDone*10 + exams.filter(x=>x.passed).length*10);
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
app.get('/api/admin/lessons/:pkg', auth, admin, (req, res) => {
  const rows = db.prepare(`SELECT idx,title,title_en,chapter,duration,vimeo,free,notes,notes_en,files,quiz
    FROM lessons WHERE package_id=? ORDER BY idx`).all(req.params.pkg);
  res.json(rows.map(row => ({ ...row, files: JSON.parse(row.files || '[]'), quiz: JSON.parse(row.quiz || '[]'), free: !!row.free })));
});
app.post('/api/admin/quiz-images/:pkg', auth, admin, (req, res) => {
  const { name, data } = req.body || {};
  const ext = String(name || '').toLowerCase().match(/\.(png|jpe?g|webp)$/)?.[1];
  if (!ext || !/^[A-Za-z0-9+/]+={0,2}$/.test(String(data || '')))
    return res.status(400).json({ error:'اختر صورة PNG أو JPG أو WebP' });
  const bytes = Buffer.from(data, 'base64');
  if (!bytes.length || bytes.length > 4 * 1024 * 1024)
    return res.status(400).json({ error:'حجم الصورة يجب ألا يتجاوز 4 ميجابايت' });
  const valid = ext === 'png' ? bytes.subarray(0,8).toString('hex') === '89504e470d0a1a0a'
    : ['jpg','jpeg'].includes(ext) ? bytes.subarray(0,3).toString('hex') === 'ffd8ff'
    : bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP';
  if (!valid) return res.status(400).json({ error:'محتوى الصورة غير صحيح' });
  const id = uid(), mime = ext === 'png' ? 'image/png' : ['jpg','jpeg'].includes(ext) ? 'image/jpeg' : 'image/webp';
  db.prepare('INSERT INTO quiz_images (id,package_id,mime,bytes,created) VALUES (?,?,?,?,?)')
    .run(id,req.params.pkg,mime,bytes,Date.now());
  res.json({ id });
});
app.post('/api/admin/lesson-files/:pkg', auth, admin, (req, res) => {
  const { name, data } = req.body || {};
  const ext = String(name || '').toLowerCase().match(/\.(pdf|doc|docx|xls|xlsx)$/)?.[1];
  if (!ext || !/^[A-Za-z0-9+/]+={0,2}$/.test(String(data || '')))
    return res.status(400).json({ error: 'يُسمح فقط بملفات PDF وWord وExcel' });
  const bytes = Buffer.from(data, 'base64');
  if (!bytes.length || bytes.length > 10 * 1024 * 1024)
    return res.status(400).json({ error: 'الحد الأقصى للملف 10 ميجابايت' });
  if (ext === 'pdf' && bytes.subarray(0, 5).toString() !== '%PDF-')
    return res.status(400).json({ error: 'محتوى PDF غير صحيح' });
  if (['docx', 'xlsx'].includes(ext) && bytes.subarray(0, 2).toString() !== 'PK')
    return res.status(400).json({ error: 'محتوى الملف غير صحيح' });
  if (['doc', 'xls'].includes(ext) && bytes.subarray(0, 8).toString('hex') !== 'd0cf11e0a1b11ae1')
    return res.status(400).json({ error: 'محتوى الملف غير صحيح' });
  const mime = { pdf:'application/pdf', doc:'application/msword', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls:'application/vnd.ms-excel', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }[ext];
  const id = uid();
  db.prepare('INSERT INTO lesson_files (id,package_id,name,mime,bytes,created) VALUES (?,?,?,?,?,?)')
    .run(id, req.params.pkg, path.basename(name).slice(0, 180), mime, bytes, Date.now());
  res.json({ id, name: path.basename(name).slice(0, 180) });
});
app.get('/api/admin/vimeo/:id', auth, admin, async (req, res) => {
  const id = String(req.params.id || '').replace(/\D/g, '');
  if (!/^\d{6,12}$/.test(id)) return res.status(400).json({ error: 'رقم Vimeo غير صحيح' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const url = 'https://vimeo.com/api/oembed.json?url=' + encodeURIComponent('https://vimeo.com/' + id);
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) return res.status(404).json({ error: 'تعذر قراءة بيانات الفيديو. تأكد أن الفيديو يسمح بالتضمين.' });
    const data = await response.json();
    const seconds = Math.max(0, Number(data.duration || 0));
    const duration = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    res.json({ id, seconds, duration, title: data.title || '', thumbnail: data.thumbnail_url || '' });
  } catch (error) {
    res.status(error?.name === 'AbortError' ? 504 : 502).json({ error: 'تعذر الاتصال بـ Vimeo الآن' });
  } finally { clearTimeout(timer); }
});
async function vimeoDuration(id) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://vimeo.com/api/oembed.json?url=' + encodeURIComponent('https://vimeo.com/' + id), { signal: controller.signal });
    if (!response.ok) return '';
    const seconds = Number((await response.json()).duration);
    return Number.isFinite(seconds) && seconds > 0
      ? Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') : '';
  } catch { return ''; } finally { clearTimeout(timer); }
}
const missingDurationSql = "TRIM(COALESCE(duration,'')) IN ('','0:00','00:00','0')";
const saveObservedDuration = db.prepare(`UPDATE lessons SET duration=? WHERE package_id=? AND idx=? AND vimeo=? AND ${missingDurationSql}`);

// Vimeo may withhold oEmbed metadata for restricted videos. The player can report
// their duration after an authorized viewer opens them.
app.patch('/api/lessons/:pkg/:idx/duration', auth, (req, res) => {
  const pkg = req.params.pkg, idx = Number(req.params.idx);
  const seconds = Number(req.body?.seconds), id = String(req.body?.vimeo || '');
  if (!Number.isSafeInteger(idx) || idx < 0 || !Number.isFinite(seconds) || seconds < 1 || seconds > 86400 || !/^\d{6,12}$/.test(id))
    return res.status(400).json({ error:'مدة الفيديو غير صحيحة' });
  const catalog = JSON.parse(setting('content_packages') || '[]');
  const variant = catalog.find(p => p.id === pkg);
  const source = variant?.sourcePackageId && catalog.some(p => p.id === variant.sourcePackageId)
    ? variant.sourcePackageId : pkg;
  const lesson = db.prepare('SELECT vimeo,duration,free FROM lessons WHERE package_id=? AND idx=?').get(source, idx);
  if (!lesson || lesson.vimeo !== id) return res.status(404).json({ error:'الفيديو غير موجود' });
  const enrollment = db.prepare('SELECT expires FROM enrollments WHERE user_id=? AND package_id=?').get(req.user.id, pkg);
  if (req.user.role !== 'admin' && !lesson.free && (!enrollment || enrollment.expires && enrollment.expires <= Date.now()))
    return res.status(403).json({ error:'لا يمكنك تعديل هذا الفيديو' });
  const duration = Math.floor(seconds / 60) + ':' + String(Math.floor(seconds) % 60).padStart(2, '0');
  saveObservedDuration.run(duration, source, idx, id);
  res.json({ duration:db.prepare('SELECT duration FROM lessons WHERE package_id=? AND idx=?').get(source,idx).duration });
});

async function fillMissingDurations() {
  const missing = db.prepare(`SELECT package_id,idx,vimeo FROM lessons WHERE ${missingDurationSql} AND vimeo GLOB '[0-9]*'`).all();
  for (const lesson of missing) {
    if (!/^\d{6,12}$/.test(lesson.vimeo)) continue;
    const duration = await vimeoDuration(lesson.vimeo);
    if (duration) saveObservedDuration.run(duration, lesson.package_id, lesson.idx, lesson.vimeo);
  }
}
setTimeout(() => fillMissingDurations().catch(error => console.error('Vimeo duration refresh:', error)), 5000);
setInterval(() => fillMissingDurations().catch(error => console.error('Vimeo duration refresh:', error)), 6 * 60 * 60 * 1000);
app.post('/api/admin/lessons/:pkg/fill-durations', auth, admin, async (req, res) => {
  const missing = db.prepare(`SELECT idx,vimeo FROM lessons WHERE package_id=? AND TRIM(COALESCE(vimeo,''))<>'' AND ${missingDurationSql}`)
    .all(req.params.pkg);
  let updated = 0;
  for (const row of missing) {
    const id = String(row.vimeo).match(/^\d{6,12}$/)?.[0];
    if (!id) continue;
    const duration = await vimeoDuration(id);
    if (duration) {
      saveObservedDuration.run(duration, req.params.pkg, row.idx, row.vimeo);
      updated++;
    }
  }
  res.json({ updated, unavailable:missing.length-updated });
});
app.put('/api/admin/lessons/:pkg', auth, admin, async (req, res) => {
  const list = req.body || [];
  if (!Array.isArray(list)) return res.status(400).json({ error: 'قائمة الدروس غير صحيحة' });
  // Only look up newly linked videos; keep existing durations when Vimeo is unavailable.
  const existing = db.prepare('SELECT idx,title,vimeo,duration,quiz FROM lessons WHERE package_id=?').all(req.params.pkg);
  for (let i = 0; i < list.length; i++) {
    const lesson = list[i];
    const old = existing.find(row => row.idx === i && row.title === (lesson.t || lesson.title)) ||
      existing.find(row => row.title === (lesson.t || lesson.title));
    if (!Array.isArray(lesson.quiz) && old?.quiz) lesson.quiz = JSON.parse(old.quiz);
    if (!lesson.vimeo && old?.vimeo && !lesson.clearVimeo) lesson.vimeo = old.vimeo;
    const id = String(lesson.vimeo || '').match(/^(?:https?:\/\/(?:www\.)?vimeo\.com\/(?:video\/)?|)(\d{6,12})(?:\?.*)?$/)?.[1];
    if (!id) continue;
    lesson.vimeo = id;
    const previous = existing.find(row => row.idx === i && row.vimeo === id);
    if ((!lesson.dur || lesson.dur === '00:00') && previous?.duration) lesson.dur = previous.duration;
    if (!lesson.dur || lesson.dur === '00:00') lesson.dur = await vimeoDuration(id) || '';
  }
  const del = db.prepare('DELETE FROM lessons WHERE package_id=?');
  const ins = db.prepare(`INSERT INTO lessons (package_id,idx,title,title_en,chapter,duration,vimeo,free,notes,notes_en,files,quiz)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  db.transaction(() => {
    del.run(req.params.pkg);
    list.forEach((l, i) => ins.run(req.params.pkg, i,
      l.t || l.title || '', l.t_en || l.title_en || '',
      l.ch || 0, l.dur || l.duration || '', l.vimeo || '', l.free ? 1 : 0,
      l.notes || '', l.notes_en || '', JSON.stringify((l.files || []).filter(f =>
        f && db.prepare('SELECT 1 FROM lesson_files WHERE id=? AND package_id=?').get(f.id, req.params.pkg))),
      JSON.stringify(Array.isArray(l.quiz) ? l.quiz.filter(q => {
        if (!q || typeof q.q !== 'string' || !q.q.trim() || q.q.length > 2000) return false;
        const type = q.type || 'single';
        if (type === 'essay') return true;
        if (type === 'truefalse') return q.correct === 0 || q.correct === 1;
        if (type === 'hotspot') return typeof q.imageId === 'string' &&
          !!db.prepare('SELECT 1 FROM quiz_images WHERE id=? AND package_id=?').get(q.imageId, req.params.pkg) &&
          [q.x,q.y].every(n => typeof n === 'number' && n >= 0 && n <= 100) &&
          typeof q.radius === 'number' && q.radius >= 2 && q.radius <= 30;
        if (type === 'matching') return Array.isArray(q.pairs) && q.pairs.length >= 2 && q.pairs.length <= 8 &&
          q.pairs.every(p => Array.isArray(p) && p.length === 2 && p.every(s => typeof s === 'string' && !!s.trim()));
        return type === 'single' && Array.isArray(q.options) && q.options.length === 4 &&
          q.options.every(o => typeof o === 'string' && !!o.trim()) && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 4;
      }).slice(0, 20) : [])));
  })();
  res.json({ ok: true, count: list.length });
});
app.get('/api/admin/settings', auth, admin, (req, res) => {
  res.json({
    gateway: setting('gateway') || process.env.PAYMENT_GATEWAY || 'kashier',
    gateways: {
      kashier: !!(process.env.KASHIER_MERCHANT_ID && process.env.KASHIER_PAYMENT_API_KEY),
      paymob: !!(process.env.PAYMOB_SECRET_KEY && process.env.PAYMOB_PUBLIC_KEY && process.env.PAYMOB_INTEGRATION_IDS),
      moyasar: !!process.env.MOYASAR_SECRET_KEY,
      tap: !!process.env.TAP_SECRET_KEY
    },
    hasPaymob: !!process.env.PAYMOB_SECRET_KEY,
    hasMoyasar: !!process.env.MOYASAR_SECRET_KEY,
    hasTap: !!process.env.TAP_SECRET_KEY,
    publishableKey: setting('publishable_key') || '',
    catalogCount: JSON.parse(setting('catalog') || '[]').length
  });
});
app.put('/api/admin/settings', auth, admin, (req, res) => {
  const { gateway, publishableKey, catalog } = req.body || {};
  if (gateway) {
    const value = String(gateway).trim().toLowerCase();
    if (!['kashier','paymob','moyasar','tap'].includes(value))
      return res.status(400).json({ error: 'بوابة الدفع غير مدعومة' });
    setSetting('gateway', value);
  }
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
  ['cms', 'courses', 'packages', 'academic', 'consulting', 'tracks', 'modes', 'systems', 'promos', 'learning'].forEach(k => {
    const v = setting('content_' + k);
    if (v) { try { out[k] = JSON.parse(v); } catch (e) {} }
  });
  res.json(out);
});
app.put('/api/admin/package-plan/:pkg', auth, admin, (req, res) => {
  const cards = req.body?.planCards;
  if (!cards || typeof cards !== 'object' || Array.isArray(cards) || Object.keys(cards).length > 110 ||
      Object.entries(cards).some(([key, card]) => !/^(?:\d{1,3}|domains|final)$/.test(key) ||
        !card || typeof card !== 'object' || ['title_ar','title_en'].some(k =>
          card[k] !== undefined && (typeof card[k] !== 'string' || card[k].length > 200)) ||
        ['items_ar','items_en','tags_ar','tags_en'].some(k => card[k] !== undefined &&
          (!Array.isArray(card[k]) || card[k].length > 30 || card[k].some(v => typeof v !== 'string' || v.length > 350)))))
    return res.status(400).json({ error:'بيانات بطاقات الخطة غير صحيحة' });
  const packages = JSON.parse(setting('content_packages') || '[]');
  const pkg = packages.find(p => p.id === req.params.pkg);
  if (!pkg) return res.status(404).json({ error:'الباقة غير موجودة' });
  pkg.planCards = cards;
  setSetting('content_packages', JSON.stringify(packages));
  res.json({ ok:true, planCards:cards });
});
app.put('/api/admin/learning/:course', auth, admin, (req, res) => {
  const cards = req.body?.cards;
  if (!Array.isArray(cards) || cards.length > 200 || cards.some(c => !c ||
      typeof c.en !== 'string' || !c.en.trim() || c.en.length > 250 ||
      typeof c.ar !== 'string' || c.ar.length > 250))
    return res.status(400).json({ error:'البطاقات التعليمية غير صحيحة' });
  const courses = JSON.parse(setting('content_courses') || '[]');
  if (!courses.some(c => c.id === req.params.course))
    return res.status(404).json({ error:'الدورة غير موجودة' });
  const data = JSON.parse(setting('content_learning') || '{}');
  data[req.params.course] = { ...(data[req.params.course] || {}), cards };
  setSetting('content_learning', JSON.stringify(data));
  res.json({ ok:true, cards });
});
/* أرقام الكتالوج من المحتوى المنشور فعلاً، دون كشف الروابط أو الأسئلة. */
app.get('/api/catalog-availability', (req, res) => {
  const packages = JSON.parse(setting('content_packages') || '[]');
  const videos = db.prepare("SELECT package_id, duration FROM lessons WHERE TRIM(COALESCE(vimeo,'')) <> ''")
    .all().reduce((map, row) => {
      const entry = map[row.package_id] ||= { count: 0, minutes: 0 };
      entry.count++;
      const parts = String(row.duration || '').split(':').map(Number);
      if (parts.length === 2 && parts.every(Number.isFinite)) entry.minutes += parts[0] + parts[1] / 60;
      return map;
    }, {});
  const hasQuestions = !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='questions'").get();
  const questions = hasQuestions ? Object.fromEntries(db.prepare('SELECT package_id, COUNT(*) AS n FROM questions WHERE active=1 GROUP BY package_id')
    .all().map(row => [row.package_id, row.n])) : {};
  const result = {};
  for (const p of packages) {
    const source = packages.find(x => x.id === p.sourcePackageId && x.course === p.course)?.id || p.id;
    const candidates = [p.course, ...packages.filter(x => x.course === p.course).map(x => x.id)];
    const bank = questions[p.id] ? p.id : candidates.reduce((best, id) =>
      (questions[id] || 0) > (questions[best] || 0) ? id : best, p.id);
    result[p.id] = { videos: videos[source]?.count || 0, videoMins: Math.round(videos[source]?.minutes || 0), questions: questions[bank] || 0 };
  }
  res.json(result);
});
app.put('/api/admin/course-chapters/:course', auth, admin, (req, res) => {
  const chapters = req.body?.chapters;
  if (!Array.isArray(chapters) || chapters.length > 100 || chapters.some(ch =>
    !(typeof ch === 'string' && ch.trim() && ch.length <= 200 ||
      ch && typeof ch === 'object' && typeof ch.ar === 'string' && ch.ar.trim() && ch.ar.length <= 200 &&
      typeof ch.en === 'string' && ch.en.length <= 200)))
    return res.status(400).json({ error: 'أسماء الفصول غير صحيحة' });
  const courses = JSON.parse(setting('content_courses') || '[]');
  const course = courses.find(c => c.id === req.params.course);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  course.chapters = chapters;
  db.prepare("INSERT INTO settings (k,v) VALUES ('content_courses',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v")
    .run(JSON.stringify(courses));
  res.json({ ok: true, chapters });
});
app.put('/api/admin/content', auth, admin, (req, res) => {
  const body = req.body || {};
  if (Array.isArray(body.packages)) {
    for (const p of body.packages.filter(x => x.active !== false && x.sourcePackageId)) {
      const source = body.packages.find(x => x.id === p.sourcePackageId && x.course === p.course);
      if (!source) return res.status(422).json({ error: 'مصدر محتوى النسخة اللغوية غير موجود: ' + p.id });
      const lessons = db.prepare('SELECT title,title_en FROM lessons WHERE package_id=?').all(source.id);
      if ((p.kinds||[]).includes('video') && (!lessons.length || (p.lang === 'en' && lessons.some(l => !String(l.title_en||'').trim()))))
        return res.status(422).json({ error: 'راجع عناوين الفيديوهات بلغة النسخة قبل نشر: ' + p.id });
      if ((p.kinds||[]).includes('exam')) {
        const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='questions'").get();
        if (!table) return res.status(422).json({ error: 'بنك الأسئلة غير مجهز للنسخة: ' + p.id });
        const rows = db.prepare('SELECT question_ar,question_en,options_ar,options_en FROM questions WHERE package_id=? AND active=1').all(source.id);
        const valid = row => {
          const field = p.lang === 'ar' ? 'ar' : 'en';
          let opts=[]; try { opts=JSON.parse(row['options_'+field]||'[]'); } catch {}
          return !!String(row['question_'+field]||'').trim() && Array.isArray(opts) && opts.filter(Boolean).length >= 2;
        };
        if (!rows.length || rows.some(row => !valid(row)))
          return res.status(422).json({ error: 'استكمل نصوص الأسئلة والخيارات باللغة المختارة قبل نشر: ' + p.id });
      }
    }
  }
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
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email)) || String(body || '').length > 4000)
    return res.status(400).json({ error: 'أدخل الاسم والبريد الصحيح ورسالة لا تتجاوز 4000 حرف' });
  db.prepare('INSERT INTO messages (id,name,email,subject,body,created) VALUES (?,?,?,?,?,?)')
    .run(uid(), String(name).slice(0,120), String(email).slice(0,254), String(subject || '').slice(0,160), body || '', Date.now());
  res.json({ ok: true });
});
mountCorporateWorkflow({ app, db, auth, admin, rateLimit, site: SITE });
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
    `المفتاح السرّي: ${process.env.PAYMOB_SECRET_KEY || process.env.MOYASAR_SECRET_KEY || process.env.TAP_SECRET_KEY ? 'مضبوط ✅' : 'غير مضبوط ⚠️'}\n`);
});
