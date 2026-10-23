import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {JSDOM} from 'jsdom';import {mergeProgressRecords} from '../progress-records.js';
const clone=x=>JSON.parse(JSON.stringify(x)),html=fs.readFileSync('public/index.html','utf8');const pause=()=>new Promise(r=>setTimeout(r,20));async function until(fn,label){for(let i=0;i<150;i++){if(fn())return;await pause()}assert.fail(label)}
const server={a:{lessons:{0:true},exams:{full:{score:69,passed:false,at:10}},activities:{'ref:reading':true},referenceActivityUpdated:{reading:10},_serverRevision:100},b:{lessons:{},exams:{},activities:{},_serverRevision:0}};
function snapshot(id){const s=clone(server[id]);return {...s,_summary:{progress:Object.values(s.lessons).filter(Boolean).length*50,lessonDone:Object.values(s.lessons).filter(Boolean).length,lessonTotal:2,avgExam:s.exams.full?.score??null}}}
async function client(id,cache){const dom=new JSDOM(html,{url:'https://synthetic.invalid/#learn/pmp-full',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,errors=[];let offline=false,hold=null,held=false,release,puts=0;
 w.localStorage.setItem('alsaeed_token','token-'+id);if(cache)w.localStorage.setItem('alsaeed_platform_v15',JSON.stringify(cache));w.sessionStorage.setItem('alsaeed_auth_prompt_v1','1');w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.addEventListener('error',e=>errors.push(e.message));
 const response=(v,ok=true)=>({ok,status:ok?200:500,json:async()=>clone(v)});
 w.fetch=async(url,opts={})=>{const p=new URL(String(url),w.location.href).pathname,method=opts.method||'GET',who=(opts.headers?.Authorization||'Bearer token-'+id).split('token-')[1]||id;
 if(p==='/api/health')return response({ok:true});if(p==='/api/me')return response({user:{id,name:id,email:id+'@test.invalid',role:'student'},packages:[{package_id:'pmp-full',created:1}]});
 if(p==='/api/content')return response({cms:{},courses:clone(w.COURSES),packages:clone(w.PACKAGES),instructors:[]});
 if(p==='/api/catalog-availability')return response({'pmp-full':{videos:2,questions:0}});
 if(p==='/api/lessons/pmp-full')return response([0,1].map(i=>({chapter:0,title:'Video'+i,title_en:'Video'+i,vimeo:String(100+i),duration:'01:00',files:[],quiz:[]})));
 if(p==='/api/progress/pmp-full'){
  if(method==='PUT'){puts++;if(offline)return response({},false);const body=JSON.parse(opts.body),merged=mergeProgressRecords(server[who],body,body._serverRevision!==server[who]._serverRevision);server[who]={...merged,_serverRevision:server[who]._serverRevision+1};return response({ok:true,data:snapshot(who)});}
  const snap=snapshot(who);if(hold){hold=null;held=true;await new Promise(r=>release=r)}return response(snap);
 }return response({},false);};
 for(const script of w.document.scripts){if(script.type&&script.type!=='text/javascript')continue;const src=script.getAttribute('src');let code=src?(src.startsWith('/')?fs.readFileSync(path.join('public',new URL(src,w.location.href).pathname),'utf8'):''):script.textContent;if(code)w.eval(code.replace('get token() { return API.token; },','get token() { return API.token; }, __switch(id,token){DB.session=id;API.token=token;API.progressOwner=id;}, __offline(value){API.live=!value;},'));}
 await until(()=>w.APP?.prog('pmp-full')._serverRevision!==undefined&&w.LESSONS?.['pmp-full']?.length===2,'hydration failed');await pause();
 return {w,dom,errors,cache:()=>JSON.parse(w.localStorage.getItem('alsaeed_platform_v15')),offline:value=>offline=value,hold(){hold=true;held=false},held:()=>held,release:()=>release?.(),puts:()=>puts};
}
const one=await client('a'),two=await client('a');
try{
 assert.equal(one.w.APP.progressView('pmp-full').videoPercent,50);assert.equal(two.w.APP.prog('pmp-full').exams.full.score,69);assert.equal(two.w.APP.prog('pmp-full').activities['ref:reading'],true);
 const third=await client('a',{users:[{id:'a',name:'a',packages:[{id:'pmp-full'}]}],session:'a',progress:{a:{'pmp-full':{lessons:{0:false},exams:{full:{score:1,at:1}},_serverRevision:0}}}});assert.equal(third.w.APP.prog('pmp-full').exams.full.score,69);assert.equal(third.w.APP.progressView('pmp-full').videoPercent,50);third.dom.window.close();
 const A=one.w.APP;one.hold();const staleGet=A.loadProgressFor('pmp-full',true);await until(one.held,'GET not held');A.prog('pmp-full').lessons[1]=true;A.save();await A.flushProgress('pmp-full');const revision=A.prog('pmp-full')._serverRevision;one.release();await staleGet;assert.equal(A.prog('pmp-full').lessons[1],true);assert.equal(A.prog('pmp-full')._serverRevision,revision,'late old GET cannot roll back accepted save');
 await two.w.APP.loadProgressFor('pmp-full',true);assert.equal(two.w.APP.progressView('pmp-full').videoPercent,100);
 one.offline(true);A.prog('pmp-full').exams.chapter={score:80,at:500};A.save();assert.equal(await A.flushProgress('pmp-full'),false);await A.loadProgressFor('pmp-full',true);assert.equal(A.prog('pmp-full').exams.chapter.score,80);assert.equal(A.progressView('pmp-full').pending,true);assert.match(A.progressSummary('pmp-full'),/لم تتم المزامنة|Not synced/);assert.equal(server.a.exams.chapter,undefined);A.__offline(true);assert.equal(A.progressView('pmp-full').pending,true,'offline session still discloses pending queue');A.__offline(false);
 one.offline(false);await A.hydrateProgress(true);assert.equal(server.a.exams.chapter.score,80);assert.equal(A.progressView('pmp-full').pending,false);
 // Delayed old-account read cannot populate a newly selected account.
 one.hold();const ownerGet=A.loadProgressFor('pmp-full',true);await until(one.held,'owner GET not held');A.DB.users.push({id:'b',name:'b',packages:[{id:'pmp-full'}]});A.__switch('b','token-b');one.release();await ownerGet;assert.equal(A.prog('pmp-full').exams.full,undefined);
 await A.loadProgressFor('pmp-full',true);assert.equal(A.progressView('pmp-full').examCount,0);assert.equal(A.progressView('pmp-full').videoPercent,0);
 const quiz={id:'synthetic-quiz',course:'pmp',quizzes:2,activities:1};one.w.PACKAGES.push(quiz);one.w.LESSONS[quiz.id]=[];A.prog(quiz.id).activities=Object.fromEntries(Array.from({length:100},(_,i)=>['ref:'+i,true]));assert.equal(A.pct(quiz.id),0,'supplemental refs cannot inflate core completion');
 assert.deepEqual(one.errors,[]);assert.deepEqual(two.errors,[]);
}finally{one.dom.window.close();two.dom.window.close()}
console.log('PASS actual SPA fresh-device hydration, server69/video50, late GET vs PUT, pending offline, owner switch, ref denominator');
