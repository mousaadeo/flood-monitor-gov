/**
 * UncertaintyMapPage — Map Blind Spots (Uncertainty Map)
 * Shows regions where the model needs field verification
 * Design: Techno-Geospatial Command Center
 * Uses: Leaflet (consistent with rest of project)
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import FullscreenButton from '@/components/FullscreenButton';
import MetricTooltip from '@/components/MetricTooltip';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { getZonesForZoom, type FloodZoneMulti } from '@/services/floodMapData';
import { createFloodWaterLayer, type FloodWaterLayerInstance } from '@/components/FloodWaterLayer';
import TimelineScrubber, { buildTimelineHours, type TimelineHour } from '@/components/TimelineScrubber';
import { AD_EMIRATE_BOUNDARY, URBAN_ZONES, getUrbanDensity } from '@/data/abuDhabiBoundary';
import {
  Eye, AlertTriangle, CheckCircle,
  MapPin, Target, Brain, FileDown
} from 'lucide-react';

// ===== Real Blind Spots in Abu Dhabi =====
interface BlindSpot {
  id: string;
  lat: number;
  lng: number;
  nameAr: string;
  nameEn: string;
  uncertaintyScore: number; // 0-100
  priority: 'critical' | 'high' | 'medium' | 'low';
  reasonAr: string;
  reasonEn: string;
  lastValidated: string;
  modelConfidence: number; // 0-100
  fieldReportsCount: number;
  recommendedActionAr: string;
  recommendedActionEn: string;
  drainageCapacity: 'poor' | 'moderate' | 'good';
  area: number; // km²
  population: number;
}

const BLIND_SPOTS: BlindSpot[] = [
  {
    id: 'BS-001',
    lat: 24.4539, lng: 54.3773,
    nameAr: 'Mussafah Industrial — Warehouse Region',
    nameEn: 'Mussafah Industrial — Warehouse Zone',
    uncertaintyScore: 87,
    priority: 'critical',
    reasonAr: 'Data Drainage network data missing from ADSSC — model relies on OSM only (82% accuracy)',
    reasonEn: 'ADSSC drainage data missing — model relies on OSM only (82% accuracy)',
    lastValidated: '2026-03-15',
    modelConfidence: 31,
    fieldReportsCount: 2,
    recommendedActionAr: 'Verify Field Immediate + Request ADSSC data for Region M-44',
    recommendedActionEn: 'Immediate field inspection + request ADSSC data for zone M-44',
    drainageCapacity: 'poor',
    area: 12.4,
    population: 45000,
  },
  {
    id: 'BS-002',
    lat: 24.5239, lng: 54.4350,
    nameAr: 'South Al Shamkha — New Residential Neighborhood',
    nameEn: 'South Shamkha — New Residential District',
    uncertaintyScore: 74,
    priority: 'high',
    reasonAr: 'Region Decent development — DEM data outdated (2019) does not reflect current terrain',
    reasonEn: 'Recent development area — DEM data from 2019 does not reflect current terrain',
    lastValidated: '2026-02-28',
    modelConfidence: 42,
    fieldReportsCount: 1,
    recommendedActionAr: 'Update DEM with recent Sentinel-2 images + field survey for windows',
    recommendedActionEn: 'Update DEM with recent Sentinel-2 imagery + field survey of drainage outlets',
    drainageCapacity: 'moderate',
    area: 8.7,
    population: 32000,
  },
  {
    id: 'BS-003',
    lat: 24.4200, lng: 54.6500,
    nameAr: 'Sheikh Zayed Street — District 11',
    nameEn: 'Sheikh Zayed Road — District 11',
    uncertaintyScore: 68,
    priority: 'high',
    reasonAr: 'Overlap between map layers and traffic data — historical accidents data incomplete',
    reasonEn: 'Map layer overlap with traffic data — historical incidents incomplete',
    lastValidated: '2026-03-01',
    modelConfidence: 48,
    fieldReportsCount: 3,
    recommendedActionAr: 'Review Data ADTM for rain-related traffic accidents (2022-2024)',
    recommendedActionEn: 'Review ADTM data for rain-related traffic incidents (2022-2024)',
    drainageCapacity: 'moderate',
    area: 5.2,
    population: 18000,
  },
  {
    id: 'BS-004',
    lat: 24.4700, lng: 54.3200,
    nameAr: 'Zayed Port — Logistics Region',
    nameEn: 'Zayed Port — Logistics Zone',
    uncertaintyScore: 61,
    priority: 'medium',
    reasonAr: 'Data Terrain coastal area not precise — tide and island impact not calculated',
    reasonEn: 'Coastal terrain data inaccurate — tidal effects not accounted for',
    lastValidated: '2026-01-20',
    modelConfidence: 55,
    fieldReportsCount: 0,
    recommendedActionAr: 'Add tide and island model from NCMS + update coastal elevation map',
    recommendedActionEn: 'Add NCMS tidal model + update coastal elevation map',
    drainageCapacity: 'good',
    area: 15.1,
    population: 5000,
  },
  {
    id: 'BS-005',
    lat: 24.5000, lng: 54.5000,
    nameAr: 'Central City Abu Dhabi — Island Corniche',
    nameEn: 'Abu Dhabi Downtown — Corniche Island',
    uncertaintyScore: 55,
    priority: 'medium',
    reasonAr: 'outdated drainage network (1980s) — actual drainage capacity unverified',
    reasonEn: 'Old drainage network (1980s) — actual drainage capacity undocumented',
    lastValidated: '2026-03-10',
    modelConfidence: 62,
    fieldReportsCount: 4,
    recommendedActionAr: 'Request updated drainage plans from Abu Dhabi Municipality',
    recommendedActionEn: 'Request historical drainage plans from Abu Dhabi Municipality',
    drainageCapacity: 'moderate',
    area: 3.8,
    population: 25000,
  },
  {
    id: 'BS-006',
    lat: 24.3900, lng: 54.5400,
    nameAr: 'Al Reem Island — second phase',
    nameEn: 'Reem Island — Phase 2',
    uncertaintyScore: 48,
    priority: 'medium',
    reasonAr: 'Active construction projects — terrain changes rapidly and does not match DEM',
    reasonEn: 'Active construction projects — terrain changes rapidly and mismatches DEM',
    lastValidated: '2026-03-18',
    modelConfidence: 69,
    fieldReportsCount: 1,
    recommendedActionAr: 'Update DEM monthly from high-accuracy Planet Labs imagery',
    recommendedActionEn: 'Monthly DEM update from high-resolution Planet Labs imagery',
    drainageCapacity: 'good',
    area: 6.2,
    population: 28000,
  },
  {
    id: 'BS-007',
    lat: 24.3500, lng: 54.4800,
    nameAr: 'Saadiyat Island — Cultural Region',
    nameEn: 'Saadiyat Island — Cultural District',
    uncertaintyScore: 38,
    priority: 'low',
    reasonAr: 'Sufficient data but lack of recent field verification reports',
    reasonEn: 'Sufficient data but lack of recent field validation reports',
    lastValidated: '2025-12-15',
    modelConfidence: 78,
    fieldReportsCount: 2,
    recommendedActionAr: 'Verify Field periodic every 3 months',
    recommendedActionEn: 'Periodic field validation every 3 months',
    drainageCapacity: 'good',
    area: 9.5,
    population: 12000,
  },
  {
    id: 'BS-008',
    lat: 24.4100, lng: 54.4100,
    nameAr: 'Green Region — Al Zafaranah Park',
    nameEn: 'Green Zone — Zaafrana Park',
    uncertaintyScore: 29,
    priority: 'low',
    reasonAr: 'Good coverage but infiltration model in sandy soil needs calibration',
    reasonEn: 'Good coverage but sandy soil infiltration model needs calibration',
    lastValidated: '2026-02-10',
    modelConfidence: 84,
    fieldReportsCount: 5,
    recommendedActionAr: 'Calibrate infiltration coefficient in sandy soil (Ksat)',
    recommendedActionEn: 'Calibrate sandy soil infiltration coefficient (Ksat)',
    drainageCapacity: 'good',
    area: 4.1,
    population: 8000,
  },
];

const PRIORITY_COLORS = {
  critical: '#FF1744',
  high: '#FF6D00',
  medium: '#FFD600',
  low: '#69F0AE',
};

const PRIORITY_LABELS = {
  critical: { ar: 'Critical', en: 'Critical' },
  high: { ar: 'High', en: 'High' },
  medium: { ar: 'Average', en: 'Medium' },
  low: { ar: 'Low', en: 'Low' },
};

export default function UncertaintyMapPage() {
  const { lang } = useLanguage();
  const { theme } = useAppTheme();
  const isRtl = lang === 'ar';
  const isAdeo = theme === 'adeo-light';
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const circlesRef = useRef<L.Circle[]>([]);
  const osmBoundaryRef = useRef<L.Polygon | null>(null);
  const urbanZoneLayersRef = useRef<L.Rectangle[]>([]);

  const [selectedSpot, setSelectedSpot] = useState<BlindSpot | null>(BLIND_SPOTS[0]);
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'stats'>('map');
  const [timelineIndex, setTimelineIndex] = useState<number>(-1);
  const [hourlyTimes, setHourlyTimes] = useState<string[]>([]);
  const [hourlyPrecip, setHourlyPrecip] = useState<number[]>([]);
  const [hourlyProb, setHourlyProb] = useState<number[]>([]);
  const [currentZoom, setCurrentZoom] = useState(10);
  const [isLive, setIsLive] = useState(true);
  const floodLayerRef = useRef<L.LayerGroup | null>(null);
  const floodWaterLayerRef = useRef<FloodWaterLayerInstance | null>(null);

  const bgPrimary = isAdeo ? '#F8FAFC' : '#0A1624';
  const bgCard = isAdeo ? '#FFFFFF' : 'rgba(13,27,42,0.95)';
  const borderC = isAdeo ? 'rgba(0,51,102,0.12)' : 'rgba(66,165,245,0.15)';
  const textPrimary = isAdeo ? '#0D1B2A' : '#E8F4F8';
  const textMuted = isAdeo ? '#6B7C93' : '#78909C';
  const accentC = isAdeo ? '#003366' : '#42A5F5';

  const filteredSpots = filterPriority === 'all'
    ? BLIND_SPOTS
    : BLIND_SPOTS.filter(s => s.priority === filterPriority);

  const avgUncertainty = Math.round(BLIND_SPOTS.reduce((s, b) => s + b.uncertaintyScore, 0) / BLIND_SPOTS.length);
  const criticalCount = BLIND_SPOTS.filter(b => b.priority === 'critical').length;
  const avgConfidence = Math.round(BLIND_SPOTS.reduce((s, b) => s + b.modelConfidence, 0) / BLIND_SPOTS.length);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [24.4539, 54.3773],
      zoom: 11,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Add Blind Spots
    BLIND_SPOTS.forEach(spot => {
      const color = PRIORITY_COLORS[spot.priority];
      const radiusMeters = spot.uncertaintyScore * 150;

      // Uncertainty circle
      const circle = L.circle([spot.lat, spot.lng], {
        radius: radiusMeters,
        color: color,
        fillColor: color,
        fillOpacity: 0.12,
        weight: 1.5,
        opacity: 0.6,
      }).addTo(map);
      circlesRef.current.push(circle);

      // Center marker
      const markerSize = 8 + Math.round(spot.uncertaintyScore / 15);
      const marker = L.circleMarker([spot.lat, spot.lng], {
        radius: markerSize,
        color: '#fff',
        fillColor: color,
        fillOpacity: 0.9,
        weight: 2,
      }).addTo(map);

      marker.bindTooltip(`
        <div style="font-family:Tajawal,sans-serif;font-size:12px;padding:4px 8px">
          <strong>${spot.id}</strong> — ${lang === 'ar' ? spot.nameAr : spot.nameEn}<br/>
          <span style="color:${color}">Uncertainty: ${spot.uncertaintyScore}%</span>
        </div>
      `, { sticky: true });

      marker.on('click', () => {
        setSelectedSpot(spot);
        setActiveTab('map');
        map.panTo([spot.lat, spot.lng]);
      });

      markersRef.current.push(marker);
    });

    // ── OSM Emirate Boundary Overlay ──────────────────────────────────────────
    // Draw the official Abu Dhabi emirate boundary from OSM data
    const boundaryPolygon = L.polygon(
      AD_EMIRATE_BOUNDARY.map(([lat, lng]) => [lat, lng] as [number, number]),
      {
        color: '#42A5F5',
        fillColor: 'transparent',
        fillOpacity: 0,
        weight: 2,
        opacity: 0.7,
        dashArray: '6 4',
      }
    ).addTo(map);
    boundaryPolygon.bindTooltip(
      `<div style="font-family:Tajawal,sans-serif;font-size:11px;padding:4px 8px">
        <strong style="color:#42A5F5">Abu Dhabi Emirate Boundary</strong><br/>
        <span style="color:#78909C">OSM Relation 3766481 — Simplified 45 pts</span>
      </div>`,
      { sticky: true }
    );
    osmBoundaryRef.current = boundaryPolygon;

    // ── Urban Zones Overlay — colored by building density ─────────────────────
    // Each zone is a rectangle colored by density (0.0=transparent → 0.95=orange)
    URBAN_ZONES.forEach(zone => {
      const density = zone.density;
      // Color scale: low density = light blue, high density = orange-red
      const r = Math.round(30 + density * 225);   // 30 → 255
      const g = Math.round(144 - density * 80);   // 144 → 64
      const b = Math.round(255 - density * 200);  // 255 → 55
      const fillOpacity = 0.05 + density * 0.10;  // 0.05 → 0.15
      const rect = L.rectangle(
        [[zone.minLat, zone.minLng], [zone.maxLat, zone.maxLng]],
        {
          color: `rgb(${r},${g},${b})`,
          fillColor: `rgb(${r},${g},${b})`,
          fillOpacity,
          weight: 0.8,
          opacity: 0.5,
        }
      ).addTo(map);
      rect.bindTooltip(
        `<div style="font-family:Tajawal,sans-serif;font-size:11px;padding:4px 8px">
          <strong style="color:rgb(${r},${g},${b})">${zone.name}</strong><br/>
          <span style="color:#78909C">Building Density: ${(density * 100).toFixed(0)}%</span><br/>
          <span style="color:#78909C">Flood Threshold: ${(0.38 + density * 0.44).toFixed(2)}</span>
        </div>`,
        { sticky: true }
      );
      urbanZoneLayersRef.current.push(rect);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
      circlesRef.current = [];
      osmBoundaryRef.current = null;
      urbanZoneLayersRef.current = [];
    };
  }, []);

  // Update visible layers when filter changes
  useEffect(() => {
    if (!mapRef.current) return;
    BLIND_SPOTS.forEach((spot, i) => {
      const visible = filterPriority === 'all' || spot.priority === filterPriority;
      const marker = markersRef.current[i];
      const circle = circlesRef.current[i];
      if (!marker || !circle) return;
      if (visible) {
        if (!mapRef.current!.hasLayer(marker)) marker.addTo(mapRef.current!);
        if (!mapRef.current!.hasLayer(circle)) circle.addTo(mapRef.current!);
      } else {
        if (mapRef.current!.hasLayer(marker)) marker.remove();
        if (mapRef.current!.hasLayer(circle)) circle.remove();
      }
    });
  }, [filterPriority]);

  // Navigate to the specified point
  useEffect(() => {
    if (!mapRef.current || !selectedSpot) return;
    mapRef.current.panTo([selectedSpot.lat, selectedSpot.lng]);
  }, [selectedSpot]);

  // Fetch hourly weather data
  useEffect(() => {
    const fetchHourly = async () => {
      try {
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=24.4539&longitude=54.3773' +
          '&current=precipitation&hourly=precipitation,precipitation_probability&past_days=1&forecast_days=2&timezone=Asia%2FDubai';
        const res = await fetch(url);
        const d = await res.json();
        if (d.hourly) {
          setHourlyTimes(d.hourly.time ?? []);
          setHourlyPrecip(d.hourly.precipitation ?? []);
          setHourlyProb(d.hourly.precipitation_probability ?? []);
          setIsLive(true);
        }
      } catch { /* silent */ }
    };
    fetchHourly();
  }, []);

  const timelineHours = useMemo<TimelineHour[]>(() => {
    if (!hourlyTimes.length) return [];
    const nowStr = new Date().toISOString().slice(0, 13) + ':00';
    const nowIdx = hourlyTimes.findIndex(t => t === nowStr);
    const ni = nowIdx >= 0 ? nowIdx : Math.floor(hourlyTimes.length / 2);
    return buildTimelineHours(hourlyTimes, hourlyPrecip, hourlyProb, ni);
  }, [hourlyTimes, hourlyPrecip, hourlyProb]);

  useEffect(() => {
    if (timelineHours.length > 0 && timelineIndex === -1) {
      const ni = timelineHours.findIndex(h => h.isNow);
      setTimelineIndex(ni >= 0 ? ni : Math.floor(timelineHours.length / 3));
    }
  }, [timelineHours, timelineIndex]);

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
    if (floodWaterLayerRef.current) { floodWaterLayerRef.current.remove(); floodWaterLayerRef.current = null; }
    const timer = setTimeout(() => {
      floodWaterLayerRef.current = createFloodWaterLayer(map, [], precipMultiplier);
    }, 200);
    return () => {
      clearTimeout(timer);
      floodWaterLayerRef.current?.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    floodWaterLayerRef.current?.update(precipMultiplier);
  }, [precipMultiplier]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onZoom = () => setCurrentZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => { map.off('zoomend', onZoom); };
  }, [mapRef.current]);

  return (
    <>
    <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', background: bgPrimary }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px', background: bgCard,
        borderBottom: `1px solid ${borderC}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'linear-gradient(135deg, #FF6D00, #FF1744)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Eye size={18} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: textPrimary, margin: 0 }}>
              {isRtl ? 'Map Blind Spots — Uncertainty Map' : 'Uncertainty Map — Blind Spots'}
            </h1>
            <p style={{ fontSize: 11, color: textMuted, margin: 0 }}>
              {isRtl
                ? 'Regions where model needs field verification to improve accuracy'
                : 'Areas where the model requires field verification to improve accuracy'}
            </p>
          </div>
        </div>

        {/* Quick statistics + Export */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.30)', borderRadius: '6px', cursor: 'pointer', color: '#A78BFA', fontSize: '11px', fontWeight: 600, flexShrink: 0 }}
          >
            <FileDown size={12} />
            {isRtl ? 'Export PDF' : 'Export PDF'}
          </button>
          {[
            { label: 'Blind Spots', value: BLIND_SPOTS.length, color: '#FF6D00', tid: 'blind-spots' },
            { label: isRtl ? 'Critical' : 'Critical', value: criticalCount, color: '#FF1744', tid: 'uncertainty-level' },
            { label: isRtl ? 'Average Uncertainty' : 'Avg Uncertainty', value: `${avgUncertainty}%`, color: '#FFD600', tid: 'uncertainty-level' },
            { label: isRtl ? 'Model Confidence' : 'Model Confidence', value: `${avgConfidence}%`, color: '#69F0AE', tid: 'model-confidence' },
          ].map((s, i) => (
            <div key={i} style={{
              background: isAdeo ? 'rgba(0,51,102,0.05)' : 'rgba(66,165,245,0.08)',
              border: `1px solid ${s.color}33`,
              borderRadius: 6, padding: '6px 12px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                {s.value}
                <MetricTooltip id={s.tid} size={10} position="bottom" />
              </div>
              <div style={{ fontSize: 9, color: textMuted }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
          {/* Fullscreen button */}
          <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1001 }}>
            <FullscreenButton size={13} variant="icon-text" color="rgba(255,255,255,0.7)" />
          </div>

          {/* Filter tabs */}
          <div style={{
            position: 'absolute', top: 12,
            ...(isRtl ? { right: 12 } : { left: 12 }),
            display: 'flex', gap: 6, zIndex: 1000,
          }}>
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map(p => (
              <button
                key={p}
                onClick={() => setFilterPriority(p)}
                style={{
                  padding: '5px 12px', borderRadius: 6,
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: filterPriority === p
                    ? (p === 'all' ? accentC : PRIORITY_COLORS[p as keyof typeof PRIORITY_COLORS] || accentC)
                    : 'rgba(10,22,36,0.85)',
                  color: filterPriority === p ? '#fff' : textMuted,
                  backdropFilter: 'blur(8px)',
                  outline: `1px solid ${filterPriority === p ? 'transparent' : borderC}`,
                  transition: 'all 0.2s',
                  border: 'none',
                }}
              >
                {p === 'all' ? (isRtl ? 'All' : 'All') : (isRtl ? PRIORITY_LABELS[p as keyof typeof PRIORITY_LABELS].ar : PRIORITY_LABELS[p as keyof typeof PRIORITY_LABELS].en)}
              </button>
            ))}
          </div>

          {/* Color legend */}
          <div style={{
            position: 'absolute', bottom: 20,
            ...(isRtl ? { left: 20 } : { right: 20 }),
            background: 'rgba(10,22,36,0.92)',
            border: '1px solid rgba(66,165,245,0.2)',
            borderRadius: 8, padding: '10px 14px',
            zIndex: 1000, minWidth: 170,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#42A5F5', marginBottom: 6 }}>
              {isRtl ? 'Score Uncertainty' : 'Uncertainty Level'}
            </div>
            {Object.entries(PRIORITY_COLORS).map(([k, c]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
                <span style={{ fontSize: 10, color: '#E8F4F8' }}>
                  {isRtl ? PRIORITY_LABELS[k as keyof typeof PRIORITY_LABELS].ar : PRIORITY_LABELS[k as keyof typeof PRIORITY_LABELS].en}
                </span>
              </div>
            ))}
            {/* OSM Boundary legend */}
            <div style={{ borderTop: '1px solid rgba(66,165,245,0.2)', marginTop: 8, paddingTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#42A5F5', marginBottom: 6 }}>
                {isRtl ? 'Map Layers' : 'Map Layers'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 18, height: 2, background: '#42A5F5', borderRadius: 1, borderTop: '2px dashed #42A5F5' }} />
                <span style={{ fontSize: 9, color: '#78909C' }}>OSM Emirate Boundary</span>
              </div>
              <div style={{ fontSize: 9, color: '#78909C', marginBottom: 4 }}>Urban Density Zones:</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <div style={{ width: 12, height: 8, background: 'rgb(30,144,255)', opacity: 0.6, borderRadius: 2 }} />
                <span style={{ fontSize: 8, color: '#78909C' }}>Low</span>
                <div style={{ width: 12, height: 8, background: 'rgb(142,104,200)', opacity: 0.6, borderRadius: 2 }} />
                <span style={{ fontSize: 8, color: '#78909C' }}>Med</span>
                <div style={{ width: 12, height: 8, background: 'rgb(255,64,55)', opacity: 0.6, borderRadius: 2 }} />
                <span style={{ fontSize: 8, color: '#78909C' }}>High</span>
              </div>
            </div>
          </div>
        </div>

        {/* Side dashboard */}
        <div style={{
          width: 340, background: bgCard,
          borderRight: isRtl ? `1px solid ${borderC}` : 'none',
          borderLeft: isRtl ? 'none' : `1px solid ${borderC}`,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Dashboard tabs */}
          <div style={{
            display: 'flex', borderBottom: `1px solid ${borderC}`,
            flexShrink: 0,
          }}>
            {(['map', 'list', 'stats'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: '10px 0', border: 'none',
                  background: activeTab === tab
                    ? isAdeo ? 'rgba(0,51,102,0.08)' : 'rgba(66,165,245,0.1)'
                    : 'transparent',
                  color: activeTab === tab ? accentC : textMuted,
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  borderBottom: activeTab === tab ? `2px solid ${accentC}` : '2px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                {tab === 'map' ? 'Details' :
                  tab === 'list' ? 'List' :
                    (isRtl ? 'statistics' : 'Stats')}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            {/* Details tab */}
            {activeTab === 'map' && selectedSpot && (
              <div>
                <div style={{
                  background: `${PRIORITY_COLORS[selectedSpot.priority]}15`,
                  border: `1px solid ${PRIORITY_COLORS[selectedSpot.priority]}44`,
                  borderRadius: 10, padding: 14, marginBottom: 12,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{
                      background: PRIORITY_COLORS[selectedSpot.priority],
                      color: '#fff', borderRadius: 4, padding: '2px 8px',
                      fontSize: 10, fontWeight: 700,
                    }}>
                      {selectedSpot.id} — {isRtl ? PRIORITY_LABELS[selectedSpot.priority].ar : PRIORITY_LABELS[selectedSpot.priority].en}
                    </span>
                    <span style={{ fontSize: 10, color: textMuted }}>
                      {isRtl ? 'Last Verify:' : 'Last validated:'} {selectedSpot.lastValidated}
                    </span>
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: textPrimary, margin: '0 0 4px' }}>
                    {isRtl ? selectedSpot.nameAr : selectedSpot.nameEn}
                  </h3>
                  <p style={{ fontSize: 11, color: textMuted, margin: 0, lineHeight: 1.5 }}>
                    {isRtl ? selectedSpot.reasonAr : selectedSpot.reasonEn}
                  </p>
                </div>

                {/* Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[
                    {
                      label: isRtl ? 'Score Uncertainty' : 'Uncertainty Score',
                      value: `${selectedSpot.uncertaintyScore}%`,
                      color: PRIORITY_COLORS[selectedSpot.priority],
                      icon: <AlertTriangle size={12} />,
                    },
                    {
                      label: 'Model Confidence',
                      value: `${selectedSpot.modelConfidence}%`,
                      color: selectedSpot.modelConfidence > 60 ? '#69F0AE' : '#FF6D00',
                      icon: <Brain size={12} />,
                    },
                    {
                      label: 'Field Reports',
                      value: selectedSpot.fieldReportsCount,
                      color: '#42A5F5',
                      icon: <CheckCircle size={12} />,
                    },
                    {
                      label: isRtl ? 'Area' : 'Area',
                      value: `${selectedSpot.area} km²`,
                      color: '#78909C',
                      icon: <MapPin size={12} />,
                    },
                  ].map((m, i) => (
                    <div key={i} style={{
                      background: isAdeo ? 'rgba(0,51,102,0.04)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${borderC}`, borderRadius: 8, padding: '10px 12px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: m.color, marginBottom: 4 }}>
                        {m.icon}
                        <span style={{ fontSize: 9, color: textMuted }}>{m.label}</span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Confidence bar */}
                <div style={{
                  background: isAdeo ? 'rgba(0,51,102,0.04)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${borderC}`, borderRadius: 8, padding: '10px 12px', marginBottom: 12,
                }}>
                  <div style={{ fontSize: 10, color: textMuted, marginBottom: 6 }}>
                    {isRtl ? 'Level model confidence' : 'Model Confidence Level'}
                  </div>
                  <div style={{ height: 6, background: isAdeo ? '#e0e0e0' : '#1a2a3a', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${selectedSpot.modelConfidence}%`,
                      background: selectedSpot.modelConfidence > 60
                        ? 'linear-gradient(90deg, #42A5F5, #69F0AE)'
                        : 'linear-gradient(90deg, #FF6D00, #FFD600)',
                      borderRadius: 3, transition: 'width 0.5s',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 9, color: textMuted }}>0%</span>
                    <span style={{ fontSize: 9, color: textMuted }}>100%</span>
                  </div>
                </div>

                {/* Recommendation */}
                <div style={{
                  background: '#42A5F515', border: '1px solid #42A5F533',
                  borderRadius: 8, padding: '10px 12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Target size={12} color="#42A5F5" />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#42A5F5' }}>
                      'Recommended Action'
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: textMuted, margin: 0, lineHeight: 1.5 }}>
                    {isRtl ? selectedSpot.recommendedActionAr : selectedSpot.recommendedActionEn}
                  </p>
                </div>
              </div>
            )}

            {/* List tab */}
            {activeTab === 'list' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredSpots.map(spot => (
                  <div
                    key={spot.id}
                    onClick={() => {
                      setSelectedSpot(spot);
                      setActiveTab('map');
                      if (mapRef.current) mapRef.current.panTo([spot.lat, spot.lng]);
                    }}
                    style={{
                      background: selectedSpot?.id === spot.id
                        ? `${PRIORITY_COLORS[spot.priority]}15`
                        : isAdeo ? 'rgba(0,51,102,0.03)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${selectedSpot?.id === spot.id ? PRIORITY_COLORS[spot.priority] + '44' : borderC}`,
                      borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: PRIORITY_COLORS[spot.priority] }}>
                        {spot.id}
                      </span>
                      <span style={{
                        background: `${PRIORITY_COLORS[spot.priority]}22`,
                        color: PRIORITY_COLORS[spot.priority],
                        borderRadius: 4, padding: '1px 6px', fontSize: 9, fontWeight: 700,
                      }}>
                        {spot.uncertaintyScore}%
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary, marginBottom: 2 }}>
                      {isRtl ? spot.nameAr : spot.nameEn}
                    </div>
                    <div style={{ fontSize: 10, color: textMuted, lineHeight: 1.4 }}>
                      {isRtl ? spot.reasonAr.substring(0, 60) + '...' : spot.reasonEn.substring(0, 60) + '...'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Statistics tab */}
            {activeTab === 'stats' && (
              <div>
                {/* Distribution Priorities */}
                <div style={{
                  background: isAdeo ? 'rgba(0,51,102,0.04)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${borderC}`, borderRadius: 8, padding: 12, marginBottom: 12,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: textPrimary, marginBottom: 10 }}>
                    {isRtl ? 'Distribution Priorities' : 'Priority Distribution'}
                  </div>
                  {Object.entries(PRIORITY_COLORS).map(([priority, color]) => {
                    const count = BLIND_SPOTS.filter(s => s.priority === priority).length;
                    const pct = Math.round((count / BLIND_SPOTS.length) * 100);
                    return (
                      <div key={priority} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 10, color: textMuted }}>
                            {isRtl ? PRIORITY_LABELS[priority as keyof typeof PRIORITY_LABELS].ar : PRIORITY_LABELS[priority as keyof typeof PRIORITY_LABELS].en}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 700, color }}>{count} ({pct}%)</span>
                        </div>
                        <div style={{ height: 4, background: isAdeo ? '#e0e0e0' : '#1a2a3a', borderRadius: 2 }}>
                          <div style={{
                            height: '100%', width: `${pct}%`,
                            background: color, borderRadius: 2,
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Confidence comparison */}
                <div style={{
                  background: isAdeo ? 'rgba(0,51,102,0.04)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${borderC}`, borderRadius: 8, padding: 12, marginBottom: 12,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: textPrimary, marginBottom: 10 }}>
                    {'Model Confidence per Spot'}
                  </div>
                  {BLIND_SPOTS.map(spot => (
                    <div key={spot.id} style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 9, color: textMuted }}>{spot.id}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: spot.modelConfidence > 60 ? '#69F0AE' : '#FF6D00' }}>
                          {spot.modelConfidence}%
                        </span>
                      </div>
                      <div style={{ height: 3, background: isAdeo ? '#e0e0e0' : '#1a2a3a', borderRadius: 2 }}>
                        <div style={{
                          height: '100%', width: `${spot.modelConfidence}%`,
                          background: spot.modelConfidence > 60 ? '#69F0AE' : '#FF6D00',
                          borderRadius: 2,
                        }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Impact on accuracy */}
                <div style={{
                  background: '#42A5F510', border: '1px solid #42A5F530',
                  borderRadius: 8, padding: 12,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#42A5F5', marginBottom: 8 }}>
                    'Expected Accuracy Impact'
                  </div>
                  {[
                    { labelAr: 'If BS-001 validated', labelEn: 'If BS-001 validated', gain: '+4.2%', color: '#FF1744' },
                    { labelAr: 'If BS-002 validated', labelEn: 'If BS-002 validated', gain: '+2.8%', color: '#FF6D00' },
                    { labelAr: 'if validated BS-003', labelEn: 'If BS-003 validated', gain: '+1.9%', color: '#FF6D00' },
                    { labelAr: 'All spots validated', labelEn: 'All spots validated', gain: '+12.1%', color: '#69F0AE' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: textMuted }}>{isRtl ? item.labelAr : item.labelEn}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: item.color }}>{item.gain}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Timeline Scrubber */}
    {timelineHours.length > 0 && (
      <TimelineScrubber
        hours={timelineHours}
        currentIndex={timelineIndex}
        onIndexChange={setTimelineIndex}
        isLive={isLive}
      />
    )}
    </>
  );
}
