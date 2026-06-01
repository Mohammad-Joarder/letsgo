import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareView } from "@/components/shared/KeyboardAwareView";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";
import {
  DRIVER_ONBOARDING_HUB_ROUTE,
  DRIVER_ONBOARDING_TOTAL_STEPS,
  previousOnboardingStepRoute,
} from "@/lib/driverOnboardingSteps";

type Props = {
  title: string;
  subtitle?: string;
  step: number;
  totalSteps?: number;
  children: ReactNode;
  /** Override default back (previous step, or hub on step 1). */
  onBack?: () => void;
  /** Show link to driver application overview (default true). */
  showHubLink?: boolean;
  primaryTitle: string;
  onPrimary: () => void | Promise<void>;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
};

export function OnboardingScreenShell({
  title,
  subtitle,
  step,
  totalSteps = DRIVER_ONBOARDING_TOTAL_STEPS,
  children,
  onBack,
  showHubLink = true,
  primaryTitle,
  onPrimary,
  primaryLoading,
  primaryDisabled,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const prevRoute = previousOnboardingStepRoute(step);
  const canGoBack = Boolean(onBack ?? prevRoute ?? step === 1);

  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }
    if (prevRoute) {
      router.push(prevRoute);
      return;
    }
    router.push(DRIVER_ONBOARDING_HUB_ROUTE);
  }

  function goToHub() {
    router.push(DRIVER_ONBOARDING_HUB_ROUTE);
  }

  return (
    <SafeAreaWrapper edges={["top", "left", "right"]}>
      <KeyboardAwareView
        className="flex-1 bg-background"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 16) + 24,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View className="mb-4 flex-row items-center justify-between">
          {canGoBack ? (
            <Pressable onPress={handleBack} hitSlop={12} className="py-2">
              <Text className="font-inter text-sm text-primary">Back</Text>
            </Pressable>
          ) : (
            <View className="w-12" />
          )}
          <Text className="font-inter text-xs text-textSecondary">
            Step {step} / {totalSteps}
          </Text>
        </View>

        <View className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
          <View
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.round((step / totalSteps) * 100)}%` }}
          />
        </View>

        <Text className="font-sora mt-6 text-2xl font-bold text-text">{title}</Text>
        {subtitle ? (
          <Text className="font-inter mt-2 text-sm leading-5 text-textSecondary">{subtitle}</Text>
        ) : null}

        <View className="mt-6">{children}</View>

        <View className="mt-8">
          <Button
            title={primaryTitle}
            loading={primaryLoading}
            disabled={primaryDisabled}
            onPress={() => void onPrimary()}
          />
        </View>

        {showHubLink ? (
          <Pressable onPress={goToHub} hitSlop={12} className="mt-4 items-center py-2">
            <Text className="font-inter text-sm text-primary">Application overview</Text>
          </Pressable>
        ) : null}
      </KeyboardAwareView>
    </SafeAreaWrapper>
  );
}
