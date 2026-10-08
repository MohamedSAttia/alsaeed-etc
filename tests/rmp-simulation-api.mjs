import express from 'express';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import assert from 'node:assert/strict';
import {mountClassroom} from '../classroom.js';
const db=new Database(':memory:');
db.exec("CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,role TEXT,phone TEXT,active INT,created INT); INSERT INTO users VALUES('qa','QA','qa@example.test','admin',NULL,1,0);");
const app=express();const secret='local-test-only-no-production-credential';
app.use('/classroom',express.static('public/classroom'));
mountClassroom(app,{db,JWT_SECRET:secret});
const server=app.listen(0,'127.0.0.1');
try {
 await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const response=await fetch(base+'/classroom/api/content',{headers:{authorization:'Bearer '+jwt.sign({id:'qa'},secret)}});
 assert.equal(response.status,200);const rows=await response.json();
 const active=rows.filter(r=>r.active&&r.data.src==='advanced2026');assert.equal(active.length,115);
 assert.equal(rows.filter(r=>!r.active&&r.id.startsWith('c')).length,7);
 for(const r of active.filter(r=>r.data.figure)){const svg=await fetch(base+r.data.figure.src);assert.equal(svg.status,200);assert.match(await svg.text(),/<svg/);}
 console.log('PASS: authenticated classroom API returns 115 new items, 7 exclusions and 15 available SVG figures.');
}finally{server.close();db.close();}
