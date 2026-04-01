import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'ar' | 'en';

interface LanguageContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
  dir: 'rtl' | 'ltr';
}

const translations: Record<string, Record<Language, string>> = {
  // Navigation
  'nav.dashboard': { ar: 'لوحة القيادة', en: 'Command Dashboard' },
  'nav.alerts': { ar: 'التنبيهات', en: 'Alerts' },
  'nav.map': { ar: 'مركز الخريطة الموحدة', en: 'Unified Map Center' },
  'nav.dem': { ar: 'ارتفاع التضاريس', en: 'DEM Elevation' },
  'nav.roads': { ar: 'الطرق والمرور', en: 'Roads & Traffic' },
  'nav.drainage': { ar: 'الصرف والتربة', en: 'Drainage & Soil' },
  'nav.uncertainty': { ar: 'خريطة عدم اليقين', en: 'Uncertainty Map' },
  'nav.regions': { ar: 'مستكشف المناطق', en: 'Regions Explorer' },
  'nav.simulation': { ar: 'محاكاة السيناريو', en: 'Scenario Simulation' },
  'nav.heatmap': { ar: 'خريطة الحرارة', en: 'Heat Map' },
  'nav.regionsAnalysis': { ar: 'تحليل المناطق', en: 'Regions Analysis' },
  'nav.archive': { ar: 'الأرشيف التاريخي', en: 'Historical Archive' },
  'nav.reports': { ar: 'التقارير', en: 'Reports' },
  'nav.industrial': { ar: 'المناطق الصناعية', en: 'Industrial Zones' },
  'nav.ai': { ar: 'نماذج الذكاء الاصطناعي', en: 'AI Models' },
  'nav.field': { ar: 'التحقق الميداني', en: 'Field Validation' },
  'nav.accuracy': { ar: 'لوحة الدقة', en: 'Accuracy Board' },
  'nav.decision': { ar: 'دعم القرار', en: 'Decision Support' },
  'nav.smartlens': { ar: 'العدسة الذكية', en: 'Smart Field Lens' },
  'nav.satellites': { ar: 'الأقمار الصناعية', en: 'Satellites' },
  'nav.release': { ar: 'ملاحظات الإصدار', en: 'Release Notes' },
  // Section labels
  'section.live_monitoring': { ar: 'المراقبة الحية', en: 'LIVE MONITORING' },
  'section.maps': { ar: 'الخرائط والرصد', en: 'MAPS & MONITORING' },
  'section.analysis': { ar: 'التحليل والتنبؤ', en: 'ANALYSIS & PREDICTION' },
  'section.decision': { ar: 'دعم القرار', en: 'DECISION SUPPORT' },
  'section.technology': { ar: 'التقنية والبنية', en: 'TECHNOLOGY' },
  // Header
  'header.live': { ar: 'مباشر', en: 'LIVE' },
  'header.offline': { ar: 'غير متصل', en: 'OFFLINE' },
  'header.stars': { ar: 'أقمار', en: 'Sats' },
  'header.safe': { ar: 'جميع المناطق آمنة', en: 'All zones are safe' },
  'header.warning': { ar: 'تحذير نشط', en: 'Active Warning' },
  'header.updated': { ar: 'آخر تحديث', en: 'Last updated' },
  // Common
  'common.safe': { ar: 'آمن', en: 'Safe' },
  'common.warning': { ar: 'تحذير', en: 'Warning' },
  'common.critical': { ar: 'حرج', en: 'Critical' },
  'common.recovery': { ar: 'استعادة نشطة', en: 'Active Recovery' },
  'common.loading': { ar: 'جارٍ التحميل...', en: 'Loading...' },
  'common.source': { ar: 'المصدر', en: 'Source' },
  'common.refresh': { ar: 'تحديث', en: 'Refresh' },
  'common.export': { ar: 'تصدير', en: 'Export' },
  'common.filter': { ar: 'تصفية', en: 'Filter' },
  'common.all': { ar: 'الكل', en: 'All' },
  'common.search': { ar: 'بحث...', en: 'Search...' },
  'common.close': { ar: 'إغلاق', en: 'Close' },
  'common.details': { ar: 'التفاصيل', en: 'Details' },
  'common.zone': { ar: 'المنطقة', en: 'Zone' },
  'common.depth': { ar: 'العمق', en: 'Depth' },
  'common.risk': { ar: 'المخاطرة', en: 'Risk' },
  'common.precip': { ar: 'هطول الأمطار', en: 'Precipitation' },
  'common.speed': { ar: 'السرعة', en: 'Speed' },
  'common.roads': { ar: 'الطرق', en: 'Roads' },
  'common.areas': { ar: 'المناطق', en: 'Areas' },
  'common.both': { ar: 'كلاهما', en: 'Both' },
  'common.now': { ar: 'الآن', en: 'Now' },
  'common.hours': { ar: 'ساعات', en: 'hours' },
  'common.mm': { ar: 'ملم', en: 'mm' },
  'common.cm': { ar: 'سم', en: 'cm' },
  'common.kmh': { ar: 'كم/س', en: 'km/h' },
  'common.live': { ar: 'مباشر', en: 'Live' },
  'common.average': { ar: 'متوسط', en: 'Average' },
  'common.high': { ar: 'عالٍ', en: 'High' },
  'common.low': { ar: 'منخفض', en: 'Low' },
  'common.medium': { ar: 'متوسط', en: 'Medium' },
  'common.status': { ar: 'الحالة', en: 'Status' },
  'common.date': { ar: 'التاريخ', en: 'Date' },
  'common.time': { ar: 'الوقت', en: 'Time' },
  'common.region': { ar: 'المنطقة', en: 'Region' },
  'common.value': { ar: 'القيمة', en: 'Value' },
  'common.type': { ar: 'النوع', en: 'Type' },
  'common.name': { ar: 'الاسم', en: 'Name' },
  'common.save': { ar: 'حفظ', en: 'Save' },
  'common.cancel': { ar: 'إلغاء', en: 'Cancel' },
  'common.confirm': { ar: 'تأكيد', en: 'Confirm' },
  'common.back': { ar: 'رجوع', en: 'Back' },
  'common.next': { ar: 'التالي', en: 'Next' },
  'common.prev': { ar: 'السابق', en: 'Previous' },
  'common.yes': { ar: 'نعم', en: 'Yes' },
  'common.no': { ar: 'لا', en: 'No' },
  'common.error': { ar: 'خطأ', en: 'Error' },
  'common.success': { ar: 'نجاح', en: 'Success' },
  'common.noData': { ar: 'لا توجد بيانات', en: 'No data' },
  'common.updated': { ar: 'محدّث', en: 'Updated' },
  'common.dataSource': { ar: 'مصدر البيانات', en: 'DATA SOURCE' },
  'common.updateEvery': { ar: 'تحديث كل 15 دقيقة', en: 'Update Every 15 minutes' },
  'common.alert': { ar: 'تنبيه', en: 'alert' },
  // Dashboard
  'dashboard.title': { ar: 'لوحة القيادة الرئيسية', en: 'Main Dashboard' },
  'dashboard.subtitle': { ar: 'رصد الفيضانات · إمارة أبوظبي · الوقت الفعلي', en: 'FLOOD MONITORING · EMIRATE OF ABU DHABI · REAL-TIME' },
  'dashboard.maxRisk': { ar: 'أقصى مؤشر مخاطر', en: 'Max Risk Index' },
  'dashboard.avgTemp': { ar: 'متوسط درجة الحرارة', en: 'Average Temperature' },
  'dashboard.maxRainfall': { ar: 'أقصى هطول (24 ساعة)', en: 'Max Rainfall (24hr)' },
  'dashboard.activeAlerts': { ar: 'التنبيهات النشطة', en: 'Active Alerts' },
  'dashboard.peakRegion': { ar: 'المنطقة الأعلى · 24 ساعة', en: 'PEAK REGION · 24H' },
  'dashboard.avgAbuDhabi': { ar: 'متوسط · إمارة أبوظبي', en: 'AVG · ABU DHABI EMIRATE' },
  'dashboard.precip_total': { ar: 'إجمالي هطول الأمطار', en: 'Total Precipitation' },
  'dashboard.affected_roads': { ar: 'الطرق المتضررة', en: 'Affected Roads' },
  'dashboard.warning_zones': { ar: 'مناطق التحذير', en: 'Warning Zones' },
  'dashboard.critical_zones': { ar: 'المناطق الحرجة', en: 'Critical Zones' },
  'dashboard.precip_chart': { ar: 'هطول الأمطار — 48 ساعة', en: 'Precipitation — 48 Hours' },
  'dashboard.risk_chart': { ar: 'المخاطر وهطول الأمطار حسب المنطقة', en: 'Risk & Precipitation by Zone' },
  'dashboard.speed_chart': { ar: 'السرعة المتوقعة حسب المنطقة (كم/س)', en: 'Expected Speed by Zone (km/h)' },
  'dashboard.quickAccess': { ar: 'وصول سريع', en: 'Quick Access' },
  'dashboard.executiveBriefing': { ar: 'الإحاطة التنفيذية — الوضع الراهن', en: 'Executive Briefing — Current Status' },
  'dashboard.executiveSummary': { ar: 'الملخص التنفيذي', en: 'Executive Summary' },
  'dashboard.statusControl': { ar: 'الوضع تحت السيطرة — استمر في المراقبة الروتينية', en: 'Status under control — continue routine monitoring' },
  'dashboard.highestRisk': { ar: 'أعلى منطقة خطورة', en: 'Region Highest Risk' },
  'dashboard.rainfallSub': { ar: 'هطول / 24 ساعة', en: 'Rainfall / 24hr' },
  'dashboard.liveData': { ar: 'بيانات مباشرة', en: 'LIVE DATA' },
  'dashboard.exportPdf': { ar: 'تصدير PDF', en: 'EXPORT PDF' },
  // Decision Support
  'decision.title': { ar: 'دعم القرار', en: 'Decision Support' },
  'decision.subtitle': { ar: 'نظام ذاكرة الفيضانات — حالة التعافي والصرف', en: 'Flood Memory System — Recovery & Drainage Status' },
  'decision.flood_memory': { ar: 'ذاكرة الفيضانات', en: 'Flood Memory' },
  'decision.drainage_lag': { ar: 'تأخر الصرف', en: 'Drainage Lag' },
  'decision.soil_saturation': { ar: 'تشبع التربة', en: 'Soil Saturation' },
  'decision.recovery_time': { ar: 'وقت التعافي المتوقع', en: 'Expected Recovery Time' },
  'decision.active_recovery': { ar: 'تعافٍ نشط — المياه لم تُصرف بعد', en: 'Active Recovery — Water not drained yet' },
  'decision.data_sources': { ar: 'مصادر البيانات', en: 'Data Sources' },
  // Field Validation
  'field.title': { ar: 'التحقق الميداني', en: 'Field Validation' },
  'field.subtitle': { ar: 'مقارنة النموذج مع الواقع الميداني', en: 'Model vs Field Reality Comparison' },
  'field.accuracy': { ar: 'دقة النموذج', en: 'Model Accuracy' },
  'field.gap': { ar: 'الفجوة الزمنية', en: 'Time Gap' },
  'field.model': { ar: 'النموذج', en: 'Model' },
  'field.reality': { ar: 'الواقع الفعلي', en: 'Actual Reality' },
  'field.add_report': { ar: 'إضافة تقرير ميداني', en: 'Add Field Report' },
  // Archive
  'archive.title': { ar: 'الأرشيف التاريخي — أحداث الأمطار والفيضانات', en: 'Historical Archive — Rain & Flood Events' },
  'archive.subtitle': { ar: 'إمارة أبوظبي · 2011–2024', en: 'Emirate of Abu Dhabi · 2011–2024' },
  'archive.before': { ar: 'قبل', en: 'Before' },
  'archive.during': { ar: 'أثناء', en: 'During' },
  'archive.after': { ar: 'بعد', en: 'After' },
  'archive.severity': { ar: 'الشدة', en: 'Severity' },
  'archive.exceptional': { ar: 'استثنائي', en: 'Exceptional' },
  'archive.high': { ar: 'عالٍ', en: 'High' },
  'archive.medium': { ar: 'متوسط', en: 'Medium' },
  'archive.low': { ar: 'منخفض', en: 'Low' },
  'archive.affected_areas': { ar: 'المناطق المتضررة', en: 'Affected Areas' },
  'archive.economic_loss': { ar: 'الخسائر الاقتصادية', en: 'Economic Loss' },
  'archive.duration': { ar: 'المدة', en: 'Duration' },
  'archive.max_depth': { ar: 'أقصى عمق', en: 'Max Depth' },
  'archive.event_location': { ar: 'موقع الحدث', en: 'Event Location' },
  'archive.comparison': { ar: 'مقارنة الأحداث — إجمالي هطول الأمطار (ملم)', en: 'Events Comparison — Total Precipitation (mm)' },
  // Alerts
  'alerts.title': { ar: 'التنبيهات', en: 'Alerts' },
  'alerts.noAlerts': { ar: 'لا توجد تنبيهات نشطة', en: 'No active alerts' },
  'alerts.critical': { ar: 'حرج', en: 'Critical' },
  'alerts.warning': { ar: 'تحذير', en: 'Warning' },
  'alerts.info': { ar: 'معلومات', en: 'Info' },
  // Map
  'map.title': { ar: 'مركز الخريطة الموحدة', en: 'Unified Map Center' },
  'map.layers': { ar: 'الطبقات', en: 'Layers' },
  'map.flood': { ar: 'طبقة الفيضانات', en: 'Flood Layer' },
  'map.roads': { ar: 'طبقة الطرق', en: 'Roads Layer' },
  'map.drainage': { ar: 'طبقة الصرف', en: 'Drainage Layer' },
  'map.satellite': { ar: 'صور الأقمار الصناعية', en: 'Satellite Imagery' },
  // Reports
  'reports.title': { ar: 'التقارير', en: 'Reports' },
  'reports.generate': { ar: 'إنشاء تقرير', en: 'Generate Report' },
  'reports.download': { ar: 'تحميل', en: 'Download' },
  'reports.period': { ar: 'الفترة الزمنية', en: 'Time Period' },
  // Simulation
  'simulation.title': { ar: 'محاكاة السيناريو', en: 'Scenario Simulation' },
  'simulation.run': { ar: 'تشغيل المحاكاة', en: 'Run Simulation' },
  'simulation.reset': { ar: 'إعادة تعيين', en: 'Reset' },
  'simulation.intensity': { ar: 'شدة الأمطار', en: 'Rain Intensity' },
  'simulation.duration': { ar: 'المدة', en: 'Duration' },
  // Satellites
  'satellites.title': { ar: 'الأقمار الصناعية', en: 'Satellites' },
  'satellites.active': { ar: 'نشط', en: 'Active' },
  'satellites.coverage': { ar: 'التغطية', en: 'Coverage' },
  'satellites.lastPass': { ar: 'آخر مرور', en: 'Last Pass' },
  // AI Models
  'ai.title': { ar: 'نماذج الذكاء الاصطناعي', en: 'AI Models' },
  'ai.accuracy': { ar: 'الدقة', en: 'Accuracy' },
  'ai.precision': { ar: 'الدقة التفصيلية', en: 'Precision' },
  'ai.recall': { ar: 'الاستدعاء', en: 'Recall' },
  'ai.f1': { ar: 'مقياس F1', en: 'F1 Score' },
  // Smart Lens
  'smartlens.title': { ar: 'العدسة الذكية الميدانية', en: 'Smart Field Lens' },
  'smartlens.upload': { ar: 'رفع صورة', en: 'Upload Image' },
  'smartlens.analyze': { ar: 'تحليل', en: 'Analyze' },
  'smartlens.result': { ar: 'نتيجة التحليل', en: 'Analysis Result' },
  // DEM
  'dem.title': { ar: 'نموذج الارتفاع الرقمي', en: 'DEM Elevation' },
  'dem.elevation': { ar: 'الارتفاع', en: 'Elevation' },
  'dem.slope': { ar: 'الانحدار', en: 'Slope' },
  'dem.flow': { ar: 'اتجاه التدفق', en: 'Flow Direction' },
  // Drainage
  'drainage.title': { ar: 'الصرف والتربة', en: 'Drainage & Soil' },
  'drainage.capacity': { ar: 'طاقة الصرف', en: 'Drainage Capacity' },
  'drainage.saturation': { ar: 'تشبع التربة', en: 'Soil Saturation' },
  'drainage.permeability': { ar: 'نفاذية التربة', en: 'Soil Permeability' },
  // Regions
  'regions.title': { ar: 'مستكشف المناطق', en: 'Regions Explorer' },
  'regions.count': { ar: 'عدد المناطق', en: 'Regions Count' },
  'regions.monitored': { ar: 'منطقة مراقبة', en: 'Monitored Regions' },
  // Uncertainty
  'uncertainty.title': { ar: 'خريطة عدم اليقين', en: 'Uncertainty Map' },
  'uncertainty.confidence': { ar: 'مستوى الثقة', en: 'Confidence Level' },
  // Roads
  'roads.title': { ar: 'الطرق والمرور', en: 'Roads & Traffic' },
  'roads.affected': { ar: 'طرق متضررة', en: 'Affected Roads' },
  'roads.closed': { ar: 'مغلقة', en: 'Closed' },
  'roads.congested': { ar: 'مزدحمة', en: 'Congested' },
  'roads.clear': { ar: 'سالكة', en: 'Clear' },
  // Release Notes
  'release.title': { ar: 'ملاحظات الإصدار', en: 'Release Notes' },
  'release.version': { ar: 'الإصدار', en: 'Version' },
  'release.date': { ar: 'التاريخ', en: 'Date' },
  'release.changes': { ar: 'التغييرات', en: 'Changes' },
  // Accuracy
  'accuracy.title': { ar: 'لوحة الدقة', en: 'Accuracy Dashboard' },
  'accuracy.model': { ar: 'دقة النموذج', en: 'Model Accuracy' },
  'accuracy.field': { ar: 'التحقق الميداني', en: 'Field Verification' },
  // Heatmap
  'heatmap.title': { ar: 'خريطة الحرارة', en: 'Heat Map' },
  'heatmap.intensity': { ar: 'الكثافة', en: 'Intensity' },
  // Executive summary roles
  'role.ops': { ar: 'عمليات', en: 'Ops' },
  'role.mgr': { ar: 'مدير', en: 'Mgr' },
  'role.exec': { ar: 'تنفيذي', en: 'Exec' },
  // Dashboard extra
  'dashboard.rainfall24h': { ar: 'هطول / 24 ساعة', en: 'Rainfall / 24hr' },
  'dashboard.highestRiskRegion': { ar: 'المنطقة الأعلى خطورة', en: 'Region Highest Risk' },
  'dashboard.statusCritical': { ar: 'يُنصح بتفعيل بروتوكول الطوارئ فوراً', en: 'Activating emergency response protocol is recommended immediately' },
  'dashboard.statusHigh': { ar: 'مطلوب مراقبة مستمرة — تحقق من مناطق الخطر', en: 'Continuous monitoring required — verify danger zones' },
  'dashboard.statusSafe': { ar: 'الوضع تحت السيطرة — استمر في المراقبة الروتينية', en: 'Status under control — continue routine monitoring' },
  'dashboard.rainfall48h': { ar: 'هطول الأمطار — 48 ساعة', en: 'Rainfall — 48 Hours' },
  'dashboard.alertStatus': { ar: 'حالة التنبيهات', en: 'Alert Status' },
  'dashboard.allRegionsSafe': { ar: 'جميع المناطق آمنة', en: 'All regions safe' },
  'dashboard.noActiveAlerts': { ar: 'لا تنبيهات نشطة', en: 'NO ACTIVE ALERTS' },
  'dashboard.floodRiskTrend': { ar: 'مؤشر خطر الفيضانات — آخر 7 أيام', en: 'Flood Risk Index — Last 7 Days' },
  'dashboard.lastPointLive': { ar: 'آخر نقطة: بيانات حية من Open-Meteo', en: 'Last point: live real data from Open-Meteo API' },
  'dashboard.regionStatus': { ar: 'حالة المناطق — بيانات مباشرة', en: 'Region Status — Live Data' },
  'dashboard.systemStats': { ar: 'نظام مراقبة الأقمار الصناعية — إمارة أبوظبي', en: 'Satellite Monitoring System — Abu Dhabi Emirate' },
  'dashboard.coverageArea': { ar: 'مساحة التغطية', en: 'COVERAGE AREA' },
  'dashboard.satCoverage': { ar: 'تغطية الأقمار', en: 'SAT COVERAGE' },
  'dashboard.updateInterval': { ar: 'تكرار التحديث', en: 'UPDATE INTERVAL' },
  'dashboard.modelAccuracy': { ar: 'دقة النموذج', en: 'MODEL ACCURACY' },
  // Nav descriptions
  'nav.roadNetwork': { ar: 'شبكة الطرق', en: 'Road Network' },
  'nav.mapDesc': { ar: 'خرائط تفاعلية مباشرة', en: 'Live interactive maps' },
  'nav.demDesc': { ar: 'تحليل DEM + الهبوط', en: 'DEM + subsidence analysis' },
  'nav.roadNetworkDesc': { ar: 'تأثير الفيضانات على المرور', en: 'Flood impact on traffic' },
  'nav.decisionDesc': { ar: 'ذاكرة الفيضانات والتعافي', en: 'Flood memory and recovery' },
  'nav.archiveDesc': { ar: 'أحداث 2011–2024', en: 'Events 2011–2024' },
  'nav.simulationDesc': { ar: 'تنبؤ بسيناريوهات مستقبلية', en: 'Prediction with future scenarios' },
  'nav.uncertaintyDesc': { ar: 'مناطق تحتاج تحققاً ميدانياً', en: 'Regions needing field verification' },
  'nav.reportsDesc': { ar: 'تقارير PDF قابلة للتصدير', en: 'Exportable PDF reports' },
  // Common extra
  'common.rainfall': { ar: 'هطول', en: 'Rainfall' },
  'common.24h': { ar: '24 ساعة', en: '24 hour' },
  'common.temperature': { ar: 'درجة الحرارة', en: 'Temperature' },
};

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
  dir: 'ltr',
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    return (localStorage.getItem('floodsat-lang') as Language) || 'en';
  });

  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem('floodsat-lang', l);
  };

  const t = (key: string): string => {
    return translations[key]?.[lang] ?? translations[key]?.en ?? key;
  };

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
    if (lang === 'ar') {
      document.documentElement.classList.add('rtl');
      document.documentElement.classList.remove('ltr');
    } else {
      document.documentElement.classList.add('ltr');
      document.documentElement.classList.remove('rtl');
    }
  }, [lang, dir]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
