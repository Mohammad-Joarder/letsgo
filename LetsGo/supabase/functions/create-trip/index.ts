import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { dispatchSearchingTripToDrivers } from "../_shared/dispatch_searching_trip.ts";
import { evaluatePromotionForTrip, type PromotionRow } from "../_shared/promo_eligibility.ts";
import { pushToUser } from "../_shared/push_to_user.ts";
import { audToCents, getStripe } from "../_shared/stripe.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function randomPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
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

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("id, role, full_name, is_verified")
      .eq("id", user.id)
      .single();
    if (pErr || !profile || profile.role !== "rider") {
      return new Response(JSON.stringify({ ok: false, error: "Rider profile required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const b = body as Record<string, unknown>;
    const rideType = b.ride_type as string;
    const pickupAddress = String(b.pickup_address ?? "");
    const dropoffAddress = String(b.dropoff_address ?? "");
    const pickupLat = Number(b.pickup_lat);
    const pickupLng = Number(b.pickup_lng);
    const dropoffLat = Number(b.dropoff_lat);
    const dropoffLng = Number(b.dropoff_lng);
    const estKm = b.estimated_distance_km != null ? Number(b.estimated_distance_km) : null;
    const estMin = b.estimated_duration_min != null ? Number(b.estimated_duration_min) : null;
    const estFare = b.estimated_fare != null ? Number(b.estimated_fare) : null;
    const surgeMult = b.surge_multiplier != null ? Number(b.surge_multiplier) : 1;
    const baseFare = b.base_fare != null ? Number(b.base_fare) : null;
    const distanceFare = b.distance_fare != null ? Number(b.distance_fare) : null;
    const timeFare = b.time_fare != null ? Number(b.time_fare) : null;
    const platformFee = b.platform_fee != null ? Number(b.platform_fee) : null;
    const notes = b.notes != null ? String(b.notes) : null;
    const scheduledFor = b.scheduled_for != null ? String(b.scheduled_for) : null;
    const paymentMethod = (b.payment_method as string) || "card";
    const stripePaymentIntentId =
      b.stripe_payment_intent_id != null ? String(b.stripe_payment_intent_id).trim() : "";

    if (!pickupAddress || !dropoffAddress) {
      return new Response(JSON.stringify({ ok: false, error: "Addresses required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["economy", "comfort", "premium", "xl"].includes(rideType)) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid ride_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid pickup_lat / pickup_lng (must be finite numbers)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const riderId = user.id;
    const pickupPin = randomPin();

    const skipStripe = Deno.env.get("STRIPE_SKIP_VALIDATE") === "true";

    if (paymentMethod === "card" && !stripePaymentIntentId && !skipStripe) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "stripe_payment_intent_id required — authorize payment before booking.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let paymentStatus: "pending" | "authorised" = "pending";
    let verifiedPiId: string | null = null;

    if (paymentMethod === "card" && skipStripe && stripePaymentIntentId) {
      verifiedPiId = stripePaymentIntentId;
      paymentStatus = "authorised";
    }

    if (paymentMethod === "card" && stripePaymentIntentId && !skipStripe) {
      const { data: profStripe, error: psErr } = await admin
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", riderId)
        .single();
      if (psErr || !profStripe?.stripe_customer_id) {
        return new Response(JSON.stringify({ ok: false, error: "Stripe customer missing" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const stripe = getStripe();
      const pi = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
      if (typeof pi.customer === "string" && pi.customer !== profStripe.stripe_customer_id) {
        return new Response(JSON.stringify({ ok: false, error: "PaymentIntent customer mismatch" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const metaRider = pi.metadata?.rider_id;
      if (metaRider && metaRider !== riderId) {
        return new Response(JSON.stringify({ ok: false, error: "PaymentIntent rider mismatch" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const expectedCents = audToCents(estFare != null ? Number(estFare) : 0);
      const piAmount = pi.amount;
      if (Math.abs(piAmount - expectedCents) > 2) {
        return new Response(JSON.stringify({ ok: false, error: "PaymentIntent amount does not match fare" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (pi.status !== "requires_capture" && pi.status !== "succeeded") {
        return new Response(
          JSON.stringify({ ok: false, error: `Payment not authorized (status: ${pi.status})` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      paymentStatus = "authorised";
      verifiedPiId = pi.id;
    }

    const rawPromoId = b.applied_promo_id != null ? String(b.applied_promo_id).trim() : "";
    const clientPromoDiscount =
      b.promo_discount_amount != null && Number.isFinite(Number(b.promo_discount_amount))
        ? Number(b.promo_discount_amount)
        : 0;

    let appliedPromoId: string | null = null;
    let promoDiscountAmount: number | null = null;
    let promoCodeOut: string | null = null;

    if (rawPromoId) {
      if (!Number.isFinite(clientPromoDiscount) || clientPromoDiscount < 0) {
        return new Response(JSON.stringify({ ok: false, error: "Invalid promo_discount_amount" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const grossFare =
        b.fare_before_promo != null && Number.isFinite(Number(b.fare_before_promo))
          ? Number(b.fare_before_promo)
          : estFare != null
            ? Number(estFare) + clientPromoDiscount
            : NaN;
      if (!Number.isFinite(grossFare) || grossFare <= 0) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Invalid fare for promo validation (send fare_before_promo or consistent estimated_fare).",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: prom, error: prErr } = await admin.from("promotions").select("*").eq("id", rawPromoId).maybeSingle();
      if (prErr || !prom) {
        return new Response(JSON.stringify({ ok: false, error: "Invalid promotion" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ev = evaluatePromotionForTrip({
        promo: prom as unknown as PromotionRow,
        tripFare: grossFare,
        rideType,
      });
      if (!ev.ok) {
        return new Response(JSON.stringify({ ok: false, error: ev.error_message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (Math.abs(ev.discount_amount - clientPromoDiscount) > 0.02) {
        return new Response(JSON.stringify({ ok: false, error: "Promotion discount mismatch" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (estFare != null && Math.abs(ev.final_fare - Number(estFare)) > 0.05) {
        return new Response(JSON.stringify({ ok: false, error: "Fare does not match promotion" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { count, error: cErr } = await admin
        .from("rider_promotions")
        .select("id", { count: "exact", head: true })
        .eq("rider_id", riderId)
        .eq("promotion_id", rawPromoId);
      if (cErr) throw cErr;
      const perLimit = Number((prom as { per_user_limit?: number }).per_user_limit ?? 1);
      if ((count ?? 0) >= perLimit) {
        return new Response(JSON.stringify({ ok: false, error: "Promotion usage limit reached for your account" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      appliedPromoId = rawPromoId;
      promoDiscountAmount = ev.discount_amount;
      promoCodeOut = String((prom as { code: string }).code);
    } else if (clientPromoDiscount > 0) {
      return new Response(JSON.stringify({ ok: false, error: "promo_discount_amount requires applied_promo_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tripInsert: Record<string, unknown> = {
      rider_id: riderId,
      ride_type: rideType,
      status: "searching",
      pickup_address: pickupAddress,
      dropoff_address: dropoffAddress,
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
      dropoff_lat: dropoffLat,
      dropoff_lng: dropoffLng,
      estimated_distance_km: estKm,
      estimated_duration_min: estMin,
      estimated_fare: estFare,
      surge_multiplier: surgeMult,
      base_fare: baseFare,
      distance_fare: distanceFare,
      time_fare: timeFare,
      platform_fee: platformFee,
      pickup_pin: pickupPin,
      notes,
      scheduled_for: scheduledFor,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      stripe_payment_intent_id: verifiedPiId,
    };
    if (appliedPromoId) {
      tripInsert.applied_promo_id = appliedPromoId;
      tripInsert.promo_discount_amount = promoDiscountAmount;
      tripInsert.promo_code = promoCodeOut;
    }

    const { data: trip, error: tErr } = await admin.from("trips").insert(tripInsert).select("id, status, pickup_pin").single();

    if (tErr) throw tErr;

    if (appliedPromoId && promoDiscountAmount != null && promoDiscountAmount > 0) {
      await pushToUser(admin, {
        userId: riderId,
        title: "Promo applied",
        body: `You saved $${promoDiscountAmount.toFixed(2)} on this trip.`,
        type: "promo",
        data: { trip_id: trip.id, promo_id: appliedPromoId },
      });
    }

    const scheduledMs = scheduledFor && String(scheduledFor).trim() !== "" ? new Date(scheduledFor).getTime() : NaN;
    const hasScheduled = !Number.isNaN(scheduledMs);
    const skipDispatch = hasScheduled && scheduledMs > Date.now() + 15 * 60 * 1000;

    let responseStatus = trip.status as string;

    if (!skipDispatch) {
      const { candidateIds, rpcSucceeded } = await dispatchSearchingTripToDrivers({
        supabaseUrl,
        serviceKey,
        admin,
        tripId: trip.id,
        riderId,
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng,
        rideType,
        pickupAddress,
        dropoffAddress,
        estKm,
        estMin,
        estFare,
        platformFee,
        riderName: profile.full_name ?? "Rider",
      });
      if (candidateIds.length === 0 && rpcSucceeded) {
        responseStatus = "no_driver_found";
        await pushToUser(admin, {
          userId: riderId,
          title: "No drivers nearby",
          body: "Sorry, no drivers available. Please try again.",
          type: "trip",
          data: { trip_id: trip.id },
        });
      } else if (candidateIds.length > 0) {
        responseStatus = "searching";
      } else {
        responseStatus = "searching";
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        trip_id: trip.id,
        pickup_pin: trip.pickup_pin,
        status: responseStatus,
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
