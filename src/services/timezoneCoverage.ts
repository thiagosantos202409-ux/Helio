/**
 * Calculation of geographic and theoretical coverage (abrangência)
 * for NOAA timezones and standard meridians.
 */

export interface TimezoneCoverage {
  offsetHours: number;
  centralMeridianLng: number;
  westLimitLng: number;
  eastLimitLng: number;
  widthDeg: number;
  solarDeviationMin: number;
  solarDeviationDescription: string;
  solarNoonCivilTimeFormatted: string;
  meridianName: string;
}

/**
 * Calculates the theoretical 15° solar swath coverage for a given timezone offset and observer longitude.
 * Every hour of timezone difference equals exactly 15° of longitude on Earth (360° / 24h = 15°/h).
 * 1° of longitude difference corresponds to 4 minutes of solar time deviation.
 */
export function calculateTimezoneCoverage(offsetHours: number, observerLng: number): TimezoneCoverage {
  // Normalize central meridian
  let central = offsetHours * 15;
  while (central > 180) central -= 360;
  while (central < -180) central += 360;

  const west = central - 7.5;
  const east = central + 7.5;
  const width = 15;

  // Longitude delta from central standard meridian
  const diffDeg = observerLng - central;
  // 4 minutes of solar time per degree
  const solarDeviationMin = diffDeg * 4;

  const deviationAbs = Math.abs(solarDeviationMin);
  const minutes = Math.floor(deviationAbs);
  const seconds = Math.round((deviationAbs - minutes) * 60);
  const timeFormatted = `${minutes}m ${seconds.toString().padStart(2, '0')}s`;

  let desc = '';
  if (Math.abs(diffDeg) < 0.05) {
    desc = 'Alinhado quase perfeitamente com o meridiano central padrão!';
  } else if (diffDeg < 0) {
    desc = `Localizado a ${Math.abs(diffDeg).toFixed(2)}° a Oeste do meridiano central. O meio-dia solar ocorre ~${timeFormatted} APÓS o meio-dia (12:00) do relógio.`;
  } else {
    desc = `Localizado a ${diffDeg.toFixed(2)}° a Leste do meridiano central. O meio-dia solar ocorre ~${timeFormatted} ANTES do meio-dia (12:00) do relógio.`;
  }

  // Civil clock time of solar noon (12:00 - deviation)
  const civilNoonMinutes = 720 - solarDeviationMin;
  const noonHour = Math.floor(((civilNoonMinutes % 1440) + 1440) % 1440 / 60);
  const noonMin = Math.floor(((civilNoonMinutes % 1440) + 1440) % 1440 % 60);
  const noonSec = Math.round(((((civilNoonMinutes % 1440) + 1440) % 1440 % 60) - noonMin) * 60);
  const solarNoonCivilTimeFormatted = `${noonHour.toString().padStart(2, '0')}:${noonMin.toString().padStart(2, '0')}:${noonSec.toString().padStart(2, '0')}`;

  const meridianName = central === 0
    ? '0.0° (Meridiano de Greenwich)'
    : `${Math.abs(central).toFixed(2)}° ${central > 0 ? 'Leste (E)' : 'Oeste (W)'}`;

  return {
    offsetHours,
    centralMeridianLng: Number(central.toFixed(4)),
    westLimitLng: Number(west.toFixed(4)),
    eastLimitLng: Number(east.toFixed(4)),
    widthDeg: width,
    solarDeviationMin: Number(solarDeviationMin.toFixed(2)),
    solarDeviationDescription: desc,
    solarNoonCivilTimeFormatted,
    meridianName,
  };
}
