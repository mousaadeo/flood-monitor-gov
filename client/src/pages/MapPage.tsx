// MapPage — FloodSat AI Abu Dhabi
// Multi-layer interactive map: Water Bodies + Contour + Evacuation + Traffic Analysis
// Design: Institutional Light — professional GIS-style layer management
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { alertLevelConfig } from '@/data/mockData';
import {
  Layers, ZoomIn, ZoomOut, MapPin, Eye, EyeOff,
  Droplets, Mountain, AlertTriangle, Car, ChevronDown, ChevronUp,
  TrendingDown, TrendingUp, Minus, Activity, FileDown
} from 'lucide-react';

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1: FLOOD WATER BODIES
// ─────────────────────────────────────────────────────────────────────────────
const floodWaterBodies = [
  { id: 'mussafah-1', nameAr: 'Mussafah Industrial — M1-M5', zone: 'Mussafah', level: 'critical' as const, depth: '1.2 m', area: '4.8 km²', cause: 'Severe depression + industrial drainage network blockage', coords: [[24.335,54.490],[24.350,54.510],[24.348,54.530],[24.330,54.525],[24.325,54.505]] as [number,number][] },
  { id: 'mussafah-2', nameAr: 'Mussafah Industrial — M6-M10', zone: 'Mussafah', level: 'critical' as const, depth: '0.9 m', area: '3.2 km²', cause: 'Flood Wadi Mussafah + weak infrastructure', coords: [[24.320,54.530],[24.335,54.550],[24.330,54.570],[24.310,54.565],[24.305,54.540]] as [number,number][] },
  { id: 'mussafah-channel', nameAr: 'Mussafah Channel — Surrounding Regions', zone: 'Mussafah', level: 'warning' as const, depth: '0.6 m', area: '2.1 km²', cause: 'Mussafah Channel overflow during heavy rain', coords: [[24.360,54.470],[24.370,54.490],[24.365,54.510],[24.345,54.505],[24.340,54.480]] as [number,number][] },
  { id: 'khalifa-a', nameAr: 'Khalifa City A — Main Streets', zone: 'Khalifa City', level: 'warning' as const, depth: '0.5 m', area: '2.8 km²', cause: 'Weak drainage network in residential areas', coords: [[24.405,54.580],[24.420,54.600],[24.415,54.625],[24.395,54.620],[24.390,54.595]] as [number,number][] },
  { id: 'khalifa-b', nameAr: 'Khalifa City B — Low-lying Areas', zone: 'Khalifa City', level: 'watch' as const, depth: '0.3 m', area: '1.5 km²', cause: 'Water accumulation in new residential neighborhoods', coords: [[24.380,54.630],[24.395,54.650],[24.390,54.670],[24.370,54.665],[24.365,54.640]] as [number,number][] },
  { id: 'wathba-mbz', nameAr: 'Al Wathba — Mohammed bin Zayed City', zone: 'Khalifa City', level: 'warning' as const, depth: '0.55 m', area: '4.2 km²', cause: 'Flat terrain + recent urban development without adequate drainage', coords: [[24.310,54.750],[24.330,54.780],[24.325,54.810],[24.300,54.805],[24.295,54.770]] as [number,number][] },
  { id: 'shahama-n', nameAr: 'Al Shahama — Northern Part', zone: 'Al Shahama', level: 'watch' as const, depth: '0.3 m', area: '1.8 km²', cause: 'Incomplete drainage channels in new neighborhoods', coords: [[24.530,54.420],[24.545,54.440],[24.540,54.465],[24.520,54.460],[24.515,54.435]] as [number,number][] },
  { id: 'shahama-s', nameAr: 'Al Shahama — Southern Part', zone: 'Al Shahama', level: 'watch' as const, depth: '0.25 m', area: '1.2 km²', cause: 'Water accumulation in agricultural regions', coords: [[24.505,54.410],[24.520,54.430],[24.515,54.450],[24.495,54.445],[24.490,54.420]] as [number,number][] },
  { id: 'ruwais-ind', nameAr: 'Al Ruwais — Industrial Area', zone: 'Al Ruwais', level: 'critical' as const, depth: '0.8 m', area: '5.2 km²', cause: 'Flat terrain + heavy rain on western region', coords: [[24.100,52.720],[24.120,52.750],[24.115,52.780],[24.090,52.775],[24.085,52.740]] as [number,number][] },
  { id: 'ruwais-res', nameAr: 'Al Ruwais — Residential Neighborhood', zone: 'Al Ruwais', level: 'warning' as const, depth: '0.4 m', area: '1.6 km²', cause: 'Water accumulation in workers residential neighborhoods', coords: [[24.120,52.700],[24.135,52.720],[24.130,52.740],[24.110,52.735],[24.105,52.710]] as [number,number][] },
  { id: 'wadi-jiimi', nameAr: 'Wadi Al Jimi — Al Ain', zone: 'Al Ain', level: 'critical' as const, depth: '2.4 m', area: '8.5 km²', cause: 'Main wadi flood — highest risk in the emirate', coords: [[24.220,55.650],[24.260,55.720],[24.240,55.780],[24.190,55.750],[24.180,55.680]] as [number,number][] },
  { id: 'ain-industrial', nameAr: 'Industrial Area — Al Ain', zone: 'Al Ain', level: 'warning' as const, depth: '0.6 m', area: '2.3 km²', cause: 'Water accumulation in southern industrial area', coords: [[24.150,55.720],[24.170,55.750],[24.165,55.780],[24.140,55.775],[24.135,55.740]] as [number,number][] },
  { id: 'zayed-city', nameAr: 'Zayed City — Western Side', zone: 'Zayed City', level: 'warning' as const, depth: '0.7 m', area: '3.5 km²', cause: 'Low terrain + lack of adequate drainage network', coords: [[24.280,54.720],[24.300,54.745],[24.295,54.770],[24.270,54.765],[24.265,54.735]] as [number,number][] },
  { id: 'ad-corniche', nameAr: 'Region Corniche — Abu Dhabi', zone: 'Abu Dhabi City', level: 'warning' as const, depth: '0.4 m', area: '1.2 km²', cause: 'Coastal depression + weak coastal drainage', coords: [[24.487,54.334],[24.489,54.352],[24.485,54.360],[24.481,54.354],[24.482,54.338]] as [number,number][] },
  { id: 'between-ad-mussafah', nameAr: 'Region between Abu Dhabi and Mussafah', zone: 'Mussafah', level: 'warning' as const, depth: '0.45 m', area: '3.1 km²', cause: 'Low terrain between two bridges — frequent water accumulation', coords: [[24.390,54.440],[24.405,54.460],[24.400,54.485],[24.380,54.480],[24.375,54.455]] as [number,number][] },
];

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2: CONTOUR / ELEVATION (simulated from SRTM data)
// ─────────────────────────────────────────────────────────────────────────────
const contourLines = [
  // Abu Dhabi city area — very flat near sea
  { id: 'c-ad-5', elev: 5, color: '#3B82F6', coords: [[24.50,54.28],[24.48,54.40],[24.46,54.50],[24.44,54.60]] as [number,number][] },
  { id: 'c-ad-10', elev: 10, color: '#2563EB', coords: [[24.52,54.26],[24.50,54.38],[24.48,54.52],[24.46,54.65]] as [number,number][] },
  { id: 'c-muss-15', elev: 15, color: '#1D4ED8', coords: [[24.40,54.42],[24.38,54.52],[24.36,54.62],[24.34,54.72]] as [number,number][] },
  { id: 'c-khalifa-20', elev: 20, color: '#1E40AF', coords: [[24.42,54.55],[24.40,54.65],[24.38,54.75],[24.36,54.85]] as [number,number][] },
  // Shahama area — slightly higher
  { id: 'c-shah-25', elev: 25, color: '#1E3A8A', coords: [[24.55,54.35],[24.53,54.45],[24.51,54.55]] as [number,number][] },
  // Al Ain area — higher elevation
  { id: 'c-ain-50', elev: 50, color: '#14532D', coords: [[24.30,55.60],[24.25,55.70],[24.20,55.80]] as [number,number][] },
  { id: 'c-ain-100', elev: 100, color: '#166534', coords: [[24.28,55.65],[24.23,55.75],[24.18,55.85]] as [number,number][] },
  { id: 'c-ain-200', elev: 200, color: '#15803D', coords: [[24.26,55.70],[24.21,55.80],[24.16,55.90]] as [number,number][] },
  // Hajar mountains foothills
  { id: 'c-hajar-300', elev: 300, color: '#16A34A', coords: [[24.24,55.75],[24.19,55.85],[24.14,55.95]] as [number,number][] },
];

