import {
  RealCityBuilding,
  RealCityData,
  RealCityPolygonFeature,
  RealCityRoad,
  RealCitySearchResult,
} from '../types/solar';
import { NOAA_LOCATIONS } from '../data/noaaLocations';

export const WORLD_CITY_PRESETS: RealCitySearchResult[] = [
  // Brasil
  { name: 'São Paulo', displayName: 'São Paulo, Brasil', lat: -23.5614, lng: -46.6559, country: 'Brasil', region: 'Brasil' },
  { name: 'Rio de Janeiro', displayName: 'Rio de Janeiro, Brasil', lat: -22.9068, lng: -43.1729, country: 'Brasil', region: 'Brasil' },
  { name: 'Brasília', displayName: 'Brasília, DF, Brasil', lat: -15.7938, lng: -47.8827, country: 'Brasil', region: 'Brasil' },
  { name: 'Salvador', displayName: 'Salvador, Bahia, Brasil', lat: -12.9714, lng: -38.5014, country: 'Brasil', region: 'Brasil' },
  { name: 'Recife', displayName: 'Recife, Pernambuco, Brasil', lat: -8.0476, lng: -34.8770, country: 'Brasil', region: 'Brasil' },
  { name: 'Fortaleza', displayName: 'Fortaleza, Ceará, Brasil', lat: -3.7319, lng: -38.5267, country: 'Brasil', region: 'Brasil' },
  { name: 'Manaus', displayName: 'Manaus, Amazonas, Brasil', lat: -3.1190, lng: -60.0217, country: 'Brasil', region: 'Brasil' },
  { name: 'Cuiabá', displayName: 'Cuiabá, Mato Grosso, Brasil', lat: -15.6014, lng: -56.0979, country: 'Brasil', region: 'Brasil' },
  { name: 'Campo Grande', displayName: 'Campo Grande, MS, Brasil', lat: -20.4697, lng: -54.6201, country: 'Brasil', region: 'Brasil' },
  { name: 'Belém', displayName: 'Belém, Pará, Brasil', lat: -1.4558, lng: -48.5044, country: 'Brasil', region: 'Brasil' },
  { name: 'Altamira', displayName: 'Altamira / Oeste Paraense, PA, Brasil', lat: -3.2033, lng: -52.2064, country: 'Brasil', region: 'Brasil' },
  { name: 'Palmas / Araguaína', displayName: 'Palmas / Araguaína, Tocantins, Brasil', lat: -10.2491, lng: -48.3243, country: 'Brasil', region: 'Brasil' },
  { name: 'Curitiba', displayName: 'Curitiba, Paraná, Brasil', lat: -25.4284, lng: -49.2733, country: 'Brasil', region: 'Brasil' },
  { name: 'Porto Alegre', displayName: 'Porto Alegre, RS, Brasil', lat: -30.0346, lng: -51.2177, country: 'Brasil', region: 'Brasil' },
  { name: 'Fernando de Noronha', displayName: 'Fernando de Noronha, PE, Brasil', lat: -3.8549, lng: -32.4233, country: 'Brasil', region: 'Brasil' },
  // Américas (indices 15..25 keep Nova York at 15 etc.? Wait: SolarDashboard HUD references indices 10, 11, 12, 13, 16, 17 - let's update HUD to lookup by name so it is never brittle!)
  { name: 'Nova York', displayName: 'Manhattan, Nova York, EUA', lat: 40.758, lng: -73.9855, country: 'Estados Unidos', region: 'Américas' },
  { name: 'Miami', displayName: 'Miami Beach, Flórida, EUA', lat: 25.7617, lng: -80.1918, country: 'Estados Unidos', region: 'Américas' },
  { name: 'Los Angeles', displayName: 'Los Angeles, Califórnia, EUA', lat: 34.0522, lng: -118.2437, country: 'Estados Unidos', region: 'Américas' },
  { name: 'Toronto', displayName: 'Toronto, Canadá', lat: 43.6532, lng: -79.3832, country: 'Canadá', region: 'Américas' },
  { name: 'Cidade do México', displayName: 'Cidade do México, México', lat: 19.4326, lng: -99.1332, country: 'México', region: 'Américas' },
  { name: 'Havana', displayName: 'Havana, Cuba', lat: 23.1365, lng: -82.3589, country: 'Cuba', region: 'Américas' },
  { name: 'Bogotá', displayName: 'Bogotá, Colômbia', lat: 4.7110, lng: -74.0721, country: 'Colômbia', region: 'Américas' },
  { name: 'Lima', displayName: 'Lima, Peru', lat: -12.0464, lng: -77.0428, country: 'Peru', region: 'Américas' },
  { name: 'Santiago', displayName: 'Santiago, Chile', lat: -33.4489, lng: -70.6693, country: 'Chile', region: 'Américas' },
  { name: 'Buenos Aires', displayName: 'Buenos Aires, Argentina', lat: -34.6037, lng: -58.3816, country: 'Argentina', region: 'Américas' },
  { name: 'Ushuaia', displayName: 'Ushuaia, Terra do Fogo, Argentina', lat: -54.8019, lng: -68.3030, country: 'Argentina', region: 'Américas' },
  // Europa
  { name: 'Londres', displayName: 'Londres, Reino Unido', lat: 51.5074, lng: -0.1278, country: 'Reino Unido', region: 'Europa' },
  { name: 'Paris', displayName: 'Paris, França', lat: 48.8566, lng: 2.3522, country: 'França', region: 'Europa' },
  { name: 'Lisboa', displayName: 'Lisboa, Portugal', lat: 38.7223, lng: -9.1393, country: 'Portugal', region: 'Europa' },
  { name: 'Madri', displayName: 'Madri, Espanha', lat: 40.4168, lng: -3.7038, country: 'Espanha', region: 'Europa' },
  { name: 'Roma', displayName: 'Roma, Itália', lat: 41.9028, lng: 12.4964, country: 'Itália', region: 'Europa' },
  { name: 'Berlim', displayName: 'Berlim, Alemanha', lat: 52.5200, lng: 13.4050, country: 'Alemanha', region: 'Europa' },
  { name: 'Atenas', displayName: 'Atenas, Grécia', lat: 37.9838, lng: 23.7275, country: 'Grécia', region: 'Europa' },
  { name: 'Moscou', displayName: 'Moscou, Rússia', lat: 55.7558, lng: 37.6173, country: 'Rússia', region: 'Europa' },
  { name: 'Reykjavík', displayName: 'Reykjavík, Islândia', lat: 64.1466, lng: -21.9426, country: 'Islândia', region: 'Europa' },
  // África & Oriente Médio
  { name: 'Cairo', displayName: 'Cairo, Egito', lat: 30.0444, lng: 31.2357, country: 'Egito', region: 'África & Oriente' },
  { name: 'Casablanca', displayName: 'Casablanca, Marrocos', lat: 33.5731, lng: -7.5898, country: 'Marrocos', region: 'África & Oriente' },
  { name: 'Cidade do Cabo', displayName: 'Cidade do Cabo, África do Sul', lat: -33.9249, lng: 18.4241, country: 'África do Sul', region: 'África & Oriente' },
  { name: 'Nairóbi', displayName: 'Nairóbi, Quênia', lat: -1.2921, lng: 36.8219, country: 'Quênia', region: 'África & Oriente' },
  { name: 'Dubai', displayName: 'Downtown Dubai, EAU', lat: 25.1972, lng: 55.2744, country: 'Emirados Árabes', region: 'África & Oriente' },
  { name: 'Istambul', displayName: 'Istambul, Turquia', lat: 41.0082, lng: 28.9784, country: 'Turquia', region: 'África & Oriente' },
  // Ásia
  { name: 'Tóquio', displayName: 'Shinjuku, Tóquio, Japão', lat: 35.6895, lng: 139.6917, country: 'Japão', region: 'Ásia' },
  { name: 'Seul', displayName: 'Seul, Coreia do Sul', lat: 37.5665, lng: 126.9780, country: 'Coreia do Sul', region: 'Ásia' },
  { name: 'Pequim', displayName: 'Pequim, China', lat: 39.9042, lng: 116.4074, country: 'China', region: 'Ásia' },
  { name: 'Singapura', displayName: 'Singapura', lat: 1.3521, lng: 103.8198, country: 'Singapura', region: 'Ásia' },
  { name: 'Bangkok', displayName: 'Bangkok, Tailândia', lat: 13.7563, lng: 100.5018, country: 'Tailândia', region: 'Ásia' },
  { name: 'Nova Delhi', displayName: 'Nova Delhi, Índia', lat: 28.6139, lng: 77.2090, country: 'Índia', region: 'Ásia' },
  // Oceania & Pacífico
  { name: 'Sydney', displayName: 'Sydney, Austrália', lat: -33.8688, lng: 151.2093, country: 'Austrália', region: 'Oceania' },
  { name: 'Auckland', displayName: 'Auckland, Nova Zelândia', lat: -36.8485, lng: 174.7633, country: 'Nova Zelândia', region: 'Oceania' },
  { name: 'Honolulu', displayName: 'Honolulu, Havaí, EUA', lat: 21.3069, lng: -157.8583, country: 'Estados Unidos', region: 'Oceania' },
  { name: 'Kiritimati', displayName: 'Kiritimati (UTC+14), Kiribati', lat: 1.8721, lng: -157.4278, country: 'Kiribati', region: 'Oceania' },
];

