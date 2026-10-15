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
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.APP&&window.PACKAGES?.length);
  await page.evaluate(()=>{
    APP.DB.users.push({id:'outline-local',name:'Local outline fixture',role:'student',packages:[{id:'pmp-full'},{id:'pmp-sim'}]});
    APP.DB.session='outline-local';
    APP.DB.progress['outline-local']={'pmp-full':{lessons:{0:true,2:true},exams:{chapter_scope:{score:80}},weeks:{1:true},activities:{0:true},games:{}}};
    const c=APP.course('pmp');c.chapters=['Introduction','Planning','Executing','Shared chapter'];
    LESSONS['pmp-full']=[
      {ch:0,t:'مقدمة',t_en:'Introduction',vimeo:'100000',free:true},
      {ch:1,t:'مرحلة التخطيط: النطاق',t_en:'Planning phase: scope',vimeo:'101000',notes:'Original lesson note'},
      {ch:2,t:'مرحلة التنفيذ: الموارد',t_en:'Executing phase: resources',vimeo:'102000'},
      {ch:3,t:'النهج الرشيق',t_en:'Agile Approach',vimeo:'103000'},
      {ch:3,t:'النهج المختلط',t_en:'Hybrid Approach',vimeo:'104000'},
      {ch:3,t:'إرشادات وتعليمات الاختبار الحقيقي',t_en:'Actual Exam Guidelines and Instructions',vimeo:'105000'},
      {ch:3,t:'إدارة المخاطر',t_en:'Risk management',vimeo:'106000'},
      {ch:3,t:'درس غير مصنف',t_en:'Unmapped lesson',vimeo:'107000'}
    ];
    window.outlineBefore=JSON.stringify({lessons:LESSONS['pmp-full'],progress:APP.DB.progress['outline-local']['pmp-full']});
  });
  for(const lang of ['ar','en']){
    await page.evaluate(lang=>{window.__lang=lang;I18.set(lang);document.documentElement.dir=lang==='ar'?'rtl':'ltr';localStorage.setItem('learning-language:pmp-full',lang);APP.go('learn/pmp-full')},lang);
    await page.locator('[data-lt="content"]').first().click();
    await page.waitForSelector('.learning-outline');
    assert.equal(await page.locator('[data-lesson-index]').count(),8);
    assert.deepEqual(await page.locator('.learning-outline > details[data-learning-group]').evaluateAll(els=>els.map(e=>e.dataset.learningGroup)),['intro','exam','framework','value','principles','lifecycles','agile','predictive','hybrid','people','process','business','journey','ai','final-reviews','workshops','exam-eve','exam-guidelines']);
    const predictive=page.locator('.learning-outline > [data-learning-group="predictive"]');
    await predictive.locator(':scope > summary').click();
    const planning=predictive.locator(':scope > .learning-outline-children > [data-learning-group="planning"]');
    await planning.locator(':scope > summary').click();
    assert.equal(await planning.locator('[data-learning-group]').count(),0,'No artificial phase subtopics');
    await planning.locator('[data-lesson="1"]').click();
    assert.match(await page.locator('#ivFrame').getAttribute('src'),/player.vimeo.com\/video\/101000/);
    await page.locator('#ivClose').click();
    assert.equal(await page.locator('#ivFrame').count(),0);
    assert.equal(await page.evaluate(()=>JSON.stringify({lessons:LESSONS['pmp-full'],progress:APP.DB.progress['outline-local']['pmp-full']})),await page.evaluate(()=>outlineBefore));
    // Summary navigation supports close/reopen without changing route or progress.
    await predictive.locator(':scope > summary').click();
    await predictive.locator(':scope > summary').click();
    for(const width of [1440,390,320]){
      await page.setViewportSize({width,height:1000});
      await predictive.scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow at '+width+' '+lang);
      if(process.env.OUTLINE_SCREENSHOT_DIR){await mkdir(process.env.OUTLINE_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:join(process.env.OUTLINE_SCREENSHOT_DIR,'learner-outline-'+lang+'-'+width+'.png')});}
    }
    await page.locator('[data-lt="plan"]').first().click();
    assert.equal(await page.locator('[data-plan-topic]').count(),18);
    assert.equal(await page.locator('.wk.done [data-week="1"]').count(),1);
  }
  await page.evaluate(()=>{APP.pack('pmp-sim').kinds=['exam','quiz'];APP.go('learn/pmp-sim')});
  await page.locator('[data-lt="plan"]').first().click();
  assert.equal(await page.locator('.learner-course-outline [data-lt="content"]').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: real learner SPA in AR/EN; exact video index playback and close/reopen, unchanged progress, 18 topics, 5 nested phases; plan IDs preserved; quiz-only navigation gated; 1440/390/320px without overflow.');
  await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
