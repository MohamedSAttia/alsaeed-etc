// Public reviews are opt-in, independent of private instructor/coursework feedback.
export function mountCourseReviews({ app, db, auth, readList, now = Date.now }) {
  db.exec(`CREATE TABLE IF NOT EXISTS course_reviews (
    user_id TEXT NOT NULL, course_id TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    body TEXT NOT NULL DEFAULT '', display_name TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0,
    consent_at INTEGER NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL,
    PRIMARY KEY(user_id,course_id));
    CREATE INDEX IF NOT EXISTS course_reviews_public ON course_reviews(course_id,published,updated);`);
  const available = c => c && c.active !== false && c.active !== 0 && !c.deleted_at && !c.deletedAt && c.deleted !== true;
  const courseExists = id => readList('content_courses').some(c => c.id === id && available(c));
  const activeAccount = userId => {
    const deleted=db.prepare('PRAGMA table_info(users)').all().some(c=>c.name==='deleted_at');
    return !!db.prepare('SELECT id FROM users WHERE id=? AND active=1'+(deleted?' AND deleted_at IS NULL':'')).get(userId);
  };
  const eligible = (userId, id) => {
    if(!activeAccount(userId))return false;
    const packages = new Set(readList('content_packages').filter(p => p.course === id && available(p)).map(p => p.id));
    return db.prepare('SELECT package_id FROM enrollments WHERE user_id=? AND (expires IS NULL OR expires=0 OR expires>?)').all(userId,now()).some(e => packages.has(e.package_id));
  };
  const checkCourse = (req,res,next) => courseExists(req.params.course) ? next() : res.status(404).json({error:'الدورة غير موجودة · Course not found'});
  const publicData = id => {
    const summary = db.prepare('SELECT COUNT(*) AS count, AVG(rating) AS average FROM course_reviews WHERE course_id=? AND published=1').get(id);
    return {count:summary.count,average:summary.average === null ? null : Math.round(summary.average*100)/100,
      reviews:db.prepare('SELECT rating,body,display_name AS displayName,updated FROM course_reviews WHERE course_id=? AND published=1 ORDER BY updated DESC,user_id LIMIT 50').all(id),
      selection:'All voluntarily published learner ratings; newest 50 entries shown.'};
  };
  app.get('/api/course-reviews/:course',checkCourse,(req,res)=>{
    res.set('Cache-Control','no-store');res.json(publicData(req.params.course));
  });
  app.get('/api/course-reviews/:course/mine',auth,checkCourse,(req,res)=>{
    if(!activeAccount(req.user.id))return res.status(403).json({error:'Account unavailable'});
    res.set('Cache-Control','no-store');
    res.json({eligible:eligible(req.user.id,req.params.course),review:db.prepare('SELECT rating,body,display_name AS displayName,published FROM course_reviews WHERE user_id=? AND course_id=?').get(req.user.id,req.params.course)||null});
  });
  app.put('/api/course-reviews/:course',auth,checkCourse,(req,res)=>{
    if (!eligible(req.user.id,req.params.course)) return res.status(403).json({error:'يلزم اشتراك فعّال في الدورة · Active course enrollment required'});
    const {rating,body='',displayName='',publicConsent}=req.body||{};
    if(!Number.isInteger(rating)||rating<1||rating>5||typeof body!=='string'||body.length>2000||typeof displayName!=='string'||displayName.length>40)
      return res.status(400).json({error:'اختر 1–5 نجوم، تعليقًا حتى 2000 حرف واسم عرض حتى 40 حرفًا · Invalid review'});
    if(publicConsent!==true)return res.status(400).json({error:'الموافقة على النشر مطلوبة · Public sharing consent is required'});
    // No automatically copied account names, emails, or telephone numbers.
    const contactText=value=>value.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));
    if (/@|https?:|www\.|\d{5}|(?:\+?\d[\s().-]*){7,}/i.test(contactText(displayName)))return res.status(400).json({error:'استخدم اسم عرض دون معلومات اتصال · Use a display name without contact details'});
    if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\s().-]*){7,}/i.test(contactText(body))) return res.status(400).json({error:'لا تنشر بريدًا إلكترونيًا أو رقم هاتف · Do not publish email addresses or phone numbers'});
    const timestamp=now();
    const old=db.prepare('SELECT updated FROM course_reviews WHERE user_id=? AND course_id=?').get(req.user.id,req.params.course);
    if(old && timestamp-old.updated<10000)return res.status(429).json({error:'انتظر 10 ثوانٍ قبل التعديل · Wait 10 seconds before updating'});
    db.prepare(`INSERT INTO course_reviews(user_id,course_id,rating,body,display_name,published,consent_at,created,updated) VALUES(?,?,?,?,?,1,?,?,?)
      ON CONFLICT(user_id,course_id) DO UPDATE SET rating=excluded.rating,body=excluded.body,display_name=excluded.display_name,published=1,consent_at=excluded.consent_at,updated=excluded.updated`)
      .run(req.user.id,req.params.course,rating,body.trim(),displayName.trim()||'Learner / متدرب',timestamp,timestamp,timestamp);
    res.json({ok:true,...publicData(req.params.course)});
  });
  // Withdrawal is recoverable and remains possible after enrollment expires.
  app.delete('/api/course-reviews/:course',auth,(req,res)=>{
    if(!activeAccount(req.user.id))return res.status(403).json({error:'Account unavailable'});
    db.prepare('UPDATE course_reviews SET published=0 WHERE user_id=? AND course_id=?').run(req.user.id,req.params.course);
    res.json({ok:true});
  });
}
