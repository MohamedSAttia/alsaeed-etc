/** Local-only authoring regression: real admin renderer/bindings and save handler,
 * synthetic data/API, no production accounts or trainee records. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const {JSDOM}=await import(process.env.JSDOM_MODULE||'/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js');
const source=fs.readFileSync('public/index.html','utf8');
const dom=new JSDOM('<main id="app"></main><div id="modal"></div>',{url:'https://local.test/',runScripts:'outside-only'});
const w=dom.window,ctx=dom.getInternalVMContext(),document=w.document;
const clone=x=>JSON.parse(JSON.stringify(x));
const course={id:'pmp',chapters:[{ar:'الفصل الأصلي',en:'Original chapter',custom:{source:'kept'}},'Planning','Unmapped saved chapter']};
const pkg={id:'pmp-local',course:'pmp',ar:'Local fixture'};
const original=[{ch:0,t:'مقدمة البرنامج',t_en:'Introduction',vimeo:'10101',dur:'01:30',free:true,files:[],quiz:[]},{ch:1,t:'Planning phase: scope',vimeo:'10102',dur:'02:00',files:[],quiz:[]},{ch:2,t:'Original unclassified lesson',vimeo:'10103',dur:'03:00',files:[],quiz:[]}];
const progress={lessons:{0:true,2:true},weeks:{1:true},exams:{original:{score:90}}};
const before=JSON.stringify({course,original,progress});
w.__vidPk=pkg.id;w.LESSONS={[pkg.id]:clone(original)};w.PACKAGES=[pkg];
const messages=[],requests=[];let fail='',stored=clone(original),savedChapters=clone(course.chapters);
const api=async(path,options={})=>{
 requests.push({path,...clone(options)});
 if(options.method==='PUT'&&path.includes('course-chapters')){if(fail==='chapters')throw new Error('chapter save failed');savedChapters=clone(options.body.chapters);return {ok:true};}
 if(options.method==='PUT'&&path.includes('/lessons/')){if(fail==='lessons')throw new Error('lesson save failed');stored=clone(options.body);return {ok:true};}
 if(path.includes('/lessons/'))return stored.map(l=>({chapter:l.ch,title:l.t,title_en:l.t_en,duration:l.dur,vimeo:l.vimeo,free:l.free,files:l.files,quiz:l.quiz,notes:l.notes,notes_en:l.notes_en}));
 return {};
};
ctx.esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
ctx.$=s=>document.querySelector(s);ctx.$$=s=>Array.from(document.querySelectorAll(s));
ctx.admTab='content';ctx.fetch=async()=>({ok:false});ctx.confirm=()=>false;
const app={DB:{},adminOverview:{},course:()=>course,pack:()=>pkg,live:true,adminLessonsReady:()=>true,api,toast:s=>messages.push(s),
 modal:(html,bind)=>{document.getElementById('modal').innerHTML=html;bind?.();},closeModal:()=>document.getElementById('modal').innerHTML='',render:()=>render(),go:()=>{}};
ctx.A=()=>app;
w.LessonVideo={storedValue:s=>/^\d+$/.test(s.trim())?s.trim():s.trim()===''?'':null};
w.biTitle=x=>typeof x==='string'?x:x.ar||x.en;
vm.runInContext(fs.readFileSync('public/course-roadmap.js','utf8'),ctx);
const roadmap=w.CourseRoadmap;
function readFunction(name){const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);assert(start>=0);return source.slice(start,end<0?undefined:end);}
vm.runInContext(readFunction('adminTab'),ctx);
const bindStart=source.indexOf('  /* ═══ محرّر الدروس والفيديو ═══ */'),bindEnd=source.indexOf("  const cs2 = $('#cmsSave')",bindStart);
assert(bindStart>=0&&bindEnd>bindStart);
vm.runInContext('function bindAuthoring(){'+source.slice(bindStart,bindEnd)+'}',ctx);
const saveStart=source.indexOf('const lessonSaveQueues = new Map();'),saveEnd=source.indexOf('\nfunction refreshUsers()',saveStart);
vm.runInContext(source.slice(saveStart,saveEnd),ctx);
function render(){document.getElementById('app').innerHTML=ctx.adminTab();ctx.bindAuthoring();}
const $=s=>document.querySelector(s),all=s=>Array.from(document.querySelectorAll(s));
const flatten=nodes=>nodes.flatMap(n=>[n,...flatten(n.children||[])]);
render();
assert.equal(JSON.stringify({course,original,progress}),before,'Rendering does not mutate any original slots, lessons, or progress');
assert.equal(all('[data-chapter-ref^="outline:"]').length,25,'18 headings + five phases + two review children');
assert.deepEqual(all('[data-lt]').map(x=>+x.dataset.lt).sort((a,b)=>a-b),[0,1,2]);
assert.equal(all('[data-delch]').length,0,'Canonical grouping cannot delete an underlying legacy chapter');assert(all('[data-lup],[data-ldown]').every(b=>b.disabled),'PMP reorder cannot reindex stored progress');
assert.equal(all('[data-chapter-ref="chapter:0"]').length,1,'Original saved chapter remains reachable once');
$('#addLesson').onclick();
assert.deepEqual(all('#nlCh option').map(o=>o.value),Array.from(roadmap.chapterChoices(course),x=>x.ref));
assert.equal(course.chapters.length,3,'Opening authoring appends nothing');
$('#nlCh').value='outline:ai';$('#nlT').value='Conflicting Planning phase title';$('#nlV').value='20101';
fail='chapters';await $('#nlSave').onclick();
assert.equal(stored.length,3);assert.equal(savedChapters.length,3);
assert.equal(requests.filter(x=>x.method==='PUT'&&x.path.includes('/lessons/')).length,0,'Failed chapter save never writes a lesson referencing an absent slot');
assert.equal(w.LESSONS[pkg.id].length,4);assert.equal($('#nlSave').disabled,false);
assert.equal(messages.some(x=>x.startsWith('✅')),false,'Failure never reports success');
fail='lessons';await $('#nlSave').onclick();
assert.equal(stored.length,3);assert.equal(savedChapters.length,4);
assert.equal(w.LESSONS[pkg.id].length,4,'Failed retries do not duplicate staged new lesson');
assert.equal(messages.some(x=>x.startsWith('✅')),false);
assert.equal(JSON.stringify(stored),JSON.stringify(original),'Existing persisted lesson positions and chapter IDs unchanged after both failures');
fail='';await $('#nlSave').onclick();
assert.equal(stored.length,4);assert.equal(course.chapters.length,4);
assert.equal(course.chapters[3].outlineKey,'ai');assert.equal(stored[3].ch,3);
assert.equal(flatten(roadmap.learnerGroups(course,stored)).find(n=>n.key==='ai').items[0].i,3,'Explicit key outranks conflicting lesson title');
assert.equal(flatten(roadmap.learnerGroups(course,stored)).find(n=>n.key==='planning').items.some(l=>l.i===3),false);
assert.deepEqual(stored.slice(0,3).map(l=>[l.ch,l.t,l.vimeo]),original.map(l=>[l.ch,l.t,l.vimeo]));
assert.deepEqual(course.chapters[0].custom,{source:'kept'});
assert.equal($('#modal').textContent,'');
// Add directly to a nested phase; exact same choices drive Add Lesson and bulk.
$('[data-addto="outline:closing"]').onclick();assert.equal($('#nlCh').value,'outline:closing');app.closeModal();
$('#bulkVid').onclick();assert.deepEqual(all('#bkCh option').map(o=>o.value),Array.from(roadmap.chapterChoices(course),x=>x.ref));
$('#bkCh').value='outline:closing';$('#bkTxt').value='Closing one, 01:10, 30101\nClosing two, 02:20, 30102';
fail='lessons';await $('#bkGo2').onclick();assert.equal(stored.length,4);assert.equal(w.LESSONS[pkg.id].length,6);
assert.equal($('#bkCh').disabled,true);assert.equal($('#bkTxt').disabled,true,'Failed bulk draft stays visible and locked for exact retry');
fail='';await $('#bkGo2').onclick();assert.equal(stored.length,6);assert.equal(course.chapters.length,5);
assert.equal(course.chapters[4].outlineKey,'closing');assert.deepEqual(stored.slice(4).map(l=>l.ch),[4,4]);
// Real header harvest must retain both stable key and arbitrary chapter metadata.
course.chapters[3].custom={keep:'yes'};render();
$('[data-chname="outline:ai"]').textContent='الذكاء الاصطناعي المخصص';$('[data-chname-en="outline:ai"]').value='Custom AI chapter';
await $('#admSaveVid').onclick();
// #admSaveVid intentionally starts the existing async queue; wait on it.
await vm.runInContext('lessonSaveQueues.get("'+pkg.id+'")',ctx);
assert.equal(savedChapters[3].outlineKey,'ai');assert.deepEqual(savedChapters[3].custom,{keep:'yes'});
assert.equal(roadmap.topics(course).find(t=>t.key==='ai').ar,'الذكاء الاصطناعي المخصص');
assert.equal(roadmap.learnerGroups(course,stored).find(t=>t.key==='ai').en,'Custom AI chapter');
assert.equal(all('[data-chname="outline:ai"]').length,1);
// Invalid headings stop at the event boundary before mutating or saving anything.
const beforeInvalid=JSON.stringify({course,lessons:w.LESSONS[pkg.id]}),requestsBeforeInvalid=requests.length;
$('[data-chname="outline:ai"]').textContent='';$('[data-lt="0"]').value='Unsaved row edit';
$('[data-chname="outline:ai"]').onblur();assert.equal(await $('#admSaveVid').onclick(),false);$('#addLesson').onclick();
assert.equal(requests.length,requestsBeforeInvalid);assert.equal(JSON.stringify({course,lessons:w.LESSONS[pkg.id]}),beforeInvalid);
assert.equal($('#modal').textContent,'');assert.match(messages.at(-1),/اسماً صحيحاً/);render();
// Add Chapter reuses a canonical slot and permits a named custom slot.
$('#addChapter').onclick();$('#ncRef').value='outline:ai';$('#ncRef').onchange();await $('#ncGo').onclick();assert.equal(course.chapters.length,5);
$('#addChapter').onclick();$('#ncRef').value='custom';$('#ncRef').onchange();$('#ncN').value='فصل خاص';$('#ncEn').value='Custom original';await $('#ncGo').onclick();
assert.equal(course.chapters.length,6);assert.equal(course.chapters[5].ar,'فصل خاص');assert.equal(course.chapters[5].outlineKey,undefined);
// Imported unresolved source chapter never makes unrelated edits unsaveable.
w.LESSONS[pkg.id].push({ch:99,t:'Unclassified imported source',vimeo:'40101'});render();
const orphan=$('[data-admin-chapter="source_99"]');assert(orphan);assert.equal(orphan.querySelector('[data-chname]'),null);
assert.equal(orphan.querySelector('[data-lt]').dataset.lt,'6');await $('#admSaveVid').onclick();await vm.runInContext('lessonSaveQueues.get("'+pkg.id+'")',ctx);assert.equal(stored[6].ch,99);
// A full saved chapter array rejects a new label override without partial edits.
const chaptersBeforeCapacity=course.chapters;course.chapters=Array.from({length:100},(_,i)=>'Saved '+i);render();
const capacityBefore=JSON.stringify({course,lessons:w.LESSONS[pkg.id]}),capacityRequests=requests.length;
$('[data-chname="outline:ai"]').textContent='New AI heading';$('[data-lt="0"]').value='Should stay unsaved';
assert.equal(await $('#admSaveVid').onclick(),false);assert.equal(JSON.stringify({course,lessons:w.LESSONS[pkg.id]}),capacityBefore);assert.equal(requests.length,capacityRequests);
assert.match(messages.at(-1),/الحد الأقصى/);course.chapters=chaptersBeforeCapacity;render();
// Every canonical destination is authorable, with stable slots on repeat.
const independent={id:'pmp',chapters:clone(course.chapters.slice(0,3))};const existing=JSON.stringify(independent.chapters);
for(const key of ['ai','final-reviews','summaries','review','workshops','exam-eve','exam-guidelines','initiating','planning','executing','monitoring','closing']){
 const first=roadmap.ensureChapter(independent,'outline:'+key);assert.equal(roadmap.ensureChapter(independent,'outline:'+key),first);
 const tree=roadmap.learnerGroups(independent,[{ch:first,t:'Scope overview',vimeo:'999'}]);assert.equal(flatten(tree).find(g=>g.key===key).items.length,1,key);
}
assert.equal(JSON.stringify(independent.chapters.slice(0,3)),existing);
const other={id:'rmp',chapters:[{ar:'مخصص',en:'Custom',extra:7},'Second']};
assert.deepEqual(Array.from(roadmap.chapterChoices(other),x=>x.ref),['chapter:0','chapter:1']);assert.deepEqual(Array.from(roadmap.adminGroups(other,[{ch:'0',t:'String chapter'},{ch:99,t:'Orphan'}]).flatMap(g=>g.items),l=>l.i),[0,1]);roadmap.renameChapter(other,'chapter:0','تعديل','Edited');assert.equal(other.chapters[0].extra,7);
assert.deepEqual(progress,{lessons:{0:true,2:true},weeks:{1:true},exams:{original:{score:90}}});
dom.window.close();
console.log('PASS: real admin canonical headings/selectors/add/bulk/rename; stable chapters/indices/metadata; chapter-first failure and retry; unknown source; non-PMP unchanged.');

