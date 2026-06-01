import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { evaluatePromotionForTrip, type PromotionRow } from "../_shared/promo_eligibility.ts";

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

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const code = String(body.code ?? "").trim().toUpperCase();
    const riderId = String(body.rider_id ?? "").trim();
    const tripFare = Number(body.trip_fare);
    const rideType = String(body.ride_type ?? "economy");

    if (!code || !riderId || riderId !== user.id) {
      return new Response(JSON.stringify({ ok: false, error_message: "Invalid rider or code." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Number.isFinite(tripFare) || tripFare <= 0) {
      return new Response(JSON.stringify({ ok: false, error_message: "Invalid trip fare." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: promo, error: pErr } = await admin
      .from("promotions")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (pErr || !promo) {
      return new Response(JSON.stringify({ ok: false, error_message: "Code not found." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ev = evaluatePromotionForTrip({
      promo: promo as unknown as PromotionRow,
      tripFare,
      rideType,
    });
    if (!ev.ok) {
      return new Response(JSON.stringify({ ok: false, error_message: ev.error_message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { count, error: cErr } = await admin
      .from("rider_promotions")
      .select("id", { count: "exact", head: true })
      .eq("rider_id", riderId)
      .eq("promotion_id", promo.id);
    if (cErr) throw cErr;
    const used = count ?? 0;
    if (used >= Number(promo.per_user_limit ?? 1)) {
      return new Response(JSON.stringify({ ok: false, error_message: "You have already used this code the maximum number of times." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        valid: true,
        discount_amount: ev.discount_amount,
        final_fare: ev.final_fare,
        promo_id: promo.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error_message: e instanceof Error ? e.message : "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
