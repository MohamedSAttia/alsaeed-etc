import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
let jsdom;
try{jsdom=await import(process.env.JSDOM_MODULE||'jsdom')}catch(error){const fallback='/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js';if(!fs.existsSync(fallback))throw error;jsdom=await import(pathToFileURL(fallback).href)}
const {JSDOM}=jsdom;
const bank=['pmp-v5-import','pmp-framework-agile-2026','pmp-pmi-reference-2026'].flatMap(n=>JSON.parse(fs.readFileSync('data/'+n+'.json')));
for(const planned of [false,true])for(const lang of ['ar','en']){
 const dom=new JSDOM('<body><main id="lnBody"></main></body>',{url:'https://case.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;w.fetch=async()=>({ok:true});
 w.APP={esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;'),pack:()=>({course:'pmp',ar:'باقة',en:'Package'}),course:()=>({id:'pmp',code:'PMP',questions:180,examMin:240}),me:()=>({id:'selection-test',name:'متدرب',nameEn:'Learner'}),prog:()=>({}),save(){},toast(){}};
 for(const file of ['pmp-shared-case.js','course-assessments.js','unified-exam.js'])w.eval(fs.readFileSync('public/'+file,'utf8'));
 const config={full:true,items:bank,...planned?{planPmpMock:true,selectItems:rows=>w.CourseAssessments.models(rows)[0]}:{}};
 await w.UnifiedExam.open('pmp-full','mock_1',config);d.querySelector(lang==='ar'?'#uxChooseAr':'#uxChooseEn').click();assert(!d.querySelector('#uxConfirmLanguage').disabled);d.querySelector('#uxConfirmLanguage').click();d.querySelector('#uxStartMock').click();
 const raw=w.PmpSharedCase.questions();
 for(let i=0;i<10;i++){
  const q=d.querySelector('#ux').examQuestion,correctIndex=q.correctLetters[0].charCodeAt(0)-65;
  assert.equal(q.id,raw[i].id);assert.equal(q['options_'+lang][correctIndex],raw[i]['options_'+lang][raw[i].correct_json[0]],'Shuffling must preserve answer meaning');
  assert.equal(d.querySelector('.ux-case-text').textContent,w.PmpSharedCase.case[lang]);
  d.querySelector('[data-opt="'+q.correctLetters[0]+'"]').click();d.querySelector('#uxNext').click();
 }
 assert(d.querySelector('#uxBreak'));const saved=JSON.parse(w.localStorage.getItem(w.localStorage.key(0)));
 assert.equal(saved.items.length,180);assert.equal(saved.caseCount,10);assert.equal(saved.pretestIds.length,planned?10:0);
 assert(saved.pretestIds.every(id=>!id.startsWith(w.PmpSharedCase.case.id)));
 assert.equal(Object.keys(saved.answers).length,10);
 for(const q of saved.items.slice(0,10))assert.equal(saved.answers[q.id],q.correctLetters[0]);
 assert.deepEqual(['people','process','business'].map(domain=>saved.items.filter(q=>q.domain===domain).length),[59,74,47]);
 w.UnifiedExam.close();w.close();
}
console.log('PASS: real bilingual planner and generic full entry normalize fresh case options without changing answer meaning, retain quotas and preserve original scoring/pretest policy');
