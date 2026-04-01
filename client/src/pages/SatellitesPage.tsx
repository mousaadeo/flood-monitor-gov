// SatellitesPage — FloodSat AI Abu Dhabi
// Satellite constellation status, pass schedules, and data quality metrics

import { useState } from 'react';
import { satellitePasses } from '@/data/mockData';
import { Satellite, Clock, Zap, CheckCircle, Circle, AlertCircle, FileDown, Settings, Key } from 'lucide-react';
import InfoTooltip, { TOOLTIPS } from '@/components/InfoTooltip';
import SatelliteSettingsModal from '@/components/SatelliteSettingsModal';
import SatelliteImageViewer from '@/components/SatelliteImageViewer';
import { useLanguage } from '@/contexts/LanguageContext';

const typeColors: Record<string, string> = {
  SAR: 'var(--cyan)',
  MSI: '#10B981',
  Thermal: '#F59E0B',
  Rainfall: '#A855F7',
};

const typeDesc: Record<string, string> = {
  SAR: 'Synthetic Aperture Radar — penetrates clouds, works day and night',
  MSI: 'Multi-spectral optical imaging — high visual accuracy',
  Thermal: 'Thermal monitoring — monitors surface temperature values',
  Rainfall: 'Rainfall measurement — data every 30 minutes',
};

function AccuracyRing({ value, color }: { value: number; color: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
      <text x="36" y="40" textAnchor="middle" fill={color}
        style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', fontWeight: 'bold' }}>
        {value}%
      </text>
    </svg>
  );
}

