import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
let jsdom;
try { jsdom=await import(process.env.JSDOM_MODULE || 'jsdom'); }
catch { jsdom=await import('/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js'); }
const {JSDOM}=jsdom;
const source=await readFile('public/course-reviews.js','utf8');
for(const language of ['ar','en']){
  const dom=new JSDOM('<span data-course-rating="pmp"></span><span data-course-rating="other">untouched</span><main id="app"><div data-course-experience="pmp"></div><div class="cd-main"></div></main>',{runScripts:'outside-only',url:'https://example.test'}),w=dom.window,d=w.document;
  w.__lang=language;let review=null,pending=false,actor={id:'a'},lastBody;
  const response=()=>({count:review?.published?1:0,average:review?.published?review.rating:null,reviews:review?.published?[{...review,updated:Date.now()}]:[]});
  w.APP={me:()=>actor,openAuth:()=>{},api:async(path,opts={})=>{if(path.endsWith('/mine'))return{eligible:true,review};if(opts.method==='PUT'){assert.equal(pending,false);pending=true;lastBody=opts.body;await new Promise(r=>setTimeout(r,10));review={...lastBody,published:1};pending=false;return response();}if(opts.method==='DELETE'){review.published=0;return{ok:true};}return response();}};
  w.eval(source);w.dispatchEvent(new w.Event('DOMContentLoaded'));
  const settle=()=>new Promise(r=>setTimeout(r,35));await settle();
  assert.equal(d.querySelectorAll('#cd-reviews').length,1);assert.equal(d.querySelector('input[type=checkbox]').checked,false);
  let form=d.querySelector('form');form.querySelector('select').value='1';form.querySelector('input:not([type=checkbox])').value='<img src=x onerror=alert(1)>';form.querySelector('textarea').value='<script>alert(1)</script>';form.querySelector('input[type=checkbox]').checked=true;
  form.dispatchEvent(new w.Event('submit',{cancelable:true}));form.dispatchEvent(new w.Event('submit',{cancelable:true}));await settle();
  assert.match(d.querySelector('[data-course-rating="pmp"]').textContent,/1.0 \/ 5/);assert.equal(d.querySelector('[data-course-rating="other"]').textContent,'untouched');assert.equal(lastBody.rating,1);assert.equal(lastBody.publicConsent,true);assert.equal(d.querySelectorAll('.review-entry').length,1);assert.equal(d.querySelectorAll('.review-entry img,.review-entry script').length,0);assert.ok(d.querySelector('.review-entry').textContent.includes('<script>'));assert.equal(d.querySelector('select').value,'1');assert.equal(d.querySelector('input[type=checkbox]').checked,false);
  const unpublish=[...d.querySelectorAll('button')].find(b=>/Unpublish|إلغاء نشر/.test(b.textContent));unpublish.click();await settle();assert.equal(d.querySelectorAll('.review-entry').length,0);assert.match(d.querySelector('[data-course-rating="pmp"]').textContent,/No published ratings|لا توجد تقييمات/);
  // Re-render and Back/Forward-like route changes create only one fresh widget.
  d.querySelector('#app').innerHTML='<div data-course-experience="rmp"></div><div class="cd-main"></div>';await settle();assert.equal(d.querySelectorAll('#cd-reviews').length,1);
  d.querySelector('#app').innerHTML='<p>Another page</p>';await settle();assert.equal(d.querySelectorAll('#cd-reviews').length,0);
  d.querySelector('#app').innerHTML='<div data-course-experience="pmp"></div><div class="cd-main"></div>';await settle();assert.equal(d.querySelectorAll('#cd-reviews').length,1);
  dom.window.close();
}
console.log('Course reviews DOM passed (Arabic/English, safe text, submit, duplicate clicks, edit, withdraw, navigation).');
