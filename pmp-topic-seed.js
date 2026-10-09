// Add original training questions without overwriting trainer edits or disabling existing items.
export function seedPmpTopics(db, rows, packageIds) {
  const insert=db.prepare(`INSERT OR IGNORE INTO questions
    (id,package_id,domain,topic,difficulty,type,question_ar,question_en,options,options_ar,options_en,correct,correct_json,explanation_ar,explanation_en,reference,active,created,updated,approach,source_id,meta,is_official,priority,review_status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  let added=0;const now=Date.now();
  db.transaction(()=>{for(const pid of new Set(packageIds))for(const q of rows){
    if(!q.question_ar||!q.question_en||q.options_ar.length!==4||q.options_en.length!==4||!q.explanation_ar||!q.explanation_en||!['A','B','C','D'].includes(q.correct))throw Error('Invalid authored question '+q.id);
    const result=insert.run(q.id+'@'+pid,pid,q.domain,q.topic,'medium',q.type,q.question_ar,q.question_en,JSON.stringify(q.options_ar),JSON.stringify(q.options_ar),JSON.stringify(q.options_en),q.correct,JSON.stringify(q.correct_json),q.explanation_ar,q.explanation_en,q.reference,1,now,now,q.approach,q.id,JSON.stringify({phase:q.phase,source:'AlSaeed original topic practice',version:20261004}),0,60,'reviewed');added+=Number(result.changes||0);
  }})();return added;
}

// Preserve the uploaded package schema, including diagrams and interactive answer keys.
export function seedPmpSource(db, rows, packageIds) {
 const insert=db.prepare(`INSERT OR IGNORE INTO questions (id,package_id,domain,topic,difficulty,type,question_ar,question_en,options,options_ar,options_en,correct,correct_json,explanation_ar,explanation_en,reference,active,created,updated,approach,source_id,meta,is_official,priority,review_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
 let added=0;const now=Date.now();db.transaction(()=>{for(const pid of new Set(packageIds))for(const q of rows){if(!q.meta?.sourceV5||!q.question_ar||!q.question_en)throw Error('Invalid uploaded item '+q.id);added+=Number(insert.run(q.id+'@'+pid,pid,q.domain,q.topic,'medium',q.type,q.question_ar,q.question_en,JSON.stringify(q.options_ar),JSON.stringify(q.options_ar),JSON.stringify(q.options_en),q.correct,JSON.stringify(q.correct_json),q.explanation_ar,q.explanation_en,'Uploaded Al-Saeed PMP Platform v5',1,now,now,q.approach,q.id,JSON.stringify(q.meta),0,70,'needs_review').changes||0);const existing=db.prepare('SELECT meta FROM questions WHERE id=?').get(q.id+'@'+pid);let meta;try{meta=JSON.parse(existing.meta||'{}')}catch{meta={}}if(meta.classificationVersion!==20261006){meta.topics=q.meta.topics;meta.classificationBasis=q.meta.classificationBasis;meta.classificationVersion=20261006;db.prepare('UPDATE questions SET meta=? WHERE id=?').run(JSON.stringify(meta),q.id+'@'+pid)}}})();return added;
}

// Translate source-matching reference rows without overwriting trainer edits or learner history.
export function seedPmpReference(db, rows, packageIds) {
 const insert=db.prepare(`INSERT OR IGNORE INTO questions (id,package_id,domain,topic,difficulty,type,question_ar,question_en,options,options_ar,options_en,correct,correct_json,explanation_ar,explanation_en,reference,active,created,updated,approach,source_id,meta,is_official,priority,review_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
 const lookup=db.prepare('SELECT question_ar,question_en,explanation_ar,explanation_en,options_ar,options_en,meta FROM questions WHERE id=?');
 let added=0;const now=Date.now();
 db.transaction(()=>{for(const pid of new Set(packageIds))for(const q of rows){
  if(!q.question_ar||!q.question_en||!q.explanation_ar||!q.explanation_en||!q.options_ar.every(Boolean)||q.options_en.length!==q.options_ar.length||!q.options_en.every(Boolean)||!q.correct_json.length)throw Error('Invalid reference item '+q.id);
  const id=q.id+'@'+pid;
  added+=Number(insert.run(id,pid,q.domain,q.topic,'medium',q.type,q.question_ar,q.question_en,JSON.stringify(q.options_ar),JSON.stringify(q.options_ar),JSON.stringify(q.options_en),q.correct,JSON.stringify(q.correct_json),q.explanation_ar,q.explanation_en,q.reference,q.meta.reviewHold?0:1,now,now,'',q.id,JSON.stringify(q.meta),0,75,q.meta.reviewHold?'needs_review':'source_verified').changes||0);
  const existing=lookup.get(id);let meta;try{meta=JSON.parse(existing.meta||'{}')}catch{meta={}}
  if(existing.question_ar!==q.question_ar||existing.explanation_ar!==q.explanation_ar||existing.options_ar!==JSON.stringify(q.options_ar))continue;
  const question=existing.question_en?.trim()?existing.question_en:q.question_en;
  const explanation=existing.explanation_en?.trim()?existing.explanation_en:q.explanation_en;
  let options;try{options=JSON.parse(existing.options_en||'[]')}catch{options=[]}
  if(!Array.isArray(options)||!options.length||!options.some(Boolean))options=q.options_en;
  meta.ecoRevision=q.meta.ecoRevision;
  meta.optionFeedback={...meta.optionFeedback,ar:meta.optionFeedback?.ar||q.meta.optionFeedback?.ar,en:meta.optionFeedback?.en?.some(Boolean)?meta.optionFeedback.en:q.meta.optionFeedback.en};
  meta.translationRevision=q.meta.translationRevision;meta.translationProvenance=q.meta.translationProvenance;
  if(q.meta.reviewHold)meta.reviewHold=q.meta.reviewHold;
  db.prepare('UPDATE questions SET question_en=?,options_en=?,explanation_en=?,meta=? WHERE id=?').run(question,JSON.stringify(options),explanation,JSON.stringify(meta),id);
  if(q.meta.reviewHold)db.prepare("UPDATE questions SET active=0,review_status='needs_review' WHERE id=?").run(id);
 }})();return added;
}
