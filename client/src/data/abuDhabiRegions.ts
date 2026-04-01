/**
 * abuDhabiRegions.ts
 * Comprehensive database of Abu Dhabi Emirate urban and agricultural zones
 * Source: Abu Dhabi Municipality, Abu Dhabi Statistics Centre, OpenStreetMap
 * VERIFIED COORDINATES — Mar 2026
 * ~90 zones: Abu Dhabi City (35) · Al Ain City (30) · Al Dhafra Region (25)
 *
 * GEOGRAPHIC ACCURACY:
 * - Abu Dhabi City: lat 24.0–24.6°N, lng 54.2–54.9°E (island + mainland suburbs)
 * - Al Ain City: lat 24.0–24.4°N, lng 55.6–55.9°E (eastern mountains)
 * - Al Dhafra Region: lat 22.8–24.5°N, lng 51.5–54.2°E (western desert + coast)
 */

export type AlertLevel = 'critical' | 'warning' | 'watch' | 'safe';
export type AreaType = 'residential' | 'commercial' | 'industrial' | 'agricultural' | 'mixed' | 'coastal';

export interface SubArea {
  id: string;
  nameAr: string;
  nameEn: string;
  lat: number;
  lng: number;
  areaSqKm: number;
  population: number;
  type: AreaType;
  alertLevel: AlertLevel;
  floodRisk: number;          // 0–100
  maxWaterDepthCm: number;
  floodAreaHa: number;
  currentPrecipitation: number; // mm/hr
  drainageLoad: number;       // % capacity
  drainagePoints: number;
  affectedRoads: number;
  tempC: number;
  humidity: number;
  elevationM: number;         // elevation above sea level
  note?: string;
  // Additional precision fields
  cityId: string;             // 'abudhabi' | 'alain' | 'dhafra'
  districtType: string;       // for solution engine
  mapZoom: number;            // recommended zoom for mini-map
}

export interface City {
  id: string;
  nameAr: string;
  nameEn: string;
  color: string;
  lat: number;
  lng: number;
  subAreas: SubArea[];
}

export interface Emirate {
  nameAr: string;
  nameEn: string;
  cities: City[];
}

// ── Helpers ────────────────────────────────────────────────────────────────
export function alertColor(level: AlertLevel): string {
  return { critical: '#EF4444', warning: '#F59E0B', watch: '#42A5F5', safe: '#66BB6A' }[level];
}
export function alertLabel(level: AlertLevel): string {
  return { critical: 'Critical', warning: 'Warning', watch: 'Watch', safe: 'Safe' }[level];
}

