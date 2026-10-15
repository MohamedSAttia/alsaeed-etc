(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=v=>typeof v==='number'&&Number.isFinite(v)?`${v}%`:'غير متاح';
const date=v=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=8640000000000000?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',calendar:'gregory',day:'2-digit',month:'2-digit',year:'numeric'}).format(v):'غير متاح';
const statuses={active:'نشط',expiring:'على وشك الانتهاء',expired:'منتهٍ',unlimited:'غير محدود',unknown:'تاريخ غير متاح'};
function timing(e){return `<p>التسجيل (ميلادي، السعودية): <b>${date(e.created)}</b> · مضى <b>${e.daysEnrolled??'—'}</b> يوم كامل</p><p>الحالة: <b>${statuses[e.enrollmentStatus]||statuses.unknown}</b> · المتبقي: <b>${e.enrollmentStatus==='unlimited'?'غير محدود':e.remainingDays===null||e.remainingDays===undefined?'غير متاح':e.remainingDays+' يوم'}</b></p>`;}
function ranked(rows){
 const sorted=rows.filter(x=>Number.isFinite(x.progress)).sort((a,b)=>b.progress-a.progress || (b.avgExam??-1)-(a.avgExam??-1) || String(a.user.id).localeCompare(String(b.user.id)));
 let last=null,rank=0;
 return new Map(sorted.map((x,i)=>{const key=JSON.stringify([x.progress,x.avgExam]);if(key!==last)rank=i+1;last=key;return [x.id,{rank,best:rank===1&&(x.progress>0||(x.avgExam??0)>0)}];}));
}
function render(overview,pack){
 if(!overview||!Number.isFinite(overview.serverNow))return '<div class="note warn">بيانات المتابعة غير متاحة. اتصل بالخادم واضغط تحديث التقدم.</div><button class="btn p" id="refreshTrainerProgress">تحديث التقدم</button>';
 const rows=(overview.students||[]).flatMap(user=>(user.learningPackages||[]).map(e=>({...e,user})));
 const ids=[...new Set(rows.map(e=>e.package_id))];
 let chosen=window.__trackingPackage||'';if(!ids.includes(chosen))chosen='';
 const status=window.__trackingStatus||'', scope=chosen?rows.filter(e=>e.package_id===chosen):rows;
 const ranks=new Map();for(const id of ids)for(const [key,value] of ranked(rows.filter(e=>e.package_id===id)))ranks.set(key,value);
 const visible=scope.filter(e=>!status||e.enrollmentStatus===status).sort((a,b)=>String(a.package_id).localeCompare(String(b.package_id))||(ranks.get(a.id)?.rank??Infinity)-(ranks.get(b.id)?.rank??Infinity)||String(a.user.name).localeCompare(String(b.user.name)));
 return `<section class="card pad"><h3>متابعة الاشتراكات وترتيب المشاركين</h3><p>الترتيب داخل كل باقة حسب نسبة الدروس المسجلة مكتملة، ثم متوسط نتائج الاختبارات المسجلة؛ النتائج المتساوية تتشارك الترتيب. هذا مؤشر متابعة مسجل، وليس إثبات مشاهدة أو تقييمًا شاملًا للمهارة.</p><p>قريب الانتهاء: خلال 7 أيام. المتبقي مقرب لأعلى؛ المنتهي عند بلوغ موعده. آخر تحديث: ${date(overview.serverNow)} (السعودية).</p><div class="grid g3"><label>الباقة<select id="trackingPackage"><option value="">كل الباقات (ترتيب مستقل لكل باقة)</option>${ids.map(id=>`<option value="${esc(id)}" ${chosen===id?'selected':''}>${esc(pack(id)?.ar||id)}</option>`).join('')}</select></label><label>حالة الاشتراك<select id="trackingStatus"><option value="">الكل</option>${Object.entries(statuses).map(([id,label])=>`<option value="${id}" ${status===id?'selected':''}>${label}</option>`).join('')}</select></label><label>بحث عن متدرب<input id="studentSearch" type="search" placeholder="الاسم أو البريد"></label></div><p>الاشتراكات: ${scope.length} · على وشك الانتهاء: ${scope.filter(e=>e.enrollmentStatus==='expiring').length} · منتهية: ${scope.filter(e=>e.enrollmentStatus==='expired').length}</p><button class="btn p" id="refreshTrainerProgress">تحديث التقدم</button></section><div class="grid g3" style="margin-top:20px">${visible.map(e=>{const r=ranks.get(e.id);return `<article class="card pad" data-student-row="${esc((e.user.name+' '+e.user.email).toLowerCase())}"><h3>${esc(e.user.name)}</h3><p dir="ltr">${esc(e.user.email)}</p><b>${esc(pack(e.package_id)?.ar||e.package_id)}</b>${timing(e)}<p>تقدم الدروس: <b>${pct(e.progress)}</b>${e.progressStatus==='unrecorded'?' · لا يوجد تقدم محفوظ':e.progressStatus==='invalid'?' · تعذّر قراءة السجل':e.progressStatus==='no_video_curriculum'?' · لا توجد دروس فيديو لاحتساب النسبة':''}</p>${Number.isFinite(e.progress)?`<div class="mini-progress"><i style="width:${e.progress}%"></i></div><p>${e.lessonDone}/${e.lessonTotal} درسًا مكتملًا بحسب السجل</p>`:''}<p>متوسط الاختبارات: <b>${e.avgExam===null?'لا توجد نتائج صالحة':pct(e.avgExam)}</b></p><p>الترتيب في الباقة: <b>${r?'#'+r.rank:'غير مصنف'}</b> ${r?.best?'🏅 الأفضل وفق المؤشر':''}</p><p>آخر نشاط محفوظ: ${date(e.lastActivity)}</p><button class="btn o full" data-student="${esc(e.user.id)}">تفاصيل المتدرب وتعديل المدة</button></article>`;}).join('')||'<p>لا توجد اشتراكات مطابقة.</p>'}</div>`;
}
function bind(){for(const [id,key] of [['trackingPackage','__trackingPackage'],['trackingStatus','__trackingStatus']]){const el=document.getElementById(id);if(el)el.onchange=()=>{window[key]=el.value;window.APP.render();};}}
window.AlsaeedTraineeTracking={render,bind,timing,ranked,pct};
})();
