/** Local DOM contract: native semantics, nested numbering/counts, escaping, scope and read-only rendering. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const {JSDOM}=await import(process.env.JSDOM_MODULE||'jsdom');
const html=fs.readFileSync('public/index.html','utf8');
const dom=new JSDOM('<main></main>',{runScripts:'outside-only'}),w=dom.window;
w.siteEnglish=()=>w.lang==='en';w.esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const start=html.indexOf('function publicTopicBody('),end=html.indexOf('\nfunction ',start+1);
vm.runInContext(html.slice(start,end),dom.getInternalVMContext());
vm.runInContext(fs.readFileSync('public/course-roadmap.js','utf8'),dom.getInternalVMContext());
const course={id:'pmp',chapters:[{outlineKey:'people',outlineParent:'predictive',outlineOrder:0,ar:'الأفراد',en:'People'},{outlineKey:'exam',outlineParent:'people',ar:'<img onerror=x>',en:'<img onerror=x>'}]};
const before=JSON.stringify(course),topics=w.CourseRoadmap.topics(course),host=w.document.querySelector('main');
let count=0;
function verify(nodes,container,path=[]){
 Array.from(nodes).forEach((node,i)=>{
  const p=[...path,i+1],item=container.children[i];
  assert.equal(item.dataset.publicTopic,node.key);
  const disclosure=item.querySelector(':scope > details');
  assert.equal(!!disclosure,!!node.children?.length);
  if(path.length)assert.equal(item.querySelector('.public-topic-path').textContent,p.join('.'));
  if(disclosure){
   assert.equal(disclosure.firstElementChild.tagName,'SUMMARY');assert.equal(disclosure.open,false);
   assert.equal(disclosure.querySelector(':scope > summary > .public-topic-count').textContent,w.lang==='en'?`${node.children.length} subtopics`:`${node.children.length} محاور فرعية`);
   assert.equal(disclosure.querySelectorAll('summary[role],summary[tabindex],summary[aria-expanded]').length,0,'Native semantics are not overridden');
   for(let n=0;n<4;n++){disclosure.open=true;assert.ok(disclosure.open);disclosure.open=false;assert.ok(!disclosure.open);}
   verify(node.children,disclosure.querySelector(':scope > ol'),p);
  }count++;
 });
}
for(const lang of ['ar','en']){
 w.lang=lang;
 for(let repeat=0;repeat<3;repeat++){
  host.innerHTML=`<ol>${topics.map((t,i)=>`<li data-public-topic="${t.key}">${w.publicTopicBody(t,[i+1])}</li>`).join('')}</ol>`;
  verify(topics,host.firstElementChild);
  assert.equal(host.querySelector('img'),null);
 }
 host.innerHTML=w.publicTopicBody(topics.find(t=>t.children?.length));
 assert.equal(host.querySelector('details'),null,'Learner/default renderer stays unchanged');
 assert.equal(host.querySelector('.public-topic-path'),null);
}
w.lang='en';host.innerHTML=w.publicTopicBody('عنوان عربي',[1]);
assert.equal(host.querySelector('.public-topic-label').lang,'ar');
assert.equal(host.querySelector('.public-topic-label').dir,'rtl');
assert.equal(JSON.stringify(course),before);
assert.match(html,/publicTopicBody\(ch,c.id==='pmp'\?\[i\+1\]:undefined\)/);
assert.match(html,/publicTopicBody\(ch,p.course==='pmp'&&p.type==='full'\?\[n\+1\]:undefined\)/);
assert.match(html,/publicTopicBody\(t\)/,'Learner call does not opt in');
assert.match(html,/@media\(max-width:560px\).*public-topic-disclosure/);
console.log(`PASS: ${count} node checks in AR/EN, saved reparented hierarchy, native semantics, repeated DOM toggles, rerender reset, paths/counts and escaping. DOM checks do not simulate native keyboard or layout.`);
w.close();
