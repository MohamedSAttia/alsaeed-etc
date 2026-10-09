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
window.HTMLMediaElement.prototype.pause = function () { this.dataset.testPaused = 'true'; };
window.HTMLMediaElement.prototype.play = function () { this.dataset.testPlayed = 'true'; return Promise.resolve(); };
window.HTMLMediaElement.prototype.load = function () { this.dataset.testUnloaded = 'true'; };
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; this.querySelector('[autofocus]')?.focus(); };
window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
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
  if (process.env.CATALOG_FIXTURE) {
    const content = JSON.parse(await readFile(process.env.CATALOG_FIXTURE, 'utf8'));
    window.PACKAGES = content.packages; window.COURSES = content.courses;
  }
  const before = JSON.stringify({ packages: window.PACKAGES, courses: window.COURSES });
  const pmp = APP.pack('pmp-full');
  const render = async pkg => { APP.go('pkg/' + pkg.id); await settle(); };
  for (const language of ['ar', 'en']) {
    window.__lang = language; window.I18.set(language);
    await render(pmp);
    const card = document.querySelector('.package-exp-certificate');
    assert.ok(card, 'Full PMP displays sample');
    assert.equal(document.querySelectorAll('.package-exp-certificate').length, 1);
    assert.ok(card.textContent.includes(language === 'ar' ? 'إتمام التدريب' : 'Training completion'));
    assert.ok(card.textContent.includes('PMI'), 'Clearly distinguishes issuing body credential');
    const preview = card.querySelector('.package-exp-certificate-preview');
    const img = preview.querySelector('img');
    assert.equal(img.width, 1600); assert.equal(img.height, 1132);
    assert.equal(img.loading, 'lazy');
    assert.match(img.alt, language === 'ar' ? /نموذج/ : /sample/i);
    assert.ok(existsSync('public' + img.getAttribute('src')));
    const jump = [...document.querySelectorAll('.package-exp-jump')].find(b => b.getAttribute('aria-controls') === 'package-certificate-title');
    assert.ok(jump); jump.click();
    assert.equal(document.activeElement.id, 'package-certificate-title');
    const initialHash = window.location.hash;
    preview.click();
    let dialog = document.querySelector('dialog.package-exp-certificate-dialog');
    assert.ok(dialog.open);
    assert.equal(window.location.hash, initialHash, 'Enlargement does not alter package route');
    assert.equal(dialog.getAttribute('aria-labelledby'), 'package-certificate-dialog-title');
    assert.equal(document.activeElement, dialog.querySelector('button'), 'Close receives focus');
    preview.click();
    assert.equal(document.querySelectorAll('.package-exp-certificate-dialog').length, 1, 'Repeated activation does not duplicate dialog');
    dialog.querySelector('button').click();
    assert.equal(dialog.open, false); assert.equal(document.activeElement, preview);
    preview.click(); dialog = document.querySelector('dialog.package-exp-certificate-dialog');
    assert.ok(dialog.open, 'Can reopen');
    document.querySelector('.package-exp-promo-play').click();
    const media = document.querySelector('.package-exp-promo video');
    assert.ok(media && !media.autoplay, 'Original hero player remains usable');
    APP.go('programs'); await settle();
    assert.equal(dialog.isConnected, false); assert.equal(dialog.open, false, 'Navigation closes detached modal');
    assert.equal(media.dataset.testPaused, 'true');
    await render(pmp);
    assert.equal(document.querySelector('dialog'), null, 'Returning starts with collapsed preview');
    for (const pkg of window.PACKAGES.filter(p => p.active !== false && p.id !== pmp.id)) {
      await render(pkg);
      assert.equal(document.querySelector('.package-exp-certificate'), null, 'Sample only applies to full PMP: ' + pkg.id);
    }
  }
  const originalCourse = pmp.course;
  pmp.course = 'rmp'; await render(pmp);
  assert.equal(document.querySelector('.package-exp-certificate'), null, 'A repurposed package ID cannot show the wrong certificate');
  pmp.course = originalCourse; await render(pmp);
  const source = await readFile('public/assets/certifications/alsaeed-pmp-certificate-sample.svg', 'utf8');
  assert.match(source, /not a PMI-issued PMP credential/);
  assert.match(source, /placeholders/);
  assert.doesNotMatch(source, /<script|<foreignObject|https?:\/\/(?!www\.w3\.org)/i);
  assert.equal(JSON.stringify({ packages: window.PACKAGES, courses: window.COURSES }), before, 'No catalog/data changes');
  assert.deepEqual(errors, []);
  console.log('PASS: AR/EN full-PMP sample, accurate labels/asset, section jump, modal close/focus/reopen/route cleanup, all other packages unaffected, hero playback and data preserved');
} finally { dispose(); }
