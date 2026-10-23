import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {readPracticeToolSummary,enrollmentTiming,summarizeRecordedProgress,summarizeStudent,DAY_MS as D} from '../trainee-tracking.js';
const now=Date.UTC(2026,9,15,12), videos=[{idx:0,chapter:1},{idx:2,chapter:1}];
const row=data=>({data:JSON.stringify(data),updated:now});
test('exact expiry boundaries, seven-day window, unlimited, unknown, future enrollment',()=>{
 assert.deepEqual(enrollmentTiming({created:now-2.9*D,expires:now},now),{daysEnrolled:2,remainingDays:0,enrollmentStatus:'expired'});
 assert.equal(enrollmentTiming({created:now,expires:now+7*D},now).enrollmentStatus,'expiring');
 assert.equal(enrollmentTiming({created:now,expires:now+7*D+1},now).enrollmentStatus,'active');
 assert.equal(enrollmentTiming({created:now,expires:now+1},now).remainingDays,1);
 for(const expires of [null,0])assert.equal(enrollmentTiming({expires},now).enrollmentStatus,'unlimited');
 for(const expires of [undefined,-1,'123'])assert.equal(enrollmentTiming({expires},now).enrollmentStatus,'unknown');
 assert.equal(enrollmentTiming({created:now+D},now).daysEnrolled,null);
});
test('no records, corruption, no curriculum and real zero are distinct',()=>{
 for(const r of [null,{data:'bad'},{data:'[]'},{data:'null'}])assert.equal(summarizeRecordedProgress(r,videos).progress,null);
 assert.equal(summarizeRecordedProgress(row({weeks:{1:true},exams:{a:{passed:true,score:100}}}),[]).progress,null);
 assert.equal(summarizeRecordedProgress(row({}),videos).progress,0);
 const summary=summarizeRecordedProgress(row({lessons:{0:true,2:false,99:true},exams:{a:{score:0},b:{score:100},c:{score:null},d:{score:'50'},e:{score:1000}}}),videos);
 assert.equal(summary.progress,50);assert.equal(summary.avgExam,50);assert.equal(summary.examScoreCount,2);
 assert.equal(summarizeRecordedProgress(row({}),videos).avgExam,null);
});
test('weighted overview preserves zero exams and unknown progress',()=>{
 const a=summarizeRecordedProgress(row({lessons:{0:true},exams:{a:{score:0}}}),videos);
 const b=summarizeRecordedProgress(null,videos);
 assert.deepEqual(summarizeStudent([a,b]),{progress:50,avgExam:0,measuredPackages:1});
});
const source=fs.readFileSync(new URL('../public/trainee-tracking.js',import.meta.url),'utf8');
const context={window:{},Intl,document:{getElementById:()=>null}};vm.runInNewContext(source,context);
const ui=context.window.AlsaeedTraineeTracking;
test('shared ranking, valid zero, missing excluded, no fake best on zero',()=>{
 const rows=[{id:'a',user:{id:'a'},progress:50,avgExam:80},{id:'b',user:{id:'b'},progress:50,avgExam:80},{id:'c',user:{id:'c'},progress:50,avgExam:0},{id:'d',user:{id:'d'},progress:null,avgExam:100}];
 const ranks=ui.ranked(rows);assert.equal(ranks.get('a').rank,1);assert.equal(ranks.get('b').rank,1);assert.equal(ranks.get('c').rank,3);assert.equal(ranks.has('d'),false);
 assert.equal(ui.ranked([{id:'z',user:{id:'z'},progress:0,avgExam:null}]).get('z').best,false);
});
test('render escapes names, shows missing states and independent package labels',()=>{
 const html=ui.render({serverNow:now,students:[{id:'a',name:'<img onerror=alert(1)>',email:'x',learningPackages:[{id:'a',package_id:'p',created:now,progress:null,avgExam:null,progressStatus:'unrecorded',enrollmentStatus:'unlimited',daysEnrolled:0}]}]},()=>({ar:'<script>'}));
 assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img onerror'));assert.ok(html.includes('غير مصنف'));assert.ok(html.includes('لا يوجد تقدم محفوظ'));assert.ok(html.includes('غير محدود'));
 assert.ok(ui.render(null,()=>null).includes('غير متاحة'));
});
test('admin authorization remains on tracking APIs and route; index inline scripts parse',()=>{
 const server=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
 assert.match(server,/app.get\('\/api\/admin\/overview', auth, admin/);
 assert.match(server,/app.get\('\/api\/admin\/users\/:id\/activity', auth, admin/);
 const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(html,/head === 'trainer'\) html = isAdmin\(\) \? V.trainer\(\)/);
 for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(match[1].trim()&&!match[0].includes('application/ld+json'))new vm.Script(match[1]);
});
test('DOM filters re-render correctly, search remains compatible, no mutations',async()=>{
 const {JSDOM}=await import(process.env.JSDOM_MODULE||'/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js');
 const dom=new JSDOM('<main></main>',{url:'https://synthetic.invalid/#admin',runScripts:'outside-only'}),w=dom.window;
 w.eval(source);
 const overview={serverNow:now,students:[{id:'u',name:'Learner',email:'test@example.invalid',learningPackages:[{id:'p1',package_id:'p',created:now-D,expires:now,progress:50,avgExam:0,lessonDone:1,lessonTotal:2,...enrollmentTiming({created:now-D,expires:now},now)},{id:'q1',package_id:'q',progress:100,avgExam:100,...enrollmentTiming({created:now-D,expires:null},now)}]}]};
 const original=JSON.stringify(overview);let renders=0;
 w.APP={render(){renders++;w.document.querySelector('main').innerHTML=w.AlsaeedTraineeTracking.render(overview,id=>({ar:id}));w.AlsaeedTraineeTracking.bind();}};
 w.APP.render();assert.equal(w.document.querySelectorAll('[data-student-row]').length,2);
 let select=w.document.querySelector('#trackingPackage');select.value='p';select.dispatchEvent(new w.Event('change'));
 assert.equal(w.document.querySelectorAll('[data-student-row]').length,1);
 select=w.document.querySelector('#trackingStatus');select.value='unlimited';select.dispatchEvent(new w.Event('change'));
 assert.equal(w.document.querySelectorAll('[data-student-row]').length,0);
 select=w.document.querySelector('#trackingStatus');select.value='expired';select.dispatchEvent(new w.Event('change'));
 assert.equal(w.document.querySelectorAll('[data-student-row]').length,1);
 assert.equal(JSON.stringify(overview),original);assert.equal(renders,4);dom.window.close();
});

test('practice total follows the published workbook catalog',()=>{const defs=JSON.parse(fs.readFileSync(new URL('../data/pmp-practice-tools.json',import.meta.url),'utf8'));const db={prepare:q=>({get:()=>q.includes('sqlite_master')?{name:'pmp_practice_drafts'}:{started:4,completed:2,latestAt:123}})};assert.equal(readPracticeToolSummary(db,'u','p').total,defs.LIFE.length+defs.PROC.L.length+defs.AGILE.workbooks.length);assert.equal(readPracticeToolSummary(db,'u','p').total,55)});
