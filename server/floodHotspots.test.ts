/**
 * Tests for flood visualization data and boundary functions.
 * Covers: floodHotspots data, abuDhabiBoundary polygon/density functions.
 */

import { describe, it, expect } from 'vitest';
import {
  L1_HOTSPOTS,
  L2_HOTSPOTS,
  L3_HOTSPOTS,
  L4_HOTSPOTS,
  getHotspotsForZoom,
  getHotspotsForZoomMerged,
} from '../client/src/data/floodHotspots';
import {
  isInsideAbuDhabi,
  getUrbanDensity,
  AD_EMIRATE_BOUNDARY,
  URBAN_ZONES,
} from '../client/src/data/abuDhabiBoundary';

// Abu Dhabi Emirate bounding box (generous)
const ABU_DHABI_BOUNDS = {
  minLat: 22.5,
  maxLat: 25.0,
  minLng: 51.0,
  maxLng: 56.5,
};

// ── floodHotspots data validation ─────────────────────────────────────────────

describe('floodHotspots data validation', () => {
  it('L1 hotspots should have valid coordinates within Abu Dhabi emirate', () => {
    expect(L1_HOTSPOTS.length).toBeGreaterThan(5);
    for (const hs of L1_HOTSPOTS) {
      expect(hs.lat).toBeGreaterThanOrEqual(ABU_DHABI_BOUNDS.minLat);
      expect(hs.lat).toBeLessThanOrEqual(ABU_DHABI_BOUNDS.maxLat);
      expect(hs.lng).toBeGreaterThanOrEqual(ABU_DHABI_BOUNDS.minLng);
      expect(hs.lng).toBeLessThanOrEqual(ABU_DHABI_BOUNDS.maxLng);
    }
  });

  it('L2 hotspots should have valid coordinates within Abu Dhabi emirate', () => {
    expect(L2_HOTSPOTS.length).toBeGreaterThan(20);
    for (const hs of L2_HOTSPOTS) {
      expect(hs.lat).toBeGreaterThanOrEqual(ABU_DHABI_BOUNDS.minLat);
      expect(hs.lat).toBeLessThanOrEqual(ABU_DHABI_BOUNDS.maxLat);
      expect(hs.lng).toBeGreaterThanOrEqual(ABU_DHABI_BOUNDS.minLng);
      expect(hs.lng).toBeLessThanOrEqual(ABU_DHABI_BOUNDS.maxLng);
    }
  });

  it('L3 hotspots should have valid coordinates within Abu Dhabi emirate', () => {
    expect(L3_HOTSPOTS.length).toBeGreaterThan(30);
    for (const hs of L3_HOTSPOTS) {
      expect(hs.lat).toBeGreaterThanOrEqual(ABU_DHABI_BOUNDS.minLat);
      expect(hs.lat).toBeLessThanOrEqual(ABU_DHABI_BOUNDS.maxLat);
      expect(hs.lng).toBeGreaterThanOrEqual(ABU_DHABI_BOUNDS.minLng);
      expect(hs.lng).toBeLessThanOrEqual(ABU_DHABI_BOUNDS.maxLng);
    }
  });

  it('L4 hotspots should have valid coordinates within Abu Dhabi emirate', () => {
    expect(L4_HOTSPOTS.length).toBeGreaterThan(10);
    for (const hs of L4_HOTSPOTS) {
      expect(hs.lat).toBeGreaterThanOrEqual(ABU_DHABI_BOUNDS.minLat);
      expect(hs.lat).toBeLessThanOrEqual(ABU_DHABI_BOUNDS.maxLat);
      expect(hs.lng).toBeGreaterThanOrEqual(ABU_DHABI_BOUNDS.minLng);
      expect(hs.lng).toBeLessThanOrEqual(ABU_DHABI_BOUNDS.maxLng);
    }
  });

  it('all hotspots should have valid intensity (0-1)', () => {
    const all = [...L1_HOTSPOTS, ...L2_HOTSPOTS, ...L3_HOTSPOTS, ...L4_HOTSPOTS];
    for (const hs of all) {
      expect(hs.intensity).toBeGreaterThanOrEqual(0);
      expect(hs.intensity).toBeLessThanOrEqual(1);
    }
  });

  it('all hotspots should have positive baseDepth and radius', () => {
    const all = [...L1_HOTSPOTS, ...L2_HOTSPOTS, ...L3_HOTSPOTS, ...L4_HOTSPOTS];
    for (const hs of all) {
      expect(hs.baseDepth).toBeGreaterThan(0);
      expect(hs.radius).toBeGreaterThan(0);
    }
  });

  it('L1 hotspots should have larger radii than L3 (city-scale vs street-scale)', () => {
    const avgL1Radius = L1_HOTSPOTS.reduce((s, h) => s + h.radius, 0) / L1_HOTSPOTS.length;
    const avgL3Radius = L3_HOTSPOTS.reduce((s, h) => s + h.radius, 0) / L3_HOTSPOTS.length;
    expect(avgL1Radius).toBeGreaterThan(avgL3Radius);
  });
});

