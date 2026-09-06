/* ============================================================
   منصة السعيد — القاموس التكميلي V17
   يُكمل ترجمة: المراحل الدراسية · الأنظمة · الباقات · المكتبة · المدونة
   الترتيب: en · fr · tr · ur
   ============================================================ */
(function () {
'use strict';
const D = {

/* ── البرامج التعليمية والمراحل ── */
'← البرامج التعليمية':['← Academic Programmes','← Programmes académiques','← Akademik','← تعلیمی پروگرام'],
'من المرحلة الابتدائية حتى الدكتوراه — مسار تعليمي متصل بإشراف أكاديمي مباشر.':
 ['From primary school to doctorate — a connected learning path with direct academic supervision.',
  'De l’école primaire au doctorat — un parcours continu avec supervision académique.',
  'İlkokuldan doktoraya — doğrudan akademik denetimle bağlantılı bir yol.',
  'پرائمری سے ڈاکٹریٹ تک — براہ راست تعلیمی نگرانی کے ساتھ۔'],
'🎒 المراحل الدراسية':['🎒 School Stages','🎒 Cycles scolaires','🎒 Okul Kademeleri','🎒 تعلیمی مراحل'],
'🎓 الدرجات الجامعية':['🎓 University Degrees','🎓 Diplômes universitaires','🎓 Üniversite Dereceleri','🎓 یونیورسٹی ڈگریاں'],
'تعليم يبني الفهم لا الحفظ.':['Education that builds understanding, not memorisation.',
  'Une éducation qui bâtit la compréhension, pas la mémorisation.',
  'Ezberi değil anlamayı inşa eden eğitim.','رٹے نہیں، سمجھ پیدا کرنے والی تعلیم۔'],
'مجموعات صغيرة، ومعلمون متخصصون، ومتابعة دورية لولي الأمر — نُدرّس المنهج ونُعلّم كيف يُدرَس.':
 ['Small groups, specialised teachers and regular parent reports — we teach the curriculum and how to study it.',
  'Petits groupes, enseignants spécialisés et suivi parental régulier.',
  'Küçük gruplar, uzman öğretmenler ve düzenli veli raporları.',
  'چھوٹے گروپ، ماہر اساتذہ اور والدین کو باقاعدہ رپورٹ۔'],
'المرحلة الابتدائية':['Primary Stage','Cycle primaire','İlkokul','پرائمری مرحلہ'],
'المرحلة الإعدادية':['Preparatory Stage','Cycle préparatoire','Ortaokul','مڈل مرحلہ'],
'المرحلة الثانوية':['Secondary Stage','Cycle secondaire','Lise','ثانوی مرحلہ'],
'الصفوف ١–٦':['Grades 1–6','Classes 1–6','1–6. Sınıf','جماعت 1–6'],
'الصفوف ٧–٩':['Grades 7–9','Classes 7–9','7–9. Sınıf','جماعت 7–9'],
'الصفوف ١٠–١٢':['Grades 10–12','Classes 10–12','10–12. Sınıf','جماعت 10–12'],
'تأسيس قوي في المهارات الأساسية مع بناء عادات التعلّم المستقل.':
 ['A strong foundation in core skills while building independent study habits.',
  'Des bases solides et des habitudes d’étude autonomes.',
  'Temel becerilerde sağlam temel ve bağımsız çalışma alışkanlıkları.',
  'بنیادی مہارتوں میں مضبوط بنیاد اور خود مطالعہ کی عادات۔'],
'ترسيخ المفاهيم وبناء مهارات التفكير التحليلي استعداداً للثانوية.':
 ['Consolidating concepts and building analytical thinking ahead of secondary school.',
  'Consolider les concepts et développer la pensée analytique.',
  'Kavramları pekiştirme ve analitik düşünme.','تصورات کی پختگی اور تجزیاتی سوچ۔'],
'إعداد متكامل للثانوية العامة واختبارات القبول الجامعي.':
 ['Complete preparation for national exams and university entrance tests.',
  'Préparation complète aux examens nationaux et concours d’entrée.',
  'Ulusal sınavlar ve üniversite giriş sınavlarına tam hazırlık.',
  'قومی امتحانات اور یونیورسٹی داخلہ ٹیسٹ کی تیاری۔'],
'المواد':['Subjects','Matières','Dersler','مضامین'],
'ما يميّزنا':['What sets us apart','Ce qui nous distingue','Bizi ayıran','ہماری خصوصیت'],
'اللغة العربية':['Arabic','Arabe','Arapça','عربی'],
'اللغة الإنجليزية':['English','Anglais','İngilizce','انگریزی'],
'الرياضيات':['Mathematics','Mathématiques','Matematik','ریاضی'],
'العلوم':['Science','Sciences','Fen','سائنس'],
'المهارات الرقمية':['Digital Skills','Compétences numériques','Dijital Beceriler','ڈیجیٹل مہارتیں'],
'الدراسات الاجتماعية':['Social Studies','Études sociales','Sosyal Bilgiler','معاشرتی علوم'],
'المواد العلمية':['Science track','Filière scientifique','Fen alanı','سائنس گروپ'],
'المواد الأدبية':['Humanities track','Filière littéraire','Sözel alan','آرٹس گروپ'],
'اللغات':['Languages','Langues','Diller','زبانیں'],
'الرياضيات المتقدمة':['Advanced Mathematics','Mathématiques avancées','İleri Matematik','اعلیٰ ریاضی'],
'مجموعات صغيرة لمتابعة فردية':['Small groups for individual attention','Petits groupes pour un suivi individuel',
  'Bireysel ilgi için küçük gruplar','انفرادی توجہ کے لیے چھوٹے گروپ'],
'تقارير تقدّم شهرية لولي الأمر':['Monthly progress reports for parents','Rapports mensuels aux parents',
  'Velilere aylık ilerleme raporu','والدین کے لیے ماہانہ رپورٹ'],
'أنشطة تفاعلية تناسب المرحلة':['Age-appropriate interactive activities','Activités interactives adaptées',
  'Yaşa uygun etkileşimli etkinlikler','عمر کے مطابق سرگرمیاں'],
'معلمون متخصصون في التعليم المبكر':['Teachers specialised in early education','Enseignants spécialisés',
  'Erken eğitim uzmanı öğretmenler','ابتدائی تعلیم کے ماہر اساتذہ'],
'تقوية في المواد الأساسية':['Reinforcement in core subjects','Renforcement des matières principales',
  'Temel derslerde güçlendirme','بنیادی مضامین میں تقویت'],
'تدريب على أساليب الاختبارات':['Exam technique training','Entraînement aux techniques d’examen',
  'Sınav tekniği eğitimi','امتحانی تکنیک کی تربیت'],
'مهارات التنظيم وإدارة الوقت':['Organisation and time-management skills','Organisation et gestion du temps',
  'Organizasyon ve zaman yönetimi','تنظیم اور وقت کا انتظام'],
'متابعة أسبوعية للأداء':['Weekly performance follow-up','Suivi hebdomadaire','Haftalık takip','ہفتہ وار جائزہ'],
'مراجعات مكثّفة قبل الامتحانات':['Intensive pre-exam revision','Révisions intensives',
  'Sınav öncesi yoğun tekrar','امتحان سے پہلے تیاری'],
'بنوك أسئلة ونماذج سابقة':['Question banks and past papers','Banques de questions et annales',
  'Soru bankaları ve çıkmış sorular','سوالی بینک اور پچھلے پرچے'],
'إرشاد أكاديمي لاختيار التخصص':['Academic guidance on choosing a major','Orientation académique',
  'Bölüm seçiminde akademik rehberlik','مضمون کے انتخاب میں رہنمائی'],
'تحضير لاختبارات القبول':['University entrance preparation','Préparation aux concours',
  'Üniversite giriş hazırlığı','داخلہ ٹیسٹ کی تیاری'],
'استفسر عن المرحلة':['Enquire about this stage','Se renseigner','Bu kademe hakkında sorun','اس مرحلے کے بارے میں پوچھیں'],

/* ── المدونة ── */
'المدونة المهنية':['Professional Blog','Blog professionnel','Mesleki Blog','پیشہ ورانہ بلاگ'],
'مقالات تطبيقية من خبرة التدريب والاستشارات وإدارة المشاريع.':
 ['Practical articles drawn from training, consulting and project management experience.',
  'Articles pratiques issus de la formation et du conseil.',
  'Eğitim ve danışmanlık deneyiminden pratik makaleler.',
  'تربیت اور مشاورت کے تجربے سے عملی مضامین۔'],
'سيتم نشر المقالات قريباً.':['Articles coming soon.','Articles à venir.','Makaleler yakında.','مضامین جلد آ رہے ہیں۔'],

/* ── الأنظمة ── */
'أدوات تطبيقية مستقلة عن البرامج التدريبية — تشتريها وتستخدمها في عملك مباشرةً.':
 ['Applied tools independent of the training programmes — buy them and use them in your work right away.',
  'Des outils indépendants des formations — achetez-les et utilisez-les immédiatement.',
  'Eğitim programlarından bağımsız araçlar — satın alın ve hemen kullanın.',
  'تربیتی پروگراموں سے آزاد ٹولز — خریدیں اور فوراً استعمال کریں۔'],
'أنظمة تطبيقية':['Applied Systems','Systèmes appliqués','Uygulamalı Sistemler','عملی نظام'],
'أدوات تطوير ذاتي':['Self-Development Tools','Outils de développement','Kişisel Gelişim Araçları','خود ترقی ٹولز'],
'منظومة تفاعلية تبني بها قدرة الحوكمة وإدارة المخاطر والامتثال في منظمتك — عشرون عنصراً وثمانٍ وثلاثون أداة بمخرجات معتمدة.':
 ['An interactive system to build governance, risk and compliance capability in your organisation — twenty elements and thirty-eight tools with approved outputs.',
  'Un système interactif pour bâtir la capacité GRC — vingt éléments et trente-huit outils.',
  'Kurumunuzda GRC yeteneği kurmak için etkileşimli sistem — yirmi öğe, otuz sekiz araç.',
  'آپ کے ادارے میں GRC صلاحیت بنانے کا انٹرایکٹو نظام۔'],
'تقييم نضج وأداء شامل قبل وبعد':['Maturity and total performance assessment, before and after',
  'Évaluation de maturité avant/après','Öncesi ve sonrası olgunluk değerlendirmesi','پہلے اور بعد کا جائزہ'],
'خريطة الجدارات الأساسية والفجوات':['Core competency map and gaps','Carte des compétences et écarts',
  'Yetkinlik haritası ve boşluklar','بنیادی صلاحیتوں کا نقشہ'],
'مقارنة بمتطلبات المسارات الوظيفية':['Benchmarked against career-path requirements','Comparaison aux exigences de carrière',
  'Kariyer yolu gereksinimleriyle karşılaştırma','کیریئر تقاضوں سے موازنہ'],
'تقرير PDF مفصّل قابل للطباعة':['Detailed printable PDF report','Rapport PDF détaillé imprimable',
  'Ayrıntılı yazdırılabilir PDF raporu','تفصیلی PDF رپورٹ'],
'توصيات تطوير عملية مرتّبة بالأولوية':['Practical development recommendations ranked by priority',
  'Recommandations classées par priorité','Önceliğe göre sıralanmış öneriler','ترجیح کے مطابق سفارشات'],
'ابدأ التحليل ←':['Start the assessment ←','Commencer ←','Değerlendirmeyi başlat ←','تجزیہ شروع کریں ←'],
'خطة الحياة والمسار المهني':['Life & Career Plan','Plan de vie et de carrière','Yaşam ve Kariyer Planı','زندگی اور کیریئر منصوبہ'],
'أداة عملية لبناء خطة حياة متوازنة بأهداف قابلة للقياس ومراجعة دورية.':
 ['A practical tool to build a balanced life plan with measurable goals and periodic review.',
  'Un outil pratique pour un plan de vie équilibré.',
  'Ölçülebilir hedeflerle dengeli yaşam planı aracı.','قابل پیمائش اہداف کے ساتھ متوازن منصوبہ۔'],
'تحديد القيم والأولويات الشخصية':['Defining personal values and priorities','Définir valeurs et priorités',
  'Kişisel değer ve öncelikleri belirleme','ذاتی اقدار اور ترجیحات'],
'أهداف SMART على المدى القصير والطويل':['SMART goals, short and long term','Objectifs SMART court et long terme',
  'Kısa ve uzun vadeli SMART hedefler','مختصر اور طویل مدتی SMART اہداف'],
'موازنة المجالات الثمانية للحياة':['Balancing the eight life domains','Équilibrer les huit domaines de vie',
  'Sekiz yaşam alanını dengeleme','زندگی کے آٹھ شعبوں میں توازن'],
'خطة تنفيذ ربع سنوية':['Quarterly execution plan','Plan d’exécution trimestriel','Üç aylık uygulama planı','سہ ماہی منصوبہ'],
'لوحة متابعة التقدّم':['Progress tracking dashboard','Tableau de suivi','İlerleme takip paneli','پیش رفت ڈیش بورڈ'],
'ابنِ خطتك ←':['Build your plan ←','Créer votre plan ←','Planınızı oluşturun ←','اپنا منصوبہ بنائیں ←'],
'قوالب السيرة الذاتية الاحترافية':['Professional CV Templates','Modèles de CV professionnels','Profesyonel CV Şablonları','پیشہ ورانہ CV ٹیمپلیٹس'],
'قوالب سيرة ذاتية تنفيذية بالعربية والإنجليزية مع دليل الصياغة المهنية.':
 ['Executive CV templates in Arabic and English with a professional writing guide.',
  'Modèles de CV exécutifs en arabe et anglais avec guide de rédaction.',
  'Arapça ve İngilizce yönetici CV şablonları ve yazım rehberi.',
  'عربی اور انگریزی میں ایگزیکٹو CV ٹیمپلیٹس۔'],
'قوالب تنفيذية عربية وإنجليزية':['Executive templates in Arabic and English','Modèles en arabe et anglais',
  'Arapça ve İngilizce şablonlar','عربی اور انگریزی ٹیمپلیٹس'],
'نسخة ثنائية اللغة في ملف واحد':['A bilingual version in a single file','Version bilingue en un fichier',
  'Tek dosyada iki dilli sürüm','ایک فائل میں دو لسانی نسخہ'],
'دليل صياغة الإنجازات بالأرقام':['Guide to writing achievements with numbers','Guide pour chiffrer vos réalisations',
  'Başarıları sayılarla yazma rehberi','کامیابیوں کو اعداد میں لکھنے کی رہنمائی'],
'قالب خطاب تغطية':['Cover letter template','Modèle de lettre de motivation','Ön yazı şablonu','کور لیٹر ٹیمپلیٹ'],
'تصدير PDF جاهز للإرسال':['Export a send-ready PDF','Export PDF prêt à envoyer','Gönderime hazır PDF','بھیجنے کے لیے تیار PDF'],
'حمّل القوالب ←':['Download templates ←','Télécharger ←','Şablonları indir ←','ٹیمپلیٹس ڈاؤن لوڈ ←'],
'⏱ وصول دائم':['⏱ Lifetime access','⏱ Accès à vie','⏱ Ömür boyu erişim','⏱ مستقل رسائی'],
'⏱ سنة كاملة':['⏱ Full year','⏱ Une année','⏱ Tam yıl','⏱ پورا سال'],
'وصول دائم':['Lifetime access','Accès à vie','Ömür boyu erişim','مستقل رسائی'],
'سنة كاملة':['Full year','Une année','Tam yıl','پورا سال'],

/* ── الباقات ── */
'الباقة الكاملة':['Complete Package','Forfait complet','Tam Paket','مکمل پیکج'],
'باقة الاختبارات':['Exam Package','Forfait examens','Sınav Paketi','امتحانی پیکج'],
'باقة المراجعة النهائية':['Final Review Package','Forfait révision finale','Son Tekrar Paketi','آخری جائزہ پیکج'],
'باقة الدراسة الذاتية':['Self-Paced Package','Forfait autoformation','Kendi Hızında Paket','خود مطالعہ پیکج'],
'كل ما تحتاجه من الصفر حتى الاجتياز — محتوى وفيديوهات وملفات وأنشطة واختبارات وشهادة.':
 ['Everything you need from zero to passing — content, videos, downloads, activities, exams and a certificate.',
  'Tout ce dont vous avez besoin — contenu, vidéos, fichiers, activités, examens et certificat.',
  'Sıfırdan geçmeye kadar her şey — içerik, video, dosya, etkinlik, sınav ve sertifika.',
  'صفر سے کامیابی تک ہر چیز۔'],
'بنوك أسئلة بمؤقّت الاختبار الحقيقي وتحليل أداء بالنطاق — لمن أنهى الدراسة.':
 ['Question banks with the real exam timer and domain-level analysis — for those who have finished studying.',
  'Banques de questions avec minuteur réel et analyse par domaine.',
  'Gerçek sınav süreli soru bankaları ve alan analizi.','اصل امتحانی ٹائمر کے ساتھ سوالی بینک۔'],
'مراجعة مكثّفة قبل موعد اختبارك — ملخّصات وخرائط ذهنية واختبارات.':
 ['Intensive revision before your exam date — summaries, mind maps and tests.',
  'Révision intensive avant votre examen — résumés et cartes mentales.',
  'Sınavdan önce yoğun tekrar — özetler ve zihin haritaları.','امتحان سے پہلے تیز جائزہ۔'],
'حقيبة كاملة وخطة أسبوعية وبطاقات مراجعة — تدرس وحدك بمسار منظّم.':
 ['Full materials, a weekly plan and revision cards — study alone on a structured path.',
  'Support complet, plan hebdomadaire et fiches de révision.',
  'Tam materyal, haftalık plan ve tekrar kartları.','مکمل مواد اور ہفتہ وار منصوبہ۔'],
'الساعات':['Hours','Heures','Saat','گھنٹے'],
'الأسئلة':['Questions','Questions','Sorular','سوالات'],
'الفيديو':['Video','Vidéo','Video','ویڈیو'],
'الأشمل':['Most complete','Le plus complet','En kapsamlı','سب سے مکمل'],
'باقة':['packages','forfaits','paket','پیکجز'],
'🏅 شهادة حضور':['🏅 Certificate','🏅 Certificat','🏅 Sertifika','🏅 سرٹیفکیٹ'],
'🇸🇦 عربي فقط':['🇸🇦 Arabic only','🇸🇦 Arabe seulement','🇸🇦 Sadece Arapça','🇸🇦 صرف عربی'],
'🇬🇧 إنجليزي فقط':['🇬🇧 English only','🇬🇧 Anglais seulement','🇬🇧 Sadece İngilizce','🇬🇧 صرف انگریزی'],
'🌐 عربي وإنجليزي':['🌐 Arabic & English','🌐 Arabe et anglais','🌐 Arapça ve İngilizce','🌐 عربی اور انگریزی'],

/* ── أنماط التعلّم والمسارات ── */
'🏛️ حضوري':['🏛️ On-site','🏛️ Présentiel','🏛️ Yüz yüze','🏛️ آن سائٹ'],
'📡 أونلاين مباشر':['📡 Live Online','📡 En ligne direct','📡 Canlı Çevrimiçi','📡 لائیو آن لائن'],
'🎬 مسجّل':['🎬 Recorded','🎬 Enregistré','🎬 Kayıtlı','🎬 ریکارڈ شدہ'],
'🎬 مسجَّل':['🎬 Recorded','🎬 Enregistré','🎬 Kayıtlı','🎬 ریکارڈ شدہ'],
'🎯 محاكاة':['🎯 Simulation','🎯 Simulation','🎯 Simülasyon','🎯 مشق'],
'🎓 تعليم جامعي':['🎓 University','🎓 Universitaire','🎓 Üniversite','🎓 یونیورسٹی'],
'💼 استشارات':['💼 Consulting','💼 Conseil','💼 Danışmanlık','💼 مشاورت'],
'🎬 المحتوى':['🎬 Content','🎬 Contenu','🎬 İçerik','🎬 مواد'],
'🎯 المحاكاة':['🎯 Simulation','🎯 Simulation','🎯 Simülasyon','🎯 مشق'],
'🤖 المرشد الذكي':['🤖 Smart Guide','🤖 Guide intelligent','🤖 Akıllı Rehber','🤖 اسمارٹ گائیڈ'],
'📋 إدارة المشاريع':['📋 Project Management','📋 Gestion de projet','📋 Proje Yönetimi','📋 پروجیکٹ مینجمنٹ'],
'🛡️ الحوكمة والمخاطر والامتثال':['🛡️ Governance, Risk & Compliance','🛡️ Gouvernance et conformité',
  '🛡️ Yönetişim ve Uyum','🛡️ گورننس اور کمپلائنس'],
'ممارس الرشاقة المعتمد':['Agile Certified Practitioner','Praticien Agile certifié','Sertifikalı Çevik Uygulayıcı','سرٹیفائیڈ ایجائل پریکٹیشنر'],
'لين سيكس سيجما — الحزام الأخضر':['Lean Six Sigma — Green Belt','Lean Six Sigma — Ceinture verte',
  'Yalın Altı Sigma — Yeşil Kuşak','لین سکس سگما — گرین بیلٹ'],
'مكاتب المحافظ والبرامج والمشاريع':['Portfolio, Programme & Project Offices','Bureaux de portefeuille et projets',
  'Portföy ve Proje Ofisleri','پورٹ فولیو اور پروجیکٹ آفسز'],

/* ── المكتبة ── */
'الوصول للمكتبة':['Library access','Accès à la bibliothèque','Kütüphane erişimi','لائبریری رسائی'],
'متاح لمشتركي الباقات الذهبية والمباشرة. بعض المواد متاحة مجاناً للجميع.':
 ['Available to Complete and Live package subscribers. Some materials are free for everyone.',
  'Réservé aux abonnés des forfaits complets. Certains contenus sont gratuits.',
  'Tam ve Canlı paket abonelerine açık. Bazı materyaller herkese ücretsiz.',
  'مکمل اور لائیو پیکج والوں کے لیے۔ کچھ مواد سب کے لیے مفت۔'],
'سجلات مخاطر · مواثيق مشاريع · خطط اتصال · مصفوفات ضوابط — جاهزة للتعبئة.':
 ['Risk registers · project charters · communication plans · control matrices — ready to fill.',
  'Registres de risques · chartes · plans de communication — prêts à remplir.',
  'Risk kayıtları · proje beratları · iletişim planları — doldurmaya hazır.',
  'رسک رجسٹرز · پروجیکٹ چارٹرز · مواصلاتی منصوبے۔'],
'ملخّصات المعايير الدولية وأدلة التطبيق العملي بالعربية.':
 ['Summaries of international standards and practical implementation guides in Arabic.',
  'Résumés des normes internationales et guides pratiques.',
  'Uluslararası standart özetleri ve uygulama rehberleri.','بین الاقوامی معیارات کے خلاصے۔'],
'حالات واقعية من القطاعين الحكومي والخاص مع التحليل والحلول.':
 ['Real cases from the public and private sectors with analysis and solutions.',
  'Cas réels des secteurs public et privé avec analyse.',
  'Kamu ve özel sektörden gerçek vakalar.','سرکاری اور نجی شعبے کے حقیقی کیسز۔'],
'جلسات مسجّلة في إدارة المشاريع والحوكمة والجودة.':
 ['Recorded sessions on project management, governance and quality.',
  'Sessions enregistrées sur la gestion de projet et la qualité.',
  'Proje yönetimi ve kalite üzerine kayıtlı oturumlar.','پروجیکٹ مینجمنٹ اور کوالٹی پر سیشنز۔'],
'معجم ثنائي اللغة للمصطلحات المهنية مع الشرح والسياق.':
 ['A bilingual glossary of professional terms with explanation and context.',
  'Glossaire bilingue de termes professionnels avec contexte.',
  'Açıklamalı iki dilli mesleki terimler sözlüğü.','وضاحت کے ساتھ دو لسانی اصطلاحات۔'],

/* ── عن السعيد ── */
'← عن السعيد':['← About Al-Saeed','← À propos','← Hakkımızda','← السعید کے بارے میں'],
'السعيد للتعليم والتدريب والخدمات الاستشارية':
 ['Al-Saeed for Education, Training and Consulting Services',
  'Al-Saeed — Éducation, Formation et Conseil','Al-Saeed Eğitim, Öğretim ve Danışmanlık',
  'السعید تعلیم، تربیت اور مشاورت'],
'مؤسسة معتمدة للتعليم والتدريب والاستشارات':
 ['An accredited institution for education, training and consulting',
  'Un établissement accrédité','Akredite bir kurum','ایک مستند ادارہ'],
'ما يميّزنا:':['What sets us apart:','Ce qui nous distingue :','Bizi ayıran:','ہماری خصوصیت:'],
'لا نبيع محتوى مسجّلاً فحسب. نبني معك قدرة قابلة للقياس — خطة أسبوعية، ومحتوى مرتّب على نطاقات الاختبار الرسمية، واختبارات تقيس أداءك بالنطاق لا بالمعدّل، وفي مسار الحوكمة نظام تطبيقي تبني به منظومة حقيقية لمنظمتك.':
 ['We do not merely sell recorded content. We build a measurable capability with you — a weekly plan, content organised around the official exam domains, tests that measure you by domain rather than by overall average, and on the governance track an applied system with which you build a real framework for your organisation.',
  'Nous ne vendons pas seulement du contenu enregistré. Nous bâtissons avec vous une capacité mesurable.',
  'Sadece kayıtlı içerik satmıyoruz. Sizinle ölçülebilir bir yetenek inşa ediyoruz.',
  'ہم صرف ریکارڈ شدہ مواد نہیں بیچتے۔ ہم آپ کے ساتھ قابل پیمائش صلاحیت بناتے ہیں۔'],
'قيمنا الخمس':['Our five values','Nos cinq valeurs','Beş değerimiz','ہماری پانچ اقدار'],
'التطبيق قبل النظرية':['Application before theory','L’application avant la théorie',
  'Teoriden önce uygulama','نظریے سے پہلے اطلاق'],
'النجاح المقاس':['Measured success','Le succès mesuré','Ölçülen başarı','ماپی گئی کامیابی'],
'نحقّق الغرض بأقل كلفة من وقتك وجهدك — لا نُطيل لنملأ ساعات':
 ['We achieve the purpose at the least cost to your time and effort — we do not stretch content to fill hours',
  'Nous atteignons l’objectif au moindre coût en temps et en effort',
  'Amaca en az zaman ve emekle ulaşırız','ہم کم وقت اور محنت میں مقصد حاصل کرتے ہیں'],
'كل ما نُدرّسه له مخرَج عملي تأخذه معك وتستخدمه في عملك غداً':
 ['Everything we teach has a practical output you take with you and use in your work tomorrow',
  'Tout ce que nous enseignons a un résultat pratique','Öğrettiğimiz her şeyin pratik bir çıktısı var',
  'ہم جو سکھاتے ہیں اس کا عملی نتیجہ ہوتا ہے'],
'نساهم في رفع كفاءة رأس المال البشري العربي بأسعار عادلة':
 ['We help raise the capability of Arab human capital at fair prices',
  'Nous contribuons au capital humain arabe à des prix justes',
  'Adil fiyatlarla Arap insan sermayesini geliştiriyoruz','منصفانہ قیمتوں پر عرب افرادی قوت کی ترقی'],
'نسبة اجتياز تتجاوز 95% — رقم نُحاسب عليه لا نتباهى به':
 ['A pass rate above 95% — a figure we are held to, not one we boast about',
  'Un taux de réussite supérieur à 95% — un chiffre dont nous répondons',
  '%95 üzeri başarı oranı — övündüğümüz değil hesap verdiğimiz bir rakam',
  '95% سے زیادہ کامیابی — جس کا ہم جواب دیتے ہیں'],
'محتوى بلغتين ومسارات تناسب المبتدئ والخبير وكل الميزانيات':
 ['Bilingual content and tracks that suit the beginner, the expert and every budget',
  'Contenu bilingue et parcours pour tous les niveaux et budgets',
  'İki dilli içerik ve her seviyeye uygun yollar','دو لسانی مواد اور ہر سطح کے لیے راستے'],
'د. محمد عطية':['Dr Mohamed Attia','Dr Mohamed Attia','Dr Mohamed Attia','ڈاکٹر محمد عطیہ'],

/* ── تواصل ── */
'استشارة مجانية لاختيار المسار المناسب لك أو لفريقك.':
 ['A free consultation to choose the right path for you or your team.',
  'Une consultation gratuite pour choisir votre parcours.',
  'Size veya ekibinize uygun yolu seçmek için ücretsiz danışmanlık.',
  'آپ کے لیے صحیح راستہ چننے کی مفت مشاورت۔'],
'استشارة مجانية لاختيار المسار المناسب لك أو لفريقك':
 ['A free consultation to choose the right path for you or your team',
  'Une consultation gratuite pour choisir votre parcours',
  'Uygun yolu seçmek için ücretsiz danışmanlık','صحیح راستہ چننے کی مفت مشاورت'],
'استشارة اختيار المسار':['Path selection consultation','Consultation d’orientation',
  'Yol seçimi danışmanlığı','راستہ منتخب کرنے کی مشاورت'],
'تدريب مؤسسي لفريق':['Corporate team training','Formation d’équipe','Kurumsal ekip eğitimi','کارپوریٹ ٹیم تربیت'],
'استفسار عن باقة':['Package enquiry','Question sur un forfait','Paket sorusu','پیکج کے بارے میں سوال'],
'دعم فني':['Technical support','Support technique','Teknik destek','تکنیکی معاونت'],
'اسمك الكامل':['Your full name','Votre nom complet','Adınız soyadınız','آپ کا پورا نام'],
'اكتب استفسارك…':['Write your enquiry…','Écrivez votre demande…','Sorunuzu yazın…','اپنا سوال لکھیں…'],

/* ── الأنظمة — تكملة ── */
'مكتبة اثنتي عشرة سياسة قابلة للتصدير':['A library of twelve exportable policies',
  'Bibliothèque de douze politiques exportables','On iki dışa aktarılabilir politika','بارہ برآمد کے قابل پالیسیاں'],
'مستشار ذكي يقدّر خسائرك ويرشّح الأدوات':['A smart advisor that estimates your losses and recommends tools',
  'Un conseiller intelligent qui estime vos pertes','Kayıplarınızı tahmin eden akıllı danışman',
  'نقصانات کا تخمینہ لگانے والا مشیر'],
'تقارير تنفيذية بأربع صيغ':['Executive reports in four formats','Rapports exécutifs en quatre formats',
  'Dört formatta yönetici raporu','چار فارمیٹس میں رپورٹس'],
'إفادة تطبيق معتمدة برمز تحقّق':['A certified application record with a verification code',
  'Attestation certifiée avec code de vérification','Doğrulama kodlu sertifikalı belge',
  'تصدیقی کوڈ کے ساتھ مستند دستاویز'],
'افتح النظام ←':['Open the system ←','Ouvrir le système ←','Sistemi aç ←','نظام کھولیں ←'],
'تحليل الشخصية والجدارات':['Personality & Competency Analysis','Analyse de personnalité et compétences',
  'Kişilik ve Yetkinlik Analizi','شخصیت اور صلاحیت کا تجزیہ'],
'تقييم متكامل لنمط شخصيتك وجداراتك المهنية مع تقرير مفصّل وتوصيات تطوير.':
 ['A complete assessment of your personality type and professional competencies with a detailed report and development recommendations.',
  'Une évaluation complète de votre profil et de vos compétences.',
  'Kişilik tipiniz ve mesleki yetkinliklerinizin tam değerlendirmesi.',
  'آپ کی شخصیت اور پیشہ ورانہ صلاحیتوں کا مکمل جائزہ۔'],
'تحليل نمط الشخصية المهني':['Professional personality-type analysis','Analyse du type de personnalité',
  'Mesleki kişilik tipi analizi','پیشہ ورانہ شخصیت کا تجزیہ'],
'⏱ ٩٠ يوماً':['⏱ 90 days','⏱ 90 jours','⏱ 90 gün','⏱ 90 دن'],
'🎯 اختبارات محاكاة':['🎯 Simulation exams','🎯 Examens blancs','🎯 Deneme sınavları','🎯 مشق امتحانات'],
'0 باقة ←':['0 packages ←','0 forfaits ←','0 paket ←','0 پیکجز ←'],

'قوائم جاهزة للتدقيق والمراجعة والتسليم.':
 ['Ready checklists for audit, review and handover.',
  'Listes prêtes pour l’audit et la livraison.','Denetim ve teslim için hazır listeler.',
  'آڈٹ اور حوالگی کے لیے تیار فہرستیں۔']
};

/* دمج في محرك الترجمة */
function merge() {
  if (window.I18 && window.I18.dict) {
    Object.assign(window.I18.dict, D);
    if (window.I18.reindex) window.I18.reindex();
    return true;
  }
  return false;
}
if (!merge()) {
  /* المحرك لم يُحمَّل بعد — انتظر */
  let n = 0;
  const t = setInterval(() => { if (merge() || ++n > 40) clearInterval(t); }, 120);
}
window.DICT_V17 = D;
})();
