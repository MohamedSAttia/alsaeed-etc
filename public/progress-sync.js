(function(root){
'use strict';
const object = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const stamp = v => Number(v?.at || v?.updated || v?.updatedAt || 0);
// Full snapshots from old clients must not roll back another device. Absence is
// never deletion. A matching server revision still permits explicit unchecking.
function mergeProgressRecords(saved, incoming, stale = false) {
  saved=object(saved);incoming=object(incoming);
  const out={...saved,...incoming};
  for(const key of new Set([...Object.keys(saved),...Object.keys(incoming)])){
    if(key.startsWith('_'))continue;
    const old=saved[key],next=incoming[key];
    if(next===undefined){out[key]=old;continue;}
    if(old&&typeof old==='object'&&!Array.isArray(old)){
      const values={...old,...object(next)};
      for(const [id,prev] of Object.entries(old)){
        const value=object(next)[id];
        if(value===undefined){values[id]=prev;continue;}
        if(key==='exams'){if(stamp(prev)>stamp(value))values[id]=prev;continue;}
        if(!stale)continue;
        if(key==='activities' && id.startsWith('ref:')){
          const ref=id.slice(4),a=Number(saved.referenceActivityUpdated?.[ref]||0),b=Number(incoming.referenceActivityUpdated?.[ref]||0);
          values[id]=b>a?value:prev;continue;
        }
        if(typeof prev==='boolean'&&typeof value==='boolean')values[id]=prev||value;
        else if(typeof prev==='number'&&typeof value==='number')values[id]=Math.max(prev,value);
        else if(value&&typeof value==='object'&&stamp(value)>stamp(prev))values[id]=value;
        else values[id]=prev;
      }
      out[key]=values;
    }else if(stale&&old!==undefined)out[key]=old;
  }
  delete out._serverRevision;delete out._summary;
  return out;
}

// Durable, owner-scoped snapshots; credentials are never written to the queue.
function create({storage,actor,send,onError=()=>{},onSaved=()=>{}}){
 const key='alsaeed_pending_progress_v1';let pending={};const running=new Map();
 try{const v=JSON.parse(storage.getItem(key)||'{}');if(v&&typeof v==='object'&&!Array.isArray(v))pending=v;}catch{}
 const persist=()=>{try{storage.setItem(key,JSON.stringify(pending));}catch{}};
 const identity=()=>{const a=actor();return a?.id&&a?.token?a:null;};
 function enqueue(pid,data){const a=identity();if(!a)return false;const k=JSON.stringify([a.id,pid]),snapshot=JSON.parse(JSON.stringify(data));
  // A stale local cache/GET on reload must not replace an unsent completed exam.
  const previous=pending[k]?.data?.exams;
  if(previous&&typeof previous==='object'){
    snapshot.exams={...snapshot.exams};
    for(const [id,result] of Object.entries(previous))if(result&&typeof result==='object'&&(!snapshot.exams[id]||Number(result.at||0)>Number(snapshot.exams[id].at||0)))snapshot.exams[id]=result;
  }
  pending[k]={owner:a.id,pid,data:snapshot,revision:String(Date.now())+':'+Math.random()};persist();return true;}
 function flush(pid){const a=identity();if(!a)return Promise.resolve(false);const k=JSON.stringify([a.id,pid]);if(running.has(k))return running.get(k);
  const job=(async()=>{let ok=true;while(pending[k]){const entry=pending[k],current=identity();if(!current||current.id!==entry.owner)return false;
   let response;try{response=await send(entry.pid,entry.data,current.token);}catch(e){ok=false;if(identity()?.id===entry.owner)onError(e);break;}
   if(pending[k]?.revision===entry.revision){delete pending[k];persist();}
   try{onSaved(entry.pid,response,entry.owner,pending[k]?.data||null);}catch{}
  }return ok;})();running.set(k,job);job.finally(()=>running.delete(k));return job;
 }
 function flushAll(){const a=identity();if(!a)return Promise.resolve([]);return Promise.all(Object.values(pending).filter(x=>x?.owner===a.id&&typeof x.pid==='string').map(x=>flush(x.pid)));}
 return{enqueue,flush,flushAll,hasPendingFor(owner,pid){return !!pending[JSON.stringify([owner,pid])];},peek(pid){const a=identity();return a?pending[JSON.stringify([a.id,pid])]?.data||null:null;},hasPending(pid){const a=identity();return !!a&&!!pending[JSON.stringify([a.id,pid])];}};
}
root.AlsaeedProgressSync={create,mergeProgressRecords};
})(typeof window!=='undefined'?window:globalThis);
