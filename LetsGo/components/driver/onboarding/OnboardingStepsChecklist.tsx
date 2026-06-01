import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { useDriverRegistrationFeatureFlags } from "@/hooks/useDriverRegistrationFeatureFlags";
import {
  fetchOnboardingCompletionStatus,
  type OnboardingCompletionStatus,
} from "@/lib/driverOnboardingCompletion";
import { DRIVER_ONBOARDING_STEPS } from "@/lib/driverOnboardingSteps";

type Props = {
  /** Hide submit step from the checklist on the hub (optional). */
  includeSubmitStep?: boolean;
};

export function OnboardingStepsChecklist({ includeSubmitStep = true }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { flags: driverFf, loading: ffLoading } = useDriverRegistrationFeatureFlags();
  const [status, setStatus] = useState<OnboardingCompletionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      if (ffLoading) {
        setLoading(true);
        return;
      }
      let cancelled = false;
      setLoading(true);
      void fetchOnboardingCompletionStatus(user.id, {
        flags: driverFf,
        emailConfirmedAt: user.email_confirmed_at ?? null,
      }).then((s) => {
        if (!cancelled) {
          setStatus(s);
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [user?.id, user?.email_confirmed_at, ffLoading, driverFf])
  );

  const steps = includeSubmitStep
    ? DRIVER_ONBOARDING_STEPS
    : DRIVER_ONBOARDING_STEPS.filter((s) => s.step < 10);

  if (loading || ffLoading) {
    return (
      <Card className="items-center py-8">
        <ActivityIndicator color="#00D4AA" />
      </Card>
    );
  }

  const stepComplete = status?.stepComplete ?? {};
  const resumeStep = status?.firstIncompleteStep;
  const allComplete = status?.allComplete ?? false;

  return (
    <Card className="p-0">
      {allComplete && resumeStep == null ? (
        <View className="border-b border-border/60 px-4 py-3">
          <Text className="font-inter text-xs text-primary">All onboarding steps are complete</Text>
        </View>
      ) : null}
      {steps.map((item, index) => {
        const isComplete = Boolean(stepComplete[item.step]);
        const isResume = resumeStep === item.step;
        return (
          <Pressable
            key={item.slug}
            onPress={() => router.push(item.route as Href)}
            className={`flex-row items-center justify-between px-4 py-3.5 ${
              index < steps.length - 1 ? "border-b border-border/60" : ""
            }`}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.title}`}
          >
            <View className="flex-1 flex-row items-center gap-3 pr-3">
              <View
                className={`h-7 w-7 items-center justify-center rounded-full ${
                  isComplete ? "bg-primary/20" : isResume ? "bg-primary" : "bg-surface2"
                }`}
              >
                {isComplete ? (
                  <MaterialCommunityIcons name="check" size={16} color="#00D4AA" />
                ) : (
                  <Text
                    className={`font-inter text-xs font-bold ${isResume ? "text-background" : "text-textSecondary"}`}
                  >
                    {item.step}
                  </Text>
                )}
              </View>
              <View className="flex-1">
                <Text className="font-inter text-sm text-text">{item.title}</Text>
                {isResume ? (
                  <>
                    <Text className="font-inter mt-0.5 text-xs text-primary">Resume here</Text>
                    {status?.firstIncompleteHint ? (
                      <Text className="font-inter mt-1 text-xs leading-4 text-textSecondary">
                        {status.firstIncompleteHint}
                      </Text>
                    ) : null}
                  </>
                ) : !isComplete && !allComplete ? (
                  <Text className="font-inter mt-0.5 text-xs text-textSecondary">Incomplete</Text>
                ) : null}
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#8A94A6" />
          </Pressable>
        );
      })}
    </Card>
  );
}
