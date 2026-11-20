/**
 * Global NOAA & IANA Timezone Resolution Service
 * Automatically detects and applies the official NOAA timezone for any coordinate on Earth.
 */

import { NOAA_LOCATIONS } from '../data/noaaLocations';
import { getHistoricalTimezoneOffset } from '../engine/solarEngine';
import { fetchGoogleTimeZone } from './googleMapsService';

export interface ResolvedTimezone {
  timeZoneId: string;
  offsetHours: number;
  isDst: boolean;
  timezoneAbbrev: string;
  source: 'google' | 'noaa_regional' | 'noaa_nautical';
  locationName?: string;
}

/**
 * Great-circle distance between two geographic coordinates in kilometers (Haversine formula)
 */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth mean radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Fast client-side NOAA / IANA geopolitical classifier for any coordinates on Earth
 */
export function classifyNoaaTimezone(lat: number, lon: number): { timeZoneId: string; locationName: string } {
  // Normalize longitude to -180..+180
  let normLon = ((lon + 180) % 360 + 360) % 360 - 180;

  // 1. BRAZIL
  if (lat >= -34 && lat <= 5.5 && normLon >= -74 && normLon <= -34) {
    if (normLon > -35.5 && lat >= -5 && lat <= -3) {
      return { timeZoneId: 'America/Noronha', locationName: 'Fernando de Noronha, Brasil' };
    }
    if (normLon < -66.5 && lat <= -7) {
      return { timeZoneId: 'America/Rio_Branco', locationName: 'Acre, Brasil' };
    }
    if (lat >= -9.5 && lat <= 2.2 && normLon >= -57.2 && normLon <= -51.8) {
      return { timeZoneId: 'America/Santarem', locationName: 'Altamira / Oeste Paraense (PA), Brasil' };
    }
    if (lat >= -24.1 && lat < -17.3 && normLon >= -58.2 && normLon <= -50.9) {
      return { timeZoneId: 'America/Campo_Grande', locationName: 'Campo Grande / MS, Brasil' };
    }
    if (lat >= -17.3 && lat <= -7.4 && normLon >= -61.6 && normLon <= -50.2) {
      return { timeZoneId: 'America/Cuiaba', locationName: 'Cuiabá / Mato Grosso, Brasil' };
    }
    if (normLon < -54.0 && lat >= -14.0) {
      return { timeZoneId: 'America/Manaus', locationName: 'Manaus / Amazonas (AM/RO/RR), Brasil' };
    }
    if (lat >= -6.0 && lat <= 4.5 && normLon >= -52.5 && normLon <= -46.0) {
      return { timeZoneId: 'America/Belem', locationName: 'Belém / Pará, Brasil' };
    }
    if (lat >= -13.5 && lat < -6.0 && normLon >= -50.6 && normLon <= -45.7) {
      return { timeZoneId: 'America/Araguaina', locationName: 'Palmas / Araguaína (TO), Brasil' };
    }
    if (lat >= -9.4 && lat <= -4.5 && normLon >= -41.5 && normLon <= -34.5) {
      return { timeZoneId: 'America/Recife', locationName: 'Recife / Pernambuco, Brasil' };
    }
    if (lat >= -18.3 && lat < -9.4 && normLon >= -46.6 && normLon <= -37.2) {
      return { timeZoneId: 'America/Bahia', locationName: 'Salvador / Bahia, Brasil' };
    }
    return { timeZoneId: 'America/Sao_Paulo', locationName: 'Brasília / São Paulo, Brasil' };
  }

  // 2. INDIA & NEPAL (Fractional offsets :30 and :45)
  if (lat >= 26.3 && lat <= 30.5 && normLon >= 80.0 && normLon <= 88.2) {
    return { timeZoneId: 'Asia/Kathmandu', locationName: 'Katmandu, Nepal (UTC+5:45)' };
  }
  if (lat >= 6.5 && lat <= 35.5 && normLon >= 68.0 && normLon <= 97.5) {
    return { timeZoneId: 'Asia/Kolkata', locationName: 'Nova Delhi, Índia (UTC+5:30)' };
  }

  // 3. IRAN & AFGHANISTAN
  if (lat >= 25.0 && lat <= 39.8 && normLon >= 44.0 && normLon <= 63.3) {
    return { timeZoneId: 'Asia/Tehran', locationName: 'Teerã, Irã (UTC+3:30)' };
  }
  if (lat >= 29.5 && lat <= 38.5 && normLon >= 60.5 && normLon <= 74.9) {
    return { timeZoneId: 'Asia/Kabul', locationName: 'Cabul, Afeganistão (UTC+4:30)' };
  }

  // 4. MYANMAR (BURMA)
  if (lat >= 9.5 && lat <= 28.5 && normLon >= 92.0 && normLon <= 101.2) {
    return { timeZoneId: 'Asia/Yangon', locationName: 'Yangon, Mianmar (UTC+6:30)' };
  }

  // 5. NEWFOUNDLAND, CANADA (:30 offset)
  if (lat >= 46.5 && lat <= 51.7 && normLon >= -59.5 && normLon <= -52.5) {
    return { timeZoneId: 'America/St_Johns', locationName: 'Terra Nova, Canadá (UTC-3:30)' };
  }

  // 6. AUSTRALIA
  if (lat >= -44 && lat <= -10 && normLon >= 112 && normLon <= 155) {
    if (lat >= -32 && lat <= -31 && normLon >= 158.5 && normLon <= 160) {
      return { timeZoneId: 'Australia/Lord_Howe', locationName: 'Ilha Lord Howe, Austrália (UTC+10:30)' };
    }
    if (normLon >= 127.5 && normLon <= 130.0 && lat >= -33 && lat <= -31) {
      return { timeZoneId: 'Australia/Eucla', locationName: 'Eucla, Austrália Ocidental (UTC+8:45)' };
    }
    if (normLon < 129.0) {
      return { timeZoneId: 'Australia/Perth', locationName: 'Perth, Austrália (UTC+8)' };
    }
    if (normLon >= 129.0 && normLon <= 141.0) {
      return { timeZoneId: 'Australia/Adelaide', locationName: 'Adelaide / Darwin, Austrália (UTC+9:30)' };
    }
    if (lat >= -28.5 && lat <= -10.0) {
      return { timeZoneId: 'Australia/Brisbane', locationName: 'Brisbane, Austrália (UTC+10)' };
    }
    return { timeZoneId: 'Australia/Sydney', locationName: 'Sydney / Melbourne, Austrália (UTC+10)' };
  }

  // 7. NEW ZEALAND & CHATHAM
  if (lat >= -45.0 && lat <= -43.0 && (normLon >= 175 || normLon <= -175)) {
    return { timeZoneId: 'Pacific/Chatham', locationName: 'Ilhas Chatham, Nova Zelândia (UTC+12:45)' };
  }
  if (lat >= -48.0 && lat <= -34.0 && normLon >= 165.0 && normLon <= 179.0) {
    return { timeZoneId: 'Pacific/Auckland', locationName: 'Auckland / Wellington, Nova Zelândia (UTC+12)' };
  }

  // 8. PACIFIC ISLANDS (Kiritimati +14, Tonga +13, Samoa, Marquesas -9:30, Hawaii -10)
  if (lat >= -5.0 && lat <= 5.0 && normLon >= -161.0 && normLon <= -154.0) {
    return { timeZoneId: 'Pacific/Kiritimati', locationName: 'Kiritimati / Ilhas da Linha (UTC+14)' };
  }
  if (lat >= -23.0 && lat <= -15.0 && normLon >= -176.5 && normLon <= -173.0) {
    return { timeZoneId: 'Pacific/Tongatapu', locationName: 'Nukuʻalofa, Tonga (UTC+13)' };
  }
  if (lat >= -15.0 && lat <= -12.5 && normLon >= -173.0 && normLon <= -171.0) {
    return { timeZoneId: 'Pacific/Apia', locationName: 'Apia, Samoa Ocidental (UTC+13)' };
  }
  if (lat >= -15.0 && lat <= -13.5 && normLon >= -171.0 && normLon <= -168.0) {
    return { timeZoneId: 'Pacific/Pago_Pago', locationName: 'Pago Pago, Samoa Americana (UTC-11)' };
  }
  if (lat >= -11.0 && lat <= -7.0 && normLon >= -142.0 && normLon <= -138.0) {
    return { timeZoneId: 'Pacific/Marquesas', locationName: 'Ilhas Marquesas (UTC-9:30)' };
  }
  if (lat >= 18.5 && lat <= 23.0 && normLon >= -161.0 && normLon <= -154.5) {
    return { timeZoneId: 'Pacific/Honolulu', locationName: 'Honolulu, Havaí (UTC-10)' };
  }
  if (lat >= -1.0 && lat <= 1.0 && normLon <= -175.0) {
    return { timeZoneId: 'Etc/GMT+12', locationName: 'Baker & Howland Island (UTC-12)' };
  }

  // 9. CARIBBEAN & CENTRAL AMERICA (Cuba, Haiti, Cancún, Turks & Caicos)
  // Cuba has its own DST schedule (America/Havana, 00:00 transition & 2004-2006 permanent DST)
  if (lat >= 19.6 && lat <= 23.4 && normLon >= -85.1 && normLon <= -74.0) {
    return { timeZoneId: 'America/Havana', locationName: 'Havana / Cuba (CST/CDT UTC-5 / UTC-4)' };
  }
  if (lat >= 17.8 && lat <= 20.2 && normLon >= -74.6 && normLon <= -71.6) {
    return { timeZoneId: 'America/Port-au-Prince', locationName: 'Porto Príncipe, Haiti (UTC-5 / UTC-4)' };
  }
  if (lat >= 17.8 && lat <= 21.7 && normLon >= -88.5 && normLon <= -86.6) {
    return { timeZoneId: 'America/Cancun', locationName: 'Cancún / Quintana Roo, México (UTC-5 Fixo)' };
  }
  if (lat >= 21.0 && lat <= 22.1 && normLon >= -72.6 && normLon <= -70.9) {
    return { timeZoneId: 'America/Grand_Turk', locationName: 'Turcas e Caicos (UTC-5 / UTC-4)' };
  }

  // 9b. SOUTH AMERICA CONE (Uruguay, Paraguay, Chile, Easter Island)
  if (lat >= -27.4 && lat <= -26.9 && normLon >= -109.6 && normLon <= -109.1) {
    return { timeZoneId: 'Pacific/Easter', locationName: 'Ilha de Páscoa / Rapa Nui, Chile (UTC-6 / UTC-5)' };
  }
  if (lat >= -35.1 && lat <= -30.0 && normLon >= -58.5 && normLon <= -53.1) {
    return { timeZoneId: 'America/Montevideo', locationName: 'Montevidéu, Uruguai (UTC-3 Fixo)' };
  }
  if (lat >= -27.6 && lat <= -19.2 && normLon >= -62.7 && normLon <= -54.2) {
    return { timeZoneId: 'America/Asuncion', locationName: 'Assunção, Paraguai (UTC-3 Permanente)' };
  }

  // 9c. CONTINENTAL NORTH AMERICA & GREENLAND
  if (lat >= 59.5 && lat <= 83.7 && normLon >= -73.0 && normLon <= -11.0) {
    return { timeZoneId: 'America/Nuuk', locationName: 'Nuuk, Groenlândia (UTC-2 / UTC-1)' };
  }
  if (lat >= 24 && lat <= 72 && normLon >= -170 && normLon <= -52) {
    if (lat >= 52 && normLon <= -130) {
      return { timeZoneId: 'America/Anchorage', locationName: 'Alasca, USA (UTC-9)' };
    }
    if (normLon <= -114.5) {
      return { timeZoneId: 'America/Los_Angeles', locationName: 'Pacífico / Califórnia, USA (UTC-8)' };
    }
    if (normLon <= -102.0) {
      if (lat >= 31.3 && lat <= 37.0 && normLon >= -114.8 && normLon <= -109.0) {
        return { timeZoneId: 'America/Phoenix', locationName: 'Arizona, USA (UTC-7 Fixo)' };
      }
      return { timeZoneId: 'America/Denver', locationName: 'Montanhas Rochosas / Denver, USA (UTC-7)' };
    }
    if (normLon <= -85.5) {
      return { timeZoneId: 'America/Chicago', locationName: 'Central / Chicago, USA (UTC-6)' };
    }
    return { timeZoneId: 'America/New_York', locationName: 'Leste / Nova York, USA (UTC-5)' };
  }

  // 10. EUROPE, MOROCCO & LEVANT
  if (lat >= 27.6 && lat <= 36.0 && normLon >= -13.2 && normLon <= -1.0) {
    return { timeZoneId: 'Africa/Casablanca', locationName: 'Casablanca / Rabat, Marrocos (UTC+1 / Ramadã UTC+0)' };
  }
  if (lat >= 33.0 && lat <= 34.7 && normLon >= 35.0 && normLon <= 36.7) {
    return { timeZoneId: 'Asia/Beirut', locationName: 'Beirute, Líbano (UTC+2 / UTC+3)' };
  }
  if (lat >= 35 && lat <= 72 && normLon >= -25 && normLon <= 45) {
    if (lat >= 36.8 && lat <= 42.2 && normLon >= -9.6 && normLon <= -6.2) {
      return { timeZoneId: 'Europe/Lisbon', locationName: 'Lisboa, Portugal (UTC+0 / UTC+1)' };
    }
    if (normLon <= -5.0 || (lat >= 50 && lat <= 60 && normLon <= 2.0)) {
      if (normLon <= -13.0 && lat >= 63.0) {
        return { timeZoneId: 'Atlantic/Reykjavik', locationName: 'Reykjavik, Islândia (UTC+0 Fixo)' };
      }
      return { timeZoneId: 'Europe/London', locationName: 'Londres / Reino Unido / Irlanda (UTC+0)' };
    }
    if (normLon <= 16.0) {
      return { timeZoneId: 'Europe/Paris', locationName: 'Paris / Berlim / Madri / Roma (UTC+1)' };
    }
    if (normLon <= 32.0) {
      return { timeZoneId: 'Europe/Athens', locationName: 'Atenas / Helsinque / Bucareste (UTC+2)' };
    }
    return { timeZoneId: 'Europe/Moscow', locationName: 'Moscou, Rússia (UTC+3)' };
  }

  // 11. EAST ASIA (China, Japan, Korea)
  if (lat >= 18 && lat <= 54 && normLon >= 73 && normLon <= 135) {
    if (normLon >= 129 && lat >= 30 && lat <= 46) {
      return { timeZoneId: 'Asia/Tokyo', locationName: 'Tóquio, Japão (UTC+9)' };
    }
    if (normLon >= 124 && normLon <= 130 && lat >= 33 && lat <= 39) {
      return { timeZoneId: 'Asia/Seoul', locationName: 'Seul, Coreia do Sul (UTC+9)' };
    }
    return { timeZoneId: 'Asia/Shanghai', locationName: 'Pequim / Xangai, China (UTC+8)' };
  }

  // 12. Nearest NOAA location match (from comprehensive 40+ global stations)
  let bestLoc = NOAA_LOCATIONS[0];
  let minDistance = Infinity;

  for (const loc of NOAA_LOCATIONS) {
    const dist = haversineDistanceKm(lat, normLon, loc.latitude, loc.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      bestLoc = loc;
    }
  }

  // If reasonably close to a known NOAA station (< 1800 km)
  if (minDistance < 1800) {
    return {
      timeZoneId: bestLoc.timeZoneId,
      locationName: `${bestLoc.name}, ${bestLoc.country}`,
    };
  }

  // 13. Nautical / Solar Meridian Zone (15° standard width for oceans / remote territories)
  const standardOffset = Math.max(-12, Math.min(14, Math.round(normLon / 15)));
  let nauticalIana = 'Etc/GMT';
  if (standardOffset > 0) {
    nauticalIana = `Etc/GMT-${standardOffset}`;
  } else if (standardOffset < 0) {
    nauticalIana = `Etc/GMT+${Math.abs(standardOffset)}`;
  }

  const sign = standardOffset >= 0 ? '+' : '';
  return {
    timeZoneId: nauticalIana,
    locationName: `Meridiano Solar NOAA (UTC${sign}${standardOffset})`,
  };
}

