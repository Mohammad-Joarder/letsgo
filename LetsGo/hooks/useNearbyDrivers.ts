import { useCallback, useEffect, useState } from "react";
import type { NearbyDriver, RideType } from "@/lib/bookingTypes";
import { searchNearbyDrivers } from "@/lib/riderEdge";

const DEFAULT_INTERVAL_MS = 10_000;

type Args = {
  pickupLat: number | null | undefined;
  pickupLng: number | null | undefined;
  rideType: RideType;
  radiusKm?: number;
  /** When false, polling is paused. */
  enabled?: boolean;
  intervalMs?: number;
};

/**
 * Polls `search-nearby-drivers` on an interval (default 10s) for the rider home map.
 */
export function useNearbyDrivers({
  pickupLat,
  pickupLng,
  rideType,
  radiusKm = 5,
  enabled = true,
  intervalMs = DEFAULT_INTERVAL_MS,
}: Args) {
  const [drivers, setDrivers] = useState<NearbyDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || pickupLat == null || pickupLng == null) {
      setDrivers([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await searchNearbyDrivers({
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        ride_type: rideType,
        radius_km: radiusKm,
      });
      if (res.ok && res.drivers) setDrivers(res.drivers);
      else setError(res.error ?? "Could not load nearby drivers.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nearby drivers failed.");
    } finally {
      setLoading(false);
    }
  }, [enabled, pickupLat, pickupLng, rideType, radiusKm]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled || pickupLat == null || pickupLng == null) return undefined;
    const id = setInterval(() => void refresh(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, pickupLat, pickupLng, intervalMs, refresh]);

  return { drivers, loading, error, refresh };
}
