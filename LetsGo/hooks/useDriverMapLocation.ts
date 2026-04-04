import { useCallback, useEffect, useRef, useState } from "react";
import type MapView from "react-native-maps";
import type { Region } from "react-native-maps";

import { latLngToRegion, startDriverLocationService } from "@/lib/location";

const INITIAL_REGION = latLngToRegion(-33.8688, 151.2093, {
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
});

export type UseDriverMapLocationParams = {
  /** When true, watch position and push to `update-driver-location` (throttled). */
  active: boolean;
  mapRef: React.RefObject<MapView | null>;
  serverPushIntervalMs?: number;
};

/**
 * Driver: while `active` (online), streams GPS to map animation + Edge location updates.
 */
export function useDriverMapLocation({
  active,
  mapRef,
  serverPushIntervalMs = 5000,
}: UseDriverMapLocationParams) {
  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [region, setRegion] = useState<Region>(INITIAL_REGION);
  const [syncError, setSyncError] = useState<string | null>(null);
  const deltaRef = useRef({
    latitudeDelta: INITIAL_REGION.latitudeDelta,
    longitudeDelta: INITIAL_REGION.longitudeDelta,
  });

  const onRegionChangeComplete = useCallback((r: Region) => {
    deltaRef.current = { latitudeDelta: r.latitudeDelta, longitudeDelta: r.longitudeDelta };
    setRegion(r);
  }, []);

  useEffect(() => {
    if (!active) {
      setSyncError(null);
      return;
    }

    setSyncError(null);
    const { stop } = startDriverLocationService(
      {
        onLocation: (lat, lng) => {
          setCoord({ lat, lng });
          const d = deltaRef.current;
          const next: Region = {
            latitude: lat,
            longitude: lng,
            latitudeDelta: d.latitudeDelta,
            longitudeDelta: d.longitudeDelta,
          };
          setRegion(next);
          mapRef.current?.animateToRegion(next, 450);
        },
        onError: (msg) => setSyncError(msg),
      },
      {
        serverPushIntervalMs,
        timeIntervalMs: 3000,
        distanceIntervalM: 12,
        pushToServer: true,
      }
    );

    return stop;
  }, [active, mapRef, serverPushIntervalMs]);

  return {
    coord,
    region,
    onRegionChangeComplete,
    syncError,
  };
}