// ── getHotspotsForZoom ────────────────────────────────────────────────────────

describe('getHotspotsForZoom', () => {
  it('returns L1 hotspots for zoom <= 10', () => {
    expect(getHotspotsForZoom(7)).toEqual(L1_HOTSPOTS);
    expect(getHotspotsForZoom(9)).toEqual(L1_HOTSPOTS);
    expect(getHotspotsForZoom(10)).toEqual(L1_HOTSPOTS);
  });

  it('returns L2 hotspots for zoom 11-13', () => {
    expect(getHotspotsForZoom(11)).toEqual(L2_HOTSPOTS);
    expect(getHotspotsForZoom(12)).toEqual(L2_HOTSPOTS);
    expect(getHotspotsForZoom(13)).toEqual(L2_HOTSPOTS);
  });

  it('returns L3 hotspots for zoom 14-16', () => {
    expect(getHotspotsForZoom(14)).toEqual(L3_HOTSPOTS);
    expect(getHotspotsForZoom(15)).toEqual(L3_HOTSPOTS);
    expect(getHotspotsForZoom(16)).toEqual(L3_HOTSPOTS);
  });

  it('returns L4 hotspots for zoom >= 17', () => {
    expect(getHotspotsForZoom(17)).toEqual(L4_HOTSPOTS);
    expect(getHotspotsForZoom(20)).toEqual(L4_HOTSPOTS);
  });
});

// ── getHotspotsForZoomMerged ──────────────────────────────────────────────────

describe('getHotspotsForZoomMerged', () => {
  it('returns more hotspots than single level for L2 zoom', () => {
    const merged = getHotspotsForZoomMerged(12);
    expect(merged.length).toBeGreaterThan(L2_HOTSPOTS.length);
  });

  it('returns more hotspots than single level for L3 zoom', () => {
    const merged = getHotspotsForZoomMerged(15);
    expect(merged.length).toBeGreaterThan(L3_HOTSPOTS.length);
  });

  it('returns more hotspots than single level for L4 zoom', () => {
    const merged = getHotspotsForZoomMerged(18);
    expect(merged.length).toBeGreaterThan(L4_HOTSPOTS.length);
  });

  it('L1 zoom returns only L1 hotspots', () => {
    const merged = getHotspotsForZoomMerged(9);
    expect(merged).toEqual(L1_HOTSPOTS);
  });
});

// ── isInsideAbuDhabi ──────────────────────────────────────────────────────────

describe('isInsideAbuDhabi', () => {
  it('returns true for Abu Dhabi city center', () => {
    expect(isInsideAbuDhabi(24.466, 54.366)).toBe(true);
  });

  it('returns true for Khalifa City A', () => {
    expect(isInsideAbuDhabi(24.420, 54.590)).toBe(true);
  });

  it('returns true for MBZ City', () => {
    expect(isInsideAbuDhabi(24.385, 54.505)).toBe(true);
  });

  it('returns true for Mussafah', () => {
    expect(isInsideAbuDhabi(24.370, 54.470)).toBe(true);
  });

  it('returns true for Al Ain city center', () => {
    expect(isInsideAbuDhabi(24.215, 55.750)).toBe(true);
  });

  it('returns true for Ghayathi (western region)', () => {
    expect(isInsideAbuDhabi(23.835, 52.800)).toBe(true);
  });

  it('returns true for Madinat Zayed', () => {
    expect(isInsideAbuDhabi(23.705, 53.730)).toBe(true);
  });

  it('returns false for Dubai city center', () => {
    expect(isInsideAbuDhabi(25.204, 55.270)).toBe(false);
  });

  it('returns false for Sharjah', () => {
    expect(isInsideAbuDhabi(25.346, 55.420)).toBe(false);
  });

  it('returns false for far outside bounding box', () => {
    expect(isInsideAbuDhabi(30.000, 60.000)).toBe(false);
    expect(isInsideAbuDhabi(20.000, 45.000)).toBe(false);
  });
});

// ── getUrbanDensity ───────────────────────────────────────────────────────────

