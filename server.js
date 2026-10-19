import {lessonAction,lessonStructure,lessonCourseBase} from './lesson-actions.js';
import { enrollmentTiming, summarizeRecordedProgress, summarizeStudent } from './trainee-tracking.js';
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
import { chapterSlotFloor, validChapterAllocation, repairPmpIntroCollision, repairPmpQualityOrder } from './curriculum-slots.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mountCorporateWorkflow } from './corporate-workflow.js';
import { mountClassroom } from './classroom.js'; // الفصل الخاص (باقة مخفية)
import { mountEnrollmentExtensions } from './enrollment-extensions.js';
import QRCode from 'qrcode';
import { initializeInstructorRegistry, mountInstructorRegistry, mountCertificateRoutes, publicInstructors, publicDefaultInstructorId, validatePackageInstructors } from './instructor-certificates.js';

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
if (!db.pragma('table_info(messages)').some(col => col.name === 'status'))
  db.exec("ALTER TABLE messages ADD COLUMN status TEXT NOT NULL DEFAULT 'new'");
if (!db.pragma('table_info(lessons)').some(col => col.name === 'files'))
  db.exec("ALTER TABLE lessons ADD COLUMN files TEXT DEFAULT '[]'");
if (!db.pragma('table_info(lessons)').some(col => col.name === 'quiz'))
  db.exec("ALTER TABLE lessons ADD COLUMN quiz TEXT DEFAULT '[]'");

// Nullable presentation metadata; existing storage slots and progress stay unchanged.
if (!db.pragma('table_info(lessons)').some(col => col.name === 'deleted_at'))
  try{db.exec('ALTER TABLE lessons ADD COLUMN deleted_at INTEGER');}catch(e){if(!db.pragma('table_info(lessons)').some(col=>col.name==='deleted_at'))throw e;}
if (!db.pragma('table_info(lessons)').some(col => col.name === 'display_order'))
  db.exec("ALTER TABLE lessons ADD COLUMN display_order INTEGER");

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
mountEnrollmentExtensions({ app, db, auth });
const setting = k => { const r = db.prepare('SELECT v FROM settings WHERE k=?').get(k); return r ? r.v : ''; };
const setSetting = (k, v) => db.prepare('INSERT INTO settings (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=?').run(k, v, v);

/* ترحيل V15: يستبدل قائمة العرض القديمة فقط، ثم تبقى تعديلات المشرف محفوظة. */
const DEFAULT_PROMOS_V15 = [
  { code:'ALSAEED10', schemaVersion:15, pct:10, until:'2026-12-31', desc:'خصم عام' },
  { code:'STUDENT20', schemaVersion:15, pct:20, until:'2026-12-31', desc:'خصم الطلاب' },
  { code:'GROUP25', schemaVersion:15, pct:25, until:'2026-12-31', desc:'خصم المجموعات (3+)' },
  { code:'WELCOME15', schemaVersion:15, pct:15, until:'2027-12-31', desc:'خصم الترحيب بالمنصة المطوّرة' }
];
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
// Seed empty installations only. Authored catalog IDs/chapters must survive
// restarts, including newer/custom courses absent from an old default allowlist.
if (!savedCourses.length && v15Catalog.courses.length)
  setSetting('content_courses', JSON.stringify(v15Catalog.courses));

