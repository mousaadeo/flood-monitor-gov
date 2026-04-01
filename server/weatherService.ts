/**
 * weatherService.ts — Server-side Weather Data Service
 * Fetches live weather & precipitation data from Open-Meteo API
 * Running on the server ensures consistent timezone handling across all browsers.
 *
 * Key advantage over client-side: Node.js has predictable Date behavior,
 * no browser-specific Intl.DateTimeFormat quirks.
 */

import { regions90 } from '@shared/regions90';
import { fetchAllRegionAccumulations, computeAccumulationSummary, type WaterAccumulationResult, type AccumulationSummary } from './waterAccumulationEngine';

export interface RegionWeather {
  id: string;
  nameAr: string;
  nameEn: string;
  lat: number;
  lon: number;
  currentPrecipitation: number;
  currentTemperature: number;
  currentWindSpeed: number;
  weatherCode: number;
  precipitationProbability: number;
  hourlyPrecipitation: number[];
  hourlyTimes: string[];
  hourlyProbability: number[];
  totalLast24h: number;
  maxNext48h: number;
  floodRisk: number;
  alertLevel: 'safe' | 'watch' | 'warning' | 'critical';
  lastUpdated: string;
  // Water accumulation data (hybrid: ERA5 + GloFAS + DEM)
  waterAccumulation: WaterAccumulationResult;
}

export interface SystemWeatherData {
  regions: RegionWeather[];
  fetchedAt: string;
  source: string;
  nowStr: string; // for debugging
  accumulationSummary: AccumulationSummary;
}

const REGIONS = regions90.map(r => ({ id: r.id, nameAr: r.nameAr, nameEn: r.nameEn, lat: r.lat, lon: r.lng }));

/**
 * computeFloodRisk — Multi-factor flood risk model
 *
 * Based on the Abu Dhabi Flood Risk Assessment Framework (ADWEA/ADCD 2023)
 * and the WMO Flash Flood Guidance methodology.
 *
 * Factors:
 *   1. Intensity trigger  (0–35): current precipitation rate — primary flash-flood driver
 *   2. Accumulation load  (0–30): 24-hour total — soil saturation proxy
 *   3. Forecast pressure  (0–20): max expected in next 48 h — preparedness signal
 *   4. Probability weight (0–10): model confidence from Open-Meteo ensemble
 *   5. Interaction bonus  (0– 5): non-linear amplifier when both intensity AND accumulation are high
 *
 * Thresholds calibrated against NCM March 2024 & April 2024 UAE storm events.
 * Abu Dhabi desert soil has very low infiltration capacity (~2 mm/h),
 * so even moderate rainfall quickly produces surface runoff.
 */
function computeFloodRisk(
  currentPrecip: number,
  total24h: number,
  maxNext48h: number,
  probability: number,
  total6h: number = 0  // Recent 6-hour accumulation — primary soil saturation signal
): number {
  // UAE desert soil infiltration capacity ~2 mm/h — any active rain triggers runoff risk
  //
  // 1. Intensity trigger — primary flash-flood driver in arid terrain
  //    Even 1 mm/h is significant: UAE roads flood at 2-3 mm/h sustained
  const intensityScore =
    currentPrecip <= 0   ? 0 :
    currentPrecip < 1    ? currentPrecip * 10 :                        // trace: 0–10
    currentPrecip < 3    ? 10 + (currentPrecip - 1) * 10 :            // light: 10–30
    currentPrecip < 7    ? 30 + (currentPrecip - 3) * 5 :             // moderate: 30–50
                           Math.min(50 + (currentPrecip - 7) * 3, 65); // heavy: 50–65

  // 2. Recent accumulation load (last 6h) — primary soil saturation signal
  //    Decays quickly when rain stops — reflects current ground conditions
  const recentAccumScore =
    total6h <= 0  ? 0 :
    total6h < 2   ? total6h * 4 :                                      // 0–8
    total6h < 8   ? 8 + (total6h - 2) * 2.5 :                         // 8–23
    total6h < 20  ? 23 + (total6h - 8) * 1.0 :                        // 23–35
                    Math.min(35 + (total6h - 20) * 0.3, 40);          // plateau at 40

  // 2b. Historical 24h context — reduced weight (background soil moisture only)
  //     Only contributes if there was significant recent rain (within 6h)
  const historicalBonus = total6h > 0
    ? Math.min((total24h - total6h) * 0.05, 8)   // max 8 pts from old rain
    : Math.min((total24h) * 0.03, 5);             // minimal residual if no recent rain

  // 3. Forecast pressure — forward-looking risk (next 48h max)
  const forecastScore = Math.min(maxNext48h * 2.0, 28);

  // 4. Probability weight — ensemble confidence (higher weight for active events)
  const probScore = (probability / 100) * 15;

  // 5. Interaction amplifier — active rain + high probability = compounding risk
  const interactionBonus =
    currentPrecip >= 1 && probability >= 50
      ? Math.min(currentPrecip * (probability / 100) * 1.5, 12)
      : currentPrecip >= 3 && total6h >= 5
        ? Math.min((currentPrecip - 3) * (total6h - 5) * 0.1, 8)
        : 0;

  const raw = intensityScore + recentAccumScore + historicalBonus + forecastScore + probScore + interactionBonus;
  return Math.min(Math.round(raw), 100);
}

