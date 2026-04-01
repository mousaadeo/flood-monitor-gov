// KPIDrillDown.tsx — FloodSat AI
// Drill-down modal for KPI cards — displays detailed sub-data
// Opened when clicking any KPI card on the dashboard

import { useEffect } from 'react';
import {
  X, AlertTriangle, Droplets, Thermometer, Activity,
  TrendingUp, TrendingDown, Minus, MapPin, Wind,
  CloudRain, Gauge, BarChart3, Clock, Navigation,
} from 'lucide-react';
import type { RegionWeather } from '@/services/weatherApi';

export type DrillDownType = 'alerts' | 'precipitation' | 'temperature' | 'risk' | 'affectedRoads' | 'warningRegions' | 'criticalRegions' | 'totalPrecip';

interface KPIDrillDownProps {
  type: DrillDownType;
  regions: RegionWeather[];
  onClose: () => void;
}

const ALERT_CONFIG = {
  critical: { label: 'Critical', color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   order: 0 },
  warning:  { label: 'Warning',  color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  order: 1 },
  watch:    { label: 'Watch',    color: '#0EA5E9', bg: 'rgba(14,165,233,0.12)',  order: 2 },
  safe:     { label: 'Safe',     color: '#10B981', bg: 'rgba(16,185,129,0.12)',  order: 3 },
};

function TrendIcon({ value, threshold = 0 }: { value: number; threshold?: number }) {
  if (value > threshold) return <TrendingUp size={12} style={{ color: '#EF4444' }} />;
  if (value < threshold) return <TrendingDown size={12} style={{ color: '#10B981' }} />;
  return <Minus size={12} style={{ color: '#94a3b8' }} />;
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.6s ease' }} />
    </div>
  );
}

