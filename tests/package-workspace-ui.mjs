/** Compact package navigation and chapter resources, using real rendering functions. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {JSDOM}=await import(process.env.JSDOM_MODULE||'/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js');
const html=fs.readFileSync('public/index.html','utf8'),dom=new JSDOM('<main id="host"></main>',{runScripts:'outside-only',url:'https://local.test/'}),w=dom.window;
let english=false;
w.siteEnglish=()=>english;w.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const course={id:'rmp',code:'RMP',edition:'2026',chapters:[{ar:'المحور الأول',en:'First axis'},{ar:'المحور الثاني',en:'Second axis'}],domains:[]};
const pack={id:'rmp-full',course:'rmp',ar:'دورة المخاطر',en:'Risk course',type:'full',cert:true,kinds:['video','download','exam','activity','flash']};
const progress={lessons:{0:true},exams:{full:{score:69}},activities:{},downloads:{},weeks:{}};
w.LESSONS={'rmp-full':[{ch:0,t:'First lesson',vimeo:'123',files:[{id:'a',name:'first.pdf'}]},{ch:1,t:'Second lesson',vimeo:'456',files:[{id:'b',name:'second.pdf'},{id:'c',name:'another.pdf'}]},{ch:1,t:'Deleted',deleted:true,files:[{id:'hidden',name:'deleted.pdf'}]}]};
w.LEARNING_DATA={rmp:{activities:[]}};w.CourseAssessments={markup:()=>'<div data-assessment-centre="rmp-full">Assessments</div>'};w.A=()=>({pack:()=>pack,course:()=>course,prog:()=>progress,pct:()=>50,progressSummary:()=>'<div class="learner-progress-summary">50%</div>'});
w.eval(fs.readFileSync('public/course-roadmap.js','utf8'));
w.eval('let learnTab="content",pkTab="content";'+html.slice(html.indexOf('function lessonMenuMarkup('),html.indexOf('\nfunction playLesson(',html.indexOf('function lessonMenuMarkup('))));
w.eval(html.slice(html.indexOf('function pkgTab('),html.indexOf('\nfunction sysTab(c)')));
function render(tab){w.eval('learnTab='+JSON.stringify(tab));w.document.querySelector('#host').innerHTML=w.learn('rmp-full');return w.document.querySelector('#host');}
for(english of [false,true]){
 const host=render('content');const tabs=[...host.querySelectorAll('.package-primary-nav button')];assert.deepEqual(tabs.map(b=>b.dataset.lt),['content','resources','exams','activities']);assert.equal(tabs.filter(b=>b.getAttribute('aria-current')==='page').length,1);assert.equal(host.querySelectorAll('.learning-hero,.learner-steps,.stat,.readiness-explain').length,0);assert.equal(host.querySelectorAll('[data-lt="plan"]').length,1);assert(host.querySelector('.package-more [data-lt="plan"]'));
 const files=render('resources');const axes=[...files.querySelectorAll('[data-resource-axis]')];assert.equal(axes.length,2);assert.equal(axes[0].querySelectorAll('[data-lesson-file]').length,1);assert.equal(axes[1].querySelectorAll('[data-lesson-file]').length,2);assert(!files.textContent.includes('deleted.pdf'));assert.match(axes[0].textContent,english?/First axis/:/المحور الأول/);assert.match(axes[1].textContent,english?/Second axis/:/المحور الثاني/);assert.equal(axes[1].querySelector('[data-lesson-file]').dataset.downloadPkg,'rmp-full');
 const exams=render('exams');assert(exams.querySelector('#assessmentPageTitle'));assert(exams.querySelector('[data-assessment-centre]'));assert.equal(exams.querySelectorAll('.package-primary-nav').length,1);
 const activities=render('activities');assert.match(activities.textContent,english?/No practical activities/:/لم تُنشر أنشطة/);
 render('content');render('exams');render('content');assert.equal(w.document.querySelectorAll('.package-primary-nav').length,1);assert.equal(w.document.querySelectorAll('#lnBody').length,1);
}
// Locked resources must never expose direct attachment actions.
w.eval('pkTab="resources"');w.document.querySelector('#host').innerHTML=w.pkgTab(pack,course,false);assert.equal(w.document.querySelectorAll('[data-lesson-file]').length,0);assert(w.document.querySelector('[data-buy]'));
// Independent package capabilities remain enforced, without hiding primary navigation.
pack.kinds=['download'];const limited=render('exams');assert(!limited.querySelector('[data-assessment-centre]'));assert.equal(limited.querySelectorAll('.package-primary-nav button').length,4);assert.match(limited.textContent,/not included/);
assert.deepEqual(progress.exams,{full:{score:69}});assert.equal(w.LESSONS['rmp-full'][1].ch,1);
for(const path of ['public/index.html','index.html']){const text=fs.readFileSync(path,'utf8');for(const script of [...new JSDOM(text).window.document.scripts])if(!script.src&&script.textContent.trim())new Function(script.textContent);if(path==='public/index.html')assert(text.includes("let learnTab = 'content'"));}
dom.window.close();console.log('PASS: four tabs, compact persistent shell, AR/EN chapter resources, protected downloads, empty activity state, repeated navigation, package capabilities and unchanged progress/lesson IDs');
