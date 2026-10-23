import assert from 'node:assert/strict';import fs from 'node:fs';const{JSDOM}=await import('/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js');
for(const lang of ['ar','en']){const dom=new JSDOM('<body></body>',{url:'https://report.test',runScripts:'outside-only'}),w=dom.window,d=w.document;let user='u',snapshot={packageId:'pmp',language:lang,definitions:{LIFE:[{k:'need',f:[{k:'problem',l:['المشكلة','Problem']}]}]},catalog:[{id:'life:need',title:['حاجة العمل','Business need']}],states:{'life:need':{inputs:{problem:'<img src=x onerror=alert(1)> saved'},completed:true,revision:3}},drafts:{'life:need':{problem:'UNSAVED'}}};w.APP={me:()=>({id:user}),token:'t'};w.PmpPracticeTools={reportSnapshot:()=>user==='u'?snapshot:null};let printed='',calls=0;w.open=()=>({document:{open(){},write(v){printed=v},close(){}},focus(){},print(){calls++}});w.eval(fs.readFileSync('public/pmp-practice-report.js','utf8'));w.PmpPracticeReport.open('pmp');assert(d.querySelector('[role=dialog]'));assert(!d.querySelector('img'));assert(d.body.textContent.includes('saved'));assert(!d.body.textContent.includes('UNSAVED'));assert(!d.body.innerHTML.includes('onerror="'));d.querySelector('[data-report-print]').click();assert.equal(calls,1);assert(printed.includes('&lt;img'));assert(printed.includes('lang="'+lang+'"'));assert(!printed.includes('<script'));user='other';d.querySelector('[data-report-print]').click();assert.equal(calls,1);assert(!d.querySelector('[role=dialog]'));user='u';snapshot.states={};w.PmpPracticeReport.open('pmp');assert(d.body.textContent.includes(lang==='ar'?'لا توجد أعمال':'No saved practice'));d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));assert(!d.querySelector('[role=dialog]'));dom.window.close()}
console.log('PASS saved-only bilingual aggregate report, source fields, escaped drafts, no auto-print/network, owner isolation and empty/close flows');
{
const dom=new JSDOM('<body><main><button id="opener">Report</button></main><aside inert="existing">Protected</aside></body>',{url:'https://report.test',runScripts:'outside-only'}),w=dom.window,d=w.document;
let available=true,user='u',exports=0;
w.APP={me:()=>({id:user}),token:'t'};
w.PmpPracticeTools={reportSnapshot:()=>available?{packageId:'pmp',language:'en',catalog:[],states:{}}:null};
w.open=()=>{exports++;return null};w.URL.createObjectURL=()=>{exports++;return 'blob:test'};
w.eval(fs.readFileSync('public/pmp-practice-report.js','utf8'));
const opener=d.querySelector('#opener'),main=d.querySelector('main'),aside=d.querySelector('aside');opener.focus();
w.PmpPracticeReport.open('pmp');const old=d.querySelector('[role=dialog]');
assert(main.hasAttribute('inert'));assert.equal(aside.getAttribute('inert'),'existing');
const key=(k,shift=false)=>d.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,shiftKey:shift,bubbles:true,cancelable:true}));
const first=old.querySelector('[data-report-close]'),last=old.querySelector('[data-report-html]');
assert.equal(d.activeElement,first);key('Tab',true);assert.equal(d.activeElement,last);key('Tab');assert.equal(d.activeElement,first);
// Newly mounted background siblings are isolated too.
const late=d.createElement('section');d.body.append(late);await new Promise(r=>w.setTimeout(r,0));assert(late.hasAttribute('inert'));
w.PmpPracticeReport.open('pmp');const current=d.querySelector('[role=dialog]');assert.notEqual(old,current);
old.querySelector('[data-report-close]').click();old.click();old.querySelector('[data-report-print]').click();old.querySelector('[data-report-html]').click();
assert.equal(d.querySelector('[role=dialog]'),current);assert.equal(exports,0);
key('Escape');assert(!d.querySelector('[role=dialog]'));assert.equal(d.activeElement,opener);assert(!main.hasAttribute('inert'));assert(!late.hasAttribute('inert'));assert.equal(aside.getAttribute('inert'),'existing');
// Route expiry restores background state; account expiry never refocuses an old account control.
w.PmpPracticeReport.open('pmp');available=false;d.body.append(d.createElement('i'));await new Promise(r=>w.setTimeout(r,0));assert(!d.querySelector('[role=dialog]'));assert(!main.hasAttribute('inert'));
available=true;opener.focus();w.PmpPracticeReport.open('pmp');user='other';d.body.append(d.createElement('i'));await new Promise(r=>w.setTimeout(r,0));assert(!d.querySelector('[role=dialog]'));assert.notEqual(d.activeElement,opener);assert(!main.hasAttribute('inert'));assert.equal(aside.getAttribute('inert'),'existing');
user='u';w.PmpPracticeReport.open('pmp');w.dispatchEvent(new w.Event('pagehide'));assert(!d.querySelector('[role=dialog]'));assert(!main.hasAttribute('inert'));
dom.window.close();
}
console.log('PASS modal inert preservation, late background isolation, Tab/ShiftTab/Escape, opener restoration, stale handlers and route/account/page cleanup');
