import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
  SolarCalculationResult,
  SolarInputParameters,
  LandscapeSceneType,
  SolarClockVersion,
  WorldVisualStyle,
  RealCityData,
  RealCityVehicleMode,
  RealCityTelemetry,
  RealCityBuilding,
  DroneCameraTelemetry,
  PLANE_MIN_CEILING_M,
  PLANE_MAX_CEILING_M,
  PLANE_DEFAULT_CEILING_M,
  PLANE_MIN_FLIGHT_DURATION_SEC,
  PLANE_MAX_FLIGHT_DURATION_SEC,
  PlaneTravelSpeedMode,
  PlaneFlightPlan,
} from '../types/solar';
import { buildCityScene, CitySceneHandle, CityObstacleBox, TrafficSignalState } from './CitySceneBuilder';
import { buildFarmScene } from './FarmSceneBuilder';
import { buildRealCityScene, RealCitySceneHandle } from './RealCitySceneBuilder';
import { buildSolarTimeScene, SolarTimeSceneHandle } from './SolarTimeSceneBuilder';
import { buildRealEarthGlobe, RealEarthGlobeHandle } from './RealEarthGlobeBuilder';
import { resolveLocalCityVisualProfile } from '../services/localCityVisualService';
import { interpolateEarthCoord } from '../services/realCityService';

const ViceCityGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0.0 },
    uGrainIntensity: { value: 0.032 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrainIntensity;
    varying vec2 vUv;

    float filmHash(vec2 co, float t) {
      return fract(sin(dot(co + fract(t * 0.37), vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 col = tex.rgb;

      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));

      // 1. Cool teal shadows (nostalgic 1986 Vice City shadow split)
      float shadowMask = pow(clamp(1.0 - lum * 2.05, 0.0, 1.0), 1.35);
      vec3 tealShadows = vec3(0.03, 0.25, 0.32);
      col = mix(col, max(col * 0.92, tealShadows * (0.42 + lum * 1.15)), shadowMask * 0.36);

      // 2. Pastel pink & coral mid-upper accents
      float midMask = sin(clamp(lum, 0.0, 1.0) * 3.14159);
      col = mix(col, col * vec3(1.06, 0.94, 0.98) + vec3(0.035, 0.008, 0.022), midMask * 0.28);

      // 3. Warm golden sun highlights
      float highMask = smoothstep(0.45, 0.98, lum);
      col = mix(col, col * vec3(1.10, 0.98, 0.80) + vec3(0.03, 0.015, 0.0), highMask * 0.42);

      // 4. High vibrance without harsh clipping
      float maxC = max(col.r, max(col.g, col.b));
      float minC = min(col.r, min(col.g, col.b));
      float sat = maxC - minC;
      float avg = (col.r + col.g + col.b) / 3.0;
      float vibranceAmt = 0.40 * (1.0 - clamp(sat * 1.35, 0.0, 1.0));
      col = mix(vec3(avg), col, 1.0 + vibranceAmt + 0.14);

      // 5. Subtle 1986 nostalgic lens contrast + gentle corner warmth
      col = (col - 0.5) * 1.06 + 0.5;
      float dist = distance(vUv, vec2(0.5));
      col *= smoothstep(0.98, 0.32, dist) * 0.14 + 0.86;

      // 6. Fine 35mm analog film grain
      float grain = (filmHash(vUv * 512.0, uTime) - 0.5) * uGrainIntensity;
      col += vec3(grain * 1.02, grain * 0.96, grain * 1.05);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), tex.a);
    }
  `,
};

export type CameraPreset =
  | 'free360'
  | 'person'
  | 'drone'
  | 'ground'
  | 'zenith'
  // Câmera 360° Elevada / Panorâmica (8 Direções)
  | 'north'
  | 'northeast'
  | 'east'
  | 'southeast'
  | 'south'
  | 'southwest'
  | 'west'
  | 'northwest'
  // Câmera Exatamente no Chão (8 Direções ao Rés do Solo)
  | 'ground_north'
  | 'ground_northeast'
  | 'ground_east'
  | 'ground_southeast'
  | 'ground_south'
  | 'ground_southwest'
  | 'ground_west'
  | 'ground_northwest';

export interface PersonMoveInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  ascend?: boolean;
  descend?: boolean;
}

const isInteractiveTheme = (theme: LandscapeSceneType): boolean =>
  theme === 'city_cars' ||
  theme === 'city_people' ||
  theme === 'city_real' ||
  theme === 'farm' ||
  theme === 'solar_time';

interface SolarWorld3DProps {
  solarParams: SolarInputParameters;
  solarResults: SolarCalculationResult;
  viewMode: 'landscape' | 'globe';
  sceneTheme: LandscapeSceneType;
  solarClockVersion?: SolarClockVersion;
  solarWallAzimuthDeg?: number | null;
  solarFloorAzimuthDeg?: number;
  visualStyle?: WorldVisualStyle;
  cameraPreset: CameraPreset;
  showShadowRing: boolean;
  showVectors: boolean;
  personMoveRef?: React.MutableRefObject<PersonMoveInput>;
  onTrafficSignalChange?: (signal: TrafficSignalState) => void;
  onSelectCoordinates?: (lat: number, lon: number) => void;
  realCityData?: RealCityData | null;
  realCityVehicleMode?: RealCityVehicleMode;
  planeMaxAltitudeM?: number;
  planeTravelSpeedMode?: PlaneTravelSpeedMode;
  planeFlightPlan?: PlaneFlightPlan | null;
  onPlaneGeoMove?: (lat: number, lng: number) => void;
  onPlaneFlightComplete?: (plan: PlaneFlightPlan) => void;
  onRealCityTelemetry?: (telemetry: RealCityTelemetry) => void;
  onDroneTelemetry?: (telemetry: DroneCameraTelemetry) => void;
  realCityActionRef?: React.MutableRefObject<{ action: 'climb_nearest' | 'descend' | null }>;
}

export const SolarWorld3D: React.FC<SolarWorld3DProps> = ({
  solarParams,
  solarResults,
  viewMode,
  sceneTheme,
  solarClockVersion = 'floor_horizontal',
  solarWallAzimuthDeg = null,
  solarFloorAzimuthDeg = 0,
  visualStyle = 'real_life',
  cameraPreset,
  showShadowRing,
  showVectors,
  personMoveRef,
  onTrafficSignalChange,
  onSelectCoordinates,
  realCityData,
  realCityVehicleMode = 'walk',
  planeMaxAltitudeM = PLANE_DEFAULT_CEILING_M,
  planeTravelSpeedMode = 'city',
  planeFlightPlan = null,
  onPlaneGeoMove,
  onPlaneFlightComplete,
  onRealCityTelemetry,
  onDroneTelemetry,
  realCityActionRef,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Refs for three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Scene elements refs
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const moonLightRef = useRef<THREE.DirectionalLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  const sunBeamLineRef = useRef<THREE.Line | null>(null);
  const lastShadowRangeRef = useRef<number>(42);
  
  // Globe refs
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const realEarthHandleRef = useRef<RealEarthGlobeHandle | null>(null);
  const globeSunDirRef = useRef<THREE.Vector3>(new THREE.Vector3(1, 0, 0));
  const observerPinRef = useRef<THREE.Group | null>(null);
  const subsolarPinRef = useRef<THREE.Group | null>(null);

  // Sky Shader, Earth Horizon & Scene Scenario refs
  const skyMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const skyMeshRef = useRef<THREE.Mesh | null>(null);
  const earthHorizonMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const baseFogDensityRef = useRef<number>(0.0038);
  const defaultSceneGroupRef = useRef<THREE.Group | null>(null);
  const landscapeGroupRef = useRef<THREE.Group | null>(null);
  const cityCarsHandleRef = useRef<CitySceneHandle | null>(null);
  const cityPeopleHandleRef = useRef<CitySceneHandle | null>(null);
  const farmHandleRef = useRef<CitySceneHandle | null>(null);
  const realCityHandleRef = useRef<RealCitySceneHandle | null>(null);
  const solarTimeHandleRef = useRef<SolarTimeSceneHandle | null>(null);
  const maxAnisotropyRef = useRef<number>(4);
  const isSoftwareGlRef = useRef<boolean>(false);
  const sceneThemeRef = useRef<LandscapeSceneType>(sceneTheme);
  const viewModeRef = useRef<'landscape' | 'globe'>(viewMode);
  viewModeRef.current = viewMode;
  const onSelectCoordinatesRef = useRef(onSelectCoordinates);
  onSelectCoordinatesRef.current = onSelectCoordinates;
  const solarClockVersionRef = useRef<SolarClockVersion>(solarClockVersion);
  solarClockVersionRef.current = solarClockVersion;
  const solarWallAzimuthRef = useRef<number | null>(solarWallAzimuthDeg);
  solarWallAzimuthRef.current = solarWallAzimuthDeg;
  const solarFloorAzimuthRef = useRef<number>(solarFloorAzimuthDeg);
  solarFloorAzimuthRef.current = solarFloorAzimuthDeg;
  const visualStyleRef = useRef<WorldVisualStyle>(visualStyle);
  visualStyleRef.current = visualStyle;
  const composerRef = useRef<EffectComposer | null>(null);
  const viceCityPassRef = useRef<ShaderPass | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const solarLatRef = useRef<number>(solarParams.latitude);
  solarLatRef.current = solarParams.latitude;
  const solarLngRef = useRef<number>(solarParams.longitude);
  solarLngRef.current = solarParams.longitude;
  const solarAltitudeRef = useRef<number>(solarResults.solarAltitudeDeg);
  const solarAzRef = useRef<number>(solarResults.solarAzimuthDeg);
  solarAzRef.current = solarResults.solarAzimuthDeg;
  const lightVectorRef = useRef(solarResults.lightVector3D);
  lightVectorRef.current = solarResults.lightVector3D;
  const lstMinutesRef = useRef<number>(solarResults.lstLocalMinutes);
  lstMinutesRef.current = solarResults.lstLocalMinutes;
  const civilHoursRef = useRef<number>(solarResults.localCivilHourFraction);
  civilHoursRef.current = solarResults.localCivilHourFraction;
  const activeInteractiveRef = useRef<boolean>(
    viewMode === 'landscape' && isInteractiveTheme(sceneTheme)
  );

  // Modo Pessoa & Drone na Câmera & Real City Drone/Airplane/Car state refs
  const isPersonMode =
    viewMode === 'landscape' && isInteractiveTheme(sceneTheme) && cameraPreset === 'person';
  const isDroneCamMode = viewMode === 'landscape' && cameraPreset === 'drone';
  const isPersonModeRef = useRef<boolean>(isPersonMode);
  const isDroneCamModeRef = useRef<boolean>(isDroneCamMode);
  const realCityVehicleModeRef = useRef<RealCityVehicleMode>(realCityVehicleMode);
  realCityVehicleModeRef.current = realCityVehicleMode;
  const planeMaxAltitudeRef = useRef<number>(planeMaxAltitudeM);
  planeMaxAltitudeRef.current = Math.max(
    PLANE_MIN_CEILING_M,
    Math.min(PLANE_MAX_CEILING_M, planeMaxAltitudeM)
  );
  const planeTravelSpeedModeRef = useRef<PlaneTravelSpeedMode>(planeTravelSpeedMode);
  planeTravelSpeedModeRef.current = planeTravelSpeedMode;
  const planeFlightPlanRef = useRef<PlaneFlightPlan | null>(planeFlightPlan);
  const flightTrackerRef = useRef<{ planId: number; elapsedSec: number; completedId: number }>({
    planId: -1,
    elapsedSec: 0,
    completedId: -1,
  });
  if (planeFlightPlan && planeFlightPlan.id !== flightTrackerRef.current.planId) {
    flightTrackerRef.current.planId = planeFlightPlan.id;
    flightTrackerRef.current.elapsedSec = 0;
  }
  planeFlightPlanRef.current = planeFlightPlan;

  const liveGeoRef = useRef<{ lat: number; lng: number }>({
    lat: realCityData?.latitude ?? solarParams.latitude,
    lng: realCityData?.longitude ?? solarParams.longitude,
  });
  const onPlaneGeoMoveRef = useRef(onPlaneGeoMove);
  onPlaneGeoMoveRef.current = onPlaneGeoMove;
  const onPlaneFlightCompleteRef = useRef(onPlaneFlightComplete);
  onPlaneFlightCompleteRef.current = onPlaneFlightComplete;
  const lastGeoEmitMsRef = useRef<number>(0);

  const externalRealCityActionRef = useRef(realCityActionRef);
  externalRealCityActionRef.current = realCityActionRef;
  const onRealCityTelemetryRef = useRef(onRealCityTelemetry);
  onRealCityTelemetryRef.current = onRealCityTelemetry;
  const onDroneTelemetryRef = useRef(onDroneTelemetry);
  onDroneTelemetryRef.current = onDroneTelemetry;
  const lastTelemetryEmitMsRef = useRef<number>(0);

  const droneCamStateRef = useRef({
    pos: new THREE.Vector3(0, 12, 18),
    vel: new THREE.Vector3(0, 0, 0),
    yaw: 0,
    pitch: -0.28,
    roll: 0,
  });
  const droneEulerRef = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));

  const personStateRef = useRef({
    pos: new THREE.Vector3(-6.8, 1.78, 10.5),
    yaw: Math.atan2(6.8, -10.5),
    pitch: 0.04,
    floorY: 0,
    onBuildingName: null as string | null,
  });

  const vehicleStateRef = useRef({
    dronePos: new THREE.Vector3(2.4, 8.5, 6),
    droneVel: new THREE.Vector3(0, 0, 0),
    droneYaw: 0,
    planePos: new THREE.Vector3(0, 34, 20),
    planeYaw: 0,
    planePitch: 0,
    planeBank: 0,
    planeSpeed: 24,
    carPos: new THREE.Vector3(-2.6, 0.03, 7.5),
    carYaw: 0,
    carSpeed: 0,
    carSteer: 0,
    chaseYawOffset: 0,
    chasePitchOffset: 0.24,
  });

  const keysPressedRef = useRef<Record<string, boolean>>({});
  const externalPersonMoveRef = useRef(personMoveRef);
  externalPersonMoveRef.current = personMoveRef;
  const onTrafficSignalChangeRef = useRef(onTrafficSignalChange);
  onTrafficSignalChangeRef.current = onTrafficSignalChange;
  const lastSignalSentRef = useRef<TrafficSignalState>({ ew: 'green', ns: 'red' });

  // Animation frame ID
  const animFrameIdRef = useRef<number | null>(null);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Detect Software WebGL
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();
    isSoftwareGlRef.current = isSoftwareGl;

    // 2. Setup Renderer
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    maxAnisotropyRef.current = renderer.capabilities.getMaxAnisotropy();

    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.fog = new THREE.FogExp2(0x050a18, 0.0044);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 16000);
    camera.position.set(0, 8, 16);
    cameraRef.current = camera;

    // 4. OrbitControls allowing full 360° movement everywhere
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    // UNRESTRICTED 360° POLAR ANGLE (0 to PI) FOR FULL FREE MOVEMENT
    controls.minPolarAngle = 0.001;
    controls.maxPolarAngle = Math.PI - 0.001;
    controls.minDistance = 1;
    controls.maxDistance = 240;
    controlsRef.current = controls;

    // 5. Studio Environment Map (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 6. Lighting Rig (Real-World Sun, Sky Dome Bounce & Subtle Night Moonlight)
    const sunLight = new THREE.DirectionalLight(0xfff4d6, 2.2);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 240;
    const shadowD = 42;
    sunLight.shadow.camera.left = -shadowD;
    sunLight.shadow.camera.right = shadowD;
    sunLight.shadow.camera.top = shadowD;
    sunLight.shadow.camera.bottom = -shadowD;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.03;
    scene.add(sunLight);
    scene.add(sunLight.target);
    sunLightRef.current = sunLight;

    const moonLight = new THREE.DirectionalLight(0x9bb8e8, 0.0);
    moonLight.castShadow = false;
    scene.add(moonLight);
    moonLightRef.current = moonLight;

    const hemiLight = new THREE.HemisphereLight(0x429bf5, 0x1e293b, 0.65);
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    // Visual Sun sphere (radius 3.85 at distance 640 -> ~0.69° solar apparent angular diameter)
    const sunGeo = new THREE.SphereGeometry(3.85, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffae6, fog: false });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sunMesh);
    sunMeshRef.current = sunMesh;

    // ==========================================
    // BUILD 1: LANDSCAPE ENVIRONMENT (SKY, SOLAR BEAM + DEFAULT & CITY SCENARIOS)
    // ==========================================
    const landscapeGroup = new THREE.Group();
    landscapeGroup.name = 'landscapeGroup';
    landscapeGroupRef.current = landscapeGroup;

    const defaultSceneGroup = new THREE.Group();
    defaultSceneGroup.name = 'defaultSceneGroup';
    defaultSceneGroupRef.current = defaultSceneGroup;

    // Procedural Ground Terrain
    const groundGeo = new THREE.PlaneGeometry(120, 120, 64, 64);
    
    // Canvas Texture for Ground Surface
    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = 512;
    groundCanvas.height = 512;
    const gctx = groundCanvas.getContext('2d')!;
    gctx.fillStyle = '#1e293b';
    gctx.fillRect(0, 0, 512, 512);
    gctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    gctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 32) {
      gctx.beginPath(); gctx.moveTo(i, 0); gctx.lineTo(i, 512); gctx.stroke();
      gctx.beginPath(); gctx.moveTo(0, i); gctx.lineTo(512, i); gctx.stroke();
    }
    const groundTexture = new THREE.CanvasTexture(groundCanvas);
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(12, 12);
    groundTexture.colorSpace = THREE.SRGBColorSpace;
    groundTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x223024,
      roughness: 0.85,
      metalness: 0.1,
      map: groundTexture,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    defaultSceneGroup.add(ground);

    // Composite Sundial Monument
    const sundialGroup = new THREE.Group();
    sundialGroup.position.set(0, 0, 0);

    // Base Pedestal
    const baseGeo = new THREE.CylinderGeometry(4.2, 4.6, 0.4, 32);
    const marbleMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.3,
      metalness: 0.1,
    });
    const baseMesh = new THREE.Mesh(baseGeo, marbleMat);
    baseMesh.position.y = 0.2;
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = true;
    sundialGroup.add(baseMesh);

    // Brass Calibration Dial Plate
    const dialGeo = new THREE.CylinderGeometry(3.8, 3.8, 0.08, 32);
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.85,
      roughness: 0.25,
    });
    const dialMesh = new THREE.Mesh(dialGeo, brassMat);
    dialMesh.position.y = 0.44;
    dialMesh.receiveShadow = true;
    sundialGroup.add(dialMesh);

    // Gnomon Center Pointer
    const gnomonGroup = new THREE.Group();
    gnomonGroup.position.set(0, 0.48, 0);

    const rodGeo = new THREE.CylinderGeometry(0.08, 0.12, 2.8, 16);
    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.9,
      roughness: 0.2,
    });
    const rodMesh = new THREE.Mesh(rodGeo, darkSteelMat);
    rodMesh.position.set(0, 1.2, -0.6);
    rodMesh.rotation.x = Math.PI / 4;
    rodMesh.castShadow = true;
    rodMesh.receiveShadow = true;
    gnomonGroup.add(rodMesh);

    const tipGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.15,
    });
    const tipMesh = new THREE.Mesh(tipGeo, goldMat);
    tipMesh.position.set(0, 2.2, -1.6);
    tipMesh.castShadow = true;
    gnomonGroup.add(tipMesh);

    sundialGroup.add(gnomonGroup);

    // 8 Cardinal and Intercardinal Directional Markers
    const cardinalGroup = new THREE.Group();
    const createCardinalMarker = (label: string, angleDeg: number, colorHex: number, isMajor: boolean = true) => {
      const rad = angleDeg * (Math.PI / 180);
      const dist = isMajor ? 3.4 : 3.25;
      const markerGeo = new THREE.BoxGeometry(isMajor ? 0.3 : 0.18, 0.1, isMajor ? 0.6 : 0.36);
      const markerMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.6, roughness: 0.3 });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(Math.sin(rad) * dist, 0.49, -Math.cos(rad) * dist);
      marker.rotation.y = rad;
      cardinalGroup.add(marker);
    };

    createCardinalMarker('N', 0, 0xef4444, true);     // Norte (0°)
    createCardinalMarker('NE', 45, 0x06b6d4, false);  // Nordeste (45°)
    createCardinalMarker('E', 90, 0x3b82f6, true);    // Leste (90°)
    createCardinalMarker('SE', 135, 0x8b5cf6, false); // Sudeste (135°)
    createCardinalMarker('S', 180, 0x10b981, true);   // Sul (180°)
    createCardinalMarker('SW', 225, 0xec4899, false); // Sudoeste (225°)
    createCardinalMarker('W', 270, 0xf59e0b, true);   // Oeste (270°)
    createCardinalMarker('NW', 315, 0x14b8a6, false); // Noroeste (315°)

    sundialGroup.add(cardinalGroup);
    defaultSceneGroup.add(sundialGroup);

    // Procedural Landscape Trees
    const treeGroup = new THREE.Group();
    const treePositions = [
      [-12, 0, -10], [14, 0, -15], [-16, 0, 12], [18, 0, 10], [-8, 0, -22], [10, 0, -26]
    ];
    treePositions.forEach(([tx, ty, tz]) => {
      const singleTree = new THREE.Group();
      const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 3, 8);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x543729, roughness: 0.9 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.5;
      trunk.castShadow = true;
      singleTree.add(trunk);

      const folGeo1 = new THREE.ConeGeometry(2, 4, 8);
      const folMat = new THREE.MeshStandardMaterial({ color: 0x1e3a1e, roughness: 0.8 });
      const fol1 = new THREE.Mesh(folGeo1, folMat);
      fol1.position.y = 4;
      fol1.castShadow = true;
      singleTree.add(fol1);

      const folGeo2 = new THREE.ConeGeometry(1.5, 3, 8);
      const fol2 = new THREE.Mesh(folGeo2, folMat);
      fol2.position.y = 5.5;
      fol2.castShadow = true;
      singleTree.add(fol2);

      singleTree.position.set(tx, ty, tz);
      treeGroup.add(singleTree);
    });
    defaultSceneGroup.add(treeGroup);
    landscapeGroup.add(defaultSceneGroup);

    // Continuous Earth Horizon Terrain (extends to 28 km planetary sweep with gentle Earth curvature drop)
    const earthHorizonGeo = new THREE.RingGeometry(1, 28000, 128, 56);
    earthHorizonGeo.rotateX(-Math.PI / 2);
    const hPosAttr = earthHorizonGeo.attributes.position;
    for (let i = 0; i < hPosAttr.count; i++) {
      const vx = hPosAttr.getX(i);
      const vz = hPosAttr.getZ(i);
      const r = Math.hypot(vx, vz);
      let vy = -0.06;
      if (r > 72) {
        const distOut = r - 72;
        const ang = Math.atan2(vz, vx);
        // Subtle natural rolling hills near perimeter (fade smoothly by ~550m) + gentle Earth curvature dip
        const hillEnvelope = Math.min(1, distOut / 110) * Math.max(0, 1 - distOut / 520);
        const hills =
          (Math.sin(ang * 5.0 + 0.7) * 2.2 +
            Math.cos(ang * 11.0 - 1.1) * 1.3 +
            Math.sin(ang * 19.0) * 0.65) *
          hillEnvelope;
        const curvatureDip = -(distOut * distOut) / 12742000;
        vy = -0.06 + hills + curvatureDip;
      }
      hPosAttr.setY(i, vy);
    }
    earthHorizonGeo.computeVertexNormals();

    const earthHorizonMat = new THREE.MeshStandardMaterial({
      color: 0x2a3b2a,
      roughness: 0.94,
      metalness: 0.02,
    });
    earthHorizonMatRef.current = earthHorizonMat;
    const earthHorizonMesh = new THREE.Mesh(earthHorizonGeo, earthHorizonMat);
    earthHorizonMesh.receiveShadow = false;
    landscapeGroup.add(earthHorizonMesh);

    // Build Cidade De Carros (Wide 4-lane avenues, 18 cars, skyscrapers, guardrails)
    const cityCarsHandle = buildCityScene('city_cars', renderer.capabilities.getMaxAnisotropy(), isSoftwareGl);
    cityCarsHandle.cityGroup.visible = false;
    cityCarsHandleRef.current = cityCarsHandle;
    landscapeGroup.add(cityCarsHandle.cityGroup);

    // Build Cidade De Pessoas (Pedestrian boulevards, plazas, cafés, benches, walking people)
    const cityPeopleHandle = buildCityScene('city_people', renderer.capabilities.getMaxAnisotropy(), isSoftwareGl);
    cityPeopleHandle.cityGroup.visible = false;
    cityPeopleHandleRef.current = cityPeopleHandle;
    landscapeGroup.add(cityPeopleHandle.cityGroup);

    // Build Fazenda (Barn, Silo, Farmhouse, Spinning Windmill, Tractor, Pickup, Cows, Sheep, Yard Lamps)
    const farmHandle = buildFarmScene(renderer.capabilities.getMaxAnisotropy(), isSoftwareGl);
    farmHandle.cityGroup.visible = false;
    farmHandleRef.current = farmHandle;
    landscapeGroup.add(farmHandle.cityGroup);

    // Build Hora Solar (Relógio Solar de Chão 24h + Versões de Parede 90° e 67,5° por Hemisfério)
    const solarTimeHandle = buildSolarTimeScene(renderer.capabilities.getMaxAnisotropy(), isSoftwareGl);
    solarTimeHandle.cityGroup.visible = false;
    solarTimeHandleRef.current = solarTimeHandle;
    landscapeGroup.add(solarTimeHandle.cityGroup);

    // Realistic Earth-Like Multi-Layer Sky Dome (Rayleigh horizon band, cirrus wisps, Mie glare, Belt of Venus & Starfield)
    const skyGeo = new THREE.SphereGeometry(750, 64, 48);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x050a18) },
        bottomColor: { value: new THREE.Color(0x0a1226) },
        sunPosition: { value: new THREE.Vector3(0, 1, 0) },
        sunHorizonGlowColor: { value: new THREE.Color(0xff6614) },
        sunHorizonIntensity: { value: 0.0 },
        beltOfVenusIntensity: { value: 0.0 },
        starsIntensity: { value: 0.0 },
        viceCityMix: { value: 0.0 },
        time: { value: 0.0 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vWorldPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform vec3 sunPosition;
        uniform vec3 sunHorizonGlowColor;
        uniform float sunHorizonIntensity;
        uniform float beltOfVenusIntensity;
        uniform float starsIntensity;
        uniform float viceCityMix;
        uniform float time;
        varying vec3 vWorldPosition;

        float hash3(vec3 p) {
          p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        float valueNoise2(vec2 st) {
          vec2 i = floor(st);
          vec2 f = fract(st);
          float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
          float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
          float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
          float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        void main() {
          vec3 dirToFrag = normalize(vWorldPosition);
          vec3 dirToSun = normalize(sunPosition);
          float h = dirToFrag.y; // Altitude on sky dome (-1 to +1; horizon = 0.0)

          // 1. Authentic Earth Airmass Atmospheric Sky Gradient above horizon
          float airmassBlend = 1.0 - exp(-max(h, 0.0) * 5.2);
          vec3 sky = mix(bottomColor, topColor, clamp(airmassBlend, 0.0, 1.0));

          // Crisp yet soft milky Rayleigh atmospheric haze right along Earth's horizon
          float earthHazeBand = exp(-max(h, 0.0) * 26.0) * step(-0.02, h);
          sky = mix(sky, bottomColor * 1.06 + vec3(0.03, 0.035, 0.045) * (1.0 - starsIntensity), earthHazeBand * 0.45);

          // 2. Thin High-Altitude Atmospheric Cloud Wisps near Earth Horizon / Sky
          if (h > 0.015) {
            vec2 cloudUv = dirToFrag.xz / (h + 0.14) * 1.15 + vec2(time * 0.004, time * 0.0015);
            float n = valueNoise2(cloudUv * 2.2) * 0.6 + valueNoise2(cloudUv * 5.1) * 0.4;
            float cloudMask = smoothstep(0.56, 0.85, n) * smoothstep(0.015, 0.14, h) * smoothstep(0.88, 0.2, h);
            float sunWarmth = clamp(dirToSun.y * 2.5 + 0.4, 0.0, 1.0);
            vec3 vcCloudTint = mix(vec3(1.0, 0.66, 0.78), vec3(1.0, 0.94, 0.82), clamp(dirToSun.y * 2.2, 0.0, 1.0));
            vec3 cloudColReal = mix(bottomColor * 1.15, mix(sunHorizonGlowColor, vec3(1.0, 0.98, 0.95), clamp(dirToSun.y * 3.0, 0.0, 1.0)), 0.55) * sunWarmth;
            vec3 cloudCol = mix(cloudColReal, vcCloudTint * (0.45 + 0.55 * sunWarmth), viceCityMix * 0.72);
            sky = mix(sky, cloudCol, cloudMask * 0.30 * (1.0 - starsIntensity * 0.92));
          }

          // 3. Horizon Forward Scattering (Mie Scattering along Sun's Azimuth)
          vec2 fragH = normalize(dirToFrag.xz + 0.00001);
          vec2 sunH = normalize(dirToSun.xz + 0.00001);
          float azimAlignment = dot(fragH, sunH);
          float horizonEnvelope = exp(-abs(h) * 16.0);

          float forwardScatter = pow(max(0.0, azimAlignment), 3.2) * horizonEnvelope;
          vec3 horizonGlow = sunHorizonGlowColor * (forwardScatter * sunHorizonIntensity * 1.75);

          // 3b. GTA Vice City 1986 Miami Pastel Pink & Coral Horizon Accents
          if (viceCityMix > 0.001 && h >= -0.02) {
            float daylightVis = 1.0 - starsIntensity * 0.85;
            float pinkBand = exp(-max(h, 0.0) * 10.5) * step(-0.02, h);
            vec3 pastelCoral = mix(vec3(1.0, 0.48, 0.66), vec3(1.0, 0.68, 0.52), max(0.0, azimAlignment));
            sky = mix(sky, pastelCoral, pinkBand * 0.36 * viceCityMix * daylightVis);
          }

          // 4. Belt of Venus & Earth's Shadow (Anti-Solar Horizon phenomenon)
          if (beltOfVenusIntensity > 0.001 && h >= -0.02) {
            float antiSolarFactor = pow(max(0.0, -azimAlignment), 2.5);
            float venusBand = smoothstep(0.005, 0.075, h) * smoothstep(0.24, 0.075, h);
            vec3 venusColor = vec3(0.92, 0.46, 0.60);
            float shadowBand = smoothstep(0.05, 0.0, h);
            vec3 shadowColor = vec3(0.04, 0.06, 0.14);
            sky += (venusColor * venusBand * 1.2 + shadowColor * shadowBand * 0.85) * antiSolarFactor * beltOfVenusIntensity;
          }

          // 5. Solar Glare / Corona
          float sunDot = max(0.0, dot(dirToSun, dirToFrag));
          if (dirToSun.y > -0.15 && h >= -0.02) {
            float sunCorona = pow(sunDot, 64.0) * 0.72 + pow(sunDot, 512.0) * 1.55;
            vec3 coronaTint = mix(sunHorizonGlowColor, vec3(1.0, 0.84, 0.45), viceCityMix * 0.65);
            sky += coronaTint * sunCorona * clamp(dirToSun.y + 0.2, 0.0, 1.0) * (1.0 + viceCityMix * 0.35);
          }

          // 6. Procedural Starfield (strictly above Earth's horizon line h > 0.008)
          if (starsIntensity > 0.005 && h > 0.008) {
            vec3 starCoord = dirToFrag * 230.0;
            vec3 gridId = floor(starCoord);
            float starRandom = hash3(gridId);

            if (starRandom > 0.982) {
              vec3 starPosInCell = fract(starCoord) - 0.5;
              float distToCenter = length(starPosInCell);
              float starCore = smoothstep(0.35, 0.0, distToCenter);
              float twinkle = 0.75 + 0.25 * sin(time * 3.2 + starRandom * 62.83);
              float horizonExtinction = smoothstep(0.01, 0.18, h);
              vec3 starTint = mix(vec3(1.0, 0.88, 0.78), vec3(0.82, 0.92, 1.0), fract(starRandom * 19.3));
              float starBrightness = starCore * twinkle * horizonExtinction * starsIntensity;
              sky += starTint * starBrightness * 1.4;
            }
          }

          // 7. Below true Earth horizon (h < 0): blend smoothly into deep Earth horizon backdrop
          vec3 finalSky = sky + horizonGlow;
          if (h < 0.0) {
            vec3 lowerEarth = mix(bottomColor * 0.55, bottomColor * 0.18, clamp(-h * 8.0, 0.0, 1.0));
            float belowMix = smoothstep(0.0, -0.035, h);
            finalSky = mix(finalSky, lowerEarth, belowMix);
          }

          gl_FragColor = vec4(finalSky, 1.0);
        }
      `,
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    skyMesh.frustumCulled = false;
    landscapeGroup.add(skyMesh);
    skyMeshRef.current = skyMesh;
    skyMaterialRef.current = skyMat;

    // Vector Ray Beam from Sun
    const beamGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 20, 0)
    ]);
    const beamMat = new THREE.LineDashedMaterial({
      color: 0xf59e0b,
      dashSize: 0.5,
      gapSize: 0.25,
      linewidth: 2,
    });
    const beamLine = new THREE.Line(beamGeo, beamMat);
    beamLine.computeLineDistances();
    landscapeGroup.add(beamLine);
    sunBeamLineRef.current = beamLine;

    scene.add(landscapeGroup);

    // ==========================================
    // BUILD 2: 3D REAL EARTH GLOBE VIEW (Natural Earth 1:50m + Blue Marble + Night Lights)
    // ==========================================
    const globeGroup = new THREE.Group();
    globeGroup.name = 'globeGroup';
    globeGroup.visible = false;

    const realEarthHandle = buildRealEarthGlobe(globeGroup, renderer.capabilities.getMaxAnisotropy());
    realEarthHandleRef.current = realEarthHandle;
    earthMeshRef.current = realEarthHandle.earthMesh;

    // Observer Location Beacon (+Z points inward via lookAt(0,0,0), so -Z points strictly outward normal)
    const obsPinGroup = new THREE.Group();
    const obsRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.11, 0.175, 32),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
      })
    );
    obsPinGroup.add(obsRingMesh);

    const obsStemMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.44, 12),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.7, roughness: 0.25 })
    );
    obsStemMesh.rotation.x = Math.PI / 2;
    obsStemMesh.position.z = -0.22;
    obsPinGroup.add(obsStemMesh);

    const obsHeadMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 20, 20),
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: new THREE.Color(0xef4444),
        emissiveIntensity: 0.95,
        metalness: 0.3,
        roughness: 0.2,
      })
    );
    obsHeadMesh.position.z = -0.45;
    obsPinGroup.add(obsHeadMesh);
    observerPinRef.current = obsPinGroup;
    globeGroup.add(obsPinGroup);

    // Subsolar Zenith Beacon (perpendicular surface solar target + golden sphere)
    const subPinGroup = new THREE.Group();
    const subRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.13, 0.21, 32),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
      })
    );
    subPinGroup.add(subRingMesh);

    const subPinMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 20, 20),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: new THREE.Color(0xfbbf24),
        emissiveIntensity: 1.35,
        metalness: 0.4,
        roughness: 0.15,
      })
    );
    subPinMesh.position.z = -0.16;
    subPinGroup.add(subPinMesh);
    subsolarPinRef.current = subPinGroup;
    globeGroup.add(subPinGroup);

    globeGroupRef.current = globeGroup;
    scene.add(globeGroup);

    // Pre-allocated scratch vectors for Modo Pessoa, Drone Camera, Raycaster & Cidade Real Vehicles
    const _fwd = new THREE.Vector3();
    const _right = new THREE.Vector3();
    const _move = new THREE.Vector3();
    const _chaseTarget = new THREE.Vector3();
    const _raycaster = new THREE.Raycaster();
    const _pointerNdc = new THREE.Vector2();

    const collidesWithObstacles = (x: number, z: number, obstacles: CityObstacleBox[], r: number) => {
      for (let i = 0; i < obstacles.length; i++) {
        const b = obstacles[i];
        if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) {
          return true;
        }
      }
      return false;
    };

    const collidesWithRealBuildings = (
      x: number,
      z: number,
      buildings: RealCityBuilding[],
      currentFootY: number,
      r: number
    ) => {
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (b.height <= currentFootY + 0.9) continue;
        if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) {
          return true;
        }
      }
      return false;
    };

    const findRooftopAt = (
      x: number,
      z: number,
      buildings: RealCityBuilding[],
      maxY: number
    ): RealCityBuilding | null => {
      let highest: RealCityBuilding | null = null;
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        if (
          x >= b.minX + 0.15 &&
          x <= b.maxX - 0.15 &&
          z >= b.minZ + 0.15 &&
          z <= b.maxZ - 0.15 &&
          b.height <= maxY + 1.5
        ) {
          if (!highest || b.height > highest.height) {
            highest = b;
          }
        }
      }
      return highest;
    };

    const findNearestBuilding = (
      x: number,
      z: number,
      buildings: RealCityBuilding[]
    ): { building: RealCityBuilding | null; dist: number } => {
      let best: RealCityBuilding | null = null;
      let bestDist = Infinity;
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        const d = Math.hypot(b.cx - x, b.cz - z);
        if (d < bestDist) {
          bestDist = d;
          best = b;
        }
      }
      return { building: best, dist: bestDist };
    };

    const climbOntoBuilding = (b: RealCityBuilding) => {
      personStateRef.current.pos.set(b.cx, b.height + 1.72, b.cz);
      personStateRef.current.floorY = b.height;
      personStateRef.current.onBuildingName = b.name || 'Prédio';
    };

    // Keyboard & Pointer drag / Click-to-Climb controls
    let activeDragPointerId: number | null = null;
    let pointerDownX = 0;
    let pointerDownY = 0;
    let lastDragX = 0;
    let lastDragY = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPersonModeRef.current && !isDroneCamModeRef.current) return;
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      keysPressedRef.current[e.code] = true;

      // Instant climb / descend hotkeys in Cidade Real walk mode
      if (
        isPersonModeRef.current &&
        sceneThemeRef.current === 'city_real' &&
        realCityVehicleModeRef.current === 'walk' &&
        realCityHandleRef.current
      ) {
        if (e.code === 'Space' || e.code === 'KeyR') {
          const { building } = findNearestBuilding(
            personStateRef.current.pos.x,
            personStateRef.current.pos.z,
            realCityHandleRef.current.buildings
          );
          if (building) climbOntoBuilding(building);
        } else if (e.code === 'KeyF') {
          const sx = realCityHandleRef.current.data.spawnPoint[0];
          const sz = realCityHandleRef.current.data.spawnPoint[1];
          personStateRef.current.floorY = 0;
          personStateRef.current.onBuildingName = null;
          personStateRef.current.pos.set(sx, 1.72, sz);
        }
      }

      if (
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' ||
        e.code === 'Space'
      ) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current[e.code] = false;
    };

    const handleWindowBlur = () => {
      keysPressedRef.current = {};
      activeDragPointerId = null;
    };

    const domEl = renderer.domElement;
    const handlePointerDown = (e: PointerEvent) => {
      if (!isPersonModeRef.current && !isDroneCamModeRef.current) return;
      if (activeDragPointerId !== null) return;
      activeDragPointerId = e.pointerId;
      pointerDownX = e.clientX;
      pointerDownY = e.clientY;
      lastDragX = e.clientX;
      lastDragY = e.clientY;
      try {
        domEl.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unavailable
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if ((!isPersonModeRef.current && !isDroneCamModeRef.current) || activeDragPointerId !== e.pointerId) return;
      const dx = e.clientX - lastDragX;
      const dy = e.clientY - lastDragY;
      lastDragX = e.clientX;
      lastDragY = e.clientY;

      const sensitivity = e.pointerType === 'touch' ? 0.0055 : 0.0042;
      if (isDroneCamModeRef.current) {
        droneCamStateRef.current.yaw -= dx * sensitivity;
        droneCamStateRef.current.pitch = Math.max(
          -1.48,
          Math.min(1.42, droneCamStateRef.current.pitch - dy * sensitivity)
        );
      } else if (
        sceneThemeRef.current === 'city_real' &&
        realCityVehicleModeRef.current !== 'walk'
      ) {
        vehicleStateRef.current.chaseYawOffset -= dx * sensitivity;
        vehicleStateRef.current.chasePitchOffset = Math.max(
          0.02,
          Math.min(1.05, vehicleStateRef.current.chasePitchOffset + dy * sensitivity)
        );
      } else {
        personStateRef.current.yaw -= dx * sensitivity;
        personStateRef.current.pitch = Math.max(
          -1.38,
          Math.min(1.38, personStateRef.current.pitch - dy * sensitivity)
        );
      }
    };

    const handlePointerUpOrCancel = (e: PointerEvent) => {
      if (activeDragPointerId === e.pointerId) {
        const dragDist = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);
        // Short click/tap on 3D Globe -> Move observer coordinates without changing UTC timezone!
        if (
          dragDist < 6 &&
          e.type === 'pointerup' &&
          viewModeRef.current === 'globe' &&
          earthMeshRef.current &&
          cameraRef.current
        ) {
          const rect = domEl.getBoundingClientRect();
          _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          _raycaster.setFromCamera(_pointerNdc, cameraRef.current);
          const globeHits = _raycaster.intersectObject(earthMeshRef.current, false);
          if (globeHits.length > 0 && globeHits[0].uv) {
            const rawLat = globeHits[0].uv.y * 180 - 90;
            const rawLon = globeHits[0].uv.x * 360 - 180;
            const lat = Number(Math.max(-85, Math.min(85, rawLat)).toFixed(4));
            const lon = Number(Math.max(-180, Math.min(180, rawLon)).toFixed(4));
            onSelectCoordinatesRef.current?.(lat, lon);
          }
        }

        // Short click/tap on a building in Cidade Real (walk mode) -> Climb onto its rooftop!
        if (
          dragDist < 6 &&
          e.type === 'pointerup' &&
          viewModeRef.current === 'landscape' &&
          sceneThemeRef.current === 'city_real' &&
          realCityVehicleModeRef.current === 'walk' &&
          realCityHandleRef.current &&
          cameraRef.current
        ) {
          const rect = domEl.getBoundingClientRect();
          _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          _raycaster.setFromCamera(_pointerNdc, cameraRef.current);
          const hits = _raycaster.intersectObjects(realCityHandleRef.current.buildingMeshes, false);
          if (hits.length > 0) {
            const hitId = hits[0].object.userData?.realBuildingId;
            const targetB = realCityHandleRef.current.buildings.find((b) => b.id === hitId);
            if (targetB) {
              climbOntoBuilding(targetB);
            }
          }
        }

        activeDragPointerId = null;
        try {
          if (domEl.hasPointerCapture(e.pointerId)) {
            domEl.releasePointerCapture(e.pointerId);
          }
        } catch {
          // Ignore
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    domEl.addEventListener('pointerdown', handlePointerDown);
    domEl.addEventListener('pointermove', handlePointerMove);
    domEl.addEventListener('pointerup', handlePointerUpOrCancel);
    domEl.addEventListener('pointercancel', handlePointerUpOrCancel);

    // Loop
    let isMounted = true;
    let lastFrameTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (!isMounted) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          animFrameIdRef.current = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          animFrameIdRef.current = window.setTimeout(cb, 80);
        }
      };
      animFrameIdRef.current = window.setTimeout(poll, 5);
    }

    function animate() {
      if (!isMounted) return;

      const now = performance.now();
      const rawDelta = (now - lastFrameTime) / 1000;
      lastFrameTime = now;
      const deltaSec = Math.min(Math.max(rawDelta, 0.001), isSoftwareGl ? 0.12 : 0.05);

      let realCityCarSpeedRatio = 0;
      let realCityCarBraking = false;
      let liveSpeedKmh = 0;
      let liveAltM = 0;

      if (isDroneCamModeRef.current && cameraRef.current) {
        // DRONE NA CÂMERA (Universal FPV 6-DoF Aerial Camera Mode across all landscape scenarios)
        const dc = droneCamStateRef.current;
        const keys = keysPressedRef.current;
        const ext = externalPersonMoveRef.current?.current;

        if (keys['KeyQ']) dc.yaw += 1.75 * deltaSec;
        if (keys['KeyE']) dc.yaw -= 1.75 * deltaSec;

        const moveFwd =
          (keys['KeyW'] || keys['ArrowUp'] || ext?.forward ? 1 : 0) -
          (keys['KeyS'] || keys['ArrowDown'] || ext?.backward ? 1 : 0);
        const moveStrafe =
          (keys['KeyD'] || keys['ArrowRight'] || ext?.right ? 1 : 0) -
          (keys['KeyA'] || keys['ArrowLeft'] || ext?.left ? 1 : 0);
        const lift =
          (keys['Space'] || ext?.ascend ? 1 : 0) -
          (keys['KeyC'] || keys['ControlLeft'] || ext?.descend ? 1 : 0);
        const isBoost = Boolean(keys['ShiftLeft'] || keys['ShiftRight'] || ext?.sprint);

        _fwd.set(-Math.sin(dc.yaw), 0, -Math.cos(dc.yaw));
        _right.set(Math.cos(dc.yaw), 0, -Math.sin(dc.yaw));
        _move.set(0, 0, 0).addScaledVector(_fwd, moveFwd).addScaledVector(_right, moveStrafe);
        if (_move.lengthSq() > 0.001) _move.normalize();

        const targetHorizSpeed = isBoost ? 30 : 14;
        const targetVertSpeed = isBoost ? 18 : 11;
        dc.vel.x += (_move.x * targetHorizSpeed - dc.vel.x) * Math.min(1, deltaSec * 6.5);
        dc.vel.z += (_move.z * targetHorizSpeed - dc.vel.z) * Math.min(1, deltaSec * 6.5);
        dc.vel.y += (lift * targetVertSpeed - dc.vel.y) * Math.min(1, deltaSec * 6.5);

        const maxRadius = sceneThemeRef.current === 'city_real' ? 140 : 110;
        dc.pos.x = Math.max(-maxRadius, Math.min(maxRadius, dc.pos.x + dc.vel.x * deltaSec));
        dc.pos.z = Math.max(-maxRadius, Math.min(maxRadius, dc.pos.z + dc.vel.z * deltaSec));

        let minDroneCamY = 0.65;
        if (sceneThemeRef.current === 'city_real' && realCityHandleRef.current) {
          const roof = findRooftopAt(dc.pos.x, dc.pos.z, realCityHandleRef.current.buildings, dc.pos.y);
          if (roof) minDroneCamY = roof.height + 0.65;
        }
        dc.pos.y = Math.max(minDroneCamY, Math.min(240, dc.pos.y + dc.vel.y * deltaSec));

        // Subtle realistic gimbal roll bank while strafing
        const targetRoll = -moveStrafe * 0.065;
        dc.roll += (targetRoll - dc.roll) * Math.min(1, deltaSec * 8);

        cameraRef.current.position.copy(dc.pos);
        cameraRef.current.rotation.set(dc.pitch, dc.yaw, dc.roll, 'YXZ');

        if (onDroneTelemetryRef.current && now - lastTelemetryEmitMsRef.current > 100) {
          lastTelemetryEmitMsRef.current = now;
          const headingDeg = (((-dc.yaw * 180) / Math.PI) % 360 + 360) % 360;
          const pitchDeg = (dc.pitch * 180) / Math.PI;
          onDroneTelemetryRef.current({
            altitudeM: Number(dc.pos.y.toFixed(1)),
            speedKmh: Math.round(dc.vel.length() * 3.6),
            headingDeg: Math.round(headingDeg),
            pitchDeg: Math.round(pitchDeg),
          });
        }
      } else if (isPersonModeRef.current && cameraRef.current) {
        const ps = personStateRef.current;
        const vs = vehicleStateRef.current;
        const keys = keysPressedRef.current;
        const ext = externalPersonMoveRef.current?.current;
        const isRealCity = sceneThemeRef.current === 'city_real' && Boolean(realCityHandleRef.current);
        const vMode = isRealCity ? realCityVehicleModeRef.current : 'walk';

        // Handle pending rooftop climb/descend button action from HUD
        if (isRealCity && externalRealCityActionRef.current?.current?.action && realCityHandleRef.current) {
          const reqAction = externalRealCityActionRef.current.current.action;
          externalRealCityActionRef.current.current.action = null;
          if (reqAction === 'climb_nearest') {
            const { building } = findNearestBuilding(ps.pos.x, ps.pos.z, realCityHandleRef.current.buildings);
            if (building) climbOntoBuilding(building);
          } else if (reqAction === 'descend') {
            const [sx, sz] = realCityHandleRef.current.data.spawnPoint;
            ps.floorY = 0;
            ps.onBuildingName = null;
            ps.pos.set(sx, 1.72, sz);
          }
        }

        const moveFwd =
          (keys['KeyW'] || keys['ArrowUp'] || ext?.forward ? 1 : 0) -
          (keys['KeyS'] || keys['ArrowDown'] || ext?.backward ? 1 : 0);
        const moveStrafe =
          (keys['KeyD'] || keys['ArrowRight'] || ext?.right ? 1 : 0) -
          (keys['KeyA'] || keys['ArrowLeft'] || ext?.left ? 1 : 0);
        const isBoost = Boolean(keys['ShiftLeft'] || keys['ShiftRight'] || ext?.sprint);

        if (vMode === 'walk') {
          if (keys['KeyQ']) ps.yaw += 1.65 * deltaSec;
          if (keys['KeyE']) ps.yaw -= 1.65 * deltaSec;

          if (moveFwd !== 0 || moveStrafe !== 0) {
            _fwd.set(-Math.sin(ps.yaw), 0, -Math.cos(ps.yaw));
            _right.set(Math.cos(ps.yaw), 0, -Math.sin(ps.yaw));
            _move
              .set(0, 0, 0)
              .addScaledVector(_fwd, moveFwd)
              .addScaledVector(_right, moveStrafe)
              .normalize();

            const moveSpeed = isBoost ? 10.5 : 5.6;
            liveSpeedKmh = moveSpeed * 3.6;
            const stepX = _move.x * moveSpeed * deltaSec;
            const stepZ = _move.z * moveSpeed * deltaSec;
            const boundLimit = isRealCity ? 1550 : 56;
            const playerRadius = 0.45;

            if (isRealCity && realCityHandleRef.current) {
              const rBuildings = realCityHandleRef.current.buildings;
              const nextX = Math.max(-boundLimit, Math.min(boundLimit, ps.pos.x + stepX));
              if (!collidesWithRealBuildings(nextX, ps.pos.z, rBuildings, ps.floorY, playerRadius)) {
                ps.pos.x = nextX;
              }
              const nextZ = Math.max(-boundLimit, Math.min(boundLimit, ps.pos.z + stepZ));
              if (!collidesWithRealBuildings(ps.pos.x, nextZ, rBuildings, ps.floorY, playerRadius)) {
                ps.pos.z = nextZ;
              }
            } else {
              const obstacles =
                sceneThemeRef.current === 'solar_time' && solarTimeHandleRef.current
                  ? solarTimeHandleRef.current.obstacles
                  : (() => {
                      const activeHandle =
                        sceneThemeRef.current === 'city_cars'
                          ? cityCarsHandleRef.current
                          : sceneThemeRef.current === 'city_people'
                            ? cityPeopleHandleRef.current
                            : sceneThemeRef.current === 'farm'
                              ? farmHandleRef.current
                              : null;
                      return activeHandle ? activeHandle.obstacles : [];
                    })();
              const nextX = Math.max(-boundLimit, Math.min(boundLimit, ps.pos.x + stepX));
              if (!collidesWithObstacles(nextX, ps.pos.z, obstacles, playerRadius)) {
                ps.pos.x = nextX;
              }
              const nextZ = Math.max(-boundLimit, Math.min(boundLimit, ps.pos.z + stepZ));
              if (!collidesWithObstacles(ps.pos.x, nextZ, obstacles, playerRadius)) {
                ps.pos.z = nextZ;
              }
            }
          }

          if (isRealCity && realCityHandleRef.current) {
            const roof = findRooftopAt(ps.pos.x, ps.pos.z, realCityHandleRef.current.buildings, ps.floorY);
            const targetFloor = roof ? roof.height : 0;
            ps.floorY += (targetFloor - ps.floorY) * Math.min(1, deltaSec * 8);
            ps.onBuildingName = roof ? (roof.name || 'Prédio') : null;
            const targetEyeY = ps.floorY + 1.72;
            ps.pos.y += (targetEyeY - ps.pos.y) * Math.min(1, deltaSec * 10);
            liveAltM = Math.max(0, ps.pos.y - 1.72);
          } else {
            const isCityPeopleTheme = sceneThemeRef.current === 'city_people';
            const isCityCarsTheme = sceneThemeRef.current === 'city_cars';
            const onRaisedPad =
              (isCityPeopleTheme && Math.abs(ps.pos.x) >= 8 && Math.abs(ps.pos.z) >= 8) ||
              (isCityCarsTheme && Math.abs(ps.pos.x) >= 11 && Math.abs(ps.pos.z) >= 11);
            const targetEyeY = onRaisedPad ? 1.80 : 1.72;
            ps.pos.y += (targetEyeY - ps.pos.y) * Math.min(1, deltaSec * 12);
          }

          cameraRef.current.position.copy(ps.pos);
          cameraRef.current.rotation.set(ps.pitch, ps.yaw, 0, 'YXZ');
        } else if (vMode === 'drone' && realCityHandleRef.current) {
          // 6-DoF DRONE FLIGHT
          if (keys['KeyQ']) vs.chaseYawOffset += 1.8 * deltaSec;
          if (keys['KeyE']) vs.chaseYawOffset -= 1.8 * deltaSec;
          const totalYaw = vs.droneYaw + vs.chaseYawOffset;

          const lift =
            (keys['Space'] || ext?.ascend ? 1 : 0) -
            (keys['KeyC'] || keys['ShiftLeft'] || keys['ShiftRight'] || ext?.descend ? 1 : 0);

          _fwd.set(-Math.sin(totalYaw), 0, -Math.cos(totalYaw));
          _right.set(Math.cos(totalYaw), 0, -Math.sin(totalYaw));
          _move.set(0, 0, 0).addScaledVector(_fwd, moveFwd).addScaledVector(_right, moveStrafe);
          if (_move.lengthSq() > 0.001) _move.normalize();

          const hSpeed = isBoost ? 48 : 22;
          vs.droneVel.x += (_move.x * hSpeed - vs.droneVel.x) * Math.min(1, deltaSec * 6.5);
          vs.droneVel.z += (_move.z * hSpeed - vs.droneVel.z) * Math.min(1, deltaSec * 6.5);
          vs.droneVel.y += (lift * 18.0 - vs.droneVel.y) * Math.min(1, deltaSec * 6.5);

          vs.dronePos.x = Math.max(-1650, Math.min(1650, vs.dronePos.x + vs.droneVel.x * deltaSec));
          vs.dronePos.z = Math.max(-1650, Math.min(1650, vs.dronePos.z + vs.droneVel.z * deltaSec));
          const roof = findRooftopAt(vs.dronePos.x, vs.dronePos.z, realCityHandleRef.current.buildings, vs.dronePos.y);
          const minDroneY = (roof ? roof.height : 0) + 0.55;
          vs.dronePos.y = Math.max(minDroneY, Math.min(600, vs.dronePos.y + vs.droneVel.y * deltaSec));

          const droneMesh = realCityHandleRef.current.actors.droneGroup;
          droneMesh.position.copy(vs.dronePos);
          droneMesh.rotation.order = 'YXZ';
          droneMesh.rotation.y = totalYaw;
          droneMesh.rotation.x = -moveFwd * 0.24;
          droneMesh.rotation.z = -moveStrafe * 0.24;

          liveSpeedKmh = vs.droneVel.length() * 3.6;
          liveAltM = vs.dronePos.y;
          ps.onBuildingName = roof ? (roof.name || 'Sobre Prédio') : null;

          // Chase camera behind & above drone
          const camDist = 6.2;
          const pitchCam = vs.chasePitchOffset;
          _chaseTarget.set(
            vs.dronePos.x + Math.sin(totalYaw) * camDist * Math.cos(pitchCam),
            vs.dronePos.y + 1.4 + Math.sin(pitchCam) * camDist,
            vs.dronePos.z + Math.cos(totalYaw) * camDist * Math.cos(pitchCam)
          );
          cameraRef.current.position.lerp(_chaseTarget, Math.min(1, deltaSec * 9));
          cameraRef.current.lookAt(vs.dronePos.x, vs.dronePos.y + 0.35, vs.dronePos.z);
        } else if (vMode === 'plane' && realCityHandleRef.current) {
          // AIRPLANE FLIGHT (World-scale open airspace + express multi-continent travel in seconds + up to 11 km ceiling)
          const maxPlaneCeiling = Math.max(
            PLANE_MIN_CEILING_M,
            Math.min(PLANE_MAX_CEILING_M, planeMaxAltitudeRef.current)
          );
          const activePlan = planeFlightPlanRef.current;

          if (activePlan && activePlan.active) {
            flightTrackerRef.current.elapsedSec += deltaSec;
            const duration = Math.max(
              PLANE_MIN_FLIGHT_DURATION_SEC,
              Math.min(PLANE_MAX_FLIGHT_DURATION_SEC, activePlan.durationSec)
            );
            const rawT = Math.min(1, flightTrackerRef.current.elapsedSec / duration);
            const easeT =
              rawT < 0.5 ? 2 * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 2) / 2;

            // Interpolate true geodesic position across Earth so Sun & Sky morph live across continents!
            const interp = interpolateEarthCoord(
              activePlan.originLat,
              activePlan.originLng,
              activePlan.destLat,
              activePlan.destLng,
              easeT
            );
            liveGeoRef.current.lat = interp.lat;
            liveGeoRef.current.lng = interp.lng;

            if (onPlaneGeoMoveRef.current && now - lastGeoEmitMsRef.current > 110) {
              lastGeoEmitMsRef.current = now;
              onPlaneGeoMoveRef.current(interp.lat, interp.lng);
            }

            // Smooth heading alignment to true great-circle bearing
            const desiredYaw = -(activePlan.bearingDeg * Math.PI) / 180;
            let yawDiff = desiredYaw - vs.planeYaw;
            while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
            while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
            vs.planeYaw += yawDiff * Math.min(1, deltaSec * 6.5);
            vs.planeBank += (Math.max(-0.45, Math.min(0.45, yawDiff * 0.6)) - vs.planeBank) * Math.min(1, deltaSec * 6);

            // Smooth cruise climb & final approach arc respecting user's max altitude ceiling
            const cruisePeakAlt = Math.min(
              maxPlaneCeiling,
              Math.max(140, Math.min(maxPlaneCeiling, 2400))
            );
            const approachAlt = Math.min(maxPlaneCeiling, 125);
            const arcBump = Math.sin(rawT * Math.PI) * Math.max(0, cruisePeakAlt - approachAlt);
            const targetY = approachAlt + arcBump;
            const prevY = vs.planePos.y;
            const altResp = duration <= 2.5 ? 12.0 : 4.5;
            vs.planePos.y += (targetY - prevY) * Math.min(1, deltaSec * altResp);
            const dyRate = (vs.planePos.y - prevY) / Math.max(0.001, deltaSec);
            vs.planePitch += (Math.max(-0.38, Math.min(0.45, dyRate * 0.0022)) - vs.planePitch) * Math.min(1, deltaSec * 6);

            // Visual supersonic flyover over sprawling 3D metropolis & terrain without losing mesh precision
            const visualCruise = 140 + Math.sin(rawT * Math.PI) * 580;
            vs.planeSpeed = visualCruise;
            vs.planePos.x += -Math.sin(vs.planeYaw) * visualCruise * deltaSec;
            vs.planePos.z += -Math.cos(vs.planeYaw) * visualCruise * deltaSec;
            // Seamlessly loop across extended world span during warp cruise, converging near center at arrival
            if (rawT > 0.85) {
              const pull = (rawT - 0.85) / 0.15;
              const pullStrength = duration <= 2.5 ? 14.0 : 3.5;
              vs.planePos.x *= 1 - Math.min(1, pull * deltaSec * pullStrength);
              vs.planePos.z *= 1 - Math.min(1, pull * deltaSec * pullStrength);
            } else {
              if (vs.planePos.x > 2600) vs.planePos.x -= 5200;
              if (vs.planePos.x < -2600) vs.planePos.x += 5200;
              if (vs.planePos.z > 2600) vs.planePos.z -= 5200;
              if (vs.planePos.z < -2600) vs.planePos.z += 5200;
            }

            liveSpeedKmh = Math.max(
              320,
              Math.round((activePlan.totalDistanceKm / duration) * 3600 * (0.25 + Math.sin(rawT * Math.PI)))
            );
            liveAltM = vs.planePos.y;

            if (rawT >= 1.0 && flightTrackerRef.current.completedId !== activePlan.id) {
              flightTrackerRef.current.completedId = activePlan.id;
              onPlaneFlightCompleteRef.current?.(activePlan);
            }
          } else {
            // Free Manual Airplane Control across the giant world + Regional / Global speed gears
            const throttleInput =
              (keys['KeyW'] || keys['ArrowUp'] || ext?.forward ? 1 : 0) -
              (keys['KeyS'] || keys['ArrowDown'] || ext?.backward ? 1 : 0);
            const turnInput =
              (keys['KeyA'] || keys['ArrowLeft'] || ext?.left ? 1 : 0) -
              (keys['KeyD'] || keys['ArrowRight'] || ext?.right ? 1 : 0);
            const pitchInput =
              (keys['Space'] || ext?.ascend ? 1 : 0) -
              (keys['KeyC'] || ext?.descend ? 1 : 0);

            const travelMode = planeTravelSpeedModeRef.current;
            const highCeilingFactor = Math.max(0, Math.min(1, (maxPlaneCeiling - 300) / 3000));
            const altSpeedFactor = Math.max(0, Math.min(1, (vs.planePos.y - 80) / 2600));
            const climbSpeedScale = pitchInput !== 0 ? Math.max(altSpeedFactor, highCeilingFactor * 0.65) : altSpeedFactor;
            const gearMult = travelMode === 'global' ? 1.85 : travelMode === 'regional' ? 1.35 : 1.0;
            const maxAirspeed = ((isBoost ? 64 : 48) + climbSpeedScale * (isBoost ? 316 : 212)) * gearMult;
            const accelStep = (24 + climbSpeedScale * 95) * gearMult;

            if (throttleInput !== 0) {
              vs.planeSpeed = Math.max(14, Math.min(maxAirspeed, vs.planeSpeed + throttleInput * accelStep * deltaSec));
            } else if (travelMode !== 'city') {
              const targetGearCruise = Math.max(60, maxAirspeed * 0.72);
              vs.planeSpeed += (targetGearCruise - vs.planeSpeed) * Math.min(1, deltaSec * 2.5);
            } else if (pitchInput > 0 && maxPlaneCeiling > 450) {
              const targetClimbCruise = Math.max(36, maxAirspeed * 0.72);
              if (vs.planeSpeed < targetClimbCruise) {
                vs.planeSpeed = Math.min(targetClimbCruise, vs.planeSpeed + accelStep * 0.75 * deltaSec);
              }
            }
            if (vs.planeSpeed > maxAirspeed) {
              vs.planeSpeed = Math.max(maxAirspeed, vs.planeSpeed - 110 * deltaSec);
            }

            vs.planeYaw += turnInput * 1.35 * deltaSec;
            const targetBank = turnInput * 0.55;
            vs.planeBank += (targetBank - vs.planeBank) * Math.min(1, deltaSec * 6);

            const roofBelow = findRooftopAt(vs.planePos.x, vs.planePos.z, realCityHandleRef.current.buildings, vs.planePos.y);
            const minPlaneAlt = (roofBelow ? roofBelow.height : 0) + 2.4;
            const clampedTargetMax = Math.max(minPlaneAlt, maxPlaneCeiling);
            const aboveCeiling = vs.planePos.y > clampedTargetMax + 0.05;
            const atCeiling = vs.planePos.y >= clampedTargetMax - 0.15 && pitchInput > 0;

            const maxPitchRad = maxPlaneCeiling > 450 ? 0.62 : 0.48;
            const targetPitch = aboveCeiling
              ? -0.26
              : atCeiling
                ? 0
                : pitchInput * maxPitchRad;
            vs.planePitch += (targetPitch - vs.planePitch) * Math.min(1, deltaSec * 5);

            const horizSpeed = vs.planeSpeed * Math.cos(vs.planePitch);
            const stepX = -Math.sin(vs.planeYaw) * horizSpeed * deltaSec;
            const stepZ = -Math.cos(vs.planeYaw) * horizSpeed * deltaSec;
            vs.planePos.x += stepX;
            vs.planePos.z += stepZ;

            if (aboveCeiling) {
              const dropRate = Math.max(45, (vs.planePos.y - clampedTargetMax) * 1.45);
              vs.planePos.y = Math.max(clampedTargetMax, vs.planePos.y - dropRate * deltaSec);
            } else {
              vs.planePos.y += Math.sin(vs.planePitch) * vs.planeSpeed * deltaSec;
              vs.planePos.y = Math.max(minPlaneAlt, Math.min(clampedTargetMax, vs.planePos.y));
            }

            // Advance real geographic coordinates across the planet based on flight speed mode
            const worldKmPerLocalMeter =
              travelMode === 'global' ? (isBoost ? 14.0 : 8.5) : travelMode === 'regional' ? (isBoost ? 0.55 : 0.28) : 0.001;
            const northKm = -stepZ * worldKmPerLocalMeter;
            const eastKm = stepX * worldKmPerLocalMeter;
            const cosLat = Math.max(0.18, Math.cos((liveGeoRef.current.lat * Math.PI) / 180));
            liveGeoRef.current.lat = Math.max(-85, Math.min(85, liveGeoRef.current.lat + northKm / 111.32));
            let nextLng = liveGeoRef.current.lng + eastKm / (111.32 * cosLat);
            if (nextLng > 180) nextLng -= 360;
            if (nextLng < -180) nextLng += 360;
            liveGeoRef.current.lng = nextLng;

            if (
              travelMode !== 'city' &&
              onPlaneGeoMoveRef.current &&
              now - lastGeoEmitMsRef.current > 140
            ) {
              lastGeoEmitMsRef.current = now;
              onPlaneGeoMoveRef.current(liveGeoRef.current.lat, liveGeoRef.current.lng);
            }

            // World wrap horizon without jarring walls (28 km open world seamlessly wrapped at +/- 6 km or wider in city mode)
            const wrapLimit = travelMode === 'city' ? 12000 : 3200;
            if (travelMode === 'city') {
              const distFromCenter = Math.hypot(vs.planePos.x, vs.planePos.z);
              if (distFromCenter > wrapLimit) {
                const toCenterYaw = Math.atan2(vs.planePos.x, vs.planePos.z);
                let yawDiff = toCenterYaw - vs.planeYaw;
                while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
                while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
                vs.planeYaw += yawDiff * Math.min(1, deltaSec * 2.5);
                const scaleBack = wrapLimit / distFromCenter;
                vs.planePos.x *= scaleBack;
                vs.planePos.z *= scaleBack;
              }
            } else {
              if (vs.planePos.x > wrapLimit) vs.planePos.x -= wrapLimit * 2;
              if (vs.planePos.x < -wrapLimit) vs.planePos.x += wrapLimit * 2;
              if (vs.planePos.z > wrapLimit) vs.planePos.z -= wrapLimit * 2;
              if (vs.planePos.z < -wrapLimit) vs.planePos.z += wrapLimit * 2;
            }

            liveSpeedKmh =
              travelMode === 'city'
                ? vs.planeSpeed * 3.6
                : Math.round(horizSpeed * worldKmPerLocalMeter * 3600);
            liveAltM = vs.planePos.y;
          }

          const planeMesh = realCityHandleRef.current.actors.planeGroup;
          planeMesh.position.copy(vs.planePos);
          planeMesh.rotation.order = 'YXZ';
          planeMesh.rotation.y = vs.planeYaw;
          planeMesh.rotation.x = vs.planePitch;
          planeMesh.rotation.z = vs.planeBank;
          ps.onBuildingName = null;

          const camViewYaw = vs.planeYaw + vs.chaseYawOffset;
          const chaseDist = 11.5;
          _chaseTarget.set(
            vs.planePos.x + Math.sin(camViewYaw) * chaseDist,
            vs.planePos.y + 3.2 + vs.chasePitchOffset * 5.0,
            vs.planePos.z + Math.cos(camViewYaw) * chaseDist
          );
          cameraRef.current.position.lerp(_chaseTarget, Math.min(1, deltaSec * 8));
          cameraRef.current.lookAt(vs.planePos.x, vs.planePos.y + 0.4, vs.planePos.z);
        } else if (vMode === 'car' && realCityHandleRef.current) {
          // DRIVABLE CITY CAR across the 3 km+ metropolis
          const gasInput =
            (keys['KeyW'] || keys['ArrowUp'] || ext?.forward ? 1 : 0) -
            (keys['KeyS'] || keys['ArrowDown'] || ext?.backward ? 1 : 0);
          const steerInput =
            (keys['KeyA'] || keys['ArrowLeft'] || ext?.left ? 1 : 0) -
            (keys['KeyD'] || keys['ArrowRight'] || ext?.right ? 1 : 0);

          const maxFwdSpeed = isBoost ? 58 : 34;
          if (gasInput > 0) {
            vs.carSpeed = Math.min(maxFwdSpeed, vs.carSpeed + 22 * deltaSec);
          } else if (gasInput < 0) {
            vs.carSpeed = Math.max(-14, vs.carSpeed - 24 * deltaSec);
            realCityCarBraking = true;
          } else {
            vs.carSpeed *= Math.max(0, 1 - 3.0 * deltaSec);
          }

          vs.carSteer += (steerInput * 0.45 - vs.carSteer) * Math.min(1, deltaSec * 10);
          if (Math.abs(vs.carSpeed) > 0.25) {
            const steerSign = vs.carSpeed >= 0 ? 1 : -1;
            const speedTurnScale = Math.min(1, Math.abs(vs.carSpeed) / 7);
            vs.carYaw += vs.carSteer * 3.4 * steerSign * speedTurnScale * deltaSec;
          }

          const stepX = -Math.sin(vs.carYaw) * vs.carSpeed * deltaSec;
          const stepZ = -Math.cos(vs.carYaw) * vs.carSpeed * deltaSec;
          const rBuildings = realCityHandleRef.current.buildings;
          const carRadius = 1.25;

          const nextX = Math.max(-1550, Math.min(1550, vs.carPos.x + stepX));
          if (!collidesWithRealBuildings(nextX, vs.carPos.z, rBuildings, 0, carRadius)) {
            vs.carPos.x = nextX;
          } else {
            vs.carSpeed *= 0.45;
          }

          const nextZ = Math.max(-1550, Math.min(1550, vs.carPos.z + stepZ));
          if (!collidesWithRealBuildings(vs.carPos.x, nextZ, rBuildings, 0, carRadius)) {
            vs.carPos.z = nextZ;
          } else {
            vs.carSpeed *= 0.45;
          }

          const { actors } = realCityHandleRef.current;
          actors.carGroup.position.set(vs.carPos.x, 0.03, vs.carPos.z);
          actors.carGroup.rotation.y = vs.carYaw;
          actors.carFrontLeftPivot.rotation.y = vs.carSteer;
          actors.carFrontRightPivot.rotation.y = vs.carSteer;

          realCityCarSpeedRatio = vs.carSpeed / 12;
          liveSpeedKmh = Math.abs(vs.carSpeed) * 3.6;
          liveAltM = 0;
          ps.onBuildingName = null;

          const camViewYaw = vs.carYaw + vs.chaseYawOffset;
          const carChaseDist = 7.4;
          _chaseTarget.set(
            vs.carPos.x + Math.sin(camViewYaw) * carChaseDist,
            vs.carPos.y + 2.4 + vs.chasePitchOffset * 4.5,
            vs.carPos.z + Math.cos(camViewYaw) * carChaseDist
          );
          cameraRef.current.position.lerp(_chaseTarget, Math.min(1, deltaSec * 8.5));
          cameraRef.current.lookAt(vs.carPos.x, vs.carPos.y + 1.0, vs.carPos.z);
        }

        // Throttled telemetry emission for Cidade Real HUD
        if (isRealCity && onRealCityTelemetryRef.current && now - lastTelemetryEmitMsRef.current > 120) {
          lastTelemetryEmitMsRef.current = now;
          const refPos =
            vMode === 'drone'
              ? vs.dronePos
              : vMode === 'plane'
                ? vs.planePos
                : vMode === 'car'
                  ? vs.carPos
                  : ps.pos;
          const { building: nb, dist: nd } = findNearestBuilding(
            refPos.x,
            refPos.z,
            realCityHandleRef.current!.buildings
          );
          const curPlan = planeFlightPlanRef.current;
          const clampedPlanDuration = curPlan
            ? Math.max(
                PLANE_MIN_FLIGHT_DURATION_SEC,
                Math.min(PLANE_MAX_FLIGHT_DURATION_SEC, curPlan.durationSec)
              )
            : 0;
          const curProgress =
            vMode === 'plane' && curPlan && curPlan.active
              ? Math.min(1, flightTrackerRef.current.elapsedSec / clampedPlanDuration)
              : null;
          const curEase =
            curProgress !== null
              ? curProgress < 0.5
                ? 2 * curProgress * curProgress
                : 1 - Math.pow(-2 * curProgress + 2, 2) / 2
              : null;
          onRealCityTelemetryRef.current({
            vehicleMode: vMode,
            altitudeM: Number(liveAltM.toFixed(1)),
            speedKmh: Math.round(liveSpeedKmh),
            onBuildingName: ps.onBuildingName,
            nearestBuildingName: nb ? (nb.name || 'Prédio') : null,
            nearestBuildingHeight: nb ? nb.height : null,
            nearestBuildingDist: nb ? Number(nd.toFixed(1)) : null,
            liveLat: liveGeoRef.current.lat,
            liveLng: liveGeoRef.current.lng,
            flightProgress: curProgress,
            flightDestName: curPlan?.active ? curPlan.destName : null,
            flightRemainingKm:
              curPlan?.active && curEase !== null
                ? Math.max(0, Math.round(curPlan.totalDistanceKm * (1 - curEase)))
                : null,
            flightRemainingSec:
              curPlan?.active && curProgress !== null
                ? Math.max(0, clampedPlanDuration - flightTrackerRef.current.elapsedSec)
                : null,
          });
        }
      } else if (controlsRef.current && controlsRef.current.enabled) {
        controlsRef.current.update();
      }

      if (skyMaterialRef.current) {
        skyMaterialRef.current.uniforms.time.value += deltaSec;
        if (activeInteractiveRef.current) {
          if (sceneThemeRef.current === 'city_real' && realCityHandleRef.current) {
            realCityHandleRef.current.updateRealCityState(
              solarAltitudeRef.current,
              skyMaterialRef.current.uniforms.time.value,
              deltaSec,
              isPersonModeRef.current ? realCityVehicleModeRef.current : 'walk',
              realCityCarSpeedRatio,
              realCityCarBraking
            );
          } else if (sceneThemeRef.current === 'solar_time' && solarTimeHandleRef.current) {
            solarTimeHandleRef.current.updateSolarTimeScene({
              solarAltitudeDeg: solarAltitudeRef.current,
              solarAzimuthDeg: solarAzRef.current,
              lightVector3D: lightVectorRef.current,
              lstMinutes: lstMinutesRef.current,
              civilHours: civilHoursRef.current,
              latitude: solarLatRef.current,
              version: solarClockVersionRef.current,
              wallAzimuthDeg: solarWallAzimuthRef.current,
              floorAzimuthDeg: solarFloorAzimuthRef.current,
              elapsedSec: skyMaterialRef.current.uniforms.time.value,
            });
          } else {
            const activeHandle =
              sceneThemeRef.current === 'city_cars'
                ? cityCarsHandleRef.current
                : sceneThemeRef.current === 'city_people'
                  ? cityPeopleHandleRef.current
                  : sceneThemeRef.current === 'farm'
                    ? farmHandleRef.current
                    : null;

            if (activeHandle) {
              const signalState = activeHandle.updateCityState(
                solarAltitudeRef.current,
                skyMaterialRef.current.uniforms.time.value,
                deltaSec
              );
              if (
                onTrafficSignalChangeRef.current &&
                (signalState.ew !== lastSignalSentRef.current.ew ||
                  signalState.ns !== lastSignalSentRef.current.ns)
              ) {
                lastSignalSentRef.current = signalState;
                onTrafficSignalChangeRef.current(signalState);
              }
            }
          }
        }
      }

      // Keep sky dome & optical-infinity Sun anchored around active camera at any altitude (up to 11 km)
      if (cameraRef.current) {
        const camPos = cameraRef.current.position;
        const inLandscape = Boolean(landscapeGroupRef.current?.visible);
        if (inLandscape) {
          if (skyMeshRef.current) {
            skyMeshRef.current.position.copy(camPos);
          }
          if (sunMeshRef.current && sunMeshRef.current.visible) {
            const lv = lightVectorRef.current;
            sunMeshRef.current.position.set(
              camPos.x + lv.x * 640,
              camPos.y + lv.y * 640,
              camPos.z + lv.z * 640
            );
          }
          const camY = Math.max(0, camPos.y);
          const desiredNear = camY > 350 ? Math.min(2.5, Math.max(0.25, camY * 0.00022)) : 0.1;
          const desiredFar = Math.max(32000, camY * 3.0 + 22000);
          if (
            Math.abs(cameraRef.current.far - desiredFar) > 400 ||
            Math.abs(cameraRef.current.near - desiredNear) > 0.15
          ) {
            cameraRef.current.near = desiredNear;
            cameraRef.current.far = desiredFar;
            cameraRef.current.updateProjectionMatrix();
          }
          if (sceneRef.current?.fog) {
            (sceneRef.current.fog as THREE.FogExp2).density =
              baseFogDensityRef.current / (1 + Math.max(0, camY - 120) * 0.022);
          }
        } else {
          if (skyMeshRef.current) skyMeshRef.current.position.set(0, 0, 0);
          if (Math.abs(cameraRef.current.far - 1600) > 50 || Math.abs(cameraRef.current.near - 0.1) > 0.05) {
            cameraRef.current.near = 0.1;
            cameraRef.current.far = 1600;
            cameraRef.current.updateProjectionMatrix();
          }
          if (sceneRef.current?.fog) {
            (sceneRef.current.fog as THREE.FogExp2).density = 0;
          }
          if (realEarthHandleRef.current) {
            realEarthHandleRef.current.updateSunAndClouds(
              globeSunDirRef.current.x,
              globeSunDirRef.current.y,
              globeSunDirRef.current.z,
              deltaSec
            );
          }
        }
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        if (!isSoftwareGl && visualStyleRef.current === 'gta_vice_city') {
          if (!composerRef.current) {
            const cw = container?.clientWidth || window.innerWidth;
            const ch = container?.clientHeight || window.innerHeight;
            const composer = new EffectComposer(rendererRef.current);
            composer.addPass(new RenderPass(sceneRef.current, cameraRef.current));
            const bloomPass = new UnrealBloomPass(
              new THREE.Vector2(cw, ch),
              0.34,
              0.72,
              0.78
            );
            bloomPassRef.current = bloomPass;
            composer.addPass(bloomPass);
            composer.addPass(new OutputPass());
            const vicePass = new ShaderPass(ViceCityGradeShader);
            viceCityPassRef.current = vicePass;
            composer.addPass(vicePass);
            composerRef.current = composer;
          }
          if (viceCityPassRef.current && skyMaterialRef.current) {
            viceCityPassRef.current.uniforms.uTime.value =
              skyMaterialRef.current.uniforms.time.value;
          }
          composerRef.current.render();
        } else {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      }

      if (isSoftwareGl) {
        afterDraw(animate);
      } else {
        animFrameIdRef.current = requestAnimationFrame(animate);
      }
    }

    animate();

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const newW = container.clientWidth || window.innerWidth;
      const newH = container.clientHeight || window.innerHeight;
      cameraRef.current.aspect = newW / newH;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
      if (composerRef.current) {
        composerRef.current.setSize(newW, newH);
      }
      if (bloomPassRef.current) {
        bloomPassRef.current.setSize(newW, newH);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      domEl.removeEventListener('pointerdown', handlePointerDown);
      domEl.removeEventListener('pointermove', handlePointerMove);
      domEl.removeEventListener('pointerup', handlePointerUpOrCancel);
      domEl.removeEventListener('pointercancel', handlePointerUpOrCancel);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        clearTimeout(animFrameIdRef.current);
      }
      if (composerRef.current) {
        composerRef.current.dispose();
        composerRef.current = null;
      }
      viceCityPassRef.current = null;
      bloomPassRef.current = null;
      if (cityCarsHandleRef.current) {
        cityCarsHandleRef.current.dispose();
        cityCarsHandleRef.current = null;
      }
      if (cityPeopleHandleRef.current) {
        cityPeopleHandleRef.current.dispose();
        cityPeopleHandleRef.current = null;
      }
      if (farmHandleRef.current) {
        farmHandleRef.current.dispose();
        farmHandleRef.current = null;
      }
      if (realCityHandleRef.current) {
        realCityHandleRef.current.dispose();
        realCityHandleRef.current = null;
      }
      if (solarTimeHandleRef.current) {
        solarTimeHandleRef.current.dispose();
        solarTimeHandleRef.current = null;
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Build / Swap Real City 3D World dynamically whenever realCityData updates
  useEffect(() => {
    const landscapeGroup = landscapeGroupRef.current;
    if (!landscapeGroup) return;

    if (realCityHandleRef.current) {
      landscapeGroup.remove(realCityHandleRef.current.cityGroup);
      realCityHandleRef.current.dispose();
      realCityHandleRef.current = null;
    }

    if (!realCityData) return;

    const handle = buildRealCityScene(
      realCityData,
      maxAnisotropyRef.current,
      isSoftwareGlRef.current
    );
    handle.cityGroup.visible = sceneThemeRef.current === 'city_real';
    realCityHandleRef.current = handle;
    landscapeGroup.add(handle.cityGroup);

    liveGeoRef.current.lat = realCityData.latitude;
    liveGeoRef.current.lng = realCityData.longitude;

    const [sx, sz] = realCityData.spawnPoint;
    personStateRef.current.pos.set(sx, 1.72, sz);
    personStateRef.current.floorY = 0;
    personStateRef.current.onBuildingName = null;
    personStateRef.current.yaw = 0;

    vehicleStateRef.current.dronePos.set(sx + 2.4, 10.0, sz);
    vehicleStateRef.current.droneVel.set(0, 0, 0);
    vehicleStateRef.current.droneYaw = 0;
    if (!planeFlightPlanRef.current?.active) {
      vehicleStateRef.current.planePos.set(sx, 65.0, sz + 26);
      vehicleStateRef.current.planeYaw = 0;
      vehicleStateRef.current.planePitch = 0;
      vehicleStateRef.current.planeBank = 0;
      vehicleStateRef.current.planeSpeed = 32;
    }
    vehicleStateRef.current.carPos.set(sx - 2.6, 0.03, sz + 1.5);
    vehicleStateRef.current.carYaw = 0;
    vehicleStateRef.current.carSpeed = 0;
    vehicleStateRef.current.carSteer = 0;
    vehicleStateRef.current.chaseYawOffset = 0;
  }, [realCityData]);

  // Update Camera Presets (360° Free, Modo Pessoa, Ground, Zenith, North, South, East, West)
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    const personActive =
      viewMode === 'landscape' && isInteractiveTheme(sceneTheme) && cameraPreset === 'person';
    const droneCamActive = viewMode === 'landscape' && cameraPreset === 'drone';
    const isOrbitAllowed = cameraPreset === 'free360';
    isPersonModeRef.current = personActive;
    isDroneCamModeRef.current = droneCamActive;

    const prevDamping = controls.enableDamping;

    if (droneCamActive) {
      controls.enabled = false;
      controls.enableRotate = false;
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = prevDamping;

      // Launch camera drone from elevated aerial viewpoint preserving current horizontal direction
      const euler = droneEulerRef.current;
      euler.setFromQuaternion(camera.quaternion, 'YXZ');
      const startPos = droneCamStateRef.current.pos;
      startPos.copy(camera.position);
      if (startPos.y < 3.5) {
        startPos.set(0, 14, 24);
        droneCamStateRef.current.yaw = 0;
        droneCamStateRef.current.pitch = -0.32;
      } else {
        droneCamStateRef.current.yaw = euler.y;
        droneCamStateRef.current.pitch = Math.max(-1.4, Math.min(1.4, euler.x));
      }
      droneCamStateRef.current.vel.set(0, 0, 0);
      droneCamStateRef.current.roll = 0;
      camera.position.copy(droneCamStateRef.current.pos);
      camera.rotation.set(droneCamStateRef.current.pitch, droneCamStateRef.current.yaw, 0, 'YXZ');
      return;
    }

    if (personActive) {
      controls.enabled = false;
      controls.enableRotate = false;
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = prevDamping;

      // Spawn safely inside the chosen scenario overlooking key landmarks
      if (sceneTheme === 'city_cars') {
        personStateRef.current.pos.set(-12.2, 1.80, 12.2);
        personStateRef.current.yaw = Math.atan2(12.2, -12.2);
      } else if (sceneTheme === 'farm') {
        personStateRef.current.pos.set(-5.2, 1.72, 9.8);
        personStateRef.current.yaw = Math.atan2(5.2, -9.8);
      } else if (sceneTheme === 'city_real' && realCityHandleRef.current) {
        const [sx, sz] = realCityHandleRef.current.data.spawnPoint;
        personStateRef.current.pos.set(sx, 1.72, sz);
        personStateRef.current.floorY = 0;
        personStateRef.current.onBuildingName = null;
        personStateRef.current.yaw = 0;
      } else if (sceneTheme === 'solar_time') {
        if (solarClockVersion === 'floor_horizontal') {
          personStateRef.current.pos.set(0, 1.72, 14.5);
          personStateRef.current.yaw = 0;
        } else {
          const effAz =
            solarWallAzimuthRef.current !== null
              ? ((solarWallAzimuthRef.current % 360) + 360) % 360
              : solarLatRef.current < 0
                ? 0
                : 180;
          const azRad = (effAz * Math.PI) / 180;
          const dirX = Math.sin(azRad);
          const dirZ = -Math.cos(azRad);
          personStateRef.current.pos.set(dirX * 15.0, 1.72, dirZ * 15.0);
          personStateRef.current.yaw = Math.atan2(dirX, dirZ);
        }
      } else {
        personStateRef.current.pos.set(-6.8, 1.72, 10.5);
        personStateRef.current.yaw = Math.atan2(6.8, -10.5);
      }
      personStateRef.current.pitch = 0.04;
      camera.position.copy(personStateRef.current.pos);
      camera.rotation.set(personStateRef.current.pitch, personStateRef.current.yaw, 0, 'YXZ');
      return;
    }

    // Ensure standard rotation order is restored when exiting Modo Pessoa
    camera.rotation.order = 'XYZ';

    // Clear any leftover damping inertia before applying new preset
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = prevDamping;

    if (viewMode === 'landscape') {
      controls.minDistance = 1;
      controls.maxDistance = 240;
      controls.target.set(0, 0.5, 0);

      switch (cameraPreset) {
        case 'ground': // Visão Solo Olhando para o Céu
          camera.position.set(0, 0.8, 0.1);
          controls.target.set(0, 10, 0);
          break;
        case 'zenith': // Visão de Cima (Topo/Zênite 360°)
          camera.position.set(0, 25, 0.001);
          controls.target.set(0, 0, 0);
          break;

        // --- CÂMERA 360° ELEVADA / PANORÂMICA (8 DIREÇÕES) ---
        case 'north': // Olhar para o Norte (0°)
          camera.position.set(0, 5.5, 16);
          controls.target.set(0, 1.2, -8);
          break;
        case 'northeast': // Olhar para o Nordeste (45°)
          camera.position.set(-11.31, 5.5, 11.31);
          controls.target.set(5.66, 1.2, -5.66);
          break;
        case 'east': // Olhar para o Leste (90°)
          camera.position.set(-16, 5.5, 0);
          controls.target.set(8, 1.2, 0);
          break;
        case 'southeast': // Olhar para o Sudeste (135°)
          camera.position.set(-11.31, 5.5, -11.31);
          controls.target.set(5.66, 1.2, 5.66);
          break;
        case 'south': // Olhar para o Sul (180°)
          camera.position.set(0, 5.5, -16);
          controls.target.set(0, 1.2, 8);
          break;
        case 'southwest': // Olhar para o Sudoeste (225°)
          camera.position.set(11.31, 5.5, -11.31);
          controls.target.set(-5.66, 1.2, 5.66);
          break;
        case 'west': // Olhar para o Oeste (270°)
          camera.position.set(16, 5.5, 0);
          controls.target.set(-8, 1.2, 0);
          break;
        case 'northwest': // Olhar para o Noroeste (315°)
          camera.position.set(11.31, 5.5, 11.31);
          controls.target.set(-5.66, 1.2, -5.66);
          break;

        // --- CÂMERA 360° LIVRE EXATAMENTE NO CHÃO A 30 METROS (8 DIREÇÕES) ---
        // Posicionada exatamente no chão (Y = 0.35m) a 30 metros de distância, virada para o centro para ver tudo
        case 'ground_north': // Exatamente no chão a 30m olhando para o Norte
          camera.position.set(0, 0.35, 30);
          controls.target.set(0, 1.1, 0);
          break;
        case 'ground_northeast': // Exatamente no chão a 30m olhando para o Nordeste
          camera.position.set(-21.21, 0.35, 21.21);
          controls.target.set(0, 1.1, 0);
          break;
        case 'ground_east': // Exatamente no chão a 30m olhando para o Leste
          camera.position.set(-30, 0.35, 0);
          controls.target.set(0, 1.1, 0);
          break;
        case 'ground_southeast': // Exatamente no chão a 30m olhando para o Sudeste
          camera.position.set(-21.21, 0.35, -21.21);
          controls.target.set(0, 1.1, 0);
          break;
        case 'ground_south': // Exatamente no chão a 30m olhando para o Sul
          camera.position.set(0, 0.35, -30);
          controls.target.set(0, 1.1, 0);
          break;
        case 'ground_southwest': // Exatamente no chão a 30m olhando para o Sudoeste
          camera.position.set(21.21, 0.35, -21.21);
          controls.target.set(0, 1.1, 0);
          break;
        case 'ground_west': // Exatamente no chão a 30m olhando para o Oeste
          camera.position.set(30, 0.35, 0);
          controls.target.set(0, 1.1, 0);
          break;
        case 'ground_northwest': // Exatamente no chão a 30m olhando para o Noroeste
          camera.position.set(21.21, 0.35, 21.21);
          controls.target.set(0, 1.1, 0);
          break;

        case 'free360':
        default:
          if (sceneTheme === 'solar_time') {
            if (solarClockVersion === 'floor_horizontal') {
              camera.position.set(0, 22, 16);
              controls.target.set(0, 0, 0);
            } else {
              const effAz =
                solarWallAzimuthRef.current !== null
                  ? ((solarWallAzimuthRef.current % 360) + 360) % 360
                  : solarLatRef.current < 0
                    ? 0
                    : 180;
              const azRad = (effAz * Math.PI) / 180;
              camera.position.set(Math.sin(azRad) * 18.5, 7.2, -Math.cos(azRad) * 18.5);
              controls.target.set(0, solarClockVersion === 'wall_tilted_45' ? 4.4 : 5.4, 0);
            }
          }
          break;
      }
    } else {
      controls.minDistance = 6.15;
      controls.maxDistance = 42;
      controls.target.set(0, 0, 0);
      if (cameraPreset === 'zenith') {
        camera.position.set(0, 18, 0.001);
      } else {
        const obsPhi = Math.max(0.15, Math.min(Math.PI - 0.15, (90 - solarLatRef.current) * (Math.PI / 180)));
        const obsTheta = (solarLngRef.current + 180) * (Math.PI / 180);
        const orbitR = 13.5;
        camera.position.set(
          -orbitR * Math.sin(obsPhi) * Math.cos(obsTheta),
          orbitR * Math.cos(obsPhi),
          orbitR * Math.sin(obsPhi) * Math.sin(obsTheta)
        );
      }
    }

    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = prevDamping;

    // Camera movement is ONLY valid in Órbita ('free360') or Cidade Modo Pessoa ('person').
    // Fixed viewpoints (Zênite, N, NE, L, SE, S, SO, O, NO, Céu, Chão 30m) stay strictly locked.
    controls.enabled = isOrbitAllowed;
    controls.enableRotate = isOrbitAllowed;
    controls.enableZoom = isOrbitAllowed;
    controls.enablePan = isOrbitAllowed;
  }, [cameraPreset, viewMode, sceneTheme, solarClockVersion]);

  const solarHemisphereIsSouth = solarParams.latitude < 0;
  useEffect(() => {
    if (
      !cameraRef.current ||
      !controlsRef.current ||
      viewMode !== 'landscape' ||
      sceneTheme !== 'solar_time' ||
      solarClockVersion === 'floor_horizontal' ||
      solarWallAzimuthDeg !== null ||
      cameraPreset !== 'free360'
    ) {
      return;
    }
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const prevDamping = controls.enableDamping;
    controls.enableDamping = false;
    camera.position.set(0, 7.2, solarHemisphereIsSouth ? -18.5 : 18.5);
    controls.target.set(0, solarClockVersion === 'wall_tilted_45' ? 4.4 : 5.4, 0);
    controls.update();
    controls.enableDamping = prevDamping;
  }, [solarHemisphereIsSouth]);

  // Update Dynamic Scene Parameters (Sun Vector, Sky Color, Globe Pins)
  // Update Dynamic Scene Parameters (Sun Vector, Sky Color, Horizon Glow, Starfield, Globe Pins)
  useEffect(() => {
    if (!sceneRef.current) return;

    const {
      lightVector3D,
      sunColorHex,
      sunIntensity,
      skyColorHex,
      horizonColorHex,
      sunHorizonGlowColorHex,
      sunHorizonIntensity,
      beltOfVenusIntensity,
      starsIntensity,
      solarAltitudeDeg,
      subsolarLatitude,
      subsolarLongitude,
      twilightPhase,
    } = solarResults;
    const { latitude, longitude, axialTilt } = solarParams;

    const smoothStep = (edge0: number, edge1: number, x: number) => {
      const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
      return t * t * (3 - 2 * t);
    };

    const dayFactor = smoothStep(-2, 18, solarAltitudeDeg);
    const highSunFactor = smoothStep(8, 58, solarAltitudeDeg);
    const twilightMidFactor = Math.exp(-Math.pow((solarAltitudeDeg + 2.5) / 4.2, 2));
    const nightFactor = smoothStep(-2, -16, solarAltitudeDeg);
    const localCityProfile =
      visualStyle === 'local_city'
        ? resolveLocalCityVisualProfile(
            latitude,
            longitude,
            solarParams.timeZoneId,
            realCityData?.cityName
          )
        : null;

    if (viewMode === 'globe') {
      // In Globe 3D view, illuminate Earth along the true Subsolar Point vector
      const subPhi = (90 - subsolarLatitude) * (Math.PI / 180);
      const subTheta = (subsolarLongitude + 180) * (Math.PI / 180);
      const sx = -Math.sin(subPhi) * Math.cos(subTheta);
      const sy = Math.cos(subPhi);
      const sz = Math.sin(subPhi) * Math.sin(subTheta);
      globeSunDirRef.current.set(sx, sy, sz).normalize();

      if (sunLightRef.current) {
        sunLightRef.current.target.position.set(0, 0, 0);
        sunLightRef.current.target.updateMatrixWorld();
        sunLightRef.current.position.set(sx * 48, sy * 48, sz * 48);
        sunLightRef.current.color.setHex(0xfff7e6);
        sunLightRef.current.intensity = 2.85;
      }
      if (moonLightRef.current) {
        moonLightRef.current.intensity = 0;
      }
      if (hemiLightRef.current) {
        hemiLightRef.current.color.setHex(0x7fb4ff);
        hemiLightRef.current.groundColor.setHex(0x050914);
        hemiLightRef.current.intensity = 0.18;
      }
      sceneRef.current.environmentIntensity = 0.08;
      sceneRef.current.background = new THREE.Color(0x02050d);
      if (rendererRef.current) {
        rendererRef.current.toneMappingExposure = 1.06;
      }
    } else {
      sceneRef.current.background = null;
      // Landscape mode: Real-world atmospheric lighting valid across ALL maps
      const targetRange =
        sceneTheme === 'city_real'
          ? 155
          : sceneTheme === 'city_cars' || sceneTheme === 'city_people' || sceneTheme === 'farm'
            ? 68
            : sceneTheme === 'solar_time'
              ? 36
              : 42;
      const sunDist = sceneTheme === 'city_real' ? 220 : targetRange === 68 ? 115 : targetRange === 36 ? 95 : 80;

      if (sunLightRef.current) {
        let tx = 0;
        let tz = 0;
        if (sceneTheme === 'city_real' && cameraRef.current) {
          tx = Math.round(cameraRef.current.position.x / 12) * 12;
          tz = Math.round(cameraRef.current.position.z / 12) * 12;
        }
        sunLightRef.current.target.position.set(tx, 0, tz);
        sunLightRef.current.target.updateMatrixWorld();

        if (lastShadowRangeRef.current !== targetRange) {
          lastShadowRangeRef.current = targetRange;
          sunLightRef.current.shadow.camera.left = -targetRange;
          sunLightRef.current.shadow.camera.right = targetRange;
          sunLightRef.current.shadow.camera.top = targetRange;
          sunLightRef.current.shadow.camera.bottom = -targetRange;
          sunLightRef.current.shadow.camera.far = sunDist * 2.4;
          sunLightRef.current.shadow.camera.updateProjectionMatrix();
        }

        sunLightRef.current.position.set(
          tx + lightVector3D.x * sunDist,
          lightVector3D.y * sunDist,
          tz + lightVector3D.z * sunDist
        );
        sunLightRef.current.color.set(sunColorHex);
        if (visualStyle === 'gta_vice_city') {
          sunLightRef.current.color.lerp(new THREE.Color(0xffd068), 0.25 + 0.55 * dayFactor);
          sunLightRef.current.intensity = sunIntensity * (1.0 + 0.22 * dayFactor);
        } else if (localCityProfile) {
          sunLightRef.current.color.lerp(
            new THREE.Color(localCityProfile.sunTintHex),
            localCityProfile.sunTintBlend * dayFactor
          );
          sunLightRef.current.intensity =
            sunIntensity * (1.0 + (localCityProfile.sunIntensityMult - 1.0) * dayFactor);
        } else {
          sunLightRef.current.intensity = sunIntensity;
        }
      }

      if (moonLightRef.current) {
        const mLen = Math.hypot(-lightVector3D.x * 0.72, 0.65, -lightVector3D.z * 0.72) || 1;
        moonLightRef.current.position.set(
          (-lightVector3D.x * 0.72 / mLen) * 90,
          (0.65 / mLen) * 90,
          (-lightVector3D.z * 0.72 / mLen) * 90
        );
        moonLightRef.current.intensity = nightFactor * 0.22;
      }

      if (hemiLightRef.current) {
        const biomeDayBounceHex =
          sceneTheme === 'city_cars' || sceneTheme === 'city_real'
            ? 0x3b414c
            : sceneTheme === 'city_people'
              ? 0x4d473d
              : sceneTheme === 'farm'
                ? 0x425b2d
                : sceneTheme === 'solar_time'
                  ? 0x3d434f
                  : 0x2e4228;
        hemiLightRef.current.color.set(skyColorHex);
        if (visualStyle === 'gta_vice_city') {
          hemiLightRef.current.color.lerp(new THREE.Color(0x22d3ee), 0.62 * dayFactor + 0.15);
          hemiLightRef.current.groundColor
            .setHex(0x06202a)
            .lerp(new THREE.Color(0x0d5c66), 0.22 + dayFactor * 0.78);
          hemiLightRef.current.intensity =
            0.08 + twilightMidFactor * 0.30 + dayFactor * 0.64 + highSunFactor * 0.18;
        } else if (localCityProfile) {
          hemiLightRef.current.color.lerp(
            new THREE.Color(localCityProfile.skyTopTintHex),
            localCityProfile.skyTopBlend * dayFactor
          );
          hemiLightRef.current.groundColor
            .setHex(0x070b12)
            .lerp(new THREE.Color(localCityProfile.shadowBounceHex), 0.14 + dayFactor * 0.86);
          hemiLightRef.current.intensity =
            (0.055 + twilightMidFactor * 0.26 + dayFactor * 0.56 + highSunFactor * 0.16) *
            localCityProfile.hemiIntensityMult;
        } else {
          hemiLightRef.current.groundColor
            .setHex(0x070b12)
            .lerp(new THREE.Color(biomeDayBounceHex), 0.1 + dayFactor * 0.9);
          hemiLightRef.current.intensity =
            0.055 + twilightMidFactor * 0.26 + dayFactor * 0.56 + highSunFactor * 0.16;
        }
      }

      // Suppress studio RoomEnvironment at night so real sky/sun/moon/streetlamps govern illumination;
      // Boost glossy specular reflections in GTA Vice City or local city daylight profile.
      const baseEnv = 0.045 + twilightMidFactor * 0.14 + dayFactor * 0.72 + highSunFactor * 0.12;
      sceneRef.current.environmentIntensity =
        visualStyle === 'gta_vice_city'
          ? Math.min(1.38, baseEnv * 1.48 + 0.14 * dayFactor)
          : localCityProfile
            ? Math.min(1.25, baseEnv * localCityProfile.envIntensityMult)
            : baseEnv;

      if (rendererRef.current) {
        const baseExp = 0.96 + twilightMidFactor * 0.16 + dayFactor * 0.04 - highSunFactor * 0.02;
        rendererRef.current.toneMappingExposure =
          visualStyle === 'gta_vice_city'
            ? baseExp + 0.09 * dayFactor
            : localCityProfile
              ? baseExp + localCityProfile.exposureOffset * dayFactor
              : baseExp;
      }
    }

    if (sunMeshRef.current) {
      if (viewMode === 'globe') {
        const gSunDist = 240;
        sunMeshRef.current.position.set(
          globeSunDirRef.current.x * gSunDist,
          globeSunDirRef.current.y * gSunDist,
          globeSunDirRef.current.z * gSunDist
        );
        sunMeshRef.current.visible = true;
        sunMeshRef.current.scale.set(0.8, 0.8, 0.8);
        (sunMeshRef.current.material as THREE.MeshBasicMaterial).color.setHex(0xfff6d6);
      } else {
        const sunDist = 640;
        const cx = cameraRef.current ? cameraRef.current.position.x : 0;
        const cy = cameraRef.current ? cameraRef.current.position.y : 0;
        const cz = cameraRef.current ? cameraRef.current.position.z : 0;
        sunMeshRef.current.position.set(
          cx + lightVector3D.x * sunDist,
          cy + lightVector3D.y * sunDist,
          cz + lightVector3D.z * sunDist
        );

        // Atmospheric optical refraction: sun disk appears slightly magnified and flattened near horizon
        if (solarAltitudeDeg > -4.0) {
          sunMeshRef.current.visible = true;
          const isNearHorizon = solarAltitudeDeg >= -2.0 && solarAltitudeDeg <= 14.0;
          const horizonScale = isNearHorizon ? 1.0 + (1.0 - Math.max(0, solarAltitudeDeg) / 14.0) * 0.38 : 1.0;
          const verticalFlattening = isNearHorizon ? 1.0 - (1.0 - Math.max(0, solarAltitudeDeg) / 14.0) * 0.16 : 1.0;
          sunMeshRef.current.scale.set(horizonScale, horizonScale * verticalFlattening, horizonScale);
          (sunMeshRef.current.material as THREE.MeshBasicMaterial).color.set(sunColorHex);
          if (visualStyle === 'gta_vice_city') {
            (sunMeshRef.current.material as THREE.MeshBasicMaterial).color.lerp(new THREE.Color(0xffda75), 0.55);
          } else if (localCityProfile) {
            (sunMeshRef.current.material as THREE.MeshBasicMaterial).color.lerp(
              new THREE.Color(localCityProfile.sunTintHex),
              localCityProfile.sunTintBlend
            );
          }
        } else {
          sunMeshRef.current.visible = false;
        }
      }
    }

    if (skyMaterialRef.current) {
      skyMaterialRef.current.uniforms.topColor.value.set(skyColorHex);
      skyMaterialRef.current.uniforms.bottomColor.value.set(horizonColorHex);
      skyMaterialRef.current.uniforms.sunHorizonGlowColor.value.set(sunHorizonGlowColorHex);
      skyMaterialRef.current.uniforms.viceCityMix.value = visualStyle === 'gta_vice_city' ? 1.0 : 0.0;

      if (visualStyle === 'gta_vice_city') {
        skyMaterialRef.current.uniforms.topColor.value.lerp(
          new THREE.Color(0x0088b8),
          0.74 * dayFactor + 0.16 * twilightMidFactor
        );
        skyMaterialRef.current.uniforms.bottomColor.value.lerp(
          new THREE.Color(0x2ce6e6),
          0.62 * dayFactor
        );
        skyMaterialRef.current.uniforms.bottomColor.value.lerp(
          new THREE.Color(0xff7ea8),
          0.42 * twilightMidFactor + 0.18 * dayFactor
        );
        skyMaterialRef.current.uniforms.sunHorizonGlowColor.value.lerp(
          new THREE.Color(0xff7b9c),
          0.45
        );
      } else if (localCityProfile) {
        skyMaterialRef.current.uniforms.topColor.value.lerp(
          new THREE.Color(localCityProfile.skyTopTintHex),
          localCityProfile.skyTopBlend * dayFactor
        );
        skyMaterialRef.current.uniforms.bottomColor.value.lerp(
          new THREE.Color(localCityProfile.horizonTintHex),
          localCityProfile.horizonBlend * dayFactor
        );
      }

      skyMaterialRef.current.uniforms.sunPosition.value.set(
        lightVector3D.x,
        lightVector3D.y,
        lightVector3D.z
      );
      skyMaterialRef.current.uniforms.sunHorizonIntensity.value =
        visualStyle === 'gta_vice_city'
          ? Math.max(sunHorizonIntensity, 0.35 * dayFactor)
          : sunHorizonIntensity;
      skyMaterialRef.current.uniforms.beltOfVenusIntensity.value = beltOfVenusIntensity;
      skyMaterialRef.current.uniforms.starsIntensity.value = starsIntensity;
    }

    if (earthHorizonMatRef.current) {
      // Dynamic Earth ground horizon tint harmonized with real sun altitude & scenario biome
      const baseDayHex =
        sceneTheme === 'city_cars' || sceneTheme === 'city_real'
          ? 0x28303b
          : sceneTheme === 'city_people'
            ? 0x3f3c33
            : sceneTheme === 'farm'
              ? 0x2e4a24
              : sceneTheme === 'solar_time'
                ? 0x242c38
                : 0x253825;
      const nightHex = 0x050810;
      earthHorizonMatRef.current.color.setHex(nightHex).lerp(new THREE.Color(baseDayHex), dayFactor);
      if (visualStyle === 'gta_vice_city') {
        earthHorizonMatRef.current.color.lerp(new THREE.Color(0x1f5f68), 0.28 * dayFactor);
      } else if (localCityProfile) {
        earthHorizonMatRef.current.color.lerp(
          new THREE.Color(localCityProfile.shadowBounceHex),
          0.22 * dayFactor
        );
      }
    }

    if (sceneRef.current.fog) {
      const fog = sceneRef.current.fog as THREE.FogExp2;
      if (viewMode === 'globe') {
        baseFogDensityRef.current = 0;
        fog.density = 0;
      } else {
        fog.color.set(horizonColorHex);
        if (visualStyle === 'gta_vice_city') {
          fog.color.lerp(new THREE.Color(0x45dce0), 0.45 * dayFactor);
          fog.color.lerp(new THREE.Color(0xff8eb4), 0.25 * twilightMidFactor + 0.12 * dayFactor);
        } else if (localCityProfile) {
          fog.color.lerp(
            new THREE.Color(localCityProfile.horizonTintHex),
            localCityProfile.horizonBlend * dayFactor
          );
        }
        const isWarmTwilight = twilightPhase === 'Golden Hour' || twilightPhase === 'Civil Twilight';
        const baseFog = isWarmTwilight ? 0.0046 : solarAltitudeDeg < -10 ? 0.0032 : 0.0038;
        const computedFog = Math.max(
          0.0022,
          baseFog + (localCityProfile ? localCityProfile.fogDensityOffset * dayFactor : 0)
        );
        baseFogDensityRef.current = computedFog;
        const camY = cameraRef.current ? Math.max(0, cameraRef.current.position.y) : 0;
        fog.density = computedFog / (1 + Math.max(0, camY - 120) * 0.022);
      }
    }

    if (sunBeamLineRef.current) {
      const positions = sunBeamLineRef.current.geometry.attributes.position;
      positions.setXYZ(0, 0, 0.5, 0);
      positions.setXYZ(1, lightVector3D.x * 25, lightVector3D.y * 25, lightVector3D.z * 25);
      positions.needsUpdate = true;
      sunBeamLineRef.current.visible = showVectors;
    }

    sceneThemeRef.current = sceneTheme;
    solarAltitudeRef.current = solarAltitudeDeg;
    activeInteractiveRef.current = viewMode === 'landscape' && isInteractiveTheme(sceneTheme);

    const landscapeObj = sceneRef.current.getObjectByName('landscapeGroup');
    const globeObj = sceneRef.current.getObjectByName('globeGroup');

    if (viewMode === 'landscape') {
      if (landscapeObj) landscapeObj.visible = true;
      if (globeObj) globeObj.visible = false;
      if (defaultSceneGroupRef.current) {
        defaultSceneGroupRef.current.visible = sceneTheme === 'default';
      }

      const elapsedSec = skyMaterialRef.current ? skyMaterialRef.current.uniforms.time.value : 0;

      if (cityCarsHandleRef.current) {
        const show = sceneTheme === 'city_cars';
        cityCarsHandleRef.current.cityGroup.visible = show;
        if (show) cityCarsHandleRef.current.updateCityState(solarAltitudeDeg, elapsedSec, 0);
      }
      if (cityPeopleHandleRef.current) {
        const show = sceneTheme === 'city_people';
        cityPeopleHandleRef.current.cityGroup.visible = show;
        if (show) cityPeopleHandleRef.current.updateCityState(solarAltitudeDeg, elapsedSec, 0);
      }
      if (farmHandleRef.current) {
        const show = sceneTheme === 'farm';
        farmHandleRef.current.cityGroup.visible = show;
        if (show) farmHandleRef.current.updateCityState(solarAltitudeDeg, elapsedSec, 0);
      }
      if (realCityHandleRef.current) {
        const show = sceneTheme === 'city_real';
        realCityHandleRef.current.cityGroup.visible = show;
        if (show) {
          realCityHandleRef.current.updateRealCityState(
            solarAltitudeDeg,
            elapsedSec,
            0,
            isPersonMode ? realCityVehicleMode : 'walk'
          );
        }
      }
      if (solarTimeHandleRef.current) {
        const show = sceneTheme === 'solar_time';
        solarTimeHandleRef.current.cityGroup.visible = show;
        if (show) {
          solarTimeHandleRef.current.updateSolarTimeScene({
            solarAltitudeDeg,
            solarAzimuthDeg: solarResults.solarAzimuthDeg,
            lightVector3D,
            lstMinutes: solarResults.lstLocalMinutes,
            civilHours: solarResults.localCivilHourFraction,
            latitude,
            version: solarClockVersion,
            wallAzimuthDeg: solarWallAzimuthDeg,
            floorAzimuthDeg: solarFloorAzimuthDeg,
            elapsedSec,
          });
        }
      }
    } else {
      if (landscapeObj) landscapeObj.visible = false;
      if (globeObj) globeObj.visible = true;

      // Keep Earth strictly in true equatorial geographic coordinates (solarEngine already incorporates axialTilt into subsolarLatitude)
      if (earthMeshRef.current) {
        earthMeshRef.current.rotation.set(0, 0, 0);
      }
      if (realEarthHandleRef.current) {
        realEarthHandleRef.current.updateSunAndClouds(
          globeSunDirRef.current.x,
          globeSunDirRef.current.y,
          globeSunDirRef.current.z,
          0
        );
      }

      if (observerPinRef.current) {
        const earthR = 5.015;
        const phi = (90 - latitude) * (Math.PI / 180);
        const theta = (longitude + 180) * (Math.PI / 180);

        const px = -earthR * Math.sin(phi) * Math.cos(theta);
        const py = earthR * Math.cos(phi);
        const pz = earthR * Math.sin(phi) * Math.sin(theta);

        observerPinRef.current.position.set(px, py, pz);
        observerPinRef.current.lookAt(0, 0, 0);
      }

      if (subsolarPinRef.current) {
        const earthR = 5.025;
        const phi = (90 - subsolarLatitude) * (Math.PI / 180);
        const theta = (subsolarLongitude + 180) * (Math.PI / 180);

        const px = -earthR * Math.sin(phi) * Math.cos(theta);
        const py = earthR * Math.cos(phi);
        const pz = earthR * Math.sin(phi) * Math.sin(theta);

        subsolarPinRef.current.position.set(px, py, pz);
        subsolarPinRef.current.lookAt(0, 0, 0);
      }
    }
  }, [solarParams, solarResults, viewMode, sceneTheme, solarClockVersion, solarWallAzimuthDeg, solarFloorAzimuthDeg, visualStyle, realCityData?.cityName, showShadowRing, showVectors]);

  const isFreeFlight = isPersonMode || isDroneCamMode;
  const isCameraMovable = isFreeFlight || cameraPreset === 'free360';
  const useSoftwareViceOverlay = isSoftwareGlRef.current && visualStyle === 'gta_vice_city';

  return (
    <div className="relative w-full h-full min-h-[500px] overflow-hidden bg-slate-950">
      <div
        ref={mountRef}
        style={{
          touchAction: isFreeFlight ? 'none' : isCameraMovable ? 'auto' : 'pan-y',
          filter: useSoftwareViceOverlay ? 'saturate(1.28) contrast(1.05) brightness(1.04)' : undefined,
        }}
        className={`w-full h-full ${
          isFreeFlight
            ? 'cursor-crosshair'
            : cameraPreset === 'free360'
              ? 'cursor-grab active:cursor-grabbing'
              : 'cursor-default'
        }`}
      />
      {useSoftwareViceOverlay && (
        <div
          className="pointer-events-none absolute inset-0 mix-blend-screen opacity-35"
          style={{
            background:
              'radial-gradient(circle at 50% 35%, rgba(255, 206, 118, 0.35), rgba(255, 118, 168, 0.16) 45%, rgba(20, 184, 166, 0.12) 100%)',
          }}
        />
      )}
    </div>
  );
};
