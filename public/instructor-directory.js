/* Public instructor display uses the published association or owner-selected default. */
(function (root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const asset = value => typeof value === 'string' && /^\/assets\/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp|svg)$/.test(value) && !value.includes('..') ? value : '';
  const profiles = () => Array.isArray(root.INSTRUCTORS) ? root.INSTRUCTORS : [];
  function forPackage(pkg) {
    if(!pkg)return null;
    const assigned=pkg.instructorId!==null&&pkg.instructorId!==undefined&&pkg.instructorId!=='';
    const id=assigned?pkg.instructorId:root.DEFAULT_INSTRUCTOR_ID;
    return id ? profiles().find(x => x.id === id && x.active !== false) || null : null;
  }
  function forCourse(courseId) {
    const ids = new Set();
    return (root.PACKAGES || []).filter(p => p.course === courseId && p.active !== false).map(forPackage).filter(p => p && !ids.has(p.id) && ids.add(p.id));
  }
  function name(profile, en) { return profile ? (en ? profile.nameEn || profile.nameAr : profile.nameAr || profile.nameEn) : ''; }
  function card(profile, courseId, en, compact) {
    if (!profile) return `<div class="instructor-pending"><span>${en ? 'Instructor' : 'المدرّب'}</span> · ${en ? 'To be confirmed' : 'يُعلن قريبًا'}</div>`;
    const badge = (profile.badges || []).find(b => b.verified === true && b.courseId === courseId && asset(b.asset));
    const title = en ? profile.titleEn || profile.titleAr : profile.titleAr || profile.titleEn;
    return `<div class="v40-instructor-badge instructor-profile ${compact ? 'compact' : ''}" data-instructor-id="${esc(profile.id)}">${badge ? `<img src="${esc(asset(badge.asset))}" alt="${esc(badge.label || (en ? 'Instructor credential' : 'اعتماد المدرّب'))}" loading="lazy" width="84" height="86">` : ''}<div><small>${en ? 'Instructor' : 'المدرّب'}</small><b dir="auto">${esc(name(profile,en))}</b>${title ? `<span dir="auto">${esc(title)}</span>` : ''}</div></div>`;
  }
  function renderPackage(pkg,en=false,compact=true) { return card(forPackage(pkg),pkg?.course,en,compact); }
  function renderCourse(courseId,en=false,compact=true) {
    const list=forCourse(courseId);
    return list.length ? list.map(p=>card(p,courseId,en,compact)).join('') : card(null,courseId,en,compact);
  }
  root.InstructorDirectory = Object.freeze({forPackage,forCourse,name,card,renderPackage,renderCourse});
})(window);