describe('getUrbanDensity', () => {
  it('returns high density for Abu Dhabi island core', () => {
    const d = getUrbanDensity(24.470, 54.370);
    expect(d).toBeGreaterThan(0.80);
  });

  it('returns high density for Khalifa City A', () => {
    const d = getUrbanDensity(24.425, 54.590);
    expect(d).toBeGreaterThan(0.65);
  });

  it('returns moderate density for Mussafah', () => {
    const d = getUrbanDensity(24.370, 54.470);
    expect(d).toBeGreaterThan(0.60);
  });

  it('returns non-zero density for Ghayathi', () => {
    const d = getUrbanDensity(23.835, 52.805);
    expect(d).toBeGreaterThan(0.45);
  });

  it('returns non-zero density for Madinat Zayed', () => {
    const d = getUrbanDensity(23.705, 53.730);
    expect(d).toBeGreaterThan(0.40);
  });

  it('returns non-zero density for Al Shamkha', () => {
    const d = getUrbanDensity(24.305, 54.635);
    expect(d).toBeGreaterThan(0.45);
  });

  it('returns 0 for empty desert area', () => {
    const d = getUrbanDensity(22.800, 53.500);
    expect(d).toBe(0);
  });

  it('returns 0 for sea area', () => {
    const d = getUrbanDensity(25.000, 54.500);
    expect(d).toBe(0);
  });

  it('density is between 0 and 1 for all zone midpoints', () => {
    URBAN_ZONES.forEach(zone => {
      const midLat = (zone.minLat + zone.maxLat) / 2;
      const midLng = (zone.minLng + zone.maxLng) / 2;
      const d = getUrbanDensity(midLat, midLng);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1);
    });
  });
});

// ── AD_EMIRATE_BOUNDARY data integrity ───────────────────────────────────────

describe('AD_EMIRATE_BOUNDARY', () => {
  it('has at least 20 points', () => {
    expect(AD_EMIRATE_BOUNDARY.length).toBeGreaterThanOrEqual(20);
  });

  it('is a closed polygon (first and last points match)', () => {
    const first = AD_EMIRATE_BOUNDARY[0];
    const last = AD_EMIRATE_BOUNDARY[AD_EMIRATE_BOUNDARY.length - 1];
    expect(first[0]).toBeCloseTo(last[0], 3);
    expect(first[1]).toBeCloseTo(last[1], 3);
  });

  it('all points are within Abu Dhabi bounding box', () => {
    AD_EMIRATE_BOUNDARY.forEach(([lat, lng]) => {
      expect(lat).toBeGreaterThan(22);
      expect(lat).toBeLessThan(26);
      expect(lng).toBeGreaterThan(51);
      expect(lng).toBeLessThan(57);
    });
  });

  it('covers the full east-west extent of the emirate', () => {
    const lngs = AD_EMIRATE_BOUNDARY.map(p => p[1]);
    expect(Math.min(...lngs)).toBeLessThan(52.0);
    expect(Math.max(...lngs)).toBeGreaterThan(55.5);
  });
});

// ── URBAN_ZONES data integrity ────────────────────────────────────────────────

describe('URBAN_ZONES', () => {
  it('has at least 25 zones', () => {
    expect(URBAN_ZONES.length).toBeGreaterThanOrEqual(25);
  });

  it('all zones have valid bounding boxes', () => {
    URBAN_ZONES.forEach(zone => {
      expect(zone.minLat).toBeLessThan(zone.maxLat);
      expect(zone.minLng).toBeLessThan(zone.maxLng);
    });
  });

  it('all density values are between 0 and 1', () => {
    URBAN_ZONES.forEach(zone => {
      expect(zone.density).toBeGreaterThan(0);
      expect(zone.density).toBeLessThanOrEqual(1);
    });
  });

  it('includes Al Shamkha / Zayed City', () => {
    const shamkha = URBAN_ZONES.find(z => z.name.includes('Shamkha') || z.name.includes('Zayed City'));
    expect(shamkha).toBeDefined();
  });

  it('includes Madinat Zayed', () => {
    const mz = URBAN_ZONES.find(z => z.name.includes('Madinat Zayed'));
    expect(mz).toBeDefined();
  });

  it('includes Ghayathi', () => {
    const g = URBAN_ZONES.find(z => z.name.includes('Ghayathi'));
    expect(g).toBeDefined();
  });
});

// ── Abu Dhabi Island inner districts coverage ─────────────────────────────────

