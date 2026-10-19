/* Stable source-slot allocation and the bounded, once-only PMP collision repair.
 * No learner/content table is rewritten: repair changes only two chapter values. */
export function chapterSlotFloor(db, course, packages = []) {
  const ids = new Set(packages.filter(p => p && p.course === course.id).map(p => p.id));
  for (const p of packages) if (p && p.course === course.id && p.sourcePackageId &&
    packages.some(source => source.id === p.sourcePackageId && source.course === course.id)) ids.add(p.sourcePackageId);
  let floor = Array.isArray(course.chapters) ? course.chapters.length : 0;
  const rows = db.prepare('SELECT chapter FROM lessons WHERE package_id=?');
  for (const id of ids) for (const row of rows.all(id)) {
    const value = row.chapter;
    // Legacy text headings, blank values and negatives are not numeric slots.
    if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value))) continue;
    const index = Number(value);
    if (Number.isSafeInteger(index) && index >= 0) floor = Math.max(floor, index + 1);
  }
  return floor;
}

export function validChapterAllocation(db, previous, next, packages) {
  if (previous.id !== 'pmp') return true;
  const old = Array.isArray(previous.chapters) ? previous.chapters : [];
  const chapters = Array.isArray(next.chapters) ? next.chapters : [];
  const floor = chapterSlotFloor(db, previous, packages);
  // Stable source slots cannot disappear or change canonical identity in a stale save.
  if (old.some((ch, index) => ch != null && (chapters[index] == null ||
      ch && typeof ch === 'object' && ch.outlineKey && chapters[index]?.outlineKey !== ch.outlineKey))) return false;
  // A reserved/orphan slot can never silently acquire a new authored identity.
  return chapters.every((ch, index) => ch == null || old[index] != null || index >= floor);
}

export const PMP_COLLISION_REPAIR_KEY = 'migration_pmp_intro_slot_collision_v1';
const fingerprints = [
  {idx:33,title:'المهمة الثالثة : المساعدة على ضمان التسليم القائم على القيمة Help Ensure Value-Based Delivery',title_en:'',duration:'16:16'},
  {idx:34,title:'المهمة الخامسة : تخطيط وإدارة المشتريات Plan and Manage Procurement',title_en:'',duration:'43:52'}
];
const matches = (row, fingerprint, chapter) => row && row.package_id === 'pmp-full' && row.idx === fingerprint.idx &&
  row.chapter === chapter && ['title','title_en','duration'].every(key => row[key] === fingerprint[key]);
const parseList = value => { try { const list=JSON.parse(value || '[]'); return Array.isArray(list) ? list : []; } catch { return []; } };

export function repairPmpIntroCollision({db, setting, setSetting}) {
  return db.transaction(() => {
    if (setting(PMP_COLLISION_REPAIR_KEY)) return {status:'already-evaluated'};
    const courses=parseList(setting('content_courses')), packages=parseList(setting('content_packages'));
    const course=courses.find(c=>c.id==='pmp'), intro=course?.chapters?.[11];
    const rows=fingerprints.map(fp=>db.prepare('SELECT * FROM lessons WHERE package_id=? AND idx=?').get('pmp-full',fp.idx));
    const record={version:1,packageId:'pmp-full',evaluatedAt:Date.now(),status:'skipped'};
    // Empty/redacted public media, files and quiz were never part of the evidence.
    // They are deliberately neither compared nor rewritten here.
    if (!packages.some(p=>p.id==='pmp-full'&&p.course==='pmp') || !intro || typeof intro!=='object' ||
        intro.outlineKey!=='intro' || !fingerprints.every((fp,i)=>matches(rows[i],fp,11))) {
      record.reason='fingerprint-mismatch'; setSetting(PMP_COLLISION_REPAIR_KEY,JSON.stringify(record)); return record;
    }
    const chapters=course.chapters.slice();
    let target=chapters.findIndex(ch=>ch&&typeof ch==='object'&&ch.outlineKey==='process');
    const appended=target<0;
    if (appended) {
      target=chapterSlotFloor(db,course,packages);
      if (target>=100) {
        record.reason='chapter-capacity'; setSetting(PMP_COLLISION_REPAIR_KEY,JSON.stringify(record)); return record;
      }
      while(chapters.length<target) chapters.push(null);
      chapters.push({ar:'مجال العمليات',en:'Process domain',outlineKey:'process'});
    }
    // Preserve an existing explicit canonical destination, including its metadata.
    const update=db.prepare('UPDATE lessons SET chapter=? WHERE package_id=? AND idx=?');
    for (const fp of fingerprints) update.run(target,'pmp-full',fp.idx);
    if(appended) { course.chapters=chapters; setSetting('content_courses',JSON.stringify(courses)); }
    Object.assign(record,{status:'applied',destination:target,createdDestination:appended,
      changes:fingerprints.map(fp=>({...fp,before:11,after:target}))});
    setSetting(PMP_COLLISION_REPAIR_KEY,JSON.stringify(record));
    return record;
  })();
}

