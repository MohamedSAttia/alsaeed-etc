/** Local-only real player + canonical roadmap; fake Vimeo, no network or backend writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {JSDOM}=await import(process.env.JSDOM_MODULE||'jsdom');
const styles=['public/unified-exam.css','public/learning-v20.css'].map(file=>'<style>'+fs.readFileSync(file,'utf8')+'</style>').join('');
const dom=new JSDOM('<!doctype html><html dir="rtl"><head>'+styles+'</head><body><main id="lnBody"><button id="opener">Open lesson</button><section id="outline">Original course outline</section></main></body></html>',{url:'https://local.test/',runScripts:'outside-only',pretendToBeVisual:true});
const {window:w}=dom,errors=[],requests=[],toasts=[],players=[];
let owns=true,admin=false,saves=0;
const course={id:'pmp',chapters:['Original mixed chapter',{ar:'التخطيط المعتمد',en:'Approved planning',outlineKey:'planning'},'Unmapped saved chapter']};
const rmp={id:'rmp',chapters:['First','Second','Third']};
const pid='pmp-fixture';
const lessons=[
 {id:'stable-0',ch:0,t:'مقدمة',t_en:'Introduction',vimeo:'900000',dur:'01:00',free:true,files:[{id:'file-0',name:'Original intro.pdf'}],notes:'Original lesson notes',notes_en:'Original English lesson notes',quiz:[{q:'Existing question'}]},
 {id:'stable-1',ch:0,t:'إرشادات وتعليمات الاختبار الدولي',t_en:'International Exam Guidelines and Instructions',vimeo:'900001',dur:'02:00'},
 {id:'stable-2',ch:0,t:'النهج المختلط',t_en:'Hybrid Approach',vimeo:'900002',dur:'03:00'},
 {id:'stable-3',ch:0,t:'النهج الرشيق',t_en:'Agile Approach',vimeo:'900003',dur:'04:00',free:true},
 {id:'stable-4',ch:1,t:'عنوان مخصص لا يتضمن اسم المرحلة',t_en:'Custom title without phase wording',vimeo:'900004',dur:'05:00'},
 {id:'stable-5',ch:2,t:'المادة المحفوظة',t_en:'Saved resource',notes:'No video'},
 {id:'stable-6',ch:2,t:'فيديو أصلي غير مصنف',t_en:'Unmapped original video',vimeo:'900006',dur:'07:00',free:true},
 {id:'stable-7',ch:0,t:'<img src=x onerror=bad()> المقدمة الثانية',t_en:'Introduction <script>bad()</script>',vimeo:'900007',dur:'08:00',free:true}
];
const progress={lessons:{0:true,4:true},weeks:{1:true},exams:{chapter_scope:{score:80}},activities:{2:true}};
const original=JSON.stringify({course,lessons}),originalProgress=JSON.stringify(progress);
w.addEventListener('error',event=>errors.push(event.message));
w.fetch=async()=>{throw Error('Network is forbidden in the player test');};
w.APP={pack:id=>({id,course:id==='rmp-fixture'?'rmp':'pmp'}),course:id=>id==='rmp'?rmp:course,owns:()=>owns,isAdmin:()=>admin,prog:()=>progress,save:()=>{saves++;},toast:message=>toasts.push(message),api:async(route,options)=>{requests.push({route,options});return{items:[],canReply:false};}};
w.LESSONS={[pid]:lessons,'rmp-fixture':[{ch:2,t:'Third',vimeo:'910002',dur:'01:00'},{ch:0,t:'First',vimeo:'910000',dur:'01:00'},{ch:1,t:'Second',vimeo:'910001',dur:'01:00'}]};
w.I18={lang:'ar'};w.biTitle=lesson=>w.I18.lang==='en'?(lesson.t_en||lesson.t):(lesson.t||lesson.t_en);
w.Vimeo={Player:class{constructor(frame){this.frame=frame;this.handlers={};this.paused=false;players.push(this);}getDuration(){return Promise.resolve(90);}on(name,handler){this.handlers[name]=handler;}destroy(){this.destroyed=true;return Promise.resolve();}getPaused(){return Promise.resolve(this.paused);}pause(){this.paused=true;return Promise.resolve();}play(){this.paused=false;return Promise.resolve();}}};
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
const click=selector=>{const el=w.document.querySelector(selector);assert.ok(el,selector);el.click();return el;};
const current=()=>Number(w.document.querySelector('.iv-li.cur')?.dataset.go);
const rows=()=>Array.from(w.document.querySelectorAll('#iv [data-go]'));
const order=()=>rows().map(row=>Number(row.dataset.go));
const frame=()=>w.document.getElementById('ivFrame');
const activePlayer=()=>players.at(-1);
const canonical=()=>Array.from(w.CourseRoadmap.videoOrder(course,lessons));
try{
 for(const file of ['public/course-roadmap.js','public/v17-interactive.js'])w.eval(fs.readFileSync(file,'utf8'));
 const expected=canonical();assert.notDeepEqual(expected,[0,1,2,3,4,6,7],'Fixture exposes original-order mismatch');
 for(const lang of ['ar','en']){
  w.I18.lang=lang;w.document.documentElement.dir=lang==='ar'?'rtl':'ltr';
  const opener=w.document.getElementById('opener');opener.focus();w.InteractiveVideo.open(pid,0);await settle();
  assert.equal(w.document.activeElement.id,'ivTitle');
  assert.deepEqual(order(),expected,'All video rows use the canonical hierarchy');
  assert.equal(new Set(order()).size,lessons.filter(lesson=>lesson.vimeo).length);
  assert.deepEqual(rows().map(row=>Number(row.querySelector('.n').textContent)),expected.map((_,i)=>i+1));
  assert.equal(w.document.querySelector('[data-go="5"]'),null,'Text-only material is not a numbered video');
  assert.equal(w.document.querySelectorAll('#iv img[onerror],#iv script').length,0,'Titles escaped');
  assert.equal(w.document.querySelector('.iv-action-menu').children.length,3,'Three clear lesson actions');
  assert.equal(w.document.querySelector('.iv-bar .official-learning-logo').getAttribute('src'),'/img/logo.png');
  assert.equal(w.document.querySelector('#ivWatch b').textContent,lang==='en'?'Watch video':'مشاهدة الفيديو');
  activePlayer().paused=true;click('#ivWatch');await settle();assert.equal(activePlayer().paused,false,'Watch action resumes the existing player');
  assert.equal(JSON.stringify(progress),originalProgress,'Watch action does not mark completion');
  assert.ok(w.document.querySelector('[data-iv-file="file-0"]'));
  assert.ok(w.document.querySelector('#ivLessonQuiz'));
  assert.ok(w.document.querySelector('.iv-notes'));
  assert.ok(w.document.querySelector('#ivAsk'));
  assert.ok(frame().title);
  assert.equal(w.document.querySelector('[data-go="0"] .d').textContent,'1:30','Vimeo duration updates the matching original-index row');
  assert.ok(w.document.querySelector('[data-go="0"] .iv-watched'));
  assert.equal(w.getComputedStyle(w.document.querySelector('.iv-inline .iv-stage')).alignSelf,'start');
  assert.equal(w.getComputedStyle(w.document.querySelector('.iv-player')).aspectRatio,'16/9');
  assert.notEqual(w.getComputedStyle(w.document.querySelector('.iv-list')).maxHeight,'none');
  click('[data-go="4"]');await settle();
  assert.match(w.document.querySelector('.iv-group-path').textContent,lang==='en'?/Predictive Approach \/ Approved planning/:/النهج التنبؤي \/ التخطيط المعتمد/);
  assert.equal(w.document.activeElement.dataset.go,'4','Selecting a row keeps focus inside the player');
  assert.ok(w.document.querySelector('[data-iv-group="planning"]').open);
  assert.ok(w.document.querySelector('[data-iv-group="predictive"]').open);
  click('[data-go="0"]');await settle();
  for(let i=0;i<expected.length;i++){
   assert.equal(current(),expected[i]);assert.match(frame().src,new RegExp('/'+lessons[expected[i]].vimeo+'\\?'));
   assert.equal(w.document.querySelector('#ivNext').disabled,i===expected.length-1);
   if(i<expected.length-1)click('#ivNext');
  }
  const last=frame().src;click('#ivNext');assert.equal(frame().src,last);
  assert.equal(w.document.activeElement.id,'ivTitle','Disabled final Next falls back to the player title for focus');
  click('#ivClose');assert.equal(frame(),null);assert.equal(w.document.activeElement.id,'opener');
  assert.equal(w.document.getElementById('outline').style.display,'');
  assert.equal(JSON.stringify(progress),originalProgress,'Manual playback does not mark videos watched');
 }
 w.I18.lang='en';lessons[0].notes_en='';w.InteractiveVideo.open(pid,0);await settle();
 assert.equal(w.document.querySelector('.iv-notes'),null,'Arabic-only summary is not substituted into English mode');
 assert.match(w.document.querySelector('.iv-action-menu').textContent,/No summary in this language yet/);
 w.InteractiveVideo.close();lessons[0].notes_en='Original English lesson notes';
 w.InteractiveVideo.open(pid,3);await settle();
 const stalePlayer=activePlayer();click('#ivNext');await settle();click('[data-go="3"]');await settle();
 const staleFrame=frame(),staleSaves=saves;stalePlayer.handlers.ended();assert.equal(frame(),staleFrame);assert.equal(saves,staleSaves,'A destroyed Vimeo instance cannot complete or advance a revisited video');
 const pause=click('#ivPause');await settle();assert.equal(activePlayer().paused,true);pause.click();await settle();assert.equal(activePlayer().paused,false);
 const auto=w.document.getElementById('ivAutoNext');auto.checked=false;auto.dispatchEvent(new w.Event('change'));const sameFrame=frame();activePlayer().handlers.ended();
 assert.equal(progress.lessons[3],true);assert.equal(current(),3);assert.equal(frame(),sameFrame,'Watched status does not reset playback');assert.ok(w.document.querySelector('[data-go="3"] .iv-watched'));delete progress.lessons[3];
 auto.checked=true;auto.dispatchEvent(new w.Event('change'));activePlayer().handlers.ended();await settle();assert.equal(current(),expected[expected.indexOf(3)+1],'Autoplay follows the displayed list');delete progress.lessons[3];
 w.InteractiveVideo.close();assert.equal(JSON.stringify(progress),originalProgress);
 // Newly authored lessons and chapter label edits are read from current state.
 lessons.push({id:'stable-new',ch:1,t:'درس جديد',t_en:'New saved video',vimeo:'900008',dur:'01:00'});
 course.chapters[1].ar='مرحلة التخطيط الجديدة';course.chapters[1].en='Renamed planning';
 w.InteractiveVideo.open(pid,8);await settle();assert.ok(order().includes(8));assert.match(w.document.querySelector('.iv-group-path').textContent,/Renamed planning/);assert.equal(order().length,8);w.InteractiveVideo.close();lessons.pop();course.chapters[1].ar='التخطيط المعتمد';course.chapters[1].en='Approved planning';
 // A stale paid row cannot open after access expires, even via direct open.
 w.InteractiveVideo.open(pid,0);await settle();owns=false;const beforeStale=frame().src;click('[data-go="4"]');assert.equal(frame().src,beforeStale);w.InteractiveVideo.open(pid,4);assert.equal(frame().src,beforeStale);
 click('#ivNext');await settle();const freeOrder=canonical().filter(index=>lessons[index].free);assert.equal(current(),freeOrder[1]);assert.deepEqual(order(),freeOrder);assert.deepEqual(rows().map(row=>+row.querySelector('.n').textContent),freeOrder.map((_,i)=>i+1));
 w.InteractiveVideo.open(pid,0);await settle();activePlayer().handlers.ended();await settle();assert.equal(current(),freeOrder[1]);
 w.InteractiveVideo.open(pid,freeOrder.at(-1));await settle();assert.ok(w.document.querySelector('#ivNext').disabled);const freeLast=frame();activePlayer().handlers.ended();assert.equal(frame(),freeLast);delete progress.lessons[freeOrder.at(-1)];w.InteractiveVideo.close();
 w.InteractiveVideo.open(pid,4);assert.equal(frame(),null,'Direct locked opens are rejected');
 owns=true;w.InteractiveVideo.open(pid,4);await settle();owns=false;const priorSaves=saves;activePlayer().handlers.ended();assert.equal(saves,priorSaves,'Expired access cannot write completion or autoplay');w.InteractiveVideo.close();
 admin=true;w.InteractiveVideo.open(pid,4);await settle();assert.equal(current(),4,'Admin retains existing entitlement');w.InteractiveVideo.close();admin=false;owns=true;
 w.InteractiveVideo.open('rmp-fixture',1);await settle();assert.deepEqual(order(),[1,2,0]);click('#ivNext');await settle();assert.equal(current(),2);activePlayer().handlers.ended();await settle();assert.equal(current(),0);assert.ok(w.document.querySelector('#ivNext').disabled);delete progress.lessons[2];w.InteractiveVideo.close();
 assert.equal(JSON.stringify(progress),originalProgress);
 assert.equal(JSON.stringify({course,lessons}),original,'Stored lesson ids, indices, chapters, media, files, notes and quizzes unchanged');
 assert.ok(requests.every(request=>!request.options?.method||request.options.method==='GET'),'No write API calls');
 assert.deepEqual(errors,[]);
 console.log('PASS: canonical AR/EN playlist, original indices, contiguous video numbering, dynamic authoring, nested current path, Next/autoplay, watched/duration, files/notes/discussion/quiz, focus/close, guest/admin/stale gates, non-PMP, 16:9/top-aligned CSS, no network or write API calls.');
}finally{w.close();}
