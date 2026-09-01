# Change Log — V8

## Visual / UX
- إعادة تصميم Hero مع Media Stage ديناميكي.
- دعم Vimeo في Hero مع fallback بصري متحرك.
- Course Showcase جديد بأغلفة ديناميكية.
- Quick Preview لكل دورة.
- صفحة Course Landing جديدة بالكامل.
- تحسين بطاقات الباقات وإضافة visual header.
- شعار جديد Vector داخل الموقع + ملف SVG مستقل.
- تثبيت navigation وتحسين responsive behavior.
- ترجمة عناصر القائمة الأساسية حسب اللغة المختارة.

## Admin
- Dashboard Overview حقيقي.
- Endpoint جديد `/api/admin/overview`.
- Endpoint جديد `/api/admin/users/:id/activity`.
- متابعة تقدم كل طالب وآخر نشاط ومتوسط الاختبارات والانتهاء.
- Student detail modal.
- Student CSV export.
- إضافة المستخدم ومنح الباقة وحذف المستخدم وحفظ Vimeo أصبحت Backend operations عند تشغيل الخادم.
- Course editor يدعم Cover URL وVimeo Preview ID.
- CMS يدعم Hero Vimeo وHero Poster.

## Security
- إزالة ملف `.env` الحساس من الحزمة المعادة.
- إزالة حسابات Demo وكلمات المرور من الواجهة/localStorage.
- لا يوجد Admin افتراضي hard-coded.
- كلمة المرور 10 أحرف على الأقل.
- bcrypt cost 12 للحسابات الجديدة وتغيير كلمة المرور.
