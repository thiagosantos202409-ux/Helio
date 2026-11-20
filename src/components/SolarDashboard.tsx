import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sun,
  Globe,
  Compass,
  Clock,
  MapPin,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Maximize2,
  BookOpen,
  Sliders,
  Send,
  Layers,
  CheckCircle2,
  AlertCircle,
  Calendar,
  History,
  Zap,
  Eye,
  Camera,
  Compass as OrbitIcon,
  Orbit,
  ExternalLink,
  Search,
  Building2,
  Lightbulb,
  Trees,
  Footprints,
  Car,
  Users,
  Tractor,
  Plane,
  Navigation,
  ArrowUp,
  ArrowDown,
  Loader2,
  Copy,
  Check,
  FileText,
  Volume2,
} from 'lucide-react';
import {
  SolarCalculationResult,
  SolarInputParameters,
  NOAALocation,
  LandscapeSceneType,
  SolarClockVersion,
  WorldVisualStyle,
  GTA_VICE_CITY_PROMPT,
  RealCityData,
  RealCityVehicleMode,
  RealCityTelemetry,
  RealCitySearchResult,
  DroneCameraTelemetry,
  PLANE_MIN_CEILING_M,
  PLANE_MAX_CEILING_M,
  PLANE_DEFAULT_CEILING_M,
  PLANE_MIN_FLIGHT_DURATION_SEC,
  PLANE_MAX_FLIGHT_DURATION_SEC,
  PLANE_DEFAULT_FLIGHT_DURATION_SEC,
  PlaneFlightTimeUnit,
  PlaneTravelSpeedMode,
  PlaneFlightPlan,
  SolarUpdateOptions,
} from '../types/solar';
import { CameraPreset, PersonMoveInput } from './SolarWorld3D';
import { TrafficSignalState, SignalColor } from './CitySceneBuilder';
import { getFormulaStepBreakdown, getHistoricalTimezoneOffset, findNextDstTransition } from '../engine/solarEngine';
import { NOAA_LOCATIONS } from '../data/noaaLocations';
import {
  ALL_TIMEZONE_SYSTEMS,
  TIMEZONE_SYSTEM_CATEGORIES,
  TimezoneSystemCategory,
} from '../data/timezoneSystems';
import { COMPUTER_TZ_STATS } from '../data/ianaComputerTimezones';
import { searchWorldCities, WORLD_CITY_PRESETS, haversineDistanceKm } from '../services/realCityService';
import { askGeminiSolarAdvisor } from '../engine/geminiAdvisor';
import { GoogleMapsSolarView } from './GoogleMapsSolarView';
import { TimezoneChangeModal } from './TimezoneChangeModal';
import { APP_MASTER_PROMPT } from '../data/appMasterPrompt';
import { getTimezonePronunciation, speakTimezonePronunciation } from '../data/timezonePronunciations';
import { resolveLocalCityVisualProfile } from '../services/localCityVisualService';
import { RealCityGlobalMap } from './RealCityGlobalMap';

interface SolarDashboardProps {
  solarParams: SolarInputParameters;
  solarResults: SolarCalculationResult;
  onUpdateParams: (newParams: Partial<SolarInputParameters>, options?: SolarUpdateOptions) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  viewMode: 'landscape' | 'globe';
  onChangeViewMode: (mode: 'landscape' | 'globe') => void;
  sceneTheme: LandscapeSceneType;
  onChangeSceneTheme: (theme: LandscapeSceneType) => void;
  solarClockVersion?: SolarClockVersion;
  onChangeSolarClockVersion?: (version: SolarClockVersion) => void;
  solarWallAzimuthDeg?: number | null;
  onChangeSolarWallAzimuthDeg?: (azDeg: number | null) => void;
  solarFloorAzimuthDeg?: number;
  onChangeSolarFloorAzimuthDeg?: (azDeg: number) => void;
  visualStyle?: WorldVisualStyle;
  onChangeVisualStyle?: (style: WorldVisualStyle) => void;
  cameraPreset: CameraPreset;
  onChangeCameraPreset: (preset: CameraPreset) => void;
  showVectors: boolean;
  onToggleVectors: () => void;
  onResetTime: () => void;
  onJumpToEvent: (eventType: 'sunrise' | 'noon' | 'sunset' | 'now') => void;
  personMoveRef?: React.MutableRefObject<PersonMoveInput>;
  trafficSignal?: TrafficSignalState;
  mapsApiKey?: string;
  realCityData?: RealCityData | null;
  realCityLoading?: boolean;
  realCityVehicleMode?: RealCityVehicleMode;
  onChangeRealCityVehicleMode?: (mode: RealCityVehicleMode) => void;
  planeMaxAltitudeM?: number;
  onChangePlaneMaxAltitudeM?: (altM: number) => void;
  planeTravelSpeedMode?: PlaneTravelSpeedMode;
  onChangePlaneTravelSpeedMode?: (mode: PlaneTravelSpeedMode) => void;
  planeFlightDurationSec?: number;
  onChangePlaneFlightDurationSec?: (sec: number) => void;
  planeFlightPlan?: PlaneFlightPlan | null;
  onStartGlobalPlaneFlight?: (lat: number, lng: number, cityName?: string, country?: string) => void;
  onCancelGlobalPlaneFlight?: () => void;
  realCityTelemetry?: RealCityTelemetry;
  droneTelemetry?: DroneCameraTelemetry;
  onLoadRealCity?: (lat: number, lng: number, cityName?: string, country?: string, syncCoordinates?: boolean) => void;
  realCityActionRef?: React.MutableRefObject<{ action: 'climb_nearest' | 'descend' | null }>;
}

