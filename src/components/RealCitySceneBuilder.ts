import * as THREE from 'three';
import {
  RealCityBuilding,
  RealCityData,
  RealCityVehicleMode,
} from '../types/solar';

export interface RealCityClickableBuilding {
  building: RealCityBuilding;
  mesh: THREE.Mesh;
}

export interface RealCityActorRig {
  droneGroup: THREE.Group;
  droneRotors: THREE.Mesh[];
  planeGroup: THREE.Group;
  planePropeller: THREE.Group;
  carGroup: THREE.Group;
  carWheelMeshes: THREE.Mesh[];
  carFrontLeftPivot: THREE.Group;
  carFrontRightPivot: THREE.Group;
  carHeadlightMats: THREE.MeshStandardMaterial[];
  carBrakeMat: THREE.MeshStandardMaterial;
}

export interface RealCitySceneHandle {
  cityGroup: THREE.Group;
  data: RealCityData;
  buildings: RealCityBuilding[];
  clickableBuildings: RealCityClickableBuilding[];
  buildingMeshes: THREE.Object3D[];
  actors: RealCityActorRig;
  updateRealCityState: (
    solarAltitudeDeg: number,
    elapsedSec: number,
    deltaSec: number,
    activeVehicleMode: RealCityVehicleMode,
    carSpeedRatio?: number,
    isBraking?: boolean
  ) => void;
  dispose: () => void;
}

function createFacadeTextures(maxAnisotropy: number) {
  const styles = [
    { wall: '#1e293b', frame: '#334155', glass: '#38bdf8', lit: '#fde68a' }, // Vidro azulado corporativo
    { wall: '#9ca3af', frame: '#6b7280', glass: '#475569', lit: '#fef08a' }, // Torre concreto moderno
    { wall: '#9a5b44', frame: '#783f2c', glass: '#334155', lit: '#fed7aa' }, // Tijolo histórico / clássico
    { wall: '#cbd5e1', frame: '#94a3b8', glass: '#0284c7', lit: '#fef9c3' }, // Residencial claro
  ];

  const dayMaps: THREE.CanvasTexture[] = [];
  const emissiveMaps: THREE.CanvasTexture[] = [];

  for (let s = 0; s < styles.length; s++) {
    const st = styles[s];
    const size = 256;
    const dayCanvas = document.createElement('canvas');
    dayCanvas.width = size;
    dayCanvas.height = size;
    const dctx = dayCanvas.getContext('2d')!;

    const emCanvas = document.createElement('canvas');
    emCanvas.width = size;
    emCanvas.height = size;
    const ectx = emCanvas.getContext('2d')!;

    dctx.fillStyle = st.wall;
    dctx.fillRect(0, 0, size, size);
    ectx.fillStyle = '#000000';
    ectx.fillRect(0, 0, size, size);

    const cols = 4;
    const rows = 8;
    const cellW = size / cols;
    const cellH = size / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = c * cellW + 7;
        const wy = r * cellH + 5;
        const ww = cellW - 14;
        const wh = cellH - 10;

        dctx.fillStyle = st.frame;
        dctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
        dctx.fillStyle = st.glass;
        dctx.fillRect(wx, wy, ww, wh);

        const hash = Math.abs(Math.sin((s + 1) * 19.3 + r * 7.1 + c * 13.7));
        if (hash > 0.28) {
          ectx.fillStyle = st.lit;
          ectx.fillRect(wx, wy, ww, wh);
        }
      }
    }

    const dayTex = new THREE.CanvasTexture(dayCanvas);
    dayTex.wrapS = THREE.RepeatWrapping;
    dayTex.wrapT = THREE.RepeatWrapping;
    dayTex.colorSpace = THREE.SRGBColorSpace;
    dayTex.anisotropy = maxAnisotropy;
    dayMaps.push(dayTex);

    const emTex = new THREE.CanvasTexture(emCanvas);
    emTex.wrapS = THREE.RepeatWrapping;
    emTex.wrapT = THREE.RepeatWrapping;
    emTex.colorSpace = THREE.SRGBColorSpace;
    emTex.anisotropy = maxAnisotropy;
    emissiveMaps.push(emTex);
  }

  return { dayMaps, emissiveMaps };
}

