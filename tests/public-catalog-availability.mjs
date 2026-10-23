/** Actual public/learner handlers, real shared publication selector and planner.
 * Synthetic in-memory SQLite only; never starts the application or seeds data.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import {catalogAvailability, questionSourcePackageId, learnerQuestionSelection, learnerQuestionMeta} from '../learner-question-catalog.js';
import '../public/course-roadmap.js';
import '../public/pmp-shared-case.js';

const roadmap = globalThis.CourseRoadmap, sharedCase = globalThis.PmpSharedCase;
const editorialHolds = JSON.parse(fs.readFileSync('data/pmp-editorial-holds-2026.json','utf8')).items.map(item => item.id);
const topicRouting = JSON.parse(fs.readFileSync('data/pmp-topic-routing-2026.json','utf8'));
const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE settings(k TEXT PRIMARY KEY,v TEXT);
  CREATE TABLE lessons(package_id TEXT,idx INTEGER,title TEXT,title_en TEXT,chapter INTEGER,duration TEXT,vimeo TEXT,free INTEGER,notes TEXT,notes_en TEXT,files TEXT,quiz TEXT,display_order INTEGER,deleted_at INTEGER,PRIMARY KEY(package_id,idx));
  CREATE TABLE questions(id TEXT PRIMARY KEY,package_id TEXT,domain TEXT,topic TEXT,approach TEXT,type TEXT,active INTEGER,source_id TEXT,meta TEXT,question_ar TEXT,question_en TEXT,options_ar TEXT,options_en TEXT,correct TEXT,correct_json TEXT,explanation_ar TEXT,explanation_en TEXT,reference TEXT,is_official INTEGER,priority INTEGER);
  CREATE TABLE progress(user_id TEXT,package_id TEXT,data TEXT);`);
const courses = [{id:'pmp',chapters:[
  {ar:'مقدمة محفوظة',en:'Saved introduction',outlineKey:'intro'},
  {ar:'إطار عمل محفوظ',en:'Saved framework',outlineKey:'framework'},
  {ar:'التخطيط المحفوظ',en:'Saved planning',outlineKey:'planning'},
  {ar:'قيمة محفوظة',en:'Saved value',outlineKey:'value'},
  {ar:'موضوع خاص',en:'Custom saved topic'}
]},{id:'rmp',chapters:[{ar:'فصل مخاطر',en:'Risk chapter'}]},{id:'unknown'}];
const packages = [{id:'pmp-full',course:'pmp'}, {id:'pmp-variant',course:'pmp',sourcePackageId:'pmp-full'},
  {id:'pmp-own',course:'pmp'}, {id:'pmp-empty',course:'pmp'},
  {id:'rmp',course:'rmp',sourcePackageId:'pmp-full'}, {id:'no-course',course:'unknown'}];
for (const [key,value] of [['content_courses',courses],['content_packages',packages]])
  db.prepare('INSERT INTO settings VALUES(?,?)').run(key,JSON.stringify(value));
db.prepare('INSERT INTO progress VALUES(?,?,?)').run('learner','pmp-full','{"lessons":{"9":true},"exams":{"saved":{"score":88}}}');
function lesson(pkg,idx,ch,title,extra = {}) {
  const row = {package_id:pkg,idx,title,title_en:title,chapter:ch,duration:'01:30',vimeo:'9988776655?h=PAID_SECRET',free:0,
    notes:'PAID_NOTES',notes_en:'PAID_NOTES_EN',files:'[{"id":"PAID_FILE"}]',quiz:'[{"q":"PAID_QUIZ","correct":"PAID_ANSWER"}]',display_order:idx,deleted_at:null,...extra};
  db.prepare(`INSERT INTO lessons(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(() => '?')})`).run(...Object.values(row));
}
lesson('pmp-full',0,0,'Published intro');
lesson('pmp-full',4,1,'Published framework',{display_order:50});
lesson('pmp-full',9,2,'Published planning',{display_order:0});
lesson('pmp-full',18,3,'Published value');
lesson('pmp-full',23,4,'Published custom');
lesson('pmp-full',24,1,'Reading only',{vimeo:'   '});
lesson('pmp-full',30,1,'Deleted video',{deleted_at:1});
lesson('pmp-variant',0,0,'Wrong variant copy',{vimeo:'SHOULD_NOT_COUNT'});
lesson('rmp',0,0,'Actual risk lesson',{duration:'02:15'});
lesson('no-course',7,0,'Uncatalogued lesson');

const add = input => {
  const row = {id:input.id,package_id:'pmp-full',domain:'people',topic:'Project Management Framework',approach:'predictive',type:'single',active:1,
    source_id:input.id,meta:JSON.stringify({alignmentVersion:'pmp-2026-pmbok8'}),question_ar:'PRIVATE_QUESTION_AR',question_en:'PRIVATE_QUESTION_EN',
    options_ar:'["PRIVATE_A","PRIVATE_B"]',options_en:'["PRIVATE_A","PRIVATE_B"]',correct:'B',correct_json:'[1]',
    explanation_ar:'PRIVATE_EXPLANATION_AR',explanation_en:'PRIVATE_EXPLANATION_EN',reference:'PRIVATE_REFERENCE',is_official:0,priority:0,...input};
  db.prepare(`INSERT INTO questions(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(() => '?')})`).run(...Object.values(row));
};
for (const [domain,count] of [['people',60],['process',80],['business',50]])
  for(let i=0;i<count;i++) add({id:`fixture-${domain}-${i}`,domain:i===0?{people:'e',process:'r',business:'business environment'}[domain]:domain,
    approach:['agile','predictive','hybrid'][i%3],topic:i%5?'Risk':'Project Management Framework'});
add({id:'inactive',active:0});
add({id:'held',source_id:editorialHolds[0]});
add({id:'introduction',topic:'Introduction'});
add({id:'exam-structure',topic:'PMP exam structure'});
add({id:'range-held',source_id:'ALSAEED-PMP-2026-FA-061'});
add({id:'ALSAEED-PMP-2026-FA-062@pmp-full',source_id:'unusual-source-id'});
add({id:'legacy',meta:'{}'});
add({id:'forged-reference',meta:'{"referenceMergeReviewed":true}'});
add({id:'pmp-v5-0076@pmp-full',source_id:'pmp-v5-0076'});
add({id:'dsdm-excluded',question_en:'Question about DSDM'});
add({id:'sdmd-excluded',question_ar:'Question about SDMD'});
add({id:'pmp-ref-somu-reviewed',meta:'{"referenceMergeReviewed":true}'});
add({id:'pmp-v5-malformed-meta',meta:'{not json'});
const routedSource = Object.keys(topicRouting).find(key => !editorialHolds.includes(key));
assert(routedSource,'Fixture needs a real published topic routing override');
add({id:'routed-framework',source_id:routedSource,topic:'Project Management Framework'});
add({id:'explicit-not-framework',topic:'Project Management Framework',meta:'{"alignmentVersion":"pmp-2026-pmbok8","primaryTopic":"risk"}'});
add({id:'explicit-framework-tag',topic:'Risk',meta:'{"alignmentVersion":"pmp-2026-pmbok8","topics":["framework"]}'});
add({id:'shared-fragment',meta:'{"alignmentVersion":"pmp-2026-pmbok8","sourceV5":{"scn":true,"t":"scenario"}}'});
add({id:'exact-private-bank',package_id:'pmp-own',meta:'{}'});
add({id:'risk-public',package_id:'rmp',meta:'{}'});

const snapshot = () => JSON.stringify(['settings','lessons','questions','progress'].map(table => db.prepare('SELECT * FROM '+table).all()));
const before = snapshot();
const input = {db,packages,courses,roadmap,sharedCase,editorialHolds,topicRouting,pmpPackageId:'pmp-full'};
const result = catalogAvailability(input);
assert.equal(result['pmp-full'].videos,5);
assert.equal(result['pmp-full'].videoMins,8);
assert.deepEqual(result['pmp-variant'].curriculum,result['pmp-full'].curriculum,'Variant uses saved same-course video source');
assert.equal(result.rmp.videos,1,'Cross-course source is rejected');
assert.equal(result.rmp.videoMins,2);
assert.equal(result['pmp-own'].questions,0,'Existing exact bank wins even when all its rows are unpublished');
assert.equal(result['pmp-empty'].questions,result['pmp-full'].questions,'Empty sibling resolves the same largest learner bank');
assert.equal(result['no-course'].videos,1,'Unknown saved course still yields safe lesson metadata');
assert.deepEqual(result['pmp-full'].assessments.chapters.map(row => row.key),['framework','agile','predictive','hybrid']);
assert.deepEqual(result['pmp-full'].assessments.domains.map(row => row.key),['people','process','business']);
assert.deepEqual(result['pmp-full'].assessments.fullMocks,{status:'verified',availableCount:5,modelCount:5,questionCount:180,minutes:240});
assert.deepEqual(result['pmp-own'].assessments.fullMocks,{status:'verified',availableCount:0,modelCount:5,questionCount:180,minutes:240});
assert.equal(result['pmp-full'].curriculum.find(row => row.key==='framework').children.find(row => row.key==='value').videoCount,1);
assert.equal(result['pmp-full'].curriculum.find(row => row.key==='predictive').children.find(row => row.key==='planning').videoCount,1);
assert.equal(result['pmp-full'].curriculum.reduce((n,row) => n+row.videoCount,0),5,'Descendant-inclusive root counts equal actual published videos');
function verifyTree(rows) { for(const row of rows) {assert.deepEqual(Object.keys(row).sort(),['ar','children','en','key','videoCount']);verifyTree(row.children);} }
Object.values(result).forEach(row => verifyTree(row.curriculum));
assert.equal(snapshot(),before,'Catalog read does not mutate any source row, setting or progress record');
const serialized=JSON.stringify(result);
for(const secret of ['PAID_','PRIVATE_','9988776655','SHOULD_NOT_COUNT','sourcePackageId','source_id','sharedCaseId','sourceV5','alignmentVersion','question_ar','question_en','options','correct','notes','files','quiz','vimeo','displayOrder','idx','items'])
  assert(!serialized.includes(secret),'Public response must not expose '+secret);

// Exercise the actual unauthenticated server handler, not only a facsimile.
const server = fs.readFileSync('server.js','utf8');
const start = server.indexOf('const catalogEditorialHolds ='), end = server.indexOf('function validCourseChapterKeys',start);
let publicHandler;
vm.runInNewContext(server.slice(start,end),{db,fs,path,__dirname:path.resolve('.'),catalogAvailability,globalThis:{CourseRoadmap:roadmap,PmpSharedCase:sharedCase},
  readList:key=>JSON.parse(db.prepare('SELECT v FROM settings WHERE k=?').get(key)?.v||'[]'),app:{get:(route,handler)=>{assert.equal(route,'/api/catalog-availability');publicHandler=handler;}}});
let payload,headers={};
publicHandler({headers:{}},{set(name,value){headers[name]=value;return this;},json(value){payload=value;return this;}});
assert.equal(headers['Cache-Control'],'no-store');
assert.deepEqual(JSON.parse(JSON.stringify(payload)),result);

// Compare counts with the real learner route and the actual browser classifier.
const gateway = fs.readFileSync('gateway.js','utf8');
const getPackages=()=>packages;
const parseJson=(value,fallback)=>{try{return value?JSON.parse(value):fallback;}catch{return fallback;}};
let practiceOptions;
const gatewayContext={createPracticeState:options=>{practiceOptions=options;return ()=>{}},readJson:async()=>({}),db,getPackages,pmp:{packageId:'pmp-full'},pmpEditorialHolds:editorialHolds,pmpTopicRouting:topicRouting,
  learnerQuestionSelection,learnerQuestionMeta,userFromToken:()=>({id:'fixture-admin',role:'admin'}),normalizeType:value=>value,
  normalizedQuestionOptions:q=>({ar:parseJson(q.options_ar,[]),en:parseJson(q.options_en,[])}),parseJson,
  sendJson:(res,status,value)=>Object.assign(res,{status,value})};
vm.createContext(gatewayContext);
vm.runInContext(gateway.slice(gateway.indexOf('function handleLearnerQuestionBank('),gateway.indexOf('\nfunction lessonAccess',gateway.indexOf('function handleLearnerQuestionBank('))),gatewayContext);
const response={};
gatewayContext.handleLearnerQuestionBank({},response,new URL('http://fixture/api/learner-question-bank/pmp-full?limit=2000'));
assert.equal(response.status,200);
assert.deepEqual(practiceOptions.getQuestions('pmp-full').map(q=>q.id).sort(),response.value.questions.map(q=>q.id).sort(),'Persistent practice uses the same complete publication eligibility');
const bank=response.value.questions.filter(q=>!['PMP exam structure','Introduction'].includes(q.topic)&&!/ALSAEED-PMP-2026-FA-0(?:6[1-9]|7[0-9]|80)(?:@|$)/.test(q.id));
const browser={window:{APP:{esc:String}},MutationObserver:class{observe(){}},document:{body:{}},PmpSharedCase:sharedCase};
vm.createContext(browser);vm.runInContext(fs.readFileSync('public/course-assessments.js','utf8'),browser);
const assessments=result['pmp-full'].assessments;
assert.equal(assessments.questions,bank.length);
assert.equal(result['pmp-full'].questions,bank.length,'Legacy total uses the same published count, never raw editorial aggregate');
for(const row of assessments.chapters) assert.equal(row.questionCount,bank.filter(q=>browser.window.CourseAssessments.match(q,row.key==='framework'?{topic:row.key}:{approach:row.key})).length,row.key+' has exact learner classifier parity');
for(const row of assessments.domains) assert.equal(row.questionCount,bank.filter(q=>browser.window.CourseAssessments.match(q,{domain:row.key})).length,row.key+' has exact learner domain parity');
assert.equal(assessments.fullMocks.availableCount,browser.window.CourseAssessments.models(bank).filter(model=>model.length===180).length,'Same shared full-mock planner');

// Source resolution parity: direct, course-id fallback, sibling tie order, case,
// active-only and editorial admin selection retain their established behavior.
function legacySource(id,activeOnly=true) {
  id=String(id||'');const activeSql=activeOnly?' AND active=1':'';
  const count=candidate=>db.prepare(`SELECT COUNT(*) c FROM questions WHERE package_id=?${activeSql}`).get(candidate).c;
  if(count(id)>0)return id;
  const pkg=packages.find(p=>String(p.id)===id),course=String(pkg?.course||id.split('-')[0]||id).toLowerCase();
  let best=id,bestCount=0;
  for(const candidate of new Set([course,...packages.filter(p=>String(p.course||'').toLowerCase()===course).map(p=>String(p.id))])){
    const n=count(candidate);if(n>bestCount){best=candidate;bestCount=n;}
  }
  return bestCount?best:id;
}
for(const id of [...packages.map(p=>p.id),'PMP-missing','rmp-new','unknown'])
  for(const activeOnly of [true,false])assert.equal(questionSourcePackageId({db,packages},id,activeOnly),legacySource(id,activeOnly));
for(const domain of ['people','process','business']) {
  const selected=learnerQuestionSelection(input,'pmp-full',{domain});
  const selectedRows=db.prepare(`SELECT domain FROM questions WHERE ${selected.filters.join(' AND ')}`).all(...selected.params);
  assert(selectedRows.length>0);assert(selectedRows.every(q=>({e:'people',r:'process','business environment':'business'}[q.domain]||q.domain)===domain));
}
assert.equal(snapshot(),before,'Actual guest and learner handlers remain read-only');

// No fabricated availability for insufficient domains, random capped banks or
// a server installation whose bank has not been initialized yet.
db.prepare("UPDATE questions SET active=0 WHERE package_id='pmp-full' AND domain IN ('business','business environment')").run();
assert.equal(catalogAvailability(input)['pmp-full'].assessments.fullMocks.availableCount,0);
for(let i=0;i<2010;i++)add({id:'oversized-'+i,package_id:'no-course',meta:'{}'});
const oversized=catalogAvailability(input)['no-course'];
assert.equal(oversized.questions,null);assert.equal(oversized.questionsStatus,'unverified');assert.equal(oversized.assessments.questions,null);
assert.equal(oversized.assessments.fullMocks.availableCount,null);
db.exec('DROP TABLE questions');
const missing=catalogAvailability(input)['pmp-full'];
assert.equal(missing.questions,null);assert.equal(missing.questionsStatus,'unverified');assert.equal(missing.assessments.status,'unverified');
assert(missing.assessments.chapters.every(row=>row.questionCount===null));assert.equal(missing.videos,5);
db.close();
console.log('PASS: public/learner handler parity; published source and editorial gates; canonical video tree; exact chapter/domain counts and five-mock readiness; zero vs unverified; no paid content leaks; no database writes.');