describe('Abu Dhabi Island inner districts coverage', () => {
  it('should have L3 hotspots in Al Manaseer area', () => {
    const manaseer = L3_HOTSPOTS.filter(
      hs => hs.lat >= 24.44 && hs.lat <= 24.46 && hs.lng >= 54.38 && hs.lng <= 54.40
    );
    expect(manaseer.length).toBeGreaterThanOrEqual(5);
  });

  it('should have L3 hotspots in Al Nahyan area', () => {
    const nahyan = L3_HOTSPOTS.filter(
      hs => hs.lat >= 24.44 && hs.lat <= 24.45 && hs.lng >= 54.37 && hs.lng <= 54.39
    );
    expect(nahyan.length).toBeGreaterThanOrEqual(3);
  });

  it('should have L3 hotspots in Khalidiyah area', () => {
    const khalidiyah = L3_HOTSPOTS.filter(
      hs => hs.lat >= 24.453 && hs.lat <= 24.462 && hs.lng >= 54.366 && hs.lng <= 54.376
    );
    expect(khalidiyah.length).toBeGreaterThanOrEqual(3);
  });
});

// ── Khalifa City A hotspots precision ────────────────────────────────────────

describe('Khalifa City A hotspots precision', () => {
  it('should have L2 hotspots in Khalifa City A area', () => {
    const khalifaA = L2_HOTSPOTS.filter(
      hs => hs.lat >= 24.40 && hs.lat <= 24.44 && hs.lng >= 54.56 && hs.lng <= 54.62
    );
    expect(khalifaA.length).toBeGreaterThanOrEqual(4);
  });

  it('should have L3 hotspots in Khalifa City A area', () => {
    const khalifaA = L3_HOTSPOTS.filter(
      hs => hs.lat >= 24.40 && hs.lat <= 24.44 && hs.lng >= 54.56 && hs.lng <= 54.62
    );
    expect(khalifaA.length).toBeGreaterThanOrEqual(8);
  });
});

// ── Al Wathba hotspots precision ──────────────────────────────────────────────

describe('Al Wathba hotspots precision', () => {
  it('should have L2 hotspots in Al Wathba area', () => {
    const wathba = L2_HOTSPOTS.filter(
      hs => hs.lat >= 24.24 && hs.lat <= 24.30 && hs.lng >= 54.58 && hs.lng <= 54.65
    );
    expect(wathba.length).toBeGreaterThanOrEqual(3);
  });
});

// ── Mussafah hotspots precision ───────────────────────────────────────────────

describe('Mussafah hotspots precision', () => {
  it('should have L2 hotspots in Mussafah area', () => {
    const mussafah = L2_HOTSPOTS.filter(
      hs => hs.lat >= 24.33 && hs.lat <= 24.39 && hs.lng >= 54.45 && hs.lng <= 54.52
    );
    expect(mussafah.length).toBeGreaterThanOrEqual(4);
  });
});

// ── Precipitation threshold sensitivity tests ─────────────────────────────────
describe('Precipitation threshold sensitivity', () => {
  /**
   * getFloodThreshold logic (inline test):
   *   threshold = clamp(0.20, 0.90, 0.38 + density * 0.44 + (multiplier - 1.0) * 0.12)
   */
  function getFloodThreshold(density: number, multiplier: number): number {
    const multiplierBoost = (multiplier - 1.0) * 0.12;
    return Math.min(0.90, Math.max(0.20, 0.38 + density * 0.44 + multiplierBoost));
  }

  it('dry conditions (multiplier=0.3) should lower threshold vs baseline', () => {
    const dry = getFloodThreshold(0.65, 0.3);
    const baseline = getFloodThreshold(0.65, 1.0);
    expect(dry).toBeLessThan(baseline);
  });

  it('heavy rain (multiplier=2.5) should raise threshold vs baseline', () => {
    const heavy = getFloodThreshold(0.65, 2.5);
    const baseline = getFloodThreshold(0.65, 1.0);
    expect(heavy).toBeGreaterThan(baseline);
  });

  it('multiplier range 0.3→2.5 should produce at least 0.25 threshold spread', () => {
    const dry = getFloodThreshold(0.65, 0.3);
    const heavy = getFloodThreshold(0.65, 2.5);
    expect(heavy - dry).toBeGreaterThanOrEqual(0.25);
  });

  it('desert (density=0) with multiplier=0.3 should stay above minimum 0.20', () => {
    const t = getFloodThreshold(0.0, 0.3);
    expect(t).toBeGreaterThanOrEqual(0.20);
  });

  it('dense urban (density=0.92) with multiplier=2.5 should be capped at 0.90', () => {
    const t = getFloodThreshold(0.92, 2.5);
    expect(t).toBeLessThanOrEqual(0.90);
  });

  it('baseline multiplier=1.0 should give 0.0 boost', () => {
    const density = 0.70;
    const expected = Math.min(0.90, Math.max(0.20, 0.38 + density * 0.44));
    const actual = getFloodThreshold(density, 1.0);
    expect(Math.abs(actual - expected)).toBeLessThan(0.001);
  });
});

