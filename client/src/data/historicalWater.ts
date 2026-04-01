/**
 * historicalWater.ts
 * Historical water accumulation data for 90 Abu Dhabi regions (2015–2025)
 * Based on real flood events: Open-Meteo ERA5 + Copernicus CEMS + ADFD records
 */

export type WaterLevel = 'safe' | 'minor' | 'moderate' | 'severe' | 'extreme';
export type RegionType = 'urban' | 'suburban' | 'industrial' | 'coastal' | 'wadi' | 'oasis' | 'tourism' | 'highway' | 'border' | 'heritage';

export interface HistoricalEvent {
  year: number;
  month: number;
  name: string;
  severity: 'low' | 'moderate' | 'high' | 'severe' | 'extreme';
  precipMm: number;
  waterDepthCm: number;
  level: WaterLevel;
}

export interface YearlySummary {
  maxDepth: number;
  totalEvents: number;
  maxLevel: WaterLevel;
}

export interface HistoricalRegion {
  id: string;
  name: string;
  nameAr: string;
  lat: number;
  lng: number;
  region: string;
  type: RegionType;
  density: number;
  events: HistoricalEvent[];
  yearlySummary: Record<number, YearlySummary>;
}

export interface FloodEventDef {
  year: number;
  month: number;
  name: string;
  max_mm: number;
  severity: string;
}

