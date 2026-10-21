/** DOM regression suite. Run with JSDOM_MODULE when jsdom is not installed locally. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
let jsdom;
try { jsdom = await import(process.env.JSDOM_MODULE || 'jsdom'); }
catch (error) {
  const local = '/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js';
  if (!fs.existsSync(local)) throw error;
  jsdom = await import(pathToFileURL(local).href);
}
const html = fs.readFileSync('public/classroom/index.html', 'utf8');
for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) if (m[1].trim()) new vm.Script(m[1]);
const dom = new jsdom.JSDOM('<main id="view"></main>', {url: 'https://classroom.test/#exams', runScripts: 'outside-only'});
const {window:w} = dom, $ = selector => w.document.querySelector(selector);
const intervals = new Map(); let sequence = 0;
w.setInterval = fn => { const id = ++sequence; intervals.set(id, fn); return id; };
w.clearInterval = id => intervals.delete(id);
w.confirm = () => true;
w.alert = () => {};
w.fetch = async src => ({ok:true, text:async () => fs.readFileSync('public' + src, 'utf8')});
const extract = (from, to) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)));
const fixture = {id:'q1', d:1, ch:'fw', day:1, t:'1', src:'bank', q:{ar:'سؤال عربي فقط', en:'English question only'}, o:{ar:['خيار عربي أول','خيار عربي ثان'], en:['First English option','Second English option']}, c:[1], x:{ar:'تفسير عربي فقط', en:'English explanation only'}};
w.fixture = fixture;
w.eval(`
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => Array.from(root.querySelectorAll(selector));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const view = $('#view'), routes = {}, LET = 'ABCDE', DN = ['', 'الأول'], DOMC = ['', 'blue'];
const D = {q:[fixture], domains:[{n:1,w:100,t:{ar:'المجال العربي',en:'English domain'}}], chapters:[{k:'fw',t:{ar:'الفصل العربي',en:'English chapter'}}]};
const QBY = new Map([[fixture.id, fixture]]);
const S = {lang:'bi',prefs:{lang:'ar',name:'',tools:{tr:1,flag:1,strike:1,calc:1,wb:1,hl:1,check:1,ai:1},mode:'practice',proctor:'none'},cur:null,hist:[],qs:{}};
const ME = null, DAY_TARGET = 80, messages = [], reports = [], prompts = [];
const save = () => {}, toast = text => messages.push(text), go = hash => location.hash = hash;
const shuffle = values => values.slice().reverse(), qstat = () => ({byD:{}}), pct = (a,b) => Math.round(100*a/b);
const fmtTime = seconds => String(seconds), level = n => n >= 80 ? [4,'فوق المستهدف','Above Target'] : [1,'يحتاج تحسينًا','Needs Improvement'];
const printReport = text => reports.push(text), exportWord = (name,text) => reports.push(text);
const AIX = {ask:async (text, options) => { prompts.push(text); options.onText(''); }};
${extract('function examQuestion(', 'function applyContent(')}
${extract('const NOSHUF = ', '// ------------------------------------------------ proctoring')}
${extract('const PR = ', '// ------------------------------------------------ exam list')}
${extract('let tick = null;', '// ---------------------------------------------------------------- PROGRESS')}
window.test = {S,D,QBY,routes,examText,examQuestionAvailable,prepareExamFigures,translatedExamFigure,EXAM_FIGURE_AR,EXAM_FIGURE_CACHE,questionFigure,examViolationText,scoreSheet,messages,reports,prompts};
`);
const {S,D,QBY,routes} = w.test;
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await new Promise(r => setTimeout(r,0)); };
async function setup(spec, lang, mode='practice') {
  w.location.hash = '#setup-' + spec.replace(':','~');
  routes.setup(spec.replace(':','~'));
  assert.equal($('#goExam').disabled, true, `${spec} cannot start without a choice`);
  assert.equal(w.document.querySelectorAll('[data-lang2].on').length, 0);
  $(`[data-lang2="${lang}"]`).click();
  $(`[data-mode2="${mode}"]`).click();
  assert.equal($(`[data-lang2="${lang}"]`).getAttribute('aria-pressed'),'true');
}
async function start(spec,lang,mode) {
  S.cur = null; await setup(spec,lang,mode); assert.equal($('#goExam').disabled,false);
  await $('#goExam').onclick(); assert.equal(S.cur.lang,lang); assert.equal(w.location.hash,'#run');
  await routes.run();
}
try {
  for (const spec of ['ch:fw','dom:1','day:1','mini','custom']) {
    for (const lang of ['ar','en']) {
      await start(spec,lang);
      assert.equal($('#view').lang,lang); assert.equal($('#view').dir,lang==='en'?'ltr':'rtl');
      assert.equal($('#stem').textContent, fixture.q[lang]);
      assert.equal(w.document.querySelectorAll('.xm-tr').length,0);
      assert.equal($('#tTr'),null); assert.equal(S.cur.tools.tr,0);
      for(const option of w.document.querySelectorAll('.xo .txt')) assert(fixture.o[lang].includes(option.textContent));
      const other=lang==='en'?'ar':'en'; assert(!$('#view').textContent.includes(fixture.q[other]));
      $('[data-k="1"]').click(); $('#tFl').click(); $('#tChk').click();
      assert($('#view').textContent.includes(fixture.x[lang])); assert(!$('#view').textContent.includes(fixture.x[other]));
      S.lang=other; const used=S.cur.used=39, answer=JSON.stringify(S.cur.ans), order=JSON.stringify(S.cur.items);
      await routes.run(); assert.equal(S.cur.used,used); assert.equal(JSON.stringify(S.cur.ans),answer); assert.equal(JSON.stringify(S.cur.items),order); assert.equal($('#stem').textContent,fixture.q[lang]);
      $('#endX').click(); assert($('#view').textContent.includes(lang==='en'?'Review screen':'شاشة المراجعة'));
      $('#rvBack').click(); assert.equal($('#stem').textContent,fixture.q[lang]);
      $('#endX').click(); $('#rvEnd').click(); const h=S.hist.at(-1); assert.equal(h.lang,lang); assert.equal(h.pct,100); assert.equal(h.dur,39);
      routes.result(String(h.id)); assert.equal($('#view').lang,lang); assert($('#view').textContent.includes(fixture.x[lang])); assert(!$('#view').textContent.includes(fixture.x[other]));
      assert.equal(w.document.querySelectorAll('.ar-line,.en-line').length,0);
      $('#examPdf').click(); assert(w.test.reports.at(-1).includes(`lang="${lang}"`));
      // Retry must not inherit the prior attempt's choice.
      await setup(spec,lang); assert(S.hist.includes(h));
    }
  }
  // Empty selected-language option blocks the attempt, without substituting or reducing it.
  fixture.o.en[1]=''; S.cur=null; await setup('ch:fw','en'); assert.equal($('#goExam').disabled,true); await $('#goExam').onclick(); assert.equal(S.cur,null); fixture.o.en[1]='Second English option';
  // Missing explanations are explicit, but do not block valid questions.
  delete fixture.x.ar; await start('ch:fw','ar'); $('[data-k="1"]').click(); $('#tChk').click(); assert($('#view').textContent.includes('الترجمة غير متاحة')); assert(!$('#view').textContent.includes(fixture.x.en)); fixture.x.ar='تفسير عربي فقط';
  // Saved attempts without a language require one, without resetting answers or time.
  delete S.cur.lang; S.cur.used=67; const saved=JSON.stringify(S.cur.ans); await routes.run(); assert($('#view').textContent.includes('Choose the saved attempt language')); $('[data-resume-lang="en"]').click(); await settle(); assert.equal(S.cur.lang,'en'); assert.equal(S.cur.used,67); assert.equal(JSON.stringify(S.cur.ans),saved);
  // Cancelling replacement leaves the prior attempt untouched.
  const prior=S.cur; await setup('dom:1','ar'); w.confirm=()=>false; await $('#goExam').onclick(); assert.equal(S.cur,prior); w.confirm=()=>true;
  // Full exam preserves all 115 questions, break locking, time and automatic submission.
  D.q=Array.from({length:115},(_,i)=>({...fixture,id:'RMPSIM22-'+String(i+1).padStart(3,'0'),src:'advanced2026',revision:'eco2022-simulation-v2'}));
  for(const q of D.q) QBY.set(q.id,q);
  await start('full','en','exam'); assert.equal(S.cur.items.length,115); assert.equal(S.cur.dur,9000);
  S.cur.i=57; await routes.run(); $('#next').click(); assert($('#view').textContent.includes('Take a break?')); const time=S.cur.used; $('#takeBreak').click(); assert.equal(S.cur.paused,true); assert.equal(S.cur.brk,true); for(const fn of [...intervals.values()]) fn(); assert.equal(S.cur.used,time); $('#resumeExam').click(); assert.equal(S.cur.paused,false); assert.equal(S.cur.i,58); assert.equal($('#prev').disabled,true);
  S.cur.used=S.cur.dur-1; for(const fn of [...intervals.values()]) fn(); assert.equal(S.cur,null); assert.equal(S.hist.at(-1).n,115); assert(w.test.messages.includes('Time expired. The exam was submitted automatically.'));
  // Both current full mocks keep their full counts in each language.
  for(const type of ['full','advanced']) for(const lang of ['ar','en']) { await start(type,lang,'exam'); assert.equal(S.cur.items.length,115); }
  D.q=D.q.slice(0,114); S.cur=null; await setup('full','en','exam'); assert.equal($('#goExam').disabled,true); await $('#goExam').onclick(); assert.equal(S.cur,null);
  // Generated SVGs contain translated labels, never silently substitute English.
  const real = JSON.parse(fs.readFileSync('data/rmp-private-advanced-115.json','utf8'));
  await w.test.prepareExamFigures(real,'ar');
  for(const q of real.filter(q=>q.figure)) {
    const src=await w.test.translatedExamFigure(q.figure.src), svg=decodeURIComponent(src.split(',').slice(1).join(','));
    const doc=new w.DOMParser().parseFromString(svg,'image/svg+xml');
    const texts=[...doc.querySelectorAll('text')].map(n=>n.textContent);
    assert(texts.some(t=>/[\u0600-\u06ff]/.test(t)));
    assert(!texts.some(t=>Object.keys(w.test.EXAM_FIGURE_AR).includes(t)&&!/^(A|B)$/.test(t)));
    assert(w.test.questionFigure(q,'ar').includes('data:image/svg+xml'));
  }
  // A new/unmapped chart label fails before creating an attempt.
  w.test.EXAM_FIGURE_CACHE.clear(); const realFetch=w.fetch; w.fetch=async()=>({ok:true,text:async()=>'<svg xmlns="http://www.w3.org/2000/svg"><text>New unreviewed label</text></svg>'});
  D.q=real; S.cur=null; await setup('full','ar','exam'); await $('#goExam').onclick(); assert.equal(S.cur,null); assert(w.test.messages.at(-1).includes('لم تبدأ المحاولة')); w.fetch=realFetch;
  // Audit the actual embedded plus authored advanced bank without mutating it.
  const ctx={window:{}}; vm.createContext(ctx); vm.runInContext('window.RMP_DATA=' + html.match(/<script>window\.RMP_DATA=([\s\S]*?)<\/script>/)[1],ctx);
  const all = ctx.window.RMP_DATA.q.concat(real);
  assert.equal(all.filter(q=>!w.test.examQuestionAvailable(q,'ar')).length,0);
  assert.equal(all.filter(q=>!w.test.examQuestionAvailable(q,'en')).length,0);
  assert.equal(JSON.stringify(all.filter(q=>!w.test.examText(q.x,'ar',false)).map(q=>q.id)),JSON.stringify(['s32']));
  assert.equal(all.filter(q=>!w.test.examText(q.x,'en',false)).length,0);
  console.log('PASS classroom language: explicit selection, chapter/domain/day/custom/full, strict content/UI/review/reports, missing translations, resume/retry/cancel, timer/break/scoring, 15 Arabic charts and unknown-label gate.');
} finally { w.close(); }

// Exercise the real page initializer and hash router, not only extracted functions.
const integrated = new jsdom.JSDOM(html, {url:'https://classroom.test/#setup-ch~fw',runScripts:'outside-only'});
const iw=integrated.window, integrationErrors=[];
iw.addEventListener('error',e=>integrationErrors.push(e.message));
iw.matchMedia=()=>({matches:false}); iw.scrollTo=()=>{}; iw.confirm=()=>true; iw.alert=()=>{};
iw.fetch=async src=>({ok:true,text:async()=>fs.readFileSync('public'+src,'utf8')});
try {
  for(const script of [...iw.document.scripts]) if(!script.src) {
    // The page uses its existing offline path; authenticated API QA is separate.
    if(script.textContent.includes('const D = window.RMP_DATA')) iw.EYAD_SERVER=false;
    iw.eval(script.textContent);
  }
  const query=selector=>iw.document.querySelector(selector);
  assert.equal(query('#goExam').disabled,true); query('[data-lang2="en"]').click();
  await query('#goExam').onclick(); await new Promise(r=>setTimeout(r,40));
  assert(query('#stem')); assert.equal(query('#view').lang,'en'); assert.equal(integrationErrors.length,0);
  query('#endX').click(); query('#rvEnd').click(); await new Promise(r=>setTimeout(r,50));
  assert(query('.report')); assert.equal(query('#view').lang,'en'); assert.equal(integrationErrors.length,0);
  console.log('PASS complete classroom page boot (offline fixture), direct chapter setup, hash routing, exam submission and result.');
} finally { iw.close(); }
