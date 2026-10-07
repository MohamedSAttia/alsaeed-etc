import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('ai-assistant.js','utf8');const start=source.indexOf('  async function translateLearning('),end=source.indexOf('  async function translateQuestion(',start);const cache=new Map();let calls=0,reply;
const c={cleanText:(x)=>String(x||''),hasAccess:(u,p)=>p==='enrolled',json:(r,status,body)=>{reply={status,body}},parseJsonReply:JSON.parse,callOpenAI:async({input,instructions})=>{calls++;assert(instructions.includes('option letters'));return JSON.stringify({texts:JSON.parse(input).map(x=>'FR:'+x)})},db:{prepare:sql=>({get:(l,s)=>cache.has(l+s)?{translated:cache.get(l+s)}:undefined,run:(l,s,t)=>cache.set(l+s,t)})}};vm.createContext(c);vm.runInContext(source.slice(start,end)+';globalThis.run=translateLearning',c);
await c.run({}, {packageId:'other',language:'fr',texts:['Q']},{});assert.equal(reply.status,403);
await c.run({}, {packageId:'enrolled',language:'xx',texts:['Q']},{});assert.equal(reply.status,403);
for(const language of ['ar','en','fr','de']){await c.run({}, {packageId:'enrolled',language,texts:['What first?','Option A']},{});assert.equal(reply.status,200);assert.equal(reply.body.texts.length,2)}
const before=calls;await c.run({}, {packageId:'enrolled',language:'fr',texts:['What first?','Option A']},{});assert.equal(calls,before);
c.callOpenAI=async()=>JSON.stringify({texts:['only one']});await c.run({}, {packageId:'enrolled',language:'de',texts:['new Q','new A']},{});assert.equal(reply.status,502);
console.log('PASS: four languages, access validation, order preservation, persistent cache, incomplete translations rejected');
