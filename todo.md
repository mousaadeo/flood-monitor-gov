
# Project TODO

- [x] رسومات توضيحية لتجمعات المياه على الخريطة بتدرج اللون حسب العمق
- [x] حجم الشكل يعكس حجم التجمع (مساحة/حجم المياه)
- [x] تأثير توهج (glow) للمناطق العميقة
- [x] تحديث تلقائي للرسومات مع تغير البيانات
- [x] إصلاح مشكلة عدم ظهور FloodWaterLayer على الخريطة (overlayPane أبعاده صفر)
- [x] إضافة SVG مباشرة لـ leaflet-container بدل overlayPane
- [x] استخدام latLngToContainerPoint للإحداثيات الصحيحة
- [x] إضافة mapReady state لضمان تهيئة الخريطة قبل إنشاء الطبقة
- [x] تسميات حجم التجمع (م³) عند zoom ≥ 12
- [x] حلقات ripple للمناطق الحرجة (>80 سم)
- [x] 4 مستويات تكبير تكيفية (L1-L4)

## تطوير جذري لصفحة DEM

- [x] إعادة بناء صفحة DEMPage بالكامل مع 4 أوضاع عرض (ارتفاع/انحدار/خطر/تدفق)
- [x] تحليل الانحدار (Slope Analysis) مع تلوين حسب درجة الانحدار
- [x] مسارات تدفق المياه (Flow Direction) مع خطوط متحركة
- [x] تحليل الأحواض المائية (Watershed Delineation)
- [x] مقطع عرضي تفاعلي (Cross-section Profile)
- [x] لوحة إحصاءات متقدمة مع مقارنة بين المناطق
- [x] hillshading تأثير الإضاءة الطبوغرافية

## إعادة تصميم الملخص التنفيذي للقيادة العليا

- [x] إضافة بطاقة الإحاطة التنفيذية في لوحة التحكم الرئيسية (بعد KPI cards مباشرة)
- [x] البطاقة تعرض: مؤشر الخطر الكبير + هطول 24 ساعة + إنذارات نشطة + المنطقة الأعلى خطراً + توصية فورية
- [x] البطاقة قابلة للنقر للانتقال لصفحة التقارير
- [x] إضافة وضع القيادة (Executive View) في صفحة التقارير
- [x] التخطيط الهرمي: TIER 1 (إجراء فوري) → TIER 2 (3 أرقام بارزة) → TIER 3 (وضع راهن + رؤى)
- [x] زر التبديل بين وضع القيادة ووضع المحلل
- [x] الصفحة تبدأ بوضع القيادة افتراضياً
- [x] شريط ملوّن في الأعلى يعكس مستوى الخطر
- [x] وقت القراءة ≤30 ثانية في وضع القيادة
- [x] زر نسخ الإحاطة التنفيذية

## إصلاح مشكلة الأصفار في البيانات الحية

- [x] تشخيص سبب عرض 0 في مؤشر الخطر والهطول والإنذارات
- [x] إصلاح منطق جلب البيانات من Open-Meteo (timeout / fallback)
- [x] إضافة آلية fallback ذكية: استخدام آخر بيانات صالحة عند فشل الجلب
- [x] عرض مؤشر "آخر تحديث ناجح" بدلاً من الأصفار عند غياب البيانات
- [x] التحقق من صحة حسابات مؤشر الخطر (floodRiskIndex) عند هطول = 0

## إعادة تصميم وضع القيادة — نقاط مختصرة + تفاصيل قابلة للنقر

- [x] تحويل فقرات "الوضع الراهن" و"الرؤى والمخاطر" إلى نقاط مختصرة (bullet points)
- [x] كل رقم/مؤشر قابل للنقر يفتح popup بتفاصيل المنطقة أو المقياس
- [x] التوصيات تُعرض كنقاط مرقمة قصيرة (سطر واحد لكل توصية)
- [x] إضافة tooltip سريع عند hover على أي رقم
- [x] تبسيط شريط الإجراء الفوري: أيقونة + نص قصير فقط

## مراجعة شاملة للنظام — Audit & Quality Review