function pointArrayToThreeShape(poly: Array<[number, number]>): THREE.Shape | null {
  if (!Array.isArray(poly) || poly.length < 3) return null;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const [x, z] = poly[i];
    // Avoid duplicate consecutive closing point
    if (i > 0 && Math.hypot(x - poly[i - 1][0], z - poly[i - 1][1]) < 0.05) continue;
    // Shape uses (x, -z) so geo.rotateX(-PI/2) maps back cleanly to (x, y_up, +z)
    pts.push(new THREE.Vector2(x, -z));
  }
  if (pts.length < 3) return null;
  if (THREE.ShapeUtils.isClockWise(pts)) {
    pts.reverse();
  }
  const shape = new THREE.Shape(pts);
  shape.closePath();
  return shape;
}

function buildDroneActor(
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): { group: THREE.Group; rotors: THREE.Mesh[] } {
  const group = new THREE.Group();
  const bodyMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.25 })
  );
  const accentMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.4, roughness: 0.3 })
  );
  const rotorMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.2, roughness: 0.4, transparent: true, opacity: 0.85 })
  );
  const ledFrontMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 1.6 })
  );
  const ledRearMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.6 })
  );

  const hub = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.55, 0.16, 0.72)), bodyMat);
  hub.castShadow = true;
  group.add(hub);

  const topShell = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.1, 0.54)), accentMat);
  topShell.position.y = 0.11;
  group.add(topShell);

  const gimbal = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.11, 12, 12)), bodyMat);
  gimbal.position.set(0, -0.11, -0.22);
  group.add(gimbal);

  const armOffsets: Array<[number, number, number, boolean]> = [
    [-0.48, 0.03, -0.48, true],
    [0.48, 0.03, -0.48, true],
    [-0.48, 0.03, 0.48, false],
    [0.48, 0.03, 0.48, false],
  ];

  const rotors: THREE.Mesh[] = [];
  armOffsets.forEach(([ax, ay, az, isFront]) => {
    const arm = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 0.72, 8)), bodyMat);
    arm.position.set(ax * 0.5, ay, az * 0.5);
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = Math.atan2(az, ax);
    group.add(arm);

    const motor = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.075, 0.075, 0.11, 10)), bodyMat);
    motor.position.set(ax, ay + 0.04, az);
    group.add(motor);

    const guard = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.28, 0.018, 6, 18)), accentMat);
    guard.rotation.x = Math.PI / 2;
    guard.position.set(ax, ay + 0.08, az);
    group.add(guard);

    const blade = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.48, 0.014, 0.055)), rotorMat);
    blade.position.set(ax, ay + 0.11, az);
    group.add(blade);
    rotors.push(blade);

    const led = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.042, 8, 8)),
      isFront ? ledFrontMat : ledRearMat
    );
    led.position.set(ax, ay - 0.04, az);
    group.add(led);
  });

  return { group, rotors };
}

function buildPlaneActor(
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
): { group: THREE.Group; propeller: THREE.Group } {
  const group = new THREE.Group();

  const fuseMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.35, roughness: 0.25 })
  );
  const stripeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.3, roughness: 0.3 })
  );
  const glassMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.85, roughness: 0.12 })
  );
  const darkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.45 })
  );
  const navGreen = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 1.5 })
  );
  const navRed = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.5 })
  );

  // Fuselage pointing forward along -Z
  const fuselage = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.38, 0.22, 3.6, 14)), fuseMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.castShadow = true;
  group.add(fuselage);

  const noseCone = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.38, 0.85, 14)), stripeMat);
  noseCone.rotation.x = -Math.PI / 2;
  noseCone.position.z = -2.2;
  group.add(noseCone);

  const canopy = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.54, 0.36, 1.15)), glassMat);
  canopy.position.set(0, 0.34, -0.45);
  group.add(canopy);

  // Swept Main Wings
  const wing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.6, 0.08, 0.88)), fuseMat);
  wing.position.set(0, 0.12, -0.35);
  wing.castShadow = true;
  group.add(wing);

  const stripeWing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.4, 0.09, 0.18)), stripeMat);
  stripeWing.position.set(0, 0.12, -0.52);
  group.add(stripeWing);

  // Wingtip Navigation Lights (Port/Left Red, Starboard/Right Green)
  const leftTip = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.08, 8, 8)), navRed);
  leftTip.position.set(-2.32, 0.14, -0.35);
  group.add(leftTip);

  const rightTip = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.08, 8, 8)), navGreen);
  rightTip.position.set(2.32, 0.14, -0.35);
  group.add(rightTip);

  // Tail Stabilizer + Vertical Fin
  const tailHoriz = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.65, 0.06, 0.48)), stripeMat);
  tailHoriz.position.set(0, 0.1, 1.55);
  group.add(tailHoriz);

  const tailFin = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.72, 0.56)), stripeMat);
  tailFin.position.set(0, 0.42, 1.55);
  group.add(tailFin);

  // Tricycle landing skids
  const skidL = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 6)), darkMat);
  skidL.position.set(-0.5, -0.45, -0.3);
  group.add(skidL);
  const skidR = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 6)), darkMat);
  skidR.position.set(0.5, -0.45, -0.3);
  group.add(skidR);

  // Front Propeller Assembly
  const propGroup = new THREE.Group();
  propGroup.position.set(0, 0, -2.65);
  const propBlade1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.35, 0.1, 0.03)), darkMat);
  const propBlade2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 1.35, 0.03)), darkMat);
  propGroup.add(propBlade1, propBlade2);
  group.add(propGroup);

  return { group, propeller: propGroup };
}

