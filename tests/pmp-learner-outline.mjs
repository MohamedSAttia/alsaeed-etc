/** Local fixtures only: exercises the real learner content and study-plan renderer. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const {JSDOM}=await import(process.env.JSDOM_MODULE||'jsdom');
const source=fs.readFileSync('public/index.html','utf8');
const dom=new JSDOM('<!doctype html><main id="app"></main>',{url:'https://local.test/',runScripts:'outside-only'});
const {window:w}=dom,ctx=dom.getInternalVMContext(),app=w.document.getElementById('app');
const course={id:'pmp',chapters:['المقدمة','Scope','Planning','مرحلة التنفيذ','Custom chapter'],domains:[]};
const pkg={id:'pmp-local',course:'pmp',kinds:['video','quiz','activity'],days:90};
const lessons=[
 {id:'stable-1',ch:0,t:'مقدمة البرنامج',vimeo:'100',free:true,notes:'Original introduction'},
 {id:'stable-2',ch:1,t:'Scope fundamentals',vimeo:'101',files:[{id:'scope-file',name:'Original scope.pdf'}]},
 {id:'stable-3',ch:2,t:'Scope planning lesson',vimeo:'102',quiz:[{id:'original-quiz'}]},
 {id:'stable-4',ch:3,t:'الموارد في مرحلة التنفيذ',vimeo:'103',notes:'Original executing notes',notes_en:'Original executing notes'},
 {id:'stable-5',ch:4,t:'Agile Approach',vimeo:'104'},
 {id:'stable-6',ch:4,t:'Hybrid Approach',vimeo:'105'},
 {id:'stable-7',ch:4,t:'Actual Exam Guidelines and Instructions',vimeo:'106'},
 {id:'stable-8',ch:4,t:'Unmapped original lesson',vimeo:'107'},
 {id:'stable-9',ch:4,t:'Comparing Agile and Predictive approaches',vimeo:'108'},
 {id:'stable-10',ch:4,t:'Risk planning techniques',vimeo:'109'},
 {id:'stable-11',ch:4,t:'Predictive Approach overview',vimeo:''},
 {id:'stable-12',ch:4,t:'عنوان عربي',t_en:'Hybrid Approach workshop',vimeo:'111'},
 {id:'stable-13',ch:4,t:'Closing phase: procurement lesson',vimeo:'112'},
 {id:'stable-14',ch:4,t:'مراجعة عامة',vimeo:'113',notes:'<img src=x onerror=bad()>',files:[{id:'unsafe',name:'<img src=x onerror=bad()>'}]}
];
const progress={lessons:{0:true,3:true,7:true,9:true,13:true},weeks:{1:true},exams:{chapter_scope:{score:83}},activities:{2:true}};
const snapshot=JSON.stringify({course,pkg,lessons,progress});
w.LESSONS={[pkg.id]:lessons};w.CONTENT_KINDS=[];w.LEARNING_DATA={pmp:{activities:[{ar:'Activity A',en:'Activity A'},{ar:'Activity B',en:'Activity B'},{ar:'Activity C',en:'Activity C'}]}};
const escape=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
ctx.esc=escape;ctx.siteEnglish=()=>w.__lang==='en';ctx.course=()=>course;ctx.pack=()=>pkg;
ctx.A=()=>({prog:()=>progress,studyPlan:()=>ctx.studyPlan(pkg.id)});w.APP={esc:escape};
w.biTitle=l=>w.__lang==='en'?(l.t_en||l.t):(l.t||l.t_en);
function readFunction(name){const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);assert.ok(start>=0);return source.slice(start,end<0?undefined:end);}
for(const name of ['publicCourseTopics','publicTopicBody','studyPlan','pkgTab'])vm.runInContext(readFunction(name),ctx);
for(const file of ['public/course-roadmap.js','public/pmp-reading.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
const r=w.CourseRoadmap;
const keys=['intro','exam','framework','value','principles','lifecycles','agile','predictive','hybrid','people','process','business','journey','review','exam-guidelines'];
const tree=r.learnerGroups(course,lessons),flat=tree.flatMap(r.lessonItems);
assert.deepEqual(Array.from(tree.slice(0,15),g=>g.key),keys);
assert.deepEqual(Array.from(tree[7].children,g=>g.key),['initiating','planning','executing','monitoring','closing']);
assert.equal(flat.length,lessons.length);
assert.deepEqual(Array.from(flat,l=>l.i).sort((a,b)=>a-b),lessons.map((_,i)=>i));
assert.deepEqual(Array.from(flat,l=>l.id).sort(),lessons.map(l=>l.id).sort());
for(const item of flat){const {i,...rest}=item;assert.equal(JSON.stringify(rest),JSON.stringify(lessons[i]));}
const find=key=>tree.find(g=>g.key===key);
assert.deepEqual(Array.from(r.lessonItems(find('agile')),l=>l.i),[4]);
assert.deepEqual(Array.from(r.lessonItems(find('hybrid')),l=>l.i),[5,11]);
assert.deepEqual(Array.from(r.lessonItems(find('exam-guidelines')),l=>l.i),[6]);
assert.deepEqual(Array.from(r.lessonItems(find('predictive').children[1]),l=>l.i),[2]);
assert.deepEqual(Array.from(r.lessonItems(find('predictive').children[2]),l=>l.i),[3]);
assert.deepEqual(Array.from(r.lessonItems(find('predictive').children[4]),l=>l.i),[12]);
assert.deepEqual(Array.from(find('predictive').children[4].children.find(g=>g.key==='procurement').items,l=>l.i),[12],'Explicit closing procurement title maps to its existing nested subtopic');
assert.deepEqual(Array.from(r.lessonItems(find('shared-resources')),l=>l.i).sort((a,b)=>a-b),[1,7,8,9,13]);
for(const [title,key] of [['Initiating','initiating'],['مرحلة التخطيط','planning'],['التنفيذ','executing'],['Monitoring & Controlling','monitoring'],['Closing','closing']]){
 const phases=r.learnerGroups({id:'pmp',chapters:[]},[{ch:99,t:title,vimeo:'123456'}]).find(g=>g.key==='predictive').children;
 assert.equal(r.lessonItems(phases.find(g=>g.key===key))[0].i,0,'Exact phase title retained and displayed');
}
assert.equal(r.pmp.length,18,'Existing assessment taxonomy retained');
assert.equal(r.groups(course,[]).length,18,'Legacy API retained');
assert.equal(JSON.stringify(r.learnerGroups({id:'rmp',chapters:['RMP']},lessons)),JSON.stringify(r.groups({id:'rmp',chapters:['RMP']},lessons)));
const planBefore=JSON.stringify(ctx.studyPlan(pkg.id));
const originalAssessments=Array.from(r.groups(course,lessons)).filter(g=>!['intro','exam','journey','review'].includes(g.key)).map(g=>String(g.key).startsWith('saved_')?g.title:g.key).sort();
for(const language of ['ar','en']){
 w.__lang=language;ctx.pkTab='content';app.innerHTML=ctx.pkgTab(pkg,course,true);
 assert.deepEqual(Array.from(app.querySelectorAll('.learning-outline > details'),x=>x.dataset.learningGroup).slice(0,15),keys);
 assert.equal(app.querySelectorAll('.learning-outline > details[data-learning-group="scope"]').length,0);
 assert.equal(app.querySelectorAll('[data-lesson-index]').length,lessons.length);
 assert.deepEqual(Array.from(app.querySelectorAll('[data-lesson-index]'),x=>Number(x.dataset.lessonIndex)).sort((a,b)=>a-b),lessons.map((_,i)=>i));
 assert.equal(app.querySelectorAll('[data-lesson]').length,lessons.filter(l=>l.vimeo).length);
 assert.deepEqual(Array.from(app.querySelectorAll('.ls.done'),x=>Number(x.closest('[data-lesson-index]').dataset.lessonIndex)).sort((a,b)=>a-b),[0,3,7,9,13]);
 assert.deepEqual(Array.from(app.querySelectorAll('[data-learning-chapter]'),x=>x.dataset.learningChapter).sort(),originalAssessments);
 assert.equal(app.querySelectorAll('.pmp-topic-reading').length,18,'All pre-existing readings retained exactly once');
 assert.equal(app.querySelectorAll('[data-lesson-file="scope-file"]').length,1);
 assert.equal(app.querySelectorAll('img[onerror]').length,0);
 assert.match(app.textContent,/5\/13 \(38%\)/);
 assert.deepEqual(Array.from(app.querySelectorAll('.learning-lesson .ls > .num'),x=>Number(x.textContent)),Array.from({length:13},(_,i)=>i+1));
 ctx.pkTab='plan';app.innerHTML=ctx.pkgTab(pkg,course,true);
 assert.deepEqual(Array.from(app.querySelectorAll('[data-plan-topic]'),x=>x.dataset.planTopic),keys);
 assert.equal(app.querySelectorAll('[data-week="1"]').length,1);
 assert.ok(app.querySelector('.wk.done [data-week="1"]'));
 ctx.pkTab='activities';app.innerHTML=ctx.pkgTab(pkg,course,true);
 assert.deepEqual(Array.from(app.querySelectorAll('[data-activity]'),x=>x.dataset.activity),['0','1','2']);
 assert.equal(app.querySelector('[data-activity="2"]').classList.contains('n'),true);
}
ctx.pkTab='plan';app.innerHTML=ctx.pkgTab({...pkg,kinds:['exam']},course,true);
assert.equal(app.querySelector('.learner-course-outline [data-lt=content]'),null,'Simulation-only package has no content-navigation dead end');
w.__lang=undefined;
assert.equal(JSON.stringify(ctx.studyPlan(pkg.id)),planBefore,'Stored study cards and weekly progress identities unchanged');
ctx.pkTab='content';app.innerHTML=ctx.pkgTab(pkg,course,false);
assert.equal(app.querySelectorAll('[data-lesson]').length,1,'Only original free video remains playable to guest');
assert.equal(app.querySelectorAll('.pmp-topic-reading').length,0,'Readings remain gated');
assert.equal(app.querySelectorAll('[data-lesson-file]').length,0,'Paid lesson attachments remain gated');
assert.equal(JSON.stringify({course,pkg,lessons,progress}),snapshot,'All lesson data and all progress untouched');
dom.window.close();
console.log('PASS: 15 nested learner topics; 14 exact lesson IDs/indices, 13 videos, 5 completions, notes/files/quizzes preserved; 18 readings and original test keys; stable weeks and activity IDs; AR/EN and guest gating.');
