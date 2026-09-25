/* Published-package finder and inquiry routing. */
(() => {
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function update() {
    const result=document.getElementById('v31Results');
    if(!result)return;
    const en=window.__lang==='en';
    const course=document.getElementById('v31Course')?.value||'';
    const mode=document.getElementById('v31Mode')?.value||'';
    const matches=(window.PACKAGES||[]).filter(p=>p.active!==false&&(!course||p.course===course)&&(!mode||p.mode===mode));
    result.innerHTML='<p class="v31-result-count">'+matches.length+' '+(en?'published packages':'باقات منشورة')+'</p>'+
      (matches.length?'<div class="v31-result-list">'+matches.slice(0,4).map(p=>{
        const c=(window.COURSES||[]).find(item=>item.id===p.course)||{};
        const m=(window.MODES||[]).find(item=>item.k===p.mode)||{};
        const title=en?(p.en||p.ar||c.en||c.ar):(p.ar||c.ar||p.en);
        return '<a href="#pkg/'+encodeURIComponent(p.id)+'"><b>'+safe(title)+'</b><small>'+safe(en?(c.en||c.ar):(c.ar||c.en))+' · '+safe(en?(m.en||m.ar):(m.ar||m.en))+'</small><span aria-hidden="true">↗</span></a>';
      }).join('')+'</div><a class="v31-all" href="#programs">'+(en?'View all packages':'عرض جميع الباقات')+' ↗</a>':
      '<p class="v31-no-match">'+(en?'No package is currently published for this selection. Ask about a suitable group or team plan.':'لا توجد باقة منشورة بهذا الاختيار حاليًا. استفسر عن مجموعة قادمة أو خطة لفريقك.')+'</p><a href="#contact">'+(en?'Send an inquiry':'أرسل استفسارًا')+' ↗</a>');
  }
  const observer=new MutationObserver(()=>{if(document.getElementById('v31Results'))update()});
  const app=document.getElementById('app');if(app)observer.observe(app,{childList:true});
  document.addEventListener('change',event=>{if(event.target?.matches('#v31Course,#v31Mode'))update()});
  if(document.getElementById('v31Results'))update();
})();
