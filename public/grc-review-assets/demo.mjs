import {mountGrcWorkspace} from './grc-workspace.mjs';
// Three fictional teaching fixtures. No reference-bank text, real credentials or network API.
const params=new URLSearchParams(location.search),brand=params.get('brand')==='trackford'?'trackford':'alsaeed';
document.body.dataset.brand=brand;
if(brand==='trackford'){const logo=document.getElementById('demoBrandLogo');logo.src='/grc-review-assets/trackford-logo.webp';logo.alt='Track Ford — Business Consulting and International Learning';document.title='Track Ford GRC · DEMO review';}
const questions=[
 {id:'DEMO-1',type:'single',stem:{ar:'سؤال تجريبي: أي بطاقة تحمل كلمة «ألف»؟',en:'DEMO: Which card says “Alpha”?'},options:[{id:'demo-1-a',text:{ar:'ألف',en:'Alpha'}},{id:'demo-1-b',text:{ar:'باء',en:'Beta'}}],keys:['demo-1-a'],explanation:{ar:'هذا مثال اصطناعي لفحص واجهة التدريب. البطاقة المطلوبة هي ألف.',en:'This fictional example checks the practice interface. The requested card is Alpha.'}},
 {id:'DEMO-2',type:'multiple',stem:{ar:'سؤال تجريبي: اختر الرقمين واحد واثنين.',en:'DEMO: Select the numbers One and Two.'},options:[{id:'demo-2-a',text:{ar:'واحد',en:'One'}},{id:'demo-2-b',text:{ar:'اثنان',en:'Two'}},{id:'demo-2-c',text:{ar:'ثلاثة',en:'Three'}}],keys:['demo-2-a','demo-2-b'],explanation:{ar:'مثال اصطناعي للاختيار المتعدد: المطلوب واحد واثنان فقط.',en:'A fictional multiple-choice example: select One and Two only.'}},
 {id:'DEMO-3',type:'single',stem:{ar:'سؤال تجريبي: اختر البطاقة رقم خمسة.',en:'DEMO: Choose card number Five.'},options:[1,2,3,4,5].map(n=>({id:'demo-3-'+n,text:{ar:String(n),en:String(n)}})),keys:['demo-3-5'],explanation:{ar:'مثال اصطناعي يختبر عرض خمسة اختيارات. الإجابة خمسة.',en:'A fictional example testing a five-option layout. The response is Five.'}}
];
const modules=[
 ['academy','الأكاديمية','Academy','محاور التعلّم والخطة الدراسية والمصطلحات.','Learning topics, study plan and glossary.'],
 ['practice','تدريب المحاور','Topic practice','أجب أولًا ثم راجع التفسير.','Respond first, then review the explanation.'],
 ['exam','اختبار المراجعة','Review assessment','احفظ إجاباتك وراجع النتيجة بعد التسليم.','Save responses and review results after submission.'],
 ['workbook','دفتر التطبيق','Application workbook','أنشطة وسجلات تطبيق قيد الإعداد.','Application activities and records in preparation.'],
 ['navigator','تقييم القدرات','Capability assessment','مسار تقييم ذاتي قيد المراجعة.','A self-assessment pathway under review.'],
 ['reports','النتائج والتقدّم','Results & progress','سجل التعلّم والتقارير قيد الربط.','Learning history and reports awaiting integration.']
].map(([id,ar,en,arDescription,enDescription])=>({id,ar,en,arDescription,enDescription,status:['practice','exam'].includes(id)?'available':'not_connected'}));
const attempts=new Map();let serial=0,controller=null;
const feedback=(attempt,q)=>{const selected=attempt.answers[q.id]||[];return {correct:selected.length===q.keys.length&&selected.every(id=>q.keys.includes(id)),correctOptionIds:[...q.keys],explanation:{...q.explanation},citation:'DEMO · Fictional fixture; no certification source.'};};
const view=a=>({attempt:{id:a.id,packageId:'grcp-full',mode:a.mode,status:a.status,revision:'fictional-demo-v1'},questions:questions.map(q=>({id:q.id,type:q.type,stem:q.stem,options:q.options,selectedOptionIds:a.answers[q.id]||[],...((a.status==='submitted'||a.mode==='practice'&&a.answers[q.id])?{feedback:feedback(a,q)}:{})})),...(a.status==='submitted'?{result:{correct:questions.filter(q=>feedback(a,q).correct).length,total:questions.length}}:{})});
async function api(path,options={}){
 await new Promise(resolve=>setTimeout(resolve,80));
 if(path.startsWith('/grc-workspace/manifest?'))return {packageId:'grcp-full',title:brand==='trackford'?{ar:'مساحة تراكفورد للتعلّم والتطبيق',en:'Track Ford learning & application workspace'}:{ar:'مساحة السعيد للتعلّم والتطبيق',en:'AlSaeed learning & application workspace'},bank:{status:'approved',questionCount:3,revision:'fictional-demo-v1'},modules};
 if(path==='/grc-workspace/attempts'){const a={id:'demo-attempt-'+(++serial),mode:options.body.mode,status:'in_progress',answers:{}};attempts.set(a.id,a);return view(a);}
 const parts=path.split('/'),a=attempts.get(parts[3]);if(!a)throw Error('Demo attempt unavailable');
 if(path.endsWith('/answer')){if(a.status!=='in_progress')throw Error('Submitted');const q=questions.find(q=>q.id===options.body.questionId),selected=options.body.selectedOptionIds;if(!q||!Array.isArray(selected)||selected.some(id=>!q.options.some(o=>o.id===id))||(q.type==='single'&&selected.length>1)||(a.mode==='practice'&&!selected.length))throw Error('invalid_selection');if(a.mode==='practice'&&a.answers[q.id]&&JSON.stringify(a.answers[q.id])!==JSON.stringify(selected))throw Error('Practice response locked');if(selected.length)a.answers[q.id]=[...selected];else delete a.answers[q.id];return {saved:true,...(a.mode==='practice'?{feedback:feedback(a,q)}:{})};}
 if(path.endsWith('/export')){if(a.status!=='submitted')throw Error('submit_before_export');return {schemaVersion:1,demo:true,attempt:view(a).attempt,result:view(a).result,responses:questions.map(q=>({questionId:q.id,correct:feedback(a,q).correct,selectedOptions:q.options.filter(o=>(a.answers[q.id]||[]).includes(o.id)).map(o=>o.text)}))};}
 if(path.endsWith('/submit')){a.status='submitted';return view(a);}
 return view(a);
}
function start(){controller?.dispose();attempts.clear();controller=mountGrcWorkspace(document.getElementById('demoRoot'),{api,packageId:'grcp-full',brand,locale:params.get('lang')==='en'?'en':'ar'});}
document.getElementById('demoReset').onclick=start;
document.getElementById('demoClose').onclick=()=>{controller?.dispose();controller=null;attempts.clear();const root=document.getElementById('demoRoot'),message=document.createElement('p');message.className='demo-closed';message.textContent='تم إغلاق العرض التجريبي · Demo closed. Use Reset to reopen.';root.replaceChildren(message);};
new MutationObserver(()=>{const root=document.getElementById('demoRoot');if(root.lang){document.documentElement.lang=root.lang;document.documentElement.dir=root.dir;}}).observe(document.getElementById('demoRoot'),{attributes:true,attributeFilter:['lang','dir']});
start();
