import crypto from 'node:crypto';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
export function practiceAttemptTable(pid){return pid===(process.env.CLASSROOM_PACKAGE||'rmp-private-classroom')?'cls_attempts':'ws_'+crypto.createHash('sha256').update(pid).digest('hex').slice(0,16)+'_attempts'}
// Use saved attempt outcomes, never re-grade historical answers against a changed bank.
// Favoriting is separate; wrong questions are not implicitly Golden.
export function recordedMistakes(attempts,availableIds){const latest=new Map(),seen=new Set();let untracked=0,tracked=0;
 for(const row of [...attempts].sort((a,b)=>a.created-b.created||a.id-b.id)){
  let detail;try{detail=JSON.parse(row.detail||'null')}catch{}if(!object(detail)||!Array.isArray(detail.questions)){untracked++;continue}
  const key=typeof detail.attemptKey==='string'&&detail.attemptKey?row.ref+':'+detail.attemptKey:null;if(key&&seen.has(key))continue;if(key)seen.add(key);
  let valid=false;const ids=new Set();for(const q of detail.questions){if(!object(q)||typeof q.id!=='string'||typeof q.correct!=='boolean'||ids.has(q.id))continue;ids.add(q.id);valid=true;latest.set(q.id,{correct:q.correct,at:row.created,attemptId:row.id})}if(valid)tracked++;else untracked++;
 }
 return {wrongIds:[...latest].filter(([id,outcome])=>!outcome.correct&&availableIds.has(id)).map(([id])=>id),history:{attempts:tracked,untracked},latest};
}
export function createPracticeState({db,getPackages,getQuestions,userFromToken,readJson,sendJson}){
 db.exec('CREATE TABLE IF NOT EXISTS learner_question_favorites(user_id TEXT NOT NULL,package_id TEXT NOT NULL,question_id TEXT NOT NULL,selected INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(user_id,package_id,question_id))');
 const hasDeleted=db.prepare('PRAGMA table_info(users)').all().some(c=>c.name==='deleted_at');
 const favorites=(uid,pid,ids)=>Object.fromEntries(db.prepare('SELECT question_id,selected,revision FROM learner_question_favorites WHERE user_id=? AND package_id=?').all(uid,pid).filter(r=>ids.has(r.question_id)).map(r=>[r.question_id,{selected:!!r.selected,revision:r.revision}]));
 return async(req,res,url)=>{let parts,pid;try{parts=url.pathname.slice('/api/practice-state/'.length).split('/');pid=decodeURIComponent(parts[0])}catch{return sendJson(res,400,{error:'Invalid package'})}
 const user=userFromToken(req);if(!user)return sendJson(res,401,{error:'Sign in required'});
 const account=db.prepare('SELECT active'+(hasDeleted?',deleted_at':'')+' FROM users WHERE id=?').get(user.id);if(!account||account.active!==1||account.deleted_at)return sendJson(res,403,{error:'Account unavailable'});
 if(!getPackages().some(p=>p.id===pid&&p.active!==false&&p.active!==0&&!p.deleted&&!p.deleted_at&&!p.deletedAt))return sendJson(res,404,{error:'Package unavailable'});
 const enrollment=db.prepare('SELECT expires FROM enrollments WHERE user_id=? AND package_id=?').get(user.id,pid);if(!enrollment||(enrollment.expires&&enrollment.expires<=Date.now()))return sendJson(res,403,{error:'Active enrollment required'});
 res.setHeader('Cache-Control','private, no-store');const ids=new Set(getQuestions(pid).map(q=>q.id));
 if(req.method==='GET'&&parts.length===1){const table=practiceAttemptTable(pid),exists=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table),attempts=exists?db.prepare(`SELECT id,ref,detail,created FROM ${table} WHERE user_id=? AND kind='exam' ORDER BY created,id`).all(user.id):[];const {wrongIds,history}=recordedMistakes(attempts,ids),map=favorites(user.id,pid,ids);return sendJson(res,200,{packageId:pid,wrongIds,favoriteIds:Object.keys(map).filter(id=>map[id].selected),favorites:map,history})}
 if(req.method!=='PUT'||parts.length!==2||parts[1]!=='favorite')return sendJson(res,404,{error:'Unknown practice route'});
 let body;try{body=await readJson(req);if(!object(body)||typeof body.questionId!=='string'||!ids.has(body.questionId)||typeof body.selected!=='boolean'||!Number.isInteger(body.expectedRevision)||body.expectedRevision<0)throw Error()}catch{return sendJson(res,400,{error:'Invalid question or favorite revision'})}
 let result,conflict=false;db.transaction(()=>{const old=db.prepare('SELECT selected,revision FROM learner_question_favorites WHERE user_id=? AND package_id=? AND question_id=?').get(user.id,pid,body.questionId);if((old?.revision||0)!==body.expectedRevision){conflict=true;result={questionId:body.questionId,selected:!!old?.selected,revision:old?.revision||0};return}const revision=(old?.revision||0)+1;db.prepare('INSERT INTO learner_question_favorites VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,package_id,question_id) DO UPDATE SET selected=excluded.selected,revision=excluded.revision,updated=excluded.updated').run(user.id,pid,body.questionId,body.selected?1:0,revision,Date.now());result={questionId:body.questionId,selected:body.selected,revision}})();const map=favorites(user.id,pid,ids);return sendJson(res,conflict?409:200,{favorite:result,favoriteIds:Object.keys(map).filter(id=>map[id].selected),...(conflict?{error:'Favorites changed on another device. Refresh before changing.'}:{})});
 };
}