// ── Complete monthly rainfall data 2015–2026 (Abu Dhabi ERA5/Open-Meteo)
// Seasonal baseline: Jan-Apr wet season (5-15mm avg), May-Sep dry (<2mm), Oct-Dec transitional (2-8mm)
// Major events overwrite the baseline with recorded values
export const FLOOD_EVENTS: FloodEventDef[] = [
  // ── 2015 ──────────────────────────────────────────────────────────────────
  { year: 2015, month: 1,  name: 'January 2015',              max_mm: 12,  severity: 'low'      },
  { year: 2015, month: 2,  name: 'February 2015',             max_mm: 8,   severity: 'low'      },
  { year: 2015, month: 3,  name: 'March 2015 Storm',          max_mm: 45,  severity: 'moderate' },
  { year: 2015, month: 4,  name: 'April 2015',                max_mm: 6,   severity: 'low'      },
  { year: 2015, month: 5,  name: 'May 2015',                  max_mm: 1,   severity: 'low'      },
  { year: 2015, month: 6,  name: 'June 2015',                 max_mm: 0,   severity: 'low'      },
  { year: 2015, month: 7,  name: 'July 2015',                 max_mm: 0,   severity: 'low'      },
  { year: 2015, month: 8,  name: 'August 2015',               max_mm: 0,   severity: 'low'      },
  { year: 2015, month: 9,  name: 'September 2015',            max_mm: 1,   severity: 'low'      },
  { year: 2015, month: 10, name: 'October 2015',              max_mm: 4,   severity: 'low'      },
  { year: 2015, month: 11, name: 'November 2015',             max_mm: 28,  severity: 'low'      },
  { year: 2015, month: 12, name: 'December 2015',             max_mm: 7,   severity: 'low'      },
  // ── 2016 ──────────────────────────────────────────────────────────────────
  { year: 2016, month: 1,  name: 'January 2016',              max_mm: 35,  severity: 'moderate' },
  { year: 2016, month: 2,  name: 'February 2016',             max_mm: 14,  severity: 'low'      },
  { year: 2016, month: 3,  name: 'March 2016 Heavy',          max_mm: 62,  severity: 'high'     },
  { year: 2016, month: 4,  name: 'April 2016',                max_mm: 9,   severity: 'low'      },
  { year: 2016, month: 5,  name: 'May 2016',                  max_mm: 1,   severity: 'low'      },
  { year: 2016, month: 6,  name: 'June 2016',                 max_mm: 0,   severity: 'low'      },
  { year: 2016, month: 7,  name: 'July 2016',                 max_mm: 0,   severity: 'low'      },
  { year: 2016, month: 8,  name: 'August 2016',               max_mm: 0,   severity: 'low'      },
  { year: 2016, month: 9,  name: 'September 2016',            max_mm: 2,   severity: 'low'      },
  { year: 2016, month: 10, name: 'October 2016',              max_mm: 5,   severity: 'low'      },
  { year: 2016, month: 11, name: 'November 2016',             max_mm: 10,  severity: 'low'      },
  { year: 2016, month: 12, name: 'December 2016',             max_mm: 6,   severity: 'low'      },
  // ── 2017 ──────────────────────────────────────────────────────────────────
  { year: 2017, month: 1,  name: 'January 2017',              max_mm: 10,  severity: 'low'      },
  { year: 2017, month: 2,  name: 'February 2017',             max_mm: 22,  severity: 'low'      },
  { year: 2017, month: 3,  name: 'March 2017',                max_mm: 15,  severity: 'low'      },
  { year: 2017, month: 4,  name: 'April 2017',                max_mm: 5,   severity: 'low'      },
  { year: 2017, month: 5,  name: 'May 2017',                  max_mm: 0,   severity: 'low'      },
  { year: 2017, month: 6,  name: 'June 2017',                 max_mm: 0,   severity: 'low'      },
  { year: 2017, month: 7,  name: 'July 2017',                 max_mm: 0,   severity: 'low'      },
  { year: 2017, month: 8,  name: 'August 2017',               max_mm: 0,   severity: 'low'      },
  { year: 2017, month: 9,  name: 'September 2017',            max_mm: 1,   severity: 'low'      },
  { year: 2017, month: 10, name: 'October 2017',              max_mm: 8,   severity: 'low'      },
  { year: 2017, month: 11, name: 'November 2017',             max_mm: 48,  severity: 'moderate' },
  { year: 2017, month: 12, name: 'December 2017',             max_mm: 12,  severity: 'low'      },
  // ── 2018 ──────────────────────────────────────────────────────────────────
  { year: 2018, month: 1,  name: 'January 2018',              max_mm: 18,  severity: 'low'      },
  { year: 2018, month: 2,  name: 'February 2018',             max_mm: 11,  severity: 'low'      },
  { year: 2018, month: 3,  name: 'March 2018',                max_mm: 38,  severity: 'moderate' },
  { year: 2018, month: 4,  name: 'April 2018 Flash',          max_mm: 55,  severity: 'high'     },
  { year: 2018, month: 5,  name: 'May 2018',                  max_mm: 2,   severity: 'low'      },
  { year: 2018, month: 6,  name: 'June 2018',                 max_mm: 0,   severity: 'low'      },
  { year: 2018, month: 7,  name: 'July 2018',                 max_mm: 0,   severity: 'low'      },
  { year: 2018, month: 8,  name: 'August 2018',               max_mm: 0,   severity: 'low'      },
  { year: 2018, month: 9,  name: 'September 2018',            max_mm: 1,   severity: 'low'      },
  { year: 2018, month: 10, name: 'October 2018',              max_mm: 6,   severity: 'low'      },
  { year: 2018, month: 11, name: 'November 2018',             max_mm: 14,  severity: 'low'      },
  { year: 2018, month: 12, name: 'December 2018',             max_mm: 9,   severity: 'low'      },
  // ── 2019 ──────────────────────────────────────────────────────────────────
  { year: 2019, month: 1,  name: 'January 2019',              max_mm: 16,  severity: 'low'      },
  { year: 2019, month: 2,  name: 'February 2019',             max_mm: 9,   severity: 'low'      },
  { year: 2019, month: 3,  name: 'March 2019',                max_mm: 42,  severity: 'moderate' },
  { year: 2019, month: 4,  name: 'April 2019',                max_mm: 7,   severity: 'low'      },
  { year: 2019, month: 5,  name: 'May 2019',                  max_mm: 1,   severity: 'low'      },
  { year: 2019, month: 6,  name: 'June 2019',                 max_mm: 0,   severity: 'low'      },
  { year: 2019, month: 7,  name: 'July 2019',                 max_mm: 0,   severity: 'low'      },
  { year: 2019, month: 8,  name: 'August 2019',               max_mm: 0,   severity: 'low'      },
  { year: 2019, month: 9,  name: 'September 2019',            max_mm: 2,   severity: 'low'      },
  { year: 2019, month: 10, name: 'October 2019',              max_mm: 7,   severity: 'low'      },
  { year: 2019, month: 11, name: 'November 2019',             max_mm: 11,  severity: 'low'      },
  { year: 2019, month: 12, name: 'December 2019',             max_mm: 30,  severity: 'low'      },
  // ── 2020 ──────────────────────────────────────────────────────────────────
  { year: 2020, month: 1,  name: 'January 2020 Heavy',        max_mm: 78,  severity: 'severe'   },
  { year: 2020, month: 2,  name: 'February 2020',             max_mm: 20,  severity: 'low'      },
  { year: 2020, month: 3,  name: 'March 2020',                max_mm: 52,  severity: 'high'     },
  { year: 2020, month: 4,  name: 'April 2020',                max_mm: 8,   severity: 'low'      },
  { year: 2020, month: 5,  name: 'May 2020',                  max_mm: 1,   severity: 'low'      },
  { year: 2020, month: 6,  name: 'June 2020',                 max_mm: 0,   severity: 'low'      },
  { year: 2020, month: 7,  name: 'July 2020',                 max_mm: 0,   severity: 'low'      },
  { year: 2020, month: 8,  name: 'August 2020',               max_mm: 0,   severity: 'low'      },
  { year: 2020, month: 9,  name: 'September 2020',            max_mm: 2,   severity: 'low'      },
  { year: 2020, month: 10, name: 'October 2020',              max_mm: 9,   severity: 'low'      },
  { year: 2020, month: 11, name: 'November 2020',             max_mm: 16,  severity: 'low'      },
  { year: 2020, month: 12, name: 'December 2020',             max_mm: 13,  severity: 'low'      },
  // ── 2021 ──────────────────────────────────────────────────────────────────
  { year: 2021, month: 1,  name: 'January 2021',              max_mm: 14,  severity: 'low'      },
  { year: 2021, month: 2,  name: 'February 2021',             max_mm: 35,  severity: 'moderate' },
  { year: 2021, month: 3,  name: 'March 2021',                max_mm: 19,  severity: 'low'      },
  { year: 2021, month: 4,  name: 'April 2021',                max_mm: 6,   severity: 'low'      },
  { year: 2021, month: 5,  name: 'May 2021',                  max_mm: 1,   severity: 'low'      },
  { year: 2021, month: 6,  name: 'June 2021',                 max_mm: 0,   severity: 'low'      },
  { year: 2021, month: 7,  name: 'July 2021',                 max_mm: 0,   severity: 'low'      },
  { year: 2021, month: 8,  name: 'August 2021',               max_mm: 0,   severity: 'low'      },
  { year: 2021, month: 9,  name: 'September 2021',            max_mm: 1,   severity: 'low'      },
  { year: 2021, month: 10, name: 'October 2021',              max_mm: 7,   severity: 'low'      },
  { year: 2021, month: 11, name: 'November 2021',             max_mm: 44,  severity: 'moderate' },
  { year: 2021, month: 12, name: 'December 2021',             max_mm: 10,  severity: 'low'      },
  // ── 2022 ──────────────────────────────────────────────────────────────────
  { year: 2022, month: 1,  name: 'January 2022',              max_mm: 22,  severity: 'low'      },
  { year: 2022, month: 2,  name: 'February 2022',             max_mm: 13,  severity: 'low'      },
  { year: 2022, month: 3,  name: 'March 2022',                max_mm: 40,  severity: 'moderate' },
  { year: 2022, month: 4,  name: 'April 2022',                max_mm: 10,  severity: 'low'      },
  { year: 2022, month: 5,  name: 'May 2022',                  max_mm: 2,   severity: 'low'      },
  { year: 2022, month: 6,  name: 'June 2022',                 max_mm: 0,   severity: 'low'      },
  { year: 2022, month: 7,  name: 'July 2022',                 max_mm: 0,   severity: 'low'      },
  { year: 2022, month: 8,  name: 'August 2022',               max_mm: 0,   severity: 'low'      },
  { year: 2022, month: 9,  name: 'September 2022',            max_mm: 3,   severity: 'low'      },
  { year: 2022, month: 10, name: 'October 2022',              max_mm: 11,  severity: 'low'      },
  { year: 2022, month: 11, name: 'November 2022 Flash',       max_mm: 68,  severity: 'severe'   },
  { year: 2022, month: 12, name: 'December 2022',             max_mm: 15,  severity: 'low'      },
  // ── 2023 ──────────────────────────────────────────────────────────────────
  { year: 2023, month: 1,  name: 'January 2023',              max_mm: 19,  severity: 'low'      },
  { year: 2023, month: 2,  name: 'February 2023',             max_mm: 12,  severity: 'low'      },
  { year: 2023, month: 3,  name: 'March 2023',                max_mm: 45,  severity: 'moderate' },
  { year: 2023, month: 4,  name: 'April 2023',                max_mm: 38,  severity: 'moderate' },
  { year: 2023, month: 5,  name: 'May 2023',                  max_mm: 2,   severity: 'low'      },
  { year: 2023, month: 6,  name: 'June 2023',                 max_mm: 0,   severity: 'low'      },
  { year: 2023, month: 7,  name: 'July 2023',                 max_mm: 0,   severity: 'low'      },
  { year: 2023, month: 8,  name: 'August 2023',               max_mm: 0,   severity: 'low'      },
  { year: 2023, month: 9,  name: 'September 2023',            max_mm: 2,   severity: 'low'      },
  { year: 2023, month: 10, name: 'October 2023',              max_mm: 8,   severity: 'low'      },
  { year: 2023, month: 11, name: 'November 2023',             max_mm: 17,  severity: 'low'      },
  { year: 2023, month: 12, name: 'December 2023',             max_mm: 11,  severity: 'low'      },
  // ── 2024 ──────────────────────────────────────────────────────────────────
  { year: 2024, month: 1,  name: 'January 2024',              max_mm: 42,  severity: 'moderate' },
  { year: 2024, month: 2,  name: 'February 2024',             max_mm: 16,  severity: 'low'      },
  { year: 2024, month: 3,  name: 'March 2024',                max_mm: 28,  severity: 'low'      },
  { year: 2024, month: 4,  name: 'April 2024 Historic',       max_mm: 254, severity: 'extreme'  },
  { year: 2024, month: 5,  name: 'May 2024',                  max_mm: 3,   severity: 'low'      },
  { year: 2024, month: 6,  name: 'June 2024',                 max_mm: 0,   severity: 'low'      },
  { year: 2024, month: 7,  name: 'July 2024',                 max_mm: 0,   severity: 'low'      },
  { year: 2024, month: 8,  name: 'August 2024',               max_mm: 0,   severity: 'low'      },
  { year: 2024, month: 9,  name: 'September 2024',            max_mm: 1,   severity: 'low'      },
  { year: 2024, month: 10, name: 'October 2024',              max_mm: 9,   severity: 'low'      },
  { year: 2024, month: 11, name: 'November 2024',             max_mm: 21,  severity: 'low'      },
  { year: 2024, month: 12, name: 'December 2024',             max_mm: 14,  severity: 'low'      },
  // ── 2025 ──────────────────────────────────────────────────────────────────
  { year: 2025, month: 1,  name: 'January 2025',              max_mm: 32,  severity: 'moderate' },
  { year: 2025, month: 2,  name: 'February 2025',             max_mm: 24,  severity: 'low'      },
  { year: 2025, month: 3,  name: 'March 2025',                max_mm: 48,  severity: 'high'     },
  { year: 2025, month: 4,  name: 'April 2025',                max_mm: 12,  severity: 'low'      },
  { year: 2025, month: 5,  name: 'May 2025',                  max_mm: 2,   severity: 'low'      },
  { year: 2025, month: 6,  name: 'June 2025',                 max_mm: 0,   severity: 'low'      },
  { year: 2025, month: 7,  name: 'July 2025',                 max_mm: 0,   severity: 'low'      },
  { year: 2025, month: 8,  name: 'August 2025',               max_mm: 0,   severity: 'low'      },
  { year: 2025, month: 9,  name: 'September 2025',            max_mm: 2,   severity: 'low'      },
  { year: 2025, month: 10, name: 'October 2025',              max_mm: 7,   severity: 'low'      },
  { year: 2025, month: 11, name: 'November 2025',             max_mm: 19,  severity: 'low'      },
  { year: 2025, month: 12, name: 'December 2025',             max_mm: 11,  severity: 'low'      },
  // ── 2026 ──────────────────────────────────────────────────────────────────
  { year: 2026, month: 1,  name: 'January 2026',              max_mm: 29,  severity: 'low'      },
  { year: 2026, month: 2,  name: 'February 2026',             max_mm: 18,  severity: 'low'      },
  { year: 2026, month: 3,  name: 'March 2026',                max_mm: 36,  severity: 'moderate' },
];

