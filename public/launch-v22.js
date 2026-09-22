/* Al-Saeed V22 — checkout confidence and launch policies. */
(() => {
  'use strict';
  const policies={
    terms:['الشروط والأحكام','يُتاح المحتوى للحساب المسجّل وللمدة الموضحة في الباقة. لا يجوز مشاركة الحساب أو نسخ المواد أو إعادة بيعها. تختلف الشهادة ومتطلبات إصدارها حسب الباقة، ويجب اجتياز المتطلبات الموضحة داخل لوحة المتدرب.'],
    privacy:['سياسة الخصوصية','نستخدم بيانات الحساب لتنفيذ الاشتراك، متابعة التقدم، إصدار الشهادات، تقديم الدعم ومعالجة المدفوعات. لا تُخزّن المنصة بيانات البطاقة؛ تتم معالجتها لدى مزود الدفع المعتمد. يمكنك طلب تصحيح بياناتك أو الاستفسار عنها عبر قنوات التواصل الرسمية.'],
    refund:['سياسة الاسترداد','يمكن طلب مراجعة الاسترداد خلال 7 أيام من الشراء ما لم يُستهلك جزء جوهري من المحتوى أو يبدأ اختبار محاكاة أو تُصدر شهادة. تخضع رسوم مزود الدفع ومدة إعادة المبلغ لسياساته. تُراجع الحالات الاستثنائية عبر الدعم مع رقم الطلب.']
  };
  function showPolicy(key){
    const item=policies[key];if(!item||!window.APP)return;
    APP.modal('<div class="v22-policy"><span class="eyebrow">AL-SAEED</span><h2>'+item[0]+'</h2><p>'+item[1]+'</p><div class="v22-policy-note">آخر تحديث: سبتمبر 2026 · للاستفسار: info@al-ltc.com</div></div>');
  }
  function mountFooter(){
    const footer=document.querySelector('.ftr');if(!footer||footer.querySelector('.v22-legal'))return;
    footer.insertAdjacentHTML('beforeend','<nav class="v22-legal" aria-label="السياسات"><button data-policy="terms">الشروط والأحكام</button><button data-policy="privacy">الخصوصية</button><button data-policy="refund">الاسترداد</button></nav>');
    footer.querySelectorAll('[data-policy]').forEach(b=>b.onclick=()=>showPolicy(b.dataset.policy));
  }
  function decorateCheckout(){
    const promo=document.getElementById('checkoutPromo');if(!promo)return;
    const box=promo.closest('.modal,.modal-box,.dialog')||promo.parentElement?.parentElement;if(!box||box.querySelector('.v22-checkout-trust'))return;
    box.insertAdjacentHTML('beforeend','<div class="v22-checkout-trust"><span>🔒 دفع آمن وتحقق من الخادم</span><span>⚡ تفعيل تلقائي بعد نجاح الدفع</span><span>↩ مراجعة استرداد خلال 7 أيام</span></div>');
  }
  let frame=0;const refresh=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{mountFooter();decorateCheckout()})};
  const boot=()=>{refresh();new MutationObserver(refresh).observe(document.body,{childList:true,subtree:true})};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
