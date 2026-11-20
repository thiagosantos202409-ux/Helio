import * as THREE from 'three';

export interface CityObstacleBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type SignalColor = 'green' | 'yellow' | 'red';

export interface TrafficSignalState {
  ew: SignalColor; // Leste / Oeste
  ns: SignalColor; // Norte / Sul
}

export interface CitySceneHandle {
  cityGroup: THREE.Group;
  obstacles: CityObstacleBox[];
  updateCityState: (
    solarAltitudeDeg: number,
    elapsedSec: number,
    deltaSec: number
  ) => TrafficSignalState;
  dispose: () => void;
}

export type CityVariant = 'city_cars' | 'city_people';

interface BuildingSpec {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  styleIndex: number;
  hasSetback?: boolean;
  hasSpire?: boolean;
  hasAwning?: boolean;
  awningColor?: number;
}

type LaneDirection = 'N' | 'S' | 'E' | 'W';

interface CarInstance {
  group: THREE.Group;
  direction: LaneDirection;
  axis: 'ns' | 'ew';
  sign: 1 | -1;
  fixedCoord: number;
  pos: number;
  speed: number;
  maxSpeed: number;
  wheels: THREE.Mesh[];
  brakeMat: THREE.MeshStandardMaterial;
  stopLineAbs: number;
  loopHalfLen: number;
  laneKey: string;
}

interface PedestrianInstance {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  axis: 'ns' | 'ew';
  sign: 1 | -1;
  fixedCoord: number;
  pos: number;
  speed: number;
  walkPhase: number;
  loopHalfLen: number;
  crossZoneMin: number;
  crossZoneMax: number;
}

