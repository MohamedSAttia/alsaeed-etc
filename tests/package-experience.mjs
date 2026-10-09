/** Local-only browser regression checks. No production API, account, or database is used.
 * Run: node tests/package-experience.mjs
 * Requires Playwright (or PLAYWRIGHT_MODULE) and Chromium (or CHROMIUM_PATH).
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

let playwright;
try { playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
catch (error) {
  const bundled = '/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';
  if (!existsSync(bundled)) throw error;
  playwright = await import(pathToFileURL(bundled).href);
}
const root = resolve('.');
const source = await readFile(join(root, 'public/package-experience.js'), 'utf8');
assert.doesNotMatch(source, /\bfetch\s*\(|localStorage|\.api\s*\(|\.save\s*\(|\.checkout\s*\(/, 'Shell must remain presentation-only');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname.startsWith('/api/') || pathname.includes('/api/')) {
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end('{"error":"Local presentation fixture: no backend"}'); return;
  }
  const name = pathname === '/' ? '/index.html' : pathname;
  const candidates = [resolve(root, 'public', '.' + name), resolve(root, '.' + name)];
  for (const file of candidates) {
    if (!file.startsWith(root + '/')) continue;
    try {
      if (!(await stat(file)).isFile()) continue;
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(await readFile(file)); return;
    } catch {}
  }
  res.writeHead(404); res.end('Not found');
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = 'http://127.0.0.1:' + server.address().port;
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await playwright.chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.APP && window.PACKAGES?.length && window.PACKAGE_EXPERIENCE);
  const packageIds = await page.evaluate(() => PACKAGES.filter(p => p.active !== false).map(p => p.id));
  assert.ok(packageIds.length >= 4, 'Published catalog must be available');
  const snapshot = await page.evaluate(() => JSON.stringify({ packages: PACKAGES, courses: COURSES }));
  for (const language of ['ar', 'en']) {
    await page.evaluate(language => {
      window.__lang = language;
      I18.set(language);
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
    }, language);
    for (const pid of packageIds) {
      await page.evaluate(pid => APP.go('pkg/' + pid), pid);
      await page.waitForSelector('[data-package-experience="detail"] .package-exp-outline');
      assert.equal(await page.locator('.package-exp-outline').count(), 1, pid + ': one detail outline');
      assert.ok(await page.locator('.package-exp-outline button').count() >= 5, pid + ': detail sections');
      assert.equal(await page.locator('#promoIn').getAttribute('id'), await page.locator('label[for="promoIn"]').getAttribute('for'));
      const hash = await page.evaluate(() => location.hash);
      await page.locator('.package-exp-outline button').first().click();
      assert.equal(await page.evaluate(() => location.hash), hash, 'In-page navigation must not change SPA route');
      assert.equal(await page.evaluate(() => document.activeElement.classList.contains('package-exp-heading')), true);
      await page.evaluate(() => { PACKAGE_EXPERIENCE.refresh(); PACKAGE_EXPERIENCE.refresh(); });
      assert.equal(await page.locator('.package-exp-outline').count(), 1, 'Enhancement is idempotent');
    }
  }
  assert.equal(await page.evaluate(() => JSON.stringify({ packages: PACKAGES, courses: COURSES })), snapshot, 'Package data and course taxonomy stay unchanged');
  console.log('PASS: ' + packageIds.length + ' package detail pages in Arabic and English, route-safe navigation, labels, idempotence, untouched catalog');

  // In-memory fixture only. This tests the real learner renderer/bindings, not live authentication.
  await page.evaluate(() => {
    APP.DB.users.push({ id: 'package-ui-fixture', name: 'Local UI fixture', role: 'student', packages: PACKAGES.map(p => ({ id: p.id })) });
    APP.DB.session = 'package-ui-fixture';
    window.__lang = 'ar'; I18.set('ar'); document.documentElement.dir = 'rtl';
  });
  const order = ['plan', 'content', 'exams', 'resources', 'flash', 'activities', 'games', 'workspace', 'cert'];
  for (const pid of packageIds) {
    await page.evaluate(pid => APP.go('learn/' + pid), pid);
    await page.waitForSelector('.package-exp-nav');
    const keys = await page.locator('.package-exp-nav button[data-lt]').evaluateAll(buttons => buttons.map(b => b.dataset.lt));
    assert.deepEqual(keys, order.filter(key => keys.includes(key)), pid + ': common order without unavailable sections');
    assert.equal(await page.locator('.package-exp-nav [aria-current="true"]').count(), 1);
    assert.equal(await page.locator('#lnBody').getAttribute('role'), 'region');
    const before = await page.evaluate(() => JSON.stringify({ packages: PACKAGES, courses: COURSES, progress: APP.DB.progress }));
    await page.evaluate(() => PACKAGE_EXPERIENCE.refresh());
    assert.equal(await page.evaluate(() => JSON.stringify({ packages: PACKAGES, courses: COURSES, progress: APP.DB.progress })), before);
  }
  console.log('PASS: ' + packageIds.length + ' real learner views with local fixture, consistent conditional sections, current state and no progress changes');

  const pid = packageIds.find(id => id === 'rmp-full') || packageIds[0];
  await page.evaluate(pid => APP.go('learn/' + pid), pid);
  await page.waitForSelector('.package-exp-nav [data-lt="resources"]');
  await page.locator('.package-exp-nav [data-lt="resources"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement?.id === 'package-learning-resources');
  assert.equal(await page.locator('#lnBody').getAttribute('aria-labelledby'), 'package-learning-resources');
  await page.locator('.package-exp-nav [data-lt="plan"]').click();
  await page.waitForFunction(() => document.activeElement?.id === 'package-learning-plan');
  const shortcuts = await page.locator('#lnBody .card > .grid > button[data-lt]').evaluateAll(buttons => buttons.map(b => b.dataset.lt));
  assert.deepEqual(shortcuts, order.filter(key => shortcuts.includes(key)), 'Plan shortcuts share the navigation order');
  await page.locator('.package-exp-progress-jump').click();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'package-learning-progress');
  await page.evaluate(() => APP.go('home'));
  await page.waitForFunction(() => !document.getElementById('app').dataset.packageExperience);
  await page.evaluate(pid => APP.go('pkg/' + pid), pid);
  await page.waitForSelector('.package-exp-outline');
  const related = page.locator('.package-exp-detail div[role="link"]').first();
  const target = await related.getAttribute('data-r');
  await related.focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(target => location.hash === '#' + target, target);
  console.log('PASS: native keyboard controls, preserved click handlers, re-render focus restoration, progress jump, route cleanup, related-package links');

  const screenshotDir = process.env.PACKAGE_SCREENSHOT_DIR;
  if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
  for (const language of ['ar', 'en']) {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(({ pid, language }) => {
        window.__lang = language; I18.set(language); document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        localStorage.setItem('learning-language:' + pid, language);
        APP.go('learn/' + pid);
      }, { pid, language });
      await page.waitForSelector('.package-exp-workspace');
      await page.waitForTimeout(150);
      const bounds = await page.locator('.package-exp-workspace').evaluate(node => ({ left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right, width: innerWidth }));
      assert.ok(bounds.left >= -1 && bounds.right <= bounds.width + 1, JSON.stringify({ language, width, bounds }));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(overflow, false, language + ' ' + width + ': no horizontal page overflow');
      const hitTargets = await page.locator('.package-exp-nav button').evaluateAll(buttons => buttons.every(b => b.getBoundingClientRect().height >= 44));
      assert.equal(hitTargets, true, 'Accessible touch target heights');
      if (screenshotDir && [1440, 390].includes(width)) {
        await page.locator('.package-exp-workspace').scrollIntoViewIfNeeded();
        await page.screenshot({ path: join(screenshotDir, 'package-learning-' + language + '-' + width + '.png'), fullPage: true });
      }
    }
  }
  console.log('PASS: Arabic RTL and English LTR at 1440, 768, 390 and 320px; no horizontal overflow; 44px controls');
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log('PASS: no browser runtime errors. Live authentication, enrollment, payments and real learner data were not exercised.');
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
