import * as THREE from 'three';
import { getUnwrappedEarthLand, getWorldCountryBorders } from '../data/worldAtlasData';

export interface RealEarthGlobeHandle {
  earthMesh: THREE.Mesh;
  cloudMesh: THREE.Mesh;
  atmosphereMesh: THREE.Mesh;
  updateSunAndClouds: (sunDirX: number, sunDirY: number, sunDirZ: number, deltaSec: number) => void;
}

interface CachedEarthMaps {
  dayCanvas: HTMLCanvasElement;
  roughCanvas: HTMLCanvasElement;
  bumpCanvas: HTMLCanvasElement;
  nightCanvas: HTMLCanvasElement;
  cloudCanvas: HTMLCanvasElement;
}

let cachedEarthMaps: CachedEarthMaps | null = null;

// Fast deterministic 3D value noise on unit sphere -> zero seams across ±180° & poles
function hash3(ix: number, iy: number, iz: number): number {
  let n = (ix * 374761393 + iy * 668265263 + iz * 2147483647) | 0;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function smooth3(t: number): number {
  return t * t * (3 - 2 * t);
}

function noise3(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = smooth3(x - ix);
  const fy = smooth3(y - iy);
  const fz = smooth3(z - iz);

  const n000 = hash3(ix, iy, iz);
  const n100 = hash3(ix + 1, iy, iz);
  const n010 = hash3(ix, iy + 1, iz);
  const n110 = hash3(ix + 1, iy + 1, iz);
  const n001 = hash3(ix, iy, iz + 1);
  const n101 = hash3(ix + 1, iy, iz + 1);
  const n011 = hash3(ix, iy + 1, iz + 1);
  const n111 = hash3(ix + 1, iy + 1, iz + 1);

  const nx00 = n000 + (n100 - n000) * fx;
  const nx10 = n010 + (n110 - n010) * fx;
  const nx01 = n001 + (n101 - n001) * fx;
  const nx11 = n011 + (n111 - n011) * fx;

  const nxy0 = nx00 + (nx10 - nx00) * fy;
  const nxy1 = nx01 + (nx11 - nx01) * fy;

  return nxy0 + (nxy1 - nxy0) * fz;
}

function fbm3(x: number, y: number, z: number, octaves = 4): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    val += amp * noise3(x * freq, y * freq, z * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.04;
  }
  return val / norm;
}

function ridged3(x: number, y: number, z: number, octaves = 3): number {
  let val = 0;
  let amp = 0.55;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise3(x * freq, y * freq, z * freq) * 2 - 1);
    val += amp * n * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2.15;
  }
  return val / norm;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function gauss2(lon: number, lat: number, cLon: number, cLat: number, sLon: number, sLat: number): number {
  const dx = (lon - cLon) / sLon;
  const dy = (lat - cLat) / sLat;
  return Math.exp(-(dx * dx + dy * dy));
}

function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  const k = Math.max(0, Math.min(1, t));
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
}

function traceRing(
  ctx: CanvasRenderingContext2D,
  ring: Array<[number, number]>,
  w: number,
  h: number
) {
  if (ring.length < 2) return;
  ctx.moveTo(((ring[0][0] + 180) / 360) * w, ((90 - ring[0][1]) / 180) * h);
  for (let i = 1; i < ring.length; i++) {
    ctx.lineTo(((ring[i][0] + 180) / 360) * w, ((90 - ring[i][1]) / 180) * h);
  }
  ctx.closePath();
}

function traceAllLand(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const { regularPolygons, antarcticaRing } = getUnwrappedEarthLand();
  ctx.beginPath();
  for (const poly of regularPolygons) {
    traceRing(ctx, poly.outer, w, h);
    for (const hole of poly.holes) {
      traceRing(ctx, hole, w, h);
    }
  }
  if (antarcticaRing) {
    traceRing(ctx, antarcticaRing, w, h);
  }
}

/**
 * Computes two-pass Chamfer distance transform from boolean land/ocean grid.
 * Returns normalized distance (in pixels, capped at maxD = 42).
 */
function computeCoastDistances(
  isLand: Uint8Array,
  w: number,
  h: number
): { oceanDist: Float32Array; landDist: Float32Array } {
  const total = w * h;
  const INF = 1e4;
  const oceanDist = new Float32Array(total);
  const landDist = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    if (isLand[i]) {
      oceanDist[i] = 0;
      landDist[i] = INF;
    } else {
      oceanDist[i] = INF;
      landDist[i] = 0;
    }
  }

  const pass = (dist: Float32Array) => {
    // Forward pass (top-left -> bottom-right)
    for (let y = 0; y < h; y++) {
      const row = y * w;
      const upRow = (y - 1) * w;
      for (let x = 0; x < w; x++) {
        let d = dist[row + x];
        if (d === 0) continue;
        const leftX = (x - 1 + w) % w;
        if (dist[row + leftX] + 1 < d) d = dist[row + leftX] + 1;
        if (y > 0) {
          if (dist[upRow + x] + 1 < d) d = dist[upRow + x] + 1;
          if (dist[upRow + leftX] + 1.414 < d) d = dist[upRow + leftX] + 1.414;
          const rightX = (x + 1) % w;
          if (dist[upRow + rightX] + 1.414 < d) d = dist[upRow + rightX] + 1.414;
        }
        dist[row + x] = d;
      }
    }
    // Backward pass (bottom-right -> top-left)
    for (let y = h - 1; y >= 0; y--) {
      const row = y * w;
      const downRow = (y + 1) * w;
      for (let x = w - 1; x >= 0; x--) {
        let d = dist[row + x];
        if (d === 0) continue;
        const rightX = (x + 1) % w;
        if (dist[row + rightX] + 1 < d) d = dist[row + rightX] + 1;
        if (y < h - 1) {
          if (dist[downRow + x] + 1 < d) d = dist[downRow + x] + 1;
          if (dist[downRow + rightX] + 1.414 < d) d = dist[downRow + rightX] + 1.414;
          const leftX = (x - 1 + w) % w;
          if (dist[downRow + leftX] + 1.414 < d) d = dist[downRow + leftX] + 1.414;
        }
        dist[row + x] = d;
      }
    }
  };

  pass(oceanDist);
  pass(landDist);
  return { oceanDist, landDist };
}

