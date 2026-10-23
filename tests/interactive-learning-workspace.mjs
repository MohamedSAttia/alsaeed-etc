/** Synthetic browser only: no learner records, external requests or live changes. */
import assert from 'node:assert/strict';import fs from 'node:fs';
const {JSDOM}=await import('jsdom');
const dom=new JSDOM('<!doctype html><html><body><nav class="package-primary-nav"><button data-lt="library">Library</button></nav><main id="lnBody"><button id="open">Open</button></main></body></html>',{url:'https://local.test/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;let actor='a',token='a-token',pending=false,loaded=true,saves=0,library=0,pointsResolve=null;
const records={a:{lessons:{0:true}},b:{lessons:{}}};const players=[],calls=[];
w.I18={lang:'en'};w.biTitle=l=>w.I18.lang==='en'?l.t_en:l.t;
w.APP={me:()=>({id:actor}),get token(){return token;},pack:()=>({course:'rmp'}),course:()=>({id:'rmp',chapters:[{ar:'الأول',en:'First'},{ar:'الثاني',en:'Second'}]}),owns:()=>true,isAdmin:()=>false,prog:()=>records[actor],save:()=>{saves++;pending=true;},toast:()=>{},progressView:()=>({pending,loaded,error:false}),flushProgress:async()=>{pending=false;},loadProgressFor:async()=>{loaded=true;},api:async(route,options)=>{calls.push({route,options});if(route.startsWith('/learning-points/'))return pointsResolve?new Promise(resolve=>{pointsResolve=resolve;}):{self:{points:25}};return{items:[]};}};
w.LESSONS={p:[{t:'أ',t_en:'One',ch:0,vimeo:'1',dur:'1:00',notes_en:'Saved authored summary',quiz:[{}]},{t:'ب',t_en:'Two',ch:1,vimeo:'2',dur:'1:00'},{t:'ج',t_en:'Three',ch:0,vimeo:'3',dur:'1:00'}]};
w.Vimeo={Player:class{constructor(frame){this.frame=frame;this.handlers={};players.push(this);}getDuration(){return Promise.resolve(60);}on(n,f){this.handlers[n]=f;}destroy(){return Promise.resolve();}play(){return Promise.resolve();}}};
w.fetch=()=>{throw Error('Unexpected network');};w.document.querySelector('[data-lt]').onclick=()=>library++;
const settle=()=>new Promise(r=>setTimeout(r,0));const q=s=>w.document.querySelector(s),click=s=>q(s).click();
for(const file of ['public/learning-workspace.js','public/v17-interactive.js'])w.eval(fs.readFileSync(file,'utf8'));
try{
 q('#open').focus();w.InteractiveVideo.open('p',0);await settle();
 assert.equal(q('#iv').dir,'ltr');assert.equal(q('.iv-body').firstElementChild.className,'iv-side');
 assert.equal(q('.lw-module-count').textContent,'1 / 2 · 50%');assert.equal(q('.lw-points').textContent,'25 points');
 assert.match(q('.lw-sync').textContent,/Saved to your account/);assert.equal(q('#ivAutoNext').checked,false);
 assert.deepEqual([...w.document.querySelectorAll('[data-go]')].map(x=>+x.dataset.go),[0,2,1]);
 assert.equal(q('#ivNext').parentElement.className,'lw-step-nav');assert.ok(!q('#ivFrame').src.includes('autoplay=1'));
 click('.lw-module-toggle');assert.equal(q('.lw-module-toggle').getAttribute('aria-expanded'),'true');q('.iv-side').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(q('.lw-module-toggle').getAttribute('aria-expanded'),'false');assert.equal(w.document.activeElement.className,'lw-module-toggle');
 click('#ivNext');await settle();assert.equal(q('.iv-li.cur').dataset.go,'2');assert.ok(!q('#ivFrame').src.includes('autoplay=1'));assert.equal(saves,0);assert.equal(records.a.lessons[2],undefined);
 players.at(-1).handlers.ended();await settle();assert.equal(saves,1);assert.equal(q('.lw-module-count').textContent,'2 / 2 · 100%');assert.match(q('.lw-sync').textContent,/Not synced yet/);assert.equal(q('.lw-account-progress button').hidden,false);
 click('.lw-account-progress button');await settle();assert.match(q('.lw-sync').textContent,/Saved to your account/);
 // Returning from another device uses hydrated canonical state, without new writes.
 w.InteractiveVideo.close();records.a.lessons={0:true,2:true};w.InteractiveVideo.open('p',1);await settle();assert.equal(q('.lw-module-count').textContent,'0 / 1 · 0%');assert.equal(saves,1);
 click('.lw-continue-links button');assert.equal(library,1);assert.equal(q('#iv'),null);assert.equal(w.document.activeElement.id,'open');
 // Old point results and player completions cannot cross accounts.
 pointsResolve=true;w.InteractiveVideo.open('p',0);await settle();const resolveOld=pointsResolve,oldPlayer=players.at(-1);actor='b';token='b-token';resolveOld({self:{points:999}});await settle();assert.doesNotMatch(q('.lw-points').textContent,/999/);oldPlayer.handlers.ended();assert.equal(saves,1);assert.deepEqual(records.b.lessons,{});
 w.document.dispatchEvent(new w.CustomEvent('learning-progress-updated',{detail:{packageId:'p'}}));assert.equal(q('#iv'),null);
 pointsResolve=null;w.I18.lang='ar';w.InteractiveVideo.open('p',0);await settle();assert.equal(q('#iv').dir,'rtl');assert.match(q('.lw-module-toggle').textContent,/محاور/);assert.equal(q('.lw-module-count').textContent,'0 / 2 · 0%');
 w.dispatchEvent(new w.HashChangeEvent('hashchange'));assert.equal(q('#iv'),null);
 w.I18.lang='en';loaded=false;w.InteractiveVideo.open('p',0);await settle();assert.equal(q('.lw-module-count').textContent,'—');assert.equal(q('progress').hasAttribute('value'),false);assert.match(q('.lw-sync').textContent,/Loading saved progress/);w.InteractiveVideo.close();
 loaded=true;pending=true;w.APP.flushProgress=async()=>{throw Error('offline');};w.InteractiveVideo.open('p',0);await settle();click('.lw-account-progress button');await settle();assert.match(q('.lw-sync').textContent,/Sync failed/);assert.equal(q('.lw-account-progress button').disabled,false);w.InteractiveVideo.close();
 actor=undefined;token=undefined;records[actor]={lessons:{}};w.InteractiveVideo.open('p',0);await settle();assert.match(q('.lw-points').textContent,/Sign in to view/);assert.match(q('.lw-sync').textContent,/Free preview/);assert.equal(q('.lw-account-progress button').hidden,true);assert.equal(q('.lw-module-count').textContent,'—');w.InteractiveVideo.close();
 assert.ok(calls.every(c=>!c.options?.method||c.options.method==='GET'),'Workspace only reads, never manufactures XP');
 const css=fs.readFileSync('public/learning-workspace.css','utf8');assert.match(css,/@media\(max-width:850px\)/);assert.match(css,/\.lw-modules-open \.iv-side\{display:block\}/);assert.match(css,/:focus-visible/);assert.match(css,/inset|inline/);
 console.log('PASS interactive workspace: canonical published order, genuine module counts, GET-only XP, pending/retry, no navigation completion/autoplay, mobile toggle/Escape, RTL/EN, focus/close/library/back, cross-account stale results and hydrated device progress.');
}finally{w.InteractiveVideo.close();dom.window.close();}
