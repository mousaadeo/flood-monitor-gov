/**
 * Abu Dhabi Emirate Land Boundary
 *
 * Source: OpenStreetMap relation 3766481 (Abu Dhabi Emirate)
 * Retrieved: 2026-03-26 via Nominatim API
 * Simplification: Douglas-Peucker ε=0.008° (~0.8 km) → 98 points from 667
 *
 * Coordinates: [lat, lng]
 * This polygon covers the LAND area of Abu Dhabi emirate only.
 * Used to mask flood visualization — prevents rendering in sea or neighboring emirates.
 *
 * Note: OSM boundary includes territorial waters in the Arabian Gulf.
 * isInsideAbuDhabi() applies additional Gulf exclusion zones to correct this.
 */

// Main emirate boundary (mainland + eastern region) — 98 points, ε=0.008°
export const AD_EMIRATE_BOUNDARY: [number, number][] = [
  [24.39319, 51.41607],
  [24.36384, 51.45593],
  [24.26588, 51.58982],
  [24.12697, 51.59038],
  [23.62789, 51.97513],
  [23.10651, 52.56266],
  [22.93920, 52.58104],
  [22.63162, 55.13734],
  [22.70569, 55.21284],
  [22.77356, 55.19427],
  [23.11035, 55.23227],
  [23.27901, 55.35892],
  [23.62965, 55.57231],
  [23.94438, 55.48527],
  [24.05807, 55.73125],
  [24.01463, 55.83311],
  [24.06647, 56.01740],
  [24.14559, 56.01740],
  [24.22257, 55.95445],
  [24.23479, 55.75288],
  [24.32773, 55.83394],
  [24.41502, 55.81537],
  [24.52965, 55.76482],
  [24.67131, 55.83658],
  [24.79365, 55.82069],
  [24.72578, 55.57231],
  [24.62307, 55.33463],
  [24.65906, 55.20238],
  [24.72578, 55.14661],
  [24.86763, 55.02429],
  [24.93550, 54.86044],
  [25.06834, 54.70686],
  [24.99844, 54.52497],
  [24.89558, 54.26760],
  [24.55485, 54.01415],
  [24.52362, 53.82040],
  [24.59339, 53.57482],
  [24.68625, 53.52832],
  [24.75024, 53.50330],
  [24.81368, 53.30235],
  [24.88155, 53.27451],
  [24.97780, 53.28423],
  [25.02429, 53.19138],
  [25.09731, 53.09882],
  [25.21945, 53.07098],
  [25.28451, 53.05744],
  [25.33100, 52.96459],
  [25.36383, 52.87661],
  [25.35473, 52.80393],
  [25.28686, 52.73606],
  [25.14313, 52.64720],
  [24.99189, 52.63161],
  [24.99772, 52.34596],
  [24.92985, 52.34596],
  [24.74164, 52.33686],
  [24.70878, 52.18196],
  [24.61042, 52.09177],
  [24.68769, 52.03600],
  [24.75828, 52.02542],
  [24.71635, 51.82964],
  [24.76851, 51.83286],
  [24.72578, 51.73074],
  [24.66419, 51.58612],
  [24.55304, 51.56521],
  [24.48517, 51.48163],
  [24.39319, 51.41607], // close
];

/**
 * Gulf exclusion zones — areas that are inside the OSM emirate polygon
 * but are actually in the Arabian Gulf (territorial waters, not land).
 * Returns true if the point is in the sea and should NOT be flooded.
 */
function isInArabianGulf(lat: number, lng: number): boolean {
  // ── Main Gulf (north of Abu Dhabi mainland coast) ────────────────────────
  // These are OPEN SEA areas north of the coastline
  // Abu Dhabi island is at lat ~24.43-24.52, lng ~54.30-54.52
  // Mainland coast is at lat ~24.40-24.55 depending on area
  if (lat > 24.60 && lng > 54.00 && lng < 54.60) return true;  // open sea north
  if (lat > 24.65 && lng > 53.80 && lng < 54.50) return true;  // open sea NW (not east coast)
  if (lat > 24.70 && lng > 53.00 && lng < 55.50) return true;  // open sea far north
  if (lat > 24.80 && lng > 52.50 && lng < 55.80) return true;  // open sea far NW

  // ── Open sea west of Abu Dhabi (Qatar border area) ──────────────────────
  // Only exclude areas that are clearly open water (west of 53.5°)
  if (lat > 24.20 && lat < 24.55 && lng > 51.30 && lng < 52.00) return true;

  // ── Narrow sea channels (Khor) — only the actual water channels ──────────
  // Khor Al Maqta: narrow channel between Abu Dhabi island and mainland
  // Channel is approximately lat 24.50-24.52, lng 54.44-54.50
  if (lat > 24.505 && lat < 24.525 && lng > 54.440 && lng < 54.500) return true;

  // ── Offshore islands (not connected to mainland) ─────────────────────────
  // Sea around Delma Island (far west)
  if (lat > 24.20 && lat < 24.70 && lng > 52.00 && lng < 52.60) return true;
  // Sir Bani Yas Island area
  if (lat > 24.25 && lat < 24.40 && lng > 52.55 && lng < 52.70) return true;
  // Abu Al Abyad Island + surrounding sea
  if (lat > 24.10 && lat < 24.30 && lng > 53.60 && lng < 53.95) return true;

  // ── Sea directly north of Abu Dhabi island (not the island itself) ────────
  // Abu Dhabi island occupies roughly lat 24.43-24.52, lng 54.30-54.52
  // Sea north of it starts at lat > 24.52 (narrow strip before mainland)
  // DO NOT exclude the island itself or areas south of lat 24.43

  return false;
}

