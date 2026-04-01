/**
 * weatherApi.ts — Real Data Service
 * Fetches live weather & precipitation data from Open-Meteo API
 * for Abu Dhabi emirate regions (no API key required)
 *
 * Data sources:
 * - Open-Meteo Forecast API (free, no key): precipitation, temperature, wind
 * - WMO weather codes for condition descriptions
 */
import { regions90 } from '@/data/regions90';

export interface RegionWeather {
  id: string;
  nameAr: string;
  nameEn: string;
  lat: number;
  lon: number;
  currentPrecipitation: number;    // mm
  currentTemperature: number;      // °C
  currentWindSpeed: number;        // km/h
  weatherCode: number;             // WMO code
  precipitationProbability: number; // %
  hourlyPrecipitation: number[];   // last 24h + next 24h
  hourlyTimes: string[];
  hourlyProbability: number[];
  totalLast24h: number;            // mm total last 24h
  maxNext48h: number;              // mm max in next 48h
  floodRisk: number;               // 0-100 computed
  alertLevel: 'safe' | 'watch' | 'warning' | 'critical';
  lastUpdated: string;
}

export interface SystemWeatherData {
  regions: RegionWeather[];
  fetchedAt: string;
  source: string;
}

// Abu Dhabi emirate — 90 regions
const REGIONS = regions90.map(r => ({ id: r.id, nameAr: r.nameAr, nameEn: r.nameEn, lat: r.lat, lon: r.lng }));

// WMO weather code to Arabic description
export const WMO_DESCRIPTIONS: Record<number, { ar: string; en: string; icon: string }> = {
  0: { ar: 'Clear sky', en: 'Clear sky', icon: '☀️' },
  1: { ar: 'Mainly clear', en: 'Mainly clear', icon: '🌤️' },
  2: { ar: 'Partly cloudy', en: 'Partly cloudy', icon: '⛅' },
  3: { ar: 'Overcast', en: 'Overcast', icon: '☁️' },
  45: { ar: 'Fog', en: 'Fog', icon: '🌫️' },
  48: { ar: 'Icy fog', en: 'Icy fog', icon: '🌫️' },
  51: { ar: 'Light drizzle', en: 'Light drizzle', icon: '🌦️' },
  53: { ar: 'Moderate drizzle', en: 'Moderate drizzle', icon: '🌦️' },
  55: { ar: 'Dense drizzle', en: 'Dense drizzle', icon: '🌧️' },
  61: { ar: 'Slight rain', en: 'Slight rain', icon: '🌧️' },
  63: { ar: 'Moderate rain', en: 'Moderate rain', icon: '🌧️' },
  65: { ar: 'Heavy rain', en: 'Heavy rain', icon: '🌧️' },
  80: { ar: 'Slight showers', en: 'Slight showers', icon: '🌦️' },
  81: { ar: 'Moderate showers', en: 'Moderate showers', icon: '🌧️' },
  82: { ar: 'Violent showers', en: 'Violent showers', icon: '⛈️' },
  95: { ar: 'Thunderstorm', en: 'Thunderstorm', icon: '⛈️' },
  96: { ar: 'Thunderstorm with hail', en: 'Thunderstorm with hail', icon: '⛈️' },
  99: { ar: 'Thunderstorm with heavy hail', en: 'Thunderstorm with heavy hail', icon: '⛈️' },
};

/**
 * Compute flood risk score (0-100) based on precipitation data
 * Uses a weighted algorithm considering:
 * - Current precipitation rate
 * - Total last 24h accumulation
 * - Max expected in next 48h
 * - Precipitation probability
 */
function computeFloodRisk(
  currentPrecip: number,
  total24h: number,
  maxNext48h: number,
  probability: number
): number {
  // Weights based on empirical flood risk models for arid regions (UAE)
  const currentScore = Math.min(currentPrecip * 15, 40);   // High weight on current rate
  const accumScore = Math.min(total24h * 1.5, 30);          // Accumulation risk
  const forecastScore = Math.min(maxNext48h * 2, 20);       // Forecast risk
  const probScore = (probability / 100) * 10;               // Probability factor

  return Math.min(Math.round(currentScore + accumScore + forecastScore + probScore), 100);
}

