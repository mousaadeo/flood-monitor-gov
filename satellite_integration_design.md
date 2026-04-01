# تصميم تكامل بيانات الأقمار الصناعية (Sentinel-1 SAR & Copernicus CEMS)

## 1. الهدف
إضافة قدرة للنظام لجلب وعرض صور الأقمار الصناعية الرادارية (SAR) وخرائط الفيضانات من Copernicus CEMS، مع توفير واجهة للمستخدم لإدخال مفاتيح الاشتراك (API Keys) الخاصة به للوصول إلى هذه البيانات المدفوعة أو المقيدة.

## 2. بنية التكامل (Architecture)

### 2.1. الواجهة الأمامية (Frontend)
- **نافذة إعدادات الأقمار الصناعية (Satellite Settings Modal):**
  - حقل لإدخال `Sentinel Hub Client ID`
  - حقل لإدخال `Sentinel Hub Client Secret`
  - زر لحفظ الإعدادات في `localStorage` أو إرسالها للخادم (سنستخدم `localStorage` لسهولة الاستخدام بدون قاعدة بيانات معقدة للمستخدمين، أو إرسالها مع كل طلب API).
- **عرض الصور (Satellite View):**
  - إضافة طبقة (Layer) جديدة في خريطة `Unified Map Center` لعرض صور SAR.
  - إضافة قسم في لوحة التحكم الجانبية لطلب صورة حديثة للمنطقة المحددة.

### 2.2. الواجهة الخلفية (Backend)
- **خدمة `satelliteService.ts`:**
  - نقطة نهاية (Endpoint) لاستقبال طلب جلب صورة قمر صناعي مع تمرير إحداثيات المنطقة (BBox) ومفاتيح الـ API.
  - دالة للتواصل مع **Sentinel Hub API**:
    1. الحصول على OAuth Token باستخدام Client ID & Secret.
    2. طلب صورة Sentinel-1 GRD (SAR) للمنطقة المحددة وتاريخ اليوم/الأمس.
    3. إرجاع رابط الصورة أو بياناتها (Base64) للواجهة الأمامية.

## 3. تدفق العمل (Workflow)
1. يفتح المستخدم إعدادات الأقمار الصناعية ويدخل مفاتيح Sentinel Hub.
2. يذهب المستخدم إلى خريطة منطقة معينة (مثلاً: الشامخة).
3. يضغط على زر "جلب صورة SAR حديثة".
4. يرسل الـ Frontend طلب tRPC أو REST إلى الـ Backend مع الإحداثيات ومفاتيح الـ API.
5. يقوم الـ Backend بجلب الصورة من Sentinel Hub وإعادتها.
6. يتم عرض الصورة كطبقة فوق الخريطة (ImageOverlay في Leaflet).

## 4. واجهات برمجة التطبيقات المستخدمة (APIs)
- **Sentinel Hub API:**
  - `https://services.sentinel-hub.com/oauth/token` (للمصادقة)
  - `https://services.sentinel-hub.com/api/v1/process` (لجلب الصور باستخدام Evalscript مخصص لـ SAR)
