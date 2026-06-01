import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { audToCents, getStripe } from "../_shared/stripe.ts";

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
    const { data: prof, error: pErr } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (pErr || prof?.role !== "admin") {
      return new Response(JSON.stringify({ ok: false, error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null) as {
      trip_id?: string;
      amount_cents?: number;
      reason?: string;
    } | null;
    if (!body?.trip_id || !body.reason?.trim()) {
      return new Response(JSON.stringify({ ok: false, error: "trip_id and reason required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: trip, error: tErr } = await admin
      .from("trips")
      .select("id, stripe_payment_intent_id, payment_status")
      .eq("id", body.trip_id)
      .maybeSingle();
    if (tErr || !trip?.stripe_payment_intent_id) {
      return new Response(JSON.stringify({ ok: false, error: "Trip or PaymentIntent not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const skipStripe = Deno.env.get("STRIPE_SKIP_VALIDATE") === "true";
    if (skipStripe) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "stripe_skipped" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = getStripe();
    const pi = await stripe.paymentIntents.retrieve(trip.stripe_payment_intent_id as string);
    const maxRefundable = pi.amount_received ?? pi.amount;
    const reqCents =
      body.amount_cents != null && Number.isFinite(body.amount_cents)
        ? Math.floor(Number(body.amount_cents))
        : maxRefundable;
    const refundAmount = Math.min(Math.max(0, reqCents), maxRefundable);
    if (refundAmount <= 0) {
      return new Response(JSON.stringify({ ok: false, error: "Nothing to refund" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const refund = await stripe.refunds.create({
      payment_intent: trip.stripe_payment_intent_id as string,
      amount: refundAmount,
      metadata: { trip_id: body.trip_id, reason: body.reason.slice(0, 500) },
    });

    await admin
      .from("trips")
      .update({ payment_status: "refunded" })
      .eq("id", body.trip_id);

    return new Response(
      JSON.stringify({
        ok: true,
        refund_id: refund.id,
        amount_cents: refundAmount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
