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

    const body = await req.json().catch(() => null);
    const tripId = (body as { trip_id?: string })?.trip_id;
    if (!tripId) {
      return new Response(JSON.stringify({ ok: false, error: "trip_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

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

    const { data: trip, error: tErr } = await admin.from("trips").select("*").eq("id", tripId).single();
    if (tErr || !trip) {
      return new Response(JSON.stringify({ ok: false, error: "Trip not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (trip.rider_id !== user.id) {
      return new Response(JSON.stringify({ ok: false, error: "Not your trip" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = trip.status as string;
    const now = new Date().toISOString();

    if (status === "completed" || status === "cancelled" || status === "no_driver_found") {
      return new Response(JSON.stringify({ ok: false, error: "Trip cannot be cancelled" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (status === "in_progress") {
      return new Response(JSON.stringify({ ok: false, error: "Trip already started" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let feeCents = 0;

    if (status === "searching") {
      const { error: uErr } = await admin
        .from("trips")
        .update({
          status: "cancelled",
          cancellation_reason: "rider_cancelled",
          cancelled_at: now,
          cancelled_by: user.id,
          offer_driver_id: null,
          offer_expires_at: null,
          offer_candidate_ids: [],
          offer_index: 0,
        })
        .eq("id", tripId)
        .eq("status", "searching");
      if (uErr) throw uErr;

      await realtimeBroadcast(supabaseUrl, serviceKey, `trip_updates:${tripId}`, "status", {
        trip_id: tripId,
        status: "cancelled",
      });

      return new Response(
        JSON.stringify({ ok: true, fee_aud: 0, free_cancellation: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (status === "driver_accepted" || status === "driver_arrived") {
      const acceptedAtRaw = trip.driver_accepted_at as string | null;
      const acceptedAt = acceptedAtRaw ? new Date(acceptedAtRaw).getTime() : Date.now();
      const minutesSinceAccept = (Date.now() - acceptedAt) / 60_000;

      if (minutesSinceAccept > 2) {
        const { data: fc } = await admin
          .from("fare_config")
          .select("cancellation_fee")
          .eq("ride_type", trip.ride_type)
          .eq("is_active", true)
          .maybeSingle();
        const fee = fc?.cancellation_fee != null ? Number(fc.cancellation_fee) : 0;
        feeCents = Math.round(fee * 100);
      }

      const { error: uErr } = await admin
        .from("trips")
        .update({
          status: "cancelled",
          cancellation_reason: "rider_cancelled",
          cancelled_at: now,
          cancelled_by: user.id,
          final_fare: feeCents > 0 ? feeCents / 100 : null,
        })
        .eq("id", tripId)
        .in("status", ["driver_accepted", "driver_arrived"]);
      if (uErr) throw uErr;

      const driverId = trip.driver_id as string | null;
      if (driverId) {
        await admin.from("drivers").update({ current_status: "online" }).eq("id", driverId);
      }

      await realtimeBroadcast(supabaseUrl, serviceKey, `trip_updates:${tripId}`, "status", {
        trip_id: tripId,
        status: "cancelled",
        cancellation_fee_aud: feeCents / 100,
      });

      return new Response(
        JSON.stringify({
          ok: true,
          fee_aud: feeCents / 100,
          free_cancellation: feeCents === 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ ok: false, error: "Trip cannot be cancelled in this state" }), {
      status: 409,
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
