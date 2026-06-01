import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { DocumentCaptureTile } from "@/components/driver/onboarding/DocumentCaptureTile";
import { OnboardingScreenShell } from "@/components/driver/onboarding/OnboardingScreenShell";
import { useAuth } from "@/hooks/useAuth";
import { useDriverRegistrationFeatureFlags } from "@/hooks/useDriverRegistrationFeatureFlags";
import { fetchOnboardingCompletionStatus } from "@/lib/driverOnboardingCompletion";
import { saveOnboardingStep } from "@/lib/driverOnboardingProgress";
import { supabase } from "@/lib/supabase";

export default function OnboardingStep5VehiclePhoto() {
  const router = useRouter();
  const { user } = useAuth();
  const { flags } = useDriverRegistrationFeatureFlags();
  const [loading, setLoading] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);

  const checkPhoto = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    const { data } = await supabase
      .from("driver_documents")
      .select("id")
      .eq("driver_id", user.id)
      .eq("document_type", "vehicle_photo")
      .maybeSingle();
    const ok = Boolean(data);
    setHasPhoto(ok);
    return ok;
  }, [user?.id]);

  const syncProgress = useCallback(async () => {
    if (!user?.id) return;
    await fetchOnboardingCompletionStatus(user.id, {
      flags,
      emailConfirmedAt: user.email_confirmed_at ?? null,
    });
  }, [user?.id, user?.email_confirmed_at, flags]);

  async function afterVehiclePhotoUpload() {
    await checkPhoto();
    await syncProgress();
  }

  useEffect(() => {
    void checkPhoto();
  }, [checkPhoto]);

  async function onNext() {
    if (!user?.id) return;
    const ok = await checkPhoto();
    if (!ok) {
      Alert.alert("Photo required", "Upload a vehicle photo before continuing.");
      return;
    }
    setLoading(true);
    try {
      await saveOnboardingStep(6);
      router.push("/(driver)/onboarding/step6-profile-photo" as Href);
    } finally {
      setLoading(false);
    }
  }

  if (!user?.id) return <View className="flex-1 bg-background" />;

  return (
    <OnboardingScreenShell
      title="Vehicle photo"
      subtitle="A clear side-on photo of the full vehicle helps riders find you at pickup."
      step={5}
      primaryTitle="Continue"
      onPrimary={onNext}
      primaryLoading={loading}
      primaryDisabled={!hasPhoto}
    >
      <DocumentCaptureTile
        driverId={user.id}
        documentType="vehicle_photo"
        label="Vehicle exterior"
        onUploaded={() => void afterVehiclePhotoUpload()}
      />
    </OnboardingScreenShell>
  );
}
