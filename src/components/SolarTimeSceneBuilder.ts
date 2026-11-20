import * as THREE from 'three';
import { SolarClockVersion, Solar3DVector } from '../types/solar';
import { CityObstacleBox } from './CitySceneBuilder';

export interface SolarTimeUpdateParams {
  solarAltitudeDeg: number;
  solarAzimuthDeg: number;
  lightVector3D: Solar3DVector;
  lstMinutes: number;
  civilHours: number;
  latitude: number;
  version: SolarClockVersion;
  wallAzimuthDeg?: number | null;
  floorAzimuthDeg?: number;
  elapsedSec: number;
}

export interface SolarTimeSceneHandle {
  cityGroup: THREE.Group;
  obstacles: CityObstacleBox[];
  updateSolarTimeScene: (params: SolarTimeUpdateParams) => void;
  dispose: () => void;
}

interface DialTextureOptions {
  maxAnisotropy: number;
  subtitleLabel: string;
  /** Hour placed at the TOP (-Z on floor / +Y on wall): 12 for inverted floor, 0 for wall */
  topHour: 0 | 12;
  /** True = clockwise, False = counter-clockwise for Northern Hemisphere South-facing wall */
  clockwise: boolean;
  /** Dial physical radius in meters so concentric metric distance rings are 100% 1:1 true to life */
  dialRadiusMeters: number;
  /** Metric circles to draw on the dial (in meters from gnomon center) */
  metricRingsMeters: number[];
}

