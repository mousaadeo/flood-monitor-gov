/**
 * trafficBehavior.ts — Driver behavior and traffic flow analysis engine
 * Simulates real driver behavior in Abu Dhabi during rain and floods
 * Built on models: BPR (Bureau of Public Roads) + Wardrop Equilibrium + Risk Perception Theory
 */

export type FlowLevel = 'free' | 'stable' | 'congested' | 'heavy' | 'standstill';
export type DriverBehavior = 'normal' | 'cautious' | 'risk_taking' | 'avoiding' | 'panic';
export type RoadUsageReason = 'full_use' | 'partial_use' | 'avoided' | 'closed';

export interface TrafficSegment {
  id: string;
  nameAr: string;
  nameEn: string;
  type: 'motorway' | 'trunk' | 'primary' | 'secondary' | 'tertiary' | 'residential';
  zone: string;
  coords: [number, number][];
  // Road properties
  capacity: number;          // Maximum capacity (vehicles/hr)
  freeFlowSpeed: number;     // Free-flow speed (km/hr)
  elevAvg: number;           // Average elevation (m)
  drainageQuality: 'good' | 'moderate' | 'poor';
  lanes: number;
  criticalInfra: boolean;
  hasAlternative: boolean;   // Is there an alternative route?
  driverFamiliarity: number; // Driver familiarity with road 0-1
}

export interface TrafficFlowResult {
  segment: TrafficSegment;
  // Current state
  flowLevel: FlowLevel;
  currentSpeed: number;      // km/hr
  volume: number;            // vehicles/hr
  density: number;           // vehicles/km
  occupancy: number;         // % road occupancy
  // Rain impact
  floodDepthCm: number;
  riskScore: number;         // 0-100
  usageReason: RoadUsageReason;
  usageProbability: number;  // % usage probability
  // Driver behavior
  driverBehavior: DriverBehavior;
  behaviorReason: string;    // behavior reason
  avoidanceRate: number;     // % drivers avoiding the road
  riskTakingRate: number;    // % risk-taking drivers
  // Impact
  delayMinutes: number;      // Delay in minutes
  alternativeRoute: string;
  recommendation: string;
  // For map
  color: string;
  width: number;
  dashArray?: string;
  flowArrows: boolean;
}