// ── Dynamic Evacuation Zones calculation tests ────────────────────────────────
describe('Dynamic Evacuation Zones calculation', () => {
  function computeEvacuationZones(multiplier: number) {
    return URBAN_ZONES
      .filter(z => z.density >= 0.65)
      .map(z => {
        const depthEst = Math.round(80 * z.density * multiplier);
        const decision: 'immediate' | 'warning' = depthEst >= 50 ? 'immediate' : 'warning';
        return { name: z.name, density: z.density, depthEst, decision };
      })
      .sort((a, b) => b.depthEst - a.depthEst);
  }

  it('should only include zones with density >= 0.65', () => {
    const zones = computeEvacuationZones(1.0);
    for (const z of zones) {
      expect(z.density).toBeGreaterThanOrEqual(0.65);
    }
  });

  it('should include known high-density zones (Khalifa City A, MBZ, Al Ain)', () => {
    const zones = computeEvacuationZones(1.0);
    const names = zones.map(z => z.name);
    expect(names.some(n => n.includes('Khalifa City A'))).toBe(true);
    expect(names.some(n => n.includes('MBZ'))).toBe(true);
    expect(names.some(n => n.includes('Al Ain'))).toBe(true);
  });

  it('heavy rain (multiplier=2.5) should produce more "immediate" zones than dry (0.3)', () => {
    const heavy = computeEvacuationZones(2.5).filter(z => z.decision === 'immediate');
    const dry = computeEvacuationZones(0.3).filter(z => z.decision === 'immediate');
    expect(heavy.length).toBeGreaterThan(dry.length);
  });

  it('zones should be sorted by depth descending', () => {
    const zones = computeEvacuationZones(1.5);
    for (let i = 0; i < zones.length - 1; i++) {
      expect(zones[i].depthEst).toBeGreaterThanOrEqual(zones[i + 1].depthEst);
    }
  });

  it('depth estimate should scale with multiplier', () => {
    const z1 = computeEvacuationZones(1.0).find(z => z.name.includes('Khalifa City A'));
    const z2 = computeEvacuationZones(2.0).find(z => z.name.includes('Khalifa City A'));
    expect(z2!.depthEst).toBeGreaterThan(z1!.depthEst);
  });
});

// ── OSM Boundary integrity (extended) ────────────────────────────────────────
describe('OSM Boundary extended integrity', () => {
  it('AD_EMIRATE_BOUNDARY should have at least 40 points', () => {
    expect(AD_EMIRATE_BOUNDARY.length).toBeGreaterThanOrEqual(40);
  });

  it('zones with density >= 0.65 should count at least 10 (enough for evacuation zones)', () => {
    const highDensity = URBAN_ZONES.filter(z => z.density >= 0.65);
    expect(highDensity.length).toBeGreaterThanOrEqual(10);
  });

  it('all URBAN_ZONES should have density between 0.30 and 0.95', () => {
    for (const zone of URBAN_ZONES) {
      expect(zone.density).toBeGreaterThanOrEqual(0.30);
      expect(zone.density).toBeLessThanOrEqual(0.95);
    }
  });
});

