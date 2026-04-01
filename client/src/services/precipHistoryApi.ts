/**
 * precipHistoryApi.ts — Client-side precipitation history fetcher
 *
 * Replaces the tRPC server-side getPrecipHistory procedure.
 * Render free tier blocks outbound HTTP from server, so we fetch directly
 * from the browser — Open-Meteo supports CORS (access-control-allow-origin: *).
 *
 * Supports modes: '24h' | '7d' | '30d' | '90d' | '16d_forecast'
 */

export interface PrecipPoint {
  time: string;
  precipitation: number;
  probability: number;
  isHistory: boolean;
  temperatureC?: number;
  windSpeed?: number;
  humidity?: number;
}

export interface PrecipHistoryResult {
  success: boolean;
  points: PrecipPoint[];
  mode: string;
  error?: string;
}

// Cache to avoid repeated requests
const _cache = new Map<string, { data: PrecipHistoryResult; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch precipitation history + forecast for a single location.
 * Mirrors the server-side getPrecipHistory tRPC procedure.
 */
export async function fetchPrecipHistory(
  lat: number,
  lon: number,
  mode: '24h' | '7d' | '30d' | '90d' | '16d_forecast'
): Promise<PrecipHistoryResult> {
  const cacheKey = `${lat},${lon},${mode}`;
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Dubai timezone = UTC+4
    const now = new Date();
    const dubaiOffsetMs = 4 * 60 * 60 * 1000;
    const dubaiNow = new Date(now.getTime() + dubaiOffsetMs);
    const todayStr = dubaiNow.toISOString().split('T')[0];
    const nowHour = dubaiNow.toISOString().slice(0, 13);

    let points: PrecipPoint[] = [];

    if (mode === '24h') {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&hourly=precipitation,precipitation_probability,temperature_2m,wind_speed_10m,relative_humidity_2m` +
        `&past_days=1&forecast_days=2&timezone=Asia%2FDubai`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
      const data = await res.json() as { hourly: { time: string[]; precipitation: number[]; precipitation_probability: number[]; temperature_2m: number[]; wind_speed_10m: number[]; relative_humidity_2m: number[] } };
      for (let i = 0; i < data.hourly.time.length; i++) {
        points.push({
          time: data.hourly.time[i],
          precipitation: data.hourly.precipitation[i] ?? 0,
          probability: data.hourly.precipitation_probability[i] ?? 0,
          isHistory: data.hourly.time[i] < nowHour,
          temperatureC: data.hourly.temperature_2m[i] ?? 0,
          windSpeed: data.hourly.wind_speed_10m[i] ?? 0,
          humidity: data.hourly.relative_humidity_2m[i] ?? 0,
        });
      }

    } else if (mode === '7d') {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&hourly=precipitation,precipitation_probability,temperature_2m,wind_speed_10m,relative_humidity_2m` +
        `&past_days=7&forecast_days=3&timezone=Asia%2FDubai`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
      const data = await res.json() as { hourly: { time: string[]; precipitation: number[]; precipitation_probability: number[]; temperature_2m: number[]; wind_speed_10m: number[]; relative_humidity_2m: number[] } };
      for (let i = 0; i < data.hourly.time.length; i++) {
        points.push({
          time: data.hourly.time[i],
          precipitation: data.hourly.precipitation[i] ?? 0,
          probability: data.hourly.precipitation_probability[i] ?? 0,
          isHistory: data.hourly.time[i] < nowHour,
          temperatureC: data.hourly.temperature_2m[i] ?? 0,
          windSpeed: data.hourly.wind_speed_10m[i] ?? 0,
          humidity: data.hourly.relative_humidity_2m[i] ?? 0,
        });
      }

    } else if (mode === '16d_forecast') {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&hourly=precipitation,precipitation_probability,temperature_2m,wind_speed_10m,relative_humidity_2m` +
        `&past_days=1&forecast_days=16&timezone=Asia%2FDubai`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
      const data = await res.json() as { hourly: { time: string[]; precipitation: number[]; precipitation_probability: number[]; temperature_2m: number[]; wind_speed_10m: number[]; relative_humidity_2m: number[] } };
      for (let i = 0; i < data.hourly.time.length; i++) {
        points.push({
          time: data.hourly.time[i],
          precipitation: data.hourly.precipitation[i] ?? 0,
          probability: data.hourly.precipitation_probability[i] ?? 0,
          isHistory: data.hourly.time[i] < nowHour,
          temperatureC: data.hourly.temperature_2m[i] ?? 0,
          windSpeed: data.hourly.wind_speed_10m[i] ?? 0,
          humidity: data.hourly.relative_humidity_2m[i] ?? 0,
        });
      }

    } else {
      // 30d or 90d: use ERA5 archive + short forecast
      const days = mode === '30d' ? 30 : 90;
      const startDate = new Date(dubaiNow.getTime() - days * 24 * 60 * 60 * 1000);
      const startStr = startDate.toISOString().split('T')[0];

      // Archive API (historical only)
      const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
        `&start_date=${startStr}&end_date=${todayStr}` +
        `&hourly=precipitation&timezone=Asia%2FDubai`;
      const archiveRes = await fetch(archiveUrl);
      if (!archiveRes.ok) throw new Error(`Open-Meteo archive error: ${archiveRes.status}`);
      const archiveData = await archiveRes.json() as { hourly: { time: string[]; precipitation: number[] } };

      // Forecast for next 3 days
      const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&hourly=precipitation,precipitation_probability&forecast_days=3&timezone=Asia%2FDubai`;
      const forecastRes = await fetch(forecastUrl);
      if (!forecastRes.ok) throw new Error(`Open-Meteo forecast error: ${forecastRes.status}`);
      const forecastData = await forecastRes.json() as { hourly: { time: string[]; precipitation: number[]; precipitation_probability: number[] } };

      for (let i = 0; i < archiveData.hourly.time.length; i++) {
        points.push({
          time: archiveData.hourly.time[i],
          precipitation: archiveData.hourly.precipitation[i] ?? 0,
          probability: 0,
          isHistory: true,
        });
      }
      for (let i = 0; i < forecastData.hourly.time.length; i++) {
        if (forecastData.hourly.time[i] > nowHour) {
          points.push({
            time: forecastData.hourly.time[i],
            precipitation: forecastData.hourly.precipitation[i] ?? 0,
            probability: forecastData.hourly.precipitation_probability[i] ?? 0,
            isHistory: false,
          });
        }
      }

      // Aggregate to daily for long periods
      const dailyMap = new Map<string, { precip: number; maxProb: number; isHistory: boolean }>();
      for (const p of points) {
        const day = p.time.split('T')[0];
        const existing = dailyMap.get(day);
        if (existing) {
          existing.precip += p.precipitation;
          existing.maxProb = Math.max(existing.maxProb, p.probability);
          if (!p.isHistory) existing.isHistory = false;
        } else {
          dailyMap.set(day, { precip: p.precipitation, maxProb: p.probability, isHistory: p.isHistory });
        }
      }
      points = Array.from(dailyMap.entries()).map(([day, v]) => ({
        time: day,
        precipitation: Math.round(v.precip * 10) / 10,
        probability: v.maxProb,
        isHistory: v.isHistory,
      }));
    }

    const result: PrecipHistoryResult = { success: true, points, mode };
    _cache.set(cacheKey, { data: result, ts: Date.now() });
    return result;

  } catch (err) {
    console.error('[precipHistoryApi] Error:', err);
    return { success: false, points: [], mode, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * React hook for precipitation history — replaces tRPC useQuery
 */
import { useState, useEffect } from 'react';

export function usePrecipHistory(
  lat: number,
  lon: number,
  mode: '24h' | '7d' | '30d' | '90d' | '16d_forecast'
) {
  const [data, setData] = useState<PrecipHistoryResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchPrecipHistory(lat, lon, mode)
      .then(result => {
        if (cancelled) return;
        setData(result);
        if (!result.success) setError(result.error ?? 'Failed to fetch');
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [lat, lon, mode]);

  return { data, isLoading, error };
}
