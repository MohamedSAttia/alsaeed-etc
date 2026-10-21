import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { installV16 } from '../v16-backend.js';
import { createManualInvoiceIssuer } from '../manual-invoices.js';
import fs from 'node:fs';
const now=Date.now();
// Real SQLite through the production API shape, without a Node-version-specific addon.
function testDatabase(){
 const db=new DatabaseSync(':memory:');const prepare=db.prepare.bind(db);let serial=0;
 db.prepare=sql=>{const statement=prepare(sql);return {run:(...args)=>statement.run(...args),get:(...args)=>{const row=statement.get(...args);return row?{...row}:undefined},all:(...args)=>statement.all(...args).map(row=>({...row}))}};
 db.pragma=sql=>db.prepare('PRAGMA '+sql).all();
 db.transaction=fn=>{const wrapped=(...args)=>{const name='test_tx_'+(++serial);db.exec('SAVEPOINT '+name);try{const result=fn(...args);db.exec('RELEASE '+name);return result}catch(error){db.exec('ROLLBACK TO '+name);db.exec('RELEASE '+name);throw error}};wrapped.immediate=wrapped;return wrapped};
 return db;
}
function fixture(){
 const db=testDatabase();
 db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,active INTEGER);
 CREATE TABLE settings(k TEXT PRIMARY KEY,v TEXT);
 CREATE TABLE enrollments(id TEXT PRIMARY KEY,user_id TEXT,package_id TEXT,source TEXT,expires INTEGER,created INTEGER);
 CREATE TABLE orders(id TEXT PRIMARY KEY,user_id TEXT,package_id TEXT,amount REAL,currency TEXT,status TEXT,gateway TEXT,gateway_id TEXT,created INTEGER,paid_at INTEGER);
 CREATE TABLE questions(id TEXT PRIMARY KEY,package_id TEXT,domain TEXT,topic TEXT,difficulty TEXT,type TEXT,question_ar TEXT,question_en TEXT,options TEXT,correct TEXT,explanation_ar TEXT,explanation_en TEXT,reference TEXT,active INTEGER,created INTEGER,updated INTEGER);
 INSERT INTO users VALUES('owner','Synthetic Owner','owner@example.invalid','admin',1),('student','Synthetic Learner','student@example.invalid','student',1),('staff','Staff','staff@example.invalid','admin',1);
 INSERT INTO enrollments VALUES('enrollment','student','test-full','إضافة إدارية',${now+86400000},1);
 INSERT INTO settings VALUES('catalog','[{"id":"test-full","ar":"Synthetic course"}]');`);
 let id=0;
 const setting=k=>db.prepare('SELECT v FROM settings WHERE k=?').get(k)?.v;
 const uid=()=>`synthetic-${++id}`;
 const originalOwner=process.env.ADMIN_EMAIL;process.env.ADMIN_EMAIL='owner@example.invalid';
 const api=installV16({db,uid,setting,setSetting:()=>{},grant:()=>{throw Error('must not grant access')},sendJson:(res,status,data)=>({status,data}),readJson:async req=>req.body,jwtSecret:'synthetic-test-secret'});
 if(originalOwner===undefined)delete process.env.ADMIN_EMAIL;else process.env.ADMIN_EMAIL=originalOwner;
 const issue=createManualInvoiceIssuer({db,uid,config:api.config,createInvoice:api.createInvoice,markPaid:api.markPaid,ownerEmail:'owner@example.invalid',now:()=>now});
 const body={email:'student@example.invalid',packageId:'test-full',amount:114,currency:'EGP',country:'EG',paymentMethod:'cash',paymentReference:'',paymentReceivedAt:now-10000,paymentReceived:true,approveInvoice:true};
 return {db,api,issue,body};
}
const rejected=status=>e=>e.status===status;
for(const [label,change] of [['unpaid',{paymentReceived:false}],['no approval',{approveInvoice:false}],['truthy strings',{paymentReceived:'true',approveInvoice:'true'}],['no amount',{amount:''}],['negative',{amount:-1}],['precision',{amount:1.234}],['currency',{currency:'XYZ'}],['future',{paymentReceivedAt:now+1}],['missing reference',{paymentMethod:'bank_transfer'}],['missing country',{country:''}]])test('Reject '+label+' with no financial write',()=>{
 const {db,issue,body}=fixture();assert.throws(()=>issue('owner',{...body,...change}),rejected(400));
 assert.equal(db.prepare('SELECT COUNT(*) n FROM invoices').get().n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,0);db.close();
});
test('Only active configured owner can approve',()=>{const {db,issue,body}=fixture();for(const actor of ['student','staff','missing'])assert.throws(()=>issue(actor,body),rejected(403));db.prepare("UPDATE users SET active=0 WHERE id='owner'").run();assert.throws(()=>issue('owner',body),rejected(403));db.close()});
test('Actual amount, existing tax rules, audit, and idempotency; enrollment unchanged',()=>{
 const {db,issue,body}=fixture(),before=db.prepare('SELECT * FROM enrollments').all();
 const first=issue('owner',body);assert.equal(first.invoice.status,'issued');assert.equal(first.invoice.total,114);assert.equal(first.invoice.subtotal,100);assert.equal(first.invoice.tax_amount,14);
 assert.equal(db.prepare('SELECT * FROM manual_invoice_approvals').get().approved_by,'owner');
 assert.equal(db.prepare('SELECT * FROM orders').get().paid_at,body.paymentReceivedAt);
 assert.deepEqual(db.prepare('SELECT * FROM enrollments').all(),before);
 assert.equal(issue('owner',body).invoice.id,first.invoice.id);assert.equal(issue('owner',body).duplicate,true);
 assert.throws(()=>issue('owner',{...body,amount:115}),rejected(409));
 assert.equal(db.prepare('SELECT COUNT(*) n FROM invoices').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,1);db.close();
});
test('No active enrollment or missing package is not billable',()=>{const {db,issue,body}=fixture();db.prepare('UPDATE enrollments SET expires=?').run(now);assert.throws(()=>issue('owner',body),rejected(400));assert.throws(()=>issue('owner',{...body,packageId:'missing'}),rejected(400));db.close()});
test('Existing checkout invoice preserved, not duplicated; normal checkout issue unchanged',()=>{const {db,api,issue,body}=fixture();const user=db.prepare("SELECT * FROM users WHERE id='student'").get();api.createInvoice('checkout',user,200,'EGP',{packageId:'test-full',country:'EG'});let before=db.prepare('SELECT * FROM invoices').get();assert.equal(before.status,'pending');assert.throws(()=>issue('owner',body),rejected(409));assert.deepEqual(db.prepare('SELECT * FROM invoices').get(),before);api.markPaid('checkout',123);assert.equal(db.prepare('SELECT * FROM invoices').get().status,'issued');assert.equal(db.prepare('SELECT * FROM invoices').get().issued_at,123);db.close()});
test('Legacy paid order without invoice prevents duplicate accounting',()=>{const {db,issue,body}=fixture();db.prepare("INSERT INTO orders(id,user_id,package_id,status) VALUES('old','student','test-full','paid')").run();assert.throws(()=>issue('owner',body),rejected(409));assert.equal(db.prepare('SELECT COUNT(*) n FROM invoices').get().n,0);db.close()});
test('Invalid tax country rolls back order and audit too',()=>{const {db,issue,body}=fixture();assert.throws(()=>issue('owner',{...body,country:'XX'}));for(const table of ['orders','invoices','manual_invoice_approvals'])assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,0);db.close()});
test('Admin endpoint requires actor and both explicit approvals',async()=>{const {db,api,body}=fixture();assert.equal((await api.handleAdmin({body},{},['manual-invoices'],'POST')).status,403);db.close()});
test('Enrollment and bulk-grant handlers still do not create financial records',()=>{
 const proxy=fs.readFileSync(new URL('../proxy.js',import.meta.url),'utf8');
 const adminEnroll=proxy.slice(proxy.indexOf("if (parts[0] === 'enroll'"),proxy.indexOf("if (parts[0] === 'students'"));
 assert.doesNotMatch(adminEnroll,/createInvoice|markPaid|INSERT INTO orders|issueManual/);
 const server=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
 for(const start of ["app.post('/api/admin/grant'","app.post('/api/admin/bulk'"]){const section=server.slice(server.indexOf(start),server.indexOf('\n});',server.indexOf(start)));assert.doesNotMatch(section,/createInvoice|markPaid|INSERT INTO orders|issueManual/)}
});
test('Safe retry returns the original invoice after enrollment expires or currency is removed',()=>{const {db,issue,body}=fixture();const first=issue('owner',body);db.prepare('UPDATE enrollments SET expires=?').run(now-1);db.prepare("INSERT INTO settings VALUES('invoice_settings','{\"currencies\":{\"USD\":1}}')").run();assert.equal(issue('owner',body).invoice.id,first.invoice.id);db.close()});
test('Changed tax country or language is not an identical retry',()=>{const {db,issue,body}=fixture();issue('owner',body);for(const patch of [{country:'US'},{language:'en'}])assert.throws(()=>issue('owner',{...body,...patch}),rejected(409));db.close()});
test('Learner cannot render pending invoice directly, but paid checkout remains viewable',async()=>{const {db,api}=fixture();const user=db.prepare("SELECT * FROM users WHERE id='student'").get();api.createInvoice('checkout',user,114,'EGP',{packageId:'test-full',country:'EG'});const url=new URL('http://localhost/api/invoices/checkout');let result=await api.handlePublic({method:'GET'},{},url,()=>user);assert.equal(result.status,409);api.markPaid('checkout',now);result=await api.handlePublic({method:'GET'},{},url,()=>user);assert.equal(result.status,200);assert.equal(result.data.status,'issued');assert.ok(result.data.reference_qr);db.close()});

test('Admin route uses authenticated actor and applies both confirmations',async()=>{const {db,api,body}=fixture();let result=await api.handleAdmin({body:{...body,approveInvoice:false}},{},['manual-invoices'],'POST',{id:'owner'});assert.equal(result.status,400);result=await api.handleAdmin({body},{},['manual-invoices'],'POST',{id:'owner'});assert.equal(result.status,200);assert.equal(result.data.invoice.status,'issued');db.close()});

test('Gateway-confirmed payment automatically issues after manual enrollment, without owner approval',()=>{
 const {db,api}=fixture();db.exec('CREATE UNIQUE INDEX enrollment_pair ON enrollments(user_id,package_id);CREATE TABLE purchase_items(order_id TEXT,package_id TEXT)');
 const user=db.prepare("SELECT * FROM users WHERE id='student'").get();api.createInvoice('gateway',user,114,'EGP',{packageId:'test-full',country:'EG'});
 db.prepare("INSERT INTO orders(id,user_id,package_id,amount,currency,status,gateway) VALUES('gateway','student','test-full',114,'EGP','pending','kashier')").run();
 assert.equal(db.prepare('SELECT source FROM enrollments').get().source,'إضافة إدارية');
 const source=fs.readFileSync(new URL('../proxy.js',import.meta.url),'utf8');let code='';for(const name of ['grant','markOrderPaid']){const start=source.indexOf('function '+name+'(');code+=source.slice(start,source.indexOf('\n}',start)+2)+'\n';}
 const pay=new Function('db','uid','v16','setting',code+';return markOrderPaid;')(db,()=>`unused-id`,api,k=>db.prepare('SELECT v FROM settings WHERE k=?').get(k)?.v);
 pay(db.prepare('SELECT * FROM orders').get());assert.equal(db.prepare('SELECT status FROM orders').get().status,'paid');assert.equal(db.prepare('SELECT status FROM invoices').get().status,'issued');assert.equal(db.prepare('SELECT COUNT(*) n FROM manual_invoice_approvals').get().n,0);
 pay(db.prepare('SELECT * FROM orders').get());assert.equal(db.prepare('SELECT COUNT(*) n FROM invoices').get().n,1);db.close();
});
test('No gateway holds, provenance classification or extra approval endpoint exists',()=>{const files=['manual-invoices.js','v16-backend.js','proxy.js','server.js','admin.js','classroom.js','public/admin-v15-7.js'];for(const file of files)assert.doesNotMatch(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),/awaiting_owner_approval|manual_enrollment_origins|invoice_owner_approvals|recordManualEnrollment|invoice-approvals/)});
