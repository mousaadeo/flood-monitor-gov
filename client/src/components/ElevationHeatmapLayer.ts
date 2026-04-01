/**
 * ElevationHeatmapLayer.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders a continuous topographic heatmap overlay on a Leaflet map using
 * an HTML5 Canvas element — same approach as FloodWaterLayer.ts.
 *
 * Color palette (terrain / hypsometric tinting):
 *   0–5m   → Deep blue  (#0A1628) — sea level / flood risk
 *   5–15m  → Blue       (#1565C0)
 *   15–30m → Teal       (#00695C)
 *   30–60m → Green      (#2E7D32)
 *   60–120m→ Olive      (#827717)
 *   120–250m→ Brown     (#6D4C41)
 *   250–500m→ Light tan (#A1887F)
 *   500m+  → White-grey (#ECEFF1)
 *
 * Design: "Geological Strata" — matches Dashboard.tsx GEO tokens.
 */

import L from 'leaflet';

// ─── Hypsometric color stops ──────────────────────────────────────────────────
// Each stop: [elevationMeters, r, g, b]
const TOPO_STOPS: [number, number, number, number][] = [
  [  -5,  10,  22,  40],  // deep water (below sea)
  [   0,  21,  67, 120],  // sea level / tidal
  [   3,  30,  90, 160],  // coastal low
  [   8,  38, 130, 180],  // near-coast
  [  15,  46, 160, 160],  // low plain
  [  25,  60, 140,  90],  // flat plain
  [  40,  80, 160,  70],  // gentle slope
  [  70, 120, 180,  60],  // low hills
  [ 120, 160, 180,  60],  // mid hills
  [ 200, 180, 160,  80],  // highland
  [ 350, 160, 120,  70],  // mountain foot
  [ 600, 140,  90,  60],  // mountain
  [1000, 200, 180, 160],  // high mountain
  [2000, 230, 220, 215],  // alpine
  [3000, 245, 240, 238],  // snow line
];

/** Interpolate RGB between two topo stops */
function topoColor(elev: number): [number, number, number] {
  const stops = TOPO_STOPS;
  if (elev <= stops[0][0]) return [stops[0][1], stops[0][2], stops[0][3]];
  if (elev >= stops[stops.length - 1][0]) {
    const last = stops[stops.length - 1];
    return [last[1], last[2], last[3]];
  }
  for (let i = 0; i < stops.length - 1; i++) {
    const [e0, r0, g0, b0] = stops[i];
    const [e1, r1, g1, b1] = stops[i + 1];
    if (elev >= e0 && elev <= e1) {
      const t = (elev - e0) / (e1 - e0);
      return [
        Math.round(r0 + t * (r1 - r0)),
        Math.round(g0 + t * (g1 - g0)),
        Math.round(b0 + t * (b1 - b0)),
      ];
    }
  }
  return [200, 200, 200];
}

/** Alpha based on elevation — lower = more opaque (more dangerous) */
function topoAlpha(elev: number, zMin: number, zMax: number): number {
  const range = Math.max(zMax - zMin, 1);
  const pct = (elev - zMin) / range;
  // Low areas: 0.75 opacity, high areas: 0.45 opacity
  return 0.75 - pct * 0.30;
}

// ─── Canvas-based Leaflet Layer ───────────────────────────────────────────────
export interface ElevationPoint {
  lat: number;
  lon: number;
  elev: number;
}

export interface ElevationLayerOptions {
  /** Grid step in degrees (default 0.00009 ≈ 10m) */
  step?: number;
  /** Overall opacity multiplier 0–1 */
  opacity?: number;
  /** Min/max elevation for normalisation */
  zMin: number;
  zMax: number;
}

/**
 * Creates a Leaflet SVG overlay that renders the elevation grid as a
 * continuous heatmap using bilinear-style color interpolation.
 *
 * Returns the overlay + an update function to re-render when zoom changes.
 */
