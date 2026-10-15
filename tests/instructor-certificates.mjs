import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import {
  createCertificateService, initializeInstructorRegistry, mountCertificateRoutes,
  mountInstructorRegistry, publicInstructors, validatePackageInstructors
} from '../instructor-certificates.js';

// Node's bundled SQLite gives these synthetic tests real SQL transactions without
// relying on a native addon built for a different Node version. Production uses
// the existing better-sqlite3 dependency and its equivalent transaction interface.
function database() {
  const db = new DatabaseSync(':memory:');
  db.transaction = fn => {
    const run = mode => (...args) => {
      db.exec('BEGIN ' + mode);
      try { const result = fn(...args); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    };
    const wrapped = run('DEFERRED');
    wrapped.immediate = run('IMMEDIATE');
    return wrapped;
  };
  db.exec(`CREATE TABLE settings(k TEXT PRIMARY KEY,v TEXT);
    CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,pass TEXT,role TEXT,active INTEGER);
    CREATE TABLE enrollments(user_id TEXT,package_id TEXT,source TEXT,expires INTEGER,UNIQUE(user_id,package_id));
    CREATE TABLE lessons(package_id TEXT,idx INTEGER,vimeo TEXT,PRIMARY KEY(package_id,idx));
    CREATE TABLE progress(user_id TEXT,package_id TEXT,data TEXT,PRIMARY KEY(user_id,package_id));
    CREATE TABLE certificates(no TEXT PRIMARY KEY,user_id TEXT,package_id TEXT,name TEXT,course TEXT,hours INTEGER,issued INTEGER);`);
  return db;
}

function fixture() {
  const db = database(), timestamp = Date.UTC(2026, 9, 15);
  const setting = key => db.prepare('SELECT v FROM settings WHERE k=?').get(key)?.v || '';
  const setSetting = (key, value) => db.prepare('INSERT INTO settings(k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(key, value);
  const save = (key, value) => setSetting(key, JSON.stringify(value));
  const read = key => JSON.parse(setting(key) || '[]');
  const pkg = { id:'pmp-full', course:'pmp', type:'full', cert:true, active:true, hours:35, instructorId:'trainer-one' };
  const trainer = { id:'trainer-one', nameEn:'Dr. Example Trainer', nameAr:'مدرب تجريبي', titleEn:'Course Instructor',
    titleAr:'مدرب الدورة', signatureName:'Example Trainer', active:true,
    badges:[{ courseId:'pmp',asset:'/assets/badges/pmi-atp-instructor-pmp-supplied.png',label:'Verified instructor',verified:true }] };
  save('content_packages', [pkg]); save('catalog', [{...pkg}]);
  save('content_courses', [{id:'pmp',en:'Project Management Professional',code:'PMP®',hours:35},
    {id:'grcp',en:'Governance, Risk and Compliance',code:'GRCP',hours:24}]);
  save('content_instructors', [trainer]);
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run('student','Synthetic Learner','student@example.invalid','unused','student',1);
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run('other','Other Learner','other@example.invalid','unused','student',1);
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run('admin','Synthetic Admin','admin@example.invalid','unused','admin',1);
  db.prepare('INSERT INTO enrollments VALUES (?,?,?,?)').run('student',pkg.id,'admin grant',null);
  db.prepare('INSERT INTO lessons VALUES (?,?,?)').run(pkg.id,0,'1001');
  db.prepare('INSERT INTO lessons VALUES (?,?,?)').run(pkg.id,5,'1002');
  db.prepare('INSERT INTO lessons VALUES (?,?,?)').run(pkg.id,9,'   ');
  db.prepare('INSERT INTO progress VALUES (?,?,?)').run('student',pkg.id,JSON.stringify({lessons:{0:true,5:true}}));
  const options = {db,setting,setSetting,uid:()=>crypto.randomBytes(9).toString('base64url'),site:'https://al-ltc.com',now:()=>timestamp};
  const service = createCertificateService(options);
  const issue = body => service.issue('student',pkg.id,body || {englishName:'Synthetic Learner'});
  return { db, timestamp, setting, setSetting, save, read, pkg, trainer, options, service, issue };
}
const status = expected => error => error.status === expected;
const count = f => f.db.prepare('SELECT COUNT(*) n FROM certificates').get().n;

test('valid complete full package with a complimentary admin enrollment gets an immutable authoritative snapshot', () => {
  const f = fixture();
  try {
    const record = f.issue({englishName:'Synthetic Learner',course:'Fake course',hours:999,instructor:{name:'Impostor'},
      presentation:{courseLogo:'https://evil.invalid/a.png'},verify:'https://evil.invalid'});
    assert.equal(record.course,'Project Management Professional (PMP) Preparation Course');
    assert.equal(record.hours,35); assert.equal(record.presentation.instructor.name,'Dr. Example Trainer');
    assert.equal(record.presentation.courseLogo,'/assets/certifications/pmp.jpeg');
    assert.equal(record.presentation.instructor.badge.verified,true);
    assert.match(record.verify,/^https:\/\/al-ltc\.com\/verify\/[a-f0-9]{48}$/);
    assert.equal(count(f),1);
    assert.deepEqual(f.service.verify(record.verify.split('/').pop()),
      Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'verify')));
    assert.equal(f.service.verify(record.no),null, 'new serial is not a public lookup key');
  } finally { f.db.close(); }
});

