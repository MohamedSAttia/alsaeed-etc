/* Read-only publication rules shared by learner bank access and public previews.
 * No question payload or media reference is returned by catalogAvailability.
 */
export function questionSourcePackageId({db, packages, counts}, packageId, activeOnly = true) {
  const id = String(packageId || '');
  const count = candidate => counts && activeOnly ? counts[candidate] || 0 :
    db.prepare(`SELECT COUNT(*) c FROM questions WHERE package_id=?${activeOnly ? ' AND active=1' : ''}`).get(candidate).c;
  if (count(id) > 0) return id;
  const pkg = packages.find(p => String(p.id) === id);
  const course = String(pkg?.course || id.split('-')[0] || id).toLowerCase();
  const candidates = [course, ...packages.filter(p => String(p.course || '').toLowerCase() === course).map(p => String(p.id))];
  let best = id, bestCount = 0;
  for (const candidate of new Set(candidates)) {
    const available = count(candidate);
    if (available > bestCount) { best = candidate; bestCount = available; }
  }
  return bestCount ? best : id;
}

export function learnerQuestionSelection(context, packageId, {domain = '', topic = ''} = {}) {
  const {packages, pmpPackageId, editorialHolds = []} = context;
  const sourcePackageId = questionSourcePackageId(context, packageId, true);
  const filters = ['package_id=?', 'active=1'], params = [sourcePackageId];
  const pmpQualityGate = sourcePackageId === pmpPackageId ||
    packages.some(p => p.id === packageId && String(p.course).toLowerCase() === 'pmp');
  // These are the existing learner publication rules, not new editorial changes.
  if (pmpQualityGate) {
    if (editorialHolds.length) {
      filters.push(`COALESCE(source_id,'') NOT IN (${editorialHolds.map(() => '?').join(',')})`);
      params.push(...editorialHolds);
    }
    filters.push("COALESCE(topic,'') NOT IN ('PMP exam structure','Introduction') AND NOT (COALESCE(source_id,'') BETWEEN 'ALSAEED-PMP-2026-FA-061' AND 'ALSAEED-PMP-2026-FA-080')");
    filters.push("(id LIKE 'pmp-v5-%' OR id LIKE 'ALSAEED-PMP-2026-FA-%' OR id LIKE 'pmp-pmi2026-%' OR (json_valid(meta) AND json_extract(meta,'$.alignmentVersion')='pmp-2026-pmbok8') OR (id LIKE 'pmp-ref-somu-%' AND json_valid(meta) AND json_extract(meta,'$.referenceMergeReviewed')=1))");
    filters.push("id NOT LIKE 'pmp-v5-0076@%'");
    filters.push("UPPER(COALESCE(question_en,'') || ' ' || COALESCE(question_ar,'')) NOT LIKE '%DSDM%' AND UPPER(COALESCE(question_en,'') || ' ' || COALESCE(question_ar,'')) NOT LIKE '%SDMD%'");
  }
  if (domain) {
    const aliases = {people:['people','e'], process:['process','r'], business:['business','business environment','b']}[domain] || [domain];
    filters.push(`LOWER(TRIM(domain)) IN (${aliases.map(() => '?').join(',')})`);
    params.push(...aliases);
  }
  if (topic) { filters.push('topic=?'); params.push(topic); }
  return {sourcePackageId, pmpQualityGate, filters, params};
}

export function learnerQuestionMeta(row, pmpQualityGate, topicRouting = {}) {
  let meta;
  try { meta = row.meta ? JSON.parse(row.meta) : {}; } catch { meta = {}; }
  return {...meta, ...(pmpQualityGate && topicRouting[row.source_id] ? {primaryTopic:topicRouting[row.source_id]} : {})};
}

const assessmentDomain = row => ({e:'people', r:'process', b:'business', 'business environment':'business'}[String(row.domain).toLowerCase()] || String(row.domain).toLowerCase());
const frameworkQuestion = row => row.meta?.primaryTopic ? row.meta.primaryTopic === 'framework' :
  row.meta?.topics?.includes('framework') || /framework|أسس|إطار/i.test(String(row.topic || ''));
const assessmentQuestion = row => !['PMP exam structure','Introduction'].includes(row.topic) &&
  !/ALSAEED-PMP-2026-FA-0(?:6[1-9]|7[0-9]|80)(?:@|$)/.test(row.id);

// Explicit whitelists prevent lesson items, media URLs, attachments, answers or
// arbitrary saved chapter metadata from reaching the unauthenticated response.
function curriculumTree(groups) {
  return groups.map(group => {
    const children = curriculumTree(group.children || []);
    return {key:String(group.key), ar:String(group.title || group.ar || ''), en:String(group.en || ''),
      videoCount:group.items.length + children.reduce((n, child) => n + child.videoCount, 0), children};
  });
}

