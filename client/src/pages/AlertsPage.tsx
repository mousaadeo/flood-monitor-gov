// AlertsPage.tsx — FloodSat AI Abu Dhabi v3.0
// Design: "Geological Strata" — Dark field operations interface
import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/useMobile';
import { useLanguage } from '@/contexts/LanguageContext';
import { alerts as staticAlerts, alertLevelConfig, type AlertLevel } from '@/data/mockData';
import { useRealWeather } from '@/hooks/useRealWeather';
import { useDataMode } from '@/contexts/DataModeContext';
import {
  Bell, AlertTriangle, Clock, Satellite, TrendingUp, Droplets,
  MapPin, X, Shield, Radio, Navigation, Thermometer, Wind,
  ChevronRight, ExternalLink, Activity, FileDown,
} from 'lucide-react';
import InfoTooltip from '@/components/InfoTooltip';
import HistoricalReplay from '@/components/HistoricalReplay';

const ALERT_TOOLTIPS = {
  pageTitle: {
    title: 'Early Warning System',
    description: 'Views all warnings and alerts issued for Abu Dhabi Emirate regions. Each alert includes: affected area, risk level, data source, and forecast confidence percentage.',
    source: 'Models AI + Data Satellites + Open-Meteo',
    normalRange: '0 critical alerts (normal status)',
    updateFreq: 'Immediate (< 8 minutes)',
    color: '#FF6B35',
  },
  confidence: {
    title: 'Forecast Confidence Percentage',
    description: 'Percentage (0-100%) expressing the AI model confidence level in this alert. Calculated from: input data quality × model accuracy × historical data match.',
    source: 'Models GeoAI + LSTM',
    normalRange: '> 85% for critical alerts',
    updateFreq: 'Calculated with each alert',
    color: '#42A5F5',
  },
  earlyWarning: {
    title: 'How the Early Warning System Works',
    description: 'Three phases: (1) Satellite monitoring with SAR and GPM satellites every 30 minutes. (2) AI analysis During < 8 minutes. (3) Automatic alerts sent 6-24 hours before flood peak.',
    source: 'Models AI + Satellites + Open-Meteo',
    normalRange: 'Early warning 6-24 hours ahead',
    updateFreq: 'All 30 minute',
    color: '#4DD0E1',
  },
};

const GEO = {
  bgCard:    'rgba(21,34,51,0.88)',
  bgDeep:    'rgba(13,27,42,0.97)',
  border:    'rgba(66,165,245,0.12)',
  blue:      '#42A5F5',
  teal:      '#4DD0E1',
  green:     '#43A047',
  red:       '#FF6B35',
  text:      '#E8F4F8',
  textSub:   '#90CAF9',
  textMuted: '#546E7A',
  fontHead:  'Playfair Display, Georgia, serif',
  fontMono:  'Space Mono, Courier New, monospace',
  fontAr:    'Noto Naskh Arabic, serif',
};

