/**
 * WaterVolumeSummary.tsx
 * Panel showing total water volume per region with Year / Month / Week filters
 * Integrated into the historical timeline sidebar
 */
import { useState, useMemo } from 'react';
import { FLOOD_EVENTS, HISTORICAL_REGIONS } from '@/data/historicalWater';
import { formatVolume, formatDepth, classifyByDepth, WATER_COLORS } from '@shared/waterStandard';
import { BarChart2, X, Calendar, ChevronDown, ChevronUp, Droplets } from 'lucide-react';

type FilterMode = 'year' | 'month' | 'week';

interface WaterVolumeSummaryProps {
  onClose: () => void;
  lang: 'ar' | 'en';
  currentYear: number;
  currentMonth: number;
}

// Week boundaries within a month (approximate)
const WEEK_LABELS = ['W1 (1–7)', 'W2 (8–14)', 'W3 (15–21)', 'W4 (22–31)'];
const WEEK_LABELS_AR = ['أسبوع 1 (1–7)', 'أسبوع 2 (8–14)', 'أسبوع 3 (15–21)', 'أسبوع 4 (22–31)'];
// Weekly fraction of monthly rainfall (rough distribution)
const WEEK_FRACTIONS = [0.28, 0.22, 0.30, 0.20];

const MONTH_NAMES_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_NAMES_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

function calcRegionVolume(regionDensity: number, regionType: string, precipMm: number): { depthCm: number; volumeM3: number } {
  const typeFactors: Record<string, number> = {
    wadi: 3.2, industrial: 2.0, urban: 1.5, suburban: 1.2,
    coastal: 0.9, tourism: 1.3, highway: 1.8, border: 0.8,
    oasis: 1.6, heritage: 1.4,
  };
  const factor = typeFactors[regionType] ?? 1.0;
  const depthCm = precipMm * factor * regionDensity * 0.8;
  const estimatedAreaKm2 = (1 - regionDensity * 0.4) * 2.5;
  const volumeM3 = estimatedAreaKm2 * 1_000_000 * (depthCm / 100);
  return { depthCm: Math.round(depthCm * 10) / 10, volumeM3: Math.round(volumeM3) };
}

