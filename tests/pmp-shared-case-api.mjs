import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {Readable} from 'node:stream';
import jwt from 'jsonwebtoken';
import {createPmpEngine} from '../pmp-engine.js';
const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE users(id TEXT,name TEXT,email TEXT,role TEXT,active INTEGER);INSERT INTO users VALUES('test-admin','Test','test@example.invalid','admin',1);CREATE TABLE questions(id TEXT PRIMARY KEY,package_id TEXT,domain TEXT,topic TEXT,difficulty TEXT,type TEXT,question_ar TEXT,question_en TEXT,options TEXT,correct TEXT,explanation_ar TEXT,explanation_en TEXT,reference TEXT,active INTEGER,created INTEGER,updated INTEGER);CREATE TABLE exams(id TEXT PRIMARY KEY,package_id TEXT,title TEXT,kind TEXT,duration INTEGER,question_count INTEGER,pass_score REAL,config TEXT,active INTEGER,created INTEGER,updated INTEGER);`);
const add=db.prepare('INSERT INTO questions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
for(const domain of ['people','process','business'])for(let i=0;i<180;i++)add.run(domain+i,'pmp-full',domain,'topic','medium','single','سؤال تجريبي','Practice question','["أ","ب"]','A','شرح','Explanation','test',1,0,0);
const engine=createPmpEngine({db,JWT_SECRET:'test-only',getPackages:()=>[{id:'pmp-full'}],savePackages(){throw Error('No package write expected')}});
const token=jwt.sign({id:'test-admin'},'test-only');
async function call(path,body,method='POST'){
 const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);req.method=method;req.headers={authorization:'Bearer '+token};
 return new Promise((resolve,reject)=>{const res={writeHead(status){this.status=status},end(bytes){resolve({status:this.status,body:JSON.parse(bytes.toString())})}};engine.handle(req,res,new URL('http://test/api/pmp-2026'+path)).catch(reject)});
}
const originalNow=Date.now;let now=1900000000000;Date.now=()=>now;
try{
 const started=await call('/start',{language:'ar'});assert.equal(started.status,200);const session=started.body,id=session.id;
 assert.equal(session.questions.length,180);assert.equal(new Set(session.questions.map(q=>q.id)).size,180);
 const first=session.questions.slice(0,10);assert(first.every(q=>q.meta.caseId===first[0].meta.caseId));assert(first.every(q=>q.meta.scenarioText_ar.length>2000));assert.equal(new Set(first.map(q=>q.meta.scenarioText_ar)).size,1);
 assert.deepEqual(session.questions.reduce((c,q)=>(c[q.domain]=(c[q.domain]||0)+1,c),{}),{people:59,process:74,business:47});assert.equal(session.config.breaks[0].durationMinutes,10);
 assert.equal((await call(`/session/${id}/break`,{afterQuestion:10})).status,409);
 for(const q of first)assert.equal((await call(`/session/${id}/answer`,{questionId:q.id,answer:'A'})).status,200);
 now+=40000;const startBreak=await call(`/session/${id}/break`,{afterQuestion:10});assert.equal(startBreak.status,200);assert.equal(startBreak.body.state.remainingMs,14400000-40000);
 now+=300000;const mid=(await call(`/session/${id}`,undefined,'GET')).body;assert.equal(mid.state.remainingMs,startBreak.body.state.remainingMs);assert.equal(mid.answers[first[0].id],'A');
 assert.equal((await call(`/session/${id}/answer`,{questionId:session.questions[10].id,answer:'A'})).status,409);
 assert.equal((await call(`/session/${id}/resume`,{})).body.state.currentIndex,10);const repeat=await call(`/session/${id}/resume`,{});assert.equal(repeat.body.state.currentIndex,10);
 assert.equal((await call(`/session/${id}/break`,{afterQuestion:10})).body.state.breakUntil,null);
 assert.equal((await call(`/session/${id}/answer`,{questionId:first[0].id,answer:'B'})).status,409);
 assert.equal((await call(`/session/${id}/answer`,{questionId:session.questions[10].id,answer:'A'})).status,200);
 for(const q of session.questions.slice(11,94))await call(`/session/${id}/answer`,{questionId:q.id,answer:'A'});
 const second=await call(`/session/${id}/break`,{afterQuestion:94});assert.equal(second.status,200);now+=620000;
 const expired=(await call(`/session/${id}`,undefined,'GET')).body.state;assert.equal(expired.currentIndex,94);assert.equal(expired.breakUntil,null);assert.equal(expired.remainingMs,second.body.state.remainingMs-20000);assert.deepEqual(expired.completedBreaks,[10,94]);
 // Old attempts retain old IDs, text and answers; no retroactive case replacement.
 db.prepare('INSERT INTO exam_sessions(id,user_id,package_id,exam_code,question_ids,answers,started,updated) VALUES(?,?,?,?,?,?,?,?)').run('old','test-admin','pmp-full','pmp-2026-full-180','["people0"]','{"people0":"B"}',now,now);
 const old=(await call('/session/old',undefined,'GET')).body;assert.equal(old.state,null);assert.equal(old.questions[0].id,'people0');assert.equal(old.answers.people0,'B');
 console.log('PASS PMP API: original coherent case,180 unique/weighted questions, answers retained,10-minute paused break, early/duplicate resume,94 boundary, elapsed reload and legacy session preservation');
}finally{Date.now=originalNow;db.close()}
