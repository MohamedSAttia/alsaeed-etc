/** Local-only browser regression checks. No production API, account, or database is used.
 * Run: node tests/public-experience.mjs
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
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const lang of ['ar','en']) {
    await page.goto(origin);await page.evaluate(lang=>{localStorage.setItem('alsaeed_lang',lang)},lang);await page.reload();
    await page.waitForSelector('.public-from-price');
    for(const width of [1440,768,390,320]) {
      await page.setViewportSize({width,height:900});
      await page.goto(origin+'/#home');await page.waitForSelector('.public-from-price');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Home overflow '+lang+' '+width);
      if(width<=1180) {
        const burger=page.locator('#burger');await burger.click();assert.equal(await burger.getAttribute('aria-expanded'),'true');
        await page.keyboard.press('Escape');assert.equal(await burger.getAttribute('aria-expanded'),'false');
        assert.equal(await page.evaluate(()=>document.activeElement.id),'burger');
        const logo=await page.locator('#logoLink').boundingBox();assert.ok(logo.width>90,'Protected mobile brand width');
      }
      await page.goto(origin+'/#programs');await page.waitForSelector('#publicCatalogForm');
      await page.locator('#publicQuery').fill('PMP');await page.locator('#publicMode').selectOption('sim');
      assert.ok(await page.locator('.public-result-card').count());
      await page.locator('#publicQuery').fill('zzzz-no-match');await page.waitForSelector('.public-empty');
      await page.locator('#publicClearFilters').click();await page.waitForSelector('[data-cfamily="pmi"]');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Catalog overflow '+lang+' '+width);
      if(process.env.PUBLIC_SCREENSHOT_DIR){await mkdir(process.env.PUBLIC_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:join(process.env.PUBLIC_SCREENSHOT_DIR,`catalog-${lang}-${width}.png`),fullPage:true});}
    }
    await page.locator('[data-cfamily="pmi"]').click();await page.waitForSelector('[data-ccert="pmp"]');
    await page.locator('[data-ccert="pmp"]').click();await page.waitForSelector('.v38-packages');
    await page.goBack();await page.waitForSelector('[data-ccert="pmp"]');
    await page.goForward();await page.waitForSelector('.v38-packages');
  }
  assert.deepEqual(errors,[]);console.log('PASS: real-browser public layout, menu keyboard, search/filters and catalog history in AR/EN');
} finally { await browser.close();await new Promise(done=>server.close(done)); }
