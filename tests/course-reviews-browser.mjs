/** Local-only browser regression checks. No production API, account, or database is used.
 * Run: node tests/course-reviews-browser.mjs
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
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.APP&&window.PACKAGES?.length);
 await page.evaluate(()=>{
   APP.DB.users.push({id:'review-local',name:'Synthetic reviewer',role:'student',packages:[{id:'pmp-full'}]});APP.DB.session='review-local';
   let review=null;
   APP.api=async(path,opts={})=>{
     if(!path.startsWith('/course-reviews/'))return {};
     if(path.endsWith('/mine'))return {eligible:true,review};
     if(opts.method==='PUT')review={...opts.body,published:1,updated:Date.now()};
     if(opts.method==='DELETE')review.published=0;
     return {count:review?.published?1:0,average:review?.published?review.rating:null,reviews:review?.published?[review]:[]};
   };
   APP.go('course/pmp');
 });
 await page.locator('#cd-reviews form').waitFor();
 await page.locator('[data-course-jump="cd-reviews"]').click();
 await page.locator('#cd-reviews select').selectOption('2');
 await page.locator('#cd-reviews textarea').fill('Useful lessons; more practice would help.');
 await page.locator('#cd-reviews input:not([type=checkbox])').fill('Learner');
 await page.locator('#cd-reviews input[type=checkbox]').check();
 await page.locator('#cd-reviews form button').click();
 await page.waitForFunction(()=>document.querySelector('.review-entry')?.textContent.includes('Useful lessons'));
 assert.ok((await page.locator('#cd-reviews').innerText()).includes('2.00 / 5'));
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No mobile horizontal overflow');
 await page.locator('#cd-reviews').screenshot({path:'/workspace/shared/course-reviews-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(()=>{window.__lang='en';window.I18.set('en');APP.render();});
 await page.locator('#cd-reviews form').waitFor();
 assert.equal(await page.locator('#cd-reviews h2').innerText(),'Learner reviews');
 await page.locator('#cd-reviews').screenshot({path:'/workspace/shared/course-reviews-desktop.png'});
 await page.locator('#cd-reviews button').filter({hasText:'Unpublish my review'}).click();
 await page.waitForFunction(()=>!document.querySelector('.review-entry'));
 assert.deepEqual(errors,[]);
 console.log('PASS: local Chromium public course page, real navigation control, submission, live average, unpublish, Arabic/English and mobile overflow.');
 await context.close();
} finally { await browser.close(); await new Promise(done=>server.close(done)); }