function buildCarActor(
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  trackMat: <T extends THREE.Material>(m: T) => T
) {
  const group = new THREE.Group();

  const bodyMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.65, roughness: 0.22 })
  );
  const cabinMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.85, roughness: 0.15 })
  );
  const tireMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 })
  );
  const rimMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.25 })
  );
  const headMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff3c4,
      emissiveIntensity: 0.2,
    })
  );
  const brakeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0xef4444,
      emissiveIntensity: 0.4,
    })
  );

  // Car oriented forward along -Z
  const chassis = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.75, 0.56, 3.8)), bodyMat);
  chassis.position.y = 0.52;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  const cabin = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.48, 0.48, 1.9)), cabinMat);
  cabin.position.set(0, 0.98, 0.15);
  cabin.castShadow = true;
  group.add(cabin);

  // Headlights (front = -Z)
  [-0.58, 0.58].forEach((hx) => {
    const hl = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.14, 0.08)), headMat);
    hl.position.set(hx, 0.54, -1.91);
    group.add(hl);
  });

  // Tail / brake lights (rear = +Z)
  [-0.58, 0.58].forEach((tx) => {
    const tl = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.14, 0.08)), brakeMat);
    tl.position.set(tx, 0.56, 1.91);
    group.add(tl);
  });

  const tireGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.24, 14));
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.25, 10));
  rimGeo.rotateZ(Math.PI / 2);

  const wheelMeshes: THREE.Mesh[] = [];
  const createWheelAt = (wx: number, wz: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.32, wz);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    tire.add(rim);
    tire.castShadow = true;
    pivot.add(tire);
    group.add(pivot);
    wheelMeshes.push(tire);
    return pivot;
  };

  const frontLeftPivot = createWheelAt(-0.88, -1.18);
  const frontRightPivot = createWheelAt(0.88, -1.18);
  createWheelAt(-0.88, 1.18);
  createWheelAt(0.88, 1.18);

  return {
    group,
    wheelMeshes,
    frontLeftPivot,
    frontRightPivot,
    headlightMats: [headMat],
    brakeMat,
  };
}

