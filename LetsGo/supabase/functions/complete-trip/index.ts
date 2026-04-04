import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function weekStartUtc(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay() || 7;
  if (day !== 1) x.setUTCDate(x.getUTCDate() - (day - 1));
  return x.toISOString().slice(0, 10);
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
    const finalFareOverride = (body as { final_fare?: number }).final_fare;

    if (!tripId) {
      return new Response(JSON.stringify({ ok: false, error: "trip_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: trip, error: tErr } = await admin.from("trips").select("*").eq("id", tripId).single();
    if (tErr || !trip) {
      return new Response(JSON.stringify({ ok: false, error: "Trip not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (trip.driver_id !== user.id) {
      return new Response(JSON.stringify({ ok: false, error: "Not your trip" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (trip.status !== "in_progress") {
      return new Response(JSON.stringify({ ok: false, error: "Trip must be in progress" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    const est = trip.estimated_fare != null ? Number(trip.estimated_fare) : 0;
    const finalFare =
      finalFareOverride != null && Number.isFinite(finalFareOverride) ? Number(finalFareOverride) : est;
    const platformFee = trip.platform_fee != null ? Number(trip.platform_fee) : 0;
    const net = Math.max(0, finalFare - platformFee);
    const ws = weekStartUtc(new Date());

    const { error: uErr } = await admin
      .from("trips")
      .update({
        status: "completed",
        trip_completed_at: now,
        final_fare: finalFare,
      })
      .eq("id", tripId)
      .eq("driver_id", user.id);

    if (uErr) throw uErr;

    await admin.from("drivers").update({ current_status: "online" }).eq("id", user.id);

    const { data: existing } = await admin
      .from("driver_earnings_summary")
      .select("id, total_trips, total_gross, platform_fee_total, net_earnings")
      .eq("driver_id", user.id)
      .eq("week_start", ws)
      .maybeSingle();

    if (existing) {
      await admin
        .from("driver_earnings_summary")
        .update({
          total_trips: Number(existing.total_trips) + 1,
          total_gross: Number(existing.total_gross) + finalFare,
          platform_fee_total: Number(existing.platform_fee_total) + platformFee,
          net_earnings: Number(existing.net_earnings) + net,
        })
        .eq("id", existing.id);
    } else {
      await admin.from("driver_earnings_summary").insert({
        driver_id: user.id,
        week_start: ws,
        total_trips: 1,
        total_gross: finalFare,
        platform_fee_total: platformFee,
        net_earnings: net,
        tips_total: 0,
        payout_status: "pending",
      });
    }

    const { data: dRow } = await admin
      .from("drivers")
      .select("total_trips, total_earnings")
      .eq("id", user.id)
      .single();
    if (dRow) {
      await admin
        .from("drivers")
        .update({
          total_trips: Number(dRow.total_trips) + 1,
          total_earnings: Number(dRow.total_earnings) + net,
        })
        .eq("id", user.id);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        final_fare: finalFare,
        net_earnings: net,
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
