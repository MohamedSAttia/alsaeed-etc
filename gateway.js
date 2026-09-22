import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import { createPmpEngine } from './pmp-engine.js';
import { createAiAssistant } from './ai-assistant.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_PORT = Number(process.env.PORT || 3000);
const INNER_PROXY_PORT = Number(process.env.INNER_PROXY_PORT || 3101);
const INNER_APP_PORT = Number(process.env.INNER_APP_PORT || 3102);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'alsaeed.db');
const JWT_SECRET = process.env.JWT_SECRET || '';
const uid = () => crypto.randomBytes(9).toString('base64url');
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

try {
  db.exec(`CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY, package_id TEXT NOT NULL,
  domain TEXT, topic TEXT, difficulty TEXT DEFAULT 'medium', type TEXT DEFAULT 'mcq',
  question_ar TEXT NOT NULL, question_en TEXT,
  options TEXT NOT NULL, correct TEXT NOT NULL,
  explanation_ar TEXT, explanation_en TEXT, reference TEXT,
  active INTEGER DEFAULT 1, created INTEGER NOT NULL, updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_package ON questions(package_id);
CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY, package_id TEXT NOT NULL, title TEXT NOT NULL,
  kind TEXT DEFAULT 'mini', duration INTEGER DEFAULT 60,
  question_count INTEGER DEFAULT 50, pass_score INTEGER DEFAULT 70,
  config TEXT DEFAULT '{}', active INTEGER DEFAULT 1,
  created INTEGER NOT NULL, updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exams_package ON exams(package_id);
CREATE TABLE IF NOT EXISTS lessons (
  package_id TEXT NOT NULL, idx INTEGER NOT NULL,
  title TEXT, title_en TEXT, chapter INTEGER, duration TEXT, vimeo TEXT,
  free INTEGER DEFAULT 0, notes TEXT, notes_en TEXT,
  PRIMARY KEY (package_id, idx)
);
CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY, package_id TEXT NOT NULL, title TEXT NOT NULL,
  type TEXT DEFAULT 'link', url TEXT, note TEXT, sort INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1, created INTEGER NOT NULL, updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_resources_package ON resources(package_id);
CREATE TABLE IF NOT EXISTS lesson_discussions (
  id TEXT PRIMARY KEY, package_id TEXT NOT NULL, lesson_idx INTEGER NOT NULL,
  user_id TEXT NOT NULL, parent_id TEXT, body TEXT NOT NULL,
  active INTEGER DEFAULT 1, created INTEGER NOT NULL, updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lesson_discussions_lesson
  ON lesson_discussions(package_id,lesson_idx,created);
CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT);
`);
} catch (e) { console.warn('content tables:', e.message); }

function ensureColumn(table, col, ddl) {
  try {
    const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
    if (!exists) return false;
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(x => x.name);
    if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
    return true;
  } catch { return false; }
}
ensureColumn('lessons', 'title_en', 'TEXT');
ensureColumn('lessons', 'notes', 'TEXT');
ensureColumn('lessons', 'notes_en', 'TEXT');
ensureColumn('questions', 'options_en', "TEXT DEFAULT '[]'");
ensureColumn('questions', 'options_ar', "TEXT DEFAULT '[]'");
ensureColumn('questions', 'approach', 'TEXT');
ensureColumn('questions', 'source_exam', 'TEXT');
ensureColumn('questions', 'source_id', 'TEXT');
ensureColumn('questions', 'correct_json', 'TEXT');
ensureColumn('questions', 'meta', 'TEXT');
ensureColumn('questions', 'is_official', 'INTEGER DEFAULT 0');
ensureColumn('questions', 'priority', 'INTEGER DEFAULT 0');
ensureColumn('questions', 'task', 'TEXT');
ensureColumn('questions', 'review_status', "TEXT DEFAULT 'needs_review'");

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
  db.exec('CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT)');
  db.prepare(`INSERT INTO settings (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=?`).run(key, value, value);
}
function getPackages() {
  try {
    const a = JSON.parse(setting('content_packages') || '[]');
    if (Array.isArray(a) && a.length) return a;
  } catch {}
  try {
    const a=JSON.parse(setting('catalog')||'[]');
    if(Array.isArray(a)&&a.length)return a;
  } catch {}
  try {
    const c=JSON.parse(fs.readFileSync(path.join(__dirname,'public','v15-catalog.json'),'utf8'));
    return Array.isArray(c.packages)?c.packages:[];
  } catch { return []; }
}

