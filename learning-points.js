import crypto from 'node:crypto';
import { readRecordedExamAttempts } from './trainee-tracking.js';
import { practiceCatalog } from './pmp-practice-tools.js';

const map=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
const json=(text,fallback={})=>{try{return JSON.parse(text)}catch{return fallback}};
export const POINT_RULES = Object.freeze({video:10,exam:20,reading:2,activity:5,simulation:10,tool:5,game:5});
const topicKeys=['intro','exam','value','principles','lifecycles','framework','agile','predictive','hybrid','governance','scope','schedule','cost','resources','risk','quality','procurement','stakeholders'];
const phases=['initiating','planning','executing','monitoring','closing'];
const domains=['people','process','business'];
const approaches=['agile','predictive','hybrid'];
function examKey(ref, chapters, lessonIds=new Set()){
 if(typeof ref!=='string'||ref.length>180)return null;
 if(/^mock_[1-5]$/.test(ref)||ref==='pmp-2026-full-180'||ref==='full'||ref==='practice')return ref;
 // Exact keys written by the original lesson/chapter runner. Never use a
 // substring or title match: a renamed chapter must not create extra awards.
 const lesson=ref.match(/^lesson(0|[1-9]\d*)$/);if(lesson&&lessonIds.has(lesson[1]))return ref;
 const chapter=ref.match(/^ch(0|[1-9]\d*)$/);if(chapter&&chapters.has(chapter[1]))return 'chapter_'+chapter[1];
 if(domains.some(x=>ref==='dom_'+x)||phases.some(x=>ref==='phase_'+x)||approaches.some(x=>ref==='approach_'+x))return ref;
 if(ref.startsWith('chapter_')&&chapters.has(ref.slice(8)))return ref;
 // Custom permutations are one award, not an inexhaustible source of points.
 const custom=ref.match(/^filtered_([^_]+)_([^_]+)_([^_]+)$/);
 if(custom&&['all',...topicKeys].includes(custom[1])&&['all',...approaches].includes(custom[2])&&['all',...phases].includes(custom[3]))return 'custom';
 return null;
}
export function createLearningPoints({db,getPackages,getLearning=()=>({}),library={},toolDefinitions={},now=Date.now}){
 db.exec(`CREATE TABLE IF NOT EXISTS learning_point_events(
 user_id TEXT NOT NULL,package_id TEXT NOT NULL,event_key TEXT NOT NULL,kind TEXT NOT NULL,
 points INTEGER NOT NULL CHECK(points>=0),recorded_at INTEGER NOT NULL,awarded_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,package_id,event_key));
 CREATE INDEX IF NOT EXISTS learning_point_package ON learning_point_events(package_id,user_id);`);
 const tableExists=name=>!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
 const hasUserDeleted=()=>db.prepare('PRAGMA table_info(users)').all().some(c=>c.name==='deleted_at');
 const user=id=>db.prepare('SELECT id,name,role,active,'+(hasUserDeleted()?'deleted_at':'NULL AS deleted_at')+' FROM users WHERE id=?').get(id);
 const pack=id=>getPackages().find(p=>p.id===id&&p.active!==false&&p.deleted!==true&&!p.deleted_at);
 const enrolled=(id,pid)=>{const e=db.prepare('SELECT expires FROM enrollments WHERE user_id=? AND package_id=?').get(id,pid);return !!e&&(!e.expires||e.expires>now())};
 const eligible=u=>!!u&&u.role==='student'&&u.active===1&&!u.deleted_at;
 const assertAccess=(uid,pid)=>{const u=user(uid);if(!u||u.active!==1||u.deleted_at)throw Object.assign(Error('Account unavailable'),{status:403});if(!pack(pid))throw Object.assign(Error('Package unavailable'),{status:404});if(u.role!=='admin'&&!enrolled(uid,pid))throw Object.assign(Error('Active package enrollment required'),{status:403});return u};
 function curriculum(pid){
  const p=pack(pid);if(!p)return null;const source=p.sourcePackageId&&pack(p.sourcePackageId)?p.sourcePackageId:pid;
  const publishedLessons=db.prepare("SELECT idx,chapter,vimeo FROM lessons WHERE package_id=? AND deleted_at IS NULL").all(source);
  const lessons=publishedLessons.filter(l=>String(l.vimeo||'').trim());
  const lessonIds=new Set(publishedLessons.map(l=>String(l.idx)));
  const chapters=new Set(publishedLessons.map(l=>String(l.chapter)));
  const walk=nodes=>{for(const x of nodes||[]){if(typeof x==='string'){chapters.add(x);continue;}if(!x||typeof x!=='object')continue;for(const k of ['key','id','assessmentKey'])if(x[k]!=null)chapters.add(String(x[k]));walk(x.children)}};
  walk(p._chapters||p.chapters);if(String(p.course).toLowerCase()==='pmp')for(const k of [...topicKeys,...phases,...domains])chapters.add(k);
  const courseData=getLearning()[p.course];
  // The application ships two default applied activities per original course.
  const core=Array.isArray(courseData?.activities)?courseData.activities:(['pmp','rmp','acp','grcp','p3o','pba','lss'].includes(p.course)?[{},{}]:[]);
  const isPmp=String(p.course).toLowerCase()==='pmp';
  const resources=isPmp?(library.resources||[]):[],activities=isPmp?[...(library.activities||[]),...(library.tasks||[])]:[];
  const simulations=isPmp?(library.simulations||[]):[];
  const tools=isPmp&&toolDefinitions.LIFE&&toolDefinitions.PROC?practiceCatalog(toolDefinitions):[];
  return {p,lessons,lessonIds,chapters,core:core.map((_,i)=>String(i)),resources,activities,simulations,tools};
 }
 function evidence(uid,pid,c=curriculum(pid)){
  const row=db.prepare('SELECT data,updated FROM progress WHERE user_id=? AND package_id=?').get(uid,pid);
  const parsed=row?json(row.data,null):{};
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Object.assign(Error('Saved progress is unreadable'),{code:'UNREADABLE_PROGRESS'});
  const data=parsed;
  const events=new Map(),stamp=Number(row?.updated)||0,add=(kind,id,at=stamp)=>events.set(kind+':'+id,{eventKey:kind+':'+id,kind,points:POINT_RULES[kind],recordedAt:Math.max(0,Math.min(now(),Number(at)||0))});
  const doneLessons=c.lessons.filter(l=>map(data.lessons)[l.idx]===true);
  for(const l of doneLessons)add('video',String(l.idx));
  const activity=map(data.activities);let activityDone=0;
  for(const id of c.core)if(activity[id]===true){add('activity','core:'+id);activityDone++}
  for(const item of c.resources)if(activity['ref:'+item.id]===true)add('reading',item.id);
  for(const item of c.activities)if(activity['ref:'+item.id]===true){add('activity','ref:'+item.id);activityDone++}
  for(const simulation of c.simulations){const state=map(map(data.referenceSimulations)[simulation.id]||(simulation.id===library.simulation?.id?data.referenceSimulation:null));if(state.completed===true&&Array.isArray(state.choices)&&state.choices.length===simulation.STEPS.length&&state.choices.every((x,i)=>Number.isInteger(x)&&x>=0&&x<simulation.STEPS[i].o.length)){add('simulation',simulation.id,state.updated);activityDone++}}
  if(c.tools.length&&tableExists('pmp_practice_drafts')){const allowed=new Set(c.tools.map(t=>t.id));for(const r of db.prepare('SELECT tool_id,completed,updated FROM pmp_practice_drafts WHERE user_id=? AND package_id=?').all(uid,pid))if(r.completed===1&&allowed.has(r.tool_id)){add('tool',r.tool_id,r.updated);activityDone++}}
  const sessions=tableExists('exam_sessions')?db.prepare("SELECT exam_code,result,finished FROM exam_sessions WHERE user_id=? AND package_id=? AND status='finished' AND exam_code='pmp-2026-full-180'").all(uid,pid).flatMap(r=>{const x=map(json(r.result));return Number.isFinite(x.correct)&&Number.isFinite(x.total)&&Number.isFinite(x.score)?[{ref:r.exam_code,score:x.correct,max:x.total,pct:x.score,created:r.finished}]:[]}):[];
  // Historical first-party progress was saved before workspace attempt tables.
  // It is participation evidence, not proof of a proctored or passing result.
  // Require the actual completed-result shape; never infer completion from a score alone.
  const historical=Object.entries(map(data.exams)).flatMap(([ref,x])=>{
   if(!x||typeof x!=='object'||!Number.isFinite(x.score)||x.score<0||x.score>100||!Number.isFinite(x.at)||x.at<=0||x.at>now()||x.pendingReview>0)return [];
   const count=x.total??x.autoCount;
   if(count!=null&&(!Number.isInteger(count)||count<=0))return [];
   if(count==null&&typeof x.passed!=='boolean')return [];
   return [{ref,pct:x.score,score:x.score,max:100,created:x.at,source:'saved-progress'}];
  });
  const attempts=[...readRecordedExamAttempts(db,uid,pid),...sessions,...historical].sort((a,b)=>(Number(b.created)||0)-(Number(a.created)||0)).filter(a=>Number.isFinite(a.pct)&&a.pct>=0&&a.pct<=100&&a.max>0&&a.score>=0&&a.score<=a.max);
  const exams=new Map();for(const a of attempts){const key=examKey(a.ref,c.chapters,c.lessonIds);if(key){if(!exams.has(key))exams.set(key,a);add('exam',key,a.created)}}
  const latest=[...exams.values()].sort((a,b)=>b.created-a.created)[0];
  const scopedTable=pid===(process.env.CLASSROOM_PACKAGE||'rmp-private-classroom')?'cls_attempts':'ws_'+crypto.createHash('sha256').update(pid).digest('hex').slice(0,16)+'_attempts';
  if(tableExists(scopedTable)){const game=db.prepare(`SELECT created,score,max FROM ${scopedTable} WHERE user_id=? AND kind='game' AND ref='game:package:1' ORDER BY created DESC LIMIT 1`).get(uid);if(game&&game.max>0&&game.score>=0&&game.score<=game.max)add('game','package',game.created)}
  const activityTotal=c.core.length+c.activities.length+c.simulations.length+c.tools.length;
  return {events:[...events.values()],summary:{video:{completed:doneLessons.length,total:c.lessons.length,percent:c.lessons.length?Math.round(doneLessons.length/c.lessons.length*100):null},activities:{completed:activityDone,total:activityTotal,percent:activityTotal?Math.round(activityDone/activityTotal*100):null},readings:{completed:c.resources.filter(x=>activity['ref:'+x.id]===true).length,total:c.resources.length},exams:{completed:exams.size,latestScore:latest?.pct??null},lastRecordedAt:stamp||null}};
 }
 function participants(pid){return db.prepare("SELECT DISTINCT u.id,u.name,u.role,u.active,"+(hasUserDeleted()?"u.deleted_at":"NULL AS deleted_at")+" FROM users u JOIN enrollments e ON e.user_id=u.id WHERE e.package_id=? AND u.role='student' AND u.active=1 "+(hasUserDeleted()?"AND u.deleted_at IS NULL ":"")+"AND (e.expires IS NULL OR e.expires=0 OR e.expires>?)").all(pid,now())}
 function syncUser(uid,pid){const u=user(uid);if(!u||u.active!==1||u.deleted_at||!pack(pid)||(u.role!=='admin'&&(!eligible(u)||!enrolled(uid,pid))))return;const c=curriculum(pid),put=db.prepare('INSERT OR IGNORE INTO learning_point_events VALUES(?,?,?,?,?,?,?)');db.transaction(()=>{for(const ev of evidence(uid,pid,c).events)put.run(uid,pid,ev.eventKey,ev.kind,ev.points,ev.recordedAt,now());})();}
 // A saved learning record remains successful if reconciliation needs a later retry.
 function afterSave(uid,pid){try{syncUser(uid,pid)}catch{console.error('[learning-points] reconciliation pending')}}
 function sync(pid){const c=curriculum(pid);if(!c)return;const put=db.prepare('INSERT OR IGNORE INTO learning_point_events VALUES(?,?,?,?,?,?,?)');db.transaction(()=>{for(const u of participants(pid)){
  let records;try{records=evidence(u.id,pid,c).events}catch(e){if(e.code==='UNREADABLE_PROGRESS')continue;throw e}
  for(const ev of records)put.run(u.id,pid,ev.eventKey,ev.kind,ev.points,ev.recordedAt,now());
 }})()}
 function measurableParticipants(pid){
  const people=participants(pid),rows=[];let partial=false;
  for(const p of people){const row=db.prepare('SELECT data FROM progress WHERE user_id=? AND package_id=?').get(p.id,pid);const data=row?json(row.data,null):{};
   if(!data||typeof data!=='object'||Array.isArray(data)){partial=true;continue}rows.push(p);
  }
  return {people:rows,partial};
 }
 const publicName=u=>{let name=String(u.name||'').trim();if(!name||/@/.test(name)||/^\+?[\d\s()-]{7,}$/.test(name))name='متدرب / Learner';return name.slice(0,100)};
 function ranks(rows,uid){const sorted=[...rows].sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name)||a.uid.localeCompare(b.uid));let rank=0,previous;const ranked=sorted.map((r,i)=>{if(previous!==r.points)rank=i+1;previous=r.points;return {name:r.name,points:r.points,rank,isMe:r.uid===uid}});return {total:ranked.length,self:ranked.find(x=>x.isMe)||null,leaders:ranked.slice(0,20)}}
 function snapshot(uid,pid){const u=assertAccess(uid,pid);
  // First load on any device reconciles saved evidence too, not just new saves.
  // Administrators retain private own totals but never enter trainee rankings.
  syncUser(uid,pid);const {people,partial}=measurableParticipants(pid);const totals=new Map(db.prepare('SELECT user_id,SUM(points) points FROM learning_point_events WHERE package_id=? GROUP BY user_id').all(pid).map(r=>[r.user_id,Number(r.points)]));const rows=people.map(p=>({uid:p.id,name:publicName(p),points:totals.get(p.id)||0}));let groups=[];let memberships=[];
  if(tableExists('admin_cohorts')&&tableExists('admin_cohort_members')){groups=db.prepare('SELECT id,name FROM admin_cohorts WHERE active=1').all();memberships=db.prepare('SELECT m.cohort_id,m.user_id FROM admin_cohort_members m JOIN admin_cohorts c ON c.id=m.cohort_id WHERE m.active=1 AND c.active=1').all()}
  const mine=groups.filter(g=>memberships.some(m=>m.cohort_id===g.id&&m.user_id===uid));const general=!mine.length;
  const ownGroups=general?[{id:'general',name:'المجموعة العامة / General group',...ranks(rows.filter(r=>!memberships.some(m=>m.user_id===r.uid)),uid)}]:mine.map(g=>({id:String(g.id),name:g.name,...ranks(rows.filter(r=>memberships.some(m=>m.cohort_id===g.id&&m.user_id===r.uid)),uid)}));
  const summary=evidence(uid,pid).summary;
  return {packageId:pid,rules:{version:2,points:POINT_RULES,ar:'نقاط المشاركة تُمنح مرة واحدة لكل عنصر منشور محفوظ. الفيديوهات والقراءات والأنشطة ذات إتمام يحدده المتدرب، وليست إثبات مشاهدة مراقبة أو درجة اعتماد. إعادة الاختبار والتحديث لا يضيفان نقاطًا. النقاط تراكمية، وقد تختلف عن نسبة الإكمال الحالية. درجات الاختبارات منفصلة عن الإكمال.',en:'Participation points are awarded once per saved published item. Video, reading and activity completion may be learner-declared, not proctored proof or certification grades. Repeating an assessment or reloading earns no extra points. Lifetime points may differ from current completion. Exam scores are separate from completion.'},self:{points:totals.get(uid)||0,eligible:eligible(u)&&enrolled(uid,pid),summary},groups:ownGroups,overall:ranks(rows,uid),rankingStatus:partial?'partial':'complete',scope:'package',serverNow:now()};
 }
 return {assertAccess,sync,syncUser,afterSave,snapshot,evidence,curriculum};
}
export function mountLearningPoints(options){const {app,auth}=options,store=createLearningPoints(options);const wrap=fn=>(req,res)=>{try{res.setHeader('Cache-Control','private, no-store');res.json(fn(req));}catch(e){res.status(e.status||500).json({error:e.status?e.message:'Unable to load learning points'})}};
 app.get('/api/learning-points/:pkg',auth,wrap(req=>store.snapshot(req.user.id,req.params.pkg)));
 app.post('/api/learning-points/:pkg/sync',auth,wrap(req=>{store.assertAccess(req.user.id,req.params.pkg);store.syncUser(req.user.id,req.params.pkg);store.sync(req.params.pkg);return store.snapshot(req.user.id,req.params.pkg)}));
 return store;
}
