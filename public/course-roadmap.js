/* Ordered presentation taxonomy; stored lesson chapter ids remain unchanged. */
(function(){
const pmp=[['intro','مقدمة','Introduction',/مقدم|introduction/i],['exam','هيكل اختبار PMP','PMP exam structure',/هيكل.*اختبار|exam.*structure/i],['framework','إطار عمل إدارة المشاريع','Project management framework',/إطار|framework|أسس إدارة/i],['value','نظام تسليم القيمة','Value delivery system',/تسليم القيمة|value delivery/i],['principles','مبادئ إدارة المشاريع','Project management principles',/مبادئ|principles/i],['lifecycles','دورات حياة المشروع','Project life cycles',/دور.*حياة|life.?cycle/i],['governance','الحوكمة','Governance',/حوكمة|governance/i],['scope','النطاق','Scope',/نطاق|scope|متطلبات/i],['schedule','الجدول الزمني','Schedule',/جدول|schedule/i],['cost','المالية','Finance',/مالية|تكلفة|تمويل|cost|finance/i],['resources','الموارد','Resources',/موارد|فريق|قيادة|resource|team|leadership/i],['risk','المخاطر','Risk',/مخاطر|risk/i],['stakeholders','المعنيون','Stakeholders',/معني|مصلحة|stakeholder/i],['people','مجال الأشخاص','People domain',/مجال.*(أشخاص|أفراد)|people domain/i],['process','مجال العمليات','Process domain',/مجال.*عمليات|process domain/i],['business','مجال بيئة الأعمال','Business environment domain',/مجال.*بيئة|business environment domain/i],['journey','رحلة الاجتياز','Passing journey',/اجتياز|passing journey/i],['review','حل أهم الأسئلة','Key question review',/حل.*أسئلة|question review/i]];
const validLessonOrder=value=>Number.isSafeInteger(value)&&value>=0&&value<=1000000;
function orderedItems(items){return items.filter(l=>!l.deleted).slice().sort((a,b)=>(validLessonOrder(a.displayOrder)?a.displayOrder:a.i)-(validLessonOrder(b.displayOrder)?b.displayOrder:b.i)||a.i-b.i);}
function orderGroups(nodes){return nodes.map(g=>({...g,items:orderedItems(g.items),...(g.children?{children:orderGroups(g.children)}:{})}));}
function groups(c,lessons){if(c.id!=='pmp')return orderGroups(Object.entries(lessons.reduce((m,l,i)=>{(m[l.ch]??=[]).push({...l,i});return m},{})).map(([ch,items])=>({title:c.chapters[ch]&&typeof c.chapters[ch]==='object'?(c.chapters[ch].ar||c.chapters[ch].en):c.chapters[ch]||'مقدمة',en:c.chapters[ch]&&typeof c.chapters[ch]==='object'?c.chapters[ch].en:'',items,key:ch})));const result=pmp.map(t=>({key:t[0],title:t[1],en:t[2],items:[]})),other=new Map();lessons.forEach((l,i)=>{if(l.deleted)return;const title=[l.t,l.title_ar,l.title_en,l.en].filter(Boolean).join(' ');let topic=pmp.find(t=>['people','process','business','exam','review','journey'].includes(t[0])&&t[3].test(title))||pmp.find(t=>t[3].test(title));if(topic)result[pmp.indexOf(topic)].items.push({...l,i});else{const key=String(l.ch);if(!other.has(key))other.set(key,{key:'saved_'+key,title:c.chapters[l.ch]||'دروس إضافية',items:[]});other.get(key).items.push({...l,i})}});return orderGroups([...result,...other.values()])}
// Shared outline labels; assessment keys and stored lesson chapters stay unchanged.
const publicLabels=Object.fromEntries(pmp.map(([key,ar,en])=>[key,{key,ar,en}]));
publicLabels.people.ar='مجال الأفراد';
const publicPhases=[['initiating','مرحلة البدء','Initiating'],['planning','مرحلة التخطيط','Planning'],['executing','مرحلة التنفيذ','Executing'],['monitoring','مرحلة المتابعة والتحكم','Monitoring & Controlling'],['closing','مرحلة الإغلاق','Closing']];
function publicPmpTopics(){
  return [
    {...publicLabels.intro,children:[{...publicLabels.exam},{...publicLabels.journey}]},
    {...publicLabels.framework,children:pmp.slice(3,6).map(([key])=>({...publicLabels[key]}))},
    {key:'agile',ar:'النهج الرشيق',en:'Agile Approach'},
    {key:'predictive',ar:'النهج التنبؤي',en:'Predictive Approach',children:publicPhases.map(([key,ar,en])=>({key,ar,en}))},
    {key:'hybrid',ar:'النهج المختلط',en:'Hybrid Approach'},
    ...pmp.slice(13,16).map(([key])=>({...publicLabels[key]})),
    {key:'ai',ar:'الذكاء الاصطناعي',en:'Artificial intelligence'},
    {key:'final-reviews',ar:'المراجعات النهائية',en:'Final reviews',children:[{key:'summaries',ar:'ملخصات',en:'Summaries'},{...publicLabels.review}]},
    {key:'workshops',ar:'ورش العمل التطبيقية',en:'Practical workshops'},
    {key:'exam-guidelines',ar:'إرشادات وتعليمات الاختبار الدولي',en:'International Exam Guidelines and Instructions'},
    {key:'exam-eve',ar:'ليلة الاختبار',en:'Exam eve'}
  ];
}
function flattenTopics(nodes,depth=0,prefix=''){
  return nodes.flatMap((t,n)=>{const number=prefix?prefix+'.'+(n+1):String(n+1);return [{...t,depth,number},...flattenTopics(t.children||[],depth+1,number)];});
}
// A missing parent inherits the default; an explicit null promotes a node to the root.
// Invalid imported metadata is rendered conservatively without repairing stored data.
const validOutlineKey=key=>typeof key==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(key);
const validOutlineOrder=order=>Number.isInteger(order)&&order>=0&&order<=10000;
function topics(c){
  if(c.id!=='pmp')return (c.chapters||[]).slice();
  const chapters=Array.isArray(c.chapters)?c.chapters:[],defaults=publicPmpTopics(),nodes=new Map(),overrides=new Map();
  for(const ch of chapters)if(ch&&typeof ch==='object'&&!Array.isArray(ch)&&validOutlineKey(ch.outlineKey)&&!overrides.has(ch.outlineKey))overrides.set(ch.outlineKey,ch);
  function collect(items,parentKey=null){items.forEach((t,index)=>{const {children,...base}=t;nodes.set(t.key,{...base,parentKey,defaultParent:parentKey,defaultOrder:index});if(children)collect(children,t.key);});}
  collect(defaults);
  // Explicit object additions are public. A referenced legacy string parent is
  // also projected, while untouched legacy source headings remain fallback-only.
  const referenced=new Set(chapters.filter(ch=>ch&&typeof ch==='object').map(ch=>ch.outlineParent));
  const additions=[];
  chapters.forEach((ch,index)=>{
    if(!ch||typeof ch!=='object'&&!(typeof ch==='string'&&referenced.has('source_'+index)))return;
    if(Array.isArray(ch))return;
    const key=validOutlineKey(ch.outlineKey)?ch.outlineKey:'source_'+index;
    if(nodes.has(key))return;
    const ar=typeof ch==='string'?ch:ch.ar||ch.en||'',en=typeof ch==='string'?'':ch.en||ch.ar||'';
    nodes.set(key,{key,ar,en,sourceIndex:index,parentKey:null,defaultParent:null});additions.push(key);
  });
  const roots=defaults.map(t=>t.key),tail=roots.indexOf('final-reviews');
  roots.splice(tail<0?roots.length:tail,0,...additions);
  roots.forEach((key,index)=>{nodes.get(key).defaultOrder=index;});
  for(const node of nodes.values()){
    const saved=overrides.get(node.key)||chapters[node.sourceIndex];
    if(saved&&typeof saved==='object'){
      if(typeof saved.ar==='string'&&saved.ar)node.ar=saved.ar;
      if(typeof saved.en==='string'&&saved.en)node.en=saved.en;
      if(Object.hasOwn(saved,'outlineParent')){
        const parent=saved.outlineParent;
        if(parent===null||typeof parent==='string'&&nodes.has(parent)&&parent!==node.key)node.parentKey=parent;
      }
    }
    node.sortOrder=validOutlineOrder(saved?.outlineOrder)?saved.outlineOrder:node.defaultOrder;
  }
  // Detach only actual cycle members. Descendants still remain reachable once.
  for(const node of nodes.values()){
    const path=[],seen=new Map();let key=node.key;
    while(key!==null&&nodes.has(key)){
      if(seen.has(key)){for(const cyclic of path.slice(seen.get(key)))nodes.get(cyclic).parentKey=null;break;}
      seen.set(key,path.length);path.push(key);key=nodes.get(key).parentKey;
    }
  }
  const children=new Map([[null,[]]]);
  for(const node of nodes.values()){
    if(!children.has(node.parentKey))children.set(node.parentKey,[]);
    children.get(node.parentKey).push(node);
  }
  const build=parent=>(children.get(parent)||[]).sort((a,b)=>a.sortOrder-b.sortOrder).map(node=>{
    const {defaultParent,defaultOrder,...out}=node,descendants=build(node.key);
    if(descendants.length)out.children=descendants;
    return out;
  });
  return build(null);
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
  const canonical=c.id==='pmp'?flattenTopics(topics(c)).map(t=>({...t,ref:Number.isInteger(t.sourceIndex)&&!validOutlineKey(c.chapters[t.sourceIndex]?.outlineKey)?'chapter:'+t.sourceIndex:'outline:'+t.key,index:t.sourceIndex,canonical:!(Number.isInteger(t.sourceIndex)&&!validOutlineKey(c.chapters[t.sourceIndex]?.outlineKey))})):[];
  const keys=new Set(canonical.map(t=>t.key)),refs=new Map(canonical.map(t=>[t.key,t.ref]));
  const saved=(c.chapters||[]).flatMap((ch,index)=>{
    if(ch==null)return [];
    if(keys.has('source_'+index)||ch&&typeof ch==='object'&&keys.has(ch.outlineKey))return [];
    if(c.id==='pmp'&&isRetiredFrameworkChapter(ch))return [];
    const ar=typeof ch==='string'?ch:ch?.ar||ch?.en||'',en=typeof ch==='string'?'':ch?.en||'';
    return [{key:'source_'+index,ref:'chapter:'+index,index,ar,en,depth:0,number:String(index+1),canonical:false,parentKey:null,parentRef:null}];
  });
  return [...canonical.map(t=>({...t,parentRef:t.parentKey===null?null:refs.get(t.parentKey)||null})),...saved];
}
function parentChoices(c,ref){
  if(c.id!=='pmp')return [];
  const choices=chapterChoices(c),choice=choices.find(t=>t.ref===ref||t.key===ref);
  const tree=topics(c),node=flattenTopics(tree).find(t=>t.key===choice?.key),excluded=new Set(node?flattenTopics([node]).map(t=>t.key):[]);
  if(choice)excluded.add(choice.key);
  const current=choice?.parentKey??null;
  const eligible=choices.filter(t=>!excluded.has(t.key));
  return [{ref:null,key:null,ar:'فصل رئيسي',en:'Main heading',selected:current===null},...eligible.map(t=>({...t,selected:t.key===current}))];
}
function reserveChapterSlots(c){
  const floor=c.id==='pmp'&&Number.isSafeInteger(c.chapterSlotFloor)&&c.chapterSlotFloor>=0?c.chapterSlotFloor:0;
  if(Math.max((c.chapters||[]).length,floor)>=100)throw new Error('وصلت الدورة إلى الحد الأقصى للفصول');
  c.chapters=c.chapters||[];
  while(c.chapters.length<floor)c.chapters.push(null);
}
function ensureChapter(c,ref){
  const choice=chapterChoices(c).find(t=>t.ref===String(ref));
  if(!choice)throw new Error('الفصل المحدد غير موجود');
  if(!choice.canonical)return choice.index;
  const index=(c.chapters||[]).findIndex(ch=>ch&&typeof ch==='object'&&ch.outlineKey===choice.key);
  if(index!==-1)return index;
  reserveChapterSlots(c);
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
// Change presentation hierarchy in a staging copy; slot IDs and lessons never move.
function reparentChapter(c,ref,parentRef){
  if(c.id!=='pmp')return false;
  const choices=chapterChoices(c),choice=choices.find(t=>t.ref===ref||t.key===ref);
  if(!choice)throw new Error('الفصل المحدد غير موجود');
  const root=parentRef===null||parentRef==='';
  const parent=root?null:choices.find(t=>t.ref===parentRef||t.key===parentRef);
  if(!root&&!parent)throw new Error('الفصل الرئيسي المحدد غير موجود');
  const parentKey=parent?.key??null;
  const current=flattenTopics(topics(c)).find(t=>t.key===choice.key);
  if(parentKey===choice.key||current&&flattenTopics([current]).some(t=>t.key===parentKey))throw new Error('لا يمكن نقل الفصل داخل نفسه أو أحد فروعه');
  if(current&&current.parentKey===parentKey)return false;
  const staged={...c,chapters:(c.chapters||[]).map(ch=>ch&&typeof ch==='object'?{...ch}:ch)};
  const materialize=item=>{
    const i=ensureChapter(staged,item.ref),old=staged.chapters[i];
    if(typeof old==='string')staged.chapters[i]={ar:old,en:''};
    return i;
  };
  const index=materialize(choice);
  if(parent)materialize(parent);
  const before=topics(staged),target=parentKey===null?before:flattenTopics(before).find(t=>t.key===parentKey)?.children||[];
  const order=target.filter(t=>t.key!==choice.key).map(t=>t.key).concat(choice.key);
  staged.chapters[index]={...staged.chapters[index],outlineParent:parentKey};
  // Persist destination sibling ordering as a unit, including previously virtual headings.
  for(const [position,key] of order.entries()){
    const item=chapterChoices(staged).find(t=>t.key===key),i=ensureChapter(staged,item.ref),old=staged.chapters[i];
    staged.chapters[i]={...(typeof old==='object'?old:{ar:old,en:''}),outlineOrder:position};
  }
  c.chapters=staged.chapters;return true;
}
function adminGroups(c,lessons){
  if(c.id!=='pmp'){
    const result=chapterChoices(c).map(t=>({...t,title:t.ar,items:[]})),byChapter=new Map(result.map(g=>[String(g.index),g]));
    lessons.forEach((l,i)=>{if(l.deleted)return;const key=String(l.ch||0);let group=byChapter.get(key);
      if(!group){group={key:'source_'+key,ref:null,title:'',en:'',items:[],children:[],originalChapter:true};byChapter.set(key,group);result.push(group);}
      group.items.push({...l,i});
    });
    return orderGroups(result);
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
  // Latest published presentation order does not mutate authored chapter slots.
  const primary=['intro','framework','agile','predictive','hybrid','people','process','business','ai','final-reviews','workshops','exam-guidelines','exam-eve'];
  const foundations=['value','principles','lifecycles'],phases=publicPhases.map(([key])=>key),fixed=new Set([...primary,...foundations,...phases]);
  // Detach all fixed identities first, including nested saved overrides, so a
  // formerly inverted parent relationship can never introduce a display cycle.
  const strip=nodes=>nodes.filter(g=>{g.children=strip(g.children);return !fixed.has(g.key);});
  const extras=strip(outline);
  byKey.get('framework').children.push(...foundations.map(key=>byKey.get(key)).filter(Boolean));
  byKey.get('predictive').children.push(...phases.map(key=>byKey.get(key)).filter(Boolean));
  outline.splice(0,outline.length,...primary.map(key=>byKey.get(key)).filter(Boolean));
  if(extras.length)outline.splice(Math.max(0,outline.findIndex(g=>g.key==='final-reviews')),0,{key:'additional-topics',title:'محاور إضافية محفوظة',en:'Additional saved topics',items:[],children:extras});
  const legacy=groups(c,lessons),original=new Map(),sourceGroups=new Map();
  const savedLabel=ch=>typeof ch==='string'?ch:ch?[ch.ar,ch.en].filter(Boolean).join(' '):'';
  function sourceGroup(ch){
    const key=String(ch);
    if(byKey.has('source_'+key))return byKey.get('source_'+key);
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
  lessons.forEach((l,i)=>{if(l.deleted)return;
    const item={...l,i},prior=original.get(i),route=contextFor(l),explicit=c.chapters?.[l.ch]?.outlineKey;
    let target;
    if(explicit)target=byKey.get(explicit)||byKey.get('source_'+l.ch)||sourceGroup(l.ch);
    else if(byKey.has('source_'+l.ch))target=byKey.get('source_'+l.ch);
    else if(route.intro)target=byKey.get('intro');
    else if(route.exam)target=byKey.get('exam');
    else if(!route.ambiguous&&route.guidelines)target=byKey.get('exam-guidelines');
    else if(!route.ambiguous&&route.special)target=byKey.get(route.special);
    else if(!route.ambiguous&&(route.approach||route.phase)){
      target=byKey.get(route.approach||'predictive');
      if(route.phase&&(!route.approach||route.approach==='predictive'))target=byKey.get(route.phase);
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
  const end=outline.findIndex(g=>['final-reviews','workshops','exam-eve','exam-guidelines'].includes(g.key)),tail=end<0?outline.length:end;
  const additional=[...sourceGroups.values()];
  return orderGroups([...outline.slice(0,tail),...(additional.length?[{key:'additional-materials',title:'مواد إضافية محفوظة',en:'Additional saved materials',items:[],children:additional}]:[]),...outline.slice(tail)]);
}
// Only presentation ranks change. Never splice lesson records or their progress keys.
// Rank every sibling together so repeated moves, ties and sparse legacy slots are deterministic.
function moveLesson(c,lessons,index,delta){
  if(!Number.isSafeInteger(index)||!lessons[index]||![-1,1].includes(delta))return false;
  const siblings=adminGroups(c,lessons).find(g=>g.items.some(l=>l.i===index))?.items;
  if(!siblings)return false;
  const from=siblings.findIndex(l=>l.i===index),to=from+delta;
  if(to<0||to>=siblings.length)return false;
  const order=siblings.map(l=>l.i);[order[from],order[to]]=[order[to],order[from]];
  order.forEach((i,position)=>{
    if(!Object.hasOwn(lessons[i],'displayOrderBase'))lessons[i].displayOrderBase=validLessonOrder(lessons[i].displayOrder)?lessons[i].displayOrder:null;
    lessons[i].displayOrder=position;
  });
  return true;
}
function lessonItems(group){return [...group.items,...(group.children||[]).flatMap(lessonItems)];}
function videoGroups(c,lessons){
  const prune=nodes=>nodes.map(g=>({...g,items:g.items.filter(l=>l.vimeo),children:prune(g.children||[])})).filter(g=>g.items.length||g.children.length);
  return prune(learnerGroups(c,lessons));
}
function videoOrder(c,lessons){return videoGroups(c,lessons).flatMap(lessonItems).map(l=>l.i);}
function assessmentOutline(c){
  if(c.id!=='pmp')return {chapters:[],domains:[],mocks:[]};
  const canonical=flattenTopics(publicPmpTopics()),get=key=>{const x=canonical.find(t=>t.key===key);return {key,ar:x.ar,en:x.en};};
  return {chapters:['framework','agile','predictive','hybrid'].map(get),domains:['people','process','business'].map(get),mocks:[1,2,3,4,5].map(number=>({key:'mock_'+number,number,ar:'محاكاة كاملة '+number,en:'Full mock '+number}))};
}
(typeof window!=='undefined'?window:globalThis).CourseRoadmap={assessmentOutline,pmp,groups,validLessonOrder,orderedItems,moveLesson,topics,chapterChoices,reserveChapterSlots,ensureChapter,renameChapter,moveChapter,reparentChapter,parentChoices,isRetiredFrameworkChapter,adminGroups,learnerGroups,lessonItems,videoGroups,videoOrder};
})();

