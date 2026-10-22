/* Original practice case. Not an official exam specification or reproduced exam content. */
(function(root){'use strict';
const CASE = {
  "id": "ALSAEED-PMP-CASE-SERVICE-V1",
  "title": {
    "ar": "دراسة حالة: بوابة الخدمات البلدية",
    "en": "Case study: Municipal services portal"
  },
  "ar": "تطلق بلدية «الواحة» مشروع بوابة موحدة لطلبات تصاريح الأنشطة وحجز مواعيد التفتيش. مدة المشروع تسعة أشهر وميزانيته المعتمدة 2.4 مليون ريال. الهدف ليس مجرد نشر موقع، بل خفض متوسط معالجة الطلب من عشرة أيام عمل إلى ستة خلال ثلاثة أشهر من الإطلاق. مدير الخدمات هو مالك الفائدة، والراعي هو نائب رئيس البلدية. تشمل المرحلة الأولى ثلاث خدمات فقط. تعتمد لجنة ضبط التغيير أي تعديل يمس النطاق المعتمد أو الميزانية أو موعد الإطلاق؛ ولا يملك مدير المشروع اعتماد هذه التعديلات منفردًا.\n\nاختار الفريق نهجًا مختلطًا. متطلبات التكامل والأمن ومعايير القبول الأساسية تُحدد قبل التنفيذ، بينما تُطوّر واجهة المستخدم في تكرارات مدتها أسبوعان. ترتب مالكة المنتج قائمة العمل بالتعاون مع ممثلي المستفيدين. يضم الفريق مطورين ومختبرين ومحللي أعمال وممثلة عن موظفي مراكز الخدمة. يشارك مورد خارجي في واجهة التكامل مع نظام السداد. تتطلب معايير إطلاق الخدمة نجاح جميع اختبارات الأمن، وإتمام تجربة شاملة لكل خدمة، وتدريب الموظفين، وقدرة مستخدمين من ذوي الإعاقة على إتمام الطلب دون مساعدة.\n\nفي الشهر الرابع، كشف العرض التجريبي أن مستخدمي قارئ الشاشة لا يستطيعون تأكيد الموعد. الإصلاح داخل نطاق معيار الإتاحة المتفق عليه، لكن مالكة المنتج اقترحت تأجيله من أجل تحسين شكل لوحة المتابعة. وفي الوقت نفسه، أبلغ مشرفا مركزين عن قلق الموظفين من زيادة العمل أثناء الانتقال. لا يحضران الاجتماع التقني اليومي، لكنهما يستطيعان توفير ممثلين لاختبار إجراءات العمل. دخل محلل الأعمال والمطور في خلاف متكرر حول معنى «طلب مكتمل» لأن أمثلة القبول لم تُراجع مع موظفي الخدمة.\n\nسجل الفريق احتمال تأخر واجهة السداد؛ مالك الخطر هو مسؤول التكامل. تتضمن الاستجابة المعتمدة استخدام بيئة محاكاة إذا لم يصل إصدار الاختبار بنهاية الأسبوع السادس عشر، مع استمرار متابعة المورد. وصل هذا الموعد دون تسليم الإصدار. وفي اجتماع آخر طلب الراعي إضافة خدمة رابعة؛ قدر الفريق أنها ستزيد التكلفة 180 ألف ريال وتؤخر الإطلاق أسبوعين، وقد تُقلل زمن معالجة مجموعة إضافية من الطلبات. لم تعتمد لجنة التغيير هذا الطلب بعد.\n\nقبل الإطلاق بستة أسابيع، أُعلن ضابط جديد للاحتفاظ ببيانات الطلبات. نص العقد القائم لا يغطي هذه المدة، ولا يزال فريق الامتثال يحدد ما يلزم تغييره. أظهر اختبار ترحيل البيانات أن 8% من السجلات تفتقد رقم الترخيص؛ ولا يستطيع الفريق التحقق من صحتها تلقائيًا. تقترح خطة الانتقال تشغيلًا تجريبيًا في مركز واحد، ودعمًا للمستخدمين، ومعيارًا واضحًا للرجوع إلى النظام السابق عند فشل معالجة الطلبات. وبعد الإطلاق، سيجمع مدير الخدمات زمن المعالجة أسبوعيًا ويقارنه بخط الأساس البالغ عشرة أيام، مع مراجعة الفائدة بعد ثلاثة أشهر.",
  "en": "Waha Municipality is launching one portal for business-permit applications and inspection appointments. The approved project lasts nine months and has a budget of SAR 2.4 million. Its objective is not simply to publish a website: average application processing time should fall from ten working days to six within three months of launch. The services director owns this benefit, and the deputy mayor is the sponsor. The first release covers only three services. A change control board approves changes affecting the approved scope, budget or launch date; the project manager cannot approve these changes alone.\n\nThe team uses a hybrid approach. Integration requirements, security requirements and baseline acceptance criteria are established before implementation, while the user interface is developed in two-week iterations. The product owner orders the backlog with representatives of service users. Developers, testers, business analysts and a service-centre employee representative form the team. An external supplier provides an interface to the payment system. Launch acceptance requires all security tests to pass, an end-to-end trial for each service, staff training, and users with disabilities being able to complete an application without assistance.\n\nIn month four, a demonstration reveals that screen-reader users cannot confirm an appointment. Fixing this defect is within the agreed accessibility acceptance criterion, but the product owner proposes postponing it to improve the appearance of the dashboard. At the same time, supervisors from two service centres report staff concerns about extra work during transition. They do not attend the daily technical meeting, but can provide representatives to test workflows. A business analyst and developer repeatedly disagree on what a “complete application” means because acceptance examples have not been reviewed with service staff.\n\nThe team has recorded the risk of a late payment interface; the integration lead is its owner. The approved response is to use a simulation environment if a test release has not arrived by the end of week sixteen, while continuing supplier follow-up. That deadline passes without delivery. Separately, the sponsor requests a fourth service. The team estimates an additional SAR 180,000 and a two-week launch delay, with potential processing-time benefits for another group of applications. The change board has not yet approved this request.\n\nSix weeks before launch, a new application-data retention requirement is announced. The existing contract does not cover that duration, and the compliance team is still determining the required changes. A migration test also shows that 8% of records lack a licence number, preventing automatic validation. The transition plan proposes a one-centre pilot, user support and an explicit rollback criterion if application processing fails. After launch, the services director will collect weekly processing-time measurements, compare them with the ten-day baseline, and review the benefit at three months."
};
const QUESTIONS = [
  {
    "id": "ALSAEED-PMP-CASE-SERVICE-V1-Q01",
    "domain": "people",
    "topic": "stakeholders",
    "type": "scenario",
    "difficulty": "medium",
    "approach": "hybrid",
    "question_ar": "كيف يعالج مدير المشروع قلق موظفي مركزي الخدمة بشأن الانتقال؟",
    "question_en": "How should the project manager address the two service centres’ transition concerns?",
    "options_ar": [
      "يطلب من المشرفين حضور كل اجتماع تقني يومي",
      "يشرك ممثلي المركزين في اختبار الإجراءات ويحدد احتياجات التدريب والتواصل معهم",
      "يؤجل التواصل حتى إطلاق الخدمات الثلاث",
      "يطلب من الراعي إلزام الموظفين باستخدام البوابة دون نقاش"
    ],
    "options_en": [
      "Require the supervisors to attend every daily technical meeting",
      "Involve centre representatives in workflow testing and agree training and communication needs",
      "Postpone communication until all three services launch",
      "Ask the sponsor to mandate portal use without discussion"
    ],
    "correct": "B",
    "correct_json": [
      1
    ],
    "explanation_ar": "المشرفان يستطيعان توفير ممثلين للاختبار. إشراكهم في تصميم الانتقال وتحديد الاحتياجات يعالج سبب القلق بدل زيادة اجتماعات لا تلبي احتياجهم.",
    "explanation_en": "The supervisors can supply test representatives. Involving them in transition design and needs assessment addresses their concerns rather than adding unsuitable meetings.",
    "meta": {
      "sharedCaseId": "ALSAEED-PMP-CASE-SERVICE-V1",
      "casePosition": 1,
      "scenarioText": {
        "ar": "تطلق بلدية «الواحة» مشروع بوابة موحدة لطلبات تصاريح الأنشطة وحجز مواعيد التفتيش. مدة المشروع تسعة أشهر وميزانيته المعتمدة 2.4 مليون ريال. الهدف ليس مجرد نشر موقع، بل خفض متوسط معالجة الطلب من عشرة أيام عمل إلى ستة خلال ثلاثة أشهر من الإطلاق. مدير الخدمات هو مالك الفائدة، والراعي هو نائب رئيس البلدية. تشمل المرحلة الأولى ثلاث خدمات فقط. تعتمد لجنة ضبط التغيير أي تعديل يمس النطاق المعتمد أو الميزانية أو موعد الإطلاق؛ ولا يملك مدير المشروع اعتماد هذه التعديلات منفردًا.\n\nاختار الفريق نهجًا مختلطًا. متطلبات التكامل والأمن ومعايير القبول الأساسية تُحدد قبل التنفيذ، بينما تُطوّر واجهة المستخدم في تكرارات مدتها أسبوعان. ترتب مالكة المنتج قائمة العمل بالتعاون مع ممثلي المستفيدين. يضم الفريق مطورين ومختبرين ومحللي أعمال وممثلة عن موظفي مراكز الخدمة. يشارك مورد خارجي في واجهة التكامل مع نظام السداد. تتطلب معايير إطلاق الخدمة نجاح جميع اختبارات الأمن، وإتمام تجربة شاملة لكل خدمة، وتدريب الموظفين، وقدرة مستخدمين من ذوي الإعاقة على إتمام الطلب دون مساعدة.\n\nفي الشهر الرابع، كشف العرض التجريبي أن مستخدمي قارئ الشاشة لا يستطيعون تأكيد الموعد. الإصلاح داخل نطاق معيار الإتاحة المتفق عليه، لكن مالكة المنتج اقترحت تأجيله من أجل تحسين شكل لوحة المتابعة. وفي الوقت نفسه، أبلغ مشرفا مركزين عن قلق الموظفين من زيادة العمل أثناء الانتقال. لا يحضران الاجتماع التقني اليومي، لكنهما يستطيعان توفير ممثلين لاختبار إجراءات العمل. دخل محلل الأعمال والمطور في خلاف متكرر حول معنى «طلب مكتمل» لأن أمثلة القبول لم تُراجع مع موظفي الخدمة.\n\nسجل الفريق احتمال تأخر واجهة السداد؛ مالك الخطر هو مسؤول التكامل. تتضمن الاستجابة المعتمدة استخدام بيئة محاكاة إذا لم يصل إصدار الاختبار بنهاية الأسبوع السادس عشر، مع استمرار متابعة المورد. وصل هذا الموعد دون تسليم الإصدار. وفي اجتماع آخر طلب الراعي إضافة خدمة رابعة؛ قدر الفريق أنها ستزيد التكلفة 180 ألف ريال وتؤخر الإطلاق أسبوعين، وقد تُقلل زمن معالجة مجموعة إضافية من الطلبات. لم تعتمد لجنة التغيير هذا الطلب بعد.\n\nقبل الإطلاق بستة أسابيع، أُعلن ضابط جديد للاحتفاظ ببيانات الطلبات. نص العقد القائم لا يغطي هذه المدة، ولا يزال فريق الامتثال يحدد ما يلزم تغييره. أظهر اختبار ترحيل البيانات أن 8% من السجلات تفتقد رقم الترخيص؛ ولا يستطيع الفريق التحقق من صحتها تلقائيًا. تقترح خطة الانتقال تشغيلًا تجريبيًا في مركز واحد، ودعمًا للمستخدمين، ومعيارًا واضحًا للرجوع إلى النظام السابق عند فشل معالجة الطلبات. وبعد الإطلاق، سيجمع مدير الخدمات زمن المعالجة أسبوعيًا ويقارنه بخط الأساس البالغ عشرة أيام، مع مراجعة الفائدة بعد ثلاثة أشهر.",
        "en": "Waha Municipality is launching one portal for business-permit applications and inspection appointments. The approved project lasts nine months and has a budget of SAR 2.4 million. Its objective is not simply to publish a website: average application processing time should fall from ten working days to six within three months of launch. The services director owns this benefit, and the deputy mayor is the sponsor. The first release covers only three services. A change control board approves changes affecting the approved scope, budget or launch date; the project manager cannot approve these changes alone.\n\nThe team uses a hybrid approach. Integration requirements, security requirements and baseline acceptance criteria are established before implementation, while the user interface is developed in two-week iterations. The product owner orders the backlog with representatives of service users. Developers, testers, business analysts and a service-centre employee representative form the team. An external supplier provides an interface to the payment system. Launch acceptance requires all security tests to pass, an end-to-end trial for each service, staff training, and users with disabilities being able to complete an application without assistance.\n\nIn month four, a demonstration reveals that screen-reader users cannot confirm an appointment. Fixing this defect is within the agreed accessibility acceptance criterion, but the product owner proposes postponing it to improve the appearance of the dashboard. At the same time, supervisors from two service centres report staff concerns about extra work during transition. They do not attend the daily technical meeting, but can provide representatives to test workflows. A business analyst and developer repeatedly disagree on what a “complete application” means because acceptance examples have not been reviewed with service staff.\n\nThe team has recorded the risk of a late payment interface; the integration lead is its owner. The approved response is to use a simulation environment if a test release has not arrived by the end of week sixteen, while continuing supplier follow-up. That deadline passes without delivery. Separately, the sponsor requests a fourth service. The team estimates an additional SAR 180,000 and a two-week launch delay, with potential processing-time benefits for another group of applications. The change board has not yet approved this request.\n\nSix weeks before launch, a new application-data retention requirement is announced. The existing contract does not cover that duration, and the compliance team is still determining the required changes. A migration test also shows that 8% of records lack a licence number, preventing automatic validation. The transition plan proposes a one-centre pilot, user support and an explicit rollback criterion if application processing fails. After launch, the services director will collect weekly processing-time measurements, compare them with the ten-day baseline, and review the benefit at three months."
      },
      "caseTitle": {
        "ar": "دراسة حالة: بوابة الخدمات البلدية",
        "en": "Case study: Municipal services portal"
      },
      "authorship": "Original Al-Saeed practice content; not official certification material"
    }
  },
  {
    "id": "ALSAEED-PMP-CASE-SERVICE-V1-Q02",
    "domain": "people",
    "topic": "resources",
    "type": "scenario",
    "difficulty": "medium",
    "approach": "hybrid",
    "question_ar": "ما أفضل خطوة أولى لحل الخلاف حول معنى «طلب مكتمل»؟",
    "question_en": "What is the best first step to resolve the disagreement over a “complete application”?",
    "options_ar": [
      "يعتمد تفسير المطور لأنه سينفذ النظام",
      "يستبدل محلل الأعمال لتقليل النزاع",
      "يعقد جلسة مشتركة مع المحلل والمطور وموظفي الخدمة لصياغة أمثلة قبول متفق عليها",
      "يطلب من الطرفين متابعة العمل بتفسيرين مختلفين"
    ],
    "options_en": [
      "Accept the developer’s interpretation because they implement the system",
      "Replace the analyst to reduce conflict",
      "Facilitate a joint session with the analyst, developer and service staff to agree acceptance examples",
      "Ask both parties to proceed using their own interpretations"
    ],
    "correct": "C",
    "correct_json": [
      2
    ],
    "explanation_ar": "سبب الخلاف غياب أمثلة قبول مشتركة مع مستخدمي إجراءات العمل؛ التيسير والتعاون يعالجان السبب ويحددان فهمًا قابلًا للاختبار.",
    "explanation_en": "The conflict stems from missing shared acceptance examples with workflow users. Facilitation creates a common, testable understanding.",
    "meta": {
      "sharedCaseId": "ALSAEED-PMP-CASE-SERVICE-V1",
      "casePosition": 2,
      "scenarioText": {
        "ar": "تطلق بلدية «الواحة» مشروع بوابة موحدة لطلبات تصاريح الأنشطة وحجز مواعيد التفتيش. مدة المشروع تسعة أشهر وميزانيته المعتمدة 2.4 مليون ريال. الهدف ليس مجرد نشر موقع، بل خفض متوسط معالجة الطلب من عشرة أيام عمل إلى ستة خلال ثلاثة أشهر من الإطلاق. مدير الخدمات هو مالك الفائدة، والراعي هو نائب رئيس البلدية. تشمل المرحلة الأولى ثلاث خدمات فقط. تعتمد لجنة ضبط التغيير أي تعديل يمس النطاق المعتمد أو الميزانية أو موعد الإطلاق؛ ولا يملك مدير المشروع اعتماد هذه التعديلات منفردًا.\n\nاختار الفريق نهجًا مختلطًا. متطلبات التكامل والأمن ومعايير القبول الأساسية تُحدد قبل التنفيذ، بينما تُطوّر واجهة المستخدم في تكرارات مدتها أسبوعان. ترتب مالكة المنتج قائمة العمل بالتعاون مع ممثلي المستفيدين. يضم الفريق مطورين ومختبرين ومحللي أعمال وممثلة عن موظفي مراكز الخدمة. يشارك مورد خارجي في واجهة التكامل مع نظام السداد. تتطلب معايير إطلاق الخدمة نجاح جميع اختبارات الأمن، وإتمام تجربة شاملة لكل خدمة، وتدريب الموظفين، وقدرة مستخدمين من ذوي الإعاقة على إتمام الطلب دون مساعدة.\n\nفي الشهر الرابع، كشف العرض التجريبي أن مستخدمي قارئ الشاشة لا يستطيعون تأكيد الموعد. الإصلاح داخل نطاق معيار الإتاحة المتفق عليه، لكن مالكة المنتج اقترحت تأجيله من أجل تحسين شكل لوحة المتابعة. وفي الوقت نفسه، أبلغ مشرفا مركزين عن قلق الموظفين من زيادة العمل أثناء الانتقال. لا يحضران الاجتماع التقني اليومي، لكنهما يستطيعان توفير ممثلين لاختبار إجراءات العمل. دخل محلل الأعمال والمطور في خلاف متكرر حول معنى «طلب مكتمل» لأن أمثلة القبول لم تُراجع مع موظفي الخدمة.\n\nسجل الفريق احتمال تأخر واجهة السداد؛ مالك الخطر هو مسؤول التكامل. تتضمن الاستجابة المعتمدة استخدام بيئة محاكاة إذا لم يصل إصدار الاختبار بنهاية الأسبوع السادس عشر، مع استمرار متابعة المورد. وصل هذا الموعد دون تسليم الإصدار. وفي اجتماع آخر طلب الراعي إضافة خدمة رابعة؛ قدر الفريق أنها ستزيد التكلفة 180 ألف ريال وتؤخر الإطلاق أسبوعين، وقد تُقلل زمن معالجة مجموعة إضافية من الطلبات. لم تعتمد لجنة التغيير هذا الطلب بعد.\n\nقبل الإطلاق بستة أسابيع، أُعلن ضابط جديد للاحتفاظ ببيانات الطلبات. نص العقد القائم لا يغطي هذه المدة، ولا يزال فريق الامتثال يحدد ما يلزم تغييره. أظهر اختبار ترحيل البيانات أن 8% من السجلات تفتقد رقم الترخيص؛ ولا يستطيع الفريق التحقق من صحتها تلقائيًا. تقترح خطة الانتقال تشغيلًا تجريبيًا في مركز واحد، ودعمًا للمستخدمين، ومعيارًا واضحًا للرجوع إلى النظام السابق عند فشل معالجة الطلبات. وبعد الإطلاق، سيجمع مدير الخدمات زمن المعالجة أسبوعيًا ويقارنه بخط الأساس البالغ عشرة أيام، مع مراجعة الفائدة بعد ثلاثة أشهر.",
        "en": "Waha Municipality is launching one portal for business-permit applications and inspection appointments. The approved project lasts nine months and has a budget of SAR 2.4 million. Its objective is not simply to publish a website: average application processing time should fall from ten working days to six within three months of launch. The services director owns this benefit, and the deputy mayor is the sponsor. The first release covers only three services. A change control board approves changes affecting the approved scope, budget or launch date; the project manager cannot approve these changes alone.\n\nThe team uses a hybrid approach. Integration requirements, security requirements and baseline acceptance criteria are established before implementation, while the user interface is developed in two-week iterations. The product owner orders the backlog with representatives of service users. Developers, testers, business analysts and a service-centre employee representative form the team. An external supplier provides an interface to the payment system. Launch acceptance requires all security tests to pass, an end-to-end trial for each service, staff training, and users with disabilities being able to complete an application without assistance.\n\nIn month four, a demonstration reveals that screen-reader users cannot confirm an appointment. Fixing this defect is within the agreed accessibility acceptance criterion, but the product owner proposes postponing it to improve the appearance of the dashboard. At the same time, supervisors from two service centres report staff concerns about extra work during transition. They do not attend the daily technical meeting, but can provide representatives to test workflows. A business analyst and developer repeatedly disagree on what a “complete application” means because acceptance examples have not been reviewed with service staff.\n\nThe team has recorded the risk of a late payment interface; the integration lead is its owner. The approved response is to use a simulation environment if a test release has not arrived by the end of week sixteen, while continuing supplier follow-up. That deadline passes without delivery. Separately, the sponsor requests a fourth service. The team estimates an additional SAR 180,000 and a two-week launch delay, with potential processing-time benefits for another group of applications. The change board has not yet approved this request.\n\nSix weeks before launch, a new application-data retention requirement is announced. The existing contract does not cover that duration, and the compliance team is still determining the required changes. A migration test also shows that 8% of records lack a licence number, preventing automatic validation. The transition plan proposes a one-centre pilot, user support and an explicit rollback criterion if application processing fails. After launch, the services director will collect weekly processing-time measurements, compare them with the ten-day baseline, and review the benefit at three months."
      },
      "caseTitle": {
        "ar": "دراسة حالة: بوابة الخدمات البلدية",
        "en": "Case study: Municipal services portal"
      },
      "authorship": "Original Al-Saeed practice content; not official certification material"
    }
  },
  {
    "id": "ALSAEED-PMP-CASE-SERVICE-V1-Q03",
    "domain": "process",
    "topic": "quality",
    "type": "scenario",
    "difficulty": "medium",
    "approach": "hybrid",
    "question_ar": "كيف يتعامل الفريق مع تعذر تأكيد الموعد باستخدام قارئ الشاشة؟",
    "question_en": "How should the team handle screen-reader users being unable to confirm an appointment?",
    "options_ar": [
      "يعامل الأمر كعيب مقابل معيار القبول القائم ويعطي إصلاحه أولوية مناسبة قبل الإطلاق",
      "يستبعد معيار الإتاحة لأن لوحة المتابعة أجمل",
      "يطلب تمويل نطاق جديد دون فحص معيار القبول",
      "ينشر الخدمة ويعتبر طلب المساعدة بديلًا دائمًا"
    ],
    "options_en": [
      "Treat it as a defect against the existing acceptance criterion and prioritize correction before launch",
      "Remove the accessibility criterion because the dashboard looks better",
      "Request funding for new scope without examining acceptance criteria",
      "Launch and treat assisted applications as a permanent substitute"
    ],
    "correct": "A",
    "correct_json": [
      0
    ],
    "explanation_ar": "إتمام الطلب دون مساعدة معيار إطلاق معتمد، والإصلاح داخل النطاق. التحسين الشكلي لا يبرر إهمال عيب يمنع القبول.",
    "explanation_en": "Unassisted completion is an agreed launch criterion and the fix is in scope. Cosmetic improvements do not justify ignoring a blocking acceptance defect.",
    "meta": {
      "sharedCaseId": "ALSAEED-PMP-CASE-SERVICE-V1",
      "casePosition": 3,
      "scenarioText": {
        "ar": "تطلق بلدية «الواحة» مشروع بوابة موحدة لطلبات تصاريح الأنشطة وحجز مواعيد التفتيش. مدة المشروع تسعة أشهر وميزانيته المعتمدة 2.4 مليون ريال. الهدف ليس مجرد نشر موقع، بل خفض متوسط معالجة الطلب من عشرة أيام عمل إلى ستة خلال ثلاثة أشهر من الإطلاق. مدير الخدمات هو مالك الفائدة، والراعي هو نائب رئيس البلدية. تشمل المرحلة الأولى ثلاث خدمات فقط. تعتمد لجنة ضبط التغيير أي تعديل يمس النطاق المعتمد أو الميزانية أو موعد الإطلاق؛ ولا يملك مدير المشروع اعتماد هذه التعديلات منفردًا.\n\nاختار الفريق نهجًا مختلطًا. متطلبات التكامل والأمن ومعايير القبول الأساسية تُحدد قبل التنفيذ، بينما تُطوّر واجهة المستخدم في تكرارات مدتها أسبوعان. ترتب مالكة المنتج قائمة العمل بالتعاون مع ممثلي المستفيدين. يضم الفريق مطورين ومختبرين ومحللي أعمال وممثلة عن موظفي مراكز الخدمة. يشارك مورد خارجي في واجهة التكامل مع نظام السداد. تتطلب معايير إطلاق الخدمة نجاح جميع اختبارات الأمن، وإتمام تجربة شاملة لكل خدمة، وتدريب الموظفين، وقدرة مستخدمين من ذوي الإعاقة على إتمام الطلب دون مساعدة.\n\nفي الشهر الرابع، كشف العرض التجريبي أن مستخدمي قارئ الشاشة لا يستطيعون تأكيد الموعد. الإصلاح داخل نطاق معيار الإتاحة المتفق عليه، لكن مالكة المنتج اقترحت تأجيله من أجل تحسين شكل لوحة المتابعة. وفي الوقت نفسه، أبلغ مشرفا مركزين عن قلق الموظفين من زيادة العمل أثناء الانتقال. لا يحضران الاجتماع التقني اليومي، لكنهما يستطيعان توفير ممثلين لاختبار إجراءات العمل. دخل محلل الأعمال والمطور في خلاف متكرر حول معنى «طلب مكتمل» لأن أمثلة القبول لم تُراجع مع موظفي الخدمة.\n\nسجل الفريق احتمال تأخر واجهة السداد؛ مالك الخطر هو مسؤول التكامل. تتضمن الاستجابة المعتمدة استخدام بيئة محاكاة إذا لم يصل إصدار الاختبار بنهاية الأسبوع السادس عشر، مع استمرار متابعة المورد. وصل هذا الموعد دون تسليم الإصدار. وفي اجتماع آخر طلب الراعي إضافة خدمة رابعة؛ قدر الفريق أنها ستزيد التكلفة 180 ألف ريال وتؤخر الإطلاق أسبوعين، وقد تُقلل زمن معالجة مجموعة إضافية من الطلبات. لم تعتمد لجنة التغيير هذا الطلب بعد.\n\nقبل الإطلاق بستة أسابيع، أُعلن ضابط جديد للاحتفاظ ببيانات الطلبات. نص العقد القائم لا يغطي هذه المدة، ولا يزال فريق الامتثال يحدد ما يلزم تغييره. أظهر اختبار ترحيل البيانات أن 8% من السجلات تفتقد رقم الترخيص؛ ولا يستطيع الفريق التحقق من صحتها تلقائيًا. تقترح خطة الانتقال تشغيلًا تجريبيًا في مركز واحد، ودعمًا للمستخدمين، ومعيارًا واضحًا للرجوع إلى النظام السابق عند فشل معالجة الطلبات. وبعد الإطلاق، سيجمع مدير الخدمات زمن المعالجة أسبوعيًا ويقارنه بخط الأساس البالغ عشرة أيام، مع مراجعة الفائدة بعد ثلاثة أشهر.",
        "en": "Waha Municipality is launching one portal for business-permit applications and inspection appointments. The approved project lasts nine months and has a budget of SAR 2.4 million. Its objective is not simply to publish a website: average application processing time should fall from ten working days to six within three months of launch. The services director owns this benefit, and the deputy mayor is the sponsor. The first release covers only three services. A change control board approves changes affecting the approved scope, budget or launch date; the project manager cannot approve these changes alone.\n\nThe team uses a hybrid approach. Integration requirements, security requirements and baseline acceptance criteria are established before implementation, while the user interface is developed in two-week iterations. The product owner orders the backlog with representatives of service users. Developers, testers, business analysts and a service-centre employee representative form the team. An external supplier provides an interface to the payment system. Launch acceptance requires all security tests to pass, an end-to-end trial for each service, staff training, and users with disabilities being able to complete an application without assistance.\n\nIn month four, a demonstration reveals that screen-reader users cannot confirm an appointment. Fixing this defect is within the agreed accessibility acceptance criterion, but the product owner proposes postponing it to improve the appearance of the dashboard. At the same time, supervisors from two service centres report staff concerns about extra work during transition. They do not attend the daily technical meeting, but can provide representatives to test workflows. A business analyst and developer repeatedly disagree on what a “complete application” means because acceptance examples have not been reviewed with service staff.\n\nThe team has recorded the risk of a late payment interface; the integration lead is its owner. The approved response is to use a simulation environment if a test release has not arrived by the end of week sixteen, while continuing supplier follow-up. That deadline passes without delivery. Separately, the sponsor requests a fourth service. The team estimates an additional SAR 180,000 and a two-week launch delay, with potential processing-time benefits for another group of applications. The change board has not yet approved this request.\n\nSix weeks before launch, a new application-data retention requirement is announced. The existing contract does not cover that duration, and the compliance team is still determining the required changes. A migration test also shows that 8% of records lack a licence number, preventing automatic validation. The transition plan proposes a one-centre pilot, user support and an explicit rollback criterion if application processing fails. After launch, the services director will collect weekly processing-time measurements, compare them with the ten-day baseline, and review the benefit at three months."
      },
      "caseTitle": {
        "ar": "دراسة حالة: بوابة الخدمات البلدية",
        "en": "Case study: Municipal services portal"
      },
      "authorship": "Original Al-Saeed practice content; not official certification material"
    }
  },
  {
    "id": "ALSAEED-PMP-CASE-SERVICE-V1-Q04",
    "domain": "process",
    "topic": "risk",
    "type": "scenario",
    "difficulty": "medium",
    "approach": "hybrid",
    "question_ar": "انتهى الأسبوع السادس عشر دون واجهة السداد. ما التصرف الأنسب؟",
    "question_en": "Week sixteen ends without the payment interface. What is the most appropriate action?",
    "options_ar": [
      "يحذف مسؤول التكامل الخطر لأنه أصبح واقعًا",
      "ينتظر الفريق أسبوعين دون إجراء",
      "يلغي الفريق جميع اختبارات التكامل",
      "ينفذ مسؤول التكامل استجابة المحاكاة المعتمدة ويسجل الوضع ويتابع المورد"
    ],
    "options_en": [
      "The integration lead deletes the risk because it has occurred",
      "The team waits two weeks without action",
      "The team cancels every integration test",
      "The integration lead implements the approved simulation response, records the issue and continues supplier follow-up"
    ],
    "correct": "D",
    "correct_json": [
      3
    ],
    "explanation_ar": "تحقق المحفز المحدد في السجل وله مالك واستجابة معتمدة. تُنفذ الاستجابة وتُتابع القضية؛ لا تُعامل المحاكاة كبديل عن تحقق التكامل الفعلي قبل القبول.",
    "explanation_en": "The recorded trigger has occurred and has an owner and approved response. Execute it and track the issue; simulation does not replace real integration validation before acceptance.",
    "meta": {
      "sharedCaseId": "ALSAEED-PMP-CASE-SERVICE-V1",
      "casePosition": 4,
      "scenarioText": {
        "ar": "تطلق بلدية «الواحة» مشروع بوابة موحدة لطلبات تصاريح الأنشطة وحجز مواعيد التفتيش. مدة المشروع تسعة أشهر وميزانيته المعتمدة 2.4 مليون ريال. الهدف ليس مجرد نشر موقع، بل خفض متوسط معالجة الطلب من عشرة أيام عمل إلى ستة خلال ثلاثة أشهر من الإطلاق. مدير الخدمات هو مالك الفائدة، والراعي هو نائب رئيس البلدية. تشمل المرحلة الأولى ثلاث خدمات فقط. تعتمد لجنة ضبط التغيير أي تعديل يمس النطاق المعتمد أو الميزانية أو موعد الإطلاق؛ ولا يملك مدير المشروع اعتماد هذه التعديلات منفردًا.\n\nاختار الفريق نهجًا مختلطًا. متطلبات التكامل والأمن ومعايير القبول الأساسية تُحدد قبل التنفيذ، بينما تُطوّر واجهة المستخدم في تكرارات مدتها أسبوعان. ترتب مالكة المنتج قائمة العمل بالتعاون مع ممثلي المستفيدين. يضم الفريق مطورين ومختبرين ومحللي أعمال وممثلة عن موظفي مراكز الخدمة. يشارك مورد خارجي في واجهة التكامل مع نظام السداد. تتطلب معايير إطلاق الخدمة نجاح جميع اختبارات الأمن، وإتمام تجربة شاملة لكل خدمة، وتدريب الموظفين، وقدرة مستخدمين من ذوي الإعاقة على إتمام الطلب دون مساعدة.\n\nفي الشهر الرابع، كشف العرض التجريبي أن مستخدمي قارئ الشاشة لا يستطيعون تأكيد الموعد. الإصلاح داخل نطاق معيار الإتاحة المتفق عليه، لكن مالكة المنتج اقترحت تأجيله من أجل تحسين شكل لوحة المتابعة. وفي الوقت نفسه، أبلغ مشرفا مركزين عن قلق الموظفين من زيادة العمل أثناء الانتقال. لا يحضران الاجتماع التقني اليومي، لكنهما يستطيعان توفير ممثلين لاختبار إجراءات العمل. دخل محلل الأعمال والمطور في خلاف متكرر حول معنى «طلب مكتمل» لأن أمثلة القبول لم تُراجع مع موظفي الخدمة.\n\nسجل الفريق احتمال تأخر واجهة السداد؛ مالك الخطر هو مسؤول التكامل. تتضمن الاستجابة المعتمدة استخدام بيئة محاكاة إذا لم يصل إصدار الاختبار بنهاية الأسبوع السادس عشر، مع استمرار متابعة المورد. وصل هذا الموعد دون تسليم الإصدار. وفي اجتماع آخر طلب الراعي إضافة خدمة رابعة؛ قدر الفريق أنها ستزيد التكلفة 180 ألف ريال وتؤخر الإطلاق أسبوعين، وقد تُقلل زمن معالجة مجموعة إضافية من الطلبات. لم تعتمد لجنة التغيير هذا الطلب بعد.\n\nقبل الإطلاق بستة أسابيع، أُعلن ضابط جديد للاحتفاظ ببيانات الطلبات. نص العقد القائم لا يغطي هذه المدة، ولا يزال فريق الامتثال يحدد ما يلزم تغييره. أظهر اختبار ترحيل البيانات أن 8% من السجلات تفتقد رقم الترخيص؛ ولا يستطيع الفريق التحقق من صحتها تلقائيًا. تقترح خطة الانتقال تشغيلًا تجريبيًا في مركز واحد، ودعمًا للمستخدمين، ومعيارًا واضحًا للرجوع إلى النظام السابق عند فشل معالجة الطلبات. وبعد الإطلاق، سيجمع مدير الخدمات زمن المعالجة أسبوعيًا ويقارنه بخط الأساس البالغ عشرة أيام، مع مراجعة الفائدة بعد ثلاثة أشهر.",
        "en": "Waha Municipality is launching one portal for business-permit applications and inspection appointments. The approved project lasts nine months and has a budget of SAR 2.4 million. Its objective is not simply to publish a website: average application processing time should fall from ten working days to six within three months of launch. The services director owns this benefit, and the deputy mayor is the sponsor. The first release covers only three services. A change control board approves changes affecting the approved scope, budget or launch date; the project manager cannot approve these changes alone.\n\nThe team uses a hybrid approach. Integration requirements, security requirements and baseline acceptance criteria are established before implementation, while the user interface is developed in two-week iterations. The product owner orders the backlog with representatives of service users. Developers, testers, business analysts and a service-centre employee representative form the team. An external supplier provides an interface to the payment system. Launch acceptance requires all security tests to pass, an end-to-end trial for each service, staff training, and users with disabilities being able to complete an application without assistance.\n\nIn month four, a demonstration reveals that screen-reader users cannot confirm an appointment. Fixing this defect is within the agreed accessibility acceptance criterion, but the product owner proposes postponing it to improve the appearance of the dashboard. At the same time, supervisors from two service centres report staff concerns about extra work during transition. They do not attend the daily technical meeting, but can provide representatives to test workflows. A business analyst and developer repeatedly disagree on what a “complete application” means because acceptance examples have not been reviewed with service staff.\n\nThe team has recorded the risk of a late payment interface; the integration lead is its owner. The approved response is to use a simulation environment if a test release has not arrived by the end of week sixteen, while continuing supplier follow-up. That deadline passes without delivery. Separately, the sponsor requests a fourth service. The team estimates an additional SAR 180,000 and a two-week launch delay, with potential processing-time benefits for another group of applications. The change board has not yet approved this request.\n\nSix weeks before launch, a new application-data retention requirement is announced. The existing contract does not cover that duration, and the compliance team is still determining the required changes. A migration test also shows that 8% of records lack a licence number, preventing automatic validation. The transition plan proposes a one-centre pilot, user support and an explicit rollback criterion if application processing fails. After launch, the services director will collect weekly processing-time measurements, compare them with the ten-day baseline, and review the benefit at three months."
      },
      "caseTitle": {
        "ar": "دراسة حالة: بوابة الخدمات البلدية",
        "en": "Case study: Municipal services portal"
      },
      "authorship": "Original Al-Saeed practice content; not official certification material"
    }
  },
  {
    "id": "ALSAEED-PMP-CASE-SERVICE-V1-Q05",
    "domain": "process",
    "topic": "scope",
    "type": "scenario",
    "difficulty": "medium",
    "approach": "hybrid",
    "question_ar": "ما الخطوة التالية لطلب الراعي إضافة الخدمة الرابعة؟",
    "question_en": "What is the next step for the sponsor’s fourth-service request?",
    "options_ar": [
      "يبدأ الفريق التنفيذ لأن مقدم الطلب هو الراعي",
      "يرفض مدير المشروع الطلب تلقائيًا لأن التكلفة ستزيد",
      "يوثق أثر التكلفة والموعد والفوائد والبدائل ويرفع الطلب للجنة المختصة قبل تعديل خط الأساس",
      "يغير مدير المشروع خط الأساس ثم يطلب اعتمادًا لاحقًا"
    ],
    "options_en": [
      "Start implementation because the sponsor requested it",
      "Automatically reject the request because cost increases",
      "Document cost, schedule, benefit impacts and alternatives and submit to the board before changing baselines",
      "Change the baseline now and seek approval later"
    ],
    "correct": "C",
    "correct_json": [
      2
    ],
    "explanation_ar": "صلاحية التغيير للجنة. توجد تقديرات للأثر لكنها ليست اعتمادًا؛ يعرض المدير تحليلًا متكاملًا يساعد قرارًا موثقًا.",
    "explanation_en": "The board holds change authority. Impact estimates are not approval; an integrated assessment supports a documented decision.",
    "meta": {
      "sharedCaseId": "ALSAEED-PMP-CASE-SERVICE-V1",
      "casePosition": 5,
      "scenarioText": {
        "ar": "تطلق بلدية «الواحة» مشروع بوابة موحدة لطلبات تصاريح الأنشطة وحجز مواعيد التفتيش. مدة المشروع تسعة أشهر وميزانيته المعتمدة 2.4 مليون ريال. الهدف ليس مجرد نشر موقع، بل خفض متوسط معالجة الطلب من عشرة أيام عمل إلى ستة خلال ثلاثة أشهر من الإطلاق. مدير الخدمات هو مالك الفائدة، والراعي هو نائب رئيس البلدية. تشمل المرحلة الأولى ثلاث خدمات فقط. تعتمد لجنة ضبط التغيير أي تعديل يمس النطاق المعتمد أو الميزانية أو موعد الإطلاق؛ ولا يملك مدير المشروع اعتماد هذه التعديلات منفردًا.\n\nاختار الفريق نهجًا مختلطًا. متطلبات التكامل والأمن ومعايير القبول الأساسية تُحدد قبل التنفيذ، بينما تُطوّر واجهة المستخدم في تكرارات مدتها أسبوعان. ترتب مالكة المنتج قائمة العمل بالتعاون مع ممثلي المستفيدين. يضم الفريق مطورين ومختبرين ومحللي أعمال وممثلة عن موظفي مراكز الخدمة. يشارك مورد خارجي في واجهة التكامل مع نظام السداد. تتطلب معايير إطلاق الخدمة نجاح جميع اختبارات الأمن، وإتمام تجربة شاملة لكل خدمة، وتدريب الموظفين، وقدرة مستخدمين من ذوي الإعاقة على إتمام الطلب دون مساعدة.\n\nفي الشهر الرابع، كشف العرض التجريبي أن مستخدمي قارئ الشاشة لا يستطيعون تأكيد الموعد. الإصلاح داخل نطاق معيار الإتاحة المتفق عليه، لكن مالكة المنتج اقترحت تأجيله من أجل تحسين شكل لوحة المتابعة. وفي الوقت نفسه، أبلغ مشرفا مركزين عن قلق الموظفين من زيادة العمل أثناء الانتقال. لا يحضران الاجتماع التقني اليومي، لكنهما يستطيعان توفير ممثلين لاختبار إجراءات العمل. دخل محلل الأعمال والمطور في خلاف متكرر حول معنى «طلب مكتمل» لأن أمثلة القبول لم تُراجع مع موظفي الخدمة.\n\nسجل الفريق احتمال تأخر واجهة السداد؛ مالك الخطر هو مسؤول التكامل. تتضمن الاستجابة المعتمدة استخدام بيئة محاكاة إذا لم يصل إصدار الاختبار بنهاية الأسبوع السادس عشر، مع استمرار متابعة المورد. وصل هذا الموعد دون تسليم الإصدار. وفي اجتماع آخر طلب الراعي إضافة خدمة رابعة؛ قدر الفريق أنها ستزيد التكلفة 180 ألف ريال وتؤخر الإطلاق أسبوعين، وقد تُقلل زمن معالجة مجموعة إضافية من الطلبات. لم تعتمد لجنة التغيير هذا الطلب بعد.\n\nقبل الإطلاق بستة أسابيع، أُعلن ضابط جديد للاحتفاظ ببيانات الطلبات. نص العقد القائم لا يغطي هذه المدة، ولا يزال فريق الامتثال يحدد ما يلزم تغييره. أظهر اختبار ترحيل البيانات أن 8% من السجلات تفتقد رقم الترخيص؛ ولا يستطيع الفريق التحقق من صحتها تلقائيًا. تقترح خطة الانتقال تشغيلًا تجريبيًا في مركز واحد، ودعمًا للمستخدمين، ومعيارًا واضحًا للرجوع إلى النظام السابق عند فشل معالجة الطلبات. وبعد الإطلاق، سيجمع مدير الخدمات زمن المعالجة أسبوعيًا ويقارنه بخط الأساس البالغ عشرة أيام، مع مراجعة الفائدة بعد ثلاثة أشهر.",
        "en": "Waha Municipality is launching one portal for business-permit applications and inspection appointments. The approved project lasts nine months and has a budget of SAR 2.4 million. Its objective is not simply to publish a website: average application processing time should fall from ten working days to six within three months of launch. The services director owns this benefit, and the deputy mayor is the sponsor. The first release covers only three services. A change control board approves changes affecting the approved scope, budget or launch date; the project manager cannot approve these changes alone.\n\nThe team uses a hybrid approach. Integration requirements, security requirements and baseline acceptance criteria are established before implementation, while the user interface is developed in two-week iterations. The product owner orders the backlog with representatives of service users. Developers, testers, business analysts and a service-centre employee representative form the team. An external supplier provides an interface to the payment system. Launch acceptance requires all security tests to pass, an end-to-end trial for each service, staff training, and users with disabilities being able to complete an application without assistance.\n\nIn month four, a demonstration reveals that screen-reader users cannot confirm an appointment. Fixing this defect is within the agreed accessibility acceptance criterion, but the product owner proposes postponing it to improve the appearance of the dashboard. At the same time, supervisors from two service centres report staff concerns about extra work during transition. They do not attend the daily technical meeting, but can provide representatives to test workflows. A business analyst and developer repeatedly disagree on what a “complete application” means because acceptance examples have not been reviewed with service staff.\n\nThe team has recorded the risk of a late payment interface; the integration lead is its owner. The approved response is to use a simulation environment if a test release has not arrived by the end of week sixteen, while continuing supplier follow-up. That deadline passes without delivery. Separately, the sponsor requests a fourth service. The team estimates an additional SAR 180,000 and a two-week launch delay, with potential processing-time benefits for another group of applications. The change board has not yet approved this request.\n\nSix weeks before launch, a new application-data retention requirement is announced. The existing contract does not cover that duration, and the compliance team is still determining the required changes. A migration test also shows that 8% of records lack a licence number, preventing automatic validation. The transition plan proposes a one-centre pilot, user support and an explicit rollback criterion if application processing fails. After launch, the services director will collect weekly processing-time measurements, compare them with the ten-day baseline, and review the benefit at three months."
      },
      "caseTitle": {
        "ar": "دراسة حالة: بوابة الخدمات البلدية",
        "en": "Case study: Municipal services portal"
      },
      "authorship": "Original Al-Saeed practice content; not official certification material"
    }
  },
  {
    "id": "ALSAEED-PMP-CASE-SERVICE-V1-Q06",
    "domain": "business",
    "topic": "governance",
    "type": "scenario",
    "difficulty": "medium",
    "approach": "hybrid",
    "question_ar": "ما أول إجراء بشأن ضابط الاحتفاظ الجديد قبل تحديد الحل؟",
    "question_en": "What should happen first concerning the new retention requirement, before deciding on a solution?",
    "options_ar": [
      "يحلل الفريق مع الامتثال والمورد الفجوة والأثر والالتزامات ثم يسلك مسار التغيير المناسب",
      "يوقع المدير تمديد العقد دون تحليل",
      "يتجاهل الفريق الضابط لأن العقد أقدم منه",
      "يعلن الفريق الامتثال دون اختبار"
    ],
    "options_en": [
      "Assess the gap, impacts and obligations with compliance and the supplier, then use the appropriate change process",
      "The manager signs a contract extension without analysis",
      "Ignore the requirement because the contract predates it",
      "Declare compliance without testing"
    ],
    "correct": "A",
    "correct_json": [
      0
    ],
    "explanation_ar": "لم تحدد التغييرات اللازمة بعد. يبدأ القرار بتحليل الفجوة والأثر مع المختصين، وليس التزامًا تعاقديًا أو تجاهلًا للمتطلب.",
    "explanation_en": "Required changes are not yet known. Begin with expert gap and impact assessment, not an unsupported contract commitment or dismissal of the requirement.",
    "meta": {
      "sharedCaseId": "ALSAEED-PMP-CASE-SERVICE-V1",
      "casePosition": 6,
      "scenarioText": {
        "ar": "تطلق بلدية «الواحة» مشروع بوابة موحدة لطلبات تصاريح الأنشطة وحجز مواعيد التفتيش. مدة المشروع تسعة أشهر وميزانيته المعتمدة 2.4 مليون ريال. الهدف ليس مجرد نشر موقع، بل خفض متوسط معالجة الطلب من عشرة أيام عمل إلى ستة خلال ثلاثة أشهر من الإطلاق. مدير الخدمات هو مالك الفائدة، والراعي هو نائب رئيس البلدية. تشمل المرحلة الأولى ثلاث خدمات فقط. تعتمد لجنة ضبط التغيير أي تعديل يمس النطاق المعتمد أو الميزانية أو موعد الإطلاق؛ ولا يملك مدير المشروع اعتماد هذه التعديلات منفردًا.\n\nاختار الفريق نهجًا مختلطًا. متطلبات التكامل والأمن ومعايير القبول الأساسية تُحدد قبل التنفيذ، بينما تُطوّر واجهة المستخدم في تكرارات مدتها أسبوعان. ترتب مالكة المنتج قائمة العمل بالتعاون مع ممثلي المستفيدين. يضم الفريق مطورين ومختبرين ومحللي أعمال وممثلة عن موظفي مراكز الخدمة. يشارك مورد خارجي في واجهة التكامل مع نظام السداد. تتطلب معايير إطلاق الخدمة نجاح جميع اختبارات الأمن، وإتمام تجربة شاملة لكل خدمة، وتدريب الموظفين، وقدرة مستخدمين من ذوي الإعاقة على إتمام الطلب دون مساعدة.\n\nفي الشهر الرابع، كشف العرض التجريبي أن مستخدمي قارئ الشاشة لا يستطيعون تأكيد الموعد. الإصلاح داخل نطاق معيار الإتاحة المتفق عليه، لكن مالكة المنتج اقترحت تأجيله من أجل تحسين شكل لوحة المتابعة. وفي الوقت نفسه، أبلغ مشرفا مركزين عن قلق الموظفين من زيادة العمل أثناء الانتقال. لا يحضران الاجتماع التقني اليومي، لكنهما يستطيعان توفير ممثلين لاختبار إجراءات العمل. دخل محلل الأعمال والمطور في خلاف متكرر حول معنى «طلب مكتمل» لأن أمثلة القبول لم تُراجع مع موظفي الخدمة.\n\nسجل الفريق احتمال تأخر واجهة السداد؛ مالك الخطر هو مسؤول التكامل. تتضمن الاستجابة المعتمدة استخدام بيئة محاكاة إذا لم يصل إصدار الاختبار بنهاية الأسبوع السادس عشر، مع استمرار متابعة المورد. وصل هذا الموعد دون تسليم الإصدار. وفي اجتماع آخر طلب الراعي إضافة خدمة رابعة؛ قدر الفريق أنها ستزيد التكلفة 180 ألف ريال وتؤخر الإطلاق أسبوعين، وقد تُقلل زمن معالجة مجموعة إضافية من الطلبات. لم تعتمد لجنة التغيير هذا الطلب بعد.\n\nقبل الإطلاق بستة أسابيع، أُعلن ضابط جديد للاحتفاظ ببيانات الطلبات. نص العقد القائم لا يغطي هذه المدة، ولا يزال فريق الامتثال يحدد ما يلزم تغييره. أظهر اختبار ترحيل البيانات أن 8% من السجلات تفتقد رقم الترخيص؛ ولا يستطيع الفريق التحقق من صحتها تلقائيًا. تقترح خطة الانتقال تشغيلًا تجريبيًا في مركز واحد، ودعمًا للمستخدمين، ومعيارًا واضحًا للرجوع إلى النظام السابق عند فشل معالجة الطلبات. وبعد الإطلاق، سيجمع مدير الخدمات زمن المعالجة أسبوعيًا ويقارنه بخط الأساس البالغ عشرة أيام، مع مراجعة الفائدة بعد ثلاثة أشهر.",
        "en": "Waha Municipality is launching one portal for business-permit applications and inspection appointments. The approved project lasts nine months and has a budget of SAR 2.4 million. Its objective is not simply to publish a website: average application processing time should fall from ten working days to six within three months of launch. The services director owns this benefit, and the deputy mayor is the sponsor. The first release covers only three services. A change control board approves changes affecting the approved scope, budget or launch date; the project manager cannot approve these changes alone.\n\nThe team uses a hybrid approach. Integration requirements, security requirements and baseline acceptance criteria are established before implementation, while the user interface is developed in two-week iterations. The product owner orders the backlog with representatives of service users. Developers, testers, business analysts and a service-centre employee representative form the team. An external supplier provides an interface to the payment system. Launch acceptance requires all security tests to pass, an end-to-end trial for each service, staff training, and users with disabilities being able to complete an application without assistance.\n\nIn month four, a demonstration reveals that screen-reader users cannot confirm an appointment. Fixing this defect is within the agreed accessibility acceptance criterion, but the product owner proposes postponing it to improve the appearance of the dashboard. At the same time, supervisors from two service centres report staff concerns about extra work during transition. They do not attend the daily technical meeting, but can provide representatives to test workflows. A business analyst and developer repeatedly disagree on what a “complete application” means because acceptance examples have not been reviewed with service staff.\n\nThe team has recorded the risk of a late payment interface; the integration lead is its owner. The approved response is to use a simulation environment if a test release has not arrived by the end of week sixteen, while continuing supplier follow-up. That deadline passes without delivery. Separately, the sponsor requests a fourth service. The team estimates an additional SAR 180,000 and a two-week launch delay, with potential processing-time benefits for another group of applications. The change board has not yet approved this request.\n\nSix weeks before launch, a new application-data retention requirement is announced. The existing contract does not cover that duration, and the compliance team is still determining the required changes. A migration test also shows that 8% of records lack a licence number, preventing automatic validation. The transition plan proposes a one-centre pilot, user support and an explicit rollback criterion if application processing fails. After launch, the services director will collect weekly processing-time measurements, compare them with the ten-day baseline, and review the benefit at three months."
      },
      "caseTitle": {
        "ar": "دراسة حالة: بوابة الخدمات البلدية",
        "en": "Case study: Municipal services portal"
      },
      "authorship": "Original Al-Saeed practice content; not official certification material"
    }
  },
  {
    "id": "ALSAEED-PMP-CASE-SERVICE-V1-Q07",
    "domain": "process",
    "topic": "quality",
    "type": "scenario",
    "difficulty": "medium",
    "approach": "hybrid",
    "question_ar": "ما أفضل معالجة للسجلات التي تفتقد رقم الترخيص في اختبار الترحيل؟",
    "question_en": "What is the best response to migration-test records missing licence numbers?",
    "options_ar": [
      "يولد الفريق أرقامًا عشوائية حتى ينجح الاختبار",
      "يعزل السجلات المتأثرة ويحدد مصدر التصحيح مع مالك البيانات ثم يعيد التحقق قبل قبول الترحيل",
      "يعتبر نجاح 92% كافيًا دون الرجوع لمعايير القبول",
      "يحذف السجلات دون موافقة مالك البيانات"
    ],
    "options_en": [
      "Generate random numbers so the test passes",
      "Isolate affected records, agree correction with the data owner and revalidate before accepting migration",
      "Treat 92% success as sufficient without checking acceptance criteria",
      "Delete the records without the data owner’s approval"
    ],
    "correct": "B",
    "correct_json": [
      1
    ],
    "explanation_ar": "الاختبار كشف نقصًا يمنع التحقق. التصحيح بالرجوع لمصدر مسؤول وإعادة الاختبار يحافظان على سلامة البيانات؛ الاختلاق والحذف ليسا إصلاحًا مقبولًا.",
    "explanation_en": "The missing data prevents validation. Accountable source correction and retesting preserve data integrity; inventing or deleting data is not a valid fix.",
    "meta": {
      "sharedCaseId": "ALSAEED-PMP-CASE-SERVICE-V1",
      "casePosition": 7,
      "scenarioText": {
        "ar": "تطلق بلدية «الواحة» مشروع بوابة موحدة لطلبات تصاريح الأنشطة وحجز مواعيد التفتيش. مدة المشروع تسعة أشهر وميزانيته المعتمدة 2.4 مليون ريال. الهدف ليس مجرد نشر موقع، بل خفض متوسط معالجة الطلب من عشرة أيام عمل إلى ستة خلال ثلاثة أشهر من الإطلاق. مدير الخدمات هو مالك الفائدة، والراعي هو نائب رئيس البلدية. تشمل المرحلة الأولى ثلاث خدمات فقط. تعتمد لجنة ضبط التغيير أي تعديل يمس النطاق المعتمد أو الميزانية أو موعد الإطلاق؛ ولا يملك مدير المشروع اعتماد هذه التعديلات منفردًا.\n\nاختار الفريق نهجًا مختلطًا. متطلبات التكامل والأمن ومعايير القبول الأساسية تُحدد قبل التنفيذ، بينما تُطوّر واجهة المستخدم في تكرارات مدتها أسبوعان. ترتب مالكة المنتج قائمة العمل بالتعاون مع ممثلي المستفيدين. يضم الفريق مطورين ومختبرين ومحللي أعمال وممثلة عن موظفي مراكز الخدمة. يشارك مورد خارجي في واجهة التكامل مع نظام السداد. تتطلب معايير إطلاق الخدمة نجاح جميع اختبارات الأمن، وإتمام تجربة شاملة لكل خدمة، وتدريب الموظفين، وقدرة مستخدمين من ذوي الإعاقة على إتمام الطلب دون مساعدة.\n\nفي الشهر الرابع، كشف العرض التجريبي أن مستخدمي قارئ الشاشة لا يستطيعون تأكيد الموعد. الإصلاح داخل نطاق معيار الإتاحة المتفق عليه، لكن مالكة المنتج اقترحت تأجيله من أجل تحسين شكل لوحة المتابعة. وفي الوقت نفسه، أبلغ مشرفا مركزين عن قلق الموظفين من زيادة العمل أثناء الانتقال. لا يحضران الاجتماع التقني اليومي، لكنهما يستطيعان توفير ممثلين لاختبار إجراءات العمل. دخل محلل الأعمال والمطور في خلاف متكرر حول معنى «طلب مكتمل» لأن أمثلة القبول لم تُراجع مع موظفي الخدمة.\n\nسجل الفريق احتمال تأخر واجهة السداد؛ مالك الخطر هو مسؤول التكامل. تتضمن الاستجابة المعتمدة استخدام بيئة محاكاة إذا لم يصل إصدار الاختبار بنهاية الأسبوع السادس عشر، مع استمرار متابعة المورد. وصل هذا الموعد دون تسليم الإصدار. وفي اجتماع آخر طلب الراعي إضافة خدمة رابعة؛ قدر الفريق أنها ستزيد التكلفة 180 ألف ريال وتؤخر الإطلاق أسبوعين، وقد تُقلل زمن معالجة مجموعة إضافية من الطلبات. لم تعتمد لجنة التغيير هذا الطلب بعد.\n\nقبل الإطلاق بستة أسابيع، أُعلن ضابط جديد للاحتفاظ ببيانات الطلبات. نص العقد القائم لا يغطي هذه المدة، ولا يزال فريق الامتثال يحدد ما يلزم تغييره. أظهر اختبار ترحيل البيانات أن 8% من السجلات تفتقد رقم الترخيص؛ ولا يستطيع الفريق التحقق من صحتها تلقائيًا. تقترح خطة الانتقال تشغيلًا تجريبيًا في مركز واحد، ودعمًا للمستخدمين، ومعيارًا واضحًا للرجوع إلى النظام السابق عند فشل معالجة الطلبات. وبعد الإطلاق، سيجمع مدير الخدمات زمن المعالجة أسبوعيًا ويقارنه بخط الأساس البالغ عشرة أيام، مع مراجعة الفائدة بعد ثلاثة أشهر.",
        "en": "Waha Municipality is launching one portal for business-permit applications and inspection appointments. The approved project lasts nine months and has a budget of SAR 2.4 million. Its objective is not simply to publish a website: average application processing time should fall from ten working days to six within three months of launch. The services director owns this benefit, and the deputy mayor is the sponsor. The first release covers only three services. A change control board approves changes affecting the approved scope, budget or launch date; the project manager cannot approve these changes alone.\n\nThe team uses a hybrid approach. Integration requirements, security requirements and baseline acceptance criteria are established before implementation, while the user interface is developed in two-week iterations. The product owner orders the backlog with representatives of service users. Developers, testers, business analysts and a service-centre employee representative form the team. An external supplier provides an interface to the payment system. Launch acceptance requires all security tests to pass, an end-to-end trial for each service, staff training, and users with disabilities being able to complete an application without assistance.\n\nIn month four, a demonstration reveals that screen-reader users cannot confirm an appointment. Fixing this defect is within the agreed accessibility acceptance criterion, but the product owner proposes postponing it to improve the appearance of the dashboard. At the same time, supervisors from two service centres report staff concerns about extra work during transition. They do not attend the daily technical meeting, but can provide representatives to test workflows. A business analyst and developer repeatedly disagree on what a “complete application” means because acceptance examples have not been reviewed with service staff.\n\nThe team has recorded the risk of a late payment interface; the integration lead is its owner. The approved response is to use a simulation environment if a test release has not arrived by the end of week sixteen, while continuing supplier follow-up. That deadline passes without delivery. Separately, the sponsor requests a fourth service. The team estimates an additional SAR 180,000 and a two-week launch delay, with potential processing-time benefits for another group of applications. The change board has not yet approved this request.\n\nSix weeks before launch, a new application-data retention requirement is announced. The existing contract does not cover that duration, and the compliance team is still determining the required changes. A migration test also shows that 8% of records lack a licence number, preventing automatic validation. The transition plan proposes a one-centre pilot, user support and an explicit rollback criterion if application processing fails. After launch, the services director will collect weekly processing-time measurements, compare them with the ten-day baseline, and review the benefit at three months."
      },
      "caseTitle": {
        "ar": "دراسة حالة: بوابة الخدمات البلدية",
        "en": "Case study: Municipal services portal"
      },
      "authorship": "Original Al-Saeed practice content; not official certification material"
    }
  },
  {
    "id": "ALSAEED-PMP-CASE-SERVICE-V1-Q08",
    "domain": "people",
    "topic": "resources",
    "type": "scenario",
    "difficulty": "medium",
    "approach": "hybrid",
    "question_ar": "كيف يستعد الفريق لتشغيل المركز التجريبي دون إهمال مخاوف الموظفين؟",
    "question_en": "How should the team prepare the pilot centre while addressing staff concerns?",
    "options_ar": [
      "يعتبر تسليم دليل المستخدم وحده تدريبًا كافيًا",
      "يلغي الدعم حتى يتعلم الموظفون بأنفسهم",
      "يفرض ساعات عمل إضافية بدل تقييم الاحتياجات",
      "يتفق مع الموظفين على تدريب عملي وتغطية الدعم والأدوار وقناة سريعة للملاحظات أثناء التجربة"
    ],
    "options_en": [
      "Treat delivery of a user guide alone as sufficient training",
      "Remove support so staff learn independently",
      "Mandate overtime instead of assessing needs",
      "Agree hands-on training, support coverage, roles and a rapid feedback channel with staff"
    ],
    "correct": "D",
    "correct_json": [
      3
    ],
    "explanation_ar": "الإطلاق يتطلب تدريبًا، والخطة تتضمن دعمًا وتجربة محدودة. إشراك الموظفين وتوضيح الأدوار والملاحظات يقللان احتكاك الانتقال.",
    "explanation_en": "Launch requires training and the plan includes support and a limited pilot. Staff involvement, clear roles and feedback reduce transition friction.",
    "meta": {
      "sharedCaseId": "ALSAEED-PMP-CASE-SERVICE-V1",
      "casePosition": 8,
      "scenarioText": {
        "ar": "تطلق بلدية «الواحة» مشروع بوابة موحدة لطلبات تصاريح الأنشطة وحجز مواعيد التفتيش. مدة المشروع تسعة أشهر وميزانيته المعتمدة 2.4 مليون ريال. الهدف ليس مجرد نشر موقع، بل خفض متوسط معالجة الطلب من عشرة أيام عمل إلى ستة خلال ثلاثة أشهر من الإطلاق. مدير الخدمات هو مالك الفائدة، والراعي هو نائب رئيس البلدية. تشمل المرحلة الأولى ثلاث خدمات فقط. تعتمد لجنة ضبط التغيير أي تعديل يمس النطاق المعتمد أو الميزانية أو موعد الإطلاق؛ ولا يملك مدير المشروع اعتماد هذه التعديلات منفردًا.\n\nاختار الفريق نهجًا مختلطًا. متطلبات التكامل والأمن ومعايير القبول الأساسية تُحدد قبل التنفيذ، بينما تُطوّر واجهة المستخدم في تكرارات مدتها أسبوعان. ترتب مالكة المنتج قائمة العمل بالتعاون مع ممثلي المستفيدين. يضم الفريق مطورين ومختبرين ومحللي أعمال وممثلة عن موظفي مراكز الخدمة. يشارك مورد خارجي في واجهة التكامل مع نظام السداد. تتطلب معايير إطلاق الخدمة نجاح جميع اختبارات الأمن، وإتمام تجربة شاملة لكل خدمة، وتدريب الموظفين، وقدرة مستخدمين من ذوي الإعاقة على إتمام الطلب دون مساعدة.\n\nفي الشهر الرابع، كشف العرض التجريبي أن مستخدمي قارئ الشاشة لا يستطيعون تأكيد الموعد. الإصلاح داخل نطاق معيار الإتاحة المتفق عليه، لكن مالكة المنتج اقترحت تأجيله من أجل تحسين شكل لوحة المتابعة. وفي الوقت نفسه، أبلغ مشرفا مركزين عن قلق الموظفين من زيادة العمل أثناء الانتقال. لا يحضران الاجتماع التقني اليومي، لكنهما يستطيعان توفير ممثلين لاختبار إجراءات العمل. دخل محلل الأعمال والمطور في خلاف متكرر حول معنى «طلب مكتمل» لأن أمثلة القبول لم تُراجع مع موظفي الخدمة.\n\nسجل الفريق احتمال تأخر واجهة السداد؛ مالك الخطر هو مسؤول التكامل. تتضمن الاستجابة المعتمدة استخدام بيئة محاكاة إذا لم يصل إصدار الاختبار بنهاية الأسبوع السادس عشر، مع استمرار متابعة المورد. وصل هذا الموعد دون تسليم الإصدار. وفي اجتماع آخر طلب الراعي إضافة خدمة رابعة؛ قدر الفريق أنها ستزيد التكلفة 180 ألف ريال وتؤخر الإطلاق أسبوعين، وقد تُقلل زمن معالجة مجموعة إضافية من الطلبات. لم تعتمد لجنة التغيير هذا الطلب بعد.\n\nقبل الإطلاق بستة أسابيع، أُعلن ضابط جديد للاحتفاظ ببيانات الطلبات. نص العقد القائم لا يغطي هذه المدة، ولا يزال فريق الامتثال يحدد ما يلزم تغييره. أظهر اختبار ترحيل البيانات أن 8% من السجلات تفتقد رقم الترخيص؛ ولا يستطيع الفريق التحقق من صحتها تلقائيًا. تقترح خطة الانتقال تشغيلًا تجريبيًا في مركز واحد، ودعمًا للمستخدمين، ومعيارًا واضحًا للرجوع إلى النظام السابق عند فشل معالجة الطلبات. وبعد الإطلاق، سيجمع مدير الخدمات زمن المعالجة أسبوعيًا ويقارنه بخط الأساس البالغ عشرة أيام، مع مراجعة الفائدة بعد ثلاثة أشهر.",
        "en": "Waha Municipality is launching one portal for business-permit applications and inspection appointments. The approved project lasts nine months and has a budget of SAR 2.4 million. Its objective is not simply to publish a website: average application processing time should fall from ten working days to six within three months of launch. The services director owns this benefit, and the deputy mayor is the sponsor. The first release covers only three services. A change control board approves changes affecting the approved scope, budget or launch date; the project manager cannot approve these changes alone.\n\nThe team uses a hybrid approach. Integration requirements, security requirements and baseline acceptance criteria are established before implementation, while the user interface is developed in two-week iterations. The product owner orders the backlog with representatives of service users. Developers, testers, business analysts and a service-centre employee representative form the team. An external supplier provides an interface to the payment system. Launch acceptance requires all security tests to pass, an end-to-end trial for each service, staff training, and users with disabilities being able to complete an application without assistance.\n\nIn month four, a demonstration reveals that screen-reader users cannot confirm an appointment. Fixing this defect is within the agreed accessibility acceptance criterion, but the product owner proposes postponing it to improve the appearance of the dashboard. At the same time, supervisors from two service centres report staff concerns about extra work during transition. They do not attend the daily technical meeting, but can provide representatives to test workflows. A business analyst and developer repeatedly disagree on what a “complete application” means because acceptance examples have not been reviewed with service staff.\n\nThe team has recorded the risk of a late payment interface; the integration lead is its owner. The approved response is to use a simulation environment if a test release has not arrived by the end of week sixteen, while continuing supplier follow-up. That deadline passes without delivery. Separately, the sponsor requests a fourth service. The team estimates an additional SAR 180,000 and a two-week launch delay, with potential processing-time benefits for another group of applications. The change board has not yet approved this request.\n\nSix weeks before launch, a new application-data retention requirement is announced. The existing contract does not cover that duration, and the compliance team is still determining the required changes. A migration test also shows that 8% of records lack a licence number, preventing automatic validation. The transition plan proposes a one-centre pilot, user support and an explicit rollback criterion if application processing fails. After launch, the services director will collect weekly processing-time measurements, compare them with the ten-day baseline, and review the benefit at three months."
      },
      "caseTitle": {
        "ar": "دراسة حالة: بوابة الخدمات البلدية",
        "en": "Case study: Municipal services portal"
      },
      "authorship": "Original Al-Saeed practice content; not official certification material"
    }
  },
  {
    "id": "ALSAEED-PMP-CASE-SERVICE-V1-Q09",
    "domain": "business",
    "topic": "value",
    "type": "scenario",
    "difficulty": "medium",
    "approach": "hybrid",
    "question_ar": "أي دليل يبين تحقق الفائدة المستهدفة بعد ثلاثة أشهر من الإطلاق؟",
    "question_en": "Which evidence demonstrates the intended benefit three months after launch?",
    "options_ar": [
      "عدد صفحات البوابة المنشورة فقط",
      "انخفاض متوسط معالجة الطلبات من عشرة أيام إلى ستة وفق قياسات مدير الخدمات",
      "انتهاء جميع التكرارات في موعدها فقط",
      "استهلاك كامل الميزانية المعتمدة"
    ],
    "options_en": [
      "Only the number of portal pages published",
      "Services-director measurements showing average processing time fell from ten days to six",
      "Only that all iterations finished on time",
      "Spending the entire approved budget"
    ],
    "correct": "B",
    "correct_json": [
      1
    ],
    "explanation_ar": "الهدف المحدد نتيجة تشغيلية قابلة للقياس ولها مالك وخط أساس وتاريخ مراجعة؛ نشر الصفحات والالتزام بالوقت وحدهما لا يثبتان الفائدة.",
    "explanation_en": "The objective is a measurable operational outcome with an owner, baseline and review date. Pages delivered or schedule adherence alone do not prove it.",
    "meta": {
      "sharedCaseId": "ALSAEED-PMP-CASE-SERVICE-V1",
      "casePosition": 9,
      "scenarioText": {
        "ar": "تطلق بلدية «الواحة» مشروع بوابة موحدة لطلبات تصاريح الأنشطة وحجز مواعيد التفتيش. مدة المشروع تسعة أشهر وميزانيته المعتمدة 2.4 مليون ريال. الهدف ليس مجرد نشر موقع، بل خفض متوسط معالجة الطلب من عشرة أيام عمل إلى ستة خلال ثلاثة أشهر من الإطلاق. مدير الخدمات هو مالك الفائدة، والراعي هو نائب رئيس البلدية. تشمل المرحلة الأولى ثلاث خدمات فقط. تعتمد لجنة ضبط التغيير أي تعديل يمس النطاق المعتمد أو الميزانية أو موعد الإطلاق؛ ولا يملك مدير المشروع اعتماد هذه التعديلات منفردًا.\n\nاختار الفريق نهجًا مختلطًا. متطلبات التكامل والأمن ومعايير القبول الأساسية تُحدد قبل التنفيذ، بينما تُطوّر واجهة المستخدم في تكرارات مدتها أسبوعان. ترتب مالكة المنتج قائمة العمل بالتعاون مع ممثلي المستفيدين. يضم الفريق مطورين ومختبرين ومحللي أعمال وممثلة عن موظفي مراكز الخدمة. يشارك مورد خارجي في واجهة التكامل مع نظام السداد. تتطلب معايير إطلاق الخدمة نجاح جميع اختبارات الأمن، وإتمام تجربة شاملة لكل خدمة، وتدريب الموظفين، وقدرة مستخدمين من ذوي الإعاقة على إتمام الطلب دون مساعدة.\n\nفي الشهر الرابع، كشف العرض التجريبي أن مستخدمي قارئ الشاشة لا يستطيعون تأكيد الموعد. الإصلاح داخل نطاق معيار الإتاحة المتفق عليه، لكن مالكة المنتج اقترحت تأجيله من أجل تحسين شكل لوحة المتابعة. وفي الوقت نفسه، أبلغ مشرفا مركزين عن قلق الموظفين من زيادة العمل أثناء الانتقال. لا يحضران الاجتماع التقني اليومي، لكنهما يستطيعان توفير ممثلين لاختبار إجراءات العمل. دخل محلل الأعمال والمطور في خلاف متكرر حول معنى «طلب مكتمل» لأن أمثلة القبول لم تُراجع مع موظفي الخدمة.\n\nسجل الفريق احتمال تأخر واجهة السداد؛ مالك الخطر هو مسؤول التكامل. تتضمن الاستجابة المعتمدة استخدام بيئة محاكاة إذا لم يصل إصدار الاختبار بنهاية الأسبوع السادس عشر، مع استمرار متابعة المورد. وصل هذا الموعد دون تسليم الإصدار. وفي اجتماع آخر طلب الراعي إضافة خدمة رابعة؛ قدر الفريق أنها ستزيد التكلفة 180 ألف ريال وتؤخر الإطلاق أسبوعين، وقد تُقلل زمن معالجة مجموعة إضافية من الطلبات. لم تعتمد لجنة التغيير هذا الطلب بعد.\n\nقبل الإطلاق بستة أسابيع، أُعلن ضابط جديد للاحتفاظ ببيانات الطلبات. نص العقد القائم لا يغطي هذه المدة، ولا يزال فريق الامتثال يحدد ما يلزم تغييره. أظهر اختبار ترحيل البيانات أن 8% من السجلات تفتقد رقم الترخيص؛ ولا يستطيع الفريق التحقق من صحتها تلقائيًا. تقترح خطة الانتقال تشغيلًا تجريبيًا في مركز واحد، ودعمًا للمستخدمين، ومعيارًا واضحًا للرجوع إلى النظام السابق عند فشل معالجة الطلبات. وبعد الإطلاق، سيجمع مدير الخدمات زمن المعالجة أسبوعيًا ويقارنه بخط الأساس البالغ عشرة أيام، مع مراجعة الفائدة بعد ثلاثة أشهر.",
        "en": "Waha Municipality is launching one portal for business-permit applications and inspection appointments. The approved project lasts nine months and has a budget of SAR 2.4 million. Its objective is not simply to publish a website: average application processing time should fall from ten working days to six within three months of launch. The services director owns this benefit, and the deputy mayor is the sponsor. The first release covers only three services. A change control board approves changes affecting the approved scope, budget or launch date; the project manager cannot approve these changes alone.\n\nThe team uses a hybrid approach. Integration requirements, security requirements and baseline acceptance criteria are established before implementation, while the user interface is developed in two-week iterations. The product owner orders the backlog with representatives of service users. Developers, testers, business analysts and a service-centre employee representative form the team. An external supplier provides an interface to the payment system. Launch acceptance requires all security tests to pass, an end-to-end trial for each service, staff training, and users with disabilities being able to complete an application without assistance.\n\nIn month four, a demonstration reveals that screen-reader users cannot confirm an appointment. Fixing this defect is within the agreed accessibility acceptance criterion, but the product owner proposes postponing it to improve the appearance of the dashboard. At the same time, supervisors from two service centres report staff concerns about extra work during transition. They do not attend the daily technical meeting, but can provide representatives to test workflows. A business analyst and developer repeatedly disagree on what a “complete application” means because acceptance examples have not been reviewed with service staff.\n\nThe team has recorded the risk of a late payment interface; the integration lead is its owner. The approved response is to use a simulation environment if a test release has not arrived by the end of week sixteen, while continuing supplier follow-up. That deadline passes without delivery. Separately, the sponsor requests a fourth service. The team estimates an additional SAR 180,000 and a two-week launch delay, with potential processing-time benefits for another group of applications. The change board has not yet approved this request.\n\nSix weeks before launch, a new application-data retention requirement is announced. The existing contract does not cover that duration, and the compliance team is still determining the required changes. A migration test also shows that 8% of records lack a licence number, preventing automatic validation. The transition plan proposes a one-centre pilot, user support and an explicit rollback criterion if application processing fails. After launch, the services director will collect weekly processing-time measurements, compare them with the ten-day baseline, and review the benefit at three months."
      },
      "caseTitle": {
        "ar": "دراسة حالة: بوابة الخدمات البلدية",
        "en": "Case study: Municipal services portal"
      },
      "authorship": "Original Al-Saeed practice content; not official certification material"
    }
  },
  {
    "id": "ALSAEED-PMP-CASE-SERVICE-V1-Q10",
    "domain": "business",
    "topic": "governance",
    "type": "scenario",
    "difficulty": "medium",
    "approach": "hybrid",
    "question_ar": "إذا فشلت معالجة الطلبات في المركز التجريبي وتحقق معيار الرجوع المتفق عليه، فما القرار الأنسب؟",
    "question_en": "If application processing fails in the pilot and the agreed rollback criterion is met, what is the most appropriate decision?",
    "options_ar": [
      "يطبق الفريق الرجوع المنظم ويحافظ على استمرارية الخدمة ثم يحلل سبب الفشل قبل إعادة المحاولة",
      "يوسع الإطلاق لجميع المراكز حتى لا يتأخر الجدول",
      "يخفي الفريق المشكلة حتى موعد مراجعة الفوائد",
      "يلغي مدير المشروع هدف خفض زمن المعالجة"
    ],
    "options_en": [
      "Execute controlled rollback to maintain service, then analyze the failure before retrying",
      "Expand rollout to all centres to protect the schedule",
      "Hide the issue until the benefits review",
      "Cancel the processing-time reduction objective"
    ],
    "correct": "A",
    "correct_json": [
      0
    ],
    "explanation_ar": "معيار الرجوع وُضع لحماية استمرارية الخدمة. تفعيله عند تحقق شروطه قرار منضبط، مع معالجة السبب قبل توسيع الإطلاق.",
    "explanation_en": "The rollback criterion protects service continuity. Triggering it is a controlled decision, followed by root-cause correction before expanding rollout.",
    "meta": {
      "sharedCaseId": "ALSAEED-PMP-CASE-SERVICE-V1",
      "casePosition": 10,
      "scenarioText": {
        "ar": "تطلق بلدية «الواحة» مشروع بوابة موحدة لطلبات تصاريح الأنشطة وحجز مواعيد التفتيش. مدة المشروع تسعة أشهر وميزانيته المعتمدة 2.4 مليون ريال. الهدف ليس مجرد نشر موقع، بل خفض متوسط معالجة الطلب من عشرة أيام عمل إلى ستة خلال ثلاثة أشهر من الإطلاق. مدير الخدمات هو مالك الفائدة، والراعي هو نائب رئيس البلدية. تشمل المرحلة الأولى ثلاث خدمات فقط. تعتمد لجنة ضبط التغيير أي تعديل يمس النطاق المعتمد أو الميزانية أو موعد الإطلاق؛ ولا يملك مدير المشروع اعتماد هذه التعديلات منفردًا.\n\nاختار الفريق نهجًا مختلطًا. متطلبات التكامل والأمن ومعايير القبول الأساسية تُحدد قبل التنفيذ، بينما تُطوّر واجهة المستخدم في تكرارات مدتها أسبوعان. ترتب مالكة المنتج قائمة العمل بالتعاون مع ممثلي المستفيدين. يضم الفريق مطورين ومختبرين ومحللي أعمال وممثلة عن موظفي مراكز الخدمة. يشارك مورد خارجي في واجهة التكامل مع نظام السداد. تتطلب معايير إطلاق الخدمة نجاح جميع اختبارات الأمن، وإتمام تجربة شاملة لكل خدمة، وتدريب الموظفين، وقدرة مستخدمين من ذوي الإعاقة على إتمام الطلب دون مساعدة.\n\nفي الشهر الرابع، كشف العرض التجريبي أن مستخدمي قارئ الشاشة لا يستطيعون تأكيد الموعد. الإصلاح داخل نطاق معيار الإتاحة المتفق عليه، لكن مالكة المنتج اقترحت تأجيله من أجل تحسين شكل لوحة المتابعة. وفي الوقت نفسه، أبلغ مشرفا مركزين عن قلق الموظفين من زيادة العمل أثناء الانتقال. لا يحضران الاجتماع التقني اليومي، لكنهما يستطيعان توفير ممثلين لاختبار إجراءات العمل. دخل محلل الأعمال والمطور في خلاف متكرر حول معنى «طلب مكتمل» لأن أمثلة القبول لم تُراجع مع موظفي الخدمة.\n\nسجل الفريق احتمال تأخر واجهة السداد؛ مالك الخطر هو مسؤول التكامل. تتضمن الاستجابة المعتمدة استخدام بيئة محاكاة إذا لم يصل إصدار الاختبار بنهاية الأسبوع السادس عشر، مع استمرار متابعة المورد. وصل هذا الموعد دون تسليم الإصدار. وفي اجتماع آخر طلب الراعي إضافة خدمة رابعة؛ قدر الفريق أنها ستزيد التكلفة 180 ألف ريال وتؤخر الإطلاق أسبوعين، وقد تُقلل زمن معالجة مجموعة إضافية من الطلبات. لم تعتمد لجنة التغيير هذا الطلب بعد.\n\nقبل الإطلاق بستة أسابيع، أُعلن ضابط جديد للاحتفاظ ببيانات الطلبات. نص العقد القائم لا يغطي هذه المدة، ولا يزال فريق الامتثال يحدد ما يلزم تغييره. أظهر اختبار ترحيل البيانات أن 8% من السجلات تفتقد رقم الترخيص؛ ولا يستطيع الفريق التحقق من صحتها تلقائيًا. تقترح خطة الانتقال تشغيلًا تجريبيًا في مركز واحد، ودعمًا للمستخدمين، ومعيارًا واضحًا للرجوع إلى النظام السابق عند فشل معالجة الطلبات. وبعد الإطلاق، سيجمع مدير الخدمات زمن المعالجة أسبوعيًا ويقارنه بخط الأساس البالغ عشرة أيام، مع مراجعة الفائدة بعد ثلاثة أشهر.",
        "en": "Waha Municipality is launching one portal for business-permit applications and inspection appointments. The approved project lasts nine months and has a budget of SAR 2.4 million. Its objective is not simply to publish a website: average application processing time should fall from ten working days to six within three months of launch. The services director owns this benefit, and the deputy mayor is the sponsor. The first release covers only three services. A change control board approves changes affecting the approved scope, budget or launch date; the project manager cannot approve these changes alone.\n\nThe team uses a hybrid approach. Integration requirements, security requirements and baseline acceptance criteria are established before implementation, while the user interface is developed in two-week iterations. The product owner orders the backlog with representatives of service users. Developers, testers, business analysts and a service-centre employee representative form the team. An external supplier provides an interface to the payment system. Launch acceptance requires all security tests to pass, an end-to-end trial for each service, staff training, and users with disabilities being able to complete an application without assistance.\n\nIn month four, a demonstration reveals that screen-reader users cannot confirm an appointment. Fixing this defect is within the agreed accessibility acceptance criterion, but the product owner proposes postponing it to improve the appearance of the dashboard. At the same time, supervisors from two service centres report staff concerns about extra work during transition. They do not attend the daily technical meeting, but can provide representatives to test workflows. A business analyst and developer repeatedly disagree on what a “complete application” means because acceptance examples have not been reviewed with service staff.\n\nThe team has recorded the risk of a late payment interface; the integration lead is its owner. The approved response is to use a simulation environment if a test release has not arrived by the end of week sixteen, while continuing supplier follow-up. That deadline passes without delivery. Separately, the sponsor requests a fourth service. The team estimates an additional SAR 180,000 and a two-week launch delay, with potential processing-time benefits for another group of applications. The change board has not yet approved this request.\n\nSix weeks before launch, a new application-data retention requirement is announced. The existing contract does not cover that duration, and the compliance team is still determining the required changes. A migration test also shows that 8% of records lack a licence number, preventing automatic validation. The transition plan proposes a one-centre pilot, user support and an explicit rollback criterion if application processing fails. After launch, the services director will collect weekly processing-time measurements, compare them with the ten-day baseline, and review the benefit at three months."
      },
      "caseTitle": {
        "ar": "دراسة حالة: بوابة الخدمات البلدية",
        "en": "Case study: Municipal services portal"
      },
      "authorship": "Original Al-Saeed practice content; not official certification material"
    }
  }
];
const targets=Object.freeze({people:59,process:74,business:47});
const domain=q=>({e:'people',r:'process',b:'business','business environment':'business'}[String(q.domain).toLowerCase()]||String(q.domain).toLowerCase());
function questions(){return JSON.parse(JSON.stringify(QUESTIONS))}
function shuffle(rows){const a=[...rows];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function build(bank){
 const rows=questions(),used=new Set(rows.map(q=>q.id)),extras=[];
 // A detached fragment from another shared scenario must not enter the independent section.
 const eligible=bank.filter(q=>targets[domain(q)]&&!q.meta?.sharedCaseId&&!q.meta?.sourceV5?.scn);
 const remaining=d=>targets[d]-rows.filter(q=>domain(q)===d).length-extras.filter(q=>domain(q)===d).length;
 const add=q=>{extras.push(q);used.add(q.id)};
 // Retain the available interactive question formats without changing domain quotas.
 const format=q=>q.meta?.sourceV5?.t||q.type||'single';
 for(const type of new Set(eligible.map(format))){const q=shuffle(eligible).find(q=>format(q)===type&&!used.has(q.id)&&remaining(domain(q))>0);if(q)add(q)}
 for(const d of Object.keys(targets)){
  for(const q of shuffle(eligible.filter(q=>domain(q)===d))){if(remaining(d)===0)break;if(!used.has(q.id))add(q)}
  if(remaining(d)!==0)return [];
 }
 return [...rows,...shuffle(extras)];
}

root.PmpSharedCase=Object.freeze({case:CASE,questions,build,targets});
})(globalThis);
