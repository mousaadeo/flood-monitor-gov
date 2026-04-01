// Dashboard.tsx — FloodSat AI Abu Dhabi
// LIVE DATA: Real precipitation & weather from Open-Meteo API
// Design: "Geological Strata" — Dark field operations interface
// Deep ocean navy #0D1B2A + water blues + Playfair headings + Space Mono data

import { useState, useEffect, useCallback } from 'react';
import { useIsMobile } from '@/hooks/useMobile';
import { useRealWeather, computeWeatherSummary, computeAlertSummary } from '@/hooks/useRealWeather';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDataMode } from '@/contexts/DataModeContext';
import KPIDrillDown, { type DrillDownType } from '@/components/KPIDrillDown';
import { getWeatherDescription } from '@/services/weatherApi';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import {
  AlertTriangle, Satellite, Activity, Droplets, RefreshCw,
  Wifi, WifiOff, Thermometer, Clock, Radio, FileDown,
  Map, Mountain, Route, Archive, Brain, Eye, FlaskConical, BarChart3,
  Zap, ChevronLeft, TrendingUp
} from 'lucide-react';
import { useLocation } from 'wouter';
import InfoTooltip, { TOOLTIPS } from '@/components/InfoTooltip';
import NavTooltip from '@/components/NavTooltip';
import MetricTooltip from '@/components/MetricTooltip';
import ExplainerTooltip from '@/components/ExplainerTooltip';
import FullscreenButton, { ExpandableCard } from '@/components/FullscreenButton';
import { floodRiskTrend, alertLevelConfig } from '@/data/mockData';
import { toast } from 'sonner';
import { WATER_COLORS, WATER_LABELS, WATER_ICONS, classifyByDepth } from '@shared/waterStandard';
import { WaterLegend } from '@/components/WaterLegend';

// ── Geological Strata design tokens ──────────────────────────────────────────
const GEO = {
  bg:         '#0D1B2A',
  bgCard:     'rgba(21,34,51,0.88)',
  bgCardHov:  'rgba(28,44,64,0.95)',
  border:     'rgba(66,165,245,0.12)',
  borderAct:  'rgba(66,165,245,0.35)',
  blue:       '#42A5F5',
  blueDark:   '#1565C0',
  teal:       '#4DD0E1',
  green:      '#43A047',
  amber:      '#FFB300',
  red:        '#FF6B35',
  text:       '#E8F4F8',
  textSub:    '#90CAF9',
  textMuted:  '#546E7A',
  fontHead:   'Playfair Display, Georgia, serif',
  fontMono:   'Space Mono, Courier New, monospace',
  fontAr:     'Noto Naskh Arabic, serif',
};

