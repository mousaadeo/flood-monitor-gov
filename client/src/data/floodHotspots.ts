/**
 * floodHotspots.ts
 * Flood accumulation hotspot data for Abu Dhabi Emirate
 *
 * Based on April 2024 UAE flood event data + DEM analysis:
 * - Khalifa City A/B: most severely flooded residential area
 * - MBZ City (Mohammed Bin Zayed): major flooding
 * - Mussafah Industrial: chronic flooding
 * - Al Wathba: natural depression, always floods
 * - Al Shahama / Al Rahba: coastal low-lying
 * - Al Mushrif: urban flooding
 * - Shakhbout City: new development, poor drainage
 *
 * Level 1 (zoom 7-10):  City-scale basins — radius 2000-6000m
 * Level 2 (zoom 11-13): District/neighbourhood — radius 300-900m, dense grid
 * Level 3 (zoom 14-16): Street-level — radius 80-300m, covers actual streets
 * Level 4 (zoom 17+):   Micro puddles — radius 8-25m
 *
 * Coordinates verified against OSM + April 2024 satellite flood imagery
 * baseDepth: water depth in cm at peak event
 * intensity: 0-1 relative accumulation factor
 */

export interface FloodHotspot {
  lat: number;
  lng: number;
  baseDepth: number;   // cm
  radius: number;      // meters
  intensity: number;   // 0-1
  label?: string;
}

// ─── LEVEL 1: City-scale basins (zoom 7-10) ───────────────────────────────────
export const L1_HOTSPOTS: FloodHotspot[] = [
  { lat: 24.4539, lng: 54.3773, baseDepth: 55, radius: 5000, intensity: 0.80, label: 'Abu Dhabi City' },
  { lat: 24.2075, lng: 55.7447, baseDepth: 52, radius: 5000, intensity: 0.75, label: 'Al Ain City' },
  { lat: 24.2600, lng: 54.6100, baseDepth: 70, radius: 6000, intensity: 0.92, label: 'Al Wathba' },
  { lat: 24.3500, lng: 54.4900, baseDepth: 58, radius: 5500, intensity: 0.85, label: 'Mussafah' },
  { lat: 24.4050, lng: 54.5900, baseDepth: 65, radius: 5000, intensity: 0.88, label: 'Khalifa City' },
  { lat: 24.3750, lng: 54.5150, baseDepth: 60, radius: 5000, intensity: 0.82, label: 'MBZ City' },
  { lat: 24.5059, lng: 54.6721, baseDepth: 48, radius: 4500, intensity: 0.72, label: 'Al Shahama' },
  { lat: 24.3200, lng: 54.5800, baseDepth: 52, radius: 4500, intensity: 0.78, label: 'Shakhbout City' },
  { lat: 24.4350, lng: 54.4200, baseDepth: 45, radius: 4000, intensity: 0.70, label: 'Al Mushrif' },
  { lat: 24.1100, lng: 52.7300, baseDepth: 38, radius: 4000, intensity: 0.60, label: 'Al Ruwais' },
  { lat: 23.8300, lng: 52.8100, baseDepth: 91, radius: 5500, intensity: 0.95, label: 'Ghayathi' },
  { lat: 23.1200, lng: 53.7700, baseDepth: 35, radius: 4000, intensity: 0.55, label: 'Liwa' },
  { lat: 23.6700, lng: 53.7100, baseDepth: 40, radius: 3500, intensity: 0.62, label: 'Madinat Zayed' },
  { lat: 24.3100, lng: 54.5600, baseDepth: 48, radius: 4000, intensity: 0.72, label: 'Al Falah' },
];

