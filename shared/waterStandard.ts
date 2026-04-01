/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║          FLOODSAT — UNIFIED WATER ACCUMULATION STANDARD                  ║
 * ║          المنهجية الموحدة لعرض تجمعات المياه                             ║
 * ║                                                                           ║
 * ║  Visual philosophy: FastFlood-style                                       ║
 * ║  ─ Blue-only gradient palette (0.1m → 5m depth)                          ║
 * ║  ─ Transparent overlay on satellite imagery                               ║
 * ║  ─ No circles, no glows — flat water patches following terrain            ║
 * ║  ─ Perceptually uniform: lighter = shallower, darker = deeper             ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * DEPTH SCALE (matches FastFlood legend):
 * ─────────────────────────────────────────
 *  0 m    — No water (transparent)
 *  0.1 m  — Surface wetness / damp soil     (very light sky blue)
 *  0.25 m — Shallow pooling                 (light blue)
 *  0.5 m  — Road-level flooding             (medium blue)
 *  1 m    — Deep flooding                   (blue)
 *  2 m    — Severe flooding                 (dark blue)
 *  5 m    — Flash flood / life threat       (deep navy blue)
 */

// ─── Level IDs ────────────────────────────────────────────────────────────────
export type WaterLevel = 'none' | 'trace' | 'minor' | 'moderate' | 'severe' | 'extreme';

// ─── Depth thresholds (cm) — matches FastFlood scale ─────────────────────────
export const WATER_DEPTH_THRESHOLDS = {
  none:     { min: 0,   max: 10  },   // 0 m
  trace:    { min: 10,  max: 25  },   // 0.1 m
  minor:    { min: 25,  max: 50  },   // 0.25 m
  moderate: { min: 50,  max: 100 },   // 0.5 m
  severe:   { min: 100, max: 200 },   // 1 m
  extreme:  { min: 200, max: Infinity }, // 2–5 m
} as const;

// ─── Score thresholds (0–100 accumulation score) ─────────────────────────────
export const WATER_SCORE_THRESHOLDS = {
  none:     { min: 0,  max: 10 },
  trace:    { min: 10, max: 25 },
  minor:    { min: 25, max: 45 },
  moderate: { min: 45, max: 65 },
  severe:   { min: 65, max: 82 },
  extreme:  { min: 82, max: 100 },
} as const;

