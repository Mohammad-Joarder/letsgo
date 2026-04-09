/** Haversine distance in metres between two WGS84 points */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistanceKm(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Initial bearing from point A to B in degrees clockwise from north (0–360). */
export function bearingDegrees(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  let θ = toDeg(Math.atan2(y, x));
  θ = (θ + 360) % 360;
  return θ;
}

/** Linear interpolation between two WGS84 points (short segments — fine for driver animation). */
export function interpolateLatLng(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  t: number
): { lat: number; lng: number } {
  const u = Math.max(0, Math.min(1, t));
  return {
    lat: lat1 + (lat2 - lat1) * u,
    lng: lng1 + (lng2 - lng1) * u,
  };
}

/** Ease-out cubic for smoother marker arrival. */
export function easeOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 1 - (1 - x) ** 3;
}
