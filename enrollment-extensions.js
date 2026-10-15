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
function createEnrollmentEditor({ db, now = Date.now, createId = () => crypto.randomUUID() }, adjustment = false) {
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

  const edit = db.transaction(({ actorId, userId, packageId, body }) => {
    // Recheck current privileges while holding the write transaction. A token's
    // historical role and the shared auth middleware's incomplete user cannot
    // authorize an inactive, deleted, or demoted administrator.
    const actor = findActor.get(actorId);
    if (!actor || actor.role !== 'admin' || actor.active !== 1)
      fail(403, 'ACTIVE_ADMIN_REQUIRED', 'يلزم حساب مشرف فعّال لإجراء التمديد');

    const invalidCode = adjustment ? 'INVALID_ADJUSTMENT' : 'INVALID_EXTENSION';
    const fields = ['expectedEnrollmentId', 'expectedExpires', 'days', 'expiresAt'];
    if (adjustment) fields.push('confirmImmediateExpiry');
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some(key => !fields.includes(key)) ||
        typeof body.expectedEnrollmentId !== 'string' || !body.expectedEnrollmentId.trim() || body.expectedEnrollmentId.length > 200 ||
        !has(body, 'expectedExpires') || !(body.expectedExpires === null || body.expectedExpires === 0 || timestamp(body.expectedExpires)) ||
        has(body, 'days') === has(body, 'expiresAt') ||
        (has(body, 'confirmImmediateExpiry') && typeof body.confirmImmediateExpiry !== 'boolean'))
      fail(400, invalidCode, 'أرسل معرّف الاشتراك وتاريخ انتهائه الحالي، واختر الأيام أو التاريخ فقط');

    const mode = has(body, 'days') ? 'days' : 'date';
    if (mode === 'days' && (!Number.isInteger(body.days) || body.days === 0 ||
        body.days < (adjustment ? -MAX_EXTENSION_DAYS : 1) || body.days > MAX_EXTENSION_DAYS))
      fail(400, invalidCode, adjustment ? `أدخل عدد أيام صحيحًا غير صفر، بحد أقصى ${MAX_EXTENSION_DAYS} يومًا للزيادة أو التقليل` :
        `عدد أيام التمديد يجب أن يكون عددًا صحيحًا من 1 إلى ${MAX_EXTENSION_DAYS}`);
    if (mode === 'date' && !timestamp(body.expiresAt))
      fail(400, invalidCode, 'تاريخ الانتهاء المطلوب غير صالح');

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
    if (adjustment && !timestamp(extendedAt))
      fail(503, 'INVALID_SERVER_TIME', 'تعذّر التحقق من وقت الخادم. أعد المحاولة لاحقًا');
    const base = Math.max(extendedAt, enrollment.expires);
    // Reductions always subtract from the saved expiry, even if already expired.
    // The legacy endpoint retains its original extension-only bounds.
    const expires = mode === 'days' ?
      (adjustment && body.days < 0 ? enrollment.expires : base) + body.days * EXTENSION_DAY_MS : body.expiresAt;
    if (adjustment) {
      if (!timestamp(expires) || expires === enrollment.expires ||
          expires < enrollment.expires - MAX_EXTENSION_DAYS * EXTENSION_DAY_MS ||
          expires > base + MAX_EXTENSION_DAYS * EXTENSION_DAY_MS)
        fail(400, invalidCode, 'اختر تاريخًا مختلفًا صالحًا، بحد أقصى 3650 يومًا للزيادة أو التقليل وقبل عام 2100');
      if (expires <= extendedAt && body.confirmImmediateExpiry !== true)
        fail(409, 'IMMEDIATE_EXPIRY_CONFIRMATION_REQUIRED', 'التاريخ الجديد يوقف الوصول الآن. يلزم تأكيد إيقاف وصول المتدرب قبل الحفظ');
    } else if (!timestamp(expires) || expires <= base || expires > base + MAX_EXTENSION_DAYS * EXTENSION_DAY_MS) {
      fail(400, invalidCode, 'يجب أن يكون التاريخ الجديد بعد الانتهاء الحالي والوقت الحالي، وبحد أقصى 3650 يومًا إضافيًا وقبل عام 2100');
    }

    const changed = update.run(expires, enrollment.id, userId, packageId, enrollment.expires);
    if (changed.changes !== 1)
      fail(409, 'ENROLLMENT_CHANGED', 'تغيّر الاشتراك منذ فتحه. حدّث البيانات ثم راجع التمديد');

    // Recheck after the update, while rollback is still possible, so a date that
    // crosses the current instant during the transaction also needs consent.
    let checkedAt = extendedAt;
    if (adjustment) {
      const observedAt = now();
      if (!timestamp(observedAt))
        fail(503, 'INVALID_SERVER_TIME', 'تعذّر التحقق من وقت الخادم. أعد المحاولة لاحقًا');
      checkedAt = Math.max(extendedAt, observedAt);
      if (expires <= checkedAt && body.confirmImmediateExpiry !== true)
        fail(409, 'IMMEDIATE_EXPIRY_CONFIRMATION_REQUIRED', 'التاريخ الجديد يوقف الوصول الآن. يلزم تأكيد إيقاف وصول المتدرب قبل الحفظ');
    }
    const auditId = createId();
    const days = mode === 'days' ? body.days : null;
    audit.run(auditId, actorId, enrollment.id, userId, packageId, enrollment.expires, expires, mode, days, extendedAt);
    return { ok: true, userId, packageId, enrollmentId: enrollment.id,
      oldExpires: enrollment.expires, expires, extendedAt, mode, days, auditId,
      ...(adjustment ? { direction: expires > enrollment.expires ? 'increase' : 'reduction',
        endsAccess: expires <= checkedAt, checkedAt } : {}) };
  });

  // IMMEDIATE serializes readers that intend to update across processes; the
  // compare-and-swap also protects against stale/replayed client requests.
  return input => edit.immediate(input);
}

export function createEnrollmentExtender(options) {
  return createEnrollmentEditor(options);
}

export function createEnrollmentAdjuster(options) {
  return createEnrollmentEditor(options, true);
}

export function mountEnrollmentExtensions({ app, db, auth }) {
  const route = (path, edit, adjustment = false) => app.post(path, auth, (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      res.json(edit({ actorId: req.user.id, userId: req.params.userId, packageId: req.params.packageId, body: req.body }));
    } catch (error) {
      if (error instanceof ExtensionError)
        return res.status(error.status).json({ error: error.message, code: error.code });
      if (error.code === 'SQLITE_BUSY')
        return res.status(503).json({ error: 'الخدمة مشغولة الآن. حدّث الاشتراك قبل المحاولة مجددًا', code: adjustment ? 'ADJUSTMENT_BUSY' : 'EXTENSION_BUSY' });
      console.error('Enrollment expiry transaction failed:', error.message);
      res.status(500).json({ error: 'تعذّر حفظ تعديل المدة. حدّث الاشتراك للتحقق من حالته', code: adjustment ? 'ADJUSTMENT_FAILED' : 'EXTENSION_FAILED' });
    }
  });
  route('/api/admin/users/:userId/enrollments/:packageId/extend', createEnrollmentExtender({ db }));
  route('/api/admin/users/:userId/enrollments/:packageId/expiry', createEnrollmentAdjuster({ db }), true);
}
