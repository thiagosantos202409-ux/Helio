import React, { useState, useEffect, useRef } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  Search,
  MapPin,
  X,
  Loader2,
  Sparkles,
  Building2,
  Telescope,
  Globe2,
  Bookmark,
} from 'lucide-react';
import { searchAddressGeocode } from '../services/googleMapsService';
import { NOAA_LOCATIONS } from '../data/noaaLocations';
import { NOAALocation } from '../types/solar';

interface PlaceSearchControlProps {
  onSelectCoordinates: (lat: number, lng: number, placeName?: string) => void;
  onSelectNoaaLocation?: (loc: NOAALocation) => void;
  currentLat: number;
  currentLng: number;
}

interface SuggestionItem {
  id: string;
  primaryText: string;
  secondaryText?: string;
  lat?: number;
  lng?: number;
  place?: any;
  noaaLocation?: NOAALocation;
}

export const PlaceSearchControl: React.FC<PlaceSearchControlProps> = ({
  onSelectCoordinates,
  onSelectNoaaLocation,
  currentLat,
  currentLng,
}) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');

  const [inputVal, setInputVal] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [noaaMatches, setNoaaMatches] = useState<NOAALocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | 'noaa' | 'cities' | 'observatories' | 'geographic'>('all');

  const sessionTokenRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filter NOAA and Google Places suggestions when user types
  useEffect(() => {
    const query = inputVal.trim().toLowerCase();

    if (!query) {
      setSuggestions([]);
      setNoaaMatches([]);
      setIsLoading(false);
      return;
    }

    // 1. Instant NOAA matches
    const matched = NOAA_LOCATIONS.filter((loc) => {
      const q = query;
      return (
        loc.name.toLowerCase().includes(q) ||
        loc.country.toLowerCase().includes(q) ||
        loc.timeZoneId.toLowerCase().includes(q) ||
        loc.historicalNotes.toLowerCase().includes(q) ||
        (q.includes('utc') && loc.standardTimezoneOffset.toString().includes(q.replace('utc', '').trim()))
      );
    });
    setNoaaMatches(matched);

    // 2. Google Places Autocomplete or Geocode
    const timer = setTimeout(async () => {
      setIsLoading(true);

      // Try modern Autocomplete Data API if places library is loaded
      if (placesLib) {
        try {
          const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib as any;
          if (!sessionTokenRef.current && AutocompleteSessionToken) {
            sessionTokenRef.current = new AutocompleteSessionToken();
          }

          const request = {
            input: inputVal,
            sessionToken: sessionTokenRef.current,
          };

          if (AutocompleteSuggestion && typeof AutocompleteSuggestion.fetchAutocompleteSuggestions === 'function') {
            const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
            if (response.suggestions && response.suggestions.length > 0) {
              const items: SuggestionItem[] = response.suggestions.map((s: any, idx: number) => {
                const pred = s.placePrediction;
                return {
                  id: pred?.placeId || String(idx),
                  primaryText: pred?.mainText?.text || pred?.text?.text || inputVal,
                  secondaryText: pred?.secondaryText?.text,
                  place: pred && typeof pred.toPlace === 'function' ? pred.toPlace() : undefined,
                };
              });
              setSuggestions(items);
              setIsLoading(false);
              return;
            }
          }
        } catch (err) {
          console.warn('AutocompleteSuggestion failed, falling back to geocode:', err);
        }
      }

      // Fallback to Geocoding API proxy
      try {
        const geoResults = await searchAddressGeocode(inputVal);
        if (geoResults && geoResults.length > 0) {
          const items: SuggestionItem[] = geoResults.map((g, idx) => ({
            id: g.placeId || String(idx),
            primaryText: g.formattedAddress.split(',')[0],
            secondaryText: g.formattedAddress.split(',').slice(1).join(',').trim(),
            lat: g.lat,
            lng: g.lng,
          }));
          setSuggestions(items);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.error('Geocode search failed:', err);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [inputVal, placesLib]);

  const handleSelectNoaa = (loc: NOAALocation) => {
    onSelectCoordinates(loc.latitude, loc.longitude, loc.name);
    if (onSelectNoaaLocation) {
      onSelectNoaaLocation(loc);
    }
    setInputVal(loc.name);
    setIsOpen(false);
    setSuggestions([]);
    setNoaaMatches([]);

    if (map) {
      map.panTo({ lat: loc.latitude, lng: loc.longitude });
      map.setZoom(6);
    }
  };

  const handleSelectSuggestion = async (item: SuggestionItem) => {
    let lat = item.lat;
    let lng = item.lng;

    if (item.place) {
      try {
        await item.place.fetchFields({
          fields: ['location', 'displayName', 'formattedAddress'],
        });
        if (item.place.location) {
          lat = item.place.location.lat();
          lng = item.place.location.lng();
        }
      } catch (err) {
        console.error('fetchFields failed:', err);
      }
    }

    sessionTokenRef.current = null;

    if (typeof lat === 'number' && typeof lng === 'number') {
      onSelectCoordinates(lat, lng, item.primaryText);
      setInputVal(item.primaryText);
      setIsOpen(false);
      setSuggestions([]);
      setNoaaMatches([]);

      if (map) {
        map.panTo({ lat, lng });
        map.setZoom(9);
      }
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    if (noaaMatches.length > 0) {
      handleSelectNoaa(noaaMatches[0]);
      return;
    }

    if (suggestions.length > 0) {
      handleSelectSuggestion(suggestions[0]);
      return;
    }

    setIsLoading(true);
    const results = await searchAddressGeocode(inputVal);
    setIsLoading(false);
    if (results && results.length > 0) {
      const top = results[0];
      onSelectCoordinates(top.lat, top.lng, top.formattedAddress);
      setIsOpen(false);
      if (map) {
        map.panTo({ lat: top.lat, lng: top.lng });
        map.setZoom(9);
      }
    }
  };

  const handlePresetSelect = (preset: { name: string; lat: number; lng: number }) => {
    // Match against known NOAA locations to apply exact local timezone immediately
    const matchedNoaa = NOAA_LOCATIONS.find(
      (l) => Math.abs(l.latitude - preset.lat) < 1.0 && Math.abs(l.longitude - preset.lng) < 1.0
    );
    if (matchedNoaa && onSelectNoaaLocation) {
      handleSelectNoaa(matchedNoaa);
      return;
    }

    onSelectCoordinates(preset.lat, preset.lng, preset.name);
    setInputVal(preset.name);
    setIsOpen(false);
    if (map) {
      map.panTo({ lat: preset.lat, lng: preset.lng });
      map.setZoom(8);
    }
  };

  // Curated location presets
  const worldCities = [
    { name: 'Tóquio 🇯🇵', lat: 35.6762, lng: 139.6503 },
    { name: 'São Paulo 🇧🇷', lat: -23.5505, lng: -46.6333 },
    { name: 'Londres 🇬🇧', lat: 51.5074, lng: -0.1278 },
    { name: 'Nova York 🇺🇸', lat: 40.7128, lng: -74.0060 },
    { name: 'Paris 🇫🇷', lat: 48.8566, lng: 2.3522 },
    { name: 'Cairo 🇪🇬', lat: 30.0444, lng: 31.2357 },
    { name: 'Dubai 🇦🇪', lat: 25.2048, lng: 55.2708 },
    { name: 'Sydney 🇦🇺', lat: -33.8688, lng: 151.2093 },
    { name: 'Honolulu 🌺', lat: 21.3069, lng: -157.8583 },
  ];

  const observatories = [
    { name: 'Observatório Real de Greenwich 🇬🇧 (Meridiano Zero)', lat: 51.4769, lng: 0.0005 },
    { name: 'Observatório Mauna Kea 🇺🇸 (Havaí)', lat: 19.8207, lng: -155.4681 },
    { name: 'Observatório de La Silla 🇨🇱 (Atacama)', lat: -29.2563, lng: -70.7380 },
    { name: 'Roque de los Muchachos 🇪🇸 (Canárias)', lat: 28.7619, lng: -17.8933 },
    { name: 'Observatório Nacional 🇧🇷 (Rio de Janeiro)', lat: -22.8958, lng: -43.2241 },
  ];

  const geographicMilestones = [
    { name: 'Marco Zero do Equador 🌍 (Macapá)', lat: 0.0000, lng: -51.0783 },
    { name: 'Pólo Norte Geográfico ❄️ (90°N)', lat: 90.0000, lng: 0.0000 },
    { name: 'Pólo Sul Geográfico 🇦🇶 (90°S)', lat: -90.0000, lng: 0.0000 },
    { name: 'Trópico de Câncer ☀️ (23.44°N)', lat: 23.4365, lng: 0.0000 },
    { name: 'Trópico de Capricórnio ☀️ (23.44°S)', lat: -23.4365, lng: 0.0000 },
  ];

  return (
    <div ref={containerRef} className="relative z-30 w-full max-w-md">
      {/* Search Input Form */}
      <form onSubmit={handleSearchSubmit} className="relative flex items-center">
        <div className="absolute left-3.5 text-amber-400 pointer-events-none">
          <Search className="w-4 h-4" />
        </div>

        <input
          type="text"
          value={inputVal}
          onChange={(e) => {
            setInputVal(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Escrever para procurar observatório NOAA, cidade ou país..."
          className="w-full pl-10 pr-20 py-2.5 bg-slate-900/95 border border-slate-700 hover:border-amber-500/60 focus:border-amber-500 text-slate-100 text-xs rounded-xl shadow-xl backdrop-blur-md focus:outline-none transition-all placeholder:text-slate-400 font-sans"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {isLoading && <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin mr-1" />}
          {inputVal && (
            <button
              type="button"
              onClick={() => {
                setInputVal('');
                setSuggestions([]);
                setNoaaMatches([]);
              }}
              className="p-1 text-slate-400 hover:text-white rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="submit"
            className="px-2 py-1 text-[11px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors cursor-pointer"
          >
            Buscar
          </button>
        </div>
      </form>

      {/* Dropdown Suggestions & Curated Locations */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden max-h-[480px] flex flex-col z-50">
          
          {/* 1. Instant Matching NOAA Locations */}
          {noaaMatches.length > 0 && (
            <div className="p-2 border-b border-amber-500/30 bg-amber-500/5 max-h-56 overflow-y-auto">
              <span className="text-[10px] uppercase tracking-wider font-mono text-amber-400 px-2 py-1 flex items-center gap-1.5 font-bold">
                <Bookmark className="w-3 h-3 text-amber-400" /> Base NOAA & Fusos Históricos Encontrados ({noaaMatches.length})
              </span>
              <ul className="space-y-1">
                {noaaMatches.map((loc) => (
                  <li
                    key={loc.id}
                    onClick={() => handleSelectNoaa(loc)}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-950/60 hover:bg-amber-500/15 border border-slate-800 hover:border-amber-500/40 cursor-pointer text-xs text-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="text-base">{loc.flagEmoji}</span>
                      <div className="truncate">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          {loc.name}
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                            NOAA
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {loc.country} • IANA: {loc.timeZoneId}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                        UTC{loc.standardTimezoneOffset >= 0 ? '+' : ''}{loc.standardTimezoneOffset}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 2. Google Maps Autocomplete Predictions */}
          {suggestions.length > 0 && (
            <div className="p-2 border-b border-slate-800 max-h-52 overflow-y-auto">
              <span className="text-[10px] uppercase tracking-wider font-mono text-sky-400 px-2 py-1 block">
                Sugestões Google Maps
              </span>
              <ul className="space-y-1">
                {suggestions.map((item) => (
                  <li
                    key={item.id}
                    onClick={() => handleSelectSuggestion(item)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-800/80 cursor-pointer text-xs text-slate-200 transition-colors"
                  >
                    <MapPin className="w-4 h-4 text-sky-400 shrink-0" />
                    <div className="truncate">
                      <div className="font-semibold text-white">{item.primaryText}</div>
                      {item.secondaryText && (
                        <div className="text-[11px] text-slate-400 truncate">{item.secondaryText}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 3. Quick Categories Header */}
          <div className="p-3 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-amber-400 font-mono flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Explorar Locais:
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveCategory('noaa')}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  activeCategory === 'noaa' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Base NOAA ({NOAA_LOCATIONS.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('cities')}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  activeCategory === 'cities' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Cidades
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('observatories')}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  activeCategory === 'observatories' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Observatórios
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('geographic')}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  activeCategory === 'geographic' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Marcos
              </button>
            </div>
          </div>

          {/* 4. Category Details */}
          <div className="p-3 overflow-y-auto space-y-3">
            {(activeCategory === 'all' || activeCategory === 'noaa') && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono text-amber-300 flex items-center gap-1 font-bold">
                  <Bookmark className="w-3 h-3 text-amber-400" /> Observatórios da Base NOAA (Colocar no Mapa):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {NOAA_LOCATIONS.map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => handleSelectNoaa(loc)}
                      className="px-2.5 py-1.5 text-xs text-left rounded-lg bg-slate-950/70 hover:bg-amber-500/10 text-slate-200 border border-slate-800 hover:border-amber-500/40 flex items-center justify-between group transition-colors"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span>{loc.flagEmoji}</span>
                        <span className="truncate group-hover:text-amber-300">{loc.name.split('/')[0]}</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 shrink-0">
                        UTC{loc.standardTimezoneOffset >= 0 ? '+' : ''}{loc.standardTimezoneOffset}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(activeCategory === 'all' || activeCategory === 'cities') && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-sky-400" /> Cidades Globais:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {worldCities.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => handlePresetSelect(c)}
                      className="px-2.5 py-1 text-xs rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(activeCategory === 'all' || activeCategory === 'observatories') && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <Telescope className="w-3 h-3 text-emerald-400" /> Outros Grandes Observatórios:
                </span>
                <div className="flex flex-col gap-1">
                  {observatories.map((obs) => (
                    <button
                      key={obs.name}
                      type="button"
                      onClick={() => handlePresetSelect(obs)}
                      className="px-2.5 py-1.5 text-xs text-left rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-200 border border-slate-800 flex items-center justify-between group transition-colors"
                    >
                      <span className="group-hover:text-amber-300 font-medium">{obs.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {obs.lat > 0 ? `${obs.lat}°N` : `${Math.abs(obs.lat)}°S`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(activeCategory === 'all' || activeCategory === 'geographic') && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <Globe2 className="w-3 h-3 text-rose-400" /> Marcos Geográficos:
                </span>
                <div className="flex flex-col gap-1">
                  {geographicMilestones.map((m) => (
                    <button
                      key={m.name}
                      type="button"
                      onClick={() => handlePresetSelect(m)}
                      className="px-2.5 py-1.5 text-xs text-left rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-200 border border-slate-800 flex items-center justify-between group transition-colors"
                    >
                      <span className="group-hover:text-rose-300 font-medium">{m.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">{m.lat}°</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
