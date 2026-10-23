/** Presentation-only regression: real markup, no production accounts or network. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {JSDOM}=await import(process.env.JSDOM_MODULE||'/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js');
const index=fs.readFileSync('public/index.html','utf8'),start=index.indexOf('function lessonMenuMarkup('),end=index.indexOf('\nfunction playLesson(',start);
assert(start>0&&end>start);
const dom=new JSDOM('<main></main>',{runScripts:'outside-only',url:'https://local.test/'}),w=dom.window;
let english=false;w.siteEnglish=()=>english;w.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));w.eval(index.slice(start,end));
const lesson={i:9,t:'Lesson',vimeo:'100000',dur:'12:30',notes:'ملخص أصلي <script>bad()</script>',notes_en:'Original summary',files:[{id:'file-a',name:'One.pdf'},{id:'file-b',name:'Two.pdf'}]};
for(english of [false,true]){
 w.document.querySelector('main').innerHTML=w.lessonMenuMarkup(lesson,'pmp-full',true);
 const menu=w.document.querySelector('.lesson-action-menu');assert.equal(menu.children.length,3);
 assert.equal(menu.querySelector('[data-lesson]').dataset.lesson,'9');assert.equal(menu.querySelectorAll('[data-lesson-file]').length,2);
 assert.deepEqual([...menu.querySelectorAll('[data-lesson-file]')].map(e=>e.dataset.lessonFile),['file-a','file-b']);
 assert.equal(menu.querySelector('script'),null);assert.match(menu.textContent,english?/Read summary/:/قراءة الملخص/);
 const summary=menu.querySelector('.lesson-summary');assert(!summary.open);summary.querySelector('summary').click();assert(summary.open);
 w.document.querySelector('main').innerHTML=w.lessonMenuMarkup(lesson,'pmp-full',false);
 assert.equal(w.document.querySelectorAll('button:disabled').length,3);assert.equal(w.document.querySelectorAll('[data-lesson-file],[data-lesson],.lesson-summary').length,0);
 assert(!w.document.querySelector('main').textContent.includes(lesson.notes_en));
 w.document.querySelector('main').innerHTML=w.lessonMenuMarkup({i:2},'pmp-full',true);
 assert.equal(w.document.querySelectorAll('button:disabled').length,3);
}
for(const path of ['public/unified-exam.js','public/pmp-exam-2026.html','rmp-exam.html','pba-exam.html','grcp-exam.html']){
 const text=fs.readFileSync(path,'utf8');assert(text.includes('/img/logo.png'),path);assert(!text.includes('/assets/al-ltc-logo.svg'),path);assert(!text.includes('https://alsaeed-etc.com/main/images/logo/logo3.png'),path);
 if(path.endsWith('.html'))assert(text.includes('/learning-polish.css?v=20261023-1'));
}
assert(fs.existsSync('public/img/logo.png'));
assert.match(fs.readFileSync('public/exam-ai-v19.js','utf8'),/img:not\(\.official-learning-logo\)/,'Observer must only decorate each image once');
for(const script of [...new JSDOM(index).window.document.scripts])if(!script.src&&script.textContent.trim())new Function(script.textContent);
dom.window.close();console.log('PASS: official local logos, all three lesson actions, AR/EN labels, multiple protected attachment targets, native disclosure, escaped notes, locked/missing resources and inline JS syntax');