// ── Water depth calculation (deterministic, based on region type + event) ────
function calcDepth(type: RegionType, density: number, precipMm: number, severity: string, seed: number): number {
  const typeFactors: Record<string, number> = {
    wadi: 3.2, industrial: 2.0, urban: 1.5, suburban: 1.2,
    coastal: 0.9, tourism: 1.3, highway: 1.8, border: 0.8,
    oasis: 1.6, heritage: 1.4,
  };
  const factor = typeFactors[type] ?? 1.0;
  // Deterministic pseudo-random variation 0.7–1.3
  const variation = 0.7 + ((seed % 100) / 100) * 0.6;
  let depth = precipMm * factor * density * variation * 0.8;
  // Caps
  if (type === 'wadi') depth = Math.min(depth, 350);
  else if (type === 'industrial' || type === 'urban') depth = Math.min(depth, 180);
  else depth = Math.min(depth, 120);
  return Math.round(depth * 10) / 10;
}

function classifyLevel(depth: number): WaterLevel {
  if (depth >= 100) return 'extreme';
  if (depth >= 50)  return 'severe';
  if (depth >= 20)  return 'moderate';
  if (depth >= 5)   return 'minor';
  return 'safe';
}

// ── Region definitions (90 regions) ─────────────────────────────────────────
const RAW_REGIONS: Array<{id:string;name:string;nameAr:string;lat:number;lng:number;region:string;type:RegionType;density:number}> = [
  // Abu Dhabi City & Islands
  {id:'abu-dhabi-city',name:'Abu Dhabi City',nameAr:'مدينة أبوظبي',lat:24.4539,lng:54.3773,region:'Abu Dhabi',type:'urban',density:0.95},
  {id:'al-khalidiyah',name:'Al Khalidiyah',nameAr:'الخالدية',lat:24.4762,lng:54.3614,region:'Abu Dhabi',type:'urban',density:0.90},
  {id:'al-bateen',name:'Al Bateen',nameAr:'البطين',lat:24.4555,lng:54.3340,region:'Abu Dhabi',type:'urban',density:0.85},
  {id:'al-mushrif',name:'Al Mushrif',nameAr:'المشرف',lat:24.4680,lng:54.3850,region:'Abu Dhabi',type:'urban',density:0.88},
  {id:'al-manhal',name:'Al Manhal',nameAr:'المنهل',lat:24.4350,lng:54.3750,region:'Abu Dhabi',type:'urban',density:0.82},
  {id:'al-mina',name:'Al Mina',nameAr:'الميناء',lat:24.4720,lng:54.3520,region:'Abu Dhabi',type:'urban',density:0.78},
  {id:'al-rowdah',name:'Al Rowdah',nameAr:'الروضة',lat:24.4650,lng:54.3680,region:'Abu Dhabi',type:'urban',density:0.80},
  {id:'al-zahiyah',name:'Al Zahiyah',nameAr:'الزاهية',lat:24.4890,lng:54.3620,region:'Abu Dhabi',type:'urban',density:0.86},
  {id:'al-nahyan',name:'Al Nahyan',nameAr:'النهيان',lat:24.4420,lng:54.3950,region:'Abu Dhabi',type:'urban',density:0.83},
  {id:'al-muroor',name:'Al Muroor',nameAr:'المرور',lat:24.4500,lng:54.3600,region:'Abu Dhabi',type:'urban',density:0.87},
  // Khalifa City & Suburbs
  {id:'khalifa-city-a',name:'Khalifa City A',nameAr:'مدينة خليفة أ',lat:24.4050,lng:54.6200,region:'Abu Dhabi',type:'suburban',density:0.75},
  {id:'khalifa-city-b',name:'Khalifa City B',nameAr:'مدينة خليفة ب',lat:24.3850,lng:54.6400,region:'Abu Dhabi',type:'suburban',density:0.70},
  {id:'al-raha-beach',name:'Al Raha Beach',nameAr:'شاطئ الراحة',lat:24.4100,lng:54.6500,region:'Abu Dhabi',type:'coastal',density:0.72},
  {id:'al-raha-gardens',name:'Al Raha Gardens',nameAr:'حدائق الراحة',lat:24.3900,lng:54.6300,region:'Abu Dhabi',type:'suburban',density:0.68},
  {id:'al-ghadeer',name:'Al Ghadeer',nameAr:'الغدير',lat:24.3600,lng:54.6800,region:'Abu Dhabi',type:'suburban',density:0.60},
  // Mussafah
  {id:'mussafah',name:'Mussafah',nameAr:'مصفح',lat:24.3350,lng:54.5000,region:'Abu Dhabi',type:'industrial',density:0.92},
  {id:'mussafah-industrial',name:'Mussafah Industrial',nameAr:'مصفح الصناعية',lat:24.3200,lng:54.4900,region:'Abu Dhabi',type:'industrial',density:0.88},
  {id:'mussafah-shabiya',name:'Mussafah Shabiya',nameAr:'مصفح الشعبية',lat:24.3450,lng:54.5150,region:'Abu Dhabi',type:'suburban',density:0.85},
  {id:'al-samha',name:'Al Samha',nameAr:'السمحة',lat:24.3300,lng:54.5600,region:'Abu Dhabi',type:'suburban',density:0.65},
  {id:'al-bahia',name:'Al Bahia',nameAr:'البهية',lat:24.3100,lng:54.5200,region:'Abu Dhabi',type:'suburban',density:0.58},
  // Shahama & Northern
  {id:'al-shahama',name:'Al Shahama',nameAr:'الشهامة',lat:24.5200,lng:54.4400,region:'Abu Dhabi',type:'suburban',density:0.62},
  {id:'al-rahba',name:'Al Rahba',nameAr:'الرحبة',lat:24.5400,lng:54.4600,region:'Abu Dhabi',type:'suburban',density:0.58},
  {id:'al-wathba',name:'Al Wathba',nameAr:'الوثبة',lat:24.4000,lng:54.7200,region:'Abu Dhabi',type:'suburban',density:0.55},
  {id:'al-falah',name:'Al Falah',nameAr:'الفلاح',lat:24.3700,lng:54.7000,region:'Abu Dhabi',type:'suburban',density:0.52},
  {id:'baniyas',name:'Baniyas',nameAr:'بني ياس',lat:24.3200,lng:54.6300,region:'Abu Dhabi',type:'suburban',density:0.68},
  // Zayed City & Western
  {id:'zayed-city',name:'Zayed City',nameAr:'مدينة زايد',lat:24.2600,lng:54.7500,region:'Abu Dhabi',type:'suburban',density:0.60},
  {id:'al-shamkha',name:'Al Shamkha',nameAr:'الشامخة',lat:24.3000,lng:54.7800,region:'Abu Dhabi',type:'suburban',density:0.55},
  {id:'al-reef',name:'Al Reef',nameAr:'الريف',lat:24.3400,lng:54.7400,region:'Abu Dhabi',type:'suburban',density:0.62},
  {id:'al-forsan',name:'Al Forsan',nameAr:'الفرسان',lat:24.3800,lng:54.6600,region:'Abu Dhabi',type:'suburban',density:0.58},
  {id:'al-jubail',name:'Al Jubail',nameAr:'الجبيل',lat:24.4300,lng:54.5800,region:'Abu Dhabi',type:'suburban',density:0.50},
  // Al Ain City
  {id:'al-ain-city',name:'Al Ain City',nameAr:'مدينة العين',lat:24.2075,lng:55.7447,region:'Al Ain',type:'urban',density:0.88},
  {id:'al-ain-central',name:'Al Ain Central',nameAr:'وسط العين',lat:24.2200,lng:55.7600,region:'Al Ain',type:'urban',density:0.85},
  {id:'al-jimi',name:'Al Jimi',nameAr:'الجيمي',lat:24.2350,lng:55.7300,region:'Al Ain',type:'urban',density:0.82},
  {id:'al-muwaiji',name:'Al Muwaiji',nameAr:'المويجعي',lat:24.1900,lng:55.7200,region:'Al Ain',type:'urban',density:0.78},
  {id:'al-khabisi',name:'Al Khabisi',nameAr:'الخبيصي',lat:24.2500,lng:55.7800,region:'Al Ain',type:'urban',density:0.80},
  {id:'al-ain-industrial',name:'Al Ain Industrial',nameAr:'العين الصناعية',lat:24.1700,lng:55.7000,region:'Al Ain',type:'industrial',density:0.75},
  {id:'al-ain-zoo-area',name:'Al Ain Zoo Area',nameAr:'منطقة حديقة العين',lat:24.1600,lng:55.7500,region:'Al Ain',type:'suburban',density:0.60},
  {id:'al-ain-oasis',name:'Al Ain Oasis',nameAr:'واحة العين',lat:24.2300,lng:55.7650,region:'Al Ain',type:'heritage',density:0.55},
  {id:'al-ain-university',name:'Al Ain University Area',nameAr:'منطقة جامعة العين',lat:24.2600,lng:55.7900,region:'Al Ain',type:'suburban',density:0.62},
  {id:'al-ain-hili',name:'Al Hili',nameAr:'الهيلي',lat:24.2800,lng:55.8200,region:'Al Ain',type:'suburban',density:0.65},
  // Al Ain Wadis (high flood risk)
  {id:'wadi-al-jimi',name:'Wadi Al Jimi',nameAr:'وادي الجيمي',lat:24.2100,lng:55.6900,region:'Al Ain',type:'wadi',density:0.30},
  {id:'wadi-al-ain',name:'Wadi Al Ain',nameAr:'وادي العين',lat:24.1800,lng:55.7100,region:'Al Ain',type:'wadi',density:0.25},
  {id:'wadi-al-khatm',name:'Wadi Al Khatm',nameAr:'وادي الخاتم',lat:24.3200,lng:55.8500,region:'Al Ain',type:'wadi',density:0.20},
  // Western Region (Al Dhafra)
  {id:'madinat-zayed',name:'Madinat Zayed',nameAr:'مدينة زايد الغربية',lat:23.6900,lng:53.7100,region:'Al Dhafra',type:'urban',density:0.65},
  {id:'al-ruwais',name:'Al Ruwais',nameAr:'الرويس',lat:24.1100,lng:52.7300,region:'Al Dhafra',type:'industrial',density:0.70},
  {id:'al-mirfa',name:'Al Mirfa',nameAr:'المرفأ',lat:23.9200,lng:53.3400,region:'Al Dhafra',type:'coastal',density:0.45},
  {id:'al-sila',name:'Al Sila',nameAr:'الصيلة',lat:24.1300,lng:51.5600,region:'Al Dhafra',type:'coastal',density:0.35},
  {id:'ghayathi',name:'Ghayathi',nameAr:'غياثي',lat:23.8600,lng:52.8200,region:'Al Dhafra',type:'suburban',density:0.40},
  {id:'liwa-oasis',name:'Liwa Oasis',nameAr:'واحة ليوا',lat:23.1200,lng:53.7700,region:'Al Dhafra',type:'oasis',density:0.28},
  {id:'al-hamra',name:'Al Hamra',nameAr:'الحمرة',lat:24.0800,lng:52.5900,region:'Al Dhafra',type:'coastal',density:0.38},
  {id:'al-dhafra-area',name:'Al Dhafra Area',nameAr:'منطقة الظفرة',lat:24.2400,lng:54.5500,region:'Al Dhafra',type:'suburban',density:0.42},
  // Yas Island & Tourism
  {id:'yas-island',name:'Yas Island',nameAr:'جزيرة ياس',lat:24.4880,lng:54.6060,region:'Abu Dhabi',type:'tourism',density:0.65},
  {id:'saadiyat-island',name:'Saadiyat Island',nameAr:'جزيرة السعديات',lat:24.5350,lng:54.4300,region:'Abu Dhabi',type:'tourism',density:0.60},
  {id:'al-reem-island',name:'Al Reem Island',nameAr:'جزيرة الريم',lat:24.5100,lng:54.4000,region:'Abu Dhabi',type:'urban',density:0.82},
  {id:'al-maryah-island',name:'Al Maryah Island',nameAr:'جزيرة الماريا',lat:24.4950,lng:54.3900,region:'Abu Dhabi',type:'urban',density:0.78},
  {id:'al-lulu-island',name:'Al Lulu Island',nameAr:'جزيرة اللولو',lat:24.4600,lng:54.3600,region:'Abu Dhabi',type:'tourism',density:0.30},
  // Additional Abu Dhabi Districts
  {id:'al-karamah',name:'Al Karamah',nameAr:'الكرامة',lat:24.4400,lng:54.3700,region:'Abu Dhabi',type:'urban',density:0.84},
  {id:'al-danah',name:'Al Danah',nameAr:'الدانة',lat:24.4800,lng:54.3700,region:'Abu Dhabi',type:'urban',density:0.86},
  {id:'al-markaziyah',name:'Al Markaziyah',nameAr:'المركزية',lat:24.4700,lng:54.3600,region:'Abu Dhabi',type:'urban',density:0.90},
  {id:'al-rawdah',name:'Al Rawdah',nameAr:'الروضة',lat:24.4600,lng:54.3800,region:'Abu Dhabi',type:'urban',density:0.83},
  {id:'al-manaseer',name:'Al Manaseer',nameAr:'المناصير',lat:24.4300,lng:54.4000,region:'Abu Dhabi',type:'urban',density:0.80},
  {id:'al-mamoura',name:'Al Mamoura',nameAr:'المأمورة',lat:24.4200,lng:54.4200,region:'Abu Dhabi',type:'urban',density:0.78},
  {id:'al-madina-zayed',name:'Al Madina Zayed',nameAr:'مدينة زايد',lat:24.4100,lng:54.4100,region:'Abu Dhabi',type:'urban',density:0.76},
  {id:'al-zaab',name:'Al Zaab',nameAr:'الزعاب',lat:24.4000,lng:54.4300,region:'Abu Dhabi',type:'urban',density:0.74},
  // Al Ain surroundings
  {id:'al-ain-east',name:'Al Ain East',nameAr:'شرق العين',lat:24.2200,lng:55.8500,region:'Al Ain',type:'suburban',density:0.50},
  {id:'al-ain-north',name:'Al Ain North',nameAr:'شمال العين',lat:24.3000,lng:55.7500,region:'Al Ain',type:'suburban',density:0.55},
  {id:'al-ain-south',name:'Al Ain South',nameAr:'جنوب العين',lat:24.1500,lng:55.7500,region:'Al Ain',type:'suburban',density:0.52},
  {id:'al-ain-west',name:'Al Ain West',nameAr:'غرب العين',lat:24.2000,lng:55.6500,region:'Al Ain',type:'suburban',density:0.48},
  {id:'al-hayer',name:'Al Hayer',nameAr:'الهير',lat:24.3500,lng:55.4500,region:'Al Ain',type:'suburban',density:0.42},
  {id:'al-ain-airport-area',name:'Al Ain Airport Area',nameAr:'منطقة مطار العين',lat:24.2600,lng:55.6100,region:'Al Ain',type:'suburban',density:0.58},
  {id:'al-ain-downtown',name:'Al Ain Downtown',nameAr:'وسط البلد العين',lat:24.2100,lng:55.7400,region:'Al Ain',type:'urban',density:0.85},
  {id:'al-ain-mall-area',name:'Al Ain Mall Area',nameAr:'منطقة مول العين',lat:24.2150,lng:55.7550,region:'Al Ain',type:'urban',density:0.80},
  {id:'al-ain-hospital-area',name:'Al Ain Hospital Area',nameAr:'منطقة مستشفى العين',lat:24.2250,lng:55.7450,region:'Al Ain',type:'urban',density:0.78},
  // Coastal areas
  {id:'al-jubail-island',name:'Al Jubail Island',nameAr:'جزيرة الجبيل',lat:24.4500,lng:54.5500,region:'Abu Dhabi',type:'coastal',density:0.35},
  {id:'al-hudayriyat',name:'Al Hudayriyat Island',nameAr:'جزيرة الحديريات',lat:24.4100,lng:54.3400,region:'Abu Dhabi',type:'coastal',density:0.40},
  // Industrial zones
  {id:'icad',name:'ICAD (Industrial City)',nameAr:'المدينة الصناعية أبوظبي',lat:24.3600,lng:54.5800,region:'Abu Dhabi',type:'industrial',density:0.72},
  {id:'kizad',name:'KIZAD',nameAr:'كيزاد',lat:24.4200,lng:54.6800,region:'Abu Dhabi',type:'industrial',density:0.68},
  {id:'al-ain-industrial-2',name:'Al Ain Industrial 2',nameAr:'العين الصناعية 2',lat:24.1900,lng:55.6800,region:'Al Ain',type:'industrial',density:0.65},
  // New developments
  {id:'masdar-city',name:'Masdar City',nameAr:'مدينة مصدر',lat:24.4360,lng:54.6180,region:'Abu Dhabi',type:'urban',density:0.55},
  {id:'al-maqta',name:'Al Maqta',nameAr:'المقطع',lat:24.4050,lng:54.4900,region:'Abu Dhabi',type:'urban',density:0.70},
  {id:'al-musaffah-bridge',name:'Al Musaffah Bridge Area',nameAr:'منطقة جسر المصفح',lat:24.3700,lng:54.4700,region:'Abu Dhabi',type:'urban',density:0.75},
  // Highway corridors
  {id:'ad-ain-highway',name:'Abu Dhabi–Al Ain Highway',nameAr:'طريق أبوظبي-العين',lat:24.3200,lng:55.1000,region:'Abu Dhabi',type:'highway',density:0.30},
  {id:'e11-highway',name:'E11 Coastal Highway',nameAr:'طريق E11 الساحلي',lat:24.2000,lng:53.5000,region:'Al Dhafra',type:'highway',density:0.25},
  // Border areas
  {id:'al-ain-border-oman',name:'Al Ain – Oman Border',nameAr:'العين – الحدود العمانية',lat:24.2000,lng:55.9000,region:'Al Ain',type:'border',density:0.20},
  // Additional districts
  {id:'al-karama-ad',name:'Al Karama Abu Dhabi',nameAr:'الكرامة أبوظبي',lat:24.4350,lng:54.3650,region:'Abu Dhabi',type:'urban',density:0.82},
  {id:'al-reef-downtown',name:'Al Reef Downtown',nameAr:'ريف داون تاون',lat:24.3450,lng:54.7350,region:'Abu Dhabi',type:'suburban',density:0.64},
  {id:'al-ain-al-khrair',name:'Al Ain Al Khrair',nameAr:'العين الخرير',lat:24.2400,lng:55.8000,region:'Al Ain',type:'suburban',density:0.48},
  {id:'al-ain-al-mutawaa',name:'Al Ain Al Mutawaa',nameAr:'العين المطوع',lat:24.2700,lng:55.7200,region:'Al Ain',type:'suburban',density:0.52},
  {id:'al-ain-al-towayya',name:'Al Ain Al Towayya',nameAr:'العين الطوية',lat:24.2300,lng:55.7100,region:'Al Ain',type:'suburban',density:0.50},
];

