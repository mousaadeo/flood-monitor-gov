/**
 * UnifiedMapPage.tsx — Unified Map
 * Combines: MapPage + HeatMapPage + RoadNetworkPage + TrafficImpactPage
 * Activatable layers: Water accumulations | Road Network | Traffic | Contour | Evacuation decisions
 * Data: OSM Overpass API (410,348 Road) + Open-Meteo + Copernicus CEMS
 */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import HistoricalWaterPanel from '@/components/HistoricalWaterPanel';
import HistoricalTimelineScrubber, { type HistoricalRange, type ViewMode as HistViewMode } from '@/components/HistoricalTimelineScrubber';
import { HISTORICAL_REGIONS, LEVEL_COLORS, FLOOD_EVENTS, type HistoricalRegion } from '@/data/historicalWater';
import { FLOOD_ZONES, DRAINAGE_POINTS, DATA_ACCURACY, getZonesForZoom, type FloodZoneMulti } from '@/services/floodMapData';
import { createFloodWaterLayer, type FloodWaterLayerInstance } from '@/components/FloodWaterLayer';
import { useRealWeather } from '@/hooks/useRealWeather';
import TimelineScrubber, { buildTimelineHours, type TimelineHour } from '@/components/TimelineScrubber';
import {
  Layers, Droplets, Car, Map, AlertTriangle, RefreshCw,
  ZoomIn, Info, Eye, EyeOff, Wifi, WifiOff, Navigation,
  Thermometer, Wind, Activity, ChevronDown, ChevronUp, FileDown,
  Gauge, MapPin, BarChart2, Settings2
} from 'lucide-react';
import InfoTooltip from '@/components/InfoTooltip';
import FullscreenButton from '@/components/FullscreenButton';
import { WaterLegend } from '@/components/WaterLegend';
import { WATER_COLORS, WATER_LABELS, WATER_ICONS, classifyByDepth, formatDepth, formatVolume } from '@shared/waterStandard';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/useMobile';
import { ABU_DHABI_EMIRATE, type SubArea } from '@/data/abuDhabiRegions';
import MobileBottomSheet from '@/components/MobileBottomSheet';
import { trpc } from '@/lib/trpc';
import KPIDrillDown, { type DrillDownType } from '@/components/KPIDrillDown';
import WaterHoverTooltip from '@/components/WaterHoverTooltip';
import WaterVolumeSummary from '@/components/WaterVolumeSummary';

// ── Tooltip definitions ─────────────────────────────────────────────────────────────
const MAP_TOOLTIPS = {
  mapTitle: {
    title: 'Unified Map',
    description: 'Interactive map combining four layers: water accumulation zones, road network (410,348 roads), heat map, and Traffic. Each layer can be activated or stopped independently.',
    source: 'OSM Overpass API + Open-Meteo + Copernicus CEMS',
    normalRange: 'Full coverage of Abu Dhabi Emirate',
    updateFreq: 'All 15 minute',
    color: '#00d4ff',
  },
  floodZones: {
    title: 'Water Accumulation Zones',
    description: '11 verified regions for rain water accumulation in Abu Dhabi Emirate. Coordinates calibrated ffrom Copernicus CEMS and historical flood data. Color reflects current risk level.',
    source: 'Copernicus CEMS + OSM + historical data',
    normalRange: '11 verified regions',
    updateFreq: 'Static (geographic data)',
    color: '#00d4ff',
  },
  roadNetwork: {
    title: 'Road Network — Dynamic Colors',
    description: '410,348 roads colored by accumulation risk percentage (fr%): • Green (0-5%) = Safe • Light green (5-20%) = Low • yellow (20-40%) = warning • orange (40-60%) = risk • red (60-80%) = high risk • purple (80%+) = flooded. Risk Calculated from DEM (region depression) + Open-Meteo rainfall + region drainage capacity.',
    source: 'OpenStreetMap Overpass API + DEM GLO-30 + Open-Meteo',
    normalRange: 'Green (Safe) for majority when no rainfall',
    updateFreq: 'Derived from live weather data',
    color: '#10B981',
  },
  adminBoundaries: {
    title: 'Administrative Boundaries',
    description: 'Independent layer for the 90 administrative region boundaries, displayed similarly to the road network as a dedicated outline overlay. Visible from L2 and above, with map-aligned outlines for each region and optional labels at higher zoom.',
    source: 'Administrative region geometry model aligned to the base map',
    normalRange: 'Visible only at L2+ zoom levels',
    updateFreq: 'Static geometry with dynamic highlighting',
    color: '#93C5FD',
  },
  trafficLayer: {
    title: 'Layer Traffic',
    description: 'Visualization of rain impact on driving speed on main roads. Three phases: before rain (normal speed), during rain (slowdown), after rain (gradual recovery).',
    source: 'Hydrological algorithm + OSM Road Network',
    normalRange: '+90 km/hr (before rain)',
    updateFreq: 'Derived from weather data',
    color: '#F59E0B',
  },
  dataSources: {
    title: 'Sources Data',
    description: 'Accuracy All Source Data: Network Roads (OSM) 98%, accumulation zones (Copernicus) 91%, weather data (Open-Meteo) 92%, elevation model (DEM GLO-30) 96%.',
    source: 'OSM + Copernicus + Open-Meteo',
    normalRange: '> 90% for all sources',
    updateFreq: 'Varies by source',
    color: '#8b5cf6',
  },
};

// ── CDN URLs — Flood-risk colored road tiles ──────────────────────────────
const ROAD_CDN = {
  tier1: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663384867006/UpUV4ACjBMFtNVM49QL7JW/tier1_major_401c5c98.json',
  tier2: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663384867006/UpUV4ACjBMFtNVM49QL7JW/tier2_primary_b0816b15.json',
  tier3: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663384867006/UpUV4ACjBMFtNVM49QL7JW/tier3_local_c8abfbef.json',
  tier4: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663384867006/UpUV4ACjBMFtNVM49QL7JW/tier4_residential_6e562d9f.json',
};

// ── Traffic segments ───────────────────────────────────────────────────────
const TRAFFIC_SEGMENTS = [
  { id: 'e11-ad', nameAr: 'Sheikh Zayed Road — Abu Dhabi', coords: [[24.490,54.360],[24.460,54.420],[24.430,54.480],[24.400,54.540]] as [number,number][], before: 120, during: 35, after: 75, floodDepth: 18 },
  { id: 'mussafah-bridge', nameAr: 'Bridge Mussafah', coords: [[24.380,54.460],[24.360,54.490],[24.340,54.520]] as [number,number][], before: 90, during: 10, after: 45, floodDepth: 32 },
  { id: 'khalifa-main', nameAr: 'Main Road — Khalifa City', coords: [[24.415,54.590],[24.400,54.620],[24.385,54.650],[24.370,54.680]] as [number,number][], before: 80, during: 20, after: 55, floodDepth: 12 },
  { id: 'shahama-highway', nameAr: 'Road Al Shahama', coords: [[24.520,54.430],[24.505,54.450],[24.490,54.470]] as [number,number][], before: 100, during: 60, after: 95, floodDepth: 5 },
  { id: 'ain-road', nameAr: 'Road Abu Dhabi-Al Ain', coords: [[24.350,54.700],[24.310,54.800],[24.270,54.900],[24.230,55.000]] as [number,number][], before: 120, during: 40, after: 85, floodDepth: 22 },
  { id: 'ruwais-road', nameAr: 'Road Al Ruwais E11', coords: [[24.200,54.600],[24.180,54.500],[24.160,54.400],[24.140,54.300]] as [number,number][], before: 120, during: 55, after: 90, floodDepth: 8 },
];

// ── Dynamic Evacuation Zones — built from URBAN_ZONES + precipMultiplier ──
import { URBAN_ZONES, isInsideAbuDhabi } from '@/data/abuDhabiBoundary';

function buildEvacZones(multiplier: number) {
  // Only zones with density ≥ 0.65 are considered for evacuation
  return URBAN_ZONES
    .filter(z => z.density >= 0.65)
    .map(z => {
      const depthEst = Math.round(80 * z.density * multiplier);
      const decision: 'immediate' | 'warning' = depthEst >= 50 ? 'immediate' : 'warning';
      const steps = 4;
      const latStep = (z.maxLat - z.minLat) / steps;
      const lngStep = (z.maxLng - z.minLng) / steps;
      const landPoints: [number, number][] = [];

      for (let i = 0; i <= steps; i++) {
        for (let j = 0; j <= steps; j++) {
          const lat = z.minLat + i * latStep;
          const lng = z.minLng + j * lngStep;
          if (isInsideAbuDhabi(lat, lng)) landPoints.push([lat, lng]);
        }
      }

      let coords: [number, number][];
      if (landPoints.length >= 3) {
        const lats = landPoints.map(p => p[0]);
        const lngs = landPoints.map(p => p[1]);
        coords = [
          [Math.min(...lats), Math.min(...lngs)],
          [Math.min(...lats), Math.max(...lngs)],
          [Math.max(...lats), Math.max(...lngs)],
          [Math.max(...lats), Math.min(...lngs)],
        ];
      } else {
        const cLat = (z.minLat + z.maxLat) / 2;
        const cLng = (z.minLng + z.maxLng) / 2;
        coords = [
          [cLat - 0.01, cLng - 0.01],
          [cLat - 0.01, cLng + 0.01],
          [cLat + 0.01, cLng + 0.01],
          [cLat + 0.01, cLng - 0.01],
        ];
      }

      const areaDeg = (z.maxLat - z.minLat) * (z.maxLng - z.minLng);
      const areaKm2 = areaDeg * 111 * 111 * Math.cos(((z.minLat + z.maxLat) / 2) * Math.PI / 180);
      const landFraction = Math.max(0.1, landPoints.length / ((steps + 1) * (steps + 1)));
      const popEst = Math.round(areaKm2 * z.density * 8000 * landFraction);
      const population = popEst >= 1000 ? `${(popEst / 1000).toFixed(0)}K` : `${popEst}`;

      return {
        id: `evac-${z.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        nameAr: z.name,
        decision,
        depthEst,
        population,
        coords,
      };
    })
    .sort((a, b) => b.depthEst - a.depthEst);
}

type AdminOverlayLevel = 'safe' | 'minor' | 'moderate' | 'severe' | 'extreme';

type AdminSignal = {
  overlayLevel: AdminOverlayLevel;
  depthCm: number;
  estimatedAreaKm2: number;
  precipitationValue: number;
  riskIndex: number;
  severityLabel: string;
  waterLabel: string;
  dataModeLabel: string;
  sourceLabel: string;
  alertLevel: 'critical' | 'warning' | 'watch' | 'safe';
};

const ADMIN_LEVEL_ORDER: Record<AdminOverlayLevel, number> = {
  safe: 0,
  minor: 1,
  moderate: 2,
  severe: 3,
  extreme: 4,
};

const ADMIN_OVERLAY_COLORS: Record<AdminOverlayLevel, { fill: string; stroke: string; text: string }> = {
  safe:     { fill: '#10B981', stroke: '#86EFAC', text: '#ECFDF5' },
  minor:    { fill: '#F59E0B', stroke: '#FCD34D', text: '#FFFBEB' },
  moderate: { fill: '#F97316', stroke: '#FDBA74', text: '#FFF7ED' },
  severe:   { fill: '#EF4444', stroke: '#FCA5A5', text: '#FEF2F2' },
  extreme:  { fill: '#7C3AED', stroke: '#C4B5FD', text: '#F5F3FF' },
};

const ADMIN_LEVEL_LABELS: Record<AdminOverlayLevel, { ar: string; en: string }> = {
  safe: { ar: 'طبيعي', en: 'Normal' },
  minor: { ar: 'مراقبة', en: 'Monitoring' },
  moderate: { ar: 'إنذار', en: 'Warning' },
  severe: { ar: 'حرج', en: 'Critical' },
  extreme: { ar: 'شديد جداً', en: 'Severe' },
};

const DISTRICT_NAME_ALIASES: Record<string, string[]> = {
  'RAWDAT AL REEF': ['AL REEF', 'AL REEF DOWNTOWN', 'ROWDAT AL REEF'],
  'SHAKHBOUT CITY': ['SHAKHBOUT CITY', 'KHALIFA CITY B', 'KHALIFA CITY B'],
  'KHALIFA CITY': ['KHALIFA CITY', 'KHALIFA CITY A', 'KHALIFA CITY B'],
  'MOHAMMED BIN ZAYED CITY': ['MOHAMMED BIN ZAYED CITY', 'MBZ', 'MBZ CITY'],
  'MADINAT ZAYED': ['MADINAT ZAYED', 'MADINAT ZAYED (BADAA ZAYED)', 'BADAA ZAYED'],
  'AL DHANNAH': ['AL DHANNAH', 'AL RUWAIS', 'JEBEL DHANNAH', 'AL DHANNAH PORT AREA'],
  'AL WATHBA SOUTH': ['AL WATHBA', 'AL WATHBA FARMS'],
  'AL SHAMKHA SOUTH': ['AL SHAMKHA', 'AL SHAMKHA FARMS'],
  'BANI YAS': ['BANIYAS', 'BANIYAS FARMS'],
  'AL SHAHAMA': ['AL SHAHAMA', 'AL BAHIA', 'AL RAHBA'],
};

const DISTRICT_TO_CITY_HINTS: Array<{ matcher: RegExp; cityId: string }> = [
  { matcher: /AL AIN|HILI|JIMI|MUTARAD|MUWAIJI|KHABISI|MAQAM|FOAH|DHAHIR|WADI|FALAJ|QATTARA|ASHAREJ|NYADAT|TAWILAH|SHUAIBAH|RUFAAH|DAHMAA|HELO|JABAL/i, cityId: 'alain' },
  { matcher: /LIWA|GHAYATHI|MIRFA|DHANNAH|RUWAIS|SILA|HABSHAN|SHAH|MADINAT ZAYED|WESTERN|DHAFRA/i, cityId: 'dhafra' },
  { matcher: /ABU DHABI|KHALIFA|SHAKHBOUT|WATHBA|SHAMKHA|BANI YAS|RAHA|YAS|SAADIYAT|MUSSAFAH|ICAD|AL REEF|RAWDAT|BAHIA|RAHBA|CORNICHE|BATIN|KARAMA|MUSHRIF|ZAAB|MANHAL/i, cityId: 'abudhabi' },
];

function normalizeAdminName(value?: string | null) {
  return (value ?? '')
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' AND ')
    .replace(/['’`]/g, '')
    .replace(/[^A-Z0-9]+/gi, ' ')
    .replace(/\b(ST|CITY|DISTRICT|COMMUNITY|AREA|REGION|ISLAND|FARMS|FARM|INDUSTRIAL|PORT)\b/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function adminLevelFromDepthAndRisk(depthCm: number, riskIndex: number): AdminOverlayLevel {
  const depthScore = depthCm >= 80 ? 4 : depthCm >= 50 ? 3 : depthCm >= 20 ? 2 : depthCm >= 5 ? 1 : 0;
  const riskScore = riskIndex >= 85 ? 4 : riskIndex >= 65 ? 3 : riskIndex >= 45 ? 2 : riskIndex >= 20 ? 1 : 0;
  const combinedScore = Math.max(depthScore, Math.round((depthScore * 0.55) + (riskScore * 0.45)));
  if (combinedScore >= 4) return 'extreme';
  if (combinedScore >= 3) return 'severe';
  if (combinedScore >= 2) return 'moderate';
  if (combinedScore >= 1) return 'minor';
  return 'safe';
}

function buildAdminSignalFromLiveRegion(
  liveRegion: any,
  areaSqKm: number,
  lang: 'ar' | 'en',
): AdminSignal {
  const liveDepth = liveRegion?.waterAccumulation?.estimatedDepthCm ?? Math.round((liveRegion?.floodRisk ?? 0) * 0.8);
  const liveArea = liveRegion?.waterAccumulation?.estimatedAreaKm2 ?? Number((areaSqKm * clamp((liveRegion?.floodRisk ?? 0) / 100, 0.02, 0.65)).toFixed(2));
  const precipitationValue = Math.max(liveRegion?.currentPrecipitation ?? 0, liveRegion?.totalLast24h ?? 0);
  const riskIndex = clamp(Math.round(liveRegion?.floodRisk ?? 0), 0, 100);
  const overlayLevel = adminLevelFromDepthAndRisk(liveDepth, riskIndex);
  const waterLabel = precipitationValue > 0
    ? (lang === 'ar' ? 'تجمعات مائية حية' : 'Live surface water')
    : (lang === 'ar' ? 'أثر تجمّع/تشبّع' : 'Retention / saturation');
  const severityLabel = ADMIN_LEVEL_LABELS[overlayLevel][lang];
  return {
    overlayLevel,
    depthCm: liveDepth,
    estimatedAreaKm2: liveArea,
    precipitationValue,
    riskIndex,
    waterLabel,
    severityLabel,
    dataModeLabel: lang === 'ar' ? 'حي' : 'Live',
    sourceLabel: (liveRegion?.waterAccumulation?.sources ?? ['Open-Meteo']).join(' · '),
    alertLevel: overlayLevel === 'extreme' || overlayLevel === 'severe' ? 'critical' : overlayLevel === 'moderate' ? 'warning' : overlayLevel === 'minor' ? 'watch' : 'safe',
  };
}

function buildAdminSignalFromHistoricalRegion(
  historicalRegion: HistoricalRegion,
  areaSqKm: number,
  lang: 'ar' | 'en',
  historicalMode: boolean,
  historicalRange: HistoricalRange | null,
  historicalEventActive: {year: number; month: number} | null,
  historicalYear: number,
  historicalMonth: number,
): AdminSignal | null {
  if (!historicalMode) return null;
  const events = historicalRange
    ? historicalRegion.events.filter((e) => {
        const afterFrom = e.year > historicalRange.fromYear || (e.year === historicalRange.fromYear && e.month >= historicalRange.fromMonth);
        const beforeTo = e.year < historicalRange.toYear || (e.year === historicalRange.toYear && e.month <= historicalRange.toMonth);
        return afterFrom && beforeTo;
      })
    : historicalEventActive
    ? historicalRegion.events.filter((e) => e.year === historicalEventActive.year && e.month === historicalEventActive.month)
    : historicalRegion.events.filter((e) => e.year === historicalYear && e.month === historicalMonth);

  if (events.length === 0) return null;

  const depthCm = Math.max(...events.map(e => e.waterDepthCm));
  const precipitationValue = Math.max(...events.map(e => e.precipMm));
  const estimatedAreaKm2 = Math.max(
    0.15,
    Number((areaSqKm * clamp((historicalRegion.density * depthCm) / 55, 0.04, 0.88)).toFixed(2))
  );
  const riskIndex = clamp(Math.round((depthCm * 0.7) + (historicalRegion.density * 35)), 0, 100);
  const overlayLevel = adminLevelFromDepthAndRisk(depthCm, riskIndex);
  return {
    overlayLevel,
    depthCm,
    estimatedAreaKm2,
    precipitationValue,
    riskIndex,
    waterLabel: events.length > 1
      ? (lang === 'ar' ? `أقصى حدث ضمن الفترة (${events.length})` : `Peak in selected range (${events.length})`)
      : events[0].name,
    severityLabel: ADMIN_LEVEL_LABELS[overlayLevel][lang],
    dataModeLabel: lang === 'ar' ? 'تاريخي' : 'Historical',
    sourceLabel: 'Historical Archive',
    alertLevel: overlayLevel === 'extreme' || overlayLevel === 'severe' ? 'critical' : overlayLevel === 'moderate' ? 'warning' : overlayLevel === 'minor' ? 'watch' : 'safe',
  };
}

function getFeatureNameCandidates(properties: Record<string, any>) {
  const rawCandidates = [
    properties.NAMEENGLISH,
    properties.NAMEARABIC,
    properties.COMMUNITYNAMEENG,
    properties.COMMUNITYNAMEARA,
    properties.DISTRICTNAMEENG,
    properties.DISTRICTARA,
    properties.MUNICIPALITYNAME,
    properties.MUNICIPALITY,
  ].filter(Boolean) as string[];

  const normalized = new Set<string>();
  rawCandidates.forEach((value) => {
    const base = normalizeAdminName(value);
    if (!base) return;
    normalized.add(base);
    const aliases = DISTRICT_NAME_ALIASES[base] ?? [];
    aliases.forEach(alias => normalized.add(normalizeAdminName(alias)));
  });
  return Array.from(normalized);
}

function guessCityIdFromFeature(properties: Record<string, any>) {
  const candidates = getFeatureNameCandidates(properties);
  for (const candidate of candidates) {
    for (const hint of DISTRICT_TO_CITY_HINTS) {
      if (hint.matcher.test(candidate)) return hint.cityId;
    }
  }
  return undefined;
}

function geometryCentroid(feature: any): { lat: number; lng: number } | null {
  const geometry = feature?.geometry;
  if (!geometry) return null;
  const coords: [number, number][] = [];
  const pushRing = (ring: any[]) => ring.forEach((pair) => {
    if (Array.isArray(pair) && pair.length >= 2) coords.push([pair[1], pair[0]]);
  });
  if (geometry.type === 'Polygon') {
    pushRing(geometry.coordinates?.[0] ?? []);
  } else if (geometry.type === 'MultiPolygon') {
    (geometry.coordinates ?? []).forEach((poly: any) => pushRing(poly?.[0] ?? []));
  }
  if (!coords.length) return null;
  const lat = coords.reduce((sum, point) => sum + point[0], 0) / coords.length;
  const lng = coords.reduce((sum, point) => sum + point[1], 0) / coords.length;
  return { lat, lng };
}

function matchAdministrativeSignal(
  feature: any,
  administrativeAreas: Array<SubArea & { cityNameAr: string; cityNameEn: string }>,
  liveRegions: any[],
  lang: 'ar' | 'en',
  historicalMode: boolean,
  historicalRange: HistoricalRange | null,
  historicalEventActive: {year: number; month: number} | null,
  historicalYear: number,
  historicalMonth: number,
) {
  const properties = feature?.properties ?? {};
  const cityHint = guessCityIdFromFeature(properties);
  const nameCandidates = getFeatureNameCandidates(properties);
  const scopedAreas = cityHint ? administrativeAreas.filter(area => area.cityId === cityHint) : administrativeAreas;

  let matchedArea = scopedAreas.find((area) => {
    const areaNames = [area.nameEn, area.nameAr, area.id].map(normalizeAdminName);
    return nameCandidates.some(candidate => areaNames.includes(candidate));
  });

  const centroid = geometryCentroid(feature);
  if (!matchedArea && centroid) {
    matchedArea = scopedAreas.reduce<typeof scopedAreas[number] | undefined>((nearest, candidate) => {
      if (!nearest) return candidate;
      const nearestDistance = haversineKm(centroid.lat, centroid.lng, nearest.lat, nearest.lng);
      const candidateDistance = haversineKm(centroid.lat, centroid.lng, candidate.lat, candidate.lng);
      return candidateDistance < nearestDistance ? candidate : nearest;
    }, undefined);
  }

  if (!matchedArea) return null;

  const areaHistorical = HISTORICAL_REGIONS.reduce<HistoricalRegion | null>((nearest, candidate) => {
    if (!nearest) return candidate;
    const nearestDistance = haversineKm(matchedArea!.lat, matchedArea!.lng, nearest.lat, nearest.lng);
    const candidateDistance = haversineKm(matchedArea!.lat, matchedArea!.lng, candidate.lat, candidate.lng);
    return candidateDistance < nearestDistance ? candidate : nearest;
  }, null);

  const historicalSignal = areaHistorical
    ? buildAdminSignalFromHistoricalRegion(areaHistorical, matchedArea.areaSqKm, lang, historicalMode, historicalRange, historicalEventActive, historicalYear, historicalMonth)
    : null;
  if (historicalSignal) return { area: matchedArea, signal: historicalSignal };

  const liveRegion = liveRegions.reduce<any | null>((nearest, candidate) => {
    if (!nearest) return candidate;
    const nearestDistance = haversineKm(matchedArea!.lat, matchedArea!.lng, nearest.lat, nearest.lon);
    const candidateDistance = haversineKm(matchedArea!.lat, matchedArea!.lng, candidate.lat, candidate.lon);
    return candidateDistance < nearestDistance ? candidate : nearest;
  }, null);
  if (!liveRegion) return null;

  return {
    area: matchedArea,
    signal: buildAdminSignalFromLiveRegion(liveRegion, matchedArea.areaSqKm, lang),
  };
}

function buildAdministrativeFeatureSignals(
  geojson: any,
  administrativeAreas: Array<SubArea & { cityNameAr: string; cityNameEn: string }>,
  liveRegions: any[],
  lang: 'ar' | 'en',
  historicalMode: boolean,
  historicalRange: HistoricalRange | null,
  historicalEventActive: {year: number; month: number} | null,
  historicalYear: number,
  historicalMonth: number,
) {
  const byObjectId: Record<string, ReturnType<typeof matchAdministrativeSignal>> = {};
  const byDistrictId: Record<string, ReturnType<typeof matchAdministrativeSignal>> = {};
  (geojson?.features ?? []).forEach((feature: any) => {
    const matched = matchAdministrativeSignal(feature, administrativeAreas, liveRegions, lang, historicalMode, historicalRange, historicalEventActive, historicalYear, historicalMonth);
    if (!matched) return;
    const props = feature?.properties ?? {};
    if (props.OBJECTID !== undefined && props.OBJECTID !== null) byObjectId[String(props.OBJECTID)] = matched;
    if (props.DISTRICTID !== undefined && props.DISTRICTID !== null) byDistrictId[String(props.DISTRICTID)] = matched;
  });
  return { byObjectId, byDistrictId };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function classifyOverlayLevel(depthCm: number): AdminOverlayLevel {
  if (depthCm >= 80) return 'extreme';
  if (depthCm >= 50) return 'severe';
  if (depthCm >= 20) return 'moderate';
  if (depthCm >= 5) return 'minor';
  return 'safe';
}

function toAlertLevel(level: AdminOverlayLevel): 'critical' | 'warning' | 'watch' | 'safe' {
  if (level === 'extreme' || level === 'severe') return 'critical';
  if (level === 'moderate') return 'warning';
  if (level === 'minor') return 'watch';
  return 'safe';
}

function getMaxOverlayLevel(levels: AdminOverlayLevel[]): AdminOverlayLevel {
  return levels.reduce<AdminOverlayLevel>((max, level) => {
    return ADMIN_LEVEL_ORDER[level] > ADMIN_LEVEL_ORDER[max] ? level : max;
  }, 'safe');
}

type LocalPoint = { x: number; y: number };

function polygonArea(points: LocalPoint[]) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    area += points[i].x * next.y - next.x * points[i].y;
  }
  return area / 2;
}

function clipPolygonWithHalfPlane(points: LocalPoint[], normalX: number, normalY: number, constant: number) {
  if (!points.length) return points;
  const output: LocalPoint[] = [];
  const isInside = (point: LocalPoint) => normalX * point.x + normalY * point.y <= constant + 1e-6;
  const intersect = (a: LocalPoint, b: LocalPoint) => {
    const denom = normalX * (b.x - a.x) + normalY * (b.y - a.y);
    if (Math.abs(denom) < 1e-9) return b;
    const t = (constant - normalX * a.x - normalY * a.y) / denom;
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    };
  };

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const previous = points[(i + points.length - 1) % points.length];
    const currentInside = isInside(current);
    const previousInside = isInside(previous);

    if (currentInside) {
      if (!previousInside) output.push(intersect(previous, current));
      output.push(current);
    } else if (previousInside) {
      output.push(intersect(previous, current));
    }
  }

  return output;
}

