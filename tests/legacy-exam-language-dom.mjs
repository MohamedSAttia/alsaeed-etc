/** Real DOM interaction tests. No server, network, production account, or database required. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
let jsdom;
try{jsdom=await import(process.env.JSDOM_MODULE||'jsdom');}
catch(error){const file='/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js';if(!existsSync(file))throw error;jsdom=await import(pathToFileURL(file).href);}
async function load(file){
 const html=readFileSync(file,'utf8'),dom=new jsdom.JSDOM(html,{url:'http://legacy.test/'+file.split('/').at(-1),runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,ctx=dom.getInternalVMContext(),errors=[],prompts=[],intervals=new Map();let intervalId=0;
 w.alert=message=>prompts.push(message);w.confirm=message=>(prompts.push(message),true);w.scrollTo=()=>{};
 w.setInterval=fn=>{const id=++intervalId;intervals.set(id,fn);return id;};w.clearInterval=id=>intervals.delete(id);
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.fetch=()=>{throw Error('Unexpected network access');};
 w.addEventListener('error',event=>errors.push(event.message));
 for(const script of [...w.document.scripts]){
   const src=script.getAttribute('src');
   if(src){if(src==='/assets/pmp-bank.js')vm.runInContext(readFileSync(resolve('public','.'+src),'utf8'),ctx);continue;}
   if(script.textContent.trim())vm.runInContext(script.textContent,ctx);
 }
 await new Promise(done=>setTimeout(done,0));
 const $=selector=>w.document.querySelector(selector),all=selector=>[...w.document.querySelectorAll(selector)],run=code=>vm.runInContext(code,ctx);
 const click=selector=>{const el=$(selector);assert(el,selector+' exists');el.click();};
 return {w,dom,$,all,run,click,errors,prompts,intervals,close:()=>dom.window.close()};
}
const noArabic=text=>assert(!/[\u0600-\u06ff]/.test(text),`Unexpected Arabic in English UI: ${(text.match(/.{0,80}[\u0600-\u06ff].{0,80}/g)||[]).join(' | ')}`);
const p=await load('public/pmp-exam-2026.html');
try{
 p.run('startExam()');assert.equal(p.run('S'),null);assert(p.$('#examLanguageDialog').open);assert.equal(p.intervals.size,0);
 p.click('#examLanguageCancel');assert.equal(p.run('S'),null);
 p.run('startExam()');p.click('[data-exam-language="ar"]');assert(p.$('#examLanguageError').textContent.includes('لم يبدأ المؤقّت'));assert.equal(p.run('S'),null);assert.equal(p.intervals.size,0);p.click('#examLanguageCancel');
 for(const mode of ['exam1','exam2','exam3','exam4','chapter','domain','approach']){
   p.run(`showSetup();pickMode(document.querySelector('[data-mode="${mode}"]'));document.getElementById('chkShufA').checked=false;document.getElementById('numQ').value=5;startExam();`);
   p.click('[data-exam-language="en"]');assert.equal(p.$('#examLanguageDialog'),null,`${mode} starts`);assert.equal(p.run('S.lang'),'en');
   if(mode.startsWith('exam'))assert.equal(p.run('S.items.length'),180,`${mode} length unchanged`);
   noArabic(p.$('#exam').textContent);noArabic(p.$('header').textContent);assert.equal(p.$('html').dir,'ltr');
   const left=p.run('S.left');for(const callback of p.intervals.values())callback();assert.equal(p.run('S.left'),left-1);
 }
 p.run("S.items[0].f='';S.idx=0;S.practice=true;renderQ();checkAnswer();const it=S.items[0];it.sel=[it.correct[0]];checkAnswer();");
 assert(p.$('#qFb').textContent.includes('An English explanation is not available'));noArabic(p.$('#exam').textContent);
 p.run('finishExam()');noArabic(p.$('#report').textContent);assert.equal(p.run('loadHist().at(-1).lang'),'en');assert.equal(p.intervals.size,0);
 p.run('retryWrong()');assert(p.$('#examLanguageDialog').open);const previous=p.run('S');p.click('#examLanguageCancel');assert.equal(p.run('S'),previous);assert(!p.$('#report').classList.contains('hide'));
 p.run("const arabicId=BANK.find(q=>itemHasLanguage(mkItem(q,false),'ar')).id;runCustom([byId[arabicId]])");p.click('[data-exam-language="ar"]');assert.equal(p.run('S.lang'),'ar');assert.equal(p.$('html').dir,'rtl');assert.equal(p.$('#qText').textContent,p.run('S.items[0].qAr'));assert.equal(p.$('#bLang'),null);
 p.run('finishExam()');assert(p.$('#report').textContent.includes('مراجعة الأخطاء'));assert(!p.$('#report').textContent.includes(p.run('S.items[0].q')));
 p.run('retryWrong()');assert(p.$('#examLanguageDialog').open);p.click('#examLanguageCancel');
 p.run('saveGold({flag:[S.items[0].id],wrong:[]});openGolden()');assert(p.$('#examLanguageDialog').open);p.click('#examLanguageCancel');
 const primary=p.run(`(()=>{const it=mkItem(byId[1],false);return {en:itemHasLanguage(it,'en'),ar:itemHasLanguage(it,'ar'),noFeedback:itemHasLanguage({...it,f:null,fAr:null},'en'),noOption:itemHasLanguage({...it,opts:['']},'en'),noPrompt:itemHasLanguage({...it,prompts:[{a:'س'}]},'en'),noSentence:itemHasLanguage({...it,pdSentence:{a:'نص'}},'en'),noGraphic:itemHasLanguage({...it,svg:'<svg><text>عنوان</text></svg>',svgEn:null},'en')};})()`);
 assert.deepEqual(JSON.parse(JSON.stringify(primary)),{en:true,ar:false,noFeedback:true,noOption:false,noPrompt:false,noSentence:false,noGraphic:false});
 // All authored question types render in the selected language without machine translation.
 for(const type of ['S','M','MT','GR','HS','OR','FB','EM','PD','GRM']){
   p.run(`runCustom([BANK.find(q=>q.t==='${type}'&&itemHasLanguage(mkItem(q,false),'en'))])`);p.click('[data-exam-language="en"]');
   noArabic(p.$('#exam').textContent);assert.equal(p.run('S.items[0].t'),type);
 }
 // Missing feedback is disclosed before a custom attempt, and no timer is active for it.
 p.run("runCustom([{...byId[1],f:null,fa:null}])");const promptCount=p.prompts.length;p.click('[data-exam-language="en"]');assert(p.prompts.slice(promptCount).some(x=>x.includes('no English explanation')));assert.equal(p.intervals.size,0);
 const englishFailures=[];
 for(const q of p.run('BANK')){
   const started=p.run(`runCustom([byId[${JSON.stringify(q.id)}]],'en')`);
   if(!started){englishFailures.push({id:q.id,type:q.t,stage:'preflight'});continue;}
   p.run('S.checked[S.items[0].id]=true;renderQ()');
   const text=p.$('#exam').textContent,leaks=text.match(/.{0,60}[\u0600-\u06ff].{0,60}/g);
   if(leaks)englishFailures.push({id:q.id,type:q.t,stage:'render',leaks});
 }
 assert.deepEqual(englishFailures,[],JSON.stringify(englishFailures));
 console.log('PASS deterministic English render/reveal sweep for all '+p.run('BANK.length')+' legacy PMP questions, including cases, graphics, matching prompts, option rationale and fill-in answers');
 assert.deepEqual(p.errors,[]);
 console.log('PASS legacy PMP DOM: four 180-question full exams; chapter/domain/approach/custom/golden/retry; both languages; ten question types; preflight/cancel; timer/history; missing-feedback notice; no foreign fallback');
}finally{p.close();}
const g=await load('public/grc.html');
try{
 g.run("window.GRCAPP.go('exam')");await new Promise(done=>setTimeout(done,40));g.click('[data-ex="sep"]');assert(g.$('#exLanguageDialog').open);assert.equal(g.$('#exTimer'),null);assert.equal(g.intervals.size,0);
 g.click('#exLanguageCancel');assert.equal(g.$('#exTimer'),null);
 g.click('[data-ex="sep"]');g.click('[data-exam-language="en"]');assert.equal(g.$('#app').lang,'en');noArabic(g.$('#app').textContent);
 const timer=g.$('#exTimer').textContent;for(const cb of g.intervals.values())cb();assert.notEqual(g.$('#exTimer').textContent,timer);
 const question=g.$('.ex-stem').textContent;g.run("window.I18.set('ar')");await new Promise(done=>setTimeout(done,40));assert.equal(g.$('.ex-stem').textContent,question);assert.equal(g.$('#app').lang,'en');
 g.click('[data-pick]');g.click('#qReveal');noArabic(g.$('#app').textContent);
 g.click('#exQuit');noArabic(g.$('#app').textContent);assert.equal(g.intervals.size,0);
 g.click('#exRetry');assert(g.$('#exLanguageDialog').open);g.click('#exLanguageCancel');assert(g.$('.ex-res'));
 g.click('#exRetry');g.click('[data-exam-language="ar"]');assert.equal(g.$('#app').lang,'ar');assert.equal(g.$('#app').dir,'rtl');assert.equal(g.$('#qTr'),null);
 const arabicQuestion=g.$('.ex-stem').textContent;g.run("window.I18.set('en')");await new Promise(done=>setTimeout(done,40));assert.equal(g.$('.ex-stem').textContent,arabicQuestion);assert.equal(g.$('#app').lang,'ar');assert(g.$('#qReveal').title.includes('أجب'));
 g.click('#exQuit');g.click('#exHome');g.click('[data-ex="full"]');g.click('[data-exam-language="en"]');assert.equal(g.all('[data-jump]').length,100);noArabic(g.$('#app').textContent);
 g.click('#exQuit');assert.equal(g.run("JSON.parse(localStorage.getItem('alsaeedExam_v1'))['full|'][0].lang"),'en');g.click('#exHome');
 g.run("window.QBANK.q[window.QBANK.sep['Key Concepts'][0]].qa=''");g.click('[data-ex="sep"]');g.click('[data-exam-language="ar"]');assert(g.$('#exLanguageError').textContent.includes('لم يبدأ المؤقّت'));assert.equal(g.$('#exTimer'),null);assert.equal(g.intervals.size,0);g.click('#exLanguageCancel');
 // Explanation missing does not disable otherwise complete questions or use English fallback.
 g.run("window.QBANK.sep['Key Concepts'].forEach(id=>window.QBANK.q[id].fa='');window.QBANK.q[window.QBANK.sep['Key Concepts'][0]].qa='سؤال عربي';");g.click('[data-ex="sep"]');g.click('[data-exam-language="ar"]');g.click('[data-pick]');g.click('#qReveal');assert(g.$('.ex-rev-f').textContent.includes('الشرح غير متاح بالعربية'));
 assert.deepEqual(g.errors,[]);
 console.log('PASS legacy GRC DOM: chapter/full/retry; cancel; direction; timer/history; reveal/review single-language; interface-language changes preserve attempt; missing-question gate and missing-feedback notice');
}finally{g.close();}
