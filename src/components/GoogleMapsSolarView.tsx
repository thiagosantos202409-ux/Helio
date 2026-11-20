import React, { useState, useEffect, useMemo } from 'react';
import {
  APIProvider,
  Map as GoogleMapComponent,
  AdvancedMarker,
  Pin,
  MapMouseEvent,
} from '@vis.gl/react-google-maps';
import {
  MapPin,
  Sun,
  Globe,
  Compass,
  Clock,
  CheckCircle2,
  RefreshCw,
  Layers,
  Sparkles,
  BookOpen,
  ChevronRight,
  ChevronDown,
  X,
  Search,
  Bookmark,
  Calendar,
  Zap,
} from 'lucide-react';
import { SolarCalculationResult, SolarInputParameters, NOAALocation, SolarUpdateOptions } from '../types/solar';
import { fetchGoogleTimeZone, GoogleTimeZoneResponse } from '../services/googleMapsService';
import { PlaceSearchControl } from './PlaceSearchControl';
import { NOAA_LOCATIONS } from '../data/noaaLocations';
import {
  ALL_TIMEZONE_SYSTEMS,
  TIMEZONE_SYSTEM_CATEGORIES,
  TimezoneSystemCategory,
} from '../data/timezoneSystems';
import { calculateTimezoneCoverage, TimezoneCoverage } from '../services/timezoneCoverage';
import { TimezoneCoverageOverlay } from './TimezoneCoverageOverlay';
import { getHistoricalTimezoneOffset, findNextDstTransition } from '../engine/solarEngine';
import { classifyNoaaTimezone } from '../services/timezoneService';
import { TimezoneChangeModal } from './TimezoneChangeModal';

interface GoogleMapsSolarViewProps {
  apiKey: string;
  solarParams: SolarInputParameters;
  solarResults: SolarCalculationResult;
  onUpdateParams: (newParams: Partial<SolarInputParameters>, options?: SolarUpdateOptions) => void;
  onClose?: () => void;
  initialSelectedNoaaId?: string;
}

