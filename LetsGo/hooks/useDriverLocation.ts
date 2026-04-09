import { useCallback, useEffect, useRef, useState } from "react";
import { bearingDegrees, easeOutCubic, interpolateLatLng } from "@/lib/geo";
import { removeSupabaseChannelsForTopic } from "@/lib/realtimeChannelTeardown";
import { supabase } from "@/lib/supabase";

const INTERP_MS = 900;

export type DriverLocationSnapshot = {
  lat: number;
  lng: number;
  bearingDeg: number;
  recordedAt: string | null;
};

/**
 * Subscribes to `driver_location:[driver_id]` broadcast (`pos` event) and exposes
 * smoothly interpolated coordinates + bearing for map markers.
 */
export function useDriverLocation(driverId: string | null | undefined, enabled = true) {
  const [display, setDisplay] = useState<DriverLocationSnapshot | null>(null);
  const targetRef = useRef<{ lat: number; lng: number; at: string | null } | null>(null);
  const originRef = useRef<{ lat: number; lng: number } | null>(null);
  const animStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopAnim = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    animStartRef.current = null;
  }, []);

  const tick = useCallback(() => {
    const target = targetRef.current;
    const origin = originRef.current;
    const start = animStartRef.current;
    if (!target || !origin || start == null) return;

    const elapsed = Date.now() - start;
    const t = easeOutCubic(elapsed / INTERP_MS);
    const { lat, lng } = interpolateLatLng(origin.lat, origin.lng, target.lat, target.lng, t);
    const bearingDeg = bearingDegrees(origin.lat, origin.lng, target.lat, target.lng);

    setDisplay({
      lat,
      lng,
      bearingDeg,
      recordedAt: target.at,
    });

    if (t < 1) {
      rafRef.current = requestAnimationFrame(() => tick());
    } else {
      originRef.current = { lat: target.lat, lng: target.lng };
      animStartRef.current = null;
      rafRef.current = null;
    }
  }, []);

  const pushTarget = useCallback(
    (lat: number, lng: number, recordedAt: string | null) => {
      targetRef.current = { lat, lng, at: recordedAt };

      if (!originRef.current) {
        originRef.current = { lat, lng };
        setDisplay({
          lat,
          lng,
          bearingDeg: 0,
          recordedAt,
        });
        return;
      }

      stopAnim();
      animStartRef.current = Date.now();
      rafRef.current = requestAnimationFrame(() => tick());
    },
    [stopAnim, tick]
  );

  useEffect(() => {
    if (!driverId || !enabled) {
      stopAnim();
      targetRef.current = null;
      originRef.current = null;
      setDisplay(null);
      return;
    }

    const topic = `driver_location:${driverId}`;
    let cancelled = false;

    const connect = () => {
      void (async () => {
        await removeSupabaseChannelsForTopic(supabase, topic);
        if (cancelled) return;

        const ch = supabase
          .channel(topic)
          .on("broadcast", { event: "pos" }, ({ payload }) => {
            const p = payload as { lat?: number; lng?: number; recorded_at?: string };
            if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
            pushTarget(p.lat!, p.lng!, p.recorded_at ?? null);
          })
          .subscribe((state, err) => {
            if (cancelled) return;
            if (state === "SUBSCRIBED") reconnectAttemptRef.current = 0;
            if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
              console.warn("[useDriverLocation]", state, err?.message);
              if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
              const delay = Math.min(
                30_000,
                1000 * 2 ** Math.min(reconnectAttemptRef.current, 5)
              );
              reconnectAttemptRef.current += 1;
              reconnectTimerRef.current = setTimeout(() => connect(), delay);
            }
          });

        if (cancelled) await supabase.removeChannel(ch);
      })();
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
      void removeSupabaseChannelsForTopic(supabase, topic);
      stopAnim();
    };
  }, [driverId, enabled, pushTarget, stopAnim]);

  return { location: display };
}
