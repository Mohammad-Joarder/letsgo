import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { realtimeBroadcast } from "../_shared/realtime_broadcast.ts";
import { audToCents, getStripe } from "../_shared/stripe.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function randomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

type NearbyDriverRow = { driver_id: string; distance_m: number };

/**
 * PostgREST `.rpc()` for `RETURNS TABLE` is usually an array; some paths return one row as a plain
 * object. Treating non-arrays as "no drivers" broke dispatch (empty candidate list).
 */
function normalizeNearbyRpcRows(nearby: unknown): NearbyDriverRow[] {
  if (nearby == null) return [];
  if (Array.isArray(nearby)) return nearby as NearbyDriverRow[];
  if (typeof nearby === "object" && "driver_id" in (nearby as object)) {
    return [nearby as NearbyDriverRow];
  }
  return [];
}

const DISPATCH_RADIUS_M = 25_000;
const MAX_CANDIDATES = 25;
/** PostgREST has no timeout; a slow RPC would block the rider app for minutes. */
const NEARBY_RPC_CAP_MS = 12_000;
/** Wait for driver broadcast so the HTTP response does not return before the message is sent (avoids missed offers). */
const OFFER_BROADCAST_WAIT_MS = 12_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("id, role, full_name, is_verified")
      .eq("id", user.id)
      .single();
    if (pErr || !profile || profile.role !== "rider") {
      return new Response(JSON.stringify({ ok: false, error: "Rider profile required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const b = body as Record<string, unknown>;
    const rideType = b.ride_type as string;
    const pickupAddress = String(b.pickup_address ?? "");
    const dropoffAddress = String(b.dropoff_address ?? "");
    const pickupLat = Number(b.pickup_lat);
    const pickupLng = Number(b.pickup_lng);
    const dropoffLat = Number(b.dropoff_lat);
    const dropoffLng = Number(b.dropoff_lng);
    const estKm = b.estimated_distance_km != null ? Number(b.estimated_distance_km) : null;
    const estMin = b.estimated_duration_min != null ? Number(b.estimated_duration_min) : null;
    const estFare = b.estimated_fare != null ? Number(b.estimated_fare) : null;
    const surgeMult = b.surge_multiplier != null ? Number(b.surge_multiplier) : 1;
    const baseFare = b.base_fare != null ? Number(b.base_fare) : null;
    const distanceFare = b.distance_fare != null ? Number(b.distance_fare) : null;
    const timeFare = b.time_fare != null ? Number(b.time_fare) : null;
    const platformFee = b.platform_fee != null ? Number(b.platform_fee) : null;
    const notes = b.notes != null ? String(b.notes) : null;
    const scheduledFor = b.scheduled_for != null ? String(b.scheduled_for) : null;
    const paymentMethod = (b.payment_method as string) || "card";
    const stripePaymentIntentId =
      b.stripe_payment_intent_id != null ? String(b.stripe_payment_intent_id).trim() : "";

    if (!pickupAddress || !dropoffAddress) {
      return new Response(JSON.stringify({ ok: false, error: "Addresses required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["economy", "comfort", "premium", "xl"].includes(rideType)) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid ride_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid pickup_lat / pickup_lng (must be finite numbers)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const riderId = user.id;
    const pickupPin = randomPin();

    const skipStripe = Deno.env.get("STRIPE_SKIP_VALIDATE") === "true";

    if (paymentMethod === "card" && !stripePaymentIntentId && !skipStripe) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "stripe_payment_intent_id required — authorize payment before booking.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let paymentStatus: "pending" | "authorised" = "pending";
    let verifiedPiId: string | null = null;

    if (paymentMethod === "card" && skipStripe && stripePaymentIntentId) {
      verifiedPiId = stripePaymentIntentId;
      paymentStatus = "authorised";
    }

    if (paymentMethod === "card" && stripePaymentIntentId && !skipStripe) {
      const { data: profStripe, error: psErr } = await admin
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", riderId)
        .single();
      if (psErr || !profStripe?.stripe_customer_id) {
        return new Response(JSON.stringify({ ok: false, error: "Stripe customer missing" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const stripe = getStripe();
      const pi = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
      if (typeof pi.customer === "string" && pi.customer !== profStripe.stripe_customer_id) {
        return new Response(JSON.stringify({ ok: false, error: "PaymentIntent customer mismatch" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const metaRider = pi.metadata?.rider_id;
      if (metaRider && metaRider !== riderId) {
        return new Response(JSON.stringify({ ok: false, error: "PaymentIntent rider mismatch" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const expectedCents = audToCents(estFare != null ? Number(estFare) : 0);
      const piAmount = pi.amount;
      if (Math.abs(piAmount - expectedCents) > 2) {
        return new Response(JSON.stringify({ ok: false, error: "PaymentIntent amount does not match fare" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (pi.status !== "requires_capture" && pi.status !== "succeeded") {
        return new Response(
          JSON.stringify({ ok: false, error: `Payment not authorized (status: ${pi.status})` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      paymentStatus = "authorised";
      verifiedPiId = pi.id;
    }

    const { data: trip, error: tErr } = await admin
      .from("trips")
      .insert({
        rider_id: riderId,
        ride_type: rideType,
        status: "searching",
        pickup_address: pickupAddress,
        dropoff_address: dropoffAddress,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        dropoff_lat: dropoffLat,
        dropoff_lng: dropoffLng,
        estimated_distance_km: estKm,
        estimated_duration_min: estMin,
        estimated_fare: estFare,
        surge_multiplier: surgeMult,
        base_fare: baseFare,
        distance_fare: distanceFare,
        time_fare: timeFare,
        platform_fee: platformFee,
        pickup_pin: pickupPin,
        notes,
        scheduled_for: scheduledFor,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        stripe_payment_intent_id: verifiedPiId,
      })
      .select("id, status, pickup_pin")
      .single();

    if (tErr) throw tErr;

    const rpcCall = admin.rpc("nearby_drivers_for_ride", {
      p_lat: pickupLat,
      p_lng: pickupLng,
      p_radius_m: DISPATCH_RADIUS_M,
      p_ride_type: rideType,
    });

    const [riderResult, nearbyPack] = await Promise.all([
      admin.from("riders").select("rating").eq("id", riderId).maybeSingle(),
      Promise.race([
        rpcCall,
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
      console.error("nearby_drivers_for_ride", nErr.message, {
        pickupLat,
        pickupLng,
        rideType,
      });
    }

    const riderRow = riderResult.data;
    const riderRating = riderRow?.rating != null ? Number(riderRow.rating) : 5;

    const rpcSucceeded = !nErr;
    const rows = normalizeNearbyRpcRows(nearby);
    const candidateIds = rows.map((r) => r.driver_id).filter(Boolean).slice(0, MAX_CANDIDATES);

    const expiresAt = new Date(Date.now() + 15_000).toISOString();

    if (candidateIds.length === 0) {
      if (rpcSucceeded) {
        await admin.from("trips").update({ status: "no_driver_found" }).eq("id", trip.id);
      } else {
        await admin.from("trips").update({ status: "cancelled" }).eq("id", trip.id);
        return new Response(
          JSON.stringify({
            ok: false,
            error:
              "Could not search for nearby drivers (network or server issue). Your booking was not started — please try again.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      const firstId = candidateIds[0];
      await admin
        .from("trips")
        .update({
          offer_candidate_ids: candidateIds,
          offer_index: 0,
          offer_driver_id: firstId,
          offer_expires_at: expiresAt,
        })
        .eq("id", trip.id);

      const gross = estFare != null ? Number(estFare) : 0;
      const fee = platformFee != null ? Number(platformFee) : 0;
      const estNet = Math.max(0, gross - fee);

      const offerPayload = {
        trip_id: trip.id,
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
        rider_name: profile.full_name ?? "Rider",
        rider_rating: riderRating,
        rider_verified: Boolean(profile.is_verified),
        offer_expires_at: expiresAt,
      };

      await Promise.race([
        realtimeBroadcast(supabaseUrl, serviceKey, `driver_trip_offers:${firstId}`, "offer", offerPayload),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), OFFER_BROADCAST_WAIT_MS)),
      ]);
    }

    const responseStatus = candidateIds.length === 0 ? "no_driver_found" : trip.status;

    return new Response(
      JSON.stringify({
        ok: true,
        trip_id: trip.id,
        pickup_pin: trip.pickup_pin,
        status: responseStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
