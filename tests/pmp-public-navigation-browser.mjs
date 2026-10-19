/** Local-only browser regression checks. No production API, account, or database is used.
 * Run: node tests/pmp-learner-outline-browser.mjs
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
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.APP&&window.PACKAGES?.length);
 for(const width of [1440,390,320])for(const lang of ['ar','en']){
  await page.setViewportSize({width,height:900});
  await page.evaluate(lang=>{window.__lang=lang;window.I18.set(lang);},lang);
  for(const route of ['course/pmp','pkg/pmp-full','course/pmp']){
   await page.evaluate(route=>window.APP.go(route),route);
   const first=page.locator('.public-topic-disclosure').first();await first.waitFor();
   assert.equal(await first.getAttribute('open'),null);
   const summary=first.locator(':scope > summary');await summary.focus();
   await page.keyboard.press('Enter');assert.notEqual(await first.getAttribute('open'),null);
   await page.keyboard.press('Space');assert.equal(await first.getAttribute('open'),null);
   for(let i=0;i<3;i++){await summary.click();assert.notEqual(await first.getAttribute('open'),null);await summary.click();assert.equal(await first.getAttribute('open'),null);}
   await summary.click();
   const overflow=await page.locator('.public-topic-copy').evaluateAll(els=>els.some(el=>el.getBoundingClientRect().right>innerWidth+1||el.getBoundingClientRect().left< -1));
   assert.equal(overflow,false,`${width}px ${lang} ${route} outline remains in viewport`);
   await page.keyboard.press('Tab');
   assert.notEqual(await page.evaluate(()=>document.activeElement.tagName),'BODY');
  }
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: Chromium AR/EN, 1440/390/320px, course/package navigation and repeat return, native Enter/Space/click toggles, tab exit, outline viewport bounds.');
 await context.close();
}finally{await browser.close();await new Promise(done=>server.close(done));}
