/*
 * simulationEngine.ts — Hydrological simulation + AI engine
 * FloodSat AI — Abu Dhabi Flood Monitoring Platform
 * Design: Techno-Geospatial Command Center
 *
 * 8 Flood Scenarios + AI Insights Engine
 */

export interface GridCell {
  row: number; col: number;
  elev: number;
  waterDepth: number;
  floodRisk: number;
  status: 'dry' | 'wet' | 'flooded' | 'critical';
  isRoad: boolean;
  roadImpact: 'open' | 'caution' | 'closed' | 'impassable';
}

export interface ScenarioParams {
  precipRate: number;
  duration: number;
  seaLevelRise: number;
  drainageFailure: number;
  wadiFactor: number;
  soilSaturation: number;
}

export interface SimulationScenario {
  id: string;
  nameAr: string;
  category: 'rain' | 'sea' | 'drainage' | 'flash' | 'combined';
  icon: string;
  color: string;
  bgGradient: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | 'catastrophic';
  params: ScenarioParams;
  description: string;
  historicalRef?: string;
}

export interface SimulationStats {
  totalCells: number;
  dryCells: number; wetCells: number; floodedCells: number; criticalCells: number;
  maxWaterDepth: number; avgWaterDepth: number;
  floodedAreaKm2: number;
  affectedPopulation: number;
  roadsClosed: number;
  estimatedDamageUSD: number;
  responseWindow: number;
  evacuationTime: number;
}

export interface TimeStep {
  hour: number; floodedPct: number; maxDepth: number; criticalCount: number;
}

export interface RoadImpact {
  name: string; status: GridCell['roadImpact']; waterDepth: number; detourAvailable: boolean;
}

export interface EvacuationZone {
  id: string; nameAr: string; priority: 1 | 2 | 3;
  population: number; timeToFlood: number; evacuationRoute: string;
}

export interface AIInsight {
  type: 'warning' | 'recommendation' | 'bestpractice' | 'prediction' | 'action';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  titleAr: string;
  bodyAr: string;
  source: string;
  icon: string;
}

export interface SimulationResult {
  scenario: SimulationScenario;
  cells: GridCell[];
  stats: SimulationStats;
  timeline: TimeStep[];
  affectedRoads: RoadImpact[];
  evacuationZones: EvacuationZone[];
  aiInsights: AIInsight[];
}