// Additional data for each alert (location, weather, details)
const ALERT_DETAILS: Record<string, {
  lat: number; lng: number;
  elevation: string;
  waterDepth: string;
  affectedArea: string;
  affectedPop: string;
  windSpeed: string;
  temperature: string;
  humidity: string;
  satellite: string;
  passTime: string;
  resolution: string;
  responseTeam: string;
  estimatedPeak: string;
  historicalNote: string;
}> = {
  'alert-1': {
    // Ghayathi — Al Dhafra Region (correct coordinates: 23.8340°N, 52.8050°E)
    lat: 23.8340, lng: 52.8050,
    elevation: '85 m above sea level',
    waterDepth: '2.4 meter',
    affectedArea: '12.3 km²',
    affectedPop: '~18,500 persons',
    windSpeed: '28 km/hr (North East)',
    temperature: '22.4°C',
    humidity: '78%',
    satellite: 'ICEYE-X27 (SAR C-Band)',
    passTime: '04:07 UTC',
    resolution: '1 meter × 1 meter',
    responseTeam: 'Civil Defense Team — Al Dhafra Region',
    estimatedPeak: '08:30 UTC (During 4.5 hour)',
    historicalNote: 'Ghayathi recorded a similar flood in April 2024 — NCM highest reading in Abu Dhabi Emirate at 91 mm',
  },
  'alert-2': {
    // Al Wathba — Abu Dhabi Emirate (correct coordinates: 24.2600°N, 54.6100°E)
    lat: 24.2600, lng: 54.6100,
    elevation: '5 m above sea level',
    waterDepth: 'Forecast 0.3–0.8 meters',
    affectedArea: '~45 km² (low-lying areas)',
    affectedPop: '~85,000 persons',
    windSpeed: '15 km/hr (North West)',
    temperature: '24.1°C',
    humidity: '65%',
    satellite: 'GPM IMERG + Model LSTM',
    passTime: '04:12 UTC',
    resolution: '10 km × 10 km (GPM)',
    responseTeam: 'Emergency Management Center — Abu Dhabi',
    estimatedPeak: '10:00–12:00 UTC',
    historicalNote: 'Al Wathba low-lying areas — NCM station recorded 88.2 mm (3rd highest UAE-wide)',
  },
  'alert-3': {
    // Mohammed Bin Zayed City — Abu Dhabi (correct coordinates: 24.3500°N, 54.5200°E)
    lat: 24.3500, lng: 54.5200,
    elevation: '8 m above sea level',
    waterDepth: '0.15–0.45 meter (Roads)',
    affectedArea: '8.7 km²',
    affectedPop: '~32,000 persons',
    windSpeed: '12 km/hr (West)',
    temperature: '23.8°C',
    humidity: '70%',
    satellite: 'Sentinel-1A (SAR C-Band)',
    passTime: '04:09 UTC',
    resolution: '5 meter × 5 meter',
    responseTeam: 'Abu Dhabi Police — Traffic Department',
    estimatedPeak: '09:00 UTC',
    historicalNote: 'Khalifa bin Zayed Street and E11 intersection are frequent accumulation points',
  },
  'alert-4': {
    // Al Ruwais — Al Dhafra Region (correct coordinates: 24.1100°N, 52.7300°E)
    lat: 24.1100, lng: 52.7300,
    elevation: '3 m above sea level',
    waterDepth: '0.05–0.20 meter',
    affectedArea: '3.2 km²',
    affectedPop: '~8,000 persons',
    windSpeed: '18 km/hr (North)',
    temperature: '23.5°C',
    humidity: '72%',
    satellite: 'MODIS NRT + GPM IMERG',
    passTime: '04:05 UTC',
    resolution: '250 m × 250 m',
    responseTeam: 'ADNOC Emergency Response — Al Ruwais Industrial',
    estimatedPeak: 'Continuous monitoring',
    historicalNote: 'Al Ruwais industrial zone — NCM station 75.7 mm (5th highest UAE) — impact on petrochemical facilities',
  },
  'alert-5': {
    // Al Ain City — Al Ain Region (correct coordinates: 24.2075°N, 55.7447°E)
    lat: 24.2075, lng: 55.7447,
    elevation: '280 m above sea level',
    waterDepth: 'Receding to 0.3 meters',
    affectedArea: '28.4 km²',
    affectedPop: '~766,000 persons',
    windSpeed: '22 km/hr (South East)',
    temperature: '26.2°C',
    humidity: '45%',
    satellite: 'GPM IMERG + NCM Radar',
    passTime: '04:02 UTC',
    resolution: '10 km × 10 km (GPM)',
    responseTeam: 'Al Ain Civil Defense — Emergency Operations',
    estimatedPeak: 'Continuous monitoring — storm moving east',
    historicalNote: 'Wadi Al Jimi in Al Ain recorded a similar flood in April 2024 with depth 3.1 meters',
  },
  'alert-6': {
    // Khalifa City — Abu Dhabi Emirate (correct coordinates: 24.4050°N, 54.5500°E)
    lat: 24.4050, lng: 54.5500,
    elevation: '12 m above sea level',
    waterDepth: '0.10–0.35 meter',
    affectedArea: '4.8 km²',
    affectedPop: '~180,000 persons',
    windSpeed: '14 km/hr (North West)',
    temperature: '23.9°C',
    humidity: '68%',
    satellite: 'Sentinel-1A (SAR C-Band)',
    passTime: '04:18 UTC',
    resolution: '5 meter × 5 meter',
    responseTeam: 'Abu Dhabi Municipality — Khalifa City Operations',
    estimatedPeak: '09:30–11:00 UTC',
    historicalNote: 'Khalifa City A main roads prone to water accumulation — similar event in March 2024',
  },
};

