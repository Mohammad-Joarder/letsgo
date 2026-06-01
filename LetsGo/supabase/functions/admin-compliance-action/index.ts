import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/compliance_edge.ts";

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
    const { data: prof } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (prof?.role !== "admin") {
      return jsonResponse({ ok: false, error: "Admin only" }, 403);
    }

    const body = (await req.json()) as {
      driver_id?: string;
      action?: "approve" | "reject" | "suspend" | "request_resubmit";
      reason?: string;
    };
    const driverId = body.driver_id?.trim();
    const action = body.action;
    if (!driverId || !action) {
      return jsonResponse({ ok: false, error: "driver_id and action required" }, 400);
    }

    let approval_status: string = "pending";
    if (action === "approve") approval_status = "approved";
    if (action === "reject") approval_status = "rejected";
    if (action === "suspend") approval_status = "suspended";
    if (action === "request_resubmit") approval_status = "pending";

    const { error: up } = await admin.from("drivers").update({ approval_status }).eq("id", driverId);
    if (up) throw up;

    await admin.from("compliance_audit_log").insert({
      actor_id: user.id,
      driver_id: driverId,
      action: `admin_${action}`,
      metadata: { reason: body.reason ?? null },
    });

    return jsonResponse({ ok: true, approval_status });
  } catch (e) {
    console.error("[admin-compliance-action]", e);
    return jsonResponse({ ok: false, error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
