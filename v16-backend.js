import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';

export function installV16(ctx) {
  const { db, setting, setSetting, uid, sendJson, readJson, grant, jwtSecret } = ctx;

  db.exec(
    'CREATE TABLE IF NOT EXISTS blogs (' +
    'id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title_ar TEXT NOT NULL, title_en TEXT, ' +
    'excerpt_ar TEXT, excerpt_en TEXT, body_ar TEXT NOT NULL, body_en TEXT, category TEXT, image TEXT, author TEXT, ' +
    'published INTEGER DEFAULT 0, created INTEGER NOT NULL, updated INTEGER NOT NULL);' +
    'CREATE INDEX IF NOT EXISTS idx_blogs_published ON blogs(published, created);' +
    'CREATE TABLE IF NOT EXISTS invoices (' +
    'id TEXT PRIMARY KEY, order_id TEXT UNIQUE NOT NULL, invoice_no TEXT UNIQUE NOT NULL, user_id TEXT NOT NULL, ' +
    'buyer_name TEXT, buyer_tax_id TEXT, buyer_address TEXT, seller_name TEXT, seller_tax_id TEXT, seller_address TEXT, ' +
    'subtotal REAL NOT NULL, tax_rate REAL DEFAULT 0, tax_amount REAL DEFAULT 0, total REAL NOT NULL, currency TEXT NOT NULL, ' +
    "status TEXT DEFAULT 'pending', created INTEGER NOT NULL, issued_at INTEGER);" +
    'CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id, created);'
  );
  for (const [name, type] of [['purchase_id','TEXT'], ['package_id','TEXT'], ['buyer_country','TEXT'],
    ['invoice_language','TEXT'], ['tax_reason','TEXT'], ['item_name','TEXT'], ['seller_tax_card','TEXT']]) {
    if (!db.pragma('table_info(invoices)').some(column => column.name === name))
      db.exec(`ALTER TABLE invoices ADD COLUMN ${name} ${type}`);
  }

  const defaults = {
    sellerName: 'السعيد للتدريب والاستشارات والتعليم عن بعد',
    sellerTaxId: '',
    sellerTaxCard: '4203296760802177',
    sellerAddress: 'سوهاج، جمهورية مصر العربية',
    vatRate: 14,
    baseCurrency: 'USD',
    currencies: { USD: 1, EGP: 48, SAR: 3.75, AED: 3.67, EUR: 0.92 },
    taxExemptCountries: [],
    taxExemptBuyers: []
  };

  function config() {
    try { return Object.assign({}, defaults, JSON.parse(setting('invoice_settings') || '{}')); }
    catch { return Object.assign({}, defaults); }
  }

  function publicConfig() {
    const value = config();
    return {
      vatRate: Number(value.vatRate) || 0,
      baseCurrency: value.baseCurrency,
      currencies: Object.keys(value.currencies || {}).filter(function (key) {
        return Number(value.currencies[key]) > 0;
      }),
      rates: value.currencies || {}
    };
  }

  function convert(amount, from, to) {
    const value = config();
    from = String(from || value.baseCurrency).toUpperCase();
    to = String(to || from).toUpperCase();
    const a = Number(value.currencies && value.currencies[from]);
    const b = Number(value.currencies && value.currencies[to]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
      throw new Error('العملة المطلوبة غير مفعلة في إعدادات الفواتير');
    }
    return Math.round((Number(amount) / a * b) * 100) / 100;
  }

  function invoiceNo() {
    const year = new Date().getUTCFullYear();
    return 'INV-' + year + '-' + crypto.randomBytes(5).toString('hex').toUpperCase();
  }

  function taxPolicy(country, user) {
    const value = config();
    const eligible = !!user && Array.isArray(value.taxExemptCountries) && value.taxExemptCountries.includes(country) &&
      Array.isArray(value.taxExemptBuyers) && value.taxExemptBuyers.includes(String(user.email || '').toLowerCase());
    return { eligible, rate: eligible ? 0 : Math.max(0, Number(value.vatRate) || 0),
      reason: eligible ? 'Seller-approved zero-rated transaction; supporting evidence retained separately' : '' };
  }

  function createInvoice(orderId, user, total, currency, billing = {}) {
    const value = config();
    const country = String(billing.country || 'EG').toUpperCase();
    const approved = taxPolicy(country, user);
    const taxRate = billing.taxMode === 'exempt' && approved.eligible ? 0 : Math.max(0, Number(value.vatRate) || 0);
    const reason = billing.taxMode === 'exempt' && approved.eligible ? approved.reason : '';
    const subtotal = Math.round((Number(total) / (1 + taxRate / 100)) * 100) / 100;
    const taxAmount = Math.round((Number(total) - subtotal) * 100) / 100;
    db.prepare(
      'INSERT INTO invoices (id,order_id,invoice_no,user_id,buyer_name,buyer_tax_id,buyer_address,' +
      'seller_name,seller_tax_id,seller_address,subtotal,tax_rate,tax_amount,total,currency,status,created,' +
      'purchase_id,package_id,buyer_country,invoice_language,tax_reason,item_name,seller_tax_card) ' +
      'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ).run(
      uid(), orderId, invoiceNo(), user.id,
      String((billing && billing.name) || user.name || ''),
      String((billing && billing.taxId) || ''),
      String((billing && billing.address) || ''),
      String(value.sellerName || ''), String(value.sellerTaxId || ''), String(value.sellerAddress || ''),
      subtotal, taxRate, taxAmount, Number(total), String(currency), 'pending', Date.now(),
      String(billing.purchaseId || orderId), String(billing.packageId || ''), country,
      String(billing.language || 'ar'), reason, String(billing.itemName || ''), String(value.sellerTaxCard || '')
    );
  }

  function markPaid(orderId, paidAt) {
    db.prepare("UPDATE invoices SET status='issued', issued_at=? WHERE order_id=? OR purchase_id=?")
      .run(paidAt || Date.now(), orderId, orderId);
  }

  const initial = [
    ['why-pmo-fails', 'لماذا يفشل مكتب إدارة المشاريع في أول سنتين؟', 'Why PMOs Fail in Their First Two Years', 'إدارة المشاريع', 'قراءة عملية لأسباب التعثر وكيفية بناء مكتب يحقق أثرًا قابلًا للقياس.'],
    ['risk-types', 'الفرق بين المخاطرة المتأصلة والمتبقية والثانوية', 'Inherent, Residual and Secondary Risk', 'الحوكمة والمخاطر', 'شرح مبسط للمفاهيم مع أمثلة من بيئة العمل.'],
    ['pmp-exam-domains', 'كيف تقرأ نطاقات اختبار PMP وتوزع وقتك عليها؟', 'How to Read PMP Exam Domains', 'PMP', 'خطة عملية للمذاكرة والمراجعة حسب نطاقات الاختبار الرسمية.']
  ];
  if (!db.prepare('SELECT COUNT(*) c FROM blogs').get().c) {
    const now = Date.now();
    const insert = db.prepare('INSERT INTO blogs (id,slug,title_ar,title_en,excerpt_ar,body_ar,category,author,published,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    initial.forEach(function (item, index) {
      insert.run(uid(), item[0], item[1], item[2], item[4], item[4] + '\n\nسيتم تحديث هذا المقال من لوحة المشرف بالمحتوى الكامل.', item[3], 'د. محمد عطية', 1, now - index * 86400000, now);
    });
  }


  const courseQuestions = {
    pmp: [
      ['single','process','Which document formally authorizes a project?','ما الوثيقة التي تعتمد المشروع رسمياً؟',['Project charter','Benefits plan','Risk report','Team charter'],['ميثاق المشروع','خطة المنافع','تقرير المخاطر','ميثاق الفريق'],'A'],
      ['multiple','people','Which actions support effective stakeholder engagement?','ما الإجراءات التي تدعم المشاركة الفعالة لأصحاب المصلحة؟',['Tailor communication','Seek feedback','Ignore resistance','Review engagement'],['تخصيص الاتصال','طلب التغذية الراجعة','تجاهل المقاومة','مراجعة المشاركة'],'A,B,D'],
      ['scenario','business','A regulation changes during execution. What should the project manager do first?','تغير تشريع أثناء التنفيذ، ماذا يفعل مدير المشروع أولاً؟',['Assess impact','Close project','Replace sponsor','Ignore it'],['تقييم الأثر','إغلاق المشروع','استبدال الراعي','تجاهله'],'A'],
      ['matching','process','Match the project artifact with its purpose.','طابق وثيقة المشروع مع الغرض منها.',['Charter - authorization','Risk register - risk information','Backlog - prioritized work','Lessons learned - knowledge'],['الميثاق - الاعتماد','سجل المخاطر - معلومات المخاطر','قائمة العمل - الأولويات','الدروس المستفادة - المعرفة'],'A,B,C,D']
    ],
    rmp: [
      ['single','risk','Where are identified risks and their responses recorded?','أين تسجل المخاطر المحددة واستجاباتها؟',['Risk register','Issue log only','Project charter only','Invoice'],['سجل المخاطر','سجل المشكلات فقط','ميثاق المشروع فقط','الفاتورة'],'A'],
      ['multiple','risk','Which are valid risk response strategies for threats?','ما استراتيجيات الاستجابة الصحيحة للتهديدات؟',['Avoid','Mitigate','Transfer','Exploit'],['التجنب','التخفيف','النقل','الاستغلال'],'A,B,C'],
      ['scenario','risk','A high-priority risk is about to occur. What should be reviewed first?','مخاطرة مرتفعة على وشك الحدوث، ما الذي يراجع أولاً؟',['Agreed response and owner','Marketing plan','Payroll','Organization logo'],['الاستجابة المعتمدة ومالك الخطر','خطة التسويق','الرواتب','شعار المنظمة'],'A'],
      ['matching','risk','Match the risk term with its meaning.','طابق مصطلح المخاطر مع معناه.',['Probability - likelihood','Impact - consequence','Trigger - warning sign','Owner - accountable person'],['الاحتمالية - إمكانية الحدوث','الأثر - النتيجة','المحفز - علامة التحذير','المالك - الشخص المسؤول'],'A,B,C,D']
    ],
    acp: [
      ['single','agile','Who orders the product backlog?','من يرتب قائمة عمل المنتج؟',['Product owner','Scrum master','Sponsor','Auditor'],['مالك المنتج','سكرم ماستر','الراعي','المراجع'],'A'],
      ['multiple','agile','Which practices improve agile feedback?','ما الممارسات التي تحسن التغذية الراجعة الرشيقة؟',['Reviews','Retrospectives','Frequent delivery','Annual-only reporting'],['المراجعات','الاجتماعات الاستعادية','التسليم المتكرر','التقرير السنوي فقط'],'A,B,C'],
      ['scenario','agile','The team receives changing requirements. What is the best response?','استلم الفريق متطلبات متغيرة، ما أفضل استجابة؟',['Reprioritize with the product owner','Reject every change','Stop collaboration','Hide the backlog'],['إعادة ترتيب الأولويات مع مالك المنتج','رفض كل تغيير','إيقاف التعاون','إخفاء قائمة العمل'],'A'],
      ['matching','agile','Match the agile event with its purpose.','طابق حدث أجايل مع غرضه.',['Daily - synchronize','Review - inspect increment','Retrospective - improve process','Planning - select work'],['اليومي - المزامنة','المراجعة - فحص المخرج','الاستعادي - تحسين العملية','التخطيط - اختيار العمل'],'A,B,C,D']
    ],
    grcp: [
      ['single','grc','What is the goal of Principled Performance?','ما هدف الأداء المنضبط؟',['Reliably achieve objectives while addressing uncertainty and integrity','Avoid all risk','Write policies only','Eliminate governance'],['تحقيق الأهداف بموثوقية مع معالجة عدم اليقين والنزاهة','تجنب كل المخاطر','كتابة السياسات فقط','إلغاء الحوكمة'],'A'],
      ['multiple','grc','Which disciplines form GRC?','ما التخصصات التي تكوّن GRC؟',['Governance','Risk management','Compliance','Advertising'],['الحوكمة','إدارة المخاطر','الامتثال','الإعلان'],'A,B,C'],
      ['scenario','grc','A control is designed but never tested. What is missing?','تم تصميم ضابط ولم يختبر، ما العنصر الناقص؟',['Assurance and review','A new logo','Sales target','Job title'],['التأكيد والمراجعة','شعار جديد','هدف مبيعات','مسمى وظيفي'],'A'],
      ['matching','grc','Match the indicator with its focus.','طابق المؤشر مع مجال تركيزه.',['KPI - performance','KRI - risk','KCI - control','Integrity - conduct'],['KPI - الأداء','KRI - المخاطر','KCI - الضوابط','النزاهة - السلوك'],'A,B,C,D']
    ],
    p3o: [
      ['single','governance','What does a portfolio office primarily support?','',['Strategic decision making','Daily coding only','Payroll only','Building maintenance'],[],'A'],
      ['multiple','governance','Which services can a P3O model provide?','',['Governance support','Assurance','Information management','Random prioritization'],[],'A,B,C'],
      ['scenario','governance','Two projects compete for scarce resources. What should the portfolio office provide first?','',['Prioritization evidence','A new logo','No recommendation','Separate payroll'],[],'A'],
      ['matching','governance','Match the office with its focus.','',['Portfolio office - strategy','Programme office - outcomes','Project office - delivery','Centre of excellence - standards'],[],'A,B,C,D']
    ],
    pba: [
      ['single','analysis','Which artifact links requirements to business objectives?','',['Requirements traceability matrix','Issue invoice','Team calendar','Risk appetite only'],[],'A'],
      ['multiple','analysis','Which are valid elicitation techniques?','',['Interviews','Workshops','Observation','Guessing'],[],'A,B,C'],
      ['scenario','analysis','Stakeholders disagree on a requirement. What should the analyst do first?','',['Facilitate clarification and evaluate value','Select randomly','Delete the requirement','Stop communication'],[],'A'],
      ['matching','analysis','Match the analysis activity with its output.','',['Elicitation - information','Analysis - models','Traceability - relationships','Evaluation - value'],[],'A,B,C,D']
    ],
    lss: [
      ['single','lean','Which DMAIC phase identifies root causes?','',['Analyze','Define','Control','Improve'],[],'A'],
      ['multiple','lean','Which are common forms of waste?','',['Waiting','Defects','Overproduction','Customer value'],[],'A,B,C'],
      ['scenario','lean','Cycle time varies widely. Which tool should be used first to understand variation?','',['Process data and control chart','A slogan','A new title','Ignore the data'],[],'A'],
      ['matching','lean','Match the DMAIC phase with its purpose.','',['Define - problem','Measure - baseline','Improve - solution','Control - sustain'],[],'A,B,C,D']
    ]
  };
  let packageList = [];
  try { packageList = JSON.parse(setting('content_packages') || setting('catalog') || '[]'); } catch {}
  if (Array.isArray(packageList)) {
    const insertQuestion = db.prepare('INSERT INTO questions (id,package_id,domain,topic,difficulty,type,question_ar,question_en,options,correct,explanation_ar,explanation_en,reference,active,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    packageList.forEach(function (pkg) {
      const count = db.prepare('SELECT COUNT(*) c FROM questions WHERE package_id=?').get(pkg.id).c;
      if (count) return;
      const courseId = String(pkg.course || pkg.id.split('-')[0]).toLowerCase();
      const rows = courseQuestions[courseId] || [];
      const now = Date.now();
      rows.forEach(function (q, index) {
        const id = 'V16-' + pkg.id.toUpperCase() + '-' + String(index + 1).padStart(2, '0');
        const options = q[5] && q[5].length ? q[5] : q[4];
        insertQuestion.run(id, pkg.id, q[1], 'V16 foundation', index === 2 ? 'hard' : 'medium', q[0], q[3] || '', q[2], JSON.stringify(options), q[6], q[3] ? 'راجع المفهوم والسبب قبل اختيار الإجابة.' : '', 'Review the concept and rationale before selecting the answer.', 'AlSaeed V16 foundation bank', 1, now, now);
      });
    });
  }

  // Import the substantial legacy exam banks shipped with the platform into
  // the editable admin question bank. INSERT OR IGNORE makes this idempotent.
  const legacyBanks = [
    ['grcp-exam.html', 'grcp-full', 'GRCP'],
    ['pba-exam.html', 'pba-full', 'PBA']
  ];
  const legacyInsert = db.prepare('INSERT OR IGNORE INTO questions (id,package_id,domain,topic,difficulty,type,question_ar,question_en,options,correct,explanation_ar,explanation_en,reference,active,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  legacyBanks.forEach(function (bank) {
    try {
      const file = path.join(process.cwd(), 'public', bank[0]);
      if (!fs.existsSync(file)) return;
      const html = fs.readFileSync(file, 'utf8');
      const marker = 'window.QBANK=';
      const begin = html.indexOf(marker);
      if (begin < 0) return;
      const arrayStart = html.indexOf('[', begin + marker.length);
      const scriptEnd = html.indexOf('</script>', arrayStart);
      if (arrayStart < 0 || scriptEnd < 0) return;
      const rawBank = html.slice(arrayStart, scriptEnd).trim().replace(/;\s*$/, '');
      const rows = JSON.parse(rawBank);
      const now = Date.now();
      rows.forEach(function (q, index) {
        const answers = Array.isArray(q.c) ? q.c.map(function (n) { return String.fromCharCode(65 + Number(n)); }).join(',') : String(q.c || '');
        const type = Array.isArray(q.c) && q.c.length > 1 ? 'multiple' : 'single';
        legacyInsert.run(
          'LEGACY-' + bank[2] + '-' + String(q.id || index + 1).padStart(4, '0'),
          bank[1], String(q.d || ''), String(q.ch || ''), 'medium', type,
          '', String(q.q || ''), JSON.stringify(Array.isArray(q.o) ? q.o : []), answers,
          '', String(q.f || ''), String(q.ex || bank[2] + ' legacy exam bank'), 1, now, now
        );
      });
      console.log('Imported legacy question bank:', bank[2], rows.length);
    } catch (error) {
      console.error('Legacy question bank import skipped:', bank[2], error.message);
    }
  });

  // Unified bank supplied with the V15 merge package: PMP, RMP and CAPM.
  try {
    // Remove the temporary RMP legacy import now superseded by qbank.json.
    db.prepare("DELETE FROM questions WHERE id LIKE 'LEGACY-RMP-%'").run();
    const bankDir = path.join(process.cwd(), 'public', 'data');
    const chunkFiles = fs.existsSync(bankDir)
      ? fs.readdirSync(bankDir).filter(function (name) { return /^qbank-\d+\.json$/.test(name); }).sort()
      : [];
    if (chunkFiles.length) {
      const rows = chunkFiles.flatMap(function (name) {
        return JSON.parse(fs.readFileSync(path.join(bankDir, name), 'utf8'));
      });
      const typeMap = { mcq: 'single', multi: 'multiple', match: 'matching' };
      const now = Date.now();
      rows.forEach(function (q, index) {
        const course = String(q.course || '').toLowerCase();
        if (!['pmp', 'rmp', 'capm', 'p3o', 'grcp', 'pba', 'acp', 'lss', 'nebosh', 'aipro'].includes(course)) return;
        if (course === 'pmp' && setting('pmp_learning_bank_version') === 'pmp-learning-bank-889-v20') return;
        const enOptions = q.o && Array.isArray(q.o.en) ? q.o.en : [];
        const arOptions = q.o && Array.isArray(q.o.ar) ? q.o.ar : [];
        const options = arOptions.length ? arOptions : enOptions;
        const correct = (Array.isArray(q.c) ? q.c : [q.c]).filter(Number.isInteger).map(function (answer) {
          return String.fromCharCode(65 + answer);
        }).join(',');
        if (!correct || !options.length) return;
        legacyInsert.run(
          'QB-' + String(q.id || course + '-' + index), course + '-full', q.domain || '', q.chapter || '',
          'medium', typeMap[q.type] || q.type || 'single',
          q.q && q.q.ar ? q.q.ar : '', q.q && q.q.en ? q.q.en : '', JSON.stringify(options), correct,
          q.x && q.x.ar ? q.x.ar : '', q.x && q.x.en ? q.x.en : '',
          String(q.ref || '') + (q.review === 'NEEDS REVIEW' ? ' | NEEDS REVIEW' : ''),
          q.active === 0 ? 0 : 1, now, now
        );
      });
    }
  } catch (unifiedError) {
    console.error('Unified question bank import skipped:', unifiedError.message);
  }

  // Every package type for a course draws from the same editable course bank.
  // Materialized copies keep the existing package-scoped exam engine working.
  try {
    if (Array.isArray(packageList)) {
      const copyQuestionBank = db.prepare(`INSERT OR IGNORE INTO questions
        (id,package_id,domain,topic,difficulty,type,question_ar,question_en,options,correct,explanation_ar,explanation_en,reference,active,created,updated)
        SELECT ? || '::' || id, ?, domain,topic,difficulty,type,question_ar,question_en,options,correct,explanation_ar,explanation_en,reference,active,created,updated
        FROM questions WHERE package_id=?`);
      packageList.forEach(function (pkg) {
        if (!pkg || !pkg.id || !pkg.course || pkg.type === 'full' || String(pkg.id).endsWith('-full')) return;
        const source = String(pkg.course) + '-full';
        copyQuestionBank.run(String(pkg.id), String(pkg.id), source);
      });
    }
  } catch (copyError) {
    console.error('Package question bank copy skipped:', copyError.message);
  }

  async function handleAdmin(req, res, parts, method) {
    if (parts[0] === 'blogs') {
      if (method === 'GET' && parts.length === 1) {
        return sendJson(res, 200, db.prepare('SELECT * FROM blogs ORDER BY created DESC').all().map(function (x) {
          x.published = !!x.published; return x;
        }));
      }
      if (method === 'POST' && parts.length === 1) {
        let b; try { b = await readJson(req); } catch { return sendJson(res, 400, { error: 'بيانات غير صحيحة' }); }
        const slug = String(b.slug || '').trim().toLowerCase();
        if (!/^[a-z0-9][a-z0-9-]{2,100}$/.test(slug) || !String(b.title_ar || '').trim() || !String(b.body_ar || '').trim()) {
          return sendJson(res, 400, { error: 'المعرّف والعنوان والمحتوى العربي مطلوبة' });
        }
        const id = uid(), now = Date.now();
        try {
          db.prepare('INSERT INTO blogs (id,slug,title_ar,title_en,excerpt_ar,excerpt_en,body_ar,body_en,category,image,author,published,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
            .run(id, slug, b.title_ar, b.title_en || '', b.excerpt_ar || '', b.excerpt_en || '', b.body_ar, b.body_en || '', b.category || '', b.image || '', b.author || 'د. محمد عطية', b.published ? 1 : 0, now, now);
          return sendJson(res, 200, { ok: true, id: id });
        } catch { return sendJson(res, 409, { error: 'معرّف المقال مستخدم بالفعل' }); }
      }
      if (parts.length === 2) {
        const id = decodeURIComponent(parts[1]);
        const old = db.prepare('SELECT * FROM blogs WHERE id=?').get(id);
        if (!old) return sendJson(res, 404, { error: 'المقال غير موجود' });
        if (method === 'PUT') {
          let b; try { b = await readJson(req); } catch { return sendJson(res, 400, { error: 'بيانات غير صحيحة' }); }
          db.prepare('UPDATE blogs SET slug=?,title_ar=?,title_en=?,excerpt_ar=?,excerpt_en=?,body_ar=?,body_en=?,category=?,image=?,author=?,published=?,updated=? WHERE id=?')
            .run(b.slug || old.slug, b.title_ar || old.title_ar, b.title_en ?? old.title_en, b.excerpt_ar ?? old.excerpt_ar, b.excerpt_en ?? old.excerpt_en, b.body_ar || old.body_ar, b.body_en ?? old.body_en, b.category ?? old.category, b.image ?? old.image, b.author ?? old.author, b.published === undefined ? old.published : (b.published ? 1 : 0), Date.now(), id);
          return sendJson(res, 200, { ok: true });
        }
        if (method === 'DELETE') {
          db.prepare('DELETE FROM blogs WHERE id=?').run(id);
          return sendJson(res, 200, { ok: true });
        }
      }
    }

    if (parts[0] === 'invoice-settings') {
      if (method === 'GET') return sendJson(res, 200, config());
      if (method === 'PUT') {
        let b; try { b = await readJson(req); } catch { return sendJson(res, 400, { error: 'بيانات غير صحيحة' }); }
        const value = {
          sellerName: String(b.sellerName || ''),
          sellerTaxId: String(b.sellerTaxId || ''),
          sellerTaxCard: String(b.sellerTaxCard || '').replace(/\s/g, '').slice(0, 32),
          sellerAddress: String(b.sellerAddress || ''),
          vatRate: Math.max(0, Number(b.vatRate) || 0),
          baseCurrency: String(b.baseCurrency || 'USD').toUpperCase(),
          currencies: b.currencies && typeof b.currencies === 'object' ? b.currencies : {},
          taxExemptCountries: Array.isArray(b.taxExemptCountries) ? b.taxExemptCountries
            .map(x => String(x).toUpperCase()).filter(x => /^[A-Z]{2}$/.test(x)).slice(0, 50) : [],
          taxExemptBuyers: Array.isArray(b.taxExemptBuyers) ? b.taxExemptBuyers
            .map(x => String(x).trim().toLowerCase()).filter(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)).slice(0, 500) : []
        };
        setSetting('invoice_settings', JSON.stringify(value));
        return sendJson(res, 200, { ok: true, settings: value });
      }
    }

    if (parts[0] === 'invoices' && method === 'GET') {
      return sendJson(res, 200, db.prepare('SELECT i.*,u.email buyer_email FROM invoices i JOIN users u ON u.id=i.user_id ORDER BY i.created DESC LIMIT 200').all());
    }
    return false;
  }

  async function handlePublic(req, res, requestUrl, authenticatedUser) {
    const method = req.method || 'GET';
    const pathname = requestUrl.pathname;
    if (method === 'GET' && pathname === '/api/blogs') {
      return sendJson(res, 200, db.prepare('SELECT slug,title_ar,title_en,excerpt_ar,excerpt_en,body_ar,body_en,category,image,author,created FROM blogs WHERE published=1 ORDER BY created DESC').all());
    }
    if (method === 'GET' && pathname === '/api/payment-config') return sendJson(res, 200, publicConfig());
    if (method === 'GET' && pathname === '/api/my-tax-options') {
      const user = authenticatedUser(req);
      if (!user) return sendJson(res, 401, { error: 'يلزم تسجيل الدخول' });
      const value = config();
      return sendJson(res, 200, { taxExemptCountries: Array.isArray(value.taxExemptBuyers) &&
        value.taxExemptBuyers.includes(String(user.email || '').toLowerCase()) ? value.taxExemptCountries || [] : [] });
    }
    if (method === 'GET' && pathname === '/api/question-bank-status') {
      return sendJson(res, 200, db.prepare('SELECT package_id packageId, COUNT(*) count FROM questions GROUP BY package_id ORDER BY package_id').all());
    }
    if (method === 'POST' && pathname === '/api/demo/login') {
      const email = 'demo@al-ltc.local', id = 'alsaeed-demo-student';
      let user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
      if (!user) {
        db.prepare('INSERT INTO users (id,name,email,pass,role,active,created) VALUES (?,?,?,?,?,?,?)')
          .run(id, 'متدرب تجريبي', email, bcrypt.hashSync(crypto.randomBytes(18).toString('hex'), 10), 'student', 1, Date.now());
        user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
      }
      db.prepare('DELETE FROM progress WHERE user_id=?').run(user.id);
      grant(user.id, 'pmp-full', 1, 'دخول تجريبي');
      return sendJson(res, 200, {
        token: jwt.sign({ id: user.id, role: 'student' }, jwtSecret, { expiresIn: '2h' }),
        user: { id: user.id, name: user.name, email: user.email, role: 'student' },
        packageId: 'pmp-full'
      });
    }
    if (method === 'GET' && pathname === '/api/my-invoices') {
      const user = authenticatedUser(req);
      if (!user) return sendJson(res, 401, { error: 'يلزم تسجيل الدخول' });
      return sendJson(res, 200, db.prepare('SELECT i.*,COALESCE(i.package_id,o.package_id) resolved_package_id FROM invoices i LEFT JOIN orders o ON o.id=i.order_id WHERE i.user_id=? ORDER BY i.created DESC').all(user.id));
    }
    if (method === 'GET' && pathname.startsWith('/api/invoice-groups/')) {
      const user = authenticatedUser(req);
      if (!user) return sendJson(res, 401, { error: 'يلزم تسجيل الدخول' });
      const key = decodeURIComponent(pathname.slice('/api/invoice-groups/'.length));
      const items = db.prepare("SELECT * FROM invoices WHERE (purchase_id=? OR order_id=?) AND status='issued' ORDER BY created,id").all(key,key);
      if (!items.length) return sendJson(res, 404, { error: 'لا يوجد بيان مشتريات صادر' });
      if (user.role !== 'admin' && items.some(item => item.user_id !== user.id))
        return sendJson(res, 403, { error: 'لا يمكنك عرض هذا البيان' });
      return sendJson(res, 200, { purchaseId:key, items, subtotal:items.reduce((s,i)=>s+i.subtotal,0),
        tax:items.reduce((s,i)=>s+i.tax_amount,0),total:items.reduce((s,i)=>s+i.total,0),
        currency:items[0].currency });
    }
    if (method === 'GET' && pathname.startsWith('/api/invoices/')) {
      const user = authenticatedUser(req);
      if (!user) return sendJson(res, 401, { error: 'يلزم تسجيل الدخول' });
      const key = decodeURIComponent(pathname.slice('/api/invoices/'.length));
      const row = db.prepare('SELECT i.* FROM invoices i WHERE (i.id=? OR i.order_id=? OR i.invoice_no=?)').get(key, key, key);
      if (!row) return sendJson(res, 404, { error: 'الفاتورة غير موجودة' });
      if (user.role !== 'admin' && row.user_id !== user.id) return sendJson(res, 403, { error: 'لا يمكنك عرض هذه الفاتورة' });
      // A reference QR, not an ETA or ZATCA certified electronic-invoice code.
      const qr = await QRCode.toDataURL(JSON.stringify({ reference:row.invoice_no,
        date:new Date(row.issued_at || row.created).toISOString(), seller:row.seller_name,
        taxId:row.seller_tax_id || '', currency:row.currency,total:row.total,tax:row.tax_amount }),
        { width:180,margin:1,errorCorrectionLevel:'M' });
      return sendJson(res, 200, { ...row,reference_qr:qr });
    }
    return false;
  }

  return { config, publicConfig, convert, taxPolicy, createInvoice, markPaid, handleAdmin, handlePublic };
}
