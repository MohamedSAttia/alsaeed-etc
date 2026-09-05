(function(){
'use strict';
var BLOGS=[],PAY={vatRate:0,baseCurrency:'USD',currencies:['USD'],rates:{USD:1}};

function esc(v){return window.APP&&APP.esc?APP.esc(v):String(v||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function amount(value,from,to){var a=Number(PAY.rates[from]),b=Number(PAY.rates[to]);return a>0&&b>0?Math.round(Number(value)/a*b*100)/100:Number(value)}
function money(v,c){return Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+c}

function blogView(){
  var slug=(APP.route||'blog').split('/')[1];
  if(slug){
    var p=BLOGS.find(function(x){return x.slug===slug});
    if(!p)return '<section class="pg-hero"><div class="wrap"><h1>المقال غير موجود</h1><a class="btn o" href="#blog" data-r="blog">العودة للمدونة</a></div></section>';
    var lang=window.__lang||'ar', title=lang==='en'&&p.title_en?p.title_en:p.title_ar, body=lang==='en'&&p.body_en?p.body_en:p.body_ar;
    return '<article class="v16-article"><div class="wrap"><a class="v16-back" href="#blog" data-r="blog">العودة إلى المدونة</a><div class="v16-article-head">'+(p.image?'<img src="'+esc(p.image)+'" alt="'+esc(title)+'">':'')+'<span>'+esc(p.category||'مقال مهني')+'</span><h1>'+esc(title)+'</h1><p>'+esc(p.author||'د. محمد عطية')+' · '+new Date(p.created).toLocaleDateString('ar-SA')+'</p></div><div class="v16-article-body">'+String(body||'').split(/\n{2,}/).map(function(x){return '<p>'+esc(x).replace(/\n/g,'<br>')+'</p>'}).join('')+'</div></div></article>';
  }
  return '<section class="pg-hero v16-blog-hero"><div class="wrap"><div class="crumb"><a href="#home" data-r="home">الرئيسية</a> ← المدونة</div><h1>المدونة المهنية</h1><p>مقالات تطبيقية من خبرة التدريب والاستشارات وإدارة المشاريع.</p></div></section><section class="sec"><div class="wrap">'+(BLOGS.length?'<div class="v16-blog-grid">'+BLOGS.map(function(p){return '<article class="v16-blog-card">'+(p.image?'<img src="'+esc(p.image)+'" alt="'+esc(p.title_ar)+'">':'<div class="v16-blog-mark">AL</div>')+'<div><span>'+esc(p.category||'مقال')+'</span><h3>'+esc((window.__lang==='en'&&p.title_en)||p.title_ar)+'</h3><p>'+esc((window.__lang==='en'&&p.excerpt_en)||p.excerpt_ar||'')+'</p><a href="#blog/'+encodeURIComponent(p.slug)+'">اقرأ المقال</a></div></article>'}).join('')+'</div>':'<div class="note info">سيتم نشر المقالات قريباً.</div>')+'</div></section>';
}

function installBlog(){
  if(!window.VIEWS)return;
  VIEWS.blog=blogView;
  var original=VIEWS.bind;
  VIEWS.bind=function(){
    if(original)original();
    mountDemo();
    mountInvoiceButton();
  };
}

function mountDemo(){
  var old=document.getElementById('v16Demo');if(old)old.remove();
  if(APP.me())return;
  var b=document.createElement('button');b.id='v16Demo';b.className='v16-demo';b.innerHTML='<b>عرض تجريبي</b><span>ادخل كباحث وشاهد باقة PMP</span>';
  b.onclick=async function(){b.disabled=true;b.querySelector('span').textContent='جارٍ تجهيز الباقة...';try{var r=await fetch('/api/demo/login',{method:'POST'}),d=await r.json();if(!r.ok)throw new Error(d.error||'تعذر الدخول');localStorage.setItem('alsaeed_token',d.token);location.hash='learn/'+d.packageId;location.reload()}catch(e){APP.toast(e.message);b.disabled=false}};
  document.body.appendChild(b);
}

function mountInvoiceButton(){
  var old=document.getElementById('v16Invoices');if(old)old.remove();
  if(!APP.me()||APP.route.split('/')[0]!=='dash')return;
  var b=document.createElement('button');b.id='v16Invoices';b.className='v16-invoices';b.textContent='فواتيري';
  b.onclick=showMyInvoices;document.body.appendChild(b);
}

async function showMyInvoices(){
  try{
    var list=await APP.api('/my-invoices');
    APP.modal('<h3>فواتيري</h3>'+(list.length?'<div class="tbl-w"><table class="t"><thead><tr><th>الرقم</th><th>الإجمالي</th><th>الحالة</th><th></th></tr></thead><tbody>'+list.map(function(i){return '<tr><td class="num">'+esc(i.invoice_no)+'</td><td class="num">'+money(i.total,i.currency)+'</td><td>'+esc(i.status)+'</td><td><button class="btn o" data-my-inv="'+i.id+'">عرض</button></td></tr>'}).join('')+'</tbody></table></div>':'<div class="note info">لا توجد فواتير حتى الآن.</div>')+'<div class="mdl-act"><button class="btn o" data-close>إغلاق</button></div>',function(){document.querySelectorAll('[data-my-inv]').forEach(function(b){b.onclick=function(){showInvoice(b.dataset.myInv)}})})
  }catch(e){APP.toast(e.message)}
}
async function showInvoice(id){
  try{var i=await APP.api('/invoices/'+encodeURIComponent(id));APP.modal('<div class="v16-invoice"><h2>فاتورة ضريبية</h2><div class="num">'+esc(i.invoice_no)+'</div><hr><p><b>البائع:</b> '+esc(i.seller_name||'—')+'<br><b>الرقم الضريبي:</b> '+esc(i.seller_tax_id||'—')+'<br><b>العميل:</b> '+esc(i.buyer_name||'—')+'</p><table><tr><th>قبل الضريبة</th><td>'+money(i.subtotal,i.currency)+'</td></tr><tr><th>الضريبة '+Number(i.tax_rate||0)+'%</th><td>'+money(i.tax_amount,i.currency)+'</td></tr><tr><th>الإجمالي</th><td><b>'+money(i.total,i.currency)+'</b></td></tr></table><div class="mdl-act"><button class="btn p" onclick="window.print()">طباعة / PDF</button><button class="btn o" data-close>إغلاق</button></div></div>')}catch(e){APP.toast(e.message)}
}

function checkout(pid){
  var p=APP.pack(pid);if(!p)return;
  if(!APP.me()){APP.openAuth('login');APP.toast('سجّل الدخول أولاً ثم اختر الباقة');return}
  if(APP.owns(pid)){APP.go('learn/'+pid);return}
  var options=PAY.currencies.map(function(c){return '<option value="'+esc(c)+'" '+(c===p.currency?'selected':'')+'>'+esc(c)+'</option>'}).join('');
  APP.modal('<h3>إتمام الاشتراك والفاتورة</h3><p>'+esc(p.ar)+'</p><div class="v16-checkout-total"><span>المبلغ شامل الضريبة</span><b id="v16Due">'+money(p.price,p.currency)+'</b></div><div class="grid g2"><label class="f"><span>عملة الدفع والفاتورة</span><select id="v16Currency">'+options+'</select></label><label class="f"><span>الاسم على الفاتورة</span><input id="v16BillingName" value="'+esc(APP.me().name||'')+'"></label></div><label class="f"><span>العنوان <small>اختياري</small></span><input id="v16BillingAddress"></label><label class="f"><span>الرقم الضريبي للعميل <small>اختياري</small></span><input id="v16BuyerTax" class="en"></label><label class="f"><span>كود الخصم <small>اختياري</small></span><input id="v16Promo" class="en"></label><div class="note info">نسبة الضريبة الحالية '+Number(PAY.vatRate||0)+'%. سيتم إصدار الفاتورة بعد تأكيد الدفع.</div><div class="mdl-act"><button class="btn p" id="v16Pay">الانتقال للدفع</button><button class="btn o" data-close>إلغاء</button></div>',function(){
    var cur=document.getElementById('v16Currency'),due=document.getElementById('v16Due');
    cur.onchange=function(){due.textContent=money(amount(p.price,p.currency,cur.value),cur.value)};
    document.getElementById('v16Pay').onclick=async function(){var b=this;b.disabled=true;b.textContent='جارٍ التحويل...';try{var d=await APP.api('/pay/create',{method:'POST',body:{packageId:pid,promoCode:document.getElementById('v16Promo').value.trim(),currency:cur.value,billingName:document.getElementById('v16BillingName').value.trim(),billingAddress:document.getElementById('v16BillingAddress').value.trim(),buyerTaxId:document.getElementById('v16BuyerTax').value.trim()}});location.href=d.paymentUrl}catch(e){APP.toast(e.message);b.disabled=false;b.textContent='الانتقال للدفع'}}
  })
}

document.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('[data-buy]');
  if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();checkout(b.dataset.buy);
},true);

var originalBoot=APP.boot;
APP.boot=async function(){
  try{var x=await Promise.all([fetch('/api/blogs').then(function(r){return r.ok?r.json():[]}),fetch('/api/payment-config').then(function(r){return r.ok?r.json():PAY})]);BLOGS=x[0]||[];PAY=Object.assign(PAY,x[1]||{})}catch(e){}
  installBlog();
  await originalBoot();
  document.body.classList.add('v16-ui');
};
})();