test('sim, review, self, free, individual and absent types deny even when catalog falsely enables certificates', () => {
  for (const type of ['sim','review','self','free','individual',null,'FULL']) {
    const f = fixture();
    try {
      f.save('content_packages',[{...f.pkg,type}]);
      f.save('catalog',[{...f.pkg,type:'full',cert:true}]);
      assert.throws(()=>f.issue(),status(400)); assert.equal(count(f),0,type);
    } finally { f.db.close(); }
  }
});

test('missing catalog, missing package/course, inactive package, or disabled certificate cannot issue', () => {
  for (const alter of [f=>f.save('catalog',[]),f=>f.save('content_packages',[]),f=>f.save('content_courses',[]),
    f=>f.save('content_packages',[{...f.pkg,active:false}]),f=>f.save('content_packages',[{...f.pkg,cert:false}]),
    f=>f.save('catalog',[{...f.pkg,cert:false}])]) {
    const f=fixture();
    try { alter(f); assert.throws(()=>f.issue(),status(400)); assert.equal(count(f),0); }
    finally { f.db.close(); }
  }
});

test('ownership, active access and active user are required for new issuance', () => {
  for (const alter of [f=>f.db.exec('DELETE FROM enrollments'),
    f=>f.db.prepare('UPDATE enrollments SET expires=?').run(f.timestamp),
    f=>f.db.exec("UPDATE users SET active=0 WHERE id='student'")]) {
    const f=fixture();
    try { alter(f); assert.throws(()=>f.issue(),status(403)); assert.equal(count(f),0); }
    finally { f.db.close(); }
  }
});

test('zero real videos, incomplete actual video indexes, forged truthy progress and corrupt progress deny', () => {
  for (const alter of [f=>f.db.exec('DELETE FROM lessons'),
    f=>f.db.exec("UPDATE lessons SET vimeo='   '"),
    f=>f.db.prepare('UPDATE progress SET data=?').run(JSON.stringify({lessons:{0:true,9:true,77:true}})),
    f=>f.db.prepare('UPDATE progress SET data=?').run(JSON.stringify({lessons:{0:true,5:'false'}})),
    f=>f.db.exec("UPDATE progress SET data='invalid'"),
    f=>f.db.exec("UPDATE progress SET data='null'")]) {
    const f=fixture();
    try { alter(f); assert.throws(()=>f.issue(),status(400)); assert.equal(count(f),0); }
    finally { f.db.close(); }
  }
});

test('same-course language alias checks canonical video indexes against the enrolled package progress', () => {
  const f=fixture();
  try {
    f.save('content_packages',[{...f.pkg,sourcePackageId:'pmp-source'},{id:'pmp-source',course:'pmp',type:'full'}]);
    f.db.exec("UPDATE lessons SET package_id='pmp-source'");
    const record=f.issue(); assert.equal(record.presentation.courseId,'pmp'); assert.equal(count(f),1);
  } finally { f.db.close(); }
  for (const source of [{id:'source',course:'grcp'},null,{id:'source',course:'pmp',sourcePackageId:'pmp-full'}]) {
    const g=fixture();
    try {
      g.save('content_packages',[{...g.pkg,sourcePackageId:'source'},...(source?[source]:[])]);
      assert.throws(()=>g.issue(),status(400)); assert.equal(count(g),0);
    } finally { g.db.close(); }
  }
});

