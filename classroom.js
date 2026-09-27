// =====================================================================
// AL-LTC Private Classroom — «الفصل الخاص» (hidden package module)
// Mounted by server.js:   mountClassroom(app, { db, JWT_SECRET })
// - Uses Al-Saeed's own users / JWT / enrollments tables (single sign-on).
// - Access: users.role='admin'  →  admin
//           row in cls_staff    →  trainer (manages own groups only)
//           enrollment in the hidden package (CLASSROOM_PACKAGE) → trainee
// - Everything else lives in its own cls_* tables. No existing table is altered.
// - API lives under /classroom/api (outside /api, so the site-wide /api limiter
//   and routes are untouched). The page is public/classroom/index.html.
// =====================================================================
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

export const CLASSROOM_PACKAGE = process.env.CLASSROOM_PACKAGE || 'rmp-private-classroom';
const GRANT_DAYS = Number(process.env.CLASSROOM_DAYS || 365);

export function mountClassroom(app, { db, JWT_SECRET }) {
  if (!db || !JWT_SECRET) { console.error('[classroom] disabled: db/JWT_SECRET missing'); return; }
  db.exec(`
  CREATE TABLE IF NOT EXISTS cls_staff (user_id TEXT PRIMARY KEY, role TEXT NOT NULL DEFAULT 'trainer', created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS cls_profile (user_id TEXT PRIMARY KEY, org TEXT, notes TEXT, last_seen INTEGER);
  CREATE TABLE IF NOT EXISTS cls_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, course TEXT NOT NULL DEFAULT 'PMI-RMP',
    start_date TEXT, end_date TEXT, trainer_id TEXT, active INTEGER NOT NULL DEFAULT 1, notes TEXT, created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS cls_members (group_id INTEGER NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (group_id, user_id));
  CREATE TABLE IF NOT EXISTS cls_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, ref TEXT NOT NULL, title TEXT NOT NULL,
    target_type TEXT NOT NULL, target_id TEXT NOT NULL, day INTEGER, open_at INTEGER, due_at INTEGER,
    settings TEXT, note TEXT, created_by TEXT, created INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS cls_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, assignment_id INTEGER, kind TEXT NOT NULL, ref TEXT NOT NULL,
    title TEXT, score REAL, max REAL, pct REAL, dur INTEGER, detail TEXT, created INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS ix_cls_att_user ON cls_attempts(user_id, created);
  CREATE INDEX IF NOT EXISTS ix_cls_att_asg ON cls_attempts(assignment_id);
  CREATE TABLE IF NOT EXISTS cls_progress (user_id TEXT PRIMARY KEY, data TEXT, summary TEXT, updated INTEGER);
  CREATE TABLE IF NOT EXISTS cls_notices (id INTEGER PRIMARY KEY AUTOINCREMENT, target_type TEXT NOT NULL, target_id TEXT, text TEXT NOT NULL, created_by TEXT, created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS cls_live (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, group_id INTEGER, host_id TEXT NOT NULL, title TEXT, qs TEXT NOT NULL, state TEXT NOT NULL, created INTEGER NOT NULL, ended INTEGER);
  CREATE TABLE IF NOT EXISTS cls_live_answers (live_id INTEGER NOT NULL, user_id TEXT NOT NULL, qi INTEGER NOT NULL, choice TEXT, correct INTEGER, ms INTEGER, points INTEGER, PRIMARY KEY (live_id, user_id, qi));
  CREATE TABLE IF NOT EXISTS cls_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, user_id TEXT, action TEXT NOT NULL, detail TEXT);
  CREATE TABLE IF NOT EXISTS cls_content (kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, updated_by TEXT, updated INTEGER NOT NULL, PRIMARY KEY(kind,id));
  CREATE TABLE IF NOT EXISTS cls_submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, activity_id TEXT NOT NULL, notes TEXT NOT NULL, report TEXT, status TEXT NOT NULL DEFAULT 'submitted', feedback TEXT, reviewed_by TEXT, reviewed INTEGER, created INTEGER NOT NULL, updated INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS ix_cls_sub_user ON cls_submissions(user_id, updated);
  `);

  const q1 = (sql, ...a) => db.prepare(sql).get(...a);
  const qa = (sql, ...a) => db.prepare(sql).all(...a);
  const run = (sql, ...a) => db.prepare(sql).run(...a);
  const now = () => Date.now();
  const J = (s, d = null) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
  const tx = fn => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { try { db.exec('ROLLBACK'); } catch {} throw e; } };
  const audit = (uid, action, detail) => { try { run('INSERT INTO cls_audit (t,user_id,action,detail) VALUES (?,?,?,?)', now(), uid ?? null, action, detail ? String(detail).slice(0, 500) : null); } catch {} };
  const uid = () => crypto.randomBytes(9).toString('base64url');
  const genPass = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; let s = ''; for (const x of crypto.randomBytes(12)) s += a[x % a.length]; return s; };
  const inList = ids => ids.length ? ids.map(() => '?').join(',') : 'NULL';
  const bad = (res, m, c = 400) => res.status(c).json({ error: m });
  const str = (v, n = 200) => (v == null ? '' : String(v).trim().slice(0, n));

  // ---------------------------------------------------------------- access
  const hasAccess = id => !!q1('SELECT 1 FROM enrollments WHERE user_id = ? AND package_id = ? AND (expires IS NULL OR expires > ?)', id, CLASSROOM_PACKAGE, now());
  const grantAccess = (id, days = GRANT_DAYS) => {
    const exp = days ? now() + days * 864e5 : null;
    run(`INSERT INTO enrollments (id,user_id,package_id,source,expires,created) VALUES (?,?,?,?,?,?)
         ON CONFLICT(user_id,package_id) DO UPDATE SET expires = excluded.expires`, uid(), id, CLASSROOM_PACKAGE, 'الفصل الخاص', exp, now());
  };
  const revokeAccess = id => run('DELETE FROM enrollments WHERE user_id = ? AND package_id = ?', id, CLASSROOM_PACKAGE);
  const roleOf = u => u.role === 'admin' ? 'admin' : q1('SELECT 1 FROM cls_staff WHERE user_id = ?', u.id) ? 'trainer' : hasAccess(u.id) ? 'trainee' : null;
  const seen = id => q1('SELECT last_seen FROM cls_profile WHERE user_id = ?', id)?.last_seen || null;
  const prof = id => q1('SELECT org, notes FROM cls_profile WHERE user_id = ?', id) || {};
  const pub = (u, role) => ({ id: u.id, username: u.email, name: u.name, email: u.email, phone: u.phone || null, org: prof(u.id).org || null, notes: prof(u.id).notes || null,
    role: role || roleOf(u) || 'none', active: u.role === 'admin' || q1('SELECT 1 FROM cls_staff WHERE user_id = ?', u.id) ? true : hasAccess(u.id), must_change: false, created: u.created, last_seen: seen(u.id) });

  function auth(req, res, next) {
    const h = req.headers.authorization || '';
    const t = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!t) return bad(res, 'يلزم تسجيل الدخول', 401);
    let p; try { p = jwt.verify(t, JWT_SECRET); } catch { return bad(res, 'انتهت الجلسة — سجّل الدخول من جديد', 401); }
    const u = q1('SELECT id, name, email, role, phone, active, created FROM users WHERE id = ?', p.id);
    if (!u || u.active === 0) return bad(res, 'الحساب غير متاح', 401);
    const role = roleOf(u);
    if (!role) return res.status(403).json({ error: 'هذه الباقة خاصة — يفتحها المدرّب لحسابك.', noAccess: true, user: { name: u.name, email: u.email } });
    req.user = { ...u, role, raw_role: u.role };
    const ls = seen(u.id);
    if (!ls || now() - ls > 60e3) run('INSERT INTO cls_profile (user_id, last_seen) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen', u.id, now());
    next();
  }
  const staff = (req, res, next) => (['admin', 'trainer'].includes(req.user.role) ? next() : bad(res, 'صلاحية المدرّب مطلوبة', 403));
  const adminOnly = (req, res, next) => (req.user.role === 'admin' ? next() : bad(res, 'صلاحية مدير المنصة مطلوبة', 403));

  const groupIdsFor = u => u.role === 'admin' ? qa('SELECT id FROM cls_groups').map(r => r.id) : qa('SELECT id FROM cls_groups WHERE trainer_id = ?', u.id).map(r => r.id);
  const canGroup = (u, gid) => u.role === 'admin' || !!q1('SELECT 1 FROM cls_groups WHERE id = ? AND trainer_id = ?', gid, u.id);
  const canUser = (u, id) => u.role === 'admin' || u.id === id || !!q1('SELECT 1 FROM cls_members m JOIN cls_groups g ON g.id = m.group_id WHERE m.user_id = ? AND g.trainer_id = ?', id, u.id);
  const userGroups = id => qa('SELECT g.id, g.name, g.course, g.start_date, g.end_date FROM cls_members m JOIN cls_groups g ON g.id = m.group_id WHERE m.user_id = ? AND g.active = 1', id);
  const userRow = id => q1('SELECT id, name, email, role, phone, active, created FROM users WHERE id = ?', id);

  const r = express.Router();
  r.use(express.json({ limit: '3mb' }));
  r.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  // ---------------------------------------------------------------- me / progress
  r.get('/me', auth, (req, res) => res.json({ user: pub(req.user, req.user.role), groups: userGroups(req.user.id), package: CLASSROOM_PACKAGE }));
  r.get('/progress', auth, (req, res) => { const p = q1('SELECT data, updated FROM cls_progress WHERE user_id = ?', req.user.id); res.json({ data: J(p?.data), updated: p?.updated || 0 }); });
  r.put('/progress', auth, (req, res) => {
    const data = req.body?.data; if (!data || typeof data !== 'object') return bad(res, 'بيانات غير صالحة');
    const s = JSON.stringify(data); if (s.length > 2.5e6) return bad(res, 'حجم البيانات كبير');
    run(`INSERT INTO cls_progress (user_id, data, summary, updated) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, summary = excluded.summary, updated = excluded.updated`,
      req.user.id, s, JSON.stringify(req.body.summary || {}), now());
    res.json({ ok: true });
  });
  // The built-in bilingual course is immutable in the shipped page. These rows
  // overlay it so editing content never destroys an existing trainee attempt.
  r.get('/content', auth, (req, res) => res.json(qa('SELECT kind,id,data,active,updated FROM cls_content ORDER BY updated DESC').map(x => ({ ...x, data: J(x.data, {}) }))));
  r.put('/admin/content/:kind/:id', auth, staff, (req, res) => {
    const kind = req.params.kind, id = str(req.params.id, 64), data = req.body?.data;
    if (!['question','activity'].includes(kind) || !/^[A-Za-z0-9_-]{2,64}$/.test(id) || !data || typeof data !== 'object' || Array.isArray(data) || data.id !== id) return bad(res, 'بيانات المحتوى غير صالحة');
    const bilingual = x => x && typeof x.ar === 'string' && x.ar.trim() && typeof x.en === 'string' && x.en.trim();
    if (!bilingual(data.t || data.q)) return bad(res, 'أدخل النص بالعربية والإنجليزية');
    if (kind === 'question') {
      const opts = data.o, answers = [].concat(data.c ?? []);
      if (!opts || !Array.isArray(opts.ar) || !Array.isArray(opts.en) || opts.ar.length < 2 || opts.ar.length > 5 || opts.en.length !== opts.ar.length || !opts.ar.every(x => typeof x === 'string' && x.trim()) || !opts.en.every(x => typeof x === 'string' && x.trim()) || !answers.length || !answers.every(x => Number.isInteger(x) && x >= 0 && x < opts.ar.length) || ![1,2,3,4,5].includes(+data.d)) return bad(res, 'خيارات السؤال أو الإجابة أو المجال غير صالحة');
    } else if (!Array.isArray(data.steps) || !data.steps.length || !data.steps.every(bilingual) || ![1,2,3,4,5].includes(+data.day)) return bad(res, 'اليوم والخطوات باللغتين مطلوبة');
    const raw = JSON.stringify(data); if (raw.length > 25000) return bad(res, 'المحتوى طويل جدًا');
    run('INSERT INTO cls_content(kind,id,data,active,updated_by,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data,active=excluded.active,updated_by=excluded.updated_by,updated=excluded.updated', kind, id, raw, req.body.active === false ? 0 : 1, req.user.id, now());
    audit(req.user.id, 'content_updated', `${kind}:${id}`); res.json({ ok: true });
  });
  r.post('/my/submissions', auth, (req, res) => {
    const id = str(req.body?.activity_id, 64), notes = str(req.body?.notes, 10000), report = req.body?.report;
    if (!/^[A-Za-z0-9_-]{2,64}$/.test(id) || notes.length < 10) return bad(res, 'اختر النشاط واكتب ملخصًا لا يقل عن 10 أحرف');
    const serialized = report == null ? null : JSON.stringify(report);
    if (serialized?.length > 150000) return bad(res, 'حجم التقرير كبير جدًا');
    const t = now(), x = run('INSERT INTO cls_submissions(user_id,activity_id,notes,report,created,updated) VALUES(?,?,?,?,?,?)', req.user.id, id, notes, serialized, t, t);
    audit(req.user.id, 'activity_submitted', id); res.json({ ok: true, id: Number(x.lastInsertRowid) });
  });
  r.get('/my/submissions', auth, (req, res) => res.json(qa('SELECT id,activity_id,notes,status,feedback,created,updated,reviewed FROM cls_submissions WHERE user_id = ? ORDER BY created DESC LIMIT 300', req.user.id)));
  r.get('/admin/submissions', auth, staff, (req, res) => {
    const ids = traineeIdsFor(req.user);
    res.json(qa(`SELECT s.*, u.name, u.email FROM cls_submissions s JOIN users u ON u.id = s.user_id WHERE s.user_id IN (${inList(ids)}) ORDER BY s.created DESC LIMIT 500`, ...ids).map(x => ({ ...x, report: J(x.report) })));
  });
  r.put('/admin/submissions/:id', auth, staff, (req, res) => {
    const s = q1('SELECT * FROM cls_submissions WHERE id = ?', +req.params.id);
    if (!s || !canUser(req.user, s.user_id)) return bad(res, 'غير مسموح', 403);
    const status = req.body?.status;
    if (!['reviewed','revision_requested'].includes(status)) return bad(res, 'الحالة غير صالحة');
    run('UPDATE cls_submissions SET status=?,feedback=?,reviewed_by=?,reviewed=?,updated=? WHERE id=?', status, str(req.body.feedback, 2000), req.user.id, now(), now(), s.id);
    audit(req.user.id, 'submission_reviewed', String(s.id)); res.json({ ok: true });
  });

  // ---------------------------------------------------------------- trainee
  function assignmentsFor(id) {
    const gids = userGroups(id).map(g => String(g.id));
    return qa(`SELECT * FROM cls_assignments WHERE active = 1 AND ((target_type = 'user' AND target_id = ?) OR (target_type = 'group' AND target_id IN (${inList(gids)}))) ORDER BY COALESCE(day, 99), created`, id, ...gids).map(a => {
      const b = q1('SELECT MAX(pct) best, COUNT(*) n, MAX(created) last FROM cls_attempts WHERE user_id = ? AND assignment_id = ?', id, a.id);
      const t = now();
      const state = a.open_at && t < a.open_at ? 'upcoming' : a.due_at && t > a.due_at ? (b.n ? 'done' : 'missed') : b.n ? 'done' : 'open';
      return { ...a, settings: J(a.settings, {}), best: b.best, tries: b.n, last: b.last, state };
    });
  }
  r.get('/my/assignments', auth, (req, res) => res.json(assignmentsFor(req.user.id)));
  r.post('/attempts', auth, (req, res) => {
    const b = req.body || {}, kind = str(b.kind, 20), ref = str(b.ref, 120);
    if (!['game', 'exam', 'live'].includes(kind) || !ref) return bad(res, 'بيانات المحاولة غير صالحة');
    let aid = b.assignment_id ? +b.assignment_id : null;
    if (aid) {
      const mine = assignmentsFor(req.user.id).find(a => a.id === aid);
      if (!mine) aid = null;
      else if (mine.state === 'upcoming') return bad(res, 'هذا التكليف لم يُفتح بعد');
      else if (mine.settings?.maxTries && mine.tries >= mine.settings.maxTries) return bad(res, 'استنفدت عدد المحاولات المسموح');
    }
    const max = Math.max(0, +b.max || 0), score = Math.max(0, Math.min(+b.score || 0, max || 1e9));
    const pct = max ? Math.round(score / max * 1000) / 10 : 0;
    const x = run('INSERT INTO cls_attempts (user_id, assignment_id, kind, ref, title, score, max, pct, dur, detail, created) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      req.user.id, aid, kind, ref, str(b.title, 200), score, max, pct, Math.max(0, +b.dur || 0), b.detail ? JSON.stringify(b.detail).slice(0, 400000) : null, now());
    res.json({ ok: true, id: Number(x.lastInsertRowid), pct });
  });
  r.get('/my/attempts', auth, (req, res) => res.json(qa('SELECT id, assignment_id, kind, ref, title, score, max, pct, dur, created FROM cls_attempts WHERE user_id = ? ORDER BY created DESC LIMIT 300', req.user.id)));
  const leaderboard = (gid, since) => qa(`SELECT u.id, u.name,
      COALESCE(SUM(CASE WHEN a.kind IN ('game','live') THEN a.score ELSE 0 END),0) points, COUNT(a.id) attempts, ROUND(AVG(a.pct),1) avg_pct
    FROM cls_members m JOIN users u ON u.id = m.user_id LEFT JOIN cls_attempts a ON a.user_id = u.id AND a.created >= ?
    WHERE m.group_id = ? AND u.id NOT IN (SELECT user_id FROM cls_staff) AND u.role <> 'admin' GROUP BY u.id ORDER BY points DESC, avg_pct DESC`, since || 0, gid);
  r.get('/leaderboard/:gid', auth, (req, res) => {
    const gid = +req.params.gid;
    if (!q1('SELECT 1 FROM cls_members WHERE group_id = ? AND user_id = ?', gid, req.user.id) && !canGroup(req.user, gid)) return bad(res, 'غير مسموح', 403);
    const since = req.query.period === 'today' ? new Date().setHours(0, 0, 0, 0) : req.query.period === 'week' ? now() - 7 * 864e5 : 0;
    res.json(leaderboard(gid, since).map((x, i) => ({ rank: i + 1, id: x.id, name: x.name, points: Math.round(x.points), attempts: x.attempts, avg_pct: x.avg_pct, me: x.id === req.user.id })));
  });
  r.get('/my/notices', auth, (req, res) => {
    const gids = userGroups(req.user.id).map(g => String(g.id));
    res.json(qa(`SELECT n.id, n.text, n.created, u.name AS by FROM cls_notices n LEFT JOIN users u ON u.id = n.created_by
      WHERE n.target_type = 'all' OR (n.target_type = 'user' AND n.target_id = ?) OR (n.target_type = 'group' AND n.target_id IN (${inList(gids)})) ORDER BY n.created DESC LIMIT 30`, req.user.id, ...gids));
  });

  // ---------------------------------------------------------------- staff: overview
  const traineeIdsFor = u => {
    if (u.role === 'admin') return qa(`SELECT DISTINCT user_id FROM (SELECT user_id FROM enrollments WHERE package_id = ? UNION SELECT user_id FROM cls_members)
      WHERE user_id NOT IN (SELECT user_id FROM cls_staff) AND user_id NOT IN (SELECT id FROM users WHERE role = 'admin')`, CLASSROOM_PACKAGE).map(x => x.user_id);
    const g = groupIdsFor(u);
    return qa(`SELECT DISTINCT user_id FROM cls_members WHERE group_id IN (${inList(g)}) AND user_id NOT IN (SELECT user_id FROM cls_staff)`, ...g).map(x => x.user_id);
  };
  const summ = id => J(q1('SELECT summary FROM cls_progress WHERE user_id = ?', id)?.summary, {}) || {};
  r.get('/admin/overview', auth, staff, (req, res) => {
    const gids = groupIdsFor(req.user), T = traineeIdsFor(req.user), L = inList(T), day0 = new Date().setHours(0, 0, 0, 0);
    const k = {
      trainees: T.length,
      active_today: q1(`SELECT COUNT(*) c FROM cls_profile WHERE user_id IN (${L}) AND last_seen >= ?`, ...T, day0).c,
      active_7d: q1(`SELECT COUNT(*) c FROM cls_profile WHERE user_id IN (${L}) AND last_seen >= ?`, ...T, now() - 7 * 864e5).c,
      attempts_today: q1(`SELECT COUNT(*) c FROM cls_attempts WHERE user_id IN (${L}) AND created >= ?`, ...T, day0).c,
      attempts: q1(`SELECT COUNT(*) c FROM cls_attempts WHERE user_id IN (${L})`, ...T).c,
      exam_avg: q1(`SELECT ROUND(AVG(pct),1) a FROM cls_attempts WHERE kind = 'exam' AND user_id IN (${L})`, ...T).a,
      game_avg: q1(`SELECT ROUND(AVG(pct),1) a FROM cls_attempts WHERE kind = 'game' AND user_id IN (${L})`, ...T).a,
      groups: gids.length,
      assignments: q1(`SELECT COUNT(*) c FROM cls_assignments WHERE active = 1 AND ((target_type='group' AND target_id IN (${inList(gids)})) OR (target_type='user' AND target_id IN (${L})))`, ...gids.map(String), ...T).c,
    };
    const groups = qa(`SELECT g.*, u.name AS trainer, (SELECT COUNT(*) FROM cls_members m WHERE m.group_id = g.id) AS n FROM cls_groups g LEFT JOIN users u ON u.id = g.trainer_id WHERE g.id IN (${inList(gids)}) ORDER BY g.active DESC, g.created DESC`, ...gids).map(g => {
      const ids = qa('SELECT user_id FROM cls_members WHERE group_id = ?', g.id).map(x => x.user_id), IL = inList(ids);
      const rd = ids.map(i => summ(i).readiness).filter(x => x != null);
      return { ...g, active_today: q1(`SELECT COUNT(*) c FROM cls_profile WHERE user_id IN (${IL}) AND last_seen >= ?`, ...ids, day0).c,
        exam_avg: q1(`SELECT ROUND(AVG(pct),1) a FROM cls_attempts WHERE kind='exam' AND user_id IN (${IL})`, ...ids).a,
        game_avg: q1(`SELECT ROUND(AVG(pct),1) a FROM cls_attempts WHERE kind='game' AND user_id IN (${IL})`, ...ids).a,
        readiness: rd.length ? Math.round(rd.reduce((a, b) => a + b, 0) / rd.length) : null };
    });
    const daily = qa(`SELECT strftime('%Y-%m-%d', created/1000, 'unixepoch', '+3 hours') d, COUNT(*) n, ROUND(AVG(pct),1) avg FROM cls_attempts WHERE user_id IN (${L}) AND created >= ? GROUP BY d ORDER BY d`, ...T, now() - 14 * 864e5);
    const recent = qa(`SELECT a.id, a.kind, a.title, a.pct, a.created, u.name FROM cls_attempts a JOIN users u ON u.id = a.user_id WHERE a.user_id IN (${L}) ORDER BY a.created DESC LIMIT 15`, ...T);
    res.json({ kpi: k, groups, daily, recent });
  });

  // ---------------------------------------------------------------- staff: users (trainees & trainers)
  const userListRow = u => {
    const s = summ(u.id), a = q1("SELECT COUNT(*) n, ROUND(AVG(CASE WHEN kind='exam' THEN pct END),1) ex, ROUND(AVG(CASE WHEN kind='game' THEN pct END),1) gm, MAX(created) last FROM cls_attempts WHERE user_id = ?", u.id);
    return { ...pub(u), groups: qa('SELECT g.id, g.name FROM cls_members m JOIN cls_groups g ON g.id = m.group_id WHERE m.user_id = ?', u.id), readiness: s.readiness ?? null, lessons: s.lessons ?? null, answered: s.answered ?? null, accuracy: s.accuracy ?? null, attempts: a.n, exam_avg: a.ex, game_avg: a.gm, last_attempt: a.last };
  };
  r.get('/admin/users', auth, staff, (req, res) => {
    let ids = traineeIdsFor(req.user);
    if (req.user.role === 'admin') ids = [...new Set([...ids, ...qa('SELECT user_id FROM cls_staff').map(x => x.user_id), ...qa("SELECT id FROM users WHERE role = 'admin'").map(x => x.id)])];
    res.json(qa(`SELECT id, name, email, role, phone, active, created FROM users WHERE id IN (${inList(ids)}) ORDER BY name`, ...ids).map(userListRow));
  });
  // look up an existing AL-LTC account by email (to add it to the classroom)
  r.get('/admin/lookup', auth, staff, (req, res) => {
    const e = str(req.query.email, 160).toLowerCase(); if (!e) return res.json(null);
    const u = q1('SELECT id, name, email, role, phone, active, created FROM users WHERE email = ?', e);
    res.json(u ? { id: u.id, name: u.name, email: u.email, access: !!roleOf(u) } : null);
  });
  function addPerson(actor, b, gid) {
    const name = str(b.name, 120), email = str(b.email || b.username, 160).toLowerCase(), phone = str(b.phone, 40) || null;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`البريد غير صالح: «${email || name}»`);
    let u = q1('SELECT id, name, email, role FROM users WHERE email = ?', email), password = null, existing = !!u;
    if (!u) {
      if (!name) throw new Error('الاسم مطلوب للحساب الجديد');
      password = b.password && String(b.password).length >= 10 ? String(b.password) : genPass();
      const id = uid();
      run('INSERT INTO users (id,name,email,pass,role,phone,created) VALUES (?,?,?,?,?,?,?)', id, name, email, bcrypt.hashSync(password, 12), 'student', phone, now());
      u = { id, name, email, role: 'student' };
      audit(actor.id, 'user_created', `${email}`);
    }
    if (b.role === 'trainer' && actor.role === 'admin') run('INSERT OR IGNORE INTO cls_staff (user_id, role, created) VALUES (?,?,?)', u.id, 'trainer', now());
    else if (u.role !== 'admin') grantAccess(u.id);
    if (b.org) run('INSERT INTO cls_profile (user_id, org) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET org = excluded.org', u.id, str(b.org, 120));
    if (gid && canGroup(actor, gid)) run('INSERT OR IGNORE INTO cls_members (group_id, user_id) VALUES (?,?)', gid, u.id);
    audit(actor.id, 'access_granted', `${email} → ${gid || '-'}`);
    return { id: u.id, username: email, name: u.name, password, existing };
  }
  r.post('/admin/users', auth, staff, (req, res) => {
    const gid = +(req.body.group_id || 0) || null;
    if (req.user.role !== 'admin' && !gid) return bad(res, 'اختر مجموعة للمتدرّب');
    try { res.json(tx(() => addPerson(req.user, req.body || {}, gid))); } catch (e) { bad(res, e.message); }
  });
  r.post('/admin/users/bulk', auth, staff, (req, res) => {
    const gid = +req.body.group_id || null;
    if (gid && !canGroup(req.user, gid)) return bad(res, 'غير مسموح', 403);
    if (!gid && req.user.role !== 'admin') return bad(res, 'اختر مجموعة');
    const created = [], errors = [];
    (Array.isArray(req.body.rows) ? req.body.rows.slice(0, 1000) : []).forEach((row, i) => {
      try { created.push(tx(() => addPerson(req.user, { ...row, role: 'trainee' }, gid))); } catch (e) { errors.push({ row: i + 1, error: e.message }); }
    });
    res.json({ created, errors });
  });
  r.get('/admin/users/:id', auth, staff, (req, res) => {
    const id = req.params.id; if (!canUser(req.user, id)) return bad(res, 'غير مسموح', 403);
    const u = userRow(id); if (!u) return bad(res, 'غير موجود', 404);
    const p = q1('SELECT summary, updated FROM cls_progress WHERE user_id = ?', id);
    res.json({ user: pub(u), groups: userGroups(id), summary: J(p?.summary, {}), synced: p?.updated || null,
      attempts: qa('SELECT id, assignment_id, kind, ref, title, score, max, pct, dur, created FROM cls_attempts WHERE user_id = ? ORDER BY created DESC LIMIT 500', id), submissions: qa('SELECT id,activity_id,notes,status,feedback,created FROM cls_submissions WHERE user_id = ? ORDER BY created DESC LIMIT 300', id), assignments: assignmentsFor(id) });
  });
  r.get('/admin/attempts/:id', auth, staff, (req, res) => {
    const a = q1('SELECT * FROM cls_attempts WHERE id = ?', +req.params.id);
    if (!a || !canUser(req.user, a.user_id)) return bad(res, 'غير موجود', 404);
    res.json({ ...a, detail: J(a.detail) });
  });
  r.put('/admin/users/:id', auth, staff, (req, res) => {
    const id = req.params.id, b = req.body || {};
    if (!canUser(req.user, id)) return bad(res, 'غير مسموح', 403);
    const u = userRow(id); if (!u) return bad(res, 'غير موجود', 404);
    const cur = roleOf(u);
    if (req.user.role !== 'admin' && cur !== 'trainee') return bad(res, 'غير مسموح', 403);
    tx(() => {
      if (b.name) run('UPDATE users SET name = ? WHERE id = ?', str(b.name, 120), id);
      if (b.phone !== undefined) run('UPDATE users SET phone = ? WHERE id = ?', str(b.phone, 40) || null, id);
      if (b.org !== undefined || b.notes !== undefined) run(`INSERT INTO cls_profile (user_id, org, notes) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET org = COALESCE(excluded.org, org), notes = COALESCE(excluded.notes, notes)`, id, b.org !== undefined ? str(b.org, 120) : null, b.notes !== undefined ? str(b.notes, 500) : null);
      if (req.user.role === 'admin' && u.role !== 'admin' && (b.role === 'trainer' || b.role === 'trainee')) {
        if (b.role === 'trainer') run('INSERT OR IGNORE INTO cls_staff (user_id, role, created) VALUES (?,?,?)', id, 'trainer', now());
        else { run('DELETE FROM cls_staff WHERE user_id = ?', id); grantAccess(id); }
      }
      if (b.active != null && u.role !== 'admin') { if (b.active) grantAccess(id); else revokeAccess(id); }
      if (Array.isArray(b.groups)) {
        const mine = groupIdsFor(req.user);
        for (const g of mine) run('DELETE FROM cls_members WHERE group_id = ? AND user_id = ?', g, id);
        for (const g of b.groups.map(Number)) if (mine.includes(g)) run('INSERT OR IGNORE INTO cls_members (group_id, user_id) VALUES (?,?)', g, id);
      }
    });
    audit(req.user.id, 'user_updated', u.email);
    res.json({ ok: true });
  });
  r.post('/admin/users/:id/reset', auth, staff, (req, res) => {
    const id = req.params.id; if (!canUser(req.user, id)) return bad(res, 'غير مسموح', 403);
    const u = userRow(id); if (!u || u.role === 'admin' || (req.user.role !== 'admin' && roleOf(u) !== 'trainee')) return bad(res, 'غير مسموح', 403);
    const password = genPass();
    run('UPDATE users SET pass = ? WHERE id = ?', bcrypt.hashSync(password, 12), id);
    audit(req.user.id, 'password_reset', u.email);
    res.json({ password });
  });
  // remove from classroom: revoke hidden package + memberships (the AL-LTC account itself is kept)
  r.delete('/admin/users/:id', auth, adminOnly, (req, res) => {
    const id = req.params.id; if (id === req.user.id) return bad(res, 'لا يمكنك إزالة نفسك');
    tx(() => { revokeAccess(id); run('DELETE FROM cls_members WHERE user_id = ?', id); run('DELETE FROM cls_staff WHERE user_id = ?', id); });
    audit(req.user.id, 'access_revoked', id);
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------- staff: groups
  r.get('/admin/groups', auth, staff, (req, res) => {
    const g = groupIdsFor(req.user);
    res.json(qa(`SELECT g.*, u.name AS trainer, (SELECT COUNT(*) FROM cls_members m WHERE m.group_id = g.id) AS n FROM cls_groups g LEFT JOIN users u ON u.id = g.trainer_id WHERE g.id IN (${inList(g)}) ORDER BY g.active DESC, g.created DESC`, ...g));
  });
  r.post('/admin/groups', auth, staff, (req, res) => {
    const b = req.body || {}, name = str(b.name, 120); if (!name) return bad(res, 'اسم المجموعة مطلوب');
    const trainer = req.user.role === 'admin' && b.trainer_id ? String(b.trainer_id) : req.user.id;
    const x = run('INSERT INTO cls_groups (name, course, start_date, end_date, trainer_id, notes, created) VALUES (?,?,?,?,?,?,?)', name, str(b.course, 40) || 'PMI-RMP', str(b.start_date, 10) || null, str(b.end_date, 10) || null, trainer, str(b.notes, 500) || null, now());
    audit(req.user.id, 'group_created', name);
    res.json({ id: Number(x.lastInsertRowid) });
  });
  r.put('/admin/groups/:id', auth, staff, (req, res) => {
    const id = +req.params.id, b = req.body || {}; if (!canGroup(req.user, id)) return bad(res, 'غير مسموح', 403);
    const g = q1('SELECT * FROM cls_groups WHERE id = ?', id);
    run('UPDATE cls_groups SET name=?, course=?, start_date=?, end_date=?, trainer_id=?, active=?, notes=? WHERE id=?',
      str(b.name ?? g.name, 120) || g.name, str(b.course ?? g.course, 40) || g.course, b.start_date !== undefined ? (str(b.start_date, 10) || null) : g.start_date, b.end_date !== undefined ? (str(b.end_date, 10) || null) : g.end_date,
      req.user.role === 'admin' && b.trainer_id !== undefined ? (String(b.trainer_id) || null) : g.trainer_id, b.active == null ? g.active : (b.active ? 1 : 0), b.notes !== undefined ? (str(b.notes, 500) || null) : g.notes, id);
    res.json({ ok: true });
  });
  r.delete('/admin/groups/:id', auth, staff, (req, res) => {
    const id = +req.params.id; if (!canGroup(req.user, id)) return bad(res, 'غير مسموح', 403);
    tx(() => { run("DELETE FROM cls_assignments WHERE target_type='group' AND target_id = ?", String(id)); run('DELETE FROM cls_members WHERE group_id = ?', id); run('DELETE FROM cls_groups WHERE id = ?', id); });
    audit(req.user.id, 'group_deleted', id);
    res.json({ ok: true });
  });
  r.post('/admin/groups/:id/members', auth, staff, (req, res) => {
    const id = +req.params.id; if (!canGroup(req.user, id)) return bad(res, 'غير مسموح', 403);
    tx(() => {
      for (const u of [].concat(req.body.add || []).map(String)) if (req.user.role === 'admin' || canUser(req.user, u)) run('INSERT OR IGNORE INTO cls_members (group_id, user_id) VALUES (?,?)', id, u);
      for (const u of [].concat(req.body.remove || []).map(String)) run('DELETE FROM cls_members WHERE group_id = ? AND user_id = ?', id, u);
    });
    res.json({ ok: true });
  });
  r.get('/admin/groups/:id/report', auth, staff, (req, res) => {
    const id = +req.params.id; if (!canGroup(req.user, id)) return bad(res, 'غير مسموح', 403);
    const g = q1('SELECT g.*, u.name AS trainer FROM cls_groups g LEFT JOIN users u ON u.id = g.trainer_id WHERE g.id = ?', id);
    const mem = qa(`SELECT u.id, u.name, u.email AS username, u.active FROM cls_members m JOIN users u ON u.id = m.user_id WHERE m.group_id = ? AND u.role <> 'admin' AND u.id NOT IN (SELECT user_id FROM cls_staff) ORDER BY u.name`, id)
      .map(m => ({ ...m, last_seen: seen(m.id), active: hasAccess(m.id) ? 1 : 0 }));
    const MI = mem.map(m => m.id);
    const asg = qa(`SELECT * FROM cls_assignments WHERE active = 1 AND ((target_type='group' AND target_id = ?) OR (target_type='user' AND target_id IN (${inList(MI)}))) ORDER BY COALESCE(day,99), created`, String(id), ...MI);
    const cells = {};
    for (const a of asg) for (const m of mem) {
      if (a.target_type === 'user' && a.target_id !== m.id) continue;
      const c = q1('SELECT MAX(pct) best, COUNT(*) n FROM cls_attempts WHERE user_id = ? AND assignment_id = ?', m.id, a.id);
      cells[`${m.id}:${a.id}`] = { best: c.best, n: c.n };
    }
    const rows = mem.map(m => { const at = q1("SELECT COUNT(*) n, ROUND(AVG(CASE WHEN kind='exam' THEN pct END),1) ex, ROUND(AVG(CASE WHEN kind='game' THEN pct END),1) gm, COALESCE(SUM(CASE WHEN kind IN ('game','live') THEN score END),0) pts FROM cls_attempts WHERE user_id = ?", m.id);
      return { ...m, summary: summ(m.id), attempts: at.n, exam_avg: at.ex, game_avg: at.gm, points: Math.round(at.pts) }; });
    const byDomain = [1, 2, 3, 4, 5].map(d => { const xs = rows.map(x => x.summary?.byD?.[d]).filter(x => x && x[1]); const ok = xs.reduce((a, x) => a + x[0], 0), n = xs.reduce((a, x) => a + x[1], 0); return n ? Math.round(ok / n * 100) : null; });
    res.json({ group: g, members: rows, assignments: asg.map(a => ({ ...a, settings: J(a.settings, {}) })), cells, byDomain, leaderboard: leaderboard(id, 0).slice(0, 10) });
  });

  // ---------------------------------------------------------------- staff: assignments
  r.get('/admin/assignments', auth, staff, (req, res) => {
    const g = groupIdsFor(req.user).map(String), T = traineeIdsFor(req.user);
    res.json(qa(`SELECT a.*, CASE WHEN a.target_type='group' THEN (SELECT name FROM cls_groups WHERE id = CAST(a.target_id AS INTEGER)) ELSE (SELECT name FROM users WHERE id = a.target_id) END AS target_name
      FROM cls_assignments a WHERE (a.target_type='group' AND a.target_id IN (${inList(g)})) OR (a.target_type='user' AND a.target_id IN (${inList(T)})) ORDER BY a.created DESC`, ...g, ...T).map(a => {
      const tg = a.target_type === 'group' ? qa('SELECT user_id FROM cls_members WHERE group_id = ?', +a.target_id).map(x => x.user_id) : [a.target_id];
      const d = tg.length ? q1(`SELECT COUNT(DISTINCT user_id) c, ROUND(AVG(pct),1) avg FROM cls_attempts WHERE assignment_id = ? AND user_id IN (${inList(tg)})`, a.id, ...tg) : { c: 0, avg: null };
      return { ...a, target_id: a.target_type === 'group' ? +a.target_id : a.target_id, settings: J(a.settings, {}), targets: tg.length, done: d.c, avg: d.avg };
    }));
  });
  r.post('/admin/assignments', auth, staff, (req, res) => {
    const b = req.body || {}, kind = str(b.kind, 20), ref = str(b.ref, 120), title = str(b.title, 200);
    if (!['game', 'exam', 'lesson', 'activity'].includes(kind) || !ref || !title) return bad(res, 'النوع والمحتوى والعنوان مطلوبة');
    const targets = [].concat(b.targets || []).map(t => ({ type: t.type === 'user' ? 'user' : 'group', id: String(t.id || '') })).filter(t => t.id);
    if (!targets.length) return bad(res, 'اختر مجموعة أو متدرّبًا');
    for (const t of targets) if (t.type === 'group' ? !canGroup(req.user, +t.id) : !canUser(req.user, t.id)) return bad(res, 'هدف غير مسموح', 403);
    const ids = tx(() => targets.map(t => Number(run('INSERT INTO cls_assignments (kind, ref, title, target_type, target_id, day, open_at, due_at, settings, note, created_by, created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      kind, ref, title, t.type, t.id, +b.day || null, +b.open_at || null, +b.due_at || null, JSON.stringify(b.settings || {}), str(b.note, 500) || null, req.user.id, now()).lastInsertRowid)));
    audit(req.user.id, 'assignment_created', `${title} → ${targets.length}`);
    res.json({ ids });
  });
  const ownAsg = (u, id) => { const a = q1('SELECT * FROM cls_assignments WHERE id = ?', id); if (!a) return null; return (a.target_type === 'group' ? canGroup(u, +a.target_id) : canUser(u, a.target_id)) ? a : null; };
  r.put('/admin/assignments/:id', auth, staff, (req, res) => {
    const a = ownAsg(req.user, +req.params.id), b = req.body || {}; if (!a) return bad(res, 'غير موجود', 404);
    run('UPDATE cls_assignments SET title=?, day=?, open_at=?, due_at=?, settings=?, note=?, active=? WHERE id=?', str(b.title ?? a.title, 200) || a.title, b.day !== undefined ? (+b.day || null) : a.day,
      b.open_at !== undefined ? (+b.open_at || null) : a.open_at, b.due_at !== undefined ? (+b.due_at || null) : a.due_at, b.settings ? JSON.stringify(b.settings) : a.settings, b.note !== undefined ? (str(b.note, 500) || null) : a.note, b.active == null ? a.active : (b.active ? 1 : 0), a.id);
    res.json({ ok: true });
  });
  r.delete('/admin/assignments/:id', auth, staff, (req, res) => { const a = ownAsg(req.user, +req.params.id); if (!a) return bad(res, 'غير موجود', 404); run('DELETE FROM cls_assignments WHERE id = ?', a.id); res.json({ ok: true }); });

  // ---------------------------------------------------------------- notices
  r.post('/admin/notices', auth, staff, (req, res) => {
    const b = req.body || {}, text = str(b.text, 1000), type = ['all', 'group', 'user'].includes(b.target_type) ? b.target_type : 'group';
    if (!text) return bad(res, 'اكتب نص الإعلان');
    if (type === 'all' && req.user.role !== 'admin') return bad(res, 'غير مسموح', 403);
    if (type === 'group' && !canGroup(req.user, +b.target_id)) return bad(res, 'غير مسموح', 403);
    if (type === 'user' && !canUser(req.user, String(b.target_id))) return bad(res, 'غير مسموح', 403);
    run('INSERT INTO cls_notices (target_type, target_id, text, created_by, created) VALUES (?,?,?,?,?)', type, b.target_id != null ? String(b.target_id) : null, text, req.user.id, now());
    res.json({ ok: true });
  });
  r.get('/admin/notices', auth, staff, (req, res) => res.json(qa(`SELECT n.*, CASE n.target_type WHEN 'group' THEN (SELECT name FROM cls_groups WHERE id = CAST(n.target_id AS INTEGER)) WHEN 'user' THEN (SELECT name FROM users WHERE id = n.target_id) ELSE 'الجميع' END AS target_name FROM cls_notices n ${req.user.role === 'admin' ? '' : 'WHERE n.created_by = ?'} ORDER BY n.created DESC LIMIT 100`, ...(req.user.role === 'admin' ? [] : [req.user.id]))));
  r.delete('/admin/notices/:id', auth, staff, (req, res) => { if (req.user.role === 'admin') run('DELETE FROM cls_notices WHERE id = ?', +req.params.id); else run('DELETE FROM cls_notices WHERE id = ? AND created_by = ?', +req.params.id, req.user.id); res.json({ ok: true }); });

  // ---------------------------------------------------------------- exports / audit / backup
  const csv = rows => '﻿' + rows.map(x => x.map(v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
  const fmt = t => t ? new Date(t + 3 * 3600e3).toISOString().replace('T', ' ').slice(0, 16) : '';
  const scopeIds = (req) => { const gids = groupIdsFor(req.user), gid = +req.query.group || null; const G = gid && gids.includes(gid) ? [gid] : gids; return qa(`SELECT DISTINCT user_id FROM cls_members WHERE group_id IN (${inList(G)})`, ...G).map(x => x.user_id); };
  r.get('/admin/export/results.csv', auth, staff, (req, res) => {
    const U = scopeIds(req);
    const rows = qa(`SELECT a.*, u.name, u.email FROM cls_attempts a JOIN users u ON u.id = a.user_id WHERE a.user_id IN (${inList(U)}) ORDER BY a.created`, ...U);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="results.csv"');
    res.send(csv([['التاريخ', 'المتدرب', 'البريد', 'النوع', 'العنوان', 'الدرجة', 'من', 'النسبة %', 'المدة (ث)'], ...rows.map(x => [fmt(x.created), x.name, x.email, x.kind, x.title, x.score, x.max, x.pct, x.dur])]));
  });
  r.get('/admin/export/trainees.csv', auth, staff, (req, res) => {
    const U = scopeIds(req);
    const us = qa(`SELECT id, name, email, phone FROM users WHERE id IN (${inList(U)}) AND id NOT IN (SELECT user_id FROM cls_staff) ORDER BY name`, ...U);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="trainees.csv"');
    res.send(csv([['الاسم', 'البريد', 'الجوال', 'الجهة', 'الجاهزية %', 'الدروس المكتملة', 'الأسئلة المُجابة', 'الدقة %', 'متوسط الاختبارات %', 'متوسط الألعاب %', 'آخر دخول'],
      ...us.map(u => { const s = summ(u.id), a = q1("SELECT ROUND(AVG(CASE WHEN kind='exam' THEN pct END),1) ex, ROUND(AVG(CASE WHEN kind='game' THEN pct END),1) gm FROM cls_attempts WHERE user_id = ?", u.id); return [u.name, u.email, u.phone, prof(u.id).org, s.readiness, s.lessons, s.answered, s.accuracy, a.ex, a.gm, fmt(seen(u.id))]; })]));
  });
  r.get('/admin/audit', auth, adminOnly, (req, res) => res.json(qa('SELECT a.*, u.name FROM cls_audit a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 300')));
  r.get('/admin/backup', auth, adminOnly, (req, res) => {
    const out = { package: CLASSROOM_PACKAGE, exported: new Date().toISOString() };
    for (const t of ['cls_staff', 'cls_profile', 'cls_groups', 'cls_members', 'cls_assignments', 'cls_attempts', 'cls_progress', 'cls_notices', 'cls_live', 'cls_live_answers', 'cls_content', 'cls_submissions', 'cls_audit']) out[t] = qa(`SELECT * FROM ${t}`);
    out.enrollments = qa('SELECT * FROM enrollments WHERE package_id = ?', CLASSROOM_PACKAGE);
    res.setHeader('Content-Disposition', 'attachment; filename="classroom-backup.json"');
    res.json(out);
  });

  // ---------------------------------------------------------------- live classroom challenge
  const L = id => { const l = q1('SELECT * FROM cls_live WHERE id = ?', id); return l ? { ...l, qs: J(l.qs, []), state: J(l.state, {}) } : null; };
  const setSt = (id, st) => run('UPDATE cls_live SET state = ? WHERE id = ?', JSON.stringify(st), id);
  const board = id => qa('SELECT u.id, u.name, COALESCE(SUM(a.points),0) pts, SUM(a.correct) ok FROM cls_live_answers a JOIN users u ON u.id = a.user_id WHERE a.live_id = ? GROUP BY u.id ORDER BY pts DESC', id);
  r.post('/live', auth, staff, (req, res) => {
    const b = req.body || {};
    const qs = Array.isArray(b.qs) ? b.qs.slice(0, 40).map(q => ({ id: str(q.id, 40), c: [].concat(q.c || []).map(Number), n: +q.n || 4 })) : [];
    if (!qs.length) return bad(res, 'لا توجد أسئلة');
    const gid = +b.group_id || null; if (gid && !canGroup(req.user, gid)) return bad(res, 'غير مسموح', 403);
    const code = String(crypto.randomInt(100000, 999999));
    const st = { phase: 'lobby', i: -1, dur: Math.min(90, Math.max(10, +b.dur || 25)) * 1000, t0: 0, players: [] };
    const x = run('INSERT INTO cls_live (code, group_id, host_id, title, qs, state, created) VALUES (?,?,?,?,?,?,?)', code, gid, req.user.id, str(b.title, 120) || 'تحدٍّ مباشر', JSON.stringify(qs), JSON.stringify(st), now());
    res.json({ id: Number(x.lastInsertRowid), code });
  });
  r.post('/live/join', auth, (req, res) => {
    const l = q1('SELECT id, group_id FROM cls_live WHERE code = ? AND ended IS NULL ORDER BY id DESC LIMIT 1', str(req.body.code, 10));
    if (!l) return bad(res, 'رمز التحدي غير صحيح أو انتهى', 404);
    const X = L(l.id); if (!X.state.players.includes(req.user.id)) { X.state.players.push(req.user.id); setSt(l.id, X.state); }
    res.json({ id: l.id });
  });
  r.get('/live/:id', auth, (req, res) => {
    const X = L(+req.params.id); if (!X) return bad(res, 'غير موجود', 404);
    const host = X.host_id === req.user.id || req.user.role === 'admin', st = X.state, t = now();
    if (st.phase === 'q' && t - st.t0 > st.dur) { st.phase = 'reveal'; setSt(X.id, st); }
    const q = st.i >= 0 ? X.qs[st.i] : null;
    const out = { id: X.id, code: X.code, title: X.title, phase: st.phase, i: st.i, total: X.qs.length, dur: st.dur, remaining: st.phase === 'q' ? Math.max(0, st.dur - (t - st.t0)) : 0,
      qid: q?.id || null, n: q?.n || 0, answered: q ? q1('SELECT COUNT(*) c FROM cls_live_answers WHERE live_id = ? AND qi = ?', X.id, st.i).c : 0, players: st.players.length, host,
      mine: q ? (q1('SELECT choice, correct, points FROM cls_live_answers WHERE live_id = ? AND qi = ? AND user_id = ?', X.id, st.i, req.user.id) || null) : null, ended: !!X.ended };
    if (st.phase === 'reveal' || st.phase === 'end') { out.correct = q?.c || []; if (q) out.dist = qa('SELECT choice, COUNT(*) c FROM cls_live_answers WHERE live_id = ? AND qi = ? GROUP BY choice', X.id, st.i); }
    if (st.phase !== 'q') out.board = board(X.id).slice(0, host ? 50 : 10).map((x, i) => ({ rank: i + 1, name: x.name, pts: x.pts, ok: x.ok, me: x.id === req.user.id }));
    if (host) out.names = qa(`SELECT name FROM users WHERE id IN (${inList(st.players)})`, ...st.players).map(x => x.name);
    res.json(out);
  });
  r.post('/live/:id/control', auth, (req, res) => {
    const X = L(+req.params.id); if (!X || (X.host_id !== req.user.id && req.user.role !== 'admin')) return bad(res, 'غير مسموح', 403);
    const st = X.state, act = req.body.action;
    if (act === 'next') { if (st.i + 1 >= X.qs.length) st.phase = 'end'; else { st.i++; st.phase = 'q'; st.t0 = now(); } }
    else if (act === 'reveal') st.phase = 'reveal'; else if (act === 'end') st.phase = 'end';
    setSt(X.id, st);
    if (st.phase === 'end' && !X.ended) {
      run('UPDATE cls_live SET ended = ? WHERE id = ?', now(), X.id);
      for (const b of board(X.id)) run('INSERT INTO cls_attempts (user_id, kind, ref, title, score, max, pct, dur, detail, created) VALUES (?,?,?,?,?,?,?,?,?,?)', b.id, 'live', 'live:' + X.id, X.title, b.pts, X.qs.length * 1000, Math.round((b.ok || 0) / X.qs.length * 1000) / 10, 0, JSON.stringify({ ok: b.ok, n: X.qs.length }), now());
    }
    res.json({ ok: true, phase: st.phase, i: st.i });
  });
  r.post('/live/:id/answer', auth, (req, res) => {
    const X = L(+req.params.id); if (!X) return bad(res, 'غير موجود', 404);
    const st = X.state, ms = now() - st.t0;
    if (st.phase !== 'q' || +req.body.i !== st.i) return bad(res, 'انتهى وقت هذا السؤال');
    if (ms > st.dur + 800) return bad(res, 'انتهى الوقت');
    const q = X.qs[st.i], ch = [].concat(req.body.choice ?? []).map(Number).sort();
    const ok = ch.length === q.c.length && [...q.c].sort().every((x, k) => x === ch[k]);
    const pts = ok ? Math.round(1000 * (1 - Math.min(ms, st.dur) / st.dur / 2)) : 0;
    try { run('INSERT INTO cls_live_answers (live_id, user_id, qi, choice, correct, ms, points) VALUES (?,?,?,?,?,?,?)', X.id, req.user.id, st.i, ch.join(','), ok ? 1 : 0, ms, pts); } catch { return bad(res, 'أجبت عن هذا السؤال'); }
    if (!st.players.includes(req.user.id)) { st.players.push(req.user.id); setSt(X.id, st); }
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------- AI (optional; uses the platform's existing keys if present)
  const aiHits = new Map();
  r.post('/ai', auth, async (req, res) => {
    const arr = (aiHits.get(req.user.id) || []).filter(t => now() - t < 60e3); if (arr.length >= 20) return bad(res, 'محاولات كثيرة', 429); arr.push(now()); aiHits.set(req.user.id, arr);
    const system = String(req.body?.system || '').slice(0, 6000), prompt = String(req.body?.prompt || '').slice(0, 16000), wantJson = !!req.body?.json;
    if (!prompt) return bad(res, 'empty prompt');
    const sys = system + (wantJson ? '\nReturn ONLY valid JSON, no prose, no code fences.' : '');
    try {
      let text = '';
      if (process.env.ANTHROPIC_API_KEY) {
        const x = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: process.env.CLASSROOM_AI_MODEL || 'claude-sonnet-5', max_tokens: 2000, system: sys, messages: [{ role: 'user', content: prompt }] }) });
        const j = await x.json(); if (!x.ok) throw new Error(j.error?.message || 'AI error');
        text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
      } else if (process.env.OPENAI_API_KEY) {
        const x = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
          body: JSON.stringify({ model: process.env.CLASSROOM_AI_MODEL || 'gpt-4o-mini', max_tokens: 2000, messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }] }) });
        const j = await x.json(); if (!x.ok) throw new Error(j.error?.message || 'AI error');
        text = j.choices?.[0]?.message?.content || '';
      } else return res.status(503).json({ error: 'AI key not configured' });
      if (wantJson) { let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim(); const i = t.indexOf('{'), k = t.lastIndexOf('}'); if (i >= 0) t = t.slice(i, k + 1); return res.json({ data: JSON.parse(t) }); }
      res.json({ text });
    } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
  });

  r.get('/health', (req, res) => res.json({ ok: true, package: CLASSROOM_PACKAGE }));
  r.use((req, res) => bad(res, 'not found', 404));
  r.use((err, req, res, next) => { console.error('[classroom]', err); bad(res, 'خطأ في الخادم', 500); });

  app.use('/classroom/api', r);
  // the page itself: /classroom and /classroom/ → public/classroom/index.html (served by express.static)
  app.get(['/classroom', '/classroom/', '/classroom/index.html'], (req, res) => {
    if (!req.originalUrl.split('?')[0].endsWith('/') && !req.originalUrl.includes('index.html')) return res.redirect(302, '/classroom/');
    res.setHeader('Cache-Control', 'no-cache'); res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.sendFile(path.join(HERE, 'public', 'classroom', 'index.html'));
  });
  console.log(`[classroom] mounted at /classroom (hidden package: ${CLASSROOM_PACKAGE})`);
}
