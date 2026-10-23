import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import {createPmpPracticeTools,practiceCatalog,practiceFields,validatePracticeInputs,practiceMetrics} from '../pmp-practice-tools.js';
const d=JSON.parse(fs.readFileSync('data/pmp-practice-tools.json'));
const ids=['agile:approach','agile:scrum','agile:kanban','agile:hybrid'];
assert.equal(practiceCatalog(d).length,55);assert.deepEqual(d.AGILE.workbooks.map(x=>x.id),ids);
assert.equal(d.AGILE.source.commit,'a7715afcdf9a7ed323ce8d6cc9b34b78a682547d');
for(const w of d.AGILE.workbooks){assert(w.title.every(Boolean));assert(w.description.every(Boolean));assert.deepEqual(practiceFields(w.id,d),w.fields);for(const f of [...w.fields,...w.groups.flatMap(g=>g.fields)])assert(f.l.every(Boolean));for(const seed of Object.values(w.seed||{}))assert.deepEqual(validatePracticeInputs(w.id,seed,d),seed)}
for(const k of ['Noura','Faisal','Abdullah','Hind','Tariq','Lama'])assert(!JSON.stringify(d.AGILE.workbooks).includes(k));
const calc=(id,v)=>practiceMetrics(id,v,d);
assert.equal(calc(ids[0],{req:'1',chg:'1',reg:'1'}).suggestion,null);
assert.equal(calc(ids[0],{req:'1',chg:'2',reg:'2',fb:'2'}).suggestion,'predictive');
assert.equal(calc(ids[0],{req:'4',chg:'4',reg:'5',fb:'4'}).suggestion,'agile');
assert.equal(calc(ids[0],{req:'1',chg:'5',reg:'5',fb:'5'}).suggestion,'hybrid');
assert.equal(calc(ids[0],{req:'3',chg:'3',reg:'3',fb:'3'}).suggestion,'hybrid');
assert.equal(calc(ids[0],{req:'1.5',chg:'Infinity',reg:'0',fb:'6'}).rated,0);
for(const inputs of [{req:'0'},{req:'6'},{req:'1.5'},{req:1},{reg:'Infinity'},{alien:'x'}])assert.throws(()=>validatePracticeInputs(ids[0],inputs,d));
for(const inputs of [{team:{}},{team:new Array(13).fill({})},{stories:[{id:'a'},{id:' a '}]},{stories:[{points:'NaN'}]},{stories:[{priority:'URGENT'}]},{sprints:[{id:'a',status:'active'},{id:'b',status:'active'}]},{sprints:[{unknown:'x'}]},{length:'0'},{length:'32'},{length:'1.5'}])assert.throws(()=>validatePracticeInputs(ids[1],inputs,d));
for(const inputs of [{devLimit:'-1'},{testLimit:'1.2'},{cards:new Array(61).fill({})},{cards:[{column:'deploy'}]},{cards:[null]}])assert.throws(()=>validatePracticeInputs(ids[2],inputs,d));
assert.throws(()=>validatePracticeInputs(ids[3],{'hull.approach':'waterfall'},d));
let m=calc(ids[2],d.AGILE.workbooks[2].seed.en);assert.deepEqual(m.counts,{todo:3,dev:2,test:3,done:2});assert.deepEqual(m.breaches,[{column:'test',limit:2,count:3}]);assert(m.bottleneck);
assert.equal(calc(ids[2],{devLimit:'0',testLimit:'0',cards:[{column:'dev'}]}).breaches.length,1);assert.equal(calc(ids[2],{}).limits.dev,null);
const scrum={team:[{capacity:'8'}],sprints:[{id:'old',goal:'Closed example',status:'closed'},{id:'current',goal:'',status:'active'}],stories:[{id:'a',points:'5',sprint:'old',status:'done',ready:'yes',acceptance:'Check'},{id:'b',points:'13',sprint:'current',status:'todo',ready:'no',acceptance:''},{id:'c',points:'2',sprint:'',status:'todo'}]};
m=calc(ids[1],scrum);assert.equal(m.capacity,8);assert(m.capacityKnown);assert.equal(m.sprints[1].points,13);assert.equal(m.sprints[1].largeStories,1);assert.equal(m.sprints[1].notReady,1);assert.equal(m.velocity.average,5);assert.deepEqual(m.forecast,{remaining:15,optimistic:3,likely:3,pessimistic:3});
const zero=structuredClone(scrum);zero.stories[0].status='todo';m=calc(ids[1],zero);assert.equal(m.velocity.average,0);assert.deepEqual(m.forecast,{remaining:20,optimistic:null,likely:null,pessimistic:null});assert(!JSON.stringify(m).includes('Infinity'));
const mixed=structuredClone(scrum);mixed.sprints.push({id:'zero',status:'closed',goal:'No completed work'});m=calc(ids[1],mixed);assert.equal(m.velocity.min,0);assert.equal(m.forecast.pessimistic,null);assert.equal(m.forecast.optimistic,3);assert.equal(m.forecast.likely,6);
const unknown=structuredClone(scrum);unknown.stories[0].sprint='unknown';unknown.stories[1].points='';m=calc(ids[1],unknown);assert.equal(m.unknownSprint,1);assert.equal(m.forecast,null);assert.equal(m.estimatesMissing,1);
m=calc(ids[3],{'hull.approach':'predictive','cms.approach':'agile','fit.approach':'hybrid'});assert.equal(m.choices.length,3);assert(m.choices.every(x=>x.aligned));assert.deepEqual(m.interfaces,[{a:'hull',b:'cms'}]);assert.equal(m.unchosen,2);assert(!('score' in m));
// Same exact pure function is used by the browser and server.
const browser=vm.createContext({});vm.runInContext('Object.hasOwn=undefined',browser);vm.runInContext(fs.readFileSync('public/pmp-practice-model.js','utf8'),browser);for(const [id,inputs]of [[ids[0],{req:'5',chg:'4',reg:'4',fb:'5'}],[ids[1],scrum],[ids[2],d.AGILE.workbooks[2].seed.en],[ids[3],{'hull.approach':'agile'}]])assert.deepEqual(JSON.parse(JSON.stringify(browser.PmpPracticeModel.metrics(id,inputs,d))),calc(id,inputs));
// Production-like users table intentionally has no deleted_at column.
const raw=new DatabaseSync(':memory:');raw.exec("CREATE TABLE users(id TEXT PRIMARY KEY,active INTEGER,role TEXT);CREATE TABLE enrollments(user_id TEXT,package_id TEXT,expires INTEGER);INSERT INTO users VALUES('a',1,'student'),('b',1,'student'),('disabled',0,'student'),('null-active',NULL,'student'),('admin',1,'admin');INSERT INTO enrollments VALUES('a','one',NULL),('a','two',NULL),('b','one',NULL);");
const db={prepare:q=>raw.prepare(q),transaction:f=>()=>{raw.exec('BEGIN');try{const v=f();raw.exec('COMMIT');return v}catch(e){raw.exec('ROLLBACK');throw e}}};let packages=[{id:'one',course:'pmp'},{id:'two',course:'pmp'}],awards=0;
const make=()=>createPmpPracticeTools({db,definitions:d,getPackages:()=>packages,userFromToken:r=>r.user?{id:r.user}:null,readJson:async r=>r.body,sendJson:(r,code,data)=>Object.assign(r,{code,data}),afterSave:()=>awards++});let handle=make();
async function call(user='a',path='one',method='GET',body){const res={headers:{},setHeader(k,v){this.headers[k]=v}};await handle({user,method,body},res,new URL('https://local.test/api/pmp-practice-tools/'+path));return res}
for(const user of ['disabled','null-active'])assert.equal((await call(user)).code,403);assert.equal((await call(null)).code,401);assert.equal((await call('b','two')).code,403);assert.equal((await call()).data.summary.total,55);
for(const id of ids){const w=d.AGILE.workbooks.find(x=>x.id===id),inputs=w.seed?.en|| (id===ids[0]?{req:'4',chg:'4',fb:'4',reg:'4',rationale:'Fictional practice'}:{'hull.approach':'predictive','hull.rationale':'Fixed specification'});const body={toolId:id,expectedRevision:0,completed:true,inputs};const result=await call('a','one/save','POST',body);assert.equal(result.code,200);assert.equal(result.data.state.revision,1);assert.equal(result.headers['Cache-Control'],'private, no-store');assert.deepEqual(result.data.state.metrics,calc(id,inputs));assert.equal((await call('b')).data.states[id],undefined);assert.equal((await call('a','two')).data.states[id],undefined);assert.equal((await call('a','one/save','POST',body)).code,409)}
assert.equal(awards,4);handle=make();assert.equal((await call()).data.states[ids[2]].inputs.cards.length,10);assert.equal((await call()).data.summary.completed,4);
assert.equal((await call('a','one/save','POST',{toolId:ids[1],expectedRevision:1,completed:true,inputs:{team:[],stories:[],sprints:[]}})).code,400);
for(const change of [{active:false},{active:0},{deleted:true},{deletedAt:1},{deleted_at:1}]){packages=[{id:'one',course:'pmp',...change}];assert.equal((await call()).code,404);assert.equal((await call('a','one/save','POST',{})).code,404)}
packages=[{id:'one',course:'pmp'}];assert.equal((await call('admin','one/save','POST',{})).code,403);raw.prepare("UPDATE enrollments SET expires=1 WHERE user_id='a' AND package_id='one'").run();assert.equal((await call()).code,403);raw.close();
console.log('PASS four agile workbooks: bilingual schemas, source adaptations, strict row/field validation, boundary calculations, shared model parity, CAS restart/owner/package isolation and production-schema gates');