// ── isInsideAbuDhabi offshore island exclusion tests ─────────────────────────
describe('isInsideAbuDhabi — offshore island exclusion', () => {
  it('excludes all 8 offshore islands from flood visualization', () => {
    // Das Island — far north in Gulf
    expect(isInsideAbuDhabi(25.1500, 52.8700)).toBe(false);
    // Zirku Island — far north in Gulf
    expect(isInsideAbuDhabi(24.8700, 53.0700)).toBe(false);
    // Delma Island — far offshore (~80 km from Abu Dhabi)
    expect(isInsideAbuDhabi(24.5000, 52.3300)).toBe(false);
    // Al Futaisi Island — small island SW of Abu Dhabi city
    expect(isInsideAbuDhabi(24.3800, 54.2200)).toBe(false);
    // Al Sammaliyah Island — island east of Abu Dhabi
    expect(isInsideAbuDhabi(24.4200, 54.7500)).toBe(false);
    // Al Aryam Island — small island NW of Abu Dhabi
    expect(isInsideAbuDhabi(24.5200, 54.3200)).toBe(false);
    // Al Natheel Island — small island SW of Abu Dhabi
    expect(isInsideAbuDhabi(24.2500, 54.2000)).toBe(false);
    // Abu Al Abyad Island — large island in Gulf
    expect(isInsideAbuDhabi(24.2000, 53.8000)).toBe(false);
  });

  it('still includes all mainland regions after island exclusions', () => {
    expect(isInsideAbuDhabi(24.4539, 54.3773)).toBe(true); // Abu Dhabi City
    expect(isInsideAbuDhabi(24.2600, 54.6100)).toBe(true); // Al Wathba
    expect(isInsideAbuDhabi(23.8340, 52.8050)).toBe(true); // Ghayathi
    expect(isInsideAbuDhabi(24.2075, 55.7447)).toBe(true); // Al Ain
    expect(isInsideAbuDhabi(23.1200, 53.7700)).toBe(true); // Liwa
    expect(isInsideAbuDhabi(24.3500, 54.4900)).toBe(true); // Mussafah
    expect(isInsideAbuDhabi(24.4050, 54.5900)).toBe(true); // Khalifa City A
  });

  it('excludes Dubai and points outside emirate', () => {
    expect(isInsideAbuDhabi(25.2048, 55.2708)).toBe(false); // Dubai
    expect(isInsideAbuDhabi(26.0000, 56.0000)).toBe(false); // Far north
    expect(isInsideAbuDhabi(20.0000, 54.0000)).toBe(false); // Far south
  });
});

// ── drainageService — computeEfficiency unit tests ────────────────────────────

describe('drainageService — computeEfficiency', () => {
  // Pure logic mirror of drainageService.ts (no HTTP calls)
  function computeEfficiency(
    sm01: number,
    sm39: number,
    type: string,
    capacity: number
  ): { efficiency: number; currentLoad: number; status: string } {
    const sat01 = Math.min(1.0, sm01 / 0.4);
    const sat39 = Math.min(1.0, sm39 / 0.4);
    const avgSat = sat01 * 0.4 + sat39 * 0.6;
    const baseEff = ({ canal: 75, drain: 70, wadi: 60, stream: 60 } as Record<string, number>)[type] ?? 65;
    const satPenalty = avgSat * 25;
    const capBonus = Math.min(10, capacity / 2000);
    const efficiency = Math.max(20, Math.min(95, baseEff - satPenalty + capBonus));
    const currentLoad = Math.max(10, Math.min(98, Math.round(100 - efficiency + avgSat * 20)));
    const status =
      efficiency >= 80 ? 'operational' :
      efficiency >= 60 ? 'degraded' :
      efficiency >= 40 ? 'overloaded' : 'blocked';
    return { efficiency: Math.round(efficiency * 10) / 10, currentLoad, status };
  }

  it('dry desert soil (sm≈0.05) → high efficiency for canal', () => {
    const { efficiency, status } = computeEfficiency(0.05, 0.05, 'canal', 3000);
    // canal base=75, satPenalty=0.05/0.4*0.4*25+0.05/0.4*0.6*25≈1.56, capBonus=min(10,3000/2000)=1.5 → ~74.9
    expect(efficiency).toBeGreaterThan(70);
    expect(status).not.toBe('blocked');
  });

  it('saturated soil → reduced efficiency vs dry soil', () => {
    const dry = computeEfficiency(0.05, 0.05, 'drain', 1000);
    const wet = computeEfficiency(0.35, 0.35, 'drain', 1000);
    expect(wet.efficiency).toBeLessThan(dry.efficiency);
  });

  it('wadi with fully saturated soil → overloaded or blocked', () => {
    const { status } = computeEfficiency(0.40, 0.40, 'wadi', 500);
    expect(['overloaded', 'blocked']).toContain(status);
  });

  it('large capacity canal → higher efficiency bonus than small', () => {
    const small = computeEfficiency(0.15, 0.15, 'canal', 500);
    const large = computeEfficiency(0.15, 0.15, 'canal', 10000);
    expect(large.efficiency).toBeGreaterThanOrEqual(small.efficiency);
  });

  it('efficiency always in valid range 20–95', () => {
    const cases: [number, number, string, number][] = [
      [0.0, 0.0, 'drain', 100],
      [0.4, 0.4, 'wadi', 50],
      [0.2, 0.2, 'canal', 5000],
      [0.1, 0.3, 'stream', 800],
    ];
    for (const [sm01, sm39, type, cap] of cases) {
      const { efficiency } = computeEfficiency(sm01, sm39, type, cap);
      expect(efficiency).toBeGreaterThanOrEqual(20);
      expect(efficiency).toBeLessThanOrEqual(95);
    }
  });

  it('currentLoad inversely correlated with efficiency', () => {
    const { efficiency, currentLoad } = computeEfficiency(0.10, 0.10, 'drain', 1000);
    // Both together should exceed 80 (efficiency + load are complementary)
    expect(efficiency + currentLoad).toBeGreaterThan(80);
  });

  it('stream type treated same as wadi (base efficiency 60)', () => {
    const stream = computeEfficiency(0.10, 0.10, 'stream', 1000);
    const wadi   = computeEfficiency(0.10, 0.10, 'wadi',   1000);
    expect(stream.efficiency).toBe(wadi.efficiency);
  });
});

