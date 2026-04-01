/**
 * HistoricalReplay.tsx
 * Hourly historical replay system for any region
 * Shows: water volume, road impact, affected areas, timeline scrubber
 * Uses: Open-Meteo ERA5 archive + forecast via tRPC getPrecipHistory
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePrecipHistory } from '@/services/precipHistoryApi';
import {
  Play, Pause, ChevronLeft, ChevronRight, RotateCcw,
  Droplets, AlertTriangle, Navigation, Building2, Clock,
  TrendingUp, Activity, Waves, MapPin, Info
} from 'lucide-react';

// ── Theme ──────────────────────────────────────────────────────────────────
const T = {
  bg:        'rgba(8,14,24,0.98)',
  bgCard:    'rgba(13,22,38,0.95)',
  bgDeep:    'rgba(5,10,20,0.99)',
  border:    'rgba(66,165,245,0.14)',
  borderLt:  'rgba(66,165,245,0.07)',
  blue:      '#42A5F5',
  teal:      '#4DD0E1',
  green:     '#43A047',
  red:       '#EF4444',
  orange:    '#FF6B35',
  yellow:    '#FFB300',
  text:      '#E8F4F8',
  textSub:   '#90CAF9',
  textMuted: '#546E7A',
  fontMono:  'Space Mono, Courier New, monospace',
  fontHead:  'Playfair Display, Georgia, serif',
};

// ── Types ──────────────────────────────────────────────────────────────────
export interface HourlyPoint {
  time: string;          // 'YYYY-MM-DDTHH:MM'
  precipitation: number; // mm/hr
  probability: number;   // 0–100%
  isHistory: boolean;
  // Derived flood metrics
  waterDepthCm: number;
  waterVolumeCubicM: number;
  affectedAreaHa: number;
  affectedRoads: number;
  floodRisk: number;     // 0–100
  status: 'dry' | 'wet' | 'flooded' | 'critical';
}

export interface HistoricalReplaySelection {
  time: string;
  isHistory: boolean;
  precipitation: number;
  probability: number;
  temperatureC: number | null;
  windSpeed: number | null;
  humidity: number | null;
  waterDepthCm: number;
  waterVolumeCubicM: number;
  affectedAreaHa: number;
  affectedRoads: number;
  floodRisk: number;
  status: 'dry' | 'wet' | 'flooded' | 'critical';
  totalLast24h: number;
  maxNext48h: number;
}

export interface HistoricalReplayProps {
  regionId: string;
  regionName: string;
  lat: number;
  lng: number;
  areaSqKm: number;
  population: number;
  elevationM?: number;
  color?: string;
  compact?: boolean;
  onSelectionChange?: (selection: HistoricalReplaySelection | null) => void;
}

// ── Flood Computation Engine ───────────────────────────────────────────────
/**
 * Computes flood metrics from precipitation data
 * Based on UAE NCM flood classification + rational method hydrology
 */
