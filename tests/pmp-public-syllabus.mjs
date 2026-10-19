/** Focused rendering regression: real course/package functions, read-only public catalog fixture.
 * Requires jsdom in the test environment (or JSDOM_MODULE pointing to its entry).
 * Run from the repository root: node tests/pmp-public-syllabus.mjs
 * This intentionally does not claim full application startup, authentication or visual QA.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const { JSDOM } = await import(process.env.JSDOM_MODULE || 'jsdom');
const source = fs.readFileSync('public/index.html', 'utf8');
const catalog = JSON.parse(fs.readFileSync(process.env.CATALOG_FIXTURE || 'public/v15-catalog.json', 'utf8'));
const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'https://local.test/#course/pmp', runScripts: 'outside-only' });
const { window } = dom;
const context = dom.getInternalVMContext();
const app = window.document.getElementById('app');
const storedBefore = JSON.stringify(catalog);
const allCourses = catalog.courses;
window.COURSES = allCourses;
window.PACKAGES = catalog.packages;
window.CMS = { sessions: [] };
window.MODES = [];
window.PKG_TYPES = [];
window.LANG_LABEL = {};
window.TRACKS = [];
window.CONTENT_KINDS = [];
window.validCourseDate = () => false;
window.I18 = { lang: 'ar' };
window.__lang = 'ar';
const course = id => window.COURSES.find(x => x.id === id);
const pack = id => window.PACKAGES.find(x => x.id === id);
context.A = () => ({ course, pack, owns: () => false, live: false });
context.siteEnglish = () => window.__lang === 'en';
context.esc = value => String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
context.publicTitle = item => typeof item === 'string' ? item : item && (context.siteEnglish() ? item.en || item.ar : item.ar || item.en) || '';
context.money = value => Number(value).toLocaleString('en-US');
context.B = { saudiWhatsapp: '966544375447' };
context.CERT_GUIDES = {};
context.trackVisual = () => ({ ar: 'المشاريع', en: 'Projects' });
context.catalogIssuerLink = context.catalogInstructorBadge = context.courseCover = context.courseImageFacts = context.courseDecision = context.catalogCertMark = context.catalogArtwork = () => '';
context.packagePresentation = () => ({ ar: '', en: '', arPoints: [], enPoints: [] });
context.packageDescription = () => '';
context.home = context.programs = () => '';

function readFunction(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' exists');
  const end = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, end < 0 ? undefined : end);
}
for (const name of ['publicCourseTopics', 'publicTopicBody', 'courseTabBody', 'courseView', 'pkgView']) {
  vm.runInContext(readFunction(name), context, { filename: 'public/index.html:' + name });
}
vm.runInContext(fs.readFileSync('public/course-roadmap.js', 'utf8'), context);
const expectedKeys = ['intro','framework','agile','predictive','hybrid','people','process','business','value','principles','lifecycles','ai','final-reviews','workshops','exam-eve','exam-guidelines'];
assert.deepEqual(Array.from(window.CourseRoadmap.topics(course('pmp')), x => x.key), expectedKeys);
assert.deepEqual(Array.from(window.CourseRoadmap.topics(course('pmp'))[0].children, x => x.key), ['exam','journey']);
assert.equal(window.CourseRoadmap.topics(course('pmp'))[0].children[0].children, undefined, 'Exam structure is nested in introduction without invented children');
const learner = window.CourseRoadmap.groups(course('pmp'), []);
assert.equal(learner.length, 18);
const names = selector => Array.from(app.querySelectorAll(selector), x => x.textContent);
let assertions = 0;
try {
  for (const language of ['ar', 'en']) {
    window.__lang = window.I18.lang = language;
    const expected = Array.from(window.CourseRoadmap.topics(course('pmp')), x => language === 'en' ? x.en : x.ar);
    // Exercise built-in bilingual fallbacks as well as the installed formatter contract.
    for (const formatter of [false, true]) {
      window.biTitle = formatter ? context.publicTitle : undefined;
      app.innerHTML = context.courseView('pmp');
      assert.deepEqual(names('.cd-topics > li > .public-topic-copy > .public-topic-label, .cd-topics > li > .public-topic-copy > .public-topic-disclosure > summary > .public-topic-label'), expected);
      assert.match(app.querySelector('.cd-count').textContent, /^16 /);
      assert.equal(app.querySelectorAll('.cd-facts dd')[2].textContent, '16');
      assert.equal(app.querySelector('.cd-source-language'), null);
      app.innerHTML = context.courseTabBody(course('pmp'));
      assert.deepEqual(names('.chap-c > .public-topic-copy > .public-topic-label, .chap-c > .public-topic-copy > .public-topic-disclosure > summary > .public-topic-label'), expected);
      app.innerHTML = context.pkgView('pmp-full');
      assert.deepEqual(names('.chap-c > .public-topic-copy > .public-topic-label, .chap-c > .public-topic-copy > .public-topic-disclosure > summary > .public-topic-label'), expected);
      assertions += 6;
    }
    for (const p of window.PACKAGES.filter(x => x.id !== 'pmp-full')) {
      app.innerHTML = context.pkgView(p.id);
      assert.deepEqual(names('.chap-c > .public-topic-copy > .public-topic-label, .chap-c > .public-topic-copy > .public-topic-disclosure > summary > .public-topic-label'), (p.chapters || []).map(context.publicTitle).map((title, i) => title || String(p.chapters[i])));
      assertions++;
    }
    for (const c of allCourses.filter(x => x.id !== 'pmp')) {
      app.innerHTML = context.courseView(c.id);
      assert.equal(app.querySelectorAll('.cd-topics > li').length, (c.chapters || []).length);
      assertions++;
    }
  }
  // A missing optional roadmap retains the existing catalog fallback.
  const roadmap = window.CourseRoadmap;
  window.CourseRoadmap = undefined;
  app.innerHTML = context.courseView('pmp');
  assert.equal(app.querySelectorAll('.cd-topics > li').length, course('pmp').chapters.length);
  window.CourseRoadmap = roadmap;
  // Titles are content: an unsafe string must remain text in all three render paths.
  const topicsFor = roadmap.topics;
  roadmap.topics = c => {
    const topics = topicsFor(c);
    topics[0].en = '<img src=x onerror="throw 1">';
    topics.find(t=>t.key==='predictive').children[0].en='<img src=nested onerror="throw 2">';
    return topics;
  };
  for (const render of [() => context.courseView('pmp'), () => context.courseTabBody(course('pmp')), () => context.pkgView('pmp-full')]) {
    app.innerHTML = render();
    assert.equal(app.querySelector('img[onerror]'), null);
    assert.ok(app.textContent.includes('<img src=x onerror="throw 1">'));
    assert.ok(app.textContent.includes('<img src=nested onerror="throw 2">'));
  }
  roadmap.topics = topicsFor;
  assert.equal(JSON.stringify(catalog), storedBefore, 'Stored course and package chapters are untouched');
  assert.ok(source.includes('/course-roadmap.js?v=20261018-editable-hierarchy'));
  console.log(`PASS: ${assertions} render assertions; PMP course, legacy tab and full package share 16 public headings in AR/EN; other packages/courses, optional-module fallback, escaping and stored chapters preserved.`);
} finally { window.close(); }

