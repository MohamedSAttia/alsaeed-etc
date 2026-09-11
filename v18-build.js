import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
function inject(file, marker, payload, where='head') {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes(marker)) return;
  const needle = where === 'body' ? '</body>' : '</head>';
  html = html.includes(needle) ? html.replace(needle, payload + '\n' + needle) : html + '\n' + payload;
  fs.writeFileSync(file, html);
}
inject(path.join(publicDir,'index.html'), '/v18-interface.css', '<link rel="stylesheet" href="/v18-interface.css?v=18.0">');
inject(path.join(publicDir,'index.html'), '/v18-interface.js', '<script src="/v18-interface.js?v=18.0"></script>', 'body');
for (const name of ['panel.html','content-admin.html']) {
  const f = path.join(publicDir,name);
  inject(f, '/admin-v18.css', '<link rel="stylesheet" href="/admin-v18.css?v=18.0">');
  inject(f, '/admin-v18.js', '<script src="/admin-v18.js?v=18.0"></script>', 'body');
}
console.log('✅ V18 interface assets injected');
