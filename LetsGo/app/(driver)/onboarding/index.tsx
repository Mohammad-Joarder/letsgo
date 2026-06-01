import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { useDriverRegistrationFeatureFlags } from "@/hooks/useDriverRegistrationFeatureFlags";
import { fetchOnboardingCompletionStatus } from "@/lib/driverOnboardingCompletion";
import { onboardingStepRoute } from "@/lib/driverOnboardingSteps";

export default function OnboardingIndex() {
  const router = useRouter();
  const { user } = useAuth();
  const { flags: driverFf, loading: ffLoading } = useDriverRegistrationFeatureFlags();

  useEffect(() => {
    if (ffLoading) return;
    let cancelled = false;
    void (async () => {
      let targetStep = 1;
      if (user?.id) {
        const status = await fetchOnboardingCompletionStatus(user.id, {
          flags: driverFf,
          emailConfirmedAt: user.email_confirmed_at ?? null,
        });
        targetStep = status.firstIncompleteStep ?? (status.stepComplete[10] ? 10 : 9);
      }
      if (!cancelled) {
        router.replace(onboardingStepRoute(targetStep) as Href);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, user?.id, user?.email_confirmed_at, ffLoading, driverFf]);

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="font-inter text-sm text-textSecondary">Resuming onboarding…</Text>
    </View>
  );
}
