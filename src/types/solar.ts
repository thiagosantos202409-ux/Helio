/**
 * Solar Calculation Engine & Simulation Types
 */

export type LandscapeSceneType = 'default' | 'city_cars' | 'city_people' | 'city_real' | 'farm' | 'solar_time';

export type SolarClockVersion =
  | 'floor_horizontal'
  | 'wall_vertical_90'
  | 'wall_tilted_675'
  | 'wall_tilted_45';

export type WorldVisualStyle = 'real_life' | 'gta_vice_city' | 'local_city';

export const GTA_VICE_CITY_PROMPT =
  'GTA Vice City daytime color grading, 1980s Miami sunny aesthetic, vibrant tropical daylight, turquoise and cyan blue sky, warm golden sun highlights, pastel pink and coral accents, cool teal shadows, soft dreamy bloom effect, nostalgic 1986 retro atmosphere, 35mm film grain, glossy reflections, high vibrance.';

export type RealCityVehicleMode = 'walk' | 'drone' | 'plane' | 'car';

export const PLANE_MIN_CEILING_M = 50;
export const PLANE_MAX_CEILING_M = 11000; // Máximo absoluto: 11 km (11.000 m)
export const PLANE_DEFAULT_CEILING_M = 500;

export interface RealCityBuilding {
  id: string;
  name?: string;
  polygon: Array<[number, number]>;
  height: number;
  levels: number;
  styleIdx: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cx: number;
  cz: number;
}

export interface RealCityRoad {
  id: string;
  points: Array<[number, number]>;
  width: number;
  kind: string;
}

export interface RealCityPolygonFeature {
  id: string;
  polygon: Array<[number, number]>;
}

export interface RealCityData {
  cityName: string;
  country: string;
  latitude: number;
  longitude: number;
  source: 'osm' | 'adapted';
  buildings: RealCityBuilding[];
  roads: RealCityRoad[];
  parks: RealCityPolygonFeature[];
  waters: RealCityPolygonFeature[];
  spawnPoint: [number, number];
}

export interface RealCitySearchResult {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  country: string;
  region?: 'Brasil' | 'Américas' | 'Europa' | 'África & Oriente' | 'Ásia' | 'Oceania';
}

export type PlaneTravelSpeedMode = 'city' | 'regional' | 'global';

export type PlaneFlightTimeUnit = 'seconds' | 'minutes' | 'hours';

export const PLANE_MIN_FLIGHT_DURATION_SEC = 1; // Mínimo: 1 segundo
export const PLANE_MAX_FLIGHT_DURATION_SEC = 24 * 60 * 60; // Máximo: 24 horas (86.400 s)
export const PLANE_DEFAULT_FLIGHT_DURATION_SEC = 4;

export interface PlaneFlightPlan {
  id: number;
  active: boolean;
  originName: string;
  originLat: number;
  originLng: number;
  destName: string;
  destCountry: string;
  destLat: number;
  destLng: number;
  totalDistanceKm: number;
  bearingDeg: number;
  durationSec: number;
  /** Horário do Voo em UTC+0 (Zulu): instante de decolagem em epoch ms */
  departureUtcMs: number;
  /** Horário previsto de pouso em UTC+0 (Zulu) em epoch ms */
  estimatedArrivalUtcMs: number;
}

export interface RealCityTelemetry {
  vehicleMode: RealCityVehicleMode;
  altitudeM: number;
  speedKmh: number;
  onBuildingName: string | null;
  nearestBuildingName: string | null;
  nearestBuildingHeight: number | null;
  nearestBuildingDist: number | null;
  liveLat?: number;
  liveLng?: number;
  flightProgress?: number | null;
  flightDestName?: string | null;
  flightRemainingKm?: number | null;
  flightRemainingSec?: number | null;
}

export interface DroneCameraTelemetry {
  altitudeM: number;
  speedKmh: number;
  headingDeg: number;
  pitchDeg: number;
}

