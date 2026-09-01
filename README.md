# AL-LTC Platform V8

منصة السعيد للتعليم والتدريب والاستشارات والأنظمة الذكية.

## المكونات
- Express + SQLite backend
- حسابات وصلاحيات Admin/Student
- اشتراكات وانتهاء وصول
- Vimeo lessons
- CMS للواجهة الرئيسية
- Courses / Packages
- Exam & Progress tracking
- Certificates + public verification
- Admin CRM dashboard
- GRC Applied System

## التشغيل
```bash
cp .env.example .env
npm install
npm start
```

## Admin
لا يوجد Admin افتراضي. يتم إنشاء أول مشرف فقط من `ADMIN_EMAIL` و`ADMIN_PASSWORD` في `.env`، وكلمة المرور يجب أن تكون 10 أحرف على الأقل.

## Admin analytics
- `GET /api/admin/overview`
- `GET /api/admin/users/:id/activity`

تستخدم الواجهة هذه المسارات لعرض التقدم، آخر نشاط، متوسط الاختبارات، الاشتراكات والانتهاء.

## Vimeo
من لوحة الإدارة يمكنك وضع Vimeo ID للدروس، وكذلك Vimeo Preview للدورة، وفيديو Hero للصفحة الرئيسية.

## Domain
النطاق المستهدف: `https://al-ltc.com`

## Production checklist
1. Configure `.env`.
2. Use HTTPS.
3. Test the payment gateway in sandbox.
4. Use a persistent database volume or migrate to Postgres/Supabase before scale.
5. Configure backups and transactional email.
