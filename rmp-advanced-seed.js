export function seedRmpAdvanced(db, questions, excluded = []) {
 if (questions.length !== 115 || new Set(questions.map(q => q.id)).size !== 115) throw Error('Invalid RMP advanced bank size');
 const insert = db.prepare('INSERT OR IGNORE INTO cls_content(kind,id,data,active,updated_by,updated) VALUES(?,?,?,?,NULL,?)');
 let added = 0;
 db.exec('BEGIN');
 try {
  for (const q of questions) {
   if (!q.q?.ar || !q.q.en || q.o.ar.length !== q.o.en.length || !q.x.ar || !q.x.en || !q.c.length || new Set(q.c).size !== q.c.length || !q.c.every(i => Number.isInteger(i) && i >= 0 && i < q.o.ar.length)) throw Error('Invalid RMP item ' + q.id);
   added += Number(insert.run('question', q.id, JSON.stringify(q), 1, Date.now()).changes || 0);
  }
  // Archive replaced questions; retain their data for existing attempts.
  db.prepare("UPDATE cls_content SET active=0 WHERE kind='question' AND id GLOB 'RMPADV-*'").run();
  const disable = db.prepare("UPDATE cls_content SET active=0 WHERE kind='question' AND id=?");
  for (const q of excluded) { insert.run('question',q.id,JSON.stringify(q),0,Date.now());disable.run(q.id); }
  db.exec('COMMIT');
 } catch (e) { db.exec('ROLLBACK');throw e; }
 return added;
}
