/**
 * HistoricalArchivePage.tsx — أرشيف الأمطار والفيضانات التاريخي
 * بيانات ERA5 حقيقية من Open-Meteo من 2015 حتى اليوم
 * فلاتر بسيطة: المدينة | السنة | المقارنة
 */
import { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Legend,
} from 'recharts';
import {
  Calendar, Droplets, AlertTriangle, TrendingUp,
  Filter, RefreshCw, Info, MapPin, Zap,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/useMobile';

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CITY_COLORS: Record<string, string> = {
  abudhabi: '#00d4ff',
  alain:    '#10B981',
  aldhafra: '#F59E0B',
};

const SEVERITY_COLOR = (mm: number) =>
  mm === 0 ? '#1e293b' :
  mm < 5   ? '#1d4ed8' :
  mm < 20  ? '#2563eb' :
  mm < 50  ? '#f59e0b' :
  mm < 100 ? '#ef4444' : '#7c3aed';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(13,17,23,0.97)', border: '1px solid rgba(0,212,255,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: '#94a3b8', marginBottom: 4, fontWeight: 700 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          <span>{p.name}: <b>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</b> mm</span>
        </div>
      ))}
    </div>
  );
};

export default function HistoricalArchivePage() {
  const { lang } = useLanguage();
  const isMobile = useIsMobile();
  const ar = lang === 'ar';

  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [yearA, setYearA] = useState<number | null>(null);
  const [yearB, setYearB] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'annual' | 'monthly' | 'compare' | 'events'>('annual');

  const { data: result, isLoading, error, refetch } = trpc.historical.getData.useQuery(
    undefined,
    { staleTime: 30 * 60 * 1000, retry: 2 }
  );

  const hist = result?.success ? result.data : null;
  const availableYears = hist?.availableYears ?? [];
  const cities = hist?.cities ?? [];

  const filteredCities = useMemo(() =>
    selectedCity === 'all' ? cities : cities.filter((c: any) => c.city === selectedCity),
    [cities, selectedCity]
  );

  const annualData = useMemo(() => {
    if (!filteredCities.length) return [];
    return availableYears.map((year: number) => {
      const row: Record<string, any> = { year };
      filteredCities.forEach((city: any) => {
        const ys = city.years.find((y: any) => y.year === year);
        row[city.nameEn] = ys?.totalPrecip ?? 0;
        row[`${city.nameEn}_flood`] = ys?.floodEvents ?? 0;
      });
      return row;
    });
  }, [filteredCities, availableYears]);

  const selectedYear = yearA ?? (availableYears[availableYears.length - 1] ?? null);

  const monthlyData = useMemo(() => {
    if (!filteredCities.length || !selectedYear) return [];
    return MONTHS_EN.map((m, i) => {
      const row: Record<string, any> = { month: ar ? MONTHS_AR[i] : m };
      filteredCities.forEach((city: any) => {
        const ys = city.years.find((y: any) => y.year === selectedYear);
        row[city.nameEn] = ys?.monthlyTotals[i] ?? 0;
      });
      return row;
    });
  }, [filteredCities, selectedYear, ar]);

  const compareData = useMemo(() => {
    if (!yearA || !yearB || !filteredCities.length) return [];
    return MONTHS_EN.map((m, i) => {
      const row: Record<string, any> = { month: ar ? MONTHS_AR[i] : m };
      filteredCities.forEach((city: any) => {
        const ysA = city.years.find((y: any) => y.year === yearA);
        const ysB = city.years.find((y: any) => y.year === yearB);
        row[`${city.nameEn} ${yearA}`] = ysA?.monthlyTotals[i] ?? 0;
        row[`${city.nameEn} ${yearB}`] = ysB?.monthlyTotals[i] ?? 0;
      });
      return row;
    });
  }, [filteredCities, yearA, yearB, ar]);

  const topEvents = useMemo(() => {
    if (!cities.length) return [];
    const events: any[] = [];
    cities.forEach((city: any) => {
      city.years.forEach((ys: any) => {
        if (ys.maxDailyPrecip > 10) {
          events.push({
            city: ar ? city.nameAr : city.nameEn,
            cityColor: CITY_COLORS[city.city] ?? '#00d4ff',
            year: ys.year,
            date: ys.peakDate,
            precip: ys.maxDailyPrecip,
            floodEvents: ys.floodEvents,
            total: ys.totalPrecip,
          });
        }
      });
    });
    return events.sort((a, b) => b.precip - a.precip).slice(0, 15);
  }, [cities, ar]);

  const summaryStats = useMemo(() => {
    if (!filteredCities.length) return null;
    let totalRain = 0, maxDay = 0, totalFlood = 0, totalExtreme = 0, maxYear = 0, maxYearVal = 0;
    filteredCities.forEach((city: any) => {
      city.years.forEach((ys: any) => {
        totalRain += ys.totalPrecip;
        if (ys.maxDailyPrecip > maxDay) maxDay = ys.maxDailyPrecip;
        totalFlood += ys.floodEvents;
        totalExtreme += ys.extremeEvents;
        if (ys.totalPrecip > maxYearVal) { maxYearVal = ys.totalPrecip; maxYear = ys.year; }
      });
    });
    const count = filteredCities.reduce((s: number, c: any) => s + c.years.length, 0);
    return {
      avgAnnual: count > 0 ? (totalRain / count).toFixed(1) : '0',
      maxDay: maxDay.toFixed(1),
      totalFlood,
      totalExtreme,
      maxYear,
      maxYearVal: maxYearVal.toFixed(1),
    };
  }, [filteredCities]);

  const card = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: '14px 16px',
  };

  const tabBtn = (active: boolean) => ({
    padding: '7px 14px',
    borderRadius: 8,
    border: `1px solid ${active ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.07)'}`,
    background: active ? 'rgba(0,212,255,0.12)' : 'transparent',
    color: active ? '#00d4ff' : '#64748b',
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
    fontSize: isMobile ? 11 : 12,
    fontFamily: 'Tajawal, sans-serif',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap' as const,
  });

  const filterBtn = (active: boolean, color = '#00d4ff') => ({
    padding: '5px 10px',
    borderRadius: 7,
    border: `1px solid ${active ? color + '55' : 'rgba(255,255,255,0.07)'}`,
    background: active ? color + '18' : 'rgba(255,255,255,0.03)',
    color: active ? color : '#64748b',
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'Tajawal, sans-serif',
    transition: 'all 0.15s',
  });

  const selectStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: '#e2e8f0',
    fontSize: 11,
    padding: '5px 8px',
    fontFamily: 'Tajawal, sans-serif',
    cursor: 'pointer',
  };

  return (
    <div style={{
      minHeight: '100%',
      background: 'var(--bg-primary)',
      color: '#e2e8f0',
      fontFamily: 'Tajawal, sans-serif',
      direction: ar ? 'rtl' : 'ltr',
      padding: isMobile ? '12px' : '20px 24px',
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 17 : 21, fontWeight: 800, color: '#e2e8f0', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={isMobile ? 17 : 21} color="#00d4ff" />
            {ar ? 'الأرشيف التاريخي للأمطار والفيضانات' : 'Historical Rainfall & Flood Archive'}
          </h1>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
            {ar
              ? `بيانات ERA5 الحقيقية • 2015 – ${new Date().getFullYear()} • إمارة أبوظبي`
              : `Real ERA5 Data • 2015 – ${new Date().getFullYear()} • Abu Dhabi Emirate`}
          </div>
        </div>
        <button onClick={() => refetch()} style={{ ...filterBtn(false), display: 'flex', alignItems: 'center', gap: 4 }}>
          <RefreshCw size={12} />
          {ar ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12, display: 'inline-block', animation: 'spin 1.2s linear infinite' }}>⟳</div>
          <div style={{ color: '#00d4ff', fontSize: 14 }}>
            {ar ? 'جارٍ جلب البيانات التاريخية من ERA5...' : 'Fetching historical ERA5 data...'}
          </div>
          <div style={{ color: '#334155', fontSize: 11, marginTop: 6 }}>
            {ar ? 'قد يستغرق الطلب الأول 15-30 ثانية' : 'First request may take 15-30 seconds'}
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && !isLoading && (
        <div style={{ ...card, borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', padding: 20, textAlign: 'center' }}>
          <AlertTriangle size={24} color="#ef4444" style={{ marginBottom: 8 }} />
          <div style={{ color: '#ef4444', fontSize: 13 }}>
            {ar ? 'تعذّر جلب البيانات. يرجى المحاولة مرة أخرى.' : 'Failed to fetch data. Please try again.'}
          </div>
          <button onClick={() => refetch()} style={{ ...filterBtn(true), marginTop: 10 }}>
            {ar ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}

      {hist && (
        <>
          {/* ── KPI Cards ── */}
          {summaryStats && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : 6}, 1fr)`, gap: 8, marginBottom: 18 }}>
              {[
                { icon: <Droplets size={13} />, label: ar ? 'متوسط سنوي' : 'Avg Annual', value: summaryStats.avgAnnual, unit: 'mm', color: '#3b82f6' },
                { icon: <TrendingUp size={13} />, label: ar ? 'أعلى يوم' : 'Peak Day', value: summaryStats.maxDay, unit: 'mm', color: '#f59e0b' },
                { icon: <AlertTriangle size={13} />, label: ar ? 'أحداث فيضان' : 'Flood Events', value: String(summaryStats.totalFlood), unit: '', color: '#ef4444' },
                { icon: <Zap size={13} />, label: ar ? 'أحداث شديدة' : 'Extreme Events', value: String(summaryStats.totalExtreme), unit: '', color: '#7c3aed' },
                { icon: <Calendar size={13} />, label: ar ? 'أمطر سنة' : 'Wettest Year', value: String(summaryStats.maxYear), unit: '', color: '#10b981' },
                { icon: <MapPin size={13} />, label: ar ? 'مجموع أعلى سنة' : 'Wettest Total', value: summaryStats.maxYearVal, unit: 'mm', color: '#00d4ff' },
              ].map((k, i) => (
                <div key={i} style={{ ...card, textAlign: 'center', padding: '10px 6px' }}>
                  <div style={{ color: k.color, marginBottom: 3, display: 'flex', justifyContent: 'center' }}>{k.icon}</div>
                  <div style={{ fontSize: isMobile ? 15 : 19, fontWeight: 800, color: k.color, fontFamily: 'monospace', lineHeight: 1 }}>
                    {k.value}
                    {k.unit && <span style={{ fontSize: 9, marginLeft: 2, color: '#475569' }}>{k.unit}</span>}
                  </div>
                  <div style={{ fontSize: 9, color: '#475569', marginTop: 3 }}>{k.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Filters ── */}
          <div style={{ ...card, marginBottom: 14, padding: '10px 14px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Filter size={11} color="#64748b" />
                <span style={{ fontSize: 11, color: '#64748b' }}>{ar ? 'المدينة:' : 'City:'}</span>
                {[
                  { key: 'all',      label: ar ? 'الكل'    : 'All'       },
                  { key: 'abudhabi', label: ar ? 'أبوظبي'  : 'Abu Dhabi' },
                  { key: 'alain',    label: ar ? 'العين'   : 'Al Ain'    },
                  { key: 'aldhafra', label: ar ? 'الظفرة'  : 'Al Dhafra' },
                ].map(c => (
                  <button key={c.key} onClick={() => setSelectedCity(c.key)}
                    style={filterBtn(selectedCity === c.key, CITY_COLORS[c.key] ?? '#00d4ff')}>
                    {c.label}
                  </button>
                ))}
              </div>
              <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Calendar size={11} color="#64748b" />
                <span style={{ fontSize: 11, color: '#64748b' }}>{ar ? 'السنة:' : 'Year:'}</span>
                <select value={yearA ?? ''} onChange={e => setYearA(e.target.value ? Number(e.target.value) : null)} style={selectStyle}>
                  <option value="">{ar ? 'اختر سنة' : 'Select year'}</option>
                  {availableYears.map((y: number) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {[
              { id: 'annual',  label: ar ? '📊 سنوي'   : '📊 Annual'   },
              { id: 'monthly', label: ar ? '📅 شهري'   : '📅 Monthly'  },
              { id: 'compare', label: ar ? '⚖️ مقارنة' : '⚖️ Compare' },
              { id: 'events',  label: ar ? '⚡ أحداث'  : '⚡ Events'   },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id as any)} style={tabBtn(activeTab === t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ════════════════════════════════════════
              TAB: Annual
          ════════════════════════════════════════ */}
          {activeTab === 'annual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#00d4ff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Droplets size={13} />
                  {ar ? 'إجمالي الأمطار السنوي (mm)' : 'Annual Total Rainfall (mm)'}
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={annualData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} unit=" mm" width={48} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                    {filteredCities.map((city: any) => (
                      <Bar key={city.city} dataKey={city.nameEn} fill={CITY_COLORS[city.city]} radius={[3,3,0,0]} maxBarSize={36} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={13} />
                  {ar ? 'أيام الفيضانات سنوياً (هطول > 20mm/يوم)' : 'Flood Days per Year (daily > 20mm)'}
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={annualData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} width={28} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                    {filteredCities.map((city: any) => (
                      <Line key={city.city} type="monotone"
                        dataKey={`${city.nameEn}_flood`}
                        name={ar ? city.nameAr : city.nameEn}
                        stroke={CITY_COLORS[city.city]} strokeWidth={2} dot={{ r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 10 }}>
                  {ar ? 'جدول البيانات السنوية' : 'Annual Data Table'}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <th style={{ padding: '6px 8px', color: '#475569', textAlign: ar ? 'right' : 'left' }}>{ar ? 'السنة' : 'Year'}</th>
                        {filteredCities.map((c: any) => (
                          <th key={c.city} style={{ padding: '6px 8px', color: CITY_COLORS[c.city], textAlign: 'center' }}>
                            {ar ? c.nameAr : c.nameEn} (mm)
                          </th>
                        ))}
                        {filteredCities.map((c: any) => (
                          <th key={`${c.city}_f`} style={{ padding: '6px 8px', color: '#ef4444', textAlign: 'center', fontSize: 10 }}>
                            {ar ? `${c.nameAr} فيضان` : `${c.nameEn} flood`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {annualData.map((row: any, i: number) => (
                        <tr key={row.year} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                          <td style={{ padding: '6px 8px', color: '#e2e8f0', fontWeight: 700 }}>{row.year}</td>
                          {filteredCities.map((c: any) => (
                            <td key={c.city} style={{ padding: '6px 8px', textAlign: 'center', color: CITY_COLORS[c.city], fontFamily: 'monospace' }}>
                              {((row[c.nameEn] as number) ?? 0).toFixed(1)}
                            </td>
                          ))}
                          {filteredCities.map((c: any) => (
                            <td key={`${c.city}_f`} style={{ padding: '6px 8px', textAlign: 'center', color: row[`${c.nameEn}_flood`] > 0 ? '#ef4444' : '#334155', fontFamily: 'monospace' }}>
                              {row[`${c.nameEn}_flood`] ?? 0}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════
              TAB: Monthly
          ════════════════════════════════════════ */}
          {activeTab === 'monthly' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div style={{ ...card, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>{ar ? 'عرض بيانات سنة:' : 'Showing year:'}</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {availableYears.map((y: number) => (
                    <button key={y} onClick={() => setYearA(y)} style={filterBtn(selectedYear === y)}>{y}</button>
                  ))}
                </div>
              </div>

              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#00d4ff', marginBottom: 12 }}>
                  {ar ? `التوزيع الشهري — ${selectedYear}` : `Monthly Distribution — ${selectedYear}`}
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={monthlyData}>
                    <defs>
                      {filteredCities.map((city: any) => (
                        <linearGradient key={city.city} id={`grad_${city.city}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CITY_COLORS[city.city]} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CITY_COLORS[city.city]} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} unit=" mm" width={48} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                    {filteredCities.map((city: any) => (
                      <Area key={city.city} type="monotone" dataKey={city.nameEn}
                        stroke={CITY_COLORS[city.city]} fill={`url(#grad_${city.city})`}
                        strokeWidth={2} dot={{ r: 3 }} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 12 }}>
                  {ar ? 'خريطة حرارية — هطول شهري (mm)' : 'Heat Map — Monthly Rainfall (mm)'}
                </div>
                {filteredCities.map((city: any) => {
                  const ys = city.years.find((y: any) => y.year === selectedYear);
                  if (!ys) return null;
                  return (
                    <div key={city.city} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, color: CITY_COLORS[city.city], marginBottom: 6, fontWeight: 700 }}>
                        {ar ? city.nameAr : city.nameEn}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3 }}>
                        {ys.monthlyTotals.map((mm: number, i: number) => (
                          <div key={i}
                            title={`${ar ? MONTHS_AR[i] : MONTHS_EN[i]}: ${mm.toFixed(1)} mm`}
                            style={{
                              background: SEVERITY_COLOR(mm), borderRadius: 4,
                              padding: '6px 2px', textAlign: 'center', fontSize: 9,
                              color: mm > 5 ? '#fff' : '#475569',
                              border: '1px solid rgba(255,255,255,0.05)', cursor: 'default',
                            }}>
                            <div style={{ fontWeight: 700 }}>{mm > 0 ? mm.toFixed(0) : '—'}</div>
                            <div style={{ fontSize: 8, opacity: 0.7 }}>{ar ? MONTHS_AR[i].slice(0,3) : MONTHS_EN[i]}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {[['#1e293b','0 mm'],['#1d4ed8','< 5'],['#2563eb','5-20'],['#f59e0b','20-50'],['#ef4444','50-100'],['#7c3aed','> 100']].map(([c, l]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#64748b' }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════
              TAB: Compare
          ════════════════════════════════════════ */}
          {activeTab === 'compare' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div style={{ ...card, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Filter size={11} />
                  {ar ? 'اختر سنتين للمقارنة:' : 'Select two years to compare:'}
                </div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#00d4ff', marginBottom: 5 }}>{ar ? 'السنة الأولى (A)' : 'Year A'}</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {availableYears.map((y: number) => (
                        <button key={y} onClick={() => setYearA(y)} style={filterBtn(yearA === y, '#00d4ff')}>{y}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: 20, color: '#334155', paddingTop: 18 }}>⚖️</div>
                  <div>
                    <div style={{ fontSize: 10, color: '#f59e0b', marginBottom: 5 }}>{ar ? 'السنة الثانية (B)' : 'Year B'}</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {availableYears.map((y: number) => (
                        <button key={y} onClick={() => setYearB(y)} style={filterBtn(yearB === y, '#f59e0b')}>{y}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {yearA && yearB ? (
                <>
                  <div style={card}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>
                      {ar ? `مقارنة شهرية: ${yearA} مقابل ${yearB}` : `Monthly: ${yearA} vs ${yearB}`}
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={compareData} barCategoryGap="15%">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} unit=" mm" width={48} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                        {filteredCities.flatMap((city: any) => [
                          <Bar key={`${city.city}_A`} dataKey={`${city.nameEn} ${yearA}`}
                            fill={CITY_COLORS[city.city]} opacity={0.9} radius={[3,3,0,0]} maxBarSize={18} />,
                          <Bar key={`${city.city}_B`} dataKey={`${city.nameEn} ${yearB}`}
                            fill={CITY_COLORS[city.city]} opacity={0.4} radius={[3,3,0,0]} maxBarSize={18} />,
                        ])}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={card}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 10 }}>
                      {ar ? 'ملخص المقارنة' : 'Comparison Summary'}
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            <th style={{ padding: '6px 8px', color: '#475569', textAlign: ar ? 'right' : 'left' }}>{ar ? 'المدينة' : 'City'}</th>
                            <th style={{ padding: '6px 8px', color: '#00d4ff', textAlign: 'center' }}>{yearA} (mm)</th>
                            <th style={{ padding: '6px 8px', color: '#f59e0b', textAlign: 'center' }}>{yearB} (mm)</th>
                            <th style={{ padding: '6px 8px', color: '#10b981', textAlign: 'center' }}>{ar ? 'الفرق' : 'Diff'}</th>
                            <th style={{ padding: '6px 8px', color: '#ef4444', textAlign: 'center' }}>{ar ? 'فيضان A' : 'Flood A'}</th>
                            <th style={{ padding: '6px 8px', color: '#ef4444', textAlign: 'center' }}>{ar ? 'فيضان B' : 'Flood B'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCities.map((city: any) => {
                            const ysA = city.years.find((y: any) => y.year === yearA);
                            const ysB = city.years.find((y: any) => y.year === yearB);
                            const diff = ((ysA?.totalPrecip ?? 0) - (ysB?.totalPrecip ?? 0));
                            return (
                              <tr key={city.city} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '7px 8px', color: CITY_COLORS[city.city], fontWeight: 700 }}>
                                  {ar ? city.nameAr : city.nameEn}
                                </td>
                                <td style={{ padding: '7px 8px', textAlign: 'center', color: '#00d4ff', fontFamily: 'monospace' }}>
                                  {ysA?.totalPrecip.toFixed(1) ?? '—'}
                                </td>
                                <td style={{ padding: '7px 8px', textAlign: 'center', color: '#f59e0b', fontFamily: 'monospace' }}>
                                  {ysB?.totalPrecip.toFixed(1) ?? '—'}
                                </td>
                                <td style={{ padding: '7px 8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700,
                                  color: diff > 0 ? '#10b981' : diff < 0 ? '#ef4444' : '#64748b' }}>
                                  {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                                </td>
                                <td style={{ padding: '7px 8px', textAlign: 'center', color: '#ef4444', fontFamily: 'monospace' }}>
                                  {ysA?.floodEvents ?? 0}
                                </td>
                                <td style={{ padding: '7px 8px', textAlign: 'center', color: '#ef4444', fontFamily: 'monospace' }}>
                                  {ysB?.floodEvents ?? 0}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ ...card, textAlign: 'center', padding: 40, color: '#334155' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>⚖️</div>
                  <div style={{ fontSize: 13 }}>
                    {ar ? 'اختر سنتين أعلاه للمقارنة' : 'Select two years above to compare'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════
              TAB: Events
          ════════════════════════════════════════ */}
          {activeTab === 'events' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>
                {ar
                  ? `أعلى ${topEvents.length} يوم هطول مسجّل (> 10mm) — مرتبة تنازلياً`
                  : `Top ${topEvents.length} recorded rainfall days (> 10mm) — sorted descending`}
              </div>
              {topEvents.map((ev: any, i: number) => (
                <div key={i} style={{
                  ...card, display: 'flex', alignItems: 'center', gap: 12,
                  borderColor: ev.precip > 50 ? 'rgba(239,68,68,0.3)' : ev.precip > 20 ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.07)',
                  padding: '10px 14px',
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    background: SEVERITY_COLOR(ev.precip) + '33',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 800, color: SEVERITY_COLOR(ev.precip), fontFamily: 'monospace',
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: ev.cityColor }}>{ev.city}</span>
                      <span style={{ fontSize: 11, color: '#475569' }}>{ev.date}</span>
                      {ev.floodEvents > 0 && (
                        <span style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                          {ar ? `${ev.floodEvents} يوم فيضان في ${ev.year}` : `${ev.floodEvents} flood days in ${ev.year}`}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>
                      {ar ? `إجمالي سنة ${ev.year}: ${ev.total.toFixed(1)} mm` : `Year ${ev.year} total: ${ev.total.toFixed(1)} mm`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: SEVERITY_COLOR(ev.precip), fontFamily: 'monospace', lineHeight: 1 }}>
                      {ev.precip.toFixed(1)}
                    </div>
                    <div style={{ fontSize: 9, color: '#475569' }}>mm/day</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Source note ── */}
          <div style={{ marginTop: 18, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={11} color="#334155" />
            <span style={{ fontSize: 10, color: '#334155' }}>
              {ar
                ? `المصدر: Open-Meteo Archive API — ERA5 Reanalysis (ECMWF) • آخر تحديث: ${new Date(hist.fetchedAt).toLocaleString('ar-AE')}`
                : `Source: Open-Meteo Archive API — ERA5 Reanalysis (ECMWF) • Last updated: ${new Date(hist.fetchedAt).toLocaleString()}`}
            </span>
          </div>
        </>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
