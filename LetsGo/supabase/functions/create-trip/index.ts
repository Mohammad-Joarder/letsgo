import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function randomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

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

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("id, role")
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

    const riderId = user.id;
    const pickupPin = randomPin();

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
        payment_status: "pending",
      })
      .select("id, status, pickup_pin")
      .single();

    if (tErr) throw tErr;

    return new Response(
      JSON.stringify({
        ok: true,
        trip_id: trip.id,
        pickup_pin: trip.pickup_pin,
        status: trip.status,
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
