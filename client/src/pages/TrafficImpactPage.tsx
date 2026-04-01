/**
 * TrafficImpactPage.tsx — Traffic Analysis and Driving Behavior
 * Real Leaflet map + traffic flow + driver behavior analysis
 * Model BPR + Risk Perception Theory + Wardrop Equilibrium
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { analyzeTrafficFlow, ABU_DHABI_TRAFFIC_NETWORK, getFlowLevelLabel, getUsageReasonLabel, getBehaviorLabel, getBehaviorColor, type TrafficFlowResult, type DriverBehavior } from '@/services/trafficBehavior';
import { fetchAllRegionsWeather, getWeatherDescription } from '@/services/weatherApi';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { FileDown } from 'lucide-react';
import MetricTooltip from '@/components/MetricTooltip';

// ─── Rain Scenarios ───────────────────────────────────────────────────────
const SCENARIOS = [
  { id: 'dry',      label: 'Dry',                  icon: '☀️', precip: 0,   duration: 0,  color: '#22C55E' },
  { id: 'light',    label: 'Light Rain',           icon: '🌦️', precip: 5,   duration: 2,  color: '#84CC16' },
  { id: 'moderate', label: 'Moderate Rain',          icon: '🌧️', precip: 20,  duration: 4,  color: '#F59E0B' },
  { id: 'heavy',    label: 'Heavy Rain',           icon: '⛈️', precip: 45,  duration: 6,  color: '#EF4444' },
  { id: 'apr2024',  label: 'April 2024',            icon: '🌊', precip: 80,  duration: 12, color: '#DC2626' },
  { id: 'extreme',  label: 'Exceptional Storm',       icon: '🌀', precip: 120, duration: 24, color: '#7C3AED' },
];

const TIME_SLOTS = [
  { id: 'morning_peak',  label: 'Morning Peak',    icon: '🌅' },
  { id: 'midday',        label: 'Midday',   icon: '☀️' },
  { id: 'evening_peak',  label: 'Evening Peak',    icon: '🌆' },
  { id: 'night',         label: 'Night',          icon: '🌙' },
];

const FLOW_LEGEND = [
  { color: '#22C55E', label: 'Fully Clear',   desc: 'Smooth traffic — no delay' },
  { color: '#84CC16', label: 'Stable',         desc: 'Delay < 5 minutes' },
  { color: '#F59E0B', label: 'Congested',         desc: 'Delay 5-15 minute' },
  { color: '#EF4444', label: 'Very Heavy',     desc: 'Delay 15-45 minutes' },
  { color: '#7C3AED', label: 'Stopped / Closed',  desc: 'Water floods road' },
];

const BEHAVIOR_INFO: Record<DriverBehavior, { icon: string; desc: string; color: string }> = {
  normal:      { icon: '😊', desc: 'No behavior change',           color: '#22C55E' },
  cautious:    { icon: '🐢', desc: 'Reduce speed and safety distance', color: '#3B82F6' },
  risk_taking: { icon: '⚠️', desc: 'Passes despite risk',           color: '#F59E0B' },
  avoiding:    { icon: '↩️', desc: 'Searches for alternative route',            color: '#8B5CF6' },
  panic:       { icon: '😱', desc: 'Sudden stop or random parking',    color: '#EF4444' },
};

type TabId = 'map' | 'behavior' | 'table';
type TimeSlot = 'morning_peak' | 'midday' | 'evening_peak' | 'night';

export default function TrafficImpactPage() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);

  const [scenarioId, setScenarioId] = useState('live'); // default: live data
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('morning_peak');
  const [mapStyle, setMapStyle] = useState<'dark' | 'osm'>('dark');
  const [results, setResults] = useState<TrafficFlowResult[]>([]);
  const [selectedRoad, setSelectedRoad] = useState<TrafficFlowResult | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('map');
  const [showPanel, setShowPanel] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  // Live weather state
  const [liveWeather, setLiveWeather] = useState<{
    precip: number; duration: number; temp: number; humidity: number;
    windSpeed: number; weatherCode: number; lastUpdated: string;
    zones: Array<{ name: string; precip: number; alertLevel: string }>;
  } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // ─── fetch real weather data ────────────────────────────────────────────
  useEffect(() => {
    const loadLiveWeather = async () => {
      setWeatherLoading(true);
      try {
        const data = await fetchAllRegionsWeather();
        // Aggregate: use max precipitation across all regions
        const maxPrecip = Math.max(...data.regions.map(r => r.currentPrecipitation));
        const avgTemp = data.regions.reduce((s, r) => s + r.currentTemperature, 0) / data.regions.length;
        const avgHumidity = data.regions.reduce((s, r) => s + (r.precipitationProbability || 0), 0) / data.regions.length;
        const avgWind = data.regions.reduce((s, r) => s + r.currentWindSpeed, 0) / data.regions.length;
        const mainCode = data.regions[0]?.weatherCode || 0;
        // Estimate duration from total last 24h / current rate
        const maxTotal24h = Math.max(...data.regions.map(r => r.totalLast24h));
        const estimatedDuration = maxPrecip > 0 ? Math.min(Math.round(maxTotal24h / Math.max(maxPrecip, 0.1)), 24) : 0;
        setLiveWeather({
          precip: Math.round(maxPrecip * 10) / 10,
          duration: Math.max(estimatedDuration, maxPrecip > 0 ? 1 : 0),
          temp: Math.round(avgTemp * 10) / 10,
          humidity: Math.round(avgHumidity),
          windSpeed: Math.round(avgWind * 10) / 10,
          weatherCode: mainCode,
          lastUpdated: data.fetchedAt,
          zones: data.regions.map(r => ({ name: r.nameAr, precip: r.currentPrecipitation, alertLevel: r.alertLevel })),
        });
        // Auto-select live scenario
        if (scenarioId === 'live') {
          // keep 'live' selected — drawLayers will use liveWeather
        }
      } catch (e) {
        console.warn('Live weather fetch failed:', e);
      } finally {
        setWeatherLoading(false);
      }
    };
    loadLiveWeather();
    // Auto-refresh every 10 minutes
    const interval = setInterval(loadLiveWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-detect current time slot
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 10) setTimeSlot('morning_peak');
    else if (hour >= 10 && hour < 16) setTimeSlot('midday');
    else if (hour >= 16 && hour < 21) setTimeSlot('evening_peak');
    else setTimeSlot('night');
  }, []);

  const scenarioPrecip = scenarioId === 'live' ? (liveWeather?.precip ?? 0) : (SCENARIOS.find(s => s.id === scenarioId)?.precip ?? 0);
  const scenarioDuration = scenarioId === 'live' ? (liveWeather?.duration ?? 0) : (SCENARIOS.find(s => s.id === scenarioId)?.duration ?? 0);
  const scenario = scenarioId === 'live'
    ? { id: 'live', label: 'Real Data Now', icon: '📡',
        precip: scenarioPrecip,
        duration: scenarioDuration,
        color: liveWeather ? (liveWeather.precip > 30 ? '#EF4444' : liveWeather.precip > 10 ? '#F59E0B' : liveWeather.precip > 0 ? '#84CC16' : '#22C55E') : 'var(--cyan)' }
    : SCENARIOS.find(s => s.id === scenarioId)!;

  // ─── initialize map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;

    const map = L.map(mapDivRef.current, {
      center: [24.4450, 54.4200],
      zoom: 11,
      zoomControl: true,
    });

    tileRef.current = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19 }
    ).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);

    // Region labels
    const zones = [
      { pos: [24.4539, 54.3773] as [number, number], name: 'Abu Dhabi City' },
      { pos: [24.3700, 54.4900] as [number, number], name: 'Mussafah' },
      { pos: [24.5200, 54.4100] as [number, number], name: 'Al Shahama' },
      { pos: [24.4150, 54.5800] as [number, number], name: 'Khalifa City' },
      { pos: [24.3600, 54.5800] as [number, number], name: 'South Abu Dhabi' },
      { pos: [24.5100, 54.5100] as [number, number], name: 'North Abu Dhabi' },
    ];
    zones.forEach(z => {
      L.marker(z.pos, {
        icon: L.divIcon({
          className: '',
          html: `<div style="background:rgba(0,0,0,0.75);border:1px solid rgba(27,79,138,0.35);padding:3px 8px;border-radius:6px;white-space:nowrap;pointer-events:none;font-family:Tajawal,sans-serif;color:var(--cyan);font-size:11px;font-weight:700;">${z.name}</div>`,
          iconAnchor: [40, 12],
        }),
        interactive: false,
      }).addTo(map);
    });

    mapRef.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // ─── alternative map pattern ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !tileRef.current) return;
    tileRef.current.remove();
    const url = mapStyle === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    tileRef.current = L.tileLayer(url, {
      attribution: mapStyle === 'dark' ? '© OpenStreetMap © CARTO' : '© OpenStreetMap',
      subdomains: mapStyle === 'dark' ? 'abcd' : 'abc',
      maxZoom: 19,
    }).addTo(mapRef.current);
  }, [mapStyle]);

  // ─── draw road layers ─────────────────────────────────────────────────────
  const drawLayers = useCallback((computed: TrafficFlowResult[]) => {
    if (!mapReady || !layerGroupRef.current) return;
    const lg = layerGroupRef.current;
    lg.clearLayers();

    computed.forEach(r => {
      const { segment, color, width, dashArray, flowLevel,
        currentSpeed, floodDepthCm, usageProbability, driverBehavior,
        behaviorReason, volume, delayMinutes, recommendation, avoidanceRate, riskTakingRate } = r;

      const bColor = getBehaviorColor(driverBehavior);

      // Background line for critical roads
      if (flowLevel === 'standstill' || flowLevel === 'heavy') {
        L.polyline(segment.coords, {
          color: '#ffffff',
          weight: 1.5,
          opacity: 0.18,
          dashArray: '5 8',
        }).addTo(lg);
      }

      // Main line
      const poly = L.polyline(segment.coords, {
        color,
        weight: width,
        opacity: 0.88,
        dashArray: dashArray || undefined,
        lineCap: 'round',
        lineJoin: 'round',
      });

      // Detailed popup
      poly.bindPopup(`
        <div dir="${isAr ? 'rtl' : 'ltr'}" style="font-family:Tajawal,sans-serif;min-width:280px;max-width:320px;">
          <div style="background:linear-gradient(135deg,${color}22,transparent);border-bottom:1px solid ${color}44;padding:10px 12px;margin:-10px -10px 10px;">
            <div style="font-size:14px;font-weight:700;color:#F1F5F9;">${segment.nameAr}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${segment.nameEn} · ${segment.zone}</div>
            <div style="margin-top:6px;display:flex;gap:5px;flex-wrap:wrap;">
              <span style="background:${color}22;color:${color};border:1px solid ${color}44;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;">${getFlowLevelLabel(flowLevel)}</span>
              <span style="background:${bColor}22;color:${bColor};border:1px solid ${bColor}44;padding:2px 8px;border-radius:10px;font-size:10px;">Behavior: ${getBehaviorLabel(driverBehavior)}</span>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
            <div style="background:#1E293B;border-radius:7px;padding:7px;text-align:center;">
              <div style="font-size:17px;font-weight:700;color:var(--cyan);">${currentSpeed.toFixed(0)}</div>
              <div style="font-size:9px;color:var(--text-muted);">km/hour</div>
            </div>
            <div style="background:#1E293B;border-radius:7px;padding:7px;text-align:center;">
              <div style="font-size:17px;font-weight:700;color:${floodDepthCm > 10 ? '#EF4444' : '#F59E0B'};">${floodDepthCm.toFixed(0)}</div>
              <div style="font-size:9px;color:var(--text-muted);">cm Water Depth</div>
            </div>
            <div style="background:#1E293B;border-radius:7px;padding:7px;text-align:center;">
              <div style="font-size:17px;font-weight:700;color:#A78BFA;">${usageProbability.toFixed(0)}%</div>
              <div style="font-size:9px;color:var(--text-muted);">Usage Probability</div>
            </div>
            <div style="background:#1E293B;border-radius:7px;padding:7px;text-align:center;">
              <div style="font-size:17px;font-weight:700;color:#FB923C;">+${delayMinutes}</div>
              <div style="font-size:9px;color:var(--text-muted);">minute Delay</div>
            </div>
          </div>
          <div style="background:#1E293B;border-radius:7px;padding:7px 9px;border-right:3px solid ${bColor};margin-bottom:8px;">
            <div style="font-size:9px;color:var(--text-muted);margin-bottom:2px;">Behavior reason</div>
            <div style="font-size:11px;color:var(--text-secondary);">${behaviorReason}</div>
          </div>
          <div style="margin-bottom:8px;">
            <div style="font-size:9px;color:var(--text-muted);margin-bottom:3px;">Traffic volume (${volume.toLocaleString()} / ${segment.capacity.toLocaleString()} cars/hr)</div>
            <div style="background:#1E293B;border-radius:4px;height:5px;overflow:hidden;">
              <div style="height:100%;width:${Math.min(100,(volume/segment.capacity)*100).toFixed(0)}%;background:${color};"></div>
            </div>
          </div>
          <div style="display:flex;gap:10px;margin-bottom:8px;font-size:10px;color:var(--text-muted);">
            <span>↩️ ${avoidanceRate.toFixed(0)}% avoiding</span>
            <span>⚠️ ${riskTakingRate.toFixed(0)}% risk-taking</span>
          </div>
          <div style="background:#0F2027;border:1px solid rgba(27,79,138,0.2);border-radius:7px;padding:7px 9px;font-size:10px;color:var(--text-secondary);">${recommendation}</div>
        </div>
      `, { maxWidth: 340, className: 'traffic-popup' });

      poly.on('click', () => setSelectedRoad(r));
      poly.addTo(lg);

      // Speed label at road midpoint
      if (segment.coords.length >= 2) {
        const mid = segment.coords[Math.floor(segment.coords.length / 2)];
        L.marker(mid, {
          icon: L.divIcon({
            className: '',
            html: `<div style="background:${color};color:#000;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;white-space:nowrap;font-family:Tajawal,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,0.6);">${currentSpeed.toFixed(0)}</div>`,
            iconAnchor: [14, 7],
          }),
          interactive: false,
        }).addTo(lg);
      }
    });
  }, [mapReady]);

  useEffect(() => {
    const computed = ABU_DHABI_TRAFFIC_NETWORK.map(seg =>
      analyzeTrafficFlow(seg, scenarioPrecip, Math.max(1, scenarioDuration), timeSlot)
    );
    setResults(computed);
    drawLayers(computed);
  }, [mapReady, scenarioPrecip, scenarioDuration, timeSlot, drawLayers]);

  // ─── statistical summary ─────────────────────────────────────────────────────────
  const summary = results.length > 0 ? {
    free:     results.filter(r => r.flowLevel === 'free' || r.flowLevel === 'stable').length,
    congested: results.filter(r => r.flowLevel === 'congested').length,
    heavy:    results.filter(r => r.flowLevel === 'heavy').length,
    closed:   results.filter(r => r.flowLevel === 'standstill').length,
    avgSpeed: results.reduce((s, r) => s + r.currentSpeed, 0) / results.length,
    avgDelay: results.reduce((s, r) => s + r.delayMinutes, 0) / results.length,
    totalVehicles: results.reduce((s, r) => s + r.volume, 0),
    avgUsage: results.reduce((s, r) => s + r.usageProbability, 0) / results.length,
  } : null;

  const pieData = summary ? [
    { name: 'Clear', value: summary.free, color: '#22C55E' },
    { name: 'Congested', value: summary.congested, color: '#F59E0B' },
    { name: 'heavy', value: summary.heavy, color: '#EF4444' },
    { name: 'Closed', value: summary.closed, color: '#7C3AED' },
  ].filter(d => d.value > 0) : [];

  const behaviorCounts = (['normal', 'cautious', 'risk_taking', 'avoiding', 'panic'] as DriverBehavior[]).map(b => ({
    name: getBehaviorLabel(b),
    value: results.filter(r => r.driverBehavior === b).length,
    color: getBehaviorColor(b),
    info: BEHAVIOR_INFO[b],
  })).filter(d => d.value > 0);

  return (
    <div className="flex flex-col h-full" style={{ background: '#0A0E1A', color: 'var(--text-primary)', fontFamily: 'Tajawal, sans-serif' }} dir={isAr ? 'rtl' : 'ltr'}>

      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b flex-wrap gap-2"
        style={{ borderColor: 'rgba(27,79,138,0.12)', background: '#0D1220', flexShrink: 0 }}>
        <div>
          <h1 className="text-sm font-bold" style={{ color: 'var(--cyan)' }}>
            🛣️ Traffic Analysis and Driving Behavior — Emirate Abu Dhabi
          </h1>
          <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            BPR model + risk perception theory · {ABU_DHABI_TRAFFIC_NETWORK.length} roads and streets
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tabs */}
          <div className="flex gap-1 rounded p-0.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
            {([['map', '🗺️ Map'], ['behavior', '🧠 behavior'], ['table', '📊 Schedule']] as [TabId, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className="text-[11px] px-3 py-1 rounded-md transition-all font-semibold"
                style={{
                  background: activeTab === id ? 'var(--cyan)' : 'transparent',
                  color: activeTab === id ? '#000' : 'rgba(255,255,255,0.5)',
                }}>
                {label}
              </button>
            ))}
          </div>
          {/* Map style */}
          {activeTab === 'map' && (
            <div className="flex gap-1">
              {([['dark', '🌑 Dark'], ['osm', '🗺️ Normal']] as ['dark' | 'osm', string][]).map(([id, label]) => (
                <button key={id} onClick={() => setMapStyle(id)}
                  className="text-[10px] px-2.5 py-1 rounded transition-all"
                  style={{
                    background: mapStyle === id ? 'rgba(27,79,138,0.12)' : 'transparent',
                    border: `1px solid ${mapStyle === id ? 'var(--cyan)' : 'rgba(255,255,255,0.1)'}`,
                    color: mapStyle === id ? 'var(--cyan)' : 'rgba(255,255,255,0.4)',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setShowPanel(v => !v)}
            className="text-[10px] px-2.5 py-1 rounded transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
            {showPanel ? '◀ Hide' : '▶ Dashboard'}
          </button>
          <button
            onClick={() => window.print()}
            className="text-[10px] px-2.5 py-1 rounded flex items-center gap-1"
            style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.30)', color: '#A78BFA', fontWeight: 600 }}
          >
            <FileDown size={10} />
            PDF
          </button>
        </div>
      </div>

      {/* ─── Scenario + Time Selectors ──────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b overflow-x-auto flex-shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#0B0F1C' }}>
        {/* Live data button */}
        <button
          onClick={() => setScenarioId('live')}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all"
          style={{
            background: scenarioId === 'live' ? 'rgba(27,79,138,0.18)' : 'rgba(27,79,138,0.05)',
            border: `1.5px solid ${scenarioId === 'live' ? 'var(--cyan)' : 'rgba(27,79,138,0.3)'}`,
            color: scenarioId === 'live' ? 'var(--cyan)' : 'rgba(27,79,138,0.6)',
          }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cyan)', display: 'inline-block',
            animation: weatherLoading ? 'none' : 'pulse 1.5s infinite' }} />
          📡 Live Data
          {liveWeather && !weatherLoading && (
            <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 400 }}>
              {liveWeather.precip > 0 ? ` · ${liveWeather.precip} mm/hr` : ' · Dry'}
            </span>
          )}
          {weatherLoading && <span style={{ color: 'rgba(255,255,255,0.4)' }}>⟳</span>}
        </button>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
        <span className="text-[10px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>Scenario:</span>
        {SCENARIOS.map(sc => (
          <button key={sc.id} onClick={() => setScenarioId(sc.id)}
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] transition-all"
            style={{
              background: scenarioId === sc.id ? `${sc.color}22` : 'transparent',
              border: `1px solid ${scenarioId === sc.id ? sc.color : 'rgba(255,255,255,0.1)'}`,
              color: scenarioId === sc.id ? sc.color : 'rgba(255,255,255,0.45)',
            }}>
            {sc.icon} {sc.label}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
        <span className="text-[10px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>Time:</span>
        {TIME_SLOTS.map(t => (
          <button key={t.id} onClick={() => setTimeSlot(t.id as TimeSlot)}
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] transition-all"
            style={{
              background: timeSlot === t.id ? 'rgba(27,79,138,0.12)' : 'transparent',
              border: `1px solid ${timeSlot === t.id ? 'var(--cyan)' : 'rgba(255,255,255,0.1)'}`,
              color: timeSlot === t.id ? 'var(--cyan)' : 'rgba(255,255,255,0.45)',
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ─── KPI Bar ────────────────────────────────────────────────────────── */}
      {summary && (
        <div className="flex border-b overflow-x-auto flex-shrink-0"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#0D1220' }}>
          {[
            { icon: '🟢', label: 'Clear', value: summary.free, color: '#22C55E', tid: 'road-flood-depth' },
            { icon: '🟠', label: 'Congested', value: summary.congested, color: '#F59E0B', tid: 'traffic-congestion-index' },
            { icon: '🔴', label: 'heavy', value: summary.heavy, color: '#EF4444', tid: 'traffic-congestion-index' },
            { icon: '🟣', label: 'Closed', value: summary.closed, color: '#7C3AED', tid: 'affected-roads-count' },
            { icon: '⚡', label: 'Average Speed', value: `${summary.avgSpeed.toFixed(0)} km/hr`, color: 'var(--cyan)', tid: 'speed-reduction' },
            { icon: '⏱️', label: 'Avg Delay', value: `+${summary.avgDelay.toFixed(0)} min`, color: '#F59E0B', tid: 'speed-reduction' },
            { icon: '🚗', label: 'Total Vehicles', value: summary.totalVehicles > 1000 ? `${(summary.totalVehicles/1000).toFixed(1)}k` : String(summary.totalVehicles), color: '#A78BFA', tid: 'traffic-congestion-index' },
            { icon: '📊', label: 'Avg Usage Rate', value: `${summary.avgUsage.toFixed(0)}%`, color: '#34D399', tid: 'road-usage-probability' },
          ].map((kpi, i) => (
            <div key={i} className="px-4 py-2 text-center flex-shrink-0"
              style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', minWidth: 90 }}>
              <div className="text-sm font-bold flex items-center justify-center gap-1" style={{ color: kpi.color }}>
                {kpi.value}
                <MetricTooltip id={kpi.tid} size={9} position="bottom" />
              </div>
              <div className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{kpi.icon} {kpi.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Main Content ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Side Panel */}
        <AnimatePresence>
          {showPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 250, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 overflow-y-auto border-l flex flex-col"
              style={{ borderColor: 'rgba(27,79,138,0.1)', background: '#0D1220' }}>

              {/* Live weather data */}
              {scenarioId === 'live' && liveWeather && (
                <div className="p-3 border-b" style={{ borderColor: 'rgba(27,79,138,0.15)', background: 'rgba(27,79,138,0.04)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--cyan)' }}>📡 Real weather — Now</p>
                    <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {new Date(liveWeather.lastUpdated).toLocaleTimeString('ar-AE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Rainfall', value: `${liveWeather.precip} mm/hr`, color: liveWeather.precip > 10 ? '#EF4444' : liveWeather.precip > 0 ? '#F59E0B' : '#22C55E' },
                      { label: 'Temperature', value: `${liveWeather.temp}°C`, color: '#F59E0B' },
                      { label: 'Wind', value: `${liveWeather.windSpeed} km/hr`, color: '#3B82F6' },
                      { label: 'Humidity', value: `${liveWeather.humidity}%`, color: '#8B5CF6' },
                    ].map((item, i) => (
                      <div key={i} className="rounded p-1.5 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.label}</div>
                        <div className="text-[11px] font-bold" style={{ color: item.color }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                  {/* Status Regions */}
                  <div className="mt-2">
                    <p className="text-[9px] mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Status Regions:</p>
                    {liveWeather.zones.slice(0, 4).map((z, i) => (
                      <div key={i} className="flex items-center justify-between mb-0.5">
                        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{z.name}</span>
                        <span className="text-[9px] font-bold" style={{
                          color: z.alertLevel === 'critical' ? '#EF4444' : z.alertLevel === 'warning' ? '#F59E0B' : z.alertLevel === 'watch' ? '#84CC16' : '#22C55E'
                        }}>
                          {z.precip > 0 ? `${z.precip} mm/hr` : 'Dry'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-[9px] text-center rounded-full px-2 py-0.5" style={{ background: 'rgba(27,79,138,0.1)', color: 'var(--cyan)' }}>
                    ✅ Open-Meteo API — Data real
                  </div>
                </div>
              )}
              {/* Pie chart */}
              <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Distribution traffic flow</p>
                <ResponsiveContainer width="100%" height={110}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={48} dataKey="value" paddingAngle={2}>
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0D1220', border: '1px solid rgba(27,79,138,0.3)', borderRadius: 6, fontSize: 10 }} itemStyle={{ color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-2 gap-y-1 justify-center">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                      <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Driver behavior */}
              <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Distribution driver behavior</p>
                {behaviorCounts.map((b, i) => (
                  <div key={i} className="mb-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px]" style={{ color: b.color }}>{b.info.icon} {b.name}</span>
                      <span className="text-[10px] font-bold" style={{ color: b.color }}>{b.value}</span>
                    </div>
                    <div className="rounded-full h-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div style={{ width: `${(b.value / Math.max(1, results.length)) * 100}%`, height: '100%', background: b.color, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Map legend */}
              <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Flow Legend</p>
                {FLOW_LEGEND.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <div className="rounded-sm flex-shrink-0" style={{ width: 28, height: 4, background: item.color }} />
                    <div>
                      <div className="text-[10px] font-semibold" style={{ color: item.color }}>{item.label}</div>
                      <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t text-[9px]" style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}>
                  <div>Numbers on lines = Speed (km/hr)</div>
                  <div className="mt-1">Line thickness = Road size</div>
                  <div className="mt-1">Dashed line = intermittent flow</div>
                  <div className="mt-1">Click any road for details</div>
                </div>
              </div>

              {/* Critical roads list */}
              <div className="p-3 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  most impacted roads
                </p>
                <div className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: 220 }}>
                  {results
                    .filter(r => r.flowLevel === 'standstill' || r.flowLevel === 'heavy')
                    .sort((a, b) => b.riskScore - a.riskScore)
                    .map((r, i) => (
                      <button key={i} onClick={() => setSelectedRoad(r)}
                        className="text-right p-2 rounded transition-all w-full"
                        style={{
                          background: selectedRoad?.segment.id === r.segment.id ? `${r.color}18` : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${selectedRoad?.segment.id === r.segment.id ? r.color : 'rgba(255,255,255,0.07)'}`,
                        }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{ background: `${r.color}22`, color: r.color }}>
                            {getFlowLevelLabel(r.flowLevel)}
                          </span>
                          <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>
                            {r.segment.nameAr}
                          </span>
                        </div>
                        <div className="flex justify-between mt-1 text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          <span>Depth: {r.floodDepthCm.toFixed(0)} cm</span>
                          <span>Risk: {r.riskScore.toFixed(0)}%</span>
                        </div>
                      </button>
                    ))}
                  {results.filter(r => r.flowLevel === 'standstill' || r.flowLevel === 'heavy').length === 0 && (
                    <div className="text-[10px] text-center py-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      ✅ No critical roads in this scenario
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── MAP ──────────────────────────────────────────────────────────── */}
        {activeTab === 'map' && (
          <div className="flex-1 relative">
            <div ref={mapDivRef} className="w-full h-full" />

            {/* Scenario badge */}
            <div className="absolute top-3 right-3 z-[500] rounded px-3 py-2 pointer-events-none"
              style={{ background: 'rgba(10,14,26,0.92)', border: `1px solid ${scenario.color}44`, backdropFilter: 'blur(8px)' }}>
              <div className="text-xs font-bold" style={{ color: scenario.color }}>{scenario.icon} {scenario.label}</div>
              {scenario.precip > 0 && (
                <div className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {scenario.precip} mm/hour · {scenario.duration} hour
                </div>
              )}
            </div>

            {/* Selected road detail */}
            <AnimatePresence>
              {selectedRoad && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[600] rounded p-4 w-[500px] max-w-[92vw]"
                  style={{ background: 'rgba(10,14,26,0.97)', border: `1px solid ${selectedRoad.color}55`, backdropFilter: 'blur(12px)' }}
                  dir={isAr ? 'rtl' : 'ltr'}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-sm" style={{ color: selectedRoad.color }}>{selectedRoad.segment.nameAr}</h3>
                      <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {selectedRoad.segment.nameEn} · {selectedRoad.segment.zone}
                      </p>
                    </div>
                    <button onClick={() => setSelectedRoad(null)}
                      className="text-xs px-2 py-1 rounded"
                      style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>✕</button>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[
                      { label: 'Flow', value: getFlowLevelLabel(selectedRoad.flowLevel), color: selectedRoad.color },
                      { label: 'Speed', value: `${selectedRoad.currentSpeed.toFixed(0)} km/hr`, color: 'var(--cyan)' },
                      { label: 'Water Depth', value: `${selectedRoad.floodDepthCm.toFixed(0)} cm`, color: selectedRoad.floodDepthCm > 10 ? '#EF4444' : '#F59E0B' },
                      { label: 'Usage', value: `${selectedRoad.usageProbability.toFixed(0)}%`, color: '#A78BFA' },
                      { label: 'driver behavior', value: getBehaviorLabel(selectedRoad.driverBehavior), color: getBehaviorColor(selectedRoad.driverBehavior) },
                      { label: 'avoiding', value: `${selectedRoad.avoidanceRate.toFixed(0)}%`, color: '#8B5CF6' },
                      { label: 'risk-taking', value: `${selectedRoad.riskTakingRate.toFixed(0)}%`, color: '#F59E0B' },
                      { label: 'Delay', value: `+${selectedRoad.delayMinutes} minute`, color: '#FB923C' },
                    ].map((item, i) => (
                      <div key={i} className="rounded p-2 text-center"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="text-xs font-bold" style={{ color: item.color }}>{item.value}</div>
                        <div className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded p-2.5 text-xs mb-2"
                    style={{ background: `${getBehaviorColor(selectedRoad.driverBehavior)}12`, border: `1px solid ${getBehaviorColor(selectedRoad.driverBehavior)}30` }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>behavior reason: </span>
                    <span style={{ color: 'var(--text-primary)' }}>{selectedRoad.behaviorReason}</span>
                  </div>

                  <div className="rounded p-2.5 text-xs"
                    style={{ background: `${selectedRoad.color}12`, border: `1px solid ${selectedRoad.color}30` }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Recommendation: </span>
                    <span style={{ color: 'var(--text-primary)' }}>{selectedRoad.recommendation}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ─── BEHAVIOR TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'behavior' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4">
              <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--cyan)' }}>🧠 driver behavior analysis in flood conditions</h3>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                based on risk perception theory and prospect theory — analyzes how the driver responds when encountering floods
              </p>
            </div>

            {/* Distribution behavior */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              {(['normal', 'cautious', 'risk_taking', 'avoiding', 'panic'] as DriverBehavior[]).map(b => {
                const count = results.filter(r => r.driverBehavior === b).length;
                const pct = results.length > 0 ? (count / results.length * 100).toFixed(0) : '0';
                const info = BEHAVIOR_INFO[b];
                return (
                  <div key={b} className="rounded p-3"
                    style={{ background: `${info.color}10`, border: `1px solid ${info.color}30` }}>
                    <div className="text-2xl mb-1">{info.icon}</div>
                    <div className="text-xl font-bold" style={{ color: info.color }}>{pct}%</div>
                    <div className="text-xs font-semibold mt-1" style={{ color: info.color }}>{getBehaviorLabel(b)}</div>
                    <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{info.desc}</div>
                    <div className="mt-2 rounded-full h-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: info.color, transition: 'width 0.5s' }} />
                    </div>
                    <div className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{count} From {results.length} Road</div>
                  </div>
                );
              })}
            </div>

            {/* Bar chart */}
            <div className="rounded p-4 mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h4 className="text-xs font-bold mb-3" style={{ color: 'rgba(255,255,255,0.6)' }}>Distribution behavior by road type</h4>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={
                  ['motorway', 'trunk', 'primary', 'secondary', 'residential'].map(type => {
                    const segs = results.filter(r => r.segment.type === type);
                    return {
                      name: type === 'motorway' ? 'quick' : type === 'trunk' ? 'Trunk' : type === 'primary' ? 'Primary' : type === 'secondary' ? 'Secondary' : 'Residential',
                      Normal: segs.filter(r => r.driverBehavior === 'normal').length,
                      cautious: segs.filter(r => r.driverBehavior === 'cautious').length,
                      risk_taking: segs.filter(r => r.driverBehavior === 'risk_taking').length,
                      avoiding: segs.filter(r => r.driverBehavior === 'avoiding').length,
                      panic: segs.filter(r => r.driverBehavior === 'panic').length,
                    };
                  })
                } margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} />
                  <Tooltip contentStyle={{ background: '#0D1220', border: '1px solid rgba(27,79,138,0.3)', borderRadius: 6, fontSize: 10 }} />
                  <Bar dataKey="Normal" stackId="a" fill="#22C55E" />
                  <Bar dataKey="cautious" stackId="a" fill="#3B82F6" />
                  <Bar dataKey="risk_taking" stackId="a" fill="#F59E0B" />
                  <Bar dataKey="avoiding" stackId="a" fill="#8B5CF6" />
                  <Bar dataKey="panic" stackId="a" fill="#EF4444" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Details All Road */}
            <h4 className="text-xs font-bold mb-3" style={{ color: 'rgba(255,255,255,0.6)' }}>Behavior details for all roads</h4>
            <div className="flex flex-col gap-2">
              {results.map(r => {
                const bInfo = BEHAVIOR_INFO[r.driverBehavior];
                return (
                  <div key={r.segment.id} className="rounded p-3"
                    style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${bInfo.color}25` }}>
                    <div className="flex justify-between items-start flex-wrap gap-2">
                      <div>
                        <div className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>{r.segment.nameAr}</div>
                        <div className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{r.segment.zone}</div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                          style={{ background: `${r.color}22`, color: r.color, border: `1px solid ${r.color}44` }}>
                          {getFlowLevelLabel(r.flowLevel)}
                        </span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full"
                          style={{ background: `${bInfo.color}22`, color: bInfo.color, border: `1px solid ${bInfo.color}44` }}>
                          {bInfo.icon} {getBehaviorLabel(r.driverBehavior)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 text-[10px] rounded-md p-2"
                      style={{ background: 'rgba(0,0,0,0.2)', borderRight: `3px solid ${bInfo.color}`, color: 'var(--text-secondary)' }}>
                      {r.behaviorReason}
                    </div>
                    <div className="flex gap-4 mt-2 flex-wrap">
                      <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>↩️ {r.avoidanceRate.toFixed(0)}% avoiding</span>
                      <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>⚠️ {r.riskTakingRate.toFixed(0)}% risk-taking</span>
                      <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>📊 {r.usageProbability.toFixed(0)}% usage probability</span>
                      <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>⏱️ +{r.delayMinutes} minute Delay</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── TABLE TAB ─────────────────────────────────────────────────────── */}
        {activeTab === 'table' && (
          <div className="flex-1 overflow-auto p-4">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ background: 'rgba(27,79,138,0.08)', borderBottom: '2px solid rgba(27,79,138,0.3)' }}>
                  {['Road', 'Region', 'flow', 'Speed', 'Water Depth', 'usage', 'driver behavior', 'avoiding', 'risk-taking', 'delay', 'Alternative Route'].map(h => (
                    <th key={h} className="px-3 py-2 text-right whitespace-nowrap font-bold" style={{ color: 'var(--cyan)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.segment.id}
                    className="cursor-pointer transition-all hover:bg-white/5"
                    onClick={() => setSelectedRoad(r)}
                    style={{
                      background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}>
                    <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.85)' }}>{r.segment.nameAr}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.45)' }}>{r.segment.zone}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-bold" style={{ color: r.color }}>{getFlowLevelLabel(r.flowLevel)}</td>
                    <td className="px-3 py-2 font-bold whitespace-nowrap" style={{ color: 'var(--cyan)' }}>{r.currentSpeed.toFixed(0)} km/hr</td>
                    <td className="px-3 py-2 font-bold whitespace-nowrap" style={{ color: r.floodDepthCm > 10 ? '#EF4444' : r.floodDepthCm > 5 ? '#F59E0B' : '#22C55E' }}>
                      {r.floodDepthCm.toFixed(1)} cm
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-bold" style={{ color: r.usageProbability > 70 ? '#22C55E' : r.usageProbability > 40 ? '#F59E0B' : '#EF4444' }}>
                        {r.usageProbability.toFixed(0)}%
                      </span>
                      <span className="mr-1 text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>({getUsageReasonLabel(r.usageReason)})</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: getBehaviorColor(r.driverBehavior) }}>
                      {BEHAVIOR_INFO[r.driverBehavior].icon} {getBehaviorLabel(r.driverBehavior)}
                    </td>
                    <td className="px-3 py-2 font-bold whitespace-nowrap" style={{ color: '#8B5CF6' }}>{r.avoidanceRate.toFixed(0)}%</td>
                    <td className="px-3 py-2 font-bold whitespace-nowrap" style={{ color: '#F59E0B' }}>{r.riskTakingRate.toFixed(0)}%</td>
                    <td className="px-3 py-2 font-bold whitespace-nowrap" style={{ color: r.delayMinutes > 20 ? '#EF4444' : r.delayMinutes > 10 ? '#F59E0B' : '#22C55E' }}>
                      +{r.delayMinutes} min
                    </td>
                    <td className="px-3 py-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.45)', maxWidth: 180 }}>{r.alternativeRoute}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Leaflet popup styles */}
      <style>{`
        .leaflet-popup-content-wrapper { background: #0F172A !important; border: 1px solid rgba(27,79,138,0.3) !important; border-radius: 10px !important; box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important; padding: 10px !important; }
        .leaflet-popup-content { margin: 0 !important; color: var(--text-primary) !important; }
        .leaflet-popup-tip-container { display: none !important; }
        .leaflet-popup-close-button { color: rgba(255,255,255,0.5) !important; font-size: 16px !important; top: 6px !important; right: 8px !important; }
      `}</style>
    </div>
  );
}
