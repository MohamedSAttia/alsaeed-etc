import crypto from 'node:crypto';

export const EXTENSION_DAY_MS = 86400000;
export const MAX_EXTENSION_DAYS = 3650;
export const MAX_ENROLLMENT_EXPIRES = 4102444800000; // 2100-01-01T00:00:00Z

class ExtensionError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const fail = (status, code, message) => { throw new ExtensionError(status, code, message); };
const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const timestamp = value => Number.isSafeInteger(value) && value > 0 && value <= MAX_ENROLLMENT_EXPIRES;

// The audit is append-only through this API and deliberately has no cascading
// foreign keys: later account/enrollment deletion must not erase its history.
export function createEnrollmentExtender({ db, now = Date.now, createId = () => crypto.randomUUID() }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS enrollment_extension_audit (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      enrollment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      package_id TEXT NOT NULL,
      old_expires INTEGER NOT NULL,
      new_expires INTEGER NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('days', 'date')),
      days INTEGER,
      created INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS enrollment_extension_audit_target
      ON enrollment_extension_audit (user_id, package_id, created);
  `);

  const findActor = db.prepare('SELECT role,active FROM users WHERE id=?');
  const findUser = db.prepare('SELECT id FROM users WHERE id=?');
  const findEnrollment = db.prepare('SELECT id,expires FROM enrollments WHERE user_id=? AND package_id=?');
  const update = db.prepare(`UPDATE enrollments SET expires=?
    WHERE id=? AND user_id=? AND package_id=? AND expires IS ?`);
  const audit = db.prepare(`INSERT INTO enrollment_extension_audit
    (id,actor_id,enrollment_id,user_id,package_id,old_expires,new_expires,mode,days,created)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);

  const extend = db.transaction(({ actorId, userId, packageId, body }) => {
    // Recheck current privileges while holding the write transaction. A token's
    // historical role and the shared auth middleware's incomplete user cannot
    // authorize an inactive, deleted, or demoted administrator.
    const actor = findActor.get(actorId);
    if (!actor || actor.role !== 'admin' || actor.active !== 1)
      fail(403, 'ACTIVE_ADMIN_REQUIRED', 'يلزم حساب مشرف فعّال لإجراء التمديد');

    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some(key => !['expectedEnrollmentId', 'expectedExpires', 'days', 'expiresAt'].includes(key)) ||
        typeof body.expectedEnrollmentId !== 'string' || !body.expectedEnrollmentId.trim() || body.expectedEnrollmentId.length > 200 ||
        !has(body, 'expectedExpires') || !(body.expectedExpires === null || body.expectedExpires === 0 || timestamp(body.expectedExpires)) ||
        has(body, 'days') === has(body, 'expiresAt'))
      fail(400, 'INVALID_EXTENSION', 'أرسل معرّف الاشتراك وتاريخ انتهائه الحالي، واختر الأيام أو التاريخ فقط');

    const mode = has(body, 'days') ? 'days' : 'date';
    if (mode === 'days' && (!Number.isInteger(body.days) || body.days < 1 || body.days > MAX_EXTENSION_DAYS))
      fail(400, 'INVALID_EXTENSION', `عدد أيام التمديد يجب أن يكون عددًا صحيحًا من 1 إلى ${MAX_EXTENSION_DAYS}`);
    if (mode === 'date' && !timestamp(body.expiresAt))
      fail(400, 'INVALID_EXTENSION', 'تاريخ الانتهاء المطلوب غير صالح');

    const enrollment = findEnrollment.get(userId, packageId);
    if (!findUser.get(userId) || !enrollment)
      fail(404, 'ENROLLMENT_NOT_FOUND', 'الاشتراك غير موجود لهذا المتدرب وهذه الباقة');
    if (enrollment.id !== body.expectedEnrollmentId || enrollment.expires !== body.expectedExpires)
      fail(409, 'ENROLLMENT_CHANGED', 'تغيّر الاشتراك منذ فتحه. حدّث البيانات ثم راجع التمديد');
    if (enrollment.expires === null || enrollment.expires === 0)
      fail(409, 'ENROLLMENT_UNLIMITED', 'هذا الاشتراك غير محدود المدة ولا يحتاج إلى تمديد');
    if (!timestamp(enrollment.expires))
      fail(409, 'ENROLLMENT_INVALID', 'تاريخ انتهاء الاشتراك الحالي غير صالح للتمديد');

    const extendedAt = now();
    const base = Math.max(extendedAt, enrollment.expires);
    const expires = mode === 'days' ? base + body.days * EXTENSION_DAY_MS : body.expiresAt;
    if (!timestamp(expires) || expires <= base || expires > base + MAX_EXTENSION_DAYS * EXTENSION_DAY_MS)
      fail(400, 'INVALID_EXTENSION', 'يجب أن يكون التاريخ الجديد بعد الانتهاء الحالي والوقت الحالي، وبحد أقصى 3650 يومًا إضافيًا وقبل عام 2100');

    const changed = update.run(expires, enrollment.id, userId, packageId, enrollment.expires);
    if (changed.changes !== 1)
      fail(409, 'ENROLLMENT_CHANGED', 'تغيّر الاشتراك منذ فتحه. حدّث البيانات ثم راجع التمديد');

    const auditId = createId();
    const days = mode === 'days' ? body.days : null;
    audit.run(auditId, actorId, enrollment.id, userId, packageId, enrollment.expires, expires, mode, days, extendedAt);
    return { ok: true, userId, packageId, enrollmentId: enrollment.id,
      oldExpires: enrollment.expires, expires, extendedAt, mode, days, auditId };
  });

  // IMMEDIATE serializes readers that intend to update across processes; the
  // compare-and-swap also protects against stale/replayed client requests.
  return input => extend.immediate(input);
}

export function mountEnrollmentExtensions({ app, db, auth }) {
  const extend = createEnrollmentExtender({ db });
  app.post('/api/admin/users/:userId/enrollments/:packageId/extend', auth, (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      res.json(extend({ actorId: req.user.id, userId: req.params.userId, packageId: req.params.packageId, body: req.body }));
    } catch (error) {
      if (error instanceof ExtensionError)
        return res.status(error.status).json({ error: error.message, code: error.code });
      if (error.code === 'SQLITE_BUSY')
        return res.status(503).json({ error: 'الخدمة مشغولة الآن. حدّث الاشتراك قبل المحاولة مجددًا', code: 'EXTENSION_BUSY' });
      console.error('Enrollment extension transaction failed:', error.message);
      res.status(500).json({ error: 'تعذّر حفظ التمديد. حدّث الاشتراك للتحقق من حالته', code: 'EXTENSION_FAILED' });
    }
  });
}
