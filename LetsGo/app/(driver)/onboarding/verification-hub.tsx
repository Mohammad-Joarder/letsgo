import type { Href } from "expo-router";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { useDriverRegistrationFeatureFlags } from "@/hooks/useDriverRegistrationFeatureFlags";
import { resendSignupConfirmationEmail } from "@/lib/auth";

export default function DriverVerificationHubScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const { flags, refresh: refreshFlags } = useDriverRegistrationFeatureFlags();
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [resending, setResending] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setLoadingProfile(false);
      return;
    }
    setLoadingProfile(true);
    try {
      /* no-op: email status comes from auth user */
    } finally {
      setLoadingProfile(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  async function onResendEmail() {
    const email = user?.email?.trim();
    if (!email) {
      Alert.alert("Email", "No email on your account.");
      return;
    }
    setResending(true);
    try {
      await resendSignupConfirmationEmail(email);
      Alert.alert("Check your inbox", "We sent another confirmation message if your address is valid.");
    } catch (e) {
      Alert.alert("Could not resend", e instanceof Error ? e.message : "Try again later.");
    } finally {
      setResending(false);
    }
  }

  const showEmail = flags.driver_email_verification_gate;
  const emailOk = Boolean(user?.email_confirmed_at);

  if (!showEmail) {
    return (
      <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
        <View className="flex-1 justify-center bg-background px-6">
          <Text className="font-sora text-lg font-semibold text-text">Verification</Text>
          <Text className="font-inter mt-2 text-sm leading-6 text-textSecondary">
            Email confirmation is not required for your build. You can continue onboarding.
          </Text>
          <Button title="Back" className="mt-6" onPress={() => router.back()} />
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <ScrollView className="flex-1 bg-background px-6 pt-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <Pressable onPress={() => router.back()} className="mb-4 self-start py-2">
          <Text className="font-inter text-sm text-primary">← Back</Text>
        </Pressable>

        <Text className="font-sora-display text-2xl font-bold text-text">Email verification</Text>
        <Text className="font-inter mt-2 text-sm leading-6 text-textSecondary">
          Confirm your email with Supabase Auth before finishing driver onboarding when this gate is enabled.
        </Text>

        <View className="mt-2 flex-row flex-wrap gap-2">
          <Pressable onPress={() => void refreshFlags()} className="py-2">
            <Text className="font-inter text-xs text-primary">Refresh flags</Text>
          </Pressable>
          <Pressable onPress={() => void refreshProfile()} className="py-2">
            <Text className="font-inter text-xs text-primary">Refresh status</Text>
          </Pressable>
        </View>

        {loadingProfile ? (
          <View className="mt-8 items-center">
            <ActivityIndicator color="#00D4AA" />
          </View>
        ) : null}

        <Card className="mt-6">
          <Text className="font-inter text-xs font-bold uppercase text-textSecondary">Email</Text>
          <Text className="font-inter mt-2 text-sm text-text">
            Status:{" "}
            <Text className={emailOk ? "text-primary" : "text-error"}>{emailOk ? "Verified" : "Not verified"}</Text>
          </Text>
          <Text className="font-inter mt-2 text-xs leading-5 text-textSecondary">
            After you tap the link in your email, return here and tap Refresh status.
          </Text>
          {!emailOk ? (
            <Button
              title={resending ? "Sending…" : "Resend confirmation email"}
              variant="secondary"
              className="mt-4"
              loading={resending}
              onPress={() => void onResendEmail()}
            />
          ) : null}
        </Card>

        <Button title="Continue onboarding" className="mt-8" onPress={() => router.push("/(driver)/onboarding" as Href)} />
      </ScrollView>
    </SafeAreaWrapper>
  );
}
