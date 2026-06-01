import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { DocumentCaptureTile } from "@/components/driver/onboarding/DocumentCaptureTile";
import { OnboardingScreenShell } from "@/components/driver/onboarding/OnboardingScreenShell";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { useAuth } from "@/hooks/useAuth";
import { useDriverRegistrationFeatureFlags } from "@/hooks/useDriverRegistrationFeatureFlags";
import {
  expiryMeetsMinimumValidity,
  minExpiryDateFromToday,
  MIN_DOCUMENT_VALIDITY_MONTHS,
} from "@/lib/documentExpiry";
import { fetchOnboardingCompletionStatus } from "@/lib/driverOnboardingCompletion";
import { saveOnboardingStep } from "@/lib/driverOnboardingProgress";
import { supabase } from "@/lib/supabase";

export default function OnboardingStep4VehicleDocs() {
  const router = useRouter();
  const { user } = useAuth();
  const { flags } = useDriverRegistrationFeatureFlags();
  const [loading, setLoading] = useState(false);
  const [hasBoth, setHasBoth] = useState(false);
  const [insuranceExpiry, setInsuranceExpiry] = useState("");
  const [inspectionExpiry, setInspectionExpiry] = useState("");

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("drivers")
      .select("insurance_expiry, vehicle_inspection_expiry")
      .eq("id", user.id)
      .maybeSingle();
    if (data?.insurance_expiry) {
      setInsuranceExpiry(String(data.insurance_expiry).slice(0, 10));
    }
    if (data?.vehicle_inspection_expiry) {
      setInspectionExpiry(String(data.vehicle_inspection_expiry).slice(0, 10));
    }
  }, [user?.id]);

  const checkHasBoth = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    const { data: docs } = await supabase
      .from("driver_documents")
      .select("document_type")
      .eq("driver_id", user.id);
    const types = new Set((docs ?? []).map((r: { document_type: string }) => r.document_type));
    const ok =
      types.has("vehicle_registration") &&
      types.has("insurance") &&
      (!flags.driver_vehicle_docs_enhanced || types.has("vehicle_inspection"));
    setHasBoth(ok);
    return ok;
  }, [user?.id, flags.driver_vehicle_docs_enhanced]);

  const syncProgress = useCallback(async () => {
    if (!user?.id) return;
    await fetchOnboardingCompletionStatus(user.id, {
      flags,
      emailConfirmedAt: user.email_confirmed_at ?? null,
    });
  }, [user?.id, user?.email_confirmed_at, flags]);

  async function afterDocUpload() {
    await checkHasBoth();
    await syncProgress();
  }

  useEffect(() => {
    void load();
    void checkHasBoth();
  }, [load, checkHasBoth]);

  async function onNext() {
    if (!user?.id) return;
    const ok = await checkHasBoth();
    if (!ok) {
      Alert.alert("Documents required", "Upload registration, insurance, and inspection (if required) before continuing.");
      return;
    }
    const expiry = insuranceExpiry.trim();
    const insuranceExpiryCheck = expiryMeetsMinimumValidity(expiry);
    if (!insuranceExpiryCheck.ok) {
      Alert.alert("Insurance expiry", insuranceExpiryCheck.error);
      return;
    }
    if (flags.driver_vehicle_docs_enhanced) {
      const insp = inspectionExpiry.trim();
      const inspCheck = expiryMeetsMinimumValidity(insp, 0);
      if (!inspCheck.ok) {
        Alert.alert("Inspection expiry", inspCheck.error);
        return;
      }
    }
    setLoading(true);
    try {
      const patch: { insurance_expiry: string; vehicle_inspection_expiry?: string } = {
        insurance_expiry: expiry,
      };
      if (flags.driver_vehicle_docs_enhanced) {
        patch.vehicle_inspection_expiry = inspectionExpiry.trim();
      }
      const { error } = await supabase.from("drivers").update(patch).eq("id", user.id);
      if (error) throw error;
      await saveOnboardingStep(5);
      router.push("/(driver)/onboarding/step5-vehicle-photo" as Href);
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Try again");
    } finally {
      setLoading(false);
    }
  }

  if (!user?.id) return <View className="flex-1 bg-background" />;

  const inspOk = !flags.driver_vehicle_docs_enhanced || inspectionExpiry.trim().length >= 10;

  return (
    <OnboardingScreenShell
      title="Vehicle paperwork"
      subtitle={`Registration and insurance documents required. Insurance must be valid for more than ${MIN_DOCUMENT_VALIDITY_MONTHS} months.`}
      step={4}
      primaryTitle="Continue"
      onPrimary={onNext}
      primaryLoading={loading}
      primaryDisabled={!hasBoth || insuranceExpiry.trim().length < 10 || !inspOk}
    >
      <DatePickerField
        label="Insurance expiry"
        value={insuranceExpiry}
        onChange={setInsuranceExpiry}
        minimumDate={minExpiryDateFromToday(MIN_DOCUMENT_VALIDITY_MONTHS)}
        placeholder="More than 6 months remaining"
      />
      {flags.driver_vehicle_docs_enhanced ? (
        <DatePickerField
          label="Vehicle inspection certificate expiry"
          value={inspectionExpiry}
          onChange={setInspectionExpiry}
          minimumDate={minExpiryDateFromToday(0)}
          placeholder="Must not be in the past"
        />
      ) : null}
      <DocumentCaptureTile
        driverId={user.id}
        documentType="vehicle_registration"
        label="Vehicle registration (CPV or state reg)"
        onUploaded={() => void afterDocUpload()}
      />
      <DocumentCaptureTile
        driverId={user.id}
        documentType="insurance"
        label="Insurance certificate"
        onUploaded={() => void afterDocUpload()}
      />
      {flags.driver_vehicle_docs_enhanced ? (
        <DocumentCaptureTile
          driverId={user.id}
          documentType="vehicle_inspection"
          label="Vehicle inspection certificate"
          onUploaded={() => void afterDocUpload()}
        />
      ) : null}
    </OnboardingScreenShell>
  );
}
