/* Global carousel and introduction film. No autoplaying video or background downloads. */
(() => {
  'use strict';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let currentCarousel = null;
  let timer = null;
  function pause(){ if(timer){clearInterval(timer);timer=null;} }
  function show(carousel,index){
    const slides=[...carousel.querySelectorAll('.v24-slide')];
    if(!slides.length)return;
    const selected=(index+slides.length)%slides.length;
    slides.forEach((slide,i)=>{
      slide.classList.toggle('is-current',i===selected);
      slide.setAttribute('aria-hidden',i===selected?'false':'true');
    });
    carousel.dataset.current=String(selected);
    const count=carousel.querySelector('.v24-count');
    if(count)count.textContent=String(selected+1).padStart(2,'0')+' / '+String(slides.length).padStart(2,'0');
  }
  function start(carousel){
    pause();
    if(!carousel||reduceMotion.matches||document.hidden)return;
    timer=setInterval(()=>{
      if(!carousel.isConnected){pause();return;}
      show(carousel,Number(carousel.dataset.current||0)+1);
    },6500);
  }
  function bind(){
    const carousel=document.querySelector('.v24-carousel');
    if(!carousel||carousel===currentCarousel)return;
    currentCarousel=carousel;
    show(carousel,0);
    carousel.querySelector('[data-v24-prev]')?.addEventListener('click',()=>{show(carousel,Number(carousel.dataset.current||0)-1);start(carousel)});
    carousel.querySelector('[data-v24-next]')?.addEventListener('click',()=>{show(carousel,Number(carousel.dataset.current||0)+1);start(carousel)});
    carousel.addEventListener('mouseenter',pause);
    carousel.addEventListener('mouseleave',()=>start(carousel));
    carousel.addEventListener('focusin',pause);
    carousel.addEventListener('focusout',()=>start(carousel));
    start(carousel);
  }
  function openVideo(){
    const source=String(window.CMS?.heroVimeo||'');
    const match=source.match(/(?:vimeo\.com\/(?:video\/)?|^)(\d{6,12})(?:\D|$)/);
    if(!match){window.APP?.toast?.(document.documentElement.lang==='en'?'The introductory video will be available soon.':'سيُتاح الفيديو التعريفي قريبًا.');return;}
    const id=match[1];
    const title=document.documentElement.lang==='en'?'Meet Alsaeed':'تعرف على السعيد';
    window.APP?.modal?.(`<div class="v24-video-modal"><h2>${title}</h2><div class="v24-video-frame"><iframe src="https://player.vimeo.com/video/${id}?title=0&byline=0&portrait=0&dnt=1" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${title}"></iframe></div><button class="btn o" data-close>${document.documentElement.lang==='en'?'Close':'إغلاق'}</button></div>`);
  }
  document.addEventListener('click',event=>{if(event.target.closest('[data-v24-video]'))openVideo()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else start(currentCarousel)});
  reduceMotion.addEventListener?.('change',()=>start(currentCarousel));
  function init(){
    bind();
    const app=document.getElementById('app');
    if(app)new MutationObserver(bind).observe(app,{childList:true});
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();
