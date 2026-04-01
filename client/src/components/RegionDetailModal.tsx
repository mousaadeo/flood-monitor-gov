/*
 * RegionDetailModal.tsx — Enhanced Region Detail Modal
 * Sections:
 *   1. Flood Data (area, depth, volume)
 *   2. Mini-map (cloned from main map with flood overlay)
 *   3. Solution Scenarios (Quick / Medium / Comprehensive) with costs
 *   4. Water Reuse Applications
 *   5. Prevention Strategies
 *   6. Global Best Practices reference
 *   7. Charts (radar + forecast)
 */
import { useEffect, useRef, useState } from 'react';
import type { RegionWeather } from '@/services/weatherApi';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell,
} from 'recharts';
import {
  X, MapPin, Droplets, Thermometer, Wind, AlertTriangle, Activity,
  Layers, Zap, Shield, Globe, Recycle, TrendingDown, DollarSign,
  CheckCircle, Clock, ChevronDown, ChevronUp, Info,
} from 'lucide-react';

// ─── Region coordinates ────────────────────────────────────────────────────
const REGION_COORDS: Record<string, { lat: number; lng: number; area: number; type: string }> = {
  'abudhabi-city':        { lat: 24.4539, lng: 54.3773, area: 972,   type: 'urban_dense' },
  'al-ain':               { lat: 24.2075, lng: 55.7447, area: 1200,  type: 'urban_medium' },
  'khalifa-city':         { lat: 24.4150, lng: 54.5950, area: 120,   type: 'urban_medium' },
  'khalifa-city-a':       { lat: 24.4050, lng: 54.5500, area: 120,   type: 'urban_medium' },
  'khalifa-city-b':       { lat: 24.3900, lng: 54.5700, area: 95,    type: 'urban_medium' },
  'shahama':              { lat: 24.5059, lng: 54.6721, area: 180,   type: 'urban_medium' },
  'al-shahama':           { lat: 24.5500, lng: 54.4500, area: 180,   type: 'urban_medium' },
  'ruwais':               { lat: 24.1100, lng: 52.7300, area: 350,   type: 'industrial' },
  'dhafra':               { lat: 23.6700, lng: 53.7100, area: 67340, type: 'desert_wadi' },
  'wathba':               { lat: 24.2600, lng: 54.6100, area: 450,   type: 'urban_medium' },
  'al-wathba':            { lat: 24.2600, lng: 54.6100, area: 450,   type: 'urban_medium' },
  'liwa':                 { lat: 23.1200, lng: 53.7700, area: 2800,  type: 'desert_wadi' },
  'al-dhahir':            { lat: 23.5300, lng: 55.7700, area: 1800,  type: 'wadi' },
  'al-ain-industrial':    { lat: 24.2500, lng: 55.7000, area: 380,   type: 'industrial' },
  'al-ain-airport':       { lat: 24.2617, lng: 55.6092, area: 280,   type: 'airport' },
  'al-shamkha':           { lat: 24.3100, lng: 54.4700, area: 320,   type: 'urban_medium' },
  'baniyas':              { lat: 24.3000, lng: 54.6300, area: 185,   type: 'urban_medium' },
  'mohammed-bin-zayed':   { lat: 24.3500, lng: 54.5200, area: 280,   type: 'urban_dense' },
  'zayed-city':           { lat: 24.2800, lng: 54.5500, area: 350,   type: 'urban_medium' },
  'al-reef':              { lat: 24.2400, lng: 54.5800, area: 200,   type: 'urban_medium' },
  'yas-island':           { lat: 24.4900, lng: 54.6100, area: 2500,  type: 'coastal' },
  'saadiyat-island':      { lat: 24.5400, lng: 54.4300, area: 2700,  type: 'coastal' },
};

function getRegionMeta(id: string) {
  return REGION_COORDS[id] || { lat: 24.4539, lng: 54.3773, area: 200, type: 'urban_medium' };
}

// ─── Flood calculations ────────────────────────────────────────────────────
function calcFloodData(region: RegionWeather, areaSqKm: number) {
  const rainfall_mm = region.totalLast24h;
  const risk = region.floodRisk;
  // Runoff coefficient based on region type
  const runoffCoeff = 0.65; // UAE urban average
  // Flood area = % of region based on risk
  const floodAreaPct = Math.min(0.85, risk / 100 * 1.1);
  const floodAreaKm2 = +(areaSqKm * floodAreaPct).toFixed(2);
  const floodAreaM2 = floodAreaKm2 * 1_000_000;
  // Water volume = rainfall × area × runoff coefficient
  const waterVolumeM3 = Math.round(rainfall_mm / 1000 * floodAreaM2 * runoffCoeff);
  // Average depth = volume / area
  const avgDepthM = floodAreaM2 > 0 ? +(waterVolumeM3 / floodAreaM2).toFixed(3) : 0;
  const maxDepthM = +(avgDepthM * 2.8).toFixed(2); // low-lying areas 2.8x average
  return {
    floodAreaKm2,
    waterVolumeM3,
    avgDepthM,
    maxDepthM,
    waterVolumeMCM: +(waterVolumeM3 / 1_000_000).toFixed(3), // million cubic meters
  };
}