export function catalogAvailability({db, packages, courses, roadmap, sharedCase, editorialHolds = [], topicRouting = {}, pmpPackageId}) {
  const lessonRows = db.prepare(`SELECT package_id,idx,chapter AS ch,title AS t,title_en AS t_en,duration,
    CASE WHEN TRIM(COALESCE(vimeo,'')) <> '' THEN 1 ELSE 0 END AS vimeo,
    display_order AS displayOrder FROM lessons WHERE deleted_at IS NULL ORDER BY package_id,idx`).all();
  const lessons = new Map(), videoStats = new Map();
  for (const row of lessonRows) {
    const {package_id, duration, ...descriptor} = row;
    if (!lessons.has(package_id)) lessons.set(package_id, []);
    lessons.get(package_id).push({...descriptor, vimeo:!!descriptor.vimeo});
    if (!descriptor.vimeo) continue;
    const stats = videoStats.get(package_id) || {count:0, minutes:0};
    stats.count++;
    const parts = String(duration || '').split(':').map(Number);
    if (parts.length === 2 && parts.every(Number.isFinite)) stats.minutes += parts[0] + parts[1] / 60;
    videoStats.set(package_id, stats);
  }
  const columns = new Set(db.prepare('PRAGMA table_info(questions)').all().map(col => col.name));
  const hasCounts = ['package_id','active'].every(name => columns.has(name));
  const counts = hasCounts ? Object.fromEntries(db.prepare('SELECT package_id,COUNT(*) n FROM questions WHERE active=1 GROUP BY package_id').all().map(row => [row.package_id,row.n])) : {};
  const canClassify = ['id','package_id','active','domain','topic','approach','meta','source_id','type','question_ar','question_en'].every(name => columns.has(name));
  const context = {db, packages, counts, pmpPackageId, editorialHolds};
  const bankCache = new Map(), result = {};
  for (const pkg of packages) {
    const savedCourse = courses.find(c => c.id === pkg.course) || {id:pkg.course};
    const course = {...savedCourse, chapters:Array.isArray(savedCourse.chapters) ? savedCourse.chapters : []};
    const source = packages.find(p => p.id === pkg.sourcePackageId && p.course === pkg.course)?.id || pkg.id;
    const outline = roadmap.assessmentOutline(course);
    const labels = rows => rows.map(({key,ar,en}) => ({key,ar,en,questionCount:null}));
    const assessments = {status:'unverified', questions:null, chapters:labels(outline.chapters), domains:labels(outline.domains),
      fullMocks:{status:'unverified', availableCount:null, modelCount:outline.mocks.length,
        questionCount:course.id === 'pmp' ? 180 : null, minutes:course.id === 'pmp' ? 240 : null}};
    if (canClassify) {
      const selection = learnerQuestionSelection(context, pkg.id);
      const cacheKey = selection.sourcePackageId + '|' + selection.pmpQualityGate;
      if (!bankCache.has(cacheKey)) {
        // Only classifications leave SQLite. Text is consulted by publication
        // predicates but never selected, serialized or passed to the planner.
        const rows = db.prepare(`SELECT id,domain,topic,approach,meta,source_id,type FROM questions WHERE ${selection.filters.join(' AND ')}`).all(...selection.params);
        bankCache.set(cacheKey, rows.length > 2000 ? null : rows.filter(assessmentQuestion).map(row => {
          const meta = learnerQuestionMeta(row, selection.pmpQualityGate, topicRouting);
          return {id:row.id, domain:row.domain || '', topic:row.topic || '', approach:row.approach || '', type:row.type,
            meta:{primaryTopic:meta.primaryTopic, topics:meta.topics, sharedCaseId:meta.sharedCaseId,
              sourceV5:meta.sourceV5 ? {scn:meta.sourceV5.scn, t:meta.sourceV5.t} : undefined}};
        }));
      }
      const rows = bankCache.get(cacheKey);
      // The learner endpoint randomly caps banks at 2000. A larger underlying
      // pool cannot honestly promise exact category counts for that sample.
      if (rows) {
        assessments.status = 'verified';
        assessments.questions = rows.length;
        assessments.chapters.forEach(chapter => { chapter.questionCount = rows.filter(row => chapter.key === 'framework' ? frameworkQuestion(row) : String(row.approach).toLowerCase() === chapter.key).length; });
        assessments.domains.forEach(domain => { domain.questionCount = rows.filter(row => assessmentDomain(row) === domain.key).length; });
        if (course.id === 'pmp' && sharedCase?.build) {
          assessments.fullMocks.status = 'verified';
          assessments.fullMocks.availableCount = sharedCase.build(rows).length === 180 ? outline.mocks.length : 0;
        }
      }
    }
    const stats = videoStats.get(source);
    result[pkg.id] = {videos:stats?.count || 0, videoMins:Math.round(stats?.minutes || 0), questions:assessments.questions, questionsStatus:assessments.status,
      curriculum:curriculumTree(roadmap.videoGroups(course, lessons.get(source) || [])), assessments};
  }
  return result;
}
