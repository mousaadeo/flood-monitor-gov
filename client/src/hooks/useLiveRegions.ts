/**
 * useLiveRegions.ts
 * Merges live Open-Meteo weather data (90 regions) with static structural data
 * (abuDhabiRegions) using nearest-coordinate matching.
 *
 * Dynamic fields (from Open-Meteo):
 *   floodRisk, alertLevel, currentPrecipitation, currentTemperature,
 *   currentWindSpeed, totalLast24h, maxNext48h, precipitationProbability,
 *   waterAccumulation, hourlyPrecipitation, hourlyTimes, hourlyProbability
 *
 * Static fields (from abuDhabiRegions):
 *   areaSqKm, population, drainagePoints, drainageLoad, elevationM, type, note
 *
 * The merge uses haversine distance to find the nearest live region for each sub-area.
 */
import { useMemo } from 'react';
import { useRealWeather } from './useRealWeather';
import {
  ABU_DHABI_EMIRATE,
  type SubArea,
  type City,
} from '@/data/abuDhabiRegions';

// ── Haversine distance (km) ───────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

// ── Merged SubArea type ───────────────────────────────────────────────────────
export interface LiveSubArea extends SubArea {
  // Live fields (override static)
  floodRisk: number;
  alertLevel: 'critical' | 'warning' | 'watch' | 'safe';
  currentPrecipitation: number;
  tempC: number;
  humidity: number;
  totalLast24h: number;
  maxNext48h: number;
  precipitationProbability: number;
  currentWindSpeed: number;
  hourlyPrecipitation: number[];
  hourlyTimes: string[];
  hourlyProbability: number[];
  waterAccumulation: {
    score: number;
    level: string;
    estimatedDepthCm: number;
    estimatedAreaKm2: number;
    wadiDischarge: number | null;
    sources: string[];
    susceptibility: number;
    soilType: string;
  } | null;
  // Derived
  maxWaterDepthCm: number;
  floodAreaHa: number;
  affectedRoads: number;
  drainageLoad: number;
  liveRegionId: string;
  lastUpdated: string;
}

export interface LiveCity extends Omit<City, 'subAreas'> {
  subAreas: LiveSubArea[];
}

export interface LiveEmirateData {
  cities: LiveCity[];
  isLive: boolean;
  loading: boolean;
  lastUpdated: Date | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useLiveRegions(): LiveEmirateData {
  const { data: weatherData, loading, lastUpdated } = useRealWeather();

  const cities = useMemo<LiveCity[]>(() => {
    const liveRegions = weatherData?.regions ?? [];

    return ABU_DHABI_EMIRATE.cities.map((city) => ({
      ...city,
      subAreas: city.subAreas.map((area) => {
        // Find nearest live region by coordinates
        let nearest = liveRegions[0];
        let minDist = Infinity;
        for (const lr of liveRegions) {
          const d = haversine(area.lat, area.lng, lr.lat, lr.lon);
          if (d < minDist) {
            minDist = d;
            nearest = lr;
          }
        }

        if (!nearest) {
          // Fallback: return static data unchanged
          return {
            ...area,
            totalLast24h: area.currentPrecipitation * 24,
            maxNext48h: 0,
            precipitationProbability: 0,
            currentWindSpeed: 0,
            hourlyPrecipitation: [],
            hourlyTimes: [],
            hourlyProbability: [],
            waterAccumulation: null,
            maxWaterDepthCm: area.maxWaterDepthCm,
            floodAreaHa: area.floodAreaHa,
            affectedRoads: area.affectedRoads,
            drainageLoad: area.drainageLoad,
            liveRegionId: '',
            lastUpdated: '',
          } as LiveSubArea;
        }

        // Derive maxWaterDepthCm from waterAccumulation or floodRisk
        const wa = (nearest as any).waterAccumulation;
        const liveDepthCm = wa?.estimatedDepthCm ?? Math.round(nearest.floodRisk * 0.8);
        const liveFloodAreaHa = wa
          ? Math.round(wa.estimatedAreaKm2 * 100)
          : Math.round(area.areaSqKm * (nearest.floodRisk / 100) * 100);

        // Derive drainage load from precipitation + susceptibility
        const susceptibility = wa?.susceptibility ?? 50;
        const precipFactor = Math.min(nearest.currentPrecipitation * 20, 40);
        const liveDrainageLoad = Math.min(
          Math.round(susceptibility * 0.6 + precipFactor + nearest.floodRisk * 0.2),
          100
        );

        // Derive affected roads from flood risk + area type
        const roadFactor =
          area.type === 'industrial' ? 1.5
          : area.type === 'commercial' ? 1.2
          : area.type === 'agricultural' ? 0.4
          : 1.0;
        const liveAffectedRoads = nearest.floodRisk >= 70
          ? Math.round(area.drainagePoints * 0.4 * roadFactor)
          : nearest.floodRisk >= 50
          ? Math.round(area.drainagePoints * 0.2 * roadFactor)
          : nearest.floodRisk >= 30
          ? Math.round(area.drainagePoints * 0.05 * roadFactor)
          : 0;

        // Humidity from weather code (approximate)
        const liveHumidity = nearest.weatherCode >= 61
          ? Math.min(95, 60 + nearest.currentPrecipitation * 10)
          : nearest.weatherCode >= 51
          ? 65
          : nearest.weatherCode >= 2
          ? 55
          : 45;

        return {
          ...area,
          // Override dynamic fields with live data
          floodRisk: nearest.floodRisk,
          alertLevel: nearest.alertLevel as 'critical' | 'warning' | 'watch' | 'safe',
          currentPrecipitation: nearest.currentPrecipitation,
          tempC: nearest.currentTemperature,
          humidity: liveHumidity,
          totalLast24h: nearest.totalLast24h,
          maxNext48h: nearest.maxNext48h,
          precipitationProbability: nearest.precipitationProbability,
          currentWindSpeed: nearest.currentWindSpeed,
          hourlyPrecipitation: nearest.hourlyPrecipitation,
          hourlyTimes: nearest.hourlyTimes,
          hourlyProbability: nearest.hourlyProbability,
          waterAccumulation: wa ?? null,
          // Derived dynamic fields
          maxWaterDepthCm: liveDepthCm,
          floodAreaHa: liveFloodAreaHa,
          affectedRoads: liveAffectedRoads,
          drainageLoad: liveDrainageLoad,
          liveRegionId: nearest.id,
          lastUpdated: nearest.lastUpdated,
        } as LiveSubArea;
      }),
    }));
  }, [weatherData]);

  return {
    cities,
    isLive: !!weatherData,
    loading,
    lastUpdated,
  };
}
