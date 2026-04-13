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
      action?: string;
      payment_method_id?: string;
    } | null;

    const action = body?.action ?? "list";
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

    const stripe = getStripe();
    let customerId = profile.stripe_customer_id as string | null;

    async function ensureStripeCustomer(): Promise<string> {
      if (customerId) return customerId;
      const customer = await stripe.customers.create({
        email: (profile.email as string | null) ?? undefined,
        name: (profile.full_name as string | null) ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
      return customerId;
    }

    if (action === "list") {
      if (!customerId) {
        return new Response(
          JSON.stringify({ ok: true, payment_methods: [], default_payment_method_id: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const customer = await stripe.customers.retrieve(customerId, {
        expand: ["invoice_settings.default_payment_method"],
      });
      const defaultPm =
        typeof customer !== "string" && !customer.deleted
          ? (customer.invoice_settings?.default_payment_method as string | { id: string } | null)
          : null;
      const defaultId =
        typeof defaultPm === "string" ? defaultPm : defaultPm && typeof defaultPm === "object"
          ? defaultPm.id
          : null;

      const list = await stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
      });

      const payment_methods = list.data.map((pm) => ({
        id: pm.id,
        brand: pm.card?.brand ?? "card",
        last4: pm.card?.last4 ?? "****",
        exp_month: pm.card?.exp_month ?? 0,
        exp_year: pm.card?.exp_year ?? 0,
        is_default: pm.id === defaultId,
      }));

      return new Response(
        JSON.stringify({ ok: true, payment_methods, default_payment_method_id: defaultId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "set_default") {
      const pmId = body?.payment_method_id;
      if (!pmId) {
        return new Response(JSON.stringify({ ok: false, error: "payment_method_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const cid = await ensureStripeCustomer();
      const pm = await stripe.paymentMethods.retrieve(pmId);
      if (pm.customer && pm.customer !== cid) {
        return new Response(JSON.stringify({ ok: false, error: "Invalid payment method" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!pm.customer) {
        await stripe.paymentMethods.attach(pmId, { customer: cid });
      }
      await stripe.customers.update(cid, {
        invoice_settings: { default_payment_method: pmId },
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "attach") {
      const pmId = body?.payment_method_id;
      if (!pmId) {
        return new Response(JSON.stringify({ ok: false, error: "payment_method_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const cid = await ensureStripeCustomer();
      await stripe.paymentMethods.attach(pmId, { customer: cid });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "detach") {
      const pmId = body?.payment_method_id;
      if (!pmId) {
        return new Response(JSON.stringify({ ok: false, error: "payment_method_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!customerId) {
        return new Response(JSON.stringify({ ok: false, error: "No saved cards" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const pm = await stripe.paymentMethods.retrieve(pmId);
      if (pm.customer !== customerId) {
        return new Response(JSON.stringify({ ok: false, error: "Invalid payment method" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await stripe.paymentMethods.detach(pmId);
      const cust = await stripe.customers.retrieve(customerId);
      if (typeof cust !== "string" && !cust.deleted) {
        const def = cust.invoice_settings?.default_payment_method as string | null;
        if (def === pmId) {
          await stripe.customers.update(customerId, {
            invoice_settings: { default_payment_method: undefined },
          });
        }
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
