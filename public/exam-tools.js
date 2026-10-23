/* Attempt-owned workspace. The exam engine owns persistence and session identity. */
(function () {
  'use strict';
  const LIMITS = { strokes: 160, points: 12000, perStroke: 1200, note: 8000, notes: 300, expression: 160 };
  const COLORS = ['#172554', '#2563eb', '#dc2626', '#15803d'];
  let active = null;
  const words = {
    en: { whiteboard: 'Whiteboard', notes: 'Question notes', calculator: 'Calculator', close: 'Close', color: 'Ink color', width: 'Line width', pen: 'Pen', eraser: 'Eraser', undo: 'Undo stroke', clear: 'Clear board', note: 'Private notes for this question', hint: 'Notes and drawings belong to this attempt, not your answer. Use notes as a keyboard-accessible alternative to drawing.', canvas: 'Drawing surface. Use a pointer or touch to draw; use the question notes below for keyboard input.', cap: 'Workspace limit reached. Undo or clear strokes to continue.', expression: 'Expression', calculate: 'Calculate', clearCalc: 'Clear calculation', backspace: 'Delete last character', invalid: 'Enter a valid arithmetic expression.', zero: 'Cannot divide by zero.', large: 'Result is outside the supported range.', result: 'Result', saved: 'Saved for this attempt', unavailable: 'Drawing is unavailable in this browser. You can still use the notes below.' },
    ar: { whiteboard: 'السبورة', notes: 'ملاحظات السؤال', calculator: 'الآلة الحاسبة', close: 'إغلاق', color: 'لون القلم', width: 'سُمك الخط', pen: 'قلم', eraser: 'ممحاة', undo: 'تراجع عن الخط', clear: 'مسح السبورة', note: 'ملاحظات خاصة بهذا السؤال', hint: 'الملاحظات والرسومات تخص هذه المحاولة وليست إجابة. يمكنك استخدام الملاحظات بلوحة المفاتيح بديلاً للرسم.', canvas: 'مساحة للرسم بالمؤشر أو اللمس؛ استخدم ملاحظات السؤال أدناه للإدخال بلوحة المفاتيح.', cap: 'تم بلوغ حد مساحة العمل. تراجع عن خطوط أو امسح السبورة للمتابعة.', expression: 'العملية الحسابية', calculate: 'احسب', clearCalc: 'مسح العملية', backspace: 'حذف آخر رمز', invalid: 'أدخل عملية حسابية صحيحة.', zero: 'لا يمكن القسمة على صفر.', large: 'النتيجة خارج النطاق المدعوم.', result: 'النتيجة', saved: 'حُفظت لهذه المحاولة', unavailable: 'الرسم غير متاح في هذا المتصفح. يمكنك استخدام الملاحظات أدناه.' }
  };
  // Recursive descent over a deliberately small arithmetic grammar. Never executes code.
  function calculate(input) {
    const source = String(input).replace(/[×]/g, '*').replace(/[÷]/g, '/').replace(/[−]/g, '-').replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/٫/g, '.');
    if (!source.trim() || source.length > LIMITS.expression || /[^\d\s.+\-*/()%]/.test(source)) throw Error('invalid');
    let i = 0, depth = 0;
    const space = () => { while (/\s/.test(source[i] || '') && i < source.length) i++; };
    const take = c => { space(); if (source[i] === c) { i++; return true; } return false; };
    function atom() {
      if (++depth > 40) throw Error('invalid');
      let value;
      if (take('+')) value = atom();
      else if (take('-')) value = -atom();
      else if (take('(')) { value = sum(); if (!take(')')) throw Error('invalid'); }
      else { space(); const match = source.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)/); if (!match) throw Error('invalid'); i += match[0].length; value = Number(match[0]); }
      while (take('%')) value /= 100;
      depth--; return value;
    }
    function product() { let value = atom(); for (;;) { if (take('*')) value *= atom(); else if (take('/')) { const divisor = atom(); if (divisor === 0) throw Error('zero'); value /= divisor; } else return value; } }
    function sum() { let value = product(); for (;;) { if (take('+')) value += product(); else if (take('-')) value -= product(); else return value; } }
    const value = sum(); space(); if (i !== source.length) throw Error('invalid');
    if (!Number.isFinite(value) || Math.abs(value) > 1e100) throw Error('large');
    return String(Number(value.toPrecision(12)));
  }
  function current(session) { try { return active === session && session.context.ownerId === session.ownerId && session.context.attemptKey === session.attemptKey && session.context.questionId === session.questionId && session.context.data === session.data && session.context.isCurrent() === true; } catch (_) { return false; } }
  function element(tag, attrs, text) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
    if (text != null) node.textContent = text;
    return node;
  }
  function close() {
    const session = active; if (!session) return;
    const restoreFocus = current(session);
    if (restoreFocus && session.flush) session.flush();
    active = null;
    session.cleanup.forEach(fn => fn());
    session.inert.forEach(([node, wasInert]) => { if (!wasInert) node.removeAttribute('inert'); });
    session.portal.remove();
    if (restoreFocus && session.previous?.isConnected && !session.previous.closest('[inert]')) session.previous.focus();
  }
  function open(kind, context) {
    close();
    if (!['whiteboard', 'notes', 'calculator'].includes(kind) || !context || typeof context.isCurrent !== 'function' || !context.ownerId || !context.attemptKey || !context.questionId || !context.data || typeof context.data !== 'object' || Array.isArray(context.data)) return false;
    const session = { context, ownerId: context.ownerId, attemptKey: context.attemptKey, questionId: context.questionId, data: context.data, previous: document.activeElement, cleanup: [], inert: [], portal: null };
    active = session; if (!current(session)) { active = null; return false; }
    const data = context.data, w = words[context.lang === 'ar' ? 'ar' : 'en'];
    // Sanitize resumed JSON, including legacy or oversized snapshots, before rendering.
    data.version = 1;
    let pointCount = 0;
    data.strokes = (Array.isArray(data.strokes) ? data.strokes : []).slice(-LIMITS.strokes).flatMap(stroke => {
      if (!stroke || !Array.isArray(stroke.points)) return [];
      const points = stroke.points.slice(0, LIMITS.perStroke).filter(p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isFinite(n) && n >= 0 && n <= 1)).slice(0, LIMITS.points - pointCount).map(p => [p[0], p[1]]);
      pointCount += points.length;
      return points.length ? [{ color: COLORS.includes(stroke.color) ? stroke.color : COLORS[0], width: [2, 4, 8].includes(stroke.width) ? stroke.width : 4, erase: stroke.erase === true, points }] : [];
    });
    const notes = {};
    Object.entries(data.notes && typeof data.notes === 'object' ? data.notes : {}).slice(0, LIMITS.notes).forEach(([key, value]) => { if (!['__proto__', 'constructor', 'prototype'].includes(key) && typeof value === 'string') notes[key] = value.slice(0, LIMITS.note); });
    data.notes = notes;
    data.calculator = { expression: String(data.calculator?.expression || '').slice(0, LIMITS.expression), result: '' };
    const questionKey = String(context.questionId);
    if (['__proto__', 'constructor', 'prototype'].includes(questionKey) || questionKey.length > 200) { active = null; return false; }
    const portal = element('div', { class: 'exam-tools-portal' }); session.portal = portal;
    const dialog = element('section', { class: 'exam-tools-dialog', role: 'dialog', 'data-exam-language': context.lang === 'ar' ? 'ar' : 'en', 'aria-modal': 'true', 'aria-labelledby': 'exam-tools-title', dir: context.lang === 'ar' ? 'rtl' : 'ltr', lang: context.lang === 'ar' ? 'ar' : 'en', tabindex: '-1' });
    const header = element('header', { class: 'exam-tools-header' }); header.append(element('h2', { id: 'exam-tools-title' }, w[kind]));
    function button(label, handler, attrs) { const btn = element('button', Object.assign({ type: 'button' }, attrs), label); btn.addEventListener('click', () => { if (current(session)) handler(); else if (active === session) close(); }); return btn; }
    const dismiss = button(w.close, close, { class: 'exam-tools-close' }); header.append(dismiss); dialog.append(header, element('p', { class: 'exam-tools-hint' }, w.hint));
    const status = element('p', { role: 'status', 'aria-live': 'polite', class: 'exam-tools-status' });
    let saveTimer = null;
    function flush() {
      if (saveTimer !== null) { window.clearTimeout(saveTimer); saveTimer = null; }
      if (!current(session) || !session.dirty) return;
      session.dirty = false;
      if (typeof context.onChange === 'function') context.onChange(data);
    }
    function save(immediate) {
      if (!current(session)) return;
      session.dirty = true;
      if (immediate) { flush(); return; }
      if (saveTimer !== null) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(flush, 250);
    }
    session.flush = flush;
    session.cleanup.push(() => { if (saveTimer !== null) window.clearTimeout(saveTimer); });
    function addNotes() {
      const label = element('label', { for: 'exam-tools-notes' }, w.note);
      const note = element('textarea', { id: 'exam-tools-notes', maxlength: String(LIMITS.note), rows: kind === 'notes' ? '12' : '3' });
      note.value = data.notes[questionKey] || '';
      note.addEventListener('input', () => { if (!current(session)) return; if (!Object.prototype.hasOwnProperty.call(data.notes, questionKey) && Object.keys(data.notes).length >= LIMITS.notes) { status.textContent = w.cap; return; } data.notes[questionKey] = note.value.slice(0, LIMITS.note); save(); });
      dialog.append(label, note);
    }
    if (kind === 'calculator') {
      const input = element('input', { id: 'exam-tools-expression', maxlength: String(LIMITS.expression), type: 'text', inputmode: 'decimal', dir: 'ltr', autocomplete: 'off', spellcheck: 'false' }); input.value = data.calculator.expression;
      const output = element('output', { 'aria-label': w.result, 'aria-live': 'polite', class: 'exam-tools-result', dir: 'ltr' });
      function evaluate() { if (!current(session)) return; try { data.calculator.result = calculate(input.value); output.textContent = data.calculator.result; status.textContent = ''; } catch (err) { data.calculator.result = ''; output.textContent = ''; status.textContent = w[err.message] || w.invalid; } save(); }
      input.addEventListener('input', () => { if (!current(session)) return; data.calculator.expression = input.value.slice(0, LIMITS.expression); data.calculator.result = ''; output.textContent = ''; save(); });
      input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); evaluate(); } });
      const keypad = element('div', { class: 'exam-tools-keypad', dir: 'ltr', role: 'group', 'aria-label': w.calculator });
      ['(', ')', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '⌫', 'C'].forEach(key => {
        keypad.append(button(key, () => {
          const start = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? start;
          let value, caret;
          if (key === 'C') { value = ''; caret = 0; }
          else if (key === '⌫') { const from = start === end ? Math.max(0, start - 1) : start; value = input.value.slice(0, from) + input.value.slice(end); caret = from; }
          else { value = input.value.slice(0, start) + key + input.value.slice(end); caret = start + 1; }
          input.value = value.slice(0, LIMITS.expression); data.calculator.expression = input.value; data.calculator.result = ''; output.textContent = ''; status.textContent = ''; save();
          if (current(session)) { input.focus(); input.setSelectionRange(caret, caret); }
        }, key === 'C' ? { 'aria-label': w.clearCalc } : key === '⌫' ? { 'aria-label': w.backspace } : {}));
      });
      dialog.append(element('label', { for: input.id }, w.expression), input, element('p', { class: 'exam-tools-hint', dir: 'ltr' }, '+  −  ×  ÷  ( )  %   ·   50% = 0.5'), keypad, button(w.calculate, evaluate), output);
    }
    if (kind === 'whiteboard') {
      let color = COLORS[0], width = 4, erase = false, drawing = null, pointer = null;
      const toolbar = element('div', { class: 'exam-tools-toolbar', role: 'group', 'aria-label': w.whiteboard });
      const colorInput = element('select', { id: 'exam-tools-color', 'aria-label': w.color });
      const colorNames = context.lang === 'ar' ? ['كحلي', 'أزرق', 'أحمر', 'أخضر'] : ['Navy', 'Blue', 'Red', 'Green'];
      COLORS.forEach((c, index) => colorInput.append(element('option', { value: c }, colorNames[index])));
      colorInput.addEventListener('change', () => { if (current(session)) color = colorInput.value; });
      const widthInput = element('select', { id: 'exam-tools-width', 'aria-label': w.width }); [2, 4, 8].forEach(n => widthInput.append(element('option', { value: n }, String(n)))); widthInput.value = '4'; widthInput.addEventListener('change', () => { if (current(session)) width = Number(widthInput.value); });
      const pen = button(w.pen, () => { erase = false; pen.setAttribute('aria-pressed', 'true'); rubber.setAttribute('aria-pressed', 'false'); }, { 'aria-pressed': 'true' });
      const rubber = button(w.eraser, () => { erase = true; pen.setAttribute('aria-pressed', 'false'); rubber.setAttribute('aria-pressed', 'true'); }, { 'aria-pressed': 'false' });
      const canvas = element('canvas', { class: 'exam-tools-canvas', 'aria-label': w.canvas, role: 'img' });
      let ctx = null; try { ctx = canvas.getContext('2d'); } catch (_) { /* Notes remain available. */ }
      function redraw() {
        if (!current(session) || !ctx) return;
        const rect = canvas.getBoundingClientRect(), cw = rect.width || 640, ch = rect.height || 320;
        const ratio = Math.min(window.devicePixelRatio || 1, 3); canvas.width = Math.round(cw * ratio); canvas.height = Math.round(ch * ratio); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, cw, ch);
        for (const stroke of data.strokes) { ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over'; ctx.strokeStyle = stroke.color; ctx.fillStyle = stroke.color; ctx.lineWidth = stroke.width * cw / 640; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); stroke.points.forEach((p, index) => { if (!index) ctx.moveTo(p[0] * cw, p[1] * ch); else ctx.lineTo(p[0] * cw, p[1] * ch); }); if (stroke.points.length === 1) { const p = stroke.points[0]; ctx.arc(p[0] * cw, p[1] * ch, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); } else ctx.stroke(); }
      }
      function point(event) { const rect = canvas.getBoundingClientRect(); return [Math.max(0, Math.min(1, (event.clientX - rect.left) / (rect.width || 640))), Math.max(0, Math.min(1, (event.clientY - rect.top) / (rect.height || 320)))]; }
      function end(event) { if (!current(session) || (event && event.pointerId !== pointer)) return; const hadStroke = !!drawing; drawing = null; pointer = null; if (event && hadStroke) save(true); }
      canvas.addEventListener('pointerdown', event => { if (!current(session) || !ctx || drawing || (event.button != null && event.button !== 0)) return; if (data.strokes.length >= LIMITS.strokes || pointCount >= LIMITS.points) { status.textContent = w.cap; return; } event.preventDefault(); pointer = event.pointerId; drawing = { color, width, erase, points: [point(event)] }; data.strokes.push(drawing); pointCount++; try { canvas.setPointerCapture(pointer); } catch (_) {} session.dirty = true; redraw(); });
      canvas.addEventListener('pointermove', event => { if (!current(session) || !drawing || pointer !== event.pointerId) return; event.preventDefault(); if (drawing.points.length >= LIMITS.perStroke || pointCount >= LIMITS.points) { status.textContent = w.cap; return; } drawing.points.push(point(event)); pointCount++; session.dirty = true; redraw(); });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => canvas.addEventListener(name, end));
      toolbar.append(element('label', { for: colorInput.id }, w.color), colorInput, element('label', { for: widthInput.id }, w.width), widthInput, pen, rubber, button(w.undo, () => { end(); data.strokes.pop(); pointCount = data.strokes.reduce((n, s) => n + s.points.length, 0); status.textContent = ''; redraw(); save(true); }), button(w.clear, () => { end(); data.strokes = []; pointCount = 0; status.textContent = ''; redraw(); save(true); }));
      dialog.append(toolbar, canvas); if (!ctx) dialog.append(element('p', {}, w.unavailable));
      window.addEventListener('resize', redraw); session.cleanup.push(() => window.removeEventListener('resize', redraw));
      if (typeof ResizeObserver === 'function') { const observer = new ResizeObserver(redraw); observer.observe(canvas); session.cleanup.push(() => observer.disconnect()); }
      session.redraw = redraw;
    }
    if (kind !== 'calculator') addNotes();
    dialog.append(status); portal.append(dialog);
    Array.from(document.body.children).forEach(node => { session.inert.push([node, node.hasAttribute('inert')]); node.setAttribute('inert', ''); });
    document.body.append(portal);
    function onKey(event) {
      if (!current(session)) { close(); return; }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key === 'Tab') { const items = Array.from(dialog.querySelectorAll('button, input, textarea, select, [tabindex="0"]')).filter(node => !node.disabled); const first = items[0], last = items[items.length - 1]; if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); } }
    }
    document.addEventListener('keydown', onKey, true); session.cleanup.push(() => document.removeEventListener('keydown', onKey, true));
    function trapFocus(event) { if (!current(session)) { close(); return; } if (!dialog.contains(event.target)) dismiss.focus(); }
    document.addEventListener('focusin', trapFocus); session.cleanup.push(() => document.removeEventListener('focusin', trapFocus));
    (dialog.querySelector('textarea, input') || dismiss).focus(); if (session.redraw) session.redraw();
    return true;
  }
  window.ExamTools = Object.freeze({ open, close });
})();
