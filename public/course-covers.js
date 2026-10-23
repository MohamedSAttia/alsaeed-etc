/* Original, course-specific educational artwork. Package tiers share their subject's cover. */
(function (global) {
  'use strict';
  const names = Object.freeze({
    pmp:'pmp', rmp:'rmp', acp:'acp', capm:'capm', pba:'pba', pgmp:'pgmp',
    lss:'lss', pmocp:'pmocp', p3o:'p3o', nebosh:'nebosh', aipro:'aipro',
    grcp:'governance', grca:'governance', grc:'governance', governance:'governance'
  });
  const labels = Object.freeze({
    pmp:'إدارة المشاريع وتحويل الخطط إلى نتائج', rmp:'تقييم المخاطر وحماية الأهداف',
    acp:'العمل الرشيق والتحسين المتكرر', capm:'أساسيات إدارة المشاريع',
    pba:'تحليل الأعمال والمتطلبات', pgmp:'تنسيق البرامج وتحقيق المنافع',
    lss:'الجودة وتحسين العمليات', pmocp:'مكتب إدارة المشاريع',
    p3o:'مكاتب المحافظ والبرامج والمشاريع', nebosh:'السلامة والصحة المهنية',
    aipro:'تطبيقات الذكاء الاصطناعي', governance:'الحوكمة والمخاطر والامتثال'
  });
  function key(courseId, packageId) {
    const course = String(courseId || '').toLowerCase();
    const pkg = String(packageId || '').toLowerCase().replace(/-(full|sim|review|self)$/, '');
    return names[course] || names[pkg] || '';
  }
  global.CourseCovers = Object.freeze({
    forCourse(courseId, packageId) { const id = key(courseId, packageId); return id ? '/assets/course-covers/' + id + '-v1.webp' : ''; },
    altForCourse(courseId, packageId) { return labels[key(courseId, packageId)] || ''; },
    courseIds: Object.freeze(Object.keys(names))
  });
})(window);
