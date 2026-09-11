/* Al Saeed Admin V18 — cosmetic/version layer only. */
(()=>{
  'use strict';
  document.documentElement.dataset.adminUi='v18';
  function patch(){
    document.title=(document.title||'لوحة الإدارة').replace(/V15|V16|V17/g,'V18');
    document.querySelectorAll('.vbadge').forEach(x=>x.textContent='V18');
    document.querySelectorAll('h2').forEach(x=>{if(/لوحة إدارة السعيد V1[5-7]/.test(x.textContent||''))x.textContent=(x.textContent||'').replace(/V1[5-7]/,'V18')});
    const brand=document.querySelector('.brand b');
    if(brand&&/مركز إدارة المحتوى/.test(brand.textContent||''))brand.textContent='مركز إدارة المنصة';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch,{once:true});else patch();
  new MutationObserver(patch).observe(document.documentElement,{subtree:true,childList:true});
})();