function computeFloodMetrics(
  precip: number,      // mm/hr
  areaSqKm: number,
  elevationM: number,
  population: number,
  cumulativePrecip: number  // total mm since start
): Omit<HourlyPoint, 'time' | 'precipitation' | 'probability' | 'isHistory'> {
  // Runoff coefficient (UAE urban areas: 0.65–0.85)
  const runoffCoeff = elevationM < 10 ? 0.82 : elevationM < 50 ? 0.72 : elevationM < 200 ? 0.60 : 0.45;

  // Drainage capacity (UAE standard: 25mm/hr for urban, 15mm/hr for suburban)
  const drainageCapacity = areaSqKm < 50 ? 25 : areaSqKm < 200 ? 18 : 12;

  // Effective runoff after drainage
  const effectivePrecip = Math.max(0, precip - drainageCapacity * 0.4);
  const cumulativeRunoff = cumulativePrecip * runoffCoeff;

  // Water depth (simplified kinematic wave model)
  // depth = (runoff × area) / (drainage_network_length × channel_width)
  const depthFactor = elevationM < 5 ? 1.8 : elevationM < 20 ? 1.4 : elevationM < 100 ? 1.0 : 0.6;
  const waterDepthCm = Math.min(200, cumulativeRunoff * depthFactor * 0.08 + effectivePrecip * 0.15);

  // Water volume (m³) = depth × area × runoff coefficient
  const waterVolumeCubicM = Math.round(waterDepthCm / 100 * areaSqKm * 1_000_000 * runoffCoeff * 0.1);

  // Affected area (ha) — grows with depth
  const affectedAreaHa = Math.round(areaSqKm * 100 * Math.min(0.85, waterDepthCm / 150 * 0.9));

  // Affected roads — based on depth thresholds (UAE road standards)
  // < 5cm: passable; 5–15cm: caution; 15–30cm: restricted; > 30cm: closed
  const roadDensity = population / Math.max(areaSqKm, 1) > 500 ? 0.85 : 0.45;
  const affectedRoads = waterDepthCm < 5 ? 0
    : waterDepthCm < 15 ? Math.round(areaSqKm * roadDensity * 0.2)
    : waterDepthCm < 30 ? Math.round(areaSqKm * roadDensity * 0.55)
    : Math.round(areaSqKm * roadDensity * 0.9);

  // Flood risk index (0–100)
  const floodRisk = Math.min(99, Math.round(
    waterDepthCm * 0.4 +
    (cumulativePrecip > 50 ? 20 : cumulativePrecip > 25 ? 10 : 0) +
    (elevationM < 5 ? 15 : elevationM < 20 ? 8 : 0) +
    (precip > 20 ? 15 : precip > 10 ? 8 : 0)
  ));

  // Status classification
  const status: HourlyPoint['status'] =
    waterDepthCm >= 30 ? 'critical' :
    waterDepthCm >= 15 ? 'flooded' :
    waterDepthCm >= 5  ? 'wet' : 'dry';

  return { waterDepthCm, waterVolumeCubicM, affectedAreaHa, affectedRoads, floodRisk, status };
}

// ── Color helpers ──────────────────────────────────────────────────────────
function statusColor(status: HourlyPoint['status']): string {
  return { dry: T.green, wet: T.yellow, flooded: T.orange, critical: T.red }[status];
}
function statusLabel(status: HourlyPoint['status']): string {
  return { dry: 'Dry', wet: 'Wet', flooded: 'Flooded', critical: 'Critical' }[status];
}
function riskColor(risk: number): string {
  return risk >= 70 ? T.red : risk >= 50 ? T.orange : risk >= 30 ? T.yellow : T.green;
}

// ── Water Volume Visualization ─────────────────────────────────────────────
function WaterVolumeBar({ volumeM3, maxVolumeM3, color }: { volumeM3: number; maxVolumeM3: number; color: string }) {
  const pct = maxVolumeM3 > 0 ? Math.min(100, (volumeM3 / maxVolumeM3) * 100) : 0;
  const fmt = volumeM3 >= 1_000_000
    ? `${(volumeM3 / 1_000_000).toFixed(2)} M m³`
    : volumeM3 >= 1_000
    ? `${(volumeM3 / 1_000).toFixed(1)} K m³`
    : `${volumeM3} m³`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '9px', color: T.textMuted, fontFamily: T.fontMono }}>Water Volume</span>
        <span style={{ fontSize: '11px', fontWeight: 700, color, fontFamily: T.fontMono }}>{fmt}</span>
      </div>
      <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: '3px',
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          boxShadow: `0 0 8px ${color}44`,
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}

