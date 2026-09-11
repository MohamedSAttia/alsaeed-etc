import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'alsaeed.db');
const PUBLIC = path.join(__dirname, 'public');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY, package_id TEXT NOT NULL,
  domain TEXT, topic TEXT, difficulty TEXT DEFAULT 'medium', type TEXT DEFAULT 'single',
  question_ar TEXT NOT NULL DEFAULT '', question_en TEXT,
  options TEXT NOT NULL DEFAULT '[]', correct TEXT NOT NULL DEFAULT '',
  explanation_ar TEXT, explanation_en TEXT, reference TEXT,
  active INTEGER DEFAULT 1, created INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_questions_package ON questions(package_id);
`);

function ensureColumn(table, col, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(x => x.name);
  if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
}
[
  ['options_en', "TEXT DEFAULT '[]'"], ['options_ar', "TEXT DEFAULT '[]'"],
  ['approach', 'TEXT'], ['source_exam', 'TEXT'], ['source_id', 'TEXT'],
  ['correct_json', 'TEXT'], ['meta', 'TEXT'], ['is_official', 'INTEGER DEFAULT 0'],
  ['priority', 'INTEGER DEFAULT 0']
].forEach(([c,d]) => ensureColumn('questions', c, d));

function setting(key) {
  const r = db.prepare('SELECT v FROM settings WHERE k=?').get(key);
  return r ? r.v : '';
}
function setSetting(key, value) {
  db.prepare(`INSERT INTO settings(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).run(key, value);
}
function parseJson(s, fallback) { try { return JSON.parse(s); } catch { return fallback; } }

function mergeById(existing, incoming) {
  const out = Array.isArray(existing) ? existing.slice() : [];
  const seen = new Set(out.map(x => x && x.id).filter(Boolean));
  for (const item of Array.isArray(incoming) ? incoming : []) {
    if (!item || !item.id || seen.has(item.id)) continue;
    out.push(item); seen.add(item.id);
  }
  return out;
}

function ensureCatalog() {
  const file = path.join(PUBLIC, 'v15-catalog.json');
  if (!fs.existsSync(file)) return { packages: parseJson(setting('content_packages') || '[]', []), courses: [] };
  const data = parseJson(fs.readFileSync(file, 'utf8'), {});
  const oldPackages = parseJson(setting('content_packages') || '[]', []);
  const oldCourses = parseJson(setting('content_courses') || '[]', []);
  const packages = mergeById(oldPackages, data.packages || []);
  const courses = mergeById(oldCourses, data.courses || []);
  if (packages.length !== oldPackages.length) {
    setSetting('content_packages', JSON.stringify(packages));
    setSetting('catalog', JSON.stringify(packages.filter(p => p.active !== false).map(p => ({
      id:p.id, ar:p.ar || p.title_ar || p.id, en:p.en || p.title_en || '', code:p.code || p.id,
      price:Number(p.price || 0), currency:String(p.currency || 'USD').toUpperCase(),
      days:Number(p.days || 90), hours:Number(p.hours || 0), type:String(p.type || ''), cert:!!p.cert
    }))));
    console.log(`✅ V18 catalog: added ${packages.length - oldPackages.length} missing packages`);
  }
  if (courses.length !== oldCourses.length) {
    setSetting('content_courses', JSON.stringify(courses));
    console.log(`✅ V18 catalog: added ${courses.length - oldCourses.length} missing courses`);
  }
  return { packages, courses };
}

function extractQBank(html) {
  const marker = 'window.QBANK';
  let i = html.indexOf(marker);
  if (i < 0) return [];
  i = html.indexOf('[', i);
  if (i < 0) return [];
  let depth = 0, inString = false, escaped = false, quote = '';
  for (let j = i; j < html.length; j++) {
    const ch = html[j];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") { inString = true; quote = ch; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return parseJson(html.slice(i, j + 1), []);
    }
  }
  return [];
}

