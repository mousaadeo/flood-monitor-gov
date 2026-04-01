/**
 * drainageService.ts
 * Fetches real drainage network data from OSM Overpass API
 * and enriches it with live soil moisture from Open-Meteo.
 *
 * Data sources:
 *  - OSM Overpass API: waterway=drain|canal|stream|wadi (Abu Dhabi emirate)
 *  - Open-Meteo: soil_moisture_0_to_1cm + soil_moisture_3_to_9cm (live)
 */

import https from "https";
import http from "http";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DrainageSystem {
  id: string;
  lat: number;
  lng: number;
  nameAr: string;
  nameEn: string;
  type: "drain" | "canal" | "wadi" | "stream";
  capacity: number;          // m³/h estimated
  efficiency: number;        // 0–100%
  currentLoad: number;       // 0–100%
  status: "operational" | "degraded" | "overloaded" | "blocked";
  soilMoisture01: number;    // m³/m³ top 1cm (Open-Meteo live)
  soilMoisture39: number;    // m³/m³ 3–9cm depth (Open-Meteo live)
  segmentCount: number;      // OSM segments merged
}

// ── Cache ─────────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: DrainageSystem[];
  fetchedAt: number;
}

let _cache: CacheEntry | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ── HTTP helper ───────────────────────────────────────────────────────────────

function fetchUrl(url: string, postData?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith("https");
    const lib = isHttps ? https : http;
    const options: http.RequestOptions = postData
      ? {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(postData),
            "User-Agent": "FloodMonitor/1.0",
          },
        }
      : { headers: { "User-Agent": "FloodMonitor/1.0" } };

    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      ...options,
    };

    const req = lib.request(reqOptions, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
        } else {
          resolve(body);
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(25000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    if (postData) req.write(postData);
    req.end();
  });
}

// ── OSM Overpass fetch ────────────────────────────────────────────────────────

interface OsmElement {
  id: number;
  type: string;
  tags: Record<string, string>;
  center?: { lat: number; lon: number };
}

async function fetchOsmWaterways(): Promise<OsmElement[]> {
  // Split into two queries to avoid timeout: Abu Dhabi coast + Al Ain / Al Dhafra
  const queries = [
    // Abu Dhabi city + coast
    `[out:json][timeout:20];(way["waterway"~"drain|canal|stream|wadi"](24.20,54.00,24.70,55.20););out center tags;`,
    // Al Ain + Al Dhafra
    `[out:json][timeout:20];(way["waterway"~"drain|canal|stream|wadi"](23.00,51.50,24.40,55.90););out center tags;`,
  ];

  const all: OsmElement[] = [];
  const seen = new Set<number>();

  for (const query of queries) {
    try {
      const encoded = `data=${encodeURIComponent(query)}`;
      const body = await fetchUrl("https://overpass-api.de/api/interpreter", encoded);
      const parsed = JSON.parse(body) as { elements: OsmElement[] };
      for (const el of parsed.elements ?? []) {
        if (!seen.has(el.id)) {
          seen.add(el.id);
          all.push(el);
        }
      }
    } catch (err) {
      console.warn("[drainageService] OSM query failed:", err);
    }
    // Polite delay between requests
    await new Promise((r) => setTimeout(r, 1500));
  }

  return all;
}

// ── Cluster nearby segments ───────────────────────────────────────────────────

interface Cluster {
  lat: number;
  lng: number;
  type: string;
  nameAr: string;
  nameEn: string;
  capacity: number;
  segmentCount: number;
}

function clusterWaterways(elements: OsmElement[]): Cluster[] {
  const used = new Set<number>();
  const clusters: Cluster[] = [];

  const dist = (a: OsmElement, b: OsmElement) => {
    const la = a.center?.lat ?? 0, lo = a.center?.lon ?? 0;
    const lb = b.center?.lat ?? 0, lo2 = b.center?.lon ?? 0;
    return Math.sqrt((la - lb) ** 2 + (lo - lo2) ** 2);
  };

  for (let i = 0; i < elements.length; i++) {
    if (used.has(i)) continue;
    const el = elements[i];
    if (!el.center?.lat) continue;

    const tags = el.tags ?? {};
    const name = tags.name ?? tags["name:ar"] ?? tags["name:en"] ?? "";
    const wtype = tags.waterway ?? "drain";
    const group: OsmElement[] = [el];
    used.add(i);

    for (let j = i + 1; j < elements.length; j++) {
      if (used.has(j)) continue;
      const el2 = elements[j];
      if (!el2.center?.lat) continue;
      const tags2 = el2.tags ?? {};
      const name2 = tags2.name ?? tags2["name:ar"] ?? tags2["name:en"] ?? "";
      const wtype2 = tags2.waterway ?? "drain";

      const sameName = name && name2 && (name === name2 || name.includes(name2) || name2.includes(name));
      const closeProximity = dist(el, el2) < 0.005 && wtype === wtype2;

      if (sameName || closeProximity) {
        group.push(el2);
        used.add(j);
      }
    }

    const lats = group.map((e) => e.center!.lat);
    const lngs = group.map((e) => e.center!.lon);
    const clat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const clng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

    const baseCapacity = { canal: 3000, drain: 800, stream: 5000, wadi: 10000 }[wtype] ?? 1000;
    const capacity = Math.round(baseCapacity * (1 + group.length * 0.1));

    const nameAr = tags["name:ar"] ?? (name && /[\u0600-\u06FF]/.test(name) ? name : "");
    const nameEn = tags["name:en"] ?? (name && !/[\u0600-\u06FF]/.test(name) ? name : "");

    clusters.push({
      lat: Math.round(clat * 100000) / 100000,
      lng: Math.round(clng * 100000) / 100000,
      type: wtype === "stream" ? "wadi" : wtype,
      nameAr,
      nameEn,
      capacity,
      segmentCount: group.length,
    });
  }

  return clusters;
}

