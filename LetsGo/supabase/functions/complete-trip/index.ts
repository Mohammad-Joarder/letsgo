import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { pushToUser } from "../_shared/push_to_user.ts";
import { realtimeBroadcast } from "../_shared/realtime_broadcast.ts";
import { audToCents, getStripe } from "../_shared/stripe.ts";

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

type DriverTier = "standard" | "silver" | "gold" | "platinum";

function tierFromMonthlyTrips(n: number): DriverTier {
  if (n >= 100) return "platinum";
  if (n >= 50) return "gold";
  if (n >= 20) return "silver";
  return "standard";
}

const TIER_RANK: Record<string, number> = { standard: 0, silver: 1, gold: 2, platinum: 3 };

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

    const est = trip.estimated_fare != null ? Number(trip.estimated_fare) : 0;
    let finalFare =
      finalFareOverride != null && Number.isFinite(finalFareOverride) ? Number(finalFareOverride) : est;
    const riderTip = trip.rider_tip != null ? Number(trip.rider_tip) : 0;
    const totalCapture = Math.max(0, finalFare + riderTip);

    const { data: fc } = await admin
      .from("fare_config")
      .select("platform_fee_percent")
      .eq("ride_type", trip.ride_type)
      .eq("is_active", true)
      .maybeSingle();
    const feePct = fc?.platform_fee_percent != null ? Number(fc.platform_fee_percent) : 0.15;
    const platformFeeAmount = Math.round(finalFare * feePct * 100) / 100;
    const net = Math.max(0, finalFare - platformFeeAmount);
    const driverTransferTotal = net + riderTip;

    const skipStripe = Deno.env.get("STRIPE_SKIP_VALIDATE") === "true";
    const piId = trip.stripe_payment_intent_id as string | null;

    const { data: driverRow } = await admin
      .from("drivers")
      .select(
        "stripe_connect_account_id, stripe_connect_onboarded, total_trips, total_earnings, tier, tier_trips_this_period, tier_period_start"
      )
      .eq("id", user.id)
      .single();

    if (piId && !skipStripe) {
      const stripe = getStripe();
      const pi = await stripe.paymentIntents.retrieve(piId);
      const captureCents = audToCents(totalCapture);
      const maxCap = pi.amount_capturable ?? pi.amount;
      const toCapture = Math.min(captureCents, maxCap);
      if (toCapture > 0 && (pi.status === "requires_capture" || pi.status === "requires_confirmation")) {
        await stripe.paymentIntents.capture(piId, { amount_to_capture: toCapture });
      }
    }

    if (
      driverTransferTotal > 0 &&
      driverRow?.stripe_connect_account_id &&
      driverRow.stripe_connect_onboarded &&
      !skipStripe
    ) {
      const stripe = getStripe();
      await stripe.transfers.create({
        amount: audToCents(driverTransferTotal),
        currency: "aud",
        destination: driverRow.stripe_connect_account_id as string,
        metadata: {
          trip_id: tripId,
          kind: "trip_complete",
        },
      });
    }

    const now = new Date().toISOString();
    const ws = weekStartUtc(new Date());

    const { error: uErr } = await admin
      .from("trips")
      .update({
        status: "completed",
        trip_completed_at: now,
        final_fare: finalFare,
        platform_fee: platformFeeAmount,
        payment_status: piId ? "captured" : trip.payment_status,
      })
      .eq("id", tripId)
      .eq("driver_id", user.id);

    if (uErr) throw uErr;

    const riderId = trip.rider_id as string;
    const appliedPromoId = trip.applied_promo_id as string | null;
    if (appliedPromoId) {
      const { error: rpErr } = await admin.from("rider_promotions").insert({
        rider_id: riderId,
        promotion_id: appliedPromoId,
        trip_id: tripId,
      });
      if (rpErr) console.error("[complete-trip] rider_promotions", rpErr);
      const { data: promRow } = await admin.from("promotions").select("uses_count").eq("id", appliedPromoId).maybeSingle();
      if (promRow?.uses_count != null) {
        await admin
          .from("promotions")
          .update({ uses_count: Number(promRow.uses_count) + 1 })
          .eq("id", appliedPromoId);
      }
    }

    await admin.from("drivers").update({ current_status: "online" }).eq("id", user.id);

    const { data: existing } = await admin
      .from("driver_earnings_summary")
      .select("id, total_trips, total_gross, platform_fee_total, net_earnings, tips_total")
      .eq("driver_id", user.id)
      .eq("week_start", ws)
      .maybeSingle();

    if (existing) {
      await admin
        .from("driver_earnings_summary")
        .update({
          total_trips: Number(existing.total_trips) + 1,
          total_gross: Number(existing.total_gross) + finalFare,
          platform_fee_total: Number(existing.platform_fee_total) + platformFeeAmount,
          net_earnings: Number(existing.net_earnings) + net,
          tips_total: Number(existing.tips_total ?? 0) + riderTip,
        })
        .eq("id", existing.id);
    } else {
      await admin.from("driver_earnings_summary").insert({
        driver_id: user.id,
        week_start: ws,
        total_trips: 1,
        total_gross: finalFare,
        platform_fee_total: platformFeeAmount,
        net_earnings: net,
        tips_total: riderTip,
        payout_status: "pending",
      });
    }

    if (driverRow) {
      const nowDt = new Date();
      const periodRaw = (driverRow as { tier_period_start?: string | null }).tier_period_start;
      const periodStart = periodRaw
        ? new Date(periodRaw.includes("T") ? periodRaw : `${periodRaw}T00:00:00.000Z`)
        : nowDt;
      const sameMonth =
        periodStart.getUTCFullYear() === nowDt.getUTCFullYear() &&
        periodStart.getUTCMonth() === nowDt.getUTCMonth();
      let tripsThisPeriod: number;
      let nextPeriodStart: string;
      if (sameMonth) {
        tripsThisPeriod = Number((driverRow as { tier_trips_this_period?: number }).tier_trips_this_period ?? 0) + 1;
        nextPeriodStart = periodRaw ?? nowDt.toISOString().slice(0, 10);
      } else {
        tripsThisPeriod = 1;
        nextPeriodStart = new Date(Date.UTC(nowDt.getUTCFullYear(), nowDt.getUTCMonth(), 1))
          .toISOString()
          .slice(0, 10);
      }
      const newTier = tierFromMonthlyTrips(tripsThisPeriod);
      const oldTierStr = String((driverRow as { tier?: string }).tier ?? "standard");
      const rankedOld = TIER_RANK[oldTierStr] ?? 0;
      const rankedNew = TIER_RANK[newTier] ?? 0;

      await admin
        .from("drivers")
        .update({
          total_trips: Number(driverRow.total_trips) + 1,
          total_earnings: Number(driverRow.total_earnings) + net + riderTip,
          tier: newTier,
          tier_trips_this_period: tripsThisPeriod,
          tier_period_start: nextPeriodStart,
        })
        .eq("id", user.id);

      if (rankedNew > rankedOld) {
        await pushToUser(admin, {
          userId: user.id,
          title: "Tier upgrade",
          body: `You're now ${newTier.charAt(0).toUpperCase() + newTier.slice(1)}! Keep driving to unlock more perks.`,
          type: "driver_tier",
          data: { tier: newTier, trip_id: tripId },
        });
      }
    }

    const { data: rRow } = await admin
      .from("riders")
      .select("total_trips")
      .eq("id", riderId)
      .maybeSingle();
    if (rRow) {
      await admin
        .from("riders")
        .update({ total_trips: Number(rRow.total_trips) + 1 })
        .eq("id", riderId);
    }

    await realtimeBroadcast(supabaseUrl, serviceKey, `trip_updates:${tripId}`, "status", {
      trip_id: tripId,
      status: "completed",
      final_fare: finalFare,
    });

    await pushToUser(admin, {
      userId: riderId,
      title: "Trip complete",
      body: `Trip complete! $${finalFare.toFixed(2)} charged. Rate your driver?`,
      type: "trip",
      data: { trip_id: tripId, screen: "trip_complete" },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        final_fare: finalFare,
        net_earnings: net + riderTip,
        platform_fee: platformFeeAmount,
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
