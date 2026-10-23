import assert from 'node:assert/strict';
import fs from 'node:fs';
const {JSDOM} = await import('/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js');
const source = fs.readFileSync('public/exam-tools.js', 'utf8');
assert(!/\beval\s*\(|new\s+Function|localStorage|fetch\s*\(/.test(source));
function setup(lang = 'en') {
  const dom = new JSDOM('<body><main id="shell"><button id="open">Open</button></main><aside inert>Already inert</aside></body>', {runScripts:'outside-only'});
  const w = dom.window, d = w.document;
  const operations = [];
  const ctx = new Proxy({}, { get: (_, key) => (...args) => operations.push([key, ...args]), set: () => true });
  w.HTMLCanvasElement.prototype.getContext = () => ctx;
  w.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({left:0, top:0, width:640, height:320});
  let resize;
  w.ResizeObserver = class { constructor(callback) { resize = callback; } observe() {} disconnect() {} };
  w.eval(source);
  let valid = true, saves = 0;
  const data = {}, context = {lang, ownerId:'owner-a', attemptKey:'attempt-a', questionId:'question-1', data, isCurrent:() => valid, onChange: value => { assert.equal(value, data); saves++; }};
  const btn = name => Array.from(d.querySelectorAll('.exam-tools-dialog button')).find(b => b.textContent === name);
  function input(node, value) { node.value = value; node.dispatchEvent(new w.Event('input', {bubbles:true})); }
  function pointer(node, type, x, y, id = 1) { const e = new w.Event(type, {bubbles:true,cancelable:true}); Object.assign(e,{clientX:x,clientY:y,pointerId:id,button:0}); node.dispatchEvent(e); }
  return {dom,w,d,data,context,btn,input,pointer,operations,resize:()=>resize?.(),invalidate:()=>valid=false,saves:()=>saves};
}
for (const lang of ['en','ar']) {
  const t = setup(lang), {w,d,context,data} = t;
  d.querySelector('#open').focus();
  assert.equal(w.ExamTools.open('notes', context), true);
  assert(d.querySelector('#shell').hasAttribute('inert'));
  assert.equal(d.querySelector('[role=dialog]').dir, lang === 'ar' ? 'rtl':'ltr'); assert.equal(d.querySelector('[role=dialog]').getAttribute('data-exam-language'),lang);
  assert.equal(d.activeElement.tagName,'TEXTAREA');
  t.input(d.querySelector('textarea'),'Private Q1 <script>never execute</script>');
  assert.equal(data.notes['question-1'],'Private Q1 <script>never execute</script>');
  assert.equal(t.saves(),0, 'typing is debounced');
  const oldInput = d.querySelector('textarea'), oldClose = d.querySelector('.exam-tools-dialog button');
  w.ExamTools.close(); assert.equal(t.saves(),1, 'close flushes current notes');
  assert.equal(d.activeElement.id,'open'); assert(!d.querySelector('#shell').hasAttribute('inert')); assert(d.querySelector('aside').hasAttribute('inert'));
  context.questionId = 'question-2'; w.ExamTools.open('notes',context); assert.equal(d.querySelector('textarea').value,'');
  oldClose.click(); assert(d.querySelector('[role=dialog]'), 'stale close must not dismiss new portal');
  t.input(oldInput,'stale'); assert.notEqual(data.notes['question-1'],'stale');
  t.input(d.querySelector('textarea'),'Q2'); assert.equal(data.notes['question-2'],'Q2');
  const closeBtn=d.querySelector('.exam-tools-dialog button'); closeBtn.focus();
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true})); assert.equal(d.activeElement.tagName,'TEXTAREA');
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})); assert.equal(d.activeElement,closeBtn);
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})); assert(!d.querySelector('[role=dialog]'));
  w.ExamTools.open('notes',context); const note=d.querySelector('textarea'); t.invalidate(); const before=JSON.stringify(data), saves=t.saves(); t.input(note,'cross-owner leak'); assert.equal(JSON.stringify(data),before); assert.equal(t.saves(),saves); w.ExamTools.close();
  assert.equal(w.ExamTools.open('notes',context),false);
  t.dom.window.close();
}
{
  const t=setup(),{w,d,data,context}=t; w.ExamTools.open('calculator',context);
  function calc(expression) { t.input(d.querySelector('input'),expression); t.btn('Calculate').click(); return d.querySelector('output').textContent; }
  assert.equal(calc('2 + 3 * (4 - 1)'), '11');
  assert.equal(calc('-(2 + 3) * .5'), '-2.5');
  assert.equal(calc('200 * 10%'), '20');
  assert.equal(calc('0.1+0.2'), '0.3');
  assert.equal(calc('١٢ ÷ ٤'), '3');
  assert.equal(calc('1 / 0'), ''); assert.match(d.querySelector('[role=status]').textContent,/zero/);
  for (const expression of ['window.hacked=1','2**3','1;alert(1)','(2+3','2 3','Math.sqrt(4)']) { assert.equal(calc(expression),''); assert.match(d.querySelector('[role=status]').textContent,/valid/); }
  assert.equal(w.hacked, undefined);
  assert.equal(calc('3--2'),'5');
  t.btn('C').click(); t.btn('2').click(); t.btn('+').click(); t.btn('3').click(); t.btn('Calculate').click(); assert.equal(d.querySelector('output').textContent,'5');
  t.btn('⌫').click(); assert.equal(data.calculator.expression,'2+'); t.btn('4').click(); d.querySelector('input').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})); assert.equal(d.querySelector('output').textContent,'6');
  const before=JSON.stringify(data); context.ownerId='owner-b'; t.input(d.querySelector('input'),'123'); assert.equal(JSON.stringify(data),before);
  t.dom.window.close();
}
{
  const t=setup(),{w,d,data,context}=t; w.ExamTools.open('whiteboard',context);
  const canvas=d.querySelector('canvas');
  t.pointer(canvas,'pointerdown',64,32); t.pointer(canvas,'pointermove',320,160); t.pointer(canvas,'pointermove',400,200,2); assert.equal(t.saves(),0, 'pointer motion never serializes the attempt'); t.pointer(canvas,'pointerup',320,160); assert.equal(t.saves(),1, 'completed stroke saves once');
  assert.equal(data.strokes.length,1); assert.deepEqual(JSON.parse(JSON.stringify(data.strokes[0].points)),[[.1,.1],[.5,.5]]);
  d.querySelector('#exam-tools-color').value='#dc2626';d.querySelector('#exam-tools-color').dispatchEvent(new w.Event('change'));
  d.querySelector('#exam-tools-width').value='8';d.querySelector('#exam-tools-width').dispatchEvent(new w.Event('change'));
  t.pointer(canvas,'pointerdown',1,1);t.pointer(canvas,'pointerup',1,1); assert.equal(data.strokes[1].color,'#dc2626'); assert.equal(data.strokes[1].width,8);
  t.btn('Eraser').click();t.pointer(canvas,'pointerdown',5,5);t.pointer(canvas,'pointerup',5,5);assert.equal(data.strokes[2].erase,true);
  t.btn('Undo stroke').click();assert.equal(data.strokes.length,2);
  const before=JSON.stringify(data);t.resize();assert.equal(JSON.stringify(data),before);assert(t.operations.some(([name])=>name==='stroke'));
  w.ExamTools.close();w.ExamTools.open('whiteboard',context);assert.equal(data.strokes.length,2);t.btn('Clear board').click();assert.equal(data.strokes.length,0);
  const newCanvas=d.querySelector('canvas'); t.pointer(newCanvas,'pointerdown',1,1); for(let i=0;i<1300;i++) t.pointer(newCanvas,'pointermove',i%640,i%320);t.pointer(newCanvas,'pointerup',1,1);assert.equal(data.strokes[0].points.length,1200);assert.match(d.querySelector('[role=status]').textContent,/limit/);
  const stale=JSON.stringify(data), saves=t.saves();t.invalidate(); t.pointer(newCanvas,'pointerdown',1,1);t.resize();assert.equal(JSON.stringify(data),stale);assert.equal(t.saves(),saves);
  t.dom.window.close();
}
{
  const t=setup(); t.context.data.strokes=[{color:'red',width:900,points:[[.1,.2],[Infinity,0],[-1,0]]}];t.context.data.notes={'q':'x'.repeat(9000)}; t.w.ExamTools.open('notes',t.context);assert.equal(t.data.notes.q.length,8000);assert.equal(t.data.strokes[0].points.length,1);assert.equal(t.data.strokes[0].width,4);t.dom.window.close();
}
{
  const t=setup();t.w.ExamTools.open('notes',t.context);const note=t.d.querySelector('textarea');t.input(note,'a');t.input(note,'b');t.input(note,'c');assert.equal(t.saves(),0);await new Promise(resolve=>setTimeout(resolve,300));assert.equal(t.saves(),1,'notes save once per typing burst');
  t.input(note,'pending stale');t.invalidate();await new Promise(resolve=>setTimeout(resolve,300));assert.equal(t.saves(),1,'stale timer never saves');t.w.ExamTools.close();assert.equal(t.saves(),1,'stale close never flushes');t.dom.window.close();
}
{
  const t=setup();t.w.ExamTools.open('whiteboard',t.context);t.pointer(t.d.querySelector('canvas'),'pointerdown',4,4);assert.equal(t.saves(),0);t.w.ExamTools.close();assert.equal(t.saves(),1,'close flushes an unfinished current stroke');t.dom.window.close();
}
console.log('PASS: EN/AR tool dialogs, focus/inert restoration, per-question notes, stale owner/token rejection, normalized pointer drawing, colors/width/eraser/undo/clear/caps, resize, safe arithmetic and invalid expressions.');
