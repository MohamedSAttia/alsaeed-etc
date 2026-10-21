// Administrative access is not payment. Only this explicit, owner-approved
// action records an offline payment and issues its invoice, in one transaction.
export function createManualInvoiceIssuer({ db, uid, config, createInvoice, markPaid,
  ownerEmail = process.env.ADMIN_EMAIL, now = Date.now }) {
  db.exec(`CREATE TABLE IF NOT EXISTS manual_invoice_approvals (
    enrollment_id TEXT PRIMARY KEY, order_id TEXT UNIQUE NOT NULL,
    approved_by TEXT NOT NULL, payment_reference TEXT NOT NULL,
    payment_method TEXT NOT NULL, payment_received_at INTEGER NOT NULL,
    approved_at INTEGER NOT NULL, amount REAL NOT NULL, currency TEXT NOT NULL)`);
  const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
  return function issue(actorId, body = {}) {
    const actor = db.prepare('SELECT id,email,role,active FROM users WHERE id=?').get(actorId || '');
    if (!ownerEmail || !actor || actor.role !== 'admin' || actor.active === 0 ||
        actor.email.toLowerCase() !== ownerEmail.trim().toLowerCase())
      fail(403, 'إصدار الفاتورة اليدوية يتطلب موافقة مالك المنصة');
    if (body.paymentReceived !== true || body.approveInvoice !== true)
      fail(400, 'يجب تأكيد استلام الدفع فعلياً والموافقة الصريحة على إصدار الفاتورة');
    if (!['number','string'].includes(typeof body.amount)) fail(400, 'أدخل مبلغاً فعلياً صالحاً');
    const amount = Number(body.amount), currency = String(body.currency || '').toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000 ||
        Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001)
      fail(400, 'أدخل المبلغ المستلم الفعلي بحد أقصى منزلتين عشريتين');
    const method = String(body.paymentMethod || ''), reference = String(body.paymentReference || '').trim();
    if (!['cash', 'bank_transfer', 'other'].includes(method) || reference.length > 300 ||
        (method !== 'cash' && !reference)) fail(400, 'حدد طريقة الدفع ومرجعه؛ المرجع اختياري للدفع النقدي');
    const receivedAt = Number(body.paymentReceivedAt), timestamp = now();
    if (!Number.isSafeInteger(receivedAt) || receivedAt <= 0 || receivedAt > timestamp)
      fail(400, 'حدد تاريخ استلام فعلي غير مستقبلي');
    const country = String(body.country || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) fail(400, 'حدد بلد المشتري');
    return db.transaction(() => {
      const user = db.prepare("SELECT id,name,email FROM users WHERE email=? AND role='student' AND active!=0")
        .get(String(body.email || '').trim().toLowerCase());
      if (!user) fail(404, 'لا يوجد طالب نشط بهذا البريد');
      let catalog; try { catalog = JSON.parse(db.prepare("SELECT v FROM settings WHERE k='catalog'").get()?.v || '[]'); } catch { catalog = []; }
      const pkg = catalog.find(p => p.id === body.packageId);
      const enrollment = db.prepare('SELECT * FROM enrollments WHERE user_id=? AND package_id=?').get(user.id, body.packageId || '');
      if (!enrollment) fail(400, 'يلزم اشتراك قائم؛ إضافة الاشتراك لا تعني الدفع');
      const previous = db.prepare('SELECT * FROM manual_invoice_approvals WHERE enrollment_id=?').get(enrollment.id);
      if (previous) {
        const invoice = db.prepare('SELECT * FROM invoices WHERE order_id=?').get(previous.order_id);
        if (previous.amount !== amount || previous.currency !== currency || previous.payment_reference !== reference ||
            previous.payment_method !== method || previous.payment_received_at !== receivedAt ||
            !invoice || invoice.buyer_country !== country || invoice.invoice_language !== (body.language === 'en' ? 'en' : 'ar'))
          fail(409, 'صدرت فاتورة لهذا الاشتراك بالفعل؛ لا يمكن استبدالها أو إصدار نسخة مالية جديدة');
        return { ok: true, duplicate: true, invoice };
      }
      if (!pkg || (enrollment.expires != null && enrollment.expires <= timestamp))
        fail(400, 'يلزم اشتراك ساري في باقة موجودة؛ إضافة الاشتراك لا تعني الدفع');
      if (!/^[A-Z]{3}$/.test(currency) || !(Number(config().currencies?.[currency]) > 0))
        fail(400, 'اختر عملة مفعلة');
      const existing = db.prepare(`SELECT i.id FROM invoices i LEFT JOIN orders o ON o.id=i.order_id
        WHERE i.user_id=? AND COALESCE(NULLIF(i.package_id,''),o.package_id)=? LIMIT 1`).get(user.id, pkg.id);
      const paidOrder = db.prepare("SELECT id FROM orders WHERE user_id=? AND package_id=? AND status='paid' LIMIT 1").get(user.id, pkg.id);
      if (existing || paidOrder) fail(409, 'يوجد طلب مدفوع أو فاتورة لهذه الباقة؛ راجع السجل لتجنب التكرار');
      const orderId = uid();
      db.prepare(`INSERT INTO orders (id,user_id,package_id,amount,currency,status,gateway,gateway_id,created,paid_at)
        VALUES (?,?,?,?,?,'paid','manual',?,?,?)`).run(orderId,user.id,pkg.id,amount,currency,reference,timestamp,receivedAt);
      db.prepare('INSERT INTO manual_invoice_approvals VALUES (?,?,?,?,?,?,?,?,?)')
        .run(enrollment.id,orderId,actor.id,reference,method,receivedAt,timestamp,amount,currency);
      createInvoice(orderId,user,amount,currency,{ country, packageId:pkg.id, purchaseId:orderId,
        itemName:pkg.ar || pkg.en || pkg.id, language:body.language === 'en' ? 'en' : 'ar' });
      markPaid(orderId,timestamp);
      return { ok:true, invoice:db.prepare('SELECT * FROM invoices WHERE order_id=?').get(orderId) };
    }).immediate();
  };
}
