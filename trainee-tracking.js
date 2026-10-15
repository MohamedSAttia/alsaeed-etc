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
export function summarizeRecordedProgress(row, videoRows) {
  let data = null;
  try { const parsed = row && JSON.parse(row.data); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed; } catch {}
  const map = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const lessons = map(data?.lessons), weeks = map(data?.weeks), exams = Object.entries(map(data?.exams)).filter(([,x])=>x && typeof x === 'object');
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
    lastActivity: data && Number.isFinite(row?.updated) ? row.updated : null,
    activityDetails: data ? {chapters:[...groups.values()],lessons:lessonDone,lessonTotal,weeksDone:Object.values(weeks).filter(x=>x===true).length,activities:Object.values(map(data.activities)).filter(Boolean).length,downloads:Object.keys(map(data.downloads)).length,reports:Object.keys(map(data.applicationReports)).length,games:Object.keys(map(data.games)).length,exams:exams.map(([id,x])=>({id,score:score(x),passed:typeof x.passed==='boolean'?x.passed:null,at:Number(x.at)||0,total:Number(x.total||x.autoCount)||0}))} : null };
}
export function summarizeStudent(details) {
  const measured=details.filter(x=>Number.isFinite(x.progress));
  const total=measured.reduce((n,x)=>n+x.lessonTotal,0), done=measured.reduce((n,x)=>n+x.lessonDone,0);
  const count=details.reduce((n,x)=>n+x.examScoreCount,0), scores=details.reduce((n,x)=>n+x.examScoreTotal,0);
  return {progress:total?Math.round(done/total*100):null,avgExam:count?Math.round(scores/count*10)/10:null,measuredPackages:measured.length};
}
