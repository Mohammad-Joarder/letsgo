import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { notifyDriverTripOfferPush } from "./notify_trip_offer_push.ts";
import { realtimeBroadcast } from "./realtime_broadcast.ts";

export type NearbyDriverRow = { driver_id: string; distance_m: number };

export function normalizeNearbyRpcRows(nearby: unknown): NearbyDriverRow[] {
  if (nearby == null) return [];
  if (Array.isArray(nearby)) return nearby as NearbyDriverRow[];
  if (typeof nearby === "object" && "driver_id" in (nearby as object)) {
    return [nearby as NearbyDriverRow];
  }
  return [];
}

const DISPATCH_RADIUS_M = 25_000;
const MAX_CANDIDATES = 25;
const NEARBY_RPC_CAP_MS = 22_000;

export type TripDispatchContext = {
  supabaseUrl: string;
  serviceKey: string;
  admin: SupabaseClient;
  tripId: string;
  riderId: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  rideType: string;
  pickupAddress: string;
  dropoffAddress: string;
  estKm: number | null;
  estMin: number | null;
  estFare: number | null;
  platformFee: number | null;
  riderName: string;
};

/**
 * Runs `nearby_drivers_for_ride`, updates `trips` offer columns, broadcasts + push to first driver.
 * Returns candidate list and whether the RPC itself succeeded (vs timeout).
 */
export async function dispatchSearchingTripToDrivers(
  ctx: TripDispatchContext
): Promise<{ candidateIds: string[]; rpcSucceeded: boolean }> {
  const {
    supabaseUrl,
    serviceKey,
    admin,
    tripId,
    riderId,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    rideType,
    pickupAddress,
    dropoffAddress,
    estKm,
    estMin,
    estFare,
    platformFee,
    riderName,
  } = ctx;

  const riderRowPromise = admin.from("riders").select("rating, is_verified_id").eq("id", riderId).maybeSingle();

  const rpcCallRated = riderRowPromise.then(({ data: riderRow }) => {
    const riderRating = riderRow?.rating != null ? Number(riderRow.rating) : 5;
    return admin.rpc("nearby_drivers_for_ride", {
      p_lat: pickupLat,
      p_lng: pickupLng,
      p_radius_m: DISPATCH_RADIUS_M,
      p_ride_type: rideType,
      p_rider_rating: riderRating,
    });
  });

  const [riderResult, nearbyPack] = await Promise.all([
    riderRowPromise,
    Promise.race([
      rpcCallRated,
      new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(
          () =>
            resolve({
              data: null,
              error: { message: "nearby_drivers_for_ride exceeded time limit" },
            }),
          NEARBY_RPC_CAP_MS
        )
      ),
    ]),
  ]);

  const { data: nearby, error: nErr } = nearbyPack;
  if (nErr) {
    console.error("[dispatchSearchingTripToDrivers] nearby_drivers_for_ride", nErr.message, {
      tripId,
      pickupLat,
      pickupLng,
      rideType,
    });
  }

  const riderRow = riderResult.data;
  const riderRating = riderRow?.rating != null ? Number(riderRow.rating) : 5;
  const riderVerifiedId = Boolean(riderRow?.is_verified_id);

  const rpcSucceeded = !nErr;
  const rows = normalizeNearbyRpcRows(nearby);
  const candidateIds = rows.map((r) => r.driver_id).filter(Boolean).slice(0, MAX_CANDIDATES);
  const expiresAt = new Date(Date.now() + 15_000).toISOString();

  if (candidateIds.length === 0) {
    if (rpcSucceeded) {
      await admin.from("trips").update({ status: "no_driver_found" }).eq("id", tripId);
    }
    return { candidateIds, rpcSucceeded };
  }

  const firstId = candidateIds[0];
  await admin
    .from("trips")
    .update({
      offer_candidate_ids: candidateIds,
      offer_index: 0,
      offer_driver_id: firstId,
      offer_expires_at: expiresAt,
    })
    .eq("id", tripId);

  const gross = estFare != null ? Number(estFare) : 0;
  const fee = platformFee != null ? Number(platformFee) : 0;
  const estNet = Math.max(0, gross - fee);

  const offerPayload = {
    trip_id: tripId,
    ride_type: rideType,
    pickup_address: pickupAddress,
    dropoff_address: dropoffAddress,
    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    dropoff_lat: dropoffLat,
    dropoff_lng: dropoffLng,
    estimated_fare: estFare,
    estimated_distance_km: estKm,
    estimated_duration_min: estMin,
    platform_fee: platformFee,
    estimated_net_earnings: estNet,
    rider_name: riderName,
    rider_rating: riderRating,
    rider_verified: riderVerifiedId,
    offer_expires_at: expiresAt,
    scheduled_pickup_at: null as string | null,
  };

  const { data: tripRow } = await admin.from("trips").select("scheduled_for").eq("id", tripId).maybeSingle();
  if (tripRow?.scheduled_for) {
    offerPayload.scheduled_pickup_at = String(tripRow.scheduled_for);
  }

  const topic = `driver_trip_offers:${firstId}`;
  const offerOk = await realtimeBroadcast(supabaseUrl, serviceKey, topic, "offer", offerPayload);
  if (!offerOk) {
    console.error("[dispatchSearchingTripToDrivers] broadcast failed", { tripId, topic });
  }
  await notifyDriverTripOfferPush(supabaseUrl, serviceKey, firstId, String(tripId), pickupAddress);

  return { candidateIds, rpcSucceeded };
}