function simplifyLocalPolygon(points: LocalPoint[]) {
  if (points.length <= 3) return points;
  const simplified: LocalPoint[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const prev = points[(i + points.length - 1) % points.length];
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const cross = Math.abs((current.x - prev.x) * (next.y - current.y) - (current.y - prev.y) * (next.x - current.x));
    const edge = Math.hypot(next.x - prev.x, next.y - prev.y);
    if (edge < 1e-6 || cross / edge > 0.015) simplified.push(current);
  }
  return simplified.length >= 3 ? simplified : points;
}

function buildAdministrativePolygon(area: SubArea, allAreas: SubArea[]): [number, number][] {
  const cityAreas = allAreas.filter(candidate => candidate.cityId === area.cityId);
  const cityPeers = cityAreas.filter(candidate => candidate.id !== area.id);
  const cityCenterLat = cityAreas.reduce((sum, candidate) => sum + candidate.lat, 0) / Math.max(cityAreas.length, 1);
  const lngDivider = 111.320 * Math.max(0.3, Math.cos((cityCenterLat * Math.PI) / 180));

  const cityLatMin = Math.min(...cityAreas.map(candidate => candidate.lat));
  const cityLatMax = Math.max(...cityAreas.map(candidate => candidate.lat));
  const cityLngMin = Math.min(...cityAreas.map(candidate => candidate.lng));
  const cityLngMax = Math.max(...cityAreas.map(candidate => candidate.lng));
  const citySpanLatKm = Math.max(4, (cityLatMax - cityLatMin) * 110.574);
  const citySpanLngKm = Math.max(4, (cityLngMax - cityLngMin) * lngDivider);
  const cityPaddingLatKm = clamp(citySpanLatKm * 0.05, 0.9, 5);
  const cityPaddingLngKm = clamp(citySpanLngKm * 0.05, 0.9, 5);

  const centerX = area.lng * lngDivider;
  const centerY = area.lat * 110.574;
  const cityMinX = cityLngMin * lngDivider - cityPaddingLngKm;
  const cityMaxX = cityLngMax * lngDivider + cityPaddingLngKm;
  const cityMinY = cityLatMin * 110.574 - cityPaddingLatKm;
  const cityMaxY = cityLatMax * 110.574 + cityPaddingLatKm;

  const urbanCompact = area.districtType.includes('urban') || area.districtType.includes('commercial') || area.districtType.includes('industrial');
  const remoteLoose = area.districtType.includes('desert') || area.districtType.includes('agricultural');
  const coastalLoose = area.districtType.includes('coastal');

  const naturalRadiusKm = Math.sqrt(Math.max(area.areaSqKm, 1) / Math.PI);
  const minRadiusKm = urbanCompact ? 0.38 : remoteLoose ? 1.05 : 0.62;
  const maxRadiusKm = remoteLoose ? 8.2 : coastalLoose ? 5.2 : urbanCompact ? 2.1 : 3.4;
  const baseRadiusKm = clamp(
    naturalRadiusKm * (urbanCompact ? 0.5 : remoteLoose ? 0.62 : coastalLoose ? 0.58 : 0.54),
    minRadiusKm,
    maxRadiusKm,
  );

  const directionCount = 16;
  const angles = Array.from({ length: directionCount }, (_, index) => (-Math.PI / 2) + ((Math.PI * 2 * index) / directionCount));

  const rawRadii = angles.map((angle) => {
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);

    let rayLimitKm = Number.POSITIVE_INFINITY;
    if (ux > 1e-6) rayLimitKm = Math.min(rayLimitKm, (cityMaxX - centerX) / ux);
    if (ux < -1e-6) rayLimitKm = Math.min(rayLimitKm, (cityMinX - centerX) / ux);
    if (uy > 1e-6) rayLimitKm = Math.min(rayLimitKm, (cityMaxY - centerY) / uy);
    if (uy < -1e-6) rayLimitKm = Math.min(rayLimitKm, (cityMinY - centerY) / uy);
    if (!Number.isFinite(rayLimitKm)) rayLimitKm = maxRadiusKm * 1.5;

    const corridorFactor = urbanCompact ? 0.32 : remoteLoose ? 0.58 : 0.42;
    let nearestConstraintKm = Number.POSITIVE_INFINITY;

    cityPeers.forEach(candidate => {
      const dx = candidate.lng * lngDivider - centerX;
      const dy = candidate.lat * 110.574 - centerY;
      const forward = dx * ux + dy * uy;
      if (!Number.isFinite(forward) || forward <= 0.12) return;

      const lateral = Math.abs((-uy * dx) + (ux * dy));
      const corridorKm = Math.max(baseRadiusKm * 0.9, forward * corridorFactor);
      if (lateral > corridorKm) return;

      const candidateRadiusKm = clamp(
        forward * (urbanCompact ? 0.42 : remoteLoose ? 0.54 : 0.48) - lateral * 0.12,
        minRadiusKm * 0.9,
        rayLimitKm,
      );
      nearestConstraintKm = Math.min(nearestConstraintKm, candidateRadiusKm);
    });

    const opennessBoost = coastalLoose ? 1.16 : remoteLoose ? 1.22 : urbanCompact ? 0.94 : 1.04;
    const unconstrainedRadiusKm = Math.min(rayLimitKm * 0.94, baseRadiusKm * opennessBoost);
    const chosenRadiusKm = Number.isFinite(nearestConstraintKm)
      ? Math.min(unconstrainedRadiusKm, nearestConstraintKm)
      : unconstrainedRadiusKm;

    return clamp(chosenRadiusKm, minRadiusKm, rayLimitKm * 0.96);
  });

  const smoothedRadii = rawRadii.map((radius, index) => {
    const prev = rawRadii[(index + directionCount - 1) % directionCount];
    const next = rawRadii[(index + 1) % directionCount];
    return clamp((prev * 0.22) + (radius * 0.56) + (next * 0.22), minRadiusKm, maxRadiusKm);
  });

  let polygon: LocalPoint[] = smoothedRadii.map((radiusKm, index) => {
    const angle = angles[index];
    const stretchX = coastalLoose ? 1.08 : remoteLoose ? 1.04 : 1;
    const stretchY = urbanCompact ? 0.94 : 1;
    return {
      x: clamp(centerX + (Math.cos(angle) * radiusKm * stretchX), cityMinX, cityMaxX),
      y: clamp(centerY + (Math.sin(angle) * radiusKm * stretchY), cityMinY, cityMaxY),
    };
  });

  polygon = simplifyLocalPolygon(polygon).filter((point, index, points) => {
    const previous = points[(index + points.length - 1) % points.length];
    return Math.hypot(point.x - previous.x, point.y - previous.y) > 0.015;
  });

  if (polygon.length < 4 || Math.abs(polygonArea(polygon)) < 0.04) {
    const fallbackRadiusKm = clamp(baseRadiusKm * 1.18, minRadiusKm, maxRadiusKm);
    polygon = Array.from({ length: 12 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 12;
      return {
        x: clamp(centerX + Math.cos(angle) * fallbackRadiusKm, cityMinX, cityMaxX),
        y: clamp(centerY + Math.sin(angle) * fallbackRadiusKm, cityMinY, cityMaxY),
      };
    });
  }

  const ordered = polygonArea(polygon) < 0 ? [...polygon].reverse() : polygon;

  return ordered.map(({ x, y }) => {
    const lat = y / 110.574;
    const lng = x / lngDivider;
    return [
      clamp(lat, cityLatMin - 0.05, cityLatMax + 0.05),
      clamp(lng, cityLngMin - 0.06, cityLngMax + 0.06),
    ] as [number, number];
  });
}


// ── Risk colors ────────────────────────────────────────────────────────────
const RISK_COLORS: Record<string, string> = { critical: '#EF4444', high: '#F97316', medium: '#F59E0B', low: '#3B82F6', safe: '#10B981' };
const RISK_LABELS: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Average', low: 'Low', safe: 'Safe' };

// ── Dynamic flood-risk color from actual fr% value ─────────────────────────
// This replaces static CDN color with a live color based on flood_risk percentage
function floodRiskColor(fr: number): string {
  if (fr >= 80) return '#7C3AED'; // Flooded — purple
  if (fr >= 60) return '#EF4444'; // Risk High — red
  if (fr >= 40) return '#F97316'; // Risk Average — orange
  if (fr >= 20) return '#F59E0B'; // Warning — yellow
  if (fr >= 5)  return '#84CC16'; // Low — green light
  return '#10B981';               // Safe — green
}

// ── Road weight by highway type ────────────────────────────────────────────
function roadWeight(hw: string): number {
  if (hw === 'motorway' || hw === 'trunk') return 4.5;
  if (hw === 'primary') return 3.5;
  if (hw === 'secondary') return 2.5;
  if (hw === 'tertiary') return 2;
  return 1.5;
}

// ── Road risk label ────────────────────────────────────────────────────────
function roadRiskLabel(fr: number): string {
  if (fr >= 80) return 'Flooded';
  if (fr >= 60) return 'Risk High';
  if (fr >= 40) return 'Risk Average';
  if (fr >= 20) return 'Warning';
  if (fr >= 5)  return 'Low';
  return 'Safe';
}

// ── Speed → color ──────────────────────────────────────────────────────────
function speedColor(speed: number, maxSpeed: number): string {
  const ratio = speed / maxSpeed;
  if (ratio > 0.8) return '#10B981';
  if (ratio > 0.55) return '#84CC16';
  if (ratio > 0.35) return '#F59E0B';
  if (ratio > 0.15) return '#EF4444';
  return '#7C3AED';
}

// ── Layer config ───────────────────────────────────────────────────────────
type LayerKey = 'floodZones' | 'roads' | 'adminBoundaries' | 'traffic' | 'contour' | 'evacuation' | 'heatmap' | 'drainage';
type PanelTab = 'layers' | 'stats' | 'zones';
interface LayerConfig { key: LayerKey; labelAr: string; labelEn: string; icon: React.ReactNode; color: string; infoKey: keyof typeof MAP_TOOLTIPS; }
const LAYERS: LayerConfig[] = [
  { key: 'floodZones', labelAr: 'Water accumulation', labelEn: 'Flood Zones', icon: <Droplets size={12} />, color: '#3B82F6', infoKey: 'floodZones' },
  { key: 'roads', labelAr: 'Network Roads', labelEn: 'Road Network', icon: <Map size={12} />, color: '#00d4ff', infoKey: 'roadNetwork' },
  { key: 'adminBoundaries', labelAr: 'Administrative Boundaries', labelEn: 'Admin Boundaries', icon: <Navigation size={12} />, color: '#93C5FD', infoKey: 'adminBoundaries' },
  { key: 'drainage', labelAr: 'Drainage Network', labelEn: 'Drainage', icon: <Gauge size={12} />, color: '#F59E0B', infoKey: 'floodZones' },
  { key: 'traffic', labelAr: 'Traffic', labelEn: 'Traffic', icon: <Car size={12} />, color: '#F97316', infoKey: 'trafficLayer' },
  { key: 'evacuation', labelAr: 'Evacuation Zones', labelEn: 'Evacuation', icon: <AlertTriangle size={12} />, color: '#EF4444', infoKey: 'floodZones' },
  { key: 'heatmap', labelAr: 'Density Risk', labelEn: 'Risk Density', icon: <Activity size={12} />, color: '#8B5CF6', infoKey: 'floodZones' },
];

