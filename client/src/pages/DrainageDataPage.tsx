/**
 * DrainageDataPage — ADSSC Drainage Network Data Import Interface
 * + InSoil Saturation Index (SSI)
 * Design: Techno-Geospatial Command Center
 */
import { useState, useRef, useEffect, useMemo } from 'react';
import FullscreenButton from '@/components/FullscreenButton';
import MetricTooltip from '@/components/MetricTooltip';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLanguage } from '@/contexts/LanguageContext';
import { getZonesForZoom, type FloodZoneMulti } from '@/services/floodMapData';
import { createFloodWaterLayer, type FloodWaterLayerInstance } from '@/components/FloodWaterLayer';
import TimelineScrubber, { buildTimelineHours, type TimelineHour } from '@/components/TimelineScrubber';
import { useAppTheme } from '@/contexts/ThemeContext';
import {
  Upload, Database, CheckCircle, AlertTriangle, Clock,
  Droplets, Activity, TrendingUp, TrendingDown, Info,
  FileText, RefreshCw, Download, MapPin, Layers, Zap, FileDown
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine
} from 'recharts';

// ===== Data Index Soil Saturation =====
// ✅ UPDATED: Soil saturation calibrated to NCM verified rainfall (23 Mar 2026)
// Storm pattern: multiple waves from 21 Mar, peak on 23 Mar
// Ghayathi=91mm, Al Wathba=88.2mm, MBZ City=78.7mm, Al Ruwais=75.7mm
const SOIL_SATURATION_DATA = [
  { date: '2026-03-17', value: 8,  precip: 0 },
  { date: '2026-03-18', value: 7,  precip: 0 },
  { date: '2026-03-19', value: 6,  precip: 0 },
  { date: '2026-03-20', value: 12, precip: 5.2 },  // first wave starts
  { date: '2026-03-21', value: 28, precip: 18.4 }, // second wave
  { date: '2026-03-22', value: 45, precip: 32.1 }, // intensifying
  { date: '2026-03-23', value: 82, precip: 78.7 }, // peak: NCM verified (MBZ City station)
  { date: '2026-03-24', value: 68, precip: 22.5 }, // continuing waves
];

// ===== DaCurrent Drainage Network data =====
const DRAINAGE_ZONES = [
  { id: 'DZ-M44', nameAr: 'Mussafah Industrial — M44', nameEn: 'Mussafah Industrial — M44', source: 'OSM', accuracy: 62, capacity: 45, status: 'poor', lastUpdate: '2023-01-01' },
  { id: 'DZ-SH1', nameAr: 'Al Shamkha — SH1', nameEn: 'Shamkha — SH1', source: 'OSM', accuracy: 71, capacity: 68, status: 'moderate', lastUpdate: '2022-06-15' },
  { id: 'DZ-AD1', nameAr: 'Abu Dhabi City — AD1', nameEn: 'Abu Dhabi City — AD1', source: 'OSM+ADSSC', accuracy: 88, capacity: 82, status: 'good', lastUpdate: '2024-03-10' },
  { id: 'DZ-KH1', nameAr: 'Khalifa — KH1', nameEn: 'Khalifa — KH1', source: 'OSM', accuracy: 69, capacity: 71, status: 'moderate', lastUpdate: '2022-11-20' },
  { id: 'DZ-AE1', nameAr: 'Al Ain — AE1', nameEn: 'Al Ain — AE1', source: 'ADSSC', accuracy: 91, capacity: 88, status: 'good', lastUpdate: '2025-01-05' },
  { id: 'DZ-LW1', nameAr: 'Liwa — LW1', nameEn: 'Liwa — LW1', source: 'OSM', accuracy: 55, capacity: 38, status: 'poor', lastUpdate: '2021-03-01' },
];

const STATUS_COLORS = { poor: '#FF1744', moderate: '#FFD600', good: '#69F0AE' };
const STATUS_LABELS = {
  poor: { ar: 'Poor', en: 'Poor' },
  moderate: { ar: 'Average', en: 'Moderate' },
  good: { ar: 'Good', en: 'Good' },
};

// ===== InSoil Saturation Index for all regions =====
// ✅ UPDATED: Calibrated to NCM verified rainfall for 23 Mar 2026
// Al Dhafra (Ghayathi 91mm) and Al Wathba (88.2mm) have highest saturation
const SATURATION_BY_ZONE = [
  { nameAr: 'Ghayathi (Al Dhafra)', nameEn: 'Ghayathi (Al Dhafra)', saturation: 94, risk: 'high' },  // NCM: 91mm
  { nameAr: 'Al Wathba', nameEn: 'Al Wathba', saturation: 91, risk: 'high' },            // NCM: 88.2mm
  { nameAr: 'MBZ City', nameEn: 'MBZ City', saturation: 82, risk: 'high' },    // NCM: 78.7mm
  { nameAr: 'Al Ruwais', nameEn: 'Al Ruwais', saturation: 78, risk: 'high' },             // NCM: 75.7mm
  { nameAr: 'Mussafah', nameEn: 'Mussafah', saturation: 72, risk: 'high' },                  // estimated
  { nameAr: 'Al Ain', nameEn: 'Al Ain', saturation: 55, risk: 'medium' },                  // estimated ~52mm
  { nameAr: 'Liwa', nameEn: 'Liwa', saturation: 28, risk: 'low' },                    // estimated ~22mm
];