export default function SatellitesPage() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<{ name: string; bbox: [number,number,number,number] }>({
    name: 'Abu Dhabi Emirate',
    bbox: [51.5, 22.5, 56.5, 24.5]
  });

  return (
    <div className="space-y-6">
      <SatelliteSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        lang={lang}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
            {isAr ? 'الأقمار الصناعية' : 'Satellites'}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {isAr ? 'حالة الأقمار الصناعية وجلب الصور الرادارية' : 'Satellite constellation status, SAR imagery & data quality'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded text-xs font-semibold flex-shrink-0"
            style={{ background: 'rgba(0,212,255,0.10)', color: 'var(--cyan)', border: '1px solid rgba(0,212,255,0.30)' }}
          >
            <Key size={12} />
            {isAr ? 'ربط الاشتراك' : 'Connect Subscription'}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 rounded text-xs font-semibold flex-shrink-0"
            style={{ background: 'rgba(139,92,246,0.10)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.30)' }}
          >
            <FileDown size={12} />
            {isAr ? 'تصدير PDF' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Satellite Image Viewer — Real SAR/Optical Imagery */}
      <div className="card-dark p-4">
        <SatelliteImageViewer
          regionName={selectedRegion.name}
          bbox={selectedRegion.bbox}
          onOpenSettings={() => setSettingsOpen(true)}
          lang={lang}
        />
      </div>

      {/* Region Quick Select */}
      <div className="flex flex-wrap gap-2">
        {[
          { name: 'Abu Dhabi Emirate', bbox: [51.5, 22.5, 56.5, 24.5] as [number,number,number,number] },
          { name: 'Al Dhahir', bbox: [55.5, 23.2, 56.2, 23.8] as [number,number,number,number] },
          { name: 'Al Ain City', bbox: [55.6, 24.0, 55.9, 24.3] as [number,number,number,number] },
          { name: 'Al Shamkha', bbox: [54.3, 24.2, 54.6, 24.4] as [number,number,number,number] },
          { name: 'Al Wathba', bbox: [54.5, 24.1, 54.8, 24.3] as [number,number,number,number] },
        ].map(r => (
          <button
            key={r.name}
            onClick={() => setSelectedRegion(r)}
            className="px-3 py-1.5 rounded text-xs transition-colors"
            style={{
              background: selectedRegion.name === r.name ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.05)',
              color: selectedRegion.name === r.name ? 'var(--cyan)' : 'var(--text-muted)',
              border: `1px solid ${selectedRegion.name === r.name ? 'rgba(0,212,255,0.3)' : 'var(--border-color)'}`,
            }}
          >
            {r.name}
          </button>
        ))}
      </div>

      {/* Hero image */}
      <div className="relative rounded overflow-hidden" style={{ height: '180px' }}>
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663384867006/UpUV4ACjBMFtNVM49QL7JW/satellite-constellation-PFEmcLpx9oCHiyMcRSsREX.webp"
          alt="Satellite Constellation"
          className="w-full h-full object-cover opacity-70"
        />
        <div className="absolute inset-0 flex items-center px-8"
          style={{ background: 'linear-gradient(90deg, rgba(6,13,26,0.9) 40%, transparent)' }}>
          <div>
            <h2 className="text-lg font-bold glow-text-cyan" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Satellite System
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              6 active satellites • covering 98.7% of Abu Dhabi Emirate
            </p>
            <div className="flex gap-4 mt-2">
              {Object.entries(typeColors).map(([type, color]) => (
                <span key={type} className="flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{type}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Satellite cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {satellitePasses.map(sat => {
          const color = typeColors[sat.type];
          const statusIcon = sat.status === 'active'
            ? <CheckCircle size={14} style={{ color: '#10B981' }} />
            : sat.status === 'scheduled'
            ? <Clock size={14} style={{ color: 'var(--amber)' }} />
            : <Circle size={14} style={{ color: 'var(--text-muted)' }} />;
          const statusLabel = sat.status === 'active' ? 'Active' : sat.status === 'scheduled' ? 'Scheduled' : 'Completed';
          const statusColor = sat.status === 'active' ? '#10B981' : sat.status === 'scheduled' ? 'var(--amber)' : 'var(--text-muted)';

          return (
            <div key={sat.id} className="card-dark p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Satellite size={16} style={{ color }} />
                    <span className="font-bold text-sm" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>{sat.satellite}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded mt-1 inline-block"
                    style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
                    {sat.type}
                  </span>
                </div>
                <AccuracyRing value={sat.accuracy} color={color} />
              </div>

              {/* Type description */}
              <p className="text-xs mb-4 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {typeDesc[sat.type]}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-2 rounded" style={{ background: 'rgba(27,79,138,0.05)', border: '1px solid var(--border-color)' }}>
                  <div className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <InfoTooltip content={{ title: 'Satellite Pass Time', description: 'Local time when the satellite passes over Abu Dhabi Emirate and captures new images. Each pass produces updated images for the region.', source: 'Satellite orbit schedule', updateFreq: 'All Traffic', color: 'var(--cyan)' }} />
                    Time Traffic
                  </div>
                  <div className="font-data text-sm font-bold mt-0.5" style={{ color: 'var(--cyan)' }}>{sat.passTime}</div>
                </div>
                <div className="p-2 rounded" style={{ background: 'rgba(27,79,138,0.05)', border: '1px solid var(--border-color)' }}>
                  <div className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <InfoTooltip content={TOOLTIPS.sarResolution} />
                    Spatial Accuracy
                  </div>
                  <div className="font-data text-sm font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{sat.resolution}</div>
                </div>
                <div className="p-2 rounded" style={{ background: 'rgba(27,79,138,0.05)', border: '1px solid var(--border-color)' }}>
                  <div className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <InfoTooltip content={TOOLTIPS.responseTime} />
                    Data Age
                  </div>
                  <div className="font-data text-sm font-bold mt-0.5" style={{ color: 'var(--amber)' }}>{sat.dataLatency}</div>
                </div>
                <div className="p-2 rounded" style={{ background: 'rgba(27,79,138,0.05)', border: '1px solid var(--border-color)' }}>
                  <div className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <InfoTooltip content={{ title: 'Coverage Percentage', description: 'Percentage of Abu Dhabi Emirate area (67,340 km²) covered by this satellite in all traffic. 100% means full emirate coverage.', source: 'Satellite specifications', normalRange: '80% — 100%', color: '#10B981' }} />
                    coverage
                  </div>
                  <div className="font-data text-sm font-bold mt-0.5" style={{ color: '#10B981' }}>{sat.coverage}%</div>
                </div>
              </div>

              {/* Coverage bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: 'var(--text-muted)' }}>Abu Dhabi coverage</span>
                  <span className="font-data" style={{ color }}>{sat.coverage}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${sat.coverage}%`, background: color }} />
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                {statusIcon}
                <span className="text-xs font-medium" style={{ color: statusColor }}>{statusLabel}</span>
                <span className="text-xs mr-auto flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <InfoTooltip content={{ ...TOOLTIPS.f1Score, title: 'Detection Accuracy', description: 'Accuracy percentage of this satellite in classifying flood zones correctly compared to ground data. Accuracy includes identifying water extent and depth.', color }} />
                  Accuracy: <span className="font-data font-bold" style={{ color }}>{sat.accuracy}%</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparison table */}
      <div className="card-dark p-4">
        <h2 className="text-sm font-bold mb-4">Comparison Performance Satellites</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['Satellite', 'Type', 'response time', 'Spatial Accuracy', 'Efficiency', 'weather status', 'accuracy'].map(h => (
                  <th key={h} className="py-2 px-3 text-right font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {satellitePasses.map(sat => {
                const color = typeColors[sat.type];
                return (
                  <tr key={sat.id} className="border-b transition-colors hover:bg-white/5"
                    style={{ borderColor: 'var(--border-color)' }}>
                    <td className="py-2.5 px-3 font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'Playfair Display, Georgia, serif' }}>{sat.satellite}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-xs" style={{ background: `${color}22`, color }}>{sat.type}</span>
                    </td>
                    <td className="py-2.5 px-3 font-data" style={{ color: 'var(--amber)' }}>{sat.dataLatency}</td>
                    <td className="py-2.5 px-3 font-data" style={{ color: 'var(--cyan)' }}>{sat.resolution}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="progress-bar flex-1" style={{ minWidth: '60px' }}>
                          <div className="progress-fill" style={{ width: `${sat.coverage}%`, background: color }} />
                        </div>
                        <span className="font-data" style={{ color }}>{sat.coverage}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span style={{ color: sat.type === 'SAR' ? '#10B981' : sat.type === 'Rainfall' ? '#10B981' : 'var(--amber)' }}>
                        {sat.type === 'SAR' || sat.type === 'Rainfall' ? 'Independent' : 'Affected by clouds'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-data font-bold" style={{ color }}>{sat.accuracy}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