// ── Alerts Drill-Down ──────────────────────────────────────────────────────
function AlertsDrillDown({ regions }: { regions: RegionWeather[] }) {
  const sorted = [...regions].sort((a, b) => ALERT_CONFIG[a.alertLevel].order - ALERT_CONFIG[b.alertLevel].order);
  const counts = {
    critical: regions.filter(r => r.alertLevel === 'critical').length,
    warning:  regions.filter(r => r.alertLevel === 'warning').length,
    watch:    regions.filter(r => r.alertLevel === 'watch').length,
    safe:     regions.filter(r => r.alertLevel === 'safe').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Summary pills */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {(Object.entries(counts) as [keyof typeof counts, number][]).map(([level, count]) => {
          const cfg = ALERT_CONFIG[level];
          return (
            <div key={level} style={{ background: cfg.bg, border: `1px solid ${cfg.color}44`, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: cfg.color, fontFamily: 'monospace', lineHeight: 1 }}>{count}</div>
              <div style={{ fontSize: '11px', color: cfg.color, marginTop: '4px' }}>{cfg.label}</div>
            </div>
          );
        })}
      </div>

      {/* Per-region table */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <MapPin size={10} /> Breakdown by Region
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {sorted.map(r => {
            const cfg = ALERT_CONFIG[r.alertLevel];
            return (
              <div key={r.id} style={{
                padding: '12px 14px', borderRadius: '10px',
                background: cfg.bg, border: `1px solid ${cfg.color}33`,
              }}>
                {/* Row 1: name + status + values */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.nameEn}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{r.nameAr}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Flood Risk</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: cfg.color, fontFamily: 'monospace' }}>{r.floodRisk}%</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Current Precip.</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#00d4ff', fontFamily: 'monospace' }}>{r.currentPrecipitation} mm</div>
                    </div>
                    <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: cfg.bg, color: cfg.color, fontWeight: 700, border: `1px solid ${cfg.color}55` }}>
                      {cfg.label}
                    </span>
                  </div>
                </div>
                {/* Row 2: location + time */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingTop: '6px', borderTop: `1px solid ${cfg.color}20` }}>
                  <a
                    href={`https://www.google.com/maps?q=${r.lat},${r.lon}`}
                    target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#60a5fa', textDecoration: 'none' }}
                  >
                    <Navigation size={10} />
                    {r.lat.toFixed(4)}°N, {r.lon.toFixed(4)}°E
                  </a>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
                    <Clock size={10} />
                    Last updated: {new Date(r.lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    Probability: <span style={{ color: '#a78bfa', fontWeight: 600 }}>{r.precipitationProbability}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Precipitation Drill-Down ───────────────────────────────────────────────
function PrecipitationDrillDown({ regions }: { regions: RegionWeather[] }) {
  const sorted = [...regions].sort((a, b) => b.totalLast24h - a.totalLast24h);
  const maxPrecip = Math.max(...regions.map(r => r.totalLast24h), 1);
  const total = regions.reduce((s, r) => s + r.totalLast24h, 0);
  const maxRegion = sorted[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {[
          { label: 'Emirate Total', value: `${Math.round(total * 10) / 10} mm`, color: '#00d4ff', icon: Droplets },
          { label: 'Highest Region', value: maxRegion.nameEn, color: '#EF4444', icon: TrendingUp },
          { label: 'Region Average', value: `${Math.round(total / regions.length * 10) / 10} mm`, color: '#10B981', icon: BarChart3 },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} style={{ background: `${color}12`, border: `1px solid ${color}33`, borderRadius: '10px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Icon size={12} style={{ color }} />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Per-region bars */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <CloudRain size={10} /> 24-Hour Precipitation by Region
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sorted.map(r => {
            const alertCfg = ALERT_CONFIG[r.alertLevel];
            return (
              <div key={r.id} style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: alertCfg.color }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.nameEn}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Current</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#00d4ff', fontFamily: 'monospace' }}>{r.currentPrecipitation} mm/h</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>24 Hours</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#60a5fa', fontFamily: 'monospace' }}>{r.totalLast24h} mm</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Probability</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#a78bfa', fontFamily: 'monospace' }}>{r.precipitationProbability}%</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Max 48h</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#f472b6', fontFamily: 'monospace' }}>—</div>
                    </div>
                  </div>
                </div>
                <MiniBar value={r.totalLast24h} max={maxPrecip} color="#00d4ff" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Temperature Drill-Down ─────────────────────────────────────────────────
function TemperatureDrillDown({ regions }: { regions: RegionWeather[] }) {
  const sorted = [...regions].sort((a, b) => b.currentTemperature - a.currentTemperature);
  const avgTemp = regions.reduce((s, r) => s + r.currentTemperature, 0) / regions.length;
  const maxTemp = Math.max(...regions.map(r => r.currentTemperature));
  const minTemp = Math.min(...regions.map(r => r.currentTemperature));

  const tempColor = (t: number) => {
    if (t >= 40) return '#EF4444';
    if (t >= 35) return '#F59E0B';
    if (t >= 30) return '#10B981';
    return '#00d4ff';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {[
          { label: 'Overall Average', value: `${Math.round(avgTemp * 10) / 10}°C`, color: '#F59E0B' },
          { label: 'Highest Temp.', value: `${maxTemp}°C`, color: '#EF4444' },
          { label: 'Lowest Temp.', value: `${minTemp}°C`, color: '#00d4ff' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: `${color}12`, border: `1px solid ${color}33`, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Per-region */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Thermometer size={10} /> Temperature & Wind by Region
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {sorted.map(r => {
            const color = tempColor(r.currentTemperature);
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.nameEn}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{r.nameAr}</div>
                </div>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Temp.</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color, fontFamily: 'monospace', lineHeight: 1.1 }}>{r.currentTemperature}°</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'center' }}>
                      <Wind size={8} /> Wind
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', fontFamily: 'monospace' }}>{r.currentWindSpeed} km/h</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Humidity</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#60a5fa', fontFamily: 'monospace' }}>—</div>
                  </div>
                  <div style={{ width: '60px' }}>
                    <MiniBar value={r.currentTemperature - 15} max={maxTemp - 15} color={color} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Risk Drill-Down ────────────────────────────────────────────────────────
function RiskDrillDown({ regions }: { regions: RegionWeather[] }) {
  const sorted = [...regions].sort((a, b) => b.floodRisk - a.floodRisk);
  const maxRisk = Math.max(...regions.map(r => r.floodRisk), 1);

  const riskColor = (v: number) => {
    if (v >= 70) return '#EF4444';
    if (v >= 50) return '#F59E0B';
    if (v >= 30) return '#0EA5E9';
    return '#10B981';
  };
  const riskLabel = (v: number) => {
    if (v >= 70) return 'Very High';
    if (v >= 50) return 'High';
    if (v >= 30) return 'Moderate';
    return 'Low';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Risk gauge summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {[
          { label: 'Very High (≥70)', count: regions.filter(r => r.floodRisk >= 70).length, color: '#EF4444' },
          { label: 'High (50–69)',    count: regions.filter(r => r.floodRisk >= 50 && r.floodRisk < 70).length, color: '#F59E0B' },
          { label: 'Moderate (30–49)',count: regions.filter(r => r.floodRisk >= 30 && r.floodRisk < 50).length, color: '#0EA5E9' },
          { label: 'Low (<30)',       count: regions.filter(r => r.floodRisk < 30).length, color: '#10B981' },
        ].map(({ label, count, color }) => (
          <div key={label} style={{ background: `${color}12`, border: `1px solid ${color}33`, borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color, fontFamily: 'monospace', lineHeight: 1 }}>{count}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Per-region risk bars */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Gauge size={10} /> Flood Risk Index by Region
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sorted.map(r => {
            const color = riskColor(r.floodRisk);
            return (
              <div key={r.id} style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}22` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.nameEn}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{r.nameAr}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Risk Index</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color, fontFamily: 'monospace', lineHeight: 1.1 }}>{r.floodRisk}%</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Precip.</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#00d4ff', fontFamily: 'monospace' }}>{r.currentPrecipitation} mm</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Probability</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#a78bfa', fontFamily: 'monospace' }}>{r.precipitationProbability}%</div>
                    </div>
                    <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '20px', background: `${color}20`, color, fontWeight: 700, border: `1px solid ${color}44` }}>
                      {riskLabel(r.floodRisk)}
                    </span>
                    <TrendIcon value={r.floodRisk} threshold={30} />
                  </div>
                </div>
                <MiniBar value={r.floodRisk} max={maxRisk} color={color} />
                {/* Location + time row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px', paddingTop: '6px', borderTop: `1px solid ${color}15` }}>
                  <a
                    href={`https://www.google.com/maps?q=${r.lat},${r.lon}`}
                    target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#60a5fa', textDecoration: 'none' }}
                  >
                    <Navigation size={10} />
                    {r.lat.toFixed(4)}°N, {r.lon.toFixed(4)}°E
                  </a>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
                    <Clock size={10} />
                    {new Date(r.lastUpdated).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Affected Roads Drill-Down ─────────────────────────────────────────────
function getTrafficImpact(floodRisk: number, precip: number) {
  if (floodRisk >= 75 || precip > 15) return { speed: 15, status: 'Stopped / Closed', color: '#7C3AED', reduction: 87 };
  if (floodRisk >= 55 || precip > 8)  return { speed: 30, status: 'Very Slow',         color: '#EF4444', reduction: 70 };
  if (floodRisk >= 35 || precip > 3)  return { speed: 55, status: 'Slow',              color: '#F97316', reduction: 45 };
  if (floodRisk >= 20 || precip > 1)  return { speed: 75, status: 'Minor Slowdown',    color: '#F59E0B', reduction: 20 };
  return { speed: 100, status: 'Clear', color: '#10B981', reduction: 0 };
}

const ROAD_META: Record<string, string[]> = {
  'abudhabi-city': ['Corniche Road', 'Sheikh Zayed Street', 'Airport Road'],
  'al-ain':        ['Al Ain–Abu Dhabi Road', 'Zayed the First Street', 'Al Jimi Road'],
  'khalifa-city':  ['Khalifa Road', 'Airport Street', 'Sheikh Zayed Road'],
  'shahama':       ['Al Shahama Road', 'Abu Dhabi–Dubai Road E11'],
  'ruwais':        ['Ruwais Road E11', 'Industrial Zone Road'],
  'dhafra':        ['Al Dhafra Road', 'Ruwais–Abu Dhabi Road'],
  'wathba':        ['Al Wathba Road', 'Abu Dhabi–Al Ain Road'],
  'liwa':          ['Liwa Road', 'Al Dhafra Inner Road'],
  'mussafah':      ['Mussafah Street', 'Sheikh Zayed Road E10'],
  'mbz':           ['Mohammed Bin Zayed Road', 'Emirates Street'],
};

function AffectedRoadsDrillDown({ regions }: { regions: RegionWeather[] }) {
  const affected = regions
    .map(r => ({ ...r, traffic: getTrafficImpact(r.floodRisk, r.currentPrecipitation) }))
    .filter(r => r.traffic.reduction > 20)
    .sort((a, b) => b.traffic.reduction - a.traffic.reduction);
  const clear = regions.filter(r => getTrafficImpact(r.floodRisk, r.currentPrecipitation).reduction <= 20);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {[
          { label: 'Closed / Stopped', count: affected.filter(r => r.traffic.reduction >= 80).length, color: '#7C3AED' },
          { label: 'Very Slow',        count: affected.filter(r => r.traffic.reduction >= 60 && r.traffic.reduction < 80).length, color: '#EF4444' },
          { label: 'Slowdown',         count: affected.filter(r => r.traffic.reduction > 20 && r.traffic.reduction < 60).length, color: '#F59E0B' },
        ].map(({ label, count, color }) => (
          <div key={label} style={{ background: `${color}12`, border: `1px solid ${color}33`, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color, fontFamily: 'monospace', lineHeight: 1 }}>{count}</div>
            <div style={{ fontSize: '11px', color, marginTop: '4px' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Affected regions */}
      {affected.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Affected Regions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {affected.map(r => {
              const roads = ROAD_META[r.id] || [];
              return (
                <div key={r.id} style={{ padding: '12px 14px', borderRadius: '10px', background: `${r.traffic.color}10`, border: `1px solid ${r.traffic.color}33` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{r.nameEn}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Risk: {r.floodRisk}% | Precip.: {r.currentPrecipitation.toFixed(1)} mm/h</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: r.traffic.color, fontFamily: 'monospace' }}>{r.traffic.speed} km/h</div>
                      <div style={{ fontSize: '10px', color: r.traffic.color }}>{r.traffic.status}</div>
                    </div>
                  </div>
                  <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                    <div style={{ width: `${r.traffic.speed}%`, height: '100%', background: r.traffic.color, borderRadius: '3px' }} />
                  </div>
                  {roads.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {roads.map(road => (
                        <span key={road} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: `${r.traffic.color}15`, color: r.traffic.color, border: `1px solid ${r.traffic.color}33` }}>
                          {road}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Clear regions */}
      {clear.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Clear Regions</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {clear.map(r => (
              <span key={r.id} style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}>
                ✓ {r.nameEn}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Warning/Critical Regions Drill-Down ────────────────────────────────────
function AlertLevelDrillDown({ regions, level }: { regions: RegionWeather[]; level: 'warning' | 'critical' }) {
  const filtered = [...regions]
    .filter(r => level === 'critical' ? r.alertLevel === 'critical' : (r.alertLevel === 'warning' || r.alertLevel === 'critical'))
    .sort((a, b) => b.floodRisk - a.floodRisk);
  const color = level === 'critical' ? '#EF4444' : '#F59E0B';
  const others = regions.filter(r => level === 'critical' ? r.alertLevel !== 'critical' : (r.alertLevel !== 'warning' && r.alertLevel !== 'critical'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#10B981' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>✓</div>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>No {level === 'critical' ? 'critical' : 'warning'} regions currently</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>All regions are in safe or watch status</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(r => {
            const traffic = getTrafficImpact(r.floodRisk, r.currentPrecipitation);
            const roads = ROAD_META[r.id] || [];
            return (
              <div key={r.id} style={{ padding: '14px', borderRadius: '10px', background: `${color}10`, border: `1px solid ${color}44` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{r.nameEn}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{r.nameAr}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Flood Risk</div>
                      <div style={{ fontSize: '22px', fontWeight: 700, color, fontFamily: 'monospace', lineHeight: 1.1 }}>{r.floodRisk}%</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Precip.</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#3B82F6', fontFamily: 'monospace' }}>{r.currentPrecipitation.toFixed(1)}</div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>mm/h</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Traffic Speed</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: traffic.color, fontFamily: 'monospace' }}>{traffic.speed}</div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>km/h</div>
                    </div>
                  </div>
                </div>
                <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div style={{ width: `${r.floodRisk}%`, height: '100%', background: color, borderRadius: '3px' }} />
                </div>
                {roads.length > 0 && (
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>Affected Roads:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {roads.map(road => (
                        <span key={road} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: `${color}15`, color, border: `1px solid ${color}33` }}>
                          {road}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {others.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>Other Regions</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {others.map(r => (
              <span key={r.id} style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}>
                ✓ {r.nameEn}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Total Precipitation Drill-Down ─────────────────────────────────────────
function TotalPrecipDrillDown({ regions }: { regions: RegionWeather[] }) {
  const sorted = [...regions].sort((a, b) => b.currentPrecipitation - a.currentPrecipitation);
  const maxP = Math.max(...regions.map(r => r.currentPrecipitation), 0.1);
  const total = regions.reduce((s, r) => s + r.currentPrecipitation, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Total summary */}
      <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(59,130,246,0.1)', borderRadius: '12px', border: '1px solid rgba(59,130,246,0.3)' }}>
        <div style={{ fontSize: '36px', fontWeight: 800, color: '#3B82F6', fontFamily: 'monospace', lineHeight: 1 }}>{total.toFixed(2)}</div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Total current precipitation (mm/h) — {regions.length} regions</div>
      </div>

      {/* Per-region bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sorted.map(r => {
          const pct = maxP > 0 ? (r.currentPrecipitation / maxP) * 100 : 0;
          const color = r.currentPrecipitation > 15 ? '#7C3AED' : r.currentPrecipitation > 8 ? '#EF4444' : r.currentPrecipitation > 3 ? '#F59E0B' : r.currentPrecipitation > 0 ? '#3B82F6' : '#10B981';
          return (
            <div key={r.id} style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}22` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{r.nameEn}</span>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Current</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color, fontFamily: 'monospace' }}>{r.currentPrecipitation.toFixed(1)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>24 Hours</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#60A5FA', fontFamily: 'monospace' }}>{r.totalLast24h.toFixed(1)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Probability</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#A78BFA', fontFamily: 'monospace' }}>{r.precipitationProbability}%</div>
                  </div>
                </div>
              </div>
              <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.6s ease' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────
const MODAL_CONFIG: Record<DrillDownType, { title: string; subtitle: string; icon: React.ElementType; color: string }> = {
  alerts:          { title: 'Active Alerts — Full Breakdown',       subtitle: 'Alert status per region',                   icon: AlertTriangle, color: '#EF4444' },
  precipitation:   { title: 'Total Precipitation — Sub-data',       subtitle: 'Current and expected rainfall',             icon: Droplets,      color: '#00d4ff' },
  temperature:     { title: 'Temperature — Region Breakdown',       subtitle: 'Temperature and wind per region',           icon: Thermometer,   color: '#F59E0B' },
  risk:            { title: 'Flood Risk Index — Full Analysis',     subtitle: 'Regions ranked by risk level',              icon: Activity,      color: '#A855F7' },
  affectedRoads:   { title: 'Affected Roads — Traffic Breakdown',   subtitle: 'Regions with reduced traffic speed',        icon: BarChart3,     color: '#F97316' },
  warningRegions:  { title: 'Warning Regions — Full Breakdown',     subtitle: 'Regions in warning or critical status',     icon: AlertTriangle, color: '#F59E0B' },
  criticalRegions: { title: 'Critical Regions — Immediate Detail',  subtitle: 'Regions where risk exceeded 75%',           icon: AlertTriangle, color: '#EF4444' },
  totalPrecip:     { title: 'Total Precipitation — Region Detail',  subtitle: 'Rainfall distribution across the emirate', icon: CloudRain,     color: '#3B82F6' },
};

export default function KPIDrillDown({ type, regions, onClose }: KPIDrillDownProps) {
  const cfg = MODAL_CONFIG[type];
  const Icon = cfg.icon;

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
        borderRadius: '16px', width: '100%', maxWidth: '760px',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: `0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px ${cfg.color}22`,
        direction: 'ltr', fontFamily: 'Space Grotesk, Inter, sans-serif',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px', borderBottom: '1px solid var(--border-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: `linear-gradient(135deg, ${cfg.color}10 0%, transparent 100%)`,
          borderRadius: '16px 16px 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `${cfg.color}20`, border: `1px solid ${cfg.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={18} style={{ color: cfg.color }} />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{cfg.title}</h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {cfg.subtitle} — {regions.length} regions | Source: Open-Meteo API
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {type === 'alerts'          && <AlertsDrillDown regions={regions} />}
          {type === 'precipitation'   && <PrecipitationDrillDown regions={regions} />}
          {type === 'temperature'     && <TemperatureDrillDown regions={regions} />}
          {type === 'risk'            && <RiskDrillDown regions={regions} />}
          {type === 'affectedRoads'   && <AffectedRoadsDrillDown regions={regions} />}
          {type === 'warningRegions'  && <AlertLevelDrillDown regions={regions} level="warning" />}
          {type === 'criticalRegions' && <AlertLevelDrillDown regions={regions} level="critical" />}
          {type === 'totalPrecip'     && <TotalPrecipDrillDown regions={regions} />}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border-primary)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: '10px', color: 'var(--text-muted)',
        }}>
          <span>Data source: Open-Meteo API (ERA5 + GFS) — updated every 10 minutes</span>
          <button onClick={onClose} style={{ fontSize: '11px', color: cfg.color, cursor: 'pointer', background: `${cfg.color}15`, border: `1px solid ${cfg.color}33`, padding: '4px 14px', borderRadius: '6px', fontFamily: 'Space Grotesk' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
