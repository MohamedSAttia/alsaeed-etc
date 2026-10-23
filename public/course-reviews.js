/* Real, opt-in course reviews. User-authored content is rendered only as text. */
(() => {
  'use strict';
  const tr=(ar,en)=>window.__lang==='en'?en:ar;
  const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  let current=null;
  function refresh(options={}){
    const app=document.getElementById('app'),hero=options.hero||app?.querySelector('[data-course-experience]');
    if(current?.dialog?.open&&!options.hero){if(window.APP?.me()?.id!==current.actor)current.dialog.close();else return;}
    if(!hero){current=null;return;}
    if(current?.hero===hero)return;
    const course=hero.dataset.courseExperience,root=make('section',undefined,'cd-section course-reviews');root.id='cd-reviews';
    (options.host||app.querySelector('.cd-main')||hero).append(root);
    const state={hero,root,course,dialog:options.dialog,actor:window.APP?.me()?.id};current=state;
    root.append(make('h2',tr('تقييمات المتدربين','Learner reviews')));
    const summary=make('p'),list=make('div'),editor=make('div'),status=make('p');status.setAttribute('role','status');
    root.append(summary,make('p',tr('المتوسط يشمل جميع التقييمات التي وافق المتدربون على نشرها. نعرض أحدث 50 تقييمًا دون تصفية حسب عدد النجوم.','The average includes every voluntarily published learner rating. The newest 50 entries are shown, without filtering by stars.')),list,editor,status);
    const alive=()=>current===state&&root.isConnected&&window.APP?.me()?.id===state.actor;
    const path='/course-reviews/'+encodeURIComponent(course);
    async function loadPublic(){
      const data=await window.APP.api(path,{cache:'no-store'});if(!alive())return;
      summary.textContent=data.count?`${data.average.toFixed(2)} / 5 ★ · ${data.count} ${tr('تقييم','ratings')}`:tr('لا توجد تقييمات منشورة بعد.','No published ratings yet.');
      for(const badge of document.querySelectorAll('[data-course-rating]'))if(badge.dataset.courseRating===course)badge.textContent=data.count?`${Number(data.average).toFixed(1)} / 5 ★ · ${data.count} ${tr('تقييم','ratings')}`:tr('لا توجد تقييمات منشورة بعد','No published ratings yet');
      list.replaceChildren();
      for(const review of data.reviews){const item=make('article',undefined,'review-entry');item.append(make('strong',review.displayName),make('p','★'.repeat(review.rating)+'☆'.repeat(5-review.rating)),make('p',review.body),make('small',new Date(review.updated).toLocaleDateString(window.__lang==='en'?'en-GB':'ar-EG')));list.append(item);}
    }
    state.loadPublic=loadPublic;
    async function loadEditor(){
      editor.replaceChildren();
      if(!window.APP.me()){const login=make('button',tr('سجّل الدخول لتقييم دورتك','Sign in to review your course'),'btn o');login.type='button';login.onclick=()=>window.APP.openAuth();editor.append(login);return;}
      const data=await window.APP.api(path+'/mine',{cache:'no-store'});if(!alive())return;
      if(data.eligible){
        const form=make('form'),rating=make('select'),name=make('input'),body=make('textarea'),consent=make('input'),submit=make('button',tr('نشر التقييم','Publish review'),'btn p');
        rating.required=true;rating.setAttribute('aria-label',tr('التقييم من 1 إلى 5','Rating from 1 to 5'));
        const placeholder=make('option',tr('اختر عدد النجوم','Choose stars'));placeholder.value='';rating.append(placeholder);
        for(let i=1;i<=5;i++){const option=make('option',`${i} / 5 ${'★'.repeat(i)}`);option.value=String(i);rating.append(option);}
        rating.value=String(data.review?.rating||'');name.maxLength=40;name.value=data.review?.displayName||'';name.placeholder=tr('اسم عرض اختياري، وليس اسمك الكامل','Optional display name, not your full name');body.maxLength=2000;body.rows=4;body.value=data.review?.body||'';
        for(const [label,input] of [[tr('التقييم','Rating'),rating],[tr('الاسم الظاهر للزوار (اختياري)','Public display name (optional)'),name],[tr('تعليقك (اختياري، حتى 2000 حرف)','Your review (optional, up to 2000 characters)'),body]]){const field=make('label',label,'f');field.append(input);form.append(field);}
        consent.type='checkbox';consent.required=true;consent.style.width='auto';const label=make('label',undefined,'review-consent');label.append(consent,document.createTextNode(tr(' أوافق على نشر النجوم والتعليق واسم العرض على صفحة الدورة للجميع. عند ترك الاسم فارغًا يظهر «متدرب». لا تكتب معلومات شخصية أو بريدًا أو هاتفًا. يمكنك تعديل تقييمك أو إلغاء نشره.',' I agree to publish my stars, review and display name on the public course page. An empty name is shown as “Learner”. Do not include personal information, email or phone numbers. You can edit or unpublish your review.')));form.append(label,submit);editor.append(form);
        form.onsubmit=async event=>{event.preventDefault();if(!alive())return;if(submit.disabled)return;submit.disabled=true;status.textContent=tr('جارٍ الحفظ…','Saving…');try{await window.APP.api(path,{method:'PUT',body:{rating:Number(rating.value),body:body.value,displayName:name.value,publicConsent:consent.checked}});if(!alive())return;await Promise.all([loadPublic(),loadEditor()]);status.textContent=tr('نُشر تقييمك وتم تحديث المتوسط.','Your review is published and the average updated.');}catch(error){if(alive())status.textContent=error.message;}finally{submit.disabled=false;}};
      }else editor.append(make('p',tr('يمكن للمشتركين باشتراك فعّال في إحدى باقات الدورة إضافة تقييم.','Learners with an active enrollment in a course package can add a review.')));
      if(data.review?.published){const remove=make('button',tr('إلغاء نشر تقييمي','Unpublish my review'),'btn o');remove.type='button';remove.onclick=async()=>{if(!alive())return;remove.disabled=true;try{await window.APP.api(path,{method:'DELETE'});if(!alive())return;await Promise.all([loadPublic(),loadEditor()]);status.textContent=tr('أُلغي النشر وتم تحديث المتوسط.','Your review is unpublished and the average updated.');}catch(error){if(alive())status.textContent=error.message;remove.disabled=false;}};editor.append(remove);}
    }
    const retry=()=>Promise.all([loadPublic(),loadEditor()]).catch(error=>{if(!alive())return;status.textContent=tr('تعذر تحميل التقييمات. ','Could not load reviews. ')+error.message;const button=make('button',tr('إعادة المحاولة','Retry'),'btn o');button.onclick=()=>{status.textContent='';retry();};status.append(button);});retry();
  }
  const start=()=>{const app=document.getElementById('app');if(app)new MutationObserver(refresh).observe(app,{childList:true});refresh();};
  // Return visits and focus refresh public figures, without discarding an in-progress form.
  addEventListener('focus',()=>current?.loadPublic().catch(()=>{}));
  function open(course){
    current?.dialog?.close();current?.root?.remove();current=null;
    const dialog=make('dialog',undefined,'learning-feedback-dialog'),heading=make('h2',tr('قيّم الدورة','Rate your course')),close=make('button',tr('إغلاق','Close'),'btn o');
    close.type='button';close.onclick=()=>dialog.close();dialog.append(heading,close);dialog.dataset.courseExperience=course;document.body.append(dialog);
    const actor=window.APP?.me()?.id;const timer=setInterval(()=>{if(window.APP?.me()?.id!==actor)dialog.close();},500);
    dialog.addEventListener('close',()=>{clearInterval(timer);dialog.remove();current=null;refresh();},{once:true});dialog.showModal();refresh({hero:dialog,host:dialog,dialog});
  }
  window.CourseReviews={refresh,open};
  document.addEventListener('click',e=>{const b=e.target.closest('[data-course-review]');if(b){e.preventDefault();open(b.dataset.courseReview);}});
  document.readyState==='loading'?addEventListener('DOMContentLoaded',start,{once:true}):start();
})();