- [x] فحص جميع الصفحات وتوثيق المشكلات
- [x] توحيد مصدر البيانات (Single Source of Truth)
- [x] إزالة التناقضات في الأرقام بين الصفحات
- [x] إضافة Tooltips شاملة لكل عنصر في النظام
- [x] محاذاة رحلة المستخدم: 3 مستويات (قيادي/إداري/تشغيلي)
- [x] تقرير المراجعة الشامل (Audit Report)

## إصلاح جذري لمشكلة الأصفار في الموقع المنشور

- [x] تشخيص سبب فشل إصلاح timezone في الموقع المنشور
- [x] إصلاح جذري: استبدال Intl.DateTimeFormat بـ UTC arithmetic في 4 مواضع
- [x] التحقق من البيانات في الموقع المنشور بعد الإصلاح

## نقل جلب البيانات للخادم (Server-side)
- [x] إنشاء tRPC procedure لجلب بيانات الطقس من Open-Meteo (server-side)
- [x] إضافة caching بسيط (5 دقائق) لتقليل استدعاءات API
- [x] تحديث useRealWeather hook لاستخدام tRPC بدلاً من client-side fetch
- [x] التحقق من البيانات في الموقع المنشور

## تصحيح لغوي شامل — مسميات المناطق والترجمة للإنجليزية
- [x] إصلاح App.tsx لاستخدام useLanguage مباشرة بدلاً من قراءة document.dir
- [x] إصلاح html direction من RTL ثابت إلى LTR افتراضي مع RTL ديناميكي
- [x] إصلاح TopBar.tsx لدعم كلا الاتجاهين (brand block يتحرك حسب اللغة)
- [x] إصلاح Sidebar.tsx - إضافة الترجمات العربية الصحيحة لجميع عناصر القائمة
- [x] إصلاح Dashboard.tsx - تطبيق t() على جميع النصوص
- [x] إضافة مفاتيح ترجمة جديدة في LanguageContext (dashboard.*, nav.*, common.*)
- [x] إصلاح badge التنبيهات في Sidebar - ربطه بالبيانات الحية من Open-Meteo بدلاً من mockData
- [ ] ترجمة DataModeSwitcher.tsx للعربية
- [ ] ترجمة MetricTooltip registry بالكامل للإنجليزية
- [ ] ترجمة صفحات الخريطة (RoadNetworkPage, UnifiedMapPage) للعربية

## الفهرس التعريفي ونظام التوضيح الشامل
- [x] بناء مكون ExplainerTooltip شامل (يشرح المؤشر + طريقة الاحتساب + العتبات + المصدر)
- [x] تطبيق ExplainerTooltip على KPI cards الأربعة في Dashboard
- [x] بناء صفحة الفهرس التعريفي الكاملة /glossary (16 مؤشر في 4 فئات)
- [x] ربط صفحة الفهرس بالقائمة الجانبية (قسم دعم القرار)
- [x] دعم اللغتين في الفهرس (عربي/إنجليزي)
- [ ] تطبيق ExplainerTooltip على مؤشر الخطر في region cards
- [ ] تطبيق ExplainerTooltip على مؤشر الخطر في TopBar

## إصلاح اختفاء التضليل عند zoom عالي (L3/L4)
- [x] إصلاح اختفاء التضليل عند zoom عالي — Al Manaseer وجزيرة أبوظبي الداخلية
- [x] إضافة نقاط L3/L4 لمنطقة Al Manaseer وجزيرة أبوظبي
- [x] إصلاح منطق التصفية في FloodWaterLayer لضمان ظهور النقاط القريبة دائماً

## مواءمة الترجمة وتنفيذ المقترحات
- [x] ترجمة NavTooltip للعربية الكاملة (العنوان، الملخص، الأهداف، المستخدمون، المصدر) لجميع 15 صفحة
- [x] إصلاح sublabel في Executive Briefing ليعرض اسم المنطقة بالعربية/الإنجليزية حسب اللغة
- [x] تطبيق ExplainerTooltip على مؤشر الخطر في region cards
- [x] إضافة زر "الفهرس التعريفي" في ExplainerTooltip يربط بصفحة /glossary
- [x] إضافة ExplainerTooltip على مؤشر الخطر في TopBar ticker

