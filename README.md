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