// Small map with OpenStreetMap static — adaptive bbox based on region type
function MiniMap({ lat, lng, color, alertId }: { lat: number; lng: number; color: string; alertId?: string }) {
  // Adaptive bbox: Al Dhafra regions need wider view, city regions need tighter
  const isAlDhafra = alertId === 'alert-1' || alertId === 'alert-4'; // Ghayathi, Ruwais
  const isAlAin = alertId === 'alert-5';
  const delta = isAlDhafra ? 0.18 : isAlAin ? 0.12 : 0.06;
  const deltaLat = delta * 0.75;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta},${lat - deltaLat},${lng + delta},${lat + deltaLat}&layer=mapnik&marker=${lat},${lng}`;
  return (
    <div style={{
      width: '100%', height: '180px', borderRadius: '8px', overflow: 'hidden',
      border: `1px solid ${color}40`, position: 'relative',
    }}>
      <iframe
        src={mapUrl}
        style={{ width: '100%', height: '100%', border: 'none', filter: 'invert(0.85) hue-rotate(180deg) brightness(0.9)' }}
        title="Alert Location"
        loading="lazy"
      />
      <div style={{
        position: 'absolute', bottom: '6px', right: '6px',
        background: 'rgba(13,27,42,0.9)', border: `1px solid ${color}50`,
        borderRadius: '4px', padding: '3px 8px',
        fontSize: '9px', fontFamily: GEO.fontMono, color: GEO.textSub,
      }}>
        {lat.toFixed(4)}°N · {lng.toFixed(4)}°E
      </div>
    </div>
  );
}

// Alert details popup
import type { Alert } from '@/data/mockData';

function AlertDetailPanel({
  alert: a,
  onClose,
}: {
  alert: Alert;
  onClose: () => void;
}) {
  const { lang } = useLanguage();
  const isMobile = useIsMobile();
  const cfg = alertLevelConfig[a.level as keyof typeof alertLevelConfig];
  const details = ALERT_DETAILS[a.id];

  const ts = new Date(a.timestamp);
  const dateStr = ts.toLocaleDateString('ar-AE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = ts.toLocaleTimeString('ar-AE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const utcStr = ts.toUTCString().split(' ').slice(0, 5).join(' ');

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(5,10,20,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: '760px', maxHeight: '90vh',
        background: GEO.bgDeep,
        borderRight: `1px solid ${cfg.color}40`,
        borderBottom: `1px solid ${cfg.color}40`,
        borderLeft: `1px solid ${cfg.color}40`,
        borderTop: `3px solid ${cfg.color}`,
        borderRadius: '8px',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 40px ${cfg.color}15`,
        direction: lang === 'ar' ? 'rtl' : 'ltr',
        fontFamily: GEO.fontAr,
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${cfg.color}25`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
          background: `linear-gradient(135deg, ${cfg.color}08 0%, transparent 60%)`,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <div style={{
                width: '32px', height: '32px', flexShrink: 0,
                background: `${cfg.color}18`, border: `1px solid ${cfg.color}40`,
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertTriangle size={14} style={{ color: cfg.color }} />
              </div>
              <span style={{ fontSize: '18px', fontWeight: 700, color: cfg.color }}>{a.regionAr}</span>
              <span style={{
                padding: '2px 10px', background: `${cfg.color}18`,
                color: cfg.color, border: `1px solid ${cfg.color}40`,
                fontSize: '10px', fontFamily: GEO.fontMono, fontWeight: 700, borderRadius: '2px',
              }}>{cfg.label}</span>
              <span style={{ fontSize: '10px', fontFamily: GEO.fontMono, color: GEO.textMuted }}>
                #{a.id.toUpperCase()}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: GEO.textSub, lineHeight: 1.6 }}>{a.message}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '6px', width: '32px', height: '32px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              color: GEO.textMuted, transition: 'all 0.15s',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Time and Date */}
          <div style={{
            background: 'rgba(66,165,245,0.06)', border: '1px solid rgba(66,165,245,0.15)',
            borderRadius: '8px', padding: '14px 16px',
          }}>
            <div style={{ fontSize: '10px', fontFamily: GEO.fontMono, color: GEO.blue, letterSpacing: '0.08em', marginBottom: '10px' }}>
              ⏱ Exact Timing
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '12px' }}>
              {[
                { label: 'Date', value: dateStr, icon: '📅' },
                { label: 'Time (UAE timezone)', value: timeStr, icon: '🕐' },
                { label: 'UTC', value: utcStr, icon: '🌐' },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '9px', color: GEO.textMuted, marginBottom: '4px' }}>{item.icon} {item.label}</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: GEO.text, fontFamily: GEO.fontMono, wordBreak: 'break-word' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Geographic Location + Map */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{
              background: 'rgba(77,208,225,0.05)', border: '1px solid rgba(77,208,225,0.15)',
              borderRadius: '8px', padding: '14px 16px',
            }}>
              <div style={{ fontSize: '10px', fontFamily: GEO.fontMono, color: GEO.teal, letterSpacing: '0.08em', marginBottom: '10px' }}>
                📍 Geographic Location
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { label: 'Region', value: a.regionAr },
                  { label: 'Latitude', value: `${details?.lat?.toFixed(4) ?? '—'}°N` },
                  { label: 'Longitude', value: `${details?.lng?.toFixed(4) ?? '—'}°E` },
                  { label: 'Elevation', value: details?.elevation ?? '—' },
                  { label: 'Affected Area', value: details?.affectedArea ?? '—' },
                  { label: 'affected population', value: details?.affectedPop ?? '—' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: GEO.textMuted }}>{item.label}</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: GEO.text, fontFamily: GEO.fontMono }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              {details && (
                <MiniMap lat={details.lat} lng={details.lng} color={cfg.color} alertId={a.id} />
              )}
              {details && (
                <a
                  href={`https://www.google.com/maps?q=${details.lat},${details.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                    marginTop: '8px', padding: '6px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px', textDecoration: 'none',
                    fontSize: '10px', color: GEO.textSub, fontFamily: GEO.fontMono,
                    transition: 'all 0.15s',
                  }}
                >
                  <ExternalLink size={10} /> open in Google Maps
                </a>
              )}
            </div>
          </div>

          {/* Data Weather */}
          <div style={{
            background: 'rgba(67,160,71,0.05)', border: '1px solid rgba(67,160,71,0.15)',
            borderRadius: '8px', padding: '14px 16px',
          }}>
            <div style={{ fontSize: '10px', fontFamily: GEO.fontMono, color: GEO.green, letterSpacing: '0.08em', marginBottom: '10px' }}>
              🌦 Current Weather Data
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '10px' }}>
              {[
                { label: 'Temperature', value: details?.temperature ?? '—', icon: <Thermometer size={12} style={{ color: '#FF6B35' }} /> },
                { label: 'Speed Wind', value: details?.windSpeed ?? '—', icon: <Wind size={12} style={{ color: GEO.teal }} /> },
                { label: 'Humidity', value: details?.humidity ?? '—', icon: <Droplets size={12} style={{ color: GEO.blue }} /> },
                { label: 'Water Depth', value: details?.waterDepth ?? '—', icon: <Activity size={12} style={{ color: cfg.color }} /> },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>{item.icon}</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: GEO.text, fontFamily: GEO.fontMono }}>{item.value}</div>
                  <div style={{ fontSize: '9px', color: GEO.textMuted, marginTop: '2px' }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Data source and satellite */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{
              background: 'rgba(255,107,53,0.05)', border: '1px solid rgba(255,107,53,0.15)',
              borderRadius: '8px', padding: '14px 16px',
            }}>
              <div style={{ fontSize: '10px', fontFamily: GEO.fontMono, color: GEO.red, letterSpacing: '0.08em', marginBottom: '10px' }}>
                🛰 Source Data
              </div>
              {[
                { label: 'Satellite / Model', value: details?.satellite ?? a.source },
                { label: 'Time Traffic', value: details?.passTime ?? '—' },
                { label: 'Image Accuracy', value: details?.resolution ?? '—' },
                { label: 'Percentage confidence', value: `${a.confidence}%` },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '5px', marginBottom: '5px' }}>
                  <span style={{ fontSize: '11px', color: GEO.textMuted }}>{item.label}</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: GEO.text, fontFamily: GEO.fontMono }}>{item.value}</span>
                </div>
              ))}
            </div>
            <div style={{
              background: 'rgba(66,165,245,0.05)', border: '1px solid rgba(66,165,245,0.15)',
              borderRadius: '8px', padding: '14px 16px',
            }}>
              <div style={{ fontSize: '10px', fontFamily: GEO.fontMono, color: GEO.blue, letterSpacing: '0.08em', marginBottom: '10px' }}>
                🚨 Response and Forecasts
              </div>
              {[
                { label: 'Team Response', value: details?.responseTeam ?? '—' },
                { label: 'Forecasted flood peak', value: details?.estimatedPeak ?? '—' },
              ].map(item => (
                <div key={item.label} style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '10px', color: GEO.textMuted, marginBottom: '3px' }}>{item.label}</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: GEO.text }}>{item.value}</div>
                </div>
              ))}
              {details?.historicalNote && (
                <div style={{
                  marginTop: '8px', padding: '8px 10px',
                  background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.2)',
                  borderRadius: '6px',
                }}>
                  <div style={{ fontSize: '9px', color: '#FFB300', fontFamily: GEO.fontMono, marginBottom: '3px' }}>📚 Historical note</div>
                  <div style={{ fontSize: '11px', color: GEO.textSub, lineHeight: 1.5 }}>{details.historicalNote}</div>
                </div>
              )}
            </div>
          </div>

          {/* Historical Replay — Hourly water volume & road impact */}
          {details && (
            <HistoricalReplay
              regionId={a.regionId}
              regionName={a.regionAr}
              lat={details.lat}
              lng={details.lng}
              areaSqKm={parseFloat(details.affectedArea) || 12}
              population={parseInt(details.affectedPop.replace(/[^0-9]/g, '')) || 18000}
              elevationM={parseInt(details.elevation) || 10}
              color={cfg.color}
              compact={true}
            />
          )}

          {/* Confidence bar */}
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px', padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: GEO.textMuted }}>confidence level for this alert</span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: cfg.color, fontFamily: GEO.fontMono }}>{a.confidence}%</span>
            </div>
            <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '4px',
                width: `${a.confidence}%`,
                background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}88)`,
                boxShadow: `0 0 12px ${cfg.color}66`,
                transition: 'width 0.8s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
              <span style={{ fontSize: '9px', color: GEO.textMuted, fontFamily: GEO.fontMono }}>0%</span>
              <span style={{ fontSize: '9px', color: GEO.textMuted, fontFamily: GEO.fontMono }}>50%</span>
              <span style={{ fontSize: '9px', color: GEO.textMuted, fontFamily: GEO.fontMono }}>100%</span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: `1px solid ${cfg.color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.02)',
        }}>
          <span style={{ fontSize: '10px', color: GEO.textMuted, fontFamily: GEO.fontMono }}>
            ID: {a.id.toUpperCase()} · {a.source}
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px', background: `${cfg.color}15`,
              border: `1px solid ${cfg.color}40`, borderRadius: '4px',
              color: cfg.color, fontSize: '11px', fontFamily: GEO.fontMono,
              cursor: 'pointer', fontWeight: 700,
            }}
          >
            Closure
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<AlertLevel | 'all'>('all');
  const [selectedAlert, setSelectedAlert] = useState<typeof staticAlerts[0] | null>(null);
  const { data: liveData } = useRealWeather();
  const { snapshot, mode } = useDataMode();
  const isArchiveMode = mode === 'archive';

  // Generate dynamic alerts from live/archive weather data
  const dynamicAlerts = (() => {
    const regions = isArchiveMode ? snapshot.regions : (liveData?.regions ?? []);
    if (regions.length === 0) return staticAlerts;
    return regions
      .filter(r => r.alertLevel !== 'safe')
      .map((r) => ({
        id: `dynamic-${r.id}`,
        regionId: r.id,
        regionAr: r.nameAr,
        level: r.alertLevel as AlertLevel,
        message: `Rainfall ${r.currentPrecipitation} mm/hr — risk index ${r.floodRisk}%`,
        timestamp: r.lastUpdated,
        source: isArchiveMode ? 'Open-Meteo ERA5 + NCM' : 'Open-Meteo GFS + NCM',
        confidence: Math.min(95, 70 + r.floodRisk * 0.25),
      }));
  })();

  // Use dynamic alerts if available, otherwise fall back to static
  const alerts = dynamicAlerts.length > 0 ? dynamicAlerts : staticAlerts;
  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.level === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Details popup */}
      {selectedAlert && (
        <AlertDetailPanel alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      )}

      {/* Header */}
      <div style={{
        padding: '22px 24px',
        background: 'linear-gradient(135deg, rgba(13,27,42,0.95) 0%, rgba(21,34,51,0.90) 100%)',
        borderRight: `1px solid ${GEO.border}`,
        borderBottom: `1px solid ${GEO.border}`,
        borderLeft: `1px solid ${GEO.border}`,
        borderTop: `2px solid ${GEO.red}`,
        borderRadius: '4px',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
      }}>
        <div>
          <h1 style={{ fontFamily: GEO.fontHead, fontWeight: 700, fontSize: '1.6rem', color: GEO.text, lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: '8px' }}>
            alerts and warnings
            <InfoTooltip content={ALERT_TOOLTIPS.pageTitle} size="md" />
          </h1>
          <p style={{ color: GEO.textSub, fontSize: '11px', marginTop: '4px', fontFamily: GEO.fontMono, letterSpacing: '0.06em' }}>
            EARLY WARNING SYSTEM · AI-POWERED · REAL-TIME
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 14px',
          background: 'rgba(255,107,53,0.10)',
          border: '1px solid rgba(255,107,53,0.30)',
          borderRadius: '3px',
        }}>
          <Bell size={12} style={{ color: GEO.red }} className="animate-pulse" />
          <span style={{ fontSize: '12px', fontFamily: GEO.fontMono, fontWeight: 700, color: GEO.red }}>
            {alerts.filter(a => a.level === 'critical').length} CRITICAL
          </span>
        </div>
        <button
          onClick={() => window.print()}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 14px',
            background: 'rgba(139,92,246,0.10)',
            border: '1px solid rgba(139,92,246,0.30)',
            borderRadius: '3px',
            cursor: 'pointer',
            color: '#A78BFA',
            fontSize: '11px',
            fontFamily: GEO.fontMono,
            fontWeight: 600,
          }}
        >
          <FileDown size={11} />
          EXPORT PDF
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(['all', 'critical', 'warning', 'watch', 'safe'] as const).map(level => {
          const cfg = level === 'all' ? null : alertLevelConfig[level];
          const count = level === 'all' ? alerts.length : alerts.filter(a => a.level === level).length;
          const isActive = filter === level;
          const activeColor = cfg ? cfg.color : GEO.blue;
          return (
            <button
              key={level}
              onClick={() => setFilter(level)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 12px',
                background: isActive ? `${activeColor}12` : 'transparent',
                color: isActive ? activeColor : GEO.textMuted,
                border: `1px solid ${isActive ? activeColor + '40' : GEO.border}`,
                borderRadius: '2px',
                fontSize: '11px',
                fontFamily: GEO.fontMono,
                fontWeight: isActive ? 700 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {level === 'all' ? 'ALL' : cfg?.label}
              <span style={{ fontWeight: 700 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Alert list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.map(alert => {
          const cfg = alertLevelConfig[alert.level];
          return (
            <button
              key={alert.id}
              onClick={() => setSelectedAlert(alert)}
              style={{
                background: GEO.bgCard,
                borderTop: `1px solid ${cfg.color}20`,
                borderBottom: `1px solid ${cfg.color}20`,
                borderLeft: `1px solid ${cfg.color}20`,
                borderRight: `3px solid ${cfg.color}`,
                borderRadius: '4px',
                padding: '14px 16px',
                cursor: 'pointer',
                textAlign: 'right',
                transition: 'all 0.18s ease',
                width: '100%',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = `rgba(21,34,51,0.98)`;
                e.currentTarget.style.borderColor = `${cfg.color}50`;
                e.currentTarget.style.boxShadow = `0 4px 20px ${cfg.color}18`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = GEO.bgCard;
                e.currentTarget.style.borderColor = `${cfg.color}20`;
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{
                  width: '36px', height: '36px', flexShrink: 0,
                  background: `${cfg.color}15`,
                  border: `1px solid ${cfg.color}35`,
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AlertTriangle size={15} style={{ color: cfg.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <span style={{ fontFamily: GEO.fontAr, fontWeight: 700, fontSize: '13px', color: cfg.color }}>
                      {alert.regionAr}
                    </span>
                    <span style={{
                      padding: '1px 8px',
                      background: `${cfg.color}15`,
                      color: cfg.color,
                      border: `1px solid ${cfg.color}35`,
                      fontSize: '9px',
                      fontFamily: GEO.fontMono,
                      fontWeight: 700,
                      borderRadius: '2px',
                      letterSpacing: '0.05em',
                    }}>
                      {cfg.label}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', lineHeight: 1.6, marginBottom: '8px', color: GEO.textSub, fontFamily: GEO.fontAr }}>
                    {alert.message}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Satellite size={10} style={{ color: GEO.textMuted }} />
                      <span style={{ fontSize: '10px', color: GEO.textMuted, fontFamily: GEO.fontMono }}>{alert.source}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <TrendingUp size={10} style={{ color: cfg.color }} />
                      <span style={{ fontSize: '10px', fontFamily: GEO.fontMono, fontWeight: 700, color: cfg.color }}>
                        {alert.confidence}% CONF
                      </span>
                      <InfoTooltip content={ALERT_TOOLTIPS.confidence} size="sm" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Clock size={10} style={{ color: GEO.textMuted }} />
                      <span style={{ fontSize: '10px', color: GEO.textMuted, fontFamily: GEO.fontMono }}>
                        {new Date(alert.timestamp).toLocaleTimeString('ar-AE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: 'auto' }}>
                      <span style={{ fontSize: '9px', color: GEO.textMuted, fontFamily: GEO.fontMono }}>tap for details</span>
                      <ChevronRight size={10} style={{ color: GEO.textMuted }} />
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Early warning info */}
      <div style={{
        background: GEO.bgCard,
        borderRight: `1px solid ${GEO.border}`,
        borderBottom: `1px solid ${GEO.border}`,
        borderLeft: `1px solid ${GEO.border}`,
        borderTop: `2px solid ${GEO.blue}`,
        borderRadius: '4px',
        padding: '20px 24px',
      }}>
        <h2 style={{ fontFamily: GEO.fontHead, fontWeight: 600, fontSize: '1rem', color: GEO.blue, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          how the early how does the warning system work?
          <InfoTooltip content={ALERT_TOOLTIPS.earlyWarning} size="sm" />
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
          {[
            { step: '01', title: 'satellite monitoring', desc: 'SAR and GPM satellites collect data every 30 minutes, with full coverage of Abu Dhabi Emirate in all weather conditions.', color: GEO.blue, icon: Satellite },
            { step: '02', title: 'AI analysis', desc: 'GeoAI and LSTM models analyze data in under 8 minutes and identify danger zones with 92% accuracy.4%.', color: GEO.teal, icon: TrendingUp },
            { step: '03', title: 'Immediate Alert', desc: 'alerts are automatically sent to relevant authorities within minutes, enabling action 6-24 hours before flood peak.', color: GEO.green, icon: Droplets },
          ].map(item => (
            <div key={item.step} style={{ display: 'flex', gap: '12px' }}>
              <div style={{
                width: '32px', height: '32px', flexShrink: 0,
                background: `${item.color}15`,
                border: `1px solid ${item.color}35`,
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <item.icon size={13} style={{ color: item.color }} />
              </div>
              <div>
                <div style={{ fontSize: '9px', fontFamily: GEO.fontMono, color: item.color, letterSpacing: '0.08em', marginBottom: '3px' }}>
                  STEP {item.step}
                </div>
                <div style={{ fontSize: '13px', fontFamily: GEO.fontAr, fontWeight: 700, color: item.color, marginBottom: '4px' }}>
                  {item.title}
                </div>
                <p style={{ fontSize: '11px', lineHeight: 1.6, color: GEO.textSub, fontFamily: GEO.fontAr }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
