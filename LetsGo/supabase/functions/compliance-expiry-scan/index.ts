import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/compliance_edge.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const secret = Deno.env.get("COMPLIANCE_CRON_SECRET")?.trim();
    const hdr = req.headers.get("x-compliance-cron-secret")?.trim();
    if (!secret || hdr !== secret) {
      return jsonResponse({ ok: false, error: "Unauthorized cron" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const horizon = new Date(Date.now() + 45 * 24 * 3600_000).toISOString().slice(0, 10);

    const seen = new Map<string, { license_expiry?: string | null; insurance_expiry?: string | null; vehicle_inspection_expiry?: string | null }>();

    async function pull(field: "license_expiry" | "insurance_expiry" | "vehicle_inspection_expiry") {
      const { data, error } = await admin
        .from("drivers")
        .select(`id, license_expiry, insurance_expiry, vehicle_inspection_expiry`)
        .not(field, "is", null)
        .lte(field, horizon);
      if (error) throw error;
      for (const row of data ?? []) {
        const id = (row as { id: string }).id;
        const cur = seen.get(id) ?? {};
        cur.license_expiry = (row as { license_expiry?: string | null }).license_expiry ?? cur.license_expiry;
        cur.insurance_expiry = (row as { insurance_expiry?: string | null }).insurance_expiry ?? cur.insurance_expiry;
        cur.vehicle_inspection_expiry =
          (row as { vehicle_inspection_expiry?: string | null }).vehicle_inspection_expiry ?? cur.vehicle_inspection_expiry;
        seen.set(id, cur);
      }
    }

    await pull("license_expiry");
    await pull("insurance_expiry");
    await pull("vehicle_inspection_expiry");

    let notified = 0;
    for (const [id, exp] of seen) {
      const parts: string[] = [];
      if (exp.license_expiry) parts.push(`Licence expires ${exp.license_expiry}`);
      if (exp.insurance_expiry) parts.push(`Insurance expires ${exp.insurance_expiry}`);
      if (exp.vehicle_inspection_expiry) parts.push(`Inspection expires ${exp.vehicle_inspection_expiry}`);
      if (parts.length === 0) continue;
      const { error: nErr } = await admin.from("notifications").insert({
        user_id: id,
        title: "Document expiry reminder",
        body: parts.join(". ") + ". Please renew and update Lets Go.",
        type: "compliance_expiry",
        data: { driver_id: id },
      });
      if (!nErr) notified++;
    }

    return jsonResponse({ ok: true, drivers_flagged: seen.size, notifications_inserted: notified });
  } catch (e) {
    console.error("[compliance-expiry-scan]", e);
    return jsonResponse({ ok: false, error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
