import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { DocumentCaptureTile } from "@/components/driver/onboarding/DocumentCaptureTile";
import { OnboardingScreenShell } from "@/components/driver/onboarding/OnboardingScreenShell";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { useAuth } from "@/hooks/useAuth";
import { useDriverRegistrationFeatureFlags } from "@/hooks/useDriverRegistrationFeatureFlags";
import {
  expiryMeetsMinimumValidity,
  formatIsoDateLocal,
  licenseFirstIssueMeetsMinimumHeld,
  maxLicenseFirstIssueDate,
  minExpiryDateFromToday,
  minLicenseFirstIssuePickerDate,
  MIN_DOCUMENT_VALIDITY_MONTHS,
  MIN_LICENSE_HELD_MONTHS,
} from "@/lib/documentExpiry";
import { fetchOnboardingCompletionStatus } from "@/lib/driverOnboardingCompletion";
import { saveOnboardingStep } from "@/lib/driverOnboardingProgress";
import { supabase } from "@/lib/supabase";

export default function OnboardingStep2License() {
  const router = useRouter();
  const { user } = useAuth();
  const { flags } = useDriverRegistrationFeatureFlags();
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [licenseFirstIssued, setLicenseFirstIssued] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasLicencePhotos, setHasLicencePhotos] = useState(false);
  const [abnVerifiedAt, setAbnVerifiedAt] = useState<string | null>(null);
  const [abnEntityName, setAbnEntityName] = useState<string | null>(null);

  const syncProgress = useCallback(async () => {
    if (!user?.id) return;
    await fetchOnboardingCompletionStatus(user.id, {
      flags,
      emailConfirmedAt: user.email_confirmed_at ?? null,
    });
  }, [user?.id, user?.email_confirmed_at, flags]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [{ data }, { data: docs }] = await Promise.all([
      supabase
        .from("drivers")
        .select("license_number, license_expiry, license_first_issued, abn_verified_at, abn_entity_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("driver_documents").select("document_type").eq("driver_id", user.id),
    ]);
    if (data) {
      setLicenseNumber(data.license_number ?? "");
      setLicenseExpiry(data.license_expiry ? String(data.license_expiry).slice(0, 10) : "");
      setLicenseFirstIssued(data.license_first_issued ? String(data.license_first_issued).slice(0, 10) : "");
      setAbnVerifiedAt(data.abn_verified_at ? String(data.abn_verified_at) : null);
      setAbnEntityName(typeof data.abn_entity_name === "string" ? data.abn_entity_name : null);
    }
    const types = new Set((docs ?? []).map((r: { document_type: string }) => r.document_type));
    setHasLicencePhotos(types.has("license_front") && types.has("license_back"));
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function afterLicenceDocUpload() {
    await load();
    await syncProgress();
  }

  async function onNext() {
    if (!user?.id) return;
    if (licenseNumber.trim().length < 4) {
      Alert.alert("License number", "Enter a valid licence number.");
      return;
    }
    const { data: docs } = await supabase
      .from("driver_documents")
      .select("document_type")
      .eq("driver_id", user.id);
    const types = new Set((docs ?? []).map((r: { document_type: string }) => r.document_type));
    if (!types.has("license_front") || !types.has("license_back")) {
      Alert.alert("Photos required", "Upload both the front and back of your licence.");
      return;
    }
    const expiry = licenseExpiry.trim();
    const licenceExpiryCheck = expiryMeetsMinimumValidity(expiry);
    if (!licenceExpiryCheck.ok) {
      Alert.alert("Licence expiry", licenceExpiryCheck.error);
      return;
    }
    const issueCheck = licenseFirstIssueMeetsMinimumHeld(licenseFirstIssued.trim());
    if (!issueCheck.ok) {
      Alert.alert("First issue date", issueCheck.error);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("drivers")
        .update({
          license_number: licenseNumber.trim().toUpperCase(),
          license_expiry: expiry,
          license_first_issued: licenseFirstIssued.trim(),
        })
        .eq("id", user.id);
      if (error) throw error;
      await saveOnboardingStep(3);
      router.push("/(driver)/onboarding/step3-vehicle" as Href);
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Try again");
    } finally {
      setLoading(false);
    }
  }

  if (!user?.id) return <View className="flex-1 bg-background" />;

  const issueMax = maxLicenseFirstIssueDate(MIN_LICENSE_HELD_MONTHS);
  const issueOk =
    licenseFirstIssued.trim().length >= 10 && licenseFirstIssueMeetsMinimumHeld(licenseFirstIssued.trim()).ok;

  return (
    <OnboardingScreenShell
      title="Driver licence"
      subtitle={`Upload clear photos of both sides. Licence must stay valid for at least ${MIN_DOCUMENT_VALIDITY_MONTHS} months, and your first issue date must show you have been licensed for at least ${MIN_LICENSE_HELD_MONTHS} months.`}
      step={2}
      primaryTitle="Continue"
      onPrimary={onNext}
      primaryLoading={loading}
      primaryDisabled={
        !licenseNumber.trim() || licenseExpiry.trim().length < 10 || !hasLicencePhotos || !issueOk
      }
    >
      <Card className="mb-4 border border-primary/50 bg-primary/10 p-4">
        <Text className="font-inter text-sm font-bold text-primary">Required: {MIN_LICENSE_HELD_MONTHS} months driving history</Text>
        <Text className="font-inter mt-2 text-xs leading-5 text-textSecondary">
          Enter the date your licence was <Text className="font-semibold text-text">first issued</Text> (Australian
          licences: field <Text className="font-semibold text-text">4a</Text>). That date must be on or before{" "}
          <Text className="font-semibold text-text">{formatIsoDateLocal(issueMax)}</Text> so you have held a valid
          licence for at least {MIN_LICENSE_HELD_MONTHS} months before driving with Lets Go.
        </Text>
      </Card>
      {flags.driver_abn_validation && abnEntityName ? (
        <Text className="font-inter -mt-2 mb-3 text-xs leading-5 text-textSecondary">
          ABR entity on file: {abnEntityName}
          {abnVerifiedAt ? " (verified)" : ""}
        </Text>
      ) : null}
      <Input
        label="Licence number"
        value={licenseNumber}
        onChangeText={setLicenseNumber}
        autoCapitalize="characters"
        placeholder="e.g. 12345678"
      />
      <DatePickerField
        label="Licence first issued (4a)"
        value={licenseFirstIssued}
        onChange={setLicenseFirstIssued}
        minimumDate={minLicenseFirstIssuePickerDate()}
        maximumDate={issueMax}
        defaultEmptyPicker="max"
        placeholder={`On or before ${formatIsoDateLocal(issueMax)}`}
      />
      <DatePickerField
        label="Licence expiry"
        value={licenseExpiry}
        onChange={setLicenseExpiry}
        minimumDate={minExpiryDateFromToday(MIN_DOCUMENT_VALIDITY_MONTHS)}
        placeholder="At least 6 months remaining"
      />
      <DocumentCaptureTile
        driverId={user.id}
        documentType="license_front"
        label="Licence — front"
        onUploaded={() => void afterLicenceDocUpload()}
      />
      <DocumentCaptureTile
        driverId={user.id}
        documentType="license_back"
        label="Licence — back"
        onUploaded={() => void afterLicenceDocUpload()}
      />
    </OnboardingScreenShell>
  );
}
