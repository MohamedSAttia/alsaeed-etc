/** Self-contained local regression; all courses, IDs, lessons and progress are synthetic.
 * Run from the repository root: node tests/pmp-curriculum-sync.mjs
 * No browser, network, database, live snapshot, or external test dependency is used.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const box = { window: {} };
vm.runInNewContext(fs.readFileSync('public/course-roadmap.js', 'utf8'), box);
const r = box.window.CourseRoadmap;
const clone = value => JSON.parse(JSON.stringify(value));
const flatten = nodes => nodes.flatMap(node => [node, ...flatten(node.children || [])]);
const keys = nodes => Array.from(nodes, node => node.key);
const indices = group => Array.from(group.items, lesson => lesson.i);
const find = (nodes, key) => flatten(nodes).find(node => node.key === key);
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
};
const lesson = (id, ch, t, t_en = '') => ({
  id, ch, t, t_en, vimeo: String(10000 + Number(id.replace(/\D/g, '') || 0)),
  dur: '03:00', free: false, files: [{ id: id + '-file', name: 'Fixture.pdf' }],
  quiz: [{ id: id + '-question' }], notes: 'Synthetic note', notes_en: 'Synthetic note'
});
const legacyIntroTitles = [
  ['معهد PMI وأخلاقيات المهنة', 'Title: PMI and Professional Ethics'],
  ['شهادات PMI', 'The PMI  Certifications'],
  ['المحاضر ومحاور البرنامج - الاصدار الثامن', 'Instructor and PMP outlines - 8 Edition'],
  ['هيكل اختبار محترف ادارة المشاريع وأنواع الأسئلة', 'PMP® Exam Structure and Question Types'],
  ['استراتيجيات حل اسئلة الاختبار الحقيقي', 'Strategies for Solving Any PMP® Question'],
  ['خطة اجتياز الاختبار  الحقيقي', 'Pass PMP Real Exam Plan ']
];
const legacyGuidanceTitles = [
  ['متطلبات تقديم الاختبار الدولى والاهليه', 'PMP® Eligibility and Application'],
  ['طريقة تعبئة طلب الاختبار الدولي', 'PMP Application'],
  ['خطوات دفع رسوم اختبار PMP', 'Pay for Exam Steps'],
  ['خطوات حجز موعد اختبار PMP', 'Schedule Exam Steps'],
  ['واجهة اختبار PMP وتقرير النتائج', 'PMP® Exam Interface and Results'],
  ['إرشادات وتعليمات الاختبار الحقيقي', 'Actual Exam Guidelines and Instructions'],
  ['إرشادات وتعليمات الاختبار الدولي', 'International Exam Guidelines and Instructions']
];
const examTitles = [legacyIntroTitles[3]];
const introTitles = [...legacyIntroTitles.filter((_, i) => i !== 3), legacyGuidanceTitles[0], legacyGuidanceTitles[4]];
const guidanceTitles = legacyGuidanceTitles.filter((_, i) => ![0, 4].includes(i));
const retiredAliases = [
  'أسس إدارة المشاريع وبيئتها', 'أسس المشاريع', 'دور مدير المشروع والقيادة', 'دور مدير المشروع',
  'Project management foundations and environment', 'Project foundations',
  'Role of the project manager and leadership', 'Role of the project manager'
];

// Presentation migration preserves records and all original learning keys.
const course = { id: 'pmp', chapters: [retiredAliases[0], retiredAliases[2], 'Existing source'] };
const lessons = [
  lesson('fixture-0', 0, 'مقدمة البرنامج', 'Introduction'),
  ...legacyIntroTitles.map(([ar, en], i) => lesson('fixture-' + (i + 1), 0, ar, en)),
  lesson('fixture-7', 0, 'Traditional and professional management'),
  lesson('fixture-8', 1, 'Strategic objectives'),
  lesson('fixture-9', 1, 'Knowledge Check — دور مدير المشروع والقيادة'),
  ...legacyGuidanceTitles.map(([ar, en], i) => lesson('fixture-' + (i + 10), 0, ar, en)),
  lesson('fixture-17', 2, 'Unclassified source lesson')
];
const progress = { lessons: { 0: true, 3: true, 7: true, 17: true }, weeks: { 2: true }, exams: { framework: { score: 82 } } };
const original = JSON.stringify({ course, lessons, progress });
freeze(course); freeze(lessons); freeze(progress);
const tree = r.learnerGroups(course, lessons);
assert.equal(tree.filter(group => !group.originalChapter).length, 17);
assert.deepEqual(keys(tree[0].children), ['journey']);
assert.deepEqual(indices(find(tree, 'intro')), [0, 1, 2, 3, 5, 6, 10, 14]);
assert.deepEqual(indices(find(tree, 'framework')), [7, 8, 9]);
assert.deepEqual(indices(find(tree, 'exam-guidelines')), [11, 12, 13, 15, 16]);
assert.equal(tree.at(-1).key, 'exam-guidelines');
assert.deepEqual(indices(find(tree, 'exam')), [4]);
assert.deepEqual(keys(r.topics(course)), ['intro','exam','framework','agile','predictive','hybrid','people','process','business','value','principles','lifecycles','ai','final-reviews','workshops','exam-eve','exam-guidelines']);
for (const groupKey of ['source_0', 'source_1']) assert.equal(find(tree, groupKey), undefined);
for (const ref of ['chapter:0', 'chapter:1']) assert(!r.chapterChoices(course).some(choice => choice.ref === ref));
const readings = flatten(tree).flatMap(group => [group.readingKey, ...(group.readings || []).map(reading => reading.key)]).filter(Boolean);
assert.deepEqual(Array.from(readings).sort(), Array.from(r.pmp, row => row[0]).sort());
assert.equal(new Set(readings).size, 18);
for (const groupKey of ['intro', 'exam', 'journey']) assert.equal(find(tree, groupKey).readingKey, groupKey);
for (const projection of [flatten(tree), r.adminGroups(course, lessons)]) {
  const all = projection.flatMap(group => group.items);
  assert.deepEqual(Array.from(all, item => item.i).sort((a, b) => a - b), lessons.map((_, i) => i));
  for (const item of all) {
    const { i, ...record } = item;
    assert.equal(JSON.stringify(record), JSON.stringify(lessons[i]));
  }
}
assert.deepEqual(Array.from(r.videoOrder(course, lessons)).sort((a, b) => a - b), lessons.map((_, i) => i));
assert.equal(JSON.stringify({ course, lessons, progress }), original);

// Published title matching works through each supported title field independently.
for (const [titles, expected] of [[introTitles, 'intro'], [examTitles, 'exam'], [guidanceTitles, 'exam-guidelines']]) {
  for (const pair of titles) for (const title of pair) {
    for (const field of ['t', 't_en', 'title', 'title_ar', 'title_en', 'en']) {
      const item = { id: 'title-fixture', ch: 0, [field]: '  ' + title + '  ', vimeo: '20000' };
      assert.deepEqual(indices(find(r.learnerGroups({ id: 'pmp', chapters: ['Unrelated source'] }, [item]), expected)), [0], title + ' via ' + field);
    }
  }
}
for (const title of ['PMI and Professional Ethics', 'PMI Certifications', 'استراتيجيات حل أسئلة الاختبار الحقيقي']) {
  assert.deepEqual(indices(find(r.learnerGroups({ id: 'pmp', chapters: [] }, [lesson('title-1', 99, title)]), 'intro')), [0]);
}
for (const alias of retiredAliases) {
  const c = { id: 'pmp', chapters: ['  ' + alias.toUpperCase() + '  '] };
  const items = [lesson('alias-1', 0, 'Neutral project overview'), lesson('alias-2', 0, 'Agile versus Predictive methods')];
  assert.deepEqual(indices(find(r.learnerGroups(c, items), 'framework')), [0, 1]);
  assert(!r.chapterChoices(c).some(choice => choice.ref === 'chapter:0'));
  assert.equal(r.moveChapter(c, 'chapter:0', -1), false, 'Retired alias cannot be resurrected by a move');
}

// Authoring parity and metadata-only moves, including JSON persistence/reload.
let authored = { id: 'pmp', chapters: ['Original legacy source', 'Another legacy source'] };
const authoredLessons = [lesson('saved-0', 0, 'Planning phase: scope'), lesson('saved-1', 1, 'Original neutral lesson')];
const savedProgress = { lessons: { 0: true, 1: true }, weeks: { 4: true }, activities: { 3: true }, exams: { scope: { score: 91 } } };
const lessonSnapshot = JSON.stringify(authoredLessons), progressSnapshot = JSON.stringify(savedProgress);
function verifyAuthored(label) {
  const before = JSON.stringify(authored), topics = r.topics(authored), published = flatten(topics);
  const publishedKeys = keys(published), learner = flatten(r.learnerGroups(authored, authoredLessons));
  const admin = r.adminGroups(authored, authoredLessons);
  assert.equal(new Set(publishedKeys).size, publishedKeys.length, label + ': unique public keys');
  for (const projection of [learner, admin]) {
    assert.deepEqual(keys(projection.filter(group => publishedKeys.includes(group.key))), publishedKeys, label + ': order parity');
    assert.equal(new Set(projection.map(group => group.key)).size, projection.length, label + ': no duplicate source groups');
    const items = projection.flatMap(group => group.items);
    assert.deepEqual(Array.from(items, item => item.i).sort((a, b) => a - b), authoredLessons.map((_, i) => i), label + ': lessons once');
    for (const item of items) {
      const { i, ...record } = item;
      assert.equal(JSON.stringify(record), JSON.stringify(authoredLessons[i]), label + ': intact record');
    }
    for (const topic of published) {
      const group = projection.find(group => group.key === topic.key);
      assert.equal(group.ar || group.title, topic.ar, label + ': Arabic label parity');
      assert.equal(group.en, topic.en, label + ': English label parity');
    }
  }
  assert.equal(JSON.stringify(authored), before, label + ': reads do not mutate');
  assert.equal(JSON.stringify(savedProgress), progressSnapshot, label + ': progress unchanged');
  assert.equal(JSON.stringify(authoredLessons.slice(0, 2)), lessonSnapshot, label + ': original lessons unchanged');
}
const reload = () => { authored = clone(authored); };
r.renameChapter(authored, 'outline:framework', 'إطار مخصص', 'Renamed framework');
const frameworkIndex = authored.chapters.findIndex(ch => ch?.outlineKey === 'framework');
reload(); verifyAuthored('Canonical rename');
assert.equal(r.ensureChapter(authored, 'outline:framework'), frameworkIndex);
const lengthAfterRename = authored.chapters.length;
r.renameChapter(authored, 'outline:framework', 'إطار مخصص آخر', 'Renamed framework again');
assert.equal(authored.chapters.length, lengthAfterRename, 'Repeated rename never appends a duplicate');

const customIndex = authored.chapters.length, customRef = 'chapter:' + customIndex, customKey = 'source_' + customIndex;
authored.chapters.push({ ar: 'فصل خاص', en: 'Custom chapter', custom: { preserve: 'yes' } });
authoredLessons.push(lesson('saved-2', customIndex, 'PMP Application'));
reload(); verifyAuthored('Custom addition');
assert.deepEqual(indices(find(r.learnerGroups(authored, authoredLessons), customKey)), [2], 'Explicit custom destination beats title heuristic');
for (const alias of retiredAliases) {
  r.renameChapter(authored, customRef, alias, 'Explicit reserved-name chapter');
  reload(); verifyAuthored('Reserved-name rename');
  assert(r.chapterChoices(authored).some(choice => choice.ref === customRef));
  assert.deepEqual(indices(find(r.learnerGroups(authored, authoredLessons), customKey)), [2]);
}
r.renameChapter(authored, customRef, 'فصل دائم', 'Permanent custom chapter');

// Moving a legacy string materializes only the selected slot, not other legacy slots.
assert.equal(r.moveChapter(authored, 'chapter:0', -1), true);
assert.equal(typeof authored.chapters[0], 'object');
assert.equal(authored.chapters[0].ar, 'Original legacy source');
assert.equal(authored.chapters[1], 'Another legacy source');
reload(); verifyAuthored('Legacy source move');
assert.deepEqual(indices(find(r.learnerGroups(authored, authoredLessons), 'source_0')), [0], 'Authored source overrides previous phase heuristic');
r.renameChapter(authored, 'chapter:1', 'فصل محفوظ ومعدل', 'Renamed original source');
reload(); verifyAuthored('Legacy source rename');
assert.deepEqual(indices(find(r.learnerGroups(authored, authoredLessons), 'source_1')), [1]);

for (const [ref, delta] of [['outline:framework', 1], [customRef, -1], ['outline:exam', -1], ['outline:executing', 1], ['outline:review', -1]]) {
  const beforeChapters = clone(authored.chapters);
  assert.equal(r.moveChapter(authored, ref, delta), true, ref + ' moves');
  reload(); verifyAuthored('Move ' + ref);
  for (let i = 0; i < beforeChapters.length; i++) {
    const before = beforeChapters[i], after = authored.chapters[i];
    if (typeof before === 'string') assert.equal(after, before);
    else for (const field of Object.keys(before).filter(field => field !== 'outlineOrder')) {
      assert.equal(JSON.stringify(after[field]), JSON.stringify(before[field]), 'Stable slot ' + i + ', field ' + field);
    }
  }
}
const beforeSingletonMove = JSON.stringify(authored);
assert.equal(r.moveChapter(authored, 'outline:journey', -1), false);
assert.equal(JSON.stringify(authored), beforeSingletonMove);
for (let n = 0; n < 80; n++) {
  const publishedKeys = keys(flatten(r.topics(authored)));
  const choices = r.chapterChoices(authored).filter(choice => publishedKeys.includes(choice.key));
  const choice = choices[(n * 17 + 3) % choices.length];
  r.moveChapter(authored, choice.ref, n % 2 ? 1 : -1);
  reload(); verifyAuthored('Repeated move ' + n);
}
assert.equal(authored.chapters[customIndex].custom.preserve, 'yes');
const beforeInvalid = JSON.stringify(authored);
assert.equal(r.moveChapter(authored, 'outline:missing', 1), false);
assert.equal(r.moveChapter(authored, customRef, 0), false);
assert.equal(JSON.stringify(authored), beforeInvalid);
const full = { id: 'pmp', chapters: Array.from({ length: 100 }, (_, i) => 'Saved source ' + i) };
const beforeFull = JSON.stringify(full);
assert.throws(() => r.moveChapter(full, 'outline:framework', 1));
assert.equal(JSON.stringify(full), beforeFull, 'Capacity failure rolls back all staged canonical slots');
assert.throws(() => r.moveChapter(full, 'chapter:0', -1));
assert.equal(JSON.stringify(full), beforeFull, 'Capacity failure rolls back legacy materialization too');

// Real course-chapters handler saves/reloads metadata without touching lessons.
const server = fs.readFileSync('server.js', 'utf8');
const start = server.indexOf('function validCourseChapterKeys(');
const end = server.indexOf("app.put('/api/admin/content'", start);
assert(start >= 0 && end > start);
let handler, storedCourses = JSON.stringify([{ id: 'pmp', chapters: [] }]), writes = 0;
vm.runInNewContext(server.slice(start, end), {
  app: { put: (_path, ...handlers) => { handler = handlers.at(-1); } }, auth() {}, admin() {},
  setting: () => storedCourses,
  db: { prepare: () => ({ run: value => { storedCourses = value; writes++; } }) }
});
let status = 200, response;
handler({ params: { course: 'pmp' }, body: { chapters: clone(authored.chapters) } }, {
  status(code) { status = code; return this; }, json(body) { response = body; return this; }
});
assert.equal(status, 200); assert.equal(response.ok, true); assert.equal(writes, 1);
const expectedTopics = JSON.stringify(r.topics(authored));
authored = JSON.parse(storedCourses)[0];
assert.equal(JSON.stringify(r.topics(authored)), expectedTopics, 'Actual API roundtrip retains labels/order');
verifyAuthored('Actual API reload');

// Public HTML helpers use the same ordering and explicit labels in both languages.
const source = fs.readFileSync('public/index.html', 'utf8');
function readFunction(name) {
  const start = source.indexOf('function ' + name + '('), end = source.indexOf('\nfunction ', start + 1);
  assert(start >= 0); return source.slice(start, end < 0 ? undefined : end);
}
const publicContext = {
  window: { CourseRoadmap: r }, siteEnglish: () => publicContext.english,
  esc: value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
};
vm.createContext(publicContext);
for (const name of ['publicCourseTopics', 'publicTopicBody']) vm.runInContext(readFunction(name), publicContext);
for (const english of [false, true]) {
  publicContext.english = english;
  const topics = publicContext.publicCourseTopics(authored);
  assert.deepEqual(keys(topics), keys(r.topics(authored)));
  for (const topic of topics) assert(publicContext.publicTopicBody(topic).includes(publicContext.esc(english ? topic.en : topic.ar)));
}

// Non-PMP order operations stay unsupported and leave their state unchanged.
const other = { id: 'rmp', chapters: [{ ar: 'أول', en: 'First', custom: 7 }, 'Second'] };
const otherBefore = JSON.stringify(other);
assert.equal(r.moveChapter(other, 'chapter:0', 1), false);
assert.equal(JSON.stringify(other), otherBefore);
assert.deepEqual(Array.from(r.chapterChoices(other), choice => choice.ref), ['chapter:0', 'chapter:1']);
assert.equal(JSON.stringify(r.learnerGroups(other, [lesson('rmp-0', 0, 'RMP')])), JSON.stringify(r.groups(other, [lesson('rmp-0', 0, 'RMP')])));

console.log('PASS: synthetic PMP curriculum mapping; every title field; stable lesson/progress/reading keys; reserved custom labels; canonical/custom/legacy additions and renames; metadata-only root/nested moves; public/learner/admin parity; JSON and actual chapter-API reload; atomic capacity failures; non-PMP unchanged.');