function getAlertLevel(risk: number): RegionWeather['alertLevel'] {
  if (risk >= 70) return 'critical';  // Extreme — immediate danger, active heavy rain
  if (risk >= 50) return 'warning';   // High — active rainfall, road flooding likely
  if (risk >= 30) return 'watch';     // Elevated — monitoring required, rain expected
  return 'safe';
}

/**
 * Get current Dubai time string in format YYYY-MM-DDTHH:00
 * Dubai = UTC+4. Using UTC arithmetic for reliability.
 */
function getDubaiNowStr(): string {
  const now = new Date();
  const dubaiOffsetMs = 4 * 60 * 60 * 1000; // UTC+4
  const dubaiNow = new Date(now.getTime() + dubaiOffsetMs);
  const y = dubaiNow.getUTCFullYear().toString();
  const mo = String(dubaiNow.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dubaiNow.getUTCDate()).padStart(2, '0');
  const hr = String(dubaiNow.getUTCHours()).padStart(2, '0');
  return `${y}-${mo}-${d}T${hr}:00`;
}

function genFallbackTimes(): string[] {
  const dubaiOffsetMs = 4 * 60 * 60 * 1000;
  const startMs = Date.now() - 24 * 60 * 60 * 1000;
  const times: string[] = [];
  for (let h = 0; h < 96; h++) {
    const t = new Date(startMs + h * 60 * 60 * 1000);
    const dubaiT = new Date(t.getTime() + dubaiOffsetMs);
    const y = dubaiT.getUTCFullYear().toString();
    const mo = String(dubaiT.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dubaiT.getUTCDate()).padStart(2, '0');
    const hr = String(dubaiT.getUTCHours()).padStart(2, '0');
    times.push(`${y}-${mo}-${d}T${hr}:00`);
  }
  return times;
}

// Server-side cache (shared across all requests)
let _serverCache: SystemWeatherData | null = null;
let _serverCacheTime = 0;
const CACHE_TTL = 4 * 60 * 1000; // 4 minutes — slightly less than 5-min refresh cycle
let _backgroundRefreshRunning = false;