function decodeText(v) {
  return String(v ?? '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&rsquo;|&lsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"').replace(/&ndash;/gi, '–').replace(/&mdash;/gi, '—')
    .replace(/&bull;/gi, '•').replace(/&gt;/gi, '>').replace(/&lt;/gi, '<')
    .replace(/&#(\d+);/g, (_,n) => { try { return String.fromCodePoint(Number(n)); } catch { return _; } })
    .replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function typeOf(t) { return String(t || '').toUpperCase() === 'M' ? 'multiple' : 'single'; }
function correctLetters(indices) {
  return (Array.isArray(indices) ? indices : []).map(i => String.fromCharCode(65 + Number(i))).join(',');
}

const catalog = ensureCatalog();

function targetPackages(course) {
  const list = (catalog.packages || []).filter(p => {
    const id = String(p.id || '').toLowerCase();
    const c = String(p.course || '').toLowerCase();
    const type = String(p.type || '').toLowerCase();
    return (c === course || id.startsWith(course + '-')) && ['full','sim','review'].some(x => type === x || id.endsWith('-' + x));
  }).map(p => p.id);
  return list.length ? [...new Set(list)] : [`${course}-full`, `${course}-sim`, `${course}-review`];
}

const insert = db.prepare(`INSERT OR IGNORE INTO questions
  (id,package_id,domain,topic,difficulty,type,question_ar,question_en,options,options_ar,options_en,correct,
   explanation_ar,explanation_en,reference,active,created,updated,approach,source_exam,source_id,correct_json,meta,is_official,priority)
  VALUES (@id,@package_id,@domain,@topic,@difficulty,@type,@question_ar,@question_en,@options,@options_ar,@options_en,@correct,
   @explanation_ar,@explanation_en,@reference,@active,@created,@updated,@approach,@source_exam,@source_id,@correct_json,@meta,@is_official,@priority)`);

function seedCourse(course, filename) {
  const file = path.join(PUBLIC, filename);
  if (!fs.existsSync(file)) return { course, source:0, inserted:0, skipped:0, targets:[] };
  const bank = extractQBank(fs.readFileSync(file, 'utf8'));
  if (!bank.length) return { course, source:0, inserted:0, skipped:0, targets:[] };
  const targets = targetPackages(course);
  let inserted = 0, skipped = 0;
  const now = Date.now();

  for (const packageId of targets) {
    const existing = new Set(db.prepare('SELECT source_id FROM questions WHERE package_id=? AND source_id IS NOT NULL').all(packageId).map(x => x.source_id));
    const tx = db.transaction(rows => {
      for (let index = 0; index < rows.length; index++) {
        const q = rows[index] || {};
        const sourceId = `${course.toUpperCase()}-${q.id ?? (index + 1)}`;
        if (existing.has(sourceId)) { skipped++; continue; }
        const opts = Array.isArray(q.o) ? q.o.map(decodeText) : [];
        const correctJson = Array.isArray(q.c) ? q.c.map(Number) : [];
        const suffix = String(q.id ?? (index + 1)).padStart(4, '0');
        const packageSuffix = packageId.replace(/[^a-z0-9]+/gi, '-').toUpperCase();
        const row = {
          id:`EXT-${packageSuffix}-${suffix}`, package_id:packageId,
          domain:String(q.d || '').trim(), topic:decodeText(q.ch || ''), difficulty:'medium', type:typeOf(q.t),
          question_ar:'', question_en:decodeText(q.q || ''), options:JSON.stringify(opts),
          options_ar:'[]', options_en:JSON.stringify(opts), correct:correctLetters(correctJson),
          explanation_ar:'', explanation_en:decodeText(q.f || ''), reference:'', active:1,
          created:now, updated:now, approach:'', source_exam:decodeText(q.ex || ''), source_id:sourceId,
          correct_json:JSON.stringify(correctJson), is_official:0, priority:20,
          meta:JSON.stringify({ source:filename, sourceCourse:course, sourceDomain:q.d || '', originalId:q.id ?? (index + 1), language:'en', reviewStatus:'needs_ar_translation' })
        };
        const info = insert.run(row);
        if (info.changes) { inserted++; existing.add(sourceId); }
        else skipped++;
      }
    });
    tx(bank);
  }
  return { course, source:bank.length, inserted, skipped, targets };
}

const report = [
  seedCourse('rmp', 'rmp-exam.html'),
  seedCourse('grcp', 'grcp-exam.html'),
  seedCourse('pba', 'pba-exam.html')
];
setSetting('v18_bank_seed_report', JSON.stringify({ at:Date.now(), report }));
console.log('✅ V18 question-bank seed:', JSON.stringify(report));
db.close();
