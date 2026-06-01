import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { dispatchSearchingTripToDrivers } from "../_shared/dispatch_searching_trip.ts";
import { pushToUser } from "../_shared/push_to_user.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

/**
 * Called by Supabase cron (or manual) every minute. Secured with `DISPATCH_SCHEDULED_CRON_SECRET`
 * header `x-cron-secret` matching env (no user JWT).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const secret = Deno.env.get("DISPATCH_SCHEDULED_CRON_SECRET") ?? "";
    const hdr = req.headers.get("x-cron-secret") ?? "";
    if (!secret || hdr !== secret) {
      return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const windowEnd = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { data: trips, error: qErr } = await admin
      .from("trips")
      .select(
        "id, rider_id, ride_type, pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, estimated_distance_km, estimated_duration_min, estimated_fare, platform_fee, scheduled_for"
      )
      .eq("status", "searching")
      .is("offer_driver_id", null)
      .not("scheduled_for", "is", null)
      .lte("scheduled_for", windowEnd);

    if (qErr) throw qErr;

    const rows = trips ?? [];
    let dispatched = 0;
    for (const t of rows) {
      const tripId = t.id as string;
      const { data: prof } = await admin.from("profiles").select("full_name").eq("id", t.rider_id).maybeSingle();
      const res = await dispatchSearchingTripToDrivers({
        supabaseUrl,
        serviceKey,
        admin,
        tripId,
        riderId: String(t.rider_id),
        pickupLat: Number(t.pickup_lat),
        pickupLng: Number(t.pickup_lng),
        dropoffLat: Number(t.dropoff_lat),
        dropoffLng: Number(t.dropoff_lng),
        rideType: String(t.ride_type),
        pickupAddress: String(t.pickup_address),
        dropoffAddress: String(t.dropoff_address),
        estKm: t.estimated_distance_km != null ? Number(t.estimated_distance_km) : null,
        estMin: t.estimated_duration_min != null ? Number(t.estimated_duration_min) : null,
        estFare: t.estimated_fare != null ? Number(t.estimated_fare) : null,
        platformFee: t.platform_fee != null ? Number(t.platform_fee) : null,
        riderName: prof?.full_name ?? "Rider",
      });
      if (res.candidateIds.length > 0) dispatched += 1;
      if (res.candidateIds.length === 0 && res.rpcSucceeded) {
        await pushToUser(admin, {
          userId: String(t.rider_id),
          title: "No drivers nearby",
          body: "Sorry, no drivers available for your scheduled ride. Try booking again.",
          type: "trip",
          data: { trip_id: tripId },
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, scanned: rows.length, dispatched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
