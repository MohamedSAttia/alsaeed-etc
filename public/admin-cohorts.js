(function(){
'use strict';
const app=()=>window.APP, $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const active=c=>c.active!==false&&c.active!==0;
const groups=()=>app().live?(app().adminOverview?.cohorts||[]):[];
const ready=()=>app().live&&app().me()?.role==='admin';
let selected='', showArchived=false;
function selector(id,required=false){return `<label class="f"><span>مجموعة المتابعة الخاصة ${required?'':'(اختياري)'}</span><select id="${esc(id)}"><option value="">${required?'اختر مجموعة':'بدون تغيير عضوية المجموعات'}</option>${groups().filter(active).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select><small>تنظيم إداري فقط؛ لا يمنح دورات أو يغيّر الاشتراكات. يمكن الانضمام لأكثر من مجموعة.</small></label>`;}
function value(id){const cohortId=$(id)?.value;return cohortId?{cohortId}:{};}
async function save(button,path,body,method='POST',message='تم الحفظ',done){
 if(!ready()){app().toast('تحتاج هذه العملية اتصالاً بالخادم وحساب إدارة.');return false;}
 if(button?.disabled)return false;
 const a=app(), token=a.token, route=location.hash, modal=$('ov');
 if(button)button.disabled=true;
 try{
  await a.api(path,{method,body});
  if(a.token!==token||a.me()?.role!=='admin')return true;
  if(done)done();
  const synced=await a.syncAdminData();
  if(a.token!==token||a.me()?.role!=='admin')return true;
  // A response must never dismiss a newer dialog or navigate away from a newer route.
  if(modal&&$('ov')===modal)a.closeModal();
  if(location.hash===route)a.render();
  a.toast(synced===false?'حُفظ التغيير، لكن تعذّر تحديث البيانات. اضغط تحديث قبل المتابعة.':message);
  return true;
 }catch(e){if(a.token===token)a.toast(e.message||'تعذّر الحفظ. حاول مرة أخرى.');return false;}
 finally{if(button?.isConnected)button.disabled=false;}
}
function chooseAction(title,path,body,message,done){
 if(!ready()){app().toast('اتصل بالخادم لتنظيم المتدربين.');return;}
 app().modal(`<h3>${esc(title)}</h3>${selector('cohortAction')}<div class="mdl-act"><button class="btn p" id="cohortActionSave">تأكيد</button><button class="btn o" data-close>إلغاء</button></div>`,()=>{$('cohortActionSave').onclick=()=>save($('cohortActionSave'),path,{...body,...value('cohortAction')},'POST',message,done);});
}
function bulkAssign(ids){
 if(!ready()){app().toast('اتصل بالخادم لتنظيم المتدربين.');return;}
 ids=[...new Set(ids)];if(!ids.length)return;
 app().modal(`<h3>إضافة ${ids.length} مستخدمًا إلى مجموعة</h3>${selector('cohortBulk',true)}<p>لن يُحذف أحد من مجموعاته الحالية ولن تُمنح أي باقة.</p><div class="mdl-act"><button class="btn p" id="cohortBulkSave">أضف إلى المجموعة</button><button class="btn o" data-close>إلغاء</button></div>`,()=>{$('cohortBulkSave').onclick=()=>{const id=$('cohortBulk').value;if(!id){app().toast('اختر مجموعة أولاً');return;}save($('cohortBulkSave'),'/admin/cohorts/'+encodeURIComponent(id)+'/members',{add:ids,remove:[]},'POST','أُضيف المتدربون إلى المجموعة',()=>{window.__usel=[];});};});
}
function render(){
 if(!ready()||!Array.isArray(app().adminOverview?.cohorts))return '<div class="note warn">بيانات مجموعات المتابعة غير متاحة. اتصل بالخادم وحدّث البيانات.</div><button class="btn p" id="cohortRefresh">تحديث</button>';
 const all=groups(), visible=all.filter(c=>showArchived||active(c));
 if(!visible.some(c=>String(c.id)===String(selected)))selected=visible[0]?.id||'';
 const chosen=visible.find(c=>String(c.id)===String(selected)), ids=new Set(chosen?.memberIds||[]);
 const students=app().adminOverview.students||[], users=app().DB.users||[];
 const roster=[...ids].map(id=>{const stored=students.find(u=>u.id===id);return {...users.find(u=>u.id===id),...stored,id,progress:stored?.progress??null,avgExam:stored?.avgExam??null,learningPackages:stored?.learningPackages||[]};});
 const packages=roster.flatMap(u=>u.learningPackages);
 const measured=packages.filter(e=>Number.isFinite(e.progress)&&Number.isFinite(e.lessonDone)&&Number.isFinite(e.lessonTotal)&&e.lessonTotal>0);
 const lessons=measured.reduce((n,e)=>n+e.lessonTotal,0), completed=measured.reduce((n,e)=>n+e.lessonDone,0);
 const exams=packages.filter(e=>Number.isFinite(e.examScoreCount)&&e.examScoreCount>0&&Number.isFinite(e.examScoreTotal));
 const examCount=exams.reduce((n,e)=>n+e.examScoreCount,0), examTotal=exams.reduce((n,e)=>n+e.examScoreTotal,0);
 const enrolled=roster.filter(u=>u.learningPackages.length>0).length;
 const groupMetrics=`<div class="detail-kpis"><div><b>${roster.length}</b><span>أعضاء المجموعة</span></div><div><b>${enrolled} / ${roster.length-enrolled}</b><span>لديهم اشتراكات / بلا اشتراك</span></div><div><b>${measured.length} / ${packages.length}</b><span>باقات بتقدم قابل للقياس / كل الباقات</span></div><div><b>${lessons?completed+' / '+lessons:'غير متاح'}</b><span>الدروس المكتملة المسجلة / الدروس القابلة للقياس</span></div><div><b>${lessons?Math.round(completed/lessons*100)+'%':'غير متاح'}</b><span>تقدم الدروس الموزون بعدد الدروس</span></div><div><b>${examCount?Math.round(examTotal/examCount*10)/10+'%':'غير متاح'}</b><span>متوسط ${examCount} نتيجة اختبار صالحة</span></div></div><p class="muted">تعتمد المجاميع على سجلات الاشتراكات القابلة للقياس فقط؛ تُستبعد السجلات غير المتاحة ولا تُحتسب صفرًا. كل اشتراك للمتدرب محسوب مستقلًا.</p>`;
 return `<section class="card pad"><h3>مجموعات المتابعة الخاصة بالإدارة</h3><p>اجمع المتدربين مثل محمد وأحمد وسيد لمتابعتهم معًا أو فتح تفاصيل كل متدرب. هذه مجموعات إدارية خاصة، منفصلة عن مجموعات الفصل الخاص، ولا تمنح أي باقة.</p><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><button class="btn p" id="cohortCreate">＋ مجموعة جديدة</button><button class="btn o" id="cohortRefresh">تحديث</button><label><input type="checkbox" id="cohortArchived" ${showArchived?'checked':''}> عرض المؤرشفة</label></div><label class="f" style="margin-top:16px"><span>المجموعة</span><select id="cohortSelect"><option value="">اختر مجموعة</option>${visible.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(selected)?'selected':''}>${esc(c.name)} (${c.memberIds?.length||0})${active(c)?'':' — مؤرشفة'}</option>`).join('')}</select></label>${!all.length?'<p>لا توجد مجموعات بعد. أنشئ أول مجموعة ثم أضف المتدربين.</p>':''}</section>${chosen?`<section class="card pad" style="margin-top:16px"><h3>${esc(chosen.name)}</h3><p>${ids.size} متدربًا · ${active(chosen)?'نشطة':'مؤرشفة؛ العضويات محفوظة ويمكن استعادتها'}</p>${groupMetrics}<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn o" id="cohortRename">تعديل الاسم</button><button class="btn o" id="cohortArchive">${active(chosen)?'أرشفة المجموعة':'استعادة المجموعة'}</button>${active(chosen)?'<button class="btn p" id="cohortMembers">إضافة متدربين</button>':''}</div><p>التقدم أدناه من السجل الفعلي. عدم توفر البيانات لا يعني 0%. المقارنة بين باقات مختلفة ليست ترتيبًا موحدًا.</p><label class="f"><span>بحث في أعضاء المجموعة</span><input type="search" id="cohortRosterSearch" placeholder="الاسم أو البريد"></label><div class="grid g2">${roster.map(u=>`<article class="card pad" data-cohort-row="${esc(((u.name||'')+' '+(u.email||'')).toLowerCase())}"><h4>${esc(u.name||'حساب غير متاح')}</h4><p dir="ltr" style="overflow-wrap:anywhere">${esc(u.email||'')}</p><p>تقدم الدروس المسجلة: <b>${window.AlsaeedTraineeTracking.pct(u.progress)}</b></p><p>متوسط الاختبارات: <b>${window.AlsaeedTraineeTracking.pct(u.avgExam)}</b></p><p>الاشتراكات: ${esc(u.enrollments??u.learningPackages?.length??'غير متاح')}</p>${u.learningPackages?.some(e=>!Number.isFinite(e.progress))?'<p class="muted">بعض الباقات بلا نسبة قابلة للقياس: سجل غير محفوظ أو غير صالح أو لا توجد دروس فيديو. النسبة الإجمالية تشمل الباقات القابلة للقياس فقط.</p>':''}<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn p" data-student="${esc(u.id)}">متابعة فردية والتفاصيل</button><button class="btn o" data-cohort-remove="${esc(u.id)}">إزالة من المجموعة فقط</button></div></article>`).join('')||'<p>المجموعة فارغة. أضف متدربين لبدء المتابعة.</p>'}</div></section>`:''}`;
}
function nameDialog(c){
 app().modal(`<h3>${c?'تعديل اسم المجموعة':'مجموعة متابعة جديدة'}</h3><label class="f"><span>اسم المجموعة</span><input id="cohortName" maxlength="120" value="${esc(c?.name||'')}" placeholder="مثال: دفعة أكتوبر"></label><div class="mdl-act"><button class="btn p" id="cohortNameSave">حفظ</button><button class="btn o" data-close>إلغاء</button></div>`,()=>{$('cohortNameSave').onclick=()=>{const name=$('cohortName').value.trim();if(!name){app().toast('أدخل اسم المجموعة');return;}save($('cohortNameSave'),'/admin/cohorts'+(c?'/'+encodeURIComponent(c.id):''),{name},c?'PUT':'POST');};});
}
function memberDialog(c){
 const ids=new Set(c.memberIds||[]), users=(app().DB.users||[]).filter(u=>!ids.has(u.id)&&u.role==='student');
 app().modal(`<h3>إضافة متدربين إلى ${esc(c.name)}</h3><label class="f"><span>بحث</span><input id="cohortMemberSearch" type="search" placeholder="الاسم أو البريد"></label><div style="max-height:45vh;overflow:auto">${users.map(u=>`<label data-cohort-candidate="${esc((u.name+' '+u.email).toLowerCase())}" style="display:flex;gap:8px;align-items:center;padding:10px;overflow-wrap:anywhere"><input type="checkbox" data-cohort-add="${esc(u.id)}"><span>${esc(u.name)}<br>${esc(u.email)}</span></label>`).join('')||'<p>لا يوجد متدربون آخرون.</p>'}</div><div class="mdl-act"><button class="btn p" id="cohortMembersSave">إضافة المحددين</button><button class="btn o" data-close>إلغاء</button></div>`,()=>{
 $('cohortMemberSearch').oninput=e=>{document.querySelectorAll('[data-cohort-candidate]').forEach(row=>row.style.display=row.dataset.cohortCandidate.includes(e.target.value.toLowerCase().trim())?'flex':'none');};
 $('cohortMembersSave').onclick=()=>{const add=[...document.querySelectorAll('[data-cohort-add]:checked')].map(el=>el.dataset.cohortAdd);if(!add.length){app().toast('اختر متدربًا واحدًا على الأقل');return;}save($('cohortMembersSave'),'/admin/cohorts/'+encodeURIComponent(c.id)+'/members',{add,remove:[]});};
 });
}
function bind(){
 const c=groups().find(c=>String(c.id)===String(selected));
 if($('cohortCreate'))$('cohortCreate').onclick=()=>nameDialog();
 if($('cohortRename'))$('cohortRename').onclick=()=>nameDialog(c);
 if($('cohortMembers'))$('cohortMembers').onclick=()=>memberDialog(c);
 if($('cohortSelect'))$('cohortSelect').onchange=e=>{selected=e.target.value;app().render();};
 if($('cohortArchived'))$('cohortArchived').onchange=e=>{showArchived=e.target.checked;app().render();};
 if($('cohortRosterSearch'))$('cohortRosterSearch').oninput=e=>document.querySelectorAll('[data-cohort-row]').forEach(row=>row.hidden=!row.dataset.cohortRow.includes(e.target.value.toLowerCase().trim()));
 if($('cohortArchive'))$('cohortArchive').onclick=()=>{if(confirm(active(c)?'أرشفة المجموعة مع الاحتفاظ بالعضويات والاشتراكات؟':'استعادة المجموعة؟'))save($('cohortArchive'),'/admin/cohorts/'+encodeURIComponent(c.id),{active:!active(c)},'PUT');};
 document.querySelectorAll('[data-cohort-remove]').forEach(b=>b.onclick=()=>{if(confirm('إزالة هذا المتدرب من المجموعة فقط؟ لن تتغير باقاته أو بيانات تقدمه.'))save(b,'/admin/cohorts/'+encodeURIComponent(c.id)+'/members',{add:[],remove:[b.dataset.cohortRemove]});});
 if($('cohortRefresh'))$('cohortRefresh').onclick=async()=>{const b=$('cohortRefresh');b.disabled=true;const a=app(),token=a.token,route=location.hash;try{const ok=await a.syncAdminData();if(a.token===token&&location.hash===route){a.render();if(ok===false)a.toast('تعذّر التحديث. حاول مرة أخرى.');}}catch(e){a.toast(e.message);}finally{if(b.isConnected)b.disabled=false;}};
}
window.AlsaeedAdminCohorts={render,bind,selector,value,save,chooseAction,bulkAssign};
})();
