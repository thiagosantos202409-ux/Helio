import { NOAA_LOCATIONS } from '../data/noaaLocations';
import { WORLD_CITY_PRESETS } from './realCityService';

export interface LocalCityVisualProfile {
  cityName: string;
  countryLabel: string;
  climateZoneLabel: string;
  latLonLabel: string;
  promptText: string;
  skyTopTintHex: number;
  skyTopBlend: number;
  horizonTintHex: number;
  horizonBlend: number;
  sunTintHex: number;
  sunTintBlend: number;
  sunIntensityMult: number;
  shadowBounceHex: number;
  hemiIntensityMult: number;
  envIntensityMult: number;
  fogDensityOffset: number;
  exposureOffset: number;
}

const TIMEZONE_CITY_LABELS: Record<string, { city: string; country: string }> = {
  'America/Sao_Paulo': { city: 'São Paulo', country: 'Brasil' },
  'America/Recife': { city: 'Recife', country: 'Brasil' },
  'America/Bahia': { city: 'Salvador', country: 'Brasil' },
  'America/Belem': { city: 'Belém', country: 'Brasil' },
  'America/Santarem': { city: 'Altamira / Oeste Paraense', country: 'Brasil' },
  'America/Araguaina': { city: 'Palmas / Araguaína', country: 'Brasil' },
  'America/Manaus': { city: 'Manaus', country: 'Brasil' },
  'America/Cuiaba': { city: 'Cuiabá', country: 'Brasil' },
  'America/Campo_Grande': { city: 'Campo Grande', country: 'Brasil' },
  'America/Rio_Branco': { city: 'Rio Branco', country: 'Brasil' },
  'America/Noronha': { city: 'Fernando de Noronha', country: 'Brasil' },
  'America/Havana': { city: 'Havana', country: 'Cuba' },
  'America/New_York': { city: 'Nova York', country: 'EUA' },
  'Europe/London': { city: 'Londres', country: 'Reino Unido' },
  'Europe/Paris': { city: 'Paris', country: 'França' },
  'Asia/Tokyo': { city: 'Tóquio', country: 'Japão' },
  'Asia/Dubai': { city: 'Dubai', country: 'Emirados Árabes' },
  'Africa/Cairo': { city: 'Cairo', country: 'Egito' },
  'Australia/Sydney': { city: 'Sydney', country: 'Austrália' },
};

