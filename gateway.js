import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import { createPmpEngine } from './pmp-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_PORT = Number(process.env.PORT || 3000);
const INNER_PROXY_PORT = Number(process.env.INNER_PROXY_PORT || 3101);
const INNER_APP_PORT = Number(process.env.INNER_APP_PORT || 3102);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'alsaeed.db');
const JWT_SECRET = process.env.JWT_SECRET || '';
const PANEL = String(process.env.ADMIN_PANEL_PATH || 'manage-x7k').replace(/^\/+|\/+$/g, '');

const child = spawn(process.execPath, ['proxy.js'], {
  env: { ...process.env, PORT: String(INNER_PROXY_PORT), INTERNAL_APP_PORT: String(INNER_APP_PORT) },
  stdio: 'inherit'
});
child.on('exit', (code, signal) => {
  console.error(`Inner proxy exited (code=${code}, signal=${signal || 'none'})`);
  process.exit(code ?? 1);
});

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

function ensureColumn(table, col, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(x => x.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
}
ensureColumn('questions', 'options_en', "TEXT DEFAULT '[]'");
ensureColumn('questions', 'options_ar', "TEXT DEFAULT '[]'");
ensureColumn('questions', 'approach', 'TEXT');
ensureColumn('questions', 'source_exam', 'TEXT');
ensureColumn('questions', 'source_id', 'TEXT');
ensureColumn('questions', 'correct_json', 'TEXT');
ensureColumn('questions', 'meta', 'TEXT');

// Repair the old PMP import: English text had been copied into both EN and AR fields.
try {
  db.prepare(`UPDATE questions SET
    question_ar = CASE WHEN TRIM(COALESCE(question_ar,'')) = TRIM(COALESCE(question_en,'')) THEN '' ELSE question_ar END,
    explanation_ar = CASE WHEN TRIM(COALESCE(explanation_ar,'')) = TRIM(COALESCE(explanation_en,'')) THEN '' ELSE explanation_ar END,
    options_en = CASE WHEN COALESCE(options_en,'') IN ('','[]') THEN options ELSE options_en END,
    options_ar = CASE WHEN COALESCE(options_ar,'')='' THEN '[]' ELSE options_ar END
    WHERE id LIKE 'PMP-%' OR source_id LIKE 'PMP-%'`).run();
} catch (e) { console.warn('PMP bilingual repair skipped:', e.message); }

function setting(key) {
  try { const r = db.prepare('SELECT v FROM settings WHERE k=?').get(key); return r ? r.v : ''; }
  catch { return ''; }
}
function setSetting(key, value) {
  db.prepare(`INSERT INTO settings (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=?`).run(key, value, value);
}
function getPackages() {
  try {
    const a = JSON.parse(setting('content_packages') || '[]');
    if (Array.isArray(a) && a.length) return a;
  } catch {}
  try { const a = JSON.parse(setting('catalog') || '[]'); return Array.isArray(a) ? a : []; }
  catch { return []; }
}
function savePackages(list) {
  const safe = Array.isArray(list) ? list : [];
  setSetting('content_packages', JSON.stringify(safe));
  setSetting('catalog', JSON.stringify(safe.filter(p => p.active !== false).map(p => ({
    id:p.id, ar:p.ar||p.title_ar||p.id, en:p.en||p.title_en||'', code:p.code||p.id,
    price:Number(p.price||0), currency:String(p.currency||'USD').toUpperCase(), days:Number(p.days||90), hours:Number(p.hours||0),
    type:String(p.type||''), cert:!!p.cert
  }))));
}

const pmp = createPmpEngine({ db, JWT_SECRET, getPackages, savePackages });

function sendJson(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','content-length':data.length,'cache-control':'no-store'});
  res.end(data);
}
async function readJson(req, limit = 12 * 1024 * 1024) {
  return await new Promise((resolve, reject) => {
    let n=0; const chunks=[];
    req.on('data', c => { n += c.length; if (n > limit) { reject(new Error('request too large')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('invalid json')); } });
    req.on('error', reject);
  });
}
function adminFromToken(req) {
  if (!JWT_SECRET) return null;
  const h=String(req.headers.authorization||''); if(!h.startsWith('Bearer ')) return null;
  try {
    const p=jwt.verify(h.slice(7),JWT_SECRET); if(p.role!=='admin') return null;
    const u=db.prepare("SELECT id,name,email,role,active FROM users WHERE id=? AND role='admin'").get(p.id);
    return u && u.active!==0 ? u : null;
  } catch { return null; }
}
function userFromToken(req) {
  if (!JWT_SECRET) return null;
  const h=String(req.headers.authorization||''); if(!h.startsWith('Bearer ')) return null;
  try {
    const p=jwt.verify(h.slice(7),JWT_SECRET);
    const u=db.prepare('SELECT id,name,email,role,active FROM users WHERE id=?').get(p.id);
    return u && u.active!==0 ? u : null;
  } catch { return null; }
}
function normalizeType(t) {
  const s=String(t||'').toLowerCase();
  if(['m','multiple','multi'].includes(s)) return 'multiple';
  if(['match','mt'].includes(s)) return 'matching';
  if(['order','or','sequence','sequencing'].includes(s)) return 'ordering';
  if(['fill','fb','calculation','calc'].includes(s)) return s==='calc'||s==='calculation'?'calculation':'fill_blank';
  if(['drag','dragdrop'].includes(s)) return 'drag_drop';
  if(['matching','drag_drop','ordering','hotspot','fill_blank','scenario'].includes(s)) return s;
  return 'single';
}
function letters(indices) { return (Array.isArray(indices)?indices:[]).map(i=>String.fromCharCode(65+Number(i))).join(','); }
function validDomain(d) {
  const s=String(d||'').toLowerCase().trim();
  if(s==='business environment') return 'business';
  return ['people','process','business'].includes(s)?s:'';
}
function arr(v) { return Array.isArray(v) ? v : []; }
function parseJson(v, fallback=[]) { try { return JSON.parse(v||''); } catch { return fallback; } }

function normalizeUploadedQuestion(q, i) {
  const objectOptions = Array.isArray(q.options) && q.options.some(x => x && typeof x === 'object');
  const optionsEn = objectOptions ? q.options.map(x=>String(x?.en||'')) : arr(q.o_en||q.o).map(String);
  const optionsAr = objectOptions ? q.options.map(x=>String(x?.ar||'')) : arr(q.o_ar).map(String);
  const correctFromObjects = objectOptions ? q.options.map((x,ix)=>x?.correct?ix:null).filter(x=>x!==null) : [];
  const correct = arr(q.c).length ? q.c.map(Number) : correctFromObjects;
  const questionEn = String(q.q_en ?? q.q ?? '').trim();
  const questionAr = String(q.q_ar ?? '').trim();
  return {
    id:'PMP-'+String(q.id ?? (i+1)).padStart(4,'0'), domain:validDomain(q.dm||q.domain),
    topic:String(q.ch||q.topic||'').trim(), type:normalizeType(q.t||q.type),
    questionEn, questionAr, optionsEn, optionsAr, correct,
    explanationEn:String(q.f_en ?? q.explain_en ?? q.f ?? '').trim(),
    explanationAr:String(q.f_ar ?? q.explain_ar ?? '').trim(),
    approach:String(q.ap||q.approach||'').trim(), sourceExam:String(q.ex||q.sourceExam||'').trim(),
    originalId:q.id ?? (i+1), reference:String(q.reference||'').trim()
  };
}

async function importPmpBank(req, res) {
  const admin=adminFromToken(req); if(!admin) return sendJson(res,401,{error:'يلزم تسجيل دخول المشرف'});
  let body; try{body=await readJson(req)}catch{return sendJson(res,400,{error:'تعذر قراءة ملف بنك الأسئلة'})}
  const rows=Array.isArray(body.questions)?body.questions.slice(0,5000):[];
  if(!rows.length)return sendJson(res,400,{error:'لا توجد أسئلة للاستيراد'});
  const packageId=pmp.packageId;
  const clean=rows.map(normalizeUploadedQuestion).filter(q=>q.questionEn&&q.domain&&q.optionsEn.length>=2&&q.correct.length);
  if(clean.length<Math.min(rows.length,100))return sendJson(res,400,{error:'صيغة بنك الأسئلة غير متوافقة'});

  const ins=db.prepare(`INSERT OR REPLACE INTO questions
    (id,package_id,domain,topic,difficulty,type,question_ar,question_en,options,options_ar,options_en,correct,
     explanation_ar,explanation_en,reference,active,created,updated,approach,source_exam,source_id,correct_json,meta)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const replace=body.replace!==false, now=Date.now();
  db.transaction(()=>{
    if(replace)db.prepare("DELETE FROM questions WHERE package_id=? AND (source_id LIKE 'PMP-%' OR id LIKE 'PMP-%')").run(packageId);
    for(const q of clean){
      const meta={source:'AlSaeed_PMP_Platform upload',originalId:q.originalId,approach:q.approach,sourceExam:q.sourceExam,chapter:q.topic,language:q.questionAr?'bilingual':'en'};
      const displayOptions=q.optionsAr.some(Boolean)?q.optionsAr:q.optionsEn;
      ins.run(q.id,packageId,q.domain,q.topic,'medium',q.type,q.questionAr,q.questionEn,JSON.stringify(displayOptions),JSON.stringify(q.optionsAr),JSON.stringify(q.optionsEn),letters(q.correct),q.explanationAr,q.explanationEn,q.reference,1,now,now,q.approach,q.sourceExam,q.id,JSON.stringify(q.correct),JSON.stringify(meta));
    }
  })();
  const stats=db.prepare(`SELECT domain,type,COUNT(*) n FROM questions WHERE package_id=? AND active=1 GROUP BY domain,type`).all(packageId);
  const total=db.prepare('SELECT COUNT(*) c FROM questions WHERE package_id=? AND active=1').get(packageId).c;
  const arabic=db.prepare("SELECT COUNT(*) c FROM questions WHERE package_id=? AND TRIM(COALESCE(question_ar,''))!=''").get(packageId).c;
  return sendJson(res,200,{ok:true,packageId,imported:clean.length,total,arabic,englishOnly:total-arabic,stats,
    expectedSimulation:{totalQuestions:180,durationMinutes:240,domains:{people:59,process:74,business:47},breaks:[{after:10,minutes:10},{after:94,minutes:10}]}});
}

async function handleQuestionAdmin(req,res,url){
  const admin=adminFromToken(req); if(!admin)return sendJson(res,401,{error:'يلزم تسجيل دخول المشرف'});
  const base='/api/admin-question-bank'; const sub=url.pathname.slice(base.length)||'/'; const parts=sub.split('/').filter(Boolean); const method=req.method||'GET';
  if(method==='GET' && parts.length===1){
    const pkg=decodeURIComponent(parts[0]);
    const rows=db.prepare('SELECT * FROM questions WHERE package_id=? ORDER BY id').all(pkg).map(r=>({
      ...r, active:!!r.active, options:parseJson(r.options,[]), options_en:parseJson(r.options_en,r.question_en?parseJson(r.options,[]):[]), options_ar:parseJson(r.options_ar,[])
    }));
    return sendJson(res,200,rows);
  }
  if(method==='POST' && parts.length===0){
    let b;try{b=await readJson(req)}catch{return sendJson(res,400,{error:'بيانات غير صحيحة'})}
    if(!b.package_id||(!String(b.question_ar||'').trim()&&!String(b.question_en||'').trim()))return sendJson(res,400,{error:'الباقة ونص السؤال مطلوبان'});
    const id='Q-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),now=Date.now();
    const en=arr(b.options_en).slice(0,8), arOpts=arr(b.options_ar).slice(0,8), display=arOpts.some(Boolean)?arOpts:en;
    db.prepare(`INSERT INTO questions (id,package_id,domain,topic,difficulty,type,question_ar,question_en,options,options_ar,options_en,correct,explanation_ar,explanation_en,reference,active,created,updated,approach,source_id,meta)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,b.package_id,validDomain(b.domain)||String(b.domain||''),b.topic||'',b.difficulty||'medium',normalizeType(b.type),b.question_ar||'',b.question_en||'',JSON.stringify(display),JSON.stringify(arOpts),JSON.stringify(en),String(b.correct||'A').toUpperCase(),b.explanation_ar||'',b.explanation_en||'',b.reference||'',b.active===false?0:1,now,now,b.approach||'',id,JSON.stringify({source:'admin'}));
    return sendJson(res,200,{ok:true,id});
  }
  if(parts.length===1 && method==='PUT'){
    const id=decodeURIComponent(parts[0]); const old=db.prepare('SELECT * FROM questions WHERE id=?').get(id); if(!old)return sendJson(res,404,{error:'السؤال غير موجود'});
    let b;try{b=await readJson(req)}catch{return sendJson(res,400,{error:'بيانات غير صحيحة'})}
    const en=Array.isArray(b.options_en)?b.options_en:parseJson(old.options_en,parseJson(old.options,[]));
    const arOpts=Array.isArray(b.options_ar)?b.options_ar:parseJson(old.options_ar,[]); const display=arOpts.some(Boolean)?arOpts:en;
    db.prepare(`UPDATE questions SET package_id=?,domain=?,topic=?,difficulty=?,type=?,question_ar=?,question_en=?,options=?,options_ar=?,options_en=?,correct=?,explanation_ar=?,explanation_en=?,reference=?,active=?,updated=?,approach=? WHERE id=?`)
      .run(b.package_id||old.package_id,validDomain(b.domain)||b.domain||old.domain,b.topic??old.topic,b.difficulty||old.difficulty,normalizeType(b.type||old.type),b.question_ar??old.question_ar,b.question_en??old.question_en,JSON.stringify(display),JSON.stringify(arOpts),JSON.stringify(en),String(b.correct||old.correct).toUpperCase(),b.explanation_ar??old.explanation_ar,b.explanation_en??old.explanation_en,b.reference??old.reference,b.active===false?0:1,Date.now(),b.approach??old.approach,id);
    return sendJson(res,200,{ok:true});
  }
  if(parts.length===1 && method==='DELETE'){
    db.prepare('DELETE FROM questions WHERE id=?').run(decodeURIComponent(parts[0])); return sendJson(res,200,{ok:true});
  }
  return sendJson(res,404,{error:'مسار بنك الأسئلة غير معروف'});
}

