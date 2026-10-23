import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';import net from 'node:net';import crypto from 'node:crypto';import Database from 'better-sqlite3';import jwt from 'jsonwebtoken';
test('two independent clients hydrate canonical progress and stale snapshots cannot erase it',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'progress-two-client-')),file=path.join(dir,'fake.db'),secret='synthetic-cross-device-secret';
 const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p))})});
 const child=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),DB_PATH:file,JWT_SECRET:secret,ADMIN_PASSWORD:'Synthetic-test-password!',SITE_URL:`http://127.0.0.1:${port}`},stdio:['ignore','pipe','pipe']});let log='',db,spawnError;const exited=new Promise(resolve=>{child.once('exit',resolve);child.once('error',error=>{spawnError=error;resolve()})});child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x);
 const tokens={one:jwt.sign({id:'a',jti:'device-one'},secret),two:jwt.sign({id:'a',jti:'device-two'},secret),other:jwt.sign({id:'b'},secret),admin:jwt.sign({id:'owner',role:'admin'},secret)};
 const call=async(client,url='/api/progress/pmp',body)=>{const res=await fetch(`http://127.0.0.1:${port}`+url,{method:body?'PUT':'GET',headers:{Authorization:'Bearer '+tokens[client],'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json(),cache:res.headers.get('cache-control')};};
 try{
  for(let i=0;i<100&&!log.includes('🚀');i++){if(spawnError||child.exitCode!==null||child.signalCode!==null)throw Error(`Server exited before readiness: ${spawnError?.message||child.signalCode||child.exitCode}\n${log}`);await new Promise(r=>setTimeout(r,100))}assert.ok(log.includes('🚀'),log);db=new Database(file);
  db.prepare("INSERT INTO settings(k,v) VALUES('content_packages',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").run(JSON.stringify([{id:'pmp',course:'pmp',active:true}]));
  for(const id of ['a','b','owner'])db.prepare('INSERT INTO users(id,name,email,pass,role,active,created) VALUES(?,?,?,?,?,?,?)').run(id,id,id+'@synthetic.invalid','not-a-password',id==='owner'?'admin':'student',1,1);
  for(const id of ['a','b'])db.prepare('INSERT INTO enrollments(id,user_id,package_id,source,created) VALUES(?,?,?,?,?)').run(id,id,'pmp','synthetic',1);
  for(let i=0;i<2;i++)db.prepare('INSERT INTO lessons(package_id,idx,title,vimeo) VALUES(?,?,?,?)').run('pmp',i,'Video'+i,'123');
  const stale=(await call('one')).data;assert.equal(stale._serverRevision,0);
  let r=await call('two','/api/progress/pmp',{...stale,lessons:{0:true},activities:{'ref:reading':true},referenceActivityUpdated:{reading:200},referenceNotes:{reading:{text:'New note',updated:200}},exams:{full:{score:69,passed:false,at:200}}});assert.equal(r.status,200);assert.equal(r.data.data._summary.progress,50);
  const firstPoints=await call('one','/api/learning-points/pmp');assert.equal(firstPoints.status,200,JSON.stringify(firstPoints));assert.equal(firstPoints.data.self.points,30,'actual main-server PUT awards video10 plus saved full-exam20 before response without explicit sync');
  const revision=r.data.data._serverRevision;assert.ok(revision>0);
  const clearDevice=(await call('one')).data;assert.equal(clearDevice.lessons[0],true);assert.equal(clearDevice.exams.full.score,69);assert.equal(clearDevice.activities['ref:reading'],true);assert.equal(clearDevice.referenceNotes.reading.text,'New note');
  r=await call('one','/api/progress/pmp',{...stale,lessons:{0:false,1:true},activities:{'ref:reading':false},referenceActivityUpdated:{reading:100},referenceNotes:{reading:{text:'Old note',updated:100}},exams:{}});assert.equal(r.status,200);assert.ok(r.data.data._serverRevision>revision);
  const fresh=(await call('two')).data;assert.equal(fresh.lessons[0],true);assert.equal(fresh.lessons[1],true);assert.equal(fresh._summary.progress,100);assert.equal(fresh.exams.full.score,69);assert.equal(fresh.referenceNotes.reading.text,'New note');assert.equal(fresh.activities['ref:reading'],true);
  assert.equal((await call('two','/api/learning-points/pmp')).data.self.points,40,'fresh device sees both canonical video awards plus saved full-exam participation');
  assert.equal((await call('other','/api/learning-points/pmp')).data.self.points,0,'points remain owner-scoped');
  assert.equal((await call('other')).data.exams.full,undefined);assert.deepEqual((await call('other')).data.lessons,{});
  // A new server attempt (without a progress snapshot) must hydrate fresh devices too.
  const table='ws_'+crypto.createHash('sha256').update('pmp').digest('hex').slice(0,16)+'_attempts';db.exec(`CREATE TABLE ${table}(id INTEGER,user_id TEXT,kind TEXT,ref TEXT,title TEXT,score REAL,max REAL,pct REAL,created INTEGER)`);db.prepare(`INSERT INTO ${table} VALUES(?,?,?,?,?,?,?,?,?)`).run(1,'a','exam','new-mock','New',69,100,69,300);
  const synced=await call('one');assert.equal(synced.data.exams['new-mock'].score,69);assert.equal(synced.data._summary.examsAttempted,2);assert.equal(synced.cache,'no-store');
  const admin=(await call('admin','/api/admin/users/a/activity')).data;assert.equal(admin.summary.progress,synced.data._summary.progress);assert.equal(admin.summary.avgExam,synced.data._summary.avgExam);
  // Current revision allows a deliberate uncheck, not a stale overwrite.
  const uncheck=await call('two','/api/progress/pmp',{...synced.data,lessons:{0:false,1:true}});assert.equal(uncheck.data.data.lessons[0],false);
  assert.equal((await call('one','/api/learning-points/pmp')).data.self.points,40,'uncheck and retries do not remove or duplicate lifetime points');
  for(const invalid of ['null','[]','42','badJSON']){db.prepare('UPDATE progress SET data=? WHERE user_id=?').run(invalid,'b');const recovery=await call('other','/api/progress/pmp',{lessons:{1:true}});assert.equal(recovery.status,200,invalid);assert.equal(recovery.data.data.lessons[1],true);}
 }finally{db?.close();if(!spawnError&&child.exitCode===null&&child.signalCode===null){const killTimer=setTimeout(()=>child.kill('SIGKILL'),2000);try{child.kill();await exited;}finally{clearTimeout(killTimer)}}fs.rmSync(dir,{recursive:true,force:true})}
});
