(function () {
  'use strict';

  function showLocked(courseId, message) {
    document.documentElement.style.visibility = 'visible';
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    document.body.innerHTML = '<main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f8f9fc;font-family:system-ui;color:#1c2b42">' +
      '<section style="max-width:560px;background:#fff;border:1px solid #e3e8f0;border-radius:24px;padding:34px;text-align:center;box-shadow:0 20px 55px rgba(14,36,68,.14)">' +
      '<div style="font-size:42px">🔒</div><h1 style="font-size:24px;margin:12px 0">هذا المحتوى للمشتركين</h1>' +
      '<p style="color:#5b6b85;line-height:1.8">' + message + '</p>' +
      '<a href="/#course/' + encodeURIComponent(courseId) + '" style="display:inline-block;margin-top:18px;padding:12px 22px;border-radius:12px;background:#f0741a;color:#fff;text-decoration:none;font-weight:700">عرض الباقات المناسبة</a>' +
      '</section></main>';
  }

  async function guard(courseId) {
    document.documentElement.style.visibility = 'hidden';
    let health;
    try { health = await fetch('/api/health', { cache: 'no-store' }); }
    catch (e) { document.documentElement.style.visibility = 'visible'; return true; }
    if (!health.ok) { document.documentElement.style.visibility = 'visible'; return true; }

    const token = localStorage.getItem('alsaeed_token');
    if (!token) { showLocked(courseId, 'سجّل الدخول واشترك في إحدى باقات البرنامج لفتح الدليل أو بنك المحاكاة الكامل.'); return false; }
    try {
      const response = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
      if (!response.ok) { showLocked(courseId, 'انتهت الجلسة. ارجع إلى المنصة وسجّل الدخول من جديد.'); return false; }
      const data = await response.json();
      const admin = data.user && data.user.role === 'admin';
      const active = (data.packages || []).some(p =>
        String(p.package_id || '').startsWith(courseId + '-') && (!p.expires || p.expires > Date.now()));
      if (!admin && !active) { showLocked(courseId, 'هذه المادة جزء من باقات ' + courseId.toUpperCase() + ' المدفوعة.'); return false; }
      document.documentElement.style.visibility = 'visible';
      return true;
    } catch (e) {
      showLocked(courseId, 'تعذّر التحقق من الاشتراك الآن. أعد المحاولة من داخل حسابك.');
      return false;
    }
  }

  window.LMS = { guard: guard };
})();
