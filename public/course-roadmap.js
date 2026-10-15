/* Ordered presentation taxonomy; stored lesson chapter ids remain unchanged. */
(function(){
const pmp=[['intro','مقدمة','Introduction',/مقدم|introduction/i],['exam','هيكل اختبار PMP','PMP exam structure',/هيكل.*اختبار|exam.*structure/i],['framework','إطار عمل إدارة المشاريع','Project management framework',/إطار|framework|أسس إدارة/i],['value','نظام تسليم القيمة','Value delivery system',/تسليم القيمة|value delivery/i],['principles','مبادئ إدارة المشاريع','Project management principles',/مبادئ|principles/i],['lifecycles','دورات حياة المشروع','Project life cycles',/دور.*حياة|life.?cycle/i],['governance','الحوكمة','Governance',/حوكمة|governance/i],['scope','النطاق','Scope',/نطاق|scope|متطلبات/i],['schedule','الجدول الزمني','Schedule',/جدول|schedule/i],['cost','المالية','Finance',/مالية|تكلفة|تمويل|cost|finance/i],['resources','الموارد','Resources',/موارد|فريق|قيادة|resource|team|leadership/i],['risk','المخاطر','Risk',/مخاطر|risk/i],['stakeholders','المعنيون','Stakeholders',/معني|مصلحة|stakeholder/i],['people','مجال الأشخاص','People domain',/مجال.*(أشخاص|أفراد)|people domain/i],['process','مجال العمليات','Process domain',/مجال.*عمليات|process domain/i],['business','مجال بيئة الأعمال','Business environment domain',/مجال.*بيئة|business environment domain/i],['journey','رحلة الاجتياز','Passing journey',/اجتياز|passing journey/i],['review','حل أهم الأسئلة','Key question review',/حل.*أسئلة|question review/i]];
function groups(c,lessons){if(c.id!=='pmp')return Object.entries(lessons.reduce((m,l,i)=>{(m[l.ch]??=[]).push({...l,i});return m},{})).map(([ch,items])=>({title:c.chapters[ch]||'مقدمة',items,key:ch}));const result=pmp.map(t=>({key:t[0],title:t[1],en:t[2],items:[]})),other=new Map();lessons.forEach((l,i)=>{const title=[l.t,l.title_ar,l.title_en,l.en].filter(Boolean).join(' ');let topic=pmp.find(t=>['people','process','business','exam','review','journey'].includes(t[0])&&t[3].test(title))||pmp.find(t=>t[3].test(title));if(topic)result[pmp.indexOf(topic)].items.push({...l,i});else{const key=String(l.ch);if(!other.has(key))other.set(key,{key:'saved_'+key,title:c.chapters[l.ch]||'دروس إضافية',items:[]});other.get(key).items.push({...l,i})}});return [...result,...other.values()]}
// Shared outline labels; assessment keys and stored lesson chapters stay unchanged.
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
// A presentation tree only: never write classifications back to lesson records.
// Existing broad topic lessons have no phase assignment. Keep them in a separate
// shared-resources branch instead of treating them as predictive phase lessons.
function learnerGroups(c,lessons){
  if(c.id!=='pmp')return groups(c,lessons);
  const sharedKeys=new Set(pmp.slice(6,13).map(t=>t[0]));
  const node=t=>({key:t.key,title:t.ar,en:t.en,items:[],children:(t.children||[]).map(node),readingKey:null,assessmentKey:null,resourceKey:sharedKeys.has(t.key)?t.key:null});
  const outline=publicPmpTopics().map(node),byKey=new Map(outline.map(g=>[g.key,g]));
  const shared={key:'shared-resources',title:'الموضوعات المشتركة والدروس الإضافية',en:'Shared topics and additional lessons',items:[],children:[],readingKey:null,assessmentKey:null,
    noteAr:'دروس وقراءات مشتركة متاحة دون إسنادها إلى نهج أو مرحلة محددة.',
    noteEn:'Shared lessons and readings available without assigning them to a specific approach or phase.'};
  const legacy=groups(c,lessons),original=new Map();
  for(const g of legacy){
    for(const l of g.items)original.set(l.i,g);
    const target=byKey.get(g.key);
    if(target){target.readingKey=g.key;target.assessmentKey=['intro','exam','journey','review'].includes(g.key)?null:g.key;}
    else if(!String(g.key).startsWith('saved_'))shared.children.push({...g,items:[],children:[],readingKey:g.key,assessmentKey:g.key});
  }
  const approachLabels=[['agile',/\bagile\b|النهج الرشيق|النهج التكيفي/i],['predictive',/\bpredictive\b|النهج التنبؤي|النهج التتابعي/i],['hybrid',/\bhybrid\b|النهج المختلط|النهج الهجين/i]];
  const phaseLabels=[['initiating',/مرحلة البدء|\binitiating\s+(?:phase|process group)\b/i],['planning',/مرحلة التخطيط|\bplanning\s+(?:phase|process group)\b/i],['executing',/مرحلة التنفيذ|\bexecuting\s+(?:phase|process group)\b/i],['monitoring',/مرحلة (?:المتابعة|المراقبة) والتحكم|\bmonitoring\s*(?:&|and)\s*controlling\s*(?:phase|process group)?\b/i],['closing',/مرحلة الإغلاق|\bclosing\s+(?:phase|process group)\b/i]];
  const labelText=l=>[l.t,l.t_en,l.title,l.title_ar,l.title_en,l.en].filter(Boolean).join(' ');
  const savedLabel=ch=>typeof ch==='string'?ch:ch?[ch.ar,ch.en].filter(Boolean).join(' '):'';
  const one=values=>{const keys=[...new Set(values.filter(Boolean))];return keys.length===1?keys[0]:null;};
  function contextFor(l){
    const chapter=savedLabel(c.chapters?.[l.ch]),text=labelText(l)+' '+chapter;
    const approaches=[...approachLabels.filter(([,rx])=>rx.test(text)).map(([key])=>key),approachLabels.some(([key])=>key===l.approach)?l.approach:null];
    const exactLabels=[chapter,l.t,l.t_en,l.title,l.title_ar,l.title_en,l.en].filter(v=>typeof v==='string').map(v=>v.trim().toLowerCase());
    const phases=[...phaseLabels.filter(([,rx])=>rx.test(text)).map(([key])=>key),...publicPhases.filter(([key,ar,en])=>[key,ar,ar.replace(/^مرحلة /,''),en].some(v=>exactLabels.includes(v.toLowerCase()))).map(([key])=>key),publicPhases.some(([key])=>key===l.phase)?l.phase:null];
    return {approach:one(approaches),phase:one(phases),ambiguous:new Set(approaches.filter(Boolean)).size>1||new Set(phases.filter(Boolean)).size>1};
  }
  function childFor(parent,g){
    let child=parent.children.find(x=>x.key===g.key);
    if(!child){child={...g,items:[],children:[],readingKey:null,assessmentKey:String(g.key).startsWith('saved_')?g.title:g.key};parent.children.push(child);}
    return child;
  }
  lessons.forEach((l,i)=>{
    const item={...l,i},prior=original.get(i),route=contextFor(l);
    const text=labelText(l)+' '+savedLabel(c.chapters?.[l.ch]);
    let target;
    if(!route.ambiguous&&/إرشادات وتعليمات الاختبار الحقيقي|actual exam guidelines and instructions/i.test(text))target=byKey.get('exam-guidelines');
    else if(!route.ambiguous&&(route.approach||route.phase)){
      target=byKey.get(route.approach||'predictive');
      if(route.phase&&(!route.approach||route.approach==='predictive'))target=target.children.find(g=>g.key===route.phase);
      // A broad topic is only nested when its existing match is compatible with
      // the declared branch. All remaining content stays directly on that branch.
      const subtopic=String(prior.key).startsWith('saved_')?one([/\bquality\b|الجودة/i.test(text)?'quality':null,/\bprocurement\b|\bcontracts?\b|المشتريات|التعاقد/i.test(text)?'procurement':null]):prior.key;
      if(target.children?.some(g=>g.key===subtopic))target=target.children.find(g=>g.key===subtopic);
    }else target=byKey.get(prior.key);
    if(!target)target=childFor(shared,prior);
    target.items.push(item);
  });
  return [...outline,shared];
}
function lessonItems(group){return [...group.items,...(group.children||[]).flatMap(lessonItems)];}
function videoOrder(c,lessons){return learnerGroups(c,lessons).flatMap(lessonItems).filter(l=>l.vimeo).map(l=>l.i);}
window.CourseRoadmap={pmp,groups,topics,learnerGroups,lessonItems,videoOrder};
})();
