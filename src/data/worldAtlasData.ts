import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import countries50mRaw from 'world-atlas/countries-50m.json';

export interface CountryBorderFeature {
  id: string;
  name: string;
  polygons: Array<Array<Array<[number, number]>>>;
}

export interface UnwrappedEarthPolygons {
  /** Standard outer/hole polygon sets (with antimeridian wrapping already split/duplicated) */
  regularPolygons: Array<{ outer: Array<[number, number]>; holes: Array<Array<[number, number]>> }>;
  /** Antarctica circumpolar polygon closed cleanly down to South Pole (-90 deg) */
  antarcticaRing: Array<[number, number]> | null;
}

let cachedUnwrappedLand: UnwrappedEarthPolygons | null = null;
let cachedCountryBorders: CountryBorderFeature[] | null = null;

function unwrapLonRing(ring: Array<[number, number]>): {
  pts: Array<[number, number]>;
  minLon: number;
  maxLon: number;
  minLat: number;
  netSpan: number;
} {
  if (ring.length === 0) {
    return { pts: [], minLon: 0, maxLon: 0, minLat: 0, netSpan: 0 };
  }
  const pts: Array<[number, number]> = [[ring[0][0], ring[0][1]]];
  let prevLon = ring[0][0];
  let minLon = prevLon;
  let maxLon = prevLon;
  let minLat = ring[0][1];

  for (let i = 1; i < ring.length; i++) {
    let lon = ring[i][0];
    const lat = ring[i][1];
    while (lon - prevLon > 180) lon -= 360;
    while (lon - prevLon < -180) lon += 360;
    prevLon = lon;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    pts.push([lon, lat]);
  }

  const netSpan = Math.abs(pts[pts.length - 1][0] - pts[0][0]);
  return { pts, minLon, maxLon, minLat, netSpan };
}

/**
 * Extracts 1:50m Natural Earth landmasses and cleans all antimeridian / South Pole edges
 * so equirectangular canvas rendering has zero horizontal streaks or polar holes.
 */
export function getUnwrappedEarthLand(): UnwrappedEarthPolygons {
  if (cachedUnwrappedLand) return cachedUnwrappedLand;

  const topo = countries50mRaw as unknown as Topology<{
    land: GeometryCollection;
    countries: GeometryCollection<{ name?: string }>;
  }>;

  const landFc = feature(topo, topo.objects.land);
  const regularPolygons: Array<{
    outer: Array<[number, number]>;
    holes: Array<Array<[number, number]>>;
  }> = [];
  let antarcticaRing: Array<[number, number]> | null = null;

  const landFeatures =
    landFc.type === 'FeatureCollection'
      ? landFc.features
      : ([landFc] as Array<typeof landFc & { geometry: NonNullable<unknown> }>);

  for (const feat of landFeatures) {
    if (feat.type !== 'Feature' || !feat.geometry) continue;
    const geom = feat.geometry;
    const multiPolys: Array<Array<Array<[number, number]>>> =
      geom.type === 'Polygon'
        ? [geom.coordinates as Array<Array<[number, number]>>]
        : geom.type === 'MultiPolygon'
          ? (geom.coordinates as Array<Array<Array<[number, number]>>>)
          : [];

    for (const poly of multiPolys) {
      if (!poly.length || poly[0].length < 3) continue;
      const outerRaw = poly[0];
      const uOuter = unwrapLonRing(outerRaw);

      // Special circumpolar Antarctica ring (spans full -180 -> +180 around South Pole)
      if (uOuter.minLat < -60 && (uOuter.maxLon - uOuter.minLon > 330 || uOuter.netSpan > 180)) {
        // Order coastline west-to-east [-180 .. +180] excluding pole-closing segment
        const coastPts = outerRaw
          .filter((pt) => pt[1] > -88.5)
          .slice();
        if (coastPts.length > 10) {
          // Ensure coastline proceeds smoothly west -> east (detect wrap jump & rotate array)
          let jumpIdx = -1;
          for (let i = 1; i < coastPts.length; i++) {
            if (Math.abs(coastPts[i][0] - coastPts[i - 1][0]) > 180) {
              jumpIdx = i;
              break;
            }
          }
          const ordered =
            jumpIdx >= 0
              ? [...coastPts.slice(jumpIdx), ...coastPts.slice(0, jumpIdx)]
              : coastPts;
          if (ordered[0][0] > ordered[ordered.length - 1][0]) {
            ordered.reverse();
          }
          // Close down to South Pole edge across bottom of equirectangular canvas
          antarcticaRing = [
            [-180, ordered[0][1]],
            ...ordered,
            [180, ordered[ordered.length - 1][1]],
            [180, -90],
            [-180, -90],
          ];
        }
        continue;
      }

      const holesRaw = poly.slice(1);
      const holeUnwrapped = holesRaw.map((h) => unwrapLonRing(h).pts);

      regularPolygons.push({
        outer: uOuter.pts,
        holes: holeUnwrapped,
      });

      // Duplicate ring shifted across dateline seam if it crosses +180 or -180
      if (uOuter.maxLon > 180) {
        regularPolygons.push({
          outer: uOuter.pts.map(([lo, la]) => [lo - 360, la]),
          holes: holeUnwrapped.map((h) => h.map(([lo, la]) => [lo - 360, la])),
        });
      }
      if (uOuter.minLon < -180) {
        regularPolygons.push({
          outer: uOuter.pts.map(([lo, la]) => [lo + 360, la]),
          holes: holeUnwrapped.map((h) => h.map(([lo, la]) => [lo + 360, la])),
        });
      }
    }
  }

  cachedUnwrappedLand = { regularPolygons, antarcticaRing };
  return cachedUnwrappedLand;
}

/**
 * Extracts 1:50m country borders for crisp geopolitical outlines on 3D Globe & 2D World Atlas.
 */
export function getWorldCountryBorders(): CountryBorderFeature[] {
  if (cachedCountryBorders) return cachedCountryBorders;

  const topo = countries50mRaw as unknown as Topology<{
    land: GeometryCollection;
    countries: GeometryCollection<{ name?: string }>;
  }>;

  const countriesFc = feature(topo, topo.objects.countries);
  const features =
    countriesFc.type === 'FeatureCollection' ? countriesFc.features : [countriesFc];

  cachedCountryBorders = features
    .filter((f): f is Extract<typeof f, { type: 'Feature' }> => f.type === 'Feature' && Boolean(f.geometry))
    .map((f, idx) => {
      const geom = f.geometry;
      const polygons: Array<Array<Array<[number, number]>>> =
        geom.type === 'Polygon'
          ? [geom.coordinates as Array<Array<[number, number]>>]
          : geom.type === 'MultiPolygon'
            ? (geom.coordinates as Array<Array<Array<[number, number]>>>)
            : [];
      return {
        id: String(f.id ?? idx),
        name: String(f.properties?.name || `Territory ${idx}`),
        polygons,
      };
    });

  return cachedCountryBorders;
}

/**
 * Real Natural Earth polygon list formatted as [lon, lat] rings for 2D vector renderers.
 */
export const WORLD_CONTINENT_POLYGONS: Array<Array<[number, number]>> = (() => {
  const { regularPolygons, antarcticaRing } = getUnwrappedEarthLand();
  const list: Array<Array<[number, number]>> = [];
  for (const p of regularPolygons) {
    if (p.outer.length >= 4) {
      list.push(p.outer);
    }
  }
  if (antarcticaRing) {
    list.push(antarcticaRing);
  }
  return list;
})();
