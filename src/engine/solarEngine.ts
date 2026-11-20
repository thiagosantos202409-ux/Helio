/**
 * High-Precision Solar Mechanics & Astronomical Engine
 * Implements the 6 Core Solar Formulations for Games & Simulations
 * Includes NOAA / IANA Historical Timezone & DST Resolution Engine
 */

import { SolarInputParameters, SolarCalculationResult, FormulaStepDetails, Solar3DVector, HistoricalTimezoneDetails, SeasonInfo, AstronomicalSeasonName, DstTransitionInfo } from '../types/solar';
import { getNatoZoneDetails, getIanaForSystemMode, ALL_TIMEZONE_SYSTEMS } from '../data/timezoneSystems';
import { resolveRegionalTimezoneAbbrev, getTimezonePronunciation } from '../data/timezonePronunciations';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

// Regra especial de Horário de Verão Contínuo em Havana (Cuba):
// De 08/03/2026 às 02:00 (CST UTC-5 -> 2026-03-08T07:00:00Z)
// até 07/11/2027 às 02:00 (CDT UTC-4 -> 2027-11-07T06:00:00Z),
// retomando automaticamente o ciclo normal de America/Havana após 07/11/2027 02:00.
const HAVANA_2026_PRE_SWITCH_START_UTC_MS = Date.UTC(2026, 2, 8, 5, 0, 0); // 08/03/2026 00:00 CST
const HAVANA_2026_CONT_DST_START_UTC_MS = Date.UTC(2026, 2, 8, 7, 0, 0); // 08/03/2026 02:00 CST -> 03:00 CDT
const HAVANA_2027_CONT_DST_END_UTC_MS = Date.UTC(2027, 10, 7, 6, 0, 0); // 07/11/2027 02:00 CDT -> 01:00 CST

function readHavanaCustomOverride(
  timeZoneId: string,
  utcMs: number
): { offsetHours: number; isDst: boolean; timezoneAbbrev: string } | null {
  if (timeZoneId !== 'America/Havana' && timeZoneId !== 'Cuba') return null;

  if (utcMs >= HAVANA_2026_PRE_SWITCH_START_UTC_MS && utcMs < HAVANA_2026_CONT_DST_START_UTC_MS) {
    return { offsetHours: -5, isDst: false, timezoneAbbrev: 'CST' };
  }

  if (utcMs >= HAVANA_2026_CONT_DST_START_UTC_MS && utcMs < HAVANA_2027_CONT_DST_END_UTC_MS) {
    return { offsetHours: -4, isDst: true, timezoneAbbrev: 'CDT' };
  }

  return null;
}

function readRawTzOffset(
  timeZoneId: string,
  date: Date
): { offsetHours: number; timezoneAbbrev: string } {
  const havanaOverride = readHavanaCustomOverride(timeZoneId, date.getTime());
  if (havanaOverride) {
    return {
      offsetHours: havanaOverride.offsetHours,
      timezoneAbbrev: havanaOverride.timezoneAbbrev,
    };
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZoneId,
      timeZoneName: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

    const year = parseInt(getPart('year'), 10);
    const month = parseInt(getPart('month'), 10) - 1;
    const day = parseInt(getPart('day'), 10);
    let hour = parseInt(getPart('hour'), 10);
    if (hour === 24) hour = 0;
    const minute = parseInt(getPart('minute'), 10);
    const second = parseInt(getPart('second'), 10);

    const localUtcEpoch = Date.UTC(year, month, day, hour, minute, second);
    const diffMinutes = Math.round((localUtcEpoch - date.getTime()) / 60000);
    const offsetHours = diffMinutes / 60;
    const rawAbbrev = getPart('timeZoneName');
    const abbrev = resolveRegionalTimezoneAbbrev(timeZoneId, offsetHours, rawAbbrev);

    return { offsetHours, timezoneAbbrev: abbrev };
  } catch (err) {
    return { offsetHours: 0, timezoneAbbrev: 'UTC' };
  }
}

/**
 * Resolves the exact historical UTC timezone offset, DST status, and abbreviation
 * for any given IANA timezone ID and date using native Intl APIs.
 */
export function getHistoricalTimezoneOffset(
  timeZoneId: string,
  date: Date
): { offsetHours: number; isDst: boolean; timezoneAbbrev: string } {
  const havanaOverride = readHavanaCustomOverride(timeZoneId, date.getTime());
  if (havanaOverride) {
    return havanaOverride;
  }

  const current = readRawTzOffset(timeZoneId, date);
  const year = date.getUTCFullYear();
  const jan = readRawTzOffset(timeZoneId, new Date(Date.UTC(year, 0, 1, 12, 0, 0)));
  const jul = readRawTzOffset(timeZoneId, new Date(Date.UTC(year, 6, 1, 12, 0, 0)));

  const minOffset = Math.min(jan.offsetHours, jul.offsetHours);
  const maxOffset = Math.max(jan.offsetHours, jul.offsetHours);

  let isDst = false;
  if (Math.abs(maxOffset - minOffset) > 0.05) {
    // Morocco exception: normal is +1 and Ramadan pauses to 0
    if (timeZoneId === 'Africa/Casablanca') {
      isDst = current.offsetHours < maxOffset - 0.05;
    } else {
      isDst = current.offsetHours > minOffset + 0.05;
    }
  } else {
    isDst = /DST|Daylight|Summer|WAR|BRST|AMST|UYST|PYST|FKST|WGST|LHDT|IRDT|CDT|EDT|MDT|PDT|BST|WEST|CEST|EEST|IDT|CLST|EASST|AEDT|ACDT|NZDT|CHADT|AZOST/i.test(
      current.timezoneAbbrev
    );
  }

  return {
    offsetHours: current.offsetHours,
    isDst,
    timezoneAbbrev: current.timezoneAbbrev,
  };
}

const dstTransitionCache = new Map<string, DstTransitionInfo>();

/**
 * Finds the next upcoming DST / clock offset change for any IANA timezone within the next ~2 years.
 * Exact down to the minute via coarse step + binary search.
 */