/**
 * Determine alert level from flood risk score
 */
function getAlertLevel(risk: number): RegionWeather['alertLevel'] {
  if (risk >= 70) return 'critical';
  if (risk >= 45) return 'warning';
  if (risk >= 20) return 'watch';
  return 'safe';
}

/**
 * Fetch weather data for a single region from Open-Meteo
 */
async function fetchRegionWeather(region: typeof REGIONS[0]): Promise<RegionWeather> {
  const url = `https://api.open-meteo.com/v1/forecast?` +
    `latitude=${region.lat}&longitude=${region.lon}` +
    `&hourly=precipitation,rain,precipitation_probability,temperature_2m,wind_speed_10m,weather_code` +
    `&current=precipitation,temperature_2m,weather_code,wind_speed_10m,precipitation_probability` +
    `&past_days=1&forecast_days=2` +
    `&timezone=Asia%2FDubai`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Meteo API error: ${response.status}`);
  const data = await response.json();

  const current = data.current;
  const hourly = data.hourly;

  // Find current hour index — Dubai timezone = UTC+4 (14400 seconds)
  // API returns times in Dubai local time (confirmed by utc_offset_seconds=14400)
  // Use direct UTC arithmetic to avoid Intl.DateTimeFormat browser inconsistencies
  const now = new Date();
  const dubaiOffsetMs = 4 * 60 * 60 * 1000; // UTC+4
  const dubaiNow = new Date(now.getTime() + dubaiOffsetMs);
  const _y = dubaiNow.getUTCFullYear().toString();
  const _mo = String(dubaiNow.getUTCMonth() + 1).padStart(2, '0');
  const _d = String(dubaiNow.getUTCDate()).padStart(2, '0');
  const _hr = String(dubaiNow.getUTCHours()).padStart(2, '0');
  const nowStr = `${_y}-${_mo}-${_d}T${_hr}:00`;
  const currentIdx = hourly.time.findIndex((t: string) => t === nowStr);
  const idx = currentIdx >= 0 ? currentIdx : Math.floor(hourly.time.length / 2); // fallback to middle

  // Last 24h precipitation (past_days=1 gives us 24h of past data)
  const past24h = hourly.precipitation.slice(0, idx);
  const total24h = past24h.reduce((sum: number, v: number) => sum + (v || 0), 0);

  // Next 48h max precipitation
  const next48h = hourly.precipitation.slice(idx, idx + 48);
  const maxNext48h = Math.max(...next48h.map((v: number) => v || 0));

  // Current precipitation probability
  const currentProb = current.precipitation_probability || hourly.precipitation_probability[idx] || 0;

  // Compute flood risk
  const floodRisk = computeFloodRisk(
    current.precipitation || 0,
    total24h,
    maxNext48h,
    currentProb
  );

  return {
    id: region.id,
    nameAr: region.nameAr,
    nameEn: region.nameEn,
    lat: region.lat,
    lon: region.lon,
    currentPrecipitation: Math.round((current.precipitation || 0) * 10) / 10,
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
  };
}

/**
 * Fetch real weather data for all Abu Dhabi regions
 * Returns cached data if called within 10 minutes
 */
let _cache: SystemWeatherData | null = null;
let _cacheTime = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes (rate limit protection)

export async function fetchAllRegionsWeather(): Promise<SystemWeatherData> {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < CACHE_TTL) {
    return _cache;
  }

  // -------------------------------------------------------
  // Batch requests: Open-Meteo supports up to 50 locations
  // per request via comma-separated lat/lon params.
  // We split 90 regions into 2 batches of 45.
  // -------------------------------------------------------
  const BATCH_SIZE = 45;
  const allRegions: RegionWeather[] = [];

  const genFallbackTimes = (): string[] => {
    // Use UTC arithmetic for Dubai timezone (UTC+4) to avoid browser Intl inconsistencies
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
  };

  // CRITICAL: Dubai timezone = UTC+4 — use direct UTC arithmetic for cross-browser reliability
  const nowStr = (() => {
    const n = new Date();
    const dubaiOffsetMs = 4 * 60 * 60 * 1000;
    const dubaiNow = new Date(n.getTime() + dubaiOffsetMs);
    const y = dubaiNow.getUTCFullYear().toString();
    const mo = String(dubaiNow.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dubaiNow.getUTCDate()).padStart(2, '0');
    const hr = String(dubaiNow.getUTCHours()).padStart(2, '0');
    return `${y}-${mo}-${d}T${hr}:00`;
  })();

  for (let batchStart = 0; batchStart < REGIONS.length; batchStart += BATCH_SIZE) {
    const batch = REGIONS.slice(batchStart, batchStart + BATCH_SIZE);
    const lats = batch.map(r => r.lat).join(',');
    const lons = batch.map(r => r.lon).join(',');
    const batchUrl = `https://api.open-meteo.com/v1/forecast?` +
      `latitude=${lats}&longitude=${lons}` +
      `&hourly=precipitation,precipitation_probability,temperature_2m,wind_speed_10m,weather_code` +
      `&current=precipitation,temperature_2m,weather_code,wind_speed_10m,precipitation_probability` +
      `&past_days=1&forecast_days=2` +
      `&timezone=Asia%2FDubai`;

    let batchData: unknown[] = [];
    try {
      const resp = await fetch(batchUrl);
      if (resp.ok) {
        const json = await resp.json();
        // Open-Meteo returns array when multiple locations, single object when one
        batchData = Array.isArray(json) ? json : [json];
      }
    } catch (e) {
      console.warn('[weatherApi] Batch fetch failed:', e);
    }

    for (let i = 0; i < batch.length; i++) {
      const r = batch[i];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d: any = batchData[i];
      if (!d || !d.current || !d.hourly) {
        allRegions.push({
          id: r.id, nameAr: r.nameAr, nameEn: r.nameEn, lat: r.lat, lon: r.lon,
          currentPrecipitation: 0, currentTemperature: 0, currentWindSpeed: 0,
          weatherCode: 0, precipitationProbability: 0,
          hourlyPrecipitation: Array(96).fill(0), hourlyTimes: genFallbackTimes(),
          hourlyProbability: Array(96).fill(0), totalLast24h: 0, maxNext48h: 0,
          floodRisk: 0, alertLevel: 'safe', lastUpdated: new Date().toISOString(),
        });
        continue;
      }
      const current = d.current;
      const hourly = d.hourly;
      const currentIdx = hourly.time.findIndex((t: string) => t === nowStr);
      const idx = currentIdx >= 0 ? currentIdx : Math.floor(hourly.time.length / 2);
      const past24h = hourly.precipitation.slice(0, idx);
      const total24h = past24h.reduce((s: number, v: number) => s + (v || 0), 0);
      const next48h = hourly.precipitation.slice(idx, idx + 48);
      const maxNext48h = Math.max(0, ...next48h.map((v: number) => v || 0));
      const currentProb = current.precipitation_probability || hourly.precipitation_probability[idx] || 0;
      const floodRisk = computeFloodRisk(current.precipitation || 0, total24h, maxNext48h, currentProb);
      allRegions.push({
        id: r.id, nameAr: r.nameAr, nameEn: r.nameEn, lat: r.lat, lon: r.lon,
        currentPrecipitation: Math.round((current.precipitation || 0) * 10) / 10,
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
      });
    }
    // Small delay between batches to respect rate limits
    if (batchStart + BATCH_SIZE < REGIONS.length) {
      await new Promise(res => setTimeout(res, 300));
    }
  }

  const regions = allRegions;

  _cache = {
    regions,
    fetchedAt: new Date().toISOString(),
    source: 'Open-Meteo Forecast API (WMO standard)',
  };
  _cacheTime = now;

  return _cache;
}

/**
 * Force refresh cache
 */
export function invalidateWeatherCache() {
  _cache = null;
  _cacheTime = 0;
}

/**
 * Get WMO weather description in Arabic
 */
export function getWeatherDescription(code: number) {
  return WMO_DESCRIPTIONS[code] || { ar: 'Unknown', en: 'Unknown', icon: '❓' };
}
