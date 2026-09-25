/* Al-Saeed V22 — checkout confidence and launch policies. */
(() => {
  'use strict';
  const policies={
    terms:{ar:['الشروط والأحكام',[
      ['البرنامج والطلب','تعرض صفحة البرنامج نوع التدريب والمحتوى والسعر والعملة ومدة الوصول قبل الدفع. يبدأ الوصول الرقمي عند تأكيد مزود الدفع ويخص الحساب الذي أتم الشراء.'],
      ['استخدام المحتوى','الحساب شخصي. لا يجوز مشاركة بيانات الدخول أو نسخ المحتوى أو إعادة بيعه. تعتمد متطلبات شهادة الإتمام على وصف البرنامج؛ ولا تشمل الباقة رسوم اختبارات الجهات الخارجية إلا إذا ذُكر ذلك صراحة.'],
      ['المواعيد والفوترة','عند تغيير موعد برنامج مباشر نتواصل مع المسجلين ونوضح البدائل. تظهر ضريبة الطلب وبلد الفوترة قبل تأكيد الدفع وفق الإعدادات المعتمدة؛ احتفظ برقم الطلب لأي استفسار.']]],en:['Terms and conditions',[
      ['Program and order','The program page shows the delivery format, content, price, currency and access period before payment. Digital access starts after payment confirmation and belongs to the purchasing account.'],
      ['Content use','Accounts are personal. Sharing credentials, copying or reselling content is prohibited. Completion certificates follow the program description; external examination fees are excluded unless expressly included.'],
      ['Dates and billing','We contact learners when a live program date changes and explain the available options. Applicable tax and billing country are displayed before payment according to approved settings. Keep your order number for support.']]]},
    privacy:{ar:['سياسة الخصوصية',[
      ['ما نجمعه ولماذا','نجمع بيانات الحساب والتواصل والفوترة والطلبات وتقدم التعلم ونتائج الاختبارات والرسائل والطلبات المؤسسية لتقديم الخدمة والدعم وحمايتها وتحسينها.'],
      ['الدفع ومزودو الخدمة','يدخل العميل بيانات البطاقة لدى مزود الدفع؛ لا نحتفظ برقم البطاقة الكامل. قد نعالج البيانات اللازمة مع مزود الدفع والاستضافة والرسائل لتشغيل الخدمة.'],
      ['العروض المؤسسية والذكاء الاصطناعي','يمكن استخدام خدمة ذكاء اصطناعي لتلخيص الطلب المؤسسي وردود العميل لفريق السعيد. لا يحدد الملخص السعر أو الضريبة تلقائيًا، ويعتمد الفريق العرض قبل إرساله. يُرسل نص الطلب والردود اللازمة فقط إلى مزود الخدمة عند تفعيل هذه الميزة.'],
      ['الحفظ وحقوقك','نحتفظ بسجلات الطلبات والفواتير بحسب متطلبات الخدمة والالتزامات المعمول بها. يمكنك طلب الاطلاع على بياناتك أو تصحيحها أو الاستفسار عن حذفها عبر البريد أدناه، مع مراعاة السجلات المطلوب حفظها. رسائل التسويق تتبع تفضيلاتك.']]],en:['Privacy policy',[
      ['Information and purposes','We collect account, contact, billing, order, learning progress, assessment and submitted message or corporate inquiry data to provide, support, secure and improve the service.'],
      ['Payments and providers','Card details are entered with the payment provider; we do not retain the full card number. Payment, hosting and messaging providers may process the information needed to operate the service.'],
      ['Corporate requests and AI','If enabled, an AI provider summarizes corporate requests and buyer responses for our team. It does not automatically set prices or tax, and our team approves the proposal before delivery. Only the request and response text needed for the summary are sent to the provider.'],
      ['Retention and your requests','We retain order and invoice records as required for service delivery and applicable obligations. Email us to request access or correction, or ask about deletion subject to required retention. Marketing messages follow your preferences.']]]},
    refund:{ar:['الإلغاء والاسترداد',[
      ['تقديم الطلب','أرسل رقم الطلب وسبب الإلغاء إلى info@alsaeed-etc.com من البريد المرتبط بحسابك.'],
      ['مراجعة الحالة','نراجع نوع الباقة وبدء الوصول إلى المحتوى أو تقديم الجلسات والشروط المعلنة وقت الشراء والقواعد الواجبة التطبيق. عند تعذر تقديم جلسة مباشرة أو تغيير موعدها نتواصل بشأن البدائل المناسبة.'],
      ['إعادة المبلغ','عند اعتماد الاسترداد تعتمد مدة وصول المبلغ على وسيلة الدفع والبنك ومزود الخدمة.']]],en:['Cancellation and refunds',[
      ['Request a review','Send your order number and reason to info@alsaeed-etc.com from the email associated with your account.'],
      ['Assessment','We review the product type, whether digital access or live delivery has started, the terms shown at purchase and applicable rules. We contact enrolled learners about suitable options if a live session cannot be delivered or is rescheduled.'],
      ['Refund timing','For approved refunds, the time until funds appear depends on the payment method, bank and provider.']]]}
  };
  window.AL_SAEED_POLICIES=policies;
  const english=()=>document.documentElement.lang?.startsWith('en') || window.APP?.state?.lang==='en';
  const label=(ar,en)=>english()?en:ar;
  function showPolicy(key){
    const item=policies[key];if(!item||!window.APP)return;
    const [title,sections]=item[english()?'en':'ar'];
    APP.modal('<article class="v22-policy" dir="'+(english()?'ltr':'rtl')+'"><span class="eyebrow">AL SAEED</span><h2>'+title+'</h2>'+sections.map(([heading,body])=>'<section><h3>'+heading+'</h3><p>'+body+'</p></section>').join('')+'<div class="v22-policy-note">'+label('آخر تحديث: 25 سبتمبر 2026 · للاستفسار: ','Updated 25 September 2026 · Questions: ')+'<a href="mailto:info@alsaeed-etc.com">info@alsaeed-etc.com</a></div></article>');
  }
  function mountFooter(){
    const footer=document.querySelector('.ftr');if(!footer)return;
    let nav=footer.querySelector('.v22-legal');if(!nav){nav=document.createElement('nav');nav.className='v22-legal';footer.append(nav)}
    const lang=english()?'en':'ar';if(nav.dataset.lang===lang)return;nav.dataset.lang=lang;
    nav.setAttribute('aria-label',label('السياسات','Policies'));
    nav.innerHTML=['terms','privacy','refund'].map(k=>'<a href="/policies.html#'+k+'">'+policies[k][lang][0]+'</a>').join('');
  }
  function decorateCheckout(){
    const promo=document.getElementById('checkoutPromo');if(!promo)return;
    const box=promo.closest('.modal,.modal-box,.dialog')||promo.parentElement?.parentElement;if(!box||box.querySelector('.v22-checkout-trust'))return;
    box.insertAdjacentHTML('beforeend','<div class="v22-checkout-trust"><span>'+label('🔒 الدفع عبر مزود الخدمة','🔒 Provider hosted payment')+'</span><span>'+label('⚡ تفعيل الاشتراك بعد تأكيد الدفع','⚡ Access after payment confirmation')+'</span><button type="button" data-checkout-policy>'+label('راجع سياسة الاسترداد','Read the refund policy')+'</button></div>');
    box.querySelector('[data-checkout-policy]').onclick=()=>window.open('/policies.html#refund','_blank','noopener');
  }
  let frame=0;const refresh=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{mountFooter();decorateCheckout()})};
  const boot=()=>{refresh();new MutationObserver(refresh).observe(document.body,{childList:true,subtree:true})};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