// Deliberate operator-only reversal helper; never invoked at startup or exposed by an API.
// Refuse reversal if a later edit no longer matches; keep chapter metadata for other users.
export function reversePmpIntroCollision({db, setting, setSetting}) {
  return db.transaction(() => {
    let record; try { record=JSON.parse(setting(PMP_COLLISION_REPAIR_KEY)||'null'); } catch {}
    if(record?.status!=='applied')return {status:'not-applied'};
    const rows=fingerprints.map(fp=>db.prepare('SELECT * FROM lessons WHERE package_id=? AND idx=?').get('pmp-full',fp.idx));
    if(!fingerprints.every((fp,i)=>matches(rows[i],fp,record.destination)))return {status:'changed-since-repair'};
    for(const fp of fingerprints)db.prepare('UPDATE lessons SET chapter=? WHERE package_id=? AND idx=?').run(11,'pmp-full',fp.idx);
    record.status='reversed';record.reversedAt=Date.now();setSetting(PMP_COLLISION_REPAIR_KEY,JSON.stringify(record));return record;
  })();
}

export const PMP_QUALITY_ORDER_KEY = 'migration_pmp_quality_before_scope_v1';
const qualityOrderFingerprints = [
  {idx:45,title:'التحقق من النطاق',title_en:'Validate Scope',duration:'4:06',after:46},
  {idx:46,title:'التحكم بالجودة',title_en:'Quality Control',duration:'',after:45}
];
const matchesQualityPair = (row, fp) => row && row.package_id==='pmp-full' && row.idx===fp.idx &&
  row.chapter===16 && ['title','title_en','duration'].every(key=>row[key]===fp[key]);
export function repairPmpQualityOrder({db, setting, setSetting}) {
  return db.transaction(()=>{
    if(setting(PMP_QUALITY_ORDER_KEY))return {status:'already-evaluated'};
    const courses=parseList(setting('content_courses')),packages=parseList(setting('content_packages'));
    const chapter=courses.find(c=>c.id==='pmp')?.chapters?.[16];
    const rows=qualityOrderFingerprints.map(fp=>db.prepare('SELECT * FROM lessons WHERE package_id=? AND idx=?').get('pmp-full',fp.idx));
    const siblings=db.prepare('SELECT display_order FROM lessons WHERE package_id=? AND chapter=?').all('pmp-full',16);
    const record={version:1,packageId:'pmp-full',evaluatedAt:Date.now(),status:'skipped'};
    if(!packages.some(p=>p.id==='pmp-full'&&p.course==='pmp') || chapter?.outlineKey!=='monitoring' ||
       !qualityOrderFingerprints.every((fp,i)=>matchesQualityPair(rows[i],fp)) || siblings.some(row=>row.display_order!==null)) {
      record.reason='fingerprint-or-order-mismatch';setSetting(PMP_QUALITY_ORDER_KEY,JSON.stringify(record));return record;
    }
    for(const fp of qualityOrderFingerprints)db.prepare('UPDATE lessons SET display_order=? WHERE package_id=? AND idx=?').run(fp.after,'pmp-full',fp.idx);
    Object.assign(record,{status:'applied',changes:qualityOrderFingerprints.map(fp=>({...fp,before:null}))});
    setSetting(PMP_QUALITY_ORDER_KEY,JSON.stringify(record));return record;
  })();
}
export function reversePmpQualityOrder({db, setting, setSetting}) {
  return db.transaction(()=>{
    let record;try{record=JSON.parse(setting(PMP_QUALITY_ORDER_KEY)||'null');}catch{}
    if(record?.status!=='applied')return {status:'not-applied'};
    const rows=qualityOrderFingerprints.map(fp=>db.prepare('SELECT * FROM lessons WHERE package_id=? AND idx=?').get('pmp-full',fp.idx));
    if(!qualityOrderFingerprints.every((fp,i)=>matchesQualityPair(rows[i],fp)&&rows[i].display_order===fp.after))return {status:'changed-since-repair'};
    for(const fp of qualityOrderFingerprints)db.prepare('UPDATE lessons SET display_order=NULL WHERE package_id=? AND idx=?').run('pmp-full',fp.idx);
    record.status='reversed';record.reversedAt=Date.now();setSetting(PMP_QUALITY_ORDER_KEY,JSON.stringify(record));return record;
  })();
}
