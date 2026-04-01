import fs from 'fs';
import path from 'path';

const src = fs.readFileSync(path.resolve('/home/ubuntu/work/flood_project/flood-full/client/src/data/abuDhabiRegions.ts'), 'utf8');

function findMatchingBracket(text, openIndex, openChar, closeChar) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    const prev = text[i - 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (prev === '*' && ch === '/') inBlockComment = false;
      continue;
    }
    if (!inSingle && !inDouble && !inTemplate) {
      if (ch === '/' && next === '/') { inLineComment = true; i++; continue; }
      if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
    }
    if (!inDouble && !inTemplate && ch === "'" && prev !== '\\') { inSingle = !inSingle; continue; }
    if (!inSingle && !inTemplate && ch === '"' && prev !== '\\') { inDouble = !inDouble; continue; }
    if (!inSingle && !inDouble && ch === '`' && prev !== '\\') { inTemplate = !inTemplate; continue; }
    if (inSingle || inDouble || inTemplate) continue;

    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error(`No matching bracket for ${openChar} at ${openIndex}`);
}

function extractAreas(blockName) {
  const start = src.indexOf(`const ${blockName}: SubArea[] = [`);
  if (start === -1) throw new Error(`Block not found: ${blockName}`);
  const eqIndex = src.indexOf('=', start);
  const open = src.indexOf('[', eqIndex);
  const end = findMatchingBracket(src, open, '[', ']');
  const arrText = src.slice(open, end + 1)
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(\{|,)\s*(\w+)\s*:/g, '$1 "$2":')
    .replace(/,\s*]/g, ']')
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, s) => JSON.stringify(s));
  return JSON.parse(arrText);
}

const areas = [
  ...extractAreas('ABU_DHABI_AREAS'),
  ...extractAreas('AL_AIN_AREAS'),
  ...extractAreas('AL_DHAFRA_AREAS'),
];

function buildAdministrativePolygon(area, allAreas) {
  const cityAreas = allAreas.filter(candidate => candidate.cityId === area.cityId);
  const cityPeers = cityAreas.filter(candidate => candidate.id !== area.id);
  const lngDivider = 111.320 * Math.max(0.3, Math.cos((area.lat * Math.PI) / 180));
  const halfSideKm = Math.max(0.8, Math.sqrt(Math.max(area.areaSqKm, 1)) / 2);
  const baseLatHalf = halfSideKm / 110.574;
  const baseLngHalf = halfSideKm / lngDivider;

  const northPeer = cityPeers
    .filter(candidate => candidate.lat > area.lat)
    .sort((a, b) => (Math.abs(a.lat - area.lat) + Math.abs(a.lng - area.lng) * 0.55) - (Math.abs(b.lat - area.lat) + Math.abs(b.lng - area.lng) * 0.55))[0];
  const southPeer = cityPeers
    .filter(candidate => candidate.lat < area.lat)
    .sort((a, b) => (Math.abs(a.lat - area.lat) + Math.abs(a.lng - area.lng) * 0.55) - (Math.abs(b.lat - area.lat) + Math.abs(b.lng - area.lng) * 0.55))[0];
  const eastPeer = cityPeers
    .filter(candidate => candidate.lng > area.lng)
    .sort((a, b) => (Math.abs(a.lng - area.lng) + Math.abs(a.lat - area.lat) * 0.55) - (Math.abs(b.lng - area.lng) + Math.abs(b.lat - area.lat) * 0.55))[0];
  const westPeer = cityPeers
    .filter(candidate => candidate.lng < area.lng)
    .sort((a, b) => (Math.abs(a.lng - area.lng) + Math.abs(a.lat - area.lat) * 0.55) - (Math.abs(b.lng - area.lng) + Math.abs(b.lat - area.lat) * 0.55))[0];

  const cityLatMin = Math.min(...cityAreas.map(candidate => candidate.lat));
  const cityLatMax = Math.max(...cityAreas.map(candidate => candidate.lat));
  const cityLngMin = Math.min(...cityAreas.map(candidate => candidate.lng));
  const cityLngMax = Math.max(...cityAreas.map(candidate => candidate.lng));

  const northEdge = northPeer ? (area.lat + northPeer.lat) / 2 : Math.min(cityLatMax + baseLatHalf * 0.25, area.lat + baseLatHalf * 1.9);
  const southEdge = southPeer ? (area.lat + southPeer.lat) / 2 : Math.max(cityLatMin - baseLatHalf * 0.25, area.lat - baseLatHalf * 1.9);
  const eastEdge = eastPeer ? (area.lng + eastPeer.lng) / 2 : Math.min(cityLngMax + baseLngHalf * 0.25, area.lng + baseLngHalf * 1.9);
  const westEdge = westPeer ? (area.lng + westPeer.lng) / 2 : Math.max(cityLngMin - baseLngHalf * 0.25, area.lng - baseLngHalf * 1.9);

  const expandLat = Math.max(0.0018, Math.abs(northEdge - southEdge) * 0.07);
  const expandLng = Math.max(0.0018, Math.abs(eastEdge - westEdge) * 0.07);

  const north = northEdge + expandLat;
  const south = southEdge - expandLat;
  const east = eastEdge + expandLng;
  const west = westEdge - expandLng;

  const insetLng = Math.max(0.0009, (east - west) * 0.16);
  const insetLat = Math.max(0.0009, (north - south) * 0.16);
  const coastalShift = area.districtType.includes('coastal') ? (east - west) * 0.08 : 0;
  const desertLift = area.districtType.includes('desert') || area.districtType.includes('agricultural') ? (north - south) * 0.06 : 0;

  return [
    [south, west + insetLng],
    [south + insetLat * 0.35, west],
    [north - insetLat * 0.45 + desertLift, west + coastalShift * 0.2],
    [north, west + insetLng * 1.1 + coastalShift * 0.35],
    [north - insetLat * 0.2 + desertLift, east - insetLng * 0.9 + coastalShift],
    [south + insetLat * 0.45, east],
    [south, east - insetLng * 0.85],
    [south + insetLat * 0.18, west + (east - west) * 0.42],
  ];
}

const polys = areas.map(area => ({ id: area.id, cityId: area.cityId, polygon: buildAdministrativePolygon(area, areas) }));
const invalid = polys.filter(p => p.polygon.flat().some(v => !Number.isFinite(v)));
const latitudes = polys.flatMap(p => p.polygon.map(pt => pt[0]));
const longitudes = polys.flatMap(p => p.polygon.map(pt => pt[1]));
const sampleExtents = polys.slice(0, 12).map(p => ({
  id: p.id,
  cityId: p.cityId,
  minLat: Math.min(...p.polygon.map(pt => pt[0])),
  maxLat: Math.max(...p.polygon.map(pt => pt[0])),
  minLng: Math.min(...p.polygon.map(pt => pt[1])),
  maxLng: Math.max(...p.polygon.map(pt => pt[1])),
}));

console.log(JSON.stringify({
  areaCount: areas.length,
  invalidCount: invalid.length,
  bounds: latitudes.length ? {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  } : null,
  sampleExtents,
}, null, 2));
