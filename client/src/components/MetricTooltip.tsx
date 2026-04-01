/*
 * MetricTooltip.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable "?" icon with a rich tooltip for KPI cards, charts, and section titles.
 * Lighter than NavTooltip — focused on metric definitions, formulas, and data sources.
 *
 * Usage:
 *   <MetricTooltip id="flood-risk-index" />
 *   <MetricTooltip id="precipitation-48h" size={10} position="bottom" />
 */

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';

// ─── Metric / Chart registry ───────────────────────────────────────────────────
export const METRIC_INFO: Record<string, {
  title: string;
  definition: string;
  formula?: string;
  range?: string;
  interpretation: string;
  source: string;
  updateFreq?: string;
}> = {

  // ── KPI Cards ─────────────────────────────────────────────────────────────
  'flood-risk-index': {
    title: 'Flood Risk Index (%)',
    definition: 'A composite index combining rainfall intensity, wind speed, temperature, and humidity to estimate water accumulation probability.',
    formula: 'Risk = (precip×0.5 + humidity×0.2 + wind×0.15 + temp×0.15) × region_factor',
    range: '0% (fully safe) — 100% (extreme risk)',
    interpretation: 'Below 30%: Safe | 30–60%: Warning | 60–80%: Danger | Above 80%: Critical',
    source: 'Open-Meteo ERA5 · Internal calculation',
    updateFreq: 'Every 10 minutes',
  },
  'avg-temperature': {
    title: 'Average Temperature (°C)',
    definition: 'Mean surface temperature at 2 m above ground level across Abu Dhabi Emirate.',
    range: '15°C (winter) — 50°C (summer)',
    interpretation: 'High temperatures increase evaporation and reduce flood risk; sudden cold with rain increases risk.',
    source: 'Open-Meteo ERA5 · 6 monitoring stations',
    updateFreq: 'Every hour',
  },
  'total-precipitation': {
    title: 'Total Precipitation (mm / 24 h)',
    definition: 'Cumulative rainfall accumulated over the past 24 hours across all emirate regions combined.',
    range: '0 mm (dry) — 200+ mm (severe flood)',
    interpretation: 'Below 10 mm: Normal | 10–25 mm: Warning | 25–50 mm: Danger | Above 50 mm: Emergency',
    source: 'Open-Meteo ERA5 · Copernicus CEMS',
    updateFreq: 'Every 10 minutes',
  },
  'active-alerts': {
    title: 'Active Alerts',
    definition: 'Number of currently active alerts classified as "critical" or "warning" that have not yet been closed.',
    range: '0 (no alerts) — unlimited',
    interpretation: 'Critical alerts (red) require immediate intervention; warnings (yellow) require continuous monitoring.',
    source: 'Internal alert rules engine',
    updateFreq: 'Real-time',
  },

  // ── Charts ────────────────────────────────────────────────────────────────
  'precipitation-48h': {
    title: 'Precipitation Chart — 48 Hours',
    definition: 'Displays actual precipitation (mm/hr) and rain probability (%) over the past 24 hours and the next 24 hours.',
    formula: 'Blue line = actual precipitation (mm) | Dashed yellow line = rain probability (%)',
    interpretation: 'High peaks indicate intense rainfall events. High yellow line with low precipitation means expected rain.',
    source: 'Open-Meteo ERA5 Reanalysis + Forecast',
    updateFreq: 'Every 10 minutes',
  },
  'flood-risk-7days': {
    title: 'Flood Risk Index — Last 7 Days',
    definition: 'Evolution of the composite risk index over the past week for each of the three emirate regions.',
    formula: 'Each point = average risk index for that hour of the day',
    interpretation: 'Green line (< 30%) safe | Yellow (30–60%) warning | Red (> 60%) danger',
    source: 'Internal calculation from Open-Meteo ERA5',
    updateFreq: 'Daily',
  },
  'alerts-status': {
    title: 'Alert Status',
    definition: 'List of currently active alerts sorted by priority — shows region, weather condition, and risk index.',
    interpretation: 'Alerts sorted in descending order of severity. Clicking any alert opens its full details.',
    source: 'Open-Meteo + Internal alert engine',
    updateFreq: 'Real-time',
  },

  // ── Map layers ────────────────────────────────────────────────────────────
  'flood-water-layer': {
    title: 'Water Accumulation Layer',
    definition: 'Continuous visualization of expected water accumulation areas based on current precipitation and elevation data.',
    formula: 'Water depth = (precipitation × runoff_coefficient) ÷ drainage_rate',
    range: 'Light blue (< 10 cm) ← Dark blue (> 1 m)',
    interpretation: 'Darker color means greater depth and higher risk.',
    source: 'Open-Meteo + SRTM DEM + OSM',
    updateFreq: 'Every 10 minutes',
  },
  'heat-density-layer': {
    title: 'Risk Density Layer (Heatmap)',
    definition: 'Heatmap displaying geographic concentration of the risk index — red areas are the highest risk hotspots.',
    interpretation: 'Warm colors (red/orange) indicate concentrated risk factors; cool colors (blue) indicate safer areas.',
    source: 'Composite Risk Index + Open-Meteo',
    updateFreq: 'Every 10 minutes',
  },
  'drainage-layer': {
    title: 'Drainage Network Layer',
    definition: 'Shows drainage station locations and their current load level — color reflects load percentage.',
    range: 'Green (< 60%) | Orange (60–80%) | Red (> 80%)',
    interpretation: 'Red stations are overloaded and may cause localized flooding.',
    source: 'Drainage station data + OSM',
    updateFreq: 'Every 30 minutes',
  },
  'contour-layer': {
    title: 'Contour Lines Layer',
    definition: 'Equal elevation lines — each line represents a fixed height above mean sea level.',
    interpretation: 'Closely spaced lines mean steep slope (fast flow); widely spaced mean flat terrain (potential accumulation).',
    source: 'SRTM 90m · Open-Meteo Elevation API',
    updateFreq: 'Fixed (topographic data)',
  },

  // ── DEM Page ──────────────────────────────────────────────────────────────
  'elevation-heatmap': {
    title: 'Elevation Heatmap',
    definition: 'Continuous color gradient reflecting the elevation of each point above sea level at ~10m × 10m resolution.',
    range: 'Dark blue (0–5m) ← Green (15–70m) ← Brown (120–350m) ← Grey (350m+)',
    interpretation: 'Blue areas are most susceptible to inundation during floods; brown/grey areas are safe.',
    source: 'SRTM 90m · Open-Meteo Elevation API',
    updateFreq: 'Fixed',
  },
  'elevation-stats': {
    title: 'Elevation Statistics',
    definition: 'Statistical summary of elevation distribution in the selected area: minimum, maximum, mean, and percentage of at-risk areas.',
    interpretation: 'Percentage of low-lying areas (< risk threshold) reflects the extent of area susceptible to inundation during a flood event.',
    source: 'SRTM 90m · Internal calculation',
    updateFreq: 'On region change',
  },
  'elevation-distribution': {
    title: 'Elevation Distribution (Bar Chart)',
    definition: 'Shows the number of cells (each ≈ 100m²) within each of the six elevation ranges.',
    interpretation: 'Tall bars in low elevation ranges mean larger at-risk area.',
    source: 'SRTM 90m · Internal calculation',
    updateFreq: 'On region change',
  },

  // ── Road Network ──────────────────────────────────────────────────────────
  'road-flood-risk': {
    title: 'Road Flood Risk Index (%)',
    definition: 'Percentage reflecting probability of road inundation based on its elevation, proximity to accumulation zones, and precipitation amount.',
    range: '0% (safe) — 100% (inundated)',
    interpretation: 'Below 30%: Passable | 30–60%: Warning | 60–80%: Danger | Above 80%: Closed',
    source: 'OSM + Open-Meteo + SRTM DEM',
    updateFreq: 'Every 10 minutes',
  },

  // ── Regions Analysis ──────────────────────────────────────────────────────
  'region-risk-comparison': {
    title: 'Risk Index Comparison by Region',
    definition: 'Comparison of the composite risk index between Abu Dhabi City, Al Ain, and Al Dhafra at the current time.',
    interpretation: 'The region with the highest index requires priority intervention and resource allocation.',
    source: 'Open-Meteo ERA5 · Internal calculation',
    updateFreq: 'Every 10 minutes',
  },
  'precipitation-trend': {
    title: 'Precipitation Trend',
    definition: 'General trend line of precipitation amounts over the specified period — shows whether rainfall is increasing or decreasing.',
    interpretation: 'Upward trend with high risk index requires early preparation.',
    source: 'Open-Meteo ERA5',
    updateFreq: 'Daily',
  },

  // ── Scenarios ─────────────────────────────────────────────────────────────
  'scenario-flood-area': {
    title: 'Expected Inundation Area (km²)',
    definition: 'Estimated total area that will be inundated in the specified scenario based on the elevation model and precipitation amount.',
    formula: 'Flood area = Σ(cells with elevation < flood depth) × cell_area',
    interpretation: 'Larger area means more affected population and infrastructure.',
    source: 'SRTM DEM + Internal runoff model',
    updateFreq: 'On scenario run',
  },
  'scenario-affected-population': {
    title: 'Affected Population (Estimate)',
    definition: 'Estimated number of residents in expected inundation zones based on population density data.',
    interpretation: 'Used to determine evacuation needs and response resource allocation.',
    source: 'Census data + SRTM DEM',
    updateFreq: 'On scenario run',
  },

  // ── Accuracy Dashboard ────────────────────────────────────────────────────
  'model-mae': {
    title: 'Mean Absolute Error (MAE)',
    definition: 'Average absolute difference between predicted values and actual measured values.',
    formula: 'MAE = (1/n) × Σ|predicted − actual|',
    range: '0 (perfect) — lower is better',
    interpretation: 'MAE below 2 mm/hr is considered excellent for precipitation models.',
    source: 'Model predictions vs. NCM station measurements',
    updateFreq: 'Daily',
  },
  'model-rmse': {
    title: 'Root Mean Square Error (RMSE)',
    definition: 'More sensitive to large errors than MAE — penalizes large errors more heavily.',
    formula: 'RMSE = √[(1/n) × Σ(predicted − actual)²]',
    range: '0 (perfect) — lower is better',
    interpretation: 'RMSE higher than MAE indicates large sporadic errors worth reviewing.',
    source: 'Model predictions vs. NCM station measurements',
    updateFreq: 'Daily',
  },

  // ── Uncertainty Map ───────────────────────────────────────────────────────
  'uncertainty-score': {
    title: 'Uncertainty Score',
    definition: 'Index measuring confidence in predictions for a given area — rises when data is scarce or models conflict.',
    range: '0% (full certainty) — 100% (full uncertainty)',
    interpretation: 'High uncertainty areas need field verification or additional monitoring stations.',
    source: 'Model variance analysis + station network density',
    updateFreq: 'Daily',
  },

  // ── Historical Archive ─────────────────────────────────────────────────────
  'historical-event-severity': {
    title: 'Historical Event Severity',
    definition: 'Classification of a historical flood event severity based on precipitation amount, affected area, and recorded losses.',
    range: 'Low / Moderate / High / Severe',
    interpretation: 'Severe events are used as reference for testing prediction models and defining worst-case scenarios.',
    source: 'NCM · Civil Defense Reports · Copernicus CEMS',
    updateFreq: 'Fixed (historical archive)',
  },

  // ── Historical Archive Charts ──────────────────────────────────────────────
  'historical-comparison': {
    title: 'Historical Events Comparison',
    definition: 'Bar chart comparing total precipitation (mm) for each recorded historical event in the database.',
    range: '0 mm (no precipitation) — 300+ mm (exceptional rainfall)',
    interpretation: 'Fully highlighted bars represent the currently selected event. Comparison helps classify event severity relatively.',
    source: 'NCM · Copernicus CEMS · Historical records 2011–2024',
    updateFreq: 'Fixed (archive)',
  },

  // ── Decision Support Charts ────────────────────────────────────────────────
  'recovery-chart': {
    title: 'Water Recession Timeline',
    definition: 'Chart showing the expected time-based decline of water depth (cm) over the next 24 hours after rainfall stops.',
    range: '0 cm (dry) — 100+ cm (severe flood)',
    interpretation: 'Yellow line at 10 cm = warning threshold. Red line at 20 cm = critical danger threshold. Intersection with lines determines required response time.',
    source: 'Flood memory model + Open-Meteo',
    updateFreq: 'Every 10 minutes',
  },

  'multi-dimension-comparison': {
    title: 'Multi-Dimension Comparison (Radar Chart)',
    definition: 'Radar chart comparing 3 indicators simultaneously for all regions: risk index (red), soil saturation (orange), water depth (purple).',
    range: '0 (safe) — 100 (maximum risk)',
    interpretation: 'Large area in chart = high risk across all dimensions. Asymmetric shapes require deeper analysis.',
    source: 'Flood memory model + Open-Meteo',
    updateFreq: 'Every 10 minutes',
  },

  // ── Drainage Network ─────────────────────────────────────────────────────────
  'soil-saturation': {
    title: 'Soil Saturation Index',
    definition: 'Percentage of soil pore space filled with water. Higher index means less capacity to absorb more rain and greater surface runoff risk.',
    formula: 'Soil saturation (%) = (current moisture / field capacity) × 100',
    range: '0% (completely dry) — 100% (fully saturated)',
    interpretation: 'Above 70%: Very high runoff risk; 40–70%: Monitor; Below 40%: Safe.',
    source: 'NASA SMAP + Open-Meteo ERA5',
    updateFreq: 'Every 2–3 days',
  },
  'drainage-capacity': {
    title: 'Drainage Network Capacity',
    definition: 'Percentage of drainage network ability to discharge rainwater compared to maximum design load.',
    formula: 'Capacity (%) = (actual discharge rate / design capacity) × 100',
    range: '0% (disabled) — 100% (full capacity)',
    interpretation: 'Above 80%: Good; 50–80%: Moderate, needs maintenance; Below 50%: Poor, requires intervention.',
    source: 'ADSSC + OSM Overpass',
    updateFreq: 'Fixed (last update from source)',
  },
  'network-accuracy': {
    title: 'Network Data Accuracy',
    definition: 'Confidence level in the validity of imported drainage network data, based on data source and last update date.',
    formula: 'Accuracy (%) = (matching checkpoints / total checkpoints) × 100',
    range: '0% (unreliable) — 100% (fully reliable)',
    interpretation: 'Above 85%: Reliable for decisions; 60–85%: Acceptable with caution; Below 60%: Field verification needed.',
    source: 'ADSSC (official) > OSM (community)',
    updateFreq: 'On new data import',
  },

  // ── Road Network ─────────────────────────────────────────────────────────────
  'road-flood-depth': {
    title: 'Road Flood Depth',
    definition: 'Calculated estimate of water accumulation depth on the road surface based on current precipitation rate, road type, and drainage efficiency.',
    formula: 'Depth (cm) = (precip × 1.8 − 2) × road_factor + wind_effect',
    range: '0 cm (dry) — 50+ cm (severe flood)',
    interpretation: 'Below 5 cm: Safe; 5–15 cm: Slow; 15–30 cm: Danger; Above 30 cm: Closed.',
    source: 'Hybrid BPR model + Open-Meteo',
    updateFreq: 'Every 10 minutes',
  },
  'speed-reduction': {
    title: 'Speed Reduction',
    definition: 'Percentage decrease in permitted road speed due to rain and flooding, compared to normal speed.',
    formula: 'Speed reduction (%) = f(flood depth, road type, wind speed)',
    range: '0% (no effect) — 100% (closed)',
    interpretation: 'Below 20%: Minor effect; 20–50%: Slow; 50–90%: Congested; Above 90%: Closed.',
    source: 'BPR model + Live Open-Meteo',
    updateFreq: 'Every 10 minutes',
  },
  'road-confidence': {
    title: 'Estimate Confidence Level',
    definition: 'Confidence level in the accuracy of road condition estimates, depending on weather data quality and availability of detailed road data.',
    formula: 'Confidence (%) = f(weather accuracy, OSM data completeness, last update time)',
    range: '50% (initial estimate) — 95% (verified data)',
    interpretation: 'Above 80%: Reliable decision; 60–80%: Use with caution; Below 60%: Field verification required.',
    source: 'OSM Overpass + Open-Meteo',
    updateFreq: 'Every 10 minutes',
  },

  // ── Traffic Impact ────────────────────────────────────────────────────────────
  'traffic-congestion-index': {
    title: 'Traffic Congestion Index',
    definition: 'Composite measure of congestion level on the road network, combining rain and flood impact with road closures.',
    formula: 'Congestion = (closed roads × 0.5 + congested roads × 0.3 + slow roads × 0.2) / total roads',
    range: '0 (free flow) — 1 (complete standstill)',
    interpretation: 'Below 0.3: Normal; 0.3–0.6: Moderate impact; Above 0.6: Traffic crisis.',
    source: 'BPR model + Live Open-Meteo',
    updateFreq: 'Every 10 minutes',
  },
  'affected-roads-count': {
    title: 'Number of Affected Roads',
    definition: 'Total number of roads (OSM segments) affected by current rainfall at varying degrees from partial to full closure.',
    formula: 'Affected roads = roads with speed reduction > 20%',
    range: '0 (no impact) — total monitored roads',
    interpretation: 'Used to estimate required intervention scale and direct emergency teams.',
    source: 'OSM Overpass + BPR model',
    updateFreq: 'Every 10 minutes',
  },

  // ── Heat Map ──────────────────────────────────────────────────────────────────
  'heat-map-intensity': {
    title: 'Heatmap Intensity',
    definition: 'Visual representation of flood risk index distribution across regions. Red indicates high risk, blue indicates low risk.',
    formula: 'Intensity = flood risk index (0–100) applied to color gradient',
    range: 'Blue (0) → Yellow (50) → Red (100)',
    interpretation: 'Red areas require immediate priority intervention.',
    source: 'Open-Meteo ERA5 + Risk index calculation',
    updateFreq: 'Every 10 minutes',
  },
  'heat-map-radius': {
    title: 'Heatmap Point Radius',
    definition: 'Size of each point in the heatmap represents the geographic area of the monitored region.',
    formula: 'Radius ∝ region area (km²)',
    range: 'Changes automatically with zoom level',
    interpretation: 'Large points represent wide areas; small points represent dense urban areas.',
    source: 'Geographic region data',
    updateFreq: 'Fixed',
  },

  // ── Uncertainty Map ───────────────────────────────────────────────────────────
  'uncertainty-radius': {
    title: 'Uncertainty Radius',
    definition: 'Geographic distance representing the margin of error in locating or defining the boundaries of a risk zone.',
    formula: 'Radius (km) = f(model accuracy, data quality, last update age)',
    range: '0.5 km (high accuracy) — 10+ km (high uncertainty)',
    interpretation: 'Smaller radius means more accurate prediction and lower margin of error.',
    source: 'Hydrological uncertainty model + Open-Meteo',
    updateFreq: 'Every 30 minutes',
  },
  'uncertainty-confidence': {
    title: 'Overall Confidence Level',
    definition: 'Percentage confidence of the model in its risk index estimates across all regions.',
    formula: 'Overall confidence = average(1 − uncertainty) for all regions × 100',
    range: '50% (high uncertainty) — 95% (high confidence)',
    interpretation: 'Above 80%: Reliable for decision; 60–80%: Acceptable with caution; Below 60%: Additional data required.',
    source: 'Hydrological model sensitivity analysis',
    updateFreq: 'Every 30 minutes',
  },

  // ── Reports ───────────────────────────────────────────────────────────────────
  'executive-risk-score': {
    title: 'Overall Risk Score',
    definition: 'Composite index summarizing the flood risk level across Abu Dhabi Emirate as a single number from 0 to 100.',
    formula: 'Overall risk = max(region risks) × 0.6 + avg(region risks) × 0.4',
    range: '0 (fully safe) — 100 (maximum risk)',
    interpretation: 'Below 30: Safe; 30–50: Monitor; 50–70: Warning; Above 70: Critical, immediate action required.',
    source: 'Open-Meteo ERA5 + Risk index model',
    updateFreq: 'Every 2 minutes',
  },
  'report-total-precip': {
    title: 'Total Precipitation (24 hours)',
    definition: 'Sum of recorded rainfall across all 90 monitored regions over the past 24 hours.',
    formula: 'Total precipitation = Σ precipitation per region (mm) over 24 hours',
    range: '0 mm (no rain) — 8,000+ mm (exceptional event)',
    interpretation: 'Used to estimate total rainfall volume at emirate level.',
    source: 'Open-Meteo ERA5 — 90 regions',
    updateFreq: 'Every 2 minutes',
  },
  'report-active-alerts': {
    title: 'Active Alerts',
    definition: 'Number of regions where the risk index exceeded the warning (50%) or critical (75%) threshold.',
    formula: 'Active alerts = regions with (risk ≥ 50%)',
    range: '0 (no alerts) — 90 (all regions at risk)',
    interpretation: 'Critical alerts (risk ≥ 75%) require immediate intervention.',
    source: 'Open-Meteo ERA5 + Risk index model',
    updateFreq: 'Every 2 minutes',
  },

  // ── Decision Support ─────────────────────────────────────────────────────────────────
  'decision-priority-score': {
    title: 'Intervention Priority Score',
    definition: 'Composite index ranking regions by immediate intervention priority based on risk, population density, and infrastructure capacity.',
    formula: 'Priority = (risk×0.4 + population density×0.35 + infrastructure vulnerability×0.25)',
    range: '0 (lowest priority) — 100 (highest priority)',
    interpretation: 'Above 70: Immediate intervention required; 40–70: Intensive monitoring; Below 40: Normal status.',
    source: 'Integrated internal calculation',
    updateFreq: 'Every 10 minutes',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────
interface MetricTooltipProps {
  id: string;
  size?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export default function MetricTooltip({ id, size = 11, position = 'top', className = '' }: MetricTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const info = METRIC_INFO[id];

  if (!info) return null;

  function show() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setCoords({ x: rect.left + rect.width / 2, y: rect.top });
    setVisible(true);
  }
  function hide() { setVisible(false); }

  const W = 270;
  let style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    width: W,
    background: 'linear-gradient(135deg, #0D1220 0%, #111827 100%)',
    border: '1px solid rgba(27,79,138,0.5)',
    borderRadius: 10,
    padding: '11px 13px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.75)',
    direction: 'ltr',
    fontFamily: "'Space Grotesk','Inter',sans-serif",
    pointerEvents: 'none',
  };

  if (position === 'top') {
    style = { ...style, bottom: window.innerHeight - coords.y + 8, left: coords.x - W / 2 };
  } else if (position === 'bottom') {
    style = { ...style, top: coords.y + 20, left: coords.x - W / 2 };
  } else if (position === 'left') {
    style = { ...style, top: coords.y - 20, right: window.innerWidth - coords.x + 16 };
  } else {
    style = { ...style, top: coords.y - 20, left: coords.x + 16 };
  }

  return (
    <>
      <button
        ref={btnRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={e => e.stopPropagation()}
        className={`flex-shrink-0 opacity-35 hover:opacity-85 transition-opacity ${className}`}
        style={{ lineHeight: 1, background: 'none', border: 'none', cursor: 'help', padding: 0 }}
        aria-label={`Info: ${info.title}`}
      >
        <HelpCircle size={size} color="rgba(96,165,250,0.9)" />
      </button>

      {visible && typeof document !== 'undefined' && createPortal(
        <div style={style}>
          {/* Title */}
          <div style={{ fontWeight: 700, fontSize: 12, color: '#60A5FA', marginBottom: 6 }}>
            {info.title}
          </div>

          {/* Definition */}
          <p style={{ fontSize: 10, lineHeight: 1.6, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
            {info.definition}
          </p>

          {/* Formula */}
          {info.formula && (
            <div style={{
              fontSize: 9, color: 'rgba(255,255,255,0.4)',
              background: 'rgba(255,255,255,0.04)', borderRadius: 4,
              padding: '4px 6px', marginBottom: 6,
              fontFamily: "'Space Mono','JetBrains Mono',monospace",
              direction: 'ltr', textAlign: 'left',
            }}>
              {info.formula}
            </div>
          )}

          {/* Range */}
          {info.range && (
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>
              <span style={{ color: '#A78BFA' }}>Range: </span>{info.range}
            </div>
          )}

          {/* Interpretation */}
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 6, lineHeight: 1.5 }}>
            <span style={{ color: '#34D399' }}>Interpretation: </span>{info.interpretation}
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
              <span style={{ color: '#60A5FA' }}>🌐 </span>{info.source}
            </div>
            {info.updateFreq && (
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
                <span style={{ color: '#F59E0B' }}>🔄 </span>Update: {info.updateFreq}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
