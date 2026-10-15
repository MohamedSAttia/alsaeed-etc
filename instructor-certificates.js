/* Instructor management profiles and immutable completion-certificate records.
 * Profiles do not create login accounts or grant permissions. */
import crypto from 'node:crypto';

const COURSE_LOGOS = Object.freeze({
  pmp: '/assets/certifications/pmp.jpeg', rmp: '/assets/certifications/rmp.png',
  acp: '/assets/certifications/acp.jpg', grcp: '/assets/certifications/grcp.webp',
  p3o: '/assets/certifications/axelos.jpg', pba: '/assets/certifications/pba.jpeg',
  lss: '/assets/covers/lss.svg'
});
const BADGE_ASSETS = Object.freeze({
  pmp: ['/assets/badges/pmi-atp-instructor-pmp-supplied.png', '/assets/badges/pmi-atp-instructor-pmp.png'],
  rmp: ['/assets/badges/pmi-atp-instructor-rmp.png']
});
// A genuine signature image can be added to this reviewed allowlist when supplied.
// A typed signatureName is a presentation label, not proof of a handwritten signature.
const SIGNATURE_ASSETS = new Set();
const PROFILE_FIELDS = new Set(['nameAr', 'nameEn', 'titleAr', 'titleEn', 'bioAr', 'bioEn',
  'signatureName', 'signatureAsset', 'badges', 'active']);
const TEXT_LIMITS = { nameAr:160, nameEn:160, titleAr:160, titleEn:160, bioAr:2000, bioEn:2000, signatureName:160 };

class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new RequestError(status, message); };
const parse = (text, fallback) => { try { return JSON.parse(text); } catch { return fallback; } };
const list = (setting, key) => { const value = parse(setting(key) || '[]', []); return Array.isArray(value) ? value : []; };
const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
const cleanText = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const approvedBadge = badge => Object.hasOwn(BADGE_ASSETS, badge.courseId) && BADGE_ASSETS[badge.courseId].includes(badge.asset);

function safeBadges(badges) {
  if (!Array.isArray(badges)) return [];
  return badges.filter(b => isObject(b) && b.verified === true && approvedBadge(b)).map(b => ({
      courseId:b.courseId, asset:b.asset, label:cleanText(b.label, 160), verified:true
    }));
}

function safeProfile(profile, management = false) {
  const out = { id:cleanText(profile.id, 100) };
  for (const [key, limit] of Object.entries(TEXT_LIMITS)) out[key] = cleanText(profile[key], limit);
  out.signatureAsset = SIGNATURE_ASSETS.has(profile.signatureAsset) ? profile.signatureAsset : null;
  out.badges = safeBadges(profile.badges);
  out.active = profile.active !== false;
  if (management) { out.created = Number(profile.created) || 0; out.updated = Number(profile.updated) || 0; }
  return out;
}

export function publicInstructors(setting) {
  // A strict projection prevents old/imported profile secrets leaking into public content.
  return list(setting, 'content_instructors').filter(p => isObject(p) && p.active !== false && p.id)
    .map(p => safeProfile(p));
}

export function initializeInstructorRegistry({ db, setting, setSetting, now = Date.now }) {
  db.transaction(() => {
    if (setting('instructor_registry_v1_initialized')) return;
    // This one-time mapping preserves the pre-existing, explicitly named pmp/rmp/acp
    // instructor. Never overwrite an existing registry, assignment or catalog field.
    if (!setting('content_instructors')) {
      const timestamp = now();
      const profile = {
        id:'mohamed-attia', nameAr:'د. محمد عطية', nameEn:'Dr. Mohamed Attia',
        titleAr:'مدرب الدورة', titleEn:'Course Instructor', bioAr:'', bioEn:'',
        signatureName:'Mohamed Attia', signatureAsset:null, active:true,
        badges:[
          { courseId:'pmp', asset:'/assets/badges/pmi-atp-instructor-pmp-supplied.png', label:'PMI Authorized Training Partner Instructor — PMP', verified:true },
          { courseId:'rmp', asset:'/assets/badges/pmi-atp-instructor-rmp.png', label:'PMI Authorized Training Partner Instructor — PMI-RMP', verified:true }
        ], created:timestamp, updated:timestamp
      };
      setSetting('content_instructors', JSON.stringify([profile]));
      const packages = list(setting, 'content_packages');
      let changed = false;
      for (const pkg of packages) {
        if (['pmp','rmp','acp'].includes(pkg.course) && !pkg.instructorId) {
          pkg.instructorId = profile.id;
          changed = true;
        }
      }
      if (changed) setSetting('content_packages', JSON.stringify(packages));
    }
    setSetting('instructor_registry_v1_initialized', '1');
  }).immediate();
}

