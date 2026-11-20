import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  Map as GoogleMapComponent,
  AdvancedMarker,
  Pin,
  MapMouseEvent,
} from '@vis.gl/react-google-maps';
import {
  Globe,
  Search,
  Plane,
  Building2,
  MapPin,
  Sun,
  Navigation,
  Clock,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Loader2,
  Layers,
} from 'lucide-react';
import {
  PLANE_MAX_CEILING_M,
  PLANE_MIN_CEILING_M,
  PLANE_MAX_FLIGHT_DURATION_SEC,
  PLANE_MIN_FLIGHT_DURATION_SEC,
  PlaneFlightPlan,
  RealCityData,
  RealCitySearchResult,
  RealCityTelemetry,
  SolarCalculationResult,
  SolarInputParameters,
} from '../types/solar';
import { WORLD_CITY_PRESETS, computeBearingDeg, haversineDistanceKm, searchWorldCities } from '../services/realCityService';
import { getRealEarthDayCanvas } from './RealEarthGlobeBuilder';

interface RealCityGlobalMapProps {
  isOpen: boolean;
  onClose: () => void;
  mapsApiKey?: string;
  solarParams: SolarInputParameters;
  solarResults: SolarCalculationResult;
  realCityData?: RealCityData | null;
  realCityTelemetry?: RealCityTelemetry;
  planeFlightPlan?: PlaneFlightPlan | null;
  planeFlightDurationSec: number;
  planeMaxAltitudeM: number;
  onChangePlaneFlightDurationSec?: (sec: number) => void;
  onChangePlaneMaxAltitudeM?: (altM: number) => void;
  onStartGlobalPlaneFlight?: (lat: number, lng: number, cityName?: string, country?: string) => void;
  onLoadRealCity?: (
    lat: number,
    lng: number,
    cityName?: string,
    country?: string,
    syncCoordinates?: boolean
  ) => void;
  onSyncCoordinatesOnly?: (lat: number, lng: number) => void;
}

interface SelectedMapTarget {
  name: string;
  country: string;
  lat: number;
  lng: number;
}

const REGIONS = [
  'Todos',
  'Brasil',
  'Américas',
  'Europa',
  'África & Oriente',
  'Ásia',
  'Oceania',
] as const;

function formatDurationShort(totalSec: number): string {
  const s = Math.max(
    PLANE_MIN_FLIGHT_DURATION_SEC,
    Math.min(PLANE_MAX_FLIGHT_DURATION_SEC, Math.round(totalSec))
  );
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return m === 0 && sec === 0 ? `${h}h` : `${h}h ${m}m`;
  if (m > 0) return sec === 0 ? `${m} min` : `${m}m ${sec}s`;
  return `${s}s`;
}

function formatUtcHMS(dateOrMs: Date | number): string {
  const d = typeof dateOrMs === 'number' ? new Date(dateOrMs) : dateOrMs;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/** Sample spherical great-circle path between (lat1, lng1) and (lat2, lng2) */
function sampleGreatCirclePoints(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  steps = 48
): Array<[number, number]> {
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;
  const phi1 = lat1 * toRad;
  const lam1 = lng1 * toRad;
  const phi2 = lat2 * toRad;
  const lam2 = lng2 * toRad;

  const x1 = Math.cos(phi1) * Math.cos(lam1);
  const y1 = Math.cos(phi1) * Math.sin(lam1);
  const z1 = Math.sin(phi1);

  const x2 = Math.cos(phi2) * Math.cos(lam2);
  const y2 = Math.cos(phi2) * Math.sin(lam2);
  const z2 = Math.sin(phi2);

  const dot = Math.max(-1, Math.min(1, x1 * x2 + y1 * y2 + z1 * z2));
  const omega = Math.acos(dot);

  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let x: number;
    let y: number;
    let z: number;
    if (omega < 0.0001) {
      x = x1 + (x2 - x1) * t;
      y = y1 + (y2 - y1) * t;
      z = z1 + (z2 - z1) * t;
    } else {
      const sinO = Math.sin(omega);
      const a = Math.sin((1 - t) * omega) / sinO;
      const b = Math.sin(t * omega) / sinO;
      x = a * x1 + b * x2;
      y = a * y1 + b * y2;
      z = a * z1 + b * z2;
    }
    const len = Math.hypot(x, y, z) || 1;
    const lat = Math.asin(Math.max(-1, Math.min(1, z / len))) * toDeg;
    const lng = Math.atan2(y, x) * toDeg;
    pts.push([lng, lat]);
  }
  return pts;
}