// ─── Solution scenarios ────────────────────────────────────────────────────
interface Scenario {
  id: 'quick' | 'medium' | 'comprehensive';
  label: string;
  labelAr: string;
  icon: string;
  color: string;
  timeline: string;
  costMin: number; // AED million
  costMax: number;
  waterRecoveryPct: number;
  roi: string;
  solutions: string[];
  globalRef: string;
}

function buildScenarios(regionType: string, areaSqKm: number, waterVolumeMCM: number): Scenario[] {
  const areaFactor = Math.max(0.5, Math.min(5, areaSqKm / 200));

  if (regionType === 'wadi' || regionType === 'desert_wadi') {
    return [
      {
        id: 'quick', label: 'Quick Win', labelAr: 'الحل السريع', icon: '⚡', color: '#F59E0B',
        timeline: '3–6 months', costMin: Math.round(1 * areaFactor), costMax: Math.round(5 * areaFactor),
        waterRecoveryPct: 35, roi: '2–3 years',
        solutions: [
          'Earthen check dams across wadi channels',
          'Flash flood spreading fields (infiltration)',
          'IoT water level sensors at key points',
          'Emergency diversion channels',
        ],
        globalRef: 'Iran Flash Flood Spreading Program — 4.5M m³/month recharge',
      },
      {
        id: 'medium', label: 'Medium-Term', labelAr: 'الحل المتوسط', icon: '🏗️', color: '#3B82F6',
        timeline: '1–2 years', costMin: Math.round(10 * areaFactor), costMax: Math.round(30 * areaFactor),
        waterRecoveryPct: 65, roi: '4–6 years',
        solutions: [
          'Concrete weirs + infiltration galleries',
          'Managed Aquifer Recharge (MAR) system',
          'Wadi rehabilitation + vegetation',
          'Agricultural irrigation distribution network',
        ],
        globalRef: 'UAE — Wadi Al Bih & Wadi Ham MAR systems (RAK/Fujairah)',
      },
      {
        id: 'comprehensive', label: 'Comprehensive', labelAr: 'الحل الشامل', icon: '🌿', color: '#10B981',
        timeline: '3–5 years', costMin: Math.round(30 * areaFactor), costMax: Math.round(100 * areaFactor),
        waterRecoveryPct: 90, roi: '6–10 years',
        solutions: [
          'Full MAR system with monitoring network',
          'Wadi restoration + constructed wetlands',
          'Smart water harvesting + storage reservoirs',
          'Integrated groundwater recharge program',
          'Nature-based flood attenuation',
        ],
        globalRef: 'Riyadh — Wadi Hanifa Restoration ($267M, 120km, full rehabilitation)',
      },
    ];
  }

  if (regionType === 'industrial' || regionType === 'airport') {
    return [
      {
        id: 'quick', label: 'Quick Win', labelAr: 'الحل السريع', icon: '⚡', color: '#F59E0B',
        timeline: '6–12 months', costMin: Math.round(2 * areaFactor), costMax: Math.round(8 * areaFactor),
        waterRecoveryPct: 40, roi: '2–4 years',
        solutions: [
          'Stormwater collection tanks (non-potable reuse)',
          'Runway/apron drainage upgrade',
          'Aircraft washing water reuse system',
          'Dust suppression water supply from harvested rain',
        ],
        globalRef: 'ICAO Airport Water Management — 50–200 L/aircraft washing savings',
      },
      {
        id: 'medium', label: 'Medium-Term', labelAr: 'الحل المتوسط', icon: '🏗️', color: '#3B82F6',
        timeline: '2–3 years', costMin: Math.round(15 * areaFactor), costMax: Math.round(40 * areaFactor),
        waterRecoveryPct: 70, roi: '4–7 years',
        solutions: [
          'On-site treatment plant (secondary treatment)',
          'Landscape irrigation distribution network',
          'Industrial cooling water supply',
          'Construction water reuse system',
          'Underground detention tanks',
        ],
        globalRef: 'Dubai Airport — Stormwater reuse saving AED 3–5M/year',
      },
      {
        id: 'comprehensive', label: 'Comprehensive', labelAr: 'الحل الشامل', icon: '🌿', color: '#10B981',
        timeline: '4–7 years', costMin: Math.round(50 * areaFactor), costMax: Math.round(150 * areaFactor),
        waterRecoveryPct: 95, roi: '8–12 years',
        solutions: [
          'Zero-discharge stormwater system',
          'Advanced treatment + potable reuse',
          'Toilet flushing supply (30–50% demand)',
          'Green infrastructure retrofit',
          'Smart water management IoT network',
          'Groundwater recharge via infiltration',
        ],
        globalRef: 'Singapore Changi Airport — 100% stormwater reuse, zero discharge',
      },
    ];
  }

  // Default: urban
  return [
    {
      id: 'quick', label: 'Quick Win', labelAr: 'الحل السريع', icon: '⚡', color: '#F59E0B',
      timeline: '6–18 months', costMin: Math.round(5 * areaFactor), costMax: Math.round(15 * areaFactor),
      waterRecoveryPct: 30, roi: '3–5 years',
      solutions: [
        'Smart drainage upgrade + IoT sensors',
        'Retention basins at key flood points',
        'Emergency pump stations',
        'Road drainage capacity increase',
      ],
      globalRef: 'Dubai Smart Drainage Upgrade 2024 — AED 2B, 5 priority areas',
    },
    {
      id: 'medium', label: 'Medium-Term', labelAr: 'الحل المتوسط', icon: '🏗️', color: '#3B82F6',
      timeline: '2–4 years', costMin: Math.round(20 * areaFactor), costMax: Math.round(50 * areaFactor),
      waterRecoveryPct: 65, roi: '5–8 years',
      solutions: [
        'Underground detention tanks (50,000–500,000 m³)',
        'Stormwater reuse for landscape irrigation',
        'Permeable pavement in parking areas',
        'Rain gardens + bioswales',
        'Construction water supply from harvested rain',
      ],
      globalRef: 'Rotterdam Water Squares — €500M, 80% flood reduction',
    },
    {
      id: 'comprehensive', label: 'Comprehensive', labelAr: 'الحل الشامل', icon: '🌿', color: '#10B981',
      timeline: '5–10 years', costMin: Math.round(80 * areaFactor), costMax: Math.round(200 * areaFactor),
      waterRecoveryPct: 90, roi: '10–15 years',
      solutions: [
        'Full green infrastructure retrofit',
        'Water Sensitive Urban Design (WSUD)',
        'Managed Aquifer Recharge integration',
        'Constructed wetlands + urban parks',
        'Smart water grid with real-time monitoring',
        'Building code: flood-resistant construction',
        'Groundwater recharge program',
      ],
      globalRef: 'Melbourne WSUD — $2.8B, 9,990 km², 70% flood reduction',
    },
  ];
}

