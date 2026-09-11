/* Al Saeed LMS V18 — package editor hotfix.
   Replaces the broken inline editPkg renderer without touching business logic. */
(function(){
  'use strict';

  function safe(v){
    try { return esc(v == null ? '' : v); }
    catch { return String(v == null ? '' : v).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c] || c)); }
  }

  window.editPkg = function editPkgHotfix(id){
    const api = A();
    const p = id ? api.pack(id) : null;
    const courses = Array.isArray(window.COURSES) ? window.COURSES : [];
    const types = Array.isArray(window.PKG_TYPES) ? window.PKG_TYPES : [];
    const kindsMaster = Array.isArray(window.CONTENT_KINDS) ? window.CONTENT_KINDS : [];
    const langLabel = window.LANG_LABEL || {};

    const courseOptions = courses.map(c =>
      '<option value="' + safe(c.id) + '" ' + (p && p.course === c.id ? 'selected' : '') + '>' +
      safe((typeof code === 'function' ? code(c) : (c.code || c.id || ''))) + ' — ' + safe(c.ar || '') + '</option>'
    ).join('');

    const typeOptions = types.map(t =>
      '<option value="' + safe(t.k) + '" ' + (p && p.type === t.k ? 'selected' : '') + '>' +
      safe((t.ic || '') + ' ' + (t.ar || t.k || '')) + '</option>'
    ).join('');

    const langOptions = Object.keys(langLabel).map(k =>
      '<option value="' + safe(k) + '" ' + (p && p.lang === k ? 'selected' : '') + '>' +
      safe((langLabel[k] && langLabel[k].ar) || k) + '</option>'
    ).join('');

    const kindOptions = kindsMaster.map(k =>
      '<label class="qtype"><input type="checkbox" data-pkind="' + safe(k.k) + '" ' +
      (p && Array.isArray(p.kinds) && p.kinds.includes(k.k) ? 'checked' : '') + '> ' +
      safe((k.ic || '') + ' ' + (k.ar || k.k || '')) + '</label>'
    ).join('');

    const objectives = p && Array.isArray(p.objectives) ? p.objectives.join('\n') : '';

    const html = [
      '<h3>' + (p ? 'تعديل باقة' : 'باقة جديدة') + '</h3>',
      '<label class="f"><span>المعرّف</span><input class="en" id="pId" value="' + safe(p ? p.id : '') + '" ' + (p ? 'disabled' : '') + '></label>',
      '<div class="f-row">',
        '<label class="f"><span>الدورة</span><select id="pCourse">' + courseOptions + '</select></label>',
        '<label class="f"><span>نوع الباقة</span><select id="pType">' + typeOptions + '</select></label>',
      '</div>',
      '<label class="f"><span>اسم الباقة بالعربية</span><input id="pAr" value="' + safe(p ? p.ar : '') + '" placeholder="يُولّد تلقائياً عند تركه فارغاً"></label>',
      '<label class="f"><span>اسم الباقة بالإنجليزية</span><input class="en" id="pEn" value="' + safe(p ? p.en : '') + '"></label>',
      '<label class="f"><span>الوصف</span><textarea id="pDesc" rows="2">' + safe(p ? p.desc : '') + '</textarea></label>',
      '<div class="f-row">',
        '<label class="f"><span>لغة الكورس</span><select id="pLang">' + langOptions + '</select></label>',
        '<label class="f"><span>تصنيف الدورة</span><input id="pCat" value="' + safe(p ? p.category : '') + '"></label>',
      '</div>',
      '<div class="f-row">',
        '<label class="f"><span>السعر</span><input type="number" id="pPrice" value="' + Number(p ? p.price : 100) + '"></label>',
        '<label class="f"><span>قبل الخصم</span><input type="number" id="pWas" value="' + Number(p ? p.was : 150) + '"></label>',
      '</div>',
      '<div class="f-row">',
        '<label class="f"><span>الفيديوهات</span><input type="number" id="pVid" value="' + Number(p ? p.videos : 0) + '"></label>',
        '<label class="f"><span>مدة الفيديو بالدقائق</span><input type="number" id="pVideoMins" value="' + Number(p ? p.videoMins : 0) + '"></label>',
      '</div>',
      '<div class="f-row">',
        '<label class="f"><span>عدد الأسئلة</span><input type="number" id="pQuestions" value="' + Number(p ? p.questions : 100) + '"></label>',
        '<label class="f"><span>اختبارات المحاكاة</span><input type="number" id="pQz" value="' + Number(p ? p.quizzes : 3) + '"></label>',
      '</div>',
      '<div class="f-row">',
        '<label class="f"><span>الاختبارات القصيرة</span><input type="number" id="pShort" value="' + Number(p ? p.shortQuizzes : 0) + '"></label>',
        '<label class="f"><span>أيام الوصول</span><input type="number" id="pDays" value="' + Number(p ? p.days : 90) + '"></label>',
      '</div>',
      '<div class="f-row">',
        '<label class="f"><span>الساعات المعتمدة</span><input type="number" id="pHours" value="' + Number(p ? p.hours : 30) + '"></label>',
        '<label class="f"><span>العملة</span><input class="en" id="pCurrency" value="' + safe(p ? p.currency : 'USD') + '"></label>',
      '</div>',
      '<label class="f"><span>مكوّنات الباقة</span><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:5px">' + kindOptions + '</div></label>',
      '<label class="f"><span>الأهداف <small>هدف في كل سطر</small></span><textarea id="pObjectives" rows="4">' + safe(objectives) + '</textarea></label>',
      '<label class="f"><span>الفئة المستهدفة</span><textarea id="pAudience" rows="2">' + safe(p ? p.audience : '') + '</textarea></label>',
      '<div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:14px">',
        '<label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="pCert" checked disabled><span>شهادة حضور — تُفعّل تلقائياً للكاملة فقط</span></label>',
        '<label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="pSys" ' + (p && p.hasSystem ? 'checked' : '') + '><span>تشمل نظاماً تطبيقياً</span></label>',
      '</div>',
      '<div class="mdl-act"><button class="btn p" id="pSave">حفظ</button><button class="btn o" data-close>إلغاء</button></div>'
    ].join('');

    api.modal(html, function(){
      $('#pSave').onclick = function(){
        const id2 = ($('#pId').value || '').trim();
        if (!id2) { api.toast('أكمل المعرّف'); return; }
        if (!p && Array.isArray(window.PACKAGES) && window.PACKAGES.some(x => x.id === id2)) { api.toast('المعرّف مستخدم'); return; }

        const courseId = $('#pCourse').value;
        const c = api.course(courseId) || {};
        const type = $('#pType').value;
        const T = types.find(x => x.k === type) || {};
        const selectedKinds = $$('[data-pkind]').filter(x => x.checked).map(x => x.dataset.pkind);
        const mode = type === 'sim' ? 'sim' : type === 'self' ? 'self' : 'recorded';
        const tracks = Array.isArray(window.TRACKS) ? window.TRACKS : [];
        const qb = (window.QUESTION_BANK || {})[courseId] || [];
        const fallbackAudience = (typeof defaultAudience === 'function') ? defaultAudience(c) : '';

        const obj = {
          id: id2,
          schemaVersion: 15,
          type: type,
          ar: $('#pAr').value.trim() || ((c.code || courseId) + ' — ' + (T.ar || type)),
          en: $('#pEn').value.trim() || ((c.code || courseId) + ' — ' + (T.en || type)),
          desc: $('#pDesc').value.trim() || T.blurb || '',
          course: courseId,
          mode: mode,
          price: +$('#pPrice').value || 0,
          was: +$('#pWas').value || 0,
          currency: $('#pCurrency').value.trim() || 'USD',
          hours: +$('#pHours').value || 0,
          category: $('#pCat').value.trim() || (((tracks.find(x => x.k === c.track) || {}).ar) || ''),
          questions: +$('#pQuestions').value || 0,
          videos: +$('#pVid').value || 0,
          videoMins: +$('#pVideoMins').value || 0,
          quizzes: +$('#pQz').value || 0,
          shortQuizzes: +$('#pShort').value || 0,
          lang: $('#pLang').value,
          days: +$('#pDays').value || 90,
          hasSystem: $('#pSys').checked,
          cert: type === 'full',
          kinds: selectedKinds,
          objectives: $('#pObjectives').value.split(/\r?\n/).map(x => x.trim()).filter(Boolean),
          audience: $('#pAudience').value.trim() || fallbackAudience,
          chapters: Array.isArray(c.chapters) ? c.chapters : [],
          questionTypes: [...new Set(qb.map(x => x && x.type).filter(Boolean))],
          includes: selectedKinds.map(k => {
            const x = kindsMaster.find(y => y.k === k);
            return x ? ((x.ar || k) + ' — ' + (x.desc || '')) : k;
          })
        };

        if (p) Object.assign(p, obj);
        else {
          if (!Array.isArray(window.PACKAGES)) window.PACKAGES = [];
          window.PACKAGES.push(obj);
        }
        if (window.ensureLessonSkeletons) window.ensureLessonSkeletons();
        if (typeof saveCatalog === 'function') saveCatalog();
        api.closeModal();
        api.render();
        api.toast('✅ حُفظت الباقة');
      };
    });
  };
})();