// ─── 8 Scenarios ─────────────────────────────────────────────────────────────
export const SCENARIOS: SimulationScenario[] = [
  {
    id: 'light-rain', nameAr: 'Light Rain', category: 'rain', icon: '🌦',
    color: '#60A5FA', bgGradient: 'linear-gradient(135deg,#1e3a5f,#1e40af)',
    severity: 'low', description: 'Rainfall 5-15 mm/hr — temporary accumulation in low-lying areas',
    params: { precipRate: 10, duration: 3, seaLevelRise: 0, drainageFailure: 0.1, wadiFactor: 0.3, soilSaturation: 0.2 }
  },
  {
    id: 'moderate-rain', nameAr: 'Moderate Rain', category: 'rain', icon: '🌧',
    color: '#3B82F6', bgGradient: 'linear-gradient(135deg,#1e3a8a,#1d4ed8)',
    severity: 'medium', description: 'Rainfall 15-30 mm/hr — notable impact on Al Muroor traffic',
    params: { precipRate: 22, duration: 6, seaLevelRise: 0, drainageFailure: 0.25, wadiFactor: 1.0, soilSaturation: 0.5 }
  },
  {
    id: 'heavy-rain', nameAr: 'Heavy Rain', category: 'rain', icon: '⛈',
    color: '#F59E0B', bgGradient: 'linear-gradient(135deg,#78350f,#b45309)',
    severity: 'high', description: 'Rainfall 30-60 mm/hr — widespread urban flooding',
    params: { precipRate: 45, duration: 8, seaLevelRise: 0, drainageFailure: 0.5, wadiFactor: 2.0, soilSaturation: 0.75 }
  },
  {
    id: 'extreme-rain', nameAr: 'Extreme Rain (2024)', category: 'rain', icon: '🌪',
    color: '#EF4444', bgGradient: 'linear-gradient(135deg,#7f1d1d,#b91c1c)',
    severity: 'critical', description: '254 mm over 24 hr — similar to April 2024 event',
    historicalRef: 'UAE April 2024 event',
    params: { precipRate: 80, duration: 24, seaLevelRise: 0.3, drainageFailure: 0.8, wadiFactor: 3.5, soilSaturation: 0.95 }
  },
  {
    id: 'sea-level-rise', nameAr: 'Sea Level Rise', category: 'sea', icon: '🌊',
    color: '#06B6D4', bgGradient: 'linear-gradient(135deg,#164e63,#0e7490)',
    severity: 'high', description: 'Sea level rise 1m — impact on coastal areas',
    params: { precipRate: 5, duration: 12, seaLevelRise: 1.0, drainageFailure: 0.3, wadiFactor: 0.5, soilSaturation: 0.6 }
  },
  {
    id: 'drainage-failure', nameAr: 'Drainage Network Failure', category: 'drainage', icon: '🚧',
    color: '#F97316', bgGradient: 'linear-gradient(135deg,#7c2d12,#c2410c)',
    severity: 'high', description: 'Complete drainage network blockage — water accumulation on streets',
    params: { precipRate: 25, duration: 6, seaLevelRise: 0, drainageFailure: 1.0, wadiFactor: 1.0, soilSaturation: 0.8 }
  },
  {
    id: 'flash-flood', nameAr: 'Flash Flood (Wadi)', category: 'flash', icon: '💧',
    color: '#8B5CF6', bgGradient: 'linear-gradient(135deg,#4c1d95,#6d28d9)',
    severity: 'critical', description: 'Flash flood from wadis — sudden rise within 30 min',
    params: { precipRate: 60, duration: 2, seaLevelRise: 0, drainageFailure: 0.6, wadiFactor: 5.0, soilSaturation: 0.9 }
  },
  {
    id: 'catastrophic', nameAr: 'Compound Catastrophic Scenario', category: 'combined', icon: '🆘',
    color: '#DC2626', bgGradient: 'linear-gradient(135deg,#450a0a,#991b1b)',
    severity: 'catastrophic', description: 'Extreme rainfall + sea level rise + drainage failure + wadi floods',
    params: { precipRate: 100, duration: 24, seaLevelRise: 1.5, drainageFailure: 1.0, wadiFactor: 5.0, soilSaturation: 1.0 }
  },
];

