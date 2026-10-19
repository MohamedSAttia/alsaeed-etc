/** Run at complete repository root to ensure local runtime imports survive Docker allowlisting. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const docker=fs.readFileSync('Dockerfile','utf8'),ignore=fs.readFileSync('.dockerignore','utf8').split(/\r?\n/);
const copied=docker.split('\n').filter(l=>l.startsWith('COPY ')&&l.endsWith(' ./')).flatMap(l=>l.split(/\s+/).slice(1,-1));
assert.ok(copied.includes('lesson-actions.js'));assert.ok(ignore.includes('!lesson-actions.js'));assert.ok(copied.includes('curriculum-slots.js'));assert.ok(ignore.includes('!curriculum-slots.js'));
let edges=0;
for(const file of copied.filter(f=>f.endsWith('.js'))){
 const source=fs.readFileSync(file,'utf8');
 for(const match of source.matchAll(/(?:from\s+|require\(|import\()['"](\.\/[^'"]+)['"]/g)){
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1]));
  assert.ok(copied.includes(target),`${file} import ${target} must be copied`);
  assert.ok(ignore.includes('!'+target),`${target} must pass Docker context allowlist`);
  assert.ok(fs.existsSync(target),`${target} source must exist`);edges++;
 }
}
console.log(`PASS: ${edges} local runtime import edges covered by Docker COPY and context allowlist.`);