function seedOfficialQuestions() {
  try {
    const seedPath = path.join(__dirname, 'public', 'data', 'pmi-official-101.json');
    if (!fs.existsSync(seedPath)) return;
    const rows = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    const have = db.prepare("SELECT COUNT(*) c FROM questions WHERE id LIKE 'PMI-OFFICIAL-%'").get().c;
    if (have >= rows.length) return;
    const cols = db.prepare('PRAGMA table_info(questions)').all().map(x => x.name);
    const packageIds = ['pmp-full', 'pmp-sim', 'pmp-review'];
    const wanted = ['id','course','type','domain','topic','difficulty','question_en','question_ar',
      'options_en','options_ar','correct','correct_json','explanation_en','explanation_ar',
      'reference','active','is_official','priority','source_exam','source_id','package_id'];
    const info = db.prepare('PRAGMA table_info(questions)').all();
    const required = info.filter(c => c.notnull && c.dflt_value === null).map(c => c.name);
    const fields = [...new Set(wanted.filter(c => cols.includes(c)).concat(
      required.filter(c => cols.includes(c))))];
    const insert = db.prepare(`INSERT OR REPLACE INTO questions (${fields.join(',')})
      VALUES (${fields.map(c => '@' + c).join(',')})`);
    let sequence = 0;
    const transaction = db.transaction(list => list.forEach(row => {
      const values = {
        package_id: packageIds[sequence++ % packageIds.length],
        id: row.id, course: row.course, type: row.type, domain: row.domain,
        topic: row.topic, difficulty: row.difficulty,
        question_en: row.question_en || '', question_ar: row.question_ar || '',
        options_en: JSON.stringify(row.options_en || []),
        options_ar: JSON.stringify(row.options_ar || []),
        correct: row.correct || '', correct_json: JSON.stringify(row.correct_json || []),
        explanation_en: row.explanation_en || '', explanation_ar: row.explanation_ar || '',
        reference: row.reference || '', active: 1, is_official: 1, priority: 100,
        source_exam: row.source_exam || 'PMI Official', source_id: row.source_id || row.id
      };
      const params = {};
      fields.forEach(field => {
        if (values[field] !== undefined) { params[field] = values[field]; return; }
        if (field === 'options') params[field] = JSON.stringify(row.options_ar || row.options_en || []);
        else if (field === 'question') params[field] = row.question_ar || row.question_en || '';
        else if (field === 'explanation') params[field] = row.explanation_ar || row.explanation_en || '';
        else if (field === 'created' || field === 'updated') params[field] = Date.now();
        else params[field] = '';
      });
      insert.run(params);
    }));
    transaction(rows);
    console.log(`✅ بُذرت ${rows.length} سؤالاً رسمياً من PMI`);
  } catch (e) { console.warn('PMI official seed:', e.message); }
}
seedOfficialQuestions();

