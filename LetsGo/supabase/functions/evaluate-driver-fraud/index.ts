import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/compliance_edge.ts";
import { evaluateDriverFraud } from "../_shared/driver_fraud_evaluation.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
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
    if (userErr || !user) return jsonResponse({ ok: false, error: "Invalid session" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    await evaluateDriverFraud(admin, user.id);

    const { data: d } = await admin
      .from("drivers")
      .select("fraud_risk_level, fraud_risk_notes")
      .eq("id", user.id)
      .maybeSingle();

    return jsonResponse({ ok: true, fraud_risk_level: d?.fraud_risk_level ?? "LOW", notes: d?.fraud_risk_notes });
  } catch (e) {
    console.error("[evaluate-driver-fraud]", e);
    return jsonResponse({ ok: false, error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
