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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!.trim();
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!.trim();
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.trim();

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
      .select("id, role")
      .eq("id", user.id)
      .single();
    if (pErr || !profile || profile.role !== "driver") {
      return new Response(JSON.stringify({ ok: false, error: "Driver profile required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: driver, error: dErr } = await admin
      .from("drivers")
      .select("stripe_connect_account_id, approval_status")
      .eq("id", user.id)
      .single();
    if (dErr || !driver) {
      return new Response(JSON.stringify({ ok: false, error: "Driver record not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (driver.approval_status !== "approved") {
      return new Response(JSON.stringify({ ok: false, error: "Driver not approved" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountId = driver.stripe_connect_account_id as string | null;
    if (!accountId) {
      return new Response(
        JSON.stringify({
          ok: true,
          stripe_connect_onboarded: false,
          message: "No Stripe Connect account yet — use Continue with Stripe first.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(accountId);
    const onboarded = Boolean(account.charges_enabled && account.details_submitted);

    await admin
      .from("drivers")
      .update({ stripe_connect_onboarded: onboarded })
      .eq("id", user.id);

    return new Response(
      JSON.stringify({
        ok: true,
        stripe_connect_onboarded: onboarded,
        charges_enabled: account.charges_enabled ?? false,
        details_submitted: account.details_submitted ?? false,
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
