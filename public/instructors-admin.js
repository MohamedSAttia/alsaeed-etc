/* Instructor profiles do not create login accounts or change account roles. */
(function () {
  'use strict';
  const host=document.getElementById('instructorApp');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let token='',profiles=[],packages=[],courses=[],editing=null,sequence=0,saving=false;
  try { token=localStorage.getItem('as_panel_tok')||localStorage.getItem('alsaeed_token')||''; } catch {}
  const badgeAssets={pmp:'/assets/badges/pmi-atp-instructor-pmp-supplied.png',rmp:'/assets/badges/pmi-atp-instructor-rmp.png'};
  async function request(url,options={}) {
    const r=await fetch(url,{method:options.method||'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},...(options.body!==undefined?{body:JSON.stringify(options.body)}:{})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok){const e=new Error(data.error||'تعذّر الاتصال بالخادم');e.status=r.status;throw e;}
    return data;
  }
  function notice(text,error=false){const el=document.getElementById('instructorStatus');if(el){el.className='instructor-feedback'+(error?' error':'');el.textContent=text;}}
  function signIn(message='تحتاج إلى جلسة مشرف لفتح إدارة المدرّبين.') {
    host.innerHTML=`<section class="card"><h1>إدارة المدرّبين والمحاضرين</h1><p>${esc(message)}</p><div class="instructor-actions"><a class="btn p" href="/panel.html">دخول مركز الإدارة</a><button class="btn" id="checkSession">إعادة فحص الجلسة</button></div></section>`;
    document.getElementById('checkSession').onclick=()=>{try{token=localStorage.getItem('as_panel_tok')||localStorage.getItem('alsaeed_token')||'';}catch{}load();};
  }
  function editor() {
    const p=editing||{}, badges=p.badges||[];
    return `<section class="card"><h2 id="editorTitle">${p.id?'تعديل بيانات المدرّب':'تسجيل مدرّب'}</h2><p class="instructor-note">بيانات العرض على الباقات والشهادات. يبقى الاسم المحفوظ في الشهادات الصادرة سابقًا كما هو.</p><form id="instructorForm"><div class="instructor-forms">
      <label class="f"><span>الاسم بالعربية</span><input name="nameAr" maxlength="120" value="${esc(p.nameAr)}" required autocomplete="off"></label>
      <label class="f"><span>Name in English</span><input name="nameEn" dir="ltr" maxlength="120" value="${esc(p.nameEn)}" required autocomplete="off"></label>
      <label class="f"><span>المسمّى بالعربية</span><input name="titleAr" maxlength="160" value="${esc(p.titleAr)}" placeholder="مدرّب / محاضر"></label>
      <label class="f"><span>Title in English</span><input name="titleEn" dir="ltr" maxlength="160" value="${esc(p.titleEn)}" placeholder="Course Instructor"></label>
      <label class="f wide"><span>نبذة بالعربية</span><textarea name="bioAr" rows="3" maxlength="2000">${esc(p.bioAr)}</textarea></label>
      <label class="f wide"><span>Biography in English</span><textarea name="bioEn" dir="ltr" rows="3" maxlength="2000">${esc(p.bioEn)}</textarea></label>
      <p class="instructor-note wide">تظهر خانة مخصصة لتوقيع المدرّب بجوار اسمه. يُضاف التوقيع الحقيقي بعد استلام صورته المعتمدة.</p>
      <fieldset class="wide"><legend>اعتماد المدرّب المرتبط بالبرنامج</legend><p class="instructor-note">بتحديد الاعتماد تؤكد أنه موثق لهذا المدرّب؛ يظهر داخل البرنامج المحدد فقط.</p>${Object.entries(badgeAssets).map(([key,asset])=>`<label class="instructor-badge-option"><input type="checkbox" name="badge_${key}" ${badges.some(b=>b.courseId===key&&b.asset===asset)||badges.some(b=>b.courseId===key&&key==='pmp'&&b.asset==='/assets/badges/pmi-atp-instructor-pmp.png')?'checked':''}><img src="${asset}" alt="اعتماد مدرّب ${key.toUpperCase()}"><span>PMI-ATP Instructor · ${key.toUpperCase()}</span></label>`).join('')}</fieldset>
      <label class="f wide"><span>حالة الملف</span><select name="active"><option value="true" ${p.active!==false?'selected':''}>نشط</option><option value="false" ${p.active===false?'selected':''}>غير نشط</option></select></label>
    </div><div class="instructor-actions"><button class="btn p" type="submit">${p.id?'حفظ التعديلات':'إضافة المدرّب'}</button>${p.id?'<button class="btn" type="button" id="cancelInstructorEdit">إلغاء التعديل</button>':''}</div></form></section>`;
  }
  function render() {
    host.innerHTML=`<div class="instructor-heading"><div><span class="eyebrow">مركز إدارة السعيد</span><h1>المدرّبون والمحاضرون</h1><p>سجّل الملف التعريفي وحدّد مدرّب كل باقة.</p></div><button class="btn" id="reloadInstructors">تحديث البيانات</button></div><div id="instructorStatus" class="instructor-status" role="status" aria-live="polite"></div><div class="instructor-columns"><div>${editor()}</div><div><section class="card"><h2>الملفات المسجلة</h2><div class="instructor-list">${profiles.map(p=>`<article class="instructor-row"><div><strong dir="auto">${esc(p.nameAr||p.nameEn)}</strong><small dir="ltr">${esc(p.nameEn)}</small><p>${p.active===false?'غير نشط':'نشط'} · ${packages.filter(x=>x.instructorId===p.id).length} باقة</p></div><button class="btn" data-edit-instructor="${esc(p.id)}">تعديل</button></article>`).join('')||'<p>لم تُسجّل ملفات مدرّبين بعد.</p>'}</div></section><section class="card"><h2>تعيين المدرّب حسب الباقة</h2><p class="instructor-note">يظهر المدرّب على صفحة الباقة وفي الشهادات الجديدة للباقة الكاملة. تغيير التعيين لا يغيّر الشهادات السابقة.</p><div class="instructor-package-list">${packages.map(p=>{const course=courses.find(c=>c.id===p.course);return `<div class="instructor-package-row"><div><strong>${esc(p.ar||p.en||p.id)}</strong><small>${esc(course?.ar||course?.en||p.course)} · ${p.type==='full'?'باقة كاملة':'باقة جزئية'}</small></div><label><span class="sr-only">مدرّب ${esc(p.ar||p.id)}</span><select data-package-instructor="${esc(p.id)}"><option value="">لم يُحدّد</option>${profiles.map(i=>`<option value="${esc(i.id)}" ${p.instructorId===i.id?'selected':''} ${i.active===false?'disabled':''}>${esc(i.nameAr||i.nameEn)}${i.active===false?' (غير نشط)':''}</option>`).join('')}</select></label><button class="btn" data-save-assignment="${esc(p.id)}">حفظ</button></div>`;}).join('')}</div></section></div></div>`;
    document.getElementById('reloadInstructors').onclick=()=>load();
    document.querySelectorAll('[data-edit-instructor]').forEach(b=>b.onclick=()=>{editing=profiles.find(p=>p.id===b.dataset.editInstructor)||null;render();document.getElementById('editorTitle').scrollIntoView({block:'start',behavior:'smooth'});});
    document.getElementById('cancelInstructorEdit')?.addEventListener('click',()=>{editing=null;render();});
    document.getElementById('instructorForm').onsubmit=saveProfile;
    document.querySelectorAll('[data-save-assignment]').forEach(b=>b.onclick=()=>saveAssignment(b));
  }
  async function saveProfile(event) {
    event.preventDefault();if(saving)return;const form=event.currentTarget;if(!form.reportValidity())return;
    const data=new FormData(form), prior=editing, body={};
    for(const key of ['nameAr','nameEn','titleAr','titleEn','bioAr','bioEn'])body[key]=String(data.get(key)||'').trim();
    body.signatureName=prior?.signatureName||'';body.active=data.get('active')==='true';body.signatureAsset=prior?.signatureAsset||'';
    body.badges=(prior?.badges||[]).filter(b=>!Object.hasOwn(badgeAssets,b.courseId));
    for(const [courseId,asset] of Object.entries(badgeAssets))if(data.has('badge_'+courseId))body.badges.push({courseId,asset,label:'PMI Authorized Training Partner Instructor · '+courseId.toUpperCase(),verified:true});
    if(prior)body.expectedUpdated=prior.updated;
    saving=true;const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='جارٍ الحفظ…';
    try {const out=await request('/api/admin/instructors'+(prior?'/'+encodeURIComponent(prior.id):''),{method:prior?'PUT':'POST',body});if(!out.instructor?.id)throw new Error('لم يُؤكّد الخادم حفظ الملف');editing=null;await load();notice('تم حفظ ملف المدرّب.');}
    catch(e){notice(e.message,true);button.disabled=false;button.textContent=prior?'حفظ التعديلات':'إضافة المدرّب';}
    finally{saving=false;}
  }
  async function saveAssignment(button) {
    if(button.disabled)return;const pkg=packages.find(p=>p.id===button.dataset.saveAssignment);if(!pkg)return;
    const select=Array.from(document.querySelectorAll('[data-package-instructor]')).find(x=>x.dataset.packageInstructor===pkg.id);
    button.disabled=true;select.disabled=true;button.textContent='جارٍ الحفظ…';
    try {const id=select.value||null;const out=await request('/api/admin/packages/'+encodeURIComponent(pkg.id)+'/instructor',{method:'PUT',body:{instructorId:id,expectedInstructorId:pkg.instructorId||null}});if(out.ok!==true||out.packageId!==pkg.id||out.instructorId!==id)throw new Error('لم يُؤكّد الخادم التعيين المطلوب');pkg.instructorId=id;notice('تم تحديث مدرّب الباقة.');}
    catch(e){notice(e.message,true);select.value=pkg.instructorId||'';}
    finally{button.disabled=false;select.disabled=false;button.textContent='حفظ';}
  }
  async function load() {
    const run=++sequence;if(!token){signIn();return;}
    try {const [data,content]=await Promise.all([request('/api/admin/instructors'),request('/api/content')]);if(run!==sequence)return;profiles=Array.isArray(data.instructors)?data.instructors:[];packages=Array.isArray(content.packages)?content.packages:[];courses=Array.isArray(content.courses)?content.courses:[];render();}
    catch(e){if(run!==sequence)return;if(e.status===401||e.status===403)signIn(e.message);else{host.innerHTML=`<section class="card"><h1>تعذّر تحميل إدارة المدرّبين</h1><p role="alert">${esc(e.message)}</p><button class="btn" id="retryInstructors">إعادة المحاولة</button></section>`;document.getElementById('retryInstructors').onclick=load;}}
  }
  load();
})();