## رصد التجمعات المائية الدقيقة — تغطية شاملة
- [x] بناء waterAccumulationEngine.ts — محرك هجين (ERA5 + GloFAS + DEM) لكل منطقة
- [x] دمج GloFAS Flood API (river discharge) لرصد جريان الأودية بدقة 5 كم
- [x] خوارزمية DEM تحسب قابلية التجمع بناءً على الانخفاض + نوع التربة + كثافة الصرف
- [x] تحديث weatherService لإضافة waterAccumulation + accumulationSummary لكل منطقة
- [x] إضافة طبقة تجمعات المياه الحية على الخريطة (دوائر ملونة حسب المستوى + popup تفصيلي)
- [x] إضافة KPI card جديد لمناطق التجمع المائي في Dashboard
- [x] تحديث useRealWeather.ts لنقل accumulationSummary للـ client
- [x] تحسين دقة الرصد لمناطق الشامخة والرياض والمناطق الصغيرة (DEM topography)

## منهجية موحدة لعرض تجمعات المياه
- [ ] بناء waterStandard.ts — ملف مرجعي موحد (ألوان + عتبات + رموز + وصف)
- [ ] تحديث طبقة الخريطة لاستخدام المنهجية الموحدة
- [ ] تحديث Legend (مفتاح الألوان) في الخريطة
- [ ] تحديث Dashboard KPI card وregion cards لنفس الألوان والرموز
- [ ] توحيد popup التفصيلي عبر جميع الصفحات

## تحسين المظهر البصري للخريطة — صورة جوية واقعية
- [x] إزالة التوهج الكبير (pulsing outer ring + high fillOpacity)
- [x] تفعيل Esri World Imagery كطبقة افتراضية (Satellite)
- [x] تعديل دوائر التجمعات لتبدو كبقع مائية دقيقة بدون توهج
- [x] تحسين شفافية الطبقة لتظهر كصورة جوية من هليكوبتر

## مطابقة نمط FastFlood للمسطحات المائية
- [x] تحديث waterStandard.ts — ألوان أزرق متدرج فقط (0.1م → 5م)
- [x] إعادة بناء FloodWaterLayer — SVG blobs شفافة زرقاء بدون دوائر أو حدود
- [x] تحديث WaterLegend لمطابقة مقياس FastFlood (gradient bar + 0م، 0.1م، 0.25م، 0.5م، 1م، 2م، 5م)
- [x] تحديث KPI cards لاستخدام مقياس الأعماق بالمتر

## مطابقة FastFlood — طبقة مياه متصلة كاملة
- [x] إعادة بناء FloodWaterLayer: طبقة Canvas متصلة في leaflet-container بز-index صحيح
- [x] إصلاح stacking context — canvas فوق overlay-pane وفوق marker icons
- [x] تدرج اللون حسب العمق: أزرق فاتح شفاف (0.1م) → أزرق داكن (5م) Gaussian radial gradient
- [x] الحواف ناعمة وطبيعية بدون حدود واضحة (Gaussian falloff)
- [x] إضافة connector hotspots لملء الفراغات بين المناطق في L1

## FastFlood flood fill — طبقة مياه حقيقية متصلة
- [x] إعادة بناء FloodWaterLayer: Canvas flood fill متصل في leaflet-container بز-index صحيح
- [x] الألوان: أزرق فاتح شفاف (0.1م) → أزرق متوسط (0.5م) → أزرق داكن (5م) Gaussian gradient
- [x] رفع radius boost إلى 4.0x في L1 لتغطية المنطقة الكاملة بين hotspots
- [x] الحواف ناعمة تماماً بدون حدود واضحة (Gaussian falloff مستوي 7)
- [x] مطابقة مقياس الألوان في legend مع FastFlood

## ضبط طبقة المياه — مسطحات دقيقة واقعية
- [x] تقليل radius boost من 4.0x إلى 1.3x في L1 (1.1x في L2, 1.0x في L3)
- [x] تقليل alpha الأساسي (0.18–0.62) لتكون الطبقة شفافة دقيقة لا ضباب أبيض
- [x] الألوان: أزرق داكن شفاف مطابق FastFlood (لا أبيض)
- [x] الحواف تنتهي بشكل طبيعي عند حدود المنطقة المنخفضة

