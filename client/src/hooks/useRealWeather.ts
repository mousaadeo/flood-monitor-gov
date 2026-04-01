/**
 * useRealWeather.ts — React hook for real-time weather data
 *
 * ARCHITECTURE NOTE:
 * Previously used tRPC server-side procedure, but Render free tier blocks
 * outbound HTTP requests from the server to external APIs (Open-Meteo).
 * Solution: fetch directly from the browser (client-side) — Open-Meteo
 * supports CORS with `access-control-allow-origin: *`, so this works perfectly.
 *
 * Data sources:
 *   - Open-Meteo Forecast API (precipitation, temperature, wind) — client-side
 *   - Water accumulation computed client-side from ERA5 data
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllRegionsWeather, type SystemWeatherData, type RegionWeather } from '@/services/weatherApi';

// Re-export types for consumers
export type { SystemWeatherData, RegionWeather };

// Water accumulation level type
export type WaterAccumulationLevel = 'none' | 'minor' | 'moderate' | 'severe' | 'extreme';

// Accumulation summary shape
export interface AccumulationSummary {
  totalRegionsWithWater: number;
  extremeCount: number;
  severeCount: number;
  moderateCount: number;
  minorCount: number;
  maxScore: number;
  maxScoreRegionId: string;
  totalEstimatedAreaKm2: number;
  activeWadis: number;
}

// Extended SystemWeatherData with accumulation summary
export interface ExtendedSystemWeatherData extends SystemWeatherData {
  accumulationSummary: AccumulationSummary;
}

export interface AlertSummary {
  activeRegions: RegionWeather[];
  criticalCount: number;
  warningCount: number;
  watchCount: number;
  activeAlerts: number;
  highestSeverity: 'critical' | 'warning' | 'watch' | 'safe';
}

interface UseRealWeatherReturn {
  data: ExtendedSystemWeatherData | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
  isLive: boolean;
}

const DEFAULT_ACCUMULATION_SUMMARY: AccumulationSummary = {
  totalRegionsWithWater: 0,
  extremeCount: 0,
  severeCount: 0,
  moderateCount: 0,
  minorCount: 0,
  maxScore: 0,
  maxScoreRegionId: '',
  totalEstimatedAreaKm2: 0,
  activeWadis: 0,
};

const ALERT_SEVERITY_ORDER = { critical: 0, warning: 1, watch: 2, safe: 3 } as const;

export function isActiveAlertRegion(region: RegionWeather): boolean {
  return region.currentPrecipitation > 0 ||
    (region.floodRisk >= 30 && (region.currentPrecipitation > 0 || region.maxNext48h > 5));
}

export function getActiveAlertRegions(regions: RegionWeather[]): RegionWeather[] {
  return regions
    .filter(isActiveAlertRegion)
    .sort((a, b) => ALERT_SEVERITY_ORDER[a.alertLevel] - ALERT_SEVERITY_ORDER[b.alertLevel]);
}

export function computeAlertSummary(dataOrRegions: ExtendedSystemWeatherData | RegionWeather[] | null): AlertSummary {
  const regions = Array.isArray(dataOrRegions)
    ? dataOrRegions
    : (dataOrRegions?.regions ?? []);

  const activeRegions = getActiveAlertRegions(regions);
  const criticalCount = activeRegions.filter(r => r.alertLevel === 'critical').length;
  const warningCount = activeRegions.filter(r => r.alertLevel === 'warning').length;
  const watchCount = activeRegions.filter(r => r.alertLevel === 'watch').length;
  const activeAlerts = criticalCount + warningCount + watchCount;

  return {
    activeRegions,
    criticalCount,
    warningCount,
    watchCount,
    activeAlerts,
    highestSeverity: criticalCount > 0
      ? 'critical'
      : warningCount > 0
      ? 'warning'
      : watchCount > 0
      ? 'watch'
      : 'safe',
  };
}

/**
 * Compute water accumulation summary from region weather data.
 * Uses precipitation + flood risk as proxy for water accumulation.
 */
function computeAccumulationFromWeather(regions: RegionWeather[]): AccumulationSummary {
  let extremeCount = 0;
  let severeCount = 0;
  let moderateCount = 0;
  let minorCount = 0;
  let maxScore = 0;
  let maxScoreRegionId = '';
  let totalEstimatedAreaKm2 = 0;
  let activeWadis = 0;

  for (const r of regions) {
    const score = r.floodRisk;
    if (score > maxScore) {
      maxScore = score;
      maxScoreRegionId = r.id;
    }

    // Classify by flood risk score
    if (score >= 70) {
      extremeCount++;
      totalEstimatedAreaKm2 += 15;
      activeWadis++;
    } else if (score >= 50) {
      severeCount++;
      totalEstimatedAreaKm2 += 8;
      if (r.totalLast24h > 10) activeWadis++;
    } else if (score >= 30) {
      moderateCount++;
      totalEstimatedAreaKm2 += 3;
    } else if (score >= 10 || r.totalLast24h > 0.5) {
      minorCount++;
      totalEstimatedAreaKm2 += 0.5;
    }
  }

  const totalRegionsWithWater = extremeCount + severeCount + moderateCount + minorCount;

  return {
    totalRegionsWithWater,
    extremeCount,
    severeCount,
    moderateCount,
    minorCount,
    maxScore,
    maxScoreRegionId,
    totalEstimatedAreaKm2: Math.round(totalEstimatedAreaKm2 * 10) / 10,
    activeWadis,
  };
}

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useRealWeather(): UseRealWeatherReturn {
  const [data, setData] = useState<ExtendedSystemWeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isMountedRef.current) return;
      setLoading(true);
      setError(null);

      try {
        const raw = await fetchAllRegionsWeather();
        if (cancelled || !isMountedRef.current) return;

        const accumulationSummary = computeAccumulationFromWeather(raw.regions);

        setData({
          regions: raw.regions,
          fetchedAt: raw.fetchedAt,
          source: raw.source,
          accumulationSummary,
        });
        setLastUpdated(new Date());
        setError(null);
      } catch (err) {
        if (cancelled || !isMountedRef.current) return;
        console.error('[useRealWeather] Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch weather data');
      } finally {
        if (!cancelled && isMountedRef.current) {
          setLoading(false);
        }
      }
    }

    load();

    // Auto-refresh every 5 minutes
    const timer = setInterval(load, REFRESH_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refreshTick]);

  const refresh = useCallback(() => {
    setRefreshTick(t => t + 1);
  }, []);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh,
    isLive: !!data && !error,
  };
}