// ── Road Impact Visualization ──────────────────────────────────────────────
function RoadImpactBar({ affected, total, depth }: { affected: number; total: number; depth: number }) {
  const pct = total > 0 ? Math.min(100, (affected / total) * 100) : 0;
  const impactColor = depth >= 30 ? T.red : depth >= 15 ? T.orange : depth >= 5 ? T.yellow : T.green;
  const impactLabel = depth >= 30 ? 'CLOSED' : depth >= 15 ? 'RESTRICTED' : depth >= 5 ? 'CAUTION' : 'CLEAR';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '9px', color: T.textMuted, fontFamily: T.fontMono }}>Roads Affected</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '9px', fontWeight: 700, color: impactColor, fontFamily: T.fontMono, letterSpacing: '0.05em' }}>{impactLabel}</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: impactColor, fontFamily: T.fontMono }}>{affected} km</span>
        </div>
      </div>
      <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: '3px',
          background: `linear-gradient(90deg, ${impactColor}88, ${impactColor})`,
          boxShadow: `0 0 8px ${impactColor}44`,
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}

// ── Timeline Bar Chart ─────────────────────────────────────────────────────
function TimelineChart({
  hours,
  currentIndex,
  onSelect,
  maxPrecip,
}: {
  hours: HourlyPoint[];
  currentIndex: number;
  onSelect: (i: number) => void;
  maxPrecip: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trackRef.current) return;
    const bar = trackRef.current.querySelector(`[data-idx="${currentIndex}"]`) as HTMLElement | null;
    if (bar) bar.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [currentIndex]);

  const nowIdx = hours.findIndex(h => !h.isHistory);

  return (
    <div style={{ position: 'relative' }}>
      {/* NOW line */}
      {nowIdx > 0 && (
        <div style={{
          position: 'absolute',
          left: `${(nowIdx / Math.max(hours.length - 1, 1)) * 100}%`,
          top: 0, bottom: 0, width: '1px',
          background: 'rgba(67,160,71,0.7)', zIndex: 2, pointerEvents: 'none',
        }}>
          <span style={{ position: 'absolute', top: '-14px', left: '3px', fontSize: '7px', color: T.green, fontFamily: T.fontMono, whiteSpace: 'nowrap' }}>NOW</span>
        </div>
      )}

      <div
        ref={trackRef}
        style={{
          display: 'flex', alignItems: 'flex-end', gap: '1px',
          height: '48px', overflowX: 'hidden', cursor: 'crosshair',
        }}
        onClick={(e) => {
          if (!trackRef.current) return;
          const rect = trackRef.current.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          onSelect(Math.round(ratio * (hours.length - 1)));
        }}
      >
        {hours.map((h, i) => {
          const barH = Math.max(2, maxPrecip > 0 ? (h.precipitation / maxPrecip) * 44 : 2);
          const isSelected = i === currentIndex;
          const barColor = h.isHistory ? T.blue : T.yellow;
          const opacity = isSelected ? 1 : h.isHistory ? 0.55 : 0.3;
          return (
            <div
              key={i}
              data-idx={i}
              onClick={e => { e.stopPropagation(); onSelect(i); }}
              title={`${h.time.split('T')[1]} — ${h.precipitation} mm | Depth: ${h.waterDepthCm.toFixed(1)} cm`}
              style={{
                flex: 1, minWidth: '3px', height: '48px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                cursor: 'pointer', position: 'relative',
              }}
            >
              {/* Flood depth indicator (behind precip bar) */}
              {h.waterDepthCm > 0 && (
                <div style={{
                  position: 'absolute', bottom: 0, width: '100%',
                  height: `${Math.min(44, h.waterDepthCm * 0.3)}px`,
                  background: `${statusColor(h.status)}18`,
                  borderRadius: '1px',
                }} />
              )}
              {/* Precipitation bar */}
              <div style={{
                width: '100%', height: `${barH}px`,
                background: isSelected ? barColor : `${barColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
                borderRadius: '1px 1px 0 0',
                boxShadow: isSelected ? `0 0 6px ${barColor}88` : 'none',
                position: 'relative', zIndex: 1,
              }} />
              {isSelected && (
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: '1.5px', height: '100%', background: barColor,
                  boxShadow: `0 0 6px ${barColor}`, borderRadius: '1px', zIndex: 3,
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Time labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
        {hours.filter((_, i) => i % Math.max(1, Math.floor(hours.length / 8)) === 0).map(h => (
          <span key={h.time} style={{
            fontSize: '7px', fontFamily: T.fontMono,
            color: !h.isHistory ? T.yellow : T.textMuted,
          }}>
            {h.time.split('T')[1]}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function HistoricalReplay({
  regionId,
  regionName,
  lat,
  lng,
  areaSqKm,
  population,
  elevationM = 10,
  color = T.blue,
  compact = false,
  onSelectionChange,
}: HistoricalReplayProps) {
  const [mode, setMode] = useState<'24h' | '7d'>('24h');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch data — client-side direct to Open-Meteo (Render free tier blocks server-side outbound)
  const query = usePrecipHistory(lat, lng, mode);

  // Build enriched hourly points with flood metrics
  const hours: HourlyPoint[] = useMemo(() => {
    if (!query.data?.points?.length) return [];
    const pts = query.data.points;
    let cumulative = 0;
    return pts.map(p => {
      if (p.isHistory) cumulative += p.precipitation;
      const metrics = computeFloodMetrics(p.precipitation, areaSqKm, elevationM, population, cumulative);
      return {
        time: p.time,
        precipitation: p.precipitation,
        probability: p.probability,
        isHistory: p.isHistory,
        ...metrics,
      };
    });
  }, [query.data, areaSqKm, elevationM, population]);

  // Set initial index to "now" (first forecast point)
  useEffect(() => {
    if (hours.length === 0) return;
    const nowIdx = hours.findIndex(h => !h.isHistory);
    setCurrentIndex(nowIdx >= 0 ? nowIdx : hours.length - 1);
  }, [hours]);

  // Auto-play
  useEffect(() => {
    if (playing) {
      playRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev + 1 >= hours.length) { setPlaying(false); return prev; }
          return prev + 1;
        });
      }, 500);
    } else {
      if (playRef.current) clearInterval(playRef.current);
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [playing, hours.length]);

  const handleSelect = useCallback((i: number) => {
    setPlaying(false);
    setCurrentIndex(i);
  }, []);

  const selected = hours[currentIndex];
  const selectedSnapshot = useMemo<HistoricalReplaySelection | null>(() => {
    if (!selected) return null;
    const totalLast24h = Math.round(
      hours
        .slice(Math.max(0, currentIndex - 24), currentIndex + 1)
        .reduce((sum, point) => sum + (point.precipitation || 0), 0) * 10
    ) / 10;
    const maxNext48h = Math.round(
      Math.max(...hours.slice(currentIndex, currentIndex + 48).map(point => point.precipitation || 0), 0) * 10
    ) / 10;

    return {
      time: selected.time,
      isHistory: selected.isHistory,
      precipitation: selected.precipitation,
      probability: selected.probability,
      temperatureC: typeof (query.data?.points?.[currentIndex]?.temperatureC) === 'number' ? (query.data?.points?.[currentIndex]?.temperatureC ?? null) : null,
      windSpeed: typeof (query.data?.points?.[currentIndex]?.windSpeed) === 'number' ? (query.data?.points?.[currentIndex]?.windSpeed ?? null) : null,
      humidity: typeof (query.data?.points?.[currentIndex]?.humidity) === 'number' ? (query.data?.points?.[currentIndex]?.humidity ?? null) : null,
      waterDepthCm: selected.waterDepthCm,
      waterVolumeCubicM: selected.waterVolumeCubicM,
      affectedAreaHa: selected.affectedAreaHa,
      affectedRoads: selected.affectedRoads,
      floodRisk: selected.floodRisk,
      status: selected.status,
      totalLast24h,
      maxNext48h,
    };
  }, [selected, hours, currentIndex, query.data]);

  useEffect(() => {
    onSelectionChange?.(selectedSnapshot);
  }, [selectedSnapshot, onSelectionChange]);

  const maxPrecip = useMemo(() => Math.max(...hours.map(h => h.precipitation), 0.1), [hours]);
  const maxVolume = useMemo(() => Math.max(...hours.map(h => h.waterVolumeCubicM), 1), [hours]);
  const totalRoadKm = useMemo(() => Math.round(areaSqKm * (population / Math.max(areaSqKm, 1) > 500 ? 0.85 : 0.45)), [areaSqKm, population]);

  // Peak flood stats
  const peakHour = useMemo(() => hours.reduce((a, b) => a.waterDepthCm > b.waterDepthCm ? a : b, hours[0] ?? { waterDepthCm: 0, time: '' }), [hours]);
  const totalHistPrecip = useMemo(() => hours.filter(h => h.isHistory).reduce((s, h) => s + h.precipitation, 0), [hours]);
  const histHoursCount = useMemo(() => hours.filter(h => h.isHistory).length, [hours]);

  // Badge
  const badge = selected?.isHistory
    ? { label: 'HIST', color: T.blue }
    : { label: 'FCST', color: T.yellow };

  if (query.isLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: T.textMuted, fontFamily: T.fontMono, fontSize: '11px' }}>
        <Activity size={14} style={{ marginBottom: '6px', color: T.blue }} />
        <div>Loading historical data for {regionName}...</div>
        <div style={{ fontSize: '9px', marginTop: '4px', color: T.textMuted }}>ERA5 + Open-Meteo</div>
      </div>
    );
  }

  if (query.error || hours.length === 0) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', color: T.red, fontFamily: T.fontMono, fontSize: '11px' }}>
        <AlertTriangle size={14} style={{ marginBottom: '4px' }} />
        <div>Failed to load historical data</div>
        <button onClick={() => window.location.reload()} style={{ marginTop: '8px', padding: '4px 12px', background: 'rgba(66,165,245,0.1)', border: '1px solid rgba(66,165,245,0.3)', borderRadius: '3px', color: T.blue, fontSize: '10px', cursor: 'pointer', fontFamily: T.fontMono }}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{
      background: T.bgCard,
      border: `1px solid ${T.border}`,
      borderRadius: '6px',
      overflow: 'hidden',
      fontFamily: T.fontMono,
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: compact ? '10px 14px' : '14px 18px',
        borderBottom: `1px solid ${T.borderLt}`,
        background: `linear-gradient(135deg, ${color}06 0%, transparent 60%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={13} color={color} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: T.text, fontFamily: T.fontHead }}>
            Historical Replay
          </span>
          <span style={{ fontSize: '9px', color: T.textMuted }}>
            {regionName} · ERA5 + Open-Meteo
          </span>
        </div>
        {/* Mode selector */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['24h', '7d'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setPlaying(false); }}
              style={{
                padding: '3px 10px', borderRadius: '3px', fontSize: '10px', cursor: 'pointer',
                border: '1px solid', fontFamily: T.fontMono,
                background: mode === m ? `${color}18` : 'transparent',
                borderColor: mode === m ? `${color}60` : T.border,
                color: mode === m ? color : T.textMuted,
                transition: 'all 0.15s',
              }}
            >{m === '24h' ? '24 Hours' : '7 Days'}</button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: compact ? '10px 14px' : '14px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* ── Summary stats row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {[
            { icon: <Droplets size={11} />, label: 'Total Precip', value: `${totalHistPrecip.toFixed(1)} mm`, color: T.blue },
            { icon: <Waves size={11} />, label: 'Peak Depth', value: `${peakHour?.waterDepthCm?.toFixed(1) ?? '0'} cm`, color: T.orange },
            { icon: <Navigation size={11} />, label: 'Roads Affected', value: `${peakHour?.affectedRoads ?? 0} km`, color: T.red },
            { icon: <Clock size={11} />, label: 'Hist. Hours', value: `${histHoursCount} hrs`, color: T.teal },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.borderLt}`, borderRadius: '4px', padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', color: s.color, marginBottom: '3px' }}>{s.icon}</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '8px', color: T.textMuted, marginTop: '1px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Timeline chart ── */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderLt}`, borderRadius: '4px', padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <span style={{ fontSize: '9px', color: T.textMuted }}>Precipitation (mm/hr)</span>
            <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '8px', height: '8px', background: T.blue, borderRadius: '1px' }} />
                <span style={{ fontSize: '8px', color: T.textMuted }}>Historical</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '8px', height: '8px', background: T.yellow, borderRadius: '1px' }} />
                <span style={{ fontSize: '8px', color: T.textMuted }}>Forecast</span>
              </div>
            </div>
          </div>
          <TimelineChart hours={hours} currentIndex={currentIndex} onSelect={handleSelect} maxPrecip={maxPrecip} />
        </div>

        {/* ── Playback controls ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setPlaying(p => !p)}
            style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid', background: playing ? 'rgba(255,107,53,0.15)' : 'rgba(66,165,245,0.12)', borderColor: playing ? 'rgba(255,107,53,0.5)' : 'rgba(66,165,245,0.4)', color: playing ? T.orange : T.blue }}>
            {playing ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <button onClick={() => handleSelect(Math.max(0, currentIndex - 1))}
            style={{ width: '24px', height: '24px', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.05)', color: T.textSub }}>
            <ChevronLeft size={11} />
          </button>
          <button onClick={() => handleSelect(Math.min(hours.length - 1, currentIndex + 1))}
            style={{ width: '24px', height: '24px', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.05)', color: T.textSub }}>
            <ChevronRight size={11} />
          </button>
          <button onClick={() => { const ni = hours.findIndex(h => !h.isHistory); handleSelect(ni >= 0 ? ni : 0); }}
            style={{ width: '24px', height: '24px', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.05)', color: T.textSub }} title="Jump to NOW">
            <RotateCcw size={10} />
          </button>

          {selected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '4px' }}>
              <span style={{
                fontSize: '9px', fontWeight: 700, color: badge.color,
                letterSpacing: '0.08em', padding: '2px 6px',
                background: `${badge.color}12`, border: `1px solid ${badge.color}30`, borderRadius: '2px',
              }}>{badge.label}</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: T.text }}>
                {selected.time.replace('T', ' ')}
              </span>
            </div>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
            <span style={{ fontSize: '10px', color: T.blue }}>
              {selected?.precipitation?.toFixed(1) ?? '0'} mm/hr
            </span>
            <span style={{ fontSize: '10px', color: T.yellow }}>
              {selected?.probability ?? 0}% prob.
            </span>
          </div>
        </div>

        {/* ── Selected hour details ── */}
        {selected && (
          <div style={{
            background: `${statusColor(selected.status)}08`,
            border: `1px solid ${statusColor(selected.status)}25`,
            borderRadius: '6px',
            padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: statusColor(selected.status),
                  boxShadow: `0 0 8px ${statusColor(selected.status)}`,
                }} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: statusColor(selected.status), fontFamily: T.fontHead }}>
                  {statusLabel(selected.status).toUpperCase()}
                </span>
                <span style={{ fontSize: '10px', color: T.textMuted }}>
                  {selected.time.replace('T', ' ')} UAE
                </span>
              </div>
              <div style={{
                padding: '3px 10px',
                background: `${riskColor(selected.floodRisk)}12`,
                border: `1px solid ${riskColor(selected.floodRisk)}30`,
                borderRadius: '3px',
                fontSize: '11px', fontWeight: 700, color: riskColor(selected.floodRisk),
              }}>
                Risk: {selected.floodRisk}%
              </div>
            </div>

            {/* Metrics grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '12px' }}>
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '4px', padding: '10px 12px' }}>
                <div style={{ fontSize: '9px', color: T.textMuted, marginBottom: '4px' }}>💧 Water Depth</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: statusColor(selected.status) }}>
                  {selected.waterDepthCm.toFixed(1)} <span style={{ fontSize: '11px', fontWeight: 400 }}>cm</span>
                </div>
                <div style={{ fontSize: '9px', color: T.textMuted, marginTop: '2px' }}>
                  {selected.waterDepthCm < 5 ? 'Passable' : selected.waterDepthCm < 15 ? 'Drive with caution' : selected.waterDepthCm < 30 ? 'Restricted access' : 'Road closed'}
                </div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '4px', padding: '10px 12px' }}>
                <div style={{ fontSize: '9px', color: T.textMuted, marginBottom: '4px' }}>🌊 Affected Area</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: T.blue }}>
                  {selected.affectedAreaHa.toLocaleString()} <span style={{ fontSize: '11px', fontWeight: 400 }}>ha</span>
                </div>
                <div style={{ fontSize: '9px', color: T.textMuted, marginTop: '2px' }}>
                  {((selected.affectedAreaHa / (areaSqKm * 100)) * 100).toFixed(1)}% of region
                </div>
              </div>
            </div>

            {/* Water volume bar */}
            <div style={{ marginBottom: '10px' }}>
              <WaterVolumeBar volumeM3={selected.waterVolumeCubicM} maxVolumeM3={maxVolume} color={statusColor(selected.status)} />
            </div>

            {/* Road impact bar */}
            <RoadImpactBar affected={selected.affectedRoads} total={totalRoadKm} depth={selected.waterDepthCm} />
          </div>
        )}

        {/* ── Road impact breakdown ── */}
        {selected && selected.waterDepthCm >= 5 && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderLt}`, borderRadius: '4px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Navigation size={12} color={T.orange} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: T.text, fontFamily: T.fontHead }}>Road Impact Analysis</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[
                {
                  label: 'Closed Roads',
                  value: selected.waterDepthCm >= 30 ? `${Math.round(selected.affectedRoads * 0.6)} km` : '0 km',
                  color: T.red,
                  desc: '> 30 cm depth',
                },
                {
                  label: 'Restricted',
                  value: selected.waterDepthCm >= 15 ? `${Math.round(selected.affectedRoads * 0.3)} km` : '0 km',
                  color: T.orange,
                  desc: '15–30 cm depth',
                },
                {
                  label: 'Caution',
                  value: selected.waterDepthCm >= 5 ? `${Math.round(selected.affectedRoads * 0.1)} km` : '0 km',
                  color: T.yellow,
                  desc: '5–15 cm depth',
                },
              ].map(r => (
                <div key={r.label} style={{ background: `${r.color}08`, border: `1px solid ${r.color}20`, borderRadius: '4px', padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: r.color }}>{r.value}</div>
                  <div style={{ fontSize: '9px', color: T.textMuted, marginTop: '2px' }}>{r.label}</div>
                  <div style={{ fontSize: '8px', color: T.textMuted, marginTop: '1px', opacity: 0.7 }}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Infrastructure impact ── */}
        {selected && selected.floodRisk >= 30 && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.borderLt}`, borderRadius: '4px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Building2 size={12} color={T.teal} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: T.text, fontFamily: T.fontHead }}>Infrastructure Impact</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                {
                  label: 'Drainage System',
                  load: Math.min(100, selected.floodRisk * 1.1),
                  color: selected.floodRisk > 70 ? T.red : selected.floodRisk > 50 ? T.orange : T.yellow,
                },
                {
                  label: 'Stormwater Network',
                  load: Math.min(100, selected.precipitation * 3.5),
                  color: selected.precipitation > 20 ? T.red : selected.precipitation > 10 ? T.orange : T.yellow,
                },
                {
                  label: 'Pump Stations',
                  load: Math.min(100, selected.waterDepthCm * 2.2),
                  color: selected.waterDepthCm > 30 ? T.red : selected.waterDepthCm > 15 ? T.orange : T.yellow,
                },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontSize: '9px', color: T.textMuted }}>{item.label}</span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: item.color }}>{item.load.toFixed(0)}% load</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${item.load}%`, borderRadius: '2px',
                      background: `linear-gradient(90deg, ${item.color}66, ${item.color})`,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Data source note ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '3px' }}>
          <Info size={10} color={T.textMuted} />
          <span style={{ fontSize: '8px', color: T.textMuted }}>
            Historical data: ERA5 reanalysis (Open-Meteo archive API) · Forecast: GFS/ECMWF (Open-Meteo) · Flood metrics: UAE NCM rational method
          </span>
        </div>
      </div>
    </div>
  );
}