function createDialFaceTexture({
  maxAnisotropy,
  subtitleLabel,
  topHour,
  clockwise,
  dialRadiusMeters,
  metricRingsMeters,
}: DialTextureOptions): THREE.CanvasTexture {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.488;
  const pxPerMeter = R / dialRadiusMeters;

  ctx.clearRect(0, 0, size, size);

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  const hourToCanvasAngle = (h: number) => {
    const dir = clockwise ? 1 : -1;
    const offsetHours = h - topHour;
    return -Math.PI / 2 + dir * (offsetHours / 24) * Math.PI * 2;
  };

  const dayIsTop = topHour === 12;

  const nightGrad = ctx.createRadialGradient(cx, cy, R * 0.08, cx, cy, R * 0.94);
  nightGrad.addColorStop(0, '#0f172a');
  nightGrad.addColorStop(0.65, '#172554');
  nightGrad.addColorStop(1, '#091124');
  ctx.fillStyle = nightGrad;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  if (dayIsTop) {
    ctx.arc(cx, cy, R * 0.94, 0, Math.PI, false);
  } else {
    ctx.arc(cx, cy, R * 0.94, Math.PI, Math.PI * 2, false);
  }
  ctx.closePath();
  ctx.fill();

  const dayGrad = ctx.createRadialGradient(cx, cy, R * 0.08, cx, cy, R * 0.94);
  dayGrad.addColorStop(0, '#fef9e7');
  dayGrad.addColorStop(0.65, '#f4ebd0');
  dayGrad.addColorStop(1, '#e7d7b1');
  ctx.fillStyle = dayGrad;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  if (dayIsTop) {
    ctx.arc(cx, cy, R * 0.94, Math.PI, Math.PI * 2, false);
  } else {
    ctx.arc(cx, cy, R * 0.94, 0, Math.PI, false);
  }
  ctx.closePath();
  ctx.fill();

  // Outer metallic chapter ring
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 24;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.96, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.935, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.72, 0, Math.PI * 2);
  ctx.stroke();

  // True 1:1 metric distance circles (e.g., 2.5m, 5m, 7.5m on floor dial)
  for (const m of metricRingsMeters) {
    const rPx = m * pxPerMeter;
    if (rPx >= R * 0.91) continue;
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.34)';
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Discreet real-scale label along the 45° diagonal so users can verify L = H / tan(alt) visually
    const labelAngle = dayIsTop ? -Math.PI / 4 : Math.PI / 4;
    const lx = cx + Math.cos(labelAngle) * rPx;
    const ly = cy + Math.sin(labelAngle) * rPx;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.beginPath();
    ctx.roundRect(lx - 32, ly - 16, 64, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 21px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${m}m`, lx, ly + 1);
  }

  // Horizon divider line (06:00 <-> 18:00)
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.78)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.93, cy);
  ctx.lineTo(cx + R * 0.93, cy);
  ctx.stroke();

  // Meridian Axis (12:00 - 00:00)
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
  ctx.setLineDash([14, 10]);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy - R * 0.93);
  ctx.lineTo(cx, cy + R * 0.93);
  ctx.stroke();
  ctx.setLineDash([]);

  // Sub-ticks for every 15 minutes (96 segments) around the 24h dial
  for (let i = 0; i < 96; i++) {
    const h = i / 4;
    const canvasAng = hourToCanvasAngle(h);
    const isHour = i % 4 === 0;
    const isHalf = i % 2 === 0;
    const isDay = h >= 6 && h <= 18;

    const rOuter = R * 0.93;
    const rInner = isHour ? R * 0.855 : isHalf ? R * 0.885 : R * 0.905;

    ctx.strokeStyle = isHour
      ? h === 0 || h === 12 || h === 6 || h === 18
        ? '#f59e0b'
        : isDay
          ? '#1e293b'
          : '#e2e8f0'
      : isDay
        ? 'rgba(30, 41, 59, 0.45)'
        : 'rgba(226, 232, 240, 0.45)';
    ctx.lineWidth = isHour ? (h % 6 === 0 ? 11 : 6) : isHalf ? 3.5 : 2;

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(canvasAng) * rInner, cy + Math.sin(canvasAng) * rInner);
    ctx.lineTo(cx + Math.cos(canvasAng) * rOuter, cy + Math.sin(canvasAng) * rOuter);
    ctx.stroke();
  }

  // Radial faint hour spokes
  for (let h = 0; h < 24; h++) {
    const canvasAng = hourToCanvasAngle(h);
    const isDay = h >= 6 && h <= 18;
    ctx.strokeStyle = isDay ? 'rgba(120, 53, 15, 0.16)' : 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = h % 6 === 0 ? 5 : 2.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(canvasAng) * (R * 0.14), cy + Math.sin(canvasAng) * (R * 0.14));
    ctx.lineTo(cx + Math.cos(canvasAng) * (R * 0.72), cy + Math.sin(canvasAng) * (R * 0.72));
    ctx.stroke();
  }

  // Hour Labels (00 to 23)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let h = 0; h < 24; h++) {
    const canvasAng = hourToCanvasAngle(h);
    const isCardinal = h === 0 || h === 6 || h === 12 || h === 18;
    const isDay = h >= 6 && h <= 18;
    const numR = R * 0.785;
    const nx = cx + Math.cos(canvasAng) * numR;
    const ny = cy + Math.sin(canvasAng) * numR;

    const label =
      h === 0
        ? '00:00'
        : h === 12
          ? '12:00'
          : h === 6
            ? '06:00'
            : h === 18
              ? '18:00'
              : `${h.toString().padStart(2, '0')}h`;

    if (isCardinal) {
      const badgeW = 148;
      const badgeH = 68;
      ctx.fillStyle = h === 0 ? '#020617' : h === 12 ? '#b45309' : '#1e293b';
      ctx.strokeStyle = h === 0 ? '#38bdf8' : '#fbbf24';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(nx - badgeW / 2, ny - badgeH / 2, badgeW, badgeH, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = h === 0 ? '#7dd3fc' : '#fef3c7';
      ctx.font = 'bold 40px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(label, nx, ny + 2);
    } else {
      ctx.fillStyle = isDay ? '#1e293b' : '#f1f5f9';
      ctx.font = 'bold 38px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(label, nx, ny);
    }
  }

  if (topHour === 12) {
    ctx.fillStyle = '#92400e';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText('MEIO-DIA SOLAR ↑', cx, cy - R * 0.56);

    ctx.fillStyle = '#93c5fd';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText('MEIA-NOITE ↓', cx, cy + R * 0.56);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 22px ui-monospace, monospace';
    ctx.fillText(subtitleLabel, cx, cy - R * 0.36);
  } else {
    ctx.fillStyle = '#93c5fd';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText('MEIA-NOITE ↑', cx, cy - R * 0.56);

    ctx.fillStyle = '#92400e';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText('MEIO-DIA SOLAR ↓', cx, cy + R * 0.56);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 22px ui-monospace, monospace';
    ctx.fillText(subtitleLabel, cx, cy + R * 0.36);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createPlazaFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  const plazaRadiusM = 30;
  const pxPerM = (size * 0.49) / plazaRadiusM;

  ctx.fillStyle = '#1b2430';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 2;
  for (const m of [12, 15, 20, 25, 29]) {
    ctx.beginPath();
    ctx.arc(cx, cy, m * pxPerM, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (10.8 * pxPerM), cy + Math.sin(a) * (10.8 * pxPerM));
    ctx.lineTo(cx + Math.cos(a) * (29.5 * pxPerM), cy + Math.sin(a) * (29.5 * pxPerM));
    ctx.stroke();
  }

  // Metric 15m and 20m plaza ground labels
  for (const m of [15, 20, 25]) {
    const rPx = m * pxPerM;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.font = 'bold 18px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${m}m`, cx + rPx * 0.707, cy - rPx * 0.707);
  }

  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, 29.4 * pxPerM, 0, Math.PI * 2);
  ctx.stroke();

  const drawCardinal = (text: string, x: number, y: number, color: string) => {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x - 68, y - 22, 136, 44, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = 'bold 24px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
  };

  drawCardinal('NORTE (0°)', cx, 58, '#ef4444');
  drawCardinal('SUL (180°)', cx, size - 58, '#10b981');
  drawCardinal('LESTE (90°)', size - 88, cy, '#38bdf8');
  drawCardinal('OESTE (270°)', 88, cy, '#f59e0b');

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function formatCompassLabel(azDeg: number): string {
  const az = ((azDeg % 360) + 360) % 360;
  const dirs = ['NORTE', 'NORDESTE', 'LESTE', 'SUDESTE', 'SUL', 'SUDOESTE', 'OESTE', 'NOROESTE'];
  return dirs[Math.round(az / 45) % 8];
}

function drawWallSignCanvas(
  ctx: CanvasRenderingContext2D,
  title: string,
  subtitle: string
) {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 1004, 236);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 44px ui-monospace, monospace';
  ctx.fillText(title, 512, 96);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 31px system-ui, sans-serif';
  ctx.fillText(subtitle, 512, 174);
}