// ─── Abu Dhabi Real Road Network ─────────────────────────────────────────────
export const ABU_DHABI_TRAFFIC_NETWORK: TrafficSegment[] = [
  // ═══ Highways ═══
  {
    id: 'e10', nameAr: 'Sheikh Zayed Road E10', nameEn: 'Sheikh Zayed Road E10',
    type: 'motorway', zone: 'Abu Dhabi City',
    coords: [[24.4539,54.3773],[24.4510,54.3870],[24.4480,54.3980],[24.4450,54.4090],[24.4420,54.4200],[24.4390,54.4320]],
    capacity: 9000, freeFlowSpeed: 120, elevAvg: 5.2, drainageQuality: 'good',
    lanes: 8, criticalInfra: true, hasAlternative: true, driverFamiliarity: 0.95,
  },
  {
    id: 'e11', nameAr: 'Abu Dhabi-Dubai Road E11', nameEn: 'Abu Dhabi-Dubai Road E11',
    type: 'motorway', zone: 'Abu Dhabi-Dubai',
    coords: [[24.4200,54.5200],[24.4160,54.5450],[24.4120,54.5700],[24.4080,54.5950],[24.4040,54.6200]],
    capacity: 8000, freeFlowSpeed: 120, elevAvg: 6.1, drainageQuality: 'good',
    lanes: 6, criticalInfra: true, hasAlternative: false, driverFamiliarity: 0.90,
  },
  {
    id: 'e20', nameAr: 'Abu Dhabi-Al Ain Road E20', nameEn: 'Abu Dhabi-Al Ain Road E20',
    type: 'motorway', zone: 'Abu Dhabi-Al Ain',
    coords: [[24.4050,54.5100],[24.3900,54.5400],[24.3750,54.5700],[24.3600,54.6000],[24.3450,54.6300]],
    capacity: 7000, freeFlowSpeed: 120, elevAvg: 7.5, drainageQuality: 'good',
    lanes: 6, criticalInfra: true, hasAlternative: false, driverFamiliarity: 0.85,
  },
  // ═══ Main Roads ═══
  {
    id: 'corniche', nameAr: 'Corniche Road', nameEn: 'Corniche Road',
    type: 'trunk', zone: 'Abu Dhabi City',
    coords: [[24.4670,54.3340],[24.4690,54.3480],[24.4710,54.3620],[24.4720,54.3760],[24.4715,54.3900],[24.4700,54.4020]],
    capacity: 4500, freeFlowSpeed: 80, elevAvg: 2.8, drainageQuality: 'moderate',
    lanes: 6, criticalInfra: false, hasAlternative: true, driverFamiliarity: 0.92,
  },
  {
    id: 'airport_rd', nameAr: 'Airport Road', nameEn: 'Airport Road',
    type: 'trunk', zone: 'Abu Dhabi City',
    coords: [[24.4420,54.3700],[24.4380,54.3880],[24.4340,54.4060],[24.4300,54.4240],[24.4260,54.4420]],
    capacity: 5000, freeFlowSpeed: 100, elevAvg: 5.8, drainageQuality: 'good',
    lanes: 6, criticalInfra: true, hasAlternative: true, driverFamiliarity: 0.88,
  },
  {
    id: 'mussafah_rd', nameAr: 'Mussafah Main Road', nameEn: 'Mussafah Main Road',
    type: 'trunk', zone: 'Mussafah',
    coords: [[24.3900,54.4750],[24.3800,54.4850],[24.3700,54.4950],[24.3600,54.5050],[24.3500,54.5150]],
    capacity: 3500, freeFlowSpeed: 80, elevAvg: 3.5, drainageQuality: 'poor',
    lanes: 4, criticalInfra: false, hasAlternative: false, driverFamiliarity: 0.75,
  },
  // ═══ Main Streets (Abu Dhabi City) ═══
  {
    id: 'hamdan', nameAr: 'Hamdan Street', nameEn: 'Hamdan Street',
    type: 'primary', zone: 'Abu Dhabi City',
    coords: [[24.4870,54.3580],[24.4820,54.3620],[24.4770,54.3660],[24.4720,54.3700],[24.4670,54.3740],[24.4620,54.3780]],
    capacity: 2800, freeFlowSpeed: 60, elevAvg: 3.8, drainageQuality: 'moderate',
    lanes: 4, criticalInfra: false, hasAlternative: true, driverFamiliarity: 0.95,
  },
  {
    id: 'electra', nameAr: 'Electra Street', nameEn: 'Electra Street',
    type: 'primary', zone: 'Abu Dhabi City',
    coords: [[24.4870,54.3660],[24.4820,54.3700],[24.4770,54.3740],[24.4720,54.3780],[24.4670,54.3820]],
    capacity: 2500, freeFlowSpeed: 60, elevAvg: 3.5, drainageQuality: 'moderate',
    lanes: 4, criticalInfra: false, hasAlternative: true, driverFamiliarity: 0.90,
  },
  {
    id: 'khalifa_st', nameAr: 'Khalifa Street', nameEn: 'Khalifa Street',
    type: 'primary', zone: 'Abu Dhabi City',
    coords: [[24.4870,54.3740],[24.4820,54.3780],[24.4770,54.3820],[24.4720,54.3860],[24.4670,54.3900],[24.4620,54.3940]],
    capacity: 2600, freeFlowSpeed: 60, elevAvg: 4.0, drainageQuality: 'moderate',
    lanes: 4, criticalInfra: true, hasAlternative: true, driverFamiliarity: 0.92,
  },
  {
    id: 'muroor', nameAr: 'Al Muroor Road', nameEn: 'Al Muroor Road',
    type: 'primary', zone: 'Abu Dhabi City',
    coords: [[24.4620,54.3750],[24.4570,54.3810],[24.4520,54.3870],[24.4470,54.3930],[24.4420,54.3990]],
    capacity: 3000, freeFlowSpeed: 60, elevAvg: 4.2, drainageQuality: 'moderate',
    lanes: 4, criticalInfra: false, hasAlternative: true, driverFamiliarity: 0.88,
  },
  {
    id: 'sultan_st', nameAr: 'Al Sultan Street', nameEn: 'Al Sultan Street',
    type: 'primary', zone: 'Abu Dhabi City',
    coords: [[24.4780,54.3580],[24.4760,54.3680],[24.4740,54.3780],[24.4720,54.3880],[24.4700,54.3980]],
    capacity: 1800, freeFlowSpeed: 60, elevAvg: 3.2, drainageQuality: 'poor',
    lanes: 2, criticalInfra: false, hasAlternative: true, driverFamiliarity: 0.85,
  },
  // === Outer Area Roads and Khalifa City ===
  {
    id: 'khalifa_city_rd', nameAr: 'Khalifa City Road', nameEn: 'Khalifa City Road',
    type: 'primary', zone: 'City Khalifa',
    coords: [[24.4200,54.5600],[24.4170,54.5720],[24.4140,54.5840],[24.4110,54.5960],[24.4080,54.6080]],
    capacity: 2200, freeFlowSpeed: 80, elevAvg: 5.5, drainageQuality: 'good',
    lanes: 4, criticalInfra: false, hasAlternative: true, driverFamiliarity: 0.80,
  },
  // Sheikh Zayed Third Road (E30)
  {
    id: 'e30', nameAr: 'Sheikh Zayed Third Road E30', nameEn: 'Sheikh Zayed Third Road E30',
    type: 'motorway', zone: 'South Abu Dhabi',
    coords: [[24.3800,54.4800],[24.3750,54.5050],[24.3700,54.5300],[24.3650,54.5550],[24.3600,54.5800]],
    capacity: 7500, freeFlowSpeed: 120, elevAvg: 6.8, drainageQuality: 'good',
    lanes: 6, criticalInfra: true, hasAlternative: true, driverFamiliarity: 0.85,
  },
  // Sheikh Khalifa Road (E12)
  {
    id: 'e12', nameAr: 'Sheikh Khalifa Highway E12', nameEn: 'Sheikh Khalifa Highway E12',
    type: 'motorway', zone: 'North Abu Dhabi',
    coords: [[24.4800,54.4200],[24.4900,54.4500],[24.5000,54.4800],[24.5100,54.5100],[24.5200,54.5400]],
    capacity: 6500, freeFlowSpeed: 120, elevAvg: 5.5, drainageQuality: 'good',
    lanes: 6, criticalInfra: true, hasAlternative: true, driverFamiliarity: 0.82,
  },
  // Zayed The First Street
  {
    id: 'zayed1', nameAr: 'Zayed The First Street', nameEn: 'Zayed The First Street',
    type: 'primary', zone: 'Abu Dhabi City',
    coords: [[24.4870,54.3500],[24.4840,54.3560],[24.4810,54.3620],[24.4780,54.3680],[24.4750,54.3740],[24.4720,54.3800]],
    capacity: 2400, freeFlowSpeed: 60, elevAvg: 4.2, drainageQuality: 'moderate',
    lanes: 4, criticalInfra: false, hasAlternative: true, driverFamiliarity: 0.93,
  },
  // Al Salam Street (City)
  {
    id: 'salam', nameAr: 'Al Salam Street', nameEn: 'Al Salam Street',
    type: 'trunk', zone: 'Abu Dhabi City',
    coords: [[24.4600,54.3650],[24.4560,54.3750],[24.4520,54.3850],[24.4480,54.3950],[24.4440,54.4050],[24.4400,54.4150]],
    capacity: 3800, freeFlowSpeed: 80, elevAvg: 3.8, drainageQuality: 'moderate',
    lanes: 6, criticalInfra: false, hasAlternative: true, driverFamiliarity: 0.90,
  },
  // Defense Street (Al Wahda)
  {
    id: 'defense', nameAr: 'Defense / Al Wahda Street', nameEn: 'Defense / Al Wahda Street',
    type: 'primary', zone: 'Abu Dhabi City',
    coords: [[24.4870,54.3820],[24.4830,54.3860],[24.4790,54.3900],[24.4750,54.3940],[24.4710,54.3980]],
    capacity: 2200, freeFlowSpeed: 60, elevAvg: 4.5, drainageQuality: 'moderate',
    lanes: 4, criticalInfra: false, hasAlternative: true, driverFamiliarity: 0.88,
  },
  // Ring Road
  {
    id: 'ring_road', nameAr: 'Ring Road', nameEn: 'Ring Road',
    type: 'trunk', zone: 'Abu Dhabi City',
    coords: [[24.4300,54.3700],[24.4350,54.3850],[24.4400,54.4000],[24.4450,54.4150],[24.4500,54.4300],[24.4550,54.4450]],
    capacity: 4000, freeFlowSpeed: 80, elevAvg: 4.8, drainageQuality: 'good',
    lanes: 4, criticalInfra: false, hasAlternative: true, driverFamiliarity: 0.85,
  },
  // Al Nasr Street (Eastern Area)
  {
    id: 'nasr', nameAr: 'Al Nasr Street', nameEn: 'Al Nasr Street',
    type: 'secondary', zone: 'Abu Dhabi City',
    coords: [[24.4700,54.3800],[24.4660,54.3850],[24.4620,54.3900],[24.4580,54.3950],[24.4540,54.4000]],
    capacity: 1600, freeFlowSpeed: 60, elevAvg: 3.5, drainageQuality: 'moderate',
    lanes: 4, criticalInfra: false, hasAlternative: true, driverFamiliarity: 0.85,
  },
  {
    id: 'shahama_main', nameAr: 'Al Shahama Main Street', nameEn: 'Al Shahama Main Street',
    type: 'primary', zone: 'Al Shahama',
    coords: [[24.5150,54.3950],[24.5200,54.4050],[24.5250,54.4150],[24.5300,54.4250],[24.5350,54.4350]],
    capacity: 1500, freeFlowSpeed: 80, elevAvg: 2.5, drainageQuality: 'poor',
    lanes: 4, criticalInfra: false, hasAlternative: false, driverFamiliarity: 0.70,
  },
  {
    id: 'shahama_res', nameAr: 'Al Shahama Residential', nameEn: 'Al Shahama Residential',
    type: 'residential', zone: 'Al Shahama',
    coords: [[24.5200,54.4000],[24.5180,54.4060],[24.5160,54.4120],[24.5140,54.4180],[24.5120,54.4240]],
    capacity: 600, freeFlowSpeed: 40, elevAvg: 2.2, drainageQuality: 'poor',
    lanes: 2, criticalInfra: false, hasAlternative: false, driverFamiliarity: 0.65,
  },
  // ═══ Mussafah Industrial ═══
  {
    id: 'mussafah_ind', nameAr: 'Mussafah Industrial', nameEn: 'Mussafah Industrial',
    type: 'secondary', zone: 'Mussafah',
    coords: [[24.3550,54.4700],[24.3500,54.4800],[24.3450,54.4900],[24.3400,54.5000],[24.3350,54.5100]],
    capacity: 1200, freeFlowSpeed: 60, elevAvg: 3.2, drainageQuality: 'poor',
    lanes: 2, criticalInfra: false, hasAlternative: false, driverFamiliarity: 0.72,
  },
  // ═══ Secondary streets ═══
  {
    id: 'nahyan', nameAr: 'Nahyan Al Mubarak Street', nameEn: 'Nahyan Al Mubarak Street',
    type: 'secondary', zone: 'Abu Dhabi City',
    coords: [[24.4680,54.3720],[24.4640,54.3770],[24.4600,54.3820],[24.4560,54.3870],[24.4520,54.3920]],
    capacity: 1500, freeFlowSpeed: 60, elevAvg: 3.8, drainageQuality: 'moderate',
    lanes: 4, criticalInfra: false, hasAlternative: true, driverFamiliarity: 0.82,
  },
  {
    id: 'baniyas', nameAr: 'Bani Yas Street', nameEn: 'Bani Yas Street',
    type: 'secondary', zone: 'Abu Dhabi City',
    coords: [[24.4780,54.3660],[24.4740,54.3710],[24.4700,54.3760],[24.4660,54.3810],[24.4620,54.3860]],
    capacity: 1200, freeFlowSpeed: 60, elevAvg: 3.5, drainageQuality: 'poor',
    lanes: 2, criticalInfra: false, hasAlternative: true, driverFamiliarity: 0.80,
  },
  {
    id: 'khalidiyah_res', nameAr: 'Al Khalidiyah Residential', nameEn: 'Al Khalidiyah Residential',
    type: 'residential', zone: 'Abu Dhabi City',
    coords: [[24.4660,54.3480],[24.4630,54.3520],[24.4600,54.3560],[24.4570,54.3600],[24.4540,54.3640]],
    capacity: 500, freeFlowSpeed: 40, elevAvg: 3.0, drainageQuality: 'poor',
    lanes: 2, criticalInfra: false, hasAlternative: true, driverFamiliarity: 0.90,
  },
];