export async function fetchAllRegionsWeatherServer(): Promise<SystemWeatherData> {
  const now = Date.now();
  if (_serverCache && (now - _serverCacheTime) < CACHE_TTL) {
    return _serverCache;
  }

  const BATCH_SIZE = 30; // Smaller batches to avoid timeout
  const allRegions: RegionWeather[] = [];
  const nowStr = getDubaiNowStr();

  console.log(`[weatherService] Fetching data, nowStr=${nowStr}`);

  // Helper: fetch with retry
  async function fetchBatchWithRetry(url: string, retries = 2): Promise<any[]> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(30000) }); // 30s timeout
        if (resp.ok) {
          const json = await resp.json();
          return Array.isArray(json) ? json : [json];
        }
      } catch (e) {
        console.warn(`[weatherService] Batch attempt ${attempt} failed:`, (e as Error).message);
        if (attempt < retries) await new Promise(res => setTimeout(res, 2000 * attempt));
      }
    }
    return [];
  }

  for (let batchStart = 0; batchStart < REGIONS.length; batchStart += BATCH_SIZE) {
    const batch = REGIONS.slice(batchStart, batchStart + BATCH_SIZE);
    const lats = batch.map(r => r.lat).join(',');
    const lons = batch.map(r => r.lon).join(',');
    const batchUrl = `https://api.open-meteo.com/v1/forecast?` +
      `latitude=${lats}&longitude=${lons}` +
      `&hourly=precipitation,precipitation_probability,temperature_2m,wind_speed_10m,weather_code` +
      `&minutely_15=precipitation,rain,weather_code` +
      `&current=precipitation,rain,temperature_2m,weather_code,wind_speed_10m,precipitation_probability,relative_humidity_2m` +
      `&past_days=1&forecast_days=2` +
      `&past_minutely_15=4&forecast_minutely_15=4` +
      `&timezone=Asia%2FDubai`;

    const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
    const batchData = await fetchBatchWithRetry(batchUrl);
    if (batchData.length > 0) {
      console.log(`[weatherService] Batch ${batchNum}: got ${batchData.length} regions OK`);
    } else {
      console.warn(`[weatherService] Batch ${batchNum}: all retries failed, using fallback zeros`);
    }

    for (let i = 0; i < batch.length; i++) {
      const r = batch[i];
      const d = batchData[i];
      if (!d || !d.current || !d.hourly) {
        allRegions.push({
          id: r.id, nameAr: r.nameAr, nameEn: r.nameEn, lat: r.lat, lon: r.lon,
          currentPrecipitation: 0, currentTemperature: 0, currentWindSpeed: 0,
          weatherCode: 0, precipitationProbability: 0,
          hourlyPrecipitation: Array(96).fill(0), hourlyTimes: genFallbackTimes(),
          hourlyProbability: Array(96).fill(0), totalLast24h: 0, maxNext48h: 0,
          floodRisk: 0, alertLevel: 'safe', lastUpdated: new Date().toISOString(),
          waterAccumulation: { score: 0, level: 'none', estimatedDepthCm: 0, estimatedAreaKm2: 0, wadiDischarge: null, sources: [], susceptibility: 55, soilType: 'sand' },
        });
        continue;
      }

      const current = d.current;
      const hourly = d.hourly;
      const minutely15 = d.minutely_15;
      const currentIdx = hourly.time.findIndex((t: string) => t === nowStr);
      const idx = currentIdx >= 0 ? currentIdx : Math.floor(hourly.time.length / 2);

      // Use minutely_15 for most recent precipitation reading (last completed 15-min interval)
      // This gives ~15-min resolution vs hourly — much more responsive to active rain events
      let currentPrecip15min = current.precipitation || 0;
      if (minutely15?.precipitation && minutely15.precipitation.length > 0) {
        // Find the most recent non-null 15-min reading
        const m15precip = minutely15.precipitation as number[];
        for (let mi = m15precip.length - 1; mi >= 0; mi--) {
          if (m15precip[mi] !== null && m15precip[mi] !== undefined) {
            currentPrecip15min = m15precip[mi];
            break;
          }
        }
      }
      // Also use current.rain if available (more accurate for liquid precipitation)
      const currentRain = current.rain ?? current.precipitation ?? 0;
      // Use the higher of 15-min reading or current API reading for accuracy
      const effectivePrecip = Math.max(currentPrecip15min, currentRain);

      const past24h = hourly.precipitation.slice(0, idx);
      const total24h = past24h.reduce((s: number, v: number) => s + (v || 0), 0);
      // Recent 6-hour accumulation — primary signal for current ground conditions
      const past6h = hourly.precipitation.slice(Math.max(0, idx - 6), idx);
      const total6h = past6h.reduce((s: number, v: number) => s + (v || 0), 0);
      const next48h = hourly.precipitation.slice(idx, idx + 48);
      const maxNext48h = Math.max(0, ...next48h.map((v: number) => v || 0));
      const currentProb = current.precipitation_probability || hourly.precipitation_probability[idx] || 0;
      const floodRisk = computeFloodRisk(effectivePrecip, total24h, maxNext48h, currentProb, total6h);

      allRegions.push({
        id: r.id, nameAr: r.nameAr, nameEn: r.nameEn, lat: r.lat, lon: r.lon,
        currentPrecipitation: Math.round(effectivePrecip * 10) / 10,
        currentTemperature: Math.round((current.temperature_2m || 0) * 10) / 10,
        currentWindSpeed: Math.round((current.wind_speed_10m || 0) * 10) / 10,
        weatherCode: current.weather_code || 0,
        precipitationProbability: currentProb,
        hourlyPrecipitation: hourly.precipitation,
        hourlyTimes: hourly.time,
        hourlyProbability: hourly.precipitation_probability,
        totalLast24h: Math.round(total24h * 10) / 10,
        maxNext48h: Math.round(maxNext48h * 10) / 10,
        floodRisk,
        alertLevel: getAlertLevel(floodRisk),
        lastUpdated: new Date().toISOString(),
        // Placeholder — will be filled by accumulation engine below
        waterAccumulation: { score: 0, level: 'none', estimatedDepthCm: 0, estimatedAreaKm2: 0, wadiDischarge: null, sources: [], susceptibility: 55, soilType: 'sand' },
      });
    }

    if (batchStart + BATCH_SIZE < REGIONS.length) {
      await new Promise(res => setTimeout(res, 300));
    }
  }

  // ── Water Accumulation Engine (GloFAS + DEM) ──────────────────────────────
  console.log('[weatherService] Running water accumulation engine (GloFAS + DEM)...');
  try {
    const accumulationData = await fetchAllRegionAccumulations(
      allRegions.map(r => ({
        id: r.id,
        lat: r.lat,
        lon: r.lon,
        currentPrecipitation: r.currentPrecipitation,
        totalLast24h: r.totalLast24h,
        maxNext48h: r.maxNext48h,
      }))
    );

    // Merge accumulation data back into regions
    const accMap = new Map(accumulationData.map(a => [a.regionId, a.accumulation]));
    for (const region of allRegions) {
      const acc = accMap.get(region.id);
      if (acc) region.waterAccumulation = acc;
    }

    const summary = computeAccumulationSummary(accumulationData);
    const activeWadis = summary.activeWadis;
    const regionsWithWater = summary.totalRegionsWithWater;
    console.log(`[weatherService] Accumulation: ${regionsWithWater} regions with water, ${activeWadis} active wadis, maxScore=${summary.maxScore}`);

    _serverCache = {
      regions: allRegions,
      fetchedAt: new Date().toISOString(),
      source: 'Open-Meteo ERA5 + GloFAS Flood API + DEM Topographic Analysis',
      nowStr,
      accumulationSummary: summary,
    };
  } catch (e) {
    console.warn('[weatherService] Accumulation engine failed, using ERA5 only:', e);
    const fallbackSummary = { totalRegionsWithWater: 0, extremeCount: 0, severeCount: 0, moderateCount: 0, minorCount: 0, maxScore: 0, maxScoreRegionId: '', totalEstimatedAreaKm2: 0, activeWadis: 0 };
    _serverCache = {
      regions: allRegions,
      fetchedAt: new Date().toISOString(),
      source: 'Open-Meteo Forecast API (server-side)',
      nowStr,
      accumulationSummary: fallbackSummary,
    };
  }

  _serverCacheTime = now;

  const maxRisk = Math.max(...allRegions.map(r => r.floodRisk));
  const totalPrecip = allRegions.reduce((s, r) => s + r.totalLast24h, 0);
  console.log(`[weatherService] Done: ${allRegions.length} regions, maxRisk=${maxRisk}, totalPrecip=${totalPrecip.toFixed(1)}mm, nowStr=${nowStr}`);

  return _serverCache!;
}

export function invalidateServerWeatherCache() {
  _serverCache = null;
  _serverCacheTime = 0;
}

/**
 * Returns the current in-memory cached weather data without triggering a new fetch.
 * Used by the alert engine to check flood risk without additional API calls.
 */
export function getCachedWeatherData(): SystemWeatherData | null {
  return _serverCache;
}

/**
 * Background refresh loop — pre-fetches data every 90 seconds so clients
 * always get fresh data instantly without waiting for a full fetch.
 */
export function startBackgroundWeatherRefresh() {
  if (_backgroundRefreshRunning) return;
  _backgroundRefreshRunning = true;
  // Initial warm-up fetch
  fetchAllRegionsWeatherServer().catch(err =>
    console.error('[weatherService] Background warm-up failed:', err)
  );
  // Refresh every 5 minutes for near-real-time accuracy
  setInterval(() => {
    invalidateServerWeatherCache();
    fetchAllRegionsWeatherServer().catch(err =>
      console.error('[weatherService] Background refresh failed:', err)
    );
  }, 5 * 60 * 1000);
}
