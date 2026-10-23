// Package-enrolled learning resources and deterministic practice simulation. No exam-grade grants.
export function simulationResult(simulation, choices, now=Date.now()) {
  if(!Array.isArray(choices)||choices.length>simulation.STEPS.length)throw Error('invalid_choices');
  const indicators={...(simulation.initial||{sch:50,cst:50,stk:50,val:50})},feedback=[];
  choices.forEach((choice,i)=>{if(!Number.isInteger(choice)||choice<0||choice>=simulation.STEPS[i].o.length)throw Error('invalid_choices');const option=simulation.STEPS[i].o[choice];for(const key of Object.keys(indicators))indicators[key]=Math.max(0,Math.min(simulation.indicatorMax||100,indicators[key]+Number(option.d[key]||0)));feedback.push(option.fb)});
  return {id:simulation.id,simulationId:simulation.id,choices:[...choices],indicators,feedback,decisions:choices.length,completed:choices.length===simulation.STEPS.length,updated:now};
}
export function createPmpLearningLibrary({db,library,getPackages,userFromToken,sendJson,readJson}) {
  return async function handle(req,res,url){
    const parts=url.pathname.slice('/api/pmp-learning-library/'.length).split('/');
    let pid;try{pid=decodeURIComponent(parts[0]||'')}catch{return sendJson(res,400,{error:'Invalid package'})}
    const user=userFromToken(req);if(!user)return sendJson(res,401,{error:'Sign in required'});
    // Reload account status including soft-delete; token claims never grant learning access.
    const account=db.prepare('SELECT active,deleted_at,role FROM users WHERE id=?').get(user.id);
    if(!account||account.active===0||account.deleted_at)return sendJson(res,403,{error:'Account unavailable'});
    const pack=getPackages().find(p=>p.id===pid&&String(p.course).toLowerCase()==='pmp');
    if(!pack)return sendJson(res,404,{error:'Learning library unavailable for this package'});
    const enrollment=db.prepare('SELECT expires FROM enrollments WHERE user_id=? AND package_id=?').get(user.id,pid);
    if(account.role!=='admin'&&(!enrollment||(enrollment.expires&&enrollment.expires<=Date.now())))return sendJson(res,403,{error:'Active package enrollment required'});
    res.setHeader('Cache-Control','private, no-store');
    const saved=()=>{const row=db.prepare('SELECT data FROM progress WHERE user_id=? AND package_id=?').get(user.id,pid);try{const value=JSON.parse(row?.data||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return {}}};
    if(req.method==='GET'&&parts.length===1)return sendJson(res,200,{...library,state:saved().referenceSimulation||null,states:saved().referenceSimulations||{}});
    if(req.method==='POST'&&parts.length===2&&parts[1]==='simulation'){
      if(!enrollment||(enrollment.expires&&enrollment.expires<=Date.now()))return sendJson(res,403,{error:'An enrolled learner account is required to save practice'});
      let body,result;try{body=await readJson(req);const simulation=(library.simulations||[library.simulation]).find(s=>s.id===(body.simulationId||library.simulation.id));if(!simulation)throw Error('unknown_simulation');result=simulationResult(simulation,body.choices)}catch{return sendJson(res,400,{error:'Choose valid options in order'})}
      // Synchronous read/merge/write is atomic on this connection and preserves the other fields.
      db.transaction(()=>{const progress=saved();const previous=progress.referenceSimulations?.[result.id]||(result.id===library.simulation.id?progress.referenceSimulation:null);
        // A delayed second device must not rewind or fork the saved decision path.
        if(previous&&Array.isArray(previous.choices)&&previous.choices.length){
          const extendsPrevious=result.choices.length>=previous.choices.length&&previous.choices.every((choice,i)=>choice===result.choices[i]);
          if(!extendsPrevious||result.choices.length===previous.choices.length){result=previous;return;}
        }
        if(result.id===library.simulation.id)progress.referenceSimulation=result;progress.referenceSimulations=progress.referenceSimulations&&typeof progress.referenceSimulations==='object'&&!Array.isArray(progress.referenceSimulations)?progress.referenceSimulations:{};progress.referenceSimulations[result.id]=result;progress.activities=progress.activities&&typeof progress.activities==='object'&&!Array.isArray(progress.activities)?progress.activities:{};if(result.completed)progress.activities['ref:'+result.id]=true;
        const previousRevision=Number(db.prepare('SELECT updated FROM progress WHERE user_id=? AND package_id=?').get(user.id,pid)?.updated||0);result.updated=Math.max(result.updated,previousRevision+1);
        const data=JSON.stringify(progress);db.prepare(`INSERT INTO progress(user_id,package_id,data,updated) VALUES(?,?,?,?) ON CONFLICT(user_id,package_id) DO UPDATE SET data=excluded.data,updated=excluded.updated`).run(user.id,pid,data,result.updated);
      })();return sendJson(res,200,result);
    }
    return sendJson(res,404,{error:'Unknown learning resource route'});
  };
}
