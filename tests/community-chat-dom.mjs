/** Local DOM regression only. Uses synthetic users/messages, never a live backend. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
let jsdom;
try { jsdom = await import(process.env.JSDOM_MODULE || 'jsdom'); }
catch { jsdom = await import(pathToFileURL('/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js').href); }
const source = await readFile('public/community-chat.js', 'utf8');
const settle = (ms = 25) => new Promise(resolve => setTimeout(resolve, ms));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise, resolve, reject}; };
const general = {id:'general',name:'General',kind:'general',unread:2};
const direct = {id:'dm:7',name:'Safe Person',kind:'direct',unread:1};
const message = (id, body, own = false, extra = {}) => ({id,body,own,created:'2026-10-23T12:00:00Z',edited:null,hidden:false,authorName:own?'Synthetic owner':'Synthetic member',reply:null,...extra});
const fixtures = [];
async function setup({lang='en', roomList=[general,direct], rows=[message(31,'Shared general text'),message(32,'My original text',true)], hooks={}}={}) {
  const dom = new jsdom.JSDOM('<!doctype html><html><body><div data-community-chat></div></body></html>',{url:'http://community.test',runScripts:'outside-only',pretendToBeVisual:true});
  fixtures.push(dom);
  const {window:w}=dom, d=w.document;
  w.__lang=lang; w.confirm=()=>true;
  let actor={id:1}, authToken='token-one', id=100;
  const calls=[], data={general:[...rows],'dm:7':[message(40,'Private selected-recipient text')]};
  w.APP={me:()=>actor,get token(){return authToken;},openAuth:()=>{},api:async(path,options={})=>{
    calls.push({path,options});
    const special=hooks.api?.(path,options);if(special!==undefined)return special;
    if(path==='/community-chat/rooms')return {rooms:roomList};
    if(path.startsWith('/community-chat/directory'))return {people:[{id:2,name:'Safe Person'},{id:1,name:'Current user'}]};
    if(path==='/community-chat/direct')return {room:direct};
    const match=path.match(/^\/community-chat\/([^/]+)\/(messages|read)(?:\/(\d+))?(\?.*)?$/);
    if(!match)throw new Error('Unexpected API '+path);
    const room=decodeURIComponent(match[1]);
    if(match[2]==='read')return {ok:true};
    if(options.method==='POST') {const row=message(++id,options.body.body,true,options.body.replyTo?{reply:{id:options.body.replyTo,body:'Shared general text',authorName:'Synthetic member'}}:{});data[room]??=[];data[room].push(row);return {message:row};}
    if(options.method==='PATCH') {const row=data[room].find(x=>x.id===Number(match[3]));Object.assign(row,options.body,{edited:'2026-10-23T12:01:00Z'});return {message:row};}
    if(match[4])return {room:room==='general'?general:direct,messages:[message(1,'Older message')],hasMore:false};
    return {room:room==='general'?general:direct,messages:data[room]||[],hasMore:true};
  }};
  w.eval(source);await settle();
  return {w,d,calls,data,hooks,roomList,host:d.querySelector('[data-community-chat]'),setActor:value=>actor=value,setToken:value=>authToken=value,close:()=>dom.window.close()};
}
const control=(f,action,id)=>[...f.d.querySelectorAll(`[data-cc-action="${action}"]`)].find(el=>id==null||el.dataset.messageId===String(id)||el.dataset.roomId===id);
function type(f,text) {const input=f.d.querySelector('[data-cc-draft]');input.value=text;input.dispatchEvent(new f.w.Event('input',{bubbles:true}));return input;}
function send(f) {f.d.querySelector('[data-cc-form]').dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));}
function writes(f) {return f.calls.filter(call=>['POST','PATCH'].includes(call.options.method)&&call.path.includes('/messages'));}
try {
  {
    const f=await setup();
    assert.match(f.d.querySelector('.cc-audience').textContent,/Everyone with an active platform account/);
    assert.equal(f.d.querySelector('[data-cc-draft]').getAttribute('aria-label'),'General message to all active platform members');
    assert.equal(control(f,'edit',31),undefined);assert.ok(control(f,'edit',32));
    assert.ok(f.calls.some(call=>call.path==='/community-chat/general/read'&&call.options.body.lastId===32),'Opening the visible latest page records its latest message');
    assert.equal(control(f,'room','general').querySelector('.cc-unread'),null);assert.ok(control(f,'room','dm:7').querySelector('.cc-unread'));
    const field=type(f,'Preserve draft and cursor');field.focus();field.setSelectionRange(4,10);
    control(f,'refresh').click();await settle();
    assert.equal(f.d.activeElement,field);assert.equal(field.value,'Preserve draft and cursor');assert.equal(field.selectionStart,4);assert.equal(field.selectionEnd,10);
    control(f,'room','dm:7').click();await settle();
    assert.match(f.d.querySelector('.cc-audience').textContent,/private between you and Safe Person only/);
    assert.ok(!f.host.textContent.includes('Shared general text'));type(f,'Private draft');
    control(f,'room','general').click();await settle();assert.equal(f.d.querySelector('[data-cc-draft]').value,'Preserve draft and cursor');
    control(f,'older').click();await settle();assert.match(f.d.querySelector('.cc-messages').textContent,/Older message/);
    control(f,'refresh').click();await settle();assert.ok(!f.d.querySelector('.cc-messages').textContent.includes('Older message'),'Ordinary refresh drops stale cached older bodies');
    control(f,'reply',31).click();assert.match(f.d.querySelector('.cc-compose-context').textContent,/Shared general text/);
    type(f,'Reply text');send(f);await settle();assert.equal(writes(f).at(-1).options.body.replyTo,31);
    type(f,'Unsent draft');control(f,'edit',32).click();type(f,'Changed message');control(f,'cancel-compose').click();assert.equal(f.d.querySelector('[data-cc-draft]').value,'Unsent draft');
    control(f,'edit',32).click();type(f,'Edited text');send(f);await settle();assert.equal(writes(f).at(-1).options.method,'PATCH');assert.equal(f.d.querySelector('[data-cc-draft]').value,'Unsent draft','Editing does not discard an unrelated unsent draft');
    control(f,'delete',32).click();await settle();assert.equal(writes(f).at(-1).options.body.hidden,true);assert.ok(!f.d.querySelector('.cc-messages').textContent.includes('Edited text'));
    control(f,'emoji').click();control(f,'insert-emoji').click();assert.ok(f.d.querySelector('[data-cc-draft]').value.includes('😊'));
    assert.equal(f.w.localStorage.length,0);assert.equal(f.w.sessionStorage.length,0);
    const beforeLanguage=f.d.querySelector('[data-cc-draft]').value;f.w.__lang='ar';f.d.documentElement.lang='ar';await settle();
    assert.equal(f.d.querySelector('.community-chat').dir,'rtl');assert.equal(f.d.querySelector('[data-cc-draft]').value,beforeLanguage);
    f.close();
  }
  {
    const f=await setup({lang:'ar',rows:[message(1,'<img src=x onerror="window.pwned=1">',false,{authorName:'<svg onload="x()">',reply:{id:9,body:'<script>alert(1)</script>',authorName:'<b>name</b>'}})]});
    assert.equal(f.d.querySelector('.community-chat').dir,'rtl');assert.ok(!f.d.querySelector('.cc-messages img,.cc-messages svg,.cc-messages script'));
    assert.match(f.d.querySelector('.cc-messages').textContent,/<img src=x/);assert.equal(f.w.pwned,undefined);
    assert.match(f.d.querySelector('.cc-audience').textContent,/جميع أعضاء المنصة النشطين/);
    f.close();
  }
  {
    const searchA=deferred(),searchB=deferred();
    const f=await setup({hooks:{api:(path)=>path.includes('q=Alice')?searchA.promise:path.includes('q=Bob')?searchB.promise:undefined}});
    control(f,'directory').click();const search=f.d.querySelector('[data-cc-search]');
    search.value='A';search.dispatchEvent(new f.w.Event('input',{bubbles:true}));await settle(340);assert.ok(!f.calls.some(x=>x.path.includes('/directory')));
    search.value='Alice';search.dispatchEvent(new f.w.Event('input',{bubbles:true}));await settle(340);
    search.value='Bob';search.dispatchEvent(new f.w.Event('input',{bubbles:true}));await settle(340);
    searchB.resolve({people:[{id:3,name:'Bob <b>safe</b>'}]});await settle();searchA.resolve({people:[{id:2,name:'Alice stale'}]});await settle();
    assert.ok(!f.d.querySelector('.cc-directory-results').textContent.includes('Alice'));assert.equal(f.d.querySelector('.cc-directory-results b'),null);
    control(f,'person').click();assert.equal(f.calls.filter(x=>x.path==='/community-chat/direct').length,0,'Selecting recipient does not create until explicit confirmation');
    control(f,'start-direct').click();await settle();assert.equal(f.calls.filter(x=>x.path==='/community-chat/direct').length,1);assert.equal(writes(f).length,0,'Opening a conversation sends no message');
    f.close();
  }
  {
    let rejectOnce=true;
    const f=await setup({hooks:{api:(path,opt)=>opt.method==='POST'&&path.endsWith('/messages')&&rejectOnce?(rejectOnce=false,Promise.reject(new Error('network'))):undefined}});
    type(f,'Retry idempotently');send(f);await settle();assert.equal(f.d.querySelector('[data-cc-draft]').value,'Retry idempotently');send(f);await settle();
    const attempts=writes(f);assert.equal(attempts.length,2);assert.equal(attempts[0].options.body.nonce,attempts[1].options.body.nonce);
    f.close();
  }
  {
    const pending=deferred();let once=true;
    const f=await setup({hooks:{api:(path,opt)=>opt.method==='POST'&&path.endsWith('/messages')&&once?(once=false,pending.promise):undefined}});
    type(f,'In-flight draft');send(f);await settle();
    control(f,'room','dm:7').click();await settle();type(f,'Other room draft');control(f,'room','general').click();await settle();
    assert.equal(f.d.querySelector('[data-cc-draft]').disabled,true,'Returning to a pending room cannot submit or replace its draft');
    assert.equal(f.d.querySelector('[data-cc-draft]').value,'In-flight draft');send(f);assert.equal(writes(f).length,1);
    pending.resolve({message:message(99,'In-flight draft',true)});await settle();
    assert.equal(f.d.querySelector('[data-cc-draft]').disabled,false);assert.equal(f.d.querySelector('[data-cc-draft]').value,'','Confirmed old-room send clears its submitted draft even after returning');
    control(f,'room','dm:7').click();await settle();assert.equal(f.d.querySelector('[data-cc-draft]').value,'Other room draft');f.close();
  }
  for(const mode of ['owner','token']) {
    const f=await setup();type(f,'Old account protected draft');const staleForm=f.d.querySelector('[data-cc-form]');const oldCalls=writes(f).length;
    if(mode==='owner')f.setActor({id:2});else f.setToken('token-two');
    staleForm.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));
    assert.equal(writes(f).length,oldCalls,`${mode} change is guarded synchronously before a stale submit`);
    assert.ok(!f.host.textContent.includes('Old account protected draft'));await settle();assert.equal(f.d.querySelector('[data-cc-draft]').value,'');f.close();
  }
  {
    const delayed=deferred();let reads=0;
    const f=await setup({hooks:{api:(path,opt)=>path==='/community-chat/general/messages'&&!opt.method&&++reads===2?delayed.promise:undefined}});
    type(f,'Old owner draft');control(f,'refresh').click();await settle();f.setActor({id:2});f.setToken('new-account');
    delayed.resolve({room:general,messages:[message(200,'STALE SECRET')],hasMore:false});await settle();
    assert.ok(!f.host.textContent.includes('STALE SECRET'));assert.equal(f.d.querySelector('[data-cc-draft]').value,'');f.close();
  }
  {
    const f=await setup();type(f,'Draft that must be scrubbed');f.hooks.api=(path)=>path==='/community-chat/rooms'?Promise.reject({status:403}):undefined;
    control(f,'refresh').click();await settle();assert.equal(f.d.querySelector('.cc-messages'),null);assert.equal(f.d.querySelector('[data-cc-draft]'),null);assert.ok(!f.host.textContent.includes('Shared general text'));
    f.close();
  }
  {
    const f=await setup();type(f,'Other tab logout draft');f.w.dispatchEvent(new f.w.StorageEvent('storage',{key:'alsaeed_token',newValue:null}));await settle();
    assert.equal(f.d.querySelector('[data-cc-draft]'),null);assert.equal(f.d.querySelector('.cc-messages'),null);assert.match(f.host.textContent,/Refresh sign-in/);f.close();
  }
  {
    const f=await setup({rows:[message(31,'Moderatable text',false,{canModerate:true}),message(32,'Already hidden',false,{canModerate:true,hidden:true})]});
    assert.ok(control(f,'delete',31));assert.ok(control(f,'restore',32));assert.equal(control(f,'edit',31),undefined);
    control(f,'delete',31).click();await settle();assert.equal(writes(f).at(-1).options.body.hidden,true);
    control(f,'restore',32).click();await settle();assert.equal(writes(f).at(-1).options.body.hidden,false);
    f.data['dm:7']=[message(40,'Cannot moderate private peer',false,{canModerate:true})];control(f,'room','dm:7').click();await settle();
    assert.equal(control(f,'delete',40),undefined);assert.equal(control(f,'restore',40),undefined);f.close();
  }
  console.log('PASS: AR/EN audiences, private selection, XSS, per-room drafts/focus, history revalidation, reply/edit/delete, emojis, unread, safe retries, pending-room return, pre-send owner/token guards, stale async responses, 403/storage scrubbing, general-only moderation. DOM-only synthetic tests; no live messages sent.');
} finally {for(const dom of fixtures)dom.window.close();}