function validateProfile(input, previous = {}) {
  if (!isObject(input) || Object.keys(input).some(key => !PROFILE_FIELDS.has(key)))
    fail(400, 'حقول ملف المدرب غير صحيحة؛ هذا الملف لا ينشئ حساب دخول');
  const out = { ...safeProfile(previous, true) };
  for (const [key, limit] of Object.entries(TEXT_LIMITS)) {
    if (!(key in input)) continue;
    if (typeof input[key] !== 'string' || input[key].length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input[key]))
      fail(400, 'راجع نصوص ملف المدرب وطولها');
    out[key] = input[key].trim();
  }
  if (!out.nameEn) fail(400, 'اسم المدرب بالإنجليزية مطلوب للشهادة');
  if ('active' in input && typeof input.active !== 'boolean') fail(400, 'حالة المدرب غير صحيحة');
  if ('active' in input) out.active = input.active;
  if ('signatureAsset' in input) {
    if (input.signatureAsset && !SIGNATURE_ASSETS.has(input.signatureAsset))
      fail(400, 'صورة التوقيع ليست ضمن الملفات المعتمدة');
    out.signatureAsset = input.signatureAsset || null;
  }
  if ('badges' in input) {
    const seen = new Set();
    if (!Array.isArray(input.badges) || input.badges.length > Object.keys(BADGE_ASSETS).length)
      fail(400, 'بيانات اعتمادات المدرب غير صحيحة');
    for (const badge of input.badges) {
      if (!isObject(badge) || Object.keys(badge).some(k => !['courseId','asset','label','verified'].includes(k)) ||
          badge.verified !== true || !approvedBadge(badge) ||
          typeof badge.label !== 'string' || badge.label.length > 160 || seen.has(badge.courseId))
        fail(400, 'يلزم تأكيد اعتماد المدرب للدورة واختيار صورته المعتمدة');
      seen.add(badge.courseId);
    }
    out.badges = safeBadges(input.badges);
  }
  return out;
}

export function validatePackageInstructors(packages, setting, previous = []) {
  const profiles = list(setting, 'content_instructors');
  for (const pkg of packages) {
    if (!isObject(pkg)) fail(400, 'بيانات الباقات غير صحيحة');
    if (pkg.instructorId == null || pkg.instructorId === '') continue;
    if (typeof pkg.instructorId !== 'string' || pkg.instructorId.length > 100)
      fail(400, 'معرّف المدرب غير صحيح');
    const profile = profiles.find(p => p.id === pkg.instructorId);
    // Preserve an existing assignment when a profile is deactivated, but never assign it anew.
    const unchanged = previous.some(p => p.id === pkg.id && p.instructorId === pkg.instructorId);
    if (!profile || (profile.active === false && !unchanged)) fail(422, 'اختر مدرباً نشطاً مسجلاً للباقة');
  }
}

const route = handler => async (req, res, next) => {
  try { await handler(req, res); }
  catch (error) {
    if (error instanceof RequestError) return res.status(error.status).json({ error:error.message });
    if (next) return next(error);
    throw error;
  }
};

