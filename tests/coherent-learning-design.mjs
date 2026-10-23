import assert from 'node:assert/strict';
import fs from 'node:fs';
let css;try{css=await import('css-tree')}catch(error){const shared='/workspace/shared/alsaeed-test-tools/node_modules/css-tree/lib/index.js';if(!fs.existsSync(shared))throw error;css=await import(shared)}
import {JSDOM} from 'jsdom';
const files=['learning-design','auth-entry','visual-learning-home','exam-reference','practice-hub'];
for(const name of files){
 const source=fs.readFileSync(`public/${name}.css`,'utf8');
 const ast=css.parse(source,{positions:true});
 css.walk(ast,n=>{if(n.type==='Declaration'&&!n.property.startsWith('--')){
  const value=css.generate(n.value);
  // Browser-independent syntax validation. Custom properties are resolved by the browser.
  if(!value.includes('var(')&&!value.includes('env(')) {const result=css.lexer.matchProperty(n.property,n.value);assert(!result.error,`${name}: ${n.property}: ${value}: ${result.error?.message}`);}
 }});
 assert(!/var\([^)]*\)[0-9a-f]+/.test(source),'no corrupt alpha colors');
}
const auth=fs.readFileSync('public/auth-entry.css','utf8');
const ast=css.parse(auth);
const blocks=[];css.walk(ast,n=>{if(n.type==='Atrule'&&n.name==='media')blocks.push([css.generate(n.prelude),css.generate(n.block)]);});
const phone=blocks.find(([q])=>q==='(max-width:760px)')[1];
assert.match(phone,/\.auth-visual\{display:none\}/);
assert.match(phone,/overflow-y:auto/);assert.match(phone,/safe-area-inset-bottom/);
assert.equal((auth.match(/@media\(max-width:760px\)/g)||[]).length,1,'mobile layout has one owner, not competing overrides');
assert.match(auth,/\.auth-close\{[^}]*width:44px;height:44px/);
assert.match(auth,/#authForm input\{[^}]*font-size:16px/);
assert.match(auth,/prefers-reduced-motion/);assert.match(auth,/focus-visible/);
assert.match(auth,/\.auth-visual button:focus-visible\{outline-color:#fff;outline-offset:-4px\}/);
const exam=fs.readFileSync('public/exam-reference.css','utf8');
assert.match(exam,/\.ux-question-list>header button:focus-visible,\.ux-question-list>nav button\[aria-pressed=true\]:focus-visible\{outline-color:#fff;outline-offset:-4px\}/);
assert.match(exam,/#ux \.ux-head button:focus-visible,#ux \.ux-dock-navigation \.ux-primary:focus-visible\{outline-color:#fff;outline-offset:-4px\}/);
const home=fs.readFileSync('public/visual-learning-home.css','utf8');
assert.match(home,/\.package-shell \.learning-course-cover\{order:2;/);
assert.match(home,/\.package-shell \.learning-course-copy\{order:1;/);
assert.match(home,/\.package-shell \.learning-start\{background:var\(--al-action\);color:#fff/);
assert(!home.includes('.assessment-jump-nav .btn:nth-child('),'assessment categories use one neutral visual grammar');
function luminance(hex){return hex.match(/\w\w/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0)}
function contrast(a,b){const v=[luminance(a),luminance(b)].sort((a,b)=>b-a);return(v[0]+.05)/(v[1]+.05)}
for(const [a,b] of [['B84900','FFFFFF'],['933C00','FFFFFF'],['0E2444','FFFFFF'],['5B6B85','FFFFFF'],['5B6B85','F8F9FC']])assert(contrast(a,b)>=4.5,`${a}/${b} requires 4.5:1`);
const dom=new JSDOM('<body></body>',{runScripts:'outside-only'}),w=dom.window;
w.MutationObserver=class{observe(){}};w.eval(fs.readFileSync('public/visual-learning-home.js','utf8'));
for(const lang of ['ar','en']){
 w.__lang=lang;w.document.body.innerHTML=w.VisualLearningHome.home({id:'p',ar:'باقة',en:'Course'},{id:'pmp'}, {lessons:{}},[{t:'<script>درس</script>',t_en:'Next <lesson>',vimeo:'1',ch:0}],{});
 assert.equal(w.document.querySelector('.learning-course-copy h2').textContent,lang==='ar'?'<script>درس</script>':'Next <lesson>');
 assert.equal(w.document.querySelectorAll('script,lesson').length,0);
 assert.equal(w.document.querySelector('.learning-start').dataset.lesson,'0');
 assert.equal(w.document.querySelectorAll('.learning-choice').length,4);
 assert(w.document.querySelector('[data-course-review]'));assert(w.document.querySelector('[data-feedback-package]'));
}
dom.window.close();
console.log('PASS: CSS syntax, single mobile-auth owner, reachable scroll/safe area source contracts, 44px controls, 16px inputs, mobile continuation order, uniform assessment categories, action/text contrast, escaped real next lesson, four destinations and useful review/help controls. NOT a browser pixel/layout/accessibility certification.');
