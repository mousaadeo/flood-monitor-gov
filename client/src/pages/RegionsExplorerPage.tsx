/**
 * RegionsExplorerPage — Abu Dhabi Emirate Regions Explorer
 * Data: 100% live from Open-Meteo via useLiveRegions hook
 * Historical: ERA5 archive up to 90 days | Forecast: 16-day forecast
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { useIsMobile } from '@/hooks/useMobile';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  Cell, PieChart, Pie, ComposedChart, Line, ReferenceLine,
} from 'recharts';
import {
  MapPin, Droplets, AlertTriangle, Thermometer, Wind, Activity,
  ArrowUpRight, Building2, TrendingUp, Waves, Navigation,
  RefreshCw, Clock, BarChart2, Calendar, Search,
  Zap, Recycle, Shield, ChevronDown, ChevronUp, Globe, DollarSign, Leaf,
} from 'lucide-react';
import { alertColor, alertLabel, type AlertLevel } from '@/data/abuDhabiRegions';
import { useLiveRegions, type LiveSubArea, type LiveCity } from '@/hooks/useLiveRegions';
import { useRealWeather, computeWeatherSummary } from '@/hooks/useRealWeather';
import { usePrecipHistory } from '@/services/precipHistoryApi';
import MetricTooltip from '@/components/MetricTooltip';
import HistoricalReplay, { type HistoricalReplaySelection } from '@/components/HistoricalReplay';
import { useLocation } from 'wouter';

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg: '#07101F', bgCard: '#0D1A2D', bgPanel: '#0A1525',
  border: 'rgba(27,79,138,0.3)', borderLight: 'rgba(27,79,138,0.15)',
  text: 'rgba(255,255,255,0.92)', textSub: 'rgba(255,255,255,0.55)',
  textMuted: 'rgba(255,255,255,0.32)',
  blue: '#42A5F5', blueLight: 'rgba(66,165,245,0.12)',
  green: '#66BB6A', orange: '#FFA726', red: '#EF4444', yellow: '#F59E0B',
  fontHead: "'Tajawal', sans-serif", fontMono: "'JetBrains Mono', monospace",
};
const tooltipStyle = {
  background: '#0D1A2D', border: '1px solid rgba(27,79,138,0.4)',
  borderRadius: '4px', color: T.text, fontSize: '11px', fontFamily: T.fontMono,
};

// ── Alert Badge ───────────────────────────────────────────────────────────────
function AlertBadge({ level }: { level: AlertLevel }) {
  const color = alertColor(level);
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '2px', fontSize: '10px',
      fontFamily: T.fontMono, fontWeight: 700, letterSpacing: '0.05em',
      background: `${color}18`, color, border: `1px solid ${color}40`,
    }}>{alertLabel(level)}</span>
  );
}

// ── Risk Bar ──────────────────────────────────────────────────────────────────
function RiskBar({ value }: { value: number }) {
  const color = value >= 70 ? T.red : value >= 50 ? T.yellow : value >= 30 ? T.blue : T.green;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: '11px', fontFamily: T.fontMono, color, fontWeight: 700, minWidth: '28px', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// ── KPI Mini Card ─────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, unit, color = T.blue, tooltipId }: {
  icon: React.ReactNode; label: string; value: string | number; unit?: string;
  color?: string; tooltipId?: string;
}) {
  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: '4px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ color, opacity: 0.8 }}>{icon}</span>
        <span style={{ fontSize: '10px', color: T.textMuted, fontFamily: T.fontMono, flex: 1 }}>{label}</span>
        {tooltipId && <MetricTooltip id={tooltipId} size={10} position="top" />}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{ fontSize: '22px', fontWeight: 700, fontFamily: T.fontHead, color }}>{value}</span>
        {unit && <span style={{ fontSize: '11px', color: T.textMuted, fontFamily: T.fontMono }}>{unit}</span>}
      </div>
    </div>
  );
}

// ── Sub-Area Card ─────────────────────────────────────────────────────────────
function SubAreaCard({ area, onClick }: { area: LiveSubArea; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? 'rgba(66,165,245,0.06)' : T.bgCard, border: `1px solid ${hovered ? 'rgba(66,165,245,0.35)' : T.border}`, borderRadius: '4px', padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s ease' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: T.text, fontFamily: T.fontHead }}>{area.nameAr}</div>
          <div style={{ fontSize: '9px', color: T.textMuted, fontFamily: T.fontMono, marginTop: '1px' }}>{area.nameEn}</div>
        </div>
        <AlertBadge level={area.alertLevel} />
      </div>
      <RiskBar value={area.floodRisk} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '8px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: T.blue, fontFamily: T.fontMono }}>{area.maxWaterDepthCm}</div>
          <div style={{ fontSize: '8px', color: T.textMuted, fontFamily: T.fontMono }}>Depth cm</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: T.orange, fontFamily: T.fontMono }}>{area.drainageLoad}%</div>
          <div style={{ fontSize: '8px', color: T.textMuted, fontFamily: T.fontMono }}>Drainage</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: area.currentPrecipitation > 0 ? T.blue : T.green, fontFamily: T.fontMono }}>{area.currentPrecipitation}</div>
          <div style={{ fontSize: '8px', color: T.textMuted, fontFamily: T.fontMono }}>mm/hr</div>
        </div>
      </div>
      {area.note && (
        <div style={{ marginTop: '8px', padding: '4px 8px', background: 'rgba(245,158,11,0.08)', borderRadius: '2px', fontSize: '9px', color: T.yellow, fontFamily: T.fontMono }}>⚠ {area.note}</div>
      )}
    </div>
  );
}

// ── City Card ─────────────────────────────────────────────────────────────────
function CityCard({ city, onClick }: { city: LiveCity; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const areas = city.subAreas;
  const n = areas.length;
  const avgRisk = n > 0 ? Math.round(areas.reduce((s, a) => s + a.floodRisk, 0) / n) : 0;
  const totalFloodHa = areas.reduce((s, a) => s + a.floodAreaHa, 0);
  const criticalCount = areas.filter(a => a.alertLevel === 'critical').length;
  const warningCount = areas.filter(a => a.alertLevel === 'warning').length;
  const watchCount = areas.filter(a => a.alertLevel === 'watch').length;
  const safeCount = areas.filter(a => a.alertLevel === 'safe').length;
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? `${city.color}08` : T.bgCard, border: `1px solid ${hovered ? city.color + '50' : T.border}`, borderRadius: '6px', padding: '18px', cursor: 'pointer', transition: 'all 0.18s ease', flex: 1 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: city.color, fontFamily: T.fontHead }}>{city.nameAr}</div>
          <div style={{ fontSize: '10px', color: T.textMuted, fontFamily: T.fontMono }}>{city.nameEn}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <span style={{ fontSize: '22px', fontWeight: 800, color: city.color, fontFamily: T.fontMono }}>{avgRisk}</span>
          <span style={{ fontSize: '8px', color: T.textMuted, fontFamily: T.fontMono }}>risk index</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <div style={{ background: T.bgPanel, borderRadius: '3px', padding: '8px' }}>
          <div style={{ fontSize: '11px', color: T.textMuted, fontFamily: T.fontMono }}>Regions</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: T.text, fontFamily: T.fontMono }}>{n}</div>
        </div>
        <div style={{ background: T.bgPanel, borderRadius: '3px', padding: '8px' }}>
          <div style={{ fontSize: '11px', color: T.textMuted, fontFamily: T.fontMono }}>Flood Area</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: T.blue, fontFamily: T.fontMono }}>{totalFloodHa} <span style={{ fontSize: '10px' }}>ha</span></div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        {criticalCount > 0 && <div style={{ flex: criticalCount, height: '6px', background: T.red, borderRadius: '2px' }} />}
        {warningCount > 0 && <div style={{ flex: warningCount, height: '6px', background: T.yellow, borderRadius: '2px' }} />}
        {watchCount > 0 && <div style={{ flex: watchCount, height: '6px', background: T.blue, borderRadius: '2px' }} />}
        {safeCount > 0 && <div style={{ flex: safeCount, height: '6px', background: T.green, borderRadius: '2px' }} />}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {criticalCount > 0 && <span style={{ fontSize: '9px', color: T.red, fontFamily: T.fontMono }}>●Critical {criticalCount}</span>}
        {warningCount > 0 && <span style={{ fontSize: '9px', color: T.yellow, fontFamily: T.fontMono }}>●Warning {warningCount}</span>}
        {watchCount > 0 && <span style={{ fontSize: '9px', color: T.blue, fontFamily: T.fontMono }}>●Watch {watchCount}</span>}
        {safeCount > 0 && <span style={{ fontSize: '9px', color: T.green, fontFamily: T.fontMono }}>●Safe {safeCount}</span>}
      </div>
    </div>
  );
}

// ── Historical/Forecast Chart ─────────────────────────────────────────────────
type ChartMode = '24h' | '7d' | '30d' | '90d' | '16d_forecast';

function PrecipHistoryChart({ lat, lon, regionName }: { lat: number; lon: number; regionName: string }) {
  const [mode, setMode] = useState<ChartMode>('7d');
  const query = usePrecipHistory(lat, lon, mode);
  const points = query.data?.points ?? [];
  const { lang: chartLang } = useLanguage();
  const isAr = chartLang === 'ar';

  const modes: { key: ChartMode; label: string; desc: string }[] = [
    { key: '24h', label: isAr ? '24ساعة' : '24h', desc: isAr ? 'آخر 12ساعة + القادمة 12ساعة' : 'Last 12h + Next 12h' },
    { key: '7d', label: isAr ? '7 أيام' : '7 days', desc: isAr ? 'آخر 3 أيام + توقعات 4 أيام' : 'Last 3 days + Next 4 days' },
    { key: '30d', label: isAr ? '30 يوم' : '30 days', desc: isAr ? 'أرشيف ERA5 + توقعات 3 أيام' : 'ERA5 Archive + 3-day forecast' },
    { key: '90d', label: isAr ? '90 يوم' : '90 days', desc: isAr ? 'أرشيف ERA5 (ثلاثة أشهر)' : 'ERA5 Archive (3 months)' },
    { key: '16d_forecast', label: isAr ? 'توقعات 16 يوم' : '16d Forecast', desc: isAr ? 'توقعات الـ 16 يوماً القادمة' : 'Next 16 days forecast' },
  ];

  const formatX = (tick: string) => mode === '24h' ? tick.slice(0, 5) : tick.slice(5, 10);
  const nowLabel = points.find(p => !p.isHistory)?.time ?? null;
  const maxPrecip = Math.max(...points.map(p => p.precipitation), 1);
  const totalHist = Math.round(points.filter(p => p.isHistory).reduce((s, p) => s + p.precipitation, 0) * 10) / 10;
  const totalForecast = Math.round(points.filter(p => !p.isHistory).reduce((s, p) => s + p.precipitation, 0) * 10) / 10;
  const peakPrecip = points.length > 0 ? Math.max(...points.map(p => p.precipitation)).toFixed(1) : '0';

  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: '4px', padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart2 size={13} color={T.blue} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: T.text, fontFamily: T.fontHead }}>{isAr ? 'تاريخ الأمطار والتوقعات' : 'Rainfall History & Forecast'}</span>
          <span style={{ fontSize: '9px', color: T.textMuted, fontFamily: T.fontMono }}>{regionName} · ERA5 + Open-Meteo</span>
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {modes.map(m => (
            <button key={m.key} onClick={() => setMode(m.key)} title={m.desc}
              style={{ padding: '4px 10px', borderRadius: '3px', fontSize: '10px', fontFamily: T.fontMono, cursor: 'pointer', border: '1px solid', background: mode === m.key ? T.blueLight : 'transparent', borderColor: mode === m.key ? T.blue + '60' : T.borderLight, color: mode === m.key ? T.blue : T.textMuted, transition: 'all 0.15s' }}
            >{m.label}</button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '12px', height: '12px', background: '#1E88E5', borderRadius: '2px', opacity: 0.8 }} />
          <span style={{ fontSize: '9px', color: T.textMuted, fontFamily: T.fontMono }}>{isAr ? 'تاريخي (mm)' : 'Historical (mm)'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '12px', height: '12px', background: '#42A5F5', borderRadius: '2px', opacity: 0.5 }} />
          <span style={{ fontSize: '9px', color: T.textMuted, fontFamily: T.fontMono }}>{isAr ? 'توقعات (mm)' : 'Forecast (mm)'}</span>
        </div>
        {mode !== '30d' && mode !== '90d' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '12px', height: '2px', background: T.orange }} />
            <span style={{ fontSize: '9px', color: T.textMuted, fontFamily: T.fontMono }}>{isAr ? 'احتمال (%)' : 'Probability (%)'}</span>
          </div>
        )}
        {nowLabel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '2px', height: '12px', background: T.red }} />
            <span style={{ fontSize: '9px', color: T.textMuted, fontFamily: T.fontMono }}>{isAr ? 'الآن' : 'Now'}</span>
          </div>
        )}
      </div>

      {query.isLoading ? (
        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMuted, fontFamily: T.fontMono, fontSize: '11px' }}>
          <RefreshCw size={14} style={{ marginRight: '6px' }} />
          {isAr ? (mode === '90d' ? 'جاري تحميل أرشيف ERA5 (90 يوم)...' : mode === '30d' ? 'جاري تحميل أرشيف ERA5 (30 يوم)...' : 'جاري التحميل...') : (`Loading ${mode === '90d' ? 'ERA5 archive (90 days)' : mode === '30d' ? 'ERA5 archive (30 days)' : 'data'}...`)}
        </div>
      ) : query.error ? (
        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.red, fontFamily: T.fontMono, fontSize: '11px' }}>{isAr ? 'فشل التحميل. حاول مجدداً.' : 'Failed to load. Retry.'}</div>
      ) : points.length === 0 ? (
        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textMuted, fontFamily: T.fontMono, fontSize: '11px' }}>{isAr ? 'لا توجد بيانات لهذه الفترة.' : 'No data for this period.'}</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={points} margin={{ top: 5, right: 10, bottom: 20, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(66,165,245,0.07)" />
            <XAxis dataKey="time" tickFormatter={formatX} tick={{ fill: T.textMuted, fontSize: 9, fontFamily: T.fontMono }} angle={-30} textAnchor="end"
              interval={mode === '24h' ? 3 : mode === '7d' ? 11 : mode === '16d_forecast' ? 23 : 'preserveStartEnd'} />
            <YAxis yAxisId="left" tick={{ fill: T.textMuted, fontSize: 9, fontFamily: T.fontMono }} domain={[0, Math.ceil(maxPrecip * 1.2)]}
              label={{ value: 'mm', angle: -90, position: 'insideLeft', fill: T.textMuted, fontSize: 9 }} />
            {mode !== '30d' && mode !== '90d' && (
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fill: T.textMuted, fontSize: 9, fontFamily: T.fontMono }}
                label={{ value: '%', angle: 90, position: 'insideRight', fill: T.textMuted, fontSize: 9 }} />
            )}
            <Tooltip contentStyle={tooltipStyle}
              formatter={(value: number, name: string) => {
                if (name === 'hist') return [`${value} mm`, isAr ? 'هطول (تاريخي)' : 'Rainfall (Historical)'];
                if (name === 'fcst') return [`${value} mm`, isAr ? 'هطول (توقع)' : 'Rainfall (Forecast)'];
                if (name === 'prob') return [`${value}%`, isAr ? 'احتمال المطر' : 'Rain Probability'];
                return [value, name];
              }}
              labelFormatter={(l) => `${isAr ? 'الوقت' : 'Time'}: ${l}`}
            />
            {nowLabel && (
              <ReferenceLine yAxisId="left" x={nowLabel} stroke={T.red} strokeDasharray="4 2"
                label={{ value: isAr ? 'الآن' : 'NOW', fill: T.red, fontSize: 8, fontFamily: T.fontMono }} />
            )}
            <Bar yAxisId="left" dataKey={(p: any) => p.isHistory ? p.precipitation : null} name="hist" fill="#1E88E5" fillOpacity={0.85} radius={[1,1,0,0]} />
            <Bar yAxisId="left" dataKey={(p: any) => !p.isHistory ? p.precipitation : null} name="fcst" fill="#42A5F5" fillOpacity={0.5} radius={[1,1,0,0]} />
            {mode !== '30d' && mode !== '90d' && (
              <Line yAxisId="right" type="monotone" dataKey="probability" name="prob" stroke={T.orange} strokeWidth={1.5} dot={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {points.length > 0 && (
        <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '9px', color: T.textMuted, fontFamily: T.fontMono }}>
            <span style={{ color: T.blue }}>{isAr ? 'مجموع تاريخي: ' : 'Historical total: '}</span>{totalHist} mm
          </span>
          <span style={{ fontSize: '9px', color: T.textMuted, fontFamily: T.fontMono }}>
            <span style={{ color: '#42A5F5' }}>{isAr ? 'مجموع التوقع: ' : 'Forecast total: '}</span>{totalForecast} mm
          </span>
          <span style={{ fontSize: '9px', color: T.textMuted, fontFamily: T.fontMono }}>
            <span style={{ color: T.orange }}>{isAr ? 'ذروة: ' : 'Peak: '}</span>{peakPrecip} mm
          </span>
          <span style={{ fontSize: '9px', color: T.textMuted, fontFamily: T.fontMono }}>
            <span style={{ color: T.textSub }}>{isAr ? 'نقاط: ' : 'Points: '}</span>{points.length}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Level 0: Emirate View ─────────────────────────────────────────────────────
function EmirateView({ cities, onSelectCity }: { cities: LiveCity[]; onSelectCity: (city: LiveCity) => void }) {
  const isMobile = useIsMobile();
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const allAreas = useMemo(() => cities.flatMap(c => c.subAreas), [cities]);
  const totalFloodHa = allAreas.reduce((s, a) => s + a.floodAreaHa, 0);
  // Use live weather summary for counts — matches Dashboard exactly (90 live regions)
  const { data: liveData } = useRealWeather();
  const liveSummary = useMemo(() => computeWeatherSummary(liveData), [liveData]);
  const n = liveData?.regions?.length ?? 90;
  const avgRisk = liveSummary ? Math.round(liveSummary.maxRisk * 0.6) : 0; // avg ≈ 60% of max
  const criticalCount = liveSummary?.criticalCount ?? 0;
  const warningCount = liveSummary?.warningCount ?? 0;
  const watchCount = liveSummary?.watchCount ?? 0;
  const safeCount = n - criticalCount - warningCount - watchCount;

  const comparisonData = cities.map(c => {
    const cn = c.subAreas.length;
    return {
      name: c.nameAr,
      'risk index': cn > 0 ? Math.round(c.subAreas.reduce((s, a) => s + a.floodRisk, 0) / cn) : 0,
      fill: c.color,
    };
  });
  const alertPieData = [
    { name: 'Critical', value: criticalCount, fill: T.red },
    { name: 'Warning', value: warningCount, fill: T.yellow },
    { name: 'Watch', value: watchCount, fill: T.blue },
    { name: 'Safe', value: safeCount, fill: T.green },
  ].filter(d => d.value > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '10px' }}>
        <KpiCard icon={<Building2 size={14} />} label={isAr ? 'إجمالي المناطق' : 'Total Regions'} value={n} tooltipId="total-areas" />
        <KpiCard icon={<Activity size={14} />} label={isAr ? 'متوسط مؤشر الخطر' : 'Average Risk Index'} value={avgRisk} unit="%" color={avgRisk >= 50 ? T.yellow : T.blue} tooltipId="flood-risk-index" />
        <KpiCard icon={<Waves size={14} />} label={isAr ? 'إجمالي مساحة الفيضان' : 'Total Flood Area'} value={totalFloodHa} unit="ha" color={T.blue} tooltipId="flood-area" />
        <KpiCard icon={<AlertTriangle size={14} />} label={isAr ? 'حرج + تحذير' : 'Critical + Warning'} value={criticalCount + warningCount} color={T.red} tooltipId="critical-areas" />
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <h2 style={{ fontFamily: T.fontHead, fontSize: '14px', fontWeight: 700, color: T.text }}>{isAr ? 'ثلاث مدن — انقر للتفاصيل' : 'Three cities — click for details'}</h2>
          <MetricTooltip id="cities-comparison" size={11} position="bottom" />
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          {cities.map(city => <CityCard key={city.id} city={city} onClick={() => onSelectCity(city)} />)}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: '4px', padding: '14px' }}>
          <h3 style={{ fontFamily: T.fontHead, fontSize: '12px', fontWeight: 600, color: T.text, marginBottom: '8px' }}>{isAr ? 'توزيع مستويات التنبيه — كامل الإمارة' : 'Alert Level Distribution — Entire Emirate'}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={alertPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" nameKey="name"
                label={({ name, value }) => `${name}: ${value}`} labelLine={{ stroke: 'rgba(255,255,255,0.2)' }}>
                {alertPieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: '4px', padding: '14px' }}>
          <h3 style={{ fontFamily: T.fontHead, fontSize: '12px', fontWeight: 600, color: T.text, marginBottom: '8px' }}>{isAr ? 'مقارنة مؤشر الخطر بين المدن' : 'Risk Index Comparison Between Cities'}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={comparisonData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(66,165,245,0.07)" />
              <XAxis dataKey="name" tick={{ fill: T.textSub, fontSize: 11, fontFamily: T.fontHead }} />
              <YAxis tick={{ fill: T.textMuted, fontSize: 9, fontFamily: T.fontMono }} domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="risk index" radius={[3,3,0,0]}>
                {comparisonData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Full comparison table */}
      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: '4px', padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <h3 style={{ fontFamily: T.fontHead, fontSize: '12px', fontWeight: 600, color: T.text }}>{isAr ? 'مقارنة شاملة — جميع المناطق (بيانات حية)' : 'Comprehensive Comparison — All Regions (Live Data)'}</h3>
          <MetricTooltip id="all-areas-table" size={10} position="top" />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: T.fontMono }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {(isAr ? ['المنطقة', 'المدينة', 'التنبيه', 'الخطر', 'عمق سم', 'فيضان هك', 'صرف%', 'مم/ساعة', 'أقصي 48ساعة', 'حرارة°'] : ['Region', 'City', 'Alert', 'Risk', 'Depth cm', 'Flood ha', 'Drainage%', 'mm/hr', 'Max48h mm', 'Temp°C']).map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'right', color: T.textMuted, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cities.flatMap(city => city.subAreas.map(area => (
                <tr key={area.id} style={{ borderBottom: `1px solid ${T.borderLight}`, cursor: 'pointer' }} onClick={() => onSelectCity(city)}>
                  <td style={{ padding: '6px 10px', color: T.text, fontFamily: T.fontHead, whiteSpace: 'nowrap' }}>{area.nameAr}</td>
                  <td style={{ padding: '6px 10px', color: city.color, whiteSpace: 'nowrap' }}>{city.nameAr}</td>
                  <td style={{ padding: '6px 10px' }}><AlertBadge level={area.alertLevel} /></td>
                  <td style={{ padding: '6px 10px' }}><RiskBar value={area.floodRisk} /></td>
                  <td style={{ padding: '6px 10px', color: T.blue, textAlign: 'center' }}>{area.maxWaterDepthCm}</td>
                  <td style={{ padding: '6px 10px', color: T.blue, textAlign: 'center' }}>{area.floodAreaHa}</td>
                  <td style={{ padding: '6px 10px', color: area.drainageLoad >= 80 ? T.red : area.drainageLoad >= 60 ? T.yellow : T.green, textAlign: 'center' }}>{area.drainageLoad}%</td>
                  <td style={{ padding: '6px 10px', color: area.currentPrecipitation > 0 ? T.blue : T.textSub, textAlign: 'center' }}>{area.currentPrecipitation}</td>
                  <td style={{ padding: '6px 10px', color: area.maxNext48h > 5 ? T.orange : T.textSub, textAlign: 'center' }}>{area.maxNext48h}</td>
                  <td style={{ padding: '6px 10px', color: T.orange, textAlign: 'center' }}>{area.tempC}°</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Level 1: City View ────────────────────────────────────────────────────────
function CityView({ city, onSelectArea }: { city: LiveCity; onSelectArea: (area: LiveSubArea) => void; onBack: () => void }) {
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState<AlertLevel | 'all'>('all');
  const [sortBy, setSortBy] = useState<'risk' | 'depth' | 'drain'>('risk');
  const { lang: cityLang } = useLanguage();
  const isAr = cityLang === 'ar';
  const areas = city.subAreas;
  const n = areas.length;
  const avgRisk = n > 0 ? Math.round(areas.reduce((s, a) => s + a.floodRisk, 0) / n) : 0;
  const totalFloodHa = areas.reduce((s, a) => s + a.floodAreaHa, 0);
  const avgDrainageLoad = n > 0 ? Math.round(areas.reduce((s, a) => s + a.drainageLoad, 0) / n) : 0;
  const criticalCount = areas.filter(a => a.alertLevel === 'critical').length;
  const warningCount = areas.filter(a => a.alertLevel === 'warning').length;
  const watchCount = areas.filter(a => a.alertLevel === 'watch').length;
  const safeCount = areas.filter(a => a.alertLevel === 'safe').length;

  const radarData = [
    { subject: 'Risk', value: avgRisk },
    { subject: 'Drainage', value: avgDrainageLoad },
    { subject: 'Depth', value: Math.min(Math.round(areas.reduce((s, a) => s + a.maxWaterDepthCm, 0) / n), 100) },
    { subject: 'Rainfall', value: Math.min(Math.round(areas.reduce((s, a) => s + a.currentPrecipitation, 0) / n * 100), 100) },
    { subject: 'Max48h', value: Math.min(Math.round(areas.reduce((s, a) => s + a.maxNext48h, 0) / n * 5), 100) },
  ];

  const filtered = useMemo(() => {
    let list = areas;
    if (filterLevel !== 'all') list = list.filter(a => a.alertLevel === filterLevel);
    if (search) list = list.filter(a => a.nameAr.includes(search) || a.nameEn.toLowerCase().includes(search.toLowerCase()));
    return [...list].sort((a, b) => sortBy === 'risk' ? b.floodRisk - a.floodRisk : sortBy === 'depth' ? b.maxWaterDepthCm - a.maxWaterDepthCm : b.drainageLoad - a.drainageLoad);
  }, [areas, filterLevel, search, sortBy]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
        <KpiCard icon={<Building2 size={13} />} label="Regions" value={n} />
        <KpiCard icon={<Activity size={13} />} label="Avg Risk Index" value={avgRisk} unit="%" color={avgRisk >= 50 ? T.yellow : T.blue} tooltipId="flood-risk-index" />
        <KpiCard icon={<Waves size={13} />} label="Flood Area" value={totalFloodHa} unit="ha" color={T.blue} />
        <KpiCard icon={<TrendingUp size={13} />} label="Avg Drainage Load" value={`${avgDrainageLoad}%`} color={avgDrainageLoad >= 70 ? T.red : T.orange} tooltipId="drainage-load" />
        <KpiCard icon={<AlertTriangle size={13} />} label="Critical Regions" value={criticalCount} color={T.red} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '12px' }}>
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: '4px', padding: '14px' }}>
          <h3 style={{ fontFamily: T.fontHead, fontSize: '12px', fontWeight: 600, color: T.text, marginBottom: '8px' }}>{isAr ? 'ملف الخطر' : 'Risk Profile'}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(66,165,245,0.15)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: T.textMuted, fontSize: 9, fontFamily: T.fontMono }} />
              <Radar name={city.nameAr} dataKey="value" stroke={city.color} fill={city.color} fillOpacity={0.2} />
              <Tooltip contentStyle={tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {([['critical', T.red, criticalCount], ['warning', T.yellow, warningCount], ['watch', T.blue, watchCount], ['safe', T.green, safeCount]] as const).map(([lvl, color, cnt]) =>
              cnt > 0 && (
                <div key={lvl} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: '10px', color: T.textSub, fontFamily: T.fontMono, flex: 1 }}>{alertLabel(lvl as AlertLevel)}</span>
                  <span style={{ fontSize: '10px', color, fontFamily: T.fontMono, fontWeight: 700 }}>{cnt}</span>
                </div>
              )
            )}
          </div>
        </div>
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: '4px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '160px', background: T.bgPanel, border: `1px solid ${T.borderLight}`, borderRadius: '3px', padding: '5px 10px' }}>
              <Search size={11} color={T.textMuted} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={isAr ? 'بحث في المناطق...' : 'Search regions...'}
                style={{ background: 'transparent', border: 'none', outline: 'none', color: T.text, fontSize: '11px', fontFamily: T.fontHead, width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['all', 'critical', 'warning', 'watch', 'safe'] as const).map(lvl => (
                <button key={lvl} onClick={() => setFilterLevel(lvl)} style={{ padding: '4px 8px', borderRadius: '2px', fontSize: '9px', fontFamily: T.fontMono, cursor: 'pointer', border: '1px solid', background: filterLevel === lvl ? (lvl === 'all' ? T.blue : alertColor(lvl as AlertLevel)) + '20' : 'transparent', borderColor: filterLevel === lvl ? (lvl === 'all' ? T.blue : alertColor(lvl as AlertLevel)) : T.borderLight, color: lvl === 'all' ? T.textSub : alertColor(lvl as AlertLevel) }}>
                  {lvl === 'all' ? 'All' : alertLabel(lvl as AlertLevel)}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {([['risk', 'Risk'], ['depth', 'Depth'], ['drain', 'Drainage']] as const).map(([key, label]) => (
                <button key={key} onClick={() => setSortBy(key)} style={{ padding: '4px 8px', borderRadius: '2px', fontSize: '9px', fontFamily: T.fontMono, cursor: 'pointer', border: `1px solid ${sortBy === key ? T.blue : T.borderLight}`, background: sortBy === key ? T.blueLight : 'transparent', color: sortBy === key ? T.blue : T.textMuted }}>↓ {label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
            {filtered.map(area => <SubAreaCard key={area.id} area={area} onClick={() => onSelectArea(area)} />)}
            {filtered.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '32px', color: T.textMuted, fontFamily: T.fontMono, fontSize: '12px' }}>no matching results</div>
            )}
          </div>
          <div style={{ fontSize: '9px', color: T.textMuted, fontFamily: T.fontMono }}>{isAr ? `عرض ${filtered.length} من ${n} منطقة` : `Showing ${filtered.length} of ${n} regions`}</div>
        </div>
      </div>
    </div>
  );
}

// ── Mini Map Component ───────────────────────────────────────────────────────
function SubAreaMiniMap({ area, isAr, navigate }: { area: LiveSubArea; isAr: boolean; navigate: (path: string) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const depth = area.waterAccumulation?.estimatedDepthCm ?? area.maxWaterDepthCm;
  const floodAreaKm2 = area.waterAccumulation?.estimatedAreaKm2 ?? (area.floodAreaHa / 100);
  const volumeMCM = ((depth / 100) * floodAreaKm2).toFixed(3);
  const depthColor = depth >= 100 ? '#EF4444' : depth >= 50 ? '#F59E0B' : depth >= 20 ? '#42A5F5' : '#66BB6A';

  useEffect(() => {
    if (!mapRef.current) return;
    const container = mapRef.current;
    container.innerHTML = '';
    const delta = area.areaSqKm > 500 ? 0.25 : area.areaSqKm > 100 ? 0.15 : 0.08;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:6px;';
    iframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${area.lng - delta},${area.lat - delta * 0.7},${area.lng + delta},${area.lat + delta * 0.7}&layer=mapnik&marker=${area.lat},${area.lng}`;
    container.appendChild(iframe);
  }, [area.lat, area.lng, area.areaSqKm]);

  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: '4px', padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ fontFamily: T.fontHead, fontSize: '12px', fontWeight: 600, color: T.text, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={13} style={{ color: T.blue }} />
          {isAr ? 'خارطة المنطقة — مساحة وعمق وحجم المياه' : 'Region Map — Water Area, Depth & Volume'}
        </h3>
        <button onClick={() => navigate(`/map?lat=${area.lat}&lng=${area.lng}&zoom=13`)}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: 'rgba(66,165,245,0.1)', border: '1px solid rgba(66,165,245,0.3)', borderRadius: '3px', cursor: 'pointer', color: T.blue, fontSize: '10px', fontFamily: T.fontMono }}>
          <ArrowUpRight size={10} /> {isAr ? 'فتح في الخارطة الرئيسية' : 'Open in Main Map'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '12px' }}>
        <div ref={mapRef} style={{ height: '220px', borderRadius: '6px', background: '#0a1525', overflow: 'hidden', border: '1px solid rgba(66,165,245,0.15)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ background: `${depthColor}12`, border: `1px solid ${depthColor}30`, borderRadius: '4px', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: T.textMuted, fontFamily: T.fontMono, marginBottom: '4px' }}>{isAr ? 'أقصى عمق' : 'Max Depth'}</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: depthColor, fontFamily: T.fontMono, lineHeight: 1 }}>{depth}</div>
            <div style={{ fontSize: '10px', color: T.textMuted, fontFamily: T.fontMono }}>cm</div>
          </div>
          <div style={{ background: 'rgba(66,165,245,0.08)', border: '1px solid rgba(66,165,245,0.2)', borderRadius: '4px', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: T.textMuted, fontFamily: T.fontMono, marginBottom: '4px' }}>{isAr ? 'مساحة الفيضان' : 'Flood Area'}</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: T.blue, fontFamily: T.fontMono, lineHeight: 1 }}>{floodAreaKm2.toFixed(1)}</div>
            <div style={{ fontSize: '10px', color: T.textMuted, fontFamily: T.fontMono }}>km²</div>
          </div>
          <div style={{ background: 'rgba(102,187,106,0.08)', border: '1px solid rgba(102,187,106,0.2)', borderRadius: '4px', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: T.textMuted, fontFamily: T.fontMono, marginBottom: '4px' }}>{isAr ? 'حجم المياه' : 'Water Volume'}</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: T.green, fontFamily: T.fontMono, lineHeight: 1 }}>{volumeMCM}</div>
            <div style={{ fontSize: '10px', color: T.textMuted, fontFamily: T.fontMono }}>MCM</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Solution Scenarios ─────────────────────────────────────────────────────────
function SubAreaSolutions({ area, isAr }: { area: LiveSubArea; isAr: boolean }) {
  const [activeScenario, setActiveScenario] = useState<'quick' | 'medium' | 'comprehensive'>('medium');

  const scenarios = useMemo(() => {
    const areaSqKm = area.areaSqKm;
    const depth = area.waterAccumulation?.estimatedDepthCm ?? area.maxWaterDepthCm;
    type RegionTypeKey = 'coastal_island' | 'industrial' | 'heavy_industrial' | 'airport' | 'wadi' | 'agricultural' | 'desert_remote' | 'heritage_cultural' | 'urban_commercial' | 'urban_residential';
    // تحديد نوع المنطقة بذكاء من area.type + area.nameEn + area.note
    const _name = area.nameEn.toLowerCase();
    const _note = (area.note ?? '').toLowerCase();
    const _base = area.type; // 'residential' | 'commercial' | 'industrial' | 'agricultural' | 'mixed' | 'coastal'
    const rType: RegionTypeKey = (
      // الجزر الساحلية
      (_name.includes('island') || _name.includes('dalma') || _name.includes('western island') || _note.includes('island') || _note.includes('tidal')) ? 'coastal_island' :
      // المطارات
      (_name.includes('airport') || _note.includes('airport')) ? 'airport' :
      // الأودية والمناطق الجبلية
      (_name.includes('wadi') || _name.includes('jabal') || _note.includes('wadi') || _note.includes('mountain') || _note.includes('seasonal wadi')) ? 'wadi' :
      // الصناعي الثقيل (نفط وبتروكيماويات)
      (_note.includes('petroleum') || _note.includes('oil') || _name.includes('ruwais') || _name.includes('habshan') || _name.includes('dhannah port') || _name.includes('das island')) ? 'heavy_industrial' :
      // صناعي عام
      (_base === 'industrial') ? 'industrial' :
      // زراعي
      (_base === 'agricultural' || _name.includes('farms') || _name.includes('farm')) ? 'agricultural' :
      // صحراوي/نائي
      (_name.includes('liwa') || _name.includes('ghayathi') || _name.includes('sila') || _name.includes('hamra') || _note.includes('desert')) ? 'desert_remote' :
      // تجاري/سياحي/فندقي
      (_base === 'commercial' || _name.includes('corniche') || _name.includes('marina') || _name.includes('yas') || _name.includes('saadiyat') || _name.includes('mariya')) ? 'urban_commercial' :
      // سكني حضري (الافتراضي)
      'urban_residential'
    ) as RegionTypeKey;
    const scale = Math.min(areaSqKm, 50);

    // تكلفة الحل لكل كم² حسب طبيعة المنطقة (مليون درهم AED)
    const costFactor =
      rType === 'urban_commercial'  ? 3.5 :
      rType === 'heavy_industrial'  ? 4.5 :
      rType === 'industrial'        ? 3.0 :
      rType === 'airport'           ? 5.0 :
      rType === 'coastal_island'    ? 4.0 :
      rType === 'wadi'              ? 2.5 :
      rType === 'agricultural'      ? 1.5 :
      rType === 'desert_remote'     ? 1.2 :
      rType === 'heritage_cultural' ? 3.8 :
      2.0; // urban_residential

    // حلول سريعة مخصصة حسب نوع المنطقة
    const quickSolutions: string[] = {
      coastal_island:    isAr ? [
        'نشر حواجز بحرية مؤقتة لمنع تدفق مياه البحر للداخل',
        'تشغيل مضخات طوارئ لضخ مياه الفيضان نحو البحر',
        'تعليق الحركة في المناطق الساحلية المنخفضة',
        'إغلاق الممرات السفلية والأنفاق الساحلية',
      ] : [
        'Deploy temporary marine barriers to prevent seawater intrusion',
        'Activate emergency pumps to drain floodwater toward sea',
        'Suspend traffic in low-lying coastal zones',
        'Close coastal underpasses and tunnels',
      ],
      industrial:        isAr ? [
        'إغلاق المصارف ومنع تدفق الملوثات لشبكة الصرف',
        'نشر مضخات صناعية سعة 2000 مجمك/ساعة',
        'تحويل مياه الفيضان لخزانات احتجاز مؤقتة',
        'فحص جودة المياه قبل التصريف',
      ] : [
        'Close industrial drains to prevent pollutant discharge',
        'Deploy industrial pumps (2,000 m³/hr) for rapid drainage',
        'Divert floodwater to temporary containment basins',
        'Test water quality before any discharge',
      ],
      heavy_industrial:  isAr ? [
        'إغلاق طوارئ منافذ الصرف لمنع تسرب الهيدروكربونات',
        'تفعيل بروتوكول طوارئ التسرب النفطي',
        'نشر سدود رملية حول المنشآت الحساسة',
        'تعليق العمليات غير الضرورية في المنشآت النفطية',
      ] : [
        'Emergency shutdown of drainage outlets to prevent hydrocarbon leaks',
        'Activate oil spill emergency protocol',
        'Deploy sandbag barriers around sensitive facilities',
        'Suspend non-essential operations at petrochemical plants',
      ],
      airport:           isAr ? [
        'تشغيل مضخات طوارئ تحت المدارج والمرافئ',
        'تحويل مياه الأمطار لخزانات المطار التحتية',
        'تعليق الرحلات وفق بروتوكول ICAO للفيضانات',
        'تفعيل خطة طوارئ المطار للحوادث المائية',
      ] : [
        'Activate runway/taxiway emergency drainage pumps',
        'Divert rainwater to airport underground cisterns',
        'Suspend flights per ICAO flood emergency protocol',
        'Activate airport flood emergency response plan',
      ],
      wadi:              isAr ? [
        'فتح بوابات السدود لتخفيف ضغط السيل',
        'إغلاق الطرق المتقاطعة مع مجرى الوادي',
        'إخلاء المناطق المنخفضة على جانبي الوادي',
        'تفعيل نظام إنذار مبكر للسيول المفاجئة',
      ] : [
        'Open dam gates to relieve flood pressure',
        'Close roads crossing wadi channels',
        'Evacuate low-lying areas on wadi banks',
        'Activate flash flood early warning system',
      ],
      agricultural:      isAr ? [
        'فتح قنوات الري لتحويل المياه للخزانات الزراعية',
        'حماية المحاصيل بالحواجز الترابية',
        'ضخ المياه الزائدة لخزانات التخزين المؤقت',
        'تقييم الخسائر وتفعيل بروتوكول التعويض',
      ] : [
        'Open irrigation channels to divert water to farm storage',
        'Protect crops with earthen berms',
        'Pump excess water to temporary storage ponds',
        'Assess crop losses and activate compensation protocol',
      ],
      desert_remote:     isAr ? [
        'تحويل مياه السيول نحو المنخفضات الطبيعية',
        'إغلاق طرق الصحراء والتحذير من السيول',
        'مراقبة مستويات السدود الترابية',
        'تفعيل بروتوكول إنقاذ مركبات عالقة',
      ] : [
        'Divert flash flood flows toward natural depressions',
        'Close desert roads and issue wadi crossing warnings',
        'Monitor earthen dam levels remotely',
        'Activate stranded vehicle rescue protocol',
      ],
      heritage_cultural: isAr ? [
        'تغطية المباني التراثية بالأكياس الواقية',
        'نشر مضخات صغيرة للتصريف دون تلف المواقع',
        'توثيق حالة المباني بالصور قبل وبعد الفيضان',
        'تفعيل فريق طوارئ ترميم التراث',
      ] : [
        'Cover heritage buildings with protective sheeting',
        'Deploy small pumps for drainage without site damage',
        'Document building condition before and after flood',
        'Activate heritage emergency restoration team',
      ],
      urban_commercial:  isAr ? [
        'تفعيل مضخات الطوابق السفلية والمواقف التحتية',
        'إغلاق المداخل السفلية للمباني التجارية',
        'تحويل حركة المرور من الشوارع المغمورة',
        'تفعيل بروتوكول طوارئ المراكز التجارية',
      ] : [
        'Activate basement & underground parking drainage pumps',
        'Close lower-ground entrances to commercial buildings',
        'Divert traffic from flooded commercial streets',
        'Activate mall/commercial center flood emergency protocol',
      ],
      urban_residential: isAr ? [
        'نشر مضخات مياه محمولة (500–2000 مجمك/ساعة)',
        'حواجز مؤقتة لتحويل مسار المياه',
        'تنظيف مداخل الصرف المسدودة',
        'تحذيرات إخلاء للمناطق السكنية المنخفضة',
      ] : [
        'Deploy mobile pumps (500–2,000 m³/hr)',
        'Temporary barriers to redirect water flow',
        'Clear blocked drainage inlets',
        'Evacuation warnings for low-lying residential zones',
      ],
    }[rType];

    // حلول متوسطة مخصصة
    const mediumSolutions: string[] = {
      coastal_island:    isAr ? [
        'إنشاء جدران بحرية دائمة ورفع منسوب الأرصفة الساحلية',
        'تركيب بوابات تحكم ذكية في نقاط التصريف الساحلي',
        'تحسين شبكة صرف مياه الأمطار بمعيار العاصفة المئوية',
        'زراعة أشجار المانغروف كحواجز طبيعية للأمواج',
      ] : [
        'Build permanent sea walls & raise coastal promenade elevation',
        'Install smart tide gates at coastal drainage outlets',
        'Upgrade stormwater network to 100-year storm standard',
        'Plant mangrove barriers as natural wave protection',
      ],
      industrial:        isAr ? [
        'إنشاء خزانات ترسيب لفصل الملوثات قبل التصريف',
        'توسيع شبكة الصرف الصناعي بسعة تصريف مضاعفة',
        'تركيب بوابات تحكم آلية للحماية من الفيضانات العكسية',
        'إنشاء خطوط فاصلة بين مياه الأمطار ومياه العمليات',
      ] : [
        'Build sedimentation tanks to filter pollutants before discharge',
        'Expand industrial drainage network with doubled capacity',
        'Install automated flood gates to prevent backflow',
        'Create separate stormwater and process water networks',
      ],
      heavy_industrial:  isAr ? [
        'إنشاء خندق احتجاز محيط بكل منشأة نفطية',
        'تركيب نظام كشف وفصل الهيدروكربونات من مياه الأمطار',
        'رفع منسوب الحواجز الترابية حول الخزانات',
        'تركيب مستشعرات كيميائية في شبكة الصرف',
      ] : [
        'Build containment moat around each petrochemical facility',
        'Install hydrocarbon detection & separation system',
        'Raise earthen berm elevation around storage tanks',
        'Install chemical sensors in drainage network',
      ],
      airport:           isAr ? [
        'توسيع شبكة صرف المدارج وفق معيار ICAO Annex 14',
        'إنشاء خزانات تحت المدارج لتخزين مياه الأمطار',
        'تركيب نظام مراقبة ذكي لمستويات المياه على المدارج',
        'تحسين انحدار المدارج والمرافئ لتسريع التصريف',
      ] : [
        'Upgrade runway drainage to ICAO Annex 14 standard',
        'Build underground cisterns beneath runways for rainwater storage',
        'Install smart water level monitoring on all runways',
        'Re-grade runway/taxiway slopes for faster drainage',
      ],
      wadi:              isAr ? [
        'توسيع مجرى الوادي وإزالة التعديات',
        'إنشاء سدود تحويل لتوزيع السيول على مخزونات تغذية جوفية',
        'زراعة أشجار على جانبي الوادي لتثبيت التربة',
        'تركيب محطات قياس ذكية لمراقبة منسوب السيل',
      ] : [
        'Widen wadi channel & remove encroachments',
        'Build diversion dams to distribute flows to recharge basins',
        'Plant trees on wadi banks to stabilize soil',
        'Install smart gauging stations for real-time flow monitoring',
      ],
      agricultural:      isAr ? [
        'إنشاء خزانات حصاد مياه الأمطار للري التكميلي',
        'تحويل شبكة الري للتنقيط لتقليل الفاقد',
        'زراعة محاصيل مقاومة للفيضانات في المناطق المنخفضة',
        'تركيب محطات طقس للإنذار المبكر للمزارعين',
      ] : [
        'Build rainwater harvesting cisterns for supplemental irrigation',
        'Convert irrigation to drip system to reduce losses',
        'Plant flood-resistant crops in low-lying areas',
        'Install weather stations for early farmer warning',
      ],
      desert_remote:     isAr ? [
        'إنشاء سدود ترابية لتجميع مياه السيول للتغذية الجوفية',
        'تركيب شبكة مستشعرات IoT لمراقبة السيول عن بعد',
        'تحسين طرق الصحراء بمصارف مرفوعة',
        'تطوير خطط إخلاء للمجتمعات البدوية',
      ] : [
        'Build earthen dams to collect flash floods for groundwater recharge',
        'Deploy IoT sensor network for remote wadi monitoring',
        'Upgrade desert roads with raised drainage shoulders',
        'Develop evacuation plans for Bedouin communities',
      ],
      heritage_cultural: isAr ? [
        'تركيب نظام صرف خفي لا يؤثر على أسس المباني التراثية',
        'رفع منسوب الأرضية حول المواقع التراثية',
        'استخدام مواد بناء تقليدية مقاومة للماء',
        'تطوير خطة إدارة مياه الأمطار وفق معايير UNESCO',
      ] : [
        'Install hidden drainage system that preserves heritage building foundations',
        'Raise ground level around heritage sites',
        'Use traditional water-resistant building materials for repairs',
        'Develop UNESCO-compliant stormwater management plan',
      ],
      urban_commercial:  isAr ? [
        'إنشاء خزانات احتجاز تحت الطرق والمواقف',
        'تركيب مضخات ذكية في الطوابق السفلية مع تحكم آلي',
        'إعادة تصميم شبكة صرف الشوارع التجارية',
        'تركيب رصف مسامي في مواقف السيارات والساحات',
      ] : [
        'Build underground retention tanks beneath roads & parking',
        'Install smart pumps in basements with automated control',
        'Redesign commercial street drainage network',
        'Install permeable paving in parking lots & plazas',
      ],
      urban_residential: isAr ? [
        `توسعة شبكة الصرف السكنية بسعة ${Math.round(depth * 0.5)} مجمك/ثانية`,
        'إنشاء خزانات احتجاز مياه أمطار تحت الطرق السكنية',
        'تحسين انحدار الشوارع وتوجيه المياه للأودية',
        'تركيب بوابات تحكم ذكية في نقاط صرف الأحياء السكنية',
      ] : [
        `Expand residential drainage network by ${Math.round(depth * 0.5)} m³/s`,
        'Underground stormwater retention tanks beneath residential roads',
        'Re-grade streets to direct water toward wadis',
        'Smart control gates at residential drainage outlets',
      ],
    }[rType];

    // حلول شاملة مخصصة
    const comprehensiveSolutions: string[] = {
      coastal_island:    isAr ? [
        'نظام حماية ساحلي متكامل مع جدران بحرية وأراضي رطبة صناعية',
        'رفع منسوب جميع المباني الجديدة بمقدار +1.5 متر فوق منسوب البحر',
        'نظام صرف ذكي متكامل مع توقعات ارتفاع منسوب سطح البحر',
        'تحويل مياه الأمطار لخزانات ذكية للري والتبريد',
      ] : [
        'Integrated coastal protection: sea walls + constructed wetlands',
        'Raise all new building elevations +1.5m above sea level',
        'Smart drainage integrated with sea level rise projections',
        'Convert rainwater to smart storage for irrigation & cooling',
      ],
      industrial:        isAr ? [
        'إعادة تخطيط شبكة صرف المنطقة الصناعية بمعيار 100 سنة',
        'إنشاء محطة معالجة مياه أمطار صناعية لإعادة الاستخدام',
        'نظام مراقبة ذكي لجودة مياه الصرف بمعايير البيئة',
        'تحويل مياه الأمطار المعالجة للتبريد الصناعي',
      ] : [
        'Redesign industrial zone drainage to 100-year flood standard',
        'Build industrial stormwater treatment plant for reuse',
        'Smart water quality monitoring system for discharge compliance',
        'Reuse treated stormwater for industrial cooling',
      ],
      heavy_industrial:  isAr ? [
        'منظومة صرف مزدوجة كاملة فصل مياه الأمطار عن مياه العمليات',
        'محطة معالجة متخصصة لفصل الهيدروكربونات وإعادة الاستخدام',
        'رفع منسوب جميع المنشآت الحساسة فوق مستوى الفيضان المئوي',
        'نظام إنذار مبكر متكامل مع مركز عمليات الطوارئ البيئية',
      ] : [
        'Full dual-drainage system separating stormwater from process water',
        'Dedicated hydrocarbon treatment plant for stormwater reuse',
        'Raise all sensitive facility elevations above 100-year flood level',
        'Integrated early warning system linked to environmental emergency center',
      ],
      airport:           isAr ? [
        'إعادة تصميم شبكة صرف المطار بمعيار ICAO للفيضان المئوي',
        'نظام تحكم مركزي ذكي لإدارة مياه المطار بالكامل',
        'خزانات تحت المدارج لتخزين مياه الأمطار وإعادة استخدامها',
        'نظام إنذار مبكر متكامل مع توقعات الطقس والتشغيل',
      ] : [
        'Full airport drainage redesign to ICAO 100-year flood standard',
        'Centralized smart water management for entire airport campus',
        'Underground cisterns beneath runways for rainwater reuse',
        'Integrated early warning system linked to ATC & operations',
      ],
      wadi:              isAr ? [
        'مشروع إحياء الأودية الطبيعية وفق معايير IUCN',
        'منظومة سدود متسلسلة لتحويل السيول لخزانات تغذية جوفية',
        'إعادة تخطيط استخدام الأراضي على جانبي الوادي بمنطقة عازلة',
        'نظام رصد متكامل مع محطات قياس وأقمار صناعية SAR',
      ] : [
        'Wadi restoration project per IUCN nature-based standards',
        'Cascading dam system to divert flows to groundwater recharge',
        'Rezone wadi banks as protected buffer zone (no construction)',
        'Integrated monitoring with gauging stations & SAR satellites',
      ],
      agricultural:      isAr ? [
        'مشروع حصاد مياه الأمطار على مستوى الإمارة لتغذية الزراعة',
        'تحويل المزارع للزراعة المائية والمحاصيل المقاومة',
        'نظام ري ذكي متكامل مع توقعات الطقس',
        'تغذية جوفية منظمة عبر آبار حقن في المناطق الزراعية',
      ] : [
        'Emirate-wide rainwater harvesting for agricultural use',
        'Convert farms to aquaculture & flood-resistant crops',
        'Smart irrigation system integrated with weather forecasts',
        'Managed aquifer recharge via injection wells in farm areas',
      ],
      desert_remote:     isAr ? [
        'شبكة سدود ترابية متكاملة لتغذية طبقات المياه الجوفية',
        'مشروع تغذية جوفية مدار بمنطقة ليوا وفق نموذج الإمارات',
        'طرق صحراوية مرفوعة مع مصارف تصريف جانبية',
        'نظام رصد متكامل عن بعد مع أقمار SAR وIoT',
      ] : [
        'Integrated earthen dam network for aquifer recharge',
        'Liwa Managed Aquifer Recharge project per UAE model',
        'Elevated desert roads with lateral drainage shoulders',
        'Remote monitoring system with SAR satellites & IoT sensors',
      ],
      heritage_cultural: isAr ? [
        'إعادة تصميم شبكة صرف المواقع التراثية وفق معايير UNESCO',
        'رفع منسوب جميع المباني التراثية فوق مستوى الفيضان المئوي',
        'نظام رصد متكامل لحماية المواقع التراثية',
        'تحويل مياه الأمطار لخزانات تراثية للري والصيانة',
      ] : [
        'Redesign heritage site drainage per UNESCO standards',
        'Raise all heritage buildings above 100-year flood level',
        'Integrated monitoring system for heritage site protection',
        'Convert rainwater to heritage cisterns for irrigation & maintenance',
      ],
      urban_commercial:  isAr ? [
        'إعادة تصميم شبكة صرف المنطقة التجارية بمعيار 100 سنة',
        'نظام تحكم مركزي ذكي لإدارة مياه الأمطار في المنطقة التجارية',
        'خزانات احتجاز تحت الطرق لتخزين مياه الأمطار وإعادة استخدامها',
        'رصف مسامي وأسطح خضراء في جميع المناطق التجارية',
      ] : [
        'Full commercial district drainage redesign to 100-year standard',
        'Centralized smart water management for commercial zone',
        'Underground retention tanks for stormwater reuse',
        'Permeable paving & green roofs across all commercial areas',
      ],
      urban_residential: isAr ? [
        'إعادة تصميم شبكة صرف الأحياء السكنية بمعيار 100 سنة',
        'بنية تحتية خضراء وأحواض ترسيب طبيعية في الأحياء',
        'نظام تحكم مركزي ذكي لإدارة مياه الأمطار في المناطق السكنية',
        'خزانات تخزين مياه الأمطار للري والاستخدام المنزلي',
      ] : [
        'Full residential district drainage redesign to 100-year standard',
        'Green infrastructure & natural sedimentation basins in neighborhoods',
        'Centralized smart water management for residential zones',
        'Stormwater storage tanks for garden irrigation & household use',
      ],
    }[rType];

    // مراجع عالمية مخصصة
    const globalRefs = {
      coastal_island:    isAr ? 'هولندا Delta Works: حماية ساحلية لـ 10 ملايين شخص بتكلفة €8 مليار' : 'Netherlands Delta Works: coastal protection for 10M people, €8B cost',
      industrial:        isAr ? 'سنغافورة Jurong Island: صفر تسرب صناعي في فيضانات 2023' : 'Singapore Jurong Island: zero industrial discharge in 2023 floods',
      heavy_industrial:  isAr ? 'هيوستن Ship Channel: فصل مياه الأمطار عن النفط بعد Hurricane Harvey 2017' : 'Houston Ship Channel: stormwater/oil separation after Hurricane Harvey 2017',
      airport:           isAr ? 'مطار شانغي: تخزين 2.5 مليون مجمك/سنة من مياه الأمطار للعمليات' : 'Changi Airport: 2.5M m³/year stormwater harvested for operations',
      wadi:              isAr ? 'الإمارات: مشروع أودية الفجيرة خفض الفيضانات 75% وحصد 50 مليون مجمك/سنة' : 'UAE Fujairah Wadi Project: 75% flood reduction, 50M m³/year harvested',
      agricultural:      isAr ? 'الإمارات: مشروع تغذية المياه الجوفية في العين — 50 مليون مجمك/سنة' : 'UAE Al Ain MAR project: 50M m³/year groundwater recharge from farms',
      desert_remote:     isAr ? 'ليوا MAR: حصاد سيول صحراوي يغذي 40 مليون مجمك/سنة في طبقات المياه الجوفية' : 'Liwa MAR: desert flash flood harvesting recharges 40M m³/year aquifer',
      heritage_cultural: isAr ? 'فينيسيا MOSE: حماية التراث من الفيضانات بتكلفة €5.5 مليار' : 'Venice MOSE: heritage flood protection system, €5.5B investment',
      urban_commercial:  isAr ? 'دبي 2024: نظام صرف ذكي في مركز دبي المالي خفض الفيضانات 85%' : 'Dubai 2024: DIFC smart drainage reduced flooding by 85%',
      urban_residential: isAr ? 'محمد بن زايد: مشروع صرف أمطار أبوظبي خفض الفيضانات السكنية 70% بعد 2024' : 'MBZ City: Abu Dhabi residential stormwater project reduced flooding 70% post-2024',
    }[rType];

    return [
      {
        id: 'quick' as const,
        label: isAr ? 'استجابة سريعة' : 'Quick Response',
        timeframe: isAr ? '1–7 أيام' : '1–7 days',
        color: '#F59E0B', icon: '⚡',
        costMin: Math.round(scale * costFactor * 0.1),
        costMax: Math.round(scale * costFactor * 0.3),
        solutions: quickSolutions,
        globalRef: isAr ? 'دبي 2024: نشر 200 مضخة خلال 6 ساعات' : 'Dubai 2024: 200 pumps deployed within 6 hours',
        reduction: '40–60%',
      },
      {
        id: 'medium' as const,
        label: isAr ? 'حل متوسط المدى' : 'Medium-Term Solution',
        timeframe: isAr ? '3–12 شهر' : '3–12 months',
        color: '#42A5F5', icon: '🔧',
        costMin: Math.round(scale * costFactor * 0.8),
        costMax: Math.round(scale * costFactor * 2.0),
        solutions: mediumSolutions,
        globalRef: globalRefs,
        reduction: '65–80%',
      },
      {
        id: 'comprehensive' as const,
        label: isAr ? 'حل شامل ودائم' : 'Comprehensive Solution',
        timeframe: isAr ? '2–5 سنوات' : '2–5 years',
        color: '#66BB6A', icon: '🏗️',
        costMin: Math.round(scale * costFactor * 3.0),
        costMax: Math.round(scale * costFactor * 8.0),
        solutions: comprehensiveSolutions,
        globalRef: globalRefs,
        reduction: '85–95%',
      },
    ];
  }, [area, isAr]);

  const selected = scenarios.find(s => s.id === activeScenario)!;

  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: '4px', padding: '14px' }}>
      <h3 style={{ fontFamily: T.fontHead, fontSize: '12px', fontWeight: 600, color: T.text, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Zap size={13} style={{ color: T.yellow }} />
        {isAr ? 'سيناريوهات الحلول والتكاليف التقديرية' : 'Solution Scenarios & Estimated Costs'}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
        {scenarios.map(s => (
          <button key={s.id} onClick={() => setActiveScenario(s.id)} style={{
            padding: '10px 8px', borderRadius: '6px', border: `2px solid ${activeScenario === s.id ? s.color : s.color + '33'}`,
            background: activeScenario === s.id ? `${s.color}15` : 'rgba(255,255,255,0.02)',
            cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
          }}>
            <div style={{ fontSize: '18px', marginBottom: '4px' }}>{s.icon}</div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: activeScenario === s.id ? s.color : T.textMuted, fontFamily: T.fontMono }}>{s.label}</div>
            <div style={{ fontSize: '9px', color: T.textMuted, fontFamily: T.fontMono, marginTop: '2px' }}>{s.timeframe}</div>
          </button>
        ))}
      </div>
      <div style={{ background: `${selected.color}08`, borderRadius: '8px', padding: '14px', border: `1px solid ${selected.color}22` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={14} style={{ color: selected.color }} />
            <span style={{ fontSize: '11px', color: T.textSub, fontFamily: T.fontMono }}>{isAr ? 'التكلفة التقديرية:' : 'Estimated Cost:'}</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: selected.color, fontFamily: T.fontMono }}>AED {selected.costMin}M – {selected.costMax}M</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: `${selected.color}15`, padding: '4px 10px', borderRadius: '20px' }}>
            <TrendingUp size={11} style={{ color: selected.color }} />
            <span style={{ fontSize: '10px', color: selected.color, fontFamily: T.fontMono, fontWeight: 700 }}>
              {isAr ? `تخفيض الخطر: ${selected.reduction}` : `Risk Reduction: ${selected.reduction}`}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
          {selected.solutions.map((sol, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: `${selected.color}20`, border: `1px solid ${selected.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                <span style={{ fontSize: '9px', color: selected.color, fontFamily: T.fontMono, fontWeight: 700 }}>{i + 1}</span>
              </div>
              <span style={{ fontSize: '11px', color: T.textSub, fontFamily: T.fontMono, lineHeight: 1.5 }}>{sol}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Globe size={11} style={{ color: T.blue, flexShrink: 0, marginTop: '2px' }} />
          <span style={{ fontSize: '10px', color: T.textMuted, fontFamily: T.fontMono, lineHeight: 1.5 }}>
            <span style={{ color: T.blue, fontWeight: 600 }}>{isAr ? 'مرجع عالمي: ' : 'Global Reference: '}</span>
            {selected.globalRef}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Water Reuse ────────────────────────────────────────────────────────────────
function SubAreaWaterReuse({ area, isAr }: { area: LiveSubArea; isAr: boolean }) {
  const depth = area.waterAccumulation?.estimatedDepthCm ?? area.maxWaterDepthCm;
  const floodAreaKm2 = area.waterAccumulation?.estimatedAreaKm2 ?? (area.floodAreaHa / 100);
  const volumeMCM = (depth / 100) * floodAreaKm2;
  const type = (area as any).type ?? 'residential';

  const reuseApps = useMemo(() => [
    {
      icon: '🌿', label: isAr ? 'ري المساحات الخضراء' : 'Landscape Irrigation',
      volume: (volumeMCM * 0.35).toFixed(3), saving: Math.round(volumeMCM * 0.35 * 1000 * 3.5),
      desc: isAr ? 'ري الحدائق والمسطحات الخضراء والشوارع المشجرة' : 'Parks, green belts & tree-lined streets',
      globalRef: isAr ? 'أبوظبي: إعادة استخدام 100% من المياه المعالجة للري' : 'Abu Dhabi: 100% treated water reuse for irrigation',
      feasibility: 'high',
    },
    {
      icon: '🏗️', label: isAr ? 'مياه البناء والإنشاء' : 'Construction Water',
      volume: (volumeMCM * 0.25).toFixed(3), saving: Math.round(volumeMCM * 0.25 * 1000 * 4.0),
      desc: isAr ? 'خلط الخرسانة وسقي التربة وتثبيت الغبار' : 'Concrete mixing, soil compaction & dust suppression',
      globalRef: isAr ? 'دبي Expo 2020: 40% من مياه البناء معاد تدويرها' : 'Dubai Expo 2020: 40% construction water recycled',
      feasibility: 'high',
    },
    {
      icon: '✈️', label: isAr ? 'عمليات المطار' : 'Airport Operations',
      volume: (volumeMCM * 0.15).toFixed(3), saving: Math.round(volumeMCM * 0.15 * 1000 * 5.5),
      desc: isAr ? 'غسيل الطائرات وتبريد المدارج وصهاريج الإطفاء' : 'Aircraft washing, runway cooling & fire suppression',
      globalRef: isAr ? 'مطار سنغافورة: توفير 2.5 مليون م³/سنة' : 'Singapore Changi: 2.5M m³/year stormwater savings',
      feasibility: type === 'airport' ? 'high' : 'medium',
    },
    {
      icon: '💧', label: isAr ? 'تغذية المياه الجوفية' : 'Groundwater Recharge',
      volume: (volumeMCM * 0.20).toFixed(3), saving: Math.round(volumeMCM * 0.20 * 1000 * 2.0),
      desc: isAr ? 'حقن المياه في طبقات المياه الجوفية عبر آبار الحقن' : 'Aquifer injection via recharge wells',
      globalRef: isAr ? 'الإمارات: مشروع تغذية المياه الجوفية في العين — 50 مليون م³/سنة' : 'UAE Al Ain MAR project: 50M m³/year recharge',
      feasibility: 'medium',
    },
    {
      icon: '🏭', label: isAr ? 'التبريد الصناعي' : 'Industrial Cooling',
      volume: (volumeMCM * 0.05).toFixed(3), saving: Math.round(volumeMCM * 0.05 * 1000 * 6.0),
      desc: isAr ? 'تبريد المحطات الكهربائية والمصانع' : 'Power plants, factories & commercial cooling',
      globalRef: isAr ? 'أبوظبي: نظام التبريد المركزي يوفر 40% طاقة' : 'Abu Dhabi district cooling: 40% energy saving',
      feasibility: type === 'industrial' ? 'high' : 'low',
    },
  ], [volumeMCM, type, isAr]);

  const totalSaving = reuseApps.reduce((s, a) => s + a.saving, 0);
  const feasibilityColor = (f: string) => f === 'high' ? T.green : f === 'medium' ? T.yellow : T.textMuted;

  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: '4px', padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ fontFamily: T.fontHead, fontSize: '12px', fontWeight: 600, color: T.text, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Recycle size={13} style={{ color: T.green }} />
          {isAr ? 'إعادة استخدام مياه الفيضان' : 'Floodwater Reuse Applications'}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(102,187,106,0.1)', padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(102,187,106,0.3)' }}>
          <DollarSign size={11} style={{ color: T.green }} />
          <span style={{ fontSize: '10px', color: T.green, fontFamily: T.fontMono, fontWeight: 700 }}>
            {isAr ? `إجمالي الوفر: AED ${(totalSaving / 1000).toFixed(0)}K` : `Total Saving: AED ${(totalSaving / 1000).toFixed(0)}K`}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {reuseApps.map((app, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: '10px', alignItems: 'start', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '18px', lineHeight: 1.4 }}>{app.icon}</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: T.text, fontFamily: T.fontHead }}>{app.label}</span>
                <span style={{ fontSize: '9px', color: feasibilityColor(app.feasibility), fontFamily: T.fontMono, background: `${feasibilityColor(app.feasibility)}15`, padding: '1px 6px', borderRadius: '10px' }}>
                  {app.feasibility === 'high' ? (isAr ? 'جدوى عالية' : 'High') : app.feasibility === 'medium' ? (isAr ? 'متوسط' : 'Medium') : (isAr ? 'منخفض' : 'Low')}
                </span>
              </div>
              <div style={{ fontSize: '10px', color: T.textMuted, fontFamily: T.fontMono, marginBottom: '4px' }}>{app.desc}</div>
              <div style={{ fontSize: '9px', color: T.blue, fontFamily: T.fontMono }}><Globe size={9} style={{ display: 'inline', marginRight: '3px' }} />{app.globalRef}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: T.green, fontFamily: T.fontMono }}>{app.volume} MCM</div>
              <div style={{ fontSize: '9px', color: T.textMuted, fontFamily: T.fontMono }}>AED {(app.saving / 1000).toFixed(0)}K</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Prevention & Best Practices ────────────────────────────────────────────────
function SubAreaPrevention({ area: _area, isAr }: { area: LiveSubArea; isAr: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const practices = [
    {
      icon: '🌊', title: isAr ? 'البنية التحتية الخضراء (GI)' : 'Green Infrastructure (GI)',
      desc: isAr ? 'الأسطح الخضراء، الحدائق المطرية، الأرصفة المسامية — تخفض الجريان السطحي 20–40%' : 'Green roofs, rain gardens, permeable pavements — reduce runoff 20–40%',
      impact: isAr ? 'متوسط–عالي' : 'Medium–High', cost: isAr ? 'منخفض' : 'Low',
      ref: isAr ? 'نيويورك: برنامج GI وفّر $1.5 مليار مقارنة بالبنية التقليدية' : 'NYC GI program saved $1.5B vs. conventional infrastructure',
    },
    {
      icon: '🏙️', title: isAr ? 'مدينة الإسفنج (Sponge City)' : 'Sponge City Concept',
      desc: isAr ? 'تصميم المدينة لامتصاص 70% من مياه الأمطار محلياً عبر مناطق ترشيح طبيعية' : 'Design cities to absorb 70% of rainfall locally via natural filtration zones',
      impact: isAr ? 'عالي جداً' : 'Very High', cost: isAr ? 'متوسط' : 'Medium',
      ref: isAr ? 'الصين: 30 مدينة إسفنجية — خفض الفيضانات 80%' : 'China: 30 sponge cities — 80% flood reduction',
    },
    {
      icon: '📡', title: isAr ? 'الإنذار المبكر الذكي' : 'Smart Early Warning System',
      desc: isAr ? 'شبكة مستشعرات IoT + نماذج AI تنبؤية تُنذر قبل 6–12 ساعة من الفيضان' : 'IoT sensor network + AI predictive models — 6–12 hour flood warning',
      impact: isAr ? 'عالي (إنقاذ أرواح)' : 'High (life-saving)', cost: isAr ? 'منخفض–متوسط' : 'Low–Medium',
      ref: isAr ? 'هولندا: نظام Flood EWS يغطي 17 مليون شخص بدقة 95%' : 'Netherlands Flood EWS: covers 17M people with 95% accuracy',
    },
    {
      icon: '🌿', title: isAr ? 'استعادة الأودية الطبيعية' : 'Wadi Restoration',
      desc: isAr ? 'إزالة التعديات على مجاري الأودية وتوسيعها لاستيعاب تدفقات الفيضانات الكبرى' : 'Remove encroachments on wadi channels & widen for major flood flows',
      impact: isAr ? 'عالي جداً' : 'Very High', cost: isAr ? 'متوسط' : 'Medium',
      ref: isAr ? 'الإمارات: مشروع أودية الفجيرة خفض الفيضانات 75% في 2024' : 'UAE Fujairah Wadi Project: 75% flood reduction in 2024',
    },
    {
      icon: '🗺️', title: isAr ? 'تخطيط استخدام الأراضي' : 'Land Use Planning',
      desc: isAr ? 'منع البناء في مناطق الفيضان المئوية وتحديد مناطق عازلة طبيعية' : 'Prohibit construction in 100-year floodplains & designate buffer zones',
      impact: isAr ? 'عالي (وقاية طويلة المدى)' : 'High (long-term prevention)', cost: isAr ? 'منخفض' : 'Low',
      ref: isAr ? 'سنغافورة: خرائط الفيضان تُلزم كل مشروع بمراجعة مخاطر الفيضان' : 'Singapore: flood maps mandate flood risk review for all projects',
    },
  ];
  const visiblePractices = expanded ? practices : practices.slice(0, 3);
  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: '4px', padding: '14px' }}>
      <h3 style={{ fontFamily: T.fontHead, fontSize: '12px', fontWeight: 600, color: T.text, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Shield size={13} style={{ color: T.blue }} />
        {isAr ? 'أفضل الممارسات العالمية — الوقاية من التكرار' : 'Global Best Practices — Preventing Recurrence'}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {visiblePractices.map((p, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: '10px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '18px', lineHeight: 1.4 }}>{p.icon}</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: T.text, fontFamily: T.fontHead }}>{p.title}</span>
                <span style={{ fontSize: '9px', color: T.green, fontFamily: T.fontMono, background: 'rgba(102,187,106,0.1)', padding: '1px 6px', borderRadius: '10px' }}>{isAr ? 'التأثير: ' : 'Impact: '}{p.impact}</span>
                <span style={{ fontSize: '9px', color: T.yellow, fontFamily: T.fontMono, background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: '10px' }}>{isAr ? 'التكلفة: ' : 'Cost: '}{p.cost}</span>
              </div>
              <div style={{ fontSize: '10px', color: T.textMuted, fontFamily: T.fontMono, marginBottom: '4px', lineHeight: 1.5 }}>{p.desc}</div>
              <div style={{ fontSize: '9px', color: T.blue, fontFamily: T.fontMono }}><Globe size={9} style={{ display: 'inline', marginRight: '3px' }} />{p.ref}</div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => setExpanded(!expanded)} style={{ marginTop: '10px', width: '100%', padding: '8px', background: 'rgba(66,165,245,0.06)', border: '1px solid rgba(66,165,245,0.2)', borderRadius: '4px', cursor: 'pointer', color: T.blue, fontSize: '10px', fontFamily: T.fontMono, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
        {expanded ? <><ChevronUp size={12} /> {isAr ? 'عرض أقل' : 'Show Less'}</> : <><ChevronDown size={12} /> {isAr ? `عرض ${practices.length - 3} ممارسات إضافية` : `Show ${practices.length - 3} more practices`}</>}
      </button>
    </div>
  );
}

// ── Level 2: Sub-Area View ────────────────────────────────────────────────────
function SubAreaView({ area, city, onBack, onBackToCity }: {
  area: LiveSubArea; city: LiveCity; onBack: () => void; onBackToCity: () => void;
}) {
  const [, navigate] = useLocation();
  const { lang: subLang } = useLanguage();
  const isAr = subLang === 'ar';
  const [timeSelection, setTimeSelection] = useState<HistoricalReplaySelection | null>(null);

  useEffect(() => {
    setTimeSelection(null);
  }, [area.id]);

  const viewArea = useMemo(() => {
    if (!timeSelection) return area;
    const fallbackHumidity = Math.min(95, Math.max(30, Math.round(55 + timeSelection.precipitation * 4)));
    const dynamicDrainageLoad = Math.min(
      100,
      Math.round(
        area.drainageLoad * 0.45 +
        timeSelection.floodRisk * 0.35 +
        Math.min(timeSelection.precipitation * 3.5, 25) +
        Math.min(timeSelection.waterDepthCm * 0.35, 20)
      )
    );

    return {
      ...area,
      currentPrecipitation: Math.round(timeSelection.precipitation * 10) / 10,
      precipitationProbability: Math.round(timeSelection.probability),
      totalLast24h: timeSelection.totalLast24h,
      maxNext48h: timeSelection.maxNext48h,
      floodRisk: timeSelection.floodRisk,
      alertLevel: (timeSelection.floodRisk >= 70 ? 'critical' : timeSelection.floodRisk >= 45 ? 'warning' : timeSelection.floodRisk >= 20 ? 'watch' : 'safe') as LiveSubArea['alertLevel'],
      maxWaterDepthCm: Math.round(timeSelection.waterDepthCm * 10) / 10,
      floodAreaHa: Math.round(timeSelection.affectedAreaHa),
      affectedRoads: Math.round(timeSelection.affectedRoads),
      drainageLoad: dynamicDrainageLoad,
      tempC: Math.round(((timeSelection.temperatureC ?? area.tempC) || 0) * 10) / 10,
      humidity: Math.round(timeSelection.humidity ?? fallbackHumidity),
      currentWindSpeed: Math.round(((timeSelection.windSpeed ?? area.currentWindSpeed) || 0) * 10) / 10,
      lastUpdated: timeSelection.time,
    } as LiveSubArea;
  }, [area, timeSelection]);

  const isManualTimeApplied = !!timeSelection;
  const indicators = [
    { label: isAr ? 'مؤشر خطر الفيضان' : 'Flood Risk Index', value: viewArea.floodRisk, unit: '%', color: viewArea.floodRisk >= 70 ? T.red : viewArea.floodRisk >= 50 ? T.yellow : T.blue, icon: <Activity size={13} />, tooltipId: 'flood-risk-index' },
    { label: isAr ? 'أقصى عمق تراكم' : 'Max Accumulation Depth', value: viewArea.maxWaterDepthCm, unit: 'cm', color: T.blue, icon: <Waves size={13} />, tooltipId: 'max-water-depth' },
    { label: isAr ? 'مساحة الفيضان' : 'Flood Area', value: viewArea.floodAreaHa, unit: 'ha', color: T.blue, icon: <MapPin size={13} /> },
    { label: isAr ? 'هطول حالي' : 'Current Rainfall', value: viewArea.currentPrecipitation, unit: 'mm/hr', color: viewArea.currentPrecipitation > 0 ? T.blue : T.textSub, icon: <Droplets size={13} />, tooltipId: 'precipitation-rate' },
    { label: isAr ? 'مجموع آخر 24ساعة' : 'Total Last 24h', value: viewArea.totalLast24h, unit: 'mm', color: viewArea.totalLast24h > 10 ? T.orange : T.blue, icon: <Calendar size={13} /> },
    { label: isAr ? 'أقصى توقع 48ساعة' : 'Max Next 48h', value: viewArea.maxNext48h, unit: 'mm', color: viewArea.maxNext48h > 10 ? T.red : viewArea.maxNext48h > 5 ? T.yellow : T.green, icon: <TrendingUp size={13} /> },
    { label: isAr ? 'احتمال المطر' : 'Rain Probability', value: viewArea.precipitationProbability, unit: '%', color: viewArea.precipitationProbability > 50 ? T.orange : T.textSub, icon: <Droplets size={13} /> },
    { label: isAr ? 'حمل الصرف' : 'Drainage Load', value: `${viewArea.drainageLoad}%`, unit: '', color: viewArea.drainageLoad >= 80 ? T.red : viewArea.drainageLoad >= 60 ? T.yellow : T.green, icon: <TrendingUp size={13} />, tooltipId: 'drainage-load' },
    { label: isAr ? 'نقاط الصرف' : 'Drainage Points', value: viewArea.drainagePoints, unit: isAr ? 'نقطة' : 'pt', color: T.orange, icon: <Navigation size={13} /> },
    { label: isAr ? 'طرق متأثرة' : 'Affected Roads', value: viewArea.affectedRoads, unit: isAr ? 'طريق' : 'roads', color: viewArea.affectedRoads > 5 ? T.red : viewArea.affectedRoads > 0 ? T.yellow : T.green, icon: <Wind size={13} /> },
    { label: isAr ? 'درجة الحرارة' : 'Temperature', value: viewArea.tempC, unit: '°C', color: T.orange, icon: <Thermometer size={13} />, tooltipId: 'temperature' },
    { label: isAr ? 'الرطوبة' : 'Humidity', value: `${viewArea.humidity}%`, unit: '', color: T.blue, icon: <Droplets size={13} /> },
    { label: isAr ? 'سرعة الرياح' : 'Wind Speed', value: viewArea.currentWindSpeed, unit: 'km/h', color: T.textSub, icon: <Wind size={13} /> },
    { label: isAr ? 'المساحة' : 'Area', value: viewArea.areaSqKm, unit: 'km²', color: T.textSub, icon: <Building2 size={13} /> },
    { label: isAr ? 'السكان' : 'Population', value: viewArea.population.toLocaleString(), unit: '', color: T.textSub, icon: <Building2 size={13} /> },
  ];

  const radarData = [
    { subject: 'Flood Risk', value: viewArea.floodRisk },
    { subject: 'Drainage Load', value: viewArea.drainageLoad },
    { subject: 'Flood Depth', value: Math.min(viewArea.maxWaterDepthCm, 100) },
    { subject: 'Rainfall', value: Math.min(viewArea.currentPrecipitation * 100, 100) },
    { subject: 'Max 48h', value: Math.min(viewArea.maxNext48h * 5, 100) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <AlertBadge level={viewArea.alertLevel} />
            {viewArea.lastUpdated && (
              <span style={{ fontSize: '9px', color: T.textMuted, fontFamily: T.fontMono, display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Clock size={9} /> {isManualTimeApplied ? (isAr ? 'Time View' : 'Time View') : 'Live'} · {new Date(viewArea.lastUpdated).toLocaleString('en', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <span style={{ fontSize: '9px', color: isManualTimeApplied ? T.yellow : T.green, fontFamily: T.fontMono }}>● {isManualTimeApplied ? (isAr ? 'SELECTED TIMESTAMP' : 'SELECTED TIMESTAMP') : 'Open-Meteo'}</span>
          </div>
          <h1 style={{ fontFamily: T.fontHead, fontSize: '20px', fontWeight: 800, color: T.text, marginBottom: '4px' }}>{area.nameAr}</h1>
          <p style={{ fontFamily: T.fontMono, fontSize: '11px', color: T.textMuted }}>{area.nameEn} · {city.nameAr} · {area.lat.toFixed(4)}°N {area.lng.toFixed(4)}°E</p>
          {area.note && (
            <div style={{ marginTop: '8px', padding: '5px 10px', background: 'rgba(245,158,11,0.08)', borderRadius: '3px', fontSize: '11px', color: T.yellow, fontFamily: T.fontMono }}>⚠ {area.note}</div>
          )}
        </div>
        <button onClick={() => navigate(`/map?lat=${area.lat}&lng=${area.lng}&zoom=14`)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: T.blueLight, border: `1px solid ${T.blue}40`, borderRadius: '3px', cursor: 'pointer', color: T.blue, fontSize: '11px', fontFamily: T.fontMono }}>
          <MapPin size={12} /> {isAr ? 'عرض على الخريطة' : 'View on map'} <ArrowUpRight size={10} />
        </button>
      </div>

      {/* All indicators */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <h2 style={{ fontFamily: T.fontHead, fontSize: '13px', fontWeight: 700, color: T.text }}>{isManualTimeApplied ? (isAr ? 'مؤشرات الفترة المختارة' : 'Selected-Time Indicators') : (isAr ? 'مؤشرات حية' : 'Live Indicators')}</h2>
          <MetricTooltip id="all-indicators" size={11} position="bottom" />
          <span style={{ fontSize: '9px', color: isManualTimeApplied ? T.yellow : T.green, fontFamily: T.fontMono, marginLeft: '4px' }}>{isManualTimeApplied ? '● MANUAL TIME · Historical Replay' : '● LIVE · Open-Meteo ERA5 + GFS'}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
          {indicators.map((ind, i) => (
            <KpiCard key={i} icon={ind.icon} label={ind.label} value={ind.value} unit={ind.unit} color={ind.color} tooltipId={ind.tooltipId} />
          ))}
        </div>
      </div>

      {/* Historical/Forecast Chart */}
      <PrecipHistoryChart lat={area.lat} lon={area.lng} regionName={area.nameEn} />

      {/* ── HISTORICAL REPLAY ─────────────────────────────────────────────── */}
      <HistoricalReplay
        regionId={area.id}
        regionName={area.nameEn}
        lat={area.lat}
        lng={area.lng}
        areaSqKm={area.areaSqKm}
        population={area.population}
        elevationM={(area as any).elevation ?? 10}
        color={alertColor(viewArea.alertLevel)}
        onSelectionChange={setTimeSelection}
      />

      {/* Risk profile + Water depth distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: '4px', padding: '14px' }}>
          <h3 style={{ fontFamily: T.fontHead, fontSize: '12px', fontWeight: 600, color: T.text, marginBottom: '8px' }}>{isAr ? 'ملف الخطر' : 'Risk Profile'}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(66,165,245,0.15)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: T.textMuted, fontSize: 9, fontFamily: T.fontMono }} />
              <Radar name={viewArea.nameAr} dataKey="value" stroke={alertColor(viewArea.alertLevel)} fill={alertColor(viewArea.alertLevel)} fillOpacity={0.2} />
              <Tooltip contentStyle={tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: '4px', padding: '14px' }}>
          <h3 style={{ fontFamily: T.fontHead, fontSize: '12px', fontWeight: 600, color: T.text, marginBottom: '8px' }}>{isAr ? 'توزيع مستوى المياه المتوقع' : 'Forecasted Water Level Distribution'}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={[
                { level: '< 10 cm', area: Math.round(viewArea.floodAreaHa * 0.35) },
                { level: '10-25 cm', area: Math.round(viewArea.floodAreaHa * 0.30) },
                { level: '25-50 cm', area: Math.round(viewArea.floodAreaHa * 0.20) },
                { level: '50-100 cm', area: Math.round(viewArea.floodAreaHa * 0.10) },
                { level: '> 1 m', area: Math.round(viewArea.floodAreaHa * 0.05) },
              ]}
              margin={{ top: 5, right: 5, bottom: 20, left: -10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(66,165,245,0.07)" />
              <XAxis dataKey="level" tick={{ fill: T.textMuted, fontSize: 9, fontFamily: T.fontMono }} angle={-25} textAnchor="end" />
              <YAxis tick={{ fill: T.textMuted, fontSize: 9, fontFamily: T.fontMono }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} ha`, 'Area']} />
              <Bar dataKey="area" radius={[2,2,0,0]}>
                {[0,1,2,3,4].map(i => <Cell key={i} fill={['#42A5F5','#1E88E5','#1565C0','#0D47A1','#082060'][i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Water accumulation details */}
      {area.waterAccumulation && (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: '4px', padding: '14px' }}>
          <h3 style={{ fontFamily: T.fontHead, fontSize: '12px', fontWeight: 600, color: T.text, marginBottom: '10px' }}>{isAr ? 'تحليل تراكم المياه — GloFAS + DEM' : 'Water Accumulation Analysis — GloFAS + DEM'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' }}>
            <KpiCard icon={<Waves size={13} />} label={isAr ? 'درجة التراكم' : 'Accumulation Score'} value={area.waterAccumulation.score} unit="/100" color={area.waterAccumulation.score >= 70 ? T.red : area.waterAccumulation.score >= 40 ? T.yellow : T.blue} />
            <KpiCard icon={<Droplets size={13} />} label={isAr ? 'عمق تقديري' : 'Est. Depth'} value={area.waterAccumulation.estimatedDepthCm} unit="cm" color={T.blue} />
            <KpiCard icon={<MapPin size={13} />} label={isAr ? 'مساحة تقديرية' : 'Est. Area'} value={area.waterAccumulation.estimatedAreaKm2} unit="km²" color={T.blue} />
            <KpiCard icon={<Activity size={13} />} label={isAr ? 'قابلية التأثر' : 'Susceptibility'} value={area.waterAccumulation.susceptibility} unit="%" color={T.orange} />
            {area.waterAccumulation.wadiDischarge !== null && (
              <KpiCard icon={<TrendingUp size={13} />} label={isAr ? 'تدفق الوادي' : 'Wadi Discharge'} value={area.waterAccumulation.wadiDischarge?.toFixed(1) ?? '0'} unit="m³/s" color={T.blue} />
            )}
          </div>
          <div style={{ marginTop: '8px', fontSize: '9px', color: T.textMuted, fontFamily: T.fontMono }}>
            {isAr ? 'المصادر: ' : 'Sources: '}{area.waterAccumulation.sources.join(' · ')} · {isAr ? 'التربة: ' : 'Soil: '}{area.waterAccumulation.soilType}
          </div>
        </div>
      )}

      {/* ── MINI MAP ─────────────────────────────────────────────────────── */}
      <SubAreaMiniMap area={area} isAr={isAr} navigate={navigate} />

      {/* ── SOLUTION SCENARIOS ───────────────────────────────────────────── */}
      <SubAreaSolutions area={area} isAr={isAr} />

      {/* ── WATER REUSE ──────────────────────────────────────────────────── */}
      <SubAreaWaterReuse area={area} isAr={isAr} />

      {/* ── PREVENTION & BEST PRACTICES ──────────────────────────────────── */}
      <SubAreaPrevention area={area} isAr={isAr} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RegionsExplorerPage() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const { cities, isLive, loading, lastUpdated } = useLiveRegions();
  const [level, setLevel] = useState<0 | 1 | 2>(0);
  const [selectedCity, setSelectedCity] = useState<LiveCity | null>(null);
  const [selectedArea, setSelectedArea] = useState<LiveSubArea | null>(null);

  const handleSelectCity = (city: LiveCity) => { setSelectedCity(city); setLevel(1); };
  const handleSelectArea = (area: LiveSubArea) => { setSelectedArea(area); setLevel(2); };
  const handleBackToEmirate = () => { setLevel(0); setSelectedCity(null); setSelectedArea(null); };
  const handleBackToCity = () => { setLevel(1); setSelectedArea(null); };

  const tabs = [
    { label: 'Emirate Abu Dhabi', active: level === 0, onClick: handleBackToEmirate },
    { label: selectedCity?.nameAr ?? 'City', active: level === 1, disabled: !selectedCity, onClick: () => selectedCity && setLevel(1) },
    { label: selectedArea?.nameAr ?? 'Region', active: level === 2, disabled: !selectedArea, onClick: () => selectedArea && setLevel(2) },
  ];

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: T.fontHead, direction: isAr ? 'rtl' : 'ltr' }}>
      <div style={{ background: T.bgPanel, borderBottom: `1px solid ${T.border}`, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontFamily: T.fontHead, fontSize: '16px', fontWeight: 800, color: T.text }}>Abu Dhabi Emirate Regions Explorer</h1>
          <span style={{ fontSize: '10px', color: T.textMuted, fontFamily: T.fontMono }}>{cities.flatMap(c => c.subAreas).length} regions · 3 cities</span>
          {loading && <span style={{ fontSize: '9px', color: T.orange, fontFamily: T.fontMono, display: 'flex', alignItems: 'center', gap: '3px' }}><RefreshCw size={9} /> Loading live data...</span>}
          {isLive && !loading && <span style={{ fontSize: '9px', color: T.green, fontFamily: T.fontMono }}>● LIVE · {lastUpdated ? new Date(lastUpdated).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : ''}</span>}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {tabs.map((tab, i) => (
            <button key={i} onClick={tab.onClick} disabled={tab.disabled}
              style={{ padding: '5px 12px', borderRadius: '3px', fontSize: '11px', fontFamily: T.fontMono, cursor: tab.disabled ? 'not-allowed' : 'pointer', background: tab.active ? T.blueLight : 'transparent', border: `1px solid ${tab.active ? T.blue + '60' : T.borderLight}`, color: tab.disabled ? T.textMuted : tab.active ? T.blue : T.textSub, transition: 'all 0.15s' }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {level === 0 && <EmirateView cities={cities} onSelectCity={handleSelectCity} />}
        {level === 1 && selectedCity && <CityView city={selectedCity} onSelectArea={handleSelectArea} onBack={handleBackToEmirate} />}
        {level === 2 && selectedArea && selectedCity && <SubAreaView area={selectedArea} city={selectedCity} onBack={handleBackToEmirate} onBackToCity={handleBackToCity} />}
      </div>
    </div>
  );
}
