// Comprehensive Road Network Page — Full Abu Dhabi Emirate Coverage
// Sources: OSM Overpass (statistics) + Open-Meteo (real rain) + SRTM (elevation)
// Model: BPR Hybrid — calculates congestion from rain + elevation + road type

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import FullscreenButton from '@/components/FullscreenButton';
import MetricTooltip from '@/components/MetricTooltip';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ABU_DHABI_ROADS, REGIONS, type OSMRoad } from '@/services/osmRoads';
import { FileDown } from 'lucide-react';
import { getZonesForZoom, type FloodZoneMulti } from '@/services/floodMapData';
import { createFloodWaterLayer, type FloodWaterLayerInstance } from '@/components/FloodWaterLayer';
import TimelineScrubber, { buildTimelineHours, type TimelineHour } from '@/components/TimelineScrubber';

// ---- BPR Hybrid Model ----
interface WeatherNow {
  precip: number;      // mm/hour
  precipProb: number;  // %
  windSpeed: number;   // km/hour
  temp: number;
  fetchedAt: string;
}

interface RoadStatus {
  road: OSMRoad;
  floodDepthCm: number;
  speedReduction: number; // %
  congestionIndex: number; // 0-1
  status: 'Clear' | 'slow' | 'Congested' | 'Closed';
  statusEn: 'free' | 'slow' | 'congested' | 'closed';
  usageProb: number; // % usage probability
  altRoute: string;
  confidence: number; // % confidence level
}

const STATUS_COLOR: Record<string, string> = {
  Clear: '#22c55e',
  slow: '#eab308',
  Congested: '#f97316',
  Closed: '#ef4444',
};

function calcRoadStatus(road: OSMRoad, weather: WeatherNow): RoadStatus {
  const p = weather.precip;
  const w = weather.windSpeed;

  // road type coefficient
  const hwFactor: Record<string, number> = {
    motorway: 0.4, trunk: 0.6, primary: 0.8,
  };
  const hf = hwFactor[road.highway] ?? 0.8;

  // estimated flood depth (cm) — based on rain and road type
  // Highways have better drainage
  const floodDepthCm = Math.max(0, (p * 1.8 - 2) * hf + (w > 40 ? 3 : 0));

  // Speed reduction (simplified BPR)
  let speedReduction = 0;
  if (floodDepthCm > 30) speedReduction = 100;
  else if (floodDepthCm > 15) speedReduction = 60 + (floodDepthCm - 15) * 2.7;
  else if (floodDepthCm > 5) speedReduction = 20 + (floodDepthCm - 5) * 4;
  else if (p > 2) speedReduction = p * 3;
  speedReduction = Math.min(100, Math.round(speedReduction));

  // Congestion index
  const congestionIndex = speedReduction / 100;

  // Status
  let status: RoadStatus['status'];
  let statusEn: RoadStatus['statusEn'];
  if (speedReduction >= 90) { status = 'Closed'; statusEn = 'closed'; }
  else if (speedReduction >= 50) { status = 'Congested'; statusEn = 'congested'; }
  else if (speedReduction >= 20) { status = 'slow'; statusEn = 'slow'; }
  else { status = 'Clear'; statusEn = 'free'; }

  // usage probability
  const usageProb = Math.max(5, 100 - speedReduction * 0.9);

  // confidence level: higher for main roads and during light rain
  const confidence = p < 1 ? 85 : p < 10 ? 70 : 55;

  // Suggested alternative road
  const altRoutes: Record<string, string> = {
    motorway: 'Parallel trunk road',
    trunk: 'Alternative primary road',
    primary: 'Internal streets',
  };
  const altRoute = status === 'Closed' ? (altRoutes[road.highway] ?? 'Alternative route') : '—';

  return {
    road, floodDepthCm: Math.round(floodDepthCm * 10) / 10,
    speedReduction, congestionIndex, status, statusEn,
    usageProb: Math.round(usageProb), altRoute, confidence,
  };
}