function formatLatLon(lat: number, lon: number): string {
  const latStr = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'L' : 'O'}`;
  return `${latStr}, ${lonStr}`;
}

export function resolveLocalCityName(
  latitude: number,
  longitude: number,
  timeZoneId?: string,
  loadedCityName?: string | null
): { cityName: string; countryLabel: string } {
  if (loadedCityName && loadedCityName.trim() && !loadedCityName.startsWith('Local (')) {
    const parts = loadedCityName.split(',').map((s) => s.trim());
    return {
      cityName: parts[0],
      countryLabel: parts.slice(1).join(', ') || 'Local Ativo',
    };
  }

  // 1. Check nearest World City Preset or NOAA Station (within ~1.6 deg)
  let bestDist = Infinity;
  let bestCity = '';
  let bestCountry = '';

  for (const preset of WORLD_CITY_PRESETS) {
    const d = Math.hypot(preset.lat - latitude, preset.lng - longitude);
    if (d < bestDist) {
      bestDist = d;
      bestCity = preset.name;
      bestCountry = preset.country || '';
    }
  }

  for (const loc of NOAA_LOCATIONS) {
    const d = Math.hypot(loc.latitude - latitude, loc.longitude - longitude);
    if (d < bestDist) {
      bestDist = d;
      bestCity = loc.name;
      bestCountry = loc.country;
    }
  }

  if (bestDist <= 1.6 && bestCity) {
    return { cityName: bestCity, countryLabel: bestCountry || 'Local Próximo' };
  }

  // 2. Check Timezone IANA dictionary
  if (timeZoneId && TIMEZONE_CITY_LABELS[timeZoneId]) {
    const mapped = TIMEZONE_CITY_LABELS[timeZoneId];
    return { cityName: mapped.city, countryLabel: mapped.country };
  }

  if (timeZoneId && timeZoneId.includes('/') && !timeZoneId.startsWith('Etc/') && !timeZoneId.startsWith('NATO/')) {
    const tail = timeZoneId.split('/').pop()!.replace(/_/g, ' ');
    const region = timeZoneId.split('/')[0];
    return { cityName: tail, countryLabel: region };
  }

  return {
    cityName: `Cidade Local (${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°)`,
    countryLabel: 'Coordenadas Ativas',
  };
}

function classifyClimateZone(
  latitude: number,
  longitude: number,
  cityName: string
):
  | 'equatorial_rainforest'
  | 'tropical_coastal'
  | 'arid_desert'
  | 'subpolar_highlat'
  | 'urban_metropolis' {
  const absLat = Math.abs(latitude);
  const nameLow = cityName.toLowerCase();

  if (absLat >= 54) {
    return 'subpolar_highlat';
  }

  // Known arid belts (Sahara/Arabia/Gobi/Atacama/US Southwest/Central Australia)
  const isSaharaArabia = latitude >= 14 && latitude <= 34 && longitude >= -16 && longitude <= 62;
  const isSouthWestUs = latitude >= 24 && latitude <= 37 && longitude >= -117 && longitude <= -103;
  const isOutback = latitude <= -19 && latitude >= -31 && longitude >= 116 && longitude <= 142;
  const isAridName = /cairo|dubai|riyadh|phoenix|las vegas|lima|antofagasta/.test(nameLow);
  if (isSaharaArabia || isSouthWestUs || isOutback || isAridName) {
    return 'arid_desert';
  }

  // Tropical Coastal / Maritime cities
  const isCoastalName =
    /recife|salvador|rio|fortaleza|natal|maceió|florianópolis|havana|miami|honolulu|singapur|cancún|caribe|noronha|sydney/.test(
      nameLow
    );
  if (isCoastalName) {
    return 'tropical_coastal';
  }

  // Equatorial Humid / Rainforest belt (Amazon, Congo, SE Asia)
  const isAmazonia = latitude >= -10 && latitude <= 6 && longitude >= -75 && longitude <= -44;
  const isCongoOrIndonesia =
    absLat <= 8.5 && ((longitude >= 9 && longitude <= 31) || (longitude >= 95 && longitude <= 142));
  if (isAmazonia || isCongoOrIndonesia || /manaus|belém|altamira|santarém|rio branco/.test(nameLow)) {
    return 'equatorial_rainforest';
  }

  if (absLat <= 22) {
    return 'tropical_coastal';
  }

  return 'urban_metropolis';
}

export function resolveLocalCityVisualProfile(
  latitude: number,
  longitude: number,
  timeZoneId?: string,
  loadedCityName?: string | null
): LocalCityVisualProfile {
  const { cityName, countryLabel } = resolveLocalCityName(
    latitude,
    longitude,
    timeZoneId,
    loadedCityName
  );
  const latLonLabel = formatLatLon(latitude, longitude);
  const climate = classifyClimateZone(latitude, longitude, cityName);

  switch (climate) {
    case 'equatorial_rainforest':
      return {
        cityName,
        countryLabel,
        climateZoneLabel: 'Equatorial Úmido',
        latLonLabel,
        promptText: `${cityName} (${latLonLabel}) local daylight atmosphere, humid equatorial rainforest airmass, luminous zenith tropical sun, emerald foliage ambient bounce, soft river-valley mist horizon, realistic humid urban & nature shadows.`,
        skyTopTintHex: 0x1680cc,
        skyTopBlend: 0.28,
        horizonTintHex: 0x9fe6c8,
        horizonBlend: 0.22,
        sunTintHex: 0xfff5d6,
        sunTintBlend: 0.16,
        sunIntensityMult: 1.08,
        shadowBounceHex: 0x1f4738,
        hemiIntensityMult: 1.12,
        envIntensityMult: 1.06,
        fogDensityOffset: 0.0005,
        exposureOffset: 0.03,
      };

    case 'tropical_coastal':
      return {
        cityName,
        countryLabel,
        climateZoneLabel: 'Tropical Costeiro',
        latLonLabel,
        promptText: `${cityName} (${latLonLabel}) coastal tropical daylight, crystal Atlantic/oceanic cerulean sky, bright sea-breeze air clarity, crisp warm sun highlights, coastal limestone & water reflections, balanced natural ocean-tint shadows.`,
        skyTopTintHex: 0x0a84e0,
        skyTopBlend: 0.34,
        horizonTintHex: 0xaee6ff,
        horizonBlend: 0.25,
        sunTintHex: 0xfff1cc,
        sunTintBlend: 0.18,
        sunIntensityMult: 1.12,
        shadowBounceHex: 0x244c5c,
        hemiIntensityMult: 1.1,
        envIntensityMult: 1.16,
        fogDensityOffset: -0.0002,
        exposureOffset: 0.04,
      };

    case 'arid_desert':
      return {
        cityName,
        countryLabel,
        climateZoneLabel: 'Árido / Desértico',
        latLonLabel,
        promptText: `${cityName} (${latLonLabel}) arid desert daylight, deep dry cobalt sky, warm golden-ochre dust horizon scattering, intense crisp zenith sunlight, sandstone warm ambient bounce, sharp desert shadows.`,
        skyTopTintHex: 0x1a56b8,
        skyTopBlend: 0.24,
        horizonTintHex: 0xf4cf8b,
        horizonBlend: 0.32,
        sunTintHex: 0xffe4ad,
        sunTintBlend: 0.24,
        sunIntensityMult: 1.16,
        shadowBounceHex: 0x5c4630,
        hemiIntensityMult: 1.04,
        envIntensityMult: 1.05,
        fogDensityOffset: 0.0007,
        exposureOffset: 0.02,
      };

    case 'subpolar_highlat':
      return {
        cityName,
        countryLabel,
        climateZoneLabel: 'Alta Latitude / Subpolar',
        latLonLabel,
        promptText: `${cityName} (${latLonLabel}) crisp subpolar daylight, low-aerosol northern cobalt blue sky, cool glacial horizon mist, oblique silver-gold sun grazing highlights, clean cool-slate shadows, ultra-high atmospheric clarity.`,
        skyTopTintHex: 0x1e4fb8,
        skyTopBlend: 0.25,
        horizonTintHex: 0xd8ecff,
        horizonBlend: 0.22,
        sunTintHex: 0xfff6e5,
        sunTintBlend: 0.14,
        sunIntensityMult: 1.03,
        shadowBounceHex: 0x1e354f,
        hemiIntensityMult: 1.08,
        envIntensityMult: 1.1,
        fogDensityOffset: -0.0007,
        exposureOffset: 0.03,
      };

    case 'urban_metropolis':
    default:
      return {
        cityName,
        countryLabel,
        climateZoneLabel: 'Urbano Metropolitano',
        latLonLabel,
        promptText: `${cityName} (${latLonLabel}) real-world city daylight, authentic urban aerosol horizon scattering, calibrated architectural glass & concrete reflections, balanced solar contrast, realistic cool steel-slate urban shadow bounce.`,
        skyTopTintHex: 0x266dc4,
        skyTopBlend: 0.2,
        horizonTintHex: 0xd4dde8,
        horizonBlend: 0.22,
        sunTintHex: 0xfff3d9,
        sunTintBlend: 0.14,
        sunIntensityMult: 1.06,
        shadowBounceHex: 0x2b3b4e,
        hemiIntensityMult: 1.06,
        envIntensityMult: 1.14,
        fogDensityOffset: 0.0003,
        exposureOffset: 0.02,
      };
  }
}