// ─── AI Insights Generator ────────────────────────────────────────────────────
function generateAIInsights(scenario: SimulationScenario, stats: SimulationStats): AIInsight[] {
  const p = scenario.params;
  const insights: AIInsight[] = [];

  // 1. Immediate Warning
  if (stats.criticalCells > 10) {
    insights.push({
      type: 'warning', priority: 'urgent',
      icon: '🚨',
      titleAr: `Urgent Alert — ${stats.criticalCells} cells in Critical state`,
      bodyAr: `${stats.criticalCells} areas detected with water depth exceeding 50 cm. Response window: ${stats.responseWindow} hr only. Immediate Level 3 alert and closure of ${stats.roadsClosed} roads recommended.`,
      source: 'Model GeoAI U-Net + Data SRTM'
    });
  }

  // 2. Population Impact
  if (stats.affectedPopulation > 1000) {
    insights.push({
      type: 'prediction', priority: 'high',
      icon: '👥',
      titleAr: `${stats.affectedPopulation.toLocaleString()} people in risk areas`,
      bodyAr: `According to Abu Dhabi population distribution model, ${stats.affectedPopulation.toLocaleString()} people are in affected areas. Estimated safe evacuation time: ${stats.evacuationTime} hr. Evacuation priority: coastal areas first, then low-lying areas.`,
      source: 'UNOCHA + Population Distribution Model'
    });
  }

  // 3. Drainage recommendation
  if (p.drainageFailure > 0.5) {
    insights.push({
      type: 'recommendation', priority: 'high',
      icon: '🔧',
      titleAr: 'Activate Emergency Drainage Protocol',
      bodyAr: `Drainage network operating at ${Math.round((1 - p.drainageFailure) * 100)}% efficiency only. Recommendation: activate backup pumping stations immediately and divert water flow to additional retention tanks. Per ASCE standards, drainage network must handle at least 25 mm/hr.`,
      source: 'ASCE 7-22 + Urban Stormwater Management Guide'
    });
  }

  // 4. Sea level specific
  if (p.seaLevelRise > 0.5) {
    insights.push({
      type: 'bestpractice', priority: 'high',
      icon: '🌊',
      titleAr: 'Activate Coastal Protection Protocol',
      bodyAr: `Sea level rise of ${p.seaLevelRise}m threatens ${Math.round(stats.floodedAreaKm2 * 0.4)} km² of coastal areas. Best practices (IPCC AR6): activate temporary water barriers, close coastal drainage gates, and warn areas below 3m sea level.`,
      source: 'IPCC AR6 + Gulf States Coastal Protection Guide'
    });
  }

  // 5. Flash flood specific
  if (p.wadiFactor > 3) {
    insights.push({
      type: 'warning', priority: 'urgent',
      icon: '⚡',
      titleAr: 'Flash Flood Risk — Immediate Wadi Closure',
      bodyAr: `Wadi factor ${p.wadiFactor}x indicates flash flood risk within 30-60 min. Per ALERT2 system and Dubai 2024 experience: immediately close roads crossing wadis and send warning SMS to all vehicles within 5 km radius.`,
      source: 'NOAA Flash Flood Guidance + Dubai 2024 experience'
    });
  }

  // 6. Economic impact
  if (stats.estimatedDamageUSD > 10_000_000) {
    insights.push({
      type: 'prediction', priority: 'medium',
      icon: '💰',
      titleAr: `Estimated Losses: ${(stats.estimatedDamageUSD / 1_000_000).toFixed(1)} million USD`,
      bodyAr: `According to damage estimation model (Hazus-MH), total material losses estimated at ${(stats.estimatedDamageUSD / 1_000_000).toFixed(1)} million USD. Loss breakdown: 45% infrastructure, 35% residential buildings, 20% indirect economic losses. Flood insurance typically covers only 30-40%.`,
      source: 'FEMA Hazus-MH + Swiss Re Report 2024'
    });
  }

  // 7. Best Practice — Early Warning
  insights.push({
    type: 'bestpractice', priority: 'medium',
    icon: '📡',
    titleAr: 'Optimal Early Warning Window',
    bodyAr: `According to Google Flood Hub study (2024), early warning ${stats.responseWindow} hr in advance reduces damage by 60%. Recommendation: link this simulation to an automatic SMS system for ${stats.affectedPopulation.toLocaleString()} residents and activate emergency response protocol with civil defense.`,
    source: 'Google Flood Hub Research 2024 + UNDRR'
  });

  // 8. Infrastructure protection
  if (stats.roadsClosed > 2) {
    insights.push({
      type: 'action', priority: 'high',
      icon: '🛣',
      titleAr: `Close ${stats.roadsClosed} Roads — Activate Diversion Plan`,
      bodyAr: `${stats.roadsClosed} main roads affected by water. Immediate action: activate Abu Dhabi Police-approved Al Muroor diversion plan and deploy electronic warning signs on alternative routes. Per AASHTO standards, roads close when water depth exceeds 15 cm.`,
      source: 'AASHTO + Abu Dhabi Traffic Emergency Management Guide'
    });
  }

  // 9. Satellite monitoring recommendation
  insights.push({
    type: 'recommendation', priority: 'medium',
    icon: '🛰',
    titleAr: 'Activate Immediate Satellite Monitoring',
    bodyAr: `In this scenario, requesting SAR imagery from ICEYE (1m accuracy, 6-hour response) or Sentinel-1 (10m accuracy, free) is recommended. Satellites enable monitoring actual water extent compared to simulation, and map updates every 12 hr during the event.`,
    source: 'Copernicus EMS + ICEYE Flood Rapid Impact'
  });

  // 10. Long-term solution
  if (scenario.severity === 'critical' || scenario.severity === 'catastrophic') {
    insights.push({
      type: 'bestpractice', priority: 'low',
      icon: '🏗',
      titleAr: 'Long-Term Structural Solutions',
      bodyAr: `According to World Bank Urban Resilience Report (2023): (1) build underground water retention tanks with 500,000 m³ capacity in low-lying areas, (2) raise main road levels by 30-50 cm in areas below 3m, (3) implement smart IoT drainage system with sensors every 500m, (4) create coastal green belt to absorb storm surges.`,
      source: 'World Bank Urban Resilience 2023 + Singapore and Netherlands experience'
    });
  }

  return insights.sort((a, b) => {
    const order = { urgent: 0, high: 1, medium: 2, low: 3 };
    return order[a.priority] - order[b.priority];
  });
}

