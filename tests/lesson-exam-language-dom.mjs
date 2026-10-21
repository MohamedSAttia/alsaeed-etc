/** Uploaded lesson/chapter quizzes keep their authored content and grading rules. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
let jsdom;
try {jsdom=await import(process.env.JSDOM_MODULE||'jsdom')}
catch(error){const shared='/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js';if(!fs.existsSync(shared))throw error;jsdom=await import(pathToFileURL(shared).href)}
const page=fs.readFileSync('public/index.html','utf8');
const start=page.indexOf('function runLessonQuiz(pid, key) {'),end=page.indexOf('/* ═══════════ الشهادة',start);
const source=page.slice(start,end),i18Start=page.indexOf('window.I18 = (function () {'),i18=page.slice(i18Start,page.indexOf('</script>',i18Start));
const single={type:'single',q:'ما الإجابة الصحيحة؟',q_en:'Which answer is correct?',options:['الإجابة الصحيحة','إجابة ثانية','إجابة ثالثة','إجابة رابعة'],options_en:['Correct answer','Second answer','Third answer','Fourth answer'],correct:0};
function harness(quiz,pageLang='ar'){
 const dom=new jsdom.JSDOM('<!doctype html><html><body></body></html>',{url:'https://exam.test',runScripts:'outside-only'}),w=dom.window,d=w.document,progress={},writes=[],toasts=[],images=[];let saves=0,unified=0;
 const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const close=()=>d.querySelector('#ov')?.remove();
 const app={token:'test',prog:()=>progress,save(){saves++},toast:m=>toasts.push(m),modal(html,after){close();const ov=d.createElement('div');ov.id='ov';ov.innerHTML=html;d.body.append(ov);ov.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);after?.()},closeModal:close};
 w.APP=app;w.A=()=>app;w.$=s=>d.querySelector(s);w.$$=s=>[...d.querySelectorAll(s)];w.esc=esc;w.LESSONS={pkg:[{ch:0,quiz}]};w.LANGS=[{k:'ar',dir:'rtl'},{k:'en',dir:'ltr'}];w.__lang=pageLang;w.UnifiedExam={open(){unified++}};
 w.fetch=async(url,config)=>{if(url.includes('/api/quiz-images/')){images.push(url);return{ok:true,blob:async()=>new w.Blob(['image'])}}writes.push(JSON.parse(config.body));return{ok:true}};
 w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.eval(i18);w.I18.set(pageLang);w.eval(source);
 const click=s=>{const element=d.querySelector(s);assert(element,s);element.click()};
 const choose=lang=>{click(lang==='en'?'#lessonChooseEn':'#lessonChooseAr');assert.equal(saves,0);assert.equal(writes.length,0);click('#lessonStart')};
 const question=()=>d.querySelector('[data-lesson-question]')?.textContent;
 const sweep=()=>w.I18.sweep(d.body);
 const text=()=>d.querySelector('[data-exam-language]')?.textContent;
 const submitRadio=value=>{d.querySelector('[name=lessonAnswer][value="'+value+'"]').checked=true;click('#lessonCheck');click('#lessonCheck')};
 return{w,d,dom,progress,writes,toasts,images,click,choose,question,sweep,text,submitRadio,get saves(){return saves},get unified(){return unified}};
}
for(const lang of ['ar','en']){
 const quiz=[structuredClone(single)],before=JSON.stringify(quiz),h=harness(quiz,lang==='ar'?'en':'ar');
 h.w.runExam('pkg','ch0');assert.equal(h.unified,0,'authored chapter quizzes must not be replaced by unrelated bank questions');assert(h.d.querySelector('#lessonChooseAr'));assert.equal(h.question(),undefined);assert.equal(h.saves,0);assert.equal(h.writes.length,0);
 h.choose(lang);h.sweep();assert.equal(h.question(),lang==='ar'?single.q:single.q_en);assert.equal(h.d.querySelector('[data-exam-language]').lang,lang);assert.equal(h.w.__lang,lang==='ar'?'en':'ar');
 const checkLanguage=()=>{h.sweep();if(lang==='en')assert(!/[\u0600-\u06ff]/.test(h.text()),h.text());else{assert(!h.text().includes('Check answer'));assert(!h.text().includes('Correct answer'))}};checkLanguage();
 h.submitRadio(0);checkLanguage();assert.equal(h.progress.exams.ch0.score,100);assert.equal(h.progress.exams.ch0.passed,true);assert.equal(h.progress.exams.ch0.language,lang);assert.equal(h.writes.length,1);assert.equal(h.writes[0].max,1);assert.equal(h.writes[0].detail.language,lang);
 h.click('#lessonAgain');assert(h.d.querySelector('#lessonChooseAr'));assert.equal(h.question(),undefined);assert.equal(JSON.stringify(quiz),before,'published quiz content must remain unchanged');h.dom.window.close();
}
// Incomplete English content is explicitly excluded, and original essay keys survive filtering.
{
 const quiz=[{...single,q_en:'',options_en:[]},{type:'essay',q:'اشرح إجابتك',q_en:'Explain your answer'},{type:'truefalse',q:'العبارة صحيحة؟',q_en:'Is the statement true?',correct:1}],h=harness(quiz);
 h.w.runLessonQuiz('pkg','lesson0');h.click('#lessonChooseEn');assert(h.text().includes('2 of 3'));assert(h.text().includes('excluded'));assert.equal(h.saves,0);h.click('#lessonStart');
 assert.equal(h.question(),'Explain your answer');h.d.querySelector('#essayAnswer').value='My explanation';h.click('#lessonCheck');assert.equal(h.progress.essayAnswers['lesson0:1'].answer,'My explanation');assert.equal(h.progress.essayAnswers['lesson0:1'].language,'en');assert(!h.progress.essayAnswers['lesson0:0']);assert.equal(h.writes.length,0);h.click('#lessonCheck');
 h.submitRadio(1);assert.equal(h.progress.exams.lesson0.score,100);assert.equal(h.progress.exams.lesson0.autoCount,1);assert.equal(h.progress.exams.lesson0.pendingReview,1);assert.equal(h.progress.exams.lesson0.passed,false);assert.equal(h.writes[0].detail.essayPending,1);assert.equal(h.writes[0].max,1);h.dom.window.close();
}
// No translation is fabricated for original Arabic content; cancellation records nothing.
{
 const h=harness([{...single,q_en:'',options_en:[]}],'en');h.w.runLessonQuiz('pkg','ch0');h.click('#lessonChooseEn');assert(h.d.querySelector('#lessonStart').disabled);assert(h.text().includes('No complete questions'));h.click('#lessonStart');assert.equal(h.question(),undefined);h.click('#lessonChooseAr');assert(!h.d.querySelector('#lessonStart').disabled,'empty optional English options must not block Arabic');h.click('[data-close]');assert.equal(h.saves,0);assert.equal(h.writes.length,0);h.dom.window.close();
 const other=harness([{...single,q:'English accidentally stored as Arabic'}]);other.w.runLessonQuiz('pkg','ch0');other.click('#lessonChooseAr');assert(other.d.querySelector('#lessonStart').disabled,'unqualified English text must not be called Arabic');other.dom.window.close();
}
// Selected matching translations retain target order and scoring, with no default-language fallback.
for(const lang of ['ar','en']){
 const q={type:'matching',q:'صِل العناصر',q_en:'Match the items',pairs:[['الأول','هدف أول'],['الثاني','هدف ثان']],pairs_en:[['First','First target'],['Second','Second target']]},h=harness([q],lang==='en'?'ar':'en');h.w.runLessonQuiz('pkg','ch0');h.choose(lang);h.sweep();
 const selects=[...h.d.querySelectorAll('[data-match]')];selects[0].value='1';selects[1].value='0';h.click('#lessonCheck');assert(selects.every(x=>x.disabled));h.click('#lessonCheck');assert.equal(h.progress.exams.ch0.score,100);if(lang==='en')assert(!/[\u0600-\u06ff]/.test(h.text()));h.dom.window.close();
}
// Arabic-only diagrams cannot be presented as English; explicit translated diagrams retain hotspot grading.
{
 const q={type:'hotspot',q:'حدد الموضع',q_en:'Select the location',imageId:'arabic-image',x:25,y:50,radius:8};
 const h=harness([q]);h.w.runLessonQuiz('pkg','ch0');h.click('#lessonChooseEn');assert(h.d.querySelector('#lessonStart').disabled);assert.equal(h.images.length,0);h.dom.window.close();
 const unsupported=harness([{...q,imageId_en:'unsupported-translated-id'}]);unsupported.w.runLessonQuiz('pkg','ch0');unsupported.click('#lessonChooseEn');assert(unsupported.d.querySelector('#lessonStart').disabled,'the backend serves only the authorized base imageId reference');unsupported.dom.window.close();
 for(const lang of ['ar','en']){
  const v=harness([{...q,imageId:lang==='en'?'english-image':'arabic-image',visualLanguage:lang}]);v.w.runLessonQuiz('pkg','ch0');v.choose(lang);await new Promise(r=>setTimeout(r,0));assert.equal(v.images[0],'/api/quiz-images/'+(lang==='en'?'english-image':'arabic-image'));
  const img=v.d.querySelector('#hotspotImage img');assert(img);img.getBoundingClientRect=()=>({left:0,top:0,width:100,height:100});img.dispatchEvent(new v.w.MouseEvent('click',{bubbles:true,clientX:25,clientY:50}));v.click('#lessonCheck');v.click('#lessonCheck');assert.equal(v.progress.exams.ch0.score,100);v.dom.window.close();
 }
}
console.log('PASS: uploaded lesson/chapter quizzes require explicit language; selected-only questions/options/UI/results; safe missing translations; stable essay keys and pending grading; matching and hotspot scoring; cancellation and retry; global page language cannot override the exam');
