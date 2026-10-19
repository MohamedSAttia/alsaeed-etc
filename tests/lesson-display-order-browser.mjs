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
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.APP&&window.PACKAGES?.length);
 await page.evaluate(()=>{
  APP.DB.users.push({id:'order-local',name:'Order fixture',role:'admin',packages:[{id:'pmp-full'}]});APP.DB.session='order-local';
  APP.DB.progress['order-local']={'pmp-full':{lessons:{1:true},exams:{lesson1:{score:90}},weeks:{1:true},activities:{},games:{}}};
  APP.course('pmp').chapters=[{ar:'مقدمة',en:'Introduction',outlineKey:'intro'},{ar:'مرحلة المتابعة والتحكم',en:'Monitoring & Controlling',outlineKey:'monitoring'},{ar:'مرحلة الإغلاق',en:'Closing',outlineKey:'closing'}];
  LESSONS['pmp-full']=[{ch:0,t:'مقدمة',t_en:'Introduction',vimeo:'100000'},{ch:1,t:'التحقق من النطاق',t_en:'Validate Scope',vimeo:'100001',notes:'Original notes',files:[{id:'fixture-file',name:'Original guide.pdf'}],quiz:[{q:'Original question'}]},{ch:1,t:'التحكم بالجودة',t_en:'Quality Control',vimeo:'100002'},{ch:1,t:'شرح محفوظ',t_en:'Saved reading'},{ch:2,t:'إغلاق المشروع',t_en:'Closing',vimeo:'100004'}];
  window.orderBefore=JSON.stringify({lessons:LESSONS['pmp-full'],progress:APP.prog('pmp-full')});
  window.Vimeo={Player:class{getDuration(){return Promise.resolve(60);}on(){}destroy(){return Promise.resolve();}}};
  APP.go('admin/content/pmp-full');
 });
 const adminOrder=()=>page.locator('[data-admin-chapter="monitoring"] [data-lt]').evaluateAll(elements=>elements.map(el=>Number(el.dataset.lt)));
 assert.deepEqual(await adminOrder(),[1,2,3]);await page.locator('[data-lup="2"]').click();assert.deepEqual(await adminOrder(),[2,1,3]);
 assert.equal(await page.locator('[data-lup="2"]').isDisabled(),true);
 await page.locator('[data-ldown="2"]').click();assert.deepEqual(await adminOrder(),[1,2,3]);await page.locator('[data-lup="2"]').click();assert.deepEqual(await adminOrder(),[2,1,3]);
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('alsaeed_lessons'))['pmp-full'].map(l=>l.t)),['مقدمة','التحقق من النطاق','التحكم بالجودة','شرح محفوظ','إغلاق المشروع']);
 assert.equal(await page.evaluate(()=>JSON.stringify(LESSONS['pmp-full'].map(({displayOrder,displayOrderBase,clearVimeo,...l})=>l))),await page.evaluate(()=>JSON.stringify(JSON.parse(orderBefore).lessons.map(l=>({...l,t_en:l.t_en||'',dur:l.dur||'',free:!!l.free})))));
 if(process.env.ORDER_SCREENSHOT_DIR){await mkdir(process.env.ORDER_SCREENSHOT_DIR,{recursive:true});await page.locator('[data-admin-chapter="monitoring"]').screenshot({path:join(process.env.ORDER_SCREENSHOT_DIR,'admin-stable-order.png')});}
 for(const lang of ['ar','en']){
  await page.evaluate(lang=>{window.__lang=lang;I18.set(lang);localStorage.setItem('learning-language:pmp-full',lang);APP.go('learn/pmp-full')},lang);
  await page.locator('[data-lt="content"]').first().click();await page.waitForSelector('.learning-outline');
  assert.deepEqual(await page.locator('[data-lesson]').evaluateAll(elements=>elements.map(el=>Number(el.dataset.lesson))),[0,2,1,4]);
  await page.evaluate(()=>InteractiveVideo.open('pmp-full',2));await page.waitForSelector('#ivFrame');
  assert.deepEqual(await page.locator('#iv [data-go]').evaluateAll(elements=>elements.map(el=>Number(el.dataset.go))),[0,2,1,4]);
  await page.locator('#ivNext').click();assert.equal(await page.locator('.iv-li.cur').getAttribute('data-go'),'1');assert.match(await page.locator('#ivFrame').getAttribute('src'),/100001/);
  assert.equal(await page.locator('[data-iv-file="fixture-file"]').count(),1);assert.equal(await page.locator('#ivLessonQuiz').count(),1);
  await page.locator('#ivPrev').click();assert.equal(await page.locator('.iv-li.cur').getAttribute('data-go'),'2');
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow: '+width+' '+lang);if(process.env.ORDER_SCREENSHOT_DIR)await page.screenshot({path:join(process.env.ORDER_SCREENSHOT_DIR,'player-order-'+lang+'-'+width+'.png')});}
  await page.locator('#ivClose').click();assert.equal(await page.locator('#iv').count(),0);
 }
 assert.equal(await page.evaluate(()=>JSON.stringify(APP.prog('pmp-full'))),await page.evaluate(()=>JSON.stringify(JSON.parse(orderBefore).progress)));
 assert.deepEqual(errors,[]);console.log('PASS: Chromium admin arrows, stable original rows/local save, exact requested title order, AR/EN learner and sidebar parity, Previous/Next media, notes/files/quiz/progress, 1440/390/320px without overflow.');await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