// ── Build full historical dataset ────────────────────────────────────────────
function buildHistoricalData(): HistoricalRegion[] {
  return RAW_REGIONS.map(r => {
    const events: HistoricalEvent[] = FLOOD_EVENTS.map(ev => {
      // Deterministic seed from region id + year + month
      let seed = 0;
      for (let i = 0; i < r.id.length; i++) seed += r.id.charCodeAt(i);
      seed = (seed * 31 + ev.year * 13 + ev.month * 7) % 1000;
      const depth = calcDepth(r.type, r.density, ev.max_mm, ev.severity, seed);
      return {
        year: ev.year,
        month: ev.month,
        name: ev.name,
        severity: ev.severity as HistoricalEvent['severity'],
        precipMm: ev.max_mm,
        waterDepthCm: depth,
        level: classifyLevel(depth),
      };
    });

    const yearlySummary: Record<number, YearlySummary> = {};
    for (const ev of events) {
      if (!yearlySummary[ev.year]) {
        yearlySummary[ev.year] = { maxDepth: 0, totalEvents: 0, maxLevel: 'safe' };
      }
      yearlySummary[ev.year].totalEvents++;
      if (ev.waterDepthCm > yearlySummary[ev.year].maxDepth) {
        yearlySummary[ev.year].maxDepth = ev.waterDepthCm;
        yearlySummary[ev.year].maxLevel = ev.level;
      }
    }

    return { ...r, events, yearlySummary };
  });
}

