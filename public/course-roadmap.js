/* Ordered presentation taxonomy; stored lesson chapter ids remain unchanged. */
(function(){
const pmp=[['intro','مقدمة','Introduction',/مقدم|introduction/i],['exam','هيكل اختبار PMP','PMP exam structure',/هيكل.*اختبار|exam.*structure/i],['framework','إطار عمل إدارة المشاريع','Project management framework',/إطار|framework|أسس إدارة/i],['value','نظام تسليم القيمة','Value delivery system',/تسليم القيمة|value delivery/i],['principles','مبادئ إدارة المشاريع','Project management principles',/مبادئ|principles/i],['lifecycles','دورات حياة المشروع','Project life cycles',/دور.*حياة|life.?cycle/i],['governance','الحوكمة','Governance',/حوكمة|governance/i],['scope','النطاق','Scope',/نطاق|scope|متطلبات/i],['schedule','الجدول الزمني','Schedule',/جدول|schedule/i],['cost','المالية','Finance',/مالية|تكلفة|تمويل|cost|finance/i],['resources','الموارد','Resources',/موارد|فريق|قيادة|resource|team|leadership/i],['risk','المخاطر','Risk',/مخاطر|risk/i],['stakeholders','المعنيون','Stakeholders',/معني|مصلحة|stakeholder/i],['people','مجال الأشخاص','People domain',/مجال.*(أشخاص|أفراد)|people domain/i],['process','مجال العمليات','Process domain',/مجال.*عمليات|process domain/i],['business','مجال بيئة الأعمال','Business environment domain',/مجال.*بيئة|business environment domain/i],['journey','رحلة الاجتياز','Passing journey',/اجتياز|passing journey/i],['review','حل أهم الأسئلة','Key question review',/حل.*أسئلة|question review/i]];
function groups(c,lessons){if(c.id!=='pmp')return Object.entries(lessons.reduce((m,l,i)=>{(m[l.ch]??=[]).push({...l,i});return m},{})).map(([ch,items])=>({title:c.chapters[ch]||'مقدمة',items,key:ch}));const result=pmp.map(t=>({key:t[0],title:t[1],en:t[2],items:[]})),other=new Map();lessons.forEach((l,i)=>{const title=[l.t,l.title_ar,l.title_en,l.en].filter(Boolean).join(' ');let topic=pmp.find(t=>['people','process','business','exam','review','journey'].includes(t[0])&&t[3].test(title))||pmp.find(t=>t[3].test(title));if(topic)result[pmp.indexOf(topic)].items.push({...l,i});else{const key=String(l.ch);if(!other.has(key))other.set(key,{key:'saved_'+key,title:c.chapters[l.ch]||'دروس إضافية',items:[]});other.get(key).items.push({...l,i})}});return [...result,...other.values()]}
// Shared outline labels; assessment keys and stored lesson chapters stay unchanged.
const publicLabels=Object.fromEntries(pmp.map(([key,ar,en])=>[key,{key,ar,en}]));
const publicPhases=[['initiating','مرحلة البدء','Initiating'],['planning','مرحلة التخطيط','Planning'],['executing','مرحلة التنفيذ','Executing'],['monitoring','مرحلة المتابعة والتحكم','Monitoring & Controlling'],['closing','مرحلة الإغلاق','Closing']];
function publicPmpTopics(){
  return [
    ...pmp.slice(0,6).map(([key])=>({...publicLabels[key]})),
    {key:'agile',ar:'النهج الرشيق',en:'Agile Approach'},
    {key:'predictive',ar:'النهج التنبؤي',en:'Predictive Approach',children:publicPhases.map(([key,ar,en])=>({key,ar,en}))},
    {key:'hybrid',ar:'النهج المختلط',en:'Hybrid Approach'},
    ...pmp.slice(13,17).map(([key])=>({...publicLabels[key]})),
    {key:'ai',ar:'الذكاء الاصطناعي',en:'Artificial intelligence'},
    {key:'final-reviews',ar:'المراجعات النهائية',en:'Final reviews',children:[{key:'summaries',ar:'ملخصات',en:'Summaries'},{...publicLabels.review}]},
    {key:'workshops',ar:'ورش العمل التطبيقية',en:'Practical workshops'},
    {key:'exam-eve',ar:'ليلة الاختبار',en:'Exam eve'},
    {key:'exam-guidelines',ar:'إرشادات وتعليمات الاختبار الدولي',en:'International Exam Guidelines and Instructions'}
  ];
}
function topics(c){return c.id==='pmp'?publicPmpTopics():(c.chapters||[]).slice()}
// Presentation only. Original lessons keep their saved records, chapters and
// progress indices. A phase gets lessons only when the source identifies it.
function learnerGroups(c,lessons){
  if(c.id!=='pmp')return groups(c,lessons);
  const node=t=>({key:t.key,title:t.ar,en:t.en,items:[],children:(t.children||[]).map(node),readingKey:null,assessmentKey:null});
  const outline=publicPmpTopics().map(node),byKey=new Map();
  const index=nodes=>nodes.forEach(g=>{byKey.set(g.key,g);index(g.children)});index(outline);
  const legacy=groups(c,lessons),original=new Map(),sourceGroups=new Map();
  const savedLabel=ch=>typeof ch==='string'?ch:ch?[ch.ar,ch.en].filter(Boolean).join(' '):'';
  function sourceGroup(ch){
    const key=String(ch);
    if(!sourceGroups.has(key)){
      const chapter=c.chapters?.[ch],label=savedLabel(chapter);
      sourceGroups.set(key,{key:'source_'+key,title:chapter&&typeof chapter==='object'?(chapter.ar||chapter.en||''):label,en:chapter&&typeof chapter==='object'?(chapter.en||chapter.ar||''):label,items:[],children:[],readingKey:null,assessmentKey:null,assessmentKeys:[],originalChapter:true});
    }
    return sourceGroups.get(key);
  }
  // These are existing learning summaries, not new lessons or phase subtopics.
  byKey.get('summaries').readings=[];
  byKey.get('summaries').assessmentKeys=[];
  for(const g of legacy){
    for(const l of g.items)original.set(l.i,g);
    const target=byKey.get(g.key);
    if(target){target.readingKey=g.key;target.assessmentKey=['intro','exam','journey','review'].includes(g.key)?null:g.key;}
    else if(!String(g.key).startsWith('saved_'))byKey.get('summaries').readings.push({key:g.key,assessmentKey:g.key});
    else if(g.items.length){
      const title=savedLabel(c.chapters?.[g.items[0].ch]);
      if(title&&!byKey.get('summaries').assessmentKeys.includes(title))byKey.get('summaries').assessmentKeys.push(title);
    }
  }
  const approachLabels=[['agile',/\bagile\b|النهج الرشيق|النهج التكيفي/i],['predictive',/\bpredictive\b|النهج التنبؤي|النهج التتابعي/i],['hybrid',/\bhybrid\b|النهج المختلط|النهج الهجين/i]];
  const phaseLabels=[['initiating',/مرحلة البدء|\binitiating\s+(?:phase|process group)\b/i],['planning',/مرحلة التخطيط|\bplanning\s+(?:phase|process group)\b/i],['executing',/مرحلة التنفيذ|\bexecuting\s+(?:phase|process group)\b/i],['monitoring',/مرحلة (?:المتابعة|المراقبة) والتحكم|\bmonitoring\s*(?:&|and)\s*controlling\s*(?:phase|process group)?\b/i],['closing',/مرحلة الإغلاق|\bclosing\s+(?:phase|process group)\b/i]];
  const labelValues=l=>[l.t,l.t_en,l.title,l.title_ar,l.title_en,l.en].filter(v=>typeof v==='string');
  const labelText=l=>labelValues(l).join(' ');
  const normalize=text=>String(text).replace(/®/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  // Exact published titles avoid sweeping general exam/finance/schedule topics
  // into the final instructions chapter merely because a keyword occurs.
  const guidelineTitles=new Set([
    'متطلبات تقديم الاختبار الدولى والاهليه','PMP Eligibility and Application',
    'طريقة تعبئة طلب الاختبار الدولي','PMP Application',
    'خطوات دفع رسوم اختبار PMP','Pay for Exam Steps',
    'خطوات حجز موعد اختبار PMP','Schedule Exam Steps',
    'واجهة اختبار PMP وتقرير النتائج','PMP Exam Interface and Results',
    'إرشادات وتعليمات الاختبار الحقيقي','Actual Exam Guidelines and Instructions',
    'إرشادات وتعليمات الاختبار الدولي','International Exam Guidelines and Instructions'
  ].map(normalize));
  const specialLabels=[['ai',/الذكاء الاصطناعي|\bartificial intelligence\b|^AI$/i],['final-reviews',/المراجعات النهائية|المراجعة النهائية|\bfinal reviews?\b/i],['summaries',/^ملخصات$|^summaries$/i],['review',/^حل أهم الأسئلة$|^key question review$/i],['workshops',/ورش العمل التطبيقية|ورشة العمل التطبيقية|\b(?:practical|applied) workshops?\b/i],['exam-eve',/ليلة الاختبار|\bexam eve\b/i]];
  const one=values=>{const keys=[...new Set(values.filter(Boolean))];return keys.length===1?keys[0]:null;};
  function contextFor(l){
    const chapter=savedLabel(c.chapters?.[l.ch]),text=labelText(l)+' '+chapter;
    const approaches=[...approachLabels.filter(([,rx])=>rx.test(text)).map(([key])=>key),approachLabels.some(([key])=>key===l.approach)?l.approach:null];
    const exactLabels=[chapter,...labelValues(l)].map(normalize);
    const phases=[...phaseLabels.filter(([,rx])=>rx.test(text)).map(([key])=>key),...publicPhases.filter(([key,ar,en])=>[key,ar,ar.replace(/^مرحلة /,''),en].some(v=>exactLabels.includes(normalize(v)))).map(([key])=>key),publicPhases.some(([key])=>key===l.phase)?l.phase:null];
    const special=one(specialLabels.filter(([,rx])=>[chapter,...labelValues(l)].some(v=>rx.test(v.trim()))).map(([key])=>key));
    return {approach:one(approaches),phase:one(phases),special,guidelines:exactLabels.some(v=>guidelineTitles.has(v)),ambiguous:new Set(approaches.filter(Boolean)).size>1||new Set(phases.filter(Boolean)).size>1};
  }
  lessons.forEach((l,i)=>{
    const item={...l,i},prior=original.get(i),route=contextFor(l);
    let target;
    if(!route.ambiguous&&route.guidelines)target=byKey.get('exam-guidelines');
    else if(!route.ambiguous&&route.special)target=byKey.get(route.special);
    else if(!route.ambiguous&&(route.approach||route.phase)){
      target=byKey.get(route.approach||'predictive');
      if(route.phase&&(!route.approach||route.approach==='predictive'))target=target.children.find(g=>g.key===route.phase);
    }else target=byKey.get(prior.key);
    if(!target)target=sourceGroup(l.ch);
    target.items.push(item);
  });
  // Keep source-only materials in their actual saved chapters, outside the
  // numbered curriculum and before its final four chapters. Playback uses this
  // same visual order; no original item is hidden, duplicated or reclassified.
  const tail=outline.findIndex(g=>g.key==='final-reviews');
  return [...outline.slice(0,tail),...sourceGroups.values(),...outline.slice(tail)];
}
function lessonItems(group){return [...group.items,...(group.children||[]).flatMap(lessonItems)];}
function videoOrder(c,lessons){return learnerGroups(c,lessons).flatMap(lessonItems).filter(l=>l.vimeo).map(l=>l.i);}
window.CourseRoadmap={pmp,groups,topics,learnerGroups,lessonItems,videoOrder};
})();