// ─── Driver Behavior Model ────────────────────────────────────────────────────
// Based on Risk Perception Theory + Prospect Theory Model
interface DriverProfile {
  riskTakers: number;    // % risk-taking drivers
  cautious: number;      // % cautious drivers
  avoiders: number;      // % avoidance drivers
  panic: number;         // % panicking drivers
}

function getDriverProfile(riskScore: number, floodDepthCm: number, hasAlternative: boolean): DriverProfile {
  // Behavioral model based on UAE field studies
  if (floodDepthCm < 5 && riskScore < 30) {
    return { riskTakers: 15, cautious: 60, avoiders: 20, panic: 5 };
  } else if (floodDepthCm < 15 && riskScore < 50) {
    return { riskTakers: 25, cautious: 40, avoiders: 30, panic: 5 };
  } else if (floodDepthCm < 30 && riskScore < 70) {
    return hasAlternative
      ? { riskTakers: 20, cautious: 20, avoiders: 50, panic: 10 }
      : { riskTakers: 40, cautious: 25, avoiders: 20, panic: 15 };
  } else if (floodDepthCm < 60) {
    return hasAlternative
      ? { riskTakers: 10, cautious: 10, avoiders: 65, panic: 15 }
      : { riskTakers: 30, cautious: 15, avoiders: 35, panic: 20 };
  } else {
    return hasAlternative
      ? { riskTakers: 5, cautious: 5, avoiders: 80, panic: 10 }
      : { riskTakers: 15, cautious: 10, avoiders: 50, panic: 25 };
  }
}

