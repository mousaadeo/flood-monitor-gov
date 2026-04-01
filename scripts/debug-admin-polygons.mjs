import fs from 'fs';

const src = fs.readFileSync('/home/ubuntu/work/flood_project/flood-full/client/src/data/abuDhabiRegions.ts', 'utf8');

function parseAreas(prefix) {
  const regex = new RegExp(`id: '${prefix}-(\\d{2})',[\\s\\S]*?nameAr: '([^']+)', nameEn: '([^']+)', lat: ([0-9.]+), lng: ([0-9.]+), areaSqKm: ([0-9.]+)[\\s\\S]*?cityId: '([^']+)', districtType: '([^']+)'`, 'g');
  const rows = [];
  let m;
  while ((m = regex.exec(src)) !== null) {
    rows.push({
      id: `${prefix}-${m[1]}`,
      nameAr: m[2],
      nameEn: m[3],
      lat: Number(m[4]),
      lng: Number(m[5]),
      areaSqKm: Number(m[6]),
      cityId: m[7],
      districtType: m[8],
    });
  }
  return rows;
}

const allAreas = [...parseAreas('ad'), ...parseAreas('ain'), ...parseAreas('dhf')];

function buildAdministrativePolygon(area, allAreas) {
  const cityAreas = allAreas.filter(candidate => candidate.cityId === area.cityId);
  const cityPeers = cityAreas.filter(candidate => candidate.id !== area.id);
  const lngDivider = 111.320 * Math.max(0.3, Math.cos((area.lat * Math.PI) / 180));
  const halfSideKm = Math.max(0.8, Math.sqrt(Math.max(area.areaSqKm, 1)) / 2);
  const baseLatHalf = halfSideKm / 110.574;
  const baseLngHalf = halfSideKm / lngDivider;

  const sortFn = (a, b) => (Math.abs(a.lat - area.lat) + Math.abs(a.lng - area.lng) * 0.55) - (Math.abs(b.lat - area.lat) + Math.abs(b.lng - area.lng) * 0.55);
  const sortLngFn = (a, b) => (Math.abs(a.lng - area.lng) + Math.abs(a.lat - area.lat) * 0.55) - (Math.abs(b.lng - area.lng) + Math.abs(b.lat - area.lat) * 0.55);

  const northPeer = cityPeers.filter(candidate => candidate.lat > area.lat).sort(sortFn)[0];
  const southPeer = cityPeers.filter(candidate => candidate.lat < area.lat).sort(sortFn)[0];
  const eastPeer = cityPeers.filter(candidate => candidate.lng > area.lng).sort(sortLngFn)[0];
  const westPeer = cityPeers.filter(candidate => candidate.lng < area.lng).sort(sortLngFn)[0];

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

function polygonSummary(area) {
  const poly = buildAdministrativePolygon(area, allAreas);
  const lats = poly.map(p => p[0]);
  const lngs = poly.map(p => p[1]);
  return {
    id: area.id,
    cityId: area.cityId,
    nameEn: area.nameEn,
    centerLat: area.lat,
    centerLng: area.lng,
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    latSpan: Math.max(...lats) - Math.min(...lats),
    lngSpan: Math.max(...lngs) - Math.min(...lngs),
  };
}

const summaries = allAreas.map(polygonSummary);
const byCity = ['abudhabi', 'alain', 'dhafra'].map(cityId => {
  const rows = summaries.filter(r => r.cityId === cityId);
  return {
    cityId,
    count: rows.length,
    minLatSpan: Math.min(...rows.map(r => r.latSpan)),
    maxLatSpan: Math.max(...rows.map(r => r.latSpan)),
    minLngSpan: Math.min(...rows.map(r => r.lngSpan)),
    maxLngSpan: Math.max(...rows.map(r => r.lngSpan)),
    bbox: {
      minLat: Math.min(...rows.map(r => r.minLat)),
      maxLat: Math.max(...rows.map(r => r.maxLat)),
      minLng: Math.min(...rows.map(r => r.minLng)),
      maxLng: Math.max(...rows.map(r => r.maxLng)),
    },
  };
});

console.log(JSON.stringify({ total: summaries.length, byCity, samples: summaries.slice(0, 12) }, null, 2));
