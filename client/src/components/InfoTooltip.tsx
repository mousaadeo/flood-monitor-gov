/*
 * InfoTooltip.tsx — Unified Explanatory Tooltip Component
 * Design: Techno-Geospatial Command Center
 * Used to explain every metric and indicator across the platform
 */
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface TooltipContent {
  title: string;           // Indicator name
  value?: string;          // Current value
  description: string;     // Indicator description
  source?: string;         // Data source
  normalRange?: string;    // Normal range
  unit?: string;           // Unit
  updateFreq?: string;     // Update frequency
  color?: string;          // Accent color
}

interface InfoTooltipProps {
  content: TooltipContent;
  children?: React.ReactNode;
  size?: 'sm' | 'md';
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

export default function InfoTooltip({ content, children, size = 'sm', position = 'auto' }: InfoTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0, placement: 'top' as string });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const show = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const ttW = 280, ttH = 180;

    let placement = position === 'auto' ? 'top' : position;
    if (position === 'auto') {
      if (rect.top < ttH + 20) placement = 'bottom';
      else if (rect.bottom > vh - ttH - 20) placement = 'top';
      if (rect.left < ttW / 2) placement = 'right';
      else if (rect.right > vw - ttW / 2) placement = 'left';
    }

    let x = rect.left + rect.width / 2;
    let y = rect.top;
    if (placement === 'bottom') y = rect.bottom + 8;
    else if (placement === 'top') y = rect.top - 8;
    else if (placement === 'right') { x = rect.right + 8; y = rect.top + rect.height / 2; }
    else if (placement === 'left') { x = rect.left - 8; y = rect.top + rect.height / 2; }

    setCoords({ x, y, placement });
    setVisible(true);
  };

  useEffect(() => {
    if (!visible) return;
    const hide = () => setVisible(false);
    document.addEventListener('scroll', hide, true);
    return () => document.removeEventListener('scroll', hide, true);
  }, [visible]);

  const accentColor = content.color || '#00D4FF';

  const tooltipEl = visible ? (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        zIndex: 99999,
        width: 280,
        left: coords.placement === 'right' ? coords.x : coords.placement === 'left' ? coords.x - 280 : coords.x - 140,
        top: coords.placement === 'top' ? coords.y - 8 : coords.placement === 'bottom' ? coords.y : coords.y - 90,
        transform: coords.placement === 'top' ? 'translateY(-100%)' : coords.placement === 'bottom' ? 'translateY(0)' : 'translateY(-50%)',
        background: 'linear-gradient(135deg, rgba(13,18,32,0.98), rgba(10,14,26,0.98))',
        border: `1px solid ${accentColor}40`,
        borderRadius: 10,
        padding: '12px 14px',
        boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${accentColor}20`,
        backdropFilter: 'blur(12px)',
        pointerEvents: 'none',
        fontFamily: 'Space Grotesk, sans-serif',
        direction: 'ltr',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, borderBottom: `1px solid ${accentColor}25`, paddingBottom: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor, flexShrink: 0, boxShadow: `0 0 6px ${accentColor}` }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: accentColor }}>{content.title}</span>
        {content.unit && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>({content.unit})</span>}
      </div>

      {/* Current value */}
      {content.value && (
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 6, fontFamily: 'Space Grotesk, sans-serif' }}>
          {content.value}
        </div>
      )}

      {/* Description */}
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: 8 }}>
        {content.description}
      </p>

      {/* Meta grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
        {content.normalRange && (
          <div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 1 }}>Normal Range</div>
            <div style={{ fontSize: 10, color: '#10B981', fontWeight: 600 }}>{content.normalRange}</div>
          </div>
        )}
        {content.updateFreq && (
          <div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 1 }}>Update Freq.</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{content.updateFreq}</div>
          </div>
        )}
        {content.source && (
          <div style={{ gridColumn: '1 / -1', marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 1 }}>Source</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>📡 {content.source}</div>
          </div>
        )}
      </div>

      {/* Arrow */}
      <div style={{
        position: 'absolute',
        width: 8, height: 8,
        background: 'rgba(13,18,32,0.98)',
        border: `1px solid ${accentColor}40`,
        transform: 'rotate(45deg)',
        ...(coords.placement === 'top' ? { bottom: -5, left: '50%', marginLeft: -4, borderTop: 'none', borderRight: 'none' } :
          coords.placement === 'bottom' ? { top: -5, left: '50%', marginLeft: -4, borderBottom: 'none', borderLeft: 'none' } :
          coords.placement === 'right' ? { left: -5, top: '50%', marginTop: -4, borderRight: 'none', borderTop: 'none' } :
          { right: -5, top: '50%', marginTop: -4, borderLeft: 'none', borderBottom: 'none' }),
      }} />
    </div>
  ) : null;

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={() => setVisible(false)}
        style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help' }}
      >
        {children || (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: size === 'sm' ? 14 : 16,
            height: size === 'sm' ? 14 : 16,
            borderRadius: '50%',
            background: `${accentColor}20`,
            border: `1px solid ${accentColor}50`,
            color: accentColor,
            fontSize: size === 'sm' ? 8 : 10,
            fontWeight: 800,
            lineHeight: 1,
            flexShrink: 0,
            marginRight: 4,
          }}>?</span>
        )}
      </span>
      {typeof document !== 'undefined' && createPortal(tooltipEl, document.body)}
    </>
  );
}

// ─── Pre-defined tooltip contents for all indicators ─────────────────────────
export const TOOLTIPS = {
  // Dashboard
  aiAccuracy: {
    title: 'AI Model Accuracy',
    unit: '%',
    description: 'Accuracy rate of the GeoAI U-Net model in classifying flood cells compared to ground-truth data. Calculated using F1-Score on an independent test dataset.',
    source: 'GeoAI U-Net — Sentinel-1 SAR',
    normalRange: '85% — 95%',
    updateFreq: 'Each model update',
    color: '#00D4FF',
  },
  activeSatellites: {
    title: 'Active Satellites',
    unit: 'satellites',
    description: 'Number of satellites currently covering Abu Dhabi Emirate and transmitting active data. Includes SAR, optical, and precipitation measurement satellites.',
    source: 'ICEYE + Sentinel-1 + GPM + MODIS + PlanetScope',
    normalRange: '4 — 8 satellites',
    updateFreq: 'Continuous',
    color: '#8B5CF6',
  },
  totalFloodArea: {
    title: 'Total Water Accumulation Area',
    unit: 'thousand m²',
    description: 'Total area observed by satellites where water depth exceeds 5 cm. Calculated by summing all cells classified as "wet" or "inundated".',
    source: 'Sentinel-1 SAR + GeoAI Classification',
    normalRange: '0 — 500 thousand m²',
    updateFreq: 'Every 6–12 hours',
    color: '#06B6D4',
  },
  activeAlerts: {
    title: 'Active Critical Alerts',
    unit: 'alerts',
    description: 'Number of "critical" or "warning" level alerts automatically issued by AI models when predefined risk thresholds are exceeded.',
    source: 'FloodSat AI Early Warning System',
    normalRange: '0 — 2 alerts',
    updateFreq: 'Immediate on event',
    color: '#EF4444',
  },
  floodRiskIndex: {
    title: 'Flood Risk Index',
    unit: '%',
    description: 'Composite index combining: expected rainfall (40%) + groundwater level (20%) + soil saturation (20%) + drainage network capacity (20%). 0% = fully safe, 100% = catastrophic risk.',
    source: 'Open-Meteo API + LSTM Predictive Model',
    normalRange: '0% — 25% (normal)',
    updateFreq: 'Every 10 minutes',
    color: '#F59E0B',
  },
  precipitation: {
    title: 'Precipitation Rate',
    unit: 'mm/hr',
    description: 'Current rainfall rate in millimeters per hour. Zero means no rain. 1–5 mm/hr = light rain. 5–15 = moderate. Over 15 = heavy and dangerous in Abu Dhabi.',
    source: 'Open-Meteo Forecast API (WMO Standard)',
    normalRange: '0 — 2 mm/hr',
    updateFreq: 'Every 10 minutes',
    color: '#3B82F6',
  },
  precipitation24h: {
    title: 'Total Precipitation (24 hours)',
    unit: 'mm',
    description: 'Cumulative rainfall accumulated over the past 24 hours across all emirate regions. Used to assess water accumulation risk in low-lying areas.',
    source: 'Open-Meteo Forecast API',
    normalRange: '0 — 10 mm (normal for Abu Dhabi)',
    updateFreq: 'Every 10 minutes',
    color: '#06B6D4',
  },
  temperature: {
    title: 'Temperature',
    unit: '°C',
    description: 'Average current temperature for Abu Dhabi Emirate. Temperature affects evaporation rate and thus the speed at which accumulated rainwater drains.',
    source: 'Open-Meteo Forecast API',
    normalRange: '20°C — 45°C',
    updateFreq: 'Every 10 minutes',
    color: '#F97316',
  },
  windSpeed: {
    title: 'Wind Speed',
    unit: 'km/h',
    description: 'Current wind speed. Strong winds (>40 km/h) accelerate water accumulation in low-lying areas and increase coastal wave heights.',
    source: 'Open-Meteo Forecast API',
    normalRange: '5 — 30 km/h',
    updateFreq: 'Every 10 minutes',
    color: '#8B5CF6',
  },
  humidity: {
    title: 'Relative Humidity',
    unit: '%',
    description: 'Moisture percentage in the air. High humidity (>80%) indicates soil saturation and reduced absorption capacity, increasing surface water accumulation risk.',
    source: 'Open-Meteo Forecast API',
    normalRange: '30% — 70%',
    updateFreq: 'Every 10 minutes',
    color: '#06B6D4',
  },
  // Satellites
  sarResolution: {
    title: 'SAR Spatial Resolution',
    unit: 'meters',
    description: 'The smallest object the radar can distinguish on the ground surface. 1m resolution means the ability to detect a water pool the size of a single car. Lower number = higher resolution.',
    source: 'ICEYE X-SAR Constellation',
    normalRange: '1m — 20m',
    updateFreq: 'Each satellite pass',
    color: '#00D4FF',
  },
  revisitTime: {
    title: 'Revisit Time',
    unit: 'hours',
    description: 'Time for a satellite to return and re-image the same area. Shorter revisit times mean more frequent monitoring, which is more valuable during emergencies.',
    source: 'Satellite Specifications',
    normalRange: '6 — 24 hours',
    updateFreq: 'Fixed',
    color: '#F59E0B',
  },
  sarPenetration: {
    title: 'Cloud Penetration (SAR)',
    unit: '%',
    description: 'SAR radar ability to penetrate clouds, rain, and darkness for clear imagery. Unlike optical cameras, SAR operates in all weather conditions at 100% effectiveness.',
    source: 'Synthetic Aperture Radar Property',
    normalRange: '100% always',
    updateFreq: 'Fixed',
    color: '#10B981',
  },
  // AI Models
  f1Score: {
    title: 'F1-Score',
    unit: '%',
    description: 'Unified metric combining Precision and Recall into a single number. Used to evaluate flood classification model quality. 100% = perfect classification with no errors.',
    source: 'Model evaluation on independent test data',
    normalRange: '80% — 95%',
    updateFreq: 'Each model update',
    color: '#10B981',
  },
  iouScore: {
    title: 'IoU Score (Intersection over Union)',
    unit: '%',
    description: 'Measures how well the model-predicted flood area overlaps with the actual flood area. 85% means 85% of the predicted area is correct.',
    source: 'Semantic segmentation model evaluation',
    normalRange: '70% — 90%',
    updateFreq: 'Each model update',
    color: '#8B5CF6',
  },
  responseTime: {
    title: 'Response Time',
    unit: 'minutes',
    description: 'Time from receiving a satellite image to automatically issuing a flood alert. Includes: image processing + model inference + alert dispatch.',
    source: 'Actual system performance measurement',
    normalRange: '3 — 15 minutes',
    updateFreq: 'Continuous',
    color: '#F59E0B',
  },
  // DEM
  elevationValue: {
    title: 'Elevation Above Sea Level',
    unit: 'meters',
    description: 'Height of a ground point above mean sea level. Areas at 0–5m elevation are most susceptible to rainwater accumulation and coastal flooding in Abu Dhabi.',
    source: 'SRTM / ASTER DEM — NASA/METI',
    normalRange: '0m — 300m (Abu Dhabi)',
    updateFreq: 'Fixed (historical data)',
    color: '#10B981',
  },
  floodRiskCell: {
    title: 'Cell Risk Index',
    unit: '%',
    description: 'Probability of water accumulation in this cell (12m × 12m) based on: elevation + terrain slope + proximity to drainage channels + expected rainfall.',
    source: 'Local hydrological model + DEM',
    normalRange: '0% — 30% (normal)',
    updateFreq: 'With each rainfall update',
    color: '#EF4444',
  },
  // Simulation
  criticalCells: {
    title: 'Critical Cells',
    unit: 'cells',
    description: 'Number of grid cells (each 12m × 12m) where water depth exceeds 50 cm — the critical threshold posing danger to lives and vehicles per FEMA standards.',
    source: 'Internal hydrological simulation model',
    normalRange: '0 — 5 cells (safe)',
    updateFreq: 'Each simulation run',
    color: '#EF4444',
  },
  maxWaterDepth: {
    title: 'Maximum Water Depth',
    unit: 'meters',
    description: 'Deepest water accumulation point in the grid during the simulation period. 0.15m = pedestrian hazard. 0.30m = small vehicle hazard. 0.60m = all vehicle hazard.',
    source: 'Hydrological simulation model',
    normalRange: '0 — 0.15m (safe)',
    updateFreq: 'Each simulation run',
    color: '#F59E0B',
  },
  floodedArea: {
    title: 'Inundated Area',
    unit: 'km²',
    description: 'Total area where water depth exceeds 5 cm at the end of the simulation period. Calculated by multiplying inundated cells × 144 m² (each 12m × 12m cell area).',
    source: 'Hydrological simulation model',
    normalRange: '0 — 0.5 km² (low)',
    updateFreq: 'Each simulation run',
    color: '#8B5CF6',
  },
  affectedPopulation: {
    title: 'At-Risk Population',
    unit: 'persons',
    description: 'Estimated number of residents in inundated areas based on Abu Dhabi population density data. Used to prioritize evacuation and emergency response.',
    source: 'Abu Dhabi Statistics Centre 2024 + Simulation Model',
    normalRange: '0 — 500 persons (low)',
    updateFreq: 'Each simulation run',
    color: '#06B6D4',
  },
  roadsClosed: {
    title: 'Roads Closed',
    unit: 'roads',
    description: 'Number of major roads where water depth exceeds 15 cm — the threshold at which the Roads and Transport Authority recommends road closure for vehicle safety.',
    source: 'AASHTO Standards + Simulation Model',
    normalRange: '0 roads (safe)',
    updateFreq: 'Each simulation run',
    color: '#F97316',
  },
  responseWindow: {
    title: 'Response Window',
    unit: 'hours',
    description: 'Time available from event start until water reaches critical danger level. This is the time window available for evacuation and emergency response before it is too late.',
    source: 'Hydrological simulation model + UNDRR',
    normalRange: 'More than 6 hours (sufficient)',
    updateFreq: 'Each simulation run',
    color: '#10B981',
  },
  estimatedDamage: {
    title: 'Estimated Economic Losses',
    unit: 'million USD',
    description: 'Estimated total material losses based on FEMA Hazus-MH model and Swiss Re data for the Gulf region. Includes: infrastructure + residential buildings + indirect economic losses.',
    source: 'FEMA Hazus-MH + Swiss Re 2024',
    normalRange: 'Varies by severity',
    updateFreq: 'Each simulation run',
    color: '#EF4444',
  },
  // Heatmap
  heatIntensity: {
    title: 'Heatmap Intensity',
    unit: 'relative',
    description: 'Color gradient expressing water accumulation density in the area. Red/Orange = dense accumulation. Yellow = moderate. Blue = light. Calculated from real rainfall data per region.',
    source: 'Open-Meteo API + Water Distribution Algorithm',
    normalRange: 'Blue — Yellow (normal)',
    updateFreq: 'Every 10 minutes',
    color: '#F97316',
  },
  roadImpact: {
    title: 'Flood Impact on Road',
    unit: 'level',
    description: 'Assessment of water accumulation impact on road safety: ✅ Open (< 5cm) | ⚠️ Warning (5–15cm) | ⛔ Closed (15–50cm) | 🚫 Impassable (> 50cm). Per AASHTO standards.',
    source: 'AASHTO Standards + Simulation Model',
    normalRange: 'Open (normal)',
    updateFreq: 'Each update',
    color: '#F59E0B',
  },
} as const;