// Sun real angular semi-diameter: 0.2665° -> tan(0.2665°) ≈ 0.004651 rad
const SOLAR_HALF_ANGULAR_TAN = 0.004651;

interface CastShadowHandle {
  group: THREE.Group;
  umbraGeo: THREE.BufferGeometry;
  penumbraGeo: THREE.BufferGeometry;
  tipDisc: THREE.Mesh;
  umbraMat: THREE.MeshBasicMaterial;
  penumbraMat: THREE.MeshBasicMaterial;
  tipMat: THREE.MeshBasicMaterial;
  baseHalfWidth: number;
  tipHalfWidth: number;
  tipSphereRadius: number;
  gnomonHeight: number;
  /** Optional bounding half-extents for rectangular surfaces (e.g. stone wall slab); null = floor circular reach up to maxLength */
  rectHalfExtents: { halfW: number; halfH: number } | null;
  maxFloorLength: number;
}

function createGnomonShadowRig(
  ySurface: number,
  baseHalfWidth: number,
  tipHalfWidth: number,
  tipSphereRadius: number,
  gnomonHeight: number,
  rectHalfExtents: { halfW: number; halfH: number } | null,
  maxFloorLength: number,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): CastShadowHandle {
  const group = new THREE.Group();
  group.position.set(0, ySurface, 0);

  const makeDynamicQuad = () => {
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array(12);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    return trackGeo(geo);
  };

  const penumbraGeo = makeDynamicQuad();
  const penumbraMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x050914,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  const penumbraMesh = new THREE.Mesh(penumbraGeo, penumbraMat);
  penumbraMesh.renderOrder = 2;
  penumbraMesh.frustumCulled = false;
  group.add(penumbraMesh);

  const umbraGeo = makeDynamicQuad();
  const umbraMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x020612,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    })
  );
  const umbraMesh = new THREE.Mesh(umbraGeo, umbraMat);
  umbraMesh.renderOrder = 3;
  umbraMesh.frustumCulled = false;
  group.add(umbraMesh);

  // Unit disc that will be stretched elliptically along shadow direction: scaleZ = 1 / sin(incidence)
  const tipGeo = trackGeo(new THREE.CircleGeometry(tipSphereRadius, 28));
  tipGeo.rotateX(-Math.PI / 2);
  const tipMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x020612,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    })
  );
  const tipDisc = new THREE.Mesh(tipGeo, tipMat);
  tipDisc.renderOrder = 3;
  group.add(tipDisc);

  return {
    group,
    umbraGeo,
    penumbraGeo,
    tipDisc,
    umbraMat,
    penumbraMat,
    tipMat,
    baseHalfWidth,
    tipHalfWidth,
    tipSphereRadius,
    gnomonHeight,
    rectHalfExtents,
    maxFloorLength,
  };
}

function setQuadWidthLength(
  geo: THREE.BufferGeometry,
  bw: number,
  tw: number,
  len: number
) {
  const attr = geo.attributes.position as THREE.BufferAttribute;
  const arr = attr.array as Float32Array;
  arr[0] = -bw; arr[1] = 0; arr[2] = 0;
  arr[3] = bw;  arr[4] = 0; arr[5] = 0;
  arr[6] = tw;  arr[7] = 0; arr[8] = -len;
  arr[9] = -tw; arr[10] = 0; arr[11] = -len;
  attr.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
}

