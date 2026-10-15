import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {createCertificateService} from '../instructor-certificates.js';
const {JSDOM}=createRequire(import.meta.url)(process.env.JSDOM_MODULE||'jsdom');
const html=readFileSync(new URL('../public/verify.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const token='ab12cd34ef56'.repeat(4);
function fixture(){
  const db=new DatabaseSync(':memory:');
  db.transaction=fn=>Object.assign(fn,{immediate:fn});
  db.exec('CREATE TABLE certificates(no TEXT PRIMARY KEY,user_id TEXT,package_id TEXT,name TEXT,course TEXT,hours INTEGER,issued INTEGER)');
  const service=createCertificateService({db,setting:()=>'',uid:()=>'',site:'https://al-ltc.com'});
  const insert=db.prepare('INSERT INTO certificates(no,user_id,package_id,name,course,hours,issued,verify_token,revoked_at) VALUES (?,?,?,?,?,?,?,?,?)');
  insert.run('AS-2026-ABC123','synthetic-owner','synthetic-full','Fixture Learner','Fixture Course',20,1700000000000,token,null);
  insert.run('AS-2025-OLD123','synthetic-owner','synthetic-old','Legacy Learner','Original Course',10,1600000000000,null,null);
  insert.run('AS-2026-REVOKE','synthetic-owner','synthetic-full','Revoked Learner','Fixture Course',20,1700000000000,'cd'.repeat(24),1700000000001);
  return {db,service};
}
function page(path='/verify.html',override){
  const {db,service}=fixture();
  const dom=new JSDOM(html,{url:'https://al-ltc.com'+path,runScripts:'outside-only'});
  const calls=[];
  dom.window.fetch=async url=>{
    calls.push(url);
    if(override)return override(url);
    const record=service.verify(decodeURIComponent(url.slice('/api/verify/'.length)));
    return {ok:!!record,status:record?200:404,json:async()=>record?{valid:true,...record,issuedText:'Synthetic date'}:{valid:false}};
  };
  dom.window.eval(script);
  return {dom,calls,service,db,doc:dom.window.document,close(){dom.window.close();db.close();}};
}
async function submit(t,value){t.doc.querySelector('#no').value=value;await t.dom.window.check();}
test('scanned opaque token remains lowercase and verifies through the actual service',async()=>{
  const t=page('/verify/'+token);await t.dom.window.check();
  assert.deepEqual(t.calls,['/api/verify/'+token]);assert.ok(t.doc.querySelector('.ok'));assert.match(t.doc.querySelector('#res').textContent,/Fixture Learner/);t.close();
});
test('same-origin pasted link verifies without sending learner data in the URL',async()=>{
  const t=page();await submit(t,'https://al-ltc.com/verify/'+token);assert.deepEqual(t.calls,['/api/verify/'+token]);assert.ok(t.doc.querySelector('.ok'));t.close();
});
test('legacy serial normalizes but a new serial does not bypass its opaque token',async()=>{
  const t=page();await submit(t,'as-2025-old123');assert.ok(t.doc.querySelector('.ok'));assert.equal(t.calls[0],'/api/verify/AS-2025-OLD123');
  await submit(t,'AS-2026-ABC123');assert.equal(t.doc.querySelector('.ok'),null);assert.ok(t.doc.querySelector('.bad'));t.close();
});
test('unknown, changed-case and revoked tokens never show a valid award',async()=>{
  const t=page();for(const value of ['ef'.repeat(24),token.toUpperCase(),'cd'.repeat(24)]){await submit(t,value);assert.equal(t.doc.querySelector('.ok'),null);assert.ok(t.doc.querySelector('.bad'));}t.close();
});
test('external links, query strings and malformed identifiers cause no lookup',async()=>{
  const t=page();for(const value of ['https://third.example/verify/'+token,'https://al-ltc.com/verify/'+token+'?name=Private','../../records','<img src=x>'])await submit(t,value);
  assert.equal(t.calls.length,0);assert.equal(t.doc.querySelector('.ok'),null);t.close();
});
test('non-success HTTP status cannot render valid even with a misleading body',async()=>{
  const t=page('/verify.html',async()=>({ok:false,json:async()=>({valid:true,name:'invalid'})}));await submit(t,token);assert.equal(t.doc.querySelector('.ok'),null);t.close();
});
test('all returned fields are escaped in the public verification result',async()=>{
  const t=page('/verify.html',async()=>({ok:true,json:async()=>({valid:true,name:'<img src=x>',course:'<script>bad</script>',hours:'<svg onload=bad>',issuedText:'<i>date</i>',no:'<b>no</b>'})}));
  await submit(t,token);assert.ok(t.doc.querySelector('.ok'));assert.equal(t.doc.querySelector('#res img,#res svg,#res script,#res i'),null);t.close();
});
test('late valid response cannot replace the latest invalid response',async()=>{
  let release;const t=page('/verify.html',url=>url.endsWith(token)?new Promise(r=>release=r):Promise.resolve({ok:false,json:async()=>({valid:false})}));
  const old=submit(t,token);await submit(t,'ef'.repeat(24));release({ok:true,json:async()=>({valid:true,name:'Old request'})});await old;assert.equal(t.doc.querySelector('.ok'),null);t.close();
});
