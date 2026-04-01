/**
 * ExplainerTooltip.tsx
 * نظام التوضيح الشامل — يشرح كل مؤشر عند hover
 * يعرض: التعريف + طريقة الاحتساب + العتبات + المصدر
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { BookOpen, Calculator, AlertTriangle, Database, X, ExternalLink } from 'lucide-react';
import { useLocation } from 'wouter';

// ── قاعدة بيانات المؤشرات ────────────────────────────────────────────────────
export type ExplainerKey =
  | 'floodRiskIndex'
  | 'activeAlerts'
  | 'maxRainfall24h'
  | 'avgTemperature'
  | 'currentPrecip'
  | 'alertLevel'
  | 'totalLast24h'
  | 'floodRisk37'
  | 'precipitation48h'
  | 'coverageArea'
  | 'satCoverage'
  | 'modelAccuracy'
  | 'updateInterval'
  | 'demElevation'
  | 'slopeAngle'
  | 'drainageCapacity'
  | 'soilSaturation'
  | 'forecastProbability';

interface ExplainerData {
  titleAr: string;
  titleEn: string;
  definitionAr: string;
  definitionEn: string;
  formulaAr: string;
  formulaEn: string;
  thresholds?: { label: string; labelEn: string; value: string; color: string; descAr: string; descEn: string }[];
  sourceAr: string;
  sourceEn: string;
  unitAr?: string;
  unitEn?: string;
}

export const EXPLAINERS: Record<ExplainerKey, ExplainerData> = {
  floodRiskIndex: {
    titleAr: 'مؤشر خطر الفيضانات',
    titleEn: 'Flood Risk Index',
    definitionAr: 'رقم من 0 إلى 100 يعكس احتمالية حدوث فيضان في منطقة ما خلال الساعات القادمة. كلما ارتفع الرقم، زادت خطورة الوضع.',
    definitionEn: 'A number from 0 to 100 reflecting the probability of flooding in a region over the coming hours. Higher values indicate greater danger.',
    formulaAr: 'المؤشر = (هطول حالي × 15) + (تراكم 24 ساعة × 1.5) + (توقع 48 ساعة × 2) + (احتمالية الأمطار × 0.1)\n\nالحد الأقصى لكل عامل:\n• هطول حالي → حد أقصى 40 نقطة\n• تراكم 24 ساعة → حد أقصى 30 نقطة\n• توقع 48 ساعة → حد أقصى 20 نقطة\n• احتمالية الأمطار → حد أقصى 10 نقاط',
    formulaEn: 'Index = (Current Precip × 15) + (24h Accumulation × 1.5) + (48h Forecast × 2) + (Rain Probability × 0.1)\n\nMax per factor:\n• Current rain → max 40 pts\n• 24h accumulation → max 30 pts\n• 48h forecast → max 20 pts\n• Rain probability → max 10 pts',
    thresholds: [
      { label: 'آمن', labelEn: 'Safe', value: '0–19', color: '#43A047', descAr: 'لا خطر. الطقس مستقر ولا توقعات بأمطار غزيرة.', descEn: 'No risk. Weather stable, no heavy rain expected.' },
      { label: 'مراقبة', labelEn: 'Watch', value: '20–44', color: '#FFB300', descAr: 'خطر منخفض. يُنصح بمتابعة التحديثات. قد تكون هناك أمطار خفيفة.', descEn: 'Low risk. Monitor updates. Light rain possible.' },
      { label: 'تحذير', labelEn: 'Warning', value: '45–69', color: '#FF6B35', descAr: 'خطر متوسط إلى مرتفع. أمطار غزيرة محتملة. يُنصح بالحذر وتجنب المناطق المنخفضة.', descEn: 'Medium-high risk. Heavy rain likely. Avoid low-lying areas.' },
      { label: 'حرج', labelEn: 'Critical', value: '70–100', color: '#E53935', descAr: 'خطر شديد. فيضانات محتملة. يُفعَّل بروتوكول الطوارئ فوراً. تجنب القيادة في المناطق المتضررة.', descEn: 'Severe risk. Flooding likely. Activate emergency protocol immediately. Avoid driving in affected areas.' },
    ],
    sourceAr: 'Open-Meteo ERA5 · نموذج تجريبي للمناطق الجافة (الإمارات)',
    sourceEn: 'Open-Meteo ERA5 · Empirical model for arid regions (UAE)',
    unitAr: 'نقطة (0–100)',
    unitEn: 'Points (0–100)',
  },

  activeAlerts: {
    titleAr: 'التنبيهات النشطة',
    titleEn: 'Active Alerts',
    definitionAr: 'عدد المناطق التي تجاوز فيها مؤشر خطر الفيضانات عتبة التحذير (45 نقطة) أو الخطر الحرج (70 نقطة).',
    definitionEn: 'Number of regions where the Flood Risk Index exceeds the warning threshold (45 pts) or critical threshold (70 pts).',
    formulaAr: 'التنبيهات النشطة = عدد مناطق التحذير (45–69) + عدد المناطق الحرجة (70+)\n\nمثال: إذا كانت 3 مناطق في حالة تحذير و1 في حالة حرجة → التنبيهات = 4',
    formulaEn: 'Active Alerts = Warning regions (45–69) + Critical regions (70+)\n\nExample: 3 warning regions + 1 critical = 4 active alerts',
    thresholds: [
      { label: '0', labelEn: '0', value: '0', color: '#43A047', descAr: 'لا تنبيهات. جميع المناطق آمنة أو في مرحلة المراقبة.', descEn: 'No alerts. All regions safe or on watch.' },
      { label: '1–3', labelEn: '1–3', value: '1–3', color: '#FFB300', descAr: 'تنبيهات محدودة. يُنصح بمتابعة المناطق المحددة.', descEn: 'Limited alerts. Monitor specific regions.' },
      { label: '4+', labelEn: '4+', value: '4+', color: '#E53935', descAr: 'تنبيهات واسعة. وضع طوارئ محتمل. يُفعَّل بروتوكول الاستجابة.', descEn: 'Wide alerts. Possible emergency. Activate response protocol.' },
    ],
    sourceAr: 'محسوب من بيانات Open-Meteo الحية · يتحدث كل دقيقتين',
    sourceEn: 'Computed from live Open-Meteo data · Updates every 2 minutes',
    unitAr: 'منطقة',
    unitEn: 'Regions',
  },

  maxRainfall24h: {
    titleAr: 'أقصى هطول (24 ساعة)',
    titleEn: 'Max Rainfall (24hr)',
    definitionAr: 'أعلى كمية أمطار تراكمية سُجِّلت في أي منطقة من مناطق الرصد خلال الـ 24 ساعة الماضية.',
    definitionEn: 'The highest cumulative rainfall recorded in any monitored region over the past 24 hours.',
    formulaAr: 'أقصى هطول = max(هطول_24ساعة لكل منطقة)\n\nيُحسب لكل منطقة بجمع قراءات الهطول الساعية من Open-Meteo ERA5 خلال 24 ساعة.',
    formulaEn: 'Max Rainfall = max(24h_rainfall for each region)\n\nCalculated per region by summing hourly precipitation readings from Open-Meteo ERA5 over 24 hours.',
    thresholds: [
      { label: '0–5 ملم', labelEn: '0–5 mm', value: '0–5', color: '#43A047', descAr: 'أمطار خفيفة جداً. لا تأثير يُذكر على الطرق أو البنية التحتية.', descEn: 'Very light rain. Negligible impact on roads or infrastructure.' },
      { label: '5–20 ملم', labelEn: '5–20 mm', value: '5–20', color: '#FFB300', descAr: 'أمطار معتدلة. قد تتشكل بُرك مياه في المناطق المنخفضة.', descEn: 'Moderate rain. Puddles may form in low-lying areas.' },
      { label: '20–50 ملم', labelEn: '20–50 mm', value: '20–50', color: '#FF6B35', descAr: 'أمطار غزيرة. خطر تجمع مياه وتأثر الطرق. تفعيل بروتوكول المراقبة.', descEn: 'Heavy rain. Risk of water pooling and road impact. Activate monitoring.' },
      { label: '50+ ملم', labelEn: '50+ mm', value: '50+', color: '#E53935', descAr: 'أمطار استثنائية. خطر فيضانات مباشر. بروتوكول طوارئ فوري.', descEn: 'Exceptional rain. Direct flood risk. Immediate emergency protocol.' },
    ],
    sourceAr: 'Open-Meteo ERA5 · بيانات ساعية مجمعة',
    sourceEn: 'Open-Meteo ERA5 · Aggregated hourly data',
    unitAr: 'ملم (ملليمتر)',
    unitEn: 'mm (millimeters)',
  },

  avgTemperature: {
    titleAr: 'متوسط درجة الحرارة',
    titleEn: 'Average Temperature',
    definitionAr: 'متوسط درجة الحرارة الحالية عبر جميع مناطق الرصد في إمارة أبوظبي.',
    definitionEn: 'Average current temperature across all monitored regions in Abu Dhabi Emirate.',
    formulaAr: 'متوسط الحرارة = مجموع درجات حرارة كل المناطق ÷ عدد المناطق\n\nدرجة الحرارة لكل منطقة تُؤخذ من قراءة Open-Meteo الحالية (temperature_2m).',
    formulaEn: 'Avg Temp = Sum of all region temperatures ÷ Number of regions\n\nEach region temperature is taken from the current Open-Meteo reading (temperature_2m).',
    sourceAr: 'Open-Meteo ERA5 · قراءة حالية (temperature_2m)',
    sourceEn: 'Open-Meteo ERA5 · Current reading (temperature_2m)',
    unitAr: 'درجة مئوية (°C)',
    unitEn: 'Celsius (°C)',
  },

  alertLevel: {
    titleAr: 'مستوى التنبيه',
    titleEn: 'Alert Level',
    definitionAr: 'تصنيف حالة كل منطقة بناءً على مؤشر خطر الفيضانات. يتراوح بين 4 مستويات.',
    definitionEn: 'Classification of each region\'s status based on the Flood Risk Index. Ranges across 4 levels.',
    formulaAr: 'مستوى التنبيه يُحدَّد تلقائياً من مؤشر الخطر:\n• 0–19 → آمن (أخضر)\n• 20–44 → مراقبة (أصفر)\n• 45–69 → تحذير (برتقالي)\n• 70–100 → حرج (أحمر)',
    formulaEn: 'Alert level is automatically determined from the Risk Index:\n• 0–19 → Safe (green)\n• 20–44 → Watch (yellow)\n• 45–69 → Warning (orange)\n• 70–100 → Critical (red)',
    thresholds: [
      { label: 'آمن', labelEn: 'Safe', value: '0–19', color: '#43A047', descAr: 'لا إجراء مطلوب. مراقبة روتينية.', descEn: 'No action required. Routine monitoring.' },
      { label: 'مراقبة', labelEn: 'Watch', value: '20–44', color: '#FFB300', descAr: 'متابعة مستمرة. تجهيز فرق الاستجابة.', descEn: 'Continuous monitoring. Prepare response teams.' },
      { label: 'تحذير', labelEn: 'Warning', value: '45–69', color: '#FF6B35', descAr: 'تفعيل بروتوكول التحذير. إخطار الجهات المعنية.', descEn: 'Activate warning protocol. Notify relevant authorities.' },
      { label: 'حرج', labelEn: 'Critical', value: '70–100', color: '#E53935', descAr: 'طوارئ فورية. إغلاق الطرق المتضررة. إخلاء المناطق الخطرة.', descEn: 'Immediate emergency. Close affected roads. Evacuate danger zones.' },
    ],
    sourceAr: 'محسوب من مؤشر خطر الفيضانات',
    sourceEn: 'Derived from Flood Risk Index',
  },

  currentPrecip: {
    titleAr: 'معدل الهطول الحالي',
    titleEn: 'Current Precipitation Rate',
    definitionAr: 'كمية الأمطار التي تسقط حالياً بالملليمتر في الساعة.',
    definitionEn: 'Amount of rain currently falling in millimeters per hour.',
    formulaAr: 'يُقرأ مباشرة من قراءة Open-Meteo الحالية (precipitation بالملم/ساعة).\n\nمثال: 2.5 ملم/ساعة = 2.5 ملم من المطر يسقط في كل ساعة.',
    formulaEn: 'Read directly from current Open-Meteo reading (precipitation in mm/hr).\n\nExample: 2.5 mm/hr = 2.5 mm of rain falling every hour.',
    thresholds: [
      { label: '0 ملم/س', labelEn: '0 mm/hr', value: '0', color: '#43A047', descAr: 'لا مطر حالياً.', descEn: 'No rain currently.' },
      { label: '0.1–2 ملم/س', labelEn: '0.1–2 mm/hr', value: '0.1–2', color: '#FFB300', descAr: 'مطر خفيف. تأثير محدود.', descEn: 'Light rain. Limited impact.' },
      { label: '2–10 ملم/س', labelEn: '2–10 mm/hr', value: '2–10', color: '#FF6B35', descAr: 'مطر معتدل إلى غزير. خطر تجمع مياه.', descEn: 'Moderate to heavy rain. Water pooling risk.' },
      { label: '10+ ملم/س', labelEn: '10+ mm/hr', value: '10+', color: '#E53935', descAr: 'مطر غزير جداً. خطر فيضانات فوري.', descEn: 'Very heavy rain. Immediate flood risk.' },
    ],
    sourceAr: 'Open-Meteo · قراءة حالية (precipitation)',
    sourceEn: 'Open-Meteo · Current reading (precipitation)',
    unitAr: 'ملم/ساعة',
    unitEn: 'mm/hr',
  },

  totalLast24h: {
    titleAr: 'إجمالي هطول 24 ساعة',
    titleEn: '24-Hour Total Rainfall',
    definitionAr: 'مجموع كمية الأمطار المتراكمة خلال الـ 24 ساعة الماضية في منطقة محددة.',
    definitionEn: 'Total accumulated rainfall over the past 24 hours in a specific region.',
    formulaAr: 'إجمالي 24 ساعة = مجموع قراءات الهطول الساعية من Open-Meteo خلال 24 ساعة\n\nيُحسب بجمع 24 قراءة ساعية متتالية.',
    formulaEn: 'Total 24h = Sum of hourly precipitation readings from Open-Meteo over 24 hours\n\nCalculated by summing 24 consecutive hourly readings.',
    sourceAr: 'Open-Meteo ERA5 · بيانات ساعية',
    sourceEn: 'Open-Meteo ERA5 · Hourly data',
    unitAr: 'ملم (ملليمتر)',
    unitEn: 'mm (millimeters)',
  },

  forecastProbability: {
    titleAr: 'احتمالية الأمطار',
    titleEn: 'Precipitation Probability',
    definitionAr: 'النسبة المئوية التي تشير إلى احتمال سقوط الأمطار في الساعة القادمة.',
    definitionEn: 'Percentage indicating the probability of rainfall in the next hour.',
    formulaAr: 'يُقرأ مباشرة من نموذج Open-Meteo التنبؤي (precipitation_probability).\n\nمثال: 70% تعني أن هناك 70 فرصة من أصل 100 لسقوط الأمطار.',
    formulaEn: 'Read directly from Open-Meteo forecast model (precipitation_probability).\n\nExample: 70% means 70 out of 100 chance of rain.',
    thresholds: [
      { label: '0–20%', labelEn: '0–20%', value: '0–20', color: '#43A047', descAr: 'احتمال منخفض جداً. الجو مستقر.', descEn: 'Very low probability. Stable weather.' },
      { label: '20–50%', labelEn: '20–50%', value: '20–50', color: '#FFB300', descAr: 'احتمال متوسط. متابعة مستمرة.', descEn: 'Moderate probability. Continuous monitoring.' },
      { label: '50–80%', labelEn: '50–80%', value: '50–80', color: '#FF6B35', descAr: 'احتمال مرتفع. تجهيز استجابة.', descEn: 'High probability. Prepare response.' },
      { label: '80–100%', labelEn: '80–100%', value: '80–100', color: '#E53935', descAr: 'احتمال شبه مؤكد. تفعيل بروتوكول الطوارئ.', descEn: 'Near-certain. Activate emergency protocol.' },
    ],
    sourceAr: 'Open-Meteo · نموذج تنبؤي (precipitation_probability)',
    sourceEn: 'Open-Meteo · Forecast model (precipitation_probability)',
    unitAr: 'نسبة مئوية (%)',
    unitEn: 'Percentage (%)',
  },

  coverageArea: {
    titleAr: 'مساحة التغطية',
    titleEn: 'Coverage Area',
    definitionAr: 'المساحة الجغرافية الإجمالية التي تغطيها منصة FloodSat AI بالرصد والتحليل.',
    definitionEn: 'Total geographic area covered by the FloodSat AI platform for monitoring and analysis.',
    formulaAr: 'مجموع مساحات 90 منطقة رصد في إمارة أبوظبي = 67,340 كم²\n\nيشمل: مدينة أبوظبي، العين، الظفرة، والمناطق الساحلية.',
    formulaEn: 'Sum of areas of 90 monitored regions in Abu Dhabi Emirate = 67,340 km²\n\nIncludes: Abu Dhabi City, Al Ain, Al Dhafra, and coastal areas.',
    sourceAr: 'بيانات جغرافية رسمية — إمارة أبوظبي',
    sourceEn: 'Official geographic data — Emirate of Abu Dhabi',
    unitAr: 'كيلومتر مربع (كم²)',
    unitEn: 'Square kilometers (km²)',
  },

  satCoverage: {
    titleAr: 'تغطية الأقمار الصناعية',
    titleEn: 'Satellite Coverage',
    definitionAr: 'نسبة مساحة إمارة أبوظبي التي تشملها بيانات الأقمار الصناعية المستخدمة في المنصة.',
    definitionEn: 'Percentage of Abu Dhabi Emirate area covered by satellite data used in the platform.',
    formulaAr: 'تغطية الأقمار = (المساحة المُغطاة ÷ إجمالي مساحة الإمارة) × 100\n\nالأقمار المستخدمة: Sentinel-1/2 (ESA) + Landsat-8/9 (NASA)',
    formulaEn: 'Sat Coverage = (Covered Area ÷ Total Emirate Area) × 100\n\nSatellites used: Sentinel-1/2 (ESA) + Landsat-8/9 (NASA)',
    sourceAr: 'ESA Copernicus · NASA Landsat',
    sourceEn: 'ESA Copernicus · NASA Landsat',
    unitAr: 'نسبة مئوية (%)',
    unitEn: 'Percentage (%)',
  },

  modelAccuracy: {
    titleAr: 'دقة النموذج',
    titleEn: 'Model Accuracy',
    definitionAr: 'نسبة التطابق بين توقعات نموذج الفيضانات والبيانات الميدانية الفعلية.',
    definitionEn: 'Percentage match between flood model predictions and actual field data.',
    formulaAr: 'الدقة = (التنبؤات الصحيحة ÷ إجمالي التنبؤات) × 100\n\nتُقاس بمقارنة توقعات النموذج مع سجلات الفيضانات التاريخية (2011–2024).',
    formulaEn: 'Accuracy = (Correct Predictions ÷ Total Predictions) × 100\n\nMeasured by comparing model forecasts against historical flood records (2011–2024).',
    sourceAr: 'تحقق ميداني · سجلات الفيضانات التاريخية 2011–2024',
    sourceEn: 'Field validation · Historical flood records 2011–2024',
    unitAr: 'نسبة مئوية (%)',
    unitEn: 'Percentage (%)',
  },

  updateInterval: {
    titleAr: 'تكرار التحديث',
    titleEn: 'Update Interval',
    definitionAr: 'الفترة الزمنية بين كل تحديث وآخر للبيانات الحية في المنصة.',
    definitionEn: 'Time interval between each live data update in the platform.',
    formulaAr: 'تُحدَّث البيانات كل 10 دقائق من Open-Meteo ERA5.\nيتم تحديث الـ cache في الخادم كل 5 دقائق.\nيتحدث المتصفح تلقائياً كل دقيقتين.',
    formulaEn: 'Data updates every 10 minutes from Open-Meteo ERA5.\nServer cache refreshes every 5 minutes.\nBrowser auto-refreshes every 2 minutes.',
    sourceAr: 'Open-Meteo ERA5 · خادم FloodSat',
    sourceEn: 'Open-Meteo ERA5 · FloodSat Server',
    unitAr: 'دقائق',
    unitEn: 'Minutes',
  },

  demElevation: {
    titleAr: 'الارتفاع عن سطح البحر',
    titleEn: 'Elevation Above Sea Level',
    definitionAr: 'ارتفاع نقطة جغرافية عن مستوى سطح البحر. المناطق المنخفضة أكثر عرضة للفيضانات.',
    definitionEn: 'Height of a geographic point above sea level. Lower areas are more prone to flooding.',
    formulaAr: 'يُستخرج من نموذج الارتفاع الرقمي (DEM) بدقة 30 متر.\nالمصدر: SRTM (NASA) + ALOS DEM.\n\nالمناطق أقل من 5 متر فوق مستوى البحر تُعدّ عالية الخطورة.',
    formulaEn: 'Extracted from Digital Elevation Model (DEM) at 30m resolution.\nSource: SRTM (NASA) + ALOS DEM.\n\nAreas below 5m above sea level are considered high risk.',
    thresholds: [
      { label: '0–5 م', labelEn: '0–5 m', value: '0–5', color: '#E53935', descAr: 'منطقة منخفضة جداً. خطر فيضان مرتفع.', descEn: 'Very low area. High flood risk.' },
      { label: '5–20 م', labelEn: '5–20 m', value: '5–20', color: '#FF6B35', descAr: 'منطقة منخفضة. خطر متوسط.', descEn: 'Low area. Moderate risk.' },
      { label: '20–100 م', labelEn: '20–100 m', value: '20–100', color: '#FFB300', descAr: 'منطقة متوسطة الارتفاع. خطر منخفض.', descEn: 'Mid-elevation. Low risk.' },
      { label: '100+ م', labelEn: '100+ m', value: '100+', color: '#43A047', descAr: 'منطقة مرتفعة. خطر فيضان ضئيل.', descEn: 'High elevation. Minimal flood risk.' },
    ],
    sourceAr: 'NASA SRTM · ALOS DEM · دقة 30 متر',
    sourceEn: 'NASA SRTM · ALOS DEM · 30m resolution',
    unitAr: 'متر (م)',
    unitEn: 'Meters (m)',
  },

  slopeAngle: {
    titleAr: 'زاوية الانحدار',
    titleEn: 'Slope Angle',
    definitionAr: 'درجة ميل السطح الأرضي. الانحدار الشديد يُسرّع جريان المياه، والانحدار المنخفض يُسبب تجمعها.',
    definitionEn: 'Degree of ground surface inclination. Steep slopes accelerate water flow; gentle slopes cause pooling.',
    formulaAr: 'الانحدار = arctan(فرق الارتفاع ÷ المسافة الأفقية) × (180 ÷ π)\n\nيُحسب من نموذج DEM بتحليل الفرق بين ارتفاع الخلية وجيرانها الثمانية.',
    formulaEn: 'Slope = arctan(elevation difference ÷ horizontal distance) × (180 ÷ π)\n\nCalculated from DEM by analyzing height difference between a cell and its 8 neighbors.',
    thresholds: [
      { label: '0–2°', labelEn: '0–2°', value: '0–2', color: '#E53935', descAr: 'مسطح جداً. خطر تجمع مياه عالٍ.', descEn: 'Very flat. High water pooling risk.' },
      { label: '2–5°', labelEn: '2–5°', value: '2–5', color: '#FF6B35', descAr: 'انحدار خفيف. تصريف بطيء.', descEn: 'Gentle slope. Slow drainage.' },
      { label: '5–15°', labelEn: '5–15°', value: '5–15', color: '#FFB300', descAr: 'انحدار معتدل. تصريف جيد.', descEn: 'Moderate slope. Good drainage.' },
      { label: '15°+', labelEn: '15°+', value: '15+', color: '#43A047', descAr: 'انحدار حاد. تصريف سريع لكن خطر انجراف.', descEn: 'Steep slope. Fast drainage but erosion risk.' },
    ],
    sourceAr: 'محسوب من NASA SRTM DEM',
    sourceEn: 'Computed from NASA SRTM DEM',
    unitAr: 'درجة (°)',
    unitEn: 'Degrees (°)',
  },

  drainageCapacity: {
    titleAr: 'طاقة الصرف',
    titleEn: 'Drainage Capacity',
    definitionAr: 'قدرة شبكة الصرف الصحي والأودية على استيعاب مياه الأمطار وتصريفها.',
    definitionEn: 'Capacity of drainage networks and wadis to absorb and discharge rainwater.',
    formulaAr: 'طاقة الصرف = (كثافة شبكة الصرف × معامل التصريف) ÷ مساحة الحوض\n\nتُصنَّف من 0 (ضعيف جداً) إلى 100 (ممتاز) بناءً على بيانات OSM وبيانات الأودية.',
    formulaEn: 'Drainage Capacity = (Network density × Discharge coefficient) ÷ Basin area\n\nRated 0 (very poor) to 100 (excellent) based on OSM and wadi data.',
    sourceAr: 'OpenStreetMap · بيانات الأودية الإماراتية',
    sourceEn: 'OpenStreetMap · UAE wadi data',
    unitAr: 'نقطة (0–100)',
    unitEn: 'Score (0–100)',
  },

  soilSaturation: {
    titleAr: 'تشبع التربة',
    titleEn: 'Soil Saturation',
    definitionAr: 'نسبة امتلاء مسامات التربة بالماء. التربة المشبعة لا تمتص مزيداً من الأمطار مما يزيد الجريان السطحي.',
    definitionEn: 'Percentage of soil pores filled with water. Saturated soil cannot absorb more rain, increasing surface runoff.',
    formulaAr: 'تشبع التربة = (هطول متراكم ÷ سعة امتصاص التربة) × 100\n\nسعة الامتصاص تعتمد على نوع التربة: رملية (عالية)، طينية (منخفضة).',
    formulaEn: 'Soil Saturation = (Accumulated rainfall ÷ Soil absorption capacity) × 100\n\nAbsorption capacity depends on soil type: sandy (high), clay (low).',
    thresholds: [
      { label: '0–30%', labelEn: '0–30%', value: '0–30', color: '#43A047', descAr: 'تربة جافة. امتصاص جيد للأمطار.', descEn: 'Dry soil. Good rain absorption.' },
      { label: '30–60%', labelEn: '30–60%', value: '30–60', color: '#FFB300', descAr: 'تربة رطبة. امتصاص متوسط.', descEn: 'Moist soil. Moderate absorption.' },
      { label: '60–85%', labelEn: '60–85%', value: '60–85', color: '#FF6B35', descAr: 'تربة شبه مشبعة. جريان سطحي مرتفع.', descEn: 'Near-saturated. High surface runoff.' },
      { label: '85–100%', labelEn: '85–100%', value: '85–100', color: '#E53935', descAr: 'تربة مشبعة تماماً. خطر فيضان فوري.', descEn: 'Fully saturated. Immediate flood risk.' },
    ],
    sourceAr: 'محسوب من بيانات الهطول التراكمي + خصائص التربة',
    sourceEn: 'Computed from cumulative rainfall + soil properties',
    unitAr: 'نسبة مئوية (%)',
    unitEn: 'Percentage (%)',
  },

  floodRisk37: {
    titleAr: 'مؤشر الخطر الحالي',
    titleEn: 'Current Risk Index',
    definitionAr: 'مؤشر خطر الفيضانات الحالي للمنطقة المحددة. يعكس الوضع الراهن بناءً على بيانات الطقس الحية.',
    definitionEn: 'Current flood risk index for the specified region. Reflects current conditions based on live weather data.',
    formulaAr: 'نفس صيغة مؤشر خطر الفيضانات:\nالمؤشر = (هطول حالي × 15) + (تراكم 24 ساعة × 1.5) + (توقع 48 ساعة × 2) + (احتمالية × 0.1)',
    formulaEn: 'Same formula as Flood Risk Index:\nIndex = (Current Precip × 15) + (24h Accum × 1.5) + (48h Forecast × 2) + (Probability × 0.1)',
    thresholds: [
      { label: 'آمن (0–19)', labelEn: 'Safe (0–19)', value: '0–19', color: '#43A047', descAr: 'لا خطر. مراقبة روتينية.', descEn: 'No risk. Routine monitoring.' },
      { label: 'مراقبة (20–44)', labelEn: 'Watch (20–44)', value: '20–44', color: '#FFB300', descAr: 'خطر منخفض. متابعة مستمرة.', descEn: 'Low risk. Continuous monitoring.' },
      { label: 'تحذير (45–69)', labelEn: 'Warning (45–69)', value: '45–69', color: '#FF6B35', descAr: 'خطر مرتفع. تفعيل بروتوكول التحذير.', descEn: 'High risk. Activate warning protocol.' },
      { label: 'حرج (70+)', labelEn: 'Critical (70+)', value: '70+', color: '#E53935', descAr: 'طوارئ. إجراء فوري مطلوب.', descEn: 'Emergency. Immediate action required.' },
    ],
    sourceAr: 'Open-Meteo ERA5 · محسوب في الوقت الفعلي',
    sourceEn: 'Open-Meteo ERA5 · Computed in real-time',
    unitAr: 'نقطة (0–100)',
    unitEn: 'Points (0–100)',
  },

  precipitation48h: {
    titleAr: 'مخطط الهطول — 48 ساعة',
    titleEn: 'Precipitation Chart — 48 Hours',
    definitionAr: 'يعرض كمية الأمطار الساعية خلال 24 ساعة ماضية و24 ساعة قادمة لمدينة أبوظبي.',
    definitionEn: 'Shows hourly rainfall over the past 24 hours and next 24 hours for Abu Dhabi City.',
    formulaAr: 'المحور الأفقي: الوقت (ساعة بساعة)\nالمحور الرأسي: كمية الأمطار (ملم/ساعة)\n\nالخط الأزرق: هطول فعلي (ماضٍ)\nالمنطقة المظللة: توقع مستقبلي\nالخط العمودي "الآن": الوقت الحالي',
    formulaEn: 'X-axis: Time (hour by hour)\nY-axis: Rainfall amount (mm/hr)\n\nBlue line: Actual rainfall (past)\nShaded area: Future forecast\nVertical "NOW" line: Current time',
    sourceAr: 'Open-Meteo ERA5 · بيانات ساعية',
    sourceEn: 'Open-Meteo ERA5 · Hourly data',
    unitAr: 'ملم/ساعة',
    unitEn: 'mm/hr',
  },
};

// ── مكون ExplainerTooltip ─────────────────────────────────────────────────────
interface ExplainerTooltipProps {
  id: ExplainerKey;
  children?: React.ReactNode;
  /** موضع الـ tooltip: top, bottom, left, right */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** حجم أيقونة المعلومات */
  iconSize?: number;
  /** إخفاء أيقونة المعلومات وإظهار الـ tooltip عند hover على الـ children مباشرة */
  wrapOnly?: boolean;
}