export function findNextDstTransition(timeZoneId: string, fromDate: Date): DstTransitionInfo {
  if (
    !timeZoneId ||
    timeZoneId === 'UTC' ||
    timeZoneId.startsWith('Etc/') ||
    timeZoneId.startsWith('Solar/') ||
    timeZoneId.startsWith('NATO/') ||
    timeZoneId === 'Custom'
  ) {
    return { hasTransition: false };
  }

  const dayKey = `${timeZoneId}_${fromDate.toISOString().slice(0, 10)}`;
  const cached = dstTransitionCache.get(dayKey);
  if (cached) return cached;

  const baseMs = fromDate.getTime();
  const stepMs = 7 * 86400000; // 7-day coarse scan catches even ~29-day Ramadan windows
  let prevMs = baseMs;
  let prevOffset = readRawTzOffset(timeZoneId, fromDate).offsetHours;
  let foundRange: { start: number; end: number; oldOff: number; newOff: number } | null = null;

  for (let w = 1; w <= 105; w++) {
    const probeMs = baseMs + w * stepMs;
    const probeOffset = readRawTzOffset(timeZoneId, new Date(probeMs)).offsetHours;
    if (Math.abs(probeOffset - prevOffset) > 0.01) {
      foundRange = { start: prevMs, end: probeMs, oldOff: prevOffset, newOff: probeOffset };
      break;
    }
    prevMs = probeMs;
    prevOffset = probeOffset;
  }

  if (!foundRange) {
    const noRes: DstTransitionInfo = { hasTransition: false };
    dstTransitionCache.set(dayKey, noRes);
    return noRes;
  }

  // Binary search down to 1-minute precision
  let lo = foundRange.start;
  let hi = foundRange.end;
  while (hi - lo > 60000) {
    const mid = Math.floor((lo + hi) / 2);
    const midOff = readRawTzOffset(timeZoneId, new Date(mid)).offsetHours;
    if (Math.abs(midOff - foundRange.oldOff) <= 0.01) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const transitionUtcDate = new Date(hi);
  const deltaMinutes = Math.round((foundRange.newOff - foundRange.oldOff) * 60);
  const localBeforeDate = new Date(hi + foundRange.oldOff * 3600000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const transitionLocalDateFormatted = `${pad(localBeforeDate.getUTCDate())}-${pad(localBeforeDate.getUTCMonth() + 1)}-${localBeforeDate.getUTCFullYear()}`;
  const transitionLocalTimeFormatted = `${pad(localBeforeDate.getUTCHours())}:${pad(localBeforeDate.getUTCMinutes())}`;
  const signDelta = deltaMinutes >= 0 ? '+' : '';
  const directionLabel =
    deltaMinutes > 0
      ? `Avança ${signDelta}${deltaMinutes} min (UTC${foundRange.newOff >= 0 ? '+' : ''}${foundRange.newOff})`
      : `Atrasa ${deltaMinutes} min (UTC${foundRange.newOff >= 0 ? '+' : ''}${foundRange.newOff})`;

  const result: DstTransitionInfo = {
    hasTransition: true,
    transitionUtcDate,
    transitionLocalDateFormatted,
    transitionLocalTimeFormatted,
    oldOffsetHours: foundRange.oldOff,
    newOffsetHours: foundRange.newOff,
    deltaMinutes,
    directionLabel,
  };
  dstTransitionCache.set(dayKey, result);
  return result;
}

/**
 * Calculates day of year including fractional day part from UTC hour
 */
export function getDayOfYear(date: Date): number {
  const startOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const diffMs = date.getTime() - startOfYear.getTime();
  return (diffMs / 86400000) + 1;
}

/**
 * Helper to convert total minutes (from 0 to 1440) into formatted HH:MM:SS string
 */
export function formatMinutesToTimeString(totalMinutes: number): string {
  const normMin = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normMin / 60);
  const remMin = normMin % 60;
  const minutes = Math.floor(remMin);
  const seconds = Math.floor((remMin - minutes) * 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Computes apparent solar ecliptic longitude (λ_app in degrees [0, 360))
 * using NOAA / Meeus Astronomical Algorithms (Ch. 25).
 */
export function getApparentSunLongitudeDeg(utcMs: number): number {
  const jdUt = 2440587.5 + (utcMs / 86400000);
  const deltaTSeconds = 69.184;
  const jdTt = jdUt + deltaTSeconds / 86400;
  const T = (jdTt - 2451545.0) / 36525.0;

  let L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  if (L0 < 0) L0 += 360;

  let M = (357.52911 + T * (35999.05029 - 0.0001537 * T)) % 360;
  if (M < 0) M += 360;
  const Mrad = M * DEG2RAD;

  const eqOfCenter =
    Math.sin(Mrad) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * Mrad) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * Mrad) * 0.000289;

  const trueLong = L0 + eqOfCenter;
  const omega = 125.04 - 1934.136 * T;
  let appLong = (trueLong - 0.00569 - 0.00478 * Math.sin(omega * DEG2RAD)) % 360;
  if (appLong < 0) appLong += 360;
  return appLong;
}

function signedAngleDiffDeg(aDeg: number, targetDeg: number): number {
  let diff = (aDeg - targetDeg) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

/**
 * Solves the exact UTC timestamp when the apparent Sun reaches the next cardinal ecliptic longitude
 * (0° Mar Equinox, 90° Jun Solstice, 180° Sep Equinox, 270° Dec Solstice).
 */
export function findNextSeasonTransitionUtc(currentUtcMs: number): {
  targetDeg: number;
  transitionUtcDate: Date;
} {
  const curLong = getApparentSunLongitudeDeg(currentUtcMs);
  let targetDeg = 90;
  if (curLong >= 270) {
    targetDeg = 360;
  } else if (curLong >= 180) {
    targetDeg = 270;
  } else if (curLong >= 90) {
    targetDeg = 180;
  } else {
    targetDeg = 90;
  }

  const degRemaining = targetDeg - curLong;
  let tMs = currentUtcMs + (degRemaining / 360) * 365.24219 * 86400000;

  const h = 60000; // 1 minute derivative step
  const wrappedTarget = targetDeg % 360;
  for (let i = 0; i < 6; i++) {
    const f = signedAngleDiffDeg(getApparentSunLongitudeDeg(tMs), wrappedTarget);
    const fPlus = signedAngleDiffDeg(getApparentSunLongitudeDeg(tMs + h), wrappedTarget);
    const fMinus = signedAngleDiffDeg(getApparentSunLongitudeDeg(tMs - h), wrappedTarget);
    const deriv = (fPlus - fMinus) / (2 * h);
    if (Math.abs(deriv) > 1e-12) {
      tMs -= f / deriv;
    }
  }

  return {
    targetDeg: wrappedTarget,
    transitionUtcDate: new Date(Math.round(tMs)),
  };
}

/**
 * Main Solar Calculation Function
 */
export function calculateSolarPosition(params: SolarInputParameters): SolarCalculationResult {
  const { referenceDate, latitude, longitude, axialTilt, timeZoneId, autoHistoricalTimezone } = params;
  const timezoneSystemMode = params.timezoneSystemMode || 'noaa_official';

  // 1. UTC Hour & Fractional Day of Year
  const utcHours = referenceDate.getUTCHours();
  const utcMinutes = referenceDate.getUTCMinutes();
  const utcSeconds = referenceDate.getUTCSeconds();
  const utcMs = referenceDate.getUTCMilliseconds();

  const utcHourFraction = utcHours + (utcMinutes / 60) + (utcSeconds / 3600) + (utcMs / 3600000);
  const utcMinutesTotal = utcHourFraction * 60;

  const dayOfYear = getDayOfYear(referenceDate);

  // 1. EQUAÇÃO DO TEMPO (EoT em Minutos) COM A INCLINAÇÃO AXIAL DA TERRA (axialTilt / ε)
  // Formulação astronômica de alta precisão (NOAA / Smart / Meeus):
  // Integra a inclinação axial da Terra (ε) através do fator de obliquidade y = tan²(ε / 2)
  // e a órbita elíptica elipsoidal da Terra com excentricidade e
  const julianDay = 2440587.5 + (referenceDate.getTime() / 86400000);
  const julianCentury = (julianDay - 2451545.0) / 36525.0;

  // Longitude Média Geométrica do Sol (L₀ em graus e radianos)
  let geomMeanLongSun = (280.46646 + julianCentury * (36000.76983 + julianCentury * 0.0003032)) % 360;
  if (geomMeanLongSun < 0) geomMeanLongSun += 360;
  const geomMeanLongSunRad = geomMeanLongSun * DEG2RAD;

  // Anomalia Média do Sol (M em graus e radianos)
  let geomMeanAnomalySun = (357.52911 + julianCentury * (35999.05029 - 0.0001537 * julianCentury)) % 360;
  if (geomMeanAnomalySun < 0) geomMeanAnomalySun += 360;
  const geomMeanAnomalySunRad = geomMeanAnomalySun * DEG2RAD;

  // Excentricidade da Órbita da Terra (e)
  const earthOrbitEccentricity = 0.016708634 - julianCentury * (0.000042037 + 0.0000001267 * julianCentury);

  // Inclinação Axial da Terra (ε) em radianos
  const axialTiltRad = axialTilt * DEG2RAD;

  // Fator de Obliquidade da Eclíptica em função da inclinação da Terra: y = tan²(ε / 2)
  const obliquityFactorY = Math.tan(axialTiltRad / 2) * Math.tan(axialTiltRad / 2);

  // Equação do Tempo em Radianos (NOAA / Meeus / Smart):
  // EoT_rad = y*sin(2L₀) - 2e*sin(M) + 4e*y*sin(M)*cos(2L₀) - 0.5*y²*sin(4L₀) - 1.25*e²*sin(2M)
  const eotRad =
    obliquityFactorY * Math.sin(2 * geomMeanLongSunRad) -
    2 * earthOrbitEccentricity * Math.sin(geomMeanAnomalySunRad) +
    4 * earthOrbitEccentricity * obliquityFactorY * Math.sin(geomMeanAnomalySunRad) * Math.cos(2 * geomMeanLongSunRad) -
    0.5 * obliquityFactorY * obliquityFactorY * Math.sin(4 * geomMeanLongSunRad) -
    1.25 * earthOrbitEccentricity * earthOrbitEccentricity * Math.sin(2 * geomMeanAnomalySunRad);

  // Conversão de radianos para minutos de tempo (1 rad = 4 * 180 / π = 229.183118 minutos)
  const eotMinutes = 4 * RAD2DEG * eotRad;

  // 0. Timezone System Resolution (All 14 Civil, Solar, Nautical, Military, Astronomical, Global & Custom Systems)
  let activeCivilOffset = params.civilTimezoneOffset;
  let historicalInfo: HistoricalTimezoneDetails | undefined = undefined;
  let timezoneSystemDescription = 'Fuso Oficial NOAA / IANA';
  let specialClockDisplay: string | undefined = undefined;

  // Helper to determine standard (non-DST) winter offset for railway/permanent_dst modes
  const resolveStandardBaseOffset = (): number => {
    const isRealIanaZone =
      timeZoneId &&
      timeZoneId !== 'UTC' &&
      timeZoneId !== 'TAI' &&
      timeZoneId !== 'TT/TDT' &&
      timeZoneId !== 'Solar/LST' &&
      timeZoneId !== 'Solar/LMT' &&
      timeZoneId !== 'Custom' &&
      timeZoneId !== 'BMT/Swatch' &&
      timeZoneId !== 'Astronomical/LMST' &&
      timeZoneId !== 'Historical/Decimal10h' &&
      !timeZoneId.startsWith('Etc/GMT') &&
      !timeZoneId.startsWith('NATO/') &&
      !timeZoneId.startsWith('Standard/') &&
      !timeZoneId.startsWith('PermDST/');
    if (isRealIanaZone) {
      if (timeZoneId === 'America/Havana') return -5;
      const year = referenceDate.getUTCFullYear();
      const jan = getHistoricalTimezoneOffset(timeZoneId, new Date(Date.UTC(year, 0, 1, 12, 0, 0)));
      const jul = getHistoricalTimezoneOffset(timeZoneId, new Date(Date.UTC(year, 6, 1, 12, 0, 0)));
      return Math.min(jan.offsetHours, jul.offsetHours);
    }
    return Math.max(-12, Math.min(14, Math.round(longitude / 15)));
  };

  switch (timezoneSystemMode) {
    case 'solar_lst': {
      // Natural Solar Timezone: Synchronized directly with True Solar Time (Solar noon is at 12:00:00)
      activeCivilOffset = (4 * longitude + eotMinutes) / 60;
      timezoneSystemDescription = 'Tempo Solar Verdadeiro (LST Natural - Meio-dia às 12:00)';
      historicalInfo = {
        timeZoneId: 'Solar/LST',
        offsetHours: activeCivilOffset,
        isDst: false,
        timezoneAbbrev: 'LST',
        isAutoApplied: true,
      };
      break;
    }

    case 'lmt_mean': {
      // Local Mean Time (Pré-1883: 4 min per degree of longitude, without EoT)
      activeCivilOffset = longitude / 15;
      const lmtSign = activeCivilOffset >= 0 ? '+' : '';
      timezoneSystemDescription = `Tempo Solar Médio Local (LMT ${lmtSign}${activeCivilOffset.toFixed(2)}h)`;
      historicalInfo = {
        timeZoneId: 'Solar/LMT',
        offsetHours: activeCivilOffset,
        isDst: false,
        timezoneAbbrev: 'LMT',
        isAutoApplied: true,
      };
      break;
    }

    case 'noaa_nautical': {
      // Pure NOAA Geographic Nautical Meridian (15° width bands)
      const nautOffset = Math.max(-12, Math.min(14, Math.round(longitude / 15)));
      activeCivilOffset = nautOffset;
      const sign = nautOffset >= 0 ? '+' : '';
      timezoneSystemDescription = `Meridiano Náutico Padrão NOAA 15° (UTC${sign}${nautOffset})`;
      historicalInfo = {
        timeZoneId: nautOffset === 0 ? 'Etc/GMT' : (nautOffset > 0 ? `Etc/GMT-${nautOffset}` : `Etc/GMT+${Math.abs(nautOffset)}`),
        offsetHours: nautOffset,
        isDst: false,
        timezoneAbbrev: `UTC${sign}${nautOffset}`,
        isAutoApplied: true,
      };
      break;
    }

    case 'military_nato': {
      // NATO Military / Aviation Time Zone Alphabet (A-M = +1..+12, N-Y = -1..-12, Z = UTC+0)
      const milOffset = Math.max(-12, Math.min(12, Math.round(longitude / 15)));
      activeCivilOffset = milOffset;
      const nato = getNatoZoneDetails(milOffset);
      const sign = milOffset >= 0 ? '+' : '';
      timezoneSystemDescription = `Militar NATO "${nato.phonetic}" (${nato.letter} / UTC${sign}${milOffset})`;
      specialClockDisplay = `Zona ${nato.letter} (${nato.phonetic})`;
      historicalInfo = {
        timeZoneId: `NATO/${nato.phonetic}`,
        offsetHours: milOffset,
        isDst: false,
        timezoneAbbrev: `${nato.letter} (${nato.phonetic})`,
        isAutoApplied: true,
      };
      break;
    }

    case 'railway_standard': {
      // Horário Padrão Ferroviário / Inverno Fixo (sem DST)
      const stdOffset = resolveStandardBaseOffset();
      activeCivilOffset = stdOffset;
      const sign = stdOffset >= 0 ? '+' : '';
      timezoneSystemDescription = `Horário Padrão Ferroviário Fixo (Sem DST · UTC${sign}${stdOffset})`;
      historicalInfo = {
        timeZoneId: timeZoneId || `Standard/UTC${sign}${stdOffset}`,
        offsetHours: stdOffset,
        isDst: false,
        timezoneAbbrev: `STD UTC${sign}${stdOffset}`,
        isAutoApplied: true,
      };
      break;
    }

    case 'permanent_dst': {
      // Horário de Verão Permanente (+1h contínuo sobre o padrão)
      const dstPermOffset = Math.min(14, resolveStandardBaseOffset() + 1);
      activeCivilOffset = dstPermOffset;
      const sign = dstPermOffset >= 0 ? '+' : '';
      timezoneSystemDescription = `Horário de Verão Permanente (+1h Contínuo · UTC${sign}${dstPermOffset})`;
      historicalInfo = {
        timeZoneId: timeZoneId || `PermDST/UTC${sign}${dstPermOffset}`,
        offsetHours: dstPermOffset,
        isDst: true,
        timezoneAbbrev: `DST+1 (UTC${sign}${dstPermOffset})`,
        isAutoApplied: true,
      };
      break;
    }

    case 'utc_standard': {
      // Universal Coordinated Time (Greenwich UTC+0)
      activeCivilOffset = 0;
      timezoneSystemDescription = 'Tempo Universal Coordenado (UTC+0 / Greenwich)';
      historicalInfo = {
        timeZoneId: 'UTC',
        offsetHours: 0,
        isDst: false,
        timezoneAbbrev: 'UTC',
        isAutoApplied: true,
      };
      break;
    }

    case 'tai_atomic': {
      // International Atomic Time: TAI = UTC + 37 seconds (continuous atomic scale without leap seconds)
      activeCivilOffset = 37 / 3600;
      timezoneSystemDescription = 'Tempo Atômico Internacional (TAI = UTC + 37s)';
      specialClockDisplay = 'TAI (UTC + 37s)';
      historicalInfo = {
        timeZoneId: 'TAI',
        offsetHours: activeCivilOffset,
        isDst: false,
        timezoneAbbrev: 'TAI (+37s)',
        isAutoApplied: true,
      };
      break;
    }

    case 'terrestrial_time_tt': {
      // Terrestrial Time / NASA JPL Ephemeris Time: TT = TAI + 32.184s = UTC + 69.184s
      activeCivilOffset = 69.184 / 3600;
      timezoneSystemDescription = 'Tempo Terrestre / Efemérides NASA (TT = UTC + 69,184s)';
      specialClockDisplay = 'TT (UTC + 69,18s)';
      historicalInfo = {
        timeZoneId: 'TT/TDT',
        offsetHours: activeCivilOffset,
        isDst: false,
        timezoneAbbrev: 'TT (+69.2s)',
        isAutoApplied: true,
      };
      break;
    }

    case 'swatch_beats': {
      // Swatch Internet Time: BMT (UTC+1) divided into 1000 .beats per day (@000 to @999)
      activeCivilOffset = 1;
      const utcSecsOfDay = (utcHours * 3600) + (utcMinutes * 60) + utcSeconds + (utcMs / 1000);
      const bmtSecsOfDay = (utcSecsOfDay + 3600) % 86400;
      const beats = (bmtSecsOfDay / 86.4);
      const beatsFormatted = `@${beats.toFixed(2).padStart(6, '0')}`;
      timezoneSystemDescription = `Swatch Internet Time (${beatsFormatted} .beats · BMT UTC+1)`;
      specialClockDisplay = `${beatsFormatted} .beats`;
      historicalInfo = {
        timeZoneId: 'BMT/Swatch',
        offsetHours: 1,
        isDst: false,
        timezoneAbbrev: beatsFormatted,
        isAutoApplied: true,
      };
      break;
    }

    case 'sidereal_time': {
      // Local Mean Sidereal Time (LMST): Stars clock (~23h 56m 04s sidereal day)
      const dJ2000 = julianDay - 2451545.0;
      const gmstHours = (((18.697374558 + 24.06570982441908 * dJ2000) % 24) + 24) % 24;
      const lmstHours = (((gmstHours + (longitude / 15)) % 24) + 24) % 24;
      let deltaSiderealHours = lmstHours - utcHourFraction;
      while (deltaSiderealHours > 12) deltaSiderealHours -= 24;
      while (deltaSiderealHours < -12) deltaSiderealHours += 24;
      activeCivilOffset = deltaSiderealHours;
      const lmstFormatted = formatMinutesToTimeString(lmstHours * 60);
      timezoneSystemDescription = `Tempo Sideral Local (LMST ${lmstFormatted} · Estrelas)`;
      specialClockDisplay = `LMST ${lmstFormatted}`;
      historicalInfo = {
        timeZoneId: 'Astronomical/LMST',
        offsetHours: deltaSiderealHours,
        isDst: false,
        timezoneAbbrev: 'LMST',
        isAutoApplied: true,
      };
      break;
    }

    case 'french_decimal': {
      // French Revolutionary Decimal Time (10 decimal hours / 100 min / 100 sec per local mean solar day)
      const lmtHours = (((utcHourFraction + (longitude / 15)) % 24) + 24) % 24;
      const dayFraction = lmtHours / 24;
      const totalDecSecs = dayFraction * 100000;
      const decH = Math.floor(totalDecSecs / 10000);
      const decM = Math.floor((totalDecSecs % 10000) / 100);
      const decS = Math.floor(totalDecSecs % 100);
      const decFormatted = `${decH.toString().padStart(2, '0')}h:${decM.toString().padStart(2, '0')}m:${decS.toString().padStart(2, '0')}s (Dec)`;
      activeCivilOffset = longitude / 15;
      timezoneSystemDescription = `Tempo Decimal Francês 10h (${decFormatted})`;
      specialClockDisplay = decFormatted;
      historicalInfo = {
        timeZoneId: 'Historical/Decimal10h',
        offsetHours: activeCivilOffset,
        isDst: false,
        timezoneAbbrev: `${decH}h${decM.toString().padStart(2, '0')}m Dec`,
        isAutoApplied: true,
      };
      break;
    }

    case 'manual_custom': {
      // Manual user-defined offset
      const sign = params.civilTimezoneOffset >= 0 ? '+' : '';
      timezoneSystemDescription = `Fuso Manual Personalizado (UTC${sign}${params.civilTimezoneOffset})`;
      historicalInfo = {
        timeZoneId: params.timeZoneId || 'Custom',
        offsetHours: params.civilTimezoneOffset,
        isDst: false,
        timezoneAbbrev: `UTC${sign}${params.civilTimezoneOffset}`,
        isAutoApplied: false,
      };
      break;
    }

    case 'cuba_havana':
    case 'us_eastern_dst':
    case 'cancun_fixed':
    case 'eu_london_dst':
    case 'morocco_ramadan':
    case 'egypt_dst':
    case 'israel_dst':
    case 'chile_austral_dst':
    case 'lord_howe_30m': {
      const targetIana = getIanaForSystemMode(timezoneSystemMode) || 'America/Havana';
      const resolved = getHistoricalTimezoneOffset(targetIana, referenceDate);
      const sysMeta = ALL_TIMEZONE_SYSTEMS.find((s) => s.id === timezoneSystemMode);
      activeCivilOffset = resolved.offsetHours;
      const sign = resolved.offsetHours >= 0 ? '+' : '';
      const dstTag =
        timezoneSystemMode === 'morocco_ramadan'
          ? resolved.isDst
            ? 'Ramadã'
            : 'Padrão'
          : resolved.isDst
            ? 'DST Verão'
            : 'Padrão';
      timezoneSystemDescription = `${sysMeta?.shortName || targetIana} (${targetIana} · UTC${sign}${resolved.offsetHours} · ${dstTag})`;
      specialClockDisplay = `${resolved.timezoneAbbrev} (UTC${sign}${resolved.offsetHours})`;
      const pron = getTimezonePronunciation(targetIana, resolved.timezoneAbbrev, resolved.offsetHours, referenceDate);
      historicalInfo = {
        timeZoneId: targetIana,
        offsetHours: resolved.offsetHours,
        isDst: resolved.isDst,
        timezoneAbbrev: pron.abbrev,
        timezoneFullName: pron.fullNamePt,
        timezonePronunciation: pron.pronunciationGuide,
        isAutoApplied: true,
      };
      break;
    }

    case 'noaa_official':
    default: {
      if (autoHistoricalTimezone && timeZoneId) {
        const resolved = getHistoricalTimezoneOffset(timeZoneId, referenceDate);
        const pron = getTimezonePronunciation(timeZoneId, resolved.timezoneAbbrev, resolved.offsetHours, referenceDate);
        activeCivilOffset = resolved.offsetHours;
        const sign = resolved.offsetHours >= 0 ? '+' : '';
        timezoneSystemDescription = `Fuso Oficial NOAA / IANA: ${timeZoneId} · ${pron.abbrev} (UTC${sign}${resolved.offsetHours})`;
        historicalInfo = {
          timeZoneId,
          offsetHours: resolved.offsetHours,
          isDst: resolved.isDst,
          timezoneAbbrev: pron.abbrev,
          timezoneFullName: pron.fullNamePt,
          timezonePronunciation: pron.pronunciationGuide,
          isAutoApplied: true,
        };
      } else if (timeZoneId) {
        const resolved = getHistoricalTimezoneOffset(timeZoneId, referenceDate);
        const pron = getTimezonePronunciation(timeZoneId, resolved.timezoneAbbrev, resolved.offsetHours, referenceDate);
        timezoneSystemDescription = `Fuso Civil: ${timeZoneId} (${pron.abbrev})`;
        historicalInfo = {
          timeZoneId,
          offsetHours: activeCivilOffset,
          isDst: resolved.isDst,
          timezoneAbbrev: pron.abbrev,
          timezoneFullName: pron.fullNamePt,
          timezonePronunciation: pron.pronunciationGuide,
          isAutoApplied: false,
        };
      }
      break;
    }
  }

  // 2. TEMPO SOLAR VERDADEIRO UTC (TST UTC em minutos)
  const tstUtcRaw = utcMinutesTotal + (4 * longitude) + eotMinutes;
  const tstUtcNormalized = ((tstUtcRaw % 1440) + 1440) % 1440;
  const tstUtcFormatted = formatMinutesToTimeString(tstUtcNormalized);

  // 3. HORA CIVIL LOCAL E TEMPO SOLAR LOCAL (LST LOCAL)
  const localCivilMs = referenceDate.getTime() + (activeCivilOffset * 3600000);
  const localCivilDate = new Date(localCivilMs);
  
  const localCivilHours = localCivilDate.getUTCHours();
  const localCivilMins = localCivilDate.getUTCMinutes();
  const localCivilSecs = localCivilDate.getUTCSeconds();
  const localCivilHourFraction = localCivilHours + (localCivilMins / 60) + (localCivilSecs / 3600);
  const localCivilMinutesTotal = localCivilHourFraction * 60;

  const lstLocalRaw = localCivilMinutesTotal + eotMinutes + (4 * (longitude - (15 * activeCivilOffset)));
  const lstLocalNormalized = ((lstLocalRaw % 1440) + 1440) % 1440;
  const lstLocalFormatted = formatMinutesToTimeString(lstLocalNormalized);
  const localCivilFormatted = `${localCivilDate.getUTCFullYear()}-${(localCivilDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${localCivilDate.getUTCDate().toString().padStart(2, '0')} ${formatMinutesToTimeString(localCivilMinutesTotal)}`;

  // 4. MEIO-DIA SOLAR EM UTC (Solar Noon UTC)
  const solarNoonUtcMinutes = 720 - (4 * longitude) - eotMinutes;
  const solarNoonUtcNormalized = ((solarNoonUtcMinutes % 1440) + 1440) % 1440;
  const solarNoonUtcFormatted = formatMinutesToTimeString(solarNoonUtcNormalized);

  const solarNoonLocalMinutes = solarNoonUtcNormalized + (activeCivilOffset * 60);
  const solarNoonLocalFormatted = formatMinutesToTimeString(solarNoonLocalMinutes);

  // 5. ORIENTAÇÃO SOLAR 3D (Vetor de Luz Direcionada para Game Engine)
  const apparentSunLongDeg = getApparentSunLongitudeDeg(referenceDate.getTime());
  const apparentSunLongRad = apparentSunLongDeg * DEG2RAD;
  const declinationRad = Math.asin(
    Math.sin(axialTilt * DEG2RAD) * Math.sin(apparentSunLongRad)
  );
  const declinationDeg = declinationRad * RAD2DEG;

  // Estação Astronômica do Ano baseada na Longitude Eclíptica Aparente (λ_app) e Hemisfério da Latitude
  let northHemisphereSeason: AstronomicalSeasonName;
  let southHemisphereSeason: AstronomicalSeasonName;
  let solarMotionLabel: string;
  let nextNorthSeason: AstronomicalSeasonName;
  let nextSouthSeason: AstronomicalSeasonName;
  let transitionEventName: string;

  if (Math.abs(axialTilt) < 0.01) {
    northHemisphereSeason = 'Equinócio Permanente';
    southHemisphereSeason = 'Equinócio Permanente';
    nextNorthSeason = 'Equinócio Permanente';
    nextSouthSeason = 'Equinócio Permanente';
    transitionEventName = 'Equinócio Permanente';
    solarMotionLabel = 'Eixo 0° — Sol fixo sobre o Equador (00,00°)';
  } else if (apparentSunLongDeg < 90) {
    // 0° <= λ < 90°: Declinação 0° indo em direção ao Norte (LAT +)
    northHemisphereSeason = 'Primavera';
    southHemisphereSeason = 'Outono';
    nextNorthSeason = 'Verão';
    nextSouthSeason = 'Inverno';
    transitionEventName = 'Solstício Norte (Máxima LAT +)';
    solarMotionLabel = 'Declinação 0° → Rumo ao Norte (LAT +)';
  } else if (apparentSunLongDeg < 180) {
    // 90° <= λ < 180°: Atingiu o ponto mais ao Norte (LAT +) -> Solstício Norte
    northHemisphereSeason = 'Verão';
    southHemisphereSeason = 'Inverno';
    nextNorthSeason = 'Outono';
    nextSouthSeason = 'Primavera';
    transitionEventName = 'Equinócio (Declinação 0° → Sul LAT -)';
    solarMotionLabel = 'Máxima ao Norte (LAT +) → Rumo a 0°';
  } else if (apparentSunLongDeg < 270) {
    // 180° <= λ < 270°: Declinação 0° indo em direção ao Sul (LAT -)
    northHemisphereSeason = 'Outono';
    southHemisphereSeason = 'Primavera';
    nextNorthSeason = 'Inverno';
    nextSouthSeason = 'Verão';
    transitionEventName = 'Solstício Sul (Máxima LAT -)';
    solarMotionLabel = 'Declinação 0° → Rumo ao Sul (LAT -)';
  } else {
    // 270° <= λ < 360°: Atingiu a posição mais ao Sul (LAT -) -> Solstício Sul
    northHemisphereSeason = 'Inverno';
    southHemisphereSeason = 'Verão';
    nextNorthSeason = 'Primavera';
    nextSouthSeason = 'Outono';
    transitionEventName = 'Equinócio (Declinação 0° → Norte LAT +)';
    solarMotionLabel = 'Máxima ao Sul (LAT -) → Rumo a 0°';
  }

  const hemisphereLabel: SeasonInfo['hemisphereLabel'] =
    Math.abs(latitude) < 0.005
      ? 'Linha do Equador (0°)'
      : latitude > 0
        ? 'Hemisfério Norte (LAT +)'
        : 'Hemisfério Sul (LAT -)';

  const seasonName: AstronomicalSeasonName =
    latitude < -0.005 ? southHemisphereSeason : northHemisphereSeason;

  const nextSeasonName: AstronomicalSeasonName =
    latitude < -0.005 ? nextSouthSeason : nextNorthSeason;

  // Cálculo do instante UTC exato da próxima transição e conversão para Hora Local e Dia XX-XX-XXXX
  const { transitionUtcDate } = findNextSeasonTransitionUtc(referenceDate.getTime());
  let transitionOffsetHours = activeCivilOffset;
  const regionalCalendarIana = getIanaForSystemMode(timezoneSystemMode);
  if (regionalCalendarIana) {
    transitionOffsetHours = getHistoricalTimezoneOffset(regionalCalendarIana, transitionUtcDate).offsetHours;
  } else if (timezoneSystemMode === 'noaa_official' && timeZoneId) {
    transitionOffsetHours = getHistoricalTimezoneOffset(timeZoneId, transitionUtcDate).offsetHours;
  } else if (timezoneSystemMode === 'solar_lst') {
    const transT = ((2440587.5 + transitionUtcDate.getTime() / 86400000) - 2451545.0) / 36525.0;
    const transL0 = (((280.46646 + transT * (36000.76983 + transT * 0.0003032)) % 360) + 360) % 360 * DEG2RAD;
    const transM = (((357.52911 + transT * (35999.05029 - 0.0001537 * transT)) % 360) + 360) % 360 * DEG2RAD;
    const transE = 0.016708634 - transT * (0.000042037 + 0.0000001267 * transT);
    const transEotRad =
      obliquityFactorY * Math.sin(2 * transL0) -
      2 * transE * Math.sin(transM) +
      4 * transE * obliquityFactorY * Math.sin(transM) * Math.cos(2 * transL0) -
      0.5 * obliquityFactorY * obliquityFactorY * Math.sin(4 * transL0) -
      1.25 * transE * transE * Math.sin(2 * transM);
    const transEotMin = 4 * RAD2DEG * transEotRad;
    transitionOffsetHours = (4 * longitude + transEotMin) / 60;
  }

  const pad2 = (n: number) => n.toString().padStart(2, '0');
  const formatDateDDMMYYYY = (d: Date) =>
    `${pad2(d.getUTCDate())}-${pad2(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
  const formatTimeHHMMSS = (d: Date) =>
    `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;

  const transitionLocalDateObj = new Date(transitionUtcDate.getTime() + transitionOffsetHours * 3600000);
  const transitionUtcFormatted = `${formatDateDDMMYYYY(transitionUtcDate)} ${formatTimeHHMMSS(transitionUtcDate)} UTC`;
  const transitionLocalDateFormatted = formatDateDDMMYYYY(transitionLocalDateObj);
  const transitionLocalTimeFormatted = formatTimeHHMMSS(transitionLocalDateObj);

  const seasonInfo: SeasonInfo = {
    seasonName,
    hemisphereLabel,
    solarMotionLabel,
    northHemisphereSeason,
    southHemisphereSeason,
    nextTransition: {
      eventName: transitionEventName,
      nextSeasonName,
      nextNorthSeason,
      nextSouthSeason,
      transitionUtcDate,
      transitionUtcFormatted,
      transitionLocalDateFormatted,
      transitionLocalTimeFormatted,
      transitionOffsetHours,
    },
  };

  let subsolarLon = -((utcMinutesTotal + eotMinutes - 720) / 4);
  while (subsolarLon > 180) subsolarLon -= 360;
  while (subsolarLon < -180) subsolarLon += 360;
  const subsolarLat = declinationDeg;

  const hourAngleRad = ((lstLocalNormalized / 4) - 180) * DEG2RAD;
  const hourAngleDeg = hourAngleRad * RAD2DEG;

  const latRad = latitude * DEG2RAD;

  const sinAltitude = (Math.sin(latRad) * Math.sin(declinationRad)) +
                      (Math.cos(latRad) * Math.cos(declinationRad) * Math.cos(hourAngleRad));
  const clampedSinAltitude = Math.max(-1, Math.min(1, sinAltitude));
  const altitudeRad = Math.asin(clampedSinAltitude);
  const altitudeDeg = altitudeRad * RAD2DEG;
  const zenithDeg = 90 - altitudeDeg;

  const azNumerator = -Math.sin(hourAngleRad);
  const azDenominator = (Math.cos(latRad) * Math.tan(declinationRad)) - (Math.sin(latRad) * Math.cos(hourAngleRad));
  let azimuthRad = Math.atan2(azNumerator, azDenominator);
  let azimuthDeg = azimuthRad * RAD2DEG;
  if (azimuthDeg < 0) {
    azimuthDeg += 360;
  }

  // Sunrise & Sunset Estimate
  const zenithHorizonRad = 90.833 * DEG2RAD;
  const cosHaHorizon = (Math.cos(zenithHorizonRad) - (Math.sin(latRad) * Math.sin(declinationRad))) /
                       (Math.cos(latRad) * Math.cos(declinationRad));
  
  let sunriseLocalFormatted = '--:--:--';
  let sunsetLocalFormatted = '--:--:--';
  let daylightDurationHours = 0;

  if (cosHaHorizon >= 1) {
    daylightDurationHours = 0;
    sunriseLocalFormatted = 'Noite Polar (Sol Abaixo do Horizonte)';
    sunsetLocalFormatted = 'Noite Polar (Sol Abaixo do Horizonte)';
  } else if (cosHaHorizon <= -1) {
    daylightDurationHours = 24;
    sunriseLocalFormatted = 'Sol da Meia-Noite (Sol Acima do Horizonte)';
    sunsetLocalFormatted = 'Sol da Meia-Noite (Sol Acima do Horizonte)';
  } else {
    const haSunsetRad = Math.acos(cosHaHorizon);
    const haSunsetDeg = haSunsetRad * RAD2DEG;
    daylightDurationHours = (haSunsetDeg * 2) / 15;

    const sunriseLstMinutes = (180 - haSunsetDeg) * 4;
    const sunsetLstMinutes = (180 + haSunsetDeg) * 4;

    const offsetMin = eotMinutes + 4 * (longitude - 15 * activeCivilOffset);
    const sunriseLocalMins = sunriseLstMinutes - offsetMin;
    const sunsetLocalMins = sunsetLstMinutes - offsetMin;

    sunriseLocalFormatted = formatMinutesToTimeString(sunriseLocalMins);
    sunsetLocalFormatted = formatMinutesToTimeString(sunsetLocalMins);
  }

  // Directional Light Vector 3D for Three.js
  const azRad = azimuthDeg * DEG2RAD;
  const altRad = altitudeDeg * DEG2RAD;

  const lightVector3D: Solar3DVector = {
    x: Math.cos(altRad) * Math.sin(azRad),
    y: Math.sin(altRad),
    z: -Math.cos(altRad) * Math.cos(azRad)
  };

  // Atmospheric State - Continuously Interpolated Multi-Band Model (Rayleigh + Mie + Belt of Venus + Starfield)
  const isSunAboveHorizon = altitudeDeg > -0.833;

  interface AtmosphereKeyframe {
    altitudeDeg: number;
    zenithColor: [number, number, number];
    horizonColor: [number, number, number];
    sunHorizonGlowColor: [number, number, number];
    sunColor: [number, number, number];
    sunIntensity: number;
    sunHorizonIntensity: number;
    beltOfVenusIntensity: number;
    starsIntensity: number;
    twilightPhase: SolarCalculationResult['twilightPhase'];
  }

  const ATMOSPHERE_STOPS: AtmosphereKeyframe[] = [
    {
      altitudeDeg: 90,
      zenithColor: [0.07, 0.34, 0.80],
      horizonColor: [0.64, 0.82, 0.98],
      sunHorizonGlowColor: [1.0, 0.99, 0.94],
      sunColor: [1.0, 0.99, 0.96],
      sunIntensity: 2.85,
      sunHorizonIntensity: 0.12,
      beltOfVenusIntensity: 0.0,
      starsIntensity: 0.0,
      twilightPhase: 'Daytime',
    },
    {
      altitudeDeg: 60,
      zenithColor: [0.08, 0.36, 0.78],
      horizonColor: [0.68, 0.84, 0.98],
      sunHorizonGlowColor: [1.0, 0.98, 0.90],
      sunColor: [1.0, 0.98, 0.92],
      sunIntensity: 2.55,
      sunHorizonIntensity: 0.15,
      beltOfVenusIntensity: 0.0,
      starsIntensity: 0.0,
      twilightPhase: 'Daytime',
    },
    {
      altitudeDeg: 20,
      zenithColor: [0.10, 0.34, 0.72],
      horizonColor: [0.72, 0.82, 0.94],
      sunHorizonGlowColor: [1.0, 0.90, 0.70],
      sunColor: [1.0, 0.94, 0.82],
      sunIntensity: 2.05,
      sunHorizonIntensity: 0.25,
      beltOfVenusIntensity: 0.0,
      starsIntensity: 0.0,
      twilightPhase: 'Daytime',
    },
    {
      altitudeDeg: 6,
      zenithColor: [0.14, 0.28, 0.62],
      horizonColor: [0.98, 0.74, 0.42],
      sunHorizonGlowColor: [1.0, 0.62, 0.18],
      sunColor: [1.0, 0.75, 0.30],
      sunIntensity: 1.35,
      sunHorizonIntensity: 0.75,
      beltOfVenusIntensity: 0.05,
      starsIntensity: 0.0,
      twilightPhase: 'Golden Hour',
    },
    {
      altitudeDeg: 1.5,
      zenithColor: [0.12, 0.22, 0.52],
      horizonColor: [0.98, 0.52, 0.22],
      sunHorizonGlowColor: [1.0, 0.40, 0.08],
      sunColor: [1.0, 0.50, 0.12],
      sunIntensity: 0.78,
      sunHorizonIntensity: 1.25,
      beltOfVenusIntensity: 0.25,
      starsIntensity: 0.0,
      twilightPhase: 'Golden Hour',
    },
    {
      altitudeDeg: 0,
      zenithColor: [0.10, 0.16, 0.42],
      horizonColor: [0.95, 0.38, 0.18],
      sunHorizonGlowColor: [1.0, 0.28, 0.05],
      sunColor: [1.0, 0.35, 0.08],
      sunIntensity: 0.36,
      sunHorizonIntensity: 1.50,
      beltOfVenusIntensity: 0.55,
      starsIntensity: 0.0,
      twilightPhase: 'Civil Twilight',
    },
    {
      altitudeDeg: -2,
      zenithColor: [0.08, 0.12, 0.36],
      horizonColor: [0.85, 0.26, 0.32],
      sunHorizonGlowColor: [0.96, 0.22, 0.14],
      sunColor: [0.90, 0.25, 0.10],
      sunIntensity: 0.10,
      sunHorizonIntensity: 1.25,
      beltOfVenusIntensity: 0.95,
      starsIntensity: 0.05,
      twilightPhase: 'Civil Twilight',
    },
    {
      altitudeDeg: -6,
      zenithColor: [0.05, 0.07, 0.24],
      horizonColor: [0.45, 0.16, 0.38],
      sunHorizonGlowColor: [0.72, 0.18, 0.22],
      sunColor: [0.55, 0.12, 0.20],
      sunIntensity: 0.0,
      sunHorizonIntensity: 0.65,
      beltOfVenusIntensity: 0.35,
      starsIntensity: 0.25,
      twilightPhase: 'Nautical Twilight',
    },
    {
      altitudeDeg: -10,
      zenithColor: [0.03, 0.04, 0.15],
      horizonColor: [0.18, 0.12, 0.28],
      sunHorizonGlowColor: [0.32, 0.10, 0.20],
      sunColor: [0.25, 0.08, 0.15],
      sunIntensity: 0.0,
      sunHorizonIntensity: 0.25,
      beltOfVenusIntensity: 0.05,
      starsIntensity: 0.65,
      twilightPhase: 'Nautical Twilight',
    },
    {
      altitudeDeg: -14,
      zenithColor: [0.02, 0.025, 0.09],
      horizonColor: [0.06, 0.06, 0.15],
      sunHorizonGlowColor: [0.10, 0.05, 0.12],
      sunColor: [0.08, 0.04, 0.10],
      sunIntensity: 0.0,
      sunHorizonIntensity: 0.08,
      beltOfVenusIntensity: 0.0,
      starsIntensity: 0.90,
      twilightPhase: 'Astronomical Twilight',
    },
    {
      altitudeDeg: -18,
      zenithColor: [0.008, 0.012, 0.035],
      horizonColor: [0.02, 0.03, 0.07],
      sunHorizonGlowColor: [0.02, 0.03, 0.07],
      sunColor: [0.01, 0.02, 0.05],
      sunIntensity: 0.0,
      sunHorizonIntensity: 0.0,
      beltOfVenusIntensity: 0.0,
      starsIntensity: 1.0,
      twilightPhase: 'Night',
    },
  ];

  const smoothstepCalc = (min: number, max: number, val: number): number => {
    const x = Math.max(0, Math.min(1, (val - min) / (max - min)));
    return x * x * (3 - 2 * x);
  };

  const lerpVal = (a: number, b: number, t: number): number => a + (b - a) * t;
  const lerpCol = (c1: [number, number, number], c2: [number, number, number], t: number): [number, number, number] => [
    lerpVal(c1[0], c2[0], t),
    lerpVal(c1[1], c2[1], t),
    lerpVal(c1[2], c2[2], t),
  ];

  const colToHex = (c: [number, number, number]): string => {
    const toH = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0');
    return `#${toH(c[0])}${toH(c[1])}${toH(c[2])}`;
  };

  // Find bounding stops
  let lowerStop = ATMOSPHERE_STOPS[ATMOSPHERE_STOPS.length - 1];
  let upperStop = ATMOSPHERE_STOPS[0];

  if (altitudeDeg >= ATMOSPHERE_STOPS[0].altitudeDeg) {
    lowerStop = ATMOSPHERE_STOPS[0];
    upperStop = ATMOSPHERE_STOPS[0];
  } else if (altitudeDeg <= ATMOSPHERE_STOPS[ATMOSPHERE_STOPS.length - 1].altitudeDeg) {
    lowerStop = ATMOSPHERE_STOPS[ATMOSPHERE_STOPS.length - 1];
    upperStop = ATMOSPHERE_STOPS[ATMOSPHERE_STOPS.length - 1];
  } else {
    for (let i = 0; i < ATMOSPHERE_STOPS.length - 1; i++) {
      if (altitudeDeg <= ATMOSPHERE_STOPS[i].altitudeDeg && altitudeDeg >= ATMOSPHERE_STOPS[i + 1].altitudeDeg) {
        upperStop = ATMOSPHERE_STOPS[i];
        lowerStop = ATMOSPHERE_STOPS[i + 1];
        break;
      }
    }
  }

  const factor = upperStop.altitudeDeg === lowerStop.altitudeDeg
    ? 0
    : smoothstepCalc(lowerStop.altitudeDeg, upperStop.altitudeDeg, altitudeDeg);

  const curZenith = lerpCol(lowerStop.zenithColor, upperStop.zenithColor, factor);
  const curHorizon = lerpCol(lowerStop.horizonColor, upperStop.horizonColor, factor);
  const curSunHorizon = lerpCol(lowerStop.sunHorizonGlowColor, upperStop.sunHorizonGlowColor, factor);
  const curSunColor = lerpCol(lowerStop.sunColor, upperStop.sunColor, factor);

  const sunIntensity = Math.round(lerpVal(lowerStop.sunIntensity, upperStop.sunIntensity, factor) * 1000) / 1000;
  const sunHorizonIntensity = Math.round(lerpVal(lowerStop.sunHorizonIntensity, upperStop.sunHorizonIntensity, factor) * 1000) / 1000;
  const beltOfVenusIntensity = Math.round(lerpVal(lowerStop.beltOfVenusIntensity, upperStop.beltOfVenusIntensity, factor) * 1000) / 1000;
  const starsIntensity = Math.round(lerpVal(lowerStop.starsIntensity, upperStop.starsIntensity, factor) * 1000) / 1000;

  // Discrete category for badge/label UI display
  let twilightPhase: SolarCalculationResult['twilightPhase'] = 'Night';
  if (altitudeDeg >= 6) {
    twilightPhase = 'Daytime';
  } else if (altitudeDeg >= 0) {
    twilightPhase = 'Golden Hour';
  } else if (altitudeDeg >= -6) {
    twilightPhase = 'Civil Twilight';
  } else if (altitudeDeg >= -12) {
    twilightPhase = 'Nautical Twilight';
  } else if (altitudeDeg >= -18) {
    twilightPhase = 'Astronomical Twilight';
  } else {
    twilightPhase = 'Night';
  }

  const skyColorHex = colToHex(curZenith);
  const horizonColorHex = colToHex(curHorizon);
  const sunHorizonGlowColorHex = colToHex(curSunHorizon);
  const sunColorHex = colToHex(curSunColor);

  return {
    dayOfYear,
    utcHourFraction,
    localCivilHourFraction,
    timezoneSystemMode,
    timezoneSystemDescription,
    specialClockDisplay,
    historicalTimezoneInfo: historicalInfo,
    equationOfTimeMinutes: eotMinutes,
    tstUtcMinutes: tstUtcNormalized,
    tstUtcFormatted,
    localCivilTimeDate: localCivilDate,
    localCivilTimeFormatted: localCivilFormatted,
    lstLocalMinutes: lstLocalNormalized,
    lstLocalFormatted,
    solarNoonUtcMinutes: solarNoonUtcNormalized,
    solarNoonUtcFormatted,
    solarNoonLocalFormatted,
    sunriseLocalFormatted,
    sunsetLocalFormatted,
    daylightDurationHours: Math.round(daylightDurationHours * 100) / 100,
    declinationDeg: Math.round(declinationDeg * 10000) / 10000,
    subsolarLongitude: Math.round(subsolarLon * 10000) / 10000,
    subsolarLatitude: Math.round(subsolarLat * 10000) / 10000,
    hourAngleDeg: Math.round(hourAngleDeg * 10000) / 10000,
    solarAltitudeDeg: Math.round(altitudeDeg * 10000) / 10000,
    solarZenithDeg: Math.round(zenithDeg * 10000) / 10000,
    solarAzimuthDeg: Math.round(azimuthDeg * 10000) / 10000,
    lightVector3D,
    twilightPhase,
    sunColorHex,
    sunIntensity,
    skyColorHex,
    horizonColorHex,
    sunHorizonGlowColorHex,
    sunHorizonIntensity,
    starsIntensity,
    beltOfVenusIntensity,
    isSunAboveHorizon,
    seasonInfo,
  };
}

/**
 * Returns formatted mathematical breakdown of each of the 6 steps for UI display
 */
export function getFormulaStepBreakdown(params: SolarInputParameters, result: SolarCalculationResult): FormulaStepDetails[] {
  const { latitude, longitude, axialTilt } = params;
  const {
    dayOfYear,
    equationOfTimeMinutes,
    tstUtcMinutes,
    tstUtcFormatted,
    lstLocalMinutes,
    lstLocalFormatted,
    solarNoonUtcFormatted,
    declinationDeg,
    subsolarLongitude,
    hourAngleDeg,
    solarAltitudeDeg,
    solarAzimuthDeg,
    lightVector3D,
    historicalTimezoneInfo,
  } = result;

  const activeOffset = historicalTimezoneInfo ? historicalTimezoneInfo.offsetHours : params.civilTimezoneOffset;

  // Components for Step 1 breakdown with Earth's axial tilt (axialTilt / ε)
  const julianDay = 2440587.5 + (params.referenceDate.getTime() / 86400000);
  const julianCentury = (julianDay - 2451545.0) / 36525.0;

  let geomMeanLongSun = (280.46646 + julianCentury * (36000.76983 + julianCentury * 0.0003032)) % 360;
  if (geomMeanLongSun < 0) geomMeanLongSun += 360;
  const geomMeanLongSunRad = geomMeanLongSun * DEG2RAD;

  let geomMeanAnomalySun = (357.52911 + julianCentury * (35999.05029 - 0.0001537 * julianCentury)) % 360;
  if (geomMeanAnomalySun < 0) geomMeanAnomalySun += 360;
  const geomMeanAnomalySunRad = geomMeanAnomalySun * DEG2RAD;

  const earthOrbitEccentricity = 0.016708634 - julianCentury * (0.000042037 + 0.0000001267 * julianCentury);

  const axialTiltRad = axialTilt * DEG2RAD;
  const obliquityFactorY = Math.tan(axialTiltRad / 2) * Math.tan(axialTiltRad / 2);

  const obliqComponentMinutes = 4 * RAD2DEG * (obliquityFactorY * Math.sin(2 * geomMeanLongSunRad));
  const eccComponentMinutes = 4 * RAD2DEG * (-2 * earthOrbitEccentricity * Math.sin(geomMeanAnomalySunRad));
  const higherOrderMinutes = equationOfTimeMinutes - obliqComponentMinutes - eccComponentMinutes;

  return [
    {
      title: '1. Equação do Tempo (EoT) com Inclinação da Terra (ε)',
      formulaRaw:
        `// 1. Fator de Obliquidade da Inclinação Axial da Terra (ε):\n` +
        `y = tan²(ε / 2)  [onde ε = ${axialTilt.toFixed(2)}°]\n\n` +
        `// 2. Componentes Astronômicos (NOAA / Smart / Meeus):\n` +
        `L₀ = Longitude Média do Sol | M = Anomalia Média | e = ${earthOrbitEccentricity.toFixed(5)} (Excentricidade)\n\n` +
        `// 3. Equação do Tempo em Radianos:\n` +
        `EoT_rad = y·sin(2L₀) - 2e·sin(M) + 4e·y·sin(M)·cos(2L₀) - 0.5·y²·sin(4L₀) - 1.25·e²·sin(2M)\n\n` +
        `// 4. Conversão para Minutos (1 rad = 4·(180/π) = 229.1831 min):\n` +
        `EoT = 229.1831 · EoT_rad`,
      formulaEvaluated:
        `EoT = ${obliqComponentMinutes >= 0 ? '+' : ''}${obliqComponentMinutes.toFixed(2)}m (Obliquidade ε) + ` +
        `${eccComponentMinutes >= 0 ? '+' : ''}${eccComponentMinutes.toFixed(2)}m (Órbita e) + ` +
        `${higherOrderMinutes >= 0 ? '+' : ''}${higherOrderMinutes.toFixed(2)}m (Ordem Sup.) = ${equationOfTimeMinutes.toFixed(4)} min`,
      variables: {
        'inclinacao_axial_terra_epsilon': `${axialTilt.toFixed(2)}°`,
        'fator_obliquidade_y': `${obliquityFactorY.toFixed(6)} [tan²(${axialTilt.toFixed(2)}° / 2)]`,
        'excentricidade_orbital_e': earthOrbitEccentricity.toFixed(7),
        'longitude_media_sol_L0': `${geomMeanLongSun.toFixed(4)}°`,
        'anomalia_media_sol_M': `${geomMeanAnomalySun.toFixed(4)}°`,
        'termo_obliquidade_inclinacao': `${obliqComponentMinutes >= 0 ? '+' : ''}${obliqComponentMinutes.toFixed(4)} min (y·sin(2L₀))`,
        'termo_excentricidade_orbita': `${eccComponentMinutes >= 0 ? '+' : ''}${eccComponentMinutes.toFixed(4)} min (-2e·sin(M))`,
        'termos_cruzados_ordem_superior': `${higherOrderMinutes >= 0 ? '+' : ''}${higherOrderMinutes.toFixed(4)} min`,
        'EoT_total_minutos': `${equationOfTimeMinutes.toFixed(4)} min`,
      },
      description:
        `Calcula a defasagem entre o Sol Aparente e o Sol Médio integrando diretamente a Inclinação da Terra (ε = ${axialTilt.toFixed(2)}°) pelo fator de obliquidade y = tan²(ε/2). Quando a inclinação varia (ex: 0° na Terra sem inclinação, 23.44° padrão, ou 25.19° em Marte), a componente semestral y·sin(2L₀) é recalculada em tempo real.`,
    },
    {
      title: '2. Tempo Solar Verdadeiro UTC (TST UTC)',
      formulaRaw: 'TST_UTC = hora_utc_minutos + (4 * longitude) + EoT\nTST_UTC_Normalizado = ((TST_UTC % 1440) + 1440) % 1440',
      formulaEvaluated: `TST_UTC = ${tstUtcMinutes.toFixed(2)} min => ${tstUtcFormatted}`,
      variables: {
        'hora_utc_minutos': (result.utcHourFraction * 60).toFixed(2),
        'longitude_lambda': longitude,
        'EoT': equationOfTimeMinutes.toFixed(4),
        'TST_UTC_Normalizado': tstUtcFormatted,
      },
      description: 'Normaliza a posição do Sol diretamente no meridiano de Greenwich (UTC+0).',
    },
    {
      title: '3. Hora Civil Local & Tempo Solar Local (LST Local)',
      formulaRaw: 'Hora_Civil_Local = UTC_Timestamp + (Fuso_Local * 3600000)\nLST_Local = Hora_Civil_Local_Minutos + EoT + 4 * (longitude - 15 * Fuso_Local)',
      formulaEvaluated: `LST_Local = ${lstLocalMinutes.toFixed(2)} min => ${lstLocalFormatted}`,
      variables: {
        'Sistema_Fuso_Ativo': result.timezoneSystemDescription,
        'Fuso_Local_Horas': activeOffset,
        'Fuso_NOAA_IANA': historicalTimezoneInfo ? `${historicalTimezoneInfo.timeZoneId} (${historicalTimezoneInfo.timezoneAbbrev})` : 'Manual',
        'DST_Histórico_Ativo': historicalTimezoneInfo?.isDst ? 'SIM (Horário de Verão)' : 'NÃO',
        'Hora_Civil_Local': result.localCivilTimeFormatted,
        'LST_Local_Formatado': lstLocalFormatted,
      },
      description: 'Converte a hora civil do fuso selecionado (resolvido automaticamente via histórico IANA/NOAA para a data) para o Tempo Solar Local exato.',
    },
    {
      title: '4. Meio-Dia Solar em UTC (Solar Noon UTC)',
      formulaRaw: 'SolarNoon_UTC_Minutos = 720 - (4 * longitude) - EoT',
      formulaEvaluated: `SolarNoon_UTC = ${result.solarNoonUtcMinutes.toFixed(2)} min => ${solarNoonUtcFormatted} UTC (${result.solarNoonLocalFormatted} Local)`,
      variables: {
        'longitude': longitude,
        'EoT': equationOfTimeMinutes.toFixed(4),
        'SolarNoon_UTC': solarNoonUtcFormatted,
        'SolarNoon_Local': result.solarNoonLocalFormatted,
      },
      description: 'Determina o instante exato em que o Sol atinge o ápice (zênite máximo) no meridiano local.',
    },
    {
      title: '5. Orientação Solar 3D (Zênite, Altitude & Azimute)',
      formulaRaw: 'Declinação = asin(sin(Tilt) * sin(2π * (dia - 81) / 365.25))\nSubsolar_Lon = -((UTC_Min + EoT - 720) / 4)\nHA = (LST_Local / 4 - 180) * DEG2RAD\nAltitude = asin(sin(Lat)*sin(Dec) + cos(Lat)*cos(Dec)*cos(HA))\nAzimute = atan2(-sin(HA), cos(Lat)*tan(Dec) - sin(Lat)*cos(HA))',
      formulaEvaluated: `Altitude = ${solarAltitudeDeg.toFixed(2)}° | Zênite = ${result.solarZenithDeg.toFixed(2)}° | Azimute = ${solarAzimuthDeg.toFixed(2)}°`,
      variables: {
        'Axial_Tilt': `${axialTilt}°`,
        'Declinação': `${declinationDeg.toFixed(4)}°`,
        'Subsolar_Lon': `${subsolarLongitude.toFixed(4)}°`,
        'Subsolar_Lat': `${result.subsolarLatitude.toFixed(4)}°`,
        'HourAngle_HA': `${hourAngleDeg.toFixed(4)}°`,
        'Altitude_Solar': `${solarAltitudeDeg.toFixed(2)}°`,
        'Zênite_Solar': `${result.solarZenithDeg.toFixed(2)}°`,
        'Azimute_Solar': `${solarAzimuthDeg.toFixed(2)}°`,
      },
      description: 'Mapeia a posição tridimensional do Sol no céu em coordenadas esféricas (Altitude & Azimute) e ponto subsolar global.',
    },
    {
      title: '6. Vetor 3D de Luz Direcionada para Game Engine',
      formulaRaw: 'x = cos(Altitude) * sin(Azimute)\ny = sin(Altitude)\nz = -cos(Altitude) * cos(Azimute)',
      formulaEvaluated: `Vector3D: (X: ${lightVector3D.x.toFixed(4)}, Y: ${lightVector3D.y.toFixed(4)}, Z: ${lightVector3D.z.toFixed(4)})`,
      variables: {
        'X_East': lightVector3D.x.toFixed(4),
        'Y_Up': lightVector3D.y.toFixed(4),
        'Z_North': lightVector3D.z.toFixed(4),
        'Fase_Crepúsculo': result.twilightPhase,
        'Intensidade_Solar': result.sunIntensity.toFixed(2),
        'Brilho_Horizonte_Mie': `${(result.sunHorizonIntensity * 100).toFixed(0)}%`,
        'Cinturão_de_Vênus': `${(result.beltOfVenusIntensity * 100).toFixed(0)}%`,
        'Visibilidade_Estrelas': `${(result.starsIntensity * 100).toFixed(0)}%`,
      },
      description: 'Gera o vetor de direção unitário e a transição atmosférica contínua fotorrealista (espalhamento de Rayleigh/Mie, brilho no horizonte, Cinturão de Vênus e campo estelar cintilante) para renderizadores de jogos e simulações.',
    },
  ];
}