## إصلاح تضليل L2 — مطابقة FastFlood في جميع المستويات
- [ ] إصلاح L2 (zoom 11-13): استبدال الدوائر المتجانسة بتضليل غير منتظم يتبع شكل المناطق
- [ ] دمج نظام الطرق (L3/L4) مع نظام blobs (L1/L2) بانتقال سلس
- [ ] ضمان تغطية Khalifa City B وAl Quaa وباقي المناطق المرئية

## إصلاح حدود التضليل وتغطية L3
- [x] إزالة التضليل من البحر والصحراء — إضافة حدود برية لإمارة أبوظبي (polygon mask)
- [x] تحسين L3 — التضليل يملأ المناطق السكنية بشكل كامل وليس فقط الطرق
- [x] رفع threshold الشبكة الديناميكية لتغطية أكبر مساحة من المناطق المبنية

## تنفيذ المقترحات الثلاثة
- [x] استيراد حدود GeoJSON رسمية لإمارة أبوظبي من Nominatim/OSM وتحويلها لمضلع مبسط (45 نقطة من 667)
- [x] ربط urban threshold بكثافة مباني OSM لكل خلية بدلاً من bounding boxes ثابتة (34 منطقة حضرية)
- [x] إضافة Al Shamkha وMadinat Zayed وRuwais وAl Mirfa وLiwa وAl Sila وتوسيع التغطية الغربية

## تنفيذ المقترحات الثلاثة — الدورة الثانية
- [x] تفعيل طبقة Evacuation Zones — خلايا عمق > 50 سم + كثافة حضرية ≥ 0.65 تُعرض كمضلعات ملونة ديناميكياً
- [x] ربط threshold الشبكة الديناميكية بهطول الأمطار الحي — نطاق أوسع: multiplier 0.3→-0.084 (جاف) إلى 2.5→+0.18 (مطر غزير)
- [x] تحسين Uncertainty Map — إضافة حدود OSM (AD_EMIRATE_BOUNDARY) + طبقة كثافة المباني (34 منطقة) مع tooltip تفصيلي

## إصلاح L1 — تطبيق حدود OSM على جميع المستويات
- [ ] إصلاح L1 (zoom ≤ 10): تطبيق isInsideAbuDhabi على الشبكة الديناميكية لإزالة التضليل خارج الحدود
- [ ] إزالة الدوائر المتجانسة في L1 — استبدالها بـ blobs غير منتظمة مقيدة بحدود OSM

## إصلاح نقاط تجمع المياه في البحر
- [x] فحص جميع مصادر نقاط تجمع المياه (waterAccumulationEngine, weatherService, UnifiedMapPage)
- [x] تطبيق isInsideAbuDhabi على 5 طبقات: floodZones، heatmap، drainage، live accumulation، blob hotspots
- [x] توسيع isInArabianGulf لتشمل 6 جزر بحرية معزولة (Delma، Futaisi، Aryam، Natheel، Abu Al Abyad، Sammaliyah)
- [x] اختبارات 14/14: جميع الجزر البحرية تُفلتر صحيحاً، وجميع المناطق البرية تظهر صحيحاً

## تنفيذ المقترحات الثلاثة — الدورة الثالثة
- [ ] ربط FAO SoilGrids API — جلب soilFactor حقيقي لكل منطقة من 90 منطقة (clay%, sand%, silt%)
- [ ] إصلاح L1 (zoom ≤ 10): تطبيق isInsideAbuDhabi على الشبكة الديناميكية لإزالة التضليل خارج الحدود
- [ ] إضافة طبقة كفاءة الصرف التفاعلية: خطوط ملونة (أخضر=كفء / أحمر=مكتظ) مع tooltip تفصيلي

## إصلاح النقاط في القنوات البحرية الداخلية
- [x] تحديد مصدر النقطة 50 في قناة المقطع (Khor Al Maqta) — نقطة FloodWaterLayer خاطئة الإحداثيات
- [x] توسيع isInArabianGulf لتشمل القنوات البحرية الداخلية (Khor Al Maqta، Khor Al Bateen، Khor Laffan)
- [x] فلترة جميع طبقات الخريطة من النقاط الواقعة في القنوات

