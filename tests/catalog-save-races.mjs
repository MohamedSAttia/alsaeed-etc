/** Executes the actual save queue with local deferred APIs, never a production write. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('public/index.html','utf8');
const start=html.indexOf('const lessonSaveQueues = new Map();'),end=html.indexOf('\nfunction refreshUsers()',start);
const clone=x=>JSON.parse(JSON.stringify(x));
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const course={id:'pmp',chapters:[{ar:'مقدمة',en:'Introduction',outlineKey:'intro'}]},pkg={id:'pmp-local',course:'pmp'};
 const rows=[{ch:0,t:'Original',vimeo:'101',dur:'01:00',free:false,files:[],quiz:[]}];
 const state={token:'admin-a',actor:'a',role:'admin',revision:0,rendered:0,locks:0,messages:[],calls:[],holds:new Map(),stored:clone(rows)};
 const app={live:true,adminLessonsReady:()=>true,pack:()=>pkg,course:()=>course,get token(){return state.token},me:()=>({id:state.actor}),isAdmin:()=>state.role==='admin',get editorRevision(){return state.revision},route:'admin/content/pmp-local',
  beginCatalogWrite:()=>state.locks++,endCatalogWrite:()=>state.locks--,rememberLessons(){},toast:m=>state.messages.push(m),render:()=>state.rendered++,
  api:async(path,options={})=>{
   const method=options.method||'GET';state.calls.push({path,method,token:state.token,body:clone(options.body||null)});
   const hold=state.holds.get(method+' '+path);if(hold){state.holds.delete(method+' '+path);hold.started=true;await new Promise(r=>hold.release=r);}
   if(method==='PUT'&&path.includes('/lessons/'))state.stored=clone(options.body);
   if(method==='GET')return state.stored.map(l=>({chapter:l.ch,title:l.t,title_en:l.t_en,duration:l.dur,vimeo:l.vimeo,free:l.free,files:l.files,quiz:l.quiz}));
   return {ok:true};
  }};
 const w={__vidPk:pkg.id,LESSONS:{[pkg.id]:rows}},ctx=vm.createContext({window:w,A:()=>app,localStorage:{setItem(){}},fetch:async()=>({ok:false})});
 vm.runInContext(html.slice(start,end),ctx);
 return {state,w,save:()=>ctx.saveLessons(true),hold(method,path){const h={};state.holds.set(method+' '+path,h);return h;}};
}
{
 const f=fixture(),read=f.hold('GET','/admin/lessons/pmp-local');const pending=f.save();
 for(let n=0;n<20&&!read.started;n++)await tick();assert(read.started);
 f.w.LESSONS['pmp-local'][0].t='New unsaved edit';f.state.revision++;read.release();await pending;
 assert.equal(f.w.LESSONS['pmp-local'][0].t,'New unsaved edit');assert.equal(f.state.rendered,0);assert.equal(f.state.locks,0);
}
{
 const f=fixture(),hold=f.hold('PUT','/admin/course-chapters/pmp');const first=f.save();
 for(let n=0;n<20&&!hold.started;n++)await tick();assert(hold.started);
 f.w.LESSONS['pmp-local'][0].t='Queued edit';const second=f.save();
 f.state.token='learner-b';f.state.actor='b';f.state.role='student';f.w.LESSONS={};hold.release();
 assert.equal(await first,false);assert.equal(await second,false);
 assert.equal(f.state.calls.length,1,'No later write or reread uses the replacement actor');assert.equal(f.state.messages.length,0);assert.equal(f.state.locks,0);
}
{
 const f=fixture(),read=f.hold('GET','/admin/lessons/pmp-local');const first=f.save();
 for(let n=0;n<20&&!read.started;n++)await tick();assert(read.started);
 f.w.LESSONS['pmp-local'][0].t='New queued snapshot';const second=f.save();read.release();
 assert.equal(await first,true);assert.equal(await second,true);assert.equal(f.state.stored[0].t,'New queued snapshot');
 assert.equal(f.w.LESSONS['pmp-local'][0].t,'New queued snapshot');assert.equal(f.state.rendered,1);assert.equal(f.state.locks,0);
}
console.log('PASS: late save reread preserves new draft; queued saves stop on actor change; serialized newer snapshot wins; locks always released.');
