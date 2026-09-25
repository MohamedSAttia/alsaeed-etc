/* Al-Saeed V22 — checkout confidence and launch policies. */
(() => {
  'use strict';
  const policies={
    terms:['الشروط والأحكام','تظهر محتويات الباقة وسعرها ومدة الوصول قبل الشراء. يبدأ الاشتراك عند تأكيد مزود الدفع للعملية ويخص الحساب المسجل فقط. لا يجوز مشاركة الحساب أو نسخ المحتوى أو إعادة بيعه. تختلف شروط الشهادة والأنشطة المطلوبة بحسب صفحة البرنامج. إذا تغير موعد التدريب المباشر نُخطر المسجلين ونوضح الخيارات المتاحة. للاستفسار اذكر رقم الطلب عند التواصل معنا.'],
    privacy:['سياسة الخصوصية','نجمع بيانات الحساب والاتصال والفوترة، وسجل الطلبات، وتقدم التعلم ونتائج الاختبارات، والرسائل التي ترسلها لنا. نستخدمها لتقديم الخدمة والفواتير والدعم وتحسين تجربة التعلم والرد على الاستفسارات. تعتمد رسائل التذكير على الاشتراك الاختياري. تُدخل بيانات البطاقة لدى مزود الدفع ولا تحتفظ المنصة برقم البطاقة الكامل. يمكنك طلب الاطلاع على بياناتك أو تصحيحها عبر البريد المبين أدناه؛ وقد نحتفظ بسجلات الفواتير بحسب المتطلبات المعمول بها.'],
    refund:['سياسة الإلغاء والاسترداد','لتقديم طلب مراجعة أرسل رقم الطلب وسبب الطلب إلى info@alsaeed-etc.com. نراجع الحالة بحسب نوع الباقة، بدء تقديم الخدمة، والشروط المعلنة وقت الشراء. عند تغيير موعد دورة مباشرة أو تعذر تقديمها نتواصل مع المسجلين بشأن بديل أو تسوية مناسبة. إذا اعتُمد الاسترداد، يختلف وقت وصول المبلغ بحسب وسيلة الدفع ومزود الخدمة.']
  };
  function showPolicy(key){
    const item=policies[key];if(!item||!window.APP)return;
    APP.modal('<div class="v22-policy"><span class="eyebrow">AL-SAEED</span><h2>'+item[0]+'</h2><p>'+item[1]+'</p><div class="v22-policy-note">آخر تحديث: سبتمبر 2026 · للاستفسار: info@alsaeed-etc.com</div></div>');
  }
  function mountFooter(){
    const footer=document.querySelector('.ftr');if(!footer||footer.querySelector('.v22-legal'))return;
    footer.insertAdjacentHTML('beforeend','<nav class="v22-legal" aria-label="السياسات"><button data-policy="terms">الشروط والأحكام</button><button data-policy="privacy">الخصوصية</button><button data-policy="refund">الاسترداد</button></nav>');
    footer.querySelectorAll('[data-policy]').forEach(b=>b.onclick=()=>showPolicy(b.dataset.policy));
  }
  function decorateCheckout(){
    const promo=document.getElementById('checkoutPromo');if(!promo)return;
    const box=promo.closest('.modal,.modal-box,.dialog')||promo.parentElement?.parentElement;if(!box||box.querySelector('.v22-checkout-trust'))return;
    box.insertAdjacentHTML('beforeend','<div class="v22-checkout-trust"><span>🔒 الدفع عبر مزود الخدمة</span><span>⚡ تفعيل الاشتراك بعد تأكيد الدفع</span><button type="button" data-checkout-policy>راجع سياسة الاسترداد</button></div>');
    box.querySelector('[data-checkout-policy]').onclick=()=>showPolicy('refund');
  }
  let frame=0;const refresh=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{mountFooter();decorateCheckout()})};
  const boot=()=>{refresh();new MutationObserver(refresh).observe(document.body,{childList:true,subtree:true})};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
