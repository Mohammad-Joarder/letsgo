import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

    const ids = rows.map((r) => r.id);
    const { error: uErr } = await admin
      .from("driver_earnings_summary")
      .update({ payout_status: "processing" })
      .in("id", ids);

    if (uErr) throw uErr;

    const total = rows.reduce((s, r) => s + Number(r.net_earnings), 0);

    return new Response(
      JSON.stringify({
        ok: true,
        rows_queued: rows.length,
        total_net: total,
        message:
          "Payout marked as processing. Stripe Connect transfer will be wired in a later phase.",
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
