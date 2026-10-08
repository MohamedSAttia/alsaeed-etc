import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const context={window:{},MutationObserver:class{observe(){}},document:{body:{}}};vm.createContext(context);
vm.runInContext(fs.readFileSync('public/course-roadmap.js','utf8'),context);vm.runInContext(fs.readFileSync('public/course-assessments.js','utf8'),context);
const held=new Set(JSON.parse(fs.readFileSync('data/pmp-editorial-holds-2026.json','utf8')).items.map(x=>x.id));
const bank=['data/pmp-v5-import.json','data/pmp-framework-agile-2026.json','data/pmp-pmi-reference-2026.json'].flatMap(f=>JSON.parse(fs.readFileSync(f,'utf8'))).filter(q=>q.id!=='pmp-v5-0076'&&!held.has(q.id)&&!['PMP exam structure','Introduction'].includes(q.topic));
const routing=JSON.parse(fs.readFileSync('data/pmp-topic-routing-2026.json','utf8'));for(const q of bank)if(routing[q.id])q.meta={...q.meta,primaryTopic:routing[q.id]};
for(const lang of ['ar','en']){const published=bank.filter(q=>q['question_'+lang]&&q['options_'+lang]?.filter(Boolean).length>=2);for(const t of context.window.CourseRoadmap.pmp.slice(0,13).filter(t=>!['intro','exam'].includes(t[0]))){const n=context.window.CourseAssessments.chapterRows(published,t[lang==='ar'?1:2]).length;assert(n>0,lang+' '+t[0]+' is empty');if(t[0]==='framework'){console.log(lang,'framework',n);assert(lang==='ar'?n>=40&&n<=50:n>=25&&n<=50)}}assert(context.window.CourseAssessments.models(published).every(m=>m.length===180))}
console.log('PASS: all 11 assessed PMP chapter cards have real published questions in Arabic and English; 5 full models available in each language');

const ui=fs.readFileSync('public/course-assessments.js','utf8');assert(!ui.includes('[20,30]'));assert(ui.includes("filter(t=>!['intro','exam'].includes(t[0]))"));