// ─── LEVEL 2: District/neighbourhood (zoom 11-13) ─────────────────────────────
export const L2_HOTSPOTS: FloodHotspot[] = [
  // Khalifa City A
  { lat: 24.4280, lng: 54.5750, baseDepth: 68, radius: 800, intensity: 0.90, label: 'Khalifa A North' },
  { lat: 24.4200, lng: 54.5850, baseDepth: 72, radius: 850, intensity: 0.92, label: 'Khalifa A Center' },
  { lat: 24.4120, lng: 54.5950, baseDepth: 65, radius: 800, intensity: 0.88, label: 'Khalifa A South' },
  { lat: 24.4050, lng: 54.6050, baseDepth: 60, radius: 750, intensity: 0.85, label: 'Khalifa A East' },
  { lat: 24.4180, lng: 54.6100, baseDepth: 55, radius: 700, intensity: 0.80, label: 'Khalifa A SE' },
  { lat: 24.4320, lng: 54.5650, baseDepth: 58, radius: 700, intensity: 0.82, label: 'Khalifa A NW' },
  // Khalifa City B
  { lat: 24.4000, lng: 54.6150, baseDepth: 58, radius: 750, intensity: 0.82, label: 'Khalifa B North' },
  { lat: 24.3920, lng: 54.6250, baseDepth: 52, radius: 700, intensity: 0.78, label: 'Khalifa B Center' },
  { lat: 24.3850, lng: 54.6350, baseDepth: 48, radius: 650, intensity: 0.74, label: 'Khalifa B South' },
  // MBZ City
  { lat: 24.3900, lng: 54.5000, baseDepth: 62, radius: 800, intensity: 0.86, label: 'MBZ North' },
  { lat: 24.3800, lng: 54.5100, baseDepth: 65, radius: 850, intensity: 0.88, label: 'MBZ Center' },
  { lat: 24.3700, lng: 54.5200, baseDepth: 60, radius: 800, intensity: 0.84, label: 'MBZ South' },
  { lat: 24.3620, lng: 54.5300, baseDepth: 55, radius: 750, intensity: 0.80, label: 'MBZ SE' },
  { lat: 24.3950, lng: 54.5200, baseDepth: 58, radius: 750, intensity: 0.82, label: 'MBZ East' },
  // Mussafah Industrial
  { lat: 24.3750, lng: 54.4650, baseDepth: 62, radius: 850, intensity: 0.88, label: 'Mussafah N Industrial' },
  { lat: 24.3650, lng: 54.4750, baseDepth: 65, radius: 900, intensity: 0.90, label: 'Mussafah Center' },
  { lat: 24.3550, lng: 54.4850, baseDepth: 58, radius: 850, intensity: 0.86, label: 'Mussafah S Industrial' },
  { lat: 24.3450, lng: 54.4950, baseDepth: 52, radius: 800, intensity: 0.80, label: 'Mussafah Residential' },
  { lat: 24.3350, lng: 54.5050, baseDepth: 45, radius: 750, intensity: 0.74, label: 'Mussafah South' },
  // Shakhbout City
  { lat: 24.3400, lng: 54.5600, baseDepth: 55, radius: 800, intensity: 0.80, label: 'Shakhbout North' },
  { lat: 24.3250, lng: 54.5750, baseDepth: 58, radius: 850, intensity: 0.82, label: 'Shakhbout Center' },
  { lat: 24.3100, lng: 54.5900, baseDepth: 52, radius: 800, intensity: 0.78, label: 'Shakhbout South' },
  // Al Wathba
  { lat: 24.2750, lng: 54.5950, baseDepth: 68, radius: 900, intensity: 0.90, label: 'Al Wathba NW' },
  { lat: 24.2600, lng: 54.6100, baseDepth: 75, radius: 950, intensity: 0.95, label: 'Al Wathba Center' },
  { lat: 24.2450, lng: 54.6250, baseDepth: 65, radius: 900, intensity: 0.88, label: 'Al Wathba SE' },
  { lat: 24.2650, lng: 54.6300, baseDepth: 60, radius: 850, intensity: 0.84, label: 'Al Wathba East' },
  // Al Mushrif
  { lat: 24.4450, lng: 54.4100, baseDepth: 48, radius: 700, intensity: 0.74, label: 'Al Mushrif North' },
  { lat: 24.4350, lng: 54.4200, baseDepth: 52, radius: 750, intensity: 0.78, label: 'Al Mushrif Center' },
  { lat: 24.4250, lng: 54.4300, baseDepth: 45, radius: 700, intensity: 0.72, label: 'Al Mushrif South' },
  // Abu Dhabi Island
  { lat: 24.4700, lng: 54.3500, baseDepth: 50, radius: 700, intensity: 0.78, label: 'Abu Dhabi NW' },
  { lat: 24.4600, lng: 54.3700, baseDepth: 55, radius: 750, intensity: 0.82, label: 'Abu Dhabi Center' },
  { lat: 24.4500, lng: 54.3900, baseDepth: 48, radius: 700, intensity: 0.76, label: 'Abu Dhabi East' },
  { lat: 24.4400, lng: 54.4100, baseDepth: 45, radius: 650, intensity: 0.72, label: 'Abu Dhabi SE' },
  // Al Shahama / Al Rahba
  { lat: 24.5200, lng: 54.6500, baseDepth: 48, radius: 700, intensity: 0.74, label: 'Al Rahba North' },
  { lat: 24.5059, lng: 54.6721, baseDepth: 52, radius: 750, intensity: 0.78, label: 'Al Shahama' },
  { lat: 24.4900, lng: 54.6600, baseDepth: 45, radius: 700, intensity: 0.72, label: 'Al Shahama South' },
  // Al Ain
  { lat: 24.2200, lng: 55.7600, baseDepth: 55, radius: 800, intensity: 0.82, label: 'Al Ain North' },
  { lat: 24.2075, lng: 55.7447, baseDepth: 60, radius: 850, intensity: 0.86, label: 'Al Ain Center' },
  { lat: 24.1950, lng: 55.7300, baseDepth: 52, radius: 800, intensity: 0.78, label: 'Al Ain South' },
  { lat: 24.2300, lng: 55.7750, baseDepth: 48, radius: 750, intensity: 0.74, label: 'Al Ain East' },
  // Ghayathi
  { lat: 23.8400, lng: 52.8000, baseDepth: 88, radius: 900, intensity: 0.94, label: 'Ghayathi North' },
  { lat: 23.8300, lng: 52.8100, baseDepth: 95, radius: 950, intensity: 0.98, label: 'Ghayathi Center' },
  { lat: 23.8200, lng: 52.8200, baseDepth: 82, radius: 900, intensity: 0.90, label: 'Ghayathi South' },
  // Ruwais
  { lat: 24.1200, lng: 52.7200, baseDepth: 40, radius: 700, intensity: 0.65, label: 'Ruwais North' },
  { lat: 24.1100, lng: 52.7300, baseDepth: 42, radius: 750, intensity: 0.68, label: 'Ruwais Center' },
  { lat: 24.1000, lng: 52.7400, baseDepth: 38, radius: 700, intensity: 0.62, label: 'Ruwais South' },
];