function getOrGenerateRealEarthMaps(): CachedEarthMaps {
  if (cachedEarthMaps) return cachedEarthMaps;

  // 1. Rasterize land/ocean mask at 1024x512 for fast coastal distance + biome terrain synthesis
  const BW = 1024;
  const BH = 512;
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = BW;
  maskCanvas.height = BH;
  const mctx = maskCanvas.getContext('2d')!;
  mctx.fillStyle = '#000000';
  mctx.fillRect(0, 0, BW, BH);
  mctx.fillStyle = '#ffffff';
  traceAllLand(mctx, BW, BH);
  mctx.fill('evenodd');

  const maskData = mctx.getImageData(0, 0, BW, BH).data;
  const isLand = new Uint8Array(BW * BH);
  for (let i = 0; i < BW * BH; i++) {
    isLand[i] = maskData[i * 4] > 110 ? 1 : 0;
  }

  const { oceanDist, landDist } = computeCoastDistances(isLand, BW, BH);

  // Elevation field stored separately for crisp finite-difference hillshading
  const elevField = new Float32Array(BW * BH);
  const coarseCanvas = document.createElement('canvas');
  coarseCanvas.width = BW;
  coarseCanvas.height = BH;
  const cctx = coarseCanvas.getContext('2d')!;
  const coarseImg = cctx.createImageData(BW, BH);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = BW;
  roughCanvas.height = BH;
  const rctx = roughCanvas.getContext('2d')!;
  const roughImg = rctx.createImageData(BW, BH);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = BW;
  bumpCanvas.height = BH;
  const bctx = bumpCanvas.getContext('2d')!;
  const bumpImg = bctx.createImageData(BW, BH);

  // First pass: elevation field on continents
  for (let y = 0; y < BH; y++) {
    const lat = 90 - ((y + 0.5) / BH) * 180;
    const latRad = (lat * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    const sinLat = Math.sin(latRad);

    for (let x = 0; x < BW; x++) {
      const idx = y * BW + x;
      if (!isLand[idx]) {
        elevField[idx] = 0;
        continue;
      }

      const lon = ((x + 0.5) / BW) * 360 - 180;
      const lonRad = (lon * Math.PI) / 180;
      const sx = cosLat * Math.cos(lonRad);
      const sy = sinLat;
      const sz = cosLat * Math.sin(lonRad);

      const ld = landDist[idx];
      const baseMacro = fbm3(sx * 3.6 + 1.1, sy * 3.6 - 0.5, sz * 3.6 + 2.2, 4);
      const ridge = ridged3(sx * 9.5 - 2.3, sy * 9.5 + 1.4, sz * 9.5 - 0.7, 3);
      const coastRamp = smoothstep(0, 7.5, ld);

      // Major Real Earth Mountain Orogenies
      // Andes spine following Western South America coast
      const andesLon =
        lat > -5
          ? -77 + (lat + 5) * 0.35
          : lat > -22
            ? -70 - (lat + 22) * 0.42
            : -69.5 + (-22 - lat) * 0.06;
      const andes =
        lat >= -55 && lat <= 12
          ? Math.exp(-Math.pow((lon - andesLon) / 3.4, 2)) * 0.88
          : 0;

      // Rockies & Western North America Cordillera
      const rockiesLon = -114 - (lat - 40) * 0.52;
      const rockies =
        lat >= 20 && lat <= 64
          ? Math.exp(-Math.pow((lon - rockiesLon) / 5.2, 2)) * 0.62
          : 0;

      // Himalayas, Karakoram, Tibetan Plateau, Pamir
      const tibet = gauss2(lon, lat, 88, 33, 15, 6.2) * 0.96;
      const himalayaEdge = gauss2(lon, lat, 83, 28.5, 13, 2.5) * 0.52;

      // Alps / Pyrenees / Caucasus / Zagros / Iranian plateau
      const alps = gauss2(lon, lat, 10, 46.3, 6.5, 2.1) * 0.55;
      const caucasusZagros =
        gauss2(lon, lat, 45, 41.5, 6.5, 2.2) * 0.52 +
        gauss2(lon, lat, 51, 33.5, 7.5, 3.8) * 0.48;

      // East African Highlands / Ethiopian Plateau + Atlas
      const eastAfrica = gauss2(lon, lat, 37.5, 7.5, 5.2, 7.5) * 0.46;
      const atlas = gauss2(lon, lat, -3, 33, 6.2, 2.2) * 0.42;

      // Scandinavia, Urals, Brazilian Highlands, Greenland interior dome
      const scandi = gauss2(lon, lat, 14, 63, 4.5, 5.5) * 0.36;
      const urals = gauss2(lon, lat, 59, 60, 2.5, 8.5) * 0.34;
      const greenlandDome = lat > 62 && lon > -68 && lon < -18 ? coastRamp * 0.55 : 0;

      const orogeny = Math.min(
        1.15,
        andes + rockies + tibet + himalayaEdge + alps + caucasusZagros + eastAfrica + atlas + scandi + urals + greenlandDome
      );

      elevField[idx] = Math.min(
        1.0,
        0.08 * coastRamp + baseMacro * 0.24 * coastRamp + orogeny * (0.48 + 0.52 * ridge)
      );
    }
  }

  // Color palette anchors (NASA Blue Marble calibrated sRGB values)
  const C_ABYSSAL: [number, number, number] = [5, 21, 48];
  const C_DEEP_TROPIC: [number, number, number] = [7, 36, 78];
  const C_SHELF: [number, number, number] = [13, 76, 114];
  const C_REEF: [number, number, number] = [24, 138, 162];

  const C_RAINFOREST: [number, number, number] = [20, 66, 28];
  const C_TEMPERATE: [number, number, number] = [44, 88, 42];
  const C_SAVANNA: [number, number, number] = [88, 108, 52];
  const C_BOREAL: [number, number, number] = [34, 61, 38];
  const C_TUNDRA: [number, number, number] = [94, 98, 76];
  const C_DESERT_SAND: [number, number, number] = [198, 163, 110];
  const C_DESERT_RED: [number, number, number] = [175, 104, 66];
  const C_DESERT_STEPPE: [number, number, number] = [148, 128, 86];
  const C_ROCK: [number, number, number] = [118, 112, 106];
  const C_ICE: [number, number, number] = [235, 242, 249];

  // Second pass: realistic biome + ocean bathymetry + hillshade lighting
  for (let y = 0; y < BH; y++) {
    const lat = 90 - ((y + 0.5) / BH) * 180;
    const absLat = Math.abs(lat);
    const latRad = (lat * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    const sinLat = Math.sin(latRad);

    for (let x = 0; x < BW; x++) {
      const idx = y * BW + x;
      const p4 = idx * 4;
      const lon = ((x + 0.5) / BW) * 360 - 180;
      const lonRad = (lon * Math.PI) / 180;
      const sx = cosLat * Math.cos(lonRad);
      const sy = sinLat;
      const sz = cosLat * Math.sin(lonRad);

      const nMacro = fbm3(sx * 4.5 + 3.1, sy * 4.5 + 0.7, sz * 4.5 - 1.9, 4);
      const nMicro = fbm3(sx * 16.0 - 1.2, sy * 16.0 + 2.3, sz * 16.0 + 0.9, 3);

      if (!isLand[idx]) {
        const od = oceanDist[idx];
        // Bathymetric ocean ridges & abyssal variations
        const tropWarm = Math.exp(-Math.pow(absLat / 28, 2));
        let oceanRgb = lerpRgb(C_ABYSSAL, C_DEEP_TROPIC, tropWarm * (0.45 + 0.55 * nMacro));

        // Mid-ocean shelf / ridges (subtle lighter deep teal underwater)
        const ridgeBathy = smoothstep(0.52, 0.78, nMacro);
        oceanRgb = lerpRgb(oceanRgb, [12, 54, 94], ridgeBathy * 0.42);

        // Continental shelf turquoise near real coastlines
        if (od <= 11) {
          const shelfT = Math.exp(-od / 3.4);
          oceanRgb = lerpRgb(oceanRgb, C_SHELF, shelfT * 0.85);
          if (od <= 2.6) {
            const reefT = Math.exp(-od / 1.15);
            oceanRgb = lerpRgb(oceanRgb, C_REEF, reefT * 0.72);
          }
        }

        // Polar sea ice pack (High Arctic ocean >79°N & Ross/Weddell margins <-70°S)
        const arcticIce = smoothstep(77.5 + (nMacro - 0.5) * 6.5, 83.5, lat);
        const antarcticIce = smoothstep(-68.5 + (nMacro - 0.5) * 5.0, -75.0, lat);
        const seaIce = Math.max(arcticIce, antarcticIce);
        if (seaIce > 0.01) {
          oceanRgb = lerpRgb(oceanRgb, [212, 228, 240], seaIce * 0.82);
        }

        coarseImg.data[p4] = Math.round(oceanRgb[0]);
        coarseImg.data[p4 + 1] = Math.round(oceanRgb[1]);
        coarseImg.data[p4 + 2] = Math.round(oceanRgb[2]);
        coarseImg.data[p4 + 3] = 255;

        const rVal = Math.round(62 + seaIce * 70);
        roughImg.data[p4] = rVal;
        roughImg.data[p4 + 1] = rVal;
        roughImg.data[p4 + 2] = rVal;
        roughImg.data[p4 + 3] = 255;

        bumpImg.data[p4] = 8;
        bumpImg.data[p4 + 1] = 8;
        bumpImg.data[p4 + 2] = 8;
        bumpImg.data[p4 + 3] = 255;
        continue;
      }

      // LAND BIOME SYNTHESIS
      const elev = elevField[idx];

      // Regional Desert Belts (true Earth meteorology & geography)
      const sahara = gauss2(lon, lat, 12, 23, 28, 8.5);
      const arabia = gauss2(lon, lat, 46, 23, 12, 8.5);
      const centralAsia = gauss2(lon, lat, 72, 41, 24, 6.8) + gauss2(lon, lat, 100, 41, 14, 5.2);
      const australia = gauss2(lon, lat, 129, -24.5, 13.5, 6.2);
      const namibKalahari = gauss2(lon, lat, 18.5, -24, 5.5, 6.2);
      const atacamaPatagonia = gauss2(lon, lat, -69.5, -23, 2.8, 7.2) + gauss2(lon, lat, -68, -44, 4.2, 7.5);
      const sonoraMojave = gauss2(lon, lat, -112, 31.5, 7.2, 6.5);
      const hornAfrica = gauss2(lon, lat, 46, 8, 5.5, 5.2);

      const desertScore = Math.min(
        1,
        (sahara +
          arabia +
          centralAsia * 0.85 +
          australia * 0.92 +
          namibKalahari * 0.85 +
          atacamaPatagonia * 0.82 +
          sonoraMojave * 0.85 +
          hornAfrica * 0.72) *
          (0.75 + 0.5 * nMacro)
      );

      // Lush Tropical Rainforests
      const amazon = gauss2(lon, lat, -61, -4, 15.5, 9.5);
      const congo = gauss2(lon, lat, 21, -0.5, 10.5, 7.2);
      const seAsia = gauss2(lon, lat, 114, 1.5, 22, 11.5);
      const mesoAmerica = gauss2(lon, lat, -85, 13, 8, 5.5);
      const rainforestScore = Math.min(1, amazon + congo + seAsia + mesoAmerica);

      // Start from latitude biome gradient
      let landRgb: [number, number, number];
      if (absLat < 16) {
        landRgb = lerpRgb(C_SAVANNA, C_RAINFOREST, smoothstep(0.12, 0.55, rainforestScore + nMicro * 0.25));
      } else if (absLat < 38) {
        landRgb = lerpRgb(C_TEMPERATE, C_SAVANNA, 0.35 + nMacro * 0.45);
      } else if (absLat < 56) {
        landRgb = lerpRgb(C_TEMPERATE, C_BOREAL, smoothstep(38, 56, absLat));
      } else if (absLat < 72) {
        landRgb = lerpRgb(C_BOREAL, C_TUNDRA, smoothstep(56, 70, absLat) * (0.7 + 0.3 * nMicro));
      } else {
        landRgb = lerpRgb(C_TUNDRA, C_ICE, smoothstep(69, 77, absLat));
      }

      // Blend Major Deserts / Steppe
      if (desertScore > 0.08) {
        const isAusRed = australia > 0.35;
        const sandColor = isAusRed ? lerpRgb(C_DESERT_SAND, C_DESERT_RED, 0.72) : C_DESERT_SAND;
        const aridColor = lerpRgb(C_DESERT_STEPPE, sandColor, smoothstep(0.25, 0.72, desertScore));
        landRgb = lerpRgb(landRgb, aridColor, smoothstep(0.08, 0.55, desertScore));
      }

      // Mountain Rock & Alpine Snowline
      const snowLineElev = Math.max(0.28, 0.72 - absLat * 0.0082);
      if (elev > 0.30) {
        landRgb = lerpRgb(landRgb, C_ROCK, smoothstep(0.30, 0.65, elev) * 0.78);
      }
      if (elev > snowLineElev) {
        landRgb = lerpRgb(landRgb, C_ICE, smoothstep(snowLineElev, snowLineElev + 0.14, elev));
      }

      // Permanent Ice Caps: Greenland & Antarctica
      const greenlandMask =
        lat > 60 && lat < 84 && lon > -68 && lon < -18 ? smoothstep(0.0, 2.4, landDist[idx]) : 0;
      const antarcticaMask = lat < -63 ? smoothstep(-63, -67, lat) : 0;
      const iceSheet = Math.max(greenlandMask * 0.92, antarcticaMask);
      if (iceSheet > 0.02) {
        landRgb = lerpRgb(landRgb, C_ICE, iceSheet);
      }

      // Micro-vegetation modulation
      const microTone = 0.88 + nMicro * 0.24;
      landRgb = [
        Math.min(255, landRgb[0] * microTone),
        Math.min(255, landRgb[1] * microTone),
        Math.min(255, landRgb[2] * microTone),
      ];

      // Northwest Shaded Relief Hillshading
      const xL = (x - 1 + BW) % BW;
      const xR = (x + 1) % BW;
      const yU = Math.max(0, y - 1);
      const yD = Math.min(BH - 1, y + 1);
      const dx = (elevField[y * BW + xR] - elevField[y * BW + xL]) * 6.5;
      const dy = (elevField[yD * BW + x] - elevField[yU * BW + x]) * 6.5;
      const shade = Math.max(0.68, Math.min(1.24, 1.0 - dx * 0.55 - dy * 0.55));

      coarseImg.data[p4] = Math.round(Math.min(255, landRgb[0] * shade));
      coarseImg.data[p4 + 1] = Math.round(Math.min(255, landRgb[1] * shade));
      coarseImg.data[p4 + 2] = Math.round(Math.min(255, landRgb[2] * shade));
      coarseImg.data[p4 + 3] = 255;

      const rLand = Math.round(224 - iceSheet * 95);
      roughImg.data[p4] = rLand;
      roughImg.data[p4 + 1] = rLand;
      roughImg.data[p4 + 2] = rLand;
      roughImg.data[p4 + 3] = 255;

      const bHeight = Math.round(24 + elev * 230);
      bumpImg.data[p4] = bHeight;
      bumpImg.data[p4 + 1] = bHeight;
      bumpImg.data[p4 + 2] = bHeight;
      bumpImg.data[p4 + 3] = 255;
    }
  }

  cctx.putImageData(coarseImg, 0, 0);
  rctx.putImageData(roughImg, 0, 0);
  bctx.putImageData(bumpImg, 0, 0);

  // 2. Upscale into crisp 4096x2048 Day Canvas with exact 1:50m Vector Coastlines & Borders
  const TEX_W = 4096;
  const TEX_H = 2048;
  const dayCanvas = document.createElement('canvas');
  dayCanvas.width = TEX_W;
  dayCanvas.height = TEX_H;
  const dctx = dayCanvas.getContext('2d')!;
  dctx.imageSmoothingEnabled = true;
  dctx.imageSmoothingQuality = 'high';
  dctx.drawImage(coarseCanvas, 0, 0, TEX_W, TEX_H);

  // Subtle vector coastal definition (outer coastal glow + razor-sharp shore rim)
  dctx.save();
  traceAllLand(dctx, TEX_W, TEX_H);
  dctx.strokeStyle = 'rgba(28, 152, 178, 0.28)';
  dctx.lineWidth = 4.2;
  dctx.stroke();
  dctx.strokeStyle = 'rgba(18, 42, 34, 0.32)';
  dctx.lineWidth = 1.25;
  dctx.stroke();
  dctx.restore();

  // Subtle real country borders from Natural Earth 50m (antimeridian safe)
  const countries = getWorldCountryBorders();
  dctx.save();
  dctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  dctx.lineWidth = 1.15;
  dctx.beginPath();
  for (const c of countries) {
    for (const poly of c.polygons) {
      for (const ring of poly) {
        if (ring.length < 2) continue;
        let prevLon = ring[0][0];
        dctx.moveTo(((ring[0][0] + 180) / 360) * TEX_W, ((90 - ring[0][1]) / 180) * TEX_H);
        for (let i = 1; i < ring.length; i++) {
          const lon = ring[i][0];
          const lat = ring[i][1];
          const x = ((lon + 180) / 360) * TEX_W;
          const y = ((90 - lat) / 180) * TEX_H;
          if (Math.abs(lon - prevLon) > 180) {
            dctx.moveTo(x, y);
          } else {
            dctx.lineTo(x, y);
          }
          prevLon = lon;
        }
      }
    }
  }
  dctx.stroke();
  dctx.restore();

  // Ultra-faint astronomical coordinate reference grid (15° meridians + Equator/Tropics)
  dctx.save();
  dctx.strokeStyle = 'rgba(125, 211, 252, 0.08)';
  dctx.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 30) {
    const gx = ((lon + 180) / 360) * TEX_W;
    dctx.beginPath();
    dctx.moveTo(gx, 0);
    dctx.lineTo(gx, TEX_H);
    dctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const gy = ((90 - lat) / 180) * TEX_H;
    dctx.beginPath();
    dctx.moveTo(0, gy);
    dctx.lineTo(TEX_W, gy);
    dctx.stroke();
  }
  dctx.strokeStyle = 'rgba(250, 204, 21, 0.14)';
  dctx.beginPath();
  dctx.moveTo(0, TEX_H / 2);
  dctx.lineTo(TEX_W, TEX_H / 2);
  dctx.stroke();
  dctx.restore();

  // 3. Night-Side Earth City Lights Map (2048x1024)
  const NW = 2048;
  const NH = 1024;
  const nightCanvas = document.createElement('canvas');
  nightCanvas.width = NW;
  nightCanvas.height = NH;
  const nctx = nightCanvas.getContext('2d')!;
  nctx.fillStyle = '#000000';
  nctx.fillRect(0, 0, NW, NH);

  // Clip lights strictly inside real landmass coastlines
  nctx.save();
  traceAllLand(nctx, NW, NH);
  nctx.clip('evenodd');

  // Major world metropolitan night-light hubs [lon, lat, radiusPx, intensity]
  const CITY_HUBS: Array<[number, number, number, number]> = [
    // South America
    [-46.63, -23.55, 26, 1.0], [-43.17, -22.91, 20, 0.95], [-43.94, -19.92, 14, 0.82],
    [-47.88, -15.79, 13, 0.78], [-38.50, -12.97, 14, 0.80], [-34.88, -8.05, 14, 0.78],
    [-38.52, -3.73, 13, 0.76], [-49.27, -25.43, 14, 0.80], [-51.22, -30.03, 14, 0.80],
    [-48.50, -1.45, 10, 0.65], [-60.02, -3.12, 10, 0.65],
    [-58.38, -34.60, 24, 0.96], [-56.16, -34.90, 11, 0.70], [-70.67, -33.45, 16, 0.86],
    [-77.04, -12.05, 15, 0.82], [-74.07, 4.71, 16, 0.84], [-66.90, 10.48, 13, 0.78],
    // North & Central America
    [-74.00, 40.71, 34, 1.0], [-71.06, 42.36, 20, 0.90], [-75.16, 39.95, 22, 0.92],
    [-77.03, 38.90, 22, 0.90], [-87.63, 41.88, 28, 0.98], [-83.05, 42.33, 20, 0.88],
    [-79.38, 43.65, 22, 0.92], [-73.57, 45.50, 16, 0.84], [-84.39, 33.75, 24, 0.92],
    [-80.19, 25.76, 20, 0.90], [-81.38, 28.54, 18, 0.85], [-95.37, 29.76, 24, 0.94],
    [-96.80, 32.78, 24, 0.94], [-97.74, 30.27, 16, 0.82], [-93.26, 44.98, 16, 0.80],
    [-104.99, 39.74, 16, 0.84], [-112.07, 33.45, 18, 0.88], [-118.24, 34.05, 30, 1.0],
    [-122.42, 37.77, 22, 0.94], [-122.33, 47.61, 16, 0.84], [-123.12, 49.28, 14, 0.80],
    [-99.13, 19.43, 26, 0.98], [-103.35, 20.66, 15, 0.82], [-100.31, 25.68, 15, 0.84],
    [-82.36, 23.13, 12, 0.74], [-69.93, 18.48, 12, 0.72],
    // Europe
    [-0.13, 51.51, 30, 1.0], [-1.90, 52.48, 22, 0.92], [-2.24, 53.48, 22, 0.92],
    [2.35, 48.86, 28, 1.0], [4.90, 52.37, 24, 0.96], [4.35, 50.85, 24, 0.96],
    [6.96, 50.94, 26, 0.98], [8.68, 50.11, 22, 0.94], [11.58, 48.14, 18, 0.88],
    [13.40, 52.52, 22, 0.94], [9.99, 53.55, 16, 0.85], [9.19, 45.46, 24, 0.96],
    [12.50, 41.90, 18, 0.88], [14.27, 40.85, 14, 0.82], [2.17, 41.39, 18, 0.90],
    [-3.70, 40.42, 20, 0.92], [-9.14, 38.72, 15, 0.84], [21.01, 52.23, 18, 0.88],
    [14.42, 50.08, 15, 0.82], [16.37, 48.21, 16, 0.86], [19.04, 47.50, 15, 0.84],
    [26.10, 44.43, 14, 0.80], [23.73, 37.98, 14, 0.82], [28.98, 41.01, 24, 0.96],
    [30.52, 50.45, 16, 0.84], [37.62, 55.76, 28, 1.0], [30.31, 59.93, 18, 0.90],
    [18.07, 59.33, 13, 0.80], [12.57, 55.68, 14, 0.82],
    // Africa & Middle East
    [31.24, 30.04, 28, 1.0], [30.80, 27.20, 14, 0.80], [32.64, 25.68, 12, 0.72],
    [-7.59, 33.57, 16, 0.84], [3.06, 36.75, 14, 0.80], [10.18, 36.81, 12, 0.76],
    [3.38, 6.52, 18, 0.86], [36.82, -1.29, 12, 0.74], [28.05, -26.20, 20, 0.92],
    [18.42, -33.92, 13, 0.80], [34.78, 32.08, 20, 0.95], [46.68, 24.71, 22, 0.96],
    [39.19, 21.49, 18, 0.88], [55.27, 25.20, 24, 0.98], [51.53, 25.29, 18, 0.92],
    [47.98, 29.37, 16, 0.88], [51.39, 35.69, 22, 0.94], [44.36, 33.31, 16, 0.84],
    // Asia
    [77.21, 28.61, 30, 1.0], [72.88, 19.08, 26, 0.98], [88.36, 22.57, 24, 0.95],
    [77.59, 12.97, 22, 0.92], [80.27, 13.08, 18, 0.86], [78.48, 17.39, 18, 0.86],
    [74.35, 31.52, 22, 0.92], [67.00, 24.86, 18, 0.88], [90.41, 23.81, 20, 0.90],
    [100.50, 13.76, 22, 0.94], [106.63, 10.82, 16, 0.84], [105.83, 21.03, 15, 0.82],
    [103.82, 1.35, 22, 0.96], [101.69, 3.14, 18, 0.88], [106.85, -6.21, 24, 0.95],
    [120.98, 14.60, 18, 0.88], [121.56, 25.03, 18, 0.90],
    [116.41, 39.90, 32, 1.0], [117.20, 39.13, 24, 0.94], [121.47, 31.23, 34, 1.0],
    [118.80, 32.06, 24, 0.92], [113.26, 23.13, 30, 1.0], [114.17, 22.32, 26, 0.98],
    [104.07, 30.67, 20, 0.88], [114.30, 30.59, 22, 0.90], [108.94, 34.34, 18, 0.85],
    [123.43, 41.80, 18, 0.85], [126.98, 37.57, 28, 1.0], [129.08, 35.18, 18, 0.88],
    [139.69, 35.69, 34, 1.0], [135.50, 34.69, 26, 0.96], [136.91, 35.18, 20, 0.90],
    [130.40, 33.59, 16, 0.84],
    // Oceania
    [151.21, -33.87, 20, 0.94], [144.96, -37.81, 18, 0.92], [153.03, -27.47, 14, 0.84],
    [115.86, -31.95, 12, 0.78], [174.76, -36.85, 13, 0.82],
  ];

  for (const [lon, lat, radius, intensity] of CITY_HUBS) {
    const cx = ((lon + 180) / 360) * NW;
    const cy = ((90 - lat) / 180) * NH;
    const grad = nctx.createRadialGradient(cx, cy, 0.5, cx, cy, radius);
    grad.addColorStop(0, `rgba(255, 228, 148, ${0.92 * intensity})`);
    grad.addColorStop(0.28, `rgba(255, 182, 74, ${0.58 * intensity})`);
    grad.addColorStop(0.62, `rgba(235, 120, 35, ${0.20 * intensity})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    nctx.fillStyle = grad;
    nctx.beginPath();
    nctx.arc(cx, cy, radius, 0, Math.PI * 2);
    nctx.fill();

    // Crisp bright city core dots
    nctx.fillStyle = `rgba(255, 245, 200, ${0.88 * intensity})`;
    nctx.beginPath();
    nctx.arc(cx, cy, 1.35, 0, Math.PI * 2);
    nctx.fill();
  }
  nctx.restore();

  // 4. Seamless Dynamic Cloud Texture (1024x512 upscaled to 2048x1024)
  const CW = 1024;
  const CH = 512;
  const smallCloudCanvas = document.createElement('canvas');
  smallCloudCanvas.width = CW;
  smallCloudCanvas.height = CH;
  const scctx = smallCloudCanvas.getContext('2d')!;
  const scImg = scctx.createImageData(CW, CH);

  for (let y = 0; y < CH; y++) {
    const lat = 90 - ((y + 0.5) / CH) * 180;
    const absLat = Math.abs(lat);
    const latRad = (lat * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    const sinLat = Math.sin(latRad);

    // Meteorological cloud band probability (ITCZ equator + mid-lat storm tracks ~48°; clearer horse latitudes ~24°)
    const itcz = Math.exp(-Math.pow((lat - 4) / 9, 2)) * 0.22;
    const stormTrack = Math.exp(-Math.pow((absLat - 48) / 14, 2)) * 0.25;
    const horseDry = Math.exp(-Math.pow((absLat - 24) / 9, 2)) * 0.16;
    const bandBias = 0.04 + itcz + stormTrack - horseDry;

    for (let x = 0; x < CW; x++) {
      const lon = ((x + 0.5) / CW) * 360 - 180;
      const lonRad = (lon * Math.PI) / 180;
      // Domain-warped zonal flow for authentic atmospheric swirls
      const sx = cosLat * Math.cos(lonRad);
      const sy = sinLat;
      const sz = cosLat * Math.sin(lonRad);

      const swirl = fbm3(sx * 2.8 + 4.2, sy * 3.4 - 1.1, sz * 2.8 + 0.3, 3) - 0.5;
      const cloudN = fbm3(
        sx * 5.2 + swirl * 1.9,
        sy * 7.8 + swirl * 0.8,
        sz * 5.2 - swirl * 1.6,
        4
      );
      const density = smoothstep(0.49 - bandBias, 0.78 - bandBias * 0.4, cloudN);
      const alpha = Math.round(density * 215);

      const p4 = (y * CW + x) * 4;
      scImg.data[p4] = 248;
      scImg.data[p4 + 1] = 251;
      scImg.data[p4 + 2] = 255;
      scImg.data[p4 + 3] = alpha;
    }
  }
  scctx.putImageData(scImg, 0, 0);

  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 2048;
  cloudCanvas.height = 1024;
  const clctx = cloudCanvas.getContext('2d')!;
  clctx.imageSmoothingEnabled = true;
  clctx.imageSmoothingQuality = 'high';
  clctx.drawImage(smallCloudCanvas, 0, 0, 2048, 1024);

  cachedEarthMaps = {
    dayCanvas,
    roughCanvas,
    bumpCanvas,
    nightCanvas,
    cloudCanvas,
  };
  return cachedEarthMaps;
}

export function getRealEarthDayCanvas(): HTMLCanvasElement {
  return getOrGenerateRealEarthMaps().dayCanvas;
}

export function buildRealEarthGlobe(
  globeGroup: THREE.Group,
  maxAnisotropy: number
): RealEarthGlobeHandle {
  const maps = getOrGenerateRealEarthMaps();

  const makeTex = (canvas: HTMLCanvasElement, isColor: boolean) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = Math.min(8, maxAnisotropy);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  };

  const dayMap = makeTex(maps.dayCanvas, true);
  const roughMap = makeTex(maps.roughCanvas, false);
  const bumpMap = makeTex(maps.bumpCanvas, false);
  const nightMap = makeTex(maps.nightCanvas, true);
  const cloudMap = makeTex(maps.cloudCanvas, true);

  const earthRadius = 5;
  const sunDirUniform = { value: new THREE.Vector3(1, 0, 0) };

  // 1. Real Earth Surface Mesh (Blue Marble Albedo + Bathymetric Specular + Relief Bump + Night City Lights)
  const earthGeo = new THREE.SphereGeometry(earthRadius, 96, 96);
  const earthMat = new THREE.MeshStandardMaterial({
    map: dayMap,
    roughnessMap: roughMap,
    roughness: 0.92,
    metalness: 0.06,
    bumpMap,
    bumpScale: 0.045,
    emissive: new THREE.Color(0xffcf7a),
    emissiveMap: nightMap,
    emissiveIntensity: 1.45,
  });

  earthMat.onBeforeCompile = (shader) => {
    shader.uniforms.uSunDir = sunDirUniform;
    shader.vertexShader =
      `varying vec3 vEarthWorldNorm;\n` +
      shader.vertexShader.replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>\n  vEarthWorldNorm = normalize(mat3(modelMatrix) * objectNormal);`
      );
    shader.fragmentShader =
      `uniform vec3 uSunDir;\nvarying vec3 vEarthWorldNorm;\n` +
      shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float earthSunDot = dot(normalize(vEarthWorldNorm), normalize(uSunDir));
        float earthNightMask = smoothstep(0.08, -0.22, earthSunDot);
        totalEmissiveRadiance *= earthNightMask;`
      );
  };

  const earthMesh = new THREE.Mesh(earthGeo, earthMat);
  earthMesh.name = 'realEarthMesh';
  globeGroup.add(earthMesh);

  // 2. Dynamic 3D Cloud Sphere (slightly above surface, attenuated smoothly at night)
  const cloudGeo = new THREE.SphereGeometry(earthRadius * 1.011, 72, 72);
  const cloudMat = new THREE.MeshStandardMaterial({
    map: cloudMap,
    transparent: true,
    opacity: 0.78,
    roughness: 0.95,
    metalness: 0.0,
    depthWrite: false,
  });
  const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
  cloudMesh.name = 'realEarthClouds';
  globeGroup.add(cloudMesh);

  // 3. Rayleigh Orbital Atmosphere Scattering Rim Halo (blue sunlit limb + amber twilight terminator)
  const atmoGeo = new THREE.SphereGeometry(earthRadius * 1.036, 72, 72);
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: sunDirUniform,
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(vViewDir);
        vec3 L = normalize(uSunDir);
        // BackSide rim Fresnel glow peaking near Earth horizon edge
        float fresnel = pow(clamp(1.0 + dot(N, V), 0.0, 1.0), 3.6);
        float sunDot = dot(N, L);
        float daySide = smoothstep(-0.22, 0.45, sunDot);
        float terminatorBand = exp(-pow((sunDot + 0.02) / 0.19, 2.0));
        vec3 dayBlue = vec3(0.28, 0.68, 1.0);
        vec3 twilightWarm = vec3(1.0, 0.56, 0.24);
        vec3 col = mix(dayBlue, twilightWarm, terminatorBand * 0.48);
        float alpha = fresnel * (0.04 + 0.76 * daySide + 0.25 * terminatorBand);
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.85));
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const atmosphereMesh = new THREE.Mesh(atmoGeo, atmoMat);
  atmosphereMesh.name = 'realEarthAtmosphere';
  globeGroup.add(atmosphereMesh);

  // 4. Deep Space Starfield Backdrop around the 3D Earth Globe
  const starCount = 1800;
  const starPos = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    // Deterministic Fibonacci-jittered sphere distribution at radius 90..135
    const u = hash3(i, 17, 31);
    const v = hash3(i, 53, 97);
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const r = 90 + hash3(i, 71, 11) * 45;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    const tint = hash3(i, 103, 7);
    const bright = 0.55 + hash3(i, 13, 89) * 0.45;
    if (tint < 0.22) {
      starCol[i * 3] = 0.78 * bright;
      starCol[i * 3 + 1] = 0.88 * bright;
      starCol[i * 3 + 2] = 1.0 * bright;
    } else if (tint > 0.82) {
      starCol[i * 3] = 1.0 * bright;
      starCol[i * 3 + 1] = 0.88 * bright;
      starCol[i * 3 + 2] = 0.72 * bright;
    } else {
      starCol[i * 3] = bright;
      starCol[i * 3 + 1] = bright;
      starCol[i * 3 + 2] = bright;
    }
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  const starMat = new THREE.PointsMaterial({
    size: 0.42,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
    fog: false,
  });
  const starPoints = new THREE.Points(starGeo, starMat);
  starPoints.name = 'realEarthStars';
  globeGroup.add(starPoints);

  return {
    earthMesh,
    cloudMesh,
    atmosphereMesh,
    updateSunAndClouds: (sunDirX: number, sunDirY: number, sunDirZ: number, deltaSec: number) => {
      sunDirUniform.value.set(sunDirX, sunDirY, sunDirZ).normalize();
      if (deltaSec > 0) {
        cloudMesh.rotation.y += deltaSec * 0.009;
      }
    },
  };
}
