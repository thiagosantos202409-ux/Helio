import React, { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { TimezoneCoverage } from '../services/timezoneCoverage';

interface TimezoneCoverageOverlayProps {
  coverage: TimezoneCoverage;
  visible: boolean;
  observerLat: number;
  observerLng: number;
}

export const TimezoneCoverageOverlay: React.FC<TimezoneCoverageOverlayProps> = ({
  coverage,
  visible,
  observerLat,
  observerLng,
}) => {
  const map = useMap();
  const polygonsRef = useRef<any[]>([]);
  const linesRef = useRef<any[]>([]);

  useEffect(() => {
    // Clean up any previously drawn shapes
    polygonsRef.current.forEach((p) => p.setMap(null));
    polygonsRef.current = [];
    linesRef.current.forEach((l) => l.setMap(null));
    linesRef.current = [];

    if (!map || !visible || typeof (window as any).google === 'undefined' || !(window as any).google.maps) {
      return;
    }

    const { maps } = (window as any).google;
    const { centralMeridianLng, westLimitLng, eastLimitLng } = coverage;

    // Helper to build a swath polygon
    const buildSwathPolygon = (w: number, e: number) => {
      const path = [
        { lat: 85, lng: w },
        { lat: 85, lng: e },
        { lat: -85, lng: e },
        { lat: -85, lng: w },
      ];

      return new maps.Polygon({
        paths: path,
        strokeColor: '#38bdf8',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#0284c7',
        fillOpacity: 0.16,
        clickable: false,
        zIndex: 5,
        map,
      });
    };

    // Handle wrap-around the antimeridian (-180 / 180)
    if (westLimitLng < -180) {
      polygonsRef.current.push(buildSwathPolygon(-180, eastLimitLng));
      polygonsRef.current.push(buildSwathPolygon(westLimitLng + 360, 180));
    } else if (eastLimitLng > 180) {
      polygonsRef.current.push(buildSwathPolygon(westLimitLng, 180));
      polygonsRef.current.push(buildSwathPolygon(-180, eastLimitLng - 360));
    } else {
      polygonsRef.current.push(buildSwathPolygon(westLimitLng, eastLimitLng));
    }

    // 2. Central Standard Meridian Line (Gold / Amber)
    const centralLine = new maps.Polyline({
      path: [
        { lat: 85, lng: centralMeridianLng },
        { lat: -85, lng: centralMeridianLng },
      ],
      strokeColor: '#f59e0b',
      strokeOpacity: 0.95,
      strokeWeight: 3.5,
      clickable: false,
      zIndex: 6,
      map,
    });
    linesRef.current.push(centralLine);

    // 3. Observer Longitude Meridian Line (Emerald)
    const observerLine = new maps.Polyline({
      path: [
        { lat: 85, lng: observerLng },
        { lat: -85, lng: observerLng },
      ],
      strokeColor: '#10b981',
      strokeOpacity: 0.85,
      strokeWeight: 2,
      strokeDasharray: '6, 6',
      clickable: false,
      zIndex: 7,
      map,
    });
    linesRef.current.push(observerLine);

    return () => {
      polygonsRef.current.forEach((p) => p.setMap(null));
      polygonsRef.current = [];
      linesRef.current.forEach((l) => l.setMap(null));
      linesRef.current = [];
    };
  }, [map, visible, coverage.centralMeridianLng, coverage.westLimitLng, coverage.eastLimitLng, observerLng]);

  return null;
};