test('an unrelated source progress record cannot complete the enrolled alias', () => {
  const f=fixture();
  try {
    f.save('content_packages',[{...f.pkg,sourcePackageId:'pmp-source'},{id:'pmp-source',course:'pmp'}]);
    f.db.exec("UPDATE lessons SET package_id='pmp-source'; UPDATE progress SET package_id='pmp-source'");
    assert.throws(()=>f.issue(),status(400)); assert.equal(count(f),0);
  } finally { f.db.close(); }
});

test('duplicate requests and edited profiles/catalogs reprint the first saved record without mutation', () => {
  const f=fixture();
  try {
    const original=f.issue();
    const before=f.db.prepare('SELECT * FROM certificates').get();
    f.save('content_instructors',[{...f.trainer,nameEn:'Changed Trainer',active:false}]);
    f.save('content_packages',[{...f.pkg,type:'self',cert:false,hours:99}]);
    f.save('catalog',[]); f.db.exec('DELETE FROM lessons; DELETE FROM progress');
    f.db.prepare('UPDATE enrollments SET expires=?').run(f.timestamp-1);
    assert.deepEqual(f.issue({englishName:'Changed Student'}),original);
    assert.deepEqual(f.db.prepare('SELECT * FROM certificates').get(),before);
    assert.deepEqual(f.service.getOwned('student',original.no),{...original,packageId:f.pkg.id});
    assert.throws(()=>f.service.getOwned('other',original.no),status(404));
    assert.equal(count(f),1);
  } finally { f.db.close(); }
});

test('legacy partial-package certificates preserve saved fields and no instructor is invented', () => {
  const f=fixture();
  try {
    f.db.prepare('INSERT INTO certificates(no,user_id,package_id,name,course,hours,issued) VALUES (?,?,?,?,?,?,?)')
      .run('AS-LEGACY','student',f.pkg.id,'Historic Name','Historic Course',12,1234567890000);
    f.save('content_packages',[{...f.pkg,type:'review',cert:false}]); f.save('catalog',[]);
    const before=f.db.prepare('SELECT * FROM certificates').get(), record=f.issue({});
    assert.equal(record.course,'Historic Course'); assert.equal(record.name,'Historic Name');
    assert.equal(record.hours,12); assert.equal(record.issued,1234567890000);
    assert.equal(record.presentation,null); assert.equal(record.verify,'https://al-ltc.com/verify/AS-LEGACY');
    assert.equal(f.service.verify('AS-LEGACY').name,'Historic Name');
    f.db.exec('DELETE FROM enrollments');
    assert.deepEqual(f.service.getOwned('student','AS-LEGACY'),{...record,packageId:f.pkg.id});
    assert.deepEqual(f.db.prepare('SELECT * FROM certificates').get(),before);
  } finally { f.db.close(); }
});

test('unknown, invalid and revoked verification identifiers disclose no valid record', () => {
  const f=fixture();
  try {
    const record=f.issue(), token=record.verify.split('/').pop();
    assert.equal(f.service.verify('unknown'),null); assert.equal(f.service.verify('../secret'),null);
    f.db.prepare('UPDATE certificates SET revoked_at=? WHERE no=?').run(f.timestamp,record.no);
    assert.equal(f.service.verify(token),null); assert.throws(()=>f.issue(),status(403));
    assert.throws(()=>f.service.getOwned('student',record.no),status(403));
    assert.deepEqual(f.service.listOwned('student'),[]); assert.equal(count(f),1);
  } finally { f.db.close(); }
});

test('snapshot credential requires explicit active instructor, verified course badge and approved asset', () => {
  for (const patch of [{active:false},{badges:[{courseId:'pmp',asset:'/assets/badges/pmi-atp-instructor-pmp-supplied.png',verified:false}]},
    {badges:[{courseId:'rmp',asset:'/assets/badges/pmi-atp-instructor-rmp.png',verified:true}]},
    {badges:[{courseId:'pmp',asset:'https://evil.invalid/pmp.png',verified:true}]}]) {
    const f=fixture();
    try {
      f.save('content_instructors',[{...f.trainer,...patch,signatureAsset:'https://evil.invalid/sign.svg'}]);
      const record=f.issue(); assert.equal(record.presentation.instructor?.badge ?? null,null);
      assert.equal(record.presentation.instructor?.signatureAsset ?? null,null);
    } finally { f.db.close(); }
  }
});

test('non-PMP full course metadata uses its own approved logo and never inherits a PMP badge', () => {
  const f=fixture();
  try {
    f.save('content_packages',[{...f.pkg,course:'grcp',hours:24}]);
    const result=f.issue(); assert.equal(result.course,'Governance, Risk and Compliance');
    assert.equal(result.hours,24); assert.equal(result.presentation.courseLogo,'/assets/certifications/grcp.webp');
    assert.equal(result.presentation.instructor.badge,null);
  } finally { f.db.close(); }
});