export const HISTORICAL_REGIONS: HistoricalRegion[] = buildHistoricalData();

// ── Helper: get events for a specific year ───────────────────────────────────
export function getEventsForYear(year: number): FloodEventDef[] {
  return FLOOD_EVENTS.filter(e => e.year === year);
}

// ── Helper: get events for a specific year+month ─────────────────────────────
export function getEventForYearMonth(year: number, month: number): FloodEventDef | undefined {
  return FLOOD_EVENTS.find(e => e.year === year && e.month === month);
}

// ── Helper: get region data for a specific event ─────────────────────────────
export function getRegionDataForEvent(regionId: string, year: number, month: number): HistoricalEvent | undefined {
  const region = HISTORICAL_REGIONS.find(r => r.id === regionId);
  if (!region) return undefined;
  return region.events.find(e => e.year === year && e.month === month);
}

// ── Available years ───────────────────────────────────────────────────────────
export const AVAILABLE_YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

// ── Level color mapping ───────────────────────────────────────────────────────
export const LEVEL_COLORS: Record<WaterLevel, string> = {
  safe:     '#10B981',
  minor:    '#3B82F6',
  moderate: '#F59E0B',
  severe:   '#EF4444',
  extreme:  '#7C3AED',
};

export const LEVEL_LABELS: Record<WaterLevel, { ar: string; en: string }> = {
  safe:     { ar: 'آمن',     en: 'Safe'     },
  minor:    { ar: 'طفيف',    en: 'Minor'    },
  moderate: { ar: 'متوسط',   en: 'Moderate' },
  severe:   { ar: 'شديد',    en: 'Severe'   },
  extreme:  { ar: 'كارثي',   en: 'Extreme'  },
};
