/** Real lesson-save handler + in-memory SQLite; synthetic fixtures only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const {default:Database} = await import(process.env.SQLITE_MODULE || 'better-sqlite3');
const db = new Database(':memory:');
db.exec(`CREATE TABLE lessons(package_id TEXT, idx INTEGER, title TEXT, title_en TEXT, chapter INTEGER, duration TEXT, vimeo TEXT, free INTEGER, notes TEXT, notes_en TEXT, files TEXT, quiz TEXT, display_order INTEGER, PRIMARY KEY(package_id,idx));
CREATE TABLE lesson_files(id TEXT, package_id TEXT);
CREATE TABLE quiz_images(id TEXT, package_id TEXT);
CREATE TABLE progress(user_id TEXT, package_id TEXT, data TEXT);`);
let handler, lookup = async () => '';
const source = fs.readFileSync(process.argv[2] || 'server.js','utf8');
const start = source.indexOf("app.put('/api/admin/lessons/:pkg'");
const end = source.indexOf("app.get('/api/admin/settings'", start);
assert(start > 0 && end > start);
vm.runInNewContext(source.slice(start,end), {db, app:{put:(path,...handlers)=>handler=handlers.at(-1)}, auth(){}, admin(){},
 normalizeVimeoReference:v => /^\d+$/.test(String(v || '')) ? {stored:String(v)} : null,
 vimeoDuration:id=>lookup(id)});
const originalQuiz = [{q:'Synthetic check',options:['a','b','c','d'],correct:0}];
function seed(){
 db.exec('DELETE FROM lessons; DELETE FROM lesson_files; DELETE FROM progress');
 db.prepare('INSERT INTO lesson_files VALUES (?,?)').run('file-a','pmp');
 db.prepare('INSERT INTO lesson_files VALUES (?,?)').run('foreign','other');
 db.prepare('INSERT INTO lessons VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run('pmp',0,'Original','English',3,'02:00','101',1,'Notes','English notes',JSON.stringify([{id:'file-a',name:'Guide'}]),JSON.stringify(originalQuiz),null);
 db.prepare('INSERT INTO lessons SELECT ?,idx,title,title_en,chapter,duration,vimeo,free,notes,notes_en,files,quiz,display_order FROM lessons WHERE package_id=?').run('other','pmp');
 db.prepare('INSERT INTO progress VALUES (?,?,?)').run('synthetic','pmp',JSON.stringify({lessons:{0:true},exams:{x:{score:90}}}));
 lookup=async()=>'';
}
function rows(){return db.prepare('SELECT * FROM lessons ORDER BY package_id,idx').all();}
async function put(body,pkg='pmp'){
 let status=200,bodyOut;
 await handler({params:{pkg},body},{status(n){status=n;return this;},json(v){bodyOut=v;return this;}});
 return {status,body:bodyOut};
}
seed();
const before=rows(),progress=db.prepare('SELECT * FROM progress').all();
assert.equal((await put([{t:'Original'}])).status,200);
assert.deepEqual(rows(),before,'An omitted field must not erase notes, files, chapter, duration, translation, quiz or free access');
assert.deepEqual(db.prepare('SELECT * FROM progress').all(),progress);
assert.equal((await put([{t:'Original',t_en:'',ch:0,dur:'02:00',free:false,notes:'',notes_en:'',files:[],quiz:[]}])).status,200);
let saved=rows().find(r=>r.package_id==='pmp');
assert.equal(saved.title_en,'');assert.equal(saved.chapter,0);assert.equal(saved.free,0);assert.equal(saved.notes,'');assert.equal(saved.notes_en,'');assert.equal(saved.files,'[]');assert.equal(saved.quiz,'[]');
assert.deepEqual(rows().find(r=>r.package_id==='other'),before.find(r=>r.package_id==='other'));
seed();
for (const body of [null,{},[{}],[{t:'   '}],[{t:'Original',ch:{}}],[{t:'Original',notes:{}}],[null],[4],[[]],[{t:'Original',files:{}}],[{t:'Original',quiz:'bad'}]]) {
 const snapshot=rows(); const result=await put(body);
 // null historically meant empty list; invalid bodies must not silently clear lessons.
 assert.equal(result.status,400,JSON.stringify(body));assert.deepEqual(rows(),snapshot);
}
seed();
assert.equal((await put([{t:'Original',files:[{id:'file-a'},{id:'foreign'},null]}])).status,200);
assert.deepEqual(JSON.parse(rows().find(r=>r.package_id==='pmp').files),[{id:'file-a'}]);
seed();
assert.equal((await put([{t:'Renamed',vimeo:'101'}])).status,200);
assert.deepEqual(rows().find(r=>r.package_id==='pmp'),{...before.find(r=>r.package_id==='pmp'),title:'Renamed'},'Same unique video identifies a renamed lesson');
seed();
assert.equal((await put([{title:'Original',chapter:7,duration:'05:00'}])).status,200);
assert.equal(rows().find(r=>r.package_id==='pmp').chapter,7);assert.equal(rows().find(r=>r.package_id==='pmp').duration,'05:00');
seed();
assert.equal((await put([{t:'Original',ch:'3'}])).status,200);assert.equal(rows().find(r=>r.package_id==='pmp').chapter,3);
assert.equal((await put([{t:'Original',ch:''}])).status,200);assert.equal(rows().find(r=>r.package_id==='pmp').chapter,0);
assert.equal((await put([{t:'Original',ch:'Introduction'}])).status,200);assert.equal(rows().find(r=>r.package_id==='pmp').chapter,'Introduction');
seed();
let durationLookups=0;lookup=async()=>{durationLookups++;return '04:30';};
assert.equal((await put([{t:'Original',vimeo:'303'}])).status,200);
assert.equal(durationLookups,1);assert.equal(rows().find(r=>r.package_id==='pmp').duration,'04:30','Replacement video must not inherit the old duration');
seed();
let release,started;
const began=new Promise(r=>started=r);
lookup=()=>{started();return new Promise(r=>release=r);};
const pending=put([{t:'New video',vimeo:'202'}]);
await began;
// A second editor completes while the first request waits for Vimeo.
assert.equal((await put([{t:'Original',notes:'Newer editor notes'}])).status,200);
const concurrent=rows();release('03:00');
assert.equal((await pending).status,409);assert.deepEqual(rows(),concurrent,'Stale request must not overwrite a concurrent save');
assert.deepEqual(db.prepare('SELECT * FROM progress').all(),progress);
seed();
assert.equal((await put([{t:'Original'},{t:'Appended',vimeo:'202',dur:'03:00'}])).status,200);
assert.equal(rows().filter(r=>r.package_id==='pmp').length,2);
assert.deepEqual(rows().find(r=>r.package_id==='pmp'&&r.idx===0),before.find(r=>r.package_id==='pmp'));
// Inserts remain atomic even if SQLite rejects a later record.
seed();db.exec("CREATE TRIGGER reject_bad BEFORE INSERT ON lessons WHEN NEW.title='Reject' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");
await assert.rejects(()=>put([{t:'Changed'},{t:'Reject'}]),/synthetic failure/);
assert.deepEqual(rows(),before);db.close();
console.log('PASS: omitted metadata preserved, explicit clearing works, malformed snapshots rejected, foreign attachments excluded, concurrent saves protected, append stable, transaction rollback, progress/other packages untouched.');

