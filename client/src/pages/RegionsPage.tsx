// RegionsPage.tsx — FloodSat AI Abu Dhabi
// LIVE DATA: Real weather data per region from Open-Meteo API
// Design: Techno-Geospatial Command Center

import { useRealWeather } from '@/hooks/useRealWeather';
import { getWeatherDescription } from '@/services/weatherApi';
import { alertLevelConfig } from '@/data/mockData';
import { MapPin, Droplets, Thermometer, Wind, RefreshCw, Clock, TrendingUp, Wifi, FileDown } from 'lucide-react';

// Static region metadata (population, area) not available from weather API
const regionMeta: Record<string, { population: number; area: number }> = {
  'abudhabi-city': { population: 1450000, area: 972 },
  'al-ain':        { population: 766000,  area: 1560 },
  'khalifa-city':  { population: 120000,  area: 85 },
  'shahama':       { population: 45000,   area: 120 },
  'ruwais':        { population: 18000,   area: 350 },
  'dhafra':        { population: 95000,   area: 55000 },
  'wathba':        { population: 30000,   area: 200 },
  'liwa':          { population: 12000,   area: 8000 },
};

export default function RegionsPage() {
  const { data, loading, refresh, lastUpdated, isLive } = useRealWeather();

  const sorted = data
    ? [...data.regions].sort((a, b) => b.floodRisk - a.floodRisk)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Regions & Governorates</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Water accumulation status across all Abu Dhabi Emirate regions — Real data
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isLive && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981' }}>
              <Wifi size={10} />
              <span>Real data</span>
            </div>
          )}
          <button onClick={refresh} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
            style={{ background: 'var(--cyan-dim)', color: 'var(--cyan)', border: '1px solid var(--border-active)' }}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Update
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
            style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.30)', color: '#A78BFA' }}
          >
            <FileDown size={12} />
            Export PDF
          </button>
        </div>
      </div>

      {/* Live source banner */}
      {isLive && lastUpdated && (
        <div className="flex items-center gap-2 px-3 py-2 rounded text-xs"
          style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)' }}>
          <Clock size={11} style={{ color: 'var(--cyan)' }} />
          <span style={{ color: 'var(--cyan)' }}>Source:</span>
          <span style={{ color: 'var(--text-secondary)' }}>Open-Meteo Forecast API — Last Update: {lastUpdated.toLocaleTimeString('ar-AE', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="card-dark p-8 text-center">
          <RefreshCw size={28} className="animate-spin mx-auto mb-3" style={{ color: 'var(--cyan)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Fetching real data...</p>
        </div>
      )}

      {/* Summary bar */}
      {data && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Critical', count: data.regions.filter(r => r.alertLevel === 'critical').length, color: '#EF4444' },
            { label: 'Warning', count: data.regions.filter(r => r.alertLevel === 'warning').length, color: '#F59E0B' },
            { label: 'Monitoring', count: data.regions.filter(r => r.alertLevel === 'watch').length, color: '#3B82F6' },
            { label: 'Safe', count: data.regions.filter(r => r.alertLevel === 'safe').length, color: '#10B981' },
          ].map(item => (
            <div key={item.label} className="card-dark p-3 text-center">
              <div className="font-data text-2xl font-bold" style={{ color: item.color }}>{item.count}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Region cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map(region => {
            const cfg = alertLevelConfig[region.alertLevel];
            const wmo = getWeatherDescription(region.weatherCode);
            const meta = regionMeta[region.id] || { population: 0, area: 0 };

            return (
              <div key={region.id} className="card-dark p-4 flex flex-col gap-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                      style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }} />
                    <div>
                      <div className="font-medium text-sm">{region.nameAr}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{region.nameEn}</div>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded font-bold flex-shrink-0"
                    style={{ background: cfg.bgColor, color: cfg.color, border: `1px solid ${cfg.color}44` }}>
                    {cfg.label}
                  </span>
                </div>

                {/* Weather condition */}
                <div className="flex items-center gap-2 px-2 py-1.5 rounded"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <span className="text-lg">{wmo.icon}</span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{wmo.ar}</span>
                </div>

                {/* Risk bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Index Risk</span>
                    <span className="font-data text-sm font-bold" style={{ color: cfg.color }}>{region.floodRisk}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-2 rounded-full transition-all duration-700"
                      style={{ width: `${region.floodRisk}%`, background: cfg.color, boxShadow: `0 0 8px ${cfg.color}66` }} />
                  </div>
                </div>

                {/* Real weather stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded" style={{ background: 'rgba(0,212,255,0.06)' }}>
                    <div className="flex items-center gap-1 mb-0.5">
                      <Droplets size={10} style={{ color: 'var(--cyan)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Current Rainfall</span>
                    </div>
                    <div className="font-data font-bold text-sm" style={{ color: 'var(--cyan)' }}>
                      {region.currentPrecipitation} mm
                    </div>
                  </div>
                  <div className="p-2 rounded" style={{ background: 'rgba(245,158,11,0.06)' }}>
                    <div className="flex items-center gap-1 mb-0.5">
                      <TrendingUp size={10} style={{ color: 'var(--amber)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Sum 24 hour</span>
                    </div>
                    <div className="font-data font-bold text-sm" style={{ color: 'var(--amber)' }}>
                      {region.totalLast24h} mm
                    </div>
                  </div>
                  <div className="p-2 rounded" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center gap-1 mb-0.5">
                      <Thermometer size={10} style={{ color: 'var(--text-muted)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Temperature</span>
                    </div>
                    <div className="font-data font-bold text-sm">{region.currentTemperature}°C</div>
                  </div>
                  <div className="p-2 rounded" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center gap-1 mb-0.5">
                      <Wind size={10} style={{ color: 'var(--text-muted)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Wind</span>
                    </div>
                    <div className="font-data font-bold text-sm">{region.currentWindSpeed} km/hr</div>
                  </div>
                </div>

                {/* Rainfall Probability */}
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--text-muted)' }}>Rainfall Probability:</span>
                  <span className="font-data font-bold" style={{ color: region.precipitationProbability > 50 ? 'var(--amber)' : '#10B981' }}>
                    {region.precipitationProbability}%
                  </span>
                </div>

                {/* Population & area */}
                <div className="pt-2 border-t flex items-center justify-between text-xs"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1">
                    <MapPin size={9} />
                    {meta.area.toLocaleString()} km²
                  </span>
                  <span>{meta.population.toLocaleString()} point</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