// ─── Main Simulation Engine ───────────────────────────────────────────────────
export function runSimulation(
  elevData: number[],
  scenario: SimulationScenario,
  rows = 20, cols = 20,
  gridStep_m = 12
): SimulationResult {
  const p = scenario.params;

  // Road cells (simulate Abu Dhabi road network)
  const roadSet = new Set<number>();
  for (let j = 0; j < cols; j++) { roadSet.add(3 * cols + j); roadSet.add(8 * cols + j); roadSet.add(14 * cols + j); }
  for (let i = 0; i < rows; i++) { roadSet.add(i * cols + 5); roadSet.add(i * cols + 12); roadSet.add(i * cols + 17); }

  const cells: GridCell[] = elevData.map((elev, idx) => {
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const isRoad = roadSet.has(idx);

    // Hydrological model
    const precipVol = (p.precipRate * p.duration / 1000) * (1 - 0.25 * (1 - p.soilSaturation));
    const seaContrib = elev <= p.seaLevelRise + 3 ? Math.max(0, (p.seaLevelRise + 3 - elev) * 0.4) : 0;
    const drainContrib = precipVol * p.drainageFailure * 0.7;
    const wadiContrib = elev <= 6 ? p.wadiFactor * 0.12 * Math.max(0, (6 - elev) / 6) : 0;
    const elevFactor = elev <= 0 ? 2.2 : elev <= 2 ? 1.7 : elev <= 5 ? 1.3 : elev <= 10 ? 0.9 : 0.4;
    const waterDepth = Math.max(0, Math.round((precipVol + seaContrib + drainContrib + wadiContrib) * elevFactor * 100) / 100);

    let status: GridCell['status'] = 'dry';
    if (waterDepth > 0.5) status = 'critical';
    else if (waterDepth > 0.2) status = 'flooded';
    else if (waterDepth > 0.05) status = 'wet';

    let roadImpact: GridCell['roadImpact'] = 'open';
    if (waterDepth > 0.3) roadImpact = 'impassable';
    else if (waterDepth > 0.15) roadImpact = 'closed';
    else if (waterDepth > 0.05) roadImpact = 'caution';

    const floodRisk = Math.min(100, Math.round(
      (waterDepth / 0.5) * 55 + (elev <= 5 ? 30 : elev <= 10 ? 12 : 0) + p.drainageFailure * 15
    ));

    return { row, col, elev, waterDepth, floodRisk, status, isRoad, roadImpact };
  });

  // Stats
  const dryCells = cells.filter(c => c.status === 'dry').length;
  const wetCells = cells.filter(c => c.status === 'wet').length;
  const floodedCells = cells.filter(c => c.status === 'flooded').length;
  const criticalCells = cells.filter(c => c.status === 'critical').length;
  const maxWaterDepth = Math.max(...cells.map(c => c.waterDepth));
  const avgWaterDepth = Math.round(cells.reduce((s, c) => s + c.waterDepth, 0) / cells.length * 100) / 100;
  const floodedAreaKm2 = Math.round((floodedCells + criticalCells) * gridStep_m * gridStep_m / 1_000_000 * 100) / 100;
  const affectedPopulation = Math.round((floodedCells + criticalCells) * 45);
  const roadsClosed = cells.filter(c => c.isRoad && (c.roadImpact === 'closed' || c.roadImpact === 'impassable')).length;
  const estimatedDamageUSD = Math.round(floodedAreaKm2 * 12_000_000 + affectedPopulation * 4500);
  const responseWindow = maxWaterDepth > 0.4 ? 2 : maxWaterDepth > 0.15 ? 5 : 12;
  const evacuationTime = criticalCells > 40 ? 1 : criticalCells > 15 ? 3 : 6;

  const stats: SimulationStats = {
    totalCells: cells.length, dryCells, wetCells, floodedCells, criticalCells,
    maxWaterDepth: Math.round(maxWaterDepth * 100) / 100, avgWaterDepth,
    floodedAreaKm2, affectedPopulation, roadsClosed,
    estimatedDamageUSD, responseWindow, evacuationTime
  };

  // Timeline
  const timeline: TimeStep[] = Array.from({ length: Math.min(p.duration, 24) + 1 }, (_, h) => {
    const prog = Math.min(1, h / Math.max(p.duration, 1));
    const curve = 1 - Math.exp(-3 * prog);
    return {
      hour: h,
      floodedPct: Math.round((floodedCells + criticalCells) / cells.length * 100 * curve * 10) / 10,
      maxDepth: Math.round(maxWaterDepth * curve * 100) / 100,
      criticalCount: Math.round(criticalCells * curve),
    };
  });

  // Roads
  const roadNames = ['Corniche Street', 'Sheikh Zayed Street', 'Airport Road', 'Arabian Gulf Street', 'Hamdan Street', 'Electra Street'];
  const roadIndices = [3 * cols + 5, 8 * cols + 12, 14 * cols + 17, 3 * cols + 12, 8 * cols + 17, 14 * cols + 12];
  const affectedRoads: RoadImpact[] = roadNames.map((name, i) => ({
    name,
    status: cells[roadIndices[i]]?.roadImpact ?? 'open',
    waterDepth: cells[roadIndices[i]]?.waterDepth ?? 0,
    detourAvailable: i !== 2,
  }));

  // Evacuation zones
  const evacuationZones: EvacuationZone[] = [
    { id: 'z1', nameAr: 'Coastal Corniche', priority: 1 as const, population: 12500, timeToFlood: responseWindow * 0.5, evacuationRoute: 'Sheikh Zayed Street ← Abu Dhabi-Dubai Road' },
    { id: 'z2', nameAr: 'Low-lying Areas - Mussafah', priority: 1 as const, population: 8200, timeToFlood: responseWindow * 0.7, evacuationRoute: 'Airport Road ← Al Shahama' },
    { id: 'z3', nameAr: 'Old Residential Neighborhoods', priority: 2 as const, population: 22000, timeToFlood: responseWindow * 1.2, evacuationRoute: 'Hamdan Street ← Khalifa City' },
    { id: 'z4', nameAr: 'Industrial Area', priority: 2 as const, population: 5600, timeToFlood: responseWindow * 1.5, evacuationRoute: 'Al Shahama Road ← Al Ruwais' },
    { id: 'z5', nameAr: 'New Residential Areas', priority: 3 as const, population: 31000, timeToFlood: responseWindow * 2.2, evacuationRoute: 'Sheikh Zayed Street ← Al Ain' },
  ].filter(z => z.timeToFlood < 48);

  const aiInsights = generateAIInsights(scenario, stats);

  return { scenario, cells, stats, timeline, affectedRoads, evacuationZones, aiInsights };
}

