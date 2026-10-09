/* Public catalog and navigation. No enrollment, payment, or learning-state writes. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const english = () => window.__lang === 'en';
  const text = (ar, en) => english() ? en : ar;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const title = value => value ? (english() ? value.en || value.ar : value.ar || value.en) || '' : '';
  const normalize = value => String(value ?? '').normalize('NFKD').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').toLocaleLowerCase().trim();
  const params = () => new URLSearchParams(location.hash.split('?')[1] || '');
  const route = () => (location.hash.slice(1) || 'home').split('?')[0];
  const go = value => window.APP?.go ? window.APP.go(value) : (location.hash = value);
  const course = id => (window.COURSES || []).find(c => c.id === id) || {};
  const mode = id => (window.MODES || []).find(m => m.k === id) || {};
  const published = () => (window.PACKAGES || []).filter(p => p.active !== false);
  const langName = key => ({ar:text('العربية','Arabic'),en:text('الإنجليزية','English'),both:text('العربية والإنجليزية','Arabic & English')})[key] || key;
  const price = p => `${new Intl.NumberFormat(english() ? 'en-US' : 'ar-EG', {maximumFractionDigits:2}).format(Number(p.price))} ${escape(p.currency || '')}`;
  const filterKeys = ['q', 'course', 'mode', 'lang', 'sort', 'view'];
  let lastRoute = route();

  function setMenu(open, restoreFocus = false) {
    const nav = $('#nav'), button = $('#burger');
    if (!nav || !button) return;
    nav.classList.toggle('open', open);
    document.body.classList.toggle('public-menu-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? text('إغلاق القائمة','Close menu') : text('فتح القائمة','Open menu'));
    button.textContent = open ? '×' : '☰';
    if (restoreFocus) button.focus();
  }
  function navigation() {
    const nav = $('#nav'), button = $('#burger');
    if (!nav || !button) return;
    nav.setAttribute('aria-label', text('التنقل الرئيسي','Main navigation'));
    button.onclick = () => setMenu(!nav.classList.contains('open'));
    button.setAttribute('aria-controls', 'nav');
    setMenu(nav.classList.contains('open'));
    ['btnLogin','btnReg'].forEach(id => {
      const source = document.getElementById(id);
      if (!source || nav.querySelector('[data-public-account="'+id+'"]')) return;
      const account = document.createElement('button');
      account.type='button'; account.className='nb public-mobile-account';
      account.dataset.publicAccount=id; account.textContent=source.textContent;
      account.onclick=()=>{setMenu(false);source.click();}; nav.appendChild(account);
    });
    $$('#nav [data-r]').forEach(link => {
      if (link.classList.contains('on')) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
    const mega = $('#megaBtn');
    if (mega) {
      mega.setAttribute('aria-expanded', String(!!window.__mega));
      mega.setAttribute('aria-controls', 'megaHost');
    }
    const lang = $('#langBtn');
    if (lang) {
      lang.setAttribute('aria-expanded', String(!!window.__langOpen));
      lang.setAttribute('aria-controls', 'langM');
      lang.setAttribute('aria-label', text('اختيار لغة الموقع','Choose site language'));
    }
    const skip = $('.v21-skip');
    if (skip) {
      skip.textContent = text('انتقل إلى المحتوى','Skip to content');
      skip.onclick = event => { event.preventDefault(); $('#app')?.focus(); $('#app')?.scrollIntoView({block:'start'}); };
    }
    $('#chatLauncher')?.setAttribute('aria-label',text('فتح مساعد السعيد','Open Alsaeed assistant'));
    $('#chatMin')?.setAttribute('aria-label',text('إغلاق المساعد','Close assistant'));
    $('#chatSend')?.setAttribute('aria-label',text('إرسال الرسالة','Send message'));
    $('.wa')?.setAttribute('aria-label',text('تواصل عبر واتساب','Contact us on WhatsApp'));
    const whatsapp=$('.wa .tx');if(whatsapp)whatsapp.textContent=text('تحدّث معنا','Chat with us');
    const resources=$('[data-public-footer="resources"]');if(resources)resources.textContent=text('موارد','Resources');
    const copyright=$('[data-public-footer="copyright"]');if(copyright)copyright.textContent=text('© 2026 السعيد للتعليم والتدريب والخدمات الاستشارية. جميع الحقوق محفوظة.','© 2026 Alsaeed for Education, Training and Consulting. All rights reserved.');
  }

  function bindHomeSearch() {
    const input = $('#v22CourseSearch'), results = $('#v22SearchResults');
    if (!input || !results || input.dataset.publicSearch) return;
    input.dataset.publicSearch = '1';
    input.setAttribute('role','combobox');
    input.setAttribute('aria-autocomplete','list');
    input.setAttribute('aria-controls',results.id);
    input.setAttribute('aria-expanded','false');
    results.setAttribute('role','listbox');
    results.setAttribute('aria-label',text('نتائج البحث عن البرامج','Program search results'));
    let selected = -1, matches = [];
    const close = () => { results.hidden = true; input.setAttribute('aria-expanded','false'); input.removeAttribute('aria-activedescendant'); selected = -1; };
    const choose = index => { if (matches[index]) { close(); go('course/'+matches[index].id); } };
    const highlight = index => {
      if (!matches.length) return;
      selected = (index + matches.length) % matches.length;
      $$('[role="option"]',results).forEach((item,i) => item.setAttribute('aria-selected',String(i===selected)));
      input.setAttribute('aria-activedescendant','publicSearchOption'+selected);
    };
    input.addEventListener('input', () => {
      const q = normalize(input.value); selected = -1;
      input.removeAttribute('aria-activedescendant');
      if (!q) { close(); return; }
      matches = (window.COURSES || []).filter(c => normalize([c.code,c.ar,c.en,c.blurb,c.blurb_en].join(' ')).includes(q)).slice(0,6);
      results.innerHTML = matches.length ? matches.map((c,i) => `<div class="v22-search-item" role="option" aria-selected="false" id="publicSearchOption${i}" data-search-index="${i}"><span dir="ltr">${escape(c.code)}</span><span><b>${escape(title(c))}</b><small>${escape(text(c.en,c.ar))}</small></span><em aria-hidden="true">↗</em></div>`).join('') : `<div class="v22-search-empty" role="status">${text('لا توجد نتائج. جرّب اسم الشهادة أو رمزها.','No matches. Try a certification name or code.')}</div>`;
      results.hidden = false; input.setAttribute('aria-expanded','true');
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key === 'Tab') close();
      if (['ArrowDown','ArrowUp'].includes(event.key) && matches.length) {
        event.preventDefault(); results.hidden = false; input.setAttribute('aria-expanded','true');
        highlight(selected < 0 ? (event.key === 'ArrowDown' ? 0 : matches.length-1) : selected + (event.key === 'ArrowDown' ? 1 : -1));
      }
      if (event.key === 'Enter' && !results.hidden && matches.length) { event.preventDefault(); choose(selected < 0 ? 0 : selected); }
    });
    results.addEventListener('mousedown', event => event.preventDefault());
    results.addEventListener('click', event => { const option = event.target.closest('[data-search-index]'); if (option) choose(Number(option.dataset.searchIndex)); });
    input.addEventListener('blur',close);
  }

  function catalogCard(p) {
    const c = course(p.course), m = mode(p.mode), type = (window.PKG_TYPES || []).find(t => t.k === p.type);
    return `<article class="public-result-card"><div class="public-result-top"><span dir="ltr">${escape(c.code || p.course)}</span><span>${escape(title(type))}</span></div><h3><a href="#pkg/${encodeURIComponent(p.id)}">${escape(title(p) || title(c))}</a></h3><p>${escape(title(c))}</p><div class="public-result-tags"><span>${escape(title(m))}</span><span>${escape(langName(p.lang))}</span>${p.days?`<span>${escape(p.days)} ${text('يوم وصول','days of access')}</span>`:''}</div><div class="public-result-bottom"><strong><bdi>${price(p)}</bdi></strong><a class="btn o sm" href="#pkg/${encodeURIComponent(p.id)}">${text('تفاصيل الباقة','Package details')} <svg class="public-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></a></div></article>`;
  }
  function mountCatalog() {
    const mount = $('#publicCatalogMount');
    if (!mount || mount.dataset.ready) return;
    mount.dataset.ready = '1';
    const packages = published(), state = params();
    const courses = (window.COURSES || []).filter(c => packages.some(p => p.course === c.id));
    const modes = (window.MODES || []).filter(m => packages.some(p => p.mode === m.k));
    mount.innerHTML = `<section class="public-catalog-tools" aria-labelledby="publicCatalogTitle"><div class="public-catalog-intro"><div><span class="eyebrow">${text('خطوتك المهنية القادمة','YOUR NEXT PROFESSIONAL STEP')}</span><h2 id="publicCatalogTitle">${text('اعثر على باقتك بسهولة','Find your learning package')}</h2><p>${text('ابحث باسم الشهادة أو اختر البرنامج وطريقة التعلّم.','Search by certification or choose a program and learning format.')}</p></div><button class="btn o sm" type="button" id="publicShowPackages">${text('عرض كل الباقات','View all packages')} <svg class="public-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></button></div><form id="publicCatalogForm" role="search"><label class="public-search-label" for="publicQuery">${text('البحث عن باقة','Search packages')}<span class="public-search-field"><span aria-hidden="true"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></span><input id="publicQuery" name="q" type="search" autocomplete="off" placeholder="${text('مثال: PMP أو إدارة المخاطر','Try PMP or risk management')}" value="${escape(state.get('q') || '')}"></span></label><div class="public-filter-grid"><label for="publicCourse">${text('البرنامج','Program')}<select name="course" id="publicCourse"><option value="">${text('جميع البرامج','All programs')}</option>${courses.map(c=>`<option value="${escape(c.id)}">${escape(title(c))}</option>`).join('')}</select></label><label for="publicMode">${text('طريقة التعلّم','Learning format')}<select name="mode" id="publicMode"><option value="">${text('جميع الأنماط','All formats')}</option>${modes.map(m=>`<option value="${escape(m.k)}">${escape(title(m))}</option>`).join('')}</select></label><label for="publicLanguage">${text('لغة الباقة','Package language')}<select name="lang" id="publicLanguage"><option value="">${text('جميع اللغات','All languages')}</option>${[...new Set(packages.map(p=>p.lang))].map(lang=>`<option value="${escape(lang)}">${escape(langName(lang))}</option>`).join('')}</select></label></div><div class="public-catalog-actions"><p id="publicResultCount" role="status" aria-live="polite" aria-atomic="true"></p><label for="publicSort">${text('الترتيب','Sort')}<select name="sort" id="publicSort"><option value="">${text('الترتيب الأصلي','Original order')}</option><option value="price-asc">${text('الأقل سعرًا داخل كل عملة','Price: low to high per currency')}</option><option value="price-desc">${text('الأعلى سعرًا داخل كل عملة','Price: high to low per currency')}</option></select></label><button type="button" id="publicClearFilters">${text('مسح الاختيارات','Clear filters')}</button></div></form></section><section id="publicCatalogResults" aria-label="${text('الباقات المطابقة','Matching packages')}" hidden></section>`;
    const form = $('#publicCatalogForm',mount), results = $('#publicCatalogResults',mount), browse = $('[data-catalog-browse]');
    let limit = 12, showAll = state.get('view') === 'packages';
    ['course','mode','lang','sort'].forEach(key => { const control = form.elements.namedItem(key); control.value = state.get(key) || ''; });
    function update(sync = false) {
      const values = Object.fromEntries(['q','course','mode','lang','sort'].map(key=>[key,form.elements.namedItem(key).value]));
      const active = showAll || Object.values(values).some(Boolean);
      const query = normalize(values.q);
      let matches = published().filter(p => (!values.course || p.course===values.course) && (!values.mode || p.mode===values.mode) && (!values.lang || p.lang===values.lang) && (!query || normalize([p.ar,p.en,course(p.course).ar,course(p.course).en,course(p.course).code,title(mode(p.mode))].join(' ')).includes(query)));
      if (values.sort) matches = [...matches].sort((a,b) => String(a.currency||'').localeCompare(String(b.currency||'')) || (Number(a.price)-Number(b.price))*(values.sort==='price-desc'?-1:1));
      $('#publicResultCount',mount).textContent = active ? `${matches.length} ${text('باقة مطابقة','matching packages')}` : `${packages.length} ${text('باقة منشورة، أو استكشف المجالات أدناه','published packages, or explore the fields below')}`;
      $('#publicClearFilters',mount).hidden = !active;
      results.hidden = !active;
      if (browse) browse.hidden = active;
      if (active) {
        results.innerHTML = matches.length ? `<div class="public-results-grid">${matches.slice(0,limit).map(catalogCard).join('')}</div>${matches.length>limit?`<button type="button" class="btn o public-load-more" id="publicLoadMore">${text('عرض المزيد','Show more')} (${Math.min(12,matches.length-limit)})</button>`:''}` : `<div class="public-empty"><span aria-hidden="true"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></span><h3>${text('لم نجد باقة بهذه الاختيارات','No packages match these choices')}</h3><p>${text('جرّب كلمة أخرى أو امسح الاختيارات لعرض الباقات المتاحة.','Try another search or clear the filters to explore available packages.')}</p><button class="btn p" type="button" data-clear-catalog>${text('عرض الباقات المتاحة','Explore available packages')}</button><a href="#contact">${text('استفسر عن برنامج مناسب','Ask about a suitable program')} ↗</a></div>`;
      }
      if (sync) {
        const next = params();
        filterKeys.forEach(key=>next.delete(key));
        Object.entries(values).forEach(([key,value])=>{if(value)next.set(key,value);});
        if (showAll) next.set('view','packages');
        const nextRoute='programs'+(next.size?'?'+next.toString():'');
        if(window.APP?.replaceRoute)window.APP.replaceRoute(nextRoute);
        else history.replaceState(history.state,'','#'+nextRoute);
      }
    }
    const clear = () => { ['q','course','mode','lang','sort'].forEach(key=>{form.elements.namedItem(key).value='';}); showAll=false; limit=12; update(true); $('#publicQuery',mount).focus(); };
    form.addEventListener('submit',event=>{event.preventDefault();showAll=true;update(true);});
    form.addEventListener('input',()=>{limit=12;update(true);});
    form.addEventListener('change',()=>{limit=12;update(true);});
    $('#publicClearFilters',mount).onclick=clear;
    $('#publicShowPackages',mount).onclick=()=>{showAll=true;update(true);};
    results.addEventListener('click',event=>{
      if(event.target.closest('[data-clear-catalog]'))clear();
      if(event.target.closest('#publicLoadMore')) { const previous=limit;limit+=12;update();const link=$$('.public-result-card h3 a',results)[previous];link?.focus(); }
    });
    update();
  }

  function refresh() {
    navigation(); bindHomeSearch(); mountCatalog();
    const advisor = $('.v24-consult-link');
    if (advisor && !advisor.querySelector('svg.public-arrow')) {
      const tail = advisor.lastChild;
      if (tail?.nodeType === Node.TEXT_NODE) tail.textContent = tail.textContent.replace(/\s*↗\s*$/, ' ');
      const arrow = document.createElementNS('http://www.w3.org/2000/svg','svg');
      arrow.setAttribute('class','public-arrow'); arrow.setAttribute('width','18'); arrow.setAttribute('height','18');
      arrow.setAttribute('viewBox','0 0 24 24'); arrow.setAttribute('fill','none');
      arrow.setAttribute('stroke','currentColor'); arrow.setAttribute('stroke-width','1.8'); arrow.setAttribute('aria-hidden','true');
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d','M6 18 18 6M6 6h12v12'); arrow.append(path); advisor.append(arrow);
    }
    const current = route();
    if (current !== lastRoute) {
      lastRoute = current; setMenu(false);
      const heading = $('#app h1');
      if (heading) { heading.tabIndex=-1; heading.focus({preventScroll:true}); }
    }
  }
  document.addEventListener('click',event=>{
    const resultLink = event.target.closest('.public-result-card a[href^="#pkg/"]');
    if (resultLink && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault(); go(resultLink.getAttribute('href').slice(1));
      window.scrollTo({top:0,left:0,behavior:'instant'});
    }
    if (!event.target.closest('#nav,#burger')) setMenu(false);
    if (event.target.closest('#nav [data-r]')) setMenu(false);
  });
  document.addEventListener('keydown',event=>{
    if (event.key !== 'Escape') return;
    if ($('#nav')?.classList.contains('open')) { event.preventDefault(); setMenu(false,true); }
    if (window.__mega) { window.__mega=false; window.APP?.render(); $('#megaBtn')?.focus(); }
    if (window.__langOpen) { window.__langOpen=false; window.APP?.render(); $('#langBtn')?.focus(); }
  });
  const mobile = matchMedia('(max-width:1180px)');
  mobile.addEventListener?.('change',()=>setMenu(false));
  window.PUBLIC_EXPERIENCE = {refresh, bindHomeSearch, normalize};
  const boot = () => { refresh(); const app=$('#app'); if(app)new MutationObserver(refresh).observe(app,{childList:true}); };
  document.readyState==='loading' ? addEventListener('DOMContentLoaded',boot,{once:true}) : boot();
})();