// Restore reviewed Arabic bundled with the platform into persistent banks.
// This is intentionally additive: admin translations already saved in the
// database are never overwritten.
function restoreBundledArabic() {
  try {
    const dataDir=path.join(__dirname,'public','data');
    const files=fs.readdirSync(dataDir).filter(x=>/^qbank-\d+\.json$/i.test(x));
    const update=db.prepare(`UPDATE questions SET question_ar=?,options_ar=?,explanation_ar=?,updated=? WHERE id=?`);
    // Imported banks can rename IDs and may also copy English text into the
    // Arabic fields. Only rows without real Arabic characters are eligible,
    // so genuine admin-reviewed Arabic is never overwritten.
    const hasArabic=value=>/[\u0600-\u06FF]/.test(String(value||''));
    const englishKey=value=>String(value||'')
      .replace(/<[^>]*>/g,' ')
      .replace(/&(?:nbsp|amp|quot|apos|#39|#x27);/gi,' ')
      .normalize('NFKC').toLowerCase()
      .replace(/[^a-z0-9]+/g,' ').trim();
    const courseNumber=value=>{
      const s=String(value||'').toUpperCase();
      const course=s.match(/(?:^|[-_])(RMP|GRCP)(?:[-_]|$)/)?.[1];
      const number=s.match(/(\d+)$/)?.[1];
      return course&&number?`${course}:${Number(number)}`:'';
    };
    const eligibleById=new Set(),byCourseNumber=new Map(),byEnglish=new Map();
    for(const row of db.prepare(`SELECT id,question_en,question_ar FROM questions`).all()){
      if(hasArabic(row.question_ar))continue;
      const id=String(row.id); eligibleById.add(id);
      const numbered=courseNumber(id);
      if(numbered){
        if(!byCourseNumber.has(numbered))byCourseNumber.set(numbered,[]);
        byCourseNumber.get(numbered).push(id);
      }
      const key=englishKey(row.question_en);
      if(!key)continue;
      if(!byEnglish.has(key))byEnglish.set(key,[]);
      byEnglish.get(key).push(id);
    }
    let restored=0,matchedByText=0,ambiguous=0;
    const tx=db.transaction(()=>{
      for(const file of files){
        const rows=JSON.parse(fs.readFileSync(path.join(dataDir,file),'utf8'));
        for(const q of Array.isArray(rows)?rows:[]){
          const questionAr=String(q?.q?.ar||'').trim(),optionsAr=Array.isArray(q?.o?.ar)?q.o.ar:[];
          if(!questionAr||!hasArabic(questionAr)||optionsAr.filter(Boolean).length<2)continue;
          const sourceId=String(q.id||'');
          let targetIds=eligibleById.has(sourceId)?[sourceId]:[];
          if(!targetIds.length){
            targetIds=(byCourseNumber.get(courseNumber(sourceId))||[]).filter(id=>eligibleById.has(id));
          }
          if(!targetIds.length){
            targetIds=(byEnglish.get(englishKey(q?.q?.en))||[]).filter(id=>eligibleById.has(id));
            matchedByText+=targetIds.length;
          }
          if(!targetIds.length)continue;
          for(const targetId of targetIds){
            restored+=update.run(questionAr,JSON.stringify(optionsAr),String(q?.x?.ar||'').trim(),Date.now(),targetId).changes;
            eligibleById.delete(targetId);
          }
        }
      }
    });
    tx();
    if(restored)console.log(`✅ استُعيدت العربية لـ ${restored} سؤالاً من الحزم المراجعة (${matchedByText} بمطابقة النص)`);
    if(ambiguous)console.warn(`Bundled Arabic restore skipped ${ambiguous} ambiguous English matches`);
  } catch(e) { console.warn('Bundled Arabic restore:',e.message); }
}
restoreBundledArabic();

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
const aiAssistant = createAiAssistant({ dbPath: DB_PATH, jwtSecret: JWT_SECRET });

function courseIdForPackage(packageId) {
  const id=String(packageId||'');
  const pkg=getPackages().find(p=>String(p.id)===id);
  return String(pkg?.course||id.split('-')[0]||id).toLowerCase();
}
function questionSourcePackageId(packageId, activeOnly=true) {
  const id=String(packageId||'');
  const activeSql=activeOnly?' AND active=1':'';
  const exact=db.prepare(`SELECT COUNT(*) c FROM questions WHERE package_id=?${activeSql}`).get(id).c;
  if(exact>0)return id;
  const course=courseIdForPackage(id);
  const candidates=[course,...getPackages().filter(p=>String(p.course||'').toLowerCase()===course).map(p=>String(p.id))];
  let best=id,bestCount=0;
  for(const candidate of [...new Set(candidates)]){
    const count=db.prepare(`SELECT COUNT(*) c FROM questions WHERE package_id=?${activeSql}`).get(candidate).c;
    if(count>bestCount){best=candidate;bestCount=count}
  }
  return bestCount?best:id;
}

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
function normalizedQuestionOptions(row) {
  const legacy=parseJson(row.options,[]);
  let ar=parseJson(row.options_ar,[]),en=parseJson(row.options_en,[]);
  if(Array.isArray(legacy)&&legacy.some(x=>x&&typeof x==='object'&&!Array.isArray(x))){
    if(!ar.some(Boolean))ar=legacy.map(x=>String(x.ar||''));
    if(!en.some(Boolean))en=legacy.map(x=>String(x.en||x.text||''));
  } else if(Array.isArray(legacy)&&legacy.some(Boolean)) {
    if(!ar.some(Boolean)&&!en.some(Boolean)){
      if(String(row.question_ar||'').trim()&&!String(row.question_en||'').trim())ar=legacy.map(String);
      else en=legacy.map(String);
    }
  }
  return { ar, en, display: ar.some(Boolean)?ar:(en.some(Boolean)?en:legacy) };
}

function normalizeUploadedQuestion(q, i) {
  const objectOptions = Array.isArray(q.options) && q.options.some(x => x && typeof x === 'object');
  const optionsEn = objectOptions ? q.options.map(x=>String(x?.en||'')) : arr(q.oe||q.o_en||q.o).map(String);
  const optionsAr = objectOptions ? q.options.map(x=>String(x?.ar||'')) : arr(q.oa||q.o_ar).map(String);
  const correctFromObjects = objectOptions ? q.options.map((x,ix)=>x?.correct?ix:null).filter(x=>x!==null) : [];
  const correct = arr(q.c||q.correct_json).length ? arr(q.c||q.correct_json).map(Number) : correctFromObjects;
  const questionEn = String(q.qe ?? q.q_en ?? q.question_en ?? q.q ?? '').trim();
  const questionAr = String(q.qa ?? q.q_ar ?? q.question_ar ?? '').trim();
  return {
    id:String(q.i||q.id||('PMP-'+String(i+1).padStart(4,'0'))),
    domain:({E:'people',R:'process',B:'business'}[String(q.d||'').toUpperCase()]||validDomain(q.dm||q.domain)),
    task:String(q.tk||q.task||'').trim(), topic:String(q.ch||q.topic||'').trim(), type:normalizeType(q.t||q.type),
    questionEn, questionAr, optionsEn, optionsAr, correct,
    explanationEn:String(q.xe ?? q.f_en ?? q.explain_en ?? q.explanation_en ?? q.f ?? '').trim(),
    explanationAr:String(q.xa ?? q.f_ar ?? q.explain_ar ?? q.explanation_ar ?? '').trim(),
    approach:String(q.ap||q.approach||'').trim(), sourceExam:String(q.ex||q.sourceExam||'').trim(),
    originalId:q.i||q.id||(i+1), reference:String(q.reference||'').trim(),
    sourceClass:String(q.s||''), priority:Number(q.p||90)
  };
}

function normalizeArabicText(value) {
  return String(value||'').replace(/\u06cc/g,'ي').replace(/\u06be/g,'ه');
}

function questionSignature(q) {
  return String(q.questionEn||q.questionAr||'')
    .toLowerCase().replace(/\s+/g,' ').replace(/[?؟.!،,;:]+$/g,'').trim();
}

async function importPmpBank(req, res) {
  const admin=adminFromToken(req); if(!admin) return sendJson(res,401,{error:'يلزم تسجيل دخول المشرف'});
  let body; try{body=await readJson(req)}catch{return sendJson(res,400,{error:'تعذر قراءة ملف بنك الأسئلة'})}
  const rows=Array.isArray(body.questions)?body.questions.slice(0,5000):[];
  if(!rows.length)return sendJson(res,400,{error:'لا توجد أسئلة للاستيراد'});
  const packageId=pmp.packageId;
  const clean=rows.map(normalizeUploadedQuestion).filter(q=>{
    const optionCount=Math.max(q.optionsEn.length,q.optionsAr.length);
    return (q.questionEn||q.questionAr) && q.domain && optionCount>=2 && q.correct.length &&
      q.correct.every(x=>Number.isInteger(x)&&x>=0&&x<optionCount);
  });
  if(clean.length<Math.min(rows.length,100))return sendJson(res,400,{error:'صيغة بنك الأسئلة غير متوافقة'});

  const signatures=new Map();
  const duplicateOf=new Map();
  for(const q of clean){
    const signature=questionSignature(q);
    if(!signature)continue;
    if(signatures.has(signature))duplicateOf.set(q.id,signatures.get(signature));
    else signatures.set(signature,q.id);
  }

  const ins=db.prepare(`INSERT OR REPLACE INTO questions
    (id,package_id,domain,topic,difficulty,type,question_ar,question_en,options,options_ar,options_en,correct,
     explanation_ar,explanation_en,reference,active,created,updated,approach,source_exam,source_id,correct_json,meta,
     is_official,priority,task,review_status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const replace=body.replace!==false, now=Date.now();
  db.transaction(()=>{
    if(replace)db.prepare("UPDATE questions SET active=0, review_status='needs_review', updated=? WHERE package_id=?").run(now,packageId);
    for(const q of clean){
      const arOptions=q.optionsAr.map(normalizeArabicText), enOptions=q.optionsEn;
      const questionAr=normalizeArabicText(q.questionAr), explanationAr=normalizeArabicText(q.explanationAr);
      const bilingual=!!(questionAr&&q.questionEn&&arOptions.filter(Boolean).length>=2&&enOptions.filter(Boolean).length>=2&&explanationAr&&q.explanationEn);
      const duplicate=duplicateOf.get(q.id)||'';
      const meta={source:'AlSaeed PMP Learning Hub V21',originalId:q.originalId,task:q.task,
        approach:q.approach,chapter:q.topic,sourceClass:q.sourceClass,language:bilingual?'bilingual':'needs_review',
        duplicateOf:duplicate||null,importVersion:21};
      const displayOptions=arOptions.some(Boolean)?arOptions:enOptions;
      ins.run(q.id,packageId,q.domain,q.topic,'medium',q.type,questionAr,q.questionEn,
        JSON.stringify(displayOptions),JSON.stringify(arOptions),JSON.stringify(enOptions),letters(q.correct),
        explanationAr,q.explanationEn,q.reference,1,now,now,q.approach,'PMP-V21:'+(q.sourceClass||'U'),q.id,
        JSON.stringify(q.correct),JSON.stringify(meta),q.sourceClass==='O'?1:0,q.priority,q.task,
        bilingual&&!duplicate?'reviewed':'needs_review');
    }
    db.prepare("UPDATE questions SET domain=LOWER(domain) WHERE package_id=? AND LOWER(domain) IN ('people','process','business')").run(packageId);
    db.prepare("UPDATE questions SET domain='business' WHERE package_id=? AND LOWER(domain)='business environment'").run(packageId);
    setSetting('pmp_learning_bank_version',`pmp-learning-bank-${clean.length}-v21`);
  })();
  const stats=db.prepare(`SELECT domain,type,COUNT(*) n FROM questions WHERE package_id=? AND active=1 GROUP BY domain,type`).all(packageId);
  const total=db.prepare('SELECT COUNT(*) c FROM questions WHERE package_id=? AND active=1').get(packageId).c;
  const arabic=db.prepare("SELECT COUNT(*) c FROM questions WHERE package_id=? AND active=1 AND TRIM(COALESCE(question_ar,''))!=''").get(packageId).c;
  const english=db.prepare("SELECT COUNT(*) c FROM questions WHERE package_id=? AND active=1 AND TRIM(COALESCE(question_en,''))!=''").get(packageId).c;
  const bilingual=db.prepare("SELECT COUNT(*) c FROM questions WHERE package_id=? AND active=1 AND TRIM(COALESCE(question_ar,''))!='' AND TRIM(COALESCE(question_en,''))!=''").get(packageId).c;
  return sendJson(res,200,{ok:true,packageId,imported:clean.length,rejected:rows.length-clean.length,total,arabic,english,bilingual,englishOnly:english-bilingual,arabicOnly:arabic-bilingual,
    duplicateTextGroups:duplicateOf.size,reviewRequired:clean.filter(q=>duplicateOf.has(q.id)||!q.questionEn||!q.explanationEn||q.optionsEn.filter(Boolean).length<2).length,stats,
    expectedSimulation:{totalQuestions:180,durationMinutes:240,domains:{people:59,process:74,business:47},breaks:[{after:10,minutes:5},{after:94,minutes:10}]}});
}

async function handleQuestionAdmin(req,res,url){
  const admin=adminFromToken(req); if(!admin)return sendJson(res,401,{error:'يلزم تسجيل دخول المشرف'});
  const base='/api/admin-question-bank'; const sub=url.pathname.slice(base.length)||'/'; const parts=sub.split('/').filter(Boolean); const method=req.method||'GET';
  if(method==='GET' && parts.length===1){
    const pkg=decodeURIComponent(parts[0]);
    const sourcePkg=questionSourcePackageId(pkg,true);
    const rows=db.prepare('SELECT * FROM questions WHERE package_id=? ORDER BY id').all(sourcePkg).map(r=>{const o=normalizedQuestionOptions(r);return {
      ...r, active:!!r.active, options:o.display, options_en:o.en, options_ar:o.ar
    }});
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
  const q=db.prepare('SELECT package_id,COUNT(*) n FROM questions WHERE active=1 GROUP BY package_id').all();
  const l=db.prepare('SELECT package_id,COUNT(*) n FROM lessons GROUP BY package_id').all();
  const e=db.prepare('SELECT package_id,COUNT(*) n FROM exams GROUP BY package_id').all();
  const r=db.prepare('SELECT package_id,COUNT(*) n FROM resources GROUP BY package_id').all();
  const map=(a)=>Object.fromEntries(a.map(x=>[x.package_id,x.n])); const qm=map(q),lm=map(l),em=map(e),rm=map(r);
  return sendJson(res,200,packs.map(p=>{const source=questionSourcePackageId(p.id,true);return {...p,questionSource:source,counts:{questions:qm[p.id]||qm[source]||0,lessons:lm[p.id]||0,exams:em[p.id]||0,resources:rm[p.id]||0}}}));
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
  const sourcePackageId=questionSourcePackageId(packageId,true);
  const requested=Math.max(1,Math.min(2000,Number(url.searchParams.get('limit')||2000)));
  const filters=['package_id=?','active=1'], params=[sourcePackageId];
  const domain=String(url.searchParams.get('domain')||'').trim().toLowerCase();
  const topic=String(url.searchParams.get('topic')||'').trim();
  if(domain){
    const aliases={people:['people','e'],process:['process','r'],business:['business','business environment','b']}[domain]||[domain];
    filters.push(`LOWER(TRIM(domain)) IN (${aliases.map(()=>'?').join(',')})`);params.push(...aliases)
  }
  if(topic){filters.push('topic=?');params.push(topic)}
  const rows=db.prepare(`SELECT * FROM questions WHERE ${filters.join(' AND ')}
    ORDER BY COALESCE(is_official,0) DESC, COALESCE(priority,0) DESC, RANDOM()
    LIMIT ?`).all(...params,requested);
  const questions=rows.map(q=>{const o=normalizedQuestionOptions(q);return {
    id:q.id,domain:q.domain||'',task:q.task||'',topic:q.topic||'',difficulty:q.difficulty||'medium',type:normalizeType(q.type),
    question_ar:q.question_ar||'',question_en:q.question_en||'',
    options_ar:o.ar,options_en:o.en,
    correct:q.correct||'',correct_json:parseJson(q.correct_json,[]),
    explanation_ar:q.explanation_ar||'',explanation_en:q.explanation_en||'',reference:q.reference||'',approach:q.approach||'',
    source_exam:q.source_exam||'',is_official:!!q.is_official,priority:Number(q.priority||0),review_status:q.review_status||'needs_review'
  }});
  return sendJson(res,200,{packageId,sourcePackageId,total:rows.length,filters:{domain:domain||null,topic:topic||null},questions});
}

function lessonAccess(user, packageId) {
  if(!user)return false;
  if(['admin','trainer','instructor'].includes(String(user.role||'').toLowerCase()))return true;
  const enrollment=db.prepare('SELECT expires FROM enrollments WHERE user_id=? AND package_id=?').get(user.id,packageId);
  return !!(enrollment&&(!enrollment.expires||enrollment.expires>=Date.now()));
}
async function handleLessonDiscussions(req,res,url){
  const user=userFromToken(req);if(!user)return sendJson(res,401,{error:'سجّل الدخول لعرض أسئلة الدرس'});
  const prefix='/api/lesson-discussions/';
  const parts=url.pathname.slice(prefix.length).split('/').filter(Boolean);
  const packageId=decodeURIComponent(parts[0]||''),lessonIdx=Number(parts[1]);
  if(!packageId||!Number.isInteger(lessonIdx)||lessonIdx<0)return sendJson(res,400,{error:'بيانات الدرس غير صحيحة'});
  if(!lessonAccess(user,packageId))return sendJson(res,403,{error:'الأسئلة متاحة للمشتركين في هذه الباقة'});
  const staff=['admin','trainer','instructor'].includes(String(user.role||'').toLowerCase());
  if(req.method==='GET'){
    const rows=db.prepare(`SELECT d.id,d.parent_id,d.body,d.created,d.updated,u.name,u.role,d.user_id
      FROM lesson_discussions d LEFT JOIN users u ON u.id=d.user_id
      WHERE d.package_id=? AND d.lesson_idx=? AND d.active=1 ORDER BY d.created`).all(packageId,lessonIdx);
    return sendJson(res,200,{packageId,lessonIdx,canReply:staff,items:rows.map(x=>({...x,mine:x.user_id===user.id}))});
  }
  if(req.method==='POST'){
    let body;try{body=await readJson(req,64*1024)}catch{return sendJson(res,400,{error:'تعذر قراءة السؤال'})}
    const text=String(body.body||'').trim(),parentId=String(body.parentId||'').trim()||null;
    if(text.length<2||text.length>2000)return sendJson(res,400,{error:'اكتب سؤالًا أو تعليقًا من حرفين إلى 2000 حرف'});
    if(parentId&&!staff)return sendJson(res,403,{error:'الردود مخصصة للمدرب أو المشرف'});
    if(parentId){const parent=db.prepare('SELECT id FROM lesson_discussions WHERE id=? AND package_id=? AND lesson_idx=? AND parent_id IS NULL AND active=1').get(parentId,packageId,lessonIdx);if(!parent)return sendJson(res,404,{error:'السؤال الأصلي غير موجود'})}
    const id=uid(),now=Date.now();
    db.prepare('INSERT INTO lesson_discussions (id,package_id,lesson_idx,user_id,parent_id,body,active,created,updated) VALUES (?,?,?,?,?,?,1,?,?)')
      .run(id,packageId,lessonIdx,user.id,parentId,text,now,now);
    return sendJson(res,200,{ok:true,id});
  }
  return sendJson(res,405,{error:'العملية غير مدعومة'});
}

function handleLearnerResources(req,res,url){
  const u=userFromToken(req); if(!u)return sendJson(res,401,{error:'يلزم تسجيل الدخول'});
  const prefix='/api/learner-resources/';
  const packageId=decodeURIComponent(url.pathname.slice(prefix.length));
  if(!packageId)return sendJson(res,400,{error:'الباقة مطلوبة'});
  if(u.role!=='admin'){
    const en=db.prepare('SELECT id,expires FROM enrollments WHERE user_id=? AND package_id=?').get(u.id,packageId);
    if(!en)return sendJson(res,403,{error:'موارد الباقة متاحة للمشتركين فقط'});
    if(en.expires&&en.expires<Date.now())return sendJson(res,403,{error:'انتهت مدة الوصول إلى الباقة'});
  }
  const rows=db.prepare(`SELECT id,title,type,url,note,sort FROM resources
    WHERE package_id=? AND active=1 ORDER BY sort,created`).all(packageId);
  return sendJson(res,200,{packageId,resources:rows});
}

function urlPathIsAdmin(raw) { try { return new URL(raw || '/', 'http://local').pathname.startsWith('/' + PANEL); } catch { return false; } }

function forward(req,res){
  const headers={...req.headers};
  delete headers.connection;
  delete headers['accept-encoding'];
  headers.host=req.headers.host||'al-ltc.com';
  const upstream=http.request({hostname:'127.0.0.1',port:INNER_PROXY_PORT,method:req.method,path:req.url,headers},up=>{
    const type=String(up.headers['content-type']||'').toLowerCase();
    const isHtml=type.includes('text/html') && req.method==='GET';
    if(!isHtml){res.writeHead(up.statusCode||502,up.headers);up.pipe(res);return;}
    const chunks=[];
    up.on('data',c=>chunks.push(c));
    up.on('end',()=>{
      const raw=Buffer.concat(chunks);
      const encoding=String(up.headers['content-encoding']||'').toLowerCase();
      let body;
      try {
        if(encoding==='br') body=zlib.brotliDecompressSync(raw);
        else if(encoding==='gzip'||encoding==='x-gzip') body=zlib.gunzipSync(raw);
        else if(encoding==='deflate') body=zlib.inflateSync(raw);
        else body=raw;
      } catch (e) {
        console.warn('HTML decompression skipped:', e.message);
        res.writeHead(up.statusCode||200,up.headers);
        res.end(raw);
        return;
      }
      let html=body.toString('utf8');
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
    if(url.pathname.startsWith('/api/ai/'))return await aiAssistant.handle(req,res,url);
    if(req.method==='POST'&&url.pathname==='/api/pmp-2026/admin/import')return await importPmpBank(req,res);
    if(url.pathname.startsWith('/api/admin-question-bank'))return await handleQuestionAdmin(req,res,url);
    if(req.method==='GET'&&url.pathname==='/api/admin-package-summary')return handlePackageSummary(req,res);
    if(req.method==='GET'&&url.pathname.startsWith('/api/learner-question-bank/'))return handleLearnerQuestionBank(req,res,url);
    if(url.pathname.startsWith('/api/lesson-discussions/'))return await handleLessonDiscussions(req,res,url);
    if(req.method==='GET'&&url.pathname.startsWith('/api/learner-resources/'))return handleLearnerResources(req,res,url);
    if(url.pathname.startsWith('/api/pmp-2026'))return await pmp.handle(req,res,url);
    return forward(req,res);
  }catch(err){console.error('Gateway request error:',err);if(!res.headersSent)return sendJson(res,500,{error:'حدث خطأ أثناء تنفيذ الطلب'});res.end()}
});

server.listen(PUBLIC_PORT,'0.0.0.0',()=>{console.log(`AL-SAEED gateway on ${PUBLIC_PORT}; proxy=${INNER_PROXY_PORT}; app=${INNER_APP_PORT}; PMP=${pmp.packageId}`)});