export default function WaterVolumeSummary({ onClose, lang, currentYear, currentMonth }: WaterVolumeSummaryProps) {
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedWeek, setSelectedWeek] = useState(0); // 0-3
  const [sortBy, setSortBy] = useState<'volume' | 'depth'>('volume');
  const [showAll, setShowAll] = useState(false);

  const isAr = lang === 'ar';

  // Available years
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(FLOOD_EVENTS.map(e => e.year))).sort((a, b) => b - a);
    return years;
  }, []);

  // Get precipitation for selected period
  const selectedPrecip = useMemo(() => {
    if (filterMode === 'year') {
      const yearEvents = FLOOD_EVENTS.filter(e => e.year === selectedYear);
      return yearEvents.reduce((sum, e) => sum + e.max_mm, 0);
    } else if (filterMode === 'month') {
      const ev = FLOOD_EVENTS.find(e => e.year === selectedYear && e.month === selectedMonth);
      return ev?.max_mm ?? 0;
    } else {
      // week
      const ev = FLOOD_EVENTS.find(e => e.year === selectedYear && e.month === selectedMonth);
      const monthMm = ev?.max_mm ?? 0;
      return monthMm * WEEK_FRACTIONS[selectedWeek];
    }
  }, [filterMode, selectedYear, selectedMonth, selectedWeek]);

  // Compute per-region volumes
  const regionData = useMemo(() => {
    return HISTORICAL_REGIONS.map(region => {
      const { depthCm, volumeM3 } = calcRegionVolume(region.density, region.type, selectedPrecip);
      const level = classifyByDepth(depthCm);
      return {
        id: region.id,
        name: region.name,
        nameAr: region.nameAr,
        region: region.region,
        type: region.type,
        depthCm,
        volumeM3,
        level,
      };
    }).filter(r => r.volumeM3 > 0).sort((a, b) =>
      sortBy === 'volume' ? b.volumeM3 - a.volumeM3 : b.depthCm - a.depthCm
    );
  }, [selectedPrecip, sortBy]);

  // Totals
  const totalVolume = regionData.reduce((s, r) => s + r.volumeM3, 0);
  const avgDepth = regionData.length > 0
    ? regionData.reduce((s, r) => s + r.depthCm, 0) / regionData.length
    : 0;
  const maxDepth = regionData.length > 0 ? regionData[0].depthCm : 0;

  const displayedRegions = showAll ? regionData : regionData.slice(0, 10);

  const periodLabel = useMemo(() => {
    if (filterMode === 'year') return `${selectedYear}`;
    const mName = isAr ? MONTH_NAMES_AR[selectedMonth - 1] : MONTH_NAMES_EN[selectedMonth - 1];
    if (filterMode === 'month') return `${mName} ${selectedYear}`;
    const wName = isAr ? WEEK_LABELS_AR[selectedWeek] : WEEK_LABELS[selectedWeek];
    return `${wName} — ${mName} ${selectedYear}`;
  }, [filterMode, selectedYear, selectedMonth, selectedWeek, isAr]);

  const riskColors: Record<string, string> = {
    none: '#64748B', trace: '#7DD3FC', minor: '#93C5FD',
    moderate: '#3B82F6', severe: '#1D4ED8', extreme: '#1E3A8A'
  };

  return (
    <div style={{
      position: 'fixed',
      top: 80,
      right: 340,
      width: 340,
      maxHeight: 'calc(100vh - 100px)',
      background: 'rgba(8, 12, 28, 0.97)',
      border: '1px solid rgba(59,130,246,0.3)',
      borderRadius: 12,
      zIndex: 8000,
      display: 'flex',
      flexDirection: 'column',
      backdropFilter: 'blur(16px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      direction: isAr ? 'rtl' : 'ltr',
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', borderBottom: '1px solid rgba(59,130,246,0.2)',
        background: 'rgba(59,130,246,0.08)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Droplets size={16} color="#60A5FA" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>
            {isAr ? 'حصر كميات المياه' : 'Water Volume Summary'}
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 2 }}>
          <X size={14} />
        </button>
      </div>

      {/* Filter Mode Tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: '10px 14px 6px',
        flexShrink: 0,
      }}>
        {(['year', 'month', 'week'] as FilterMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => setFilterMode(mode)}
            style={{
              flex: 1, padding: '5px 0', borderRadius: 6, border: 'none',
              cursor: 'pointer', fontSize: 11, fontWeight: 600,
              background: filterMode === mode ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.04)',
              color: filterMode === mode ? '#93C5FD' : '#64748B',
              borderBottom: filterMode === mode ? '2px solid #3B82F6' : '2px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            {isAr
              ? mode === 'year' ? 'سنة' : mode === 'month' ? 'شهر' : 'أسبوع'
              : mode === 'year' ? 'Year' : mode === 'month' ? 'Month' : 'Week'}
          </button>
        ))}
      </div>

      {/* Selectors */}
      <div style={{ padding: '4px 14px 8px', display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
        {/* Year selector */}
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6, color: '#CBD5E1', fontSize: 11, padding: '4px 6px', cursor: 'pointer',
          }}
        >
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {/* Month selector (not in year mode) */}
        {filterMode !== 'year' && (
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6, color: '#CBD5E1', fontSize: 11, padding: '4px 6px', cursor: 'pointer',
            }}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {isAr ? MONTH_NAMES_AR[i] : MONTH_NAMES_EN[i]}
              </option>
            ))}
          </select>
        )}

        {/* Week selector */}
        {filterMode === 'week' && (
          <select
            value={selectedWeek}
            onChange={e => setSelectedWeek(Number(e.target.value))}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6, color: '#CBD5E1', fontSize: 11, padding: '4px 6px', cursor: 'pointer',
            }}
          >
            {WEEK_LABELS.map((w, i) => (
              <option key={i} value={i}>{isAr ? WEEK_LABELS_AR[i] : w}</option>
            ))}
          </select>
        )}
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 6, padding: '0 14px 10px', flexShrink: 0 }}>
        {/* Total Volume */}
        <div style={{
          flex: 1, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 8, padding: '8px 10px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: '#64748B', marginBottom: 3 }}>
            {isAr ? 'إجمالي الكمية' : 'Total Volume'}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#60A5FA' }}>
            {formatVolume(totalVolume, lang)}
          </div>
        </div>
        {/* Avg Depth */}
        <div style={{
          flex: 1, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 8, padding: '8px 10px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: '#64748B', marginBottom: 3 }}>
            {isAr ? 'متوسط العمق' : 'Avg Depth'}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#34D399' }}>
            {formatDepth(avgDepth, lang)}
          </div>
        </div>
        {/* Precip */}
        <div style={{
          flex: 1, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 8, padding: '8px 10px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: '#64748B', marginBottom: 3 }}>
            {isAr ? 'الأمطار' : 'Rainfall'}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#FCD34D' }}>
            {Math.round(selectedPrecip)} mm
          </div>
        </div>
      </div>

      {/* Period label */}
      <div style={{
        padding: '0 14px 8px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Calendar size={11} color="#64748B" />
          <span style={{ fontSize: 10, color: '#64748B' }}>{periodLabel}</span>
        </div>
        {/* Sort toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setSortBy('volume')}
            style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 4, border: 'none', cursor: 'pointer',
              background: sortBy === 'volume' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
              color: sortBy === 'volume' ? '#93C5FD' : '#64748B',
            }}
          >
            {isAr ? 'الكمية' : 'Volume'}
          </button>
          <button
            onClick={() => setSortBy('depth')}
            style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 4, border: 'none', cursor: 'pointer',
              background: sortBy === 'depth' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
              color: sortBy === 'depth' ? '#93C5FD' : '#64748B',
            }}
          >
            {isAr ? 'العمق' : 'Depth'}
          </button>
        </div>
      </div>

      {/* Region list */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '0 14px 8px' }}>
        {selectedPrecip === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748B', fontSize: 12, padding: '20px 0' }}>
            {isAr ? 'لا توجد أمطار في هذه الفترة' : 'No rainfall in this period'}
          </div>
        ) : (
          <>
            {displayedRegions.map((r, idx) => {
              const color = riskColors[r.level] ?? '#64748B';
              const maxVol = regionData[0]?.volumeM3 ?? 1;
              const barWidth = Math.max(4, (r.volumeM3 / maxVol) * 100);
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 0',
                  borderBottom: idx < displayedRegions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}>
                  {/* Rank */}
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: idx < 3 ? `${color}33` : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${idx < 3 ? color : 'rgba(255,255,255,0.08)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, color: idx < 3 ? color : '#64748B',
                    flexShrink: 0,
                  }}>
                    {idx + 1}
                  </div>

                  {/* Name + bar */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#CBD5E1', fontWeight: 500, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isAr ? r.nameAr : r.name}
                    </div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${barWidth}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
                    </div>
                  </div>

                  {/* Values */}
                  <div style={{ textAlign: isAr ? 'left' : 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color }}>
                      {formatVolume(r.volumeM3, lang)}
                    </div>
                    <div style={{ fontSize: 9, color: '#64748B' }}>
                      {formatDepth(r.depthCm, lang)}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Show more / less */}
            {regionData.length > 10 && (
              <button
                onClick={() => setShowAll(!showAll)}
                style={{
                  width: '100%', marginTop: 8, padding: '6px 0',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 6, color: '#64748B', fontSize: 11, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                {showAll
                  ? <><ChevronUp size={12} />{isAr ? 'عرض أقل' : 'Show less'}</>
                  : <><ChevronDown size={12} />{isAr ? `عرض كل ${regionData.length} منطقة` : `Show all ${regionData.length} regions`}</>}
              </button>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 9, color: '#475569', lineHeight: 1.4 }}>
          {isAr
            ? 'المصدر: Open-Meteo ERA5 + Copernicus CEMS + نماذج DEM GLO-30'
            : 'Source: Open-Meteo ERA5 + Copernicus CEMS + DEM GLO-30 models'}
        </div>
      </div>
    </div>
  );
}