// Evaluate the actual bounded course-chapters endpoint against an in-memory store.
const server=fs.readFileSync('server.js','utf8');const routeStart=server.indexOf('function validCourseChapterKeys(');const routeEnd=server.indexOf("app.put('/api/admin/content'",routeStart);
let handler,writes=0,courses=JSON.stringify([{id:'pmp',chapters:['Original']},{id:'rmp',chapters:['RMP']}]);
vm.runInNewContext(server.slice(routeStart,routeEnd),{app:{put:(_path,...handlers)=>handler=handlers.at(-1)},auth(){},admin(){},setting:()=>courses,db:{prepare:()=>({run:value=>{writes++;courses=value;}})}});
function put(chapters,course='pmp'){let status=200,body;handler({params:{course},body:{chapters}},{status(value){status=value;return this;},json(value){body=value;return this;}});return {status,body};}
const payload=['Original',{ar:'ذكاء',en:'AI',outlineKey:'ai',metadata:{owner:'kept'}}];assert.equal(put(payload).status,200);assert.deepEqual(JSON.parse(courses)[0].chapters,payload);
const saved=courses;for(const chapters of [[...payload,payload[1]],[{ar:'X',en:'Y',outlineKey:'x<script>'}],[{ar:'X',en:'Y',outlineKey:'A'}],[{ar:'X',en:'Y',outlineKey:''}],[{ar:'X',en:'Y',outlineKey:7}],Array(101).fill('x')]){assert.equal(put(chapters).status,400);assert.equal(courses,saved);}
assert.equal(put([{ar:'RMP renamed',en:'RMP',other:{kept:true}}],'rmp').status,200);assert.equal(put([{ar:'RMP',en:'RMP',outlineKey:'ai'}],'rmp').status,400);
assert.equal(put(['x'],'missing').status,404);assert.equal(writes,2);
console.log('PASS: real chapter API preserves metadata, validates bounded PMP keys, rejects duplicates/invalid payloads without writes, retains other courses.');
