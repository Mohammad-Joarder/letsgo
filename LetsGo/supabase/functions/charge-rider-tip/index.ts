import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getStripe } from "../_shared/stripe.ts";

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

    const body = await req.json().catch(() => null) as {
      trip_id?: string;
      amount_cents?: number;
      payment_method_id?: string;
    } | null;

    if (!body?.trip_id || typeof body.amount_cents !== "number" || body.amount_cents < 50) {
      return new Response(JSON.stringify({ ok: false, error: "trip_id and amount_cents (>=50) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: trip, error: tErr } = await admin
      .from("trips")
      .select("id, rider_id, driver_id, status")
      .eq("id", body.trip_id)
      .single();
    if (tErr || !trip || trip.rider_id !== user.id) {
      return new Response(JSON.stringify({ ok: false, error: "Trip not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (trip.status !== "completed") {
      return new Response(JSON.stringify({ ok: false, error: "Trip must be completed" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();
    const customerId = profile?.stripe_customer_id as string | null;
    if (!customerId) {
      return new Response(JSON.stringify({ ok: false, error: "No Stripe customer" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = getStripe();

    let pmId = body.payment_method_id;
    if (!pmId) {
      const cust = await stripe.customers.retrieve(customerId, {
        expand: ["invoice_settings.default_payment_method"],
      });
      if (typeof cust === "string" || cust.deleted) {
        return new Response(JSON.stringify({ ok: false, error: "Invalid customer" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const def = cust.invoice_settings?.default_payment_method;
      pmId = typeof def === "string" ? def : def && typeof def === "object" && "id" in def
        ? (def as { id: string }).id
        : undefined;
    }
    if (!pmId) {
      return new Response(JSON.stringify({ ok: false, error: "No default payment method" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pi = await stripe.paymentIntents.create({
      amount: body.amount_cents,
      currency: "aud",
      customer: customerId,
      payment_method: pmId,
      off_session: true,
      confirm: true,
      metadata: {
        trip_id: body.trip_id,
        rider_id: user.id,
        kind: "post_trip_tip",
      },
    });

    if (pi.status === "requires_action" && pi.client_secret) {
      return new Response(
        JSON.stringify({
          ok: false,
          requires_action: true,
          client_secret: pi.client_secret,
          payment_intent_id: pi.id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (pi.status !== "succeeded") {
      return new Response(
        JSON.stringify({ ok: false, error: `Payment status: ${pi.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const driverId = trip.driver_id as string | null;
    if (driverId) {
      const { data: d } = await admin
        .from("drivers")
        .select("stripe_connect_account_id, stripe_connect_onboarded")
        .eq("id", driverId)
        .maybeSingle();
      if (d?.stripe_connect_account_id && d.stripe_connect_onboarded) {
        await stripe.transfers.create({
          amount: body.amount_cents,
          currency: "aud",
          destination: d.stripe_connect_account_id as string,
          metadata: {
            trip_id: body.trip_id,
            kind: "rider_tip",
          },
        });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, payment_intent_id: pi.id }),
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
