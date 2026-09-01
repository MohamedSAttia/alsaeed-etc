/* ============================================================
   منصة السعيد — لوحة الإدارة المستقلة
   مسار سرّي · كلمة مرور قوية · حماية بالمحاولات
   ============================================================ */
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

export function mountAdmin(app, db, cfg) {
  const { JWT_SECRET, SITE } = cfg;
  const PANEL = (process.env.ADMIN_PANEL_PATH || 'manage-x7k').replace(/^\/+|\/+$/g, '');
  const r = express.Router();

  /* ═══ حماية مشدّدة على الدخول ═══ */
  const attempts = new Map();
  function throttle(req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'x';
    const a = attempts.get(ip) || { n: 0, until: 0 };
    if (a.until > Date.now()) {
      const s = Math.ceil((a.until - Date.now()) / 1000);
      return res.status(429).json({ error: `محاولات كثيرة — انتظر ${s} ثانية` });
    }
    req._ip = ip;
    next();
  }
  function fail(ip) {
    const a = attempts.get(ip) || { n: 0, until: 0 };
    a.n++;
    if (a.n >= 5) { a.until = Date.now() + Math.min(a.n * 60000, 900000); a.n = 0; }
    attempts.set(ip, a);
  }
  const ok = ip => attempts.delete(ip);

  r.use('/api/login', rateLimit({ windowMs: 10 * 60 * 1000, max: 12,
    message: { error: 'محاولات كثيرة — حاول بعد قليل' } }));

  /* ═══ الجلسة ═══ */
  function sign(u) {
    return jwt.sign({ id: u.id, role: u.role, panel: true }, JWT_SECRET, { expiresIn: '12h' });
  }
  function guard(req, res, next) {
    const h = req.headers.authorization || '';
    const t = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!t) return res.status(401).json({ error: 'يلزم تسجيل الدخول' });
    try {
      const p = jwt.verify(t, JWT_SECRET);
      if (!p.panel || p.role !== 'admin') return res.status(403).json({ error: 'غير مصرّح' });
      req.admin = db.prepare('SELECT id,name,email,role FROM users WHERE id=? AND role=?')
        .get(p.id, 'admin');
      if (!req.admin) return res.status(403).json({ error: 'الحساب غير موجود' });
      next();
    } catch (e) { res.status(401).json({ error: 'انتهت الجلسة — سجّل الدخول' }); }
  }

  /* ═══ الدخول ═══ */
  r.post('/api/login', throttle, (req, res) => {
    const { email, password } = req.body || {};
    const u = db.prepare("SELECT * FROM users WHERE email=? AND role='admin'")
      .get(String(email || '').trim().toLowerCase());
    if (!u || !bcrypt.compareSync(String(password || ''), u.pass)) {
      fail(req._ip);
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }
    ok(req._ip);
    db.prepare('UPDATE users SET last_login=? WHERE id=?').run(Date.now(), u.id);
    res.json({ token: sign(u), admin: { id: u.id, name: u.name, email: u.email } });
  });

  r.get('/api/me', guard, (req, res) => res.json({ admin: req.admin }));

  r.post('/api/password', guard, (req, res) => {
    const { current, next: nx } = req.body || {};
    const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.admin.id);
    if (!bcrypt.compareSync(String(current || ''), u.pass))
      return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    if (String(nx || '').length < 10)
      return res.status(400).json({ error: 'كلمة المرور الجديدة عشرة أحرف على الأقل' });
    db.prepare('UPDATE users SET pass=? WHERE id=?').run(bcrypt.hashSync(nx, 12), u.id);
    res.json({ ok: true });
  });

  /* ═══ لوحة القيادة ═══ */
  r.get('/api/dash', guard, (req, res) => {
    const now = Date.now(), d30 = now - 30 * 86400000, d7 = now - 7 * 86400000;
    res.json({
      students: db.prepare("SELECT COUNT(*) c FROM users WHERE role='student'").get().c,
      newWeek: db.prepare("SELECT COUNT(*) c FROM users WHERE role='student' AND created>?").get(d7).c,
      active: db.prepare('SELECT COUNT(DISTINCT user_id) c FROM enrollments').get().c,
      orders: db.prepare('SELECT COUNT(*) c FROM orders').get().c,
      paid: db.prepare("SELECT COUNT(*) c FROM orders WHERE status='paid'").get().c,
      revenue: db.prepare("SELECT COALESCE(SUM(amount),0) s FROM orders WHERE status='paid'").get().s,
      revenue30: db.prepare("SELECT COALESCE(SUM(amount),0) s FROM orders WHERE status='paid' AND paid_at>?").get(d30).s,
      certificates: db.prepare('SELECT COUNT(*) c FROM certificates').get().c,
      messages: db.prepare('SELECT COUNT(*) c FROM messages').get().c,
      lessons: db.prepare('SELECT COUNT(*) c FROM lessons').get().c,
      withVideo: db.prepare("SELECT COUNT(*) c FROM lessons WHERE vimeo IS NOT NULL AND vimeo!=''").get().c,
      topPackages: db.prepare(`SELECT package_id, COUNT(*) n FROM enrollments
        GROUP BY package_id ORDER BY n DESC LIMIT 6`).all(),
      recent: db.prepare(`SELECT id,name,email,created FROM users WHERE role='student'
        ORDER BY created DESC LIMIT 8`).all()
    });
  });

  /* ═══ المتدربون ═══ */
  r.get('/api/students', guard, (req, res) => {
    const q = `%${(req.query.q || '').trim()}%`;
    const rows = db.prepare(`SELECT u.id,u.name,u.email,u.phone,u.created,u.active,u.last_login,
      (SELECT COUNT(*) FROM enrollments e WHERE e.user_id=u.id) packages,
      (SELECT COUNT(*) FROM certificates c WHERE c.user_id=u.id) certs
      FROM users u WHERE u.role='student' AND (u.name LIKE ? OR u.email LIKE ?)
      ORDER BY u.created DESC`).all(q, q);
    const en = db.prepare('SELECT user_id,package_id,source,expires,created FROM enrollments').all();
    res.json(rows.map(u => ({ ...u, enrollments: en.filter(e => e.user_id === u.id) })));
  });

  r.post('/api/students', guard, (req, res) => {
    const { name, email, phone, password, packages } = req.body || {};
    if (!name || !email) return res.status(400).json({ error: 'الاسم والبريد مطلوبان' });
    const mail = String(email).trim().toLowerCase();
    if (db.prepare('SELECT id FROM users WHERE email=?').get(mail))
      return res.status(409).json({ error: 'هذا البريد مسجّل' });
    const id = crypto.randomBytes(9).toString('base64url');
    const pw = password && password.length >= 6 ? password
      : 'AS' + crypto.randomBytes(3).toString('hex').toUpperCase();
    db.prepare(`INSERT INTO users (id,name,email,pass,role,phone,active,created)
      VALUES (?,?,?,?,?,?,1,?)`)
      .run(id, name.trim(), mail, bcrypt.hashSync(pw, 10), 'student', phone || null, Date.now());
    (packages || []).forEach(p => {
      try {
        db.prepare(`INSERT INTO enrollments (id,user_id,package_id,source,expires,created)
          VALUES (?,?,?,?,?,?)`)
          .run(crypto.randomBytes(9).toString('base64url'), id, p.id || p,
               'إضافة إدارية', p.days ? Date.now() + p.days * 86400000 : null, Date.now());
      } catch (e) {}
    });
    res.json({ id, password: pw });
  });

  /* إضافة دفعة متدربين */
  r.post('/api/students/bulk', guard, (req, res) => {
    const { rows, packageId, days } = req.body || {};
    if (!Array.isArray(rows) || !rows.length)
      return res.status(400).json({ error: 'لا بيانات' });
    const out = [];
    const insU = db.prepare(`INSERT INTO users (id,name,email,pass,role,phone,active,created)
      VALUES (?,?,?,?,?,?,1,?)`);
    const insE = db.prepare(`INSERT INTO enrollments (id,user_id,package_id,source,expires,created)
      VALUES (?,?,?,?,?,?)`);
    rows.forEach(rw => {
      const mail = String(rw.email || '').trim().toLowerCase();
      if (!mail || !rw.name) return;
      let u = db.prepare('SELECT id FROM users WHERE email=?').get(mail);
      let pw = null;
      if (!u) {
        const id = crypto.randomBytes(9).toString('base64url');
        pw = 'AS' + crypto.randomBytes(3).toString('hex').toUpperCase();
        insU.run(id, String(rw.name).trim(), mail, bcrypt.hashSync(pw, 10),
                 'student', rw.phone || null, Date.now());
        u = { id };
      }
      if (packageId) {
        try {
          insE.run(crypto.randomBytes(9).toString('base64url'), u.id, packageId,
                   'إضافة دفعة', days ? Date.now() + days * 86400000 : null, Date.now());
        } catch (e) {}
      }
      out.push({ name: rw.name, email: mail, password: pw || '(حساب قائم)' });
    });
    res.json({ ok: true, count: out.length, created: out });
  });

  /* ═══ الدروس والفيديو ═══ */
  r.get('/api/lessons/:pkg', guard, (req, res) => {
    res.json(db.prepare('SELECT * FROM lessons WHERE package_id=? ORDER BY idx')
      .all(req.params.pkg));
  });
  r.put('/api/lessons/:pkg', guard, (req, res) => {
    const list = Array.isArray(req.body) ? req.body : [];
    const del = db.prepare('DELETE FROM lessons WHERE package_id=?');
    const ins = db.prepare(`INSERT INTO lessons (package_id,idx,title,chapter,duration,vimeo,free)
      VALUES (?,?,?,?,?,?,?)`);
    db.transaction(() => {
      del.run(req.params.pkg);
      list.forEach((l, i) => ins.run(req.params.pkg, i, l.t || l.title || '',
        l.ch != null ? l.ch : (l.chapter || 0), l.dur || l.duration || '',
        l.vimeo || '', l.free ? 1 : 0));
    })();
    res.json({ ok: true, count: list.length });
  });

  /* ═══ صفحة اللوحة ═══ */
  app.use('/' + PANEL, r);
  app.get('/' + PANEL, (req, res) => res.sendFile(cfg.panelFile));
  app.get('/' + PANEL + '/*', (req, res) => res.sendFile(cfg.panelFile));

  console.log(`🔐 لوحة الإدارة: ${SITE}/${PANEL}`);
  return PANEL;
}