// ── Open-Meteo soil moisture ──────────────────────────────────────────────────

interface SoilData {
  sm01: number;
  sm39: number;
}

async function fetchSoilMoisture(lat: number, lng: number): Promise<SoilData> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&hourly=soil_moisture_0_to_1cm,soil_moisture_3_to_9cm&forecast_days=1&timezone=UTC`;
    const body = await fetchUrl(url);
    const d = JSON.parse(body);
    const h = d.hourly ?? {};
    const sm01arr: (number | null)[] = h.soil_moisture_0_to_1cm ?? [];
    const sm39arr: (number | null)[] = h.soil_moisture_3_to_9cm ?? [];
    const sm01 = [...sm01arr].reverse().find((v) => v !== null) ?? 0.15;
    const sm39 = [...sm39arr].reverse().find((v) => v !== null) ?? 0.15;
    return { sm01: sm01 as number, sm39: sm39 as number };
  } catch {
    return { sm01: 0.15, sm39: 0.15 }; // desert fallback
  }
}

// ── Compute efficiency ────────────────────────────────────────────────────────

function computeEfficiency(
  sm01: number,
  sm39: number,
  type: string,
  capacity: number
): { efficiency: number; currentLoad: number; status: DrainageSystem["status"] } {
  // Normalize saturation: 0=dry, 1=saturated (max ~0.4 m³/m³ for sandy soil)
  const sat01 = Math.min(1.0, sm01 / 0.4);
  const sat39 = Math.min(1.0, sm39 / 0.4);
  const avgSat = sat01 * 0.4 + sat39 * 0.6; // deeper layer more important

  // Base efficiency by infrastructure type
  const baseEff = { canal: 75, drain: 70, wadi: 60, stream: 60 }[type] ?? 65;

  // Saturated soil → more runoff → drainage system under more stress
  const satPenalty = avgSat * 25;

  // Larger capacity → more resilient
  const capBonus = Math.min(10, capacity / 2000);

  const efficiency = Math.max(20, Math.min(95, baseEff - satPenalty + capBonus));
  const currentLoad = Math.max(10, Math.min(98, Math.round(100 - efficiency + avgSat * 20)));

  const status: DrainageSystem["status"] =
    efficiency >= 80 ? "operational" :
    efficiency >= 60 ? "degraded" :
    efficiency >= 40 ? "overloaded" : "blocked";

  return { efficiency: Math.round(efficiency * 10) / 10, currentLoad, status };
}

// ── Main fetch function ───────────────────────────────────────────────────────

export async function fetchDrainageSystems(): Promise<DrainageSystem[]> {
  // Return cached data if fresh
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS) {
    return _cache.data;
  }

  console.log("[drainageService] Fetching OSM waterways...");
  const elements = await fetchOsmWaterways();
  console.log(`[drainageService] Got ${elements.length} OSM elements`);

  const clusters = clusterWaterways(elements);
  console.log(`[drainageService] Clustered into ${clusters.length} drainage systems`);

  // Fetch soil moisture: group by 0.5° grid to minimise API calls
  const gridMap = new Map<string, SoilData>();
  const gridKeys = new Set<string>();
  for (const c of clusters) {
    const gk = `${Math.round(c.lat * 2) / 2},${Math.round(c.lng * 2) / 2}`;
    gridKeys.add(gk);
  }

  for (const gk of Array.from(gridKeys)) {
    const [glat, glng] = gk.split(",").map(Number);
    const soil = await fetchSoilMoisture(glat, glng);
    gridMap.set(gk, soil);
    await new Promise((r) => setTimeout(r, 80)); // polite delay
  }

  // Build enriched drainage systems
  const systems: DrainageSystem[] = clusters.map((c, idx) => {
    const gk = `${Math.round(c.lat * 2) / 2},${Math.round(c.lng * 2) / 2}`;
    const soil = gridMap.get(gk) ?? { sm01: 0.15, sm39: 0.15 };
    const { efficiency, currentLoad, status } = computeEfficiency(
      soil.sm01, soil.sm39, c.type, c.capacity
    );

    return {
      id: `osm-${idx}`,
      lat: c.lat,
      lng: c.lng,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      type: c.type as DrainageSystem["type"],
      capacity: c.capacity,
      efficiency,
      currentLoad,
      status,
      soilMoisture01: Math.round(soil.sm01 * 1000) / 1000,
      soilMoisture39: Math.round(soil.sm39 * 1000) / 1000,
      segmentCount: c.segmentCount,
    };
  });

  _cache = { data: systems, fetchedAt: Date.now() };
  console.log(`[drainageService] Cached ${systems.length} drainage systems`);
  return systems;
}

export function invalidateDrainageCache(): void {
  _cache = null;
}
