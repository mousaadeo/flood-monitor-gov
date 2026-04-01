/**
 * HistoricalWaterPanel.tsx
 * Panel for browsing historical water accumulation data (2015–2025)
 * Shows 90 Abu Dhabi regions with water depth per event
 */
import { useState, useMemo } from 'react';
import { History, ChevronLeft, ChevronRight, BarChart2, MapPin, Droplets, Calendar, X } from 'lucide-react';
import {
  HISTORICAL_REGIONS,
  FLOOD_EVENTS,
  AVAILABLE_YEARS,
  LEVEL_COLORS,
  LEVEL_LABELS,
  type HistoricalRegion,
  type HistoricalEvent,
  type WaterLevel,
} from '@/data/historicalWater';

interface HistoricalWaterPanelProps {
  onSelectEvent: (year: number, month: number, regions: HistoricalRegion[]) => void;
  onClose: () => void;
  lang: 'ar' | 'en';
}

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const SEVERITY_COLORS: Record<string, string> = {
  low:      '#3B82F6',
  moderate: '#F59E0B',
  high:     '#EF4444',
  severe:   '#DC2626',
  extreme:  '#7C3AED',
};

const SEVERITY_LABELS: Record<string, { ar: string; en: string }> = {
  low:      { ar: 'منخفض',  en: 'Low'      },
  moderate: { ar: 'متوسط',  en: 'Moderate' },
  high:     { ar: 'عالٍ',   en: 'High'     },
  severe:   { ar: 'شديد',   en: 'Severe'   },
  extreme:  { ar: 'كارثي',  en: 'Extreme'  },
};

