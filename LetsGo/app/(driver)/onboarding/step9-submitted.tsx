import type { Href } from "expo-router";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Text } from "react-native";
import { OnboardingScreenShell } from "@/components/driver/onboarding/OnboardingScreenShell";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { useDriverRegistrationFeatureFlags } from "@/hooks/useDriverRegistrationFeatureFlags";
import {
  fetchOnboardingCompletionStatus,
  isOnboardingReadyToSubmitForReview,
} from "@/lib/driverOnboardingCompletion";
import { onboardingStepByNumber } from "@/lib/driverOnboardingSteps";
import { clearOnboardingProgress } from "@/lib/driverOnboardingProgress";
import { submitDriverOnboardingApplication } from "@/lib/driverOnboardingEdge";
import { supabase } from "@/lib/supabase";

export default function OnboardingStep9Submitted() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const { flags } = useDriverRegistrationFeatureFlags();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(true);
  const [readyToSubmit, setReadyToSubmit] = useState(false);
  const [resumeStep, setResumeStep] = useState<number | null>(null);
  const [submitGateHint, setSubmitGateHint] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);

  const refreshGate = useCallback(async () => {
    if (!user?.id) {
      setChecking(false);
      return;
    }
    setChecking(true);
    try {
      const [{ data: drv }, status] = await Promise.all([
        supabase.from("drivers").select("approval_status").eq("id", user.id).maybeSingle(),
        fetchOnboardingCompletionStatus(user.id, {
          flags,
          emailConfirmedAt: user.email_confirmed_at ?? null,
        }),
      ]);
      const st = typeof drv?.approval_status === "string" ? drv.approval_status : null;
      setApprovalStatus(st);
      if (st && st !== "pending") {
        setReadyToSubmit(false);
        setResumeStep(null);
        setSubmitGateHint(null);
        return;
      }
      setReadyToSubmit(isOnboardingReadyToSubmitForReview(status));
      setResumeStep(status.firstIncompleteStep);
      const step = status.firstIncompleteStep;
      setSubmitGateHint(
        status.firstIncompleteHint ??
          (step != null && step >= 1 && step <= 9
            ? `Complete step ${step} (${onboardingStepByNumber(step)?.title ?? "onboarding"}) before submitting.`
            : null)
      );
    } finally {
      setChecking(false);
    }
  }, [user?.id, user?.email_confirmed_at, flags]);

  useFocusEffect(
    useCallback(() => {
      void refreshGate();
    }, [refreshGate])
  );

  async function onSubmit() {
    if (!readyToSubmit) {
      Alert.alert("Not ready", "Complete every onboarding step and upload all required documents first.");
      return;
    }
    setLoading(true);
    try {
      const res = await submitDriverOnboardingApplication();
      if (!res.ok) {
        Alert.alert("Could not submit", res.error ?? "Check every step is complete and try again.");
        return;
      }
      await clearOnboardingProgress();
      await refreshProfile();
      setDone(true);
    } catch (e) {
      Alert.alert("Could not submit", e instanceof Error ? e.message : "Try again");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <OnboardingScreenShell
        title="You are all set"
        subtitle="Our team typically reviews applications within 24 hours. You will receive a push notification when your status changes."
        step={10}
        showHubLink={false}
        primaryTitle="Back to status"
        onPrimary={() => router.replace("/(driver)/onboarding-status" as Href)}
      >
        <Card>
          <Text className="font-inter text-sm leading-6 text-textSecondary">
            You can leave this screen — your submission is on file. If we need clearer photos, you will see a re-upload
            prompt on the status screen.
          </Text>
        </Card>
      </OnboardingScreenShell>
    );
  }

  const alreadyHandled =
    approvalStatus && approvalStatus !== "pending"
      ? `Your application is already ${approvalStatus.replace(/_/g, " ")}.`
      : null;

  return (
    <OnboardingScreenShell
      title="Submit application"
      subtitle="By submitting, you confirm the information you provided is accurate. False information may result in
      permanent suspension."
      step={10}
      primaryTitle={alreadyHandled ? "Back to status" : "Submit for review"}
      onPrimary={
        alreadyHandled
          ? () => router.replace("/(driver)/onboarding-status" as Href)
          : onSubmit
      }
      primaryLoading={alreadyHandled ? false : loading || checking}
      primaryDisabled={alreadyHandled ? false : loading || checking || !readyToSubmit}
    >
      {alreadyHandled ? (
        <Card className="mb-4 border border-border p-3">
          <Text className="font-inter text-sm leading-5 text-text">{alreadyHandled}</Text>
        </Card>
      ) : null}
      {!alreadyHandled && !readyToSubmit && submitGateHint ? (
        <Card className="mb-4 border border-primary/40 bg-primary/5 p-3">
          {resumeStep != null && resumeStep >= 1 && resumeStep <= 9 ? (
            <Text className="font-inter text-xs text-textSecondary">
              Step {resumeStep}: {onboardingStepByNumber(resumeStep)?.title ?? "Onboarding"}
            </Text>
          ) : null}
          <Text className={`font-inter text-sm leading-5 text-text ${resumeStep != null ? "mt-1" : ""}`}>
            {submitGateHint}
          </Text>
          <Text className="font-inter mt-2 text-xs leading-5 text-textSecondary">
            Required images are confirmed as soon as they upload. Open the onboarding hub to see which steps still need
            data.
          </Text>
        </Card>
      ) : null}
      {!alreadyHandled ? (
        <Card>
          <Text className="font-inter text-sm leading-6 text-textSecondary">
            After submission your status moves to Under review. You cannot drive until approved and Stripe onboarding is
            complete.
          </Text>
        </Card>
      ) : null}
    </OnboardingScreenShell>
  );
}