export async function searchWorldCities(query: string): Promise<RealCitySearchResult[]> {
  const q = query.trim();
  if (!q) return WORLD_CITY_PRESETS;

  const qLower = q.toLowerCase();
  const localMatches: RealCitySearchResult[] = [];

  for (const preset of WORLD_CITY_PRESETS) {
    if (
      preset.name.toLowerCase().includes(qLower) ||
      preset.displayName.toLowerCase().includes(qLower)
    ) {
      localMatches.push(preset);
    }
  }

  for (const loc of NOAA_LOCATIONS) {
    if (
      loc.name.toLowerCase().includes(qLower) ||
      loc.country.toLowerCase().includes(qLower)
    ) {
      if (!localMatches.some((m) => Math.hypot(m.lat - loc.latitude, m.lng - loc.longitude) < 0.08)) {
        localMatches.push({
          name: loc.name,
          displayName: `${loc.name}, ${loc.country}`,
          lat: loc.latitude,
          lng: loc.longitude,
          country: loc.country,
        });
      }
    }
  }

  try {
    const res = await fetch(`/api/city-search?q=${encodeURIComponent(q)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = await res.json();
      const apiResults: RealCitySearchResult[] = Array.isArray(json?.results) ? json.results : [];
      if (apiResults.length > 0) {
        return apiResults;
      }
    }
  } catch {
    // Fallback to local matches cleanly
  }

  return localMatches;
}

function seededRand(seed: number): () => number {
  let s = Math.abs(Math.floor(seed * 9301 + 49297)) % 233280;
  if (s <= 0) s = 1337;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function normalizePolygonBuilding(
  rawId: string,
  pts: Array<[number, number]>,
  height: number,
  levels: number,
  styleIdx: number,
  name?: string
): RealCityBuilding | null {
  if (!Array.isArray(pts) || pts.length < 3) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let sumX = 0;
  let sumZ = 0;

  for (const [x, z] of pts) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
    sumX += x;
    sumZ += z;
  }

  const w = maxX - minX;
  const d = maxZ - minZ;
  if (w < 2.2 || d < 2.2) return null;

  return {
    id: rawId,
    name: name || `Prédio ${rawId.replace(/^b_/, '').slice(0, 6)}`,
    polygon: pts,
    height: Math.max(5.5, Math.min(180, height)),
    levels: Math.max(1, levels),
    styleIdx,
    minX,
    maxX,
    minZ,
    maxZ,
    cx: sumX / pts.length,
    cz: sumZ / pts.length,
  };
}

function isPointInsideBuilding(x: number, z: number, buildings: RealCityBuilding[], margin = 2.0): boolean {
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (
      x >= b.minX - margin &&
      x <= b.maxX + margin &&
      z >= b.minZ - margin &&
      z <= b.maxZ + margin
    ) {
      return true;
    }
  }
  return false;
}

function pickClearSpawnPoint(
  buildings: RealCityBuilding[],
  roads: RealCityRoad[]
): [number, number] {
  // 1. Prefer points right near (0,0) if open
  const candidates: Array<[number, number]> = [
    [0, 6],
    [0, -6],
    [6, 0],
    [-6, 0],
    [12, 12],
    [-12, 12],
    [0, 0],
  ];

  // Add road midpoints near origin as ideal street spawn candidates
  for (const r of roads) {
    for (let i = 0; i < r.points.length; i++) {
      const [rx, rz] = r.points[i];
      if (Math.hypot(rx, rz) < 42) {
        candidates.push([rx, rz]);
      }
    }
  }

  for (const [cx, cz] of candidates) {
    if (!isPointInsideBuilding(cx, cz, buildings, 2.2)) {
      return [cx, cz];
    }
  }

  // Spiral search for any open point
  for (let r = 8; r <= 95; r += 6) {
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      const sx = Math.cos(ang) * r;
      const sz = Math.sin(ang) * r;
      if (!isPointInsideBuilding(sx, sz, buildings, 2.2)) {
        return [Number(sx.toFixed(1)), Number(sz.toFixed(1))];
      }
    }
  }

  return [0, 58];
}

export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export function computeBearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = Math.PI / 180;
  const phi1 = lat1 * toRad;
  const phi2 = lat2 * toRad;
  const dLon = (lng2 - lng1) * toRad;
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function interpolateEarthCoord(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  t: number
): { lat: number; lng: number } {
  const k = Math.max(0, Math.min(1, t));
  const lat = lat1 + (lat2 - lat1) * k;
  let dLng = lng2 - lng1;
  if (dLng > 180) dLng -= 360;
  if (dLng < -180) dLng += 360;
  let lng = lng1 + dLng * k;
  if (lng > 180) lng -= 360;
  if (lng < -180) lng += 360;
  return { lat, lng };
}

export function generateAdaptedCityData(
  lat: number,
  lng: number,
  cityName?: string,
  country?: string
): RealCityData {
  const seedVal = Math.abs(lat * 137.3 + lng * 293.7) + 17.1;
  const rand = seededRand(seedVal);

  const absLat = Math.abs(lat);
  const isHighRiseMetro = Math.floor(seedVal) % 3 === 0 || absLat < 42;
  const maxFloors = isHighRiseMetro ? 34 : 16;

  const buildings: RealCityBuilding[] = [];
  const roads: RealCityRoad[] = [];
  const parks: RealCityPolygonFeature[] = [];
  const waters: RealCityPolygonFeature[] = [];

  // Expanded metropolitan highway & avenue grid spanning +/- 1,700 m (3.4 km across)
  const majorCoords = [-1200, -840, -540, -300, -140, -60, 0, 60, 140, 300, 540, 840, 1200];
  majorCoords.forEach((coord, idx) => {
    const isExpressway = Math.abs(coord) >= 540 || coord === 0;
    const roadWidth = coord === 0 ? 11.0 : isExpressway ? 9.5 : 7.0;
    const kind = coord === 0 || Math.abs(coord) === 540 ? 'primary' : 'secondary';
    roads.push({
      id: `road_ns_${idx}`,
      points: [
        [coord, -1650],
        [coord, 1650],
      ],
      width: roadWidth,
      kind,
    });
    roads.push({
      id: `road_ew_${idx}`,
      points: [
        [-1650, coord],
        [1650, coord],
      ],
      width: roadWidth,
      kind,
    });
  });

  // Wide diagonal metropolitan boulevards & outer ring expressways
  roads.push({
    id: 'road_diag_main',
    points: [
      [-1450, -920],
      [-540, -340],
      [0, 0],
      [540, 340],
      [1450, 920],
    ],
    width: 8.5,
    kind: 'primary',
  });
  roads.push({
    id: 'road_ring_outer',
    points: [
      [-1180, -1180],
      [1180, -1180],
      [1180, 1180],
      [-1180, 1180],
      [-1180, -1180],
    ],
    width: 10.5,
    kind: 'trunk',
  });

  // Grand river / coastline channel seeded by coordinate
  if (rand() > 0.25) {
    const canalX = rand() > 0.5 ? 660 : -660;
    waters.push({
      id: 'water_metro_river',
      polygon: [
        [canalX - 55, -1700],
        [canalX + 55, -1700],
        [canalX + 85, 1700],
        [canalX - 30, 1700],
      ],
    });
  }

  // Central Park + 4 Regional Urban Parks
  const parkBoxes: Array<[number, number, number, number]> = [
    [16, -48, 52, -14],
    [-420, 220, -240, 390],
    [220, -420, 410, -250],
    [-420, -420, -250, -260],
  ];
  parkBoxes.forEach(([x1, z1, x2, z2], pIdx) => {
    parks.push({
      id: `park_metro_${pIdx}`,
      polygon: [
        [x1, z1],
        [x2, z1],
        [x2, z2],
        [x1, z2],
      ],
    });
  });

  const blockNames = [
    'Torre Horizonte',
    'Edifício Central',
    'Mirante Solar',
    'Residencial Plaza',
    'Centro Executivo',
    'Edifício Atlântico',
    'Torre do Parque',
    'Palácio Metropolitano',
    'Edifício Meridiano',
    'Complexo Aurora',
    'Distrito Corporativo',
    'Panorama Sky',
  ];

  let bCount = 0;
  // Dense downtown core (-180..180) + sprawling metropolitan districts (-1080..1080)
  for (let bx = -1050; bx <= 1050; bx += 60) {
    for (let bz = -1050; bz <= 1050; bz += 60) {
      const distHub = Math.hypot(bx, bz);
      if (distHub > 1120) continue;

      const isDowntown = distHub < 195;
      // Thin out outer districts selectively so performance stays silky (~550 buildings total)
      if (!isDowntown && rand() < (distHub < 520 ? 0.56 : 0.72)) continue;

      // Avoid covering major parks or river
      if (Math.abs(bx - 34) < 28 && Math.abs(bz + 31) < 28) continue;
      if (waters.some((w) => bx > w.polygon[0][0] - 24 && bx < w.polygon[1][0] + 24)) continue;

      const offsets = isDowntown
        ? [
            [-14, -14],
            [14, -14],
            [-14, 14],
            [14, 14],
          ]
        : [[(rand() - 0.5) * 14, (rand() - 0.5) * 14]];

      for (const [ox, oz] of offsets) {
        const cx = bx + ox;
        const cz = bz + oz;
        if (Math.hypot(cx, cz) < 12) continue;

        const scaleMult = isDowntown ? 1.0 : 1.55 + rand() * 0.9;
        const w = (8.0 + rand() * 5.8) * scaleMult;
        const d = (8.0 + rand() * 5.8) * scaleMult;
        const distCenter = Math.hypot(cx, cz);
        const centerBoost = Math.max(0.28, 1.25 - distCenter / 920);
        const levels = Math.max(2, Math.round((3 + rand() * maxFloors) * centerBoost));
        const height = Number((levels * 3.4 + rand() * 4.5).toFixed(1));

        const hw = w / 2;
        const hd = d / 2;
        const poly: Array<[number, number]> = [
          [cx - hw, cz - hd],
          [cx + hw, cz - hd],
          [cx + hw, cz + hd],
          [cx - hw, cz + hd],
        ];

        const label = `${blockNames[bCount % blockNames.length]} ${bCount + 1}`;
        const normalized = normalizePolygonBuilding(
          `b_ad_${bCount}`,
          poly,
          height,
          levels,
          Math.floor(rand() * 4),
          label
        );
        if (normalized) {
          buildings.push(normalized);
          bCount++;
        }
      }
    }
  }

  const labelCity = cityName || `Lat ${lat.toFixed(2)}°, Lon ${lng.toFixed(2)}°`;
  return {
    cityName: labelCity,
    country: country || 'Mundo',
    latitude: lat,
    longitude: lng,
    source: 'adapted',
    buildings,
    roads,
    parks,
    waters,
    spawnPoint: [0, 8.5],
  };
}

function extendOsmCityWithMetropolis(city: RealCityData): RealCityData {
  // Keep genuine OSM downtown untouched and seamlessly extend outer metropolitan grid (~2.8 km across)
  const rand = seededRand(Math.abs(city.latitude * 97.1 + city.longitude * 193.3) + 5.7);
  let maxOsmR = 120;
  city.buildings.forEach((b) => {
    const d = Math.hypot(b.cx, b.cz);
    if (d > maxOsmR) maxOsmR = d;
  });
  const innerClearR = Math.min(820, Math.max(260, maxOsmR + 45));

  const extraRoads: RealCityRoad[] = [
    {
      id: 'ext_ring_metro',
      points: [
        [-1150, -1150],
        [1150, -1150],
        [1150, 1150],
        [-1150, 1150],
        [-1150, -1150],
      ],
      width: 10.0,
      kind: 'trunk',
    },
    {
      id: 'ext_hwy_ew_n',
      points: [
        [-1650, -760],
        [1650, -760],
      ],
      width: 9.0,
      kind: 'primary',
    },
    {
      id: 'ext_hwy_ew_s',
      points: [
        [-1650, 760],
        [1650, 760],
      ],
      width: 9.0,
      kind: 'primary',
    },
    {
      id: 'ext_hwy_ns_w',
      points: [
        [-760, -1650],
        [-760, 1650],
      ],
      width: 9.0,
      kind: 'primary',
    },
    {
      id: 'ext_hwy_ns_e',
      points: [
        [760, -1650],
        [760, 1650],
      ],
      width: 9.0,
      kind: 'primary',
    },
  ];

  const extraBuildings: RealCityBuilding[] = [];
  let idx = 0;
  for (let gx = -1260; gx <= 1260; gx += 105) {
    for (let gz = -1260; gz <= 1260; gz += 105) {
      const dist = Math.hypot(gx, gz);
      if (dist < innerClearR || dist > 1380) continue;
      if (rand() < 0.36) continue;

      const w = 16 + rand() * 14;
      const d = 16 + rand() * 14;
      const levels = Math.max(3, Math.round(4 + rand() * 18 * Math.max(0.35, 1.2 - dist / 1450)));
      const height = Number((levels * 3.4 + rand() * 3).toFixed(1));
      const norm = normalizePolygonBuilding(
        `b_ext_${idx++}`,
        [
          [gx - w / 2, gz - d / 2],
          [gx + w / 2, gz - d / 2],
          [gx + w / 2, gz + d / 2],
          [gx - w / 2, gz + d / 2],
        ],
        height,
        levels,
        Math.floor(rand() * 4),
        `Distrito Metropolitano ${idx}`
      );
      if (norm) extraBuildings.push(norm);
    }
  }

  return {
    ...city,
    buildings: [...city.buildings, ...extraBuildings],
    roads: [...city.roads, ...extraRoads],
  };
}

export async function fetchRealCityData(
  lat: number,
  lng: number,
  cityName?: string,
  country?: string
): Promise<RealCityData> {
  try {
    const res = await fetch(`/api/real-city?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`, {
      signal: AbortSignal.timeout(8500),
    });
    if (res.ok) {
      const json = await res.json();
      const rawBuildings = Array.isArray(json?.buildings) ? json.buildings : [];
      const rawRoads = Array.isArray(json?.roads) ? json.roads : [];
      const rawParks = Array.isArray(json?.parks) ? json.parks : [];
      const rawWaters = Array.isArray(json?.waters) ? json.waters : [];

      const buildings: RealCityBuilding[] = [];
      rawBuildings.forEach((b: any, idx: number) => {
        const norm = normalizePolygonBuilding(
          String(b.id || `b_${idx}`),
          b.polygon,
          Number(b.height) || 14,
          Number(b.levels) || 4,
          Number(b.styleIdx) || idx % 4,
          b.name || `Edifício ${idx + 1}`
        );
        if (norm) buildings.push(norm);
      });

      const roads: RealCityRoad[] = rawRoads.filter(
        (r: any) => Array.isArray(r.points) && r.points.length >= 2
      );
      const parks: RealCityPolygonFeature[] = rawParks.filter(
        (p: any) => Array.isArray(p.polygon) && p.polygon.length >= 3
      );
      const waters: RealCityPolygonFeature[] = rawWaters.filter(
        (w: any) => Array.isArray(w.polygon) && w.polygon.length >= 3
      );

      if (buildings.length >= 3 || roads.length >= 2) {
        const spawnPoint = pickClearSpawnPoint(buildings, roads);
        return extendOsmCityWithMetropolis({
          cityName: cityName || `Lat ${lat.toFixed(2)}°, Lon ${lng.toFixed(2)}°`,
          country: country || 'Mundo',
          latitude: lat,
          longitude: lng,
          source: 'osm',
          buildings,
          roads,
          parks,
          waters,
          spawnPoint,
        });
      }
    }
  } catch {
    // Fallback cleanly below
  }

  return generateAdaptedCityData(lat, lng, cityName, country);
}
