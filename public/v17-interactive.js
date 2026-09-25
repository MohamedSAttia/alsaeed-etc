/* ============================================================
   منصة السعيد — V17
   ① مشغّل فيديو تفاعلي بأسئلة أثناء المشاهدة
   ② أغلفة ديناميكية مولّدة (SVG) بلا صور خارجية
   ============================================================ */
(function () {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => (window.APP && window.APP.esc) ? window.APP.esc(s)
  : String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const L = () => (window.I18 && window.I18.lang === 'en') ? 'en' : 'ar';
const T = (ar, en) => L() === 'en' ? en : ar;

/* ═══════════════════════════════════════════
   ① الأغلفة الديناميكية
   ═══════════════════════════════════════════ */
const COVER = {
  pm:   { c1:'#0E2444', c2:'#1D6FB8', ic:'📋', pat:'grid' },
  grc:  { c1:'#0B4A2E', c2:'#0E7C7B', ic:'🛡️', pat:'shield' },
  qual: { c1:'#7A3E0B', c2:'#F0741A', ic:'📊', pat:'bars' },
  gov:  { c1:'#3B1E6E', c2:'#6B4FBB', ic:'🏢', pat:'blocks' },
  hse:  { c1:'#7A1128', c2:'#BE123C', ic:'⛑️', pat:'hex' },
  ai:   { c1:'#0D3B52', c2:'#0EA5C6', ic:'🤖', pat:'circuit' },
  acad: { c1:'#1A2E5C', c2:'#C9A227', ic:'🎓', pat:'grid' },
  sys:  { c1:'#0E2444', c2:'#F0741A', ic:'⚙️', pat:'circuit' }
};

function pattern(kind, id) {
  const p = {
    grid:   `<pattern id="${id}" width="26" height="26" patternUnits="userSpaceOnUse">
             <path d="M26 0H0v26" fill="none" stroke="#fff" stroke-width=".6" opacity=".16"/></pattern>`,
    shield: `<pattern id="${id}" width="34" height="38" patternUnits="userSpaceOnUse">
             <path d="M17 4l11 5v11c0 7-5 12-11 14-6-2-11-7-11-14V9z" fill="none"
             stroke="#fff" stroke-width=".7" opacity=".14"/></pattern>`,
    bars:   `<pattern id="${id}" width="30" height="30" patternUnits="userSpaceOnUse">
             <rect x="3" y="16" width="5" height="11" fill="#fff" opacity=".13"/>
             <rect x="12" y="9" width="5" height="18" fill="#fff" opacity=".13"/>
             <rect x="21" y="3" width="5" height="24" fill="#fff" opacity=".13"/></pattern>`,
    blocks: `<pattern id="${id}" width="32" height="32" patternUnits="userSpaceOnUse">
             <rect x="3" y="3" width="11" height="11" rx="2" fill="#fff" opacity=".13"/>
             <rect x="18" y="18" width="11" height="11" rx="2" fill="#fff" opacity=".13"/></pattern>`,
    hex:    `<pattern id="${id}" width="30" height="34" patternUnits="userSpaceOnUse">
             <path d="M15 2l12 7v14l-12 7-12-7V9z" fill="none" stroke="#fff"
             stroke-width=".7" opacity=".14"/></pattern>`,
    circuit:`<pattern id="${id}" width="36" height="36" patternUnits="userSpaceOnUse">
             <path d="M0 18h11m7 0h18M18 0v11m0 7v18" stroke="#fff" stroke-width=".7" opacity=".16" fill="none"/>
             <circle cx="18" cy="18" r="2.6" fill="#fff" opacity=".2"/></pattern>`
  };
  return p[kind] || p.grid;
}

/* غلاف SVG لبطاقة أو رأس صفحة */
window.buildCover = function (opts) {
  opts = opts || {};
  const t = COVER[opts.track] || COVER.pm;
  const w = opts.w || 400, h = opts.h || 150;
  const id = 'cv' + Math.random().toString(36).slice(2, 7);
  const label = opts.label || '';
  const sub = opts.sub || '';
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice"
    xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">
    <defs>
      <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${t.c1}"/><stop offset="100%" stop-color="${t.c2}"/>
      </linearGradient>
      ${pattern(t.pat, id + 'p')}
      <radialGradient id="${id}r" cx="0.82" cy="0.18" r="0.7">
        <stop offset="0%" stop-color="#F0741A" stop-opacity=".42"/>
        <stop offset="100%" stop-color="#F0741A" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#${id}g)"/>
    <rect width="${w}" height="${h}" fill="url(#${id}p)"/>
    <rect width="${w}" height="${h}" fill="url(#${id}r)"/>
    <circle cx="${w * 0.88}" cy="${h * 0.2}" r="${h * 0.42}" fill="#fff" opacity=".05"/>
    <text x="${w * 0.86}" y="${h * 0.78}" font-size="${h * 0.46}" text-anchor="middle"
      opacity=".26">${t.ic}</text>
    ${label ? `<text x="18" y="${h * 0.32}" fill="#FBA43C" font-size="${Math.max(11, h * 0.1)}"
      font-weight="700" font-family="IBM Plex Mono, monospace">${esc(label)}</text>` : ''}
    ${sub ? `<text x="18" y="${h * 0.56}" fill="#fff" font-size="${Math.max(13, h * 0.13)}"
      font-weight="700" font-family="Tajawal, sans-serif" direction="rtl">${esc(sub)}</text>` : ''}
  </svg>`;
};

/* ═══════════════════════════════════════════
   ② المشغّل التفاعلي
   ═══════════════════════════════════════════ */
let V = null;
let player = null;
let playerLoader = null;
function visibleVideoOrder(pkgId) {
  return ((window.LESSONS && window.LESSONS[pkgId]) || [])
    .map((lesson, index) => ({ lesson, index }))
    .filter(item => item.lesson.vimeo && (window.APP.owns(pkgId) || window.APP.isAdmin() || item.lesson.free))
    .sort((a, b) => (Number(a.lesson.ch) || 0) - (Number(b.lesson.ch) || 0) || a.index - b.index)
    .map(item => item.index);
}
function videoNumber(pkgId, index) {
  const position = visibleVideoOrder(pkgId).indexOf(index);
  return position < 0 ? index + 1 : position + 1;
}
function loadPlayer() {
  if (window.Vimeo?.Player) return Promise.resolve(window.Vimeo.Player);
  if (!playerLoader) playerLoader = new Promise((resolve, reject) => {
    const script=document.createElement('script'); script.src='https://player.vimeo.com/api/player.js';
    script.onload=()=>resolve(window.Vimeo.Player); script.onerror=()=>reject(Error('Vimeo unavailable'));
    document.head.appendChild(script);
  }).catch(e=>{playerLoader=null;throw e});
  return playerLoader;
}
function nextVideo() {
  if (!V) return;
  const order=visibleVideoOrder(V.pkgId);
  const index=order[order.indexOf(V.lessonIdx)+1];
  if(index!==undefined) selectVideo(index);
}
function selectVideo(index) {
  if (!V) return;
  if(player){player.destroy().catch(()=>{});player=null;}
  V.lessonIdx=index;V.lesson=(window.LESSONS[V.pkgId]||[])[index];V.startNext=true;
  V.cues=buildCues(V.lesson,index);V.done={};V.answered=0;V.correct=0;V.cue=null;
  V.dur=durSec(V.lesson.dur||V.lesson.duration);V.t=0;
  V.discussion=[];V.discussionStatus='loading';V.discussionError='';V.replying=null;
  render();loadDiscussion();
}
function connectPlayer(){
  if(!V?.lesson?.vimeo)return;
  const frame=$('#ivFrame'),target=V,index=V.lessonIdx;
  loadPlayer().then(Player=>{
    if(!frame.isConnected||V!==target||V.lessonIdx!==index)return;
    const instance=new Player(frame);player=instance;
    instance.getDuration().then(seconds=>{
      if(V!==target||V.lessonIdx!==index||player!==instance||!seconds)return;
      V.dur=seconds;const display=fmtT(Math.floor(seconds));
      const label=$('#ivDuration');if(label)label.textContent=' · '+display;
      const listing=$(`[data-go="${index}"] .d`);if(listing)listing.textContent=display;
    }).catch(()=>{});
    instance.on('timeupdate',e=>{if(V===target&&V.lessonIdx===index)V.t=e.seconds});
    instance.on('ended',()=>{
      if(V!==target||V.lessonIdx!==index)return;
      const pr=window.APP.prog(V.pkgId);pr.lessons[index]=true;window.APP.save();window.APP.render();
      if(V.autoNext)nextVideo();
      else window.APP.toast(T('اكتمل الفيديو. شغّل التالي عندما تريد.','Video completed. Play the next when ready.'));
    });
  }).catch(()=>{});
}


/* نقاط التفاعل الافتراضية داخل الفيديو */
function buildCues(lesson, idx) {
  if (lesson && Array.isArray(lesson.cues) && lesson.cues.length) return lesson.cues;
  return [];
}
function durSec(d) {
  if (!d) return 0;
  const p = String(d).split(':').map(Number);
  return p.length === 2 ? p[0] * 60 + p[1] : (p[0] || 0);
}
const fmtT = s => {
  s = Math.max(0, Math.round(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

/* أسئلة الفاصل — من بنك الباقة أو أسئلة عامة */
function cueQuestion(ctx) {
  const bank = (window.QBANK || []).filter(q =>
    q.course === ctx.course && q.active !== 0 && q.q && (q.q.ar || q.q.en));
  if (bank.length) {
    const q = bank[Math.floor(Math.random() * bank.length)];
    const lang = L() === 'en' ? 'en' : 'ar';
    const qt = (q.q[lang] || q.q.en || q.q.ar || '');
    const os = (q.o && (q.o[lang] && q.o[lang].length ? q.o[lang] : (q.o.en || q.o.ar))) || [];
    if (qt && os.length) return { q: qt, o: os, c: (q.c || [0])[0], x: (q.x && (q.x[lang] || q.x.ar || q.x.en)) || '' };
  }
  return null;
}

window.InteractiveVideo = {
  open(pkgId, lessonIdx) {
    const p = window.APP && window.APP.pack ? window.APP.pack(pkgId) : null;
    const ls = (window.LESSONS && window.LESSONS[pkgId]) || [];
    const lesson = ls[lessonIdx];
    if (!lesson) { if (window.APP) window.APP.toast('الدرس غير متاح'); return; }
    const c = p && window.APP.course ? window.APP.course(p.course) : {};

    V = {
      pkgId, lessonIdx, lesson, course: (c && c.id) || 'pmp',
      cues: buildCues(lesson, lessonIdx),
      done: {}, t: 0, dur: durSec(lesson.dur || lesson.duration),
      answered: 0, correct: 0, paused: false, cue: null,
      autoNext: localStorage.getItem('alsaeed_auto_next') !== 'false',
      discussion: [], discussionStatus: 'loading', discussionError: '', canReply: false, replying: null
    };
    document.body.classList.add('iv-lock');
    document.body.insertAdjacentHTML('beforeend', `<div class="iv-shell" id="iv"></div>`);
    render();
    loadDiscussion();
  },
  close() { close(); }
};

function close() {
  if(player){player.destroy().catch(()=>{});player=null;}
  V = null;
  document.body.classList.remove('iv-lock');
  const e = $('#iv'); if (e) e.remove();
}

function render() {
  if (!V) return;
  const l = V.lesson;
  const vid = l.vimeo || l.video || '';
  const pct = V.dur ? Math.min(100, V.t / V.dur * 100) : 0;
  $('#iv').innerHTML = `
    <div class="iv-bar">
      <div class="iv-t"><b>${esc(window.biTitle ? window.biTitle(l) : (l.t || l.title || ''))}</b>
        <span>${T('درس', 'Lesson')} ${videoNumber(V.pkgId, V.lessonIdx)}<span id="ivDuration">${l.dur ? ' · ' + esc(l.dur) : ''}</span></span></div>
      <div class="iv-stat">
        ${V.cues.length ? `<span>${T('أسئلة الفاصل', 'Checkpoints')}:
          <b>${V.answered}</b>/${V.cues.length}</span>` : ''}
      </div>
      <button class="iv-x" id="ivClose">✕ ${T('إغلاق', 'Close')}</button>
    </div>

    <div class="iv-body">
      <div class="iv-stage">
        <div class="iv-player">
          ${vid
            ? `<iframe id="ivFrame" src="https://player.vimeo.com/video/${esc(vid)}?title=0&byline=0&portrait=0${V.startNext?'&autoplay=1':''}"
                 allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`
            : `<div class="iv-ph"><b>🎬 ${T('الفيديو لم يُربط بعد', 'Video not linked yet')}</b>
                 <p>${T('ارفعه على Vimeo وأضف رقمه من لوحة الإدارة.',
                        'Upload to Vimeo and add its ID from the admin panel.')}</p></div>`}
          ${V.cue ? cueOverlay() : ''}
        </div>

        ${V.cues.length ? `<div class="iv-track">
          <div class="iv-line"><i style="width:${pct}%"></i></div>
          ${V.cues.map((q, i) => `<button class="iv-dot${V.done[i] ? ' done' : ''}"
            style="inset-inline-start:${V.dur ? q.at / V.dur * 100 : 0}%"
            data-cue="${i}" title="${T('سؤال عند', 'Question at')} ${fmtT(q.at)}">
            ${V.done[i] ? '✓' : '?'}</button>`).join('')}
        </div>
        <p class="iv-hint">${T(
          'النقاط على الشريط أسئلة قصيرة — اضغط أياً منها للإجابة، أو انتظرها أثناء المشاهدة.',
          'Dots on the bar are short checkpoints — click one to answer, or wait for it while watching.')}</p>` : ''}
      </div>

      <aside class="iv-side">
        <h4>${T('محتوى الدرس', 'Lesson content')}</h4>
        <label style="display:block;margin-bottom:10px"><input type="checkbox" id="ivAutoNext" ${V.autoNext?'checked':''}> ${T('تشغيل الفيديو التالي تلقائياً','Automatically play next video')}</label>
        <button class="btn o" id="ivPause" type="button">${T('إيقاف الفيديو مؤقتاً','Pause video')}</button>
        <button class="btn o" id="ivNext" type="button">${T('الفيديو التالي','Next video')} →</button>
        ${(l.quiz || []).length ? `<button class="btn p" id="ivLessonQuiz">${T('ابدأ تقييم هذا الفيديو', 'Start the video quiz')} (${l.quiz.length})</button>` : ''}
        <div class="iv-notes">
          ${l.notes ? esc(l.notes).replace(/\n/g, '<br>')
            : `<p class="muted">${T('ملاحظات هذا الدرس تُضاف من لوحة الإدارة.',
                'Lesson notes are added from the admin panel.')}</p>`}
        </div>
        <h4>${T('دروس الفصل', 'Chapter lessons')}</h4>
        <div class="iv-list">
          ${((window.LESSONS && window.LESSONS[V.pkgId]) || [])
            .map((x, i) => ({ x, i }))
            .filter(o => (o.x.ch || 0) === (l.ch || 0))
            .map(o => `<button class="iv-li${o.i === V.lessonIdx ? ' cur' : ''}" data-go="${o.i}">
              <span class="n">${videoNumber(V.pkgId, o.i)}</span>
              <span class="t">${window.APP.prog(V.pkgId).lessons[o.i]?'✓ ':'○ '}${esc(window.biTitle ? window.biTitle(o.x) : (o.x.t || o.x.title || ''))}</span>
              <span class="d">${esc(o.x.dur || '')}</span></button>`).join('')}
        </div>
        <div class="iv-discussion" id="ivDiscussion"></div>
      </aside>
    </div>`;
  bind();
  connectPlayer();
  renderDiscussion();
}

async function loadDiscussion() {
  if (!V || !window.APP || !window.APP.api) return;
  const pkg=V.pkgId, idx=V.lessonIdx;
  V.discussionStatus='loading';V.discussionError='';renderDiscussion();
  try {
    const data=await window.APP.api('/lesson-discussions/'+encodeURIComponent(pkg)+'/'+idx,{timeoutMs:15000});
    if(!V||V.pkgId!==pkg||V.lessonIdx!==idx)return;
    V.discussion=Array.isArray(data.items)?data.items:[];V.canReply=!!data.canReply;V.discussionStatus='ready';
  } catch(e) {
    if(!V||V.pkgId!==pkg||V.lessonIdx!==idx)return;
    V.discussionStatus='error';V.discussionError=e.message||T('تعذر تحميل المناقشة','Could not load discussion');
  }
  renderDiscussion();
}

function discussionDate(value){try{return new Date(Number(value)).toLocaleString(L()==='en'?'en-GB':'ar-EG',{dateStyle:'medium',timeStyle:'short'})}catch{return''}}
function roleLabel(role){return ['admin','trainer','instructor'].includes(String(role||'').toLowerCase())?T('المدرب / الإدارة','Trainer / Admin'):T('متدرب','Learner')}
function renderDiscussion(){
  const el=$('#ivDiscussion');if(!el||!V)return;
  if(V.discussionStatus==='loading'){el.innerHTML='<div class="iv-discussion-empty">'+T('جارٍ تحميل أسئلة الدرس…','Loading lesson questions…')+'</div>';return}
  if(V.discussionStatus==='error'){el.innerHTML='<div class="iv-discussion-head"><h4>'+T('الأسئلة والمناقشة','Questions & discussion')+'</h4></div><div class="iv-discussion-error">'+esc(V.discussionError)+'</div>';return}
  const roots=V.discussion.filter(x=>!x.parent_id), replies=V.discussion.filter(x=>x.parent_id);
  el.innerHTML='<div class="iv-discussion-head"><h4>'+T('الأسئلة والمناقشة','Questions & discussion')+'</h4><span>'+roots.length+' '+T('سؤال','questions')+'</span></div>'+
    '<div class="iv-ask"><textarea id="ivAsk" maxlength="2000" placeholder="'+T('اكتب سؤالك عن هذا الفيديو…','Ask a question about this video…')+'"></textarea><button id="ivAskSend">'+T('إرسال السؤال','Send question')+'</button></div>'+
    (roots.length?roots.map(q=>{const rs=replies.filter(x=>x.parent_id===q.id);return '<article class="iv-thread"><div class="iv-thread-meta"><b>'+esc(q.name||T('متدرب','Learner'))+'</b><span class="iv-role">'+esc(roleLabel(q.role))+'</span><span>'+esc(discussionDate(q.created))+'</span></div><p>'+esc(q.body)+'</p>'+
      (rs.length?'<div class="iv-replies">'+rs.map(a=>'<div class="iv-reply"><div class="iv-thread-meta"><b>'+esc(a.name||T('الإدارة','Admin'))+'</b><span class="iv-role">'+esc(roleLabel(a.role))+'</span><span>'+esc(discussionDate(a.created))+'</span></div><p>'+esc(a.body)+'</p></div>').join('')+'</div>':'')+
      (V.canReply?'<button class="iv-reply-action" data-disc-reply="'+esc(q.id)+'">'+T('رد كمدرب','Reply as trainer')+'</button>':'')+
      (V.replying===q.id?'<div class="iv-reply-form"><textarea id="ivReplyText" maxlength="2000" placeholder="'+T('اكتب الرد…','Write a reply…')+'"></textarea><button id="ivReplySend" data-parent="'+esc(q.id)+'">'+T('إرسال الرد','Send reply')+'</button></div>':'')+'</article>'}).join(''):'<div class="iv-discussion-empty">'+T('لا توجد أسئلة بعد. ابدأ المناقشة حول هذا الدرس.','No questions yet. Start the discussion for this lesson.')+'</div>');
  const send=$('#ivAskSend');if(send)send.onclick=()=>postDiscussion($('#ivAsk')?.value||'',null,send);
  $$('[data-disc-reply]').forEach(b=>b.onclick=()=>{V.replying=V.replying===b.dataset.discReply?null:b.dataset.discReply;renderDiscussion()});
  const reply=$('#ivReplySend');if(reply)reply.onclick=()=>postDiscussion($('#ivReplyText')?.value||'',reply.dataset.parent,reply);
}
async function postDiscussion(body,parentId,button){
  const text=String(body||'').trim();if(text.length<2)return window.APP.toast(T('اكتب السؤال أولًا','Write the question first'));
  button.disabled=true;button.textContent=T('جارٍ الإرسال…','Sending…');
  try{await window.APP.api('/lesson-discussions/'+encodeURIComponent(V.pkgId)+'/'+V.lessonIdx,{method:'POST',body:{body:text,parentId}});V.replying=null;await loadDiscussion();window.APP.toast(T('تم إرسال رسالتك','Your message was sent'))}
  catch(e){button.disabled=false;button.textContent=parentId?T('إرسال الرد','Send reply'):T('إرسال السؤال','Send question');window.APP.toast(e.message)}
}

function cueOverlay() {
  const q = V.cue;
  return `<div class="iv-cue">
    <div class="iv-cq">
      <div class="iv-ch">
        <span class="iv-cb">⏸ ${T('سؤال سريع', 'Quick check')}</span>
        <span class="iv-cn">${T('سؤال', 'Question')} ${V.answered + 1} ${T('من', 'of')} ${V.cues.length}</span>
      </div>
      <p class="iv-ct">${esc(q.q)}</p>
      <div class="iv-co">
        ${q.o.map((o, i) => {
          const sel = q.picked === i;
          const rev = q.revealed;
          let cl = sel ? 'sel' : '';
          if (rev) { if (i === q.c) cl = 'right'; else if (sel) cl = 'wrong'; }
          return `<button class="iv-o ${cl}" data-cueo="${i}" ${rev ? 'disabled' : ''}>
            <span>${String.fromCharCode(65 + i)}</span>${esc(o)}</button>`;
        }).join('')}
      </div>
      ${q.revealed ? `<div class="iv-fb ${q.picked === q.c ? 'ok' : 'no'}">
        <b>${q.picked === q.c ? '✅ ' + T('صحيحة', 'Correct') : '❌ ' + T('الصحيحة', 'Correct answer') + ': ' + String.fromCharCode(65 + q.c)}</b>
        ${q.x ? `<p>${esc(q.x)}</p>` : ''}</div>` : ''}
      <div class="iv-ca">
        ${q.revealed
          ? `<button class="btn p" id="cueGo">${T('تابع المشاهدة ←', 'Continue ←')}</button>`
          : `<button class="btn p" id="cueCheck" ${q.picked == null ? 'disabled' : ''}>
               ${T('تحقّق', 'Check')}</button>
             <button class="btn o" id="cueSkip">${T('تخطَّ', 'Skip')}</button>`}
      </div>
    </div>
  </div>`;
}

function openCue(i) {
  const q = cueQuestion({ course: V.course });
  if (!q) { V.done[i] = true; render(); return; }
  V.cue = { ...q, idx: i, picked: null, revealed: false };
  V.paused = true;
  render();
}

function bind() {
  const c = $('#ivClose'); if (c) c.onclick = close;
  const auto=$('#ivAutoNext');if(auto)auto.onchange=()=>{V.autoNext=auto.checked;localStorage.setItem('alsaeed_auto_next',String(auto.checked));};
  const pause=$('#ivPause');if(pause)pause.onclick=async()=>{if(!player)return;try{const stopped=await player.getPaused();if(stopped){await player.play();pause.textContent=T('إيقاف الفيديو مؤقتاً','Pause video');}else{await player.pause();pause.textContent=T('استئناف الفيديو','Resume video');}}catch(e){}};
  const next=$('#ivNext');if(next)next.onclick=nextVideo;
  const quiz = $('#ivLessonQuiz'); if (quiz) quiz.onclick = () => {
    const pkg = V.pkgId, idx = V.lessonIdx;
    close(); if (window.runLessonQuiz) window.runLessonQuiz(pkg, 'lesson' + idx);
  };
  $$('[data-go]').forEach(b => b.onclick = () => selectVideo(+b.dataset.go));
  $$('[data-cue]').forEach(b => b.onclick = () => openCue(+b.dataset.cue));
  $$('[data-cueo]').forEach(b => b.onclick = () => {
    if (V.cue.revealed) return;
    V.cue.picked = +b.dataset.cueo; render();
  });
  const ck = $('#cueCheck');
  if (ck) ck.onclick = () => {
    V.cue.revealed = true;
    V.done[V.cue.idx] = true;
    V.answered++;
    if (V.cue.picked === V.cue.c) V.correct++;
    render();
  };
  const sk = $('#cueSkip');
  if (sk) sk.onclick = () => { V.cue = null; V.paused = false; render(); };
  const go = $('#cueGo');
  if (go) go.onclick = () => { V.cue = null; V.paused = false; render(); };
}

/* ═══ ربط الأزرار في الصفحة ═══ */
function hook() {
  $$('[data-iv]').forEach(b => {
    if (b._iv) return; b._iv = 1;
    b.onclick = e => { e.preventDefault(); e.stopPropagation();
      window.InteractiveVideo.open(b.dataset.ivPkg, +b.dataset.iv); };
  });
  /* استبدل صور الأغلفة الفارغة بأغلفة مولّدة */
  $$('[data-cover]').forEach(el => {
    if (el._cv) return; el._cv = 1;
    el.innerHTML = window.buildCover({
      track: el.dataset.cover, label: el.dataset.coverLabel || '',
      sub: el.dataset.coverSub || '', w: 400, h: el.clientHeight || 150
    });
  });
}
const mo = new MutationObserver(() => hook());
if (document.body) {
  mo.observe(document.body, { childList: true, subtree: true });
  hook();
} else document.addEventListener('DOMContentLoaded', () => {
  mo.observe(document.body, { childList: true, subtree: true }); hook();
});
})();
