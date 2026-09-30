import express from 'express';
import jwt from 'jsonwebtoken';
import {DatabaseSync} from 'node:sqlite';import assert from 'node:assert/strict';
import {mountClassroom} from '../classroom.js';
const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,phone TEXT,active INTEGER,created INTEGER);CREATE TABLE enrollments(id TEXT,user_id TEXT,package_id TEXT,expires INTEGER);INSERT INTO users VALUES('p','مشارك تجريبي','p@example.test','user',NULL,1,0),('a','مشرف تجريبي','a@example.test','admin',NULL,1,0),('q','مشارك آخر','q@example.test','user',NULL,1,0),('t','مدرب آخر','t@example.test','user',NULL,1,0);INSERT INTO enrollments VALUES('e','p','rmp-private-classroom',NULL),('f','q','rmp-private-classroom',NULL);`);
const key='temporary-workflow-tests-only';const tokens=Object.fromEntries(['p','a','q','t'].map(id=>[id,jwt.sign({id},key)]));const app=express();mountClassroom(app,{db,JWT_SECRET:key});db.exec("INSERT INTO cls_staff VALUES('t','trainer',0)");mountClassroom(express(),{db,JWT_SECRET:key}); // Idempotent migration.
const server=app.listen(0,'127.0.0.1',async()=>{const base='http://127.0.0.1:'+server.address().port+'/classroom/api/';async function call(user,url,method='GET',body){const r=await fetch(base+url,{method,headers:{authorization:'Bearer '+tokens[user],'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {code:r.status,data:await r.json()};}const report={title:{ar:'مرحلة المشروع'},sections:[{title:'نتائج',body:'تقرير تدريب للاختبار'}]},submit=day=>({activity_id:'PROJECT-D'+day,notes:'تطبيق تدريبي مع الأدلة والنتائج والقرار والمسؤول',report});try{
assert.equal((await call('p','my/submissions','POST',submit(2))).code,409);
let r=await call('p','my/submissions','POST',submit(1));assert.equal(r.code,200);const first=r.data.id;
assert.equal((await call('p','my/submissions','POST',submit(1))).code,409);
assert.equal((await call('q','my/submissions/'+first+'/history')).code,403);
assert.equal((await call('p','admin/submissions/'+first,'PUT',{status:'approved',rubric:[4,4,4,4,4]})).code,403);
assert.equal((await call('t','admin/submissions/'+first,'PUT',{status:'approved',rubric:[4,4,4,4,4]})).code,403);
assert.equal((await call('a','admin/submissions/'+first,'PUT',{status:'approved',rubric:[1,1,1,1,1]})).code,400);
assert.equal((await call('a','admin/submissions/'+first,'PUT',{status:'approved',rubric:[4,4,4,4,8]})).code,400);
assert.equal((await call('a','admin/submissions/'+first,'PUT',{status:'revision_requested',rubric:[2,2,2,2,2],feedback:'وضح مصادر البيانات وحدود المخاطرة والمسؤوليات'})).code,200);
r=await call('p','my/submissions','POST',submit(1));assert.equal(r.data.version,2);const second=r.data.id;
assert.equal((await call('a','admin/submissions/'+first,'PUT',{status:'approved',rubric:[4,4,4,4,4]})).code,409);
assert.equal((await call('a','admin/submissions/'+second,'PUT',{status:'approved',rubric:[4,4,4,4,4],feedback:'تم التحقق من الأدلة وخطة المتابعة'})).data.grade,100);
assert.equal((await call('p','my/submissions','POST',submit(1))).code,409);
assert.equal((await call('a','admin/submissions/'+second,'PUT',{status:'reviewed',rubric:[3,3,3,3,3]})).code,409);
for(let day=2;day<=5;day++)assert.equal((await call('p','my/submissions','POST',submit(day))).code,200);
const all=(await call('p','my/submissions')).data;assert.equal(all.length,6);assert.equal(all.find(x=>x.id===second).parent_id,first);assert.equal((await call('p','my/submissions/'+first+'/history')).data.length,1);
console.log('PASS: five stages, revision chain, immutable approved/old versions, rubric grading, approval threshold, owner/staff authorization, migration rerun, history');
}catch(e){console.error(e);process.exitCode=1;}finally{server.close();db.close();}});
