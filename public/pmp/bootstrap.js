/* AL-LTC PMP Integration V20 — authenticated, bilingual, cloud-linked */
(function(){'use strict';
const root=document.getElementById('root');
const esc=s=>String(s||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const gate=(t,m,a='')=>{root.innerHTML=`<div class="pmp-gate"><div class="gate-card"><img src="/assets/al-ltc-logo.svg" alt="AL SAEED" style="height:56px;margin:auto"><h2>${esc(t)}</h2><p>${m}</p>${a}</div></div>`};
const token=(()=>{try{return localStorage.getItem('alsaeed_token')||''}catch{return''}})();
async function api(path,opt={}){const r=await fetch(path,{method:opt.method||'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:opt.body?JSON.stringify(opt.body):undefined,cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'تعذر الاتصال بالمنصة');return d}
async function inflateB64(b){const bin=atob(b),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);if(!('DecompressionStream'in window))throw new Error('استخدم Chrome أو Edge حديثاً لفتح منصة PMP.');const st=new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'));return await new Response(st).text()}
async function packed(name){const r=await fetch(`/pmp/packed/${name}.b64?v=20260912-3`,{cache:'force-cache'});if(!r.ok)throw new Error('تعذر تحميل مكوّن PMP: '+name);return inflateB64(await r.text())}
function run(src,label){try{(0,eval)(src)}catch(e){console.error(label,e);throw new Error('تعذر تشغيل مكوّن '+label)}}
function mapLesson(x){const title=x.title||x.title_en||('PMP Lesson '+(Number(x.idx||0)+1));const lc=title.toLowerCase();let d='process';if(/team|leader|stakeholder|communication|conflict|فريق|قياد|أصحاب|تواصل/.test(lc))d='people';if(/govern|compliance|business|benefit|حوكم|امتثال|أعمال|منفعة/.test(lc))d='business';return{t:title,dur:x.duration||'',d,ch:x.notes||title,vid:x.vimeo||''}}
async function bank(){let b='';for(let i=1;i<=8;i++){const r=await fetch(`/pmp/parts/qbank-${String(i).padStart(2,'0')}.txt?v=20260912-3`,{cache:'force-cache'});if(!r.ok)throw new Error('تعذر تحميل بنك الأسئلة');b+=await r.text()}const text=await inflateB64(b);const rows=JSON.parse(text);if(!Array.isArray(rows)||rows.length!==874)throw new Error('فشل التحقق من بنك الأسئلة');return rows}
async function boot(){
 if(!token){gate('يلزم تسجيل الدخول','منصة PMP® الكاملة متاحة للمشتركين المسجّلين فقط.','<p><a href="/#login">تسجيل الدخول</a> · <a href="/#course/pmp">عرض باقات PMP</a></p>');return}
 try{const me=await api('/api/me');const isAdmin=me.user&&me.user.role==='admin',now=Date.now();const ps=(me.packages||[]).filter(p=>String(p.package_id||'').toLowerCase().includes('pmp')&&(!p.expires||+p.expires>now));if(!isAdmin&&!ps.length){gate('هذه المنصة ضمن باقات PMP®','لا توجد لديك حالياً باقة PMP فعّالة.','<p><a href="/#course/pmp">اشترك في PMP</a> · <a href="/#dash">حسابي</a></p>');return}const packageId=(ps.find(x=>x.package_id==='pmp-full')||ps.find(x=>x.package_id==='pmp-sim')||ps[0]||{package_id:'pmp-full'}).package_id;window.PMP_ACCESS={token,user:me.user,isAdmin,packageId};document.body.classList.toggle('pmp-admin',!!isAdmin);
 const css=await packed('style');const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
 try{const ls=await api('/api/lessons/'+encodeURIComponent(packageId));window.PMP_REMOTE_VIDS=(ls||[]).filter(x=>x.vimeo||x.free).map(mapLesson)}catch{window.PMP_REMOTE_VIDS=[]}
 const rows=await bank();window.DB={q:rows,cases:[]};
 window.PMP_CLOUD={saveAttempt:async a=>{try{let p={};try{p=await api('/api/progress/'+encodeURIComponent(packageId))}catch{};p.pmpIntegrated=p.pmpIntegrated||{};const x=Array.isArray(p.pmpIntegrated.attempts)?p.pmpIntegrated.attempts:[];x.unshift(a);p.pmpIntegrated.attempts=x.slice(0,30);p.pmpIntegrated.last=a;await api('/api/progress/'+encodeURIComponent(packageId),{method:'PUT',body:p})}catch(e){console.warn('progress sync',e.message)}}};
 run(await packed('cases'),'cases');run(await packed('typed'),'typed questions');run(await packed('renderers'),'renderers');run(await packed('engine'),'engine');
 }catch(e){console.error(e);gate('تعذر فتح منصة PMP®',esc(e.message||'حدث خطأ أثناء التحميل'),'<p><button onclick="location.reload()">إعادة المحاولة</button> · <a href="/">الرئيسية</a></p>')}
}
boot();})();