// ─── FastFlood Blue Gradient Palette ─────────────────────────────────────────
// All levels use blue-family colors only.
// mapFill uses rgba with low alpha for satellite overlay transparency.
// fill/stroke used in UI cards, badges, and charts.
export const WATER_COLORS: Record<WaterLevel, {
  fill: string;       // UI fill color (cards, badges)
  stroke: string;     // border/stroke color
  glow: string;       // subtle glow for UI only (not map)
  text: string;       // text color on dark background
  badge: string;      // badge background
  badgeText: string;  // badge text color
  mapFill: string;    // map overlay fill (rgba, low alpha)
  mapStroke: string;  // map overlay stroke (very subtle)
  hex: string;        // pure hex for gradient calculations
}> = {
  none: {
    fill:       'transparent',
    stroke:     'transparent',
    glow:       'transparent',
    text:       '#94A3B8',
    badge:      'rgba(148,163,184,0.1)',
    badgeText:  '#94A3B8',
    mapFill:    'rgba(0,0,0,0)',
    mapStroke:  'rgba(0,0,0,0)',
    hex:        '#000000',
  },
  // 0.1 m — very light sky blue (barely visible, just a hint of moisture)
  trace: {
    fill:       '#DBEAFE',
    stroke:     '#BFDBFE',
    glow:       'rgba(219,234,254,0.3)',
    text:       '#BFDBFE',
    badge:      'rgba(219,234,254,0.15)',
    badgeText:  '#93C5FD',
    mapFill:    'rgba(219,234,254,0.28)',
    mapStroke:  'rgba(147,197,253,0.4)',
    hex:        '#DBEAFE',
  },
  // 0.25 m — light blue
  minor: {
    fill:       '#93C5FD',
    stroke:     '#60A5FA',
    glow:       'rgba(147,197,253,0.35)',
    text:       '#93C5FD',
    badge:      'rgba(147,197,253,0.2)',
    badgeText:  '#93C5FD',
    mapFill:    'rgba(147,197,253,0.42)',
    mapStroke:  'rgba(96,165,250,0.55)',
    hex:        '#93C5FD',
  },
  // 0.5 m — medium blue
  moderate: {
    fill:       '#3B82F6',
    stroke:     '#2563EB',
    glow:       'rgba(59,130,246,0.4)',
    text:       '#93C5FD',
    badge:      'rgba(59,130,246,0.2)',
    badgeText:  '#93C5FD',
    mapFill:    'rgba(59,130,246,0.52)',
    mapStroke:  'rgba(37,99,235,0.70)',
    hex:        '#3B82F6',
  },
  // 1 m — dark blue
  severe: {
    fill:       '#1D4ED8',
    stroke:     '#1E40AF',
    glow:       'rgba(29,78,216,0.5)',
    text:       '#BFDBFE',
    badge:      'rgba(29,78,216,0.25)',
    badgeText:  '#BFDBFE',
    mapFill:    'rgba(29,78,216,0.62)',
    mapStroke:  'rgba(30,64,175,0.80)',
    hex:        '#1D4ED8',
  },
  // 2–5 m — deep navy blue
  extreme: {
    fill:       '#1E3A8A',
    stroke:     '#172554',
    glow:       'rgba(30,58,138,0.6)',
    text:       '#DBEAFE',
    badge:      'rgba(30,58,138,0.3)',
    badgeText:  '#DBEAFE',
    mapFill:    'rgba(30,58,138,0.75)',
    mapStroke:  'rgba(23,37,84,0.90)',
    hex:        '#1E3A8A',
  },
};

// ─── Labels (bilingual) — FastFlood depth scale ───────────────────────────────
export const WATER_LABELS: Record<WaterLevel, { ar: string; en: string; short_ar: string; short_en: string; depth: string }> = {
  none:     { ar: 'لا مياه',          en: 'No Water',      short_ar: 'لا شيء',  short_en: 'None',     depth: '0 m'     },
  trace:    { ar: 'رطوبة (0.1 م)',    en: 'Wet (0.1 m)',   short_ar: '0.1 م',   short_en: '0.1 m',    depth: '0.1 m'   },
  minor:    { ar: 'تجمع (0.25 م)',    en: 'Pool (0.25 m)', short_ar: '0.25 م',  short_en: '0.25 m',   depth: '0.25 m'  },
  moderate: { ar: 'فيضان (0.5 م)',    en: 'Flood (0.5 m)', short_ar: '0.5 م',   short_en: '0.5 m',    depth: '0.5 m'   },
  severe:   { ar: 'فيضان عميق (1 م)', en: 'Deep (1 m)',    short_ar: '1 م',     short_en: '1 m',      depth: '1 m'     },
  extreme:  { ar: 'سيل (2–5 م)',      en: 'Flash (2–5 m)', short_ar: '2–5 م',   short_en: '2–5 m',    depth: '2–5 m'   },
};

// ─── Icons (Unicode symbols) ──────────────────────────────────────────────────
export const WATER_ICONS: Record<WaterLevel, string> = {
  none:     '○',
  trace:    '◔',
  minor:    '◑',
  moderate: '◕',
  severe:   '●',
  extreme:  '⬟',
};

// ─── Map circle sizing (radius in meters) ─────────────────────────────────────
export const WATER_MAP_RADIUS: Record<WaterLevel, number> = {
  none:     0,
  trace:    2_000,
  minor:    3_500,
  moderate: 5_500,
  severe:   8_000,
  extreme:  11_000,
};

