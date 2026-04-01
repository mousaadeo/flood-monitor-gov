/**
 * WaterLegend — FastFlood-style water depth legend
 *
 * Displays a blue gradient depth scale matching the FastFlood reference:
 * 0 m (transparent) → 0.1 m (light blue) → 0.25 m → 0.5 m → 1 m → 2–5 m (navy)
 *
 * Uses waterStandard.ts as single source of truth.
 */

import React from 'react';
import { getWaterLegend, type WaterLevel } from '@shared/waterStandard';

interface WaterLegendProps {
  lang?: 'ar' | 'en';
  compact?: boolean;       // compact mode for map overlay
  showDepth?: boolean;     // show depth labels
  showIcon?: boolean;      // show level icons (compact only)
  className?: string;
  style?: React.CSSProperties;
}

export function WaterLegend({
  lang = 'ar',
  compact = false,
  showDepth = true,
  showIcon = false,
  className,
  style,
}: WaterLegendProps) {
  const allItems = getWaterLegend(lang);
  // Filter out 'none' for the gradient display
  const items = allItems.filter(i => i.level !== 'none');
  const isRtl = lang === 'ar';

  if (compact) {
    // ── Compact mode: FastFlood gradient bar for map overlay ──────────────
    return (
      <div
        className={className}
        style={{
          padding: '8px 10px',
          background: 'rgba(5,12,35,0.88)',
          border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: '6px',
          backdropFilter: 'blur(8px)',
          direction: isRtl ? 'rtl' : 'ltr',
          minWidth: '140px',
          ...style,
        }}
      >
        {/* Title */}
        <div style={{
          fontSize: '9px',
          fontWeight: 700,
          color: 'rgba(148,163,184,0.85)',
          letterSpacing: '0.08em',
          fontFamily: 'Tajawal, sans-serif',
          marginBottom: '6px',
          textTransform: 'uppercase',
        }}>
          {lang === 'ar' ? 'عمق المياه' : 'Water Depth'}
        </div>

        {/* Gradient bar */}
        <div style={{
          width: '100%',
          height: '10px',
          borderRadius: '5px',
          background: `linear-gradient(${isRtl ? 'to left' : 'to right'},
            rgba(219,234,254,0.28),
            rgba(147,197,253,0.42),
            rgba(59,130,246,0.52),
            rgba(29,78,216,0.62),
            rgba(30,58,138,0.75)
          )`,
          marginBottom: '4px',
          border: '1px solid rgba(59,130,246,0.2)',
        }} />

        {/* Depth labels */}
        {showDepth && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '6px',
          }}>
            {['0.1m', '0.25m', '0.5m', '1m', '5m'].map(d => (
              <span key={d} style={{
                fontSize: '7px',
                color: 'rgba(148,163,184,0.7)',
                fontFamily: 'monospace',
              }}>{d}</span>
            ))}
          </div>
        )}

        {/* Level rows */}
        {items.map(item => (
          <div
            key={item.level}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '2px',
              direction: isRtl ? 'rtl' : 'ltr',
            }}
          >
            {/* Color swatch — square for FastFlood style */}
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              background: item.mapFill,
              flexShrink: 0,
            }} />

            {/* Label */}
            <span style={{
              fontSize: '9px',
              color: 'rgba(203,213,225,0.9)',
              fontFamily: 'Tajawal, sans-serif',
              flex: 1,
              whiteSpace: 'nowrap',
            }}>
              {item.shortLabel}
            </span>

            {/* Depth label */}
            {showDepth && (
              <span style={{
                fontSize: '8px',
                color: 'rgba(147,197,253,0.75)',
                fontFamily: 'monospace',
                flexShrink: 0,
              }}>
                {item.depthLabel}
              </span>
            )}
          </div>
        ))}

        {/* Source note */}
        <div style={{
          marginTop: '5px',
          fontSize: '7px',
          color: 'rgba(100,116,139,0.6)',
          fontFamily: 'Tajawal, sans-serif',
          borderTop: '1px solid rgba(100,116,139,0.15)',
          paddingTop: '4px',
        }}>
          {lang === 'ar' ? 'ERA5 · GloFAS · DEM' : 'ERA5 · GloFAS · DEM'}
        </div>
      </div>
    );
  }

  // ── Full mode: FastFlood gradient scale for dashboard / glossary ──────────
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        direction: isRtl ? 'rtl' : 'ltr',
        ...style,
      }}
    >
      {/* Header */}
      <div style={{
        fontSize: '11px',
        fontWeight: 700,
        color: 'rgba(148,163,184,0.9)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        fontFamily: 'Tajawal, sans-serif',
        marginBottom: '4px',
      }}>
        {lang === 'ar' ? 'مقياس عمق المياه (FastFlood)' : 'Water Depth Scale (FastFlood)'}
      </div>

      {/* Gradient bar — full width */}
      <div style={{
        width: '100%',
        height: '16px',
        borderRadius: '8px',
        background: `linear-gradient(${isRtl ? 'to left' : 'to right'},
          rgba(219,234,254,0.28),
          rgba(147,197,253,0.42),
          rgba(59,130,246,0.52),
          rgba(29,78,216,0.62),
          rgba(30,58,138,0.75)
        )`,
        border: '1px solid rgba(59,130,246,0.25)',
        marginBottom: '4px',
      }} />

      {/* Depth markers */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '8px',
        paddingInline: '2px',
      }}>
        {['0 m', '0.1 m', '0.25 m', '0.5 m', '1 m', '2–5 m'].map(d => (
          <span key={d} style={{
            fontSize: '8px',
            color: 'rgba(147,197,253,0.8)',
            fontFamily: 'monospace',
          }}>{d}</span>
        ))}
      </div>

      {/* Level rows */}
      {items.map(item => (
        <div
          key={item.level}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '5px 8px',
            borderRadius: '4px',
            background: item.mapFill,
            border: `1px solid ${item.mapStroke}`,
          }}
        >
          {/* Color swatch */}
          <div style={{
            width: '14px',
            height: '14px',
            borderRadius: '3px',
            background: item.hex || item.color,
            flexShrink: 0,
          }} />

          {/* Label + depth */}
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: item.color,
              fontFamily: 'Tajawal, sans-serif',
            }}>
              {item.label}
            </div>
            {showDepth && (
              <div style={{
                fontSize: '9px',
                color: 'rgba(147,197,253,0.7)',
                fontFamily: 'monospace',
                marginTop: '1px',
              }}>
                {item.depthLabel}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Source */}
      <div style={{
        fontSize: '9px',
        color: 'rgba(100,116,139,0.6)',
        fontFamily: 'Tajawal, sans-serif',
        marginTop: '4px',
      }}>
        {lang === 'ar'
          ? 'المصدر: ERA5 · GloFAS Flood API · تحليل التضاريس (DEM)'
          : 'Source: ERA5 · GloFAS Flood API · DEM Topographic Analysis'}
      </div>
    </div>
  );
}

export default WaterLegend;