export const SolarDashboard: React.FC<SolarDashboardProps> = ({
  solarParams,
  solarResults,
  onUpdateParams,
  isPlaying,
  onTogglePlay,
  viewMode,
  onChangeViewMode,
  sceneTheme,
  onChangeSceneTheme,
  solarClockVersion = 'floor_horizontal',
  onChangeSolarClockVersion,
  solarWallAzimuthDeg = null,
  onChangeSolarWallAzimuthDeg,
  solarFloorAzimuthDeg = 0,
  onChangeSolarFloorAzimuthDeg,
  visualStyle = 'real_life',
  onChangeVisualStyle,
  cameraPreset,
  onChangeCameraPreset,
  showVectors,
  onToggleVectors,
  onResetTime,
  onJumpToEvent,
  personMoveRef,
  trafficSignal = { ew: 'green', ns: 'red' },
  mapsApiKey,
  realCityData,
  realCityLoading = false,
  realCityVehicleMode = 'walk',
  onChangeRealCityVehicleMode,
  planeMaxAltitudeM = PLANE_DEFAULT_CEILING_M,
  onChangePlaneMaxAltitudeM,
  planeTravelSpeedMode = 'city',
  onChangePlaneTravelSpeedMode,
  planeFlightDurationSec = PLANE_DEFAULT_FLIGHT_DURATION_SEC,
  onChangePlaneFlightDurationSec,
  planeFlightPlan = null,
  onStartGlobalPlaneFlight,
  onCancelGlobalPlaneFlight,
  realCityTelemetry,
  droneTelemetry,
  onLoadRealCity,
  realCityActionRef,
}) => {
  const [activeTab, setActiveTab] = useState<'sim' | 'maps' | 'formulas' | 'noaa' | 'ai'>('sim');
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const [isTimezoneModalOpen, setIsTimezoneModalOpen] = useState(false);
  const [timezoneModalTab, setTimezoneModalTab] = useState<'systems' | 'same_utc' | 'all_zones' | 'manual'>('systems');

  // Text inputs state for Date DD/MM/YYYY, Time HH:MM:SS and UTC Offset +/-
  const [dateTextInput, setDateTextInput] = useState('01/01/2027');
  const [timeTextInput, setTimeTextInput] = useState('12:00:00');
  const [utcOffsetTextInput, setUtcOffsetTextInput] = useState('-3.0');

  // Gemini AI Chat state
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiSources, setAiSources] = useState<Array<{ title: string; url: string }>>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Selected location preset & timezone category filter
  const [selectedLocationId, setSelectedLocationId] = useState<string>('greenwich');
  const [dockTzCategory, setDockTzCategory] = useState<'all' | TimezoneSystemCategory>('all');

  // Cidade Real world search & global map state
  const [realCityQuery, setRealCityQuery] = useState('');
  const [realCitySearching, setRealCitySearching] = useState(false);
  const [realCityResults, setRealCityResults] = useState<RealCitySearchResult[]>([]);
  const [isRealCityGlobalMapOpen, setIsRealCityGlobalMapOpen] = useState(false);
  const [realCityRegionFilter, setRealCityRegionFilter] = useState<
    'Todos' | 'Brasil' | 'Américas' | 'Europa' | 'África & Oriente' | 'Ásia' | 'Oceania'
  >('Todos');
  const [planeDurationUnit, setPlaneDurationUnit] = useState<PlaneFlightTimeUnit>('seconds');

  const formatFlightDuration = (totalSeconds: number): string => {
    const s = Math.max(
      PLANE_MIN_FLIGHT_DURATION_SEC,
      Math.min(PLANE_MAX_FLIGHT_DURATION_SEC, Math.round(totalSeconds))
    );
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      if (mins === 0 && secs === 0) return `${hrs}h`;
      if (secs === 0) return `${hrs}h ${mins}m`;
      return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    }
    if (mins > 0) {
      if (secs === 0) return `${mins} min`;
      return `${mins}m ${String(secs).padStart(2, '0')}s`;
    }
    return `${s}s`;
  };

  const formatFlightCountdown = (remSec: number): string => {
    if (remSec <= 0) return '0s';
    if (remSec < 10) return `${remSec.toFixed(1).replace('.', ',')}s`;
    return formatFlightDuration(Math.ceil(remSec));
  };

  const formatUtcHMS = (dateOrMs: Date | number): string => {
    const d = typeof dateOrMs === 'number' ? new Date(dateOrMs) : dateOrMs;
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  const formatUtcDateShort = (dateOrMs: Date | number): string => {
    const d = typeof dateOrMs === 'number' ? new Date(dateOrMs) : dateOrMs;
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const unitMaxVal =
    planeDurationUnit === 'hours' ? 24 : planeDurationUnit === 'minutes' ? 1440 : 86400;
  const unitFactor =
    planeDurationUnit === 'hours' ? 3600 : planeDurationUnit === 'minutes' ? 60 : 1;
  const unitDisplayVal =
    planeDurationUnit === 'hours'
      ? Number(Math.max(1 / 3600, planeFlightDurationSec / 3600).toFixed(2))
      : planeDurationUnit === 'minutes'
        ? Number(Math.max(1 / 60, planeFlightDurationSec / 60).toFixed(2))
        : Math.round(planeFlightDurationSec);
  const unitSliderMax =
    planeDurationUnit === 'hours' ? 24 : planeDurationUnit === 'minutes' ? 1440 : 60;
  const unitSliderVal =
    planeDurationUnit === 'hours'
      ? Math.max(1, Math.min(24, Math.round(planeFlightDurationSec / 3600)))
      : planeDurationUnit === 'minutes'
        ? Math.max(1, Math.min(1440, Math.round(planeFlightDurationSec / 60)))
        : Math.max(1, Math.min(60, Math.round(planeFlightDurationSec)));

  // App Master Prompt, Local City & Vice City Visual Prompt copy state (Fórmulas Solares)
  const [promptCopied, setPromptCopied] = useState(false);
  const [vicePromptCopied, setVicePromptCopied] = useState(false);
  const [localCityPromptCopied, setLocalCityPromptCopied] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string | null>(null);
  const [isPromptExpanded, setIsPromptExpanded] = useState(true);

  const localCityProfile = resolveLocalCityVisualProfile(
    solarParams.latitude,
    solarParams.longitude,
    solarParams.timeZoneId,
    realCityData?.cityName
  );

  const copyTextToClipboard = async (text: string, onSuccess: () => void) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(textarea);
      }
    }
    onSuccess();
  };

  const handleCopyAppPrompt = () =>
    copyTextToClipboard(APP_MASTER_PROMPT, () => {
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 2500);
    });

  const handleCopyVicePrompt = () =>
    copyTextToClipboard(GTA_VICE_CITY_PROMPT, () => {
      setVicePromptCopied(true);
      window.setTimeout(() => setVicePromptCopied(false), 2500);
    });

  const handleCopyLocalCityPrompt = () =>
    copyTextToClipboard(localCityProfile.promptText, () => {
      setLocalCityPromptCopied(true);
      window.setTimeout(() => setLocalCityPromptCopied(false), 2500);
    });

  const handleDetectLocalGpsForCity = () => {
    if (!navigator.geolocation) {
      setGpsStatusMsg('Geolocalização não suportada neste navegador.');
      return;
    }
    setGpsLoading(true);
    setGpsStatusMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lon = Number(pos.coords.longitude.toFixed(4));
        onUpdateParams({ latitude: lat, longitude: lon, autoHistoricalTimezone: true });
        onChangeVisualStyle?.('local_city');
        if (sceneTheme === 'city_real') {
          onLoadRealCity?.(lat, lon, undefined, undefined, false);
        }
        setGpsLoading(false);
        setGpsStatusMsg(`GPS atualizado (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`);
      },
      () => {
        setGpsLoading(false);
        setGpsStatusMsg('Usando a localização local ativa no simulador (GPS bloqueado/indisponível).');
      },
      { enableHighAccuracy: false, timeout: 7000 }
    );
  };

  const handleSearchRealCity = async () => {
    const q = realCityQuery.trim();
    if (!q || realCitySearching) return;
    setRealCitySearching(true);
    try {
      const matches = await searchWorldCities(q);
      setRealCityResults(matches);
      if (matches.length === 1 && onLoadRealCity) {
        const m = matches[0];
        onLoadRealCity(m.lat, m.lng, m.name, m.country, true);
        setRealCityResults([]);
      }
    } finally {
      setRealCitySearching(false);
    }
  };

  const activeSystemMode = solarParams.timezoneSystemMode || 'noaa_official';
  const activeSystemMeta =
    ALL_TIMEZONE_SYSTEMS.find((s) => s.id === activeSystemMode) || ALL_TIMEZONE_SYSTEMS[0];
  const filteredDockSystems =
    dockTzCategory === 'all'
      ? ALL_TIMEZONE_SYSTEMS
      : ALL_TIMEZONE_SYSTEMS.filter((s) => s.category === dockTzCategory);

  const formulaSteps = getFormulaStepBreakdown(solarParams, solarResults);
  const historicalInfo = solarResults.historicalTimezoneInfo;

  // Sync text inputs when solarResults or solarParams change externally
  useEffect(() => {
    const d = solarResults.localCivilTimeDate;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const day = pad(d.getUTCDate());
    const month = pad(d.getUTCMonth() + 1);
    const year = d.getUTCFullYear();
    setDateTextInput(`${day}/${month}/${year}`);

    const hours = pad(d.getUTCHours());
    const mins = pad(d.getUTCMinutes());
    const secs = pad(d.getUTCSeconds());
    setTimeTextInput(`${hours}:${mins}:${secs}`);

    const activeOffset = historicalInfo ? historicalInfo.offsetHours : solarParams.civilTimezoneOffset;
    setUtcOffsetTextInput(`${activeOffset >= 0 ? '+' : ''}${activeOffset}`);
  }, [solarResults.localCivilTimeFormatted, solarParams.civilTimezoneOffset, historicalInfo]);

  const handleApplyCustomTextDateTime = () => {
    let day = 1, month = 1, year = 2027;
    if (dateTextInput.includes('/')) {
      const parts = dateTextInput.split('/');
      if (parts.length >= 3) {
        day = parseInt(parts[0], 10) || 1;
        month = parseInt(parts[1], 10) || 1;
        year = parseInt(parts[2], 10) || 2027;
      }
    } else if (dateTextInput.includes('-')) {
      const parts = dateTextInput.split('-');
      if (parts.length >= 3) {
        year = parseInt(parts[0], 10) || 2027;
        month = parseInt(parts[1], 10) || 1;
        day = parseInt(parts[2], 10) || 1;
      }
    }

    let hour = 12, minute = 0, second = 0;
    const timeParts = timeTextInput.split(':');
    if (timeParts.length >= 1) hour = parseInt(timeParts[0], 10) || 0;
    if (timeParts.length >= 2) minute = parseInt(timeParts[1], 10) || 0;
    if (timeParts.length >= 3) second = parseInt(timeParts[2], 10) || 0;

    const parsedUtc = parseFloat(utcOffsetTextInput.replace('UTC', '').replace('+', '')) || 0;

    const localMs = Date.UTC(year, month - 1, day, hour, minute, second);
    const utcMs = localMs - (parsedUtc * 3600000);

    const targetDate = new Date(utcMs);
    if (!isNaN(targetDate.getTime())) {
      const currentActiveOffset = historicalInfo ? historicalInfo.offsetHours : solarParams.civilTimezoneOffset;
      const offsetWasChanged = Math.abs(parsedUtc - currentActiveOffset) > 0.001;
      onUpdateParams({
        referenceDate: targetDate,
        civilTimezoneOffset: parsedUtc,
        ...(offsetWasChanged ? { timezoneSystemMode: 'manual_custom', autoHistoricalTimezone: false } : {}),
      });
    }
  };

  const handleSelectLocation = (loc: NOAALocation) => {
    setSelectedLocationId(loc.id);
    const resolved = getHistoricalTimezoneOffset(loc.timeZoneId, solarParams.referenceDate);
    onUpdateParams({
      latitude: loc.latitude,
      longitude: loc.longitude,
      civilTimezoneOffset: resolved.offsetHours,
      timeZoneId: loc.timeZoneId,
      autoHistoricalTimezone: true,
    });
  };

  const handleAskAi = async (queryOverride?: string) => {
    const textToAsk = queryOverride || aiQuery;
    if (!textToAsk.trim() || aiLoading) return;
    setAiLoading(true);
    setAiResponse(null);
    setAiSources([]);
    if (queryOverride) {
      setAiQuery(queryOverride);
    }
    const result = await askGeminiSolarAdvisor(textToAsk, solarParams, solarResults);
    setAiResponse(result.text);
    setAiSources(result.sources || []);
    setAiLoading(false);
  };


  return (
    <div className="flex flex-col h-full w-full pointer-events-none">
      {/* 1. TOP BAR CONTRACT */}
      <header className="pointer-events-auto flex items-center justify-between gap-8 px-6 py-3 bg-slate-900/90 border-b border-slate-800 text-slate-100 shadow-md">
        {/* Zone 1: Single Brand Title */}
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Sun className="w-5 h-5 animate-pulse" />
          </div>
          <span className="text-base font-bold tracking-tight text-white font-mono">
            HELIOS <span className="text-slate-500 font-sans font-normal">// Motor Solar 360° & Fusos NOAA</span>
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800/80">
          <button
            onClick={() => setActiveTab('sim')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'sim' ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Simulação 3D
          </button>
          <button
            onClick={() => setActiveTab('maps')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'maps' || activeTab === 'noaa' ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Google Maps & Base NOAA (Fusos 15°)
          </button>
          <button
            onClick={() => setActiveTab('formulas')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'formulas' ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Fórmulas Solares
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'ai' ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Gemini Advisor
          </button>
        </nav>

        {/* Zone 3: Primary Action Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setActiveTab('maps')}
            className="px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-md cursor-pointer hover:shadow-amber-500/20"
          >
            <Search className="w-3.5 h-3.5" />
            Procurar Locais
          </button>

          <button
            onClick={onResetTime}
            className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            Reset 2027 UTC
          </button>
        </div>
      </header>

      {/* 2. TOP HUD DATA OVERLAY - STRICTLY SINGLE LINE */}
      <div className="pointer-events-auto px-4 py-1.5 flex flex-nowrap items-center justify-between gap-3 text-[11px] text-slate-300 bg-slate-950/75 border-b border-slate-800/60 backdrop-blur-md overflow-x-auto whitespace-nowrap">
        <div className="flex flex-nowrap items-center gap-2 font-mono tabular-nums shrink-0">
          <button
            onClick={() => setActiveTab('maps')}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 transition-colors cursor-pointer shrink-0"
            title="Clique para procurar locais no Google Maps"
          >
            <MapPin className="w-3 h-3 text-sky-400 shrink-0" />
            <span>Lat <strong>{solarParams.latitude.toFixed(2)}°</strong>, Lon <strong>{solarParams.longitude.toFixed(2)}°</strong></span>
          </button>
          <span className="text-slate-600">·</span>
          <span className="text-amber-400 font-semibold">{solarResults.twilightPhase}</span>
          <span className="text-slate-600">·</span>
          <span>
            Altitude: <strong className="text-slate-100">{solarResults.solarAltitudeDeg.toFixed(2)}°</strong>
          </span>
          <span className="text-slate-600">·</span>
          <span>
            Zênite: <strong className="text-slate-100">{solarResults.solarZenithDeg.toFixed(2)}°</strong>
          </span>
          <span className="text-slate-600">·</span>
          <span>
            Azimute: <strong className="text-slate-100">{solarResults.solarAzimuthDeg.toFixed(2)}°</strong>
          </span>
          <span className="text-slate-600">·</span>
          <span>
            Inclinação: <strong className="text-emerald-400">{solarParams.axialTilt.toFixed(2)}°</strong>
          </span>
          <span className="text-slate-600">·</span>
          <span title="Declinação do momento da Terra: Norte (+), Sul (-), Equador (00,00)">
            Declinação:{' '}
            {(() => {
              const roundedDecl = Math.round(solarResults.declinationDeg * 100) / 100;
              if (Math.abs(roundedDecl) < 0.005) {
                return <strong className="text-emerald-300">00,00°</strong>;
              }
              const sign = roundedDecl > 0 ? '+' : '-';
              const formatted = Math.abs(roundedDecl).toFixed(2).padStart(5, '0').replace('.', ',');
              return (
                <strong className={roundedDecl > 0 ? 'text-sky-300' : 'text-amber-300'}>
                  {sign}{formatted}°
                </strong>
              );
            })()}
          </span>
          <span className="text-slate-600">·</span>
          <span>
            EoT: <strong className="text-amber-300">{solarResults.equationOfTimeMinutes.toFixed(2)}m</strong>
          </span>
          {solarResults.sunHorizonIntensity > 0.05 && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-orange-400">
                Horizonte: <strong>{(solarResults.sunHorizonIntensity * 100).toFixed(0)}%</strong>
              </span>
            </>
          )}
          {solarResults.beltOfVenusIntensity > 0.1 && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-pink-400">
                Cinturão de Vênus: <strong>{(solarResults.beltOfVenusIntensity * 100).toFixed(0)}%</strong>
              </span>
            </>
          )}
          {solarResults.starsIntensity > 0.05 && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-indigo-300">
                Estrelas: <strong>{(solarResults.starsIntensity * 100).toFixed(0)}%</strong>
              </span>
            </>
          )}
          <span className="text-slate-600">·</span>
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-semibold shrink-0 ${
              solarResults.seasonInfo.seasonName === 'Verão'
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : solarResults.seasonInfo.seasonName === 'Primavera'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : solarResults.seasonInfo.seasonName === 'Outono'
                    ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                    : solarResults.seasonInfo.seasonName === 'Inverno'
                      ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300'
            }`}
            title={`${solarResults.seasonInfo.solarMotionLabel} | Hemisfério Norte (LAT +): ${solarResults.seasonInfo.northHemisphereSeason} | Hemisfério Sul (LAT -): ${solarResults.seasonInfo.southHemisphereSeason}`}
          >
            <span>
              {solarResults.seasonInfo.seasonName === 'Verão' && '☀️'}
              {solarResults.seasonInfo.seasonName === 'Primavera' && '🌸'}
              {solarResults.seasonInfo.seasonName === 'Outono' && '🍂'}
              {solarResults.seasonInfo.seasonName === 'Inverno' && '❄️'}
              {solarResults.seasonInfo.seasonName === 'Equinócio Permanente' && '⚖️'}
            </span>
            <span>
              Estação: <strong>{solarResults.seasonInfo.seasonName}</strong>{' '}
              <span className="opacity-80 text-[10px]">
                ({solarParams.latitude > 0 ? 'LAT+' : solarParams.latitude < 0 ? 'LAT-' : '0°'})
              </span>
            </span>
          </span>
          {Math.abs(solarParams.axialTilt) >= 0.01 && (
            <>
              <span className="text-slate-600">·</span>
              <button
                type="button"
                onClick={() =>
                  onUpdateParams({
                    referenceDate: new Date(solarResults.seasonInfo.nextTransition.transitionUtcDate.getTime()),
                  })
                }
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/40 text-indigo-200 font-mono text-[11px] transition-colors cursor-pointer shrink-0"
                title={`Próxima Transição (${solarResults.seasonInfo.nextTransition.eventName}) — Base UTC: ${solarResults.seasonInfo.nextTransition.transitionUtcFormatted} | Clique para ir exatamente para este instante`}
              >
                <span>
                  Próxima Transição:{' '}
                  <strong className="text-amber-300">{solarResults.seasonInfo.nextTransition.nextSeasonName}</strong>{' '}
                  <strong className="text-white">{solarResults.seasonInfo.nextTransition.transitionLocalDateFormatted}</strong>{' '}
                  <strong className="text-emerald-300">{solarResults.seasonInfo.nextTransition.transitionLocalTimeFormatted}</strong>
                </span>
              </button>
            </>
          )}
        </div>

        {/* TIMEZONE SYSTEM & CLOCK BADGES */}
        <div className="flex flex-nowrap items-center gap-2 font-mono tabular-nums text-slate-300 shrink-0">
          <span>LST Solar: <strong className="text-emerald-400">{solarResults.lstLocalFormatted}</strong></span>
          <span className="text-slate-600">·</span>
          <span>
            {sceneTheme === 'city_real' && realCityVehicleMode === 'plane' ? (
              <>
                ✈️ Voo (UTC+0):{' '}
                <strong className="text-sky-300">{formatUtcHMS(solarParams.referenceDate)} UTC+0</strong>
              </>
            ) : (
              <>
                Hora Civil: <strong className="text-sky-300">{solarResults.localCivilTimeFormatted}</strong>
                {solarResults.specialClockDisplay && (
                  <strong className="ml-1.5 text-amber-300">({solarResults.specialClockDisplay})</strong>
                )}
              </>
            )}
          </span>
          <span className="text-slate-600">·</span>

          {/* Timezone System Badge */}
          <button
            type="button"
            onClick={() => setIsTimezoneModalOpen(true)}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-sans font-medium text-[11px] transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            title={`Sistema de Fuso Ativo: ${solarResults.timezoneSystemDescription}${
              historicalInfo?.timezonePronunciation ? ` | Pronúncia: ${historicalInfo.timezonePronunciation}` : ''
            }. Clique para escolher entre todos os ${ALL_TIMEZONE_SYSTEMS.length} sistemas de fuso.`}
          >
            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
            <span>
              {sceneTheme === 'city_real' && realCityVehicleMode === 'plane' && activeSystemMode === 'utc_standard'
                ? '✈️ Horário do Voo (UTC+0 / Z)'
                : (
                  <>
                    {activeSystemMeta.icon}{' '}
                    {activeSystemMode === 'noaa_official'
                      ? historicalInfo && historicalInfo.isAutoApplied
                        ? `NOAA ${historicalInfo.timezoneAbbrev} (UTC${historicalInfo.offsetHours >= 0 ? '+' : ''}${historicalInfo.offsetHours})`
                        : `NOAA Oficial (UTC${solarParams.civilTimezoneOffset >= 0 ? '+' : ''}${solarParams.civilTimezoneOffset})`
                      : solarResults.specialClockDisplay
                        ? `${activeSystemMeta.shortName} · ${solarResults.specialClockDisplay}`
                        : `${activeSystemMeta.shortName} (UTC${Number(solarParams.civilTimezoneOffset.toFixed(2)) >= 0 ? '+' : ''}${Number(solarParams.civilTimezoneOffset.toFixed(2))})`}
                  </>
                )}
            </span>
            {historicalInfo?.isDst && (
              <span className="ml-1 px-1 rounded bg-amber-400 text-slate-950 font-bold text-[9px] uppercase">
                DST
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 3. MAIN TAB CONTENT AREA */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {/* DRONE NA CÂMERA (FPV 6-DoF IN-VIEWPORT HUD & FLIGHT PAD OVERLAY) */}
        {activeTab === 'sim' &&
          viewMode === 'landscape' &&
          cameraPreset === 'drone' && (() => {
            const setMoveKey = (key: keyof PersonMoveInput, value: boolean) => {
              if (personMoveRef?.current) {
                personMoveRef.current[key] = value;
              }
            };
            const altM = droneTelemetry?.altitudeM ?? 14;
            const speedKmh = droneTelemetry?.speedKmh ?? 0;
            const headingDeg = droneTelemetry?.headingDeg ?? 0;
            const pitchDeg = droneTelemetry?.pitchDeg ?? -18;

            return (
              <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3 sm:p-4">
                {/* FPV Center Horizon & Gimbal Reticle */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-55">
                  <svg width="110" height="72" viewBox="0 0 110 72" fill="none">
                    <path d="M10 18 L10 8 L22 8" stroke="#38bdf8" strokeWidth="1.8" />
                    <path d="M100 18 L100 8 L88 8" stroke="#38bdf8" strokeWidth="1.8" />
                    <path d="M10 54 L10 64 L22 64" stroke="#38bdf8" strokeWidth="1.8" />
                    <path d="M100 54 L100 64 L88 64" stroke="#38bdf8" strokeWidth="1.8" />
                    <line x1="42" y1="36" x2="50" y2="36" stroke="#38bdf8" strokeWidth="1.5" />
                    <line x1="60" y1="36" x2="68" y2="36" stroke="#38bdf8" strokeWidth="1.5" />
                    <circle cx="55" cy="36" r="2.2" stroke="#34d399" strokeWidth="1.5" />
                  </svg>
                </div>

                {/* Top Drone Camera Telemetry & Control Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="pointer-events-auto inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-sky-400/50 text-xs font-mono text-slate-200 shadow-lg">
                    <Navigation className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="font-bold text-sky-300">Drone na Câmera (FPV)</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-[11px] text-slate-300">
                      WASD voar · Espaço subir · C descer · Shift turbo · Arraste câmera
                    </span>
                    <button
                      type="button"
                      onClick={() => onChangeCameraPreset('free360')}
                      className="ml-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      Sair para Órbita
                    </button>
                  </div>

                  <div className="pointer-events-auto flex flex-wrap items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-sky-500/40 text-[11px] font-mono shadow-lg text-slate-200">
                    <span>
                      ALT: <strong className="text-amber-300">{altM.toFixed(1)}m</strong>
                    </span>
                    <span className="text-slate-600">·</span>
                    <span>
                      VEL: <strong className="text-emerald-300">{speedKmh} km/h</strong>
                    </span>
                    <span className="text-slate-600">·</span>
                    <span>
                      PROA: <strong className="text-sky-300">{headingDeg}°</strong>
                    </span>
                    <span className="text-slate-600">·</span>
                    <span>
                      GIMBAL: <strong className="text-indigo-300">{pitchDeg}°</strong>
                    </span>
                  </div>
                </div>

                {/* Bottom-Left Flight D-Pad + Ascend / Descend */}
                <div className="flex items-end justify-between">
                  <div
                    className="pointer-events-auto select-none flex items-end gap-2"
                    style={{ touchAction: 'none' }}
                  >
                    <div className="grid grid-cols-3 gap-1.5 p-2 rounded-2xl bg-slate-950/85 border border-slate-700/80 shadow-xl">
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setMoveKey('sprint', true);
                        }}
                        onPointerUp={() => setMoveKey('sprint', false)}
                        onPointerCancel={() => setMoveKey('sprint', false)}
                        className="w-10 h-10 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-amber-500 active:text-slate-950 border border-slate-700 text-[10px] font-mono font-bold text-amber-300 flex items-center justify-center cursor-pointer"
                        title="Turbo Drone (Shift)"
                      >
                        ⚡
                      </button>
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setMoveKey('forward', true);
                        }}
                        onPointerUp={() => setMoveKey('forward', false)}
                        onPointerCancel={() => setMoveKey('forward', false)}
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-sky-500 active:text-slate-950 border border-slate-600 text-sm font-mono font-bold text-white flex items-center justify-center cursor-pointer"
                        title="Voar para Frente (W)"
                      >
                        W
                      </button>
                      <div className="w-10 h-10" />

                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setMoveKey('left', true);
                        }}
                        onPointerUp={() => setMoveKey('left', false)}
                        onPointerCancel={() => setMoveKey('left', false)}
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-sky-500 active:text-slate-950 border border-slate-600 text-sm font-mono font-bold text-white flex items-center justify-center cursor-pointer"
                        title="Esquerda (A)"
                      >
                        A
                      </button>
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setMoveKey('backward', true);
                        }}
                        onPointerUp={() => setMoveKey('backward', false)}
                        onPointerCancel={() => setMoveKey('backward', false)}
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-sky-500 active:text-slate-950 border border-slate-600 text-sm font-mono font-bold text-white flex items-center justify-center cursor-pointer"
                        title="Voar para Trás (S)"
                      >
                        S
                      </button>
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setMoveKey('right', true);
                        }}
                        onPointerUp={() => setMoveKey('right', false)}
                        onPointerCancel={() => setMoveKey('right', false)}
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-sky-500 active:text-slate-950 border border-slate-600 text-sm font-mono font-bold text-white flex items-center justify-center cursor-pointer"
                        title="Direita (D)"
                      >
                        D
                      </button>
                    </div>

                    <div className="flex flex-col gap-1.5 p-2 rounded-2xl bg-slate-950/85 border border-sky-700/70 shadow-xl">
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setMoveKey('ascend', true);
                        }}
                        onPointerUp={() => setMoveKey('ascend', false)}
                        onPointerCancel={() => setMoveKey('ascend', false)}
                        className="px-2.5 h-10 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 active:bg-sky-400 active:text-slate-950 border border-sky-500/50 text-xs font-mono font-bold text-sky-200 flex items-center gap-1 cursor-pointer"
                        title="Subir Drone (Espaço)"
                      >
                        <ArrowUp className="w-3.5 h-3.5" /> Subir
                      </button>
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setMoveKey('descend', true);
                        }}
                        onPointerUp={() => setMoveKey('descend', false)}
                        onPointerCancel={() => setMoveKey('descend', false)}
                        className="px-2.5 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-amber-400 active:text-slate-950 border border-slate-600 text-xs font-mono font-bold text-slate-200 flex items-center gap-1 cursor-pointer"
                        title="Descer Drone (C)"
                      >
                        <ArrowDown className="w-3.5 h-3.5" /> Descer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

        {/* MODO PESSOA / CIDADE REAL EXPLORAÇÃO IN-VIEWPORT OVERLAY */}
        {activeTab === 'sim' &&
          viewMode === 'landscape' &&
          (sceneTheme === 'city_cars' || sceneTheme === 'city_people' || sceneTheme === 'city_real' || sceneTheme === 'farm' || sceneTheme === 'solar_time') &&
          cameraPreset === 'person' && (() => {
            const setMoveKey = (key: keyof PersonMoveInput, value: boolean) => {
              if (personMoveRef?.current) {
                personMoveRef.current[key] = value;
              }
            };
            const signalDot = (color: SignalColor) =>
              color === 'green'
                ? 'bg-emerald-400'
                : color === 'yellow'
                  ? 'bg-amber-400'
                  : 'bg-rose-500';
            const signalLabel = (color: SignalColor) =>
              color === 'green' ? 'VERDE' : color === 'yellow' ? 'AMARELO' : 'VERMELHO';
            const activeModeTitle =
              sceneTheme === 'city_real'
                ? `Cidade Real · ${
                    realCityVehicleMode === 'drone'
                      ? 'Drone 6-DoF'
                      : realCityVehicleMode === 'plane'
                        ? 'Avião'
                        : realCityVehicleMode === 'car'
                          ? 'Dirigindo Carro'
                          : 'A Pé / Subir Prédios'
                  }`
                : sceneTheme === 'city_cars'
                  ? 'Modo Pessoa · Cidade De Carros'
                  : sceneTheme === 'city_people'
                    ? 'Modo Pessoa · Cidade De Pessoas'
                    : sceneTheme === 'solar_time'
                      ? 'Modo Pessoa · Relógio Hora Solar 24h'
                      : 'Modo Pessoa · Fazenda';

            const isAirVehicle =
              sceneTheme === 'city_real' &&
              (realCityVehicleMode === 'drone' || realCityVehicleMode === 'plane');

            return (
              <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3 sm:p-4">
                {/* Top floating Semáforo / Fazenda / Cidade Real Telemetry & Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="pointer-events-auto inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-emerald-500/40 text-xs font-mono text-slate-200 shadow-lg">
                    <Footprints className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="font-bold text-emerald-300">{activeModeTitle}</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-[11px] text-slate-300">
                      {sceneTheme === 'city_real' && realCityVehicleMode === 'walk'
                        ? 'WASD · Clique no prédio ou Espaço p/ subir · F p/ descer'
                        : isAirVehicle
                          ? 'WASD voar · Espaço subir · C descer · Arraste câmera'
                          : 'WASD controlar · Arraste mouse ou touch para olhar'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onChangeCameraPreset('free360')}
                      className="ml-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      Sair para Órbita
                    </button>
                  </div>

                  {/* Right Status Panel */}
                  {sceneTheme === 'city_real' ? (
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="pointer-events-auto flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-sky-500/40 text-[11px] font-mono shadow-lg text-slate-200">
                        <span className="font-bold text-sky-300">
                          🏙️ {realCityData?.cityName || 'Cidade'}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span>
                          Alt:{' '}
                          <strong className="text-amber-300">
                            {(realCityTelemetry?.altitudeM ?? 0) >= 1000
                              ? `${((realCityTelemetry?.altitudeM ?? 0) / 1000).toFixed(2).replace('.', ',')} km`
                              : `${realCityTelemetry?.altitudeM?.toFixed(1) ?? '0.0'}m`}
                          </strong>
                          {realCityVehicleMode === 'plane' && (
                            <span className="text-indigo-300 ml-1">
                              / {planeMaxAltitudeM >= 1000
                                ? `${(planeMaxAltitudeM / 1000).toFixed(planeMaxAltitudeM % 1000 === 0 ? 0 : 1).replace('.', ',')} km`
                                : `${planeMaxAltitudeM}m`}
                            </span>
                          )}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span>
                          Vel: <strong className="text-emerald-300">{realCityTelemetry?.speedKmh ?? 0} km/h</strong>
                        </span>
                        {realCityTelemetry?.onBuildingName && (
                          <>
                            <span className="text-slate-600">·</span>
                            <span className="text-amber-200 font-bold">
                              Topo: {realCityTelemetry.onBuildingName}
                            </span>
                          </>
                        )}
                        {/* Quick in-HUD Vehicle Mode & Rooftop Climb Switcher */}
                        <div className="flex items-center gap-1 ml-1">
                          {(
                            [
                              { id: 'walk', label: '🚶 A Pé' },
                              { id: 'drone', label: '🚁 Drone' },
                              { id: 'plane', label: '✈️ Avião' },
                              { id: 'car', label: '🚗 Carro' },
                            ] as Array<{ id: RealCityVehicleMode; label: string }>
                          ).map((vm) => (
                            <button
                              key={vm.id}
                              type="button"
                              onClick={() => onChangeRealCityVehicleMode?.(vm.id)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                                realCityVehicleMode === vm.id
                                  ? 'bg-sky-500 text-slate-950 border-sky-300'
                                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                              }`}
                            >
                              {vm.label}
                            </button>
                          ))}
                          {realCityVehicleMode === 'walk' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  if (realCityActionRef?.current) {
                                    realCityActionRef.current.action = 'climb_nearest';
                                  }
                                }}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer"
                                title="Subir no topo do prédio mais próximo (Espaço)"
                              >
                                🪜 Subir Prédio
                              </button>
                              {(realCityTelemetry?.altitudeM ?? 0) > 1.0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (realCityActionRef?.current) {
                                      realCityActionRef.current.action = 'descend';
                                    }
                                  }}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 cursor-pointer"
                                  title="Descer para a rua (F)"
                                >
                                  ⬇️ Rua
                                </button>
                              )}
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setIsRealCityGlobalMapOpen(true)}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/25 hover:bg-indigo-500/45 text-indigo-200 border border-indigo-400/50 cursor-pointer transition-colors"
                            title="Abrir Mapa Global Interativo do Mundo Todo dentro da Cidade Real"
                          >
                            🗺️ Mapa Global
                          </button>
                        </div>
                      </div>

                      {realCityVehicleMode === 'plane' && (
                        <div className="pointer-events-auto flex flex-col gap-2 px-3 py-2 rounded-xl bg-slate-950/92 border border-indigo-500/45 text-[11px] font-mono shadow-lg text-slate-200 max-w-md w-full sm:w-auto">
                          {/* Standard Aviation UTC+0 Live Clock Header */}
                          <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-800/90">
                            <span className="text-[10px] font-bold text-cyan-300 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-cyan-400" />
                              Horário do Voo (UTC+0):
                            </span>
                            <span className="text-[11px] font-bold text-white tabular-nums">
                              {formatUtcHMS(solarParams.referenceDate)}{' '}
                              <span className="text-cyan-300">UTC+0 (Z)</span>
                              <span className="text-slate-400 font-normal ml-1.5 text-[10px]">
                                {formatUtcDateShort(solarParams.referenceDate)}
                              </span>
                            </span>
                          </div>

                          {/* Live Active Worldwide Express Flight Banner */}
                          {planeFlightPlan?.active ? (
                            <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-400/50 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-indigo-200 flex items-center gap-1.5">
                                  <Plane className="w-3.5 h-3.5 text-amber-300" />
                                  {planeFlightPlan.originName} → {planeFlightPlan.destName}
                                </span>
                                <button
                                  type="button"
                                  onClick={onCancelGlobalPlaneFlight}
                                  className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-600 text-[10px] text-slate-200 cursor-pointer"
                                >
                                  Assumir Manual
                                </button>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden">
                                <div
                                  className="h-full bg-amber-400 transition-all duration-100"
                                  style={{
                                    width: `${Math.round((realCityTelemetry?.flightProgress ?? 0) * 100)}%`,
                                  }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-cyan-200">
                                <span>
                                  Decolagem:{' '}
                                  <strong className="text-white">
                                    {formatUtcHMS(planeFlightPlan.departureUtcMs)} UTC+0
                                  </strong>
                                </span>
                                <span>
                                  Pouso (ETA):{' '}
                                  <strong className="text-emerald-300">
                                    {formatUtcHMS(planeFlightPlan.estimatedArrivalUtcMs)} UTC+0
                                  </strong>
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-300">
                                <span>
                                  Restam:{' '}
                                  <strong className="text-amber-300">
                                    {(realCityTelemetry?.flightRemainingKm ?? planeFlightPlan.totalDistanceKm).toLocaleString('pt-BR')} km
                                  </strong>
                                  {realCityTelemetry?.flightRemainingSec !== undefined &&
                                    realCityTelemetry?.flightRemainingSec !== null && (
                                      <span className="text-sky-300 ml-1.5">
                                        · {formatFlightCountdown(realCityTelemetry.flightRemainingSec)}
                                      </span>
                                    )}
                                </span>
                                <span>
                                  {Math.round((realCityTelemetry?.flightProgress ?? 0) * 100)}% ·{' '}
                                  {(realCityTelemetry?.liveLat ?? solarParams.latitude).toFixed(1)}°,{' '}
                                  {(realCityTelemetry?.liveLng ?? solarParams.longitude).toFixed(1)}°
                                </span>
                              </div>
                            </div>
                          ) : (
                            /* Quick Express World Travel Strip inside HUD */
                            <div className="flex flex-col gap-1 pb-1.5 border-b border-slate-800">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold text-sky-300 flex items-center gap-1">
                                  <Globe className="w-3 h-3 text-sky-400" />
                                  Viajar pelo Mundo ({formatFlightDuration(planeFlightDurationSec)}):
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-400">
                                    {(realCityTelemetry?.liveLat ?? solarParams.latitude).toFixed(2)}°,{' '}
                                    {(realCityTelemetry?.liveLng ?? solarParams.longitude).toFixed(2)}°
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setIsRealCityGlobalMapOpen(true)}
                                    className="px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/50 text-sky-200 text-[10px] font-bold cursor-pointer"
                                  >
                                    🗺️ Mapa
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-1">
                                {[
                                  'São Paulo',
                                  'Rio de Janeiro',
                                  'Nova York',
                                  'Tóquio',
                                  'Paris',
                                  'Londres',
                                  'Dubai',
                                  'Sydney',
                                ]
                                  .map((cityName) => WORLD_CITY_PRESETS.find((c) => c.name === cityName))
                                  .filter((c): c is RealCitySearchResult => Boolean(c))
                                  .map((c) => (
                                    <button
                                      key={`hud_fly_${c.name}`}
                                      type="button"
                                      onClick={() => onStartGlobalPlaneFlight?.(c.lat, c.lng, c.name, c.country)}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                                        realCityData?.cityName === c.name
                                          ? 'bg-sky-500/25 text-sky-200 border-sky-400'
                                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-indigo-500/30 hover:border-indigo-400'
                                      }`}
                                      title={`Voar de avião até ${c.displayName} em ${formatFlightDuration(planeFlightDurationSec)}`}
                                    >
                                      ✈️ {c.name}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* Tempo da Viagem de Avião (mín. 1s · Segundos / Minutos / Horas · máx. 24h) */}
                          <div className="flex flex-col gap-1.5 pb-1.5 border-b border-slate-800">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-400" />
                                Tempo de Voo (1s – 24h):
                              </span>
                              <span className="text-[10px] font-bold text-emerald-300">
                                {formatFlightDuration(planeFlightDurationSec)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1">
                                {(
                                  [
                                    { id: 'seconds', label: 'Seg' },
                                    { id: 'minutes', label: 'Min' },
                                    { id: 'hours', label: 'Hora' },
                                  ] as Array<{ id: PlaneFlightTimeUnit; label: string }>
                                ).map((u) => (
                                  <button
                                    key={`hud_u_${u.id}`}
                                    type="button"
                                    onClick={() => {
                                      setPlaneDurationUnit(u.id);
                                      if (u.id === 'minutes' && planeFlightDurationSec < 60) {
                                        onChangePlaneFlightDurationSec?.(60);
                                      } else if (u.id === 'hours' && planeFlightDurationSec < 3600) {
                                        onChangePlaneFlightDurationSec?.(3600);
                                      }
                                    }}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                                      planeDurationUnit === u.id
                                        ? 'bg-amber-500 text-slate-950 border-amber-300'
                                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                                    }`}
                                  >
                                    {u.label}
                                  </button>
                                ))}
                              </div>
                              <div className="flex items-center gap-1.5 flex-1">
                                <input
                                  type="range"
                                  min={1}
                                  max={unitSliderMax}
                                  step={1}
                                  value={unitSliderVal}
                                  onChange={(e) => {
                                    const nextSec = Number(e.target.value) * unitFactor;
                                    onChangePlaneFlightDurationSec?.(nextSec);
                                  }}
                                  className="w-full accent-amber-400 cursor-pointer h-1.5"
                                  aria-label="Controle deslizante do tempo de voo do avião"
                                />
                                <input
                                  type="number"
                                  min={planeDurationUnit === 'seconds' ? 1 : 0.01}
                                  max={unitMaxVal}
                                  step={planeDurationUnit === 'seconds' ? 1 : 'any'}
                                  value={unitDisplayVal}
                                  onChange={(e) => {
                                    const raw = Number(e.target.value);
                                    if (!Number.isNaN(raw) && raw > 0) {
                                      onChangePlaneFlightDurationSec?.(
                                        Math.max(
                                          PLANE_MIN_FLIGHT_DURATION_SEC,
                                          Math.min(PLANE_MAX_FLIGHT_DURATION_SEC, Math.round(raw * unitFactor))
                                        )
                                      );
                                    }
                                  }}
                                  className="w-16 px-1.5 py-0.5 rounded bg-slate-900 border border-amber-500/40 text-right text-amber-200 font-bold text-[10px] focus:outline-none focus:border-amber-400"
                                  aria-label="Valor do tempo de voo do avião"
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              {[
                                { s: 1, label: '1s', unit: 'seconds' as PlaneFlightTimeUnit },
                                { s: 4, label: '4s', unit: 'seconds' as PlaneFlightTimeUnit },
                                { s: 15, label: '15s', unit: 'seconds' as PlaneFlightTimeUnit },
                                { s: 60, label: '1m', unit: 'minutes' as PlaneFlightTimeUnit },
                                { s: 300, label: '5m', unit: 'minutes' as PlaneFlightTimeUnit },
                                { s: 3600, label: '1h', unit: 'hours' as PlaneFlightTimeUnit },
                                { s: 43200, label: '12h', unit: 'hours' as PlaneFlightTimeUnit },
                                { s: 86400, label: '24h', unit: 'hours' as PlaneFlightTimeUnit },
                              ].map((tp) => (
                                <button
                                  key={`hud_tp_${tp.s}`}
                                  type="button"
                                  onClick={() => {
                                    setPlaneDurationUnit(tp.unit);
                                    onChangePlaneFlightDurationSec?.(tp.s);
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                                    planeFlightDurationSec === tp.s
                                      ? 'bg-amber-500 text-slate-950 border-amber-300'
                                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                                  }`}
                                >
                                  {tp.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Velocidade de Deslocamento Global Manual */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-slate-400">Escala Voo:</span>
                            <div className="flex items-center gap-1">
                              {(
                                [
                                  { id: 'city', label: 'Cidade 1x' },
                                  { id: 'regional', label: 'Regional' },
                                  { id: 'global', label: '🌍 Global' },
                                ] as Array<{ id: PlaneTravelSpeedMode; label: string }>
                              ).map((sp) => (
                                <button
                                  key={sp.id}
                                  type="button"
                                  onClick={() => onChangePlaneTravelSpeedMode?.(sp.id)}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                                    planeTravelSpeedMode === sp.id
                                      ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                                  }`}
                                >
                                  {sp.label}
                                </button>
                              ))}
                              {planeTravelSpeedMode !== 'city' && realCityTelemetry?.liveLat !== undefined && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onLoadRealCity?.(
                                      realCityTelemetry.liveLat!,
                                      realCityTelemetry.liveLng!,
                                      undefined,
                                      'Mundo',
                                      true
                                    )
                                  }
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer"
                                  title="Carregar cidade real nas coordenadas atuais sob o avião"
                                >
                                  📍 Carregar Aqui
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Altura Máxima do Avião (máx. 11 km) */}
                          <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800">
                            <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                              <Plane className="w-3.5 h-3.5 text-indigo-400" />
                              Altura Máxima (máx. 11 km)
                            </span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={PLANE_MIN_CEILING_M}
                                max={PLANE_MAX_CEILING_M}
                                step={50}
                                value={planeMaxAltitudeM}
                                onChange={(e) => {
                                  const raw = Number(e.target.value);
                                  if (!Number.isNaN(raw)) {
                                    onChangePlaneMaxAltitudeM?.(raw);
                                  }
                                }}
                                className="w-20 px-1.5 py-0.5 rounded bg-slate-900 border border-indigo-500/50 text-right text-amber-300 font-bold text-[11px] focus:outline-none focus:border-indigo-400"
                                aria-label="Altura máxima do avião em metros"
                              />
                              <span className="text-[10px] text-slate-400">
                                m ({(planeMaxAltitudeM / 1000).toFixed(2).replace('.', ',')} km)
                              </span>
                            </div>
                          </div>
                          <input
                            type="range"
                            min={PLANE_MIN_CEILING_M}
                            max={PLANE_MAX_CEILING_M}
                            step={50}
                            value={planeMaxAltitudeM}
                            onChange={(e) => onChangePlaneMaxAltitudeM?.(Number(e.target.value))}
                            className="w-full accent-indigo-400 cursor-pointer h-1.5"
                            aria-label="Controle deslizante de altura máxima do avião"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            {[
                              { m: 220, label: '220m' },
                              { m: 500, label: '500m' },
                              { m: 1000, label: '1 km' },
                              { m: 3000, label: '3 km' },
                              { m: 6000, label: '6 km' },
                              { m: 11000, label: '11 km' },
                            ].map((preset) => (
                              <button
                                key={preset.m}
                                type="button"
                                onClick={() => onChangePlaneMaxAltitudeM?.(preset.m)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                                  planeMaxAltitudeM === preset.m
                                    ? 'bg-indigo-500 text-white border-indigo-300'
                                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : sceneTheme === 'farm' ? (
                    <div className="pointer-events-auto inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-emerald-600/40 text-[11px] font-mono shadow-lg text-emerald-200">
                      <Tractor className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        Postes ≤ -3°: <strong>{solarResults.solarAltitudeDeg <= -3.0 ? 'LIGADOS' : 'DESL.'}</strong>
                      </span>
                      <span className="text-slate-600">·</span>
                      <span>
                        Casas/Celeiro ≤ -4,5°: <strong>{solarResults.solarAltitudeDeg <= -4.5 ? 'LIGADOS' : 'DESL.'}</strong>
                      </span>
                    </div>
                  ) : (
                    <div className="pointer-events-auto inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-700 text-[11px] font-mono shadow-lg">
                      <span className="text-slate-400 font-bold">Semáforos:</span>
                      <span className="inline-flex items-center gap-1.5 text-slate-100">
                        <span className={`w-2.5 h-2.5 rounded-full ${signalDot(trafficSignal.ew)}`} />
                        L/O: <strong>{signalLabel(trafficSignal.ew)}</strong>
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="inline-flex items-center gap-1.5 text-slate-100">
                        <span className={`w-2.5 h-2.5 rounded-full ${signalDot(trafficSignal.ns)}`} />
                        N/S: <strong>{signalLabel(trafficSignal.ns)}</strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom-Left Touch / Click WASD D-Pad (+ Ascend / Descend for Drone & Airplane) */}
                <div className="flex items-end justify-between">
                  <div
                    className="pointer-events-auto select-none flex items-end gap-2"
                    style={{ touchAction: 'none' }}
                  >
                    <div className="grid grid-cols-3 gap-1.5 p-2 rounded-2xl bg-slate-950/85 border border-slate-700/80 shadow-xl">
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setMoveKey('sprint', true);
                        }}
                        onPointerUp={() => setMoveKey('sprint', false)}
                        onPointerCancel={() => setMoveKey('sprint', false)}
                        className="w-10 h-10 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-amber-500 active:text-slate-950 border border-slate-700 text-[10px] font-mono font-bold text-amber-300 flex items-center justify-center cursor-pointer"
                        title="Turbo / Correr (Shift)"
                      >
                        ⚡
                      </button>
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setMoveKey('forward', true);
                        }}
                        onPointerUp={() => setMoveKey('forward', false)}
                        onPointerCancel={() => setMoveKey('forward', false)}
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-emerald-500 active:text-slate-950 border border-slate-600 text-sm font-mono font-bold text-white flex items-center justify-center cursor-pointer"
                        title="Frente / Acelerar (W)"
                      >
                        W
                      </button>
                      <div className="w-10 h-10" />

                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setMoveKey('left', true);
                        }}
                        onPointerUp={() => setMoveKey('left', false)}
                        onPointerCancel={() => setMoveKey('left', false)}
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-emerald-500 active:text-slate-950 border border-slate-600 text-sm font-mono font-bold text-white flex items-center justify-center cursor-pointer"
                        title="Esquerda (A)"
                      >
                        A
                      </button>
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setMoveKey('backward', true);
                        }}
                        onPointerUp={() => setMoveKey('backward', false)}
                        onPointerCancel={() => setMoveKey('backward', false)}
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-emerald-500 active:text-slate-950 border border-slate-600 text-sm font-mono font-bold text-white flex items-center justify-center cursor-pointer"
                        title="Trás / Frear (S)"
                      >
                        S
                      </button>
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          setMoveKey('right', true);
                        }}
                        onPointerUp={() => setMoveKey('right', false)}
                        onPointerCancel={() => setMoveKey('right', false)}
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-emerald-500 active:text-slate-950 border border-slate-600 text-sm font-mono font-bold text-white flex items-center justify-center cursor-pointer"
                        title="Direita (D)"
                      >
                        D
                      </button>
                    </div>

                    {isAirVehicle && (
                      <div className="flex flex-col gap-1.5 p-2 rounded-2xl bg-slate-950/85 border border-sky-700/70 shadow-xl">
                        <button
                          type="button"
                          onPointerDown={(e) => {
                            e.currentTarget.setPointerCapture(e.pointerId);
                            setMoveKey('ascend', true);
                          }}
                          onPointerUp={() => setMoveKey('ascend', false)}
                          onPointerCancel={() => setMoveKey('ascend', false)}
                          className="px-2.5 h-10 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 active:bg-sky-400 active:text-slate-950 border border-sky-500/50 text-xs font-mono font-bold text-sky-200 flex items-center gap-1 cursor-pointer"
                          title="Subir Altitude (Espaço)"
                        >
                          <ArrowUp className="w-3.5 h-3.5" /> Subir
                        </button>
                        <button
                          type="button"
                          onPointerDown={(e) => {
                            e.currentTarget.setPointerCapture(e.pointerId);
                            setMoveKey('descend', true);
                          }}
                          onPointerUp={() => setMoveKey('descend', false)}
                          onPointerCancel={() => setMoveKey('descend', false)}
                          className="px-2.5 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-amber-400 active:text-slate-950 border border-slate-600 text-xs font-mono font-bold text-slate-200 flex items-center gap-1 cursor-pointer"
                          title="Descer Altitude (C)"
                        >
                          <ArrowDown className="w-3.5 h-3.5" /> Descer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

        {/* TAB: FORMULAS INSPECTOR */}
        {activeTab === 'formulas' && (
          <div className="pointer-events-auto absolute inset-0 z-20 bg-slate-950/95 p-6 overflow-y-auto text-slate-200 space-y-6">
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-amber-400" />
                    Detalhamento Matemático dos 6 Passos de Alta Precisão
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                    <span>Fórmulas astronômicas de iluminação solar e orientação 3D avaliadas em tempo real.</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[11px]">
                      Inclinação Axial da Terra na EoT: ε = {solarParams.axialTilt.toFixed(2)}° (Fator y = {Math.pow(Math.tan((solarParams.axialTilt * Math.PI / 180) / 2), 2).toFixed(5)})
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('sim')}
                  className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors cursor-pointer"
                >
                  Voltar à Simulação
                </button>
              </div>

              {/* MODO VISUAL DO MUNDO 3D: VIDA REAL vs PARA A CIDADE (LOCAL) vs GTA VICE CITY */}
              <div className="p-4 rounded-xl bg-slate-900/95 border border-amber-500/40 shadow-lg space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <Sun className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                        Visual do Mundo 3D (Iluminação, Céu & Estética)
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] border ${
                            visualStyle === 'gta_vice_city'
                              ? 'bg-pink-500/20 text-pink-200 border-pink-400/50'
                              : visualStyle === 'local_city'
                                ? 'bg-sky-500/20 text-sky-200 border-sky-400/50'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          }`}
                        >
                          {visualStyle === 'gta_vice_city'
                            ? 'ATIVO: GTA Vice City (1986 Miami)'
                            : visualStyle === 'local_city'
                              ? `ATIVO: Para a Cidade (${localCityProfile.cityName})`
                              : 'ATIVO: Vida Real (100% Realista)'}
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Alterne o visual da simulação 3D em todos os mapas entre física solar 100% realista, atmosfera local da cidade atual ou estética diurna GTA Vice City (Miami 1986).
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('sim')}
                    className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg border border-amber-400 transition-colors cursor-pointer"
                  >
                    Ver no 3D
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Opção 1: Vida Real (100% Realista) */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onChangeVisualStyle?.('real_life')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onChangeVisualStyle?.('real_life');
                      }
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 flex flex-col justify-between ${
                      visualStyle === 'real_life'
                        ? 'bg-slate-950 border-amber-400 shadow-md ring-1 ring-amber-400/35'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-amber-300 font-mono">
                          Vida Real (100% Realista)
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border shrink-0 ${
                            visualStyle === 'real_life'
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-slate-900 text-slate-400 border-slate-700'
                          }`}
                        >
                          {visualStyle === 'real_life' ? 'SELECIONADO' : 'ATIVAR'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Simulação física astronômica 100% fiel à vida real em todos os mapas: dispersão Rayleigh/Mie real do céu, temperatura de cor natural do Sol por altitude, sombras fiéis sem filtro estilizado e exposição realista.
                      </p>
                    </div>
                  </div>

                  {/* Opção 2: Para a Cidade (Usando a Localização Local) */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onChangeVisualStyle?.('local_city')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onChangeVisualStyle?.('local_city');
                      }
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 flex flex-col justify-between ${
                      visualStyle === 'local_city'
                        ? 'bg-slate-950 border-sky-400 shadow-md ring-1 ring-sky-400/35'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-sky-300 font-mono">
                          Para a Cidade (Local)
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyLocalCityPrompt();
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border flex items-center gap-1 cursor-pointer transition-colors ${
                              localCityPromptCopied
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-sky-400/60'
                            }`}
                            title="Copiar prompt atmosférico da cidade local"
                          >
                            {localCityPromptCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {localCityPromptCopied ? 'Copiado!' : 'Copiar'}
                          </button>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                              visualStyle === 'local_city'
                                ? 'bg-sky-500 text-slate-950 border-sky-400'
                                : 'bg-slate-900 text-slate-400 border-slate-700'
                            }`}
                          >
                            {visualStyle === 'local_city' ? 'SELECIONADO' : 'ATIVAR'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-200 border border-sky-500/30 font-bold">
                          {localCityProfile.cityName} ({localCityProfile.countryLabel})
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          {localCityProfile.climateZoneLabel}
                        </span>
                      </div>

                      <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800 font-mono text-[10px] leading-relaxed text-sky-100/90">
                        {localCityProfile.promptText}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDetectLocalGpsForCity();
                          }}
                          disabled={gpsLoading}
                          className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-300 border border-sky-500/40 text-[10px] font-bold font-mono flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                          title="Detectar sua localização local atual via GPS do dispositivo"
                        >
                          {gpsLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Navigation className="w-3 h-3" />
                          )}
                          Usar Meu GPS
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onChangeVisualStyle?.('local_city');
                            onChangeSceneTheme('city_real');
                            onChangeViewMode('landscape');
                            onLoadRealCity?.(
                              solarParams.latitude,
                              solarParams.longitude,
                              localCityProfile.cityName,
                              localCityProfile.countryLabel,
                              false
                            );
                            setActiveTab('sim');
                          }}
                          className="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/50 text-[10px] font-bold font-mono flex items-center gap-1 cursor-pointer transition-colors"
                          title="Abrir o cenário Cidade Real 3D carregado para esta localização local"
                        >
                          <Building2 className="w-3 h-3" />
                          Abrir Cidade Real 3D
                        </button>
                      </div>
                      {gpsStatusMsg && (
                        <span className="text-[10px] font-mono text-amber-300">{gpsStatusMsg}</span>
                      )}
                    </div>
                  </div>

                  {/* Opção 3: GTA Vice City */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onChangeVisualStyle?.('gta_vice_city')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onChangeVisualStyle?.('gta_vice_city');
                      }
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 flex flex-col justify-between ${
                      visualStyle === 'gta_vice_city'
                        ? 'bg-slate-950 border-cyan-400 shadow-md ring-1 ring-pink-400/40'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-cyan-300 font-mono">
                          GTA Vice City (1986 Miami)
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyVicePrompt();
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border flex items-center gap-1 cursor-pointer transition-colors ${
                              vicePromptCopied
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-cyan-400/60'
                            }`}
                            title="Copiar prompt do estilo GTA Vice City"
                          >
                            {vicePromptCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {vicePromptCopied ? 'Copiado!' : 'Copiar'}
                          </button>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                              visualStyle === 'gta_vice_city'
                                ? 'bg-gradient-to-r from-cyan-400 to-pink-400 text-slate-950 border-cyan-300'
                                : 'bg-slate-900 text-slate-400 border-slate-700'
                            }`}
                          >
                            {visualStyle === 'gta_vice_city' ? 'SELECIONADO' : 'ATIVAR'}
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 font-mono text-[10.5px] leading-relaxed text-pink-200/95">
                        {GTA_VICE_CITY_PROMPT}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* PROMPT COMPLETO DO APP PARA COPIAR */}
              <div className="p-4 rounded-xl bg-slate-900/95 border border-amber-500/40 shadow-lg space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        Prompt Completo do APP (Especificação Integral)
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-normal">
                          {APP_MASTER_PROMPT.length} caracteres
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Contém todas as especificações atuais do aplicativo (fórmulas, 597 fusos, Cuba, capitais do Brasil, 5 cenários 3D, Cidade Real, Drone FPV, Google Maps e Gemini).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPromptExpanded((prev) => !prev)}
                      className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                    >
                      {isPromptExpanded ? 'Ocultar Texto' : 'Ver Texto'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyAppPrompt}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
                        promptCopied
                          ? 'bg-emerald-500 text-slate-950 border border-emerald-400'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-400'
                      }`}
                    >
                      {promptCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {isPromptExpanded && (
                  <pre className="max-h-72 overflow-y-auto bg-slate-950/90 p-3.5 rounded-lg border border-slate-800 font-mono text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap select-all">
                    {APP_MASTER_PROMPT}
                  </pre>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formulaSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-colors space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-amber-400 font-mono">{step.title}</h3>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>

                    <p className="text-xs text-slate-300">{step.description}</p>

                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300 whitespace-pre-wrap">
                      {step.formulaRaw}
                    </div>

                    <div className="bg-amber-950/30 p-2.5 rounded-lg border border-amber-500/20 font-mono text-xs text-amber-200">
                      <strong>Resultado Calculado:</strong> {step.formulaEvaluated}
                    </div>

                    <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
                      <div className="font-semibold text-slate-300">Variáveis em Execução:</div>
                      {Object.entries(step.variables).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span>{k}:</span>
                          <span className="text-slate-100 font-bold">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: UNIFIED GOOGLE MAPS PLATFORM, FUSOS & BASE NOAA */}
        {(activeTab === 'maps' || activeTab === 'noaa') && (
          <div className="pointer-events-auto absolute inset-0 z-20 bg-slate-950 flex flex-col">
            <GoogleMapsSolarView
              apiKey={mapsApiKey || ''}
              solarParams={solarParams}
              solarResults={solarResults}
              onUpdateParams={onUpdateParams}
              onClose={() => setActiveTab('sim')}
              initialSelectedNoaaId={selectedLocationId}
            />
          </div>
        )}

        {/* TAB: GEMINI SOLAR ADVISOR AI */}
        {activeTab === 'ai' && (
          <div className="pointer-events-auto absolute inset-0 z-20 bg-slate-950/95 p-6 overflow-y-auto text-slate-200 space-y-6">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    Gemini Solar Advisor - Inteligência com Busca na Web
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Equipado com busca na web em tempo real (Google Search Grounding) e análise da mecânica celeste.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('sim')}
                  className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors"
                >
                  Voltar à Simulação
                </button>
              </div>

              {/* QUICK PROMPT CHIPS */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono text-slate-400">Sugestões rápidas (com busca em tempo real):</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Que horas são em Tóquio segundo o site timeanddate?',
                    'Qual é o fuso horário oficial e horário de verão em Tóquio?',
                    'Qual é a diferença entre o Meio-Dia Solar Verdadeiro e o Meio-Dia Civil?',
                    'Como a inclinação axial de 23.44° gera as quatro estações do ano?',
                    'Qual é a Equação do Tempo no solstício de verão?'
                  ].map((chip) => (
                    <button
                      key={chip}
                      onClick={() => handleAskAi(chip)}
                      className="px-3 py-1 text-xs rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-slate-300 transition-colors text-left"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* INPUT BOX */}
              <div className="flex gap-3">
                <input
                  type="text"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAskAi()}
                  placeholder="Ex: Que horas são em Tóquio segundo o site timeanddate? Ou pergunte sobre a luz solar..."
                  className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={() => handleAskAi()}
                  disabled={aiLoading}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {aiLoading ? (
                    <span className="animate-pulse">Consultando...</span>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Enviar
                    </>
                  )}
                </button>
              </div>

              {aiResponse && (
                <div className="p-6 rounded-xl bg-slate-900 border border-amber-500/30 text-sm leading-relaxed text-slate-200 whitespace-pre-wrap font-sans space-y-4">
                  <div>{aiResponse}</div>

                  {aiSources.length > 0 && (
                    <div className="pt-4 border-t border-slate-800 space-y-2">
                      <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5 font-mono">
                        <Globe className="w-3.5 h-3.5" /> Fontes e Citações da Web (Google Search Grounding):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {aiSources.map((src, i) => (
                          <a
                            key={i}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-sky-300 hover:text-sky-200 hover:border-sky-500/40 text-xs transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span className="truncate max-w-[220px]">{src.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. UNIFIED COLLAPSIBLE BOTTOM DOCK (Modo Cinema / Painel Principal Rolável) */}
      <div className="pointer-events-auto relative z-30 flex flex-col items-center pb-3 px-4 shrink-0">
        {/* Collapse / Expand Toggle Button */}
        <button
          onClick={() => setIsDockCollapsed(!isDockCollapsed)}
          className="px-3 py-1 bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-t border-x border-slate-700 rounded-t-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-lg cursor-pointer"
        >
          {isDockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> Mostrar Painel (Modo Cinema)
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-amber-400" /> Ocultar Painel (Modo Cinema)
            </>
          )}
        </button>

        {!isDockCollapsed && (
          <div className="w-full max-w-5xl max-h-[44vh] overflow-y-auto overscroll-contain p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-slate-200 shadow-2xl backdrop-blur-md space-y-4">
            
            {/* ROW 1: INCLINAÇÃO AXIAL DA TERRA (0° A 90° - PADRÃO TERRA 23.44°) */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-amber-500/30 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Orbit className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    Inclinação Axial da Terrestre (Tilt de 0° a 90°):
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Padrão Terra = <strong className="text-amber-300">23.44°</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="90"
                    value={solarParams.axialTilt}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(90, parseFloat(e.target.value) || 0));
                      onUpdateParams({ axialTilt: val });
                    }}
                    className="w-20 px-2 py-1 bg-slate-900 border border-emerald-500/40 rounded text-xs font-mono text-emerald-300 text-right font-bold focus:outline-none focus:border-emerald-400"
                  />
                  <span className="text-xs font-mono text-emerald-400">°</span>
                </div>
              </div>

              {/* SLIDER & PRESETS */}
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex-1 w-full flex items-center gap-3">
                  <span className="text-[10px] font-mono text-slate-400">0°</span>
                  <input
                    type="range"
                    min="0"
                    max="90"
                    step="0.01"
                    value={solarParams.axialTilt}
                    onChange={(e) => onUpdateParams({ axialTilt: parseFloat(e.target.value) || 0 })}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-slate-400">90°</span>
                </div>

                {/* PRESET PLANET BUTTONS */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onUpdateParams({ axialTilt: 23.44 })}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors ${
                      solarParams.axialTilt === 23.44
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    🌍 Terra (23.44°)
                  </button>
                  <button
                    onClick={() => onUpdateParams({ axialTilt: 25.19 })}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors ${
                      solarParams.axialTilt === 25.19
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    🔴 Marte (25.19°)
                  </button>
                  <button
                    onClick={() => onUpdateParams({ axialTilt: 90 })}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors ${
                      solarParams.axialTilt === 90
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    🪐 Máximo (90.00°)
                  </button>
                  <button
                    onClick={() => onUpdateParams({ axialTilt: 0 })}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors ${
                      solarParams.axialTilt === 0
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    ☀️ Zero (0.00°)
                  </button>
                </div>
              </div>
            </div>

            {/* ROW: ESCOLHA DO LOCAL & DO SISTEMA DE FUSO HORÁRIO */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-sky-500/30 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold text-sky-300 font-mono">
                    Escolher o Local & Sistema de Fuso Horário:
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Lat <strong>{solarParams.latitude.toFixed(2)}°</strong>, Lon <strong>{solarParams.longitude.toFixed(2)}°</strong>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                    Estação Local: <strong className="text-amber-300">{solarResults.seasonInfo.seasonName}</strong>{' '}
                    <span className="text-slate-500">
                      (Norte LAT+: {solarResults.seasonInfo.northHemisphereSeason} · Sul LAT-: {solarResults.seasonInfo.southHemisphereSeason})
                    </span>
                  </span>
                </div>

                {/* Próxima Transição de Estação (UTC -> Hora Local & Dia XX-XX-XXXX) */}
                {Math.abs(solarParams.axialTilt) >= 0.01 && (
                  <div className="w-full flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-[11px] font-mono">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-indigo-300 font-bold">
                        ⏳ Próxima Transição ({solarResults.seasonInfo.nextTransition.eventName}):
                      </span>
                      <span className="text-amber-300 font-bold">
                        Inicia {solarResults.seasonInfo.nextTransition.nextSeasonName}
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-300">
                        Dia: <strong className="text-white">{solarResults.seasonInfo.nextTransition.transitionLocalDateFormatted}</strong>
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-300">
                        Hora Local:{' '}
                        <strong className="text-emerald-300">
                          {solarResults.seasonInfo.nextTransition.transitionLocalTimeFormatted}
                        </strong>{' '}
                        <span className="text-slate-400">
                          (UTC{solarResults.seasonInfo.nextTransition.transitionOffsetHours >= 0 ? '+' : ''}
                          {Number(solarResults.seasonInfo.nextTransition.transitionOffsetHours.toFixed(2))})
                        </span>
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-400 text-[10px]">
                        UTC Base: {solarResults.seasonInfo.nextTransition.transitionUtcFormatted}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateParams({
                          referenceDate: new Date(solarResults.seasonInfo.nextTransition.transitionUtcDate.getTime()),
                        })
                      }
                      className="px-2 py-0.5 rounded bg-indigo-500/30 hover:bg-indigo-500/50 text-indigo-100 font-bold text-[10px] border border-indigo-400/40 cursor-pointer transition-colors"
                    >
                      Ir para Transição
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTimezoneModalTab('systems');
                      setIsTimezoneModalOpen(true);
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    title="Mudar fuso horário ou escolher sistema de fuso"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-400" /> Mudar Fuso Horário
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTimezoneModalTab('all_zones');
                      setIsTimezoneModalOpen(true);
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    title="Explorar todas as opções de fusos do computador divididas por Cidade e Versão"
                  >
                    <Globe className="w-3.5 h-3.5 text-emerald-400" /> {COMPUTER_TZ_STATS.totalOptions} Fusos por Cidade & Versão
                  </button>
                  <button
                    onClick={() => setActiveTab('maps')}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" /> Procurar no Google Maps & Base NOAA
                  </button>
                </div>

                {/* Pronúncia & Sigla Oficial do Fuso Horário no Local */}
                {(() => {
                  const targetTz =
                    activeSystemMeta.ianaZoneOverride ||
                    historicalInfo?.timeZoneId ||
                    solarParams.timeZoneId ||
                    'UTC';
                  const pron = getTimezonePronunciation(
                    targetTz,
                    historicalInfo?.timezoneAbbrev || `UTC${solarParams.civilTimezoneOffset >= 0 ? '+' : ''}${solarParams.civilTimezoneOffset}`,
                    historicalInfo?.offsetHours ?? solarParams.civilTimezoneOffset,
                    solarParams.referenceDate
                  );
                  return (
                    <div className="w-full flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-amber-500/30 text-[11px] font-mono">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-extrabold text-[11px] tracking-wide">
                          {pron.abbrev}
                        </span>
                        <span className="text-slate-100 font-semibold">{pron.fullNamePt}</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-amber-300">
                          Pronúncia: <strong className="text-amber-200 font-semibold">{pron.pronunciationGuide}</strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => speakTimezonePronunciation(pron)}
                        className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                        title="Ouvir pronúncia da sigla e do nome do fuso horário"
                      >
                        <Volume2 className="w-3 h-3" /> Ouvir Pronúncia
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* Sistema de Fuso Horário Buttons (Todos os 14 Sistemas) */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-300">
                  <span className="font-bold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" /> Todos os Sistemas de Fuso ({ALL_TIMEZONE_SYSTEMS.length}):
                  </span>
                  <div className="flex flex-wrap items-center gap-2 max-w-full">
                    {solarResults.specialClockDisplay && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold text-[10px]">
                        {solarResults.specialClockDisplay}
                      </span>
                    )}
                    {(activeSystemMode === 'noaa_official' || Boolean(activeSystemMeta.ianaZoneOverride)) &&
                      (() => {
                        const targetTz =
                          activeSystemMeta.ianaZoneOverride ||
                          solarResults.historicalTimezoneInfo?.timeZoneId ||
                          solarParams.timeZoneId ||
                          '';
                        const nextDst = findNextDstTransition(targetTz, solarParams.referenceDate);
                        if (!nextDst.hasTransition) return null;
                        return (
                          <span
                            className="px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/40 text-indigo-200 text-[10px]"
                            title={`Próxima mudança de Horário de Verão (${targetTz})`}
                          >
                            ⏰ Próx. Mudança DST: <strong>{nextDst.transitionLocalDateFormatted}</strong> {nextDst.transitionLocalTimeFormatted} ({nextDst.directionLabel})
                          </span>
                        );
                      })()}
                    <span className="text-amber-400 font-semibold truncate max-w-[340px]">
                      {solarResults.timezoneSystemDescription}
                    </span>
                  </div>
                </div>

                {/* Category Filter Chips */}
                <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono">
                  {TIMEZONE_SYSTEM_CATEGORIES.map((cat) => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setDockTzCategory(cat.id)}
                      className={`px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                        dockTzCategory === cat.id
                          ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                          : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
                  {filteredDockSystems.map((sys) => {
                    const isActive = activeSystemMode === sys.id;
                    return (
                      <button
                        type="button"
                        key={sys.id}
                        onClick={() => onUpdateParams({ timezoneSystemMode: sys.id })}
                        title={sys.description}
                        className={`p-1.5 rounded-xl border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
                          isActive
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm font-bold'
                            : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        <span className="text-[11px] flex items-center gap-1 truncate">
                          <span>{sys.icon}</span>
                          <span className="truncate">{sys.shortName}</span>
                        </span>
                        <span className="text-[9px] text-slate-400 font-normal truncate">{sys.badgeHint}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Inline Manual Offset Stepper & Presets when Manual mode is active */}
                {solarParams.timezoneSystemMode === 'manual_custom' && (
                  <div className="mt-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Offset Manual:</span>
                      <button
                        type="button"
                        onClick={() => onUpdateParams({ civilTimezoneOffset: Math.max(-12, solarParams.civilTimezoneOffset - 1) })}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
                      >
                        -1h
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateParams({ civilTimezoneOffset: Math.max(-12, solarParams.civilTimezoneOffset - 0.5) })}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                      >
                        -30m
                      </button>
                      <span className="font-bold text-amber-400 text-xs min-w-[70px] text-center">
                        UTC{solarParams.civilTimezoneOffset >= 0 ? '+' : ''}{solarParams.civilTimezoneOffset}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateParams({ civilTimezoneOffset: Math.min(14, solarParams.civilTimezoneOffset + 0.5) })}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                      >
                        +30m
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateParams({ civilTimezoneOffset: Math.min(14, solarParams.civilTimezoneOffset + 1) })}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
                      >
                        +1h
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {[-10, -8, -5, -3, 0, 1, 2, 3, 5.5, 8, 9, 12].map((off) => (
                        <button
                          type="button"
                          key={off}
                          onClick={() => onUpdateParams({ civilTimezoneOffset: off })}
                          className={`px-1.5 py-0.5 rounded text-[10px] cursor-pointer ${
                            solarParams.civilTimezoneOffset === off
                              ? 'bg-amber-500 text-slate-950 font-bold'
                              : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                          }`}
                        >
                          {off >= 0 ? `+${off}` : off}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Preset Locations */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                <span className="text-slate-400 mr-1">Locais Rápidos:</span>
                {[
                  { name: 'Londres 🇬🇧', lat: 51.5033, lon: -0.1197, id: 'Europe/London' },
                  { name: 'Brasília 🇧🇷', lat: -15.7938, lon: -47.8827, id: 'America/Sao_Paulo' },
                  { name: 'Recife 🇧🇷', lat: -8.0476, lon: -34.8770, id: 'America/Recife' },
                  { name: 'Salvador 🇧🇷', lat: -12.9714, lon: -38.5014, id: 'America/Bahia' },
                  { name: 'Manaus 🇧🇷', lat: -3.1190, lon: -60.0217, id: 'America/Manaus' },
                  { name: 'Cuiabá 🇧🇷', lat: -15.6014, lon: -56.0979, id: 'America/Cuiaba' },
                  { name: 'Campo Grande 🇧🇷', lat: -20.4697, lon: -54.6201, id: 'America/Campo_Grande' },
                  { name: 'Belém 🇧🇷', lat: -1.4558, lon: -48.5044, id: 'America/Belem' },
                  { name: 'Altamira (Oeste PA) 🇧🇷', lat: -3.2033, lon: -52.2064, id: 'America/Santarem' },
                  { name: 'Palmas / Araguaína 🇧🇷', lat: -10.2491, lon: -48.3243, id: 'America/Araguaina' },
                  { name: 'Havana 🇨🇺', lat: 23.1136, lon: -82.3666, id: 'America/Havana' },
                  { name: 'Nova York 🇺🇸', lat: 40.7128, lon: -74.0060, id: 'America/New_York' },
                  { name: 'Marrocos 🇲🇦', lat: 33.5731, lon: -7.5898, id: 'Africa/Casablanca' },
                  { name: 'Tóquio 🇯🇵', lat: 35.6762, lon: 139.6503, id: 'Asia/Tokyo' },
                  { name: 'Sydney 🇦🇺', lat: -33.8688, lon: 151.2093, id: 'Australia/Sydney' },
                  { name: 'Nova Delhi 🇮🇳', lat: 28.6139, lon: 77.2090, id: 'Asia/Kolkata' },
                  { name: 'Kiritimati 🇰🇮', lat: 1.8721, lon: -157.4278, id: 'Pacific/Kiritimati' },
                ].map((item) => (
                  <button
                    key={item.name}
                    onClick={() => onUpdateParams({ latitude: item.lat, longitude: item.lon, timeZoneId: item.id })}
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>

            {/* ROW 2: PRECISE TEXT INPUT FOR DATE XX/XX/XXXX, TIME XX:XX:XX, AND UTC OFFSET +/- */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" /> Entrada Direta por Texto de Data (DD/MM/YYYY), Hora (HH:MM:SS) & Fuso UTC (+/-):
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Formato: <strong className="text-slate-200">DD/MM/YYYY</strong> | <strong className="text-slate-200">HH:MM:SS</strong> | <strong className="text-slate-200">UTC +/-</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Data (XX/XX/XXXX):</label>
                  <input
                    type="text"
                    value={dateTextInput}
                    onChange={(e) => setDateTextInput(e.target.value)}
                    placeholder="01/01/2027"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Hora (XX:XX:XX):</label>
                  <input
                    type="text"
                    value={timeTextInput}
                    onChange={(e) => setTimeTextInput(e.target.value)}
                    placeholder="12:00:00"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Fuso (UTC +/-):</label>
                  <input
                    type="text"
                    value={utcOffsetTextInput}
                    onChange={(e) => setUtcOffsetTextInput(e.target.value)}
                    placeholder="-3.0"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="pt-4 md:pt-0">
                  <button
                    onClick={handleApplyCustomTextDateTime}
                    className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Aplicar Data, Hora & UTC
                  </button>
                </div>
              </div>
            </div>

            {/* ROW 3: 360 DEGREE CAMERA CONTROL PRESETS (PANORÂMICA ELEVADA + EXATAMENTE NO CHÃO) */}
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2.5">
              {/* Sub-row 1: Câmera 360° Elevada / Panorâmica */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 font-mono mr-1">
                    <Camera className="w-3.5 h-3.5 text-sky-400" /> Câmera:
                  </span>
                  <button
                    onClick={() => onChangeCameraPreset('free360')}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${
                      cameraPreset === 'free360' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    🔄 Órbita
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeViewMode('landscape');
                      onChangeCameraPreset(cameraPreset === 'drone' ? 'free360' : 'drone');
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                      viewMode === 'landscape' && cameraPreset === 'drone'
                        ? 'bg-sky-500 text-slate-950 font-bold'
                        : 'bg-slate-900 text-sky-300 hover:bg-slate-800 border border-sky-500/40'
                    }`}
                    title="Voar com a Câmera como um Drone FPV 6-DoF em qualquer cenário (WASD + Espaço/C + Mouse/Touch)"
                  >
                    <Navigation className="w-3.5 h-3.5" /> Drone na Câmera
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeViewMode('landscape');
                      if (
                        sceneTheme !== 'city_cars' &&
                        sceneTheme !== 'city_people' &&
                        sceneTheme !== 'city_real' &&
                        sceneTheme !== 'farm' &&
                        sceneTheme !== 'solar_time'
                      ) {
                        onChangeSceneTheme('city_real');
                      }
                      onChangeCameraPreset(cameraPreset === 'person' ? 'free360' : 'person');
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                      viewMode === 'landscape' &&
                      (sceneTheme === 'city_cars' || sceneTheme === 'city_people' || sceneTheme === 'city_real' || sceneTheme === 'farm' || sceneTheme === 'solar_time') &&
                      cameraPreset === 'person'
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-900 text-emerald-300 hover:bg-slate-800 border border-emerald-500/40'
                    }`}
                    title="Explorar livremente usando W, A, S, D e Touch/Mouse (Hora Solar, Cidade Real, Cidade De Carros, Cidade De Pessoas ou Fazenda)"
                  >
                    <Footprints className="w-3.5 h-3.5" /> Modo Pessoa (WASD)
                  </button>
                  <button
                    onClick={() => onChangeCameraPreset('zenith')}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${
                      cameraPreset === 'zenith' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    🔝 Zênite
                  </button>
                  <button
                    onClick={() => onChangeCameraPreset('north')}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                      cameraPreset === 'north' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                    title="Norte (0°)"
                  >
                    ⬆️ N
                  </button>
                  <button
                    onClick={() => onChangeCameraPreset('northeast')}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                      cameraPreset === 'northeast' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                    title="Nordeste (45°)"
                  >
                    ↗️ NE
                  </button>
                  <button
                    onClick={() => onChangeCameraPreset('east')}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                      cameraPreset === 'east' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                    title="Leste (90°)"
                  >
                    ➡️ L
                  </button>
                  <button
                    onClick={() => onChangeCameraPreset('southeast')}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                      cameraPreset === 'southeast' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                    title="Sudeste (135°)"
                  >
                    ↘️ SE
                  </button>
                  <button
                    onClick={() => onChangeCameraPreset('south')}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                      cameraPreset === 'south' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                    title="Sul (180°)"
                  >
                    ⬇️ S
                  </button>
                  <button
                    onClick={() => onChangeCameraPreset('southwest')}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                      cameraPreset === 'southwest' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                    title="Sudoeste (225°)"
                  >
                    ↙️ SO
                  </button>
                  <button
                    onClick={() => onChangeCameraPreset('west')}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                      cameraPreset === 'west' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                    title="Oeste (270°)"
                  >
                    ⬅️ O
                  </button>
                  <button
                    onClick={() => onChangeCameraPreset('northwest')}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                      cameraPreset === 'northwest' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                    title="Noroeste (315°)"
                  >
                    ↖️ NO
                  </button>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono rounded-md border ${
                      viewMode === 'landscape' && cameraPreset === 'drone'
                        ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                        : viewMode === 'landscape' &&
                          (sceneTheme === 'city_cars' || sceneTheme === 'city_people' || sceneTheme === 'city_real' || sceneTheme === 'farm' || sceneTheme === 'solar_time') &&
                          cameraPreset === 'person'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          : cameraPreset === 'free360'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                            : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    {viewMode === 'landscape' && cameraPreset === 'drone'
                      ? 'Movimento: Drone na Câmera (FPV)'
                      : viewMode === 'landscape' &&
                        (sceneTheme === 'city_cars' || sceneTheme === 'city_people' || sceneTheme === 'city_real' || sceneTheme === 'farm' || sceneTheme === 'solar_time') &&
                        cameraPreset === 'person'
                        ? 'Movimento: Modo Pessoa / Veículo'
                        : cameraPreset === 'free360'
                          ? 'Movimento: Órbita Livre'
                          : 'Câmera Fixa (Movimento bloqueado)'}
                  </span>
                </div>

                {/* View Mode, Scenario Selector (Padrão / Cidade Real / Cidade De Carros / Cidade De Pessoas / Fazenda / Globo) */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        onChangeSceneTheme('default');
                        onChangeViewMode('landscape');
                        if (cameraPreset === 'person') {
                          onChangeCameraPreset('free360');
                        }
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                        viewMode === 'landscape' && sceneTheme === 'default'
                          ? 'bg-slate-800 text-amber-400 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Cenário Padrão com Relógio de Sol e Árvores sobre Horizonte da Terra"
                    >
                      <Trees className="w-3.5 h-3.5" /> Padrão
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onChangeSceneTheme('city_real');
                        onChangeViewMode('landscape');
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                        viewMode === 'landscape' && sceneTheme === 'city_real'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-400/50 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Cidade Real: Qualquer cidade do mundo adaptada em 3D com subida em prédios, Drone, Avião e Carro"
                    >
                      <Building2 className="w-3.5 h-3.5" /> Cidade Real
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onChangeSceneTheme('city_cars');
                        onChangeViewMode('landscape');
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                        viewMode === 'landscape' && sceneTheme === 'city_cars'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Cidade De Carros: Avenidas de 4 faixas, 18 carros, semáforos, postes ≤ -3° e arranha-céus ≤ -4,5°"
                    >
                      <Car className="w-3.5 h-3.5" /> Cidade De Carros
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onChangeSceneTheme('city_people');
                        onChangeViewMode('landscape');
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                        viewMode === 'landscape' && sceneTheme === 'city_people'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Cidade De Pessoas: Calçadões amplos, cafés, bancos, árvores, pessoas andando e iluminação noturna"
                    >
                      <Users className="w-3.5 h-3.5" /> Cidade De Pessoas
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onChangeSceneTheme('farm');
                        onChangeViewMode('landscape');
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                        viewMode === 'landscape' && sceneTheme === 'farm'
                          ? 'bg-lime-500/20 text-lime-300 border border-lime-500/40 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Fazenda: Celeiro, Silo, Catavento, Trator, Vacas, Postes ≤ -3° e Casas/Celeiro ≤ -4,5°"
                    >
                      <Tractor className="w-3.5 h-3.5" /> Fazenda
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onChangeSceneTheme('solar_time');
                        onChangeViewMode('landscape');
                        if (cameraPreset !== 'free360' && cameraPreset !== 'zenith' && cameraPreset !== 'drone' && cameraPreset !== 'person') {
                          onChangeCameraPreset('free360');
                        }
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                        viewMode === 'landscape' && sceneTheme === 'solar_time'
                          ? 'bg-amber-500/25 text-amber-200 border border-amber-400/60 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Hora Solar: Relógio Solar de Chão 24h por Sombra (12:00 cima / 00:00 baixo) e Versões de Parede 100% Em Pé (90°), Inclinada (67,5°) e Inclinada (45°) com rotação 0°–360°"
                    >
                      <Clock className="w-3.5 h-3.5" /> Hora Solar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onChangeViewMode('globe');
                        if (cameraPreset === 'person') {
                          onChangeCameraPreset('free360');
                        }
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                        viewMode === 'globe' ? 'bg-slate-800 text-sky-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" /> Globo
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={onToggleVectors}
                    className={`px-2.5 py-1 text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
                      showVectors
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    Raio Solar 3D
                  </button>
                </div>
              </div>

              {/* CIDADE REAL CONTROLS (SEARCH ANY WORLD CITY + CLIMB / DRONE / PLANE / CAR) */}
              {viewMode === 'landscape' && sceneTheme === 'city_real' && (
                <div className="p-3 rounded-xl bg-slate-900/95 border border-sky-500/40 space-y-2.5 text-[11px] font-mono">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Building2 className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="font-bold text-sky-300">
                        Cidade Real 3D: {realCityData?.cityName || 'Carregando...'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 text-[10px]">
                        {realCityData?.source === 'osm'
                          ? `OSM Real (${realCityData.buildings.length} prédios · ${realCityData.roads.length} vias)`
                          : `Adaptada (${realCityData?.buildings.length ?? 0} prédios)`}
                      </span>
                      {realCityLoading && (
                        <span className="inline-flex items-center gap-1 text-amber-300 text-[10px]">
                          <Loader2 className="w-3 h-3 animate-spin" /> Adaptando cidade...
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-bold ${
                          solarResults.solarAltitudeDeg <= -3.0
                            ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <Lightbulb className="w-3 h-3" />
                        Postes ≤ -3°: {solarResults.solarAltitudeDeg <= -3.0 ? 'ON' : 'OFF'}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-bold ${
                          solarResults.solarAltitudeDeg <= -4.5
                            ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <Building2 className="w-3 h-3" />
                        Prédios ≤ -4,5°: {solarResults.solarAltitudeDeg <= -4.5 ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  </div>

                  {/* World City Search + Sync Current Coordinates */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex-1 min-w-[220px] flex items-center gap-1.5">
                      <input
                        type="text"
                        value={realCityQuery}
                        onChange={(e) => setRealCityQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchRealCity()}
                        placeholder="Digite qualquer cidade do mundo (ex: Tóquio, Paris, Havana, NY)..."
                        className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-sky-400"
                      />
                      <button
                        type="button"
                        onClick={handleSearchRealCity}
                        disabled={realCitySearching}
                        className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {realCitySearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                        Adaptar Cidade
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onLoadRealCity?.(
                          solarParams.latitude,
                          solarParams.longitude,
                          `Lat ${solarParams.latitude.toFixed(2)}°, Lon ${solarParams.longitude.toFixed(2)}°`,
                          'Mundo',
                          false
                        )
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-[10px] cursor-pointer"
                      title="Adaptar a Cidade Real para as coordenadas atuais selecionadas"
                    >
                      📍 Usar Coordenada Atual
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsRealCityGlobalMapOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                      title="Abrir o Mapa Global Interativo com o mundo todo, terminador solar e voo instantâneo direto na Cidade Real"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      🗺️ Mapa Global (Mundo Todo)
                    </button>
                  </div>

                  {/* Disambiguation dropdown if multiple city results match */}
                  {realCityResults.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-slate-950 border border-sky-500/40">
                      <span className="text-[10px] text-sky-300 font-bold mr-1">Resultados:</span>
                      {realCityResults.slice(0, 6).map((c, idx) => (
                        <div key={`${c.lat}_${c.lng}_${idx}`} className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onLoadRealCity?.(c.lat, c.lng, c.name, c.country, true);
                              setRealCityResults([]);
                            }}
                            className="px-2 py-0.5 rounded-l bg-slate-900 hover:bg-sky-500/20 border border-slate-700 hover:border-sky-400 text-slate-200 text-[10px] cursor-pointer"
                            title="Abrir cidade instantaneamente"
                          >
                            {c.displayName}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onStartGlobalPlaneFlight?.(c.lat, c.lng, c.name, c.country);
                              setRealCityResults([]);
                            }}
                            className="px-1.5 py-0.5 rounded-r bg-indigo-500/25 hover:bg-indigo-500/45 border border-indigo-500/50 text-indigo-200 text-[10px] font-bold cursor-pointer"
                            title={`Viajar de avião para ${c.name} em segundos`}
                          >
                            ✈️ Voar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Region Filter + Quick World City Chips (Click to load or Fly by Airplane) */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[10px] text-slate-400 mr-1">Destinos ({WORLD_CITY_PRESETS.length} globais):</span>
                        {(
                          [
                            'Todos',
                            'Brasil',
                            'Américas',
                            'Europa',
                            'África & Oriente',
                            'Ásia',
                            'Oceania',
                          ] as const
                        ).map((reg) => (
                          <button
                            key={`dock_reg_${reg}`}
                            type="button"
                            onClick={() => setRealCityRegionFilter(reg)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                              realCityRegionFilter === reg
                                ? 'bg-sky-500 text-slate-950 border-sky-300'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                            }`}
                          >
                            {reg}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsRealCityGlobalMapOpen(true)}
                        className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-sky-500/40 text-sky-300 text-[10px] font-bold cursor-pointer"
                      >
                        🌍 Ver Tudo no Mapa
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1 max-h-20 overflow-y-auto pr-1">
                      {(realCityRegionFilter === 'Todos'
                        ? WORLD_CITY_PRESETS.slice(0, 16)
                        : WORLD_CITY_PRESETS.filter((c) => c.region === realCityRegionFilter)
                      ).map((c) => {
                        const distKm = Math.round(
                          haversineDistanceKm(solarParams.latitude, solarParams.longitude, c.lat, c.lng)
                        );
                        return (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() =>
                              realCityVehicleMode === 'plane'
                                ? onStartGlobalPlaneFlight?.(c.lat, c.lng, c.name, c.country)
                                : onLoadRealCity?.(c.lat, c.lng, c.name, c.country, true)
                            }
                            className={`px-2 py-0.5 rounded text-[10px] border cursor-pointer transition-colors ${
                              realCityData?.cityName === c.name
                                ? 'bg-sky-500/20 text-sky-200 border-sky-400 font-bold'
                                : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                            }`}
                            title={
                              realCityVehicleMode === 'plane'
                                ? `Viajar de avião para ${c.displayName} (${distKm.toLocaleString('pt-BR')} km) em ${formatFlightDuration(planeFlightDurationSec)}`
                                : `Adaptar Cidade Real para ${c.displayName} (${distKm.toLocaleString('pt-BR')} km)`
                            }
                          >
                            {realCityVehicleMode === 'plane' ? `✈️ ${c.name}` : c.name}
                            {distKm > 10 && (
                              <span className="text-slate-500 ml-1">{distKm.toLocaleString('pt-BR')} km</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Exploration / Vehicles Switcher: Subir Prédios, Levantar Drone, Pilotar Avião, Dirigir Carro */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-slate-400 font-bold text-[10px]">Explorar Cidade Real:</span>
                      <button
                        type="button"
                        onClick={() => onChangeRealCityVehicleMode?.('walk')}
                        className={`px-2.5 py-1 rounded-lg border font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                          cameraPreset === 'person' && realCityVehicleMode === 'walk'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : 'bg-slate-950 text-emerald-300 border-emerald-500/40 hover:bg-slate-800'
                        }`}
                      >
                        <Footprints className="w-3.5 h-3.5" /> A Pé / Subir Prédios
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeRealCityVehicleMode?.('drone')}
                        className={`px-2.5 py-1 rounded-lg border font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                          cameraPreset === 'person' && realCityVehicleMode === 'drone'
                            ? 'bg-sky-500 text-slate-950 border-sky-400'
                            : 'bg-slate-950 text-sky-300 border-sky-500/40 hover:bg-slate-800'
                        }`}
                      >
                        <Navigation className="w-3.5 h-3.5" /> Levantar Drone
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeRealCityVehicleMode?.('plane')}
                        className={`px-2.5 py-1 rounded-lg border font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                          cameraPreset === 'person' && realCityVehicleMode === 'plane'
                            ? 'bg-indigo-500 text-white border-indigo-400'
                            : 'bg-slate-950 text-indigo-300 border-indigo-500/40 hover:bg-slate-800'
                        }`}
                      >
                        <Plane className="w-3.5 h-3.5" /> Avião
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeRealCityVehicleMode?.('car')}
                        className={`px-2.5 py-1 rounded-lg border font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                          cameraPreset === 'person' && realCityVehicleMode === 'car'
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-slate-950 text-amber-300 border-amber-500/40 hover:bg-slate-800'
                        }`}
                      >
                        <Car className="w-3.5 h-3.5" /> Dirigir Carro
                      </button>
                    </div>

                    {cameraPreset === 'person' && realCityVehicleMode === 'walk' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (realCityActionRef?.current) {
                            realCityActionRef.current.action = 'climb_nearest';
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 font-bold text-[10px] cursor-pointer"
                      >
                        🪜 Subir Prédio Próximo ({realCityTelemetry?.nearestBuildingHeight ?? 15}m)
                      </button>
                    )}
                  </div>

                  {realCityVehicleMode === 'plane' && (
                    <div className="space-y-2 pt-1.5 border-t border-slate-800/80">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/35">
                        <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          Horário do Voo (Padrão Aviação Zulu):
                        </span>
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <strong className="text-white tabular-nums">
                            {formatUtcHMS(solarParams.referenceDate)} UTC+0 (Z)
                          </strong>
                          <span className="text-slate-400 text-[10px]">
                            {formatUtcDateShort(solarParams.referenceDate)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Plane className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="text-[11px] font-bold text-indigo-300">
                            Altura Máxima do Avião (máx. 11 km):
                          </span>
                          <span className="text-[11px] font-mono text-amber-300 font-bold">
                            {planeMaxAltitudeM >= 1000
                              ? `${(planeMaxAltitudeM / 1000).toFixed(2).replace('.', ',')} km (${planeMaxAltitudeM.toLocaleString('pt-BR')} m)`
                              : `${planeMaxAltitudeM} m`}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px] justify-end">
                          <input
                            type="range"
                            min={PLANE_MIN_CEILING_M}
                            max={PLANE_MAX_CEILING_M}
                            step={50}
                            value={planeMaxAltitudeM}
                            onChange={(e) => onChangePlaneMaxAltitudeM?.(Number(e.target.value))}
                            className="w-36 sm:w-48 accent-indigo-400 cursor-pointer h-1.5"
                            aria-label="Selecionar altura máxima do avião até 11 km"
                          />
                          <input
                            type="number"
                            min={PLANE_MIN_CEILING_M}
                            max={PLANE_MAX_CEILING_M}
                            step={50}
                            value={planeMaxAltitudeM}
                            onChange={(e) => {
                              const raw = Number(e.target.value);
                              if (!Number.isNaN(raw)) {
                                onChangePlaneMaxAltitudeM?.(raw);
                              }
                            }}
                            className="w-20 px-2 py-0.5 rounded bg-slate-950 border border-indigo-500/40 text-right font-mono text-[11px] font-bold text-indigo-200 focus:outline-none focus:border-indigo-400"
                            aria-label="Valor em metros da altura máxima do avião"
                          />
                          <div className="flex items-center gap-1">
                            {[
                              { m: 220, label: '220m' },
                              { m: 500, label: '500m' },
                              { m: 1000, label: '1 km' },
                              { m: 3000, label: '3 km' },
                              { m: 6000, label: '6 km' },
                              { m: 11000, label: '11 km' },
                            ].map((preset) => (
                              <button
                                key={preset.m}
                                type="button"
                                onClick={() => onChangePlaneMaxAltitudeM?.(preset.m)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer transition-colors ${
                                  planeMaxAltitudeM === preset.m
                                    ? 'bg-indigo-500 text-white border-indigo-300'
                                    : 'bg-slate-950 text-slate-300 border-slate-700 hover:bg-slate-800'
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Tempo da Viagem de Avião (mín. 1s · Segundo, Minuto e Hora · máx. 24h) */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/60">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-[11px] font-bold text-amber-300">
                            Tempo de Voo (1s – 24h):
                          </span>
                          <span className="text-[11px] font-mono text-emerald-300 font-bold">
                            {formatFlightDuration(planeFlightDurationSec)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px] justify-end">
                          <div className="flex items-center gap-1">
                            {(
                              [
                                { id: 'seconds', label: 'Segundos' },
                                { id: 'minutes', label: 'Minutos' },
                                { id: 'hours', label: 'Horas' },
                              ] as Array<{ id: PlaneFlightTimeUnit; label: string }>
                            ).map((u) => (
                              <button
                                key={`dock_u_${u.id}`}
                                type="button"
                                onClick={() => {
                                  setPlaneDurationUnit(u.id);
                                  if (u.id === 'minutes' && planeFlightDurationSec < 60) {
                                    onChangePlaneFlightDurationSec?.(60);
                                  } else if (u.id === 'hours' && planeFlightDurationSec < 3600) {
                                    onChangePlaneFlightDurationSec?.(3600);
                                  }
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                                  planeDurationUnit === u.id
                                    ? 'bg-amber-500 text-slate-950 border-amber-300'
                                    : 'bg-slate-950 text-slate-300 border-slate-700 hover:bg-slate-800'
                                }`}
                              >
                                {u.label}
                              </button>
                            ))}
                          </div>

                          <input
                            type="range"
                            min={1}
                            max={unitSliderMax}
                            step={1}
                            value={unitSliderVal}
                            onChange={(e) => {
                              onChangePlaneFlightDurationSec?.(Number(e.target.value) * unitFactor);
                            }}
                            className="w-28 sm:w-40 accent-amber-400 cursor-pointer h-1.5"
                            aria-label="Selecionar tempo de voo entre 1 segundo e 24 horas"
                          />
                          <input
                            type="number"
                            min={planeDurationUnit === 'seconds' ? 1 : 0.01}
                            max={unitMaxVal}
                            step={planeDurationUnit === 'seconds' ? 1 : 'any'}
                            value={unitDisplayVal}
                            onChange={(e) => {
                              const raw = Number(e.target.value);
                              if (!Number.isNaN(raw) && raw > 0) {
                                onChangePlaneFlightDurationSec?.(
                                  Math.max(
                                    PLANE_MIN_FLIGHT_DURATION_SEC,
                                    Math.min(PLANE_MAX_FLIGHT_DURATION_SEC, Math.round(raw * unitFactor))
                                  )
                                );
                              }
                            }}
                            className="w-20 px-2 py-0.5 rounded bg-slate-950 border border-amber-500/40 text-right font-mono text-[11px] font-bold text-amber-200 focus:outline-none focus:border-amber-400"
                            aria-label="Tempo de voo na unidade selecionada"
                          />
                          <div className="flex flex-wrap items-center gap-1">
                            {[
                              { s: 1, label: '1s', unit: 'seconds' as PlaneFlightTimeUnit },
                              { s: 4, label: '4s', unit: 'seconds' as PlaneFlightTimeUnit },
                              { s: 15, label: '15s', unit: 'seconds' as PlaneFlightTimeUnit },
                              { s: 60, label: '1m', unit: 'minutes' as PlaneFlightTimeUnit },
                              { s: 300, label: '5m', unit: 'minutes' as PlaneFlightTimeUnit },
                              { s: 3600, label: '1h', unit: 'hours' as PlaneFlightTimeUnit },
                              { s: 43200, label: '12h', unit: 'hours' as PlaneFlightTimeUnit },
                              { s: 86400, label: '24h', unit: 'hours' as PlaneFlightTimeUnit },
                            ].map((tp) => (
                              <button
                                key={`dock_tp_${tp.s}`}
                                type="button"
                                onClick={() => {
                                  setPlaneDurationUnit(tp.unit);
                                  onChangePlaneFlightDurationSec?.(tp.s);
                                }}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer transition-colors ${
                                  planeFlightDurationSec === tp.s
                                    ? 'bg-amber-500 text-slate-950 border-amber-300'
                                    : 'bg-slate-950 text-slate-300 border-slate-700 hover:bg-slate-800'
                                }`}
                              >
                                {tp.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Escala de Voo Mundial (Manual) + Atalho Carregar Cidade Sob o Avião */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/60">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold text-sky-300">
                            🌍 Viagem Livre pelo Mundo:
                          </span>
                          {(
                            [
                              { id: 'city', label: 'Cidade (1x)' },
                              { id: 'regional', label: 'Regional (País)' },
                              { id: 'global', label: 'Global (Planeta em Segundos)' },
                            ] as Array<{ id: PlaneTravelSpeedMode; label: string }>
                          ).map((sp) => (
                            <button
                              key={`dock_sp_${sp.id}`}
                              type="button"
                              onClick={() => onChangePlaneTravelSpeedMode?.(sp.id)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                                planeTravelSpeedMode === sp.id
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                                  : 'bg-slate-950 text-slate-300 border-slate-700 hover:bg-slate-800'
                              }`}
                            >
                              {sp.label}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span>
                            Posição:{' '}
                            <strong className="text-slate-200">
                              {(realCityTelemetry?.liveLat ?? solarParams.latitude).toFixed(2)}°,{' '}
                              {(realCityTelemetry?.liveLng ?? solarParams.longitude).toFixed(2)}°
                            </strong>
                          </span>
                          {realCityTelemetry?.liveLat !== undefined && (
                            <button
                              type="button"
                              onClick={() =>
                                onLoadRealCity?.(
                                  realCityTelemetry.liveLat!,
                                  realCityTelemetry.liveLng!,
                                  undefined,
                                  'Mundo',
                                  true
                                )
                              }
                              className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-300 font-bold cursor-pointer"
                            >
                              📍 Adaptar Cidade Aqui
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Illumination, Traffic & Modo Pessoa Status Bar for Cidade De Carros / Cidade De Pessoas / Fazenda */}
              {viewMode === 'landscape' &&
                (sceneTheme === 'city_cars' || sceneTheme === 'city_people' || sceneTheme === 'farm') &&
                (() => {
                  const streetlightsOn = solarResults.solarAltitudeDeg <= -3.0;
                  const buildingsLit = solarResults.solarAltitudeDeg <= -4.5;
                  const signalLabel = (c: SignalColor) =>
                    c === 'green' ? 'VERDE' : c === 'yellow' ? 'AMARELO' : 'VERMELHO';
                  const signalStyle = (c: SignalColor) =>
                    c === 'green'
                      ? 'text-emerald-300'
                      : c === 'yellow'
                        ? 'text-amber-300'
                        : 'text-rose-400';

                  const scenarioHeader =
                    sceneTheme === 'city_cars'
                      ? 'Cidade De Carros & Tráfego'
                      : sceneTheme === 'city_people'
                        ? 'Cidade De Pessoas & Pedestres'
                        : 'Fazenda & Campo';

                  return (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/90 border border-amber-500/30 text-[11px] font-mono">
                      <div className="flex flex-wrap items-center gap-2 text-slate-300">
                        {sceneTheme === 'farm' ? (
                          <Tractor className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                        ) : sceneTheme === 'city_people' ? (
                          <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Car className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span className="font-bold text-amber-300">{scenarioHeader}</span>
                        <span className="text-slate-500">·</span>
                        <span>
                          Alt. Solar: <strong className="text-white">{solarResults.solarAltitudeDeg.toFixed(2)}°</strong>
                        </span>
                        {sceneTheme !== 'farm' ? (
                          <>
                            <span className="text-slate-500">·</span>
                            <span>
                              Semáforos L/O:{' '}
                              <strong className={signalStyle(trafficSignal.ew)}>{signalLabel(trafficSignal.ew)}</strong>{' '}
                              | N/S:{' '}
                              <strong className={signalStyle(trafficSignal.ns)}>{signalLabel(trafficSignal.ns)}</strong>
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-slate-500">·</span>
                            <span className="text-lime-300">Catavento, Trator, Celeiro & Pasto Ativos</span>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-bold ${
                            streetlightsOn
                              ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          <Lightbulb className="w-3 h-3" />
                          Postes (≤ -3,0°): {streetlightsOn ? 'LIGADOS' : 'DESLIGADOS'}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-bold ${
                            buildingsLit
                              ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          <Building2 className="w-3 h-3" />
                          {sceneTheme === 'farm' ? 'Casas/Celeiro' : 'Prédios'} (≤ -4,5°): {buildingsLit ? 'LIGADOS' : 'DESLIGADOS'}
                        </span>
                        <button
                          type="button"
                          onClick={() => onChangeCameraPreset(cameraPreset === 'person' ? 'free360' : 'person')}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border font-bold cursor-pointer transition-colors ${
                            cameraPreset === 'person'
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                          }`}
                        >
                          <Footprints className="w-3 h-3" />
                          {cameraPreset === 'person' ? 'Modo Pessoa ATIVO' : 'Entrar Modo Pessoa (WASD)'}
                        </button>
                      </div>
                    </div>
                  );
                })()}

              {/* HORA SOLAR: RELÓGIO SOLAR 24H POR SOMBRA REAL (CHÃO 12:00↑/00:00↓ + PAREDE 90°, 67,5° E 45° COM 360°) */}
              {viewMode === 'landscape' && sceneTheme === 'solar_time' && (() => {
                const isFloor = solarClockVersion === 'floor_horizontal';
                const gnomonH = isFloor ? 5.0 : 2.5;
                const { x: sx, y: sy, z: sz } = solarResults.lightVector3D;

                const autoAzDeg = solarParams.latitude < 0 ? 0 : 180;
                const effectiveWallAzDeg =
                  solarWallAzimuthDeg !== null && solarWallAzimuthDeg !== undefined
                    ? ((solarWallAzimuthDeg % 360) + 360) % 360
                    : autoAzDeg;
                const wallCompassLabel = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'][
                  Math.round(effectiveWallAzDeg / 45) % 8
                ];

                let localSunY = sy;
                if (!isFloor) {
                  const tiltDeg =
                    solarClockVersion === 'wall_vertical_90'
                      ? 90
                      : solarClockVersion === 'wall_tilted_675'
                        ? 67.5
                        : 45;
                  const tiltRad = (tiltDeg * Math.PI) / 180;
                  const rotY = Math.PI - (effectiveWallAzDeg * Math.PI) / 180;
                  // Apply rotation around Y by -rotY, then rotation around X by -tiltRad
                  const zAfterY = -sx * Math.sin(-rotY) + sz * Math.cos(-rotY);
                  localSunY = sy * Math.cos(-tiltRad) - zAfterY * Math.sin(-tiltRad);
                }

                const altDeg = solarResults.solarAltitudeDeg;
                const shadowActive = altDeg > -0.5 && localSunY > 0.008;
                const behindWall = !isFloor && altDeg > 0 && localSunY <= 0.008;
                const cosIncidence = Math.sqrt(Math.max(0, 1 - localSunY * localSunY));
                const shadowLenMeters = shadowActive ? gnomonH * (cosIncidence / localSunY) : null;
                const shadowRatio = shadowLenMeters !== null ? shadowLenMeters / gnomonH : null;

                const effFloorAzDeg = ((solarFloorAzimuthDeg % 360) + 360) % 360;
                const floorCompassLabel = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'][
                  Math.round(effFloorAzDeg / 45) % 8
                ];

                return (
                <div className="p-3 rounded-xl bg-slate-900/95 border border-amber-500/45 space-y-2.5 text-[11px] font-mono">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-bold text-amber-300">
                        Cenário Hora Solar · Relógio Solar 24 Horas (Escala 1:1 Real · Disco Solar 0,533°)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 text-[10px]">
                        {isFloor ? (
                          <>
                            Chão: Topo (12:00) → <strong className="text-amber-300">{effFloorAzDeg.toFixed(1).replace(/\.0$/, '')}° ({floorCompassLabel})</strong> · H ={' '}
                            <strong className="text-emerald-300">5,00 m</strong>
                          </>
                        ) : (
                          <>
                            Parede: Topo = <strong className="text-sky-300">00:00</strong> · Base ={' '}
                            <strong className="text-amber-300">12:00</strong> · H ={' '}
                            <strong className="text-emerald-300">2,50 m</strong>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded border font-bold ${
                          shadowActive
                            ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                            : behindWall
                              ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                        title="Comprimento físico exato L = H / tan(α) projetado pelo gnômon"
                      >
                        Sombra Real:{' '}
                        <strong>
                          {shadowActive && shadowLenMeters !== null && shadowRatio !== null
                            ? shadowLenMeters > 120
                              ? `> 120 m (Rasante)`
                              : `${shadowLenMeters.toFixed(2)} m (${shadowRatio.toFixed(2)}× H)`
                            : behindWall
                              ? 'ATRÁS DA PAREDE (Face na sombra própria)'
                              : 'OCULTA (Noite)'}
                        </strong>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-amber-500/30 text-amber-300">
                        Hora Solar (LST): <strong>{solarResults.lstLocalFormatted}</strong>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-sky-500/30 text-sky-300">
                        Hora Civil: <strong>{solarResults.localCivilTimeFormatted.split(' ')[1] || solarResults.localCivilTimeFormatted}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Version Switcher: Chão 24h vs Parede 90° vs Parede 67,5° vs Parede 45° */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-slate-400 font-bold text-[10px] mr-1">Versão do Relógio:</span>
                      <button
                        type="button"
                        onClick={() => {
                          onChangeSolarClockVersion?.('floor_horizontal');
                          if (cameraPreset !== 'zenith' && cameraPreset !== 'drone' && cameraPreset !== 'person') {
                            onChangeCameraPreset('free360');
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg border font-bold text-xs cursor-pointer transition-colors ${
                          solarClockVersion === 'floor_horizontal'
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-slate-950 text-amber-200 border-amber-500/35 hover:bg-slate-800'
                        }`}
                        title="Relógio Solar de Chão horizontal com as 24 horas invertido (12:00 em cima, 00:00 embaixo), leitura pela sombra do gnômon"
                      >
                        Chão 24h (12:00 ↑ · 00:00 ↓)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onChangeSolarClockVersion?.('wall_vertical_90');
                          onChangeCameraPreset('free360');
                        }}
                        className={`px-2.5 py-1 rounded-lg border font-bold text-xs cursor-pointer transition-colors ${
                          solarClockVersion === 'wall_vertical_90'
                            ? 'bg-sky-500 text-slate-950 border-sky-400'
                            : 'bg-slate-950 text-sky-200 border-sky-500/35 hover:bg-slate-800'
                        }`}
                        title="Versão de Parede 100% Em Pé (90°) com escolha livre de 0° a 360°, leitura pela sombra do gnômon"
                      >
                        Parede 100% Em Pé (90°)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onChangeSolarClockVersion?.('wall_tilted_675');
                          onChangeCameraPreset('free360');
                        }}
                        className={`px-2.5 py-1 rounded-lg border font-bold text-xs cursor-pointer transition-colors ${
                          solarClockVersion === 'wall_tilted_675'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : 'bg-slate-950 text-emerald-200 border-emerald-500/35 hover:bg-slate-800'
                        }`}
                        title="Versão de Parede Inclinada a 67,5° com escolha livre de 0° a 360°, leitura pela sombra do gnômon"
                      >
                        Parede Inclinada (67,5°)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onChangeSolarClockVersion?.('wall_tilted_45');
                          onChangeCameraPreset('free360');
                        }}
                        className={`px-2.5 py-1 rounded-lg border font-bold text-xs cursor-pointer transition-colors ${
                          solarClockVersion === 'wall_tilted_45'
                            ? 'bg-violet-500 text-slate-950 border-violet-400'
                            : 'bg-slate-950 text-violet-200 border-violet-500/35 hover:bg-slate-800'
                        }`}
                        title="Versão de Parede Inclinada a 45° com escolha livre de 0° a 360°, leitura pela sombra do gnômon"
                      >
                        Parede Inclinada (45°)
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {isFloor ? (
                        <button
                          type="button"
                          onClick={() => onChangeCameraPreset(cameraPreset === 'zenith' ? 'free360' : 'zenith')}
                          className={`px-2.5 py-1 rounded-lg border font-bold text-[10px] cursor-pointer transition-colors ${
                            cameraPreset === 'zenith'
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-slate-950 text-amber-300 border-amber-500/40 hover:bg-slate-800'
                          }`}
                        >
                          🔝 {cameraPreset === 'zenith' ? 'Voltar Órbita' : 'Ver de Cima (12:00 ↑ / 00:00 ↓)'}
                        </button>
                      ) : (
                        <span
                          className={`px-2.5 py-1 rounded-lg border font-bold text-[10px] ${
                            solarWallAzimuthDeg !== null
                              ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                              : solarParams.latitude < 0
                                ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200'
                                : 'bg-orange-500/20 border-orange-400/50 text-orange-200'
                          }`}
                        >
                          {solarWallAzimuthDeg !== null
                            ? `Manual 360°: Virada p/ ${effectiveWallAzDeg.toFixed(1).replace(/\.0$/, '')}° (${wallCompassLabel})`
                            : solarParams.latitude < 0
                              ? 'Auto Hemisfério Sul: NORTE (0°)'
                              : 'Auto Hemisfério Norte: SUL (180°)'}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onChangeCameraPreset(cameraPreset === 'person' ? 'free360' : 'person')}
                        className={`px-2.5 py-1 rounded-lg border font-bold text-[10px] cursor-pointer transition-colors ${
                          cameraPreset === 'person'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                        }`}
                      >
                        {cameraPreset === 'person' ? 'Modo Pessoa ATIVO' : 'Caminhar na Praça'}
                      </button>
                    </div>
                  </div>

                  {/* Orientação em 360° (Chão 24h gira o mostrador mantendo a sombra solar fixa no céu real; Paredes giram a face) */}
                  {isFloor ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80">
                      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                        <span className="text-amber-300 font-bold text-[10px] whitespace-nowrap">
                          Orientação do Chão 24h (0°–360°):
                        </span>
                        <button
                          type="button"
                          onClick={() => onChangeSolarFloorAzimuthDeg?.(0)}
                          className={`px-2 py-0.5 rounded-lg border font-bold text-[10px] cursor-pointer transition-colors ${
                            Math.abs(effFloorAzDeg) < 0.01 || Math.abs(effFloorAzDeg - 360) < 0.01
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-slate-950 text-amber-300 border-amber-500/40 hover:bg-slate-800'
                          }`}
                          title="Alinhar topo do mostrador (12:00) para 0° Norte (-Z) e base (00:00) para 180° Sul (+Z)"
                        >
                          Padrão 0° (12:00 ↑ N)
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={360}
                          step={0.5}
                          value={effFloorAzDeg}
                          onChange={(e) => onChangeSolarFloorAzimuthDeg?.(parseFloat(e.target.value))}
                          className="flex-1 min-w-[120px] max-w-[240px] accent-amber-400 cursor-pointer"
                          title="Gire o mostrador do Relógio de Chão 24h em qualquer ângulo de 0° a 360° sob a sombra solar real"
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={360}
                            step={0.5}
                            value={Number(effFloorAzDeg.toFixed(1))}
                            onChange={(e) => {
                              const parsed = parseFloat(e.target.value);
                              if (!Number.isNaN(parsed)) {
                                onChangeSolarFloorAzimuthDeg?.(Math.max(0, Math.min(360, parsed)));
                              }
                            }}
                            className="w-16 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-amber-300 font-bold text-[11px] text-center focus:outline-none focus:border-amber-400"
                            aria-label="Orientação do relógio de chão 24h em graus (0 a 360)"
                          />
                          <span className="text-slate-400 font-bold text-[10px]">
                            ° ({floorCompassLabel})
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        {[
                          { deg: 0, label: '0° N' },
                          { deg: 45, label: '45° NE' },
                          { deg: 90, label: '90° L' },
                          { deg: 135, label: '135° SE' },
                          { deg: 180, label: '180° S' },
                          { deg: 225, label: '225° SO' },
                          { deg: 270, label: '270° O' },
                          { deg: 315, label: '315° NO' },
                          { deg: 360, label: '360° N' },
                        ].map((item) => {
                          const isSelected = Math.abs(effFloorAzDeg - item.deg) < 0.01;
                          return (
                            <button
                              key={item.deg}
                              type="button"
                              onClick={() => onChangeSolarFloorAzimuthDeg?.(item.deg)}
                              className={`px-1.5 py-0.5 rounded border text-[10px] font-bold cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-amber-500/40 hover:text-amber-200'
                              }`}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80">
                      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                        <span className="text-sky-300 font-bold text-[10px] whitespace-nowrap">
                          Azimute da Parede (0°–360°):
                        </span>
                        <button
                          type="button"
                          onClick={() => onChangeSolarWallAzimuthDeg?.(null)}
                          className={`px-2 py-0.5 rounded-lg border font-bold text-[10px] cursor-pointer transition-colors ${
                            solarWallAzimuthDeg === null
                              ? 'bg-sky-500 text-slate-950 border-sky-400'
                              : 'bg-slate-950 text-sky-300 border-sky-500/40 hover:bg-slate-800'
                          }`}
                          title="Orientar automaticamente pelo Hemisfério (0° Norte no Sul / 180° Sul no Norte)"
                        >
                          Auto Hemisfério
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={360}
                          step={0.5}
                          value={effectiveWallAzDeg}
                          onChange={(e) => onChangeSolarWallAzimuthDeg?.(parseFloat(e.target.value))}
                          className="flex-1 min-w-[120px] max-w-[240px] accent-amber-400 cursor-pointer"
                          title="Escolha qualquer ângulo de 0° a 360° para a face do relógio de parede"
                        />
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={360}
                            step={0.5}
                            value={Number(effectiveWallAzDeg.toFixed(1))}
                            onChange={(e) => {
                              const parsed = parseFloat(e.target.value);
                              if (!Number.isNaN(parsed)) {
                                const clamped = Math.max(0, Math.min(360, parsed));
                                onChangeSolarWallAzimuthDeg?.(clamped);
                              }
                            }}
                            className="w-16 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-amber-300 font-bold text-[11px] text-center focus:outline-none focus:border-amber-400"
                            aria-label="Ângulo da parede em graus (0 a 360)"
                          />
                          <span className="text-slate-400 font-bold text-[10px]">
                            ° ({wallCompassLabel})
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        {[
                          { deg: 0, label: '0° N' },
                          { deg: 45, label: '45° NE' },
                          { deg: 90, label: '90° L' },
                          { deg: 135, label: '135° SE' },
                          { deg: 180, label: '180° S' },
                          { deg: 225, label: '225° SO' },
                          { deg: 270, label: '270° O' },
                          { deg: 315, label: '315° NO' },
                          { deg: 360, label: '360° N' },
                        ].map((item) => {
                          const isSelected =
                            solarWallAzimuthDeg !== null &&
                            Math.abs(effectiveWallAzDeg - item.deg) < 0.01;
                          return (
                            <button
                              key={item.deg}
                              type="button"
                              onClick={() => onChangeSolarWallAzimuthDeg?.(item.deg)}
                              className={`px-1.5 py-0.5 rounded border text-[10px] font-bold cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-amber-500/40 hover:text-amber-200'
                              }`}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                );
              })()}

              {/* Sub-row 2: Câmera Exatamente no Chão a 30 Metros (8 Direções + Órbita 360° Livre) */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 font-mono mr-1">
                    <OrbitIcon className="w-3.5 h-3.5 text-emerald-400" /> Chão a 30 Metros:
                  </span>
                  <button
                    onClick={() => onChangeCameraPreset('ground')}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${
                      cameraPreset === 'ground' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                    title="Centro no chão olhando para o Zênite/Céu"
                  >
                    👁️ Céu
                  </button>
                  <button
                    onClick={() => onChangeCameraPreset('ground_north')}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                      cameraPreset === 'ground_north' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                    title="Exatamente no chão a 30 metros de distância, virado para ver tudo em direção ao Norte (0°)"
                  >
                    ⬆️ N (30m)
                  </button>
                  <button
                    onClick={() => onChangeCameraPreset('ground_northeast')}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                      cameraPreset === 'ground_northeast' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                    title="Exatamente no chão a 30 metros de distância, virado para ver tudo em direção ao Nordeste (45°)"
                  >
                    ↗️ NE (30m)
                  </button>
                  <button
                    onClick={() => onChangeCameraPreset('ground_east')}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                      cameraPreset === 'ground_east' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                    title="Exatamente no chão a 30 metros de distância, virado para ver tudo em direção ao Leste (90°)"
                  >
                    ➡️ L (30m)
                  </button>
                  <button
                    onClick={() => onChangeCameraPreset('ground_southeast')}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                      cameraPreset === 'ground_southeast' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                    title="Exatamente no chão a 30 metros de distância, virado para ver tudo em direção ao Sudeste (135°)"
                  >
                    ↘️ SE (30m)
                  </button>
                  <button
                    onClick={() => onChangeCameraPreset('ground_south')}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                      cameraPreset === 'ground_south' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                    title="Exatamente no chão a 30 metros de distância, virado para ver tudo em direção ao Sul (180°)"
                  >
                    ⬇️ S (30m)
                  </button>
                  <button
                    onClick={() => onChangeCameraPreset('ground_southwest')}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                      cameraPreset === 'ground_southwest' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                    title="Exatamente no chão a 30 metros de distância, virado para ver tudo em direção ao Sudoeste (225°)"
                  >
                    ↙️ SO (30m)
                  </button>
                  <button
                    onClick={() => onChangeCameraPreset('ground_west')}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                      cameraPreset === 'ground_west' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                    title="Exatamente no chão a 30 metros de distância, virado para ver tudo em direção ao Oeste (270°)"
                  >
                    ⬅️ O (30m)
                  </button>
                  <button
                    onClick={() => onChangeCameraPreset('ground_northwest')}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                      cameraPreset === 'ground_northwest' ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                    title="Exatamente no chão a 30 metros de distância, virado para ver tudo em direção ao Noroeste (315°)"
                  >
                    ↖️ NO (30m)
                  </button>
                </div>

                <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-[11px] font-mono text-emerald-300">
                  <span>📍 Raio: <strong>30m</strong></span>
                  <span className="text-emerald-700">|</span>
                  <span>Solo: <strong>0.35m</strong></span>
                  <span className="text-emerald-700">|</span>
                  <span className="text-emerald-200">Visão Panorâmica Completa</span>
                </div>
              </div>
            </div>

            {/* ROW 4: TIME PLAYBACK & SCRUBBER */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={onTogglePlay}
                  className={`p-2.5 rounded-xl font-semibold transition-colors flex items-center gap-2 text-xs ${
                    isPlaying
                      ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                      : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                  }`}
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-slate-950" /> : <Play className="w-4 h-4 fill-slate-950" />}
                  {isPlaying ? 'Pausar Relógio' : 'Simular Tempo'}
                </button>

                {/* Speed Multipliers */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {[1, 10, 60, 360, 1440].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => onUpdateParams({ gameTimeSpeed: speed })}
                      className={`px-2.5 py-1 text-xs font-mono rounded-lg transition-colors ${
                        solarParams.gameTimeSpeed === speed
                          ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Scrubber Slider & Quick Jumps */}
              <div className="flex-1 min-w-[280px] flex items-center gap-3">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="range"
                  min="0"
                  max="1439"
                  value={solarResults.tstUtcMinutes}
                  onChange={(e) => {
                    const mins = parseFloat(e.target.value);
                    const newDate = new Date(solarParams.referenceDate);
                    newDate.setUTCHours(Math.floor(mins / 60), Math.floor(mins % 60), 0, 0);
                    onUpdateParams({ referenceDate: newDate });
                  }}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <span className="text-xs font-mono tabular-nums text-amber-400 shrink-0 w-16 text-right">
                  {solarResults.tstUtcFormatted}
                </span>
              </div>

              {/* Quick Jumps */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onJumpToEvent('sunrise')}
                  className="px-2.5 py-1 text-[11px] font-medium bg-slate-950 hover:bg-slate-800 border border-slate-800 text-amber-300 rounded-lg transition-colors"
                >
                  🌅 Nascer
                </button>
                <button
                  onClick={() => onJumpToEvent('noon')}
                  className="px-2.5 py-1 text-[11px] font-medium bg-slate-950 hover:bg-slate-800 border border-slate-800 text-sky-300 rounded-lg transition-colors"
                >
                  ☀️ Meio-Dia
                </button>
                <button
                  onClick={() => onJumpToEvent('sunset')}
                  className="px-2.5 py-1 text-[11px] font-medium bg-slate-950 hover:bg-slate-800 border border-slate-800 text-rose-300 rounded-lg transition-colors"
                >
                  🌇 Pôr
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Timezone Change & System Modal */}
      <TimezoneChangeModal
        isOpen={isTimezoneModalOpen}
        onClose={() => setIsTimezoneModalOpen(false)}
        solarParams={solarParams}
        solarResults={solarResults}
        onUpdateParams={onUpdateParams}
        locationName={solarParams.timeZoneId || 'Local Selecionado'}
        initialTab={timezoneModalTab}
      />

      {/* Interactive Global World Map Modal inside Cidade Real */}
      <RealCityGlobalMap
        isOpen={isRealCityGlobalMapOpen}
        onClose={() => setIsRealCityGlobalMapOpen(false)}
        mapsApiKey={mapsApiKey}
        solarParams={solarParams}
        solarResults={solarResults}
        realCityData={realCityData}
        realCityTelemetry={realCityTelemetry}
        planeFlightPlan={planeFlightPlan}
        planeFlightDurationSec={planeFlightDurationSec}
        planeMaxAltitudeM={planeMaxAltitudeM}
        onChangePlaneFlightDurationSec={onChangePlaneFlightDurationSec}
        onChangePlaneMaxAltitudeM={onChangePlaneMaxAltitudeM}
        onStartGlobalPlaneFlight={onStartGlobalPlaneFlight}
        onLoadRealCity={onLoadRealCity}
        onSyncCoordinatesOnly={(lat, lng) =>
          onUpdateParams({ latitude: lat, longitude: lng }, { preserveTimezone: true })
        }
      />
    </div>
  );
};
