/**
 * DataModeSwitcher.tsx
 * TopBar component for switching between LIVE and ARCHIVE modes.
 * In ARCHIVE mode: shows date picker + hour slider to select historical moment.
 */

import { useState, useRef, useEffect } from 'react';
import { useDataMode } from '@/contexts/DataModeContext';
import { useLanguage } from '@/contexts/LanguageContext';

// Pre-defined notable events for quick access
const NOTABLE_EVENTS = [
  { labelAr: 'Storm March 2026 — Peak Precipitation',  labelEn: 'March 2026 Storm — Peak',    date: '2026-03-23', hour: 8  },
  { labelAr: 'Storm March 2026 — Second Wave', labelEn: 'March 2026 Storm — Wave 2',  date: '2026-03-24', hour: 6  },
  { labelAr: 'Dry Day (Comparison)',                 labelEn: 'Dry Day (Comparison)',        date: '2026-03-20', hour: 12 },
  { labelAr: 'January 2024 — Winter Rain',         labelEn: 'Jan 2024 — Winter Rain',      date: '2024-01-15', hour: 10 },
  { labelAr: 'April 2024 — Major Floods',    labelEn: 'Apr 2024 — Major Floods',     date: '2024-04-16', hour: 14 },
];

export default function DataModeSwitcher() {
  const { mode, archiveDate, archiveHour, setMode, setArchiveDate, setArchiveHour, snapshot } = useDataMode();
  const { dir } = useLanguage();
  const isRtl = dir === 'rtl';
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isLive = mode === 'live';

  // Format archive label
  const archiveLabel = isLive
    ? null
    : `${archiveDate} ${String(archiveHour).padStart(2, '0')}:00`;

  return (
    <div ref={panelRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {/* Toggle Button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
          background: isLive
            ? 'rgba(16,185,129,0.15)'
            : 'rgba(251,191,36,0.15)',
          color: isLive ? '#10B981' : '#FBBF24',
          fontSize: 12, fontWeight: 700, letterSpacing: '0.05em',
          transition: 'all 0.2s',
        }}
      >
        {/* Pulse dot */}
        {isLive && (
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#10B981',
            boxShadow: '0 0 0 2px rgba(16,185,129,0.3)',
            animation: 'pulse-dot 1.5s infinite',
            flexShrink: 0,
          }} />
        )}
        {!isLive && (
          <span style={{ fontSize: 11 }}>🗓</span>
        )}
        {isLive
          ? (isRtl ? 'Live' : 'LIVE')
          : archiveLabel}
        <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          [isRtl ? 'right' : 'left']: 0,
          width: 300,
          background: '#0D1B2A',
          border: '1px solid rgba(66,165,245,0.25)',
          borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          zIndex: 9999,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid rgba(66,165,245,0.15)',
            fontSize: 11, fontWeight: 700, color: '#78909C', letterSpacing: '0.08em',
          }}>
            {isRtl ? 'DATA MODE' : 'DATA MODE'}
          </div>

          {/* Mode Toggle */}
          <div style={{ display: 'flex', padding: '10px 14px', gap: 8 }}>
            <button
              onClick={() => { setMode('live'); setOpen(false); }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: isLive ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
                color: isLive ? '#10B981' : '#78909C',
                fontSize: 12, fontWeight: 700,
                outline: isLive ? '1px solid #10B981' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {isRtl ? '⚡ Live' : '⚡ LIVE'}
            </button>
            <button
              onClick={() => setMode('archive')}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: !isLive ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)',
                color: !isLive ? '#FBBF24' : '#78909C',
                fontSize: 12, fontWeight: 700,
                outline: !isLive ? '1px solid #FBBF24' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {isRtl ? '🗓 Archive' : '🗓 ARCHIVE'}
            </button>
          </div>

          {/* Archive Controls */}
          {!isLive && (
            <div style={{ padding: '0 14px 14px' }}>
              {/* Date Picker */}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 10, color: '#78909C', marginBottom: 4, fontWeight: 600 }}>
                  {isRtl ? 'DATE' : 'DATE'}
                </label>
                <input
                  type="date"
                  value={archiveDate}
                  min="2020-01-01"
                  max={new Date(Date.now() - 5 * 86400_000).toISOString().slice(0, 10)}
                  onChange={e => setArchiveDate(e.target.value)}
                  style={{
                    width: '100%', padding: '6px 10px', borderRadius: 6,
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(66,165,245,0.2)',
                    color: '#E8F4F8', fontSize: 13, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Hour Slider */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, color: '#78909C', marginBottom: 4, fontWeight: 600 }}>
                  {isRtl ? `Hour: ${String(archiveHour).padStart(2,'0')}:00` : `HOUR: ${String(archiveHour).padStart(2,'0')}:00`}
                </label>
                <input
                  type="range"
                  min={0} max={23} step={1}
                  value={archiveHour}
                  onChange={e => setArchiveHour(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#FBBF24' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#546E7A', marginTop: 2 }}>
                  <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
                </div>
              </div>

              {/* Notable Events */}
              <div>
                <div style={{ fontSize: 10, color: '#78909C', marginBottom: 6, fontWeight: 600 }}>
                  {isRtl ? 'NOTABLE EVENTS' : 'NOTABLE EVENTS'}
                </div>
                {NOTABLE_EVENTS.map((ev, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setArchiveDate(ev.date);
                      setArchiveHour(ev.hour);
                    }}
                    style={{
                      display: 'block', width: '100%', textAlign: isRtl ? 'right' : 'left',
                      padding: '6px 8px', marginBottom: 4, borderRadius: 5,
                      background: archiveDate === ev.date && archiveHour === ev.hour
                        ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)',
                      border: archiveDate === ev.date && archiveHour === ev.hour
                        ? '1px solid rgba(251,191,36,0.4)' : '1px solid transparent',
                      color: '#B0BEC5', fontSize: 11, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {isRtl ? ev.labelAr : ev.labelEn}
                    <span style={{ float: isRtl ? 'left' : 'right', color: '#546E7A', fontSize: 10 }}>
                      {ev.date} {String(ev.hour).padStart(2,'0')}:00
                    </span>
                  </button>
                ))}
              </div>

              {/* Apply Button */}
              <button
                onClick={() => setOpen(false)}
                style={{
                  marginTop: 10, width: '100%', padding: '8px 0', borderRadius: 6,
                  background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.4)',
                  color: '#FBBF24', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {isRtl ? '✓ APPLY' : '✓ APPLY'}
              </button>
            </div>
          )}

          {/* Live info */}
          {isLive && (
            <div style={{ padding: '0 14px 12px' }}>
              <div style={{
                padding: '8px 10px', borderRadius: 6,
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.2)',
                fontSize: 11, color: '#78909C', lineHeight: 1.5,
              }}>
                {isRtl
                  ? <>⚡ District Data from <strong style={{ color: '#10B981' }}>Open-Meteo</strong> — Update every 2 minutes<br />Source: {snapshot.source}</>
                  : <>⚡ Live data from <strong style={{ color: '#10B981' }}>Open-Meteo</strong> — updates every 2 min<br />Source: {snapshot.source}</>
                }
              </div>
            </div>
          )}
        </div>
      )}

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 2px rgba(16,185,129,0.3); }
          50% { opacity: 0.7; box-shadow: 0 0 0 5px rgba(16,185,129,0.1); }
        }
      `}</style>
    </div>
  );
}
