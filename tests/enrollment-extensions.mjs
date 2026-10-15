import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { createEnrollmentExtender, mountEnrollmentExtensions, EXTENSION_DAY_MS as DAY,
  MAX_EXTENSION_DAYS, MAX_ENROLLMENT_EXPIRES } from '../enrollment-extensions.js';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const NOW = Date.UTC(2026, 9, 15, 12);
const errorIs = (status, code) => error => error.status === status && error.code === code;

// Like the certificate tests, use Node's bundled real SQLite to avoid depending
// on a native addon built for a different Node version. SQL and transaction
// semantics match the better-sqlite3 interface used by the production helper.
function createTestDatabase(filename) {
  const db=new DatabaseSync(filename);
  db.exec('PRAGMA busy_timeout=5000');
  db.pragma=value=>db.exec('PRAGMA '+value);
  const prepare=db.prepare.bind(db);
  db.prepare=sql=>{
    const statement=prepare(sql);
    return {run:(...args)=>statement.run(...args),get:(...args)=>{
      const row=statement.get(...args); return row?{...row}:undefined;
    },all:(...args)=>statement.all(...args).map(row=>({...row}))};
  };
  db.transaction=fn=>{
    const run=mode=>(...args)=>{
      db.exec('BEGIN '+mode);
      try {const result=fn(...args);db.exec('COMMIT');return result;}
      catch(error){db.exec('ROLLBACK');throw error;}
    };
    const wrapped=run('DEFERRED');wrapped.immediate=run('IMMEDIATE');return wrapped;
  };
  return db;
}

