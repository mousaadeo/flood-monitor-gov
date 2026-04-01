/**
 * DecisionSupportPage — Decision Support Dashboard
 * Flood memory system: drainage lag, soil saturation, active recovery status
 */

import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, ReferenceLine
} from 'recharts';
import { generateFloodMemory, DATA_SOURCES, type ZoneMemory } from '../services/floodMemory';
import { useRealWeather, computeWeatherSummary } from '../hooks/useRealWeather';
import { useLanguage } from '../contexts/LanguageContext';
import {
  AlertTriangle, CheckCircle, Clock, Droplets, Activity,
  Database, Layers, TrendingDown, Users, Navigation,
  RefreshCw, Info, ChevronDown, ChevronUp, ExternalLink,
  Waves, Shield, Zap, FileDown, Map, Archive, Route
} from 'lucide-react';
import MetricTooltip from '@/components/MetricTooltip';

const STATUS_CONFIG = {
  safe: { color: '#10B981', bg: 'rgba(16,185,129,0.12)', label: 'Safe', labelEn: 'Safe', icon: CheckCircle },
  warning: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Warning', labelEn: 'Warning', icon: AlertTriangle },
  critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'Critical', labelEn: 'Critical', icon: AlertTriangle },
  'active-recovery': { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', label: 'Recovery Active', labelEn: 'Active Recovery', icon: TrendingDown },
};

const DRAIN_CAPACITY_LABEL: Record<string, { ar: string; en: string; color: string }> = {
  poor: { ar: 'Poor', en: 'Poor', color: '#EF4444' },
  moderate: { ar: 'Average', en: 'Moderate', color: '#F59E0B' },
  good: { ar: 'Good', en: 'Good', color: '#10B981' },
};

