// Complete server against an isolated synthetic database. Never contacts production.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import net from 'node:net';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
test('server integrates private cohorts with activation, grants and stored progress without leaking access',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cohort-test-')),file=path.join(dir,'fake.db'),secret='synthetic-only-cohort-test-secret';
 const port=await new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
 const child=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),DB_PATH:file,JWT_SECRET:secret,ADMIN_PASSWORD:'Synthetic-test-password!',SITE_URL:`http://127.0.0.1:${port}`},stdio:['ignore','pipe','pipe']});
 let log='';child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x);let db;
 const request=async(url,body,method='GET',actor='admin')=>{const res=await fetch(`http://127.0.0.1:${port}/api/admin/${url}`,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+jwt.sign({id:actor,role:'admin'},secret)},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,data:await res.json()};};
 try{
  for(let i=0;i<100&&!log.includes('🚀');i++){if(child.exitCode!==null)throw Error(log);await new Promise(r=>setTimeout(r,100));}
  assert.ok(log.includes('🚀'),log);db=new Database(file);
  const add=db.prepare('INSERT INTO users(id,name,email,pass,role,active,created) VALUES(?,?,?,?,?,?,?)');for(const [id,role] of [['admin','admin'],['a','student'],['b','student'],['c','student'],['trainer','instructor']])add.run(id,id,id+'@synthetic.invalid','not-a-password',role,id==='admin'?1:0,Date.now());
  const g=(await request('cohorts',{name:'محمد وأحمد وسيد'},'POST')).data.id;
  assert.ok(g);assert.equal((await request('cohorts',null,'GET','a')).status,403);
  assert.equal((await request('users/a/toggle',{cohortId:g},'POST')).status,200);
  assert.equal(db.prepare('SELECT active FROM users WHERE id=?').get('a').active,1);
  assert.equal(db.prepare('SELECT count(*) n FROM enrollments').get().n,0);
  assert.equal((await request('grant',{userId:'b',packageId:'fake',days:30,cohortId:99999},'POST')).status,404);
  assert.equal(db.prepare('SELECT count(*) n FROM enrollments').get().n,0);
  assert.equal((await request('bulk',{action:'grant',ids:['b','c'],packageId:'fake',days:30,cohortId:g},'POST')).status,200);
  assert.equal((await request('bulk',{action:'enable',ids:['b','missing'],cohortId:g},'POST')).status,400);
  assert.equal(db.prepare('SELECT active FROM users WHERE id=?').get('b').active,0);
  const before=db.prepare('SELECT * FROM enrollments ORDER BY user_id').all();
  db.prepare('INSERT INTO lessons(package_id,idx,title,vimeo) VALUES(?,?,?,?)').run('fake',0,'Video','123');
  db.prepare('INSERT INTO progress(user_id,package_id,data,updated) VALUES(?,?,?,?)').run('b','fake',JSON.stringify({lessons:{0:true},exams:{test:{score:0}}}),Date.now());
  let overview=(await request('overview')).data;assert.equal(overview.cohorts[0].memberIds.length,3);assert.equal(overview.students.find(u=>u.id==='b').progress,100);assert.equal(overview.students.find(u=>u.id==='b').avgExam,0);assert.equal(overview.students.find(u=>u.id==='c').progress,null);
  assert.equal((await request('cohorts/'+g+'/members',{remove:['b']},'POST')).status,200);assert.deepEqual(db.prepare('SELECT * FROM enrollments ORDER BY user_id').all(),before);
  assert.equal((await request('users/b/activity',null,'GET','trainer')).status,403);
  assert.equal((await request('users/b/activity')).data.enrollments[0].progress,100);
  assert.equal((await request('cohorts/'+g,{active:false},'PUT')).status,200);
  assert.equal((await request('users/c',{active:true,cohortId:g},'PUT')).status,400);assert.equal(db.prepare('SELECT active FROM users WHERE id=?').get('c').active,0);
  assert.equal((await request('cohorts/'+g,{active:true},'PUT')).status,200);
  assert.equal((await request('users/c',{active:true,cohortId:g},'PUT')).status,200);
  db.prepare("UPDATE users SET active=0 WHERE id='admin'").run();assert.equal((await request('cohorts')).status,403);assert.equal((await request('cohorts',{name:'Denied'},'POST')).status,403);
  db.prepare("UPDATE users SET active=1,role='student' WHERE id='admin'").run();assert.equal((await request('cohorts')).status,403);
  db.prepare("DELETE FROM users WHERE id='admin'").run();assert.equal((await request('cohorts')).status,401);
 }finally{if(db)db.close();child.kill();await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));fs.rmSync(dir,{recursive:true,force:true});}
});
