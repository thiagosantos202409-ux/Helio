import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Clock,
  Globe,
  Search,
  CheckCircle2,
  Zap,
  MapPin,
  Sliders,
  Sun,
  Compass,
  Calendar,
  Volume2,
} from 'lucide-react';
import { SolarInputParameters, SolarCalculationResult, TimezoneSystemMode, NOAALocation } from '../types/solar';
import { NOAA_LOCATIONS } from '../data/noaaLocations';
import {
  COMPUTER_TIMEZONES,
  CITY_TIMEZONE_GROUPS,
  COMPUTER_TZ_STATS,
  ComputerTimezoneEntry,
  CityTimezoneGroup,
  ComputerTimezoneRegion,
} from '../data/ianaComputerTimezones';
import { getHistoricalTimezoneOffset, findNextDstTransition } from '../engine/solarEngine';
import {
  ALL_TIMEZONE_SYSTEMS,
  TIMEZONE_SYSTEM_CATEGORIES,
  TimezoneSystemCategory,
  getNatoZoneDetails,
} from '../data/timezoneSystems';
import { getTimezonePronunciation, speakTimezonePronunciation } from '../data/timezonePronunciations';

interface TimezoneChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  solarParams: SolarInputParameters;
  solarResults: SolarCalculationResult;
  onUpdateParams: (newParams: Partial<SolarInputParameters>) => void;
  locationName?: string;
  initialTab?: 'systems' | 'same_utc' | 'all_zones' | 'manual';
}

