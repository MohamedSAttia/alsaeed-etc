/* Presentation-only package shell. Existing package controls keep their handlers and data. */
(() => {
  'use strict';
  const ORDER = ['plan', 'content', 'exams', 'resources', 'flash', 'activities', 'games', 'workspace', 'cert'];
  const LABELS = {
    plan: ['الخطة والمتابعة', 'Plan & follow-up'],
    content: ['المحتوى والفيديوهات', 'Content & videos'],
    exams: ['الاختبارات', 'Assessments'],
    resources: ['الملفات', 'Files'],
    flash: ['بطاقات المراجعة', 'Flash cards'],
    activities: ['الأنشطة والتمارين', 'Activities'],
    games: ['الألعاب التعليمية', 'Learning games'],
    workspace: ['التطبيق العملي', 'Practical application'],
    cert: ['الشهادة', 'Certificate']
  };
  const english = () => window.__lang === 'en';
  const text = (ar, en) => english() ? en : ar;
  const label = (key, pkg) => {
    if (key === 'content' && !pkg?.kinds?.includes('video')) return text('المحتوى المقروء', 'Reading');
    return LABELS[key]?.[english() ? 1 : 0] || key;
  };
  const make = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value) node.textContent = value;
    return node;
  };
  let lastHero = null;
  let pendingFocus = null;

  function scrollToSection(target) {
    if (!target) return;
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  function addJump(nav, target, title) {
    const button = make('button', 'package-exp-jump', title);
    button.type = 'button';
    button.setAttribute('aria-controls', target.id);
    button.addEventListener('click', () => scrollToSection(target));
    nav.append(button);
    return button;
  }

  function enhanceDetail(app, hero) {
    const detail = app.querySelector('.pd-hero');
    if (!detail) return;
    detail.classList.add('package-exp-detail');
    const main = detail.firstElementChild;
    const headings = [...main.children].filter(node => /^H[2-4]$/.test(node.tagName));
    const navWrap = make('div', 'wrap package-exp-overview');
    const nav = make('nav', 'package-exp-outline');
    nav.setAttribute('aria-label', text('أقسام تفاصيل الباقة', 'Package details sections'));
    navWrap.append(make('p', 'package-exp-eyebrow', text('استكشف الباقة', 'EXPLORE THIS PACKAGE')), nav);
    headings.forEach((heading, index) => {
      heading.id ||= 'package-detail-section-' + index;
      heading.classList.add('package-exp-heading');
      heading.setAttribute('aria-level', '2');
      addJump(nav, heading, heading.textContent.trim());
    });
    const compare = app.querySelector('.v32-compare');
    if (compare) {
      compare.id ||= 'package-detail-compare';
      addJump(nav, compare, text('قارن الباقات', 'Compare packages'));
      const table = compare.querySelector('.v32-compare-scroll');
      if (table) {
        table.tabIndex = 0;
        table.setAttribute('role', 'region');
        table.setAttribute('aria-labelledby', 'v32-compare-title');
      }
    }
    hero.after(navWrap);
    const coupon = detail.querySelector('#promoIn');
    if (coupon) {
      const couponLabel = coupon.closest('.promo')?.previousElementSibling;
      if (couponLabel?.tagName === 'LABEL') couponLabel.htmlFor = coupon.id;
      coupon.setAttribute('autocomplete', 'off');
    }
    detail.querySelectorAll('div[data-r]').forEach(link => {
      link.setAttribute('role', 'link');
      link.tabIndex = 0;
      link.addEventListener('keydown', event => {
        if (event.key === 'Enter' && event.target === link) { event.preventDefault(); link.click(); }
      });
    });
  }

  function enhanceLearner(app, hero) {
    const panel = app.querySelector('#lnBody');
    const steps = app.querySelector('.learner-steps');
    const card = steps?.parentElement;
    if (!panel || !steps || !card || panel.parentElement !== card.parentElement) return;
    const wrap = panel.parentElement;
    const pkg = window.APP?.pack(hero.dataset.languagePackage);
    const extras = [...wrap.children].find(node => node.classList.contains('tabs'));
    const controls = [...steps.querySelectorAll('button[data-lt]'), ...(extras?.querySelectorAll('button[data-lt]') || [])];
    const ordered = ORDER.map(key => controls.find(button => button.dataset.lt === key)).filter(Boolean);
    // Retain unfamiliar future controls at the end rather than removing their entry point.
    controls.filter(button => !ordered.includes(button)).forEach(button => ordered.push(button));
    const nav = make('nav', 'package-exp-nav');
    nav.setAttribute('aria-label', text('أقسام التعلّم في الباقة', 'Package learning sections'));
    ordered.forEach((button, index) => {
      const key = button.dataset.lt;
      const count = button.querySelector('small');
      const name = LABELS[key] ? label(key, pkg) : button.textContent.trim();
      button.classList.add('package-exp-step');
      button.type = 'button';
      button.id = 'package-learning-' + key;
      button.setAttribute('aria-controls', 'lnBody');
      if (button.classList.contains('on')) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
      const number = make('span', 'package-exp-step-number', String(index + 1).padStart(2, '0'));
      number.setAttribute('aria-hidden', 'true');
      const body = make('span', 'package-exp-step-copy');
      body.append(make('strong', '', name));
      if (count) body.append(count);
      button.replaceChildren(number, body);
      nav.append(button); // Move, never clone: original handlers and completion counts are retained.
    });
    steps.replaceWith(nav);
    if (extras && !extras.children.length) extras.remove();
    card.classList.add('package-exp-navigation');
    const layout = make('div', 'package-exp-workspace');
    wrap.insertBefore(layout, card);
    layout.append(card, panel);
    const progress = [...wrap.children].find(node => node.matches('.grid.g4'));
    if (progress) {
      progress.id ||= 'package-learning-progress';
      progress.setAttribute('role', 'region');
      progress.setAttribute('aria-label', text('التقدم المسجل في الباقة', 'Recorded package progress'));
      addJump(nav, progress, text('عرض التقدم', 'View progress')).classList.add('package-exp-progress-jump');
    }
    const selected = ordered.find(button => button.classList.contains('on'));
    panel.setAttribute('role', 'region');
    if (selected) panel.setAttribute('aria-labelledby', selected.id);
    // The plan's existing shortcuts now follow the same ordering as the main navigation.
    const shortcuts = panel.querySelector('.card > .grid');
    if (shortcuts && [...shortcuts.children].every(node => node.matches('button[data-lt]'))) {
      const original = [...shortcuts.children];
      [...original].sort((a, b) => ORDER.indexOf(a.dataset.lt) - ORDER.indexOf(b.dataset.lt)).forEach((button, index) => {
        button.textContent = (index + 1) + ' · ' + label(button.dataset.lt, pkg);
        shortcuts.append(button);
      });
    }
    if (pendingFocus?.pid === hero.dataset.languagePackage) {
      const restore = ordered.find(button => button.dataset.lt === pendingFocus.key);
      restore?.focus({ preventScroll: true });
      pendingFocus = null;
    }
  }

  function refresh() {
    const app = document.getElementById('app');
    if (!app) return;
    const hero = app.querySelector('.learning-hero[data-language-package], .v38-package-hero[data-language-package]');
    if (!hero) {
      delete app.dataset.packageExperience;
      lastHero = null;
      pendingFocus = null;
      return;
    }
    if (hero === lastHero) return;
    lastHero = hero;
    const learner = hero.classList.contains('learning-hero');
    app.dataset.packageExperience = learner ? 'learn' : 'detail';
    if (learner) enhanceLearner(app, hero);
    else { pendingFocus = null; enhanceDetail(app, hero); }
  }

  function start() {
    const app = document.getElementById('app');
    if (!app) return;
    // Capture before the platform's click handler replaces the page markup.
    app.addEventListener('click', event => {
      const control = event.target.closest('button[data-lt]');
      const hero = app.querySelector('.learning-hero[data-language-package]');
      if (control && hero) pendingFocus = { pid: hero.dataset.languagePackage, key: control.dataset.lt };
    }, true);
    new MutationObserver(refresh).observe(app, { childList: true });
    refresh();
  }
  window.PACKAGE_EXPERIENCE = { refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
