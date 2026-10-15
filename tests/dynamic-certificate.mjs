import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const { JSDOM } = await import(process.env.JSDOM_MODULE || 'jsdom');
const context = { window: { location: { origin: 'https://al-ltc.com' }, LOGO: () => '<svg viewBox="0 0 100 100"><path d="M0 0h100v100z"/></svg>' }, URL, Intl, Date };
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../public/completion-certificate.js', import.meta.url), 'utf8'), context);
const api = context.window.AlsaeedCertificate;
const canonical = 'Project Management Professional (PMP)® Preparation Course';
const badgePath = '/assets/badges/pmi-atp-instructor-pmp-supplied.png';
const badge = { courseId: 'pmp', asset: badgePath, label: 'PMI Authorized Training Partner Instructor — PMP', verified: true };
const instructor = { id: 'synthetic-instructor', name: 'Synthetic Instructor', title: 'Lead Course Instructor', signatureName: 'Never convert me into handwriting', signatureAsset: null, badge };
const presentation = { version: 1, courseId: 'pmp', courseCode: 'PMP', courseLogo: '/assets/certifications/pmp.jpeg', instructor };
const original = { no: 'PREVIEW-NOT-ISSUED', name: 'Synthetic Learner', course: canonical, hours: 35, issued: Date.UTC(2020,1,3), presentation, verify: 'https://al-ltc.com/verify/0123456789abcdef0123456789abcdef0123456789abcdef' };
const doc = input => new JSDOM(api.render(input)).window.document;
const freeze = value => { for (const v of Object.values(value)) if (v && typeof v === 'object') freeze(v); return Object.freeze(value); };
const changed = (snapshot = {}, person = {}) => ({ ...original, presentation: { ...presentation, ...snapshot, instructor: { ...instructor, ...person } } });
test('PMP mark is superscript while exact English title remains unchanged', () => {
  const d = doc(original);
  assert.equal(d.querySelector('.cert-course').textContent, canonical);
  assert.equal(d.querySelector('.cert-course sup').textContent, '®');
  assert.equal(d.documentElement.lang, 'en');
  assert.match(d.querySelector('style').textContent, /\.cert-trademark\{[^}]*top:-\.55em/);
});
test('reference layout uses the instructor credential beside the instructor, without a separate program logo', () => {
  const d = doc(original);
  assert.equal(d.querySelector('.cert-instructor-name').textContent, instructor.name);
  assert.equal(d.querySelector('.cert-instructor-label').textContent, 'Instructor');
  assert.equal(d.querySelector('.cert-instructor-title').textContent, instructor.title);
  assert.equal(d.querySelector('.cert-instructor-badge').getAttribute('src'), 'https://al-ltc.com' + badgePath);
  assert.equal(d.querySelector('.cert-course-logo'), null);
  assert.equal(d.querySelector('.cert-course-brand'), null);
  assert(d.querySelector('.cert-signature.left .cert-instructor-badge'));
  assert(!d.querySelector('.cert-course-brand .cert-instructor-badge'));
});
test('new snapshots never acquire credentials merely from the course ID or title', () => {
  for (const person of [{ badge: null }, { badge: { ...badge, verified: false } }, { badge: { ...badge, verified: 'true' } }, { badge: { ...badge, verified: undefined } }, { id: '' }, { name: '' }]) {
    assert.equal(doc(changed({}, person)).querySelector('.cert-instructor-badge'), null);
  }
  for (const courseId of ['rmp', 'pba', 'grcp', 'acp', 'p3o', 'lss', 'PMP', ' pmp', undefined]) {
    assert.equal(doc(changed({ courseId })).querySelector('.cert-instructor-badge'), null);
  }
});
test('matching RMP badge stays RMP-specific and never becomes a generic instructor logo', () => {
  const rmp = changed({ courseId: 'rmp', courseCode: 'RMP', courseLogo: '/assets/certifications/rmp.png' }, { badge: { courseId: 'rmp', asset: '/assets/badges/pmi-atp-instructor-rmp.png', verified: true } });
  rmp.course = 'Risk Management Professional Preparation';
  assert(doc(rmp).querySelector('.cert-instructor-badge'));
  assert.equal(doc({ ...rmp, presentation: { ...rmp.presentation, courseId: 'acp' } }).querySelector('.cert-instructor-badge'), null);
});
test('every course keeps its saved title and instructor within the shared reference layout', () => {
  for (const [id, asset] of [['rmp','rmp.png'], ['acp','acp.jpg'], ['grcp','grcp.webp'], ['pba','pba.jpeg'], ['p3o','axelos.jpg'], ['lss','../covers/lss.svg']]) {
    const record = changed({ courseId: id, courseCode: id.toUpperCase(), courseLogo: '/assets/certifications/' + asset }, { id: id+'-teacher', name: 'Teacher for '+id, badge: null });
    record.course = 'Saved '+id+' Training'; record.courseId = 'pmp';
    const d = doc(record);
    assert.equal(d.querySelector('.cert-course').textContent, record.course);
    assert.equal(d.querySelector('.cert-instructor-name').textContent, 'Teacher for '+id);
    assert.equal(d.querySelector('.cert-course-logo'), null);
    assert.equal(d.querySelector('.cert-instructor-badge'), null);
  }
});
test('legacy records keep learner, course, number, hours and date without identity or branding backfill', () => {
  for (const presentation of [null, undefined]) {
    const record = freeze({ ...original, presentation, courseId: 'rmp', course: 'Saved 2019 RMP title', issued: Date.UTC(2019,5,7) });
    const before = JSON.stringify(record), d = doc(record);
    assert.equal(d.querySelector('.cert-course').textContent, record.course);
    assert.equal(d.querySelector('.cert-name').textContent, record.name);
    assert.equal(d.querySelector('.cert-hours').textContent, '35 Training Hours');
    assert.match(d.querySelector('.cert-record').textContent, /07 June 2019/);
    assert.match(d.querySelector('.cert-record').textContent, /PREVIEW-NOT-ISSUED/);
    assert.equal(d.querySelector('.cert-instructor-name').textContent, 'Name not recorded');
    assert.equal(d.querySelector('.cert-instructor-badge'), null);
    assert.equal(d.querySelector('.cert-course-logo'), null);
    assert.equal(JSON.stringify(record), before);
  }
});
test('deep frozen snapshots remain byte-for-byte unchanged through rendering and record normalization', () => {
  const saved = freeze(structuredClone(original)), before = JSON.stringify(saved);
  const rendered = doc(saved);
  assert.equal(rendered.querySelector('.cert-instructor-name').textContent, saved.presentation.instructor.name);
  api.record(saved);
  assert.equal(JSON.stringify(saved), before);
});
test('unsupported presentation versions are ignored, never promoted to trusted live metadata', () => {
  const d = doc(changed({ version: 2 }));
  assert.equal(d.querySelector('.cert-instructor-badge'), null);
  assert.equal(d.querySelector('.cert-course-logo'), null);
});
test('a saved instructor receives a blue typographic name design with the actual name, not signatureName', () => {
  const d = doc(original);
  assert.equal(d.querySelector('.cert-signature-image'), null);
  assert.equal(d.querySelector('.cert-signature-slot'), null);
  assert.equal(d.querySelector('.cert-instructor-design').textContent, instructor.name);
  assert.equal(d.querySelector('.cert-instructor-design').getAttribute('aria-label'), 'Decorative name design: ' + instructor.name);
  assert.equal(d.querySelector('.cert-issuer-mark').textContent, 'AlSaeed');
  assert(!d.documentElement.textContent.includes(instructor.signatureName));
  assert.match(d.querySelector('style').textContent, /color:#1756a4/);
  assert.match(d.querySelector('style').textContent, /assets\/fonts\/Allura-Regular\.ttf/);
});
test('signature image requires a constrained local asset and recorded instructor', () => {
  const d = doc(changed({}, { signatureAsset: '/assets/signatures/synthetic-approved.png' }));
  assert.equal(d.querySelector('.cert-signature-image').getAttribute('src'), 'https://al-ltc.com/assets/signatures/synthetic-approved.png');
  for (const signatureAsset of ['https://external.invalid/x.png', 'javascript:alert(1)', 'data:image/svg+xml,x', '/assets/signatures/x.svg', '/assets/signatures/x.png?token=secret']) {
    assert.equal(doc(changed({}, { signatureAsset })).querySelector('.cert-signature-image'), null);
  }
});
test('all displayed user-supplied text is escaped including instructor and badge label', () => {
  const attack = '<img src=x onerror=alert(1)>';
  const record = changed({ courseId: 'rmp', courseCode: attack }, { name: attack, title: attack, badge: { courseId: 'rmp', asset: '/assets/badges/pmi-atp-instructor-rmp.png', label: attack, verified: true } });
  Object.assign(record, { name: attack, no: attack, course: attack });
  const d = doc(record);
  for (const selector of ['.cert-name','.cert-course','.cert-instructor-name','.cert-instructor-title']) assert.equal(d.querySelector(selector).textContent, attack);
  assert.equal(d.querySelector('.cert-instructor-badge').getAttribute('alt'), attack);
  assert.equal(d.querySelectorAll('script,[onerror],[onload]').length, 0);
});
test('course logos never reintroduce a corner badge, including safe and unsafe asset paths', () => {
  for (const courseLogo of ['/assets/certifications/pmp.jpeg', '/assets/certifications/rmp.png', 'https://external.invalid/x.svg', '//external.invalid/x.png', 'javascript:alert(1)', 'data:image/png;base64,x', '/assets/certifications/x.png?name=secret', '/assets/certifications/x.png#x', '/assets/certifications/x%2epng', badgePath, '/assets/certifications/x.png\" onerror=alert(1)', 'https://person@al-ltc.com/assets/certifications/pmp.jpeg']) {
    assert.equal(doc(changed({ courseLogo })).querySelector('.cert-course-logo'), null, courseLogo);
  }
});
test('QR appears only with a strict PNG data URL and same-origin identifier-only verification link', () => {
  const qr = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
  const d = doc({ ...original, qr });
  assert.equal(d.querySelector('.cert-qr').getAttribute('href'), original.verify);
  assert.equal(d.querySelector('.cert-qr img').getAttribute('src'), qr);
  for (const bad of ['https://qr.example/?data=secret', 'data:image/svg+xml,<svg/>', 'data:image/png;base64,invalid', qr+'\" onerror=alert(1)', qr+' '.repeat(100000)]) {
    assert.equal(doc({ ...original, qr: bad }).querySelector('.cert-qr'), null);
  }
  for (const verify of ['https://external.invalid/verify/x', 'javascript:alert(1)', '/verify/', '/verify/id?name=Learner', '/verify/id#name', '/verify/id/extra', 'https://person@al-ltc.com/verify/x', '/verify/x%0a']) {
    const invalid = doc({ ...original, qr, verify });
    assert.equal(invalid.querySelector('.cert-qr'), null, verify);
    assert.equal(invalid.querySelector('.cert-verify'), null, verify);
  }
});
test('long course and instructor fields receive bounded fitting and print rules', () => {
  const record = changed({ courseId: 'rmp' }, { name: 'W'.repeat(160), title: 'W'.repeat(80), badge: null });
  record.course = 'W'.repeat(300);
  const html = api.render(record);
  const courseSize = Number(html.match(/\.cert-course\{[^}]*font-size:([\d.]+)px/)[1]);
  const instructorSize = Number(html.match(/\.cert-signature \.cert-instructor-name\{[^}]*font-size:([\d.]+)px/)[1]);
  assert(courseSize >= 12 && courseSize <= 16);
  assert(instructorSize >= 8 && instructorSize <= 12);
  assert.match(html, /--certificate-instructor-print-size/);
  assert.match(html, /--certificate-instructor-title-print-size/);
});
test('prepare fits instructor text using measured bounds and scales whole canvas uniformly on mobile', async () => {
  const styles = {}; let font = 24;
  const box = { clientWidth: 300, clientHeight: 56, style: { set fontSize(v) { font = Number.parseFloat(v); }, setProperty(k,v) { styles[k]=v; } } };
  box.firstElementChild = { get scrollWidth() { return 300; }, get scrollHeight() { return Math.ceil(160*1.1*font/300)*font*1.16; } };
  const canvas = { style: { setProperty(k,v) { styles[k]=v; } } }, viewport = { style: {} };
  let listener;
  const popup = { innerWidth: 375, document: { images: [], querySelector: s => s === '.cert-instructor-name' ? box : s === '.cert-canvas' ? canvas : s === '.cert-viewport' ? viewport : null }, getComputedStyle: () => ({ fontSize: font+'px' }), addEventListener: (event, fn) => { assert.equal(event,'resize'); listener=fn; } };
  await api.prepare(popup);
  assert(box.firstElementChild.scrollHeight <= box.clientHeight);
  assert.equal(styles['--certificate-scale'], String(375/1400));
  assert.equal(viewport.style.height, (1092*375/1400)+'px');
  assert(Number.parseFloat(styles['--certificate-instructor-print-size']) < font);
  popup.innerWidth=1900; listener(); assert.equal(styles['--certificate-scale'], '1');
});

const defaultInstructor = { id: 'mohamed-attia', name: 'Dr.Mohamed Attia', title: 'Course Instructor', badge };
const defaultDisplay = { ...presentation, instructor: defaultInstructor, source: 'current-instructor-settings' };
test('response-only current instructor hints decorate missing historical identity without changing original records', () => {
  for (const snapshot of [null, { ...presentation, instructor: null }, { version: 1, courseId: 'pmp' }]) {
    const record = freeze({ ...original, presentation: snapshot, displayPresentation: structuredClone(defaultDisplay) });
    const before = JSON.stringify(record), d = doc(record);
    assert.equal(d.querySelector('.cert-instructor-name').textContent, 'Dr.Mohamed Attia');
    assert.equal(d.querySelector('.cert-instructor-design').textContent, 'Dr.Mohamed Attia');
    assert.equal(d.querySelector('.cert-instructor-badge').getAttribute('src'), 'https://al-ltc.com' + badgePath);
    assert.equal(d.querySelector('.cert-name').textContent, record.name);
    assert.match(d.querySelector('.cert-record').textContent, /03 February 2020/);
    assert.equal(JSON.stringify(record), before);
  }
});
test('an existing instructor always wins over a display hint, including a legacy name without an ID', () => {
  for (const id of ['saved-instructor', '', undefined]) {
    const record = changed({}, { id, name: 'Previously Saved Teacher', badge: null });
    record.displayPresentation = defaultDisplay;
    const d = doc(record);
    assert.equal(d.querySelector('.cert-instructor-name').textContent, 'Previously Saved Teacher');
    assert.equal(d.querySelector('.cert-instructor-design').textContent, 'Previously Saved Teacher');
    assert.equal(d.querySelector('.cert-instructor-badge'), null);
    assert(!d.documentElement.textContent.includes('Mohamed Attia'));
  }
});
test('untrusted, malformed, or cross-course display hints do not infer historical credentials', () => {
  const base = { ...original, presentation: { version: 1, courseId: 'rmp', instructor: null } };
  for (const displayPresentation of [defaultDisplay, { ...defaultDisplay, source: undefined }, { ...defaultDisplay, version: 2 }]) {
    const d = doc({ ...base, displayPresentation });
    assert.equal(d.querySelector('.cert-instructor-badge'), null);
    assert.equal(d.querySelector('.cert-instructor-name').textContent, 'Name not recorded');
  }
  const d = doc({ ...original, presentation: null, displayPresentation: { ...defaultDisplay, courseId: null, courseLogo: null, instructor: { ...defaultInstructor, badge: null } } });
  assert.equal(d.querySelector('.cert-instructor-name').textContent, 'Dr.Mohamed Attia');
  assert.equal(d.querySelector('.cert-instructor-badge'), null);
  assert.equal(d.querySelector('.cert-course-logo'), null);
});
test('the supplied badge retains its full image and is sized clearly beside the instructor', () => {
  const d = doc(original), css = d.querySelector('style').textContent;
  assert.equal(d.querySelector('.cert-instructor-badge').parentElement.className, 'cert-instructor-summary');
  assert.match(css, /\.cert-instructor-badge\{width:148px;height:124px;object-fit:contain/);
  assert(!css.includes('object-fit:cover'));
});
test('navy/gold QR frame stays outside the unchanged white QR image and quiet zone', () => {
  const qr = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
  const d = doc({ ...original, qr }), css = d.querySelector('style').textContent;
  assert.equal(d.querySelector('.cert-qr-image img').getAttribute('src'), qr);
  assert.match(css, /\.cert-qr-image\{display:block;padding:7px;background:#fff/);
  assert.match(css, /\.cert-qr\{[^}]*width:144px[^}]*border:2px solid #c59b3d[^}]*background:#0b304e/);
  assert.match(css, /\.cert-qr img\{display:block;width:110px;height:110px/);
  assert.equal(d.querySelector('.cert-qr-caption').textContent, 'Scan to verify');
});
test('renderer never adds a preview warning to real runtime certificates', () => {
  const html = api.render({ ...original, no: 'AL-2026-001', name: 'Example Learner' });
  assert(!html.includes('NOT ISSUED'));
  assert(!html.includes('SYNTHETIC PREVIEW'));
});

test('the server display hint supplies exact course identity when the client package hint is absent', () => {
  const d = doc({ ...original, course: 'Old saved preparation title', courseId: undefined, presentation: null, displayPresentation: defaultDisplay });
  assert.equal(d.querySelector('.cert-course').textContent, canonical);
  assert.equal(d.querySelector('.cert-course sup').textContent, '®');
  assert(d.querySelector('.cert-instructor-badge'));
  assert.equal(d.querySelector('.cert-instructor-name').textContent, 'Dr.Mohamed Attia');
});
