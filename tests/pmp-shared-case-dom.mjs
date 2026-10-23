import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
let jsdom;
try{jsdom=await import(process.env.JSDOM_MODULE||'jsdom')}catch(error){const fallback='/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js';if(!fs.existsSync(fallback))throw error;jsdom=await import(pathToFileURL(fallback).href)}
const {JSDOM}=jsdom;
const code=fs.readFileSync('public/unified-exam.js','utf8');
const q={type:'single',domain:'people',question_ar:'ماذا يفعل فريق المشروع؟',question_en:'What should the project team do?',options_ar:['يحلل الأثر','يتجاهل الأثر'],options_en:['Analyze impact','Ignore impact'],correct:'A',explanation_ar:'التفسير',explanation_en:'Explanation',meta:{}};
const bank=Array.from({length:180},(_,i)=>({...q,id:'Q'+i,meta:i<10?{sharedCaseId:'original-case-v1',caseTitle:{ar:'عنوان الحالة الثابت',en:'Fixed case title'},scenarioText:{ar:'هذه حالة عربية مشتركة طويلة.\nتفاصيل الحالة الثانية.',en:'This is the same long English case.\nAdditional case detail.'}}:{}}));
for(const lang of ['ar','en']){
 const dom=new JSDOM('<body><main id="lnBody"></main></body>',{url:'https://case.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 let now=1800000000000,seq=0,owner='isolated-user';const intervals=new Map(),alerts=[];w.Date.now=()=>now;w.setInterval=fn=>{intervals.set(++seq,fn);return seq};w.clearInterval=id=>intervals.delete(id);w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.alert=x=>alerts.push(x);w.fetch=async()=>({ok:true});
 const advance=ms=>{now+=ms;for(const fn of [...intervals.values()])fn()};
 w.APP={esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;'),pack:()=>({course:'pmp',ar:'باقة',en:'Package'}),course:()=>({id:'pmp',code:'PMP',questions:180,examMin:240}),me:()=>({id:owner,name:'متدرب',nameEn:'Learner'}),prog:()=>({}),save(){},toast(){}};
 w.eval(code);
 const open=()=>w.UnifiedExam.open('pmp-full','mock_1',{full:true,items:bank});
 await open();d.querySelector(lang==='ar'?'#uxChooseAr':'#uxChooseEn').click();d.querySelector('#uxConfirmLanguage').click();d.querySelector('#uxStartMock').click();
 const narrative=bank[0].meta.scenarioText[lang];
 for(let i=0;i<10;i++){
  assert.equal(d.querySelector('.ux-case-text').textContent,narrative);assert.equal(d.querySelector('.ux-case-pane h2').textContent,bank[0].meta.caseTitle[lang]);assert.equal(d.querySelector('.ux-q').textContent,q['question_'+lang]);
  assert.equal(d.querySelector('[data-i="10"]').disabled,true);
  if(lang==='ar'){const toggle=d.querySelector('.ux-english-translation');assert(toggle);assert(!toggle.open);assert(toggle.textContent.includes(q.question_en));assert(!d.querySelector('.ux-case-text').textContent.includes('English'));}
  else{assert(!d.querySelector('.ux-english-translation'));assert(!/[\u0600-\u06ff]/.test(d.querySelector('#ux').textContent));}
  d.querySelector('[data-opt]').click();d.querySelector('#uxNext').click();
 }
 assert(d.querySelector('#uxBreak'));assert.equal(d.querySelector('#uxBreakTime').textContent,'10:00');const frozen=d.querySelector('#uxTime').textContent;
 advance(120000);assert.equal(d.querySelector('#uxTime').textContent,frozen);assert.equal(d.querySelector('#uxBreakTime').textContent,'08:00');
 w.UnifiedExam.close();advance(60000);await open();assert(d.querySelector('#uxRestore'));d.querySelector('#uxRestore').click();assert.equal(d.querySelector('#uxBreakTime').textContent,'07:00');assert.equal(d.querySelector('#uxTime').textContent,frozen);
 const key=w.localStorage.key(0);const snap=JSON.parse(w.localStorage.getItem(key));assert.equal(Object.keys(snap.answers).length,10);assert.equal(new Set(snap.items.map(x=>x.id)).size,180);
 // Expiry survives closing. Only time after the break expiry is exam time.
 w.UnifiedExam.close();advance(430000);await open();d.querySelector('#uxRestore').click();assert(!d.querySelector('#uxBreak'));assert(!d.querySelector('.ux-case-pane'));assert.equal(d.querySelector('.ux-meta span').textContent,lang==='ar'?'سؤال 11 / 180':'Question 11 / 180');assert.equal(d.querySelector('#uxTime').textContent,'03:59:50');assert(d.querySelector('[data-i="9"]').disabled);
 // No duplicate first break on resume; later boundary stays 95.
 d.querySelector('[data-i="94"]').click();d.querySelector('#uxNext').click();assert(d.querySelector('#uxBreak'));assert.equal(d.querySelector('#uxBreakTime').textContent,'10:00');advance(700000);assert.equal(d.querySelector('#uxTime').textContent,'03:58:10');assert(!d.querySelector('#uxBreak'));assert(d.querySelector('[data-i="94"]').disabled);assert.equal(d.querySelector('[data-i="95"]').disabled,false);
 w.UnifiedExam.close();await w.UnifiedExam.open('pmp-full','chapter_0',{items:bank.slice(0,10)});d.querySelector(lang==='ar'?'#uxChooseAr':'#uxChooseEn').click();d.querySelector('#uxConfirmLanguage').click();assert(!d.querySelector('.ux-case-pane'));assert.equal(!!d.querySelector('.ux-english-translation'),lang==='ar');assert.deepEqual(alerts,[]);w.UnifiedExam.close();owner='isolated-user';await open();d.querySelector('#uxRestore').click();owner='other-user';advance(1000);assert(!d.querySelector('#ux'),'account switch closes prior session');assert(!w.localStorage.getItem('ux-mock-v2:other-user:pmp-full:mock_1'));await open();assert(d.querySelector('#uxChooseAr'));assert(!d.querySelector('#uxRestore'));w.UnifiedExam.close();w.close();
}
console.log('PASS: persistent shared case and one-way translation in both languages; all10 answers retained,10-minute paused break reload/expiry/early resume, section locking, later break exactly once, chapter unchanged');