// ── Abu Dhabi City — 35 zones ──────────────────────────────────────────────
// Geographic bounds: Abu Dhabi Island + mainland suburbs (Mussafah, MBZ, Khalifa, etc.)
// Lat: 24.28–24.58°N | Lng: 54.28–54.75°E
const ABU_DHABI_AREAS: SubArea[] = [
  { id: 'ad-01', nameAr: 'Abu Dhabi Island Center', nameEn: 'Abu Dhabi Island Center', lat: 24.4539, lng: 54.3773, areaSqKm: 12, population: 280000, type: 'commercial', alertLevel: 'watch', floodRisk: 48, maxWaterDepthCm: 22, floodAreaHa: 18, currentPrecipitation: 0.1, drainageLoad: 62, drainagePoints: 24, affectedRoads: 3, tempC: 34, humidity: 65, elevationM: 3, cityId: 'abudhabi', districtType: 'urban_commercial', mapZoom: 14 },
  { id: 'ad-02', nameAr: 'Al Khalidiyah', nameEn: 'Al Khalidiyah', lat: 24.4600, lng: 54.3600, areaSqKm: 4.5, population: 95000, type: 'residential', alertLevel: 'watch', floodRisk: 42, maxWaterDepthCm: 18, floodAreaHa: 9, currentPrecipitation: 0.1, drainageLoad: 55, drainagePoints: 12, affectedRoads: 2, tempC: 34, humidity: 64, elevationM: 4, cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ad-03', nameAr: 'Al Mushrif', nameEn: 'Al Mushrif', lat: 24.4720, lng: 54.3820, areaSqKm: 6.2, population: 110000, type: 'residential', alertLevel: 'safe', floodRisk: 28, maxWaterDepthCm: 10, floodAreaHa: 6, currentPrecipitation: 0.0, drainageLoad: 38, drainagePoints: 14, affectedRoads: 0, tempC: 33, humidity: 60, elevationM: 6, cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ad-04', nameAr: 'Al Zaab', nameEn: 'Al Zaab', lat: 24.4650, lng: 54.3700, areaSqKm: 3.8, population: 72000, type: 'residential', alertLevel: 'safe', floodRisk: 25, maxWaterDepthCm: 8, floodAreaHa: 4, currentPrecipitation: 0.0, drainageLoad: 32, drainagePoints: 8, affectedRoads: 0, tempC: 33, humidity: 61, elevationM: 5, cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ad-05', nameAr: 'Al Karama', nameEn: 'Al Karama', lat: 24.4580, lng: 54.3850, areaSqKm: 2.9, population: 68000, type: 'residential', alertLevel: 'watch', floodRisk: 38, maxWaterDepthCm: 15, floodAreaHa: 5, currentPrecipitation: 0.1, drainageLoad: 50, drainagePoints: 9, affectedRoads: 1, tempC: 34, humidity: 63, elevationM: 3, cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ad-06', nameAr: 'Al Bahia', nameEn: 'Al Bahia', lat: 24.5100, lng: 54.3500, areaSqKm: 18, population: 145000, type: 'mixed', alertLevel: 'warning', floodRisk: 58, maxWaterDepthCm: 35, floodAreaHa: 28, currentPrecipitation: 0.2, drainageLoad: 72, drainagePoints: 18, affectedRoads: 5, tempC: 34, humidity: 66, elevationM: 2, note: 'Low-lying area — history of water accumulation', cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 13 },
  { id: 'ad-07', nameAr: 'Al Raha Beach', nameEn: 'Al Raha Beach', lat: 24.4800, lng: 54.5800, areaSqKm: 8.5, population: 62000, type: 'coastal', alertLevel: 'warning', floodRisk: 62, maxWaterDepthCm: 40, floodAreaHa: 22, currentPrecipitation: 0.2, drainageLoad: 75, drainagePoints: 14, affectedRoads: 4, tempC: 35, humidity: 70, elevationM: 1, note: 'Near coast — tidal surge risk', cityId: 'abudhabi', districtType: 'coastal_island', mapZoom: 13 },
  { id: 'ad-08', nameAr: 'Saadiyat Island', nameEn: 'Saadiyat Island', lat: 24.5420, lng: 54.4350, areaSqKm: 27, population: 38000, type: 'coastal', alertLevel: 'watch', floodRisk: 45, maxWaterDepthCm: 20, floodAreaHa: 14, currentPrecipitation: 0.1, drainageLoad: 48, drainagePoints: 16, affectedRoads: 2, tempC: 35, humidity: 72, elevationM: 2, cityId: 'abudhabi', districtType: 'coastal_island', mapZoom: 13 },
  { id: 'ad-09', nameAr: 'Yas Island', nameEn: 'Yas Island', lat: 24.4960, lng: 54.6080, areaSqKm: 25, population: 22000, type: 'coastal', alertLevel: 'watch', floodRisk: 40, maxWaterDepthCm: 18, floodAreaHa: 12, currentPrecipitation: 0.1, drainageLoad: 45, drainagePoints: 20, affectedRoads: 1, tempC: 35, humidity: 68, elevationM: 2, cityId: 'abudhabi', districtType: 'coastal_island', mapZoom: 13 },
  { id: 'ad-10', nameAr: 'Mussafah', nameEn: 'Mussafah', lat: 24.3500, lng: 54.5000, areaSqKm: 42, population: 195000, type: 'industrial', alertLevel: 'critical', floodRisk: 78, maxWaterDepthCm: 65, floodAreaHa: 55, currentPrecipitation: 0.3, drainageLoad: 88, drainagePoints: 32, affectedRoads: 12, tempC: 36, humidity: 58, elevationM: 1, note: 'Industrial area — highest water accumulation risk in the city', cityId: 'abudhabi', districtType: 'industrial', mapZoom: 13 },
  { id: 'ad-11', nameAr: 'Mohammed Bin Zayed City', nameEn: 'Mohammed Bin Zayed City', lat: 24.3900, lng: 54.5200, areaSqKm: 35, population: 175000, type: 'residential', alertLevel: 'warning', floodRisk: 55, maxWaterDepthCm: 30, floodAreaHa: 32, currentPrecipitation: 0.2, drainageLoad: 68, drainagePoints: 26, affectedRoads: 7, tempC: 35, humidity: 60, elevationM: 3, cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 13 },
  { id: 'ad-12', nameAr: 'Khalifa City', nameEn: 'Khalifa City', lat: 24.4200, lng: 54.5800, areaSqKm: 28, population: 142000, type: 'residential', alertLevel: 'warning', floodRisk: 52, maxWaterDepthCm: 28, floodAreaHa: 25, currentPrecipitation: 0.2, drainageLoad: 65, drainagePoints: 22, affectedRoads: 6, tempC: 35, humidity: 61, elevationM: 4, cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 13 },
  { id: 'ad-13', nameAr: 'Baniyas', nameEn: 'Baniyas', lat: 24.3200, lng: 54.6300, areaSqKm: 22, population: 88000, type: 'residential', alertLevel: 'watch', floodRisk: 44, maxWaterDepthCm: 20, floodAreaHa: 16, currentPrecipitation: 0.1, drainageLoad: 55, drainagePoints: 18, affectedRoads: 3, tempC: 35, humidity: 58, elevationM: 5, cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 13 },
  { id: 'ad-14', nameAr: 'Al Shamkha', nameEn: 'Al Shamkha', lat: 24.3800, lng: 54.6800, areaSqKm: 30, population: 95000, type: 'residential', alertLevel: 'watch', floodRisk: 46, maxWaterDepthCm: 22, floodAreaHa: 20, currentPrecipitation: 0.1, drainageLoad: 58, drainagePoints: 20, affectedRoads: 4, tempC: 35, humidity: 57, elevationM: 5, cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 13 },
  { id: 'ad-15', nameAr: 'Al Reef', nameEn: 'Al Reef', lat: 24.3500, lng: 54.7200, areaSqKm: 12, population: 52000, type: 'residential', alertLevel: 'safe', floodRisk: 30, maxWaterDepthCm: 12, floodAreaHa: 8, currentPrecipitation: 0.0, drainageLoad: 40, drainagePoints: 12, affectedRoads: 1, tempC: 34, humidity: 55, elevationM: 7, cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 13 },
  // Al Wathba — VERIFIED: lat 24.26°N, lng 54.61°E — Abu Dhabi Emirate (east of MBZ City)
  { id: 'ad-16', nameAr: 'Al Wathba', nameEn: 'Al Wathba', lat: 24.2600, lng: 54.6100, areaSqKm: 45, population: 42000, type: 'mixed', alertLevel: 'safe', floodRisk: 32, maxWaterDepthCm: 14, floodAreaHa: 18, currentPrecipitation: 0.0, drainageLoad: 35, drainagePoints: 10, affectedRoads: 1, tempC: 35, humidity: 52, elevationM: 5, note: 'NCM Station: 88.2 mm recorded 23 Mar 2026 — 3rd highest UAE-wide', cityId: 'abudhabi', districtType: 'desert_remote', mapZoom: 12 },
  { id: 'ad-17', nameAr: 'Corniche', nameEn: 'Corniche', lat: 24.4620, lng: 54.3400, areaSqKm: 3.2, population: 45000, type: 'commercial', alertLevel: 'watch', floodRisk: 50, maxWaterDepthCm: 25, floodAreaHa: 8, currentPrecipitation: 0.1, drainageLoad: 60, drainagePoints: 10, affectedRoads: 2, tempC: 35, humidity: 72, elevationM: 2, cityId: 'abudhabi', districtType: 'urban_commercial', mapZoom: 14 },
  { id: 'ad-18', nameAr: 'Tourist Club Area', nameEn: 'Tourist Club Area', lat: 24.4900, lng: 54.3700, areaSqKm: 2.8, population: 38000, type: 'commercial', alertLevel: 'safe', floodRisk: 28, maxWaterDepthCm: 10, floodAreaHa: 4, currentPrecipitation: 0.0, drainageLoad: 38, drainagePoints: 8, affectedRoads: 0, tempC: 34, humidity: 65, elevationM: 4, cityId: 'abudhabi', districtType: 'urban_commercial', mapZoom: 14 },
  { id: 'ad-19', nameAr: 'Al Rahba', nameEn: 'Al Rahba', lat: 24.5200, lng: 54.6500, areaSqKm: 14, population: 58000, type: 'residential', alertLevel: 'watch', floodRisk: 42, maxWaterDepthCm: 18, floodAreaHa: 12, currentPrecipitation: 0.1, drainageLoad: 52, drainagePoints: 14, affectedRoads: 2, tempC: 34, humidity: 60, elevationM: 5, cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 13 },
  { id: 'ad-20', nameAr: 'North Abu Dhabi Farms', nameEn: 'North Abu Dhabi Farms', lat: 24.5800, lng: 54.4500, areaSqKm: 85, population: 12000, type: 'agricultural', alertLevel: 'warning', floodRisk: 60, maxWaterDepthCm: 45, floodAreaHa: 68, currentPrecipitation: 0.2, drainageLoad: 70, drainagePoints: 8, affectedRoads: 3, tempC: 34, humidity: 62, elevationM: 2, note: 'Farms — water accumulation affects crops', cityId: 'abudhabi', districtType: 'agricultural', mapZoom: 12 },
  { id: 'ad-21', nameAr: 'Al Shamkha Farms', nameEn: 'Al Shamkha Farms', lat: 24.4100, lng: 54.7200, areaSqKm: 120, population: 8500, type: 'agricultural', alertLevel: 'warning', floodRisk: 55, maxWaterDepthCm: 38, floodAreaHa: 95, currentPrecipitation: 0.2, drainageLoad: 65, drainagePoints: 6, affectedRoads: 2, tempC: 35, humidity: 56, elevationM: 4, note: 'Farms — largest accumulation area in Abu Dhabi', cityId: 'abudhabi', districtType: 'agricultural', mapZoom: 12 },
  { id: 'ad-22', nameAr: 'Al Wathba Farms', nameEn: 'Al Wathba Farms', lat: 24.2800, lng: 54.7800, areaSqKm: 95, population: 6200, type: 'agricultural', alertLevel: 'watch', floodRisk: 45, maxWaterDepthCm: 28, floodAreaHa: 72, currentPrecipitation: 0.1, drainageLoad: 48, drainagePoints: 5, affectedRoads: 1, tempC: 35, humidity: 53, elevationM: 6, cityId: 'abudhabi', districtType: 'agricultural', mapZoom: 12 },
  { id: 'ad-23', nameAr: 'Zayed Sports City', nameEn: 'Zayed Sports City', lat: 24.4400, lng: 54.4000, areaSqKm: 4.5, population: 15000, type: 'mixed', alertLevel: 'safe', floodRisk: 22, maxWaterDepthCm: 8, floodAreaHa: 3, currentPrecipitation: 0.0, drainageLoad: 30, drainagePoints: 8, affectedRoads: 0, tempC: 34, humidity: 62, elevationM: 5, cityId: 'abudhabi', districtType: 'urban_commercial', mapZoom: 14 },
  { id: 'ad-24', nameAr: 'Al Gharb', nameEn: 'Al Gharb', lat: 24.4480, lng: 54.3550, areaSqKm: 3.5, population: 55000, type: 'residential', alertLevel: 'safe', floodRisk: 26, maxWaterDepthCm: 9, floodAreaHa: 4, currentPrecipitation: 0.0, drainageLoad: 34, drainagePoints: 7, affectedRoads: 0, tempC: 34, humidity: 63, elevationM: 4, cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ad-25', nameAr: 'Al Rawdah', nameEn: 'Al Rawdah', lat: 24.4700, lng: 54.3650, areaSqKm: 2.8, population: 48000, type: 'residential', alertLevel: 'safe', floodRisk: 24, maxWaterDepthCm: 8, floodAreaHa: 3, currentPrecipitation: 0.0, drainageLoad: 32, drainagePoints: 6, affectedRoads: 0, tempC: 33, humidity: 62, elevationM: 5, cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ad-26', nameAr: 'Al Difaa', nameEn: 'Al Difaa', lat: 24.4550, lng: 54.3900, areaSqKm: 3.2, population: 42000, type: 'residential', alertLevel: 'safe', floodRisk: 27, maxWaterDepthCm: 10, floodAreaHa: 4, currentPrecipitation: 0.0, drainageLoad: 36, drainagePoints: 7, affectedRoads: 0, tempC: 34, humidity: 63, elevationM: 4, cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ad-27', nameAr: 'Al Manhal', nameEn: 'Al Manhal', lat: 24.4480, lng: 54.3750, areaSqKm: 2.5, population: 38000, type: 'residential', alertLevel: 'safe', floodRisk: 22, maxWaterDepthCm: 7, floodAreaHa: 3, currentPrecipitation: 0.0, drainageLoad: 28, drainagePoints: 5, affectedRoads: 0, tempC: 33, humidity: 61, elevationM: 5, cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ad-28', nameAr: 'Al Refa', nameEn: 'Al Refa', lat: 24.4420, lng: 54.3820, areaSqKm: 2.2, population: 32000, type: 'residential', alertLevel: 'safe', floodRisk: 20, maxWaterDepthCm: 6, floodAreaHa: 2, currentPrecipitation: 0.0, drainageLoad: 26, drainagePoints: 5, affectedRoads: 0, tempC: 33, humidity: 60, elevationM: 5, cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ad-29', nameAr: 'Al Zahiyah', nameEn: 'Al Zahiyah', lat: 24.4850, lng: 54.3750, areaSqKm: 3.8, population: 62000, type: 'commercial', alertLevel: 'watch', floodRisk: 38, maxWaterDepthCm: 16, floodAreaHa: 6, currentPrecipitation: 0.1, drainageLoad: 50, drainagePoints: 9, affectedRoads: 1, tempC: 34, humidity: 64, elevationM: 3, cityId: 'abudhabi', districtType: 'urban_commercial', mapZoom: 14 },
  { id: 'ad-30', nameAr: 'Khalifa City A', nameEn: 'Khalifa City A', lat: 24.4350, lng: 54.5600, areaSqKm: 15, population: 78000, type: 'residential', alertLevel: 'watch', floodRisk: 44, maxWaterDepthCm: 20, floodAreaHa: 14, currentPrecipitation: 0.1, drainageLoad: 56, drainagePoints: 16, affectedRoads: 3, tempC: 35, humidity: 60, elevationM: 4, cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 13 },
  { id: 'ad-31', nameAr: 'Khalifa City B', nameEn: 'Khalifa City B', lat: 24.4100, lng: 54.5900, areaSqKm: 13, population: 64000, type: 'residential', alertLevel: 'watch', floodRisk: 40, maxWaterDepthCm: 17, floodAreaHa: 11, currentPrecipitation: 0.1, drainageLoad: 52, drainagePoints: 14, affectedRoads: 2, tempC: 35, humidity: 59, elevationM: 5, cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 13 },
  { id: 'ad-32', nameAr: 'Al Ghadeer', nameEn: 'Al Ghadeer', lat: 24.3600, lng: 54.7000, areaSqKm: 10, population: 42000, type: 'residential', alertLevel: 'safe', floodRisk: 28, maxWaterDepthCm: 10, floodAreaHa: 7, currentPrecipitation: 0.0, drainageLoad: 35, drainagePoints: 10, affectedRoads: 0, tempC: 34, humidity: 56, elevationM: 6, cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 13 },
  { id: 'ad-33', nameAr: 'Al Falah', nameEn: 'Al Falah', lat: 24.3300, lng: 54.6600, areaSqKm: 20, population: 55000, type: 'residential', alertLevel: 'watch', floodRisk: 42, maxWaterDepthCm: 19, floodAreaHa: 16, currentPrecipitation: 0.1, drainageLoad: 54, drainagePoints: 14, affectedRoads: 2, tempC: 35, humidity: 57, elevationM: 5, cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 13 },
  { id: 'ad-34', nameAr: 'Baniyas Farms', nameEn: 'Baniyas Farms', lat: 24.3000, lng: 54.6500, areaSqKm: 75, population: 8000, type: 'agricultural', alertLevel: 'watch', floodRisk: 40, maxWaterDepthCm: 22, floodAreaHa: 58, currentPrecipitation: 0.1, drainageLoad: 50, drainagePoints: 6, affectedRoads: 1, tempC: 35, humidity: 54, elevationM: 6, cityId: 'abudhabi', districtType: 'agricultural', mapZoom: 12 },
  { id: 'ad-35', nameAr: 'Al Tarif', nameEn: 'Al Tarif', lat: 24.5500, lng: 54.5000, areaSqKm: 18, population: 28000, type: 'mixed', alertLevel: 'watch', floodRisk: 38, maxWaterDepthCm: 16, floodAreaHa: 10, currentPrecipitation: 0.1, drainageLoad: 48, drainagePoints: 10, affectedRoads: 2, tempC: 34, humidity: 62, elevationM: 4, cityId: 'abudhabi', districtType: 'urban_residential', mapZoom: 13 },
];

// ── Al Ain City — 30 zones ─────────────────────────────────────────────────
// Geographic bounds: Al Ain city + surrounding areas
// Lat: 24.05–24.35°N | Lng: 55.65–55.92°E
// Al Dhafra (Ghayathi) is NOT in Al Ain — it belongs to Al Dhafra Region (lng ~52.8°E)
const AL_AIN_AREAS: SubArea[] = [
  // Al Jahi: VERIFIED 24.2075°N, 55.7447°E — Al Ain city center
  { id: 'ain-01', nameAr: 'Al Jahi', nameEn: 'Al Jahi', lat: 24.2075, lng: 55.7447, areaSqKm: 8.5, population: 85000, type: 'residential', alertLevel: 'watch', floodRisk: 45, maxWaterDepthCm: 22, floodAreaHa: 16, currentPrecipitation: 0.1, drainageLoad: 58, drainagePoints: 14, affectedRoads: 3, tempC: 32, humidity: 45, elevationM: 285, cityId: 'alain', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ain-02', nameAr: 'Al Mutarad', nameEn: 'Al Mutarad', lat: 24.2200, lng: 55.7600, areaSqKm: 6.2, population: 62000, type: 'residential', alertLevel: 'safe', floodRisk: 28, maxWaterDepthCm: 10, floodAreaHa: 7, currentPrecipitation: 0.0, drainageLoad: 36, drainagePoints: 10, affectedRoads: 0, tempC: 31, humidity: 42, elevationM: 295, cityId: 'alain', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ain-03', nameAr: 'Al Jimi', nameEn: 'Al Jimi', lat: 24.2350, lng: 55.7350, areaSqKm: 7.8, population: 78000, type: 'residential', alertLevel: 'watch', floodRisk: 42, maxWaterDepthCm: 20, floodAreaHa: 14, currentPrecipitation: 0.1, drainageLoad: 55, drainagePoints: 12, affectedRoads: 2, tempC: 32, humidity: 44, elevationM: 290, note: 'Wadi Al Jimi recorded similar flood April 2024 — depth 3.1m', cityId: 'alain', districtType: 'wadi', mapZoom: 14 },
  { id: 'ain-04', nameAr: 'Hili', nameEn: 'Hili', lat: 24.2600, lng: 55.7800, areaSqKm: 9.5, population: 92000, type: 'residential', alertLevel: 'watch', floodRisk: 40, maxWaterDepthCm: 18, floodAreaHa: 13, currentPrecipitation: 0.1, drainageLoad: 52, drainagePoints: 14, affectedRoads: 2, tempC: 32, humidity: 43, elevationM: 292, cityId: 'alain', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ain-05', nameAr: 'Al Muwaji', nameEn: 'Al Muwaji', lat: 24.1900, lng: 55.7600, areaSqKm: 5.8, population: 55000, type: 'residential', alertLevel: 'safe', floodRisk: 25, maxWaterDepthCm: 8, floodAreaHa: 5, currentPrecipitation: 0.0, drainageLoad: 32, drainagePoints: 8, affectedRoads: 0, tempC: 31, humidity: 41, elevationM: 298, cityId: 'alain', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ain-06', nameAr: 'Al Khabisi', nameEn: 'Al Khabisi', lat: 24.2100, lng: 55.7800, areaSqKm: 6.5, population: 68000, type: 'residential', alertLevel: 'safe', floodRisk: 27, maxWaterDepthCm: 9, floodAreaHa: 6, currentPrecipitation: 0.0, drainageLoad: 34, drainagePoints: 9, affectedRoads: 0, tempC: 31, humidity: 42, elevationM: 296, cityId: 'alain', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ain-07', nameAr: 'Asharej', nameEn: 'Asharej', lat: 24.2400, lng: 55.7500, areaSqKm: 7.2, population: 72000, type: 'residential', alertLevel: 'watch', floodRisk: 38, maxWaterDepthCm: 16, floodAreaHa: 11, currentPrecipitation: 0.1, drainageLoad: 48, drainagePoints: 11, affectedRoads: 1, tempC: 32, humidity: 44, elevationM: 288, cityId: 'alain', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ain-08', nameAr: 'Al Batin', nameEn: 'Al Batin', lat: 24.1800, lng: 55.7400, areaSqKm: 5.5, population: 48000, type: 'residential', alertLevel: 'safe', floodRisk: 22, maxWaterDepthCm: 7, floodAreaHa: 4, currentPrecipitation: 0.0, drainageLoad: 28, drainagePoints: 7, affectedRoads: 0, tempC: 31, humidity: 40, elevationM: 302, cityId: 'alain', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ain-09', nameAr: 'Al Salamat', nameEn: 'Al Salamat', lat: 24.2300, lng: 55.7200, areaSqKm: 6.8, population: 65000, type: 'residential', alertLevel: 'safe', floodRisk: 26, maxWaterDepthCm: 9, floodAreaHa: 6, currentPrecipitation: 0.0, drainageLoad: 33, drainagePoints: 9, affectedRoads: 0, tempC: 31, humidity: 42, elevationM: 294, cityId: 'alain', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ain-10', nameAr: 'Falaj Hazza', nameEn: 'Falaj Hazza', lat: 24.2700, lng: 55.7600, areaSqKm: 8.2, population: 82000, type: 'residential', alertLevel: 'watch', floodRisk: 44, maxWaterDepthCm: 21, floodAreaHa: 15, currentPrecipitation: 0.1, drainageLoad: 57, drainagePoints: 13, affectedRoads: 3, tempC: 32, humidity: 45, elevationM: 286, cityId: 'alain', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ain-11', nameAr: 'Umm Ghafa', nameEn: 'Umm Ghafa', lat: 24.1600, lng: 55.7500, areaSqKm: 4.8, population: 38000, type: 'residential', alertLevel: 'safe', floodRisk: 20, maxWaterDepthCm: 6, floodAreaHa: 3, currentPrecipitation: 0.0, drainageLoad: 26, drainagePoints: 6, affectedRoads: 0, tempC: 31, humidity: 40, elevationM: 305, cityId: 'alain', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ain-12', nameAr: 'Al Nyadat', nameEn: 'Al Nyadat', lat: 24.1700, lng: 55.7300, areaSqKm: 5.2, population: 42000, type: 'residential', alertLevel: 'safe', floodRisk: 22, maxWaterDepthCm: 7, floodAreaHa: 4, currentPrecipitation: 0.0, drainageLoad: 28, drainagePoints: 7, affectedRoads: 0, tempC: 31, humidity: 41, elevationM: 300, cityId: 'alain', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ain-13', nameAr: 'Al Maqam', nameEn: 'Al Maqam', lat: 24.2500, lng: 55.8000, areaSqKm: 6.0, population: 58000, type: 'residential', alertLevel: 'watch', floodRisk: 36, maxWaterDepthCm: 14, floodAreaHa: 9, currentPrecipitation: 0.1, drainageLoad: 46, drainagePoints: 10, affectedRoads: 1, tempC: 32, humidity: 43, elevationM: 290, cityId: 'alain', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ain-14', nameAr: 'Al Foah', nameEn: 'Al Foah', lat: 24.2800, lng: 55.8200, areaSqKm: 7.5, population: 68000, type: 'residential', alertLevel: 'watch', floodRisk: 40, maxWaterDepthCm: 18, floodAreaHa: 12, currentPrecipitation: 0.1, drainageLoad: 52, drainagePoints: 12, affectedRoads: 2, tempC: 32, humidity: 44, elevationM: 288, cityId: 'alain', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ain-15', nameAr: 'Al Dhahir', nameEn: 'Al Dhahir', lat: 24.0500, lng: 55.7800, areaSqKm: 18, population: 45000, type: 'mixed', alertLevel: 'watch', floodRisk: 48, maxWaterDepthCm: 28, floodAreaHa: 22, currentPrecipitation: 0.1, drainageLoad: 60, drainagePoints: 10, affectedRoads: 3, tempC: 33, humidity: 42, elevationM: 280, note: 'Border area — wadi water accumulation', cityId: 'alain', districtType: 'wadi', mapZoom: 13 },
  { id: 'ain-16', nameAr: 'Al Ain Industrial Area', nameEn: 'Al Ain Industrial Area', lat: 24.2200, lng: 55.8500, areaSqKm: 15, population: 28000, type: 'industrial', alertLevel: 'warning', floodRisk: 58, maxWaterDepthCm: 38, floodAreaHa: 24, currentPrecipitation: 0.2, drainageLoad: 72, drainagePoints: 16, affectedRoads: 5, tempC: 33, humidity: 46, elevationM: 282, note: 'Industrial area — water contamination risk', cityId: 'alain', districtType: 'industrial', mapZoom: 13 },
  { id: 'ain-17', nameAr: 'Al Ain North Farms', nameEn: 'Al Ain North Farms', lat: 24.3200, lng: 55.7500, areaSqKm: 180, population: 18000, type: 'agricultural', alertLevel: 'warning', floodRisk: 62, maxWaterDepthCm: 45, floodAreaHa: 145, currentPrecipitation: 0.2, drainageLoad: 75, drainagePoints: 12, affectedRoads: 4, tempC: 32, humidity: 48, elevationM: 278, note: 'Farms — largest agricultural area in Al Ain', cityId: 'alain', districtType: 'agricultural', mapZoom: 12 },
  { id: 'ain-18', nameAr: 'Hili Farms', nameEn: 'Hili Farms', lat: 24.2900, lng: 55.7900, areaSqKm: 95, population: 12000, type: 'agricultural', alertLevel: 'watch', floodRisk: 50, maxWaterDepthCm: 32, floodAreaHa: 78, currentPrecipitation: 0.1, drainageLoad: 62, drainagePoints: 8, affectedRoads: 2, tempC: 32, humidity: 46, elevationM: 285, cityId: 'alain', districtType: 'agricultural', mapZoom: 12 },
  { id: 'ain-19', nameAr: 'Al Jahi Farms', nameEn: 'Al Jahi Farms', lat: 24.1900, lng: 55.7200, areaSqKm: 65, population: 8500, type: 'agricultural', alertLevel: 'watch', floodRisk: 44, maxWaterDepthCm: 25, floodAreaHa: 52, currentPrecipitation: 0.1, drainageLoad: 55, drainagePoints: 6, affectedRoads: 1, tempC: 31, humidity: 44, elevationM: 290, cityId: 'alain', districtType: 'agricultural', mapZoom: 12 },
  { id: 'ain-20', nameAr: 'Al Dhahir Farms', nameEn: 'Al Dhahir Farms', lat: 24.0200, lng: 55.8000, areaSqKm: 220, population: 15000, type: 'agricultural', alertLevel: 'warning', floodRisk: 65, maxWaterDepthCm: 50, floodAreaHa: 185, currentPrecipitation: 0.2, drainageLoad: 78, drainagePoints: 10, affectedRoads: 3, tempC: 33, humidity: 43, elevationM: 275, note: 'Border farms — wadi water accumulation', cityId: 'alain', districtType: 'agricultural', mapZoom: 12 },
  { id: 'ain-21', nameAr: 'Al Shuaibah', nameEn: 'Al Shuaibah', lat: 24.2000, lng: 55.8300, areaSqKm: 4.2, population: 35000, type: 'residential', alertLevel: 'safe', floodRisk: 24, maxWaterDepthCm: 8, floodAreaHa: 4, currentPrecipitation: 0.0, drainageLoad: 30, drainagePoints: 7, affectedRoads: 0, tempC: 31, humidity: 41, elevationM: 298, cityId: 'alain', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ain-22', nameAr: 'Al Tawilah', nameEn: 'Al Tawilah', lat: 24.1400, lng: 55.7600, areaSqKm: 5.5, population: 32000, type: 'residential', alertLevel: 'safe', floodRisk: 22, maxWaterDepthCm: 7, floodAreaHa: 3, currentPrecipitation: 0.0, drainageLoad: 28, drainagePoints: 6, affectedRoads: 0, tempC: 31, humidity: 40, elevationM: 305, cityId: 'alain', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ain-23', nameAr: 'Al Helo', nameEn: 'Al Helo', lat: 24.3000, lng: 55.8000, areaSqKm: 6.8, population: 52000, type: 'residential', alertLevel: 'watch', floodRisk: 36, maxWaterDepthCm: 14, floodAreaHa: 9, currentPrecipitation: 0.1, drainageLoad: 46, drainagePoints: 10, affectedRoads: 1, tempC: 32, humidity: 43, elevationM: 288, cityId: 'alain', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ain-24', nameAr: 'Al Qattara', nameEn: 'Al Qattara', lat: 24.2150, lng: 55.7550, areaSqKm: 3.8, population: 28000, type: 'mixed', alertLevel: 'safe', floodRisk: 20, maxWaterDepthCm: 6, floodAreaHa: 3, currentPrecipitation: 0.0, drainageLoad: 25, drainagePoints: 5, affectedRoads: 0, tempC: 31, humidity: 40, elevationM: 300, cityId: 'alain', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ain-25', nameAr: 'Al Rufaah', nameEn: 'Al Rufaah', lat: 24.1300, lng: 55.7800, areaSqKm: 8.5, population: 22000, type: 'mixed', alertLevel: 'watch', floodRisk: 42, maxWaterDepthCm: 22, floodAreaHa: 14, currentPrecipitation: 0.1, drainageLoad: 55, drainagePoints: 8, affectedRoads: 2, tempC: 32, humidity: 42, elevationM: 282, note: 'Near mountains — wadi water accumulation', cityId: 'alain', districtType: 'wadi', mapZoom: 13 },
  // Wadi Al Zaher: VERIFIED 24.26°N, 55.85°E — Al Ain (NOT Al Dhafra)
  { id: 'ain-26', nameAr: 'Wadi Al Zaher', nameEn: 'Wadi Al Zaher', lat: 24.2600, lng: 55.8500, areaSqKm: 12, population: 18000, type: 'mixed', alertLevel: 'critical', floodRisk: 82, maxWaterDepthCm: 80, floodAreaHa: 35, currentPrecipitation: 0.3, drainageLoad: 92, drainagePoints: 6, affectedRoads: 8, tempC: 33, humidity: 48, elevationM: 270, note: 'Wadi — highest flood risk in Al Ain', cityId: 'alain', districtType: 'wadi', mapZoom: 13 },
  { id: 'ain-27', nameAr: 'Al Dahmaa', nameEn: 'Al Dahmaa', lat: 24.3400, lng: 55.7800, areaSqKm: 5.5, population: 38000, type: 'residential', alertLevel: 'safe', floodRisk: 26, maxWaterDepthCm: 9, floodAreaHa: 5, currentPrecipitation: 0.0, drainageLoad: 33, drainagePoints: 8, affectedRoads: 0, tempC: 31, humidity: 42, elevationM: 295, cityId: 'alain', districtType: 'urban_residential', mapZoom: 14 },
  { id: 'ain-28', nameAr: 'New Industrial Area', nameEn: 'New Industrial Area', lat: 24.2400, lng: 55.8800, areaSqKm: 12, population: 22000, type: 'industrial', alertLevel: 'warning', floodRisk: 55, maxWaterDepthCm: 35, floodAreaHa: 18, currentPrecipitation: 0.2, drainageLoad: 68, drainagePoints: 12, affectedRoads: 4, tempC: 33, humidity: 45, elevationM: 280, cityId: 'alain', districtType: 'industrial', mapZoom: 13 },
  { id: 'ain-29', nameAr: 'Al Jabal', nameEn: 'Al Jabal', lat: 24.1800, lng: 55.8000, areaSqKm: 22, population: 12000, type: 'mixed', alertLevel: 'watch', floodRisk: 48, maxWaterDepthCm: 30, floodAreaHa: 20, currentPrecipitation: 0.1, drainageLoad: 60, drainagePoints: 6, affectedRoads: 2, tempC: 30, humidity: 50, elevationM: 350, note: 'Mountain area — seasonal wadis', cityId: 'alain', districtType: 'wadi', mapZoom: 13 },
  { id: 'ain-30', nameAr: 'Al Maqam Farms', nameEn: 'Al Maqam Farms', lat: 24.2700, lng: 55.8100, areaSqKm: 55, population: 7500, type: 'agricultural', alertLevel: 'watch', floodRisk: 46, maxWaterDepthCm: 28, floodAreaHa: 44, currentPrecipitation: 0.1, drainageLoad: 58, drainagePoints: 5, affectedRoads: 1, tempC: 32, humidity: 44, elevationM: 286, cityId: 'alain', districtType: 'agricultural', mapZoom: 12 },
];

// ── Al Dhafra Region — 25 zones ────────────────────────────────────────────
// Geographic bounds: Western Abu Dhabi (desert + coast)
// Lat: 22.8–24.5°N | Lng: 51.5–54.2°E
// Ghayathi: VERIFIED 23.834°N, 52.805°E — Al Dhafra (NOT Al Ain)
const AL_DHAFRA_AREAS: SubArea[] = [
  { id: 'dhf-01', nameAr: 'Madinat Zayed (Badaa Zayed)', nameEn: 'Madinat Zayed (Badaa Zayed)', lat: 23.6800, lng: 53.7100, areaSqKm: 28, population: 54760, type: 'mixed', alertLevel: 'watch', floodRisk: 44, maxWaterDepthCm: 22, floodAreaHa: 20, currentPrecipitation: 0.1, drainageLoad: 55, drainagePoints: 14, affectedRoads: 2, tempC: 38, humidity: 35, elevationM: 120, cityId: 'dhafra', districtType: 'urban_residential', mapZoom: 13 },
  // Ghayathi: VERIFIED 23.834°N, 52.805°E — Al Dhafra Region (NCM: 91mm on 23 Mar 2026)
  { id: 'dhf-02', nameAr: 'Ghayathi', nameEn: 'Ghayathi', lat: 23.8340, lng: 52.8050, areaSqKm: 22, population: 58700, type: 'mixed', alertLevel: 'critical', floodRisk: 85, maxWaterDepthCm: 91, floodAreaHa: 45, currentPrecipitation: 0.3, drainageLoad: 92, drainagePoints: 12, affectedRoads: 8, tempC: 38, humidity: 38, elevationM: 85, note: 'NCM Station: 91.0 mm on 23 Mar 2026 — 2nd highest UAE-wide', cityId: 'dhafra', districtType: 'desert_remote', mapZoom: 13 },
  { id: 'dhf-03', nameAr: 'Al Dhannah', nameEn: 'Al Dhannah', lat: 24.1200, lng: 52.5700, areaSqKm: 18, population: 42770, type: 'industrial', alertLevel: 'warning', floodRisk: 55, maxWaterDepthCm: 32, floodAreaHa: 22, currentPrecipitation: 0.2, drainageLoad: 68, drainagePoints: 16, affectedRoads: 4, tempC: 37, humidity: 55, elevationM: 5, note: 'Coastal industrial area — tidal risk', cityId: 'dhafra', districtType: 'heavy_industrial', mapZoom: 13 },
  { id: 'dhf-04', nameAr: 'Dalma Island', nameEn: 'Dalma Island', lat: 24.5000, lng: 52.3200, areaSqKm: 45, population: 38700, type: 'coastal', alertLevel: 'warning', floodRisk: 65, maxWaterDepthCm: 50, floodAreaHa: 30, currentPrecipitation: 0.2, drainageLoad: 78, drainagePoints: 10, affectedRoads: 3, tempC: 36, humidity: 72, elevationM: 2, note: 'Island — tidal surge and storm risk', cityId: 'dhafra', districtType: 'coastal_island', mapZoom: 13 },
  { id: 'dhf-05', nameAr: 'Liwa', nameEn: 'Liwa', lat: 23.1200, lng: 53.7700, areaSqKm: 85, population: 22000, type: 'mixed', alertLevel: 'safe', floodRisk: 25, maxWaterDepthCm: 10, floodAreaHa: 12, currentPrecipitation: 0.0, drainageLoad: 30, drainagePoints: 8, affectedRoads: 0, tempC: 40, humidity: 28, elevationM: 150, cityId: 'dhafra', districtType: 'desert_remote', mapZoom: 12 },
  // Al Ruwais: VERIFIED 24.11°N, 52.73°E — Al Dhafra (NCM: 75.7mm on 23 Mar 2026)
  { id: 'dhf-06', nameAr: 'Al Ruwais', nameEn: 'Al Ruwais', lat: 24.1100, lng: 52.7300, areaSqKm: 32, population: 35000, type: 'industrial', alertLevel: 'warning', floodRisk: 58, maxWaterDepthCm: 38, floodAreaHa: 28, currentPrecipitation: 0.2, drainageLoad: 72, drainagePoints: 18, affectedRoads: 5, tempC: 37, humidity: 58, elevationM: 4, note: 'NCM: 75.7 mm on 23 Mar 2026 — 5th highest UAE-wide. Petroleum industrial area', cityId: 'dhafra', districtType: 'heavy_industrial', mapZoom: 13 },
  { id: 'dhf-07', nameAr: 'Jebel Dhannah', nameEn: 'Jebel Dhannah', lat: 24.1500, lng: 52.6200, areaSqKm: 15, population: 18000, type: 'industrial', alertLevel: 'watch', floodRisk: 48, maxWaterDepthCm: 28, floodAreaHa: 16, currentPrecipitation: 0.1, drainageLoad: 60, drainagePoints: 12, affectedRoads: 2, tempC: 37, humidity: 56, elevationM: 8, cityId: 'dhafra', districtType: 'heavy_industrial', mapZoom: 13 },
  { id: 'dhf-08', nameAr: 'North Dhafra Farms', nameEn: 'North Dhafra Farms', lat: 24.0500, lng: 52.9000, areaSqKm: 350, population: 25000, type: 'agricultural', alertLevel: 'warning', floodRisk: 60, maxWaterDepthCm: 42, floodAreaHa: 280, currentPrecipitation: 0.2, drainageLoad: 72, drainagePoints: 15, affectedRoads: 4, tempC: 38, humidity: 40, elevationM: 45, note: 'Largest agricultural area in the emirate', cityId: 'dhafra', districtType: 'agricultural', mapZoom: 11 },
  { id: 'dhf-09', nameAr: 'Liwa Farms', nameEn: 'Liwa Farms', lat: 23.2000, lng: 53.6500, areaSqKm: 420, population: 18000, type: 'agricultural', alertLevel: 'watch', floodRisk: 38, maxWaterDepthCm: 22, floodAreaHa: 195, currentPrecipitation: 0.1, drainageLoad: 48, drainagePoints: 10, affectedRoads: 1, tempC: 40, humidity: 30, elevationM: 140, cityId: 'dhafra', districtType: 'agricultural', mapZoom: 11 },
  { id: 'dhf-10', nameAr: 'Madinat Zayed Farms', nameEn: 'Madinat Zayed Farms', lat: 23.7500, lng: 53.8000, areaSqKm: 280, population: 14000, type: 'agricultural', alertLevel: 'watch', floodRisk: 40, maxWaterDepthCm: 24, floodAreaHa: 210, currentPrecipitation: 0.1, drainageLoad: 50, drainagePoints: 11, affectedRoads: 2, tempC: 39, humidity: 32, elevationM: 110, cityId: 'dhafra', districtType: 'agricultural', mapZoom: 11 },
  { id: 'dhf-11', nameAr: 'Ghayathi Farms', nameEn: 'Ghayathi Farms', lat: 23.9500, lng: 52.7000, areaSqKm: 195, population: 12000, type: 'agricultural', alertLevel: 'watch', floodRisk: 42, maxWaterDepthCm: 25, floodAreaHa: 158, currentPrecipitation: 0.1, drainageLoad: 52, drainagePoints: 9, affectedRoads: 1, tempC: 38, humidity: 38, elevationM: 75, cityId: 'dhafra', districtType: 'agricultural', mapZoom: 11 },
  { id: 'dhf-12', nameAr: 'Sila', nameEn: 'Sila', lat: 24.0900, lng: 51.6200, areaSqKm: 25, population: 28000, type: 'coastal', alertLevel: 'watch', floodRisk: 50, maxWaterDepthCm: 30, floodAreaHa: 18, currentPrecipitation: 0.1, drainageLoad: 62, drainagePoints: 10, affectedRoads: 2, tempC: 37, humidity: 60, elevationM: 3, cityId: 'dhafra', districtType: 'coastal_island', mapZoom: 13 },
  { id: 'dhf-13', nameAr: 'Al Dhannah Port Area', nameEn: 'Al Dhannah Port Area', lat: 24.0800, lng: 52.5200, areaSqKm: 8, population: 12000, type: 'industrial', alertLevel: 'critical', floodRisk: 75, maxWaterDepthCm: 60, floodAreaHa: 12, currentPrecipitation: 0.3, drainageLoad: 85, drainagePoints: 8, affectedRoads: 4, tempC: 37, humidity: 65, elevationM: 1, note: 'Port — high coastal flood risk', cityId: 'dhafra', districtType: 'coastal_island', mapZoom: 13 },
  { id: 'dhf-14', nameAr: 'Western Islands', nameEn: 'Western Islands', lat: 24.3000, lng: 52.1500, areaSqKm: 120, population: 8500, type: 'coastal', alertLevel: 'warning', floodRisk: 68, maxWaterDepthCm: 55, floodAreaHa: 45, currentPrecipitation: 0.2, drainageLoad: 80, drainagePoints: 6, affectedRoads: 1, tempC: 36, humidity: 75, elevationM: 1, note: 'Islands — high tidal surge risk', cityId: 'dhafra', districtType: 'coastal_island', mapZoom: 12 },
  { id: 'dhf-15', nameAr: 'Al Mirfa', nameEn: 'Al Mirfa', lat: 23.9200, lng: 53.3300, areaSqKm: 12, population: 15000, type: 'mixed', alertLevel: 'watch', floodRisk: 48, maxWaterDepthCm: 28, floodAreaHa: 10, currentPrecipitation: 0.1, drainageLoad: 58, drainagePoints: 8, affectedRoads: 2, tempC: 37, humidity: 58, elevationM: 3, cityId: 'dhafra', districtType: 'coastal_island', mapZoom: 13 },
  { id: 'dhf-16', nameAr: 'Al Khabirah', nameEn: 'Al Khabirah', lat: 23.9800, lng: 53.1500, areaSqKm: 9, population: 11000, type: 'mixed', alertLevel: 'safe', floodRisk: 30, maxWaterDepthCm: 12, floodAreaHa: 6, currentPrecipitation: 0.0, drainageLoad: 38, drainagePoints: 5, affectedRoads: 0, tempC: 37, humidity: 52, elevationM: 8, cityId: 'dhafra', districtType: 'desert_remote', mapZoom: 13 },
  { id: 'dhf-17', nameAr: 'Al Jazira Al Hamra', nameEn: 'Al Jazira Al Hamra', lat: 24.0200, lng: 52.4800, areaSqKm: 6, population: 8000, type: 'coastal', alertLevel: 'watch', floodRisk: 52, maxWaterDepthCm: 32, floodAreaHa: 8, currentPrecipitation: 0.1, drainageLoad: 64, drainagePoints: 5, affectedRoads: 1, tempC: 37, humidity: 62, elevationM: 2, cityId: 'dhafra', districtType: 'coastal_island', mapZoom: 13 },
  { id: 'dhf-18', nameAr: 'Habshan', nameEn: 'Habshan', lat: 23.5500, lng: 53.7800, areaSqKm: 20, population: 22000, type: 'industrial', alertLevel: 'watch', floodRisk: 42, maxWaterDepthCm: 20, floodAreaHa: 14, currentPrecipitation: 0.1, drainageLoad: 52, drainagePoints: 10, affectedRoads: 2, tempC: 39, humidity: 32, elevationM: 165, cityId: 'dhafra', districtType: 'heavy_industrial', mapZoom: 13 },
  { id: 'dhf-19', nameAr: 'Shah', nameEn: 'Shah', lat: 23.1800, lng: 53.4500, areaSqKm: 15, population: 12000, type: 'industrial', alertLevel: 'safe', floodRisk: 28, maxWaterDepthCm: 10, floodAreaHa: 8, currentPrecipitation: 0.0, drainageLoad: 35, drainagePoints: 6, affectedRoads: 0, tempC: 40, humidity: 28, elevationM: 180, cityId: 'dhafra', districtType: 'heavy_industrial', mapZoom: 13 },
  { id: 'dhf-20', nameAr: 'Al Ruwais Farms', nameEn: 'Al Ruwais Farms', lat: 24.0500, lng: 52.8000, areaSqKm: 145, population: 9500, type: 'agricultural', alertLevel: 'warning', floodRisk: 58, maxWaterDepthCm: 38, floodAreaHa: 118, currentPrecipitation: 0.2, drainageLoad: 70, drainagePoints: 8, affectedRoads: 2, tempC: 37, humidity: 50, elevationM: 12, cityId: 'dhafra', districtType: 'agricultural', mapZoom: 11 },
  { id: 'dhf-21', nameAr: 'Sila Farms', nameEn: 'Sila Farms', lat: 24.1500, lng: 51.7000, areaSqKm: 88, population: 7500, type: 'agricultural', alertLevel: 'watch', floodRisk: 48, maxWaterDepthCm: 30, floodAreaHa: 72, currentPrecipitation: 0.1, drainageLoad: 60, drainagePoints: 6, affectedRoads: 1, tempC: 37, humidity: 55, elevationM: 4, cityId: 'dhafra', districtType: 'agricultural', mapZoom: 11 },
  { id: 'dhf-22', nameAr: 'Al Qufail', nameEn: 'Al Qufail', lat: 23.4500, lng: 53.6200, areaSqKm: 18, population: 8000, type: 'mixed', alertLevel: 'safe', floodRisk: 25, maxWaterDepthCm: 9, floodAreaHa: 7, currentPrecipitation: 0.0, drainageLoad: 30, drainagePoints: 4, affectedRoads: 0, tempC: 39, humidity: 30, elevationM: 155, cityId: 'dhafra', districtType: 'desert_remote', mapZoom: 12 },
  { id: 'dhf-23', nameAr: 'Al Hamra', nameEn: 'Al Hamra', lat: 23.7800, lng: 53.5500, areaSqKm: 14, population: 10500, type: 'mixed', alertLevel: 'safe', floodRisk: 28, maxWaterDepthCm: 11, floodAreaHa: 8, currentPrecipitation: 0.0, drainageLoad: 34, drainagePoints: 5, affectedRoads: 0, tempC: 38, humidity: 34, elevationM: 130, cityId: 'dhafra', districtType: 'desert_remote', mapZoom: 12 },
  { id: 'dhf-24', nameAr: 'Al Mirfa Farms', nameEn: 'Al Mirfa Farms', lat: 23.8800, lng: 53.4000, areaSqKm: 110, population: 6500, type: 'agricultural', alertLevel: 'watch', floodRisk: 46, maxWaterDepthCm: 28, floodAreaHa: 88, currentPrecipitation: 0.1, drainageLoad: 57, drainagePoints: 7, affectedRoads: 1, tempC: 37, humidity: 50, elevationM: 8, cityId: 'dhafra', districtType: 'agricultural', mapZoom: 11 },
  { id: 'dhf-25', nameAr: 'Abu Dhabi Western Industrial', nameEn: 'Abu Dhabi Western Industrial', lat: 24.0000, lng: 52.6500, areaSqKm: 38, population: 32000, type: 'industrial', alertLevel: 'warning', floodRisk: 60, maxWaterDepthCm: 40, floodAreaHa: 32, currentPrecipitation: 0.2, drainageLoad: 74, drainagePoints: 20, affectedRoads: 5, tempC: 37, humidity: 52, elevationM: 6, note: 'Industrial area — limited drainage network', cityId: 'dhafra', districtType: 'heavy_industrial', mapZoom: 13 },
];

// ── Emirate Structure ─────────────────────────────────────────────────────────
export const ABU_DHABI_EMIRATE: Emirate = {
  nameAr: 'Emirate of Abu Dhabi', nameEn: 'Emirate of Abu Dhabi',
  cities: [
    {
      id: 'abudhabi',
      nameAr: 'Abu Dhabi City', nameEn: 'Abu Dhabi City',
      color: '#42A5F5',
      lat: 24.4539,
      lng: 54.3773,
      subAreas: ABU_DHABI_AREAS,
    },
    {
      id: 'alain',
      nameAr: 'Al Ain City', nameEn: 'Al Ain City',
      color: '#66BB6A',
      lat: 24.2075,
      lng: 55.7447,
      subAreas: AL_AIN_AREAS,
    },
    {
      id: 'dhafra',
      nameAr: 'Al Dhafra Region', nameEn: 'Al Dhafra Region',
      color: '#FFA726',
      lat: 23.6800,
      lng: 53.7100,
      subAreas: AL_DHAFRA_AREAS,
    },
  ],
};

// ── Stats Helpers ─────────────────────────────────────────────────────────────
export interface CityStats {
  totalAreas: number;
  avgFloodRisk: number;
  totalFloodAreaHa: number;
  avgDrainageLoad: number;
  totalAffectedRoads: number;
  criticalCount: number;
  warningCount: number;
  watchCount: number;
  safeCount: number;
  totalPopulation: number;
  farmAreas: number;
}

export function getCityStats(city: City): CityStats {
  const areas = city.subAreas;
  const n = areas.length;
  return {
    totalAreas: n,
    avgFloodRisk: Math.round(areas.reduce((s, a) => s + a.floodRisk, 0) / n),
    totalFloodAreaHa: areas.reduce((s, a) => s + a.floodAreaHa, 0),
    avgDrainageLoad: Math.round(areas.reduce((s, a) => s + a.drainageLoad, 0) / n),
    totalAffectedRoads: areas.reduce((s, a) => s + a.affectedRoads, 0),
    criticalCount: areas.filter(a => a.alertLevel === 'critical').length,
    warningCount: areas.filter(a => a.alertLevel === 'warning').length,
    watchCount: areas.filter(a => a.alertLevel === 'watch').length,
    safeCount: areas.filter(a => a.alertLevel === 'safe').length,
    totalPopulation: areas.reduce((s, a) => s + a.population, 0),
    farmAreas: areas.filter(a => a.type === 'agricultural').length,
  };
}

export interface EmirateStats extends CityStats {
  totalCities: number;
}

export function getEmirateStats(): EmirateStats {
  const allAreas = ABU_DHABI_EMIRATE.cities.flatMap(c => c.subAreas);
  const n = allAreas.length;
  return {
    totalCities: ABU_DHABI_EMIRATE.cities.length,
    totalAreas: n,
    avgFloodRisk: Math.round(allAreas.reduce((s, a) => s + a.floodRisk, 0) / n),
    totalFloodAreaHa: allAreas.reduce((s, a) => s + a.floodAreaHa, 0),
    avgDrainageLoad: Math.round(allAreas.reduce((s, a) => s + a.drainageLoad, 0) / n),
    totalAffectedRoads: allAreas.reduce((s, a) => s + a.affectedRoads, 0),
    criticalCount: allAreas.filter(a => a.alertLevel === 'critical').length,
    warningCount: allAreas.filter(a => a.alertLevel === 'warning').length,
    watchCount: allAreas.filter(a => a.alertLevel === 'watch').length,
    safeCount: allAreas.filter(a => a.alertLevel === 'safe').length,
    totalPopulation: allAreas.reduce((s, a) => s + a.population, 0),
    farmAreas: allAreas.filter(a => a.type === 'agricultural').length,
  };
}
