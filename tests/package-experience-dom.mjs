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
    if (src?.includes('package-experience.js')) continue;
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
  assert.ok(APP && window.PACKAGES?.length, 'Real application and catalog loaded');
  window.eval(await readFile('public/package-experience.js', 'utf8'));
  const pids = window.PACKAGES.filter(pkg => pkg.active !== false).map(pkg => pkg.id);
  APP.go('chat'); await settle(); assert(!document.querySelector('[data-community-chat]'),'anonymous chat route is gated');
  const originalData = JSON.stringify({ packages: window.PACKAGES, courses: window.COURSES });
  for (const language of ['ar', 'en']) {
    window.__lang = language;
    window.I18.set(language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    for (const pid of pids) {
      window.localStorage.setItem('learning-language:' + pid, language);
      APP.go('pkg/' + pid);
      await settle();
      const outline = document.querySelector('.package-exp-outline');
      assert.ok(outline, pid + ': outline exists');
      assert.equal(document.querySelectorAll('.package-exp-outline').length, 1);
      assert.ok(outline.querySelectorAll('button').length >= 5);
      const hash = window.location.hash;
      outline.querySelector('button').click();
      assert.equal(window.location.hash, hash);
      assert.ok(document.activeElement.classList.contains('package-exp-heading'));
      for (const value of document.querySelectorAll('.pd-s b.num')) {
        assert.equal(value.classList.contains('package-exp-text-value'), /[\u0621-\u064A]/.test(value.textContent), 'Arabic duration units use body typography; numeric-only metrics keep mono');
      }
      assert.equal(document.querySelector('label[for="promoIn"]').htmlFor, document.querySelector('#promoIn').id);
      assert.equal(document.querySelector('.v32-compare-scroll').tabIndex, 0);
      window.PACKAGE_EXPERIENCE.refresh(); window.PACKAGE_EXPERIENCE.refresh();
      assert.equal(document.querySelectorAll('.package-exp-outline').length, 1);
    }
  }
  assert.equal(JSON.stringify({ packages: window.PACKAGES, courses: window.COURSES }), originalData);
  console.log('PASS: ' + pids.length + ' actual package detail renderers in Arabic and English, outline, route stability, labels, keyboard region and immutable catalog');

  // All access/progress exists in memory inside this isolated DOM. No API or database writes.
  APP.DB.users.push({ id: 'ui-fixture', name: 'Fixture', role: 'student', packages: pids.map(id => ({ id })) });
  APP.DB.session = 'ui-fixture';
  APP.go('chat'); await settle(); assert.equal(document.querySelectorAll('[data-community-chat]').length,1); assert(document.querySelector('#nav [data-r="chat"]'));
  APP.go('dash'); await settle(); assert(document.querySelector('.v32-dash-actions [data-r="chat"]'));

  const order = ['home', 'content', 'exams', 'resources', 'library', 'community'];
  for (const language of ['ar', 'en']) {
    window.__lang = language; window.I18.set(language);
    for (const pid of pids) {
      window.localStorage.setItem('learning-language:' + pid, language);
      APP.go('learn/' + pid); await settle();
      const nav=document.querySelector('.package-primary-nav');
      assert.ok(nav,pid+': compact navigation exists');
      assert.deepEqual([...nav.querySelectorAll('[data-lt]')].map(b=>b.dataset.lt),order);
      assert.equal(nav.querySelectorAll('[aria-current="page"]').length,1);
      assert.equal(nav.querySelectorAll('svg[aria-hidden="true"]').length,6,'Original navigation icons retain text labels');
      assert.equal(document.querySelectorAll('.package-exp-nav').length,0,'Legacy enhancer does not duplicate compact navigation');
      assert.equal(document.querySelector('#lnBody').getAttribute('role'),'region');
      const pkg=APP.pack(pid),kinds=pkg.kinds||[];
      const secondary=['plan',...(kinds.includes('flash')?['flash']:[]),...(kinds.includes('game')?['games']:[]),'workspace',...(pkg.type==='full'&&pkg.cert?['cert']:[])];
      assert.deepEqual([...document.querySelectorAll('.package-more [data-lt]')].map(b=>b.dataset.lt),secondary,pid+': secondary tools retained');
      const data=JSON.stringify({packages:window.PACKAGES,courses:window.COURSES,progress:APP.DB.progress});
      window.PACKAGE_EXPERIENCE.refresh();window.PACKAGE_EXPERIENCE.refresh();
      assert.equal(document.querySelectorAll('.package-primary-nav').length,1);
      assert.equal(document.getElementById('app').dataset.packageExperience,undefined,'Legacy state cleaned on compact route');
      assert.equal(JSON.stringify({packages:window.PACKAGES,courses:window.COURSES,progress:APP.DB.progress}),data);
      nav.querySelector('[data-lt="content"]').click();await settle();
      assert(document.querySelector('.learning-section-strip .learning-home-button'),'Clear course-home action on content');
      for(const article of document.querySelectorAll('.learning-lesson'))assert(article.closest('.learning-video-grid'),'No orphan lesson outside chapter grid');
      for(const group of document.querySelectorAll('[data-learning-group]'))assert.equal(group.tagName,'DETAILS','Every chapter remains collapsible');
    }
  }
  console.log('PASS: all package learner shells in AR/EN, six primary sections, conditional secondary tools and legacy enhancement safe no-op');

  const full = window.PACKAGES.find(pkg => pkg.id === 'rmp-full') || window.PACKAGES.find(pkg => pkg.type === 'full');
  APP.DB.progress['ui-fixture'][full.id] = { lessons: {}, weeks: { 1: true, 2: false }, exams: { prior: { score: 72, passed: true } }, activities: { 0: true }, games: {}, downloads: { guide: { name: 'Guide' } } };
  APP.go('learn/' + full.id); await settle();
  const toolbar=document.querySelector('.package-toolbar').textContent;
  assert.match(toolbar,/Exam average\s*72%\s*·\s*1 recorded/);
  assert.match(toolbar,/Video progress/);
  assert.doesNotMatch(toolbar,/Video progress\s*72%/,'Exam score must not become video progress');
  assert.equal(APP.prog(full.id).exams.prior.score,72,'Recorded score retained');
  const resources=document.querySelector('.package-primary-nav [data-lt="resources"]');
  assert.equal(typeof resources.onclick,'function','Existing application handler retained');
  resources.click();await settle();
  assert.equal(document.activeElement.id,'packageSectionTitle');
  assert.equal(document.querySelector('#lnBody').getAttribute('aria-labelledby'),'packageSectionTitle');
  document.querySelector('.package-more [data-lt="plan"]').click();await settle();
  assert.equal(document.activeElement.id,'packageSectionTitle');
  const readiness=document.querySelector('.package-progress-details');assert(readiness,'Readiness remains available under study plan');
  readiness.querySelector('summary').click();assert(readiness.open);
  APP.go('pkg/' + full.id); await settle();
  const related = document.querySelector('.package-exp-detail [role="link"]');
  const destination = related.dataset.r;
  related.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await settle();
  assert.equal(window.location.hash, '#' + destination);
  APP.go('home'); await settle();
  assert.equal(document.getElementById('app').dataset.packageExperience, undefined);
  assert.equal(document.querySelectorAll('.package-exp-nav,.package-exp-outline').length, 0);
  assert.equal(JSON.stringify({ packages: window.PACKAGES, courses: window.COURSES }), originalData);
  assert.deepEqual(errors, []);
  console.log('PASS: retained click handlers, focus restoration after render, progress link, Enter on related package, route cleanup and no script errors');
  console.log('NOT RUN: real browser layout, screenshots, live authentication, enrollment, payment and production progress/attempts.');
} finally { dispose(); }
