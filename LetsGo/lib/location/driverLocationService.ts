import type { LocationObject } from "expo-location";
import * as Location from "expo-location";

import { updateDriverLocation } from "@/lib/driverEdge";

import { getCurrentPositionReliable } from "./getCurrentPositionReliable";
import { ensureForegroundLocationPermission } from "./permission";
import type { LatLng } from "./types";

export type DriverLocationCallbacks = {
  onLocation: (lat: number, lng: number, loc?: LocationObject) => void;
  onError?: (message: string) => void;
};

export type DriverLocationServiceOptions = {
  /**
   * Throttle for Edge `update-driver-location` (ms). Map still updates on every watch tick.
   * Default 5000.
   */
  serverPushIntervalMs?: number;
  timeIntervalMs?: number;
  distanceIntervalM?: number;
  accuracy?: Location.Accuracy;
  pushToServer?: boolean;
  /** On failed pushes, increase delay up to ~32s (Phase 4). */
  exponentialBackoffOnPushFailure?: boolean;
};

/**
 * While active: watch GPS, update UI on each fix, push to Supabase at most every `serverPushIntervalMs`.
 * Returns `stop` — idempotent.
 */
export function startDriverLocationService(
  callbacks: DriverLocationCallbacks,
  options?: DriverLocationServiceOptions
): { stop: () => void } {
  const {
    serverPushIntervalMs = 5000,
    timeIntervalMs = 3000,
    distanceIntervalM = 10,
    accuracy = Location.Accuracy.Balanced,
    pushToServer = true,
    exponentialBackoffOnPushFailure = false,
  } = options ?? {};

  let subscription: Location.LocationSubscription | null = null;
  let cancelled = false;
  let lastServerPush = 0;
  let pushFailures = 0;
  let nextPushAllowedAt = 0;

  const pushIfDue = async (lat: number, lng: number) => {
    if (!pushToServer) return;
    const now = Date.now();
    if (now < nextPushAllowedAt) return;
    if (now - lastServerPush < serverPushIntervalMs) return;
    lastServerPush = now;
    try {
      const res = await updateDriverLocation(lat, lng);
      if (res?.ok === false) throw new Error("update-driver-location rejected");
      pushFailures = 0;
      nextPushAllowedAt = 0;
    } catch {
      if (exponentialBackoffOnPushFailure) {
        pushFailures = Math.min(pushFailures + 1, 6);
        const delay = Math.min(32_000, 2000 * 2 ** (pushFailures - 1));
        nextPushAllowedAt = Date.now() + delay;
        lastServerPush = Date.now() - serverPushIntervalMs;
      }
    }
  };

  void (async () => {
    const ok = await ensureForegroundLocationPermission();
    if (cancelled) return;
    if (!ok) {
      callbacks.onError?.("Location permission is required to go online.");
      return;
    }
    try {
      const firstCoords = await getCurrentPositionReliable({
        balancedAttempts: 3,
        lowAttempts: 2,
        retryDelayMs: 500,
      });
      if (cancelled) return;
      const fl = firstCoords.lat;
      const fg = firstCoords.lng;
      callbacks.onLocation(fl, fg);
      lastServerPush = Date.now();
      if (pushToServer) await updateDriverLocation(fl, fg).catch(() => {});

      subscription = await Location.watchPositionAsync(
        { accuracy, timeInterval: timeIntervalMs, distanceInterval: distanceIntervalM },
        (loc) => {
          if (cancelled) return;
          const lat = loc.coords.latitude;
          const lng = loc.coords.longitude;
          callbacks.onLocation(lat, lng, loc);
          void pushIfDue(lat, lng);
        }
      );
    } catch (e) {
      callbacks.onError?.(e instanceof Error ? e.message : "Could not start driver location.");
    }
  })();

  return {
    stop: () => {
      cancelled = true;
      subscription?.remove();
      subscription = null;
    },
  };
}

export async function getDriverCurrentPosition(): Promise<LatLng | null> {
  const ok = await ensureForegroundLocationPermission();
  if (!ok) return null;
  try {
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: loc.coords.latitude, lng: loc.coords.longitude };
  } catch {
    return null;
  }
}
