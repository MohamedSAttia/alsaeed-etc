import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync('server.js','utf8'),start=source.indexOf('function normalizeVimeoReference('),end=source.indexOf("app.get('/api/admin/vimeo/:id'",start);
const context={URL};vm.createContext(context);vm.runInContext(source.slice(start,end),context);
for(const value of ['123456789?h=abc123','https://vimeo.com/123456789/abc123','https://player.vimeo.com/video/123456789?h=abc123']){
 const result=context.normalizeVimeoReference(value);assert.equal(result.stored,'123456789?h=abc123');assert.equal(result.url,'https://vimeo.com/123456789/abc123');
}
assert.equal(context.normalizeVimeoReference('123456789').stored,'123456789');
assert.equal(context.normalizeVimeoReference('https://other.example/123456789'),null);
assert.equal(context.normalizeVimeoReference('javascript:123456789'),null);
assert(source.includes('lesson.vimeo = id'));assert(source.includes('normalizeVimeoReference(lesson.vimeo)?.stored'));
assert(!source.includes("encodeURIComponent('https://vimeo.com/' + id)"));
console.log('PASS: saved Vimeo references and metadata retain unlisted hashes; numeric links remain supported; invalid hosts rejected.');
