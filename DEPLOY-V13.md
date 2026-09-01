# AL-LTC V13 — Railway Deployment

هذا الفرع مخصص لنشر V13 بدون التأثير على `main`.

## المطلوب مرة واحدة فقط
ارفع الملف التالي إلى جذر هذا الفرع بنفس الاسم تماماً:

`AlSaeed-Platform-V13.zip`

بعدها Railway سيستخدم `Dockerfile` لفك الملف تلقائياً، العثور على مجلد `server`، تثبيت الحزم وتشغيل `server.js`.

## Railway Variables

```env
PORT=3000
NODE_ENV=production
SITE_URL=https://al-ltc.com
JWT_SECRET=<long-random-secret>
DB_PATH=/data/alsaeed.db
ADMIN_EMAIL=<your-admin-email>
ADMIN_PASSWORD=<strong-password-10+-chars>
ADMIN_PANEL_PATH=<private-admin-path>
```

أضف مفاتيح الدفع فقط بعد نجاح التشغيل التجريبي.

## Persistent Volume
أضف Railway Volume على:

`/data`

لمنع فقد قاعدة بيانات SQLite بعد إعادة النشر.

## النشر الآمن
1. Deploy من branch: `v13-production`
2. اختبر رابط Railway المؤقت.
3. اختبر تسجيل الدخول والإدارة وإضافة متدرب وفيديو.
4. بعد نجاح الاختبارات فقط اربط `al-ltc.com`.
