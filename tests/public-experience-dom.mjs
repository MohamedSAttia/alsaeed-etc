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
const scrollCalls=[];
window.scrollTo = (...args) => { scrollCalls.push(args); };
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
  assert.ok(APP && window.PACKAGES?.length, 'Real application and catalog loaded');

  const originalData=JSON.stringify({packages:window.PACKAGES,courses:window.COURSES});
  const input=(selector,value,event='input')=>{const node=document.querySelector(selector);assert.ok(node,selector);node.value=value;node.dispatchEvent(new window.Event(event,{bubbles:true}));return node;};
  const key=(node,value)=>node.dispatchEvent(new window.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));
  for (const language of ['ar','en']) {
    window.__lang=language;window.I18.set(language);document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';
    APP.go('home');await settle();
    const advisor=document.querySelector('.v24-consult-link');
    assert.equal(advisor.querySelectorAll('svg.public-arrow').length,1,'Advisor uses a reliable SVG arrow');
    assert.doesNotMatch(advisor.textContent,/↗/);
    window.PUBLIC_EXPERIENCE.refresh();assert.equal(advisor.querySelectorAll('svg.public-arrow').length,1,'Advisor arrow remains idempotent');
    const homeCard=[...document.querySelectorAll('.course-vcard')].find(el=>el.querySelector('[data-r="course/pmp"]'));
    assert.ok(homeCard);assert.match(homeCard.querySelector('.public-from-price').textContent,/69/,'Actual minimum price');
    const burger=document.querySelector('#burger');burger.style.display='block';burger.click();assert.equal(burger.getAttribute('aria-expanded'),'true');
    assert.ok(document.body.classList.contains('public-menu-open'),'Menu can suppress competing floating chat controls');
    key(burger,'Escape');assert.equal(burger.getAttribute('aria-expanded'),'false');assert.equal(document.activeElement,burger);
    assert.equal(document.body.classList.contains('public-menu-open'),false,'Chat controls return after menu dismissal');
    burger.click();document.querySelector('#app').click();assert.equal(burger.getAttribute('aria-expanded'),'false');
    assert.equal(document.querySelectorAll('[data-public-account]').length,2);window.PUBLIC_EXPERIENCE.refresh();assert.equal(document.querySelectorAll('[data-public-account]').length,2);
    const search=input('#v22CourseSearch','PMP');assert.equal(search.getAttribute('aria-expanded'),'true');key(search,'ArrowDown');assert.ok(search.getAttribute('aria-activedescendant'));key(search,'Escape');assert.equal(search.getAttribute('aria-expanded'),'false');
    input('#v22CourseSearch','PMP');key(search,'ArrowDown');key(search,'Enter');await settle();assert.equal(window.location.hash,'#course/pmp');
    APP.go('programs');await settle();
    assert.ok(document.querySelector('#publicCatalogForm'));assert.equal(document.querySelector('#publicCatalogResults').hidden,true);
    document.querySelector('[data-cfamily="pmi"]').click();await settle();assert.match(window.location.hash,/family=pmi/);assert.ok(document.querySelector('[data-ccert="pmp"]'));
    document.querySelector('[data-ccert="pmp"]').click();await settle();assert.match(window.location.hash,/cert=pmp/);
    window.history.back();await settle();assert.match(window.location.hash,/family=pmi/);assert.doesNotMatch(window.location.hash,/cert=/);assert.ok(document.querySelector('[data-ccert="pmp"]'));
    window.history.forward();await settle();assert.match(window.location.hash,/cert=pmp/);assert.ok(document.querySelector('.v38-packages'));
    document.querySelector('[data-creset]').click();await settle();assert.equal(window.location.hash,'#programs');assert.ok(document.querySelector('[data-cfamily="pmi"]'));
    input('#publicQuery','PMP');assert.equal(document.querySelector('[data-catalog-browse]').hidden,true);assert.ok(document.querySelectorAll('.public-result-card').length);assert.match(window.location.hash,/q=PMP/);
    const filteredHash=window.location.hash;scrollCalls.length=0;
    document.querySelector('.public-result-card .btn').click();await settle();
    assert.match(window.location.hash,/^#pkg\//);
    assert.ok(scrollCalls.some(args=>args[0]?.top===0&&args[0]?.behavior==='instant'),'Catalog result starts package at the top after rendering');
    window.history.back();await settle();assert.equal(window.location.hash,filteredHash,'Back restores the filtered catalog URL');
    assert.equal(document.querySelector('#publicQuery').value,'PMP');
    assert.equal(APP.route,window.location.hash.slice(1),'URL and router state remain in sync');
    input('#publicMode','sim','change');assert.equal(document.querySelectorAll('.public-result-card').length,window.PACKAGES.filter(p=>p.active!==false&&p.course==='pmp'&&p.mode==='sim').length);
    input('#publicQuery','no-match-zzzz');assert.ok(document.querySelector('.public-empty'));assert.equal(document.querySelectorAll('.public-result-card').length,0);
    document.querySelector('[data-clear-catalog]').click();assert.equal(document.querySelector('#publicQuery').value,'');assert.equal(document.querySelector('[data-catalog-browse]').hidden,false);
    APP.go('programs?q=PMP&course=pmp&mode=sim&lang=both');await settle();assert.equal(document.querySelector('#publicQuery').value,'PMP');assert.equal(document.querySelector('#publicCourse').value,'pmp');assert.equal(document.querySelector('#publicMode').value,'sim');
    document.querySelector('#publicClearFilters').click();assert.equal(document.querySelector('#publicQuery').value,'');assert.equal(window.location.hash,'#programs');
    document.querySelector('#publicShowPackages').click();assert.equal(document.querySelectorAll('.public-result-card').length,12);document.querySelector('#publicLoadMore').click();assert.equal(document.querySelectorAll('.public-result-card').length,24);assert.ok(document.activeElement.matches('.public-result-card h3 a'));
    input('#publicSort','price-asc','change');assert.equal(document.querySelectorAll('.public-result-card').length,12);const visiblePrices=[...document.querySelectorAll('.public-result-card h3 a')].map(a=>window.PACKAGES.find(p=>a.hash==='#pkg/'+p.id));assert.ok(visiblePrices.every((p,i)=>!i||p.currency!==visiblePrices[i-1].currency||p.price>=visiblePrices[i-1].price));
    APP.go('home');await settle();input('#v31Course','pmp','change');input('#v31Mode','sim','change');const href=document.querySelector('.v31-all').getAttribute('href');assert.match(href,/course=pmp/);assert.match(href,/mode=sim/);
    assert.equal(document.querySelector('.v21-skip').textContent,language==='en'?'Skip to content':'انتقل إلى المحتوى');
    assert.equal(document.querySelector('[data-public-footer="resources"]').textContent,language==='en'?'Resources':'موارد');
  }
  assert.equal(JSON.stringify({packages:window.PACKAGES,courses:window.COURSES}),originalData,'No catalog writes');
  assert.equal(window.PUBLIC_EXPERIENCE.normalize('إِدارة الـمَخاطِر'),window.PUBLIC_EXPERIENCE.normalize('ادارة المخاطر'));
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: Arabic/English home search keyboard, real minimum price, mobile menu semantics/dismissal, catalog filters/reset/empty/pagination/sorting, deep links, Back/Forward, finder handoff, bilingual labels, and immutable data');
} finally { dispose(); }
