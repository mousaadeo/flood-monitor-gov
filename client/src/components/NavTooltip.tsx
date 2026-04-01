/*
 * NavTooltip.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable "?" icon with a rich bilingual tooltip describing each page/feature.
 * Supports Arabic (RTL) and English (LTR) based on current language setting.
 */

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Page descriptions registry (bilingual) ───────────────────────────────────
export const PAGE_INFO: Record<string, {
  titleEn: string;
  titleAr: string;
  summaryEn: string;
  summaryAr: string;
  goalsEn: string[];
  goalsAr: string[];
  audienceEn: string;
  audienceAr: string;
  dataSource?: string;
}> = {
  // ── Live Monitoring ──────────────────────────────────────────────────────────
  dashboard: {
    titleEn: 'Main Dashboard',
    titleAr: 'لوحة القيادة الرئيسية',
    summaryEn: 'Comprehensive monitoring center for the current state of Abu Dhabi Emirate — aggregates all vital indicators in one place.',
    summaryAr: 'مركز الرصد الشامل للوضع الراهن في إمارة أبوظبي — يجمع جميع المؤشرات الحيوية في مكان واحد.',
    goalsEn: [
      'Display real-time risk indicators (precipitation, temperature, critical zones)',
      'Track flood status over time with charts',
      'Quick access to all platform sections',
      'Export instant PDF reports',
    ],
    goalsAr: [
      'عرض مؤشرات الخطر الآنية (هطول، حرارة، مناطق حرجة)',
      'تتبع حالة الفيضانات عبر الزمن بالرسوم البيانية',
      'الوصول السريع لجميع أقسام المنصة',
      'تصدير تقارير PDF فورية',
    ],
    audienceEn: 'Decision makers, operations centers, senior management',
    audienceAr: 'صانعو القرار، مراكز العمليات، الإدارة العليا',
    dataSource: 'Open-Meteo ERA5 · Copernicus CEMS · OSM',
  },
  alerts: {
    titleEn: 'Alerts & Warnings',
    titleAr: 'التنبيهات والإنذارات',
    summaryEn: 'Early warning system — monitors critical threshold breaches and issues real-time priority-classified alerts.',
    summaryAr: 'نظام الإنذار المبكر — يرصد تجاوز العتبات الحرجة ويصدر تنبيهات آنية مصنفة حسب الأولوية.',
    goalsEn: [
      'Issue automatic alerts when risk thresholds are exceeded',
      'Classify alerts: Critical / Warning / Informational',
      'Track each alert status (Active / Handled / Closed)',
      'Send notifications to field teams',
    ],
    goalsAr: [
      'إصدار تنبيهات تلقائية عند تجاوز عتبات الخطر',
      'تصنيف التنبيهات: حرج / تحذير / معلوماتي',
      'تتبع حالة كل تنبيه (نشط / معالج / مغلق)',
      'إرسال إشعارات للفرق الميدانية',
    ],
    audienceEn: 'Emergency teams, operations centers',
    audienceAr: 'فرق الطوارئ، مراكز العمليات',
    dataSource: 'Internal rules engine + Open-Meteo',
  },

  // ── Maps & Monitoring ─────────────────────────────────────────────────────────
  map: {
    titleEn: 'Unified Map Center',
    titleAr: 'مركز الخريطة الموحدة',
    summaryEn: 'Multi-layer interactive map combining water accumulation, road network, risk density, and drainage points in a single interface.',
    summaryAr: 'خريطة تفاعلية متعددة الطبقات تجمع تراكم المياه، شبكة الطرق، كثافة الخطر، ونقاط الصرف في واجهة واحدة.',
    goalsEn: [
      'Visualize water accumulation at 4 resolution levels by zoom',
      'Monitor road conditions and flood impact on traffic',
      'Analyze geographic risk density with heatmap',
      'Monitor drainage network load and pressure points',
    ],
    goalsAr: [
      'تصور تراكم المياه بـ 4 مستويات دقة حسب التكبير',
      'مراقبة حالة الطرق وتأثير الفيضانات على حركة المرور',
      'تحليل كثافة الخطر الجغرافي بخريطة الحرارة',
      'مراقبة حمل شبكة الصرف ونقاط الضغط',
    ],
    audienceEn: 'Emergency teams, engineers, field decision makers',
    audienceAr: 'فرق الطوارئ، المهندسون، صانعو القرار الميداني',
    dataSource: 'Open-Meteo · OSM Overpass · Copernicus CEMS',
  },
  dem: {
    titleEn: 'Digital Elevation Model (DEM)',
    titleAr: 'نموذج الارتفاع الرقمي (DEM)',
    summaryEn: 'Continuous topographic heatmap displaying Abu Dhabi Emirate elevations — low-lying areas are highest flood risk.',
    summaryAr: 'خريطة حرارية طبوغرافية مستمرة تعرض ارتفاعات إمارة أبوظبي — المناطق المنخفضة هي الأعلى خطراً للفيضانات.',
    goalsEn: [
      'Identify low-lying areas most susceptible to inundation',
      'Analyze water flow paths based on terrain',
      'Calculate percentage of area within risk range',
      'Support infrastructure planning and drainage projects',
    ],
    goalsAr: [
      'تحديد المناطق المنخفضة الأكثر عرضة للغمر',
      'تحليل مسارات تدفق المياه بناءً على التضاريس',
      'حساب نسبة المساحة ضمن نطاق الخطر',
      'دعم تخطيط البنية التحتية ومشاريع الصرف',
    ],
    audienceEn: 'Hydrological engineers, infrastructure planners',
    audienceAr: 'مهندسو الهيدرولوجيا، مخططو البنية التحتية',
    dataSource: 'SRTM 90m · Open-Meteo Elevation API · OSM',
  },
  'road-network': {
    titleEn: 'Road Network & Traffic',
    titleAr: 'شبكة الطرق والمرور',
    summaryEn: 'Analysis of flood impact on the road network — identifies inundated roads, alternative routes, and evacuation priorities.',
    summaryAr: 'تحليل تأثير الفيضانات على شبكة الطرق — يحدد الطرق المغمورة، المسارات البديلة، وأولويات الإخلاء.',
    goalsEn: [
      'Monitor each road status (Passable / Warning / Inundated)',
      'Identify safe alternative evacuation routes',
      'Estimate recovery time for each road',
      'Link traffic data to flood level',
    ],
    goalsAr: [
      'مراقبة حالة كل طريق (سالك / تحذير / مغمور)',
      'تحديد مسارات الإخلاء الآمنة البديلة',
      'تقدير وقت استعادة كل طريق',
      'ربط بيانات المرور بمستوى الفيضان',
    ],
    audienceEn: 'Traffic police, evacuation teams, crisis management centers',
    audienceAr: 'شرطة المرور، فرق الإخلاء، مراكز إدارة الأزمات',
    dataSource: 'OSM Overpass · Open-Meteo · TomTom Traffic',
  },
  drainage: {
    titleEn: 'Drainage Network & Soil',
    titleAr: 'شبكة الصرف والتربة',
    summaryEn: 'Interactive map of drainage stations and their load levels — identifies bottlenecks before flooding occurs.',
    summaryAr: 'خريطة تفاعلية لمحطات الصرف ومستويات حملها — تحدد الاختناقات قبل وقوع الفيضانات.',
    goalsEn: [
      'Monitor each drainage station load (Normal / Overloaded / Critical)',
      'Identify bottlenecks in the drainage network',
      'Analyze soil permeability and its drainage impact',
      'Support preventive maintenance decisions',
    ],
    goalsAr: [
      'مراقبة حمل كل محطة صرف (طبيعي / مثقل / حرج)',
      'تحديد الاختناقات في شبكة الصرف',
      'تحليل نفاذية التربة وتأثيرها على الصرف',
      'دعم قرارات الصيانة الوقائية',
    ],
    audienceEn: 'Drainage engineers, Abu Dhabi Municipality, ADWEA',
    audienceAr: 'مهندسو الصرف، بلدية أبوظبي، أدويا',
    dataSource: 'OSM · Drainage station data · Soil models',
  },
  'uncertainty-map': {
    titleEn: 'Blind Spots Map',
    titleAr: 'خريطة عدم اليقين',
    summaryEn: 'Identifies areas lacking sufficient data or suffering from high prediction uncertainty — a tool for improving monitoring coverage.',
    summaryAr: 'يحدد المناطق التي تفتقر إلى بيانات كافية أو تعاني من ارتفاع عدم اليقين في التنبؤ — أداة لتحسين تغطية الرصد.',
    goalsEn: [
      'Monitor gaps in station network coverage',
      'Identify uncertainty zones in prediction models',
      'Guide new station deployment decisions',
      'Assess data quality geographically',
    ],
    goalsAr: [
      'رصد الثغرات في تغطية شبكة المحطات',
      'تحديد مناطق عدم اليقين في نماذج التنبؤ',
      'توجيه قرارات نشر محطات جديدة',
      'تقييم جودة البيانات جغرافياً',
    ],
    audienceEn: 'Data scientists, monitoring network planners',
    audienceAr: 'علماء البيانات، مخططو شبكات الرصد',
    dataSource: 'Internal analysis · NCM station data',
  },

  // ── Analysis & Prediction ────────────────────────────────────────────────────
  regions: {
    titleEn: 'Regions Analysis',
    titleAr: 'مستكشف المناطق',
    summaryEn: 'Detailed comparison between Abu Dhabi Emirate regions — evaluates risk level, precipitation, and infrastructure performance per region.',
    summaryAr: 'مقارنة تفصيلية بين مناطق إمارة أبوظبي — يقيّم مستوى الخطر والهطول وأداء البنية التحتية لكل منطقة.',
    goalsEn: [
      'Compare risk indicators between Abu Dhabi, Al Ain, and Al Dhafra',
      'Track situation evolution over time per region',
      'Identify regions with highest intervention priority',
      'Produce regional reports for relevant authorities',
    ],
    goalsAr: [
      'مقارنة مؤشرات الخطر بين أبوظبي والعين والظفرة',
      'تتبع تطور الوضع عبر الزمن لكل منطقة',
      'تحديد المناطق ذات أعلى أولوية للتدخل',
      'إنتاج تقارير إقليمية للجهات المعنية',
    ],
    audienceEn: 'Decision makers, municipal councils, planning departments',
    audienceAr: 'صانعو القرار، المجالس البلدية، دوائر التخطيط',
    dataSource: 'Open-Meteo · Copernicus · NCM',
  },
  scenarios: {
    titleEn: 'Scenario Simulation',
    titleAr: 'محاكاة السيناريو',
    summaryEn: 'Prediction engine running hypothetical scenarios (heavy rainfall, drainage failure, storm surge) to estimate future impact.',
    summaryAr: 'محرك تنبؤي يشغّل سيناريوهات افتراضية (هطول شديد، عطل صرف، موجة عاصفة) لتقدير التأثير المستقبلي.',
    goalsEn: [
      'Simulate extreme rainfall scenarios (25/50/100-year return)',
      'Estimate inundation area and affected population',
      'Test effectiveness of proposed mitigation measures',
      'Support long-term strategic planning',
    ],
    goalsAr: [
      'محاكاة سيناريوهات الهطول الشديد (تكرار 25/50/100 سنة)',
      'تقدير مساحة الغمر والسكان المتضررين',
      'اختبار فعالية تدابير التخفيف المقترحة',
      'دعم التخطيط الاستراتيجي طويل المدى',
    ],
    audienceEn: 'Strategic planners, hydrological engineers',
    audienceAr: 'المخططون الاستراتيجيون، مهندسو الهيدرولوجيا',
    dataSource: 'HEC-RAS models · Open-Meteo · SRTM DEM',
  },
  archive: {
    titleEn: 'Historical Archive',
    titleAr: 'الأرشيف التاريخي',
    summaryEn: 'Comprehensive database of rain and flood events in Abu Dhabi Emirate from 2011 to 2024.',
    summaryAr: 'قاعدة بيانات شاملة لأحداث الأمطار والفيضانات في إمارة أبوظبي من 2011 إلى 2024.',
    goalsEn: [
      'Document 13+ years of recorded flood events',
      'Analyze seasonal patterns and historical cycles',
      'Compare current events with similar historical events',
      'Extract lessons to improve future preparedness',
    ],
    goalsAr: [
      'توثيق أكثر من 13 سنة من أحداث الفيضانات المسجلة',
      'تحليل الأنماط الموسمية والدورات التاريخية',
      'مقارنة الأحداث الراهنة بالأحداث التاريخية المشابهة',
      'استخلاص الدروس لتحسين الاستعداد المستقبلي',
    ],
    audienceEn: 'Researchers, emergency planners, policy makers',
    audienceAr: 'الباحثون، مخططو الطوارئ، صانعو السياسات',
    dataSource: 'NCM · Copernicus CEMS · Civil Defense reports',
  },
  reports: {
    titleEn: 'Reports',
    titleAr: 'التقارير',
    summaryEn: 'Automatic PDF report generator — produces executive summaries and detailed reports ready for official submission.',
    summaryAr: 'مولّد تقارير PDF تلقائي — ينتج ملخصات تنفيذية وتقارير مفصلة جاهزة للتقديم الرسمي.',
    goalsEn: [
      'Generate instant status reports with one click',
      'Include maps, indicators, and recommendations',
      'Support periodic reports (daily / weekly / monthly)',
      'Official format ready for government correspondence',
    ],
    goalsAr: [
      'إنشاء تقارير الحالة الفورية بنقرة واحدة',
      'تضمين الخرائط والمؤشرات والتوصيات',
      'دعم التقارير الدورية (يومي / أسبوعي / شهري)',
      'تنسيق رسمي جاهز للمراسلات الحكومية',
    ],
    audienceEn: 'Senior management, regulatory bodies, media',
    audienceAr: 'الإدارة العليا، الجهات التنظيمية، الإعلام',
    dataSource: 'Aggregated platform data',
  },
  'decision-support': {
    titleEn: 'Decision Support Center',
    titleAr: 'مركز دعم القرار',
    summaryEn: 'AI engine that analyzes live data and issues practical priority-ranked recommendations for decision makers.',
    summaryAr: 'محرك ذكاء اصطناعي يحلل البيانات الحية ويصدر توصيات عملية مرتبة حسب الأولوية لصانعي القرار.',
    goalsEn: [
      'Analyze current situation and classify risk level',
      'Issue immediate priority-ranked intervention recommendations',
      'Estimate required resources (teams, equipment, routes)',
      'Document decisions made and track their implementation',
    ],
    goalsAr: [
      'تحليل الوضع الراهن وتصنيف مستوى الخطر',
      'إصدار توصيات تدخل فورية مرتبة حسب الأولوية',
      'تقدير الموارد المطلوبة (فرق، معدات، مسارات)',
      'توثيق القرارات المتخذة وتتبع تنفيذها',
    ],
    audienceEn: 'Operations leaders, crisis centers, relevant ministries',
    audienceAr: 'قادة العمليات، مراكز الأزمات، الوزارات المعنية',
    dataSource: 'Integrated analysis of all data sources',
  },
  'field-validation': {
    titleEn: 'Smart Field Lens',
    titleAr: 'العدسة الذكية الميدانية',
    summaryEn: 'Field verification tool — compares sensory data from the field with prediction models to improve system accuracy.',
    summaryAr: 'أداة التحقق الميداني — تقارن البيانات الحسية من الميدان مع نماذج التنبؤ لتحسين دقة النظام.',
    goalsEn: [
      'Upload field photos and analyze them with AI',
      'Compare field reality with model predictions',
      'Correct model deviations with real-world data',
      'Build a verification database to improve future accuracy',
    ],
    goalsAr: [
      'رفع صور ميدانية وتحليلها بالذكاء الاصطناعي',
      'مقارنة الواقع الميداني بتنبؤات النموذج',
      'تصحيح انحرافات النموذج ببيانات الواقع',
      'بناء قاعدة بيانات تحقق لتحسين الدقة المستقبلية',
    ],
    audienceEn: 'Field teams, model engineers',
    audienceAr: 'الفرق الميدانية، مهندسو النماذج',
    dataSource: 'Field photos · IoT sensor data',
  },
  accuracy: {
    titleEn: 'Model Accuracy Dashboard',
    titleAr: 'لوحة دقة النموذج',
    summaryEn: 'Predictive model performance indicators — evaluates prediction accuracy against actual events to ensure reliability.',
    summaryAr: 'مؤشرات أداء النموذج التنبؤي — يقيّم دقة التنبؤ مقابل الأحداث الفعلية لضمان الموثوقية.',
    goalsEn: [
      'Measure precipitation prediction accuracy (MAE, RMSE)',
      'Track model improvement over time',
      'Identify low-accuracy regions',
      'Compare performance of different models',
    ],
    goalsAr: [
      'قياس دقة تنبؤ الهطول (MAE، RMSE)',
      'تتبع تحسن النموذج عبر الزمن',
      'تحديد المناطق ذات الدقة المنخفضة',
      'مقارنة أداء النماذج المختلفة',
    ],
    audienceEn: 'Data scientists, model developers',
    audienceAr: 'علماء البيانات، مطورو النماذج',
    dataSource: 'Model predictions vs. actual measurements',
  },
  glossary: {
    titleEn: 'Indicator Glossary',
    titleAr: 'الفهرس التعريفي',
    summaryEn: 'Complete reference for all platform indicators — explains calculation methods, thresholds, and data sources for every metric.',
    summaryAr: 'مرجع شامل لجميع مؤشرات المنصة — يشرح طرق الاحتساب والعتبات ومصادر البيانات لكل مقياس.',
    goalsEn: [
      'Understand what each number means and how it is calculated',
      'Learn the classification thresholds (Warning / Critical)',
      'Identify data sources for each indicator',
      'Reference guide for new users and decision makers',
    ],
    goalsAr: [
      'فهم معنى كل رقم وطريقة احتسابه',
      'التعرف على عتبات التصنيف (تحذير / حرج)',
      'تحديد مصادر البيانات لكل مؤشر',
      'دليل مرجعي للمستخدمين الجدد وصانعي القرار',
    ],
    audienceEn: 'All users — especially new users and decision makers',
    audienceAr: 'جميع المستخدمين — خاصةً المستخدمون الجدد وصانعو القرار',
    dataSource: 'Open-Meteo · NASA SRTM · ESA Copernicus · OSM',
  },
};