function handlePackageSummary(req,res){
  const admin=adminFromToken(req); if(!admin)return sendJson(res,401,{error:'يلزم تسجيل دخول المشرف'});
  const packs=getPackages();
  const q=db.prepare('SELECT package_id,COUNT(*) n FROM questions GROUP BY package_id').all();
  const l=db.prepare('SELECT package_id,COUNT(*) n FROM lessons GROUP BY package_id').all();
  const e=db.prepare('SELECT package_id,COUNT(*) n FROM exams GROUP BY package_id').all();
  const r=db.prepare('SELECT package_id,COUNT(*) n FROM resources GROUP BY package_id').all();
  const map=(a)=>Object.fromEntries(a.map(x=>[x.package_id,x.n])); const qm=map(q),lm=map(l),em=map(e),rm=map(r);
  return sendJson(res,200,packs.map(p=>({...p,counts:{questions:qm[p.id]||0,lessons:lm[p.id]||0,exams:em[p.id]||0,resources:rm[p.id]||0}})));
}

function handleLearnerQuestionBank(req,res,url){
  const u=userFromToken(req); if(!u)return sendJson(res,401,{error:'يلزم تسجيل الدخول'});
  const prefix='/api/learner-question-bank/';
  const packageId=decodeURIComponent(url.pathname.slice(prefix.length));
  if(!packageId)return sendJson(res,400,{error:'الباقة مطلوبة'});
  if(u.role!=='admin'){
    const en=db.prepare('SELECT id,expires FROM enrollments WHERE user_id=? AND package_id=?').get(u.id,packageId);
    if(!en)return sendJson(res,403,{error:'بنك الأسئلة متاح للمشتركين في هذه الباقة فقط'});
    if(en.expires && en.expires<Date.now())return sendJson(res,403,{error:'انتهت مدة الوصول إلى الباقة'});
  }
  const requested=Math.max(1,Math.min(2000,Number(url.searchParams.get('limit')||2000)));
  const rows=db.prepare('SELECT * FROM questions WHERE package_id=? AND active=1 ORDER BY RANDOM() LIMIT ?').all(packageId,requested);
  return sendJson(res,200,{packageId,total:rows.length,questions:rows.map(q=>({
    id:q.id,domain:q.domain||'',topic:q.topic||'',difficulty:q.difficulty||'medium',type:normalizeType(q.type),
    question_ar:q.question_ar||'',question_en:q.question_en||'',
    options_ar:parseJson(q.options_ar,[]),options_en:parseJson(q.options_en,parseJson(q.options,[])),
    correct:q.correct||'',correct_json:parseJson(q.correct_json,[]),
    explanation_ar:q.explanation_ar||'',explanation_en:q.explanation_en||'',reference:q.reference||'',approach:q.approach||''
  }))});
}