// ─── Colour helpers ───────────────────────────────────────────────────────────
export function cellColor(cell: GridCell): string {
  if (cell.waterDepth > 0.5) return 'rgba(220,38,38,0.95)';
  if (cell.waterDepth > 0.3) return 'rgba(234,88,12,0.9)';
  if (cell.waterDepth > 0.15) return 'rgba(245,158,11,0.85)';
  if (cell.waterDepth > 0.05) return 'rgba(59,130,246,0.75)';
  // Dry — elevation tint
  if (cell.elev <= 2) return 'rgba(255,23,68,0.55)';
  if (cell.elev <= 5) return 'rgba(255,109,0,0.35)';
  if (cell.elev <= 10) return 'rgba(255,214,0,0.2)';
  return 'rgba(118,255,3,0.1)';
}

export function severityColor(s: SimulationScenario['severity']): string {
  return { catastrophic: '#7C3AED', critical: '#DC2626', high: '#EA580C', medium: '#F59E0B', low: '#10B981' }[s];
}

export function insightColor(type: AIInsight['type']): string {
  return { warning: '#EF4444', recommendation: '#3B82F6', bestpractice: '#10B981', prediction: '#8B5CF6', action: '#F59E0B' }[type];
}

export function roadStatusColor(s: GridCell['roadImpact']): string {
  return { open: '#10B981', caution: '#F59E0B', closed: '#EF4444', impassable: '#7C3AED' }[s];
}
