/** Synthetic DOM only. No live credentials, student records, services, or network. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {JSDOM}=await import(process.env.JSDOM_MODULE?pathToFileURL(process.env.JSDOM_MODULE).href:'jsdom');
const html=await readFile('public/index.html','utf8');
const code=await readFile('public/admin-cohorts.js','utf8');
const settle=()=>new Promise(r=>setTimeout(r,15));
async function fixture(){
 const dom=new JSDOM(html,{url:'https://synthetic.invalid/#admin',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document,calls=[],messages=[];
 w.scrollTo=()=>{};w.confirm=()=>true;w.IntersectionObserver=class{observe(){} unobserve(){} disconnect(){}};
 w.fetch=()=>{throw Error('Network forbidden');};
 for(const s of d.scripts){if(s.src||(s.type&&s.type!=='text/javascript')||s.textContent.includes('showStartupError'))continue;w.eval(s.textContent);}
 w.eval(await readFile('public/trainee-tracking.js','utf8'));w.eval(code);
 const original=w.APP;
 const admin={id:'admin',name:'Admin',email:'admin@example.invalid',role:'admin',packages:[]};
 const a={id:'a',name:'محمد',email:'a@example.invalid',role:'student',active:0,packages:[]};
 const b={id:'b',name:'أحمد',email:'b@example.invalid',role:'student',active:1,packages:[]};
 original.DB.users=[admin,a,b,{id:'c',name:'سيد',email:'c@example.invalid',role:'student',active:1,packages:[]}];original.DB.session='admin';
 const overview={serverNow:Date.now(),stats:{},students:[{...a,progress:50,avgExam:80,enrollments:1,learningPackages:[{progress:50,lessonDone:2,lessonTotal:4,examScoreCount:2,examScoreTotal:160}]},{...b,progress:null,avgExam:null,enrollments:0,learningPackages:[]}],cohorts:[{id:1,name:'مجموعة <script>alert(1)</script>',active:true,memberIds:['a','b']},{id:2,name:'Archived',active:false,memberIds:['b']}]};
 w.APP={...original,live:true,token:'test',adminOverview:overview,syncAdminData:async()=>true,toast:m=>messages.push(m),api:async(path,opts)=>{calls.push({path,...opts});return {ok:true};}};
 w.APP.go('admin');
 const click=selector=>{assert.ok(d.querySelector(selector),selector);d.querySelector(selector).click();};
 const users=()=>{w.APP.closeModal();click('[data-at="users"]');};
 const cohorts=()=>{w.APP.closeModal();click('[data-at="cohorts"]');};
 return {w,d,calls,messages,click,users,cohorts,dom};
}
{
 const f=await fixture(),{w,d,click,calls,cohorts}=f;
 cohorts();assert.equal(d.querySelectorAll('[data-cohort-row]').length,2);assert.match(d.querySelector('#admBody').textContent,/50%/);assert.match(d.querySelector('#admBody').textContent,/غير متاح/);assert.equal(d.querySelector('#admBody script'),null);
 assert.equal(d.querySelectorAll('#cohortSelect option').length,2);
 click('#cohortArchived');assert.equal(d.querySelectorAll('#cohortSelect option').length,3);
 click('#cohortCreate');d.querySelector('#cohortName').value='دفعة جديدة';click('#cohortNameSave');await settle();assert.equal(calls.at(-1).path,'/admin/cohorts');assert.equal(calls.at(-1).body.name,'دفعة جديدة');
 cohorts();click('#cohortRename');d.querySelector('#cohortName').value='دفعة معدلة';click('#cohortNameSave');await settle();assert.equal(calls.at(-1).method,'PUT');
 cohorts();click('[data-cohort-remove="b"]');await settle();assert.equal(calls.at(-1).path,'/admin/cohorts/1/members');assert.deepEqual([...calls.at(-1).body.remove],['b']);
 cohorts();click('#cohortMembers');click('[data-cohort-add="c"]');click('#cohortMembersSave');await settle();assert.deepEqual([...calls.at(-1).body.add],['c']);
 cohorts();click('#cohortArchive');await settle();assert.equal(calls.at(-1).body.active,false);
 d.querySelector('#cohortSelect').value='2';d.querySelector('#cohortSelect').dispatchEvent(new w.Event('change'));assert.equal(d.querySelector('#cohortSelect').value,'2');assert.equal(d.querySelectorAll('[data-cohort-row]').length,1);click('#cohortArchive');await settle();assert.equal(calls.at(-1).body.active,true);
 f.dom.window.close();
}
{
 const f=await fixture(),{w,d,click,calls,users}=f;
 users();click('[data-utog="a"]');d.querySelector('#cohortAction').value='1';click('#cohortActionSave');await settle();assert.equal(calls.at(-1).path,'/admin/users/a/toggle');assert.equal(calls.at(-1).body.cohortId,'1');
 users();click('[data-uedit="a"]');d.querySelector('#euCohort').value='1';click('#euSave');await settle();assert.equal(calls.at(-1).body.cohortId,'1');assert.equal(calls.at(-1).method,'PUT');
 users();click('#admGrant');d.querySelector('#gpCohort').value='1';click('#gpGo');await settle();assert.equal(calls.at(-1).path,'/admin/grant');assert.equal(calls.at(-1).body.cohortId,'1');
 w.__usel=['a','b'];w.APP.render();click('[data-bulk="grant"]');d.querySelector('#bkCohort').value='1';click('#bkGo');await settle();assert.equal(calls.at(-1).body.action,'grant');assert.equal(calls.at(-1).body.cohortId,'1');
 w.__usel=['a','b'];w.APP.render();click('[data-bulk="enable"]');click('#cohortActionSave');await settle();assert.equal(calls.at(-1).body.action,'enable');assert.ok(!('cohortId' in calls.at(-1).body));
 w.__usel=['a','b'];w.APP.render();click('[data-bulk="cohort"]');d.querySelector('#cohortBulk').value='1';click('#cohortBulkSave');await settle();assert.equal(calls.at(-1).path,'/admin/cohorts/1/members');assert.deepEqual([...calls.at(-1).body.add],['a','b']);
 f.dom.window.close();
}
{
 const f=await fixture(),{w,d,click,calls,users}=f;let release;
 users();click('[data-utog="a"]');w.APP.api=(path,opts)=>{calls.push({path,...opts});return new Promise(r=>release=r);};
 click('#cohortActionSave');click('#cohortActionSave');assert.equal(calls.length,1);
 w.APP.modal('<h3 id="new-dialog">New dialog</h3>');release({});await settle();assert.ok(d.querySelector('#new-dialog'),'new modal is never dismissed by prior mutation');
 users();w.APP.live=false;click('[data-utog="a"]');assert.equal(calls.length,1);assert.equal(d.querySelector('#cohortActionSave'),null);
 f.dom.window.close();
}
{
 const f=await fixture(),{w,d,click,users}=f;
 users();click('[data-utog="a"]');w.APP.api=async()=>{throw Error('Synthetic rejection');};click('#cohortActionSave');await settle();assert.equal(d.querySelector('#cohortActionSave').disabled,false);assert.match(f.messages.at(-1),/Synthetic rejection/);
 f.dom.window.close();
}
{
 const f=await fixture(),{w,d,cohorts}=f;
 w.APP.adminOverview.students[0].learningPackages=[{progress:50,lessonDone:1,lessonTotal:2,examScoreCount:1,examScoreTotal:80}];
 w.APP.adminOverview.students[1].learningPackages=[{progress:90,lessonDone:9,lessonTotal:10,examScoreCount:3,examScoreTotal:120},{progress:null,lessonDone:null,lessonTotal:100,examScoreCount:0,examScoreTotal:0}];
 cohorts();const text=d.querySelector('#admBody .detail-kpis').textContent;
 assert.match(text,/10 \/ 12/);assert.match(text,/83%/);assert.match(text,/50%/);assert.match(text,/4 نتيجة/);assert.match(text,/2 \/ 3/);
 f.dom.window.close();
}
console.log('PASS private cohort UI: roster, unknown progress, escaping, create/rename/archive/remove, activation/edit/grant/bulk payloads, offline/errors/duplicate clicks/modal races.');

// Execute the actual production sync function (not the fixture's stub), then edit.
{
 const f=await fixture(),{w,d,users,click}=f;
 const start=html.indexOf('async function syncAdminData() {');
 const end=html.indexOf('\nasync function ',start+1);
 const source=html.slice(start,end);
 const DB=w.APP.DB, API={live:true,token:'test'};
 const records=JSON.parse(JSON.stringify(DB.users));
 const sync=new Function('API','DB','me','api','save',source+'; return syncAdminData;')(API,DB,()=>DB.users.find(u=>u.id===DB.session),async path=>path==='/admin/users'?records:path==='/admin/orders'?[]:w.APP.adminOverview,()=>{});
 assert.equal(await sync(),true);assert.equal(DB.users.find(u=>u.id==='a').active,0);assert.equal(DB.users.find(u=>u.id==='b').active,1);
 users();click('[data-uedit="a"]');assert.equal(d.querySelector('#euActive').checked,false);d.querySelector('#euCohort').value='1';click('#euSave');await settle();assert.equal(f.calls.at(-1).body.active,false);
 f.dom.window.close();
}
