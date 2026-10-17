/* Decorative AL-LTC scenes. No account state, tracking, or form access. */
(function () {
  'use strict';
  const scenes = [
    { src:'/assets/hero/alsaeed-academy-wide-v44.webp', position:'24% center' },
    { src:'/assets/hero/alsaeed-global-1-v24.webp', position:'50% center' },
    { src:'/assets/hero/alsaeed-workshop-v26.webp', position:'50% center' }
  ];
  function mount(panel) {
    if (!panel) return function () {};
    const mobile = window.matchMedia('(max-width: 760px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const media = document.createElement('div');
    media.className = 'auth-scenes'; media.setAttribute('aria-hidden', 'true');
    const controls = document.createElement('div'); controls.className = 'auth-scene-controls';
    controls.setAttribute('role','group'); controls.setAttribute('aria-label','صور التعلّم');
    const dots = scenes.map((scene, i) => {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'auth-scene-dot'; button.setAttribute('aria-label','عرض الصورة ' + (i + 1));
      button.setAttribute('aria-pressed', String(i === 0));
      button.onclick = () => { paused = true; paintPause(); show(i); };
      controls.appendChild(button); return button;
    });
    const pause = document.createElement('button'); pause.type = 'button'; pause.className = 'auth-scene-pause';
    controls.appendChild(pause); panel.prepend(media); panel.appendChild(controls);
    let timer = null, index = 0, disposed = false, paused = false, hovering = false, focused = false, generation = 0;
    const images = [], ready = [], failed = [];
    function stop() { if (timer !== null) { window.clearTimeout(timer); timer = null; } }
    function allowed() { return !disposed && !paused && !hovering && !focused && !mobile.matches && !reduced.matches && !document.hidden; }
    function schedule() {
      stop();
      const next = scenes.map((_, step) => (index + step + 1) % scenes.length).find(i => i !== index && !failed[i]);
      if (allowed() && next !== undefined) timer = window.setTimeout(() => show(next), 7000);
    }
    function paintPause() {
      const still = paused || reduced.matches;
      pause.textContent = still ? 'تشغيل الصور' : 'إيقاف الصور';
      pause.setAttribute('aria-pressed', String(!still));
      pause.setAttribute('aria-label', still ? 'تشغيل انتقال الصور تلقائياً' : 'إيقاف انتقال الصور تلقائياً');
      pause.disabled = reduced.matches;
      if (reduced.matches) { pause.textContent = 'صور ثابتة'; pause.setAttribute('aria-label','الحركة متوقفة وفق إعداد تقليل الحركة'); }
    }
    function show(next) {
      stop(); if (disposed || mobile.matches) return;
      const currentGeneration = ++generation;
      const reveal = () => {
        if (disposed || currentGeneration !== generation || mobile.matches) return;
        images.forEach((img, i) => { if (img) img.classList.toggle('on', i === next); });
        dots.forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === next)));
        index = next; schedule();
      };
      if (ready[next]) { reveal(); return; }
      let img = images[next];
      if (!img) {
        img = document.createElement('img'); img.alt = ''; img.decoding = 'async';
        img.className = 'auth-scene'; img.style.objectPosition = scenes[next].position;
        images[next] = img; media.appendChild(img);
      }
      img.onload = () => { ready[next] = true; failed[next] = false; reveal(); };
      img.onerror = () => { failed[next] = true; if (!disposed && currentGeneration === generation) schedule(); };
      img.src = scenes[next].src;
    }
    pause.onclick = () => { paused = !paused; paintPause(); schedule(); };
    const enter = () => { hovering = true; stop(); };
    const leave = () => { hovering = false; schedule(); };
    const focusIn = () => { focused = true; stop(); };
    const focusOut = event => { if (!panel.contains(event.relatedTarget)) { focused = false; schedule(); } };
    const visibility = () => { if (document.hidden) { generation++; stop(); } else { show(index); } };
    const preference = () => { generation++; stop(); paintPause(); if (!mobile.matches) show(index); };
    panel.addEventListener('mouseenter', enter); panel.addEventListener('mouseleave', leave);
    panel.addEventListener('focusin', focusIn); panel.addEventListener('focusout', focusOut);
    document.addEventListener('visibilitychange', visibility);
    mobile.addEventListener('change', preference); reduced.addEventListener('change', preference);
    paintPause(); if (!mobile.matches) show(0);
    return function dispose() {
      if (disposed) return; disposed = true; generation++; stop();
      panel.removeEventListener('mouseenter', enter); panel.removeEventListener('mouseleave', leave);
      panel.removeEventListener('focusin', focusIn); panel.removeEventListener('focusout', focusOut);
      document.removeEventListener('visibilitychange', visibility);
      mobile.removeEventListener('change', preference); reduced.removeEventListener('change', preference);
      images.forEach(img => { if (img) { img.onload = null; img.onerror = null; } });
      media.remove(); controls.remove();
    };
  }
  window.AUTH_VISUAL = { mount };
})();