// ─── Tooltip Component ────────────────────────────────────────────────────────
interface NavTooltipProps {
  pageKey: string;
  size?: number;
  position?: 'left' | 'right' | 'top' | 'bottom';
}

export default function NavTooltip({ pageKey, size = 12, position = 'left' }: NavTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const { lang } = useLanguage();
  const isRtl = lang === 'ar';
  const info = PAGE_INFO[pageKey];

  if (!info) return null;

  const title = isRtl ? info.titleAr : info.titleEn;
  const summary = isRtl ? info.summaryAr : info.summaryEn;
  const goals = isRtl ? info.goalsAr : info.goalsEn;
  const audience = isRtl ? info.audienceAr : info.audienceEn;

  function show() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setCoords({ x: rect.left, y: rect.top + rect.height / 2 });
    setVisible(true);
  }

  function hide() { setVisible(false); }

  const tooltipWidth = 300;
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    width: tooltipWidth,
    background: 'linear-gradient(135deg, #0D1220 0%, #111827 100%)',
    border: '1px solid rgba(27,79,138,0.45)',
    borderRadius: 10,
    padding: '12px 14px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(27,79,138,0.1)',
    direction: isRtl ? 'rtl' : 'ltr',
    fontFamily: isRtl ? "'Noto Naskh Arabic', serif" : "'Space Grotesk', 'Inter', sans-serif",
    pointerEvents: 'none',
    top: coords.y - 20,
    ...(position === 'left'
      ? { right: window.innerWidth - coords.x + 8 }
      : { left: coords.x + 20 }),
  };

  return (
    <>
      <span
        ref={btnRef as any}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={e => e.stopPropagation()}
        className="flex-shrink-0 opacity-40 hover:opacity-90 transition-opacity"
        style={{ lineHeight: 1, cursor: 'help', padding: 0, display: 'inline-flex', alignItems: 'center' }}
        role="button"
        tabIndex={0}
        aria-label={`Info: ${title}`}
      >
        <HelpCircle size={size} color="rgba(96,165,250,0.9)" />
      </span>

      {visible && createPortal(
        <div style={tooltipStyle}>
          {/* Title */}
          <div style={{
            fontWeight: 700, fontSize: '13px', marginBottom: '6px', color: '#60A5FA',
            fontFamily: isRtl ? "'Noto Naskh Arabic', serif" : "'Space Grotesk', sans-serif",
          }}>
            {title}
          </div>

          {/* Summary */}
          <p style={{
            fontSize: isRtl ? '12px' : '11px', lineHeight: 1.6, marginBottom: '10px',
            color: 'rgba(255,255,255,0.65)', margin: '0 0 10px',
            fontFamily: isRtl ? "'Noto Naskh Arabic', serif" : 'inherit',
          }}>
            {summary}
          </p>

          {/* Goals */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{
              fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', marginBottom: '6px',
              color: 'rgba(255,255,255,0.3)',
              fontFamily: isRtl ? "'Noto Naskh Arabic', serif" : 'inherit',
            }}>
              {isRtl ? 'الأهداف' : 'Objectives'}
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {goals.map((g, i) => (
                <li key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '6px',
                  fontSize: isRtl ? '11px' : '10px', color: 'rgba(255,255,255,0.55)',
                  fontFamily: isRtl ? "'Noto Naskh Arabic', serif" : 'inherit',
                }}>
                  <span style={{ color: '#34D399', flexShrink: 0, marginTop: 2 }}>◆</span>
                  {g}
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <div style={{
            paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', flexDirection: 'column', gap: '4px',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: isRtl ? '11px' : '9px', color: 'rgba(255,255,255,0.35)',
              fontFamily: isRtl ? "'Noto Naskh Arabic', serif" : 'inherit',
            }}>
              <span style={{ color: '#A78BFA' }}>👥</span>
              <span>{audience}</span>
            </div>
            {info.dataSource && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '9px', color: 'rgba(255,255,255,0.25)',
                fontFamily: 'Space Mono, monospace',
              }}>
                <span style={{ color: '#60A5FA' }}>🌐</span>
                <span>{info.dataSource}</span>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