/**
 * Resolves the full timezone information for any location and date in the world:
 * Combines client-side NOAA database and Google Maps Platform Timezone API.
 */
export async function resolveNoaaTimezoneForLocation(
  lat: number,
  lon: number,
  date: Date
): Promise<ResolvedTimezone> {
  // 1. Instant baseline resolution via NOAA classifier
  const baseline = classifyNoaaTimezone(lat, lon);
  const baselineHistorical = getHistoricalTimezoneOffset(baseline.timeZoneId, date);

  const result: ResolvedTimezone = {
    timeZoneId: baseline.timeZoneId,
    offsetHours: baselineHistorical.offsetHours,
    isDst: baselineHistorical.isDst,
    timezoneAbbrev: baselineHistorical.timezoneAbbrev,
    source: 'noaa_regional',
    locationName: baseline.locationName,
  };

  // 2. Query Google Maps Time Zone API for micro-boundary precision if available
  try {
    const gData = await fetchGoogleTimeZone(lat, lon, date);
    if (gData && gData.status === 'OK' && gData.timeZoneId) {
      const totalOffsetSec = gData.rawOffset + gData.dstOffset;
      const offsetHours = totalOffsetSec / 3600;
      return {
        timeZoneId: gData.timeZoneId,
        offsetHours,
        isDst: gData.dstOffset > 0,
        timezoneAbbrev: gData.timeZoneName || baselineHistorical.timezoneAbbrev,
        source: 'google',
        locationName: baseline.locationName,
      };
    }
  } catch (err) {
    console.warn('Google Timezone API lookup skipped, using NOAA classifier:', err);
  }

  return result;
}
