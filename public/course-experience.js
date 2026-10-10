/* Course browsing and package decision controls. No API, purchase or learner-state writes. */
(() => {
  'use strict';
  const text=(ar,en)=>window.__lang==='en'?en:ar;
  let sections=[],links=[],scheduled=false,lastPage=null;
  function jump(target){
    if(!target)return;
    if(target.closest('details')&&!target.closest('details').open)target.closest('details').open=true;
    const heading=target.querySelector('h2,h3')||target;
    heading.tabIndex=-1;heading.focus({preventScroll:true});
    target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }
  function updateCurrent(){
    scheduled=false;if(!sections.length)return;
    const offset=(document.querySelector('.hdr')?.getBoundingClientRect().height||82)+(document.querySelector('.cd-section-nav')?.getBoundingClientRect().height||64)+30;
    let current=sections[0];for(const section of sections)if(section.getBoundingClientRect().top<=offset)current=section;
    for(const link of links){if(link.dataset.courseJump===current.id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');}
  }
  function refresh(){
    document.querySelectorAll('[data-saudi-label]').forEach(el=>el.textContent=text('السعودية','Saudi Arabia'));
    document.querySelectorAll('[data-saudi-contact]').forEach(el=>el.setAttribute('aria-label',text('اتصل بالسعيد في السعودية','Call AlSaeed in Saudi Arabia')));
    document.querySelectorAll('[data-saudi-whatsapp]').forEach(el=>{el.textContent=text('واتساب السعودية','Saudi WhatsApp');el.setAttribute('aria-label',text('واتساب السعيد في السعودية','AlSaeed WhatsApp in Saudi Arabia'));});
    const app=document.getElementById('app');if(!app)return;
    const course=app.querySelector('[data-course-experience]');
    const packageHero=app.querySelector('.v38-package-hero[data-language-package]');
    document.documentElement.classList.toggle('course-design-document',!!(course||packageHero));
    document.body.classList.toggle('course-design-page-active',!!course);
    document.body.classList.toggle('package-design-page-active',!!packageHero);
    if((course||packageHero)===lastPage)return;
    lastPage=course||packageHero;
    links=[...app.querySelectorAll('.cd-section-nav [data-course-jump]')];
    sections=links.map(link=>document.getElementById(link.dataset.courseJump)).filter(Boolean);
    app.querySelectorAll('[data-course-jump]').forEach(button=>button.setAttribute('aria-controls',button.dataset.courseJump));
    updateCurrent();
    if(!packageHero)return;
    const pkg=(window.PACKAGES||[]).find(p=>p.id===packageHero.dataset.languagePackage);
    const c=pkg&&(window.COURSES||[]).find(c=>c.id===pkg.course);
    const media=packageHero.querySelector('.package-exp-promo-in-hero,.package-exp-hero-art');
    if(c&&media&&window.courseScheduleFacts&&!media.closest('.cd-package-media')){
      const wrap=document.createElement('div');wrap.className='cd-package-media';media.replaceWith(wrap);wrap.append(media);
      const facts=document.createElement('dl');facts.className='cd-image-facts';
      window.courseScheduleFacts(c,pkg).forEach(f=>{const row=document.createElement('div'),label=document.createElement('dt'),value=document.createElement('dd');row.dataset.scheduleFact=f.key;label.textContent=f.label;value.textContent=f.value;row.append(label,value);facts.append(row);});wrap.append(facts);
    }
    const card=app.querySelector('.pd-hero > .side > .card');
    if(!card)return;
    card.id='cd-package-enrollment';card.style.scrollMarginTop='calc(var(--hdr,82px) + 86px)';
    const heading=document.createElement('h2');heading.className='cd-purchase-heading';heading.textContent=text('خيارات الاشتراك','Enrollment options');card.prepend(heading);
    const coupon=card.querySelector('label[for="promoIn"]');if(coupon)coupon.textContent=text('لديك رمز خصم؟','Have a discount code?');
    const input=card.querySelector('#promoIn');if(input)input.placeholder=text('أدخل رمز الخصم','Enter discount code');
    const apply=card.querySelector('#promoGo');if(apply)apply.textContent=text('تطبيق','Apply');
    const buy=card.querySelector('[data-buy]');if(buy)buy.textContent=text('متابعة الاشتراك','Continue to enrollment');
    const access=card.querySelector('[data-r^="learn/"]');if(access)access.textContent=text('ادخل إلى محتواك','Access your content');
    const bar=document.createElement('div');bar.className='cd-mobile-action cd-package-action';
    const copy=document.createElement('div'),label=document.createElement('span'),price=document.createElement('strong');
    label.textContent=text('الباقة المختارة','Selected package');
    const amount=card.querySelector('.pk-price>b'),currency=card.querySelector('.pk-price>.cur');
    price.textContent=[amount?.textContent,currency?.textContent].filter(Boolean).join(' ');price.dir='ltr';
    copy.append(label,price);
    const button=document.createElement('button');button.type='button';button.className='btn p';button.dataset.packagePriceJump='';button.textContent=access?text('الدخول للمحتوى','Open content'):text('خيارات الاشتراك','Enrollment options');button.setAttribute('aria-controls',card.id);
    bar.append(copy,button);app.append(bar);
  }
  document.addEventListener('click',event=>{
    const control=event.target.closest('[data-course-jump],[data-package-price-jump]');
    if(!control)return;
    const target=document.getElementById(control.hasAttribute('data-package-price-jump')?'cd-package-enrollment':control.dataset.courseJump);
    if(target){event.preventDefault();jump(target);}
  });
  addEventListener('scroll',()=>{if(!scheduled&&sections.length){scheduled=true;requestAnimationFrame(updateCurrent);}},{passive:true});
  addEventListener('resize',updateCurrent,{passive:true});
  const start=()=>{const app=document.getElementById('app');if(app)new MutationObserver(refresh).observe(app,{childList:true});refresh();};
  window.COURSE_EXPERIENCE={refresh};
  document.readyState==='loading'?addEventListener('DOMContentLoaded',start,{once:true}):start();
})();
