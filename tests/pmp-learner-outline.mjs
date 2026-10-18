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
const keys=['intro','exam','framework','agile','predictive','hybrid','people','process','business','value','principles','lifecycles','ai','final-reviews','workshops','exam-eve','exam-guidelines'];
const tree=r.learnerGroups(course,lessons),flat=tree.flatMap(r.lessonItems);
assert.deepEqual(Array.from(tree.filter(g=>!g.originalChapter),g=>g.key),keys);
assert.deepEqual(Array.from(tree[0].children,g=>g.key),['journey']);
assert.equal(tree[1].key,'exam');assert.equal(tree[1].readingKey,'exam');assert.equal(tree[1].children.length,0);
assert.deepEqual(Array.from(tree[4].children,g=>g.key),['initiating','planning','executing','monitoring','closing']);
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
assert.ok(find('predictive').children.every(g=>g.children.length===0),'No artificial subtopics remain under a phase');
assert.deepEqual(Array.from(tree.filter(g=>g.originalChapter).flatMap(r.lessonItems),l=>l.i).sort((a,b)=>a-b),[1,7,8,9,13]);
for(const [title,key] of [['Initiating','initiating'],['مرحلة التخطيط','planning'],['التنفيذ','executing'],['Monitoring & Controlling','monitoring'],['Closing','closing']]){
 const phases=r.learnerGroups({id:'pmp',chapters:[]},[{ch:99,t:title,vimeo:'123456'}]).find(g=>g.key==='predictive').children;
 assert.equal(r.lessonItems(phases.find(g=>g.key===key))[0].i,0,'Exact phase title retained and displayed');
}
assert.equal(r.pmp.length,18,'Existing assessment taxonomy retained');
assert.equal(r.groups(course,[]).length,18,'Legacy API retained');
assert.equal(r.topics(course).find(t=>t.key==='people').ar,'مجال الأفراد','Requested default People label');
assert.equal(r.pmp.find(t=>t[0]==='people')[1],'مجال الأشخاص','Legacy assessment taxonomy is unchanged');
const authoredPeople={id:'pmp',chapters:[{outlineKey:'people',ar:'مجال مخصص من المدرب',en:'Trainer-authored people label',custom:{preserved:true}}]};
const authoredPeopleBefore=JSON.stringify(authoredPeople);
assert.equal(r.topics(authoredPeople).find(t=>t.key==='people').ar,'مجال مخصص من المدرب');
assert.equal(r.learnerGroups(authoredPeople,[]).find(t=>t.key==='people').title,'مجال مخصص من المدرب');
assert.equal(r.adminGroups(authoredPeople,[]).find(t=>t.key==='people').ar,'مجال مخصص من المدرب');
assert.equal(JSON.stringify(authoredPeople),authoredPeopleBefore,'Explicit author labels/metadata remain the source of truth');

