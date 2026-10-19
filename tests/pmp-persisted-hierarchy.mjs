import { chapterSlotFloor, validChapterAllocation } from '../curriculum-slots.js';
/** Synthetic, local-only hierarchy regression. Run: node tests/pmp-persisted-hierarchy.mjs.
 * Evaluates the actual roadmap and both catalog write handlers without accounts, network or database access. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const box={window:{}};
vm.runInNewContext(fs.readFileSync('public/course-roadmap.js','utf8'),box);
const r=box.window.CourseRoadmap,clone=value=>JSON.parse(JSON.stringify(value));
const flat=nodes=>Array.from(nodes).flatMap(node=>[node,...flat(node.children||[])]);
const node=(c,key)=>flat(r.topics(c)).find(item=>item.key===key);
const keys=nodes=>Array.from(nodes,item=>item.key);
const frozen=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(frozen);}return value;};
const roots=['intro','framework','agile','predictive','hybrid','people','process','business','value','principles','lifecycles','ai','final-reviews','workshops','exam-eve','exam-guidelines'];
const defaults={id:'pmp',chapters:[]};
assert.deepEqual(keys(r.topics(defaults)),roots);
assert.deepEqual(keys(node(defaults,'intro').children),['exam','journey']);
assert.equal(flat(r.topics(defaults)).length,25);
const defaultOverrides={id:'pmp',chapters:[{ar:'هيكل محفوظ',en:'Saved exam',outlineKey:'exam'}]};
assert.equal(node(defaultOverrides,'exam').parentKey,'intro','An existing title override without parent follows the new default');
assert.equal(node(defaultOverrides,'exam').ar,'هيكل محفوظ');

let course={id:'pmp',chapters:['Legacy source',{ar:'فصل مخصص',en:'Custom source',metadata:{keep:1}},{ar:'اختبار مخصص',en:'Named exam',outlineKey:'exam',metadata:{keep:2}}]};
const lessons=[
 {id:'synthetic-0',ch:0,t:'Planning phase: scope',vimeo:'100001',files:[{id:'file-0'}],quiz:[{q:'Question'}],notes:'Keep'},
 {id:'synthetic-1',ch:1,t:'PMI Certifications',vimeo:'100002',notes_en:'Keep English'},
 {id:'synthetic-2',ch:2,t:'Conflicting AI title',vimeo:'100003'},
 {id:'synthetic-3',ch:0,t:'PMP Exam Structure and Question Types',vimeo:'100004'}
];
const progress={lessons:{0:true,2:true},weeks:{4:true},exams:{exam:{score:91}}};
const originalLessons=JSON.stringify(lessons),originalProgress=JSON.stringify(progress),initialSlots=clone(course.chapters);
frozen(lessons);frozen(progress);
function check(label){
 const before=JSON.stringify(course),topics=r.topics(course),published=flat(topics),learner=flat(r.learnerGroups(course,lessons)),admin=Array.from(r.adminGroups(course,lessons));
 assert.equal(new Set(keys(published)).size,published.length,label+': unique topics');
 const expected=keys(published);
 for(const projection of [learner,admin]){
  assert.equal(new Set(keys(projection)).size,projection.length,label+': no hidden source duplicates');
  assert.deepEqual(keys(projection.filter(n=>expected.includes(n.key))),expected,label+': public/learner/admin hierarchy order parity');
  const records=projection.flatMap(n=>Array.from(n.items));
  assert.deepEqual(records.map(l=>l.i).sort((a,b)=>a-b),lessons.map((_,i)=>i),label+': each original index once');
  for(const item of records){const {i,...record}=item;assert.equal(JSON.stringify(record),JSON.stringify(lessons[i]),label+': intact lesson record');}
 }
 assert.deepEqual(Array.from(r.videoOrder(course,lessons)).sort((a,b)=>a-b),[0,1,2,3]);
 assert.equal(JSON.stringify(course),before,label+': read-only projections');
 assert.equal(JSON.stringify(lessons),originalLessons);assert.equal(JSON.stringify(progress),originalProgress);
 for(let i=0;i<initialSlots.length;i++){
  const initial=initialSlots[i],current=course.chapters[i];
  if(typeof initial==='string')assert.equal(typeof current==='string'?current:current.ar,initial,label+': original string slot retained');
  else assert.deepEqual(current.metadata,initial.metadata,label+': original object metadata retained');
 }
}
function reload(){course=clone(course);check('JSON reload');}
check('Initial');
assert.equal(r.reparentChapter(course,'outline:exam','outline:framework'),true);reload();
assert.equal(node(course,'exam').parentKey,'framework');assert.equal(course.chapters[2].outlineKey,'exam');assert.equal(course.chapters[2].outlineParent,'framework');
r.renameChapter(course,'outline:exam','هيكل مُسمى','Renamed structure');reload();
assert.equal(course.chapters[2].en,'Renamed structure');
assert.equal(r.reparentChapter(course,'chapter:1','outline:intro'),true);reload();
assert.equal(course.chapters[1].outlineParent,'intro');assert.equal(node(course,'source_1').parentKey,'intro');
assert.equal(r.reparentChapter(course,'outline:planning','outline:framework'),true);reload();
assert.deepEqual(Array.from(flat(r.learnerGroups(course,lessons)).find(n=>n.key==='planning').items,l=>l.i),[0],'Reparented phase keeps heuristic-routed legacy lesson');
assert.equal(r.reparentChapter(course,'outline:exam',null),true);reload();
assert.equal(course.chapters[2].outlineParent,null);assert(r.topics(course).some(n=>n.key==='exam'));
assert.equal(r.reparentChapter(course,'outline:exam',''),false,'Explicit root supports empty select value');
assert.equal(r.reparentChapter(course,'outline:exam','outline:intro'),true);reload();
const examPosition=keys(node(course,'intro').children).indexOf('exam');
assert.equal(r.moveChapter(course,'outline:exam',-1),true);reload();
assert.equal(keys(node(course,'intro').children).indexOf('exam'),examPosition-1);
const stableIndex=r.ensureChapter(course,'outline:exam');assert.equal(stableIndex,2);
assert.equal(r.reparentChapter(course,'chapter:0','outline:hybrid'),true);reload();
assert.equal(typeof course.chapters[0],'object');assert.equal(course.chapters[0].outlineParent,'hybrid');
assert.equal(r.reparentChapter(course,'outline:final-reviews','outline:intro'),true);reload();
assert.equal(node(course,'summaries').parentKey,'final-reviews');
assert.equal(r.reparentChapter(course,'outline:intro','outline:framework'),true);reload();
const eligible=r.parentChoices(course,'outline:intro');
for(const child of flat([node(course,'intro')]))assert(!eligible.some(option=>option.key===child.key),'Parent choices exclude self/descendants');
assert(r.parentChoices(course,'outline:exam').some(option=>option.key==='intro'&&option.selected),'Nested current parent remains selectable');
assert.equal(r.chapterChoices(course).find(ch=>ch.key==='source_1').parentRef,'outline:intro');
for(const [ref,parent] of [['outline:framework','outline:exam'],['outline:intro','outline:intro'],['outline:exam','outline:missing']]){
 const before=JSON.stringify(course);assert.throws(()=>r.reparentChapter(course,ref,parent));assert.equal(JSON.stringify(course),before,'Rejected move is atomic');
}
for(let n=0;n<40;n++){
 const ref=n%2?'chapter:1':'outline:exam',destination=['outline:agile','outline:hybrid',null,'outline:framework'][n%4];
 r.reparentChapter(course,ref,destination);reload();r.moveChapter(course,ref,n%2?1:-1);reload();
}
const full={id:'pmp',chapters:Array.from({length:100},(_,i)=>'Saved '+i)},fullBefore=JSON.stringify(full);
assert.throws(()=>r.reparentChapter(full,'outline:exam',null));assert.equal(JSON.stringify(full),fullBefore);
assert.throws(()=>r.reparentChapter(full,'chapter:0','outline:intro'));assert.equal(JSON.stringify(full),fullBefore,'Target and parent materialization roll back together');
const other={id:'rmp',chapters:['Original']};assert.equal(r.reparentChapter(other,'chapter:0',null),false);assert.deepEqual(clone(r.parentChoices(other,'chapter:0')),[]);

// Read malformed imported metadata without mutating it, recursing forever, or losing a source lesson.
const projected={id:'pmp',chapters:['Legacy parent',{ar:'Child',en:'Child',outlineKey:'custom',outlineParent:'source_0'}]};
const projectedLessons=[{ch:0,t:'Unmatched special lecture',vimeo:'100005'},{ch:1,t:'Unmatched child',vimeo:'100006'}];
assert.equal(r.chapterChoices(projected).filter(n=>n.key==='source_0').length,1);
const projectedGroups=flat(r.learnerGroups(projected,projectedLessons));assert.equal(projectedGroups.filter(n=>n.key==='source_0').length,1);assert.deepEqual(projectedGroups.flatMap(n=>Array.from(n.items,l=>l.i)).sort(),[0,1]);
for(const bad of [
 [{ar:'A',en:'A',outlineKey:'exam',outlineParent:'missing'}],
 [{ar:'A',en:'A',outlineKey:'exam',outlineParent:'exam'}],
 [{ar:'A',en:'A',outlineKey:'intro',outlineParent:'exam'}],
 [{ar:'A',en:'A',outlineParent:'source_1'},{ar:'B',en:'B',outlineParent:'source_0'}],
 [{ar:'A',en:'A',outlineParent:7,outlineOrder:-5}],
 [{ar:'A',en:'A',outlineKey:'custom',outlineParent:[]},{ar:'B',en:'B',outlineKey:'custom'}],
 [{ar:'A',en:'A',outlineKey:'bad/key',outlineParent:{},outlineOrder:'1'}]
]){
 const imported=frozen({id:'pmp',chapters:clone(bad)}),before=JSON.stringify(imported),tree=r.topics(imported),all=flat(tree);
 assert.equal(new Set(keys(all)).size,all.length);assert(all.length>=25&&all.length<=27);
 const items=flat(r.learnerGroups(imported,bad.map((_,ch)=>({ch,t:'Unclassified fixture',vimeo:'10000'+ch})))).flatMap(n=>Array.from(n.items,l=>l.i));
 assert.deepEqual(items.sort(),bad.map((_,i)=>i));assert.equal(JSON.stringify(imported),before);
}

// Execute both actual write handlers against synthetic settings; failed payloads must not partially write CMS/course data.
const server=fs.readFileSync('server.js','utf8'),start=server.indexOf('function validCourseChapterKeys('),end=server.indexOf('/* ═══════════ عام',start);
assert(start>=0&&end>start);
const handlers=new Map(),settings=new Map([['content_courses',JSON.stringify([{id:'pmp',chapters:[]},{id:'rmp',chapters:['Existing']}])]]);let writes=0;
vm.runInNewContext(server.slice(start,end),{
 chapterSlotFloor,validChapterAllocation,app:{put:(route,...fn)=>handlers.set(route,fn.at(-1))},auth(){},admin(){},setting:key=>settings.get(key),
 setSetting:(key,value)=>{writes++;settings.set(key,value);},
 db:{transaction:fn=>fn,prepare:sql=>{if(sql.startsWith('SELECT chapter'))return {all:()=>[]};assert(sql.startsWith('INSERT INTO settings'),'Hierarchy writes must never touch lessons or progress');return{run:value=>{writes++;settings.set('content_courses',value);}};}}
});
function save(chapters,whole=false,courseId='pmp'){
 let status=200,result;
 handlers.get(whole?'/api/admin/content':'/api/admin/course-chapters/:course')({params:{course:courseId},body:whole?{cms:{fixture:'Preserve transaction boundary'},courses:[{id:courseId,chapters}]}:{chapters}},{status(code){status=code;return this;},json(value){result=value;return this;}});
 return {status,result};
}
const resetCatalog=()=>settings.set('content_courses',JSON.stringify([{id:'pmp',chapters:[]},{id:'rmp',chapters:['Existing']}]));
for(const whole of [false,true]){
 resetCatalog();assert.equal(save(clone(course.chapters),whole).status,200);
 const persisted=JSON.parse(settings.get('content_courses')).find(c=>c.id==='pmp');
 assert.deepEqual(clone(r.topics(persisted)),clone(r.topics(course)),'Actual endpoint JSON persistence retains title/parent/order');
 resetCatalog();assert.equal(save(['Legacy',{ar:'Named',en:'Named'}],whole).status,200,'Legacy entries without parent remain valid');
 resetCatalog();assert.equal(save([{ar:'Exam',en:'Exam',outlineKey:'exam',outlineParent:null,outlineOrder:10000}],whole).status,200);
 resetCatalog();assert.equal(save(projected.chapters,whole).status,200,'Existing source_N parent is a valid stable node');
 const defaultNodes=flat(r.topics(defaults));
 resetCatalog();assert.equal(save(defaultNodes.map(n=>({ar:n.ar,en:n.en,outlineKey:n.key,outlineParent:n.parentKey})),whole).status,200,'Backend canonical default graph agrees with frontend');
 for(const child of defaultNodes.filter(n=>n.parentKey))assert.equal(save([{ar:'Parent',en:'Parent',outlineKey:child.parentKey,outlineParent:child.key}],whole).status,400,'Inherited cycle rejected for '+child.key);
 for(const chapters of [
  [{ar:'X',en:'X',outlineKey:'exam',outlineParent:'missing'}],
  [{ar:'X',en:'X',outlineKey:'exam',outlineParent:'exam'}],
  [{ar:'X',en:'X',outlineKey:'intro',outlineParent:'exam'}],
  [{ar:'X',en:'X',outlineKey:'new',outlineParent:'source_1'},{ar:'Y',en:'Y',outlineParent:'new'}],
  [{ar:'X',en:'X',outlineParent:'source_0'}],
  [{ar:'X',en:'X',outlineParent:'source_99'}],
  ...[false,0,[],{},''].map(outlineParent=>[{ar:'X',en:'X',outlineParent}]),
  ...[-1,0.5,10001,'1',null,NaN,Infinity].map(outlineOrder=>[{ar:'X',en:'X',outlineOrder}]),
  [{ar:'X',en:'X',outlineKey:'intro'},{ar:'Y',en:'Y',outlineKey:'intro'}],
  [{ar:'X',en:'X',outlineKey:'source_0'}],
  [{ar:'',en:'X'}],null,{},Array(101).fill('Legacy')
 ]){
  const before=JSON.stringify([...settings]),count=writes;
  assert.equal(save(chapters,whole).status,400,'Malformed hierarchy rejected on '+(whole?'whole-content':'chapter')+' endpoint');
  assert.equal(JSON.stringify([...settings]),before);assert.equal(writes,count,'Reject before any settings write');
 }
}
// The whole-content writer supports legacy courses with no chapter field but rejects malformed supplied arrays.
let status=200;
const response={status(code){status=code;return this;},json(){return this;}};
handlers.get('/api/admin/content')({body:{courses:[{id:'legacy-without-chapters'}]}},response);assert.equal(status,200);
for(const courses of [{},null,[null],[[]]]){status=200;const count=writes;handlers.get('/api/admin/content')({body:{courses}},response);assert.equal(status,400);assert.equal(writes,count);}
assert.equal(save([{ar:'RMP',en:'RMP',outlineParent:null}],true,'rmp').status,400);
console.log('PASS: persisted hierarchy, canonical/source title and parent/order edits, root promotion, subtree moves, stable slots/lessons/progress, read-only malformed metadata safety, and both real API validators.');
