/* Original Al Saeed learning workspace. Presentation over the canonical video engine;
   no completion, score, bookmark or XP writes occur here. */
(function(){'use strict';
let active=null;
const lang=()=>window.I18?.lang==='en'?'en':'ar';
const tx=(ar,en)=>lang()==='en'?en:ar;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const owner=()=>window.APP?.me?.()?.id;
const allItems=groups=>groups.flatMap(g=>[...(g.items||[]),...allItems(g.children||[])]);
function alive(s){return active===s&&s.root.isConnected&&owner()===s.owner&&window.APP?.token===s.token;}
function currentGroup(groups,index){for(const g of groups){const inner=currentGroup(g.children||[],index);if(inner)return inner;if((g.items||[]).some(x=>x.i===index))return g;}return null;}
function unmount(){if(!active)return;clearInterval(active.timer);document.removeEventListener('learning-progress-updated',active.updated);window.removeEventListener('hashchange',active.back);active=null;}
function status(s){
 if(!alive(s)){if(active===s)window.InteractiveVideo?.close();return;}
 const view=window.APP.progressView?.(s.pkgId)||{loaded:false},pr=window.APP.prog(s.pkgId),group=currentGroup(s.groups,s.lessonIdx),items=group?allItems([group]):s.order.map(i=>({i}));
 const done=items.filter(x=>pr.lessons?.[x.i]===true).length,percent=items.length?Math.round(done/items.length*100):0;
 s.module.textContent=(group?(lang()==='en'?(group.en||group.title):group.title):tx('دروس الدورة','Course lessons'))||tx('دروس الدورة','Course lessons');
 const known=!!s.owner&&!!view.loaded;
 if(known){s.progress.value=percent;s.progress.setAttribute('aria-valuetext',done+' / '+items.length);s.count.textContent=done+' / '+items.length+' · '+percent+'%';}else{s.progress.removeAttribute('value');s.progress.setAttribute('aria-valuetext',tx('التقدم غير متاح','Progress unavailable'));s.count.textContent='—';}
 s.sync.textContent=!s.owner?tx('معاينة مجانية · سجّل الدخول لحفظ تقدمك','Free preview · sign in to save your progress'):s.syncError?tx('تعذّرت المزامنة. حاول مرة أخرى عند الاتصال.','Sync failed. Try again when connected.'):view.pending?tx('لم تتم المزامنة بعد. احتفظ بهذا الجهاز حتى ينجح الحفظ.','Not synced yet. Keep this device until saving succeeds.'):view.error?tx('تعذّر تحديث التقدم. أعد المزامنة عند الاتصال.','Progress could not refresh. Retry when connected.'):view.loaded?tx('محفوظ بحسابك · تابع من أي جهاز','Saved to your account · continue on any device'):tx('جارٍ تحميل التقدم المحفوظ…','Loading saved progress…');
 s.retry.hidden=!s.owner||(!view.pending&&!view.error&&!s.syncError);
 s.root.querySelectorAll('[data-iv-group]').forEach(node=>{const rows=[...node.querySelectorAll('[data-go]')],n=rows.filter(r=>pr.lessons?.[r.dataset.go]===true).length;let badge=node.querySelector(':scope > summary .lw-group-progress');if(!badge){badge=el('span','lw-group-progress');node.querySelector('summary').append(badge);}badge.textContent=known?n+'/'+rows.length:'—';});
 s.root.querySelectorAll('[data-go]').forEach(row=>row.classList.toggle('watched',known&&pr.lessons?.[row.dataset.go]===true));
}
async function points(s){if(!alive(s))return;if(!s.owner){s.points.textContent=tx('سجّل الدخول لعرض نقاطك','Sign in to view your points');return;}if(s.busy){s.refreshPending=true;return;}s.busy=true;try{const data=await window.APP.api('/learning-points/'+encodeURIComponent(s.pkgId),{cache:'no-store'});if(alive(s))s.points.textContent=Number.isFinite(data?.self?.points)?data.self.points+' '+tx('نقطة','points'):tx('النقاط غير متاحة','Points unavailable');}catch{if(alive(s))s.points.textContent=tx('النقاط غير متاحة الآن','Points unavailable now');}finally{s.busy=false;if(s.refreshPending&&alive(s)){s.refreshPending=false;points(s);}}}
function mount(config){
 unmount();const s={...config,owner:owner(),token:window.APP?.token};active=s;
 const root=s.root;root.classList.add('learning-workspace');root.dir=lang()==='en'?'ltr':'rtl';
 const side=root.querySelector('.iv-side'),bar=root.querySelector('.iv-bar');if(!side||!bar){unmount();return;}
 side.parentElement.insertBefore(side,root.querySelector('.iv-stage'));
 const toggle=el('button','lw-module-toggle',tx('محاور الدورة','Course modules'));toggle.type='button';toggle.setAttribute('aria-controls','lwModules');toggle.setAttribute('aria-expanded','false');side.id='lwModules';bar.insertBefore(toggle,bar.lastElementChild);
 toggle.onclick=()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));root.classList.toggle('lw-modules-open',open);};
 side.addEventListener('keydown',event=>{if(event.key==='Escape'){root.classList.remove('lw-modules-open');toggle.setAttribute('aria-expanded','false');toggle.focus();}});
 const dock=el('footer','lw-dock'),summary=el('div','lw-module-summary');s.module=el('strong');s.count=el('span','lw-module-count');s.progress=el('progress');s.progress.max=100;s.progress.setAttribute('aria-label',tx('تقدم المحور الحالي','Current module progress'));summary.append(s.module,s.count,s.progress);
 const account=el('div','lw-account-progress');s.points=el('strong','lw-points',tx('جارٍ تحميل النقاط…','Loading points…'));s.sync=el('small','lw-sync');s.sync.setAttribute('role','status');s.retry=el('button','btn o',tx('إعادة المزامنة','Retry sync'));s.retry.type='button';s.retry.onclick=async()=>{if(!alive(s))return;s.retry.disabled=true;s.syncError=false;try{await window.APP.flushProgress?.();if(!alive(s))return;await window.APP.loadProgressFor?.(s.pkgId,true);if(alive(s)){status(s);points(s);}}catch{if(alive(s)){s.syncError=true;status(s);}}finally{if(alive(s))s.retry.disabled=false;}};account.append(s.points,s.sync,s.retry);
 const nav=el('nav','lw-step-nav');nav.setAttribute('aria-label',tx('التنقل بين الدروس','Lesson navigation'));['ivPrev','ivNext'].forEach(id=>{const b=root.querySelector('#'+id);if(b)nav.append(b);});dock.append(summary,account,nav);root.append(dock);
 const links=el('div','lw-continue-links');const library=document.querySelector('.package-primary-nav [data-lt="library"]');if(library){const b=el('button','btn o',tx('المكتبة والأنشطة التطبيقية','Library & practical activities'));b.type='button';b.onclick=()=>{if(!alive(s))return;window.InteractiveVideo.close();library.click();};links.append(b);root.querySelector('.iv-materials')?.append(links);}
 s.updated=event=>{if(event.detail?.packageId!==s.pkgId)return;status(s);points(s);};document.addEventListener('learning-progress-updated',s.updated);
 s.back=()=>window.InteractiveVideo?.close();window.addEventListener('hashchange',s.back);
 s.timer=setInterval(()=>status(s),1000);status(s);points(s);
}
window.LearningWorkspace={mount,unmount,refresh(){if(active)status(active);}};
})();