// Elevation zones (polygons with fill color)
const elevationZones = [
  { id: 'ez-sea-level', nameAr: 'Sea Level Region (0-5m)', elev: '0–5 m', color: '#BFDBFE', coords: [[24.50,54.20],[24.48,54.50],[24.44,54.65],[24.40,54.40],[24.42,54.25]] as [number,number][] },
  { id: 'ez-low', nameAr: 'Low Region (5-20m)', elev: '5–20 m', color: '#93C5FD', coords: [[24.52,54.22],[24.50,54.55],[24.46,54.70],[24.42,54.55],[24.44,54.28]] as [number,number][] },
  { id: 'ez-medium', nameAr: 'Medium Region (20-50m)', elev: '20–50 m', color: '#6EE7B7', coords: [[24.38,54.55],[24.36,54.75],[24.32,54.85],[24.28,54.75],[24.30,54.55]] as [number,number][] },
  { id: 'ez-high', nameAr: 'High Region (50-200m)', elev: '50–200 m', color: '#A7F3D0', coords: [[24.28,55.55],[24.24,55.75],[24.18,55.90],[24.12,55.80],[24.16,55.60]] as [number,number][] },
  { id: 'ez-mountain', nameAr: 'Mountain Region (200m+)', elev: '200 m+', color: '#6EE7B7', coords: [[24.22,55.70],[24.18,55.85],[24.12,55.95],[24.08,55.85],[24.12,55.70]] as [number,number][] },
];

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 3: EVACUATION DECISIONS
// ─────────────────────────────────────────────────────────────────────────────
const evacuationZones = [
  { id: 'evac-mussafah', nameAr: 'Mussafah industrial', decision: 'immediate' as const, priority: 1, population: '45,000', routes: ['Mussafah Sheikh Zayed Road', 'Mussafah North Bridge'], reason: 'Water depth 1.2m + infrastructure collapse risk', coords: [[24.320,54.485],[24.355,54.535],[24.350,54.575],[24.300,54.570],[24.295,54.530]] as [number,number][] },
  { id: 'evac-wadi-jiimi', nameAr: 'Wadi Al Jimi — Al Ain', decision: 'immediate' as const, priority: 2, population: '12,000', routes: ['Road Al Ain-Abu Dhabi', 'Al Ain-Dubai Road'], reason: 'Wadi flood with depth 2.4m — fatal risk', coords: [[24.200,55.640],[24.265,55.730],[24.250,55.790],[24.175,55.760],[24.165,55.670]] as [number,number][] },
  { id: 'evac-ruwais', nameAr: 'Al Ruwais industrial', decision: 'immediate' as const, priority: 3, population: '8,500', routes: ['Road Al Ruwais-Abu Dhabi E11'], reason: 'Industrial facilities + water depth 0.8m', coords: [[24.085,52.695],[24.130,52.755],[24.125,52.790],[24.080,52.785],[24.075,52.720]] as [number,number][] },
  { id: 'evac-khalifa-a', nameAr: 'Khalifa City A', decision: 'warning' as const, priority: 4, population: '120,000', routes: ['Khalifa Road', 'Airport Street'], reason: 'Wawater accumulation 0.5m — MonitoContinuous Ring', coords: [[24.385,54.570],[24.425,54.630],[24.420,54.665],[24.380,54.660],[24.375,54.600]] as [number,number][] },
  { id: 'evac-shahama', nameAr: 'Al Shahama', decision: 'warning' as const, priority: 5, population: '35,000', routes: ['Road Al Shahama-Abu Dhabi'], reason: 'Water accumulation 0.3m — Risk Average', coords: [[24.490,54.405],[24.550,54.470],[24.545,54.500],[24.485,54.495],[24.480,54.430]] as [number,number][] },
  { id: 'evac-zayed-city', nameAr: 'Zayed City', decision: 'monitor' as const, priority: 6, population: '85,000', routes: ['Road Abu Dhabi-Al Ain'], reason: 'Monitoring — None Risk Immediate', coords: [[24.260,54.710],[24.305,54.775],[24.300,54.810],[24.255,54.805],[24.250,54.740]] as [number,number][] },
];

