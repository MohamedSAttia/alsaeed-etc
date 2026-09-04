/* AL-SAEED V14 runtime enhancements — safe, non-destructive. */
(()=>{
  document.documentElement.dataset.alsaeedUi='v14';
  const path=location.pathname.replace(/\/$/,'');
  const parts=path.split('/').filter(Boolean);
  const isPanel=parts.length===1 && /^manage-/i.test(parts[0]);
  if(!isPanel) return;
  const target='/'+parts[0]+'/content';
  function addContentNav(){
    const nav=document.querySelector('.side nav');
    if(!nav || nav.querySelector('[data-v14-content]')) return;
    const b=document.createElement('button');
    b.type='button'; b.dataset.v14Content='1';
    b.innerHTML='<span class="ic">📚</span><span>إدارة الباقات والمحتوى</span>';
    b.addEventListener('click',()=>{ location.href=target; });
    const settings=[...nav.querySelectorAll('button')].find(x=>/الإعدادات/.test(x.textContent||''));
    if(settings) nav.insertBefore(b,settings); else nav.appendChild(b);
  }
  addContentNav();
  const mo=new MutationObserver(addContentNav);
  mo.observe(document.documentElement,{subtree:true,childList:true});
})();
