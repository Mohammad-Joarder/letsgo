import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, hashString, jsonResponse } from "../_shared/compliance_edge.ts";

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

    const body = (await req.json()) as { fingerprint?: string; metadata?: Record<string, unknown> };
    const fp = String(body.fingerprint ?? "").trim();
    if (fp.length < 8) {
      return jsonResponse({ ok: false, error: "fingerprint string required" }, 400);
    }

    const salt = Deno.env.get("DEVICE_FINGERPRINT_SALT") ?? "letsgo-device-salt";
    const fpHash = await hashString(`${salt}:${fp}`);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: prof } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (prof?.role !== "driver") return jsonResponse({ ok: false, error: "Driver profile required" }, 403);

    const { data: existing } = await admin
      .from("driver_device_registrations")
      .select("id, first_seen_at")
      .eq("driver_id", user.id)
      .eq("fingerprint_hash", fpHash)
      .maybeSingle();

    const now = new Date().toISOString();
    if (existing?.id) {
      await admin
        .from("driver_device_registrations")
        .update({ last_seen_at: now, metadata: body.metadata ?? {} })
        .eq("id", existing.id);
    } else {
      await admin.from("driver_device_registrations").insert({
        driver_id: user.id,
        fingerprint_hash: fpHash,
        metadata: body.metadata ?? {},
        first_seen_at: now,
        last_seen_at: now,
      });
    }

    const { data: drv } = await admin.from("drivers").select("primary_device_fingerprint").eq("id", user.id).maybeSingle();
    if (!drv?.primary_device_fingerprint) {
      await admin.from("drivers").update({ primary_device_fingerprint: fpHash }).eq("id", user.id);
    }

    const { count: otherDrivers } = await admin
      .from("driver_device_registrations")
      .select("driver_id", { count: "exact", head: true })
      .eq("fingerprint_hash", fpHash)
      .neq("driver_id", user.id);
    if ((otherDrivers ?? 0) > 0) {
      await admin.from("driver_fraud_signals").upsert(
        {
          driver_id: user.id,
          signal_type: "device_fingerprint_seen_on_other_account",
          detail: String(otherDrivers),
        },
        { onConflict: "driver_id,signal_type" }
      );
    }

    await admin.from("compliance_audit_log").insert({
      actor_id: user.id,
      driver_id: user.id,
      action: "device_fingerprint_registered",
      metadata: { fingerprint_hash: fpHash },
    });

    return jsonResponse({ ok: true, fingerprint_hash: fpHash });
  } catch (e) {
    console.error("[register-driver-device]", e);
    return jsonResponse({ ok: false, error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
