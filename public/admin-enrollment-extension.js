/* Admin-only duration adjustment of an existing finite enrollment. No local grant fallback. */
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
  // All estimates start with the freshly read server clock, independent of the
  // device's timezone or wall-clock offset. The save response is authoritative.
  function serverNow(ctx) { return ctx.serverNow + Math.max(0, Date.now() - ctx.readAt); }
  function remaining(expires, now) {
    if (expires <= now) return 'منتهٍ · لا وقت متبقٍ';
    const minutes = Math.ceil((expires - now) / 60000);
    return `${Math.floor(minutes / 1440)} يوم، ${Math.floor(minutes % 1440 / 60)} ساعة، ${minutes % 60} دقيقة متبقية تقريبًا`;
  }
  function control(enrollment) {
    if (!admin() || !enrollment || !finite(enrollment.expires) || typeof enrollment.id !== 'string' || !enrollment.id) return '';
    return `<button type="button" class="btn o sm" data-extend-enrollment="${esc(enrollment.id)}" data-extend-package="${esc(enrollment.package_id)}" ${app().live && app().token ? '' : 'disabled title="يلزم الاتصال بالخادم"'}>تعديل مدة الباقة</button>`;
  }
  function sameActor(ctx) {
    return admin() && app().live && app().token === ctx.token && app().me().id === ctx.actor;
  }
  function visible(ctx) {
    return active === ctx && ctx.overlay?.isConnected && location.hash === ctx.hash && sameActor(ctx);
  }
  function stopClock(ctx) { if (ctx?.timer) { clearInterval(ctx.timer); ctx.timer = null; } }
  function dismiss(ctx) {
    stopClock(ctx);
    if (active === ctx) active = null;
    if (ctx.overlay?.isConnected) ctx.overlay.remove();
    if (location.hash === ctx.hash && sameActor(ctx) && !document.getElementById('ov')) {
      const target = [...document.querySelectorAll('[data-uview],[data-student]')].find(button => (button.dataset.uview || button.dataset.student) === ctx.userId);
      target?.focus();
    }
  }
  function installDialog(ctx) {
    stopClock(ctx);
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
    stopClock(ctx);
    // The callback starts its own guarded fetch; a newer modal always wins.
    await ctx.onRefresh?.();
  }
  function proposal(ctx) {
    const uiMode = ctx.form.elements.mode.value, old = ctx.enrollment.expires;
    const now = serverNow(ctx);
    let expires, days;
    if (uiMode === 'add' || uiMode === 'reduce') {
      const value = ctx.form.elements.days.value;
      const count = /^\d+$/.test(value) ? Number(value) : NaN;
      if (!Number.isSafeInteger(count) || count < 1 || count > MAX_DAYS) throw new Error('أدخل عددًا صحيحًا موجبًا من 1 إلى 3650 يومًا.');
      days = uiMode === 'reduce' ? -count : count;
      expires = (days > 0 ? Math.max(old, now) : old) + days * DAY;
    } else if (uiMode === 'date') {
      expires = parseDate(ctx.form.elements.expiresAt.value);
      if (expires < old - MAX_DAYS * DAY || expires > Math.max(now, old) + MAX_DAYS * DAY) throw new Error('الحد الأقصى للتقليل 3650 يومًا من الانتهاء الحالي، وللزيادة 3650 يومًا من الانتهاء الحالي أو الآن، أيهما أحدث.');
    } else throw new Error('اختر طريقة تعديل المدة.');
    if (!finite(expires)) throw new Error('اختر تاريخ انتهاء ميلادي صالحًا بعد بداية عام 1970 وحتى بداية عام 2100.');
    if (expires === old) throw new Error('تاريخ الانتهاء الجديد مطابق للحالي. اختر مدة أو تاريخًا مختلفًا.');
    return {uiMode, mode:uiMode === 'date' ? 'date' : 'days', expires, endsAccess:expires <= now,
      direction:expires < old ? 'reduction' : 'increase', ...(days === undefined ? {} : {days})};
  }
  function choiceKey(ctx, choice) {
    return JSON.stringify([ctx.enrollment.id, ctx.enrollment.expires, choice.mode, choice.mode === 'days' ? choice.days : choice.expires]);
  }
  function validAck(ctx, choice, result) {
    if (!result || result.ok !== true || result.userId !== ctx.userId || result.packageId !== ctx.packageId || result.enrollmentId !== ctx.enrollment.id || result.oldExpires !== ctx.enrollment.expires || !finite(result.expires) || !finite(result.extendedAt) || !finite(result.checkedAt) || result.checkedAt < result.extendedAt || result.mode !== choice.mode || typeof result.auditId !== 'string' || !result.auditId) return false;
    const expected = choice.mode === 'days' ? (choice.days > 0 ? Math.max(result.oldExpires, result.extendedAt) : result.oldExpires) + choice.days * DAY : choice.expires;
    if (result.expires !== expected || result.expires === result.oldExpires || result.days !== (choice.mode === 'days' ? choice.days : null)) return false;
    if (choice.mode === 'date' && (result.expires < result.oldExpires - MAX_DAYS * DAY || result.expires > Math.max(result.extendedAt, result.oldExpires) + MAX_DAYS * DAY)) return false;
    if (result.direction !== (result.expires < result.oldExpires ? 'reduction' : 'increase') || result.endsAccess !== (result.expires <= result.checkedAt)) return false;
    return !result.endsAccess || choice.confirmImmediateExpiry === true;
  }
  function updateCache(ctx, result) {
    let changed = false;
    const user = app().DB.users.find(u => u.id === ctx.userId);
    const enrollment = user?.packages?.find(e => (e.package_id || e.id) === ctx.packageId && e.enrollmentId === result.enrollmentId && e.expires === result.oldExpires);
    if (enrollment) { enrollment.expires = result.expires; changed = true; }
    const student = app().adminOverview?.students?.find(u => u.id === ctx.userId);
    const detail = student?.learningPackages?.find(e => e.package_id === ctx.packageId && e.id === result.enrollmentId && e.expires === result.oldExpires);
    if (detail) {
      detail.expires = result.expires;
      student.nearestExpiry = student.learningPackages.map(e => e.expires).filter(e => finite(e) && e > result.checkedAt).sort((a, b) => a - b)[0] || null;
      changed = true;
    }
    // An older delayed acknowledgment must not replace a newer authoritative
    // read or save. APP.save also syncs progress, so it must never be invoked.
    if (changed) app().render();
    return changed;
  }
  function renderForm(ctx, details) {
    const enrollment = ctx.enrollment;
    const pkg = app().pack(ctx.packageId);
    const initial = Math.min(MAX_EXPIRY, Math.max(enrollment.expires, serverNow(ctx)) + 30 * DAY);
    app().modal(`<style>#enrollmentExtensionForm [hidden]{display:none!important}</style><h3 id="enrollmentExtensionTitle">تعديل مدة الباقة</h3>
      <p><b>${esc(details.user.name || ctx.userId)}</b> · ${esc(pkg?.ar || ctx.packageId)}</p>
      <p class="en" dir="ltr">${esc(details.user.email || '')}</p>
      <form id="enrollmentExtensionForm" novalidate>
        <p>الانتهاء الحالي (ميلادي): <b dir="ltr" data-extension-old>${esc(formatExpiry(enrollment.expires))}</b></p>
        <p data-extension-current-remaining></p>
        <p class="note info">تُضاف الأيام من الانتهاء الحالي أو وقت الحفظ على الخادم، أيهما أحدث. تُخصم الأيام من الانتهاء الحالي حتى لو كان الاشتراك منتهيًا. كل الأوقات ميلادية بتوقيت السعودية؛ المعاينة تقريبية حتى الحفظ.</p>
        ${ctx.reloadReason ? `<p class="note warn" role="alert">${esc(ctx.reloadReason)}</p>` : ''}
        <label class="f"><span>طريقة تعديل المدة</span><select name="mode"><option value="add">إضافة أيام</option><option value="reduce">تقليل أيام</option><option value="date">تاريخ انتهاء جديد</option></select></label>
        <label class="f" data-extension-days><span data-extension-days-label>عدد الأيام المراد إضافتها (1–3650)</span><input name="days" type="number" min="1" max="3650" step="1" value="30" inputmode="numeric"></label>
        <label class="f" data-extension-date hidden><span>تاريخ ووقت الانتهاء الجديد (ميلادي، السعودية UTC+03:00)</span><input name="expiresAt" type="datetime-local" step="1" dir="ltr" value="${dateInput(initial)}"></label>
        <div class="note info" aria-live="polite" data-extension-preview></div>
        <div class="note warn" role="alert" data-extension-immediate-warning hidden style="border:2px solid #a52020;background:#fff0f0;color:#861919;margin-top:12px">
          <strong>تنبيه: هذا التعديل سيُنهي وصول المتدرب إلى الباقة فور الحفظ، أو سيُبقي وصوله متوقفًا إذا كان الاشتراك منتهيًا بالفعل.</strong>
          <label data-extension-confirm style="display:flex;align-items:flex-start;gap:10px;margin-top:12px;cursor:pointer"><input name="confirmImmediateExpiry" type="checkbox" style="width:auto;flex:none;margin-top:6px"><span>أؤكد أنني راجعت تاريخ الانتهاء الجديد وأوافق على عدم إتاحة الباقة للمتدرب فور الحفظ.</span></label>
        </div>
        <p role="alert" data-extension-error></p>
        <p role="status" data-extension-pending hidden>قد يكتمل الحفظ حتى عند إغلاق النافذة. تحقّق من الاشتراك قبل تكرار التعديل.</p>
        <div class="mdl-act"><button class="btn p" type="submit" data-extension-submit>حفظ تعديل المدة</button><button class="btn o" type="button" data-extension-reload hidden>تحديث الاشتراك</button><button class="btn o" type="button" data-close>إلغاء</button></div>
      </form>`, () => {
        installDialog(ctx);
        ctx.form = ctx.overlay.querySelector('form');
        const form = ctx.form, submit = form.querySelector('[data-extension-submit]'), reload = form.querySelector('[data-extension-reload]'), error = form.querySelector('[data-extension-error]');
        const consent = form.elements.confirmImmediateExpiry, warning = form.querySelector('[data-extension-immediate-warning]');
        if (ctx.initialChoice) {
          form.elements.mode.value = ctx.initialChoice.uiMode;
          form.elements.days.value = ctx.initialChoice.days;
          form.elements.expiresAt.value = ctx.initialChoice.expiresAt;
        }
        const preview = () => {
          const uiMode = form.elements.mode.value, daysMode = uiMode !== 'date';
          form.querySelector('[data-extension-days]').hidden = !daysMode;
          form.querySelector('[data-extension-date]').hidden = daysMode;
          form.querySelector('[data-extension-days-label]').textContent = uiMode === 'reduce' ? 'عدد الأيام المراد تقليلها (1–3650)' : 'عدد الأيام المراد إضافتها (1–3650)';
          form.querySelector('[data-extension-current-remaining]').textContent = 'الوقت المتبقي حاليًا: ' + remaining(enrollment.expires, serverNow(ctx));
          try {
            const next = proposal(ctx);
            const needsConsent = next.endsAccess || ctx.forceImmediateChoice === choiceKey(ctx, next);
            warning.hidden = !needsConsent;
            if (!needsConsent) consent.checked = false;
            const box = form.querySelector('[data-extension-preview]');
            box.className = 'note ' + (next.direction === 'reduction' ? 'warn' : 'info');
            box.innerHTML = `<strong data-extension-direction>${next.direction === 'reduction' ? 'تقليل مدة الباقة' : 'زيادة مدة الباقة'}</strong><br>الانتهاء المقترح: <b dir="ltr" data-extension-new>${esc(formatExpiry(next.expires))}</b><br><span data-extension-proposed-remaining>الوقت المتبقي بعد التعديل: ${esc(remaining(next.expires, serverNow(ctx)))}</span>`;
            error.textContent = '';
            submit.disabled = needsConsent && !consent.checked;
            return next;
          } catch (e) {
            form.querySelector('[data-extension-preview]').textContent = 'أكمل اختيار تعديل صالح لعرض الموعد الجديد.';
            warning.hidden = true;
            consent.checked = false;
            error.textContent = e.message;
            submit.disabled = true;
            return null;
          }
        };
        form.oninput = form.onchange = event => {
          if (ctx.pending || ctx.uncertain) return;
          if (event.target !== consent) { consent.checked = false; ctx.forceImmediateChoice = null; }
          preview();
        };
        reload.onclick = () => returnToDetails(ctx);
        form.onsubmit = async event => {
          event.preventDefault();
          if (ctx.pending || ctx.uncertain) return;
          if (!visible(ctx)) { dismiss(ctx); return; }
          const choice = preview();
          if (!choice) return;
          if ((choice.endsAccess || ctx.forceImmediateChoice === choiceKey(ctx, choice)) && !consent.checked) {
            error.textContent = 'راجع تنبيه إيقاف الوصول وحدد خانة التأكيد بنفسك قبل الحفظ.';
            consent.focus();
            return;
          }
          choice.confirmImmediateExpiry = consent.checked === true;
          ctx.pending = true;
          form.querySelectorAll('input,select,button[type="submit"]').forEach(x => { x.disabled = true; });
          submit.textContent = 'جارٍ حفظ تعديل المدة…';
          form.querySelector('[data-extension-pending]').hidden = false;
          form.querySelector('[data-close]').textContent = 'إغلاق';
          error.textContent = '';
          const body = {expectedEnrollmentId:enrollment.id, expectedExpires:enrollment.expires, ...(choice.mode === 'days' ? {days:choice.days} : {expiresAt:choice.expires}), ...(choice.confirmImmediateExpiry ? {confirmImmediateExpiry:true} : {})};
          try {
            const result = await app().api('/admin/users/' + encodeURIComponent(ctx.userId) + '/enrollments/' + encodeURIComponent(ctx.packageId) + '/expiry', {method:'POST', body, timeoutMs:20000, timeoutMessage:'انتهت مهلة التحقق من تعديل المدة. حدّث الاشتراك قبل المحاولة مجددًا.'});
            if (!sameActor(ctx)) { dismiss(ctx); return; }
            if (!validAck(ctx, choice, result)) throw new Error('تعذّر التحقق من تأكيد الخادم. حدّث الاشتراك للتحقق من حالته قبل المحاولة مجددًا.');
            if (updateCache(ctx, result)) app().toast('تم تعديل مدة الباقة. الانتهاء: ' + formatExpiry(result.expires));
            await returnToDetails(ctx);
          } catch (e) {
            if (!visible(ctx)) { if (!sameActor(ctx)) dismiss(ctx); return; }
            ctx.uncertain = true;
            stopClock(ctx);
            error.textContent = e.message || 'تعذّر تأكيد تعديل المدة. حدّث الاشتراك قبل المحاولة مجددًا.';
            submit.textContent = 'لم يُؤكَّد التعديل';
            reload.hidden = false;
            if (e.status === 409 && e.code === 'IMMEDIATE_EXPIRY_CONFIRMATION_REQUIRED') {
              // A date may pass while the request is in flight. Re-read the
              // enrollment and server clock; keep the choice, never the consent.
              await open({userId:ctx.userId, packageId:ctx.packageId, enrollmentId:ctx.enrollmentId, onRefresh:ctx.onRefresh,
                initialChoice:{uiMode:choice.uiMode, days:form.elements.days.value, expiresAt:form.elements.expiresAt.value},
                forceImmediateChoice:choiceKey(ctx, choice), reloadReason:'لم يُحفظ التعديل: الموعد الجديد ينهي الوصول حسب وقت الخادم. حُدّث الاشتراك؛ راجع الموعد وحدد التأكيد إذا أردت المتابعة.'});
            } else if (e.status === 409) {
              app().toast('تغيّر الاشتراك. يجري تحديث بياناته؛ راجعها قبل أي تعديل جديد.');
              await returnToDetails(ctx);
            }
          } finally { ctx.pending = false; }
        };
        preview();
        ctx.timer = setInterval(() => {
          if (!visible(ctx)) { stopClock(ctx); return; }
          if (!ctx.pending && !ctx.uncertain) preview();
        }, 1000);
        (ctx.reloadReason && !warning.hidden ? consent : form.elements.mode.value === 'date' ? form.elements.expiresAt : form.elements.days).focus();
      });
  }
  async function open(options) {
    if (!admin() || !app().live || !app().token) { app()?.toast('يلزم حساب مشرف متصل بالخادم لتعديل مدة الاشتراك.'); return; }
    stopClock(active);
    const ctx = {...options, actor:app().me().id, token:app().token, hash:location.hash, pending:false, uncertain:false};
    active = ctx;
    app().modal('<h3 id="enrollmentExtensionTitle">تعديل مدة الباقة</h3><p role="status">جارٍ التحقق من الاشتراك الحالي…</p><div class="mdl-act"><button type="button" class="btn o" data-close>إلغاء</button></div>', () => installDialog(ctx));
    ctx.overlay.querySelector('[data-close]').focus();
    try {
      const details = await app().api('/admin/users/' + encodeURIComponent(ctx.userId), {timeoutMs:15000});
      if (!visible(ctx)) { if (!sameActor(ctx)) dismiss(ctx); return; }
      if (!details || details.user?.id !== ctx.userId || !Array.isArray(details.enrollments) || !finite(details.serverNow)) throw new Error('تعذّر التحقق من بيانات الاشتراك ووقت الخادم. حدّث الصفحة وحاول مجددًا.');
      const row = details.enrollments.find(e => e.package_id === ctx.packageId && e.id === ctx.enrollmentId && (!e.user_id || e.user_id === ctx.userId));
      if (!row || !finite(row.expires)) {
        app().toast(row && (row.expires === 0 || row.expires === null) ? 'هذا الاشتراك غير محدود؛ لا يمكن تحويله إلى اشتراك محدد المدة من هنا.' : 'تغيّر الاشتراك أو لم يعد متاحًا. راجع بياناته الحالية.');
        await returnToDetails(ctx);
        return;
      }
      ctx.enrollment = {...row};
      ctx.serverNow = details.serverNow;
      ctx.readAt = Date.now();
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
