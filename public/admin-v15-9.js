/* V18.1 — separate Task and Review Status, persisted in question records. */
let QREVIEW_V18='all';
const vQuestionsReviewBase=vQuestions;
vQuestions=function(){
  return vQuestionsReviewBase().replace('<label class="f"><span>Difficulty</span><select id="qDiff"><option value="all">الكل</option><option>easy</option><option>medium</option><option>hard</option></select></label>',
    '<label class="f"><span>Review Status</span><select id="qReview"><option value="all">الكل</option><option value="needs_review">Needs Review</option><option value="reviewed">Reviewed</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label><label class="f"><span>Difficulty</span><select id="qDiff"><option value="all">الكل</option><option>easy</option><option>medium</option><option>hard</option></select></label>');
};

filteredQuestions=function(){
  const s=QSEARCH.toLowerCase();
  return QUESTIONS.filter(q=>{
    const ar=String(q.question_ar||'').trim();
    const hay=JSON.stringify([q.question_ar,q.question_en,q.explanation_ar,q.explanation_en,q.reference,q.topic,q.task,q.approach]).toLowerCase();
    return (!s||hay.includes(s))&&(QDOMAIN==='all'||q.domain===QDOMAIN)&&(QTYPE==='all'||q.type===QTYPE)&&(QDIFF==='all'||(q.difficulty||'medium')===QDIFF)&&(QLANG==='all'||(QLANG==='bilingual'&&ar)||(QLANG==='need'&&!ar))&&(QREVIEW_V18==='all'||(q.review_status||'needs_review')===QREVIEW_V18);
  });
};

const bindQuestionsReviewBase=bindQuestions;
bindQuestions=function(){
  bindQuestionsReviewBase();
  const r=$('#qReview');if(r)r.onchange=e=>{QREVIEW_V18=e.target.value;QPAGE=1;renderQuestionTable()};
};

const loadQuestionsReviewBase=loadQuestions;
loadQuestions=async function(){
  await loadQuestionsReviewBase();
  QREVIEW_V18='all';
  const r=$('#qReview');if(r)r.value='all';
};

function reviewOptions(v){
  return ['needs_review','reviewed','approved','rejected'].map(x=>'<option value="'+x+'" '+((v||'needs_review')===x?'selected':'')+'>'+x.replace('_',' ')+'</option>').join('');
}

