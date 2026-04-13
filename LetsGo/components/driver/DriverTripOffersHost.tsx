import type { Href } from "expo-router";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { TripRequestModal } from "@/components/driver/TripRequestModal";
import { useAuth } from "@/hooks/useAuth";
import { assignDriver } from "@/lib/driverEdge";
import type { TripOfferPayload } from "@/lib/driverTypes";
import { removeSupabaseChannelsForTopic } from "@/lib/realtimeChannelTeardown";
import { supabase } from "@/lib/supabase";

const HYDRATE_POLL_MS = 4000;
const MAX_DEAD_OFFER_IDS = 48;

/**
 * Listens for trip offers on any driver tab. Previously the channel lived only on Home; with lazy
 * tabs or missed broadcasts during reconnect, drivers could miss requests. This host mounts with
 * the tab layout and hydrates an active searching trip after Realtime subscribes.
 */
export function DriverTripOffersHost() {
  const router = useRouter();
  const { user } = useAuth();
  const [offer, setOffer] = useState<TripOfferPayload | null>(null);
  const [offerVisible, setOfferVisible] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  /** Trip id currently shown in the modal (sync; React state lags). */
  const activeOfferTripIdRef = useRef<string | null>(null);
  /** After decline, DB can briefly still return this offer; skip hydrate until then. */
  const suppressHydrateUntilRef = useRef(0);
  /** Rider cancelled while searching — Realtime may still deliver a late `offer` replay; never show again. */
  const deadOfferTripIdsRef = useRef<Set<string>>(new Set());
  const offerVerifyInFlightRef = useRef(new Set<string>());

  const rememberDeadOffer = useCallback((tripId: string) => {
    const s = deadOfferTripIdsRef.current;
    s.add(tripId);
    while (s.size > MAX_DEAD_OFFER_IDS) {
      const first = s.values().next().value as string | undefined;
      if (first == null) break;
      s.delete(first);
    }
  }, []);

  const buildOfferFromTripRow = useCallback(async (row: Record<string, unknown>): Promise<TripOfferPayload | null> => {
    const tripId = row.id as string;
    const riderId = row.rider_id as string;
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, is_verified")
      .eq("id", riderId)
      .maybeSingle();
    const { data: rid } = await supabase.from("riders").select("rating").eq("id", riderId).maybeSingle();
    const gross = row.estimated_fare != null ? Number(row.estimated_fare) : 0;
    const fee = row.platform_fee != null ? Number(row.platform_fee) : 0;
    return {
      trip_id: tripId,
      ride_type: String(row.ride_type),
      pickup_address: String(row.pickup_address),
      dropoff_address: String(row.dropoff_address),
      pickup_lat: Number(row.pickup_lat),
      pickup_lng: Number(row.pickup_lng),
      dropoff_lat: Number(row.dropoff_lat),
      dropoff_lng: Number(row.dropoff_lng),
      estimated_fare: row.estimated_fare != null ? Number(row.estimated_fare) : null,
      estimated_distance_km: row.estimated_distance_km != null ? Number(row.estimated_distance_km) : null,
      estimated_duration_min: row.estimated_duration_min != null ? Number(row.estimated_duration_min) : null,
      platform_fee: row.platform_fee != null ? Number(row.platform_fee) : null,
      estimated_net_earnings: Math.max(0, gross - fee),
      rider_name: prof?.full_name ?? "Rider",
      rider_rating: rid?.rating != null ? Number(rid.rating) : 5,
      rider_verified: Boolean(prof?.is_verified),
      offer_expires_at: String(row.offer_expires_at ?? new Date(Date.now() + 15_000).toISOString()),
    };
  }, []);

  /**
   * Realtime `offer` broadcasts can arrive late (after cancel/accept). Always confirm the row is
   * still `searching` and still offered to this driver before opening the modal.
   */
  const applyOfferIfValid = useCallback(
    async (p: TripOfferPayload) => {
      const uid = user?.id;
      if (!p?.trip_id || !uid) return;
      if (deadOfferTripIdsRef.current.has(p.trip_id)) return;
      if (p.trip_id === activeOfferTripIdRef.current) return;
      if (offerVerifyInFlightRef.current.has(p.trip_id)) return;
      offerVerifyInFlightRef.current.add(p.trip_id);
      try {
        const { data: row, error } = await supabase
          .from("trips")
          .select("id,status,offer_driver_id")
          .eq("id", p.trip_id)
          .maybeSingle();
        if (error || !row) return;
        if (row.status !== "searching" || row.offer_driver_id !== uid) return;

        const shownId = activeOfferTripIdRef.current;
        if (shownId !== null && shownId !== p.trip_id) return;
        if (p.trip_id === activeOfferTripIdRef.current) return;

        activeOfferTripIdRef.current = p.trip_id;
        setOffer(p);
        setOfferVisible(true);
      } finally {
        offerVerifyInFlightRef.current.delete(p.trip_id);
      }
    },
    [user?.id]
  );

  const clearOffer = useCallback(() => {
    activeOfferTripIdRef.current = null;
    setOffer(null);
    setOfferVisible(false);
  }, []);

  useEffect(() => {
    if (!offer) {
      activeOfferTripIdRef.current = null;
      setOfferVisible(false);
    }
  }, [offer]);

  const hydrateFromDatabase = useCallback(
    async (uid: string) => {
      if (Date.now() < suppressHydrateUntilRef.current) return;
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("offer_driver_id", uid)
        .eq("status", "searching")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return;
      const rowId = data.id as string;
      if (rowId === activeOfferTripIdRef.current) return;
      const built = await buildOfferFromTripRow(data as Record<string, unknown>);
      if (built) void applyOfferIfValid(built);
    },
    [buildOfferFromTripRow, applyOfferIfValid]
  );

  useEffect(() => {
    if (!user?.id) return undefined;

    const uid = user.id;
    const topic = `driver_trip_offers:${uid}`;
    let cancelled = false;

    async function setup() {
      await removeSupabaseChannelsForTopic(supabase, topic);
      if (cancelled) return;

      supabase
        .channel(topic)
        .on("broadcast", { event: "offer" }, ({ payload }) => {
          const offerPayload = payload as TripOfferPayload;
          if (offerPayload?.trip_id) void applyOfferIfValid(offerPayload);
        })
        .on("broadcast", { event: "offer_cancelled" }, ({ payload }) => {
          const tid = (payload as { trip_id?: string })?.trip_id;
          if (tid) rememberDeadOffer(tid);
          if (!tid) return;
          setOffer((cur) => {
            if (cur?.trip_id !== tid) return cur;
            activeOfferTripIdRef.current = null;
            return null;
          });
        })
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "trips",
            filter: `offer_driver_id=eq.${uid}`,
          },
          (payload) => {
            void (async () => {
              const row = payload.new as Record<string, unknown>;
              if (row.status !== "searching") return;
              const built = await buildOfferFromTripRow(row);
              if (built) void applyOfferIfValid(built);
            })();
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED" && !cancelled) {
            void hydrateFromDatabase(uid);
          }
        });
    }

    void setup();

    return () => {
      cancelled = true;
      void removeSupabaseChannelsForTopic(supabase, topic);
    };
  }, [user?.id, applyOfferIfValid, buildOfferFromTripRow, hydrateFromDatabase, rememberDeadOffer]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const uid = user.id;
    const id = setInterval(() => void hydrateFromDatabase(uid), HYDRATE_POLL_MS);
    return () => clearInterval(id);
  }, [user?.id, hydrateFromDatabase]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) void hydrateFromDatabase(user.id);
    }, [user?.id, hydrateFromDatabase])
  );

  const offerRef = useRef<TripOfferPayload | null>(null);
  offerRef.current = offer;

  const onAcceptOffer = useCallback(async () => {
    const o = offerRef.current;
    if (!o) return;
    setAssignLoading(true);
    try {
      const res = await assignDriver({ trip_id: o.trip_id, action: "accept" });
      if (!res.ok) throw new Error(res.error ?? "Accept failed");
      clearOffer();
      router.push(`/(driver)/pickup-navigation?tripId=${o.trip_id}` as Href);
    } catch (e) {
      Alert.alert("Accept failed", e instanceof Error ? e.message : "Try again.");
    } finally {
      setAssignLoading(false);
    }
  }, [router, clearOffer]);

  const onDeclineOffer = useCallback(async () => {
    const o = offerRef.current;
    if (!o) {
      clearOffer();
      return;
    }
    const tripId = o.trip_id;
    setAssignLoading(true);
    try {
      await assignDriver({ trip_id: tripId, action: "reject" });
    } catch {
      /* still close */
    } finally {
      setAssignLoading(false);
      suppressHydrateUntilRef.current = Date.now() + 2500;
      clearOffer();
    }
  }, [clearOffer]);

  return (
    <TripRequestModal
      visible={offerVisible}
      offer={offer}
      loading={assignLoading}
      onAccept={onAcceptOffer}
      onDecline={onDeclineOffer}
    />
  );
}
