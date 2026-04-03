import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;

export function getGoogleMapsApiKey(): string {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
    extra?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
    ""
  );
}
