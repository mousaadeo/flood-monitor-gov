# مصادر البطء المكتشفة

## 1. FloodWaterLayer._renderDynamicGrid (الأكبر تأثيراً)
- عند zoom 16: stepLat=0.0006 → ~5500 نقطة في الـ viewport
- كل نقطة: isInsideAbuDhabi() + getUrbanDensity() + createRadialGradient() = ~15 عملية
- **إجمالي: ~82,500 عملية canvas لكل frame عند zoom عالي**
- يُعاد الرسم عند كل zoomend + moveend + precipMultiplier change

## 2. loadRoadTier (بطء عند zoom in)
- يجلب JSON كبير من CDN عند كل مستوى zoom جديد
- tier4 (zoom 14+): آلاف الطرق، كل طريق له tooltip HTML معقد
- لا يوجد debounce على zoomend → يُطلق عند كل خطوة zoom

## 3. Re-renders في React
- `data.regions` (90 منطقة) يُعيد رسم كل الـ markers عند كل تحديث بيانات
- useEffect([data]) يُشغّل forEach على 90 منطقة مع L.polygon + L.circle لكل منطقة

## 4. Backend API calls
- كل 15 دقيقة: 90 طلب Open-Meteo + 5 طلبات GloFAS
- لا يوجد HTTP caching headers → المتصفح يُعيد الجلب دائماً
