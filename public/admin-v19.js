/* Al Saeed Admin V19 — package question management and chapter-first video studio. */
(()=>{
  'use strict';
  let CHAPTERS=[];
  const packageById=id=>PACKAGES.find(p=>p.id===id)||{};
  const normalizedChapters=list=>(Array.isArray(list)?list:[]).map(x=>typeof x==='object'
    ?{ar:String(x.ar||'').trim(),en:String(x.en||'').trim()}
    :{ar:String(x||'').trim(),en:''}).filter(x=>x.ar||x.en);
  const chapterTitle=(c,i)=>c?(c.ar||c.en||('الفصل '+(i+1))):('الفصل '+(i+1));
  const vimeoId=value=>String(value||'').trim().replace(/^https?:\/\/(www\.)?vimeo\.com\/(?:video\/)?/i,'').replace(/[^0-9]/g,'');

  const oldShell=shell;
  shell=function(body){
    return oldShell(body).replace('مركز إدارة المحتوى','مركز إدارة المنصة')
      .replace('<span class="vbadge">V15</span>','<span class="vbadge">V19</span>');
  };

  const oldPackages=vPackages;
  vPackages=function(){return oldPackages().replace('كل باقات V15 الفعلية من قاعدة البيانات — مع عدادات المحتوى لكل باقة.','كل باقة لها بنك أسئلة ومحتوى وفصول مستقلة، مع عدادات مباشرة من قاعدة البيانات.')};
  const oldBindPackages=bindPackages;
  bindPackages=function(){
    oldBindPackages();
    $$('.package-card').forEach(card=>{
      const edit=card.querySelector('.editPackage'),acts=card.querySelector('.acts');
      if(!edit||!acts||acts.querySelector('.packageLessons'))return;
      const b=document.createElement('button');
      b.className='btn sm packageLessons';b.textContent='المحتوى والفيديو';b.dataset.id=edit.dataset.id;
      b.onclick=()=>{CURRENT=b.dataset.id;TAB='lessons';draw()};acts.appendChild(b);
    });
  };

  const oldQuestions=vQuestions;
  vQuestions=function(){
    return oldQuestions().replace('مراجعة وتعديل وPreview وDuplicate وتصدير. لا نعتبر السؤال عربيًا إلا إذا كان له نص عربي فعلي.',
      'إدارة أسئلة كل باقة: إضافة، تعديل، نقل، نسخ، معاينة وحذف مع فلاتر اللغة والمجال والنوع.')
      .replace('<option value="bilingual">AR + EN</option><option value="need">يحتاج عربي</option>',
        '<option value="bilingual">AR + EN</option><option value="arabic_only">عربي فقط</option><option value="english_only">إنجليزي فقط</option><option value="incomplete">لغة ناقصة</option>');
  };
  filteredQuestions=function(){const s=QSEARCH.toLowerCase();return QUESTIONS.filter(q=>{const ar=String(q.question_ar||'').trim(),en=String(q.question_en||'').trim();return(!s||JSON.stringify([q.question_ar,q.question_en,q.explanation_ar,q.explanation_en,q.reference,q.topic]).toLowerCase().includes(s))&&(QDOMAIN==='all'||q.domain===QDOMAIN)&&(QTYPE==='all'||q.type===QTYPE)&&(QDIFF==='all'||(q.difficulty||'medium')===QDIFF)&&(QLANG==='all'||(QLANG==='bilingual'&&ar&&en)||(QLANG==='arabic_only'&&ar&&!en)||(QLANG==='english_only'&&!ar&&en)||(QLANG==='incomplete'&&(!ar||!en)))})};
  const oldBindQuestions=bindQuestions;
  bindQuestions=function(){
    oldBindQuestions();
    const pkg=$('#qPkg');
    if(pkg)pkg.onchange=()=>{CURRENT=pkg.value;loadQuestions().catch(e=>alert(e.message))};
  };
  readQuestionForm=function(q){
    return{...q,package_id:$('#qePackage').value,domain:$('#qeDomain').value.trim(),topic:$('#qeTopic').value.trim(),
      approach:$('#qeApproach').value.trim(),difficulty:$('#qeDiff').value,type:$('#qeType').value,
      question_ar:$('#qeAr').value.trim(),question_en:$('#qeEn').value.trim(),
      options_ar:$$('.opAr').map(x=>x.value.trim()),options_en:$$('.opEn').map(x=>x.value.trim()),
      correct:$('#qeCorrect').value.trim().toUpperCase(),reference:$('#qeRef').value.trim(),
      active:$('#qeActive').value==='1',explanation_ar:$('#qeExpAr').value.trim(),explanation_en:$('#qeExpEn').value.trim()};
  };
  openQuestion=function(q={}){
    const oe=q.options_en||q.options||[],oa=q.options_ar||[];
    modal('<div class="modal-title"><div><span class="eyebrow">بنك الأسئلة</span><h2>'+(q.id?'تعديل السؤال':'إضافة سؤال جديد')+'</h2></div><span class="chip '+(q.id?'ok':'o')+'">'+(q.id?'محفوظ':'جديد')+'</span></div>'+
      '<div class="row3"><label class="f"><span>الباقة</span><select id="qePackage">'+PACKAGES.map(p=>'<option value="'+esc(p.id)+'" '+((q.package_id||CURRENT)===p.id?'selected':'')+'>'+esc(p.ar||p.en||p.id)+'</option>').join('')+'</select></label><label class="f"><span>المجال</span><input id="qeDomain" class="en" value="'+esc(q.domain||'')+'"></label><label class="f"><span>الموضوع / المهمة</span><input id="qeTopic" value="'+esc(q.topic||'')+'"></label></div>'+
      '<div class="row3"><label class="f"><span>النهج</span><input id="qeApproach" class="en" value="'+esc(q.approach||'')+'"></label><label class="f"><span>الصعوبة</span><select id="qeDiff">'+['easy','medium','hard'].map(x=>'<option '+((q.difficulty||'medium')===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label class="f"><span>نوع السؤال</span><select id="qeType">'+['single','multiple','scenario','matching','drag_drop','ordering','hotspot','fill_blank'].map(x=>'<option '+((q.type||'single')===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label></div>'+
      '<div class="question-editor-grid"><section><label class="f"><span>السؤال بالعربية</span><textarea id="qeAr" rows="5">'+esc(q.question_ar||'')+'</textarea></label><div class="section">الاختيارات العربية</div>'+optionFields('opAr',oa,'')+'</section><section dir="ltr"><label class="f"><span>Question in English</span><textarea id="qeEn" class="en" rows="5">'+esc(q.question_en||'')+'</textarea></label><div class="section">English options</div>'+optionFields('opEn',oe,'en')+'</section></div>'+
      '<div class="row3"><label class="f"><span>الإجابة الصحيحة (A أو A,C)</span><input id="qeCorrect" class="en" value="'+esc(q.correct||'A')+'"></label><label class="f"><span>المرجع</span><input id="qeRef" value="'+esc(q.reference||'')+'"></label><label class="f"><span>الحالة</span><select id="qeActive"><option value="1" '+(q.active===false?'':'selected')+'>نشط</option><option value="0" '+(q.active===false?'selected':'')+'>غير نشط</option></select></label></div>'+
      '<div class="row"><label class="f"><span>التفسير بالعربية</span><textarea id="qeExpAr" rows="4">'+esc(q.explanation_ar||'')+'</textarea></label><label class="f"><span>Explanation in English</span><textarea id="qeExpEn" class="en" rows="4">'+esc(q.explanation_en||'')+'</textarea></label></div>'+
      '<div class="acts sticky-actions"><button class="btn p" id="qSave">حفظ السؤال</button><button class="btn" id="qShow">معاينة</button><button class="btn" data-close>إلغاء</button></div>',m=>{
        $('#qShow').onclick=()=>previewQuestion(readQuestionForm(q));
        $('#qSave').onclick=async()=>{try{
          const body=readQuestionForm(q);
          if(!body.question_ar&&!body.question_en)throw new Error('اكتب نص السؤال بالعربية أو الإنجليزية');
          if(!body.correct)throw new Error('حدد الإجابة الصحيحة');
          await QB(q.id?'/'+encodeURIComponent(q.id):'',{method:q.id?'PUT':'POST',body});
          m.remove();QUESTIONS=await QB('/'+encodeURIComponent(CURRENT));PACKAGES=await request('/api/admin-package-summary');
          toast(body.package_id===CURRENT?'تم حفظ السؤال':'تم حفظ السؤال ونقله إلى الباقة المختارة');renderQuestionTable();
        }catch(e){alert(e.message)}};
      });
  };

  vLessons=function(){
    return hero('استوديو المحتوى والفيديو','رتّب الفصول والدروس، اربط Vimeo، وعاين المحتوى قبل ظهوره للمتدرب.',
      '<button class="btn ghost" id="lessonPreviewAll">👁 معاينة كمتدرب</button><button class="btn p" id="lessonSave">💾 حفظ الكل</button>')+
      '<div class="video-admin-toolbar"><label class="f"><span>الباقة</span>'+psel('lessonPkg')+'</label><button class="btn n" id="lessonLoad">تحميل</button><button class="btn" id="chapterAdd">＋ فصل</button><button class="btn" id="lessonAdd">＋ درس</button><button class="btn" id="lessonBulk">📋 إضافة جماعية</button></div>'+
      '<div id="lessonStats" class="grid g4"></div><div id="lessonWorkspace"></div>';
  };
  bindLessons=function(){
    const readCourseChapters=p=>{
      const c=(CONTENT.courses||[]).find(x=>x.id===p.course);
      return normalizedChapters((p._chapters&&p._chapters.length)?p._chapters:(c&&c.chapters)||[]);
    };
    function harvest(){
      $$('#lessonWorkspace [data-li]').forEach(row=>{
        const i=+row.dataset.li,l=LESSONS[i];if(!l)return;
        l.title=(row.querySelector('[data-title]')?.value||'').trim();l.title_en=(row.querySelector('[data-title-en]')?.value||'').trim();
        l.duration=(row.querySelector('[data-duration]')?.value||'').trim();l.vimeo=vimeoId(row.querySelector('[data-vimeo]')?.value||'');
        l.free=!!row.querySelector('[data-free]')?.checked;l.chapter=+(row.querySelector('[data-chapter]')?.value||0);
      });
    }
    function stats(){
      const linked=LESSONS.filter(x=>x.vimeo).length,totalMin=LESSONS.reduce((n,x)=>{const p=String(x.duration||'0').split(':');return n+(+p[0]||0)+(+p[1]||0)/60},0);
      $('#lessonStats').innerHTML='<div class="stat"><b>'+CHAPTERS.length+'</b><span>فصول</span></div><div class="stat"><b>'+LESSONS.length+'</b><span>دروس</span></div><div class="stat"><b>'+linked+'</b><span>فيديو مرتبط</span></div><div class="stat"><b>'+Math.round(totalMin/60*10)/10+'</b><span>ساعة محتوى</span></div>';
    }
    function lessonRow(l,i){return '<tr data-li="'+i+'"><td class="num">'+(i+1)+'</td><td><div class="bi-f sm"><span class="bi-flag">AR</span><input data-title value="'+esc(l.title||l.t||'')+'" placeholder="عنوان الدرس بالعربية"></div><div class="bi-f sm"><span class="bi-flag">EN</span><input data-title-en class="en" value="'+esc(l.title_en||l.t_en||'')+'" placeholder="Lesson title in English"></div></td><td><select data-chapter>'+CHAPTERS.map((c,k)=>'<option value="'+k+'" '+((l.chapter||0)===k?'selected':'')+'>'+esc(chapterTitle(c,k))+'</option>').join('')+'</select></td><td><input data-duration class="num" value="'+esc(l.duration||l.dur||'')+'" placeholder="تلقائي"></td><td><div class="video-field"><input data-vimeo data-last-vimeo="'+esc(l.vimeo||'')+'" class="en" value="'+esc(l.vimeo||'')+'" placeholder="Vimeo ID أو الرابط"><button class="btn sm fetchDuration" data-i="'+i+'" title="جلب مدة الفيديو">⏱</button>'+(l.vimeo?'<button class="btn sm previewVideo" data-vimeo-id="'+esc(l.vimeo)+'">▶</button>':'')+'</div><small class="vimeo-status muted"></small></td><td><input data-free type="checkbox" '+(l.free?'checked':'')+'></td><td><div class="order-actions"><button class="ch-b lTop" data-i="'+i+'" title="إلى أول الفصل">⇤</button><button class="ch-b lUp" data-i="'+i+'" title="لأعلى">▲</button><button class="ch-b lDown" data-i="'+i+'" title="لأسفل">▼</button><button class="ch-b d lDel" data-i="'+i+'" title="حذف">✕</button></div></td></tr>'}
    function render(){
      if(!CHAPTERS.length)CHAPTERS=[{ar:'الفصل الأول',en:'Chapter 1'}];stats();
      $('#lessonWorkspace').innerHTML=CHAPTERS.map((c,ci)=>{const rows=LESSONS.map((l,i)=>({l,i})).filter(x=>(x.l.chapter||0)===ci);return '<section class="chapter-card" data-ci="'+ci+'"><header class="chapter-head"><span class="chapter-index">'+(ci+1)+'</span><div><h3>'+esc(c.ar||c.en||('الفصل '+(ci+1)))+'</h3><p class="en">'+esc(c.en||'')+'</p></div><span class="chip">'+rows.length+' درس</span><div class="chapter-actions"><button class="btn sm addToChapter" data-ci="'+ci+'">＋ درس</button><button class="ch-b chTop" data-ci="'+ci+'" title="إلى الأول" '+(ci===0?'disabled':'')+'>⇤</button><button class="ch-b chUp" data-ci="'+ci+'" title="لأعلى" '+(ci===0?'disabled':'')+'>▲</button><button class="ch-b chDown" data-ci="'+ci+'" title="لأسفل" '+(ci===CHAPTERS.length-1?'disabled':'')+'>▼</button><button class="ch-b chEdit" data-ci="'+ci+'" title="تعديل">✎</button><button class="ch-b d chDel" data-ci="'+ci+'" title="حذف">✕</button></div></header>'+(rows.length?'<div class="tbl lesson-table"><table><thead><tr><th>#</th><th>عنوان الدرس</th><th>الفصل</th><th>المدة</th><th>Vimeo والمعاينة</th><th>مجاني</th><th>الترتيب</th></tr></thead><tbody>'+rows.map(x=>lessonRow(x.l,x.i)).join('')+'</tbody></table></div>':'<div class="chapter-empty">لا توجد دروس في هذا الفصل. <button class="btn sm addToChapter" data-ci="'+ci+'">أضف الدرس الأول</button></div>')+'</section>'}).join('');
      bindWorkspace();
    }
    function moveChapter(from,to){
      harvest();if(to<0||to>=CHAPTERS.length||from===to)return;
      const item=CHAPTERS.splice(from,1)[0];CHAPTERS.splice(to,0,item);
      LESSONS.forEach(l=>{const ch=l.chapter||0;if(ch===from)l.chapter=to;else if(from>to&&ch>=to&&ch<from)l.chapter=ch+1;else if(from<to&&ch>from&&ch<=to)l.chapter=ch-1});render();
    }
    function moveLesson(i,dir,top=false){
      harvest();const ch=LESSONS[i].chapter||0,sibs=LESSONS.map((l,k)=>({l,k})).filter(x=>(x.l.chapter||0)===ch),pos=sibs.findIndex(x=>x.k===i),target=top?0:pos+dir;if(target<0||target>=sibs.length||target===pos)return;const item=LESSONS.splice(i,1)[0];const targetOriginal=sibs[target].k;let insert=targetOriginal;if(i<targetOriginal)insert--;LESSONS.splice(insert,0,item);render();
    }
    function chapterDialog(existing,index){
      modal('<h2>'+(existing?'تعديل الفصل':'إضافة فصل')+'</h2><div class="row"><label class="f"><span>اسم الفصل بالعربية</span><input id="chAr" value="'+esc(existing?.ar||'')+'"></label><label class="f"><span>Chapter name in English</span><input id="chEn" class="en" value="'+esc(existing?.en||'')+'"></label></div><div class="acts"><button class="btn p" id="chSave">حفظ</button><button class="btn" data-close>إلغاء</button></div>',m=>{$('#chSave').onclick=()=>{const c={ar:$('#chAr').value.trim(),en:$('#chEn').value.trim()};if(!c.ar&&!c.en)return alert('اكتب اسم الفصل');harvest();if(existing)CHAPTERS[index]=c;else CHAPTERS.push(c);m.remove();render()}});
    }
    function lessonDialog(ch){
      modal('<h2>إضافة درس</h2><div class="row"><label class="f"><span>عنوان الدرس بالعربية</span><input id="newLAr"></label><label class="f"><span>Lesson title in English</span><input id="newLEn" class="en"></label></div><div class="row3"><label class="f"><span>الفصل</span><select id="newLCh">'+CHAPTERS.map((c,k)=>'<option value="'+k+'" '+(k===ch?'selected':'')+'>'+esc(chapterTitle(c,k))+'</option>').join('')+'</select></label><label class="f"><span>المدة — تُجلب تلقائيًا</span><input id="newLDur" class="num" placeholder="تلقائي"></label><label class="f"><span>Vimeo ID أو الرابط</span><input id="newLVimeo" class="en"><small id="newVStatus" class="muted"></small></label></div><label class="check-line"><input type="checkbox" id="newLFree"> درس مجاني للمعاينة</label><div class="acts"><button class="btn p" id="newLSave">أضف الدرس</button><button class="btn" data-close>إلغاء</button></div>',m=>{const hydrate=async()=>{const id=vimeoId($('#newLVimeo').value);if(!id)return;$('#newVStatus').textContent='جارٍ قراءة مدة الفيديو…';try{const d=await SA('/vimeo/'+id);$('#newLVimeo').value=id;$('#newLDur').value=d.duration;$('#newVStatus').textContent='✓ '+d.duration+(d.title?' · '+d.title:'')}catch(e){$('#newVStatus').textContent=e.message}};$('#newLVimeo').onblur=hydrate;$('#newLSave').onclick=()=>{const title=$('#newLAr').value.trim(),titleEn=$('#newLEn').value.trim();if(!title&&!titleEn)return alert('اكتب عنوان الدرس');harvest();LESSONS.push({chapter:+$('#newLCh').value,title,title_en:titleEn,duration:$('#newLDur').value.trim(),vimeo:vimeoId($('#newLVimeo').value),free:$('#newLFree').checked});m.remove();render()}});
    }
    function previewVideo(id){modal('<div class="modal-title"><h2>معاينة الفيديو</h2><span class="chip en">Vimeo '+esc(id)+'</span></div><div class="admin-video-preview"><iframe src="https://player.vimeo.com/video/'+esc(id)+'?title=0&byline=0&portrait=0&dnt=1" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div><div class="acts"><button class="btn" data-close>إغلاق</button></div>')}
    function bindWorkspace(){
      $$('.addToChapter').forEach(b=>b.onclick=()=>{harvest();lessonDialog(+b.dataset.ci)});
      $$('.chTop').forEach(b=>b.onclick=()=>moveChapter(+b.dataset.ci,0));$$('.chUp').forEach(b=>b.onclick=()=>moveChapter(+b.dataset.ci,+b.dataset.ci-1));$$('.chDown').forEach(b=>b.onclick=()=>moveChapter(+b.dataset.ci,+b.dataset.ci+1));
      $$('.chEdit').forEach(b=>b.onclick=()=>{harvest();chapterDialog(CHAPTERS[+b.dataset.ci],+b.dataset.ci)});
      $$('.chDel').forEach(b=>b.onclick=()=>{const i=+b.dataset.ci;if(CHAPTERS.length===1)return alert('يجب أن تبقى باقة المحتوى بفصل واحد على الأقل');const count=LESSONS.filter(l=>(l.chapter||0)===i).length;if(!confirm('حذف الفصل؟ '+(count?'ستنقل دروسه إلى الفصل الأول ولن تُحذف.':'')))return;harvest();LESSONS.forEach(l=>{const ch=l.chapter||0;if(ch===i)l.chapter=i===0?1:0;if(ch>i)l.chapter=ch-1});CHAPTERS.splice(i,1);render()});
      $$('.lTop').forEach(b=>b.onclick=()=>moveLesson(+b.dataset.i,0,true));$$('.lUp').forEach(b=>b.onclick=()=>moveLesson(+b.dataset.i,-1));$$('.lDown').forEach(b=>b.onclick=()=>moveLesson(+b.dataset.i,1));
      $$('.lDel').forEach(b=>b.onclick=()=>{if(!confirm('حذف هذا الدرس؟'))return;harvest();LESSONS.splice(+b.dataset.i,1);render()});
      $$('.previewVideo').forEach(b=>b.onclick=()=>previewVideo(b.dataset.vimeoId));
      async function hydrateRow(row){const input=row.querySelector('[data-vimeo]'),duration=row.querySelector('[data-duration]'),status=row.querySelector('.vimeo-status'),id=vimeoId(input?.value);if(!id)return;status.textContent='جارٍ قراءة المدة…';try{const d=await SA('/vimeo/'+id);input.value=id;input.dataset.lastVimeo=id;duration.value=d.duration;status.textContent='✓ '+d.duration+(d.title?' · '+d.title:'');harvest();stats()}catch(e){status.textContent=e.message}}
      $$('.fetchDuration').forEach(b=>b.onclick=()=>hydrateRow(b.closest('[data-li]')));
      $$('#lessonWorkspace [data-vimeo]').forEach(input=>input.onblur=()=>{const id=vimeoId(input.value);if(id&&id!==input.dataset.lastVimeo)hydrateRow(input.closest('[data-li]'))});
    }
    async function load(){CURRENT=$('#lessonPkg').value;const p=packageById(CURRENT);CHAPTERS=readCourseChapters(p);LESSONS=(await SA('/lessons/'+encodeURIComponent(CURRENT))).map(x=>({...x,chapter:Number(x.chapter||0)}));render()}
    async function save(){harvest();const btn=$('#lessonSave');btn.disabled=true;btn.textContent='جارٍ الحفظ…';try{await Promise.all([SA('/lessons/'+encodeURIComponent(CURRENT),{method:'PUT',body:LESSONS}),CA('/packages/'+encodeURIComponent(CURRENT),{method:'PUT',body:{_chapters:CHAPTERS}})]);PACKAGES=await request('/api/admin-package-summary');toast('تم حفظ ترتيب الفصول والدروس والفيديوهات');render()}finally{btn.disabled=false;btn.textContent='💾 حفظ الكل'}}
    $('#lessonPkg').onchange=()=>load().catch(e=>alert(e.message));$('#lessonLoad').onclick=()=>load().catch(e=>alert(e.message));$('#lessonSave').onclick=()=>save().catch(e=>alert(e.message));
    $('#chapterAdd').onclick=()=>{harvest();chapterDialog(null,-1)};$('#lessonAdd').onclick=()=>{harvest();lessonDialog(0)};
    $('#lessonPreviewAll').onclick=()=>{harvest();window.open('/#learn/'+encodeURIComponent(CURRENT),'_blank')};
    $('#lessonBulk').onclick=()=>{harvest();modal('<h2>إضافة دروس جماعية</h2><label class="f"><span>الفصل</span><select id="bulkChapter">'+CHAPTERS.map((c,k)=>'<option value="'+k+'">'+esc(chapterTitle(c,k))+'</option>').join('')+'</select></label><label class="f"><span>سطر لكل درس: العنوان، المدة، Vimeo ID</span><textarea id="bulkLessons" rows="9" placeholder="مقدمة الدورة, 08:30, 912345678"></textarea></label><div class="acts"><button class="btn p" id="bulkSave">إضافة</button><button class="btn" data-close>إلغاء</button></div>',m=>{$('#bulkSave').onclick=()=>{const ch=+$('#bulkChapter').value,lines=$('#bulkLessons').value.split('\n').map(x=>x.trim()).filter(Boolean);if(!lines.length)return alert('أضف درسًا واحدًا على الأقل');lines.forEach(line=>{const p=line.split(',').map(x=>x.trim());LESSONS.push({chapter:ch,title:p[0]||'',title_en:'',duration:p[1]||'',vimeo:vimeoId(p[2]),free:false})});m.remove();render();toast('تمت إضافة '+lines.length+' دروس — اضغط حفظ الكل')}})};
    setTimeout(()=>load().catch(e=>alert(e.message)),0);
  };

  function mark(){document.documentElement.dataset.adminUi='v19';document.title='لوحة إدارة السعيد V19';document.querySelectorAll('.vbadge').forEach(x=>x.textContent='V19')}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mark,{once:true});else mark();
  new MutationObserver(mark).observe(document.documentElement,{subtree:true,childList:true});
})();
