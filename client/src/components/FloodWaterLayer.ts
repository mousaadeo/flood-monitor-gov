/**
 * FloodWaterLayer — aerial-style flood overlay with per-patch details
 *
 * الهدف من هذه النسخة هو:
 * 1) إظهار تجمعات المياه كبقع داكنة ومحلية ومتفرقة أقرب للصور الجوية.
 * 2) إزالة التوهج الدائري والكتل الزرقاء الواسعة غير الواقعية.
 * 3) إضافة تفاعل لكل بقعة لعرض المكان والعمق والكمية والخطورة والمصدر.
 */

import L from 'leaflet';
import { getZonesForZoom, type FloodZoneMulti } from '@/services/floodMapData';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function seededNoise(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453123;
  return x - Math.floor(x);
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  const normalized = clean.length === 3
    ? clean.split('').map(ch => ch + ch).join('')
    : clean;
  const num = parseInt(normalized, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbaFromHex(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

function metersToPixelRadius(map: any, lat: number, lng: number, meters: number) {
  const center = map.latLngToContainerPoint([lat, lng]);
  const lngDelta = meters / (111320 * Math.cos((lat * Math.PI) / 180));
  const edge = map.latLngToContainerPoint([lat, lng + lngDelta]);
  return Math.max(3, Math.abs(edge.x - center.x));
}

function buildOrganicPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seedBase: number,
  roughness: number,
  pointCount = 26,
) {
  const path = new Path2D();
  for (let i = 0; i <= pointCount; i++) {
    const a = (i / pointCount) * Math.PI * 2;
    const n1 = seededNoise(seedBase + i * 0.71);
    const n2 = seededNoise(seedBase * 1.37 + i * 1.93);
    const n3 = seededNoise(seedBase * 2.11 + i * 2.87);
    const dirBias = 1 + Math.sin(a * 2.35 + n3 * 2.4) * roughness * 0.18;
    const wobble = 1 + (n1 - 0.5) * roughness + (n2 - 0.5) * roughness * 0.50;
    const x = cx + Math.cos(a) * rx * wobble * dirBias;
    const y = cy + Math.sin(a) * ry * (1 + (n2 - 0.5) * roughness * 0.75);
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.closePath();
  return path;
}

function getDepthPalette(depthCm: number, intensity: number) {
  const bodyHex = depthCm >= 55 ? '#1d5ea8' : depthCm >= 28 ? '#2e73bc' : '#4f92d1';
  const coreHex = depthCm >= 55 ? '#0f3f84' : depthCm >= 28 ? '#195596' : '#2b6fa9';
  const bodyAlpha = clamp(0.36 + depthCm / 240 + intensity * 0.10, 0.34, 0.58);
  const coreAlpha = clamp(bodyAlpha + 0.14, 0.48, 0.72);

  return {
    body: rgbaFromHex(bodyHex, bodyAlpha),
    core: rgbaFromHex(coreHex, coreAlpha),
  };
}

function getFootprintScale(zone: FloodZoneMulti, zoom: number) {
  const accuracyScale = clamp(zone.accuracyPct / 100, 0.84, 0.99);
  const levelScale = zone.level === 2 ? 0.36 : 0.28;
  const riskTightness = zone.riskLevel === 'critical'
    ? 0.92
    : zone.riskLevel === 'high'
      ? 0.88
      : zone.riskLevel === 'medium'
        ? 0.82
        : 0.78;
  const zoomRefine = zoom >= 15 ? 0.82 : zoom >= 13 ? 0.90 : 1.0;
  return clamp(levelScale * accuracyScale * riskTightness * zoomRefine, 0.18, 0.42);
}

function getAxes(baseRadiusPx: number, zone: FloodZoneMulti, zoom: number) {
  const footprint = getFootprintScale(zone, zoom);
  const depthT = clamp(zone.waterDepth / 90, 0.12, 1);
  const intensityT = clamp(zone.intensity, 0.2, 1);
  const rx = Math.max(5, baseRadiusPx * footprint * (0.78 + intensityT * 0.16));
  const ry = Math.max(4, baseRadiusPx * footprint * (0.54 + depthT * 0.18));
  return { rx, ry };
}

type PatchDetail = {
  zoneId: string;
  patchIndex: number;
  path: Path2D;
  centerX: number;
  centerY: number;
  lat: number;
  lng: number;
  nameAr: string;
  nameEn: string;
  region: string;
  depthCm: number;
  volumeM3: number;
  areaM2: number;
  riskLevel: FloodZoneMulti['riskLevel'];
  source: string;
  accuracyPct: number;
  intensity: number;
};

function riskColor(level: FloodZoneMulti['riskLevel']) {
  if (level === 'critical') return '#ef4444';
  if (level === 'high') return '#f97316';
  if (level === 'medium') return '#eab308';
  return '#22c55e';
}

function riskLabel(level: FloodZoneMulti['riskLevel'], lang: 'ar' | 'en') {
  const ar: Record<FloodZoneMulti['riskLevel'], string> = {
    low: 'منخفض',
    medium: 'متوسط',
    high: 'عالٍ',
    critical: 'حرج',
  };
  const en: Record<FloodZoneMulti['riskLevel'], string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
  };
  return lang === 'ar' ? ar[level] : en[level];
}

function formatDepth(cm: number, lang: 'ar' | 'en') {
  return lang === 'ar' ? `${cm.toFixed(1)} سم` : `${cm.toFixed(1)} cm`;
}

function formatVolume(m3: number, lang: 'ar' | 'en') {
  if (m3 >= 1_000_000) {
    const v = (m3 / 1_000_000).toFixed(2);
    return lang === 'ar' ? `${v} مليون م³` : `${v}M m³`;
  }
  if (m3 >= 1000) {
    const v = (m3 / 1000).toFixed(1);
    return lang === 'ar' ? `${v} ألف م³` : `${v}K m³`;
  }
  return lang === 'ar' ? `${Math.round(m3)} م³` : `${Math.round(m3)} m³`;
}

function formatArea(areaM2: number, lang: 'ar' | 'en') {
  if (areaM2 >= 1_000_000) {
    const km2 = areaM2 / 1_000_000;
    return lang === 'ar' ? `${km2.toFixed(2)} كم²` : `${km2.toFixed(2)} km²`;
  }
  return lang === 'ar' ? `${Math.round(areaM2)} م²` : `${Math.round(areaM2)} m²`;
}

function formatCoords(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function buildPatchPopupHtml(detail: PatchDetail, lang: 'ar' | 'en') {
  const title = lang === 'ar' ? detail.nameAr : detail.nameEn;
  const placeLabel = lang === 'ar' ? 'المكان' : 'Location';
  const depthLabel = lang === 'ar' ? 'العمق' : 'Depth';
  const volumeLabel = lang === 'ar' ? 'الكمية التقديرية' : 'Estimated Volume';
  const areaLabel = lang === 'ar' ? 'المساحة الظاهرة' : 'Visible Area';
  const riskLabelText = lang === 'ar' ? 'الخطورة' : 'Risk';
  const sourceLabel = lang === 'ar' ? 'المصدر' : 'Source';
  const accuracyLabel = lang === 'ar' ? 'الدقة' : 'Accuracy';
  const coordsLabel = lang === 'ar' ? 'الإحداثيات' : 'Coordinates';
  const regionLabel = lang === 'ar' ? 'المنطقة' : 'Region';

  return `
    <div style="min-width:220px;font-family:Tajawal,sans-serif;direction:${lang === 'ar' ? 'rtl' : 'ltr'};line-height:1.6">
      <div style="font-weight:700;font-size:14px;margin-bottom:6px;color:#e5eefc;">${title}</div>
      <div><b>${placeLabel}:</b> ${title}</div>
      <div><b>${regionLabel}:</b> ${detail.region}</div>
      <div><b>${depthLabel}:</b> ${formatDepth(detail.depthCm, lang)}</div>
      <div><b>${volumeLabel}:</b> ${formatVolume(detail.volumeM3, lang)}</div>
      <div><b>${areaLabel}:</b> ${formatArea(detail.areaM2, lang)}</div>
      <div><b>${riskLabelText}:</b> <span style="color:${riskColor(detail.riskLevel)};font-weight:700;">${riskLabel(detail.riskLevel, lang)}</span></div>
      <div><b>${sourceLabel}:</b> ${detail.source}</div>
      <div><b>${accuracyLabel}:</b> ${detail.accuracyPct}%</div>
      <div><b>${coordsLabel}:</b> ${formatCoords(detail.lat, detail.lng)}</div>
    </div>
  `;
}

function drawFloodZone(
  ctx: CanvasRenderingContext2D,
  map: any,
  zone: FloodZoneMulti,
  multiplier: number,
  zoom: number,
  patches: PatchDetail[],
) {
  const depthCm = Math.max(0, zone.waterDepth * multiplier);
  if (depthCm < 1) return;

  const center = map.latLngToContainerPoint([zone.lat, zone.lng]);
  const baseRadiusPx = metersToPixelRadius(map, zone.lat, zone.lng, zone.radius);
  const { rx, ry } = getAxes(baseRadiusPx, zone, zoom);
  const seed = zone.lat * 1000 + zone.lng * 100 + zone.level * 7;
  const roughness = clamp(0.22 + (1 - zone.accuracyPct / 100) * 0.42 + (1 - zone.intensity) * 0.12, 0.22, 0.40);
  const palette = getDepthPalette(depthCm, zone.intensity);
  const patchCount = zone.level === 3 ? 3 : 4;

  for (let i = 0; i < patchCount; i++) {
    const sizeBias = 1 - i * 0.16 + seededNoise(seed + 20 + i) * 0.08;
    const angle = seededNoise(seed + i * 4.1) * Math.PI * 2;
    const distance = (0.18 + seededNoise(seed + i * 5.2) * 0.36) * Math.max(rx, ry);
    const offsetX = Math.cos(angle) * distance;
    const offsetY = Math.sin(angle) * distance * 0.72;
    const patchRx = Math.max(4, rx * (0.34 + seededNoise(seed + 31 + i) * 0.20) * sizeBias);
    const patchRy = Math.max(3, ry * (0.26 + seededNoise(seed + 41 + i) * 0.18) * sizeBias);
    const patchPath = buildOrganicPath(
      center.x + offsetX,
      center.y + offsetY,
      patchRx,
      patchRy,
      seed + 70 + i * 11,
      roughness,
      22,
    );

    ctx.save();
    ctx.fillStyle = palette.body;
    ctx.fill(patchPath);
    ctx.restore();

    const coreShiftX = (seededNoise(seed + 91 + i) - 0.5) * patchRx * 0.24;
    const coreShiftY = (seededNoise(seed + 101 + i) - 0.5) * patchRy * 0.24;
    const corePath = buildOrganicPath(
      center.x + offsetX + coreShiftX,
      center.y + offsetY + coreShiftY,
      patchRx * 0.50,
      patchRy * 0.48,
      seed + 130 + i * 17,
      roughness * 0.75,
      18,
    );

    ctx.save();
    ctx.fillStyle = palette.core;
    ctx.fill(corePath);
    ctx.restore();

    const areaShare = clamp((0.16 + sizeBias * 0.12) / patchCount, 0.06, 0.16);
    const areaM2 = Math.max(120, zone.area * areaShare);
    const volumeM3 = Math.max(20, (depthCm / 100) * areaM2);
    const latJitter = (offsetY / Math.max(1, baseRadiusPx)) * (zone.radius / 111320) * 0.22;
    const lngJitter = (offsetX / Math.max(1, baseRadiusPx)) * (zone.radius / (111320 * Math.cos((zone.lat * Math.PI) / 180))) * 0.22;

    patches.push({
      zoneId: zone.id,
      patchIndex: i,
      path: patchPath,
      centerX: center.x + offsetX,
      centerY: center.y + offsetY,
      lat: zone.lat + latJitter,
      lng: zone.lng + lngJitter,
      nameAr: `${zone.nameAr} ${i + 1}`,
      nameEn: `${zone.nameEn} ${i + 1}`,
      region: zone.region,
      depthCm,
      volumeM3,
      areaM2,
      riskLevel: zone.riskLevel,
      source: zone.source,
      accuracyPct: zone.accuracyPct,
      intensity: zone.intensity,
    });
  }
}

export interface FloodHotspot {
  lat: number;
  lng: number;
  radius: number;
  baseDepth: number;
  intensity: number;
}

export interface FloodWaterLayerInstance {
  update: (precipMultiplier: number, lang?: 'ar' | 'en') => void;
  remove: () => void;
}

export function createFloodWaterLayer(
  map: any,
  _hotspots: FloodHotspot[],
  initialMultiplier = 1.0,
  initialLang: 'ar' | 'en' = 'ar',
): FloodWaterLayerInstance {
  if (!L || !map) return { update: () => {}, remove: () => {} };
  const container: HTMLElement = map.getContainer();
  if (!container) return { update: () => {}, remove: () => {} };

  container.querySelectorAll('#flood-water-canvas').forEach(el => el.remove());

  const canvas = document.createElement('canvas');
  canvas.id = 'flood-water-canvas';
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'auto',
    zIndex: '450',
    opacity: '0.96',
    mixBlendMode: 'multiply',
    cursor: 'default',
  });
  container.appendChild(canvas);

  let currentMultiplier = initialMultiplier;
  let currentLang: 'ar' | 'en' = initialLang;
  let animationFrame: number | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let patchIndex: PatchDetail[] = [];
  let activePopup: any = null;

  function closePopup() {
    if (activePopup) {
      map.closePopup(activePopup);
      activePopup = null;
    }
  }

  function draw(multiplier: number) {
    const size = map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size.x, size.y);
    patchIndex = [];

    const bounds = map.getBounds();
    const zoom = map.getZoom();
    const zones = getZonesForZoom(zoom);

    const visibleZones = zones.filter(zone => {
      const latPad = zone.radius / 111320;
      const lngPad = zone.radius / (111320 * Math.cos((zone.lat * Math.PI) / 180));
      return !(
        zone.lat + latPad < bounds.getSouth() ||
        zone.lat - latPad > bounds.getNorth() ||
        zone.lng + lngPad < bounds.getWest() ||
        zone.lng - lngPad > bounds.getEast()
      );
    });

    if (!visibleZones.length) return;

    visibleZones
      .slice()
      .sort((a, b) => (a.level - b.level) || (a.accuracyPct - b.accuracyPct))
      .forEach(zone => drawFloodZone(ctx, map, zone, multiplier, zoom, patchIndex));
  }

  function findPatch(clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    for (let i = patchIndex.length - 1; i >= 0; i--) {
      const patch = patchIndex[i];
      if (ctx.isPointInPath(patch.path, x, y)) return patch;
    }
    return null;
  }

  function openPatchPopup(patch: PatchDetail) {
    closePopup();
    activePopup = L.popup({
      autoClose: true,
      closeButton: false,
      className: 'flood-patch-popup',
      offset: [0, -10],
      maxWidth: 280,
    })
      .setLatLng([patch.lat, patch.lng])
      .setContent(buildPatchPopupHtml(patch, currentLang))
      .openOn(map);
  }

  function handlePointerMove(ev: MouseEvent) {
    const patch = findPatch(ev.clientX, ev.clientY);
    canvas.style.cursor = patch ? 'pointer' : 'default';
  }

  function handleClick(ev: MouseEvent) {
    const patch = findPatch(ev.clientX, ev.clientY);
    if (!patch) {
      closePopup();
      return;
    }
    openPatchPopup(patch);
  }

  function handleTouchEnd(ev: TouchEvent) {
    const touch = ev.changedTouches[0];
    if (!touch) return;
    const patch = findPatch(touch.clientX, touch.clientY);
    if (!patch) {
      closePopup();
      return;
    }
    openPatchPopup(patch);
  }

  function scheduleRender(multiplier: number, lang: 'ar' | 'en', immediate = false) {
    currentMultiplier = multiplier;
    currentLang = lang;

    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    if (debounceTimer !== null) clearTimeout(debounceTimer);

    const run = () => {
      animationFrame = requestAnimationFrame(() => {
        animationFrame = null;
        draw(currentMultiplier);
      });
    };

    if (immediate) run();
    else debounceTimer = setTimeout(run, 60);
  }

  const onMove = () => {
    closePopup();
    scheduleRender(currentMultiplier, currentLang, false);
  };
  const onSettle = () => scheduleRender(currentMultiplier, currentLang, true);

  canvas.addEventListener('mousemove', handlePointerMove);
  canvas.addEventListener('click', handleClick);
  canvas.addEventListener('touchend', handleTouchEnd, { passive: true });

  map.on('move', onMove);
  map.on('zoom', onMove);
  map.on('moveend', onSettle);
  map.on('zoomend', onSettle);
  map.on('resize', onSettle);
  map.on('popupclose', () => { activePopup = null; });

  scheduleRender(initialMultiplier, initialLang, true);

  return {
    update(precipMultiplier: number, lang: 'ar' | 'en' = 'ar') {
      scheduleRender(precipMultiplier, lang, true);
    },
    remove() {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      closePopup();
      canvas.removeEventListener('mousemove', handlePointerMove);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('touchend', handleTouchEnd);
      map.off('move', onMove);
      map.off('zoom', onMove);
      map.off('moveend', onSettle);
      map.off('zoomend', onSettle);
      map.off('resize', onSettle);
      canvas.remove();
    },
  };
}
