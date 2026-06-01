import { isStoredExpiryValid, isStoredLicenseFirstIssueValid } from "@/lib/documentExpiry";
import {
  DEFAULT_DRIVER_REGISTRATION_FEATURE_FLAGS,
  type DriverRegistrationFeatureFlags,
} from "@/lib/driverRegistrationFeatureFlags";
import { saveOnboardingStep } from "@/lib/driverOnboardingProgress";
import { supabase } from "@/lib/supabase";
import { fetchDriverConsent } from "@/lib/services/driver-onboarding";

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function validBsb(raw: string | null | undefined): boolean {
  return digitsOnly(String(raw ?? "")).length === 6;
}

function validAccountNumber(raw: string | null | undefined): boolean {
  const n = digitsOnly(String(raw ?? "")).length;
  return n >= 5 && n <= 12;
}

export type OnboardingCompletionStatus = {
  /** Per step (1–9) whether requirements are satisfied. */
  stepComplete: Record<number, boolean>;
  /** First step that still needs work; null when steps 1–8 are done. */
  firstIncompleteStep: number | null;
  allComplete: boolean;
  /** Human-readable reason for `firstIncompleteStep` (when 1–9). */
  firstIncompleteHint: string | null;
};

export type OnboardingCompletionGateContext = {
  flags: DriverRegistrationFeatureFlags;
  /** Supabase Auth `user.email_confirmed_at` (ISO string) when available. */
  emailConfirmedAt: string | null | undefined;
};

