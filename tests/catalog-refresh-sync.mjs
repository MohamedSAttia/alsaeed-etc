/** Local-only refresh and race regressions using the actual SPA scripts and mocked API.
 * No production accounts, endpoints or stored learner records are used. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const {JSDOM}=await import(process.env.JSDOM_MODULE||'/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const pause=()=>new Promise(r=>setTimeout(r,25));
async function until(check,message){for(let i=0;i<100;i++){if(check())return;await pause();}assert.fail(message);}
const html=fs.readFileSync('public/index.html','utf8');
async function fixture(role='student'){
 const dom=new JSDOM(html,{url:'https://refresh.local/#learn/pmp-full',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window, errors=[],calls=[],held=new Map(),user={id:'refresh-'+role,name:'Local '+role,email:role+'@local.test',role};
 let content,clock=Date.now(),version=1;
 const lessons=[{chapter:0,title:'Published first lesson',title_en:'Published first lesson',duration:'01:00',vimeo:'100001',free:true,files:[],quiz:[]}];
 const progress={lessons:{0:true},weeks:{1:true},exams:{saved:{score:88}},activities:{},games:{},updatedAt:1};
 w.Date.now=()=>clock;
 w.localStorage.setItem('alsaeed_token','local-'+role);
 w.sessionStorage.setItem('alsaeed_auth_prompt_v1','1');
 w.addEventListener('error',e=>errors.push(e.message));
 w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
 const response=(body,ok=true)=>({ok,status:ok?200:404,json:async()=>clone(body)});
 w.fetch=async(url,options={})=>{
  const pathname=new URL(String(url),w.location.href).pathname,method=options.method||'GET';
  calls.push({path:pathname,method,options});
  const holder=held.get(method+' '+pathname);if(holder){held.delete(method+' '+pathname);holder.started=true;await new Promise(resolve=>holder.release=resolve);}
  if(pathname==='/api/health')return response({ok:true});
  if(pathname==='/api/me')return response({user,packages:[{package_id:'pmp-full',created:1}]});
  if(pathname==='/api/admin/users')return response([{...user,packages:[{package_id:'pmp-full',created:1}]}]);
  if(pathname==='/api/admin/orders')return response([]);
  if(pathname==='/api/admin/overview')return response({serverNow:version,stats:{},students:[],recentOrders:[]});
  if(pathname==='/api/admin/settings')return response({ok:true});
  if(pathname==='/api/content'){
   content ||= {cms:{heroTitle:'Published hero 1'},courses:clone(w.COURSES),packages:clone(w.PACKAGES),instructors:[],defaultInstructorId:null};
   return response(content);
  }
  if(pathname==='/api/catalog-availability')return response({'pmp-full':{videos:lessons.length,videoMins:lessons.length,questions:0}});
  if(pathname==='/api/lessons/pmp-full'||pathname==='/api/admin/lessons/pmp-full'){
   if(method==='PUT')lessons.splice(0,lessons.length,...JSON.parse(options.body).map(l=>({chapter:l.ch,title:l.t,title_en:l.t_en,duration:l.dur,vimeo:l.vimeo,free:l.free,files:l.files,quiz:l.quiz,notes:l.notes,notes_en:l.notes_en})));
   return response(lessons);
  }
  if(pathname.startsWith('/api/admin/lessons/'))return response([]);
  if(pathname==='/api/admin/course-chapters/pmp'&&method==='PUT'){
   content.courses.find(c=>c.id==='pmp').chapters=clone(JSON.parse(options.body).chapters);return response({ok:true});
  }
  if(pathname.startsWith('/api/progress/'))return response(progress);
  return response({},false);
 };
 for(const script of w.document.scripts){if(script.type&&script.type!=='text/javascript')continue;const src=script.getAttribute('src');if(src){if(!src.startsWith('/'))continue;w.eval(fs.readFileSync(path.join('public',new URL(src,w.location.href).pathname),'utf8'));}else if(script.textContent.trim())w.eval(script.textContent);}
 await until(()=>w.APP?.live&&w.LESSONS['pmp-full']?.length,'SPA boot did not load fixture lessons');await pause();
 return {w,dom,calls,errors,lessons,progress,get content(){return content;},tick(){clock+=16000;version++;},hold(method,url){const state={started:false};held.set(method+' '+url,state);return state;}};
}
const s=await fixture();
try{
 const {w,calls,lessons}=s,A=w.APP;
 const progressBefore=JSON.stringify(A.prog('pmp-full'));
 assert.equal(w.LESSONS['pmp-full'].length,1);
 s.content.courses.find(c=>c.id==='pmp').chapters.push({ar:'محور منشور جديد',en:'New published topic'});
 lessons.push({chapter:0,title:'Appended published lesson',title_en:'Appended published lesson',duration:'02:00',vimeo:'100002',free:false,files:[],quiz:[]});
 A.go('home');await pause();A.go('learn/pmp-full');
 await until(()=>w.LESSONS['pmp-full']?.length===2,'Navigation did not revalidate cached lessons');
 assert.equal(A.course('pmp').chapters.at(-1).en,'New published topic');
 assert.equal(JSON.stringify(A.prog('pmp-full')),progressBefore,'Refresh keeps saved original-index progress unchanged');
 assert.equal(w.LESSONS['pmp-full'][0].t,'Published first lesson','No lesson reorder');
 A.go('home');await pause();s.content.cms.heroTitle='Published hero 2';s.content.instructors=[{id:'new-instructor',nameEn:'Published instructor',active:true}];
 s.tick();w.dispatchEvent(new w.Event('focus'));
 await until(()=>w.CMS.heroTitle==='Published hero 2','Focus did not refresh home CMS');
 assert.equal(w.INSTRUCTORS[0].id,'new-instructor');
 const fetched=calls.filter(c=>c.path==='/api/content').length;
 w.dispatchEvent(new w.Event('focus'));w.document.dispatchEvent(new w.Event('visibilitychange'));A.render();A.render();await pause();
 assert.equal(calls.filter(c=>c.path==='/api/content').length,fetched,'No focus burst or render fetch loop');
 A.modal('<input id="draft" value="Unsaved modal">');s.content.cms.heroTitle='Published hero 3';s.tick();
 await A.refreshPublishedContent(true);assert.equal(w.CMS.heroTitle,'Published hero 2');assert.equal(w.document.getElementById('draft').value,'Unsaved modal');
 A.closeModal();await A.refreshPublishedContent(true);assert.equal(w.CMS.heroTitle,'Published hero 3');
 const exam=w.document.createElement('section');exam.id='ux';exam.innerHTML='<input id="local-answer" value="Answer in progress">';w.document.getElementById('app').append(exam);
 s.content.cms.heroTitle='Update during exam';const examCalls=calls.length;
 await A.refreshPublishedContent(true);assert.equal(calls.length,examCalls);assert.equal(w.document.getElementById('local-answer').value,'Answer in progress');exam.remove();
 // Fallback player numbering follows visible playable order, not stored indices with gaps.
 w.LESSONS['pmp-full']=[
  {ch:0,t:'Introduction',t_en:'Introduction',vimeo:'100001',free:true},
  {ch:0,t:'Reading only',vimeo:''},{ch:0,t:'Another reading',vimeo:''},
  {ch:0,t:'Agile Approach',t_en:'Agile Approach',vimeo:'100004',free:false},
  {ch:0,t:'Supplemental reading',vimeo:''},
  {ch:0,t:'Actual Exam Guidelines and Instructions',t_en:'Actual Exam Guidelines and Instructions',vimeo:'100006',free:false}
 ];
 A.replaceRoute('learn/pmp-full');w.__lang='en';w.I18.set('en');A.render();
 w.document.querySelector('[data-lt="content"]').click();w.InteractiveVideo=null;w.LessonVideo.attach=()=>{};
 w.document.querySelector('[data-lesson="0"]').click();
 assert.match(w.document.getElementById('ov').textContent,/Lesson 1 \/ 3/);
 w.document.getElementById('lsNext').click();
 assert.match(w.document.getElementById('ov').textContent,/Lesson 2 \/ 3/);
 assert.match(w.document.getElementById('nativeLessonFrame').src,/video\/100004/);
 assert.equal(JSON.stringify(A.prog('pmp-full')),progressBefore);A.closeModal();
 // A pending authenticated response must not restore private rows after logout.
 A.go('learn/pmp-full');await pause();const held=s.hold('GET','/api/lessons/pmp-full');
 const pending=A.refreshPublishedContent(true);await until(()=>held.started,'Protected refresh did not start');
 w.document.getElementById('logout').onclick();held.release();await pending;await pause();
 assert.equal(A.token,null);assert.equal(A.me(),null);assert.equal(Object.hasOwn(w.LESSONS,'pmp-full'),false);
 assert.equal(calls.some(c=>c.path.startsWith('/api/admin/')),false,'Learner never requests administrator content');
 assert(calls.filter(c=>['/api/content','/api/lessons/pmp-full','/api/catalog-availability'].includes(c.path)).every(c=>c.options.cache==='no-store'));
 assert.deepEqual(s.errors,[]);
}finally{s.dom.window.close();}
const a=await fixture('admin');
try{
 const {w,calls}=a,A=w.APP;
 A.go('home');await pause();
 // Isolate movement invariants with an already-explicit chapter; retired strings are covered separately below.
 A.course('pmp').chapters[0]={ar:'عنوان صريح أصلي',en:'Explicit original source',outlineKey:'framework'};
 await A.api('/admin/course-chapters/pmp',{method:'PUT',body:{chapters:A.course('pmp').chapters}});
 const original=A.course('pmp').chapters.length;
 A.course('pmp').chapters.push({ar:'مسودة غير محفوظة',en:'Unsaved draft'});
 a.content.cms.heroTitle='External update';a.tick();
 const before=calls.length;await A.refreshPublishedContent(true);
 assert.equal(calls.length,before,'In-memory administrator drafts block automatic refresh');assert.equal(A.course('pmp').chapters.length,original+1);
 await A.api('/admin/course-chapters/pmp',{method:'PUT',body:{chapters:A.course('pmp').chapters}});
 await A.refreshPublishedContent(true);assert.equal(w.CMS.heroTitle,'External update','Successful exact save releases the draft guard');
 A.go('admin/content/pmp-full');await until(()=>w.document.getElementById('admPk'),'Deep-linked editor did not open');
 assert.equal(w.document.getElementById('admPk').value,'pmp-full');
 assert.equal(w.document.querySelector('[data-at="content"]').classList.contains('on'),true);
 w.document.querySelector('[data-at="cms"]').click();assert(w.document.querySelector('[data-cms]'),'Deep link must not force the tab after normal tab navigation');
 A.go('admin/content/unknown-package');assert.equal(w.__vidPk,'pmp-full');
 assert.equal(calls.some(c=>c.path.includes('/lessons/unknown-package')),false);
 A.go('admin/content');assert.equal(w.document.getElementById('admPk').value,'pmp-full');
 const chapterIndex=A.course('pmp').chapters.length-1,ref='chapter:'+chapterIndex;
 const orderBefore=Array.from(w.CourseRoadmap.topics(A.course('pmp')),x=>x.key);
 const lessonBefore=JSON.stringify(w.LESSONS['pmp-full']);
 const move=w.document.querySelector('[data-chup="'+ref+'"]');assert(move,'Custom saved chapters expose movement controls');
 assert.equal(await move.onclick(),true);
 const orderAfter=Array.from(w.CourseRoadmap.topics(A.course('pmp')),x=>x.key);
 assert.equal(orderAfter.indexOf('source_'+chapterIndex),orderBefore.indexOf('source_'+chapterIndex)-1);
 assert.equal(JSON.stringify(w.LESSONS['pmp-full']),lessonBefore,'Custom movement never changes explicit chapters, lesson indices, media or metadata');
 // An unrelated initial lesson request may cache its result, but cannot rerender a newer editor draft.
 const late=a.hold('GET','/api/admin/lessons/grcp-full');const lateRequest=A.loadAdminLessons('grcp-full');
 await until(()=>late.started,'Deferred secondary lesson load did not start');
 const draft=w.document.querySelector('[data-lt="0"]');draft.value='Unsaved DOM draft';draft.dispatchEvent(new w.Event('input',{bubbles:true}));
 late.release();await lateRequest;assert.equal(w.document.querySelector('[data-lt="0"]').value,'Unsaved DOM draft');
 // The movement caller must also preserve raw input typed while its save is running.
 const moving=a.hold('PUT','/api/admin/lessons/pmp-full');
 const movingRequest=w.document.querySelector('[data-chdown="outline:framework"]').onclick();
 await until(()=>moving.started,'Deferred chapter movement save did not start');
 const movingDraft=w.document.querySelector('[data-lt="0"]');movingDraft.value='New draft during movement';movingDraft.dispatchEvent(new w.Event('input',{bubbles:true}));
 moving.release();await movingRequest;assert.equal(w.document.querySelector('[data-lt="0"]').value,'New draft during movement');
 assert.equal(w.document.querySelector('[data-chdown="outline:framework"]').disabled,false);
 A.go('admin');a.tick();const editor=w.document.querySelector('#app');const editorBefore=editor.innerHTML;
 await A.refreshPublishedContent(true);assert.equal(editor.innerHTML,editorBefore,'No background replacement of an active editor');
 A.go('home');await pause();const held=a.hold('GET','/api/content');const pending=A.refreshPublishedContent(true);
 await until(()=>held.started,'Content refresh did not start');
 const chapters=A.course('pmp').chapters.concat({ar:'تعديل أحدث',en:'Newer saved edit'});
 await A.api('/admin/course-chapters/pmp',{method:'PUT',body:{chapters}});A.course('pmp').chapters=chapters;
 a.content.cms.heroTitle='Must wait for next clean read';held.release();await pending;
 assert.equal(w.CMS.heroTitle,'External update','Response started before a write is discarded');
 await A.refreshPublishedContent(true);assert.equal(w.CMS.heroTitle,'Must wait for next clean read');
 // Trainer view revalidates the existing administrator-only overview endpoint.
 A.go('trainer');await until(()=>A.adminOverview.serverNow>1,'Trainer overview did not revalidate');
 assert.equal(calls.some(c=>c.path==='/api/admin/overview'&&c.options.cache==='no-store'),true);
 assert.deepEqual(a.errors,[]);
}finally{a.dom.window.close();}
const r=await fixture('admin');
try{
 const {w}=r,A=w.APP,c=A.course('pmp'),retired='أسس إدارة المشاريع وبيئتها';
 c.chapters=[retired,'Planning',{ar:'عنوان صريح',en:'Explicit title',outlineKey:'ai',sourceMetadata:'keep'}];
 w.LESSONS['pmp-full']=[
  {ch:0,t:'شهادات PMI',t_en:'PMI Certifications',vimeo:'700001',dur:'01:00',free:true,notes:'Original notes',notes_en:'English notes',files:[{id:'local-file'}],quiz:[{q:'Original question'}]},
  {ch:1,t:'Planning phase: scope',t_en:'Planning phase: scope',vimeo:'700002',dur:'02:00',free:false,files:[],quiz:[]},
  {ch:2,t:'AI lesson',t_en:'AI lesson',vimeo:'700003',dur:'03:00',free:false,files:[],quiz:[]}
 ];
 const progressBefore=JSON.stringify(A.prog('pmp-full')),slotsBefore=JSON.stringify(c.chapters),originalMetadata=clone(w.LESSONS['pmp-full'][0]);
 A.go('admin/content/pmp-full');
 assert.equal(w.document.querySelector('[data-lt="0"]').closest('[data-chapter-ref]').dataset.chapterRef,'outline:intro');
 w.document.querySelector('[data-lt="0"]').value='Completely unrelated renamed title';
 await w.document.getElementById('admSaveVid').onclick();
 assert.equal(JSON.stringify(c.chapters.slice(0,3)),slotsBefore,'Retired strings and other original chapter slots stay untouched');
 const explicit=w.LESSONS['pmp-full'][0].ch;assert.equal(c.chapters[explicit].outlineKey,'intro');
 const expected={...originalMetadata,ch:explicit,t:'Completely unrelated renamed title'};
 assert.deepEqual(clone(w.LESSONS['pmp-full'][0]),expected,'Only requested title and presentation chapter association change');
 assert.equal(w.LESSONS['pmp-full'][1].ch,1,'Other string chapter associations remain intact');assert.equal(w.LESSONS['pmp-full'][2].ch,2,'Explicit source associations remain authoritative');
 assert.equal(w.document.querySelector('[data-lt="0"]').closest('[data-chapter-ref]').dataset.chapterRef,'outline:intro','Reloaded renamed row stays in its saved introduction placement');
 assert.equal(JSON.stringify(A.prog('pmp-full')),progressBefore);
 // Preflight all new placements before mutating even the first visible lesson/title.
 c.chapters=[retired,...Array.from({length:99},(_,i)=>'Saved chapter '+i)];w.LESSONS['pmp-full'][0].ch=0;w.LESSONS['pmp-full'][0].t='شهادات PMI';w.LESSONS['pmp-full'][0].t_en='PMI Certifications';A.render();
 const frozen=JSON.stringify({chapters:c.chapters,lessons:w.LESSONS['pmp-full']}),callCount=r.calls.length;
 w.document.querySelector('[data-lt="0"]').value='Must stay a DOM draft';
 assert.equal(await w.document.getElementById('admSaveVid').onclick(),false);
 assert.equal(JSON.stringify({chapters:c.chapters,lessons:w.LESSONS['pmp-full']}),frozen);assert.equal(r.calls.length,callCount,'Capacity failure makes no network writes');
 assert.equal(await w.document.querySelector('[data-lt="0"]').onchange(),false,'Title auto-save also respects failed preflight');
 const checkbox=w.document.querySelector('[data-lfree="0"]');checkbox.checked=!checkbox.checked;checkbox.onchange();
 assert.equal(w.document.querySelector('[data-lt="0"]').value,'Must stay a DOM draft','Checkbox cannot discard an invalid draft');
 assert.equal(await w.document.getElementById('fillDurations').onclick(),false);
 assert.equal(await w.document.querySelector('[data-attach="0"]').onchange(),false);
 assert.equal(await w.document.querySelector('[data-lesson-quiz="0"]').onclick(),false);
 assert.equal(JSON.stringify({chapters:c.chapters,lessons:w.LESSONS['pmp-full']}),frozen);assert.equal(r.calls.length,callCount);

 assert.deepEqual(r.errors,[]);
}finally{r.dom.window.close();}
console.log('PASS: real SPA navigation/focus refresh; CMS/instructors/lessons; no render loop; stable progress/indices; modal/draft/race guards; safe admin deep links; custom chapter movement; contiguous fallback video numbers; admin-only trainer refresh.');
