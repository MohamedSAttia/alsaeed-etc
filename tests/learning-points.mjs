import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import express from 'express';
import {createLearningPoints,mountLearningPoints} from '../learning-points.js';
const pid='course';const attemptTable='ws_'+crypto.createHash('sha256').update(pid).digest('hex').slice(0,16)+'_attempts';
function fixture(){const db=new DatabaseSync(':memory:');db.transaction=fn=>(...args)=>{db.exec('BEGIN IMMEDIATE');try{const out=fn(...args);db.exec('COMMIT');return out}catch(e){db.exec('ROLLBACK');throw e}};db.exec(`
 CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,role TEXT,active INTEGER,deleted_at INTEGER,email TEXT,phone TEXT);
 INSERT INTO users VALUES('a','A','student',1,NULL,'private-a@example.test','123456789'),('b','B','student',1,NULL,'private-b@example.test','222222222'),('c','C','student',1,NULL,'private-c@example.test','333333333'),('off','Hidden','student',0,NULL,'hidden@example.test','444444444'),('deleted','Gone','student',1,1,'gone@example.test','555555555'),('teacher','Teacher','admin',1,NULL,'admin@example.test','666666666'),('expired','Expired','student',1,NULL,'exp@example.test','777777777'),('other','Other package','student',1,NULL,'other@example.test','888888888');
 CREATE TABLE enrollments(user_id TEXT,package_id TEXT,expires INTEGER);
 INSERT INTO enrollments VALUES('a','course',NULL),('b','course',NULL),('c','course',NULL),('off','course',NULL),('deleted','course',NULL),('expired','course',1),('other','elsewhere',NULL);
 CREATE TABLE progress(user_id TEXT,package_id TEXT,data TEXT,updated INTEGER,PRIMARY KEY(user_id,package_id));
 CREATE TABLE lessons(package_id TEXT,idx INTEGER,chapter TEXT,vimeo TEXT,deleted_at INTEGER);
 INSERT INTO lessons VALUES('course',0,'framework','123',NULL),('course',1,'agile','124',NULL),('course',2,'framework','125',1),('course',3,'framework','',NULL),('elsewhere',99,'framework','777',NULL);
 CREATE TABLE ${attemptTable}(id TEXT,user_id TEXT,kind TEXT,ref TEXT,title TEXT,score REAL,max REAL,pct REAL,created INTEGER);
 CREATE TABLE admin_cohorts(id INTEGER PRIMARY KEY,name TEXT,active INTEGER);
 INSERT INTO admin_cohorts VALUES(1,'Group 1',1),(2,'Group 2',1),(3,'Archived',0);
 CREATE TABLE admin_cohort_members(cohort_id INTEGER,user_id TEXT,active INTEGER);
 INSERT INTO admin_cohort_members VALUES(1,'a',1),(1,'b',1),(2,'a',1),(3,'c',1),(1,'off',1);
 CREATE TABLE pmp_practice_drafts(user_id TEXT,package_id TEXT,tool_id TEXT,completed INTEGER,updated INTEGER);
 `);const library={resources:[{id:'reading'}],activities:[{id:'workshop'}],tasks:[{id:'task'}],simulations:[{id:'simulation',STEPS:[{o:[{},{}]},{o:[{},{}]}]}]};const options={db,getPackages:()=>[{id:'course',course:'pmp',active:true},{id:'elsewhere',course:'rmp',active:true}],getLearning:()=>({pmp:{activities:[{}]}}),library,toolDefinitions:{LIFE:[{k:'need',t:['حاجة','Need']}],PROC:{L:[]}},now:()=>100000};return {db,options,store:createLearningPoints(options)}}
