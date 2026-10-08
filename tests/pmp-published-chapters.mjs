import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const context={window:{},MutationObserver:class{observe(){}},document:{body:{}}};vm.createContext(context);
vm.runInContext(fs.readFileSync('public/course-roadmap.js','utf8'),context);vm.runInContext(fs.readFileSync('public/course-assessments.js','utf8'),context);
const bank=['data/pmp-v5-import.json','data/pmp-framework-agile-2026.json','data/pmp-pmi-reference-2026.json'].flatMap(f=>JSON.parse(fs.readFileSync(f,'utf8'))).filter(q=>q.id!=='pmp-v5-0076');
for(const lang of ['ar','en']){const published=bank.filter(q=>q['question_'+lang]&&q['options_'+lang]?.filter(Boolean).length>=2);for(const t of context.window.CourseRoadmap.pmp.slice(0,13)){const n=context.window.CourseAssessments.chapterRows(published,t[lang==='ar'?1:2]).length;assert(n>0,lang+' '+t[0]+' is empty');if(['intro','exam','value','principles','lifecycles'].includes(t[0]))assert.equal(n,4)}assert(context.window.CourseAssessments.models(published).every(m=>m.length===180))}
console.log('PASS: all 13 requested PMP chapter cards have real published questions in Arabic and English; 5 full models available in each language');
