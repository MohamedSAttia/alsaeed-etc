/* Organization requests: review and status management in the existing admin overview. */
(() => {
  const priorView=window.vOverview,priorBind=window.bindOverview;
  if(typeof priorView!=='function'||typeof priorBind!=='function')return;
  const labels={new:'جديد',reviewing:'قيد المراجعة',proposal_sent:'أُرسل العرض',approved:'مقبول',authorization_requested:'طلب تفويض',closed:'مغلق'};
  window.vOverview=function(){return priorView()+'<section class="card" style="margin-top:20px;padding:20px"><h3>طلبات عروض الشركات والمؤسسات</h3><p class="muted">طلبات محفوظة بمرجع مستقل؛ راجع المتطلبات وأرسل العرض النهائي بعد اعتماد السعر.</p><div id="corporateRequests">جارٍ التحميل…</div></section>'};
  window.bindOverview=function(){priorBind();
    const host=document.getElementById('corporateRequests');if(!host)return;
    request('/api/admin/corporate-requests').then(rows=>{
      if(!host.isConnected)return;
      host.innerHTML='<p><b>'+rows.length+'</b> طلبًا في آخر 300 طلب محفوظ</p>'+
        (rows.length?'<div class="tbl"><table><thead><tr><th>المرجع</th><th>المؤسسة والتواصل</th><th>الطلب</th><th>الحالة</th></tr></thead><tbody>'+rows.map(r=>
          '<tr><td class="num">'+esc(r.id)+'</td><td><b>'+esc(r.organization)+'</b><br>'+esc(r.contact_name)+'<br><a href="mailto:'+encodeURIComponent(r.email)+'">'+esc(r.email)+'</a></td><td>'+esc(r.topic)+' · '+esc(r.participants)+' مشارك<br>'+esc(r.delivery)+' · '+esc(r.country||'')+'<details><summary>تفاصيل الطلب</summary>'+esc(r.details||'لا توجد تفاصيل إضافية')+'</details></td><td><select data-corporate="'+esc(r.id)+'">'+Object.entries(labels).map(([key,label])=>'<option value="'+key+'" '+(key===r.status?'selected':'')+'>'+label+'</option>').join('')+'</select></td></tr>').join('')+'</tbody></table></div>':'<p class="muted">لا توجد طلبات حتى الآن.</p>');
      host.querySelectorAll('[data-corporate]').forEach(select=>select.onchange=async()=>{
        select.disabled=true;try{await request('/api/admin/corporate-requests/'+encodeURIComponent(select.dataset.corporate),{method:'PATCH',body:{status:select.value}});toast('حُدثت حالة الطلب')}
        catch(e){toast(e.message)}finally{select.disabled=false}
      });
    }).catch(e=>{if(host.isConnected)host.textContent='تعذر تحميل الطلبات: '+e.message});
  };
})();
