# FloodSat AI — إعادة التصميم الجذري (360°)
# المطلوب: تغيير كامل في الهيكل + التخطيط + الخطوط + التفاعل + الأيقونات + الحركة

---

<response>
<text>

## A — "Terminal Brutalism" — نظام القيادة الحربي
**Design Movement:** Brutalist Interface + Military Command Terminal
**Core Principles:**
1. المعلومة أولاً — لا زخرفة، كل بكسل له وظيفة
2. الكثافة المعلوماتية القصوى في أقل مساحة
3. التوتر البصري المتعمد — الواجهة تشعرك بجدية الموقف
4. الخام والصريح — لا تدرج، لا ظلال، لا border-radius

**Color Philosophy:** أسود `#000000` + أخضر فوسفوري `#00FF41` + أصفر كهرباء `#FFE600` + أحمر صافٍ `#FF0000`

**Layout Paradigm:**
- لا sidebar — شريط أوامر أفقي في الأسفل (terminal taskbar)
- الخريطة تملأ 100% دائماً
- Panels تطفو كـ draggable overlays
- إطارات بزوايا مقطوعة `clip-path: polygon` بدلاً من border-radius

**Signature Elements:** scan-line animation، typewriter effect، glitch على الأرقام الحرجة
**Typography:** `JetBrains Mono` + `Share Tech Mono` + `IBM Plex Arabic`

</text>
<probability>0.07</probability>
</response>

---

<response>
<text>

## B — "Geological Strata" — طبقات الأرض والماء ✅ **المختارة**
**Design Movement:** Organic Topographic Cartography + Field Operations Interface
**Core Principles:**
1. الخريطة هي الواجهة — كل شيء يعيش فوق الخريطة لا بجانبها
2. البيانات تتدفق كالمياه — تسلسل طبيعي من الأعلى للأسفل
3. الطبقية البصرية — كل طبقة معلومات لها عمق بصري مختلف
4. الخام الجيولوجي — ألوان التربة والصخر والماء الحقيقية

**Color Philosophy:**
- خلفية: `#0D1B2A` (أزرق بحري عميق — لون المحيط في الليل)
- ثانوي: `#1B2838` (رمادي بحري)
- مياه: `#1565C0` → `#42A5F5` → `#B3E5FC`
- تربة/طرق: `#8D6E63` (بني رملي)
- خطر: `#FF6B35` (برتقالي حمم بركانية)
- آمن: `#43A047` (أخضر غابة)
- كنتور: `#546E7A` بشفافية 35%

**Layout Paradigm:**
- **Full-bleed map** تملأ الشاشة بالكامل دائماً (لا margin، لا padding)
- شريط تنقل رأسي **يطفو** من اليمين كـ floating glass panel (لا sidebar ثابت)
- البيانات تظهر كـ bottom sheet يصعد من الأسفل عند اختيار منطقة
- Header شفاف يطفو في الأعلى مع blur backdrop
- لا بطاقات مستطيلة — hexagonal data chips

**Signature Elements:**
- خطوط كنتور متحركة تتموج عند ارتفاع منسوب المياه
- Particle rain system يُحاكي قطرات المطر الحقيقية
- Ripple دائري عند كل منطقة تجمع مائي
- بطاقات البيانات بشكل سداسي (hexagonal)

**Interaction Philosophy:**
- النقر على أي منطقة يُوسّع bottom sheet في مكانها
- Long press يُظهر context menu
- Drag الـ floating panel لأي مكان على الشاشة

**Animation:**
- Ripple دائري متواصل عند مناطق التجمع
- خطوط الكنتور تتموج ببطء (8s loop)
- الأرقام تتصاعد من الصفر (count-up 1.5s)
- Rain particles تسقط في الخلفية بشفافية 15%

**Typography System:**
- `Playfair Display` للعناوين الرئيسية (serif — طابع الخرائط الجغرافية الكلاسيكية)
- `Space Mono` للأرقام والإحداثيات (monospace)
- `Noto Naskh Arabic` للنص العربي (خط عربي كلاسيكي أنيق)
- حجم العناوين: 32px Bold، البيانات: 28px Mono، التفاصيل: 12px Regular

</text>
<probability>0.06</probability>
</response>

---

<response>
<text>

## C — "Neon Noir" — مدينة المستقبل تحت المطر
**Design Movement:** Cyberpunk Data Dashboard + Blade Runner Aesthetic
**Core Principles:**
1. التناقض الصارخ — خلفية سوداء عميقة + ألوان نيون حادة
2. الضوضاء كعنصر تصميمي — grain texture على كل الخلفيات
3. Glassmorphism حاد — panels شفافة بحواف نيون مضيئة
4. الكثافة الجمالية — كل شاشة كـ cyberpunk city at night

**Color Philosophy:** `#050510` + نيون ماجنتا `#FF00FF` + سيان `#00FFFF` + glow effects
**Layout Paradigm:** Grid غير منتظم + شريط أيقونات 48px + scrolling ticker
**Typography:** `Orbitron` + `Rajdhani` + `Cairo`

</text>
<probability>0.05</probability>
</response>

---

## ✅ الاختيار: **B — "Geological Strata"**

**لماذا هذا الاختيار؟**
- يكسر القالب المؤسسي الأبيض كسراً كاملاً
- الخريطة تصبح الواجهة نفسها لا مجرد عنصر فيها
- الـ floating panel يحل محل الـ sidebar الثابت تماماً
- الـ bottom sheet يحل محل الـ cards المستطيلة
- الطابع الجيولوجي يناسب موضوع الفيضانات والتضاريس
- Playfair Display + Space Mono = تناقض جميل بين الكلاسيكي والتقني
