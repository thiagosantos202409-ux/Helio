/**
 * Google Maps Platform Service for Helios Solar Engine
 * Handles Google Time Zone API integration and Maps configuration.
 */

export interface GoogleTimeZoneResponse {
  dstOffset: number;
  rawOffset: number;
  status: string;
  timeZoneId: string;
  timeZoneName: string;
  errorMessage?: string;
}

let cachedMapsApiKey: string | null = null;

export async function getGoogleMapsApiKey(): Promise<string> {
  if (cachedMapsApiKey) return cachedMapsApiKey;

  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (envKey && envKey !== 'MY_GOOGLE_MAPS_API_KEY') {
    cachedMapsApiKey = envKey;
    return envKey;
  }

  try {
    const res = await fetch('/api/maps-config');
    if (res.ok) {
      const data = await res.json();
      if (data.apiKey && data.apiKey !== 'MY_GOOGLE_MAPS_API_KEY') {
        cachedMapsApiKey = data.apiKey;
        return data.apiKey;
      }
    }
  } catch (err) {
    console.warn('Could not fetch maps config from server:', err);
  }

  return envKey || '';
}

/**
 * Fetch timezone details for coordinates and reference timestamp using Google Time Zone API
 */
export async function fetchGoogleTimeZone(
  latitude: number,
  longitude: number,
  date: Date
): Promise<GoogleTimeZoneResponse | null> {
  try {
    const timestampSec = Math.floor(date.getTime() / 1000);
    const res = await fetch(
      `/api/timezone?lat=${latitude}&lng=${longitude}&timestamp=${timestampSec}`
    );
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const data: GoogleTimeZoneResponse = await res.json();
    return data;
  } catch (err) {
    console.warn('Google Time Zone API request failed:', err);
    return null;
  }
}

export interface GeocodeLocationResult {
  formattedAddress: string;
  lat: number;
  lng: number;
  placeId?: string;
}

/**
 * Search location coordinates by text/address using Google Maps Geocoding API proxy
 */
export async function searchAddressGeocode(
  address: string
): Promise<GeocodeLocationResult[]> {
  try {
    const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const data = await res.json();
    if (data.status === 'OK' && Array.isArray(data.results)) {
      return data.results.map((r: any) => ({
        formattedAddress: r.formatted_address,
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
        placeId: r.place_id,
      }));
    }
    return [];
  } catch (err) {
    console.warn('Geocoding API request failed:', err);
    return [];
  }
}