export const GoogleMapsSolarView: React.FC<GoogleMapsSolarViewProps> = ({
  apiKey,
  solarParams,
  solarResults,
  onUpdateParams,
  onClose,
  initialSelectedNoaaId,
}) => {
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('hybrid');
  const [tzData, setTzData] = useState<GoogleTimeZoneResponse | null>(null);
  const [isLoadingTz, setIsLoadingTz] = useState(false);
  const [selectedPlaceName, setSelectedPlaceName] = useState<string>('Local Selecionado');
  const [isTimezoneModalOpen, setIsTimezoneModalOpen] = useState<boolean>(false);
  const [mapsTzCategory, setMapsTzCategory] = useState<'all' | TimezoneSystemCategory>('all');

  const activeSystemMode = solarParams.timezoneSystemMode || 'noaa_official';
  const activeSystemMeta =
    ALL_TIMEZONE_SYSTEMS.find((s) => s.id === activeSystemMode) || ALL_TIMEZONE_SYSTEMS[0];
  const filteredMapsSystems =
    mapsTzCategory === 'all'
      ? ALL_TIMEZONE_SYSTEMS
      : ALL_TIMEZONE_SYSTEMS.filter((s) => s.category === mapsTzCategory);

  // Unified Base NOAA & Coverage Controls
  const [showCoverageSwath, setShowCoverageSwath] = useState<boolean>(true);
  const [showNoaaMarkers, setShowNoaaMarkers] = useState<boolean>(true);
  const [isNoaaDrawerOpen, setIsNoaaDrawerOpen] = useState<boolean>(false);
  const [noaaSearchFilter, setNoaaSearchFilter] = useState<string>('');
  const [selectedNoaaLocation, setSelectedNoaaLocation] = useState<NOAALocation | null>(() => {
    if (initialSelectedNoaaId) {
      return NOAA_LOCATIONS.find((l) => l.id === initialSelectedNoaaId) || null;
    }
    // Match based on coordinates or timezone ID if available
    return (
      NOAALocationMatch(solarParams.latitude, solarParams.longitude, solarParams.timeZoneId) ||
      NOAA_LOCATIONS[1] // Default: São Paulo
    );
  });
  const [expandedTimelineId, setExpandedTimelineId] = useState<string | null>(null);

  // Helper to match NOAA location
  function NOAALocationMatch(lat: number, lon: number, tzId?: string): NOAALocation | null {
    if (tzId) {
      const matchTz = NOAA_LOCATIONS.find((l) => l.timeZoneId === tzId);
      if (matchTz) return matchTz;
    }
    return (
      NOAA_LOCATIONS.find(
        (l) => Math.abs(l.latitude - lat) < 0.5 && Math.abs(l.longitude - lon) < 0.5
      ) || null
    );
  }

  // Calculate active timezone coverage
  const activeCoverage: TimezoneCoverage = useMemo(() => {
    const offset = solarParams.civilTimezoneOffset;
    return calculateTimezoneCoverage(offset, solarParams.longitude);
  }, [solarParams.civilTimezoneOffset, solarParams.longitude]);

  const dateDayKey = solarParams.referenceDate.toISOString().slice(0, 10);

  // Fetch official Google Time Zone for verification badge when latitude/longitude or calendar day changes
  useEffect(() => {
    let isMounted = true;
    setIsLoadingTz(true);

    fetchGoogleTimeZone(solarParams.latitude, solarParams.longitude, solarParams.referenceDate)
      .then((data) => {
        if (!isMounted) return;
        if (data && data.status === 'OK') {
          setTzData(data);
        } else {
          setTzData(null);
        }
      })
      .catch((err) => {
        console.error('Timezone query error:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingTz(false);
      });

    return () => {
      isMounted = false;
    };
  }, [solarParams.latitude, solarParams.longitude, dateDayKey]);

  const handleMapClick = (e: MapMouseEvent) => {
    if (e.detail?.latLng) {
      const lat = Number(e.detail.latLng.lat.toFixed(4));
      const lng = Number(e.detail.latLng.lng.toFixed(4));

      // Check if tapped near an existing NOAA observatory only to enrich label (without changing UTC!)
      const nearbyNoaa = NOAA_LOCATIONS.find(
        (l) => Math.abs(l.latitude - lat) < 1.0 && Math.abs(l.longitude - lng) < 1.0
      );

      if (nearbyNoaa) {
        setSelectedPlaceName(`${nearbyNoaa.name.split('/')[0].trim()} (${lat}°, ${lng}°)`);
        setSelectedNoaaLocation(nearbyNoaa);
      } else {
        const noaaClass = classifyNoaaTimezone(lat, lng);
        setSelectedPlaceName(`${noaaClass.locationName} (${lat}°, ${lng}°)`);
        setSelectedNoaaLocation(null);
      }

      // Apenas tocando no mapa: muda apenas latitude/longitude mantendo exatamente o mesmo horário UTC e fuso ativo
      onUpdateParams(
        {
          latitude: lat,
          longitude: lng,
        },
        { preserveTimezone: true }
      );
    }
  };

  const handleApplyGoogleTimezone = () => {
    if (!tzData) return;
    const totalOffsetSeconds = tzData.rawOffset + tzData.dstOffset;
    const offsetHours = totalOffsetSeconds / 3600;
    onUpdateParams({
      civilTimezoneOffset: offsetHours,
      timeZoneId: tzData.timeZoneId,
      autoHistoricalTimezone: true,
    });
  };

  const handleSelectNoaaLocation = (loc: NOAALocation) => {
    setSelectedNoaaLocation(loc);
    setSelectedPlaceName(loc.name);
    const isNoaaOfficial = !solarParams.timezoneSystemMode || solarParams.timezoneSystemMode === 'noaa_official';

    if (isNoaaOfficial) {
      const resolved = getHistoricalTimezoneOffset(loc.timeZoneId, solarParams.referenceDate);
      const targetOffset = resolved && typeof resolved.offsetHours === 'number'
        ? resolved.offsetHours
        : loc.standardTimezoneOffset;

      onUpdateParams({
        latitude: loc.latitude,
        longitude: loc.longitude,
        civilTimezoneOffset: targetOffset,
        timeZoneId: loc.timeZoneId,
        autoHistoricalTimezone: true,
      });
    } else {
      onUpdateParams({
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
    }
  };

  const [drawerRegion, setDrawerRegion] = useState<'all' | 'americas' | 'europe_africa' | 'asia' | 'oceania' | 'fractional'>('all');

  // Filtered NOAA Locations for Drawer
  const filteredNoaaLocations = useMemo(() => {
    let list = NOAA_LOCATIONS;
    if (drawerRegion === 'americas') {
      list = list.filter((l) => l.standardTimezoneOffset >= -12 && l.standardTimezoneOffset <= -2 && !l.country.includes('Rússia'));
    } else if (drawerRegion === 'europe_africa') {
      list = list.filter((l) => (l.standardTimezoneOffset >= -1 && l.standardTimezoneOffset <= 3) && !l.timeZoneId.toLowerCase().includes('asia'));
    } else if (drawerRegion === 'asia') {
      list = list.filter((l) => l.timeZoneId.toLowerCase().includes('asia') || (l.standardTimezoneOffset >= 3.5 && l.standardTimezoneOffset <= 9 && !l.country.includes('Austrália')));
    } else if (drawerRegion === 'oceania') {
      list = list.filter((l) => l.standardTimezoneOffset >= 9.5 || l.timeZoneId.toLowerCase().includes('pacific') || l.timeZoneId.toLowerCase().includes('australia'));
    } else if (drawerRegion === 'fractional') {
      list = list.filter((l) => !Number.isInteger(l.standardTimezoneOffset));
    }

    const q = noaaSearchFilter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((l) => {
      return (
        l.name.toLowerCase().includes(q) ||
        l.country.toLowerCase().includes(q) ||
        l.timeZoneId.toLowerCase().includes(q) ||
        l.historicalNotes.toLowerCase().includes(q) ||
        (q.includes('utc') && l.standardTimezoneOffset.toString().includes(q.replace('utc', '').trim()))
      );
    });
  }, [noaaSearchFilter, drawerRegion]);

  const observerPos = { lat: solarParams.latitude, lng: solarParams.longitude };
  const subsolarPos = { lat: solarResults.subsolarLatitude, lng: solarResults.subsolarLongitude };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 relative overflow-hidden font-sans">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 bg-slate-900/95 border-b border-slate-800 shrink-0 z-10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Google Maps & Base Global NOAA
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Todos os Fusos: UTC-12 a UTC+14 ({NOAA_LOCATIONS.length} Locais)
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Pesquise qualquer local no mundo ou clique nos observatórios NOAA para analisar a abrangência meridiana (15°).
            </p>
          </div>
        </div>

        {/* Action Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle: Abrangência dos Fusos (15° Swath) */}
          <button
            onClick={() => setShowCoverageSwath(!showCoverageSwath)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
              showCoverageSwath
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Exibir faixa de abrangência de 15° de longitude e meridiano central"
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Faixa 15°</span>
          </button>

          {/* Toggle: Marcadores NOAA no Mapa */}
          <button
            onClick={() => setShowNoaaMarkers(!showNoaaMarkers)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
              showNoaaMarkers
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Exibir todos os observatórios e fusos NOAA diretamente no mapa"
          >
            <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            <span>Observatórios ({NOAA_LOCATIONS.length})</span>
          </button>

          {/* Button: Mudar Fuso Horário / Escolher Sistema */}
          <button
            onClick={() => setIsTimezoneModalOpen(true)}
            className="px-2.5 py-1 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-sky-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 cursor-pointer shadow-sm"
            title="Mudar fuso horário ou escolher sistema de fuso que este local usa"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Mudar Fuso Horário</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-200">
              {activeSystemMeta.icon} {solarResults.specialClockDisplay || solarResults.historicalTimezoneInfo?.timezoneAbbrev || `UTC${solarParams.civilTimezoneOffset >= 0 ? '+' : ''}${solarParams.civilTimezoneOffset}`}
            </span>
          </button>

          {/* Button: Open NOAA Drawer */}
          <button
            onClick={() => setIsNoaaDrawerOpen(!isNoaaDrawerOpen)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
              isNoaaDrawerOpen
                ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Catálogo Histórico</span>
          </button>

          {/* Map Type Controls */}
          <div className="hidden md:flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            {(['hybrid', 'satellite', 'roadmap', 'terrain'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setMapType(mode)}
                className={`px-2 py-0.5 text-[11px] font-medium rounded capitalize transition-colors ${
                  mapType === mode ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700 font-medium"
            >
              Voltar ao 3D
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Interactive Map & Overlays */}
      <div className="flex-1 relative w-full h-full min-h-[400px]">
        {apiKey ? (
          <APIProvider apiKey={apiKey}>
            {/* Floating Unified Search Control */}
            <div className="absolute top-4 left-4 z-20 w-80 sm:w-96 max-w-[calc(100vw-2rem)]">
              <PlaceSearchControl
                onSelectCoordinates={(lat, lng, name) => {
                  onUpdateParams({
                    latitude: lat,
                    longitude: lng,
                  });
                  if (name) setSelectedPlaceName(name);
                }}
                onSelectNoaaLocation={(loc) => handleSelectNoaaLocation(loc)}
                currentLat={solarParams.latitude}
                currentLng={solarParams.longitude}
              />
            </div>

            <GoogleMapComponent
              style={{ width: '100%', height: '100%' }}
              center={observerPos}
              zoom={4}
              mapTypeId={mapType}
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              onClick={handleMapClick}
              gestureHandling="greedy"
              disableDefaultUI={false}
            >
              {/* Observer Marker */}
              <AdvancedMarker position={observerPos} title={`Observador Solar: ${selectedPlaceName}`}>
                <Pin background="#f59e0b" glyphColor="#0f172a" borderColor="#d97706" scale={1.25} />
              </AdvancedMarker>

              {/* Subsolar Point Marker */}
              <AdvancedMarker position={subsolarPos} title="Ponto Subsolar (Sol no Zênite 90° exato)">
                <div className="relative flex items-center justify-center p-2 rounded-full bg-amber-400 shadow-xl border-2 border-white animate-pulse">
                  <Sun className="w-5 h-5 text-slate-950" />
                </div>
              </AdvancedMarker>

              {/* 14 NOAA Observatory Markers on the Map */}
              {showNoaaMarkers &&
                NOAA_LOCATIONS.map((loc) => {
                  const isSelected = selectedNoaaLocation?.id === loc.id;
                  return (
                    <AdvancedMarker
                      key={loc.id}
                      position={{ lat: loc.latitude, lng: loc.longitude }}
                      title={`${loc.name} (${loc.timeZoneId}) - UTC${loc.standardTimezoneOffset >= 0 ? '+' : ''}${loc.standardTimezoneOffset}`}
                      onClick={() => handleSelectNoaaLocation(loc)}
                    >
                      <div
                        className={`cursor-pointer transition-all flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-xl border text-xs font-bold ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 border-white ring-2 ring-amber-400/80 scale-110 z-30'
                            : 'bg-slate-900/90 text-white border-slate-700 hover:border-amber-400 hover:scale-105'
                        }`}
                      >
                        <span className="text-base">{loc.flagEmoji}</span>
                        <span className="font-mono text-[11px] hidden sm:inline">
                          {loc.name.split('/')[0].trim()}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                            isSelected ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-amber-300'
                          }`}
                        >
                          UTC{loc.standardTimezoneOffset >= 0 ? '+' : ''}
                          {loc.standardTimezoneOffset}
                        </span>
                      </div>
                    </AdvancedMarker>
                  );
                })}

              {/* Timezone 15° Swath Coverage Overlay */}
              <TimezoneCoverageOverlay
                coverage={activeCoverage}
                visible={showCoverageSwath}
                observerLat={solarParams.latitude}
                observerLng={solarParams.longitude}
              />
            </GoogleMapComponent>
          </APIProvider>
        ) : (
          <div className="flex items-center justify-center h-full w-full bg-slate-900 text-slate-400">
            <div className="text-center p-6 space-y-3 max-w-md">
              <Globe className="w-10 h-10 text-amber-400 mx-auto animate-spin" />
              <p className="text-sm text-slate-300 font-semibold">Carregando Google Maps Platform...</p>
            </div>
          </div>
        )}

        {/* 3. Floating Card Left: Escolher o Local & Sistema de Fuso Horário */}
        <div className="absolute bottom-6 left-6 z-20 max-w-md w-[calc(100%-3rem)] max-h-[calc(100%-6.5rem)] overflow-y-auto overscroll-contain p-4 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-md text-xs space-y-3.5">
          {/* Card Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-white flex items-center gap-1.5 font-mono text-xs">
              <Clock className="w-4 h-4 text-amber-400" /> Local & Sistema de Fuso Horário
            </span>
            {isLoadingTz ? (
              <span className="text-[10px] text-amber-400 flex items-center gap-1 animate-pulse font-mono">
                <RefreshCw className="w-3 h-3 animate-spin" /> Verificando...
              </span>
            ) : tzData?.status === 'OK' ? (
              <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3 h-3" /> Fuso Verificado
              </span>
            ) : (
              <span className="text-[10px] text-sky-400 font-mono">NOAA</span>
            )}
          </div>

          {/* Location Details */}
          <div className="space-y-1.5 font-mono text-slate-300">
            <div className="flex justify-between items-center bg-slate-950/80 p-2 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-amber-400" /> Local:
              </span>
              <span className="text-amber-300 font-bold truncate max-w-[220px]" title={selectedPlaceName}>
                {selectedPlaceName}
              </span>
            </div>

            <div className="flex justify-between px-1 text-[11px]">
              <span className="text-slate-400">Coordenadas:</span>
              <span className="text-slate-200">
                Lat <strong>{solarParams.latitude.toFixed(4)}°</strong>, Lon <strong>{solarParams.longitude.toFixed(4)}°</strong>
              </span>
            </div>

            <div className="px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-[10px] text-cyan-200 flex items-center justify-between gap-2">
              <span>Toque no mapa mantém o mesmo UTC</span>
              <strong className="text-white shrink-0">
                UTC{Number(solarParams.civilTimezoneOffset.toFixed(2)) >= 0 ? '+' : ''}
                {Number(solarParams.civilTimezoneOffset.toFixed(2))}
              </strong>
            </div>
          </div>

          {/* Timezone System Selector (All 14 Systems) */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-300 font-mono flex items-center justify-between gap-2">
              <span>Sistema de Fuso ({ALL_TIMEZONE_SYSTEMS.length}):</span>
              <span className="text-[10px] text-amber-400 truncate">
                {activeSystemMeta.icon} {activeSystemMeta.shortName}
              </span>
            </label>

            {/* Category filter pills */}
            <div className="flex flex-wrap gap-1 text-[9px] font-mono">
              {TIMEZONE_SYSTEM_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setMapsTzCategory(cat.id)}
                  className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                    mapsTzCategory === cat.id
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
              {filteredMapsSystems.map((sys) => {
                const isActive = activeSystemMode === sys.id;
                return (
                  <button
                    type="button"
                    key={sys.id}
                    onClick={() => onUpdateParams({ timezoneSystemMode: sys.id })}
                    title={sys.description}
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-all text-left flex flex-col cursor-pointer ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm font-bold'
                        : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-1 truncate">
                      <span>{sys.icon}</span>
                      <span className="truncate">{sys.shortName}</span>
                    </span>
                    <span className="text-[9px] text-slate-400 font-normal truncate">{sys.badgeHint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* If Manual Custom mode is active, display offset stepper & quick presets */}
          {solarParams.timezoneSystemMode === 'manual_custom' && (
            <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Offset Manual (Horas):</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdateParams({ civilTimezoneOffset: Math.max(-12, solarParams.civilTimezoneOffset - 1) })}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-bold text-amber-400 text-xs w-16 text-center">
                    UTC{solarParams.civilTimezoneOffset >= 0 ? '+' : ''}{solarParams.civilTimezoneOffset}
                  </span>
                  <button
                    onClick={() => onUpdateParams({ civilTimezoneOffset: Math.min(14, solarParams.civilTimezoneOffset + 1) })}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-800/60">
                {[-10, -8, -5, -3, 0, 1, 2, 3, 5.5, 8, 9, 12].map((off) => (
                  <button
                    key={off}
                    onClick={() => onUpdateParams({ civilTimezoneOffset: off })}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer ${
                      solarParams.civilTimezoneOffset === off
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {off >= 0 ? `+${off}` : off}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Button: Explorar / Mudar para Outro Fuso do Mundo */}
          <button
            onClick={() => setIsTimezoneModalOpen(true)}
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500/20 via-sky-500/20 to-indigo-500/20 border border-amber-500/40 hover:border-amber-400 text-amber-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <Globe className="w-4 h-4 text-amber-400" />
            <span>Mudar para Outro Fuso do Mundo (UTC-12 a UTC+14)</span>
          </button>

          {/* Time & Solar Alignment Comparison */}
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-[11px] space-y-1">
            {solarResults.specialClockDisplay && (
              <div className="flex justify-between items-center pb-1 border-b border-slate-800/80">
                <span className="text-slate-400">Relógio do Sistema:</span>
                <span className="text-amber-300 font-bold">{solarResults.specialClockDisplay}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Hora Civil Aplicada:</span>
              <span className="text-sky-300 font-bold">{solarResults.localCivilTimeFormatted}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Hora Solar Local (LST):</span>
              <span className="text-emerald-400 font-bold">{solarResults.lstLocalFormatted}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-800/80 text-[10px]">
              <span className="text-slate-400">Fuso em Execução:</span>
              <span className="text-amber-400 font-bold truncate max-w-[200px]" title={solarResults.timezoneSystemDescription}>
                UTC{Number(solarParams.civilTimezoneOffset.toFixed(2)) >= 0 ? '+' : ''}{Number(solarParams.civilTimezoneOffset.toFixed(2))} • {solarParams.timeZoneId || 'Auto'}
              </span>
            </div>
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
                  <div className="flex justify-between items-center pt-1 border-t border-slate-800/80 text-[10px]">
                    <span className="text-slate-400">Próx. Mudança DST:</span>
                    <span className="text-indigo-300 font-bold text-right">
                      {nextDst.transitionLocalDateFormatted} {nextDst.transitionLocalTimeFormatted} ({nextDst.directionLabel})
                    </span>
                  </div>
                );
              })()}
          </div>
        </div>

        {/* 4. Floating Card Right: Abrangência do Fuso Ativo (15° Meridian Swath) */}
        <div className="absolute top-4 right-4 z-20 max-w-sm w-full p-4 rounded-2xl bg-slate-900/95 border border-sky-500/30 shadow-2xl backdrop-blur-md text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-sky-300 flex items-center gap-1.5 font-mono">
              <Layers className="w-4 h-4 text-sky-400" /> Abrangência do Fuso (Meridianos 15°)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
              UTC{solarParams.civilTimezoneOffset >= 0 ? '+' : ''}{solarParams.civilTimezoneOffset}
            </span>
          </div>

          <div className="space-y-1.5 font-mono text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Meridiano Central:</span>
              <strong className="text-amber-400">{activeCoverage.meridianName}</strong>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Faixa Teórica (15°):</span>
              <strong className="text-sky-300">
                {activeCoverage.westLimitLng}° a {activeCoverage.eastLimitLng}°
              </strong>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Largura em Horas:</span>
              <span className="text-slate-200">15° = 1 hora solar exata (4 min/grau)</span>
            </div>

            <div className="flex justify-between pt-1 border-t border-slate-800">
              <span className="text-slate-400">Desvio Solar Local:</span>
              <strong className={activeCoverage.solarDeviationMin >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                {activeCoverage.solarDeviationMin >= 0 ? '+' : ''}{activeCoverage.solarDeviationMin} minutos
              </strong>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-400">Meio-Dia Solar no Relógio:</span>
              <strong className="text-emerald-300 font-bold">
                {activeCoverage.solarNoonCivilTimeFormatted}
              </strong>
            </div>
          </div>

          <div className="p-2 rounded bg-slate-950/70 border border-slate-800/80 text-[11px] leading-relaxed text-slate-300">
            {activeCoverage.solarDeviationDescription}
          </div>

          {selectedNoaaLocation && (
            <div className="pt-1 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
                <span>{selectedNoaaLocation.flagEmoji}</span>
                <span className="font-bold text-white truncate">{selectedNoaaLocation.name.split('/')[0]}</span>
              </span>
              <button
                onClick={() => handleSelectNoaaLocation(selectedNoaaLocation)}
                className="px-2.5 py-1 text-[11px] font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors shrink-0 cursor-pointer shadow"
              >
                Aplicar Fuso NOAA
              </button>
            </div>
          )}
        </div>

        {/* 5. Subsolar & Sun Vector HUD (Bottom Right) */}
        <div className="absolute bottom-6 right-6 z-20 hidden md:block max-w-xs p-3.5 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-md text-xs space-y-1.5">
          <div className="font-bold text-amber-400 flex items-center gap-1.5 font-mono">
            <Sun className="w-4 h-4 text-amber-400" /> Orientação Solar Google Maps
          </div>
          <div className="text-[11px] font-mono text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Ponto Subsolar:</span>
              <strong className="text-amber-300">
                Lat {solarResults.subsolarLatitude.toFixed(2)}°, Lon {solarResults.subsolarLongitude.toFixed(2)}°
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Altitude Solar:</span>
              <span className="text-white font-bold">{solarResults.solarAltitudeDeg.toFixed(2)}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Azimute Solar:</span>
              <span className="text-white font-bold">{solarResults.solarAzimuthDeg.toFixed(2)}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Fase da Luz:</span>
              <span className="text-emerald-400 font-semibold">{solarResults.twilightPhase}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-800/80">
              <span className="text-slate-400">Estação ({solarParams.latitude >= 0 ? 'Norte LAT+' : 'Sul LAT-'}):</span>
              <span className="text-amber-300 font-bold">
                {solarResults.seasonInfo.seasonName}
              </span>
            </div>
            {Math.abs(solarParams.axialTilt) >= 0.01 && (
              <div className="flex flex-col gap-0.5 pt-1 border-t border-slate-800/80">
                <div className="flex justify-between">
                  <span className="text-slate-400">Próxima Transição:</span>
                  <span className="text-indigo-300 font-bold">{solarResults.seasonInfo.nextTransition.nextSeasonName}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">Dia / Hora Local:</span>
                  <span className="text-emerald-300 font-bold">
                    {solarResults.seasonInfo.nextTransition.transitionLocalDateFormatted}{' '}
                    {solarResults.seasonInfo.nextTransition.transitionLocalTimeFormatted}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 6. Collapsible Side Drawer: Base NOAA & Fusos Históricos */}
        {isNoaaDrawerOpen && (
          <div className="absolute inset-y-0 right-0 z-30 w-full sm:w-[460px] bg-slate-950/95 border-l border-slate-800 shadow-2xl backdrop-blur-xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white font-mono">
                  Base Global NOAA & Fusos Históricos
                </h3>
              </div>
              <button
                onClick={() => setIsNoaaDrawerOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Filter Input inside Drawer */}
            <div className="p-3 border-b border-slate-800/80 bg-slate-900/40 space-y-2">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3" />
                <input
                  type="text"
                  value={noaaSearchFilter}
                  onChange={(e) => setNoaaSearchFilter(e.target.value)}
                  placeholder="Escrever para procurar observatório NOAA ou fuso (ex: UTC+14, Brasil, Tóquio, Nepal)..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none font-sans"
                />
                {noaaSearchFilter && (
                  <button
                    onClick={() => setNoaaSearchFilter('')}
                    className="absolute right-2.5 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Region Filter Chips */}
              <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                <button
                  onClick={() => setDrawerRegion('all')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    drawerRegion === 'all'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Todos ({NOAA_LOCATIONS.length})
                </button>
                <button
                  onClick={() => setDrawerRegion('americas')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    drawerRegion === 'americas'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Américas
                </button>
                <button
                  onClick={() => setDrawerRegion('europe_africa')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    drawerRegion === 'europe_africa'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Europa & África
                </button>
                <button
                  onClick={() => setDrawerRegion('asia')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    drawerRegion === 'asia'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Ásia
                </button>
                <button
                  onClick={() => setDrawerRegion('oceania')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    drawerRegion === 'oceania'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Oceania & Pacífico
                </button>
                <button
                  onClick={() => setDrawerRegion('fractional')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    drawerRegion === 'fractional'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Fracionários (:30/:45)
                </button>
              </div>
            </div>

            {/* Observatories List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredNoaaLocations.map((loc) => {
                const isSelected = selectedNoaaLocation?.id === loc.id;
                const isTimelineExpanded = expandedTimelineId === loc.id;
                const locCoverage = calculateTimezoneCoverage(loc.standardTimezoneOffset, loc.longitude);

                return (
                  <div
                    key={loc.id}
                    className={`p-4 rounded-xl border transition-all space-y-2.5 ${
                      isSelected
                        ? 'bg-slate-900 border-amber-500/80 ring-1 ring-amber-500/40 shadow-lg'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    {/* Location Title & Flags */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{loc.flagEmoji}</span>
                        <div>
                          <h4 className="text-sm font-bold text-white">{loc.name}</h4>
                          <p className="text-xs text-slate-400">{loc.country}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-slate-800 text-amber-400 border border-slate-700">
                          UTC{loc.standardTimezoneOffset >= 0 ? '+' : ''}
                          {loc.standardTimezoneOffset}
                        </span>
                      </div>
                    </div>

                    {/* Geographic & Coverage Swath Details */}
                    <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 text-[11px] font-mono text-slate-300">
                      <div>
                        <span className="text-slate-500 block">Coordenadas:</span>
                        <strong className="text-slate-200">{loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}°</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Meridiano Central:</span>
                        <strong className="text-amber-400">{locCoverage.meridianName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Faixa 15°:</span>
                        <strong className="text-sky-300">{locCoverage.westLimitLng}° a {locCoverage.eastLimitLng}°</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Meio-Dia Solar:</span>
                        <strong className="text-emerald-400">{locCoverage.solarNoonCivilTimeFormatted}</strong>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {loc.historicalNotes}
                    </p>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleSelectNoaaLocation(loc)}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5" /> Colocar no Mapa & Aplicar
                      </button>

                      <button
                        onClick={() =>
                          setExpandedTimelineId(isTimelineExpanded ? null : loc.id)
                        }
                        className="py-1.5 px-2.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Ver linha do tempo histórica"
                      >
                        <span>Histórico</span>
                        {isTimelineExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </button>
                    </div>

                    {/* Historical Timeline Accordion */}
                    {isTimelineExpanded && loc.historicalTimeline && (
                      <div className="pt-2 border-t border-slate-800/80 space-y-2 text-xs">
                        <span className="text-[11px] font-mono text-amber-400 font-bold flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-amber-400" /> Linha do Tempo Legal & Horário de Verão:
                        </span>
                        <div className="space-y-1.5 pl-2 border-l border-amber-500/30">
                          {loc.historicalTimeline.map((rule, idx) => (
                            <div key={idx} className="bg-slate-950/60 p-2 rounded border border-slate-800/60">
                              <div className="flex items-center justify-between text-[11px] font-mono">
                                <span className="font-bold text-slate-200">{rule.period}</span>
                                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-emerald-400 font-bold">
                                  {rule.offsetLabel}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-1">{rule.ruleDescription}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 7. Dedicated Timezone Change & System Modal */}
      <TimezoneChangeModal
        isOpen={isTimezoneModalOpen}
        onClose={() => setIsTimezoneModalOpen(false)}
        solarParams={solarParams}
        solarResults={solarResults}
        onUpdateParams={onUpdateParams}
        locationName={selectedPlaceName}
      />
    </div>
  );
};
