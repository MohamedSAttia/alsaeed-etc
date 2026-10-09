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
  // All video IDs below are synthetic fixtures, never saved to the catalog or loaded over the network.
  const promo = window.PACKAGE_EXPERIENCE;
  const approvedPromos = window.PACKAGE_PROMOS;
  window.PACKAGE_PROMOS = {};
  const parse = promo.parsePromoVideo;
  for (const source of ['123456789', 'https://vimeo.com/123456789', 'https://www.vimeo.com/123456789/abcdef1234', 'https://player.vimeo.com/video/123456789?h=abcdef1234&autoplay=1']) {
    const parsed = parse(source);
    assert.equal(parsed.kind, 'iframe');
    assert.equal(new URL(parsed.src).hostname, 'player.vimeo.com');
    assert.equal(new URL(parsed.src).searchParams.get('autoplay'), '0');
  }
  assert.equal(new URL(parse('https://vimeo.com/123456789/abcdef1234').src).searchParams.get('h'), 'abcdef1234');
  assert.equal(parse('/assets/promos/pmp-intro-ar.mp4').kind, 'video');
  for (const invalid of ['', 'javascript:alert(1)', 'data:text/html,bad', 'https://vimeo.com.evil.test/123456789', 'https://evil.test/vimeo.com/123456789', 'http://vimeo.com/123456789', 'https://user@vimeo.com/123456789', '//vimeo.com/123456789', 'https://vimeo.com:8443/123456789', 'https://vimeo.com/123456789?h=%22%3E', '/assets/promos/../evil.mp4', '/assets/promos/%2e%2e/evil.mp4', 'https://external.test/video.mp4']) {
    assert.equal(parse(invalid), null, 'Reject invalid/unapproved video source: ' + invalid);
  }
  if (process.env.CATALOG_FIXTURE) {
    const content = JSON.parse(await readFile(process.env.CATALOG_FIXTURE, 'utf8'));
    window.PACKAGES = content.packages;
    window.COURSES = content.courses;
  }
  const originalData = JSON.stringify({ packages: window.PACKAGES, courses: window.COURSES });
  const full = window.PACKAGES.filter(p => p.type === 'full' && p.active !== false);
  const first = full[0], course = APP.course(first.course);
  const render = async pkg => { APP.go('pkg/' + pkg.id); await settle(); };
  for (const language of ['ar', 'en']) {
    window.__lang = language; window.I18.set(language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    for (const pkg of window.PACKAGES.filter(p => p.active !== false)) {
      await render(pkg);
      assert.equal(document.querySelector('.package-exp-promo'), null, 'Unset section stays completely absent: ' + pkg.id);
      const illustration = document.querySelector('.package-exp-hero-art img');
      assert.equal(illustration?.getAttribute('src'), '/assets/packages/' + pkg.course + '.svg', 'Every package format has course-specific artwork');
      assert.ok(existsSync('public' + illustration.getAttribute('src')), 'Illustration asset exists');
    }
    for (const pkg of full) {
      pkg.promoVideo = '123456789';
      await render(pkg);
      const section = document.querySelector('.package-exp-promo');
      assert.ok(section, pkg.id + ': configured full package has promo');
      assert.equal(section.querySelector('iframe,video'), null, 'No media is loaded before selection');
      const play = section.querySelector('.package-exp-promo-play');
      assert.ok(play.getAttribute('aria-label').includes(language === 'ar' ? 'شاهد الفيديو التعريفي' : 'Watch introduction'));
      assert.ok([...document.querySelectorAll('.package-exp-outline button')].some(x => x.getAttribute('aria-controls') === 'package-promo-title'));
      play.click(); play.click();
      const frame = section.querySelector('iframe');
      assert.equal(section.querySelectorAll('iframe').length, 1, 'Repeated play does not duplicate frames');
      assert.ok(frame.title && frame.getAttribute('aria-label'));
      assert.ok(!frame.allow.includes('autoplay'));
      assert.equal(new URL(frame.src).searchParams.get('autoplay'), '0');
      assert.equal(play.getAttribute('aria-expanded'), 'true');
      const close = section.querySelector('.package-exp-promo-actions button:not(.package-exp-promo-play)');
      assert.equal(document.activeElement, close);
      close.click();
      assert.equal(section.querySelector('iframe'), null, 'Dismissal unloads the player');
      assert.equal(document.activeElement, play);
      play.click();
      APP.go('programs'); await settle();
      assert.equal(document.querySelector('.package-exp-promo iframe'), null, 'Navigation unloads the player');
      delete pkg.promoVideo;
    }
  }
  first.promoVideo = '/assets/promos/pmp-intro-ar.mp4';
  await render(first);
  document.querySelector('.package-exp-promo-play').click();
  const video = document.querySelector('.package-exp-promo video');
  assert.ok(video.controls && video.playsInline);
  assert.equal(video.preload, 'none'); assert.equal(video.autoplay, false);
  assert.equal(video.dataset.testPlayed, 'true', 'Explicit click starts playback without a page-load autoplay attribute');
  document.querySelector('.package-exp-promo-actions button:not(.package-exp-promo-play)').click();
  assert.equal(document.querySelector('.package-exp-promo video'), null);
  assert.equal(video.dataset.testPaused, 'true'); assert.equal(video.dataset.testUnloaded, 'true');
  assert.equal(video.getAttribute('src'), null);
  document.querySelector('.package-exp-promo-play').click();
  const navigatedVideo = document.querySelector('.package-exp-promo video');
  APP.go('programs'); await settle();
  assert.equal(navigatedVideo.dataset.testPaused, 'true', 'Navigation pauses detached video');
  assert.equal(navigatedVideo.getAttribute('src'), null);
  delete first.promoVideo;
  const previousPreview = course.previewVimeo;
  course.previewVimeo = '123456789';
  assert.equal(promo.promoSource(first, course), null, 'No automatic course fallback');
  first.promoUseCoursePreview = true;
  await render(first);
  assert.equal(promo.promoSource(first, course).coursePreview, true);
  first.promoVideo = '987654321';
  assert.equal(promo.promoSource(first, course).coursePreview, false, 'Dedicated package video takes priority');
  first.promoVideo = 'javascript:bad';
  assert.equal(promo.promoSource(first, course), null, 'Invalid dedicated source cannot silently show another video');
  assert.equal(promo.promoSource({ ...first, type: 'sim' }, course), null);
  assert.equal(promo.promoSource({ ...first, active: false }, course), null);
  delete first.promoVideo; delete first.promoUseCoursePreview;
  if (previousPreview === undefined) delete course.previewVimeo; else course.previewVimeo = previousPreview;
  assert.equal(JSON.stringify({ packages: window.PACKAGES, courses: window.COURSES }), originalData, 'Rendering never changes catalog data');
  console.log('PASS: strict asset validation, ' + full.length + ' full packages in AR/EN, all unset records hidden, lazy player, repeated play, close/focus, navigation cleanup, explicit fallback, immutable data');

  // Exercise the actual admin editor with a stub API. No remote writes or account/session changes.
  Object.defineProperty(APP, 'live', { configurable: true, value: true });
  const calls = [], toasts = [];
  APP.toast = message => toasts.push(message);
  let saveImpl = async () => ({ ok: true });
  APP.api = async (path, options) => { calls.push({ path, options: JSON.parse(JSON.stringify(options)) }); return saveImpl(); };
  const openEditor = pkg => {
    APP.closeModal();
    const button = document.createElement('button');
    button.dataset.edp = pkg.id; document.body.append(button);
    window.VIEWS.bind(); button.click(); button.remove();
    assert.ok(document.querySelector('#pSave'));
  };
  const save = () => document.querySelector('#pSave').onclick();
  openEditor(first);
  assert.equal(document.querySelector('#pPromoFields').disabled, false);
  document.querySelector('#pPromoVideo').value = 'https://evil.test/video.mp4';
  await save();
  assert.equal(calls.length, 0); assert.equal(document.querySelector('#pPromoVideo').getAttribute('aria-invalid'), 'true');
  document.querySelector('#pPromoVideo').value = '';
  document.querySelector('#pPromoCourse').checked = true;
  await save(); assert.equal(calls.length, 0, 'Missing course preview cannot be enabled');
  document.querySelector('#pPromoCourse').checked = false;
  document.querySelector('#pPromoVideo').value = '123456789';
  const beforeSave = JSON.stringify(first);
  saveImpl = async () => { throw new Error('Synthetic save failure'); };
  await save();
  assert.equal(JSON.stringify(first), beforeSave, 'Failed save restores all preexisting fields and removes newly added promo fields');
  assert.ok(document.querySelector('#pSave'), 'Failed save leaves editor open');
  let finish;
  saveImpl = () => new Promise(resolve => { finish = resolve; });
  const pending = save(); await Promise.resolve();
  assert.ok(document.querySelector('#pSave'), 'Editor stays open while save is pending');
  finish({ ok: true }); await pending;
  assert.equal(first.promoVideo, '123456789');
  assert.equal(calls.at(-1).path, '/admin/content');
  assert.equal(calls.at(-1).options.body.packages.find(p => p.id === first.id).promoVideo, '123456789');
  saveImpl = async () => ({ ok: true });
  openEditor(first); document.querySelector('#pPromoVideo').value = ''; await save();
  assert.equal(first.promoVideo, ''); await render(first);
  assert.equal(document.querySelector('.package-exp-promo'), null, 'Clearing saved video hides section');
  const untouched = full[1];
  openEditor(untouched); await save();
  assert.equal(Object.hasOwn(untouched, 'promoVideo'), false, 'Empty optional field stays absent');
  assert.equal(Object.hasOwn(untouched, 'promoUseCoursePreview'), false, 'Fallback stays absent by default');
  course.previewVimeo = '123456789';
  openEditor(first); document.querySelector('#pPromoCourse').checked = true; await save();
  assert.equal(first.promoUseCoursePreview, true);
  await render(first); assert.ok(document.querySelector('.package-exp-promo'));
  openEditor(first); document.querySelector('#pPromoCourse').checked = false; await save();
  await render(first); assert.equal(document.querySelector('.package-exp-promo'), null);
  const nonfull = window.PACKAGES.find(p => p.type !== 'full');
  nonfull.promoVideo = 'existing-opaque-value'; nonfull.promoUseCoursePreview = true;
  openEditor(nonfull);
  assert.equal(document.querySelector('#pPromoFields').disabled, true);
  document.querySelector('#pPromoVideo').value = '123456789'; await save();
  assert.equal(nonfull.promoVideo, 'existing-opaque-value');
  assert.equal(nonfull.promoUseCoursePreview, true, 'Non-full promo fields are untouched');
  window.PACKAGE_PROMOS = approvedPromos;
  const pmp = APP.pack('pmp-full');
  delete pmp.promoVideo; delete pmp.promoUseCoursePreview;
  await render(pmp);
  const poster = document.querySelector('.package-exp-promo-poster img');
  assert.equal(poster?.getAttribute('src'), '/assets/promos/pmp-intro-poster.webp');
  assert.ok(existsSync('public' + poster.getAttribute('src')));
  assert.equal(document.querySelector('.package-exp-promo video'), null, 'Supplied MP4 still does not load before click');
  document.querySelector('.package-exp-promo-play').click();
  const suppliedVideo = document.querySelector('.package-exp-promo video');
  assert.equal(suppliedVideo.getAttribute('src'), '/assets/promos/pmp-intro.mp4');
  assert.equal(suppliedVideo.getAttribute('poster'), '/assets/promos/pmp-intro-poster.webp');
  assert.equal(suppliedVideo.autoplay, false);
  assert.equal(suppliedVideo.dataset.testPlayed, 'true');
  openEditor(pmp);
  assert.equal(document.querySelector('#pPromoVideo').value, '/assets/promos/pmp-intro.mp4', 'Admin shows published default');
  document.querySelector('#pPromoVideo').value = ''; await save();
  assert.equal(pmp.promoVideo, '', 'Explicitly clearing published default persists a hide override');
  await render(pmp); assert.equal(document.querySelector('.package-exp-promo'), null);
  console.log('PASS: real admin validation, full-only fields, no false fallback, awaited save, failure rollback, clear and persistence payload');
  console.log('PASS: all package artwork assets, supplied PMP poster/media mapping, no eager MP4 loading, and explicit hide override');
  assert.deepEqual(errors, [], 'No page script errors');
} finally { dispose(); }
