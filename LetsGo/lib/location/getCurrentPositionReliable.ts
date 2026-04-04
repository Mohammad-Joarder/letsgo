import * as Location from "expo-location";

import type { LatLng } from "./types";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type ReliablePositionOptions = {
  /** Attempts with Balanced accuracy. Default 3. */
  balancedAttempts?: number;
  /** Extra attempts with Low accuracy after balanced fails. Default 2. */
  lowAttempts?: number;
  /** Delay between attempts (ms). Default 600. */
  retryDelayMs?: number;
  /** Accept last-known fix up to this age (ms). Default 120_000. */
  lastKnownMaxAgeMs?: number;
};

const USER_FRIENDLY =
  "Could not get a GPS fix yet. Try moving to an open area, wait a few seconds, or check Location in Settings.";

function coordsFrom(loc: Location.LocationObject): LatLng {
  return { lat: loc.coords.latitude, lng: loc.coords.longitude };
}

/**
 * iOS often throws kCLErrorDomain 0 (location unknown) on the first fix.
 * Uses last-known position when fresh enough, then retries Balanced → Low.
 */
export async function getCurrentPositionReliable(options?: ReliablePositionOptions): Promise<LatLng> {
  const balancedAttempts = options?.balancedAttempts ?? 3;
  const lowAttempts = options?.lowAttempts ?? 2;
  const retryDelayMs = options?.retryDelayMs ?? 600;
  const lastKnownMaxAgeMs = options?.lastKnownMaxAgeMs ?? 120_000;

  const last = await Location.getLastKnownPositionAsync({ maxAge: lastKnownMaxAgeMs }).catch(() => null);
  if (last) {
    return coordsFrom(last);
  }

  let lastErr: unknown;
  for (let i = 0; i < balancedAttempts; i++) {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return coordsFrom(loc);
    } catch (e) {
      lastErr = e;
    }
    if (i < balancedAttempts - 1) await sleep(retryDelayMs);
  }

  for (let i = 0; i < lowAttempts; i++) {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      return coordsFrom(loc);
    } catch (e) {
      lastErr = e;
    }
    if (i < lowAttempts - 1) await sleep(retryDelayMs);
  }

  const msg = lastErr instanceof Error ? lastErr.message : "";
  if (msg.includes("kCLErrorDomain") || msg.toLowerCase().includes("location")) {
    throw new Error(USER_FRIENDLY);
  }
  throw new Error(USER_FRIENDLY);
}

/** Same as {@link getCurrentPositionReliable} but returns null (e.g. interval ticks). */
export async function tryGetCurrentPositionReliable(options?: ReliablePositionOptions): Promise<LatLng | null> {
  try {
    return await getCurrentPositionReliable(options);
  } catch {
    return null;
  }
}
