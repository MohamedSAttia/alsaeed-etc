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
  const idx = html.lastIndexOf(needle);
  html = idx >= 0
    ? html.slice(0, idx) + payload + '\n' + html.slice(idx)
    : html + '\n' + payload;
  fs.writeFileSync(file, html);
}
function patchGatewayForAI() {
  const f = path.join(__dirname, 'gateway.js');
  if (!fs.existsSync(f)) return;
  let js = fs.readFileSync(f, 'utf8');
  if (!js.includes("from './ai-assistant.js'")) {
    js = js.replace(
      "import { createPmpEngine } from './pmp-engine.js';",
      "import { createPmpEngine } from './pmp-engine.js';\nimport { createAiAssistant } from './ai-assistant.js';"
    );
  }
  if (!js.includes('const aiAssistant = createAiAssistant(')) {
    js = js.replace(
      'const pmp = createPmpEngine({ db, JWT_SECRET, getPackages, savePackages });',
      "const pmp = createPmpEngine({ db, JWT_SECRET, getPackages, savePackages });\nconst aiAssistant = createAiAssistant({ dbPath: DB_PATH, jwtSecret: JWT_SECRET });"
    );
  }
  if (!js.includes("url.pathname.startsWith('/api/ai/')")) {
    js = js.replace(
      "    if(req.method==='POST'&&url.pathname==='/api/pmp-2026/admin/import')return await importPmpBank(req,res);",
      "    if(url.pathname.startsWith('/api/ai/'))return await aiAssistant.handle(req,res,url);\n    if(req.method==='POST'&&url.pathname==='/api/pmp-2026/admin/import')return await importPmpBank(req,res);"
    );
  }
  fs.writeFileSync(f, js);
}
const indexFile = path.join(publicDir,'index.html');
inject(indexFile, '/v18-interface.css', '<link rel="stylesheet" href="/v18-interface.css?v=18.0">');
inject(indexFile, '/v18-interface.js', '<script src="/v18-interface.js?v=18.0"></script>', 'body');
inject(indexFile, '/hotfix-v18.js', '<script src="/hotfix-v18.js?v=18.1"></script>', 'body');
inject(indexFile, '/exam-ai-v19.js', '<script src="/exam-ai-v19.js?v=19.0"></script>', 'body');
for (const name of ['panel.html','content-admin.html']) {
  const f = path.join(publicDir,name);
  inject(f, '/admin-v18.css', '<link rel="stylesheet" href="/admin-v18.css?v=18.0">');
  inject(f, '/admin-v18.js', '<script src="/admin-v18.js?v=18.0"></script>', 'body');
}
patchGatewayForAI();
console.log('✅ V18/V19 assets injected safely; AI gateway route enabled');