## بيانات حقيقية — شبكة الصرف وخصائص التربة
- [x] ربط Open-Meteo soil moisture API لكل منطقة (sm0_1cm + sm3_9cm) → satMult 0.80–1.35 ديناميكي حقيقي
- [x] جلب شبكة الصرف الحقيقية من OSM Overpass API — 170 مجرى (43 drain + 68 canal + 59 stream) مجمعة في 71 نظام
- [x] حساب كفاءة الصرف من: soil moisture (Open-Meteo) + drainage density + capacity
- [x] تحديث طبقة الخريطة — بيانات OSM حقيقية مع tooltip يعرض رطوبة التربة وشارة مصدر البيانات (OSM + Open-Meteo)

## إصلاح المشاكل المرئية الثلاث في الخريطة
- [x] إصلاح L2 — استبدال arc() الدائرية بـ ellipse غير منتظم (rx≠ry محدد بـ seed ثابت لكل نقطة)
- [x] إصلاح مناطق الإخلاء — polygon يأخذ عينات عشوائية من bbox ويحتفظ فقط بالنقاط التي تمر isInsideAbuDhabi
- [x] إصلاح التضليل في الصحراء — desertSuppression 0.08 عند zoom≤10 + patchRadiusM من 900m إلى 520m
- [x] اختبارات: 98/98 تمر بنجاح (11 اختباراً جديداً)

## Fix English Layout RTL Issue
- [x] Fix Reports/Leadership page — text right-aligned and RTL in English mode
- [x] Ensure all text containers use dir="ltr" / text-align:left when language is English
- [x] Fix numbered list items alignment in English mode

## Scenario Simulation — تفعيل السيناريو بناءً على المستجدات
- [x] ربط SimulationPage بـ useRealWeather لاستخدام بيانات الهطول الحقيقية (18.5 mm/hr)
- [x] تحسين شبكة الخلايا: Canvas بدلاً من L.rectangle لأداء أفضل + خلايا 5×5م
- [x] إضافة طبقة حركة المرور: تلوين الطرق حسب حالتها (مفتوح/تحذير/مغلق/غير صالح)
- [x] إضافة سيناريو Live يستخدم بيانات الهطول الحقيقية من Open-Meteo
- [x] تحسين KPI bar: السكان المتأثرون، الطرق المغلقة، المساحة المغمورة، الخلايا المتأثرة، أقصى عمق، الوقت
- [x] إضافة لوحة مقارنة السيناريوهات في اليمين (Comparison scenarios)
- [x] إضافة legend عمق المياه (Safe/Wet/Flood Light/Flooded/Risk/Critical) في اليمين

## إصلاحات الواجهة — التداخل والإحداثيات
- [x] إصلاح ExplainerTooltip باستخدام createPortal لتجنب التداخل مع overflow:hidden
- [x] إصلاح إحداثيات Al Shahama في SimulationPage (كانت داخل البحر lng 54.6721 → صححت إلى 54.4721)

## استبدال الدوائر بمضلعات عضوية غير منتظمة
- [x] قراءة FloodWaterLayer وفهم منطق رسم الدوائر الحالي
- [x] استبدال الدوائر بمضلعات عضوية غير منتظمة (perturbed radial points) تتبع شكل الطبوغرافيا
- [x] تطبيق حدود isInsideAbuDhabi على المضلعات لمنع الامتداد على البحر
- [x] إزالة أرقام Zone ID المزدحمة من الخريطة
- [x] تحسين دمج التظليل عند التقاطع (smoothFactor 3.5 + reduced opacity)

## ترجمة صفحة التقارير ولوحة القيادة التنفيذية
- [x] قراءة ReportsPage وحصر جميع النصوص الإنجليزية الثابتة
- [x] ترجمة التسميات والعناوين والأقسام في صفحة التقارير
- [x] ترجمة العرض التنفيذي (Leadership Status): التوصيات، الرؤى، الحالة الراهنة
- [x] التأكد من أن جميع النصوص تستجيب لتغيير اللغة (AR/EN)

## نظام التنبيه الصوتي — جرس + صوت
- [x] إنشاء audioAlertService.ts باستخدام Web Audio API (بدون ملفات خارجية)
- [x] إضافة أصوات مختلفة حسب مستوى الخطر (تحذير / شديد / حرج)
- [x] إضافة أيقونة جرس مع badge في TopBar مع زر كتم/تفعيل
- [x] ربط الصوت بنظام التنبيهات الحالي (عند وصول تنبيه جديد)
- [x] حفظ تفضيل الكتم في localStorage

