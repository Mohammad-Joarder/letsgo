import { useCallback, useEffect, useRef, useState } from "react";
import type MapView from "react-native-maps";
import type { Region } from "react-native-maps";

import {
  getRiderCurrentPosition,
  latLngToRegion,
  subscribeRiderLocation,
} from "@/lib/location";

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
 * Rider: permission, initial center, optional watch for moving "You" marker.
 * Does not continuously pan the map after the first fix (avoids fighting user drag).
 */
export function useRiderMapLocation(options: UseRiderMapLocationOptions = {}) {
  const { watch = true, timeIntervalMs = 4000, distanceIntervalM = 10 } = options;
  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [region, setRegion] = useState<Region>(FALLBACK_REGION);
  const [error, setError] = useState<string | null>(null);
  const hasCenteredMapRef = useRef(false);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;

    if (watch) {
      stop = subscribeRiderLocation(
        {
          onLocation: (lat, lng) => {
            if (cancelled) return;
            setCoord({ lat, lng });
            setError(null);
            if (!hasCenteredMapRef.current) {
              hasCenteredMapRef.current = true;
              setRegion(latLngToRegion(lat, lng));
            }
          },
          onError: (msg) => {
            if (!cancelled) setError(msg);
          },
        },
        { timeIntervalMs, distanceIntervalM }
      );
    } else {
      void (async () => {
        const p = await getRiderCurrentPosition();
        if (cancelled) return;
        if (p) {
          setCoord(p);
          setRegion(latLngToRegion(p.lat, p.lng));
          hasCenteredMapRef.current = true;
        } else {
          setError("Location permission is needed to show the map.");
        }
      })();
    }

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [watch, timeIntervalMs, distanceIntervalM]);

  const recenterMapToUser = useCallback(
    (mapRef: React.RefObject<MapView | null>) => {
      if (!coord || !mapRef.current) return;
      mapRef.current.animateToRegion(
        latLngToRegion(coord.lat, coord.lng, {
          latitudeDelta: region.latitudeDelta,
          longitudeDelta: region.longitudeDelta,
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
