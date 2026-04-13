import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;

function rawEndTripAnywhere(): string | undefined {
  return process.env.EXPO_PUBLIC_DEV_END_TRIP_ANYWHERE ?? extra?.EXPO_PUBLIC_DEV_END_TRIP_ANYWHERE;
}

function explicitOff(): boolean {
  const t = rawEndTripAnywhere()?.trim().toLowerCase();
  return t === "0" || t === "false" || t === "no" || t === "off";
}

function explicitOn(): boolean {
  const t = rawEndTripAnywhere()?.trim().toLowerCase();
  return t === "true" || t === "1" || t === "yes" || t === "on";
}

/**
 * When true, the driver can tap "End Trip" while `in_progress` without being within 300 m of drop-off.
 *
 * - **`EXPO_PUBLIC_DEV_END_TRIP_ANYWHERE=true`** — on in any build (TestFlight / internal APK testing).
 * - **`EXPO_PUBLIC_DEV_END_TRIP_ANYWHERE=false`** — off even in dev (enforce real 300 m).
 * - **Unset** — on in `__DEV__` only (default for local testing). Off in release builds.
 */
export const DEV_END_TRIP_WITHOUT_DROP_OFF: boolean =
  explicitOn() || (typeof __DEV__ !== "undefined" && __DEV__ && !explicitOff());
