/* Read-only access to the signed-in learner's historical certificate records. */
(function(root){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let generation=0;
  async function mount(){
    const host=document.querySelector('[data-my-certificates]'),app=root.APP,user=app?.me();
    if(!host||host.dataset.loaded||!user||!app.live)return;
    const run=++generation,uid=user.id,en=root.__lang==='en';host.dataset.loaded='true';
    host.innerHTML=`<h2>${en?'My certificates':'شهاداتي'}</h2><p role="status">${en?'Loading issued certificates…':'جارٍ تحميل الشهادات الصادرة…'}</p>`;
    try{
      const data=await app.api('/certificates');
      if(run!==generation||app.me()?.id!==uid||!host.isConnected)return;
      const records=Array.isArray(data.certificates)?data.certificates:[];
      host.innerHTML=`<h2>${en?'My certificates':'شهاداتي'}</h2><p class="muted">${en?'View and print your saved certificates. The original issue details are retained.':'اعرض واطبع شهاداتك المحفوظة ببيانات الإصدار الأصلية.'}</p>${records.map(c=>`<article class="card"><div><b dir="auto">${esc(c.course)}</b><small>${esc(c.no)} · ${Number(c.issued)>0?esc(new Date(Number(c.issued)).toLocaleDateString(en?'en-GB':'ar-EG')):''}</small></div><button class="btn o" data-reprint-certificate="${esc(c.no)}">${en?'View / print':'عرض / طباعة'}</button></article>`).join('')||`<p>${en?'No certificates have been issued yet.':'لا توجد شهادات صادرة بعد.'}</p>`}`;
      host.querySelectorAll('[data-reprint-certificate]').forEach(button=>button.onclick=()=>reprint(button,uid,en));
    }catch(error){
      if(run!==generation||app.me()?.id!==uid||!host.isConnected)return;
      host.innerHTML=`<h2>${en?'My certificates':'شهاداتي'}</h2><p role="alert">${esc(error.message)}</p><button class="btn o" data-retry-certificates>${en?'Retry':'إعادة المحاولة'}</button>`;
      host.querySelector('[data-retry-certificates]').onclick=()=>{delete host.dataset.loaded;mount();};
    }
  }
  async function reprint(button,uid,en){
    if(button.disabled)return;const app=root.APP;if(app.me()?.id!==uid)return;
    const popup=root.open('','_blank');if(!popup){app.toast(en?'Allow the certificate window to open.':'اسمح بفتح نافذة الشهادة.');return;}
    popup.document.body.textContent=en?'Loading your saved certificate…':'جارٍ تحميل الشهادة المحفوظة…';
    button.disabled=true;
    try{
      const record=await app.api('/certificates/'+encodeURIComponent(button.dataset.reprintCertificate));
      if(app.me()?.id!==uid)throw new Error(en?'Please sign in again.':'سجّل الدخول من جديد.');
      if(!root.AlsaeedCertificate)throw new Error(en?'Reload the page to print.':'أعد تحميل الصفحة للطباعة.');
      const courseId=record.presentation?.courseId||app.pack(record.packageId)?.course;
      const html=root.AlsaeedCertificate.render({...record,courseId});
      popup.document.open();popup.document.write(html);popup.document.close();
      await root.AlsaeedCertificate.prepare(popup);popup.print();
    }catch(error){popup.close();app.toast(error.message);}
    finally{button.disabled=false;}
  }
  root.CertificateLibrary=Object.freeze({mount});
  const appHost=document.getElementById('app');
  if(appHost)new MutationObserver(mount).observe(appHost,{childList:true});
  mount();
})(window);
