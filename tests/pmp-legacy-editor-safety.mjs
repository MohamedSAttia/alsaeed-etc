/** Real standalone editor regression, using only local synthetic DOM/API fixtures.
 * Run: node tests/pmp-legacy-editor-safety.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const {JSDOM}=await import(process.env.JSDOM_MODULE||'/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js');
const dom=new JSDOM('<div id="root"></div>',{url:'https://local.test/content-admin.html',runScripts:'outside-only'});
const ctx=dom.getInternalVMContext(),w=dom.window,doc=w.document;
const clone=x=>JSON.parse(JSON.stringify(x));
const requests=[],messages=[],timers=[];
ctx.alert=x=>messages.push(String(x));ctx.confirm=()=>false;
ctx.MutationObserver=class{observe(){}};
ctx.setTimeout=fn=>{timers.push(fn);return timers.length};
ctx.fetch=()=>{throw new Error('Network is forbidden in this regression')};
for(const file of ['admin-v15-1.js','admin-v15-2.js','admin-v15-3.js','admin-v15-4.js','admin-v15-5.js','admin-v15-6.js','admin-v15-7.js','admin-v19.js']){
  vm.runInContext(fs.readFileSync('public/'+file,'utf8'),ctx,{filename:file});
}
const packages=[{id:'pmp-full',course:'pmp',type:'full',ar:'PMP full'},{id:'pmp-special /copy',course:'pmp',type:'self',ar:'PMP extra'},{id:'rmp-full',course:'rmp',type:'full',ar:'RMP'}];
const pmp={id:'pmp',ar:'PMP',en:'PMP',chapters:[{ar:'الذكاء الاصطناعي',en:'AI',outlineKey:'ai',outlineOrder:4,custom:{source:'keep'}},'Original chapter']};
const rmp={id:'rmp',ar:'RMP',chapters:[{ar:'فصل المخاطر',en:'Risk chapter'}]};
const rmpLessons=[{chapter:0,title:'RMP lesson',title_en:'Risk lesson',vimeo:'1234',duration:'01:00'}];
let latest={courses:clone([pmp,rmp])},failRead=false,pendingLesson=null;
ctx.request=async(path,options={})=>{
  requests.push({path,...clone(options)});
  if(path==='/api/content'){
    if(failRead)throw new Error('Catalog unavailable');
    return clone(latest);
  }
  if(path==='/api/admin/content'&&options.method==='PUT'){latest={...latest,courses:clone(options.body.courses)};return {ok:true};}
  if(path==='/api/admin-package-summary')return clone(packages);
  if(path==='/api/admin/lessons/rmp-full'&&!options.method){if(pendingLesson)return pendingLesson;return clone(rmpLessons);}
  if(options.method==='PUT')return {ok:true};
  throw new Error('Unexpected request '+path);
};
vm.runInContext('PACKAGES='+JSON.stringify(packages)+';CONTENT='+JSON.stringify({courses:[pmp,rmp],systems:[],promos:[]})+';CURRENT="pmp-full";TAB="lessons";',ctx);
const $=s=>doc.querySelector(s);
const flush=async()=>{const pending=timers.splice(0);for(const fn of pending)await fn();await Promise.resolve();};
ctx.draw();
assert.equal($('#pmpUnifiedEditor').getAttribute('href'),'/#admin/content/pmp-full');
assert.equal($('#lessonSave'),null);assert.equal($('#chapterAdd'),null);assert.equal($('#lessonWorkspace'),null);
assert.equal(requests.length,0,'Opening legacy PMP studio performs no lesson read/write');
$('#lessonPkg').value='pmp-special /copy';$('#lessonPkg').onchange();
assert.equal($('#pmpUnifiedEditor').getAttribute('href'),'/#admin/content/pmp-special%20%2Fcopy','Existing package ID is safely encoded');
// Other courses retain the existing editor and persistence endpoints.
$('#lessonPkg').value='rmp-full';$('#lessonPkg').onchange();await flush();
assert($('#lessonSave'));assert.equal($('#pmpUnifiedEditor'),null);assert.equal(doc.querySelectorAll('[data-li]').length,1);
$('[data-title]').value='Edited RMP lesson';await $('#lessonSave').onclick();
assert.equal(requests.find(x=>x.path==='/api/admin/lessons/rmp-full'&&x.method==='PUT').body[0].title,'Edited RMP lesson');
assert(requests.some(x=>x.path.endsWith('/packages/rmp-full')&&x.method==='PUT'&&x.body._chapters));
const staleSave=$('#lessonSave').onclick;
$('#lessonPkg').value='pmp-full';await $('#lessonPkg').onchange();
assert($('#pmpUnifiedEditor'));assert.equal($('#lessonSave'),null);
const writesBefore=requests.filter(x=>x.method==='PUT').length;
await staleSave();
assert.equal(requests.filter(x=>x.method==='PUT').length,writesBefore,'Stale legacy save handler cannot write PMP');
assert(messages.some(x=>x.includes('محرر محتوى PMP')));
assert.equal(requests.filter(x=>x.path.includes('/lessons/pmp')).length,0,'No PMP lessons go through the legacy store');
// A slow other-course load cannot repopulate the PMP view with destructive controls.
let resolveLoad;pendingLesson=new Promise(resolve=>resolveLoad=resolve);
$('#lessonPkg').value='rmp-full';$('#lessonPkg').onchange();
const delayed=timers.splice(0).map(fn=>fn());
$('#lessonPkg').value='pmp-full';await $('#lessonPkg').onchange();
resolveLoad(clone(rmpLessons));await Promise.all(delayed);pendingLesson=null;
assert($('#pmpUnifiedEditor'));assert.equal($('#lessonWorkspace'),null);
// Course details never expose the destructive multiline PMP chapter fields.
ctx.openCourse(clone(pmp));
assert.equal($('#cchap'),null);assert.equal($('#cchapen'),null);
assert.equal($('.modal a').getAttribute('href'),'/#admin/content/pmp-full');
$('#car').value='Renamed PMP course';
latest.courses[0].chapters[0].outlineOrder=8;
latest.courses[0].chapters.push({ar:'فصل جديد',en:'New saved chapter',custom:{revision:2}});
latest.courses[0].futureCourseMetadata={keep:true};
const expectedChapters=clone(latest.courses[0].chapters);
await $('#saveCourse').onclick();
assert.equal(latest.courses[0].ar,'Renamed PMP course');
assert.deepEqual(latest.courses[0].chapters,expectedChapters,'PMP details save retains the latest complete chapter metadata');
assert.deepEqual(latest.courses[0].futureCourseMetadata,{keep:true});
// Saving another course refreshes all untouched records, so old CONTENT cannot
// restore an obsolete PMP outline. Non-PMP chapter editing still works.
const staleRmp=clone(rmp);latest.courses[0].chapters[0].outlineOrder=12;
ctx.openCourse(staleRmp);assert($('#cchap'));$('#cchap').value='فصل مخاطر معدل';$('#cchapen').value='Edited risk chapter';
const latestPmp=clone(latest.courses[0]);await $('#saveCourse').onclick();
assert.deepEqual(latest.courses[0],latestPmp);
assert.deepEqual(latest.courses[1].chapters,[{ar:'فصل مخاطر معدل',en:'Edited risk chapter'}]);
// Failed freshness check leaves the form open and never falls back to stale data.
ctx.openCourse(clone(pmp));$('#car').value='Should not persist';failRead=true;
const beforeFailure=clone(latest),writeCount=requests.filter(x=>x.method==='PUT').length;
await $('#saveCourse').onclick();
assert.deepEqual(latest,beforeFailure);assert.equal(requests.filter(x=>x.method==='PUT').length,writeCount);
assert($('#saveCourse'));assert.equal($('#saveCourse').disabled,false);assert(messages.includes('Catalog unavailable'));
// Old panel/session credentials are never copied into the SPA session.
assert.equal(w.localStorage.length,0);
const shell=fs.readFileSync('public/content-admin.html','utf8');
assert.match(shell,/admin-v15-2\.js\?v=20261018-unified-pmp/);
assert.match(shell,/admin-v19\.js\?v=20261018-unified-pmp/);
const server=fs.readFileSync('server.js','utf8');
assert(server.indexOf('app.use(express.static(')<server.indexOf("app.get('*'"),'Standalone shell remains a real static route');
dom.window.close();
console.log('PASS: legacy PMP content routes to unified editor; no legacy PMP reads/writes or slot reindexing; latest chapter metadata preserved through any course save; non-PMP editor retained; failures safe; assets cache-busted.');
