/** Real DOM interaction tests. No server, network, production account, or database required. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
let jsdom;
try{jsdom=await import(process.env.JSDOM_MODULE||'jsdom');}
catch(error){const file='/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js';if(!existsSync(file))throw error;jsdom=await import(pathToFileURL(file).href);}
async function load(file,snapshot=null){
 const html=readFileSync(file,'utf8'),dom=new jsdom.JSDOM(html,{url:'http://legacy.test/'+file.split('/').at(-1),runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,ctx=dom.getInternalVMContext(),errors=[],prompts=[],intervals=new Map();let intervalId=0;
 if(snapshot)w.sessionStorage.setItem('pmp-full-attempt-v1',snapshot);
 w.alert=message=>prompts.push(message);w.confirm=message=>(prompts.push(message),true);w.scrollTo=()=>{};
 w.setInterval=fn=>{const id=++intervalId;intervals.set(id,fn);return id;};w.clearInterval=id=>intervals.delete(id);
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.fetch=()=>{throw Error('Unexpected network access');};
 w.addEventListener('error',event=>errors.push(event.message));
 for(const script of [...w.document.scripts]){
   const src=script.getAttribute('src');
   if(src){if(['/assets/pmp-bank.js','/pmp-shared-case.js'].includes(src))vm.runInContext(readFileSync(resolve('public','.'+src),'utf8'),ctx);continue;}
   if(script.textContent.trim())vm.runInContext(script.textContent,ctx);
 }
 await new Promise(done=>setTimeout(done,0));
 const $=selector=>w.document.querySelector(selector),all=selector=>[...w.document.querySelectorAll(selector)],run=code=>vm.runInContext(code,ctx);
 const click=selector=>{const el=$(selector);assert(el,selector+' exists');el.click();};
 return {w,dom,$,all,run,click,errors,prompts,intervals,close:()=>dom.window.close()};
}
const noArabic=text=>assert(!/[\u0600-\u06ff]/.test(text),`Unexpected Arabic in English UI: ${(text.match(/.{0,80}[\u0600-\u06ff].{0,80}/g)||[]).join(' | ')}`);
let p=await load('public/pmp-exam-2026.html');
try{
 p.run("document.getElementById('chkBreaks').checked=false;startExam('en')");
 assert.equal(p.run('S.items.length'),180);assert.equal(p.run('S.sections[0].brk'),600);
 const counts=p.run('S.items.reduce((c,q)=>(c[q.dm]=(c[q.dm]||0)+1,c),{})');assert.equal(JSON.stringify(counts),JSON.stringify({people:59,process:74,business:47}));
 const english=p.$('#caseText').textContent,title=p.$('#caseTitle').textContent;
 assert(english.length>2000);assert(title.includes('Municipal'));
 for(let i=0;i<10;i++){p.run(`S.idx=${i};renderQ()`);assert.equal(p.$('#caseText').textContent,english);assert.equal(p.$('#caseTitle').textContent,title);assert.equal(p.$('#caseEnglishToggle'),null);noArabic(p.$('#exam').textContent);}
 // The original case is fully authored in Arabic; legacy unrelated bank readiness remains gated.
 assert(p.run("S.items.slice(0,10).every(it=>itemHasLanguage(it,'ar'))"));
 p.run("S.lang='ar';S.idx=0;applyExamLanguage();renderQ()");const arabic=p.$('#caseText').textContent,arabicTitle=p.$('#caseTitle').textContent;assert(/[\u0600-\u06ff]/.test(arabic));
 for(let i=0;i<10;i++){p.run(`S.idx=${i};renderQ()`);assert.equal(p.$('#caseText').textContent,arabic);assert.equal(p.$('#caseTitle').textContent,arabicTitle);assert(p.$('#caseEnglishText').hidden);p.click('#caseEnglishToggle');assert(!p.$('#caseEnglishText').hidden);assert.equal(p.$('#caseEnglishText p').textContent,p.run('S.items[S.idx].q'));assert.equal(p.$('#caseText').textContent,arabic);}
 p.run("S.lang='en';applyExamLanguage();S.items[9].sel=[1];startBreak(600)");const left=p.run('S.left'),snapshot=p.w.sessionStorage.getItem('pmp-full-attempt-v1');assert(snapshot);p.close();p=await load('public/pmp-exam-2026.html',snapshot);
 p.click('#resumeSavedPmp');assert.equal(p.run('S.lang'),'en');assert.equal(p.run('S.items[9].sel[0]'),1);assert(p.$('#breakOv').classList.contains('on'));assert.equal(p.$('#caseTitle').textContent,title);assert.equal(p.$('#caseText').textContent,english);assert.equal(p.run('S.left'),left);
 p.run('endBreak();endBreak()');assert.equal(p.run('S.curSection'),1);assert.equal(p.run('S.idx'),10);assert.equal(p.run('S.left'),left);assert(p.$('#caseSplit').classList.contains('hide'));assert.equal(p.$('#caseEnglishToggle'),null);
 p.run('S.idx=93;S.sections[1].brk=600;startBreak(600)');const second=JSON.parse(p.w.sessionStorage.getItem('pmp-full-attempt-v1'));second.state.breakUntil=Date.now()-20000;second.savedAt=Date.now()-620000;p.close();p=await load('public/pmp-exam-2026.html',JSON.stringify(second));p.click('#resumeSavedPmp');assert.equal(p.run('S.idx'),94);assert.equal(p.run('S.curSection'),2);assert.equal(p.run('paused'),false);assert(p.run('S.left')<=left-20);assert(p.run('S.left')>=left-22);
 p.run('S.curSection=0;S.idx=9;startBreak(600);S.breakUntil=Date.now()-100000');const prior=p.run('S.left');p.run('endBreak()');assert.equal(p.run('S.left'),prior-100);assert.equal(p.run('S.idx'),10);
 console.log('PASS legacy PMP: fixed original title/case for all10,180 weighted items,Arabic-only case with English question aid,English-only controls,mandatory first break,paused reload,exact answers,duplicate resume and later break expiry');
}finally{p.close()}