export function buildRealCityScene(
  data: RealCityData,
  maxAnisotropy: number,
  isSoftwareGl: boolean
): RealCitySceneHandle {
  const cityGroup = new THREE.Group();
  cityGroup.name = 'realCityGroup';

  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const materialsToDispose: THREE.Material[] = [];
  const texturesToDispose: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometriesToDispose.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materialsToDispose.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    texturesToDispose.push(t);
    return t;
  };

  // 1. Base Urban Ground Plane (4,000m x 4,000m metropolitan foundation)
  const groundMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x28303b,
      roughness: 0.92,
      metalness: 0.05,
    })
  );
  const groundMesh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(4000, 4000)), groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -0.02;
  groundMesh.receiveShadow = !isSoftwareGl;
  cityGroup.add(groundMesh);

  // 2. Real Parks & Water Polygons
  const parkMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x2e5c35, roughness: 0.9, side: THREE.DoubleSide })
  );
  data.parks.forEach((p) => {
    const shape = pointArrayToThreeShape(p.polygon);
    if (!shape) return;
    const geo = trackGeo(new THREE.ShapeGeometry(shape));
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, parkMat);
    mesh.position.y = 0.015;
    mesh.receiveShadow = !isSoftwareGl;
    cityGroup.add(mesh);
  });

  const waterMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0e4d7a,
      roughness: 0.16,
      metalness: 0.72,
      side: THREE.DoubleSide,
    })
  );
  data.waters.forEach((w) => {
    const shape = pointArrayToThreeShape(w.polygon);
    if (!shape) return;
    const geo = trackGeo(new THREE.ShapeGeometry(shape));
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, waterMat);
    mesh.position.y = 0.01;
    cityGroup.add(mesh);
  });

  // 3. Real Streets & Avenues + Streetlights
  const roadMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x161b22, roughness: 0.88, metalness: 0.06 })
  );
  const stripeMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.7 })
  );
  const lampPoleMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.35 })
  );
  const lampBulbMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xffd166,
      emissiveIntensity: 0,
    })
  );

  const lampPositions: Array<[number, number]> = [];

  data.roads.forEach((road, rIdx) => {
    for (let i = 0; i < road.points.length - 1; i++) {
      const [x1, z1] = road.points[i];
      const [x2, z2] = road.points[i + 1];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const segLen = Math.hypot(dx, dz);
      if (segLen < 0.8) continue;

      const midX = (x1 + x2) / 2;
      const midZ = (z1 + z2) / 2;
      const angle = Math.atan2(dx, dz);

      const segMesh = new THREE.Mesh(
        trackGeo(new THREE.PlaneGeometry(road.width, segLen + road.width * 0.45)),
        roadMat
      );
      segMesh.rotation.order = 'YXZ';
      segMesh.rotation.y = angle;
      segMesh.rotation.x = -Math.PI / 2;
      segMesh.position.set(midX, 0.025, midZ);
      segMesh.receiveShadow = !isSoftwareGl;
      cityGroup.add(segMesh);

      if (road.width >= 5.5 && segLen > 4) {
        const lineMesh = new THREE.Mesh(
          trackGeo(new THREE.PlaneGeometry(0.16, segLen)),
          stripeMat
        );
        lineMesh.rotation.order = 'YXZ';
        lineMesh.rotation.y = angle;
        lineMesh.rotation.x = -Math.PI / 2;
        lineMesh.position.set(midX, 0.032, midZ);
        cityGroup.add(lineMesh);
      }

      if (i % 2 === 0 && lampPositions.length < 32 && rIdx % 2 === 0 && segLen > 7) {
        const nx = (dz / segLen) * (road.width * 0.55 + 0.5);
        const nz = (-dx / segLen) * (road.width * 0.55 + 0.5);
        lampPositions.push([midX + nx, midZ + nz]);
      }
    }
  });

  // Build streetlamp meshes (shared bulb material turns ON <= -3.0°) + real street PointLights
  const poleGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.11, 5.2, 6));
  const bulbGeo = trackGeo(new THREE.SphereGeometry(0.24, 8, 8));
  const realCityPointLights: THREE.PointLight[] = [];
  const lightStride = Math.max(1, Math.floor(lampPositions.length / 6));
  lampPositions.forEach(([lx, lz], idx) => {
    const pole = new THREE.Mesh(poleGeo, lampPoleMat);
    pole.position.set(lx, 2.6, lz);
    cityGroup.add(pole);

    const bulb = new THREE.Mesh(bulbGeo, lampBulbMat);
    bulb.position.set(lx, 5.25, lz);
    cityGroup.add(bulb);

    if (idx % lightStride === 0 && realCityPointLights.length < 6) {
      const pt = new THREE.PointLight(0xffcb6b, 0, 42, 1.55);
      pt.position.set(lx, 5.1, lz);
      cityGroup.add(pt);
      realCityPointLights.push(pt);
    }
  });

  const realCityGlowAmbient = new THREE.PointLight(0xffdfb0, 0, 160, 1.35);
  realCityGlowAmbient.position.set(0, 22, 0);
  cityGroup.add(realCityGlowAmbient);

  // 4. Compact Solar Spawn Marker at Spawn Point
  const [sx, sz] = data.spawnPoint;
  const padMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.75, roughness: 0.3 })
  );
  const padRing = new THREE.Mesh(trackGeo(new THREE.RingGeometry(1.1, 1.35, 24)), padMat);
  padRing.rotation.x = -Math.PI / 2;
  padRing.position.set(sx, 0.038, sz);
  cityGroup.add(padRing);

  // 5. Extruded 3D Real City Buildings (Walkable Flat Rooftops + Clickable Raycaster Targets)
  const { dayMaps, emissiveMaps } = createFacadeTextures(maxAnisotropy);
  dayMaps.forEach(trackTex);
  emissiveMaps.forEach(trackTex);

  const wallMats = dayMaps.map((dMap, idx) =>
    trackMat(
      new THREE.MeshStandardMaterial({
        map: dMap,
        emissive: new THREE.Color(0xfff4c2),
        emissiveMap: emissiveMaps[idx],
        emissiveIntensity: 0,
        roughness: idx === 0 ? 0.25 : 0.65,
        metalness: idx === 0 ? 0.55 : 0.12,
        side: THREE.DoubleSide,
      })
    )
  );
  const roofMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85, metalness: 0.1, side: THREE.DoubleSide })
  );
  const acUnitMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5, metalness: 0.5 })
  );

  const clickableBuildings: RealCityClickableBuilding[] = [];
  const buildingMeshes: THREE.Object3D[] = [];

  // Sort closer buildings first so downtown core uses rich extruded footprints & click targets,
  // while sprawling outer districts use GPU-instanced skyscrapers (1 draw call per style).
  const sortedBuildings = [...data.buildings].sort(
    (a, b) => a.cx * a.cx + a.cz * a.cz - (b.cx * b.cx + b.cz * b.cz)
  );
  const EXTRUDED_DETAIL_LIMIT = 180;
  const detailedBuildings = sortedBuildings.slice(0, EXTRUDED_DETAIL_LIMIT);
  const instancedBuildings = sortedBuildings.slice(EXTRUDED_DETAIL_LIMIT);

  detailedBuildings.forEach((b) => {
    const shape = pointArrayToThreeShape(b.polygon);
    if (!shape) return;

    const extGeo = trackGeo(
      new THREE.ExtrudeGeometry(shape, {
        depth: b.height,
        bevelEnabled: false,
        curveSegments: 1,
      })
    );
    extGeo.rotateX(-Math.PI / 2);

    const styleMatWall = wallMats[b.styleIdx % wallMats.length];
    const mesh = new THREE.Mesh(extGeo, [roofMat, styleMatWall]);
    mesh.castShadow = !isSoftwareGl;
    mesh.receiveShadow = !isSoftwareGl;
    mesh.userData.realBuildingId = b.id;
    cityGroup.add(mesh);

    clickableBuildings.push({ building: b, mesh });
    buildingMeshes.push(mesh);

    if (b.height >= 12) {
      const bw = Math.min(2.6, (b.maxX - b.minX) * 0.32);
      const bd = Math.min(2.6, (b.maxZ - b.minZ) * 0.32);
      const pent = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(bw, 1.3, bd)), acUnitMat);
      pent.position.set(b.cx + bw * 0.45, b.height + 0.65, b.cz - bd * 0.45);
      cityGroup.add(pent);
    }
  });

  if (instancedBuildings.length > 0) {
    const styleBuckets: RealCityBuilding[][] = [[], [], [], []];
    instancedBuildings.forEach((b) => {
      styleBuckets[b.styleIdx % 4].push(b);
    });

    const unitBoxGeo = trackGeo(new THREE.BoxGeometry(1, 1, 1));
    const unitRoofGeo = trackGeo(new THREE.BoxGeometry(1, 1, 1));
    const dummy = new THREE.Object3D();

    styleBuckets.forEach((bucket, sIdx) => {
      if (bucket.length === 0) return;
      const wallInst = new THREE.InstancedMesh(unitBoxGeo, wallMats[sIdx], bucket.length);
      wallInst.castShadow = !isSoftwareGl;
      wallInst.receiveShadow = !isSoftwareGl;

      const capInst = new THREE.InstancedMesh(unitRoofGeo, roofMat, bucket.length);
      bucket.forEach((b, i) => {
        const bw = Math.max(2.5, b.maxX - b.minX);
        const bd = Math.max(2.5, b.maxZ - b.minZ);
        dummy.position.set(b.cx, b.height * 0.5, b.cz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(bw, b.height, bd);
        dummy.updateMatrix();
        wallInst.setMatrixAt(i, dummy.matrix);

        dummy.position.set(b.cx, b.height + 0.12, b.cz);
        dummy.scale.set(bw * 0.94, 0.24, bd * 0.94);
        dummy.updateMatrix();
        capInst.setMatrixAt(i, dummy.matrix);
      });
      wallInst.instanceMatrix.needsUpdate = true;
      wallInst.computeBoundingSphere();
      capInst.instanceMatrix.needsUpdate = true;
      capInst.computeBoundingSphere();
      cityGroup.add(wallInst);
      cityGroup.add(capInst);
    });
  }

  // 6. Build Controllable Drone, Airplane & Drivable Car
  const droneRig = buildDroneActor(trackGeo, trackMat);
  droneRig.group.position.set(sx + 2.4, 0.3, sz);
  cityGroup.add(droneRig.group);

  const planeRig = buildPlaneActor(trackGeo, trackMat);
  planeRig.group.position.set(sx, 1.1, sz - 5);
  planeRig.group.visible = false;
  cityGroup.add(planeRig.group);

  const carRig = buildCarActor(trackGeo, trackMat);
  carRig.group.position.set(sx - 2.6, 0.03, sz + 1.5);
  cityGroup.add(carRig.group);

  const actors: RealCityActorRig = {
    droneGroup: droneRig.group,
    droneRotors: droneRig.rotors,
    planeGroup: planeRig.group,
    planePropeller: planeRig.propeller,
    carGroup: carRig.group,
    carWheelMeshes: carRig.wheelMeshes,
    carFrontLeftPivot: carRig.frontLeftPivot,
    carFrontRightPivot: carRig.frontRightPivot,
    carHeadlightMats: carRig.headlightMats,
    carBrakeMat: carRig.brakeMat,
  };

  return {
    cityGroup,
    data,
    buildings: data.buildings,
    clickableBuildings,
    buildingMeshes,
    actors,
    updateRealCityState: (
      solarAltitudeDeg: number,
      _elapsedSec: number,
      deltaSec: number,
      activeVehicleMode: RealCityVehicleMode,
      carSpeedRatio = 0,
      isBraking = false
    ) => {
      // Streetlights + Car Headlights at solarAltitudeDeg <= -3.0°
      const polesOn = solarAltitudeDeg <= -3.0;
      const poleGlow = polesOn ? Math.min(1, (-3.0 - solarAltitudeDeg) / 2.5 + 0.55) : 0;
      lampBulbMat.emissiveIntensity = poleGlow * 2.4;
      for (let i = 0; i < realCityPointLights.length; i++) {
        realCityPointLights[i].intensity = polesOn ? 15.0 * poleGlow : 0.0;
      }

      // Building illuminated windows at solarAltitudeDeg <= -4.5°
      const buildingsLit = solarAltitudeDeg <= -4.5;
      const windowGlow = buildingsLit ? Math.min(1, (-4.5 - solarAltitudeDeg) / 2.5 + 0.6) : 0;
      for (let i = 0; i < wallMats.length; i++) {
        wallMats[i].emissiveIntensity = windowGlow * 1.45;
      }
      realCityGlowAmbient.intensity = buildingsLit ? 3.2 * windowGlow : 0.0;

      // Actor visibility & animated propellers / wheels
      actors.droneGroup.visible = activeVehicleMode === 'drone' || activeVehicleMode === 'walk';
      actors.planeGroup.visible = activeVehicleMode === 'plane';
      actors.carGroup.visible = activeVehicleMode === 'car' || activeVehicleMode === 'walk';

      if (activeVehicleMode === 'drone') {
        const spin = deltaSec * 42;
        for (let i = 0; i < actors.droneRotors.length; i++) {
          actors.droneRotors[i].rotation.y += i % 2 === 0 ? spin : -spin;
        }
      }

      if (activeVehicleMode === 'plane') {
        actors.planePropeller.rotation.z += deltaSec * 48;
      }

      if (activeVehicleMode === 'car') {
        const wheelSpin = carSpeedRatio * deltaSec * 18;
        for (let i = 0; i < actors.carWheelMeshes.length; i++) {
          actors.carWheelMeshes[i].rotation.x += wheelSpin;
        }
      }

      const headlightIntensity = polesOn ? 2.6 : 0.25;
      actors.carHeadlightMats.forEach((m) => {
        m.emissiveIntensity = headlightIntensity;
      });
      actors.carBrakeMat.emissiveIntensity = isBraking ? 2.4 : polesOn ? 0.75 : 0.35;
    },
    dispose: () => {
      geometriesToDispose.forEach((g) => g.dispose());
      materialsToDispose.forEach((m) => m.dispose());
      texturesToDispose.forEach((t) => t.dispose());
    },
  };
}
