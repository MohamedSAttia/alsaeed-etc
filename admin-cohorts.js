// Private administrative rosters, deliberately separate from course classroom
// groups (which carry trainer visibility and assignment audiences). No access grants.
export function createCohortStore(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS admin_cohorts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
    created INTEGER NOT NULL, updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS admin_cohort_members (
    cohort_id INTEGER NOT NULL, user_id TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
    updated INTEGER NOT NULL, PRIMARY KEY(cohort_id,user_id));
    CREATE INDEX IF NOT EXISTS admin_cohort_user ON admin_cohort_members(user_id,active);`);
  const fail=(message,status=400)=>{const e=new Error(message);e.status=status;throw e;};
  const group=id=>{
    if(!['string','number'].includes(typeof id)||!/^\d+$/.test(String(id))||!Number.isSafeInteger(Number(id))||Number(id)<1)fail('مجموعة غير صالحة');
    const row=db.prepare('SELECT * FROM admin_cohorts WHERE id=?').get(Number(id));
    if(!row)fail('المجموعة غير موجودة',404);return row;
  };
  const name=value=>{if(typeof value!=='string'||!value.trim()||value.trim().length>120)fail('اسم المجموعة مطلوب، بحد أقصى 120 حرفًا');return value.trim();};
  const ids=value=>{if(!Array.isArray(value)||value.length>500||value.some(x=>typeof x!=='string'||!x||x.length>200))fail('قائمة المتدربين غير صالحة (500 كحد أقصى)');return [...new Set(value)];};
  function validateMembers(values){const users=ids(values);for(const id of users)if(!db.prepare("SELECT id FROM users WHERE id=? AND role='student'").get(id))fail('يمكن إضافة حسابات المتدربين المسجلين فقط');return users;}
  function assign(cohortId,users){
    if(cohortId===undefined||cohortId===null||cohortId==='')return;
    const g=group(cohortId);if(!g.active)fail('استعد المجموعة المؤرشفة قبل إضافة متدربين');
    const valid=validateMembers(users),now=Date.now();
    const put=db.prepare('INSERT INTO admin_cohort_members(cohort_id,user_id,active,updated) VALUES(?,?,1,?) ON CONFLICT(cohort_id,user_id) DO UPDATE SET active=1,updated=excluded.updated');
    for(const id of valid)put.run(g.id,id,now);
  }
  function mutate(cohortId,users,fn){return db.transaction(()=>{assign(cohortId,users);return fn();})();}
  function list(){const members=db.prepare("SELECT m.cohort_id,m.user_id FROM admin_cohort_members m JOIN users u ON u.id=m.user_id WHERE m.active=1 AND u.role='student'").all();return db.prepare('SELECT * FROM admin_cohorts ORDER BY active DESC,name,id').all().map(g=>({...g,memberIds:members.filter(m=>m.cohort_id===g.id).map(m=>m.user_id)}));}
  return {list,assign,mutate,
    create(value){const n=name(value),now=Date.now();return Number(db.prepare('INSERT INTO admin_cohorts(name,created,updated) VALUES(?,?,?)').run(n,now,now).lastInsertRowid);},
    update(id,body){const g=group(id);if(body.active!==undefined&&typeof body.active!=='boolean')fail('حالة المجموعة غير صالحة');db.prepare('UPDATE admin_cohorts SET name=?,active=?,updated=? WHERE id=?').run(body.name===undefined?g.name:name(body.name),body.active===undefined?g.active:Number(body.active),Date.now(),g.id);},
    members(id,body){return db.transaction(()=>{const g=group(id);const add=validateMembers(body.add??[]),remove=ids(body.remove??[]);if(add.some(x=>remove.includes(x)))fail('لا يمكن إضافة وإزالة المتدرب في نفس العملية');if(add.length)assign(g.id,add);for(const u of remove)db.prepare('UPDATE admin_cohort_members SET active=0,updated=? WHERE cohort_id=? AND user_id=?').run(Date.now(),g.id,u);})();}
  };
}
export function mountAdminCohorts({app,db,auth,admin}){
  const store=createCohortStore(db);
  const handle=fn=>(req,res)=>{try{res.json(fn(req));}catch(e){res.status(e.status||500).json({error:e.status?e.message:'تعذّر حفظ المجموعة'});}};
  app.get('/api/admin/cohorts',auth,admin,handle(()=>({cohorts:store.list()})));
  app.post('/api/admin/cohorts',auth,admin,handle(req=>({id:store.create(req.body?.name)})));
  app.put('/api/admin/cohorts/:id',auth,admin,handle(req=>{store.update(req.params.id,req.body||{});return {ok:true};}));
  app.post('/api/admin/cohorts/:id/members',auth,admin,handle(req=>{store.members(req.params.id,req.body||{});return {ok:true};}));
  return store;
}
