import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Lightweight duplicate / collision signals (service-role client only).
 */
export async function evaluateDriverFraud(
  admin: SupabaseClient,
  driverId: string
): Promise<{ level: "LOW" | "MEDIUM" | "HIGH"; notes: string }> {
  const { data: drv } = await admin
    .from("drivers")
    .select("license_number, abn")
    .eq("id", driverId)
    .maybeSingle();
  const { data: prof } = await admin.from("profiles").select("phone").eq("id", driverId).maybeSingle();

  let score = 0;
  const notes: string[] = [];

  const lic = typeof drv?.license_number === "string" ? drv.license_number.trim().toUpperCase() : "";
  if (lic.length >= 4) {
    const { count } = await admin
      .from("drivers")
      .select("id", { count: "exact", head: true })
      .neq("id", driverId)
      .eq("license_number", lic);
    if ((count ?? 0) > 0) {
      score += 2;
      notes.push("duplicate_license_number");
    }
  }

  const abn = typeof drv?.abn === "string" ? drv.abn.replace(/\D/g, "") : "";
  if (abn.length === 11) {
    const { count } = await admin
      .from("drivers")
      .select("id", { count: "exact", head: true })
      .neq("id", driverId)
      .eq("abn", abn);
    if ((count ?? 0) > 0) {
      score += 2;
      notes.push("duplicate_abn");
    }
  }

  const phone = typeof prof?.phone === "string" ? prof.phone.trim() : "";
  if (phone.length >= 8) {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .neq("id", driverId)
      .eq("phone", phone);
    if ((count ?? 0) > 0) {
      // Shared / family phones are common; staff still see the signal but it should not alone imply MEDIUM risk.
      score += 1;
      notes.push("duplicate_phone");
    }
  }

  const level: "LOW" | "MEDIUM" | "HIGH" = score >= 4 ? "HIGH" : score >= 2 ? "MEDIUM" : "LOW";
  const noteStr = notes.join(";");

  await admin.from("drivers").update({ fraud_risk_level: level, fraud_risk_notes: noteStr || null }).eq("id", driverId);

  if (notes.length > 0) {
    await admin.from("driver_fraud_signals").upsert(
      notes.map((n) => ({
        driver_id: driverId,
        signal_type: n,
        detail: null as string | null,
      })),
      { onConflict: "driver_id,signal_type" }
    );
  }

  return { level, notes: noteStr };
}
