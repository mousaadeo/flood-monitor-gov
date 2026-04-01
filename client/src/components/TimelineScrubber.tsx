/*
 * TimelineScrubber.tsx — Thin timeline bar embedded inside the map (Windy style)
 * Fixed height 88px — does not take space from the map
 */

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';

export interface TimelineHour {
  index: number;
  time: string;
  label: string;
  dateLabel: string;
  precipitation: number;
  probability: number;
  isPast: boolean;
  isNow: boolean;
  isForecast: boolean;
}

interface TimelineScrubberProps {
  hours: TimelineHour[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  isLive: boolean;
  loading?: boolean;
}

const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function buildTimelineHours(
  hourlyTimes: string[],
  hourlyPrecipitation: number[],
  hourlyProbability: number[],
  nowIndex: number
): TimelineHour[] {
  return hourlyTimes.map((t, i) => {
    const dt = new Date(t.replace('T', ' ') + ':00');
    const dayName = DAYS_EN[dt.getDay()] ?? '';
    const dd = dt.getDate();
    const mm = dt.getMonth() + 1;
    return {
      index: i,
      time: t,
      label: t.split('T')[1] ?? t,
      dateLabel: `${dayName} ${dd}/${mm}`,
      precipitation: Math.round((hourlyPrecipitation[i] || 0) * 10) / 10,
      probability: hourlyProbability[i] || 0,
      isPast: i < nowIndex,
      isNow: i === nowIndex,
      isForecast: i > nowIndex,
    };
  });
}

export default function TimelineScrubber({
  hours,
  currentIndex,
  onIndexChange,
  isLive,
  loading = false,
}: TimelineScrubberProps) {
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const maxPrecip = Math.max(...hours.map(h => h.precipitation), 0.1);
  const selectedHour = hours[currentIndex];
  const nowIdx = hours.findIndex(h => h.isNow);

  // Auto-play
  useEffect(() => {
    if (playing) {
      playRef.current = setInterval(() => {
        onIndexChange(currentIndex + 1 < hours.length ? currentIndex + 1 : currentIndex);
        if (currentIndex + 1 >= hours.length) setPlaying(false);
      }, 400);
    } else {
      if (playRef.current) clearInterval(playRef.current);
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [playing, hours.length, onIndexChange, currentIndex]);

  // Scroll selected bar into view
  useEffect(() => {
    if (!trackRef.current) return;
    const bar = trackRef.current.querySelector(`[data-idx="${currentIndex}"]`) as HTMLElement | null;
    if (bar) bar.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [currentIndex]);

  const badge = selectedHour?.isNow
    ? { label: 'LIVE', color: '#43A047', dot: true }
    : selectedHour?.isPast
      ? { label: 'HIST', color: '#42A5F5', dot: false }
      : { label: 'FCST', color: '#FFB300', dot: false };

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '88px',
      background: 'linear-gradient(to top, rgba(8,14,24,0.97) 60%, rgba(8,14,24,0.0))',
      zIndex: 998,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: '0 10px 6px',
      userSelect: 'none',
      pointerEvents: 'none',
    }}>
      {/* ── Info row ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '4px',
        pointerEvents: 'auto',
      }}>
        {/* Play/Pause */}
        <button
          onClick={() => setPlaying(p => !p)}
          title={playing ? 'Pause' : 'Play'}
          style={{
            width: '26px', height: '26px', borderRadius: '50%',
            background: playing ? 'rgba(255,107,53,0.25)' : 'rgba(66,165,245,0.2)',
            border: `1px solid ${playing ? 'rgba(255,107,53,0.6)' : 'rgba(66,165,245,0.5)'}`,
            color: playing ? '#FF6B35' : '#42A5F5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          {playing ? <Pause size={12} /> : <Play size={12} />}
        </button>

        {/* Prev/Next */}
        <button onClick={() => { setPlaying(false); onIndexChange(Math.max(0, currentIndex - 1)); }}
          style={{ width: '22px', height: '22px', borderRadius: '4px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#90CAF9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ChevronLeft size={11} />
        </button>
        <button onClick={() => { setPlaying(false); onIndexChange(Math.min(hours.length - 1, currentIndex + 1)); }}
          style={{ width: '22px', height: '22px', borderRadius: '4px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#90CAF9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ChevronRight size={11} />
        </button>

        {/* Badge */}
        {selectedHour && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{
              fontSize: '9px', fontWeight: 700, color: badge.color,
              fontFamily: 'Space Mono, monospace', letterSpacing: '0.08em',
              display: 'flex', alignItems: 'center', gap: '3px',
            }}>
              {badge.dot && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: badge.color, display: 'inline-block', boxShadow: `0 0 5px ${badge.color}` }} />}
              {badge.label}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#E8F4F8', fontFamily: 'Space Mono, monospace' }}>
              {selectedHour.dateLabel} {selectedHour.label}
            </span>
          </div>
        )}

        {/* Stats */}
        {selectedHour && (
          <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
            <span style={{ fontSize: '10px', color: '#42A5F5', fontFamily: 'monospace' }}>
              Precip.: <strong>{selectedHour.precipitation} mm</strong>
            </span>
            <span style={{ fontSize: '10px', color: '#FFB300', fontFamily: 'monospace' }}>
              Prob.: <strong>{selectedHour.probability}%</strong>
            </span>
            {!isLive && <span style={{ fontSize: '9px', color: '#EF4444', fontFamily: 'monospace' }}>● OFFLINE</span>}
            {loading && <span style={{ fontSize: '9px', color: '#F59E0B', fontFamily: 'monospace' }}>Updating...</span>}
          </div>
        )}
      </div>

      {/* ── Timeline bars ── */}
      <div
        ref={trackRef}
        onClick={(e) => {
          if (!trackRef.current) return;
          const rect = trackRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const ratio = Math.max(0, Math.min(1, x / rect.width));
          const idx = Math.round(ratio * (hours.length - 1));
          onIndexChange(idx);
        }}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '1px',
          height: '36px',
          cursor: 'crosshair',
          overflowX: 'hidden',
          overflowY: 'hidden',
          position: 'relative',
          pointerEvents: 'auto',
        }}
      >
        {/* NOW line */}
        {nowIdx >= 0 && (
          <div style={{
            position: 'absolute',
            left: `${nowIdx / Math.max(hours.length - 1, 1) * 100}%`,
            top: 0, bottom: 0, width: '1px',
            background: 'rgba(67,160,71,0.7)',
            zIndex: 2,
            pointerEvents: 'none',
          }}>
            <span style={{ position: 'absolute', top: '-14px', left: '3px', fontSize: '7px', color: '#43A047', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>NOW</span>
          </div>
        )}

        {hours.map((h, i) => {
          const barH = Math.max(2, (h.precipitation / maxPrecip) * 30);
          const isSelected = i === currentIndex;
          const barColor = h.isNow ? '#43A047' : h.isPast ? '#42A5F5' : '#FFB300';
          const opacity = isSelected ? 1 : h.isPast ? 0.5 : 0.3;
          return (
            <div
              key={i}
              data-idx={i}
              onClick={e => { e.stopPropagation(); onIndexChange(i); }}
              title={`${h.dateLabel} ${h.label} — ${h.precipitation} mm`}
              style={{
                flex: 1,
                minWidth: '3px',
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
                background: isSelected ? barColor : `${barColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
                borderRadius: '1px 1px 0 0',
                boxShadow: isSelected ? `0 0 6px ${barColor}88` : 'none',
              }} />
              {/* Selected cursor */}
              {isSelected && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: '1.5px', height: '100%',
                  background: barColor,
                  boxShadow: `0 0 6px ${barColor}`,
                  borderRadius: '1px',
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Hour labels ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '2px',
        pointerEvents: 'none',
      }}>
        {hours.filter((_, i) => i % 8 === 0).map(h => (
          <span key={h.index} style={{
            fontSize: '7px',
            fontFamily: 'Space Mono, monospace',
            color: h.isNow ? '#43A047' : h.isPast ? '#455A64' : '#546E7A',
            fontWeight: h.isNow ? 700 : 400,
          }}>
            {h.label}
          </span>
        ))}
      </div>

      <style>{`
        @keyframes tl-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