export async function fetchOnboardingCompletionStatus(
  driverId: string,
  gate?: OnboardingCompletionGateContext
): Promise<OnboardingCompletionStatus> {
  const flags = gate?.flags ?? DEFAULT_DRIVER_REGISTRATION_FEATURE_FLAGS;
  const emailConfirmedAt = gate?.emailConfirmedAt;

  const [{ data: prof }, { data: drv }, { data: veh }, { data: docs }, consentRecord] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("id", driverId)
        .maybeSingle(),
      supabase
        .from("drivers")
        .select(
          "license_number, license_expiry, license_first_issued, insurance_expiry, bank_bsb, bank_account_number, approval_status, abn_verified_at, vehicle_inspection_expiry"
        )
        .eq("id", driverId)
        .maybeSingle(),
      supabase
        .from("vehicles")
        .select("make, model, plate_number")
        .eq("driver_id", driverId)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("driver_documents")
        .select("document_type, is_verified, rejection_reason")
        .eq("driver_id", driverId),
      fetchDriverConsent(driverId).catch(() => null),
    ]);

  const docTypes = new Set<string>();
  const rejectedTypes = new Set<string>();
  for (const d of docs ?? []) {
    docTypes.add(d.document_type);
    if (d.rejection_reason && !d.is_verified) {
      rejectedTypes.add(d.document_type);
    }
  }

  const hasDoc = (t: string) => docTypes.has(t) && !rejectedTypes.has(t);

  const plate = typeof veh?.plate_number === "string" ? veh.plate_number.trim().toUpperCase() : "";
  const vehicleOk =
    Boolean(veh?.make?.trim()) &&
    Boolean(veh?.model?.trim()) &&
    plate.length >= 2 &&
    plate !== "PENDING";

  const emailGateOk = !flags.driver_email_verification_gate || Boolean(emailConfirmedAt);
  const abnOk = !flags.driver_abn_validation || Boolean(drv?.abn_verified_at);
  const inspectionOk =
    !flags.driver_vehicle_docs_enhanced ||
    (hasDoc("vehicle_inspection") && isStoredExpiryValid(drv?.vehicle_inspection_expiry, 0));

  const consentOk = Boolean(consentRecord?.consented_at);

  const stepComplete: Record<number, boolean> = {
    1:
      Boolean(prof?.full_name?.trim() && prof?.email?.trim() && prof?.phone?.trim()) && emailGateOk,
    2:
      (drv?.license_number?.trim().length ?? 0) >= 4 &&
      isStoredExpiryValid(drv?.license_expiry) &&
      isStoredLicenseFirstIssueValid(drv?.license_first_issued) &&
      hasDoc("license_front") &&
      hasDoc("license_back"),
    3: vehicleOk && abnOk,
    4: hasDoc("vehicle_registration") && hasDoc("insurance") && isStoredExpiryValid(drv?.insurance_expiry) && inspectionOk,
    5: hasDoc("vehicle_photo"),
    6: hasDoc("profile_photo") && hasDoc("driver_selfie"),
    7: consentOk,
    8: validBsb(drv?.bank_bsb) && validAccountNumber(drv?.bank_account_number),
    9: false,
    10: drv?.approval_status === "under_review" || drv?.approval_status === "approved",
  };

  stepComplete[9] =
    stepComplete[1] &&
    stepComplete[2] &&
    stepComplete[3] &&
    stepComplete[4] &&
    stepComplete[5] &&
    stepComplete[6] &&
    stepComplete[7] &&
    stepComplete[8];

  let firstIncompleteStep: number | null = null;
  for (let s = 1; s <= 9; s++) {
    if (!stepComplete[s]) {
      firstIncompleteStep = s;
      break;
    }
  }
  if (firstIncompleteStep === null && !stepComplete[10] && drv?.approval_status === "pending") {
    firstIncompleteStep = 10;
  }

  let firstIncompleteHint: string | null = null;
  if (firstIncompleteStep != null && firstIncompleteStep >= 1 && firstIncompleteStep <= 9) {
    const s = firstIncompleteStep;
    if (s === 1) {
      firstIncompleteHint =
        "Complete personal details on step 1 (and confirm your email if that gate is enabled).";
    } else if (s === 2) {
      firstIncompleteHint =
        "Finish the Driver licence step: both licence photos, licence number, expiry, first issue date (4a), and minimum validity rules.";
    } else if (s === 3) {
      if (!vehicleOk) {
        firstIncompleteHint =
          "Vehicle step: enter make, model, colour, year, and a real plate number (not “PENDING”), then save.";
      } else if (flags.driver_abn_validation && !Boolean(drv?.abn_verified_at)) {
        firstIncompleteHint =
          "Vehicle step: validate your ABN with “Validate / save ABN” so it shows as verified. If that button failed before, try again after a moment — the ABR connection must succeed.";
      } else {
        firstIncompleteHint = "Finish the Vehicle step (details + any required ABN checks).";
      }
    } else if (s === 4) {
      firstIncompleteHint =
        "Vehicle documents step: upload registration and insurance, set dates, and inspection certificate if your account requires it.";
    } else if (s === 5) {
      firstIncompleteHint = "Upload a clear vehicle exterior photo on step 5.";
    } else if (s === 6) {
      firstIncompleteHint = "Profile step: upload your profile face photo and your driver selfie.";
    } else if (s === 7) {
      firstIncompleteHint = "Complete the background check consent on step 7.";
    } else if (s === 8) {
      firstIncompleteHint = "Enter a valid Australian BSB and account number on the Bank step.";
    }
  }

  const allComplete = firstIncompleteStep === null;

  if (firstIncompleteStep != null) {
    await saveOnboardingStep(firstIncompleteStep);
  } else if (stepComplete[10]) {
    await saveOnboardingStep(10);
  } else {
    await saveOnboardingStep(9);
  }

  return { stepComplete, firstIncompleteStep, allComplete, firstIncompleteHint };
}

/**
 * True when steps 1–8 are satisfied and the application is still `pending` — driver may open Submit (step 10).
 * Matches `fetchOnboardingCompletionStatus` logic where the next action is final submission.
 */
export function isOnboardingReadyToSubmitForReview(status: OnboardingCompletionStatus): boolean {
  return status.firstIncompleteStep === 10;
}
