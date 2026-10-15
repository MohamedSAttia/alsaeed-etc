import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const docker=read('Dockerfile'),ignore=read('.dockerignore');
const copied=new Set(docker.split('\n').filter(line=>line.startsWith('COPY ')&&line.endsWith(' ./')).flatMap(line=>line.trim().split(/\s+/).slice(1,-1)));
const allowed=new Set(ignore.split('\n').filter(line=>line.startsWith('!')).map(line=>line.slice(1).trim()));
for(const file of ['server.js','instructor-certificates.js']){
  assert.ok(copied.has(file),file+' must be copied into the image');
  assert.ok(allowed.has(file),file+' must be allowed into the build context');
  const imports=[...read(file).matchAll(/(?:from\s*|import\s*\()\s*['"]\.\/([^'"]+)['"]/g)].map(match=>match[1]);
  for(const dependency of imports){
    assert.ok(copied.has(dependency),file+' imports '+dependency+' but Docker does not copy it');
    assert.ok(allowed.has(dependency),file+' imports '+dependency+' but dockerignore excludes it');
  }
}
assert.match(docker,/COPY public \.\/public/);
assert.ok(allowed.has('public/')&&allowed.has('public/**'),'public assets must be included');
assert.ok(JSON.parse(read('package.json')).dependencies.qrcode,'QR generation must be a production dependency');
console.log('PASS: backend local imports, certificate helper, public assets and QR production dependency are included in Docker packaging');
