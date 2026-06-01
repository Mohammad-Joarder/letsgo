import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { audToCents, getStripe } from "../_shared/stripe.ts";
import {
  pickPayoutSourceType,
  waitForConnectBalance,
} from "../_shared/stripeConnectBalance.ts";

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

    const body = await req.json().catch(() => ({})) as {
      driver_id?: string;
      amount_cents?: number;
    };

    const driverId = body.driver_id ?? user.id;
    if (driverId !== user.id) {
      return new Response(JSON.stringify({ ok: false, error: "driver_id mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (pErr || profile?.role !== "driver") {
      return new Response(JSON.stringify({ ok: false, error: "Driver only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: driver, error: dErr } = await admin
      .from("drivers")
      .select("approval_status, stripe_connect_account_id, stripe_connect_onboarded")
      .eq("id", user.id)
      .single();
    if (dErr || !driver) {
      return new Response(JSON.stringify({ ok: false, error: "Driver not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (driver.approval_status !== "approved" || !driver.stripe_connect_onboarded) {
      return new Response(
        JSON.stringify({ ok: false, error: "Complete Stripe Connect onboarding first" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const connectId = driver.stripe_connect_account_id as string | null;
    if (!connectId) {
      return new Response(JSON.stringify({ ok: false, error: "No Connect account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pending, error: qErr } = await admin
      .from("driver_earnings_summary")
      .select("id, week_start, net_earnings")
      .eq("driver_id", user.id)
      .eq("payout_status", "pending")
      .order("week_start", { ascending: true });

    if (qErr) throw qErr;
    const rows = pending ?? [];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "No pending earnings to pay out" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalPendingAud = rows.reduce((s, r) => s + Number(r.net_earnings), 0);
    const totalPendingCents = audToCents(totalPendingAud);

    if (body.amount_cents != null && Math.floor(body.amount_cents) !== totalPendingCents) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Partial payouts are not supported — omit amount_cents to pay all pending net earnings.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const amountCents = totalPendingCents;

    if (amountCents < 50) {
      return new Response(JSON.stringify({ ok: false, error: "Pending balance too small to payout" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const skipStripe = Deno.env.get("STRIPE_SKIP_VALIDATE") === "true";
    if (skipStripe) {
      const ids = rows.map((r) => r.id);
      await admin.from("driver_earnings_summary").update({ payout_status: "paid" }).in("id", ids);
      return new Response(
        JSON.stringify({
          ok: true,
          payout_id: "skipped",
          estimated_arrival: null,
          message: "STRIPE_SKIP_VALIDATE=true — marked paid without Stripe",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = getStripe();
    const summaryIds = rows.map((r) => r.id).join(",");
    const currency = "aud";

    // Trip completion transfers net earnings to Connect — wait for total available (not bank_account only).
    let { available: connectAvailable, balance, snapshot } = await waitForConnectBalance(
      stripe,
      connectId,
      amountCents,
      currency,
      { attempts: 3, delayMs: 300 }
    );

    let transferId: string | null = null;

    // Platform top-up when DB pending earnings exceed Connect available (legacy / missed transfers).
    if (connectAvailable < amountCents) {
      const shortfall = amountCents - connectAvailable;
      if (shortfall >= 50) {
        const transfer = await stripe.transfers.create({
          amount: shortfall,
          currency,
          destination: connectId,
          metadata: {
            driver_id: user.id,
            driver_earnings_summary_ids: summaryIds,
            kind: "payout_top_up",
          },
        });
        transferId = transfer.id;
        ({ available: connectAvailable, balance, snapshot } = await waitForConnectBalance(
          stripe,
          connectId,
          amountCents,
          currency,
          { attempts: 15, delayMs: 600 }
        ));
      }
    }

    const payoutCents = Math.min(amountCents, connectAvailable);
    if (payoutCents < 50) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            snapshot.pendingCents > 0
              ? "Your Stripe balance is still settling from recent trips. Try again in a few hours."
              : "Stripe Connect balance is not available yet. Complete a paid trip or try again shortly.",
          available_cents: snapshot.availableCents,
          pending_cents: snapshot.pendingCents,
          bank_account_cents: snapshot.bankAccountAvailableCents,
          card_cents: snapshot.cardAvailableCents,
          requested_cents: amountCents,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sourceType = pickPayoutSourceType(balance, payoutCents, currency);
    if (!sourceType) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Could not determine Stripe payout source. Try again in a few minutes.",
          available_cents: snapshot.availableCents,
          requested_cents: payoutCents,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payout = await stripe.payouts.create(
      {
        amount: payoutCents,
        currency,
        source_type: sourceType,
        metadata: {
          driver_id: user.id,
          driver_earnings_summary_ids: summaryIds,
          ...(transferId ? { transfer_id: transferId } : {}),
        },
      },
      { stripeAccount: connectId }
    );

    const ids = rows.map((r) => r.id);
    await admin
      .from("driver_earnings_summary")
      .update({
        payout_status: "processing",
        stripe_payout_id: payout.id,
        stripe_transfer_id: transferId,
      })
      .in("id", ids);

    return new Response(
      JSON.stringify({
        ok: true,
        payout_id: payout.id,
        transfer_id: transferId,
        amount_cents: payoutCents,
        estimated_arrival: payout.arrival_date ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Server error";
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