function LiveBadge({ isLive }: { isLive: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '4px 12px',
      borderRadius: '2px',
      background: isLive ? 'rgba(67,160,71,0.10)' : 'rgba(255,107,53,0.10)',
      border: `1px solid ${isLive ? 'rgba(67,160,71,0.30)' : 'rgba(255,107,53,0.30)'}`,
      color: isLive ? GEO.green : GEO.red,
      fontSize: '11px',
      fontFamily: GEO.fontMono,
      fontWeight: 600,
      letterSpacing: '0.05em',
    }}>
      {isLive ? <Wifi size={9} /> : <WifiOff size={9} />}
      <span>{isLive ? 'LIVE DATA' : 'OFFLINE'}</span>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, unit, color, sublabel, pulse, tooltip, onClick, explainerId }: any) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? GEO.bgCardHov : GEO.bgCard,
        backdropFilter: 'blur(12px)',
        borderRight: `1px solid ${hovered ? color + '55' : color + '20'}`,
        borderBottom: `1px solid ${hovered ? color + '55' : color + '20'}`,
        borderLeft: `1px solid ${hovered ? color + '55' : color + '20'}`,
        borderTop: `2px solid ${color}`,
        borderRadius: '4px',
        padding: '16px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        boxShadow: hovered ? `0 8px 32px ${color}18` : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        {/* Hexagonal icon */}
        <div style={{
          width: '36px', height: '36px',
          background: `${color}15`,
          border: `1px solid ${color}30`,
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={15} style={{ color }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {tooltip && <InfoTooltip content={{ ...tooltip, value: `${value} ${unit}`, color }} />}
          {pulse && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '2px 6px',
              background: 'rgba(67,160,71,0.10)',
              color: GEO.green,
              fontSize: '9px',
              fontFamily: GEO.fontMono,
              fontWeight: 700,
              letterSpacing: '0.05em',
              borderRadius: '2px',
            }}>
              <Radio size={7} className="animate-pulse" />
              LIVE
            </span>
          )}
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          {explainerId ? (
            <ExplainerTooltip id={explainerId} position="top">
              <span style={{
                fontFamily: GEO.fontMono,
                fontWeight: 700,
                color,
                fontSize: '2rem',
                lineHeight: 1.1,
                letterSpacing: '-0.04em',
                cursor: 'help',
              }}>
                {value}
              </span>
            </ExplainerTooltip>
          ) : (
            <span style={{
              fontFamily: GEO.fontMono,
              fontWeight: 700,
              color,
              fontSize: '2rem',
              lineHeight: 1.1,
              letterSpacing: '-0.04em',
            }}>
              {value}
            </span>
          )}
          <span style={{ color: GEO.textMuted, fontSize: '12px', fontFamily: GEO.fontMono }}>{unit}</span>
        </div>
        <div style={{ marginTop: '4px', fontFamily: GEO.fontAr, color: GEO.text, fontSize: '12px', fontWeight: 500 }}>{label}</div>
        {sublabel && (
          <div style={{ marginTop: '2px', color: GEO.textMuted, fontSize: '10px', fontFamily: GEO.fontMono }}>{sublabel}</div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: liveData, loading: liveLoading, error: liveError, lastUpdated: liveUpdated, refresh: liveRefresh, isLive: isLiveConn } = useRealWeather();
  const { snapshot, mode } = useDataMode();
  // Use archive data when in ARCHIVE mode, otherwise use live data
  const isArchiveMode = mode === 'archive';
  const archiveData = isArchiveMode && snapshot.regions.length > 0
    ? { regions: snapshot.regions, fetchedAt: snapshot.fetchedAt ?? '', source: 'archive', accumulationSummary: { totalRegionsWithWater: 0, extremeCount: 0, severeCount: 0, moderateCount: 0, minorCount: 0, maxScore: 0, maxScoreRegionId: '', totalEstimatedAreaKm2: 0, activeWadis: 0 } } as import('@/hooks/useRealWeather').ExtendedSystemWeatherData
    : null;
  const data = isArchiveMode ? (archiveData ?? liveData) : liveData;
  const loading = isArchiveMode ? snapshot.isLoading : liveLoading;
  const error = isArchiveMode ? snapshot.error : liveError;
  const lastUpdated = isArchiveMode ? snapshot.fetchedAt : liveUpdated;
  const refresh = isArchiveMode ? () => {} : liveRefresh;
  const isLive = isArchiveMode ? false : isLiveConn;
  const summary = computeWeatherSummary(data);
  const alertSummary = computeAlertSummary(data);
  const { lang, t, dir } = useLanguage();
  const isRtl = dir === 'rtl';
  const isMobile = useIsMobile();
  const [clock, setClock] = useState(new Date());
  const [drillDown, setDrillDown] = useState<DrillDownType | null>(null);
  const openDrillDown = useCallback((type: DrillDownType) => setDrillDown(type), []);
  const closeDrillDown = useCallback(() => setDrillDown(null), []);
  const [, navigate] = useLocation();

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (error) toast.error('Failed to connect to data server', { description: error });
  }, [error]);

  useEffect(() => {
    if (isLive && data) {
      const critical = computeAlertSummary(data).activeRegions.filter(r => r.alertLevel === 'critical');
      if (critical.length > 0) {
        toast.warning(`⚠️ Warning: ${critical.length} regions in critical status`, {
          description: critical.map(r => r.nameEn ?? r.nameAr).join(', '),
          duration: 6000,
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, data]);

  const precipChartData = summary?.chartData.map((d, i) => ({
    idx: i,
    time: d.time.substring(0, 5),
    'Rainfall (mm)': Number(d.actual.toFixed(1)),
    'Probability (%)': d.probability,
    isNow: d.isNow,
  })) || [];
  // Use index to avoid duplicate time values in XAxis (02:00 appears twice in 48hr)
  const nowIdx = precipChartData.findIndex(d => d.isNow);
  const nowIdxFinal = nowIdx >= 0 ? nowIdx : Math.floor(precipChartData.length / 2);

  const regionColors = ['#42A5F5', '#FF6B35', '#FFB300', '#43A047'];
  const regionTrendData = data
    ? floodRiskTrend.map((d, i) => {
        const isLast = i === floodRiskTrend.length - 1;
        return {
          date: d.date,
          'Abu Dhabi City': isLast ? (data.regions.find(r => r.id === 'abudhabi-city')?.floodRisk ?? d.abuDhabiCity) : d.abuDhabiCity,
          'City Al Ain': isLast ? (data.regions.find(r => r.id === 'al-ain')?.floodRisk ?? d.alAin) : d.alAin,
          'Region Al Dhafra': isLast ? (data.regions.find(r => r.id === 'dhafra')?.floodRisk ?? d.alDhafra) : d.alDhafra,
          'Al Wathba': isLast ? (data.regions.find(r => r.id === 'wathba')?.floodRisk ?? d.alWathba) : d.alWathba,
        };
      })
    : floodRiskTrend.map(d => ({
        date: d.date,
        'Abu Dhabi City': d.abuDhabiCity,
        'City Al Ain': d.alAin,
        'Region Al Dhafra': d.alDhafra,
        'Al Wathba': d.alWathba,
      }));

  // Current time line on risk charts
  const todayRiskLabel = regionTrendData[regionTrendData.length - 1]?.date ?? '';

  const tooltipStyle = {
    background: GEO.bgCard,
    border: `1px solid ${GEO.borderAct}`,
    borderRadius: '3px',
    fontSize: '11px',
    color: GEO.text,
    fontFamily: GEO.fontMono,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ── Hero Header ───────────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative',
        padding: isMobile ? '16px' : '24px 28px',
        background: 'linear-gradient(135deg, rgba(13,27,42,0.95) 0%, rgba(21,34,51,0.90) 100%)',
        borderRadius: '6px',
        overflow: 'hidden',
        border: `1px solid ${GEO.border}`,
      }}>
        {/* Contour accent lines */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${GEO.blueDark} 20%, ${GEO.blue} 50%, ${GEO.blueDark} 80%, transparent)` }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(90deg, transparent, ${GEO.border} 50%, transparent)` }} />
        {/* Decorative hex grid */}
        <div style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', opacity: 0.06 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              width: '40px', height: '40px',
              border: `1px solid ${GEO.blue}`,
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              display: 'inline-block',
              margin: '2px',
            }} />
          ))}
        </div>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontFamily: isRtl ? GEO.fontAr : GEO.fontHead, fontWeight: 700, fontSize: '1.7rem', color: GEO.text, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              {t('dashboard.title')}
            </h1>
            <p style={{ color: GEO.textSub, fontSize: '11px', marginTop: '5px', fontFamily: GEO.fontMono, letterSpacing: '0.06em' }}>
              {t('dashboard.subtitle')}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <LiveBadge isLive={isLive} />
            <button
              onClick={() => window.print()}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 14px',
                background: 'rgba(139,92,246,0.10)',
                color: '#A78BFA',
                border: '1px solid rgba(139,92,246,0.28)',
                borderRadius: '2px',
                fontSize: '11px',
                fontFamily: GEO.fontMono,
                cursor: 'pointer',
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}
            >
              <FileDown size={11} />
              {t('dashboard.exportPdf')}
            </button>
            <button
              onClick={refresh}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 14px',
                background: 'rgba(66,165,245,0.10)',
                color: GEO.blue,
                border: `1px solid rgba(66,165,245,0.28)`,
                borderRadius: '2px',
                fontSize: '11px',
                fontFamily: GEO.fontMono,
                cursor: 'pointer',
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
              {loading ? (lang === 'ar' ? 'جارٍ التحديث...' : 'UPDATING...') : t('common.refresh')}
            </button>
            <div style={{ fontFamily: GEO.fontMono, fontSize: '11px', color: GEO.textMuted, letterSpacing: '-0.02em' }}>
              {clock.toLocaleTimeString(lang === 'ar' ? 'ar-AE' : 'en-AE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Data source banner ──────────────────────────────────────────────── */}
      {isLive && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 14px',
          background: 'rgba(66,165,245,0.05)',
          border: `1px solid rgba(66,165,245,0.14)`,
          borderRadius: '3px',
          flexWrap: 'wrap',
        }}>
          <Satellite size={11} style={{ color: GEO.blue }} />
          <span style={{ color: GEO.blue, fontSize: '10px', fontFamily: GEO.fontMono, fontWeight: 700, letterSpacing: '0.06em' }}>{t('common.dataSource')}:</span>
          <span style={{ color: GEO.textSub, fontSize: '10px', fontFamily: GEO.fontMono }}>
            Open-Meteo ERA5 + minutely_15 · GloFAS Flood API · Copernicus CEMS — {t('common.updateEvery')}
          </span>
          {lastUpdated && (
            <span style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '4px', color: GEO.textMuted, fontSize: '10px', fontFamily: GEO.fontMono }}>
              <Clock size={9} />
              {typeof lastUpdated === 'string' ? new Date(lastUpdated).toLocaleTimeString(lang === 'ar' ? 'ar-AE' : 'en-AE', { hour: '2-digit', minute: '2-digit' }) : lastUpdated?.toLocaleTimeString?.(lang === 'ar' ? 'ar-AE' : 'en-AE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {loading && !data && (
        <div style={{
          background: GEO.bgCard,
          border: `1px solid ${GEO.border}`,
          borderRadius: '4px',
          padding: '48px',
          textAlign: 'center',
        }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: GEO.blue, margin: '0 auto 12px' }} />
          <p style={{ color: GEO.textSub, fontFamily: GEO.fontMono, fontSize: '12px' }}>FETCHING LIVE DATA — Open-Meteo ERA5...</p>
          <p style={{ color: GEO.textMuted, fontSize: '10px', marginTop: '4px', fontFamily: GEO.fontMono }}>EMIRATE OF ABU DHABI · 8 REGIONS</p>
        </div>
      )}

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: isMobile ? '8px' : '12px' }}>
          <KPICard icon={AlertTriangle}
            label={summary.activeAlerts > 0 ? (lang === 'ar' ? 'تنبيهات نشطة الآن' : 'Active Alerts Now') : (lang === 'ar' ? 'لا تنبيهات نشطة' : 'No Active Alerts')}
            value={summary.activeAlerts} unit={t('common.alert')}
            color={summary.criticalCount > 0 ? '#EF4444' : summary.warningCount > 0 ? '#FF6B35' : summary.activeAlerts > 0 ? GEO.amber : GEO.green}
            sublabel={
              summary.activeAlerts > 0
                ? `${summary.criticalCount} ${lang === 'ar' ? 'حرجة' : 'CRIT'} · ${summary.warningCount} ${lang === 'ar' ? 'تحذير' : 'WARN'} · ${summary.watchCount} ${lang === 'ar' ? 'مراقبة' : 'WATCH'}`
                : lang === 'ar' ? '✅ الوضع الراهن: آمن' : '✅ Current status: Safe'
            } pulse={summary.activeAlerts > 0}
            tooltip={TOOLTIPS.activeAlerts} onClick={() => openDrillDown('alerts')} explainerId="activeAlerts" />
          <KPICard icon={Droplets}
            label={summary.isRainActive ? (lang === 'ar' ? 'هطول فعلي الآن' : 'Active Rain Now') : t('dashboard.maxRainfall')}
            value={summary.totalPrecip} unit="mm"
            color={summary.isRainActive ? GEO.red : GEO.blue}
            sublabel={summary.isRainActive ? (lang === 'ar' ? 'معدل الساعة الحالية' : 'Current Rate mm/hr') : (lang === 'ar' ? `إجمالي 24ساعة: ${summary.maxTotalPrecip}mm` : `24h Total: ${summary.maxTotalPrecip}mm`)}
            pulse={summary.isRainActive}
            tooltip={TOOLTIPS.precipitation24h} onClick={() => openDrillDown('precipitation')} explainerId="maxRainfall24h" />
          <KPICard icon={Thermometer} label={t('dashboard.avgTemp')} value={summary.avgTemp} unit="°C"
            color={GEO.amber} sublabel={t('dashboard.avgAbuDhabi')} pulse
            tooltip={TOOLTIPS.temperature} onClick={() => openDrillDown('temperature')} explainerId="avgTemperature" />
          <KPICard icon={Activity} label={t('dashboard.maxRisk')} value={summary.maxRisk} unit="%"
            color={GEO.teal} sublabel={lang === 'ar' ? summary.highestRiskRegion.nameAr : summary.highestRiskRegion.nameEn} pulse
            tooltip={TOOLTIPS.floodRiskIndex} onClick={() => openDrillDown('risk')} explainerId="floodRiskIndex" />
          {/* Water Accumulation KPI — from hybrid engine (ERA5 + GloFAS + DEM) — unified waterStandard colors */}
          {(() => {
            const acc = summary.accumulationSummary;
            const total = acc?.totalRegionsWithWater ?? 0;
            // Pick dominant level color from waterStandard
            const dominantLevel = (acc?.extremeCount ?? 0) > 0 ? 'extreme'
              : (acc?.severeCount ?? 0) > 0 ? 'severe'
              : (acc?.moderateCount ?? 0) > 0 ? 'moderate'
              : total > 0 ? 'minor' : 'none';
            const palette = dominantLevel !== 'none' ? WATER_COLORS[dominantLevel as keyof typeof WATER_COLORS] : null;
            const kpiColor = palette?.fill ?? '#06B6D4';
            const kpiIcon = dominantLevel !== 'none' ? WATER_ICONS[dominantLevel as keyof typeof WATER_ICONS] : '💧';
            const levelLabel = dominantLevel !== 'none' ? WATER_LABELS[dominantLevel as keyof typeof WATER_LABELS]?.[lang as 'ar' | 'en'] : '';
            return (
              <KPICard
                icon={Droplets}
                label={lang === 'ar' ? 'مناطق تجمع مائي' : 'Water Pooling'}
                value={total}
                unit={lang === 'ar' ? 'منطقة' : 'zone'}
                color={kpiColor}
                sublabel={
                  total > 0
                    ? `${kpiIcon} ${levelLabel} · ${acc?.extremeCount ?? 0} ${lang === 'ar' ? 'حرج' : 'extreme'} · ${acc?.severeCount ?? 0} ${lang === 'ar' ? 'شديد' : 'severe'}`
                    : lang === 'ar' ? '✅ لا تجمعات مرصودة' : '✅ No pooling detected'
                }
                pulse={total > 0}
                tooltip={lang === 'ar'
                  ? `عدد المناطق التي رصد فيها النظام تجمعات مائية — محسوب من ERA5 + GloFAS + تحليل التضاريس`
                  : `Regions with detected water pooling — computed from ERA5 + GloFAS + DEM analysis`
                }
                explainerId="floodRiskIndex"
              />
            );
          })()}
        </div>
      )}

      {/* ── Executive Briefing Card — executive briefing for leadership ─── */}
      {summary && (
        <div
          onClick={() => navigate('/reports')}
          style={{
            background: 'rgba(13,27,42,0.95)',
            border: `1px solid ${summary.maxRisk >= 70 ? 'rgba(239,68,68,0.45)' : summary.maxRisk >= 50 ? 'rgba(255,107,53,0.45)' : 'rgba(66,165,245,0.35)'}`,
            borderRadius: '4px', overflow: 'hidden', cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = summary.maxRisk >= 70 ? 'rgba(239,68,68,0.7)' : 'rgba(66,165,245,0.6)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = summary.maxRisk >= 70 ? 'rgba(239,68,68,0.45)' : summary.maxRisk >= 50 ? 'rgba(255,107,53,0.45)' : 'rgba(66,165,245,0.35)'}
        >
          {/* Strip indicator */}
          <div style={{
            height: '3px',
            background: summary.maxRisk >= 70
              ? 'linear-gradient(90deg, #EF4444, #FF6B35)'
              : summary.maxRisk >= 50
              ? 'linear-gradient(90deg, #FF6B35, #FFB300)'
              : 'linear-gradient(90deg, #42A5F5, #4DD0E1)',
          }} />

          <div style={{ display: 'flex', alignItems: 'stretch' }}>

            {/* Left: Risk score */}
            <div style={{
              padding: '16px 20px',
              borderLeft: `1px solid ${GEO.border}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minWidth: '100px', background: 'rgba(0,0,0,0.2)',
            }}>
              <div style={{
                fontSize: '42px', fontWeight: 800, lineHeight: 1,
                fontFamily: GEO.fontMono,
                color: summary.maxRisk >= 70 ? '#EF4444' : summary.maxRisk >= 50 ? GEO.red : GEO.amber,
              }}>
                {summary.maxRisk}
              </div>
              <div style={{ fontSize: '10px', color: GEO.textMuted, fontFamily: GEO.fontMono, marginTop: '2px' }}>%</div>
              <div style={{
                marginTop: '6px', padding: '2px 8px', borderRadius: '3px', fontSize: '10px', fontWeight: 700,
                fontFamily: GEO.fontMono,
                background: summary.maxRisk >= 70 ? 'rgba(239,68,68,0.15)' : summary.maxRisk >= 50 ? 'rgba(255,107,53,0.15)' : 'rgba(255,179,0,0.15)',
                color: summary.maxRisk >= 70 ? '#EF4444' : summary.maxRisk >= 50 ? GEO.red : GEO.amber,
                border: `1px solid ${summary.maxRisk >= 70 ? 'rgba(239,68,68,0.3)' : summary.maxRisk >= 50 ? 'rgba(255,107,53,0.3)' : 'rgba(255,179,0,0.3)'}`,
              }}>
                {summary.maxRisk >= 70 ? 'Critical' : summary.maxRisk >= 50 ? 'High' : 'Average'}
              </div>
            </div>

            {/* Center: Key info */}
            <div style={{ flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Brain size={14} style={{ color: GEO.blue, flexShrink: 0 }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: GEO.textMuted, fontFamily: GEO.fontMono, letterSpacing: '0.08em' }}>{t('dashboard.executiveBriefing')}</span>
              </div>

              {/* 3 metrics inline */}
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: GEO.blue, fontFamily: GEO.fontMono }}>{summary.totalPrecip}<span style={{ fontSize: '11px', color: GEO.textMuted }}> mm</span></div>
                  <div style={{ fontSize: '10px', color: GEO.textMuted, fontFamily: GEO.fontMono }}>{t('dashboard.rainfall24h')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: GEO.red, fontFamily: GEO.fontMono }}>{summary.activeAlerts}<span style={{ fontSize: '11px', color: GEO.textMuted }}> alert</span></div>
                  <div style={{ fontSize: '10px', color: GEO.textMuted, fontFamily: GEO.fontMono }}>{t('dashboard.activeAlerts')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: GEO.teal, fontFamily: isRtl ? GEO.fontAr : GEO.fontHead }}>{lang === 'ar' ? summary.highestRiskRegion.nameAr : summary.highestRiskRegion.nameEn}</div>
                  <div style={{ fontSize: '10px', color: GEO.textMuted, fontFamily: GEO.fontMono }}>{t('dashboard.highestRiskRegion')}</div>
                </div>
              </div>

              {/* Action hint */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={11} style={{ color: GEO.amber, flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: GEO.textSub }}>
                  {summary.highestSeverity === 'critical'
                    ? t('dashboard.statusCritical')
                    : summary.highestSeverity === 'warning' || summary.highestSeverity === 'watch'
                    ? t('dashboard.statusHigh')
                    : t('dashboard.statusSafe')}
                </span>
              </div>
            </div>

            {/* Right: CTA */}
            <div style={{
              padding: '14px 16px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              borderRight: `1px solid ${GEO.border}`, gap: '6px', minWidth: '80px',
            }}>
              <ChevronLeft size={18} style={{ color: GEO.textMuted }} />
              <span style={{ fontSize: '10px', color: GEO.textMuted, fontFamily: GEO.fontMono, textAlign: 'center', lineHeight: 1.4 }}>{t('dashboard.executiveSummary')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Access — fast links for decision makers ──────────────────────── */}
      <div style={{ background: GEO.bgCard, border: `1px solid ${GEO.border}`, borderRadius: '4px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ fontFamily: isRtl ? GEO.fontAr : GEO.fontHead, fontWeight: 600, fontSize: '0.9rem', color: GEO.text }}>{t('dashboard.quickAccess')}</h2>
          <span style={{ fontFamily: GEO.fontMono, fontSize: '9px', color: GEO.textMuted, letterSpacing: '0.08em' }}>{t('dashboard.quickAccess').toUpperCase()}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
          {[
            { icon: Map,         labelKey: 'nav.map',          descKey: 'nav.mapDesc',          path: '/map',              color: GEO.blue,    tooltipKey: 'map' },
            { icon: Mountain,    labelKey: 'nav.dem',          descKey: 'nav.demDesc',          path: '/dem',              color: GEO.teal,    tooltipKey: 'dem' },
            { icon: Route,       labelKey: 'nav.roadNetwork',  descKey: 'nav.roadNetworkDesc',  path: '/road-network',     color: GEO.amber,   tooltipKey: 'road-network' },
            { icon: Brain,       labelKey: 'nav.decision',     descKey: 'nav.decisionDesc',     path: '/decision-support', color: '#A78BFA',   tooltipKey: 'decision-support' },
            { icon: Archive,     labelKey: 'nav.archive',      descKey: 'nav.archiveDesc',      path: '/archive',          color: '#F472B6',   tooltipKey: 'archive' },
            { icon: FlaskConical,labelKey: 'nav.simulation',   descKey: 'nav.simulationDesc',   path: '/simulation',       color: GEO.green,   tooltipKey: 'scenarios' },
            { icon: Eye,         labelKey: 'nav.uncertainty',  descKey: 'nav.uncertaintyDesc',  path: '/uncertainty',      color: '#FB923C',   tooltipKey: 'uncertainty-map' },
            { icon: BarChart3,   labelKey: 'nav.reports',      descKey: 'nav.reportsDesc',      path: '/reports',          color: GEO.textSub, tooltipKey: 'reports' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px',
                  padding: '12px', borderRadius: '4px', cursor: 'pointer', textAlign: 'right',
                  background: `${item.color}08`,
                  border: `1px solid ${item.color}20`,
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = `${item.color}15`;
                  (e.currentTarget as HTMLElement).style.border = `1px solid ${item.color}45`;
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = `${item.color}08`;
                  (e.currentTarget as HTMLElement).style.border = `1px solid ${item.color}20`;
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                }}
              >
                {/* ? icon — top-left corner */}
                <div
                  style={{ position: 'absolute', top: '5px', left: '5px' }}
                  onClick={e => e.stopPropagation()}
                >
                  <NavTooltip pageKey={item.tooltipKey} size={11} position="right" />
                </div>
                <div style={{
                  width: '28px', height: '28px',
                  background: `${item.color}18`,
                  border: `1px solid ${item.color}30`,
                  borderRadius: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={13} style={{ color: item.color }} />
                </div>
                <div style={{ fontFamily: isRtl ? GEO.fontAr : 'Inter, sans-serif', fontSize: '11px', fontWeight: 600, color: GEO.text }}>{t(item.labelKey as any)}</div>
                <div style={{ fontFamily: isRtl ? GEO.fontAr : 'Inter, sans-serif', fontSize: '9px', color: GEO.textMuted, lineHeight: 1.3 }}>{t(item.descKey as any)}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Charts row ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '12px' }}>
        {/* Precipitation chart */}
        <div style={{ background: GEO.bgCard, border: `1px solid ${GEO.border}`, borderRadius: '4px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h2 style={{ fontFamily: isRtl ? GEO.fontAr : GEO.fontHead, fontWeight: 600, fontSize: '0.95rem', color: GEO.text }}>
                  {t('dashboard.rainfall48h')}
                </h2>
                <MetricTooltip id="precipitation-48h" size={12} position="bottom" />
              </div>
              <p style={{ color: GEO.textMuted, fontSize: '10px', marginTop: '2px', fontFamily: GEO.fontMono }}>
                Open-Meteo ERA5 · Abu Dhabi City
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isLive && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', background: 'rgba(67,160,71,0.10)', color: GEO.green, fontSize: '9px', fontFamily: GEO.fontMono, fontWeight: 700, borderRadius: '2px' }}>
                  <Radio size={7} className="animate-pulse" />
                  LIVE
                </span>
              )}
              <FullscreenButton size={11} variant="icon" color={GEO.textMuted} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={precipChartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <defs>
                <linearGradient id="geoBlueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GEO.blue} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={GEO.blue} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="geoAmberGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GEO.amber} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={GEO.amber} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(66,165,245,0.07)" />
              <XAxis dataKey="idx" type="number" domain={[0, precipChartData.length - 1]}
                tickFormatter={(v: number) => precipChartData[v]?.time ?? ''}
                ticks={precipChartData.filter((_, i) => i % 8 === 0).map(d => d.idx)}
                tick={{ fill: GEO.textMuted, fontSize: 9, fontFamily: GEO.fontMono }} />
              <YAxis yAxisId="left" tick={{ fill: GEO.textMuted, fontSize: 9, fontFamily: GEO.fontMono }} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fill: GEO.textMuted, fontSize: 9, fontFamily: GEO.fontMono }} />
              <Tooltip contentStyle={tooltipStyle}
                labelFormatter={(v: number) => precipChartData[v]?.time ?? String(v)} />
              <Legend wrapperStyle={{ fontSize: '10px', fontFamily: GEO.fontMono }} />
              <Area yAxisId="left" type="monotone" dataKey="Rainfall (mm)" stroke={GEO.blue} strokeWidth={2} fill="url(#geoBlueGrad)" />
              <Area yAxisId="right" type="monotone" dataKey="Probability (%)" stroke={GEO.amber} strokeWidth={1.5} strokeDasharray="4 3" fill="url(#geoAmberGrad)" />
              {nowIdxFinal > 0 && nowIdxFinal < precipChartData.length - 1 && (
                <ReferenceLine yAxisId="left" x={nowIdxFinal} stroke="#FFFFFF" strokeWidth={2}
                  ifOverflow="visible"
                  label={{ value: '\u25bc NOW', position: 'insideTopLeft', fill: '#FFFFFF', fontSize: 9, fontWeight: 700, fontFamily: GEO.fontMono }} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Alert feed */}
        <div style={{ background: GEO.bgCard, border: `1px solid ${GEO.border}`, borderRadius: '4px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <h2 style={{ fontFamily: isRtl ? GEO.fontAr : GEO.fontHead, fontWeight: 600, fontSize: '0.95rem', color: GEO.text }}>{t('dashboard.alertStatus')}</h2>
            <MetricTooltip id="alerts-status" size={12} position="bottom" />
          </div>
            {data && (
              <span style={{
                fontFamily: GEO.fontMono,
                fontSize: '10px',
                padding: '2px 8px',
                background: summary?.highestSeverity === 'critical'
                  ? 'rgba(255,107,53,0.12)'
                  : summary?.highestSeverity === 'warning'
                  ? 'rgba(255,179,0,0.12)'
                  : summary?.highestSeverity === 'watch'
                  ? 'rgba(77,208,225,0.12)'
                  : 'rgba(67,160,71,0.12)',
                color: summary?.highestSeverity === 'critical'
                  ? GEO.red
                  : summary?.highestSeverity === 'warning'
                  ? GEO.amber
                  : summary?.highestSeverity === 'watch'
                  ? GEO.teal
                  : GEO.green,
                borderRadius: '2px'
              }}>
                {alertSummary.activeAlerts} {lang === 'ar' ? 'نشط' : 'ACTIVE'}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1, maxHeight: '220px' }}>
            {alertSummary.activeRegions.map(region => {
              const cfg = alertLevelConfig[region.alertLevel];
              const wmo = getWeatherDescription(region.weatherCode);
              return (
                <div key={region.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '10px 12px',
                  background: `${cfg.color}08`,
                  borderTop: `1px solid ${cfg.color}22`,
                  borderBottom: `1px solid ${cfg.color}22`,
                  borderLeft: `1px solid ${cfg.color}22`,
                  borderRight: `3px solid ${cfg.color}`,
                  borderRadius: '3px',
                }}>
                  <AlertTriangle size={13} style={{ color: cfg.color, flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <span style={{ fontFamily: GEO.fontAr, fontSize: '12px', fontWeight: 600, color: cfg.color }}>{region.nameAr}</span>
                      <span style={{ fontFamily: GEO.fontMono, fontSize: '9px', padding: '1px 5px', background: `${cfg.color}18`, color: cfg.color, borderRadius: '2px', flexShrink: 0 }}>
                        {cfg.label}
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', marginTop: '3px', color: GEO.textSub, fontFamily: GEO.fontAr }}>
                      {wmo.icon} {wmo.ar} — {region.currentPrecipitation} mm/hour
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '3px' }}>
                      <span style={{ fontSize: '9px', color: GEO.textMuted, fontFamily: GEO.fontMono }}>Open-Meteo</span>
                      <span style={{ fontFamily: GEO.fontMono, fontSize: '10px', fontWeight: 700, color: cfg.color }}>
                        {region.floodRisk}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {data && alertSummary.activeAlerts === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>✅</div>
                <p style={{ fontSize: '12px', color: GEO.green, fontFamily: isRtl ? GEO.fontAr : 'Inter, sans-serif' }}>{t('dashboard.allRegionsSafe')}</p>
                <p style={{ fontSize: '10px', marginTop: '4px', color: GEO.textMuted, fontFamily: GEO.fontMono }}>{t('dashboard.noActiveAlerts')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Risk trend chart ─────────────────────────────────────────────────── */}
      <div style={{ background: GEO.bgCard, border: `1px solid ${GEO.border}`, borderRadius: '4px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h2 style={{ fontFamily: isRtl ? GEO.fontAr : GEO.fontHead, fontWeight: 600, fontSize: '0.95rem', color: GEO.text }}>
                  {t('dashboard.floodRiskTrend')}
                </h2>
                <MetricTooltip id="flood-risk-7days" size={12} position="bottom" />
              </div>
            <p style={{ color: GEO.textMuted, fontSize: '10px', marginTop: '2px', fontFamily: GEO.fontMono }}>
              {t('dashboard.lastPointLive')}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isLive && (
              <span style={{ padding: '2px 8px', background: 'rgba(66,165,245,0.10)', color: GEO.blue, fontSize: '9px', fontFamily: GEO.fontMono, fontWeight: 700, borderRadius: '2px' }}>
                LAST POINT LIVE
              </span>
            )}
            <FullscreenButton size={11} variant="icon" color={GEO.textMuted} />
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={regionTrendData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(66,165,245,0.07)" />
            <XAxis dataKey="date" tick={{ fill: GEO.textMuted, fontSize: 9, fontFamily: GEO.fontMono }} />
            <YAxis domain={[0, 100]} tick={{ fill: GEO.textMuted, fontSize: 9, fontFamily: GEO.fontMono }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: '10px', fontFamily: GEO.fontMono }} />
            <ReferenceLine x={todayRiskLabel} stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 3"
              label={{ value: 'Today', position: 'insideTopRight', fill: '#F59E0B', fontSize: 9, fontFamily: GEO.fontMono }} />
            {['Abu Dhabi City', 'City Al Ain', 'Region Al Dhafra', 'Al Wathba'].map((name, i) => (
              <Line key={name} type="monotone" dataKey={name}
                stroke={regionColors[i]} strokeWidth={2} dot={{ r: 3, fill: regionColors[i] }} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Regions grid ─────────────────────────────────────────────────────── */}
      {data && (
        <div style={{ background: GEO.bgCard, border: `1px solid ${GEO.border}`, borderRadius: '4px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ fontFamily: isRtl ? GEO.fontAr : GEO.fontHead, fontWeight: 600, fontSize: '0.95rem', color: GEO.text }}>
              {t('dashboard.regionStatus')}
            </h2>
            <span style={{ fontFamily: GEO.fontMono, fontSize: '10px', color: GEO.textMuted }}>
              {'fetchedAt' in data ? new Date(data.fetchedAt).toLocaleTimeString('ar-AE', { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '10px' }}>
            {data.regions.map(region => {
              const cfg = alertLevelConfig[region.alertLevel];
              const wmo = getWeatherDescription(region.weatherCode);
              // ✅ waterStandard unified colors for water accumulation
              const wacc = (region as any).waterAccumulation;
              const waccLevel = wacc?.level ?? 'none';
              const waccPalette = waccLevel !== 'none' ? WATER_COLORS[waccLevel as keyof typeof WATER_COLORS] : null;
              const waccIcon = waccLevel !== 'none' ? WATER_ICONS[waccLevel as keyof typeof WATER_ICONS] : null;
              const waccLabel = waccLevel !== 'none' ? WATER_LABELS[waccLevel as keyof typeof WATER_LABELS]?.[lang as 'ar' | 'en'] : null;
              return (
                <div key={region.id} style={{
                  padding: '12px',
                  background: `${cfg.color}07`,
                  borderRight: `1px solid ${cfg.color}22`,
                  borderBottom: `1px solid ${cfg.color}22`,
                  borderLeft: `1px solid ${cfg.color}22`,
                  borderTop: `2px solid ${waccPalette?.fill ?? cfg.color}`,
                  borderRadius: '3px',
                  position: 'relative',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontFamily: isRtl ? GEO.fontAr : 'Inter, sans-serif', fontWeight: 600, fontSize: '12px', color: GEO.text }}>{lang === 'ar' ? region.nameAr : region.nameEn}</span>
                    <span style={{
                      padding: '1px 6px',
                      background: `${cfg.color}18`,
                      color: cfg.color,
                      border: `1px solid ${cfg.color}30`,
                      fontSize: '9px',
                      fontFamily: GEO.fontMono,
                      fontWeight: 700,
                      borderRadius: '2px',
                    }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 6px' }}>
                    {[
                      { label: t('common.rainfall'), value: `${region.currentPrecipitation} mm`, color: GEO.blue },
                      { label: t('common.24h'), value: `${region.totalLast24h} mm`, color: GEO.amber },
                      { label: t('common.temperature'), value: `${region.currentTemperature}°`, color: GEO.text },
                      { label: t('common.risk'), value: `${region.floodRisk}%`, color: cfg.color, explainerId: 'floodRiskIndex' as const },
                    ].map(item => (
                      <div key={item.label}>
                        <div style={{ fontSize: '9px', color: GEO.textMuted, fontFamily: GEO.fontMono }}>{item.label}</div>
                        {'explainerId' in item && item.explainerId ? (
                          <ExplainerTooltip id={item.explainerId} position="top">
                            <span style={{ fontSize: '13px', fontFamily: GEO.fontMono, fontWeight: 700, color: item.color, letterSpacing: '-0.03em', cursor: 'help' }}>{item.value}</span>
                          </ExplainerTooltip>
                        ) : (
                          <div style={{ fontSize: '13px', fontFamily: GEO.fontMono, fontWeight: 700, color: item.color, letterSpacing: '-0.03em' }}>{item.value}</div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '8px', height: '2px', background: 'rgba(255,255,255,0.07)', borderRadius: '1px' }}>
                    <div style={{ height: '2px', borderRadius: '1px', width: `${region.floodRisk}%`, background: cfg.color, transition: 'width 1s ease' }} />
                  </div>
                  <div style={{ marginTop: '5px', fontSize: '10px', color: GEO.textMuted, fontFamily: GEO.fontAr }}>
                    {wmo.icon} {wmo.ar}
                  </div>
                  {/* ✅ Water accumulation indicator — unified waterStandard */}
                  {waccPalette && wacc && (
                    <div style={{
                      marginTop: '6px',
                      padding: '4px 7px',
                      background: `${waccPalette.mapFill}`,
                      border: `1px solid ${waccPalette.mapStroke}`,
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '4px',
                    }}>
                      <span style={{ fontSize: '9px', color: waccPalette.fill, fontWeight: 700, fontFamily: GEO.fontAr }}>
                        {waccIcon} {waccLabel}
                      </span>
                      <span style={{ fontSize: '8px', color: waccPalette.fill, fontFamily: GEO.fontMono, fontWeight: 600 }}>
                        {lang === 'ar' ? `عمق: ${wacc.estimatedDepthCm}سم` : `${wacc.estimatedDepthCm}cm`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── System stats footer ──────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(13,27,42,0.95) 0%, rgba(21,34,51,0.90) 100%)',
        border: `1px solid ${GEO.border}`,
        borderRadius: '4px',
        padding: '20px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(90deg, transparent, ${GEO.blue} 50%, transparent)` }} />
          <h2 style={{ fontFamily: isRtl ? GEO.fontAr : GEO.fontHead, fontWeight: 600, fontSize: '0.9rem', color: GEO.text, marginBottom: '16px' }}>
          {t('dashboard.systemStats')}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '16px' }}>
          {[
            { label: t('dashboard.coverageArea'), value: '67,340', unit: 'km²', color: GEO.blue },
            { label: t('dashboard.satCoverage'), value: '98.7', unit: '%', color: GEO.green },
            { label: t('dashboard.updateInterval'), value: '10', unit: lang === 'ar' ? 'دق' : 'min', color: GEO.amber },
            { label: t('dashboard.modelAccuracy'), value: '92.4', unit: '%', color: GEO.teal },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: GEO.fontMono, fontWeight: 700, fontSize: '1.75rem', color: stat.color, letterSpacing: '-0.04em', lineHeight: 1 }}>
                {stat.value}
                <span style={{ fontSize: '11px', fontWeight: 400, color: GEO.textMuted, marginRight: '3px' }}>{stat.unit}</span>
              </div>
              <div style={{ fontSize: '9px', color: GEO.textMuted, fontFamily: GEO.fontMono, letterSpacing: '0.08em', marginTop: '4px' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Drill-Down Modal */}
      {drillDown && data && (
        <KPIDrillDown
          type={drillDown}
          regions={data.regions}
          onClose={closeDrillDown}
        />
      )}
    </div>
  );
}