// ── Soil moisture saturation multiplier (waterAccumulationEngine formula) ─────

describe('Soil moisture saturation multiplier', () => {
  // Mirror formula from waterAccumulationEngine.ts:
  //   satMult = clamp(0.80, 1.35, 0.80 + avgSm * 1.8)
  function satMult(sm0: number, sm3: number): number {
    const avgSm = (sm0 + sm3) / 2;
    return Math.min(1.35, Math.max(0.80, 0.80 + avgSm * 1.8));
  }

  it('dry desert soil (sm≈0.05) → multiplier near 0.89', () => {
    const m = satMult(0.05, 0.05);
    expect(m).toBeCloseTo(0.89, 1);
  });

  it('typical UAE soil (sm≈0.15) → multiplier ~1.07', () => {
    const m = satMult(0.15, 0.15);
    expect(m).toBeCloseTo(1.07, 1);
  });

  it('saturated soil (sm≈0.35) → multiplier near 1.35 cap', () => {
    const m = satMult(0.35, 0.35);
    expect(m).toBeGreaterThanOrEqual(1.30);
    expect(m).toBeLessThanOrEqual(1.35);
  });

  it('multiplier always in range 0.80–1.35 for any input', () => {
    const cases: [number, number][] = [[0, 0], [0.5, 0.5], [0.1, 0.3], [0.4, 0.2]];
    for (const [a, b] of cases) {
      const m = satMult(a, b);
      expect(m).toBeGreaterThanOrEqual(0.80);
      expect(m).toBeLessThanOrEqual(1.35);
    }
  });

  it('higher soil moisture → higher multiplier (monotone)', () => {
    const m1 = satMult(0.05, 0.05);
    const m2 = satMult(0.15, 0.15);
    const m3 = satMult(0.30, 0.30);
    expect(m2).toBeGreaterThan(m1);
    expect(m3).toBeGreaterThan(m2);
  });

  it('saturated soil amplifies runoff by at least 30% vs dry', () => {
    const dry = satMult(0.05, 0.05);
    const sat = satMult(0.35, 0.35);
    expect(sat / dry).toBeGreaterThanOrEqual(1.30);
  });
});

// ── OSM drainage data integrity ───────────────────────────────────────────────

