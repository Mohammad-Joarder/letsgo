import type { Region } from "react-native-maps";

export const DEFAULT_MAP_DELTA = { latitudeDelta: 0.04, longitudeDelta: 0.04 };

export function latLngToRegion(lat: number, lng: number, delta = DEFAULT_MAP_DELTA): Region {
  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: delta.latitudeDelta,
    longitudeDelta: delta.longitudeDelta,
  };
}
