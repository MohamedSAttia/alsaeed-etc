import assert from 'node:assert/strict';
import fs from 'node:fs';
const {JSDOM}=await import('/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js');
const source=fs.readFileSync('public/index.html','utf8'),nav=source.slice(source.indexOf('function renderNav()'),source.indexOf('/* ═══ الدخول والتسجيل',source.indexOf('function renderNav()')));
const logout=source.slice(source.indexOf("  const lo = $('#logout');"),source.indexOf("  const bl = $('#btnLogin');"));
for(const lang of ['ar','en']){
 const dom=new JSDOM('<body><header class="hdr"><div class="hdr-in"><a id="logoLink"></a><nav id="nav"></nav><div id="hdrAct"></div><button id="burger"></button></div></header><div id="app"></div></body>',{url:'https://test.local',runScripts:'outside-only'}),w=dom.window,d=w.document;
 let user=null,opened='',saved=false,route='';
 Object.assign(w,{$:q=>d.querySelector(q),__lang:lang,ROUTE:'home',LOGO_FULL:()=>'<b>Al Saeed</b>',me:()=>user,isAdmin:()=>false,LANGS:[{k:'ar'},{k:'en'}],NAV_I18N:{ar:{home:'الرئيسية',dash:'لوحتي',logout:'خروج',register:'إنشاء حساب'},en:{home:'Home',dash:'My dashboard',logout:'Logout',register:'Create account'}},esc:s=>String(s).replace(/[<>]/g,''),DB:{session:'learner'},API:{token:'test',progressOwner:'learner'},progressRequests:new Map(),progressErrors:new Map(),resetLessonCaches:()=>{},save:()=>saved=true,toast:()=>{},go:r=>{route=r;user=null;w.renderNav()},openAuth:mode=>opened=mode});
 w.eval(nav);w.renderNav();
 assert(d.querySelector('#hdrAct .account-entry-actions #btnLogin'));assert(d.querySelector('#hdrAct .account-entry-actions #btnReg'));assert(!d.querySelector('#btnDashboard'));
 user={id:'learner',name:'Learner'};w.renderNav();assert.equal(d.querySelector('#btnDashboard').getAttribute('href'),'#dash');assert(d.querySelector('#logout'));assert(!d.querySelector('#btnLogin'));
 w.eval(logout);d.querySelector('#nav').classList.add('open');d.body.classList.add('public-menu-open');d.querySelector('#logout').click();assert.equal(w.API.token,null);assert.equal(w.DB.session,null);assert.equal(route,'home');assert(saved);assert.equal(opened,'login');assert(d.querySelector('#btnLogin'));assert(d.querySelector('#btnReg'));assert(!d.body.classList.contains('public-menu-open'));
 dom.window.close();
}
const css=fs.readFileSync('public/public-experience.css','utf8');assert(!/btnReg[^}]*display:none/.test(css));assert(!/btnLogin[^}]*display:none/.test(css));assert.match(css,/--hdr:132px/);assert.match(css,/account-entry-actions \.btn\{display:inline-flex/);assert.match(css,/grid-column:1\/-1;grid-row:2/);
console.log('PASS: AR/EN visible account entry, signed-in dashboard, logout clears session and opens login, mobile account row source contracts');
