/* Pure educational calculations shared by the server and browser. No state, network or evaluation. */
(function(root){
'use strict';
const number=x=>typeof x==='string'&&x.trim()!==''&&Number.isFinite(Number(x))&&Number(x)>=0?Number(x):null;
const rows=(v,k)=>Array.isArray(v?.[k])?v[k]:[];
const sum=(items,key)=>items.reduce((total,x)=>total+(number(x[key])??0),0);
function metrics(id,v,d){
 v=v||{};
 if(id==='agile:approach'){
  const factors=d?.AGILE?.factors||[],rated=factors.flatMap(f=>{const n=number(v[f.k]);return n!==null&&Number.isInteger(n)&&n>=1&&n<=5?[{key:f.k,value:n}]:[]});
  const n=rated.length;if(n<4)return {type:'approach',rated:n,required:4,suggestion:null};
  const values=rated.map(x=>x.value),average=values.reduce((a,b)=>a+b,0)/n,spread=Math.max(...values)-Math.min(...values);
  return {type:'approach',rated:n,required:4,average,spread,suggestion:spread>=3?'hybrid':average<=2.4?'predictive':average>=3.6?'agile':'hybrid',lowKeys:rated.filter(x=>x.value<=2).map(x=>x.key),highKeys:rated.filter(x=>x.value>=4).map(x=>x.key)};
 }
 if(id==='agile:scrum'){
  const team=rows(v,'team'),stories=rows(v,'stories'),sprints=rows(v,'sprints').filter(x=>x.id?.trim());
  const capacity=sum(team,'capacity'),capacityKnown=team.length>0&&team.every(x=>number(x.capacity)!==null);
  const details=sprints.map(s=>{const cards=stories.filter(x=>x.sprint===s.id);return {id:s.id,goal:s.goal||'',status:s.status||'',points:sum(cards,'points'),donePoints:sum(cards.filter(x=>x.status==='done'),'points'),notReady:cards.filter(x=>x.ready!=='yes').length,largeStories:cards.filter(x=>(number(x.points)??0)>=13).length,missingAcceptance:cards.filter(x=>!x.acceptance?.trim()).length,missingEstimates:cards.filter(x=>number(x.points)===null).length}});
  const closed=details.filter(x=>x.status==='closed'),velocity=closed.length&&closed.every(x=>x.missingEstimates===0)?{average:closed.reduce((a,s)=>a+s.donePoints,0)/closed.length,min:Math.min(...closed.map(x=>x.donePoints)),max:Math.max(...closed.map(x=>x.donePoints)),list:closed.map(x=>x.donePoints)}:null;
  const remaining=sum(stories.filter(x=>x.status!=='done'),'points'),estimatesMissing=stories.filter(x=>number(x.points)===null).length;
  const forecast=velocity&&!estimatesMissing?{remaining,optimistic:remaining===0?0:velocity.max>0?Math.ceil(remaining/velocity.max):null,likely:remaining===0?0:velocity.average>0?Math.ceil(remaining/velocity.average):null,pessimistic:remaining===0?0:velocity.min>0?Math.ceil(remaining/velocity.min):null}:null;
  return {type:'scrum',capacity,capacityKnown,sprints:details,velocity,forecast,remaining,estimatesMissing,unknownSprint:stories.filter(x=>x.sprint&&!sprints.some(s=>s.id===x.sprint)).length,unassigned:stories.filter(x=>!x.sprint).length};
 }
 if(id==='agile:kanban'){
  const cards=rows(v,'cards'),counts=Object.fromEntries(['todo','dev','test','done'].map(k=>[k,cards.filter(x=>x.column===k).length]));
  const limits={dev:number(v.devLimit),test:number(v.testLimit)},breaches=Object.entries(limits).filter(([k,limit])=>limit!==null&&counts[k]>limit).map(([column,limit])=>({column,limit,count:counts[column]}));
  return {type:'kanban',counts,limits,breaches,bottleneck:counts.test>counts.dev&&counts.test>=3,blocked:cards.filter(x=>x.blocker?.trim()).length,unplaced:cards.filter(x=>!Object.prototype.hasOwnProperty.call(counts,x.column)).length};
 }
 if(id==='agile:hybrid'){
  const areas=d?.AGILE?.hybridAreas||[],choices=areas.filter(a=>['predictive','agile','hybrid'].includes(v[a.k+'.approach'])).map(a=>({key:a.k,selected:v[a.k+'.approach'],suggested:a.suggested,aligned:v[a.k+'.approach']===a.suggested}));
  const interfaces=[];for(let i=0;i<choices.length;i++)for(let j=i+1;j<choices.length;j++){const a=choices[i],b=choices[j];if(a.selected!==b.selected&&a.selected!=='hybrid'&&b.selected!=='hybrid')interfaces.push({a:a.key,b:b.key})}
  return {type:'hybrid',choices,interfaces:interfaces.slice(0,4),unchosen:areas.length-choices.length};
 }
 return null;
}
root.PmpPracticeModel=Object.freeze({metrics});
})(globalThis);