function fixture({ expires = NOW + 10 * DAY, filename = ':memory:' } = {}) {
  const db = createTestDatabase(filename);
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,active INTEGER,phone TEXT,created INTEGER);
    CREATE TABLE enrollments(id TEXT PRIMARY KEY,user_id TEXT,package_id TEXT,source TEXT,expires INTEGER,created INTEGER,UNIQUE(user_id,package_id));
    CREATE TABLE orders(id TEXT PRIMARY KEY,user_id TEXT,package_id TEXT,amount INTEGER,status TEXT);
    CREATE TABLE progress(user_id TEXT,package_id TEXT,data TEXT,updated INTEGER,PRIMARY KEY(user_id,package_id));
    CREATE TABLE certificates(no TEXT PRIMARY KEY,user_id TEXT,package_id TEXT);
    CREATE TABLE lessons(package_id TEXT,idx INTEGER,title TEXT,title_en TEXT,chapter INTEGER,duration TEXT,vimeo TEXT,free INTEGER,notes TEXT,notes_en TEXT,files TEXT,quiz TEXT);
    INSERT INTO users VALUES('admin','Synthetic Admin','admin@example.invalid','admin',1,NULL,1);
    INSERT INTO users VALUES('student','Synthetic Learner','student@example.invalid','student',1,NULL,2);
    INSERT INTO users VALUES('other','Other Learner','other@example.invalid','student',1,NULL,3);
    INSERT INTO orders VALUES('order','student','pmp',9900,'paid');
    INSERT INTO progress VALUES('student','pmp','{"lessons":{"0":true}}',123);
    INSERT INTO certificates VALUES('certificate','student','pmp');
    INSERT INTO lessons VALUES('pmp',0,'Private lesson',NULL,1,'01:00','12345',0,NULL,NULL,'[]','[]');`);
  db.prepare('INSERT INTO enrollments VALUES(?,?,?,?,?,?)').run('enrollment','student','pmp','original purchase',expires,77);
  db.prepare('INSERT INTO enrollments VALUES(?,?,?,?,?,?)').run('other-enrollment','student','rmp','other grant',NOW+DAY,88);
  const extend = createEnrollmentExtender({ db, now: () => NOW });
  const request = body => extend({ actorId: 'admin', userId: 'student', packageId: 'pmp',
    body: { expectedEnrollmentId: 'enrollment', expectedExpires: expires, days: 7, ...body } });
  return { db, extend, request, expires,
    row: () => db.prepare("SELECT * FROM enrollments WHERE id='enrollment'").get(),
    audits: () => db.prepare('SELECT * FROM enrollment_extension_audit').all() };
}

test('active extension adds days to existing expiry, acknowledges exact values, and records an atomic audit', () => {
  const f = fixture();
  try {
    const result = f.request();
    assert.deepEqual(result, { ok:true, userId:'student', packageId:'pmp', enrollmentId:'enrollment',
      oldExpires:f.expires, expires:f.expires+7*DAY, extendedAt:NOW, mode:'days', days:7, auditId:result.auditId });
    assert.equal(f.row().expires,result.expires);
    assert.deepEqual(f.audits(), [{ id:result.auditId, actor_id:'admin', enrollment_id:'enrollment', user_id:'student',
      package_id:'pmp', old_expires:f.expires, new_expires:result.expires, mode:'days', days:7, created:NOW }]);
  } finally { f.db.close(); }
});

test('expired and exactly-expired enrollment starts from authoritative server time', () => {
  for (const expires of [NOW-200*DAY,NOW]) {
    const f=fixture({expires});
    try { assert.equal(f.request({days:1}).expires,NOW+DAY); }
    finally { f.db.close(); }
  }
});

test('explicit date preserves the supplied UTC instant and records date mode', () => {
  const f=fixture();
  try {
    const target=Date.parse('2026-12-30T23:59:00+03:00');
    const result=f.extend({actorId:'admin',userId:'student',packageId:'pmp',body:{
      expectedEnrollmentId:'enrollment',expectedExpires:f.expires,expiresAt:target}});
    assert.equal(result.expires,target); assert.equal(result.mode,'date'); assert.equal(result.days,null);
    assert.equal(f.audits()[0].new_expires,target);
  } finally { f.db.close(); }
});

test('null and zero unlimited subscriptions remain unchanged and unaudited', () => {
  for (const expires of [null,0]) {
    const f=fixture({expires});
    try {
      assert.throws(()=>f.request(),errorIs(409,'ENROLLMENT_UNLIMITED'));
      assert.equal(f.row().expires,expires); assert.equal(f.audits().length,0);
    } finally { f.db.close(); }
  }
});

test('strict payload validation rejects coerced, missing, ambiguous and out-of-range values', () => {
  const f=fixture();
  const identity={expectedEnrollmentId:'enrollment',expectedExpires:f.expires};
  const bad=[null,[],{}, {days:7}, {...identity}, {...identity,days:1,expiresAt:NOW+100*DAY},
    {...identity,days:1,source:'forged'}, {...identity,days:1,expectedExpires:String(f.expires)},
    {...identity,days:1,expectedEnrollmentId:''}, {...identity,days:1,expectedExpires:NaN},
    ...['7',0,-1,1.5,3651,NaN,Infinity,null,true].map(days=>({...identity,days})),
    ...['2026-12-31',String(NOW+100*DAY),NaN,Infinity,null,true,0,-1,NOW+0.5,
      MAX_ENROLLMENT_EXPIRES+1].map(expiresAt=>({...identity,expiresAt}))];
  try {
    for (const body of bad) assert.throws(()=>f.extend({actorId:'admin',userId:'student',packageId:'pmp',body}),errorIs(400,'INVALID_EXTENSION'));
    assert.equal(f.row().expires,f.expires); assert.equal(f.audits().length,0);
  } finally { f.db.close(); }
});

test('explicit dates must exceed now and current expiry, within the same extension bound', () => {
  for (const expires of [NOW-DAY,NOW+10*DAY]) {
    const f=fixture({expires}), base=Math.max(NOW,expires);
    try {
      for (const target of [NOW-1,NOW,expires,base,base+(MAX_EXTENSION_DAYS+1)*DAY]) {
        assert.throws(()=>f.extend({actorId:'admin',userId:'student',packageId:'pmp',body:{
          expectedEnrollmentId:'enrollment',expectedExpires:expires,expiresAt:target}}),errorIs(400,'INVALID_EXTENSION'));
      }
      assert.equal(f.audits().length,0);
    } finally { f.db.close(); }
  }
});

test('extension limits allow the exact maximum and reject crossing the absolute timestamp cap', () => {
  const f=fixture();
  try { assert.equal(f.request({days:MAX_EXTENSION_DAYS}).expires,f.expires+MAX_EXTENSION_DAYS*DAY); }
  finally { f.db.close(); }
  const g=fixture({expires:MAX_ENROLLMENT_EXPIRES-DAY+1});
  try { assert.throws(()=>g.request({days:1}),errorIs(400,'INVALID_EXTENSION')); assert.equal(g.audits().length,0); }
  finally { g.db.close(); }
});

test('missing user, missing enrollment, wrong learner, and wrong package cannot create an enrollment', () => {
  const f=fixture();
  try {
    for (const [userId,packageId] of [['missing','pmp'],['other','pmp'],['student','missing']])
      assert.throws(()=>f.extend({actorId:'admin',userId,packageId,body:{expectedEnrollmentId:'enrollment',expectedExpires:f.expires,days:1}}),errorIs(404,'ENROLLMENT_NOT_FOUND'));
    f.db.exec("DELETE FROM users WHERE id='student'");
    assert.throws(()=>f.request(),errorIs(404,'ENROLLMENT_NOT_FOUND'));
    assert.equal(f.audits().length,0);
  } finally { f.db.close(); }
});

test('stale date, wrong enrollment ID, and recreated enrollment are conflicts', () => {
  const f=fixture();
  try {
    assert.throws(()=>f.request({expectedExpires:f.expires-1}),errorIs(409,'ENROLLMENT_CHANGED'));
    assert.throws(()=>f.request({expectedEnrollmentId:'other-enrollment'}),errorIs(409,'ENROLLMENT_CHANGED'));
    f.db.exec("DELETE FROM enrollments WHERE id='enrollment'");
    f.db.prepare('INSERT INTO enrollments VALUES(?,?,?,?,?,?)').run('replacement','student','pmp','replacement',f.expires,99);
    assert.throws(()=>f.request(),errorIs(409,'ENROLLMENT_CHANGED'));
    assert.equal(f.audits().length,0);
  } finally { f.db.close(); }
});

test('replaying a successful request cannot add more time or another audit', () => {
  const f=fixture();
  try {
    const first=f.request();
    assert.throws(()=>f.request(),errorIs(409,'ENROLLMENT_CHANGED'));
    assert.equal(f.row().expires,first.expires); assert.equal(f.audits().length,1);
  } finally { f.db.close(); }
});

test('only a current active administrator can mutate, including null-active and deleted actors', () => {
  for (const change of ["UPDATE users SET role='student' WHERE id='admin'",
    "UPDATE users SET active=0 WHERE id='admin'", "UPDATE users SET active=NULL WHERE id='admin'",
    "UPDATE users SET active=2 WHERE id='admin'", "DELETE FROM users WHERE id='admin'"]) {
    const f=fixture();
    try {
      f.db.exec(change); assert.throws(()=>f.request(),errorIs(403,'ACTIVE_ADMIN_REQUIRED'));
      assert.equal(f.row().expires,f.expires); assert.equal(f.audits().length,0);
    } finally { f.db.close(); }
  }
});

test('extension preserves enrollment identity, provenance, progress, payments, certificates, other access and disabled learner state', () => {
  const f=fixture();
  const tables=['users','orders','progress','certificates'];
  try {
    f.db.exec("UPDATE users SET active=0 WHERE id='student'");
    const before=Object.fromEntries(tables.map(table=>[table,f.db.prepare(`SELECT * FROM ${table}`).all()]));
    const original=f.row(), other=f.db.prepare("SELECT * FROM enrollments WHERE id='other-enrollment'").get();
    const result=f.request();
    assert.deepEqual(f.row(),{...original,expires:result.expires});
    assert.deepEqual(f.db.prepare("SELECT * FROM enrollments WHERE id='other-enrollment'").get(),other);
    for (const table of tables) assert.deepEqual(f.db.prepare(`SELECT * FROM ${table}`).all(),before[table]);
  } finally { f.db.close(); }
});

test('failed audit insert rolls back the expiry update', () => {
  const f=fixture();
  try {
    f.db.exec("CREATE TRIGGER deny_audit BEFORE INSERT ON enrollment_extension_audit BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END");
    assert.throws(()=>f.request(),/synthetic audit failure/);
    assert.equal(f.row().expires,f.expires); assert.equal(f.audits().length,0);
  } finally { f.db.close(); }
});

test('two independent SQLite writers racing with one snapshot produce exactly one change and one audit', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alsaeed-extend-race-'));
  const filename=path.join(dir,'synthetic.sqlite');
  const f=fixture({filename});
  const workers=[];
  try {
    const source=`const {parentPort,workerData}=require('node:worker_threads');
      const {DatabaseSync}=require('node:sqlite'); const createTestDatabase=${createTestDatabase.toString()};
      (async()=>{const db=createTestDatabase(workerData.filename);
      const {createEnrollmentExtender}=await import(workerData.module);
      const extend=createEnrollmentExtender({db,now:()=>workerData.now});
      parentPort.postMessage('ready'); parentPort.once('message',()=>{try {
        parentPort.postMessage({status:200,result:extend(workerData.input)});
      } catch(e) {parentPort.postMessage({status:e.status,code:e.code});} finally {db.close();}});})();`;
    for(let i=0;i<2;i++) workers.push(new Worker(source,{eval:true,workerData:{filename,now:NOW,
      module:new URL('../enrollment-extensions.js',import.meta.url).href,
      input:{actorId:'admin',userId:'student',packageId:'pmp',body:{expectedEnrollmentId:'enrollment',expectedExpires:f.expires,days:7}}}}));
    await Promise.all(workers.map(worker=>once(worker,'message')));
    const pending=workers.map(worker=>once(worker,'message'));
    workers.forEach(worker=>worker.postMessage('go'));
    const results=(await Promise.all(pending)).map(([value])=>value);
    assert.deepEqual(results.map(value=>value.status).sort(),[200,409]);
    assert.equal(results.find(value=>value.status===409).code,'ENROLLMENT_CHANGED');
    assert.equal(f.row().expires,f.expires+7*DAY); assert.equal(f.audits().length,1);
  } finally { await Promise.all(workers.map(worker=>worker.terminate())); f.db.close(); fs.rmSync(dir,{recursive:true,force:true}); }
});

test('actual Bearer auth and existing lesson access gate deny expired access, restore it after extension, and reject old disabled/demoted/deleted admin tokens', async () => {
  const f=fixture({expires:Date.now()-DAY});
  const app=express(); app.use(express.json());
  const JWT_SECRET='local-synthetic-extension-test';
  const source=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
  // Exercise the unchanged production handlers, not a recreated access model.
  const authSource=source.slice(source.indexOf('function auth(req, res, next)'),source.indexOf('function admin(req, res, next)'));
  const auth=new Function('db','jwt','JWT_SECRET',authSource+'; return auth;')(f.db,jwt,JWT_SECRET);
  new Function('app','db','jwt','JWT_SECRET','setting',
    source.slice(source.indexOf("app.get('/api/lessons/:pkg'"),source.indexOf("app.get('/api/lesson-files/:id'")))(app,f.db,jwt,JWT_SECRET,()=> '[]');
  mountEnrollmentExtensions({app,db:f.db,auth});
  const server=app.listen(0,'127.0.0.1'); await once(server,'listening');
  const origin=`http://127.0.0.1:${server.address().port}`;
  const token=id=>jwt.sign({id,role:'admin'},JWT_SECRET,{expiresIn:'1h'});
  const adminToken=token('admin'),studentToken=token('student');
  const body={expectedEnrollmentId:'enrollment',expectedExpires:f.expires,days:1};
  const send=(bearer=adminToken,payload=body)=>fetch(origin+'/api/admin/users/student/enrollments/pmp/extend',{
    method:'POST',headers:{'content-type':'application/json',...(bearer?{authorization:'Bearer '+bearer}:{})},body:JSON.stringify(payload)});
  const lessons=async()=> (await fetch(origin+'/api/lessons/pmp',{headers:{authorization:'Bearer '+studentToken}})).json();
  try {
    assert.equal((await lessons())[0].vimeo,null);
    assert.equal((await send(null)).status,401);
    assert.equal((await send('invalid-token')).status,401);
    assert.equal((await send(studentToken)).status,403);
    assert.equal((await send(jwt.sign({id:'admin'},JWT_SECRET,{expiresIn:-1}))).status,401);
    for (const sql of ["UPDATE users SET active=0 WHERE id='admin'","UPDATE users SET active=1,role='student' WHERE id='admin'"]) {
      f.db.exec(sql); const denied=await send(); assert.equal(denied.status,403); assert.equal((await denied.json()).code,'ACTIVE_ADMIN_REQUIRED');
    }
    f.db.exec("UPDATE users SET active=1,role='admin' WHERE id='admin'");
    const response=await send(); assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'no-store');
    const result=await response.json(); assert.equal(result.expires,result.extendedAt+DAY);
    assert.equal((await lessons())[0].vimeo,'12345');
    assert.equal((await send()).status,409);
    f.db.exec("UPDATE users SET active=0 WHERE id='student'");
    assert.equal((await lessons())[0].vimeo,null,'extending must not enable an inactive learner');
    f.db.exec("DELETE FROM users WHERE id='admin'");
    assert.equal((await send()).status,401);
    assert.equal(f.audits().length,1);
  } finally { await new Promise(resolve=>server.close(resolve)); f.db.close(); }
});

test('Docker explicitly copies and allows the imported extension helper', () => {
  const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
  assert.match(read('server.js'),/import \{ mountEnrollmentExtensions \} from '\.\/enrollment-extensions\.js'/);
  assert.match(read('Dockerfile'),/^COPY .*\benrollment-extensions\.js\b.* \.\/$/m);
  assert.match(read('.dockerignore'),/^!enrollment-extensions\.js$/m);
});
