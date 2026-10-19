/** Actual SQLite, API handlers and projection; synthetic fixtures only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {chapterSlotFloor,validChapterAllocation,repairPmpIntroCollision,reversePmpIntroCollision,PMP_COLLISION_REPAIR_KEY,repairPmpQualityOrder,reversePmpQualityOrder,PMP_QUALITY_ORDER_KEY} from '../curriculum-slots.js';
let Database;
try {
 const {DatabaseSync}=await import('node:sqlite');
 Database=class {
  constructor(){this.db=new DatabaseSync(':memory:');}
  exec(sql){return this.db.exec(sql);}prepare(sql){return this.db.prepare(sql);}
  transaction(fn){return(...args)=>{this.exec('BEGIN');try{const out=fn(...args);this.exec('COMMIT');return out;}catch(e){this.exec('ROLLBACK');throw e;}};}
  close(){this.db.close();}
 };
} catch {({default:Database}=await import('better-sqlite3'));}
const clone=x=>JSON.parse(JSON.stringify(x)),box={window:{}};
vm.runInNewContext(fs.readFileSync('public/course-roadmap.js','utf8'),box);
const R=box.window.CourseRoadmap;
const fingerprints=[
 {idx:33,title:'المهمة الثالثة : المساعدة على ضمان التسليم القائم على القيمة Help Ensure Value-Based Delivery',duration:'16:16'},
 {idx:34,title:'المهمة الخامسة : تخطيط وإدارة المشتريات Plan and Manage Procurement',duration:'43:52'}
];
function fixture(){
 const db=new Database(':memory:');
 db.exec(`CREATE TABLE settings(k TEXT PRIMARY KEY,v TEXT);CREATE TABLE lessons(package_id TEXT,idx INTEGER,title TEXT,title_en TEXT,chapter INTEGER,duration TEXT,vimeo TEXT,notes TEXT,notes_en TEXT,files TEXT,quiz TEXT,display_order INTEGER,PRIMARY KEY(package_id,idx));CREATE TABLE progress(user_id TEXT,package_id TEXT,data TEXT);`);
 const setting=k=>db.prepare('SELECT v FROM settings WHERE k=?').get(k)?.v||'';
 const setSetting=(k,v)=>db.prepare('INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k,v);
 const chapters=Array.from({length:18},(_,i)=>i===11?{ar:'مقدمة',en:'Introduction',outlineKey:'intro'}:i===16?{ar:'متابعة',en:'Monitoring',outlineKey:'monitoring'}:i===17?{ar:'تنفيذ',en:'Executing',outlineKey:'executing'}:'Legacy '+i);
 setSetting('content_courses',JSON.stringify([{id:'pmp',chapters},{id:'rmp',chapters:['RMP']}])) ;
 setSetting('content_packages',JSON.stringify([{id:'pmp-full',course:'pmp'},{id:'pmp-hidden',course:'pmp',active:false},{id:'pmp-en',course:'pmp',sourcePackageId:'pmp-full'},{id:'rmp-full',course:'rmp'}]));
 const insert=db.prepare('INSERT INTO lessons VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
 for(let i=0;i<54;i++) {const fp=fingerprints.find(x=>x.idx===i);insert.run('pmp-full',i,fp?.title||'Lesson '+i,'',fp||i<8?11:i===53?17:0,fp?.duration||'1:00','secret-vimeo-'+i,'Notes '+i,'EN notes '+i,JSON.stringify([{id:'file-'+i}]),JSON.stringify([{q:'Quiz '+i}]),i%3?null:100-i);}
 insert.run('pmp-hidden',0,'Hidden','','70','1:00','hidden','note','en','[]','[]',null);
 insert.run('rmp-full',0,'Other','',95,'1:00','other','note','en','[]','[]',null);
 db.prepare('INSERT INTO progress VALUES(?,?,?)').run('student','pmp-full',JSON.stringify({lessons:{33:true,34:false,53:true},notes:{33:'private'},quiz:{34:90}}));
 return {db,setting,setSetting,courses:()=>JSON.parse(setting('content_courses')),packages:()=>JSON.parse(setting('content_packages'))};
}
const all=f=>clone(f.db.prepare('SELECT * FROM lessons ORDER BY package_id,idx').all());
const progress=f=>clone(f.db.prepare('SELECT * FROM progress').all());
const f=fixture(),pmp=f.courses()[0];
assert.equal(chapterSlotFloor(f.db,pmp,f.packages()),71,'Hidden same-course orphan reserves slot 70; other course 95 ignored');
assert.equal(chapterSlotFloor(f.db,f.courses()[1],f.packages()),96);
const staged={...pmp,chapterSlotFloor:71,chapters:clone(pmp.chapters)};
assert.equal(R.ensureChapter(staged,'outline:process'),71);assert.equal(staged.chapters[70],null);
assert(!R.chapterChoices(staged).some(c=>c.index===70),'Reservation is not an authored heading');
assert.equal(R.chapterChoices(staged).length,R.chapterChoices(pmp).length,'Only canonical materialization, no fake headings');
assert(!R.parentChoices({id:'pmp',chapters:['Legacy']},'chapter:0').some(c=>c.ref==='chapter:0'),'Unprojected legacy self excluded');
const hiddenBefore=all(f).find(row=>row.package_id==='pmp-hidden');
assert.equal(validChapterAllocation(f.db,pmp,staged,f.packages()),true);
assert.equal(validChapterAllocation(f.db,pmp,{chapters:[...pmp.chapters,{ar:'Unsafe',en:'Unsafe'}]},f.packages()),false);
const server=fs.readFileSync('server.js','utf8'),handlers=new Map(),start=server.indexOf('function validCourseChapterKeys('),end=server.indexOf('/* ═══════════ عام',start);
vm.runInNewContext(server.slice(start,end),{db:f.db,setting:f.setting,setSetting:f.setSetting,chapterSlotFloor,validChapterAllocation,app:{put:(path,...fns)=>handlers.set(path,fns.at(-1))},auth(){},admin(){},validatePackageInstructors(){},readList:k=>JSON.parse(f.setting(k)||'[]')});
function put(chapters,whole=false){let status=200,result;handlers.get(whole?'/api/admin/content':'/api/admin/course-chapters/:course')({params:{course:'pmp'},body:whole?{cms:{changed:true},courses:[{...pmp,chapters}]}:{chapters}},{status(n){status=n;return this;},json(data){result=data;return this;}});return{status,result};}
f.db.prepare('UPDATE lessons SET chapter=80 WHERE package_id=?').run('pmp-hidden');
for(const whole of [false,true]){const before=f.setting('content_courses');assert.equal(put(staged.chapters,whole).status,409,'Stale cross-package floor rejected');assert.equal(f.setting('content_courses'),before);assert.equal(f.setting('content_cms'),'','No partial whole-content write');}
const fresh={...pmp,chapterSlotFloor:81,chapters:clone(pmp.chapters)};R.ensureChapter(fresh,'outline:process');
assert.equal(put(fresh.chapters).status,200);assert.equal(f.courses()[0].chapterSlotFloor,undefined,'Server-computed floor is not persisted input');
assert.equal(f.courses()[0].chapters[80],null);
// Existing reserved slot must not be silently assigned later, even if floor is forged.
const collision=clone(fresh.chapters);collision[80]={ar:'Capture orphan',en:'Unsafe'};
assert.equal(put(collision).status,409);assert.equal(put(collision,true).status,409);
assert.equal(put([...fresh.chapters,{ar:'Safe',en:'Safe'}],true).status,200);
assert.equal(f.db.prepare('SELECT chapter FROM lessons WHERE package_id=?').get('rmp-full').chapter,95);
f.db.close();

// Repair is exact, one-time and only changes chapter. Existing intro/new lesson remain intact.
for(const existingProcess of [false,true]){
 const f=fixture();if(existingProcess){const courses=f.courses();courses[0].chapters[4]={ar:'عمليات مخصصة',en:'Custom process',outlineKey:'process',outlineOrder:5,custom:{keep:true}};f.setSetting('content_courses',JSON.stringify(courses));}
 const before=all(f),beforeProgress=progress(f),r=repairPmpIntroCollision(f),target=existingProcess?4:71;
 assert.equal(r.status,'applied');assert.equal(r.destination,target);
 assert.deepEqual(all(f),before.map(row=>row.package_id==='pmp-full'&&[33,34].includes(row.idx)?{...row,chapter:target}:row),'Every other persisted field and all other rows remain byte-for-byte intact');
 assert.deepEqual(progress(f),beforeProgress);assert.equal(f.courses()[0].chapters[11].outlineKey,'intro');
 assert.equal(f.courses()[0].chapters[target].outlineKey,'process');
 const projected=R.learnerGroups(f.courses()[0],all(f).filter(row=>row.package_id==='pmp-full').map(row=>({ch:row.chapter,t:row.title,vimeo:row.vimeo})));
 const flatten=nodes=>nodes.flatMap(n=>[n,...flatten(n.children||[])]);
 assert.deepEqual(Array.from(flatten(projected).find(n=>n.key==='process').items,x=>x.i).filter(i=>[33,34].includes(i)),[33,34]);
 assert.equal(repairPmpIntroCollision(f).status,'already-evaluated');
 if(existingProcess){f.db.prepare('UPDATE lessons SET chapter=11 WHERE package_id=? AND idx=?').run('pmp-full',33);assert.equal(repairPmpIntroCollision(f).status,'already-evaluated');assert.equal(f.db.prepare('SELECT chapter FROM lessons WHERE package_id=? AND idx=?').get('pmp-full',33).chapter,11);assert.equal(reversePmpIntroCollision(f).status,'changed-since-repair');}
 else {assert.equal(reversePmpIntroCollision(f).status,'reversed');assert.deepEqual(all(f),before);assert.deepEqual(progress(f),beforeProgress);assert.equal(repairPmpIntroCollision(f).status,'already-evaluated');}
 f.db.close();
}
for(const field of ['title','title_en','duration','chapter']){
 const f=fixture(),value=field==='chapter'?17:'User edit';f.db.prepare(`UPDATE lessons SET ${field}=? WHERE package_id=? AND idx=?`).run(value,'pmp-full',33);
 const before=all(f);assert.equal(repairPmpIntroCollision(f).status,'skipped');assert.deepEqual(all(f),before);
 f.db.prepare(`UPDATE lessons SET ${field}=? WHERE package_id=? AND idx=?`).run(field==='chapter'?11:field==='title'?fingerprints[0].title:field==='title_en'?'':'16:16','pmp-full',33);
 assert.equal(repairPmpIntroCollision(f).status,'already-evaluated','Mismatch cannot become eligible on a later user edit');f.db.close();
}
const failed=fixture(),beforeFailed=all(failed),beforeCourses=failed.setting('content_courses');
failed.db.exec(`CREATE TRIGGER fail_marker BEFORE INSERT ON settings WHEN NEW.k='${PMP_COLLISION_REPAIR_KEY}' BEGIN SELECT RAISE(ABORT,'fixture failure'); END;`);
assert.throws(()=>repairPmpIntroCollision(failed),/fixture failure/);assert.deepEqual(all(failed),beforeFailed);assert.equal(failed.setting('content_courses'),beforeCourses);assert.equal(failed.setting(PMP_COLLISION_REPAIR_KEY),'');failed.db.close();
console.log('PASS: cross-package allocation floors, null reservations, both real write guards, stale preflight, exact chapter-only repair, current 54+ rows, genuine intro/new team lesson, content/progress preservation, rollback, once-only skipped and applied markers, and deliberate guarded reversal.');

function qualityFixture(){
 const f=fixture();
 for(const [idx,title,title_en,duration] of [[45,'التحقق من النطاق','Validate Scope','4:06'],[46,'التحكم بالجودة','Quality Control','']])
  f.db.prepare('UPDATE lessons SET title=?,title_en=?,duration=?,chapter=16,display_order=NULL WHERE package_id=? AND idx=?').run(title,title_en,duration,'pmp-full',idx);
 return f;
}
for(const intentionalEdit of [false,true]){
 const f=qualityFixture(),before=all(f),priorProgress=progress(f),priorCourses=f.setting('content_courses');
 const result=repairPmpQualityOrder(f);assert.equal(result.status,'applied');
 assert.deepEqual(all(f),before.map(row=>row.package_id==='pmp-full'&&[45,46].includes(row.idx)?{...row,display_order:row.idx===45?46:45}:row));
 assert.deepEqual(progress(f),priorProgress);assert.equal(f.setting('content_courses'),priorCourses);
 const rows=all(f).filter(row=>row.package_id==='pmp-full').map(row=>({ch:row.chapter,t:row.title,vimeo:row.vimeo,displayOrder:row.display_order}));
 assert.deepEqual(Array.from(R.adminGroups(f.courses()[0],rows).find(g=>g.key==='monitoring').items,x=>x.i),[46,45]);
 if(intentionalEdit){f.db.prepare('UPDATE lessons SET display_order=0 WHERE package_id=? AND idx=?').run('pmp-full',45);assert.equal(repairPmpQualityOrder(f).status,'already-evaluated');assert.equal(reversePmpQualityOrder(f).status,'changed-since-repair');}
 else{assert.equal(reversePmpQualityOrder(f).status,'reversed');assert.deepEqual(all(f),before);assert.equal(repairPmpQualityOrder(f).status,'already-evaluated');}
 f.db.close();
}
for(const mutation of ["title='Changed'","title_en='Changed'","duration='5:00'","chapter=17","display_order=45"]){
 const f=qualityFixture();f.db.exec("UPDATE lessons SET "+mutation+" WHERE package_id='pmp-full' AND idx=45");const before=all(f);
 assert.equal(repairPmpQualityOrder(f).status,'skipped');assert.deepEqual(all(f),before);
 f.db.prepare('UPDATE lessons SET title=?,title_en=?,duration=?,chapter=16,display_order=NULL WHERE package_id=? AND idx=?').run('التحقق من النطاق','Validate Scope','4:06','pmp-full',45);
 assert.equal(repairPmpQualityOrder(f).status,'already-evaluated');f.db.close();
}
const custom=qualityFixture();custom.db.exec("UPDATE lessons SET chapter=16,display_order=2 WHERE package_id='pmp-full' AND idx=47");assert.equal(repairPmpQualityOrder(custom).status,'skipped','Any customized sibling order blocks old default-order migration');custom.db.close();
const qfail=qualityFixture(),qbefore=all(qfail);qfail.db.exec(`CREATE TRIGGER fail_order_marker BEFORE INSERT ON settings WHEN NEW.k='${PMP_QUALITY_ORDER_KEY}' BEGIN SELECT RAISE(ABORT,'order marker failure'); END;`);assert.throws(()=>repairPmpQualityOrder(qfail),/order marker failure/);assert.deepEqual(all(qfail),qbefore);assert.equal(qfail.setting(PMP_QUALITY_ORDER_KEY),'');qfail.db.close();
console.log('PASS: exact requested Quality Control before Validate Scope, default-order fingerprints, metadata-only pair change, custom/newer order skipped, atomic audit marker, once-only behavior and guarded reversal.');

// Stale catalog editors cannot erase, null or replace a newly migrated destination.
{
 const f=fixture(),oldCourses=f.courses();repairPmpIntroCollision(f);
 const routes=new Map();vm.runInNewContext(server.slice(start,end),{db:f.db,setting:f.setting,setSetting:f.setSetting,chapterSlotFloor,validChapterAllocation,app:{put:(path,...fns)=>routes.set(path,fns.at(-1))},auth(){},admin(){},validatePackageInstructors(){},readList:k=>JSON.parse(f.setting(k)||'[]')});
 const invoke=(body,whole)=>{let code=200;routes.get(whole?'/api/admin/content':'/api/admin/course-chapters/:course')({params:{course:'pmp'},body},{status(n){code=n;return this;},json(){return this;}});return code;};
 const persisted=f.setting('content_courses'),rows=all(f);
 for(const whole of [false,true])for(const kind of ['truncate','null','identity']){
  const chapters=kind==='truncate'?oldCourses[0].chapters:clone(f.courses()[0].chapters);
  if(kind==='null')chapters[71]=null;
  if(kind==='identity')chapters[71]={ar:'Other',en:'Other',outlineKey:'ai'};
  assert.equal(invoke(whole?{courses:[{id:'pmp',chapters}],cms:{changed:true}}:{chapters},whole),409);
  assert.equal(f.setting('content_courses'),persisted);assert.equal(f.setting('content_cms'),'');assert.deepEqual(all(f),rows);
 }
 assert.equal(invoke({courses:[{id:'pmp',ar:'Renamed course'}]},true),200);
 assert.deepEqual(f.courses()[0].chapters,JSON.parse(persisted)[0].chapters,'Omitted authoritative chapter slots retained');
 assert.deepEqual(all(f),rows);f.db.close();
}
console.log('PASS: stale chapter truncation/null/identity replacement blocked on both writers; omitted whole-content chapters preserved.');

// Execute the actual boot catalog sequence before both migrations. A former
// seven-ID equality reset discarded the nine-course saved catalog at every boot.
{
 const f=qualityFixture(),courses=f.courses(),packages=f.packages();
 for(const id of ['acp','grcp','p3o','pba','lss','nebosh','aipro'])courses.push({id,chapters:[id+' authored heading'],custom:'retain'});
 packages.push({id:'aipro-custom',course:'aipro',schemaVersion:15,custom:'retain'});
 f.setSetting('content_courses',JSON.stringify(courses));f.setSetting('content_packages',JSON.stringify(packages));
 const actualCatalog=JSON.parse(fs.readFileSync('public/v15-catalog.json','utf8'));
 assert.equal(actualCatalog.courses.length,9);
 const bootStart=server.indexOf('const savedCourses = readList('),bootEnd=server.indexOf('initializeInstructorRegistry(',bootStart);
 const run=()=>vm.runInNewContext(server.slice(bootStart,bootEnd),{db:f.db,setting:f.setting,setSetting:f.setSetting,readList:key=>JSON.parse(f.setting(key)||'[]'),v15Catalog:actualCatalog,repairPmpIntroCollision,repairPmpQualityOrder});
 run();
 assert.equal(JSON.parse(f.setting(PMP_COLLISION_REPAIR_KEY)).status,'applied');assert.equal(JSON.parse(f.setting(PMP_QUALITY_ORDER_KEY)).status,'applied');
 assert.deepEqual(f.packages(),packages);assert.deepEqual(f.courses().slice(1),courses.slice(1));
 assert.deepEqual(f.courses()[0].chapters.slice(0,18),courses[0].chapters);
 const persisted=f.setting('content_courses'),rows=all(f);run();assert.equal(f.setting('content_courses'),persisted);assert.deepEqual(all(f),rows);f.db.close();
}
console.log('PASS: actual boot sequence preserves nine-course/custom authored catalog before repairs and across repeat startup.');

// Optional exact latest public metadata fixture; always a fresh in-memory database.
if(process.env.CURRICULUM_SNAPSHOT_DIR){
 const dir=process.env.CURRICULUM_SNAPSHOT_DIR,content=JSON.parse(fs.readFileSync(dir+'/stable-order-live-content.json','utf8')),lessons=JSON.parse(fs.readFileSync(dir+'/stable-order-live-lessons.json','utf8'));
 const f=fixture();f.db.exec('DELETE FROM lessons');
 f.setSetting('content_courses',JSON.stringify(content.courses));f.setSetting('content_packages',JSON.stringify(content.packages));
 const insert=f.db.prepare('INSERT INTO lessons VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
 for(const row of lessons)insert.run('pmp-full',row.idx,row.title,row.title_en,row.chapter,row.duration,row.vimeo,row.notes,row.notes_en,JSON.stringify(row.files),JSON.stringify(row.quiz),row.displayOrder??null);
 const actualCatalog=JSON.parse(fs.readFileSync('public/v15-catalog.json','utf8')),bootStart=server.indexOf('const savedCourses = readList('),bootEnd=server.indexOf('initializeInstructorRegistry(',bootStart);
 const run=()=>vm.runInNewContext(server.slice(bootStart,bootEnd),{db:f.db,setting:f.setting,setSetting:f.setSetting,readList:key=>JSON.parse(f.setting(key)||'[]'),v15Catalog:actualCatalog,repairPmpIntroCollision,repairPmpQualityOrder});
 const before=all(f),original=f.courses(),packages=f.packages(),oldChapters=original.find(c=>c.id==='pmp').chapters;
 assert.equal(lessons.length,54);assert.equal(oldChapters.length,18);assert.equal(original.length,9);run();
 assert.equal(JSON.parse(f.setting(PMP_COLLISION_REPAIR_KEY)).status,'applied');assert.equal(JSON.parse(f.setting(PMP_QUALITY_ORDER_KEY)).status,'applied');
 assert.deepEqual(f.packages(),packages);assert.deepEqual(f.courses().filter(c=>c.id!=='pmp'),original.filter(c=>c.id!=='pmp'));assert.deepEqual(f.courses().find(c=>c.id==='pmp').chapters.slice(0,18),oldChapters);
 assert.deepEqual(all(f),before.map(row=>[33,34].includes(row.idx)?{...row,chapter:18}:[45,46].includes(row.idx)?{...row,display_order:row.idx===45?46:45}:row));
 const saved=f.setting('content_courses'),after=all(f);run();assert.equal(f.setting('content_courses'),saved);assert.deepEqual(all(f),after);f.db.close();
 console.log('PASS: exact 54-row/18-heading/nine-course public metadata booted twice locally; only 33/34 chapter and 45/46 display rank changed.');
}