const evacStyle = {
  immediate: { fill: '#DC2626', stroke: '#991B1B', label: 'Evacuation Immediate', icon: '🚨' },
  warning:   { fill: '#D97706', stroke: '#92400E', label: 'Warning',       icon: '⚠️' },
  monitor:   { fill: '#0891B2', stroke: '#0E7490', label: 'Monitoring',      icon: '👁️' },
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 4: TRAFFIC DATA — Before / During / After rain
// ─────────────────────────────────────────────────────────────────────────────
const trafficSegments = [
  // Sheikh Zayed Road (E11) — Abu Dhabi section
  {
    id: 'e11-ad',
    nameAr: 'Sheikh Zayed Road — Abu Dhabi',
    coords: [[24.490,54.360],[24.460,54.420],[24.430,54.480],[24.400,54.540]] as [number,number][],
    before: { speed: 120, flow: 'smooth', density: 'low' },
    during: { speed: 35, flow: 'partially stopped', density: 'very high', behavior: 'stop + deviation to sidewalk' },
    after:  { speed: 75, flow: 'recovering', density: 'average' },
    aiInsight: 'depression Speed 71% during rain — drivers stopped under bridges increasing congestion',
  },
  // Mussafah Bridge
  {
    id: 'mussafah-bridge',
    nameAr: 'Bridge Mussafah',
    coords: [[24.380,54.460],[24.360,54.490],[24.340,54.520]] as [number,number][],
    before: { speed: 90, flow: 'smooth', density: 'low' },
    during: { speed: 10, flow: 'Closed partially', density: 'very high', behavior: 'complete stop + reversing' },
    after:  { speed: 45, flow: 'slow', density: 'high' },
    aiInsight: 'Bridge experienced complete stop — water reached right lane — drivers used side road',
  },
  // Khalifa City main road
  {
    id: 'khalifa-main',
    nameAr: 'Main Road — Khalifa City',
    coords: [[24.415,54.590],[24.400,54.620],[24.385,54.650],[24.370,54.680]] as [number,number][],
    before: { speed: 80, flow: 'smooth', density: 'average' },
    during: { speed: 20, flow: 'very slow', density: 'high', behavior: 'slowdown + route change' },
    after:  { speed: 55, flow: 'partially recovering', density: 'average' },
    aiInsight: '75% slowdown — drivers avoided flooded areas via internal streets, overloading secondary network',
  },
  // Shahama highway
  {
    id: 'shahama-highway',
    nameAr: 'Road Al Shahama',
    coords: [[24.520,54.430],[24.505,54.450],[24.490,54.470]] as [number,number][],
    before: { speed: 100, flow: 'smooth', density: 'low' },
    during: { speed: 60, flow: 'relatively normal', density: 'average', behavior: 'light slowdown' },
    after:  { speed: 95, flow: 'smooth', density: 'low' },
    aiInsight: 'Minor impact — road is relatively high above sea level which protected it from accumulation',
  },
  // Al Ain road
  {
    id: 'ain-road',
    nameAr: 'Road Abu Dhabi-Al Ain',
    coords: [[24.350,54.700],[24.310,54.800],[24.270,54.900],[24.230,55.000]] as [number,number][],
    before: { speed: 120, flow: 'smooth', density: 'low' },
    during: { speed: 40, flow: 'slow', density: 'high', behavior: 'stop at accumulation points + deviation' },
    after:  { speed: 85, flow: 'recovering', density: 'low-average' },
    aiInsight: 'Road eexperienced multiple stops at Wadi Al Jimi intersections — drift risk at 3 points',
  },
];

const trafficColor = (speed: number) => {
  if (speed >= 90) return '#16A34A'; // green — free flow
  if (speed >= 60) return '#CA8A04'; // yellow — slow
  if (speed >= 30) return '#EA580C'; // orange — very slow
  return '#DC2626'; // red — stopped
};

const levelStyle = {
  critical: { fill: '#B91C1C', stroke: '#991B1B', opacity: 0.55, label: 'Critical' },
  warning:  { fill: '#B45309', stroke: '#92400E', opacity: 0.45, label: 'Warning' },
  watch:    { fill: '#0E7490', stroke: '#0C6480', opacity: 0.40, label: 'Monitoring' },
  safe:     { fill: '#0B7A4E', stroke: '#065F46', opacity: 0.35, label: 'Safe' },
};

const mapLayers = [
  { id: 'satellite', label: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
  { id: 'light',    label: 'Light',  url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
  { id: 'terrain',  label: 'Terrain', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png' },
];

type TrafficPhase = 'before' | 'during' | 'after';

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layerGroupsRef = useRef<{ [key: string]: L.LayerGroup }>({});

  const [activeBaseLayer, setActiveBaseLayer] = useState('satellite');
  const [layers, setLayers] = useState({
    water: true,
    contour: false,
    evacuation: false,
    traffic: false,
  });
  const [trafficPhase, setTrafficPhase] = useState<TrafficPhase>('during');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<string>('');
  const [panelOpen, setPanelOpen] = useState(true);

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, {
      center: [24.2, 54.2],
      zoom: 8,
      zoomControl: false,
      attributionControl: false,
    });
    tileLayerRef.current = L.tileLayer(mapLayers[0].url, { maxZoom: 19 }).addTo(map);
    // Init layer groups
    layerGroupsRef.current = {
      water: L.layerGroup().addTo(map),
      contour: L.layerGroup(),
      evacuation: L.layerGroup(),
      traffic: L.layerGroup(),
    };
    mapInstanceRef.current = map;
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  // Switch base tile layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    tileLayerRef.current?.remove();
    const l = mapLayers.find(x => x.id === activeBaseLayer) ?? mapLayers[0];
    tileLayerRef.current = L.tileLayer(l.url, { maxZoom: 19, subdomains: l.id === 'light' ? 'abcd' : 'abc' }).addTo(map);
  }, [activeBaseLayer]);

  // Draw water bodies layer
  const drawWaterLayer = useCallback(() => {
    const map = mapInstanceRef.current;
    const group = layerGroupsRef.current.water;
    if (!map || !group) return;
    group.clearLayers();
    if (!layers.water) { group.remove(); return; }
    if (!map.hasLayer(group)) group.addTo(map);
    floodWaterBodies.forEach(zone => {
      const s = levelStyle[zone.level];
      const poly = L.polygon(zone.coords, { color: s.stroke, weight: 1.5, fillColor: s.fill, fillOpacity: s.opacity });
      poly.on('click', () => { setSelectedItem(zone); setSelectedType('water'); });
      poly.bindTooltip(`<b>${zone.nameAr}</b><br>Depth: ${zone.depth}`, { direction: 'top', sticky: true });
      group.addLayer(poly);
    });
  }, [layers.water]);

  // Draw contour layer
  const drawContourLayer = useCallback(() => {
    const map = mapInstanceRef.current;
    const group = layerGroupsRef.current.contour;
    if (!map || !group) return;
    group.clearLayers();
    if (!layers.contour) { group.remove(); return; }
    if (!map.hasLayer(group)) group.addTo(map);
    // Elevation zones (fill)
    elevationZones.forEach(ez => {
      const poly = L.polygon(ez.coords, { color: '#1E40AF', weight: 0.5, fillColor: ez.color, fillOpacity: 0.25 });
      poly.bindTooltip(`<b>${ez.nameAr}</b><br>Elevation: ${ez.elev}`, { direction: 'top', sticky: true });
      group.addLayer(poly);
    });
    // Contour lines
    contourLines.forEach(cl => {
      const line = L.polyline(cl.coords, { color: cl.color, weight: 1.5, opacity: 0.7, dashArray: '4,3' });
      line.bindTooltip(`Contour line: ${cl.elev} m`, { direction: 'top', sticky: true });
      group.addLayer(line);
      // Elevation label
      const mid = cl.coords[Math.floor(cl.coords.length / 2)];
      const label = L.divIcon({
        html: `<div style="background:white;border:1px solid ${cl.color};color:${cl.color};padding:1px 4px;border-radius:3px;font-size:10px;font-weight:600;white-space:nowrap">${cl.elev}m</div>`,
        className: '', iconSize: [40, 16], iconAnchor: [20, 8],
      });
      group.addLayer(L.marker(mid, { icon: label }));
    });
  }, [layers.contour]);

  // Draw evacuation layer
  const drawEvacLayer = useCallback(() => {
    const map = mapInstanceRef.current;
    const group = layerGroupsRef.current.evacuation;
    if (!map || !group) return;
    group.clearLayers();
    if (!layers.evacuation) { group.remove(); return; }
    if (!map.hasLayer(group)) group.addTo(map);
    evacuationZones.forEach(ez => {
      const s = evacStyle[ez.decision];
      const poly = L.polygon(ez.coords, { color: s.stroke, weight: 2, fillColor: s.fill, fillOpacity: 0.35, dashArray: ez.decision === 'monitor' ? '6,4' : undefined });
      poly.on('click', () => { setSelectedItem(ez); setSelectedType('evacuation'); });
      poly.bindTooltip(`<b>${s.icon} ${ez.nameAr}</b><br>${s.label}`, { direction: 'top', sticky: true });
      group.addLayer(poly);
      // Priority marker
      const center = ez.coords.reduce((a, c) => [a[0] + c[0] / ez.coords.length, a[1] + c[1] / ez.coords.length], [0, 0]) as [number, number];
      const icon = L.divIcon({
        html: `<div style="background:${s.fill};color:white;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${ez.priority}</div>`,
        className: '', iconSize: [24, 24], iconAnchor: [12, 12],
      });
      group.addLayer(L.marker(center, { icon }));
    });
  }, [layers.evacuation]);

  // Draw traffic layer
  const drawTrafficLayer = useCallback(() => {
    const map = mapInstanceRef.current;
    const group = layerGroupsRef.current.traffic;
    if (!map || !group) return;
    group.clearLayers();
    if (!layers.traffic) { group.remove(); return; }
    if (!map.hasLayer(group)) group.addTo(map);
    trafficSegments.forEach(seg => {
      const phase = seg[trafficPhase];
      const color = trafficColor(phase.speed);
      const weight = trafficPhase === 'during' ? 6 : 4;
      const line = L.polyline(seg.coords, { color, weight, opacity: 0.85 });
      line.on('click', () => { setSelectedItem(seg); setSelectedType('traffic'); });
      line.bindTooltip(`<b>${seg.nameAr}</b><br>Speed: ${phase.speed} km/hr<br>${phase.flow}`, { direction: 'top', sticky: true });
      group.addLayer(line);
      // Speed label at midpoint
      const mid = seg.coords[Math.floor(seg.coords.length / 2)];
      const icon = L.divIcon({
        html: `<div style="background:${color};color:white;padding:2px 6px;border-radius:10px;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3)">${phase.speed} km/hr</div>`,
        className: '', iconSize: [60, 18], iconAnchor: [30, 9],
      });
      group.addLayer(L.marker(mid, { icon }));
    });
  }, [layers.traffic, trafficPhase]);

  useEffect(() => { drawWaterLayer(); }, [drawWaterLayer]);
  useEffect(() => { drawContourLayer(); }, [drawContourLayer]);
  useEffect(() => { drawEvacLayer(); }, [drawEvacLayer]);
  useEffect(() => { drawTrafficLayer(); }, [drawTrafficLayer]);

  const toggleLayer = (key: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const layerDefs = [
    { key: 'water' as const,     icon: <Droplets size={14} />,      label: 'Water Accumulations',   color: '#B91C1C', count: floodWaterBodies.length },
    { key: 'contour' as const,   icon: <Mountain size={14} />,      label: 'Contour / Terrain', color: '#1D4ED8', count: contourLines.length },
    { key: 'evacuation' as const,icon: <AlertTriangle size={14} />, label: 'Evacuation Decisions',  color: '#D97706', count: evacuationZones.length },
    { key: 'traffic' as const,   icon: <Car size={14} />,           label: 'Traffic', color: '#0891B2', count: trafficSegments.length },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-color)', background: '#FFFFFF' }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', fontFamily: 'Tajawal, sans-serif' }}>
            interactive map with multiple layers
          </h1>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
            Emirate Abu Dhabi · water accumulations + terrain + evacuation + traffic
          </p>
        </div>
        {/* Base layer switcher + Export */}
        <div className="flex items-center gap-2">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded"
          style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.30)', color: '#A78BFA', fontWeight: 600 }}
        >
          <FileDown size={11} />
          PDF
        </button>
        <div className="flex gap-1 p-1 rounded" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
          {mapLayers.map(l => (
            <button key={l.id} onClick={() => setActiveBaseLayer(l.id)}
              className="px-2.5 py-1 rounded-md font-medium transition-all"
              style={{ fontSize: '11px', background: activeBaseLayer === l.id ? 'var(--cyan)' : 'transparent', color: activeBaseLayer === l.id ? '#fff' : 'var(--text-secondary)' }}>
              {l.label}
            </button>
           ))}
        </div>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Left panel — layer controls */}
        <div className="flex flex-col flex-shrink-0" style={{ width: '260px', borderLeft: '1px solid var(--border-color)', background: '#FFFFFF', overflowY: 'auto' }}>
          {/* Layer toggles */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Layers size={11} className="inline ml-1" />Layers
              </span>
            </div>
            <div className="space-y-1.5">
              {layerDefs.map(ld => (
                <button key={ld.key} onClick={() => toggleLayer(ld.key)}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded transition-all"
                  style={{
                    background: layers[ld.key] ? `${ld.color}10` : 'var(--bg-secondary)',
                    border: `1px solid ${layers[ld.key] ? ld.color + '44' : 'var(--border-color)'}`,
                  }}>
                  <div className="flex-shrink-0" style={{ color: layers[ld.key] ? ld.color : 'var(--text-muted)' }}>{ld.icon}</div>
                  <div className="flex-1 text-right">
                    <div style={{ fontSize: '12px', fontWeight: 600, color: layers[ld.key] ? 'var(--text-primary)' : 'var(--text-muted)' }}>{ld.label}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{ld.count} elements</div>
                  </div>
                  <div className="flex-shrink-0" style={{ color: layers[ld.key] ? ld.color : 'var(--text-muted)' }}>
                    {layers[ld.key] ? <Eye size={13} /> : <EyeOff size={13} />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Traffic phase selector */}
          {layers.traffic && (
            <div className="px-3 pb-3">
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Activity size={11} className="inline ml-1" />Movement phase
              </div>
              <div className="grid grid-cols-3 gap-1">
                {([
                  { id: 'before', label: 'Before', sub: '2 days', color: '#16A34A' },
                  { id: 'during', label: 'during', sub: 'rainfall', color: '#DC2626' },
                  { id: 'after',  label: 'after',  sub: 'Today',  color: '#0891B2' },
                ] as const).map(p => (
                  <button key={p.id} onClick={() => setTrafficPhase(p.id)}
                    className="p-2 rounded text-center transition-all"
                    style={{
                      background: trafficPhase === p.id ? `${p.color}15` : 'var(--bg-secondary)',
                      border: `1px solid ${trafficPhase === p.id ? p.color : 'var(--border-color)'}`,
                    }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: trafficPhase === p.id ? p.color : 'var(--text-secondary)' }}>{p.label}</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{p.sub}</div>
                  </button>
                ))}
              </div>
              {/* Traffic legend */}
              <div className="mt-2 p-2 rounded" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>Metric Speed</div>
                {[
                  { label: '90+ km/hr — smooth', color: '#16A34A' },
                  { label: '60-90 km/hr — slow', color: '#CA8A04' },
                  { label: '30-60 km/hr — very slow', color: '#EA580C' },
                  { label: '< 30 — Stopped', color: '#DC2626' },
                ].map(t => (
                  <div key={t.label} className="flex items-center gap-1.5 mb-1">
                    <div className="h-1.5 rounded-full flex-shrink-0" style={{ width: '20px', background: t.color }} />
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Water level legend */}
          {layers.water && (
            <div className="px-3 pb-3">
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Droplets size={11} className="inline ml-1" />levels Risk
              </div>
              {Object.entries(levelStyle).filter(([k]) => k !== 'safe').map(([key, s]) => (
                <div key={key} className="flex items-center gap-2 mb-1.5">
                  <div className="w-4 h-3 rounded-sm flex-shrink-0" style={{ background: s.fill, opacity: 0.8 }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Contour legend */}
          {layers.contour && (
            <div className="px-3 pb-3">
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Mountain size={11} className="inline ml-1" />levels Elevation
              </div>
              {[
                { label: '0–5 m (Sea level)', color: '#BFDBFE' },
                { label: '5–20 m (Low)', color: '#93C5FD' },
                { label: '20–50 m (Medium)', color: '#6EE7B7' },
                { label: '50–200 m (High)', color: '#A7F3D0' },
                { label: '200m+ (Mountain)', color: '#6EE7B7' },
              ].map(e => (
                <div key={e.label} className="flex items-center gap-2 mb-1.5">
                  <div className="w-4 h-3 rounded-sm flex-shrink-0" style={{ background: e.color, border: '1px solid #1D4ED844' }} />
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{e.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Evacuation legend */}
          {layers.evacuation && (
            <div className="px-3 pb-3">
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <AlertTriangle size={11} className="inline ml-1" />evacuation decisions
              </div>
              {Object.entries(evacStyle).map(([key, s]) => (
                <div key={key} className="flex items-center gap-2 mb-1.5">
                  <div className="w-4 h-3 rounded-sm flex-shrink-0" style={{ background: s.fill, opacity: 0.7 }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{s.icon} {s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full" />

          {/* Map zoom controls */}
          <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-[1000]">
            <button onClick={() => mapInstanceRef.current?.zoomIn()}
              className="w-8 h-8 rounded flex items-center justify-center shadow-md"
              style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <ZoomIn size={14} />
            </button>
            <button onClick={() => mapInstanceRef.current?.zoomOut()}
              className="w-8 h-8 rounded flex items-center justify-center shadow-md"
              style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <ZoomOut size={14} />
            </button>
            <button onClick={() => mapInstanceRef.current?.setView([24.2, 54.2], 8)}
              className="w-8 h-8 rounded flex items-center justify-center shadow-md"
              style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <MapPin size={14} />
            </button>
          </div>

          {/* Selected item detail panel */}
          {selectedItem && (
            <div className="absolute bottom-4 right-4 z-[1000] rounded shadow-xl overflow-hidden" style={{ width: '300px', background: '#FFFFFF', border: '1px solid var(--border-color)' }}>
              <div className="flex items-center justify-between px-4 py-3" style={{
                background: selectedType === 'water' ? '#FEF2F2' :
                            selectedType === 'evacuation' ? '#FFFBEB' :
                            selectedType === 'traffic' ? '#EFF6FF' : '#F0FDF4',
                borderBottom: '1px solid var(--border-color)',
              }}>
                <h3 style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>{selectedItem.nameAr}</h3>
                <button onClick={() => setSelectedItem(null)} style={{ fontSize: '16px', color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
              </div>
              <div className="p-4">
                {selectedType === 'water' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded" style={{ background: 'var(--bg-secondary)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Water Depth</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#B91C1C' }}>{selectedItem.depth}</div>
                      </div>
                      <div className="p-2 rounded" style={{ background: 'var(--bg-secondary)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Area</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedItem.area}</div>
                      </div>
                    </div>
                    <div className="p-2.5 rounded" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                      <div style={{ fontSize: '10px', color: '#92400E', fontWeight: 600, marginBottom: '3px' }}>accumulation cause</div>
                      <div style={{ fontSize: '11px', color: '#78350F' }}>{selectedItem.cause}</div>
                    </div>
                  </div>
                )}
                {selectedType === 'evacuation' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full font-bold" style={{ fontSize: '11px', background: `${evacStyle[selectedItem.decision as keyof typeof evacStyle].fill}15`, color: evacStyle[selectedItem.decision as keyof typeof evacStyle].fill }}>
                        {evacStyle[selectedItem.decision as keyof typeof evacStyle].icon} {evacStyle[selectedItem.decision as keyof typeof evacStyle].label}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Priority #{selectedItem.priority}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded" style={{ background: 'var(--bg-secondary)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>affected population</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedItem.population}</div>
                      </div>
                    </div>
                    <div className="p-2.5 rounded" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                      <div style={{ fontSize: '10px', color: '#92400E', fontWeight: 600, marginBottom: '3px' }}>cause</div>
                      <div style={{ fontSize: '11px', color: '#78350F' }}>{selectedItem.reason}</div>
                    </div>
                    <div className="p-2.5 rounded" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                      <div style={{ fontSize: '10px', color: '#166534', fontWeight: 600, marginBottom: '3px' }}>routes Evacuation</div>
                      {selectedItem.routes?.map((r: string) => (
                        <div key={r} style={{ fontSize: '11px', color: '#15803D' }}>• {r}</div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedType === 'traffic' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['before', 'during', 'after'] as const).map(ph => {
                        const d = selectedItem[ph];
                        const c = trafficColor(d.speed);
                        const isActive = trafficPhase === ph;
                        return (
                          <div key={ph} className="p-2 rounded text-center" style={{ background: isActive ? `${c}12` : 'var(--bg-secondary)', border: `1px solid ${isActive ? c : 'var(--border-color)'}` }}>
                            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                              {ph === 'before' ? 'before' : ph === 'during' ? 'During' : 'After'}
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: c }}>{d.speed}</div>
                            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>km/hr</div>
                          </div>
                        );
                      })}
                    </div>
                    {selectedItem.during?.behavior && (
                      <div className="p-2.5 rounded" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                        <div style={{ fontSize: '10px', color: '#92400E', fontWeight: 600, marginBottom: '3px' }}>Driver behavior during rainfall</div>
                        <div style={{ fontSize: '11px', color: '#78350F' }}>{selectedItem.during.behavior}</div>
                      </div>
                    )}
                    <div className="p-2.5 rounded" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                      <div style={{ fontSize: '10px', color: '#1E40AF', fontWeight: 600, marginBottom: '3px' }}>
                        <Activity size={10} className="inline ml-1" />Analysis Artificial Intelligence
                      </div>
                      <div style={{ fontSize: '11px', color: '#1E3A8A', lineHeight: 1.5 }}>{selectedItem.aiInsight}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