export default function HistoricalWaterPanel({ onSelectEvent, onClose, lang }: HistoricalWaterPanelProps) {
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [selectedEventIdx, setSelectedEventIdx] = useState<number | null>(null);
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'depth' | 'name'>('depth');

  const isAr = lang === 'ar';

  // Events for selected year
  const yearEvents = useMemo(() =>
    FLOOD_EVENTS.filter(e => e.year === selectedYear),
    [selectedYear]
  );

  // Selected event
  const selectedEvent = selectedEventIdx !== null ? yearEvents[selectedEventIdx] : null;

  // Regions data for selected event
  const eventRegions = useMemo(() => {
    if (!selectedEvent) return [];
    return HISTORICAL_REGIONS
      .filter(r => filterRegion === 'all' || r.region === filterRegion)
      .map(r => {
        const ev = r.events.find(e => e.year === selectedEvent.year && e.month === selectedEvent.month);
        return { ...r, eventData: ev };
      })
      .filter(r => r.eventData)
      .sort((a, b) => {
        if (sortBy === 'depth') return (b.eventData?.waterDepthCm ?? 0) - (a.eventData?.waterDepthCm ?? 0);
        return (isAr ? a.nameAr : a.name).localeCompare(isAr ? b.nameAr : b.name);
      });
  }, [selectedEvent, filterRegion, sortBy, isAr]);

  // Yearly stats
  const yearlyStats = useMemo(() => {
    const stats = { totalEvents: yearEvents.length, maxPrecip: 0, affectedRegions: 0, maxDepth: 0 };
    yearEvents.forEach(ev => {
      if (ev.max_mm > stats.maxPrecip) stats.maxPrecip = ev.max_mm;
    });
    const affectedSet = new Set<string>();
    HISTORICAL_REGIONS.forEach(r => {
      r.events.filter(e => e.year === selectedYear && e.level !== 'safe').forEach(() => affectedSet.add(r.id));
      r.events.filter(e => e.year === selectedYear).forEach(e => {
        if (e.waterDepthCm > stats.maxDepth) stats.maxDepth = e.waterDepthCm;
      });
    });
    stats.affectedRegions = affectedSet.size;
    return stats;
  }, [yearEvents, selectedYear]);

  const handleEventClick = (idx: number) => {
    setSelectedEventIdx(idx);
    const ev = yearEvents[idx];
    if (ev) {
      onSelectEvent(ev.year, ev.month, HISTORICAL_REGIONS);
    }
  };

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(10,15,20,0.97)', zIndex: 2000,
      display: 'flex', flexDirection: 'column', fontFamily: 'Tajawal,system-ui,sans-serif',
      direction: isAr ? 'rtl' : 'ltr',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(66,165,245,0.2)', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <History size={18} color="#42A5F5" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#e2e8f0' }}>
            {isAr ? 'الأرشيف التاريخي للمياه' : 'Historical Water Archive'}
          </div>
          <div style={{ fontSize: '10px', color: '#475569' }}>
            {isAr ? '90 منطقة · 2015–2025 · 22 حدث فيضاني' : '90 Regions · 2015–2025 · 22 Flood Events'}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <X size={14} />
        </button>
      </div>

      {/* Year selector */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>
          {isAr ? 'اختر السنة' : 'SELECT YEAR'}
        </div>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {AVAILABLE_YEARS.map(y => (
            <button
              key={y}
              onClick={() => { setSelectedYear(y); setSelectedEventIdx(null); }}
              style={{
                padding: '4px 10px', borderRadius: '5px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                background: selectedYear === y ? '#42A5F5' : 'rgba(255,255,255,0.06)',
                color: selectedYear === y ? '#0a1520' : '#94a3b8',
                border: selectedYear === y ? '1px solid #42A5F5' : '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.15s',
              }}
            >
              {y}
              {y === 2024 && <span style={{ fontSize: '8px', marginRight: '2px', color: selectedYear === y ? '#0a1520' : '#EF4444' }}>★</span>}
            </button>
          ))}
        </div>

        {/* Year stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px', marginTop: '8px' }}>
          {[
            { label: isAr ? 'أحداث' : 'Events', value: yearlyStats.totalEvents, color: '#42A5F5' },
            { label: isAr ? 'أقصى هطول' : 'Max Rain', value: `${yearlyStats.maxPrecip}mm`, color: '#3B82F6' },
            { label: isAr ? 'مناطق متأثرة' : 'Affected', value: yearlyStats.affectedRegions, color: '#F59E0B' },
            { label: isAr ? 'أقصى عمق' : 'Max Depth', value: `${Math.round(yearlyStats.maxDepth)}cm`, color: '#EF4444' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '5px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
              <div style={{ fontSize: '9px', color: '#475569' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Events for selected year */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>
          {isAr ? 'أحداث الفيضان' : 'FLOOD EVENTS'} {selectedYear}
        </div>
        {yearEvents.length === 0 ? (
          <div style={{ fontSize: '11px', color: '#475569', textAlign: 'center', padding: '8px' }}>
            {isAr ? 'لا توجد أحداث مسجلة' : 'No recorded events'}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {yearEvents.map((ev, idx) => (
              <button
                key={idx}
                onClick={() => handleEventClick(idx)}
                style={{
                  padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', textAlign: isAr ? 'right' : 'left',
                  background: selectedEventIdx === idx ? `${SEVERITY_COLORS[ev.severity]}22` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selectedEventIdx === idx ? SEVERITY_COLORS[ev.severity] : 'rgba(255,255,255,0.1)'}`,
                  transition: 'all 0.15s',
                  flex: '1 1 auto', minWidth: '120px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: SEVERITY_COLORS[ev.severity] }}>
                  {isAr ? MONTHS_AR[ev.month - 1] : MONTHS_EN[ev.month - 1]} {ev.year}
                </div>
                <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>
                  {ev.max_mm}mm · {isAr ? SEVERITY_LABELS[ev.severity].ar : SEVERITY_LABELS[ev.severity].en}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Region list for selected event */}
      {selectedEvent && (
        <>
          {/* Filters */}
          <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            <select
              value={filterRegion}
              onChange={e => setFilterRegion(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '5px', color: '#e2e8f0', fontSize: '11px', padding: '3px 6px', cursor: 'pointer' }}
            >
              <option value="all">{isAr ? 'كل المناطق' : 'All Regions'}</option>
              <option value="Abu Dhabi">{isAr ? 'أبوظبي' : 'Abu Dhabi'}</option>
              <option value="Al Ain">{isAr ? 'العين' : 'Al Ain'}</option>
              <option value="Al Dhafra">{isAr ? 'الظفرة' : 'Al Dhafra'}</option>
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'depth' | 'name')}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '5px', color: '#e2e8f0', fontSize: '11px', padding: '3px 6px', cursor: 'pointer' }}
            >
              <option value="depth">{isAr ? 'ترتيب: عمق المياه' : 'Sort: Water Depth'}</option>
              <option value="name">{isAr ? 'ترتيب: الاسم' : 'Sort: Name'}</option>
            </select>
            <span style={{ fontSize: '10px', color: '#475569', marginRight: 'auto' }}>
              {eventRegions.length} {isAr ? 'منطقة' : 'regions'}
            </span>
          </div>

          {/* Event header */}
          <div style={{ padding: '8px 16px', background: `${SEVERITY_COLORS[selectedEvent.severity]}11`, borderBottom: `1px solid ${SEVERITY_COLORS[selectedEvent.severity]}33`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Droplets size={14} color={SEVERITY_COLORS[selectedEvent.severity]} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: SEVERITY_COLORS[selectedEvent.severity] }}>
                {selectedEvent.name}
              </span>
              <span style={{ fontSize: '10px', color: '#64748b', marginRight: 'auto' }}>
                {selectedEvent.max_mm}mm · {isAr ? SEVERITY_LABELS[selectedEvent.severity].ar : SEVERITY_LABELS[selectedEvent.severity].en}
              </span>
            </div>
          </div>

          {/* Region rows */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {eventRegions.map((r, idx) => {
              const ev = r.eventData!;
              const color = LEVEL_COLORS[ev.level];
              return (
                <div
                  key={r.id}
                  style={{
                    padding: '7px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  }}
                >
                  {/* Rank */}
                  <span style={{ fontSize: '10px', color: '#334155', fontFamily: 'monospace', minWidth: '18px', textAlign: 'center' }}>
                    {idx + 1}
                  </span>
                  {/* Color dot */}
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 4px ${color}` }} />
                  {/* Name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isAr ? r.nameAr : r.name}
                    </div>
                    <div style={{ fontSize: '9px', color: '#475569' }}>
                      {r.region} · {r.type}
                    </div>
                  </div>
                  {/* Depth bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <div style={{ width: '60px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: color, width: `${Math.min(100, (ev.waterDepthCm / 200) * 100)}%`, borderRadius: '2px' }} />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color, fontFamily: 'monospace', minWidth: '42px', textAlign: 'right' }}>
                      {ev.waterDepthCm}cm
                    </span>
                  </div>
                  {/* Level badge */}
                  <div style={{ background: `${color}22`, border: `1px solid ${color}44`, borderRadius: '4px', padding: '2px 6px', fontSize: '9px', fontWeight: 700, color, flexShrink: 0 }}>
                    {isAr ? LEVEL_LABELS[ev.level].ar : LEVEL_LABELS[ev.level].en}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!selectedEvent && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', color: '#334155' }}>
          <Calendar size={32} />
          <div style={{ fontSize: '12px', textAlign: 'center' }}>
            {isAr ? 'اختر حدثاً لعرض بيانات المناطق' : 'Select an event to view region data'}
          </div>
        </div>
      )}
    </div>
  );
}
