/* Organization requests: review and status management in the existing admin overview. */
(() => {
  const priorView=window.vOverview,priorBind=window.bindOverview;
  if(typeof priorView!=='function'||typeof priorBind!=='function')return;
  const labels={new:'جديد',reviewing:'قيد المراجعة',proposal_sent:'أُرسل العرض',approved:'مقبول',authorization_requested:'طلب تفويض',closed:'مغلق'};
  window.vOverview=function(){return priorView()+'<section class="card" style="margin-top:20px;padding:24px"><h3>طلبات عروض الشركات والمؤسسات</h3><p class="muted">طلبات محفوظة بمرجع مستقل؛ راجع المتطلبات وأرسل العرض النهائي بعد اعتماد السعر.</p><div id="corporateReadiness" role="status" style="margin:15px 0"></div><div id="corporateRequests">جارٍ التحميل…</div></section>'};
  window.bindOverview=function(){priorBind();
    const host=document.getElementById('corporateRequests');if(!host)return;
    request('/api/admin/corporate-readiness').then(x=>{const el=document.getElementById('corporateReadiness');if(el)el.innerHTML='<div class="badges"><span class="chip '+(x.emailReady?'ok':'warn')+'">البريد: '+(x.emailReady?'جاهز':'يحتاج إعداد')+'</span><span class="chip '+(x.ownerReady?'ok':'warn')+'">إشعار الإدارة: '+(x.ownerReady?'جاهز':'يحتاج بريد الإدارة')+'</span><span class="chip '+(x.aiReady?'ok':'warn')+'">ملخص AI: '+(x.aiReady?'جاهز':'يحتاج مفتاح API')+'</span></div>'}).catch(()=>{});
    request('/api/admin/corporate-requests').then(rows=>{
      if(!host.isConnected)return;
      const counts=Object.fromEntries(Object.keys(labels).map(k=>[k,rows.filter(r=>r.status===k).length]));
      host.innerHTML='<div class="badges" style="margin-bottom:16px">'+Object.entries(labels).map(([key,label])=>'<span class="chip">'+esc(label)+' · <b>'+counts[key]+'</b></span>').join('')+'</div><p><b>'+rows.length+'</b> طلبًا في آخر 300 طلب محفوظ</p>'+
        (rows.length?'<div class="tbl"><table><thead><tr><th>المرجع</th><th>المؤسسة والتواصل</th><th>الطلب</th><th>الحالة</th><th>المسودة</th></tr></thead><tbody>'+rows.map(r=>
          '<tr><td class="num">'+esc(r.id)+'</td><td><b>'+esc(r.organization)+'</b><br>'+esc(r.contact_name)+'<br><a href="mailto:'+encodeURIComponent(r.email)+'">'+esc(r.email)+'</a></td><td>'+esc(r.topic)+' · '+esc(r.participants)+' مشارك<br>'+esc(r.delivery)+' · '+esc(r.country||'')+'<details><summary>تفاصيل الطلب</summary>'+esc(r.details||'لا توجد تفاصيل إضافية')+'</details>'+(r.ai_summary?'<details><summary>ملخص AI للإدارة</summary>'+esc(r.ai_summary)+'</details>':'')+(r.events?.length?'<details><summary>سجل الردود</summary>'+r.events.map(e=>'<p>'+esc(e.actor+' · '+e.event+' · '+(e.note||''))+'</p>').join('')+'</details>':'')+'</td><td><select data-corporate="'+esc(r.id)+'">'+Object.entries(labels).map(([key,label])=>'<option value="'+key+'" '+(key===r.status?'selected':'')+' '+(key==='proposal_sent'?'disabled':'')+'>'+label+'</option>').join('')+'</select></td><td><button class="btn sm" type="button" data-proposal="'+esc(r.id)+'">تنزيل مسودة</button><button class="btn sm p" type="button" data-offer="'+esc(r.id)+'">إعداد وإرسال العرض</button></td></tr>').join('')+'</tbody></table></div>':'<p class="muted">لا توجد طلبات حتى الآن.</p>');
      host.querySelectorAll('[data-offer]').forEach(button=>button.onclick=()=>{
        const r=rows.find(item=>item.id===button.dataset.offer);if(!r)return;
        let old={};try{old=JSON.parse(r.proposal_json||'{}')||{}}catch{}
        const panel=document.createElement('div');panel.className='card';panel.style.cssText='padding:22px;margin:18px 0;border:2px solid #c77a42';
        panel.innerHTML='<h3>اعتماد وإرسال عرض '+esc(r.id)+'</h3><p class="muted">يُرسل العرض النهائي بالبريد بعد الاعتماد، وسيتمكن العميل من قبوله أو طلب تفويض أو توضيح. راجع السعر والمعاملة الضريبية قبل الإرسال.</p><div class="grid g2">'+
          '<label class="f">النطاق والمخرجات<textarea data-field="scope" maxlength="2500" rows="4">'+esc(old.scope||r.details||r.topic)+'</textarea></label>'+
          '<label class="f">الموعد والمدة<input data-field="schedule" maxlength="400" value="'+esc(old.schedule||'')+'"></label>'+
          '<label class="f">المدرب أو الفريق<input data-field="trainer" maxlength="160" value="'+esc(old.trainer||'')+'"></label>'+
          '<label class="f">السعر قبل الضريبة<input data-field="price" type="number" min="0" step="0.01" value="'+esc(old.price??'')+'"></label>'+
          '<label class="f">العملة<select data-field="currency">'+['USD','EGP','SAR','AED','EUR','GBP'].map(c=>'<option '+(c===(old.currency||'USD')?'selected':'')+'>'+c+'</option>').join('')+'</select></label>'+
          '<label class="f">الضريبة المعتمدة %<input data-field="taxRate" type="number" min="0" max="100" step="0.01" value="'+esc(old.taxRate??'')+'"></label></div>'+
          '<label class="f">سبب المعاملة الضريبية / الملاحظات<textarea data-field="taxNote" maxlength="600" rows="2">'+esc(old.taxNote||'')+'</textarea></label>'+
          '<button class="btn p" data-send-offer>إرسال العرض المعتمد</button> <button class="btn" data-cancel-offer>إلغاء</button><p role="status" data-result-offer></p>';
        host.prepend(panel);panel.querySelector('[data-cancel-offer]').onclick=()=>panel.remove();
        panel.querySelector('[data-send-offer]').onclick=async()=>{
          const get=k=>panel.querySelector('[data-field="'+k+'"]')?.value?.trim()||'';
          const data={scope:get('scope'),schedule:get('schedule'),trainer:get('trainer'),price:Number(get('price')),
            currency:get('currency'),taxRate:Number(get('taxRate')),taxNote:get('taxNote')};
          if(!get('price')||!get('taxRate')||!data.scope||!data.schedule||!data.trainer){panel.querySelector('[data-result-offer]').textContent='أكمل كل الحقول والسعر والضريبة قبل الإرسال';return}
          if(!confirm('تأكيد إرسال العرض النهائي بالبريد إلى '+r.email+'؟'))return;
          const send=panel.querySelector('[data-send-offer]');send.disabled=true;
          try{await request('/api/admin/corporate-requests/'+encodeURIComponent(r.id)+'/proposal',{method:'POST',body:data});toast('أُرسل العرض');panel.remove();window.bindOverview?.()}
          catch(e){panel.querySelector('[data-result-offer]').textContent=e.message}finally{send.disabled=false}
        };
      });
      host.querySelectorAll('[data-proposal]').forEach(button=>button.onclick=()=>{
        const r=rows.find(item=>item.id===button.dataset.proposal);if(!r)return;
        const fields=[['الجهة / Organization',r.organization],['جهة التواصل / Contact',r.contact_name],['البريد / Email',r.email],['البرنامج / Program',r.topic],['المشاركون / Participants',r.participants],['طريقة التنفيذ / Delivery',r.delivery],['البلد / Country',r.country],['الأهداف والتفاصيل / Requirements',r.details]];
        const html='<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>'+esc(r.id)+'</title><style>body{font:16px Arial,sans-serif;line-height:1.8;color:#17334c;max-width:840px;margin:40px auto;padding:0 20px}h1{border-bottom:4px solid #dc7e36}h2{margin-top:32px}table{width:100%;border-collapse:collapse}td{border:1px solid #dce5ee;padding:10px;vertical-align:top}td:first-child{background:#f2f7fa;width:35%}.note{background:#fff6e9;padding:16px;margin:20px 0;border-radius:12px}@media print{body{margin:12mm}}</style><h1>السعيد | AL SAEED</h1><p>مسودة عرض مؤسسي · Corporate proposal draft<br>المرجع / Reference: '+esc(r.id)+'</p><div class="note">مسودة داخلية للمراجعة؛ أضف السعر والعملة والضرائب والمواعيد والمدرب بعد اعتمادها قبل إرسال عرض نهائي للعميل.<br>Internal draft: approve pricing, currency, taxes, schedule and trainer before sending a final offer.</div><h2>نطاق الطلب · Request scope</h2><table>'+fields.map(([name,value])=>'<tr><td>'+name+'</td><td>'+esc(String(value??''))+'</td></tr>').join('')+'</table><h2>مقترح التنفيذ · Proposed delivery</h2><p>المخرجات والأهداف: ______________________________</p><p>الجدول والمدة: ______________________________</p><p>المدرب/الفريق: ______________________________</p><p>الرسوم والعملة والضرائب: ______________________________</p><p>صلاحية العرض وشروط القبول: ______________________________</p></html>';
        const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='Alsaeed-Proposal-Draft-'+r.id+'.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
      });
      host.querySelectorAll('[data-corporate]').forEach(select=>select.onchange=async()=>{
        select.disabled=true;try{await request('/api/admin/corporate-requests/'+encodeURIComponent(select.dataset.corporate),{method:'PATCH',body:{status:select.value}});toast('حُدثت حالة الطلب')}
        catch(e){toast(e.message)}finally{select.disabled=false}
      });
    }).catch(e=>{if(host.isConnected)host.textContent='تعذر تحميل الطلبات: '+e.message});
  };
})();