function formatHours(h: number): string {
  if (h === 0) return 'Now';
  if (h < 1) return `${Math.round(h * 60)} minute`;
  return `${h.toFixed(0)} hour`;
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleString('ar-AE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
}

// Circular Status Index
function StatusRing({ score, status }: { score: number; status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.safe;
  const r = 28, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke={cfg.color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="700" fill={cfg.color} fontFamily="Space Mono">
        {score}
      </text>
    </svg>
  );
}

// Single region details
function ZoneCard({ zone, isSelected, onClick }: {
  zone: ZoneMemory;
  isSelected: boolean;
  onClick: () => void;
}) {
  const cfg = STATUS_CONFIG[zone.status] || STATUS_CONFIG.safe;
  const Icon = cfg.icon;
  const drainCap = DRAIN_CAPACITY_LABEL[zone.drainageCapacity];

  return (
    <div
      onClick={onClick}
      style={{
        background: isSelected ? cfg.bg : 'var(--bg-card)',
        border: `1px solid ${isSelected ? cfg.color : 'var(--border-color)'}`,
        borderRadius: '12px',
        padding: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top status bar */}
      <div style={{ position: 'absolute', top: 0, right: 0, left: 0, height: '3px', background: cfg.color, borderRadius: '12px 12px 0 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{zone.nameAr}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Space Mono' }}>{zone.nameEn}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: cfg.bg, padding: '4px 10px', borderRadius: '20px', border: `1px solid ${cfg.color}44` }}>
          <Icon size={12} color={cfg.color} />
          <span style={{ fontSize: '11px', fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: zone.currentWaterDepth > 0 ? '#60A5FA' : 'var(--text-muted)', fontFamily: 'Space Mono' }}>
            {zone.currentWaterDepth.toFixed(0)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>cm Water</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: zone.soilSaturation > 70 ? '#F59E0B' : 'var(--text-muted)', fontFamily: 'Space Mono' }}>
            {zone.soilSaturation}%
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Soil Saturation</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <StatusRing score={zone.riskScore} status={zone.status} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Droplets size={11} color={drainCap.color} />
          <span style={{ fontSize: '10px', color: drainCap.color }}>Drainage {drainCap.ar}</span>
        </div>
        {zone.estimatedClearTime && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={11} color='#8B5CF6' />
            <span style={{ fontSize: '10px', color: '#8B5CF6' }}>
              Drainage: {formatDate(zone.estimatedClearTime)}
            </span>
          </div>
        )}
        {zone.affectedRoads > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Navigation size={11} color='#F59E0B' />
            <span style={{ fontSize: '10px', color: '#F59E0B' }}>{zone.affectedRoads} Road</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Data source details
function DataSourceCard({ source }: { source: typeof DATA_SOURCES[0] }) {
  const typeColors: Record<string, string> = {
    weather: '#60A5FA',
    satellite: '#A78BFA',
    roads: '#34D399',
    realtime: '#F59E0B',
    crowdsource: '#FB923C',
    terrain: '#94A3B8',
  };
  const color = typeColors[source.type] || '#94A3B8';

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: '10px',
      padding: '14px',
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start',
    }}>
      <div style={{ fontSize: '24px', lineHeight: 1 }}>{source.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{source.nameAr}</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: color, fontFamily: 'Space Mono' }}>{source.accuracy}</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>{source.coverage}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ fontSize: '10px', background: `${color}18`, color, padding: '2px 8px', borderRadius: '10px', border: `1px solid ${color}33` }}>
            {source.updateInterval}
          </span>
          <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '10px' }}>
            {source.type}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function DecisionSupportPage() {
  const { t, lang } = useLanguage();
  const { data: weatherData } = useRealWeather();
  const [selectedZone, setSelectedZone] = useState<ZoneMemory | null>(null);
  const [showDataSources, setShowDataSources] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const zones = useMemo(() => {
    const summary = computeWeatherSummary(weatherData);
    const currentPrecip = weatherData?.regions?.[0]?.currentPrecipitation ?? 0;
    const total24h = summary?.totalPrecip ?? 0;
    const total72h = total24h * 1.8;
    return generateFloodMemory(currentPrecip, total24h, total72h);
  }, [weatherData]);

  useEffect(() => {
    if (zones.length > 0 && !selectedZone) {
      setSelectedZone(zones[0]);
    }
  }, [zones]);

  const filteredZones = filterStatus === 'all' ? zones : zones.filter(z => z.status === filterStatus);
  const [, navigate] = useLocation();

  // Statistics KPI
  const kpis = useMemo(() => ({
    critical: zones.filter(z => z.status === 'critical').length,
    warning: zones.filter(z => z.status === 'warning').length,
    recovery: zones.filter(z => z.status === 'active-recovery').length,
    safe: zones.filter(z => z.status === 'safe').length,
    totalAffectedRoads: zones.reduce((s, z) => s + z.affectedRoads, 0),
    totalPopulation: zones.reduce((s, z) => s + z.populationAtRisk, 0),
    avgSoilSaturation: Math.round(zones.reduce((s, z) => s + z.soilSaturation, 0) / zones.length),
    maxWaterDepth: Math.max(...zones.map(z => z.currentWaterDepth)),
  }), [zones]);

  // Route recovery chart data (next 24 hours)
  const recoveryChartData = useMemo(() => {
    if (!selectedZone) return [];
    return Array.from({ length: 25 }, (_, i) => {
      const depth = calcCurrentWaterDepthForChart(
        selectedZone.lastRainDepth,
        selectedZone.drainageLagHours,
        i
      );
      return {
        hour: i === 0 ? 'Now' : `+${i}h`,
        depth: Math.round(depth * 10) / 10,
        safe: 10,
        warning: 20,
      };
    });
  }, [selectedZone]);

  // Radar chart data for regions
  const radarData = zones.slice(0, 6).map(z => ({
    zone: z.nameAr.split(' ')[0],
    Risk: z.riskScore,
    Saturation: z.soilSaturation,
    Depth: Math.min(100, z.currentWaterDepth * 2),
  }));

  // Comparison chart data
  const comparisonData = zones.map(z => ({
    name: z.nameAr.split(' ')[0],
    Risk: z.riskScore,
    Saturation: z.soilSaturation,
    Depth: z.currentWaterDepth,
    fill: STATUS_CONFIG[z.status]?.color || '#10B981',
  }));

  return (
    <div style={{ color: 'var(--text-primary)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={18} color="white" />
              </div>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                decision support
              </h1>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              flood memory system — drainage lag · Soil Saturation · active recovery status
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Space Mono' }}>
              Last Update: {lastUpdate.toLocaleTimeString('ar-AE')}
            </div>
            <button
              onClick={() => navigate('/map')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(66,165,245,0.12)', border: '1px solid rgba(66,165,245,0.35)', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', color: '#42A5F5', fontSize: '12px' }}
            >
              <Map size={13} />
              View Map
            </button>
            <button
              onClick={() => navigate('/archive')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(244,114,182,0.12)', border: '1px solid rgba(244,114,182,0.35)', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', color: '#F472B6', fontSize: '12px' }}
            >
              <Archive size={13} />
              Historical Archive
            </button>
            <button
              onClick={() => window.print()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', color: '#A78BFA', fontSize: '12px' }}
            >
              <FileDown size={13} />
              Export PDF
            </button>
            <button
              onClick={() => setLastUpdate(new Date())}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '12px' }}
            >
              <RefreshCw size={13} />
              Update
            </button>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Critical Regions', value: kpis.critical, color: '#EF4444', icon: AlertTriangle, desc: 'Require immediate intervention' },
          { label: 'Warning Regions', value: kpis.warning, color: '#F59E0B', icon: AlertTriangle, desc: 'Intensive monitoring' },
          { label: 'Recovery Active', value: kpis.recovery, color: '#8B5CF6', icon: TrendingDown, desc: 'Water not yet drained' },
          { label: 'Safe Regions', value: kpis.safe, color: '#10B981', icon: CheckCircle, desc: 'No accumulations' },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} style={{ background: 'var(--bg-card)', border: `1px solid ${kpi.color}33`, borderRadius: '12px', padding: '18px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, left: 0, height: '3px', background: kpi.color }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: kpi.color, fontFamily: 'Space Mono', lineHeight: 1 }}>{kpi.value}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>{kpi.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{kpi.desc}</div>
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${kpi.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} color={kpi.color} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Secondary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Roads Affected', value: kpis.totalAffectedRoads, unit: 'Road', color: '#F59E0B', icon: Navigation },
          { label: 'Population At risk', value: kpis.totalPopulation > 1000 ? `${(kpis.totalPopulation / 1000).toFixed(0)}K` : kpis.totalPopulation, unit: 'persons', color: '#EF4444', icon: Users },
          { label: 'Average Soil Saturation', value: `${kpis.avgSoilSaturation}%`, unit: '', color: '#60A5FA', icon: Droplets },
          { label: 'Maximum Depth Water', value: `${kpis.maxWaterDepth.toFixed(0)}`, unit: 'cm', color: '#8B5CF6', icon: Waves },
        ].map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${kpi.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} color={kpi.color} />
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: kpi.color, fontFamily: 'Space Mono', lineHeight: 1 }}>
                  {kpi.value} <span style={{ fontSize: '11px', fontWeight: 400 }}>{kpi.unit}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{kpi.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content: Zone Cards + Detail Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', marginBottom: '24px' }}>
        {/* Zone Cards */}
        <div>
          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Filter:</span>
            {['all', 'critical', 'warning', 'active-recovery', 'safe'].map(s => {
              const cfg = s === 'all' ? { color: '#94A3B8', label: 'All' } : { ...STATUS_CONFIG[s as keyof typeof STATUS_CONFIG], label: STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label };
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  style={{
                    padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.2s',
                    background: filterStatus === s ? `${cfg.color}22` : 'var(--bg-card)',
                    border: `1px solid ${filterStatus === s ? cfg.color : 'var(--border-color)'}`,
                    color: filterStatus === s ? cfg.color : 'var(--text-muted)',
                  }}
                >
                  {s === 'all' ? 'All' : cfg.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {filteredZones.map(zone => (
              <ZoneCard
                key={zone.id}
                zone={zone}
                isSelected={selectedZone?.id === zone.id}
                onClick={() => setSelectedZone(zone)}
              />
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedZone && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Zone Header */}
            <div style={{
              background: 'var(--bg-card)',
              border: `1px solid ${STATUS_CONFIG[selectedZone.status]?.color || '#10B981'}44`,
              borderRadius: '12px',
              padding: '18px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedZone.nameAr}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Space Mono' }}>{selectedZone.nameEn}</div>
                </div>
                <StatusRing score={selectedZone.riskScore} status={selectedZone.status} />
              </div>

              {/* Recovery Alert */}
              {selectedZone.status === 'active-recovery' && (
                <div style={{
                  background: 'rgba(139,92,246,0.12)',
                  border: '1px solid rgba(139,92,246,0.4)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '12px',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'flex-start',
                }}>
                  <TrendingDown size={14} color="#8B5CF6" style={{ marginTop: '1px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#8B5CF6', marginBottom: '2px' }}>Recovery Active</div>
                    <div style={{ fontSize: '11px', color: '#C4B5FD' }}>
                      rain stopped but water not yet drained — avoid region until {formatDate(selectedZone.estimatedClearTime)}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'current water depth', value: `${selectedZone.currentWaterDepth.toFixed(1)} cm`, color: '#60A5FA' },
                  { label: 'Soil Saturation', value: `${selectedZone.soilSaturation}%`, color: '#F59E0B' },
                  { label: 'drainage lag', value: `${selectedZone.drainageLagHours} hour`, color: '#8B5CF6' },
                  { label: 'Last Rainfall', value: `${selectedZone.lastRainDepth} mm`, color: '#34D399' },
                  { label: 'Roads Affected', value: `${selectedZone.affectedRoads} Road`, color: '#F59E0B' },
                  { label: 'Drainage Capacity', value: DRAIN_CAPACITY_LABEL[selectedZone.drainageCapacity]?.ar, color: DRAIN_CAPACITY_LABEL[selectedZone.drainageCapacity]?.color },
                ].map((item, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px' }}>{item.label}</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: item.color, fontFamily: 'Space Mono' }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recovery Chart */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingDown size={14} color="#8B5CF6" />
                Water recession route (24hr)
                <MetricTooltip id="recovery-chart" size={11} position="right" />
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={recoveryChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="depthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#64748B' }} interval={4} />
                  <YAxis tick={{ fontSize: 9, fill: '#64748B' }} />
                  <Tooltip
                    contentStyle={{ background: '#0D1B2A', border: '1px solid #1E3A5F', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(v: number) => [`${v} cm`, 'Water Depth']}
                  />
                  <ReferenceLine y={10} stroke="#F59E0B" strokeDasharray="3 3" label={{ value: 'Warning', fill: '#F59E0B', fontSize: 9 }} />
                  <ReferenceLine y={20} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'Critical', fill: '#EF4444', fontSize: 9 }} />
                  <Area type="monotone" dataKey="depth" stroke="#8B5CF6" fill="url(#depthGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Coordinates */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Coordinates geographic</div>
              <div style={{ fontFamily: 'Space Mono', fontSize: '12px', color: '#60A5FA' }}>
                {selectedZone.coordinates[0].toFixed(4)}°N · {selectedZone.coordinates[1].toFixed(4)}°E
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>Sources Data:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                {selectedZone.dataSources.map(src => (
                  <span key={src} style={{ fontSize: '10px', background: 'rgba(96,165,250,0.1)', color: '#60A5FA', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(96,165,250,0.2)' }}>
                    {src}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Comparison Bar Chart */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={15} color="#60A5FA" />
            risk index by regions
            <MetricTooltip id="floodRiskIndex" size={11} position="bottom" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={comparisonData} margin={{ top: 5, right: 5, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#0D1B2A', border: '1px solid #1E3A5F', borderRadius: '8px', fontSize: '11px' }}
              />
              <Bar dataKey="Risk" radius={[4, 4, 0, 0]}>
                {comparisonData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Radar Chart */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={15} color="#A78BFA" />
            Multi-dimensional comparison
            <MetricTooltip id="multi-dimension-comparison" size={11} position="bottom" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis dataKey="zone" tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <Radar name="Risk" dataKey="Risk" stroke="#EF4444" fill="#EF4444" fillOpacity={0.15} />
              <Radar name="Saturation" dataKey="Saturation" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.15} />
              <Radar name="Depth" dataKey="Depth" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.15} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Tooltip contentStyle={{ background: '#0D1B2A', border: '1px solid #1E3A5F', borderRadius: '8px', fontSize: '11px' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data Sources Section */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
        <button
          onClick={() => setShowDataSources(!showDataSources)}
          style={{
            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database size={16} color="#60A5FA" />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Data sources ({DATA_SOURCES.length} sources)</span>
          </div>
          {showDataSources ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showDataSources && (
          <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border-color)' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '14px 0', lineHeight: 1.6 }}>
              The flood memory system relies on {DATA_SOURCES.length} diverse data sources to ensure monitoring accuracy after rainfall stops. 
              Each source contributes to a different aspect of the forecast model.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {DATA_SOURCES.map(src => (
                <DataSourceCard key={src.id} source={src} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function
function calcCurrentWaterDepthForChart(lastRainDepth: number, drainageLagHours: number, hoursSinceRain: number): number {
  if (hoursSinceRain >= drainageLagHours || lastRainDepth === 0) return 0;
  const decayFactor = 1 - (hoursSinceRain / drainageLagHours);
  return lastRainDepth * decayFactor;
}