## التوافق مع الموبايل والأجهزة اللوحية
- [ ] TopBar: تصميم مدمج للموبايل مع زر hamburger
- [ ] Sidebar: تحويل إلى drawer منزلق مع overlay للموبايل
- [ ] App shell: تعديل هوامش وأبعاد للشاشات الصغيرة
- [ ] صفحة Dashboard: بطاقات KPI تصبح عمود واحد على الموبايل
- [ ] صفحة الخرائط: أدوات التحكم تنتقل لأسفل الشاشة
- [ ] صفحة التقارير: تخطيط عمود واحد على الموبايل
- [ ] صفحة المحاكاة: لوحة التحكم اليمنى تصبح منزلقة من الأسفل
- [ ] الرسوم البيانية: تتكيف مع عرض الشاشة الصغيرة
- [ ] اختبار على viewport 375px و 768px

## صفحة رادار Windy التفاعلي
- [x] إنشاء WindyRadarPage.tsx بخريطة Windy تفاعلية مركّزة على الإمارات
- [x] إضافة أزرار تبديل الطبقات (أمطار / رياح / رادار / غيوم / ضغط)
- [x] إضافة الصفحة إلى القائمة الجانبية (Sidebar)
- [x] إضافة مسار /windy في App.tsx

## نافذة تفاصيل المنطقة الشاملة
- [ ] بناء مكوّن RegionDetailModal مع جميع بيانات المنصة
- [ ] ربط النافذة ببطاقات صفحة المناطق (RegionsExplorerPage)
- [ ] ربط النافذة ببطاقات نافذة التنبيهات (AlertsPopup)

## ترقية رسم هطول الأمطار — توقعات + تاريخ + تحكم المستخدم
- [ ] تحديث weatherService لجلب توقعات 16 يوم (forecast_days=16)
- [ ] إضافة endpoint تاريخي لجلب بيانات 90 يوم ماضية (ERA5 archive)
- [ ] بناء مكوّن PrecipitationChart جديد مع أزرار الفترة (24h/7d/30d/90d/مخصص)
- [ ] إضافة توضيح القراءات (legend + annotations) داخل الرسم
- [ ] دمج المكوّن في Dashboard وصفحة المناطق

## مؤشرات تلقائية 100% مع تاريخ وتوقعات
- [x] إضافة tRPC endpoint weather.getRegionHistory لبيانات تاريخية 90 يوم + توقعات 16 يوم (getPrecipHistory endpoint)
- [x] إنشاء useLiveRegions hook يدمج البيانات الحية مع abuDhabiRegions بالإحداثيات
- [x] تحديث RegionsExplorerPage لاستخدام البيانات الحية لجميع المؤشرات الديناميكية
- [x] إضافة مخطط تاريخي/توقعات في SubAreaView مع تحديد الفترة (7d/30d/90d/16d forecast)
- [x] تحديث Dashboard KPIs لتكون تلقائية بالكامل (criticalCount + warningCount + watchCount)
- [x] تحديث UnifiedMap KPIs لتكون تلقائية بالكامل (totalAlerts = criticalZones + warningZones + watchZones)
- [x] إصلاح معادلة floodRisk في weatherService لتعطي وزناً أعلى للأمطار الفعلية الحالية

## نظام إشعارات فورية للمسؤولين
- [ ] بناء جدول alerts في قاعدة البيانات (drizzle schema)
- [ ] بناء alertEngine.ts في الخادم — يفحص floodRisk كل 5 دقائق ويُطلق إشعاراً عند تجاوز 70%
- [ ] منع تكرار الإشعار لنفس المنطقة خلال 30 دقيقة (cooldown)
- [ ] ربط alertEngine بـ notifyOwner لإرسال إشعار push للمسؤول
- [ ] إضافة tRPC endpoints: getAlerts, markRead, clearAll, getSettings, updateSettings
- [ ] بناء NotificationsPage.tsx مع سجل كامل للإشعارات + فلترة + تفاصيل
- [ ] تحديث AlertBell في TopBar لعرض عدد الإشعارات غير المقروءة من قاعدة البيانات
- [ ] إضافة لوحة إعدادات: تخصيص عتبة الخطر (50%/60%/70%/80%) + كتم/تفعيل
- [ ] ربط الإشعارات بالبيانات الحية من weatherService