export type TimezoneSystemMode =
  | 'noaa_official'        // Fuso Oficial Político NOAA / IANA (com regras históricas e DST)
  | 'cuba_havana'          // Fuso de Cuba (America/Havana: CST UTC-5 / CDT UTC-4 troca 00:00 + hist. 2004-2006)
  | 'us_eastern_dst'       // Padrão EUA Leste (America/New_York: EST/EDT UTC-5/-4 troca 02:00)
  | 'cancun_fixed'         // Caribe / Cancún Fixo (America/Cancun: UTC-5 permanente sem DST)
  | 'eu_london_dst'        // Calendário União Europeia (Europe/London: UTC+0/+1 último dom Mar->Out)
  | 'morocco_ramadan'      // Calendário Marrocos / Ramadã (Africa/Casablanca: UTC+1 c/ pausa UTC+0 no Ramadã)
  | 'egypt_dst'            // Calendário do Egito (Africa/Cairo: UTC+2/+3 última sex Abr->última qui Out)
  | 'israel_dst'           // Calendário de Israel (Asia/Jerusalem: UTC+2/+3 calendário hebraico)
  | 'chile_austral_dst'    // Verão Austral / Chile (America/Santiago: UTC-4/-3 Set->Abr Hemisfério Sul)
  | 'lord_howe_30m'        // Salto 30 min Lord Howe (Australia/Lord_Howe: UTC+10:30/+11 salto de 30m)
  | 'railway_standard'     // Horário Padrão Ferroviário / Inverno Fixo (sem DST sazonal)
  | 'permanent_dst'        // Horário de Verão Permanente (+1h fixo sobre o padrão local)
  | 'solar_lst'            // Tempo Solar Verdadeiro Local (LST - Zênite/Meio-dia sempre às 12:00)
  | 'lmt_mean'             // Tempo Solar Médio Local (LMT - longitude pura pré-1883 sem EoT)
  | 'noaa_nautical'        // Fuso Náutico Geográfico NOAA (Faixas puras de 15°)
  | 'military_nato'        // Sistema Militar / Aviação NATO (Letras Alfa a Zulu)
  | 'utc_standard'         // Tempo Universal Coordenado (UTC+0 / GMT)
  | 'tai_atomic'           // Tempo Atômico Internacional (TAI = UTC + 37s)
  | 'terrestrial_time_tt'  // Tempo Terrestre / Efemérides NASA (TT = UTC + 69.184s)
  | 'swatch_beats'         // Swatch Internet Time (.beats @000–@999 em BMT UTC+1)
  | 'sidereal_time'        // Tempo Sideral Local (LMST - Relógio das Estrelas 23h56m)
  | 'french_decimal'       // Tempo Decimal Revolucionário Francês (10h/dia de 100m/100s)
  | 'manual_custom';       // Fuso Manual / Personalizado (+/- horas)

export interface DstTransitionInfo {
  hasTransition: boolean;
  transitionUtcDate?: Date;
  transitionLocalDateFormatted?: string;
  transitionLocalTimeFormatted?: string;
  oldOffsetHours?: number;
  newOffsetHours?: number;
  deltaMinutes?: number;
  directionLabel?: string;
}

export interface SolarInputParameters {
  /** UTC Reference Timestamp in milliseconds or Date object */
  referenceDate: Date;
  /** Observer Latitude in degrees (phi: -90 to +90) */
  latitude: number;
  /** Observer Longitude in degrees (lambda: -180 to +180) */
  longitude: number;
  /** Arbitrary or Calculated Civil Timezone Offset in hours (e.g. -3.0, +5.5, +3.75, +14.0) */
  civilTimezoneOffset: number;
  /** IANA / NOAA Timezone Identifier (e.g. 'America/Sao_Paulo', 'Europe/London') */
  timeZoneId?: string;
  /** Which timezone system governs the civil time (NOAA Official, Solar LST, Nautical 15°, UTC, Custom) */
  timezoneSystemMode?: TimezoneSystemMode;
  /** Whether to automatically resolve historical timezone offset for the target date */
  autoHistoricalTimezone: boolean;
  /** Planetary Orbital Axial Tilt in degrees (Default: 23.44° for Earth) */
  axialTilt: number;
  /** Game Time Speed Multiplier (1x = real time, 60x = 1 sec is 1 min, 1440x = 1 sec is 24 hrs) */
  gameTimeSpeed: number;
}

export interface SolarUpdateOptions {
  /** Mantém o mesmo horário UTC, fuso e sistema ativo ao mudar apenas as coordenadas tocando no mapa */
  preserveTimezone?: boolean;
}

export interface Solar3DVector {
  x: number;
  y: number;
  z: number;
}

export interface HistoricalTimezoneDetails {
  timeZoneId: string;
  offsetHours: number;
  isDst: boolean;
  timezoneAbbrev: string;
  timezoneFullName?: string;
  timezonePronunciation?: string;
  isAutoApplied: boolean;
}

export interface SolarCalculationResult {
  /** Day of Year (1.0 to 365.25 or 366.25) */
  dayOfYear: number;
  /** Fractional UTC hour (0.0 to 23.999...) */
  utcHourFraction: number;
  /** Fractional Local Civil hour (0.0 to 23.999...) */
  localCivilHourFraction: number;
  