export const RealCityGlobalMap: React.FC<RealCityGlobalMapProps> = ({
  isOpen,
  onClose,
  mapsApiKey,
  solarParams,
  solarResults,
  realCityData,
  realCityTelemetry,
  planeFlightPlan,
  planeFlightDurationSec,
  planeMaxAltitudeM,
  onChangePlaneFlightDurationSec,
  onChangePlaneMaxAltitudeM,
  onStartGlobalPlaneFlight,
  onLoadRealCity,
  onSyncCoordinatesOnly,
}) => {
  const currentLat = realCityTelemetry?.liveLat ?? realCityData?.latitude ?? solarParams.latitude;
  const currentLng = realCityTelemetry?.liveLng ?? realCityData?.longitude ?? solarParams.longitude;
  const currentCityLabel =
    realCityData?.cityName || `Lat ${currentLat.toFixed(2)}°, Lon ${currentLng.toFixed(2)}°`;

  const [mapEngine, setMapEngine] = useState<'solar_atlas' | 'google_maps'>('solar_atlas');
  const [googleMapType, setGoogleMapType] = useState<'hybrid' | 'satellite' | 'roadmap' | 'terrain'>('hybrid');
  const [regionFilter, setRegionFilter] = useState<(typeof REGIONS)[number]>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<RealCitySearchResult[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<SelectedMapTarget>({
    name: currentCityLabel,
    country: realCityData?.country || 'Mundo',
    lat: currentLat,
    lng: currentLng,
  });

  // Canvas Pan/Zoom state for Solar World Atlas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<number>(1.05);
  const [centerLon, setCenterLon] = useState<number>(0);
  const [centerLat, setCenterLat] = useState<number>(12);
  const dragStateRef = useRef<{
    dragging: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    startLon: number;
    startLat: number;
  }>({
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    startLon: 0,
    startLat: 12,
  });

  // Sync target when modal opens if no flight is active
  useEffect(() => {
    if (isOpen && planeFlightPlan?.active) {
      setSelectedTarget({
        name: planeFlightPlan.destName,
        country: planeFlightPlan.destCountry,
        lat: planeFlightPlan.destLat,
        lng: planeFlightPlan.destLng,
      });
    }
  }, [isOpen, planeFlightPlan?.id]);

  // Universal Search (Cities, Addresses, Countries, OR "lat, lng" coords)
  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }

    // Check raw coordinate pair input e.g. "-23.55, -46.63"
    const coordMatch = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coordMatch) {
      const lat = Math.max(-85, Math.min(85, parseFloat(coordMatch[1])));
      const lng = Math.max(-180, Math.min(180, parseFloat(coordMatch[2])));
      const customTarget: RealCitySearchResult = {
        name: `Coord (${lat.toFixed(2)}°, ${lng.toFixed(2)}°)`,
        displayName: `Coordenada Exata: ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`,
        lat,
        lng,
        country: 'Mundo',
      };
      setSearchResults([customTarget]);
      setSelectedTarget({
        name: customTarget.name,
        country: 'Mundo',
        lat,
        lng,
      });
      setCenterLon(lng);
      setCenterLat(lat);
      setZoom((z) => Math.max(z, 2.5));
      return;
    }

    setSearching(true);
    try {
      const found = await searchWorldCities(q);
      setSearchResults(found);
      if (found.length > 0) {
        const first = found[0];
        setSelectedTarget({
          name: first.name,
          country: first.country || 'Mundo',
          lat: first.lat,
          lng: first.lng,
        });
        setCenterLon(first.lng);
        setCenterLat(first.lat);
      }
    } finally {
      setSearching(false);
    }
  };

  const catalogCities = useMemo(() => {
    if (searchResults.length > 0 && searchQuery.trim().length > 0) {
      return searchResults;
    }
    const base =
      regionFilter === 'Todos'
        ? WORLD_CITY_PRESETS
        : WORLD_CITY_PRESETS.filter((c) => c.region === regionFilter);

    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.displayName.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q)
    );
  }, [regionFilter, searchQuery, searchResults]);

  const distanceToTargetKm = useMemo(
    () => Math.round(haversineDistanceKm(currentLat, currentLng, selectedTarget.lat, selectedTarget.lng)),
    [currentLat, currentLng, selectedTarget.lat, selectedTarget.lng]
  );

  const bearingToTargetDeg = useMemo(
    () => Math.round(computeBearingDeg(currentLat, currentLng, selectedTarget.lat, selectedTarget.lng)),
    [currentLat, currentLng, selectedTarget.lat, selectedTarget.lng]
  );

  // Render Interactive Solar World Atlas Canvas
  useEffect(() => {
    if (!isOpen || mapEngine !== 'solar_atlas') return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(320, container.clientWidth);
    const height = Math.max(240, container.clientHeight);
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Map scale: baseline fills canvas height (180° lat) or width (360° lon)
    const baseScale = Math.min(width / 360, height / 180) * zoom;
    const project = (lon: number, lat: number): [number, number] => [
      width / 2 + (lon - centerLon) * baseScale,
      height / 2 - (lat - centerLat) * baseScale,
    ];

    // 1. Space / Deep Ocean Backdrop
    ctx.fillStyle = '#040b18';
    ctx.fillRect(0, 0, width, height);

    const mapLeft = width / 2 + (-180 - centerLon) * baseScale;
    const mapRight = width / 2 + (180 - centerLon) * baseScale;
    const mapTop = height / 2 - (90 - centerLat) * baseScale;
    const mapBottom = height / 2 - (-90 - centerLat) * baseScale;
    const mapW = mapRight - mapLeft;
    const mapH = mapBottom - mapTop;

    // Ocean fill
    const oceanGrad = ctx.createLinearGradient(0, mapTop, 0, mapBottom);
    oceanGrad.addColorStop(0, '#0a1f3d');
    oceanGrad.addColorStop(0.5, '#0c2d57');
    oceanGrad.addColorStop(1, '#081a34');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(mapLeft, mapTop, mapW, mapH);

    // 1b. Photorealistic 1:50m Natural Earth Blue Marble Satellite Base Layer
    const earthDayCanvas = getRealEarthDayCanvas();
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(earthDayCanvas, mapLeft, mapTop, mapW, mapH);
    ctx.restore();

    // 2. Real-Time Solar Day / Night Terminator Shading Grid
    const subLatRad = (solarResults.subsolarLatitude * Math.PI) / 180;
    const subLngRad = (solarResults.subsolarLongitude * Math.PI) / 180;
    const sinSubLat = Math.sin(subLatRad);
    const cosSubLat = Math.cos(subLatRad);

    const stepDeg = zoom > 2.2 ? 3 : 4;
    for (let lon = -180; lon < 180; lon += stepDeg) {
      for (let lat = -90; lat < 90; lat += stepDeg) {
        const phi = ((lat + stepDeg / 2) * Math.PI) / 180;
        const lam = ((lon + stepDeg / 2) * Math.PI) / 180;
        const cosZ =
          Math.sin(phi) * sinSubLat + Math.cos(phi) * cosSubLat * Math.cos(lam - subLngRad);
        const solarAltDeg = (Math.asin(Math.max(-1, Math.min(1, cosZ))) * 180) / Math.PI;

        if (solarAltDeg < 2) {
          const [px1, py1] = project(lon, lat + stepDeg);
          const [px2, py2] = project(lon + stepDeg, lat);
          if (px2 < 0 || px1 > width || py2 < 0 || py1 > height) continue;

          if (solarAltDeg <= -6) {
            ctx.fillStyle = 'rgba(2, 6, 20, 0.56)';
          } else if (solarAltDeg <= 0) {
            const t = (-solarAltDeg) / 6;
            ctx.fillStyle = `rgba(12, 18, 48, ${(0.22 + t * 0.34).toFixed(2)})`;
          } else {
            ctx.fillStyle = 'rgba(251, 191, 36, 0.08)';
          }
          ctx.fillRect(px1, py1, px2 - px1 + 0.6, py2 - py1 + 0.6);
        }
      }
    }

    // 3. 15° Meridian Timezone Grid & Parallels
    ctx.lineWidth = 0.7;
    for (let lon = -180; lon <= 180; lon += 15) {
      const [px] = project(lon, 0);
      if (px < -10 || px > width + 10) continue;
      ctx.strokeStyle =
        lon === 0 ? 'rgba(248, 113, 113, 0.45)' : 'rgba(56, 189, 248, 0.16)';
      ctx.beginPath();
      ctx.moveTo(px, Math.max(0, mapTop));
      ctx.lineTo(px, Math.min(height, mapBottom));
      ctx.stroke();
    }
    for (let lat = -75; lat <= 75; lat += 15) {
      const [, py] = project(0, lat);
      if (py < -10 || py > height + 10) continue;
      ctx.strokeStyle =
        lat === 0 ? 'rgba(250, 204, 21, 0.45)' : 'rgba(56, 189, 248, 0.14)';
      ctx.beginPath();
      ctx.moveTo(Math.max(0, mapLeft), py);
      ctx.lineTo(Math.min(width, mapRight), py);
      ctx.stroke();
    }

    // World map outer border
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mapLeft, mapTop, mapW, mapH);

    // 5. Subsolar Sun Marker (90° Zenith)
    const [sunX, sunY] = project(solarResults.subsolarLongitude, solarResults.subsolarLatitude);
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 22);
    sunGrad.addColorStop(0, 'rgba(253, 224, 71, 0.95)');
    sunGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.4)');
    sunGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 5, 0, Math.PI * 2);
    ctx.fill();

    // 6. All World Cities Markers
    ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    WORLD_CITY_PRESETS.forEach((city) => {
      const [cx, cy] = project(city.lng, city.lat);
      if (cx < -30 || cx > width + 30 || cy < -20 || cy > height + 20) return;

      const isSelected =
        Math.abs(city.lat - selectedTarget.lat) < 0.25 &&
        Math.abs(city.lng - selectedTarget.lng) < 0.25;

      ctx.fillStyle = isSelected ? '#fbbf24' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(cx, cy, isSelected ? 5.5 : zoom > 1.8 ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();

      if (zoom >= 1.55 || isSelected || city.name === 'São Paulo' || city.name === 'Nova York' || city.name === 'Londres' || city.name === 'Tóquio' || city.name === 'Sydney' || city.name === 'Dubai') {
        ctx.fillStyle = isSelected ? '#fef3c7' : 'rgba(226, 232, 240, 0.9)';
        ctx.fillText(city.name, cx + 6, cy + 3);
      }
    });

    // 7. Great-Circle Flight Arc (Current Plane -> Target)
    const arcOriginLat = planeFlightPlan?.active ? planeFlightPlan.originLat : currentLat;
    const arcOriginLng = planeFlightPlan?.active ? planeFlightPlan.originLng : currentLng;
    const arcDestLat = planeFlightPlan?.active ? planeFlightPlan.destLat : selectedTarget.lat;
    const arcDestLng = planeFlightPlan?.active ? planeFlightPlan.destLng : selectedTarget.lng;

    if (haversineDistanceKm(arcOriginLat, arcOriginLng, arcDestLat, arcDestLng) > 15) {
      const arcPts = sampleGreatCirclePoints(arcOriginLat, arcOriginLng, arcDestLat, arcDestLng, 56);
      ctx.save();
      ctx.strokeStyle = planeFlightPlan?.active ? '#fbbf24' : 'rgba(129, 140, 248, 0.85)';
      ctx.lineWidth = planeFlightPlan?.active ? 2.4 : 1.8;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      for (let i = 0; i < arcPts.length; i++) {
        const [lon, lat] = arcPts[i];
        const [px, py] = project(lon, lat);
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          const prevLon = arcPts[i - 1][0];
          // Break arc cleanly if crossing ±180° antimeridian
          if (Math.abs(lon - prevLon) > 180) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // 8. Selected Destination Target Pin
    const [tx, ty] = project(selectedTarget.lng, selectedTarget.lat);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tx, ty, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(tx, ty, 4, 0, Math.PI * 2);
    ctx.fill();

    // 9. Live Airplane Position Marker
    const [ax, ay] = project(currentLng, currentLat);
    const headingDeg = planeFlightPlan?.active ? planeFlightPlan.bearingDeg : bearingToTargetDeg;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate((headingDeg * Math.PI) / 180);
    // Airplane silhouette pointing UP (North = 0°)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(2.5, -3);
    ctx.lineTo(10, 2);
    ctx.lineTo(10, 4.5);
    ctx.lineTo(2.5, 2);
    ctx.lineTo(2, 7.5);
    ctx.lineTo(5, 9.5);
    ctx.lineTo(5, 11);
    ctx.lineTo(0, 9.5);
    ctx.lineTo(-5, 11);
    ctx.lineTo(-5, 9.5);
    ctx.lineTo(-2, 7.5);
    ctx.lineTo(-2.5, 2);
    ctx.lineTo(-10, 4.5);
    ctx.lineTo(-10, 2);
    ctx.lineTo(-2.5, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }, [
    isOpen,
    mapEngine,
    zoom,
    centerLon,
    centerLat,
    solarResults.subsolarLatitude,
    solarResults.subsolarLongitude,
    currentLat,
    currentLng,
    selectedTarget,
    planeFlightPlan,
    bearingToTargetDeg,
  ]);

  if (!isOpen) return null;

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragStateRef.current = {
      dragging: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      startLon: centerLon,
      startLat: centerLat,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const st = dragStateRef.current;
    if (!st.dragging || !containerRef.current) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (Math.hypot(dx, dy) > 4) st.moved = true;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 420;
    const baseScale = Math.min(width / 360, height / 180) * zoom;
    const nextLon = Math.max(-180, Math.min(180, st.startLon - dx / baseScale));
    const nextLat = Math.max(-85, Math.min(85, st.startLat + dy / baseScale));
    setCenterLon(nextLon);
    setCenterLat(nextLat);
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const st = dragStateRef.current;
    const wasClick = st.dragging && !st.moved;
    dragStateRef.current.dragging = false;

    if (!wasClick || !containerRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;
    const baseScale = Math.min(width / 360, height / 180) * zoom;

    const clickLon = Math.max(-180, Math.min(180, centerLon + (px - width / 2) / baseScale));
    const clickLat = Math.max(-85, Math.min(85, centerLat - (py - height / 2) / baseScale));

    // Check if clicked near any preset city
    let bestCity: RealCitySearchResult | null = null;
    let bestPxDist = Infinity;
    for (const c of WORLD_CITY_PRESETS) {
      const cpx = width / 2 + (c.lng - centerLon) * baseScale;
      const cpy = height / 2 - (c.lat - centerLat) * baseScale;
      const d = Math.hypot(cpx - px, cpy - py);
      if (d < 16 && d < bestPxDist) {
        bestPxDist = d;
        bestCity = c;
      }
    }

    if (bestCity) {
      setSelectedTarget({
        name: bestCity.name,
        country: bestCity.country,
        lat: bestCity.lat,
        lng: bestCity.lng,
      });
    } else {
      setSelectedTarget({
        name: `Ponto (${clickLat.toFixed(2)}°, ${clickLon.toFixed(2)}°)`,
        country: 'Planeta Terra',
        lat: Number(clickLat.toFixed(4)),
        lng: Number(clickLon.toFixed(4)),
      });
    }
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.18 : 0.85;
    setZoom((z) => Math.max(0.85, Math.min(10, Number((z * factor).toFixed(2)))));
  };

  const handleGoogleMapClick = (e: MapMouseEvent) => {
    if (!e.detail?.latLng) return;
    const lat = Number(e.detail.latLng.lat.toFixed(4));
    const lng = Number(e.detail.latLng.lng.toFixed(4));
    const nearby = WORLD_CITY_PRESETS.find(
      (c) => Math.abs(c.lat - lat) < 0.7 && Math.abs(c.lng - lng) < 0.7
    );
    if (nearby) {
      setSelectedTarget({
        name: nearby.name,
        country: nearby.country,
        lat: nearby.lat,
        lng: nearby.lng,
      });
    } else {
      setSelectedTarget({
        name: `Local (${lat.toFixed(2)}°, ${lng.toFixed(2)}°)`,
        country: 'Mundo',
        lat,
        lng,
      });
    }
  };

  const triggerFlyToTarget = (target: SelectedMapTarget) => {
    onStartGlobalPlaneFlight?.(target.lat, target.lng, target.name, target.country);
    onClose();
  };

  const triggerOpenCity3D = (target: SelectedMapTarget) => {
    onLoadRealCity?.(target.lat, target.lng, target.name, target.country, true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/92 flex items-center justify-center p-2 sm:p-4 pointer-events-auto">
      <div className="w-full max-w-6xl h-[92vh] bg-slate-900 border border-sky-500/45 rounded-2xl shadow-2xl flex flex-col overflow-hidden font-sans text-slate-100">
        {/* Top Header */}
        <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-500/15 border border-sky-400/40 text-sky-300">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Mapa Global da Cidade Real · O Mundo Todo Aqui
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  ✈️ Posição: {currentCityLabel} ({currentLat.toFixed(2)}°, {currentLng.toFixed(2)}°)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-200 border border-cyan-400/45">
                  🕒 Horário do Voo: {formatUtcHMS(solarParams.referenceDate)} UTC+0 (Z)
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Clique em qualquer lugar do planeta, busque qualquer cidade/bairro ou escolha pelos continentes para voar de avião ou abrir em 3D.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Engine Switcher: Solar World Atlas (always works) vs Google Maps Satellite/Street (when key configured) */}
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setMapEngine('solar_atlas')}
                className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer transition-colors ${
                  mapEngine === 'solar_atlas'
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                🌍 Mapa Solar Mundial
              </button>
              {mapsApiKey && (
                <button
                  type="button"
                  onClick={() => setMapEngine('google_maps')}
                  className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer transition-colors ${
                    mapEngine === 'google_maps'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  🛰️ Google Maps Real
                </button>
              )}
            </div>

            {mapEngine === 'google_maps' && mapsApiKey && (
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                {(['hybrid', 'satellite', 'roadmap', 'terrain'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setGoogleMapType(m)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize cursor-pointer ${
                      googleMapType === m ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-4 h-4" /> Voltar para Cidade 3D
            </button>
          </div>
        </div>

        {/* Main Workspace: Interactive Global Map + World Catalog Sidebar */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* Left / Main Map Canvas */}
          <div className="flex-1 relative min-h-[260px] bg-slate-950" ref={containerRef}>
            {mapEngine === 'solar_atlas' ? (
              <>
                <canvas
                  ref={canvasRef}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onWheel={handleCanvasWheel}
                  className="w-full h-full block cursor-crosshair touch-none"
                />

                {/* Top-Left Map Legend */}
                <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-slate-700/80 text-[10px] font-mono text-slate-200 pointer-events-none">
                  <span className="flex items-center gap-1">
                    <Plane className="w-3 h-3 text-white" /> Avião Atual
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="flex items-center gap-1 text-amber-300">
                    <MapPin className="w-3 h-3" /> Destino
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="flex items-center gap-1 text-yellow-300">
                    <Sun className="w-3 h-3" /> Zênite Solar
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-sky-300">Dia/Noite ao Vivo</span>
                </div>

                {/* Top-Right Zoom & Reset Controls */}
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-950/90 p-1 rounded-lg border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(10, Number((z * 1.35).toFixed(2))))}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-200 cursor-pointer"
                    title="Aproximar Zoom"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(0.85, Number((z / 1.35).toFixed(2))))}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-200 cursor-pointer"
                    title="Afastar Zoom"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1.05);
                      setCenterLon(0);
                      setCenterLat(12);
                    }}
                    className="px-2 py-1 rounded hover:bg-slate-800 text-sky-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    title="Ver Planeta Inteiro"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Planeta
                  </button>
                </div>
              </>
            ) : mapsApiKey ? (
              <APIProvider apiKey={mapsApiKey}>
                <div className="w-full h-full">
                  <GoogleMapComponent
                    style={{ width: '100%', height: '100%' }}
                    center={{ lat: selectedTarget.lat, lng: selectedTarget.lng }}
                    defaultZoom={3}
                    mapTypeId={googleMapType}
                    mapId="DEMO_MAP_ID"
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    onClick={handleGoogleMapClick}
                    gestureHandling="greedy"
                  >
                    {/* Live Airplane Location Pin */}
                    <AdvancedMarker position={{ lat: currentLat, lng: currentLng }} title="Avião / Posição Atual">
                      <Pin background="#0ea5e9" glyphColor="#0f172a" borderColor="#0284c7" scale={1.15} />
                    </AdvancedMarker>
                    {/* Selected Destination Pin */}
                    <AdvancedMarker
                      position={{ lat: selectedTarget.lat, lng: selectedTarget.lng }}
                      title={`Destino: ${selectedTarget.name}`}
                    >
                      <Pin background="#f59e0b" glyphColor="#0f172a" borderColor="#d97706" scale={1.25} />
                    </AdvancedMarker>
                    {/* Subsolar Point */}
                    <AdvancedMarker
                      position={{ lat: solarResults.subsolarLatitude, lng: solarResults.subsolarLongitude }}
                      title="Ponto Subsolar (Sol no Zênite 90°)"
                    >
                      <div className="p-1.5 rounded-full bg-amber-400 border-2 border-white shadow-lg">
                        <Sun className="w-4 h-4 text-slate-950" />
                      </div>
                    </AdvancedMarker>
                  </GoogleMapComponent>
                </div>
              </APIProvider>
            ) : null}
          </div>

          {/* Right Sidebar: World Search + All Continents Destinations */}
          <div className="w-full lg:w-88 bg-slate-950 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col max-h-[34vh] lg:max-h-none shrink-0">
            <div className="p-3 border-b border-slate-800 space-y-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!e.target.value.trim()) setSearchResults([]);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Buscar cidade, país ou lat, lon..."
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={searching}
                  className="px-2.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Continents Filter Chips */}
              <div className="flex flex-wrap gap-1">
                {REGIONS.map((reg) => (
                  <button
                    key={reg}
                    type="button"
                    onClick={() => {
                      setSearchResults([]);
                      setRegionFilter(reg);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                      regionFilter === reg && searchResults.length === 0
                        ? 'bg-sky-500 text-slate-950 border-sky-300'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {reg}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable City List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {catalogCities.map((c, idx) => {
                const distKm = Math.round(haversineDistanceKm(currentLat, currentLng, c.lat, c.lng));
                const isSelected =
                  Math.abs(c.lat - selectedTarget.lat) < 0.05 &&
                  Math.abs(c.lng - selectedTarget.lng) < 0.05;
                return (
                  <div
                    key={`${c.name}_${c.lat}_${idx}`}
                    onClick={() => {
                      setSelectedTarget({
                        name: c.name,
                        country: c.country || 'Mundo',
                        lat: c.lat,
                        lng: c.lng,
                      });
                      setCenterLon(c.lng);
                      setCenterLat(c.lat);
                    }}
                    className={`p-2 rounded-lg border cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-sky-500/15 border-sky-400 text-white'
                        : 'bg-slate-900/70 border-slate-800 hover:bg-slate-800/80 text-slate-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{c.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {c.country || 'Mundo'} · {distKm.toLocaleString('pt-BR')} km
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerFlyToTarget({
                            name: c.name,
                            country: c.country || 'Mundo',
                            lat: c.lat,
                            lng: c.lng,
                          });
                        }}
                        className="px-2 py-1 rounded bg-indigo-500 hover:bg-indigo-400 text-white text-[10px] font-bold cursor-pointer"
                        title={`Voar de avião até ${c.name}`}
                      >
                        ✈️ Voar
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerOpenCity3D({
                            name: c.name,
                            country: c.country || 'Mundo',
                            lat: c.lat,
                            lng: c.lng,
                          });
                        }}
                        className="px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/40 border border-sky-400/40 text-sky-200 text-[10px] font-bold cursor-pointer"
                        title={`Abrir ${c.name} em 3D instantaneamente`}
                      >
                        🏙️ 3D
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Action Footer: Selected Coordinates + Flight Controls + 1-Click Actions */}
        <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <div className="text-[10px] text-slate-400">Local Selecionado no Mapa:</div>
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                {selectedTarget.name}
                <span className="text-slate-400 font-normal">
                  ({selectedTarget.lat.toFixed(2)}°, {selectedTarget.lng.toFixed(2)}°)
                </span>
              </div>
            </div>

            <div className="h-7 w-px bg-slate-800 hidden sm:block" />

            <div className="flex items-center gap-3 text-[11px] text-slate-300">
              <span>
                Distância:{' '}
                <strong className="text-sky-300">{distanceToTargetKm.toLocaleString('pt-BR')} km</strong>
              </span>
              <span>
                Rumo: <strong className="text-emerald-300">{bearingToTargetDeg}°</strong>
              </span>
              <span className="text-cyan-200">
                Voo UTC+0:{' '}
                <strong className="text-white">
                  {formatUtcHMS(solarParams.referenceDate)}
                </strong>{' '}
                →{' '}
                <strong className="text-emerald-300">
                  {formatUtcHMS(
                    solarParams.referenceDate.getTime() +
                      planeFlightDurationSec * Math.max(1, solarParams.gameTimeSpeed) * 1000
                  )} UTC+0
                </strong>
              </span>
            </div>

            {/* Compact Flight Time & Max Ceiling quick selectors */}
            <div className="flex flex-wrap items-center gap-1.5 pl-2 border-l border-slate-800">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] text-slate-400">Tempo:</span>
              {[
                { s: 1, label: '1s' },
                { s: 4, label: '4s' },
                { s: 60, label: '1m' },
                { s: 3600, label: '1h' },
                { s: 86400, label: '24h' },
              ].map((tp) => (
                <button
                  key={`gm_tp_${tp.s}`}
                  type="button"
                  onClick={() => onChangePlaneFlightDurationSec?.(tp.s)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                    planeFlightDurationSec === tp.s
                      ? 'bg-amber-500 text-slate-950 border-amber-300'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {tp.label}
                </button>
              ))}
              <span className="text-[10px] text-emerald-300 font-bold ml-1">
                ({formatDurationShort(planeFlightDurationSec)})
              </span>
              <span className="text-slate-700 mx-1">|</span>
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <select
                value={planeMaxAltitudeM}
                onChange={(e) => {
                  const val = Math.max(
                    PLANE_MIN_CEILING_M,
                    Math.min(PLANE_MAX_CEILING_M, Number(e.target.value))
                  );
                  onChangePlaneMaxAltitudeM?.(val);
                }}
                className="bg-slate-900 border border-indigo-500/40 rounded px-1.5 py-0.5 text-[10px] font-bold text-indigo-200 cursor-pointer"
                aria-label="Teto de altitude do voo"
              >
                <option value={220}>Teto: 220m</option>
                <option value={500}>Teto: 500m</option>
                <option value={1000}>Teto: 1 km</option>
                <option value={3000}>Teto: 3 km</option>
                <option value={6000}>Teto: 6 km</option>
                <option value={11000}>Teto: 11 km (Máx)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onSyncCoordinatesOnly?.(selectedTarget.lat, selectedTarget.lng);
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
              title="Mudar apenas para o local tocado no mapa mantendo exatamente o mesmo horário UTC"
            >
              <Navigation className="w-3.5 h-3.5 text-emerald-400" /> Mudar Local (Mesmo UTC)
            </button>

            <button
              type="button"
              onClick={() => triggerOpenCity3D(selectedTarget)}
              className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow"
            >
              <Building2 className="w-4 h-4" /> Abrir Cidade Real 3D Aqui
            </button>

            <button
              type="button"
              onClick={() => triggerFlyToTarget(selectedTarget)}
              className="px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg"
            >
              <Plane className="w-4 h-4" /> Voar Até Aqui ({formatDurationShort(planeFlightDurationSec)})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
