# Al-Saeed Platform V15

Interactive e-learning platform for seven professional certification programs.

## Catalog

- Bilingual: PMP, PMI-RMP, PMI-ACP, GRCP
- English: P3O, PMI-PBA, Lean Six Sigma
- Four consistent package types: Complete, Simulation Exams, Final Review, Self-Paced Study

## Included capabilities

- Express + SQLite backend
- Student and admin accounts
- Package CRUD and independent systems/tools CRUD
- Vimeo lessons, short knowledge checks, mixed question types and full exam banks
- Downloadable guides, study plans and flash cards
- Activities and management decision games
- Server-validated promo codes and payment creation
- Complete-package-only attendance certificates with public verification

## Run

```bash
cp .env.example .env
npm install
npm start
```

Open `http://localhost:3000`. Configure the first admin through `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`.
# تذكيرات الدراسة بالبريد

تظهر للمتدرب في لوحته إمكانية الاشتراك الاختياري في التذكيرات بعد إعداد
`RESEND_API_KEY` و`REMINDER_FROM` في متغيرات بيئة الخادم. يجب أن يكون نطاق عنوان
`REMINDER_FROM` موثقًا لدى خدمة البريد. مثال: `Alsaeed <reminders@your-domain.com>`.
يُرسل تذكير فقط للمتدرب المشترك الذي لم يكمل فيديوهاته وتوقف عن الدراسة مدة
1 أو 3 أو 7 أيام وفق اختياره، وبحد أقصى رسالة واحدة كل سبعة أيام. يمكنه إيقاف
التذكيرات من لوحته. إذا لم تُضبط المتغيرات، تظهر الميزة غير مفعّلة ولا تُرسل رسائل.

## عروض المؤسسات والدفع المباشر

- يُحفظ طلب المؤسسة ورابط متابعته الخاص في قاعدة البيانات. تحتاج رسائل تأكيد الطلب
  وإرسال العرض إلى `RESEND_API_KEY` و`REMINDER_FROM` ونطاق بريد موثق. يُستخدم
  `CORPORATE_NOTIFY_EMAIL` لإشعار المسؤول، أو `ADMIN_EMAIL` عند غيابه. يظهر وضع
  الجاهزية في لوحة إدارة العروض، ويبقى الطلب محفوظًا إن تعذر إرسال الرسالة.
- تفعيل `OPENAI_API_KEY` اختياري لتلخيص الطلب ورد العميل للإدارة. لا يحدد النموذج
  السعر أو الضريبة ولا يرسل عرضًا نهائيًا دون اعتماد المشرف.
- لتفعيل جلسات Kashier الرسمية اضبط `KASHIER_MERCHANT_ID` و
  `KASHIER_PAYMENT_API_KEY` و`KASHIER_SECRET_KEY` بمفاتيح الإنتاج، و
  `KASHIER_MODE=live`، ثم سجل webhook بوضع live وأحداث `pay` على
  `https://al-ltc.com/api/pay/kashier/webhook`. يستمر مسار الدفع القديم إن لم
  تضبط `KASHIER_SECRET_KEY`. يُتحقق من توقيع الحدث ومبلغ الطلب وعملته قبل
  تفعيل الوصول؛ ويلزم إجراء عملية شراء حقيقية صغيرة ثم مراجعة الفاتورة والتسوية
  للتأكد من تفعيل حساب التاجر ومطابقة إعدادات البوابة.

## Manual enrollment and offline-payment invoices

Administrative enrollment (including bulk grants) grants learning access only. It
never creates a payment or invoice. In Content Admin → Invoices, the separate
manual-invoice action requires the active owner account matching ADMIN_EMAIL,
an existing active learner enrollment, the actual received amount and currency,
receipt date, payment method, and two explicit confirmations: payment received
and invoice issuance approved. A reference is optional for cash only.

The server atomically saves the paid manual order, invoice and approval audit in
manual_invoice_approvals; it does not change learning access or past records.
Identical retries return the same invoice. Existing invoices (including pending
checkout drafts) or prior paid orders block a second manual invoice for the same
learner/package and require accounting review, not automatic replacement.
Gateway-confirmed purchases automatically issue invoices without owner approval,
even if the learner already had administrative access before paying. Only the
separate offline/manual payment action requires owner approval. No manual-origin
classification, gateway invoice hold, or historical backfill is introduced. Learners can
list pending checkout drafts but cannot render them as issued invoice documents.
No email delivery is added. The owner check uses the existing administrative
account-security model; it does not redesign other administrators' privileges.

Focused local tests (synthetic in-memory data only):
- node --test tests/manual-invoices.mjs
- node --test tests/manual-invoice-ui.mjs (requires jsdom as a test-only tool)
- node tests/runtime-packaging.mjs
- node tests/production-image.mjs
