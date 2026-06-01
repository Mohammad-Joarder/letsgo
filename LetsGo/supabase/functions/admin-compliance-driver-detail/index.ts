import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/compliance_edge.ts";

const BUCKET = "driver-documents";

const REVIEW_SLOTS: { key: string; label: string }[] = [
  { key: "license_front", label: "Driver licence — front" },
  { key: "license_back", label: "Driver licence — back" },
  { key: "profile_photo", label: "Profile / face photo" },
  { key: "driver_selfie", label: "Driver selfie" },
  { key: "vehicle_registration", label: "Vehicle registration" },
  { key: "insurance", label: "Insurance certificate" },
  { key: "vehicle_inspection", label: "Vehicle inspection certificate" },
  { key: "vehicle_photo", label: "Vehicle exterior photo" },
];

function humanizeDocType(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function maskBsb(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const d = raw.replace(/\D/g, "");
  if (d.length !== 6) return raw;
  return `***-${d.slice(3)}`;
}

function maskAccount(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const d = raw.replace(/\D/g, "");
  if (d.length < 4) return "****";
  return `····${d.slice(-4)}`;
}

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

    let body: { driver_id?: string };
    try {
      body = (await req.json()) as { driver_id?: string };
    } catch {
      return jsonResponse({ ok: false, error: "JSON body required" }, 400);
    }
    const driverId = body.driver_id?.trim();
    if (!driverId) {
      return jsonResponse({ ok: false, error: "driver_id required" }, 400);
    }

    const { data: drv, error: dErr } = await admin
      .from("drivers")
      .select(
        "id, approval_status, fraud_risk_level, license_number, license_expiry, license_first_issued, insurance_expiry, vehicle_inspection_expiry, abn, abn_entity_name, abn_verified_at, bank_bsb, bank_account_number"
      )
      .eq("id", driverId)
      .maybeSingle();
    if (dErr) throw dErr;
    if (!drv) {
      return jsonResponse({ ok: false, error: "Driver not found" }, 404);
    }
    const status = (drv as { approval_status?: string }).approval_status;
    if (status !== "pending" && status !== "under_review") {
      return jsonResponse({ ok: false, error: "Driver is not in the compliance queue" }, 400);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, phone, email")
      .eq("id", driverId)
      .maybeSingle();

    const { data: vehicle } = await admin
      .from("vehicles")
      .select("make, model, plate_number, year, color")
      .eq("driver_id", driverId)
      .eq("is_active", true)
      .maybeSingle();

    const { data: docRows, error: docErr } = await admin
      .from("driver_documents")
      .select("document_type, storage_path")
      .eq("driver_id", driverId);
    if (docErr) throw docErr;

    const pathByType = new Map<string, string>();
    for (const row of docRows ?? []) {
      const r = row as { document_type: string; storage_path: string };
      if (r.storage_path) pathByType.set(r.document_type, r.storage_path);
    }

    const documents: { key: string; label: string; signed_url: string | null }[] = [];
    const slotKeys = new Set(REVIEW_SLOTS.map((s) => s.key));
    for (const slot of REVIEW_SLOTS) {
      const path = pathByType.get(slot.key) ?? null;
      let signed_url: string | null = null;
      if (path) {
        const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600);
        signed_url = data?.signedUrl ?? null;
      }
      documents.push({ key: slot.key, label: slot.label, signed_url });
    }

    const seenExtra = new Set<string>();
    for (const row of docRows ?? []) {
      const r = row as { document_type: string; storage_path: string };
      if (!r.storage_path || slotKeys.has(r.document_type)) continue;
      if (seenExtra.has(r.document_type)) continue;
      seenExtra.add(r.document_type);
      const { data } = await admin.storage.from(BUCKET).createSignedUrl(r.storage_path, 3600);
      documents.push({
        key: r.document_type,
        label: `${humanizeDocType(r.document_type)} (additional upload)`,
        signed_url: data?.signedUrl ?? null,
      });
    }

    const d = drv as Record<string, unknown>;
    return jsonResponse({
      ok: true,
      profile: {
        full_name: (profile as { full_name?: string | null } | null)?.full_name ?? null,
        phone: (profile as { phone?: string | null } | null)?.phone ?? null,
        email: (profile as { email?: string | null } | null)?.email ?? null,
      },
      driver: {
        id: driverId,
        approval_status: status,
        fraud_risk_level: (d.fraud_risk_level as string | null) ?? null,
        license_number: (d.license_number as string | null) ?? null,
        license_expiry: d.license_expiry != null ? String(d.license_expiry).slice(0, 10) : null,
        license_first_issued: d.license_first_issued != null ? String(d.license_first_issued).slice(0, 10) : null,
        insurance_expiry: d.insurance_expiry != null ? String(d.insurance_expiry).slice(0, 10) : null,
        vehicle_inspection_expiry:
          d.vehicle_inspection_expiry != null ? String(d.vehicle_inspection_expiry).slice(0, 10) : null,
        abn: (d.abn as string | null) ?? null,
        abn_entity_name: (d.abn_entity_name as string | null) ?? null,
        abn_verified_at: d.abn_verified_at != null ? String(d.abn_verified_at) : null,
        bank_bsb_masked: maskBsb(d.bank_bsb as string | null | undefined),
        bank_account_masked: maskAccount(d.bank_account_number as string | null | undefined),
      },
      vehicle: vehicle
        ? {
            make: (vehicle as { make?: string | null }).make ?? null,
            model: (vehicle as { model?: string | null }).model ?? null,
            plate_number: (vehicle as { plate_number?: string | null }).plate_number ?? null,
            year: (vehicle as { year?: number | null }).year ?? null,
            color: (vehicle as { color?: string | null }).color ?? null,
          }
        : null,
      documents,
    });
  } catch (e) {
    console.error("[admin-compliance-driver-detail]", e);
    return jsonResponse({ ok: false, error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