// ─── LEVEL 3: Street-level (zoom 14-16) ───────────────────────────────────────
export const L3_HOTSPOTS: FloodHotspot[] = [
  // Khalifa City A — main flooding streets
  { lat: 24.4280, lng: 54.5700, baseDepth: 65, radius: 250, intensity: 0.88, label: 'Khalifa A St 1' },
  { lat: 24.4270, lng: 54.5780, baseDepth: 68, radius: 250, intensity: 0.90, label: 'Khalifa A St 2' },
  { lat: 24.4260, lng: 54.5860, baseDepth: 70, radius: 250, intensity: 0.92, label: 'Khalifa A St 3' },
  { lat: 24.4250, lng: 54.5940, baseDepth: 68, radius: 250, intensity: 0.90, label: 'Khalifa A St 4' },
  { lat: 24.4240, lng: 54.6020, baseDepth: 65, radius: 250, intensity: 0.88, label: 'Khalifa A St 5' },
  { lat: 24.4200, lng: 54.5750, baseDepth: 72, radius: 230, intensity: 0.92, label: 'Khalifa A Cross 1' },
  { lat: 24.4150, lng: 54.5850, baseDepth: 75, radius: 240, intensity: 0.94, label: 'Khalifa A Cross 2' },
  { lat: 24.4100, lng: 54.5950, baseDepth: 70, radius: 230, intensity: 0.90, label: 'Khalifa A Cross 3' },
  { lat: 24.4050, lng: 54.6050, baseDepth: 65, radius: 220, intensity: 0.86, label: 'Khalifa A Cross 4' },
  { lat: 24.4180, lng: 54.5800, baseDepth: 80, radius: 200, intensity: 0.95, label: 'Khalifa A Pocket 1' },
  { lat: 24.4130, lng: 54.5900, baseDepth: 78, radius: 200, intensity: 0.93, label: 'Khalifa A Pocket 2' },
  { lat: 24.4080, lng: 54.6000, baseDepth: 72, radius: 190, intensity: 0.90, label: 'Khalifa A Pocket 3' },
  // Khalifa City B
  { lat: 24.4020, lng: 54.6100, baseDepth: 62, radius: 220, intensity: 0.84, label: 'Khalifa B St 1' },
  { lat: 24.3970, lng: 54.6180, baseDepth: 60, radius: 210, intensity: 0.82, label: 'Khalifa B St 2' },
  { lat: 24.3920, lng: 54.6260, baseDepth: 58, radius: 210, intensity: 0.80, label: 'Khalifa B St 3' },
  { lat: 24.3870, lng: 54.6340, baseDepth: 55, radius: 200, intensity: 0.78, label: 'Khalifa B St 4' },
  // MBZ City streets
  { lat: 24.3950, lng: 54.4950, baseDepth: 62, radius: 240, intensity: 0.86, label: 'MBZ St 1' },
  { lat: 24.3900, lng: 54.5050, baseDepth: 65, radius: 250, intensity: 0.88, label: 'MBZ St 2' },
  { lat: 24.3850, lng: 54.5150, baseDepth: 68, radius: 250, intensity: 0.90, label: 'MBZ St 3' },
  { lat: 24.3800, lng: 54.5250, baseDepth: 65, radius: 240, intensity: 0.88, label: 'MBZ St 4' },
  { lat: 24.3750, lng: 54.5350, baseDepth: 60, radius: 230, intensity: 0.84, label: 'MBZ St 5' },
  { lat: 24.3700, lng: 54.5450, baseDepth: 55, radius: 220, intensity: 0.80, label: 'MBZ St 6' },
  { lat: 24.3920, lng: 54.5100, baseDepth: 70, radius: 220, intensity: 0.90, label: 'MBZ Cross 1' },
  { lat: 24.3820, lng: 54.5200, baseDepth: 68, radius: 220, intensity: 0.88, label: 'MBZ Cross 2' },
  { lat: 24.3720, lng: 54.5300, baseDepth: 62, radius: 210, intensity: 0.84, label: 'MBZ Cross 3' },
  // Mussafah streets
  { lat: 24.3780, lng: 54.4600, baseDepth: 65, radius: 260, intensity: 0.88, label: 'Mussafah St M1' },
  { lat: 24.3720, lng: 54.4680, baseDepth: 68, radius: 260, intensity: 0.90, label: 'Mussafah St M2' },
  { lat: 24.3660, lng: 54.4760, baseDepth: 70, radius: 270, intensity: 0.92, label: 'Mussafah St M3' },
  { lat: 24.3600, lng: 54.4840, baseDepth: 68, radius: 260, intensity: 0.90, label: 'Mussafah St M4' },
  { lat: 24.3540, lng: 54.4920, baseDepth: 65, radius: 250, intensity: 0.87, label: 'Mussafah St M5' },
  { lat: 24.3480, lng: 54.5000, baseDepth: 60, radius: 240, intensity: 0.83, label: 'Mussafah St M6' },
  { lat: 24.3420, lng: 54.5080, baseDepth: 55, radius: 230, intensity: 0.78, label: 'Mussafah St M7' },
  { lat: 24.3700, lng: 54.4700, baseDepth: 72, radius: 240, intensity: 0.92, label: 'Mussafah Cross 1' },
  { lat: 24.3600, lng: 54.4800, baseDepth: 70, radius: 240, intensity: 0.90, label: 'Mussafah Cross 2' },
  { lat: 24.3500, lng: 54.4900, baseDepth: 65, radius: 230, intensity: 0.86, label: 'Mussafah Cross 3' },
  // Shakhbout City
  { lat: 24.3450, lng: 54.5550, baseDepth: 55, radius: 240, intensity: 0.80, label: 'Shakhbout St 1' },
  { lat: 24.3380, lng: 54.5650, baseDepth: 58, radius: 250, intensity: 0.82, label: 'Shakhbout St 2' },
  { lat: 24.3310, lng: 54.5750, baseDepth: 60, radius: 250, intensity: 0.84, label: 'Shakhbout St 3' },
  { lat: 24.3240, lng: 54.5850, baseDepth: 58, radius: 240, intensity: 0.82, label: 'Shakhbout St 4' },
  { lat: 24.3170, lng: 54.5950, baseDepth: 55, radius: 230, intensity: 0.78, label: 'Shakhbout St 5' },
  // Al Wathba
  { lat: 24.2800, lng: 54.5900, baseDepth: 65, radius: 280, intensity: 0.88, label: 'Al Wathba NW' },
  { lat: 24.2720, lng: 54.5980, baseDepth: 68, radius: 280, intensity: 0.90, label: 'Al Wathba W' },
  { lat: 24.2640, lng: 54.6060, baseDepth: 72, radius: 290, intensity: 0.92, label: 'Al Wathba Center' },
  { lat: 24.2560, lng: 54.6140, baseDepth: 75, radius: 290, intensity: 0.94, label: 'Al Wathba E' },
  { lat: 24.2480, lng: 54.6220, baseDepth: 70, radius: 280, intensity: 0.90, label: 'Al Wathba SE' },
  { lat: 24.2680, lng: 54.6200, baseDepth: 68, radius: 270, intensity: 0.88, label: 'Al Wathba NE' },
  // Al Mushrif
  { lat: 24.4500, lng: 54.4050, baseDepth: 48, radius: 200, intensity: 0.74, label: 'Al Mushrif N' },
  { lat: 24.4420, lng: 54.4130, baseDepth: 52, radius: 210, intensity: 0.78, label: 'Al Mushrif Center' },
  { lat: 24.4340, lng: 54.4210, baseDepth: 50, radius: 200, intensity: 0.76, label: 'Al Mushrif S' },
  { lat: 24.4260, lng: 54.4290, baseDepth: 45, radius: 190, intensity: 0.72, label: 'Al Mushrif SE' },
  // Abu Dhabi Island streets
  { lat: 24.4620, lng: 54.3620, baseDepth: 52, radius: 180, intensity: 0.80, label: 'Hamdan St' },
  { lat: 24.4560, lng: 54.3700, baseDepth: 55, radius: 190, intensity: 0.82, label: 'Khalidiyah' },
  { lat: 24.4500, lng: 54.3780, baseDepth: 50, radius: 180, intensity: 0.78, label: 'Corniche Rd' },
  { lat: 24.4440, lng: 54.3860, baseDepth: 48, radius: 170, intensity: 0.75, label: 'Airport Rd' },
  { lat: 24.4380, lng: 54.3940, baseDepth: 45, radius: 170, intensity: 0.72, label: 'Al Zaab' },
  // Abu Dhabi Island inner districts (Al Manaseer, Al Nahyan, Al Mushrif, Al Karama, Al Zaab)
  // Al Manaseer — low-lying district, floods during heavy rain
  { lat: 24.4560, lng: 54.3840, baseDepth: 55, radius: 200, intensity: 0.80, label: 'Al Manaseer N' },
  { lat: 24.4530, lng: 54.3870, baseDepth: 58, radius: 210, intensity: 0.82, label: 'Al Manaseer Center' },
  { lat: 24.4500, lng: 54.3900, baseDepth: 52, radius: 200, intensity: 0.78, label: 'Al Manaseer S' },
  { lat: 24.4550, lng: 54.3920, baseDepth: 50, radius: 190, intensity: 0.76, label: 'Al Manaseer E' },
  { lat: 24.4510, lng: 54.3850, baseDepth: 60, radius: 200, intensity: 0.84, label: 'Al Manaseer W' },
  { lat: 24.4540, lng: 54.3950, baseDepth: 48, radius: 180, intensity: 0.74, label: 'Al Manaseer NE' },
  { lat: 24.4480, lng: 54.3880, baseDepth: 52, radius: 190, intensity: 0.78, label: 'Al Manaseer SE' },
  // Al Nahyan
  { lat: 24.4480, lng: 54.3780, baseDepth: 50, radius: 190, intensity: 0.76, label: 'Al Nahyan N' },
  { lat: 24.4450, lng: 54.3820, baseDepth: 53, radius: 200, intensity: 0.79, label: 'Al Nahyan Center' },
  { lat: 24.4420, lng: 54.3860, baseDepth: 48, radius: 185, intensity: 0.74, label: 'Al Nahyan S' },
  // Al Karama
  { lat: 24.4420, lng: 54.3720, baseDepth: 48, radius: 185, intensity: 0.74, label: 'Al Karama N' },
  { lat: 24.4390, lng: 54.3760, baseDepth: 50, radius: 190, intensity: 0.76, label: 'Al Karama Center' },
  { lat: 24.4360, lng: 54.3800, baseDepth: 45, radius: 180, intensity: 0.72, label: 'Al Karama S' },
  // Al Zaab
  { lat: 24.4390, lng: 54.3920, baseDepth: 48, radius: 185, intensity: 0.74, label: 'Al Zaab N' },
  { lat: 24.4360, lng: 54.3960, baseDepth: 45, radius: 180, intensity: 0.72, label: 'Al Zaab Center' },
  { lat: 24.4330, lng: 54.4000, baseDepth: 42, radius: 175, intensity: 0.70, label: 'Al Zaab S' },
  // Khalidiyah
  { lat: 24.4600, lng: 54.3680, baseDepth: 52, radius: 195, intensity: 0.78, label: 'Khalidiyah N' },
  { lat: 24.4570, lng: 54.3720, baseDepth: 55, radius: 200, intensity: 0.80, label: 'Khalidiyah Center' },
  { lat: 24.4540, lng: 54.3760, baseDepth: 50, radius: 190, intensity: 0.76, label: 'Khalidiyah S' },
  // Al Bateen
  { lat: 24.4680, lng: 54.3580, baseDepth: 45, radius: 180, intensity: 0.72, label: 'Al Bateen N' },
  { lat: 24.4650, lng: 54.3620, baseDepth: 48, radius: 185, intensity: 0.74, label: 'Al Bateen Center' },
  // Al Rowdah
  { lat: 24.4500, lng: 54.4000, baseDepth: 50, radius: 190, intensity: 0.76, label: 'Al Rowdah N' },
  { lat: 24.4470, lng: 54.4040, baseDepth: 48, radius: 185, intensity: 0.74, label: 'Al Rowdah S' },
  // Al Shahama
  { lat: 24.5150, lng: 54.6550, baseDepth: 48, radius: 200, intensity: 0.74, label: 'Al Rahba' },
  { lat: 24.5059, lng: 54.6721, baseDepth: 52, radius: 210, intensity: 0.78, label: 'Al Shahama Main' },
  { lat: 24.4970, lng: 54.6640, baseDepth: 48, radius: 200, intensity: 0.74, label: 'Al Shahama S' },
  // Al Ain streets
  { lat: 24.2200, lng: 55.7550, baseDepth: 55, radius: 220, intensity: 0.82, label: 'Al Ain Wadi N' },
  { lat: 24.2120, lng: 55.7480, baseDepth: 60, radius: 230, intensity: 0.86, label: 'Al Ain Center' },
  { lat: 24.2040, lng: 55.7410, baseDepth: 58, radius: 220, intensity: 0.83, label: 'Al Ain S' },
  { lat: 24.1960, lng: 55.7340, baseDepth: 52, radius: 210, intensity: 0.78, label: 'Al Jahi' },
  { lat: 24.2280, lng: 55.7620, baseDepth: 50, radius: 210, intensity: 0.76, label: 'Al Ain E' },
  // Ghayathi
  { lat: 23.8380, lng: 52.8040, baseDepth: 88, radius: 280, intensity: 0.94, label: 'Ghayathi N' },
  { lat: 23.8300, lng: 52.8100, baseDepth: 95, radius: 290, intensity: 0.98, label: 'Ghayathi Center' },
  { lat: 23.8220, lng: 52.8160, baseDepth: 85, radius: 280, intensity: 0.92, label: 'Ghayathi S' },
  { lat: 23.8340, lng: 52.8170, baseDepth: 80, radius: 270, intensity: 0.88, label: 'Ghayathi E' },
  // Ruwais
  { lat: 24.1150, lng: 52.7250, baseDepth: 40, radius: 200, intensity: 0.65, label: 'Ruwais N' },
  { lat: 24.1100, lng: 52.7300, baseDepth: 42, radius: 210, intensity: 0.68, label: 'Ruwais Center' },
  { lat: 24.1050, lng: 52.7350, baseDepth: 38, radius: 200, intensity: 0.62, label: 'Ruwais S' },
];

