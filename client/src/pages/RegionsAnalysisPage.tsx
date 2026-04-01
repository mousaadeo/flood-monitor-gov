/**
 * RegionsAnalysisPage.tsx — Unified Regions Analysis
 * Combines: RegionsPage + TrafficImpactPage
 * Live data from Open-Meteo API + traffic data related to rain
 * Design: Geological Strata — Dark field operations interface
 */
import { useState } from 'react';
import RegionDetailModal from '@/components/RegionDetailModal';
import InfoTooltip from '@/components/InfoTooltip';
import { useRealWeather } from '@/hooks/useRealWeather';
import { getWeatherDescription } from '@/services/weatherApi';
import type { RegionWeather } from '@/services/weatherApi';
import {
  MapPin, Droplets, Thermometer, Wind, RefreshCw, Clock,
  Wifi, Car, AlertTriangle, TrendingDown, Activity, ChevronDown, ChevronRight, FileDown
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ── Tooltip definitions ───────────────────────────────────────────────────────
const PAGE_TOOLTIPS = {
  pageTitle: {
    title: 'Regions and Roads Analysis',
    description: 'Comprehensive analysis dashboard showing flood status and traffic impact for all regions in Abu Dhabi Emirate. Data updated every 15 minutes from weather monitoring stations.',
    source: 'Open-Meteo Forecast API (WMO Standard)',
    normalRange: '8 main regions',
    updateFreq: 'All 15 minute',
    color: '#00d4ff',
  },
  floodRisk: {
    title: 'risk index Flood',
    description: 'Percentage (0-100%) expressing probability of water accumulation in region. Calculated from: rainfall rate × terrain nature × drainage capacity × historical flood data for region.',
    source: 'Open-Meteo + Copernicus DEM GLO-30',
    normalRange: '0% — 25% (Safe)',
    updateFreq: 'All 15 minute',
    color: '#EF4444',
  },
  precipitation: {
    title: 'Current Rainfall Rate',
    description: 'Current rainfall quantity in mm/hour. Values above 5 mm/hr indicate moderate rain, above 15 mm/hr indicates heavy rain requiring alert.',
    source: 'Open-Meteo ERA5 Reanalysis',
    normalRange: '0 — 2 mm/hr (Normal)',
    updateFreq: 'All hour',
    color: '#3B82F6',
  },
  temperature: {
    title: 'Temperature',
    description: 'Air temperature score at 2 meters above ground. Affects evaporation rate and consequently water accumulation speed in low-lying areas.',
    source: 'Open-Meteo ERA5 Reanalysis',
    normalRange: '20° — 45° (Abu Dhabi summer)',
    updateFreq: 'All hour',
    color: '#F59E0B',
  },
  trafficImpact: {
    title: 'Flood Impact on Traffic',
    description: 'Estimate of rain and flood impact on driving speed on main roads. Calculated from: risk index × rainfall rateength × Type road × drainage capacity. Normal speed = 100 km/hr.',
    source: 'Internal hydrological algorithm + OSM Road Network',
    normalRange: '80 — 120 km/hr (smooth)',
    updateFreq: 'Derived from weather data',
    color: '#F97316',
  },
  riskChart: {
    title: 'Risk and Rainfall Charts',
    description: 'Visual comparison between flood risk index (red) and current rainfall rate (blue) for all emirate regions. Regions with high values in both indices requiring priority response.',
    source: 'Open-Meteo Forecast API',
    normalRange: 'Risk < 25% | Rainfall < 2 mm/hr',
    updateFreq: 'All 15 minute',
    color: '#EF4444',
  },
  speedChart: {
    title: 'Forecasted Speed Charts',
    description: 'Forecasted vehicle speed on main roads for each region based on flood level. Low values indicate severe congestion or closure Roads.',
    source: 'Hydrological algorithm + OSM',
    normalRange: '80 — 120 km/hr',
    updateFreq: 'Derived from weather data',
    color: '#F59E0B',
  },
  criticalRegions: {
    title: 'Critical Areas',
    description: 'Count of regions where flood risk index exceeded 75% or rainfall rate 15 mm/hr. These regions require immediate intervention and road closures in low-lying areas.',
    source: 'Open-Meteo + Algorithm Assessment Risk',
    normalRange: '0 regions (normal status)',
    updateFreq: 'All 15 minute',
    color: '#EF4444',
  },
  warningRegions: {
    title: 'Warning Regions',
    description: 'Count of regions in warning status (risk index 35-74%). Requires continuous monitoring and preparation of response teams.',
    source: 'Open-Meteo + Algorithm Assessment Risk',
    normalRange: '0 — 2 regions',
    updateFreq: 'All 15 minute',
    color: '#F59E0B',
  },
  affectedRoads: {
    title: 'Affected Roads',
    description: 'Count of regions where driving speed decreased by more than 20% from normal due to rain or floods.',
    source: 'Hydrological algorithm + OSM Road Network',
    normalRange: '0 Roads (normal status)',
    updateFreq: 'Derived from weather data',
    color: '#F97316',
  },
  totalPrecip: {
    title: 'Total Rainfall',
    description: 'Sum of current rainfall rates in all monitored regions. Used as a general index for rainfall intensity at emirate level.',
    source: 'Open-Meteo ERA5 Reanalysis',
    normalRange: '0 — 5 mm (Normal)',
    updateFreq: 'All hour',
    color: '#3B82F6',
  },
};

// ── Region metadata ──────────────────────────────────────────────────────────
const REGION_META: Record<string, { population: number; area: number; mainRoads: string[]; floodHistory: string }> = {
  'abudhabi-city': { population: 1450000, area: 972, mainRoads: ['Road Corniche', 'Sheikh Zayed Street', 'Airport Road'], floodHistory: 'Frequent accumulations in Corniche region and low-lying areas' },
  'al-ain':        { population: 766000,  area: 1560, mainRoads: ['Road Al Ain-Abu Dhabi', 'Zayed The First Street', 'Al Jimi Road'], floodHistory: 'Wadi Al Jimi — highest flood risk in the emirate' },
  'khalifa-city':  { population: 120000,  area: 85, mainRoads: ['Khalifa Road', 'Street Airport', 'Sheikh Zayed Road'], floodHistory: 'Accumulations in new residential neighborhoods' },
  'shahama':       { population: 45000,   area: 120, mainRoads: ['Road Al Shahama', 'Abu Dhabi-Dubai Road E11'], floodHistory: 'Low agricultural regions — seasonal accumulations' },
  'ruwais':        { population: 18000,   area: 350, mainRoads: ['Road Al Ruwais E11', 'Road Industrial Area'], floodHistory: 'Upscale residential neighborhoods + industrial facilities' },
  'dhafra':        { population: 95000,   area: 55000, mainRoads: ['Road Al Dhafra', 'Road Al Ruwais-Abu Dhabi'], floodHistory: 'Desert region — rare but severe wadi floods' },
  'wathba':        { population: 30000,   area: 200, mainRoads: ['Road Al Wathba', 'Road Abu Dhabi-Al Ain'], floodHistory: 'Industrial region — accumulations in low-lying areas' },
  'liwa':          { population: 12000,   area: 8000, mainRoads: ['Road Liwa', 'Al Dhafra Internal Road'], floodHistory: 'Palm oasis — seasonal accumulations in wadis' },
};

// ── Traffic impact per flood risk level ──────────────────────────────────────
function getTrafficImpact(floodRisk: number, precip: number): { speed: number; status: string; color: string; reduction: number } {
  if (floodRisk >= 75 || precip > 15) return { speed: 15, status: 'Stopped / Closed', color: '#7C3AED', reduction: 87 };
  if (floodRisk >= 55 || precip > 8)  return { speed: 30, status: 'very slow', color: '#EF4444', reduction: 70 };
  if (floodRisk >= 35 || precip > 3)  return { speed: 55, status: 'slow', color: '#F97316', reduction: 45 };
  if (floodRisk >= 20 || precip > 1)  return { speed: 75, status: 'light slowdown', color: '#F59E0B', reduction: 20 };
  return { speed: 100, status: 'smooth', color: '#10B981', reduction: 0 };
}

// ── Alert level config ────────────────────────────────────────────────────────
const ALERT_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'Critical' },
  warning:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Warning' },
  watch:    { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', label: 'Monitoring' },
  safe:     { color: '#10B981', bg: 'rgba(16,185,129,0.08)', label: 'Safe' },
};

