import assert from 'node:assert/strict';
import fs from 'node:fs';
await import('../public/course-roadmap.js');
const R=globalThis.CourseRoadmap;
const course={id:'pmp',chapters:['أسس المشاريع','الحوكمة','Custom authored heading',{outlineKey:'value',ar:'نظام القيمة',en:'Value system',outlineParent:null,outlineOrder:0},{outlineKey:'planning',ar:'التخطيط',en:'Planning',outlineParent:null}]};
const lessons=[{ch:0,t:'مبادئ إدارة المشاريع',vimeo:'private-1'},{ch:1,t:'Governance workshop',vimeo:'private-2'},{ch:2,t:'Unique custom trainer video',vimeo:'private-3'},{ch:3,t:'Value lesson',vimeo:'private-4'},{ch:4,t:'Planning example',vimeo:'private-5'},{ch:0,t:'Artificial intelligence',vimeo:'private-6'},{ch:0,t:'PMP Application',vimeo:'private-7'},{ch:0,t:'Exam eve',vimeo:'private-8'},{ch:0,t:'Deleted',vimeo:'private-9',deleted:true}];
const before=JSON.stringify({course,lessons}), groups=R.videoGroups(course,lessons),flat=nodes=>nodes.flatMap(n=>[n,...flat(n.children||[])]);
assert.equal(JSON.stringify({course,lessons}),before);
assert.deepEqual(R.videoOrder(course,lessons).slice().sort((a,b)=>a-b),[0,1,2,3,4,5,6,7]);
assert.equal(new Set(R.videoOrder(course,lessons)).size,8);
assert(!groups.some(g=>['value','principles','lifecycles','source_2','planning'].includes(g.key)));
assert(flat(groups.find(g=>g.key==='framework').children).some(g=>g.key==='value'));
assert(flat(groups.find(g=>g.key==='predictive').children).some(g=>g.key==='planning'));
assert(groups.find(g=>g.key==='additional-materials').children.some(g=>g.title==='Custom authored heading'));
assert.deepEqual(groups.slice(-2).map(g=>g.key),['exam-guidelines','exam-eve']);
assert(groups.some(g=>g.key==='ai'));
assert.deepEqual(R.assessmentOutline(course).chapters.map(g=>g.key),['framework','agile','predictive','hybrid']);
assert.deepEqual(R.assessmentOutline(course).domains.map(g=>g.key),['people','process','business']);
assert.deepEqual(R.assessmentOutline(course).mocks.map(g=>g.number),[1,2,3,4,5]);
const source=fs.readFileSync('public/index.html','utf8');
assert(source.includes("const topics=c.id==='pmp'?publicCourseTopics(c,p.id)"));
assert(source.includes('window.CATALOG_AVAILABILITY?.[id]?.curriculum'));
assert(source.includes('publicAssessmentPreview(c,p.id)'));
console.log('PASS: canonical displayed roots, preserved authored IDs and unknown materials, no duplicate lessons, real AI, predictive nesting and guidance order; all package previews use published metadata');
const vm=await import('node:vm');
const metadata={curriculum:[{key:'framework',ar:'إطار منشور',en:'Published framework',videoCount:1,children:[]}],assessments:{status:'verified',questions:12,chapters:R.assessmentOutline(course).chapters.map(x=>({...x,questionCount:x.key==='framework'?12:0})),domains:[],fullMocks:{status:'verified',availableCount:0}}};
const ctx={window:{CourseRoadmap:R,PACKAGES:[{id:'pmp-full',course:'pmp'},{id:'pmp-sim',course:'pmp'}],CATALOG_AVAILABILITY:{'pmp-full':metadata,'pmp-sim':{curriculum:[],assessments:metadata.assessments}}},A:()=>({live:true}),siteEnglish:()=>true,esc:s=>String(s).replace(/</g,'&lt;')};vm.createContext(ctx);
for(const name of ['publishedCoursePackage','publicCourseTopics','publicAssessmentPreview']){const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);vm.runInContext(source.slice(start,end),ctx);}
assert.deepEqual(ctx.publicCourseTopics(course,'pmp-full'),metadata.curriculum);
assert.equal(ctx.publicCourseTopics(course,'pmp-sim').length,0,'No synthetic video chapters for a simulation-only package');
const preview=ctx.publicAssessmentPreview(course,'pmp-full');assert(preview.includes('12 published questions'));assert(preview.includes('Full mock 5'));assert(preview.includes('Not currently available'));assert(!preview.includes('private-'));
assert(preview.indexOf('Project management framework')<preview.indexOf('Agile Approach'));
ctx.window.CATALOG_AVAILABILITY={};assert.equal(ctx.publicCourseTopics(course,'pmp-full').length,0,'Missing live publication data never falls back to stale labels');
assert(ctx.publicAssessmentPreview(course,'pmp-full').includes('Availability not verified'));
console.log('PASS: guest package renderer uses each package publication, handles empty/unavailable metadata honestly, shows four/three/five structure without paid content');

const nested=R.learnerGroups({id:'pmp',chapters:[{outlineKey:'agile',outlineParent:'framework',ar:'رشيق',en:'Agile'}]},[]);assert(nested.some(g=>g.key==='agile'));assert(!nested.find(g=>g.key==='framework').children.some(g=>g.key==='agile'));

const inverted=R.learnerGroups({id:'pmp',chapters:[{outlineKey:'framework',outlineParent:'value',ar:'إطار',en:'Framework'}]},[]);assert.equal(inverted.find(g=>g.key==='framework').children.filter(g=>g.key==='value').length,1);assert.doesNotThrow(()=>JSON.stringify(inverted));
