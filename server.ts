import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize GoogleGenAI SDK on server
const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// API Endpoint for Maps configuration
app.get('/api/maps-config', (_req, res) => {
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
  res.json({ apiKey });
});

// API Endpoint for Google Maps Platform Time Zone API
app.get('/api/timezone', async (req, res) => {
  try {
    const { lat, lng, timestamp } = req.query;
    if (!lat || !lng) {
      res.status(400).json({ error: 'Latitude e longitude são obrigatórios' });
      return;
    }
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === 'MY_GOOGLE_MAPS_API_KEY') {
      res.status(200).json({
        status: 'UNAVAILABLE',
        errorMessage: 'Chave do Google Maps Platform em configuração.',
      });
      return;
    }
    const ts = timestamp ? parseInt(String(timestamp), 10) : Math.floor(Date.now() / 1000);
    const url = `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${ts}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error('Timezone API Error:', err);
    res.status(500).json({ error: err.message || 'Erro ao consultar Google Time Zone API' });
  }
});

// API Endpoint for Google Maps Platform Geocoding API (Procura de Locais)
app.get('/api/geocode', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) {
      res.status(400).json({ error: 'Parâmetro address é obrigatório' });
      return;
    }
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === 'MY_GOOGLE_MAPS_API_KEY') {
      res.status(200).json({ status: 'UNAVAILABLE', results: [] });
      return;
    }
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(String(address))}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error('Geocode API Error:', err);
    res.status(500).json({ error: err.message || 'Erro ao consultar Geocoding API' });
  }
});

// Simple in-memory cache for Real City Overpass OSM queries (by rounded lat/lng)
const realCityCache = new Map<string, { ts: number; data: any }>();

// API Endpoint for Searching Any City in the World (Nominatim OSM + Google Geocode fallback)
app.get('/api/city-search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.status(400).json({ error: 'Parâmetro q é obrigatório' });
      return;
    }

    const results: Array<{ name: string; displayName: string; lat: number; lng: number; country: string }> = [];

    // 1. Try OpenStreetMap Nominatim (free worldwide city geocoder)
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=8&addressdetails=1&q=${encodeURIComponent(q)}`;
      const nomRes = await fetch(nomUrl, {
        headers: { 'User-Agent': 'HeliosSolar3D/1.0 (https://localhost)' },
        signal: AbortSignal.timeout(4500),
      });
      if (nomRes.ok) {
        const nomJson = await nomRes.json();
        if (Array.isArray(nomJson)) {
          for (const item of nomJson) {
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            const addr = item.address || {};
            const cityLabel =
              addr.city ||
              addr.town ||
              addr.village ||
              addr.municipality ||
              addr.state ||
              String(item.display_name || q).split(',')[0];
            results.push({
              name: cityLabel,
              displayName: item.display_name || cityLabel,
              lat,
              lng,
              country: addr.country || '',
            });
          }
        }
      }
    } catch {
      // Fall through cleanly
    }

    // 2. Try Google Maps Geocode as backup if configured and Nominatim returned empty
    if (results.length === 0) {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
      if (apiKey && apiKey !== 'MY_GOOGLE_MAPS_API_KEY') {
        try {
          const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${apiKey}`;
          const gRes = await fetch(gUrl, { signal: AbortSignal.timeout(4500) });
          if (gRes.ok) {
            const gData = await gRes.json();
            if (gData.status === 'OK' && Array.isArray(gData.results)) {
              for (const r of gData.results.slice(0, 6)) {
                results.push({
                  name: r.address_components?.[0]?.long_name || r.formatted_address,
                  displayName: r.formatted_address,
                  lat: r.geometry.location.lat,
                  lng: r.geometry.location.lng,
                  country: '',
                });
              }
            }
          }
        } catch {
          // Ignore
        }
      }
    }

    res.json({ results });
  } catch (err: any) {
    console.error('City search error:', err);
    res.status(200).json({ results: [] });
  }
});

// API Endpoint for Real City 3D Buildings, Streets & Water around (lat, lng) via OpenStreetMap Overpass
app.get('/api/real-city', async (req, res) => {
  try {
    const lat = parseFloat(String(req.query.lat));
    const lng = parseFloat(String(req.query.lng));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: 'lat e lng inválidos' });
      return;
    }

    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = realCityCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 10 * 60 * 1000) {
      res.json(cached.data);
      return;
    }

    // Project geo coords to local meters (x = East+, z = South+, North = -z)
    const metersPerDegLat = 111320;
    const metersPerDegLng = Math.max(15000, 111320 * Math.cos((lat * Math.PI) / 180));
    const toLocal = (plat: number, plng: number): [number, number] => [
      Number(((plng - lng) * metersPerDegLng).toFixed(2)),
      Number((-(plat - lat) * metersPerDegLat).toFixed(2)),
    ];

    const query = `[out:json][timeout:10];(
      way["building"](around:680,${lat},${lng});
      way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|pedestrian|unclassified|service"](around:780,${lat},${lng});
      way["natural"="water"](around:900,${lat},${lng});
      way["leisure"="park"](around:780,${lat},${lng});
    );out body;>;out skel qt;`;

    const osmRes = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': 'HeliosSolar3D/1.0',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(8000),
    });

    if (!osmRes.ok) {
      res.json({ source: 'fallback', buildings: [], roads: [], parks: [], waters: [] });
      return;
    }

    const osmData = await osmRes.json();
    const nodeMap = new Map<number, { lat: number; lon: number }>();
    const elements = Array.isArray(osmData?.elements) ? osmData.elements : [];

    for (const el of elements) {
      if (el.type === 'node' && typeof el.id === 'number') {
        nodeMap.set(el.id, { lat: el.lat, lon: el.lon });
      }
    }

    const buildings: Array<{
      id: string;
      name?: string;
      polygon: Array<[number, number]>;
      height: number;
      levels: number;
      styleIdx: number;
    }> = [];
    const roads: Array<{
      id: string;
      points: Array<[number, number]>;
      width: number;
      kind: string;
    }> = [];
    const parks: Array<{ id: string; polygon: Array<[number, number]> }> = [];
    const waters: Array<{ id: string; polygon: Array<[number, number]> }> = [];

    for (const el of elements) {
      if (el.type !== 'way' || !Array.isArray(el.nodes) || el.nodes.length < 2) continue;
      const tags = el.tags || {};
      const pts: Array<[number, number]> = [];
      for (const nid of el.nodes) {
        const n = nodeMap.get(nid);
        if (n) pts.push(toLocal(n.lat, n.lon));
      }
      if (pts.length < 2) continue;

      if (tags.building && pts.length >= 3) {
        const parsedHeight = tags.height ? parseFloat(String(tags.height)) : NaN;
        const parsedLevels = tags['building:levels'] ? parseInt(String(tags['building:levels']), 10) : NaN;
        const levels = Number.isFinite(parsedLevels) && parsedLevels > 0 ? Math.min(65, parsedLevels) : 3 + (el.id % 7);
        const height =
          Number.isFinite(parsedHeight) && parsedHeight > 2
            ? Math.min(180, parsedHeight)
            : Math.max(6, levels * 3.4);

        buildings.push({
          id: `b_${el.id}`,
          name: tags.name || tags['addr:housename'] || undefined,
          polygon: pts.slice(0, 28),
          height: Number(height.toFixed(1)),
          levels,
          styleIdx: Math.abs(el.id) % 4,
        });
      } else if (tags.highway) {
        const hw = String(tags.highway);
        const width =
          hw === 'motorway' || hw === 'trunk' || hw === 'primary'
            ? 8.0
            : hw === 'secondary' || hw === 'tertiary'
              ? 6.2
              : hw === 'pedestrian'
                ? 4.8
                : 4.5;
        roads.push({
          id: `r_${el.id}`,
          points: pts.slice(0, 40),
          width,
          kind: hw,
        });
      } else if (tags.natural === 'water' && pts.length >= 3) {
        waters.push({ id: `w_${el.id}`, polygon: pts.slice(0, 32) });
      } else if (tags.leisure === 'park' && pts.length >= 3) {
        parks.push({ id: `p_${el.id}`, polygon: pts.slice(0, 32) });
      }
    }

    const payload = {
      source: buildings.length > 0 || roads.length > 0 ? 'osm' : 'fallback',
      buildings: buildings.slice(0, 520),
      roads: roads.slice(0, 260),
      parks: parks.slice(0, 45),
      waters: waters.slice(0, 24),
    };

    realCityCache.set(cacheKey, { ts: Date.now(), data: payload });
    if (realCityCache.size > 60) {
      const oldestKey = realCityCache.keys().next().value;
      if (oldestKey) realCityCache.delete(oldestKey);
    }

    res.json(payload);
  } catch {
    res.json({ source: 'fallback', buildings: [], roads: [], parks: [], waters: [] });
  }
});

// API Endpoint for Gemini Solar Advisor with Google Search Grounding
app.post('/api/solar-advisor', async (req, res) => {
  try {
    const { userQuery, params, results } = req.body;

    if (!userQuery || typeof userQuery !== 'string') {
      res.status(400).json({ error: 'Parâmetro userQuery é obrigatório' });
      return;
    }

    const ai = getGenAI();
    if (!ai) {
      res.status(200).json({
        text: `ℹ️ A chave do Gemini (GEMINI_API_KEY) está sendo configurada no painel de Segredos do AI Studio.

[Análise Local da Mecânica Solar (Modo Servidor)]:
- Localização: Lat ${params?.latitude}°, Lon ${params?.longitude}°
- Fuso Civil: UTC${params?.civilTimezoneOffset >= 0 ? '+' : ''}${params?.civilTimezoneOffset}
- Elevação Solar (Altitude): ${results?.solarAltitudeDeg}° (Zênite: ${results?.solarZenithDeg}°)
- Azimute: ${results?.solarAzimuthDeg}°
- Equação do Tempo (EoT): ${results?.equationOfTimeMinutes?.toFixed(2)} minutos
- Hora Solar Verdadeira (LST): ${results?.lstLocalFormatted}
- Meio-Dia Solar Local: ${results?.solarNoonLocalFormatted}
- Fase da Iluminação: ${results?.twilightPhase}`
      });
      return;
    }

    const contextPrompt = `
Você é Helios AI, um especialista sênior em astronomia solar, mecânica orbital, Google Maps Platform e fusos horários NOAA históricos.
Analise os seguintes parâmetros solares calculados em tempo real pelo motor da simulação:

[DADOS DA SIMULAÇÃO SOLAR]
- Data/Hora UTC: ${params?.referenceDate}
- Hora Civil Local: ${results?.localCivilTimeFormatted} (Fuso: UTC${params?.civilTimezoneOffset >= 0 ? '+' : ''}${params?.civilTimezoneOffset})
- Coordenadas: Lat ${params?.latitude}°, Lon ${params?.longitude}°
- Inclinação Axial: ${params?.axialTilt}°
- Equação do Tempo (EoT): ${results?.equationOfTimeMinutes?.toFixed(4)} minutos
- Tempo Solar Verdadeiro UTC (TST UTC): ${results?.tstUtcFormatted} (${results?.tstUtcMinutes?.toFixed(2)} min)
- Tempo Solar Local (LST Local): ${results?.lstLocalFormatted} (${results?.lstLocalMinutes?.toFixed(2)} min)
- Meio-Dia Solar Local: ${results?.solarNoonLocalFormatted}
- Nascer / Pôr do Sol Local: ${results?.sunriseLocalFormatted} / ${results?.sunsetLocalFormatted} (Duração: ${results?.daylightDurationHours}h)
- Posicionamento 3D: Altitude = ${results?.solarAltitudeDeg}°, Zênite = ${results?.solarZenithDeg}°, Azimute = ${results?.solarAzimuthDeg}°
- Ponto Subsolar: Lat ${results?.subsolarLatitude}°, Lon ${results?.subsolarLongitude}°
- Fase da Atmosfera / Crepúsculo: ${results?.twilightPhase} (Intensidade Solar: ${results?.sunIntensity?.toFixed(2)})
- Vetor de Luz Direcionada 3D: (${results?.lightVector3D?.x?.toFixed(4)}, ${results?.lightVector3D?.y?.toFixed(4)}, ${results?.lightVector3D?.z?.toFixed(4)})

[PERGUNTA DO USUÁRIO]:
"${userQuery}"

Responda em Português com precisão científica e insights sobre o momento solar, a física das sombras e iluminação, o fuso horário ou informações em tempo real buscadas na web. Responda em markdown elegante.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contextPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const groundingChunks = (response.candidates?.[0]?.groundingMetadata as any)?.groundingChunks || [];
    const sources = groundingChunks
      .filter((chunk: any) => chunk.web?.uri)
      .map((chunk: any) => ({
        title: chunk.web?.title || 'Web Reference',
        url: chunk.web?.uri,
      }));

    res.json({
      text: response.text || 'Nenhuma resposta gerada pelo modelo.',
      sources,
    });
  } catch (err: any) {
    console.error('Express Gemini API Error:', err);
    res.status(500).json({ error: err.message || 'Erro ao processar chamada do Gemini no servidor.' });
  }
});

// Configure Vite Middlewares in Development Mode
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  app.use(vite.middlewares);
  app.use('*', async (req, res, next) => {
    const url = req.originalUrl;
    try {
      let template = await import('fs').then(fs => fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8'));
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
} else {
  // Production Static Files Serving
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
