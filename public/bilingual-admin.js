/* ============================================================
   منصة السعيد — حقول اللغتين في لوحة الإدارة
   عناوين الباقات · الفصول · الدروس — عربي وإنجليزي جنباً إلى جنب
   ============================================================ */
(function () {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => (window.APP && window.APP.esc) ? window.APP.esc(s)
  : String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* ═══ عنوان بلغة الواجهة ═══
   يقبل {ar,en} أو كائن درس {title,title_en} أو نصاً مفرداً */
window.biTitle = function (x) {
  if (!x) return '';
  const en = !!(window.I18 && window.I18.lang === 'en');
  if (typeof x === 'object') {
    if (x.ar !== undefined || x.en !== undefined)
      return (en ? (x.en || x.ar) : (x.ar || x.en)) || '';
    return en ? (x.title_en || x.t_en || x.title || x.t || '')
              : (x.title || x.t || x.title_en || x.t_en || '');
  }
  return String(x);
};

/* ═══ حقل مزدوج اللغة ═══
   يُنتج صفّين: عربي (RTL) وإنجليزي (LTR) بنفس التسمية */
function bi(opts) {
  const o = Object.assign({
    label: '', ar: '', en: '', keyAr: '', keyEn: '',
    ph: '', phEn: '', rows: 0, req: false, hint: ''
  }, opts);
  const fld = (val, key, dir, ph, flag) =>
    o.rows
      ? `<div class="bi-f">
           <span class="bi-flag">${flag}</span>
           <textarea data-bi="${esc(key)}" dir="${dir}" rows="${o.rows}"
             placeholder="${esc(ph)}">${esc(val)}</textarea>
         </div>`
      : `<div class="bi-f">
           <span class="bi-flag">${flag}</span>
           <input data-bi="${esc(key)}" dir="${dir}" value="${esc(val)}"
             placeholder="${esc(ph)}">
         </div>`;
  return `<div class="bi-wrap">
    <label class="bi-lbl">${esc(o.label)}${o.req ? '<em>*</em>' : ''}
      ${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</label>
    <div class="bi-grid">
      ${fld(o.ar, o.keyAr, 'rtl', o.ph || 'بالعربية', '🇸🇦')}
      ${fld(o.en, o.keyEn, 'ltr', o.phEn || 'In English', '🇬🇧')}
    </div>
  </div>`;
}
window.biField = bi;

/* ═══ محرّر الفصول بلغتين ═══ */
function chapters(list, onChange) {
  const rows = (list || []).map((c, i) => {
    const ar = typeof c === 'object' ? (c.ar || '') : String(c || '');
    const en = typeof c === 'object' ? (c.en || '') : '';
    return `<div class="ch-row" data-chi="${i}">
      <span class="ch-n">${i + 1}</span>
      <div class="ch-fields">
        <div class="bi-f"><span class="bi-flag">🇸🇦</span>
          <input data-cha="${i}" dir="rtl" value="${esc(ar)}" placeholder="اسم الفصل بالعربية"></div>
        <div class="bi-f"><span class="bi-flag">🇬🇧</span>
          <input data-chen="${i}" dir="ltr" value="${esc(en)}" placeholder="Chapter name in English"></div>
      </div>
      <div class="ch-acts">
        <button class="ch-b" data-chup="${i}" ${i === 0 ? 'disabled' : ''} title="لأعلى">▲</button>
        <button class="ch-b" data-chdn="${i}" ${i === list.length - 1 ? 'disabled' : ''} title="لأسفل">▼</button>
        <button class="ch-b d" data-chdel="${i}" title="حذف">✕</button>
      </div>
    </div>`;
  }).join('');
  return `<div class="ch-box">
    <div class="ch-hd"><b>📚 الفصول</b>
      <span class="muted">${(list || []).length} فصلاً — اكتب الاسم بالعربية والإنجليزية</span>
      <button class="btn o sm" id="chAdd">＋ أضف فصلاً</button></div>
    ${rows || '<div class="ch-empty">لا فصول بعد — أضف الفصل الأول.</div>'}
  </div>`;
}
window.biChapters = chapters;

/* ═══ صف الدرس بلغتين ═══ */
function lessonRow(l, i, chapterList) {
  return `<tr data-li="${i}">
    <td class="num">${i + 1}</td>
    <td>
      <div class="bi-f sm"><span class="bi-flag">🇸🇦</span>
        <input data-lt="${i}" dir="rtl" value="${esc(l.t || l.title || '')}"
          placeholder="عنوان الدرس بالعربية"></div>
      <div class="bi-f sm"><span class="bi-flag">🇬🇧</span>
        <input data-lten="${i}" dir="ltr" value="${esc(l.t_en || l.title_en || '')}"
          placeholder="Lesson title in English"></div>
    </td>
    <td><select data-lch="${i}">
      ${(chapterList || []).map((c, k) => {
        const nm = typeof c === 'object' ? (c.ar || c.en || '') : c;
        return `<option value="${k}" ${(l.ch || 0) === k ? 'selected' : ''}>${k + 1}. ${esc(nm)}</option>`;
      }).join('')}
    </select></td>
    <td><input class="num" data-ld="${i}" value="${esc(l.dur || l.duration || '')}"
      placeholder="12:30" style="text-align:center"></td>
    <td><input class="en" data-lv="${i}" value="${esc(l.vimeo || '')}" placeholder="912345678"></td>
    <td style="text-align:center"><input type="checkbox" data-lf="${i}" ${l.free ? 'checked' : ''}></td>
    <td style="white-space:nowrap">
      <button class="ch-b" data-lup="${i}">▲</button>
      <button class="ch-b" data-ldn="${i}">▼</button>
      <button class="ch-b d" data-ldel="${i}">✕</button>
    </td>
  </tr>`;
}
window.biLessonRow = lessonRow;

/* ═══ جمع القيم من النموذج ═══ */
window.biCollect = function () {
  const out = {};
  $$('[data-bi]').forEach(el => { out[el.dataset.bi] = el.value; });
  return out;
};
window.biCollectChapters = function () {
  const n = $$('[data-cha]').length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = ($(`[data-cha="${i}"]`) || {}).value || '';
    const e = ($(`[data-chen="${i}"]`) || {}).value || '';
    if (a.trim() || e.trim()) out.push({ ar: a.trim(), en: e.trim() });
  }
  return out;
};
window.biCollectLessons = function () {
  const n = $$('[data-lt]').length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const g = k => (($(`[data-${k}="${i}"]`) || {}).value || '');
    const t = g('lt'), te = g('lten');
    if (!t.trim() && !te.trim()) continue;
    out.push({
      t: t.trim(), t_en: te.trim(),
      ch: Number(($(`[data-lch="${i}"]`) || {}).value || 0),
      dur: g('ld').trim(),
      vimeo: g('lv').trim().replace(/^https?:\/\/(www\.)?vimeo\.com\//, '').replace(/[^0-9]/g, ''),
      free: !!(($(`[data-lf="${i}"]`) || {}).checked)
    });
  }
  return out;
};

/* ═══ مؤشّر اكتمال الترجمة ═══ */
window.biProgress = function (pkg, lessons) {
  const items = [];
  if (pkg) {
    items.push(['اسم الباقة', !!pkg.ar, !!pkg.en]);
    items.push(['الوصف', !!pkg.desc, !!pkg.desc_en]);
    const ch = pkg._chapters || [];
    if (ch.length) items.push([`الفصول (${ch.length})`,
      ch.every(c => typeof c === 'object' ? c.ar : c),
      ch.every(c => typeof c === 'object' && c.en)]);
  }
  if (lessons && lessons.length) {
    items.push([`الدروس (${lessons.length})`,
      lessons.every(l => l.t || l.title),
      lessons.every(l => l.t_en || l.title_en)]);
  }
  const arOk = items.filter(x => x[1]).length;
  const enOk = items.filter(x => x[2]).length;
  return `<div class="bi-prog">
    <b>حالة اللغتين</b>
    <div class="bi-pg">
      ${items.map(x => `<div class="bi-pr">
        <span>${esc(x[0])}</span>
        <i class="${x[1] ? 'ok' : 'no'}" title="العربية">🇸🇦</i>
        <i class="${x[2] ? 'ok' : 'no'}" title="الإنجليزية">🇬🇧</i>
      </div>`).join('')}
    </div>
    <span class="muted">${arOk}/${items.length} عربي · ${enOk}/${items.length} إنجليزي</span>
  </div>`;
};

/* ═══ ربط أزرار الفصول والدروس ═══ */
window.biBind = function (state, rerender) {
  const add = $('#chAdd');
  if (add) add.onclick = () => {
    state.chapters = window.biCollectChapters();
    state.chapters.push({ ar: '', en: '' });
    rerender();
  };
  $$('[data-chdel]').forEach(b => b.onclick = () => {
    state.chapters = window.biCollectChapters();
    state.chapters.splice(+b.dataset.chdel, 1);
    rerender();
  });
  const mv = (arr, i, d) => { const j = i + d;
    if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
  $$('[data-chup]').forEach(b => b.onclick = () => {
    state.chapters = window.biCollectChapters(); mv(state.chapters, +b.dataset.chup, -1); rerender(); });
  $$('[data-chdn]').forEach(b => b.onclick = () => {
    state.chapters = window.biCollectChapters(); mv(state.chapters, +b.dataset.chdn, 1); rerender(); });

  $$('[data-ldel]').forEach(b => b.onclick = () => {
    state.lessons = window.biCollectLessons();
    state.lessons.splice(+b.dataset.ldel, 1); rerender(); });
  $$('[data-lup]').forEach(b => b.onclick = () => {
    state.lessons = window.biCollectLessons(); mv(state.lessons, +b.dataset.lup, -1); rerender(); });
  $$('[data-ldn]').forEach(b => b.onclick = () => {
    state.lessons = window.biCollectLessons(); mv(state.lessons, +b.dataset.ldn, 1); rerender(); });
};
})();
