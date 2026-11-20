import * as THREE from 'three';
import { CityObstacleBox, CitySceneHandle, TrafficSignalState } from './CitySceneBuilder';

interface FarmVehicle {
  group: THREE.Group;
  axis: 'ew' | 'ns';
  sign: 1 | -1;
  pos: number;
  speed: number;
  wheels: THREE.Mesh[];
  loopHalfLen: number;
}

interface FarmAnimal {
  headGroup: THREE.Group;
  baseY: number;
  phase: number;
}

function createFarmGroundTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const pxPerM = size / 140;
  const center = size / 2;
  const toPx = (m: number) => center + m * pxPerM;

  // Base fertile meadow pasture green
  ctx.fillStyle = '#2d4a26';
  ctx.fillRect(0, 0, size, size);

  // Subtle natural grass organic variation
  for (let i = 0; i < 9000; i++) {
    const gx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const gy = (Math.sin(i * 78.233) * 24634.6345) % 1;
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(74, 124, 54, 0.22)'
        : i % 3 === 1
          ? 'rgba(26, 46, 22, 0.25)'
          : 'rgba(132, 169, 68, 0.10)';
    ctx.fillRect(Math.abs(gx) * size, Math.abs(gy) * size, 4, 4);
  }

  // Sunlit Pasture Meadow (+X, -Z quadrant)
  ctx.fillStyle = '#385c2b';
  ctx.fillRect(toPx(7), toPx(-48), 40 * pxPerM, 36 * pxPerM);

  // Plowed Rich Soil Crop Field (-X, -Z quadrant)
  ctx.fillStyle = '#4a3525';
  ctx.fillRect(toPx(-48), toPx(-48), 38 * pxPerM, 34 * pxPerM);
  ctx.strokeStyle = '#342418';
  ctx.lineWidth = 3;
  for (let z = -47; z <= -15; z += 1.8) {
    ctx.beginPath();
    ctx.moveTo(toPx(-47), toPx(z));
    ctx.lineTo(toPx(-11), toPx(z));
    ctx.stroke();
  }

  // Second Golden Wheat Field (+X, +Z quadrant)
  ctx.fillStyle = '#5c4b27';
  ctx.fillRect(toPx(10), toPx(14), 38 * pxPerM, 34 * pxPerM);

  // Rural Packed Dirt Country Road (E/W at z = -7m, and N/S lane at x = 22m & x = -22m)
  ctx.fillStyle = '#7c5d41';
  ctx.fillRect(0, toPx(-9.4), size, 4.8 * pxPerM); // Main E/W dirt road passing north of yard
  ctx.fillRect(toPx(-4.2), toPx(-9.4), 8.4 * pxPerM, 18 * pxPerM); // Yard driveway to central solar pad
  ctx.fillRect(toPx(20.0), 0, 4.4 * pxPerM, size); // East farm access dirt lane

  // Gravel wheel tracks on the main E/W dirt road
  ctx.strokeStyle = 'rgba(72, 51, 34, 0.5)';
  ctx.lineWidth = 4;
  for (const ty of [-7.9, -6.1]) {
    ctx.beginPath();
    ctx.moveTo(0, toPx(ty));
    ctx.lineTo(size, toPx(ty));
    ctx.stroke();
  }

  // Gravel courtyard around central sundial
  ctx.fillStyle = '#8b7762';
  ctx.beginPath();
  ctx.arc(center, center, 6.2 * pxPerM, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createFarmWindowEmissiveTex(maxAnisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 256, 256);

  // Warm cozy four-pane farmhouse / barn window
  ctx.fillStyle = '#ffd782';
  ctx.fillRect(18, 18, 100, 100);
  ctx.fillRect(138, 18, 100, 100);
  ctx.fillRect(18, 138, 100, 100);
  ctx.fillRect(138, 138, 100, 100);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function buildFarmScene(maxAnisotropy: number, isSoftwareGl: boolean): CitySceneHandle {
  const cityGroup = new THREE.Group();
  cityGroup.name = 'farmSceneGroup';

  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const materialsToDispose: THREE.Material[] = [];
  const texturesToDispose: THREE.Texture[] = [];
  const obstacles: CityObstacleBox[] = [];

  // 1. Rural Meadow & Fields Ground (140m x 140m)
  const groundTex = createFarmGroundTexture(maxAnisotropy);
  const windowGlowTex = createFarmWindowEmissiveTex(maxAnisotropy);
  texturesToDispose.push(groundTex, windowGlowTex);

  const groundGeo = new THREE.PlaneGeometry(140, 140);
  const groundMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    roughness: 0.92,
    metalness: 0.02,
  });
  geometriesToDispose.push(groundGeo);
  materialsToDispose.push(groundMat);

  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  cityGroup.add(groundMesh);

  // 2. Central Rustic Farm Courtyard Solar Sundial (0,0,0)
  const plazaGroup = new THREE.Group();
  const cobbleGeo = new THREE.CylinderGeometry(2.3, 2.5, 0.14, 24);
  const cobbleMat = new THREE.MeshStandardMaterial({ color: 0x6b635b, roughness: 0.85 });
  const timberPlinthGeo = new THREE.CylinderGeometry(1.3, 1.5, 0.36, 16);
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.88 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x452b15, roughness: 0.9 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.85, roughness: 0.25 });
  const gnomonGeo = new THREE.CylinderGeometry(0.055, 0.085, 2.1, 12);
  geometriesToDispose.push(cobbleGeo, timberPlinthGeo, gnomonGeo);
  materialsToDispose.push(cobbleMat, woodMat, darkWoodMat, brassMat);

  const cobbleSlab = new THREE.Mesh(cobbleGeo, cobbleMat);
  cobbleSlab.position.y = 0.07;
  cobbleSlab.receiveShadow = true;
  plazaGroup.add(cobbleSlab);

  const plinth = new THREE.Mesh(timberPlinthGeo, woodMat);
  plinth.position.y = 0.28;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  plazaGroup.add(plinth);

  const gnomon = new THREE.Mesh(gnomonGeo, brassMat);
  gnomon.position.set(0, 1.22, -0.42);
  gnomon.rotation.x = Math.PI / 4;
  gnomon.castShadow = true;
  plazaGroup.add(gnomon);

  cityGroup.add(plazaGroup);
  obstacles.push({ minX: -2.4, maxX: 2.4, minZ: -2.4, maxZ: 2.4 });

  // 3. Yard Lamp Posts (Postes da Fazenda - turn on at Solar Altitude <= -3.0 deg)
  const poleWoodMat = new THREE.MeshStandardMaterial({ color: 0x4b3621, roughness: 0.88 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.72, roughness: 0.4 });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    emissive: new THREE.Color(0xffc55c),
    emissiveIntensity: 0.0,
    roughness: 0.2,
  });
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffd275,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const poolMat = new THREE.MeshBasicMaterial({
    color: 0xffbe55,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  materialsToDispose.push(poleWoodMat, ironMat, bulbMat, coneMat, poolMat);

  const pShaftGeo = new THREE.CylinderGeometry(0.08, 0.12, 3.6, 8);
  const pArmGeo = new THREE.BoxGeometry(0.08, 0.08, 0.75);
  const pHoodGeo = new THREE.ConeGeometry(0.28, 0.18, 10);
  const pBulbGeo = new THREE.SphereGeometry(0.16, 10, 10);
  const pConeGeo = new THREE.ConeGeometry(1.6, 3.4, 14, 1, true);
  const pPoolGeo = new THREE.CircleGeometry(2.3, 18);
  geometriesToDispose.push(pShaftGeo, pArmGeo, pHoodGeo, pBulbGeo, pConeGeo, pPoolGeo);

  const lampCones: THREE.Mesh[] = [];
  const lampPools: THREE.Mesh[] = [];

  const farmLampLocations: Array<{ x: number; z: number; rotY: number }> = [
    { x: -5.5, z: -4.0, rotY: Math.PI * 0.2 },
    { x: 5.5, z: -4.0, rotY: -Math.PI * 0.2 },
    { x: -13.0, z: -4.2, rotY: Math.PI },
    { x: 13.0, z: -4.2, rotY: Math.PI },
    { x: -24.0, z: -10.2, rotY: 0 },
    { x: 14.0, z: -10.2, rotY: 0 },
    { x: -11.0, z: 10.5, rotY: Math.PI * 0.5 },
    { x: 11.0, z: 10.5, rotY: -Math.PI * 0.5 },
    { x: 19.2, z: 8.5, rotY: Math.PI * 0.5 },
    { x: 19.2, z: -20.5, rotY: Math.PI * 0.5 },
  ];

  farmLampLocations.forEach(({ x, z, rotY }) => {
    const post = new THREE.Group();
    post.position.set(x, 0, z);
    post.rotation.y = rotY;

    const shaft = new THREE.Mesh(pShaftGeo, poleWoodMat);
    shaft.position.y = 1.8;
    shaft.castShadow = !isSoftwareGl;
    post.add(shaft);

    const arm = new THREE.Mesh(pArmGeo, ironMat);
    arm.position.set(0, 3.52, 0.32);
    post.add(arm);

    const hood = new THREE.Mesh(pHoodGeo, ironMat);
    hood.position.set(0, 3.48, 0.68);
    post.add(hood);

    const bulb = new THREE.Mesh(pBulbGeo, bulbMat);
    bulb.position.set(0, 3.34, 0.68);
    post.add(bulb);

    const cone = new THREE.Mesh(pConeGeo, coneMat);
    cone.position.set(0, 1.75, 0.68);
    cone.visible = false;
    post.add(cone);
    lampCones.push(cone);

    const pool = new THREE.Mesh(pPoolGeo, poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.03, 0.68);
    pool.visible = false;
    post.add(pool);
    lampPools.push(pool);

    cityGroup.add(post);
    obstacles.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
  });

  const farmPointLights: THREE.PointLight[] = [];
  [
    [0, 4.2, -2],
    [-14, 4.0, 12],
    [14, 4.0, 12],
    [0, 4.0, -9],
  ].forEach(([lx, ly, lz]) => {
    const pt = new THREE.PointLight(0xffc966, 0, 26, 1.6);
    pt.position.set(lx, ly, lz);
    cityGroup.add(pt);
    farmPointLights.push(pt);
  });

  // 4. Shared Emissive Window Material (Farmhouse & Barn windows turn on at <= -4.5 deg)
  const buildingWindowMat = new THREE.MeshStandardMaterial({
    map: windowGlowTex,
    emissive: new THREE.Color(0xffd27d),
    emissiveMap: windowGlowTex,
    emissiveIntensity: 0.0,
    roughness: 0.25,
    metalness: 0.1,
  });
  materialsToDispose.push(buildingWindowMat);

  // =========================================================================
  // 5. FARMHOUSE (CASA SEDE) AT SW (-16, 0, 15)
  // =========================================================================
  {
    const houseX = -16;
    const houseZ = 15;
    const house = new THREE.Group();
    house.position.set(houseX, 0, houseZ);

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1e8d6, roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.78 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x5c3419, roughness: 0.8 });
    materialsToDispose.push(stoneMat, wallMat, roofMat, doorMat);

    const plinthG = new THREE.BoxGeometry(8.8, 0.45, 7.2);
    const bodyG = new THREE.BoxGeometry(8.2, 3.4, 6.2);
    const roofG = new THREE.ConeGeometry(6.2, 2.6, 4);
    const porchRoofG = new THREE.BoxGeometry(8.6, 0.22, 2.2);
    const postG = new THREE.CylinderGeometry(0.1, 0.1, 2.4, 8);
    const chimneyG = new THREE.BoxGeometry(0.85, 2.8, 0.85);
    const winG = new THREE.BoxGeometry(1.15, 1.25, 0.12);
    const doorG = new THREE.BoxGeometry(1.2, 2.1, 0.14);
    geometriesToDispose.push(plinthG, bodyG, roofG, porchRoofG, postG, chimneyG, winG, doorG);

    const foundation = new THREE.Mesh(plinthG, stoneMat);
    foundation.position.y = 0.22;
    foundation.receiveShadow = true;
    house.add(foundation);

    const body = new THREE.Mesh(bodyG, wallMat);
    body.position.y = 2.15;
    body.castShadow = true;
    body.receiveShadow = true;
    house.add(body);

    const roof = new THREE.Mesh(roofG, roofMat);
    roof.position.y = 5.1;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.12, 1.0, 0.9);
    roof.castShadow = true;
    house.add(roof);

    const chimney = new THREE.Mesh(chimneyG, stoneMat);
    chimney.position.set(-2.4, 5.1, -1.2);
    chimney.castShadow = true;
    house.add(chimney);

    // Front Porch facing -Z toward central sundial
    const porch = new THREE.Mesh(porchRoofG, roofMat);
    porch.position.set(0, 2.65, -3.9);
    porch.rotation.x = 0.14;
    house.add(porch);

    [-3.7, -1.3, 1.3, 3.7].forEach((px) => {
      const p = new THREE.Mesh(postG, darkWoodMat);
      p.position.set(px, 1.45, -4.7);
      house.add(p);
    });

    const door = new THREE.Mesh(doorG, doorMat);
    door.position.set(0, 1.5, -3.12);
    house.add(door);

    // Glowing Farmhouse Windows on front, back, left & right faces
    [
      { x: -2.4, y: 2.35, z: -3.12, ry: 0 },
      { x: 2.4, y: 2.35, z: -3.12, ry: 0 },
      { x: -2.4, y: 2.35, z: 3.12, ry: 0 },
      { x: 2.4, y: 2.35, z: 3.12, ry: 0 },
      { x: -4.12, y: 2.35, z: 0, ry: Math.PI / 2 },
      { x: 4.12, y: 2.35, z: 0, ry: Math.PI / 2 },
    ].forEach(({ x, y, z, ry }) => {
      const w = new THREE.Mesh(winG, buildingWindowMat);
      w.position.set(x, y, z);
      w.rotation.y = ry;
      house.add(w);
    });

    cityGroup.add(house);
    obstacles.push({
      minX: houseX - 4.7,
      maxX: houseX + 4.7,
      minZ: houseZ - 4.9,
      maxZ: houseZ + 3.8,
    });
  }

  // =========================================================================
  // 6. CLASSIC RED BARN (CELEIRO) & GRAIN SILO AT NW (-16, 0, -21)
  // =========================================================================
  {
    const barnX = -15;
    const barnZ = -21;
    const barn = new THREE.Group();
    barn.position.set(barnX, 0, barnZ);

    const barnRedMat = new THREE.MeshStandardMaterial({ color: 0xa32620, roughness: 0.82 });
    const barnRoofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65, metalness: 0.25 });
    const trimWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.7 });
    const siloMetalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.72, roughness: 0.35 });
    materialsToDispose.push(barnRedMat, barnRoofMat, trimWhiteMat, siloMetalMat);

    const barnBodyG = new THREE.BoxGeometry(9.2, 4.6, 11.4);
    const barnRoofG = new THREE.CylinderGeometry(5.3, 5.3, 11.8, 3);
    const barnDoorG = new THREE.BoxGeometry(3.2, 3.0, 0.2);
    const barnLoftWinG = new THREE.BoxGeometry(1.4, 1.3, 0.16);
    const siloCylG = new THREE.CylinderGeometry(2.1, 2.1, 9.4, 20);
    const siloDomeG = new THREE.SphereGeometry(2.1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    geometriesToDispose.push(barnBodyG, barnRoofG, barnDoorG, barnLoftWinG, siloCylG, siloDomeG);

    const barnBody = new THREE.Mesh(barnBodyG, barnRedMat);
    barnBody.position.y = 2.3;
    barnBody.castShadow = true;
    barnBody.receiveShadow = true;
    barn.add(barnBody);

    const barnRoof = new THREE.Mesh(barnRoofG, barnRoofMat);
    barnRoof.rotation.x = Math.PI / 2;
    barnRoof.rotation.y = Math.PI / 2;
    barnRoof.scale.set(1.0, 1.0, 0.55);
    barnRoof.position.y = 6.0;
    barnRoof.castShadow = true;
    barn.add(barnRoof);

    // Big white X-braced barn doors facing +Z (road)
    const barnDoor = new THREE.Mesh(barnDoorG, trimWhiteMat);
    barnDoor.position.set(0, 1.5, 5.72);
    barn.add(barnDoor);

    // Illuminated Barn Loft & Side Windows (<= -4.5°)
    [
      { x: 0, y: 3.9, z: 5.75, ry: 0 },
      { x: 0, y: 3.9, z: -5.75, ry: 0 },
      { x: -4.65, y: 2.6, z: -2.5, ry: Math.PI / 2 },
      { x: -4.65, y: 2.6, z: 2.5, ry: Math.PI / 2 },
      { x: 4.65, y: 2.6, z: -2.5, ry: Math.PI / 2 },
      { x: 4.65, y: 2.6, z: 2.5, ry: Math.PI / 2 },
    ].forEach(({ x, y, z, ry }) => {
      const bw = new THREE.Mesh(barnLoftWinG, buildingWindowMat);
      bw.position.set(x, y, z);
      bw.rotation.y = ry;
      barn.add(bw);
    });

    // Adjacent Galvanized Grain Silo
    const silo = new THREE.Mesh(siloCylG, siloMetalMat);
    silo.position.set(-7.1, 4.7, -1.5);
    silo.castShadow = true;
    barn.add(silo);

    const siloDome = new THREE.Mesh(siloDomeG, siloMetalMat);
    siloDome.position.set(-7.1, 9.4, -1.5);
    barn.add(siloDome);

    cityGroup.add(barn);
    obstacles.push({ minX: barnX - 4.9, maxX: barnX + 4.9, minZ: barnZ - 6.0, maxZ: barnZ + 6.0 });
    obstacles.push({ minX: barnX - 9.4, maxX: barnX - 4.8, minZ: barnZ - 3.8, maxZ: barnZ + 0.8 });
  }

  // =========================================================================
  // 7. SPINNING FARM WINDMILL (CATAVENTO) AT (12.5, 0, 14)
  // =========================================================================
  let windmillRotor: THREE.Group | null = null;
  {
    const wmX = 12.5;
    const wmZ = 14;
    const wmGroup = new THREE.Group();
    wmGroup.position.set(wmX, 0, wmZ);

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.72, roughness: 0.35 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.5, roughness: 0.4 });
    materialsToDispose.push(steelMat, bladeMat);

    const legGeo = new THREE.CylinderGeometry(0.08, 0.14, 9.2, 6);
    const hubGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.7, 12);
    const bladeGeo = new THREE.BoxGeometry(0.45, 2.3, 0.05);
    geometriesToDispose.push(legGeo, hubGeo, bladeGeo);

    [
      [-0.75, -0.75, 0.12, -0.12],
      [0.75, -0.75, 0.12, 0.12],
      [-0.75, 0.75, -0.12, -0.12],
      [0.75, 0.75, -0.12, 0.12],
    ].forEach(([lx, lz, rx, rz]) => {
      const leg = new THREE.Mesh(legGeo, steelMat);
      leg.position.set(lx, 4.4, lz);
      leg.rotation.set(rx, 0, rz);
      leg.castShadow = !isSoftwareGl;
      wmGroup.add(leg);
    });

    const nacelle = new THREE.Mesh(hubGeo, ironMat);
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(0, 8.9, 0);
    wmGroup.add(nacelle);

    windmillRotor = new THREE.Group();
    windmillRotor.position.set(0, 8.9, 0.45);
    const bladeCount = 8;
    for (let i = 0; i < bladeCount; i++) {
      const ang = (i / bladeCount) * Math.PI * 2;
      const bladeWrap = new THREE.Group();
      bladeWrap.rotation.z = ang;
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.y = 1.25;
      blade.rotation.y = 0.28;
      bladeWrap.add(blade);
      windmillRotor.add(bladeWrap);
    }
    wmGroup.add(windmillRotor);

    cityGroup.add(wmGroup);
    obstacles.push({ minX: wmX - 1.3, maxX: wmX + 1.3, minZ: wmZ - 1.3, maxZ: wmZ + 1.3 });
  }

  // =========================================================================
  // 8. WOODEN FENCES, HAY BALES, TREES, POND & GRAZING COWS/SHEEP
  // =========================================================================
  const fencePostGeo = new THREE.CylinderGeometry(0.09, 0.11, 1.25, 6);
  const fenceRailGeo = new THREE.BoxGeometry(3.8, 0.1, 0.08);
  const hayGeo = new THREE.CylinderGeometry(0.68, 0.68, 1.15, 14);
  const hayMat = new THREE.MeshStandardMaterial({ color: 0xd99b26, roughness: 0.92 });
  geometriesToDispose.push(fencePostGeo, fenceRailGeo, hayGeo);
  materialsToDispose.push(hayMat);

  const addFenceSegment = (x1: number, z1: number, x2: number, z2: number) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);
    const count = Math.max(1, Math.round(len / 3.8));
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const px = x1 + dx * t;
      const pz = z1 + dz * t;
      const post = new THREE.Mesh(fencePostGeo, woodMat);
      post.position.set(px, 0.62, pz);
      post.castShadow = !isSoftwareGl;
      cityGroup.add(post);
      if (i < count) {
        const mx = px + (dx / count) * 0.5;
        const mz = pz + (dz / count) * 0.5;
        for (const ry of [0.45, 0.92]) {
          const rail = new THREE.Mesh(fenceRailGeo, woodMat);
          rail.position.set(mx, ry, mz);
          rail.rotation.y = angle + Math.PI / 2;
          rail.scale.x = len / count / 3.8;
          cityGroup.add(rail);
        }
      }
    }
  };

  // NE Pasture Enclosure Fence (+X: 8..34, -Z: -14..-38 with gap near road)
  addFenceSegment(8, -14, 18, -14);
  addFenceSegment(25, -14, 38, -14);
  addFenceSegment(8, -14, 8, -38);
  addFenceSegment(8, -38, 38, -38);
  addFenceSegment(38, -14, 38, -38);
  // Southern Corn/Wheat Yard Fence
  addFenceSegment(10, 12, 36, 12);
  addFenceSegment(10, 12, 10, 36);

  // Golden Hay Bales stacked cleanly
  [
    { x: -6.5, z: -26.5, y: 0.68, ry: 0.2 },
    { x: -5.2, z: -27.2, y: 0.68, ry: 0.1 },
    { x: -5.8, z: -26.8, y: 1.9, ry: 0.15 },
    { x: 14.5, z: 22.0, y: 0.68, ry: 0.7 },
    { x: 16.0, z: 22.5, y: 0.68, ry: 0.4 },
  ].forEach(({ x, z, y, ry }) => {
    const hay = new THREE.Mesh(hayGeo, hayMat);
    hay.rotation.z = Math.PI / 2;
    hay.rotation.y = ry;
    hay.position.set(x, y, z);
    hay.castShadow = !isSoftwareGl;
    cityGroup.add(hay);
  });

  // Farm Pond (Lagoa) at SE-ish corner (+31, 0, +4)
  const pondGeo = new THREE.CircleGeometry(5.2, 24);
  const pondMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.15,
    metalness: 0.65,
  });
  geometriesToDispose.push(pondGeo);
  materialsToDispose.push(pondMat);
  const pond = new THREE.Mesh(pondGeo, pondMat);
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(32, 0.03, 5);
  cityGroup.add(pond);

  // Orchard & Meadow Trees
  const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x543729, roughness: 0.9 });
  const treeLeafMat = new THREE.MeshStandardMaterial({ color: 0x265c2e, roughness: 0.82 });
  const cropMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.85 });
  const wheatMat = new THREE.MeshStandardMaterial({ color: 0xd4a72c, roughness: 0.88 });
  materialsToDispose.push(treeTrunkMat, treeLeafMat, cropMat, wheatMat);

  const tTrunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 2.4, 8);
  const tCrownGeo = new THREE.DodecahedronGeometry(1.55, 1);
  geometriesToDispose.push(tTrunkGeo, tCrownGeo);

  [
    [-26, 10],
    [-28, 22],
    [-8, 26],
    [6, 26],
    [32, -22],
    [35, -33],
    [-32, -16],
    [6, -34],
  ].forEach(([tx, tz]) => {
    const tGroup = new THREE.Group();
    tGroup.position.set(tx, 0, tz);
    const trunk = new THREE.Mesh(tTrunkGeo, treeTrunkMat);
    trunk.position.y = 1.2;
    trunk.castShadow = !isSoftwareGl;
    tGroup.add(trunk);

    const crown = new THREE.Mesh(tCrownGeo, treeLeafMat);
    crown.position.y = 3.1;
    crown.castShadow = !isSoftwareGl;
    tGroup.add(crown);

    cityGroup.add(tGroup);
    obstacles.push({ minX: tx - 0.6, maxX: tx + 0.6, minZ: tz - 0.6, maxZ: tz + 0.6 });
  });

  // Instanced Crop Stalks (Planted rows in NW crop plot & SE wheat plot)
  const stalkGeo = new THREE.ConeGeometry(0.18, 1.35, 6);
  geometriesToDispose.push(stalkGeo);
  const stalkPositions: Array<[number, number]> = [];
  for (let x = -43; x <= -26; x += 2.2) {
    for (let z = -43; z <= -28; z += 2.4) {
      stalkPositions.push([x, z]);
    }
  }
  const cropMesh = new THREE.InstancedMesh(stalkGeo, cropMat, stalkPositions.length);
  const dummy = new THREE.Object3D();
  stalkPositions.forEach(([sx, sz], idx) => {
    dummy.position.set(sx, 0.65, sz);
    dummy.scale.setScalar(0.85 + ((idx % 5) * 0.08));
    dummy.updateMatrix();
    cropMesh.setMatrixAt(idx, dummy.matrix);
  });
  cropMesh.instanceMatrix.needsUpdate = true;
  cropMesh.computeBoundingSphere();
  cityGroup.add(cropMesh);

  // Composite Farm Animals (Dairy Cows & Grazing Sheep)
  const animals: FarmAnimal[] = [];
  const cowWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.85 });
  const cowSpotMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
  const sheepWoolMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.95 });
  materialsToDispose.push(cowWhiteMat, cowSpotMat, sheepWoolMat);

  const cowBodyGeo = new THREE.BoxGeometry(0.82, 0.78, 1.52);
  const cowSpotGeo = new THREE.BoxGeometry(0.85, 0.42, 0.56);
  const cowHeadGeo = new THREE.BoxGeometry(0.42, 0.42, 0.5);
  const cowLegGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.68, 6);
  const sheepBodyGeo = new THREE.SphereGeometry(0.45, 10, 10);
  const sheepHeadGeo = new THREE.BoxGeometry(0.28, 0.28, 0.34);
  geometriesToDispose.push(cowBodyGeo, cowSpotGeo, cowHeadGeo, cowLegGeo, sheepBodyGeo, sheepHeadGeo);

  [
    { x: 13.5, z: -21, ry: 0.5 },
    { x: 17.5, z: -27, ry: 2.1 },
    { x: 28.0, z: -25, ry: -0.9 },
  ].forEach(({ x, z, ry }, idx) => {
    const cow = new THREE.Group();
    cow.position.set(x, 0, z);
    cow.rotation.y = ry;

    const body = new THREE.Mesh(cowBodyGeo, cowWhiteMat);
    body.position.y = 0.95;
    body.castShadow = !isSoftwareGl;
    cow.add(body);

    const spot = new THREE.Mesh(cowSpotGeo, cowSpotMat);
    spot.position.set(0, 1.02, -0.15);
    cow.add(spot);

    [
      [-0.28, 0.5],
      [0.28, 0.5],
      [-0.28, -0.5],
      [0.28, -0.5],
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(cowLegGeo, cowWhiteMat);
      leg.position.set(lx, 0.34, lz);
      cow.add(leg);
    });

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.05, 0.92);
    const head = new THREE.Mesh(cowHeadGeo, cowSpotMat);
    headGroup.add(head);
    cow.add(headGroup);

    cityGroup.add(cow);
    animals.push({ headGroup, baseY: 1.05, phase: idx * 1.9 });
    obstacles.push({ minX: x - 0.8, maxX: x + 0.8, minZ: z - 0.8, maxZ: z + 0.8 });
  });

  [
    { x: 12.0, z: -18, ry: 1.1 },
    { x: 15.2, z: -17.5, ry: 2.6 },
    { x: 26.5, z: -19, ry: -0.4 },
  ].forEach(({ x, z, ry }, idx) => {
    const sheep = new THREE.Group();
    sheep.position.set(x, 0, z);
    sheep.rotation.y = ry;

    const body = new THREE.Mesh(sheepBodyGeo, sheepWoolMat);
    body.scale.set(0.95, 0.85, 1.25);
    body.position.y = 0.58;
    sheep.add(body);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.65, 0.55);
    const head = new THREE.Mesh(sheepHeadGeo, cowSpotMat);
    headGroup.add(head);
    sheep.add(headGroup);

    cityGroup.add(sheep);
    animals.push({ headGroup, baseY: 0.65, phase: idx * 2.4 + 0.7 });
  });

  // =========================================================================
  // 9. ANIMATED FARM TRACTOR & FARM PICKUP ON DIRT ROADS
  // =========================================================================
  const farmVehicles: FarmVehicle[] = [];
  const tractorHeadlightMat = new THREE.MeshStandardMaterial({
    color: 0xfffbeb,
    emissive: new THREE.Color(0xfff3c4),
    emissiveIntensity: 0.35,
    roughness: 0.2,
  });
  const tractorRedMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.35, roughness: 0.45 });
  const pickupGreenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, metalness: 0.4, roughness: 0.38 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
  const cabGlassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.15 });
  materialsToDispose.push(tractorHeadlightMat, tractorRedMat, pickupGreenMat, tireMat, cabGlassMat);

  // Build Composite Tractor moving Eastbound (+X) along Dirt Road (z = -7.0m)
  {
    const tractor = new THREE.Group();
    const tHullG = new THREE.BoxGeometry(1.4, 0.75, 2.2);
    const tCabG = new THREE.BoxGeometry(1.25, 0.95, 1.15);
    const tFrontWheelG = new THREE.CylinderGeometry(0.32, 0.32, 0.26, 12);
    const tRearWheelG = new THREE.CylinderGeometry(0.56, 0.56, 0.34, 14);
    const tLightG = new THREE.BoxGeometry(0.24, 0.14, 0.08);
    geometriesToDispose.push(tHullG, tCabG, tFrontWheelG, tRearWheelG, tLightG);

    const hull = new THREE.Mesh(tHullG, tractorRedMat);
    hull.position.set(0, 0.78, 0.2);
    hull.castShadow = !isSoftwareGl;
    tractor.add(hull);

    const cab = new THREE.Mesh(tCabG, cabGlassMat);
    cab.position.set(0, 1.58, -0.45);
    cab.castShadow = !isSoftwareGl;
    tractor.add(cab);

    const wheels: THREE.Mesh[] = [];
    [
      { g: tRearWheelG, x: -0.85, y: 0.56, z: -0.55 },
      { g: tRearWheelG, x: 0.85, y: 0.56, z: -0.55 },
      { g: tFrontWheelG, x: -0.78, y: 0.32, z: 0.9 },
      { g: tFrontWheelG, x: 0.78, y: 0.32, z: 0.9 },
    ].forEach(({ g, x, y, z }) => {
      const w = new THREE.Mesh(g, tireMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, y, z);
      tractor.add(w);
      wheels.push(w);
    });

    [-0.45, 0.45].forEach((lx) => {
      const hl = new THREE.Mesh(tLightG, tractorHeadlightMat);
      hl.position.set(lx, 0.82, 1.32);
      tractor.add(hl);
    });

    tractor.rotation.y = Math.PI / 2;
    tractor.position.set(-28, 0, -7.0);
    cityGroup.add(tractor);
    farmVehicles.push({
      group: tractor,
      axis: 'ew',
      sign: 1,
      pos: -28,
      speed: 4.6,
      wheels,
      loopHalfLen: 56,
    });
  }

  // Build Composite Farm Pickup moving Southbound (+Z) along East Access Road (x = +22.2m)
  {
    const pickup = new THREE.Group();
    const pHullG = new THREE.BoxGeometry(1.56, 0.6, 3.4);
    const pCabG = new THREE.BoxGeometry(1.4, 0.55, 1.35);
    const pWheelG = new THREE.CylinderGeometry(0.35, 0.35, 0.24, 12);
    const pLightG = new THREE.BoxGeometry(0.28, 0.14, 0.08);
    geometriesToDispose.push(pHullG, pCabG, pWheelG, pLightG);

    const hull = new THREE.Mesh(pHullG, pickupGreenMat);
    hull.position.y = 0.58;
    hull.castShadow = !isSoftwareGl;
    pickup.add(hull);

    const cab = new THREE.Mesh(pCabG, cabGlassMat);
    cab.position.set(0, 1.12, 0.25);
    pickup.add(cab);

    const wheels: THREE.Mesh[] = [];
    [
      [-0.82, 1.0],
      [0.82, 1.0],
      [-0.82, -1.0],
      [0.82, -1.0],
    ].forEach(([wx, wz]) => {
      const w = new THREE.Mesh(pWheelG, tireMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.35, wz);
      pickup.add(w);
      wheels.push(w);
    });

    [-0.5, 0.5].forEach((lx) => {
      const hl = new THREE.Mesh(pLightG, tractorHeadlightMat);
      hl.position.set(lx, 0.62, 1.72);
      pickup.add(hl);
    });

    pickup.position.set(22.2, 0, -24);
    cityGroup.add(pickup);
    farmVehicles.push({
      group: pickup,
      axis: 'ns',
      sign: 1,
      pos: -24,
      speed: 6.4,
      wheels,
      loopHalfLen: 56,
    });
  }

  // =========================================================================
  // 10. FARM STATE UPDATE (POSTES <= -3° & CASAS/CELEIRO <= -4.5° + ANIMAÇÕES)
  // =========================================================================
  const farmLightAmbient = new THREE.PointLight(0xffdfb0, 0, 70, 1.5);
  farmLightAmbient.position.set(-14, 10, 0);
  cityGroup.add(farmLightAmbient);

  const updateCityState = (
    solarAltitudeDeg: number,
    elapsedSec: number,
    deltaSec: number
  ): TrafficSignalState => {
    const streetlightsOn = solarAltitudeDeg <= -3.0;
    const buildingsLit = solarAltitudeDeg <= -4.5;

    // 1. Yard Lamp Posts (Postes da Fazenda <= -3.0°)
    bulbMat.emissiveIntensity = streetlightsOn ? 2.4 : 0.0;
    bulbMat.color.setHex(streetlightsOn ? 0xfff3d1 : 0xdbeafe);
    coneMat.opacity = streetlightsOn ? 0.16 : 0.0;
    poolMat.opacity = streetlightsOn ? 0.28 : 0.0;
    for (let i = 0; i < lampCones.length; i++) lampCones[i].visible = streetlightsOn;
    for (let i = 0; i < lampPools.length; i++) lampPools[i].visible = streetlightsOn;
    for (let i = 0; i < farmPointLights.length; i++) {
      farmPointLights[i].intensity = streetlightsOn ? 14.0 : 0.0;
    }

    // 2. Farmhouse & Barn Windows (Casas & Celeiro <= -4.5°)
    buildingWindowMat.emissiveIntensity = buildingsLit ? 1.85 : 0.0;
    farmLightAmbient.intensity = buildingsLit ? 2.6 : 0.0;
    tractorHeadlightMat.emissiveIntensity = streetlightsOn ? 2.2 : 0.35;

    // 3. Spin Farm Windmill Rotor
    if (windmillRotor) {
      windmillRotor.rotation.z -= deltaSec * 1.15;
    }

    // 4. Gentle Animal Grazing Bob
    for (let i = 0; i < animals.length; i++) {
      const a = animals[i];
      const bob = Math.sin(elapsedSec * 1.4 + a.phase);
      a.headGroup.position.y = a.baseY - Math.max(0, bob) * 0.28;
      a.headGroup.rotation.x = Math.max(0, bob) * 0.45;
    }

    // 5. Move Tractor & Pickup smoothly along country roads
    for (let i = 0; i < farmVehicles.length; i++) {
      const v = farmVehicles[i];
      const disp = v.speed * deltaSec;
      v.pos += v.sign * disp;
      const span = v.loopHalfLen * 2;
      if (v.pos > v.loopHalfLen) v.pos -= span;
      else if (v.pos < -v.loopHalfLen) v.pos += span;

      if (v.axis === 'ew') {
        v.group.position.x = v.pos;
      } else {
        v.group.position.z = v.pos;
      }
      const wheelStep = disp / 0.36;
      for (let w = 0; w < v.wheels.length; w++) {
        v.wheels[w].rotation.x += wheelStep;
      }
    }

    return { ew: 'green', ns: 'red' };
  };

  const dispose = () => {
    geometriesToDispose.forEach((g) => g.dispose());
    materialsToDispose.forEach((m) => m.dispose());
    texturesToDispose.forEach((t) => t.dispose());
  };

  return { cityGroup, obstacles, updateCityState, dispose };
}
