import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { realtimeBroadcast } from "../_shared/realtime_broadcast.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      .select("id, role")
      .eq("id", user.id)
      .single();
    if (pErr || !profile || profile.role !== "driver") {
      return new Response(JSON.stringify({ ok: false, error: "Driver profile required" }), {
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

    const { trip_id: tripId, action } = body as { trip_id?: string; action?: string };
    if (!tripId || !["accept", "reject"].includes(action ?? "")) {
      return new Response(JSON.stringify({ ok: false, error: "trip_id and action accept|reject required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: trip, error: tErr } = await admin.from("trips").select("*").eq("id", tripId).single();
    if (tErr || !trip) {
      return new Response(JSON.stringify({ ok: false, error: "Trip not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (trip.status !== "searching") {
      return new Response(JSON.stringify({ ok: false, error: "Trip is no longer available" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (trip.offer_driver_id !== user.id) {
      return new Response(JSON.stringify({ ok: false, error: "This offer is not for you" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "accept") {
      const { data: vehicle, error: vErr } = await admin
        .from("vehicles")
        .select("id")
        .eq("driver_id", user.id)
        .eq("ride_type", trip.ride_type)
        .eq("is_active", true)
        .eq("is_approved", true)
        .limit(1)
        .maybeSingle();

      if (vErr || !vehicle) {
        return new Response(
          JSON.stringify({ ok: false, error: "No approved active vehicle for this ride type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const acceptedAt = new Date().toISOString();
      const { error: uTrip } = await admin
        .from("trips")
        .update({
          driver_id: user.id,
          vehicle_id: vehicle.id,
          status: "driver_accepted",
          driver_accepted_at: acceptedAt,
          offer_driver_id: null,
          offer_expires_at: null,
          offer_candidate_ids: [],
          offer_index: 0,
        })
        .eq("id", tripId)
        .eq("status", "searching")
        .eq("offer_driver_id", user.id);

      if (uTrip) throw uTrip;

      const { error: dErr } = await admin
        .from("drivers")
        .update({ current_status: "on_trip" })
        .eq("id", user.id);
      if (dErr) console.error("driver status", dErr);

      await realtimeBroadcast(supabaseUrl, serviceKey, `trip_updates:${tripId}`, "status", {
        trip_id: tripId,
        status: "driver_accepted",
        driver_id: user.id,
      });

      return new Response(JSON.stringify({ ok: true, status: "driver_accepted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // reject → next candidate
    const candidates = (trip.offer_candidate_ids ?? []) as string[];
    const nextIndex = Number(trip.offer_index) + 1;

    if (nextIndex >= candidates.length) {
      await admin
        .from("trips")
        .update({
          status: "no_driver_found",
          offer_driver_id: null,
          offer_expires_at: null,
          offer_candidate_ids: [],
          offer_index: 0,
        })
        .eq("id", tripId);

      await realtimeBroadcast(supabaseUrl, serviceKey, `trip_updates:${tripId}`, "status", {
        trip_id: tripId,
        status: "no_driver_found",
      });

      return new Response(JSON.stringify({ ok: true, status: "no_driver_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nextDriverId = candidates[nextIndex];
    const expiresAt = new Date(Date.now() + 15_000).toISOString();

    await admin
      .from("trips")
      .update({
        offer_index: nextIndex,
        offer_driver_id: nextDriverId,
        offer_expires_at: expiresAt,
      })
      .eq("id", tripId);

    const { data: riderProfile } = await admin
      .from("profiles")
      .select("full_name, is_verified")
      .eq("id", trip.rider_id)
      .maybeSingle();
    const { data: riderRow } = await admin.from("riders").select("rating").eq("id", trip.rider_id).maybeSingle();

    const gross = trip.estimated_fare != null ? Number(trip.estimated_fare) : 0;
    const fee = trip.platform_fee != null ? Number(trip.platform_fee) : 0;

    await realtimeBroadcast(supabaseUrl, serviceKey, `driver_trip_offers:${nextDriverId}`, "offer", {
      trip_id: tripId,
      ride_type: trip.ride_type,
      pickup_address: trip.pickup_address,
      dropoff_address: trip.dropoff_address,
      pickup_lat: Number(trip.pickup_lat),
      pickup_lng: Number(trip.pickup_lng),
      dropoff_lat: Number(trip.dropoff_lat),
      dropoff_lng: Number(trip.dropoff_lng),
      estimated_fare: trip.estimated_fare,
      estimated_distance_km: trip.estimated_distance_km,
      estimated_duration_min: trip.estimated_duration_min,
      platform_fee: trip.platform_fee,
      estimated_net_earnings: Math.max(0, gross - fee),
      rider_name: riderProfile?.full_name ?? "Rider",
      rider_rating: riderRow?.rating != null ? Number(riderRow.rating) : 5,
      rider_verified: Boolean(riderProfile?.is_verified),
      offer_expires_at: expiresAt,
    });

    return new Response(JSON.stringify({ ok: true, status: "offer_next", next_driver_id: nextDriverId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
