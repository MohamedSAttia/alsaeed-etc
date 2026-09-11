/* Al Saeed LMS — V18 safe integration overlay
   Adds richer Package Builder and generic Question Bank import without replacing working backend. */
'use strict';

function cleanPackageRows(){
  return PACKAGES.map(p=>{ const {counts,...rest}=p||{}; return {...rest}; });
}

function courseOptions(selected){
  const list=(CONTENT.courses||[]).map(c=>({id:c.id,label:c.ar||c.en||c.id}));
  return '<option value="">— اختر البرنامج —</option>'+list.map(c=>'<option value="'+esc(c.id)+'" '+(selected===c.id?'selected':'')+'>'+esc(c.label)+'</option>').join('');
}

async function savePackageList(list){
  await request('/api/admin/content',{method:'PUT',body:{packages:list}});
  await reloadBase();
}

vPackages=function(){
  const groups={};
  PACKAGES.forEach(p=>{const k=p.course||'unlinked';(groups[k]=groups[k]||[]).push(p)});
  const order=[...(CONTENT.courses||[]).map(c=>c.id),'unlinked',...Object.keys(groups).filter(k=>k!=='unlinked'&&!(CONTENT.courses||[]).some(c=>c.id===k))];
  const seen=new Set();
  return hero('الباقات','إدارة الباقات ككيانات فعلية مرتبطة ببرامجها، مع بيانات ثنائية اللغة ومحتوى قابل للبناء.','<button class="btn p" id="newPackage">＋ باقة جديدة</button>')+
    order.filter(cid=>groups[cid]&&!seen.has(cid)&&(seen.add(cid),true)).map(cid=>{
      const list=groups[cid],label=cid==='unlinked'?'⚠ باقات غير مرتبطة ببرنامج':courseName(cid);
      return '<div class="course-block"><div class="course-head"><h2>'+esc(label)+'</h2><span>'+list.length+' باقات</span></div><div class="grid g3">'+list.map(p=>
        '<div class="card package-card"><h3>'+esc(p.ar||p.id)+'</h3><div class="en muted">'+esc(p.code||p.id)+' · '+esc(p.en||'')+'</div>'+
        '<div class="badges"><span class="chip o">'+Number(p.price||0)+' '+esc(p.currency||'USD')+'</span><span class="chip">'+Number(p.days||90)+' يوم</span><span class="chip">'+esc(p.type||'package')+'</span><span class="chip '+(p.active===false?'bad':'ok')+'">'+(p.active===false?'مؤرشفة':'منشورة')+'</span></div>'+
        '<div class="badges"><span class="chip">❓ '+(p.counts?.questions||0)+'</span><span class="chip">🎬 '+(p.counts?.lessons||0)+'</span><span class="chip">📝 '+(p.counts?.exams||0)+'</span><span class="chip">📚 '+(p.counts?.resources||0)+'</span></div>'+
        (p.desc?'<p>'+esc(p.desc)+'</p>':'')+
        '<div class="acts"><button class="btn sm editPackage" data-id="'+esc(p.id)+'">تعديل</button><button class="btn sm packageQ" data-id="'+esc(p.id)+'">الأسئلة</button>'+(p.active===false?'<button class="btn sm restorePackage" data-id="'+esc(p.id)+'">إعادة نشر</button>':'<button class="btn sm d archivePackage" data-id="'+esc(p.id)+'">أرشفة</button>')+'</div></div>'
      ).join('')+'</div></div>';
    }).join('');
};

bindPackages=function(){
  const np=$('#newPackage'); if(np)np.onclick=()=>openPackage({});
  $$('.editPackage').forEach(b=>b.onclick=()=>openPackage(PACKAGES.find(x=>x.id===b.dataset.id)||{}));
  $$('.packageQ').forEach(b=>b.onclick=()=>{CURRENT=b.dataset.id;TAB='questions';draw()});
  $$('.archivePackage').forEach(b=>b.onclick=async()=>{
    if(!confirm('أرشفة هذه الباقة؟ ستختفي من الشراء العام ولن تُحذف بياناتها.'))return;
    const list=cleanPackageRows(),i=list.findIndex(x=>x.id===b.dataset.id); if(i<0)return;
    list[i]={...list[i],active:false,updated:Date.now()};
    await savePackageList(list); toast('تمت أرشفة الباقة'); draw();
  });
  $$('.restorePackage').forEach(b=>b.onclick=async()=>{
    const list=cleanPackageRows(),i=list.findIndex(x=>x.id===b.dataset.id); if(i<0)return;
    list[i]={...list[i],active:true,updated:Date.now()};
    await savePackageList(list); toast('تمت إعادة نشر الباقة'); draw();
  });
};

