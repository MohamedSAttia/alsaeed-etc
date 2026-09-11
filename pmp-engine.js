import jwt from 'jsonwebtoken';
import { createPmpEngine as createCorePmpEngine } from './pmp-engine-core.js';

function sendJson(res,status,body){
  const data=Buffer.from(JSON.stringify(body));
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':data.length,'cache-control':'no-store'});
  res.end(data);
}
async function readJson(req,limit=256*1024){
  return await new Promise((resolve,reject)=>{
    let size=0,chunks=[];
    req.on('data',c=>{size+=c.length;if(size>limit){reject(new Error('too large'));req.destroy();return}chunks.push(c)});
    req.on('end',()=>{if(!chunks.length)return resolve({});try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))}catch{reject(new Error('bad json'))}});
    req.on('error',reject);
  });
}
function adminUser(db,secret,req){
  if(!secret)return null;
  const h=String(req.headers.authorization||'');
  if(!h.startsWith('Bearer '))return null;
  try{
    const p=jwt.verify(h.slice(7),secret);
    if(p.role!=='admin')return null;
    const u=db.prepare("SELECT id,name,email,role,active FROM users WHERE id=? AND role='admin'").get(p.id);
    return u&&u.active!==0?u:null;
  }catch{return null}
}
function ensureQuestionMetadataColumns(db){
  const cols=db.prepare('PRAGMA table_info(questions)').all().map(x=>x.name);
  if(!cols.includes('task'))db.exec('ALTER TABLE questions ADD COLUMN task TEXT');
  if(!cols.includes('review_status'))db.exec("ALTER TABLE questions ADD COLUMN review_status TEXT DEFAULT 'needs_review'");
}

export function createPmpEngine(args){
  const {db,JWT_SECRET}=args;
  ensureQuestionMetadataColumns(db);
  const core=createCorePmpEngine(args);
  const coreHandle=core.handle;
  async function handle(req,res,url){
    const base='/api/pmp-2026';
    const sub=url.pathname.slice(base.length)||'/';
    const m=sub.match(/^\/admin\/question-meta\/([^/]+)$/);
    if(m&&req.method==='PUT'){
      const admin=adminUser(db,JWT_SECRET,req);
      if(!admin)return sendJson(res,401,{error:'يلزم تسجيل دخول المشرف'});
      const id=decodeURIComponent(m[1]);
      const old=db.prepare('SELECT id,task,review_status FROM questions WHERE id=?').get(id);
      if(!old)return sendJson(res,404,{error:'السؤال غير موجود'});
      let body;try{body=await readJson(req)}catch{return sendJson(res,400,{error:'بيانات غير صحيحة'})}
      const allowed=new Set(['needs_review','reviewed','approved','rejected']);
      const review=allowed.has(String(body.review_status||''))?String(body.review_status):String(old.review_status||'needs_review');
      const task=body.task===undefined?String(old.task||''):String(body.task||'').trim();
      db.prepare('UPDATE questions SET task=?,review_status=?,updated=? WHERE id=?').run(task,review,Date.now(),id);
      return sendJson(res,200,{ok:true,id,task,review_status:review});
    }
    return coreHandle(req,res,url);
  }
  return {...core,handle};
}
