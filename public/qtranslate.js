/* ============================================================
   منصة السعيد — أداة ترجمة الأسئلة ومراجعتها
   ترجمة بشرية بمساعدة معجم المصطلحات · مراجعة واعتماد
   ============================================================ */
(function () {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => (window.APP && window.APP.esc) ? window.APP.esc(s)
  : String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* ═══ معجم المصطلحات المعتمد — يضمن اتساق الترجمة ═══ */
const GLOSSARY = {
  'project manager':'مدير المشروع', 'project sponsor':'راعي المشروع',
  'stakeholder':'صاحب المصلحة', 'stakeholders':'أصحاب المصلحة',
  'project charter':'ميثاق المشروع', 'business case':'دراسة الجدوى',
  'scope':'النطاق', 'scope creep':'زحف النطاق', 'baseline':'خط الأساس',
  'deliverable':'مُخرَج', 'deliverables':'المخرجات', 'milestone':'معلَم',
  'work breakdown structure':'هيكل تجزئة العمل', 'wbs':'هيكل تجزئة العمل',
  'critical path':'المسار الحرج', 'float':'الفائض الزمني', 'slack':'الفائض الزمني',
  'earned value':'القيمة المكتسبة', 'planned value':'القيمة المخطّطة',
  'actual cost':'التكلفة الفعلية', 'cost variance':'انحراف التكلفة',
  'schedule variance':'انحراف الجدول', 'cpi':'مؤشر أداء التكلفة',
  'spi':'مؤشر أداء الجدول', 'eac':'التقدير عند الإنجاز',
  'etc':'التقدير حتى الإنجاز', 'bac':'الميزانية عند الإنجاز',
  'risk register':'سجل المخاطر', 'risk response':'الاستجابة للمخاطر',
  'contingency reserve':'احتياطي الطوارئ', 'management reserve':'الاحتياطي الإداري',
  'issue log':'سجل المشكلات', 'lessons learned':'الدروس المستفادة',
  'change control board':'مجلس ضبط التغيير', 'change request':'طلب تغيير',
  'configuration management':'إدارة التهيئة', 'quality assurance':'ضمان الجودة',
  'quality control':'ضبط الجودة', 'cost of quality':'تكلفة الجودة',
  'procurement':'المشتريات', 'contract':'العقد', 'vendor':'المورّد',
  'statement of work':'بيان العمل', 'rfp':'طلب عرض',
  'agile':'رشيق', 'scrum':'سكرم', 'sprint':'سباق', 'backlog':'قائمة الأعمال',
  'product owner':'مالك المنتج', 'scrum master':'مدير سكرم',
  'user story':'قصة المستخدم', 'velocity':'سرعة الإنجاز',
  'retrospective':'الاستعادة', 'daily standup':'الاجتماع اليومي',
  'burndown chart':'مخطط الإنجاز المتناقص', 'kanban':'كانبان',
  'predictive':'تتابعي', 'hybrid':'هجين', 'iteration':'تكرار',
  'servant leadership':'القيادة الخادمة', 'escalate':'تصعيد',
  'escalation':'التصعيد', 'governance':'الحوكمة', 'compliance':'الامتثال',
  'organizational process assets':'أصول العمليات التنظيمية',
  'enterprise environmental factors':'العوامل البيئية للمؤسسة',
  'opa':'أصول العمليات التنظيمية', 'eef':'العوامل البيئية للمؤسسة',
  'resource':'مورد', 'resources':'الموارد', 'team':'الفريق',
  'impediment':'عائق', 'blocker':'معوّق', 'root cause':'السبب الجذري',
  'value delivery':'تسليم القيمة', 'benefits realization':'تحقيق المنافع',
  'sustainability':'الاستدامة', 'artifact':'أداة توثيق'
};

/* الجمل الافتتاحية الشائعة — تُترجَم بصياغة موحّدة */
const STEMS = [
  [/^what should the project manager do (next|first)\??$/i, 'ماذا يجب على مدير المشروع أن يفعل $1؟', {next:'تالياً', first:'أولاً'}],
  [/^what should the project manager do\??$/i, 'ماذا يجب على مدير المشروع أن يفعل؟'],
  [/^which of the following/i, 'أيٌّ ممّا يلي'],
  [/^what is the (best|most appropriate) (action|response|approach)/i, 'ما $1 $2'],
  [/^how should the project manager/i, 'كيف ينبغي لمدير المشروع أن'],
  [/^the project manager should/i, 'ينبغي لمدير المشروع أن']
];

/* ═══ مسوّدة ترجمة تُراجَع بشرياً ═══ */
function draft(text) {
  if (!text) return '';
  let t = String(text);
  /* استبدل المصطلحات المعتمدة */
  const found = [];
  Object.keys(GLOSSARY).sort((a, b) => b.length - a.length).forEach(k => {
    const re = new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    if (re.test(t)) found.push([k, GLOSSARY[k]]);
  });
  return { src: t, terms: found };
}

/* ═══ حالة المراجعة ═══ */
const ST = {
  list: [], idx: 0, filter: 'todo', course: 'pmp', q: ''
};

function load() {
  const b = window.QBANK || [];
  ST.list = b.filter(q => {
    if (ST.course && q.course !== ST.course) return false;
    const hasAr = !!(q.q && q.q.ar && q.o && q.o.ar && q.o.ar.length);
    const hasEn = !!(q.q && q.q.en);
    if (ST.filter === 'todo') return hasEn && !hasAr;
    if (ST.filter === 'done') return hasAr;
    if (ST.filter === 'review') return q.review === 'NEEDS REVIEW';
    return true;
  });
  if (ST.q) {
    const s = ST.q.toLowerCase();
    ST.list = ST.list.filter(q =>
      ((q.q && (q.q.en || '')) + (q.q && (q.q.ar || ''))).toLowerCase().includes(s));
  }
  if (ST.idx >= ST.list.length) ST.idx = 0;
}

window.QTranslate = {
  view() {
    load();
    const b = window.QBANK || [];
    const stats = {
      total: b.length,
      ar: b.filter(q => q.q && q.q.ar).length,
      both: b.filter(q => q.q && q.q.ar && q.q.en).length,
      todo: b.filter(q => q.q && q.q.en && !(q.q.ar)).length
    };
    const q = ST.list[ST.idx];

    return `<div class="qt-wrap">
      <div class="qt-hd">
        <div><h2>ترجمة الأسئلة ومراجعتها</h2>
          <p class="muted">ترجمة بشرية بمعجم مصطلحات موحّد — أنت تكتب والنظام يضمن الاتساق.</p></div>
      </div>

      <div class="grid g4 mb">
        <div class="stat"><b class="num">${stats.total}</b><span>سؤالاً في البنك</span></div>
        <div class="stat"><b class="num">${stats.both}</b><span>ثنائي اللغة</span></div>
        <div class="stat"><b class="num">${stats.todo}</b><span>بانتظار الترجمة</span></div>
        <div class="stat hl"><b class="num">${Math.round(stats.both / Math.max(stats.total,1) * 100)}%</b>
          <span>نسبة الاكتمال</span></div>
      </div>

      <div class="filters">
        <div class="frow"><b>الحالة</b>
          ${[['todo','بانتظار الترجمة'],['done','مترجمة'],['review','تحتاج مراجعة'],['all','الكل']]
            .map(([k,l]) => `<button class="fchip ${ST.filter===k?'on':''}" data-qtf="${k}">${l}</button>`).join('')}
        </div>
        <div class="frow"><b>البرنامج</b>
          ${['pmp','rmp','capm'].map(c => `<button class="fchip ${ST.course===c?'on':''}"
            data-qtc="${c}">${c.toUpperCase()}</button>`).join('')}
          <input id="qtSearch" placeholder="🔍 ابحث في النص…" value="${esc(ST.q)}"
            style="max-width:230px;padding:7px 12px;font-size:.84rem">
        </div>
      </div>

      ${!q ? `<div class="empty"><div class="ic">✅</div><b>لا أسئلة بهذا الفلتر</b></div>` : `
      <div class="qt-nav">
        <button class="btn o sm" id="qtPrev" ${ST.idx===0?'disabled':''}>◀ السابق</button>
        <span class="qt-pos">سؤال <b class="num">${ST.idx+1}</b> من <b class="num">${ST.list.length}</b>
          · <span class="code">${esc(q.id||'')}</span></span>
        <button class="btn o sm" id="qtNext" ${ST.idx>=ST.list.length-1?'disabled':''}>التالي ▶</button>
      </div>

      <div class="qt-grid">
        <div class="qt-col">
          <div class="qt-lbl en">🇬🇧 الأصل الإنجليزي</div>
          <div class="qt-src">${esc((q.q&&q.q.en)||'—')}</div>
          <div class="qt-opts">
            ${(((q.o&&q.o.en)||[])).map((o,i)=>`<div class="qt-o${(q.c||[]).includes(i)?' right':''}">
              <span>${String.fromCharCode(65+i)}</span>${esc(o)}</div>`).join('')}
          </div>
          ${(q.x&&q.x.en) ? `<div class="qt-lbl en" style="margin-top:14px">الشرح</div>
            <div class="qt-src sm">${esc(q.x.en)}</div>` : ''}
        </div>

        <div class="qt-col">
          <div class="qt-lbl ar">🇸🇦 الترجمة العربية</div>
          <textarea class="qt-in" id="qtQ" rows="4"
            placeholder="اكتب ترجمة السؤال…">${esc((q.q&&q.q.ar)||'')}</textarea>
          <div class="qt-opts">
            ${(((q.o&&q.o.en)||[])).map((o,i)=>`<div class="qt-oin${(q.c||[]).includes(i)?' right':''}">
              <span>${String.fromCharCode(65+i)}</span>
              <input data-qto="${i}" value="${esc(((q.o&&q.o.ar)||[])[i]||'')}"
                placeholder="ترجمة الخيار ${String.fromCharCode(65+i)}"></div>`).join('')}
          </div>
          <div class="qt-lbl ar" style="margin-top:14px">الشرح بالعربية</div>
          <textarea class="qt-in" id="qtX" rows="3"
            placeholder="اكتب شرح الإجابة…">${esc((q.x&&q.x.ar)||'')}</textarea>
        </div>
      </div>

      ${(() => {
        const d = draft((q.q&&q.q.en)||'');
        return d.terms && d.terms.length ? `<div class="qt-gloss">
          <b>📖 مصطلحات في هذا السؤال — استخدم الترجمة المعتمدة:</b>
          <div class="qt-terms">${d.terms.slice(0,12).map(t =>
            `<span><em>${esc(t[0])}</em> ← <b>${esc(t[1])}</b></span>`).join('')}</div>
        </div>` : '';
      })()}

      <div class="qt-act">
        <button class="btn p" id="qtSave">💾 احفظ واذهب للتالي</button>
        <button class="btn o" id="qtSaveOnly">حفظ فقط</button>
        <button class="btn o" id="qtFlag">⚑ علّم للمراجعة</button>
        <button class="btn o" id="qtSkip">تخطَّ ←</button>
        <span class="muted" style="margin-inline-start:auto;align-self:center;font-size:.82rem">
          ${q.review==='NEEDS REVIEW' ? '⚠️ مُعلَّم للمراجعة' : ''}
        </span>
      </div>

      <div class="qt-bulk">
        <b>عمليات جماعية</b>
        <button class="btn o sm" id="qtExport">⬇ صدّر غير المترجمة (JSON)</button>
        <button class="btn o sm" id="qtImport">⬆ استورد ترجمات</button>
        <input type="file" id="qtFile" accept=".json" style="display:none">
        <span class="muted" style="font-size:.8rem">
          صدّرها · ترجمها في أداتك المفضّلة · استوردها مرة واحدة.</span>
      </div>`}
    </div>`;
  },

  bind() {
    $$('[data-qtf]').forEach(b => b.onclick = () => { ST.filter = b.dataset.qtf; ST.idx = 0; re(); });
    $$('[data-qtc]').forEach(b => b.onclick = () => { ST.course = b.dataset.qtc; ST.idx = 0; re(); });
    const s = $('#qtSearch');
    if (s) s.oninput = () => { clearTimeout(window._qtT);
      window._qtT = setTimeout(() => { ST.q = s.value; ST.idx = 0; re();
        const e = $('#qtSearch'); if (e) { e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }, 400); };
    const pv = $('#qtPrev'); if (pv) pv.onclick = () => { if (ST.idx > 0) { ST.idx--; re(); } };
    const nx = $('#qtNext'); if (nx) nx.onclick = () => { if (ST.idx < ST.list.length - 1) { ST.idx++; re(); } };
    const sk = $('#qtSkip'); if (sk) sk.onclick = () => { ST.idx++; re(); };

    const grab = () => {
      const q = ST.list[ST.idx]; if (!q) return null;
      q.q = q.q || {}; q.o = q.o || {}; q.x = q.x || {};
      q.q.ar = ($('#qtQ') || {}).value || '';
      q.o.ar = $$('[data-qto]').map(i => i.value || '');
      q.x.ar = ($('#qtX') || {}).value || '';
      if (q.q.ar && q.o.ar.filter(Boolean).length >= 2) q.review = 'ok';
      return q;
    };
    const persist = () => {
      try { localStorage.setItem('qbank_translations',
        JSON.stringify((window.QBANK||[]).filter(x => x.q && x.q.ar)
          .map(x => ({ id:x.id, q:x.q.ar, o:x.o.ar, x:x.x&&x.x.ar, review:x.review })))); } catch(e){}
      if (window.APP && window.APP.live && window.APP.api)
        window.APP.api('/admin/question-translations', { method:'PUT',
          body: (window.QBANK||[]).filter(x => x.q && x.q.ar)
            .map(x => ({ id:x.id, question_ar:x.q.ar, options_ar:x.o.ar,
                         explanation_ar:x.x&&x.x.ar, review:x.review })) }).catch(()=>{});
    };

    const sv = $('#qtSave');
    if (sv) sv.onclick = () => { grab(); persist();
      if (window.APP) window.APP.toast('✅ حُفظت الترجمة');
      ST.idx++; re(); };
    const so = $('#qtSaveOnly');
    if (so) so.onclick = () => { grab(); persist();
      if (window.APP) window.APP.toast('✅ حُفظت'); re(); };
    const fl = $('#qtFlag');
    if (fl) fl.onclick = () => { const q = grab(); if (q) q.review = 'NEEDS REVIEW';
      persist(); if (window.APP) window.APP.toast('⚑ عُلّم للمراجعة'); re(); };

    const ex = $('#qtExport');
    if (ex) ex.onclick = () => {
      const todo = (window.QBANK||[]).filter(q =>
        q.q && q.q.en && !(q.q.ar)).map(q => ({
          id:q.id, course:q.course, domain:q.domain,
          question_en:q.q.en, options_en:(q.o&&q.o.en)||[],
          explanation_en:(q.x&&q.x.en)||'', correct:q.c,
          question_ar:'', options_ar:['','','',''], explanation_ar:''
        }));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(todo, null, 1)],
        { type:'application/json' }));
      a.download = 'questions-to-translate.json'; a.click();
      if (window.APP) window.APP.toast(`⬇ صُدّر ${todo.length} سؤالاً`);
    };
    const im = $('#qtImport');
    if (im) im.onclick = () => $('#qtFile').click();
    const f = $('#qtFile');
    if (f) f.onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const rows = JSON.parse(rd.result);
          let n = 0;
          rows.forEach(r => {
            const q = (window.QBANK||[]).find(x => x.id === r.id);
            if (!q || !r.question_ar) return;
            q.q = q.q||{}; q.o = q.o||{}; q.x = q.x||{};
            q.q.ar = r.question_ar;
            if (Array.isArray(r.options_ar) && r.options_ar.filter(Boolean).length) q.o.ar = r.options_ar;
            if (r.explanation_ar) q.x.ar = r.explanation_ar;
            q.review = 'ok'; n++;
          });
          persist(); re();
          if (window.APP) window.APP.toast(`⬆ استُوردت ${n} ترجمة`);
        } catch (er) { if (window.APP) window.APP.toast('ملف غير صالح'); }
      };
      rd.readAsText(file);
    };
  },

  /* دمج الترجمات المحفوظة عند الإقلاع */
  restore() {
    try {
      const saved = JSON.parse(localStorage.getItem('qbank_translations') || '[]');
      saved.forEach(s => {
        const q = (window.QBANK||[]).find(x => x.id === s.id);
        if (!q) return;
        q.q = q.q||{}; q.o = q.o||{}; q.x = q.x||{};
        if (s.q) q.q.ar = s.q;
        if (s.o) q.o.ar = s.o;
        if (s.x) q.x.ar = s.x;
        if (s.review) q.review = s.review;
      });
      return saved.length;
    } catch (e) { return 0; }
  },
  GLOSSARY
};

function re() {
  const h = $('#qtHost') || $('#app');
  if (!h) return;
  h.innerHTML = window.QTranslate.view();
  window.QTranslate.bind();
}
window.QTranslate.render = re;
})();
