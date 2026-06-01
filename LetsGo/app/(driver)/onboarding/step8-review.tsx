import type { Href } from "expo-router";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Text, View } from "react-native";
import { OnboardingScreenShell } from "@/components/driver/onboarding/OnboardingScreenShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { useDriverRegistrationFeatureFlags } from "@/hooks/useDriverRegistrationFeatureFlags";
import { edgeEvaluateFraud } from "@/lib/complianceEdgeCalls";
import {
  fetchOnboardingCompletionStatus,
  isOnboardingReadyToSubmitForReview,
} from "@/lib/driverOnboardingCompletion";
import { onboardingStepByNumber } from "@/lib/driverOnboardingSteps";
import { saveOnboardingStep } from "@/lib/driverOnboardingProgress";
import { supabase } from "@/lib/supabase";

type Summary = {
  full_name: string | null;
  license_number: string | null;
  bank_bsb: string | null;
  vehicle: string | null;
  docCount: number;
  fraud_risk_level: string | null;
};

function formatFraudScanAlertBody(level: string | undefined, notesRaw: string | undefined): string {
  const levelLine = `Risk level: ${level ?? "—"}`;
  const tokens = (notesRaw ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  if (tokens.length === 0) return levelLine;
  const lines = tokens.map((t) => {
    switch (t) {
      case "duplicate_phone":
        return "This phone number is already on another profile. We note it for staff review — it does not block submission by itself.";
      case "duplicate_license_number":
        return "This licence number matches another driver account — noted for staff review.";
      case "duplicate_abn":
        return "This ABN matches another driver account — noted for staff review.";
      default:
        return t;
    }
  });
  return `${levelLine}\n\n${lines.join("\n\n")}`;
}

export default function OnboardingStep8Review() {
  const router = useRouter();
  const { user, session } = useAuth();
  const { flags } = useDriverRegistrationFeatureFlags();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fraudBusy, setFraudBusy] = useState(false);
  const [readyToSubmit, setReadyToSubmit] = useState(false);
  const [resumeStep, setResumeStep] = useState<number | null>(null);
  const [submitGateHint, setSubmitGateHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [{ data: prof }, { data: drv }, { data: veh }, { data: docs }, status] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabase.from("drivers").select("license_number, bank_bsb, fraud_risk_level").eq("id", user.id).maybeSingle(),
      supabase
        .from("vehicles")
        .select("make, model, plate_number")
        .eq("driver_id", user.id)
        .eq("is_active", true)
        .maybeSingle(),
      supabase.from("driver_documents").select("id").eq("driver_id", user.id),
      fetchOnboardingCompletionStatus(user.id, {
        flags,
        emailConfirmedAt: user.email_confirmed_at ?? null,
      }),
    ]);
    const v = veh as { make?: string; model?: string; plate_number?: string } | null;
    setSummary({
      full_name: prof?.full_name ?? null,
      license_number: drv?.license_number ?? null,
      bank_bsb: drv?.bank_bsb ?? null,
      vehicle: v ? `${v.make ?? ""} ${v.model ?? ""} · ${v.plate_number ?? ""}` : null,
      docCount: docs?.length ?? 0,
      fraud_risk_level: (drv as { fraud_risk_level?: string | null } | null)?.fraud_risk_level ?? null,
    });
    setReadyToSubmit(isOnboardingReadyToSubmitForReview(status));
    setResumeStep(status.firstIncompleteStep);
    const step = status.firstIncompleteStep;
    setSubmitGateHint(
      status.firstIncompleteHint ??
        (step != null && step >= 1 && step <= 9
          ? `Finish step ${step} (${onboardingStepByNumber(step)?.title ?? "onboarding"}) before you can submit.`
          : null)
    );
    setLoading(false);
  }, [user?.id, user?.email_confirmed_at, flags]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  async function onFraud() {
    if (!session?.access_token) return;
    setFraudBusy(true);
    try {
      const res = (await edgeEvaluateFraud(session.access_token)) as {
        ok?: boolean;
        fraud_risk_level?: string;
        notes?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(res.error ?? "Fraud scan failed");
      await load();
      Alert.alert("Duplicate check", formatFraudScanAlertBody(res.fraud_risk_level, res.notes));
    } catch (e) {
      Alert.alert("Duplicate check", e instanceof Error ? e.message : "Failed");
    } finally {
      setFraudBusy(false);
    }
  }

  async function onNext() {
    if (!readyToSubmit) return;
    await saveOnboardingStep(10);
    router.push("/(driver)/onboarding/step9-submitted" as Href);
  }

  return (
    <OnboardingScreenShell
      title="Review"
      subtitle="Check that everything looks correct before you submit for human review."
      step={9}
      primaryTitle="Continue"
      onPrimary={onNext}
      primaryLoading={loading}
      primaryDisabled={loading || !summary || !readyToSubmit}
    >
      {!readyToSubmit && submitGateHint ? (
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
            All required photos and details must be on file. Uploaded images count as soon as they save — there is no
            automatic OCR or face check.
          </Text>
        </Card>
      ) : null}
      {flags.driver_fraud_detection ? (
        <View className="mb-4">
          <Button
            title={fraudBusy ? "Scanning…" : "Run duplicate / fraud signals scan"}
            variant="secondary"
            loading={fraudBusy}
            onPress={() => void onFraud()}
          />
          {summary?.fraud_risk_level ? (
            <Text className="font-inter mt-2 text-xs text-textSecondary">
              Current risk level: {summary.fraud_risk_level}
            </Text>
          ) : null}
        </View>
      ) : null}
      <Card className="mb-4">
        <Text className="font-inter text-xs font-bold uppercase text-textSecondary">Driver</Text>
        <Text className="font-inter mt-2 text-sm text-text">{summary?.full_name ?? "—"}</Text>
        <Text className="font-inter mt-1 text-xs text-textSecondary">
          Licence: {summary?.license_number ?? "—"}
        </Text>
        <Text className="font-inter mt-1 text-xs text-textSecondary">BSB on file: {summary?.bank_bsb ?? "—"}</Text>
      </Card>
      <Card className="mb-4">
        <Text className="font-inter text-xs font-bold uppercase text-textSecondary">Vehicle</Text>
        <Text className="font-inter mt-2 text-sm text-text">{summary?.vehicle ?? "—"}</Text>
      </Card>
      <Card>
        <Text className="font-inter text-xs font-bold uppercase text-textSecondary">Documents uploaded</Text>
        <Text className="font-inter mt-2 text-sm text-text">{summary?.docCount ?? 0} files</Text>
        <Text className="font-inter mt-2 text-xs leading-5 text-textSecondary">
          Submit is only available when every onboarding step is complete (including licence photos, profile photo,
          driver selfie, vehicle docs, ABN if required, and bank details). The server runs the same checks on submit.
        </Text>
      </Card>
    </OnboardingScreenShell>
  );
}
