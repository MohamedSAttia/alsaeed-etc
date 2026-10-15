/* Admin-only extension of an existing, finite enrollment. No local grant fallback. */
(function () {
  'use strict';
  const DAY = 86400000, MAX_DAYS = 3650, MAX_EXPIRY = 4102444800000;
  const app = () => window.APP;
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite = value => Number.isSafeInteger(value) && value > 0 && value <= MAX_EXPIRY;
  const admin = () => app()?.me()?.role === 'admin';
  let active = null;

  function formatExpiry(value) {
    if (value === null || value === 0) return 'غير محدود';
    if (!finite(value)) return 'تاريخ غير متاح';
    const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Riyadh', calendar:'gregory', numberingSystem:'latn', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'}).formatToParts(value);
    const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} (السعودية UTC+03:00)`;
  }
  function dateInput(value) { return new Date(value + 10800000).toISOString().slice(0, 19); }
  function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return NaN;
    const complete = value.length === 16 ? value + ':00' : value;
    const n = Date.parse(complete + '+03:00');
    return Number.isFinite(n) && dateInput(n) === complete ? n : NaN;
  }
  function control(enrollment) {
    if (!admin() || !enrollment || !finite(enrollment.expires) || typeof enrollment.id !== 'string' || !enrollment.id) return '';
    return `<button type="button" class="btn o sm" data-extend-enrollment="${esc(enrollment.id)}" data-extend-package="${esc(enrollment.package_id)}" ${app().live && app().token ? '' : 'disabled title="يلزم الاتصال بالخادم"'}>تمديد الباقة</button>`;
  }
  function sameActor(ctx) {
    return admin() && app().live && app().token === ctx.token && app().me().id === ctx.actor;
  }
  function visible(ctx) {
    return active === ctx && ctx.overlay?.isConnected && location.hash === ctx.hash && sameActor(ctx);
  }
  function dismiss(ctx) {
    if (active === ctx) active = null;
    if (ctx.overlay?.isConnected) ctx.overlay.remove();
    if (location.hash === ctx.hash && sameActor(ctx) && !document.getElementById('ov')) {
      const target = [...document.querySelectorAll('[data-uview],[data-student]')].find(button => (button.dataset.uview || button.dataset.student) === ctx.userId);
      target?.focus();
    }
  }
  function installDialog(ctx) {
    ctx.overlay = document.getElementById('ov');
    const dialog = ctx.overlay.querySelector('.mdl');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'enrollmentExtensionTitle');
    ctx.overlay.querySelectorAll('[data-close]').forEach(button => { button.onclick = () => dismiss(ctx); });
    ctx.overlay.addEventListener('click', event => { if (event.target === ctx.overlay) { event.stopImmediatePropagation(); dismiss(ctx); } }, true);
    ctx.overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(ctx); }
      if (event.key !== 'Tab') return;
      const nodes = [...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(x => !x.closest('[hidden]'));
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (first && event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (last && !event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }
  async function returnToDetails(ctx) {
    if (!visible(ctx)) return;
    // The callback starts its own guarded fetch; a newer modal always wins.
    await ctx.onRefresh?.();
  }
  function proposal(ctx) {
    const mode = ctx.form.elements.mode.value;
    const base = Math.max(ctx.enrollment.expires, Date.now());
    let expires, days;
    if (mode === 'days') {
      const value = ctx.form.elements.days.value;
      days = /^\d+$/.test(value) ? Number(value) : NaN;
      if (!Number.isSafeInteger(days) || days < 1 || days > MAX_DAYS) throw new Error('أدخل عددًا صحيحًا من 1 إلى 3650 يومًا.');
      expires = base + days * DAY;
    } else {
      expires = parseDate(ctx.form.elements.expiresAt.value);
    }
    if (!finite(expires) || expires <= base || expires > base + MAX_DAYS * DAY) throw new Error('اختر انتهاءً لاحقًا للموعد الحالي وللآن، بحد أقصى 3650 يومًا وحتى بداية عام 2100.');
    return {mode, expires, ...(mode === 'days' ? {days} : {})};
  }
  function validAck(ctx, choice, result) {
    if (!result || result.ok !== true || result.userId !== ctx.userId || result.packageId !== ctx.packageId || result.enrollmentId !== ctx.enrollment.id || result.oldExpires !== ctx.enrollment.expires || !finite(result.expires) || !finite(result.extendedAt) || result.mode !== choice.mode) return false;
    const base = Math.max(result.oldExpires, result.extendedAt);
    if (result.expires <= base || result.expires > base + MAX_DAYS * DAY) return false;
    return choice.mode === 'days'
      ? result.days === choice.days && result.expires === base + choice.days * DAY
      : result.days === null && result.expires === choice.expires;
  }
  function updateCache(ctx, result) {
    const user = app().DB.users.find(u => u.id === ctx.userId);
    const enrollment = user?.packages?.find(e => (e.package_id || e.id) === ctx.packageId && (!e.enrollmentId || e.enrollmentId === result.enrollmentId));
    if (enrollment) { enrollment.expires = result.expires; enrollment.enrollmentId = result.enrollmentId; }
    const student = app().adminOverview?.students?.find(u => u.id === ctx.userId);
    const detail = student?.learningPackages?.find(e => e.package_id === ctx.packageId && (!e.id || e.id === result.enrollmentId));
    if (detail) {
      detail.expires = result.expires;
      student.nearestExpiry = student.learningPackages.map(e => e.expires).filter(e => finite(e) && e > result.extendedAt).sort((a, b) => a - b)[0] || null;
    }
    // APP.save also syncs progress; an expiry change must not invoke it.
    app().render();
  }
  function renderForm(ctx, details) {
    const enrollment = ctx.enrollment;
    const pkg = app().pack(ctx.packageId);
    const expired = enrollment.expires <= Date.now();
    const initial = Math.min(MAX_EXPIRY, Math.max(enrollment.expires, Date.now()) + 30 * DAY);
    app().modal(`<h3 id="enrollmentExtensionTitle">تمديد الباقة</h3>
      <p><b>${esc(details.user.name || ctx.userId)}</b> · ${esc(pkg?.ar || ctx.packageId)}</p>
      <p class="en" dir="ltr">${esc(details.user.email || '')}</p>
      <form id="enrollmentExtensionForm" novalidate>
        <p>الانتهاء الحالي (ميلادي): <b dir="ltr" data-extension-old>${esc(formatExpiry(enrollment.expires))}</b></p>
        <p class="note info">${expired ? 'الاشتراك منتهٍ. تُضاف الأيام من وقت الحفظ على الخادم؛ قد يختلف الموعد النهائي عن المعاينة بثوانٍ.' : 'تُضاف الأيام إلى تاريخ الانتهاء الحالي.'} كل الأوقات بتوقيت السعودية.</p>
        <label class="f"><span>طريقة التمديد</span><select name="mode"><option value="days">عدد أيام إضافية</option><option value="date">تاريخ ووقت انتهاء جديد</option></select></label>
        <label class="f" data-extension-days><span>الأيام الإضافية (1–3650)</span><input name="days" type="number" min="1" max="3650" step="1" value="30" inputmode="numeric"></label>
        <label class="f" data-extension-date hidden><span>تاريخ ووقت الانتهاء الجديد (ميلادي، السعودية UTC+03:00)</span><input name="expiresAt" type="datetime-local" step="1" dir="ltr" value="${dateInput(initial)}"></label>
        <div class="note info" aria-live="polite" data-extension-preview></div>
        <p role="alert" data-extension-error></p>
        <p role="status" data-extension-pending hidden>قد يكتمل الحفظ حتى عند إغلاق النافذة. تحقّق من الاشتراك قبل تكرار التمديد.</p>
        <div class="mdl-act"><button class="btn p" type="submit" data-extension-submit>تأكيد التمديد</button><button class="btn o" type="button" data-extension-reload hidden>تحديث الاشتراك</button><button class="btn o" type="button" data-close>إلغاء</button></div>
      </form>`, () => {
        installDialog(ctx);
        ctx.form = ctx.overlay.querySelector('form');
        const form = ctx.form, submit = form.querySelector('[data-extension-submit]'), reload = form.querySelector('[data-extension-reload]'), error = form.querySelector('[data-extension-error]');
        const preview = () => {
          const daysMode = form.elements.mode.value === 'days';
          form.querySelector('[data-extension-days]').hidden = !daysMode;
          form.querySelector('[data-extension-date]').hidden = daysMode;
          try {
            const next = proposal(ctx);
            form.querySelector('[data-extension-preview]').innerHTML = `تأكيد التغيير من <b dir="ltr">${esc(formatExpiry(enrollment.expires))}</b><br>إلى <b dir="ltr">${esc(formatExpiry(next.expires))}</b>`;
            error.textContent = '';
            submit.disabled = false;
          } catch (e) {
            form.querySelector('[data-extension-preview]').textContent = 'أكمل اختيار تمديد صالح لعرض الموعد الجديد.';
            error.textContent = e.message;
            submit.disabled = true;
          }
        };
        form.oninput = form.onchange = () => { if (!ctx.pending && !ctx.uncertain) preview(); };
        reload.onclick = () => returnToDetails(ctx);
        form.onsubmit = async event => {
          event.preventDefault();
          if (ctx.pending || ctx.uncertain) return;
          if (!visible(ctx)) { dismiss(ctx); return; }
          let choice;
          try { choice = proposal(ctx); } catch (e) { error.textContent = e.message; return; }
          ctx.pending = true;
          form.querySelectorAll('input,select,button[type="submit"]').forEach(x => { x.disabled = true; });
          submit.textContent = 'جارٍ حفظ التمديد…';
          form.querySelector('[data-extension-pending]').hidden = false;
          form.querySelector('[data-close]').textContent = 'إغلاق';
          error.textContent = '';
          const body = {expectedEnrollmentId:enrollment.id, expectedExpires:enrollment.expires, ...(choice.mode === 'days' ? {days:choice.days} : {expiresAt:choice.expires})};
          try {
            const result = await app().api('/admin/users/' + encodeURIComponent(ctx.userId) + '/enrollments/' + encodeURIComponent(ctx.packageId) + '/extend', {method:'POST', body, timeoutMs:20000, timeoutMessage:'انتهت مهلة التحقق من التمديد. حدّث الاشتراك قبل المحاولة مجددًا.'});
            if (!sameActor(ctx)) { dismiss(ctx); return; }
            if (!validAck(ctx, choice, result)) throw new Error('تعذّر التحقق من تأكيد الخادم. حدّث الاشتراك للتحقق من حالته قبل المحاولة مجددًا.');
            updateCache(ctx, result);
            app().toast('تم تمديد الباقة. الانتهاء: ' + formatExpiry(result.expires));
            await returnToDetails(ctx);
          } catch (e) {
            if (!visible(ctx)) { if (!sameActor(ctx)) dismiss(ctx); return; }
            ctx.uncertain = true;
            error.textContent = e.message || 'تعذّر تأكيد التمديد. حدّث الاشتراك قبل المحاولة مجددًا.';
            submit.textContent = 'لم يُؤكَّد التمديد';
            reload.hidden = false;
            if (e.status === 409) {
              app().toast('تغيّر الاشتراك. يجري تحديث بياناته؛ راجعها قبل أي تمديد جديد.');
              await returnToDetails(ctx);
            }
          } finally { ctx.pending = false; }
        };
        preview();
        form.elements.days.focus();
      });
  }
  async function open(options) {
    if (!admin() || !app().live || !app().token) { app()?.toast('يلزم حساب مشرف متصل بالخادم لتمديد الاشتراك.'); return; }
    const ctx = {...options, actor:app().me().id, token:app().token, hash:location.hash, pending:false, uncertain:false};
    active = ctx;
    app().modal('<h3 id="enrollmentExtensionTitle">تمديد الباقة</h3><p role="status">جارٍ التحقق من الاشتراك الحالي…</p><div class="mdl-act"><button type="button" class="btn o" data-close>إلغاء</button></div>', () => installDialog(ctx));
    ctx.overlay.querySelector('[data-close]').focus();
    try {
      const details = await app().api('/admin/users/' + encodeURIComponent(ctx.userId), {timeoutMs:15000});
      if (!visible(ctx)) { if (!sameActor(ctx)) dismiss(ctx); return; }
      if (!details || details.user?.id !== ctx.userId || !Array.isArray(details.enrollments)) throw new Error('تعذّر التحقق من بيانات الاشتراك.');
      const row = details.enrollments.find(e => e.package_id === ctx.packageId && e.id === ctx.enrollmentId && (!e.user_id || e.user_id === ctx.userId));
      if (!row || !finite(row.expires)) {
        app().toast(row && (row.expires === 0 || row.expires === null) ? 'هذا الاشتراك غير محدود ولا يحتاج إلى تمديد.' : 'تغيّر الاشتراك أو لم يعد متاحًا. راجع بياناته الحالية.');
        await returnToDetails(ctx);
        return;
      }
      ctx.enrollment = {...row};
      renderForm(ctx, details);
    } catch (e) {
      if (!visible(ctx)) return;
      ctx.overlay.querySelector('[role="status"]').textContent = e.message || 'تعذّر تحميل الاشتراك. أغلق النافذة وحاول مجددًا.';
    }
  }
  function bind(root, options) {
    if (!root) return;
    root.querySelectorAll('[data-extend-enrollment]').forEach(button => {
      button.onclick = () => open({...options, enrollmentId:button.dataset.extendEnrollment, packageId:button.dataset.extendPackage});
    });
  }
  window.addEventListener('hashchange', () => { if (active && location.hash !== active.hash) dismiss(active); });
  window.AlsaeedEnrollmentExtension = {formatExpiry, control, bind, open};
})();
