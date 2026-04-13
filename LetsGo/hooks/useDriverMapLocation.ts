import { useCallback, useEffect, useRef, useState } from "react";
import type MapView from "react-native-maps";
import type { Region } from "react-native-maps";

import { getDriverCurrentPosition, latLngToRegion, startDriverLocationService } from "@/lib/location";

const DEFAULT_DELTA = { latitudeDelta: 0.06, longitudeDelta: 0.06 };

export type UseDriverMapLocationParams = {
  /** When true, watch position and push to `update-driver-location` (throttled). */
  active: boolean;
  mapRef: React.RefObject<MapView | null>;
  serverPushIntervalMs?: number;
  exponentialBackoffOnPushFailure?: boolean;
};

/**
 * Driver: seeds the map from GPS (no hard-coded city), then while `active` streams to the map and Edge.
 */
export function useDriverMapLocation({
  active,
  mapRef,
  serverPushIntervalMs = 5000,
  exponentialBackoffOnPushFailure = false,
}: UseDriverMapLocationParams) {
  const [coord, setCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const deltaRef = useRef(DEFAULT_DELTA);
  const hasSeededMapRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p = await getDriverCurrentPosition();
      if (cancelled || !p) return;
      setCoord({ lat: p.lat, lng: p.lng });
      const next = latLngToRegion(p.lat, p.lng, DEFAULT_DELTA);
      deltaRef.current = {
        latitudeDelta: next.latitudeDelta,
        longitudeDelta: next.longitudeDelta,
      };
      setRegion(next);
      if (!hasSeededMapRef.current) {
        hasSeededMapRef.current = true;
        mapRef.current?.animateToRegion(next, 400);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapRef]);

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
        exponentialBackoffOnPushFailure,
      }
    );

    return stop;
  }, [active, mapRef, serverPushIntervalMs, exponentialBackoffOnPushFailure]);

  return {
    coord,
    /** Camera region; null until first GPS read completes. */
    region,
    onRegionChangeComplete,
    syncError,
  };
}
