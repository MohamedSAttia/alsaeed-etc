/* Alsaeed Platform V22 — progressive UI enhancements; no catalog mutation. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const languageMeta = {
    ar:   { icon:'ع', title:'العربية فقط', sub:'المحتوى والاختبارات باللغة العربية' },
    en:   { icon:'EN', title:'English Only', sub:'Content and exams in English' },
    both: { icon:'عـ EN', title:'العربية + English', sub:'التبديل بين اللغتين في أي وقت' }
  };

  function currentCourseId() {
    const m = (location.hash || '').match(/^#course\/([^?]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function money(p) {
    const n = Number(p.price || 0);
    return `${n.toLocaleString('en-US')} ${esc(p.currency || 'USD')}`;
  }

  function addLanguageChooser() {
    if ($('.v25-decision')) return;
    const courseId = currentCourseId();
    const shell = $('.course-about-shell');
    if (!courseId || !shell || $('.v22-enroll', shell)) return;
    const packages = (window.PACKAGES || []).filter(p => p.course === courseId && p.active !== false);
    if (!packages.length) return;
    const bestByLanguage = {};
    Object.keys(languageMeta).forEach(lang => {
      const list = packages.filter(p => p.lang === lang).sort((a,b) => Number(a.price||0)-Number(b.price||0));
      bestByLanguage[lang] = list[0] || null;
    });
    const preferred = bestByLanguage.both || bestByLanguage.ar || bestByLanguage.en || packages[0];
    const panel = document.createElement('aside');
    panel.className = 'v22-enroll';
    panel.setAttribute('aria-label', 'اختيار لغة الباقة');
    panel.innerHTML = `
      <div class="v22-enroll-head"><span class="v22-enroll-icon">🌐</span><div>
        <h3>اختر لغة دراستك</h3><p>حدد النسخة الأنسب لك قبل الاشتراك</p>
      </div></div>
      <div class="v22-langs">
        ${Object.entries(languageMeta).map(([lang,meta]) => {
          const p = bestByLanguage[lang];
          return `<button class="v22-lang ${p && p.id===preferred.id?'active':''}" ${p?'':`disabled`} data-v22-package="${p?esc(p.id):''}">
            <span class="v22-flag">${meta.icon}</span><span><b>${meta.title}</b><small>${p?meta.sub:'ستتوفر قريبًا'}</small></span>
            <span class="v22-price">${p?'من '+money(p):'قريبًا'}</span>
          </button>`;
        }).join('')}
      </div>
      <div class="v22-enroll-note">تظهر خيارات اللغة المنشورة فقط. راجع اللغة والمحتوى في صفحة الباقة قبل الاشتراك.</div>
      <button class="v22-enroll-cta" data-v22-go="${esc(preferred.id)}">عرض الباقة والاشتراك</button>
      <div class="v22-trust"><span>✓ دفع آمن</span><span>✓ وصول فوري</span><span>✓ دعم مباشر</span></div>`;
    shell.appendChild(panel);
    panel.addEventListener('click', event => {
      const option = event.target.closest('[data-v22-package]');
      if (option && option.dataset.v22Package) {
        panel.querySelectorAll('.v22-lang').forEach(x => x.classList.remove('active'));
        option.classList.add('active');
        $('[data-v22-go]', panel).dataset.v22Go = option.dataset.v22Package;
      }
      const go = event.target.closest('[data-v22-go]');
      if (go && go.dataset.v22Go) location.hash = `#pkg/${go.dataset.v22Go}`;
    });
  }

  function setRouteClass() {
    document.body.dataset.route = (location.hash.replace(/^#/, '').split('/')[0] || 'home').split('?')[0];
  }

  function bindCourseSearch() {
    window.PUBLIC_EXPERIENCE?.bindHomeSearch();
  }

  function enhance() { setRouteClass(); addLanguageChooser(); bindCourseSearch(); }
  let queued = false;
  const schedule = () => {
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; enhance(); });
  };
  addEventListener('hashchange', schedule);
  addEventListener('DOMContentLoaded', () => {
    schedule();
    const app = document.getElementById('app');
    if (app) new MutationObserver(schedule).observe(app, {childList:true, subtree:false});
  });
})();
