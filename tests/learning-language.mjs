import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const saved=new Map();let rendered=0,chosen=null;
const context={window:{APP:{render(){rendered++}},I18:{dict:{},reindex(){},set(l){chosen=l}}},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},MutationObserver:class{observe(){}},document:{body:{}},setTimeout(){}};
vm.createContext(context);const source=fs.readFileSync('public/learning-language.js','utf8');vm.runInContext(source,context);const l=context.window.LearningLanguage;
assert(l.activate('pmp-full','en'));assert.equal(l.languageFor('pmp-full'),'en');assert.equal(context.window.__lang,'en');assert.equal(chosen,'en');assert.equal(rendered,1);assert(!l.activate('pmp-full','fr'));assert.equal(l.languageFor('pmp-full'),'en');assert(!source.includes('/ai/translate-learning'));assert.equal(l.pending,false);
const exam=fs.readFileSync('public/unified-exam.js','utf8');assert(exam.includes('window.LearningLanguage?.languageFor(pid)'));assert(!exam.includes("if(S.p.lang!=='both')return"));
console.log('PASS: saved package language drives native rendering and exam language without API calls; unavailable languages do not silently activate');
