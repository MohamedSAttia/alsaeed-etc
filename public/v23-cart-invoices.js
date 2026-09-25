(function () {
  'use strict';
  const languages = {
    ar:['فاتورة الباقة','بيان إجمالي للمشتريات','الرقم','البائع','العميل','الباقة','قبل الضريبة','الضريبة','الإجمالي','بلد الفوترة','تاريخ الإصدار'],
    en:['Package invoice','Consolidated purchase statement','Number','Seller','Buyer','Package','Subtotal','Tax','Total','Billing country','Issue date'],
    fr:['Facture du forfait','Relevé récapitulatif','Numéro','Vendeur','Client','Forfait','Sous-total','Taxe','Total','Pays','Date'],
    tr:['Paket faturası','Satın alma özeti','Numara','Satıcı','Alıcı','Paket','Ara toplam','Vergi','Toplam','Ülke','Tarih'],
    ur:['پیکیج انوائس','خریداری کا بیان','نمبر','فروخت کنندہ','خریدار','پیکیج','ذیلی کل','ٹیکس','کل','ملک','تاریخ']
  };
  const countries={EG:'مصر / Egypt',SA:'السعودية / Saudi Arabia',AE:'الإمارات / UAE',KW:'الكويت / Kuwait',QA:'قطر / Qatar',BH:'البحرين / Bahrain',OM:'عُمان / Oman',JO:'الأردن / Jordan',US:'أمريكا / USA',GB:'بريطانيا / UK',FR:'فرنسا / France',DE:'ألمانيا / Germany'};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=(n,c)=>Number(n||0).toFixed(2)+' '+esc(c);
  let cart=[];try{cart=JSON.parse(sessionStorage.getItem('alsaeed_cart')||'[]');if(!Array.isArray(cart))cart=[]}catch{}
  if(location.hash.includes('paid=1')){cart=[];sessionStorage.removeItem('alsaeed_cart')}
  let payment={currencies:['USD'],rates:{USD:1},vatRate:0,taxExemptCountries:[]};
  let approvedCountries=[];
  fetch('/api/payment-config').then(r=>r.ok?r.json():null).then(x=>{if(x)payment=x}).catch(()=>{});

  function save(){sessionStorage.setItem('alsaeed_cart',JSON.stringify(cart));mount()}
  function mount(){
    document.getElementById('v23Cart')?.remove();
    if(!cart.length)return;
    const button=document.createElement('button');button.id='v23Cart';button.className='v16-invoices';
    button.style.cssText='left:auto;right:22px;bottom:22px;z-index:901';
    button.textContent='🛒 السلة ('+cart.length+')';button.onclick=()=>checkout();document.body.appendChild(button);
  }
  const observer=new MutationObserver(()=>{if(cart.length&&!document.getElementById('v23Cart'))mount()});
  observer.observe(document.body,{childList:true});mount();
  function convert(value,from,to){const a=Number(payment.rates?.[from]),b=Number(payment.rates?.[to]);
    return a>0&&b>0?Math.round(Number(value)/a*b*100)/100:Number(value)}
  function checkout(id){
    if(id&&APP.me()&&APP.owns(id)){APP.go('learn/'+id);return}
    if(id&&!cart.includes(id))cart.push(id);
    if(!APP.me()){save();APP.openAuth('login');APP.toast('سجّل الدخول ثم افتح السلة لإتمام الدفع');return}
    cart=cart.filter(x=>APP.pack(x)&&!APP.owns(x));save();
    const packages=cart.map(x=>APP.pack(x));if(!packages.length){APP.closeModal();APP.toast('السلة فارغة');return}
    APP.modal('<h3>سلة الباقات والفواتير</h3><div class="v23-lines">'+packages.map(p=>
      '<div><span>'+esc(p.ar||p.en||p.id)+'</span><b>'+money(p.price,p.currency)+'</b><button type="button" data-remove="'+esc(p.id)+'" aria-label="إزالة">×</button></div>').join('')+'</div>'+ 
      '<div class="v16-checkout-total">إجمالي الدفع <b id="v23Due"></b></div><div class="grid g2">'+
      '<label class="f">عملة الدفع والفواتير<select id="v23Currency">'+payment.currencies.map(c=>'<option value="'+esc(c)+'" '+(c===packages[0].currency?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select></label>'+
      '<label class="f">اسم العميل<input id="v23Name" value="'+esc(APP.me().name||'')+'"></label>'+
      '<label class="f">بلد الفوترة<select id="v23Country">'+Object.entries(countries).map(([code,name])=>'<option value="'+code+'">'+name+'</option>').join('')+'<option value="OTHER">دولة أخرى / Other country</option></select></label>'+
      '<label class="f">لغة الفاتورة<select id="v23Language">'+Object.keys(languages).map(l=>'<option value="'+l+'" '+(l===window.__lang?'selected':'')+'>'+l.toUpperCase()+'</option>').join('')+'</select></label></div>'+
      '<label class="f" id="v23OtherWrap" hidden>رمز الدولة ISO من حرفين<input id="v23OtherCountry" maxlength="2" placeholder="CA"></label>'+
      '<label class="f">العنوان<input id="v23Address"></label><label class="f">الرقم الضريبي للعميل (إن وجد)<input id="v23BuyerTax"></label>'+
      '<label class="f">كود الخصم<input id="v23Promo"></label><label class="f">المعاملة الضريبية<select id="v23Tax"><option value="standard">الضريبة المقررة</option><option value="exempt">بدون ضريبة وفق قاعدة يضبطها البائع</option></select></label>'+
      '<p class="note info" id="v23TaxInfo"></p><p class="note info" id="v23GatewayInfo" role="status">جارٍ التحقق من بوابة الدفع…</p><div class="mdl-act"><button class="btn p" id="v23Pay" disabled>الانتقال للدفع</button><button class="btn o" data-close>إغلاق</button></div>',()=>{
      const $=s=>document.querySelector(s),currency=$('#v23Currency'),country=$('#v23Country'),tax=$('#v23Tax');
      let gatewayReady=false;
      const billingCountry=()=>country.value==='OTHER'?$('#v23OtherCountry').value.trim().toUpperCase():country.value;
      function update(){const code=billingCountry(),rates=payment.countryTaxRates||{},configured=code==='EG'||Object.prototype.hasOwnProperty.call(rates,code);
        const rate=code==='EG'?Number(payment.vatRate||0):Number(rates[code]||0);
        $('#v23OtherWrap').hidden=country.value!=='OTHER';
        const eligible=approvedCountries.includes(code);
        tax.querySelector('[value="exempt"]').disabled=!eligible;
        if(!eligible)tax.value='standard';
        const due=packages.reduce((sum,p)=>sum+Math.round((convert(p.price,p.currency,currency.value)/(tax.value==='exempt'&&configured?1+rate/100:1))*100)/100,0);
        $('#v23Due').textContent=money(due,currency.value);
        $('#v23TaxInfo').textContent=!configured?'لم تُهيأ المعاملة الضريبية لهذا البلد بعد؛ اطلب من الإدارة اعتمادها قبل الدفع.':
          'النسبة المهيأة لهذا البلد: '+rate+'%'+(eligible?' · يمكنك اختيار المعاملة الصفرية المعتمدة.':' · السعر المعروض شامل الضريبة المهيأة.');
        $('#v23Pay').disabled=!gatewayReady||!configured;
      }
      currency.onchange=update;country.onchange=update;tax.onchange=update;$('#v23OtherCountry').oninput=update;update();
      APP.api('/my-tax-options').then(result=>{approvedCountries=result.taxExemptCountries||[];update()}).catch(()=>{});
      fetch('/api/pay/readiness').then(r=>r.json()).then(state=>{
        const button=$('#v23Pay'),note=$('#v23GatewayInfo');if(!button||!note)return;
        const ready=state.gateway==='kashier'&&state.configured&&state.mode==='live';
        gatewayReady=ready;update();
        note.textContent=ready?'الدفع المباشر متاح عبر Kashier. تُصدر الفواتير بعد تأكيد العملية.':
          state.mode==='test'?'البوابة في الوضع التجريبي؛ الشراء الحقيقي غير متاح حاليًا.':
          'الدفع المباشر لعدة باقات غير مفعّل حاليًا. تواصل مع الإدارة قبل الشراء.';
      }).catch(()=>{const note=$('#v23GatewayInfo');if(note)note.textContent='تعذر التحقق من حالة بوابة الدفع. حاول لاحقًا.'});
      document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{cart=cart.filter(x=>x!==b.dataset.remove);save();checkout()});
      $('#v23Pay').onclick=async function(){if(!/^[A-Z]{2}$/.test(billingCountry())){APP.toast('أدخل رمز بلد الفوترة من حرفين');return}this.disabled=true;this.textContent='جارٍ تجهيز الدفع…';
        try{const result=await APP.api('/pay/cart/create',{method:'POST',body:{packageIds:cart,currency:currency.value,
          billingName:$('#v23Name').value.trim(),billingAddress:$('#v23Address').value.trim(),buyerTaxId:$('#v23BuyerTax').value.trim(),
          billingCountry:billingCountry(),invoiceLanguage:$('#v23Language').value,taxMode:tax.value,promoCode:$('#v23Promo').value.trim()}});
          location.href=result.paymentUrl;
        }catch(e){
          APP.toast(e.message);this.disabled=!gatewayReady;this.textContent='الانتقال للدفع'
        }};
    });
  }
  function invoiceHTML(rows,lang,summary,logoMarkup){
    const first=rows[0], rtl=['ar','ur'].includes(lang), locale=languages[lang]?lang:'ar';
    const labels={
      ar:{seller:'الجهة المصدرة',buyer:'المشتري',taxCard:'رقم البطاقة الضريبية',vatId:'رقم تسجيل القيمة المضافة',address:'العنوان',buyerId:'الرقم الضريبي للمشتري',reference:'رقم المرجع',taxMode:'المعاملة الضريبية',qr:'رمز تحقق مرجعي داخل المنصة',statement:'هذا بيان مشتريات، وليس فاتورة ضريبية إضافية. راجع الفواتير المنفصلة لكل باقة.'},
      en:{seller:'Issued by',buyer:'Bill to',taxCard:'Egyptian tax card number',vatId:'VAT registration number',address:'Address',buyerId:'Buyer tax ID',reference:'Reference',taxMode:'Tax treatment',qr:'Platform reference QR',statement:'Purchase statement only. Each package has a separate invoice; this is not an additional tax invoice.'}
    };
    const l=locale==='ar'?labels.ar:labels.en,t=languages[locale],sum=k=>rows.reduce((v,r)=>v+Number(r[k]||0),0);
    const date=first.issued_at||first.created;
    const line=(label,value)=>value?'<div><dt>'+label+'</dt><dd>'+esc(value)+'</dd></div>':'';
    const seller=[line(l.seller,first.seller_name),line(l.taxCard,first.seller_tax_card),line(l.vatId,first.seller_tax_id),line(l.address,first.seller_address)].join('');
    const buyer=[line(l.buyer,first.buyer_name),line(l.buyerId,first.buyer_tax_id),line(l.address,first.buyer_address),line(t[9],first.buyer_country)].join('');
    const itemRows=rows.map(r=>'<tr><td>'+esc(r.item_name||r.package_id||'—')+'</td><td>'+esc(r.invoice_no)+'</td><td>'+money(r.subtotal,r.currency)+'</td><td>'+money(r.tax_amount,r.currency)+'</td><td><strong>'+money(r.total,r.currency)+'</strong></td></tr>').join('');
    return '<article class="v23-paper" lang="'+esc(locale)+'" dir="'+(rtl?'rtl':'ltr')+'"><header class="v23-head"><div>'+logoMarkup+'<h1>'+t[summary?1:0]+'</h1><span class="v23-muted">'+l.reference+' · '+esc(summary?first.purchase_id:first.invoice_no)+'</span></div><div class="v23-head-right"><time>'+t[10]+'<strong>'+new Date(date).toLocaleDateString(locale)+'</strong></time>'+(!summary&&first.reference_qr?'<img class="v23-qr" src="'+first.reference_qr+'" alt="'+l.qr+'"><small>'+l.qr+'</small>':'')+'</div></header>'+
      '<section class="v23-parties"><dl>'+seller+'</dl><dl>'+buyer+'</dl></section>'+
      '<div class="v23-scroll"><table><thead><tr><th>'+t[5]+'</th><th>'+t[2]+'</th><th>'+t[6]+'</th><th>'+t[7]+'</th><th>'+t[8]+'</th></tr></thead><tbody>'+itemRows+'</tbody></table></div>'+
      '<div class="v23-totals"><div><span>'+t[6]+'</span><b>'+money(sum('subtotal'),first.currency)+'</b></div><div><span>'+t[7]+(summary?'':' ('+Number(first.tax_rate||0)+'%)')+'</span><b>'+money(sum('tax_amount'),first.currency)+'</b></div><div class="v23-grand"><span>'+t[8]+'</span><b>'+money(sum('total'),first.currency)+'</b></div></div>'+
      (summary?'<p class="v23-note">'+l.statement+'</p>':first.tax_reason?'<p class="v23-note">'+l.taxMode+': '+esc(first.tax_reason)+'</p>':'')+'</article>';
  }
  async function present(rows,lang,summary){
    const name=summary?'Summary-'+rows[0].purchase_id:rows[0].invoice_no;
    const style='<link rel=\"stylesheet\" href=\"/homepage-v23.css\"><style>body{font:16px Arial,sans-serif;color:#172c46;max-width:960px;margin:26px auto;background:#f3f6fa}.v23-paper{background:#fff;padding:32px;border:1px solid #d9e1eb;border-radius:18px}.v23-scroll{overflow-x:auto}.v23-head,.v23-parties{display:flex;justify-content:space-between;gap:24px}.v23-head{border-bottom:4px solid #da762d;padding-bottom:18px}.v23-head-right{display:grid;justify-items:end}.v23-brand{display:flex;align-items:center;gap:12px;direction:ltr;text-align:start}.v23-brand svg,.v23-brand img{width:62px;height:59px;object-fit:contain;flex:none}.v23-brand-text{display:grid;line-height:1.3}.v23-brand-text strong{font-size:23px;color:#183b63}.v23-brand-text small{font-size:12px;color:#506279}.v23-qr{width:110px}.v23-head time strong{display:block}h1{color:#183b63}dl{flex:1;background:#f4f8fc;padding:16px;border-radius:10px}dl div{margin-bottom:8px}dt{font-size:12px;color:#66758a}dd{margin:0;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;margin:20px 0}td,th{border-bottom:1px solid #d9e1eb;padding:10px;text-align:start}.v23-totals{max-width:360px;margin-inline-start:auto}.v23-totals div{display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #d9e1eb}.v23-grand{font-size:20px;color:#183b63}.v23-note,.v23-muted,small{font-size:12px;color:#68778a}@media(max-width:650px){.v23-parties{display:block}.v23-paper{padding:18px}}@media print{body{margin:0;background:white}.v23-paper{border:0;border-radius:0}.v23-scroll{overflow:visible}}</style>';
    const mark=typeof window.LOGO==='function'?window.LOGO(62):'<img src="/img/logo.png" alt="AL SAEED">';
    const brand='<div class="v23-brand" aria-label="AL SAEED">'+mark+'<span class="v23-brand-text"><strong>'+(lang==='ar'?'السعيد':'AL SAEED')+'</strong><small>'+(lang==='ar'?'للتعليم والتدريب والاستشارات':'Education, Training and Consulting Services')+'</small></span></div>';
    const content=invoiceHTML(rows,lang,summary,brand),blob=new Blob(['<!doctype html><html><meta charset="utf-8"><title>'+esc(name)+'</title>'+style+content+'</html>'],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob);
    APP.modal(content+'<div class="mdl-act"><label>لغة العرض / Language <select id="v23InvoiceLang"><option value="ar" '+(lang==='ar'?'selected':'')+'>العربية</option><option value="en" '+(lang==='en'?'selected':'')+'>English</option></select></label><a class="btn p" href="'+url+'" download="'+esc(name)+'-'+esc(lang)+'.html">تحميل</a><button class="btn o" id="v23Print">طباعة / حفظ PDF</button><button class="btn o" data-close>إغلاق</button></div>',()=>{
      document.getElementById('v23InvoiceLang').onchange=e=>present(rows,e.target.value,summary);
      document.getElementById('v23Print').onclick=()=>{const w=window.open(url,'_blank');if(w)w.onload=()=>w.print()};
    });
  }
  async function showInvoices(){
    try{const list=await APP.api('/my-invoices');const groups=[...new Set(list.filter(i=>i.status==='issued'&&i.purchase_id).map(i=>i.purchase_id))];
      APP.modal('<h3>فواتيري</h3>'+(list.length?'<div class="tbl-w"><table class="t"><tr><th>الرقم</th><th>الباقة</th><th>الإجمالي</th><th>الحالة</th><th></th></tr>'+list.map(i=>'<tr><td>'+esc(i.invoice_no)+'</td><td>'+esc(i.item_name||i.package_id||'—')+'</td><td>'+money(i.total,i.currency)+'</td><td>'+esc(i.status)+'</td><td><button class="btn o" data-invoice="'+esc(i.id)+'" '+(i.status==='issued'?'':'disabled')+'>عرض</button></td></tr>').join('')+'</table></div>':'<p>لا توجد فواتير حتى الآن.</p>')+
        groups.map(g=>'<button class="btn o" data-statement="'+esc(g)+'">البيان الإجمالي '+esc(g)+'</button>').join('')+'<div class="mdl-act"><button class="btn o" data-close>إغلاق</button></div>',()=>{
          document.querySelectorAll('[data-invoice]').forEach(b=>b.onclick=async()=>{try{const i=await APP.api('/invoices/'+encodeURIComponent(b.dataset.invoice));present([i],i.invoice_language||'ar',false)}catch(e){APP.toast(e.message)}});
          document.querySelectorAll('[data-statement]').forEach(b=>b.onclick=async()=>{try{const g=await APP.api('/invoice-groups/'+encodeURIComponent(b.dataset.statement));present(g.items,g.items[0].invoice_language||'ar',true)}catch(e){APP.toast(e.message)}});
        });
    }catch(e){APP.toast(e.message)}
  }
  window.V23_CART={checkout,showInvoices};
})();
