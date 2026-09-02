import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXAM_CODE = 'pmp-2026-full-180';
const SOURCE_TAG = 'alsaeed-pmp-upload-851-v1';
const CONFIG = Object.freeze({
  code: EXAM_CODE,
  title: 'PMP® 2026 — المحاكاة الكاملة',
  totalQuestions: 180,
  durationMinutes: 240,
  domainTargets: {
    people: { labelAr: 'الأفراد', weight: 33, count: 59 },
    process: { labelAr: 'العمليات', weight: 41, count: 74 },
    business: { labelAr: 'بيئة العمل', weight: 26, count: 47 }
  },
  scenarioBlock: { startQuestion: 1, endQuestion: 10, count: 10 },
  breaks: [
    { afterQuestion: 10, durationMinutes: 5, labelAr: 'الاستراحة الأولى' },
    { afterQuestion: 96, durationMinutes: 10, labelAr: 'الاستراحة الثانية' }
  ],
  timerPausesDuringBreak: true,
  typePolicy: 'include-every-active-type-when-available',
  supportedTypes: ['single','multiple','matching','drag_drop','ordering','hotspot','fill_blank','scenario'],
  sourceBankCount: 851,
  passScore: 65
});

function uid(prefix='') { return prefix + crypto.randomBytes(9).toString('base64url'); }
function shuffle(a) {
  const x = a.slice();
  for (let i=x.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [x[i],x[j]]=[x[j],x[i]]; }
  return x;
}
function safeJson(v, fallback) { try { return JSON.parse(v); } catch { return fallback; } }
function ensureColumn(db, table, col, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(x=>x.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
}
function normalizeType(t) {
  const s=String(t||'').toLowerCase();
  if (s==='s' || s==='mcq' || s==='single') return 'single';
  if (s==='m' || s==='multiple' || s==='multi') return 'multiple';
  if (CONFIG.supportedTypes.includes(s)) return s;
  return 'single';
}
function letters(indices) {
  return (Array.isArray(indices)?indices:[]).map(i=>String.fromCharCode(65+Number(i))).join(',');
}
function extractReference(text) {
  const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const refs=lines.filter(x=>/PMBOK|Agile Practice Guide|PMI Reference|Page\(s\)|\bPage\b/i.test(x));
  return refs.slice(0,4).join(' | ').slice(0,1500);
}
function looksScenario(q) {
  const text=String(q.question_ar||q.question_en||'');
  const situational=/(project manager|project team|stakeholder|sponsor|product owner|scrum|iteration|sprint|team member|vendor|customer|organization)/i.test(text);
  return text.length >= 145 && situational;
}
function getTokenUser(db, JWT_SECRET, req) {
  if (!JWT_SECRET) return null;
  const h=String(req.headers.authorization||'');
  if (!h.startsWith('Bearer ')) return null;
  try {
    const p=jwt.verify(h.slice(7),JWT_SECRET);
    return db.prepare('SELECT id,name,email,role,active FROM users WHERE id=?').get(p.id)||null;
  } catch { return null; }
}
function sendJson(res,status,body){const data=Buffer.from(JSON.stringify(body));res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':data.length,'cache-control':'no-store'});res.end(data)}
async function readJson(req,limit=1024*1024){return await new Promise((resolve,reject)=>{let n=0,ch=[];req.on('data',c=>{n+=c.length;if(n>limit){reject(new Error('too large'));req.destroy();return}ch.push(c)});req.on('end',()=>{if(!ch.length)return resolve({});try{resolve(JSON.parse(Buffer.concat(ch).toString('utf8')))}catch{reject(new Error('bad json'))}});req.on('error',reject)})}

export function createPmpEngine({ db, JWT_SECRET, getPackages, savePackages }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exam_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      package_id TEXT NOT NULL,
      exam_code TEXT NOT NULL,
      question_ids TEXT NOT NULL,
      answers TEXT DEFAULT '{}',
      flagged TEXT DEFAULT '[]',
      started INTEGER NOT NULL,
      updated INTEGER NOT NULL,
      finished INTEGER,
      status TEXT DEFAULT 'active',
      result TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_exam_sessions_user ON exam_sessions(user_id,exam_code,status);
  `);
  ensureColumn(db,'questions','approach','TEXT');
  ensureColumn(db,'questions','source_exam','TEXT');
  ensureColumn(db,'questions','source_id','TEXT');
  ensureColumn(db,'questions','correct_json','TEXT');
  ensureColumn(db,'questions','meta','TEXT');
  ensureColumn(db,'exams','config','TEXT DEFAULT "{}"');

  function ensurePmpPackage() {
    const list=getPackages();
    let p=list.find(x=>/pmp/i.test([x.id,x.code,x.en,x.ar].filter(Boolean).join(' ')));
    if (!p) {
      p={id:'pmp-2026',code:'PMP® 2026',ar:'PMP® 2026 — إدارة المشاريع الاحترافية',en:'PMP® 2026 Exam Preparation',desc:'باقة إعداد ومحاكاة PMP® 2026',price:0,currency:'USD',days:90,hours:35,active:false,featured:false,_chapters:[],created:Date.now(),updated:Date.now()};
      list.push(p); savePackages(list);
    }
    return p.id;
  }

  const packageId=ensurePmpPackage();

  function seedBank() {
    const qFile=path.join(__dirname,'data','pmp_qbank_851.json');
    if (!fs.existsSync(qFile)) { console.warn('PMP seed file missing:',qFile); return {seeded:0}; }
    const bank=JSON.parse(fs.readFileSync(qFile,'utf8'));
    if (!Array.isArray(bank) || !bank.length) return {seeded:0};
    const existing=db.prepare("SELECT COUNT(*) c FROM questions WHERE package_id=? AND source_id LIKE 'PMP-%'").get(packageId).c;
    if (existing>=bank.length) return {seeded:0,existing};
    const ins=db.prepare(`INSERT OR IGNORE INTO questions
      (id,package_id,domain,topic,difficulty,type,question_ar,question_en,options,correct,explanation_ar,explanation_en,reference,active,created,updated,approach,source_exam,source_id,correct_json,meta)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    let n=0;
    const tx=db.transaction(()=>{
      for(const q of bank){
        const sid='PMP-'+String(q.id).padStart(4,'0');
        const type=normalizeType(q.t);
        const correct=letters(q.c);
        const meta={source:SOURCE_TAG,originalId:q.id,approach:q.ap||'',sourceExam:q.ex||'',chapter:q.ch||'',scenarioCandidate:String(q.q||'').length>=145};
        const r=ins.run(sid,packageId,String(q.dm||'').toLowerCase(),q.ch||'', 'medium',type,q.q||'',q.q||'',JSON.stringify(q.o||[]),correct,q.f||'',q.f||'',extractReference(q.f),1,Date.now(),Date.now(),q.ap||'',q.ex||'',sid,JSON.stringify(q.c||[]),JSON.stringify(meta));
        n+=r.changes;
      }
    });
    tx(); return {seeded:n,total:bank.length};
  }

  function ensureExamTemplate() {
    const config={...CONFIG,packageId};
    const old=db.prepare('SELECT id FROM exams WHERE id=?').get(EXAM_CODE);
    if(!old){
      const now=Date.now();
      db.prepare(`INSERT INTO exams (id,package_id,title,kind,duration,question_count,pass_score,config,active,created,updated)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(EXAM_CODE,packageId,CONFIG.title,'full',CONFIG.durationMinutes,CONFIG.totalQuestions,CONFIG.passScore,JSON.stringify(config),1,now,now);
    } else {
      db.prepare(`UPDATE exams SET package_id=?,title=?,kind='full',duration=?,question_count=?,config=?,active=1,updated=? WHERE id=?`)
        .run(packageId,CONFIG.title,CONFIG.durationMinutes,CONFIG.totalQuestions,JSON.stringify(config),Date.now(),EXAM_CODE);
    }
  }

  const seedInfo=seedBank();
  ensureExamTemplate();
  console.log(`PMP 2026 engine: package=${packageId}; bank=${db.prepare('SELECT COUNT(*) c FROM questions WHERE package_id=?').get(packageId).c}; seeded=${seedInfo.seeded||0}`);

  function requireUser(req,res) {
    const u=getTokenUser(db,JWT_SECRET,req);
    if(!u){sendJson(res,401,{error:'يلزم تسجيل الدخول'});return null}
    if(u.active===0){sendJson(res,403,{error:'الحساب معطّل'});return null}
    if(u.role!=='admin'){
      const en=db.prepare('SELECT id,expires FROM enrollments WHERE user_id=? AND package_id=?').get(u.id,packageId);
      if(!en){sendJson(res,403,{error:'هذه المحاكاة متاحة للمشتركين في باقة PMP فقط'});return null}
      if(en.expires && en.expires<Date.now()){sendJson(res,403,{error:'انتهت مدة الوصول إلى باقة PMP'});return null}
    }
    return u;
  }

  function questionRowsByIds(ids) {
    if(!ids.length)return[];
    const placeholders=ids.map(()=>'?').join(',');
    const rows=db.prepare(`SELECT * FROM questions WHERE id IN (${placeholders})`).all(...ids);
    const map=new Map(rows.map(r=>[r.id,r]));
    return ids.map(id=>map.get(id)).filter(Boolean);
  }

  function chooseExamQuestions() {
    const rows=db.prepare('SELECT * FROM questions WHERE package_id=? AND active=1').all(packageId);
    const byDomain={people:[],process:[],business:[]};
    rows.forEach(q=>{const d=String(q.domain||'').toLowerCase();if(byDomain[d])byDomain[d].push(q)});
    for(const [d,t] of Object.entries(CONFIG.domainTargets)) if(byDomain[d].length<t.count) throw new Error(`بنك ${d} لا يكفي: ${byDomain[d].length}/${t.count}`);

    const selected=[]; const ids=new Set(); const used={people:0,process:0,business:0};
    const scenarioPool=shuffle(rows.filter(q=>looksScenario(q))).sort((a,b)=>String(b.question_ar||'').length-String(a.question_ar||'').length).slice(0,160);
    for(const q of shuffle(scenarioPool)){
      if(selected.length>=CONFIG.scenarioBlock.count)break;
      const d=String(q.domain||'').toLowerCase();
      if(!byDomain[d] || used[d]>=CONFIG.domainTargets[d].count || ids.has(q.id))continue;
      selected.push(q);ids.add(q.id);used[d]++;
    }
    if(selected.length<10){
      for(const q of shuffle(rows)){
        if(selected.length>=10)break;const d=String(q.domain||'').toLowerCase();
        if(!byDomain[d]||used[d]>=CONFIG.domainTargets[d].count||ids.has(q.id))continue;
        selected.push(q);ids.add(q.id);used[d]++;
      }
    }

    const activeTypes=[...new Set(rows.map(q=>normalizeType(q.type)))];
    const chosenTypes=new Set(selected.map(q=>normalizeType(q.type)));
    for(const type of activeTypes){
      if(chosenTypes.has(type))continue;
      const q=shuffle(rows.filter(x=>normalizeType(x.type)===type && !ids.has(x.id))).find(x=>{
        const d=String(x.domain||'').toLowerCase();return byDomain[d] && used[d]<CONFIG.domainTargets[d].count;
      });
      if(q){selected.push(q);ids.add(q.id);used[String(q.domain).toLowerCase()]++;chosenTypes.add(type)}
    }

    const extras=selected.slice(10);
    for(const [d,target] of Object.entries(CONFIG.domainTargets)){
      const need=target.count-used[d];
      const pool=shuffle(byDomain[d].filter(q=>!ids.has(q.id))).slice(0,need);
      if(pool.length!==need)throw new Error(`تعذر استكمال توزيع ${d}`);
      pool.forEach(q=>{extras.push(q);ids.add(q.id);used[d]++});
    }
    const first10=selected.slice(0,10);
    const final=[...first10,...shuffle(extras)];
    if(final.length!==180)throw new Error(`خطأ في عدد أسئلة المحاكاة: ${final.length}`);
    const counts=final.reduce((a,q)=>(a[q.domain]=(a[q.domain]||0)+1,a),{});
    if(counts.people!==59||counts.process!==74||counts.business!==47)throw new Error(`خطأ توزيع domains ${JSON.stringify(counts)}`);
    return final;
  }

  function sanitizeQuestion(q,index) {
    const meta=safeJson(q.meta,{});
    return {
      id:q.id,index:index+1,domain:q.domain,topic:q.topic,difficulty:q.difficulty,
      type:normalizeType(q.type),question:q.question_ar||q.question_en||'',question_en:q.question_en||'',
      options:safeJson(q.options,[]),approach:q.approach||'',scenario:index<10,
      meta:{scenarioText:meta.scenarioText||'',image:meta.image||'',pairs:meta.pairs||null,hotspots:meta.hotspots||null}
    };
  }

  function publicSession(row) {
    const ids=safeJson(row.question_ids,[]),answers=safeJson(row.answers,{}),flagged=safeJson(row.flagged,[]);
    const qs=questionRowsByIds(ids).map(sanitizeQuestion);
    return {id:row.id,status:row.status,started:row.started,updated:row.updated,config:{...CONFIG,packageId},questions:qs,answers,flagged};
  }

  function equivalentAnswer(q,answer) {
    const type=normalizeType(q.type);
    const idx=safeJson(q.correct_json,[]);
    const lettersExpected=idx.map(i=>String.fromCharCode(65+Number(i)));
    if(type==='multiple'){
      const a=(Array.isArray(answer)?answer:String(answer||'').split(',')).map(x=>String(x).trim().toUpperCase()).filter(Boolean).sort();
      return JSON.stringify(a)===JSON.stringify(lettersExpected.sort());
    }
    if(type==='fill_blank') return String(answer||'').trim().toLowerCase()===String(q.correct||'').trim().toLowerCase();
    if(['matching','drag_drop','ordering','hotspot'].includes(type)) {
      try { return JSON.stringify(answer)===JSON.stringify(safeJson(q.correct_json,[])); } catch { return false; }
    }
    const a=Array.isArray(answer)?answer[0]:answer;
    return String(a||'').trim().toUpperCase()===String(lettersExpected[0]||q.correct||'').trim().toUpperCase();
  }

  async function handle(req,res,url) {
    const u=requireUser(req,res);if(!u)return;
    const base='/api/pmp-2026';
    const sub=url.pathname.slice(base.length)||'/';
    const method=req.method||'GET';
    if(method==='GET' && sub==='/info'){
      const bank=db.prepare('SELECT type,domain,COUNT(*) n FROM questions WHERE package_id=? AND active=1 GROUP BY type,domain').all(packageId);
      return sendJson(res,200,{packageId,config:CONFIG,bank});
    }
    if(method==='POST' && sub==='/start'){
      const qs=chooseExamQuestions();
      const id=uid('PMPSESS-'),now=Date.now();
      db.prepare(`INSERT INTO exam_sessions (id,user_id,package_id,exam_code,question_ids,answers,flagged,started,updated,status) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(id,u.id,packageId,EXAM_CODE,JSON.stringify(qs.map(q=>q.id)),'{}','[]',now,now,'active');
      return sendJson(res,200,publicSession(db.prepare('SELECT * FROM exam_sessions WHERE id=?').get(id)));
    }
    const m=sub.match(/^\/session\/([^/]+)(?:\/(answer|flag|finish))?$/);
    if(m){
      const sid=decodeURIComponent(m[1]),action=m[2]||'';
      const row=db.prepare('SELECT * FROM exam_sessions WHERE id=? AND user_id=?').get(sid,u.id);
      if(!row)return sendJson(res,404,{error:'جلسة الاختبار غير موجودة'});
      if(method==='GET'&&!action)return sendJson(res,200,publicSession(row));
      if(row.status!=='active'&&action!=='finish')return sendJson(res,409,{error:'الاختبار منتهٍ'});
      if(method==='POST'&&action==='answer'){
        let b;try{b=await readJson(req)}catch{return sendJson(res,400,{error:'إجابة غير صحيحة'})}
        const ids=safeJson(row.question_ids,[]);const qid=String(b.questionId||'');if(!ids.includes(qid))return sendJson(res,400,{error:'السؤال غير موجود في هذه المحاولة'});
        const ans=safeJson(row.answers,{});ans[qid]=b.answer;db.prepare('UPDATE exam_sessions SET answers=?,updated=? WHERE id=?').run(JSON.stringify(ans),Date.now(),sid);return sendJson(res,200,{ok:true});
      }
      if(method==='POST'&&action==='flag'){
        let b;try{b=await readJson(req)}catch{return sendJson(res,400,{error:'بيانات غير صحيحة'})};let f=safeJson(row.flagged,[]);const qid=String(b.questionId||'');f=b.flagged?[...new Set([...f,qid])]:f.filter(x=>x!==qid);db.prepare('UPDATE exam_sessions SET flagged=?,updated=? WHERE id=?').run(JSON.stringify(f),Date.now(),sid);return sendJson(res,200,{ok:true,flagged:f});
      }
      if(method==='POST'&&action==='finish'){
        if(row.status==='finished')return sendJson(res,200,safeJson(row.result,{}));
        const ids=safeJson(row.question_ids,[]),answers=safeJson(row.answers,{}),qs=questionRowsByIds(ids);
        let correct=0;const domains={},types={},review=[];
        qs.forEach((q,i)=>{const ok=equivalentAnswer(q,answers[q.id]);if(ok)correct++;const d=q.domain||'other',t=normalizeType(q.type);domains[d]=domains[d]||{correct:0,total:0};domains[d].total++;if(ok)domains[d].correct++;types[t]=types[t]||{correct:0,total:0};types[t].total++;if(ok)types[t].correct++;review.push({id:q.id,index:i+1,correct:ok,answer:answers[q.id]??null,correctAnswer:q.correct,explanation:q.explanation_ar||q.explanation_en||'',reference:q.reference||'',domain:d,type:t})});
        const score=Math.round(correct/qs.length*10000)/100;Object.values(domains).forEach(x=>x.percent=Math.round(x.correct/x.total*10000)/100);Object.values(types).forEach(x=>x.percent=Math.round(x.correct/x.total*10000)/100);
        const result={sessionId:sid,total:qs.length,correct,score,passed:score>=CONFIG.passScore,domains,types,review,finishedAt:Date.now()};
        db.prepare("UPDATE exam_sessions SET status='finished',finished=?,updated=?,result=? WHERE id=?").run(Date.now(),Date.now(),JSON.stringify(result),sid);return sendJson(res,200,result);
      }
    }
    return sendJson(res,404,{error:'مسار PMP غير معروف'});
  }

  return { packageId, config:CONFIG, handle };
}
