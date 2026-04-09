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

    const body = await req.json().catch(() => null) as {
      trip_id?: string;
      amount_cents?: number;
      rider_id?: string;
      payment_method_id?: string;
    } | null;

    if (!body || typeof body.amount_cents !== "number" || !Number.isFinite(body.amount_cents)) {
      return new Response(JSON.stringify({ ok: false, error: "amount_cents required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.amount_cents < 50) {
      return new Response(JSON.stringify({ ok: false, error: "amount_cents too small" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const riderId = body.rider_id ?? user.id;
    if (riderId !== user.id) {
      return new Response(JSON.stringify({ ok: false, error: "rider_id mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("id, role, stripe_customer_id, email, full_name")
      .eq("id", user.id)
      .single();

    if (pErr || !profile || profile.role !== "rider") {
      return new Response(JSON.stringify({ ok: false, error: "Rider profile required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.trip_id) {
      const { data: trip, error: tErr } = await admin
        .from("trips")
        .select("id, rider_id, estimated_fare")
        .eq("id", body.trip_id)
        .maybeSingle();
      if (tErr || !trip || trip.rider_id !== user.id) {
        return new Response(JSON.stringify({ ok: false, error: "Trip not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const expected = audToCents(Number(trip.estimated_fare ?? 0));
      if (Math.abs(expected - body.amount_cents) > 2) {
        return new Response(JSON.stringify({ ok: false, error: "Amount does not match trip estimate" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const stripe = getStripe();

    let customerId = profile.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email ?? undefined,
        name: profile.full_name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const metadata: Record<string, string> = {
      rider_id: user.id,
    };
    if (body.trip_id) metadata.trip_id = body.trip_id;

    const pi = await stripe.paymentIntents.create({
      amount: body.amount_cents,
      currency: "aud",
      customer: customerId,
      capture_method: "manual",
      automatic_payment_methods: { enabled: true },
      setup_future_usage: "off_session",
      metadata,
      ...(body.payment_method_id ? { payment_method: body.payment_method_id } : {}),
    });

    if (body.trip_id) {
      await admin.from("trips").update({ stripe_payment_intent_id: pi.id }).eq("id", body.trip_id);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        client_secret: pi.client_secret,
        payment_intent_id: pi.id,
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
