// Authenticated practice drafts. Completion is learner-declared, never an examination grade.
export function practiceCatalog(definitions){return [...definitions.LIFE.map(x=>({id:'life:'+x.k,title:x.t,axis:x.k==='stake'?'stakeholders':x.k==='mon'?'monitoring':x.k==='plan'?'planning':x.k==='exec'?'execution':x.k==='close'?'closure':'framework'})),...definitions.PROC.L.map(x=>({id:'process:'+x.n,title:x.t,axis:x.d}))]}
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
function fieldsFor(id,d){if(id==='life:charter')return d.CHARTER.secs.flatMap(s=>s.f.map(f=>({...f,k:s.k+'.'+f.k})));if(id==='life:board')return d.BOARD.Q.map(q=>({k:q.k,l:[q.ar,q.en]}));if(id.startsWith('process:'))return [{k:'output',l:['المخرج التطبيقي','Practice output']}];return d.LIFE.find(x=>'life:'+x.k===id)?.f||[]}
export function validatePracticeInputs(id,inputs,d){
 if(!plain(inputs))throw Error('invalid_inputs');
 const text=x=>{if(typeof x!=='string'||x.length>10000)throw Error('invalid_text');return x.trim()};
 if(id==='life:stake'){if(Object.keys(inputs).some(k=>k!=='rows')||!Array.isArray(inputs.rows)||inputs.rows.length>40)throw Error('invalid_rows');return {rows:inputs.rows.map(row=>{if(!plain(row))throw Error('invalid_row');let out={};for(const [k,v]of Object.entries(row)){let f=d.SREG.cols.find(f=>f.k===k);if(!f)throw Error('unknown_field');out[k]=text(v);if(f.o&&out[k]&&!f.o.some(o=>o[0]===out[k]))throw Error('invalid_option')}return out})}}
 let fields=fieldsFor(id,d),out={};for(const [k,v]of Object.entries(inputs)){const f=fields.find(x=>x.k===k);if(!f)throw Error('unknown_field');out[k]=text(v);if(['num','score'].includes(f.ty)&&out[k]){const n=Number(out[k]);if(!Number.isFinite(n)||n<0||n>1e12||(f.ty==='score'&&(n>5||n<1)))throw Error('invalid_number')}if(f.opts&&out[k]&&!f.opts.some(o=>o[0]===out[k]))throw Error('invalid_option')};return out;
}
export function practiceMetrics(id,inputs){
 const n=k=>Number(inputs[k]);if(id==='life:case'){if(!['cost','benefit','years'].every(k=>inputs[k]!==''&&inputs[k]!=null))return null;const c=n('cost'),b=n('benefit'),y=n('years');return {payback:c>0&&b>0?c/b:null,roi:c>0&&b>=0&&y>0?(b*y-c)/c*100:null}}
 if(id==='life:mon'){if(!['bac','pv','ev','ac'].every(k=>inputs[k]!==''&&inputs[k]!=null))return null;const pv=n('pv'),ev=n('ev'),ac=n('ac'),bac=n('bac');return {cv:ev-ac,sv:ev-pv,cpi:ac>0?ev/ac:null,spi:pv>0?ev/pv:null,eac:ac>0&&ev>0?bac/(ev/ac):null}}
 return null;
}
export function toolSummary(db,userId,packageId){const rows=db.prepare('SELECT completed,updated FROM pmp_practice_drafts WHERE user_id=? AND package_id=?').all(userId,packageId);return {total:51,started:rows.length,completed:rows.filter(r=>r.completed===1).length,latestAt:rows.reduce((m,r)=>Math.max(m,r.updated||0),0)||null}}
export function createPmpPracticeTools({db,definitions,getPackages,userFromToken,sendJson,readJson}){
 db.prepare('CREATE TABLE IF NOT EXISTS pmp_practice_drafts(user_id TEXT NOT NULL,package_id TEXT NOT NULL,tool_id TEXT NOT NULL,data TEXT NOT NULL,completed INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(user_id,package_id,tool_id))').run();
 const catalog=practiceCatalog(definitions),rowState=r=>{let inputs;try{inputs=validatePracticeInputs(r.tool_id,JSON.parse(r.data),definitions)}catch{inputs=r.tool_id==='life:stake'?{rows:[]}:{}}return {toolId:r.tool_id,inputs,completed:!!r.completed,revision:r.revision,updated:r.updated,metrics:practiceMetrics(r.tool_id,inputs)}};
 return async(req,res,url)=>{
 const parts=url.pathname.slice('/api/pmp-practice-tools/'.length).split('/');let pid;try{pid=decodeURIComponent(parts[0])}catch{return sendJson(res,400,{error:'Invalid package'})}
 const user=userFromToken(req);if(!user)return sendJson(res,401,{error:'Sign in required'});
 const account=db.prepare('SELECT active,deleted_at,role FROM users WHERE id=?').get(user.id);if(!account||account.active===0||account.deleted_at)return sendJson(res,403,{error:'Account unavailable'});
 if(!getPackages().some(p=>p.id===pid&&String(p.course).toLowerCase()==='pmp'))return sendJson(res,404,{error:'Tools unavailable'});
 const enrollment=db.prepare('SELECT expires FROM enrollments WHERE user_id=? AND package_id=?').get(user.id,pid),enrolled=enrollment&&(!enrollment.expires||enrollment.expires>Date.now());
 if(account.role!=='admin'&&!enrolled)return sendJson(res,403,{error:'Active enrollment required'});res.setHeader('Cache-Control','private, no-store');
 if(req.method==='GET'&&parts.length===1){const states=Object.fromEntries(db.prepare('SELECT * FROM pmp_practice_drafts WHERE user_id=? AND package_id=?').all(user.id,pid).map(r=>[r.tool_id,rowState(r)]));return sendJson(res,200,{definitions,catalog,states,summary:toolSummary(db,user.id,pid)})}
 if(req.method!=='POST'||parts.length!==2||parts[1]!=='save')return sendJson(res,404,{error:'Unknown route'});
 if(!enrolled)return sendJson(res,403,{error:'Learner enrollment required to save'});
 let b,inputs;try{b=await readJson(req);if(!catalog.some(t=>t.id===b.toolId)||!Number.isInteger(b.expectedRevision)||b.expectedRevision<0||typeof b.completed!=='boolean')throw Error();inputs=validatePracticeInputs(b.toolId,b.inputs,definitions);if(b.completed&&!(b.toolId==='life:stake'?inputs.rows.some(r=>r.name):Object.values(inputs).some(Boolean)))throw Error()}catch{return sendJson(res,400,{error:'Check tool fields before saving'})}
 let result,conflict=false;db.transaction(()=>{const previous=db.prepare('SELECT * FROM pmp_practice_drafts WHERE user_id=? AND package_id=? AND tool_id=?').get(user.id,pid,b.toolId);if((previous?.revision||0)!==b.expectedRevision){conflict=true;result=previous?rowState(previous):null;return}const updated=Date.now(),revision=b.expectedRevision+1;db.prepare('INSERT INTO pmp_practice_drafts VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,package_id,tool_id) DO UPDATE SET data=excluded.data,completed=excluded.completed,revision=excluded.revision,updated=excluded.updated').run(user.id,pid,b.toolId,JSON.stringify(inputs),b.completed?1:0,revision,updated);result={toolId:b.toolId,inputs,completed:b.completed,revision,updated,metrics:practiceMetrics(b.toolId,inputs)}})();return sendJson(res,conflict?409:200,{state:result,summary:toolSummary(db,user.id,pid),...(conflict?{error:'A newer version is saved. Reload before editing.'}:{})});
 };
}
