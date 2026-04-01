/**
 * FloodWaterLayer — precision blue-depth flood overlay
 *
 * الهدف من هذه النسخة هو:
 * 1) استخدام تدرج أزرق واضح حسب العمق والكثافة.
 * 2) تقليل التوسع المبالغ فيه خارج موقع التجمع.
 * 3) إسقاط الشكل فوق مناطق الفيضانات الحقيقية بحسب مستوى التكبير.
 * 4) تقديم مظهر ذكي ومتقدم فوق الخلفية الفضائية دون بقع عشوائية واسعة.
 */

import L from 'leaflet';
import { getZonesForZoom, type FloodZoneMulti } from '@/services/floodMapData';
import { classifyByDepth, WATER_COLORS } from '@shared/waterStandard';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function seededNoise(seed: number): number {
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

function metersToPixelRadius(map: any, lat: number, lng: number, meters: number): number {
  const center = map.latLngToContainerPoint([lat, lng]);
  const lngDelta = meters / (111320 * Math.cos((lat * Math.PI) / 180));
  const edge = map.latLngToContainerPoint([lat, lng + lngDelta]);
  return Math.max(4, Math.abs(edge.x - center.x));
}

function makeOrganicPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seedBase: number,
  roughness: number,
  pointCount = 34
) {
  ctx.beginPath();
  for (let i = 0; i <= pointCount; i++) {
    const a = (i / pointCount) * Math.PI * 2;
    const n1 = seededNoise(seedBase + i * 0.71);
    const n2 = seededNoise(seedBase * 1.37 + i * 1.93);
    const n3 = seededNoise(seedBase * 2.11 + i * 2.87);
    const dirBias = 1 + Math.sin(a * 2.2 + n3 * 2.4) * roughness * 0.16;
    const wobble = 1 + (n1 - 0.5) * roughness + (n2 - 0.5) * roughness * 0.45;
    const x = cx + Math.cos(a) * rx * wobble * dirBias;
    const y = cy + Math.sin(a) * ry * (1 + (n2 - 0.5) * roughness * 0.72);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function getDepthPalette(depthCm: number, intensity: number) {
  const level = classifyByDepth(depthCm);
  const base = WATER_COLORS[level];
  const nextLevel = depthCm >= 65 ? WATER_COLORS.severe : depthCm >= 32 ? WATER_COLORS.moderate : WATER_COLORS.minor;
  const alphaBase = clamp(0.22 + (depthCm / 100) * 0.28 + intensity * 0.10, 0.20, 0.62);
  const edgeAlpha = clamp(alphaBase * 0.52, 0.12, 0.30);
  const coreAlpha = clamp(alphaBase * 1.28, 0.28, 0.82);
  const highlightAlpha = clamp(0.05 + (1 - Math.min(depthCm, 80) / 80) * 0.05, 0.03, 0.10);

  return {
    outer: rgbaFromHex(base.hex, edgeAlpha),
    body: rgbaFromHex(nextLevel.hex, alphaBase),
    core: rgbaFromHex(WATER_COLORS[level].stroke === 'transparent' ? nextLevel.hex : WATER_COLORS[level].stroke.replace('transparent', nextLevel.hex), coreAlpha),
    stroke: rgbaFromHex(base.stroke === 'transparent' ? nextLevel.hex : base.stroke, clamp(alphaBase * 0.88, 0.20, 0.55)),
    highlight: `rgba(210, 235, 255, ${highlightAlpha})`,
  };
}

function getFootprintScale(zone: FloodZoneMulti, zoom: number) {
  const accuracyScale = clamp(zone.accuracyPct / 100, 0.82, 0.99);
  const levelScale = zone.level === 1 ? 0.42 : zone.level === 2 ? 0.56 : 0.72;
  const riskTightness = zone.riskLevel === 'critical' ? 1.00 : zone.riskLevel === 'high' ? 0.96 : zone.riskLevel === 'medium' ? 0.90 : 0.86;
  const zoomRefine = zoom >= 13 ? 1.08 : zoom >= 10 ? 1.0 : 0.92;
  return clamp(levelScale * accuracyScale * riskTightness * zoomRefine, 0.34, 0.78);
}

function getAxes(baseRadiusPx: number, zone: FloodZoneMulti, zoom: number) {
  const footprint = getFootprintScale(zone, zoom);
  const depthT = clamp(zone.waterDepth / 85, 0.12, 1);
  const intensityT = clamp(zone.intensity, 0.2, 1);
  const rx = Math.max(8, baseRadiusPx * footprint * (0.86 + intensityT * 0.18));
  const ry = Math.max(6, baseRadiusPx * footprint * (0.64 + depthT * 0.20));
  return { rx, ry };
}

function drawFloodZone(
  ctx: CanvasRenderingContext2D,
  map: any,
  zone: FloodZoneMulti,
  multiplier: number,
  zoom: number
) {
  const depthCm = Math.max(0, zone.waterDepth * multiplier);
  if (depthCm < 1) return;

  const center = map.latLngToContainerPoint([zone.lat, zone.lng]);
  const baseRadiusPx = metersToPixelRadius(map, zone.lat, zone.lng, zone.radius);
  const { rx, ry } = getAxes(baseRadiusPx, zone, zoom);
  const seed = zone.lat * 1000 + zone.lng * 100 + zone.level * 7;
  const rotation = ((zone.lat + zone.lng * 2.7) * 13.3) % (Math.PI * 2);
  const roughness = clamp(0.12 + (1 - zone.accuracyPct / 100) * 0.36 + (1 - zone.intensity) * 0.08, 0.12, 0.26);
  const palette = getDepthPalette(depthCm, zone.intensity);

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(rotation);

  // Outer shallow fringe — remains tight and blue, without muddy expansion.
  ctx.save();
  ctx.fillStyle = palette.outer;
  ctx.strokeStyle = 'rgba(255,255,255,0)';
  makeOrganicPath(ctx, 0, 0, rx * 1.05, ry * 1.03, seed + 10, roughness, 32);
  ctx.fill();
  ctx.restore();

  // Main body.
  ctx.save();
  ctx.shadowColor = 'rgba(16, 56, 160, 0.10)';
  ctx.shadowBlur = Math.max(3, rx * 0.08);
  ctx.fillStyle = palette.body;
  makeOrganicPath(ctx, 0, 0, rx * 0.92, ry * 0.90, seed + 20, roughness * 0.9, 30);
  ctx.fill();
  ctx.restore();

  // Central deeper pool.
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = palette.core;
  makeOrganicPath(
    ctx,
    rx * ((seededNoise(seed + 31) - 0.5) * 0.14),
    ry * ((seededNoise(seed + 32) - 0.5) * 0.12),
    rx * 0.54,
    ry * 0.50,
    seed + 30,
    roughness * 0.72,
    24
  );
  ctx.fill();
  ctx.restore();

  // Optional secondary pocket only for stronger zones.
  if (depthCm >= 24 || zone.intensity >= 0.72) {
    const lobeX = rx * (0.24 + seededNoise(seed + 40) * 0.18);
    const lobeY = ry * ((seededNoise(seed + 41) - 0.5) * 0.42);
    ctx.save();
    ctx.fillStyle = rgbaFromHex(WATER_COLORS[classifyByDepth(depthCm >= 40 ? depthCm - 8 : depthCm)].hex, clamp(0.24 + zone.intensity * 0.16, 0.22, 0.46));
    makeOrganicPath(ctx, lobeX, lobeY, rx * 0.24, ry * 0.22, seed + 42, roughness * 0.82, 18);
    ctx.fill();
    ctx.restore();
  }

  // Subtle contour stroke improves readability on satellite view.
  ctx.save();
  ctx.lineWidth = Math.max(0.8, Math.min(2.4, rx * 0.028));
  ctx.strokeStyle = palette.stroke;
  makeOrganicPath(ctx, 0, 0, rx * 0.92, ry * 0.90, seed + 20, roughness * 0.9, 30);
  ctx.stroke();
  ctx.restore();

  // Light reflection for advanced intelligent look.
  const sheen = ctx.createLinearGradient(-rx * 0.6, -ry * 0.5, rx * 0.7, ry * 0.65);
  sheen.addColorStop(0, 'rgba(255,255,255,0.00)');
  sheen.addColorStop(0.32, palette.highlight);
  sheen.addColorStop(0.58, 'rgba(255,255,255,0.00)');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = sheen;
  makeOrganicPath(ctx, -rx * 0.04, -ry * 0.02, rx * 0.74, ry * 0.68, seed + 50, roughness * 0.55, 22);
  ctx.fill();
  ctx.restore();

  ctx.restore();
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
  initialLang: 'ar' | 'en' = 'ar'
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
    pointerEvents: 'none',
    zIndex: '450',
    opacity: '0.98',
    mixBlendMode: 'source-over',
  });
  container.appendChild(canvas);

  let currentMultiplier = initialMultiplier;
  let currentLang: 'ar' | 'en' = initialLang;
  let animationFrame: number | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function draw(multiplier: number) {
    const size = map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size.x, size.y);

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

    // Draw larger/lower-accuracy zones first, then precise zones above them.
    visibleZones
      .slice()
      .sort((a, b) => (a.level - b.level) || (a.accuracyPct - b.accuracyPct))
      .forEach(zone => drawFloodZone(ctx, map, zone, multiplier, zoom));
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

  const onMove = () => scheduleRender(currentMultiplier, currentLang, false);
  const onSettle = () => scheduleRender(currentMultiplier, currentLang, true);

  map.on('move', onMove);
  map.on('zoom', onMove);
  map.on('moveend', onSettle);
  map.on('zoomend', onSettle);
  map.on('resize', onSettle);

  scheduleRender(initialMultiplier, initialLang, true);

  return {
    update(precipMultiplier: number, lang: 'ar' | 'en' = 'ar') {
      scheduleRender(precipMultiplier, lang, true);
    },
    remove() {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      map.off('move', onMove);
      map.off('zoom', onMove);
      map.off('moveend', onSettle);
      map.off('zoomend', onSettle);
      map.off('resize', onSettle);
      canvas.remove();
    },
  };
}