export function mountInstructorRegistry({ app, db, auth, admin, setting, setSetting, uid }) {
  const registry = () => list(setting, 'content_instructors');
  const activeAdmin = (req, res, next) => {
    // The shared auth middleware does not load active. Recheck it for this new
    // management surface so disabling an admin also disables their old token.
    const user = db.prepare('SELECT role,active FROM users WHERE id=?').get(req.user.id);
    if (!user || user.role !== 'admin' || user.active === 0)
      return res.status(403).json({ error:'يلزم حساب مشرف نشط' });
    next();
  };
  const checkUpdated = (body, previous) => {
    if (!('expectedUpdated' in body)) return;
    if (!Number.isFinite(body.expectedUpdated) || body.expectedUpdated < 0) fail(400, 'نسخة ملف المدرب غير صحيحة');
    if (body.expectedUpdated !== (Number(previous.updated) || 0)) fail(409, 'تم تعديل ملف المدرب؛ أعد تحميله قبل الحفظ');
  };
  app.get('/api/admin/instructors', auth, admin, activeAdmin, route((req, res) => {
    res.json({ instructors:registry().map(p => safeProfile(p, true)) });
  }));
  app.post('/api/admin/instructors', auth, admin, activeAdmin, route((req, res) => {
    const profile = validateProfile(req.body);
    profile.id = 'instructor-' + uid();
    profile.created = profile.updated = Date.now();
    db.transaction(() => setSetting('content_instructors', JSON.stringify([...registry(), profile]))).immediate();
    res.status(201).json({ ok:true, instructor:profile });
  }));
  app.put('/api/admin/instructors/:id', auth, admin, activeAdmin, route((req, res) => {
    const profile = db.transaction(() => {
      const profiles = registry(), index = profiles.findIndex(p => p.id === req.params.id);
      if (index < 0) fail(404, 'المدرب غير موجود');
      if (!isObject(req.body)) fail(400, 'بيانات ملف المدرب غير صحيحة');
      checkUpdated(req.body, profiles[index]);
      const { expectedUpdated, ...input } = req.body;
      const value = validateProfile(input, profiles[index]);
      value.updated = Math.max(Date.now(), (Number(profiles[index].updated) || 0) + 1);
      profiles[index] = value;
      setSetting('content_instructors', JSON.stringify(profiles));
      return value;
    }).immediate();
    res.json({ ok:true, instructor:profile });
  }));
  app.delete('/api/admin/instructors/:id', auth, admin, activeAdmin, route((req, res) => {
    const input = req.body || {};
    if (!isObject(input) || Object.keys(input).some(k => k !== 'expectedUpdated')) fail(400, 'بيانات تعطيل المدرب غير صحيحة');
    const profile = db.transaction(() => {
      const profiles = registry(), value = profiles.find(p => p.id === req.params.id);
      if (!value) fail(404, 'المدرب غير موجود');
      checkUpdated(input, value);
      value.active = false;
      value.updated = Math.max(Date.now(), (Number(value.updated) || 0) + 1);
      setSetting('content_instructors', JSON.stringify(profiles));
      return safeProfile(value, true);
    }).immediate();
    res.json({ ok:true, instructor:profile });
  }));
  app.put('/api/admin/packages/:pkg/instructor', auth, admin, activeAdmin, route((req, res) => {
    if (!isObject(req.body) || Object.keys(req.body).some(k => !['instructorId','expectedInstructorId'].includes(k)) || !('instructorId' in req.body))
      fail(400, 'حدّد المدرب المطلوب ربطه بالباقة');
    const instructorId = req.body.instructorId == null || req.body.instructorId === '' ? null : req.body.instructorId;
    if (instructorId !== null && typeof instructorId !== 'string') fail(400, 'معرّف المدرب غير صحيح');
    const result = db.transaction(() => {
      const packages = list(setting, 'content_packages'), pkg = packages.find(p => p.id === req.params.pkg);
      if (!pkg) fail(404, 'الباقة غير موجودة');
      if ('expectedInstructorId' in req.body && req.body.expectedInstructorId !== (pkg.instructorId || null))
        fail(409, 'تم تعديل مدرب الباقة؛ أعد تحميلها قبل الحفظ');
      const previous = packages.map(p => ({ ...p }));
      pkg.instructorId = instructorId;
      validatePackageInstructors(packages, setting, previous);
      setSetting('content_packages', JSON.stringify(packages));
      return { packageId:pkg.id, instructorId };
    }).immediate();
    res.json({ ok:true, ...result });
  }));
}