openPackage=function(p={}){
  const chapters=Array.isArray(p._chapters)?p._chapters:[];
  const chAr=chapters.map(x=>typeof x==='object'?(x.ar||''):String(x||'')).join('\n');
  const chEn=chapters.map(x=>typeof x==='object'?(x.en||''):'').join('\n');
  modal('<h2>'+(p.id?'تعديل الباقة':'باقة جديدة')+'</h2>'+
    '<div class="row3"><label class="f"><span>ID</span><input id="pid" class="en" value="'+esc(p.id||'')+'" '+(p.id?'disabled':'')+'></label><label class="f"><span>Code</span><input id="pcode" class="en" value="'+esc(p.code||'')+'"></label><label class="f"><span>البرنامج</span><select id="pcourse">'+courseOptions(p.course||'')+'</select></label></div>'+
    '<div class="row"><label class="f"><span>الاسم العربي</span><input id="par" value="'+esc(p.ar||'')+'"></label><label class="f"><span>English title</span><input id="pen" class="en" value="'+esc(p.en||'')+'"></label></div>'+
    '<div class="row"><label class="f"><span>الوصف العربي</span><textarea id="pdesc" rows="3">'+esc(p.desc||'')+'</textarea></label><label class="f"><span>English description</span><textarea id="pdescen" class="en" rows="3">'+esc(p.desc_en||'')+'</textarea></label></div>'+
    '<div class="row"><label class="f"><span>الفئة المستهدفة</span><textarea id="paud" rows="2">'+esc(p.audience||'')+'</textarea></label><label class="f"><span>Target audience</span><textarea id="pauden" class="en" rows="2">'+esc(p.audience_en||'')+'</textarea></label></div>'+
    '<div class="row4"><label class="f"><span>النوع</span><select id="ptype">'+['full','sim','review','self',''].map(x=>'<option value="'+x+'" '+((p.type||'')===x?'selected':'')+'>'+esc(x||'other')+'</option>').join('')+'</select></label><label class="f"><span>السعر</span><input id="pprice" type="number" step="0.01" value="'+Number(p.price||0)+'"></label><label class="f"><span>العملة</span><select id="pcurr">'+['USD','SAR','EGP','AED'].map(x=>'<option '+((p.currency||'USD')===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label class="f"><span>مدة الوصول/يوم</span><input id="pdays" type="number" value="'+Number(p.days||90)+'"></label></div>'+
    '<div class="row"><label class="f"><span>الساعات التدريبية</span><input id="phours" type="number" value="'+Number(p.hours||0)+'"></label><label class="f"><span>صورة / Cover URL</span><input id="pimg" class="en" value="'+esc(p.image||'')+'"></label></div>'+
    '<div class="row"><label class="f"><span>الفصول بالعربية — سطر لكل فصل</span><textarea id="pchAr" rows="6">'+esc(chAr)+'</textarea></label><label class="f"><span>Chapters in English — one per line</span><textarea id="pchEn" class="en" rows="6">'+esc(chEn)+'</textarea></label></div>'+
    '<div class="row"><label><input id="pactive" type="checkbox" style="width:auto" '+(p.active===false?'':'checked')+'> منشورة</label><label><input id="pfeat" type="checkbox" style="width:auto" '+(p.featured?'checked':'')+'> مميزة</label></div>'+
    '<div class="acts"><button class="btn p" id="savePackage">حفظ</button><button class="btn" data-close>إلغاء</button></div>',m=>{
      $('#savePackage').onclick=async()=>{
        try{
          const id=String(p.id||$('#pid').value).trim().toLowerCase();
          const ar=$('#par').value.trim(),course=$('#pcourse').value;
          if(!/^[a-z0-9][a-z0-9_-]{2,80}$/.test(id))return alert('ID يجب أن يكون بالإنجليزية وبدون مسافات.');
          if(!ar)return alert('الاسم العربي مطلوب.');
          if(!course)return alert('يجب ربط الباقة ببرنامج.');
          const list=cleanPackageRows();
          const existing=list.findIndex(x=>x.id===id);
          if(!p.id&&existing>=0)return alert('معرّف الباقة مستخدم بالفعل.');
          const a=$('#pchAr').value.split('\n').map(x=>x.trim()),e=$('#pchEn').value.split('\n').map(x=>x.trim()),chs=[];
          for(let i=0;i<Math.max(a.length,e.length);i++)if(a[i]||e[i])chs.push({ar:a[i]||'',en:e[i]||''});
          const body={...(p||{}),id,course,code:$('#pcode').value.trim()||id,ar,en:$('#pen').value.trim(),desc:$('#pdesc').value.trim(),desc_en:$('#pdescen').value.trim(),audience:$('#paud').value.trim(),audience_en:$('#pauden').value.trim(),type:$('#ptype').value,price:+$('#pprice').value||0,currency:$('#pcurr').value,days:Math.max(1,+$('#pdays').value||90),hours:Math.max(0,+$('#phours').value||0),image:$('#pimg').value.trim(),_chapters:chs,active:$('#pactive').checked,featured:$('#pfeat').checked,cert:$('#ptype').value==='full',schemaVersion:15,updated:Date.now(),created:p.created||Date.now()};
          if(existing>=0)list[existing]=body;else list.push(body);
          await savePackageList(list); m.remove(); toast('تم حفظ الباقة وربطها بالبرنامج'); draw();
        }catch(e){alert(e.message||String(e))}
      };
    });
};

function normalizeImportedQuestion(q){
  const ar=String(q.question_ar??q.q_ar??'').trim();
  const en=String(q.question_en??q.q_en??q.q??q.question??'').trim();
  const optsAr=Array.isArray(q.options_ar)?q.options_ar:(Array.isArray(q.o_ar)?q.o_ar:[]);
  const optsEn=Array.isArray(q.options_en)?q.options_en:(Array.isArray(q.o_en)?q.o_en:(Array.isArray(q.o)?q.o:[]));
  let correct=q.correct;
  if(Array.isArray(q.c))correct=q.c.map(i=>String.fromCharCode(65+Number(i))).join(',');
  if(Array.isArray(correct))correct=correct.join(',');
  return {
    domain:String(q.domain??q.dm??'').trim(),topic:String(q.topic??q.ch??'').trim(),difficulty:String(q.difficulty||'medium'),type:String(q.type??q.t??'single'),
    question_ar:ar,question_en:en,options_ar:optsAr.map(String),options_en:optsEn.map(String),correct:String(correct||'A').toUpperCase(),
    explanation_ar:String(q.explanation_ar??q.f_ar??'').trim(),explanation_en:String(q.explanation_en??q.f_en??q.f??'').trim(),
    reference:String(q.reference||'').trim(),approach:String(q.approach??q.ap??'').trim(),active:q.active!==false
  };
}

function openGenericQuestionImport(){
  const pkg=$('#qPkg')?.value||CURRENT;
  if(!pkg)return alert('اختر الباقة أولاً.');
  modal('<h2>استيراد بنك أسئلة JSON</h2><div class="note info"><b>قاعدة اللغة:</b> لن يتم نسخ النص الإنجليزي تلقائيًا إلى الحقول العربية. إذا لم توجد ترجمة عربية حقيقية ستبقى الحقول العربية فارغة.</div><label class="f"><span>ملف JSON</span><input id="genericQFile" type="file" accept="application/json,.json"></label><label><input id="genericReplace" type="checkbox" style="width:auto"> حذف أسئلة الباقة الحالية أولاً (غير موصى به)</label><div class="acts"><button class="btn p" id="genericImportGo">استيراد</button><button class="btn" data-close>إلغاء</button></div>',m=>{
    $('#genericImportGo').onclick=async()=>{
      const file=$('#genericQFile').files[0]; if(!file)return alert('اختر ملف JSON.');
      let raw;try{raw=JSON.parse(await file.text())}catch{return alert('ملف JSON غير صالح.');}
      const src=Array.isArray(raw)?raw:(Array.isArray(raw.questions)?raw.questions:(Array.isArray(raw.rows)?raw.rows:[]));
      if(!src.length)return alert('لم أجد أسئلة داخل الملف.');
      const rows=src.slice(0,5000).map(normalizeImportedQuestion).filter(q=>q.question_ar||q.question_en);
      if(!rows.length)return alert('لا توجد أسئلة صالحة للاستيراد.');
      if($('#genericReplace').checked){
        if(!confirm('سيتم حذف الأسئلة الحالية لهذه الباقة قبل الاستيراد. متابعة؟'))return;
        const existing=await CA('/questions/'+encodeURIComponent(pkg));
        for(const q of existing)await CA('/questions/'+encodeURIComponent(q.id),{method:'DELETE'});
      }
      const r=await CA('/questions/'+encodeURIComponent(pkg)+'/bulk',{method:'POST',body:{rows}});
      m.remove(); CURRENT=pkg; QUESTIONS=await QB('/'+encodeURIComponent(pkg)); PACKAGES=await request('/api/admin-package-summary');
      toast('تم استيراد '+Number(r.count||rows.length)+' سؤال'); renderQuestionTable();
    };
  });
}

const vQuestionsV18Base=vQuestions;
vQuestions=function(){
  return vQuestionsV18Base().replace('<button class="btn ghost" id="importPmp">📥 استيراد PMP</button>','<button class="btn ghost" id="importJsonAny">📥 استيراد JSON</button><button class="btn ghost" id="importPmp">📥 استيراد PMP</button>');
};
const bindQuestionsV18Base=bindQuestions;
bindQuestions=function(){
  bindQuestionsV18Base();
  const b=$('#importJsonAny'); if(b)b.onclick=openGenericQuestionImport;
};
