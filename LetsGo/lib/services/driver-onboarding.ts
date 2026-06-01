/**
 * Centralised Supabase calls for driver onboarding.
 * All screens should call these functions rather than querying inline.
 */

import { supabase } from "@/lib/supabase";
import type { DriverDocumentType } from "@/lib/types";

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function fetchDriverProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveDriverPersonalInfo(
  userId: string,
  params: { fullName: string; email: string; phone: string }
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: params.fullName.trim(),
      email: params.email.trim(),
      phone: params.phone.trim(),
    })
    .eq("id", userId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Driver row
// ---------------------------------------------------------------------------

export async function fetchDriverRow(driverId: string) {
  const { data, error } = await supabase
    .from("drivers")
    .select(
      "license_number, license_expiry, license_first_issued, license_ocr_completed_at, bank_bsb, bank_account_number, abn, abn_verified_at, abn_entity_name, abn_gst_registered, fraud_risk_level, vehicle_inspection_expiry"
    )
    .eq("id", driverId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveLicenseDetails(
  driverId: string,
  params: { licenseNumber: string; licenseExpiry: string; licenseFirstIssued: string }
): Promise<void> {
  const { error } = await supabase
    .from("drivers")
    .update({
      license_number: params.licenseNumber.trim().toUpperCase(),
      license_expiry: params.licenseExpiry,
      license_first_issued: params.licenseFirstIssued,
    })
    .eq("id", driverId);
  if (error) throw error;
}

export async function saveBankDetails(
  driverId: string,
  params: { bsb: string; accountNumber: string }
): Promise<void> {
  const bsbDigits = params.bsb.replace(/\D/g, "");
  const bsbFormatted = `${bsbDigits.slice(0, 3)}-${bsbDigits.slice(3)}`;
  const { error } = await supabase
    .from("drivers")
    .update({
      bank_bsb: bsbFormatted,
      bank_account_number: params.accountNumber.replace(/\D/g, ""),
    })
    .eq("id", driverId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Background check consent
// ---------------------------------------------------------------------------

export type ConsentRecord = {
  driver_id: string;
  consented_at: string;
  signature_storage_path: string | null;
};

export async function fetchDriverConsent(driverId: string): Promise<ConsentRecord | null> {
  const { data, error } = await supabase
    .from("driver_consents")
    .select("driver_id, consented_at, signature_storage_path")
    .eq("driver_id", driverId)
    .maybeSingle();
  if (error) throw error;
  return data as ConsentRecord | null;
}

export async function saveDriverConsent(
  driverId: string,
  params: { consentedAt: string; signatureStoragePath: string | null }
): Promise<void> {
  const { error } = await supabase.from("driver_consents").upsert(
    {
      driver_id: driverId,
      consented_at: params.consentedAt,
      signature_storage_path: params.signatureStoragePath,
    },
    { onConflict: "driver_id" }
  );
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export async function fetchDocumentTypes(driverId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("driver_documents")
    .select("document_type")
    .eq("driver_id", driverId);
  if (error) throw error;
  return new Set((data ?? []).map((r: { document_type: string }) => r.document_type));
}

// ---------------------------------------------------------------------------
// Signature image upload
// ---------------------------------------------------------------------------

const BUCKET = "driver-documents";

export async function uploadSignatureImage(params: {
  driverId: string;
  imageUri: string;
}): Promise<{ storagePath: string }> {
  const res = await fetch(params.imageUri);
  if (!res.ok) throw new Error("Could not read signature image.");
  const buf = await res.arrayBuffer();
  const storagePath = `${params.driverId}/signature/${Date.now()}.png`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buf, { contentType: "image/png", upsert: true });
  if (error) throw error;

  return { storagePath };
}

// ---------------------------------------------------------------------------
// Onboarding summary (for review step)
// ---------------------------------------------------------------------------

export type OnboardingSummary = {
  full_name: string | null;
  license_number: string | null;
  bank_bsb: string | null;
  vehicle: string | null;
  docCount: number;
  fraud_risk_level: string | null;
  consent_at: string | null;
};

export async function fetchOnboardingSummary(driverId: string): Promise<OnboardingSummary> {
  const [{ data: prof }, { data: drv }, { data: veh }, { data: docs }, { data: consent }] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", driverId).maybeSingle(),
      supabase
        .from("drivers")
        .select("license_number, bank_bsb, fraud_risk_level")
        .eq("id", driverId)
        .maybeSingle(),
      supabase
        .from("vehicles")
        .select("make, model, plate_number")
        .eq("driver_id", driverId)
        .eq("is_active", true)
        .maybeSingle(),
      supabase.from("driver_documents").select("id").eq("driver_id", driverId),
      supabase
        .from("driver_consents")
        .select("consented_at")
        .eq("driver_id", driverId)
        .maybeSingle(),
    ]);

  return {
    full_name: (prof as { full_name?: string | null } | null)?.full_name ?? null,
    license_number: (drv as { license_number?: string | null } | null)?.license_number ?? null,
    bank_bsb: (drv as { bank_bsb?: string | null } | null)?.bank_bsb ?? null,
    vehicle: veh
      ? `${(veh as { make?: string }).make ?? ""} ${(veh as { model?: string }).model ?? ""} · ${(veh as { plate_number?: string }).plate_number ?? ""}`.trim()
      : null,
    docCount: docs?.length ?? 0,
    fraud_risk_level:
      (drv as { fraud_risk_level?: string | null } | null)?.fraud_risk_level ?? null,
    consent_at:
      (consent as { consented_at?: string | null } | null)?.consented_at ?? null,
  };
}
