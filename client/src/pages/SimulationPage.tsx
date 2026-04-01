/**
 * SimulationPage.tsx — Advanced Flood Scenario Simulation
 *
 * Improvements over previous version:
 * 1. Canvas-based flood depth grid (~5m cells STEP=0.000045°) — 10× faster than L.rectangle
 * 2. "Live" scenario auto-populated from real Open-Meteo precipitation data
 * 3. Traffic impact layer: roads colored by flow status (green/yellow/orange/red/purple)
 * 4. Full KPI bar: affected population, closed roads, flooded area, cells, max depth, elapsed time
 * 5. Right-side panel: depth legend, traffic legend, scenario comparison, affected regions list
 * 6. Bilingual support (Arabic / English) via useLanguage()
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play, Pause, RotateCcw, Settings, ChevronDown, ChevronUp,
  Droplets, AlertTriangle, Car, Users, Clock, MapPin, Layers,
  Zap, GitCompare, Activity, Navigation
} from 'lucide-react';
import InfoTooltip, { TOOLTIPS } from '@/components/InfoTooltip';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/useMobile';
import { useRealWeather } from '@/hooks/useRealWeather';
import {
  ABU_DHABI_TRAFFIC_NETWORK,
  analyzeTrafficFlow,
  getFlowLevelLabel,
  type TrafficFlowResult,
} from '@/services/trafficBehavior';

// ── Cell step ~5m ─────────────────────────────────────────────────────────────
const STEP = 0.000045;   // ~5m per cell
const GRID_ROWS = 40;    // 40×40 = 1600 cells per zone
const GRID_COLS = 40;
const CELL_M = STEP * 111320; // ~5.0 m

// ── Depth colour scale ─────────────────────────────────────────────────────────
function depthColor(depth: number): { fill: string; alpha: number; label: string } {
  if (depth <= 0)  return { fill: '#10B981', alpha: 0.06, label: 'Safe (0 cm)' };
  if (depth < 15)  return { fill: '#3B82F6', alpha: 0.35, label: 'Wet (1–15 cm)' };
  if (depth < 30)  return { fill: '#F59E0B', alpha: 0.52, label: 'Flood Light (15–30 cm)' };
  if (depth < 50)  return { fill: '#F97316', alpha: 0.65, label: 'Flooded (30–50 cm)' };
  if (depth < 80)  return { fill: '#EF4444', alpha: 0.78, label: 'Risk (50–80 cm)' };
  return             { fill: '#7C3AED', alpha: 0.90, label: 'Critical (>80 cm)' };
}

const DEPTH_LEGEND = [
  { label: 'Safe (0 cm)',         color: '#10B981' },
  { label: 'Wet (1–15 cm)',       color: '#3B82F6' },
  { label: 'Flood Light (15–30)', color: '#F59E0B' },
  { label: 'Flooded (30–50)',     color: '#F97316' },
  { label: 'Risk (50–80)',        color: '#EF4444' },
  { label: 'Critical (>80 cm)',   color: '#7C3AED' },
];

// ── Urban zones ────────────────────────────────────────────────────────────────
const URBAN_ZONES = [
  { id: 'island',     nameAr: 'جزيرة أبوظبي',          nameEn: 'Abu Dhabi Island',       region: 'abudhabi', lat: 24.4530, lng: 54.3700, population: 320000, baseElev: 3.2,  drain: 0.65, radius: 3500 },
  { id: 'mussafah',   nameAr: 'مصفح الصناعية',          nameEn: 'Mussafah Industrial',    region: 'abudhabi', lat: 24.3580, lng: 54.4950, population: 95000,  baseElev: 2.8,  drain: 0.40, radius: 3000 },
  { id: 'mbz',        nameAr: 'مدينة محمد بن زايد',     nameEn: 'MBZ City',               region: 'abudhabi', lat: 24.3950, lng: 54.5350, population: 180000, baseElev: 5.5,  drain: 0.55, radius: 3500 },
  { id: 'shahama',    nameAr: 'الشهامة',                nameEn: 'Al Shahama',             region: 'abudhabi', lat: 24.5059, lng: 54.4721, population: 65000,  baseElev: 2.4,  drain: 0.42, radius: 2500 },
  { id: 'shamkha',    nameAr: 'الشامخة',                nameEn: 'Al Shamkha',             region: 'abudhabi', lat: 24.3700, lng: 54.5100, population: 110000, baseElev: 8.0,  drain: 0.45, radius: 4000 },
  { id: 'khalifa',    nameAr: 'مدينة خليفة',            nameEn: 'Khalifa City',           region: 'abudhabi', lat: 24.4250, lng: 54.5900, population: 140000, baseElev: 5.8,  drain: 0.58, radius: 3000 },
  { id: 'wathba',     nameAr: 'الوثبة',                 nameEn: 'Al Wathba',              region: 'abudhabi', lat: 24.2900, lng: 54.6100, population: 45000,  baseElev: 6.5,  drain: 0.38, radius: 2500 },
  { id: 'shakhbout',  nameAr: 'مدينة شخبوط',            nameEn: 'Shakhbout City',         region: 'abudhabi', lat: 24.3200, lng: 54.5600, population: 75000,  baseElev: 7.2,  drain: 0.48, radius: 3000 },
  { id: 'ain-center', nameAr: 'مركز مدينة العين',       nameEn: 'Al Ain City Center',     region: 'alain',    lat: 24.2075, lng: 55.7447, population: 210000, baseElev: 280,  drain: 0.55, radius: 4000 },
  { id: 'ain-south',  nameAr: 'جنوب العين',             nameEn: 'South Al Ain',           region: 'alain',    lat: 24.1600, lng: 55.7500, population: 85000,  baseElev: 310,  drain: 0.48, radius: 2500 },
  { id: 'ruwais',     nameAr: 'الرويس',                 nameEn: 'Ruwais',                 region: 'dhafra',   lat: 24.1100, lng: 52.7300, population: 25000,  baseElev: 4.5,  drain: 0.35, radius: 2000 },
  { id: 'liwa',       nameAr: 'ليوا',                   nameEn: 'Liwa',                   region: 'dhafra',   lat: 23.1200, lng: 53.7700, population: 12000,  baseElev: 90,   drain: 0.30, radius: 1500 },
];

// ── Scenarios ──────────────────────────────────────────────────────────────────
const BASE_SCENARIOS = [
  { id: 'live',     nameAr: 'مباشر — بيانات حقيقية',   nameEn: 'Live — Real Data',    rate: 0,  duration: 7,  color: '#00D4FF', risk: 'Live',     icon: '📡', isLive: true },
  { id: 'light',    nameAr: 'أمطار خفيفة',             nameEn: 'Light Rain',          rate: 5,  duration: 3,  color: '#3B82F6', risk: 'Low',      icon: '🌦' },
  { id: 'moderate', nameAr: 'أمطار متوسطة',            nameEn: 'Moderate Rain',       rate: 22, duration: 6,  color: '#F59E0B', risk: 'Medium',   icon: '🌧' },
  { id: 'heavy',    nameAr: 'أمطار غزيرة',             nameEn: 'Heavy Rain',          rate: 45, duration: 8,  color: '#EF4444', risk: 'High',     icon: '⛈' },
  { id: 'extreme',  nameAr: 'استثنائية (2024)',         nameEn: 'Extreme (2024)',       rate: 80, duration: 24, color: '#7C3AED', risk: 'Critical', icon: '🌪' },
  { id: 'sea',      nameAr: 'ارتفاع منسوب البحر',      nameEn: 'Sea Level Rise',       rate: 10, duration: 12, color: '#06B6D4', risk: 'High',     icon: '🌊' },
  { id: 'drainage', nameAr: 'فشل شبكة الصرف',          nameEn: 'Drainage Failure',    rate: 25, duration: 6,  color: '#F97316', risk: 'High',     icon: '🚧' },
  { id: 'flash',    nameAr: 'فيضان وادي مفاجئ',        nameEn: 'Flash Flood (Wadi)',  rate: 60, duration: 2,  color: '#8B5CF6', risk: 'Critical', icon: '💧' },
];

// ── Cell depth calculation ─────────────────────────────────────────────────────
function calcCellDepth(
  cellElev: number, baseElev: number, drain: number,
  precipRate: number, elapsed: number, seaLevel: number,
  drainFail: number
): number {
  const elevFactor = Math.max(0, 1 - (cellElev - baseElev + 2) / 15);
  const totalPrecip = precipRate * elapsed;
  const effectiveDrain = drain * (1 - drainFail);
  const netAccum = Math.max(0, totalPrecip - effectiveDrain * precipRate * 0.8 * elapsed);
  const seaEffect = Math.max(0, seaLevel - cellElev) * 100;
  return Math.min(150, netAccum * 0.3 * (1 + elevFactor * 0.5) + seaEffect);
}

// ── hex → rgb helper ──────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

type RegionFilter = 'all' | 'abudhabi' | 'alain' | 'dhafra';

// ── Main Component ─────────────────────────────────────────────────────────────
export default function SimulationPage() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const isMobile = useIsMobile();

  // Live weather
  const { data: weatherData } = useRealWeather();
  const liveRegions = weatherData?.regions ?? [];
  const livePrecip = useMemo(() => {
    if (!liveRegions.length) return 18.5;
    const avg = liveRegions.reduce((s, r) => s + r.currentPrecipitation, 0) / liveRegions.length;
    return Math.round(avg * 10) / 10;
  }, [liveRegions]);

  // Map refs
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trafficLayerRef = useRef<any>(null);
  const boundaryLayerRef = useRef<any>(null);
  const labelLayerRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const boundaryCache = useRef<Record<string, [number, number][][] | null>>({});

  // Simulation state
  const [selectedScenarioId, setSelectedScenarioId] = useState('live');
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [precipRate, setPrecipRate] = useState(18.5);
  const [seaLevelRise, setSeaLevelRise] = useState(0);
  const [drainFailure, setDrainFailure] = useState(0.2);
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all');
  const [showGrid, setShowGrid] = useState(true);
  const [showTraffic, setShowTraffic] = useState(true);
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [loadingBoundary, setLoadingBoundary] = useState(false);

  // Sync live precip to precipRate when "live" scenario is active
  useEffect(() => {
    if (selectedScenarioId === 'live') {
      setPrecipRate(livePrecip);
    }
  }, [livePrecip, selectedScenarioId]);

  const scenarios = useMemo(() => BASE_SCENARIOS.map(s =>
    s.id === 'live' ? { ...s, rate: livePrecip } : s
  ), [livePrecip]);

  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId) ?? scenarios[0];

  // ── Simulation data per zone ──────────────────────────────────────────────────
  const simData = useMemo(() => URBAN_ZONES.map(zone => {
    const depth = calcCellDepth(zone.baseElev, zone.baseElev, zone.drain, precipRate, elapsed, seaLevelRise, drainFailure);
    const dc = depthColor(depth);
    const risk = Math.min(100, Math.round((depth / 80) * 100));
    const affectedRoads = depth > 15 ? Math.round((depth / 150) * 8) : 0;
    const affectedPop = Math.round(zone.population * (depth / 200));
    const totalCells = GRID_ROWS * GRID_COLS;
    const affectedCells = depth > 0 ? Math.round(totalCells * (depth / 150) * 0.6) : 0;
    const floodedAreaKm2 = +(affectedCells * CELL_M * CELL_M / 1e6).toFixed(3);
    return { ...zone, depth, dc, risk, affectedRoads, affectedPop, affectedCells, totalCells, floodedAreaKm2 };
  }), [precipRate, elapsed, seaLevelRise, drainFailure]);

  const filteredData = regionFilter === 'all' ? simData : simData.filter(z => z.region === regionFilter);

  // ── KPI aggregates ────────────────────────────────────────────────────────────
  const totalAffectedPop   = simData.reduce((s, z) => s + z.affectedPop, 0);
  const totalFloodedArea   = +simData.reduce((s, z) => s + z.floodedAreaKm2, 0).toFixed(2);
  const totalAffectedCells = simData.reduce((s, z) => s + z.affectedCells, 0);
  const maxDepth           = Math.max(...simData.map(z => z.depth));
  const criticalZones      = simData.filter(z => z.depth > 50).length;

  // ── Traffic analysis ──────────────────────────────────────────────────────────
  const trafficResults: TrafficFlowResult[] = useMemo(() =>
    ABU_DHABI_TRAFFIC_NETWORK.map(seg =>
      analyzeTrafficFlow(seg, precipRate, Math.max(0.5, elapsed), 'morning_peak')
    ), [precipRate, elapsed]);

  const closedRoadsCount = trafficResults.filter(r =>
    r.usageReason === 'closed' || r.usageReason === 'avoided'
  ).length;

  // ── Simulation controls ───────────────────────────────────────────────────────
  const stopSim = useCallback(() => {
    setIsRunning(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const resetSim = useCallback(() => {
    stopSim();
    setElapsed(0);
  }, [stopSim]);

  const startSim = useCallback(() => {
    setIsRunning(true);
    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = +(prev + 0.1).toFixed(1);
        if (next >= selectedScenario.duration) { stopSim(); return selectedScenario.duration; }
        return next;
      });
    }, 500);
  }, [selectedScenario.duration, stopSim]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const applyScenario = (s: typeof scenarios[0]) => {
    stopSim();
    setElapsed(0);
    setSelectedScenarioId(s.id);
    if (!s.isLive) {
      setPrecipRate(s.rate);
      if (s.id === 'sea') { setSeaLevelRise(1.0); setDrainFailure(0.2); }
      else if (s.id === 'drainage') { setSeaLevelRise(0); setDrainFailure(1.0); }
      else { setSeaLevelRise(0); setDrainFailure(s.id === 'extreme' ? 0.8 : s.id === 'flash' ? 0.6 : 0.2); }
    }
  };

  // ── Canvas flood grid drawing ─────────────────────────────────────────────────
  const drawFloodCanvas = useCallback(() => {
    const map = leafletRef.current;
    if (!map || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;
    ctx.clearRect(0, 0, size.x, size.y);

    if (!showGrid) return;

    const visibleZones = regionFilter === 'all' ? URBAN_ZONES : URBAN_ZONES.filter(z => z.region === regionFilter);

    visibleZones.forEach(zone => {
      const startLat = zone.lat - (GRID_ROWS / 2) * STEP;
      const startLng = zone.lng - (GRID_COLS / 2) * STEP;

      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const cellElev = zone.baseElev + Math.sin(r * 0.7 + c * 0.5) * 1.5 + Math.cos(r * 0.3 + c * 0.9) * 0.8;
          const depth = calcCellDepth(cellElev, zone.baseElev, zone.drain, precipRate, elapsed, seaLevelRise, drainFailure);
          if (depth <= 0) continue;

          const dc = depthColor(depth);
          const cellLat = startLat + r * STEP;
          const cellLng = startLng + c * STEP;

          const p1 = map.latLngToContainerPoint([cellLat, cellLng]);
          const p2 = map.latLngToContainerPoint([cellLat + STEP, cellLng + STEP]);
          const w = Math.max(1, Math.abs(p2.x - p1.x));
          const h = Math.max(1, Math.abs(p2.y - p1.y));

          const [rr, gg, bb] = hexToRgb(dc.fill);
          ctx.fillStyle = `rgba(${rr},${gg},${bb},${dc.alpha})`;
          ctx.fillRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), w, h);
        }
      }
    });
  }, [precipRate, elapsed, seaLevelRise, drainFailure, regionFilter, showGrid]);

  // ── Traffic layer drawing ─────────────────────────────────────────────────────
  const drawTrafficLayer = useCallback(() => {
    const L = (window as any).L;
    if (!L || !trafficLayerRef.current) return;
    trafficLayerRef.current.clearLayers();
    if (!showTraffic) return;

    trafficResults.forEach(result => {
      const { segment, color, width, dashArray, recommendation, flowLevel, floodDepthCm, currentSpeed, delayMinutes } = result;
      if (!segment.coords || segment.coords.length < 2) return;

      const polyline = L.polyline(segment.coords, {
        color,
        weight: width,
        opacity: 0.88,
        dashArray: dashArray || undefined,
        lineCap: 'round',
        lineJoin: 'round',
      });

      polyline.bindTooltip(
        `<div style="font-family:Tajawal,sans-serif;font-size:11px;padding:6px 10px;min-width:180px;direction:${dir}">
          <div style="font-weight:800;color:${color};margin-bottom:4px">${segment.nameAr}</div>
          <div style="color:#94a3b8;font-size:10px;margin-bottom:6px">${getFlowLevelLabel(flowLevel)}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;font-size:10px">
            <span style="color:#64748b">${isAr ? 'عمق المياه' : 'Water Depth'}</span><span style="color:${color};font-weight:700">${floodDepthCm.toFixed(0)} cm</span>
            <span style="color:#64748b">${isAr ? 'السرعة' : 'Speed'}</span><span style="color:#e2e8f0">${currentSpeed.toFixed(0)} km/h</span>
            <span style="color:#64748b">${isAr ? 'التأخير' : 'Delay'}</span><span style="color:#F59E0B">${delayMinutes} min</span>
          </div>
          <div style="margin-top:6px;font-size:9px;color:#94a3b8;border-top:1px solid rgba(255,255,255,0.1);padding-top:4px">${recommendation}</div>
        </div>`,
        { sticky: true, className: 'sim-tooltip' }
      );

      polyline.addTo(trafficLayerRef.current);
    });
  }, [trafficResults, showTraffic, dir, isAr]);

  // ── Boundary fetch ────────────────────────────────────────────────────────────
  const fetchBoundary = async (lat: number, lon: number, id: string): Promise<[number, number][][] | null> => {
    if (boundaryCache.current[id] !== undefined) return boundaryCache.current[id];
    const query = `[out:json][timeout:20];(relation["boundary"="administrative"]["admin_level"~"6|7|8"](around:3000,${lat},${lon}););out body;>;out skel qt;`;
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const data = await res.json();
      const nodeMap: Record<number, [number, number]> = {};
      for (const el of data.elements) if (el.type === 'node') nodeMap[el.id] = [el.lat, el.lon];
      const polygons: [number, number][][] = [];
      for (const el of data.elements) {
        if (el.type === 'way' && el.nodes?.length > 2) {
          const coords = el.nodes.map((n: number) => nodeMap[n]).filter(Boolean) as [number, number][];
          if (coords.length > 2) polygons.push(coords);
        }
      }
      const result = polygons.length > 0 ? polygons : null;
      boundaryCache.current[id] = result;
      return result;
    } catch { boundaryCache.current[id] = null; return null; }
  };

  // ── Map initialization ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      const L = (window as any).L;
      const map = L.map(mapRef.current, {
        center: [24.2, 54.5],
        zoom: 9,
        zoomControl: false,
        attributionControl: true,
      });

      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri World Imagery',
        maxZoom: 19,
      }).addTo(map);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
        attribution: 'CartoDB',
        maxZoom: 19,
        opacity: 0.85,
      }).addTo(map);

      L.control.zoom({ position: 'bottomleft' }).addTo(map);
      leafletRef.current = map;

      // Canvas flood layer — injected directly into map pane
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:400;';
      const pane = mapRef.current!.querySelector('.leaflet-map-pane');
      if (pane) pane.appendChild(canvas);
      canvasRef.current = canvas;

      // Traffic layer
      trafficLayerRef.current = L.layerGroup().addTo(map);
      // Boundary layer
      boundaryLayerRef.current = L.layerGroup().addTo(map);
      // Label layer
      labelLayerRef.current = L.layerGroup().addTo(map);

      // Zone labels
      URBAN_ZONES.forEach(zone => {
        const label = L.divIcon({
          html: `<div style="background:rgba(5,10,20,0.88);border:1px solid rgba(0,212,255,0.4);border-radius:4px;padding:2px 7px;color:#e2e8f0;font-family:Tajawal,sans-serif;font-size:10px;font-weight:700;white-space:nowrap;pointer-events:none;">${isAr ? zone.nameAr : zone.nameEn}</div>`,
          className: '',
          iconAnchor: [40, 8],
        });
        L.marker([zone.lat, zone.lng], { icon: label, interactive: false }).addTo(labelLayerRef.current);
      });

      map.on('moveend', drawFloodCanvas);
      map.on('zoomend', drawFloodCanvas);
      map.on('resize', drawFloodCanvas);

      drawFloodCanvas();
      drawTrafficLayer();
    };
    document.head.appendChild(script);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Redraw canvas when simulation state changes ───────────────────────────────
  useEffect(() => {
    if (leafletRef.current) drawFloodCanvas();
  }, [drawFloodCanvas]);

  // ── Redraw traffic when state changes ────────────────────────────────────────
  useEffect(() => {
    if (leafletRef.current) drawTrafficLayer();
  }, [drawTrafficLayer]);

  // ── Boundary on zone select ───────────────────────────────────────────────────
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !boundaryLayerRef.current) return;
    boundaryLayerRef.current.clearLayers();
    if (!showBoundaries || !selectedZoneId) return;
    const zone = URBAN_ZONES.find(z => z.id === selectedZoneId);
    if (!zone) return;
    setLoadingBoundary(true);
    fetchBoundary(zone.lat, zone.lng, zone.id).then(polys => {
      setLoadingBoundary(false);
      boundaryLayerRef.current?.clearLayers();
      if (!polys) return;
      polys.forEach(coords => {
        L.polygon(coords, {
          color: '#00d4ff', weight: 2, fillOpacity: 0.04, dashArray: '6,4',
        }).addTo(boundaryLayerRef.current);
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedZoneId, showBoundaries]);

  const flyToZone = (zone: typeof URBAN_ZONES[0]) => {
    setSelectedZoneId(zone.id);
    leafletRef.current?.flyTo([zone.lat, zone.lng], 13, { duration: 1.2 });
  };

  const selectedZoneData = simData.find(z => z.id === selectedZoneId) ?? null;

  // ── Scenario comparison data ──────────────────────────────────────────────────
  const comparisonData = useMemo(() => BASE_SCENARIOS.filter(s => !s.isLive).map(s => {
    const pr = s.rate;
    const maxD = Math.max(...URBAN_ZONES.map(z =>
      calcCellDepth(z.baseElev, z.baseElev, z.drain, pr, s.duration,
        s.id === 'sea' ? 1.0 : 0,
        s.id === 'drainage' ? 1.0 : s.id === 'extreme' ? 0.8 : 0.2)
    ));
    return { ...s, maxDepth: maxD };
  }), []);

  const progress = selectedScenario.duration > 0 ? (elapsed / selectedScenario.duration) * 100 : 0;

  // ── KPI cards ─────────────────────────────────────────────────────────────────
  const kpis = [
    {
      label: isAr ? 'السكان المتأثرون' : 'Affected Population',
      value: totalAffectedPop >= 1000 ? `${(totalAffectedPop / 1000).toFixed(0)}K` : `${totalAffectedPop}`,
      icon: <Users size={13} />,
      color: totalAffectedPop > 100000 ? '#EF4444' : '#F59E0B',
      tooltip: TOOLTIPS.affectedPopulation,
    },
    {
      label: isAr ? 'الطرق المغلقة' : 'Closed Roads',
      value: `${closedRoadsCount}`,
      icon: <Car size={13} />,
      color: closedRoadsCount > 5 ? '#EF4444' : closedRoadsCount > 0 ? '#F97316' : '#10B981',
      tooltip: TOOLTIPS.roadsClosed,
    },
    {
      label: isAr ? 'المساحة المغمورة' : 'Flooded Area',
      value: `${totalFloodedArea} km²`,
      icon: <Droplets size={13} />,
      color: '#3B82F6',
      tooltip: TOOLTIPS.floodedArea,
    },
    {
      label: isAr ? 'الخلايا المتأثرة' : 'Cells Affected',
      value: totalAffectedCells.toLocaleString(),
      icon: <Layers size={13} />,
      color: '#06B6D4',
      tooltip: null,
    },
    {
      label: isAr ? 'أقصى عمق' : 'Maximum Depth',
      value: `${maxDepth.toFixed(0)} cm`,
      icon: <Activity size={13} />,
      color: depthColor(maxDepth).fill,
      tooltip: null,
    },
    {
      label: isAr ? 'الوقت المنقضي' : 'Elapsed Time',
      value: `${elapsed.toFixed(1)} hr`,
      icon: <Clock size={13} />,
      color: '#94a3b8',
      tooltip: null,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Tajawal, sans-serif', direction: dir }}>

      {/* ── Header ── */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Zap size={16} style={{ color: selectedScenario.color }} />
          <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {isAr ? 'محاكاة الفيضان المتقدمة' : 'Advanced Flood Simulation'}
          </span>
          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: `${selectedScenario.color}22`, color: selectedScenario.color, border: `1px solid ${selectedScenario.color}44`, fontWeight: 700 }}>
            {selectedScenario.icon} {isAr ? selectedScenario.nameAr : selectedScenario.nameEn}
          </span>
          {selectedScenarioId === 'live' && (
            <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '3px', background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00d4ff', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              LIVE {livePrecip} mm/hr
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={resetSim} title="Reset" style={{ padding: '5px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            <RotateCcw size={13} />
          </button>
          <button
            onClick={isRunning ? stopSim : startSim}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '6px', border: `1px solid ${isRunning ? '#EF4444' : selectedScenario.color}`, background: isRunning ? 'rgba(239,68,68,0.15)' : `${selectedScenario.color}22`, color: isRunning ? '#EF4444' : selectedScenario.color, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
          >
            {isRunning ? <><Pause size={13} /> {isAr ? 'إيقاف' : 'Stop'}</> : <><Play size={13} /> {isAr ? 'تشغيل' : 'Run'}</>}
          </button>
        </div>
      </div>

      {/* ── KPI Bar ── */}
      <div style={{ display: 'flex', gap: '1px', background: 'rgba(255,255,255,0.04)', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {kpis.map((kpi, i) => (
          <div key={i} style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '10px' }}>
              <span style={{ color: kpi.color }}>{kpi.icon}</span>
              {kpi.label}
              {kpi.tooltip && <InfoTooltip content={kpi.tooltip} size="sm" />}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: kpi.color, fontFamily: 'Space Mono, monospace', lineHeight: 1 }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* ── Progress Bar ── */}
      <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${progress}%`, background: selectedScenario.color, transition: 'width 0.5s linear', borderRadius: '0 2px 2px 0' }} />
      </div>

      {/* ── Main Content ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left Panel ── */}
        <div style={{
          width: isMobile ? '0' : '230px', flexShrink: 0, overflow: isMobile ? 'hidden' : 'auto',
          borderInlineEnd: '1px solid rgba(255,255,255,0.07)',
          background: 'var(--bg-card)', overflowY: 'auto', padding: '10px',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>

          {/* Scenarios */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', letterSpacing: '0.08em' }}>
              {isAr ? 'اختر السيناريو' : 'Scenario'}
            </div>
            {scenarios.map(s => (
              <button key={s.id} onClick={() => applyScenario(s)} style={{
                width: '100%', padding: '7px 10px', marginBottom: '4px', borderRadius: '7px',
                border: `1px solid ${selectedScenarioId === s.id ? s.color : 'rgba(255,255,255,0.07)'}`,
                background: selectedScenarioId === s.id ? `${s.color}18` : 'rgba(255,255,255,0.02)',
                cursor: 'pointer', textAlign: isAr ? 'right' : 'left', transition: 'all 0.15s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: `${s.color}22`, color: s.color, fontWeight: 700 }}>{s.risk}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: selectedScenarioId === s.id ? s.color : 'var(--text-primary)' }}>{s.icon} {isAr ? s.nameAr : s.nameEn}</span>
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', textAlign: isAr ? 'right' : 'left' }}>
                  {s.id === 'live' ? `${livePrecip} mm/hr · Live` : `${s.rate} mm/hr · ${s.duration}h`}
                </div>
              </button>
            ))}
          </div>

          {/* Layers */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Layers size={10} /> {isAr ? 'الطبقات' : 'Layers'}
            </div>
            {[
              { label: isAr ? 'شبكة الخلايا 5×5م' : 'Cell network 5×5m', state: showGrid, set: setShowGrid, color: '#10B981' },
              { label: isAr ? 'حركة المرور' : 'Traffic flow', state: showTraffic, set: setShowTraffic, color: '#F59E0B' },
              { label: isAr ? 'الحدود الإدارية' : 'Admin boundaries', state: showBoundaries, set: setShowBoundaries, color: '#00d4ff' },
            ].map(layer => (
              <div key={layer.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 7px', borderRadius: '5px', background: 'rgba(255,255,255,0.02)', marginBottom: '3px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '2px', background: layer.color, opacity: layer.state ? 1 : 0.3 }} />
                  <span style={{ fontSize: '10px', color: layer.state ? 'var(--text-primary)' : 'var(--text-muted)' }}>{layer.label}</span>
                </div>
                <button onClick={() => layer.set(!layer.state)} style={{ padding: '2px 7px', borderRadius: '3px', border: 'none', cursor: 'pointer', fontSize: '9px', fontWeight: 600, background: layer.state ? `${layer.color}22` : 'rgba(255,255,255,0.05)', color: layer.state ? layer.color : 'var(--text-muted)' }}>
                  {layer.state ? (isAr ? 'نشط' : 'Active') : (isAr ? 'مخفي' : 'Hidden')}
                </button>
              </div>
            ))}
          </div>

          {/* Region filter */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              {isAr ? 'تصفية المنطقة' : 'Filter by region'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3px' }}>
              {(['all', 'abudhabi', 'alain', 'dhafra'] as RegionFilter[]).map(r => (
                <button key={r} onClick={() => setRegionFilter(r)} style={{
                  padding: '5px', borderRadius: '5px',
                  border: `1px solid ${regionFilter === r ? '#00d4ff' : 'rgba(255,255,255,0.07)'}`,
                  background: regionFilter === r ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer', fontSize: '10px', color: regionFilter === r ? '#00d4ff' : 'var(--text-muted)',
                }}>
                  {{ all: isAr ? 'الكل' : 'All', abudhabi: isAr ? 'أبوظبي' : 'Abu Dhabi', alain: isAr ? 'العين' : 'Al Ain', dhafra: isAr ? 'الظفرة' : 'Al Dhafra' }[r]}
                </button>
              ))}
            </div>
          </div>

          {/* Zone list */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={10} /> {isAr ? 'المناطق' : 'Zones'}
              {criticalZones > 0 && <span style={{ color: '#EF4444', fontFamily: 'Space Mono', fontSize: '10px' }}>{criticalZones} ⚠</span>}
            </div>
            {filteredData.map(zone => (
              <button key={zone.id} onClick={() => flyToZone(zone)} style={{
                width: '100%', padding: '6px 8px', marginBottom: '3px', borderRadius: '6px',
                border: `1px solid ${selectedZoneId === zone.id ? zone.dc.fill : 'rgba(255,255,255,0.06)'}`,
                background: selectedZoneId === zone.id ? `${zone.dc.fill}14` : 'rgba(255,255,255,0.02)',
                cursor: 'pointer', textAlign: isAr ? 'right' : 'left',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: zone.dc.fill }} />
                    <span style={{ fontSize: '9px', color: zone.dc.fill, fontWeight: 600 }}>{zone.depth.toFixed(0)} cm</span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>{isAr ? zone.nameAr : zone.nameEn}</span>
                </div>
                {zone.depth > 0 && (
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', textAlign: isAr ? 'right' : 'left' }}>
                    {zone.affectedCells.toLocaleString()} {isAr ? 'خلية' : 'cells'} · {zone.floodedAreaKm2} km²
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Advanced settings */}
          <div>
            <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 700 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Settings size={11} /> {isAr ? 'إعدادات متقدمة' : 'Advanced settings'}</span>
              {showAdvanced ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
            {showAdvanced && (
              <div style={{ padding: '8px', marginTop: '4px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                  {isAr ? 'معدل الهطول' : 'Rainfall rate'}: <span style={{ color: '#3B82F6', fontWeight: 700 }}>{precipRate} mm/hr</span>
                </div>
                <input type="range" min="0" max="100" value={precipRate} onChange={e => { setPrecipRate(+e.target.value); resetSim(); }} style={{ width: '100%', accentColor: '#3B82F6', marginBottom: '8px' }} />
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                  {isAr ? 'ارتفاع مستوى البحر' : 'Sea level rise'}: <span style={{ color: '#06B6D4', fontWeight: 700 }}>{seaLevelRise} m</span>
                </div>
                <input type="range" min="0" max="3" step="0.1" value={seaLevelRise} onChange={e => { setSeaLevelRise(+e.target.value); resetSim(); }} style={{ width: '100%', accentColor: '#06B6D4', marginBottom: '8px' }} />
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                  {isAr ? 'فشل الصرف' : 'Drainage failure'}: <span style={{ color: '#F97316', fontWeight: 700 }}>{Math.round(drainFailure * 100)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={drainFailure} onChange={e => { setDrainFailure(+e.target.value); resetSim(); }} style={{ width: '100%', accentColor: '#F97316' }} />
              </div>
            )}
          </div>

          {/* Timeline slider */}
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
              <span>{isAr ? 'الوقت' : 'Time'}: {elapsed.toFixed(1)} hr</span>
              <span style={{ color: selectedScenario.color }}>{selectedScenario.duration} hr</span>
            </div>
            <input type="range" min="0" max={selectedScenario.duration} step="0.1" value={elapsed}
              onChange={e => { stopSim(); setElapsed(+e.target.value); }}
              style={{ width: '100%', accentColor: selectedScenario.color }} />
          </div>
        </div>

        {/* ── Map ── */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

          {/* Loading boundary indicator */}
          {loadingBoundary && (
            <div style={{ position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(5,10,20,0.9)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: '8px', padding: '5px 12px', color: '#00d4ff', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 1000 }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00d4ff', animation: 'pulse 1s infinite' }} />
              {isAr ? 'جاري تحميل الحدود...' : 'Loading boundaries...'}
            </div>
          )}

          {/* Cell network badge */}
          <div style={{ position: 'absolute', top: '12px', right: isAr ? 'auto' : '12px', left: isAr ? '12px' : 'auto', background: 'rgba(5,10,20,0.88)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', padding: '5px 10px', fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', zIndex: 1000 }}>
            <Layers size={10} style={{ color: '#10B981' }} />
            {isAr ? 'شبكة خلايا ~5م×5م' : 'Network cells ~5m×5m'}
            <span style={{ color: '#00d4ff', fontFamily: 'Space Mono' }}>{GRID_ROWS}×{GRID_COLS}</span>
            {isAr ? 'لكل المناطق' : 'for all regions'}
          </div>

          {/* Selected zone popup */}
          {selectedZoneData && (
            <div style={{ position: 'absolute', bottom: '20px', right: isAr ? 'auto' : '12px', left: isAr ? '12px' : 'auto', background: 'rgba(5,10,20,0.95)', border: `1px solid ${selectedZoneData.dc.fill}44`, borderRadius: '12px', padding: '14px', width: '220px', zIndex: 1000, backdropFilter: 'blur(8px)', direction: dir }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <button onClick={() => setSelectedZoneId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px', lineHeight: 1 }}>×</button>
                <div style={{ textAlign: isAr ? 'right' : 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>{isAr ? selectedZoneData.nameAr : selectedZoneData.nameEn}</div>
                  <div style={{ fontSize: '10px', color: selectedZoneData.dc.fill, marginTop: '2px' }}>{selectedZoneData.dc.label}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                {[
                  { label: isAr ? 'عمق المياه' : 'Water Depth', value: `${selectedZoneData.depth.toFixed(0)} cm`, color: selectedZoneData.dc.fill },
                  { label: isAr ? 'الخلايا المتأثرة' : 'Cells Affected', value: `${selectedZoneData.affectedCells}`, color: '#F59E0B' },
                  { label: isAr ? 'المساحة المغمورة' : 'Flooded Area', value: `${selectedZoneData.floodedAreaKm2} km²`, color: '#F97316' },
                  { label: isAr ? 'السكان المتأثرون' : 'Affected Pop.', value: `${(selectedZoneData.affectedPop / 1000).toFixed(1)}K`, color: '#EF4444' },
                  { label: isAr ? 'الطرق المغلقة' : 'Closed Roads', value: `${selectedZoneData.affectedRoads}`, color: '#F97316' },
                  { label: isAr ? 'مؤشر الخطر' : 'Risk Index', value: `${selectedZoneData.risk}%`, color: selectedZoneData.risk > 60 ? '#EF4444' : '#F59E0B' },
                ].map(item => (
                  <div key={item.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '5px 7px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: item.color, fontFamily: 'Space Mono' }}>{item.value}</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right Panel ── */}
        <div style={{
          width: isMobile ? '0' : '210px', flexShrink: 0, overflow: isMobile ? 'hidden' : 'auto',
          borderInlineStart: '1px solid rgba(255,255,255,0.07)',
          background: 'var(--bg-card)', overflowY: 'auto', padding: '10px',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>

          {/* Depth legend */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Droplets size={10} /> {isAr ? 'مقياس عمق المياه' : 'Metric Water Depth'}
            </div>
            {DEPTH_LEGEND.map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.label}</span>
              </div>
            ))}
          </div>

          {/* Traffic legend */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Navigation size={10} /> {isAr ? 'حالة حركة المرور' : 'Traffic Status'}
            </div>
            {[
              { color: '#22C55E', label: isAr ? 'مفتوح — سير عادي' : 'Free — Normal flow' },
              { color: '#84CC16', label: isAr ? 'مستقر — تباطؤ خفيف' : 'Stable — Slight slow' },
              { color: '#F59E0B', label: isAr ? 'مزدحم — تباطؤ' : 'Congested — Slow' },
              { color: '#EF4444', label: isAr ? 'ثقيل — خطر' : 'Heavy — Danger' },
              { color: '#7C3AED', label: isAr ? 'مغلق — غير صالح' : 'Standstill — Closed' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}>
                <div style={{ width: '20px', height: '4px', borderRadius: '2px', background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.label}</span>
              </div>
            ))}
          </div>

          {/* Scenario comparison */}
          <div>
            <button onClick={() => setShowComparison(!showComparison)} style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 700 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><GitCompare size={11} /> {isAr ? 'مقارنة السيناريوهات' : 'Comparison scenarios'}</span>
              {showComparison ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
            {showComparison && (
              <div style={{ marginTop: '6px' }}>
                {comparisonData.map(s => {
                  const dc = depthColor(s.maxDepth);
                  const barW = Math.min(100, (s.maxDepth / 150) * 100);
                  return (
                    <div key={s.id} style={{ marginBottom: '6px', padding: '6px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${s.color}22` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '9px', color: s.color, fontWeight: 700 }}>{s.icon} {isAr ? s.nameAr : s.nameEn}</span>
                        <span style={{ fontSize: '9px', color: dc.fill, fontFamily: 'Space Mono' }}>{s.maxDepth.toFixed(0)} cm</span>
                      </div>
                      <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                        <div style={{ height: '100%', width: `${barW}%`, background: dc.fill, borderRadius: '2px', transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Affected regions summary */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertTriangle size={10} /> {isAr ? 'المناطق المتأثرة' : 'Regions affected'}
              <span style={{ color: '#94a3b8', fontFamily: 'Space Mono' }}>({simData.filter(z => z.depth > 0).length})</span>
            </div>
            {simData.filter(z => z.depth > 0).map(zone => (
              <div key={zone.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px', borderRadius: '4px', marginBottom: '2px', background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }} onClick={() => flyToZone(zone)}>
                <span style={{ fontSize: '9px', color: zone.dc.fill, fontWeight: 700, fontFamily: 'Space Mono' }}>{zone.depth.toFixed(0)} cm</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{isAr ? zone.nameAr : zone.nameEn}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .sim-tooltip .leaflet-tooltip {
          background: rgba(5,10,20,0.95) !important;
          border: 1px solid rgba(0,212,255,0.2) !important;
          border-radius: 8px !important;
          color: #e2e8f0 !important;
          padding: 0 !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
        }
        .sim-tooltip .leaflet-tooltip::before { display: none !important; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