export default function ExplainerTooltip({
  id,
  children,
  position = 'bottom',
  iconSize = 13,
  wrapOnly = false,
}: ExplainerTooltipProps) {
  const { lang } = useLanguage();
  const isRtl = lang === 'ar';
  const [visible, setVisible] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();
  const data = EXPLAINERS[id];

  // Compute portal position from trigger bounding rect
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const TW = 340;
    let top = 0, left = 0;
    switch (position) {
      case 'top':
        // We don't know tooltip height yet; use a generous estimate of 400px
        top = rect.top - 400 - 8;
        left = rect.left + rect.width / 2 - TW / 2;
        break;
      case 'bottom':
        top = rect.bottom + 8;
        left = rect.left + rect.width / 2 - TW / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - TW - 8;
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + 8;
        break;
    }
    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - TW - 8));
    top = Math.max(8, top);
    setTooltipPos({ top, left });
  }, [position]);

  if (!data) return <>{children}</>;
  const title = isRtl ? data.titleAr : data.titleEn;
  const definition = isRtl ? data.definitionAr : data.definitionEn;
  const formula = isRtl ? data.formulaAr : data.formulaEn;
  const source = isRtl ? data.sourceAr : data.sourceEn;
  const unit = isRtl ? data.unitAr : data.unitEn;
  const show = visible || pinned;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        tooltipRef.current && !tooltipRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setPinned(false);
        setVisible(false);
      }
    }
    if (pinned) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pinned]);

  useEffect(() => {
    if (show) updatePosition();
  }, [show, updatePosition]);

  // Re-adjust 'top' position after tooltip renders to use actual height
  useEffect(() => {
    if (show && position === 'top' && tooltipRef.current && triggerRef.current) {
      const trigRect = triggerRef.current.getBoundingClientRect();
      const tipH = tooltipRef.current.getBoundingClientRect().height;
      const newTop = Math.max(8, trigRect.top - tipH - 8);
      setTooltipPos(prev => prev ? { ...prev, top: newTop } : prev);
    }
  }, [show, position]);

  return (
    <div ref={triggerRef} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
      {children}
      {!wrapOnly && (
        <span
          onMouseEnter={() => setVisible(true)}
          onMouseLeave={() => { if (!pinned) setVisible(false); }}
          onClick={() => setPinned(p => !p)}
          title={isRtl ? 'انقر للتفاصيل' : 'Click for details'}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: `${iconSize + 4}px`, height: `${iconSize + 4}px`,
            borderRadius: '50%',
            background: pinned ? 'rgba(66,165,245,0.25)' : 'rgba(66,165,245,0.10)',
            border: `1px solid ${pinned ? 'rgba(66,165,245,0.6)' : 'rgba(66,165,245,0.25)'}`,
            color: '#42A5F5',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s',
          }}
        >
          <BookOpen size={iconSize - 2} />
        </span>
      )}

      {show && tooltipPos && createPortal(
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            top: tooltipPos.top,
            left: tooltipPos.left,
            zIndex: 99999,
            width: '340px',
            maxWidth: 'calc(100vw - 16px)',
            background: 'rgba(10, 20, 35, 0.97)',
            border: '1px solid rgba(66,165,245,0.30)',
            borderRadius: '6px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(16px)',
            direction: isRtl ? 'rtl' : 'ltr',
            fontFamily: isRtl ? 'Noto Naskh Arabic, serif' : 'Inter, sans-serif',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '10px 14px 8px',
            borderBottom: '1px solid rgba(66,165,245,0.15)',
            background: 'rgba(66,165,245,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <BookOpen size={13} color="#42A5F5" />
              <span style={{ fontWeight: 700, fontSize: '13px', color: '#E8F4F8' }}>{title}</span>
              {unit && (
                <span style={{
                  fontSize: '9px', padding: '1px 6px', borderRadius: '3px',
                  background: 'rgba(66,165,245,0.15)', color: '#42A5F5',
                  fontFamily: 'Space Mono, monospace',
                }}>{unit}</span>
              )}
            </div>
            <button
              onClick={() => { setPinned(false); setVisible(false); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#546E7A', padding: '2px' }}
            >
              <X size={12} />
            </button>
          </div>

          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Definition */}
            <div>
              <div style={{ fontSize: '10px', color: '#42A5F5', fontFamily: 'Space Mono, monospace', marginBottom: '4px', letterSpacing: '0.06em' }}>
                {isRtl ? 'التعريف' : 'DEFINITION'}
              </div>
              <p style={{ fontSize: '12px', color: '#B0BEC5', lineHeight: 1.6, margin: 0 }}>{definition}</p>
            </div>

            {/* Formula */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
                <Calculator size={11} color="#4DD0E1" />
                <span style={{ fontSize: '10px', color: '#4DD0E1', fontFamily: 'Space Mono, monospace', letterSpacing: '0.06em' }}>
                  {isRtl ? 'طريقة الاحتساب' : 'HOW IT\'S CALCULATED'}
                </span>
              </div>
              <pre style={{
                fontSize: '11px', color: '#90CAF9', lineHeight: 1.7, margin: 0,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: 'rgba(66,165,245,0.06)', borderRadius: '4px',
                padding: '8px 10px', border: '1px solid rgba(66,165,245,0.10)',
                fontFamily: isRtl ? 'Noto Naskh Arabic, serif' : 'Space Mono, monospace',
              }}>{formula}</pre>
            </div>

            {/* Thresholds */}
            {data.thresholds && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                  <AlertTriangle size={11} color="#FFB300" />
                  <span style={{ fontSize: '10px', color: '#FFB300', fontFamily: 'Space Mono, monospace', letterSpacing: '0.06em' }}>
                    {isRtl ? 'مستويات التصنيف' : 'CLASSIFICATION LEVELS'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {data.thresholds.map((t, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '8px',
                      padding: '5px 8px', borderRadius: '4px',
                      background: `${t.color}0D`, border: `1px solid ${t.color}22`,
                    }}>
                      <div style={{
                        minWidth: '52px', textAlign: 'center',
                        background: `${t.color}22`, borderRadius: '3px',
                        padding: '1px 4px', flexShrink: 0,
                      }}>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: t.color, fontFamily: 'Space Mono, monospace' }}>
                          {isRtl ? t.label : t.labelEn}
                        </span>
                        <div style={{ fontSize: '8px', color: t.color, opacity: 0.7, fontFamily: 'Space Mono, monospace' }}>{t.value}</div>
                      </div>
                      <span style={{ fontSize: '11px', color: '#B0BEC5', lineHeight: 1.5 }}>
                        {isRtl ? t.descAr : t.descEn}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Source + Read More */}
            <div style={{
              paddingTop: '6px', borderTop: '1px solid rgba(66,165,245,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Database size={10} color="#546E7A" />
                <span style={{ fontSize: '10px', color: '#546E7A', fontFamily: 'Space Mono, monospace' }}>
                  {isRtl ? 'المصدر: ' : 'Source: '}{source}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPinned(false);
                  setVisible(false);
                  navigate('/glossary');
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  background: 'rgba(66,165,245,0.10)',
                  border: '1px solid rgba(66,165,245,0.25)',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  color: '#42A5F5',
                  fontSize: '10px',
                  fontFamily: isRtl ? 'Noto Naskh Arabic, serif' : 'Space Mono, monospace',
                  whiteSpace: 'nowrap',
                }}
              >
                <ExternalLink size={9} />
                {isRtl ? 'الفهرس التعريفي' : 'Full Glossary'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