function updateGnomonShadowRig(
  rig: CastShadowHandle,
  localSunX: number,
  localSunY: number,
  localSunZ: number,
  worldSunAltDeg: number
) {
  // Real physics: shadow exists whenever Sun is above horizon & illuminates front dial face
  if (worldSunAltDeg <= -0.5 || localSunY <= 0.008) {
    rig.group.visible = false;
    return;
  }

  const horizonFade = Math.min(1, Math.max(0, (worldSunAltDeg + 0.5) / 3.8));
  const incidenceFade = Math.min(1, Math.max(0, (localSunY - 0.008) / 0.07));
  const strength = horizonFade * incidenceFade;

  // Exact real-life ray-plane intersection: L = H * hypot(sx, sz) / sy = H / tan(incidenceAngle)
  const dx = -(localSunX / localSunY) * rig.gnomonHeight;
  const dz = -(localSunZ / localSunY) * rig.gnomonHeight;
  const rawLen = Math.hypot(dx, dz);

  rig.group.visible = true;

  if (rawLen < 0.03) {
    // Subsolar Zenith (Lahaina Noon): zero horizontal shadow offset directly beneath gnomon
    setQuadWidthLength(rig.umbraGeo, rig.baseHalfWidth, rig.baseHalfWidth, 0.04);
    setQuadWidthLength(rig.penumbraGeo, rig.baseHalfWidth * 1.18, rig.baseHalfWidth * 1.18, 0.04);
    rig.umbraMat.opacity = 0.65 * strength;
    rig.penumbraMat.opacity = 0.25 * strength;
    rig.tipDisc.visible = false;
    return;
  }

  const dirX = dx / rawLen;
  const dirZ = dz / rawLen;
  rig.group.rotation.y = Math.atan2(-dx, -dz);

  // Real physical boundary clip:
  // - On Wall: clip exactly to the stone slab perimeter (halfW x halfH)
  // - On Floor: NO artificial dial-edge cut-off! Shadow stretches across the ground up to maxFloorLength (90m)
  let maxReach = rig.maxFloorLength;
  if (rig.rectHalfExtents) {
    const { halfW, halfH } = rig.rectHalfExtents;
    const bx = Math.abs(dirX) > 1e-5 ? halfW / Math.abs(dirX) : 1e6;
    const bz = Math.abs(dirZ) > 1e-5 ? halfH / Math.abs(dirZ) : 1e6;
    maxReach = Math.min(bx, bz);
  }

  const drawnLen = Math.min(rawLen, maxReach);

  // Real solar disk angular spreading (0.533° diameter -> 0.2665° half-angle):
  // Distance along sun ray from gnomon apex to tip shadow: D_ray = sqrt(H^2 + L^2)
  const rayDist3D = Math.hypot(rig.gnomonHeight, drawnLen);
  const angularBlur = rayDist3D * SOLAR_HALF_ANGULAR_TAN;

  // Compute tapered width at drawnLen (interpolated linearly along shadow if clipped)
  const frac = Math.min(1, drawnLen / rawLen);
  const rawTipW = rig.baseHalfWidth + (rig.tipHalfWidth - rig.baseHalfWidth) * frac;

  // Umbra narrows slightly with solar angular radius; Penumbra widens realistically!
  const umbraTipW = Math.max(0.02, rawTipW - angularBlur * 0.45);
  const penumbraTipW = rawTipW + angularBlur * 1.65 + 0.04;

  // Low-sun atmospheric scattering softens very long shadows slightly like real life
  const distanceSoften = 1 / (1 + drawnLen * 0.014);
  rig.umbraMat.opacity = 0.66 * strength * (0.45 + 0.55 * distanceSoften);
  rig.penumbraMat.opacity = 0.28 * strength * (0.55 + 0.45 * distanceSoften);

  setQuadWidthLength(rig.umbraGeo, rig.baseHalfWidth, umbraTipW, drawnLen);
  setQuadWidthLength(rig.penumbraGeo, rig.baseHalfWidth + 0.05, penumbraTipW, drawnLen);

  // True elliptical projection of spherical apex onto dial surface: scaleZ = 1 / localSunY
  if (rawLen <= maxReach) {
    rig.tipDisc.visible = true;
    rig.tipDisc.position.set(0, 0, -drawnLen);
    const stretchZ = Math.min(7.5, 1 / Math.max(0.12, localSunY));
    const penumbraExpand = 1 + (angularBlur / Math.max(0.08, rig.tipSphereRadius)) * 0.45;
    rig.tipDisc.scale.set(penumbraExpand, 1, stretchZ * penumbraExpand);
    rig.tipMat.opacity = rig.umbraMat.opacity;
  } else {
    rig.tipDisc.visible = false;
  }
}

const _sunVec = new THREE.Vector3();
const _yAxis = new THREE.Vector3(0, 1, 0);
const _xAxis = new THREE.Vector3(1, 0, 0);