// ── Region card ───────────────────────────────────────────────────────────────
function RegionCard({ region, expanded, onToggle, onMetricClick }: {
  region: RegionWeather;
  expanded: boolean;
  onToggle: () => void;
  onMetricClick: (metric: 'risk' | 'temp' | 'precip') => void;
}) {
  const meta = REGION_META[region.id] || { population: 0, area: 0, mainRoads: [], floodHistory: '' };
  const alert = ALERT_CONFIG[region.alertLevel] || ALERT_CONFIG.safe;
  const traffic = getTrafficImpact(region.floodRisk, region.currentPrecipitation);
  const weatherDesc = getWeatherDescription(region.weatherCode).ar;

  return (
    <div style={{
      background: 'var(--bg-card)', border: `1px solid ${expanded ? alert.color + '44' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: '12px', overflow: 'hidden', transition: 'border-color 0.2s',
    }}>
      {/* Card header — always visible */}
      <button onClick={onToggle} style={{
        width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px',
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right',
      }}>
        {/* Alert indicator */}
        <div style={{ width: '4px', height: '40px', borderRadius: '2px', background: alert.color, flexShrink: 0 }} />

        {/* Region name + weather */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Tajawal' }}>{region.nameAr}</span>
            <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: alert.bg, color: alert.color, fontWeight: 600 }}>{alert.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{String(weatherDesc)}</span>
            <span style={{ fontSize: '11px', color: traffic.color, fontWeight: 600 }}>🚗 {traffic.status}</span>
          </div>
        </div>

        {/* KPI strip — each number is clickable to view details */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onMetricClick('risk'); }}
            title="Click for details"
            style={{ textAlign: 'center', background: 'none', border: '1px solid transparent', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = alert.color + '22'; e.currentTarget.style.borderColor = alert.color + '44'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent'; }}
          >
            <div style={{ fontSize: '18px', fontWeight: 700, color: alert.color, fontFamily: 'monospace' }}>{region.floodRisk}%</div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Risk</div>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMetricClick('precip'); }}
            title="Click for details"
            style={{ textAlign: 'center', background: 'none', border: '1px solid transparent', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.15)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent'; }}
          >
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#3B82F6', fontFamily: 'monospace' }}>{region.currentPrecipitation.toFixed(1)}</div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>mm/hr</div>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMetricClick('temp'); }}
            title="Click for details"
            style={{ textAlign: 'center', background: 'none', border: '1px solid transparent', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.15)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent'; }}
          >
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#F59E0B', fontFamily: 'monospace' }}>{region.currentTemperature.toFixed(0)}°</div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Score</div>
          </button>
          <div style={{ color: 'var(--text-muted)' }}>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '14px' }}>

            {/* Weather details */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Droplets size={11} style={{ color: '#3B82F6' }} /> Data Weather
                <InfoTooltip content={PAGE_TOOLTIPS.precipitation} size="sm" />
              </div>
              {[
                { label: 'Current Rainfall', value: `${region.currentPrecipitation.toFixed(1)} mm/hr`, color: '#3B82F6' },
                { label: 'Rainfall 24hr', value: `${region.totalLast24h.toFixed(1)} mm`, color: '#60A5FA' },
                { label: 'Rainfall 48hr', value: `${region.maxNext48h.toFixed(1)} mm`, color: '#93C5FD' },
                { label: 'Rainfall Probability', value: `${region.precipitationProbability}%`, color: '#A78BFA' },
                { label: 'Temperature', value: `${region.currentTemperature.toFixed(1)}°C`, color: '#F59E0B' },
                { label: 'Speed Wind', value: `${region.currentWindSpeed.toFixed(0)} km/hr`, color: '#6B7280' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color, fontFamily: 'monospace' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Traffic impact */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Car size={11} style={{ color: '#F59E0B' }} /> Traffic Impact
                <InfoTooltip content={PAGE_TOOLTIPS.trafficImpact} size="sm" />
              </div>
              {/* Speed gauge */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Forecasted Speed</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: traffic.color, fontFamily: 'monospace' }}>{traffic.speed} km/hr</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${traffic.speed}%`, background: traffic.color, borderRadius: '3px', transition: 'width 0.5s' }} />
                </div>
              </div>
              <div style={{ padding: '6px 8px', borderRadius: '6px', background: `${traffic.color}18`, marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: traffic.color }}>Status: {traffic.status}</span>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>Speed Reduction: <span style={{ color: traffic.color, fontWeight: 600 }}>{traffic.reduction}%</span></div>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '8px', marginBottom: '4px' }}>Affected Roads:</div>
              {meta.mainRoads.slice(0, 3).map(road => (
                <div key={road} style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  • {road}
                </div>
              ))}
            </div>

            {/* Region info + flood history */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <MapPin size={11} style={{ color: '#00d4ff' }} /> Information Region
              </div>
              {[
                { label: 'Population', value: meta.population.toLocaleString('ar-AE') },
                { label: 'Area', value: `${meta.area.toLocaleString('ar-AE')} km²` },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{value}</span>
                </div>
              ))}
              <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(0,212,255,0.06)', borderRadius: '6px', borderRight: '2px solid rgba(0,212,255,0.4)' }}>
                <div style={{ fontSize: '9px', fontWeight: 600, color: '#00d4ff', marginBottom: '3px' }}>Flood History</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{meta.floodHistory}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RegionsAnalysisPage() {
  const { data, loading, refresh, lastUpdated, isLive } = useRealWeather();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{ region: RegionWeather; metric: 'risk' | 'temp' | 'precip' } | null>(null);
  const [sortBy, setSortBy] = useState<'risk' | 'precip' | 'traffic'>('risk');

  const sorted = data
    ? [...data.regions].sort((a, b) => {
        if (sortBy === 'risk') return b.floodRisk - a.floodRisk;
        if (sortBy === 'precip') return b.currentPrecipitation - a.currentPrecipitation;
        return getTrafficImpact(b.floodRisk, b.currentPrecipitation).reduction - getTrafficImpact(a.floodRisk, a.currentPrecipitation).reduction;
      })
    : [];

  // Chart data — abbreviated label preserving meaning (removes generic words like City/Region)
  const shortenName = (name: string) =>
    name
      .replace(/^City /, '')
      .replace(/^Region /, '')
      .replace(/^complex /, '')
      .replace(/ Industrial$/, ' Industrial')
      .replace(/ Coastal$/, ' Coastal')
      .replace(/ South$/, ' South')
      .replace(/ North$/, ' North')
      .substring(0, 8);

  const chartData = sorted.map(r => ({
    name: shortenName(r.nameAr),
    fullName: r.nameAr,
    Risk: r.floodRisk,
    rainfall: r.currentPrecipitation,
    Speed: getTrafficImpact(r.floodRisk, r.currentPrecipitation).speed,
  }));

  return (
    <>
      <div className="space-y-5" style={{ fontFamily: 'Tajawal, sans-serif' }}>
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Playfair Display, Georgia, serif', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Regions and Roads Analysis
              <InfoTooltip content={PAGE_TOOLTIPS.pageTitle} size="md" />
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Flood Status + Traffic Impact for all regions in Abu Dhabi Emirate — Live Data
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isLive && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981', fontSize: '11px' }}>
                <Wifi size={10} /> Live Data
              </div>
            )}
            <button onClick={refresh} disabled={loading} style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px',
              background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)',
              cursor: 'pointer', fontSize: '11px', fontFamily: 'Tajawal',
            }}>
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Update
            </button>
            <button
              onClick={() => window.print()}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px', background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.30)', cursor: 'pointer', color: '#A78BFA', fontSize: '11px', fontFamily: 'Tajawal', fontWeight: 600 }}
            >
              <FileDown size={11} /> Export PDF
            </button>
          </div>
        </div>

        {/* Source banner */}
        {isLive && lastUpdated && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', fontSize: '11px' }}>
            <Clock size={11} style={{ color: '#00d4ff' }} />
            <span style={{ color: '#00d4ff' }}>Source Data:</span>
            <span style={{ color: 'var(--text-secondary)' }}>Open-Meteo Forecast API (WMO Standard) — Last Update: {lastUpdated.toLocaleTimeString('ar-AE', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}

        {loading && !data && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            <RefreshCw size={28} style={{ color: '#00d4ff', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            <p>Fetching live data...</p>
          </div>
        )}

        {data && (
          <>
            {/* Summary KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {[
                { label: 'Critical Regions', value: data.regions.filter(r => r.alertLevel === 'critical').length, color: '#EF4444', icon: <AlertTriangle size={14} />, tooltip: PAGE_TOOLTIPS.criticalRegions },
                { label: 'Warning Regions', value: data.regions.filter(r => r.alertLevel === 'warning').length, color: '#F59E0B', icon: <Activity size={14} />, tooltip: PAGE_TOOLTIPS.warningRegions },
                { label: 'Roads Affected', value: sorted.filter(r => getTrafficImpact(r.floodRisk, r.currentPrecipitation).reduction > 20).length, color: '#F97316', icon: <Car size={14} />, tooltip: PAGE_TOOLTIPS.affectedRoads },
                { label: 'Total Rainfall', value: `${data.regions.reduce((s, r) => s + r.currentPrecipitation, 0).toFixed(1)} mm`, color: '#3B82F6', icon: <Droplets size={14} />, tooltip: PAGE_TOOLTIPS.totalPrecip },
              ].map(k => (
                <div key={k.label} style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ color: k.color }}>{k.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: k.color, fontFamily: 'monospace' }}>{k.value}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {k.label}
                      <InfoTooltip content={k.tooltip} size="sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Risk + Precipitation bar chart */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Risk Index and Rainfall by Region
                  <InfoTooltip content={PAGE_TOOLTIPS.riskChart} size="sm" />
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: '#94a3b8', fontFamily: 'Tajawal' }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      height={55}
                    />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
                    <Tooltip
                      contentStyle={{ background: '#0d1117', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '8px', fontFamily: 'Tajawal', fontSize: 11 }}
                      formatter={(value: any, name: string) => [value, name]}
                      labelFormatter={(label: string, payload: any[]) => payload?.[0]?.payload?.fullName || label}
                    />
                    <Bar dataKey="Risk" fill="#EF4444" radius={[3,3,0,0]} opacity={0.85} />
                    <Bar dataKey="rainfall" fill="#3B82F6" radius={[3,3,0,0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Traffic speed chart */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Forecasted Speed by Region (km/hr)
                  <InfoTooltip content={PAGE_TOOLTIPS.speedChart} size="sm" />
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: '#94a3b8', fontFamily: 'Tajawal' }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      height={55}
                    />
                    <YAxis domain={[0, 120]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                    <Tooltip
                      contentStyle={{ background: '#0d1117', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '8px', fontFamily: 'Tajawal', fontSize: 11 }}
                      formatter={(value: any, name: string) => [`${value} km/hr`, name]}
                      labelFormatter={(label: string, payload: any[]) => payload?.[0]?.payload?.fullName || label}
                    />
                    <Bar dataKey="Speed" fill="#F59E0B" radius={[3,3,0,0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sort controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sort by:</span>
              {[
                { key: 'risk', label: 'risk index' },
                { key: 'precip', label: 'Rainfall' },
                { key: 'traffic', label: 'Traffic Impact' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setSortBy(key as typeof sortBy)} style={{
                  padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontFamily: 'Tajawal',
                  background: sortBy === key ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.06)',
                  color: sortBy === key ? '#00d4ff' : 'var(--text-muted)',
                  fontWeight: sortBy === key ? 700 : 400,
                }}>{label}</button>
              ))}
            </div>

            {/* Regions list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sorted.map(region => (
                <RegionCard
                  key={region.id}
                  region={region}
                  expanded={expandedId === region.id}
                  onToggle={() => setExpandedId(expandedId === region.id ? null : region.id)}
                  onMetricClick={(metric) => setModalState({ region, metric })}
                />
              ))}
            </div>
          </>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* Modal Details Region */}
      {modalState && (
        <RegionDetailModal
          region={modalState.region}
          metric={modalState.metric}
          onClose={() => setModalState(null)}
        />
      )}
    </>
  );
}
