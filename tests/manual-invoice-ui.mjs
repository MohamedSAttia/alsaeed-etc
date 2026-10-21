import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(new URL('../public/admin-v15-7.js',import.meta.url),'utf8');
function fixture(){
 const {window}=new JSDOM('<body></body>');let requests=[],alerts=[],resolveRequest;
 const context=vm.createContext({document:window.document,console,Date,Object,Number,Error,alert:m=>alerts.push(m),confirm:()=>true,toast:()=>{},draw:()=>{},
 esc:s=>String(s??''),psel:id=>`<select id="${id}"><option value="test-full">Test package</option></select>`,
 modal:(html,bind)=>{const m=window.document.createElement('div');m.innerHTML=html;window.document.body.append(m);bind(m);return m},
 CA:async(path,options)=>{if(options){requests.push({path,...options});return await new Promise(resolve=>resolveRequest=resolve)}return []}});
 vm.runInContext(source,context);vm.runInContext("INVOICE_CFG={currencies:{EGP:48}};openManualInvoice()",context);
 const $=s=>window.document.querySelector(s);
 const fill=()=>{for(const [id,value] of Object.entries({manualEmail:'student@example.invalid',manualAmount:'114',manualCurrency:'EGP',manualCountry:'EG',manualMethod:'cash',manualReceivedAt:'2026-01-01T12:00'}))$('#'+id).value=value;};
 return {context,$,fill,requests,alerts,finish:()=>resolveRequest({ok:true})};
}
test('Payment amount/currency/date are blank and both acknowledgments unchecked; incomplete approval sends nothing',async()=>{const f=fixture();for(const id of ['manualAmount','manualCurrency','manualReceivedAt'])assert.equal(f.$('#'+id).value,'');assert.equal(f.$('#manualReceived').checked,false);assert.equal(f.$('#manualApprove').checked,false);f.fill();await f.$('#manualIssue').onclick();assert.equal(f.requests.length,0);f.$('#manualReceived').checked=true;await f.$('#manualIssue').onclick();assert.equal(f.requests.length,0)});
test('Explicit confirmations submit one separate manual invoice call; pending button disabled; reopen resets',async()=>{const f=fixture();f.fill();f.$('#manualReceived').checked=true;f.$('#manualApprove').checked=true;const pending=f.$('#manualIssue').onclick();assert.equal(f.$('#manualIssue').disabled,true);assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/manual-invoices');assert.equal(f.requests[0].body.amount,'114');assert.equal(f.requests[0].body.paymentReceived,true);assert.equal(f.requests[0].body.approveInvoice,true);f.finish();await pending;vm.runInContext('openManualInvoice()',f.context);assert.equal(f.$('#manualReceived').checked,false);assert.equal(f.$('#manualApprove').checked,false)});
