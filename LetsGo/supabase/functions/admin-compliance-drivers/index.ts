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

    const { data: drivers, error: dErr } = await admin
      .from("drivers")
      .select("id, approval_status, fraud_risk_level, license_number, abn, abn_entity_name")
      .in("approval_status", ["pending", "under_review"])
      .order("updated_at", { ascending: false })
      .limit(200);
    if (dErr) throw dErr;

    const ids = (drivers ?? []).map((d: { id: string }) => d.id);
    const profiles: Record<string, { full_name: string | null; phone: string | null; email: string | null }> = {};
    if (ids.length > 0) {
      const { data: ps } = await admin.from("profiles").select("id, full_name, phone, email").in("id", ids);
      for (const p of ps ?? []) {
        profiles[(p as { id: string }).id] = {
          full_name: (p as { full_name?: string | null }).full_name ?? null,
          phone: (p as { phone?: string | null }).phone ?? null,
          email: (p as { email?: string | null }).email ?? null,
        };
      }
    }

    const docCounts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: counts } = await admin.from("driver_documents").select("driver_id").in("driver_id", ids);
      for (const row of counts ?? []) {
        const id = (row as { driver_id: string }).driver_id;
        docCounts[id] = (docCounts[id] ?? 0) + 1;
      }
    }

    return jsonResponse({ ok: true, drivers: drivers ?? [], profiles, document_counts: docCounts });
  } catch (e) {
    console.error("[admin-compliance-drivers]", e);
    return jsonResponse({ ok: false, error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
