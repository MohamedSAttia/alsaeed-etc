/** Synthetic DOM integration only. No live services, credentials or student data. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {JSDOM} = await import(process.env.JSDOM_MODULE ? pathToFileURL(process.env.JSDOM_MODULE).href : 'jsdom');
const html = await readFile('public/index.html', 'utf8');
const extension = await readFile('public/admin-enrollment-extension.js', 'utf8');
const DAY = 86400000, now = Date.parse('2026-10-15T09:00:00Z');
const clone = x => JSON.parse(JSON.stringify(x));
const settle = () => new Promise(resolve => setTimeout(resolve, 15));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => {resolve = yes; reject = no;}); return {promise, resolve, reject}; }
async function fixture(options = {}) {
  const dom = new JSDOM(html, {url:'https://synthetic.invalid/#admin',runScripts:'outside-only',pretendToBeVisual:true});
  const w = dom.window, doc = w.document;
  w.Date.now = () => now;
  w.scrollTo = () => {};
  w.IntersectionObserver = class {observe() {} unobserve() {} disconnect() {}};
  w.fetch = () => {throw new Error('External network forbidden in synthetic fixture');};
  const errors = [];
  w.addEventListener('error', event => errors.push(event.message));
  for (const script of doc.scripts) {
    if (script.src || (script.type && script.type !== 'text/javascript') || script.textContent.includes('showStartupError')) continue;
    w.eval(script.textContent);
  }
  w.eval(await readFile('public/trainee-tracking.js','utf8'));
  w.eval(extension);
  const records = [
    {id:'en-active',user_id:'learner',package_id:'pmp-full',expires:now + 10 * DAY,created:now - DAY,source:'synthetic'},
    {id:'en-expired',user_id:'learner',package_id:'rmp-full',expires:now - 10 * DAY,created:now - 20 * DAY,source:'synthetic'},
    {id:'en-lifetime',user_id:'learner',package_id:'grcp-full',expires:null,created:now - DAY,source:'synthetic'},
    {id:'en-zero',user_id:'learner',package_id:'pmp-exam',expires:0,created:now - DAY,source:'synthetic'}
  ];
  const admin = {id:'admin',name:'Synthetic Admin',email:'admin@example.invalid',role:'admin',packages:[]};
  const learner = {id:'learner',name:'Synthetic Learner',email:'learner@example.invalid',role:'student',packages:records.map(e => ({id:e.package_id,enrollmentId:e.id,expires:e.expires,at:e.created,source:e.source}))};
  const original = w.APP;
  original.DB.users = [admin, learner]; original.DB.session = admin.id;
  original.DB.orders = [{id:'order-untouched'}]; original.DB.progress = {admin:{'pmp-full':{lessons:{1:true}}},learner:{'pmp-full':{lessons:{2:true}}}};
  const beforeOther = JSON.stringify({orders:original.DB.orders,progress:original.DB.progress});
  const calls = [], messages = []; let saves = 0, hook = options.hook, currentTime = now;
  w.Date.now = () => currentTime;
  const details = () => ({serverNow:currentTime,user:clone(learner),enrollments:clone(records),orders:[{id:'test-order',amount:123,currency:'SAR',status:'paid'}],certificates:[{no:'TEST-CERT'}]});
  const response = (body, userId='learner', packageId='pmp-full') => {
    const e = records.find(e => e.package_id === packageId);
    const expires = body.days ? (body.days > 0 ? Math.max(e.expires, currentTime) : e.expires) + body.days * DAY : body.expiresAt;
    const result = {ok:true,userId,packageId,enrollmentId:e.id,oldExpires:e.expires,expires,extendedAt:currentTime,checkedAt:currentTime,mode:body.days?'days':'date',days:body.days||null,auditId:'synthetic-audit',direction:expires<e.expires?'reduction':'increase',endsAccess:expires<=currentTime};
    e.expires = expires;
    return result;
  };
  w.APP = {...original,adminOverview:{serverNow:now,students:[{...clone(learner),learningPackages:clone(records)}]},syncAdminData:async()=>true,live:options.live !== false,token:'synthetic-token',save:()=>{saves++;},toast:message=>messages.push(message),api:async(path,opts={})=>{
    calls.push({path,opts:clone(opts)});
    if (hook) {const answer = await hook(path,opts); if (answer !== undefined) return answer;}
    if (path === '/admin/users/learner' || path === '/admin/users/learner/activity') return details();
    const match = path.match(/^\/admin\/users\/learner\/enrollments\/(.+)\/expiry$/);
    if (match && opts.method === 'POST') return response(opts.body,'learner',decodeURIComponent(match[1]));
    if (path === '/admin/users') return [clone(admin),{...clone(learner),packages:clone(records)}];
    throw new Error('Unexpected API call: '+path);
  }};
  w.APP.go('admin'); doc.querySelector('[data-at="users"]').click();
  async function detailsUI(kind='user') {
    if (kind === 'student') {w.APP.go('trainer'); doc.querySelector('[data-student="learner"]').click();}
    else doc.querySelector('[data-uview="learner"]').click();
    await settle();
  }
  async function open(id='en-active',kind='user') {
    await detailsUI(kind);
    const button = doc.querySelector('[data-extend-enrollment="'+id+'"]');
    assert.ok(button,'Real details UI exposes extension control'); button.click(); await settle();
    return doc.querySelector('#enrollmentExtensionForm');
  }
  function unchanged() {assert.equal(JSON.stringify({orders:w.APP.DB.orders,progress:w.APP.DB.progress}),beforeOther);assert.equal(saves,0,'Extension must never invoke APP.save/progress sync');}
  return {w,doc,records,learner,calls,messages,errors,details,response,detailsUI,open,setHook:fn=>{hook=fn;},setTime:value=>{currentTime=value;},unchanged,close:()=>w.close()};
}
const tests = [];
const test = (name, run) => tests.push({name,run});
function edit(w,input,value) {input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));}
function submit(w,form) {form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));}

test('real registrant UI displays Gregorian Saudi expiry and hides lifetime controls',async f=>{
  await f.detailsUI();
  assert.match(f.doc.querySelector('[data-detail-enrollment-expiry="en-active"]').textContent,/2026-10-25 12:00:00/);
  assert.match(f.doc.querySelector('[data-detail-enrollment-expiry="en-lifetime"]').textContent,/غير محدود/);
  assert.match(f.doc.querySelector('[data-detail-enrollment-expiry="en-zero"]').textContent,/غير محدود/);
  assert.equal(f.doc.querySelectorAll('[data-extend-enrollment]').length,2);
});
test('active days posts exact enrollment compare-and-swap and updates actual list/details',async f=>{
  const form=await f.open(); edit(f.w,form.elements.days,'7');
  assert.match(form.querySelector('[data-extension-preview]').textContent,/2026-11-01 12:00:00/);
  submit(f.w,form); await settle();
  const post=f.calls.find(x=>x.opts.method==='POST');
  assert.deepEqual(post.opts.body,{expectedEnrollmentId:'en-active',expectedExpires:now+10*DAY,days:7});
  assert.equal(f.learner.packages[0].expires,now+17*DAY);
  assert.match(f.doc.querySelector('[data-detail-enrollment-expiry="en-active"]').textContent,/2026-11-01/);
  assert.match(f.doc.querySelector('[data-user-enrollment-expiry="learner|pmp-full"]').textContent,/2026-11-01/);
  assert.equal(f.doc.querySelector('#enrollmentExtensionForm'),null);
  assert.ok(f.messages.some(x=>x.startsWith('تم تعديل')));
});
test('expired days use saving time and accept server clock authoritative base',async f=>{
  const form=await f.open('en-expired'); edit(f.w,form.elements.days,'1');
  assert.match(form.textContent,/وقت الحفظ على الخادم/);
  f.setHook((path,opts)=>{if(opts.method==='POST'){const r=f.response(opts.body,'learner','rmp-full');r.extendedAt+=5000;r.checkedAt+=5000;r.expires+=5000;f.records[1].expires=r.expires;return r;}});
  submit(f.w,form);await settle();
  assert.equal(f.learner.packages[1].expires,now+DAY+5000);
});
test('Saudi datetime is parsed independently of browser timezone',async f=>{
  const form=await f.open();edit(f.w,form.elements.mode,'date');edit(f.w,form.elements.expiresAt,'2026-11-01T09:30:00');
  submit(f.w,form);await settle();
  assert.equal(f.calls.find(x=>x.opts.method==='POST').opts.body.expiresAt,Date.parse('2026-11-01T06:30:00Z'));
});
test('invalid positive count and invalid dates cannot submit',async f=>{
  const form=await f.open();
  for(const value of ['0','-1','1.5','3651','']){edit(f.w,form.elements.days,value);assert.equal(form.querySelector('[type="submit"]').disabled,true);submit(f.w,form);}
  edit(f.w,form.elements.mode,'date');for(const value of ['2026-10-25T12:00','2026-02-30T12:00','2010-01-01T12:00','2100-01-02T12:00','']){edit(f.w,form.elements.expiresAt,value);assert.equal(form.querySelector('[type="submit"]').disabled,true);submit(f.w,form);}
  assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,0);
});
test('cancel before submit has no writes',async f=>{const form=await f.open();form.querySelector('[data-close]').click();assert.equal(f.doc.querySelector('#ov'),null);assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,0);});
test('double submit creates one write and cancel during save never reopens modal',async f=>{
  const form=await f.open(),pending=deferred();f.setHook((path,opts)=>opts.method==='POST'?pending.promise:undefined);
  submit(f.w,form);submit(f.w,form);assert.equal(form.querySelector('[type="submit"]').disabled,true);
  form.querySelector('[data-close]').click();pending.resolve(f.response({days:30}));await settle();
  assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,1);assert.equal(f.doc.querySelector('#ov'),null);assert.equal(f.learner.packages[0].expires,now+40*DAY);
});
test('cancel pending authoritative read prevents form reappearance',async f=>{
  await f.detailsUI();const pending=deferred();f.setHook(()=>pending.promise);f.doc.querySelector('[data-extend-enrollment]').click();f.doc.querySelector('[data-close]').click();pending.resolve(f.details());await settle();assert.equal(f.doc.querySelector('#ov'),null);
});
test('a newer modal wins against pending save and read',async f=>{
  const form=await f.open(),pending=deferred();f.setHook((path,opts)=>opts.method==='POST'?pending.promise:undefined);submit(f.w,form);f.w.APP.modal('<h3 id="newer">Another learner</h3>');pending.resolve(f.response({days:30}));await settle();assert.ok(f.doc.querySelector('#newer'));assert.equal(f.doc.querySelector('#enrollmentExtensionForm'),null);
});
test('409 reloads current enrollment without retry and preserves conflict',async f=>{
  const form=await f.open();f.setHook((path,opts)=>{if(opts.method==='POST'){f.records[0].expires+=DAY;throw Object.assign(new Error('Changed'),{status:409,code:'ENROLLMENT_CHANGED'});}});submit(f.w,form);await settle();
  assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,1);assert.equal(f.doc.querySelector('#enrollmentExtensionForm'),null);assert.equal(f.learner.packages[0].expires,now+11*DAY);assert.ok(!f.messages.some(x=>x.startsWith('تم تعديل')));
});
test('mismatched acknowledgement blocks success and retry until refresh',async f=>{
  const form=await f.open();f.setHook((path,opts)=>{if(opts.method==='POST')return {...f.response(opts.body),enrollmentId:'wrong-row'};});submit(f.w,form);await settle();
  assert.equal(f.learner.packages[0].expires,now+10*DAY);assert.ok(!f.messages.some(x=>x.startsWith('تم تعديل')));assert.equal(form.querySelector('[type="submit"]').disabled,true);assert.equal(form.querySelector('[data-extension-reload]').hidden,false);submit(f.w,form);assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,1);
});
test('network error has no local success and no blind retry',async f=>{
  const form=await f.open();f.setHook((path,opts)=>{if(opts.method==='POST')throw new Error('Network failure');});submit(f.w,form);await settle();assert.match(form.querySelector('[data-extension-error]').textContent,/Network failure/);submit(f.w,form);assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,1);assert.equal(f.learner.packages[0].expires,now+10*DAY);
});
test('token replacement while saving suppresses cache and stale UI',async f=>{
  const form=await f.open(),pending=deferred();f.setHook((path,opts)=>opts.method==='POST'?pending.promise:undefined);submit(f.w,form);f.w.APP.token='replacement-token';pending.resolve(f.response({days:30}));await settle();assert.equal(f.learner.packages[0].expires,now+10*DAY);assert.equal(f.doc.querySelector('#ov'),null);assert.equal(f.messages.length,0);
});
test('hash navigation dismisses pending extension without reopening',async f=>{
  const form=await f.open(),pending=deferred();f.setHook((path,opts)=>opts.method==='POST'?pending.promise:undefined);submit(f.w,form);f.w.location.hash='#home';await settle();pending.resolve(f.response({days:30}));await settle();assert.equal(f.doc.querySelector('#ov'),null);
});
test('offline cannot open or submit extension',async f=>{f.w.APP.live=false;await f.detailsUI();assert.ok([...f.doc.querySelectorAll('[data-extend-enrollment]')].every(b=>b.disabled));await f.w.AlsaeedEnrollmentExtension.open({userId:'learner',packageId:'pmp-full',enrollmentId:'en-active'});assert.equal(f.doc.querySelector('#enrollmentExtensionForm'),null);assert.equal(f.calls.length,0);});
test('trainer read UI displays expiry but extension requires admin role',async f=>{f.w.APP.DB.users[0].role='trainer';await f.detailsUI();assert.equal(f.doc.querySelectorAll('[data-extend-enrollment]').length,0);assert.equal(f.w.AlsaeedEnrollmentExtension.control(f.records[0]),'');});
test('real progress-detail view supports finite extension without changing progress',async f=>{const form=await f.open('en-active','student');assert.ok(form);edit(f.w,form.elements.days,'2');submit(f.w,form);await settle();assert.equal(f.learner.packages[0].expires,now+12*DAY);assert.match(f.doc.querySelector('#ov').textContent,/2026-10-27/);});
test('server lifecycle replacement before open is never silently retargeted',async f=>{await f.detailsUI();f.records[0].id='replacement-enrollment';f.doc.querySelector('[data-extend-enrollment="en-active"]').click();await settle();assert.equal(f.doc.querySelector('#enrollmentExtensionForm'),null);assert.ok(f.doc.querySelector('[data-extend-enrollment="replacement-enrollment"]'));assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,0);});
test('dialog has labelled fields, focus handling and safely escaped identity text',async f=>{f.learner.name='<img src=x onerror=alert(1)>';const form=await f.open();assert.equal(form.closest('[role="dialog"]').getAttribute('aria-labelledby'),'enrollmentExtensionTitle');assert.equal(f.doc.activeElement,form.elements.days);assert.equal(f.doc.querySelector('#ov img'),null);form.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(f.doc.querySelector('#ov'),null);});

test('all three duration choices are explicit and inactive fields stay visually hidden',async f=>{
  const form=await f.open();
  assert.equal(f.doc.querySelector('#enrollmentExtensionTitle').textContent,'تعديل مدة الباقة');
  assert.deepEqual([...form.elements.mode.options].map(o=>o.value),['add','reduce','date']);
  assert.equal(f.w.getComputedStyle(form.querySelector('[data-extension-date]')).display,'none');
  assert.equal(f.w.getComputedStyle(form.querySelector('[data-extension-reload]')).display,'none');
  edit(f.w,form.elements.mode,'date');
  assert.equal(f.w.getComputedStyle(form.querySelector('[data-extension-days]')).display,'none');
  assert.notEqual(f.w.getComputedStyle(form.querySelector('[data-extension-date]')).display,'none');
});
test('reduce days uses positive input and submits negative days from current expiry',async f=>{
  const form=await f.open();edit(f.w,form.elements.mode,'reduce');edit(f.w,form.elements.days,'3');
  assert.match(form.querySelector('[data-extension-direction]').textContent,/تقليل/);
  assert.match(form.querySelector('[data-extension-new]').textContent,/2026-10-22 12:00:00/);
  assert.match(form.querySelector('[data-extension-current-remaining]').textContent,/10 يوم/);
  assert.match(form.querySelector('[data-extension-proposed-remaining]').textContent,/7 يوم/);
  assert.equal(form.querySelector('[data-extension-immediate-warning]').hidden,true);
  submit(f.w,form);await settle();
  assert.deepEqual(f.calls.find(x=>x.opts.method==='POST').opts.body,{expectedEnrollmentId:'en-active',expectedExpires:now+10*DAY,days:-3});
  assert.equal(f.learner.packages[0].expires,now+7*DAY);
});
test('active earlier date remains available without access-ending consent',async f=>{
  const form=await f.open();edit(f.w,form.elements.mode,'date');edit(f.w,form.elements.expiresAt,'2026-10-20T12:00:00');
  assert.match(form.querySelector('[data-extension-direction]').textContent,/تقليل/);
  assert.equal(form.querySelector('[type="submit"]').disabled,false);submit(f.w,form);await settle();
  const body=f.calls.find(x=>x.opts.method==='POST').opts.body;
  assert.equal(body.expiresAt,now+5*DAY);assert.equal('confirmImmediateExpiry' in body,false);
});
test('immediate reduction requires manually checked consent even for programmatic submit',async f=>{
  const form=await f.open();edit(f.w,form.elements.mode,'reduce');edit(f.w,form.elements.days,'10');
  assert.equal(form.querySelector('[data-extension-immediate-warning]').hidden,false);
  assert.equal(form.elements.confirmImmediateExpiry.checked,false);
  assert.equal(form.querySelector('[type="submit"]').disabled,true);
  submit(f.w,form);assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,0);
  assert.equal(f.doc.activeElement,form.elements.confirmImmediateExpiry);
  form.elements.confirmImmediateExpiry.click();assert.equal(form.querySelector('[type="submit"]').disabled,false);
  submit(f.w,form);await settle();
  assert.deepEqual(f.calls.find(x=>x.opts.method==='POST').opts.body,{expectedEnrollmentId:'en-active',expectedExpires:now+10*DAY,days:-10,confirmImmediateExpiry:true});
  assert.equal(f.learner.packages[0].expires,now);
});
test('expired reduction subtracts from old expiry and still requires explicit consent',async f=>{
  const form=await f.open('en-expired');edit(f.w,form.elements.mode,'reduce');edit(f.w,form.elements.days,'2');
  assert.match(form.querySelector('[data-extension-new]').textContent,/2026-10-03/);
  assert.equal(form.querySelector('[data-extension-immediate-warning]').hidden,false);
  submit(f.w,form);assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,0);
  form.elements.confirmImmediateExpiry.click();submit(f.w,form);await settle();assert.equal(f.learner.packages[1].expires,now-12*DAY);
});
test('past explicit date increase also warns because access stays ended',async f=>{
  const form=await f.open('en-expired');edit(f.w,form.elements.mode,'date');edit(f.w,form.elements.expiresAt,'2026-10-10T12:00:00');
  assert.match(form.querySelector('[data-extension-direction]').textContent,/زيادة/);
  assert.equal(form.querySelector('[data-extension-immediate-warning]').hidden,false);
  assert.equal(form.elements.confirmImmediateExpiry.checked,false);form.elements.confirmImmediateExpiry.click();
  submit(f.w,form);await settle();assert.equal(f.learner.packages[1].expires,now-5*DAY);
});
test('consent clears after every count, mode or date edit and on reopening',async f=>{
  let form=await f.open();edit(f.w,form.elements.mode,'reduce');edit(f.w,form.elements.days,'11');
  form.elements.confirmImmediateExpiry.click();edit(f.w,form.elements.days,'12');assert.equal(form.elements.confirmImmediateExpiry.checked,false);
  form.elements.confirmImmediateExpiry.click();edit(f.w,form.elements.mode,'date');assert.equal(form.elements.confirmImmediateExpiry.checked,false);
  edit(f.w,form.elements.expiresAt,'2026-10-14T12:00');form.elements.confirmImmediateExpiry.click();edit(f.w,form.elements.expiresAt,'2026-10-13T12:00');assert.equal(form.elements.confirmImmediateExpiry.checked,false);
  form.elements.confirmImmediateExpiry.click();form.querySelector('[data-close]').click();form=await f.open();assert.equal(form.elements.confirmImmediateExpiry.checked,false);
});
test('invalid counts stay blocked in reduce mode too',async f=>{
  const form=await f.open();edit(f.w,form.elements.mode,'reduce');
  for(const value of ['0','-1','1.5','3651','']){edit(f.w,form.elements.days,value);assert.equal(form.querySelector('[type="submit"]').disabled,true);submit(f.w,form);}
  assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,0);
});
test('server clock offsets device clock for current and proposed access warning',async f=>{
  f.w.Date.now=()=>now-365*DAY;
  const form=await f.open();edit(f.w,form.elements.mode,'date');edit(f.w,form.elements.expiresAt,'2026-10-14T12:00');
  assert.equal(form.querySelector('[data-extension-immediate-warning]').hidden,false);
  assert.match(form.querySelector('[data-extension-current-remaining]').textContent,/10 يوم/);
});
test('time crossing before submit requires newly checked immediate confirmation',async f=>{
  const form=await f.open();edit(f.w,form.elements.mode,'date');edit(f.w,form.elements.expiresAt,'2026-10-15T12:01:00');
  assert.equal(form.querySelector('[data-extension-immediate-warning]').hidden,true);
  f.setTime(now+60000);submit(f.w,form);
  assert.equal(form.querySelector('[data-extension-immediate-warning]').hidden,false);
  assert.equal(form.elements.confirmImmediateExpiry.checked,false);assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,0);
});
test('server immediate-expiry conflict reloads selected date with unchecked warning and no retry',async f=>{
  let form=await f.open();edit(f.w,form.elements.mode,'date');edit(f.w,form.elements.expiresAt,'2026-10-15T12:01:00');
  f.setHook((path,opts)=>{if(opts.method==='POST'){f.setTime(now+60001);throw Object.assign(new Error('Immediate confirmation required'),{status:409,code:'IMMEDIATE_EXPIRY_CONFIRMATION_REQUIRED'});}});
  submit(f.w,form);await settle();form=f.doc.querySelector('#enrollmentExtensionForm');
  assert.ok(form);assert.equal(form.elements.mode.value,'date');assert.equal(form.elements.expiresAt.value,'2026-10-15T12:01');
  assert.equal(form.querySelector('[data-extension-immediate-warning]').hidden,false);assert.equal(form.elements.confirmImmediateExpiry.checked,false);
  assert.equal(form.querySelector('[type="submit"]').disabled,true);assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,1);
  assert.equal(f.doc.activeElement,form.elements.confirmImmediateExpiry);
  f.setHook(undefined);form.elements.confirmImmediateExpiry.click();submit(f.w,form);await settle();
  assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,2);assert.equal(f.calls.filter(x=>x.opts.method==='POST')[1].opts.body.confirmImmediateExpiry,true);
});
test('long-expired explicit renewal permits range from current server time',async f=>{
  f.records[1].expires=now-5000*DAY;
  const form=await f.open('en-expired');edit(f.w,form.elements.mode,'date');edit(f.w,form.elements.expiresAt,'2026-11-01T12:00:00');
  assert.equal(form.querySelector('[type="submit"]').disabled,false);submit(f.w,form);await settle();assert.equal(f.learner.packages[1].expires,now+17*DAY);
});
test('delayed old acknowledgement cannot overwrite a later completed adjustment',async f=>{
  let form=await f.open();edit(f.w,form.elements.days,'1');const pending=deferred();let firstResult;
  f.setHook((path,opts)=>{if(opts.method==='POST'&&!firstResult){firstResult=f.response(opts.body);return pending.promise;}});
  submit(f.w,form);form.querySelector('[data-close]').click();
  form=await f.open();edit(f.w,form.elements.mode,'reduce');edit(f.w,form.elements.days,'3');submit(f.w,form);await settle();
  assert.equal(f.learner.packages[0].expires,now+8*DAY);const messageCount=f.messages.length;
  pending.resolve(firstResult);await settle();
  assert.equal(f.learner.packages[0].expires,now+8*DAY);assert.equal(f.records[0].expires,now+8*DAY);
  assert.match(f.doc.querySelector('[data-user-enrollment-expiry="learner|pmp-full"]').textContent,/2026-10-23/);
  assert.equal(f.messages.length,messageCount,'Delayed stale result must not announce an older expiry');
});
test('delayed acknowledgement cannot resurrect a replaced enrollment lifecycle',async f=>{
 const form=await f.open(),pending=deferred();f.setHook((path,opts)=>opts.method==='POST'?pending.promise:undefined);submit(f.w,form);
 const result=f.response({days:30});form.querySelector('[data-close]').click();
 f.learner.packages[0].enrollmentId='replacement';f.learner.packages[0].expires=now+99*DAY;
 const before=f.messages.length;pending.resolve(result);await settle();
 assert.equal(f.learner.packages[0].enrollmentId,'replacement');assert.equal(f.learner.packages[0].expires,now+99*DAY);assert.equal(f.messages.length,before);
});
test('lifetime direct open cannot convert unlimited enrollment',async f=>{
  await f.detailsUI();await f.w.AlsaeedEnrollmentExtension.open({userId:'learner',packageId:'grcp-full',enrollmentId:'en-lifetime',onRefresh:()=>f.detailsUI()});
  assert.equal(f.doc.querySelector('#enrollmentExtensionForm'),null);assert.equal(f.records[2].expires,null);assert.equal(f.calls.filter(x=>x.opts.method==='POST').length,0);
});
test('keyboard focus wraps within dialog and returns to learner on cancel',async f=>{
  const form=await f.open(),first=form.elements.mode,last=form.querySelector('[data-close]');
  first.focus();first.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));assert.equal(f.doc.activeElement,last);
  last.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(f.doc.activeElement,first);
  last.click();assert.equal(f.doc.activeElement.dataset.uview,'learner');
});
for(const [label,mutate] of [
  ['wrong direction',r=>{r.direction='reduction';}],
  ['wrong access state',r=>{r.endsAccess=true;}],
  ['missing audit',r=>{delete r.auditId;}],
  ['missing checkedAt',r=>{delete r.checkedAt;}],
  ['checkedAt before formula time',r=>{r.checkedAt=r.extendedAt-1;}],
  ['incorrect expiry arithmetic',r=>{r.expires+=DAY;}],
  ['wrong requested days',r=>{r.days+=1;}],
  ['wrong user',r=>{r.userId='someone-else';}],
  ['wrong package',r=>{r.packageId='rmp-full';}],
  ['wrong old expiry',r=>{r.oldExpires+=1;}]
]) test('rejects acknowledgement with '+label,async f=>{
  const form=await f.open();f.setHook((path,opts)=>{if(opts.method==='POST'){const r=f.response(opts.body);mutate(r);return r;}});submit(f.w,form);await settle();
  assert.equal(f.learner.packages[0].expires,now+10*DAY);assert.equal(form.querySelector('[data-extension-reload]').hidden,false);assert.equal(form.querySelector('[type="submit"]').disabled,true);
  assert.ok(!f.messages.some(x=>x.startsWith('تم تعديل')));
});

let count=0;
for(const {name,run} of tests){const f=await fixture();try{await run(f);f.unchanged();assert.deepEqual(f.errors,[]);console.log('PASS '+name);count++;}finally{f.close();}}
console.log(`${count} synthetic enrollment duration UI scenarios passed`);
