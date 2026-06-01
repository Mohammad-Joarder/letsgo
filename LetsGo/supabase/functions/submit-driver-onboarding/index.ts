import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { evaluateDriverFraud } from "../_shared/driver_fraud_evaluation.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REQUIRED_DOC_TYPES = [
  "license_front",
  "license_back",
  "vehicle_registration",
  "insurance",
  "profile_photo",
  "vehicle_photo",
  "driver_selfie",
] as const;

function normalizeBsb(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 6) return null;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

function validAccountNumber(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 5 && digits.length <= 12;
}

const MIN_VALIDITY_MONTHS = 6;
const MIN_LICENSE_HELD_MONTHS = 6;

function parseIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const dt = new Date(y, mo, day);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== day) return null;
  return dt;
}

function minExpiryFromToday(months: number): Date {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return new Date(today.getFullYear(), today.getMonth() + months, today.getDate());
}

function expiryValidForMonths(value: unknown, months: number): boolean {
  if (value == null || value === "") return false;
  const iso = String(value).slice(0, 10);
  const expiry = parseIsoDate(iso);
  if (!expiry) return false;
  return expiry >= minExpiryFromToday(months);
}

/** First issue date on or before (today − months): held a licence at least that long; not in the future. */
function licenseFirstIssueHeldAtLeastMonths(value: unknown, months: number): boolean {
  if (value == null || value === "") return false;
  const iso = String(value).slice(0, 10);
  const issue = parseIsoDate(iso);
  if (!issue) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (issue > today) return false;
  const cutoff = new Date(today.getFullYear(), today.getMonth() - months, today.getDate());
  return issue.getTime() <= cutoff.getTime();
}

async function loadFlags(
  admin: ReturnType<typeof createClient>,
  keys: string[]
): Promise<Record<string, boolean>> {
  const { data } = await admin.from("app_feature_flags").select("flag_key, enabled").in("flag_key", keys);
  const out: Record<string, boolean> = {};
  for (const k of keys) out[k] = false;
  for (const row of data ?? []) {
    out[String((row as { flag_key: string }).flag_key)] = Boolean((row as { enabled: boolean }).enabled);
  }
  return out;
}

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

    const { data: prof, error: pErr } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();
    if (pErr || !prof || prof.role !== "driver") {
      return new Response(JSON.stringify({ ok: false, error: "Driver profile required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: driver, error: dErr } = await admin
      .from("drivers")
      .select(
        "id, approval_status, license_number, license_expiry, license_first_issued, insurance_expiry, bank_bsb, bank_account_number, abn_verified_at, vehicle_inspection_expiry"
      )
      .eq("id", user.id)
      .maybeSingle();
    if (dErr || !driver) {
      return new Response(JSON.stringify({ ok: false, error: "Driver record not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const flags = await loadFlags(admin, [
      "driver_email_verification_gate",
      "driver_abn_validation",
      "driver_vehicle_docs_enhanced",
      "driver_fraud_detection",
      "driver_audit_logging",
    ]);

    if (flags.driver_email_verification_gate && !user.email_confirmed_at) {
      return new Response(JSON.stringify({ ok: false, error: "Confirm your email before submitting." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (flags.driver_abn_validation && !driver.abn_verified_at) {
      return new Response(JSON.stringify({ ok: false, error: "Validate and save your ABN on the vehicle step." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (flags.driver_vehicle_docs_enhanced) {
      const { data: insp } = await admin
        .from("driver_documents")
        .select("id")
        .eq("driver_id", user.id)
        .eq("document_type", "vehicle_inspection")
        .maybeSingle();
      if (!insp?.id) {
        return new Response(
          JSON.stringify({ ok: false, error: "Upload a vehicle inspection certificate (enhanced compliance)." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (!expiryValidForMonths(driver.vehicle_inspection_expiry, 0)) {
        return new Response(
          JSON.stringify({ ok: false, error: "Set a valid vehicle inspection expiry (not in the past)." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const status = driver.approval_status as string;
    if (status === "under_review") {
      return new Response(JSON.stringify({ ok: true, already_submitted: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (status !== "pending") {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Application cannot be submitted in the current approval state.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const licenseNumber = typeof driver.license_number === "string" ? driver.license_number.trim() : "";
    if (licenseNumber.length < 4) {
      return new Response(JSON.stringify({ ok: false, error: "License number is missing or too short." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!expiryValidForMonths(driver.license_expiry, MIN_VALIDITY_MONTHS)) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Driver licence must be valid for at least ${MIN_VALIDITY_MONTHS} months.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!licenseFirstIssueHeldAtLeastMonths(driver.license_first_issued, MIN_LICENSE_HELD_MONTHS)) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Licence first issue date must be at least ${MIN_LICENSE_HELD_MONTHS} months ago (enter the date shown on your licence, e.g. field 4a).`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!expiryValidForMonths(driver.insurance_expiry, MIN_VALIDITY_MONTHS)) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Insurance must be valid for more than ${MIN_VALIDITY_MONTHS} months.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const bsbNorm = normalizeBsb(String(driver.bank_bsb ?? ""));
    if (!bsbNorm || !validAccountNumber(String(driver.bank_account_number ?? ""))) {
      return new Response(JSON.stringify({ ok: false, error: "Valid Australian BSB and account number are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: docs, error: docErr } = await admin
      .from("driver_documents")
      .select("document_type")
      .eq("driver_id", user.id);
    if (docErr) throw docErr;

    const have = new Set((docs ?? []).map((r: { document_type: string }) => r.document_type));
    for (const t of REQUIRED_DOC_TYPES) {
      if (!have.has(t)) {
        return new Response(
          JSON.stringify({ ok: false, error: `Missing required document: ${t.replace(/_/g, " ")}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const { data: vehicle, error: vErr } = await admin
      .from("vehicles")
      .select("id, plate_number")
      .eq("driver_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (vErr) throw vErr;
    const plate = typeof vehicle?.plate_number === "string" ? vehicle.plate_number.trim().toUpperCase() : "";
    if (!vehicle?.id || plate.length < 2 || plate === "PENDING") {
      return new Response(JSON.stringify({ ok: false, error: "Complete your vehicle details before submitting." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (flags.driver_fraud_detection) {
      await evaluateDriverFraud(admin, user.id);
    }

    const { error: upErr } = await admin
      .from("drivers")
      .update({
        approval_status: "under_review",
        bank_bsb: bsbNorm,
      })
      .eq("id", user.id)
      .eq("approval_status", "pending");
    if (upErr) throw upErr;

    if (flags.driver_audit_logging) {
      await admin.from("compliance_audit_log").insert({
        actor_id: user.id,
        driver_id: user.id,
        action: "driver_application_submitted",
        metadata: { flags },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[submit-driver-onboarding]", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