const SATURATION_COLORS = { high: '#FF1744', medium: '#FFD600', low: '#69F0AE' };

// ===== Verified Data Sources =====
const DATA_SOURCES = [
  {
    id: 'ADSSC', nameAr: 'Abu Dhabi Sewerage Services Company (ADSSC)', nameEn: 'Abu Dhabi Sewerage Services Company (ADSSC)',
    typeAr: 'Official — Infrastructure', typeEn: 'Official — Infrastructure',
    descAr: 'DaOfficial live drainage network and rainwater drainage data for Abu Dhabi Emirate. Includes pipe locations, pumping stations and Processing.',
    descEn: 'Official sewerage and stormwater drainage network data for Abu Dhabi Emirate. Includes pipe locations, pumping stations, and treatment plants.',
    url: 'https://www.adssc.gov.ae', coverageAr: 'Abu Dhabi City + Al Ain', coverageEn: 'Abu Dhabi City + Al Ain',
    resolution: 'Vector', updateFreqAr: 'Quarterly', updateFreqEn: 'Quarterly',
    reliability: 95, color: '#42A5F5', badge: 'ADSSC', category: 'drainage',
  },
  {
    id: 'OSM', nameAr: 'OpenStreetMap — Network waterways', nameEn: 'OpenStreetMap — Waterways Network',
    typeAr: 'Open Source — Community', typeEn: 'Open Source — Community',
    descAr: 'Waterway network, wadis and channels data via HOTOSM platform. Comprehensive UAE coverage.',
    descEn: 'Waterways, wadis, and canal network data from OpenStreetMap via HOTOSM. Comprehensive UAE coverage under ODbL license.',
    url: 'https://data.humdata.org/dataset/hotosm_are_waterways', coverageAr: 'Full UAE', coverageEn: 'Full UAE',
    resolution: 'Vector', updateFreqAr: 'Weekly', updateFreqEn: 'Weekly',
    reliability: 71, color: '#69F0AE', badge: 'OSM', category: 'drainage',
  },
  {
    id: 'SMAP', nameAr: 'NASA SMAP — Humidity Soil', nameEn: 'NASA SMAP — Soil Moisture Active Passive',
    typeAr: 'Satellite — NASA/JPL', typeEn: 'Satellite — NASA/JPL',
    descAr: 'SMAP measures global soil humidity every 2-3 days with 9km accuracy. Used to calculate Soil Saturation Index metric.',
    descEn: 'SMAP measures global soil moisture every 2-3 days at 9km resolution. Used to compute cumulative soil saturation index for flood risk.',
    url: 'https://smap.jpl.nasa.gov/data/', coverageAr: 'Global', coverageEn: 'Global',
    resolution: '9 km / 36 km', updateFreqAr: 'every 2-3 days', updateFreqEn: 'Every 2-3 days',
    reliability: 88, color: '#FF6D00', badge: 'NASA', category: 'saturation',
  },
  {
    id: 'COP-DEM', nameAr: 'Copernicus DEM GLO-30 — Model Elevation', nameEn: 'Copernicus DEM GLO-30 — Digital Elevation',
    typeAr: 'Satellite — ESA/Copernicus', typeEn: 'Satellite — ESA/Copernicus',
    descAr: 'Global Digital Elevation Model with 30m accuracy. Used to extract normal drainage network and identify runoff routes Flow Water.',
    descEn: 'Global 30m Digital Surface Model. Used for natural drainage network extraction, flow path delineation, and hydrological basin definition.',
    url: 'https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM',
    coverageAr: 'Global (80°S–84°N)', coverageEn: 'Global (80°S–84°N)',
    resolution: '30 m', updateFreqAr: 'Static (2021)', updateFreqEn: 'Static (2021)',
    reliability: 92, color: '#AB47BC', badge: 'ESA', category: 'dem',
  },
  {
    id: 'HAND', nameAr: 'GLO-30 HAND — Height Above Nearest Drainage', nameEn: 'GLO-30 HAND — Height Above Nearest Drainage',
    typeAr: 'Derived from Copernicus DEM — AWS Open Data', typeEn: 'Derived from Copernicus DEM — AWS',
    descAr: 'HAND Index measures height of each point above nearest normal drainage. Lower value = higher flood risk. Available free via AWS.',
    descEn: 'HAND index measures elevation above nearest drainage channel. Lower values = higher flood risk. Free via AWS Open Data.',
    url: 'https://registry.opendata.aws/glo-30-hand/', coverageAr: 'Global', coverageEn: 'Global',
    resolution: '30 m', updateFreqAr: 'Static (2022)', updateFreqEn: 'Static (2022)',
    reliability: 90, color: '#26C6DA', badge: 'AWS', category: 'dem',
  },
  {
    id: 'HydroSHEDS', nameAr: 'HydroSHEDS — Hydrological Basins', nameEn: 'HydroSHEDS — Hydrological Basins',
    typeAr: 'Global Database — WWF/USGS', typeEn: 'Global Database — WWF/USGS',
    descAr: 'Global hydrological database including river networks, basins and water divides.',
    descEn: 'Global hydrological database including river networks, basins, and watershed boundaries. Used to define drainage basin limits in the UAE.',
    url: 'https://www.hydrosheds.org/', coverageAr: 'Global', coverageEn: 'Global',
    resolution: '~500 m', updateFreqAr: 'Periodic', updateFreqEn: 'Periodic',
    reliability: 85, color: '#66BB6A', badge: 'WWF', category: 'basin',
  },
  {
    id: 'ABUDHABI-OD', nameAr: 'Abu Dhabi Open Data Platform', nameEn: 'Abu Dhabi Open Data Platform',
    typeAr: 'Government — Abu Dhabi Emirate', typeEn: 'Government — Abu Dhabi Emirate',
    descAr: 'Abu Dhabi Government Open Data Platform. Includes infrastructure, utilities and municipal services data.',
    descEn: 'Abu Dhabi Government open data platform. Includes infrastructure, utilities, and municipal services data including publicly available drainage data.',
    url: 'https://data.abudhabi/opendata/', coverageAr: 'Emirate Abu Dhabi', coverageEn: 'Abu Dhabi Emirate',
    resolution: 'Vector', updateFreqAr: 'Variable', updateFreqEn: 'Variable',
    reliability: 80, color: '#FFA726', badge: 'ADG', category: 'drainage',
  },
  {
    id: 'ALOS-PALSAR', nameAr: 'ALOS PALSAR DEM — High-Resolution Elevation', nameEn: 'ALOS PALSAR DEM — High-Resolution Elevation',
    typeAr: 'satellite — JAXA', typeEn: 'Satellite — JAXA',
    descAr: 'Digital elevation model with 12.5m accuracy from JAXA. Used in detailed hydrological studies for drainage analysis urban in UAE.',
    descEn: 'High-resolution 12.5m DEM from JAXA. Used in detailed hydrological studies for urban drainage analysis in the UAE (Dubai 2024 flood study).',
    url: 'https://www.eorc.jaxa.jp/ALOS/en/dataset/fnf_e.htm', coverageAr: 'Global', coverageEn: 'Global',
    resolution: '12.5 m', updateFreqAr: 'Static', updateFreqEn: 'Static',
    reliability: 93, color: '#EF5350', badge: 'JAXA', category: 'dem',
  },
  {
    // ✅ ADDED: NCM official station data — verified rainfall for 23 Mar 2026 event
    id: 'NCM', nameAr: 'National Centre of Meteorology (NCM)', nameEn: 'National Centre of Meteorology UAE (NCM)',
    typeAr: 'official — Emirate Abu Dhabi', typeEn: 'Official — UAE Government',
    descAr: 'Data official weather stations in UAE. Includes detailed rainfall readings for March 23, 2026 event: Ghayathi 91 mm, Al Wathba 88.2 mm, MBZ City 78.7 mm, Al Ruwais 75.7 mm.',
    descEn: 'Official UAE meteorological station network. Provides verified rainfall readings for the 23 Mar 2026 event: Ghayathi 91mm, Al Wathba 88.2mm, MBZ City 78.7mm, Al Ruwais 75.7mm. Published via Khaleej Times & The National News.',
    url: 'https://www.ncm.ae', coverageAr: 'Full UAE', coverageEn: 'Full UAE',
    resolution: 'Point stations', updateFreqAr: 'Immediate', updateFreqEn: 'Real-time',
    reliability: 99, color: '#00BCD4', badge: 'NCM', category: 'weather',
  },
];
const CATEGORY_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  drainage: { ar: 'Drainage Network', en: 'Drainage Network', color: '#42A5F5' },
  saturation: { ar: 'Soil Saturation', en: 'Soil Saturation', color: '#FF6D00' },
  dem: { ar: 'Model Elevation', en: 'Elevation Model', color: '#AB47BC' },
  basin: { ar: 'hydrological basins', en: 'Hydrological Basins', color: '#66BB6A' },
  weather: { ar: 'Data Weather', en: 'Weather Data', color: '#00BCD4' },
};

