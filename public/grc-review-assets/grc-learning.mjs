import {appendReaderNodes} from './reader-nodes.mjs';
let mountSequence=0;
// The host injects its existing authenticated API. Only structured text and allowlisted nodes render.
export function mountGrcLearning(root,{api,packageId,lang:initialLang='ar',brand='alsaeed',module='academy',onBack=()=>{}}){
 if(typeof api!=='function'||!root?.ownerDocument)throw TypeError('A root and authenticated API adapter are required');
 if(!['academy','workbook'].includes(module))throw TypeError('Unsupported learning module');
 const doc=root.ownerDocument,win=doc.defaultView,brandId=['alsaeed','trackford'].includes(brand)?brand:'alsaeed';
 let lang=initialLang==='en'?'en':'ar',disposed=false,busy=false,sequence=0,error='',notice='',index=null,item=null,section=0,draft=null,values=null,dirty=false,pendingLeave=null,search='',kind='all',retry=null;
 const fieldPrefix='gl-'+(++mountSequence)+'-',urls=new Set(),t=(ar,en)=>lang==='en'?en:ar,label=v=>v?.[lang]||v?.ar||v?.en||'';
 const query='?packageId='+encodeURIComponent(packageId),base='/grc-workspace/';
 const copy=v=>JSON.parse(JSON.stringify(v));
 function el(tag,text,className){const node=doc.createElement(tag);if(text!==undefined)node.textContent=String(text);if(className)node.className=className;return node;}
 function button(text,action,{disabled=busy,className='gw-button'}={}){const node=el('button',text,className);node.type='button';node.disabled=disabled;node.onclick=action;return node;}
 function status(text,alert=false){const p=el('p',text,'gw-status');p.setAttribute('role',alert?'alert':'status');return p;}
 async function request(task,apply,{remember=true,focus=null}={}){
  if(disposed||busy)return;const token=++sequence;busy=true;error='';notice='';if(remember)retry=()=>request(task,apply,{remember,focus});render();
  try{const result=await task();if(disposed||token!==sequence)return;apply(result);}
  catch(e){if(!disposed&&token===sequence)error=e?.code||e?.message||'learning_service_unavailable';}
  finally{if(!disposed&&token===sequence){busy=false;render();if(focus){const target=root.querySelector(focus);if(target){target.tabIndex=-1;target.focus();}}}}
 }
 function validatePackage(result){if(result?.packageId!==packageId)throw Error('learning_package_mismatch');return result;}
 function useDraft(result){if(result?.workbook?.packageId!==packageId||!result.schema||!result.values)throw Error('learning_package_mismatch');draft=result;values=copy(result.values);dirty=false;pendingLeave=null;}
 const load=()=>request(()=>api(base+(module==='academy'?'reader':'workbooks')+query),result=>{index=validatePackage(result);});
 const openItem=id=>request(()=>api(base+'reader/'+encodeURIComponent(id)+query),result=>{validatePackage(result);item=result.item;section=0;},{focus:'.gl-reader h2'});
 const openDraft=id=>request(()=>api(base+'workbooks/'+encodeURIComponent(id)+query),useDraft,{focus:'h1'});
 function save(){return request(()=>api(base+'workbooks/'+encodeURIComponent(draft.workbook.id)+'/save',{method:'POST',body:{packageId,expectedVersion:draft.workbook.version,values:copy(values)}}),result=>{useDraft(result);notice=t('تم حفظ المسودة.','Draft saved.');},{focus:'.gl-draft-status'});}
 function createDraft(formId,provenance){
  const body={packageId,formId,brand:brandId,provenance,requestKey:win.crypto.randomUUID()};
  return request(()=>api(base+'workbooks',{method:'POST',body}),useDraft,{focus:'h1'});
 }
 function markDirty(){dirty=true;notice='';const state=root.querySelector('.gl-draft-status');if(state)state.textContent=t('تغييرات غير محفوظة','Unsaved changes');const saveButton=root.querySelector('[data-action=save]');if(saveButton)saveButton.disabled=busy;const exportButton=root.querySelector('[data-action=export]');if(exportButton)exportButton.disabled=true;}
 function leave(action){if(dirty){pendingLeave=action;render();root.querySelector('.gl-unsaved button:last-child')?.focus();return;}action();}
 function back(){leave(()=>{sequence++;busy=false;onBack();});}
 function catalog(){draft=null;values=null;dirty=false;pendingLeave=null;load();}
 function exportDraft(){
  if(dirty||!draft)return;
  request(()=>api(base+'workbooks/'+encodeURIComponent(draft.workbook.id)+'/export'+query),report=>{
   if(report?.workbook?.packageId!==packageId||report?.workbook?.id!==draft.workbook.id)throw Error('learning_package_mismatch');
   if(typeof win.URL.createObjectURL!=='function')throw Error('download_unavailable');
   const text=JSON.stringify(report,null,2).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
   const url=win.URL.createObjectURL(new win.Blob([text],{type:'application/json;charset=utf-8'}));urls.add(url);
   const link=el('a');link.href=url;link.download='grc-workbook-'+draft.workbook.id.replace(/[^A-Za-z0-9_-]/g,'_')+'.json';doc.body.append(link);link.click();link.remove();
   win.setTimeout(()=>{if(urls.delete(url))win.URL.revokeObjectURL(url);},1000);notice=t('تم تجهيز ملف JSON للمسودة المحفوظة.','JSON export prepared from the saved draft.');
  });
 }
 function errorMessage(){
  if(error==='workbook_create_rate_limit')return t('بلغت حد إنشاء الدفاتر لهذه الساعة. يمكنك متابعة مسودة محفوظة أو المحاولة لاحقاً.','You reached the hourly draft creation limit. Continue a saved draft or try again later.');
  if(['workbook_storage_limit','workbook_draft_limit','workbook_version_limit'].includes(error))return t('بلغت حد تخزين المسودات أو نسخها. يمكنك قراءة بياناتك المحفوظة وتصديرها.','You reached a draft storage or version limit. You can still read and export saved data.');
  if(error==='workbook_changed')return t('حُفظت نسخة أحدث في جلسة أخرى. تغييراتك ما زالت هنا؛ راجع النسخة المحفوظة قبل تعديلها.','A newer version was saved in another session. Your edits are still here; review the saved version before editing it.');
  if(['enrollment_required','sign_in_required','account_unavailable','learning_access_unavailable'].includes(error))return t('تعذّر تأكيد صلاحية الوصول الحالية. تحقق من تسجيل الدخول وصلاحية الباقة.','Current access could not be confirmed. Check your sign-in and package access.');
  if(['learning_content_unavailable','workbook_schema_unavailable'].includes(error))return t('هذا المحتوى غير متاح حالياً ضمن الباقة.','This content is currently unavailable for this package.');
  if(error==='invalid_workbook_date')return t('أدخل تاريخاً صحيحاً أو اترك الحقل فارغاً.','Enter a valid date or leave the field blank.');
  if(/^invalid_workbook_|workbook_values_too_large/.test(error))return t('تعذّر حفظ القيم. راجع حدود الحقول وعدد الصفوف.','The values could not be saved. Check field lengths and the row limit.');
  return t('تعذّر إكمال الطلب. تغييرات المسودة غير المحفوظة ما زالت محفوظة في هذه الصفحة.','The request could not be completed. Unsaved draft edits are still on this page.');
 }
 function header(main){
  const head=el('header',undefined,'gw-header');head.append(el('strong',brandId==='trackford'?t('تراكفورد','Trackford'):t('السعيد','AlSaeed')),el('span',module==='academy'?t('الأكاديمية','Academy'):t('دفتر التطبيق','Application workbook')));
  head.append(button(lang==='ar'?'English':'العربية',()=>{lang=lang==='ar'?'en':'ar';render();},{disabled:false,className:'gw-language'}));root.append(head);
  const actions=el('div',undefined,'gw-actions');actions.append(button(t('العودة إلى مساحة التعلّم','Back to workspace'),back,{disabled:false}));main.append(actions);
 }
 function provenance(value){return value==='fictional_demo'?t('مثال افتراضي للتعلم','Fictional learning example'):t('بيانات أدخلها المستخدم ولم يتم التحقق منها','Unverified user-entered data');}
 function references(parent,refs){
  if(!refs?.length)return;const details=el('details',undefined,'gl-references');details.append(el('summary',t('مراجع هذا المحتوى','Content references')));const list=el('ul');
  for(const ref of refs){const parts=[ref.document,ref.section];if(ref.pdfPage)parts.push(t('صفحة PDF ','PDF page ')+ref.pdfPage);if(ref.printedPage)parts.push(t('الصفحة المطبوعة ','Printed page ')+ref.printedPage);const li=el('li',parts.filter(Boolean).join(' · '));if(ref.evidenceParaphrase)li.append(el('p',ref.evidenceParaphrase));list.append(li);}details.append(list);parent.append(details);
 }
 const kindName=value=>({lecture:t('المحاضرات','Lectures'),knowledge_note:t('الملاحظات المعرفية','Knowledge notes'),glossary:t('المصطلحات','Glossary')})[value]||value;
 function readerList(container){
  container.replaceChildren();const needle=search.trim().toLocaleLowerCase(),matches=index.items.filter(x=>(kind==='all'||x.kind===kind)&&(!needle||Object.values(x.title||{}).some(title=>title.toLocaleLowerCase().includes(needle))));
  container.append(el('p',t('عدد النتائج: ','Results: ')+matches.length,'gw-help'));
  const list=el('ul',undefined,'gl-reader-list');
  for(const entry of matches){const li=el('li'),link=button(label(entry.title),()=>openItem(entry.id),{className:'gw-button gl-reader-link'});if(item?.id===entry.id)link.setAttribute('aria-current','page');if(!entry.availableLocales.includes(lang)){link.lang=entry.availableLocales[0];link.dir=entry.availableLocales[0]==='ar'?'rtl':'ltr';}li.append(link,el('small',kindName(entry.kind)+(entry.availableLocales.includes(lang)?'':t(' · غير متاح بالعربية',' · Arabic only; English unavailable'))));list.append(li);}container.append(list);
 }
 function reader(main){
  main.append(el('h1',t('مكتبة التعلّم','Learning library')),el('p',t('اختر محاضرة أو ملاحظة أو مجموعة مصطلحات.','Choose a lecture, note or glossary entry.'),'gw-lead'));
  if(!index)return;
  const filters=el('div',undefined,'gw-actions'),searchLabel=el('label',t('بحث في العناوين','Search titles')),input=el('input');input.type='search';input.value=search;input.maxLength=200;searchLabel.append(input);
  const typeLabel=el('label',t('نوع المحتوى','Content type')),select=el('select');for(const value of ['all','lecture','knowledge_note','glossary']){const option=el('option',value==='all'?t('الكل','All'):kindName(value));option.value=value;option.selected=kind===value;select.append(option);}typeLabel.append(select);filters.append(searchLabel,typeLabel);main.append(filters);
  const list=el('nav',undefined,'gl-library-nav');list.setAttribute('aria-label',t('فهرس مكتبة التعلّم','Learning library contents'));input.oninput=()=>{search=input.value;readerList(list);};select.onchange=()=>{kind=select.value;readerList(list);};readerList(list);main.append(list);
  if(!item)return;
  const article=el('article',undefined,'gw-question gl-reader');article.append(el('h2',label(item.title)));
  if(!item.availableLocales.includes(lang)){
   article.append(status(t('هذا المحتوى غير متاح باللغة العربية.','English translation is unavailable for this item. Its reviewed text is available in Arabic.')));
   if(item.availableLocales.includes('ar'))article.append(button('اقرأ بالعربية · Read in Arabic',()=>{lang='ar';render();},{disabled:false}));main.append(article);return;
  }
  if(item.objectives?.[lang]?.length){const list=el('ul');for(const objective of item.objectives[lang])list.append(el('li',objective));article.append(el('h3',t('أهداف التعلّم','Learning objectives')),list);}
  const nav=el('nav',undefined,'gw-actions');nav.setAttribute('aria-label',t('أقسام المحتوى','Content sections'));
  item.sections.forEach((part,i)=>{const control=button(label(part.title),()=>{section=i;render();root.querySelector('.gl-section-heading')?.focus();},{disabled:false});if(i===section)control.setAttribute('aria-current','true');nav.append(control);});article.append(nav);
  const part=item.sections[section];if(part){const heading=el('h3',part.title[lang],'gl-section-heading');heading.tabIndex=-1;article.append(heading);const body=el('div',undefined,'gl-reader-body');body.lang=lang;body.dir=lang==='ar'?'rtl':'ltr';appendReaderNodes(body,part.body[lang]);article.append(body);references(article,part.references);}
  const actions=el('div',undefined,'gw-actions');actions.append(button(t('القسم السابق','Previous section'),()=>{section--;render();root.querySelector('.gl-section-heading')?.focus();},{disabled:section===0}),el('span',(section+1)+' / '+item.sections.length),button(t('القسم التالي','Next section'),()=>{section++;render();root.querySelector('.gl-section-heading')?.focus();},{disabled:section>=item.sections.length-1}));article.append(actions);
  const itemIndex=index.items.findIndex(x=>x.id===item.id),next=el('div',undefined,'gw-actions');next.append(button(t('المادة السابقة','Previous item'),()=>openItem(index.items[itemIndex-1].id),{disabled:busy||itemIndex<=0}),button(t('المادة التالية','Next item'),()=>openItem(index.items[itemIndex+1].id),{disabled:busy||itemIndex<0||itemIndex>=index.items.length-1}));article.append(next);main.append(article);
 }
 function workbookCatalog(main){
  main.append(el('h1',t('دفاتر التطبيق التعليمية','Learning workbooks')),el('p',t('نماذج تعليمية فارغة من الإصدار المراجع. البيانات التي تدخلها لا تُعد دليلاً معتمداً أو قراراً مهنياً.','Blank learning forms from the reviewed release. Your entries are not verified evidence or professional decisions.'),'gw-lead'));
  if(!index)return;
  if(!index.forms.length)main.append(status(t('لا تتوفر نماذج جديدة حالياً. يمكنك متابعة مسوداتك المحفوظة أدناه.','New forms are currently unavailable. You can continue saved drafts below.')));
  const forms=el('div',undefined,'gw-modules');
  for(const form of index.forms){const card=el('section',undefined,'gw-module');card.append(el('h2',label(form.title)));for(const provenance of ['user_entered_unverified','fictional_demo'])card.append(button(provenance==='fictional_demo'?t('ابدأ مثالاً افتراضياً فارغاً','Start blank fictional example'):t('ابدأ مسودة فارغة','Start blank draft'),()=>createDraft(form.id,provenance)));forms.append(card);}main.append(forms,el('h2',t('مسوداتي المحفوظة','My saved drafts')));
  if(!index.drafts.length)main.append(el('p',t('لم تحفظ أي مسودة بعد.','No saved drafts yet.')));
  const drafts=el('ul',undefined,'gl-draft-list');for(const record of index.drafts){const li=el('li');li.append(button(label(record.title),()=>openDraft(record.id)),el('span',provenance(record.provenance)+' · '+t('نسخة ','Version ')+record.version));drafts.append(li);}main.append(drafts);
  if(index.nextOffset!==null&&index.nextOffset!==undefined)main.append(button(t('عرض المزيد','Load more'),()=>request(()=>api(base+'workbooks'+query+'&offset='+index.nextOffset),result=>{validatePackage(result);index={...result,drafts:[...index.drafts,...result.drafts]};})));
  main.append(el('p',t('تقتصر هذه الوحدة على النماذج المعروضة. الأدوات الأخرى وتقييم القدرات (Navigator) خارج نطاقها.','This module covers the forms shown. Other tools and the capability assessment (Navigator) are outside its scope.'),'gw-help'));
 }
 function fieldInput(field,value,changed,suffix){
  const wrap=el('label',undefined,'gl-field'),id=fieldPrefix+suffix+'-'+field.id;wrap.append(el('span',label(field.label)));const input=el(field.type==='textarea'?'textarea':'input');input.id=id;input.name=id;if(field.type!=='textarea')input.type=field.type==='date'?'date':'text';else input.rows=3;input.maxLength=draft.limits[field.type];input.value=value;input.disabled=busy;input.oninput=()=>{changed(input.value);markDirty();};wrap.htmlFor=id;wrap.append(input);return wrap;
 }
 function workbookEditor(main){
  const form=draft.schema;main.append(el('h1',label(form.title)),status(provenance(draft.workbook.provenance)+' · '+t('مسودة تعليمية؛ ليست دليلاً على الامتثال أو الضمان.','Learning draft; not evidence of compliance or assurance.')));
  if(draft.workbook.provenance==='fictional_demo')main.append(el('p',label(form.demoNotice),'gw-help'));
  main.append(el('p',t('احفظ تغييراتك قبل التصدير. الحد الأقصى ١٠٠ صف؛ ١٠٠٠ حرف للحقل النصي و٨٠٠٠ للنص المطوّل.','Save changes before exporting. Maximum 100 rows, 1,000 characters per text field and 8,000 per long-text field.'),'gw-help'));
  const editor=el('form',undefined,'gl-workbook-form');editor.onsubmit=e=>{e.preventDefault();if(!busy&&dirty)save();};
  for(const field of form.fields){
   if(field.type!=='table'){editor.append(fieldInput(field,values[field.id],v=>values[field.id]=v,'single'));continue;}
   const group=el('section',undefined,'gl-table-field');group.append(el('h2',label(field.label)),el('p',values[field.id].length+' / '+draft.limits.rows));
   values[field.id].forEach((row,rowIndex)=>{const fieldset=el('fieldset',undefined,'gw-question gl-workbook-row');fieldset.append(el('legend',t('الصف ','Row ')+(rowIndex+1)));const fields=el('div',undefined,'gl-fields');for(const column of field.columns)fields.append(fieldInput(column,row[column.id],v=>row[column.id]=v,field.id+'-'+rowIndex));fieldset.append(fields,button(t('إزالة الصف','Remove row'),()=>{values[field.id].splice(rowIndex,1);markDirty();render();}));group.append(fieldset);});
   group.append(button(t('إضافة صف','Add row'),()=>{values[field.id].push(Object.fromEntries(field.columns.map(c=>[c.id,''])));markDirty();render();doc.getElementById(fieldPrefix+field.id+'-'+(values[field.id].length-1)+'-'+field.columns[0].id)?.focus();},{disabled:busy||values[field.id].length>=draft.limits.rows}));editor.append(group);
  }
  const actions=el('div',undefined,'gw-actions'),saveButton=button(t('حفظ المسودة','Save draft'),save,{disabled:busy||!dirty}),exportButton=button(t('تصدير المسودة المحفوظة (JSON)','Export saved draft (JSON)'),exportDraft,{disabled:busy||dirty});saveButton.dataset.action='save';exportButton.dataset.action='export';actions.append(saveButton,exportButton,button(t('كل الدفاتر','All workbooks'),()=>leave(catalog)));editor.append(actions,el('p',dirty?t('تغييرات غير محفوظة','Unsaved changes'):t('محفوظ · نسخة ','Saved · version ')+draft.workbook.version,'gl-draft-status'));main.append(editor);references(main,form.references);
  if(error==='workbook_changed')main.append(button(t('فتح النسخة المحفوظة','Open saved version'),()=>leave(()=>openDraft(draft.workbook.id))));
 }
 function render(){
  if(disposed)return;const focusedId=root.contains(doc.activeElement)?doc.activeElement.id:null;root.replaceChildren();root.className='grc-workspace grc-learning';root.dataset.brand=brandId;root.lang=lang;root.dir=lang==='ar'?'rtl':'ltr';root.style.setProperty('--gw-accent',brandId==='trackford'?'#c99b43':'#ed7e2b');root.style.setProperty('--gw-ink',brandId==='trackford'?'#0a1b3d':'#12314b');
  const main=el('main',undefined,'gw-main');header(main);root.append(main);
  if(error){main.append(status(errorMessage(),true));if(retry&&error!=='workbook_changed')main.append(button(t('إعادة المحاولة','Try again'),()=>retry()));}
  if(notice)main.append(status(notice));if(busy)main.append(status(t('جارٍ تنفيذ الطلب…','Working…')));
  if(pendingLeave){const dialog=el('section',undefined,'gw-status gl-unsaved');dialog.setAttribute('role','alertdialog');dialog.setAttribute('aria-modal','false');dialog.setAttribute('aria-label',t('تغييرات غير محفوظة','Unsaved changes'));dialog.append(el('p',t('لديك تغييرات غير محفوظة. هل تريد تجاهلها والمتابعة؟','You have unsaved changes. Discard them and continue?')),button(t('تجاهل التغييرات والمتابعة','Discard changes and continue'),()=>{const action=pendingLeave;pendingLeave=null;dirty=false;action();}),button(t('مواصلة التحرير','Keep editing'),()=>{pendingLeave=null;render();}));main.append(dialog);}
  if(module==='academy')reader(main);else if(draft)workbookEditor(main);else workbookCatalog(main);
  if(focusedId){const focused=doc.getElementById(focusedId);if(focused&&root.contains(focused))focused.focus();}
 }
 function beforeUnload(event){if(dirty&&!disposed){event.preventDefault();event.returnValue='';}}
 win.addEventListener('beforeunload',beforeUnload);load();
 return {retarget(newRoot){if(disposed)return;if(newRoot?.ownerDocument!==doc)throw TypeError('The replacement root must belong to the same document');root.replaceChildren();root=newRoot;render();},setLanguage(value){if(disposed)return;lang=value==='en'?'en':'ar';render();},dispose(){if(disposed)return;disposed=true;sequence++;win.removeEventListener('beforeunload',beforeUnload);for(const url of urls)win.URL.revokeObjectURL(url);urls.clear();root.replaceChildren();},hasUnsavedChanges(){return dirty;}};
}
