/* Al-Saeed Admin V22 — operational readiness at a glance. */
(() => {
  'use strict';
  const previousOverview = window.vOverview;
  const previousBindOverview = window.bindOverview;
  const previousSettings = window.vSettings;
  const previousBindSettings = window.bindSettings;
  if (typeof previousOverview !== 'function' || typeof previousBindOverview !== 'function') return;
  const statusCard = (label, value, note, tone) => '<article class="v22-health-card '+tone+'"><span>'+esc(label)+'</span><b>'+esc(String(value))+'</b><small>'+esc(note)+'</small></article>';
  window.vOverview = function () {
    return previousOverview() + '<section class="card v22-readiness" id="platformReadiness"><div class="v22-readiness-head"><div><span class="eyebrow">تشغيل المنصة</span><h3>مركز الجاهزية</h3><p class="muted">فحص مباشر للدفع والمحتوى والبيانات قبل استقبال المتدربين.</p></div><button class="btn" id="refreshReadiness">تحديث الفحص</button></div><div class="v22-health-grid"><div class="v22-health-loading">جارٍ فحص المنصة…</div></div></section>';
  };
  async function loadHealth() {
    const host = document.querySelector('#platformReadiness .v22-health-grid');
    if (!host) return;
    host.innerHTML='<div class="v22-health-loading">جارٍ فحص المنصة…</div>';
    try {
      const h=await request('/api/admin/platform-health'),q=h.questions||{},l=h.lessons||{},o=h.orders||{};
      host.innerHTML=[
        statusCard('بوابة الدفع',String(h.gateway||'—').toUpperCase(),h.gatewayReady?'المفاتيح الأساسية موجودة':'تحتاج استكمال المفاتيح',h.gatewayReady?'good':'bad'),
        statusCard('الأسئلة النشطة',q.active||0,'من '+(q.total||0)+' سؤال','good'),
        statusCard('عربي غير مكتمل',q.arabicMissing||0,'أسئلة تحتاج ترجمة',q.arabicMissing?'warn':'good'),
        statusCard('تكرارات محتملة',q.possibleDuplicates||0,'لن تُحذف تلقائيًا',q.possibleDuplicates?'warn':'good'),
        statusCard('الفيديوهات',l.total||0,(l.missingVideo||0)+' بدون رابط',l.missingVideo?'warn':'good'),
        statusCard('مدة الفيديو',l.missingDuration||0,'دروس تحتاج قراءة المدة',l.missingDuration?'warn':'good'),
        statusCard('طلبات معلّقة',o.pending||0,'تحتاج متابعة الدفع',o.pending?'warn':'good'),
        statusCard('طلبات مدفوعة',o.paid||0,'تم تفعيلها','good')
      ].join('');
    } catch (error) {
      host.innerHTML='<div class="v22-health-error">تعذر إكمال الفحص: '+esc(error.message||'خطأ غير معروف')+'</div>';
    }
  }
  window.bindOverview = function () {
    previousBindOverview();
    const refresh=document.getElementById('refreshReadiness');
    if(refresh)refresh.onclick=loadHealth;
    loadHealth();
  };
  if(typeof previousSettings==='function'&&typeof previousBindSettings==='function'){
    window.vSettings=function(){
      return previousSettings()+'<section class="card v22-gateway"><h3>اختيار بوابة الدفع</h3><p class="muted">تشغيل Kashier الحقيقي يتطلب تفعيل حساب التاجر ومفاتيح الإنتاج وKASHIER_MODE=live. أضف KASHIER_SECRET_KEY لإنشاء جلسات الدفع الرسمية من API. سجّل webhook حيًا لأحداث pay على الرابط أدناه؛ وجود المفاتيح وحده لا يؤكد نجاح دفعة فعلية.</p><p class="en" style="overflow-wrap:anywhere;padding:14px;border-radius:10px;background:#f1f6fc">'+esc(location.origin+'/api/pay/kashier/webhook')+'</p><div id="gatewayChoices" class="v22-gateway-grid"><div class="v22-health-loading">جارٍ قراءة إعدادات الدفع…</div></div><button class="btn p" id="saveGateway" disabled>حفظ بوابة الدفع</button></section>';
    };
    window.bindSettings=function(){
      previousBindSettings();
      request('/api/admin/settings').then(s=>{
        const current=s.gateway||'kashier',configured=s.gateways||{},names={kashier:'Kashier',paymob:'Paymob',moyasar:'Moyasar',tap:'Tap'};
        const host=document.getElementById('gatewayChoices');if(!host)return;
        host.innerHTML=Object.keys(names).map(key=>'<label class="v22-gateway-choice '+(configured[key]?'ready':'missing')+'"><input type="radio" name="gateway" value="'+key+'" '+(current===key?'checked':'')+' '+(configured[key]?'':'disabled')+'><span><b>'+names[key]+'</b><small>'+(configured[key]?'جاهزة للاختيار':'المفاتيح غير مكتملة')+'</small></span></label>').join('');
        const save=document.getElementById('saveGateway');save.disabled=false;save.onclick=async()=>{const selected=document.querySelector('input[name="gateway"]:checked');if(!selected)return alert('اختر بوابة جاهزة');save.disabled=true;try{await request('/api/admin/settings',{method:'PUT',body:{gateway:selected.value}});toast('تم تفعيل '+names[selected.value])}catch(e){alert(e.message)}finally{save.disabled=false}};
      }).catch(e=>{const host=document.getElementById('gatewayChoices');if(host)host.innerHTML='<div class="v22-health-error">'+esc(e.message)+'</div>'});
    };
  }
})();
