import {demoLearningRelease as release} from './learning-fixture.mjs';
// In-memory fictional review adapter only. It makes no network calls or identity claims.
export function syntheticLearningApi(brand){
 const drafts=new Map(),requests=new Map();let sequence=0;const copy=v=>structuredClone(v),limits={rows:100,text:1000,textarea:8000,date:10,totalBytes:262144};
 const projection=d=>copy({workbook:d.workbook,schema:d.schema,values:d.values,limits});
 return function(path,options={}){
  const route=path.split('?')[0],body=options.body||{};
  if(route==='/grc-workspace/reader')return {packageId:'grcp-full',release:{revision:'fictional-demo-v1'},items:release.reader.items.map(({id,kind,title,availableLocales,contentRevision,sections})=>({id,kind,title,availableLocales,contentRevision,sectionCount:sections.length}))};
  if(route.startsWith('/grc-workspace/reader/')){const item=release.reader.items.find(x=>x.id===decodeURIComponent(route.split('/').at(-1)));if(!item)throw Error('reader_item_not_found');return {packageId:'grcp-full',item:copy(item)};}
  if(route==='/grc-workspace/workbooks'){
   if(options.method!=='POST')return {packageId:'grcp-full',forms:release.workbook.forms.map(({id,title,availableLocales,schemaRevision,element})=>({id,title,availableLocales,schemaRevision,element})),drafts:[...drafts.values()].map(d=>({...d.workbook,title:d.schema.title})),nextOffset:null,limits};
   if(requests.has(body.requestKey))return projection(drafts.get(requests.get(body.requestKey)));
   const schema=release.workbook.forms.find(f=>f.id===body.formId);if(!schema)throw Error('workbook_form_not_found');const id='demo-workbook-'+(++sequence),d={workbook:{id,packageId:'grcp-full',formId:schema.id,brand,provenance:body.provenance,evidenceStatus:'not_verified',status:'draft',version:1,created:Date.now(),updated:Date.now(),schemaRevision:schema.schemaRevision,release:{revision:'fictional-demo-v1',releaseId:'demo-only',releaseSha256:'c'.repeat(64)}},schema:copy(schema),values:copy(schema.defaultValues)};drafts.set(id,d);requests.set(body.requestKey,id);return projection(d);
  }
  if(route.startsWith('/grc-workspace/workbooks/')){const id=route.split('/')[3],d=drafts.get(id);if(!d)throw Error('workbook_not_found');
   if(route.endsWith('/save')){if(body.expectedVersion!==d.workbook.version)throw Error('workbook_changed');if(JSON.stringify(body.values)!==JSON.stringify(d.values)){d.values=copy(body.values);d.workbook.version++;d.workbook.updated=Date.now();}return projection(d);}
   if(route.endsWith('/export'))return {schemaVersion:'grc-learning-workbook-export-v1',demo:true,...projection(d),automatedProfessionalDecision:false,notice:{ar:'بيانات تجريبية افتراضية؛ ليست دليلاً على الامتثال.',en:'Fictional demo data; not compliance evidence.'}};
   return projection(d);
  }
  return undefined;
 };
}