test('public instructor projection drops contact, credentials and account fields', () => {
  const f=fixture();
  try {
    f.save('content_instructors',[{...f.trainer,email:'secret@example.invalid',phone:'private',password:'secret',role:'admin',token:'private'}]);
    const publicJson=JSON.stringify(publicInstructors(f.setting));
    for(const secret of ['secret@example.invalid','private','password','role','token']) assert(!publicJson.includes(secret));
    assert.equal(publicInstructors(f.setting)[0].active,true);
    assert.throws(()=>validatePackageInstructors([{id:'new',instructorId:'not-real'}],f.setting),status(422));
  } finally { f.db.close(); }
});

test('bounded instructor migration preserves unrelated catalog data and never reseeds edited existing registries', () => {
  const f=fixture();
  try {
    f.db.exec("DELETE FROM settings WHERE k='content_instructors'");
    f.save('content_packages',[{id:'a',course:'pmp',price:123,custom:{keep:true}},
      {id:'b',course:'rmp',instructorId:'already-assigned'},{id:'c',course:'grcp'},{id:'d',course:'acp'}]);
    initializeInstructorRegistry(f.options);
    const profiles=f.read('content_instructors'), packages=f.read('content_packages');
    assert.equal(profiles.length,1); assert.equal(profiles[0].id,'mohamed-attia');
    assert.deepEqual(packages[0],{id:'a',course:'pmp',price:123,custom:{keep:true},instructorId:'mohamed-attia'});
    assert.equal(packages[1].instructorId,'already-assigned'); assert.equal(packages[2].instructorId,undefined);
    assert.equal(packages[3].instructorId,'mohamed-attia');
    f.save('content_instructors',[]); initializeInstructorRegistry(f.options);
    assert.deepEqual(f.read('content_instructors'),[]);
  } finally { f.db.close(); }
  const g=fixture();
  try {
    const before=g.setting('content_instructors'), packages=g.setting('content_packages');
    initializeInstructorRegistry(g.options);
    assert.equal(g.setting('content_instructors'),before); assert.equal(g.setting('content_packages'),packages);
  } finally { g.db.close(); }
});

const require = createRequire(process.env.ALSAEED_TEST_MODULE_ROOT ? process.env.ALSAEED_TEST_MODULE_ROOT + '/package.json' : import.meta.url);
const express = require('express'), QRCode = require('qrcode');
async function httpFixture() {
  const f=fixture(), app=express(); app.use(express.json());
  const auth=(req,res,next)=>{
    const id=(req.headers.authorization||'').replace(/^Bearer /,'');
    const user=f.db.prepare('SELECT id,role FROM users WHERE id=?').get(id);
    if(!user)return res.status(401).json({error:'login'}); req.user=user; next();
  };
  const admin=(req,res,next)=>req.user.role==='admin'?next():res.status(403).json({error:'admin'});
  let brokenQr=false;
  mountInstructorRegistry({...f.options,app,auth,admin});
  mountCertificateRoutes({...f.options,app,auth,createQr:value=>brokenQr?Promise.reject(new Error('synthetic failure')):
    QRCode.toDataURL(value,{errorCorrectionLevel:'M',margin:2,width:220})});
  app.use((error,req,res,next)=>res.status(500).json({error:error.message}));
  const server=await new Promise(resolve=>{const listening=app.listen(0,'127.0.0.1',()=>resolve(listening));});
  const origin='http://127.0.0.1:'+server.address().port;
  const request=async(method,path,body,who='student')=>{
    const response=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(who?{Authorization:'Bearer '+who}:{})},
      ...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:response.status,body:await response.json()};
  };
  return {...f,request,setQrFailure:value=>{brokenQr=value;},close:async()=>{await new Promise(resolve=>server.close(resolve));f.db.close();}};
}

