import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { DocumentCaptureTile } from "@/components/driver/onboarding/DocumentCaptureTile";
import { OnboardingScreenShell } from "@/components/driver/onboarding/OnboardingScreenShell";
import { useAuth } from "@/hooks/useAuth";
import { useDriverRegistrationFeatureFlags } from "@/hooks/useDriverRegistrationFeatureFlags";
import { fetchOnboardingCompletionStatus } from "@/lib/driverOnboardingCompletion";
import { saveOnboardingStep } from "@/lib/driverOnboardingProgress";
import { supabase } from "@/lib/supabase";

export default function OnboardingStep6ProfilePhoto() {
  const router = useRouter();
  const { user } = useAuth();
  const { flags } = useDriverRegistrationFeatureFlags();
  const [loading, setLoading] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasSelfie, setHasSelfie] = useState(false);

  const checkPhoto = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    const { data } = await supabase
      .from("driver_documents")
      .select("id")
      .eq("driver_id", user.id)
      .eq("document_type", "profile_photo")
      .maybeSingle();
    const ok = Boolean(data);
    setHasPhoto(ok);
    return ok;
  }, [user?.id]);

  const checkSelfie = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("driver_documents")
      .select("id")
      .eq("driver_id", user.id)
      .eq("document_type", "driver_selfie")
      .maybeSingle();
    setHasSelfie(Boolean(data));
  }, [user?.id]);

  const syncProgress = useCallback(async () => {
    if (!user?.id) return;
    await fetchOnboardingCompletionStatus(user.id, {
      flags,
      emailConfirmedAt: user.email_confirmed_at ?? null,
    });
  }, [user?.id, user?.email_confirmed_at, flags]);

  async function afterProfilePhotoUpload() {
    await checkPhoto();
    await syncProgress();
  }

  async function afterSelfieUpload() {
    await checkSelfie();
    await syncProgress();
  }

  useEffect(() => {
    void checkPhoto();
    void checkSelfie();
  }, [checkPhoto, checkSelfie]);

  async function onNext() {
    if (!user?.id) return;
    const ok = await checkPhoto();
    if (!ok) {
      Alert.alert("Photo required", "Upload a clear face photo before continuing.");
      return;
    }
    const { data: selfieRow } = await supabase
      .from("driver_documents")
      .select("id")
      .eq("driver_id", user.id)
      .eq("document_type", "driver_selfie")
      .maybeSingle();
    if (!selfieRow) {
      Alert.alert("Selfie required", "Upload a driver selfie for safety verification. An admin will review it with your licence.");
      return;
    }
    setHasSelfie(true);
    setLoading(true);
    try {
      await saveOnboardingStep(7);
      router.push("/(driver)/onboarding/step7-bank" as Href);
    } finally {
      setLoading(false);
    }
  }

  if (!user?.id) return <View className="flex-1 bg-background" />;

  return (
    <OnboardingScreenShell
      title="Profile photo"
      subtitle="A clear head-and-shoulders photo — used for verification and shown to riders after approval."
      step={6}
      primaryTitle="Continue"
      onPrimary={onNext}
      primaryLoading={loading}
      primaryDisabled={!hasPhoto || !hasSelfie}
    >
      <DocumentCaptureTile
        driverId={user.id}
        documentType="profile_photo"
        label="Face photo (profile)"
        onUploaded={() => void afterProfilePhotoUpload()}
      />
      <View className="mb-4">
        <Text className="font-inter mb-2 text-xs leading-5 text-textSecondary">
          Upload a live selfie. We do not run automatic face matching; an admin compares it to your licence during
          approval.
        </Text>
        <DocumentCaptureTile
          driverId={user.id}
          documentType="driver_selfie"
          label="Driver selfie"
          onUploaded={() => void afterSelfieUpload()}
        />
      </View>
    </OnboardingScreenShell>
  );
}
