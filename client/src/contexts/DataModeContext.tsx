/**
 * DataModeContext.tsx
 * Manages LIVE vs ARCHIVE data mode across the entire platform.
 *
 * LIVE:    Fetches real-time data from Open-Meteo (auto-refresh every 2 min)
 * ARCHIVE: Fetches historical data from Open-Meteo ERA5 reanalysis for a chosen date/time
 *
 * Open-Meteo historical API: https://archive-api.open-meteo.com/v1/archive
 * Supports dates from 1940 to ~5 days ago (ERA5 reanalysis)
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DataMode = 'live' | 'archive';

export interface RegionSnapshot {
  id: string;
  nameAr: string;
  nameEn: string;
  lat: number;
  lon: number;
  currentPrecipitation: number;   // mm/h at selected time
  currentTemperature: number;     // °C
  currentWindSpeed: number;       // km/h
  precipitationProbability: number; // % (live only; archive = 0)
  totalLast24h: number;           // mm sum of 24h before selected time
  maxNext48h: number;             // mm max in next 48h (live only)
  weatherCode: number;             // WMO code (0 for archive)
  floodRisk: number;              // 0-100 computed
  alertLevel: 'safe' | 'watch' | 'warning' | 'critical';
  hourlyTimes: string[];
  hourlyPrecipitation: number[];
  hourlyProbability: number[];
  lastUpdated: string;
}

export interface DataSnapshot {
  mode: DataMode;
  archiveDate?: string;           // ISO date string e.g. "2026-03-23"
  archiveHour?: number;           // 0-23
  regions: RegionSnapshot[];
  fetchedAt: string;
  source: string;
  isLoading: boolean;
  error: string | null;
}

interface DataModeContextValue {
  snapshot: DataSnapshot;
  mode: DataMode;
  archiveDate: string;
  archiveHour: number;
  setMode: (m: DataMode) => void;
  setArchiveDate: (d: string) => void;
  setArchiveHour: (h: number) => void;
  refresh: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REGIONS = [
  { id: 'abudhabi-city', nameAr: 'City Abu Dhabi',      nameEn: 'Abu Dhabi City',  lat: 24.4539, lon: 54.3773 },
  { id: 'al-ain',        nameAr: 'City Al Ain',         nameEn: 'Al Ain City',     lat: 24.2075, lon: 55.7447 },
  { id: 'khalifa-city',  nameAr: 'Khalifa City',         nameEn: 'Khalifa City',    lat: 24.4333, lon: 54.6167 },
  { id: 'shahama',       nameAr: 'Al Shahama',             nameEn: 'Al Shahama',      lat: 24.5667, lon: 54.6167 },
  { id: 'ruwais',        nameAr: 'Al Ruwais',              nameEn: 'Al Ruwais',       lat: 24.1167, lon: 52.7333 },
  { id: 'dhafra',        nameAr: 'Region Al Dhafra',        nameEn: 'Al Dhafra',       lat: 23.5000, lon: 53.5000 },
  { id: 'wathba',        nameAr: 'Al Wathba Region',        nameEn: 'Al Wathba',       lat: 24.3167, lon: 54.6167 },
  { id: 'liwa',          nameAr: 'Liwa Region',          nameEn: 'Liwa',            lat: 23.1167, lon: 53.7667 },
];

const LIVE_REFRESH_MS = 2 * 60 * 1000; // 2 minutes

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeFloodRisk(currentPrecip: number, total24h: number, maxNext48h: number, prob: number): number {
  const currentScore  = Math.min(currentPrecip * 15, 40);
  const accumScore    = Math.min(total24h * 1.5, 30);
  const forecastScore = Math.min(maxNext48h * 2, 20);
  const probScore     = (prob / 100) * 10;
  return Math.min(Math.round(currentScore + accumScore + forecastScore + probScore), 100);
}

function getAlertLevel(risk: number): RegionSnapshot['alertLevel'] {
  if (risk >= 70) return 'critical';
  if (risk >= 45) return 'warning';
  if (risk >= 20) return 'watch';
  return 'safe';
}

/** Fetch LIVE data from Open-Meteo forecast API */
async function fetchLiveRegion(r: typeof REGIONS[0]): Promise<RegionSnapshot> {
  const url = `https://api.open-meteo.com/v1/forecast?` +
    `latitude=${r.lat}&longitude=${r.lon}` +
    `&hourly=precipitation,precipitation_probability,temperature_2m,wind_speed_10m` +
    `&current=precipitation,temperature_2m,weather_code,wind_speed_10m,precipitation_probability` +
    `&past_days=1&forecast_days=2&timezone=Asia%2FDubai`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const d = await res.json();

  // Use Dubai timezone (UTC+4) via direct UTC arithmetic — avoids browser Intl inconsistencies
  const _now = new Date();
  const _dubaiOffsetMs = 4 * 60 * 60 * 1000; // UTC+4
  const _dubaiNow = new Date(_now.getTime() + _dubaiOffsetMs);
  const nowStr = `${_dubaiNow.getUTCFullYear()}-${String(_dubaiNow.getUTCMonth()+1).padStart(2,'0')}-${String(_dubaiNow.getUTCDate()).padStart(2,'0')}T${String(_dubaiNow.getUTCHours()).padStart(2,'0')}:00`;
  const idx = d.hourly.time.findIndex((t: string) => t === nowStr);
  const ci = idx >= 0 ? idx : 24;

  const past24 = (d.hourly.precipitation as number[]).slice(Math.max(0, ci - 24), ci);
  const total24h = past24.reduce((s, v) => s + (v || 0), 0);
  const next48 = (d.hourly.precipitation as number[]).slice(ci, ci + 48);
  const maxNext48h = next48.length ? Math.max(...next48.map(v => v || 0)) : 0;
  const prob = d.current.precipitation_probability ?? d.hourly.precipitation_probability[ci] ?? 0;
  const floodRisk = computeFloodRisk(d.current.precipitation || 0, total24h, maxNext48h, prob);

  return {
    id: r.id, nameAr: r.nameAr, nameEn: r.nameEn, lat: r.lat, lon: r.lon,
    currentPrecipitation: Math.round((d.current.precipitation || 0) * 10) / 10,
    currentTemperature:   Math.round((d.current.temperature_2m || 0) * 10) / 10,
    currentWindSpeed:     Math.round((d.current.wind_speed_10m || 0) * 10) / 10,
    precipitationProbability: prob,
    totalLast24h:  Math.round(total24h * 10) / 10,
    maxNext48h:    Math.round(maxNext48h * 10) / 10,
    weatherCode: d.current.weather_code || 0,
    floodRisk, alertLevel: getAlertLevel(floodRisk),
    hourlyTimes:        d.hourly.time,
    hourlyPrecipitation: d.hourly.precipitation,
    hourlyProbability:   d.hourly.precipitation_probability,
    lastUpdated: new Date().toISOString(),
  };
}

