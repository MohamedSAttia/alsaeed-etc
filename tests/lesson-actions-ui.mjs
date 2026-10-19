import {lessonAction,lessonStructure,lessonCourseBase} from '../lesson-actions.js';
import {DatabaseSync} from 'node:sqlite';
class Database {constructor(){this.db=new DatabaseSync(':memory:');}exec(s){return this.db.exec(s)}prepare(s){return this.db.prepare(s)}close(){this.db.close()}transaction(fn){return(...args)=>{this.exec('BEGIN');try{const result=fn(...args);this.exec('COMMIT');return result;}catch(e){this.exec('ROLLBACK');throw e;}}}}
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
 const actionRecords=new Map();
 const w=dom.window,calls=[],errors=[],holds=new Map(),failures=new Map();let content=snapshot?.content&&clone(snapshot.content);
 const rows=new Map(Object.entries(snapshot?.rows||{'pmp-full':initialRows,'pmp-alt':initialRows,'rmp-full':initialRows}).map(([pid,value])=>[pid,clone(value)]));
 const progress={lessons:{0:true,3:true},weeks:{1:true},exams:{original:{score:91}},activities:{},games:{},updatedAt:1};
 const user={id:'local-hierarchy-admin',name:'Local administrator',email:'admin@local.test',role:'admin'};
 w.localStorage.setItem('alsaeed_token','synthetic-local-token');w.sessionStorage.setItem('alsaeed_auth_prompt_v1','1');
 w.confirm=()=>true;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
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
  if(/^\/api\/admin\/lessons\/[^/]+\/action$/.test(pathname)&&method==='POST'){
   const pid=decodeURIComponent(pathname.split('/').at(-2)), db=new Database(':memory:');
   db.exec(`CREATE TABLE lessons(package_id TEXT,idx INTEGER,title TEXT,title_en TEXT,chapter INTEGER,duration TEXT,vimeo TEXT,free INTEGER,notes TEXT,notes_en TEXT,files TEXT,quiz TEXT,display_order INTEGER,deleted_at INTEGER,PRIMARY KEY(package_id,idx));`);
   for(const r of rows.get(pid)||[])db.prepare('INSERT INTO lessons VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(pid,r.idx,r.title,r.title_en,r.chapter,r.duration,r.vimeo,r.free?1:0,r.notes,r.notes_en,JSON.stringify(r.files),JSON.stringify(r.quiz),r.displayOrder??null,r.deleted_at??null);
   const settings=new Map([['content_courses',JSON.stringify(content.courses)],['content_packages',JSON.stringify(content.packages)],...actionRecords]);
   const result=lessonAction({db,setting:k=>settings.get(k)||'',setSetting:(k,v)=>settings.set(k,v)},pid,JSON.parse(options.body));
   if(result.ok){rows.set(pid,db.prepare('SELECT *,display_order AS displayOrder FROM lessons WHERE package_id=? ORDER BY idx').all(pid).map(r=>({...r,deleted:!!r.deleted_at,files:JSON.parse(r.files),quiz:JSON.parse(r.quiz)})));content.courses=JSON.parse(settings.get('content_courses'));for(const [k,v] of settings)if(k.startsWith('lesson_action:'))actionRecords.set(k,v);}
   db.close();return response(result,!result.error);
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
   return response((rows.get(pid)||[]).map(r=>({...r,deleted:!!r.deleted_at,structureBase:lessonStructure(rows.get(pid)||[]),courseBase:lessonCourseBase(k=>JSON.stringify(k==='content_courses'?content.courses:content.packages),pid)})));
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

const ids=f=>Array.from(f.w.document.querySelectorAll('[data-admin-chapter="monitoring"] [data-lt]'),e=>Number(e.dataset.lt));
const openInsert=(f,i,position)=>f.$('[data-l'+position+'="'+i+'"]').onclick();
const submit=async f=>{f.input('#nlT','New target lesson');f.input('#nlV','123456');await f.$('#nlSave').onclick();};
test('actual SPA adds before/after stable target, soft deletes and restores without changing content/progress',async()=>{
 const f=await fixture();try{
  const original=clone(f.rows.get('pmp-full')),progress=JSON.stringify(f.progress);f.w.APP.DB.progress[f.w.APP.me().id]={'pmp-full':clone(f.progress)};
  openInsert(f,2,'before');assert(f.$('#nlSave'),'dialog opened');await submit(f);
  assert.deepEqual(ids(f),[1,5,2,3]);assert.equal(f.rows.get('pmp-full').length,6);
  openInsert(f,2,'after');await submit(f);assert.deepEqual(ids(f),[1,5,2,6,3]);
  await f.$('[data-ldel="2"]').onclick();assert.deepEqual(ids(f),[1,5,6,3]);assert(f.$('[data-lrestore="2"]'));
  const deleted=f.rows.get('pmp-full')[2];assert(deleted.deleted_at);for(const k of ['vimeo','notes','files','quiz','title'])assert.deepEqual(deleted[k],original[2][k]);
  f.w.APP.go('learn/pmp-full');await pause();assert(!f.w.document.querySelector('[data-lesson-index="2"]'));
  f.w.APP.go('admin/content/pmp-full');await f.$('[data-lrestore="2"]').onclick();assert.deepEqual(ids(f),[1,5,2,6,3]);
  assert.equal(JSON.stringify(f.w.APP.prog('pmp-full')),progress);assert.equal(f.errors.length,0,f.errors.join(';'));
 }finally{f.dom.window.close();}
});
test('cancel, repeated clicks, stale edits and package navigation remain safe',async()=>{
 const f=await fixture();try{
  const before=JSON.stringify(f.rows.get('pmp-full'));f.w.confirm=()=>false;await f.$('[data-ldel="1"]').onclick();assert.equal(JSON.stringify(f.rows.get('pmp-full')),before);f.w.confirm=()=>true;
  openInsert(f,1,'before');f.w.APP.closeModal();assert.equal(JSON.stringify(f.rows.get('pmp-full')),before);
  openInsert(f,1,'after');f.input('#nlT','New');const hold=f.hold('POST','/api/admin/lessons/pmp-full/action');const button=f.$('#nlSave'),pending=button.onclick();await until(()=>hold.started,'action not started');await button.onclick();hold.release();await pending;
  assert.equal(f.rows.get('pmp-full').length,6);assert.equal(f.calls.filter(c=>c.path.endsWith('/action')).length,1);
  f.rows.get('pmp-full')[1].title='External rename';await f.$('[data-ldel="1"]').onclick();assert(!f.rows.get('pmp-full')[1].deleted_at,'stale token rejects deletion');
 }finally{f.dom.window.close();}
});
test('late action response never discards new raw or asynchronous teaching drafts',async()=>{
 const f=await fixture();try{
  const hold=f.hold('GET','/api/admin/lessons/pmp-full');const pending=f.$('[data-ldel="1"]').onclick();await until(()=>hold.started,'reread not started');
  f.w.LESSONS['pmp-full'][2].files.push({id:'new-upload',name:'New file.pdf'});hold.release();await pending;
  assert(f.w.LESSONS['pmp-full'][2].files.some(x=>x.id==='new-upload'));
  assert.equal(f.rows.get('pmp-full')[1].deleted,true,'authorized operation completed server-side');
 }finally{f.dom.window.close();}
});
test('held responses respect package navigation, modal cancellation, raw input and actor changes',async()=>{
 for(const change of ['package','cancel','raw','actor']){
  const f=await fixture();try{
   openInsert(f,1,'before');f.input('#nlT','Interrupted '+change);
   const hold=f.hold('GET','/api/admin/lessons/pmp-full'),pending=f.$('#nlSave').onclick();await until(()=>hold.started,'reread not started');
   if(change==='package'){f.w.APP.closeModal();f.w.APP.go('admin/content/rmp-full');}
   if(change==='cancel'){f.w.APP.closeModal();f.w.APP.modal('<h3 id="laterModal">Keep later modal</h3>');}
   if(change==='raw')f.input('[data-lt="2"]','Unsaved newer title');
   if(change==='actor')f.w.APP.DB.session=null;
   hold.release();await pending;
   if(change==='package')assert.equal(f.w.APP.route,'admin/content/rmp-full');
   if(change==='cancel')assert(f.$('#laterModal'));
   if(change==='raw')assert.equal(f.$('[data-lt="2"]').value,'Unsaved newer title');
   if(change==='actor')assert.equal(f.w.APP.DB.session,null);
   assert.equal(f.rows.get('pmp-full').length,6,'accepted action completed once');
  }finally{f.dom.window.close();}
 }
});
test('unsaved raw input blocks lifecycle without harvesting or sending a mutation',async()=>{
 const f=await fixture();try{f.input('[data-vid="2"]','999999');openInsert(f,1,'before');assert(!f.$('#nlSave'));assert.equal(f.w.LESSONS['pmp-full'][2].vimeo,'100002');assert.equal(f.calls.filter(c=>c.path.endsWith('/action')).length,0);}finally{f.dom.window.close();}
});
test('Add-and-continue keeps the selected chapter and accepts private Vimeo hashes',async()=>{
 const f=await fixture();try{
  f.$('[data-addto="outline:monitoring"]').click();f.input('#nlT','Repeated chapter');f.input('#nlV','https://vimeo.com/123456/abcdef1234');await f.$('#nlSaveMore').onclick();
  assert(f.$('#nlSave'),'next dialog opened');assert(f.$('#nlSave').closest('#ov').textContent.includes('المتابعة'));
  f.input('#nlT','Second in chapter');await f.$('#nlSave').onclick();
  assert.equal(f.rows.get('pmp-full')[5].chapter,1);assert.equal(f.rows.get('pmp-full')[6].chapter,1);assert.equal(f.rows.get('pmp-full')[5].vimeo,'123456?h=abcdef1234');
 }finally{f.dom.window.close();}
});
test('continued relative insertion advances after the newly added lesson',async()=>{
 const f=await fixture();try{openInsert(f,1,'after');f.input('#nlT','First after');await f.$('#nlSaveMore').onclick();f.input('#nlT','Second after');await f.$('#nlSave').onclick();assert.deepEqual(ids(f),[1,5,6,2,3]);}finally{f.dom.window.close();}
});
