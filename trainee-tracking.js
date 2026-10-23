import crypto from 'node:crypto';
// Read-only reporting. Missing/corrupt records are unknown, never fabricated progress.
export const DAY_MS = 86400000;
export function enrollmentTiming(enrollment, now) {
  const valid = x => Number.isFinite(x) && x > 0 && x <= 8640000000000000;
  const created = valid(enrollment.created) ? enrollment.created : null;
  const expires = enrollment.expires;
  const remainingDays = valid(expires) ? Math.max(0, Math.ceil((expires - now) / DAY_MS)) : null;
  const status = expires === null || expires === 0 ? 'unlimited' : !valid(expires) ? 'unknown' : expires <= now ? 'expired' : expires - now <= 7 * DAY_MS ? 'expiring' : 'active';
  return { daysEnrolled: created === null || created > now ? null : Math.floor((now - created) / DAY_MS), remainingDays, enrollmentStatus: status };
}
// Query only an existing scoped table. Reading reports never creates workspaces.
export function readRecordedExamAttempts(db, userId, packageId) {
  const table = packageId === (process.env.CLASSROOM_PACKAGE || 'rmp-private-classroom') ? 'cls_attempts' : 'ws_' + crypto.createHash('sha256').update(packageId).digest('hex').slice(0,16) + '_attempts';
  if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)) return [];
  return db.prepare(`SELECT id, ref, title, score, max, pct, created FROM ${table} WHERE user_id=? AND kind='exam' ORDER BY created DESC, id DESC`).all(userId);
}
export function readPracticeToolSummary(db,userId,packageId){
 if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pmp_practice_drafts'").get())return null;
 const row=db.prepare('SELECT COUNT(*) started,SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) completed,MAX(updated) latestAt FROM pmp_practice_drafts WHERE user_id=? AND package_id=?').get(userId,packageId);
 return row.started?{total:51,started:Number(row.started),completed:Number(row.completed||0),latestAt:Number(row.latestAt)||null}:null;
}
export function summarizeRecordedProgress(row, videoRows, attempts = [], practiceTools = null) {
  let data = null;
  try { const parsed = row && JSON.parse(row.data); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed; } catch {}
  const map = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const lessons = map(data?.lessons), weeks = map(data?.weeks);
  // Both the main runner and classroom runner persist attempts separately from the
  // debounced learning snapshot. Prefer the newest record for each assessment,
  // avoiding a double count of the same exam saved through both paths.
  const latest = new Map(Object.entries(map(data?.exams)).filter(([,x])=>x && typeof x === 'object'));
  const validAttempts = attempts.filter(x=>typeof x.ref==='string' && typeof x.pct==='number' && Number.isFinite(x.pct) && x.pct>=0 && x.pct<=100 && Number(x.max)>0);
  for (const a of validAttempts) {
    const previous=latest.get(a.ref), at=Number(a.created)||0;
    if (!previous || at >= (Number(previous.at)||0)) latest.set(a.ref,{score:a.pct,passed:a.pct>=70,at,total:Number(a.max),source:'attempt',attemptId:a.id,title:a.title});
  }
  const exams=[...latest.entries()];
  const score = x => typeof x.score === 'number' && Number.isFinite(x.score) && x.score >= 0 && x.score <= 100 ? x.score : null;
  const scores = exams.map(([,x])=>score(x)).filter(x=>x!==null);
  const lessonDone = videoRows.filter(l=>lessons[l.idx] === true).length, lessonTotal = videoRows.length;
  const groups = new Map();
  for (const l of videoRows) { const key=String(l.chapter??''); if(!groups.has(key))groups.set(key,{title:key||'المحتوى',done:0,total:0});const g=groups.get(key);g.total++;if(lessons[l.idx]===true)g.done++; }
  return { progress: data && lessonTotal ? Math.round(lessonDone/lessonTotal*100) : null,
    progressStatus: !data ? (row ? 'invalid' : 'unrecorded') : !lessonTotal ? 'no_video_curriculum' : 'recorded',
    avgExam: scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*10)/10 : null,
    examScoreTotal:scores.reduce((a,b)=>a+b,0), examScoreCount:scores.length,
    lessonDone: data ? lessonDone : null, lessonTotal, examsAttempted:exams.length,
    lastActivity: Math.max(data && Number.isFinite(row?.updated) ? row.updated : 0,...validAttempts.map(x=>Number(x.created)||0),Number(practiceTools?.latestAt)||0) || null,
    activityDetails: data || validAttempts.length || practiceTools ? {practiceTools,chapters:data ? [...groups.values()] : [],lessons:data ? lessonDone : null,lessonTotal,weeksDone:data ? Object.values(weeks).filter(x=>x===true).length : null,activities:data ? Object.values(map(data?.activities)).filter(Boolean).length : null,downloads:data ? Object.keys(map(data?.downloads)).length : null,reports:data ? Object.keys(map(data?.applicationReports)).length : null,games:data ? Object.keys(map(data?.games)).length : null,exams:exams.map(([id,x])=>({id,score:score(x),passed:typeof x.passed==='boolean'?x.passed:null,at:Number(x.at)||0,total:Number(x.total||x.autoCount)||0}))} : null };
}
export function summarizeStudent(details) {
  const measured=details.filter(x=>Number.isFinite(x.progress));
  const total=measured.reduce((n,x)=>n+x.lessonTotal,0), done=measured.reduce((n,x)=>n+x.lessonDone,0);
  const count=details.reduce((n,x)=>n+x.examScoreCount,0), scores=details.reduce((n,x)=>n+x.examScoreTotal,0);
  return {progress:total?Math.round(done/total*100):null,avgExam:count?Math.round(scores/count*10)/10:null,measuredPackages:measured.length};
}