// ─── Depth display formatting ─────────────────────────────────────────────────
export function formatDepth(depthCm: number, lang: 'ar' | 'en' = 'en'): string {
  if (depthCm <= 0)   return lang === 'ar' ? 'لا مياه' : 'No water';
  if (depthCm < 100)  return `${Math.round(depthCm)} ${lang === 'ar' ? 'سم' : 'cm'}`;
  return `${(depthCm / 100).toFixed(1)} ${lang === 'ar' ? 'م' : 'm'}`;
}

// ─── Area display formatting ──────────────────────────────────────────────────
export function formatArea(areaKm2: number, lang: 'ar' | 'en' = 'en'): string {
  if (areaKm2 < 0.01) return lang === 'ar' ? '< 0.01 كم²' : '< 0.01 km²';
  if (areaKm2 < 1)    return `${(areaKm2 * 100).toFixed(0)} ${lang === 'ar' ? 'هكتار' : 'ha'}`;
  return `${areaKm2.toFixed(2)} ${lang === 'ar' ? 'كم²' : 'km²'}`;
}

// ─── Volume display formatting ────────────────────────────────────────────────
export function formatVolume(volumeM3: number, lang: 'ar' | 'en' = 'en'): string {
  if (volumeM3 < 1_000)     return `${Math.round(volumeM3)} ${lang === 'ar' ? 'م³' : 'm³'}`;
  if (volumeM3 < 1_000_000) return `${(volumeM3 / 1_000).toFixed(1)} ${lang === 'ar' ? 'ألف م³' : 'K m³'}`;
  return `${(volumeM3 / 1_000_000).toFixed(2)} ${lang === 'ar' ? 'مليون م³' : 'M m³'}`;
}

// ─── Classify by depth ────────────────────────────────────────────────────────
export function classifyByDepth(depthCm: number): WaterLevel {
  if (depthCm <= 0)   return 'none';
  if (depthCm < 25)   return 'trace';
  if (depthCm < 50)   return 'minor';
  if (depthCm < 100)  return 'moderate';
  if (depthCm < 200)  return 'severe';
  return 'extreme';
}

// ─── Classify by score ────────────────────────────────────────────────────────
export function classifyByScore(score: number): WaterLevel {
  if (score < 10)  return 'none';
  if (score < 25)  return 'trace';
  if (score < 45)  return 'minor';
  if (score < 65)  return 'moderate';
  if (score < 82)  return 'severe';
  return 'extreme';
}

// ─── Get full display info for a level ────────────────────────────────────────
export function getWaterDisplay(level: WaterLevel, lang: 'ar' | 'en' = 'en') {
  return {
    level,
    color:      WATER_COLORS[level],
    label:      WATER_LABELS[level][lang],
    shortLabel: WATER_LABELS[level][lang === 'ar' ? 'short_ar' : 'short_en'],
    depthLabel: WATER_LABELS[level].depth,
    icon:       WATER_ICONS[level],
    radius:     WATER_MAP_RADIUS[level],
    depthRange: WATER_DEPTH_THRESHOLDS[level],
    scoreRange: WATER_SCORE_THRESHOLDS[level],
  };
}

// ─── Ordered levels for legend rendering (shallow → deep, FastFlood style) ────
export const WATER_LEVELS_ORDERED: WaterLevel[] = [
  'none', 'trace', 'minor', 'moderate', 'severe', 'extreme',
];

// ─── Legend data — FastFlood depth scale ─────────────────────────────────────
export function getWaterLegend(lang: 'ar' | 'en' = 'en') {
  return WATER_LEVELS_ORDERED.map(level => ({
    level,
    label:      WATER_LABELS[level][lang],
    shortLabel: WATER_LABELS[level][lang === 'ar' ? 'short_ar' : 'short_en'],
    depthLabel: WATER_LABELS[level].depth,
    icon:       WATER_ICONS[level],
    color:      WATER_COLORS[level].fill,
    mapFill:    WATER_COLORS[level].mapFill,
    mapStroke:  WATER_COLORS[level].mapStroke,
    hex:        WATER_COLORS[level].hex,
    depthRange: WATER_DEPTH_THRESHOLDS[level],
  }));
}