const save=(db,id,data)=>db.prepare('INSERT INTO progress VALUES(?,?,?,?) ON CONFLICT(user_id,package_id) DO UPDATE SET data=excluded.data,updated=excluded.updated').run(id,pid,JSON.stringify(data),500);
const attempt=(db,{id='e1',user='a',ref='mock_1',kind='exam',score=69,max=100,pct=69,created=1000}={})=>db.prepare(`INSERT INTO ${attemptTable} VALUES(?,?,?,?,?,?,?,?,?)`).run(id,user,kind,ref,'Exam',score,max,pct,created);
test('fixed points derive saved eligible content only; repeats, replays, forged keys or score objects cannot farm',()=>{const {db,store}=fixture();save(db,'a',{lessons:{0:true,2:true,3:true,999:true},activities:{0:true,99:true,'ref:reading':true,'ref:workshop':true,'ref:fake':true,'ref:simulation':true},exams:{fake:{score:100}},referenceSimulations:{simulation:{completed:true,choices:[0,1],updated:600}}});db.prepare('INSERT INTO pmp_practice_drafts VALUES(?,?,?,?,?)').run('a',pid,'life:need',1,700);db.prepare('INSERT INTO pmp_practice_drafts VALUES(?,?,?,?,?)').run('a',pid,'madeup',1,700);attempt(db);attempt(db,{id:'retry',created:1500,score:100,pct:100});attempt(db,{id:'fake',ref:'mock_999'});attempt(db,{id:'custom',ref:'filtered_all_all_all'});attempt(db,{id:'custom2',ref:'filtered_fake_fake_fake'});store.sync(pid);const first=store.snapshot('a',pid);assert.equal(first.self.points,77);assert.equal(first.self.summary.video.percent,50);assert.equal(first.self.summary.activities.completed,4);assert.equal(first.self.summary.exams.completed,2);assert.equal(first.self.summary.exams.latestScore,100);for(let i=0;i<20;i++)store.sync(pid);assert.equal(store.snapshot('a',pid).self.points,77);assert.equal(db.prepare('SELECT COUNT(*) n FROM learning_point_events').get().n,8);save(db,'a',{lessons:{0:false}});store.sync(pid);assert.equal(store.snapshot('a',pid).self.points,77,'lifetime participation is not uncheck/recheck farm');assert.equal(store.snapshot('a',pid).self.summary.video.percent,0);db.close()});
test('group membership and General are current virtual views, ties fair and overall never double-counts',()=>{const {db,store}=fixture();for(const id of ['a','b','c','off','deleted','expired','other'])save(db,id,{lessons:{0:true}});store.sync(pid);let a=store.snapshot('a',pid);assert.equal(a.overall.total,3);assert.deepEqual(a.overall.leaders.map(x=>x.rank),[1,1,1]);assert.equal(a.groups.length,2);assert.equal(a.groups[0].total,2);assert.equal(a.groups[1].total,1);const c=store.snapshot('c',pid);assert.equal(c.groups[0].id,'general');assert.equal(c.groups[0].total,1);db.prepare('UPDATE admin_cohorts SET active=0 WHERE id=1').run();a=store.snapshot('a',pid);assert.equal(a.groups.length,1);assert.equal(store.snapshot('b',pid).groups[0].id,'general');assert.equal(db.prepare('SELECT COUNT(*) n FROM enrollments').get().n,7);assert.equal(db.prepare('SELECT COUNT(*) n FROM admin_cohort_members').get().n,5);const payload=JSON.stringify(a);for(const needle of ['private-','example.test','123456789','user_id','email','phone','Other package','Gone','Hidden'])assert.ok(!payload.includes(needle),needle);db.close()});
test('first GET reconciles known saved evidence but never trusts unknown lesson/tool IDs or malformed simulation path',()=>{const {db,store}=fixture();save(db,'a',{lessons:{0:true},activities:{'ref:simulation':true},referenceSimulations:{simulation:{completed:true,choices:[99,1]}}});let snapshot=store.snapshot('a',pid);assert.equal(snapshot.self.points,10);assert.equal(snapshot.self.summary.video.completed,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM learning_point_events').get().n,1);store.sync(pid);assert.equal(store.snapshot('a',pid).self.points,10);for(const user of ['off','deleted','expired','other'])assert.throws(()=>store.snapshot(user,pid),e=>e.status===403);assert.throws(()=>store.snapshot('a','missing'),e=>e.status===404);db.close()});
test('fresh device returns same rank and completion; scores remain separate and zero score is real',()=>{const {db,store,options}=fixture();save(db,'a',{lessons:{0:true}});attempt(db,{score:0,pct:0});store.sync(pid);const first=store.snapshot('a',pid),fresh=createLearningPoints(options).snapshot('a',pid);assert.deepEqual(first,fresh);assert.equal(fresh.self.summary.video.percent,50);assert.equal(fresh.self.summary.exams.latestScore,0);assert.equal(fresh.self.points,30);db.close()});
test('HTTP owner identity, current role/activity, package entitlement, no-store and concurrent retries',async()=>{const {db,options}=fixture(),app=express();app.use(express.json());const auth=(req,res,next)=>{req.user=db.prepare('SELECT * FROM users WHERE id=?').get(req.headers['x-user']);if(!req.user)return res.status(401).end();next()};mountLearningPoints({...options,app,auth});save(db,'a',{lessons:{0:true}});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;try{for(const uid of ['', 'off','deleted','expired','other']){const response=await fetch(base+'/api/learning-points/course/sync',{method:'POST',headers:{'x-user':uid}});assert.equal(response.status,uid?403:401)}const firstRead=await fetch(base+'/api/learning-points/course',{headers:{'x-user':'a'}});assert.equal(firstRead.status,200);assert.equal((await firstRead.json()).self.points,10,'fresh-device GET backfills saved progress before any sync or new save');const results=await Promise.all(Array.from({length:15},()=>fetch(base+'/api/learning-points/course/sync',{method:'POST',headers:{'x-user':'a','content-type':'application/json'},body:JSON.stringify({userId:'b',points:999999,event:'fraud'})})));for(const r of results){assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal((await r.json()).self.points,10)}assert.equal(db.prepare('SELECT COUNT(*) n FROM learning_point_events').get().n,1);const b=await fetch(base+'/api/learning-points/course',{headers:{'x-user':'b'}});assert.equal((await b.json()).self.points,0);db.prepare('UPDATE users SET active=0 WHERE id=?').run('a');assert.equal((await fetch(base+'/api/learning-points/course',{headers:{'x-user':'a'}})).status,403)}finally{server.closeAllConnections();await new Promise(r=>server.close(r));db.close()}});

test('real tool, simulation and workspace attempt saves award before response without explicit sync',async()=>{
 const {db,options}=fixture();db.exec(`DROP TABLE pmp_practice_drafts; DROP TABLE ${attemptTable}; ALTER TABLE users ADD COLUMN created INTEGER DEFAULT 0;`);
 const fs=await import('node:fs'),jwt=(await import('jsonwebtoken')).default;
 const {createPmpPracticeTools}=await import('../pmp-practice-tools.js'),{createPmpLearningLibrary}=await import('../pmp-learning-library.js'),{mountClassroom}=await import('../classroom.js');
 const definitions=JSON.parse(fs.readFileSync('data/pmp-practice-tools.json')),library=JSON.parse(fs.readFileSync('data/pmp-learning-library.json'));
 const store=createLearningPoints({...options,toolDefinitions:definitions,library}),app=express();app.use(express.json());
 const io={db,getPackages:options.getPackages,userFromToken:req=>db.prepare('SELECT * FROM users WHERE id=?').get(req.headers['x-user']),sendJson:(res,status,body)=>res.status(status).json(body),readJson:async req=>req.body,afterSave:store.afterSave};
 const tool=createPmpPracticeTools({...io,definitions}),simulation=createPmpLearningLibrary({...io,library});
 app.use('/api/pmp-practice-tools',(req,res)=>tool(req,res,new URL(req.originalUrl,'http://test')));
 app.use('/api/pmp-learning-library',(req,res)=>simulation(req,res,new URL(req.originalUrl,'http://test')));
 const router=express.Router(),secret='temporary-points-hooks-test';mountClassroom(router,{db,JWT_SECRET:secret,packageId:pid,basePath:'',workspace:true,getPackage:()=>({id:pid,code:'PMP'}),afterSave:store.afterSave});app.use('/workspace/'+pid,router);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 const post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'x-user':'a','content-type':'application/json',authorization:'Bearer '+jwt.sign({id:'a'},secret)},body:JSON.stringify(body)});return {status:r.status,data:await r.json()}};
 try{
  let result=await post('/api/pmp-practice-tools/course/save',{toolId:'life:need',inputs:{problem:'Fictional exercise'},completed:true,expectedRevision:0});assert.equal(result.status,200);assert.equal(store.snapshot('a',pid).self.points,5);
  result=await post('/api/pmp-practice-tools/course/save',{toolId:'life:need',inputs:{problem:'Fictional exercise'},completed:true,expectedRevision:0});assert.equal(result.status,409);assert.equal(store.snapshot('a',pid).self.points,5);
  const sim=library.simulations[0];result=await post('/api/pmp-learning-library/course/simulation',{simulationId:sim.id,choices:sim.STEPS.map(()=>0)});assert.equal(result.status,200);assert.equal(store.snapshot('a',pid).self.points,15);
  result=await post('/workspace/course/api/attempts',{kind:'exam',ref:'mock_1',score:69,max:100});assert.equal(result.status,200);assert.equal(store.snapshot('a',pid).self.points,35);assert.equal(store.snapshot('a',pid).self.summary.exams.latestScore,69);
  result=await post('/workspace/course/api/attempts',{kind:'exam',ref:'mock_1',score:100,max:100});assert.equal(result.status,200);assert.equal(store.snapshot('a',pid).self.points,35);
  result=await post('/workspace/course/api/attempts',{kind:'game',ref:'game:package:1',score:2,max:3});assert.equal(result.status,200);assert.equal(store.snapshot('a',pid).self.points,40);
  assert.equal(store.snapshot('b',pid).self.points,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM learning_point_events').get().n,4);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));db.close()}
});

test('actual main progress handler persists then GET exposes points without an explicit sync',async()=>{
 const {db,options}=fixture(),app=express();app.use(express.json());const auth=(req,res,next)=>{req.user=db.prepare('SELECT * FROM users WHERE id=?').get(req.headers['x-user']);if(!req.user)return res.status(401).end();next()};
 const points=mountLearningPoints({...options,app,auth});const fs=await import('node:fs'),{mergeProgressRecords,mergeExamRecords}=await import('../progress-records.js');const source=fs.readFileSync('server.js','utf8');const start=source.indexOf("app.put('/api/progress/:pkg'");const end=source.indexOf('\n});',start)+4;assert.ok(start>=0&&end>start);
 new Function('app','auth','db','mergeProgressRecords','mergeExamRecords','recordedProgress','learningPoints',source.slice(start,end))(app,auth,db,mergeProgressRecords,mergeExamRecords,(uid,pkg)=>JSON.parse(db.prepare('SELECT data FROM progress WHERE user_id=? AND package_id=?').get(uid,pkg).data),points);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 try{const r=await fetch(base+'/api/progress/course',{method:'PUT',headers:{'x-user':'a','content-type':'application/json'},body:JSON.stringify({lessons:{0:true}})});assert.equal(r.status,200);assert.equal((await r.json()).ok,true);const result=await fetch(base+'/api/learning-points/course',{headers:{'x-user':'a'}});assert.equal(result.status,200);assert.equal((await result.json()).self.points,10);assert.equal(db.prepare('SELECT COUNT(*) n FROM learning_point_events').get().n,1)}finally{server.closeAllConnections();await new Promise(r=>server.close(r));db.close()}
});

test('standalone PMP engine finish awards once from canonical finished session without client score trust',async()=>{
 const {db,options}=fixture();db.exec(`CREATE TABLE questions(id TEXT PRIMARY KEY,package_id TEXT,domain TEXT,topic TEXT,difficulty TEXT,type TEXT,question_ar TEXT,question_en TEXT,options TEXT,correct TEXT,explanation_ar TEXT,explanation_en TEXT,reference TEXT,active INTEGER,created INTEGER,updated INTEGER);CREATE TABLE exams(id TEXT PRIMARY KEY,package_id TEXT,title TEXT,kind TEXT,duration INTEGER,question_count INTEGER,pass_score REAL,config TEXT,active INTEGER,created INTEGER,updated INTEGER);INSERT INTO questions VALUES('q1','course','people','topic','medium','single','سؤال','Question','["A","B"]','A','','','test',1,0,0);`);
 const {createPmpEngine}=await import('../pmp-engine.js'),{Readable}=await import('node:stream'),jwt=(await import('jsonwebtoken')).default;
 const store=createLearningPoints(options),engine=createPmpEngine({db,JWT_SECRET:'engine-points-test',getPackages:()=>[{id:pid,code:'PMP',course:'pmp',active:true}],savePackages(){throw Error('unexpected package write')},afterSave:store.afterSave});
 db.prepare("UPDATE questions SET correct_json='[0]' WHERE id='q1'").run();
 db.prepare('INSERT INTO exam_sessions(id,user_id,package_id,exam_code,question_ids,answers,started,updated) VALUES(?,?,?,?,?,?,?,?)').run('synthetic','a',pid,'pmp-2026-full-180','["q1"]','{"q1":"A"}',10,10);
 const call=()=>new Promise((resolve,reject)=>{const req=Readable.from([Buffer.from('{"score":99999}')]);req.method='POST';req.headers={authorization:'Bearer '+jwt.sign({id:'a'},'engine-points-test')};const res={writeHead(status){this.status=status},end(bytes){resolve({status:this.status,data:JSON.parse(bytes.toString())})}};engine.handle(req,res,new URL('http://test/api/pmp-2026/session/synthetic/finish')).catch(reject)});
 const result=await call();assert.equal(result.status,200);assert.equal(result.data.score,100);assert.equal(store.snapshot('a',pid).self.points,20);assert.equal(store.snapshot('a',pid).self.summary.exams.latestScore,100);assert.equal(store.snapshot('a',pid).self.summary.exams.completed,1);assert.deepEqual(await call(),result);assert.equal(store.snapshot('a',pid).self.points,20);assert.equal(store.snapshot('b',pid).self.points,0);assert.ok(!JSON.stringify(store.snapshot('a',pid)).includes('synthetic'));db.close();
});


test('legacy server progress reconciles on first load, aliases deduplicate and fresh devices retain totals',()=>{
 const {db,store,options}=fixture();db.prepare("UPDATE lessons SET chapter='0' WHERE idx=0 AND package_id=?").run(pid);
 save(db,'a',{lessons:{0:true,1:true,2:true,99:true},exams:{
  ch0:{score:69,passed:false,at:500},chapter_0:{score:80,total:10,at:600},
  lesson0:{score:0,autoCount:2,autoCorrect:0,passed:false,at:650},
  full:{score:69,passed:true,at:700},practice:{score:50,passed:false,at:750},
  mock_1:{score:70,total:10,at:800},dom_people:{score:100,total:3,at:900},
  ch999:{score:100,passed:true,at:950},lesson999:{score:100,passed:true,at:950},
  mock_2:{score:100},mock_3:{score:100,total:0,at:900},mock_4:{score:100,total:2,at:999999},
  mock_5:{score:100,total:3,at:900,pendingReview:1},arbitrary:{score:100,passed:true,at:900}
 }});
 attempt(db,{ref:'mock_1',id:'duplicate-snapshot',score:70,max:100,pct:70});
 const first=store.snapshot('a',pid);assert.equal(first.self.points,140);assert.equal(first.self.summary.video.completed,2);assert.equal(first.self.summary.exams.completed,6);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM learning_point_events').get().n,8);
 for(let i=0;i<10;i++){store.sync(pid);store.afterSave('a',pid);assert.equal(createLearningPoints(options).snapshot('a',pid).self.points,140)}
 assert.equal(store.snapshot('b',pid).self.points,0);assert.equal(first.self.eligible,true);db.close();
});
test('administrator learner view has own private historical points but no trainee ranking or membership',()=>{
 const {db,store}=fixture();save(db,'teacher',{lessons:{0:true},exams:{full:{score:69,passed:false,at:500}}});save(db,'a',{lessons:{0:true}});
 const admin=store.snapshot('teacher',pid);assert.equal(admin.self.points,30);assert.equal(admin.self.eligible,false);assert.equal(admin.overall.self,null);assert.equal(admin.overall.total,3);assert.ok(admin.groups.every(g=>g.self===null));
 store.sync(pid);const student=store.snapshot('a',pid);assert.equal(student.self.points,10);assert.ok(!student.overall.leaders.some(x=>x.name==='Teacher'));assert.ok(!JSON.stringify(student).includes('admin@example.test'));db.close();
});
test('corrupt saved progress is an error rather than a fake zero and cannot partly backfill',()=>{
 const {db,store}=fixture();save(db,'a',{lessons:{0:true}});db.prepare('UPDATE progress SET data=? WHERE user_id=?').run('{bad','a');assert.throws(()=>store.snapshot('a',pid),/unreadable/);assert.equal(db.prepare('SELECT COUNT(*) n FROM learning_point_events').get().n,0);db.close();
});

test('HTTP malformed historical evidence returns unavailable, not a successful zero',async()=>{
 const {db,options}=fixture(),app=express();const auth=(req,res,next)=>{req.user={id:'a'};next()};mountLearningPoints({...options,app,auth});
 save(db,'a',{});db.prepare('UPDATE progress SET data=? WHERE user_id=?').run('null','a');
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/learning-points/course');assert.equal(response.status,500);const payload=await response.json();assert.ok(payload.error);assert.equal(payload.self,undefined);assert.equal(response.headers.get('cache-control'),'private, no-store');}
 finally{server.closeAllConnections();await new Promise(r=>server.close(r));db.close()}
});

test('corrupt peer cannot hide healthy personal points and is excluded from provisional ranks, never shown as zero',async()=>{
 const {db,options}=fixture(),app=express();const auth=(req,res,next)=>{req.user={id:req.headers['x-user']};next()};const store=mountLearningPoints({...options,app,auth});
 save(db,'a',{lessons:{0:true}});save(db,'b',{lessons:{1:true}});store.sync(pid);
 // Retain B's existing earned ledger, but do not pretend its unreadable current history is a complete ranking.
 db.prepare('UPDATE progress SET data=? WHERE user_id=?').run('{bad','b');
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 try{for(let i=0;i<3;i++){const response=await fetch(base+'/api/learning-points/course/sync',{method:'POST',headers:{'x-user':'a'}});assert.equal(response.status,200);const data=await response.json();assert.equal(data.self.points,10);assert.equal(data.rankingStatus,'partial');assert.equal(data.overall.total,2);assert.ok(!data.overall.leaders.some(r=>r.name==='B'));assert.ok(data.groups.every(g=>!g.leaders.some(r=>r.name==='B')));assert.equal(db.prepare('SELECT SUM(points) n FROM learning_point_events WHERE user_id=?').get('b').n,10);}
  const own=await fetch(base+'/api/learning-points/course/sync',{method:'POST',headers:{'x-user':'b'}});assert.equal(own.status,500);assert.equal((await own.json()).self,undefined);
  save(db,'b',{lessons:{1:true}});const recovered=await fetch(base+'/api/learning-points/course/sync',{method:'POST',headers:{'x-user':'a'}});const data=await recovered.json();assert.equal(data.rankingStatus,'complete');assert.equal(data.overall.total,3);assert.equal(data.overall.leaders.find(x=>x.name==='B').points,10);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));db.close()}
});
