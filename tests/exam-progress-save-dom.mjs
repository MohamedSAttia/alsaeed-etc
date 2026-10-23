import assert from 'node:assert/strict';import fs from 'node:fs';import {JSDOM} from 'jsdom';
const source=fs.readFileSync('public/unified-exam.js','utf8');
for(const lang of ['ar','en']){
 const dom=new JSDOM('<main id="lnBody"></main>',{url:'https://synthetic.invalid/',runScripts:'outside-only'}),w=dom.window,d=w.document;
 w.HTMLElement.prototype.scrollIntoView=function(){};w.confirm=()=>true;w.setInterval=()=>1;w.clearInterval=()=>{};let calls=0,flushes=0,ok=false;const progress={};
 w.fetch=async()=>{calls++;return{ok:false}};w.__lang=lang;
 w.APP={token:'synthetic',me:()=>({id:'a',name:'A'}),pack:()=>({course:'pmp',ar:'باقة',en:'Package'}),course:()=>({id:'pmp',code:'PMP',domains:[]}),esc:x=>String(x??''),prog:()=>progress,save(){},flushProgress:async()=>{flushes++;return ok},toast(){},api:async()=>({questions:[]})};
 w.eval(source.replace('window.UnifiedExam={open,close};','window.UnifiedExam={open,close,state:()=>S,finish};'));await w.UnifiedExam.open('pmp','test',{items:[{id:'1',type:'single',question_ar:'سؤال',question_en:'Question',options_ar:['صح','خطأ'],options_en:['Yes','No'],correct:'A',meta:{}}]});
 d.querySelector(lang==='ar'?'#uxChooseAr':'#uxChooseEn').click();d.querySelector('#uxConfirmLanguage').click();await new Promise(r=>setTimeout(r,0));d.querySelector('[data-opt]').click();d.querySelector('#uxNext').click();await new Promise(r=>setTimeout(r,0));
 assert.equal(calls,1);assert.equal(flushes,1);assert.ok(d.querySelector('#uxSaveStatus button'));assert.equal(progress.exams.test.total,1);
 ok=true;d.querySelector('#uxSaveStatus button').click();await new Promise(r=>setTimeout(r,0));assert.equal(flushes,2);assert.equal(calls,1,'retrying progress does not duplicate workspace attempts');assert.ok(!d.querySelector('#uxSaveStatus button'));assert.match(d.querySelector('#uxSaveStatus').textContent,lang==='ar'?/تم تسجيل/:/recorded/);
 await w.UnifiedExam.open('pmp','boundary',{items:Array.from({length:125},(_,i)=>({id:'q'+i,type:'single',question_ar:'سؤال',question_en:'Question',options_ar:['صح','خطأ'],options_en:['Yes','No'],correct:'A',meta:{}}))});
 d.querySelector(lang==='ar'?'#uxChooseAr':'#uxChooseEn').click();d.querySelector('#uxConfirmLanguage').click();await new Promise(r=>setTimeout(r,0));
 const state=w.UnifiedExam.state();state.items.forEach((q,i)=>{state.answers[q.id]=i<87?q.correctLetters[0]:'Z'});w.UnifiedExam.finish();await new Promise(r=>setTimeout(r,0));assert.equal(progress.exams.boundary.score,69.6);assert.equal(progress.exams.boundary.passed,false);assert.ok(d.querySelector('.ux-outcome.fail'));dom.window.close();
}
console.log('PASS exam save failure is visible in selected language; retry succeeds without duplicate attempts');
