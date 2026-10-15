/* Ordered presentation taxonomy; stored lesson chapter ids remain unchanged. */
(function(){
const pmp=[['intro','مقدمة','Introduction',/مقدم|introduction/i],['exam','هيكل اختبار PMP','PMP exam structure',/هيكل.*اختبار|exam.*structure/i],['framework','إطار عمل إدارة المشاريع','Project management framework',/إطار|framework|أسس إدارة/i],['value','نظام تسليم القيمة','Value delivery system',/تسليم القيمة|value delivery/i],['principles','مبادئ إدارة المشاريع','Project management principles',/مبادئ|principles/i],['lifecycles','دورات حياة المشروع','Project life cycles',/دور.*حياة|life.?cycle/i],['governance','الحوكمة','Governance',/حوكمة|governance/i],['scope','النطاق','Scope',/نطاق|scope|متطلبات/i],['schedule','الجدول الزمني','Schedule',/جدول|schedule/i],['cost','المالية','Finance',/مالية|تكلفة|تمويل|cost|finance/i],['resources','الموارد','Resources',/موارد|فريق|قيادة|resource|team|leadership/i],['risk','المخاطر','Risk',/مخاطر|risk/i],['stakeholders','المعنيون','Stakeholders',/معني|مصلحة|stakeholder/i],['people','مجال الأشخاص','People domain',/مجال.*(أشخاص|أفراد)|people domain/i],['process','مجال العمليات','Process domain',/مجال.*عمليات|process domain/i],['business','مجال بيئة الأعمال','Business environment domain',/مجال.*بيئة|business environment domain/i],['journey','رحلة الاجتياز','Passing journey',/اجتياز|passing journey/i],['review','حل أهم الأسئلة','Key question review',/حل.*أسئلة|question review/i]];
function groups(c,lessons){if(c.id!=='pmp')return Object.entries(lessons.reduce((m,l,i)=>{(m[l.ch]??=[]).push({...l,i});return m},{})).map(([ch,items])=>({title:c.chapters[ch]||'مقدمة',items,key:ch}));const result=pmp.map(t=>({key:t[0],title:t[1],en:t[2],items:[]})),other=new Map();lessons.forEach((l,i)=>{const title=[l.t,l.title_ar,l.title_en,l.en].filter(Boolean).join(' ');let topic=pmp.find(t=>['people','process','business','exam','review','journey'].includes(t[0])&&t[3].test(title))||pmp.find(t=>t[3].test(title));if(topic)result[pmp.indexOf(topic)].items.push({...l,i});else{const key=String(l.ch);if(!other.has(key))other.set(key,{key:'saved_'+key,title:c.chapters[l.ch]||'دروس إضافية',items:[]});other.get(key).items.push({...l,i})}});return [...result,...other.values()]}
// Public outline only. The learner roadmap, stored chapter ids and lesson grouping stay unchanged.
const publicLabels=Object.fromEntries(pmp.map(([key,ar,en])=>[key,{key,ar,en}]));
publicLabels.quality={key:'quality',ar:'الجودة',en:'Quality'};
publicLabels.procurement={key:'procurement',ar:'المشتريات والتعاقد',en:'Procurement and contracts'};
const publicPhases=[["initiating","مرحلة البدء","Initiating",["governance","resources","stakeholders"]],["planning","مرحلة التخطيط","Planning",["governance","scope","schedule","cost","resources","risk","quality","procurement","stakeholders"]],["executing","مرحلة التنفيذ","Executing",["governance","scope","cost","resources","risk","quality","procurement","stakeholders"]],["monitoring","مرحلة المتابعة والتحكم","Monitoring & Controlling",["governance","scope","schedule","cost","risk","quality","procurement","stakeholders"]],["closing","مرحلة الإغلاق","Closing",["governance","scope","procurement","stakeholders"]]];
function publicPmpTopics(){
  return [
    ...pmp.slice(0,6).map(([key])=>({...publicLabels[key]})),
    {key:'agile',ar:'النهج الرشيق',en:'Agile Approach'},
    {key:'predictive',ar:'النهج التنبؤي',en:'Predictive Approach',children:publicPhases.map(([key,ar,en,keys])=>({key,ar,en,children:keys.map(topic=>({...publicLabels[topic]}))}))},
    {key:'hybrid',ar:'النهج المختلط',en:'Hybrid Approach'},
    ...pmp.slice(13).map(([key])=>({...publicLabels[key]})),
    {key:'exam-guidelines',ar:'إرشادات وتعليمات الاختبار الحقيقي',en:'Actual Exam Guidelines and Instructions'}
  ];
}
function topics(c){return c.id==='pmp'?publicPmpTopics():(c.chapters||[]).slice()}
window.CourseRoadmap={pmp,groups,topics};
})();
