/**
 * WaterHoverTooltip.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Physics-based flood tooltip:
 *   • Region-level data at low zoom (< 14): uses full catchment hydrology model
 *   • Point-level data at high zoom (≥ 14): shows per-patch depth/volume/area
 *   • All calculations use terrain, drainage, soil infiltration from abuDhabiHydrology.ts
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { classifyByDepth, formatDepth, formatVolume, WATER_COLORS } from '@shared/waterStandard';
import {
  computeFloodMetrics,
  soilTypeLabel,
  REGION_HYDROLOGY,
  type SoilType,
} from '@/data/abuDhabiHydrology';

interface TooltipData {
  x: number;
  y: number;
  regionName: string;
  regionNameAr: string;
  avgDepthCm: number;
  volumeM3: number;
  riskLevel: string;
  riskColor: string;
  areaKm2: number;
  // Physics breakdown
  runoffMm: number;
  infiltratedMm: number;
  drainedMm: number;
  drainEfficiency: number;
  soilType: SoilType;
  elevationM: number;
  precipMm: number;
  // Mode
  isPointLevel: boolean;
  pointRadiusM?: number;
}

interface WaterHoverTooltipProps {
  leafletMap: any;
  precipMultiplier: number;
  lang: 'ar' | 'en';
  enabled: boolean;
}

// ── Precise Abu Dhabi region bounding boxes ────────────────────────────────────
// Each entry: [minLat, maxLat, minLng, maxLng, nameEn, nameAr, baseDepthCm, areaKm2, risk]
type RegionBox = [number, number, number, number, string, string, number, number, string];

const REGION_BOXES: RegionBox[] = [
  // ── Abu Dhabi Island sub-districts (smallest boxes first for specificity) ──
  [24.455, 24.475, 54.330, 54.360, 'Al Bateen',          'البطين',                40,  2.1,  'minor'],
  [24.455, 24.475, 54.360, 54.390, 'Al Manhal',          'المنهل',                38,  2.5,  'minor'],
  [24.455, 24.475, 54.385, 54.415, 'Al Karama',          'الكرامة',               42,  2.9,  'minor'],
  [24.455, 24.475, 54.330, 54.360, 'Al Gharb',           'الغرب',                 35,  3.5,  'minor'],
  [24.460, 24.485, 54.345, 54.375, 'Al Khalidiyah',      'الخالدية',              55,  4.5,  'moderate'],
  [24.460, 24.485, 54.370, 54.400, 'Al Zaab',            'الزعاب',                45,  3.8,  'minor'],
  [24.460, 24.485, 54.395, 54.425, 'Al Muroor',          'المرور',                60,  2.8,  'moderate'],
  [24.465, 24.490, 54.355, 54.385, 'Al Rawdah',          'الروضة',                38,  2.8,  'minor'],
  [24.470, 24.500, 54.370, 54.405, 'Al Mushrif',         'المشرف',                50,  6.2,  'moderate'],
  [24.470, 24.500, 54.400, 54.430, 'Al Nahyan',          'النهيان',               55,  2.9,  'moderate'],
  [24.480, 24.505, 54.355, 54.390, 'Tourist Club Area',  'منطقة النادي السياحي',  48,  2.4,  'moderate'],
  [24.440, 24.465, 54.355, 54.395, 'Downtown Abu Dhabi', 'وسط المدينة',           62,  4.1,  'moderate'],
  [24.455, 24.475, 54.325, 54.355, 'Corniche',           'الكورنيش',              30,  3.2,  'minor'],
  [24.440, 24.465, 54.375, 54.415, 'Al Difaa',           'الدفاع',                35,  3.2,  'minor'],
  [24.440, 24.460, 54.395, 54.425, 'Al Refa',            'الرفاع',                32,  2.2,  'minor'],
  [24.445, 24.475, 54.415, 54.445, 'Zayed Sports City',  'مدينة زايد الرياضية',  28,  4.5,  'minor'],
  // Abu Dhabi Island general (catch-all for island)
  [24.430, 24.520, 54.300, 54.450, 'Abu Dhabi Island',   'جزيرة أبوظبي',          45, 67.0,  'moderate'],

  // ── Al Reem Island ──
  [24.490, 24.535, 54.390, 54.440, 'Al Reem Island',     'جزيرة الريم',           32,  8.0,  'minor'],

  // ── Saadiyat Island ──
  [24.515, 24.565, 54.405, 54.470, 'Saadiyat Island',    'جزيرة السعديات',        28, 18.0,  'minor'],

  // ── Al Maqta ──
  [24.475, 24.515, 54.415, 54.475, 'Al Maqta',           'المقطع',                53,  1.6,  'moderate'],

  // ── Al Bahia ──
  [24.500, 24.540, 54.330, 54.380, 'Al Bahia',           'الباهية',               35, 18.0,  'minor'],

  // ── Mussafah ──
  [24.340, 24.380, 54.435, 54.480, 'Mussafah Industrial','مصفح الصناعية',         90, 22.0,  'severe'],
  [24.380, 24.415, 54.460, 54.520, 'Mussafah Residential','مصفح السكني',          70, 15.0,  'severe'],
  [24.330, 24.420, 54.430, 54.540, 'Mussafah',           'مصفح',                  85, 42.0,  'severe'],

  // ── KIZAD ──
  [24.265, 24.335, 54.395, 54.470, 'KIZAD',              'كيزاد',                 95, 55.0,  'severe'],
  [24.270, 24.320, 54.400, 54.455, 'KIZAD Industrial',   'كيزاد الصناعية',        100,40.0,  'severe'],

  // ── Mohammed Bin Zayed City ──
  [24.355, 24.400, 54.490, 54.560, 'Mohammed Bin Zayed City','مدينة محمد بن زايد', 72, 35.0, 'severe'],

  // ── Khalifa City A / B ──
  [24.395, 24.445, 54.555, 54.625, 'Khalifa City A',     'خليفة سيتي A',          75, 18.0,  'severe'],
  [24.420, 24.455, 54.595, 54.655, 'Khalifa City B',     'خليفة سيتي B',          65, 12.0,  'moderate'],

  // ── Yas Island (tightened to actual island bounds, not inland areas) ──
  [24.470, 24.510, 54.590, 54.645, 'Yas Island',         'جزيرة ياس',             35, 25.0,  'minor'],

  // ── Al Raha Beach ──
  [24.465, 24.500, 54.560, 54.600, 'Al Raha Beach',      'شاطئ الراحة',           40,  8.5,  'minor'],

  // ── Al Rahba ──
  [24.500, 24.545, 54.620, 54.680, 'Al Rahba',           'الرحبة',                65, 14.0,  'moderate'],

  // ── Zayed City ──
  [24.320, 24.370, 54.595, 54.660, 'Zayed City',         'مدينة زايد',            80, 32.0,  'severe'],

  // ── Al Shamkha ──
  [24.355, 24.415, 54.640, 54.720, 'Al Shamkha',         'الشامخة',               78, 30.0,  'severe'],
  [24.395, 24.430, 54.700, 54.780, 'Al Shamkha Farms',   'مزارع الشامخة',         55,120.0,  'moderate'],

  // ── Baniyas ──
  [24.295, 24.350, 54.610, 54.670, 'Baniyas',            'بني ياس',               70, 22.0,  'severe'],

  // ── Al Wathba ──
  [24.230, 24.295, 54.565, 54.650, 'Al Wathba',          'الوثبة',                88, 45.0,  'severe'],
  [24.260, 24.310, 54.750, 54.830, 'Al Wathba Farms',    'مزارع الوثبة',          55, 95.0,  'moderate'],

  // ── ICAD ──
  [24.335, 24.395, 54.530, 54.600, 'ICAD',               'إيكاد',                 82, 35.0,  'severe'],

  // ── Sweihan Road Corridor ──
  [24.220, 24.270, 54.640, 54.740, 'Sweihan Road',       'شارع سويحان',            92, 18.0,  'severe'],
  [24.270, 24.320, 54.640, 54.720, 'Al Shamkha South',   'الشامخة الجنوبية',       88, 22.0,  'severe'],

  // ── Al Falah ──
  [24.195, 24.255, 54.540, 54.620, 'Al Falah',           'الفلاح',                72, 28.0,  'severe'],
  [24.195, 24.255, 54.620, 54.740, 'Al Falah East',      'الفلاح الشرقي',          80, 20.0,  'severe'],

  // ── North Abu Dhabi Farms ──
  [24.555, 24.620, 54.400, 54.510, 'North Abu Dhabi Farms','مزارع شمال أبوظبي',   45, 85.0,  'minor'],

  // ── Al Ain ──
  [24.185, 24.250, 55.710, 55.790, 'Al Ain City',        'مدينة العين',           60, 45.0,  'moderate'],
  [24.150, 24.280, 55.680, 55.820, 'Al Ain',             'العين',                 55,120.0,  'moderate'],

  // ── Ruwais ──
  [24.085, 24.135, 52.695, 52.770, 'Ruwais',             'الرويس',                68, 15.0,  'moderate'],

  // ── Madinat Zayed ──
  [23.660, 23.740, 53.660, 53.750, 'Madinat Zayed',      'مدينة زايد الغربية',   65, 12.0,  'moderate'],

  // ── Liwa ──
  [23.080, 23.170, 53.565, 53.670, 'Liwa',               'ليوا',                  50,  8.0,  'moderate'],

  // ── Ghayathi ──
  [23.805, 23.865, 52.775, 52.835, 'Ghayathi',           'غياثي',                 110, 8.0,  'extreme'],

  // ── Al Dhafra (catch-all) ──
  [22.800, 24.200, 51.500, 54.000, 'Al Dhafra',          'الظفرة',                45,200.0,  'minor'],
];

// ── BASE PRECIPITATION per multiplier ─────────────────────────────────────────
// The UI multiplier is relative. We map it to mm:
//   0.30x → ~8 mm (dry day)
//   1.00x → 25 mm (moderate rain)
//   2.49x → 62 mm (heavy rain)
//   For historical April 2024 (254mm event), multiplier is set to ~10x
// We use 25mm as the base reference for the multiplier scale.
const BASE_PRECIP_MM = 25;

function multiplierToPrecipMm(mult: number): number {
  // Clamp to reasonable range
  return Math.max(0, mult * BASE_PRECIP_MM);
}

// ── Find region by bounding box ────────────────────────────────────────────────
function findRegionByBBox(lat: number, lng: number): RegionBox | null {
  let best: RegionBox | null = null;
  let bestArea = Infinity;
  for (const box of REGION_BOXES) {
    const [minLat, maxLat, minLng, maxLng] = box;
    if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
      const area = (maxLat - minLat) * (maxLng - minLng);
      if (area < bestArea) { bestArea = area; best = box; }
    }
  }
  return best;
}

// ── Fallback: nearest centroid within 4 km ────────────────────────────────────
function findNearestCentroid(lat: number, lng: number): RegionBox | null {
  let best: RegionBox | null = null;
  let minDist = 4000;
  for (const box of REGION_BOXES) {
    const [minLat, maxLat, minLng, maxLng] = box;
    const cLat = (minLat + maxLat) / 2;
    const cLng = (minLng + maxLng) / 2;
    const dLat = (lat - cLat) * 111000;
    const dLng = (lng - cLng) * 111000 * Math.cos(lat * Math.PI / 180);
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist < minDist) { minDist = dist; best = box; }
  }
  return best;
}

// ── Estimate point radius from zoom level ─────────────────────────────────────
// At high zoom, individual water patches are ~40–200m radius
function estimatePointRadiusM(zoom: number): number {
  if (zoom >= 16) return 40;
  if (zoom >= 15) return 70;
  if (zoom >= 14) return 120;
  if (zoom >= 12) return 200;
  return 400;
}

// ── Risk classification from depth ────────────────────────────────────────────
function depthToRisk(depthCm: number): string {
  if (depthCm <= 0)   return 'safe';
  if (depthCm <= 10)  return 'minor';
  if (depthCm <= 30)  return 'moderate';
  if (depthCm <= 80)  return 'severe';
  return 'extreme';
}

const RISK_COLORS: Record<string, string> = {
  safe: '#10B981', minor: '#84CC16', moderate: '#F59E0B',
  severe: '#EF4444', extreme: '#7C3AED',
};

// ── Build tooltip data using physics model ─────────────────────────────────────
function buildTooltipData(
  box: RegionBox,
  precipMultiplier: number,
  x: number,
  y: number,
  zoom: number,
): TooltipData {
  const [, , , , nameEn, nameAr, , areaKm2] = box;
  const precipMm = multiplierToPrecipMm(precipMultiplier);

  // Get physics-based metrics for this region (includes catchmentMultiplier & depressionFactor)
  const metrics = computeFloodMetrics(nameEn, precipMm, areaKm2);

  // At high zoom (≥14): show point-level data for the specific water patch under cursor
  const isPointLevel = zoom >= 14;
  let depthCm = metrics.depthCm;
  let volumeM3 = metrics.volumeM3;
  let pointRadiusM: number | undefined;
  let displayAreaKm2 = areaKm2;

  if (isPointLevel) {
    // Visible patch radius based on zoom level
    pointRadiusM = estimatePointRadiusM(zoom);
    const visibleAreaM2 = Math.PI * pointRadiusM * pointRadiusM;

    // The catchmentMultiplier tells us how much larger the contributing
    // catchment is vs the visible pool. Volume = depth × catchment area.
    const catchmentAreaM2 = visibleAreaM2 * metrics.catchmentMultiplier;
    volumeM3 = Math.round((depthCm / 100) * catchmentAreaM2);

    // Display area = visible pool area (what user sees on map)
    displayAreaKm2 = Math.round(visibleAreaM2 / 1_000_000 * 10000) / 10000;
  }

  const risk = depthToRisk(depthCm);

  return {
    x, y,
    regionName: nameEn,
    regionNameAr: nameAr,
    avgDepthCm: depthCm,
    volumeM3,
    riskLevel: risk,
    riskColor: RISK_COLORS[risk] ?? '#F59E0B',
    areaKm2: displayAreaKm2,
    runoffMm: metrics.runoffMm,
    infiltratedMm: metrics.infiltratedMm,
    drainedMm: metrics.drainedMm,
    drainEfficiency: metrics.drainEfficiency,
    soilType: metrics.soilType,
    elevationM: metrics.elevationM,
    precipMm,
    isPointLevel,
    pointRadiusM,
  };
}

// ── Format helpers ─────────────────────────────────────────────────────────────
function fmtVol(m3: number, lang: 'ar' | 'en'): string {
  if (m3 >= 1_000_000) {
    const v = (m3 / 1_000_000).toFixed(2);
    return lang === 'ar' ? `${v} مليون م³` : `${v}M m³`;
  }
  if (m3 >= 1_000) {
    const v = (m3 / 1_000).toFixed(1);
    return lang === 'ar' ? `${v} ألف م³` : `${v}K m³`;
  }
  return lang === 'ar' ? `${m3} م³` : `${m3} m³`;
}

function fmtArea(km2: number, lang: 'ar' | 'en'): string {
  if (km2 < 0.01) {
    const m2 = Math.round(km2 * 1_000_000);
    return lang === 'ar' ? `${m2} م²` : `${m2} m²`;
  }
  return lang === 'ar' ? `${km2.toFixed(2)} كم²` : `${km2.toFixed(2)} km²`;
}

function fmtDepth(cm: number, lang: 'ar' | 'en'): string {
  if (cm >= 100) {
    const m = (cm / 100).toFixed(1);
    return lang === 'ar' ? `${m} م` : `${m} m`;
  }
  return lang === 'ar' ? `${Math.round(cm)} سم` : `${Math.round(cm)} cm`;
}

function fmtMm(mm: number, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? `${mm.toFixed(1)} ملم` : `${mm.toFixed(1)} mm`;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function WaterHoverTooltip({ leafletMap, precipMultiplier, lang, enabled }: WaterHoverTooltipProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const throttleRef = useRef<number>(0);
  const zoomRef = useRef<number>(12);

  // Track zoom level
  useEffect(() => {
    if (!leafletMap) return;
    const onZoom = () => { zoomRef.current = leafletMap.getZoom(); };
    leafletMap.on('zoom', onZoom);
    leafletMap.on('zoomend', onZoom);
    zoomRef.current = leafletMap.getZoom?.() ?? 12;
    return () => {
      leafletMap.off('zoom', onZoom);
      leafletMap.off('zoomend', onZoom);
    };
  }, [leafletMap]);

  const handleMouseMove = useCallback((e: any) => {
    if (!enabled) { setTooltip(null); return; }
    const now = Date.now();
    if (now - throttleRef.current < 80) return;
    throttleRef.current = now;

    const { lat, lng } = e.latlng;
    const { x, y } = e.containerPoint;
    const zoom = zoomRef.current;

    let box = findRegionByBBox(lat, lng);
    if (!box) box = findNearestCentroid(lat, lng);

    if (box) {
      setTooltip(buildTooltipData(box, precipMultiplier, x, y, zoom));
    } else {
      setTooltip(null);
    }
  }, [enabled, precipMultiplier]);

  const handleMouseOut = useCallback(() => setTooltip(null), []);

  useEffect(() => {
    if (!leafletMap) return;
    leafletMap.on('mousemove', handleMouseMove);
    leafletMap.on('mouseout', handleMouseOut);
    return () => {
      leafletMap.off('mousemove', handleMouseMove);
      leafletMap.off('mouseout', handleMouseOut);
    };
  }, [leafletMap, handleMouseMove, handleMouseOut]);

  if (!tooltip || !enabled) return null;

  const isAr = lang === 'ar';

  // Position tooltip near cursor, avoid screen edges
  const OFFSET = 16;
  const TW = 270, TH = isAr ? 230 : 220;
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = tooltip.x + OFFSET;
  let top  = tooltip.y + OFFSET;
  if (left + TW > vw - 20) left = tooltip.x - TW - OFFSET;
  if (top  + TH > vh - 20) top  = tooltip.y - TH - OFFSET;

  const riskLabels: Record<string, { ar: string; en: string }> = {
    safe:     { ar: 'آمن',    en: 'Safe'     },
    minor:    { ar: 'طفيف',   en: 'Minor'    },
    moderate: { ar: 'متوسط',  en: 'Moderate' },
    severe:   { ar: 'شديد',   en: 'Severe'   },
    extreme:  { ar: 'حرج',    en: 'Extreme'  },
  };
  const riskLabel = riskLabels[tooltip.riskLevel]?.[lang] ?? tooltip.riskLevel;
  const soilLabel = soilTypeLabel(tooltip.soilType, lang);

  const regionLabel = isAr ? tooltip.regionNameAr : tooltip.regionName;
  const modeLabel = tooltip.isPointLevel
    ? (isAr ? `نقطة تجمع (r≈${tooltip.pointRadiusM}م)` : `Patch (r≈${tooltip.pointRadiusM}m)`)
    : (isAr ? 'منطقة كاملة' : 'Full Region');

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      style={{
        position: 'fixed', left, top, zIndex: 9999,
        pointerEvents: 'none', width: TW,
        background: 'rgba(10,20,40,0.94)',
        border: `1.5px solid ${tooltip.riskColor}44`,
        borderRadius: 10,
        boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px ${tooltip.riskColor}22`,
        fontFamily: isAr ? "'Cairo', 'Tajawal', sans-serif" : "'Inter', sans-serif",
        fontSize: 12,
        color: '#e8f4ff',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${tooltip.riskColor}22, ${tooltip.riskColor}11)`,
        borderBottom: `1px solid ${tooltip.riskColor}33`,
        padding: '8px 12px 6px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', lineHeight: 1.3 }}>
            {regionLabel}
          </div>
          <div style={{ color: '#8ab4d4', fontSize: 10, marginTop: 1 }}>{modeLabel}</div>
        </div>
        <div style={{
          background: tooltip.riskColor,
          color: '#fff',
          borderRadius: 5,
          padding: '2px 8px',
          fontSize: 11,
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}>
          {riskLabel}
        </div>
      </div>

      {/* Main metrics */}
      <div style={{ padding: '8px 12px 4px' }}>
        {/* Depth + Volume row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <MetricBox
            label={isAr ? 'عمق المياه' : 'Water Depth'}
            value={fmtDepth(tooltip.avgDepthCm, lang)}
            color={tooltip.riskColor}
            isAr={isAr}
          />
          <MetricBox
            label={isAr ? 'حجم المياه' : 'Water Volume'}
            value={fmtVol(tooltip.volumeM3, lang)}
            color='#38bdf8'
            isAr={isAr}
          />
          <MetricBox
            label={isAr ? 'المساحة' : 'Area'}
            value={fmtArea(tooltip.areaKm2, lang)}
            color='#a78bfa'
            isAr={isAr}
          />
        </div>

        {/* Physics breakdown */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 6,
          padding: '6px 8px',
          marginBottom: 5,
        }}>
          <div style={{ color: '#8ab4d4', fontSize: 10, marginBottom: 4, fontWeight: 600 }}>
            {isAr ? '⚗️ تحليل هيدرولوجي' : '⚗️ Hydrology Breakdown'}
          </div>
          <PhysicsRow
            label={isAr ? 'هطول' : 'Precip'}
            value={fmtMm(tooltip.precipMm, lang)}
            color='#60a5fa'
            isAr={isAr}
          />
          <PhysicsRow
            label={isAr ? 'جريان سطحي' : 'Runoff'}
            value={fmtMm(tooltip.runoffMm, lang)}
            color='#34d399'
            isAr={isAr}
          />
          <PhysicsRow
            label={isAr ? 'امتصاص التربة' : 'Infiltration'}
            value={fmtMm(tooltip.infiltratedMm, lang)}
            color='#a78bfa'
            isAr={isAr}
          />
          <PhysicsRow
            label={isAr ? 'تصريف البنية التحتية' : 'Drainage'}
            value={fmtMm(tooltip.drainedMm, lang)}
            color='#fb923c'
            isAr={isAr}
          />
        </div>

        {/* Terrain info */}
        <div style={{ display: 'flex', gap: 6, fontSize: 10, color: '#8ab4d4' }}>
          <span>
            {isAr ? '📍 ارتفاع:' : '📍 Elev:'}{' '}
            <span style={{ color: '#e2e8f0' }}>{tooltip.elevationM.toFixed(0)}م</span>
          </span>
          <span style={{ color: '#4a5568' }}>|</span>
          <span>
            {isAr ? '🪨 تربة:' : '🪨 Soil:'}{' '}
            <span style={{ color: '#e2e8f0' }}>{soilLabel}</span>
          </span>
          <span style={{ color: '#4a5568' }}>|</span>
          <span>
            {isAr ? '🚰 تصريف:' : '🚰 Drain:'}{' '}
            <span style={{ color: '#e2e8f0' }}>{Math.round(tooltip.drainEfficiency * 100)}%</span>
          </span>
        </div>
      </div>

      {/* Footer bar */}
      <div style={{
        height: 3,
        background: `linear-gradient(to ${isAr ? 'left' : 'right'}, ${tooltip.riskColor}, ${tooltip.riskColor}44)`,
        marginTop: 4,
      }} />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function MetricBox({ label, value, color, isAr }: {
  label: string; value: string; color: string; isAr: boolean;
}) {
  return (
    <div style={{
      flex: 1,
      background: 'rgba(255,255,255,0.05)',
      borderRadius: 6,
      padding: '5px 6px',
      textAlign: 'center',
      border: `1px solid ${color}22`,
    }}>
      <div style={{ color: '#8ab4d4', fontSize: 9, marginBottom: 2 }}>{label}</div>
      <div style={{ color, fontWeight: 700, fontSize: 12 }}>{value}</div>
    </div>
  );
}

function PhysicsRow({ label, value, color, isAr }: {
  label: string; value: string; color: string; isAr: boolean;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    }}>
      <span style={{ color: '#94a3b8', fontSize: 10 }}>{label}</span>
      <span style={{ color, fontSize: 10, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