const savedPackages = readList('content_packages');
if (!savedPackages.length && v15Catalog.packages.length) {
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

// One-time, fingerprint-guarded metadata correction; transaction includes its completion marker.
repairPmpIntroCollision({ db, setting, setSetting });
repairPmpQualityOrder({ db, setting, setSetting });

initializeInstructorRegistry({ db, setting, setSetting });
mountInstructorRegistry({ app, db, auth, admin, setting, setSetting, uid });

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
        const videos=db.prepare("SELECT idx,title,chapter FROM lessons WHERE package_id=? AND deleted_at IS NULL AND TRIM(COALESCE(vimeo,''))<>''").all(source);
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
  const rows = db.prepare('SELECT idx,title,title_en,chapter,duration,vimeo,free,notes,notes_en,files,quiz,deleted_at,display_order AS displayOrder FROM lessons WHERE package_id=? ORDER BY idx')
    .all(source);
  let enrolled = false;
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) {
    try {
      const p = jwt.verify(h.slice(7), JWT_SECRET);
      const subscription = db.prepare('SELECT expires FROM enrollments WHERE user_id=? AND package_id=?')
        .get(p.id, req.params.pkg);
      const user = db.prepare('SELECT role,active FROM users WHERE id=?').get(p.id);
      enrolled = !!user && user.active !== 0 && (user?.role === 'admin' || (!!subscription && (!subscription.expires || subscription.expires > Date.now())));
    } catch (e) {}
  }
  /* رقم الفيديو يُحجب عن غير المشترك — وهذا ما يمنع نسخ الروابط */
  res.json(rows.map(r => r.deleted_at ? {idx:r.idx,deleted:true,title:'',chapter:0,vimeo:null,files:[],quiz:[],notes:'',notes_en:''} : ({ ...r, files: (enrolled || r.free) ? JSON.parse(r.files || '[]') : [],
    quiz: (enrolled || r.free) ? JSON.parse(r.quiz || '[]') : [],
    vimeo: (enrolled || r.free) ? r.vimeo : null })));
});
app.get('/api/lesson-files/:id', auth, (req, res) => {
  const file = db.prepare('SELECT * FROM lesson_files WHERE id=?').get(req.params.id);
  if (!file) return res.status(404).json({ error: 'الملف غير موجود' });
  const published = JSON.parse(setting('content_packages') || '[]');
  const allowed = db.prepare('SELECT package_id,free FROM lessons WHERE package_id=? AND deleted_at IS NULL AND files LIKE ?')
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
  const lessons = db.prepare('SELECT free,quiz FROM lessons WHERE deleted_at IS NULL AND package_id=?').all(image.package_id);
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
mountCertificateRoutes({
  app, db, auth, setting, uid, site:SITE,
  createQr:value => QRCode.toDataURL(value, { errorCorrectionLevel:'M', margin:2, width:220 })
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
  const en = db.prepare('SELECT id,user_id,package_id,source,expires,created FROM enrollments').all();
  res.json(users.map(u => ({ ...u, packages: en.filter(e => e.user_id === u.id) })));
});

function progressSummary(userId, packageId, enrollmentCreated) {
  const row = db.prepare('SELECT data,updated FROM progress WHERE user_id=? AND package_id=?').get(userId, packageId);
  const videoRows = db.prepare("SELECT idx,title,chapter FROM lessons WHERE package_id=? AND deleted_at IS NULL AND TRIM(COALESCE(vimeo,''))<>''").all(packageId);
  return summarizeRecordedProgress(row, videoRows);
}

app.get('/api/admin/overview', auth, admin, (req, res) => {
  const now=Date.now();
  const users=db.prepare("SELECT id,name,email,phone,created FROM users WHERE role='student' ORDER BY created DESC").all();
  const enrollments=db.prepare('SELECT id,user_id,package_id,source,expires,created FROM enrollments').all();
  const catalog=JSON.parse(setting('catalog')||'[]');
  const names=new Map(catalog.map(x=>[x.id,x.ar||x.id]));
  const students=users.map(u=>{
    const ens=enrollments.filter(e=>e.user_id===u.id);
    const details=ens.map(e=>({...e,...progressSummary(u.id,e.package_id,e.created),...enrollmentTiming(e,now)}));
    const {progress,avgExam,measuredPackages}=summarizeStudent(details);
    const lastActivity=Math.max(0,...details.map(x=>x.lastActivity||0)) || null;
    const future=ens.map(x=>x.expires).filter(x=>x&&x>now).sort((a,b)=>a-b);
    return { ...u, learningPackages:details, enrollments:ens.length, progress, avgExam, measuredPackages, lastActivity, nearestExpiry:future[0]||null };
  });
  const orders=db.prepare(`SELECT o.*,u.name user_name,u.email user_email FROM orders o LEFT JOIN users u ON u.id=o.user_id ORDER BY o.created DESC LIMIT 20`).all().map(o=>({...o,package_name:names.get(o.package_id)||o.package_id}));
  const activeEnrollments=enrollments.filter(e=>!e.expires||e.expires>now).length;
  res.json({
    stats:{students:users.length,orders:db.prepare('SELECT COUNT(*) c FROM orders').get().c,paid:db.prepare("SELECT COUNT(*) c FROM orders WHERE status='paid'").get().c,revenue:db.prepare("SELECT COALESCE(SUM(amount),0) s FROM orders WHERE status='paid'").get().s,certificates:db.prepare('SELECT COUNT(*) c FROM certificates').get().c,activeEnrollments},
    students,recentOrders:orders,serverNow:now
  });
});

app.get('/api/admin/users/:id/activity', auth, admin, (req,res)=>{
  const now=Date.now();
  const u=db.prepare('SELECT id,name,email,phone,role,created FROM users WHERE id=?').get(req.params.id);
  if(!u)return res.status(404).json({error:'المستخدم غير موجود'});
  const ens=db.prepare('SELECT id,package_id,source,expires,created FROM enrollments WHERE user_id=? ORDER BY created DESC').all(u.id).map(e=>({...e,...progressSummary(u.id,e.package_id,e.created),...enrollmentTiming(e,now)}));
  const certs=db.prepare('SELECT no,package_id,course,hours,issued FROM certificates WHERE user_id=? ORDER BY issued DESC').all(u.id);
  const orders=db.prepare('SELECT id,package_id,amount,currency,status,gateway,created,paid_at FROM orders WHERE user_id=? ORDER BY created DESC LIMIT 50').all(u.id);
  res.json({user:u,enrollments:ens,summary:summarizeStudent(ens),certificates:certs,orders,serverNow:now});
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
  res.json({ user: u, enrollments: en, orders: or, serverNow: Date.now(),
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
  const rows = db.prepare(`SELECT idx,title,title_en,chapter,duration,vimeo,free,notes,notes_en,files,quiz,deleted_at,display_order AS displayOrder
    FROM lessons WHERE package_id=? ORDER BY idx`).all(req.params.pkg);
  const structureBase=lessonStructure(rows),courseBase=lessonCourseBase(setting,req.params.pkg);
  res.json(rows.map(row => ({ ...row, deleted:!!row.deleted_at, structureBase,courseBase, files: JSON.parse(row.files || '[]'), quiz: JSON.parse(row.quiz || '[]'), free: !!row.free })));
});
app.get('/api/admin/lessons/:pkg/structure',auth,admin,(req,res)=>res.json({courseBase:lessonCourseBase(setting,req.params.pkg)}));
app.post('/api/admin/lessons/:pkg/action', auth, admin, (req,res)=>{
  const result=lessonAction({db,setting,setSetting},req.params.pkg,req.body);
  res.status(result.status||200).json(result);
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
// Preserve the access hash required by unlisted Vimeo videos in storage and metadata requests.
function normalizeVimeoReference(value) {
  const raw=String(value||'').trim();let id,hash='';
  const match=raw.match(/^(\d{6,12})(?:\?h=([a-zA-Z0-9]+))?$/);
  if(match){id=match[1];hash=match[2]||'';}
  else {try{
    const url=new URL(raw);
    if(!['https:','http:'].includes(url.protocol)||!['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(url.hostname))return null;
    const parts=url.pathname.split('/').filter(Boolean),i=parts.findIndex(x=>/^\d{6,12}$/.test(x));
    if(i<0)return null;id=parts[i];hash=url.searchParams.get('h')||parts[i+1]||'';
  }catch{return null;}}
  if(hash&&!/^[a-zA-Z0-9]+$/.test(hash))return null;
  return {id,stored:id+(hash?'?h='+hash:''),url:'https://vimeo.com/'+id+(hash?'/'+hash:'')};
}
app.get('/api/admin/vimeo/:id', auth, admin, async (req, res) => {
  const reference = normalizeVimeoReference(req.params.id), id=reference?.stored;
  if (!reference) return res.status(400).json({ error: 'رقم Vimeo غير صحيح' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const url = 'https://vimeo.com/api/oembed.json?url=' + encodeURIComponent(reference.url);
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
  const reference=normalizeVimeoReference(id);if(!reference)return '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://vimeo.com/api/oembed.json?url=' + encodeURIComponent(reference.url), { signal: controller.signal });
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
  const seconds = Number(req.body?.seconds), id = normalizeVimeoReference(req.body?.vimeo)?.stored;
  if (!Number.isSafeInteger(idx) || idx < 0 || !Number.isFinite(seconds) || seconds < 1 || seconds > 86400 || !id)
    return res.status(400).json({ error:'مدة الفيديو غير صحيحة' });
  const catalog = JSON.parse(setting('content_packages') || '[]');
  const variant = catalog.find(p => p.id === pkg);
  const source = variant?.sourcePackageId && catalog.some(p => p.id === variant.sourcePackageId)
    ? variant.sourcePackageId : pkg;
  const lesson = db.prepare('SELECT vimeo,duration,free FROM lessons WHERE deleted_at IS NULL AND package_id=? AND idx=?').get(source, idx);
  if (!lesson || lesson.vimeo !== id) return res.status(404).json({ error:'الفيديو غير موجود' });
  const enrollment = db.prepare('SELECT expires FROM enrollments WHERE user_id=? AND package_id=?').get(req.user.id, pkg);
  if (req.user.role !== 'admin' && !lesson.free && (!enrollment || enrollment.expires && enrollment.expires <= Date.now()))
    return res.status(403).json({ error:'لا يمكنك تعديل هذا الفيديو' });
  const duration = Math.floor(seconds / 60) + ':' + String(Math.floor(seconds) % 60).padStart(2, '0');
  saveObservedDuration.run(duration, source, idx, id);
  res.json({ duration:db.prepare('SELECT duration FROM lessons WHERE package_id=? AND idx=?').get(source,idx).duration });
});

async function fillMissingDurations() {
  const missing = db.prepare(`SELECT package_id,idx,vimeo FROM lessons WHERE deleted_at IS NULL AND ${missingDurationSql} AND vimeo GLOB '[0-9]*'`).all();
  for (const lesson of missing) {
    if (!normalizeVimeoReference(lesson.vimeo)) continue;
    const duration = await vimeoDuration(lesson.vimeo);
    if (duration) saveObservedDuration.run(duration, lesson.package_id, lesson.idx, lesson.vimeo);
  }
}
setTimeout(() => fillMissingDurations().catch(error => console.error('Vimeo duration refresh:', error)), 5000);
setInterval(() => fillMissingDurations().catch(error => console.error('Vimeo duration refresh:', error)), 6 * 60 * 60 * 1000);
app.post('/api/admin/lessons/:pkg/fill-durations', auth, admin, async (req, res) => {
  const missing = db.prepare(`SELECT idx,vimeo FROM lessons WHERE package_id=? AND deleted_at IS NULL AND TRIM(COALESCE(vimeo,''))<>'' AND ${missingDurationSql}`)
    .all(req.params.pkg);
  let updated = 0;
  for (const row of missing) {
    const id = normalizeVimeoReference(row.vimeo)?.stored;
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
  // Arrow moves update only presentation metadata. Never replay a stale full
  // lesson snapshot over another editor's current media, notes, files or quizzes.
  if (req.body?.kind === 'display-order') {
    const { orders, expectedCount } = req.body;
    const validRank = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000;
    if (!Number.isSafeInteger(expectedCount) || expectedCount < 1 ||
        !Array.isArray(orders) || !orders.length || orders.length > expectedCount ||
        orders.some(row => !row || !Number.isSafeInteger(row.idx) || row.idx < 0 ||
          !validRank(row.displayOrder) || !(row.displayOrderBase === null || validRank(row.displayOrderBase))) ||
        new Set(orders.map(row => row.idx)).size !== orders.length)
      return res.status(400).json({ error: 'ترتيب الدروس غير صحيح' });
    const update = db.prepare('UPDATE lessons SET display_order=? WHERE package_id=? AND idx=?');
    const saved = db.transaction(() => {
      const rows = db.prepare('SELECT idx,display_order,deleted_at FROM lessons WHERE package_id=? ORDER BY idx').all(req.params.pkg);
      if (rows.length !== expectedCount || orders.some(order => {
        const row = rows.find(row => row.idx === order.idx);
        return !row || row.deleted_at || order.displayOrder !== (row.display_order ?? null) && order.displayOrderBase !== (row.display_order ?? null);
      })) return false;
      orders.forEach(row => update.run(row.displayOrder, req.params.pkg, row.idx));
      return true;
    })();
    if (!saved) return res.status(409).json({ error: 'تغيّرت الدروس أو ترتيبها منذ فتح المحرر؛ أعد تحميل الصفحة وراجع الترتيب' });
    return res.json({ ok: true, structureBase:lessonStructure(db.prepare('SELECT * FROM lessons WHERE package_id=? ORDER BY idx').all(req.params.pkg)), orders: orders.map(({idx,displayOrder}) => ({idx,displayOrder})) });
  }
  const list = req.body;
  if (!Array.isArray(list) || list.some(l => !l || typeof l !== 'object' || Array.isArray(l) ||
      typeof (l.t || l.title) !== 'string' || !(l.t || l.title).trim() ||
      ['t','title','t_en','title_en','dur','duration','vimeo','notes','notes_en'].some(k => l[k] !== undefined && typeof l[k] !== 'string') ||
      ['ch','chapter'].some(k => l[k] !== undefined &&
        !(typeof l[k] === 'string' || Number.isSafeInteger(l[k]) && l[k] >= 0)) ||
      (l.displayOrder !== undefined && l.displayOrder !== null &&
        !(Number.isSafeInteger(l.displayOrder) && l.displayOrder >= 0 && l.displayOrder <= 1000000)) ||
      (l.displayOrderBase !== undefined && l.displayOrderBase !== null &&
        !(Number.isSafeInteger(l.displayOrderBase) && l.displayOrderBase >= 0 && l.displayOrderBase <= 1000000)) ||
      (l.free !== undefined && ![true,false,0,1].includes(l.free)) ||
      (l.clearVimeo !== undefined && typeof l.clearVimeo !== 'boolean') ||
      (l.files !== undefined && !Array.isArray(l.files)) ||
      (l.quiz !== undefined && !Array.isArray(l.quiz))))
    return res.status(400).json({ error: 'قائمة الدروس غير صحيحة' });
  // Only look up newly linked videos; keep existing durations when Vimeo is unavailable.
  const readExisting = db.prepare('SELECT * FROM lessons WHERE package_id=? ORDER BY idx');
  const existing = readExisting.all(req.params.pkg);
  const snapshot = JSON.stringify(existing);
  if(list.length<existing.length || existing.some((row,i)=>row.idx!==i || (list[i].idx!==undefined&&list[i].idx!==i)) ||
      existing.some(row=>row.deleted_at) && list.some(l=>l.structureBase!==lessonStructure(existing)) ||
      list.some(l=>l.structureBase!==undefined&&l.structureBase!==lessonStructure(existing)))
    return res.status(409).json({error:'تغيّرت قائمة الدروس؛ أعد تحميل المحرر. استخدم حذف الدرس القابل للاستعادة'});
  // Once a lifecycle action has been used, old clients cannot overwrite newer slots.
  if(db.prepare("SELECT 1 FROM settings WHERE k LIKE ? LIMIT 1").get('lesson_action:'+req.params.pkg+':%') && existing.some((row,i)=>list[i].structureBase!==lessonStructure(existing)))
    return res.status(409).json({error:'أعد تحميل المحرر قبل حفظ الدروس'});
  for (let i = 0; i < list.length; i++) {
    const lesson = list[i];
    if(existing[i]?.deleted_at)continue;
    if (lesson.ch === undefined && lesson.chapter !== undefined) lesson.ch = lesson.chapter;
    if (lesson.dur === undefined && lesson.duration !== undefined) lesson.dur = lesson.duration;
    const video = normalizeVimeoReference(lesson.vimeo)?.stored;
    const videoMatches = video ? existing.filter(row => normalizeVimeoReference(row.vimeo)?.stored === video) : [];
    const titleMatches = existing.filter(row => row.title === (lesson.t || lesson.title));
    // Slot identity is authoritative, including when title and video are edited together.
    const old=existing[i];
    const moved=existing.filter(row=>row.title===(lesson.t||lesson.title)||video&&normalizeVimeoReference(row.vimeo)?.stored===video);
    if(lesson.idx!==undefined&&lesson.idx!==i || lesson.idx===undefined&&(moved.length===1&&moved[0].idx!==i || videoMatches.length===1&&videoMatches[0].idx!==i || titleMatches.length===1&&titleMatches[0].idx!==i))
      return res.status(409).json({error:'استخدم ترتيب العرض؛ لا يمكن تغيير هوية الدرس'});
    // A loaded draft must not overwrite a newer editor's presentation order.
    // Idempotent retries and queued title saves with the already-saved rank are safe.
    if (old && lesson.displayOrder !== undefined && lesson.displayOrder !== (old.display_order ?? null) &&
        lesson.displayOrderBase !== (old.display_order ?? null))
      return res.status(409).json({ error: 'تغيّر ترتيب الدروس منذ فتح المحرر؛ أعد تحميل الصفحة وراجع الترتيب قبل المحاولة مجدداً' });
    // Omitted fields are not a request to erase saved teaching material.
    // Explicit empty strings/arrays and false remain valid edits.
    if (old) {
      for (const [key, column] of [['t_en','title_en'], ['ch','chapter'],
          ['free','free'], ['notes','notes'], ['notes_en','notes_en']]) {
        if (lesson[key] === undefined && lesson[column] === undefined) lesson[key] = old[column];
      }
      if (lesson.displayOrder === undefined) lesson.displayOrder = old.display_order ?? null;
      if (lesson.files === undefined) lesson.files = JSON.parse(old.files || '[]');
      if (lesson.dur === undefined && lesson.duration === undefined && !lesson.clearVimeo &&
          (!lesson.vimeo || normalizeVimeoReference(lesson.vimeo)?.stored === normalizeVimeoReference(old.vimeo)?.stored))
        lesson.dur = old.duration;
    }
    if (!Array.isArray(lesson.quiz) && old?.quiz) lesson.quiz = JSON.parse(old.quiz);
    if (!lesson.vimeo && old?.vimeo && !lesson.clearVimeo) lesson.vimeo = old.vimeo;
    const id = normalizeVimeoReference(lesson.vimeo)?.stored;
    if (!id) continue;
    lesson.vimeo = id;
    const previous = existing.find(row => row.idx === i && row.vimeo === id);
    if ((!lesson.dur || lesson.dur === '00:00') && previous?.duration) lesson.dur = previous.duration;
    if (!lesson.dur || lesson.dur === '00:00') lesson.dur = await vimeoDuration(id) || '';
  }
  const del = db.prepare('DELETE FROM lessons WHERE package_id=?');
  const ins = db.prepare(`INSERT INTO lessons (package_id,idx,title,title_en,chapter,duration,vimeo,free,notes,notes_en,files,quiz,display_order,deleted_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const saved = db.transaction(() => {
    // Vimeo lookups await the network. A concurrent editor/duration update must
    // not be overwritten by the earlier request's stale replacement snapshot.
    if (JSON.stringify(readExisting.all(req.params.pkg)) !== snapshot) return false;
    del.run(req.params.pkg);
    list.forEach((l, i) => {
      const old=existing[i];
      if(old?.deleted_at){ins.run(req.params.pkg,i,old.title,old.title_en,old.chapter,old.duration,old.vimeo,old.free,old.notes,old.notes_en,old.files,old.quiz,old.display_order,old.deleted_at);return;}
      ins.run(req.params.pkg, i,
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
      }).slice(0, 20) : []), l.displayOrder ?? null,null);});
    return true;
  })();
  if (!saved) return res.status(409).json({ error: 'تغيّرت الدروس أثناء الحفظ؛ أعد تحميلها وراجع التغييرات قبل المحاولة مجدداً' });
  res.json({ ok: true, count: list.length, structureBase:lessonStructure(readExisting.all(req.params.pkg)) });
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
app.patch('/api/admin/messages/:id', auth, admin, (req, res) => {
  const status = String(req.body?.status || '');
  if (!['new','reviewing','replied','closed'].includes(status))
    return res.status(400).json({ error: 'حالة الرسالة غير صالحة' });
  const result = db.prepare('UPDATE messages SET status=? WHERE id=?').run(status, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'الرسالة غير موجودة' });
  res.json({ ok: true, status });
});

/* ═══════════ المحتوى القابل للتحرير (CMS) ═══════════ */
app.get('/api/content', (req, res) => {
  const out = {};
  ['cms', 'courses', 'packages', 'academic', 'consulting', 'tracks', 'modes', 'systems', 'promos', 'learning'].forEach(k => {
    const v = setting('content_' + k);
    if (v) { try { out[k] = JSON.parse(v); } catch (e) {} }
  });
  if (Array.isArray(out.courses)) out.courses = out.courses.map(course => ({...course, chapterSlotFloor:chapterSlotFloor(db, course, out.packages || [])}));
  out.instructors = publicInstructors(setting);
  out.defaultInstructorId = publicDefaultInstructorId(setting);
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
  const videos = db.prepare("SELECT package_id, duration FROM lessons WHERE deleted_at IS NULL AND TRIM(COALESCE(vimeo,'')) <> ''")
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
function validCourseChapterKeys(courseId, chapters) {
  // Both catalog writers use the same bounded validation before any settings write.
  // Courses without chapter metadata and legacy string slots remain supported.
  if (chapters === undefined) return true;
  if (!Array.isArray(chapters) || chapters.length > 100 || chapters.some(ch =>
      !(ch === null || typeof ch === 'string' && ch.trim() && ch.length <= 200 ||
        ch && typeof ch === 'object' && !Array.isArray(ch) && typeof ch.ar === 'string' && ch.ar.trim() && ch.ar.length <= 200 &&
        typeof ch.en === 'string' && ch.en.length <= 200))) return false;
  const objects = chapters.filter(ch => ch && typeof ch === 'object');
  const keys = objects.filter(ch => ch.outlineKey !== undefined).map(ch => ch.outlineKey);
  if (!keys.every(key => courseId === 'pmp' && typeof key === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(key)) || new Set(keys).size !== keys.length) return false;
  if (objects.some(ch => Object.hasOwn(ch, 'outlineOrder') && (!Number.isInteger(ch.outlineOrder) || ch.outlineOrder < 0 || ch.outlineOrder > 10000))) return false;
  if (courseId !== 'pmp') return objects.every(ch => !Object.hasOwn(ch, 'outlineParent'));
  // Canonical nodes exist even without saved overrides. Keep this default graph
  // in parity with CourseRoadmap.topics; the hierarchy regression verifies it.
  const parents = new Map(Object.entries({
    intro:null, exam:'intro', journey:'intro', framework:null, agile:null,
    predictive:null, initiating:'predictive', planning:'predictive', executing:'predictive', monitoring:'predictive', closing:'predictive',
    hybrid:null, people:null, process:null, business:null, value:null, principles:null, lifecycles:null, ai:null,
    'final-reviews':null, summaries:'final-reviews', review:'final-reviews', workshops:null, 'exam-eve':null, 'exam-guidelines':null
  }));
  chapters.forEach((ch, index) => {
    if (ch === null) return;
    const key = ch && typeof ch === 'object' && ch.outlineKey || 'source_' + index;
    if (!parents.has(key)) parents.set(key, null);
  });
  for (let index = 0; index < chapters.length; index++) {
    const ch = chapters[index];
    if (!ch || typeof ch !== 'object' || !Object.hasOwn(ch, 'outlineParent')) continue;
    const key = ch.outlineKey || 'source_' + index, parent = ch.outlineParent;
    if (parent !== null && (typeof parent !== 'string' || !parents.has(parent) || parent === key)) return false;
    parents.set(key, parent);
  }
  for (const key of parents.keys()) {
    const seen = new Set(); let current = key;
    while (current !== null) {
      if (seen.has(current) || !parents.has(current)) return false;
      seen.add(current); current = parents.get(current);
    }
  }
  return true;
}
app.put('/api/admin/course-chapters/:course', auth, admin, (req, res) => {
  const chapters = req.body?.chapters;
  if (!Array.isArray(chapters) || chapters.length > 100 || chapters.some(ch =>
    !(ch === null || typeof ch === 'string' && ch.trim() && ch.length <= 200 ||
      ch && typeof ch === 'object' && !Array.isArray(ch) && typeof ch.ar === 'string' && ch.ar.trim() && ch.ar.length <= 200 &&
      typeof ch.en === 'string' && ch.en.length <= 200)))
    return res.status(400).json({ error: 'أسماء الفصول غير صحيحة' });
  if (!validCourseChapterKeys(req.params.course, chapters))
    return res.status(400).json({ error: 'بيانات المحاور أو ترتيبها أو تبعيتها غير صحيحة' });
  const result = db.transaction(() => {
    const courses = JSON.parse(setting('content_courses') || '[]');
    const course = courses.find(c => c.id === req.params.course);
    if (!course) return {status:404,error:'الدورة غير موجودة'};
    const packages = JSON.parse(setting('content_packages') || '[]');
    if (!validChapterAllocation(db, course, {chapters}, packages))
      return {status:409,error:'تغيّرت خانات الفصول المحفوظة. أعد تحميل المحتوى قبل إضافة فصل.'};
    course.chapters = chapters;
    delete course.chapterSlotFloor;
    db.prepare("INSERT INTO settings (k,v) VALUES ('content_courses',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v")
      .run(JSON.stringify(courses));
    return {chapters,chapterSlotFloor:chapterSlotFloor(db,course,packages)};
  })();
  if (result.error) return res.status(result.status).json({error:result.error});
  res.json({ ok:true, ...result });
});
app.put('/api/admin/content', auth, admin, (req, res) => {
  const body = req.body || {};
  if (Object.hasOwn(body, 'courses') && (!Array.isArray(body.courses) || body.courses.some(c => !c || typeof c !== 'object' || Array.isArray(c) || !validCourseChapterKeys(c.id, c.chapters))))
    return res.status(400).json({ error: 'بيانات المحاور أو ترتيبها أو تبعيتها غير صحيحة' });
  if (Array.isArray(body.packages)) {
    try { validatePackageInstructors(body.packages, setting, readList('content_packages')); }
    catch (error) { return res.status(error.status || 400).json({ error:error.message }); }
    for (const p of body.packages.filter(x => x.active !== false && x.sourcePackageId)) {
      const source = body.packages.find(x => x.id === p.sourcePackageId && x.course === p.course);
      if (!source) return res.status(422).json({ error: 'مصدر محتوى النسخة اللغوية غير موجود: ' + p.id });
      const lessons = db.prepare('SELECT title,title_en FROM lessons WHERE deleted_at IS NULL AND package_id=?').all(source.id);
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
  const allocationError = db.transaction(() => {
    const previous = JSON.parse(setting('content_courses') || '[]');
    const packages = [...JSON.parse(setting('content_packages') || '[]'), ...(Array.isArray(body.packages) ? body.packages : [])];
    for (const course of body.courses || []) {
      const old = previous.find(c => c.id === course.id) || {id:course.id,chapters:[]};
      if (course.chapters === undefined && old.chapters !== undefined) course.chapters = old.chapters;
      if (!validChapterAllocation(db, old, course, packages)) return true;
    }
  Object.keys(body).forEach(k => {
    if (['cms', 'courses', 'packages', 'academic', 'consulting', 'tracks', 'modes', 'systems', 'promos'].includes(k))
      setSetting('content_' + k, JSON.stringify(k === 'courses' ? body[k].map(({chapterSlotFloor, ...course}) => course) : body[k]));
  });
  /* الكتالوج يُشتق من الباقات ليتحقّق الدفع من السعر */
  if (body.packages) {
    setSetting('catalog', JSON.stringify(body.packages.filter(p => p.active !== false).map(p =>
      ({ id: p.id, ar: p.ar, en:p.en || '', code:p.code || p.id, price: p.price,
         currency: p.currency, days: p.days, hours: p.hours, cert: !!p.cert, type: p.type }))));
  }
    return false;
  })();
  if (allocationError) return res.status(409).json({error:'تغيّرت خانات الفصول المحفوظة. أعد تحميل المحتوى قبل إضافة فصل.'});
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
/* الفصل الخاص — باقة مخفية: /classroom */
mountClassroom(app, { db, JWT_SECRET });
// Reuse the classroom engine per published package without granting private-classroom access.
const learningWorkspaces = new Map();
app.use('/workspace/:pkg', (req, res, next) => {
  const pkg = req.params.pkg;
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(pkg)) return res.status(404).json({ error: 'الباقة غير موجودة' });
  const current = () => {
    const packages = readList('content_packages'), p = packages.find(x => x.id === pkg);
    if (!p) return null;
    const course = readList('content_courses').find(x => x.id === p.course);
    return { id: p.id, ar: p.ar, en: p.en, course: p.course, lang: p.lang, domains: course?.domains || [], code: course?.code || p.course };
  };
  if (!current()) return res.status(404).json({ error: 'الباقة غير موجودة' });
  if (!learningWorkspaces.has(pkg)) {
    const router = express.Router();
    mountClassroom(router, { db, JWT_SECRET, packageId: pkg, basePath: '', workspace: true, getPackage: current });
    learningWorkspaces.set(pkg, router);
  }
  learningWorkspaces.get(pkg)(req, res, next);
});
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/verify/:no', (req, res) => res.sendFile(path.join(__dirname, 'public', 'verify.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n🚀 منصة السعيد تعمل على ${SITE}`);
  console.log(`   البوابة: ${setting('gateway') || process.env.PAYMENT_GATEWAY || 'kashier'} · ` +
    `المفتاح السرّي: ${process.env.PAYMOB_SECRET_KEY || process.env.MOYASAR_SECRET_KEY || process.env.TAP_SECRET_KEY ? 'مضبوط ✅' : 'غير مضبوط ⚠️'}\n`);
});