// ── Traffic phase ──────────────────────────────────────────────────────────
type TrafficPhase = 'before' | 'during' | 'after';

export default function UnifiedMapPage() {
  const { lang } = useLanguage();
  const isMobile = useIsMobile();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const layerGroupsRef = useRef<Record<string, any>>({});
  const roadLayersRef = useRef<Record<string, any>>({});
  const loadedTiersRef = useRef<Set<string>>(new Set());
  // Raw road data for re-rendering with updated precipitation
  const roadRawDataRef = useRef<Record<string, any[]>>({});
  // Current precipitation ref — always up-to-date for use inside async loadRoadTier
  const precipRef = useRef<number>(0);
  // FastFlood-style continuous SVG overlay
  const floodWaterLayerRef = useRef<FloodWaterLayerInstance | null>(null);
  const initialAdminFitDoneRef = useRef(false);

  const [activeLayers, setActiveLayers] = useState<Record<LayerKey, boolean>>({
    floodZones: true, roads: false, adminBoundaries: true, traffic: false, contour: false, evacuation: false, heatmap: false, drainage: false,
  });
  const [trafficPhase, setTrafficPhase] = useState<TrafficPhase>('during');
  const [currentZoom, setCurrentZoom] = useState(11.5);
  const [loadingTier, setLoadingTier] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [officialAdminGeoJson, setOfficialAdminGeoJson] = useState<any | null>(null);
  const [officialCommunityGeoJson, setOfficialCommunityGeoJson] = useState<any | null>(null);
  const [mapStyle, setMapStyle] = useState<'dark' | 'satellite'>('satellite');
  const [timelineIndex, setTimelineIndex] = useState<number>(-1);
  const [showTimeline, setShowTimeline] = useState(true);
  const [precipMultiplier, setPrecipMultiplier] = useState(1.0);
  const [mapReady, setMapReady] = useState(false);

  // ── Real drainage data from OSM + Open-Meteo soil moisture ─────────────────────────
  const { data: drainageResult } = trpc.drainage.getSystems.useQuery(
    undefined,
    { staleTime: 45 * 1000, refetchInterval: 60 * 1000 }
  );
  const drainageData = drainageResult?.data ?? [];
  const mergedDrainagePoints = useMemo(() => {
    if (drainageData.length === 0) return DRAINAGE_POINTS;

    const maxSnapKmByType: Record<string, number> = {
      drain: 18,
      canal: 22,
      wadi: 35,
      stream: 35,
    };

    return DRAINAGE_POINTS.map((basePoint) => {
      const nearest = drainageData.reduce<any | null>((best, candidate: any) => {
        const distanceKm = haversineKm(basePoint.lat, basePoint.lng, candidate.lat, candidate.lng);
        const sameType = candidate.type === basePoint.type;
        const bestDistance = best?.distanceKm ?? Number.POSITIVE_INFINITY;

        if (distanceKm > (maxSnapKmByType[basePoint.type] ?? 20)) return best;
        if (best && best.sameType && !sameType) return best;
        if (best && best.sameType === sameType && distanceKm >= bestDistance) return best;

        return {
          ...candidate,
          distanceKm,
          sameType,
        };
      }, null);

      if (!nearest) {
        return {
          ...basePoint,
          dataMode: 'estimated-anchor',
          anchorNameEn: basePoint.nameEn,
        };
      }

      return {
        ...basePoint,
        efficiency: nearest.efficiency ?? basePoint.efficiency,
        currentLoad: nearest.currentLoad ?? basePoint.currentLoad,
        status: nearest.status ?? basePoint.status,
        soilMoisture01: nearest.soilMoisture01,
        soilMoisture39: nearest.soilMoisture39,
        segmentCount: nearest.segmentCount,
        liveLat: nearest.lat,
        liveLng: nearest.lng,
        liveDistanceKm: nearest.distanceKm,
        dataMode: 'live-snapped',
        anchorNameEn: basePoint.nameEn,
      };
    });
  }, [drainageData]);
  const [panelTab, setPanelTab] = useState<PanelTab>('layers');
  const [showLegend, setShowLegend] = useState(true);
  const [showBadge, setShowBadge] = useState(true);
  const [kpiModal, setKpiModal] = useState<DrillDownType | null>(null);
  const [showWaterSummary, setShowWaterSummary] = useState(false);
  const [showHistoricalPanel, setShowHistoricalPanel] = useState(false);
  const [historicalMode, setHistoricalMode] = useState(false);           // true = showing historical timeline
  const [historicalYear, setHistoricalYear] = useState(2024);            // selected year
  const [historicalMonth, setHistoricalMonth] = useState(4);             // selected month (1-12)
  const [historicalEventActive, setHistoricalEventActive] = useState<{year: number; month: number} | null>(null);
  const [historicalRange, setHistoricalRange] = useState<HistoricalRange | null>(null);  // null = month mode
  const [historicalViewMode, setHistoricalViewMode] = useState<HistViewMode>('month');
  const historicalMarkersRef = useRef<any>(null);

  const { data, isLive, lastUpdated, refresh } = useRealWeather();

  const administrativeAreas = useMemo(() => {
    return ABU_DHABI_EMIRATE.cities.flatMap(city => city.subAreas.map(area => ({ ...area, cityNameAr: city.nameAr, cityNameEn: city.nameEn })));
  }, []);

  const administrativeBounds = useMemo(() => {
    const points = administrativeAreas.flatMap(area => buildAdministrativePolygon(area, administrativeAreas));
    const latitudes = points.map(([lat]) => lat);
    const longitudes = points.map(([, lng]) => lng);
    return L.latLngBounds(
      [Math.min(...latitudes), Math.min(...longitudes)],
      [Math.max(...latitudes), Math.max(...longitudes)],
    );
  }, [administrativeAreas]);

  const administrativeOverlayRegions = useMemo(() => {
    return administrativeAreas.map((area) => {
      const historicalRegion = HISTORICAL_REGIONS.reduce<HistoricalRegion | null>((nearest, candidate) => {
        if (!nearest) return candidate;
        const nearestDistance = haversineKm(area.lat, area.lng, nearest.lat, nearest.lng);
        const candidateDistance = haversineKm(area.lat, area.lng, candidate.lat, candidate.lng);
        return candidateDistance < nearestDistance ? candidate : nearest;
      }, null);

      const historicalSignal = historicalRegion
        ? buildAdminSignalFromHistoricalRegion(
            historicalRegion,
            area.areaSqKm,
            lang,
            historicalMode,
            historicalRange,
            historicalEventActive,
            historicalYear,
            historicalMonth,
          )
        : null;

      const liveRegion = (data?.regions ?? []).reduce<any | null>((nearest, candidate) => {
        if (!nearest) return candidate;
        const nearestDistance = haversineKm(area.lat, area.lng, nearest.lat, nearest.lon);
        const candidateDistance = haversineKm(area.lat, area.lng, candidate.lat, candidate.lon);
        return candidateDistance < nearestDistance ? candidate : nearest;
      }, null);

      const liveSignal = liveRegion
        ? buildAdminSignalFromLiveRegion(liveRegion, area.areaSqKm, lang)
        : null;

      const signal = historicalSignal ?? liveSignal ?? {
        overlayLevel: 'safe' as AdminOverlayLevel,
        depthCm: 0,
        estimatedAreaKm2: 0,
        precipitationValue: 0,
        riskIndex: 0,
        waterLabel: lang === 'ar' ? 'جاف' : 'Dry',
        severityLabel: ADMIN_LEVEL_LABELS.safe[lang],
        dataModeLabel: lang === 'ar' ? 'حي' : 'Live',
        sourceLabel: 'Open-Meteo',
        alertLevel: 'safe' as const,
      };

      return {
        ...area,
        liveRegion,
        historicalRegion,
        ...signal,
        polygon: buildAdministrativePolygon(area, administrativeAreas),
      };
    });
  }, [administrativeAreas, data, historicalMode, historicalRange, historicalEventActive, historicalYear, historicalMonth, lang]);

  const officialDistrictSignals = useMemo(() => {
    return buildAdministrativeFeatureSignals(
      officialAdminGeoJson,
      administrativeAreas,
      data?.regions ?? [],
      lang,
      historicalMode,
      historicalRange,
      historicalEventActive,
      historicalYear,
      historicalMonth,
    );
  }, [officialAdminGeoJson, administrativeAreas, data, lang, historicalMode, historicalRange, historicalEventActive, historicalYear, historicalMonth]);

  const officialCommunitySignals = useMemo(() => {
    return buildAdministrativeFeatureSignals(
      officialCommunityGeoJson,
      administrativeAreas,
      data?.regions ?? [],
      lang,
      historicalMode,
      historicalRange,
      historicalEventActive,
      historicalYear,
      historicalMonth,
    );
  }, [officialCommunityGeoJson, administrativeAreas, data, lang, historicalMode, historicalRange, historicalEventActive, historicalYear, historicalMonth]);

  useEffect(() => {
    let cancelled = false;

    fetch('/data/abu_dhabi_districts.geojson')
      .then((response) => response.json())
      .then((geojson) => {
        if (!cancelled) setOfficialAdminGeoJson(geojson);
      })
      .catch((error) => {
        console.error('Failed to load official administrative GeoJSON:', error);
      });

    fetch('/data/abu_dhabi_communities.geojson')
      .then((response) => response.json())
      .then((geojson) => {
        if (!cancelled) setOfficialCommunityGeoJson(geojson);
      })
      .catch((error) => {
        console.error('Failed to load official community GeoJSON:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Build timeline hours from Open-Meteo real data ──
  const timelineHours = useMemo<TimelineHour[]>(() => {
    if (!data) return [];
    const ref = data.regions.find((r: any) => r.id === 'abudhabi-city') || data.regions[0];
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
  }, [data]);

  // Set initial index to NOW
  useEffect(() => {
    if (timelineHours.length > 0 && timelineIndex === -1) {
      const ni = timelineHours.findIndex(h => h.isNow);
      setTimelineIndex(ni >= 0 ? ni : Math.floor(timelineHours.length / 3));
    }
  }, [timelineHours, timelineIndex]);

  // Compute precipMultiplier from selected hour (or historical event)
  useEffect(() => {
    // ── Historical mode: derive multiplier from event precipitation ──
    if (historicalMode) {
      if (historicalRange) {
        // Range / year mode: use max precipitation in the range
        const eventsInRange = FLOOD_EVENTS.filter(e => {
          const afterFrom = e.year > historicalRange.fromYear || (e.year === historicalRange.fromYear && e.month >= historicalRange.fromMonth);
          const beforeTo  = e.year < historicalRange.toYear   || (e.year === historicalRange.toYear   && e.month <= historicalRange.toMonth);
          return afterFrom && beforeTo;
        });
        if (eventsInRange.length > 0) {
          const maxMm = Math.max(...eventsInRange.map(e => e.max_mm));
          const mult = maxMm === 0
            ? 0.10
            : Math.max(0.35, Math.min(2.5, 0.10 + maxMm * 0.0094));
          setPrecipMultiplier(mult);
        } else {
          setPrecipMultiplier(0.10);
        }
      } else {
        // Month mode: single event
        const ev = FLOOD_EVENTS.find(e => e.year === historicalYear && e.month === historicalMonth);
        if (ev) {
          // Scale: 0mm→0.10 (dry, barely visible), 10mm→0.39, 36mm→0.61, 78mm→0.98, 254mm→2.50
          // Formula: 0.10 + mm * 0.0094, capped at 2.5
          // Dry months (0mm) get 0.10 — no water shown (correct)
          // Light rain (8-15mm) gets 0.38-0.51 — faint patches
          // Moderate (30-50mm) gets 0.58-0.77 — clear patches
          // Extreme (254mm) gets 2.50 — maximum flooding
          const mult = ev.max_mm === 0
            ? 0.10   // completely dry — no visible water
            : Math.max(0.35, Math.min(2.5, 0.10 + ev.max_mm * 0.0094));
          setPrecipMultiplier(mult);
        } else {
          // No data for this month — show minimal dry state
          setPrecipMultiplier(0.10);
        }
      }
      return;
    }
    // ── Live mode ──
    if (timelineHours.length === 0 || timelineIndex < 0) {
      if (data) {
        const maxP = Math.max(...data.regions.map((r: any) => r.currentPrecipitation));
        const maxRisk = Math.max(...data.regions.map((r: any) => r.floodRisk ?? 0));
        const riskFactor = 0.3 + (maxRisk / 100) * 1.7;
        const precipFactor = 1 + maxP * 0.3;
        setPrecipMultiplier(Math.max(0.3, Math.min(2.5, Math.max(riskFactor, precipFactor))));
      }
      return;
    }
    const h = timelineHours[timelineIndex];
    if (!h) return;
    const probFactor = (h.probability ?? 0) / 100;
    const precipVal = h.precipitation ?? 0;
    const mult = precipVal > 0
      ? Math.max(0.5, Math.min(2.5, 0.5 + precipVal * 0.4 + probFactor * 0.5))
      : Math.max(0.3, Math.min(1.2, 0.3 + probFactor * 0.9));
    setPrecipMultiplier(mult);
  }, [timelineIndex, timelineHours, data, historicalMode, historicalYear, historicalMonth, historicalRange]);

  // ── Toggle layer ──────────────────────────────────────────────────────────
  const toggleLayer = useCallback((key: LayerKey) => {
    setActiveLayers(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── Keep precipRef in sync with live weather data ────────────────────────
  useEffect(() => {
    if (!data) return;
    const avg = data.regions.reduce((s, r) => s + r.currentPrecipitation, 0) / Math.max(data.regions.length, 1);
    precipRef.current = avg;
  }, [data]);

  // ── Load road tier from CDN ───────────────────────────────────────────────
  const loadRoadTier = useCallback(async (
    tierKey: string, url: string, map: any, L: any
  ) => {
    if (loadedTiersRef.current.has(tierKey)) return;
    loadedTiersRef.current.add(tierKey);
    setLoadingTier(true);
    try {
      const res = await fetch(url);
      const roads = await res.json();
      // Store raw data for precipitation-based re-rendering
      roadRawDataRef.current[tierKey] = roads;
      // Use current precipitation to adjust colors at load time
      const avgPrecip = precipRef.current;
      const precipFactor = Math.min(avgPrecip / 5, 1.0);
      const group = L.layerGroup();
      roads.forEach((road: any) => {
        // CDN data format: 'c' = coords [lat,lng], 'n' = name, 'h' = highway, 'cl' = CDN color, 'w' = weight, 'fr' = flood_risk %
        const coords = road.c || road.pts;
        if (!coords || coords.length < 2) return;
        const latlngs = coords;
        const hw = road.h || road.hw || 'road';
        const name = road.n || road.nm || hw;
        const frOriginal = road.fr !== undefined ? Math.round(road.fr) : (road.ri || 0);
        // Adjust flood risk: 0 rain → green (low risk), rain > 0 → scale up to original
        const frAdjusted = Math.round(frOriginal * precipFactor + (avgPrecip > 0 ? 5 : 0));
        const floodRisk = frAdjusted;
        const color = floodRiskColor(floodRisk);
        const weight = roadWeight(hw);
        const opacity = floodRisk >= 40 ? 0.95 : floodRisk >= 10 ? 0.85 : 0.65;
        const ref = road.r ? ` — ${road.r}` : '';
        const riskLabel = roadRiskLabel(floodRisk);
        const hwTypeAr = hw === 'motorway' ? 'highway' : hw === 'trunk' ? 'trunk road' : hw === 'primary' ? 'primary road' : hw === 'secondary' ? 'secondary road' : hw === 'residential' ? 'Road Residential' : 'Road Local';
        L.polyline(latlngs, { color, weight, opacity, smoothFactor: 1.2 })
          .bindTooltip(`
          <div style="font-family:Tajawal,sans-serif;direction:rtl;padding:8px 10px;min-width:200px;background:#0d1117;border-radius:6px;">
            <div style="font-size:13px;font-weight:700;color:${color};margin-bottom:4px;">${name}${ref}</div>
            <div style="font-size:10px;color:#94a3b8;margin-bottom:6px;">${hwTypeAr}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
              <div style="background:rgba(255,255,255,0.06);padding:5px;text-align:center;border-radius:4px;">
                <div style="font-size:16px;font-weight:700;color:${color};font-family:monospace;">${floodRisk}%</div>
                <div style="font-size:9px;color:#64748b;">Accumulation Risk</div>
              </div>
              <div style="background:${color}22;padding:5px;text-align:center;border-radius:4px;border:1px solid ${color}44;">
                <div style="font-size:12px;font-weight:700;color:${color};">${riskLabel}</div>
                <div style="font-size:9px;color:#64748b;">Risk Level</div>
              </div>
            </div>
            <div style="margin-top:6px;font-size:10px;color:#475569;">
              ℹ️ color reflects accumulation risk percentage calculated from DEM model + Open-Meteo rainfall
            </div>
          </div>
        `, { className: 'road-tooltip-osm', sticky: true })
          .addTo(group);
      });
      roadLayersRef.current[tierKey] = group;
      if (activeLayers.roads && leafletMapRef.current) group.addTo(leafletMapRef.current);
    } catch (e) { console.error('Road tier load error:', e); }
    finally { setLoadingTier(false); }
  }, [activeLayers.roads]);

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: true,
      center: [24.10, 54.25],
      zoom: 11.5,
      // Performance optimizations
      preferCanvas: true,           // Use Canvas renderer instead of SVG (much faster)
      zoomSnap: 0.5,                // Smoother zoom steps
      zoomDelta: 0.5,               // Smaller zoom increments
      wheelDebounceTime: 40,        // Debounce scroll wheel (ms)
      wheelPxPerZoomLevel: 120,     // Require more scroll to zoom (reduces accidental zoom)
      fadeAnimation: false,         // Disable fade animation (faster)
      markerZoomAnimation: false,   // Disable marker zoom animation
    });
    leafletMapRef.current = map;
    // Signal that map is ready for overlay layers
    setMapReady(true);

    // Base tile layer
    const darkTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: 'OpenStreetMap | Open-Meteo | Copernicus CEMS ©', maxZoom: 19, subdomains: 'abcd',
      updateWhenIdle: true,         // Only update tiles when map stops moving
      keepBuffer: 2,                // Keep 2 tiles outside viewport
    });
    const satelliteTile = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Esri World Imagery', maxZoom: 19,
      updateWhenIdle: true,
      keepBuffer: 2,
    });
    // Default to satellite (aerial photo view)
    satelliteTile.addTo(map);
    (map as any)._darkTile = darkTile;
    (map as any)._satelliteTile = satelliteTile;

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Zoom event
    map.on('zoomend', () => {
      const z = map.getZoom();
      setCurrentZoom(z);
      if (z >= 9) loadRoadTier('tier1', ROAD_CDN.tier1, map, L);
      if (z >= 11) loadRoadTier('tier2', ROAD_CDN.tier2, map, L);
      if (z >= 13) loadRoadTier('tier3', ROAD_CDN.tier3, map, L);
      if (z >= 14) loadRoadTier('tier4', ROAD_CDN.tier4, map, L);
    });

    // Initial load
    loadRoadTier('tier1', ROAD_CDN.tier1, map, L);

    // Fix map size on mobile: invalidate after mount and on container resize
    setTimeout(() => { map.invalidateSize(); }, 150);
    setTimeout(() => { map.invalidateSize(); }, 600);
    const ro = new ResizeObserver(() => { map.invalidateSize(); });
    if (mapRef.current) ro.observe(mapRef.current);
    return () => { ro.disconnect(); map.remove(); leafletMapRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !mapReady || initialAdminFitDoneRef.current) return;
    initialAdminFitDoneRef.current = true;

    const targetInitialZoom = isMobile ? 12 : 11.5;
    map.fitBounds(administrativeBounds.pad(0.06), {
      animate: false,
      padding: isMobile ? [18, 18] : [28, 28],
      maxZoom: targetInitialZoom,
    });

    if (map.getZoom() < 11) {
      map.setView(administrativeBounds.getCenter(), targetInitialZoom, { animate: false });
    } else if (map.getZoom() < targetInitialZoom) {
      map.setZoom(targetInitialZoom, { animate: false });
    }

    setCurrentZoom(map.getZoom());
  }, [administrativeBounds, mapReady, isMobile]);

  // ── Map style toggle ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;
    if (mapStyle === 'satellite') {
      map._darkTile?.remove();
      map._satelliteTile?.addTo(map);
    } else {
      map._satelliteTile?.remove();
      map._darkTile?.addTo(map);
    }
  }, [mapStyle]);

  // ── FastFlood-style continuous SVG flood overlay (4-level zoom-adaptive) ──
  // Initialize the SVG overlay once map is ready, re-run when floodZones toggle changes
  useEffect(() => {
    if (!mapReady) return;
    const map = leafletMapRef.current;
    if (!map) return;
    // Remove existing layer first
    if (floodWaterLayerRef.current) {
      floodWaterLayerRef.current.remove();
      floodWaterLayerRef.current = null;
    }
    if (!activeLayers.floodZones) return;
    // Small delay to ensure panes are fully ready after map init
    const timer = setTimeout(() => {
      const m = leafletMapRef.current;
      if (!m) return;
      floodWaterLayerRef.current = createFloodWaterLayer(m, [], precipMultiplier);
    }, 150);
    return () => clearTimeout(timer);
  }, [mapReady, activeLayers.floodZones]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update SVG overlay when precipMultiplier changes
  useEffect(() => {
    if (floodWaterLayerRef.current) {
      floodWaterLayerRef.current.update(precipMultiplier);
    }
  }, [precipMultiplier]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { floodWaterLayerRef.current?.remove(); };
  }, []);

  // ── Historical event markers on map ──────────────────────────────────────
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;
    if (historicalMarkersRef.current) {
      historicalMarkersRef.current.remove();
      historicalMarkersRef.current = null;
    }
    if (!historicalEventActive && !historicalRange) return;
    const group = L.layerGroup();

    if (historicalRange) {
      // ── Range / year mode: invisible click-only markers (water shown by FloodWaterLayer canvas) ──
      const LEVEL_ORDER = ['safe','minor','moderate','severe','extreme'];
      HISTORICAL_REGIONS.forEach(region => {
        const eventsInRange = region.events.filter(e => {
          const afterFrom = e.year > historicalRange.fromYear || (e.year === historicalRange.fromYear && e.month >= historicalRange.fromMonth);
          const beforeTo  = e.year < historicalRange.toYear   || (e.year === historicalRange.toYear   && e.month <= historicalRange.toMonth);
          return afterFrom && beforeTo;
        });
        if (eventsInRange.length === 0) return;
        const worst = eventsInRange.reduce((best, ev) =>
          LEVEL_ORDER.indexOf(ev.level) > LEVEL_ORDER.indexOf(best.level) ? ev : best
        );
        if (worst.level === 'safe') return;
        const color = LEVEL_COLORS[worst.level];
        const totalPrecip = eventsInRange.reduce((s, e) => s + e.precipMm, 0);
        const maxDepth = Math.max(...eventsInRange.map(e => e.waterDepthCm));
        // Invisible circle — click-only for popup, no visual fill or border
        L.circle([region.lat, region.lng], {
          radius: 3000, color: 'transparent', fillColor: 'transparent', fillOpacity: 0, weight: 0, opacity: 0,
        }).bindPopup(`
          <div style="font-family:Tajawal,sans-serif;direction:rtl;min-width:240px;background:#0d1117;color:#e2e8f0;border-radius:6px;padding:10px;">
            <div style="font-size:14px;font-weight:700;color:${color};margin-bottom:2px;">${region.nameAr}</div>
            <div style="font-size:10px;color:#64748b;margin-bottom:6px;">${region.name} · ${region.region}</div>
            <div style="font-size:9px;color:#FBBF24;margin-bottom:6px;">📅 ${historicalRange.fromYear}/${historicalRange.fromMonth} → ${historicalRange.toYear}/${historicalRange.toMonth} · ${eventsInRange.length} حدث</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;">
              <div style="background:rgba(0,80,200,0.15);border:1px solid rgba(0,120,255,0.3);padding:6px;border-radius:6px;text-align:center;">
                <div style="color:#64748b;font-size:9px;">أقصى عمق</div>
                <div style="color:${color};font-weight:700;font-size:15px;">${maxDepth}<span style="font-size:9px;"> cm</span></div>
              </div>
              <div style="background:rgba(255,255,255,0.05);padding:6px;border-radius:6px;text-align:center;">
                <div style="color:#64748b;font-size:9px;">مجموع هطول</div>
                <div style="color:#42A5F5;font-weight:700;font-size:15px;">${Math.round(totalPrecip)}<span style="font-size:9px;"> mm</span></div>
              </div>
              <div style="background:rgba(255,255,255,0.05);padding:6px;border-radius:6px;text-align:center;">
                <div style="color:#64748b;font-size:9px;">أشد حدث</div>
                <div style="color:#F59E0B;font-weight:700;font-size:15px;">${worst.precipMm}<span style="font-size:9px;"> mm</span></div>
              </div>
            </div>
          </div>
        `, { className: 'flood-popup', maxWidth: 280 }).addTo(group);
      });
    } else if (historicalEventActive) {
      // ── Month mode: invisible click-only markers (water shown by FloodWaterLayer canvas) ──
      const { year, month } = historicalEventActive;
      HISTORICAL_REGIONS.forEach(region => {
        const ev = region.events.find(e => e.year === year && e.month === month);
        if (!ev || ev.level === 'safe') return;
        const color = LEVEL_COLORS[ev.level];
        // Invisible circle — click-only for popup, no visual fill or border
        L.circle([region.lat, region.lng], {
          radius: 2500, color: 'transparent', fillColor: 'transparent', fillOpacity: 0, weight: 0, opacity: 0,
        }).bindPopup(`
          <div style="font-family:Tajawal,sans-serif;direction:rtl;min-width:220px;background:#0d1117;color:#e2e8f0;border-radius:6px;padding:10px;">
            <div style="font-size:14px;font-weight:700;color:${color};margin-bottom:4px;">${region.nameAr}</div>
            <div style="font-size:10px;color:#64748b;margin-bottom:8px;">${region.name} · ${region.region}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
              <div style="background:rgba(0,80,200,0.15);border:1px solid rgba(0,120,255,0.3);padding:8px;border-radius:6px;text-align:center;">
                <div style="color:#64748b;font-size:10px;">عمق المياه</div>
                <div style="color:${color};font-weight:700;font-size:18px;">${ev.waterDepthCm}<span style="font-size:11px;"> cm</span></div>
              </div>
              <div style="background:rgba(255,255,255,0.05);padding:8px;border-radius:6px;text-align:center;">
                <div style="color:#64748b;font-size:10px;">الهطول</div>
                <div style="color:#42A5F5;font-weight:700;font-size:18px;">${ev.precipMm}<span style="font-size:11px;"> mm</span></div>
              </div>
            </div>
            <div style="margin-top:6px;font-size:10px;color:#475569;">📅 ${month}/${year} · ${ev.name}</div>
          </div>
        `, { className: 'flood-popup', maxWidth: 260 }).addTo(group);
      });
    }

    group.addTo(map);
    historicalMarkersRef.current = group;
  }, [historicalEventActive, historicalRange]);

  // Keep legacy L.circle markers for interactive popups (invisible fill, click-only)
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;
    const key = 'floodZones';
    if (layerGroupsRef.current[key]) { layerGroupsRef.current[key].remove(); }
    if (!activeLayers.floodZones) return;
    const group = L.layerGroup();
    const zoom = map.getZoom();
    const zones: FloodZoneMulti[] = getZonesForZoom(zoom);
    zones.forEach((zone: FloodZoneMulti) => {
      // ✅ Skip zones outside Abu Dhabi land boundary (sea, Gulf islands)
      if (!isInsideAbuDhabi(zone.lat, zone.lng)) return;

      const scaledDepthCm = zone.waterDepth * precipMultiplier;
      const riskLabel = { low: 'Low', medium: 'Average', high: 'High', critical: 'Critical' }[zone.riskLevel] || zone.riskLevel;
      const riskLabelAr = { low: 'منخفض', medium: 'متوسط', high: 'عالٍ', critical: 'حرج' }[zone.riskLevel] || zone.riskLevel;
      const levelLabel = zone.level === 1 ? 'City' : zone.level === 2 ? 'Live' : 'Street';
      const levelLabelAr = zone.level === 1 ? 'مستوى المدينة' : zone.level === 2 ? 'مستوى الحي' : 'مستوى الشارع';
      const waterLevel = classifyByDepth(scaledDepthCm);
      const waterPalette = WATER_COLORS[waterLevel];
      const depthLabelAr = WATER_LABELS[waterLevel]?.short_ar || formatDepth(scaledDepthCm, 'ar');
      const accuracyFactor = Math.max(0.82, Math.min(0.98, zone.accuracyPct / 100));
      const levelFactor = zone.level === 1 ? 0.40 : zone.level === 2 ? 0.54 : 0.68;
      const depthFactor = Math.max(0.88, Math.min(1.06, 0.90 + scaledDepthCm / 240));
      const riskFactor = zone.riskLevel === 'critical' ? 1.00 : zone.riskLevel === 'high' ? 0.95 : zone.riskLevel === 'medium' ? 0.90 : 0.86;
      const zRadius = zone.radius * accuracyFactor * levelFactor * depthFactor * riskFactor;
      const zMtoLat = (m: number) => m / 111320;
      const zMtoLng = (m: number) => m / (111320 * Math.cos(zone.lat * Math.PI / 180));
      const zSeed = zone.lat * 1000 + zone.lng;
      const zPts: [number, number][] = Array.from({ length: 18 }, (_, i) => {
        const angle = (i / 18) * Math.PI * 2;
        const jitter = 0.78 + 0.16 * Math.abs(Math.sin(zSeed * 13.7 + i * 2.39));
        const laneBias = 0.84 + 0.12 * Math.cos(zSeed * 5.3 + angle * 2.0);
        return [
          zone.lat + zMtoLat(Math.sin(angle) * zRadius * jitter * 0.88),
          zone.lng + zMtoLng(Math.cos(angle) * zRadius * jitter * laneBias),
        ];
      });

      const popupHTML = `
        <div style="font-family:Tajawal,sans-serif;direction:rtl;min-width:260px;background:#0b1220;color:#e2e8f0;border-radius:10px;padding:12px;border:1px solid ${waterPalette.stroke};box-shadow:0 10px 30px rgba(2,6,23,0.35);">
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;">
            <div style="width:12px;height:12px;border-radius:50%;margin-top:4px;background:${RISK_COLORS[zone.riskLevel]};box-shadow:0 0 12px ${RISK_COLORS[zone.riskLevel]}88;"></div>
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:800;color:#f8fafc;">${zone.nameAr}</div>
              <div style="font-size:10px;color:#64748b;">${zone.nameEn} · ${levelLabelAr} · ${zone.region}</div>
            </div>
            <div style="background:${waterPalette.badge};border:1px solid ${waterPalette.stroke};border-radius:999px;padding:3px 8px;font-size:10px;font-weight:700;color:${waterPalette.badgeText};">${depthLabelAr}</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;">
            <div style="background:rgba(59,130,246,0.10);border:1px solid rgba(96,165,250,0.20);padding:8px;border-radius:8px;">
              <div style="color:#64748b;font-size:10px;">عمق الماء</div>
              <div style="color:${waterPalette.text};font-weight:800;font-size:18px;line-height:1.1;">${scaledDepthCm.toFixed(0)} <span style="font-size:11px;">سم</span></div>
            </div>
            <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.05);padding:8px;border-radius:8px;">
              <div style="color:#64748b;font-size:10px;">الخطورة</div>
              <div style="color:${RISK_COLORS[zone.riskLevel]};font-weight:800;font-size:14px;">${riskLabelAr}</div>
            </div>
            <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.05);padding:8px;border-radius:8px;">
              <div style="color:#64748b;font-size:10px;">الدقة</div>
              <div style="color:#f8fafc;font-weight:800;font-size:14px;">${zone.accuracyPct}%</div>
            </div>
          </div>
          <div style="background:rgba(30,41,59,0.55);border-radius:8px;padding:8px;">
            <div style="display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;margin-bottom:4px;">
              <span>تدرج العمق</span><span>${riskLabel}</span>
            </div>
            <div style="height:8px;border-radius:999px;background:linear-gradient(to right, rgba(219,234,254,0.95), rgba(147,197,253,0.95), rgba(59,130,246,0.95), rgba(29,78,216,0.95), rgba(30,58,138,0.98));"></div>
            <div style="display:flex;justify-content:space-between;font-size:9px;color:#546E7A;margin-top:4px;">
              <span>0.1م</span><span>0.25م</span><span>0.5م</span><span>1م</span><span>2–5م</span>
            </div>
          </div>
          <div style="font-size:10px;color:#64748b;margin-top:8px;">Source: ${zone.source} · Accuracy: ${zone.accuracyPct}% · ${levelLabel}</div>
        </div>
      `;

      L.polygon(zPts, {
        color: 'transparent', fillColor: 'transparent', fillOpacity: 0, weight: 0, interactive: true, smoothFactor: 2.6,
      }).bindPopup(popupHTML, { className: 'flood-popup', maxWidth: 310 })
        .on('click', () => setSelectedFeature({ type: 'flood', zone }))
        .addTo(group);

      const shouldShowSmartTag = zone.riskLevel === 'critical' || zone.riskLevel === 'high' || (zone.level === 3 && scaledDepthCm >= 20);
      if (shouldShowSmartTag) {
        const smartLabel = zone.riskLevel === 'critical' ? 'حرج' : zone.riskLevel === 'high' ? 'عالٍ' : 'مراقبة';
        const smartIcon = zone.riskLevel === 'critical' ? '▲' : zone.riskLevel === 'high' ? '◆' : '●';
        L.marker([zone.lat, zone.lng], {
          interactive: true,
          icon: L.divIcon({
            className: '',
            iconAnchor: [58, 18],
            html: `<div style="display:flex;align-items:center;gap:6px;background:rgba(7,12,24,0.88);backdrop-filter:blur(6px);border:1px solid ${waterPalette.stroke};border-right:3px solid ${RISK_COLORS[zone.riskLevel]};box-shadow:0 8px 24px rgba(2,6,23,0.32);border-radius:10px;padding:5px 8px;white-space:nowrap;font-family:Tajawal,sans-serif;">
              <div style="width:18px;height:18px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:${waterPalette.badge};color:${waterPalette.badgeText};font-size:11px;font-weight:800;">${smartIcon}</div>
              <div style="display:flex;flex-direction:column;line-height:1.15;">
                <span style="font-size:10px;font-weight:800;color:${RISK_COLORS[zone.riskLevel]};">${smartLabel}</span>
                <span style="font-size:10px;color:#dbeafe;">${zone.nameAr}</span>
              </div>
              <div style="margin-right:4px;padding-right:4px;border-right:1px solid rgba(255,255,255,0.08);text-align:left;">
                <div style="font-size:11px;font-weight:800;color:${waterPalette.text};font-family:monospace;">${Math.round(scaledDepthCm)} سم</div>
                <div style="font-size:9px;color:#64748b;">${zone.accuracyPct}% دقة</div>
              </div>
            </div>`,
          }),
        })
          .bindPopup(popupHTML, { className: 'flood-popup', maxWidth: 310 })
          .addTo(group);
      }
    });
    group.addTo(map);
    layerGroupsRef.current[key] = group;
  }, [activeLayers.floodZones, precipMultiplier, currentZoom]);

  // ── Roads layer ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;
    Object.entries(roadLayersRef.current).forEach(([, grp]) => {
      if (activeLayers.roads) grp.addTo(map);
      else grp.remove();
    });
  }, [activeLayers.roads]);

  // ── Re-render roads when precipitation changes ────────────────────────────
  // When rain = 0: roads show green (safe). When rain > 0: colors reflect flood risk.
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !L || !data) return;

    // Compute average precipitation across all regions
    const avgPrecip = data.regions.reduce((s, r) => s + r.currentPrecipitation, 0) / Math.max(data.regions.length, 1);
    // Scale factor: 0 mm → factor=0.15 (mostly green), 5+ mm → factor=1.0 (full risk)
    const precipFactor = Math.min(avgPrecip / 5, 1.0);

    Object.entries(roadRawDataRef.current).forEach(([tierKey, roads]) => {
      // Remove old layer
      if (roadLayersRef.current[tierKey]) {
        roadLayersRef.current[tierKey].remove();
        delete roadLayersRef.current[tierKey];
      }
      const group = L.layerGroup();
      roads.forEach((road: any) => {
        const coords = road.c || road.pts;
        if (!coords || coords.length < 2) return;
        const hw = road.h || road.hw || 'road';
        const name = road.n || road.nm || hw;
        const frOriginal = road.fr !== undefined ? Math.round(road.fr) : (road.ri || 0);
        // Adjust flood risk based on live precipitation:
        // At 0 rain: show max 15% risk (green). At full rain: show original risk.
        const frAdjusted = Math.round(frOriginal * precipFactor + (avgPrecip > 0 ? 5 : 0));
        const color = floodRiskColor(frAdjusted);
        const weight = roadWeight(hw);
        const opacity = frAdjusted >= 40 ? 0.95 : frAdjusted >= 10 ? 0.85 : 0.65;
        const riskLabel = roadRiskLabel(frAdjusted);
        const hwTypeAr = hw === 'motorway' ? 'highway' : hw === 'trunk' ? 'trunk road' : hw === 'primary' ? 'primary road' : hw === 'secondary' ? 'secondary road' : hw === 'residential' ? 'Road Residential' : 'Road Local';
        const ref = road.r ? ` — ${road.r}` : '';
        L.polyline(coords, { color, weight, opacity, smoothFactor: 1.2 })
          .bindTooltip(`
          <div style="font-family:Tajawal,sans-serif;direction:rtl;padding:8px 10px;min-width:200px;background:#0d1117;border-radius:6px;">
            <div style="font-size:13px;font-weight:700;color:${color};margin-bottom:4px;">${name}${ref}</div>
            <div style="font-size:10px;color:#94a3b8;margin-bottom:6px;">${hwTypeAr}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
              <div style="background:rgba(255,255,255,0.06);padding:5px;text-align:center;border-radius:4px;">
                <div style="font-size:16px;font-weight:700;color:${color};font-family:monospace;">${frAdjusted}%</div>
                <div style="font-size:9px;color:#64748b;">Accumulation Risk (current)</div>
              </div>
              <div style="background:${color}22;padding:5px;text-align:center;border-radius:4px;border:1px solid ${color}44;">
                <div style="font-size:12px;font-weight:700;color:${color};">${riskLabel}</div>
                <div style="font-size:9px;color:#64748b;">Risk Level</div>
              </div>
            </div>
            <div style="margin-top:6px;font-size:9px;color:#475569;">
              🌧️ Current Rainfall: ${avgPrecip.toFixed(1)} mm/hr · Historical Risk: ${frOriginal}%
            </div>
          </div>
        `, { className: 'road-tooltip-osm', sticky: true })
          .addTo(group);
      });
      roadLayersRef.current[tierKey] = group;
      if (activeLayers.roads && map) group.addTo(map);
    });
  }, [data, activeLayers.roads]);

  // ── Traffic layer ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;
    const key = 'traffic';
    if (layerGroupsRef.current[key]) { layerGroupsRef.current[key].remove(); }
    if (!activeLayers.traffic) return;
    const group = L.layerGroup();
    TRAFFIC_SEGMENTS.forEach(seg => {
      const speed = seg[trafficPhase];
      const color = speedColor(speed, seg.before);
      const weight = 5;
      L.polyline(seg.coords, { color, weight, opacity: 0.9, smoothFactor: 1 })
        .bindTooltip(`
          <div style="font-family:Tajawal,sans-serif;direction:rtl;">
            <b>${seg.nameAr}</b><br>
            Speed: <b style="color:${color}">${speed} km/hr</b><br>
            Water Depth: ${seg.floodDepth} cm
          </div>
        `, { className: 'road-tooltip-osm', sticky: true })
        .addTo(group);
      // Speed label at midpoint
      const mid = seg.coords[Math.floor(seg.coords.length / 2)];
      L.marker(mid, {
        icon: L.divIcon({
          html: `<div style="background:${color};color:#fff;font-size:10px;font-weight:700;padding:2px 5px;border-radius:4px;white-space:nowrap;font-family:Tajawal;">${speed} km/hr</div>`,
          className: '', iconAnchor: [20, 10],
        }),
      }).addTo(group);
    });
    group.addTo(map);
    layerGroupsRef.current[key] = group;
  }, [activeLayers.traffic, trafficPhase]);

  // ── Evacuation layer (dynamic — built from URBAN_ZONES + precipMultiplier) ─
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;
    const key = 'evacuation';
    if (layerGroupsRef.current[key]) { layerGroupsRef.current[key].remove(); }
    if (!activeLayers.evacuation) return;
    const group = L.layerGroup();
    const zones = buildEvacZones(precipMultiplier);
    zones.forEach(zone => {
      const color = zone.decision === 'immediate' ? '#EF4444' : '#F59E0B';
      const fillOpacity = zone.decision === 'immediate' ? 0.18 : 0.10;
      L.polygon(zone.coords as [number, number][], {
        color, fillColor: color, fillOpacity,
        weight: zone.decision === 'immediate' ? 2.5 : 1.8,
        dashArray: zone.decision === 'immediate' ? '8 4' : '5 6',
      })
        .bindPopup(`
          <div style="font-family:Tajawal,sans-serif;direction:rtl;min-width:190px;">
            <div style="font-size:13px;font-weight:700;color:${color};margin-bottom:4px;">🚨 ${zone.nameAr}</div>
            <div style="font-size:11px;color:#94a3b8;margin-bottom:3px;">Population: ${zone.population}</div>
            <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">Estimated Depth: ${zone.depthEst} cm</div>
            <div style="padding:4px 8px;background:${color}22;border-radius:4px;color:${color};font-size:10px;font-weight:600;">
              ${zone.decision === 'immediate' ? '🔴 Evacuation Immediate' : '🟡 Warning — Prepare to Evacuate'}
            </div>
          </div>
        `, { className: 'flood-popup' })
        .addTo(group);
    });
    group.addTo(map);
    layerGroupsRef.current[key] = group;
  }, [activeLayers.evacuation, precipMultiplier]);

  // ── Heatmap layer ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;
    const key = 'heatmap';
    if (layerGroupsRef.current[key]) { layerGroupsRef.current[key].remove(); }
    if (!activeLayers.heatmap) return;
    const group = L.layerGroup();
    FLOOD_ZONES.forEach(zone => {
      // ✅ Skip zones outside Abu Dhabi land boundary
      if (!isInsideAbuDhabi(zone.lat, zone.lng)) return;
      const intensity = zone.waterDepth / 100;
      const radius = 30 + zone.waterDepth * 0.8;
      const color = zone.riskLevel === 'critical' ? '#EF4444' : zone.riskLevel === 'high' ? '#F97316' : zone.riskLevel === 'medium' ? '#F59E0B' : '#3B82F6';
      const riskPct = zone.riskLevel === 'critical' ? 90 : zone.riskLevel === 'high' ? 70 : zone.riskLevel === 'medium' ? 45 : 20;
      const heatTooltip = `
        <div style="font-family:Tajawal,sans-serif;direction:rtl;padding:6px 8px;min-width:180px;">
          <div style="font-size:12px;font-weight:700;color:${color};margin-bottom:4px;">${zone.nameAr}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:4px;">
            <div style="background:rgba(255,255,255,0.08);padding:4px;text-align:center;">
              <div style="font-size:14px;font-weight:700;color:${color};font-family:monospace;">${zone.waterDepth} cm</div>
              <div style="font-size:9px;color:#94a3b8;">Water Depth</div>
            </div>
            <div style="background:rgba(255,255,255,0.08);padding:4px;text-align:center;">
              <div style="font-size:14px;font-weight:700;color:${color};font-family:monospace;">${riskPct}%</div>
              <div style="font-size:9px;color:#94a3b8;">risk index</div>
            </div>
          </div>
          <div style="font-size:10px;color:#94a3b8;">
            📐 Area: ${(zone.area / 1_000_000).toFixed(2)} km²<br>
            🔴 Risk Level: <b style="color:${color};">${{ critical: 'Critical', high: 'High', medium: 'Average', low: 'Low' }[zone.riskLevel]}</b><br>
            🛣️ Affected Roads: ${zone.affectedRoads.slice(0,2).join(' · ')}
          </div>
        </div>
      `;
      L.circle([zone.lat, zone.lng], {
        radius: radius * 100, color: 'transparent', fillColor: color, fillOpacity: Math.min(0.35, 0.15 + intensity * 0.3),
      })
        .bindTooltip(heatTooltip, { className: 'road-tooltip-osm', sticky: true, direction: 'top' })
        .addTo(group);
    });
    group.addTo(map);
    layerGroupsRef.current[key] = group;
  }, [activeLayers.heatmap]);

   // ── Drainage layer ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;
    const key = 'drainage';
    if (layerGroupsRef.current[key]) { layerGroupsRef.current[key].remove(); }
    if (!activeLayers.drainage) return;
    const group = L.layerGroup();
    // Use curated anchor locations, enriched with nearest live OSM metrics when available.
    // This keeps drainage points in realistic urban/reference positions instead of raw OSM centroids.
    const points: any[] = mergedDrainagePoints;
    const hasLiveMetrics = drainageData.length > 0;

    points.forEach((pt: any) => {
      // ✅ Skip drainage points outside Abu Dhabi land boundary
      if (!isInsideAbuDhabi(pt.lat, pt.lng)) return;

      const eff = pt.efficiency ?? Math.max(0, 100 - pt.currentLoad);
      const status: string = pt.status ?? (eff >= 80 ? 'operational' : eff >= 60 ? 'degraded' : eff >= 40 ? 'overloaded' : 'blocked');
      const color =
        status === 'operational' ? '#10B981' :
        status === 'degraded'    ? '#F59E0B' :
        status === 'overloaded'  ? '#F97316' :
                                   '#EF4444';
      const statusAr =
        status === 'operational' ? 'يعمل بكفاءة' :
        status === 'degraded'    ? 'أداء مخفض' :
        status === 'overloaded'  ? 'حمل زائد' :
                                   'محجوب / معطل';
      const typeLabelEn = ({ drain: 'Drain', canal: 'Canal', wadi: 'Wadi', stream: 'Stream' } as Record<string, string>)[pt.type] ?? 'Drain';
      const name = pt.nameAr || pt.nameEn || typeLabelEn;

      // Icon size by type: wadi/stream > canal > drain
      const iconSize = (pt.type === 'wadi' || pt.type === 'stream') ? 16 : pt.type === 'canal' ? 13 : 11;
      const innerSize = Math.round(iconSize * 0.45);
      const icon = L.divIcon({
        html: `<div style="width:${iconSize}px;height:${iconSize}px;border-radius:50%;background:${color}22;border:2.5px solid ${color};box-shadow:0 0 8px ${color}88;display:flex;align-items:center;justify-content:center;">
          <div style="width:${innerSize}px;height:${innerSize}px;border-radius:50%;background:${color};opacity:${(0.5 + eff / 200).toFixed(2)};"></div>
        </div>`,
        className: '', iconSize: [iconSize, iconSize], iconAnchor: [iconSize / 2, iconSize / 2],
      });

      const loadColor = pt.currentLoad > 80 ? '#EF4444' : pt.currentLoad > 60 ? '#F59E0B' : '#10B981';
      const smInfo = hasLiveMetrics && pt.soilMoisture01 != null
        ? `<div style="display:flex;justify-content:space-between;margin-top:4px;">
            <span style="color:#94a3b8;font-size:10px;">رطوبة التربة (0–1cm)</span>
            <span style="color:#60a5fa;font-weight:700;">${(pt.soilMoisture01 * 100).toFixed(1)}%</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:#94a3b8;font-size:10px;">رطوبة التربة (3–9cm)</span>
            <span style="color:#60a5fa;font-weight:700;">${(pt.soilMoisture39 * 100).toFixed(1)}%</span>
          </div>`
        : '';
      const dataSourceBadge = pt.dataMode === 'live-snapped'
        ? `<div style="font-size:9px;color:#10B981;margin-top:4px;">&#9679; موقع مرجعي ثابت + حالة حية من OSM/Open-Meteo${pt.liveDistanceKm ? ` • مطابقة ${(pt.liveDistanceKm).toFixed(1)} كم` : ''}</div>`
        : `<div style="font-size:9px;color:#64748b;margin-top:4px;">&#9675; موقع مرجعي تقديري ثابت</div>`;
      const segInfo = pt.segmentCount > 1 ? ` • ${pt.segmentCount} مقطع` : '';
      const nameEn2 = pt.nameEn && pt.nameEn !== name ? ` • ${pt.nameEn}` : '';
      const tooltip = `<div style="font-family:'Tajawal',sans-serif;direction:rtl;font-size:11px;min-width:200px;padding:4px 2px;">
        <div style="font-weight:700;color:${color};margin-bottom:3px;">${name}</div>
        <div style="font-size:10px;color:#94a3b8;margin-bottom:6px;">${typeLabelEn}${nameEn2}${segInfo}</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
          <span style="color:#94a3b8;font-size:10px;">كفاءة الشبكة</span>
          <span style="color:${color};font-weight:700;">${eff}%</span>
        </div>
        <div style="background:#1e293b;border-radius:3px;height:6px;margin-bottom:6px;overflow:hidden;">
          <div style="width:${eff}%;height:100%;background:${color};border-radius:3px;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
          <span style="color:#94a3b8;font-size:10px;">حمل حالي</span>
          <span style="color:${loadColor};font-weight:700;">${pt.currentLoad}%</span>
        </div>
        <div style="background:#1e293b;border-radius:3px;height:6px;margin-bottom:6px;overflow:hidden;">
          <div style="width:${pt.currentLoad}%;height:100%;background:${loadColor};border-radius:3px;"></div>
        </div>
        ${smInfo}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
          <span style="background:${color}22;color:${color};padding:1px 6px;border-radius:10px;font-size:10px;font-weight:600;">${statusAr}</span>
          <span style="color:#64748b;font-size:10px;">${(pt.capacity ?? 0).toLocaleString()} m³/hr</span>
        </div>
        ${dataSourceBadge}
      </div>`;

      L.marker([pt.lat, pt.lng], { icon })
        .bindTooltip(tooltip, { direction: 'top', className: 'road-tooltip-osm', sticky: false })
        .addTo(group);
    });
    group.addTo(map);
    layerGroupsRef.current[key] = group;
  }, [activeLayers.drainage, drainageData, mergedDrainagePoints]);

  // ── Administrative fill overlay (water tint inside administrative areas) ──
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !L) return;
    const key = 'adminRegionsFill';
    if (layerGroupsRef.current[key]) { layerGroupsRef.current[key].remove(); }
    if (!activeLayers.floodZones || activeLayers.adminBoundaries || currentZoom < 11) return;

    const adminFillPane = map.getPane('admin-fill-pane') ?? map.createPane('admin-fill-pane');
    adminFillPane.style.zIndex = '640';
    adminFillPane.style.pointerEvents = 'none';

    const adminFillRenderer = L.svg({ pane: 'admin-fill-pane', padding: 0.5 });
    adminFillRenderer.addTo(map);
    const group = L.layerGroup();

    administrativeOverlayRegions.forEach((area) => {
      const palette = ADMIN_OVERLAY_COLORS[area.overlayLevel] ?? ADMIN_OVERLAY_COLORS.safe;

      const baseFillOpacity = area.overlayLevel === 'extreme'
        ? 0.68
        : area.overlayLevel === 'severe'
        ? 0.58
        : area.overlayLevel === 'moderate'
        ? 0.44
        : area.overlayLevel === 'minor'
        ? 0.32
        : 0.16;
      const fillOpacity = isMobile && currentZoom < 13 ? Math.max(0.10, baseFillOpacity * 0.58) : baseFillOpacity;

      L.polygon(area.polygon, {
        pane: 'admin-fill-pane',
        renderer: adminFillRenderer,
        color: palette.stroke,
        fillColor: palette.fill,
        fillOpacity,
        weight: currentZoom >= 13 ? 1.2 : 0.8,
        opacity: 0.45,
        smoothFactor: 1.1,
        interactive: false,
      }).addTo(group);
    });

    group.addTo(map);
    layerGroupsRef.current[key] = group;
  }, [activeLayers.floodZones, administrativeOverlayRegions, currentZoom, isMobile]);

  // ── Administrative boundary layer (independent layer like roads) ──────────
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !L) return;
    const key = 'adminBoundaries';
    if (layerGroupsRef.current[key]) { layerGroupsRef.current[key].remove(); }
    if (!activeLayers.adminBoundaries || currentZoom < 11 || !officialAdminGeoJson) return;

    const adminFillPane = map.getPane('official-admin-fill-pane') ?? map.createPane('official-admin-fill-pane');
    adminFillPane.style.zIndex = '641';
    adminFillPane.style.pointerEvents = 'none';

    const adminBoundaryPane = map.getPane('admin-boundary-pane') ?? map.createPane('admin-boundary-pane');
    adminBoundaryPane.style.zIndex = '642';
    adminBoundaryPane.style.pointerEvents = 'auto';

    const useCommunities = currentZoom >= 13.5 && !!officialCommunityGeoJson;
    const sourceGeoJson = useCommunities ? officialCommunityGeoJson : officialAdminGeoJson;
    const signalMaps = useCommunities ? officialCommunitySignals : officialDistrictSignals;

    const resolveFeatureSignal = (feature: any) => {
      const props = feature?.properties ?? {};
      const objectMatch = props.OBJECTID !== undefined && props.OBJECTID !== null
        ? signalMaps.byObjectId[String(props.OBJECTID)]
        : null;
      const districtMatch = props.DISTRICTID !== undefined && props.DISTRICTID !== null
        ? signalMaps.byDistrictId[String(props.DISTRICTID)]
        : null;
      return objectMatch ?? districtMatch ?? null;
    };

    const boundaryWeight = useCommunities
      ? (isMobile ? 0.95 : 1.15)
      : (isMobile ? 1.35 : 1.7);

    const boundaryColor = useCommunities ? '#7DD3FC' : '#93C5FD';
    const boundaryOpacity = useCommunities ? 0.72 : 0.92;
    const group = L.geoJSON(sourceGeoJson, {
      pane: 'admin-boundary-pane',
      style: (feature) => {
        const matched = resolveFeatureSignal(feature);
        const overlayLevel: AdminOverlayLevel = matched?.signal.overlayLevel ?? 'safe';
        const palette = ADMIN_OVERLAY_COLORS[overlayLevel] ?? ADMIN_OVERLAY_COLORS.safe;
        const baseFillOpacity = overlayLevel === 'extreme'
          ? 0.44
          : overlayLevel === 'severe'
          ? 0.34
          : overlayLevel === 'moderate'
          ? 0.24
          : overlayLevel === 'minor'
          ? 0.16
          : 0.08;
        return {
          pane: 'admin-boundary-pane',
          color: palette.stroke ?? boundaryColor,
          weight: boundaryWeight,
          opacity: boundaryOpacity,
          fillColor: palette.fill,
          fillOpacity: activeLayers.floodZones ? baseFillOpacity : 0,
          dashArray: useCommunities ? undefined : (currentZoom >= 14 ? undefined : '3 4'),
        };
      },
      onEachFeature: (feature, layer) => {
        const matched = resolveFeatureSignal(feature);
        const props = feature?.properties ?? {};
        const nameAr = props.NAMEARABIC ?? props.ARABIC_NAME ?? props.COMMUNITYNAMEARA ?? props.DISTRICTARA ?? 'منطقة إدارية';
        const nameEn = props.NAMEENGLISH ?? props.ENGLISH_NAME ?? props.COMMUNITYNAMEENG ?? props.DISTRICTNAMEENG ?? 'Administrative District';
        const municipality = props.MUNICIPALITYNAME ?? props.MUN_NAME_EN ?? props.MUNICIPALITY ?? 'Abu Dhabi';
        const districtId = props.DISTRICTID ?? props.DISTRICTID_OID ?? props.OBJECTID ?? '—';
        const parentDistrict = props.DISTRICTNAMEENG ?? props.DISTRICTARA ?? props.NAMEENGLISH ?? props.NAMEARABIC ?? '—';

        const signal = matched?.signal;
        const tooltipOverlayLevel: AdminOverlayLevel = signal?.overlayLevel ?? 'safe';
        const palette = ADMIN_OVERLAY_COLORS[tooltipOverlayLevel] ?? ADMIN_OVERLAY_COLORS.safe;
        const severity = signal?.severityLabel ?? ADMIN_LEVEL_LABELS.safe[lang];
        const riskIndex = signal?.riskIndex ?? 0;
        const depthCm = signal?.depthCm ?? 0;
        const precipMm = signal?.precipitationValue ?? 0;
        const waterLabel = signal?.waterLabel ?? (lang === 'ar' ? 'لا توجد مياه مرصودة' : 'No detected water');
        const sourceLabelResolved = signal?.sourceLabel ?? 'Open-Meteo';
        const areaKm2 = signal?.estimatedAreaKm2 ?? 0;

        layer.bindTooltip(`
          <div style="font-family:Tajawal,sans-serif;direction:rtl;min-width:260px;background:#0a0f1e;color:#e2e8f0;border-radius:10px;padding:12px;border:1px solid ${palette.stroke};">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <div style="width:10px;height:10px;border-radius:50%;background:${palette.fill};box-shadow:0 0 10px ${palette.fill};"></div>
              <div>
                <div style="font-size:14px;font-weight:800;color:${palette.text};">${nameAr}</div>
                <div style="font-size:10px;color:#94a3b8;">${nameEn}</div>
              </div>
              <div style="margin-right:auto;background:${palette.fill};border:1px solid ${palette.stroke};border-radius:999px;padding:3px 8px;font-size:10px;font-weight:700;color:${palette.text};">${severity}</div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px;">
              <div style="background:rgba(255,255,255,0.05);padding:6px;border-radius:6px;text-align:center;border:1px solid rgba(255,255,255,0.08);">
                <div style="font-size:16px;font-weight:800;color:${palette.text};font-family:monospace;">${depthCm}</div>
                <div style="font-size:8px;color:#94a3b8;margin-top:2px;">${lang === 'ar' ? 'سم ماء' : 'cm water'}</div>
              </div>
              <div style="background:rgba(255,255,255,0.05);padding:6px;border-radius:6px;text-align:center;border:1px solid rgba(255,255,255,0.08);">
                <div style="font-size:16px;font-weight:800;color:${palette.text};font-family:monospace;">${riskIndex}%</div>
                <div style="font-size:8px;color:#94a3b8;margin-top:2px;">${lang === 'ar' ? 'مؤشر الخطر' : 'Risk index'}</div>
              </div>
              <div style="background:rgba(255,255,255,0.05);padding:6px;border-radius:6px;text-align:center;border:1px solid rgba(255,255,255,0.08);">
                <div style="font-size:16px;font-weight:800;color:${palette.text};font-family:monospace;">${areaKm2.toFixed(1)}</div>
                <div style="font-size:8px;color:#94a3b8;margin-top:2px;">${lang === 'ar' ? 'كم² متأثر' : 'km² affected'}</div>
              </div>
            </div>
            <div style="font-size:9px;color:#cbd5e1;line-height:1.7;">
              ${lang === 'ar' ? 'البلدية' : 'Municipality'}: ${municipality}<br/>
              ${lang === 'ar' ? 'المعرف' : 'ID'}: ${districtId}<br/>
              ${lang === 'ar' ? 'مستوى الحدود' : 'Boundary level'}: ${useCommunities ? (lang === 'ar' ? 'Community' : 'Community') : (lang === 'ar' ? 'District' : 'District')}<br/>
              ${useCommunities ? `${lang === 'ar' ? 'المنطقة الأم' : 'Parent district'}: ${parentDistrict}<br/>` : ''}
              ${lang === 'ar' ? 'الهطول المرجعي' : 'Reference precipitation'}: ${precipMm.toFixed(1)} mm<br/>
              ${lang === 'ar' ? 'وصف الحالة' : 'Status note'}: ${waterLabel}<br/>
              ${lang === 'ar' ? 'المصدر' : 'Source'}: ${sourceLabelResolved}<br/>
              ${lang === 'ar' ? 'نوع الطبقة' : 'Layer type'}: ${lang === 'ar' ? 'حدود إدارية رسمية ملوّنة ديناميكياً' : 'Official administrative boundary with dynamic fill'}
            </div>
          </div>
        `, { className: 'flood-popup', sticky: true, direction: 'top' });
      },
    });

    group.addTo(map);
    layerGroupsRef.current[key] = group;
  }, [activeLayers.adminBoundaries, activeLayers.floodZones, officialAdminGeoJson, officialCommunityGeoJson, officialDistrictSignals, officialCommunitySignals, currentZoom, lang, isMobile]);

  // ── Live Water Accumulation Layer (Hybrid: ERA5 + GloFAS + DEM) ──────────
  // Renders a circle for every region that has water accumulation detected.
  // Circle size = estimated flooded area, color = accumulation level.
  // Updates whenever live weather data refreshes (every 2 minutes).
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !L || !data) return;
    const key = 'liveAccumulation';
    if (layerGroupsRef.current[key]) { layerGroupsRef.current[key].remove(); }
    const group = L.layerGroup();

    data.regions.forEach((region: any) => {
      const acc = region.waterAccumulation;
      if (!acc || acc.level === 'none') return;

      // ✅ Use unified waterStandard for all colors and labels
      const palette = WATER_COLORS[acc.level as keyof typeof WATER_COLORS] || WATER_COLORS.minor;
      const color   = palette.fill;
      const mapFill = palette.mapFill;
      const stroke  = palette.mapStroke;
      const icon    = WATER_ICONS[acc.level as keyof typeof WATER_ICONS] || '💧';
      const labelAr = WATER_LABELS[acc.level as keyof typeof WATER_LABELS]?.ar || acc.level;
      const labelEn = WATER_LABELS[acc.level as keyof typeof WATER_LABELS]?.en || acc.level;
      const lat = region.lat;
      const lon = region.lon;
      if (!lat || !lon) return;
      // ✅ Skip regions outside Abu Dhabi land boundary (islands in Gulf, sea areas)
      if (!isInsideAbuDhabi(lat, lon)) return;

      // Radius based on estimated area (min 500m, max 8km)
      const radiusM = Math.max(500, Math.min(8000, Math.sqrt(acc.estimatedAreaKm2 * 1_000_000 / Math.PI)));

      // ── Build organic irregular polygon (replaces perfect circle) ──────────
      // Converts a radius in meters to approximate lat/lng degrees at this location
      const mToLat = (m: number) => m / 111320;
      const mToLng = (m: number) => m / (111320 * Math.cos(lat * Math.PI / 180));
      // Deterministic seed per region for stable shape across renders
      const shapeSeed = lat * 1000 + lon;
      // Generate N perturbed radial points for an organic polygon shape
      function makeOrganicPoly(cLat: number, cLon: number, rM: number, N: number, s: number): [number, number][] {
        const pts: [number, number][] = [];
        for (let i = 0; i < N; i++) {
          const angle = (i / N) * Math.PI * 2;
          // Softer per-vertex jitter to keep water patches organic without looking spiky/heavy
          const jitter = 0.80 + 0.20 * Math.abs(Math.sin(s * 17.3 + i * 2.39 + angle));
          // Gentler elongation for a smoother flooded-area silhouette
          const rx = rM * jitter * (1.0 + 0.10 * Math.sin(s * 7.1));
          const ry = rM * jitter * (0.86 + 0.10 * Math.cos(s * 5.3));
          pts.push([
            cLat + mToLat(Math.sin(angle) * ry),
            cLon + mToLng(Math.cos(angle) * rx),
          ]);
        }
        return pts;
      }
      const polyPts = makeOrganicPoly(lat, lon, radiusM, 28, shapeSeed);
      const outerPolyPts = makeOrganicPoly(lat, lon, radiusM * 1.22, 28, shapeSeed + 0.5);

      // Outer halo for severe/extreme — softer glow without a visible dashed edge
      if (acc.level === 'severe' || acc.level === 'extreme') {
        L.polygon(outerPolyPts, {
          color: 'transparent', fillColor: mapFill,
          fillOpacity: acc.level === 'extreme' ? 0.06 : 0.04,
          weight: 0,
          opacity: 0,
          smoothFactor: 4.6,
          interactive: false,
        }).addTo(group);
      }

      // Main accumulation polygon — lighter fill and softer border so water reads cleaner on the basemap
      const fillOpacity = acc.level === 'extreme' ? 0.18 : acc.level === 'severe' ? 0.15 : acc.level === 'moderate' ? 0.11 : acc.level === 'minor' ? 0.07 : 0.05;
      const weight      = acc.level === 'extreme' ? 0.9 : acc.level === 'severe' ? 0.7 : 0.45;

      L.polygon(polyPts, {
        color: stroke, fillColor: mapFill,
        fillOpacity, weight,
        opacity: 0.35,
        smoothFactor: 4.8,
      }).bindTooltip(`
        <div style="font-family:Tajawal,sans-serif;direction:rtl;min-width:260px;background:#0a0f1e;color:#e2e8f0;border-radius:10px;padding:14px;border:1px solid ${stroke};">
          <!-- Header -->
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-size:20px;">${icon}</span>
            <div>
              <div style="font-size:14px;font-weight:800;color:${color};">${region.nameAr}</div>
              <div style="font-size:10px;color:#64748b;">${region.nameEn}</div>
            </div>
            <div style="margin-right:auto;background:${mapFill};border:1px solid ${stroke};border-radius:5px;padding:3px 8px;font-size:10px;font-weight:700;color:${color};">${labelAr}</div>
          </div>
          <!-- Metrics grid -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px;">
            <div style="background:rgba(255,255,255,0.05);padding:6px;border-radius:6px;text-align:center;border:1px solid rgba(255,255,255,0.08);">
              <div style="font-size:18px;font-weight:800;color:${color};font-family:monospace;">${acc.score}</div>
              <div style="font-size:8px;color:#64748b;margin-top:2px;">مؤشر التجمع</div>
            </div>
            <div style="background:rgba(255,255,255,0.05);padding:6px;border-radius:6px;text-align:center;border:1px solid rgba(255,255,255,0.08);">
              <div style="font-size:18px;font-weight:800;color:#42A5F5;font-family:monospace;">${acc.estimatedDepthCm}</div>
              <div style="font-size:8px;color:#64748b;margin-top:2px;">العمق (سم)</div>
            </div>
            <div style="background:rgba(255,255,255,0.05);padding:6px;border-radius:6px;text-align:center;border:1px solid rgba(255,255,255,0.08);">
              <div style="font-size:18px;font-weight:800;color:#10B981;font-family:monospace;">${acc.estimatedAreaKm2}</div>
              <div style="font-size:8px;color:#64748b;margin-top:2px;">المساحة (كم²)</div>
            </div>
          </div>
          <!-- Depth bar -->
          <div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;font-size:8px;color:#64748b;margin-bottom:3px;">
              <span>العمق التقديري</span><span>${acc.estimatedDepthCm} سم</span>
            </div>
            <div style="background:rgba(255,255,255,0.08);border-radius:3px;height:5px;overflow:hidden;">
              <div style="height:100%;border-radius:3px;background:${color};width:${Math.min(100, acc.estimatedDepthCm)}%;transition:width 0.3s;"></div>
            </div>
          </div>
          ${acc.wadiDischarge !== null ? `
          <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:6px;padding:6px;margin-bottom:8px;">
            <div style="font-size:9px;color:#94a3b8;">🌊 تصريف الوادي (GloFAS)</div>
            <div style="font-size:14px;font-weight:700;color:#42A5F5;">${acc.wadiDischarge.toFixed(2)} م³/ث</div>
          </div>` : ''}
          <!-- Footer -->
          <div style="font-size:9px;color:#475569;border-top:1px solid rgba(255,255,255,0.06);padding-top:6px;">
            <span style="color:#64748b;">التربة: </span>${acc.soilType} · 
            <span style="color:#64748b;">القابلية: </span>${acc.susceptibility}%
          </div>
          <div style="margin-top:4px;font-size:8px;color:#334155;">المصادر: ${acc.sources.join(' · ')}</div>
        </div>
      `, { className: 'flood-popup', sticky: true, direction: 'top' })
        .addTo(group);

      // Label marker: show region name + depth for severe/extreme only (reduce clutter)
      if (acc.level === 'severe' || acc.level === 'extreme') {
        L.marker([lat, lon], {
          icon: L.divIcon({
            html: `<div style="background:rgba(10,15,30,0.85);backdrop-filter:blur(4px);border:1px solid ${stroke};color:${color};font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;white-space:nowrap;font-family:Tajawal,sans-serif;box-shadow:0 2px 12px ${stroke}66;text-align:center;line-height:1.4;">
              <div style="font-size:8px;color:#94a3b8;">${region.nameAr}</div>
              <div>${icon} ${acc.estimatedDepthCm} سم</div>
            </div>`,
            className: '', iconAnchor: [30, 10],
          }),
        }).addTo(group);
      }
    });

    group.addTo(map);
    layerGroupsRef.current[key] = group;
  }, [data]); // re-render when live data updates

  // ── Summary stats ─────────────────────────────────────────────────────
  // Use live data for KPI counts when available, fallback to static flood zones
  const criticalZones = data ? data.regions.filter(r => r.alertLevel === 'critical').length : FLOOD_ZONES.filter(z => z.riskLevel === 'critical').length;
  const warningZones = data ? data.regions.filter(r => r.alertLevel === 'warning').length : FLOOD_ZONES.filter(z => z.riskLevel === 'high').length;
  const watchZones = data ? data.regions.filter(r => r.alertLevel === 'watch').length : 0;
  const totalAlerts = criticalZones + warningZones + watchZones;
  const totalPrecip = data ? data.regions.reduce((s, r) => s + r.currentPrecipitation, 0).toFixed(1) : '—';
  const maxRisk = data ? Math.max(...data.regions.map(r => r.floodRisk)) : 0;
  // Live accumulation stats from hybrid engine
  const accSummary = (data as any)?.accumulationSummary;
  const liveRegionsWithWater = accSummary?.totalRegionsWithWater ?? 0;
  const liveActiveWadis = accSummary?.activeWadis ?? 0;

  // ── Shared panel content (used in both desktop sidebar and mobile bottom sheet) ──
  const panelContent = (
    <>
      {/* Panel Header */}
      <div style={{ padding: '10px 10px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.02em' }}>operations center</div>
            <div style={{ fontSize: '10px', color: '#475569', marginTop: '1px' }}>Emirate Abu Dhabi • Monitor Live</div>
          </div>
          <button onClick={refresh} title="Update" style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '5px', cursor: 'pointer', color: '#00d4ff', padding: '4px 6px', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={10} />
          </button>
        </div>
        {/* Live status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', background: isLive ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', borderRadius: '6px', border: `1px solid ${isLive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, marginBottom: '10px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isLive ? '#10B981' : '#EF4444', boxShadow: isLive ? '0 0 6px #10B981' : 'none', flexShrink: 0 }} />
          <span style={{ fontSize: '10px', color: isLive ? '#10B981' : '#EF4444', flex: 1 }}>
            {isLive ? `Live — ${lastUpdated?.toLocaleTimeString('ar-AE', { hour: '2-digit', minute: '2-digit' })}` : 'Awaiting data...'}
          </span>
          <span style={{ fontSize: '9px', color: '#334155' }}>Open-Meteo</span>
        </div>
        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '4px', marginBottom: '10px' }}>
          {[
            { label: lang === 'ar' ? 'تنبيهات' : 'Alerts', value: totalAlerts, color: criticalZones > 0 ? '#EF4444' : warningZones > 0 ? '#F97316' : '#F59E0B', bg: criticalZones > 0 ? 'rgba(239,68,68,0.12)' : warningZones > 0 ? 'rgba(249,115,22,0.12)' : 'rgba(245,158,11,0.1)', drill: 'criticalRegions' as DrillDownType },
            { label: lang === 'ar' ? `ح${criticalZones}·ت${warningZones}·م${watchZones}` : `C${criticalZones}·W${warningZones}·M${watchZones}`, value: '', color: '#64748b', bg: 'rgba(100,116,139,0.06)', drill: 'warningRegions' as DrillDownType },
            { label: 'mm', value: totalPrecip, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', drill: 'totalPrecip' as DrillDownType },
            { label: lang === 'ar' ? 'خطر%' : 'Risk%', value: maxRisk, color: '#F97316', bg: 'rgba(249,115,22,0.1)', drill: 'risk' as DrillDownType },
          ].map(k => (
            <button
              key={k.label}
              onClick={() => data && setKpiModal(k.drill)}
              style={{ background: k.bg, borderRadius: '6px', padding: '5px 3px', textAlign: 'center', border: `1px solid ${k.color}44`, cursor: data ? 'pointer' : 'default', transition: 'all 0.15s', outline: 'none' }}
            >
              <div style={{ fontSize: '15px', fontWeight: 800, color: k.color, fontFamily: 'monospace', lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: '8px', color: '#475569', marginTop: '2px' }}>{k.label}</div>
            </button>
          ))}
        </div>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '2px', marginBottom: '0', background: 'rgba(255,255,255,0.03)', borderRadius: '8px 8px 0 0', padding: '3px 3px 0' }}>
          {([
            { id: 'layers' as PanelTab, label: 'Layers', icon: <Layers size={11} /> },
            { id: 'zones' as PanelTab, label: 'Regions', icon: <MapPin size={11} /> },
            { id: 'stats' as PanelTab, label: 'Statistics', icon: <BarChart2 size={11} /> },
          ] as { id: PanelTab; label: string; icon: React.ReactNode }[]).map(tab => (
            <button key={tab.id} onClick={() => setPanelTab(tab.id)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
              padding: '6px 4px', borderRadius: '6px 6px 0 0', border: 'none', cursor: 'pointer', fontSize: '10px',
              background: panelTab === tab.id ? 'rgba(0,212,255,0.12)' : 'transparent',
              color: panelTab === tab.id ? '#00d4ff' : '#475569',
              fontWeight: panelTab === tab.id ? 700 : 400,
              borderBottom: panelTab === tab.id ? '2px solid #00d4ff' : '2px solid transparent',
              transition: 'all 0.15s ease',
            }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', background: 'var(--bg-primary)', fontFamily: 'Tajawal, sans-serif', direction: lang === 'ar' ? 'rtl' : 'ltr', position: 'relative', overflow: 'hidden' }}>

      {/* ── Side Panel (Desktop only) ── */}
      <div style={{
        width: isMobile ? '0' : (panelCollapsed ? '48px' : '260px'),
        minWidth: isMobile ? '0' : (panelCollapsed ? '48px' : '260px'),
        background: 'rgba(10,14,20,0.98)',
        borderLeft: '1px solid rgba(0,212,255,0.12)',
        display: isMobile ? 'none' : 'flex', flexDirection: 'column',
        transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1), min-width 0.28s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden', zIndex: 10,
      }}>
        {/* ── Panel Header ── */}
        <div style={{ padding: '10px 10px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: panelCollapsed ? 0 : '10px' }}>
            {!panelCollapsed && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.02em' }}>
                  operations center
                </div>
                <div style={{ fontSize: '10px', color: '#475569', marginTop: '1px' }}>Emirate Abu Dhabi • Monitor Live</div>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {!panelCollapsed && (
                <button onClick={refresh} title="Update" style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '5px', cursor: 'pointer', color: '#00d4ff', padding: '4px 6px', display: 'flex', alignItems: 'center' }}>
                  <RefreshCw size={10} />
                </button>
              )}
              <button onClick={() => setPanelCollapsed(p => !p)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', cursor: 'pointer', color: '#64748b', padding: '4px 6px', display: 'flex', alignItems: 'center' }}>
                {panelCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
              </button>
            </div>
          </div>

          {/* Live status bar */}
          {!panelCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', background: isLive ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', borderRadius: '6px', border: `1px solid ${isLive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, marginBottom: '10px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isLive ? '#10B981' : '#EF4444', boxShadow: isLive ? '0 0 6px #10B981' : 'none', flexShrink: 0 }} />
              <span style={{ fontSize: '10px', color: isLive ? '#10B981' : '#EF4444', flex: 1 }}>
                {isLive ? `Live — ${lastUpdated?.toLocaleTimeString('ar-AE', { hour: '2-digit', minute: '2-digit' })}` : 'Awaiting data...'}
              </span>
              <span style={{ fontSize: '9px', color: '#334155' }}>Open-Meteo</span>
            </div>
          )}

          {/* KPI row */}
          {!panelCollapsed && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '4px', marginBottom: '10px' }}>
              {[
                { label: lang === 'ar' ? 'تنبيهات' : 'Alerts', value: totalAlerts, color: criticalZones > 0 ? '#EF4444' : warningZones > 0 ? '#F97316' : '#F59E0B', bg: criticalZones > 0 ? 'rgba(239,68,68,0.12)' : warningZones > 0 ? 'rgba(249,115,22,0.12)' : 'rgba(245,158,11,0.1)', drill: 'criticalRegions' as DrillDownType },
                { label: lang === 'ar' ? `ح${criticalZones}·ت${warningZones}·م${watchZones}` : `C${criticalZones}·W${warningZones}·M${watchZones}`, value: '', color: '#64748b', bg: 'rgba(100,116,139,0.06)', drill: 'warningRegions' as DrillDownType },
                { label: 'mm', value: totalPrecip, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', drill: 'totalPrecip' as DrillDownType },
                { label: lang === 'ar' ? 'خطر%' : 'Risk%', value: maxRisk, color: '#F97316', bg: 'rgba(249,115,22,0.1)', drill: 'risk' as DrillDownType },
              ].map(k => (
                <button
                  key={k.label}
                  onClick={() => data && setKpiModal(k.drill)}
                  title={lang === 'ar' ? 'انقر للتفاصيل' : 'Click for details'}
                  style={{
                    background: k.bg, borderRadius: '6px', padding: '5px 3px', textAlign: 'center',
                    border: `1px solid ${k.color}44`, cursor: data ? 'pointer' : 'default',
                    transition: 'all 0.15s', outline: 'none',
                  }}
                  onMouseEnter={e => { if (data) (e.currentTarget as HTMLElement).style.background = k.bg.replace('0.1)', '0.2)'); }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = k.bg; }}
                >
                  <div style={{ fontSize: '15px', fontWeight: 800, color: k.color, fontFamily: 'monospace', lineHeight: 1 }}>{k.value}</div>
                  <div style={{ fontSize: '8px', color: '#475569', marginTop: '2px' }}>{k.label}</div>
                </button>
              ))}
            </div>
          )}

          {/* Tab bar */}
          {!panelCollapsed && (
            <div style={{ display: 'flex', gap: '2px', marginBottom: '0', background: 'rgba(255,255,255,0.03)', borderRadius: '8px 8px 0 0', padding: '3px 3px 0' }}>
              {([
                { id: 'layers' as PanelTab, label: 'Layers', icon: <Layers size={11} /> },
                { id: 'zones' as PanelTab, label: 'Regions', icon: <MapPin size={11} /> },
                { id: 'stats' as PanelTab, label: 'Statistics', icon: <BarChart2 size={11} /> },
              ] as { id: PanelTab; label: string; icon: React.ReactNode }[]).map(tab => (
                <button key={tab.id} onClick={() => setPanelTab(tab.id)} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  padding: '6px 4px', borderRadius: '6px 6px 0 0', border: 'none', cursor: 'pointer', fontSize: '10px',
                  background: panelTab === tab.id ? 'rgba(0,212,255,0.12)' : 'transparent',
                  color: panelTab === tab.id ? '#00d4ff' : '#475569',
                  fontWeight: panelTab === tab.id ? 700 : 400,
                  borderBottom: panelTab === tab.id ? '2px solid #00d4ff' : '2px solid transparent',
                  transition: 'all 0.15s ease',
                }}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Collapsed icon strip */}
        {panelCollapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
            {LAYERS.map(layer => (
              <button key={layer.key} onClick={() => toggleLayer(layer.key)} title={layer.labelAr} style={{
                width: '32px', height: '32px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: activeLayers[layer.key] ? `${layer.color}22` : 'rgba(255,255,255,0.04)',
                color: activeLayers[layer.key] ? layer.color : '#334155',
              }}>
                {layer.icon}
              </button>
            ))}
          </div>
        )}

        {/* ── Tab Content ── */}
        {!panelCollapsed && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>

            {/* ─── TAB: Layers ─── */}
            {panelTab === 'layers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>

                {/* Map style */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                  {(['dark', 'satellite'] as const).map(s => (
                    <button key={s} onClick={() => setMapStyle(s)} style={{
                      flex: 1, padding: '6px 4px', borderRadius: '6px', border: `1px solid ${mapStyle === s ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.07)'}`, cursor: 'pointer', fontSize: '10px',
                      background: mapStyle === s ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)',
                      color: mapStyle === s ? '#00d4ff' : '#475569',
                      fontWeight: mapStyle === s ? 700 : 400,
                    }}>
                      {s === 'dark' ? '🌑 Dark' : '🛰️ Satellite'}
                    </button>
                  ))}
                </div>

                {/* Layer toggles grouped */}
                <div style={{ fontSize: '9px', color: '#334155', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Active Layers</div>
                {LAYERS.map(layer => (
                  <button key={layer.key} onClick={() => toggleLayer(layer.key)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 10px', borderRadius: '8px', border: `1px solid ${activeLayers[layer.key] ? layer.color + '33' : 'rgba(255,255,255,0.05)'}`,
                    cursor: 'pointer', background: activeLayers[layer.key] ? `${layer.color}0f` : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.15s ease', textAlign: 'right',
                  }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      background: activeLayers[layer.key] ? `${layer.color}22` : 'rgba(255,255,255,0.05)',
                      color: activeLayers[layer.key] ? layer.color : '#334155',
                    }}>
                      {layer.icon}
                    </div>
                    <span style={{ fontSize: '11px', color: activeLayers[layer.key] ? '#e2e8f0' : '#475569', flex: 1, fontWeight: activeLayers[layer.key] ? 600 : 400 }}>{layer.labelAr}</span>
                    <div style={{
                      width: '18px', height: '10px', borderRadius: '5px', flexShrink: 0,
                      background: activeLayers[layer.key] ? layer.color : 'rgba(255,255,255,0.1)',
                      position: 'relative', transition: 'background 0.2s ease',
                    }}>
                      <div style={{
                        position: 'absolute', top: '1px', width: '8px', height: '8px', borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s ease',
                        left: activeLayers[layer.key] ? '9px' : '1px',
                      }} />
                    </div>
                  </button>
                ))}

                {/* Water Volume Summary button — shown when water layer is active */}
                {activeLayers.floodZones && (
                  <button
                    onClick={() => setShowWaterSummary(v => !v)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '7px 10px', borderRadius: '8px', cursor: 'pointer',
                      background: showWaterSummary ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.05)',
                      border: `1px solid ${showWaterSummary ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.15)'}`,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ width: '22px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(59,130,246,0.2)', color: '#60A5FA', flexShrink: 0 }}>
                      <BarChart2 size={12} />
                    </div>
                    <span style={{ fontSize: '11px', color: showWaterSummary ? '#93C5FD' : '#60A5FA', flex: 1, fontWeight: 600 }}>
                      {lang === 'ar' ? 'حصر كميات المياه' : 'Water Volume Summary'}
                    </span>
                    <span style={{ fontSize: '9px', color: '#475569' }}>
                      {lang === 'ar' ? 'سنة / شهر / أسبوع' : 'Year / Month / Week'}
                    </span>
                  </button>
                )}

                {/* Traffic phase sub-control */}
                {activeLayers.traffic && (
                  <div style={{ padding: '8px', background: 'rgba(249,115,22,0.06)', borderRadius: '8px', border: '1px solid rgba(249,115,22,0.15)' }}>
                    <div style={{ fontSize: '9px', color: '#F97316', fontWeight: 700, marginBottom: '6px' }}>Phase Traffic</div>
                    <div style={{ display: 'flex', gap: '3px' }}>
                      {(['before', 'during', 'after'] as TrafficPhase[]).map(p => (
                        <button key={p} onClick={() => setTrafficPhase(p)} style={{
                          flex: 1, padding: '5px 2px', borderRadius: '5px', border: 'none', cursor: 'pointer', fontSize: '9px',
                          background: trafficPhase === p ? 'rgba(249,115,22,0.25)' : 'rgba(255,255,255,0.05)',
                          color: trafficPhase === p ? '#F97316' : '#475569',
                          fontWeight: trafficPhase === p ? 700 : 400,
                        }}>
                          {p === 'before' ? 'before' : p === 'during' ? 'During' : 'After'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Drainage legend */}
                {activeLayers.drainage && (
                  <div style={{ padding: '8px', background: 'rgba(245,158,11,0.06)', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <div style={{ fontSize: '9px', color: '#F59E0B', fontWeight: 700, marginBottom: '5px' }}>Drainage Network Load</div>
                    {[['#10B981','Normal load (< 60%)'],['#F59E0B','Warning (60-80%)'],['#EF4444','Overloaded (> 80%)']].map(([c,l]) => (
                      <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, flexShrink: 0 }} />
                        <span style={{ fontSize: '9px', color: '#64748b' }}>{l}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB: Regions ─── */}
            {panelTab === 'zones' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '9px', color: '#334155', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '4px' }}>water accumulation zones — {FLOOD_ZONES.length} Region</div>
                {FLOOD_ZONES.map(zone => (
                  <button key={zone.id} onClick={() => {
                    setSelectedFeature({ type: 'flood', zone });
                    if (leafletMapRef.current) leafletMapRef.current.setView([zone.lat, zone.lng], 14);
                  }} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '7px 8px', borderRadius: '7px', cursor: 'pointer',
                    background: 'rgba(255,255,255,0.02)', border: `1px solid ${RISK_COLORS[zone.riskLevel]}22`,
                    transition: 'background 0.15s ease', textAlign: 'right',
                  }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: RISK_COLORS[zone.riskLevel], flexShrink: 0, boxShadow: `0 0 4px ${RISK_COLORS[zone.riskLevel]}` }} />
                    <span style={{ fontSize: '10px', color: '#94a3b8', flex: 1 }}>{zone.nameAr.split('—')[0].trim()}</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: RISK_COLORS[zone.riskLevel], fontFamily: 'monospace', lineHeight: 1 }}>{Math.round(zone.waterDepth * precipMultiplier)} <span style={{ fontSize: '8px' }}>cm</span></div>
                      <div style={{ fontSize: '8px', color: '#334155' }}>{ { critical: 'Critical', high: 'High', medium: 'Average', low: 'Low' }[zone.riskLevel] }</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ─── TAB: statistics ─── */}
            {panelTab === 'stats' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

                {/* Road risk scale */}
                <div style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#00d4ff', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Metric Risk Roads
                    <InfoTooltip content={MAP_TOOLTIPS.roadNetwork} size="sm" />
                  </div>
                  <div style={{ height: '7px', borderRadius: '4px', background: 'linear-gradient(to left,#7C3AED,#EF4444,#F97316,#F59E0B,#84CC16,#10B981)', marginBottom: '4px' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    {['Safe', 'Low', 'Warning', 'Risk', 'Flooded'].map(l => (
                      <span key={l} style={{ fontSize: '8px', color: '#334155' }}>{l}</span>
                    ))}
                  </div>
                </div>

                {/* Water depth scale */}
                <div style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#42A5F5', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Depth Water accumulation • 4 levels
                  </div>
                  <div style={{ marginBottom: '4px', padding: '3px 6px', background: 'rgba(0,80,200,0.12)', borderRadius: '4px' }}>
                    <div style={{ fontSize: '8px', color: '#475569' }}>Current detail level</div>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: currentZoom >= 17 ? '#10B981' : currentZoom >= 14 ? '#42A5F5' : currentZoom >= 11 ? '#F59E0B' : '#94a3b8' }}>
                      {currentZoom >= 17 ? 'L4 — Street detail' : currentZoom >= 14 ? 'L3 — District detail' : currentZoom >= 11 ? 'L2 — Administrative regions' : 'L1 — Emirate regions'}
                    </div>
                  </div>
                  <div style={{ height: '7px', borderRadius: '4px', background: 'linear-gradient(to right,rgba(173,216,230,0.5),rgba(100,180,255,0.7),rgba(20,90,220,0.85),rgba(2,5,100,0.95))', marginBottom: '4px' }} />
                  {[['rgba(173,216,230,0.5)','< 10 cm'],['rgba(100,180,255,0.7)','10-25 cm'],['rgba(50,130,255,0.8)','25-50 cm'],['rgba(20,90,220,0.9)','50-100 cm'],['rgba(2,5,100,0.95)','> 1 m']].map(([c,l]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <div style={{ width: '12px', height: '8px', borderRadius: '2px', background: c, border: '1px solid rgba(0,100,255,0.3)', flexShrink: 0 }} />
                      <span style={{ fontSize: '9px', color: '#64748b' }}>{l}</span>
                    </div>
                  ))}
                </div>

                {/* Precip multiplier */}
                <div style={{ padding: '8px', background: 'rgba(0,80,200,0.08)', borderRadius: '8px', border: '1px solid rgba(0,120,255,0.15)' }}>
                  <div style={{ fontSize: '9px', color: '#475569', marginBottom: '4px' }}>current rainfall multiplier</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, precipMultiplier / 2.5 * 100)}%`, height: '100%', borderRadius: '3px', background: precipMultiplier > 1.5 ? '#EF4444' : precipMultiplier > 1.0 ? '#F59E0B' : '#3B82F6', transition: 'width 0.8s ease, background 0.8s ease' }} />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: precipMultiplier > 1.5 ? '#EF4444' : precipMultiplier > 1.0 ? '#F59E0B' : '#42A5F5', fontFamily: 'monospace', flexShrink: 0 }}>×{precipMultiplier.toFixed(2)}</span>
                  </div>
                  <div style={{ fontSize: '8px', color: '#334155', marginTop: '3px' }}>
                    {precipMultiplier > 1.5 ? '⚠️ Heavy Rain' : precipMultiplier > 1.0 ? '⚡ Moderate Rain' : '✓ Dry or Light'}
                  </div>
                </div>

                {/* Data sources */}
                <div style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '9px', color: '#334155', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '6px' }}>Sources Data</div>
                  {[
                    { label: 'Network Roads', acc: DATA_ACCURACY.roadNetwork.accuracy, color: '#10B981', src: 'OSM Overpass' },
                    { label: 'Water accumulation', acc: DATA_ACCURACY.floodZones.accuracy, color: '#42A5F5', src: 'Copernicus CEMS' },
                    { label: 'Data Weather', acc: DATA_ACCURACY.weatherData.accuracy, color: '#F59E0B', src: 'Open-Meteo' },
                    { label: 'Model Elevation', acc: DATA_ACCURACY.elevation.accuracy, color: '#8b5cf6', src: 'SRTM DEM' },
                    { label: 'Drainage Network', acc: 82, color: '#F59E0B', src: 'ADSSC' },
                  ].map(({ label, acc, color, src }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ fontSize: '9px', color: '#64748b' }}>{label}</span>
                          <span style={{ fontSize: '9px', fontWeight: 700, color, fontFamily: 'monospace' }}>{acc}%</span>
                        </div>
                        <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
                          <div style={{ width: `${acc}%`, height: '100%', borderRadius: '2px', background: color, transition: 'width 1s ease' }} />
                        </div>
                        <div style={{ fontSize: '8px', color: '#1e293b', marginTop: '1px' }}>{src}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right Column: Map + Timeline ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, width: isMobile ? '100%' : undefined, position: isMobile ? 'absolute' : 'relative', inset: isMobile ? '0' : undefined }}>
      {/* ── Map ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

        {/* ── Map Controls Bar (top-right) ── */}
        <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1001, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <FullscreenButton size={13} variant="icon-text" color="rgba(255,255,255,0.7)" />
          {/* Toggle buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[
              { label: 'Flash Flood', active: showLegend, toggle: () => setShowLegend(p => !p), icon: '📊' },
              { label: 'panel', active: showTimeline, toggle: () => setShowTimeline(p => !p), icon: '⏱' },
              { label: 'Time', active: showBadge, toggle: () => setShowBadge(p => !p), icon: '🕐' },
            ].map(btn => (
              <button key={btn.label} onClick={btn.toggle} title={`${btn.active ? 'Hide' : 'Show'} ${btn.label}`} style={{
                background: btn.active ? 'rgba(0,212,255,0.15)' : 'rgba(13,17,23,0.85)',
                border: `1px solid ${btn.active ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '6px', cursor: 'pointer', color: btn.active ? '#00d4ff' : '#475569',
                padding: '4px 7px', fontSize: '9px', display: 'flex', alignItems: 'center', gap: '3px',
                fontFamily: 'Tajawal, sans-serif', whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}>
                <span>{btn.icon}</span>
                <span>{btn.label}</span>
                <span style={{ fontSize: '8px', opacity: 0.7 }}>{btn.active ? '✓' : '—'}</span>
              </button>
            ))}
            {/* Historical Archive Button */}
            <button
              onClick={() => {
                if (historicalMode) {
                  // Already in historical mode — exit
                  setHistoricalMode(false);
                  setHistoricalEventActive(null);
                } else {
                  // Enter historical mode: default to April 2024 (most extreme event)
                  setHistoricalMode(true);
                  setHistoricalYear(2024);
                  setHistoricalMonth(4);
                  setHistoricalEventActive({ year: 2024, month: 4 });
                }
              }}
              title={lang === 'ar' ? 'الأرشيف التاريخي 2015-2025' : 'Historical Archive 2015-2025'}
              style={{
                background: historicalMode ? 'rgba(251,191,36,0.2)' : 'rgba(13,17,23,0.85)',
                border: `1px solid ${historicalMode ? 'rgba(251,191,36,0.6)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '6px', cursor: 'pointer',
                color: historicalMode ? '#FBBF24' : '#475569',
                padding: '4px 7px', fontSize: '9px', display: 'flex', alignItems: 'center', gap: '3px',
                fontFamily: 'Tajawal, sans-serif', whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              <span>🗓</span>
              <span>{lang === 'ar' ? 'تاريخي' : 'History'}</span>
              {historicalMode && (
                <span style={{ fontSize: '8px', background: 'rgba(251,191,36,0.3)', borderRadius: '3px', padding: '1px 3px' }}>
                  {historicalYear}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Historical Water Panel ── */}
        {showHistoricalPanel && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1500 }}>
            <HistoricalWaterPanel
              lang={lang as 'ar' | 'en'}
              onSelectEvent={(year, month, _regions) => {
                setHistoricalEventActive({ year, month });
              }}
              onClose={() => setShowHistoricalPanel(false)}
            />
          </div>
        )}

        {/* Loading overlay */}
        {loadingTier && (
          <div style={{
            position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(13,17,23,0.92)', border: '1px solid rgba(0,212,255,0.3)',
            borderRadius: '8px', padding: '8px 16px', zIndex: 1000,
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <RefreshCw size={12} style={{ color: '#00d4ff', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '12px', color: '#00d4ff' }}>Loading roads layer...</span>
          </div>
        )}

        {/* Zoom hint */}
        {currentZoom < 13 && (
          <div style={{
            position: 'absolute', bottom: '55px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(13,17,23,0.85)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px', padding: '6px 12px', zIndex: 999,
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <ZoomIn size={11} style={{ color: '#F59E0B' }} />
            <span style={{ fontSize: '11px', color: '#F59E0B' }}>zoom in to view residential streets</span>
          </div>
        )}

        {/* Traffic speed legend — only when traffic active */}
        {activeLayers.traffic && (
          <div style={{
            position: 'absolute', bottom: '50px', left: activeLayers.floodZones && showLegend ? '170px' : '12px',
            background: 'rgba(13,17,23,0.92)', border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: '8px', padding: '8px 10px', zIndex: 999,
          }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#F59E0B', marginBottom: '5px' }}>Metric Speed</div>
            {[
              { color: '#10B981', label: '+90 km/hr — smooth' },
              { color: '#84CC16', label: '60-90 km/hr — slow' },
              { color: '#F59E0B', label: '30-60 km/hr — very slow' },
              { color: '#EF4444', label: '< 30 — stopped' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                <div style={{ width: '20px', height: '3px', background: color, borderRadius: '2px' }} />
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Flood depth legend — FastFlood style */}
        {activeLayers.floodZones && showLegend && (
          <div style={{
            position: 'absolute', bottom: '80px', left: '12px',
            zIndex: 999, minWidth: '155px', maxWidth: '175px',
          }}>
            <div style={{
              background: 'rgba(10,15,30,0.92)',
              border: '1px solid rgba(59,130,246,0.25)',
              borderRadius: '8px',
              padding: '8px 10px',
              marginBottom: '6px',
              color: '#cbd5e1',
              fontSize: '9px',
              lineHeight: 1.45,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ display: 'inline-block', width: '16px', height: '0', borderTop: '2px solid #93C5FD' }} />
                <span>{lang === 'ar' ? 'الحدود الإدارية للمناطق' : 'Administrative region boundaries'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '16px', height: '10px', background: 'rgba(59,130,246,0.16)', border: '1px solid rgba(96,165,250,0.55)', borderRadius: '3px' }} />
                <span>{lang === 'ar' ? 'تضليل شفاف يتغير حسب كثافة المياه والخطورة' : 'Transparent regional tint by water intensity and risk'}</span>
              </div>
            </div>
            {/* ✅ Unified WaterLegend component */}
            <WaterLegend
              lang={lang as 'ar' | 'en'}
              compact
              showDepth
              showIcon
            />
            {/* Zoom level indicator */}
            <div style={{ marginTop: '4px', padding: '4px 8px', background: 'rgba(5,12,35,0.88)', border: '1px solid rgba(66,165,245,0.15)', borderRadius: '5px', backdropFilter: 'blur(8px)' }}>
              <div style={{ fontSize: '8px', color: '#64748b', marginBottom: '2px', fontFamily: 'Tajawal, sans-serif' }}>
                {lang === 'ar' ? 'مستوى التفصيل الحالي' : 'Current Detail Level'}
              </div>
              <div style={{ fontSize: '9px', fontWeight: 700, fontFamily: 'Tajawal, sans-serif', color:
                currentZoom >= 17 ? '#10B981' : currentZoom >= 14 ? '#42A5F5' : currentZoom >= 11 ? '#F59E0B' : '#94a3b8'
              }}>
                {currentZoom >= 17 ? (lang === 'ar' ? 'L4 — تفاصيل الشارع' : 'L4 — Street Detail') :
                 currentZoom >= 14 ? (lang === 'ar' ? 'L3 — تفاصيل المناطق' : 'L3 — District Detail') :
                 currentZoom >= 11 ? (lang === 'ar' ? 'L2 — المناطق الإدارية' : 'L2 — Administrative Regions') :
                                     (lang === 'ar' ? 'L1 — مناطق الإمارة' : 'L1 — Emirate Regions')}
              </div>
            </div>
            {/* Live multiplier */}
            <div style={{ marginTop: '4px', padding: '5px 8px', background: 'rgba(5,12,35,0.88)', border: '1px solid rgba(66,165,245,0.15)', borderRadius: '5px', backdropFilter: 'blur(8px)' }}>
              <div style={{ fontSize: '8px', color: '#64748b', marginBottom: '3px', fontFamily: 'Tajawal, sans-serif' }}>
                {lang === 'ar' ? 'معامل العمق الحالي' : 'Depth Multiplier'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, precipMultiplier / 2.5 * 100)}%`,
                    height: '100%', borderRadius: '3px',
                    background: precipMultiplier > 1.5 ? '#EF4444' : precipMultiplier > 1.0 ? '#F59E0B' : '#3B82F6',
                    transition: 'width 0.8s ease, background 0.8s ease',
                    minWidth: '4px',
                  }} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, fontFamily: 'monospace', color: precipMultiplier > 1.5 ? '#EF4444' : precipMultiplier > 1.0 ? '#F59E0B' : '#42A5F5' }}>
                  ×{precipMultiplier.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Timeline status badge */}
        {showBadge && (() => {
          // Historical mode badge
          if (historicalMode) {
            const MONTHS_AR = ['','يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
            const MONTHS_EN = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const ev = FLOOD_EVENTS.find(e => e.year === historicalYear && e.month === historicalMonth);
            const badgeColor = ev ? (
              ev.severity === 'extreme' ? '#7C3AED' :
              ev.severity === 'severe'  ? '#EF4444' :
              ev.severity === 'high'    ? '#F97316' :
              ev.severity === 'moderate'? '#F59E0B' : '#3B82F6'
            ) : '#475569';
            const monthLabel = lang === 'ar' ? MONTHS_AR[historicalMonth] : MONTHS_EN[historicalMonth];
            return (
              <div style={{
                position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(13,17,23,0.92)', border: `1px solid ${badgeColor}55`,
                borderRadius: '8px', padding: '5px 14px', zIndex: 1001,
                display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
              }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: badgeColor }} />
                <span style={{ fontSize: '11px', color: '#e2e8f0', fontFamily: 'Tajawal,sans-serif' }}>
                  {monthLabel} {historicalYear}
                  {ev ? ` — ${ev.max_mm} mm` : ''}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 700, color: badgeColor }}>HIST</span>
              </div>
            );
          }
          // Live/forecast badge
          if (!timelineHours.length || timelineIndex < 0) return null;
          const h = timelineHours[timelineIndex];
          if (!h) return null;
          const isNow = h.isNow;
          const isForecast = h.isForecast;
          const badgeColor = isNow ? '#10B981' : isForecast ? '#F59E0B' : '#3B82F6';
          const badgeLabel = isNow ? 'LIVE' : isForecast ? 'FORECAST' : 'HISTORICAL';
          const dt = new Date(h.time);
          const timeStr = dt.toLocaleString('ar-AE', { timeZone: 'Asia/Dubai', weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
          return (
            <div style={{
              position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(13,17,23,0.92)', border: `1px solid ${badgeColor}55`,
              borderRadius: '8px', padding: '5px 14px', zIndex: 1001,
              display: 'flex', alignItems: 'center', gap: '8px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
            }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: badgeColor, boxShadow: isNow ? `0 0 6px ${badgeColor}` : 'none' }} />
              <span style={{ fontSize: '11px', color: '#e2e8f0', fontFamily: 'Tajawal,sans-serif' }}>{timeStr}</span>
              <span style={{ fontSize: '10px', fontWeight: 700, color: badgeColor }}>{badgeLabel}</span>
            </div>
          );
         })()}
        {/* Timeline Scrubber — embedded inside map position:absolute */}
        {historicalMode ? (
          <HistoricalTimelineScrubber
            year={historicalYear}
            selectedMonth={historicalMonth}
            onMonthChange={(m) => {
              setHistoricalMonth(m);
              setHistoricalEventActive({ year: historicalYear, month: m });
            }}
            onYearChange={(y) => {
              setHistoricalYear(y);
              setHistoricalEventActive({ year: y, month: historicalMonth });
            }}
            onClose={() => {
              setHistoricalMode(false);
              setHistoricalEventActive(null);
              setHistoricalRange(null);
            }}
            onRangeChange={(range) => {
              setHistoricalRange(range);
              // In range/year mode: clear single-event active so useEffect uses historicalRange
              if (range) {
                setHistoricalEventActive(null);
              } else {
                // back to month mode — restore single event
                setHistoricalEventActive({ year: historicalYear, month: historicalMonth });
              }
            }}
            onViewModeChange={(mode) => {
              setHistoricalViewMode(mode);
              if (mode === 'month') setHistoricalRange(null);
            }}
            lang={lang as 'ar' | 'en'}
          />
        ) : (
          showTimeline && timelineHours.length > 0 && (
            <TimelineScrubber
              hours={timelineHours}
              currentIndex={timelineIndex}
              onIndexChange={setTimelineIndex}
              isLive={isLive}
            />
          )
        )}
      </div>{/* end map div */}
      </div>{/* end right column */}

      {/* ── Mobile Bottom Sheet ── */}
      {isMobile && (
        <MobileBottomSheet defaultSnap="half" peekHeight={80}>
          {/* Panel content header */}
          <div style={{ padding: '0 10px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#e2e8f0' }}>operations center</div>
                <div style={{ fontSize: '10px', color: '#475569' }}>Emirate Abu Dhabi • Monitor Live</div>
              </div>
              <button onClick={refresh} title="Update" style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '5px', cursor: 'pointer', color: '#00d4ff', padding: '4px 6px', display: 'flex', alignItems: 'center' }}>
                <RefreshCw size={10} />
              </button>
            </div>
            {/* Live status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', background: isLive ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', borderRadius: '6px', border: `1px solid ${isLive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, marginBottom: '8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isLive ? '#10B981' : '#EF4444', boxShadow: isLive ? '0 0 6px #10B981' : 'none', flexShrink: 0 }} />
              <span style={{ fontSize: '10px', color: isLive ? '#10B981' : '#EF4444', flex: 1 }}>
                {isLive ? `Live — ${lastUpdated?.toLocaleTimeString('ar-AE', { hour: '2-digit', minute: '2-digit' })}` : 'Awaiting data...'}
              </span>
              <span style={{ fontSize: '9px', color: '#334155' }}>Open-Meteo</span>
            </div>
            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '4px', marginBottom: '8px' }}>
              {[
                { label: 'Alerts', value: totalAlerts, color: criticalZones > 0 ? '#EF4444' : '#F59E0B', bg: criticalZones > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)', drill: 'criticalRegions' as DrillDownType },
                { label: `C${criticalZones}·W${warningZones}`, value: '', color: '#64748b', bg: 'rgba(100,116,139,0.06)', drill: 'warningRegions' as DrillDownType },
                { label: 'mm', value: totalPrecip, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', drill: 'totalPrecip' as DrillDownType },
                { label: 'Risk%', value: maxRisk, color: '#F97316', bg: 'rgba(249,115,22,0.1)', drill: 'risk' as DrillDownType },
              ].map(k => (
                <button key={k.label} onClick={() => data && setKpiModal(k.drill)}
                  style={{ background: k.bg, borderRadius: '6px', padding: '5px 3px', textAlign: 'center', border: `1px solid ${k.color}44`, cursor: data ? 'pointer' : 'default', outline: 'none' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: k.color, fontFamily: 'monospace', lineHeight: 1 }}>{k.value}</div>
                  <div style={{ fontSize: '8px', color: '#475569', marginTop: '2px' }}>{k.label}</div>
                </button>
              ))}
            </div>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px 8px 0 0', padding: '3px 3px 0' }}>
              {([
                { id: 'layers' as PanelTab, label: 'Layers', icon: <Layers size={11} /> },
                { id: 'zones' as PanelTab, label: 'Regions', icon: <MapPin size={11} /> },
                { id: 'stats' as PanelTab, label: 'Statistics', icon: <BarChart2 size={11} /> },
              ] as { id: PanelTab; label: string; icon: React.ReactNode }[]).map(tab => (
                <button key={tab.id} onClick={() => setPanelTab(tab.id)} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  padding: '6px 4px', borderRadius: '6px 6px 0 0', border: 'none', cursor: 'pointer', fontSize: '10px',
                  background: panelTab === tab.id ? 'rgba(0,212,255,0.12)' : 'transparent',
                  color: panelTab === tab.id ? '#00d4ff' : '#475569',
                  fontWeight: panelTab === tab.id ? 700 : 400,
                  borderBottom: panelTab === tab.id ? '2px solid #00d4ff' : '2px solid transparent',
                  transition: 'all 0.15s ease',
                }}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {/* Layers tab */}
            {panelTab === 'layers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                  {(['dark', 'satellite'] as const).map(s => (
                    <button key={s} onClick={() => setMapStyle(s)} style={{
                      flex: 1, padding: '6px 4px', borderRadius: '6px', border: `1px solid ${mapStyle === s ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.07)'}`, cursor: 'pointer', fontSize: '10px',
                      background: mapStyle === s ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)',
                      color: mapStyle === s ? '#00d4ff' : '#475569', fontWeight: mapStyle === s ? 700 : 400,
                    }}>{s === 'dark' ? '🌑 Dark' : '🛰️ Satellite'}</button>
                  ))}
                </div>
                <div style={{ fontSize: '9px', color: '#334155', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Active Layers</div>
                {LAYERS.map(layer => (
                  <button key={layer.key} onClick={() => toggleLayer(layer.key)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 10px', borderRadius: '8px', border: `1px solid ${activeLayers[layer.key] ? layer.color + '33' : 'rgba(255,255,255,0.05)'}`,
                    cursor: 'pointer', background: activeLayers[layer.key] ? `${layer.color}0f` : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.15s ease', textAlign: 'right',
                  }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: activeLayers[layer.key] ? `${layer.color}22` : 'rgba(255,255,255,0.05)', color: activeLayers[layer.key] ? layer.color : '#334155' }}>{layer.icon}</div>
                    <span style={{ fontSize: '11px', color: activeLayers[layer.key] ? '#e2e8f0' : '#475569', flex: 1, fontWeight: activeLayers[layer.key] ? 600 : 400 }}>{layer.labelAr}</span>
                    <div style={{ width: '18px', height: '10px', borderRadius: '5px', flexShrink: 0, background: activeLayers[layer.key] ? layer.color : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s ease' }}>
                      <div style={{ position: 'absolute', top: '1px', width: '8px', height: '8px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s ease', left: activeLayers[layer.key] ? '9px' : '1px' }} />
                    </div>
                  </button>
                ))}
                {activeLayers.drainage && (
                  <div style={{ padding: '8px', background: 'rgba(245,158,11,0.06)', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <div style={{ fontSize: '9px', color: '#F59E0B', fontWeight: 700, marginBottom: '5px' }}>Drainage Network Load</div>
                    {[['#10B981','Normal load (< 60%)'],['#F59E0B','Warning (60-80%)'],['#EF4444','Overloaded (> 80%)']].map(([c,l]) => (
                      <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, flexShrink: 0 }} />
                        <span style={{ fontSize: '9px', color: '#64748b' }}>{l}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Regions tab */}
            {panelTab === 'zones' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {FLOOD_ZONES.map(zone => (
                  <button key={zone.id} onClick={() => {
                    setSelectedFeature({ type: 'flood', zone });
                    if (leafletMapRef.current) leafletMapRef.current.setView([zone.lat, zone.lng], 14);
                  }} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '7px 8px', borderRadius: '7px', cursor: 'pointer',
                    background: 'rgba(255,255,255,0.02)', border: `1px solid ${RISK_COLORS[zone.riskLevel]}22`,
                    transition: 'background 0.15s ease', textAlign: 'right',
                  }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: RISK_COLORS[zone.riskLevel], flexShrink: 0 }} />
                    <span style={{ fontSize: '10px', color: '#94a3b8', flex: 1 }}>{zone.nameAr.split('—')[0].trim()}</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: RISK_COLORS[zone.riskLevel], fontFamily: 'monospace', lineHeight: 1 }}>{Math.round(zone.waterDepth * precipMultiplier)} <span style={{ fontSize: '8px' }}>cm</span></div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {/* Stats tab */}
            {panelTab === 'stats' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#00d4ff', marginBottom: '6px' }}>Metric Risk Roads</div>
                  <div style={{ height: '7px', borderRadius: '4px', background: 'linear-gradient(to left,#7C3AED,#EF4444,#F97316,#F59E0B,#84CC16,#10B981)', marginBottom: '4px' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    {['Safe','Low','Warning','Risk','Flooded'].map(l => <span key={l} style={{ fontSize: '8px', color: '#334155' }}>{l}</span>)}
                  </div>
                </div>
                <div style={{ padding: '8px', background: 'rgba(0,80,200,0.08)', borderRadius: '8px', border: '1px solid rgba(0,120,255,0.15)' }}>
                  <div style={{ fontSize: '9px', color: '#475569', marginBottom: '4px' }}>current rainfall multiplier</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, precipMultiplier / 2.5 * 100)}%`, height: '100%', borderRadius: '3px', background: precipMultiplier > 1.5 ? '#EF4444' : precipMultiplier > 1.0 ? '#F59E0B' : '#3B82F6', transition: 'width 0.8s ease' }} />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#42A5F5', fontFamily: 'monospace', flexShrink: 0 }}>×{precipMultiplier.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </MobileBottomSheet>
      )}

      {/* Water Hover Tooltip — shows on map hover (mapReady ensures leafletMapRef.current is non-null) */}
      {mapReady && (
        <WaterHoverTooltip
          leafletMap={leafletMapRef.current}
          precipMultiplier={precipMultiplier}
          lang={lang as 'ar' | 'en'}
          enabled={activeLayers.floodZones}
        />
      )}

      {/* Water Volume Summary Panel */}
      {showWaterSummary && (
        <WaterVolumeSummary
          onClose={() => setShowWaterSummary(false)}
          lang={lang as 'ar' | 'en'}
          currentYear={historicalMode ? historicalYear : new Date().getFullYear()}
          currentMonth={historicalMode ? historicalMonth : new Date().getMonth() + 1}
        />
      )}

      {/* KPI Drill-Down Modal */}
      {kpiModal && data && (
        <KPIDrillDown
          type={kpiModal}
          regions={data.regions}
          onClose={() => setKpiModal(null)}
        />
      )}

      <style>{`
        .road-tooltip-osm {
          background: rgba(13,17,23,0.95) !important;
          border: 1px solid rgba(0,212,255,0.25) !important;
          border-radius: 6px !important;
          color: #e2e8f0 !important;
          font-size: 11px !important;
          padding: 4px 8px !important;
          font-family: Tajawal, sans-serif !important;
        }
        .flood-popup .leaflet-popup-content-wrapper {
          background: #0d1117 !important;
          border: 1px solid rgba(0,212,255,0.3) !important;
          border-radius: 10px !important;
          color: #e2e8f0 !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
        }
        .flood-popup .leaflet-popup-tip { background: #0d1117 !important; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
