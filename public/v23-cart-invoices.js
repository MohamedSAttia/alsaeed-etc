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
      '<p class="note info" id="v23TaxInfo"></p><div class="mdl-act"><button class="btn p" id="v23Pay">الانتقال للدفع</button><button class="btn o" data-close>إغلاق</button></div>',()=>{
      const $=s=>document.querySelector(s),currency=$('#v23Currency'),country=$('#v23Country'),tax=$('#v23Tax');
      const billingCountry=()=>country.value==='OTHER'?$('#v23OtherCountry').value.trim().toUpperCase():country.value;
      function update(){const due=packages.reduce((sum,p)=>sum+convert(p.price,p.currency,currency.value),0);
        $('#v23Due').textContent=money(due,currency.value);
        $('#v23OtherWrap').hidden=country.value!=='OTHER';
        const eligible=approvedCountries.includes(billingCountry());
        tax.querySelector('[value="exempt"]').disabled=!eligible;tax.value=eligible?'exempt':'standard';
        $('#v23TaxInfo').textContent=eligible?'الفاتورة دون ضريبة متاحة بعد اعتماد الإدارة للأهلية والبلد.':'سعر الباقة يشمل المعاملة الضريبية المقررة. إذا كنت مؤهلاً لمعاملة صفرية فتواصل مع الإدارة لتوثيقها.'}
      currency.onchange=update;country.onchange=update;$('#v23OtherCountry').oninput=update;update();
      APP.api('/my-tax-options').then(result=>{approvedCountries=result.taxExemptCountries||[];update()}).catch(()=>{});
      document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{cart=cart.filter(x=>x!==b.dataset.remove);save();checkout()});
      $('#v23Pay').onclick=async function(){if(!/^[A-Z]{2}$/.test(billingCountry())){APP.toast('أدخل رمز بلد الفوترة من حرفين');return}this.disabled=true;this.textContent='جارٍ تجهيز الدفع…';
        try{const result=await APP.api('/pay/cart/create',{method:'POST',body:{packageIds:cart,currency:currency.value,
          billingName:$('#v23Name').value.trim(),billingAddress:$('#v23Address').value.trim(),buyerTaxId:$('#v23BuyerTax').value.trim(),
          billingCountry:billingCountry(),invoiceLanguage:$('#v23Language').value,taxMode:tax.value,promoCode:$('#v23Promo').value.trim()}});
          location.href=result.paymentUrl;
        }catch(e){
          if(cart.length===1&&/Kashier/.test(e.message||'')){
            try{const fallback=await APP.api('/pay/create',{method:'POST',body:{packageId:cart[0],promoCode:$('#v23Promo').value.trim()}});
              location.href=fallback.paymentUrl;return}catch(failure){e=failure}
          }
          APP.toast(e.message);this.disabled=false;this.textContent='الانتقال للدفع'
        }};
    });
  }
  function invoiceHTML(rows,lang,summary){
    const t=languages[lang]||languages.ar,first=rows[0],sum=k=>rows.reduce((v,r)=>v+Number(r[k]||0),0);
    return '<article class="v23-paper" lang="'+esc(lang)+'" dir="'+(['ar','ur'].includes(lang)?'rtl':'ltr')+'"><h1>'+t[summary?1:0]+'</h1><p class="v23-ref">'+esc(summary?first.purchase_id:first.invoice_no)+'</p>'+
      '<p>'+t[3]+': '+esc(first.seller_name||'—')+'<br>Seller tax ID: '+esc(first.seller_tax_id||'—')+'<br>'+t[4]+': '+esc(first.buyer_name||'—')+'<br>'+t[9]+': '+esc(first.buyer_country||'—')+'<br>'+t[10]+': '+new Date(first.issued_at||first.created).toLocaleDateString(lang)+'</p>'+
      '<table><tr><th>'+t[5]+'</th><th>'+t[2]+'</th><th>'+t[8]+'</th></tr>'+rows.map(r=>'<tr><td>'+esc(r.item_name||r.package_id||'—')+'</td><td>'+esc(r.invoice_no)+'</td><td>'+money(r.total,r.currency)+'</td></tr>').join('')+'</table>'+
      '<table><tr><th>'+t[6]+'</th><td>'+money(sum('subtotal'),first.currency)+'</td></tr><tr><th>'+t[7]+(summary?'':' ('+Number(first.tax_rate||0)+'%)')+'</th><td>'+money(sum('tax_amount'),first.currency)+'</td></tr><tr><th>'+t[8]+'</th><td><b>'+money(sum('total'),first.currency)+'</b></td></tr></table>'+
      (!summary&&first.reference_qr?'<figure><img src="'+first.reference_qr+'" width="140" alt="Reference QR"><figcaption>Platform reference QR / رمز مرجعي داخلي</figcaption></figure>':'')+
      '<p class="v23-note">'+(!summary&&first.tax_reason?'Tax treatment: '+esc(first.tax_reason)+'<br>':'')+(summary?'بيان إجمالي مرجعي؛ لكل باقة فاتورتها ورقمها، ولا يشكّل فاتورة ضريبية إضافية.':'مستند المنصة. رمز QR مرجعي، ولا يمثل اعتمادًا من جهة ضريبية. إصدار الفاتورة الحكومية يتطلب تكاملًا منفصلًا.')+'</p></article>';
  }
  function present(rows,lang,summary){
    const name=summary?'Summary-'+rows[0].purchase_id:rows[0].invoice_no;
    const style='<style>body{font:16px Arial,sans-serif;color:#162b43;max-width:900px;margin:32px auto}article{padding:30px;border:1px solid #ddd}h1{color:#193963}table{width:100%;border-collapse:collapse;margin:22px 0}td,th{border-bottom:1px solid #ddd;padding:12px;text-align:start}figure{text-align:center}figcaption,.v23-note{font-size:12px;color:#666}@media print{body{margin:0}article{border:0}}</style>';
    const content=invoiceHTML(rows,lang,summary),blob=new Blob(['<!doctype html><html><meta charset="utf-8"><title>'+esc(name)+'</title>'+style+content+'</html>'],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob);
    APP.modal(content+'<div class="mdl-act"><a class="btn p" href="'+url+'" download="'+esc(name)+'.html">تحميل</a><button class="btn o" id="v23Print">طباعة / حفظ PDF</button><button class="btn o" data-close>إغلاق</button></div>',()=>{
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