test('HTTP registry and package mutations require admin; profiles never create auth accounts', async()=>{
  const f=await httpFixture();
  try {
    for(const [method,path,body] of [['GET','/api/admin/instructors'],['POST','/api/admin/instructors',{nameEn:'New Trainer'}],
      ['PUT','/api/admin/instructors/trainer-one',{nameEn:'Other'}],['DELETE','/api/admin/instructors/trainer-one'],
      ['PUT','/api/admin/packages/pmp-full/instructor',{instructorId:null}]]) {
      assert.equal((await f.request(method,path,body,'student')).status,403);
      assert.equal((await f.request(method,path,body,null)).status,401);
    }
    const before=f.db.prepare('SELECT COUNT(*) n FROM users').get().n;
    const created=await f.request('POST','/api/admin/instructors',{nameEn:'New Trainer',nameAr:'مدرب جديد'},'admin');
    assert.equal(created.status,201);
    const id=created.body.instructor.id;
    assert.equal((await f.request('PUT','/api/admin/packages/pmp-full/instructor',{instructorId:id},'admin')).status,200);
    assert.equal((await f.request('PUT','/api/admin/instructors/'+id,{titleEn:'Updated Title'},'admin')).status,200);
    const deactivated=await f.request('DELETE','/api/admin/instructors/'+id,undefined,'admin');
    assert.equal(deactivated.status,200); assert.equal(deactivated.body.instructor.active,false);
    assert(f.read('content_instructors').some(p=>p.id===id));
    assert(!publicInstructors(f.setting).some(p=>p.id===id));
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM users').get().n,before);
    assert.equal(f.read('content_packages')[0].instructorId,id);
  } finally { await f.close(); }
});

test('HTTP registry rejects auth fields, unverified/mismatched badges and external signature assets', async()=>{
  const f=await httpFixture();
  try {
    for(const input of [{nameEn:'Trainer',role:'admin'},{nameEn:'Trainer',email:'private@example.invalid'},
      {nameEn:'Trainer',signatureAsset:'https://evil.invalid/sign.svg'},
      {nameEn:'Trainer',badges:[{courseId:'__proto__',asset:'anything',label:'Invalid',verified:true}]},
      {nameEn:'Trainer',badges:[{courseId:'pmp',asset:'/assets/badges/pmi-atp-instructor-rmp.png',label:'Mismatch',verified:true}]},
      {nameEn:'Trainer',badges:[{courseId:'pmp',asset:'/assets/badges/pmi-atp-instructor-pmp-supplied.png',label:'Unverified'}]}])
      assert.equal((await f.request('POST','/api/admin/instructors',input,'admin')).status,400);
    assert.equal((await f.request('PUT','/api/admin/packages/pmp-full/instructor',{instructorId:'not-real'},'admin')).status,422);
  } finally { await f.close(); }
});

test('disabled admins cannot read or mutate the new instructor registry with an old token', async()=>{
  const f=await httpFixture();
  try {
    f.db.exec("UPDATE users SET active=0 WHERE id='admin'");
    const registry=f.setting('content_instructors'), packages=f.setting('content_packages');
    for(const [method,path,body] of [['GET','/api/admin/instructors'],['POST','/api/admin/instructors',{nameEn:'New Trainer'}],
      ['PUT','/api/admin/instructors/trainer-one',{nameEn:'Other'}],['DELETE','/api/admin/instructors/trainer-one'],
      ['PUT','/api/admin/packages/pmp-full/instructor',{instructorId:null}]])
      assert.equal((await f.request(method,path,body,'admin')).status,403);
    assert.equal(f.setting('content_instructors'),registry); assert.equal(f.setting('content_packages'),packages);
  } finally { await f.close(); }
});

test('disabled users cannot issue, reprint or read owned history; expired enrollment alone keeps historic access', async()=>{
  const f=await httpFixture();
  try {
    const issued=await f.request('POST','/api/certificate/pmp-full',{englishName:'Synthetic Learner'});
    assert.equal(issued.status,200);
    const cert=issued.body, before=f.db.prepare('SELECT * FROM certificates').get();
    f.db.prepare('UPDATE enrollments SET expires=?').run(f.timestamp-1);
    assert.equal((await f.request('POST','/api/certificate/pmp-full',{})).status,200);
    const saved=await f.request('GET','/api/certificates/'+cert.no);
    assert.equal(saved.status,200); assert.equal(saved.body.packageId,'pmp-full');
    assert.equal((await f.request('GET','/api/certificates')).status,200);
    f.db.exec("UPDATE users SET active=0 WHERE id='student'");
    for(const [method,path,body] of [['POST','/api/certificate/pmp-full',{}],
      ['GET','/api/certificates'],['GET','/api/certificates/'+cert.no]])
      assert.equal((await f.request(method,path,body)).status,403);
    assert.deepEqual(f.db.prepare('SELECT * FROM certificates').get(),before); assert.equal(count(f),1);
    // Account disablement is access control, not a retrospective award revocation.
    assert.equal((await f.request('GET','/api/verify/'+cert.verify.split('/').pop(),undefined,null)).status,200);
  } finally { await f.close(); }
});