function createRoadAndSidewalkTexture(variant: CityVariant, maxAnisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const pxPerM = size / 140;
  const center = size / 2;
  const toPx = (m: number) => center + m * pxPerM;

  if (variant === 'city_cars') {
    // Base dark highway asphalt
    ctx.fillStyle = '#181d26';
    ctx.fillRect(0, 0, size, size);

    // Asphalt micro-grain
    for (let i = 0; i < 6500; i++) {
      const gx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const gy = (Math.sin(i * 78.233) * 24634.6345) % 1;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0.09)';
      ctx.fillRect(Math.abs(gx) * size, Math.abs(gy) * size, 2, 2);
    }

    // Double solid yellow center median on wide 4-lane highways (skip central intersection [-9.6..+9.6])
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.lineWidth = 2.4;
    for (const d of [-0.25, 0.25]) {
      ctx.beginPath();
      ctx.moveTo(toPx(d), 0);
      ctx.lineTo(toPx(d), toPx(-9.8));
      ctx.moveTo(toPx(d), toPx(9.8));
      ctx.lineTo(toPx(d), size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, toPx(d));
      ctx.lineTo(toPx(-9.8), toPx(d));
      ctx.moveTo(toPx(9.8), toPx(d));
      ctx.lineTo(size, toPx(d));
      ctx.stroke();
    }

    // White dashed lane dividers between inner & outer lanes at +-4.3m
    ctx.strokeStyle = 'rgba(241, 245, 249, 0.65)';
    ctx.lineWidth = 2.0;
    ctx.setLineDash([14, 14]);
    for (const laneSplit of [-4.3, 4.3]) {
      ctx.beginPath();
      ctx.moveTo(toPx(laneSplit), 0);
      ctx.lineTo(toPx(laneSplit), toPx(-9.8));
      ctx.moveTo(toPx(laneSplit), toPx(9.8));
      ctx.lineTo(toPx(laneSplit), size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, toPx(laneSplit));
      ctx.lineTo(toPx(-9.8), toPx(laneSplit));
      ctx.moveTo(toPx(9.8), toPx(laneSplit));
      ctx.lineTo(size, toPx(laneSplit));
      ctx.stroke();
    }

    // Outer shoulder solid curb lines at +-8.6m
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.55)';
    ctx.lineWidth = 2.5;
    for (const edge of [-8.6, 8.6]) {
      ctx.beginPath();
      ctx.moveTo(toPx(edge), 0);
      ctx.lineTo(toPx(edge), toPx(-9.2));
      ctx.moveTo(toPx(edge), toPx(9.2));
      ctx.lineTo(toPx(edge), size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, toPx(edge));
      ctx.lineTo(toPx(-9.2), toPx(edge));
      ctx.moveTo(toPx(9.2), toPx(edge));
      ctx.lineTo(size, toPx(edge));
      ctx.stroke();
    }

    // Secondary outer perimeter ring at +-42m
    ctx.strokeStyle = 'rgba(241, 245, 249, 0.25)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([10, 12]);
    for (const ring of [-42, 42]) {
      ctx.beginPath();
      ctx.moveTo(toPx(ring), 0);
      ctx.lineTo(toPx(ring), size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, toPx(ring));
      ctx.lineTo(size, toPx(ring));
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Yellow rotary safety ring around central gnomon
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center, center, 2.0 * pxPerM, 0, Math.PI * 2);
    ctx.stroke();

    // Stop bars behind crosswalks at +-11.6m
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(toPx(0.4), toPx(11.4), 7.9 * pxPerM, 0.4 * pxPerM);
    ctx.fillRect(toPx(-8.3), toPx(-11.8), 7.9 * pxPerM, 0.4 * pxPerM);
    ctx.fillRect(toPx(-11.8), toPx(0.4), 0.4 * pxPerM, 7.9 * pxPerM);
    ctx.fillRect(toPx(11.4), toPx(-8.3), 0.4 * pxPerM, 7.9 * pxPerM);

    // Wide Zebra crosswalks at +-10.0m
    ctx.fillStyle = 'rgba(248, 250, 252, 0.75)';
    for (const dir of [-1, 1]) {
      for (let s = -7.8; s <= 7.8; s += 1.35) {
        ctx.fillRect(toPx(s - 0.34), toPx(dir * 10.0 - 0.9), 0.68 * pxPerM, 1.8 * pxPerM);
        ctx.fillRect(toPx(dir * 10.0 - 0.9), toPx(s - 0.34), 1.8 * pxPerM, 0.68 * pxPerM);
      }
    }
  } else {
    // CIDADE DE PESSOAS: Warm Pedestrian Cobblestone Esplanades + Calm Perimeter Lanes at +-31m
    ctx.fillStyle = '#5a534a';
    ctx.fillRect(0, 0, size, size);

    // Cobblestone / paved plaza tile grid
    const tilePx = 2.0 * pxPerM;
    ctx.strokeStyle = 'rgba(28, 25, 23, 0.22)';
    ctx.lineWidth = 1.2;
    for (let x = 0; x <= size; x += tilePx) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    for (let y = 0; y <= size; y += tilePx) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }

    // Terracotta / Sandstone Mosaic Pedestrian Promenade Carpet along N-S and E-W axes (width 11m: [-5.5..+5.5])
    ctx.fillStyle = '#7c6552';
    ctx.fillRect(toPx(-5.5), 0, 11 * pxPerM, size);
    ctx.fillRect(0, toPx(-5.5), size, 11 * pxPerM);

    // Light sandstone trim lines framing the main pedestrian esplanade
    ctx.strokeStyle = 'rgba(245, 235, 220, 0.55)';
    ctx.lineWidth = 2.6;
    ctx.strokeRect(toPx(-5.5), 0, 11 * pxPerM, size);
    ctx.strokeRect(0, toPx(-5.5), size, 11 * pxPerM);

    // Central circular pedestrian plaza mosaic ring
    ctx.fillStyle = '#8b735b';
    ctx.beginPath();
    ctx.arc(center, center, 9.2 * pxPerM, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center, center, 9.2 * pxPerM, 0, Math.PI * 2);
    ctx.stroke();

    // Calm slow perimeter shuttle street at +-31m (narrow 5.6m asphalt strip)
    ctx.fillStyle = '#272c36';
    for (const roadCenter of [-31, 31]) {
      ctx.fillRect(toPx(roadCenter - 2.8), 0, 5.6 * pxPerM, size);
      ctx.fillRect(0, toPx(roadCenter - 2.8), size, 5.6 * pxPerM);
    }

    // Pedestrian crosswalks where promenades cross the +-31m calm ring lanes
    ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
    for (const roadCenter of [-31, 31]) {
      for (let s = -4.2; s <= 4.2; s += 1.2) {
        // Crossing N/S shuttle street along E/W promenade
        ctx.fillRect(toPx(roadCenter - 2.4), toPx(s - 0.3), 4.8 * pxPerM, 0.6 * pxPerM);
        // Crossing E/W shuttle street along N/S promenade
        ctx.fillRect(toPx(s - 0.3), toPx(roadCenter - 2.4), 0.6 * pxPerM, 4.8 * pxPerM);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createBuildingFacadeTextures(
  styleIndex: number,
  variant: CityVariant,
  maxAnisotropy: number
): { map: THREE.CanvasTexture; emissiveMap: THREE.CanvasTexture } {
  const w = 512;
  const h = 1024;

  const diffuseCanvas = document.createElement('canvas');
  diffuseCanvas.width = w;
  diffuseCanvas.height = h;
  const dctx = diffuseCanvas.getContext('2d')!;

  const emissiveCanvas = document.createElement('canvas');
  emissiveCanvas.width = w;
  emissiveCanvas.height = h;
  const ectx = emissiveCanvas.getContext('2d')!;

  const palettes =
    variant === 'city_cars'
      ? [
          { wall: '#283548', band: '#182230', glass: '#1e3a5f', mullion: '#475569' },
          { wall: '#334155', band: '#1e293b', glass: '#0f2940', mullion: '#64748b' },
          { wall: '#3f3f46', band: '#27272a', glass: '#1b3044', mullion: '#52525b' },
          { wall: '#2e3846', band: '#1a202c', glass: '#16334a', mullion: '#4a5568' },
        ]
      : [
          { wall: '#7c5d4c', band: '#5b4235', glass: '#243447', mullion: '#9a7b69' },
          { wall: '#8a7968', band: '#66584b', glass: '#1f2d3d', mullion: '#a89685' },
          { wall: '#6e5c55', band: '#4f413b', glass: '#253240', mullion: '#8c7870' },
          { wall: '#736552', band: '#54493a', glass: '#1d2b38', mullion: '#91816a' },
        ];
  const p = palettes[styleIndex % palettes.length];

  dctx.fillStyle = p.wall;
  dctx.fillRect(0, 0, w, h);

  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, w, h);

  const cols = variant === 'city_cars' ? (styleIndex % 2 === 0 ? 8 : 6) : 5;
  const rows = variant === 'city_cars' ? 18 : 12;
  const padX = w * 0.08;
  const padY = h * 0.04;
  const cellW = (w - padX * 2) / cols;
  const cellH = (h - padY * 2) / rows;
  const winW = cellW * 0.64;
  const winH = cellH * 0.6;

  for (let r = 0; r < rows; r++) {
    dctx.fillStyle = p.band;
    dctx.fillRect(0, padY + r * cellH + winH + 4, w, Math.max(4, cellH - winH - 2));

    for (let c = 0; c < cols; c++) {
      const wx = padX + c * cellW + (cellW - winW) * 0.5;
      const wy = padY + r * cellH;

      dctx.fillStyle = p.glass;
      dctx.fillRect(wx, wy, winW, winH);

      dctx.strokeStyle = p.mullion;
      dctx.lineWidth = 2;
      dctx.strokeRect(wx, wy, winW, winH);

      const seed =
        Math.abs(Math.sin((styleIndex + 1) * 91.7 + r * 17.3 + c * 43.1) * 43758.5453) % 1;
      if (seed < 0.74) {
        if (seed < 0.36) {
          ectx.fillStyle = '#ffcf75';
        } else if (seed < 0.58) {
          ectx.fillStyle = '#fff0c4';
        } else {
          ectx.fillStyle = variant === 'city_cars' ? '#a5e1ff' : '#ffe4a8';
        }
        ectx.fillRect(wx + 2, wy + 2, winW - 4, winH - 4);
      }
    }
  }

  const map = new THREE.CanvasTexture(diffuseCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.anisotropy = maxAnisotropy;

  return { map, emissiveMap };
}

export function buildCityScene(
  variant: CityVariant,
  maxAnisotropy: number,
  isSoftwareGl: boolean
): CitySceneHandle {
  const isCarsCity = variant === 'city_cars';
  const cityGroup = new THREE.Group();
  cityGroup.name = isCarsCity ? 'cityCarsSceneGroup' : 'cityPeopleSceneGroup';

  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const materialsToDispose: THREE.Material[] = [];
  const texturesToDispose: THREE.Texture[] = [];
  const obstacles: CityObstacleBox[] = [];

  // 1. Urban Ground Plane (140m x 140m)
  const roadTex = createRoadAndSidewalkTexture(variant, maxAnisotropy);
  texturesToDispose.push(roadTex);

  const groundGeo = new THREE.PlaneGeometry(140, 140);
  const groundMat = new THREE.MeshStandardMaterial({
    map: roadTex,
    roughness: isCarsCity ? 0.88 : 0.82,
    metalness: isCarsCity ? 0.08 : 0.04,
  });
  geometriesToDispose.push(groundGeo);
  materialsToDispose.push(groundMat);

  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  cityGroup.add(groundMesh);

  // 2. Block Platforms & Pedestrian Zone Details
  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: isCarsCity ? 0x334155 : 0x7a7064,
    roughness: 0.84,
    metalness: 0.06,
  });
  materialsToDispose.push(sidewalkMat);

  if (isCarsCity) {
    // 4 inner urban sidewalk blocks pushed outward to +-22m to give room for wide 4-lane highways
    const blockGeo = new THREE.BoxGeometry(20, 0.1, 20);
    geometriesToDispose.push(blockGeo);
    const quadrantCoords: Array<[number, number]> = [
      [-21, -21],
      [21, -21],
      [-21, 21],
      [21, 21],
    ];
    quadrantCoords.forEach(([qx, qz]) => {
      const sidewalk = new THREE.Mesh(blockGeo, sidewalkMat);
      sidewalk.position.set(qx, 0.05, qz);
      sidewalk.receiveShadow = true;
      cityGroup.add(sidewalk);
    });

    // Highway steel median guardrails separating N/S and E/W corridors outside intersection
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.72,
      roughness: 0.35,
    });
    const railPostMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.6,
      roughness: 0.45,
    });
    materialsToDispose.push(railMat, railPostMat);

    const railBeamGeo = new THREE.BoxGeometry(0.14, 0.24, 38);
    const railPostGeo = new THREE.BoxGeometry(0.12, 0.62, 0.12);
    geometriesToDispose.push(railBeamGeo, railPostGeo);

    [
      { x: 0, z: -32, rotY: 0 },
      { x: 0, z: 32, rotY: 0 },
      { x: -32, z: 0, rotY: Math.PI / 2 },
      { x: 32, z: 0, rotY: Math.PI / 2 },
    ].forEach(({ x, z, rotY }) => {
      const rGroup = new THREE.Group();
      rGroup.position.set(x, 0, z);
      rGroup.rotation.y = rotY;
      const beam = new THREE.Mesh(railBeamGeo, railMat);
      beam.position.y = 0.52;
      rGroup.add(beam);
      for (let p = -18; p <= 18; p += 4.5) {
        const post = new THREE.Mesh(railPostGeo, railPostMat);
        post.position.set(0, 0.31, p);
        rGroup.add(post);
      }
      cityGroup.add(rGroup);
    });
  } else {
    // CIDADE DE PESSOAS: Slightly raised cozy block terraces framing the wide pedestrian promenades
    const blockGeo = new THREE.BoxGeometry(19, 0.08, 19);
    geometriesToDispose.push(blockGeo);
    const quadrantCoords: Array<[number, number]> = [
      [-17.5, -17.5],
      [17.5, -17.5],
      [-17.5, 17.5],
      [17.5, 17.5],
    ];
    quadrantCoords.forEach(([qx, qz]) => {
      const terrace = new THREE.Mesh(blockGeo, sidewalkMat);
      terrace.position.set(qx, 0.04, qz);
      terrace.receiveShadow = true;
      cityGroup.add(terrace);
    });
  }

  // 3. Central Urban Solar Island (Gnomon at 0,0,0)
  const plazaGroup = new THREE.Group();
  const islandRadius = isCarsCity ? 1.75 : 2.35;
  const plazaSlabGeo = new THREE.CylinderGeometry(islandRadius - 0.15, islandRadius, 0.12, 24);
  const plazaMat = new THREE.MeshStandardMaterial({
    color: isCarsCity ? 0x475569 : 0x78685a,
    roughness: 0.58,
    metalness: 0.12,
  });
  const plinthGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.34, 20);
  const marbleMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.3,
    metalness: 0.1,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.85,
    roughness: 0.25,
  });
  const gnomonRodGeo = new THREE.CylinderGeometry(0.055, 0.085, 2.1, 12);
  geometriesToDispose.push(plazaSlabGeo, plinthGeo, gnomonRodGeo);
  materialsToDispose.push(plazaMat, marbleMat, brassMat);

  const plazaSlab = new THREE.Mesh(plazaSlabGeo, plazaMat);
  plazaSlab.position.y = 0.06;
  plazaSlab.receiveShadow = true;
  plazaGroup.add(plazaSlab);

  const plinthMesh = new THREE.Mesh(plinthGeo, marbleMat);
  plinthMesh.position.y = 0.26;
  plinthMesh.castShadow = true;
  plinthMesh.receiveShadow = true;
  plazaGroup.add(plinthMesh);

  const gnomonRod = new THREE.Mesh(gnomonRodGeo, brassMat);
  gnomonRod.position.set(0, 1.2, -0.42);
  gnomonRod.rotation.x = Math.PI / 4;
  gnomonRod.castShadow = true;
  plazaGroup.add(gnomonRod);

  const tickGeo = new THREE.BoxGeometry(0.2, 0.08, 0.34);
  geometriesToDispose.push(tickGeo);
  [
    { ang: 0, col: 0xef4444 },
    { ang: 90, col: 0x3b82f6 },
    { ang: 180, col: 0x10b981 },
    { ang: 270, col: 0xf59e0b },
  ].forEach(({ ang, col }) => {
    const rad = (ang * Math.PI) / 180;
    const tMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.5 });
    materialsToDispose.push(tMat);
    const tick = new THREE.Mesh(tickGeo, tMat);
    tick.position.set(Math.sin(rad) * (islandRadius - 0.32), 0.16, -Math.cos(rad) * (islandRadius - 0.32));
    tick.rotation.y = rad;
    plazaGroup.add(tick);
  });
  cityGroup.add(plazaGroup);
  obstacles.push({
    minX: -islandRadius,
    maxX: islandRadius,
    minZ: -islandRadius,
    maxZ: islandRadius,
  });

  // 4. Streetlamp Poles (Postes - turn on at Solar Altitude <= -3.0 deg)
  const poleIronMat = new THREE.MeshStandardMaterial({
    color: isCarsCity ? 0x1e293b : 0x292524,
    metalness: 0.78,
    roughness: 0.38,
  });
  const poleBulbMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    emissive: new THREE.Color(isCarsCity ? 0xffc864 : 0xffb84d),
    emissiveIntensity: 0.0,
    roughness: 0.2,
    metalness: 0.1,
  });
  const poleConeMat = new THREE.MeshBasicMaterial({
    color: 0xffd275,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const poleGroundPoolMat = new THREE.MeshBasicMaterial({
    color: 0xffbe55,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  materialsToDispose.push(poleIronMat, poleBulbMat, poleConeMat, poleGroundPoolMat);

  const lampBaseGeo = new THREE.CylinderGeometry(0.18, 0.24, 0.5, 8);
  const lampShaftGeo = new THREE.CylinderGeometry(0.06, 0.09, isCarsCity ? 4.3 : 3.3, 10);
  const lampArmGeo = new THREE.BoxGeometry(0.08, 0.08, isCarsCity ? 1.25 : 0.65);
  const lampHoodGeo = new THREE.CylinderGeometry(0.2, 0.28, 0.16, 12);
  const lampBulbGeo = new THREE.SphereGeometry(isCarsCity ? 0.16 : 0.22, 12, 10);
  const lampConeGeo = new THREE.ConeGeometry(1.6, 3.8, 14, 1, true);
  const lampPoolGeo = new THREE.CircleGeometry(2.4, 20);
  geometriesToDispose.push(
    lampBaseGeo,
    lampShaftGeo,
    lampArmGeo,
    lampHoodGeo,
    lampBulbGeo,
    lampConeGeo,
    lampPoolGeo
  );

  const lampCones: THREE.Mesh[] = [];
  const lampPools: THREE.Mesh[] = [];

  const streetLampPositions: Array<{ x: number; z: number; rotY: number }> = isCarsCity
    ? [
        { x: -10.8, z: -10.8, rotY: Math.PI * 0.25 },
        { x: 10.8, z: -10.8, rotY: -Math.PI * 0.25 },
        { x: -10.8, z: 10.8, rotY: Math.PI * 0.75 },
        { x: 10.8, z: 10.8, rotY: -Math.PI * 0.75 },
        { x: -10.2, z: -18, rotY: Math.PI * 0.5 },
        { x: 10.2, z: -18, rotY: -Math.PI * 0.5 },
        { x: -10.2, z: 18, rotY: Math.PI * 0.5 },
        { x: 10.2, z: 18, rotY: -Math.PI * 0.5 },
        { x: -18, z: -10.2, rotY: 0 },
        { x: -18, z: 10.2, rotY: Math.PI },
        { x: 18, z: -10.2, rotY: 0 },
        { x: 18, z: 10.2, rotY: Math.PI },
        { x: -10.2, z: -29, rotY: Math.PI * 0.5 },
        { x: 10.2, z: -29, rotY: -Math.PI * 0.5 },
        { x: -10.2, z: 29, rotY: Math.PI * 0.5 },
        { x: 10.2, z: 29, rotY: -Math.PI * 0.5 },
      ]
    : [
        // Cozy human-scale pedestrian globe streetlamps flanking central esplanade & plazas
        { x: -6.2, z: -6.2, rotY: Math.PI * 0.25 },
        { x: 6.2, z: -6.2, rotY: -Math.PI * 0.25 },
        { x: -6.2, z: 6.2, rotY: Math.PI * 0.75 },
        { x: 6.2, z: 6.2, rotY: -Math.PI * 0.75 },
        { x: -6.0, z: -13, rotY: Math.PI * 0.5 },
        { x: 6.0, z: -13, rotY: -Math.PI * 0.5 },
        { x: -6.0, z: -22, rotY: Math.PI * 0.5 },
        { x: 6.0, z: -22, rotY: -Math.PI * 0.5 },
        { x: -6.0, z: 13, rotY: Math.PI * 0.5 },
        { x: 6.0, z: 13, rotY: -Math.PI * 0.5 },
        { x: -6.0, z: 22, rotY: Math.PI * 0.5 },
        { x: 6.0, z: 22, rotY: -Math.PI * 0.5 },
        { x: -13, z: -6.0, rotY: 0 },
        { x: -13, z: 6.0, rotY: Math.PI },
        { x: 13, z: -6.0, rotY: 0 },
        { x: 13, z: 6.0, rotY: Math.PI },
      ];

  streetLampPositions.forEach(({ x, z, rotY }) => {
    const poleGroup = new THREE.Group();
    poleGroup.position.set(x, 0.08, z);
    poleGroup.rotation.y = rotY;

    const base = new THREE.Mesh(lampBaseGeo, poleIronMat);
    base.position.y = 0.25;
    base.castShadow = !isSoftwareGl;
    poleGroup.add(base);

    const poleH = isCarsCity ? 4.3 : 3.3;
    const shaft = new THREE.Mesh(lampShaftGeo, poleIronMat);
    shaft.position.y = 0.5 + poleH * 0.5;
    shaft.castShadow = !isSoftwareGl;
    poleGroup.add(shaft);

    if (isCarsCity) {
      const arm = new THREE.Mesh(lampArmGeo, poleIronMat);
      arm.position.set(0, poleH + 0.35, 0.55);
      poleGroup.add(arm);

      const hood = new THREE.Mesh(lampHoodGeo, poleIronMat);
      hood.position.set(0, poleH + 0.28, 1.05);
      poleGroup.add(hood);

      const bulb = new THREE.Mesh(lampBulbGeo, poleBulbMat);
      bulb.position.set(0, poleH + 0.18, 1.05);
      poleGroup.add(bulb);

      const cone = new THREE.Mesh(lampConeGeo, poleConeMat);
      cone.position.set(0, 2.25, 1.05);
      cone.visible = false;
      poleGroup.add(cone);
      lampCones.push(cone);

      const pool = new THREE.Mesh(lampPoolGeo, poleGroundPoolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(0, 0.03, 1.05);
      pool.visible = false;
      poleGroup.add(pool);
      lampPools.push(pool);
    } else {
      // Pedestrian vintage globe lantern atop shaft
      const bulb = new THREE.Mesh(lampBulbGeo, poleBulbMat);
      bulb.position.set(0, poleH + 0.62, 0);
      poleGroup.add(bulb);

      const cone = new THREE.Mesh(lampConeGeo, poleConeMat);
      cone.position.set(0, 1.9, 0);
      cone.visible = false;
      poleGroup.add(cone);
      lampCones.push(cone);

      const pool = new THREE.Mesh(lampPoolGeo, poleGroundPoolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(0, 0.03, 0);
      pool.visible = false;
      poleGroup.add(pool);
      lampPools.push(pool);
    }

    cityGroup.add(poleGroup);
    obstacles.push({
      minX: x - 0.32,
      maxX: x + 0.32,
      minZ: z - 0.32,
      maxZ: z + 0.32,
    });
  });

  const streetPointLights: THREE.PointLight[] = [];
  const streetLightSpots: Array<[number, number, number]> = [
    [0, 4.5, 0],
    [0, 4.2, -16],
    [0, 4.2, 16],
    [-16, 4.2, 0],
    [16, 4.2, 0],
  ];
  streetLightSpots.forEach(([lx, ly, lz]) => {
    const pt = new THREE.PointLight(0xffc966, 0, 25, 1.7);
    pt.position.set(lx, ly, lz);
    cityGroup.add(pt);
    streetPointLights.push(pt);
  });

  // =========================================================================
  // 5. TRAFFIC LIGHTS (SEMÁFOROS) - E/W Verde -> N/S Vermelho + Amarelo
  // =========================================================================
  const trafficHousingMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.45,
    roughness: 0.5,
  });
  const trafficMastMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.78,
    roughness: 0.35,
  });

  const makeLensMat = (colorHex: number) =>
    new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: new THREE.Color(colorHex),
      emissiveIntensity: 0.05,
      roughness: 0.25,
      metalness: 0.1,
    });

  const ewRedMat = makeLensMat(0xef4444);
  const ewYellowMat = makeLensMat(0xfacc15);
  const ewGreenMat = makeLensMat(0x22c55e);

  const nsRedMat = makeLensMat(0xef4444);
  const nsYellowMat = makeLensMat(0xfacc15);
  const nsGreenMat = makeLensMat(0x22c55e);

  materialsToDispose.push(
    trafficHousingMat,
    trafficMastMat,
    ewRedMat,
    ewYellowMat,
    ewGreenMat,
    nsRedMat,
    nsYellowMat,
    nsGreenMat
  );

  const tlMastBaseGeo = new THREE.CylinderGeometry(0.19, 0.24, 0.42, 10);
  const tlMastPoleGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.9, 10);
  const tlArmGeo = new THREE.BoxGeometry(0.09, 0.09, isCarsCity ? 2.8 : 2.1);
  const tlBoxGeo = new THREE.BoxGeometry(0.38, 1.06, 0.38);
  const tlLensGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.42, 14);
  geometriesToDispose.push(tlMastBaseGeo, tlMastPoleGeo, tlArmGeo, tlBoxGeo, tlLensGeo);

  const createSignalHead = (axis: 'ew' | 'ns'): THREE.Group => {
    const head = new THREE.Group();
    const housing = new THREE.Mesh(tlBoxGeo, trafficHousingMat);
    housing.castShadow = !isSoftwareGl;
    head.add(housing);

    const redMat = axis === 'ew' ? ewRedMat : nsRedMat;
    const yelMat = axis === 'ew' ? ewYellowMat : nsYellowMat;
    const grnMat = axis === 'ew' ? ewGreenMat : nsGreenMat;

    [
      { y: 0.31, mat: redMat },
      { y: 0.0, mat: yelMat },
      { y: -0.31, mat: grnMat },
    ].forEach(({ y, mat }) => {
      const lens = new THREE.Mesh(tlLensGeo, mat);
      lens.position.set(0, y, 0);
      lens.rotation.x = Math.PI / 2;
      head.add(lens);
    });

    if (axis === 'ew') head.rotation.y = Math.PI / 2;
    return head;
  };

  if (isCarsCity) {
    const trafficCorners = [
      { x: -9.5, z: -9.5, armDirX: 1, armDirZ: 1 },
      { x: 9.5, z: -9.5, armDirX: -1, armDirZ: 1 },
      { x: -9.5, z: 9.5, armDirX: 1, armDirZ: -1 },
      { x: 9.5, z: 9.5, armDirX: -1, armDirZ: -1 },
    ];
    trafficCorners.forEach(({ x, z, armDirX, armDirZ }) => {
      const tlGroup = new THREE.Group();
      tlGroup.position.set(x, 0, z);

      const base = new THREE.Mesh(tlMastBaseGeo, trafficMastMat);
      base.position.y = 0.21;
      tlGroup.add(base);

      const pole = new THREE.Mesh(tlMastPoleGeo, trafficMastMat);
      pole.position.y = 2.65;
      pole.castShadow = !isSoftwareGl;
      tlGroup.add(pole);

      const nsArm = new THREE.Mesh(tlArmGeo, trafficMastMat);
      nsArm.rotation.y = Math.PI / 2;
      nsArm.position.set(armDirX * 1.4, 4.85, 0);
      tlGroup.add(nsArm);

      const nsHead = createSignalHead('ns');
      nsHead.position.set(armDirX * 2.4, 4.3, 0);
      tlGroup.add(nsHead);

      const ewArm = new THREE.Mesh(tlArmGeo, trafficMastMat);
      ewArm.position.set(0, 4.85, armDirZ * 1.4);
      tlGroup.add(ewArm);

      const ewHead = createSignalHead('ew');
      ewHead.position.set(0, 4.3, armDirZ * 2.4);
      tlGroup.add(ewHead);

      cityGroup.add(tlGroup);
      obstacles.push({ minX: x - 0.35, maxX: x + 0.35, minZ: z - 0.35, maxZ: z + 0.35 });
    });
  } else {
    // Pedestrian / Calm Shuttle Crossings at +-27.2m along both promenades
    const pedCrossingSignals: Array<{ x: number; z: number; axis: 'ew' | 'ns' }> = [
      { x: -5.8, z: -27.2, axis: 'ew' },
      { x: 5.8, z: 27.2, axis: 'ew' },
      { x: -27.2, z: -5.8, axis: 'ns' },
      { x: 27.2, z: 5.8, axis: 'ns' },
    ];
    pedCrossingSignals.forEach(({ x, z, axis }) => {
      const tlGroup = new THREE.Group();
      tlGroup.position.set(x, 0, z);

      const base = new THREE.Mesh(tlMastBaseGeo, trafficMastMat);
      base.position.y = 0.21;
      tlGroup.add(base);

      const pole = new THREE.Mesh(tlMastPoleGeo, trafficMastMat);
      pole.position.y = 2.2;
      pole.scale.set(0.85, 0.85, 0.85);
      tlGroup.add(pole);

      const head = createSignalHead(axis);
      head.position.set(0, 3.85, 0);
      tlGroup.add(head);

      cityGroup.add(tlGroup);
      obstacles.push({ minX: x - 0.35, maxX: x + 0.35, minZ: z - 0.35, maxZ: z + 0.35 });
    });
  }

  // =========================================================================
  // 6. ANIMATED COMPOSITE 3D CARS (CARROS)
  // =========================================================================
  const carPaintColors = [0xdc2626, 0x2563eb, 0xf8fafc, 0xf59e0b, 0x10b981, 0x475569, 0x7c3aed];
  const carBodyMaterials = carPaintColors.map((col) => {
    const mat = new THREE.MeshStandardMaterial({
      color: col,
      metalness: 0.55,
      roughness: 0.28,
    });
    materialsToDispose.push(mat);
    return mat;
  });

  const carGlassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.85,
    roughness: 0.12,
  });
  const carTireMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.9,
    metalness: 0.05,
  });
  const carRimMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.85,
    roughness: 0.25,
  });
  const carHeadlightMat = new THREE.MeshStandardMaterial({
    color: 0xfffbeb,
    emissive: new THREE.Color(0xfff3c4),
    emissiveIntensity: 0.4,
    roughness: 0.2,
  });
  materialsToDispose.push(carGlassMat, carTireMat, carRimMat, carHeadlightMat);

  const carChassisGeo = new THREE.BoxGeometry(1.54, 0.54, 3.28);
  const carCabinGeo = new THREE.BoxGeometry(1.32, 0.46, 1.72);
  const carWheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12);
  const carHubGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.24, 10);
  const carLightGeo = new THREE.BoxGeometry(0.28, 0.13, 0.08);
  geometriesToDispose.push(carChassisGeo, carCabinGeo, carWheelGeo, carHubGeo, carLightGeo);

  const cars: CarInstance[] = [];

  const createCarMesh = (
    paintIdx: number,
    direction: LaneDirection,
    laneOffset: number,
    initialPos: number,
    maxSpeed: number,
    stopLineAbs: number
  ) => {
    const carGroup = new THREE.Group();
    const bodyMat = carBodyMaterials[paintIdx % carBodyMaterials.length];
    const brakeMat = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      emissive: new THREE.Color(0xff1e1e),
      emissiveIntensity: 0.35,
      roughness: 0.25,
    });
    materialsToDispose.push(brakeMat);

    const chassis = new THREE.Mesh(carChassisGeo, bodyMat);
    chassis.position.y = 0.52;
    chassis.castShadow = !isSoftwareGl;
    chassis.receiveShadow = true;
    carGroup.add(chassis);

    const cabin = new THREE.Mesh(carCabinGeo, carGlassMat);
    cabin.position.set(0, 1.0, -0.15);
    cabin.castShadow = !isSoftwareGl;
    carGroup.add(cabin);

    const wheels: THREE.Mesh[] = [];
    [
      [-0.78, 1.0],
      [0.78, 1.0],
      [-0.78, -1.0],
      [0.78, -1.0],
    ].forEach(([wx, wz]) => {
      const wheel = new THREE.Mesh(carWheelGeo, carTireMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.32, wz);
      carGroup.add(wheel);
      wheels.push(wheel);

      const hub = new THREE.Mesh(carHubGeo, carRimMat);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(wx, 0.32, wz);
      carGroup.add(hub);
    });

    [-0.5, 0.5].forEach((lx) => {
      const hl = new THREE.Mesh(carLightGeo, carHeadlightMat);
      hl.position.set(lx, 0.54, 1.65);
      carGroup.add(hl);
    });

    [-0.5, 0.5].forEach((lx) => {
      const tl = new THREE.Mesh(carLightGeo, brakeMat);
      tl.position.set(lx, 0.56, -1.65);
      carGroup.add(tl);
    });

    let axis: 'ns' | 'ew' = 'ns';
    let sign: 1 | -1 = 1;

    if (direction === 'S') {
      axis = 'ns';
      sign = 1;
      carGroup.rotation.y = 0;
      carGroup.position.set(laneOffset, 0, initialPos);
    } else if (direction === 'N') {
      axis = 'ns';
      sign = -1;
      carGroup.rotation.y = Math.PI;
      carGroup.position.set(laneOffset, 0, initialPos);
    } else if (direction === 'E') {
      axis = 'ew';
      sign = 1;
      carGroup.rotation.y = Math.PI / 2;
      carGroup.position.set(initialPos, 0, laneOffset);
    } else {
      axis = 'ew';
      sign = -1;
      carGroup.rotation.y = -Math.PI / 2;
      carGroup.position.set(initialPos, 0, laneOffset);
    }

    cityGroup.add(carGroup);
    cars.push({
      group: carGroup,
      direction,
      axis,
      sign,
      fixedCoord: laneOffset,
      pos: initialPos,
      speed: maxSpeed * 0.7,
      maxSpeed,
      wheels,
      brakeMat,
      stopLineAbs,
      loopHalfLen: 60,
      laneKey: `${direction}_${laneOffset.toFixed(1)}`,
    });
  };

  if (isCarsCity) {
    // 18 Carros distributed across dual N/S & E/W highway lanes (+-2.5m inner & +-6.2m outer)
    const carSpawns: Array<{ dir: LaneDirection; lane: number; pos: number; speed: number; paint: number }> = [
      // Eastbound (+X, +Z side: +2.5 & +6.2)
      { dir: 'E', lane: 2.5, pos: -18, speed: 12.0, paint: 0 },
      { dir: 'E', lane: 2.5, pos: -40, speed: 11.4, paint: 2 },
      { dir: 'E', lane: 2.5, pos: 26, speed: 12.2, paint: 6 },
      { dir: 'E', lane: 6.2, pos: -26, speed: 9.8, paint: 3 },
      { dir: 'E', lane: 6.2, pos: 34, speed: 9.5, paint: 4 },
      // Westbound (-X, -Z side: -2.5 & -6.2)
      { dir: 'W', lane: -2.5, pos: 18, speed: 11.8, paint: 1 },
      { dir: 'W', lane: -2.5, pos: 41, speed: 11.2, paint: 4 },
      { dir: 'W', lane: -2.5, pos: -27, speed: 12.0, paint: 5 },
      { dir: 'W', lane: -6.2, pos: 28, speed: 9.6, paint: 0 },
      // Southbound (+Z, -X side: -2.5 & -6.2)
      { dir: 'S', lane: -2.5, pos: -17, speed: 11.6, paint: 3 },
      { dir: 'S', lane: -2.5, pos: -39, speed: 11.0, paint: 1 },
      { dir: 'S', lane: -2.5, pos: 28, speed: 11.9, paint: 2 },
      { dir: 'S', lane: -6.2, pos: -29, speed: 9.4, paint: 6 },
      { dir: 'S', lane: -6.2, pos: 36, speed: 9.7, paint: 5 },
      // Northbound (-Z, +X side: +2.5 & +6.2)
      { dir: 'N', lane: 2.5, pos: 19, speed: 11.7, paint: 2 },
      { dir: 'N', lane: 2.5, pos: 42, speed: 11.3, paint: 5 },
      { dir: 'N', lane: 2.5, pos: -24, speed: 12.1, paint: 0 },
      { dir: 'N', lane: 6.2, pos: 30, speed: 9.5, paint: 1 },
    ];
    carSpawns.forEach((s) => createCarMesh(s.paint, s.dir, s.lane, s.pos, s.speed, 11.8));
  } else {
    // Cidade De Pessoas: Calm slow electric shuttles on perimeter +-31m streets (6 shuttles)
    const shuttleSpawns: Array<{ dir: LaneDirection; lane: number; pos: number; speed: number; paint: number }> = [
      { dir: 'E', lane: 32.3, pos: -22, speed: 6.2, paint: 2 },
      { dir: 'W', lane: -32.3, pos: 24, speed: 6.0, paint: 4 },
      { dir: 'S', lane: -32.3, pos: -20, speed: 6.1, paint: 1 },
      { dir: 'N', lane: 32.3, pos: 20, speed: 6.3, paint: 3 },
      { dir: 'E', lane: -29.7, pos: 18, speed: 5.8, paint: 0 },
      { dir: 'N', lane: -29.7, pos: -18, speed: 5.9, paint: 2 },
    ];
    shuttleSpawns.forEach((s) => createCarMesh(s.paint, s.dir, s.lane, s.pos, s.speed, 6.4));
  }

  // =========================================================================
  // 7. ANIMATED 3D PEDESTRIANS + CAFÉS + BENCHES (CIDADE DE PESSOAS)
  // =========================================================================
  const pedestrians: PedestrianInstance[] = [];

  if (!isCarsCity) {
    // Pedestrian skin, hair & clothing materials
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe6b89c, roughness: 0.72 });
    const trouserMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
    const shirtColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0xec4899, 0xf8fafc, 0x8b5cf6];
    const shirtMats = shirtColors.map((col) => {
      const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.78 });
      materialsToDispose.push(m);
      return m;
    });
    materialsToDispose.push(skinMat, trouserMat);

    const headGeo = new THREE.SphereGeometry(0.16, 10, 10);
    const torsoGeo = new THREE.BoxGeometry(0.38, 0.56, 0.22);
    const legGeo = new THREE.BoxGeometry(0.14, 0.62, 0.16);
    const armGeo = new THREE.BoxGeometry(0.11, 0.48, 0.12);
    geometriesToDispose.push(headGeo, torsoGeo, legGeo, armGeo);

    const addPedestrian = (
      axis: 'ns' | 'ew',
      sign: 1 | -1,
      fixedCoord: number,
      pos: number,
      speed: number,
      shirtIdx: number
    ) => {
      const pGroup = new THREE.Group();
      const torso = new THREE.Mesh(torsoGeo, shirtMats[shirtIdx % shirtMats.length]);
      torso.position.y = 0.94;
      torso.castShadow = !isSoftwareGl;
      pGroup.add(torso);

      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.y = 1.42;
      head.castShadow = !isSoftwareGl;
      pGroup.add(head);

      const leftLeg = new THREE.Mesh(legGeo, trouserMat);
      leftLeg.position.set(-0.1, 0.34, 0);
      pGroup.add(leftLeg);

      const rightLeg = new THREE.Mesh(legGeo, trouserMat);
      rightLeg.position.set(0.1, 0.34, 0);
      pGroup.add(rightLeg);

      const leftArm = new THREE.Mesh(armGeo, shirtMats[shirtIdx % shirtMats.length]);
      leftArm.position.set(-0.26, 0.92, 0);
      pGroup.add(leftArm);

      const rightArm = new THREE.Mesh(armGeo, shirtMats[shirtIdx % shirtMats.length]);
      rightArm.position.set(0.26, 0.92, 0);
      pGroup.add(rightArm);

      if (axis === 'ns') {
        pGroup.rotation.y = sign === 1 ? 0 : Math.PI;
        pGroup.position.set(fixedCoord, 0, pos);
      } else {
        pGroup.rotation.y = sign === 1 ? Math.PI / 2 : -Math.PI / 2;
        pGroup.position.set(pos, 0, fixedCoord);
      }

      cityGroup.add(pGroup);
      pedestrians.push({
        group: pGroup,
        leftLeg,
        rightLeg,
        leftArm,
        rightArm,
        axis,
        sign,
        fixedCoord,
        pos,
        speed,
        walkPhase: Math.abs(pos) * 0.7,
        loopHalfLen: 46,
        crossZoneMin: 27.5,
        crossZoneMax: 34.5,
      });
    };

    const pedConfigs: Array<{ axis: 'ns' | 'ew'; sign: 1 | -1; coord: number; pos: number; speed: number; shirt: number }> = [
      { axis: 'ns', sign: 1, coord: -3.2, pos: -22, speed: 1.55, shirt: 0 },
      { axis: 'ns', sign: 1, coord: -1.8, pos: 8, speed: 1.45, shirt: 1 },
      { axis: 'ns', sign: -1, coord: 2.2, pos: 20, speed: 1.65, shirt: 2 },
      { axis: 'ns', sign: -1, coord: 3.6, pos: -12, speed: 1.5, shirt: 3 },
      { axis: 'ns', sign: 1, coord: -4.1, pos: 34, speed: 1.4, shirt: 4 },
      { axis: 'ns', sign: -1, coord: 1.6, pos: -32, speed: 1.6, shirt: 5 },
      { axis: 'ew', sign: 1, coord: 2.4, pos: -19, speed: 1.5, shirt: 6 },
      { axis: 'ew', sign: 1, coord: 3.8, pos: 11, speed: 1.6, shirt: 0 },
      { axis: 'ew', sign: -1, coord: -2.2, pos: 22, speed: 1.45, shirt: 1 },
      { axis: 'ew', sign: -1, coord: -3.7, pos: -11, speed: 1.55, shirt: 2 },
      { axis: 'ew', sign: 1, coord: 1.5, pos: -34, speed: 1.5, shirt: 3 },
      { axis: 'ew', sign: -1, coord: -1.5, pos: 33, speed: 1.6, shirt: 4 },
      { axis: 'ns', sign: 1, coord: 4.1, pos: -4, speed: 1.35, shirt: 5 },
      { axis: 'ew', sign: 1, coord: -3.9, pos: -5, speed: 1.4, shirt: 6 },
    ];
    pedConfigs.forEach((p) => addPedestrian(p.axis, p.sign, p.coord, p.pos, p.speed, p.shirt));

    // Park Benches & Outdoor Café Bistro Umbrellas on the pedestrian plazas
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7c4a2d, roughness: 0.85 });
    const umbrellaPoleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.35 });
    const umbrellaCanopyColors = [0xd97706, 0x059669, 0xdc2626, 0x0284c7];
    const tableMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 });
    materialsToDispose.push(woodMat, umbrellaPoleMat, tableMat);

    const benchSeatGeo = new THREE.BoxGeometry(1.7, 0.1, 0.52);
    const benchBackGeo = new THREE.BoxGeometry(1.7, 0.45, 0.08);
    const benchLegGeo = new THREE.BoxGeometry(0.1, 0.42, 0.46);
    const cafeTableGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.06, 14);
    const cafeStemGeo = new THREE.CylinderGeometry(0.05, 0.06, 2.25, 10);
    const cafeCanopyGeo = new THREE.ConeGeometry(1.35, 0.55, 8);
    geometriesToDispose.push(benchSeatGeo, benchBackGeo, benchLegGeo, cafeTableGeo, cafeStemGeo, cafeCanopyGeo);

    const benchLocations: Array<{ x: number; z: number; rotY: number }> = [
      { x: -5.8, z: -9.5, rotY: Math.PI / 2 },
      { x: 5.8, z: -9.5, rotY: -Math.PI / 2 },
      { x: -5.8, z: 9.5, rotY: Math.PI / 2 },
      { x: 5.8, z: 9.5, rotY: -Math.PI / 2 },
      { x: -9.5, z: -5.8, rotY: 0 },
      { x: 9.5, z: -5.8, rotY: 0 },
      { x: -9.5, z: 5.8, rotY: Math.PI },
      { x: 9.5, z: 5.8, rotY: Math.PI },
    ];
    benchLocations.forEach(({ x, z, rotY }) => {
      const b = new THREE.Group();
      b.position.set(x, 0.08, z);
      b.rotation.y = rotY;
      const seat = new THREE.Mesh(benchSeatGeo, woodMat);
      seat.position.y = 0.44;
      b.add(seat);
      const back = new THREE.Mesh(benchBackGeo, woodMat);
      back.position.set(0, 0.72, -0.22);
      back.rotation.x = -0.15;
      b.add(back);
      [-0.7, 0.7].forEach((lx) => {
        const leg = new THREE.Mesh(benchLegGeo, poleIronMat);
        leg.position.set(lx, 0.21, 0);
        b.add(leg);
      });
      cityGroup.add(b);
      obstacles.push({ minX: x - 0.8, maxX: x + 0.8, minZ: z - 0.6, maxZ: z + 0.6 });
    });

    [
      { x: -8.8, z: -15.5, colIdx: 0 },
      { x: 8.8, z: -15.5, colIdx: 1 },
      { x: -8.8, z: 15.5, colIdx: 2 },
      { x: 8.8, z: 15.5, colIdx: 3 },
    ].forEach(({ x, z, colIdx }) => {
      const cafe = new THREE.Group();
      cafe.position.set(x, 0.08, z);
      const cMat = new THREE.MeshStandardMaterial({
        color: umbrellaCanopyColors[colIdx % umbrellaCanopyColors.length],
        roughness: 0.75,
      });
      materialsToDispose.push(cMat);

      const tbl = new THREE.Mesh(cafeTableGeo, tableMat);
      tbl.position.y = 0.76;
      cafe.add(tbl);

      const pole = new THREE.Mesh(cafeStemGeo, umbrellaPoleMat);
      pole.position.y = 1.12;
      cafe.add(pole);

      const canopy = new THREE.Mesh(cafeCanopyGeo, cMat);
      canopy.position.y = 2.28;
      canopy.castShadow = !isSoftwareGl;
      cafe.add(canopy);

      cityGroup.add(cafe);
      obstacles.push({ minX: x - 0.8, maxX: x + 0.8, minZ: z - 0.8, maxZ: z + 0.8 });
    });
  }

  // =========================================================================
  // 8. BUILDINGS & SKYSCRAPERS (PRÉDIOS - turn on at Solar Altitude <= -4.5 deg)
  // =========================================================================
  const buildingFacadeMaterials: THREE.MeshStandardMaterial[] = [];
  for (let s = 0; s < 4; s++) {
    const { map, emissiveMap } = createBuildingFacadeTextures(s, variant, maxAnisotropy);
    texturesToDispose.push(map, emissiveMap);

    const fMat = new THREE.MeshStandardMaterial({
      map,
      emissive: new THREE.Color(0xffe7b8),
      emissiveMap,
      emissiveIntensity: 0.0,
      roughness: isCarsCity ? (s % 2 === 0 ? 0.3 : 0.65) : 0.76,
      metalness: isCarsCity ? (s % 2 === 0 ? 0.48 : 0.15) : 0.08,
    });
    materialsToDispose.push(fMat);
    buildingFacadeMaterials.push(fMat);
  }

  const buildingLobbyMat = new THREE.MeshStandardMaterial({
    color: isCarsCity ? 0x1e293b : 0x3b2f2a,
    emissive: new THREE.Color(0xffd584),
    emissiveIntensity: 0.0,
    roughness: 0.25,
    metalness: 0.45,
  });
  const buildingCrownMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    emissive: new THREE.Color(isCarsCity ? 0x38bdf8 : 0xfbbf24),
    emissiveIntensity: 0.0,
    roughness: 0.3,
    metalness: 0.65,
  });
  const rooftopBeaconMat = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d,
    emissive: new THREE.Color(0xef4444),
    emissiveIntensity: 0.0,
    roughness: 0.2,
    metalness: 0.3,
  });
  const roofTrimMat = new THREE.MeshStandardMaterial({
    color: isCarsCity ? 0x1e293b : 0x57483f,
    roughness: 0.65,
    metalness: isCarsCity ? 0.35 : 0.12,
  });
  materialsToDispose.push(buildingLobbyMat, buildingCrownMat, rooftopBeaconMat, roofTrimMat);

  const buildingSpecs: BuildingSpec[] = isCarsCity
    ? [
        // Taller modern skyline set back behind 4-lane highways (blocks start at +-12m)
        { x: -16.5, z: -18.5, w: 6.4, d: 6.4, h: 22, styleIndex: 0, hasSetback: true, hasSpire: true },
        { x: -24.5, z: -16.5, w: 6.2, d: 6.2, h: 17, styleIndex: 1, hasSetback: true },
        { x: -16.5, z: -29.0, w: 6.8, d: 6.4, h: 25, styleIndex: 2, hasSetback: true, hasSpire: true },
        { x: -30.0, z: -28.0, w: 7.4, d: 7.4, h: 29, styleIndex: 3, hasSetback: true, hasSpire: true },

        { x: 16.5, z: -18.5, w: 6.4, d: 6.4, h: 24, styleIndex: 2, hasSetback: true, hasSpire: true },
        { x: 24.5, z: -16.5, w: 6.2, d: 6.2, h: 16, styleIndex: 3 },
        { x: 16.5, z: -29.0, w: 6.8, d: 6.4, h: 20, styleIndex: 1, hasSetback: true },
        { x: 30.0, z: -28.0, w: 7.4, d: 7.4, h: 27, styleIndex: 0, hasSetback: true, hasSpire: true },

        { x: -16.5, z: 18.5, w: 6.4, d: 6.4, h: 19, styleIndex: 1, hasSetback: true },
        { x: -24.5, z: 16.5, w: 6.2, d: 6.2, h: 15, styleIndex: 0 },
        { x: -16.5, z: 29.0, w: 6.8, d: 6.4, h: 26, styleIndex: 3, hasSetback: true, hasSpire: true },
        { x: -30.0, z: 28.0, w: 7.4, d: 7.4, h: 24, styleIndex: 2, hasSetback: true },

        { x: 16.5, z: 18.5, w: 6.4, d: 6.4, h: 27, styleIndex: 0, hasSetback: true, hasSpire: true },
        { x: 24.5, z: 16.5, w: 6.2, d: 6.2, h: 16.5, styleIndex: 2 },
        { x: 16.5, z: 29.0, w: 6.8, d: 6.4, h: 18, styleIndex: 3 },
        { x: 30.0, z: 28.0, w: 7.4, d: 7.4, h: 30, styleIndex: 1, hasSetback: true, hasSpire: true },
      ]
    : [
        // Cozy mid-rise human-scale neighborhood blocks framing the pedestrian plazas with awnings
        { x: -14.5, z: -14.5, w: 6.5, d: 6.5, h: 9.5, styleIndex: 0, hasAwning: true, awningColor: 0xd97706 },
        { x: -22.5, z: -13.5, w: 6.0, d: 6.0, h: 11.5, styleIndex: 1, hasSetback: true, hasAwning: true, awningColor: 0x059669 },
        { x: -13.5, z: -22.5, w: 6.0, d: 6.0, h: 10.5, styleIndex: 2, hasAwning: true, awningColor: 0xdc2626 },

        { x: 14.5, z: -14.5, w: 6.5, d: 6.5, h: 10.0, styleIndex: 2, hasAwning: true, awningColor: 0x0284c7 },
        { x: 22.5, z: -13.5, w: 6.0, d: 6.0, h: 12.0, styleIndex: 3, hasSetback: true, hasAwning: true, awningColor: 0xd97706 },
        { x: 13.5, z: -22.5, w: 6.0, d: 6.0, h: 9.0, styleIndex: 1, hasAwning: true, awningColor: 0x059669 },

        { x: -14.5, z: 14.5, w: 6.5, d: 6.5, h: 9.8, styleIndex: 1, hasAwning: true, awningColor: 0xdc2626 },
        { x: -22.5, z: 13.5, w: 6.0, d: 6.0, h: 11.0, styleIndex: 0, hasAwning: true, awningColor: 0x0284c7 },
        { x: -13.5, z: 22.5, w: 6.0, d: 6.0, h: 12.5, styleIndex: 3, hasSetback: true, hasAwning: true, awningColor: 0xd97706 },

        { x: 14.5, z: 14.5, w: 6.5, d: 6.5, h: 10.2, styleIndex: 3, hasAwning: true, awningColor: 0x059669 },
        { x: 22.5, z: 13.5, w: 6.0, d: 6.0, h: 11.8, styleIndex: 2, hasSetback: true, hasAwning: true, awningColor: 0xdc2626 },
        { x: 13.5, z: 22.5, w: 6.0, d: 6.0, h: 9.2, styleIndex: 0, hasAwning: true, awningColor: 0x0284c7 },

        // Perimeter outer apartment buildings beyond the +-31m shuttle ring
        { x: -16, z: -42, w: 8.0, d: 7.5, h: 14, styleIndex: 0, hasSetback: true },
        { x: 16, z: -42, w: 8.0, d: 7.5, h: 13, styleIndex: 2, hasSetback: true },
        { x: -16, z: 42, w: 8.0, d: 7.5, h: 13.5, styleIndex: 1, hasSetback: true },
        { x: 16, z: 42, w: 8.0, d: 7.5, h: 15, styleIndex: 3, hasSetback: true },
      ];

  buildingSpecs.forEach((b) => {
    const bGroup = new THREE.Group();
    bGroup.position.set(b.x, 0.08, b.z);

    const facadeMat = buildingFacadeMaterials[b.styleIndex % buildingFacadeMaterials.length];
    const lobbyH = 1.9;
    const lobbyGeo = new THREE.BoxGeometry(b.w + 0.3, lobbyH, b.d + 0.3);
    geometriesToDispose.push(lobbyGeo);
    const lobby = new THREE.Mesh(lobbyGeo, buildingLobbyMat);
    lobby.position.y = lobbyH * 0.5;
    lobby.castShadow = true;
    lobby.receiveShadow = true;
    bGroup.add(lobby);

    const canopyGeo = new THREE.BoxGeometry(b.w + 0.75, 0.22, b.d + 0.75);
    geometriesToDispose.push(canopyGeo);
    const canopyMat = b.hasAwning
      ? new THREE.MeshStandardMaterial({ color: b.awningColor || 0xd97706, roughness: 0.7 })
      : roofTrimMat;
    if (b.hasAwning) materialsToDispose.push(canopyMat);
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.y = lobbyH + 0.11;
    bGroup.add(canopy);

    const mainH = b.hasSetback ? b.h * 0.72 : b.h - lobbyH;
    const shaftGeo = new THREE.BoxGeometry(b.w, mainH, b.d);
    geometriesToDispose.push(shaftGeo);
    const shaft = new THREE.Mesh(shaftGeo, facadeMat);
    shaft.position.y = lobbyH + mainH * 0.5;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    bGroup.add(shaft);

    let topY = lobbyH + mainH;

    if (b.hasSetback) {
      const upperH = b.h - topY;
      const upperGeo = new THREE.BoxGeometry(b.w * 0.72, upperH, b.d * 0.72);
      geometriesToDispose.push(upperGeo);
      const upper = new THREE.Mesh(upperGeo, facadeMat);
      upper.position.y = topY + upperH * 0.5;
      upper.castShadow = true;
      upper.receiveShadow = true;
      bGroup.add(upper);

      const ledgeGeo = new THREE.BoxGeometry(b.w + 0.2, 0.25, b.d + 0.2);
      geometriesToDispose.push(ledgeGeo);
      const ledge = new THREE.Mesh(ledgeGeo, roofTrimMat);
      ledge.position.y = topY + 0.12;
      bGroup.add(ledge);

      topY += upperH;
    }

    const crownW = b.hasSetback ? b.w * 0.74 : b.w + 0.16;
    const crownD = b.hasSetback ? b.d * 0.74 : b.d + 0.16;
    const crownGeo = new THREE.BoxGeometry(crownW, 0.28, crownD);
    geometriesToDispose.push(crownGeo);
    const crown = new THREE.Mesh(crownGeo, buildingCrownMat);
    crown.position.y = topY + 0.14;
    bGroup.add(crown);

    if (b.hasSpire) {
      const spireGeo = new THREE.CylinderGeometry(0.04, 0.16, 3.4, 8);
      const beaconGeo = new THREE.SphereGeometry(0.18, 10, 10);
      geometriesToDispose.push(spireGeo, beaconGeo);

      const spire = new THREE.Mesh(spireGeo, roofTrimMat);
      spire.position.y = topY + 1.9;
      bGroup.add(spire);

      const beacon = new THREE.Mesh(beaconGeo, rooftopBeaconMat);
      beacon.position.y = topY + 3.65;
      bGroup.add(beacon);
    }

    cityGroup.add(bGroup);

    const halfW = (b.w + 0.35) * 0.5;
    const halfD = (b.d + 0.35) * 0.5;
    obstacles.push({
      minX: b.x - halfW,
      maxX: b.x + halfW,
      minZ: b.z - halfD,
      maxZ: b.z + halfD,
    });
  });

  const cityGlowAmbient = new THREE.PointLight(0xffdfb0, 0, 75, 1.4);
  cityGlowAmbient.position.set(0, 16, 0);
  cityGroup.add(cityGlowAmbient);

  // 9. Urban Sidewalk / Plaza Trees
  const planterMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.75 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x543729, roughness: 0.9 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: isCarsCity ? 0x22543d : 0x2f6f44, roughness: 0.8 });
  materialsToDispose.push(planterMat, trunkMat, canopyMat);

  const planterGeo = new THREE.BoxGeometry(1.1, 0.4, 1.1);
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.16, 1.8, 8);
  const crownSphereGeo = new THREE.DodecahedronGeometry(isCarsCity ? 0.9 : 1.12, 1);
  geometriesToDispose.push(planterGeo, trunkGeo, crownSphereGeo);

  const urbanTreeCoords: Array<[number, number]> = isCarsCity
    ? [
        [-13.5, -13.5],
        [13.5, -13.5],
        [-13.5, 13.5],
        [13.5, 13.5],
      ]
    : [
        [-7.5, -7.5],
        [7.5, -7.5],
        [-7.5, 7.5],
        [7.5, 7.5],
        [-6.6, -17.5],
        [6.6, -17.5],
        [-6.6, 17.5],
        [6.6, 17.5],
        [-17.5, -6.6],
        [17.5, -6.6],
        [-17.5, 6.6],
        [17.5, 6.6],
      ];

  urbanTreeCoords.forEach(([tx, tz]) => {
    const tGroup = new THREE.Group();
    tGroup.position.set(tx, 0.08, tz);

    const planter = new THREE.Mesh(planterGeo, planterMat);
    planter.position.y = 0.2;
    tGroup.add(planter);

    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.1;
    trunk.castShadow = !isSoftwareGl;
    tGroup.add(trunk);

    const leaves = new THREE.Mesh(crownSphereGeo, canopyMat);
    leaves.position.y = 2.45;
    leaves.castShadow = !isSoftwareGl;
    tGroup.add(leaves);

    cityGroup.add(tGroup);
    obstacles.push({
      minX: tx - 0.6,
      maxX: tx + 0.6,
      minZ: tz - 0.6,
      maxZ: tz + 0.6,
    });
  });

  // =========================================================================
  // 10. PER-FRAME UPDATE (LIGHTING, SEMÁFOROS, CARROS & PEDESTRIANS)
  // =========================================================================
  const CYCLE_DURATION = 14.0;
  let trafficClock = 0;

  const setAxisSignalMaterials = (
    state: SignalColor,
    redMat: THREE.MeshStandardMaterial,
    yelMat: THREE.MeshStandardMaterial,
    grnMat: THREE.MeshStandardMaterial
  ) => {
    redMat.emissiveIntensity = state === 'red' ? 2.6 : 0.04;
    redMat.color.setHex(state === 'red' ? 0xff4d4d : 0x3b0d0d);

    yelMat.emissiveIntensity = state === 'yellow' ? 2.6 : 0.04;
    yelMat.color.setHex(state === 'yellow' ? 0xfde047 : 0x3d3006);

    grnMat.emissiveIntensity = state === 'green' ? 2.6 : 0.04;
    grnMat.color.setHex(state === 'green' ? 0x4ade80 : 0x09361a);
  };

  const CAR_HALF_LEN = 1.64;

  const updateCityState = (
    solarAltitudeDeg: number,
    elapsedSec: number,
    deltaSec: number
  ): TrafficSignalState => {
    const streetlightsOn = solarAltitudeDeg <= -3.0;
    const buildingsLit = solarAltitudeDeg <= -4.5;

    // 1. Postes (<= -3.0°)
    poleBulbMat.emissiveIntensity = streetlightsOn ? 2.4 : 0.0;
    poleBulbMat.color.setHex(streetlightsOn ? 0xfff3d1 : 0xdbeafe);
    poleConeMat.opacity = streetlightsOn ? 0.16 : 0.0;
    poleGroundPoolMat.opacity = streetlightsOn ? 0.28 : 0.0;

    for (let i = 0; i < lampCones.length; i++) lampCones[i].visible = streetlightsOn;
    for (let i = 0; i < lampPools.length; i++) lampPools[i].visible = streetlightsOn;
    for (let i = 0; i < streetPointLights.length; i++) {
      streetPointLights[i].intensity = streetlightsOn ? 14.0 : 0.0;
    }

    // 2. Prédios (<= -4.5°)
    for (let i = 0; i < buildingFacadeMaterials.length; i++) {
      buildingFacadeMaterials[i].emissiveIntensity = buildingsLit ? 1.65 : 0.0;
    }
    buildingLobbyMat.emissiveIntensity = buildingsLit ? 1.35 : 0.0;
    buildingCrownMat.emissiveIntensity = buildingsLit ? 1.2 : 0.0;

    if (buildingsLit) {
      const pulse = 0.55 + 0.45 * Math.sin(elapsedSec * 3.0);
      rooftopBeaconMat.emissiveIntensity = 1.4 + pulse * 1.4;
      cityGlowAmbient.intensity = 3.5;
    } else {
      rooftopBeaconMat.emissiveIntensity = 0.0;
      cityGlowAmbient.intensity = 0.0;
    }

    carHeadlightMat.emissiveIntensity = streetlightsOn ? 2.2 : 0.35;

    // 3. Semáforos state machine (L/O Verde -> Amarelo -> Vermelho / N/S Vermelho -> Verde -> Amarelo)
    trafficClock = (trafficClock + deltaSec) % CYCLE_DURATION;
    let ew: SignalColor = 'green';
    let ns: SignalColor = 'red';

    if (trafficClock < 5.2) {
      ew = 'green';
      ns = 'red';
    } else if (trafficClock < 7.0) {
      ew = 'yellow';
      ns = 'red';
    } else if (trafficClock < 12.2) {
      ew = 'red';
      ns = 'green';
    } else {
      ew = 'red';
      ns = 'yellow';
    }

    setAxisSignalMaterials(ew, ewRedMat, ewYellowMat, ewGreenMat);
    setAxisSignalMaterials(ns, nsRedMat, nsYellowMat, nsGreenMat);

    // 4. Advance Cars along their lanes
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      const roadSpan = car.loopHalfLen * 2;
      const mySignal = car.axis === 'ew' ? ew : ns;
      let targetSpeed = car.maxSpeed;

      const frontBumper = car.pos + car.sign * CAR_HALF_LEN;
      const stopLinePos = -car.sign * car.stopLineAbs;
      const distToStop = (stopLinePos - frontBumper) * car.sign;

      if (mySignal !== 'green' && distToStop >= -0.35 && distToStop < 20.0) {
        if (distToStop <= 0.45) {
          targetSpeed = 0;
        } else {
          targetSpeed = Math.min(targetSpeed, Math.max(0, (distToStop - 0.3) * 0.72));
        }
      }

      let minForwardGap = 999;
      for (let j = 0; j < cars.length; j++) {
        if (i === j || cars[j].laneKey !== car.laneKey) continue;
        const rawDelta = (cars[j].pos - car.pos) * car.sign;
        const wrappedGap = ((rawDelta % roadSpan) + roadSpan) % roadSpan;
        if (wrappedGap > 0.1 && wrappedGap < minForwardGap) {
          minForwardGap = wrappedGap;
        }
      }

      if (minForwardGap < 14.0) {
        const clearDist = minForwardGap - 5.2;
        if (clearDist <= 0.2) {
          targetSpeed = 0;
        } else {
          targetSpeed = Math.min(targetSpeed, clearDist * 0.9);
        }
      }

      if (car.speed < targetSpeed) {
        car.speed = Math.min(targetSpeed, car.speed + 6.5 * deltaSec);
      } else {
        car.speed = Math.max(targetSpeed, car.speed - 12.5 * deltaSec);
      }

      const displacement = car.speed * deltaSec;
      car.pos += car.sign * displacement;

      if (car.pos > car.loopHalfLen) {
        car.pos -= roadSpan;
      } else if (car.pos < -car.loopHalfLen) {
        car.pos += roadSpan;
      }

      if (car.axis === 'ns') {
        car.group.position.z = car.pos;
      } else {
        car.group.position.x = car.pos;
      }

      const wheelDelta = displacement / 0.32;
      for (let w = 0; w < car.wheels.length; w++) {
        car.wheels[w].rotation.x += wheelDelta;
      }

      const isBraking = car.speed < 0.7 || targetSpeed < car.speed - 0.6;
      car.brakeMat.emissiveIntensity = isBraking ? 2.4 : 0.35;
    }

    // 5. Advance Animated Pedestrians (Cidade De Pessoas)
    for (let i = 0; i < pedestrians.length; i++) {
      const p = pedestrians[i];
      const absPos = Math.abs(p.pos);
      // Pause politely just before perimeter shuttle street if signal perpendicular is green
      const aboutToStepInRoad =
        absPos >= p.crossZoneMin - 0.8 &&
        absPos < p.crossZoneMin &&
        ((p.pos * p.sign < 0 && p.pos < 0) || (p.pos * p.sign > 0 && p.pos > 0));
      const crossSignalRed = p.axis === 'ns' ? ew === 'green' : ns === 'green';

      const curSpeed = aboutToStepInRoad && crossSignalRed ? 0 : p.speed;
      p.pos += p.sign * curSpeed * deltaSec;

      const span = p.loopHalfLen * 2;
      if (p.pos > p.loopHalfLen) p.pos -= span;
      else if (p.pos < -p.loopHalfLen) p.pos += span;

      if (p.axis === 'ns') {
        p.group.position.z = p.pos;
      } else {
        p.group.position.x = p.pos;
      }

      if (curSpeed > 0.05) {
        p.walkPhase += deltaSec * curSpeed * 4.4;
        const swing = Math.sin(p.walkPhase) * 0.42;
        p.leftLeg.rotation.x = swing;
        p.rightLeg.rotation.x = -swing;
        p.leftArm.rotation.x = -swing * 0.85;
        p.rightArm.rotation.x = swing * 0.85;
      } else {
        p.leftLeg.rotation.x = 0;
        p.rightLeg.rotation.x = 0;
        p.leftArm.rotation.x = 0;
        p.rightArm.rotation.x = 0;
      }
    }

    return { ew, ns };
  };

  const dispose = () => {
    geometriesToDispose.forEach((g) => g.dispose());
    materialsToDispose.forEach((m) => m.dispose());
    texturesToDispose.forEach((t) => t.dispose());
  };

  return { cityGroup, obstacles, updateCityState, dispose };
}
