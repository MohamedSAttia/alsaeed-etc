/* One in-package Vimeo player. Keep unlisted-video hashes and surface loading failures. */
(() => {
  'use strict';
  let sdkPromise;
  const say=(ar,en)=>window.__lang==='en'?en:ar;
  function identity(value) {
    const raw=String(value||'').trim();
    const numeric=raw.match(/^(\d{6,12})(?:\?h=([a-zA-Z0-9]+))?$/);
    if(numeric)return {id:numeric[1],hash:numeric[2]||''};
    try {
      const url=new URL(raw);
      if(url.protocol!=='https:'||!['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(url.hostname))return null;
      const parts=url.pathname.split('/').filter(Boolean),i=parts.findIndex(x=>/^\d{6,12}$/.test(x));
      if(i<0)return null;
      const hash=url.searchParams.get('h')||parts[i+1]||'';
      if(hash&&!/^[a-zA-Z0-9]+$/.test(hash))return null;
      return {id:parts[i],hash};
    }catch{return null;}
  }
  function embedUrl(value) {
    const data=identity(value);if(!data)return '';
    const url=new URL('https://player.vimeo.com/video/'+data.id);
    if(data.hash)url.searchParams.set('h',data.hash);
    for(const [k,v] of Object.entries({title:'0',byline:'0',portrait:'0',dnt:'1',responsive:'1'}))url.searchParams.set(k,v);
    return url.href;
  }
  function storedValue(value){const data=identity(value);return data?data.id+(data.hash?'?h='+data.hash:''):null;}
  function sdk() {
    if(window.Vimeo?.Player)return Promise.resolve(window.Vimeo);
    if(sdkPromise)return sdkPromise;
    sdkPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://player.vimeo.com/api/player.js';
      script.onload=()=>window.Vimeo?.Player?resolve(window.Vimeo):reject(Error('SDK unavailable'));
      script.onerror=()=>reject(Error('SDK unavailable'));document.head.append(script);
    }).catch(error=>{sdkPromise=null;throw error;});
    return sdkPromise;
  }
  function attach(frame,onEnded) {
    if(!frame)return;
    const modal=frame.closest('.mdl');modal?.classList.add('lesson-video-modal');
    const stage=frame.parentElement;stage.classList.add('lesson-video-stage');
    const status=document.createElement('div');status.className='lesson-video-status';status.setAttribute('role','status');
    status.textContent=say('جارٍ تجهيز الفيديو…','Preparing your video…');stage.append(status);
    const help=document.createElement('div');help.className='lesson-video-help';help.hidden=true;stage.after(help);
    let player,timer,disposed=false;const source=frame.src;
    const fail=()=>{
      if(disposed)return;clearTimeout(timer);status.hidden=true;help.hidden=false;help.replaceChildren();
      const message=document.createElement('p');message.textContent=say('تعذّر تحميل الفيديو. أعد المحاولة. إذا استمرت المشكلة، يحتاج المدرب إلى مراجعة رابط الفيديو وصلاحية تضمينه على هذا الموقع.','The video could not load. Retry. If the problem continues, the trainer needs to check the video link and its embedding permissions for this site.');
      const retry=document.createElement('button');retry.type='button';retry.className='btn p';retry.textContent=say('إعادة تحميل الفيديو','Reload video');
      retry.onclick=()=>{const replacement=frame.cloneNode();replacement.src=source;frame.replaceWith(replacement);status.remove();help.remove();attach(replacement,onEnded);};
      help.append(message,retry);
    };
    async function start(){
      timer=setTimeout(fail,18000);
      try{
        const Vimeo=await sdk();if(disposed||!frame.isConnected)return;
        player=new Vimeo.Player(frame);
        player.on('error',fail);
        player.on('ended',()=>{if(!disposed&&frame.isConnected)onEnded?.();});
        await player.ready();if(disposed)return;clearTimeout(timer);status.hidden=true;help.hidden=true;
      }catch{fail();}
    }
    const observer=new MutationObserver(()=>{if(frame.isConnected)return;disposed=true;clearTimeout(timer);observer.disconnect();player?.destroy().catch(()=>{});});
    observer.observe(document.body,{childList:true,subtree:true});start();
  }
  window.LessonVideo={embedUrl,storedValue,attach};
})();
