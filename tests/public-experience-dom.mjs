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
const publicSource = await readFile('public/public-experience.js', 'utf8');
assert.doesNotMatch(publicSource, /\bfetch\s*\(|localStorage|\.api\s*\(|\.save\s*\(|\.checkout\s*\(/, 'Public discovery remains presentation-only');
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
  if (process.env.CATALOG_FIXTURE) {
    const fixture=JSON.parse(await readFile(process.env.CATALOG_FIXTURE,'utf8'));
    window.PACKAGES=fixture.packages;window.COURSES=fixture.courses;
    if (fixture.cms) Object.assign(window.CMS,fixture.cms);
  }

  const originalData=JSON.stringify({packages:window.PACKAGES,courses:window.COURSES,sessions:window.CMS.sessions});
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
    assert.equal(document.querySelector('#publicToggleFilters').getAttribute('aria-expanded'),'false','Mobile filters start compact');
    document.querySelector('#publicToggleFilters').click();assert.equal(document.querySelector('#publicToggleFilters').getAttribute('aria-expanded'),'true');
    document.querySelector('#publicToggleFilters').click();assert.equal(document.querySelector('#publicToggleFilters').getAttribute('aria-expanded'),'false');
    assert.equal(document.querySelector('#publicCourseDiscovery').hidden,false,'Course discovery is the default catalog view');
    const publishedCourses=window.COURSES.filter(c=>window.PACKAGES.some(p=>p.active!==false&&p.course===c.id));
    assert.equal(publishedCourses.length,9,'The current public catalog contains nine published courses');
    assert.equal(document.querySelectorAll('.public-course-card').length,publishedCourses.length);
    for (const c of publishedCourses) {
      const card=document.querySelector(`[data-course-card="${c.id}"]`), packages=window.PACKAGES.filter(p=>p.active!==false&&p.course===c.id);
      assert.equal(card.querySelector('.public-course-art').nextElementSibling,card.querySelector('.public-card-facts'),'Schedule facts sit immediately below course artwork');
      assert.equal(card.querySelector('[data-schedule-fact="hours"] dt').textContent,language==='en'?'Program training hours':'ساعات البرنامج التدريبية');
      assert.equal(card.querySelector('[data-schedule-fact="hours"] dd').textContent,c.hours+' '+(language==='en'?'hours':'ساعة'));
      if (!window.CMS.sessions.length) {
        assert.equal(card.querySelector('[data-schedule-fact="date"] dd').textContent,language==='en'?'At your own pace':'حسب وقتك');
        assert.equal(card.querySelector('[data-schedule-fact="days"] dd').textContent,language==='en'?'Flexible study plan':'خطة دراسة مرنة');
      }
      assert.equal(card.querySelector('h3 a').textContent,language==='en'?(c.en||c.ar):(c.ar||c.en));
      assert.equal(card.querySelector('.public-course-details').getAttribute('href'),'#course/'+c.id);
      assert.match(card.querySelector('.public-course-offer>span').textContent,new RegExp('^'+packages.length+' '),'Actual package count');
      for(const modeKey of new Set(packages.map(p=>p.mode))) {
        const mode=window.MODES.find(m=>m.k===modeKey);
        assert.ok(card.querySelector('.public-course-facts').textContent.includes(mode[language]),'Card includes every published learning format');
      }
      if(packages.some(p=>p.lang==='both'||p.lang==='ar')) assert.ok(card.querySelector('.public-course-facts').textContent.includes(language==='en'?'Arabic':'العربية'));
      if(packages.some(p=>p.lang==='both'||p.lang==='en')) assert.ok(card.querySelector('.public-course-facts').textContent.includes(language==='en'?'English':'الإنجليزية'));
      for(const currency of new Set(packages.map(p=>p.currency))) {
        const amount=Math.min(...packages.filter(p=>p.currency===currency).map(p=>Number(p.price)));
        const expected=new Intl.NumberFormat(language==='en'?'en-US':'ar-EG',{maximumFractionDigits:2}).format(amount);
        assert.equal(card.querySelector(`[data-course-currency="${currency}"]`).textContent,expected+' '+currency,'Separate minimum for each currency');
      }
    }
    document.querySelector('[data-course-track="pm"]').click();
    assert.match(window.location.hash,/track=pm/);assert.equal(document.querySelector('[data-course-track="pm"]').getAttribute('aria-pressed'),'true');
    assert.equal(document.querySelectorAll('.public-course-card').length,publishedCourses.filter(c=>c.track==='pm').length);
    const courseHash=window.location.hash;scrollCalls.length=0;
    document.querySelector('.public-course-details').click();await settle();assert.match(window.location.hash,/^#course\//);
    assert.ok(scrollCalls.some(args=>args[0]?.top===0),'Course details begin at the top');
    window.history.back();await settle();assert.equal(window.location.hash,courseHash);assert.equal(document.querySelector('[data-course-track="pm"]').getAttribute('aria-pressed'),'true','Back restores course field choice');
    document.querySelector('#publicBrowseFields').click();assert.equal(window.location.hash,'#programs');assert.equal(document.querySelector('[data-catalog-browse]').dataset.testScrolled,'true');
    assert.equal(document.querySelectorAll('.public-course-card').length,9);

    document.querySelector('[data-cfamily="pmi"]').click();await settle();assert.match(window.location.hash,/family=pmi/);assert.ok(document.querySelector('[data-ccert="pmp"]'));assert.equal(document.querySelector('#publicCourseDiscovery').hidden,true,'Category browsing retains its own focused view');
    document.querySelector('[data-ccert="pmp"]').click();await settle();assert.match(window.location.hash,/cert=pmp/);
    window.history.back();await settle();assert.match(window.location.hash,/family=pmi/);assert.doesNotMatch(window.location.hash,/cert=/);assert.ok(document.querySelector('[data-ccert="pmp"]'));
    window.history.forward();await settle();assert.match(window.location.hash,/cert=pmp/);assert.ok(document.querySelector('.v38-packages'));
    document.querySelector('[data-creset]').click();await settle();assert.equal(window.location.hash,'#programs');assert.ok(document.querySelector('[data-cfamily="pmi"]'));
    input('#publicQuery','PMP');assert.equal(document.querySelector('#publicCourseDiscovery').hidden,true);assert.equal(document.querySelector('[data-catalog-browse]').hidden,true);assert.ok(document.querySelectorAll('.public-result-card').length);assert.match(window.location.hash,/q=PMP/);
    assert.equal(document.querySelector('#publicToggleFilters').getAttribute('aria-expanded'),'true','Searching opens package controls on mobile');
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
    assert.match(window.location.hash,/limit=24/,'Loaded package count is recorded in the URL');
    const pagedHash=window.location.hash;document.querySelectorAll('.public-result-card .btn')[15].click();await settle();
    window.history.back();await settle();assert.equal(window.location.hash,pagedHash);assert.equal(document.querySelectorAll('.public-result-card').length,24,'Back restores expanded package results');
    input('#publicSort','price-asc','change');assert.equal(document.querySelectorAll('.public-result-card').length,12);const visiblePrices=[...document.querySelectorAll('.public-result-card h3 a')].map(a=>window.PACKAGES.find(p=>a.hash==='#pkg/'+p.id));assert.ok(visiblePrices.every((p,i)=>!i||p.currency!==visiblePrices[i-1].currency||p.price>=visiblePrices[i-1].price));
    APP.go('home');await settle();input('#v31Course','pmp','change');input('#v31Mode','sim','change');const href=document.querySelector('.v31-all').getAttribute('href');assert.match(href,/course=pmp/);assert.match(href,/mode=sim/);
    assert.equal(document.querySelector('.v21-skip').textContent,language==='en'?'Skip to content':'انتقل إلى المحتوى');
    assert.equal(document.querySelector('[data-public-footer="resources"]').textContent,language==='en'?'Resources':'موارد');
  }
  assert.equal(JSON.stringify({packages:window.PACKAGES,courses:window.COURSES,sessions:window.CMS.sessions}),originalData,'No catalog writes');
  // Local-only scheduling fixtures. These are never saved or sent to a backend.
  const savedSessions=window.CMS.sessions, schedulePackages=window.PACKAGES;
  const pmp=window.COURSES.find(c=>c.id==='pmp'), selfPackage=schedulePackages.find(p=>p.course==='pmp'&&p.mode==='self');
  const livePackage={...selfPackage,id:'local-live-schedule-fixture',mode:'live',hours:22,days:365};
  const onsitePackage={...selfPackage,id:'local-onsite-schedule-fixture',mode:'onsite',hours:18,days:60};
  window.PACKAGES=[...schedulePackages,livePackage,onsitePackage];
  window.CMS.sessions=[
    {course:'pmp',published:false,date:'2099-01-01',mode:'live',trainingDays:80},
    {course:'pmp',published:true,date:'2000-01-01',mode:'live',trainingDays:90},
    {course:'pmp',published:true,date:'2099-02-30',mode:'live',trainingDays:99},
    {course:'rmp',published:true,date:'2099-02-01',mode:'live',trainingDays:70},
    {course:'pmp',published:true,date:'2099-04-18',mode:'live',trainingDays:6,time:'18:45',timezone:'Europe/London'},
    {course:'pmp',published:true,date:'2099-03-12',mode:'onsite',trainingDays:3}
  ];
  const fact=(card,key,part='dd')=>card.querySelector(`[data-schedule-fact="${key}"] ${part}`)?.textContent;
  for (const language of ['ar','en']) {
    window.__lang=language;window.I18.set(language);document.documentElement.lang=language;document.documentElement.dir=language==='en'?'ltr':'rtl';
    const date=value=>new Intl.DateTimeFormat(language==='en'?'en-GB':'ar-EG',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
    APP.go('programs');await settle();
    let card=document.querySelector('[data-course-card="pmp"]');
    assert.equal(fact(card,'date'),date('2099-03-12'),'Only the earliest valid published future group for this course is shown');
    assert.equal(fact(card,'days'),'3 '+(language==='en'?'days':'أيام'));
    assert.equal(fact(card,'hours'),pmp.hours+' '+(language==='en'?'hours':'ساعة'),'Course hours remain the catalog training hours');
    delete window.CMS.sessions[5].trainingDays;
    APP.render();await settle();card=document.querySelector('[data-course-card="pmp"]');
    assert.equal(fact(card,'days'),language==='en'?'To be confirmed with the group':'تُؤكد مع المجموعة','Missing training days are never inferred from dates or access');
    window.CMS.sessions[5].trainingDays=3;
    APP.go('programs?course=pmp&mode=live');await settle();
    card=document.querySelector('[data-package-card="local-live-schedule-fixture"]');
    assert.equal(card.querySelector('.public-result-art').nextElementSibling,card.querySelector('.public-card-facts'),'Package facts sit immediately below artwork');
    assert.equal(fact(card,'date'),date('2099-04-18'),'Live packages do not inherit an earlier in-person group');
    assert.equal(fact(card,'days'),'6 '+(language==='en'?'days':'أيام'));
    assert.equal(fact(card,'hours'),'22 '+(language==='en'?'hours':'ساعة'));
    assert.equal(fact(card,'time'),'18:45 · Europe/London');
    assert.equal(fact(card,'access'),'365 '+(language==='en'?'days of access':'يوم وصول'));
    APP.go('programs?course=pmp&mode=self');await settle();
    card=document.querySelector(`[data-package-card="${selfPackage.id}"]`);
    assert.equal(fact(card,'date'),language==='en'?'At your own pace':'حسب وقتك','Self-paced packages never inherit a live group date');
    assert.equal(fact(card,'days'),language==='en'?'Flexible study plan':'خطة دراسة مرنة');
    assert.equal(fact(card,'time'),undefined,'Self-paced packages do not promise a group time');
  }
  window.CMS.sessions=savedSessions;window.PACKAGES=schedulePackages;
  assert.equal(JSON.stringify({packages:window.PACKAGES,courses:window.COURSES,sessions:window.CMS.sessions}),originalData,'Schedule fixture data is fully restored');
  // Local fixture: a cheaper inactive package must not change a real course's
  // starting price, and a new currency must never be converted or compared to it.
  const savedPackages=window.PACKAGES;
  const sourcePackage=savedPackages.find(p=>p.active!==false&&p.course==='pmp');
  const existingMinimum=Math.min(...savedPackages.filter(p=>p.active!==false&&p.course==='pmp'&&p.currency===sourcePackage.currency).map(p=>Number(p.price)));
  window.PACKAGES=[...savedPackages,
    {...sourcePackage,id:'local-inactive-fixture',active:false,price:0},
    {...sourcePackage,id:'local-currency-fixture',active:true,currency:'TEST',price:420},
    {...sourcePackage,id:'local-currency-minimum-fixture',active:true,currency:'TEST',price:120}];
  APP.go('programs');await settle();
  const fixtureCard=document.querySelector('[data-course-card="pmp"]');
  assert.equal(fixtureCard.querySelector('[data-course-currency="TEST"]').textContent,'120 TEST');
  assert.equal(fixtureCard.querySelector(`[data-course-currency="${sourcePackage.currency}"]`).textContent,new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(existingMinimum)+' '+sourcePackage.currency);
  assert.equal(fixtureCard.querySelectorAll('[data-course-currency="TEST"]').length,1,'One minimum per currency');
  window.PACKAGES=savedPackages;
  assert.equal(JSON.stringify({packages:window.PACKAGES,courses:window.COURSES,sessions:window.CMS.sessions}),originalData,'Fixture data is fully restored');
  assert.equal(window.PUBLIC_EXPERIENCE.normalize('إِدارة الـمَخاطِر'),window.PUBLIC_EXPERIENCE.normalize('ادارة المخاطر'));
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: Arabic/English course discovery, actual schedule facts under images, training/access/video separation, nine real courses, per-currency prices, filters, pagination, history, keyboard search, mobile menu and immutable data');
} finally { dispose(); }
