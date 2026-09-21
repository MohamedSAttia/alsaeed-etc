/* Al-Saeed Experience Layer V21 — progressive enhancement only */
(() => {
  'use strict';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function mountChrome() {
    if (!document.querySelector('.v21-skip')) {
      const skip = document.createElement('a');
      skip.className = 'v21-skip'; skip.href = '#app'; skip.textContent = 'انتقل إلى المحتوى';
      document.body.prepend(skip);
    }
    if (!document.querySelector('.v21-progress')) {
      document.body.insertAdjacentHTML('afterbegin','<div class="v21-progress" aria-hidden="true"><i></i></div><div class="v21-ambient" aria-hidden="true"><i></i><i></i><i></i></div>');
    }
    const path = location.pathname.toLowerCase();
    document.body.classList.toggle('v21-grc', path.includes('grc'));
    document.body.classList.toggle('v21-pmp-admin', path.includes('pmp-admin'));
    document.body.classList.toggle('v21-pmp', /\/pmp\/?$/.test(path));
  }

  let revealObserver;
  function setupReveal() {
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    if (!revealObserver) revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('v21-in');
      revealObserver.unobserve(entry.target);
    }), { threshold: .1, rootMargin: '0px 0px -38px' });

    const targets = $$('.card,.course-vcard,.mode-c,.sec-c,.course-about-card,.akpi,.apanel,.resource-row,.activity-card')
      .filter(el => !el.classList.contains('v21-bound'));
    targets.forEach((el, i) => {
      el.classList.add('v21-bound','v21-reveal');
      el.style.setProperty('--v21-i', String(i % 8));
      revealObserver.observe(el);
    });
  }

  function decorateHero() {
    const media = $('.hero-media-v8');
    if (!media || media.dataset.v21) return;
    media.dataset.v21 = '1';
    media.insertAdjacentHTML('beforeend',
      '<div class="v21-float-stat one" aria-hidden="true"><i>✓</i><span><b>تعلّم قابل للقياس</b><small>تحليل حسب نطاق الاختبار</small></span></div>' +
      '<div class="v21-float-stat two" aria-hidden="true"><i>↗</i><span><b>تقدّم مستمر</b><small>فيديو · تطبيق · محاكاة</small></span></div>');
  }

  function decorateLists() {
    $$('.grid,.showcase-grid,.modes-g,.sec3').forEach(group => {
      if (group.dataset.v21) return;
      group.dataset.v21 = '1'; group.classList.add('v21-stagger');
      [...group.children].forEach((child, i) => child.style.setProperty('--v21-i', String(i % 10)));
    });
  }

  function decorate() {
    decorateHero(); decorateLists(); setupReveal();
  }

  function onScroll() {
    const root = document.documentElement;
    const total = Math.max(1, root.scrollHeight - innerHeight);
    const bar = $('.v21-progress>i');
    if (bar) bar.style.width = Math.min(100, Math.max(0, scrollY / total * 100)) + '%';
  }

  function watchApp() {
    const app = $('#app') || document.body;
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(decorate);
    });
    observer.observe(app, { childList:true, subtree:true });
  }

  function boot() {
    mountChrome(); decorate(); watchApp(); onScroll();
    addEventListener('scroll', onScroll, { passive:true });
  }
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', boot, { once:true }) : boot();
})();