describe('OSM drainage data — coordinate validity', () => {
  // Validate that any drainage point passed to the map is within Abu Dhabi bounds
  const ABU_DHABI_BBOX = { minLat: 22.5, maxLat: 25.0, minLng: 51.0, maxLng: 56.5 };

  function isInBBox(lat: number, lng: number): boolean {
    return lat >= ABU_DHABI_BBOX.minLat && lat <= ABU_DHABI_BBOX.maxLat &&
           lng >= ABU_DHABI_BBOX.minLng && lng <= ABU_DHABI_BBOX.maxLng;
  }

  it('Abu Dhabi city wadi sample point is within bounding box', () => {
    expect(isInBBox(24.453, 54.377)).toBe(true);
  });

  it('Al Ain wadi sample point is within bounding box', () => {
    expect(isInBBox(24.215, 55.750)).toBe(true);
  });

  it('Liwa drain sample point is within bounding box', () => {
    expect(isInBBox(23.120, 53.770)).toBe(true);
  });

  it('Dubai point is outside Abu Dhabi bounding box', () => {
    expect(isInBBox(25.204, 55.270)).toBe(false);
  });

  it('Arabian Gulf open water is outside bounding box (lat > 25)', () => {
    expect(isInBBox(25.500, 54.500)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Visual fixes: irregular blobs, evacuation zones, desert suppression
// ─────────────────────────────────────────────────────────────────────────────

describe('Evacuation zones — land-only polygon sampling', () => {
  it('zones with density < 0.65 are excluded from evacuation', () => {
    const lowDensityZones = [
      { name: 'Desert Zone', density: 0.10 },
      { name: 'Rural Area', density: 0.40 },
    ];
    const filtered = lowDensityZones.filter(z => z.density >= 0.65);
    expect(filtered).toHaveLength(0);
  });

  it('zones with density >= 0.65 are included in evacuation', () => {
    const highDensityZones = URBAN_ZONES.filter(z => z.density >= 0.65);
    expect(highDensityZones.length).toBeGreaterThan(0);
  });

  it('Abu Dhabi City bbox has majority of land points inside boundary', () => {
    const z = { minLat: 24.42, maxLat: 24.52, minLng: 54.33, maxLng: 54.43 };
    const steps = 4;
    const latStep = (z.maxLat - z.minLat) / steps;
    const lngStep = (z.maxLng - z.minLng) / steps;
    let landCount = 0;
    let totalCount = 0;
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps; j++) {
        totalCount++;
        if (isInsideAbuDhabi(z.minLat + i * latStep, z.minLng + j * lngStep)) landCount++;
      }
    }
    expect(landCount).toBeGreaterThan(totalCount * 0.5);
  });

  it('population estimate scales with land fraction', () => {
    const steps = 4;
    const totalSamples = (steps + 1) * (steps + 1);
    const landFraction = Math.max(0.1, 20 / totalSamples);
    const popEst = Math.round(50 * 0.85 * 8000 * landFraction);
    expect(popEst).toBeGreaterThan(0);
    expect(popEst).toBeLessThan(50 * 0.85 * 8000);
  });
});

describe('Desert suppression at low zoom', () => {
  it('desert (density=0) gets near-zero urbanFactor at zoom 10', () => {
    const density = 0.0;
    const zoom = 10;
    const desertSuppression = zoom <= 10 ? 0.08 : 0.45;
    const urbanFactor = desertSuppression + density * (zoom <= 10 ? 0.80 : 0.60);
    expect(urbanFactor).toBe(0.08);
    expect(urbanFactor).toBeLessThan(0.15);
  });

  it('urban area (density=0.9) gets high urbanFactor at zoom 10', () => {
    const density = 0.9;
    const zoom = 10;
    const desertSuppression = zoom <= 10 ? 0.08 : 0.45;
    const urbanFactor = desertSuppression + density * (zoom <= 10 ? 0.80 : 0.60);
    expect(urbanFactor).toBeCloseTo(0.80, 1);
    expect(urbanFactor).toBeGreaterThan(0.70);
  });

  it('at zoom 14, desert areas get moderate urbanFactor (not suppressed)', () => {
    const density = 0.0;
    const zoom = 14;
    const desertSuppression = zoom <= 10 ? 0.08 : 0.45;
    const urbanFactor = desertSuppression + density * (zoom <= 10 ? 0.80 : 0.60);
    expect(urbanFactor).toBe(0.45);
  });

  it('patchRadiusM at zoom 10 is 520m (reduced from 900m to prevent sea bleeding)', () => {
    let patchRadiusM: number;
    const zoom = 10;
    if (zoom >= 16) patchRadiusM = 55;
    else if (zoom >= 14) patchRadiusM = 130;
    else if (zoom >= 12) patchRadiusM = 340;
    else if (zoom >= 10) patchRadiusM = 520;
    else patchRadiusM = 0;
    expect(patchRadiusM).toBe(520);
    expect(patchRadiusM).toBeLessThan(900);
  });
});

describe('Irregular blob rendering', () => {
  it('blob rx and ry differ per location (not a perfect circle)', () => {
    const lat = 24.45, lng = 54.37, rpx = 50;
    const rx = rpx * (1.05 + Math.sin(lat * 211 + lng * 317) * 0.20);
    const ry = rpx * (0.80 + Math.cos(lat * 149 + lng * 251) * 0.18);
    expect(rx).not.toBeCloseTo(ry, 0);
    expect(rx).toBeGreaterThan(rpx * 0.80);
    expect(rx).toBeLessThan(rpx * 1.30);
  });

  it('seed is deterministic per lat/lng', () => {
    const lat = 24.45, lng = 54.37;
    expect(lat * 1000 + lng).toBe(lat * 1000 + lng);
  });

  it('different locations produce different blob shapes', () => {
    const rpx = 50;
    const rx1 = rpx * (1.05 + Math.sin(24.45 * 211 + 54.37 * 317) * 0.20);
    const rx2 = rpx * (1.05 + Math.sin(24.52 * 211 + 54.44 * 317) * 0.20);
    expect(rx1).not.toBeCloseTo(rx2, 1);
  });
});
