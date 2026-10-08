export function seedRmpAdvanced(db,questions){
 if(questions.length!==115||new Set(questions.map(q=>q.id)).size!==115)throw Error('Invalid RMP advanced bank size');
 const insert=db.prepare('INSERT OR IGNORE INTO cls_content(kind,id,data,active,updated_by,updated) VALUES(?,?,?,1,NULL,?)');let added=0;
 db.exec('BEGIN');try{for(const q of questions){if(!q.q?.ar||!q.q.en||q.o.ar.length!==q.o.en.length||!q.x.ar||!q.x.en||!q.c.every(i=>Number.isInteger(i)&&i>=0&&i<q.o.ar.length))throw Error('Invalid RMP item '+q.id);added+=Number(insert.run('question',q.id,JSON.stringify(q),Date.now()).changes||0)}db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return added;
}
