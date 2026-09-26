/* Global carousel and introduction film. No autoplaying video or background downloads. */
(() => {
  'use strict';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let currentCarousel = null;
  let timer = null;
  const intervalMs = 3800;
  let userPaused = false;
  function pause(){ if(timer){clearInterval(timer);timer=null;} const bar=currentCarousel?.querySelector('.v36-progress i');if(bar)bar.style.animationPlayState='paused'; }
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
    const progress=carousel.querySelector('.v36-progress i');
    if(progress){progress.style.animation='none';void progress.offsetWidth;progress.style.animation='v36-progress '+intervalMs+'ms linear forwards';progress.style.animationPlayState=userPaused||reduceMotion.matches?'paused':'running';}
  }
  function start(carousel){
    pause();
    if(!carousel||reduceMotion.matches||document.hidden||userPaused||carousel.matches(':hover'))return;
    const bar=carousel.querySelector('.v36-progress i');if(bar){bar.style.animation='none';void bar.offsetWidth;bar.style.animation='v36-progress '+intervalMs+'ms linear forwards';}
    timer=setInterval(()=>{
      if(!carousel.isConnected){pause();return;}
      show(carousel,Number(carousel.dataset.current||0)+1);
    },intervalMs);
  }
  function bind(){
    const carousel=document.querySelector('.v24-carousel');
    if(!carousel||carousel===currentCarousel)return;
    currentCarousel=carousel;
    userPaused=false;
    show(carousel,0);
    carousel.querySelector('[data-v24-prev]')?.addEventListener('click',()=>{show(carousel,Number(carousel.dataset.current||0)-1);start(carousel)});
    carousel.querySelector('[data-v24-next]')?.addEventListener('click',()=>{show(carousel,Number(carousel.dataset.current||0)+1);start(carousel)});
    carousel.addEventListener('mouseenter',pause);
    carousel.addEventListener('mouseleave',()=>start(carousel));
    carousel.addEventListener('focusin',pause);
    carousel.addEventListener('focusout',()=>start(carousel));
    carousel.querySelector('[data-v24-toggle]')?.addEventListener('click',event=>{userPaused=!userPaused;const button=event.currentTarget;const en=document.documentElement.lang==='en';button.textContent=userPaused?'▶':'Ⅱ';button.setAttribute('aria-pressed',String(userPaused));button.setAttribute('aria-label',userPaused?(en?'Resume slideshow':'استئناف عرض الصور'):(en?'Pause slideshow':'إيقاف عرض الصور مؤقتًا'));carousel.querySelector('.v36-progress i').style.animationPlayState=userPaused?'paused':'running';userPaused?pause():start(carousel)});
    carousel.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();show(carousel,Number(carousel.dataset.current||0)+(event.key==='ArrowRight'?1:-1));start(carousel)});
    let touchX=null;carousel.addEventListener('touchstart',event=>{touchX=event.changedTouches[0]?.clientX??null},{passive:true});carousel.addEventListener('touchend',event=>{if(touchX===null)return;const delta=(event.changedTouches[0]?.clientX??touchX)-touchX;touchX=null;if(Math.abs(delta)>45){show(carousel,Number(carousel.dataset.current||0)+(delta<0?1:-1));start(carousel)}},{passive:true});
    start(carousel);
  }
  function openVideo(){
    const source=String(window.CMS?.heroVimeo||'');
    const match=source.match(/(?:vimeo\.com\/(?:video\/)?|^)(\d{6,12})(?:\D|$)/);
    const title=document.documentElement.lang==='en'?'Meet Alsaeed':'تعرف على السعيد';
    if(!match)return;
    const media=`<iframe src="https://player.vimeo.com/video/${match[1]}?title=0&byline=0&portrait=0&dnt=1" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${title}"></iframe>`;
    window.APP?.modal?.(`<div class="v24-video-modal"><h2>${title}</h2><div class="v24-video-frame">${media}</div><button class="btn o" data-close>${document.documentElement.lang==='en'?'Close':'إغلاق'}</button></div>`);
  }
  document.addEventListener('click',event=>{if(event.target.closest('[data-v24-video]'))openVideo();const play=event.target.closest('[data-v35-play]');if(play){const source=String(window.CMS?.heroVimeo||'');const match=source.match(/(?:vimeo\.com\/(?:video\/)?|^)(\d{6,12})(?:\D|$)/);if(!match)return;const box=play.parentElement;const frame=document.createElement('iframe');frame.src='https://player.vimeo.com/video/'+match[1]+'?autoplay=1&title=0&byline=0&portrait=0&dnt=1';frame.title=document.documentElement.lang==='en'?'Alsaeed introduction':'فيديو السعيد التعريفي';frame.allow='autoplay; fullscreen; picture-in-picture';frame.allowFullscreen=true;box.replaceChildren(frame)}});
  document.addEventListener('input',event=>{if(event.target?.id!=='v36CatalogSearch')return;const query=event.target.value.trim().toLocaleLowerCase();const cards=[...document.querySelectorAll('.v37-program-card')];let visible=0,packages=0;cards.forEach(card=>{const match=(card.dataset.v37Search||card.textContent).toLocaleLowerCase().includes(query);card.hidden=!match;if(match){visible++;packages+=Number(card.querySelector('.v37-count')?.textContent.match(/\d+/)?.[0]||0)}});const count=document.getElementById('v36CatalogCount');if(count)count.textContent=visible+' '+(document.documentElement.lang==='en'?(visible===1?'program':'programs'):'برامج')+' · '+packages+' '+(document.documentElement.lang==='en'?(packages===1?'package':'packages'):'باقة');const empty=document.getElementById('v36CatalogEmpty');if(empty)empty.hidden=visible!==0});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else start(currentCarousel)});
  reduceMotion.addEventListener?.('change',()=>start(currentCarousel));
  function init(){
    bind();
    const app=document.getElementById('app');
    if(app)new MutationObserver(bind).observe(app,{childList:true});
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();
