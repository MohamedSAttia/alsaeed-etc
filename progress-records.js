// Keep completed assessment records when a delayed tab writes an older snapshot.
// Video flags and other fields remain user-editable; this is not a completion grant.
export function mergeExamRecords(saved, incoming) {
  const map=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
  const exams={...map(saved.exams),...map(incoming.exams)};
  for(const [id,old] of Object.entries(map(saved.exams))){
    const next=map(incoming.exams)[id];
    if(old&&typeof old==='object' && (!next || Number(old.at||0)>Number(next.at||0))) exams[id]=old;
  }
  const merged={...incoming,exams};
  // This field is written only by the canonical simulation endpoint, never a stale browser snapshot.
  if(saved.referenceSimulation)merged.referenceSimulation=saved.referenceSimulation;
  else delete merged.referenceSimulation;
  if(saved.referenceSimulations)merged.referenceSimulations=saved.referenceSimulations;
  else delete merged.referenceSimulations;
  merged.activities={...map(incoming.activities)};
  for(const id of ['municipal-simulation','somu-S1','somu-S2','somu-S3']){
    if(map(saved.activities)['ref:'+id])merged.activities['ref:'+id]=true;
    else delete merged.activities['ref:'+id];
  }
  if(!incoming.activities&&!Object.keys(merged.activities).length)delete merged.activities;
  return merged;
}

const object = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const stamp = v => Number(v?.at || v?.updated || v?.updatedAt || 0);
// Full snapshots from old clients must not roll back another device. Absence is
// never deletion. A matching server revision still permits explicit unchecking.
export function mergeProgressRecords(saved, incoming, stale = false) {
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
