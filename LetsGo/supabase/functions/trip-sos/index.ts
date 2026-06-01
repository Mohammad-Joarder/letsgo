import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendExpoPushMessages } from "../_shared/expo_push.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACTIVE_STATUSES = new Set(["driver_accepted", "driver_arrived", "in_progress", "searching"]);

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
    const tripId = String(body?.trip_id ?? "").trim();
    if (!tripId) {
      return new Response(JSON.stringify({ ok: false, error: "trip_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: trip, error: tErr } = await admin
      .from("trips")
      .select("id, rider_id, driver_id, status, pickup_address, pickup_lat, pickup_lng")
      .eq("id", tripId)
      .maybeSingle();

    if (tErr || !trip) {
      return new Response(JSON.stringify({ ok: false, error: "Trip not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uid = user.id;
    const isRider = trip.rider_id === uid;
    const isDriver = trip.driver_id === uid;
    if (!isRider && !isDriver) {
      return new Response(JSON.stringify({ ok: false, error: "Not a participant on this trip" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const st = String(trip.status ?? "");
    if (!ACTIVE_STATUSES.has(st)) {
      return new Response(JSON.stringify({ ok: false, error: "SOS is only available during an active trip" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    const { error: upErr } = await admin
      .from("trips")
      .update({ sos_triggered: true, sos_at: now })
      .eq("id", tripId);
    if (upErr) throw upErr;

    const locBits = [
      trip.pickup_address ? `Near: ${trip.pickup_address}` : null,
      trip.pickup_lat != null && trip.pickup_lng != null
        ? `Coords: ${trip.pickup_lat},${trip.pickup_lng}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const { error: ticketErr } = await admin.from("support_tickets").insert({
      user_id: uid,
      trip_id: tripId,
      category: "safety_emergency",
      subject: `SOS triggered — trip ${tripId}`,
      description: `Emergency SOS from ${isRider ? "rider" : "driver"}. ${locBits}`,
      status: "open",
    });
    if (ticketErr) console.error("support_tickets", ticketErr);

    const { data: admins } = await admin
      .from("profiles")
      .select("id, expo_push_token")
      .eq("role", "admin");

    const tokens = (admins ?? [])
      .map((a) => (a as { expo_push_token?: string | null }).expo_push_token)
      .filter((t): t is string => typeof t === "string" && t.length > 0);

    const pushTitle = "SOS alert";
    const pushBody = `Trip ${tripId.slice(0, 8)}… — ${isRider ? "Rider" : "Driver"} SOS`;

    await sendExpoPushMessages(
      tokens.map((to) => ({
        to,
        title: pushTitle,
        body: pushBody,
        data: { trip_id: tripId, type: "sos" },
        sound: "default",
        badge: 1,
      }))
    );

    for (const a of admins ?? []) {
      const aid = (a as { id: string }).id;
      const { error: nErr } = await admin.from("notifications").insert({
        user_id: aid,
        title: pushTitle,
        body: pushBody,
        type: "system",
        data: { trip_id: tripId, kind: "sos" },
        is_read: false,
      });
      if (nErr) console.error("notifications", nErr);
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
