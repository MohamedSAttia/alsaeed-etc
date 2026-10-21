/** Actual DOM integration. Run with JSDOM_MODULE if jsdom is installed elsewhere. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
let jsdom;
try { jsdom=await import(process.env.JSDOM_MODULE||'jsdom'); }
catch(error){const shared='/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js';if(!fs.existsSync(shared))throw error;jsdom=await import(pathToFileURL(shared).href)}
const exam=fs.readFileSync('public/unified-exam.js','utf8'),coach=fs.readFileSync('public/exam-ai-v19.js','utf8'),page=fs.readFileSync('public/index.html','utf8');
const i18Start=page.indexOf('window.I18 = (function () {'),i18=page.slice(i18Start,page.indexOf('</script>',i18Start));
assert(i18Start>=0);
for(const selected of ['ar','en']){
 const opposite=selected==='ar'?'en':'ar';
 const dom=new jsdom.JSDOM('<!doctype html><html><body><div id="lnBody"><p id="packageContent">Package content</p></div></body></html>',{url:'https://exam.test/#pkg/pmp-full',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document,errors=[],observers=[];let timers=0,attempts=0;const progress={};
 const NativeObserver=w.MutationObserver;w.MutationObserver=class extends NativeObserver{constructor(cb){super(cb);observers.push(this)}};
 w.addEventListener('error',event=>errors.push(event.error||event.message));w.HTMLElement.prototype.scrollIntoView=function(){};
 w.setInterval=()=>++timers;w.clearInterval=()=>{};w.confirm=()=>true;w.alert=message=>{throw Error(message)};w.print=()=>{};w.fetch=async()=>{attempts++;return{ok:true}};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const course={id:'pmp',code:'PMP',questions:180,domains:[{k:'people',ar:'الأفراد',en:'People'}]};
 w.APP={token:'test',esc,pack:()=>({course:'pmp',ar:'الباقة العربية',en:'English package'}),course:()=>course,me:()=>({name:'متدرّب',nameEn:'Learner'}),prog:()=>progress,save(){},toast(){},api:async()=>({questions:[]})};
 w.LANGS=[{k:'ar',dir:'rtl'},{k:'en',dir:'ltr'}];w.__lang=opposite;w.eval(i18);w.I18.set(opposite);
 w.eval(exam);w.eval(coach);d.dispatchEvent(new w.Event('DOMContentLoaded'));
 const q={id:'single',type:'single',question_ar:'ما الاختيار الصحيح؟',question_en:'Which choice is correct?',options_ar:['إجابة صحيحة','إجابة أخرى'],options_en:['Correct choice','Other choice'],correct:'A',explanation_ar:'تفسير عربي واضح.',explanation_en:'',domain:'people',difficulty:'hard',meta:{}};
 await w.UnifiedExam.open('pmp-full','chapter_موضوع عربي',{items:[q]});assert(!d.querySelector('#ux .ux-q'));assert.equal(timers,0);assert.equal(attempts,0);
 d.querySelector(selected==='ar'?'#uxChooseAr':'#uxChooseEn').click();d.querySelector('#uxConfirmLanguage').click();await new Promise(r=>setTimeout(r,0));
 const checkSelected=(root=d.querySelector('#ux'))=>{w.I18.sweep(d.body);const text=root.textContent;if(selected==='en')assert(!/[\u0600-\u06ff]/.test(text),text);else{assert(!text.includes('Check Answer'),text);assert(!text.includes('Flag for Review'),text);assert(!text.includes('Dr Mohamed Attia Coach'),text)}};
 assert.equal(d.documentElement.lang,opposite,'exam language must not replace page preference');assert.equal(d.querySelector('#ux').lang,selected);assert.equal(d.querySelector('#ux').dir,selected==='ar'?'rtl':'ltr');
 assert.equal(d.querySelector('#ux .ux-q').textContent,q['question_'+selected]);assert(!d.querySelector('#uxLang'));checkSelected();assert.equal(timers,1);
 const correct=[...d.querySelectorAll('[data-opt]')].find(el=>el.textContent.includes(selected==='ar'?'إجابة صحيحة':'Correct choice'));correct.click();d.querySelector('#uxCheck').click();checkSelected();
 d.querySelector('#uxCalc').click();checkSelected(d.querySelector('#uxPanel'));d.querySelector('#uxPanelClose').click();
 d.querySelector('#uxAI').click();const panel=d.querySelector('#coach20');assert(panel);checkSelected(panel);panel.querySelector('[data-k="explain"]').click();checkSelected(panel);panel.querySelector('.coach20x').click();
 d.querySelector('#uxNext').click();await new Promise(r=>setTimeout(r,0));checkSelected();assert(d.querySelector('.ux-report'));assert.equal(progress.exams['chapter_موضوع عربي'].score,100);assert.equal(attempts,1);
 d.querySelector('#uxReview').click();checkSelected(d.querySelector('#uxReviewDetails'));assert(!d.querySelector('#uxReviewLang'));if(selected==='en')assert(d.querySelector('#uxReviewDetails').textContent.includes('English explanation has not been published'));
 d.querySelector('#uxAgain').click();await new Promise(r=>setTimeout(r,0));assert(d.querySelector('#uxChooseAr'));assert(!d.querySelector('#ux .ux-q'),'retry must choose a fresh language before any question');
 w.UnifiedExam.close();assert.equal(d.querySelector('#packageContent').style.display,'');assert.deepEqual(errors,[]);
 observers.forEach(o=>o.disconnect());w.close();
}
console.log('PASS: actual DOM keeps selected Arabic on an English page and English on an Arabic page through questions, global translation sweeps, calculator, coach, report, review and retry');