export function buildSolarTimeScene(
  maxAnisotropy: number,
  isSoftwareGl: boolean
): SolarTimeSceneHandle {
  const cityGroup = new THREE.Group();
  cityGroup.name = 'solarTimeSceneGroup';

  const disposableGeos: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];
  const disposableTexs: THREE.Texture[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposableGeos.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposableMats.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    disposableTexs.push(t);
    return t;
  };

  // Shared materials
  const stoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.78,
      metalness: 0.06,
    })
  );
  const darkGraniteMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.65,
      metalness: 0.14,
    })
  );
  const brassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.24,
      metalness: 0.88,
    })
  );
  const goldApexMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: new THREE.Color(0xf59e0b),
      emissiveIntensity: 0.22,
      roughness: 0.18,
      metalness: 0.9,
    })
  );

  // ==========================================
  // 1. OBSERVATORY PLAZA GROUND (60m diameter, nearly flush so long real shadows cross seamlessly)
  // ==========================================
  const plazaTex = trackTex(createPlazaFloorTexture(maxAnisotropy));
  const plazaMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: plazaTex,
      roughness: 0.86,
      metalness: 0.06,
    })
  );
  const plazaGeo = trackGeo(new THREE.CircleGeometry(30, 96));
  plazaGeo.rotateX(-Math.PI / 2);
  const plazaMesh = new THREE.Mesh(plazaGeo, plazaMat);
  plazaMesh.position.y = 0.025;
  plazaMesh.receiveShadow = true;
  cityGroup.add(plazaMesh);

  // Perimeter plaza bollards & twilight lamps (turn on <= -3°)
  const lampBulbs: THREE.MeshStandardMaterial[] = [];
  const lampLights: THREE.PointLight[] = [];
  const postMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.75 }));
  const bollardGeo = trackGeo(new THREE.CylinderGeometry(0.14, 0.2, 2.2, 12));
  const bulbGeo = trackGeo(new THREE.SphereGeometry(0.22, 14, 14));

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const bx = Math.sin(a) * 23.5;
    const bz = -Math.cos(a) * 23.5;

    const bollard = new THREE.Mesh(bollardGeo, postMat);
    bollard.position.set(bx, 1.1, bz);
    bollard.castShadow = true;
    bollard.receiveShadow = true;
    cityGroup.add(bollard);

    const bulbMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfff3d1,
        emissive: new THREE.Color(0xffb84d),
        emissiveIntensity: 0.0,
        roughness: 0.2,
      })
    );
    lampBulbs.push(bulbMat);
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(bx, 2.32, bz);
    cityGroup.add(bulb);

    if (!isSoftwareGl && i % 2 === 0) {
      const pt = new THREE.PointLight(0xffcb77, 0, 26, 1.6);
      pt.position.set(bx, 2.5, bz);
      cityGroup.add(pt);
      lampLights.push(pt);
    }
  }

  // ==========================================
  // 2. VERSION A: FLOOR 24H SOLAR CLOCK (CHÃO INVERTIDO: 12:00 ↑ / 00:00 ↓)
  // Exact 1:1 physical gnomon height H = 5.00m above dial surface (L_real = 5.00 / tan(alt))
  // Flush ground inlay so shadows stretch seamlessly from 0m across 5m/10m/15m/20m rings & terrain!
  // ==========================================
  const floorGroup = new THREE.Group();
  floorGroup.name = 'floorSolarClock24h';

  const floorR = 10.6;
  const floorRimGeo = trackGeo(new THREE.CylinderGeometry(floorR + 0.24, floorR + 0.34, 0.04, 96));
  const floorRim = new THREE.Mesh(floorRimGeo, brassMat);
  floorRim.position.y = 0.042;
  floorRim.receiveShadow = true;
  floorGroup.add(floorRim);

  const floorDialTex = trackTex(
    createDialFaceTexture({
      maxAnisotropy,
      subtitleLabel: 'CHÃO 24H · H = 5,00m (1:1 REAL)',
      topHour: 12,
      clockwise: true,
      dialRadiusMeters: floorR,
      metricRingsMeters: [2.5, 5, 7.5, 10],
    })
  );
  const floorDialMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: floorDialTex,
      roughness: 0.52,
      metalness: 0.08,
      emissiveMap: floorDialTex,
      emissive: new THREE.Color(0xffe7b3),
      emissiveIntensity: 0.0,
    })
  );
  const floorDialGeo = trackGeo(new THREE.CircleGeometry(floorR, 96));
  floorDialGeo.rotateX(-Math.PI / 2);
  const floorDialMesh = new THREE.Mesh(floorDialGeo, floorDialMat);
  floorDialMesh.position.y = 0.064;
  floorDialMesh.receiveShadow = true;

  const floorDialRotator = new THREE.Group();
  floorDialRotator.name = 'floorDial24hRotator';
  floorDialRotator.add(floorDialMesh);

  // Brass cardinal arrow notch on the outer rim marking the "12:00 TOP" axis as the floor dial turns 0°-360°
  const arrow12Geo = trackGeo(new THREE.ConeGeometry(0.42, 0.92, 4));
  arrow12Geo.rotateY(Math.PI / 4);
  arrow12Geo.rotateX(-Math.PI / 2);
  const arrow12Mesh = new THREE.Mesh(arrow12Geo, goldApexMat);
  arrow12Mesh.position.set(0, 0.075, -(floorR + 0.56));
  arrow12Mesh.castShadow = true;
  floorDialRotator.add(arrow12Mesh);

  // Opposite subtle tail marker marking "00:00"
  const tail00Geo = trackGeo(new THREE.BoxGeometry(0.46, 0.04, 0.55));
  const tail00Mesh = new THREE.Mesh(tail00Geo, darkGraniteMat);
  tail00Mesh.position.set(0, 0.065, floorR + 0.42);
  floorDialRotator.add(tail00Mesh);

  floorGroup.add(floorDialRotator);

  // Exact H = 5.00m Gnomon above the 0.064m dial plane (apex height = 5.064m!)
  const floorGnomonBaseGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.52, 0.20, 24));
  const floorGnomonBase = new THREE.Mesh(floorGnomonBaseGeo, darkGraniteMat);
  floorGnomonBase.position.y = 0.164;
  floorGnomonBase.castShadow = true;
  floorGnomonBase.receiveShadow = true;
  floorGroup.add(floorGnomonBase);

  const floorObeliskGeo = trackGeo(new THREE.CylinderGeometry(0.06, 0.24, 4.70, 12));
  const floorObelisk = new THREE.Mesh(floorObeliskGeo, brassMat);
  floorObelisk.position.y = 2.614;
  floorObelisk.castShadow = true;
  floorObelisk.receiveShadow = true;
  floorGroup.add(floorObelisk);

  const floorApexGeo = trackGeo(new THREE.SphereGeometry(0.14, 16, 16));
  const floorApex = new THREE.Mesh(floorApexGeo, goldApexMat);
  floorApex.position.y = 4.924;
  floorApex.castShadow = true;
  floorGroup.add(floorApex);

  // Real unclipped ray-projected Gnomon Shadow (H = 5.00m exact, extends up to 90m across plaza & ground!)
  const floorShadowRig = createGnomonShadowRig(
    0.072,
    0.30,
    0.07,
    0.15,
    5.00,
    null,
    90,
    trackGeo,
    trackMat
  );
  floorGroup.add(floorShadowRig.group);

  cityGroup.add(floorGroup);

  // ==========================================
  // 3. VERSION B & C: WALL 24H SOLAR CLOCK (100% EM PÉ 90° / INCLINADA 67,5°)
  // Exact H = 2.50m perpendicular gnomon rod
  // Hemisphere Aware:
  //   Southern Hemisphere (lat < 0) -> Facing NORTH (-Z)
  //   Northern Hemisphere (lat >= 0) -> Facing SOUTH (+Z)
  // ==========================================
  const wallHemiGroup = new THREE.Group();
  wallHemiGroup.name = 'wallSolarClockHemisphereRoot';

  const wallPlinthGeo = trackGeo(new THREE.BoxGeometry(13.6, 0.55, 5.2));
  const wallPlinth = new THREE.Mesh(wallPlinthGeo, darkGraniteMat);
  wallPlinth.position.y = 0.275;
  wallPlinth.receiveShadow = true;
  wallPlinth.castShadow = true;
  wallHemiGroup.add(wallPlinth);

  const wallUpperPlinthGeo = trackGeo(new THREE.BoxGeometry(12.2, 0.32, 3.6));
  const wallUpperPlinth = new THREE.Mesh(wallUpperPlinthGeo, stoneMat);
  wallUpperPlinth.position.y = 0.71;
  wallUpperPlinth.receiveShadow = true;
  wallUpperPlinth.castShadow = true;
  wallHemiGroup.add(wallUpperPlinth);

  const wallTiltPivot = new THREE.Group();
  const dialCenterOffset = 6.15;
  wallTiltPivot.position.set(0, 0.9, 0);

  const wallR = 5.45;
  const wallAssembly = new THREE.Group();
  wallAssembly.position.set(0, 0, -dialCenterOffset);

  const backingSlabGeo = trackGeo(new THREE.BoxGeometry(11.8, 0.52, 11.6));
  const backingSlab = new THREE.Mesh(backingSlabGeo, stoneMat);
  backingSlab.position.y = -0.26;
  backingSlab.castShadow = true;
  backingSlab.receiveShadow = true;
  wallAssembly.add(backingSlab);

  const rearRibGeo = trackGeo(new THREE.BoxGeometry(0.65, 0.72, 10.6));
  for (const rx of [-3.6, 0, 3.6]) {
    const rib = new THREE.Mesh(rearRibGeo, darkGraniteMat);
    rib.position.set(rx, -0.82, 0);
    rib.castShadow = true;
    rib.receiveShadow = true;
    wallAssembly.add(rib);
  }

  const wallRimGeo = trackGeo(new THREE.CylinderGeometry(wallR + 0.18, wallR + 0.24, 0.14, 96));
  const wallRim = new THREE.Mesh(wallRimGeo, brassMat);
  wallRim.position.y = 0.04;
  wallRim.castShadow = true;
  wallRim.receiveShadow = true;
  wallAssembly.add(wallRim);

  const wallDialSouthHemiTex = trackTex(
    createDialFaceTexture({
      maxAnisotropy,
      subtitleLabel: 'PAREDE SUL→NORTE · H = 2,50m',
      topHour: 0,
      clockwise: true,
      dialRadiusMeters: wallR,
      metricRingsMeters: [1.5, 3, 4.5],
    })
  );
  const wallDialNorthHemiTex = trackTex(
    createDialFaceTexture({
      maxAnisotropy,
      subtitleLabel: 'PAREDE NORTE→SUL · H = 2,50m',
      topHour: 0,
      clockwise: false,
      dialRadiusMeters: wallR,
      metricRingsMeters: [1.5, 3, 4.5],
    })
  );

  const wallDialMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: wallDialSouthHemiTex,
      roughness: 0.48,
      metalness: 0.08,
      emissiveMap: wallDialSouthHemiTex,
      emissive: new THREE.Color(0xffe7b3),
      emissiveIntensity: 0.0,
    })
  );
  const wallDialGeo = trackGeo(new THREE.CircleGeometry(wallR, 96));
  wallDialGeo.rotateX(-Math.PI / 2);
  const wallDialMesh = new THREE.Mesh(wallDialGeo, wallDialMat);
  wallDialMesh.position.y = 0.12;
  wallDialMesh.receiveShadow = true;
  wallAssembly.add(wallDialMesh);

  // Exact H = 2.50m Perpendicular Brass Gnomon Rod above the 0.12m dial plane (apex at y = 2.62m!)
  const wallGnomonBaseGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.34, 0.16, 20));
  const wallGnomonBase = new THREE.Mesh(wallGnomonBaseGeo, darkGraniteMat);
  wallGnomonBase.position.y = 0.20;
  wallGnomonBase.castShadow = true;
  wallAssembly.add(wallGnomonBase);

  const wallGnomonPinGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.12, 2.34, 12));
  const wallGnomonPin = new THREE.Mesh(wallGnomonPinGeo, brassMat);
  wallGnomonPin.position.y = 1.45;
  wallGnomonPin.castShadow = true;
  wallAssembly.add(wallGnomonPin);

  const wallGnomonTipGeo = trackGeo(new THREE.SphereGeometry(0.11, 14, 14));
  const wallGnomonTip = new THREE.Mesh(wallGnomonTipGeo, goldApexMat);
  wallGnomonTip.position.y = 2.51;
  wallGnomonTip.castShadow = true;
  wallAssembly.add(wallGnomonTip);

  // Ray-projected Gnomon Shadow onto Wall Dial & Stone Slab (exact H = 2.50m)
  const wallShadowRig = createGnomonShadowRig(
    0.132,
    0.18,
    0.06,
    0.12,
    2.50,
    { halfW: 5.82, halfH: 5.72 },
    10,
    trackGeo,
    trackMat
  );
  wallAssembly.add(wallShadowRig.group);

  wallTiltPivot.add(wallAssembly);
  wallHemiGroup.add(wallTiltPivot);

  // Twin side brass hinge trunnion cradles
  const trunnionGeo = trackGeo(new THREE.CylinderGeometry(0.45, 0.55, 0.9, 20));
  trunnionGeo.rotateZ(Math.PI / 2);
  for (const sx of [-6.05, 6.05]) {
    const trunnion = new THREE.Mesh(trunnionGeo, brassMat);
    trunnion.position.set(sx, 0.9, 0);
    trunnion.castShadow = true;
    trunnion.receiveShadow = true;
    wallHemiGroup.add(trunnion);
  }

  // Front Orientation Sign Plaque at base of the plinth (live-updating CanvasTexture for any 0°–360° azimuth & tilt)
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 1024;
  signCanvas.height = 256;
  const signCtx = signCanvas.getContext('2d')!;
  drawWallSignCanvas(signCtx, 'PAREDE 90° · FOCO 0° (NORTE)', 'HEMISFÉRIO SUL (AUTO)');
  const dynamicSignTex = trackTex(new THREE.CanvasTexture(signCanvas));
  dynamicSignTex.colorSpace = THREE.SRGBColorSpace;
  dynamicSignTex.anisotropy = maxAnisotropy;

  const signMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: dynamicSignTex,
      roughness: 0.35,
      metalness: 0.2,
    })
  );
  const signGeo = trackGeo(new THREE.PlaneGeometry(5.6, 1.1));
  const frontPlaque = new THREE.Mesh(signGeo, signMat);
  frontPlaque.position.set(0, 0.75, 1.83);
  wallHemiGroup.add(frontPlaque);

  let lastPlaqueKey = '';

  // Dynamic ground shadow of the entire wall monolith when software WebGL disables hardware shadowMap
  const wallMonolithGroundShadowGeo = trackGeo(new THREE.BufferGeometry());
  wallMonolithGroundShadowGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(12), 3)
  );
  wallMonolithGroundShadowGeo.setIndex([0, 1, 2, 0, 2, 3]);
  const wallMonolithGroundShadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x020612,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const wallMonolithGroundShadow = new THREE.Mesh(
    wallMonolithGroundShadowGeo,
    wallMonolithGroundShadowMat
  );
  wallMonolithGroundShadow.visible = false;
  wallMonolithGroundShadow.frustumCulled = false;
  wallMonolithGroundShadow.renderOrder = 1;
  cityGroup.add(wallMonolithGroundShadow);

  cityGroup.add(wallHemiGroup);

  const obstacles: CityObstacleBox[] = [];
  const wallPlinthBox: CityObstacleBox = { minX: -6.8, maxX: 6.8, minZ: -2.8, maxZ: 2.8 };

  const updateSolarTimeScene = ({
    solarAltitudeDeg,
    lightVector3D,
    latitude,
    version,
    wallAzimuthDeg = null,
    floorAzimuthDeg = 0,
  }: SolarTimeUpdateParams) => {
    const isFloor = version === 'floor_horizontal';
    floorGroup.visible = isFloor;
    wallHemiGroup.visible = !isFloor;

    if (isFloor && obstacles.length > 0) {
      obstacles.length = 0;
    } else if (!isFloor && obstacles.length === 0) {
      obstacles.push(wallPlinthBox);
    }

    _sunVec.set(lightVector3D.x, lightVector3D.y, lightVector3D.z).normalize();

    if (isFloor) {
      wallMonolithGroundShadow.visible = false;
      const effFloorAz = ((floorAzimuthDeg % 360) + 360) % 360;
      floorDialRotator.rotation.y = -((effFloorAz * Math.PI) / 180);
      updateGnomonShadowRig(
        floorShadowRig,
        _sunVec.x,
        _sunVec.y,
        _sunVec.z,
        solarAltitudeDeg
      );
    } else {
      const tiltDeg =
        version === 'wall_vertical_90'
          ? 90
          : version === 'wall_tilted_675'
            ? 67.5
            : 45;
      const tiltRad = (tiltDeg * Math.PI) / 180;
      wallTiltPivot.rotation.x = tiltRad;

      const isSouthHemi = latitude < 0;
      const isManualAz = wallAzimuthDeg !== null && wallAzimuthDeg !== undefined;
      const effectiveAzDeg = isManualAz
        ? ((wallAzimuthDeg % 360) + 360) % 360
        : isSouthHemi
          ? 0
          : 180;
      const effectiveAzRad = (effectiveAzDeg * Math.PI) / 180;
      const rotY = Math.PI - effectiveAzRad;
      wallHemiGroup.rotation.y = rotY;

      // Update dynamic plinth obstacle AABB for Modo Pessoa collision at any 0°-360° angle
      const absCosY = Math.abs(Math.cos(rotY));
      const absSinY = Math.abs(Math.sin(rotY));
      const extX = 6.8 * absCosY + 2.8 * absSinY;
      const extZ = 6.8 * absSinY + 2.8 * absCosY;
      wallPlinthBox.minX = -extX;
      wallPlinthBox.maxX = extX;
      wallPlinthBox.minZ = -extZ;
      wallPlinthBox.maxZ = extZ;

      // Live-update plaque label when angle/tilt/mode changes
      const azLabelVal = Number.isInteger(effectiveAzDeg)
        ? `${effectiveAzDeg}°`
        : `${effectiveAzDeg.toFixed(1).replace('.', ',')}°`;
      const compassName = formatCompassLabel(effectiveAzDeg);
      const tiltLabel = tiltDeg === 67.5 ? '67,5°' : `${tiltDeg}°`;
      const plaqueKey = `${tiltLabel}|${azLabelVal}|${isManualAz ? 'M' : isSouthHemi ? 'S' : 'N'}`;
      if (plaqueKey !== lastPlaqueKey) {
        lastPlaqueKey = plaqueKey;
        const topLine = `PAREDE ${tiltLabel} · FACE ${azLabelVal} (${compassName})`;
        const subLine = isManualAz
          ? `ORIENTAÇÃO MANUAL LIVRE (0°–360°)`
          : isSouthHemi
            ? 'HEMISFÉRIO SUL (AUTO) · VIRADA P/ NORTE (0°)'
            : 'HEMISFÉRIO NORTE (AUTO) · VIRADA P/ SUL (180°)';
        drawWallSignCanvas(signCtx, topLine, subLine);
        dynamicSignTex.needsUpdate = true;
      }

      // Align clockwise/counter-clockwise dial sweep with whether wall faces mostly North vs South
      const facesNorthward = Math.cos(effectiveAzRad) >= 0;
      const targetWallDialTex = facesNorthward ? wallDialSouthHemiTex : wallDialNorthHemiTex;
      if (wallDialMat.map !== targetWallDialTex) {
        wallDialMat.map = targetWallDialTex;
        wallDialMat.emissiveMap = targetWallDialTex;
        wallDialMat.needsUpdate = true;
      }

      // Software WebGL fallback shadow of the entire wall slab rotated by arbitrary 0°-360° rotY
      if (isSoftwareGl && solarAltitudeDeg > 0.5 && _sunVec.y > 0.02) {
        wallMonolithGroundShadow.visible = true;
        const hFade = Math.min(1, (solarAltitudeDeg - 0.5) / 6);
        wallMonolithGroundShadowMat.opacity = 0.42 * hFade;

        const topZLocal = -11.9 * Math.cos(tiltRad);
        const topY = 0.9 + 11.9 * Math.sin(tiltRad);
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);

        const dropDist = Math.min(80, (topY - 0.036) / _sunVec.y);
        const shiftX = -_sunVec.x * dropDist;
        const shiftZ = -_sunVec.z * dropDist;

        const hw = 5.9;
        // Rotate base (-hw, 0), (+hw, 0) & top (-hw, topZLocal), (+hw, topZLocal) around Y by rotY
        const bxL = -hw * cosY;
        const bzL = hw * sinY;
        const bxR = hw * cosY;
        const bzR = -hw * sinY;

        const txR = hw * cosY + topZLocal * sinY + shiftX;
        const tzR = -hw * sinY + topZLocal * cosY + shiftZ;
        const txL = -hw * cosY + topZLocal * sinY + shiftX;
        const tzL = hw * sinY + topZLocal * cosY + shiftZ;

        const attr = wallMonolithGroundShadowGeo.attributes.position as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        arr[0] = bxL; arr[1] = 0.036; arr[2] = bzL;
        arr[3] = bxR; arr[4] = 0.036; arr[5] = bzR;
        arr[6] = txR; arr[7] = 0.036; arr[8] = tzR;
        arr[9] = txL; arr[10] = 0.036; arr[11] = tzL;
        attr.needsUpdate = true;
        wallMonolithGroundShadowGeo.computeBoundingSphere();
      } else {
        wallMonolithGroundShadow.visible = false;
      }

      // Transform world sun direction into wallAssembly local coordinate frame
      _sunVec.applyAxisAngle(_yAxis, -rotY).applyAxisAngle(_xAxis, -tiltRad);
      updateGnomonShadowRig(
        wallShadowRig,
        _sunVec.x,
        _sunVec.y,
        _sunVec.z,
        solarAltitudeDeg
      );
    }

    // Night illumination rules matching other maps (<= -3.0° plaza lamps & subtle backlit dial markings)
    const lampsOn = solarAltitudeDeg <= -3.0;
    const ramp = lampsOn ? Math.min(1, (-3.0 - solarAltitudeDeg) / 3.5 + 0.35) : 0;

    for (let i = 0; i < lampBulbs.length; i++) {
      lampBulbs[i].emissiveIntensity = lampsOn ? 2.4 * ramp : 0.0;
    }
    for (let i = 0; i < lampLights.length; i++) {
      lampLights[i].intensity = lampsOn ? 4.2 * ramp : 0.0;
    }

    const dialGlow = solarAltitudeDeg <= -3.0 ? 0.36 * ramp : 0.0;
    floorDialMat.emissiveIntensity = dialGlow;
    wallDialMat.emissiveIntensity = dialGlow;
  };

  const dispose = () => {
    disposableGeos.forEach((g) => g.dispose());
    disposableMats.forEach((m) => m.dispose());
    disposableTexs.forEach((t) => t.dispose());
  };

  return {
    cityGroup,
    obstacles,
    updateSolarTimeScene,
    dispose,
  };
}
