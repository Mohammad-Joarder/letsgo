import { decodePolyline } from "@/lib/decodePolyline";
import { getGoogleMapsApiKey } from "@/lib/mapsConfig";

export type DirectionsResult = {
  coordinates: { latitude: number; longitude: number }[];
  distanceMeters: number;
  durationSeconds: number;
};

export async function fetchRoutePolyline(
  pickupLat: number,
  pickupLng: number,
  dropLat: number,
  dropLng: number
): Promise<DirectionsResult | null> {
  const key = getGoogleMapsApiKey();
  if (!key) return null;

  const origin = `${pickupLat},${pickupLng}`;
  const dest = `${dropLat},${dropLng}`;
  const url =
    `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(dest)}&mode=driving&key=${key}`;

  const res = await fetch(url);
  const data = (await res.json()) as {
    status: string;
    routes?: {
      overview_polyline?: { points: string };
      legs?: { distance: { value: number }; duration: { value: number } }[];
    }[];
  };

  if (data.status !== "OK" || !data.routes?.[0]) return null;

  const route = data.routes[0];
  const points = route.overview_polyline?.points;
  if (!points) return null;

  const leg = route.legs?.[0];
  return {
    coordinates: decodePolyline(points),
    distanceMeters: leg?.distance.value ?? 0,
    durationSeconds: leg?.duration.value ?? 0,
  };
}