export const TimezoneChangeModal: React.FC<TimezoneChangeModalProps> = ({
  isOpen,
  onClose,
  solarParams,
  solarResults,
  onUpdateParams,
  locationName = 'Local Atual',
  initialTab = 'systems',
}) => {
  const [activeTab, setActiveTab] = useState<'systems' | 'same_utc' | 'all_zones' | 'manual'>(initialTab);
  const [systemCategoryFilter, setSystemCategoryFilter] = useState<'all' | TimezoneSystemCategory>('all');
  const [systemSearchFilter, setSystemSearchFilter] = useState('');
  const [sameUtcFilter, setSameUtcFilter] = useState<string>('-5');
  const [searchFilter, setSearchFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState<'all' | ComputerTimezoneRegion>('all');
  const [versionFilter, setVersionFilter] = useState<'all' | 'multi_version' | 'dst' | 'fractional' | 'legacy_only'>('all');
  const [zonesViewMode, setZonesViewMode] = useState<'by_city' | 'flat_all'>('by_city');
  const [visibleLimit, setVisibleLimit] = useState<number>(80);
  const [manualOffsetInput, setManualOffsetInput] = useState<number>(solarParams.civilTimezoneOffset);

  useEffect(() => {
    if (isOpen) {
      setManualOffsetInput(solarParams.civilTimezoneOffset);
      setActiveTab(initialTab);
    }
  }, [isOpen, solarParams.civilTimezoneOffset, initialTab]);

  useEffect(() => {
    setVisibleLimit(80);
  }, [searchFilter, regionFilter, versionFilter, zonesViewMode]);

  const currentSystem = solarParams.timezoneSystemMode || 'noaa_official';

  const filteredSystems = useMemo(() => {
    let list = ALL_TIMEZONE_SYSTEMS;
    if (systemCategoryFilter !== 'all') {
      list = list.filter((s) => s.category === systemCategoryFilter);
    }
    if (systemSearchFilter.trim()) {
      const q = systemSearchFilter.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.shortName.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.categoryLabel.toLowerCase().includes(q)
      );
    }
    return list;
  }, [systemCategoryFilter, systemSearchFilter]);

  // Filtered City Groups (Divided by City & Versions)
  const filteredCityGroups = useMemo(() => {
    let list = CITY_TIMEZONE_GROUPS;
    if (regionFilter !== 'all') {
      list = list.filter((g) => g.region === regionFilter);
    }
    if (versionFilter === 'multi_version') {
      list = list.filter((g) => g.versions.length > 1);
    } else if (versionFilter === 'dst') {
      list = list.filter((g) => g.hasDst);
    } else if (versionFilter === 'fractional') {
      list = list.filter((g) => g.stdOffsetHours % 1 !== 0 || g.altOffsetHours % 1 !== 0);
    } else if (versionFilter === 'legacy_only') {
      list = list.filter((g) => g.versions.some((v) => !v.isCanonical));
    }

    const normText = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    const q = normText(searchFilter.trim());
    if (!q) return list;

    return list.filter(
      (g) =>
        normText(g.cityName).includes(q) ||
        normText(g.countryName).includes(q) ||
        normText(g.canonicalId).includes(q) ||
        normText(g.comment).includes(q) ||
        `utc${g.stdOffsetHours >= 0 ? '+' : ''}${g.stdOffsetHours}`.includes(q) ||
        g.versions.some(
          (v) =>
            normText(v.id).includes(q) ||
            normText(v.cityName).includes(q) ||
            normText(v.comment).includes(q)
        )
    );
  }, [regionFilter, versionFilter, searchFilter]);

  // Filtered Flat List of ALL 597 Computer IANA Timezones
  const filteredFlatZones = useMemo(() => {
    let list = COMPUTER_TIMEZONES;
    if (regionFilter !== 'all') {
      list = list.filter((z) => z.region === regionFilter);
    }
    if (versionFilter === 'multi_version') {
      const multiSet = new Set(
        CITY_TIMEZONE_GROUPS.filter((g) => g.versions.length > 1).map((g) => g.canonicalId)
      );
      list = list.filter((z) => multiSet.has(z.canonicalId));
    } else if (versionFilter === 'dst') {
      list = list.filter((z) => z.hasDst);
    } else if (versionFilter === 'fractional') {
      list = list.filter((z) => z.stdOffsetHours % 1 !== 0 || z.altOffsetHours % 1 !== 0);
    } else if (versionFilter === 'legacy_only') {
      list = list.filter((z) => !z.isCanonical);
    }

    const normText = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    const q = normText(searchFilter.trim());
    if (!q) return list;

    return list.filter(
      (z) =>
        normText(z.id).includes(q) ||
        normText(z.canonicalId).includes(q) ||
        normText(z.cityName).includes(q) ||
        normText(z.countryName).includes(q) ||
        normText(z.comment).includes(q) ||
        `utc${z.stdOffsetHours >= 0 ? '+' : ''}${z.stdOffsetHours}`.includes(q) ||
        String(z.stdOffsetHours).includes(q)
    );
  }, [regionFilter, versionFilter, searchFilter]);

  // Same-UTC Offset Comparator (Locations sharing the same base UTC offset or +/-1h summer band)
  const sameUtcLocations = useMemo(() => {
    if (sameUtcFilter === 'all') {
      return NOAA_LOCATIONS;
    }
    const target = parseFloat(sameUtcFilter);
    return NOAA_LOCATIONS.filter((loc) => {
      if (sameUtcFilter === '0') {
        return loc.standardTimezoneOffset === 0 || loc.timeZoneId === 'Africa/Casablanca';
      }
      if (sameUtcFilter === '-4') {
        return loc.standardTimezoneOffset === -4 || loc.timeZoneId === 'America/Asuncion';
      }
      if (sameUtcFilter === '-3') {
        return loc.standardTimezoneOffset === -3 || loc.timeZoneId === 'America/Nuuk';
      }
      if (sameUtcFilter === '10.5') {
        return loc.standardTimezoneOffset === 10 || loc.standardTimezoneOffset === 10.5 || loc.standardTimezoneOffset === 9.5;
      }
      return Math.abs(loc.standardTimezoneOffset - target) < 0.01;
    });
  }, [sameUtcFilter]);

  if (!isOpen) return null;

  const handleSelectSystem = (mode: TimezoneSystemMode) => {
    onUpdateParams({ timezoneSystemMode: mode });
  };

  const handleSelectSpecificTimezone = (loc: NOAALocation) => {
    const resolved = getHistoricalTimezoneOffset(loc.timeZoneId, solarParams.referenceDate);
    onUpdateParams({
      timeZoneId: loc.timeZoneId,
      civilTimezoneOffset: resolved.offsetHours,
      timezoneSystemMode: 'noaa_official',
      autoHistoricalTimezone: true,
    });
  };

  const handleSelectComputerEntry = (entry: ComputerTimezoneEntry, moveCoords: boolean) => {
    const resolved = getHistoricalTimezoneOffset(entry.id, solarParams.referenceDate);
    const isHavana = entry.id === 'America/Havana' || entry.id === 'Cuba';
    onUpdateParams({
      timeZoneId: entry.id,
      civilTimezoneOffset: resolved.offsetHours,
      timezoneSystemMode: isHavana ? 'cuba_havana' : 'noaa_official',
      autoHistoricalTimezone: true,
      ...(moveCoords && entry.latitude !== null && entry.longitude !== null
        ? { latitude: entry.latitude, longitude: entry.longitude }
        : {}),
    });
  };

  const handleApplyManualOffset = (offset: number) => {
    setManualOffsetInput(offset);
    onUpdateParams({
      civilTimezoneOffset: offset,
      timezoneSystemMode: 'manual_custom',
      autoHistoricalTimezone: false,
    });
  };

  return (
    <div
      onClick={onClose}
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pointer-events-auto relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
                Mudar Sistema de Fuso Horário
              </h2>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-amber-400" />
                Local: <strong className="text-slate-200">{locationName}</strong> (Lat {solarParams.latitude.toFixed(2)}°, Lon {solarParams.longitude.toFixed(2)}°)
              </p>
              {(() => {
                const activePron = getTimezonePronunciation(
                  solarResults.historicalTimezoneInfo?.timeZoneId || solarParams.timeZoneId || 'UTC',
                  solarResults.historicalTimezoneInfo?.timezoneAbbrev || 'UTC',
                  solarResults.historicalTimezoneInfo?.offsetHours ?? solarParams.civilTimezoneOffset,
                  solarParams.referenceDate
                );
                return (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                    <span className="px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-extrabold">
                      {activePron.abbrev}
                    </span>
                    <span className="text-amber-200">{activePron.pronunciationGuide}</span>
                    <button
                      type="button"
                      onClick={() => speakTimezonePronunciation(activePron)}
                      className="px-1.5 py-0.2 rounded bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1 cursor-pointer"
                      title="Ouvir pronúncia"
                    >
                      <Volume2 className="w-3 h-3" /> Ouvir
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 border-b border-slate-800/80 bg-slate-900/90 text-[11px] font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('systems')}
            className={`px-2.5 py-2 border-b-2 font-bold transition-colors cursor-pointer ${
              activeTab === 'systems'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Sistemas ({ALL_TIMEZONE_SYSTEMS.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('same_utc')}
            className={`px-2.5 py-2 border-b-2 font-bold transition-colors cursor-pointer ${
              activeTab === 'same_utc'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Mesmo UTC & Calendários DST
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('all_zones')}
            className={`px-2.5 py-2 border-b-2 font-bold transition-colors cursor-pointer ${
              activeTab === 'all_zones'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            3. Por Cidade & Versões ({COMPUTER_TZ_STATS.totalOptions})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`px-2.5 py-2 border-b-2 font-bold transition-colors cursor-pointer ${
              activeTab === 'manual'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            4. Manual (+/-)
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: TODOS OS 14 SISTEMAS DE FUSO */}
          {activeTab === 'systems' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-2">
                <div>
                  <span className="font-bold text-amber-400 block mb-0.5">
                    Escolha entre todos os {ALL_TIMEZONE_SYSTEMS.length} sistemas de fuso horário e medição do tempo:
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Civis, históricos, ferroviários, solares, astronômicos (sideral), decimais, náuticos NOAA, militares NATO, atômicos (TAI/TT) e internet (.beats).
                  </span>
                </div>

                {/* Search & Category Filter */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={systemSearchFilter}
                    onChange={(e) => setSystemSearchFilter(e.target.value)}
                    placeholder="Buscar sistema (ex: Militar, NATO, Sideral, Decimal, Ferroviário, Atômico, Swatch)..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                  {TIMEZONE_SYSTEM_CATEGORIES.map((cat) => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setSystemCategoryFilter(cat.id)}
                      className={`px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                        systemCategoryFilter === cat.id
                          ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {filteredSystems.map((sys) => {
                  const isActive = currentSystem === sys.id;
                  const nautMeridian = Math.round(solarParams.longitude / 15) * 15;
                  const nautOffset = Math.max(-12, Math.min(14, Math.round(solarParams.longitude / 15)));
                  const nato = getNatoZoneDetails(Math.max(-12, Math.min(12, Math.round(solarParams.longitude / 15))));

                  return (
                    <button
                      key={sys.id}
                      type="button"
                      onClick={() => {
                        handleSelectSystem(sys.id);
                        if (sys.id === 'manual_custom') setActiveTab('manual');
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                        isActive
                          ? 'bg-amber-500/15 border-amber-500/60 shadow-lg text-white'
                          : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-lg shrink-0">
                        {sys.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs sm:text-sm text-amber-300 font-mono truncate">
                            {sys.name}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[9px] font-mono text-slate-400">
                              {sys.categoryLabel}
                            </span>
                            {isActive && (
                              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 font-mono">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                          {sys.description}
                        </p>

                        {/* Live Preview Hint Line */}
                        <div className="mt-1.5 text-[10px] font-mono text-slate-400 flex flex-wrap gap-2">
                          {isActive && solarResults.specialClockDisplay && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                              Relógio Ativo: {solarResults.specialClockDisplay}
                            </span>
                          )}
                          {sys.ianaZoneOverride && (() => {
                            const nextDst = findNextDstTransition(sys.ianaZoneOverride, solarParams.referenceDate);
                            return nextDst.hasTransition ? (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                                Próx. Mudança: {nextDst.transitionLocalDateFormatted} {nextDst.transitionLocalTimeFormatted} ({nextDst.directionLabel})
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400">
                                Offset Fixo / Sem Troca Sazonal
                              </span>
                            );
                          })()}
                          {sys.id === 'noaa_official' && (
                            <span>
                              Fuso Local: <strong className="text-slate-200">{solarParams.timeZoneId || 'Auto'}</strong>
                            </span>
                          )}
                          {sys.id === 'military_nato' && (
                            <span>
                              Para Lon {solarParams.longitude.toFixed(1)}°: <strong className="text-sky-300">Zona {nato.letter} ({nato.phonetic})</strong>
                            </span>
                          )}
                          {sys.id === 'noaa_nautical' && (
                            <span>
                              Meridiano Central: <strong className="text-sky-300">{nautMeridian}° (UTC{nautOffset >= 0 ? '+' : ''}{nautOffset})</strong>
                            </span>
                          )}
                          {sys.id === 'lmt_mean' && (
                            <span>
                              Deslocamento Exato: <strong className="text-sky-300">{(solarParams.longitude * 4).toFixed(1)} min de Greenwich</strong>
                            </span>
                          )}
                          {sys.id === 'solar_lst' && (
                            <span>
                              Hora Solar Verdadeira: <strong className="text-emerald-400">{solarResults.lstLocalFormatted}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: MESMO UTC & CALENDÁRIOS DE HORÁRIO DE VERÃO DIFERENTES */}
          {activeTab === 'same_utc' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-2">
                <div>
                  <span className="font-bold text-amber-400 flex items-center gap-1.5 mb-0.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    Mesma Deslocação UTC com Calendários DST e Mudanças de Horário Diferentes
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Compare países e cidades no <strong>mesmo fuso UTC base</strong> (como Cuba, Nova York, Cancún, Haiti e Colômbia em <strong>UTC-5</strong>; ou Egito, Israel, Líbano e Atenas em <strong>UTC+2</strong>) que mudam os relógios em datas, horas ou regras completamente diferentes.
                  </p>
                </div>

                {/* UTC Offset Bucket Filter */}
                <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                  {[
                    { id: '-5', label: 'UTC-5 (Cuba 🇨🇺 / NY / Cancún / Haiti / Col)' },
                    { id: '-6', label: 'UTC-6 (Chicago / México / Ilha de Páscoa Sul)' },
                    { id: '-4', label: 'UTC-4 (Manaus / Cuiabá / Campo Grande / Chile Sul)' },
                    { id: '-3', label: 'UTC-3 (Brasília / Recife / Salvador / Belém / Arg)' },
                    { id: '0', label: 'UTC+0 (Londres / Lisboa / Marrocos Ramadã / Islândia)' },
                    { id: '2', label: 'UTC+2 (Egito / Israel / Líbano / Atenas / África Sul)' },
                    { id: '10.5', label: 'UTC+9:30/+10:30 (Adelaide / Sydney / Lord Howe 30m)' },
                    { id: 'all', label: 'Todos' },
                  ].map((grp) => (
                    <button
                      type="button"
                      key={grp.id}
                      onClick={() => setSameUtcFilter(grp.id)}
                      className={`px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                        sameUtcFilter === grp.id
                          ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                      }`}
                    >
                      {grp.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {sameUtcLocations.map((loc) => {
                  const resolved = getHistoricalTimezoneOffset(loc.timeZoneId, solarParams.referenceDate);
                  const nextDst = findNextDstTransition(loc.timeZoneId, solarParams.referenceDate);
                  const isCurrent = solarParams.timeZoneId === loc.timeZoneId;
                  const sign = resolved.offsetHours >= 0 ? '+' : '';

                  return (
                    <div
                      key={loc.id}
                      className={`p-3 rounded-xl border transition-all space-y-2 ${
                        isCurrent
                          ? 'bg-amber-500/15 border-amber-500/60 shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xl shrink-0">{loc.flagEmoji}</span>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-white font-mono truncate">
                              {loc.name} <span className="text-slate-400 font-normal">({loc.country})</span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              IANA: <span className="text-slate-300">{loc.timeZoneId}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 font-mono">
                          <span className="text-xs font-bold text-amber-300 block">
                            UTC{sign}{resolved.offsetHours} ({resolved.timezoneAbbrev})
                          </span>
                          {resolved.isDst ? (
                            <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-bold text-[9px] uppercase">
                              {loc.timeZoneId === 'Africa/Casablanca' ? 'Pausa Ramadã' : 'DST Verão Ativo'}
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400">
                              {loc.hasDst ? 'Horário Padrão (Inverno)' : 'Sem DST (Fixo)'}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        {loc.dstDescription || loc.historicalNotes}
                      </p>

                      {(() => {
                        const locPron = getTimezonePronunciation(
                          loc.timeZoneId,
                          resolved.timezoneAbbrev,
                          resolved.offsetHours,
                          solarParams.referenceDate
                        );
                        return (
                          <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1 rounded bg-slate-900/90 border border-slate-800 text-[10px] font-mono">
                            <span className="text-amber-200 truncate">
                              🗣️ <strong className="text-amber-400">{locPron.abbrev}</strong> ({locPron.fullNamePt}) · {locPron.pronunciationGuide}
                            </span>
                            <button
                              type="button"
                              onClick={() => speakTimezonePronunciation(locPron)}
                              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 inline-flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                              title="Ouvir pronúncia deste fuso"
                            >
                              <Volume2 className="w-3 h-3" /> Ouvir
                            </button>
                          </div>
                        );
                      })()}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80 text-[10px] font-mono">
                        {nextDst.hasTransition ? (
                          <span className="text-indigo-300">
                            ⏰ Próx. Mudança:{' '}
                            <strong className="text-white">{nextDst.transitionLocalDateFormatted}</strong> às{' '}
                            <strong className="text-emerald-300">{nextDst.transitionLocalTimeFormatted}</strong>{' '}
                            <span className="text-amber-300">({nextDst.directionLabel})</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            Sem transição prevista nos próximos 12 meses (Offset Fixo)
                          </span>
                        )}

                        <div className="flex items-center gap-1.5 shrink-0">
                          {nextDst.hasTransition && nextDst.transitionUtcDate && (
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateParams({
                                  timeZoneId: loc.timeZoneId,
                                  civilTimezoneOffset: getHistoricalTimezoneOffset(loc.timeZoneId, nextDst.transitionUtcDate!).offsetHours,
                                  timezoneSystemMode: loc.id === 'havana' ? 'cuba_havana' : 'noaa_official',
                                  autoHistoricalTimezone: true,
                                  referenceDate: new Date(nextDst.transitionUtcDate!.getTime()),
                                });
                              }}
                              className="px-2 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-200 border border-indigo-500/40 font-bold cursor-pointer transition-colors"
                              title="Aplicar este fuso e saltar no tempo exatamente para o momento desta mudança de horário"
                            >
                              Saltar p/ Mudança
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (loc.id === 'havana') {
                                onUpdateParams({ timezoneSystemMode: 'cuba_havana' });
                              } else {
                                handleSelectSpecificTimezone(loc);
                              }
                            }}
                            className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer transition-colors"
                          >
                            Aplicar Fuso
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: TODOS OS FUSOS DO COMPUTADOR DIVIDIDOS POR CIDADE E VERSÃO */}
          {activeTab === 'all_zones' && (
            <div className="space-y-3">
              {/* Summary Header & Mode Toggle */}
              <div className="p-3 rounded-xl bg-slate-950/75 border border-slate-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-xs text-amber-400 flex items-center gap-1.5 font-mono">
                      <Globe className="w-3.5 h-3.5 text-amber-400" />
                      {COMPUTER_TZ_STATS.totalOptions} Fusos do Computador divididos por Cidade & Versão
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {COMPUTER_TZ_STATS.canonicalCities} cidades/zonas canônicas + {COMPUTER_TZ_STATS.legacyVersions} versões legadas/aliases IANA ({COMPUTER_TZ_STATS.citiesWithMultipleVersions} cidades com múltiplas versões · {COMPUTER_TZ_STATS.dstCities} com DST).
                    </p>
                  </div>

                  {/* Toggle Grouped by City vs Flat All Options */}
                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[10px] font-mono shrink-0">
                    <button
                      type="button"
                      onClick={() => setZonesViewMode('by_city')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        zonesViewMode === 'by_city'
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      🏙️ Por Cidade & Versão ({filteredCityGroups.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setZonesViewMode('flat_all')}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        zonesViewMode === 'flat_all'
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      📋 Todas Opções ({filteredFlatZones.length})
                    </button>
                  </div>
                </div>

                {/* Search Box */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Buscar entre os 597 fusos (ex: São Paulo, Brazil/East, Havana, Cuba, Kyiv, Calcutta, EST5EDT, UTC-3)..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Region Filters */}
                <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                  {(
                    [
                      { id: 'all', label: 'Todos Continentes' },
                      { id: 'america', label: 'Américas' },
                      { id: 'europe', label: 'Europa' },
                      { id: 'asia', label: 'Ásia' },
                      { id: 'africa', label: 'África' },
                      { id: 'oceania_pacific', label: 'Oceania / Pacífico' },
                      { id: 'atlantic_indian_poles', label: 'Atlântico / Índico / Polos' },
                      { id: 'global_posix', label: 'Global / POSIX / Etc' },
                    ] as Array<{ id: 'all' | ComputerTimezoneRegion; label: string }>
                  ).map((tab) => (
                    <button
                      type="button"
                      key={tab.id}
                      onClick={() => setRegionFilter(tab.id)}
                      className={`px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                        regionFilter === tab.id
                          ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Version / Behavior Sub-filters */}
                <div className="flex flex-wrap gap-1 text-[10px] font-mono pt-1 border-t border-slate-800/80">
                  {[
                    { id: 'all', label: 'Todas Versões' },
                    { id: 'multi_version', label: `Cidades c/ Múltiplas Versões (${COMPUTER_TZ_STATS.citiesWithMultipleVersions})` },
                    { id: 'dst', label: `Com Horário de Verão (${COMPUTER_TZ_STATS.dstCities})` },
                    { id: 'fractional', label: 'Fracionários (:30 / :45)' },
                    { id: 'legacy_only', label: `Legados / Aliases (${COMPUTER_TZ_STATS.legacyVersions})` },
                  ].map((vf) => (
                    <button
                      type="button"
                      key={vf.id}
                      onClick={() => setVersionFilter(vf.id as typeof versionFilter)}
                      className={`px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                        versionFilter === vf.id
                          ? 'bg-sky-500 text-slate-950 font-bold border-sky-400'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                      }`}
                    >
                      {vf.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* VIEW A: POR CIDADE E VERSÕES */}
              {zonesViewMode === 'by_city' && (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {filteredCityGroups.slice(0, visibleLimit).map((group: CityTimezoneGroup) => {
                    const resolvedPrimary = getHistoricalTimezoneOffset(
                      group.canonicalId,
                      solarParams.referenceDate
                    );
                    const isCityActive = group.versions.some((v) => v.id === solarParams.timeZoneId);
                    const formatOff = (n: number) => `UTC${n >= 0 ? '+' : ''}${n}`;

                    return (
                      <div
                        key={group.canonicalId}
                        className={`p-3 rounded-xl border transition-all space-y-2 ${
                          isCityActive
                            ? 'bg-amber-500/15 border-amber-500/60 shadow-sm'
                            : 'bg-slate-950/65 border-slate-800/90 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xl shrink-0">{group.flagEmoji}</span>
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-white font-mono flex flex-wrap items-center gap-1.5">
                                <span>{group.cityName}</span>
                                {group.countryName && (
                                  <span className="text-[11px] text-slate-400 font-normal">
                                    ({group.countryName})
                                  </span>
                                )}
                                <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-[9px] text-slate-400">
                                  {group.regionLabel}
                                </span>
                                {group.versions.length > 1 && (
                                  <span className="px-1.5 py-0.2 rounded bg-sky-500/20 border border-sky-500/40 text-[9px] text-sky-300 font-bold">
                                    {group.versions.length} Versões
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                                {group.latitude !== null && group.longitude !== null && (
                                  <span>
                                    📍 {group.latitude.toFixed(2)}°, {group.longitude.toFixed(2)}°
                                  </span>
                                )}
                                {group.comment && <span className="text-slate-500">· {group.comment}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0 font-mono">
                            <span className="text-xs font-bold text-amber-300 block">
                              {formatOff(resolvedPrimary.offsetHours)} ({resolvedPrimary.timezoneAbbrev})
                            </span>
                            <span className="text-[9px] text-slate-400 block">
                              {group.hasDst
                                ? `Padrão ${formatOff(group.stdOffsetHours)} ↔ Verão ${formatOff(group.altOffsetHours)}`
                                : `Fixo o ano todo (${formatOff(group.stdOffsetHours)})`}
                            </span>
                          </div>
                        </div>

                        {(() => {
                          const grpPron = getTimezonePronunciation(
                            group.canonicalId,
                            resolvedPrimary.timezoneAbbrev,
                            resolvedPrimary.offsetHours,
                            solarParams.referenceDate
                          );
                          return (
                            <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1 rounded bg-slate-900/80 border border-slate-800/80 text-[10px] font-mono">
                              <span className="text-slate-300 truncate">
                                🗣️ <strong className="text-amber-300">{grpPron.abbrev}</strong> · {grpPron.pronunciationGuide}
                              </span>
                              <button
                                type="button"
                                onClick={() => speakTimezonePronunciation(grpPron)}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 inline-flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                              >
                                <Volume2 className="w-3 h-3" /> Ouvir
                              </button>
                            </div>
                          );
                        })()}

                        {/* Versions List inside the City Card */}
                        <div className="space-y-1 pt-1.5 border-t border-slate-800/80">
                          {group.versions.map((ver) => {
                            const isVerActive = solarParams.timeZoneId === ver.id;
                            const resolvedVer = getHistoricalTimezoneOffset(ver.id, solarParams.referenceDate);
                            return (
                              <div
                                key={ver.id}
                                className={`flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] font-mono ${
                                  isVerActive
                                    ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                                    : 'bg-slate-900/75 border-slate-800/80 text-slate-300'
                                }`}
                              >
                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                      ver.isCanonical
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                    }`}
                                  >
                                    {ver.versionLabel}
                                  </span>
                                  <span className="font-bold text-slate-100 truncate">{ver.id}</span>
                                  <span className="text-[10px] text-slate-400">
                                    {formatOff(resolvedVer.offsetHours)} ({resolvedVer.timezoneAbbrev})
                                    {resolvedVer.isDst && ' · DST'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectComputerEntry(ver, false)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                      isVerActive
                                        ? 'bg-emerald-500 text-slate-950'
                                        : 'bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border border-slate-700'
                                    }`}
                                  >
                                    {isVerActive ? 'Ativo' : 'Aplicar Fuso'}
                                  </button>
                                  {ver.latitude !== null && ver.longitude !== null && (
                                    <button
                                      type="button"
                                      onClick={() => handleSelectComputerEntry(ver, true)}
                                      className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500 hover:text-slate-950 text-sky-300 border border-sky-500/40 text-[10px] font-bold cursor-pointer transition-colors"
                                      title="Mover as coordenadas da simulação para esta cidade e aplicar esta versão de fuso"
                                    >
                                      Cidade + Fuso
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {filteredCityGroups.length > visibleLimit && (
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setVisibleLimit((v) => v + 100)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-amber-300 border border-slate-700 cursor-pointer"
                      >
                        Mostrar mais (+100 de {filteredCityGroups.length - visibleLimit} restantes)
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisibleLimit(filteredCityGroups.length)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 border border-slate-800 cursor-pointer"
                      >
                        Ver Todas ({filteredCityGroups.length})
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW B: LISTA COMPLETA COM TODAS AS 597 OPÇÕES DO COMPUTADOR */}
              {zonesViewMode === 'flat_all' && (
                <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                  {filteredFlatZones.slice(0, visibleLimit).map((entry: ComputerTimezoneEntry) => {
                    const resolved = getHistoricalTimezoneOffset(entry.id, solarParams.referenceDate);
                    const isCurrent = solarParams.timeZoneId === entry.id;

                    return (
                      <div
                        key={entry.id}
                        className={`p-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 transition-all ${
                          isCurrent
                            ? 'bg-amber-500/15 border-amber-500/60 text-white shadow-sm'
                            : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xl shrink-0">{entry.flagEmoji}</span>
                          <div className="min-w-0">
                            <div className="font-bold text-xs flex flex-wrap items-center gap-1.5 font-mono">
                              <span className="text-slate-100">{entry.id}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] ${
                                  entry.isCanonical
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                }`}
                              >
                                {entry.versionLabel}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono block truncate">
                              {entry.cityName}
                              {entry.countryName ? ` · ${entry.countryName}` : ''}
                              {!entry.isCanonical ? ` · Alias de ${entry.canonicalId}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 font-mono">
                          <div className="text-right">
                            <span className="text-xs font-bold text-amber-300 block">
                              UTC{resolved.offsetHours >= 0 ? '+' : ''}{resolved.offsetHours} ({resolved.timezoneAbbrev})
                            </span>
                            {resolved.isDst && (
                              <span className="px-1 py-0.2 rounded bg-amber-400 text-slate-950 font-bold text-[9px] uppercase">
                                DST Ativo
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSelectComputerEntry(entry, false)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                              isCurrent
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border border-slate-700'
                            }`}
                          >
                            {isCurrent ? 'Ativo' : 'Aplicar'}
                          </button>
                          {entry.latitude !== null && entry.longitude !== null && (
                            <button
                              type="button"
                              onClick={() => handleSelectComputerEntry(entry, true)}
                              className="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500 hover:text-slate-950 text-sky-300 border border-sky-500/40 text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              + Cidade
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {filteredFlatZones.length > visibleLimit && (
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setVisibleLimit((v) => v + 120)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-amber-300 border border-slate-700 cursor-pointer"
                      >
                        Mostrar mais (+120 de {filteredFlatZones.length - visibleLimit} restantes)
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisibleLimit(filteredFlatZones.length)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-300 border border-slate-800 cursor-pointer"
                      >
                        Ver Todas ({filteredFlatZones.length})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AJUSTE MANUAL */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300">
                <span className="font-bold text-amber-400 block mb-1">
                  Definição Manual de Offset
                </span>
                Permite forçar um fuso horário arbitrário de UTC-12 até UTC+14 para testar qualquer cenário hipotético ou simulação orbital.
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-400 text-xs">Fuso Offset Selecionado:</span>
                  <strong className="text-lg text-amber-400">
                    UTC{manualOffsetInput >= 0 ? '+' : ''}{manualOffsetInput}
                  </strong>
                </div>

                {/* Stepper */}
                <div className="flex items-center justify-center gap-3 font-mono">
                  <button
                    onClick={() => handleApplyManualOffset(Math.max(-12, manualOffsetInput - 1))}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
                  >
                    - 1 Hora
                  </button>
                  <button
                    onClick={() => handleApplyManualOffset(Math.max(-12, manualOffsetInput - 0.5))}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                  >
                    - 30 min
                  </button>
                  <button
                    onClick={() => handleApplyManualOffset(Math.min(14, manualOffsetInput + 0.5))}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                  >
                    + 30 min
                  </button>
                  <button
                    onClick={() => handleApplyManualOffset(Math.min(14, manualOffsetInput + 1))}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
                  >
                    + 1 Hora
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-1.5 font-mono">Atalhos Comuns:</span>
                  <div className="flex flex-wrap gap-1.5 font-mono text-xs">
                    {[-12, -10, -8, -5, -3, 0, 1, 2, 3, 5.5, 8, 9, 10, 12, 14].map((off) => (
                      <button
                        key={off}
                        onClick={() => handleApplyManualOffset(off)}
                        className={`px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
                          manualOffsetInput === off
                            ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {off >= 0 ? `+${off}` : off}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Real-time Impact Summary */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-xs space-y-1.5">
            {solarResults.specialClockDisplay && (
              <div className="flex justify-between pb-1 border-b border-slate-800/70">
                <span className="text-slate-400">Relógio Especial do Sistema:</span>
                <strong className="text-amber-300">{solarResults.specialClockDisplay}</strong>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">Hora Civil com este Fuso:</span>
              <strong className="text-sky-300">{solarResults.localCivilTimeFormatted}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Hora Solar Local (LST):</span>
              <strong className="text-emerald-400">{solarResults.lstLocalFormatted}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Meio-Dia Solar Local:</span>
              <strong className="text-amber-400">{solarResults.solarNoonLocalFormatted}</strong>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Concluir & Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};
