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
  const order = ['plan', 'content', 'exams', 'resources', 'flash', 'activities', 'games', 'workspace', 'cert'];
  for (const language of ['ar', 'en']) {
    window.__lang = language; window.I18.set(language);
    for (const pid of pids) {
      window.localStorage.setItem('learning-language:' + pid, language);
      APP.go('learn/' + pid);
      await settle();
      const nav = document.querySelector('.package-exp-nav');
      assert.ok(nav, pid + ': consolidated navigation');
      const keys = [...nav.querySelectorAll('[data-lt]')].map(button => button.dataset.lt);
      assert.deepEqual(keys, order.filter(key => keys.includes(key)), pid + ': consistent conditional order');
      const pkg = APP.pack(pid), kinds = pkg.kinds || [];
      const expected = ['plan', ...(kinds.includes('video') || kinds.includes('material') ? ['content'] : []),
        ...(kinds.includes('quiz') || kinds.includes('exam') ? ['exams'] : []),
        ...(kinds.includes('download') ? ['resources'] : []), ...(kinds.includes('flash') ? ['flash'] : []),
        ...(kinds.includes('activity') ? ['activities'] : []), ...(kinds.includes('game') ? ['games'] : []),
        'workspace', ...(pkg.cert ? ['cert'] : [])];
      assert.deepEqual(keys, expected, pid + ': every original entry point retained');
      assert.equal(nav.querySelectorAll('[aria-current="true"]').length, 1);
      assert.equal(document.querySelector('#lnBody').getAttribute('role'), 'region');
      const data = JSON.stringify({ packages: window.PACKAGES, courses: window.COURSES, progress: APP.DB.progress });
      window.PACKAGE_EXPERIENCE.refresh();
      assert.equal(JSON.stringify({ packages: window.PACKAGES, courses: window.COURSES, progress: APP.DB.progress }), data);
      const shortcuts = [...document.querySelectorAll('#lnBody .card > .grid > button[data-lt]')].map(button => button.dataset.lt);
      assert.equal(shortcuts.length,0,pid+': no duplicate plan grid');
      assert(document.querySelector('.package-plan-intro button'),pid+': one learning call to action');
      assert(nav.querySelectorAll('.package-exp-group-title').length>=2);
      assert(document.querySelector('.package-exp-panel-heading h2'));
      assert(document.querySelector('.package-exp-readiness summary'));
    }
  }
  console.log('PASS: ' + pids.length + ' actual learner renderers in both languages, conditional section ordering, shortcut order, selected state, unchanged data');

  const full = window.PACKAGES.find(pkg => pkg.id === 'rmp-full') || window.PACKAGES.find(pkg => pkg.type === 'full');
  APP.DB.progress['ui-fixture'][full.id] = { lessons: {}, weeks: { 1: true, 2: false }, exams: { prior: { score: 72, passed: true } }, activities: { 0: true }, games: {}, downloads: { guide: { name: 'Guide' } } };
  APP.go('learn/' + full.id); await settle();
  assert.match(document.querySelector('.package-exp-nav [data-lt="plan"] small').textContent, /^1 /);
  assert.match(document.querySelector('.package-exp-nav [data-lt="exams"] small').textContent, /^1 /);
  assert.match(document.querySelector('.package-exp-nav [data-lt="resources"] small').textContent, /^1 /);
  assert.equal(APP.prog(full.id).exams.prior.score, 72, 'Recorded score retained');
  const resources = document.querySelector('.package-exp-nav [data-lt="resources"]');
  assert.equal(typeof resources.onclick, 'function', 'Existing application handler retained');
  resources.click(); await settle();
  assert.equal(document.activeElement.id, 'package-learning-resources');
  assert.equal(document.querySelector('#lnBody').getAttribute('aria-labelledby'), 'package-learning-resources');
  document.querySelector('.package-exp-nav [data-lt="plan"]').click(); await settle();
  assert.equal(document.activeElement.id, 'package-learning-plan');
  document.querySelector('.package-exp-progress-jump').click();
  assert.equal(document.activeElement.id, 'package-learning-progress');
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