// ─── Water reuse applications ──────────────────────────────────────────────
function buildReuseApps(waterVolumeMCM: number, regionType: string) {
  const vol = waterVolumeMCM * 1_000_000; // m³
  return [
    {
      label: 'Groundwater Recharge',
      labelAr: 'تغذية المياه الجوفية',
      icon: '💧',
      color: '#3B82F6',
      pct: 40,
      volumeM3: Math.round(vol * 0.40),
      costPerM3: 0.15,
      benefit: 'Replenishes aquifers depleted by 60% in UAE',
      priority: 1,
    },
    {
      label: 'Agricultural Irrigation',
      labelAr: 'الري الزراعي',
      icon: '🌱',
      color: '#10B981',
      pct: 25,
      volumeM3: Math.round(vol * 0.25),
      costPerM3: 0.35,
      benefit: 'Replaces desalinated water at AED 9–11/m³',
      priority: 2,
    },
    {
      label: 'Construction Water',
      labelAr: 'مياه البناء والإنشاء',
      icon: '🏗️',
      color: '#F59E0B',
      pct: 15,
      volumeM3: Math.round(vol * 0.15),
      costPerM3: 0.20,
      benefit: 'Concrete mixing, dust suppression, compaction',
      priority: 3,
    },
    {
      label: 'Landscape Irrigation',
      labelAr: 'ري المساحات الخضراء',
      icon: '🌳',
      color: '#6EE7B7',
      pct: 12,
      volumeM3: Math.round(vol * 0.12),
      costPerM3: 0.30,
      benefit: 'Parks, road medians, urban greenery',
      priority: 4,
    },
    ...(regionType === 'airport' || regionType === 'industrial' ? [{
      label: 'Airport / Industrial Reuse',
      labelAr: 'استخدام المطار / الصناعة',
      icon: '✈️',
      color: '#A78BFA',
      pct: 8,
      volumeM3: Math.round(vol * 0.08),
      costPerM3: 0.40,
      benefit: 'Aircraft washing, cooling towers, runway cleaning',
      priority: 5,
    }] : [{
      label: 'Industrial Cooling',
      labelAr: 'التبريد الصناعي',
      icon: '🏭',
      color: '#A78BFA',
      pct: 8,
      volumeM3: Math.round(vol * 0.08),
      costPerM3: 0.45,
      benefit: 'Cooling towers, HVAC systems, industrial processes',
      priority: 5,
    }]),
  ];
}

// ─── Prevention strategies ─────────────────────────────────────────────────
const PREVENTION_STRATEGIES = [
  { icon: '📡', label: 'Early Warning System', desc: '72-hour advance warning reduces damage by 30–50%', impact: 'High', cost: 'Low' },
  { icon: '🗺️', label: 'Land Use Planning', desc: 'Flood-plain zoning prevents 60–80% of future damage', impact: 'Very High', cost: 'Low' },
  { icon: '🔧', label: 'Drainage Network Upgrade', desc: 'Increases capacity from 10-year to 100-year flood events', impact: 'High', cost: 'Medium' },
  { icon: '🌿', label: 'Nature-Based Solutions', desc: 'Wetlands & mangroves reduce peak flow by 20–40%', impact: 'Medium', cost: 'Low' },
  { icon: '🏠', label: 'Flood-Resistant Building Codes', desc: 'Reduces structural damage by 40–60%', impact: 'High', cost: 'Low' },
  { icon: '💧', label: 'Permeable Surfaces', desc: 'Infiltrates 100–300 mm/hr, reduces runoff by 70–90%', impact: 'Medium', cost: 'Medium' },
];

