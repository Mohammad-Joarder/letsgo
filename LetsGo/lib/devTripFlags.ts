import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;

function devProximityOverrideDisabled(): boolean {
  const v = process.env.EXPO_PUBLIC_DEV_END_TRIP_ANYWHERE ?? extra?.EXPO_PUBLIC_DEV_END_TRIP_ANYWHERE;
  const t = v?.trim().toLowerCase();
  return t === "0" || t === "false" || t === "no" || t === "off";
}

/**
 * When true, the driver can tap "End Trip" while `in_progress` without being within 300 m of drop-off.
 *
 * - **Production / release builds:** always `false` (`__DEV__` is false).
 * - **Development (`expo start` / debug):** `true` by default so you can complete trips without driving.
 * - **To enforce real 300 m in dev:** set `EXPO_PUBLIC_DEV_END_TRIP_ANYWHERE=false` in `.env` and restart Metro.
 */
export const DEV_END_TRIP_WITHOUT_DROP_OFF: boolean =
  typeof __DEV__ !== "undefined" && __DEV__ && !devProximityOverrideDisabled();
