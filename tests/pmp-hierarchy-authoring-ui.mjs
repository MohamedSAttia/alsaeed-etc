/** Actual SPA authoring UI with synthetic authenticated data and a local-only API.
 * Exercises names/parents, dialog retries, draft races and course-level ordering. */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
const {JSDOM}=await import(process.env.JSDOM_MODULE||'/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js');
const html=fs.readFileSync('public/index.html','utf8'),clone=x=>JSON.parse(JSON.stringify(x));
const pause=()=>new Promise(r=>setTimeout(r,20));
async function until(check,label){for(let n=0;n<120;n++){if(check())return;await pause();}assert.fail(label);}
const flatten=nodes=>nodes.flatMap(node=>[node,...flatten(node.children||[])]);
const initialChapters=[
 {ar:'مقدمة',en:'Introduction',outlineKey:'intro',metadata:{original:true}},
 {ar:'هيكل اختبار PMP',en:'PMP exam structure',outlineKey:'exam'},
 {ar:'إطار عمل إدارة المشاريع',en:'Project management framework',outlineKey:'framework'},
 {ar:'محور مخصص',en:'Custom original',metadata:{keep:7}},
 {ar:'النهج المختلط',en:'Hybrid Approach',outlineKey:'hybrid'}
];
const initialRows=initialChapters.map((_,i)=>({chapter:i,title:'عنوان أصلي '+i,title_en:'Original title '+i,duration:'01:00',vimeo:String(100000+i),free:i===0,files:[{id:'fixture-file-'+i,name:'local.pdf'}],quiz:[{q:'Question '+i}],notes:'Notes '+i,notes_en:'Notes '+i}));
async function fixture(snapshot){
 const dom=new JSDOM(html,{url:'https://hierarchy.local/#admin/content/pmp-full',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[],errors=[],holds=new Map(),failures=new Map();let content=snapshot?.content&&clone(snapshot.content);
 const rows=new Map(Object.entries(snapshot?.rows||{'pmp-full':initialRows,'pmp-alt':initialRows,'rmp-full':initialRows}).map(([pid,value])=>[pid,clone(value)]));
 const progress={lessons:{0:true,3:true},weeks:{1:true},exams:{original:{score:91}},activities:{},games:{},updatedAt:1};
 const user={id:'local-hierarchy-admin',name:'Local administrator',email:'admin@local.test',role:'admin'};
 w.localStorage.setItem('alsaeed_token','synthetic-local-token');w.sessionStorage.setItem('alsaeed_auth_prompt_v1','1');
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
 w.addEventListener('error',event=>errors.push(event.message));
 const response=(body,ok=true)=>({ok,status:ok?200:503,json:async()=>clone(body)});
 w.fetch=async(url,options={})=>{
  const pathname=new URL(String(url),w.location.href).pathname,method=options.method||'GET',key=method+' '+pathname;
  calls.push({path:pathname,method,body:options.body&&JSON.parse(options.body)});
  const hold=holds.get(key);if(hold){holds.delete(key);hold.started=true;await new Promise(resolve=>hold.release=resolve);}
  if(failures.get(key)){failures.delete(key);return response({error:'Synthetic save failure'},false);}
  if(pathname==='/api/health')return response({ok:true});
  if(pathname==='/api/me')return response({user,packages:[{package_id:'pmp-full',created:1}]});
  if(pathname==='/api/admin/users')return response([{...user,packages:[{package_id:'pmp-full',created:1}]}]);
  if(pathname==='/api/admin/orders')return response([]);
  if(pathname==='/api/admin/overview')return response({stats:{},students:[],recentOrders:[]});
  if(pathname==='/api/content'){
   if(!content){content={courses:clone(w.COURSES),packages:clone(w.PACKAGES),instructors:[],defaultInstructorId:null};
    content.courses.find(c=>c.id==='pmp').chapters=clone(initialChapters);
    content.packages.push({...clone(content.packages.find(p=>p.id==='pmp-full')),id:'pmp-alt',ar:'Local alternate package',en:'Local alternate package'});
   }return response(content);
  }
  if(pathname==='/api/catalog-availability')return response(Object.fromEntries([...rows].map(([pid,ls])=>[pid,{videos:ls.length,videoMins:ls.length,questions:0}])));
  if(pathname.startsWith('/api/admin/course-chapters/')&&method==='PUT'){
   content.courses.find(c=>c.id===decodeURIComponent(pathname.split('/').at(-1))).chapters=clone(JSON.parse(options.body).chapters);return response({ok:true});
  }
  if(/^\/api\/(admin\/)?lessons\//.test(pathname)){
   const pid=decodeURIComponent(pathname.split('/').at(-1));
   if(method==='PUT')rows.set(pid,JSON.parse(options.body).map(l=>({chapter:l.ch,title:l.t,title_en:l.t_en||'',duration:l.dur||'',vimeo:l.vimeo||'',free:!!l.free,files:l.files||[],quiz:l.quiz||[],notes:l.notes||'',notes_en:l.notes_en||''})));
   return response(rows.get(pid)||[]);
  }
  if(pathname.startsWith('/api/progress/'))return response(progress);
  return response({},false);
 };
 for(const script of w.document.scripts){if(script.type&&script.type!=='text/javascript')continue;const src=script.getAttribute('src');if(src){if(src.startsWith('/'))w.eval(fs.readFileSync(path.join('public',new URL(src,w.location.href).pathname),'utf8'));}else if(script.textContent.trim())w.eval(script.textContent);}
 await until(()=>w.APP?.live&&w.APP.isAdmin()&&w.document.querySelector('[data-chsave="outline:intro"]'),'Authenticated content editor did not boot');
 const $=selector=>w.document.querySelector(selector);
 const input=(selector,value)=>{const element=$(selector);assert(element,selector);if(element.isContentEditable||element.hasAttribute('contenteditable'))element.textContent=value;else element.value=value;element.dispatchEvent(new w.Event('input',{bubbles:true}));return element;};
 const parent=(ref,value)=>{const element=input('[data-chparent="'+ref+'"]',value||'');element.dispatchEvent(new w.Event('change',{bubbles:true}));};
 return {dom,w,$,input,parent,calls,errors,rows,progress,get content(){return content;},snapshot:()=>clone({content,rows:Object.fromEntries(rows)}),
  hold(method,pathname){const state={};holds.set(method+' '+pathname,state);return state;},fail(method,pathname){failures.set(method+' '+pathname,true);}};
}
async function save(f,ref){assert.equal(await f.$('[data-chsave="'+ref+'"]').onclick(),true);}
const checkNoErrors=f=>assert.deepEqual(f.errors,[]);

test('rename, create nested custom topic, reparent, promote and reload using the actual UI',async()=>{
 const f=await fixture();let reload;try{
  const {w,$}=f,A=w.APP,c=A.course('pmp'),original=clone(f.rows.get('pmp-full')),progressBefore=JSON.stringify(A.prog('pmp-full'));
  assert.equal($('[data-chparent="outline:exam"]').value,'outline:intro','Exam defaults under introduction');
  assert.equal($('[data-chparent="outline:exam"]').closest('[data-chapter-ref]').style.marginInlineStart,'24px');
  f.input('[data-chname="outline:intro"]','المقدمة المخصصة');f.input('[data-chname-en="outline:intro"]','Custom introduction');
  const authoringWrites=()=>f.calls.filter(x=>x.method==='PUT'&&/^\/api\/admin\/(course-chapters|lessons)\//.test(x.path)).length;
  const writes=authoringWrites();$('[data-chname="outline:intro"]').onblur();await pause();
  assert.equal(authoringWrites(),writes,'PMP title edits wait for explicit save');await save(f,'outline:intro');
  assert.equal(f.content.courses.find(c=>c.id==='pmp').chapters[0].ar,'المقدمة المخصصة');
  $('[data-addchapter="outline:intro"]').click();assert.equal($('#ncRef').value,'custom');assert.equal($('#ncParent').value,'outline:intro');
  f.input('#ncN','موضوع فرعي مخصص');f.input('#ncEn','Custom nested topic');assert.equal(await $('#ncGo').onclick(),true);
  const customIndex=c.chapters.findIndex(ch=>ch.en==='Custom nested topic'),ref='chapter:'+customIndex,key='source_'+customIndex;
  assert(customIndex>=initialChapters.length);assert.equal(c.chapters[customIndex].outlineParent,'intro');
  assert.equal($('[data-chparent="'+ref+'"]').value,'outline:intro');
  f.input('[data-chname="'+ref+'"]','موضوع فرعي معدل');f.input('[data-chname-en="'+ref+'"]','Renamed nested topic');f.parent(ref,'outline:hybrid');await save(f,ref);
  assert.equal(c.chapters[customIndex].outlineParent,'hybrid');assert.equal(c.chapters[customIndex].en,'Renamed nested topic');
  f.parent(ref,null);await save(f,ref);assert.equal(c.chapters[customIndex].outlineParent,null);assert.equal($('[data-chparent="'+ref+'"]').value,'');
  f.parent('outline:predictive','outline:hybrid');await save(f,'outline:predictive');
  assert.equal($('[data-chparent="outline:closing"]').value,'outline:predictive','Existing nested parent stays selectable');
  assert.equal($('[data-chparent="outline:closing"]').closest('[data-chapter-ref]').style.marginInlineStart,'48px','Deeper hierarchy uses its real depth');
  f.parent('outline:predictive',null);await save(f,'outline:predictive');
  f.parent('outline:exam','outline:framework');await save(f,'outline:exam');assert.equal(c.chapters[1].outlineParent,'framework');
  f.parent('outline:exam','outline:intro');await save(f,'outline:exam');
  const frozen=JSON.stringify(c.chapters);await save(f,'outline:exam');assert.equal(JSON.stringify(c.chapters),frozen,'Repeated save neither duplicates nor reshuffles slots');
  assert.deepEqual(f.rows.get('pmp-full'),original,'Metadata authoring preserves all original lessons and indices');
  assert.equal(JSON.stringify(A.prog('pmp-full')),progressBefore,'Original-index progress remains unchanged');
  assert.deepEqual(clone(c.chapters[0].metadata),{original:true});assert.deepEqual(clone(c.chapters[3].metadata),{keep:7});
  reload=await fixture(f.snapshot());const r=reload.w.APP.course('pmp'),R=reload.w.CourseRoadmap;
  assert.equal(r.chapters[customIndex].outlineParent,null);assert.equal(reload.$('[data-chname="'+ref+'"]').textContent,'موضوع فرعي معدل');
  assert.equal(R.topics(r)[0].ar,'المقدمة المخصصة');assert(R.topics(r)[0].children.some(t=>t.key==='exam'));
  assert(R.topics(r).some(t=>t.key===key));
  reload.w.APP.go('course/pmp');await pause();assert.match(reload.$('#cd-topics').textContent,/المقدمة المخصصة/);assert.match(reload.$('#cd-topics').textContent,/موضوع فرعي معدل/);
  reload.w.APP.go('learn/pmp-full');await until(()=>reload.$('[data-lt="content"]'),'Learner view did not open');reload.$('[data-lt="content"]').click();
  assert(reload.$('[data-learning-group="intro"] [data-learning-group="exam"]'),'Saved hierarchy renders in real learner content');
  assert.equal(reload.$('[data-learning-group="exam"]').querySelector('[data-lesson]').dataset.lesson,'1','Original lesson index remains the click/progress key');
  checkNoErrors(f);checkNoErrors(reload);
 }finally{reload?.dom.window.close();f.dom.window.close();}
});

test('add dialog retries the same stable slot, permits corrected name/parent, and does not duplicate',async()=>{
 const f=await fixture();try{
  const {$,w}=f,c=w.APP.course('pmp');$('[data-addchapter="outline:intro"]').click();f.input('#ncN','موضوع سيعاد حفظه');f.input('#ncEn','Retry topic');
  f.fail('PUT','/api/admin/course-chapters/pmp');assert.equal(await $('#ncGo').onclick(),false);
  const index=c.chapters.findIndex(ch=>ch.en==='Retry topic'),count=c.chapters.length;assert(index>=0);assert.equal($('#ncRef').disabled,true);
  assert.equal(f.calls.filter(x=>x.method==='PUT'&&x.path.includes('/lessons/')).length,0);
  f.input('#ncN','موضوع مصحح');f.input('#ncEn','Corrected retry topic');f.input('#ncParent','outline:hybrid');
  f.fail('PUT','/api/admin/lessons/pmp-full');assert.equal(await $('#ncGo').onclick(),false);
  assert.equal(c.chapters[index].outlineParent,'hybrid');assert.equal(c.chapters.filter(ch=>ch.en==='Corrected retry topic').length,1);
  const secondCount=c.chapters.length;assert(secondCount>=count);assert.equal(await $('#ncGo').onclick(),true);assert.equal(c.chapters.length,secondCount);assert.equal($('#ov'),null);
  assert.equal(f.content.courses.find(c=>c.id==='pmp').chapters[index].en,'Corrected retry topic');checkNoErrors(f);
 }finally{f.dom.window.close();}
});

test('invalid parent or capacity failure is atomic and sends no save request',async()=>{
 const f=await fixture();try{
  const {$,w}=f,c=w.APP.course('pmp');const before=JSON.stringify({chapters:c.chapters,lessons:w.LESSONS['pmp-full']}),calls=f.calls.length;
  const selector=$('[data-chparent="outline:intro"]');selector.add(new w.Option('Invalid descendant','outline:exam'));f.parent('outline:intro','outline:exam');
  f.input('[data-chname="outline:intro"]','Must stay unsaved');assert.equal(await $('[data-chsave="outline:intro"]').onclick(),false);
  assert.equal(JSON.stringify({chapters:c.chapters,lessons:w.LESSONS['pmp-full']}),before);assert.equal(f.calls.length,calls);w.APP.render();
  c.chapters=Array.from({length:100},(_,i)=>({ar:'محور '+i,en:'Topic '+i}));w.APP.render();const frozen=JSON.stringify(c.chapters),beforeCapacity=f.calls.length;
  f.parent('outline:exam','outline:hybrid');assert.equal(await $('[data-chsave="outline:exam"]').onclick(),false);
  assert.equal(JSON.stringify(c.chapters),frozen);assert.equal(f.calls.length,beforeCapacity);checkNoErrors(f);
 }finally{f.dom.window.close();}
});

test('heading save preserves newer raw title or parent edits while request is pending',async()=>{
 const f=await fixture();try{
  f.parent('outline:exam','outline:hybrid');const hold=f.hold('PUT','/api/admin/lessons/pmp-full');const pending=f.$('[data-chsave="outline:exam"]').onclick();
  await until(()=>hold.started,'Save did not reach held lesson write');f.input('[data-lt="0"]','New raw lesson draft');f.parent('outline:exam','outline:framework');hold.release();assert.equal(await pending,true);
  assert.equal(f.$('[data-lt="0"]').value,'New raw lesson draft');assert.equal(f.$('[data-chparent="outline:exam"]').value,'outline:framework');assert.equal(f.$('[data-chsave="outline:exam"]').disabled,false);
  assert.equal(f.rows.get('pmp-full')[0].title,initialRows[0].title);await save(f,'outline:exam');assert.equal(f.rows.get('pmp-full')[0].title,'New raw lesson draft');
  assert.equal(f.content.courses.find(c=>c.id==='pmp').chapters[1].outlineParent,'framework');checkNoErrors(f);
 }finally{f.dom.window.close();}
});

test('dismissed add dialog cannot close or replace a later modal on save completion',async()=>{
 const f=await fixture();try{
  f.$('[data-addchapter="outline:intro"]').click();f.input('#ncN','إضافة بطيئة');const hold=f.hold('PUT','/api/admin/lessons/pmp-full'),pending=f.$('#ncGo').onclick();
  await until(()=>hold.started,'Add did not reach held save');f.w.APP.closeModal();f.w.APP.modal('<input id="replacementDraft" value="Keep my later dialog">');
  f.$('#replacementDraft').dispatchEvent(new f.w.Event('input',{bubbles:true}));hold.release();assert.equal(await pending,true);
  assert.equal(f.$('#replacementDraft').value,'Keep my later dialog');checkNoErrors(f);
 }finally{f.dom.window.close();}
});

test('same-course package saves serialize, another course stays independent, and old completion preserves new package draft',async()=>{
 const f=await fixture();try{
  const A=f.w.APP;await A.loadAdminLessons('pmp-alt',{render:false});await A.loadAdminLessons('rmp-full',{render:false});
  f.input('[data-chname-en="outline:intro"]','Older A title');
  const hold=f.hold('PUT','/api/admin/course-chapters/pmp'),first=f.$('[data-chsave="outline:intro"]').onclick();await until(()=>hold.started,'First shared-course write not held');
  A.go('admin/content/pmp-alt');await until(()=>f.$('#admPk')?.value==='pmp-alt','Second package failed to load');f.input('[data-chname-en="outline:intro"]','Newer B title');const second=f.$('[data-chsave="outline:intro"]').onclick();
  await pause();assert.equal(f.calls.filter(c=>c.path==='/api/admin/course-chapters/pmp'&&c.method==='PUT').length,1,'Second shared-course transaction waits');
  A.go('admin/content/rmp-full');await until(()=>f.$('#admPk')?.value==='rmp-full','Independent course failed to load');
  const third=f.$('#admSaveVid').onclick();await until(()=>f.calls.some(c=>c.path==='/api/admin/course-chapters/rmp'&&c.method==='PUT'),'Independent course must not wait for PMP');assert.equal(await third,true);
  f.input('[data-lt="0"]','New package raw draft');hold.release();assert.equal(await first,true);assert.equal(await second,true);
  assert.equal(f.content.courses.find(c=>c.id==='pmp').chapters[0].en,'Newer B title');assert.equal(f.$('#admPk').value,'rmp-full');assert.equal(f.$('[data-lt="0"]').value,'New package raw draft');
  checkNoErrors(f);
 }finally{f.dom.window.close();}
});

test('actor change during a held heading write stops later lesson writes and UI completion',async()=>{
 const f=await fixture();try{
  f.parent('outline:exam','outline:hybrid');const hold=f.hold('PUT','/api/admin/course-chapters/pmp'),pending=f.$('[data-chsave="outline:exam"]').onclick();await until(()=>hold.started,'Write did not start');
  f.$('#logout').onclick();hold.release();assert.equal(await pending,false);assert.equal(f.w.APP.token,null);assert.equal(f.w.APP.me(),null);
  assert.equal(f.calls.filter(c=>c.path==='/api/admin/lessons/pmp-full'&&c.method==='PUT').length,0);assert.equal(Object.hasOwn(f.w.LESSONS,'pmp-full'),false);checkNoErrors(f);
 }finally{f.dom.window.close();}
});


test('author execution, resource management, and acquire/lead topics at three-plus levels',async()=>{
 const f=await fixture();let reload;try{
  const {$,w}=f,original=clone(f.rows.get('pmp-full')),progress=JSON.stringify(w.APP.prog('pmp-full'));
  $('[data-addchapter="outline:executing"]').click();assert.equal($('#ncParent').value,'outline:executing');f.input('#ncN','إدارة الموارد');f.input('#ncEn','Resource management');assert.equal(await $('#ncGo').onclick(),true);
  const course=w.APP.course('pmp'),resourceIndex=course.chapters.findIndex(ch=>ch?.en==='Resource management'),resourceRef='chapter:'+resourceIndex;
  assert($('[data-addchapter="'+resourceRef+'"]'),'Nested resource chapter offers Add Subtopic');
  for(const [ar,en] of [['الحصول على الموارد','Acquire resources'],['قيادة الفريق','Lead team']]){
   $('[data-addchapter="'+resourceRef+'"]').click();assert.equal($('#ncParent').value,resourceRef);f.input('#ncN',ar);f.input('#ncEn',en);assert.equal(await $('#ncGo').onclick(),true);
  }
  const acquireIndex=course.chapters.findIndex(ch=>ch?.en==='Acquire resources'),leadIndex=course.chapters.findIndex(ch=>ch?.en==='Lead team'),acquireRef='chapter:'+acquireIndex,leadRef='chapter:'+leadIndex;
  assert.equal(course.chapters[resourceIndex].outlineParent,'executing');assert.equal(course.chapters[acquireIndex].outlineParent,'source_'+resourceIndex);assert.equal(course.chapters[leadIndex].outlineParent,'source_'+resourceIndex);
  assert.equal($('[data-chparent="'+acquireRef+'"]').closest('[data-chapter-ref]').style.marginInlineStart,'72px');
  const parentOptions=Array.from($('[data-chparent="'+leadRef+'"]').options);assert(parentOptions.some(option=>option.value===acquireRef&&/^\d+(?:\.\d+)+\. /.test(option.textContent)),'Nested destinations have hierarchical numbers');
  assert(!w.CourseRoadmap.parentChoices(course,resourceRef).some(option=>[resourceRef,acquireRef,leadRef].includes(option.ref)),'Self and descendants are excluded');
  f.parent(leadRef,acquireRef);assert.equal(await $('[data-chsave="'+leadRef+'"]').onclick(),true);assert.equal(course.chapters[leadIndex].outlineParent,'source_'+acquireIndex);assert.equal($('[data-chparent="'+leadRef+'"]').closest('[data-chapter-ref]').style.marginInlineStart,'96px');
  f.parent(leadRef,resourceRef);assert.equal(await $('[data-chsave="'+leadRef+'"]').onclick(),true);
  assert.deepEqual(f.rows.get('pmp-full'),original);assert.equal(JSON.stringify(w.APP.prog('pmp-full')),progress);
  reload=await fixture(f.snapshot());const tree=reload.w.CourseRoadmap.topics(reload.w.APP.course('pmp')),nodes=flatten(tree),resource=nodes.find(node=>node.key==='source_'+resourceIndex);
  assert.deepEqual(Array.from(resource.children,node=>node.en),['Acquire resources','Lead team']);assert.equal(resource.parentKey,'executing');assert(reload.$('[data-addchapter="'+acquireRef+'"]'));checkNoErrors(f);checkNoErrors(reload);
 }finally{reload?.dom.window.close();f.dom.window.close();}
});
