import type { LocationObject } from "expo-location";
import * as Location from "expo-location";

import { getCurrentPositionReliable } from "./getCurrentPositionReliable";
import { ensureForegroundLocationPermission } from "./permission";
import type { LatLng } from "./types";

export type RiderLocationCallbacks = {
  onLocation: (lat: number, lng: number, loc?: LocationObject) => void;
  onError?: (message: string) => void;
};

export type RiderLocationWatchOptions = {
  /** Minimum time between updates (ms). Default 4000. */
  timeIntervalMs?: number;
  /** Minimum movement before update (metres). Default 8. */
  distanceIntervalM?: number;
  accuracy?: Location.Accuracy;
};

/**
 * Single GPS fix (after permission). Returns null if denied or unavailable.
 */
export async function getRiderCurrentPosition(): Promise<LatLng | null> {
  const ok = await ensureForegroundLocationPermission();
  if (!ok) return null;
  try {
    return await getCurrentPositionReliable();
  } catch {
    return null;
  }
}

/**
 * Subscribes to device position updates for map marker + pickup drift when using "Current location".
 * Call the returned function to unsubscribe.
 */
export function subscribeRiderLocation(
  callbacks: RiderLocationCallbacks,
  options?: RiderLocationWatchOptions
): () => void {
  const {
    timeIntervalMs = 4000,
    distanceIntervalM = 8,
    accuracy = Location.Accuracy.Balanced,
  } = options ?? {};

  let subscription: Location.LocationSubscription | null = null;
  let cancelled = false;

  void (async () => {
    const ok = await ensureForegroundLocationPermission();
    if (cancelled) return;
    if (!ok) {
      callbacks.onError?.("Location permission is needed to show the map.");
      return;
    }
    try {
      subscription = await Location.watchPositionAsync(
        {
          accuracy,
          timeInterval: timeIntervalMs,
          distanceInterval: distanceIntervalM,
        },
        (loc) => {
          callbacks.onLocation(loc.coords.latitude, loc.coords.longitude, loc);
        }
      );
    } catch (e) {
      callbacks.onError?.(e instanceof Error ? e.message : "Could not start location updates.");
    }
  })();

  return () => {
    cancelled = true;
    subscription?.remove();
    subscription = null;
  };
}