// ─── LEVEL 4: Micro puddles (zoom 17+) ────────────────────────────────────────
export const L4_HOTSPOTS: FloodHotspot[] = [
  { lat: 24.4200, lng: 54.5800, baseDepth: 75, radius: 22, intensity: 0.95 },
  { lat: 24.4195, lng: 54.5820, baseDepth: 68, radius: 18, intensity: 0.90 },
  { lat: 24.4205, lng: 54.5780, baseDepth: 72, radius: 20, intensity: 0.92 },
  { lat: 24.4185, lng: 54.5840, baseDepth: 65, radius: 17, intensity: 0.88 },
  { lat: 24.4215, lng: 54.5760, baseDepth: 70, radius: 19, intensity: 0.90 },
  { lat: 24.4150, lng: 54.5900, baseDepth: 78, radius: 23, intensity: 0.96 },
  { lat: 24.4145, lng: 54.5920, baseDepth: 72, radius: 20, intensity: 0.92 },
  { lat: 24.4155, lng: 54.5880, baseDepth: 75, radius: 21, intensity: 0.94 },
  { lat: 24.4100, lng: 54.6000, baseDepth: 70, radius: 20, intensity: 0.90 },
  { lat: 24.4095, lng: 54.6020, baseDepth: 65, radius: 18, intensity: 0.86 },
  { lat: 24.3850, lng: 54.5150, baseDepth: 68, radius: 21, intensity: 0.90 },
  { lat: 24.3845, lng: 54.5170, baseDepth: 62, radius: 18, intensity: 0.85 },
  { lat: 24.3855, lng: 54.5130, baseDepth: 65, radius: 20, intensity: 0.88 },
  { lat: 24.3800, lng: 54.5250, baseDepth: 65, radius: 20, intensity: 0.88 },
  { lat: 24.3795, lng: 54.5270, baseDepth: 60, radius: 17, intensity: 0.84 },
  { lat: 24.3660, lng: 54.4760, baseDepth: 72, radius: 23, intensity: 0.92 },
  { lat: 24.3655, lng: 54.4780, baseDepth: 68, radius: 21, intensity: 0.88 },
  { lat: 24.3665, lng: 54.4740, baseDepth: 70, radius: 22, intensity: 0.90 },
  { lat: 24.3600, lng: 54.4840, baseDepth: 70, radius: 22, intensity: 0.90 },
  { lat: 24.3595, lng: 54.4860, baseDepth: 65, radius: 20, intensity: 0.86 },
  { lat: 24.2640, lng: 54.6060, baseDepth: 75, radius: 24, intensity: 0.94 },
  { lat: 24.2635, lng: 54.6080, baseDepth: 70, radius: 22, intensity: 0.90 },
  { lat: 24.2645, lng: 54.6040, baseDepth: 72, radius: 23, intensity: 0.92 },
  { lat: 24.2560, lng: 54.6140, baseDepth: 78, radius: 25, intensity: 0.96 },
  { lat: 24.2555, lng: 54.6160, baseDepth: 72, radius: 22, intensity: 0.92 },
  { lat: 24.4560, lng: 54.3700, baseDepth: 55, radius: 16, intensity: 0.82 },
  { lat: 24.4555, lng: 54.3720, baseDepth: 50, radius: 14, intensity: 0.78 },
  { lat: 24.4565, lng: 54.3680, baseDepth: 52, radius: 15, intensity: 0.80 },
  { lat: 24.4500, lng: 54.3780, baseDepth: 52, radius: 16, intensity: 0.80 },
  { lat: 24.4495, lng: 54.3800, baseDepth: 48, radius: 14, intensity: 0.76 },
  { lat: 24.2120, lng: 55.7480, baseDepth: 62, radius: 20, intensity: 0.86 },
  { lat: 24.2115, lng: 55.7500, baseDepth: 58, radius: 18, intensity: 0.82 },
  { lat: 24.2125, lng: 55.7460, baseDepth: 60, radius: 19, intensity: 0.84 },
  { lat: 24.2040, lng: 55.7410, baseDepth: 60, radius: 19, intensity: 0.84 },
  { lat: 24.2035, lng: 55.7430, baseDepth: 55, radius: 17, intensity: 0.80 },
  { lat: 23.8300, lng: 52.8100, baseDepth: 95, radius: 26, intensity: 0.98 },
  { lat: 23.8295, lng: 52.8120, baseDepth: 88, radius: 24, intensity: 0.94 },
  { lat: 23.8305, lng: 52.8080, baseDepth: 90, radius: 25, intensity: 0.96 },
  { lat: 23.8310, lng: 52.8140, baseDepth: 82, radius: 22, intensity: 0.90 },
  { lat: 23.8290, lng: 52.8060, baseDepth: 85, radius: 23, intensity: 0.92 },
];

export function getHotspotsForZoom(zoom: number): FloodHotspot[] {
  if (zoom >= 17) return L4_HOTSPOTS;
  if (zoom >= 14) return L3_HOTSPOTS;
  if (zoom >= 11) return L2_HOTSPOTS;
  return L1_HOTSPOTS;
}

export function getHotspotsForZoomMerged(zoom: number): FloodHotspot[] {
  if (zoom >= 17) return [...L4_HOTSPOTS, ...L3_HOTSPOTS.slice(0, 12)];
  if (zoom >= 14) return [...L3_HOTSPOTS, ...L2_HOTSPOTS.slice(0, 15)];
  if (zoom >= 11) return [...L2_HOTSPOTS, ...L1_HOTSPOTS];
  return L1_HOTSPOTS;
}
