import type { ResolvedPlace } from "@/lib/bookingTypes";
import { getGoogleMapsApiKey } from "@/lib/mapsConfig";

/**
 * Query is likely a numeric postcode (many countries: digits / spaces / hyphen only).
 * Alphanumeric codes (e.g. UK SW1A 1AA) use Places Autocomplete instead.
 */
export function looksLikeNumericPostcodeQuery(q: string): boolean {
  const t = q.trim();
  if (t.length < 3 || t.length > 12) return false;
  return /^[\d\s-]+$/.test(t);
}

function boundsAround(lat: number, lng: number, delta = 0.45): string {
  const swLat = lat - delta;
  const swLng = lng - delta;
  const neLat = lat + delta;
  const neLng = lng + delta;
  return `${swLat},${swLng}|${neLat},${neLng}`;
}

type GeocodeResponse = {
  status: string;
  results?: {
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
    place_id: string;
  }[];
  error_message?: string;
};

/**
 * Forward geocode worldwide (address, city, region, numeric postcode).
 * Optional `country` (ISO 3166-1 alpha-2) restricts to one country.
 * `near` adds viewport bias so results near the user rank higher / match local context.
 */
export async function geocodeQueryToPlaces(
  query: string,
  options?: { near?: { lat: number; lng: number }; country?: string }
): Promise<ResolvedPlace[]> {
  const key = getGoogleMapsApiKey();
  const trimmed = query.trim();
  if (!key || trimmed.length < 2) return [];

  let url =
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trimmed)}&key=${key}`;

  if (options?.country) {
    url += `&components=country:${encodeURIComponent(options.country.toUpperCase())}`;
  }

  if (options?.near) {
    url += `&bounds=${boundsAround(options.near.lat, options.near.lng)}`;
  }

  const res = await fetch(url);
  const data = (await res.json()) as GeocodeResponse;
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(data.error_message || data.status);
  }
  const rows = data.results ?? [];
  return rows.map((r) => ({
    description: r.formatted_address,
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
  }));
}

/**
 * Reverse geocode for a display label (pickup/dropoff "current location").
 */
export async function reverseGeocodeLabel(lat: number, lng: number): Promise<string | null> {
  const key = getGoogleMapsApiKey();
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
  const res = await fetch(url);
  const data = (await res.json()) as GeocodeResponse;
  if (data.status !== "OK" || !data.results?.[0]) return null;
  return data.results[0].formatted_address ?? null;
}