openQuestion=function(q={}){
  const oe=q.options_en||q.options||[],oa=q.options_ar||[];
  modal('<h2>'+(q.id?'تعديل السؤال':'سؤال جديد')+'</h2><div class="row4"><label class="f"><span>Domain</span><input id="qeDomain" class="en" value="'+esc(q.domain||'')+'"></label><label class="f"><span>Topic</span><input id="qeTopic" value="'+esc(q.topic||'')+'"></label><label class="f"><span>Task</span><input id="qeTask" value="'+esc(q.task||'')+'"></label><label class="f"><span>Approach</span><input id="qeApproach" class="en" value="'+esc(q.approach||'')+'"></label></div><div class="row4"><label class="f"><span>Difficulty</span><select id="qeDiff">'+['easy','medium','hard'].map(x=>'<option '+((q.difficulty||'medium')===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label class="f"><span>Question Type</span><select id="qeType">'+['single','multiple','scenario','matching','drag_drop','ordering','hotspot','fill_blank'].map(x=>'<option '+((q.type||'single')===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label class="f"><span>Review Status</span><select id="qeReview">'+reviewOptions(q.review_status)+'</select></label><label class="f"><span>Correct Answer</span><input id="qeCorrect" class="en" value="'+esc(q.correct||'A')+'" placeholder="A أو A,C"></label></div><label class="f"><span>السؤال بالعربية</span><textarea id="qeAr" rows="4">'+esc(q.question_ar||'')+'</textarea></label><label class="f"><span>Question in English</span><textarea id="qeEn" class="en" rows="4">'+esc(q.question_en||'')+'</textarea></label><div class="section">الاختيارات — Arabic / English</div><div class="row"><div>'+optionFields('opAr',oa,'')+'</div><div>'+optionFields('opEn',oe,'en')+'</div></div><div class="row"><label class="f"><span>Reference</span><input id="qeRef" value="'+esc(q.reference||'')+'"></label><label class="f"><span>Active</span><select id="qeActive"><option value="1" '+(q.active===false?'':'selected')+'>نشط</option><option value="0" '+(q.active===false?'selected':'')+'>غير نشط</option></select></label></div><label class="f"><span>التفسير بالعربية</span><textarea id="qeExpAr" rows="3">'+esc(q.explanation_ar||'')+'</textarea></label><label class="f"><span>Explanation in English</span><textarea id="qeExpEn" class="en" rows="3">'+esc(q.explanation_en||'')+'</textarea></label><div class="acts"><button class="btn p" id="qSave">حفظ</button><button class="btn" id="qShow">Preview</button><button class="btn" data-close>إلغاء</button></div>',m=>{
    $('#qShow').onclick=()=>previewQuestion(readQuestionForm(q));
    $('#qSave').onclick=async()=>{
      try{
        const body=readQuestionForm(q);
        const r=await QB(q.id?'/'+encodeURIComponent(q.id):'',{method:q.id?'PUT':'POST',body});
        const id=q.id||(r&&r.id);
        if(id)await request('/api/pmp-2026/admin/question-meta/'+encodeURIComponent(id),{method:'PUT',body:{task:body.task,review_status:body.review_status}});
        m.remove();QUESTIONS=await QB('/'+encodeURIComponent(body.package_id));PACKAGES=await request('/api/admin-package-summary');toast('تم حفظ السؤال وبيانات المراجعة');renderQuestionTable();
      }catch(e){alert(e.message||String(e))}
    };
  });
};

readQuestionForm=function(q){
  return {...q,package_id:q.package_id||CURRENT,domain:$('#qeDomain').value.trim(),topic:$('#qeTopic').value.trim(),task:$('#qeTask').value.trim(),approach:$('#qeApproach').value.trim(),difficulty:$('#qeDiff').value,type:$('#qeType').value,review_status:$('#qeReview').value,question_ar:$('#qeAr').value.trim(),question_en:$('#qeEn').value.trim(),options_ar:$$('.opAr').map(x=>x.value),options_en:$$('.opEn').map(x=>x.value),correct:$('#qeCorrect').value.trim().toUpperCase(),reference:$('#qeRef').value.trim(),active:$('#qeActive').value==='1',explanation_ar:$('#qeExpAr').value.trim(),explanation_en:$('#qeExpEn').value.trim()};
};

duplicateQuestion=async function(q){
  if(!q)return;
  const b={package_id:q.package_id,domain:q.domain,topic:q.topic,difficulty:q.difficulty,type:q.type,question_ar:q.question_ar,question_en:q.question_en,options_ar:q.options_ar,options_en:q.options_en,correct:q.correct,explanation_ar:q.explanation_ar,explanation_en:q.explanation_en,reference:q.reference,active:false,approach:q.approach};
  const r=await QB('',{method:'POST',body:b});
  if(r&&r.id)await request('/api/pmp-2026/admin/question-meta/'+encodeURIComponent(r.id),{method:'PUT',body:{task:q.task||'',review_status:'needs_review'}});
  QUESTIONS=await QB('/'+encodeURIComponent(q.package_id));PACKAGES=await request('/api/admin-package-summary');toast('تم إنشاء نسخة غير نشطة وتحتاج مراجعة');renderQuestionTable();
};

exportQuestionsCsv=function(){
  const rows=filteredQuestions(),cols=['id','package_id','domain','task','topic','approach','difficulty','type','review_status','question_ar','question_en','correct','reference','active'];
  const csv='\ufeff'+[cols.join(','),...rows.map(r=>cols.map(k=>'"'+String(r[k]??'').replace(/"/g,'""')+'"').join(','))].join('\n');
  download('alsaeed-'+(CURRENT||'questions')+'.csv',csv,'text/csv;charset=utf-8');
};
