import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {summarizeRecordedProgress,readRecordedExamAttempts,summarizeStudent} from '../trainee-tracking.js';
import {mergeExamRecords} from '../progress-records.js';
const row=data=>({data:JSON.stringify(data),updated:100}), videos=[{idx:0,chapter:'Scope'},{idx:1,chapter:'Risks'}];
const attempt={id:1,ref:'full-1',pct:69,score:69,max:100,created:200};
test('score69 is visible independently of zero video progress; no duplicate dual-write',()=>{
 const s=summarizeRecordedProgress(row({lessons:{},exams:{'full-1':{score:69,at:199}}}),videos,[attempt]);
 assert.equal(s.progress,0);assert.equal(s.avgExam,69);assert.equal(s.examsAttempted,1);assert.equal(s.lastActivity,200);
 assert.equal(s.activityDetails.exams[0].score,69);assert.equal(s.activityDetails.exams[0].passed,false);
 assert.equal(summarizeStudent([s]).avgExam,69);
});
test('attempt-only and corrupt snapshots retain genuine score but do not invent video progress',()=>{
 for(const r of [null,{data:'bad'}]){const s=summarizeRecordedProgress(r,videos,[attempt]);assert.equal(s.progress,null);assert.equal(s.avgExam,69);assert.equal(s.activityDetails.exams.length,1);}
});
test('latest per-assessment, not best score; JSON-only legacy records remain counted',()=>{
 const s=summarizeRecordedProgress(row({exams:{old:{score:80,at:10},'full-1':{score:90,at:300}}}),videos,[attempt,{...attempt,id:2,pct:0,created:400}]);
 assert.equal(s.avgExam,40);assert.equal(s.examsAttempted,2);assert.equal(s.activityDetails.exams.find(x=>x.id==='full-1').score,0);
});
test('table lookup is read-only and isolates package,user,and exam kind',()=>{
 const db=new DatabaseSync(':memory:');
 const table=p=>'ws_'+crypto.createHash('sha256').update(p).digest('hex').slice(0,16)+'_attempts';
 assert.deepEqual(readRecordedExamAttempts(db,'a','pmp'),[]);assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master").get().n,0);
 for(const p of ['pmp','rmp']){db.exec(`CREATE TABLE ${table(p)}(id INTEGER,user_id TEXT,kind TEXT,ref TEXT,title TEXT,score REAL,max REAL,pct REAL,created INTEGER)`);db.prepare(`INSERT INTO ${table(p)} VALUES(?,?,?,?,?,?,?,?,?)`).run(1,'a','exam','full','Mock',69,100,p==='pmp'?69:99,200);}
 db.prepare(`INSERT INTO ${table('pmp')} VALUES(?,?,?,?,?,?,?,?,?)`).run(2,'b','exam','other','Other',100,100,100,200);
 db.prepare(`INSERT INTO ${table('pmp')} VALUES(?,?,?,?,?,?,?,?,?)`).run(3,'a','game','game','Game',100,100,100,200);
 assert.equal(readRecordedExamAttempts(db,'a','pmp').length,1);assert.equal(readRecordedExamAttempts(db,'a','pmp')[0].pct,69);db.close();
});
test('delayed snapshot cannot erase newer exam; zero and unchecking lessons stay valid',()=>{
 const saved={exams:{full:{score:69,at:200},chapter:{score:0,at:100}}};
 assert.deepEqual(mergeExamRecords(saved,{lessons:{0:false},exams:{full:{score:30,at:10}}}),{lessons:{0:false},exams:saved.exams});
 assert.equal(mergeExamRecords(saved,{exams:{full:{score:0,at:300}}}).exams.full.score,0);
});
const script=fs.readFileSync(new URL('../public/progress-sync.js',import.meta.url),'utf8');
function setup(options={}){const data=new Map();const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};const c={};vm.runInNewContext(script,c);let who={id:'a',token:'token-a'};const sent=[],errors=[];const queue=c.AlsaeedProgressSync.create({storage,actor:()=>who,send:async(...x)=>{sent.push(x);if(options.send)await options.send(...x)},onError:e=>errors.push(e)});return{queue,storage,sent,errors,change:v=>who=v,create:()=>c.AlsaeedProgressSync.create({storage,actor:()=>who,send:async(...x)=>sent.push(x)})};}
test('offline failure persists, reload retries exact owner only, no token stored',async()=>{
 const x=setup({send:()=>{throw Error('offline')}});x.queue.enqueue('pmp',{exams:{full:{score:69}}});assert.equal(await x.queue.flush('pmp'),false);assert.equal(x.errors.length,1);assert.ok(!x.storage.getItem('alsaeed_pending_progress_v1').includes('token-a'));
 x.change({id:'b',token:'token-b'});await x.create().flushAll();assert.equal(x.sent.length,1);
 x.change({id:'a',token:'new-token-a'});const recovered=x.create();await recovered.flushAll();assert.equal(x.sent.length,2);assert.equal(x.sent[1][2],'new-token-a');assert.equal(recovered.hasPending('pmp'),false);
});
test('concurrent flush coalesces while newer snapshot follows old write; logout stops pending next write',async()=>{
 let release;const wait=new Promise(r=>release=r);const x=setup({send:()=>wait});x.queue.enqueue('pmp',{exams:{full:{score:10}}});const a=x.queue.flush('pmp'),b=x.queue.flush('pmp');assert.equal(a,b);x.queue.enqueue('pmp',{exams:{full:{score:69}}});release();await a;assert.equal(x.sent.length,2);assert.equal(x.sent[1][1].exams.full.score,69);
 let end;const y=setup({send:()=>new Promise(r=>end=r)});y.queue.enqueue('pmp',{v:1});const pending=y.queue.flush('pmp');y.queue.enqueue('pmp',{v:2});y.change(null);end();await pending;assert.equal(y.sent.length,1);
});

test('canonical equal timestamp keeps precise69.6 fail, while newer distinct snapshot is retained',()=>{
 const old=row({exams:{'full-1':{score:70,passed:true,at:200}}});
 const s=summarizeRecordedProgress(old,videos,[{...attempt,pct:69.6,score:87,max:125}]);assert.equal(s.avgExam,69.6);assert.equal(s.activityDetails.exams[0].passed,false);
 const newer=row({exams:{'full-1':{score:80,passed:true,at:300}}});assert.equal(summarizeRecordedProgress(newer,videos,[attempt]).avgExam,80);
});
test('stale reload cache cannot replace pending exam before retry',async()=>{
 const x=setup({send:()=>{throw Error('offline')}});x.queue.enqueue('pmp',{updatedAt:200,exams:{full:{score:69,at:200}}});await x.queue.flush('pmp');
 const reloaded=x.create();reloaded.enqueue('pmp',{updatedAt:100,exams:{full:{score:20,at:100}},lessons:{0:true}});await reloaded.flush('pmp');assert.equal(x.sent.at(-1)[1].exams.full.score,69);assert.equal(x.sent.at(-1)[1].lessons[0],true);
});
