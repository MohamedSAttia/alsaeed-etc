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
  let promoMedia = null;

  function clearPromoMedia() {
    if (!promoMedia) return;
    if (promoMedia.tagName === 'VIDEO') {
      promoMedia.pause();
      promoMedia.removeAttribute('src');
      promoMedia.load();
    }
    promoMedia.remove();
    promoMedia = null;
  }

  // Only configured, approved assets are shown. Do not infer a promo from lesson videos.
  function parsePromoVideo(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.length > 2048) return null;
    if (/^\/assets\/promos\/[a-z0-9_-]+\.mp4$/i.test(raw)) return { kind: 'video', src: raw, href: raw };
    let id = '', hash = '';
    if (/^[1-9]\d{0,14}$/.test(raw)) id = raw;
    else {
      let url;
      try { url = new URL(raw); } catch { return null; }
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
      const player = url.hostname === 'player.vimeo.com';
      if (!player && !['vimeo.com', 'www.vimeo.com'].includes(url.hostname)) return null;
      const match = url.pathname.match(player ? /^\/video\/([1-9]\d{0,14})\/?$/ : /^\/([1-9]\d{0,14})(?:\/([a-z0-9]{6,64}))?\/?$/i);
      if (!match) return null;
      id = match[1];
      hash = match[2] || url.searchParams.get('h') || '';
      if (hash && !/^[a-z0-9]{6,64}$/i.test(hash)) return null;
    }
    const params = new URLSearchParams({ title: '0', byline: '0', portrait: '0', dnt: '1', autoplay: '0' });
    if (hash) params.set('h', hash);
    return { kind: 'iframe', src: 'https://player.vimeo.com/video/' + id + '?' + params,
      href: 'https://vimeo.com/' + id + (hash ? '/' + hash : '') };
  }

  function promoSource(pkg, course) {
    if (!pkg || pkg.active === false || pkg.type !== 'full') return null;
    const preset = window.PACKAGE_PROMOS?.[pkg.id];
    const own = String(pkg.promoVideo ?? preset?.video ?? '').trim();
    const source = own ? parsePromoVideo(own) : pkg.promoUseCoursePreview === true ? parsePromoVideo(course?.previewVimeo) : null;
    if (!source || (!own && source.kind !== 'iframe')) return null;
    const poster = own && own === preset?.video && /^\/assets\/promos\/[a-z0-9_-]+\.(?:webp|jpg|png)$/i.test(preset.poster || '') ? preset.poster : '';
    return { ...source, coursePreview: !own, poster };
  }

  function addPromo(main, pkg, hero) {
    const source = promoSource(pkg, window.APP?.course(pkg?.course));
    if (!source) return;
    const card = make('section', 'package-exp-promo');
    const heading = make('h2', 'package-exp-heading', source.coursePreview ? text('فيديو تعريفي بالبرنامج', 'Program introduction') : text('فيديو تعريفي بالباقة', 'Package introduction'));
    heading.id = 'package-promo-title';
    card.setAttribute('aria-labelledby', heading.id);
    const name = english() ? (pkg.en || pkg.ar || pkg.id) : (pkg.ar || pkg.en || pkg.id);
    const play = make('button', 'btn n package-exp-promo-play', text('شاهد الفيديو التعريفي', 'Watch introduction'));
    play.type = 'button';
    play.setAttribute('aria-label', text('شاهد الفيديو التعريفي: ', 'Watch introduction: ') + name);
    play.setAttribute('aria-controls', 'package-promo-player');
    play.setAttribute('aria-expanded', 'false');
    if (source.poster) {
      play.classList.add('package-exp-promo-poster');
      const image = make('img'); image.src = source.poster; image.alt = ''; image.width = 1280; image.height = 720;
      const caption = make('span', '', play.textContent);
      play.replaceChildren(image, caption);
    }
    const player = make('div', 'package-exp-promo-player');
    player.id = 'package-promo-player';
    player.hidden = true;
    const close = make('button', 'btn o', text('إغلاق الفيديو', 'Close video'));
    close.type = 'button';
    close.hidden = true;
    const external = make('a', '', text('افتح الفيديو في نافذة جديدة', 'Open video in a new tab'));
    external.href = source.href;
    external.target = '_blank';
    external.rel = 'noopener noreferrer';
    external.hidden = true;
    play.addEventListener('click', () => {
      if (player.firstChild) return;
      const media = make(source.kind);
      promoMedia = media;
      media.src = source.src;
      media.title = heading.textContent + ': ' + name;
      media.setAttribute('aria-label', media.title);
      if (source.kind === 'iframe') {
        media.allow = 'fullscreen; picture-in-picture';
        media.allowFullscreen = true;
        media.referrerPolicy = 'strict-origin-when-cross-origin';
      } else { media.controls = true; media.preload = 'none'; media.playsInline = true; if (source.poster) media.poster = source.poster; }
      player.append(media);
      player.hidden = false;
      close.hidden = external.hidden = false;
      play.hidden = true;
      play.setAttribute('aria-expanded', 'true');
      close.focus({ preventScroll: true });
      if (source.kind === 'video') {
        // This is an explicit poster click, never page-load autoplay. Controls remain available if playback is blocked.
        try { Promise.resolve(media.play()).catch(() => {}); } catch {}
      }
    });
    close.addEventListener('click', () => {
      clearPromoMedia();
      player.hidden = close.hidden = external.hidden = true;
      play.hidden = false;
      play.setAttribute('aria-expanded', 'false');
      play.focus({ preventScroll: true });
    });
    const actions = make('div', 'package-exp-promo-actions');
    actions.append(play, close, external);
    card.append(heading, make('p', '', text('يُحمّل مشغّل الفيديو عند الضغط فقط، دون تشغيل تلقائي.', 'The player loads only when selected, without autoplay.')), player, actions);
    const preset = window.PACKAGE_PROMOS?.[pkg.id];
    const heroSlot = preset?.placement === 'hero' ? hero?.querySelector('.package-exp-hero-art') : null;
    if (heroSlot) {
      card.classList.add('package-exp-promo-in-hero');
      const title = make('div', 'package-exp-promo-heading');
      if (/^\/assets\/certifications\/[a-z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(preset.logo || '')) {
        const logo = make('img', 'package-exp-promo-logo');
        logo.src = preset.logo; logo.alt = text('شعار PMP', 'PMP logo'); logo.width = 225; logo.height = 225;
        title.append(logo);
      }
      title.append(heading);
      card.prepend(title);
      heroSlot.replaceWith(card);
    } else main.prepend(card);
  }

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
    detail.querySelectorAll('.pd-s b.num').forEach(value => {
      value.classList.toggle('package-exp-text-value', /[\u0621-\u064A]/.test(value.textContent));
    });
    const main = detail.firstElementChild;
    addPromo(main, window.APP?.pack(hero.dataset.languagePackage), hero);
    const headings = [...main.children].filter(node => /^H[2-4]$/.test(node.tagName));
    const navWrap = make('div', 'wrap package-exp-overview');
    const nav = make('nav', 'package-exp-outline');
    nav.setAttribute('aria-label', text('أقسام تفاصيل الباقة', 'Package details sections'));
    navWrap.append(make('p', 'package-exp-eyebrow', text('استكشف الباقة', 'EXPLORE THIS PACKAGE')), nav);
    const promo = app.querySelector('.package-exp-promo');
    if (promo) addJump(nav, promo.querySelector('h2'), promo.querySelector('h2').textContent);
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
    const groups = [
      {keys:['plan','content','exams'], ar:'التعلّم والتقييم', en:'Learn & assess'},
      {keys:['resources','flash','activities','games','workspace'], ar:'الممارسة والأدوات', en:'Practice & tools'},
      {keys:['cert'], ar:'إتمام البرنامج', en:'Completion'}
    ];
    const sections = new Map();
    groups.forEach(group => {
      if (!ordered.some(button => group.keys.includes(button.dataset.lt))) return;
      const section = make('div','package-exp-group');
      section.append(make('h4','package-exp-group-title',text(group.ar,group.en)));
      nav.append(section); group.keys.forEach(key => sections.set(key,section));
    });
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
      (sections.get(key)||nav).append(button); // Move, never clone: original handlers and completion counts are retained.
    });
    steps.replaceWith(nav);
    if (extras && !extras.children.length) extras.remove();
    card.classList.add('package-exp-navigation');
    const navTitle=card.querySelector('h3');if(navTitle)navTitle.textContent=text('مسار الباقة','Package journey');
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
    // One persistent navigation and one clear title for the current workspace.
    const header = make('div','package-exp-panel-heading');
    header.append(make('span','package-exp-eyebrow',text('أنت الآن في','CURRENT SECTION')),
      make('h2','',selected ? label(selected.dataset.lt,pkg) : text('التعلّم','Learning')));
    panel.prepend(header);
    const readiness = wrap.querySelector(':scope > .readiness-explain');
    if (readiness) {
      const detail = make('details','package-exp-readiness');
      detail.append(make('summary','',text('تفاصيل مؤشر الجاهزية','Readiness details')),readiness);
      progress?.after(detail);
    }
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
      clearPromoMedia();
      delete app.dataset.packageExperience;
      lastHero = null;
      pendingFocus = null;
      return;
    }
    if (hero === lastHero) return;
    clearPromoMedia();
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
  window.PACKAGE_EXPERIENCE = { refresh, parsePromoVideo, promoSource };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
