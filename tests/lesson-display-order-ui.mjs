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
 {ar:'مقدمة',en:'Introduction',outlineKey:'intro'},
 {ar:'مرحلة المتابعة والتحكم',en:'Monitoring & Controlling',outlineKey:'monitoring',metadata:{keep:true}},
 {ar:'مرحلة الإغلاق',en:'Closing',outlineKey:'closing'}
];
const initialRows=[
 {chapter:0,title:'مقدمة',title_en:'Introduction'},
 {chapter:1,title:'التحقق من النطاق',title_en:'Validate Scope'},
 {chapter:1,title:'التحكم بالجودة',title_en:'Quality Control'},
 {chapter:1,title:'شرح محفوظ',title_en:'Saved reading'},
 {chapter:2,title:'إغلاق المشروع',title_en:'Project closing'}
].map((row,i)=>({...row,idx:i,duration:'01:00',vimeo:i===3?'':String(100000+i),free:i===0,files:[{id:'fixture-file-'+i,name:'local.pdf'}],quiz:[{q:'Question '+i}],notes:'Notes '+i,notes_en:'Notes '+i,displayOrder:null}));
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
  if(/^\/api\/admin\/lessons\/[^/]+\/fill-durations$/.test(pathname)&&method==='POST'){
   const pid=decodeURIComponent(pathname.split('/').at(-2));for(const row of rows.get(pid)||[])row.duration='02:00';return response({updated:rows.get(pid)?.length||0,unavailable:0});
  }
  if(/^\/api\/(admin\/)?lessons\//.test(pathname)){
   const pid=decodeURIComponent(pathname.split('/').at(-1));
   if(method==='PUT'){
    const incoming=JSON.parse(options.body),previous=rows.get(pid)||[];
    if(incoming.kind==='display-order'){
     if(incoming.expectedCount!==previous.length||incoming.orders.some(order=>order.displayOrder!==previous[order.idx]?.displayOrder&&order.displayOrderBase!==previous[order.idx]?.displayOrder))return response({error:'Synthetic stale order conflict'},false);
     for(const order of incoming.orders)previous[order.idx].displayOrder=order.displayOrder;
     return response({ok:true,orders:incoming.orders.map(({idx,displayOrder})=>({idx,displayOrder}))});
    }
    if(incoming.some((l,i)=>previous[i]&&l.displayOrder!==undefined&&l.displayOrder!==previous[i].displayOrder&&l.displayOrderBase!==previous[i].displayOrder))return response({error:'Synthetic stale order conflict'},false);
    rows.set(pid,incoming.map((l,i)=>({idx:i,chapter:l.ch,title:l.t,title_en:l.t_en||'',duration:l.dur||'',vimeo:l.vimeo||'',free:!!l.free,files:l.files||[],quiz:l.quiz||[],notes:l.notes||'',notes_en:l.notes_en||'',displayOrder:l.displayOrder===undefined?previous[i]?.displayOrder??null:l.displayOrder})));
   }
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
const indices=f=>Array.from(f.w.document.querySelectorAll('[data-admin-chapter="monitoring"] [data-lt]'),el=>Number(el.dataset.lt));
const bare=rows=>rows.map(({displayOrder,displayOrderBase,clearVimeo,...row})=>row);
const move=(f,index,dir)=>f.$('[data-l'+(dir<0?'up':'down')+'="'+index+'"]').onclick();
const unchangedContent=(f,original)=>assert.deepEqual(bare(f.rows.get('pmp-full')),bare(original),'Stable storage slots and all teaching material remain identical');

test('requested pair reorders by metadata, repeats safely, reloads, and matches learner/player numbers',async()=>{
 const f=await fixture();let reload;try{
  const original=clone(f.rows.get('pmp-full')),chapters=clone(f.content.courses.find(c=>c.id==='pmp').chapters),progress=JSON.stringify(f.w.APP.prog('pmp-full'));
  assert.deepEqual(indices(f),[1,2,3]);assert.equal(f.$('[data-lup="1"]').disabled,true);assert.equal(f.$('[data-lup="2"]').disabled,false);
  assert.equal(await move(f,2,-1),true);assert.deepEqual(indices(f),[2,1,3]);unchangedContent(f,original);
  assert.equal(f.rows.get('pmp-full')[2].displayOrder,0);assert.equal(f.rows.get('pmp-full')[1].displayOrder,1);
  for(let n=0;n<8;n++){assert.equal(await move(f,2,1),true);assert.equal(await move(f,2,-1),true);unchangedContent(f,original);}
  assert.equal(JSON.stringify(f.w.APP.prog('pmp-full')),progress);assert.deepEqual(f.content.courses.find(c=>c.id==='pmp').chapters,chapters);
  assert.deepEqual(f.rows.get('pmp-alt'),initialRows,'Other packages stay unchanged');
  reload=await fixture(f.snapshot());assert.deepEqual(indices(reload),[2,1,3]);
  const w=reload.w,order=Array.from(w.CourseRoadmap.videoOrder(w.APP.course('pmp'),w.LESSONS['pmp-full']));assert.deepEqual(order,[0,2,1,4]);
  assert.deepEqual(Array.from(w.document.querySelectorAll('[data-lt]'),el=>[+el.dataset.lt,el.closest('tr').querySelector('td').textContent.trim()]),[[0,'1'],[2,'2'],[1,'3'],[3,'4'],[4,'5']]);
  w.Vimeo={Player:class{constructor(){this.handlers={};}getDuration(){return Promise.resolve(60);}on(name,fn){this.handlers[name]=fn;}destroy(){return Promise.resolve();}}};
  w.APP.go('learn/pmp-full');await until(()=>reload.$('[data-lt="content"]'),'learner tabs');reload.$('[data-lt="content"]').click();await until(()=>reload.$('[data-lesson]'),'learner content');
  assert.deepEqual(Array.from(w.document.querySelectorAll('[data-lesson]'),el=>Number(el.dataset.lesson)),order);
  await pause();await pause();const learnerProgress=JSON.stringify(w.APP.prog('pmp-full'));w.InteractiveVideo.open('pmp-full',2);assert(reload.$('#iv'),'player opens');await pause();assert(reload.$('#iv'),'player remains open');
  assert.deepEqual(Array.from(w.document.querySelectorAll('#iv [data-go]'),el=>Number(el.dataset.go)),order);
  assert.deepEqual(Array.from(w.document.querySelectorAll('#iv [data-go] .n'),el=>Number(el.textContent)),[1,2,3,4]);
  reload.$('#ivNext').click();await pause();assert.equal(Number(reload.$('.iv-li.cur').dataset.go),1);
  reload.$('#ivPrev').click();await pause();assert.equal(Number(reload.$('.iv-li.cur').dataset.go),2);
  w.InteractiveVideo.close();assert.equal(JSON.stringify(w.APP.prog('pmp-full')),learnerProgress);
  reload.$('[data-lt="exams"]').click();await until(()=>reload.$('#assessmentPageTitle'),'dedicated assessment page');
  assert(reload.$('.assessment-page-body [data-assessment-centre]'),'Catalogue stays within the package');
  assert.equal(reload.$('.learner-steps'),null,'Dedicated page does not bury tests below the dashboard');
  assert.equal(w.document.activeElement.id,'assessmentPageTitle','Keyboard focus reaches the page heading');
  reload.$('.assessment-page-return [data-lt="content"]').click();await until(()=>reload.$('[data-lesson]'),'return to lessons');
  assert.deepEqual(Array.from(w.document.querySelectorAll('[data-lesson]'),el=>Number(el.dataset.lesson)),order);
  assert.equal(JSON.stringify(w.APP.prog('pmp-full')),learnerProgress,'Assessment navigation preserves learner progress');
  assert.deepEqual(f.errors,[]);assert.deepEqual(reload.errors,[]);
 }finally{reload?.dom.window.close();f.dom.window.close();}
});

test('pending arrow ignores repeated clicks, preserves new raw drafts and advances acknowledged bases',async()=>{
 const f=await fixture();try{
  const hold=f.hold('PUT','/api/admin/lessons/pmp-full'),button=f.$('[data-lup="2"]'),pending=button.onclick();await until(()=>hold.started,'held reorder');
  assert.equal(button.disabled,true);assert.equal(button.onclick(),false);assert.equal(f.$('[data-ldown="1"]').onclick(),false);
  f.input('[data-lt="0"]','New title typed while order saves');hold.release();assert.equal(await pending,true);
  assert.equal(f.$('[data-lt="0"]').value,'New title typed while order saves');assert.equal(f.w.LESSONS['pmp-full'][2].displayOrderBase,0);
  assert.equal(await move(f,2,1),true,'Second move uses acknowledged base even though raw draft skipped first reread');
  assert.deepEqual(indices(f),[1,2,3]);assert.equal(f.$('[data-lt="0"]').value,'New title typed while order saves');assert.equal(await f.$('#admSaveVid').onclick(),true);assert.equal(f.rows.get('pmp-full')[0].title,'New title typed while order saves');assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});

test('save failure retains exact draft for retry; stale external rank changes fail atomically',async()=>{
 const f=await fixture();try{
  f.fail('PUT','/api/admin/lessons/pmp-full');assert.equal(await move(f,2,-1),false);assert.deepEqual(indices(f),[2,1,3]);assert.deepEqual(f.rows.get('pmp-full'),initialRows);
  assert.equal(await f.$('#admSaveVid').onclick(),true);assert.deepEqual(indices(f),[2,1,3]);
  const stored=f.rows.get('pmp-full');stored[1].displayOrder=0;stored[2].displayOrder=2;stored[3].displayOrder=1;const external=clone(stored);
  assert.equal(await move(f,2,1),false);assert.deepEqual(f.rows.get('pmp-full'),external,'Conflict does not replace any row or protected content');assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});

test('package navigation during a save never replaces another package editor',async()=>{
 const f=await fixture();try{
  f.$('#admPk').value='pmp-alt';f.$('#admPk').onchange();await until(()=>f.w.APP.adminLessonsReady('pmp-alt')&&f.$('[data-lt="0"]'),'preload alternate');f.$('#admPk').value='pmp-full';f.$('#admPk').onchange();
  const hold=f.hold('PUT','/api/admin/lessons/pmp-full'),pending=move(f,2,-1);await until(()=>hold.started,'held save');
  f.$('#admPk').value='pmp-alt';f.$('#admPk').onchange();await until(()=>f.w.APP.adminLessonsReady('pmp-alt')&&f.$('[data-lt="0"]'),'other package load');
  f.input('[data-lt="0"]','Other package raw draft');hold.release();assert.equal(await pending,true);
  assert.equal(f.$('#admPk').value,'pmp-alt');assert.equal(f.$('[data-lt="0"]').value,'Other package raw draft');assert.deepEqual(f.rows.get('pmp-alt'),initialRows);assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});

test('duration refresh preserves display ranks and cannot replace a newer reorder or raw draft',async()=>{
 const f=await fixture();try{
  assert.equal(await move(f,2,-1),true);assert.equal(await f.$('#fillDurations').onclick(),true);assert.deepEqual(indices(f),[2,1,3]);assert.equal(f.w.LESSONS['pmp-full'][2].displayOrderBase,0);
  const hold=f.hold('POST','/api/admin/lessons/pmp-full/fill-durations'),pending=f.$('#fillDurations').onclick();await until(()=>hold.started,'held duration lookup');
  assert.equal(await move(f,2,1),true);f.input('[data-lt="0"]','New raw draft after duration lookup started');
  hold.release();assert.equal(await pending,true);assert.deepEqual(indices(f),[1,2,3]);assert.equal(f.$('[data-lt="0"]').value,'New raw draft after duration lookup started');
  assert.deepEqual(Array.from(f.w.CourseRoadmap.videoOrder(f.w.APP.course('pmp'),f.w.LESSONS['pmp-full'])),[0,1,2,4]);assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});


test('move lock survives rerender and metadata-only save preserves newer external teaching material',async()=>{
 const f=await fixture();try{
  const current=f.rows.get('pmp-full');Object.assign(current[0],{title:'Another editor title',vimeo:'999999',notes:'Another editor notes',quiz:[{q:'Another editor quiz'}]});const external=clone(current);
  const hold=f.hold('PUT','/api/admin/lessons/pmp-full'),pending=move(f,2,-1);await until(()=>hold.started,'held metadata-only move');f.w.APP.render();
  assert.equal(f.$('[data-ldown="2"]').disabled,true);assert.equal(f.$('[data-ldown="2"]').onclick(),false,'A rerender cannot bypass the package lock');
  f.input('[data-lt="0"]','Raw draft after rerender');
  hold.release();assert.equal(await pending,true);assert.deepEqual(indices(f),[2,1,3]);assert.equal(f.$('[data-lt="0"]').value,'Raw draft after rerender');assert.equal(f.$('[data-ldown="2"]').disabled,false,'Current arrows unlock without replacing a newer draft');assert.deepEqual(bare(f.rows.get('pmp-full')),bare(external));
  const write=f.calls.find(call=>call.method==='PUT'&&call.path==='/api/admin/lessons/pmp-full');assert.equal(write.body.kind,'display-order');assert.equal(write.body.expectedCount,5);assert.equal(JSON.stringify(write.body).includes('notes'),false);assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});