test('optional registry and assignment concurrency guards return 409 without overwriting newer edits', async()=>{
  const f=await httpFixture();
  try {
    const made=await f.request('POST','/api/admin/instructors',{nameEn:'Concurrent Trainer'},'admin');
    const profile=made.body.instructor;
    const updated=await f.request('PUT','/api/admin/instructors/'+profile.id,{titleEn:'New title',expectedUpdated:profile.updated},'admin');
    assert.equal(updated.status,200); assert(updated.body.instructor.updated>profile.updated);
    assert.equal((await f.request('PUT','/api/admin/instructors/'+profile.id,{titleEn:'Stale title',expectedUpdated:profile.updated},'admin')).status,409);
    assert.equal((await f.request('DELETE','/api/admin/instructors/'+profile.id,{expectedUpdated:profile.updated},'admin')).status,409);
    assert.equal(f.read('content_instructors').find(p=>p.id===profile.id).titleEn,'New title');
    assert.equal((await f.request('PUT','/api/admin/packages/pmp-full/instructor',{instructorId:profile.id,expectedInstructorId:'trainer-one'},'admin')).status,200);
    assert.equal((await f.request('PUT','/api/admin/packages/pmp-full/instructor',{instructorId:null,expectedInstructorId:'trainer-one'},'admin')).status,409);
    assert.equal(f.read('content_packages')[0].instructorId,profile.id);
    assert.equal((await f.request('DELETE','/api/admin/instructors/'+profile.id,{expectedUpdated:updated.body.instructor.updated},'admin')).status,200);
  } finally { await f.close(); }
});

test('HTTP QR creation, retry, owned history and verification preserve issuance and block other users', async()=>{
  const f=await httpFixture();
  try {
    f.setQrFailure(true);
    const failed=await f.request('POST','/api/certificate/pmp-full',{englishName:'Synthetic Learner'});
    assert.equal(failed.status,503); assert.equal(failed.body.code,'CERTIFICATE_QR_UNAVAILABLE'); assert.equal(count(f),1);
    const before=f.db.prepare('SELECT * FROM certificates').get();
    f.setQrFailure(false);
    const printed=await f.request('POST','/api/certificate/pmp-full',{englishName:'Changed Name'});
    assert.equal(printed.status,200); assert.match(printed.body.qr,/^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
    assert.equal(printed.body.name,'Synthetic Learner'); assert.deepEqual(f.db.prepare('SELECT * FROM certificates').get(),before);
    const cert=printed.body, token=cert.verify.split('/').pop();
    assert.equal((await f.request('GET','/api/verify/'+token,undefined,null)).status,200);
    assert.equal((await f.request('GET','/api/verify/'+cert.no,undefined,null)).status,404);
    assert.equal((await f.request('GET','/api/verify/invalid',undefined,null)).status,404);
    const publicJson=JSON.stringify((await f.request('GET','/api/verify/'+token,undefined,null)).body);
    for(const forbidden of ['email','user_id','package_id','packageId','verify_token','revoked_at','pass']) assert(!publicJson.includes(forbidden));
    f.db.exec('DELETE FROM enrollments');
    assert.equal((await f.request('GET','/api/certificates/'+cert.no)).status,200);
    assert.equal((await f.request('GET','/api/certificates/'+cert.no,undefined,'other')).status,404);
    assert.equal((await f.request('GET','/api/certificates/'+cert.no,undefined,null)).status,401);
    const list=await f.request('GET','/api/certificates'); assert.equal(list.body.certificates.length,1);
    assert.equal(list.body.certificates[0].packageId,'pmp-full');
    assert.deepEqual((await f.request('GET','/api/certificates',undefined,'other')).body.certificates,[]);
    if(process.env.ALSAEED_QR_FIXTURE)fs.writeFileSync(process.env.ALSAEED_QR_FIXTURE,JSON.stringify(cert,null,2));
    f.db.prepare('UPDATE certificates SET revoked_at=?').run(f.timestamp);
    assert.equal((await f.request('GET','/api/verify/'+token,undefined,null)).status,404);
    assert.equal((await f.request('GET','/api/certificates/'+cert.no)).status,403);
    assert.equal(count(f),1);
  } finally { await f.close(); }
});