## إصلاح تناقض عدد المناطق الحرجة
- [x] تشخيص سبب اختلاف عدد الحرجة بين Dashboard (1) وRegionsExplorerPage (3) — السبب: عدد sub-areas (91) أكبر من live regions (90)
- [x] توحيد مصدر البيانات — EmirateView تقرأ من useRealWeather مباشرة (90 منطقة حية) لتطابق Dashboard تماماً

## مراجعة الترجمة الشاملة — إصلاح الخلط بين العربية والإنجليزية
- [ ] جرد جميع الصفحات وتحديد النصوص الثابتة غير المترجمة
- [ ] إصلاح ReportsPage — التوصيات والرؤى والحالة الراهنة تُترجم حسب اللغة المختارة
- [ ] إصلاح UnifiedMapPage — جميع التسميات والأزرار والتوضيحات
- [ ] إصلاح RegionsExplorerPage — تسميات المؤشرات والأزرار
- [ ] إصلاح AlertsPage — عناوين الأعمدة والرسائل
- [ ] إصلاح SimulationPage — تسميات السيناريوهات والأزرار
- [ ] إصلاح DEMPage وRoadNetworkPage وDrainagePage
- [ ] التحقق من اتجاه النص (RTL/LTR) في جميع الصفحات

## Rainfall & Probability Live Data Audit
- [ ] Verify hourlyPrecipitation and precipitation_probability come from Open-Meteo live API
- [ ] Fix weatherService to include precipitation_probability in hourly fetch
- [ ] Fix chart to show past 24h actual + next 24h forecast with probability overlay

## نظام الإشعارات الفورية — مكتمل
- [x] بناء جدول floodAlerts و alertSettings في قاعدة البيانات (drizzle schema)
- [x] بناء alertEngine.ts — يفحص floodRisk كل 5 دقائق ويُطلق إشعاراً عند تجاوز 70%
- [x] منع تكرار الإشعار لنفس المنطقة خلال 30 دقيقة (cooldown map)
- [x] ربط alertEngine بـ notifyOwner لإرسال push notification للمسؤول
- [x] إضافة tRPC endpoints: getAlerts, getUnreadCount, acknowledge, acknowledgeAll, clearAll, getSettings, updateSettings, triggerCheck
- [x] بناء NotificationsPage.tsx مع سجل كامل + فلترة حسب المستوى والحالة + تفاصيل قابلة للتوسيع
- [x] تحديث TopBar لعرض عدد الإشعارات غير المقروءة من قاعدة البيانات (dbUnreadCount)
- [x] إضافة لوحة إعدادات: تخصيص عتبة الخطر + فترة التهدئة + كتم/تفعيل
- [x] إضافة NotificationsPage لـ Sidebar وApp.tsx routing
- [x] كتابة 7 اختبارات vitest لـ alertEngine (جميعها تمر)
- [x] تصدير getCachedWeatherData من weatherService للاستخدام في alertEngine


## تدقيق تحديثات البيانات الحية — Live Data Update Audit

### المشاكل المكتشفة:
- [ ] UnifiedMapPage: Drainage data updates every 30 minutes (30 * 60 * 1000 ms) — يجب تقليله إلى 60 ثانية
- [ ] RegionsExplorerPage: Precip history staleTime = 5 دقائق — يجب تقليله إلى 60 ثانية
- [ ] NotificationsPage: Alerts refetch = 30 ثانية ✅ (جيد)
- [ ] CommandDashboard: لم يتم العثور على refetchInterval — يجب إضافة polling كل 60 ثانية
- [ ] ReportsPage: لا يوجد auto-polling للبيانات الحية — يجب إضافة refresh كل 60 ثانية

### الحل المطلوب:
- [ ] تقليل جميع refetchInterval إلى 60 ثانية للمؤشرات الحرجة (rainfall, probability, risk)
- [ ] إضافة مؤشر بصري لآخر وقت تحديث (timestamp) على كل صفحة
- [ ] إضافة زر "Refresh Now" يدوي لإجبار التحديث الفوري
- [ ] تحسين الأداء: استخدام staleTime = 45 ثانية و refetchInterval = 60 ثانية
