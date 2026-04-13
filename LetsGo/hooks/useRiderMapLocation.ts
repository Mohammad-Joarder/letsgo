import { useCallback, useEffect, useRef, useState } from "react";
import type MapView from "react-native-maps";
import type { Region } from "react-native-maps";

import {
  getRiderCurrentPosition,
  latLngToRegion,
  subscribeRiderLocation,
} from "@/lib/location";

/** Safe default until GPS; avoids MapView with undefined/invalid initialRegion (e.g. Europe/world glitch). */
const FALLBACK_REGION = latLngToRegion(-33.8688, 151.2093, {
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
});

export type UseRiderMapLocationOptions = {
  /** When true, marker follows GPS on an interval. Default true. */
  watch?: boolean;
  timeIntervalMs?: number;
  distanceIntervalM?: number;
};

/**
 * Rider: permission, map camera, optional watch for marker drift.
 * Map always has a valid `region`; first GPS fix recenters away from the fallback.
 */
export function useRiderMapLocation(options: UseRiderMapLocationOptions = {}) {
  const { watch = true, timeIntervalMs = 4000, distanceIntervalM = 10 } = options;
  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [region, setRegion] = useState<Region>(FALLBACK_REGION);
  const [error, setError] = useState<string | null>(null);
  const hasCenteredFromGpsRef = useRef(false);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const first = await getRiderCurrentPosition();
      if (cancelled) return;
      if (first) {
        setCoord({ lat: first.lat, lng: first.lng });
        setError(null);
        if (!hasCenteredFromGpsRef.current) {
          hasCenteredFromGpsRef.current = true;
          setRegion(latLngToRegion(first.lat, first.lng));
        }
      } else if (!watch) {
        setError("Location permission is needed to show the map.");
      }
    })();

    if (watch) {
      stop = subscribeRiderLocation(
        {
          onLocation: (lat, lng) => {
            if (cancelled) return;
            setCoord({ lat, lng });
            setError(null);
            if (!hasCenteredFromGpsRef.current) {
              hasCenteredFromGpsRef.current = true;
              setRegion(latLngToRegion(lat, lng));
            }
          },
          onError: (msg) => {
            if (!cancelled) setError(msg);
          },
        },
        { timeIntervalMs, distanceIntervalM }
      );
    }

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [watch, timeIntervalMs, distanceIntervalM]);

  const recenterMapToUser = useCallback(
    (mapRef: React.RefObject<MapView | null>) => {
      if (!coord || !mapRef.current) return;
      const dLat = region.latitudeDelta;
      const dLng = region.longitudeDelta;
      mapRef.current.animateToRegion(
        latLngToRegion(coord.lat, coord.lng, {
          latitudeDelta: dLat,
          longitudeDelta: dLng,
        }),
        450
      );
    },
    [coord, region.latitudeDelta, region.longitudeDelta]
  );

  return {
    userCoord: coord,
    region,
    setRegion,
    locationError: error,
    recenterMapToUser,
  };
}
