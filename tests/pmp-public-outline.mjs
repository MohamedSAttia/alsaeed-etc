/** Nested PMP public outline and saved public catalog naming preserve content records.
 * Run from the repository root; set JSDOM_MODULE if jsdom is installed elsewhere.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const {JSDOM}=await import(process.env.JSDOM_MODULE || 'jsdom');
const html=fs.readFileSync('public/index.html','utf8');
const restoredCourse=lang=>lang==='en'?'Project Management Professional':'محترف إدارة المشاريع';
const restoredPackage=lang=>lang==='en'?'PMP® — Complete Package':'PMP® — الباقة الكاملة';
const fixture=JSON.parse(fs.readFileSync('public/v15-catalog.json','utf8'));
let checks=0;
const eq=(a,b,msg)=>{assert.equal(a,b,msg);checks++;};
const ok=(value,msg)=>{assert.ok(value,msg);checks++;};
for(const live of [false,true]) {
 const dom=new JSDOM(html,{url:'https://alsaeed.test/',runScripts:'outside-only',pretendToBeVisual:true});
 const {window:w}=dom,errors=[],requests=[];
 w.addEventListener('error',e=>errors.push(e.message));
 w.fetch=async(url,opts={})=>{
  requests.push({url:String(url),method:opts.method||'GET'});
  const data=String(url)==='/api/content'?JSON.parse(JSON.stringify(fixture)):
   String(url)==='/api/catalog-availability'?{'pmp-full':{questions:1675,videos:14,videoMins:182}}:[];
  return {ok:live,status:live?200:503,json:async()=>data};
 };
 w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
 w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
 const settle=()=>new Promise(r=>setTimeout(r,120));
 const title=selector=>w.document.querySelector(selector)?.textContent.replace(/[\u2066-\u2069]/g,'').trim();
 try {
  for(const script of w.document.scripts){
   if(script.type&&script.type!=='text/javascript')continue;
   const src=script.getAttribute('src');
   if(src){if(!src.startsWith('/'))continue;w.eval(fs.readFileSync(path.join('public',new URL(src,w.location.href).pathname),'utf8'));}
   else if(script.textContent.trim()){new vm.Script(script.textContent);w.eval(script.textContent);}
  }
  await settle();
  const original=JSON.stringify({courses:w.COURSES,packages:w.PACKAGES});
  const sourcePmp=w.COURSES.find(c=>c.id==='pmp'),sourceFull=w.PACKAGES.find(p=>p.id==='pmp-full');
  eq(sourcePmp.ar,'محترف إدارة المشاريع','Saved course title remains unchanged');
  eq(sourceFull.ar,'PMP® — الباقة الكاملة','Saved full package name remains unchanged');
  eq(sourceFull.lang,'both','Learning language unchanged');
  for(const lang of ['ar','en']){
   const exact=restoredCourse(lang), packageTitle=restoredPackage(lang);
   w.__lang=lang;w.I18.set(lang);
   w.APP.go('home');await settle();
   eq(title('.pk[data-r="pkg/pmp-full"] h3'),exact,'Featured full-package heading');
   eq(title('#v31Results a[href="#pkg/pmp-full"] b'),packageTitle,'Homepage finder full-package heading');
   eq(title('#v31Course option[value="pmp"]'),exact,'Program selector');
   const search=w.document.querySelector('#v22CourseSearch');search.value='PMP';search.dispatchEvent(new w.Event('input',{bubbles:true}));
   eq(title('#v22SearchResults [role="option"] b'),exact,'Search matches the new title');
   const other=w.PACKAGES.find(p=>p.id==='pmp-sim');
   eq(title('#v31Results a[href="#pkg/pmp-sim"] b'),lang==='en'?other.en:other.ar,'Sibling package name unchanged');
   w.APP.go('programs');await settle();
   eq(title('[data-course-card="pmp"] h3 a'),exact,'Course discovery title');
   const rmp=w.COURSES.find(c=>c.id==='rmp');
   eq(title('[data-course-card="rmp"] h3 a'),lang==='en'?rmp.en:rmp.ar,'Unrelated course title unchanged');
   w.APP.go('programs?course=pmp&view=packages');await settle();
   eq(title('[data-package-card="pmp-full"] h3 a'),packageTitle,'Catalog package title');
   eq(title('[data-package-card="pmp-sim"] h3 a'),lang==='en'?other.en:other.ar,'Catalog sibling name unchanged');
   eq(w.document.querySelector('[data-package-card="pmp-full"] h3 a').getAttribute('href'),'#pkg/pmp-full','Package route unchanged');
   w.APP.go('course/pmp');await settle();
   eq(title('.cd-hero-copy h1'),exact,'Course heading');
   eq(w.document.querySelector('.cd-hero-copy h1').getAttribute('lang'),null,'Original course heading markup restored');
   eq(w.document.querySelectorAll('.cd-topics > li').length,18,'Public outline top-level topic count');
   const outline=w.CourseRoadmap.topics(sourcePmp), labels=outline.map(t=>lang==='en'?t.en:t.ar);
   eq(outline.find(t=>t.key==='hybrid').ar,'النهج المختلط','Requested Hybrid Arabic label');
   eq(outline.at(-1).ar,'إرشادات وتعليمات الاختبار الدولي','Requested exam-guidance Arabic label');
   assert.deepEqual(Array.from(w.document.querySelectorAll('.cd-topics > li > .public-topic-copy > .public-topic-label'),el=>el.textContent),Array.from(labels));
   const branch=w.document.querySelector('.cd-topics > .public-topic-branch');
   assert.deepEqual(Array.from(branch.querySelectorAll(':scope > .public-topic-copy > .public-topic-children > li'),el=>el.dataset.publicTopic),['initiating','planning','executing','monitoring','closing']);
   for(const child of branch.querySelectorAll(':scope > .public-topic-copy > .public-topic-children > li'))eq(child.querySelectorAll('.public-topic-children > li').length,0,'No invented subtopics under '+child.dataset.publicTopic);
   assert.deepEqual(Array.from(outline.slice(-4),t=>t.key),['final-reviews','workshops','exam-eve','exam-guidelines']);
   assert.deepEqual(Array.from(outline.find(t=>t.key==='final-reviews').children,t=>t.key),['summaries','review']);
   eq(w.CourseRoadmap.pmp.length,18,'Legacy assessment taxonomy retains its 18 keys');
   w.APP.go('pkg/pmp-full');await settle();
   eq(title('.v44-hero-heading h1'),exact,'Full-package heading');
   eq(w.document.querySelector('.v44-hero-heading h1').getAttribute('dir'),null,'Original package heading markup restored');
   ok(title('.v32-compare .is-current th').replace(/[\u2066-\u2069]/g,'').startsWith(packageTitle),'Restored package comparison title');
   ok(w.document.querySelector('[data-language-package="pmp-full"]'),'Package identity unchanged');
   eq(w.document.querySelectorAll('.pd-hero .chap-g > .chap-c').length,18,'Full-package public outline matches course');
   assert.deepEqual(Array.from(w.document.querySelectorAll('.pd-hero .chap-g > .chap-c > .public-topic-copy > .public-topic-label'),el=>el.textContent),Array.from(labels));
   eq(w.document.querySelectorAll('.pd-hero .chap-g .public-topic-children > li[data-public-topic="executing"]').length,1,'Execution appears once under Predictive');
   eq(typeof w.publicCatalogName,'undefined','Unintended public title override removed');
   eq(sourcePmp.en,'Project Management Professional','Stored English course title preserved');
  }
  eq(JSON.stringify({courses:w.COURSES,packages:w.PACKAGES}),original,'Saved course and package fields unchanged');
  eq(requests.filter(r=>r.method!=='GET').length,0,'No writes during public navigation');
  eq(errors.length,0,errors.join('\n'));
 }finally{w.close();}
}
console.log(`PASS: ${checks} assertions, AR/EN, offline and restored saved public catalog titles, public routes and untouched stored content.`);
