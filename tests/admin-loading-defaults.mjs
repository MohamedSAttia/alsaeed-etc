/** Real SPA, synthetic authenticated API only. Guards ordinary #admin tab entry,
 * including unset selections and empty lesson packages. Never contacts production. */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
const {JSDOM}=await import(process.env.JSDOM_MODULE||'/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js');
const html=fs.readFileSync('public/index.html','utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
const pause=()=>new Promise(resolve=>setTimeout(resolve,20));
async function until(check,label){for(let n=0;n<100;n++){if(check())return;await pause();}assert.fail(label);}
async function fixture(rows=[], settings={}){
 const dom=new JSDOM(html,{url:'https://admin-loading.local/#admin',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,calls=[],errors=[],responses=new Map(),packageRows=new Map(),user={id:'admin-loading-local',role:'admin',name:'Local administrator',email:'admin@local.test'};
 if(settings.fastTimeout){const timeout=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>timeout(fn,ms===15000?5:ms,...args);}
 w.localStorage.setItem('alsaeed_token','synthetic-local-token');
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){};
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
 w.addEventListener('error',event=>errors.push(event.message));
 const response=(body,ok=true)=>({ok,status:ok?200:404,json:async()=>clone(body)});
 w.fetch=async(url,options={})=>{
  const pathname=new URL(String(url),w.location.href).pathname;calls.push({path:pathname,method:options.method||'GET'});
  if(pathname==='/api/health')return response({ok:true});
  if(pathname==='/api/me')return response({user,packages:[]});
  if(pathname==='/api/admin/users')return response([{...user,packages:[]}]);
  if(pathname==='/api/admin/orders')return response([]);
  if(pathname==='/api/admin/overview')return response({serverNow:1,stats:{},students:[],recentOrders:[]});
  if(pathname==='/api/admin/settings')return response({ok:true});
  if(pathname==='/api/content')return response({courses:clone(w.COURSES),packages:clone(w.PACKAGES),instructors:[],defaultInstructorId:null});
  if(pathname==='/api/catalog-availability')return response({});
  if(pathname.startsWith('/api/admin/lessons/')){
   const pid=decodeURIComponent(pathname.split('/').pop()),queue=responses.get(pid)||[],next=queue.shift();
   const data=clone(packageRows.get(pid)||rows);
   if(next?.kind==='hold'){next.started=true;await new Promise(resolve=>next.release=resolve);}
   if(next?.kind==='http')return response({error:'Synthetic network service failure'},false);
   if(next?.kind==='invalid')return response({unexpected:true});
   if(next?.kind==='network')throw new Error('Synthetic network interruption');
   if(next?.kind==='timeout'){next.signal=options.signal;return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>{const e=new Error('Aborted');e.name='AbortError';reject(e);},{once:true}));}
   return response(data);
  }
  return response({},false);
 };
 for(const script of w.document.scripts){if(script.type&&script.type!=='text/javascript')continue;const src=script.getAttribute('src');if(src){if(src.startsWith('/'))w.eval(fs.readFileSync(path.join('public',new URL(src,w.location.href).pathname),'utf8'));}else if(script.textContent.trim())w.eval(script.textContent);}
 await until(()=>w.APP?.live&&w.APP.isAdmin()&&w.document.querySelector('[data-at="content"]'),'Authenticated #admin overview did not boot');
 await pause();return {dom,w,calls,errors,
  setRows:(pid,value)=>packageRows.set(pid,value),
  queue(pid,kind){const state={kind};if(!responses.has(pid))responses.set(pid,[]);responses.get(pid).push(state);return state;}
 };
}
for(const rows of [[],[{chapter:0,title:'Published local lesson',title_en:'Published local lesson',vimeo:'100001',duration:'01:00',free:true,files:[],quiz:[]}]]){
 test('ordinary #admin content tab exits loading with '+rows.length+' saved lessons',async()=>{
  const f=await fixture(rows);try{
   const {w}=f;assert.equal(w.__vidPk,undefined,'No deep link or prior selection may seed this scenario');
   w.document.querySelector('[data-at="content"]').click();
   await until(()=>w.APP.adminLessonsReady('grcp-full'),'Default content request did not finish');await pause();
   assert.equal(w.LESSONS['grcp-full'].length,rows.length,'Server response reached the cache');
   assert.ok(w.document.getElementById('admPk'),'Loaded default package must replace the loading placeholder without another click');
   assert.equal(w.document.getElementById('admPk').value,'grcp-full');
   assert.equal(f.calls.filter(call=>call.path==='/api/admin/lessons/grcp-full').length,1);
   assert.deepEqual(f.errors,[]);
  }finally{f.dom.window.close();}
 });
}
test('ordinary #admin learning tab exits loading with its implicit package',async()=>{
 const f=await fixture();try{
  const {w}=f;assert.equal(w.__learningPk,undefined);
  w.document.querySelector('[data-at="learning"]').click();
  const pid=w.document.getElementById('learningPackage').value;
  const source=w.APP.pack(pid).sourcePackageId||pid;
  await until(()=>w.APP.adminLessonsReady(source),'Default learning request did not finish');await pause();
  assert.ok(w.document.getElementById('learningAddCard'),'Loaded learning source must replace the loading placeholder without another click');
  assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});

const sampleRows=[{chapter:0,title:'Published local lesson',title_en:'Published local lesson',vimeo:'100001',duration:'01:00',free:true,files:[],quiz:[]}];
test('cached identical lesson rows still transition to an editable ready state',async()=>{
 const f=await fixture(sampleRows);try{
  const {w}=f;w.LESSONS['grcp-full']=[{ch:0,t:'Published local lesson',t_en:'Published local lesson',dur:'01:00',vimeo:'100001',free:true,files:[],quiz:[],notes:'',notes_en:''}];
  const before=JSON.stringify(w.LESSONS['grcp-full']);w.document.querySelector('[data-at="content"]').click();
  await until(()=>w.APP.adminLessonsReady('grcp-full'),'Same-row request did not finish');await pause();
  assert.equal(JSON.stringify(w.LESSONS['grcp-full']),before);assert.ok(w.document.getElementById('admPk'));
 }finally{f.dom.window.close();}
});
for(const kind of ['http','invalid','network','timeout'])test(kind+' failure is finite, honest, non-looping and explicitly retryable',async()=>{
 const f=await fixture(sampleRows,{fastTimeout:kind==='timeout'});try{
  const {w}=f,failed=f.queue('grcp-full',kind);w.document.querySelector('[data-at="content"]').click();
  await until(()=>w.document.querySelector('[data-admin-lesson-retry]'),'Failed read stayed on its loading spinner');
  assert.equal(w.APP.adminLessonsReady('grcp-full'),false);assert.equal(Object.hasOwn(w.LESSONS,'grcp-full'),false);
  assert.ok(w.APP.adminLessonError('grcp-full'));assert.equal(w.document.querySelector('[role="alert"]').textContent.includes('جارٍ تحميل'),false);
  if(kind==='timeout')assert.ok(failed.signal?.aborted,'Admin read needs a bounded abortable timeout');
  w.APP.render();w.APP.render();w.dispatchEvent(new w.Event('focus'));await pause();
  assert.equal(f.calls.filter(call=>call.path==='/api/admin/lessons/grcp-full').length,1,'Rendering an error never retries automatically');
  w.document.querySelector('[data-admin-lesson-retry]').click();
  await until(()=>w.document.getElementById('admPk'),'Explicit retry did not recover');
  assert.equal(w.APP.adminLessonsReady('grcp-full'),true);assert.equal(w.APP.adminLessonError('grcp-full'),'');
  assert.equal(f.calls.filter(call=>call.path==='/api/admin/lessons/grcp-full').length,2);assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});
test('a late different-package response cannot redraw the current loading target',async()=>{
 const f=await fixture(sampleRows);try{
  const {w}=f,one=f.queue('pmp-full','hold'),two=f.queue('rmp-full','hold');
  f.setRows('rmp-full',[{...sampleRows[0],title:'Requested RMP lesson'}]);
  w.APP.go('admin/content/pmp-full');await until(()=>one.started,'First package not requested');
  w.APP.go('admin/content/rmp-full');await until(()=>two.started,'Second package not requested');
  one.release();await pause();assert.equal(w.document.querySelector('[data-admin-lesson-load]').dataset.adminLessonLoad,'rmp-full');assert.equal(w.document.getElementById('admPk'),null);
  two.release();await until(()=>w.document.getElementById('admPk'),'Current package did not become ready');
  assert.equal(w.document.getElementById('admPk').value,'rmp-full');assert.equal(w.document.querySelector('[data-lt="0"]').value,'Requested RMP lesson');
 }finally{f.dom.window.close();}
});
test('a source request settles the current learning package after shared-source selection changes',async()=>{
 const f=await fixture(sampleRows);try{
  const {w}=f,pending=f.queue('pmp-full','hold');
  w.PACKAGES.push({...clone(w.APP.pack('pmp-full')),id:'pmp-shared-local',sourcePackageId:'pmp-full',ar:'Shared local package'});
  w.document.querySelector('[data-at="learning"]').click();await until(()=>pending.started,'Learning source not requested');
  const picker=w.document.getElementById('learningPackage');picker.value='pmp-shared-local';picker.dispatchEvent(new w.Event('change',{bubbles:true}));
  pending.release();await until(()=>w.document.getElementById('learningAddCard'),'Shared-source selection remained stuck');
  assert.equal(w.document.getElementById('learningPackage').value,'pmp-shared-local');
  assert.equal(f.calls.filter(call=>call.path==='/api/admin/lessons/pmp-full').length,1);
 }finally{f.dom.window.close();}
});
test('a waiting admin editor may adopt the same source request from a prior route',async()=>{
 const f=await fixture(sampleRows);try{
  const {w}=f,pending=f.queue('pmp-full','hold');w.APP.go('learn/pmp-full');await until(()=>pending.started,'Prior-route read not requested');
  w.APP.go('admin/content/pmp-full');pending.release();await until(()=>w.document.getElementById('admPk'),'Adopted route request left a spinner');
  assert.equal(w.document.getElementById('admPk').value,'pmp-full');assert.equal(f.calls.filter(call=>call.path==='/api/admin/lessons/pmp-full').length,1);
 }finally{f.dom.window.close();}
});
test('a completed loader waits for modal close without disturbing its draft',async()=>{
 const f=await fixture(sampleRows);try{
  const {w}=f,pending=f.queue('grcp-full','hold');w.document.querySelector('[data-at="content"]').click();await until(()=>pending.started,'Modal test read not requested');
  w.APP.modal('<input id="modal-draft" value="Untouched modal draft">');pending.release();await until(()=>w.APP.adminLessonsReady('grcp-full'),'Held modal read did not finish');await pause();
  assert.equal(w.document.getElementById('modal-draft').value,'Untouched modal draft');assert.equal(w.document.getElementById('admPk'),null);
  w.APP.closeModal();await until(()=>w.document.getElementById('admPk'),'Closing the modal did not settle the ready loader');
  assert.equal(f.calls.filter(call=>call.path==='/api/admin/lessons/grcp-full').length,1);
 }finally{f.dom.window.close();}
});
test('a read invalidated by a write provides retry instead of applying stale rows',async()=>{
 const f=await fixture(sampleRows);try{
  const {w}=f,pending=f.queue('grcp-full','hold');w.document.querySelector('[data-at="content"]').click();await until(()=>pending.started,'Invalidation test read not requested');
  await w.APP.api('/admin/settings',{method:'PUT',body:{catalog:[]}});pending.release();
  await until(()=>w.document.querySelector('[data-admin-lesson-retry]'),'Invalidated read left an infinite spinner');
  assert.equal(Object.hasOwn(w.LESSONS,'grcp-full'),false);assert.equal(w.APP.adminLessonsReady('grcp-full'),false);
  w.document.querySelector('[data-admin-lesson-retry]').click();await until(()=>w.document.getElementById('admPk'),'Invalidation retry did not recover');
 }finally{f.dom.window.close();}
});
test('a completed read cannot redraw another tab with unsaved raw input',async()=>{
 const f=await fixture(sampleRows);try{
  const {w}=f,pending=f.queue('grcp-full','hold');w.document.querySelector('[data-at="content"]').click();await until(()=>pending.started,'Draft test read not requested');
  w.document.querySelector('[data-at="cms"]').click();const input=w.document.querySelector('input[data-cms]');input.value='Unsaved CMS draft';input.dispatchEvent(new w.Event('input',{bubbles:true}));
  pending.release();await until(()=>w.APP.adminLessonsReady('grcp-full'),'Background read did not finish');await pause();
  assert.equal(w.document.querySelector('input[data-cms]').value,'Unsaved CMS draft');assert.equal(w.document.getElementById('admPk'),null);
 }finally{f.dom.window.close();}
});
test('a late response after logout cannot restore lessons or admin errors',async()=>{
 const f=await fixture(sampleRows);try{
  const {w}=f,pending=f.queue('grcp-full','hold');w.document.querySelector('[data-at="content"]').click();await until(()=>pending.started,'Actor test read not requested');
  w.document.getElementById('logout').click();pending.release();await pause();
  assert.equal(w.APP.me(),null);assert.equal(w.APP.token,null);assert.equal(Object.hasOwn(w.LESSONS,'grcp-full'),false);assert.equal(w.APP.adminLessonError('grcp-full'),'');
 }finally{f.dom.window.close();}
});
