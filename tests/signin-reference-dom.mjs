import assert from 'node:assert/strict';
import fs from 'node:fs';
const {JSDOM}=await import('/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js');
const source=fs.readFileSync('public/index.html','utf8');
const auth=source.slice(source.indexOf('function openAuth(mode, after)'),source.indexOf('/* ═══ الربط العام',source.indexOf('function openAuth(mode, after)')));
for(const language of ['ar','en']){
 const dom=new JSDOM('<body><main id="app"></main><div id="ov"></div></body>',{url:'https://local.test',runScripts:'outside-only'}),w=dom.window,d=w.document;
 let calls=[],route='',request;
 Object.assign(w,{__lang:language,$:q=>d.querySelector(q),authRequestPending:false,me:()=>null,API:{live:true},DB:{users:[]},isAdmin:()=>false,preferredAuthMode:()=> 'login',toast:()=>{},go:r=>route=r,LOGO_FULL:()=>'<img src="/img/logo.png" alt="Al Saeed">',resetLessonCaches:()=>{},rememberAccount:()=>{},hydrateProgress:async()=>{},cacheProgress:()=>{},syncAdminData:async()=>{},api:async(path,options)=>{calls.push([path,options]);if(path==='/me')return {packages:[]};return await new Promise((resolve,reject)=>request={resolve,reject})},closeModal:()=>{d.querySelector('#ov').authCleanup?.();d.querySelector('#ov').innerHTML='';},modal:(html,fn)=>{d.querySelector('#ov').authCleanup?.();d.querySelector('#ov').innerHTML='<div class="mdl">'+html+'</div>';fn();}});
 w.eval(auth);w.openAuth('login');
 assert.equal(d.querySelector('.auth-layout').lang,language);assert.equal(d.querySelector('.auth-layout').dir,language==='en'?'ltr':'rtl');
 assert.equal(d.querySelector('#aPass').autocomplete,'current-password');assert.equal(d.querySelector('#aMail').autocomplete,'username');assert(d.querySelector('[role=dialog][aria-modal=true]'));
 assert.equal(d.querySelector('#authShowPassword').getAttribute('aria-label'),language==='en'?'Show password':'إظهار كلمة المرور');d.querySelector('#authShowPassword').click();assert.equal(d.querySelector('#aPass').type,'text');
 d.querySelector('#aMail').value='person@example.com';d.querySelector('#authRegTab').click();assert.equal(d.querySelector('#aMail').value,'person@example.com');assert.equal(d.querySelector('#aPass').autocomplete,'new-password');assert.equal(d.querySelector('#aPass').minLength,10);d.querySelector('#aName').value='Learner';d.querySelector('#authLoginTab').click();d.querySelector('#authRegTab').click();assert.equal(d.querySelector('#aName').value,'Learner');
 d.querySelector('#authLoginTab').click();d.querySelector('#aPass').value='password123';
 const form=d.querySelector('#authForm');form.dispatchEvent(new w.Event('submit',{cancelable:true}));form.dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(calls.length,1);assert(d.querySelector('#aGo').disabled);assert.equal(form.getAttribute('aria-busy'),'true');
 request.reject(new Error('Invalid credentials'));await new Promise(r=>setTimeout(r,0));assert.equal(d.querySelector('#authError').hidden,false);assert(!d.querySelector('#aGo').disabled);
 form.dispatchEvent(new w.Event('submit',{cancelable:true}));request.resolve({token:'test-only-token',user:{id:'test-person',name:'Learner',role:'student'}});await new Promise(r=>setTimeout(r,0));assert.equal(route,'dash');assert.equal(w.DB.session,'test-person');assert.equal(w.API.progressOwner,'test-person');assert.equal(w.authRequestPending,false);
 w.openAuth('login');d.querySelector('#authHelp').click();assert.equal(route,'contact');
 // Registration is a real POST, repeated clicks are held, and interrupted requests cannot duplicate.
 w.openAuth('reg');d.querySelector('#aName').value='New Learner';d.querySelector('#aMail').value='new@example.com';d.querySelector('#aPass').value='longpassword123';
 const registration=d.querySelector('#authForm'),before=calls.length;
 registration.dispatchEvent(new w.Event('submit',{cancelable:true}));registration.dispatchEvent(new w.Event('submit',{cancelable:true}));
 assert.equal(calls.length,before+1);assert.equal(calls.at(-1)[0],'/auth/register');assert.equal(calls.at(-1)[1].body.email,'new@example.com');
 w.closeModal();w.openAuth('login');assert(!d.querySelector('#authForm'),'pending request cannot be reopened or duplicated');
 request.resolve({token:'test-registration-token',user:{id:'new-learner',name:'New Learner',role:'student'}});await new Promise(r=>setTimeout(r,0));
 assert.equal(w.DB.session,'new-learner');assert.equal(route,'dash');assert.equal(w.authRequestPending,false);
 w.openAuth('login');assert(d.querySelector('#authForm'),'entry remains usable after interrupted completion');

 assert(!auth.match(/accounts\.google|facebook\.com|appleid|linkedin\.com|oauth\/callback/));
 dom.window.close();
}
const css=fs.readFileSync('public/auth-entry.css','utf8');assert.match(css,/max-width:350px/);assert.match(css,/auth-layout\[lang=en\]/);assert.match(css,/focus-visible/);assert.match(css,/prefers-reduced-motion/);
console.log('PASS: AR/EN auth frame, email/password semantics, preserved drafts, visibility, single submit, errors, success hydration, help, no fake OAuth');