export function createElevationHeatmapLayer(
  map: L.Map,
  points: ElevationPoint[],
  options: ElevationLayerOptions,
): {
  canvas: HTMLCanvasElement;
  overlay: L.Layer;
  redraw: () => void;
  remove: () => void;
} {
  const { step = 0.00009, opacity = 0.78, zMin, zMax } = options;

  // ── Build a lookup grid ──────────────────────────────────────────────────
  // Map lat/lon → elevation for fast pixel lookup
  const elevMap = new Map<string, number>();
  let gridMinLat = Infinity, gridMaxLat = -Infinity;
  let gridMinLon = Infinity, gridMaxLon = -Infinity;

  for (const p of points) {
    if (isNaN(p.elev)) continue;
    const key = `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
    elevMap.set(key, p.elev);
    if (p.lat < gridMinLat) gridMinLat = p.lat;
    if (p.lat > gridMaxLat) gridMaxLat = p.lat;
    if (p.lon < gridMinLon) gridMinLon = p.lon;
    if (p.lon > gridMaxLon) gridMaxLon = p.lon;
  }

  if (elevMap.size === 0) {
    // Return no-op if no data
    return {
      canvas: document.createElement('canvas'),
      overlay: L.layerGroup(),
      redraw: () => {},
      remove: () => {},
    };
  }

  // ── Create canvas ────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '400';

  // ── Leaflet custom pane ──────────────────────────────────────────────────
  if (!map.getPane('elevationPane')) {
    map.createPane('elevationPane');
    const pane = map.getPane('elevationPane')!;
    pane.style.zIndex = '400';
    pane.style.pointerEvents = 'none';
  }

  const pane = map.getPane('elevationPane')!;
  pane.appendChild(canvas);

  // ── Redraw function ──────────────────────────────────────────────────────
  function redraw() {
    const size = map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;

    // Position canvas at map origin
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(canvas, topLeft);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Determine pixel size of one grid cell
    const cellPxPt = map.latLngToContainerPoint([gridMinLat + step, gridMinLon]);
    const cellOriginPt = map.latLngToContainerPoint([gridMinLat, gridMinLon]);
    const cellH = Math.abs(cellPxPt.y - cellOriginPt.y) + 1;
    const cellW = Math.abs(
      map.latLngToContainerPoint([gridMinLat, gridMinLon + step]).x - cellOriginPt.x
    ) + 1;

    // Draw each grid cell
    for (const p of points) {
      if (isNaN(p.elev)) continue;

      const pt = map.latLngToContainerPoint([p.lat, p.lon]);
      const x = pt.x;
      const y = pt.y - cellH; // lat increases upward

      // Skip cells outside viewport (with margin)
      if (x + cellW < -10 || x > canvas.width + 10) continue;
      if (y + cellH < -10 || y > canvas.height + 10) continue;

      const [r, g, b] = topoColor(p.elev);
      const a = topoAlpha(p.elev, zMin, zMax) * opacity;

      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);
    }

    // ── Hillshade effect: subtle dark top-left shadow on each cell ────────
    // (lightweight approximation — just darken low-elevation cells slightly)
    // Already handled by alpha variation above.
  }

  // ── Attach map events ────────────────────────────────────────────────────
  map.on('zoom move zoomend moveend', redraw);
  redraw();

  // ── Return control object ────────────────────────────────────────────────
  function remove() {
    map.off('zoom move zoomend moveend', redraw);
    if (pane.contains(canvas)) pane.removeChild(canvas);
  }

  return {
    canvas,
    overlay: L.layerGroup(), // placeholder — actual rendering is via canvas
    redraw,
    remove,
  };
}

// ─── Legend data export ───────────────────────────────────────────────────────
export const TOPO_LEGEND = [
  { label: '0–5m (Sea Level)', color: 'rgb(21,67,120)',   risk: 'Inundation Risk' },
  { label: '5–15m (Coastal)',       color: 'rgb(38,130,180)',  risk: 'Risk High' },
  { label: '15–40m (Plain Low-lying)', color: 'rgb(60,140,90)',   risk: 'Warning' },
  { label: '40–120m (Hills)',      color: 'rgb(120,180,60)',  risk: 'Relatively Safe' },
  { label: '120–350m (Plateaus)',     color: 'rgb(180,160,80)',  risk: 'Safe' },
  { label: '350m+ (Mountains)',        color: 'rgb(140,90,60)',   risk: 'High Safe' },
];
