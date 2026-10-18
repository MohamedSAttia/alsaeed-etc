/* Ordered presentation taxonomy; stored lesson chapter ids remain unchanged. */
(function(){
const pmp=[['intro','مقدمة','Introduction',/مقدم|introduction/i],['exam','هيكل اختبار PMP','PMP exam structure',/هيكل.*اختبار|exam.*structure/i],['framework','إطار عمل إدارة المشاريع','Project management framework',/إطار|framework|أسس إدارة/i],['value','نظام تسليم القيمة','Value delivery system',/تسليم القيمة|value delivery/i],['principles','مبادئ إدارة المشاريع','Project management principles',/مبادئ|principles/i],['lifecycles','دورات حياة المشروع','Project life cycles',/دور.*حياة|life.?cycle/i],['governance','الحوكمة','Governance',/حوكمة|governance/i],['scope','النطاق','Scope',/نطاق|scope|متطلبات/i],['schedule','الجدول الزمني','Schedule',/جدول|schedule/i],['cost','المالية','Finance',/مالية|تكلفة|تمويل|cost|finance/i],['resources','الموارد','Resources',/موارد|فريق|قيادة|resource|team|leadership/i],['risk','المخاطر','Risk',/مخاطر|risk/i],['stakeholders','المعنيون','Stakeholders',/معني|مصلحة|stakeholder/i],['people','مجال الأشخاص','People domain',/مجال.*(أشخاص|أفراد)|people domain/i],['process','مجال العمليات','Process domain',/مجال.*عمليات|process domain/i],['business','مجال بيئة الأعمال','Business environment domain',/مجال.*بيئة|business environment domain/i],['journey','رحلة الاجتياز','Passing journey',/اجتياز|passing journey/i],['review','حل أهم الأسئلة','Key question review',/حل.*أسئلة|question review/i]];
function groups(c,lessons){if(c.id!=='pmp')return Object.entries(lessons.reduce((m,l,i)=>{(m[l.ch]??=[]).push({...l,i});return m},{})).map(([ch,items])=>({title:c.chapters[ch]||'مقدمة',items,key:ch}));const result=pmp.map(t=>({key:t[0],title:t[1],en:t[2],items:[]})),other=new Map();lessons.forEach((l,i)=>{const title=[l.t,l.title_ar,l.title_en,l.en].filter(Boolean).join(' ');let topic=pmp.find(t=>['people','process','business','exam','review','journey'].includes(t[0])&&t[3].test(title))||pmp.find(t=>t[3].test(title));if(topic)result[pmp.indexOf(topic)].items.push({...l,i});else{const key=String(l.ch);if(!other.has(key))other.set(key,{key:'saved_'+key,title:c.chapters[l.ch]||'دروس إضافية',items:[]});other.get(key).items.push({...l,i})}});return [...result,...other.values()]}
// Shared outline labels; assessment keys and stored lesson chapters stay unchanged.
const publicLabels=Object.fromEntries(pmp.map(([key,ar,en])=>[key,{key,ar,en}]));
publicLabels.people.ar='مجال الأفراد';
const publicPhases=[['initiating','مرحلة البدء','Initiating'],['planning','مرحلة التخطيط','Planning'],['executing','مرحلة التنفيذ','Executing'],['monitoring','مرحلة المتابعة والتحكم','Monitoring & Controlling'],['closing','مرحلة الإغلاق','Closing']];
function publicPmpTopics(){
  return [
    {...publicLabels.intro,children:[{...publicLabels.journey}]},
    {...publicLabels.exam},
    {...publicLabels.framework},
    {key:'agile',ar:'النهج الرشيق',en:'Agile Approach'},
    {key:'predictive',ar:'النهج التنبؤي',en:'Predictive Approach',children:publicPhases.map(([key,ar,en])=>({key,ar,en}))},
    {key:'hybrid',ar:'النهج المختلط',en:'Hybrid Approach'},
    ...pmp.slice(13,16).map(([key])=>({...publicLabels[key]})),
    ...pmp.slice(3,6).map(([key])=>({...publicLabels[key]})),
    {key:'ai',ar:'الذكاء الاصطناعي',en:'Artificial intelligence'},
    {key:'final-reviews',ar:'المراجعات النهائية',en:'Final reviews',children:[{key:'summaries',ar:'ملخصات',en:'Summaries'},{...publicLabels.review}]},
    {key:'workshops',ar:'ورش العمل التطبيقية',en:'Practical workshops'},
    {key:'exam-eve',ar:'ليلة الاختبار',en:'Exam eve'},
    {key:'exam-guidelines',ar:'إرشادات وتعليمات الاختبار الدولي',en:'International Exam Guidelines and Instructions'}
  ];
}
function flattenTopics(nodes,depth=0,prefix=''){
  return nodes.flatMap((t,n)=>{const number=prefix?prefix+'.'+(n+1):String(n+1);return [{...t,depth,number},...flattenTopics(t.children||[],depth+1,number)];});
}
function topics(c){
  if(c.id!=='pmp')return (c.chapters||[]).slice();
  const overrides=new Map();
  for(const ch of c.chapters||[])if(ch&&typeof ch==='object'&&ch.outlineKey&&!overrides.has(ch.outlineKey))overrides.set(ch.outlineKey,ch);
  const defaults=publicPmpTopics(),known=new Set(flattenTopics(defaults).map(t=>t.key));
  const additions=(c.chapters||[]).flatMap((ch,index)=>{
    if(!ch||typeof ch!=='object'||known.has(ch.outlineKey)||isRetiredFrameworkChapter(ch)&&!ch.outlineKey)return [];
    return [{key:ch.outlineKey||'source_'+index,ar:ch.ar||ch.en,en:ch.en||ch.ar,sourceIndex:index,outlineOrder:ch.outlineOrder}];
  });
  defaults.splice(defaults.findIndex(t=>t.key==='final-reviews'),0,...additions);
  const apply=nodes=>nodes.map((t,index)=>{const saved=overrides.get(t.key)||c.chapters?.[t.sourceIndex];return {...t,ar:saved?.ar||t.ar,en:saved?.en||t.en,sortOrder:Number.isFinite(saved?.outlineOrder)?saved.outlineOrder:index,...(t.children?{children:apply(t.children)}:{})};}).sort((a,b)=>a.sortOrder-b.sortOrder);
  return apply(defaults);
}
// References are UI identities, never replacement chapter numbers. Reading the
// outline does not create or reorder persisted chapter slots.
// Retired PMP source headings are aliases, not deleted database slots. Keeping
// their indices intact preserves lesson IDs, attached content and learner progress.
function normalizedLabel(value){return String(value||'').replace(/®/g,'').replace(/\s+/g,' ').trim().toLowerCase();}
const retiredFrameworkChapters=new Set([
  'أسس إدارة المشاريع وبيئتها','أسس المشاريع','دور مدير المشروع والقيادة','دور مدير المشروع',
  'Project management foundations and environment','Project foundations',
  'Role of the project manager and leadership','Role of the project manager'
].map(normalizedLabel));
function isRetiredFrameworkChapter(ch){
  // Object chapters are explicitly authored and must override migration aliases.
  return typeof ch==='string'&&retiredFrameworkChapters.has(normalizedLabel(ch));
}
const introductionLessonTitles=new Set([
  'معهد PMI وأخلاقيات المهنة','Title: PMI and Professional Ethics','PMI and Professional Ethics',
  'شهادات PMI','The PMI Certifications','PMI Certifications',
  'استراتيجيات حل اسئلة الاختبار الحقيقي','استراتيجيات حل أسئلة الاختبار الحقيقي',
  'Strategies for Solving Any PMP Question',
  'المحاضر ومحاور البرنامج - الاصدار الثامن','Instructor and PMP outlines - 8 Edition',
  'متطلبات تقديم الاختبار الدولى والاهليه','PMP Eligibility and Application',
  'واجهة اختبار PMP وتقرير النتائج','PMP Exam Interface and Results',
  'خطة اجتياز الاختبار الحقيقي','Pass PMP Real Exam Plan'
].map(normalizedLabel));
const examStructureLessonTitles=new Set([
  'هيكل اختبار محترف ادارة المشاريع وأنواع الأسئلة','PMP Exam Structure and Question Types'
].map(normalizedLabel));
function chapterChoices(c){
  const canonical=c.id==='pmp'?flattenTopics(topics(c)).map(t=>({...t,ref:Number.isInteger(t.sourceIndex)&&!c.chapters[t.sourceIndex]?.outlineKey?'chapter:'+t.sourceIndex:'outline:'+t.key,index:t.sourceIndex,canonical:!(Number.isInteger(t.sourceIndex)&&!c.chapters[t.sourceIndex]?.outlineKey)})):[];
  const keys=new Set(canonical.map(t=>t.key));
  const saved=(c.chapters||[]).flatMap((ch,index)=>{
    if(ch&&typeof ch==='object'&&(keys.has(ch.outlineKey)||keys.has('source_'+index)))return [];
    if(c.id==='pmp'&&isRetiredFrameworkChapter(ch)&&!ch?.outlineKey)return [];
    const ar=typeof ch==='string'?ch:ch?.ar||ch?.en||'',en=typeof ch==='string'?'':ch?.en||'';
    return [{key:'source_'+index,ref:'chapter:'+index,index,ar,en,depth:0,number:String(index+1),canonical:false}];
  });
  return [...canonical,...saved];
}
function ensureChapter(c,ref){
  const choice=chapterChoices(c).find(t=>t.ref===String(ref));
  if(!choice)throw new Error('الفصل المحدد غير موجود');
  if(!choice.canonical)return choice.index;
  const index=(c.chapters||[]).findIndex(ch=>ch&&typeof ch==='object'&&ch.outlineKey===choice.key);
  if(index!==-1)return index;
  if((c.chapters||[]).length>=100)throw new Error('وصلت الدورة إلى الحد الأقصى للفصول');
  c.chapters=c.chapters||[];
  c.chapters.push({ar:choice.ar,en:choice.en,outlineKey:choice.key});
  return c.chapters.length-1;
}
function renameChapter(c,ref,ar,en){
  const choice=chapterChoices(c).find(t=>t.ref===String(ref));
  if(!choice)throw new Error('الفصل المحدد غير موجود');
  ar=String(ar||'').trim();en=String(en||'').trim();
  if(ar===choice.ar&&en===choice.en)return;
  if(!ar||ar.length>200||en.length>200)throw new Error('اسم الفصل غير صحيح');
  const index=ensureChapter(c,ref),old=c.chapters[index];
  c.chapters[index]={...(old&&typeof old==='object'?old:{}),ar,en};
}
// Persist display order on chapter metadata, never splice chapter or lesson slots.
function moveChapter(c,ref,delta){
  if(c.id!=='pmp'||![-1,1].includes(delta))return false;
  const choice=chapterChoices(c).find(t=>t.ref===ref);if(!choice)return false;
  const original=c;c={...c,chapters:(c.chapters||[]).slice()};
  if(!choice.canonical&&typeof c.chapters[choice.index]==='string')c.chapters[choice.index]={ar:c.chapters[choice.index],en:''};
  let siblings;
  const find=nodes=>{if(nodes.some(t=>t.key===choice.key)){siblings=nodes;return;}for(const t of nodes)if(t.children&&!siblings)find(t.children);};find(topics(c));
  if(!siblings)return false;
  const from=siblings.findIndex(t=>t.key===choice.key),to=from+delta;if(to<0||to>=siblings.length)return false;
  [siblings[from],siblings[to]]=[siblings[to],siblings[from]];
  const staged={...c,chapters:(c.chapters||[]).map(ch=>ch&&typeof ch==='object'?{...ch}:ch)};
  siblings.forEach((t,order)=>{const saved=chapterChoices(staged).find(ch=>ch.key===t.key);const i=ensureChapter(staged,saved.ref),old=staged.chapters[i];staged.chapters[i]={...(typeof old==='object'?old:{ar:old,en:''}),outlineOrder:order};});
  original.chapters=staged.chapters;return true;
}
function adminGroups(c,lessons){
  if(c.id!=='pmp'){
    const result=chapterChoices(c).map(t=>({...t,title:t.ar,items:[]})),byChapter=new Map(result.map(g=>[String(g.index),g]));
    lessons.forEach((l,i)=>{const key=String(l.ch||0);let group=byChapter.get(key);
      if(!group){group={key:'source_'+key,ref:null,title:'',en:'',items:[],children:[],originalChapter:true};byChapter.set(key,group);result.push(group);}
      group.items.push({...l,i});
    });
    return result;
  }
  const choices=chapterChoices(c),byKey=new Map(choices.map(t=>[t.key,t]));
  const flatten=nodes=>nodes.flatMap(g=>[{...g,ref:null,...byKey.get(g.key)},...flatten(g.children||[])]);
  const result=flatten(learnerGroups(c,lessons));
  // Old chapter names remain reachable for explicit authoring, even when all
// their existing lessons have a more specific canonical display destination.
  for(const choice of choices)if(!choice.canonical&&!result.some(g=>g.ref===choice.ref))result.push({...choice,title:choice.ar,items:[],children:[],originalChapter:true});
  return result;
}
// Presentation only. Original lessons keep their saved records, chapters and
// progress indices. A phase gets lessons only when the source identifies it.
function learnerGroups(c,lessons){
  if(c.id!=='pmp')return groups(c,lessons);
  const node=t=>({key:t.key,title:t.ar,en:t.en,sourceIndex:t.sourceIndex,items:[],children:(t.children||[]).map(node),readingKey:null,assessmentKey:null});
  const outline=topics(c).map(node),byKey=new Map();
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
  const normalize=normalizedLabel;
  // Exact published titles avoid sweeping general exam/finance/schedule topics
  // into the final instructions chapter merely because a keyword occurs.
  const guidelineTitles=new Set([
    'طريقة تعبئة طلب الاختبار الدولي','PMP Application',
    'خطوات دفع رسوم اختبار PMP','Pay for Exam Steps',
    'خطوات حجز موعد اختبار PMP','Schedule Exam Steps',
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
    return {approach:one(approaches),phase:one(phases),special,intro:exactLabels.some(v=>introductionLessonTitles.has(v)),exam:exactLabels.some(v=>examStructureLessonTitles.has(v)),guidelines:exactLabels.some(v=>guidelineTitles.has(v)),ambiguous:new Set(approaches.filter(Boolean)).size>1||new Set(phases.filter(Boolean)).size>1};
  }
  lessons.forEach((l,i)=>{
    const item={...l,i},prior=original.get(i),route=contextFor(l),explicit=c.chapters?.[l.ch]?.outlineKey;
    let target;
    if(explicit)target=byKey.get(explicit)||sourceGroup(l.ch);
    else if(c.chapters?.[l.ch]&&typeof c.chapters[l.ch]==='object'&&byKey.has('source_'+l.ch))target=byKey.get('source_'+l.ch);
    else if(route.intro)target=byKey.get('intro');
    else if(route.exam)target=byKey.get('exam');
    else if(!route.ambiguous&&route.guidelines)target=byKey.get('exam-guidelines');
    else if(!route.ambiguous&&route.special)target=byKey.get(route.special);
    else if(!route.ambiguous&&(route.approach||route.phase)){
      target=byKey.get(route.approach||'predictive');
      if(route.phase&&(!route.approach||route.approach==='predictive'))target=target.children.find(g=>g.key===route.phase);
    }else if(isRetiredFrameworkChapter(c.chapters?.[l.ch])){
      // Preserve the agreed introduction/exam/journey destinations; consolidate
      // the other materials from the two retired headings under the framework.
      target=byKey.get(prior.key==='exam'?'exam':['intro','journey'].includes(prior.key)?'intro':'framework');
    }else target=byKey.get(prior.key);
    if(!target)target=sourceGroup(l.ch);
    target.items.push(item);
  });
  // Keep source-only materials in their actual saved chapters, outside the
  // numbered curriculum and before its final four chapters. Playback uses this
  // same visual order; original records are never hidden, duplicated or rewritten.
  const tail=outline.findIndex(g=>g.key==='final-reviews');
  return [...outline.slice(0,tail),...sourceGroups.values(),...outline.slice(tail)];
}
function lessonItems(group){return [...group.items,...(group.children||[]).flatMap(lessonItems)];}
function videoGroups(c,lessons){
  const prune=nodes=>nodes.map(g=>({...g,items:g.items.filter(l=>l.vimeo),children:prune(g.children||[])})).filter(g=>g.items.length||g.children.length);
  return prune(learnerGroups(c,lessons));
}
function videoOrder(c,lessons){return videoGroups(c,lessons).flatMap(lessonItems).map(l=>l.i);}
window.CourseRoadmap={pmp,groups,topics,chapterChoices,ensureChapter,renameChapter,moveChapter,isRetiredFrameworkChapter,adminGroups,learnerGroups,lessonItems,videoGroups,videoOrder};
})();