assert.equal(JSON.stringify(r.learnerGroups({id:'rmp',chapters:['RMP']},lessons)),JSON.stringify(r.groups({id:'rmp',chapters:['RMP']},lessons)));
assert.equal(find('shared-resources'),undefined,'Rejected additional-lesson branch removed');
assert.deepEqual(Array.from(tree.slice(-4),g=>g.key),['final-reviews','workshops','exam-eve','exam-guidelines']);
assert.deepEqual(Array.from(find('final-reviews').children,g=>g.key),['summaries','review']);
assert.equal(find('ai').items.length,0,'No synthetic AI lessons');
for(const [title,key] of [['الذكاء الاصطناعي','ai'],['Artificial intelligence','ai'],['AI','ai'],['المراجعات النهائية','final-reviews'],['Final reviews','final-reviews'],['ملخصات','summaries'],['Summaries','summaries'],['حل أهم الأسئلة','review'],['Key question review','review'],['ورش العمل التطبيقية','workshops'],['Practical workshops','workshops'],['ليلة الاختبار','exam-eve'],['Exam eve','exam-eve'],['إرشادات وتعليمات الاختبار الدولي','exam-guidelines'],['International Exam Guidelines and Instructions','exam-guidelines'],['PMP® Eligibility and Application','intro'],['متطلبات تقديم الاختبار الدولى والاهليه','intro'],['PMP Application','exam-guidelines'],['Pay for Exam Steps','exam-guidelines'],['Schedule Exam Steps','exam-guidelines'],['PMP® Exam Interface and Results','intro'],['واجهة اختبار PMP وتقرير النتائج','intro'],['PMP® Exam Structure and Question Types','exam'],['هيكل اختبار محترف ادارة المشاريع وأنواع الأسئلة','exam']]){
 for(const useChapter of [false,true]){
  const future={id:'future-admin-lesson',ch:0,t:useChapter?'Lesson 1':title,vimeo:'321',notes:'Saved admin lesson'};
  const routed=r.learnerGroups({id:'pmp',chapters:useChapter?[title]:[]},[future]);
  const allNodes=groups=>groups.flatMap(g=>[g,...allNodes(g.children)]);
  const target=allNodes(routed).find(g=>g.key===key);
  assert.deepEqual(Array.from(target.items,l=>l.i),[0],title+' routes from a saved admin title or chapter');
  assert.equal(routed.flatMap(r.lessonItems).length,1,'Future admin lesson appears exactly once');
 }
}
for(const title of ['Schedule risk fundamentals','Finance and payment planning','Exam management overview']){
 const routed=r.learnerGroups({id:'pmp',chapters:[]},[{ch:99,t:title,vimeo:'123'}]);
 assert.equal(routed.find(g=>g.key==='exam-guidelines').items.length,0,'General topic is not guessed to be exam guidance');
}
for(const chapters of [[],[null],['Original saved chapter']]){
 const input=[{id:'a',ch:0,t:'Unmapped lesson',vimeo:'123'},{id:'b',ch:0,t:'Unmapped second lesson',vimeo:'456'}];
 const result=r.learnerGroups({id:'pmp',chapters},input);
 assert.deepEqual(Array.from(result.flatMap(r.lessonItems),l=>l.i),[0,1],'Missing/null chapter preserves every lesson');
 assert.equal(result.filter(g=>g.originalChapter).length,1);
 const assessments=result.find(g=>g.key==='final-reviews').children.find(g=>g.key==='summaries').assessmentKeys;
 assert.equal(new Set(assessments).size,assessments.length,'Saved chapter assessment keys are unique');
 assert.equal(assessments.includes('دروس إضافية'),false,'No invented additional-lesson label for a missing source chapter');
 if(!chapters[0])assert.equal(assessments.length,0,'No assessment invented for an unnamed chapter');
}
const allRouted=r.learnerGroups({id:'pmp',chapters:['Custom saved chapter']},[{ch:0,t:'PMP Application',vimeo:'123'},{ch:0,t:'Artificial intelligence',vimeo:'456'}]);
assert.equal(allRouted.filter(g=>g.originalChapter).length,0,'No empty source sections after all original lessons route to named topics');
assert.deepEqual(Array.from(allRouted.find(g=>g.key==='final-reviews').children.find(g=>g.key==='summaries').assessmentKeys),['Custom saved chapter'],'Original chapter assessment remains reachable');
const planBefore=JSON.stringify(ctx.studyPlan(pkg.id));
const originalAssessments=Array.from(r.groups(course,lessons)).filter(g=>!['intro','exam','journey','review'].includes(g.key)).map(g=>String(g.key).startsWith('saved_')?g.title:g.key).sort();
for(const language of ['ar','en']){
 w.__lang=language;ctx.pkTab='content';app.innerHTML=ctx.pkgTab(pkg,course,true);
 assert.deepEqual(Array.from(app.querySelectorAll('.learning-outline > details'),x=>x.dataset.learningGroup),keys);
 assert.deepEqual(Array.from(app.querySelectorAll('[data-learning-group="intro"] > .learning-outline-children > [data-learning-group]'),x=>x.dataset.learningGroup),['journey']);
 assert.equal(app.querySelectorAll('.learning-outline > [data-learning-group="exam"] > .pmp-topic-reading').length,1);
 assert.equal(app.querySelectorAll('.learning-outline > details[data-learning-group="scope"]').length,0);
 assert.equal(app.querySelectorAll('[data-lesson-index]').length,lessons.length);
 assert.deepEqual(Array.from(app.querySelectorAll('[data-lesson-index]'),x=>Number(x.dataset.lessonIndex)).sort((a,b)=>a-b),lessons.map((_,i)=>i));
 assert.equal(app.querySelectorAll('[data-lesson]').length,lessons.filter(l=>l.vimeo).length);
 assert.deepEqual(Array.from(app.querySelectorAll('.ls.done'),x=>Number(x.closest('[data-lesson-index]').dataset.lessonIndex)).sort((a,b)=>a-b),[0,3,7,9,13]);
 assert.deepEqual(Array.from(app.querySelectorAll('[data-learning-chapter]'),x=>x.dataset.learningChapter).sort(),originalAssessments);
 assert.equal(app.querySelectorAll('.pmp-topic-reading').length,18,'All pre-existing readings retained exactly once');
 assert.equal(app.querySelectorAll('[data-summary-topic]').length,7,'Seven existing summaries remain in the requested Summaries child');
 assert.equal(app.querySelector('[data-learning-group="shared-resources"]'),null);
 assert.equal(app.querySelectorAll('[data-learning-group="predictive"] [data-outline-depth="2"]').length,0);
 for(const key of ['ai','workshops','exam-eve','summaries'])assert.ok(app.querySelector('[data-learning-group="'+key+'"] > .empty'),'Empty new heading is honest: '+key);
 const order=Array.from(app.querySelector('.learning-outline').children,x=>x.dataset.learningGroup);
 assert.ok(order.indexOf('ai')<order.indexOf('source_1')&&order.indexOf('source_4')<order.indexOf('final-reviews'));
 assert.equal(app.querySelector('[data-learning-group="source_1"] > h4 > b').textContent,'Scope','Unnumbered section uses original saved chapter label');
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
console.log('PASS: 17 learner topics; 14 exact lesson IDs/indices, 13 videos, 5 completions, notes/files/quizzes preserved; 18 readings and original test keys; stable weeks and activity IDs; AR/EN and guest gating.');