/** Fetch ARCHIVEE data from Open-Meteo ERA5 historical API */
async function fetchArchiveRegion(
  r: typeof REGIONS[0],
  date: string,   // "YYYY-MM-DD"
  hour: number,   // 0-23
): Promise<RegionSnapshot> {
  // ERA5 archive: need start_date = day-1, end_date = day+1 to get 24h window
  const d0 = new Date(date + 'T00:00:00Z');
  const d1 = new Date(d0.getTime() - 24 * 3600_000);
  const d2 = new Date(d0.getTime() + 24 * 3600_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const url = `https://archive-api.open-meteo.com/v1/archive?` +
    `latitude=${r.lat}&longitude=${r.lon}` +
    `&hourly=precipitation,temperature_2m,wind_speed_10m` +
    `&start_date=${fmt(d1)}&end_date=${fmt(d2)}` +
    `&timezone=Asia%2FDubai`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo Archive ${res.status}`);
  const data = await res.json();

  const times: string[] = data.hourly.time;
  const precip: number[] = data.hourly.precipitation;
  const temp: number[] = data.hourly.temperature_2m;
  const wind: number[] = data.hourly.wind_speed_10m;

  // Find the target hour index
  const targetStr = `${date}T${String(hour).padStart(2, '0')}:00`;
  const ti = times.findIndex(t => t === targetStr);
  const ci = ti >= 0 ? ti : Math.floor(times.length / 2);

  const currentPrecip = precip[ci] || 0;
  const past24 = precip.slice(Math.max(0, ci - 24), ci);
  const total24h = past24.reduce((s, v) => s + (v || 0), 0);
  const next48 = precip.slice(ci, ci + 48);
  const maxNext48h = next48.length ? Math.max(...next48.map(v => v || 0)) : 0;
  const floodRisk = computeFloodRisk(currentPrecip, total24h, maxNext48h, 0);

  return {
    id: r.id, nameAr: r.nameAr, nameEn: r.nameEn, lat: r.lat, lon: r.lon,
    currentPrecipitation: Math.round(currentPrecip * 10) / 10,
    currentTemperature:   Math.round((temp[ci] || 0) * 10) / 10,
    currentWindSpeed:     Math.round((wind[ci] || 0) * 10) / 10,
    precipitationProbability: 0,
    totalLast24h:  Math.round(total24h * 10) / 10,
    maxNext48h:    Math.round(maxNext48h * 10) / 10,
    weatherCode: 0,
    floodRisk,
    alertLevel:    getAlertLevel(floodRisk),
    hourlyTimes:        times,
    hourlyPrecipitation: precip,
    hourlyProbability:   Array(times.length).fill(0),
    lastUpdated: new Date().toISOString(),
  };
}

function fallbackRegion(r: typeof REGIONS[0]): RegionSnapshot {
  return {
    id: r.id, nameAr: r.nameAr, nameEn: r.nameEn, lat: r.lat, lon: r.lon,
    currentPrecipitation: 0, currentTemperature: 0, currentWindSpeed: 0,
    precipitationProbability: 0, totalLast24h: 0, maxNext48h: 0,
    weatherCode: 0,
    floodRisk: 0, alertLevel: 'safe',
    hourlyTimes: [], hourlyPrecipitation: [], hourlyProbability: [],
    lastUpdated: new Date().toISOString(),
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

const DataModeContext = createContext<DataModeContextValue | null>(null);

export function DataModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DataMode>('live');
  const [archiveDate, setArchiveDateState] = useState('2026-03-23');
  const [archiveHour, setArchiveHourState] = useState(8);
  const [snapshot, setSnapshot] = useState<DataSnapshot>({
    mode: 'live', regions: [], fetchedAt: '', source: '', isLoading: true, error: null,
  });
  const refreshRef = useRef(0);

  const doFetch = useCallback(async (
    currentMode: DataMode,
    currentDate: string,
    currentHour: number,
    token: number,
  ) => {
    setSnapshot(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      let regions: RegionSnapshot[];
      let source: string;

      if (currentMode === 'live') {
        const results = await Promise.allSettled(REGIONS.map(r => fetchLiveRegion(r)));
        regions = results.map((res, i) => res.status === 'fulfilled' ? res.value : fallbackRegion(REGIONS[i]));
        source = 'Open-Meteo Forecast API — District Data';
      } else {
        const results = await Promise.allSettled(REGIONS.map(r => fetchArchiveRegion(r, currentDate, currentHour)));
        regions = results.map((res, i) => res.status === 'fulfilled' ? res.value : fallbackRegion(REGIONS[i]));
        source = `Open-Meteo ERA5 Archive — ${currentDate} Hour ${String(currentHour).padStart(2,'0')}:00`;
      }

      // Ignore stale fetches
      if (token !== refreshRef.current) return;

      setSnapshot({
        mode: currentMode,
        archiveDate: currentMode === 'archive' ? currentDate : undefined,
        archiveHour: currentMode === 'archive' ? currentHour : undefined,
        regions,
        fetchedAt: new Date().toISOString(),
        source,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      if (token !== refreshRef.current) return;
      setSnapshot(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Error fetching data',
      }));
    }
  }, []);

  // Initial + mode/date/hour change fetch
  useEffect(() => {
    refreshRef.current += 1;
    doFetch(mode, archiveDate, archiveHour, refreshRef.current);
  }, [mode, archiveDate, archiveHour, doFetch]);

  // Auto-refresh for LIVE mode
  useEffect(() => {
    if (mode !== 'live') return;
    const id = setInterval(() => {
      refreshRef.current += 1;
      doFetch('live', archiveDate, archiveHour, refreshRef.current);
    }, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [mode, archiveDate, archiveHour, doFetch]);

  const setMode = useCallback((m: DataMode) => setModeState(m), []);
  const setArchiveDate = useCallback((d: string) => setArchiveDateState(d), []);
  const setArchiveHour = useCallback((h: number) => setArchiveHourState(h), []);
  const refresh = useCallback(() => {
    refreshRef.current += 1;
    doFetch(mode, archiveDate, archiveHour, refreshRef.current);
  }, [mode, archiveDate, archiveHour, doFetch]);

  return (
    <DataModeContext.Provider value={{ snapshot, mode, archiveDate, archiveHour, setMode, setArchiveDate, setArchiveHour, refresh }}>
      {children}
    </DataModeContext.Provider>
  );
}

export function useDataMode(): DataModeContextValue {
  const ctx = useContext(DataModeContext);
  if (!ctx) throw new Error('useDataMode must be used inside DataModeProvider');
  return ctx;
}