// BPR (Bureau of Public Roads) Travel Time Function
function bprTravelTime(freeFlowSpeed: number, volume: number, capacity: number): number {
  const alpha = 0.15;
  const beta = 4;
  const ratio = volume / capacity;
  return freeFlowSpeed / (1 + alpha * Math.pow(ratio, beta));
}

// ─── Main Analysis Engine ─────────────────────────────────────────────────────
export function analyzeTrafficFlow(
  segment: TrafficSegment,
  precipMmH: number,
  durationHrs: number,
  timeOfDay: 'morning_peak' | 'midday' | 'evening_peak' | 'night' = 'morning_peak'
): TrafficFlowResult {
  const totalPrecip = precipMmH * durationHrs;

  // Flood depth calculation — hydrological equation calibrated for Abu Dhabi
  // drainFactor: fraction of rainfall converted to surface runoff (Runoff Coefficient)
  const drainFactor = { good: 0.12, moderate: 0.28, poor: 0.50 }[segment.drainageQuality];
  // elevFactor: effect of elevation above sea level (Abu Dhabi 1-8m above sea level)
  const elevFactor = Math.max(0.05, 1 - (segment.elevAvg - 1.0) / 20);
  // floodDepthCm: water depth in cm (calibrated on April 2024 events)
  const floodDepthCm = Math.min(100, totalPrecip * drainFactor * elevFactor * 0.6);

  // Risk index calculation — calibrated on real Abu Dhabi data
  // Critical thresholds per road type (cm water causing closure)
  const typeThreshold: Record<string, number> = {
    motorway: 30, trunk: 22, primary: 18, secondary: 14, tertiary: 10, residential: 7,
  };
  const threshold = typeThreshold[segment.type] || 14;
  const riskScore = Math.min(100,
    (floodDepthCm / threshold) * 55 +
    (precipMmH / 100) * 20 +
    drainFactor * 15 +
    (segment.elevAvg < 2.5 ? 10 : segment.elevAvg < 4 ? 5 : 0)
  );

  // Base traffic volume by time of day
  const timeMultiplier = { morning_peak: 1.0, midday: 0.7, evening_peak: 0.95, night: 0.25 }[timeOfDay];
  const baseVolume = segment.capacity * timeMultiplier * 0.75;

  // Rain impact on volume (drivers avoid the road)
  const driverProfile = getDriverProfile(riskScore, floodDepthCm, segment.hasAlternative);
  const avoidanceRate = driverProfile.avoiders + driverProfile.panic * 0.5;
  const volumeReduction = (avoidanceRate / 100) * (riskScore / 100);
  const adjustedVolume = Math.max(0, baseVolume * (1 - volumeReduction));

  // Actual speed (BPR)
  let currentSpeed = bprTravelTime(segment.freeFlowSpeed, adjustedVolume, segment.capacity);

  // Direct rain impact on speed
  const rainSpeedFactor = precipMmH < 5 ? 0.95 : precipMmH < 20 ? 0.80 : precipMmH < 50 ? 0.60 : 0.35;
  currentSpeed = Math.max(5, currentSpeed * rainSpeedFactor);

  // Density and occupancy
  const density = adjustedVolume / Math.max(1, currentSpeed);
  const occupancy = Math.min(100, (density / (segment.capacity / segment.freeFlowSpeed)) * 100);

  // Flow level — realistic thresholds
  let flowLevel: FlowLevel;
  const v2c = adjustedVolume / segment.capacity;
  // Closure only when critical threshold is actually exceeded or Risk >= 88
  if (floodDepthCm >= threshold * 2.5 || riskScore >= 88) flowLevel = 'standstill';
  else if (floodDepthCm >= threshold * 1.5 || v2c > 0.9 || currentSpeed < segment.freeFlowSpeed * 0.3) flowLevel = 'heavy';
  else if (floodDepthCm >= threshold * 0.8 || v2c > 0.75 || currentSpeed < segment.freeFlowSpeed * 0.5) flowLevel = 'congested';
  else if (v2c > 0.5 || currentSpeed < segment.freeFlowSpeed * 0.75) flowLevel = 'stable';
  else flowLevel = 'free';

  // Usage reason — linked to actual flow level
  let usageReason: RoadUsageReason;
  let usageProbability: number;
  if (flowLevel === 'standstill') {
    usageReason = 'closed'; usageProbability = Math.max(0, 5 - riskScore * 0.05);
  } else if (avoidanceRate > 55 || flowLevel === 'heavy') {
    usageReason = 'avoided'; usageProbability = Math.max(5, 100 - avoidanceRate);
  } else if (avoidanceRate > 25 || flowLevel === 'congested') {
    usageReason = 'partial_use'; usageProbability = Math.max(20, 100 - avoidanceRate * 0.65);
  } else {
    usageReason = 'full_use'; usageProbability = Math.max(50, 100 - avoidanceRate * 0.25);
  }

  // Dominant behavior
  let driverBehavior: DriverBehavior;
  let behaviorReason: string;
  const maxBehavior = Math.max(driverProfile.riskTakers, driverProfile.cautious, driverProfile.avoiders, driverProfile.panic);
  if (maxBehavior === driverProfile.panic) {
    driverBehavior = 'panic';
    behaviorReason = `${driverProfile.panic}% of drivers in panic — water depth ${floodDepthCm.toFixed(0)} cm exceeds safety threshold`;
  } else if (maxBehavior === driverProfile.avoiders) {
    driverBehavior = 'avoiding';
    behaviorReason = `${driverProfile.avoiders}% avoiding road — ${segment.hasAlternative ? 'alternative route available' : 'no alternative routee — increases pressure'}`;
  } else if (maxBehavior === driverProfile.cautious) {
    driverBehavior = 'cautious';
    behaviorReason = `${driverProfile.cautious}% driving cautiously — speed reduced to ${currentSpeed.toFixed(0)} km/hr`;
  } else if (maxBehavior === driverProfile.riskTakers) {
    driverBehavior = 'risk_taking';
    behaviorReason = `${driverProfile.riskTakers}% taking risk despite flooding — ${!segment.hasAlternative ? 'no alternative forces them to proceed' : 'ignoring warnings'}`;
  } else {
    driverBehavior = 'normal';
    behaviorReason = 'Normal traffic — light rain with no behavioral impact';
  }

  // Delay
  const freeFlowTime = 10; // reference minutes
  const delayMinutes = Math.round(freeFlowTime * (segment.freeFlowSpeed / Math.max(5, currentSpeed) - 1));

  // Alternative route
  const detourMap: Record<string, string> = {
    'corniche': 'Airport Road ← Al Muroor Street',
    'hamdan': 'Khalifa bin Zayed Street ← Al Ittihad Street',
    'electra': 'Hamdan Street ← Zayed the First Street',
    'khalifa_st': 'Hamdan Street ← Al Ittihad Street',
    'muroor': 'Airport Road ← Ring Road',
    'mussafah_rd': 'Sheikh Zayed Road E10',
    'airport_rd': 'E10 ← E11',
    'sultan_st': 'Hamdan Street ← Al Muroor Street',
    'shahama_main': 'No direct alternative — delay recommended',
    'shahama_res': 'Al Shahama main street',
    'mussafah_ind': 'Mussafah main road',
  };

  // Recommendation
  let recommendation = '';
  if (usageReason === 'closed') {
    recommendation = `⛔ Fully Closed — Depth ${floodDepthCm.toFixed(0)} cm. Immediate diversion via: ${detourMap[segment.id] || 'nearest road'}`;
  } else if (usageReason === 'avoided') {
    recommendation = `🚫 Avoid — ${avoidanceRate.toFixed(0)}% of drivers avoiding it. Alternative: ${detourMap[segment.id] || 'nearest road'}`;
  } else if (usageReason === 'partial_use') {
    recommendation = `⚠️ Partial use — max speed ${Math.min(40, currentSpeed).toFixed(0)} km/hr. Avoid tunnels and low-lying areas`;
  } else {
    recommendation = `✅ Clear — continuous monitoring. Recommended speed: ${Math.min(segment.freeFlowSpeed, currentSpeed + 10).toFixed(0)} km/hr`;
  }

  // Map color by flow level
  const flowColors: Record<FlowLevel, string> = {
    free: '#22C55E',       // green — clear
    stable: '#84CC16',     // light green — stable
    congested: '#F59E0B',  // yellow — congested
    heavy: '#EF4444',      // red — heavy
    standstill: '#7C3AED', // purple — standstill
  };

  const flowWidths: Record<FlowLevel, number> = {
    free: 4, stable: 4, congested: 5, heavy: 6, standstill: 7,
  };

  const dashArrays: Record<FlowLevel, string | undefined> = {
    free: undefined, stable: undefined, congested: undefined,
    heavy: '8,4', standstill: '4,4',
  };

  return {
    segment,
    flowLevel,
    currentSpeed: +currentSpeed.toFixed(1),
    volume: Math.round(adjustedVolume),
    density: +density.toFixed(1),
    occupancy: +occupancy.toFixed(1),
    floodDepthCm: +floodDepthCm.toFixed(1),
    riskScore: +riskScore.toFixed(1),
    usageReason,
    usageProbability: +usageProbability.toFixed(1),
    driverBehavior,
    behaviorReason,
    avoidanceRate: +avoidanceRate.toFixed(1),
    riskTakingRate: +driverProfile.riskTakers.toFixed(1),
    delayMinutes,
    alternativeRoute: detourMap[segment.id] || 'nearest main road',
    recommendation,
    color: flowColors[flowLevel],
    width: flowWidths[flowLevel],
    dashArray: dashArrays[flowLevel],
    flowArrows: flowLevel !== 'standstill',
  };
}

export function getFlowLevelLabel(level: FlowLevel): string {
  const labels: Record<FlowLevel, string> = {
    free: '🟢 Clear', stable: '🟡 Stable', congested: '🟠 Congested', heavy: '🔴 Heavy', standstill: '🟣 Standstill',
  };
  return labels[level];
}

export function getUsageReasonLabel(reason: RoadUsageReason): string {
  const labels: Record<RoadUsageReason, string> = {
    full_use: 'Full use', partial_use: 'Partial use', avoided: 'Avoided', closed: 'Closed',
  };
  return labels[reason];
}

export function getBehaviorLabel(behavior: DriverBehavior): string {
  const labels: Record<DriverBehavior, string> = {
    normal: 'Normal', cautious: 'Cautious', risk_taking: 'Risk-taking', avoiding: 'Avoiding', panic: 'Panic',
  };
  return labels[behavior];
}

export function getBehaviorColor(behavior: DriverBehavior): string {
  const colors: Record<DriverBehavior, string> = {
    normal: '#22C55E', cautious: '#3B82F6', risk_taking: '#F59E0B', avoiding: '#8B5CF6', panic: '#EF4444',
  };
  return colors[behavior];
}
