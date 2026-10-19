/** Actual atomic lifecycle and public/full-save handlers. Synthetic SQLite only. */
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {DatabaseSync} from 'node:sqlite';
class Database {constructor(){this.db=new DatabaseSync(':memory:');}exec(s){return this.db.exec(s)}prepare(s){return this.db.prepare(s)}close(){this.db.close()}transaction(fn){return(...args)=>{this.exec('BEGIN');try{const result=fn(...args);this.exec('COMMIT');return result;}catch(e){this.exec('ROLLBACK');throw e;}}}}
import {lessonAction,lessonStructure,lessonCourseBase} from '../lesson-actions.js';
const db=new Database(':memory:');db.exec(`CREATE TABLE settings(k TEXT PRIMARY KEY,v TEXT);CREATE TABLE lessons(package_id TEXT,idx INTEGER,title TEXT,title_en TEXT,chapter INTEGER,duration TEXT,vimeo TEXT,free INTEGER,notes TEXT,notes_en TEXT,files TEXT,quiz TEXT,display_order INTEGER,deleted_at INTEGER,PRIMARY KEY(package_id,idx));CREATE TABLE progress(user_id TEXT,package_id TEXT,data TEXT);CREATE TABLE lesson_files(id TEXT,package_id TEXT);CREATE TABLE quiz_images(id TEXT,package_id TEXT);`);
const setting=k=>db.prepare('SELECT v FROM settings WHERE k=?').get(k)?.v||'',setSetting=(k,v)=>db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k,v);
const chapters=[{ar:'مقدمة',en:'Introduction',outlineKey:'intro'},{ar:'متابعة',en:'Monitoring',outlineKey:'monitoring'}];setSetting('content_courses',JSON.stringify([{id:'pmp',chapters}]));setSetting('content_packages',JSON.stringify([{id:'pmp-full',course:'pmp'},{id:'empty',course:'pmp'}]));
for(let i=0;i<4;i++)db.prepare('INSERT INTO lessons VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)').run('pmp-full',i,'Lesson '+i,'English '+i,i?1:0,'1:00','12345'+i,1,'Notes '+i,'EN '+i,'[{"id":"file"}]','[{"q":"Question","options":["a","b","c","d"],"correct":0}]',i);
db.prepare('INSERT INTO lesson_files VALUES(?,?)').run('file','pmp-full');db.prepare('INSERT INTO progress VALUES(?,?,?)').run('learner','pmp-full','{"lessons":{"1":true},"exams":{"lesson1":{"score":100}}}');
const read=(pkg='pmp-full')=>db.prepare('SELECT * FROM lessons WHERE package_id=? ORDER BY idx').all(pkg),original=read(),progress=db.prepare('SELECT * FROM progress').all();let seq=0;
const body=(action,idx,extra={},pkg='pmp-full')=>({action,idx,requestId:'fixture-'+(++seq),structureBase:lessonStructure(read(pkg)),courseBase:lessonCourseBase(setting,pkg),...extra});
const act=(b,pkg='pmp-full')=>lessonAction({db,setting,setSetting},pkg,b);
const del=body('delete',1);assert(act(del).ok);assert(act(del).replayed);assert.equal(read().length,4);assert(read()[1].deleted_at);assert.deepEqual({...read()[1],deleted_at:null},{...original[1]});assert.equal(act({...del,idx:2}).status,409);
const stale=body('insert',2,{position:'before',lesson:{t:'Inserted',vimeo:'900001'}});assert(act(body('restore',1)).ok);assert.equal(act(stale).status,409);
const insert=body('insert',2,{position:'before',lesson:{t:'Inserted',vimeo:'900001'}});assert.equal(act(insert).idx,4);assert(act(insert).replayed);assert.equal(read().length,5);assert.deepEqual(read().filter(r=>r.chapter===1).sort((a,b)=>a.display_order-b.display_order).map(r=>r.idx),[1,4,2,3]);
for(const i of [0,1,2,3]){const {display_order,...a}=read()[i],{display_order:order,...b}=original[i];assert.deepEqual(a,b);}
const after=body('insert',2,{position:'after',lesson:{t:'After',vimeo:'900001?h=abcdef1234',files:[{id:'file'},{id:'foreign'}]}});assert.equal(act(after).idx,5);assert.deepEqual(JSON.parse(read()[5].files),[{id:'file'}]);assert.deepEqual(read().filter(r=>r.chapter===1).sort((a,b)=>a.display_order-b.display_order).map(r=>r.idx),[1,4,2,5,3]);
const empty=body('insert',null,{position:'end',chapterRef:'outline:intro',lesson:{t:'First'}},'empty');assert.equal(act(empty,'empty').idx,0);
for(const sql of ["title='Renamed'","chapter=0","display_order=88"]){const b=body('delete',2);db.exec('UPDATE lessons SET '+sql+" WHERE package_id='pmp-full' AND idx=2");assert.equal(act(b).status,409);}
const cb=body('delete',1);const courses=JSON.parse(setting('content_courses'));courses[0].chapters[1].ar='Changed heading';setSetting('content_courses',JSON.stringify(courses));assert.equal(act(cb).status,409);
const source=fs.readFileSync('server.js','utf8'),handlers=new Map();
let start=source.indexOf("app.put('/api/admin/lessons/:pkg'"),end=source.indexOf("app.get('/api/admin/settings'",start);
vm.runInNewContext(source.slice(start,end),{db,lessonStructure,app:{put:(p,...f)=>handlers.set(p,f.at(-1))},auth(){},admin(){},normalizeVimeoReference:v=>v?{stored:String(v)}:null,vimeoDuration:async()=>''});
async function invoke(handler,b,pkg='pmp-full'){let status=200,data;await handler({params:{pkg},body:b,headers:{}},{status(n){status=n;return this;},json(v){data=v;return this;}});return{status,data};}
const map=rows=>rows.map(r=>({idx:r.idx,t:r.title,ch:r.chapter,displayOrder:r.display_order,displayOrderBase:r.display_order,structureBase:lessonStructure(rows)}));
let snapshot=read(),full=map(snapshot);assert.equal((await invoke(handlers.get('/api/admin/lessons/:pkg'),full.slice(1))).status,409);assert.deepEqual(read(),snapshot);
assert.equal((await invoke(handlers.get('/api/admin/lessons/:pkg'),full.slice().reverse())).status,409);assert.deepEqual(read(),snapshot);
assert(act(body('delete',1)).ok);snapshot=read();assert.equal((await invoke(handlers.get('/api/admin/lessons/:pkg'),full)).status,409);assert.deepEqual(read(),snapshot);
full=map(snapshot);full[1].t='Overwrite tombstone';full[1].notes='Overwrite';assert.equal((await invoke(handlers.get('/api/admin/lessons/:pkg'),full)).status,200);assert.deepEqual(read()[1],snapshot[1]);
start=source.indexOf("app.get('/api/lessons/:pkg'");end=source.indexOf("app.get('/api/lesson-files/:id'",start);
let guest;vm.runInNewContext(source.slice(start,end),{db,setting,app:{get:(p,h)=>guest=h}});const publicRows=(await invoke(guest)).data;assert.equal(publicRows.length,read().length);assert.equal(publicRows[1].idx,1);assert(publicRows[1].deleted);assert.equal(publicRows[1].vimeo,null);assert.equal(publicRows[1].notes,'');assert.equal(publicRows[1].files.length,0);
// A restored rank may tie a subsequently inserted sibling: stable idx tie-break is deterministic.
assert(act(body('insert',3,{position:'before',lesson:{t:'While deleted'}})).ok);
assert(act(body('restore',1)).ok);
const tied=read(),visibleOrder=rows=>rows.filter(r=>!r.deleted_at).sort((a,b)=>(a.display_order??a.idx)-(b.display_order??b.idx)||a.idx-b.idx).map(r=>r.idx);
assert.equal((await invoke(handlers.get('/api/admin/lessons/:pkg'),map(tied))).status,200);assert.deepEqual(visibleOrder(read()),visibleOrder(tied));
// Legacy title-routed lessons receive an explicit chapter for the inserted sibling.
const legacyCourses=JSON.parse(setting('content_courses'));legacyCourses[0].chapters[0]='Project Management Framework';setSetting('content_courses',JSON.stringify(legacyCourses));
db.exec("UPDATE lessons SET title='مرحلة التخطيط',chapter=0 WHERE package_id='pmp-full' AND idx=0");
const contextual=act(body('insert',0,{position:'before',lesson:{t:'New neutral title'}}));assert(contextual.ok);const newRow=read().find(r=>r.idx===contextual.idx);
assert.equal(JSON.parse(setting('content_courses'))[0].chapters[newRow.chapter].outlineKey,'planning');
for(const extra of [{chapterRef:'missing',position:'end',lesson:{t:'Bad chapter'}},{chapterRef:'outline:intro',position:'end',lesson:{t:'Bad free',free:{}}}]){const before=read();assert.equal(act(body('insert',null,extra)).status,400);assert.deepEqual(read(),before);}
const rollback=body('delete',0);db.exec("CREATE TRIGGER fail_action BEFORE INSERT ON settings WHEN NEW.k LIKE 'lesson_action:%' BEGIN SELECT RAISE(ABORT,'fixture rollback'); END;");snapshot=read();assert.throws(()=>act(rollback),/fixture rollback/);assert.deepEqual(read(),snapshot);assert.deepEqual(db.prepare('SELECT * FROM progress').all(),progress);
console.log('PASS: stable append positions; metadata-only reversible delete/restore; exact replay; stale title/chapter/order/course rejection; empty-package insert; immutable tombstone content; full-save shrink/reindex/stale protection; redacted positional public tombstones; progress preservation; transaction rollback.');db.close();