/**
 * computeWeatherSummary — derives KPI metrics from live weather data
 *
 * Alert counting methodology (UAE NCM / ADCD standard):
 *   - "Active Alert" = region with CURRENT precipitation > 0 mm/h OR floodRisk >= 30
 *     AND the alert is driven by CURRENT conditions (not historical 24h accumulation only)
 *   - Historical 24h data is shown as context, NOT as active alert trigger
 *
 * This prevents the common issue of 80+ "active" alerts when a storm has passed
 * but 24h accumulation is still high.
 */
export function computeWeatherSummary(data: ExtendedSystemWeatherData | null) {
  if (!data) return null;

  const { regions } = data;

  // ── Precipitation signals ──────────────────────────────────────────────────
  const maxCurrentPrecip = Math.max(...regions.map(r => r.currentPrecipitation));
  const maxTotalPrecip   = Math.max(...regions.map(r => r.totalLast24h));
  const isRainActive     = maxCurrentPrecip > 0;

  // Primary display: current rain rate if active, else 24h historical total
  const totalPrecip = isRainActive ? maxCurrentPrecip : maxTotalPrecip;

  // ── Flood risk ─────────────────────────────────────────────────────────────
  const maxRisk = Math.max(...regions.map(r => r.floodRisk));
  const avgTemp = regions.reduce((sum, r) => sum + r.currentTemperature, 0) / regions.length;
  const highestRiskRegion = regions.reduce(
    (max, r) => r.floodRisk > max.floodRisk ? r : max,
    regions[0]
  );

  // ── Alert counting — current conditions only ──────────────────────────────
  const alertSummary = computeAlertSummary(data);
  const { activeRegions, criticalCount, warningCount, watchCount, activeAlerts } = alertSummary;

  // ── Water Accumulation Summary ─────────────────────────────────────────────
  const accSummary = data.accumulationSummary ?? DEFAULT_ACCUMULATION_SUMMARY;

  const regionsWithWater = regions.filter(r =>
    (r as any).waterAccumulation?.level !== 'none' &&
    (r as any).waterAccumulation?.level !== undefined
  );

  const highestAccumulationRegion = regions.reduce((max, r) => {
    const score    = (r as any).waterAccumulation?.score ?? r.floodRisk ?? 0;
    const maxScore = (max as any).waterAccumulation?.score ?? max.floodRisk ?? 0;
    return score > maxScore ? r : max;
  }, regions[0]);

  const totalFloodedAreaKm2 = regions.reduce(
    (sum, r) => sum + ((r as any).waterAccumulation?.estimatedAreaKm2 ?? 0),
    0
  );

  const activeWadis = regions.filter(r =>
    ((r as any).waterAccumulation?.wadiDischarge ?? 0) > 0.5
  ).length;

  // ── Chart data (12h back + 36h forward for reference region) ──────────────
  const refRegion = regions.find(r => r.id === 'abudhabi-city') || regions[0];
  const _now      = new Date();
  const _dubaiNow = new Date(_now.getTime() + 4 * 60 * 60 * 1000);
  const _nowStr   = [
    _dubaiNow.getUTCFullYear(),
    String(_dubaiNow.getUTCMonth() + 1).padStart(2, '0'),
    String(_dubaiNow.getUTCDate()).padStart(2, '0'),
  ].join('-') + 'T' + String(_dubaiNow.getUTCHours()).padStart(2, '0') + ':00';

  const _currentIdx = refRegion.hourlyTimes.findIndex((t: string) => t === _nowStr);
  const _ci         = _currentIdx >= 0 ? _currentIdx : 24;
  const _startIdx   = Math.max(0, _ci - 12);
  const _endIdx     = Math.min(refRegion.hourlyTimes.length, _startIdx + 48);

  const chartData = refRegion.hourlyTimes.slice(_startIdx, _endIdx).map((time, i) => ({
    time:        time.split('T')[1] || time,
    actual:      refRegion.hourlyPrecipitation[_startIdx + i] || 0,
    probability: refRegion.hourlyProbability[_startIdx + i] || 0,
    isNow:       (_startIdx + i) === _ci,
  }));

  return {
    // Alert counts — CURRENT conditions only
    ...alertSummary,
    criticalCount,
    warningCount,
    watchCount,
    activeAlerts,

    // Precipitation
    totalPrecip:    Math.round(totalPrecip * 10) / 10,
    maxTotalPrecip: Math.round(maxTotalPrecip * 10) / 10,
    isRainActive,

    // Risk & temperature
    maxRisk,
    avgTemp:            Math.round(avgTemp * 10) / 10,
    highestRiskRegion,

    // Chart
    chartData,

    // Water accumulation
    accumulationSummary:       accSummary,
    regionsWithWater,
    highestAccumulationRegion,
    totalFloodedAreaKm2:       Math.round(totalFloodedAreaKm2 * 10) / 10,
    activeWadis,
  };
}