function urlPathIsAdmin(raw) { try { return new URL(raw || '/', 'http://local').pathname.startsWith('/' + PANEL); } catch { return false; } }

function forward(req,res){
  const headers={...req.headers};
  delete headers.connection;
  headers.host=req.headers.host||'al-ltc.com';
  const upstream=http.request({hostname:'127.0.0.1',port:INNER_PROXY_PORT,method:req.method,path:req.url,headers},up=>{
    const type=String(up.headers['content-type']||'').toLowerCase();
    const isHtml=type.includes('text/html') && req.method==='GET';
    if(!isHtml){res.writeHead(up.statusCode||502,up.headers);up.pipe(res);return;}
    const chunks=[];
    up.on('data',c=>chunks.push(c));
    up.on('end',()=>{
      let html=Buffer.concat(chunks).toString('utf8');
      const premium='<link rel="stylesheet" href="/premium-v2.css?v=20260903-1">';
      if(!urlPathIsAdmin(req.url) && !html.includes('/premium-v2.css')) html=html.includes('</head>')?html.replace('</head>',premium+'\n</head>'):premium+html;
      const outHeaders={...up.headers};
      delete outHeaders['content-length'];
      delete outHeaders['content-encoding'];
      outHeaders['cache-control']='no-cache';
      res.writeHead(up.statusCode||200,outHeaders);
      res.end(html);
    });
  });
  upstream.on('error',err=>{console.error('Gateway upstream error:',err.message);if(!res.headersSent)res.writeHead(502,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:'Temporary upstream error'}))});
  req.pipe(upstream);
}

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  try{
    if(req.method==='POST'&&url.pathname==='/api/pmp-2026/admin/import')return await importPmpBank(req,res);
    if(url.pathname.startsWith('/api/admin-question-bank'))return await handleQuestionAdmin(req,res,url);
    if(req.method==='GET'&&url.pathname==='/api/admin-package-summary')return handlePackageSummary(req,res);
    if(req.method==='GET'&&url.pathname.startsWith('/api/learner-question-bank/'))return handleLearnerQuestionBank(req,res,url);
    if(url.pathname.startsWith('/api/pmp-2026'))return await pmp.handle(req,res,url);
    return forward(req,res);
  }catch(err){console.error('Gateway request error:',err);if(!res.headersSent)return sendJson(res,500,{error:'حدث خطأ أثناء تنفيذ الطلب'});res.end()}
});

server.listen(PUBLIC_PORT,'0.0.0.0',()=>{console.log(`AL-SAEED gateway on ${PUBLIC_PORT}; proxy=${INNER_PROXY_PORT}; app=${INNER_APP_PORT}; PMP=${pmp.packageId}`)});
