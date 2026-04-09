import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { runInBackground } from "../_shared/background.ts";
import { getStripe } from "../_shared/stripe.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET missing");
    return new Response(JSON.stringify({ error: "Webhook not configured" }), { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "No signature" }), { status: 400 });
  }

  const body = await req.text();

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret) as typeof event;
  } catch (e) {
    console.error("Webhook signature verification failed", e);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
  }

  runInBackground(
    (async () => {
      const admin = createClient(supabaseUrl, serviceKey);

      try {
        switch (event.type) {
          case "payment_intent.succeeded": {
            const pi = event.data.object as { id?: string; metadata?: Record<string, string> };
            const tripId = pi.metadata?.trip_id;
            if (tripId) {
              await admin
                .from("trips")
                .update({ payment_status: "captured" })
                .eq("id", tripId)
                .eq("stripe_payment_intent_id", pi.id ?? "");
            } else if (pi.id) {
              await admin
                .from("trips")
                .update({ payment_status: "captured" })
                .eq("stripe_payment_intent_id", pi.id);
            }
            break;
          }
          case "payment_intent.payment_failed": {
            const pi = event.data.object as {
              id?: string;
              metadata?: Record<string, string>;
              last_payment_error?: { message?: string };
            };
            const tripId = pi.metadata?.trip_id;
            const riderId = pi.metadata?.rider_id;
            if (tripId) {
              await admin.from("trips").update({ payment_status: "failed" }).eq("id", tripId);
            } else if (pi.id) {
              await admin.from("trips").update({ payment_status: "failed" }).eq("stripe_payment_intent_id", pi.id);
            }
            if (riderId) {
              await admin.from("notifications").insert({
                user_id: riderId,
                title: "Payment failed",
                body:
                  pi.last_payment_error?.message ??
                  "Please update your payment method and try again.",
                type: "payment",
                data: { trip_id: tripId ?? null, stripe_payment_intent_id: pi.id ?? null },
              });
            }
            break;
          }
          case "transfer.created": {
            const tr = event.data.object as {
              id?: string;
              metadata?: Record<string, string>;
            };
            const summaryIds = tr.metadata?.driver_earnings_summary_ids;
            if (summaryIds && tr.id) {
              const ids = summaryIds.split(",").map((s) => s.trim()).filter(Boolean);
              for (const id of ids) {
                await admin
                  .from("driver_earnings_summary")
                  .update({
                    stripe_transfer_id: tr.id,
                    payout_status: "processing",
                  })
                  .eq("id", id);
              }
            }
            break;
          }
          case "account.updated": {
            const acct = event.data.object as {
              id?: string;
              charges_enabled?: boolean;
              details_submitted?: boolean;
            };
            if (!acct.id) break;
            const onboarded = Boolean(acct.charges_enabled && acct.details_submitted);
            await admin
              .from("drivers")
              .update({ stripe_connect_onboarded: onboarded })
              .eq("stripe_connect_account_id", acct.id);
            break;
          }
          default:
            break;
        }
      } catch (err) {
        console.error("[stripe-webhook] handler error", err);
      }
    })()
  );

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