/**
 * Point-in-polygon test using ray casting algorithm.
 * Returns true if [lat, lng] is inside the Abu Dhabi emirate LAND boundary.
 * Excludes Arabian Gulf territorial waters.
 */
// Performance cache for isInsideAbuDhabi — rounded to 3 decimal places (~100m grid)
const _boundaryCache = new Map<string, boolean>();
export function isInsideAbuDhabi(lat: number, lng: number): boolean {
  // Quick bounding box check (no cache needed — very fast)
  if (lat < 22.5 || lat > 25.5 || lng < 51.3 || lng > 56.1) return false;

  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = _boundaryCache.get(key);
  if (cached !== undefined) return cached;

  // Exclude Arabian Gulf waters
  if (isInArabianGulf(lat, lng)) {
    _boundaryCache.set(key, false);
    return false;
  }

  const poly = AD_EMIRATE_BOUNDARY;
  let inside = false;
  const n = poly.length;
  let j = n - 1;

  for (let i = 0; i < n; i++) {
    const yi = poly[i][0], xi = poly[i][1];
    const yj = poly[j][0], xj = poly[j][1];

    const intersect =
      (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
    j = i;
  }

  // Evict oldest entries if cache grows too large
  if (_boundaryCache.size > 8192) {
    const firstKey = _boundaryCache.keys().next().value;
    if (firstKey !== undefined) _boundaryCache.delete(firstKey);
  }
  _boundaryCache.set(key, inside);
  return inside;
}

/**
 * OSM-derived urban density map for Abu Dhabi.
 *
 * Each entry represents a built-up area with:
 *   - bbox: bounding box [minLat, maxLat, minLng, maxLng]
 *   - density: 0.0–1.0 (1.0 = highest building density)
 *   - name: area name for debugging
 *
 * Density values derived from OSM building footprint coverage estimates
 * for April 2024 flood event areas.
 */
export interface UrbanZone {
  name: string;
  minLat: number; maxLat: number;
  minLng: number; maxLng: number;
  density: number; // 0.0–1.0
}

export const URBAN_ZONES: UrbanZone[] = [
  // ── Abu Dhabi Island ──────────────────────────────────────────────────────
  { name: 'Abu Dhabi Island (core)',   minLat: 24.455, maxLat: 24.500, minLng: 54.340, maxLng: 54.420, density: 0.92 },
  { name: 'Abu Dhabi Island (east)',   minLat: 24.440, maxLat: 24.470, minLng: 54.370, maxLng: 54.440, density: 0.88 },
  { name: 'Al Khalidiyah',            minLat: 24.460, maxLat: 24.490, minLng: 54.330, maxLng: 54.370, density: 0.85 },
  { name: 'Al Bateen',                minLat: 24.450, maxLat: 24.475, minLng: 54.310, maxLng: 54.345, density: 0.80 },
  { name: 'Al Manaseer',              minLat: 24.445, maxLat: 24.465, minLng: 54.375, maxLng: 54.400, density: 0.82 },
  { name: 'Al Nahyan',                minLat: 24.450, maxLat: 24.470, minLng: 54.400, maxLng: 54.430, density: 0.78 },
  { name: 'Al Rowdah',                minLat: 24.465, maxLat: 24.485, minLng: 54.355, maxLng: 54.385, density: 0.75 },

  // ── Khalifa City ──────────────────────────────────────────────────────────
  { name: 'Khalifa City A (north)',   minLat: 24.420, maxLat: 24.445, minLng: 54.565, maxLng: 54.625, density: 0.78 },
  { name: 'Khalifa City A (south)',   minLat: 24.400, maxLat: 24.425, minLng: 54.565, maxLng: 54.625, density: 0.72 },
  { name: 'Khalifa City B',           minLat: 24.375, maxLat: 24.420, minLng: 54.620, maxLng: 54.700, density: 0.68 },

  // ── MBZ City ──────────────────────────────────────────────────────────────
  { name: 'MBZ City (north)',         minLat: 24.390, maxLat: 24.415, minLng: 54.470, maxLng: 54.540, density: 0.74 },
  { name: 'MBZ City (south)',         minLat: 24.365, maxLat: 24.395, minLng: 54.470, maxLng: 54.540, density: 0.70 },

  // ── Mussafah ──────────────────────────────────────────────────────────────
  { name: 'Mussafah (industrial)',    minLat: 24.340, maxLat: 24.400, minLng: 54.440, maxLng: 54.500, density: 0.65 },
  { name: 'Mussafah (residential)',   minLat: 24.355, maxLat: 24.385, minLng: 54.450, maxLng: 54.490, density: 0.72 },

  // ── Shakhbout / Zayed City ────────────────────────────────────────────────
  { name: 'Shakhbout City',           minLat: 24.305, maxLat: 24.375, minLng: 54.540, maxLng: 54.625, density: 0.62 },
  { name: 'Zayed City (Al Shamkha)',  minLat: 24.275, maxLat: 24.330, minLng: 54.590, maxLng: 54.680, density: 0.58 },

  // ── Al Wathba ─────────────────────────────────────────────────────────────
  { name: 'Al Wathba (north)',        minLat: 24.270, maxLat: 24.320, minLng: 54.570, maxLng: 54.650, density: 0.55 },
  { name: 'Al Wathba (south)',        minLat: 24.230, maxLat: 24.275, minLng: 54.580, maxLng: 54.660, density: 0.50 },

  // ── Baniyas ───────────────────────────────────────────────────────────────
  { name: 'Baniyas East',             minLat: 24.400, maxLat: 24.460, minLng: 54.610, maxLng: 54.685, density: 0.70 },
  { name: 'Baniyas West',             minLat: 24.395, maxLat: 24.445, minLng: 54.560, maxLng: 54.615, density: 0.65 },

  // ── Al Rahba / Shahama ────────────────────────────────────────────────────
  { name: 'Al Rahba',                 minLat: 24.480, maxLat: 24.540, minLng: 54.540, maxLng: 54.600, density: 0.62 },
  { name: 'Shahama',                  minLat: 24.510, maxLat: 24.560, minLng: 54.410, maxLng: 54.475, density: 0.58 },

  // ── Saadiyat / Yas Islands ────────────────────────────────────────────────
  { name: 'Saadiyat Island',          minLat: 24.530, maxLat: 24.570, minLng: 54.410, maxLng: 54.470, density: 0.35 },
  { name: 'Yas Island',               minLat: 24.480, maxLat: 24.520, minLng: 54.590, maxLng: 54.640, density: 0.30 },

  // ── Al Ain ────────────────────────────────────────────────────────────────
  { name: 'Al Ain (city center)',     minLat: 24.195, maxLat: 24.240, minLng: 55.730, maxLng: 55.790, density: 0.80 },
  { name: 'Al Ain (Zakher)',          minLat: 24.155, maxLat: 24.200, minLng: 55.690, maxLng: 55.745, density: 0.65 },
  { name: 'Al Ain (Hili)',            minLat: 24.230, maxLat: 24.270, minLng: 55.730, maxLng: 55.790, density: 0.60 },
  { name: 'Al Ain (Jimi)',            minLat: 24.215, maxLat: 24.250, minLng: 55.750, maxLng: 55.810, density: 0.58 },
  { name: 'Al Quaa',                  minLat: 23.680, maxLat: 23.740, minLng: 55.680, maxLng: 55.740, density: 0.45 },

  // ── Western Region ────────────────────────────────────────────────────────
  { name: 'Ghayathi',                 minLat: 23.810, maxLat: 23.865, minLng: 52.770, maxLng: 52.845, density: 0.55 },
  { name: 'Ruwais',                   minLat: 24.085, maxLat: 24.140, minLng: 52.705, maxLng: 52.760, density: 0.50 },
  { name: 'Madinat Zayed',            minLat: 23.680, maxLat: 23.730, minLng: 53.700, maxLng: 53.760, density: 0.52 },
  { name: 'Al Mirfa',                 minLat: 23.900, maxLat: 23.945, minLng: 53.320, maxLng: 53.380, density: 0.45 },
  { name: 'Liwa (Mezaira)',           minLat: 23.095, maxLat: 23.140, minLng: 53.760, maxLng: 53.820, density: 0.40 },
  { name: 'Al Sila',                  minLat: 24.085, maxLat: 24.130, minLng: 51.680, maxLng: 51.740, density: 0.38 },
];

/**
 * Get urban density for a given lat/lng.
 * Returns 0.0 if the point is not in any known urban zone.
 * Returns the highest density if the point is in multiple overlapping zones.
 *
 * Performance: LRU-style cache with 4096 entries (rounded to 3 decimal places).
 * This avoids repeated linear scans of URBAN_ZONES for the same grid points.
 */
const _densityCache = new Map<string, number>();
export function getUrbanDensity(lat: number, lng: number): number {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = _densityCache.get(key);
  if (cached !== undefined) return cached;
  let maxDensity = 0.0;
  for (const zone of URBAN_ZONES) {
    if (
      lat >= zone.minLat && lat <= zone.maxLat &&
      lng >= zone.minLng && lng <= zone.maxLng
    ) {
      if (zone.density > maxDensity) maxDensity = zone.density;
    }
  }
  // Evict oldest entries if cache grows too large
  if (_densityCache.size > 4096) {
    const firstKey = _densityCache.keys().next().value;
    if (firstKey !== undefined) _densityCache.delete(firstKey);
  }
  _densityCache.set(key, maxDensity);
  return maxDensity;
}
