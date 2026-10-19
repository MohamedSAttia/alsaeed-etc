/** Real application scripts and bindings, local in-memory learner fixture, no backend. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const {JSDOM}=await import(process.env.JSDOM_MODULE||'jsdom');
const dom=new JSDOM(fs.readFileSync('public/index.html','utf8'),{url:'https://local.test/',runScripts:'outside-only',pretendToBeVisual:true});
const {window:w}=dom,errors=[],writes=[];
w.addEventListener('error',e=>errors.push(e.message));
w.fetch=async(url,options={})=>{if(options.method&&!['GET','HEAD'].includes(options.method))writes.push(String(url));return {ok:false,status:503,json:async()=>({})};};
w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
w.HTMLElement.prototype.scrollIntoView=function(){};
w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
const settle=()=>new Promise(r=>setTimeout(r,80));
try{
 for(const script of w.document.scripts){if(script.type&&script.type!=='text/javascript')continue;const src=script.getAttribute('src');if(src){if(!src.startsWith('/'))continue;w.eval(fs.readFileSync(path.join('public',new URL(src,w.location.href).pathname),'utf8'));}else if(script.textContent.trim())w.eval(script.textContent);}
 await settle();
 const A=w.APP,pid='pmp-full',c=A.course('pmp');
 A.DB.users.push({id:'outline-fixture',name:'Local learner',role:'student',packages:[{id:pid},{id:'pmp-sim'}]});A.DB.session='outline-fixture';
 c.chapters=['Introduction','Planning','Executing','Shared chapter'];
 w.LESSONS[pid]=[
  {id:'original-0',ch:0,t:'مقدمة',t_en:'Introduction',vimeo:'100000',free:true},
  {id:'original-1',ch:1,t:'مرحلة التخطيط: النطاق',t_en:'Planning phase: scope',vimeo:'101000'},
  {id:'original-2',ch:2,t:'مرحلة التنفيذ: الموارد',t_en:'Executing phase: resources',vimeo:'102000'},
  {id:'original-3',ch:3,t:'النهج الرشيق',t_en:'Agile Approach',vimeo:'103000'},
  {id:'original-4',ch:3,t:'النهج المختلط',t_en:'Hybrid Approach',vimeo:'104000'},
  {id:'original-5',ch:3,t:'إرشادات وتعليمات الاختبار الحقيقي',t_en:'Actual Exam Guidelines and Instructions',vimeo:'105000'},
  {id:'original-6',ch:3,t:'إدارة المخاطر',t_en:'Risk management',vimeo:'106000'},
  {id:'original-7',ch:3,t:'درس غير مصنف',t_en:'Unmapped lesson',vimeo:'107000'}
 ];
 const progress=A.prog(pid);Object.assign(progress,{lessons:{0:true,2:true},weeks:{1:true},exams:{chapter_scope:{score:80}},activities:{0:true}});
 for(const lesson of w.LESSONS[pid])lesson.dur='01:00';
 const before=JSON.stringify(progress),lessonsBefore=JSON.stringify(w.LESSONS[pid]);
 let activePlayer;w.Vimeo={Player:class{constructor(){this.handlers={};activePlayer=this;}getDuration(){return Promise.resolve(60);}on(event,fn){this.handlers[event]=fn;}destroy(){return Promise.resolve();}}};
 let completion;w.LessonVideo.attach=(frame,onComplete)=>{completion=onComplete};
 const click=selector=>{const target=w.document.querySelector(selector);assert.ok(target,selector);target.click();};
 const frame=()=>w.document.getElementById('ivFrame');
 for(const lang of ['ar','en']){
  w.__lang=lang;w.I18.set(lang);w.localStorage.setItem('learning-language:'+pid,lang);A.go('learn/'+pid);await settle();
  click('[data-lt="content"]');await settle();
  assert.equal(w.document.querySelectorAll('[data-lesson-index]').length,8);
  assert.deepEqual(Array.from(w.document.querySelectorAll('[data-lesson-index]'),x=>Number(x.dataset.lessonIndex)),Array.from(w.CourseRoadmap.videoOrder(c,w.LESSONS[pid])));
  assert.equal(A.pct(pid),25);
  assert.equal(w.document.querySelectorAll('.pmp-topic-reading').length,18);
  assert.deepEqual(Array.from(w.document.querySelectorAll('.learning-outline > details'),x=>x.dataset.learningGroup),['intro','framework','agile','predictive','hybrid','people','process','business','value','principles','lifecycles','ai','final-reviews','workshops','exam-eve','exam-guidelines']);
  assert.deepEqual(Array.from(w.document.querySelectorAll('[data-learning-group="intro"] > .learning-outline-children > [data-learning-group]'),x=>x.dataset.learningGroup),['exam','journey']);
  assert.equal(w.document.querySelectorAll('[data-learning-group="intro"] > .learning-outline-children > [data-learning-group="exam"] > .pmp-topic-reading').length,1);
  const summaries=w.document.querySelector('[data-learning-group="summaries"]');
  summaries.parentElement.closest('details').open=true;summaries.open=true;
  assert.ok(summaries.querySelector('[data-summary-topic="scope"] [data-learning-chapter="scope"]'));
  assert.equal(w.document.querySelector('[data-learning-group="shared-resources"]'),null);
  assert.deepEqual(Array.from(w.document.querySelectorAll('.learning-outline > details'),x=>x.dataset.learningGroup).slice(-4),['final-reviews','workshops','exam-eve','exam-guidelines']);
  click('[data-lesson="0"]');assert.match(frame().src,/video\/100000/);click('#ivNext');assert.match(frame().src,/video\/103000/,'Next follows the outline, preserving original index 3');
  w.InteractiveVideo.close();assert.equal(frame(),null);
  assert.equal(JSON.stringify(progress),before,'Playback/navigation never changes completions');
  click('[data-lesson="2"]');assert.match(frame().src,/video\/102000/);w.InteractiveVideo.close();
  const playbackOrder=Array.from(w.CourseRoadmap.videoOrder(c,w.LESSONS[pid]));
  assert.deepEqual(playbackOrder,[0,3,1,2,4,6,7,5],'Original source videos stay before the final instructions');
  click('[data-lesson="'+playbackOrder[0]+'"]');
  for(let n=0;n<playbackOrder.length;n++){
   assert.match(frame().src,new RegExp('video/'+w.LESSONS[pid][playbackOrder[n]].vimeo));
   if(n<playbackOrder.length-1)click('#ivNext');else{const last=frame().src;click('#ivNext');assert.equal(frame().src,last,'Next on the final guidelines cannot jump to hidden additional lessons');}
  }
  w.InteractiveVideo.close();assert.equal(JSON.stringify(progress),before);
  click('[data-lt="plan"]');await settle();
  assert.equal(w.document.querySelectorAll('[data-plan-topic]').length,16);
  assert.deepEqual(Array.from(w.document.querySelectorAll('[data-plan-topic]'),x=>x.dataset.planTopic),['intro','framework','agile','predictive','hybrid','people','process','business','value','principles','lifecycles','ai','final-reviews','workshops','exam-eve','exam-guidelines']);
  assert.ok(w.document.querySelector('.wk.done [data-week="1"]'));
 }
 // The callback uses the same ordering and writes only the original lesson index.
 click('[data-lt="content"]');await settle();click('[data-lesson="3"]');await settle();activePlayer.handlers.ended();
 assert.equal(progress.lessons[3],true);assert.match(frame().src,/video\/101000/,'Autoplay moves from Agile to the first predictive phase');w.InteractiveVideo.close();
 assert.deepEqual(Object.keys(progress.lessons).sort(),['0','2','3']);delete progress.lessons[3];
 assert.equal(JSON.stringify(progress),before);
 assert.equal(JSON.stringify(w.LESSONS[pid]),lessonsBefore);
 const interactive=w.InteractiveVideo;w.InteractiveVideo=null;
 click('[data-lesson="0"]');assert.match(w.document.getElementById('nativeLessonFrame').src,/video\/100000/);click('#lsNext');assert.match(w.document.getElementById('nativeLessonFrame').src,/video\/103000/);A.closeModal();
 click('[data-lesson="3"]');completion();assert.equal(progress.lessons[3],true);assert.match(w.document.getElementById('nativeLessonFrame').src,/video\/101000/);A.closeModal();delete progress.lessons[3];w.InteractiveVideo=interactive;
 assert.equal(JSON.stringify(progress),before);
 A.pack('pmp-sim').kinds=['exam','quiz'];A.go('learn/pmp-sim');await settle();click('[data-lt="plan"]');await settle();
 assert.equal(w.document.querySelector('.learner-course-outline [data-lt="content"]'),null);
 A.me().packages.push({id:'rmp-full'});
 w.LESSONS['rmp-full']=[{ch:2,t:'RMP third',vimeo:'203000',dur:'01:00'},{ch:0,t:'RMP first',vimeo:'201000',dur:'01:00'},{ch:1,t:'RMP second',vimeo:'202000',dur:'01:00'}];
 w.InteractiveVideo.open('rmp-full',1);click('#ivNext');assert.match(frame().src,/video\/202000/,'Non-PMP saved chapter playback order is unchanged');w.InteractiveVideo.close();
 // Guest fallback must neither open a stale locked row nor traverse into it.
 w.LESSONS[pid]=[
  {ch:0,t:'مقدمة مجانية أولى',vimeo:'300001',free:true},
  {ch:0,t:'مقدمة خاصة',vimeo:'300002',free:false},
  {ch:0,t:'مقدمة مجانية ثانية',vimeo:'300003',free:true}
 ];
 A.go('learn/'+pid);await settle();click('[data-lt="content"]');await settle();
 w.InteractiveVideo=null;A.DB.session=null;
 click('[data-lesson="1"]');assert.equal(w.document.getElementById('nativeLessonFrame'),null,'Locked stale row is rejected');
 click('[data-lesson="0"]');click('#lsNext');assert.match(w.document.getElementById('nativeLessonFrame').src,/video\/300003/,'Guest Next skips the locked original index');assert.equal(w.document.getElementById('lsNext'),null);A.closeModal();
 click('[data-lesson="0"]');completion();assert.match(w.document.getElementById('nativeLessonFrame').src,/video\/300003/,'Guest autoplay skips the locked original index');A.closeModal();w.InteractiveVideo=interactive;
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[],'No backend mutation');
 console.log('PASS: real SPA AR/EN rendering, exact original-index video open/Next/autoplay, unchanged existing progress, stable plan keys, quiz-only navigation, guest fallback gating, no backend writes or JS errors.');
}finally{w.close();}

