/*
 * HistoricalTimelineScrubber.tsx  — Advanced Historical Timeline (v3)
 *
 * Three view modes:
 *   "month"  — single month (12 bars for the selected year)
 *   "year"   — full year overview (12 months, all highlighted)
 *   "range"  — custom from/to (year+month precision, all months shown)
 *
 * Key fix: range changes are emitted IMMEDIATELY via onRangeChange (no Apply button needed).
 * The parent (UnifiedMapPage) reacts to onRangeChange to update the map markers + precipMultiplier.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, X, Filter } from 'lucide-react';
import { FLOOD_EVENTS, AVAILABLE_YEARS, type FloodEventDef } from '@/data/historicalWater';

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTH_NAMES_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MONTH_NAMES_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const SEVERITY_COLOR: Record<string, string> = {
  none:     '#1e293b',
  low:      '#3B82F6',
  moderate: '#F59E0B',
  high:     '#F97316',
  severe:   '#EF4444',
  extreme:  '#7C3AED',
};

const SEVERITY_ORDER = ['none','low','moderate','high','severe','extreme'];
function maxSeverity(a: string, b: string): string {
  return SEVERITY_ORDER.indexOf(a) >= SEVERITY_ORDER.indexOf(b) ? a : b;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type ViewMode = 'month' | 'year' | 'range';

export interface HistoricalRange {
  fromYear: number;
  fromMonth: number;  // 1-12
  toYear: number;
  toMonth: number;    // 1-12
}

interface BarSlot {
  key: string;
  year: number;
  month: number;
  labelAr: string;
  labelEn: string;
  precipMm: number;
  hasEvent: boolean;
  event?: FloodEventDef;
  severity: string;
  isSelected: boolean;
}

interface Props {
  year: number;
  selectedMonth: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onClose: () => void;
  lang: 'ar' | 'en';
  onRangeChange?: (range: HistoricalRange | null) => void;
  onViewModeChange?: (mode: ViewMode) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toKey(y: number, m: number) { return `${y}-${String(m).padStart(2,'0')}`; }
function compareYM(y1: number, m1: number, y2: number, m2: number) {
  return y1 !== y2 ? y1 - y2 : m1 - m2;
}

function buildBars(
  fromYear: number, fromMonth: number,
  toYear: number, toMonth: number,
  selectedYear: number, selectedMonth: number,
  viewMode: ViewMode,
): BarSlot[] {
  const bars: BarSlot[] = [];
  let y = fromYear, m = fromMonth;
  const maxYear = Math.max(...AVAILABLE_YEARS);
  while (compareYM(y, m, toYear, toMonth) <= 0) {
    const ev = FLOOD_EVENTS.find(e => e.year === y && e.month === m);
    bars.push({
      key: toKey(y, m),
      year: y, month: m,
      labelAr: MONTH_NAMES_AR[m - 1],
      labelEn: MONTH_NAMES_EN[m - 1],
      precipMm: ev?.max_mm ?? 0,
      hasEvent: !!ev,
      event: ev,
      severity: ev?.severity ?? 'none',
      isSelected: viewMode === 'month' && y === selectedYear && m === selectedMonth,
    });
    m++;
    if (m > 12) { m = 1; y++; }
    if (y > maxYear + 1) break;
  }
  return bars;
}

function computeStats(bars: BarSlot[]) {
  const events = bars.filter(b => b.hasEvent);
  const totalPrecip = events.reduce((s, b) => s + b.precipMm, 0);
  const maxPrecip = events.length ? Math.max(...events.map(b => b.precipMm)) : 0;
  const worstSeverity = events.reduce((s, b) => maxSeverity(s, b.severity), 'none');
  return { eventCount: events.length, totalPrecip, maxPrecip, worstSeverity };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function HistoricalTimelineScrubber({
  year,
  selectedMonth,
  onMonthChange,
  onYearChange,
  onClose,
  lang,
  onRangeChange,
  onViewModeChange,
}: Props) {
  const isAr = lang === 'ar';
  const currentYear = new Date().getFullYear();

  // ── view mode ──
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  // ── range state (default: last 3 years to current) ──
  const [rangeFrom, setRangeFrom] = useState({ year: 2015, month: 1 });
  const [rangeTo,   setRangeTo]   = useState({ year: Math.min(currentYear, Math.max(...AVAILABLE_YEARS)), month: 12 });
  const [showRangePicker, setShowRangePicker] = useState(false);

  // ── playback ──
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // ── derive bars ──
  const bars = (() => {
    if (viewMode === 'month') {
      return buildBars(year, 1, year, 12, year, selectedMonth, 'month');
    }
    if (viewMode === 'year') {
      return buildBars(year, 1, year, 12, year, selectedMonth, 'year');
    }
    // range
    return buildBars(rangeFrom.year, rangeFrom.month, rangeTo.year, rangeTo.month, year, selectedMonth, 'range');
  })();

  const maxPrecip = Math.max(...bars.map(b => b.precipMm), 1);
  const stats = computeStats(bars);
  const selectedBar = bars.find(b => b.isSelected) ?? null;

  // ── Emit range to parent IMMEDIATELY on any change ──
  useEffect(() => {
    if (!onRangeChange) return;
    if (viewMode === 'month') {
      onRangeChange(null);
    } else if (viewMode === 'year') {
      onRangeChange({ fromYear: year, fromMonth: 1, toYear: year, toMonth: 12 });
    } else {
      // range mode — emit immediately
      onRangeChange({
        fromYear: rangeFrom.year, fromMonth: rangeFrom.month,
        toYear: rangeTo.year,   toMonth: rangeTo.month,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, year, rangeFrom.year, rangeFrom.month, rangeTo.year, rangeTo.month]);

  useEffect(() => { onViewModeChange?.(viewMode); }, [viewMode, onViewModeChange]);

  // ── auto-play (month mode only) ──
  useEffect(() => {
    if (playing && viewMode === 'month') {
      playRef.current = setInterval(() => {
        const next = selectedMonth < 12 ? selectedMonth + 1 : 1;
        onMonthChange(next);
        if (next === 12) setPlaying(false);
      }, 600);
    } else {
      if (playRef.current) clearInterval(playRef.current);
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [playing, selectedMonth, onMonthChange, viewMode]);

  // ── scroll selected bar into view ──
  useEffect(() => {
    if (!trackRef.current || viewMode !== 'month') return;
    const bar = trackRef.current.querySelector(`[data-key="${toKey(year, selectedMonth)}"]`) as HTMLElement | null;
    if (bar) bar.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedMonth, year, viewMode]);

  // ── bar click ──
  const handleBarClick = useCallback((bar: BarSlot) => {
    if (viewMode === 'month' || viewMode === 'year') {
      onYearChange(bar.year);
      onMonthChange(bar.month);
    }
    if (viewMode === 'range') {
      // clicking a bar in range mode → zoom to that month
      onYearChange(bar.year);
      onMonthChange(bar.month);
      setViewMode('month');
    }
  }, [viewMode, onMonthChange, onYearChange]);

  // ── switch mode ──
  const switchMode = (m: ViewMode) => {
    setPlaying(false);
    setViewMode(m);
    if (m === 'range') setShowRangePicker(true);
  };

  // ── apply preset ──
  const applyPreset = (from: {year: number; month: number}, to: {year: number; month: number}) => {
    setRangeFrom(from);
    setRangeTo(to);
    setShowRangePicker(false);
    // viewMode is already 'range' when picker is shown
  };

  const selColor = selectedBar?.hasEvent
    ? SEVERITY_COLOR[selectedBar.severity]
    : (stats.worstSeverity !== 'none' ? SEVERITY_COLOR[stats.worstSeverity] : '#475569');

  const maxAvailYear = Math.max(...AVAILABLE_YEARS);

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: viewMode === 'range' && bars.length > 24 ? '115px' : '100px',
      background: 'linear-gradient(to top, rgba(8,14,24,0.98) 70%, rgba(8,14,24,0.0))',
      zIndex: 998,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: '0 10px 6px',
      userSelect: 'none',
      pointerEvents: 'none',
    }}>

      {/* ── Range picker popup ── */}
      {showRangePicker && (
        <div style={{
          pointerEvents: 'auto',
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(8,14,24,0.97)',
          border: '1px solid rgba(251,191,36,0.4)',
          borderRadius: '8px',
          padding: '12px 16px',
          zIndex: 1000,
          minWidth: '340px',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#FBBF24', fontFamily: 'Space Mono, monospace' }}>
              {isAr ? 'تحديد الفترة الزمنية' : 'SELECT DATE RANGE'}
            </span>
            <button onClick={() => setShowRangePicker(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
              <X size={12} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* FROM */}
            <div>
              <div style={{ fontSize: '9px', color: '#64748b', fontFamily: 'monospace', marginBottom: '4px' }}>
                {isAr ? 'من' : 'FROM'}
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <select
                  value={rangeFrom.year}
                  onChange={e => setRangeFrom(p => ({ ...p, year: Number(e.target.value) }))}
                  style={{ flex: 1, background: '#0d1117', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '4px', color: '#FBBF24', fontSize: '11px', padding: '4px', fontFamily: 'monospace' }}
                >
                  {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select
                  value={rangeFrom.month}
                  onChange={e => setRangeFrom(p => ({ ...p, month: Number(e.target.value) }))}
                  style={{ flex: 1, background: '#0d1117', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '4px', color: '#90CAF9', fontSize: '11px', padding: '4px', fontFamily: 'monospace' }}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i+1} value={i+1}>{isAr ? MONTH_NAMES_AR[i] : MONTH_NAMES_EN[i]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* TO */}
            <div>
              <div style={{ fontSize: '9px', color: '#64748b', fontFamily: 'monospace', marginBottom: '4px' }}>
                {isAr ? 'إلى' : 'TO'}
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <select
                  value={rangeTo.year}
                  onChange={e => setRangeTo(p => ({ ...p, year: Number(e.target.value) }))}
                  style={{ flex: 1, background: '#0d1117', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '4px', color: '#FBBF24', fontSize: '11px', padding: '4px', fontFamily: 'monospace' }}
                >
                  {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select
                  value={rangeTo.month}
                  onChange={e => setRangeTo(p => ({ ...p, month: Number(e.target.value) }))}
                  style={{ flex: 1, background: '#0d1117', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '4px', color: '#90CAF9', fontSize: '11px', padding: '4px', fontFamily: 'monospace' }}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i+1} value={i+1}>{isAr ? MONTH_NAMES_AR[i] : MONTH_NAMES_EN[i]}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Quick presets */}
          <div style={{ marginTop: '10px' }}>
            <div style={{ fontSize: '9px', color: '#64748b', fontFamily: 'monospace', marginBottom: '5px' }}>
              {isAr ? 'اختصارات سريعة' : 'QUICK PRESETS'}
            </div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {[
                { label: isAr ? 'آخر 3 سنوات' : 'Last 3y',  from: { year: maxAvailYear - 2, month: 1 }, to: { year: maxAvailYear, month: 12 } },
                { label: isAr ? 'آخر 5 سنوات' : 'Last 5y',  from: { year: maxAvailYear - 4, month: 1 }, to: { year: maxAvailYear, month: 12 } },
                { label: isAr ? '10 سنوات'    : '10 years',  from: { year: 2015, month: 1 },             to: { year: maxAvailYear, month: 12 } },
                { label: isAr ? 'موسم الشتاء' : 'Winter',    from: { year: 2015, month: 11 },            to: { year: maxAvailYear, month: 3  } },
                { label: isAr ? '2024 كامل'   : '2024 full', from: { year: 2024, month: 1 },             to: { year: 2024, month: 12 } },
                { label: isAr ? '2026 حتى الآن' : '2026 YTD',from: { year: 2026, month: 1 },             to: { year: 2026, month: 3  } },
              ].map(preset => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset.from, preset.to)}
                  style={{
                    padding: '3px 8px', borderRadius: '4px', fontSize: '9px', cursor: 'pointer',
                    background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
                    color: '#FBBF24', fontFamily: 'Tajawal, sans-serif',
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live preview of selection */}
          <div style={{ marginTop: '8px', padding: '6px 8px', background: 'rgba(251,191,36,0.05)', borderRadius: '4px', border: '1px solid rgba(251,191,36,0.15)' }}>
            <span style={{ fontSize: '9px', color: '#FBBF24', fontFamily: 'monospace' }}>
              {isAr ? '📅 الفترة المختارة: ' : '📅 Selected: '}
              {rangeFrom.year}/{String(rangeFrom.month).padStart(2,'0')} → {rangeTo.year}/{String(rangeTo.month).padStart(2,'0')}
              {' · '}
              {(() => {
                const evCount = FLOOD_EVENTS.filter(e => {
                  const af = e.year > rangeFrom.year || (e.year === rangeFrom.year && e.month >= rangeFrom.month);
                  const bt = e.year < rangeTo.year   || (e.year === rangeTo.year   && e.month <= rangeTo.month);
                  return af && bt;
                }).length;
                return isAr ? `${evCount} حدث` : `${evCount} events`;
              })()}
            </span>
          </div>

          <div style={{ marginTop: '8px', fontSize: '9px', color: '#475569', fontFamily: 'Tajawal, sans-serif', textAlign: 'center' }}>
            {isAr ? '✓ الخارطة تتحدث فوراً عند أي تغيير' : '✓ Map updates instantly on any change'}
          </div>
        </div>
      )}

      {/* ── Top row: mode tabs + controls ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '4px',
        pointerEvents: 'auto',
        flexWrap: 'wrap',
      }}>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', padding: '2px' }}>
          {([
            { key: 'month' as ViewMode, labelAr: 'شهر', labelEn: 'Month' },
            { key: 'year'  as ViewMode, labelAr: 'سنة',  labelEn: 'Year'  },
            { key: 'range' as ViewMode, labelAr: 'فترة', labelEn: 'Range' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => switchMode(tab.key)}
              style={{
                padding: '3px 8px', borderRadius: '4px', fontSize: '9px', cursor: 'pointer',
                background: viewMode === tab.key ? 'rgba(251,191,36,0.2)' : 'transparent',
                border: viewMode === tab.key ? '1px solid rgba(251,191,36,0.5)' : '1px solid transparent',
                color: viewMode === tab.key ? '#FBBF24' : '#64748b',
                fontFamily: 'Tajawal, sans-serif', fontWeight: viewMode === tab.key ? 700 : 400,
                transition: 'all 0.15s',
              }}
            >
              {isAr ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </div>

        {/* Play/Pause (month mode only) */}
        {viewMode === 'month' && (
          <>
            <button
              onClick={() => setPlaying(p => !p)}
              style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: playing ? 'rgba(255,107,53,0.25)' : 'rgba(251,191,36,0.2)',
                border: `1px solid ${playing ? 'rgba(255,107,53,0.6)' : 'rgba(251,191,36,0.5)'}`,
                color: playing ? '#FF6B35' : '#FBBF24',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              {playing ? <Pause size={11} /> : <Play size={11} />}
            </button>
            <button
              onClick={() => { setPlaying(false); onMonthChange(Math.max(1, selectedMonth - 1)); }}
              style={{ width: '20px', height: '20px', borderRadius: '4px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#90CAF9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <ChevronLeft size={10} />
            </button>
            <button
              onClick={() => { setPlaying(false); onMonthChange(Math.min(12, selectedMonth + 1)); }}
              style={{ width: '20px', height: '20px', borderRadius: '4px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#90CAF9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <ChevronRight size={10} />
            </button>
          </>
        )}

        {/* Range filter button */}
        {viewMode === 'range' && (
          <button
            onClick={() => setShowRangePicker(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              padding: '3px 8px', borderRadius: '5px', cursor: 'pointer',
              background: showRangePicker ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.07)',
              border: `1px solid ${showRangePicker ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.1)'}`,
              color: showRangePicker ? '#FBBF24' : '#90CAF9',
              fontSize: '9px', fontFamily: 'Tajawal, sans-serif',
            }}
          >
            <Filter size={9} />
            <span>{isAr ? 'تعديل الفترة' : 'Edit Range'}</span>
          </button>
        )}

        {/* HIST badge + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '9px', fontWeight: 700, color: '#FBBF24', fontFamily: 'Space Mono, monospace', letterSpacing: '0.08em' }}>
            HIST
          </span>
          {viewMode === 'month' && (
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#E8F4F8', fontFamily: 'Space Mono, monospace' }}>
              {isAr ? MONTH_NAMES_AR[selectedMonth - 1] : MONTH_NAMES_EN[selectedMonth - 1]} {year}
            </span>
          )}
          {viewMode === 'year' && (
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#E8F4F8', fontFamily: 'Space Mono, monospace' }}>
              {year} {isAr ? '(كامل السنة)' : '(full year)'}
            </span>
          )}
          {viewMode === 'range' && (
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#E8F4F8', fontFamily: 'Space Mono, monospace' }}>
              {rangeFrom.year}/{String(rangeFrom.month).padStart(2,'0')} → {rangeTo.year}/{String(rangeTo.month).padStart(2,'0')}
            </span>
          )}
        </div>

        {/* Event name (month mode) */}
        {viewMode === 'month' && selectedBar?.hasEvent && (
          <span style={{
            fontSize: '9px', color: selColor, fontFamily: 'Tajawal, sans-serif',
            background: `${selColor}22`, padding: '2px 6px', borderRadius: '4px',
            border: `1px solid ${selColor}44`,
          }}>
            {selectedBar.event?.name}
          </span>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', alignItems: 'center' }}>
          {viewMode === 'month' && selectedBar?.hasEvent && (
            <span style={{ fontSize: '10px', color: '#42A5F5', fontFamily: 'monospace' }}>
              Precip.: <strong>{selectedBar.precipMm} mm</strong>
            </span>
          )}
          {(viewMode === 'year' || viewMode === 'range') && stats.eventCount > 0 && (
            <>
              <span style={{ fontSize: '9px', color: '#42A5F5', fontFamily: 'monospace' }}>
                {isAr ? 'أحداث:' : 'Events:'} <strong>{stats.eventCount}</strong>
              </span>
              <span style={{ fontSize: '9px', color: '#90CAF9', fontFamily: 'monospace' }}>
                {isAr ? 'مجموع:' : 'Total:'} <strong>{Math.round(stats.totalPrecip)} mm</strong>
              </span>
              <span style={{ fontSize: '9px', color: SEVERITY_COLOR[stats.worstSeverity], fontFamily: 'monospace' }}>
                {isAr ? 'أقصى:' : 'Peak:'} <strong>{stats.maxPrecip} mm</strong>
              </span>
            </>
          )}

          {/* Year selector (month + year modes) */}
          {viewMode !== 'range' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <button
                onClick={() => onYearChange(Math.max(Math.min(...AVAILABLE_YEARS), year - 1))}
                style={{ width: '16px', height: '16px', borderRadius: '3px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#90CAF9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <ChevronLeft size={8} />
              </button>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#FBBF24', fontFamily: 'monospace', minWidth: '30px', textAlign: 'center' }}>{year}</span>
              <button
                onClick={() => onYearChange(Math.min(maxAvailYear, year + 1))}
                style={{ width: '16px', height: '16px', borderRadius: '3px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#90CAF9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <ChevronRight size={8} />
              </button>
            </div>
          )}

          {/* Close / back to LIVE */}
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: '5px', cursor: 'pointer', color: '#10B981',
              padding: '3px 7px', fontSize: '9px', fontFamily: 'Tajawal, sans-serif',
            }}
          >
            <X size={9} />
            <span>{isAr ? 'مباشر' : 'Live'}</span>
          </button>
        </div>
      </div>

      {/* ── Bar track ── */}
      <div
        ref={trackRef}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: viewMode === 'range' && bars.length > 36 ? '1px' : '2px',
          height: '36px',
          cursor: 'crosshair',
          overflowX: 'hidden',
          overflowY: 'hidden',
          position: 'relative',
          pointerEvents: 'auto',
        }}
      >
        {bars.map((bar) => {
          const barH = bar.hasEvent ? Math.max(4, (bar.precipMm / maxPrecip) * 32) : 3;
          const isSelected = bar.isSelected;
          const color = bar.hasEvent ? SEVERITY_COLOR[bar.severity] : '#1e3a5f';
          const opacity = isSelected ? 1 : bar.hasEvent ? (viewMode === 'month' ? 0.55 : 0.75) : 0.2;

          return (
            <div
              key={bar.key}
              data-key={bar.key}
              onClick={() => handleBarClick(bar)}
              title={`${isAr ? bar.labelAr : bar.labelEn} ${bar.year}${bar.hasEvent ? ` — ${bar.precipMm} mm` : ''}`}
              style={{
                flex: 1,
                minWidth: viewMode === 'range' && bars.length > 60 ? '4px' : '8px',
                height: '36px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <div style={{
                width: '100%',
                height: `${barH}px`,
                background: isSelected ? color : `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
                borderRadius: '2px 2px 0 0',
                boxShadow: isSelected ? `0 0 8px ${color}88` : bar.hasEvent && viewMode !== 'month' ? `0 0 4px ${color}44` : 'none',
                transition: 'height 0.3s ease, background 0.3s ease',
              }} />
              {isSelected && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: '2px', height: '100%',
                  background: color,
                  boxShadow: `0 0 6px ${color}`,
                  borderRadius: '1px',
                }} />
              )}
              {bar.hasEvent && !isSelected && (
                <div style={{
                  position: 'absolute',
                  top: '2px',
                  width: '4px', height: '4px',
                  borderRadius: '50%',
                  background: color,
                  opacity: 0.9,
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Labels row ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '2px',
        pointerEvents: 'none',
      }}>
        {bars.map((bar, idx) => {
          const showLabel = viewMode === 'range' && bars.length > 24
            ? (bar.month === 1 || idx === 0 || idx === bars.length - 1)
            : true;
          const label = viewMode === 'range' && bars.length > 24
            ? (bar.month === 1 ? String(bar.year) : '')
            : (isAr ? bar.labelAr.slice(0, 3) : bar.labelEn);

          return (
            <span key={bar.key} style={{
              flex: 1,
              textAlign: 'center',
              fontSize: '7px',
              fontFamily: 'Space Mono, monospace',
              color: bar.isSelected
                ? (bar.hasEvent ? SEVERITY_COLOR[bar.severity] : '#FBBF24')
                : bar.hasEvent ? '#546E7A' : '#2d3748',
              fontWeight: bar.isSelected ? 700 : 400,
              transition: 'color 0.2s',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}>
              {showLabel ? label : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}
