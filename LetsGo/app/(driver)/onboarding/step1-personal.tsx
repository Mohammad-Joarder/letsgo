import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { OnboardingScreenShell } from "@/components/driver/onboarding/OnboardingScreenShell";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { useDriverRegistrationFeatureFlags } from "@/hooks/useDriverRegistrationFeatureFlags";
import { saveOnboardingStep } from "@/lib/driverOnboardingProgress";
import { supabase } from "@/lib/supabase";

export default function OnboardingStep1Personal() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const { flags } = useDriverRegistrationFeatureFlags();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [boot, setBoot] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("profiles").select("full_name, email, phone").eq("id", user.id).maybeSingle();
    if (data) {
      setFullName(data.full_name ?? "");
      setEmail(data.email ?? "");
      setPhone(data.phone ?? "");
    }
    setBoot(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function persistProfile(): Promise<void> {
    if (!user?.id) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      })
      .eq("id", user.id);
    if (error) throw error;
  }

  async function onNext() {
    if (!user?.id) return;
    setLoading(true);
    try {
      await persistProfile();
      await refreshProfile();
      await saveOnboardingStep(2);
      router.push("/(driver)/onboarding/step2-license" as Href);
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Try again");
    } finally {
      setLoading(false);
    }
  }

  const emailGate = flags.driver_email_verification_gate;
  const emailOk = Boolean(user?.email_confirmed_at);
  const showVerifyBanner = emailGate && !emailOk;

  if (boot) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#00D4AA" />
      </View>
    );
  }

  return (
    <OnboardingScreenShell
      title="Personal details"
      subtitle="Confirm the information on your account. These details appear to riders after you are approved."
      step={1}
      primaryTitle="Continue"
      onPrimary={onNext}
      primaryLoading={loading}
      primaryDisabled={!fullName.trim() || !email.trim() || !phone.trim() || (emailGate && !emailOk)}
    >
      <Input label="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Input label="Mobile" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      {showVerifyBanner ? (
        <Pressable
          onPress={() => router.push("/(driver)/onboarding/verification-hub" as Href)}
          className="mt-4 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3"
        >
          <Text className="font-inter text-sm font-semibold text-primary">Email verification required</Text>
          <Text className="font-inter mt-1 text-xs leading-5 text-textSecondary">
            Confirm your email, then return here and tap Continue. Tap for status and resend.
          </Text>
        </Pressable>
      ) : null}
    </OnboardingScreenShell>
  );
}
