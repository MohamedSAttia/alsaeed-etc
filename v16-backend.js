import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export function installV16(ctx) {
  const { db, setting, setSetting, uid, sendJson, readJson, grant, jwtSecret } = ctx;

  db.exec(
    'CREATE TABLE IF NOT EXISTS blogs (' +
    'id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title_ar TEXT NOT NULL, title_en TEXT, ' +
    'excerpt_ar TEXT, excerpt_en TEXT, body_ar TEXT NOT NULL, body_en TEXT, category TEXT, image TEXT, author TEXT, ' +
    'published INTEGER DEFAULT 0, created INTEGER NOT NULL, updated INTEGER NOT NULL);' +
    'CREATE INDEX IF NOT EXISTS idx_blogs_published ON blogs(published, created);' +
    'CREATE TABLE IF NOT EXISTS invoices (' +
    'id TEXT PRIMARY KEY, order_id TEXT UNIQUE NOT NULL, invoice_no TEXT UNIQUE NOT NULL, user_id TEXT NOT NULL, ' +
    'buyer_name TEXT, buyer_tax_id TEXT, buyer_address TEXT, seller_name TEXT, seller_tax_id TEXT, seller_address TEXT, ' +
    'subtotal REAL NOT NULL, tax_rate REAL DEFAULT 0, tax_amount REAL DEFAULT 0, total REAL NOT NULL, currency TEXT NOT NULL, ' +
    "status TEXT DEFAULT 'pending', created INTEGER NOT NULL, issued_at INTEGER);" +
    'CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id, created);'
  );

  const defaults = {
    sellerName: 'السعيد للتدريب والاستشارات والتعليم عن بعد',
    sellerTaxId: '',
    sellerAddress: 'مصر',
    vatRate: 14,
    baseCurrency: 'USD',
    currencies: { USD: 1, EGP: 48, SAR: 3.75, AED: 3.67, EUR: 0.92 }
  };

  function config() {
    try { return Object.assign({}, defaults, JSON.parse(setting('invoice_settings') || '{}')); }
    catch { return Object.assign({}, defaults); }
  }

  function publicConfig() {
    const value = config();
    return {
      vatRate: Number(value.vatRate) || 0,
      baseCurrency: value.baseCurrency,
      currencies: Object.keys(value.currencies || {}).filter(function (key) {
        return Number(value.currencies[key]) > 0;
      }),
      rates: value.currencies || {}
    };
  }

  function convert(amount, from, to) {
    const value = config();
    from = String(from || value.baseCurrency).toUpperCase();
    to = String(to || from).toUpperCase();
    const a = Number(value.currencies && value.currencies[from]);
    const b = Number(value.currencies && value.currencies[to]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
      throw new Error('العملة المطلوبة غير مفعلة في إعدادات الفواتير');
    }
    return Math.round((Number(amount) / a * b) * 100) / 100;
  }

  function invoiceNo() {
    const year = new Date().getUTCFullYear();
    const count = db.prepare('SELECT COUNT(*) c FROM invoices WHERE created>=?').get(Date.UTC(year, 0, 1)).c + 1;
    return 'INV-' + year + '-' + String(count).padStart(6, '0');
  }

  function createInvoice(orderId, user, total, currency, billing) {
    const value = config();
    const taxRate = Math.max(0, Number(value.vatRate) || 0);
    const subtotal = Math.round((Number(total) / (1 + taxRate / 100)) * 100) / 100;
    const taxAmount = Math.round((Number(total) - subtotal) * 100) / 100;
    db.prepare(
      'INSERT INTO invoices (id,order_id,invoice_no,user_id,buyer_name,buyer_tax_id,buyer_address,' +
      'seller_name,seller_tax_id,seller_address,subtotal,tax_rate,tax_amount,total,currency,status,created) ' +
      'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ).run(
      uid(), orderId, invoiceNo(), user.id,
      String((billing && billing.name) || user.name || ''),
      String((billing && billing.taxId) || ''),
      String((billing && billing.address) || ''),
      String(value.sellerName || ''), String(value.sellerTaxId || ''), String(value.sellerAddress || ''),
      subtotal, taxRate, taxAmount, Number(total), String(currency), 'pending', Date.now()
    );
  }

  function markPaid(orderId, paidAt) {
    db.prepare("UPDATE invoices SET status='issued', issued_at=? WHERE order_id=?").run(paidAt || Date.now(), orderId);
  }

  const initial = [
    ['why-pmo-fails', 'لماذا يفشل مكتب إدارة المشاريع في أول سنتين؟', 'Why PMOs Fail in Their First Two Years', 'إدارة المشاريع', 'قراءة عملية لأسباب التعثر وكيفية بناء مكتب يحقق أثرًا قابلًا للقياس.'],
    ['risk-types', 'الفرق بين المخاطرة المتأصلة والمتبقية والثانوية', 'Inherent, Residual and Secondary Risk', 'الحوكمة والمخاطر', 'شرح مبسط للمفاهيم مع أمثلة من بيئة العمل.'],
    ['pmp-exam-domains', 'كيف تقرأ نطاقات اختبار PMP وتوزع وقتك عليها؟', 'How to Read PMP Exam Domains', 'PMP', 'خطة عملية للمذاكرة والمراجعة حسب نطاقات الاختبار الرسمية.']
  ];
  if (!db.prepare('SELECT COUNT(*) c FROM blogs').get().c) {
    const now = Date.now();
    const insert = db.prepare('INSERT INTO blogs (id,slug,title_ar,title_en,excerpt_ar,body_ar,category,author,published,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    initial.forEach(function (item, index) {
      insert.run(uid(), item[0], item[1], item[2], item[4], item[4] + '\n\nسيتم تحديث هذا المقال من لوحة المشرف بالمحتوى الكامل.', item[3], 'د. محمد عطية', 1, now - index * 86400000, now);
    });
  }

  async function handleAdmin(req, res, parts, method) {
    if (parts[0] === 'blogs') {
      if (method === 'GET' && parts.length === 1) {
        return sendJson(res, 200, db.prepare('SELECT * FROM blogs ORDER BY created DESC').all().map(function (x) {
          x.published = !!x.published; return x;
        }));
      }
      if (method === 'POST' && parts.length === 1) {
        let b; try { b = await readJson(req); } catch { return sendJson(res, 400, { error: 'بيانات غير صحيحة' }); }
        const slug = String(b.slug || '').trim().toLowerCase();
        if (!/^[a-z0-9][a-z0-9-]{2,100}$/.test(slug) || !String(b.title_ar || '').trim() || !String(b.body_ar || '').trim()) {
          return sendJson(res, 400, { error: 'المعرّف والعنوان والمحتوى العربي مطلوبة' });
        }
        const id = uid(), now = Date.now();
        try {
          db.prepare('INSERT INTO blogs (id,slug,title_ar,title_en,excerpt_ar,excerpt_en,body_ar,body_en,category,image,author,published,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
            .run(id, slug, b.title_ar, b.title_en || '', b.excerpt_ar || '', b.excerpt_en || '', b.body_ar, b.body_en || '', b.category || '', b.image || '', b.author || 'د. محمد عطية', b.published ? 1 : 0, now, now);
          return sendJson(res, 200, { ok: true, id: id });
        } catch { return sendJson(res, 409, { error: 'معرّف المقال مستخدم بالفعل' }); }
      }
      if (parts.length === 2) {
        const id = decodeURIComponent(parts[1]);
        const old = db.prepare('SELECT * FROM blogs WHERE id=?').get(id);
        if (!old) return sendJson(res, 404, { error: 'المقال غير موجود' });
        if (method === 'PUT') {
          let b; try { b = await readJson(req); } catch { return sendJson(res, 400, { error: 'بيانات غير صحيحة' }); }
          db.prepare('UPDATE blogs SET slug=?,title_ar=?,title_en=?,excerpt_ar=?,excerpt_en=?,body_ar=?,body_en=?,category=?,image=?,author=?,published=?,updated=? WHERE id=?')
            .run(b.slug || old.slug, b.title_ar || old.title_ar, b.title_en ?? old.title_en, b.excerpt_ar ?? old.excerpt_ar, b.excerpt_en ?? old.excerpt_en, b.body_ar || old.body_ar, b.body_en ?? old.body_en, b.category ?? old.category, b.image ?? old.image, b.author ?? old.author, b.published === undefined ? old.published : (b.published ? 1 : 0), Date.now(), id);
          return sendJson(res, 200, { ok: true });
        }
        if (method === 'DELETE') {
          db.prepare('DELETE FROM blogs WHERE id=?').run(id);
          return sendJson(res, 200, { ok: true });
        }
      }
    }

    if (parts[0] === 'invoice-settings') {
      if (method === 'GET') return sendJson(res, 200, config());
      if (method === 'PUT') {
        let b; try { b = await readJson(req); } catch { return sendJson(res, 400, { error: 'بيانات غير صحيحة' }); }
        const value = {
          sellerName: String(b.sellerName || ''),
          sellerTaxId: String(b.sellerTaxId || ''),
          sellerAddress: String(b.sellerAddress || ''),
          vatRate: Math.max(0, Number(b.vatRate) || 0),
          baseCurrency: String(b.baseCurrency || 'USD').toUpperCase(),
          currencies: b.currencies && typeof b.currencies === 'object' ? b.currencies : {}
        };
        setSetting('invoice_settings', JSON.stringify(value));
        return sendJson(res, 200, { ok: true, settings: value });
      }
    }

    if (parts[0] === 'invoices' && method === 'GET') {
      return sendJson(res, 200, db.prepare('SELECT i.*,o.package_id,u.email buyer_email FROM invoices i JOIN orders o ON o.id=i.order_id JOIN users u ON u.id=i.user_id ORDER BY i.created DESC LIMIT 200').all());
    }
    return false;
  }

  async function handlePublic(req, res, requestUrl, authenticatedUser) {
    const method = req.method || 'GET';
    const pathname = requestUrl.pathname;
    if (method === 'GET' && pathname === '/api/blogs') {
      return sendJson(res, 200, db.prepare('SELECT slug,title_ar,title_en,excerpt_ar,excerpt_en,body_ar,body_en,category,image,author,created FROM blogs WHERE published=1 ORDER BY created DESC').all());
    }
    if (method === 'GET' && pathname === '/api/payment-config') return sendJson(res, 200, publicConfig());
    if (method === 'POST' && pathname === '/api/demo/login') {
      const email = 'demo@al-ltc.local', id = 'alsaeed-demo-student';
      let user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
      if (!user) {
        db.prepare('INSERT INTO users (id,name,email,pass,role,active,created) VALUES (?,?,?,?,?,?,?)')
          .run(id, 'متدرب تجريبي', email, bcrypt.hashSync(crypto.randomBytes(18).toString('hex'), 10), 'student', 1, Date.now());
        user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
      }
      db.prepare('DELETE FROM progress WHERE user_id=?').run(user.id);
      grant(user.id, 'pmp-full', 1, 'دخول تجريبي');
      return sendJson(res, 200, {
        token: jwt.sign({ id: user.id, role: 'student' }, jwtSecret, { expiresIn: '2h' }),
        user: { id: user.id, name: user.name, email: user.email, role: 'student' },
        packageId: 'pmp-full'
      });
    }
    if (method === 'GET' && pathname === '/api/my-invoices') {
      const user = authenticatedUser(req);
      if (!user) return sendJson(res, 401, { error: 'يلزم تسجيل الدخول' });
      return sendJson(res, 200, db.prepare('SELECT i.*,o.package_id FROM invoices i JOIN orders o ON o.id=i.order_id WHERE i.user_id=? ORDER BY i.created DESC').all(user.id));
    }
    if (method === 'GET' && pathname.startsWith('/api/invoices/')) {
      const user = authenticatedUser(req);
      if (!user) return sendJson(res, 401, { error: 'يلزم تسجيل الدخول' });
      const key = decodeURIComponent(pathname.slice('/api/invoices/'.length));
      const row = db.prepare('SELECT i.*,o.package_id FROM invoices i JOIN orders o ON o.id=i.order_id WHERE (i.id=? OR i.order_id=? OR i.invoice_no=?)').get(key, key, key);
      if (!row) return sendJson(res, 404, { error: 'الفاتورة غير موجودة' });
      if (user.role !== 'admin' && row.user_id !== user.id) return sendJson(res, 403, { error: 'لا يمكنك عرض هذه الفاتورة' });
      return sendJson(res, 200, row);
    }
    return false;
  }

  return { config, publicConfig, convert, createInvoice, markPaid, handleAdmin, handlePublic };
}
