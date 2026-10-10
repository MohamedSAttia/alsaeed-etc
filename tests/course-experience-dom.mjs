/** DOM integration, not visual/authentication QA. Run with JSDOM_MODULE if jsdom is not installed locally. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
let jsdom;
try { jsdom = await import(process.env.JSDOM_MODULE || 'jsdom'); }
catch (error) {
  const local = '/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js';
  if (!existsSync(local)) throw error;
  jsdom = await import(pathToFileURL(local).href);
}
const html = await readFile('public/index.html', 'utf8');
const dom = new jsdom.JSDOM(html, { url: 'http://package-ui.test/', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
// Dispose observers and animation callbacks before jsdom destroys its document.
const observers = new Set(), frames = new Set();
const NativeObserver = window.MutationObserver;
window.MutationObserver = class extends NativeObserver {
  constructor(callback) { super(callback); observers.add(this); }
};
const requestFrame = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = callback => {
  const id = requestFrame(time => { frames.delete(id); callback(time); });
  frames.add(id); return id;
};
function dispose() {
  for (const observer of observers) observer.disconnect();
  for (const id of frames) window.cancelAnimationFrame(id);
  window.close();
}
const errors = [];
window.addEventListener('error', event => errors.push(event.message));
window.fetch = async () => ({ ok: false, status: 503, json: async () => ({ error: 'Local presentation fixture' }) });
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = function () { this.dataset.testScrolled = 'true'; };
window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
const settle = () => new Promise(done => setTimeout(done, 120));
try {
  for (const script of [...document.scripts]) {
    if (script.type && script.type !== 'text/javascript') continue;
    const src = script.getAttribute('src');
    if (src) {
      const path = new URL(src, window.location.href).pathname;
      if (!src.startsWith('/')) continue;
      const publicFile = resolve('public', '.' + path);
      const file = existsSync(publicFile) ? publicFile : resolve('.' + path);
      if (existsSync(file)) window.eval(await readFile(file, 'utf8'));
    } else if (script.textContent.trim()) window.eval(script.textContent);
  }
  await settle();
  const { APP } = window;
  if (process.env.CATALOG_FIXTURE) {
    const data=JSON.parse(await readFile(process.env.CATALOG_FIXTURE,'utf8'));
    window.PACKAGES=data.packages;window.COURSES=data.courses;if(data.cms)window.CMS.sessions=data.cms.sessions||[];
  }
  const courses=window.COURSES.filter(c=>window.PACKAGES.some(p=>p.course===c.id&&p.active!==false));
  const before=JSON.stringify({courses:window.COURSES,packages:window.PACKAGES,sessions:window.CMS.sessions});
  for(const language of ['ar','en']) {
    window.__lang=language;window.I18.set(language);
    for(const course of courses) {
      APP.go('course/'+course.id);await settle();
      assert.equal(document.querySelector('h1').textContent,language==='en'?course.en||course.ar:course.ar||course.en);
      assert.equal(document.querySelector('[data-course-experience]').dataset.courseExperience,course.id);
      assert.ok(document.body.classList.contains('course-design-page-active'));
      assert.ok(document.documentElement.classList.contains('course-design-document'));
      assert.equal(document.querySelectorAll('.cd-section-nav').length,1);
      const pkgs=window.PACKAGES.filter(p=>p.course===course.id&&p.active!==false);
      assert.equal(document.querySelectorAll('.cd-options .v25-option').length,pkgs.length);
      const minima=new Map();for(const p of pkgs)if(!minima.has(p.currency)||Number(p.price)<Number(minima.get(p.currency).price))minima.set(p.currency,p);
      assert.equal(document.querySelectorAll('.cd-sidebar .cd-price-value').length,minima.size);
      for(const p of minima.values())assert.ok(document.querySelector('.cd-sidebar .cd-price-list').textContent.includes(p.currency));
      assert.equal(document.querySelectorAll('.cd-topics li').length,(course.chapters||[]).length);
      const history=window.location.hash;
      for(const button of document.querySelectorAll('.cd-section-nav [data-course-jump]')) {
        const target=document.getElementById(button.dataset.courseJump);assert.ok(target);
        button.click();assert.ok(target.contains(document.activeElement)||target===document.activeElement);
        assert.equal(window.location.hash,history,'Section navigation does not collide with app routes');
      }
      const group=document.querySelector('.cd-team-card a');
      assert.equal(new URL(group.href).pathname,'/966544375447');
      assert.ok(new URL(group.href).searchParams.get('text').includes(language==='en'?course.en||course.ar:course.ar||course.en));
      const formatFilter=document.querySelector('.cd-options [data-v25-filter]:not([data-v25-filter="all"])');
      if(formatFilter){formatFilter.click();for(const card of document.querySelectorAll('.cd-options .v25-option'))assert.equal(card.hidden,card.dataset.v25Lang!==formatFilter.dataset.v25Filter);}
      document.querySelector('.cd-options [data-v25-filter="all"]').click();
      assert.ok([...document.querySelectorAll('.cd-options .v25-option')].every(card=>!card.hidden));
      assert.equal(document.querySelectorAll('.cd-mobile-action').length,1);
    }
    APP.go('pkg/pmp-full');await settle();
    assert.equal(document.querySelectorAll('.cd-package-action').length,1);
    assert.ok(document.querySelector('.package-exp-promo-in-hero'),'PMP video retains requested hero slot');
    assert.ok(document.querySelector('.package-exp-certificate'),'Existing sample retained');
    const card=document.querySelector('#cd-package-enrollment');
    document.querySelector('[data-package-price-jump]').click();
    assert.ok(card.contains(document.activeElement));
    assert.equal(document.querySelector('#promoGo').textContent,language==='en'?'Apply':'تطبيق');
    APP.go('contact');await settle();
    assert.equal(document.querySelector('.cd-mobile-action'),null);
    assert.ok(!document.body.classList.contains('package-design-page-active'));
    assert.ok(!document.body.classList.contains('course-design-page-active'));
    assert.ok(!document.documentElement.classList.contains('course-design-document'));
    const contact=document.querySelector('.cd-saudi-contact');assert.ok(contact);
    assert.equal(contact.querySelector('a').href,'tel:+966544375447');
    assert.equal(contact.querySelector('bdi').dir,'ltr');
    assert.equal(contact.querySelector('bdi').textContent,'+966544375447');
    assert.ok(contact.querySelector('a[href="https://wa.me/966544375447"]'));
    assert.ok(document.querySelector('a[href="tel:+201221732898"]'),'Existing contact retained');
  }
  // Explicitly distinguish published group dates, curriculum hours and package access.
  const savedSessions=window.CMS.sessions;
  const pmp=window.COURSES.find(c=>c.id==='pmp');
  const recorded=window.PACKAGES.find(p=>p.id==='pmp-full');
  const date=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  window.CMS.sessions=[{course:'pmp',date,time:'19:00',timezone:'Asia/Riyadh',mode:'live',published:true,trainingDays:5}];
  for(const language of ['ar','en']){
    window.__lang=language;window.I18.set(language);
    const facts=window.courseScheduleFacts(pmp), recordedFacts=window.courseScheduleFacts(pmp,recorded);
    assert.equal(facts.find(x=>x.key==='days').value,language==='en'?'5 days':'5 أيام');
    assert.equal(facts.find(x=>x.key==='time').value,'19:00 · Asia/Riyadh');
    assert.ok(facts.find(x=>x.key==='hours').value.includes(String(pmp.hours)));
    assert.equal(recordedFacts.find(x=>x.key==='date').value,language==='en'?'At your own pace':'حسب وقتك');
    assert.equal(recordedFacts.some(x=>x.key==='time'),false);
    assert.ok(recordedFacts.find(x=>x.key==='access').value.includes(String(recorded.days)));
    APP.go('course/pmp');await settle();
    assert.equal(document.querySelector('.cd-hero-art [data-schedule-fact="days"] dd').textContent,language==='en'?'5 days':'5 أيام');
    APP.go('pkg/pmp-full');await settle();
    assert.equal(document.querySelectorAll('.cd-package-media').length,1);
    assert.equal(document.querySelectorAll('.package-exp-promo-in-hero').length,1);
    assert.equal(document.querySelector('.cd-package-media [data-schedule-fact="date"] dd').textContent,language==='en'?'At your own pace':'حسب وقتك');
  }
  delete window.CMS.sessions[0].trainingDays;
  assert.equal(window.courseScheduleFacts(pmp).find(x=>x.key==='days').value,'To be confirmed with the group');
  window.CMS.sessions=savedSessions;
  assert.equal(JSON.stringify({courses:window.COURSES,packages:window.PACKAGES,sessions:window.CMS.sessions}),before);
  assert.deepEqual(errors,[],'No runtime script errors');
  console.log(`PASS: ${courses.length} courses in AR/EN, course sections/real packages/currencies/topics, preserved filter handlers, route-safe navigation, Saudi contact/group context, package rail/mobile CTA and cleanup, immutable data`);
} finally { dispose(); }
