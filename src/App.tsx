import React, { useState, useEffect, useRef } from 'react';
import {
  SolarInputParameters,
  SolarCalculationResult,
  LandscapeSceneType,
  SolarClockVersion,
  WorldVisualStyle,
  RealCityData,
  RealCityVehicleMode,
  RealCityTelemetry,
  DroneCameraTelemetry,
  PLANE_MIN_CEILING_M,
  PLANE_MAX_CEILING_M,
  PLANE_DEFAULT_CEILING_M,
  PLANE_MIN_FLIGHT_DURATION_SEC,
  PLANE_MAX_FLIGHT_DURATION_SEC,
  PLANE_DEFAULT_FLIGHT_DURATION_SEC,
  PlaneTravelSpeedMode,
  PlaneFlightPlan,
  TimezoneSystemMode,
  SolarUpdateOptions,
} from './types/solar';
import { calculateSolarPosition } from './engine/solarEngine';
import { SolarWorld3D, CameraPreset, PersonMoveInput } from './components/SolarWorld3D';
import { TrafficSignalState } from './components/CitySceneBuilder';
import { SolarDashboard } from './components/SolarDashboard';

import { getGoogleMapsApiKey } from './services/googleMapsService';
import { classifyNoaaTimezone, resolveNoaaTimezoneForLocation } from './services/timezoneService';
import {
  fetchRealCityData,
  generateAdaptedCityData,
  haversineDistanceKm,
  computeBearingDeg,
} from './services/realCityService';
import { getHistoricalTimezoneOffset } from './engine/solarEngine';
import { getNatoZoneDetails, getIanaForSystemMode } from './data/timezoneSystems';

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);
  const [mapsApiKey, setMapsApiKey] = useState<string>('');

  const [solarParams, setSolarParams] = useState<SolarInputParameters>({
    referenceDate: new Date('2027-01-01T00:00:00.000Z'),
    latitude: 51.5033,
    longitude: -0.1197,
    civilTimezoneOffset: 0,
    timeZoneId: 'Europe/London',
    timezoneSystemMode: 'noaa_official',
    autoHistoricalTimezone: true,
    axialTilt: 23.44,
    gameTimeSpeed: 1,
  });

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'landscape' | 'globe'>('landscape');
  const [sceneTheme, setSceneTheme] = useState<LandscapeSceneType>('default');
  const [solarClockVersion, setSolarClockVersion] = useState<SolarClockVersion>('floor_horizontal');
  const [solarWallAzimuthDeg, setSolarWallAzimuthDeg] = useState<number | null>(null);
  const [solarFloorAzimuthDeg, setSolarFloorAzimuthDeg] = useState<number>(0);
  const [visualStyle, setVisualStyle] = useState<WorldVisualStyle>('real_life');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('free360');
  const [showVectors, setShowVectors] = useState<boolean>(true);
  const [trafficSignal, setTrafficSignal] = useState<TrafficSignalState>({ ew: 'green', ns: 'red' });
  const personMoveRef = useRef<PersonMoveInput>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    ascend: false,
    descend: false,
  });

  // Cidade Real state (OSM adapted city + Climb/Drone/Plane/Car controls)
  const [realCityData, setRealCityData] = useState<RealCityData | null>(null);
  const [realCityLoading, setRealCityLoading] = useState<boolean>(false);
  const [realCityVehicleMode, setRealCityVehicleMode] = useState<RealCityVehicleMode>('walk');
  const [planeMaxAltitudeM, setPlaneMaxAltitudeM] = useState<number>(PLANE_DEFAULT_CEILING_M);
  const [planeTravelSpeedMode, setPlaneTravelSpeedMode] = useState<PlaneTravelSpeedMode>('city');
  const [planeFlightDurationSec, setPlaneFlightDurationSec] = useState<number>(PLANE_DEFAULT_FLIGHT_DURATION_SEC);
  const [planeFlightPlan, setPlaneFlightPlan] = useState<PlaneFlightPlan | null>(null);
  const prefetchedCityPromiseRef = useRef<Promise<RealCityData> | null>(null);
  const prefetchedCityKeyRef = useRef<string>('');
  const flightIdSeqRef = useRef<number>(1);
  const realCityVehicleModeRef = useRef<RealCityVehicleMode>('walk');
  realCityVehicleModeRef.current = realCityVehicleMode;
  const preFlightTimezoneModeRef = useRef<TimezoneSystemMode | null>(null);
  const solarParamsRef = useRef<SolarInputParameters>(solarParams);
  solarParamsRef.current = solarParams;
  const [realCityTelemetry, setRealCityTelemetry] = useState<RealCityTelemetry>({
    vehicleMode: 'walk',
    altitudeM: 0,
    speedKmh: 0,
    onBuildingName: null,
    nearestBuildingName: null,
    nearestBuildingHeight: null,
    nearestBuildingDist: null,
  });
  const [droneTelemetry, setDroneTelemetry] = useState<DroneCameraTelemetry>({
    altitudeM: 14,
    speedKmh: 0,
    headingDeg: 0,
    pitchDeg: -18,
  });
  const realCityActionRef = useRef<{ action: 'climb_nearest' | 'descend' | null }>({ action: null });

  // Load Google Maps Platform API key
  useEffect(() => {
    getGoogleMapsApiKey().then((key) => {
      if (key) setMapsApiKey(key);
    });

    const handleQuotaExceeded = () => {
      setQuotaExceeded(true);
    };

    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  // Calculated results
  const [solarResults, setSolarResults] = useState<SolarCalculationResult>(() =>
    calculateSolarPosition(solarParams)
  );

  const lastTimeRef = useRef<number>(performance.now());
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setSolarResults(calculateSolarPosition(solarParams));
  }, [solarParams]);

  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const deltaSec = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      setSolarParams((prev) => {
        const msToAdd = deltaSec * prev.gameTimeSpeed * 1000;
        const newDate = new Date(prev.referenceDate.getTime() + msToAdd);
        return { ...prev, referenceDate: newDate };
      });

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying]);

  // Handle parameter updates and manage all 14 Timezone System selections
  const handleUpdateParams = (
    newParams: Partial<SolarInputParameters>,
    options?: SolarUpdateOptions
  ) => {
    let shouldAsyncRefineNoaa: { lat: number; lon: number; date: Date } | null = null;

    const isSyntheticZoneId = (tz?: string) =>
      !tz ||
      tz === 'UTC' ||
      tz === 'TAI' ||
      tz === 'TT/TDT' ||
      tz === 'Solar/LST' ||
      tz === 'Solar/LMT' ||
      tz === 'Custom' ||
      tz === 'BMT/Swatch' ||
      tz === 'Astronomical/LMST' ||
      tz === 'Historical/Decimal10h' ||
      tz.startsWith('Etc/GMT') ||
      tz.startsWith('NATO/') ||
      tz.startsWith('Standard/') ||
      tz.startsWith('PermDST/');

    setSolarParams((prev) => {
      // Quando mudar de local apenas tocando no mapa, mantém exatamente o mesmo UTC e fuso ativo
      if (
        options?.preserveTimezone &&
        !newParams.timezoneSystemMode &&
        newParams.civilTimezoneOffset === undefined &&
        !newParams.timeZoneId
      ) {
        return {
          ...prev,
          ...newParams,
        };
      }

      const activeSystem = newParams.timezoneSystemMode || prev.timezoneSystemMode || 'noaa_official';
      const coordChanged =
        (newParams.latitude !== undefined && Math.abs(newParams.latitude - prev.latitude) > 0.0001) ||
        (newParams.longitude !== undefined && Math.abs(newParams.longitude - prev.longitude) > 0.0001);

      const nextLat = newParams.latitude !== undefined ? newParams.latitude : prev.latitude;
      const nextLon = newParams.longitude !== undefined ? newParams.longitude : prev.longitude;
      const nextDate = newParams.referenceDate || prev.referenceDate;

      // 1. NOAA Nautical Meridians (15° bands)
      if (activeSystem === 'noaa_nautical') {
        const nautOffset = Math.max(-12, Math.min(14, Math.round(nextLon / 15)));
        return {
          ...prev,
          ...newParams,
          timezoneSystemMode: 'noaa_nautical',
          civilTimezoneOffset: nautOffset,
          timeZoneId: nautOffset === 0 ? 'Etc/GMT' : (nautOffset > 0 ? `Etc/GMT-${nautOffset}` : `Etc/GMT+${Math.abs(nautOffset)}`),
          autoHistoricalTimezone: false,
        };
      }

      // 2. Military / Aviation NATO (A-M, N-Y, Z)
      if (activeSystem === 'military_nato') {
        const milOffset = Math.max(-12, Math.min(12, Math.round(nextLon / 15)));
        const nato = getNatoZoneDetails(milOffset);
        return {
          ...prev,
          ...newParams,
          timezoneSystemMode: 'military_nato',
          civilTimezoneOffset: milOffset,
          timeZoneId: `NATO/${nato.phonetic}`,
          autoHistoricalTimezone: false,
        };
      }

      // 3. UTC+0 / GMT Standard
      if (activeSystem === 'utc_standard') {
        return {
          ...prev,
          ...newParams,
          timezoneSystemMode: 'utc_standard',
          civilTimezoneOffset: 0,
          timeZoneId: 'UTC',
          autoHistoricalTimezone: false,
        };
      }

      // 4. International Atomic Time (TAI = UTC + 37s)
      if (activeSystem === 'tai_atomic') {
        return {
          ...prev,
          ...newParams,
          timezoneSystemMode: 'tai_atomic',
          civilTimezoneOffset: 37 / 3600,
          timeZoneId: 'TAI',
          autoHistoricalTimezone: false,
        };
      }

      // 5. Terrestrial Time / NASA Ephemeris (TT = UTC + 69.184s)
      if (activeSystem === 'terrestrial_time_tt') {
        return {
          ...prev,
          ...newParams,
          timezoneSystemMode: 'terrestrial_time_tt',
          civilTimezoneOffset: 69.184 / 3600,
          timeZoneId: 'TT/TDT',
          autoHistoricalTimezone: false,
        };
      }

      // 6. Swatch Internet Time (.beats @ BMT UTC+1)
      if (activeSystem === 'swatch_beats') {
        return {
          ...prev,
          ...newParams,
          timezoneSystemMode: 'swatch_beats',
          civilTimezoneOffset: 1,
          timeZoneId: 'BMT/Swatch',
          autoHistoricalTimezone: false,
        };
      }

      // 7. True Local Solar Time (LST)
      if (activeSystem === 'solar_lst') {
        const approxSolarOffset = Number((nextLon / 15).toFixed(2));
        return {
          ...prev,
          ...newParams,
          timezoneSystemMode: 'solar_lst',
          civilTimezoneOffset: approxSolarOffset,
          timeZoneId: 'Solar/LST',
          autoHistoricalTimezone: false,
        };
      }

      // 8. Local Mean Time (LMT Pré-1883)
      if (activeSystem === 'lmt_mean') {
        const lmtOffset = Number((nextLon / 15).toFixed(2));
        return {
          ...prev,
          ...newParams,
          timezoneSystemMode: 'lmt_mean',
          civilTimezoneOffset: lmtOffset,
          timeZoneId: 'Solar/LMT',
          autoHistoricalTimezone: false,
        };
      }

      // 9. French Revolutionary Decimal Time (10h/day)
      if (activeSystem === 'french_decimal') {
        const lmtOffset = Number((nextLon / 15).toFixed(2));
        return {
          ...prev,
          ...newParams,
          timezoneSystemMode: 'french_decimal',
          civilTimezoneOffset: lmtOffset,
          timeZoneId: 'Historical/Decimal10h',
          autoHistoricalTimezone: false,
        };
      }

      // 10. Local Mean Sidereal Time (LMST - Stars Clock)
      if (activeSystem === 'sidereal_time') {
        const approxOffset = Number((nextLon / 15).toFixed(2));
        return {
          ...prev,
          ...newParams,
          timezoneSystemMode: 'sidereal_time',
          civilTimezoneOffset: approxOffset,
          timeZoneId: 'Astronomical/LMST',
          autoHistoricalTimezone: false,
        };
      }

      // 11. Manual / Custom Offset
      if (activeSystem === 'manual_custom') {
        return {
          ...prev,
          ...newParams,
          timezoneSystemMode: 'manual_custom',
          timeZoneId: newParams.timeZoneId || (prev.timezoneSystemMode === 'manual_custom' ? prev.timeZoneId : 'Custom'),
          autoHistoricalTimezone: false,
        };
      }

      // 11b. Regional / Distinct DST Calendar Systems (Cuba, EUA, Cancún, Marrocos Ramadã, Egito, Israel, Chile, Lord Howe)
      const regionalIana = getIanaForSystemMode(activeSystem);
      if (regionalIana) {
        const resolved = getHistoricalTimezoneOffset(regionalIana, nextDate);
        return {
          ...prev,
          ...newParams,
          timezoneSystemMode: activeSystem,
          timeZoneId: regionalIana,
          civilTimezoneOffset: resolved.offsetHours,
          autoHistoricalTimezone: true,
        };
      }

      // 12 & 13. Railway Standard (Fixed No-DST) & Permanent DST (+1h Continuous)
      if (activeSystem === 'railway_standard' || activeSystem === 'permanent_dst') {
        let targetTzId = newParams.timeZoneId || prev.timeZoneId;
        if (!newParams.timeZoneId && (coordChanged || isSyntheticZoneId(prev.timeZoneId))) {
          const noaaClass = classifyNoaaTimezone(nextLat, nextLon);
          targetTzId = noaaClass.timeZoneId;
          shouldAsyncRefineNoaa = { lat: nextLat, lon: nextLon, date: nextDate };
        }
        const year = nextDate.getUTCFullYear();
        let stdOffset = Math.max(-12, Math.min(14, Math.round(nextLon / 15)));
        if (targetTzId && !isSyntheticZoneId(targetTzId)) {
          const jan = getHistoricalTimezoneOffset(targetTzId, new Date(Date.UTC(year, 0, 1, 12, 0, 0)));
          const jul = getHistoricalTimezoneOffset(targetTzId, new Date(Date.UTC(year, 6, 1, 12, 0, 0)));
          stdOffset = Math.min(jan.offsetHours, jul.offsetHours);
        }
        const computedOffset = activeSystem === 'permanent_dst' ? Math.min(14, stdOffset + 1) : stdOffset;

        return {
          ...prev,
          ...newParams,
          timezoneSystemMode: activeSystem,
          timeZoneId: targetTzId || `Standard/UTC${computedOffset >= 0 ? '+' : ''}${computedOffset}`,
          civilTimezoneOffset: computedOffset,
          autoHistoricalTimezone: false,
        };
      }

      // 14. 'noaa_official' (Default): resolve official political/administrative NOAA IANA timezone
      const switchingIntoNoaaWithoutExplicitZone =
        !newParams.timeZoneId &&
        (coordChanged || prev.timezoneSystemMode !== 'noaa_official' || isSyntheticZoneId(prev.timeZoneId));

      if (switchingIntoNoaaWithoutExplicitZone) {
        const noaaClass = classifyNoaaTimezone(nextLat, nextLon);
        const resolved = getHistoricalTimezoneOffset(noaaClass.timeZoneId, nextDate);
        shouldAsyncRefineNoaa = { lat: nextLat, lon: nextLon, date: nextDate };

        return {
          ...prev,
          ...newParams,
          timezoneSystemMode: 'noaa_official',
          timeZoneId: noaaClass.timeZoneId,
          civilTimezoneOffset: resolved.offsetHours,
          autoHistoricalTimezone: true,
        };
      }

      if (newParams.timeZoneId && newParams.civilTimezoneOffset === undefined) {
        const resolved = getHistoricalTimezoneOffset(newParams.timeZoneId, nextDate);
        return {
          ...prev,
          ...newParams,
          civilTimezoneOffset: resolved.offsetHours,
          timezoneSystemMode: activeSystem,
          autoHistoricalTimezone: true,
        };
      }

      return {
        ...prev,
        ...newParams,
        timezoneSystemMode: activeSystem,
        autoHistoricalTimezone: newParams.autoHistoricalTimezone !== undefined ? newParams.autoHistoricalTimezone : true,
      };
    });

    if (shouldAsyncRefineNoaa) {
      const target = shouldAsyncRefineNoaa as { lat: number; lon: number; date: Date };
      resolveNoaaTimezoneForLocation(target.lat, target.lon, target.date).then((refined) => {
        setSolarParams((curr) => {
          const mode = curr.timezoneSystemMode || 'noaa_official';
          if (
            (mode === 'noaa_official' || mode === 'railway_standard' || mode === 'permanent_dst') &&
            Math.abs(curr.latitude - target.lat) < 0.0001 &&
            Math.abs(curr.longitude - target.lon) < 0.0001
          ) {
            if (mode === 'noaa_official') {
              if (curr.timeZoneId !== refined.timeZoneId || curr.civilTimezoneOffset !== refined.offsetHours) {
                return {
                  ...curr,
                  timeZoneId: refined.timeZoneId,
                  civilTimezoneOffset: refined.offsetHours,
                  autoHistoricalTimezone: true,
                };
              }
            } else {
              const year = target.date.getUTCFullYear();
              const jan = getHistoricalTimezoneOffset(refined.timeZoneId, new Date(Date.UTC(year, 0, 1, 12, 0, 0)));
              const jul = getHistoricalTimezoneOffset(refined.timeZoneId, new Date(Date.UTC(year, 6, 1, 12, 0, 0)));
              const stdOff = Math.min(jan.offsetHours, jul.offsetHours);
              const nextOffset = mode === 'permanent_dst' ? Math.min(14, stdOff + 1) : stdOff;
              if (curr.timeZoneId !== refined.timeZoneId || curr.civilTimezoneOffset !== nextOffset) {
                return {
                  ...curr,
                  timeZoneId: refined.timeZoneId,
                  civilTimezoneOffset: nextOffset,
                  autoHistoricalTimezone: false,
                };
              }
            }
          }
          return curr;
        });
      });
    }
  };

  const handleResetTime = () => {
    setSolarParams((prev) => ({
      ...prev,
      referenceDate: new Date('2027-01-01T00:00:00.000Z'),
    }));
  };

  const handleJumpToEvent = (eventType: 'sunrise' | 'noon' | 'sunset' | 'now') => {
    setSolarParams((prev) => {
      const newDate = new Date(prev.referenceDate);
      if (eventType === 'now') {
        return { ...prev, referenceDate: new Date() };
      }

      if (eventType === 'noon') {
        const noonMins = solarResults.solarNoonUtcMinutes;
        newDate.setUTCHours(Math.floor(noonMins / 60), Math.floor(noonMins % 60), 0, 0);
      } else if (eventType === 'sunrise') {
        const noonMins = solarResults.solarNoonUtcMinutes;
        const halfDayMins = (solarResults.daylightDurationHours / 2) * 60;
        const sunriseMins = ((noonMins - halfDayMins) % 1440 + 1440) % 1440;
        newDate.setUTCHours(Math.floor(sunriseMins / 60), Math.floor(sunriseMins % 60), 0, 0);
      } else if (eventType === 'sunset') {
        const noonMins = solarResults.solarNoonUtcMinutes;
        const halfDayMins = (solarResults.daylightDurationHours / 2) * 60;
        const sunsetMins = ((noonMins + halfDayMins) % 1440 + 1440) % 1440;
        newDate.setUTCHours(Math.floor(sunsetMins / 60), Math.floor(sunsetMins % 60), 0, 0);
      }

      return { ...prev, referenceDate: newDate };
    });
  };

  const handleLoadRealCity = async (
    lat: number,
    lng: number,
    cityName?: string,
    country?: string,
    syncCoordinates = true
  ) => {
    if (syncCoordinates) {
      handleUpdateParams({ latitude: lat, longitude: lng });
    }
    setRealCityLoading(true);
    // Provide instant adapted city immediately so the 3D viewport never stalls while Overpass loads
    setRealCityData((prev) =>
      prev && Math.hypot(prev.latitude - lat, prev.longitude - lng) < 0.0005
        ? prev
        : generateAdaptedCityData(lat, lng, cityName, country)
    );
    try {
      const loaded = await fetchRealCityData(lat, lng, cityName, country);
      setRealCityData(loaded);
    } finally {
      setRealCityLoading(false);
    }
  };

  const ensureFlightUtcZeroClock = () => {
    setSolarParams((prev) => {
      if (prev.timezoneSystemMode !== 'utc_standard' && !preFlightTimezoneModeRef.current) {
        preFlightTimezoneModeRef.current = prev.timezoneSystemMode || 'noaa_official';
      }
      if (prev.timezoneSystemMode === 'utc_standard' && prev.civilTimezoneOffset === 0 && prev.timeZoneId === 'UTC') {
        return prev;
      }
      return {
        ...prev,
        timezoneSystemMode: 'utc_standard',
        civilTimezoneOffset: 0,
        timeZoneId: 'UTC',
        autoHistoricalTimezone: false,
      };
    });
  };

  const restoreGroundTimezoneIfNeeded = (lat?: number, lng?: number) => {
    const savedMode = preFlightTimezoneModeRef.current;
    preFlightTimezoneModeRef.current = null;
    if (savedMode && savedMode !== 'utc_standard') {
      handleUpdateParams({
        timezoneSystemMode: savedMode,
        ...(lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : {}),
      });
    }
  };

  const handleStartGlobalPlaneFlight = (
    destLat: number,
    destLng: number,
    destName?: string,
    destCountry?: string
  ) => {
    const originLat = realCityTelemetry.liveLat ?? realCityData?.latitude ?? solarParams.latitude;
    const originLng = realCityTelemetry.liveLng ?? realCityData?.longitude ?? solarParams.longitude;
    const originName = realCityData?.cityName || `${originLat.toFixed(1)}°, ${originLng.toFixed(1)}°`;
    const totalDistanceKm = Math.round(haversineDistanceKm(originLat, originLng, destLat, destLng));
    const bearingDeg = computeBearingDeg(originLat, originLng, destLat, destLng);
    const durationSec = Math.max(
      PLANE_MIN_FLIGHT_DURATION_SEC,
      Math.min(PLANE_MAX_FLIGHT_DURATION_SEC, Math.round(planeFlightDurationSec))
    );

    const departureUtcMs = solarParams.referenceDate.getTime();
    const simAdvanceMult = isPlaying ? Math.max(1, solarParams.gameTimeSpeed) : 1;
    const estimatedArrivalUtcMs = departureUtcMs + durationSec * simAdvanceMult * 1000;

    const labelDest = destName || `Lat ${destLat.toFixed(2)}°, Lon ${destLng.toFixed(2)}°`;
    const labelCountry = destCountry || 'Mundo';
    const prefetchKey = `${destLat.toFixed(4)},${destLng.toFixed(4)}`;
    prefetchedCityKeyRef.current = prefetchKey;
    prefetchedCityPromiseRef.current = fetchRealCityData(destLat, destLng, labelDest, labelCountry);

    setViewMode('landscape');
    setSceneTheme('city_real');
    setRealCityVehicleMode('plane');
    setCameraPreset('person');
    ensureFlightUtcZeroClock();
    setPlaneFlightPlan({
      id: flightIdSeqRef.current++,
      active: true,
      originName,
      originLat,
      originLng,
      destName: labelDest,
      destCountry: labelCountry,
      destLat,
      destLng,
      totalDistanceKm,
      bearingDeg,
      durationSec,
      departureUtcMs,
      estimatedArrivalUtcMs,
    });
  };

  const handleCancelGlobalPlaneFlight = () => {
    setPlaneFlightPlan(null);
  };

  const handleCompleteGlobalPlaneFlight = async (plan: PlaneFlightPlan) => {
    setPlaneFlightPlan(null);
    if (realCityVehicleModeRef.current === 'plane') {
      // O horário do voo continua em UTC+0 enquanto estiver pilotando o avião
      setSolarParams((prev) => ({
        ...prev,
        latitude: plan.destLat,
        longitude: plan.destLng,
        timezoneSystemMode: 'utc_standard',
        civilTimezoneOffset: 0,
        timeZoneId: 'UTC',
        autoHistoricalTimezone: false,
      }));
    } else {
      handleUpdateParams({ latitude: plan.destLat, longitude: plan.destLng });
    }
    setRealCityLoading(true);
    setRealCityData(generateAdaptedCityData(plan.destLat, plan.destLng, plan.destName, plan.destCountry));
    const expectedKey = `${plan.destLat.toFixed(4)},${plan.destLng.toFixed(4)}`;
    try {
      const loaded =
        prefetchedCityPromiseRef.current && prefetchedCityKeyRef.current === expectedKey
          ? await prefetchedCityPromiseRef.current
          : await fetchRealCityData(plan.destLat, plan.destLng, plan.destName, plan.destCountry);
      setRealCityData(loaded);
    } finally {
      setRealCityLoading(false);
    }
  };

  useEffect(() => {
    if (sceneTheme === 'city_real' && !realCityData) {
      handleLoadRealCity(solarParams.latitude, solarParams.longitude, undefined, undefined, false);
    }
  }, [sceneTheme]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none flex flex-col">
      {/* Client-Side Quota Defense Banner (Case A - Demo Key) */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm pointer-events-auto shrink-0">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* 1. 3D WebGL Canvas Container */}
        <div className="absolute inset-0 z-0">
          <SolarWorld3D
            solarParams={solarParams}
            solarResults={solarResults}
            viewMode={viewMode}
            sceneTheme={sceneTheme}
            solarClockVersion={solarClockVersion}
            solarWallAzimuthDeg={solarWallAzimuthDeg}
            solarFloorAzimuthDeg={solarFloorAzimuthDeg}
            visualStyle={visualStyle}
            cameraPreset={cameraPreset}
            showShadowRing={true}
            showVectors={showVectors}
            personMoveRef={personMoveRef}
            onTrafficSignalChange={(sig) => setTrafficSignal(sig)}
            onSelectCoordinates={(lat, lon) =>
              handleUpdateParams({ latitude: lat, longitude: lon }, { preserveTimezone: true })
            }
            realCityData={realCityData}
            realCityVehicleMode={realCityVehicleMode}
            planeMaxAltitudeM={planeMaxAltitudeM}
            planeTravelSpeedMode={planeTravelSpeedMode}
            planeFlightPlan={planeFlightPlan}
            onPlaneGeoMove={(lat, lng) => {
              setSolarParams((prev) =>
                Math.abs(prev.latitude - lat) < 0.005 && Math.abs(prev.longitude - lng) < 0.005
                  ? prev
                  : { ...prev, latitude: lat, longitude: lng }
              );
            }}
            onPlaneFlightComplete={handleCompleteGlobalPlaneFlight}
            onRealCityTelemetry={setRealCityTelemetry}
            onDroneTelemetry={setDroneTelemetry}
            realCityActionRef={realCityActionRef}
          />
        </div>

        {/* 2. Interactive DOM UI Overlay (pointer-events-none so viewport mouse/touch drags hit WebGL canvas) */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          <SolarDashboard
            solarParams={solarParams}
            solarResults={solarResults}
            onUpdateParams={handleUpdateParams}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            viewMode={viewMode}
            onChangeViewMode={(mode) => {
              setViewMode(mode);
              if (mode === 'globe' && (cameraPreset === 'person' || cameraPreset === 'drone')) {
                setCameraPreset('free360');
              }
            }}
            sceneTheme={sceneTheme}
            onChangeSceneTheme={(theme) => {
              setSceneTheme(theme);
              if (theme !== 'city_real' && preFlightTimezoneModeRef.current) {
                restoreGroundTimezoneIfNeeded(solarParamsRef.current.latitude, solarParamsRef.current.longitude);
              } else if (theme === 'city_real' && realCityVehicleModeRef.current === 'plane') {
                ensureFlightUtcZeroClock();
              }
              if (theme === 'default' && cameraPreset === 'person') {
                setCameraPreset('free360');
              }
            }}
            solarClockVersion={solarClockVersion}
            onChangeSolarClockVersion={(version) => {
              setSolarClockVersion(version);
            }}
            solarWallAzimuthDeg={solarWallAzimuthDeg}
            onChangeSolarWallAzimuthDeg={setSolarWallAzimuthDeg}
            solarFloorAzimuthDeg={solarFloorAzimuthDeg}
            onChangeSolarFloorAzimuthDeg={setSolarFloorAzimuthDeg}
            visualStyle={visualStyle}
            onChangeVisualStyle={setVisualStyle}
            cameraPreset={cameraPreset}
            onChangeCameraPreset={(preset) => {
              setCameraPreset(preset);
              if (preset !== 'person' && preset !== 'drone') {
                personMoveRef.current = {
                  forward: false,
                  backward: false,
                  left: false,
                  right: false,
                  sprint: false,
                  ascend: false,
                  descend: false,
                };
              }
            }}
            showVectors={showVectors}
            onToggleVectors={() => setShowVectors(!showVectors)}
            onResetTime={handleResetTime}
            onJumpToEvent={handleJumpToEvent}
            personMoveRef={personMoveRef}
            trafficSignal={trafficSignal}
            mapsApiKey={mapsApiKey}
            realCityData={realCityData}
            realCityLoading={realCityLoading}
            realCityVehicleMode={realCityVehicleMode}
            onChangeRealCityVehicleMode={(mode) => {
              setRealCityVehicleMode(mode);
              setViewMode('landscape');
              setSceneTheme('city_real');
              setCameraPreset('person');
              if (mode === 'plane') {
                ensureFlightUtcZeroClock();
              } else {
                const curLat = realCityTelemetry.liveLat ?? solarParamsRef.current.latitude;
                const curLng = realCityTelemetry.liveLng ?? solarParamsRef.current.longitude;
                restoreGroundTimezoneIfNeeded(curLat, curLng);
              }
            }}
            planeMaxAltitudeM={planeMaxAltitudeM}
            onChangePlaneMaxAltitudeM={(altM) => {
              const clamped = Math.max(
                PLANE_MIN_CEILING_M,
                Math.min(PLANE_MAX_CEILING_M, Math.round(altM))
              );
              setPlaneMaxAltitudeM(clamped);
            }}
            planeTravelSpeedMode={planeTravelSpeedMode}
            onChangePlaneTravelSpeedMode={setPlaneTravelSpeedMode}
            planeFlightDurationSec={planeFlightDurationSec}
            onChangePlaneFlightDurationSec={(sec) => {
              const clamped = Math.max(
                PLANE_MIN_FLIGHT_DURATION_SEC,
                Math.min(PLANE_MAX_FLIGHT_DURATION_SEC, Math.round(sec))
              );
              setPlaneFlightDurationSec(clamped);
              setPlaneFlightPlan((prev) =>
                prev && prev.active
                  ? {
                      ...prev,
                      durationSec: clamped,
                      estimatedArrivalUtcMs:
                        prev.departureUtcMs +
                        clamped * (isPlaying ? Math.max(1, solarParamsRef.current.gameTimeSpeed) : 1) * 1000,
                    }
                  : prev
              );
            }}
            planeFlightPlan={planeFlightPlan}
            onStartGlobalPlaneFlight={handleStartGlobalPlaneFlight}
            onCancelGlobalPlaneFlight={handleCancelGlobalPlaneFlight}
            realCityTelemetry={realCityTelemetry}
            droneTelemetry={droneTelemetry}
            onLoadRealCity={handleLoadRealCity}
            realCityActionRef={realCityActionRef}
          />
        </div>
      </div>
    </div>
  );
}