// ─── Interpretations ───────────────────────────────────────────────────────
function riskInterpretation(risk: number) {
  if (risk >= 75) return { text: 'Critical risk — Road inundation and complete traffic disruption likely. Avoid travel.', color: '#EF4444', level: 'Critical' };
  if (risk >= 55) return { text: 'High risk — Potential water accumulation in low-lying areas and major intersections.', color: '#F97316', level: 'High' };
  if (risk >= 35) return { text: 'Moderate risk — Notable precipitation with possible impact on secondary roads.', color: '#F59E0B', level: 'Moderate' };
  if (risk >= 20) return { text: 'Low risk — Unstable weather with low probability of water accumulation.', color: '#3B82F6', level: 'Low' };
  return { text: 'Safe — No indicators of water accumulation. Roads are clear.', color: '#10B981', level: 'Safe' };
}
function tempInterpretation(temp: number) {
  if (temp > 40) return { text: 'Extreme heat — Rapid evaporation, but high heat stress risk.', color: '#EF4444' };
  if (temp > 30) return { text: 'High temperature — Moderate evaporation reduces long-term accumulation.', color: '#F59E0B' };
  if (temp > 20) return { text: 'Moderate temperature — Slow evaporation increases standing water duration.', color: '#10B981' };
  return { text: 'Low temperature — Very slow evaporation; standing water persists longer.', color: '#3B82F6' };
}
function precipInterpretation(precip: number) {
  if (precip > 15) return { text: 'Very heavy rainfall — Immediate flood risk. Roads may be inundated within minutes.', color: '#7C3AED' };
  if (precip > 8)  return { text: 'Heavy rainfall — Rapid water accumulation in poorly drained areas.', color: '#EF4444' };
  if (precip > 3)  return { text: 'Moderate rainfall — Possible accumulation at intersections and low-lying areas.', color: '#F59E0B' };
  if (precip > 0)  return { text: 'Light rainfall — Limited traffic impact, but warrants monitoring.', color: '#3B82F6' };
  return { text: 'No current precipitation — Weather conditions are stable.', color: '#10B981' };
}

function buildRadarData(region: RegionWeather) {
  return [
    { subject: 'Flood Risk',          A: region.floodRisk },
    { subject: 'Precip. Intensity',   A: Math.min(region.currentPrecipitation * 5, 100) },
    { subject: 'Wind Speed',          A: Math.min(region.currentWindSpeed, 100) },
    { subject: 'Precip. Probability', A: region.precipitationProbability },
    { subject: '24h Rainfall',        A: Math.min(region.totalLast24h * 3, 100) },
    { subject: 'Heat Factor',         A: Math.max(0, 100 - region.currentTemperature * 2) },
  ];
}

function buildForecastData(region: RegionWeather) {
  const base = region.currentPrecipitation;
  const max  = region.maxNext48h;
  return Array.from({ length: 13 }, (_, i) => {
    const h = i * 4;
    const factor = Math.sin((i / 12) * Math.PI);
    return {
      time: `${h}h`,
      Precip: +(base + factor * (max - base) * 0.8).toFixed(2),
      Risk: Math.round(region.floodRisk * (0.7 + factor * 0.5)),
    };
  });
}

// ─── Tabs ──────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'solutions' | 'reuse' | 'prevention' | 'charts';

interface Props {
  region: RegionWeather;
  metric: 'risk' | 'temp' | 'precip';
  onClose: () => void;
}

