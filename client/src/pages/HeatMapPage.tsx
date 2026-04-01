/**
 * HeatMapPage — Unified Map with Water Accumulation Layer (FastFlood style) and time strip
 * Full OSM road network: 410,348 roads loaded dynamically by zoom level
 * Flood depth layer: blue gradient per depth (0.1m → 5m+) like FastFlood
 * Timeline: 24h past + now + 48h forecast from Open-Meteo real data
 * Design: Techno-Geospatial Command Center
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  FLOOD_ZONES, DRAINAGE_POINTS, DATA_ACCURACY,
  getZonesForZoom, type FloodZoneMulti,
  type FloodZone,
} from '@/services/floodMapData';
import { createFloodWaterLayer, type FloodWaterLayerInstance } from '@/components/FloodWaterLayer';
import { useRealWeather } from '@/hooks/useRealWeather';
import TimelineScrubber, { buildTimelineHours, type TimelineHour } from '@/components/TimelineScrubber';
import MetricTooltip from '@/components/MetricTooltip';
import {
  Layers, Droplets, Car, AlertTriangle, RefreshCw,
  Eye, EyeOff, Info, Wifi, Database, CheckCircle2, FileDown,
  ZoomIn,
} from 'lucide-react';

// CDN URLs — Flood-risk colored road tiles (March 2026)
const ROAD_CDN = {
  tier1: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663384867006/UpUV4ACjBMFtNVM49QL7JW/tier1_major_401c5c98.json',
  tier2: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663384867006/UpUV4ACjBMFtNVM49QL7JW/tier2_primary_b0816b15.json',
  tier3: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663384867006/UpUV4ACjBMFtNVM49QL7JW/tier3_local_c8abfbef.json',
  tier4: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663384867006/UpUV4ACjBMFtNVM49QL7JW/tier4_residential_6e562d9f.json',
};

// FastFlood-style depth color scale
const DEPTH_COLORS = [
  { depth: 0,    color: 'rgba(173,216,230,0)',    label: '0 m' },
  { depth: 0.1,  color: 'rgba(100,180,255,0.35)', label: '0.1 m' },
  { depth: 0.25, color: 'rgba(50,130,255,0.50)',  label: '0.25 m' },
  { depth: 0.5,  color: 'rgba(20,90,220,0.62)',   label: '0.5 m' },
  { depth: 1.0,  color: 'rgba(10,50,180,0.72)',   label: '1 m' },
  { depth: 2.0,  color: 'rgba(5,20,140,0.82)',    label: '2 m' },
  { depth: 5.0,  color: 'rgba(2,5,100,0.90)',     label: '5 m+' },
];

function depthToColor(depthM: number): string {
  if (depthM <= 0) return 'rgba(100,180,255,0)';
  if (depthM < 0.1) return 'rgba(173,216,230,0.25)';
  if (depthM < 0.25) return 'rgba(100,180,255,0.40)';
  if (depthM < 0.5)  return 'rgba(50,130,255,0.55)';
  if (depthM < 1.0)  return 'rgba(20,90,220,0.65)';
  if (depthM < 2.0)  return 'rgba(10,50,180,0.75)';
  if (depthM < 5.0)  return 'rgba(5,20,140,0.85)';
  return 'rgba(2,5,100,0.92)';
}

interface LayerState {
  floodDepth: boolean;
  floodZones: boolean;
  roads: boolean;
  drainage: boolean;
}

interface RoadTile {
  i: number; n: string; h: string; r: string;
  c: [number, number][]; s: string; d: number;
  cl: string; w: number; o: number; z: number;
}

const RISK_COLORS: Record<string, string> = {
  low: '#10B981', medium: '#F59E0B', high: '#EF4444', critical: '#7C3AED',
};
const FLOOD_STATUS_COLORS: Record<string, string> = {
  clear: '#10B981', slow: '#F59E0B', flooded: '#EF4444', blocked: '#7C3AED',
};
const FLOOD_STATUS_LABELS: Record<string, string> = {
  clear: 'Clear', slow: 'Slow', flooded: 'Flooded', blocked: 'Closed',
};
const HIGHWAY_LABELS: Record<string, string> = {
  motorway: 'Highway', motorway_link: 'Highway link', trunk: 'Trunk road',
  trunk_link: 'Trunk link', primary: 'Primary street', primary_link: 'Primary link',
  secondary: 'Secondary street', secondary_link: 'Secondary link', tertiary: 'Local street',
  tertiary_link: 'Local link', residential: 'Residential street', unclassified: 'Unclassified road',
  living_street: 'Quiet street', service: 'Service road',
};

export default function HeatMapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const layerGroupsRef = useRef<Record<string, any>>({});
  const roadLayersRef = useRef<Record<string, any>>({ tier1: null, tier2: null, tier3: null, tier4: null });
  const loadedTiersRef = useRef<Set<string>>(new Set());
  const floodWaterLayerRef = useRef<FloodWaterLayerInstance | null>(null);

  const [layers, setLayers] = useState<LayerState>({
    floodDepth: true, floodZones: true, roads: true, drainage: true,
  });
  const [selectedZone, setSelectedZone] = useState<FloodZone | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [precipMultiplier, setPrecipMultiplier] = useState(1.0);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [loadedRoads, setLoadedRoads] = useState(0);
  const [currentZoom, setCurrentZoom] = useState(11);
  const [roadStats, setRoadStats] = useState({ total: 0, flooded: 0, blocked: 0, slow: 0 });
  const [timelineIndex, setTimelineIndex] = useState<number>(-1);
  const [showTimeline, setShowTimeline] = useState(true);

  const { data: weatherData, isLive, loading: weatherLoading } = useRealWeather();

  // ── Build timeline hours from Open-Meteo real data ──
  const timelineHours = useMemo<TimelineHour[]>(() => {
    if (!weatherData) return [];
    const ref = weatherData.regions.find((r: any) => r.id === 'abudhabi-city') || weatherData.regions[0];
    if (!ref) return [];
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', hour12: false,
    });
    const parts = dtf.formatToParts(new Date());
    const y  = parts.find(p => p.type === 'year')?.value ?? '';
    const mo = parts.find(p => p.type === 'month')?.value ?? '';
    const d  = parts.find(p => p.type === 'day')?.value ?? '';
    const hr = parts.find(p => p.type === 'hour')?.value?.padStart(2, '0') ?? '00';
    const nowStr = `${y}-${mo}-${d}T${hr}:00`;
    const nowIdx = ref.hourlyTimes.findIndex((t: string) => t === nowStr);
    const ni = nowIdx >= 0 ? nowIdx : 24;
    const startIdx = Math.max(0, ni - 24);
    const endIdx   = Math.min(ref.hourlyTimes.length, ni + 49);
    const relNow   = ni - startIdx;
    return buildTimelineHours(
      ref.hourlyTimes.slice(startIdx, endIdx),
      ref.hourlyPrecipitation.slice(startIdx, endIdx),
      ref.hourlyProbability.slice(startIdx, endIdx),
      relNow,
    );
  }, [weatherData]);

  // Set initial index to NOW
  useEffect(() => {
    if (timelineHours.length > 0 && timelineIndex === -1) {
      const ni = timelineHours.findIndex(h => h.isNow);
      setTimelineIndex(ni >= 0 ? ni : Math.floor(timelineHours.length / 3));
    }
  }, [timelineHours, timelineIndex]);

  // Compute precipMultiplier from selected hour
  useEffect(() => {
    if (timelineHours.length === 0 || timelineIndex < 0) {
      if (weatherData) {
        const maxP = Math.max(...weatherData.regions.map((r: any) => r.currentPrecipitation));
        setPrecipMultiplier(Math.max(0.5, Math.min(2.0, 1 + maxP * 0.3)));
      }
      return;
    }
    const h = timelineHours[timelineIndex];
    if (!h) return;
    setPrecipMultiplier(Math.max(0.3, Math.min(2.5, 0.5 + h.precipitation * 0.4)));
  }, [timelineIndex, timelineHours, weatherData]);

  // ── Load road tier ──
  const loadRoadTier = useCallback(async (tierKey: string, tierUrl: string, map: any, L: any) => {
    if (loadedTiersRef.current.has(tierKey)) return;
    loadedTiersRef.current.add(tierKey);
    setLoadingTier(tierKey);
    try {
      const resp = await fetch(tierUrl);
      const roads: RoadTile[] = await resp.json();
      const group = L.layerGroup();
      let flooded = 0, blocked = 0, slow = 0;
      roads.forEach(road => {
        if (!road.c || road.c.length < 2) return;
        const color = road.cl;
        const weight = road.s === 'blocked' ? Math.max(road.w, 3) : road.s === 'flooded' ? Math.max(road.w, 2.5) : road.w;
        const dashArray = road.s === 'blocked' ? '6,4' : road.s === 'flooded' ? '3,2' : undefined;
        const polyline = L.polyline(road.c, { color, weight, opacity: road.o, dashArray, interactive: road.w >= 2 });
        if (road.w >= 2) {
          const name = road.n || road.r || HIGHWAY_LABELS[road.h] || road.h;
          polyline.bindTooltip(
            `<div style="font-family:'Tajawal',sans-serif;direction:rtl;font-size:12px;padding:2px 4px">
              <strong style="color:${color}">${name}</strong>
              ${road.h ? `<br/><span style="color:#94a3b8;font-size:10px">${HIGHWAY_LABELS[road.h] || road.h}</span>` : ''}
              ${road.s !== 'clear' ? `<br/><span style="color:${FLOOD_STATUS_COLORS[road.s]}">${FLOOD_STATUS_LABELS[road.s]}${road.d > 0 ? ` — ${road.d} cm` : ''}</span>` : ''}
            </div>`,
            { sticky: true, className: 'road-tooltip-osm' }
          );
        }
        polyline.addTo(group);
        if (road.s === 'flooded') flooded++;
        if (road.s === 'blocked') blocked++;
        if (road.s === 'slow') slow++;
      });
      roadLayersRef.current[tierKey] = group;
      group.addTo(map);
      setLoadedRoads(prev => prev + roads.length);
      setRoadStats(prev => ({
        total: prev.total + roads.length,
        flooded: prev.flooded + flooded,
        blocked: prev.blocked + blocked,
        slow: prev.slow + slow,
      }));
    } catch (err) {
      console.error(`Failed to load road tier ${tierKey}:`, err);
      loadedTiersRef.current.delete(tierKey);
    } finally {
      setLoadingTier(null);
    }
  }, []);

  const updateRoadTiers = useCallback((zoom: number, map: any, L: any) => {
    if (zoom >= 9)  loadRoadTier('tier1', ROAD_CDN.tier1, map, L);
    if (zoom >= 11) loadRoadTier('tier2', ROAD_CDN.tier2, map, L);
    if (zoom >= 13) loadRoadTier('tier3', ROAD_CDN.tier3, map, L);
    if (zoom >= 14) loadRoadTier('tier4', ROAD_CDN.tier4, map, L);
  }, [loadRoadTier]);

  // ── Init Leaflet map ──
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;
    const initMap = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      const map = L.map(mapRef.current!, {
        center: [24.4539, 54.3773], zoom: 11,
        zoomControl: false, attributionControl: false, preferCanvas: true,
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.control.attribution({ position: 'bottomleft', prefix: false })
        .addAttribution('© Leaflet | OpenStreetMap | Open-Meteo | Copernicus CEMS')
        .addTo(map);
      leafletMapRef.current = map;
      layerGroupsRef.current = {
        floodDepth: L.layerGroup().addTo(map),
        floodZones: L.layerGroup().addTo(map),
        drainage:   L.layerGroup().addTo(map),
      };
      updateRoadTiers(11, map, L);
      map.on('zoomend', () => {
        const z = map.getZoom();
        setCurrentZoom(z);
        updateRoadTiers(z, map, L);
        // Re-render flood depth layer with correct zoom-level zones
        // Trigger via state update (renderFloodDepth depends on currentZoom via leafletMapRef)
        setCurrentZoom(prev => { void prev; return z; });
      });
      setMapReady(true);
    };
    initMap();
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        loadedTiersRef.current.clear();
      }
    };
  }, [updateRoadTiers]);

  // ── Toggle road layers ──
  useEffect(() => {
    if (!mapReady || !leafletMapRef.current) return;
    const map = leafletMapRef.current;
    Object.values(roadLayersRef.current).forEach(group => {
      if (!group) return;
      if (layers.roads) { if (!map.hasLayer(group)) group.addTo(map); }
      else { if (map.hasLayer(group)) map.removeLayer(group); }
    });
  }, [layers.roads, mapReady]);

  // ── FastFlood-style continuous SVG flood overlay (4-level zoom-adaptive) ──
  useEffect(() => {
    if (!mapReady || !leafletMapRef.current) return;
    const map = leafletMapRef.current;
    if (floodWaterLayerRef.current) { floodWaterLayerRef.current.remove(); floodWaterLayerRef.current = null; }
    if (!layers.floodDepth) return;
    const timer = setTimeout(() => {
      floodWaterLayerRef.current = createFloodWaterLayer(map, [], precipMultiplier);
    }, 150);
    return () => clearTimeout(timer);
  }, [mapReady, layers.floodDepth]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    floodWaterLayerRef.current?.update(precipMultiplier);
  }, [precipMultiplier]);

  useEffect(() => { return () => { floodWaterLayerRef.current?.remove(); }; }, []);

  // Keep legacy renderFloodDepth for interactive popups only (transparent circles)
  const renderFloodDepth = useCallback(async () => {
    if (!mapReady || !leafletMapRef.current) return;
    const L = (await import('leaflet')).default;
    const group = layerGroupsRef.current.floodDepth;
    group.clearLayers();
    if (!layers.floodDepth) return;
    const zoom = leafletMapRef.current.getZoom();
    const zones: FloodZoneMulti[] = getZonesForZoom(zoom);
    zones.forEach((zone: FloodZoneMulti) => {
      const scaledDepthCm = zone.waterDepth * precipMultiplier;
      const depthM = scaledDepthCm / 100;
      const levelLabel = zone.level === 1 ? 'City' : zone.level === 2 ? 'Live' : 'Street';
      const circle = L.circle([zone.lat, zone.lng], {
        radius: zone.radius * 0.4, color: 'transparent', fillColor: 'transparent', fillOpacity: 0, weight: 0, interactive: true,
      });
      circle.bindPopup(L.popup({ maxWidth: 300 }).setContent(`
        <div style="font-family:'Tajawal',sans-serif;direction:rtl;padding:8px;min-width:240px">
          <div style="font-size:14px;font-weight:700;color:${RISK_COLORS[zone.riskLevel]};margin-bottom:2px">${zone.nameAr}</div>
          <div style="font-size:10px;color:#64748b;margin-bottom:10px">${zone.nameEn} · ${levelLabel} · ${zone.region}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;margin-bottom:8px">
            <div style="background:rgba(0,80,200,0.15);border:1px solid rgba(0,120,255,0.3);padding:8px;border-radius:6px">
              <div style="color:#64748b;font-size:10px">Water Depth</div>
              <div style="color:#42A5F5;font-weight:700;font-size:18px">${scaledDepthCm.toFixed(0)} <span style="font-size:11px">cm</span></div>
              <div style="color:#546E7A;font-size:9px">${depthM.toFixed(2)} m</div>
            </div>
            <div style="background:rgba(255,255,255,0.05);padding:8px;border-radius:6px">
              <div style="color:#64748b;font-size:10px">Area</div>
              <div style="color:#00d4ff;font-weight:700;font-size:15px">${(zone.area / 1e6).toFixed(2)} km²</div>
            </div>
            <div style="background:rgba(255,255,255,0.05);padding:8px;border-radius:6px">
              <div style="color:#64748b;font-size:10px">Risk Level</div>
              <div style="color:${RISK_COLORS[zone.riskLevel]};font-weight:700">${{ low: 'Low', medium: 'Average', high: 'High', critical: 'Critical' }[zone.riskLevel]}</div>
            </div>
            <div style="background:rgba(255,255,255,0.05);padding:8px;border-radius:6px">
              <div style="color:#64748b;font-size:10px">Accuracy Data</div>
              <div style="color:#10b981;font-weight:700">${zone.accuracyPct}%</div>
            </div>
          </div>
          <div style="font-size:10px;color:#64748b;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px">
            <div>Source: ${zone.source}</div>
            <div>Accuracy: ${zone.accuracyPct}%</div>
          </div>
        </div>
      `));
      circle.on('click', () => setSelectedZone(zone as unknown as FloodZone));
      circle.addTo(group);
    });
  }, [mapReady, layers.floodDepth, precipMultiplier, currentZoom]);

  // ── Render drainage ──
  const renderDrainage = useCallback(async () => {
    if (!mapReady || !leafletMapRef.current) return;
    const L = (await import('leaflet')).default;
    const group = layerGroupsRef.current.drainage;
    group.clearLayers();
    if (!layers.drainage) return;
    DRAINAGE_POINTS.forEach(pt => {
      const overloaded = pt.currentLoad > 80;
      const color = overloaded ? '#EF4444' : pt.currentLoad > 60 ? '#F59E0B' : '#10B981';
      const icon = L.divIcon({
        html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:2px solid ${color}88;box-shadow:0 0 6px ${color}66"></div>`,
        className: '', iconSize: [10, 10], iconAnchor: [5, 5],
      });
      L.marker([pt.lat, pt.lng], { icon })
        .bindTooltip(`<div style="font-family:'Tajawal',sans-serif;direction:rtl;font-size:11px">
          <strong style="color:${color}">${{ drain: 'drainage inlet', canal: 'drainage canal', wadi: 'Wadi' }[pt.type]}</strong><br/>
          Load: <strong style="color:${color}">${pt.currentLoad}%</strong><br/>
          Energy: ${pt.capacity.toLocaleString()} m³/hr
        </div>`, { direction: 'top', className: 'road-tooltip-osm' })
        .addTo(group);
    });
  }, [mapReady, layers.drainage]);

  useEffect(() => { renderFloodDepth(); }, [renderFloodDepth]);
  useEffect(() => { renderDrainage(); }, [renderDrainage]);

  // ── Derived stats ──
  const totalWaterVolume = FLOOD_ZONES.reduce((s, z) => s + z.area * z.waterDepth * precipMultiplier / 100, 0);
  const criticalZones = FLOOD_ZONES.filter(z => z.riskLevel === 'critical').length;
  const avgAccuracy = Math.round(FLOOD_ZONES.reduce((s, z) => s + ((z as any).accuracyPct || 90), 0) / FLOOD_ZONES.length);
  const safeIdx = timelineIndex >= 0 ? timelineIndex : 0;
  const selectedHour = timelineHours[safeIdx];

  const timelineBadge = !selectedHour ? null
    : selectedHour.isNow
      ? { label: 'LIVE — Now', bg: 'rgba(20,80,20,0.92)', color: '#4ADE80' }
      : selectedHour.isPast
        ? { label: `HISTORICAL · ${selectedHour.dateLabel} ${selectedHour.label}`, bg: 'rgba(15,35,70,0.92)', color: '#60A5FA' }
        : { label: `FORECAST · ${selectedHour.dateLabel} ${selectedHour.label}`, bg: 'rgba(60,40,0,0.92)', color: '#FCD34D' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', overflow: 'hidden', background: 'var(--bg-primary)' }}>

      {/* ── Main content row ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Sidebar ── */}
        <div style={{
          width: '260px', flexShrink: 0, overflowY: 'auto',
          background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-primary)',
          padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          {/* Title */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
              <h2 style={{ fontFamily: 'Tajawal', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Map unified
              </h2>
              <button
                onClick={() => window.print()}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.30)', borderRadius: '6px', cursor: 'pointer', color: '#A78BFA', fontSize: '10px', fontWeight: 600 }}
              >
                <FileDown size={10} /> PDF
              </button>
            </div>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {loadedRoads.toLocaleString()} Road | zoom {currentZoom}
            </p>
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {[
              { label: 'Critical Regions', value: criticalZones, color: '#7C3AED', icon: AlertTriangle, tid: 'flood-risk-index' },
              { label: 'Size Water', value: `${(totalWaterVolume / 1e6).toFixed(1)}m³`, color: '#42A5F5', icon: Droplets, tid: 'water-volume' },
              { label: 'Roads Affected', value: roadStats.flooded + roadStats.blocked, color: '#EF4444', icon: Car, tid: 'affected-roads-count' },
              { label: 'Accuracy Data', value: `${avgAccuracy}%`, color: '#10B981', icon: CheckCircle2, tid: 'data-accuracy' },
            ].map(({ label, value, color, icon: Icon, tid }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                  <Icon size={10} style={{ color }} />
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', flex: 1 }}>{label}</span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {value}
                  <MetricTooltip id={tid} size={10} position="right" />
                </div>
              </div>
            ))}
          </div>

          {/* Layer toggles */}
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Layers size={10} /> Layers Map
            </div>
            {[
              { key: 'floodDepth' as const, label: 'Water accumulation (Depth)', color: '#42A5F5' },
              { key: 'floodZones' as const, label: 'Danger zones', color: '#EF4444' },
              { key: 'roads' as const, label: `Network Roads (${loadedRoads.toLocaleString()})`, color: '#10B981' },
              { key: 'drainage' as const, label: 'Drainage Network', color: '#F59E0B' },
            ].map(({ key, label, color }) => (
              <button key={key}
                onClick={() => setLayers(prev => ({ ...prev, [key]: !prev[key] }))}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 8px', borderRadius: '6px', marginBottom: '4px', cursor: 'pointer',
                  background: layers[key] ? `${color}18` : 'transparent',
                  border: `1px solid ${layers[key] ? color + '44' : 'transparent'}`,
                }}>
                <span style={{ fontSize: '11px', color: layers[key] ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</span>
                {layers[key] ? <Eye size={12} style={{ color }} /> : <EyeOff size={12} style={{ color: 'var(--text-muted)' }} />}
              </button>
            ))}
          </div>

          {/* Road tier status */}
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Database size={10} /> Layers Roads (OSM)
            </div>
            {[
              { key: 'tier1', label: 'Highways + Main roads', zoom: 9, count: '14,239' },
              { key: 'tier2', label: 'Main + secondary streets', zoom: 11, count: '25,472' },
              { key: 'tier3', label: 'Local streets', zoom: 13, count: '26,034' },
              { key: 'tier4', label: 'Residential streets + services', zoom: 14, count: '344,603' },
            ].map(({ key, label, zoom, count }) => {
              const loaded = loadedTiersRef.current.has(key);
              const loading = loadingTier === key;
              return (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '5px 6px', borderRadius: '5px', marginBottom: '3px',
                  background: loaded ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                }}>
                  <div>
                    <div style={{ fontSize: '10px', color: loaded ? '#10B981' : 'var(--text-muted)' }}>{label}</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{count} | zoom &ge; {zoom}</div>
                  </div>
                  {loading
                    ? <RefreshCw size={10} style={{ color: '#F59E0B', animation: 'spin 1s linear infinite' }} />
                    : loaded
                      ? <CheckCircle2 size={10} style={{ color: '#10B981' }} />
                      : <ZoomIn size={10} style={{ color: 'var(--text-muted)' }} />}
                </div>
              );
            })}
          </div>

          {/* Flood zones list */}
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Droplets size={10} style={{ color: '#42A5F5' }} />
              Flood accumulation zones ({FLOOD_ZONES.length})
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[...FLOOD_ZONES].sort((a, b) => b.waterDepth - a.waterDepth).map(zone => {
                const scaledDepth = Math.round(zone.waterDepth * precipMultiplier);
                return (
                  <button key={zone.id}
                    onClick={() => {
                      setSelectedZone(zone);
                      if (leafletMapRef.current) leafletMapRef.current.setView([zone.lat, zone.lng], 13);
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', textAlign: 'right',
                      background: selectedZone?.id === zone.id ? 'rgba(66,165,245,0.15)' : 'transparent',
                      border: `1px solid ${selectedZone?.id === zone.id ? 'rgba(66,165,245,0.5)' : 'transparent'}`,
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{
                        width: '10px', height: '10px', borderRadius: '50%',
                        background: depthToColor(scaledDepth / 100),
                        border: '1px solid rgba(66,165,245,0.5)',
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{zone.nameAr.split('—')[0].trim()}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#42A5F5', fontFamily: 'monospace' }}>
                        {scaledDepth} cm
                      </span>
                      <span style={{ fontSize: '9px', color: '#10B981' }}>{(zone as any).accuracyPct || 90}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Data sources */}
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Info size={10} style={{ color: '#00d4ff' }} /> Sources Data
            </div>
            {[
              { label: 'Network Roads', src: 'OSM Overpass API', acc: DATA_ACCURACY.roadNetwork.accuracy, color: '#10B981' },
              { label: 'Flood accumulation zones', src: 'Copernicus CEMS', acc: DATA_ACCURACY.floodZones.accuracy, color: '#42A5F5' },
              { label: 'Data Weather', src: 'Open-Meteo ERA5', acc: DATA_ACCURACY.weatherData.accuracy, color: '#F59E0B' },
              { label: 'Model Elevation', src: 'Copernicus GLO-30', acc: DATA_ACCURACY.elevation.accuracy, color: '#8b5cf6' },
            ].map(({ label, src, acc, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-primary)' }}>{label}</div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{src}</div>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color, fontFamily: 'monospace' }}>{acc}%</div>
              </div>
            ))}
          </div>

          {/* Live status */}
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Wifi size={10} style={{ color: isLive ? '#10B981' : '#EF4444' }} />
            <span style={{ fontSize: '10px', color: isLive ? '#10B981' : '#EF4444' }}>
              {isLive ? 'Live data — Open-Meteo' : 'awaiting data...'}
            </span>
          </div>
        </div>

        {/* ── Map ── */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>

          {/* Timeline badge overlay */}
          {timelineBadge && (
            <div style={{
              position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
              background: timelineBadge.bg, border: `1px solid ${timelineBadge.color}55`,
              borderRadius: '4px', padding: '5px 16px', zIndex: 1001,
              fontSize: '11px', fontFamily: 'Space Mono, monospace', fontWeight: 700,
              color: timelineBadge.color, letterSpacing: '0.05em',
              display: 'flex', alignItems: 'center', gap: '7px',
              boxShadow: '0 2px 16px rgba(0,0,0,0.6)',
            }}>
              {selectedHour?.isNow && (
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4ADE80', display: 'inline-block', animation: 'flood-pulse 1.5s infinite' }} />
              )}
              {timelineBadge.label}
              {selectedHour && selectedHour.precipitation > 0 && (
                <span style={{ opacity: 0.75, fontSize: '10px' }}>· {selectedHour.precipitation} mm</span>
              )}
            </div>
          )}

          {/* Map container */}
          <div ref={mapRef} style={{ width: '100%', flex: 1 }} />

          {/* Loading overlay */}
          {loadingTier && (
            <div style={{
              position: 'absolute', top: '50px', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(13,17,23,0.92)', border: '1px solid rgba(66,165,245,0.3)',
              borderRadius: '8px', padding: '8px 16px', zIndex: 1000,
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <RefreshCw size={12} style={{ color: '#42A5F5', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '12px', color: '#42A5F5', fontFamily: 'Tajawal' }}>Loading roads layer...</span>
            </div>
          )}

          {/* Zoom hint */}
          {currentZoom < 13 && (
            <div style={{
              position: 'absolute', bottom: '14px', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(13,17,23,0.85)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px', padding: '6px 12px', zIndex: 999,
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <ZoomIn size={11} style={{ color: '#F59E0B' }} />
              <span style={{ fontSize: '11px', color: '#F59E0B', fontFamily: 'Tajawal' }}>zoom in to view residential streets</span>
            </div>
          )}

          {/* Flood depth legend (FastFlood style) */}
          <div style={{
            position: 'absolute', bottom: '14px', right: '12px',
            background: 'rgba(10,18,30,0.94)', border: '1px solid rgba(66,165,245,0.25)',
            borderRadius: '8px', padding: '10px 12px', zIndex: 999, minWidth: '140px',
          }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#42A5F5', marginBottom: '6px', letterSpacing: '0.05em' }}>
              Depth Water accumulation
            </div>
            {/* Gradient bar */}
            <div style={{
              height: '10px', borderRadius: '4px', marginBottom: '4px',
              background: 'linear-gradient(to right, rgba(173,216,230,0.4), rgba(100,180,255,0.6), rgba(20,90,220,0.8), rgba(2,5,100,0.95))',
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '9px', color: '#93C5FD' }}>0.1m</span>
              <span style={{ fontSize: '9px', color: '#60A5FA' }}>0.5m</span>
              <span style={{ fontSize: '9px', color: '#3B82F6' }}>1m</span>
              <span style={{ fontSize: '9px', color: '#1D4ED8' }}>5m+</span>
            </div>
            {DEPTH_COLORS.slice(1).map(({ depth, color, label }) => (
              <div key={depth} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <div style={{ width: '18px', height: '10px', borderRadius: '2px', background: color, border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</span>
              </div>
            ))}
            {/* Live multiplier index */}
            <div style={{ marginTop: '8px', padding: '5px 7px', background: 'rgba(0,80,200,0.15)', borderRadius: '5px', border: '1px solid rgba(0,120,255,0.2)' }}>
              <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '2px' }}>current depth multiplier</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{
                  width: `${Math.min(100, precipMultiplier / 2.5 * 100)}%`,
                  height: '5px', borderRadius: '3px',
                  background: precipMultiplier > 1.5 ? '#EF4444' : precipMultiplier > 1.0 ? '#F59E0B' : '#3B82F6',
                  transition: 'width 0.8s ease, background 0.8s ease',
                  minWidth: '4px',
                }} />
                <span style={{ fontSize: '10px', fontWeight: 700, color: precipMultiplier > 1.5 ? '#EF4444' : precipMultiplier > 1.0 ? '#F59E0B' : '#42A5F5' }}>
                  ×{precipMultiplier.toFixed(2)}
                </span>
              </div>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.25)', marginTop: '3px' }}>
                {precipMultiplier > 1.5 ? '⚠️ Heavy Rain' : precipMultiplier > 1.0 ? '⚡ Moderate Rain' : '✓ Dry or Light'}
              </div>
            </div>
            <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: '9px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Open-Meteo · Update every 2 minutes
            </div>
          </div>
        </div>
      </div>

      {/* ── Timeline Scrubber ── */}
      {showTimeline && (
        <div style={{ flexShrink: 0 }}>
          {timelineHours.length > 0 ? (
            <TimelineScrubber
              hours={timelineHours}
              currentIndex={safeIdx}
              onIndexChange={setTimelineIndex}
              isLive={isLive}
              loading={weatherLoading}
            />
          ) : (
            <div style={{
              background: 'rgba(10,18,30,0.97)', borderTop: '1px solid rgba(66,165,245,0.18)',
              padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}>
              <RefreshCw size={12} style={{ color: '#42A5F5', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '11px', color: '#546E7A', fontFamily: 'Tajawal' }}>
                {weatherLoading ? 'Loading real-time data from Open-Meteo...' : 'Awaiting weather data...'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Toggle timeline button */}
      <button
        onClick={() => setShowTimeline(p => !p)}
        style={{
          position: 'fixed', bottom: showTimeline ? '130px' : '8px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10,18,30,0.9)', border: '1px solid rgba(66,165,245,0.3)',
          borderRadius: '12px', padding: '3px 12px', zIndex: 1002,
          fontSize: '9px', color: '#42A5F5', fontFamily: 'monospace', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '4px',
          transition: 'bottom 0.3s ease',
        }}
      >
        {showTimeline ? '▼ Hide panel time' : '▲ show panel time'}
      </button>

      <style>{`
        .road-tooltip-osm {
          background: rgba(13,17,23,0.95) !important;
          border: 1px solid rgba(66,165,245,0.25) !important;
          border-radius: 6px !important;
          color: #e2e8f0 !important;
          font-size: 11px !important;
          padding: 4px 8px !important;
        }
        .leaflet-popup-content-wrapper {
          background: #0a1220 !important;
          border: 1px solid rgba(66,165,245,0.3) !important;
          border-radius: 10px !important;
          color: #e2e8f0 !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
        }
        .leaflet-popup-tip { background: #0a1220 !important; }
        @keyframes flood-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(0,100,255,0.4), 0 0 0 8px rgba(0,100,255,0.2); }
          50% { box-shadow: 0 0 0 8px rgba(0,100,255,0.2), 0 0 0 16px rgba(0,100,255,0.1); }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
