import {lessonStructure} from '../lesson-actions.js';
/** Stable presentation ordering against real projections and SQLite handlers.
 * Synthetic fixtures only: no production account, data, or network. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
// Node's built-in SQLite avoids ABI-sensitive native-addon fixtures on newer Node.
// The actual production save handler and its SQL are executed unchanged below.
let Database;
try {
 const {DatabaseSync}=await import('node:sqlite');
 Database=class {
  constructor(file){this.db=new DatabaseSync(file);}
  exec(sql){return this.db.exec(sql);} prepare(sql){return this.db.prepare(sql);}
  pragma(sql){return this.prepare('PRAGMA '+sql).all();}
  transaction(fn){return(...args)=>{this.exec('BEGIN');try{const result=fn(...args);this.exec('COMMIT');return result;}catch(error){this.exec('ROLLBACK');throw error;}};}
  close(){this.db.close();}
 };
} catch { ({default:Database}=await import(process.env.SQLITE_MODULE||'better-sqlite3')); }
const clone=x=>JSON.parse(JSON.stringify(x)),box={window:{}};
new Function('window',fs.readFileSync('public/course-roadmap.js','utf8'))(box.window);
const R=box.window.CourseRoadmap,flat=nodes=>Array.from(nodes).flatMap(g=>[g,...flat(g.children||[])]);
const course={id:'pmp',chapters:Array.from({length:17},(_,i)=>i===16?{ar:'مرحلة المتابعة والتحكم',en:'Monitoring & Controlling',outlineKey:'monitoring',custom:{keep:true}}:i===0?{ar:'مقدمة',en:'Introduction',outlineKey:'intro'}:'Legacy '+i)};
const lessons=Array.from({length:53},(_,i)=>({ch:i===45||i===46||i===47?16:0,t:i===45?'التحقق من النطاق':i===46?'التحكم بالجودة':'Original '+i,t_en:i===45?'Validate Scope':i===46?'Quality Control':'English '+i,vimeo:i===47?'':String(100000+i),dur:'01:00',free:i===0,notes:'Notes '+i,notes_en:'English notes '+i,files:[{id:'file-'+i,name:'Guide '+i}],quiz:[{q:'Question '+i,options:['a','b','c','d'],correct:0}]}));
const order=ls=>Array.from(R.adminGroups(course,ls).find(g=>g.key==='monitoring').items,l=>l.i);
const stripped=ls=>ls.map(({displayOrder,displayOrderBase,...l})=>l);
const original=clone(lessons),refs=lessons.slice(),chapters=clone(course),progress={lessons:{45:true,46:false},exams:{lesson45:{score:88}},weeks:{1:true}};
assert.deepEqual(order(lessons),[45,46,47]);
assert.equal(R.moveLesson(course,lessons,46,-1),true);assert.deepEqual(order(lessons),[46,45,47]);
for(let n=0;n<50;n++){assert.equal(R.moveLesson(course,lessons,46,1),true);assert.equal(R.moveLesson(course,lessons,46,-1),true);}
assert.deepEqual(stripped(lessons),original);assert.deepEqual(course,chapters);lessons.forEach((l,i)=>assert.equal(l,refs[i]));
assert.equal(R.moveLesson(course,lessons,46,-1),false);assert.equal(R.moveLesson(course,lessons,47,1),false);assert.equal(R.moveLesson(course,lessons,999,-1),false);assert.equal(R.moveLesson(course,lessons,46,3),false);
assert.deepEqual(order(clone(lessons)),[46,45,47]);
const videos=Array.from(R.videoOrder(course,lessons));assert.equal(videos.indexOf(46)+1,videos.indexOf(45));assert(!videos.includes(47));
assert.deepEqual(flat(R.learnerGroups(course,lessons)).flatMap(g=>Array.from(g.items,l=>l.i)).sort((a,b)=>a-b),lessons.map((_,i)=>i));
for(const value of [undefined,null,-1,NaN,Infinity,'0',{},[],1.5,1000001]){
 const ls=clone(original);ls[45].displayOrder=value;assert.deepEqual(order(ls),[45,46,47],'Malformed imported order falls back to original slot');
}
const ties=clone(original);[45,46,47].forEach(i=>ties[i].displayOrder=0);assert.deepEqual(order(ties),[45,46,47]);
const other={id:'rmp',chapters:[null,{ar:'Second',en:'Second'}]},otherLessons=[{ch:1,t:'one',vimeo:'1'},{ch:1,t:'two',vimeo:'2'},{ch:0,t:'first',vimeo:'3'}];
assert.equal(R.moveLesson(other,otherLessons,1,-1),true);assert.deepEqual(Array.from(R.videoOrder(other,otherLessons)),[2,1,0]);assert.equal(otherLessons[0].t,'one');

const source=fs.readFileSync('server.js','utf8'),db=new Database(':memory:');
db.exec(`CREATE TABLE lessons(package_id TEXT,idx INTEGER,title TEXT,title_en TEXT,chapter INTEGER,duration TEXT,vimeo TEXT,free INTEGER,notes TEXT,notes_en TEXT,files TEXT,quiz TEXT,PRIMARY KEY(package_id,idx));CREATE TABLE settings(k TEXT PRIMARY KEY,v TEXT);
CREATE TABLE lesson_files(id TEXT,package_id TEXT);CREATE TABLE quiz_images(id TEXT,package_id TEXT);CREATE TABLE progress(user_id TEXT,package_id TEXT,data TEXT);`);
const migration=source.match(/if \(!db\.pragma\('table_info\(lessons\)'\)\.some\(col => col\.name === 'display_order'\)\)\n  db\.exec\("ALTER TABLE lessons ADD COLUMN display_order INTEGER"\);/)[0];
new Function('db',migration)(db);new Function('db',migration)(db);db.exec('ALTER TABLE lessons ADD COLUMN deleted_at INTEGER');assert.equal(db.pragma('table_info(lessons)').filter(c=>c.name==='display_order').length,1);
let handler,lookup=async()=>'';
const start=source.indexOf("app.put('/api/admin/lessons/:pkg'"),end=source.indexOf("app.get('/api/admin/settings'",start);
new Function('lessonStructure','db','app','auth','admin','normalizeVimeoReference','vimeoDuration',source.slice(start,end))(lessonStructure,db,{put:(route,...handlers)=>handler=handlers.at(-1)},()=>{},()=>{},v=>/^\d+$/.test(String(v||''))?{stored:String(v)}:null,id=>lookup(id));
const all=()=>db.prepare('SELECT * FROM lessons ORDER BY package_id,idx').all();
function seed(){db.exec('DELETE FROM lessons;DELETE FROM lesson_files;DELETE FROM progress');original.forEach((l,i)=>{db.prepare('INSERT INTO lesson_files VALUES (?,?)').run('file-'+i,'pmp-full');db.prepare('INSERT INTO lessons VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)').run('pmp-full',i,l.t,l.t_en,l.ch,l.dur,l.vimeo,l.free?1:0,l.notes,l.notes_en,JSON.stringify(l.files),JSON.stringify(l.quiz),null);});db.prepare('INSERT INTO lessons SELECT ?,idx,title,title_en,chapter,duration,vimeo,free,notes,notes_en,files,quiz,display_order,deleted_at FROM lessons WHERE package_id=?').run('other','pmp-full');db.prepare('INSERT INTO progress VALUES (?,?,?)').run('synthetic','pmp-full',JSON.stringify(progress));lookup=async()=>'';}
const read=()=>db.prepare('SELECT * FROM lessons WHERE package_id=? ORDER BY idx').all('pmp-full').map(l=>({t:l.title,t_en:l.title_en,ch:l.chapter,dur:l.duration,vimeo:l.vimeo,free:!!l.free,notes:l.notes,notes_en:l.notes_en,files:JSON.parse(l.files),quiz:JSON.parse(l.quiz),displayOrder:l.display_order,displayOrderBase:l.display_order}));
async function put(body){let status=200,out;await handler({params:{pkg:'pmp-full'},body:clone(body)},{status(n){status=n;return this;},json(v){out=v;return this;}});return {status,body:out};}
seed();const initial=all(),progressRows=db.prepare('SELECT * FROM progress').all();
assert.equal((await put(lessons)).status,200);assert.deepEqual(order(read()),[46,45,47]);
assert.deepEqual(all().map(({display_order,...r})=>r),initial.map(({display_order,...r})=>r),'Only order metadata changes, including protected files/quiz/media');
assert.deepEqual(db.prepare('SELECT * FROM progress').all(),progressRows);assert.deepEqual(all().filter(l=>l.package_id==='other'),initial.filter(l=>l.package_id==='other'));
assert.equal((await put(lessons)).status,200,'Idempotent retry after uncertain response is safe');
assert.equal((await put(original.map(l=>({t:l.t,display_order:'ignored'})))).status,200,'Legacy payload cannot erase omitted order via snake alias');assert.deepEqual(order(read()),[46,45,47]);
const saved=all(),stale=clone(original);R.moveLesson(course,stale,45,1);R.moveLesson(course,stale,45,-1);
assert.equal((await put(stale)).status,409);assert.deepEqual(all(),saved,'Stale tab rejected before any content is replaced');
let current=read();R.moveLesson(course,current,46,1);assert.equal((await put(current)).status,200);assert.deepEqual(order(read()),[45,46,47]);
for(const key of ['displayOrder','displayOrderBase'])for(const value of [-1,'1',{},[],1.2,1000001]){const invalid=read();invalid[45][key]=value;const before=all();assert.equal((await put(invalid)).status,400);assert.deepEqual(all(),before);}
current=read();current[45].displayOrder=null;assert.equal((await put(current)).status,200,'Explicit reset supports null with matching base');assert.equal(read()[45].displayOrder,null);
seed();let release,started;const began=new Promise(r=>started=r);lookup=()=>{started();return new Promise(r=>release=r);};
const slow=read();slow[0].vimeo='999999';slow[0].dur='';const pending=put(slow);await began;current=read();R.moveLesson(course,current,46,-1);assert.equal((await put(current)).status,200);const concurrent=all();release('02:00');assert.equal((await pending).status,409);assert.deepEqual(all(),concurrent,'Slow save cannot overwrite a newly accepted order');
seed();db.exec("CREATE TRIGGER reject_bad BEFORE INSERT ON lessons WHEN NEW.title='Reject' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");current=read();R.moveLesson(course,current,46,-1);current[52].t='Reject';const beforeRollback=all();await assert.rejects(()=>put(current),/synthetic failure/);assert.deepEqual(all(),beforeRollback,'All ranks and records roll back atomically');
// Metadata-only mode cannot replay stale content from another editor.
db.exec('DROP TRIGGER reject_bad');seed();
const orderDraft=read();R.moveLesson(course,orderDraft,46,-1);
const orderBody={kind:'display-order',expectedCount:orderDraft.length,orders:[45,46,47].map(idx=>({idx,displayOrder:orderDraft[idx].displayOrder,displayOrderBase:orderDraft[idx].displayOrderBase}))};
db.prepare('UPDATE lessons SET title=?,vimeo=?,notes=?,quiz=? WHERE package_id=? AND idx=?').run('Newer title','888888','Newer notes',JSON.stringify([{q:'Newer quiz'}]),'pmp-full',0);
const beforeOrderOnly=all();assert.equal((await put(orderBody)).status,200);assert.deepEqual(all().map(({display_order,...row})=>row),beforeOrderOnly.map(({display_order,...row})=>row),'Order-only save preserves every current field, even from a stale content draft');assert.deepEqual(order(read()),[46,45,47]);
assert.equal((await put(orderBody)).status,200);
for(const invalid of [{...orderBody,expectedCount:54},{...orderBody,orders:[{...orderBody.orders[0],idx:99}]}]){const prior=all();assert.equal((await put(invalid)).status,409);assert.deepEqual(all(),prior);}
for(const invalid of [{...orderBody,orders:[]},{...orderBody,orders:[orderBody.orders[0],orderBody.orders[0]]},{...orderBody,orders:[{idx:45,displayOrder:0}]},{...orderBody,orders:[{idx:45,displayOrder:'0',displayOrderBase:null}]}]){const prior=all();assert.equal((await put(invalid)).status,400);assert.deepEqual(all(),prior);}
seed();db.exec("CREATE TRIGGER reject_rank BEFORE UPDATE OF display_order ON lessons WHEN NEW.idx=46 BEGIN SELECT RAISE(ABORT,'rank failure'); END;");const priorRank=all();await assert.rejects(()=>put(orderBody),/rank failure/);assert.deepEqual(all(),priorRank);db.exec('DROP TRIGGER reject_rank');
// The legacy panel updates its editable fields in place, retaining rich metadata.
seed();db.prepare('UPDATE lessons SET display_order=0 WHERE package_id=? AND idx=?').run('pmp-full',46);const beforePanel=all();
const panel=fs.readFileSync('admin.js','utf8'),panelStart=panel.indexOf("  r.put('/api/lessons/:pkg'"),panelEnd=panel.indexOf('  /* ═══ صفحة اللوحة',panelStart);
new Function('db','r','guard',panel.slice(panelStart,panelEnd))(db,{put:(route,...handlers)=>handler=handlers.at(-1)},()=>{});
assert.equal((await put(original.map(l=>({t:l.t})))).status,200);assert.deepEqual(all(),beforePanel,'Legacy omissions retain all protected fields and display ranks');
const physicallyMoved=original.map(l=>({t:l.t}));[physicallyMoved[45],physicallyMoved[46]]=[physicallyMoved[46],physicallyMoved[45]];assert.equal((await put(physicallyMoved)).status,409);assert.deepEqual(all(),beforePanel);
for(const invalid of [null,{},[{}],[null],[{t:'Original',free:'yes'}]]){assert.equal((await put(invalid)).status,400);assert.deepEqual(all(),beforePanel);}
const renamed=original.map((l,idx)=>({idx,t:idx===0?'Renamed original':l.t}));assert.equal((await put(renamed)).status,200);assert.deepEqual(clone(all().map(row=>row.package_id==='pmp-full'&&row.idx===0?{...row,title:original[0].t}:row)),clone(beforePanel));
assert.deepEqual(db.prepare('SELECT * FROM progress').all(),progressRows);db.close();
console.log('PASS: stable same-chapter rank moves, repeated/boundary cases, malformed/tied defaults, exact target pair, non-PMP parity, additive migration, protected fields/indices/progress, idempotent reload/retry, omitted order preservation, stale tab and in-flight conflicts, atomic rollback.');