export function ensureCertificateSchema(db) {
  const columns = new Set(db.prepare('PRAGMA table_info(certificates)').all().map(c => c.name));
  for (const [column, type] of [['metadata','TEXT'], ['verify_token','TEXT'], ['revoked_at','INTEGER']]) {
    if (!columns.has(column)) db.exec(`ALTER TABLE certificates ADD COLUMN ${column} ${type}`);
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS certificates_verify_token ON certificates(verify_token) WHERE verify_token IS NOT NULL');
}

function presentationSnapshot(pkg, course, setting) {
  const profile = publicInstructors(setting).find(p => p.id === pkg.instructorId);
  return {
    version:1, courseId:course.id, courseCode:cleanText(course.code || '', 100),
    courseLogo:Object.hasOwn(COURSE_LOGOS, course.id) ? COURSE_LOGOS[course.id] : null,
    instructor:profile ? {
      id:profile.id, name:profile.nameEn, title:profile.titleEn, signatureName:profile.signatureName,
      signatureAsset:profile.signatureAsset,
      badge:profile.badges.find(b => b.courseId === course.id) || null
    } : null
  };
}

const CERT_FIELDS = 'no,name,course,hours,issued,metadata,verify_token,revoked_at';
function publicRecord(row) {
  // Never expose the user id, package enrollment, email or database internals.
  const presentation = parse(row.metadata || 'null', null);
  return { no:row.no, name:row.name, course:row.course, hours:row.hours, issued:row.issued,
    presentation:isObject(presentation) && presentation.version === 1 ? presentation : null };
}

function canonicalVideoSource(pkg, packages) {
  let source = pkg;
  const seen = new Set();
  while (source.sourcePackageId) {
    if (seen.has(source.id)) fail(400, 'مصدر محتوى الباقة غير صالح');
    seen.add(source.id);
    const next = packages.find(p => p.id === source.sourcePackageId && p.course === pkg.course);
    if (!next) fail(400, 'مصدر محتوى الباقة غير صالح');
    source = next;
  }
  return source.id;
}

export function createCertificateService({ db, setting, uid, site, now = Date.now }) {
  ensureCertificateSchema(db);
  // Tokens and links are generated only by the server. Strip any configured path/query.
  const origin = new URL(site).origin;
  const response = row => ({ ...publicRecord(row), verify:`${origin}/verify/${encodeURIComponent(row.verify_token || row.no)}` });
  const requireActiveUser = userId => {
    const user = db.prepare('SELECT active FROM users WHERE id=?').get(userId);
    if (!user || user.active === 0) fail(403, 'الحساب غير نشط');
  };
  const issue = db.transaction((userId, packageId, body = {}) => {
    requireActiveUser(userId);
    const owns = db.prepare('SELECT expires FROM enrollments WHERE user_id=? AND package_id=?').get(userId, packageId);
    if (!owns) fail(403, 'لست مشتركاً في هذه الباقة');
    const existing = db.prepare(`SELECT ${CERT_FIELDS} FROM certificates WHERE user_id=? AND package_id=? ORDER BY issued,no LIMIT 1`)
      .get(userId, packageId);
    if (existing) {
      if (existing.revoked_at != null) fail(403, 'هذه الشهادة ملغاة');
      // Reprinting a historical award does not create a new award or apply today's catalog.
      return response(existing);
    }
    const timestamp = now();
    if (owns.expires && owns.expires <= timestamp) fail(403, 'لا يوجد اشتراك فعّال في هذه الباقة');
    const packages = list(setting, 'content_packages'), pkg = packages.find(p => p.id === packageId);
    const catalog = list(setting, 'catalog').find(p => p.id === packageId);
    if (!pkg || !catalog || pkg.type !== 'full' || pkg.cert !== true || catalog.cert !== true || pkg.active === false)
      fail(400, 'شهادة الإتمام متاحة للباقات الكاملة المفعّلة فقط');
    const course = list(setting, 'content_courses').find(c => c.id === pkg.course);
    if (!course) fail(400, 'بيانات الدورة غير مكتملة لإصدار الشهادة');
    const source = canonicalVideoSource(pkg, packages);
    const videos = db.prepare("SELECT idx FROM lessons WHERE package_id=? AND TRIM(COALESCE(vimeo,''))<>''").all(source);
    const progressRow = db.prepare('SELECT data FROM progress WHERE user_id=? AND package_id=?').get(userId, packageId);
    const progress = parse(progressRow?.data || '{}', {});
    if (!videos.length || !isObject(progress) || !isObject(progress.lessons) ||
        !videos.every(l => progress.lessons[l.idx] === true || progress.lessons[l.idx] === 1))
      fail(400, 'يلزم إكمال مشاهدة جميع الفيديوهات أولاً');
    const englishName = String(body.englishName || '').trim().replace(/\s+/g, ' ');
    if (!/^[A-Za-z][A-Za-z .'-]{2,99}$/.test(englishName))
      fail(400, 'اكتب اسمك بالإنجليزية كما تريد ظهوره في الشهادة');
    const title = course.id === 'pmp' ? 'Project Management Professional (PMP) Preparation Course' :
      cleanText(course.en || pkg.en || catalog.en || catalog.ar, 300);
    if (!title) fail(400, 'اسم الدورة غير مكتمل لإصدار الشهادة');
    const hours = [pkg.hours, course.hours, catalog.hours].map(Number).find(h => Number.isFinite(h) && h > 0) || 0;
    const row = {
      no:'AS-' + new Date(timestamp).getUTCFullYear() + '-' + uid().toUpperCase().slice(0, 6),
      name:englishName, course:title, hours, issued:timestamp,
      metadata:JSON.stringify(presentationSnapshot(pkg, course, setting)),
      verify_token:crypto.randomBytes(24).toString('hex'), revoked_at:null
    };
    db.prepare('INSERT INTO certificates (no,user_id,package_id,name,course,hours,issued,metadata,verify_token) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(row.no, userId, packageId, row.name, row.course, row.hours, row.issued, row.metadata, row.verify_token);
    return response(row);
  });
  return {
    // A single immediate transaction covers lookup and insert, including concurrent requests.
    issue:(userId, packageId, body) => issue.immediate(userId, packageId, body),
    listOwned(userId) {
      requireActiveUser(userId);
      return db.prepare(`SELECT ${CERT_FIELDS},package_id FROM certificates WHERE user_id=? AND revoked_at IS NULL ORDER BY issued DESC,no LIMIT 200`)
        .all(userId).map(row => ({ ...publicRecord(row), packageId:row.package_id }));
    },
    getOwned(userId, no) {
      requireActiveUser(userId);
      const row = db.prepare(`SELECT ${CERT_FIELDS},package_id FROM certificates WHERE user_id=? AND no=?`).get(userId, no);
      if (!row) fail(404, 'الشهادة غير موجودة');
      if (row.revoked_at != null) fail(403, 'هذه الشهادة ملغاة');
      return { ...response(row), packageId:row.package_id };
    },
    verify(identifier) {
      if (typeof identifier !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(identifier)) return null;
      const row = db.prepare(`SELECT ${CERT_FIELDS} FROM certificates WHERE revoked_at IS NULL AND
        (verify_token=? OR (no=? AND verify_token IS NULL)) LIMIT 1`).get(identifier, identifier);
      return row ? publicRecord(row) : null;
    }
  };
}

export function mountCertificateRoutes(options) {
  const { app, auth, createQr } = options, service = createCertificateService(options);
  const sendPrintable = async (record, res) => {
    let qr;
    try { qr = await createQr(record.verify); }
    catch { return res.status(503).json({ error:'الشهادة محفوظة؛ تعذّر تجهيز رمز التحقق للطباعة. أعد المحاولة.', code:'CERTIFICATE_QR_UNAVAILABLE' }); }
    res.json({ ...record, qr });
  };
  app.post('/api/certificate/:pkg', auth, route(async (req, res) => {
    await sendPrintable(service.issue(req.user.id, req.params.pkg, req.body), res);
  }));
  app.get('/api/certificates', auth, route((req, res) => {
    res.json({ certificates:service.listOwned(req.user.id) });
  }));
  app.get('/api/certificates/:no', auth, route(async (req, res) => {
    await sendPrintable(service.getOwned(req.user.id, req.params.no), res);
  }));
  app.get('/api/verify/:no', route((req, res) => {
    const record = service.verify(req.params.no);
    if (!record) return res.status(404).json({ valid:false, error:'لا توجد شهادة صالحة بهذا الرقم' });
    res.json({ valid:true, ...record, issuedText:new Date(record.issued).toLocaleDateString('ar-SA') });
  }));
  return service;
}
