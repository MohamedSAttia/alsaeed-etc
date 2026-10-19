// Stable lesson identities: deletion is reversible metadata, insertion only appends.
import crypto from 'node:crypto';
import fs from 'node:fs';
import {chapterSlotFloor} from './curriculum-slots.js';
const box={window:{}};
new Function('window',fs.readFileSync(new URL('./public/course-roadmap.js',import.meta.url),'utf8'))(box.window);
const roadmap=box.window.CourseRoadmap;
export const lessonStructure = rows => rows.length ? crypto.createHash('sha256').update(JSON.stringify(rows.map(r=>[r.idx,r.title,r.title_en,r.chapter,r.display_order??r.displayOrder??null,r.deleted_at||null]))).digest('hex') : 'empty';
export const lessonCourseBase=(setting,pkg)=>{const packages=JSON.parse(setting('content_packages')||'[]'),courses=JSON.parse(setting('content_courses')||'[]');return crypto.createHash('sha256').update(JSON.stringify(courses.find(c=>c.id===packages.find(p=>p.id===pkg)?.course)||null)).digest('hex');};
export function lessonAction({db,setting,setSetting},pkg,body){
 const fail=(status,error)=>({status,error});
 if(!body||!['insert','delete','restore'].includes(body.action)||typeof body.requestId!=='string'||!/^[\w-]{8,100}$/.test(body.requestId))return fail(400,'طلب غير صحيح');
 return db.transaction(()=>{
  const read=()=>db.prepare('SELECT * FROM lessons WHERE package_id=? ORDER BY idx').all(pkg);
  const key='lesson_action:'+pkg+':'+body.requestId, fingerprint=crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const previous=setting(key);
  if(previous){const saved=JSON.parse(previous);return saved.fingerprint===fingerprint?{ok:true,idx:saved.idx,replayed:true}:fail(409,'معرّف طلب مستخدم؛ أعد فتح المحرر');}
  const rows=read();
  if(body.courseBase!==lessonCourseBase(setting,pkg))return fail(409,'تغيّرت الفصول؛ أعد تحميل المحرر');
  if(body.structureBase!==lessonStructure(rows))return fail(409,'تغيّرت قائمة الدروس؛ أعد تحميل المحرر قبل المتابعة');
  const target=rows.find(r=>r.idx===body.idx);
  if(body.action!=='insert'||body.idx!==null&&body.idx!==undefined){
   if(!target||!!target.deleted_at!==(body.action==='restore'))return fail(409,'تغيّرت حالة الدرس؛ أعد تحميل المحرر');
   if(body.anchor && (body.anchor.ch!==target.chapter || body.anchor.displayOrder!==(target.display_order??null)))return fail(409,'تغيّر موضع الدرس؛ أعد تحميل المحرر');
  }
  let idx=target?.idx;
  if(body.action==='insert'){
   const l=body.lesson;
   if(!l||(l.free!==undefined&&![true,false,0,1].includes(l.free))||(l.files!==undefined&&!Array.isArray(l.files))||typeof l.t!=='string'||!l.t.trim()||l.t.length>2000||!['before','after','end'].includes(body.position)||['t_en','dur','vimeo'].some(k=>l[k]!==undefined&&typeof l[k]!=='string')||l.vimeo&&!/^\d+(?:\?h=[a-zA-Z0-9]+)?$/.test(l.vimeo))return fail(400,'بيانات الدرس غير صحيحة');
   const packages=JSON.parse(setting('content_packages')||'[]'),courses=JSON.parse(setting('content_courses')||'[]');
   const course=courses.find(c=>c.id===packages.find(p=>p.id===pkg)?.course);
   if(!course)return fail(400,'الباقة غير موجودة');
   const mapped=rows.map(r=>({ch:r.chapter,t:r.title,t_en:r.title_en,vimeo:r.vimeo,deleted:!!r.deleted_at,displayOrder:r.display_order}));
   const groups=roadmap.adminGroups(course,mapped);
   const group=target?groups.find(g=>g.items.some(l=>l.i===target.idx)):groups.find(g=>g.ref===body.chapterRef);
   if(!target&&(!group||body.position!=='end'))return fail(400,'اختر الدرس المرجعي');
   let chapter=target?.chapter??body.chapter??0;
   if(group?.ref){course.chapterSlotFloor=chapterSlotFloor(db,course,packages);chapter=roadmap.ensureChapter(course,group.ref);delete course.chapterSlotFloor;setSetting('content_courses',JSON.stringify(courses));}
   else if(!target && (!Number.isSafeInteger(chapter)||!course.chapters?.[chapter]))return fail(400,'اختر فصلاً صحيحاً');
   idx=rows.reduce((n,r)=>Math.max(n,r.idx+1),0);
   db.prepare('INSERT INTO lessons(package_id,idx,title,title_en,chapter,duration,vimeo,free,notes,notes_en,files,quiz,display_order) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(pkg,idx,l.t.trim(),l.t_en||'',chapter,l.dur||'',l.vimeo||'',l.free?1:0,'','',JSON.stringify((Array.isArray(l.files)?l.files:[]).filter(f=>f&&db.prepare('SELECT 1 FROM lesson_files WHERE id=? AND package_id=?').get(f.id,pkg))),'[]',null);
   const ordered=group?group.items.map(l=>l.i):rows.filter(r=>!r.deleted_at&&r.chapter===chapter).sort((a,b)=>(a.display_order??a.idx)-(b.display_order??b.idx)||a.idx-b.idx).map(r=>r.idx);
   const at=body.position==='end'?ordered.length:ordered.indexOf(target?.idx)+(body.position==='after'?1:0);
   ordered.splice(Math.max(0,at),0,idx);
   const update=db.prepare('UPDATE lessons SET display_order=? WHERE package_id=? AND idx=?');ordered.forEach((i,n)=>update.run(n,pkg,i));
  }else db.prepare('UPDATE lessons SET deleted_at=? WHERE package_id=? AND idx=?').run(body.action==='delete'?Date.now():null,pkg,idx);
  setSetting(key,JSON.stringify({fingerprint,idx}));
  return {ok:true,idx,structureBase:lessonStructure(read())};
 })();
}
