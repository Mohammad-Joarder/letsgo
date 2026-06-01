import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import type { SignatureCaptureRef } from "@/components/driver/onboarding/SignatureCapture";
import { SignatureCapture } from "@/components/driver/onboarding/SignatureCapture";
import { OnboardingScreenShell } from "@/components/driver/onboarding/OnboardingScreenShell";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { saveOnboardingStep } from "@/lib/driverOnboardingProgress";
import { fetchDriverConsent, saveDriverConsent, uploadSignatureImage } from "@/lib/services/driver-onboarding";

const CONSENT_STEP = 7;
const NEXT_STEP_ROUTE = "/(driver)/onboarding/step7-bank" as Href;

const CONSENT_TEXT = `Background Check Consent

By checking the box and signing below, you consent to LetsGo Pty Ltd conducting a background check on your behalf. This check may include:

  • Criminal history check via a nationally coordinated service
  • Driving record check with relevant state/territory authority
  • Identity verification against government documents

Your information will be handled in accordance with the Australian Privacy Act 1988 and LetsGo's Privacy Policy. Results are used solely to assess your suitability as a driver on our platform.

This consent applies for the duration of your engagement with LetsGo. You may withdraw consent at any time by contacting support@letsgo.com.au, however withdrawal will result in suspension of your driver account.`;

export default function StepBackgroundConsent() {
  const router = useRouter();
  const { user } = useAuth();
  const sigRef = useRef<SignatureCaptureRef>(null);
  const [checked, setChecked] = useState(false);
  const [sigEmpty, setSigEmpty] = useState(true);
  const [loading, setLoading] = useState(false);
  const [boot, setBoot] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const existing = await fetchDriverConsent(user.id);
      if (existing) {
        setChecked(true);
      }
    } catch {
      // non-fatal — user can re-consent
    } finally {
      setBoot(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onNext() {
    if (!user?.id) return;
    if (!checked) {
      Alert.alert("Consent required", "Tick the checkbox to confirm your consent.");
      return;
    }
    if (sigRef.current?.isEmpty()) {
      Alert.alert("Signature required", "Please draw your signature in the box above.");
      return;
    }

    setLoading(true);
    try {
      let signatureStoragePath: string | null = null;
      const dataUri = sigRef.current?.toDataUri() ?? null;
      if (dataUri) {
        const { storagePath } = await uploadSignatureImage({
          driverId: user.id,
          imageUri: dataUri,
        });
        signatureStoragePath = storagePath;
      }

      await saveDriverConsent(user.id, {
        consentedAt: new Date().toISOString(),
        signatureStoragePath,
      });
      await saveOnboardingStep(CONSENT_STEP);
      router.push(NEXT_STEP_ROUTE);
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Try again");
    } finally {
      setLoading(false);
    }
  }

  if (boot || !user?.id) {
    return <View className="flex-1 bg-background" />;
  }

  return (
    <OnboardingScreenShell
      title="Background check"
      subtitle="Read the consent text carefully before signing."
      step={CONSENT_STEP}
      primaryTitle="Continue"
      onPrimary={onNext}
      primaryLoading={loading}
      primaryDisabled={!checked || sigEmpty}
    >
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card className="mb-4">
          <Text className="font-inter text-xs leading-6 text-textSecondary">{CONSENT_TEXT}</Text>
        </Card>

        {/* Consent checkbox */}
        <Pressable
          onPress={() => setChecked((v) => !v)}
          className="mb-6 flex-row items-start gap-3"
          hitSlop={8}
        >
          <View
            className={`mt-0.5 h-5 w-5 items-center justify-center rounded border-2 ${
              checked ? "border-primary bg-primary" : "border-border bg-surface2"
            }`}
          >
            {checked ? <Text className="text-xs font-bold text-background">✓</Text> : null}
          </View>
          <Text className="font-inter flex-1 text-sm leading-5 text-text">
            I have read and understood the consent above and agree to a background check being
            conducted.
          </Text>
        </Pressable>

        {/* Signature pad */}
        <Text className="font-inter mb-2 text-sm font-medium text-textSecondary">
          Your signature
        </Text>
        <SignatureCapture
          ref={sigRef}
          width={320}
          height={160}
          onChange={(isEmpty) => setSigEmpty(isEmpty)}
        />
        {sigEmpty ? (
          <Text className="font-inter mt-2 text-xs text-textSecondary">
            Draw your signature in the box above.
          </Text>
        ) : (
          <Text className="font-inter mt-2 text-xs text-primary">Signature captured.</Text>
        )}

        <View className="h-6" />
      </ScrollView>
    </OnboardingScreenShell>
  );
}
