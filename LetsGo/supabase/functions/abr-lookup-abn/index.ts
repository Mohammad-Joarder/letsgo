import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/compliance_edge.ts";

function digitsOnlyAbn(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11) return null;
  return d;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function pickOrganisationName(root: Record<string, unknown>): string {
  const entity = str(root.EntityName);
  if (entity) return entity;
  const main = root.MainName as Record<string, unknown> | undefined;
  const mainName = str(main?.OrganisationName);
  if (mainName) return mainName;
  const biz = root.BusinessName;
  if (Array.isArray(biz) && biz.length > 0) {
    const first = biz[0] as Record<string, unknown>;
    const on = str(first?.OrganisationName);
    if (on) return on;
  }
  const legal = root.LegalName as Record<string, unknown> | undefined;
  const ln = str(legal?.OrganisationName);
  if (ln) return ln;
  return "";
}

function pickPhysicalAddress(root: Record<string, unknown>): Record<string, unknown> | null {
  const keys = ["MainBusinessPhysicalAddress", "MainPhysicalAddress", "BusinessAddress"];
  for (const k of keys) {
    const v = root[k];
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  }
  return null;
}

function formatAddressLine(addr: Record<string, unknown> | null): string {
  if (!addr) return "";
  const line1 = str(addr.Line1 ?? addr.AddressLine1);
  const line2 = str(addr.Line2 ?? addr.AddressLine2);
  const suburb = str(addr.Suburb ?? addr.Locality ?? addr.City);
  const state = str(addr.StateCode ?? addr.State);
  const pc = str(addr.Postcode);
  const statePc = [state, pc].filter(Boolean).join(" ").trim();
  const parts = [line1, line2, suburb, statePc].filter(Boolean);
  return parts.join(", ");
}

function abnStatusActive(root: Record<string, unknown>): boolean {
  const status = root.AbnStatus;
  if (typeof status === "string") {
    return status.toLowerCase().includes("active") || status === "";
  }
  if (status && typeof status === "object" && !Array.isArray(status)) {
    const es = str((status as { EntityStatus?: unknown }).EntityStatus).toLowerCase();
    return es.includes("active") || es === "";
  }
  return Boolean(pickOrganisationName(root));
}

function gstFromRoot(root: Record<string, unknown>): boolean {
  const gst = str(root.Gst).toLowerCase() === "true" || str(root.GoodsAndServicesTax).toLowerCase() === "true";
  if (gst) return true;
  const reg = root.GstRegistration;
  if (reg && typeof reg === "object") {
    const r = reg as { GstRegistrationStatus?: unknown };
    return str(r.GstRegistrationStatus).toLowerCase().includes("reg");
  }
  return false;
}

/**
 * ABR JSON endpoints return JSONP: `callbackName({...})` (see https://abr.business.gov.au/json/).
 * `callback` must be passed as a query param; response is not raw JSON.
 */
function parseAbrJsonpOrJson(text: string): Record<string, unknown> {
  const t = text.trim().replace(/;\s*$/, "");
  const m = /^[a-zA-Z_$][a-zA-Z0-9_$]*\(([\s\S]*)\)\s*$/.exec(t);
  if (m?.[1]) {
    return JSON.parse(m[1]) as Record<string, unknown>;
  }
  return JSON.parse(t) as Record<string, unknown>;
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

    const body = (await req.json()) as { abn?: string; persist?: boolean };
    const abn = digitsOnlyAbn(String(body.abn ?? ""));
    const persist = Boolean(body.persist);
    if (!abn) return jsonResponse({ ok: false, error: "ABN must be 11 digits." }, 400);

    const guid = Deno.env.get("ABR_AUTHENTICATION_GUID")?.trim();
    if (!guid) {
      return jsonResponse(
        {
          ok: false,
          error: "ABR_AUTHENTICATION_GUID is not set. Register a free GUID at https://abr.business.gov.au/Tools/WebServices",
        },
        503
      );
    }

    const url =
      `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${encodeURIComponent(abn)}&guid=${encodeURIComponent(guid)}&callback=callback`;
    const res = await fetch(url, { headers: { Accept: "application/javascript, text/javascript, */*" } });
    if (!res.ok) {
      return jsonResponse({ ok: false, error: `ABR HTTP ${res.status}` }, 502);
    }
    const rawText = await res.text();
    let data: Record<string, unknown>;
    try {
      data = parseAbrJsonpOrJson(rawText);
    } catch {
      return jsonResponse(
        {
          ok: false,
          error: "ABR returned an unexpected response. Check ABR_AUTHENTICATION_GUID and try again.",
        },
        502
      );
    }
    const root = ((data as { AbnDetails?: Record<string, unknown> }).AbnDetails ?? data) as Record<string, unknown>;

    const abrMessage = str(root.Message);
    if (abrMessage) {
      return jsonResponse({ ok: false, error: abrMessage }, 400);
    }

    const orgName = pickOrganisationName(root);
    const addr = pickPhysicalAddress(root);
    const addressLine = formatAddressLine(addr);
    const entityDisplay =
      orgName && addressLine ? `${orgName} — ${addressLine}` : orgName || addressLine || null;

    const gst = gstFromRoot(root);
    const active = abnStatusActive(root);

    if (persist && active) {
      const admin = createClient(supabaseUrl, serviceKey);
      const { data: prof } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (prof?.role !== "driver") {
        return jsonResponse({ ok: false, error: "Driver profile required" }, 403);
      }
      const { error: up } = await admin
        .from("drivers")
        .update({
          abn,
          abn_entity_name: (entityDisplay ?? orgName) || null,
          abn_gst_registered: gst,
          abn_verified_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (up) throw up;
      await admin.from("compliance_audit_log").insert({
        actor_id: user.id,
        driver_id: user.id,
        action: "abn_verified",
        metadata: {
          abn,
          gst_registered: gst,
          organisation_name: orgName || null,
          address_line: addressLine || null,
        },
      });
    }

    return jsonResponse({
      ok: true,
      abn,
      entity_name: orgName || null,
      entity_display: entityDisplay,
      address_line: addressLine || null,
      gst_registered: gst,
      abn_active: active,
      raw_status: typeof root.AbnStatus === "string" ? root.AbnStatus : str((root.AbnStatus as { EntityStatus?: unknown })?.EntityStatus) || null,
    });
  } catch (e) {
    console.error("[abr-lookup-abn]", e);
    return jsonResponse({ ok: false, error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
