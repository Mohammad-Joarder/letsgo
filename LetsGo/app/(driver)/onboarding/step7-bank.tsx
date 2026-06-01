import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Text } from "react-native";
import {
  NUMERIC_INPUT_ACCESSORY_ID,
  NumericKeyboardToolbar,
} from "@/components/driver/onboarding/NumericKeyboardToolbar";
import { OnboardingScreenShell } from "@/components/driver/onboarding/OnboardingScreenShell";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { saveOnboardingStep } from "@/lib/driverOnboardingProgress";
import { supabase } from "@/lib/supabase";

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function formatBsbDisplay(raw: string): string {
  const d = digitsOnly(raw).slice(0, 6);
  if (d.length <= 3) return d;
  return `${d.slice(0, 3)}-${d.slice(3)}`;
}

export default function OnboardingStep7Bank() {
  const router = useRouter();
  const { user } = useAuth();
  const [bsb, setBsb] = useState("");
  const [acct, setAcct] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("drivers").select("bank_bsb, bank_account_number").eq("id", user.id).maybeSingle();
    if (data?.bank_bsb) setBsb(formatBsbDisplay(String(data.bank_bsb)));
    if (data?.bank_account_number) setAcct(String(data.bank_account_number));
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onNext() {
    if (!user?.id) return;
    const bsbDigits = digitsOnly(bsb);
    const acctDigits = digitsOnly(acct);
    if (bsbDigits.length !== 6) {
      Alert.alert("BSB", "Enter a 6-digit Australian BSB (e.g. 110-000).");
      return;
    }
    if (acctDigits.length < 5 || acctDigits.length > 12) {
      Alert.alert("Account number", "Enter a valid account number.");
      return;
    }
    setLoading(true);
    try {
      const bsbFormatted = `${bsbDigits.slice(0, 3)}-${bsbDigits.slice(3)}`;
      const { error } = await supabase
        .from("drivers")
        .update({
          bank_bsb: bsbFormatted,
          bank_account_number: acctDigits,
        })
        .eq("id", user.id);
      if (error) throw error;
      await saveOnboardingStep(9);
      router.push("/(driver)/onboarding/step8-review" as Href);
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingScreenShell
      title="Bank details"
      subtitle="Used for payouts alongside Stripe Express. Your details are encrypted in transit and stored securely."
      step={8}
      primaryTitle="Continue"
      onPrimary={onNext}
      primaryLoading={loading}
      primaryDisabled={digitsOnly(bsb).length !== 6 || digitsOnly(acct).length < 5}
    >
      <Card className="mb-6 border border-border/80 bg-surface2/40 p-4">
        <Text className="font-inter text-xs leading-5 text-textSecondary">
          Primary payouts run through Stripe after you are approved. These bank fields satisfy onboarding checks and
          legacy records; Stripe will collect verified bank details during Connect onboarding.
        </Text>
      </Card>
      <NumericKeyboardToolbar />
      <Input
        label="BSB"
        value={bsb}
        onChangeText={(t) => setBsb(formatBsbDisplay(t))}
        keyboardType="number-pad"
        inputAccessoryViewID={NUMERIC_INPUT_ACCESSORY_ID}
        placeholder="110-000"
        maxLength={7}
      />
      <Input
        label="Account number"
        value={acct}
        onChangeText={setAcct}
        keyboardType="number-pad"
        inputAccessoryViewID={NUMERIC_INPUT_ACCESSORY_ID}
        placeholder="Account number"
      />
    </OnboardingScreenShell>
  );
}