  /** Active Timezone System mode and descriptive name */
  timezoneSystemMode: TimezoneSystemMode;
  timezoneSystemDescription: string;
  /** Optional formatted clock for non-sexagesimal or specialized systems (e.g. @542 .beats, 10h Decimal, LMST) */
  specialClockDisplay?: string;

  /** Historical Timezone details computed for the specific reference date */
  historicalTimezoneInfo?: HistoricalTimezoneDetails;
  
  /** 1. Equation of Time (EoT) in Minutes */
  equationOfTimeMinutes: number;
  
  /** 2. True Solar Time UTC (TST UTC) in Minutes (0 to 1440) */
  tstUtcMinutes: number;
  /** TST UTC formatted string (HH:MM:SS) */
  tstUtcFormatted: string;
  
  /** 3. Local Civil Time & Local Solar Time (LST Local) */
  localCivilTimeDate: Date;
  localCivilTimeFormatted: string;
  lstLocalMinutes: number;
  lstLocalFormatted: string;
  
  /** 4. Solar Noon in UTC (minutes from UTC midnight) */
  solarNoonUtcMinutes: number;
  solarNoonUtcFormatted: string;
  solarNoonLocalFormatted: string;
  
  /** Sunrise & Sunset (Local Civil Time strings) */
  sunriseLocalFormatted: string;
  sunsetLocalFormatted: string;
  daylightDurationHours: number;
  
  /** 5. 3D Solar Orientation */
  /** Solar Declination angle in degrees */
  declinationDeg: number;
  /** Subsolar point longitude (-180 to +180) */
  subsolarLongitude: number;
  /** Subsolar point latitude (-90 to +90) */
  subsolarLatitude: number;
  /** Hour Angle (HA) in degrees */
  hourAngleDeg: number;
  /** Solar Altitude angle above horizon in degrees (-90 to +90) */
  solarAltitudeDeg: number;
  /** Solar Zenith angle from zenith overhead in degrees (90 - Altitude) */
  solarZenithDeg: number;
  /** Solar Azimuth angle from North clockwise in degrees (0 to 360) */
  solarAzimuthDeg: number;
  
  /** Directional Light Vector for Game Engine (Three.js coordinates) */
  lightVector3D: Solar3DVector;
  
  /** Atmospheric Lighting State */
  twilightPhase: 'Daytime' | 'Golden Hour' | 'Civil Twilight' | 'Nautical Twilight' | 'Astronomical Twilight' | 'Night';
  sunColorHex: string;
  sunIntensity: number;
  skyColorHex: string;
  horizonColorHex: string;
  sunHorizonGlowColorHex: string;
  sunHorizonIntensity: number;
  starsIntensity: number;
  beltOfVenusIntensity: number;
  isSunAboveHorizon: boolean;

  /** Astronomical Season for observer hemisphere */
  seasonInfo: SeasonInfo;
}

export type AstronomicalSeasonName =
  | 'Primavera'
  | 'Verão'
  | 'Outono'
  | 'Inverno'
  | 'Equinócio Permanente';

export interface NextSeasonTransition {
  eventName: string;
  nextSeasonName: AstronomicalSeasonName;
  nextNorthSeason: AstronomicalSeasonName;
  nextSouthSeason: AstronomicalSeasonName;
  transitionUtcDate: Date;
  transitionUtcFormatted: string;
  transitionLocalDateFormatted: string; // DD-MM-YYYY
  transitionLocalTimeFormatted: string; // HH:MM:SS
  transitionOffsetHours: number;
}

export interface SeasonInfo {
  seasonName: AstronomicalSeasonName;
  hemisphereLabel: 'Hemisfério Norte (LAT +)' | 'Hemisfério Sul (LAT -)' | 'Linha do Equador (0°)';
  solarMotionLabel: string;
  northHemisphereSeason: AstronomicalSeasonName;
  southHemisphereSeason: AstronomicalSeasonName;
  nextTransition: NextSeasonTransition;
}

export interface HistoricalRule {
  period: string;
  ruleDescription: string;
  offsetLabel: string;
}

export interface NOAALocation {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timeZoneId: string;
  standardTimezoneOffset: number;
  dstTimezoneOffset?: number;
  hasDst: boolean;
  dstDescription?: string;
  historicalNotes: string;
  historicalTimeline: HistoricalRule[];
  flagEmoji: string;
}

export interface FormulaStepDetails {
  title: string;
  formulaRaw: string;
  formulaEvaluated: string;
  variables: Record<string, number | string>;
  description: string;
}