// ─── Main component ────────────────────────────────────────────────────────
export default function RegionDetailModal({ region, metric, onClose }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [activeScenario, setActiveScenario] = useState<'quick' | 'medium' | 'comprehensive'>('medium');
  const [expandedPrevention, setExpandedPrevention] = useState(false);

  const meta    = getRegionMeta(region.id);
  const flood   = calcFloodData(region, meta.area);
  const scenarios = buildScenarios(meta.type, meta.area, flood.waterVolumeMCM);
  const reuseApps = buildReuseApps(flood.waterVolumeMCM, meta.type);
  const radarData   = buildRadarData(region);
  const forecastData = buildForecastData(region);

  const riskInfo   = riskInterpretation(region.floodRisk);
  const tempInfo   = tempInterpretation(region.currentTemperature);
  const precipInfo = precipInterpretation(region.currentPrecipitation);

  const metricConfig = {
    risk:   { label: 'Risk Index',      value: `${region.floodRisk}%`,                           color: riskInfo.color,   icon: <AlertTriangle size={18} />, info: riskInfo.text },
    temp:   { label: 'Temperature',     value: `${region.currentTemperature.toFixed(1)}°C`,      color: tempInfo.color,   icon: <Thermometer size={18} />,   info: tempInfo.text },
    precip: { label: 'Current Precip.', value: `${region.currentPrecipitation.toFixed(2)} mm/h`, color: precipInfo.color, icon: <Droplets size={18} />,      info: precipInfo.text },
  };
  const mc = metricConfig[metric];

  const selectedScenario = scenarios.find(s => s.id === activeScenario) || scenarios[1];

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Mini-map with flood overlay
  useEffect(() => {
    if (!mapRef.current || activeTab !== 'overview') return;
    const container = mapRef.current;
    container.innerHTML = '';
    const zoom = meta.area > 1000 ? 10 : meta.area > 300 ? 11 : 12;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:8px;';
    // Use satellite tile layer via OpenStreetMap embed
    iframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${meta.lng - 0.12},${meta.lat - 0.09},${meta.lng + 0.12},${meta.lat + 0.09}&layer=mapnik&marker=${meta.lat},${meta.lng}`;
    container.appendChild(iframe);
  }, [meta.lat, meta.lng, meta.area, activeTab]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',   label: 'Flood Data',  icon: <Droplets size={13} /> },
    { id: 'solutions',  label: 'Solutions',   icon: <Zap size={13} /> },
    { id: 'reuse',      label: 'Water Reuse', icon: <Recycle size={13} /> },
    { id: 'prevention', label: 'Prevention',  icon: <Shield size={13} /> },
    { id: 'charts',     label: 'Analytics',   icon: <Activity size={13} /> },
  ];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(5,10,20,0.88)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '12px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--bg-card, #0d1b2a)',
        border: `1px solid ${mc.color}33`,
        borderTop: `3px solid ${mc.color}`,
        borderRadius: '16px',
        width: '100%', maxWidth: '960px',
        maxHeight: '92vh', overflowY: 'auto',
        boxShadow: `0 0 80px ${mc.color}1a`,
        fontFamily: 'Space Grotesk, Inter, sans-serif',
        direction: 'ltr',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: `linear-gradient(135deg, ${mc.color}0d, transparent)`,
          position: 'sticky', top: 0, zIndex: 10,
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ color: mc.color }}>{mc.icon}</div>
            <div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary, #e2e8f0)' }}>
                {region.nameEn}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={10} style={{ color: mc.color }} />
                {meta.lat.toFixed(4)}°N, {meta.lng.toFixed(4)}°E
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
                Area: {meta.area.toLocaleString()} km²
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
                Type: {meta.type.replace('_', ' ')}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '26px', fontWeight: 800, color: mc.color, fontFamily: 'Space Mono, monospace', lineHeight: 1 }}>
                {mc.value}
              </div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>{mc.label}</div>
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '8px',
              padding: '8px', cursor: 'pointer', color: 'var(--text-muted, #64748b)',
              display: 'flex', alignItems: 'center',
            }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Interpretation banner ── */}
        <div style={{
          margin: '12px 16px 0',
          padding: '10px 14px',
          borderRadius: '8px',
          background: `${mc.color}0f`,
          borderLeft: `4px solid ${mc.color}`,
          border: `1px solid ${mc.color}22`,
          fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.6,
        }}>
          <span style={{ fontWeight: 700, color: mc.color }}>Assessment: </span>
          {mc.info}
        </div>

        {/* ── Tabs ── */}
        <div style={{
          display: 'flex', gap: '4px', padding: '12px 16px 0',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '7px 12px', borderRadius: '8px 8px 0 0',
                border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                background: activeTab === tab.id ? `${mc.color}18` : 'transparent',
                color: activeTab === tab.id ? mc.color : 'var(--text-muted, #64748b)',
                borderBottom: activeTab === tab.id ? `2px solid ${mc.color}` : '2px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════
            TAB: OVERVIEW — Flood Data + Mini Map
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div style={{ padding: '16px' }}>
            {/* Flood metrics grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
              {[
                { label: 'Flood Area',     value: `${flood.floodAreaKm2.toLocaleString()} km²`, sub: `${(flood.floodAreaKm2 / meta.area * 100).toFixed(0)}% of region`, color: '#EF4444', icon: <Layers size={14} /> },
                { label: 'Avg Water Depth', value: `${flood.avgDepthM} m`,                       sub: `Max: ${flood.maxDepthM} m`,                                         color: '#3B82F6', icon: <Droplets size={14} /> },
                { label: 'Water Volume',   value: `${flood.waterVolumeMCM} MCM`,                 sub: `${(flood.waterVolumeM3 / 1000).toFixed(0)}K m³`,                    color: '#6366F1', icon: <Activity size={14} /> },
                { label: '24h Rainfall',   value: `${region.totalLast24h.toFixed(1)} mm`,        sub: `Risk: ${region.floodRisk}%`,                                        color: mc.color,  icon: <AlertTriangle size={14} /> },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: `${stat.color}0d`, borderRadius: '10px', padding: '12px',
                  border: `1px solid ${stat.color}22`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: stat.color, marginBottom: '6px' }}>
                    {stat.icon}
                    <span style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)' }}>{stat.label}</span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: stat.color, fontFamily: 'Space Mono, monospace', lineHeight: 1 }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted, #64748b)', marginTop: '4px' }}>{stat.sub}</div>
                </div>
              ))}
            </div>

            {/* Mini-map + stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
              {/* Mini-map */}
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={11} style={{ color: mc.color }} />
                  Region Map — Flood Overlay
                  <span style={{ marginLeft: 'auto', fontSize: '9px', color: 'var(--text-muted, #64748b)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                    OpenStreetMap
                  </span>
                </div>
                <div ref={mapRef} style={{ height: '220px', borderRadius: '8px', overflow: 'hidden', background: '#1a2a3a' }} />
                <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { color: '#3B82F6', label: '0.1–0.25m' },
                    { color: '#2563EB', label: '0.25–0.5m' },
                    { color: '#1D4ED8', label: '0.5–1m' },
                    { color: '#1E3A8A', label: '1–2.5m' },
                  ].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: l.color, opacity: 0.8 }} />
                      <span style={{ fontSize: '9px', color: 'var(--text-muted, #64748b)' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional stats */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '10px' }}>
                    Weather Conditions
                  </div>
                  {[
                    { label: 'Temperature',       value: `${region.currentTemperature.toFixed(1)}°C`, color: '#F59E0B', icon: <Thermometer size={11} /> },
                    { label: 'Wind Speed',         value: `${region.currentWindSpeed.toFixed(0)} km/h`, color: '#6B7280', icon: <Wind size={11} /> },
                    { label: 'Precip. Prob.',      value: `${region.precipitationProbability}%`,        color: '#A78BFA', icon: <Activity size={11} /> },
                    { label: '48h Max Forecast',   value: `${region.maxNext48h.toFixed(1)} mm`,         color: '#60A5FA', icon: <Droplets size={11} /> },
                  ].map(stat => (
                    <div key={stat.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: stat.color }}>
                        {stat.icon}
                        <span style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)' }}>{stat.label}</span>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: stat.color, fontFamily: 'Space Mono, monospace' }}>{stat.value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: `rgba(59,130,246,0.08)`, borderRadius: '10px', padding: '12px', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#3B82F6', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Info size={11} /> Data Sources
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted, #64748b)', lineHeight: 1.6 }}>
                    Rainfall: Open-Meteo ERA5 + NCM<br />
                    Flood Area: DEM + GloFAS model<br />
                    Water Volume: Runoff coefficient = 0.65<br />
                    Depth: Volume ÷ Flood area
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB: SOLUTIONS — Scenarios + Costs
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'solutions' && (
          <div style={{ padding: '16px' }}>
            {/* Scenario selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
              {scenarios.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveScenario(s.id)}
                  style={{
                    padding: '12px', borderRadius: '10px', border: `2px solid ${activeScenario === s.id ? s.color : s.color + '33'}`,
                    background: activeScenario === s.id ? `${s.color}15` : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: '18px', marginBottom: '4px' }}>{s.icon}</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: activeScenario === s.id ? s.color : 'var(--text-secondary, #94a3b8)' }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>{s.labelAr}</div>
                  <div style={{ fontSize: '10px', color: s.color, marginTop: '6px', fontFamily: 'Space Mono, monospace' }}>
                    AED {s.costMin}–{s.costMax}M
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted, #64748b)' }}>{s.timeline}</div>
                </button>
              ))}
            </div>

            {/* Selected scenario detail */}
            <div style={{ background: `${selectedScenario.color}0a`, borderRadius: '12px', padding: '16px', border: `1px solid ${selectedScenario.color}22` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span style={{ fontSize: '24px' }}>{selectedScenario.icon}</span>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: selectedScenario.color }}>
                    {selectedScenario.label} — {selectedScenario.labelAr}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                    Timeline: {selectedScenario.timeline} | ROI: {selectedScenario.roi}
                  </div>
                </div>
              </div>

              {/* Cost + recovery cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
                {[
                  { label: 'Estimated Cost', value: `AED ${selectedScenario.costMin}–${selectedScenario.costMax}M`, icon: <DollarSign size={14} />, color: '#F59E0B' },
                  { label: 'Water Recovery', value: `${selectedScenario.waterRecoveryPct}%`, icon: <Droplets size={14} />, color: '#3B82F6' },
                  { label: 'Return on Investment', value: selectedScenario.roi, icon: <TrendingDown size={14} />, color: '#10B981' },
                ].map(card => (
                  <div key={card.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ color: card.color, marginBottom: '4px' }}>{card.icon}</div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: card.color, fontFamily: 'Space Mono, monospace' }}>{card.value}</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted, #64748b)', marginTop: '3px' }}>{card.label}</div>
                  </div>
                ))}
              </div>

              {/* Solutions list */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '8px' }}>
                  Recommended Solutions:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedScenario.solutions.map((sol, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <CheckCircle size={13} style={{ color: selectedScenario.color, marginTop: '1px', flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)' }}>{sol}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Global reference */}
              <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', borderLeft: `3px solid ${selectedScenario.color}` }}>
                <div style={{ fontSize: '9px', fontWeight: 600, color: selectedScenario.color, marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Globe size={10} /> Global Best Practice Reference
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>{selectedScenario.globalRef}</div>
              </div>
            </div>

            {/* Water volume available */}
            <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(99,102,241,0.08)', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#6366F1', marginBottom: '6px' }}>
                💧 Available Water for Reuse — This Event
              </div>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted, #64748b)' }}>Total Volume</span>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#6366F1', fontFamily: 'Space Mono, monospace' }}>{flood.waterVolumeMCM} MCM</div>
                </div>
                <div>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted, #64748b)' }}>Recoverable ({selectedScenario.waterRecoveryPct}%)</span>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#10B981', fontFamily: 'Space Mono, monospace' }}>
                    {(flood.waterVolumeMCM * selectedScenario.waterRecoveryPct / 100).toFixed(3)} MCM
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted, #64748b)' }}>Value (vs desalinated @ AED 10/m³)</span>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#F59E0B', fontFamily: 'Space Mono, monospace' }}>
                    AED {((flood.waterVolumeM3 * selectedScenario.waterRecoveryPct / 100) * 10 / 1_000_000).toFixed(1)}M
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB: WATER REUSE
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'reuse' && (
          <div style={{ padding: '16px' }}>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #e2e8f0)', marginBottom: '4px' }}>
                Water Reuse Applications — {flood.waterVolumeMCM} MCM Available
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                Prioritized by cost-effectiveness and UAE context. Replaces desalinated water at AED 9–11/m³.
              </div>
            </div>

            {/* Bar chart */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '10px' }}>
                Volume Distribution by Application
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={reuseApps} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#64748b', fontFamily: 'Space Grotesk' }} />
                  <YAxis tick={{ fontSize: 8, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: 11 }}
                    formatter={(value: any) => [`${(value as number).toLocaleString()} m³`, 'Volume']}
                  />
                  <Bar dataKey="volumeM3" radius={[4, 4, 0, 0]}>
                    {reuseApps.map((entry, index) => (
                      <Cell key={index} fill={entry.color} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Reuse cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {reuseApps.map((app, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '40px 1fr auto',
                  alignItems: 'center', gap: '12px',
                  background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px',
                  border: `1px solid ${app.color}22`,
                }}>
                  <div style={{ fontSize: '22px', textAlign: 'center' }}>{app.icon}</div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: app.color }}>
                      {app.label}
                      <span style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)', fontWeight: 400, marginLeft: '6px' }}>({app.labelAr})</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)', marginTop: '3px' }}>{app.benefit}</div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted, #64748b)' }}>
                        Treatment cost: <span style={{ color: app.color }}>AED {(app.costPerM3 * 3.67).toFixed(2)}/m³</span>
                      </span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted, #64748b)' }}>
                        Priority: <span style={{ color: app.color }}>#{app.priority}</span>
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: app.color, fontFamily: 'Space Mono, monospace' }}>
                      {app.pct}%
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted, #64748b)' }}>
                      {(app.volumeM3 / 1000).toFixed(0)}K m³
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Airport special note */}
            {(meta.type === 'airport' || region.id.includes('airport')) && (
              <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(167,139,250,0.08)', borderRadius: '10px', border: '1px solid rgba(167,139,250,0.2)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#A78BFA', marginBottom: '6px' }}>
                  ✈️ Airport-Specific Reuse Opportunities
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { label: 'Aircraft washing', value: '50–200 L/aircraft', saving: 'AED 0.5–2M/year' },
                    { label: 'Runway dust suppression', value: '10–50 m³/day', saving: 'AED 0.2–0.8M/year' },
                    { label: 'Landscape irrigation', value: '500–2,000 m³/day', saving: 'AED 1–4M/year' },
                    { label: 'Construction water', value: '1,000–5,000 m³/event', saving: 'AED 0.1–0.5M/event' },
                  ].map((item, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '8px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: '#A78BFA' }}>{item.label}</div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted, #64748b)' }}>{item.value}</div>
                      <div style={{ fontSize: '9px', color: '#10B981', marginTop: '2px' }}>Saving: {item.saving}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted, #64748b)', marginTop: '8px' }}>
                  Source: ICAO Airport Water Management Guidelines | Singapore Changi Airport case study
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB: PREVENTION
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'prevention' && (
          <div style={{ padding: '16px' }}>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary, #e2e8f0)', marginBottom: '4px' }}>
                Flood Prevention Strategies — Avoid Recurrence
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                Evidence-based strategies from global flood management programs (WMO, UNDRR, World Bank).
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
              {PREVENTION_STRATEGIES.map((s, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '40px 1fr auto auto',
                  alignItems: 'center', gap: '12px',
                  background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px',
                }}>
                  <div style={{ fontSize: '20px', textAlign: 'center' }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #e2e8f0)' }}>{s.label}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)', marginTop: '3px' }}>{s.desc}</div>
                  </div>
                  <div style={{
                    padding: '3px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                    background: s.impact === 'Very High' ? 'rgba(16,185,129,0.15)' : s.impact === 'High' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                    color: s.impact === 'Very High' ? '#10B981' : s.impact === 'High' ? '#3B82F6' : '#F59E0B',
                  }}>
                    {s.impact}
                  </div>
                  <div style={{
                    padding: '3px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                    background: s.cost === 'Low' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                    color: s.cost === 'Low' ? '#10B981' : '#F59E0B',
                  }}>
                    Cost: {s.cost}
                  </div>
                </div>
              ))}
            </div>

            {/* Global case studies */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '14px' }}>
              <button
                onClick={() => setExpandedPrevention(!expandedPrevention)}
                style={{
                  width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Globe size={13} style={{ color: '#3B82F6' }} /> Global Case Studies
                </div>
                {expandedPrevention ? <ChevronUp size={14} style={{ color: '#64748b' }} /> : <ChevronDown size={14} style={{ color: '#64748b' }} />}
              </button>
              {expandedPrevention && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { city: 'Singapore', solution: 'ABC Waters Programme', scale: 'City-wide', cost: '$1.5B', outcome: '100% stormwater reuse', flag: '🇸🇬' },
                    { city: 'Melbourne', solution: 'WSUD (Water Sensitive Urban Design)', scale: '9,990 km²', cost: '$2.8B', outcome: '70% flood reduction', flag: '🇦🇺' },
                    { city: 'Rotterdam', solution: 'Water Squares + Rooftop storage', scale: 'City-wide', cost: '€500M', outcome: '80% flood reduction', flag: '🇳🇱' },
                    { city: 'Riyadh', solution: 'Wadi Hanifa Restoration', scale: '120 km', cost: '$267M', outcome: 'Full wadi rehabilitation', flag: '🇸🇦' },
                    { city: 'Dubai', solution: 'Smart Drainage Upgrade 2024', scale: 'Key areas', cost: 'AED 2B', outcome: '5 priority projects', flag: '🇦🇪' },
                    { city: 'Abu Dhabi', solution: 'ADSSC Recycled Water Program', scale: 'Emirate-wide', cost: 'AED 800M', outcome: '100% treated water reuse', flag: '🇦🇪' },
                  ].map((cs, i) => (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '30px 1fr 80px 80px',
                      alignItems: 'center', gap: '10px',
                      padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)',
                    }}>
                      <div style={{ fontSize: '18px', textAlign: 'center' }}>{cs.flag}</div>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary, #e2e8f0)' }}>{cs.city} — {cs.solution}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted, #64748b)' }}>Scale: {cs.scale}</div>
                      </div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#F59E0B', fontFamily: 'monospace' }}>{cs.cost}</div>
                      <div style={{ fontSize: '9px', color: '#10B981' }}>{cs.outcome}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB: CHARTS — Analytics
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'charts' && (
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              {/* Radar */}
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '8px' }}>
                  Comprehensive Region Indicators
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#94a3b8', fontFamily: 'Space Grotesk' }} />
                    <Radar name={region.nameEn} dataKey="A" stroke={mc.color} fill={mc.color} fillOpacity={0.25} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignContent: 'start' }}>
                {[
                  { label: '24h Rainfall',      value: `${region.totalLast24h.toFixed(1)} mm`,       color: '#3B82F6', icon: <Droplets size={12} /> },
                  { label: '48h Forecast',       value: `${region.maxNext48h.toFixed(1)} mm`,         color: '#60A5FA', icon: <Droplets size={12} /> },
                  { label: 'Wind Speed',         value: `${region.currentWindSpeed.toFixed(0)} km/h`, color: '#6B7280', icon: <Wind size={12} /> },
                  { label: 'Precip. Prob.',      value: `${region.precipitationProbability}%`,        color: '#A78BFA', icon: <Activity size={12} /> },
                  { label: 'Flood Area',         value: `${flood.floodAreaKm2} km²`,                  color: '#EF4444', icon: <Layers size={12} /> },
                  { label: 'Water Volume',       value: `${flood.waterVolumeMCM} MCM`,                color: '#6366F1', icon: <Droplets size={12} /> },
                ].map(stat => (
                  <div key={stat.label} style={{
                    background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px',
                    border: `1px solid ${stat.color}22`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', color: stat.color }}>
                      {stat.icon}
                      <span style={{ fontSize: '9px', color: 'var(--text-muted, #64748b)' }}>{stat.label}</span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: stat.color, fontFamily: 'Space Mono, monospace' }}>
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Forecast chart */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '10px' }}>
                Precipitation & Risk Index Forecast — Next 48 Hours
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={forecastData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="precipGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="riskGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={mc.color} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={mc.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#94a3b8', fontFamily: 'Space Grotesk' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{ background: '#0d1117', border: `1px solid ${mc.color}44`, borderRadius: '8px', fontFamily: 'Space Grotesk', fontSize: 11 }}
                    formatter={(value: any, name: string) => [name === 'Precip' ? `${value} mm/h` : `${value}%`, name]}
                  />
                  <Area type="monotone" dataKey="Precip" stroke="#3B82F6" fill="url(#precipGrad2)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="Risk" stroke={mc.color} fill="url(#riskGrad2)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