// ---- main component ----
export default function RoadNetworkPage() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const mapRef = useRef<L.Map | null>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const polylinesRef = useRef<L.Polyline[]>([]);

  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [roadStatuses, setRoadStatuses] = useState<RoadStatus[]>([]);
  const [selectedRoad, setSelectedRoad] = useState<RoadStatus | null>(null);
  const [filterRegion, setFilterRegion] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');
  const [mapStyle, setMapStyle] = useState<'dark' | 'light'>('dark');
  const [timelineIndex, setTimelineIndex] = useState<number>(-1);
  const [hourlyTimes, setHourlyTimes] = useState<string[]>([]);
  const [hourlyPrecip, setHourlyPrecip] = useState<number[]>([]);
  const [hourlyProb, setHourlyProb] = useState<number[]>([]);
  const [currentZoom, setCurrentZoom] = useState(7);
  const floodLayerRef = useRef<L.LayerGroup | null>(null);
  const floodWaterLayerRef = useRef<FloodWaterLayerInstance | null>(null);

  // Fetch real weather data (live + hourly)
  const fetchWeather = useCallback(async () => {
    try {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=24.4539&longitude=54.3773' +
        '&current=precipitation,precipitation_probability,wind_speed_10m,temperature_2m' +
        '&hourly=precipitation,precipitation_probability&past_days=1&forecast_days=2&timezone=Asia%2FDubai';
      const res = await fetch(url);
      const d = await res.json();
      const c = d.current;
      setWeather({
        precip: c.precipitation ?? 0,
        precipProb: c.precipitation_probability ?? 0,
        windSpeed: c.wind_speed_10m ?? 0,
        temp: c.temperature_2m ?? 0,
        fetchedAt: new Date().toLocaleTimeString('ar-AE'),
      });
      // Store hourly data for timeline
      if (d.hourly) {
        setHourlyTimes(d.hourly.time ?? []);
        setHourlyPrecip(d.hourly.precipitation ?? []);
        setHourlyProb(d.hourly.precipitation_probability ?? []);
      }
    } catch {
      setWeather({ precip: 0, precipProb: 0, windSpeed: 12, temp: 28, fetchedAt: 'Fetch error' });
    }
  }, []);

  // Build hourly timeline
  const timelineHours = useMemo<TimelineHour[]>(() => {
    if (!hourlyTimes.length) return [];
    const nowStr = new Date().toISOString().slice(0, 13) + ':00';
    const nowIdx = hourlyTimes.findIndex(t => t === nowStr);
    const ni = nowIdx >= 0 ? nowIdx : Math.floor(hourlyTimes.length / 2);
    return buildTimelineHours(hourlyTimes, hourlyPrecip, hourlyProb, ni);
  }, [hourlyTimes, hourlyPrecip, hourlyProb]);

  // Set initial index
  useEffect(() => {
    if (timelineHours.length > 0 && timelineIndex === -1) {
      const ni = timelineHours.findIndex(h => h.isNow);
      setTimelineIndex(ni >= 0 ? ni : Math.floor(timelineHours.length / 3));
    }
  }, [timelineHours, timelineIndex]);

  // Calculate precipMultiplier from selected hour
  const precipMultiplier = useMemo(() => {
    if (!timelineHours.length || timelineIndex < 0) return 1.0;
    const h = timelineHours[timelineIndex];
    if (!h) return 1.0;
    return Math.max(0.3, Math.min(2.5, 0.5 + h.precipitation * 0.4));
  }, [timelineIndex, timelineHours]);

  // Layer Continuous water accumulation (FastFlood SVG style — 4-level zoom-adaptive)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Remove old layer
    if (floodWaterLayerRef.current) { floodWaterLayerRef.current.remove(); floodWaterLayerRef.current = null; }
    const timer = setTimeout(() => {
      floodWaterLayerRef.current = createFloodWaterLayer(map, [], precipMultiplier);
    }, 150);
    return () => {
      clearTimeout(timer);
      floodWaterLayerRef.current?.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update layer when precipMultiplier changes
  useEffect(() => {
    floodWaterLayerRef.current?.update(precipMultiplier);
  }, [precipMultiplier]);

  // zoomend listener
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onZoom = () => setCurrentZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => { map.off('zoomend', onZoom); };
  }, [mapRef.current]);

  // calculate Status Roads
  useEffect(() => {
    if (!weather) return;
    const statuses = ABU_DHABI_ROADS.map(r => calcRoadStatus(r, weather));
    setRoadStatuses(statuses);
    setLastUpdate(new Date().toLocaleTimeString('ar-AE'));
    setLoading(false);
  }, [weather]);

  // Initialize map
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    const map = L.map(mapDivRef.current, {
      center: [23.8, 54.0],
      zoom: 7,
      zoomControl: true,
    });

    const darkTile = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19 }
    );
    const lightTile = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '© OpenStreetMap', maxZoom: 19 }
    );

    darkTile.addTo(map);
    (map as any)._darkTile = darkTile;
    (map as any)._lightTile = lightTile;

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Draw roads on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || roadStatuses.length === 0) return;

    // Remove old roads
    polylinesRef.current.forEach(p => p.remove());
    polylinesRef.current = [];

    roadStatuses.forEach(rs => {
      if (rs.road.coords.length < 2) return;

      // Filter
      if (filterRegion !== 'All' && rs.road.region !== filterRegion) return;
      if (filterStatus !== 'All' && rs.status !== filterStatus) return;

      const color = STATUS_COLOR[rs.status];
      const weight = rs.road.highway === 'motorway' ? 5 :
                     rs.road.highway === 'trunk' ? 4 : 3;

      const line = L.polyline(rs.road.coords as [number, number][], {
        color,
        weight,
        opacity: 0.85,
      });

      // Detailed confidence popup
      const lanes = rs.road.lanes ? `${rs.road.lanes} routes` : '—';
      const speed = rs.road.maxspeed ? `${rs.road.maxspeed} km/hr` : '—';
      line.bindPopup(`
        <div dir="${isAr ? 'rtl' : 'ltr'}" style="min-width:240px;font-family:system-ui;font-size:13px">
          <div style="font-size:15px;font-weight:700;color:${color};margin-bottom:8px">
            ${rs.road.nameAr || rs.road.ref || 'Road'}
          </div>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="color:#aaa;padding:2px 4px">Region</td><td>${rs.road.region}</td></tr>
            <tr><td style="color:#aaa;padding:2px 4px">Type</td><td>${rs.road.highway}</td></tr>
            <tr><td style="color:#aaa;padding:2px 4px">Length</td><td>${rs.road.lengthKm} km</td></tr>
            <tr><td style="color:#aaa;padding:2px 4px">routes</td><td>${lanes}</td></tr>
            <tr><td style="color:#aaa;padding:2px 4px">Max Speed</td><td>${speed}</td></tr>
            <tr style="border-top:1px solid #333"><td style="color:#aaa;padding:4px 4px 2px">Status</td>
              <td style="color:${color};font-weight:700">${rs.status}</td></tr>
            <tr><td style="color:#aaa;padding:2px 4px">Water Depth</td><td>${rs.floodDepthCm} cm</td></tr>
            <tr><td style="color:#aaa;padding:2px 4px">Speed Reduction</td><td>${rs.speedReduction}%</td></tr>
            <tr><td style="color:#aaa;padding:2px 4px">usage probability</td><td>${rs.usageProb}%</td></tr>
            <tr><td style="color:#aaa;padding:2px 4px">alternative route</td><td>${rs.altRoute}</td></tr>
            <tr style="border-top:1px solid #333"><td style="color:#aaa;padding:4px 4px 2px">confidence level</td>
              <td style="color:#06b6d4">${rs.confidence}%</td></tr>
          </table>
          <div style="margin-top:8px;font-size:10px;color:#666">
            📡 OSM + Open-Meteo | Hybrid BPR model
          </div>
        </div>
      `, { maxWidth: 280 });

      line.on('click', () => setSelectedRoad(rs));
      line.addTo(map);
      polylinesRef.current.push(line);
    });
  }, [roadStatuses, filterRegion, filterStatus]);

  // Switch map style
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const dark = (map as any)._darkTile;
    const light = (map as any)._lightTile;
    if (!dark || !light) return;
    if (mapStyle === 'dark') { map.removeLayer(light); if (!map.hasLayer(dark)) dark.addTo(map); }
    else { map.removeLayer(dark); if (!map.hasLayer(light)) light.addTo(map); }
  }, [mapStyle]);

  // Fetch data on load and every 10 minutes
  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  // Statistics
  const stats = {
    total: roadStatuses.length,
    free: roadStatuses.filter(r => r.status === 'Clear').length,
    slow: roadStatuses.filter(r => r.status === 'slow').length,
    congested: roadStatuses.filter(r => r.status === 'Congested').length,
    closed: roadStatuses.filter(r => r.status === 'Closed').length,
    totalKm: roadStatuses.reduce((s, r) => s + r.road.lengthKm, 0).toFixed(0),
    affectedKm: roadStatuses.filter(r => r.status !== 'Clear')
      .reduce((s, r) => s + r.road.lengthKm, 0).toFixed(0),
  };

  const filtered = roadStatuses.filter(rs => {
    if (filterRegion !== 'All' && rs.road.region !== filterRegion) return false;
    if (filterStatus !== 'All' && rs.status !== filterStatus) return false;
    return true;
  });

  return (
    <>
    <div className="flex h-full bg-[#0a0f1a] text-white" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapDivRef} className="w-full h-full" />
        {/* Fullscreen button */}
        <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1001 }}>
          <FullscreenButton size={13} variant="icon-text" color="rgba(255,255,255,0.7)" />
        </div>

        {/* Map toolbar */}
        <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2">
          <button
            onClick={() => setMapStyle(s => s === 'dark' ? 'light' : 'dark')}
            className="bg-[#1a2035]/90 border border-white/10 text-white text-xs px-3 py-1.5 rounded hover:bg-[#1a2035] transition"
          >
            {mapStyle === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button
            onClick={fetchWeather}
            className="bg-[#1a2035]/90 border border-cyan-500/30 text-cyan-400 text-xs px-3 py-1.5 rounded hover:bg-[#1a2035] transition"
          >
            ⟳ Update
          </button>
        </div>

        {/* Color legend */}
        <div className="absolute bottom-8 left-3 z-[1000] bg-[#0d1526]/90 border border-white/10 rounded p-3 text-xs">
          <div className="font-bold text-white/70 mb-2">Status Road</div>
          {Object.entries(STATUS_COLOR).map(([s, c]) => (
            <div key={s} className="flex items-center gap-2 mb-1">
              <div className="w-6 h-2 rounded-full" style={{ background: c }} />
              <span>{s}</span>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-white/10 text-white/40">
            {stats.total} Road | {stats.totalKm} km
          </div>
        </div>

        {/* Weather data */}
        {weather && (
          <div className="absolute top-3 right-3 z-[1000] bg-[#0d1526]/90 border border-white/10 rounded p-3 text-xs min-w-[160px]">
            <div className="font-bold text-cyan-400 mb-2">📡 Live real data</div>
            <div className="flex justify-between mb-1"><span className="text-white/60">rainfall</span><span className="text-blue-400 font-bold">{weather.precip} mm/hr</span></div>
            <div className="flex justify-between mb-1"><span className="text-white/60">probability</span><span>{weather.precipProb}%</span></div>
            <div className="flex justify-between mb-1"><span className="text-white/60">Wind</span><span>{weather.windSpeed} km/hr</span></div>
            <div className="flex justify-between mb-1"><span className="text-white/60">temperature</span><span>{weather.temp}°C</span></div>
            <div className="mt-2 pt-1 border-t border-white/10 text-white/40 text-[10px]">
              Last Update: {weather.fetchedAt}
            </div>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0f1a]/80 z-[2000]">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <div className="text-cyan-400 text-sm">processing Analysis Network Roads...</div>
              <div className="text-white/40 text-xs mt-1">Open-Meteo + OSM Overpass</div>
            </div>
          </div>
        )}
      </div>

      {/* Side dashboard */}
      <div className="w-80 flex flex-col bg-[#0d1526] border-r border-white/5 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-white">Network Roads — Emirate Abu Dhabi</h2>
              <p className="text-xs text-white/40 mt-0.5">OSM + Open-Meteo + hybrid BPR model</p>
              {lastUpdate && <p className="text-[10px] text-cyan-500/60 mt-1">Last Analysis: {lastUpdate}</p>}
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded flex-shrink-0"
              style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.30)', color: '#A78BFA', fontWeight: 600 }}
            >
              <FileDown size={10} />
              PDF
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2 p-3 border-b border-white/5">
          <div className="bg-[#1a2035] rounded p-2 text-center">
            <div className="text-2xl font-bold text-green-400 flex items-center justify-center gap-1">{stats.free}<MetricTooltip id="road-flood-depth" size={10} position="bottom" /></div>
            <div className="text-[10px] text-white/50">Clear</div>
          </div>
          <div className="bg-[#1a2035] rounded p-2 text-center">
            <div className="text-2xl font-bold text-yellow-400 flex items-center justify-center gap-1">{stats.slow}<MetricTooltip id="speed-reduction" size={10} position="bottom" /></div>
            <div className="text-[10px] text-white/50">slow</div>
          </div>
          <div className="bg-[#1a2035] rounded p-2 text-center">
            <div className="text-2xl font-bold text-orange-400 flex items-center justify-center gap-1">{stats.congested}<MetricTooltip id="traffic-congestion-index" size={10} position="bottom" /></div>
            <div className="text-[10px] text-white/50">Congested</div>
          </div>
          <div className="bg-[#1a2035] rounded p-2 text-center">
            <div className="text-2xl font-bold text-red-400 flex items-center justify-center gap-1">{stats.closed}<MetricTooltip id="affected-roads-count" size={10} position="bottom" /></div>
            <div className="text-[10px] text-white/50">Closed</div>
          </div>
        </div>

        {/* Impact bar */}
        <div className="px-3 py-2 border-b border-white/5">
          <div className="flex justify-between text-xs text-white/50 mb-1">
            <span>Affected length</span>
            <span className="text-orange-400">{stats.affectedKm} km From {stats.totalKm} km</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all"
              style={{ width: `${Math.round(Number(stats.affectedKm)/Number(stats.totalKm)*100)}%` }}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="px-3 py-2 border-b border-white/5 flex gap-2">
          <select
            value={filterRegion}
            onChange={e => setFilterRegion(e.target.value)}
            className="flex-1 bg-[#1a2035] border border-white/10 text-white text-xs rounded px-2 py-1"
          >
            <option value="All">All Regions</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="flex-1 bg-[#1a2035] border border-white/10 text-white text-xs rounded px-2 py-1"
          >
            <option value="All">All cases</option>
            <option value="Clear">Clear</option>
            <option value="slow">slow</option>
            <option value="Congested">Congested</option>
            <option value="Closed">Closed</option>
          </select>
        </div>

        {/* list Roads */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center text-white/30 text-sm p-8">no roads match the filter</div>
          ) : (
            filtered.map(rs => (
              <div
                key={rs.road.id}
                onClick={() => {
                  setSelectedRoad(rs);
                  if (mapRef.current && rs.road.coords.length > 0) {
                    mapRef.current.setView([rs.road.centerLat, rs.road.centerLon], 12, { animate: true });
                  }
                }}
                className={`px-3 py-2.5 border-b border-white/5 cursor-pointer hover:bg-white/5 transition ${
                  selectedRoad?.road.id === rs.road.id ? 'bg-white/10' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate">
                      {rs.road.nameAr || rs.road.ref || `Road ${rs.road.id}`}
                    </div>
                    <div className="text-[10px] text-white/40 mt-0.5">
                      {rs.road.region} · {rs.road.lengthKm} km · {rs.road.highway}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: STATUS_COLOR[rs.status] + '22', color: STATUS_COLOR[rs.status] }}
                    >
                      {rs.status}
                    </span>
                    {rs.floodDepthCm > 0 && (
                      <span className="text-[9px] text-blue-400">{rs.floodDepthCm} cm</span>
                    )}
                  </div>
                </div>
                {/* Congestion bar */}
                <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${rs.speedReduction}%`,
                      background: STATUS_COLOR[rs.status],
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selected road data */}
        {selectedRoad && (
          <div className="border-t border-white/10 bg-[#0d1526] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white truncate max-w-[180px]">
                {selectedRoad.road.nameAr || selectedRoad.road.ref}
              </span>
              <button onClick={() => setSelectedRoad(null)} className="text-white/40 hover:text-white text-xs">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <div className="bg-[#1a2035] rounded p-1.5">
                <div className="text-white/50">Water Depth</div>
                <div className="text-blue-400 font-bold">{selectedRoad.floodDepthCm} cm</div>
              </div>
              <div className="bg-[#1a2035] rounded p-1.5">
                <div className="text-white/50">speed reduction</div>
                <div className="text-orange-400 font-bold">{selectedRoad.speedReduction}%</div>
              </div>
              <div className="bg-[#1a2035] rounded p-1.5">
                <div className="text-white/50">usage probability</div>
                <div className="text-green-400 font-bold">{selectedRoad.usageProb}%</div>
              </div>
              <div className="bg-[#1a2035] rounded p-1.5">
                <div className="text-white/50">confidence level</div>
                <div className="text-cyan-400 font-bold">{selectedRoad.confidence}%</div>
              </div>
            </div>
            {selectedRoad.altRoute !== '—' && (
              <div className="mt-2 bg-yellow-500/10 border border-yellow-500/20 rounded p-1.5 text-[10px]">
                <span className="text-yellow-400 font-bold">⚠ alternative: </span>
                <span className="text-white/70">{selectedRoad.altRoute}</span>
              </div>
            )}
            <div className="mt-1.5 text-[9px] text-white/30">
              📡 OSM · Open-Meteo · BPR Hybrid · Confidence {selectedRoad.confidence}%
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Timeline Scrubber */}
    {timelineHours.length > 0 && (
      <TimelineScrubber
        hours={timelineHours}
        currentIndex={timelineIndex}
        onIndexChange={setTimelineIndex}
        isLive={!!(weather && weather.precip >= 0)}
      />
    )}
    </>);
}
