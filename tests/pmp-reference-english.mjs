import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {seedPmpReference} from '../pmp-topic-seed.js';
const rows=JSON.parse(fs.readFileSync('data/pmp-pmi-reference-2026.json','utf8'));
const original=JSON.parse((await import('node:child_process')).execFileSync('git',['show','HEAD:data/pmp-pmi-reference-2026.json'],{encoding:'utf8'}));
assert.equal(rows.length,128);
rows.forEach((q,i)=>{
 assert.equal(q.question_ar,original[i].question_ar);
 assert.deepEqual(q.options_ar,original[i].options_ar);
 assert.deepEqual(q.correct_json,original[i].correct_json);
 assert.equal(q.question_en.includes('?'),true,q.id);
 assert.equal(q.options_en.length,q.options_ar.length);
 assert.equal(q.meta.optionFeedback.en.length,q.options_en.length);
 for(const value of [q.question_en,q.explanation_en,...q.options_en,...q.meta.optionFeedback.en]){
  assert(value.trim(),q.id);assert(!/[\u0600-\u06ff]/.test(value),q.id);
 }
});
const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE questions(id TEXT PRIMARY KEY,package_id TEXT,domain TEXT,topic TEXT,difficulty TEXT,type TEXT,question_ar TEXT,question_en TEXT,options TEXT,options_ar TEXT,options_en TEXT,correct TEXT,correct_json TEXT,explanation_ar TEXT,explanation_en TEXT,reference TEXT,active INTEGER,created INTEGER,updated INTEGER,approach TEXT,source_id TEXT,meta TEXT,is_official INTEGER,priority INTEGER,review_status TEXT)`);
const wrapper={prepare:s=>db.prepare(s),transaction:fn=>()=>{db.exec('BEGIN');try{fn();db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}}};
assert.equal(seedPmpReference(wrapper,rows,['pmp-full']),128);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM questions WHERE active=1').get().n,120);
const id=rows[0].id+'@pmp-full',custom=rows[1].id+'@pmp-full';
db.prepare("UPDATE questions SET question_en='',options_en='[]',explanation_en='',active=0,meta='{}' WHERE id=?").run(id);
db.prepare("UPDATE questions SET question_en='Trainer English',options_en='[\"Trainer option\"]',explanation_en='Trainer rationale' WHERE id=?").run(custom);
seedPmpReference(wrapper,rows,['pmp-full']);
const migrated=db.prepare('SELECT * FROM questions WHERE id=?').get(id);
assert.equal(migrated.question_en,rows[0].question_en);assert.equal(migrated.active,0);
assert.deepEqual(JSON.parse(migrated.options_en),rows[0].options_en);
assert.deepEqual(JSON.parse(migrated.meta).optionFeedback.en,rows[0].meta.optionFeedback.en);
assert.equal(db.prepare('SELECT question_en FROM questions WHERE id=?').get(custom).question_en,'Trainer English');
db.close();
console.log('PASS: 128 English stems/options/rationales; Arabic and keys retained; 8 inconsistent items held; blank existing rows migrated; trainer edits and inactive status retained.');
