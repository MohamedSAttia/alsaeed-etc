/* Al Saeed LMS V18 — safe presentation enhancements only. */
(()=>{
  'use strict';
  document.documentElement.dataset.alsaeedUi='v18';
  function progress(){
    let bar=document.getElementById('v18-page-progress');
    if(!bar){bar=document.createElement('div');bar.id='v18-page-progress';bar.innerHTML='<i></i>';document.body.appendChild(bar)}
    const update=()=>{
      const h=Math.max(1,document.documentElement.scrollHeight-innerHeight);
      const p=Math.max(0,Math.min(100,(scrollY/h)*100));
      const i=bar.querySelector('i');if(i)i.style.width=p+'%';
    };
    addEventListener('scroll',update,{passive:true});addEventListener('resize',update,{passive:true});update();
  }
  function reveal(){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('v18-in');io.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -30px 0px'});
    const seen=new WeakSet();
    const scan=()=>document.querySelectorAll('.pk,.course-vcard,.cr,.acad-c,.cons-c,.lib-c,.sec-c,.vmv-c').forEach(el=>{if(seen.has(el))return;seen.add(el);el.classList.add('v18-reveal');io.observe(el)});
    scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  }
  function markVersion(){document.querySelectorAll('[data-platform-version]').forEach(x=>x.textContent='V18')}
  function boot(){progress();reveal();markVersion()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
