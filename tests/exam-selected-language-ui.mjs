import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const nodes=new Map();let bodyHtml='',timerStarts=0,attempts=0,progress={};
const node=key=>{if(!nodes.has(key))nodes.set(key,{innerHTML:'',attrs:{},setAttribute(k,v){this.attrs[k]=v},focus(){},scrollIntoView(){},insertAdjacentHTML(where,html){this.innerHTML+=html},remove(){nodes.delete(key)}});return nodes.get(key)};
const context={
 window:{APP:{esc:String,me:()=>({name:'متدرّب',nameEn:'Learner'}),prog:()=>progress,save(){},toast(){}},print(){}},
 document:{querySelector:node,querySelectorAll:()=>[],body:{insertAdjacentHTML(where,html){bodyHtml=html},classList:{add(){},remove(){}}}},
 DOMParser:class{parseFromString(value){return{querySelectorAll:()=>[],body:{innerHTML:value}}}},
 fetch:()=>{attempts++;return Promise.resolve({ok:true})},
 localStorage:{getItem:()=>null,setItem(){}},AbortController,URLSearchParams,setTimeout,clearTimeout,
 setInterval(){timerStarts++;return timerStarts},clearInterval(){},confirm:()=>true,alert(){},navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[]})}}
};
vm.createContext(context);
const source=fs.readFileSync('public/unified-exam.js','utf8');
vm.runInContext(source.replace('window.UnifiedExam={open,close};','window.UnifiedExam={normalize,renderInstructions,render,finish,renderReview,showBreak,showCalc,showAI,answerHtml,answerDescription,correctDescription,isCorrect,sourceLabel,referenceText,setState:s=>S=s};'),context);
const e=context.window.UnifiedExam;
const raw={id:'q',type:'scenario',question_ar:'ما القرار الصحيح؟',question_en:'What is the right decision?',options_ar:['الخيار الأول','الخيار الثاني'],options_en:['First choice','Second choice'],correct:'A',explanation_ar:'هذا هو التفسير العربي.',explanation_en:'This is the English explanation.',reference:'مرجع عربي فقط',domain:'people',difficulty:'hard',meta:{scenarioText:{ar:'سياق الحالة بالعربية.',en:'English scenario context.'}}};
const visible=html=>html.replace(/<[^>]*>/g,'');
const noArabic=html=>assert(!/[\u0600-\u06ff]/.test(visible(html)),visible(html));
const selected=(html,lang,ar,en)=>{assert(html.includes(lang==='ar'?ar:en));assert(!html.includes(lang==='ar'?en:ar));if(lang==='en')noArabic(html)};
function stateFor(lang,q=e.normalize([raw])[0]){return{ownerId:null,lang,pid:'pmp-full',eid:'ch0',config:{},p:{ar:'باقة عربية',en:'English package'},c:{id:'pmp',code:'PMP',domains:[{k:'people',ar:'الأفراد',en:'People'}]},course:{id:'pmp',domains:[{k:'people',ar:'الأفراد',en:'People'}]},items:[q],idx:0,sectionStart:0,left:1200,started:null,answers:{},flags:new Set(),breaks:[],breakDone:new Set(),practice:false}}
for(const lang of ['ar','en']){
 nodes.clear();const state=stateFor(lang),q=state.items[0];e.setState(state);
 e.renderInstructions();selected(node('#ux').innerHTML,lang,'المحاكاة الكاملة','Full Mock Exam');selected(node('#ux').innerHTML,lang,'بدون كاميرا','Without camera');assert.equal(node('#ux').attrs.lang,lang);
 const start=node('#uxStartMock').onclick,before=timerStarts;await start();await start();assert.equal(timerStarts,before+1,'repeated Start must not start another timer');
 const html=node('#ux').innerHTML;selected(html,lang,'تحقق من الإجابة','Check Answer');selected(html,lang,'سياق الحالة بالعربية.','English scenario context.');assert(!html.includes('id="uxLang"'));
 assert.equal(e.referenceText(q),'','unqualified reference must not leak another language');
 state.practice=true;state.answers[q.id]=q.correctLetters[0];q.checked=true;e.render();selected(node('#ux').innerHTML,lang,'هذا هو التفسير العربي.','This is the English explanation.');
 e.showCalc();selected(bodyHtml,lang,'الآلة الحاسبة','Calculator');
 e.showAI(q);selected(bodyHtml,lang,'مساعد د. محمد عطية','Dr Mohamed Attia Coach');
 e.showBreak(1);selected(node('#ux').innerHTML,lang,'متابعة الاختبار','Resume exam');
 e.finish();selected(node('#ux').innerHTML,lang,'تقرير الاختبار التدريبي للشهادة','Certification Practice Exam Report');selected(node('#ux').innerHTML,lang,'الأفراد','People');assert.equal(progress.exams.ch0.score,100);assert.equal(progress.exams.ch0.passed,true);
 e.renderReview();selected(node('#uxReviewDetails').innerHTML,lang,'مراجعة الإجابات','Answer review');assert(!node('#uxReviewDetails').innerHTML.includes('uxReviewLang'));assert.equal(state.lang,lang);
 q['explanation_'+lang]='';e.renderReview();selected(node('#uxReviewDetails').innerHTML,lang,'لم يُنشر تفسير باللغة العربية لهذا السؤال بعد.','English explanation has not been published for this question.');
 const matching={id:'match',type:'matching',meta:{pairs:[[{a:'العنصر',e:'Item'},{a:'الهدف',e:'Target'}]]},correct_json:[0]};
 selected(e.answerHtml(matching,[],null),lang,'العنصر','Item');selected(e.correctDescription(matching),lang,'الهدف','Target');
 const perSide={...matching,meta:{pairs:[{left_ar:'يسار',left_en:'Left',right_ar:'يمين',right_en:'Right'}]}};selected(e.answerHtml(perSide,[],null),lang,'يسار','Left');
 const dropdown={id:'dd',type:'single',meta:{sourceV5:{t:'dd',o:[{a:'الأول',e:'First'},{a:'الثاني',e:'Second'}],c:1}}};selected(e.answerHtml(dropdown,[],null),lang,'اختر','Select');selected(e.correctDescription(dropdown),lang,'الثاني','Second');
 const hotspot={id:'pc',type:'hotspot',meta:{sourceV5:{t:'pc',ans:'r'},svgMarkup_ar:'<svg><text>شكل عربي</text></svg>',svgMarkup_en:'<svg><text>English diagram</text></svg>',regionLabels_ar:{r:'المنطقة'},regionLabels_en:{r:'Region'}}};selected(e.answerHtml(hotspot,[],'r'),lang,'شكل عربي','English diagram');selected(e.correctDescription(hotspot),lang,'المنطقة','Region');
 const field={type:'fill_blank',correct:'42'};selected(e.answerHtml(field,[],null),lang,'اكتب الإجابة','Enter your answer');assert.equal(e.correctDescription(field),'42');
 const ordered={type:'ordering',options_ar:['الأول','الثاني'],options_en:['First','Second'],correct_json:[1,0]};assert.equal(e.correctDescription(ordered),lang==='ar'?'الثاني → الأول':'Second → First');
 assert.equal(e.sourceLabel({a:'عربي'}),lang==='ar'?'عربي':'','missing selected label never falls back');
}
assert.equal(attempts,2,'one attempt write per finish');
assert(!source.includes('function showTranslation('));
assert(!source.includes("S.lang=ar()?'en':'ar'"));
console.log('PASS: chosen-only Arabic/English instructions, questions, tools, breaks, reports, reviews, nested interactive labels and missing-explanation notices; unchanged scoring; duplicate-start guard');

// Closing or replacing an attempt while camera permission is pending must not start it.
let resolveCamera,cameraCalls=0,stopped=0;
context.navigator.mediaDevices.getUserMedia=()=>{cameraCalls++;return new Promise(r=>resolveCamera=r)};
const cameraState=stateFor('en');e.setState(cameraState);e.renderInstructions();node('input[name=uxCameraMode]:checked').value='on';const start=node('#uxStartMock').onclick,before=timerStarts,pending=start();await start();assert.equal(cameraCalls,1);e.setState(null);resolveCamera({getTracks:()=>[{stop(){stopped++}}]});await pending;assert.equal(stopped,1);assert.equal(timerStarts,before);
console.log('PASS: pending camera start cannot be duplicated and closes its stream without starting an abandoned exam');
