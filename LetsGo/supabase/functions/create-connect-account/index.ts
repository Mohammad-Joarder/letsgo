import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { isAllowedAppContinueUrl } from "../_shared/stripeConnectAppUrl.ts";
import { getStripe } from "../_shared/stripe.ts";

/** Keep in sync with STRIPE_CONNECT_RETURN_SUFFIX in app `lib/supabase.ts`. */
const STRIPE_CONNECT_RETURN_SUFFIX = "/functions/v1/create-connect-account-return";

/** Supabase Dashboard "empty" secrets often become ""; `??` does not treat "" as missing. */
function stripeEnvUrl(key: string): string | undefined {
  const raw = Deno.env.get(key);
  if (raw == null) return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

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

    const body = await req.json().catch(() => null) as {
      driver_id?: string;
      app_continue_url?: string;
    } | null;
    const driverId = body?.driver_id ?? user.id;
    if (driverId !== user.id) {
      return new Response(JSON.stringify({ ok: false, error: "driver_id mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("id, role, email, full_name")
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

    const stripe = getStripe();
    let accountId = driver.stripe_connect_account_id as string | null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "AU",
        email: profile.email ?? undefined,
        business_type: "individual",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { supabase_driver_id: user.id },
      });
      accountId = account.id;
      await admin.from("drivers").update({ stripe_connect_account_id: accountId }).eq("id", user.id);
    }

    const base = supabaseUrl.replace(/\/$/, "");
    const defaultHttpsReturn = `${base}${STRIPE_CONNECT_RETURN_SUFFIX}`;
    const rawReturn = stripeEnvUrl("STRIPE_CONNECT_RETURN_URL") ?? defaultHttpsReturn;
    const rawRefresh = stripeEnvUrl("STRIPE_CONNECT_REFRESH_URL") ?? rawReturn;

    const appContinue =
      typeof body?.app_continue_url === "string" ? body.app_continue_url.trim() : "";

    function withContinue(httpsUrl: string): string {
      if (!appContinue || !isAllowedAppContinueUrl(appContinue)) return httpsUrl;
      const u = new URL(httpsUrl);
      u.searchParams.set("continue", appContinue);
      return u.toString();
    }

    const returnUrl = withContinue(rawReturn);
    const refreshUrl = withContinue(rawRefresh);

    for (const [label, url] of [
      ["STRIPE_CONNECT_RETURN_URL", returnUrl],
      ["STRIPE_CONNECT_REFRESH_URL", refreshUrl],
    ] as const) {
      try {
        const u = new URL(url);
        if (u.protocol !== "https:" && u.protocol !== "http:") {
          throw new Error(`${label} must be http(s). Stripe rejects Expo exp:// and other custom schemes.`);
        }
      } catch (e) {
        if (e instanceof TypeError) {
          throw new Error(`${label} is not a valid URL: ${url}`);
        }
        throw e;
      }
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return new Response(
      JSON.stringify({
        ok: true,
        account_id: accountId,
        onboarding_url: link.url,
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
