import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TAGS_DRIVER = new Set([
  "Great driver",
  "Safe driver",
  "Clean car",
  "On time",
  "Friendly",
  "Quiet ride",
]);
const TAGS_RIDER = new Set([
  "Great passenger",
  "On time",
  "Respectful",
  "Clean",
  "Easy to find",
]);

function clampTags(
  tags: unknown,
  allowed: Set<string>
): string[] | null {
  if (tags == null) return null;
  if (!Array.isArray(tags)) return null;
  const out = tags.map((t) => String(t)).filter((t) => allowed.has(t));
  return out.length ? out : null;
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

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tripId = String(body.trip_id ?? "").trim();
    const toUserId = String(body.to_user_id ?? "").trim();
    const rating = Number(body.rating);
    const comment = body.comment != null ? String(body.comment).trim().slice(0, 2000) : "";
    const tagsRaw = body.tags;

    if (!tripId || !toUserId) {
      return new Response(JSON.stringify({ ok: false, error: "trip_id and to_user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return new Response(JSON.stringify({ ok: false, error: "rating must be 1–5" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (toUserId === user.id) {
      return new Response(JSON.stringify({ ok: false, error: "Cannot rate yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: trip, error: tErr } = await admin
      .from("trips")
      .select("id, rider_id, driver_id, status, trip_completed_at")
      .eq("id", tripId)
      .maybeSingle();

    if (tErr || !trip) {
      return new Response(JSON.stringify({ ok: false, error: "Trip not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (trip.status !== "completed") {
      return new Response(JSON.stringify({ ok: false, error: "Trip is not completed" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const completedAt = trip.trip_completed_at ? new Date(String(trip.trip_completed_at)).getTime() : 0;
    if (!completedAt) {
      return new Response(JSON.stringify({ ok: false, error: "Trip has no completion time" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const deadline = completedAt + 24 * 60 * 60 * 1000;
    if (Date.now() > deadline) {
      return new Response(JSON.stringify({ ok: false, error: "Rating window closed (24h after trip)" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const riderId = trip.rider_id as string;
    const driverId = trip.driver_id as string | null;
    if (!driverId) {
      return new Response(JSON.stringify({ ok: false, error: "Trip has no driver" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let direction: "rider_rates_driver" | "driver_rates_rider" | null = null;
    if (user.id === riderId && toUserId === driverId) direction = "rider_rates_driver";
    else if (user.id === driverId && toUserId === riderId) direction = "driver_rates_rider";
    else {
      return new Response(JSON.stringify({ ok: false, error: "Not a participant on this trip" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tagSet = direction === "rider_rates_driver" ? TAGS_DRIVER : TAGS_RIDER;
    const tags = clampTags(tagsRaw, tagSet);

    const { data: existing } = await admin
      .from("ratings")
      .select("id")
      .eq("trip_id", tripId)
      .eq("from_user_id", user.id)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ ok: false, error: "You already submitted a rating for this trip" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insErr } = await admin.from("ratings").insert({
      trip_id: tripId,
      from_user_id: user.id,
      to_user_id: toUserId,
      rating,
      comment: comment || null,
      tags,
    });
    if (insErr) throw insErr;

    if (direction === "rider_rates_driver") {
      const { error: uTrip } = await admin.from("trips").update({ driver_rating: rating }).eq("id", tripId);
      if (uTrip) console.error("trip driver_rating", uTrip);
    } else {
      const { error: uTrip } = await admin.from("trips").update({ rider_rating: rating }).eq("id", tripId);
      if (uTrip) console.error("trip rider_rating", uTrip);
    }

    const { data: avgD } = await admin.from("ratings").select("rating").eq("to_user_id", toUserId);
    const list = (avgD ?? []).map((r) => Number(r.rating)).filter((n) => Number.isFinite(n));
    const avg = list.length ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 100) / 100 : 5;

    if (direction === "rider_rates_driver") {
      const { error: dErr } = await admin.from("drivers").update({ rating: avg }).eq("id", toUserId);
      if (dErr) console.error("drivers rating", dErr);
    } else {
      const { error: rErr } = await admin.from("riders").update({ rating: avg }).eq("id", toUserId);
      if (rErr) console.error("riders rating", rErr);
    }

    return new Response(JSON.stringify({ ok: true }), {
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
