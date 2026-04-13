import { useCallback, useEffect, useRef, useState } from "react";
import { formatRealtimeSubscribeErr } from "@/lib/formatRealtimeSubscribeErr";
import { removeSupabaseChannelsForTopic } from "@/lib/realtimeChannelTeardown";
import { supabase } from "@/lib/supabase";

export type TripLifecycleStatus =
  | "searching"
  | "driver_accepted"
  | "driver_arrived"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_driver_found";

const VALID_FROM_SEARCHING: TripLifecycleStatus[] = [
  "driver_accepted",
  "no_driver_found",
  "cancelled",
];
/**
 * Include `in_progress` so a rider who missed `driver_arrived` (no broadcast for client-only DB
 * updates, or postgres_changes unavailable on RN) still accepts the trip-started transition.
 */
const VALID_FROM_ACCEPTED: TripLifecycleStatus[] = ["driver_arrived", "in_progress", "cancelled"];
const VALID_FROM_ARRIVED: TripLifecycleStatus[] = ["in_progress", "cancelled"];
const VALID_FROM_PROGRESS: TripLifecycleStatus[] = ["completed"];

function isValidTransition(from: string | null, to: string): boolean {
  if (from === null || from === to) return true;
  switch (from) {
    case "searching":
      return VALID_FROM_SEARCHING.includes(to as TripLifecycleStatus);
    case "driver_accepted":
      return VALID_FROM_ACCEPTED.includes(to as TripLifecycleStatus);
    case "driver_arrived":
      return VALID_FROM_ARRIVED.includes(to as TripLifecycleStatus);
    case "in_progress":
      return VALID_FROM_PROGRESS.includes(to as TripLifecycleStatus);
    default:
      return true;
  }
}

export type UseTripStatusOptions = {
  /** Fired after initial load when `status` changes (not on first hydrate). */
  onStatusChange?: (next: string, prev: string) => void;
  enabled?: boolean;
};

/**
 * Subscribes to `trip_updates:[trip_id]` (broadcast + postgres fallback) and keeps trip status in sync.
 * Validates Phase 4 transitions; unexpected broadcast order is ignored.
 */
export function useTripStatus(
  tripId: string | undefined,
  { onStatusChange, enabled = true }: UseTripStatusOptions = {}
) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(tripId && enabled));
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const applyStatus = useCallback((next: string) => {
    const prev = statusRef.current;
    if (prev !== null && prev !== next && !isValidTransition(prev, next)) return;
    if (prev === next) return;
    statusRef.current = next;
    setStatus(next);
    if (hydratedRef.current && prev !== null && prev !== next) {
      onStatusChangeRef.current?.(next, prev);
    }
  }, []);

  const fetchOnce = useCallback(async () => {
    if (!tripId || !enabled) return;
    const { data, error: qErr } = await supabase
      .from("trips")
      .select("status")
      .eq("id", tripId)
      .maybeSingle();
    if (qErr) {
      setError(qErr.message);
      setLoading(false);
      return;
    }
    if (data?.status) {
      applyStatus(data.status as string);
      setError(null);
    }
    hydratedRef.current = true;
    setLoading(false);
  }, [tripId, enabled, applyStatus]);

  useEffect(() => {
    if (!tripId || !enabled) {
      setStatus(null);
      statusRef.current = null;
      hydratedRef.current = false;
      setLoading(false);
      return;
    }
    hydratedRef.current = false;
    setLoading(true);
    void fetchOnce();
  }, [tripId, enabled, fetchOnce]);

  useEffect(() => {
    if (!tripId || !enabled) return undefined;

    const topic = `trip_updates:${tripId}`;
    let cancelled = false;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    /** `postgres_changes` sometimes triggers CHANNEL_ERROR on RN; broadcast from Edge still works. */
    let usePostgresChanges = true;

    const connect = () => {
      if (cancelled) return;

      void (async () => {
        await removeSupabaseChannelsForTopic(supabase, topic);
        if (cancelled) return;

        let ch = supabase.channel(topic).on("broadcast", { event: "status" }, ({ payload }) => {
          const p = payload as { status?: string };
          if (p?.status) applyStatus(p.status);
        });

        if (usePostgresChanges) {
          ch = ch.on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "trips",
              filter: `id=eq.${tripId}`,
            },
            (payload) => {
              const next = (payload.new as { status?: string })?.status;
              if (next) applyStatus(next);
            }
          );
        }

        ch.subscribe((state, err) => {
          if (cancelled) return;
          if (state === "SUBSCRIBED") {
            reconnectAttempt = 0;
            return;
          }
          if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
            const detail = formatRealtimeSubscribeErr(err);

            if (state === "CHANNEL_ERROR" && usePostgresChanges) {
              usePostgresChanges = false;
              /* Expected on many RN builds; broadcast path is enough. Avoid console.warn noise. */
              if (__DEV__) {
                console.debug(
                  `[useTripStatus] ${state}: ${detail} · retrying broadcast-only (postgres_changes off)`
                );
              }
              if (reconnectTimer) clearTimeout(reconnectTimer);
              void supabase.removeChannel(ch);
              reconnectTimer = setTimeout(() => {
                void fetchOnce();
                connect();
              }, 300);
              return;
            }

            const delay = Math.min(30_000, 1000 * 2 ** Math.min(reconnectAttempt, 5));
            if (__DEV__) {
              console.debug(
                `[useTripStatus] ${state}: ${detail} · refetch + reconnect in ${delay}ms (attempt ${reconnectAttempt + 1})`
              );
            }
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectAttempt += 1;
            reconnectTimer = setTimeout(() => {
              void fetchOnce();
              connect();
            }, delay);
          }
        });

        if (cancelled) {
          await supabase.removeChannel(ch);
        }
      })();
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      void removeSupabaseChannelsForTopic(supabase, topic);
    };
  }, [tripId, enabled, applyStatus, fetchOnce]);

  /** Client-side trip updates (driver arrived, PIN start) do not always hit Edge `realtimeBroadcast`; postgres_changes is often off on RN after CHANNEL_ERROR — poll DB as a safety net. */
  useEffect(() => {
    if (!tripId || !enabled) return;
    const id = setInterval(() => {
      void fetchOnce();
    }, 5000);
    return () => clearInterval(id);
  }, [tripId, enabled, fetchOnce]);

  return { status, loading, error, refetch: fetchOnce };
}