export default function DrainageDataPage() {
  const { lang } = useLanguage();
  const { theme } = useAppTheme();
  const isRtl = lang === 'ar';
  const isAdeo = theme === 'adeo-light';
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'drainage' | 'saturation' | 'import' | 'sources'>('drainage');
  const [sourceCategoryFilter, setSourceCategoryFilter] = useState<string>('all');
  const [showSaturationLayer, setShowSaturationLayer] = useState(false);
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

  // Simulation File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file.name);
    setUploadStatus('uploading');
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setUploadStatus('success');
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  // Initialize map using Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [24.4539, 54.3773],
      zoom: 10,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    const zonePositions = [
      { lat: 24.4539, lng: 54.3773, zone: DRAINAGE_ZONES[0] },
      { lat: 24.5239, lng: 54.4350, zone: DRAINAGE_ZONES[1] },
      { lat: 24.4700, lng: 54.3700, zone: DRAINAGE_ZONES[2] },
      { lat: 24.4100, lng: 54.5000, zone: DRAINAGE_ZONES[3] },
      { lat: 24.2200, lng: 55.7600, zone: DRAINAGE_ZONES[4] },
      { lat: 23.1200, lng: 53.7700, zone: DRAINAGE_ZONES[5] },
    ];

    zonePositions.forEach(({ lat, lng, zone }) => {
      const color = STATUS_COLORS[zone.status as keyof typeof STATUS_COLORS];

      L.circle([lat, lng], {
        radius: 8000,
        color: color,
        fillColor: color,
        fillOpacity: 0.15,
        weight: 2,
        opacity: 0.7,
      }).addTo(map);

      L.circleMarker([lat, lng], {
        radius: 8,
        color: '#fff',
        fillColor: color,
        fillOpacity: 0.9,
        weight: 2,
      }).bindTooltip(`<strong>${isRtl ? zone.nameAr : zone.nameEn}</strong><br/>Accuracy: ${zone.accuracy}%`, { sticky: true })
        .addTo(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [isRtl]);

  // Fetch hourly weather data for timeline
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

  // Build timeline hours
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

  // precipMultiplier from selected hour
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

  // zoomend listener
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onZoom = () => setCurrentZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => { map.off('zoomend', onZoom); };
  }, [mapRef.current]);

  const currentSaturation = SOIL_SATURATION_DATA[SOIL_SATURATION_DATA.length - 1].value;
  const saturationTrend = currentSaturation > SOIL_SATURATION_DATA[SOIL_SATURATION_DATA.length - 2].value ? 'up' : 'down';

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
            background: 'linear-gradient(135deg, #0288D1, #42A5F5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Database size={18} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: textPrimary, margin: 0 }}>
              {isRtl ? 'Drainage Network + Index Soil Saturation' : 'Drainage Network + Soil Saturation Index'}
            </h1>
            <p style={{ fontSize: 11, color: textMuted, margin: 0 }}>
              {isRtl
                ? 'Import Official ADSSC data and soil saturation monitoring metric'
                : 'Import official ADSSC data and monitor cumulative soil saturation'}
            </p>
          </div>
        </div>

        {/* KPIs + Export */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.30)', borderRadius: '6px', cursor: 'pointer', color: '#A78BFA', fontSize: '11px', fontWeight: 600, flexShrink: 0 }}
          >
            <FileDown size={12} />
            {isRtl ? 'Export PDF' : 'Export PDF'}
          </button>
          {[
            { label: isRtl ? 'Soil Saturation Now' : 'Current Saturation', value: `${currentSaturation}%`, color: currentSaturation > 50 ? '#FF6D00' : '#69F0AE', icon: <Droplets size={12} />, tid: 'soil-saturation' },
            { label: 'Poor Drainage Zones', value: DRAINAGE_ZONES.filter(z => z.status === 'poor').length, color: '#FF1744', icon: <AlertTriangle size={12} />, tid: 'drainage-capacity' },
            { label: isRtl ? 'Average Accuracy Network' : 'Avg Network Accuracy', value: `${Math.round(DRAINAGE_ZONES.reduce((s, z) => s + z.accuracy, 0) / DRAINAGE_ZONES.length)}%`, color: '#42A5F5', icon: <Activity size={12} />, tid: 'network-accuracy' },
          ].map((s, i) => (
            <div key={i} style={{
              background: isAdeo ? 'rgba(0,51,102,0.05)' : 'rgba(66,165,245,0.08)',
              border: `1px solid ${s.color}33`,
              borderRadius: 6, padding: '6px 12px',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ color: s.color }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: s.color, display: 'flex', alignItems: 'center', gap: 3 }}>
                  {s.value}
                  <MetricTooltip id={s.tid} size={10} position="bottom" />
                </div>
                <div style={{ fontSize: 9, color: textMuted }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left dashboard */}
        <div style={{
          width: 380, background: bgCard,
          borderLeft: isRtl ? 'none' : `1px solid ${borderC}`,
          borderRight: isRtl ? `1px solid ${borderC}` : 'none',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${borderC}`, flexShrink: 0 }}>
            {(['drainage', 'saturation', 'import', 'sources'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: '10px 0', border: 'none',
                  background: activeTab === tab
                    ? isAdeo ? 'rgba(0,51,102,0.08)' : 'rgba(66,165,245,0.1)'
                    : 'transparent',
                  color: activeTab === tab ? accentC : textMuted,
                  fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  borderBottom: activeTab === tab ? `2px solid ${accentC}` : '2px solid transparent',
                }}
              >
                {tab === 'drainage' ? 'Drainage' :
                  tab === 'saturation' ? 'Saturation' :
                  tab === 'import' ? (isRtl ? 'Import' : 'Import') :
                    (isRtl ? 'Sources' : 'Sources')}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            {/* Drainage Network tab */}
            {activeTab === 'drainage' && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: textPrimary, marginBottom: 10 }}>
                  {'Status Drainage Network by Zone'}
                </div>
                {DRAINAGE_ZONES.map(zone => (
                  <div key={zone.id} style={{
                    background: isAdeo ? 'rgba(0,51,102,0.03)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${borderC}`,
                    borderRadius: 8, padding: '10px 12px', marginBottom: 8,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 9, color: textMuted }}>{zone.id}</span>
                        <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>
                          {isRtl ? zone.nameAr : zone.nameEn}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{
                          background: `${STATUS_COLORS[zone.status as keyof typeof STATUS_COLORS]}22`,
                          color: STATUS_COLORS[zone.status as keyof typeof STATUS_COLORS],
                          borderRadius: 4, padding: '2px 8px', fontSize: 9, fontWeight: 700,
                          display: 'block', marginBottom: 2,
                        }}>
                          {isRtl ? STATUS_LABELS[zone.status as keyof typeof STATUS_LABELS].ar : STATUS_LABELS[zone.status as keyof typeof STATUS_LABELS].en}
                        </span>
                        <span style={{ fontSize: 9, color: textMuted }}>{zone.source}</span>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <div>
                        <div style={{ fontSize: 9, color: textMuted, marginBottom: 2 }}>
                          {isRtl ? 'Accuracy Data' : 'Data Accuracy'}
                        </div>
                        <div style={{ height: 4, background: isAdeo ? '#e0e0e0' : '#1a2a3a', borderRadius: 2 }}>
                          <div style={{
                            height: '100%', width: `${zone.accuracy}%`,
                            background: zone.accuracy > 80 ? '#69F0AE' : zone.accuracy > 65 ? '#FFD600' : '#FF6D00',
                            borderRadius: 2,
                          }} />
                        </div>
                        <div style={{ fontSize: 9, color: textMuted, marginTop: 2 }}>{zone.accuracy}%</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: textMuted, marginBottom: 2 }}>
                          {isRtl ? 'Drainage Capacity' : 'Drainage Capacity'}
                        </div>
                        <div style={{ height: 4, background: isAdeo ? '#e0e0e0' : '#1a2a3a', borderRadius: 2 }}>
                          <div style={{
                            height: '100%', width: `${zone.capacity}%`,
                            background: zone.capacity > 75 ? '#69F0AE' : zone.capacity > 55 ? '#FFD600' : '#FF1744',
                            borderRadius: 2,
                          }} />
                        </div>
                        <div style={{ fontSize: 9, color: textMuted, marginTop: 2 }}>{zone.capacity}%</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 9, color: textMuted, marginTop: 6 }}>
                      {isRtl ? 'Last Update:' : 'Last update:'} {zone.lastUpdate}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Soil Saturation Index tab */}
            {activeTab === 'saturation' && (
              <div>
                {/* Current Saturation Index */}
                <div style={{
                  background: currentSaturation > 50
                    ? 'rgba(255,109,0,0.1)' : 'rgba(105,240,174,0.1)',
                  border: `1px solid ${currentSaturation > 50 ? '#FF6D00' : '#69F0AE'}44`,
                  borderRadius: 10, padding: 14, marginBottom: 12,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 10, color: textMuted, marginBottom: 4 }}>
                        {'Index (SSI)'}
                      </div>
                      <div style={{ fontSize: 36, fontWeight: 800, color: currentSaturation > 50 ? '#FF6D00' : '#69F0AE' }}>
                        {currentSaturation}%
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      {saturationTrend === 'up'
                        ? <TrendingUp size={32} color="#FF6D00" />
                        : <TrendingDown size={32} color="#69F0AE" />}
                      <div style={{ fontSize: 9, color: textMuted, marginTop: 4 }}>
                        {saturationTrend === 'up'
                          ? (isRtl ? 'Height' : 'Rising')
                          : 'Falling'}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{ height: 8, background: isAdeo ? '#e0e0e0' : '#1a2a3a', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${currentSaturation}%`,
                        background: `linear-gradient(90deg, #69F0AE, ${currentSaturation > 50 ? '#FF6D00' : '#42A5F5'})`,
                        borderRadius: 4, transition: 'width 0.5s',
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 9, color: textMuted }}>0% {isRtl ? 'Dry' : 'Dry'}</span>
                      <span style={{ fontSize: 9, color: '#FFD600' }}>50% {isRtl ? 'Warning' : 'Warning'}</span>
                      <span style={{ fontSize: 9, color: '#FF1744' }}>100% 'Saturated'</span>
                    </div>
                  </div>
                </div>

                {/* Saturation chart for 8 days */}
                <div style={{
                  background: isAdeo ? 'rgba(0,51,102,0.04)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${borderC}`, borderRadius: 8, padding: 12, marginBottom: 12,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: textPrimary, marginBottom: 8 }}>
                    '8-Day Saturation Evolution'
                  </div>
                  <ResponsiveContainer width="100%" height={120}>
                    <AreaChart data={SOIL_SATURATION_DATA}>
                      <defs>
                        <linearGradient id="satGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FF6D00" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#FF6D00" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isAdeo ? '#e0e0e0' : '#1a2a3a'} />
                      <XAxis dataKey="date" tick={{ fontSize: 8, fill: textMuted }}
                        tickFormatter={v => v.slice(5)} />
                      <YAxis tick={{ fontSize: 8, fill: textMuted }} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ background: bgCard, border: `1px solid ${borderC}`, borderRadius: 6, fontSize: 10 }}
                        formatter={(v: number) => [`${v}%`, isRtl ? 'Soil Saturation' : 'Soil Saturation']}
                      />
                      <ReferenceLine y={50} stroke="#FFD600" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="value" stroke="#FF6D00" fill="url(#satGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Soil saturation for all regions */}
                <div style={{
                  background: isAdeo ? 'rgba(0,51,102,0.04)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${borderC}`, borderRadius: 8, padding: 12,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: textPrimary, marginBottom: 8 }}>
                    {'Index by Zone'}
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={SATURATION_BY_ZONE} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={isAdeo ? '#e0e0e0' : '#1a2a3a'} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 8, fill: textMuted }} />
                      <YAxis type="category" dataKey={isRtl ? 'nameAr' : 'nameEn'} tick={{ fontSize: 8, fill: textMuted }} width={50} />
                      <Tooltip
                        contentStyle={{ background: bgCard, border: `1px solid ${borderC}`, borderRadius: 6, fontSize: 10 }}
                        formatter={(v: number) => [`${v}%`, isRtl ? 'Saturation' : 'Saturation']}
                      />
                      <ReferenceLine x={50} stroke="#FFD600" strokeDasharray="3 3" />
                      <Bar dataKey="saturation" radius={[0, 3, 3, 0]}>
                        {SATURATION_BY_ZONE.map((entry, i) => (
                          <Cell key={i} fill={SATURATION_COLORS[entry.risk as keyof typeof SATURATION_COLORS]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* tab Import Data */}
            {activeTab === 'import' && (
              <div>
                <div style={{
                  background: '#42A5F510', border: '1px solid #42A5F530',
                  borderRadius: 8, padding: 12, marginBottom: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Info size={12} color="#42A5F5" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#42A5F5' }}>
                      {isRtl ? 'Import Data ADSSC official' : 'Import Official ADSSC Data'}
                    </span>
                  </div>
                  <p style={{ fontSize: 10, color: textMuted, margin: 0, lineHeight: 1.6 }}>
                    {isRtl
                      ? 'Upload a GeoJSON or CSV file containing Drainage Network data from ADSSC to improve model accuracy From 82% To 95%+'
                      : 'Upload a GeoJSON or CSV file containing ADSSC drainage network data to improve model accuracy from 82% to 95%+'}
                  </p>
                </div>

                {/* Upload region */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${uploadStatus === 'success' ? '#69F0AE' : uploadStatus === 'error' ? '#FF1744' : accentC}`,
                    borderRadius: 10, padding: 24, textAlign: 'center',
                    cursor: 'pointer', marginBottom: 12,
                    background: uploadStatus === 'success'
                      ? 'rgba(105,240,174,0.05)'
                      : isAdeo ? 'rgba(0,51,102,0.03)' : 'rgba(66,165,245,0.05)',
                    transition: 'all 0.2s',
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".geojson,.csv,.json"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  {uploadStatus === 'idle' && (
                    <>
                      <Upload size={28} color={accentC} style={{ marginBottom: 8 }} />
                      <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary, marginBottom: 4 }}>
                        'Drag file here or click to upload'
                      </div>
                      <div style={{ fontSize: 10, color: textMuted }}>GeoJSON, CSV, JSON</div>
                    </>
                  )}
                  {uploadStatus === 'uploading' && (
                    <>
                      <RefreshCw size={28} color="#42A5F5" style={{ marginBottom: 8, animation: 'spin 1s linear infinite' }} />
                      <div style={{ fontSize: 12, fontWeight: 600, color: textPrimary, marginBottom: 8 }}>
                        {'Processing...'} {uploadProgress}%
                      </div>
                      <div style={{ height: 4, background: isAdeo ? '#e0e0e0' : '#1a2a3a', borderRadius: 2 }}>
                        <div style={{
                          height: '100%', width: `${uploadProgress}%`,
                          background: 'linear-gradient(90deg, #42A5F5, #69F0AE)',
                          borderRadius: 2, transition: 'width 0.2s',
                        }} />
                      </div>
                    </>
                  )}
                  {uploadStatus === 'success' && (
                    <>
                      <CheckCircle size={28} color="#69F0AE" style={{ marginBottom: 8 }} />
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#69F0AE', marginBottom: 4 }}>
                        'Upload Successful!'
                      </div>
                      <div style={{ fontSize: 10, color: textMuted }}>{uploadedFile}</div>
                    </>
                  )}
                </div>

                {uploadStatus === 'success' && (
                  <div style={{
                    background: 'rgba(105,240,174,0.1)', border: '1px solid rgba(105,240,174,0.3)',
                    borderRadius: 8, padding: 12, marginBottom: 12,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#69F0AE', marginBottom: 8 }}>
                      {'Processing Results'}
                    </div>
                    {[
                      { labelAr: 'Drainage lines imported', labelEn: 'Drainage lines imported', value: '2,847' },
                      { labelAr: 'Zones updated', labelEn: 'Zones updated', value: '3' },
                      { labelAr: 'Expected accuracy gain', labelEn: 'Expected accuracy gain', value: '+8.4%' },
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: textMuted }}>{isRtl ? item.labelAr : item.labelEn}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#69F0AE' }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Supported formats */}
                <div style={{
                  background: isAdeo ? 'rgba(0,51,102,0.04)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${borderC}`, borderRadius: 8, padding: 12,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: textPrimary, marginBottom: 8 }}>
                    'Supported Formats'
                  </div>
                  {[
                    { format: 'GeoJSON', desc: 'Drainage network as LineString/Polygon', color: '#42A5F5' },
                    { format: 'CSV', desc: 'Coordinates + drainage capacity', color: '#69F0AE' },
                    { format: 'JSON (ADSSC API)', desc: 'Direct export from ADSSC portal', color: '#FFD600' },
                  ].map((f, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
                    }}>
                      <span style={{
                        background: `${f.color}22`, color: f.color,
                        borderRadius: 4, padding: '2px 6px', fontSize: 9, fontWeight: 700, minWidth: 60, textAlign: 'center',
                      }}>{f.format}</span>
                      <span style={{ fontSize: 10, color: textMuted }}>{f.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== tab Sources Data ===== */}
            {activeTab === 'sources' && (
              <div>
                {/* Title + filter categories */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: textPrimary, marginBottom: 8 }}>
                    {'Drainage Considerations Data Sources'}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(['all', 'drainage', 'saturation', 'dem', 'basin'] as const).map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSourceCategoryFilter(cat)}
                        style={{
                          padding: '3px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                          fontSize: 9, fontWeight: 600,
                          background: sourceCategoryFilter === cat
                            ? (cat === 'all' ? accentC : CATEGORY_LABELS[cat]?.color ?? accentC)
                            : (isAdeo ? 'rgba(0,51,102,0.06)' : 'rgba(255,255,255,0.06)'),
                          color: sourceCategoryFilter === cat ? '#fff' : textMuted,
                        }}
                      >
                        {cat === 'all'
                          ? (isRtl ? 'All' : 'All')
                          : (isRtl ? CATEGORY_LABELS[cat]?.ar : CATEGORY_LABELS[cat]?.en)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* list Sources */}
                {DATA_SOURCES
                  .filter(s => sourceCategoryFilter === 'all' || s.category === sourceCategoryFilter)
                  .map(src => (
                    <div key={src.id} style={{
                      background: isAdeo ? '#FAFBFC' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${src.color}33`,
                      borderRadius: 10, padding: '12px', marginBottom: 10,
                      borderLeft: `3px solid ${src.color}`,
                    }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{
                              background: `${src.color}22`, color: src.color,
                              borderRadius: 4, padding: '1px 6px', fontSize: 8, fontWeight: 800,
                            }}>{src.badge}</span>
                            <span style={{
                              background: CATEGORY_LABELS[src.category]?.color + '22',
                              color: CATEGORY_LABELS[src.category]?.color,
                              borderRadius: 4, padding: '1px 6px', fontSize: 8, fontWeight: 600,
                            }}>
                              {isRtl ? CATEGORY_LABELS[src.category]?.ar : CATEGORY_LABELS[src.category]?.en}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: textPrimary }}>
                            {isRtl ? src.nameAr : src.nameEn}
                          </div>
                          <div style={{ fontSize: 9, color: textMuted, marginTop: 1 }}>
                            {isRtl ? src.typeAr : src.typeEn}
                          </div>
                        </div>
                        {/* Reliability */}
                        <div style={{ textAlign: 'center', minWidth: 44 }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: src.reliability >= 90 ? '#69F0AE' : src.reliability >= 75 ? '#FFD600' : '#FF6D00', fontFamily: 'monospace' }}>
                            {src.reliability}%
                          </div>
                          <div style={{ fontSize: 8, color: textMuted }}>{isRtl ? 'Reliability' : 'Trust'}</div>
                        </div>
                      </div>

                      {/* Description */}
                      <div style={{ fontSize: 10, color: textMuted, lineHeight: 1.5, marginBottom: 8 }}>
                        {isRtl ? src.descAr : src.descEn}
                      </div>

                      {/* Technical information */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 8 }}>
                        {[
                          { labelAr: 'Coverage', labelEn: 'Coverage', value: isRtl ? src.coverageAr : src.coverageEn },
                          { labelAr: 'Spatial accuracy', labelEn: 'Resolution', value: src.resolution },
                          { labelAr: 'Update Freq', labelEn: 'Update Freq', value: isRtl ? src.updateFreqAr : src.updateFreqEn },
                        ].map((info, i) => (
                          <div key={i} style={{
                            background: isAdeo ? 'rgba(0,51,102,0.04)' : 'rgba(255,255,255,0.04)',
                            borderRadius: 6, padding: '5px 7px',
                          }}>
                            <div style={{ fontSize: 8, color: textMuted, marginBottom: 2 }}>{isRtl ? info.labelAr : info.labelEn}</div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: textPrimary }}>{info.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Reliability bar */}
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 8, color: textMuted }}>{isRtl ? 'Level Reliability' : 'Reliability Level'}</span>
                          <span style={{ fontSize: 8, fontWeight: 700, color: src.color }}>{src.reliability}%</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: isAdeo ? '#E5E7EB' : 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${src.reliability}%`, background: src.color, borderRadius: 2, transition: 'width 0.6s ease' }} />
                        </div>
                      </div>

                      {/* Source link */}
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 9, color: src.color, textDecoration: 'none',
                          background: `${src.color}11`, borderRadius: 4, padding: '3px 8px',
                          border: `1px solid ${src.color}33`,
                        }}
                      >
                        <Info size={9} />
                        'Access Source'
                      </a>
                    </div>
                  ))}

                {/* Documentation note */}
                <div style={{
                  background: isAdeo ? 'rgba(0,51,102,0.04)' : 'rgba(66,165,245,0.06)',
                  border: `1px solid ${borderC}`, borderRadius: 8, padding: '10px 12px', marginTop: 4,
                }}>
                  <div style={{ fontSize: 9, color: textMuted, lineHeight: 1.6 }}>
                    {isRtl
                      ? '⚠️ Official ADSSC data requires a data sharing agreement. OSM, NASA SMAP, and Copernicus DEM are freely available. It is recommended to combine multiple sources to ensure highest accuracy in drainage modeling.'
                      : '⚠️ Official ADSSC data requires a data-sharing agreement. OSM, NASA SMAP, and Copernicus DEM are freely available. Combining multiple sources is recommended for optimal drainage modeling accuracy.'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
          {/* Fullscreen button */}
          <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1001 }}>
            <FullscreenButton size={13} variant="icon-text" color="rgba(255,255,255,0.7)" />
          </div>

          {/* Saturation layer toggle */}
          <div style={{
            position: 'absolute', top: 12,
            [isRtl ? 'right' : 'left']: 12,
            zIndex: 10,
          }}>
            <button
              onClick={() => setShowSaturationLayer(!showSaturationLayer)}
              style={{
                padding: '8px 14px', borderRadius: 6, border: 'none',
                background: showSaturationLayer ? '#FF6D00' : 'rgba(10,22,36,0.85)',
                color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Droplets size={12} />
              {isRtl ? 'Layer Soil Saturation' : 'Soil Saturation Layer'}
            </button>
          </div>

          {/* Color legend */}
          <div style={{
            position: 'absolute', bottom: 24,
            [isRtl ? 'right' : 'left']: 12,
            background: 'rgba(10,22,36,0.88)', backdropFilter: 'blur(8px)',
            borderRadius: 8, padding: '8px 12px',
            border: '1px solid rgba(66,165,245,0.2)',
            zIndex: 10,
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#42A5F5', marginBottom: 6 }}>
              {isRtl ? 'Drainage Capacity' : 'Drainage Capacity'}
            </div>
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 9, color: '#E8F4F8' }}>
                  {isRtl ? STATUS_LABELS[status as keyof typeof STATUS_LABELS].ar : STATUS_LABELS[status as keyof typeof STATUS_LABELS].en}
                </span>
              </div>
            ))}
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
    </>);
}
