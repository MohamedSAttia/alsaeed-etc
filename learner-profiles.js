/* Private learner profiles. Never use this projection in chat or rankings. */
import crypto from 'node:crypto';
import {inflateSync} from 'node:zlib';
const crc32=b=>{let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
const LIMITS={name:120,phone:40,about:2000,jobTitle:160,organization:160,careerGoals:2000,professionalAchievements:3000};
const fail=(status,message)=>{const e=new Error(message);e.status=status;throw e;};
const clean=(v,max)=>{if(typeof v!=='string')fail(422,'قيمة غير صالحة');const s=v.trim();if(s.length>max)fail(422,'النص أطول من الحد المسموح');return s;};
export function validateProfilePhoto(input){
 if(!input||typeof input.data!=='string'||!['image/png','image/jpeg'].includes(input.mime))fail(422,'الصورة يجب أن تكون PNG أو JPEG');
 if(input.data.length>1400000||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.data))fail(422,'حجم الصورة أو ترميزها غير صالح');
 const b=Buffer.from(input.data,'base64');if(b.length<24||b.length>1024*1024)fail(422,'الحد الأقصى للصورة 1 ميجابايت');
 let width=0,height=0;
 if(input.mime==='image/png'){
  if(!b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||b.toString('ascii',12,16)!=='IHDR'||b.readUInt32BE(8)!==13)fail(422,'ملف PNG غير صالح');
  width=b.readUInt32BE(16);height=b.readUInt32BE(20);if(!width||!height||width>2048||height>2048)fail(422,'أبعاد الصورة غير صالحة');let pos=8,ended=false,hasData=false;const chunks=[];
  while(pos+12<=b.length){const n=b.readUInt32BE(pos),type=b.toString('ascii',pos+4,pos+8);if(n>b.length-pos-12)fail(422,'ملف PNG غير مكتمل');if(crc32(b.subarray(pos+4,pos+8+n))!==b.readUInt32BE(pos+8+n))fail(422,'بيانات الصورة تالفة');if(type==='IDAT'){hasData=true;chunks.push(b.subarray(pos+8,pos+8+n));}pos+=n+12;if(type==='IEND'){if(n!==0)fail(422,'ملف PNG غير صالح');ended=true;break;}}
  if(!ended||!hasData||pos!==b.length)fail(422,'ملف PNG غير مكتمل');try{inflateSync(Buffer.concat(chunks),{maxOutputLength:40*1024*1024});}catch{fail(422,'بيانات الصورة غير قابلة للقراءة');}
 }else{
  if(b[0]!==255||b[1]!==216||b[b.length-2]!==255||b[b.length-1]!==217)fail(422,'ملف JPEG غير صالح');
  let p=2,scan=false;while(p+4<b.length){if(b[p++]!==255)break;while(b[p]===255)p++;const marker=b[p++];if(marker===218){const size=b.readUInt16BE(p);scan=size>=6&&p+size<b.length-2;break;}if(marker===217)break;if(marker>=208&&marker<=215)continue;const n=b.readUInt16BE(p);if(n<2||p+n>b.length)fail(422,'ملف JPEG غير مكتمل');if([192,193,194].includes(marker)){if(n<8)fail(422,'ملف JPEG غير صالح');height=b.readUInt16BE(p+3);width=b.readUInt16BE(p+5);}p+=n;}if(!scan)fail(422,'ملف JPEG لا يحتوي على صورة');
 }
 if(!width||!height||width>2048||height>2048)fail(422,'أبعاد الصورة يجب ألا تتجاوز 2048 × 2048');
 return {bytes:b,mime:input.mime,width,height};
}
export function mountLearnerProfiles({app,db,auth,progressSummary}){
 db.exec(`CREATE TABLE IF NOT EXISTS learner_profiles(user_id TEXT PRIMARY KEY,about TEXT NOT NULL DEFAULT '',job_title TEXT NOT NULL DEFAULT '',organization TEXT NOT NULL DEFAULT '',career_goals TEXT NOT NULL DEFAULT '',professional_achievements TEXT NOT NULL DEFAULT '',photo BLOB,photo_mime TEXT,photo_version TEXT,updated INTEGER NOT NULL DEFAULT 0)`);
 const user=id=>db.prepare('SELECT id,name,email,phone,role,active,created,last_login FROM users WHERE id=?').get(id);
 const row=id=>db.prepare('SELECT * FROM learner_profiles WHERE user_id=?').get(id);
 const current=(req,res,next)=>{const u=user(req.user.id);const deleted=u&&db.pragma('table_info(users)').some(c=>c.name==='deleted_at')&&db.prepare('SELECT deleted_at FROM users WHERE id=?').get(u.id)?.deleted_at;if(!u||u.active!==1||deleted)return res.status(403).json({error:'الحساب غير نشط'});req.profileActor=u;res.setHeader('Cache-Control','private, no-store');next();};
 const guard=(req,id)=>{if(req.profileActor.id!==id&&req.profileActor.role!=='admin')fail(403,'هذا الملف خاص بصاحبه والإدارة');};
 const profile=id=>{const u=user(id);if(!u)fail(404,'المستخدم غير موجود');const p=row(id)||{};return {...u,about:p.about||'',jobTitle:p.job_title||'',organization:p.organization||'',careerGoals:p.career_goals||'',professionalAchievements:p.professional_achievements||'',hasPhoto:!!p.photo,photoVersion:p.photo_version||null,revision:p.updated||0,emailEditable:false};};
 const history=id=>({enrollments:db.prepare('SELECT package_id,source,expires,created FROM enrollments WHERE user_id=? ORDER BY created DESC').all(id).map(e=>({...e,...(progressSummary?progressSummary(id,e.package_id,e.created):{})})),certificates:db.prepare('SELECT no,package_id,course,hours,issued FROM certificates WHERE user_id=? ORDER BY issued DESC').all(id)});
 const route=fn=>(req,res)=>{try{fn(req,res);}catch(e){res.status(e.status||500).json({error:e.status?e.message:'تعذر تحميل أو حفظ الملف الشخصي'});}};
 app.get('/api/me/profile',auth,current,route((req,res)=>res.json({profile:profile(req.profileActor.id),...history(req.profileActor.id)})));
 app.get('/api/admin/learner-profiles/:id',auth,current,route((req,res)=>{if(req.profileActor.role!=='admin')fail(403,'للإدارة فقط');res.json({profile:profile(req.params.id),...history(req.params.id)});}));
 app.put('/api/me/profile',auth,current,route((req,res)=>{
  const b=req.body;if(!b||typeof b!=='object'||Array.isArray(b))fail(422,'بيانات غير صالحة');
  if(Object.keys(b).some(k=>!['revision',...Object.keys(LIMITS)].includes(k)))fail(422,'لا يمكن تعديل البريد أو صلاحيات الحساب من الملف الشخصي');
  const id=req.profileActor.id;
  db.transaction(()=>{const old=profile(id);if(b.revision!==old.revision)fail(409,'تم تحديث الملف من جهاز آخر. أعد تحميل أحدث نسخة');const v={};for(const [k,n]of Object.entries(LIMITS))v[k]=b[k]===undefined?old[k]||'':clean(b[k],n);if(!v.name)fail(422,'الاسم مطلوب');
   db.prepare('UPDATE users SET name=?,phone=? WHERE id=?').run(v.name,v.phone,id);
   db.prepare(`INSERT INTO learner_profiles(user_id,about,job_title,organization,career_goals,professional_achievements,updated) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET about=excluded.about,job_title=excluded.job_title,organization=excluded.organization,career_goals=excluded.career_goals,professional_achievements=excluded.professional_achievements,updated=excluded.updated`).run(id,v.about,v.jobTitle,v.organization,v.careerGoals,v.professionalAchievements,Math.max(Date.now(),old.revision+1));
  }).immediate();res.json({ok:true,profile:profile(id)});
 }));
 app.put('/api/me/profile/photo',auth,current,route((req,res)=>{
  const id=req.profileActor.id,b=req.body||{};const image=b.remove===true?null:validateProfilePhoto(b);
  db.transaction(()=>{const old=profile(id);if(b.revision!==old.revision)fail(409,'تم تحديث الملف من جهاز آخر. أعد تحميل أحدث نسخة');db.prepare(`INSERT INTO learner_profiles(user_id,photo,photo_mime,photo_version,updated) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET photo=excluded.photo,photo_mime=excluded.photo_mime,photo_version=excluded.photo_version,updated=excluded.updated`).run(id,image?.bytes||null,image?.mime||null,image?crypto.randomBytes(12).toString('hex'):null,Math.max(Date.now(),old.revision+1));}).immediate();res.json({ok:true,profile:profile(id)});
 }));
 app.get('/api/learner-profiles/:id/photo',auth,current,route((req,res)=>{guard(req,req.params.id);if(!user(req.params.id))fail(404,'المستخدم غير موجود');const p=row(req.params.id);if(!p?.photo)fail(404,'لا توجد صورة');res.setHeader('Content-Type',p.photo_mime);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Disposition','inline; filename="profile-photo"');res.send(p.photo);}));
 return {profile,history};
}
