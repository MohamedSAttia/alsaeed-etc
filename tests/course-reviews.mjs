import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import { mountCourseReviews } from '../course-reviews.js';

test('public reviews enforce consent, ownership, bounds, privacy, upserts and withdrawal', async()=>{
  const db=new DatabaseSync(':memory:');let now=100000;
  db.exec(`CREATE TABLE users(id TEXT,active INTEGER);CREATE TABLE enrollments(user_id TEXT,package_id TEXT,expires INTEGER);
    INSERT INTO users VALUES('a',1),('b',1),('expired',1),('inactive',0),('outsider',1);
    INSERT INTO enrollments VALUES('a','pmp-full',NULL),('a','pmp-self',NULL),('b','pmp-self',0),('expired','pmp-full',1),('inactive','pmp-full',NULL),('outsider','rmp-full',NULL);`);
  const app=express();app.use(express.json());
  mountCourseReviews({app,db,now:()=>now,auth:(req,res,next)=>{if(!req.headers.authorization)return res.sendStatus(401);req.user={id:req.headers.authorization};next();},readList:key=>key==='content_courses'?[{id:'pmp'},{id:'rmp'}]:[{id:'pmp-full',course:'pmp'},{id:'pmp-self',course:'pmp'},{id:'rmp-full',course:'rmp'}]});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const request=async(method='',user='',body,course='pmp',suffix='')=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/course-reviews/${course}${suffix}`,{method:method||'GET',headers:{'Content-Type':'application/json',...(user?{authorization:user}:{})},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json().catch(()=>null)};};
  const payload={rating:5,body:'Great course',displayName:'Ali',publicConsent:true};
  try{
    assert.deepEqual((await request()).data,{count:0,average:null,reviews:[],selection:'All voluntarily published learner ratings; newest 50 entries shown.'});
    assert.equal((await request('PUT','',payload)).status,401);
    for(const user of ['outsider','expired','inactive'])assert.equal((await request('PUT',user,payload)).status,403);
    assert.equal((await request('PUT','a',payload,'unknown')).status,404);
    for(const rating of [0,6,1.5,'5'])assert.equal((await request('PUT','a',{...payload,rating})).status,400);
    for(const patch of [{publicConsent:false},{body:'a'.repeat(2001)},{displayName:'a'.repeat(41)},{body:'mail me at a@example.com'},{body:'Call +1 (555) 123-4567'},{body:'هاتف ٠١٢٣٤٥٦٧٨٩٠'},{displayName:'a@example.com'},{displayName:'+1 (555) 123-4567'},{displayName:'050 123 4567'},{displayName:'٠٥٠ ١٢٣ ٤٥٦٧'}])assert.equal((await request('PUT','a',{...payload,...patch})).status,400);
    assert.equal((await request('PUT','a',payload)).status,200);
    assert.equal((await request('PUT','a',payload)).status,429);
    assert.equal((await request('PUT','b',{...payload,rating:1,body:'Poor experience',displayName:''})).status,200);
    let result=(await request()).data;assert.equal(result.count,2);assert.equal(result.average,3);assert.equal(result.reviews.length,2);assert.ok(result.reviews.some(r=>r.rating===1));
    assert.ok(result.reviews.every(r=>!('user_id'in r)&&!('email'in r)&&!('phone'in r)));
    now+=10001;assert.equal((await request('PUT','a',{...payload,rating:3})).status,200);
    result=(await request()).data;assert.equal(result.count,2);assert.equal(result.average,2);
    assert.equal((await request('GET','a',undefined,'pmp','/mine')).data.review.rating,3);
    assert.equal((await request('GET','b',undefined,'pmp','/mine')).data.review.rating,1);
    db.exec("UPDATE enrollments SET expires=1 WHERE user_id='a'");
    assert.equal((await request('DELETE','a')).status,200);result=(await request()).data;assert.equal(result.count,1);assert.equal(result.average,1);
    assert.equal((await request('GET','a',undefined,'pmp','/mine')).data.review.published,0);
    assert.equal((await request('GET','a',undefined,'pmp','/mine')).data.eligible,false);
    assert.equal((await request('DELETE','b')).status,200);assert.equal((await request()).data.average,null);
    const insert=db.prepare('INSERT INTO course_reviews VALUES(?,?,?,?,?,?,?,?,?)');
    for(let i=0;i<51;i++)insert.run('synthetic-'+i,'pmp',i===0?1:5,'','Synthetic learner',1,now,now,now+i);
    result=(await request()).data;assert.equal(result.count,51);assert.equal(result.reviews.length,50);assert.equal(result.average,4.92);
    // Aggregation covers the oldest low rating even though the list is capped to the newest 50.
    assert.ok(result.reviews.every(r=>r.rating===5));
  }finally{await new Promise(r=>server.close(r));db.close();}
});
