import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const ctx={window:{APP:{esc:String}},MutationObserver:class{observe(){}},document:{body:{}}};vm.createContext(ctx);
for(const f of ['pmp-shared-case.js','course-assessments.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8'),ctx);
const api=ctx.PmpSharedCase,qs=api.questions();assert.equal(qs.length,10);assert.equal(new Set(qs.map(q=>q.id)).size,10);
assert(api.case.en.split(/\s+/).length>400);assert(api.case.ar.length>2000);
for(const [i,q] of qs.entries()){
 assert.equal(q.meta.sharedCaseId,api.case.id);assert.equal(q.meta.casePosition,i+1);
 assert.equal(q.meta.scenarioText.ar,api.case.ar);assert.equal(q.meta.scenarioText.en,api.case.en);
 assert.equal(q.type,'scenario');assert.equal(q.options_ar.length,4);assert.equal(q.options_en.length,4);
 assert.equal(q.correct,String.fromCharCode(65+q.correct_json[0]));
 for(const field of ['question','explanation']){assert(/[\u0600-\u06ff]/.test(q[field+'_ar']));assert(!/[\u0600-\u06ff]/.test(q[field+'_en']));}
 assert(q.options_ar.every(x=>/[\u0600-\u06ff]/.test(x)));assert(q.options_en.every(x=>!/[\u0600-\u06ff]/.test(x)));
}
// Each question uses a distinct, explicit fact from the shared case, not a pasted generic stem.
const anchors=['transition','complete application','screen-reader','sixteen','fourth','retention','licence','pilot','three months','rollback'];
anchors.forEach((anchor,i)=>{assert(qs[i].question_en.toLowerCase().includes(anchor),anchor);assert(api.case.en.toLowerCase().includes(anchor),anchor)});
const pristine=api.questions()[0].options_en[0];qs[0].options_en[0]='MUTATED';assert.equal(api.questions()[0].options_en[0],pristine,'Attempts must not share mutable answer arrays');
const bank=['pmp-v5-import','pmp-framework-agile-2026','pmp-pmi-reference-2026'].flatMap(n=>JSON.parse(fs.readFileSync('data/'+n+'.json')));
const before=JSON.stringify(bank);for(let run=0;run<20;run++){
 const model=api.build(bank);assert.equal(model.length,180);assert.equal(new Set(model.map(q=>q.id)).size,180);
 assert.deepEqual(Array.from(model.slice(0,10),q=>q.id),Array.from(api.questions(),q=>q.id));
 assert(model.slice(10).every(q=>!q.meta?.sharedCaseId&&!q.meta?.sourceV5?.scn));
 assert.deepEqual(['people','process','business'].map(d=>model.filter(q=>q.domain===d).length),[59,74,47]);
 for(const q of model.slice(10))assert(bank.includes(q),'Existing question identity and scoring must remain unchanged');
}
assert.equal(JSON.stringify(bank),before,'No mutation of chapter/domain bank');assert.equal(api.build(bank.slice(0,20)).length,0,'Do not silently shrink full mocks');
assert.equal(ctx.window.CourseAssessments.chapterRows(bank,'Risk').some(q=>q.meta?.sharedCaseId),false);
console.log('PASS: original bilingual substantial case, ten fact-linked questions, independent mutable attempts, 20 full-model quota/ID runs, untouched chapter bank');
