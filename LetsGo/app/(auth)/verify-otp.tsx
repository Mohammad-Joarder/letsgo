import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { KeyboardAwareView } from "@/components/shared/KeyboardAwareView";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { verifyEmailOtp } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const email = typeof emailParam === "string" ? emailParam : "";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Check your .env file.");
      return;
    }
    if (!email) {
      setError("Missing email. Go back and sign up again.");
      return;
    }
    if (code.replace(/\s/g, "").length < 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    try {
      await verifyEmailOtp(email, code);
      router.replace("/(auth)/role-select");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Invalid or expired code. Request a new code from the sign-up screen if needed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <KeyboardAwareView contentContainerClassName="px-8 pb-8 pt-4">
        <View className="mb-8">
          <Text className="font-sora-display text-3xl font-bold text-text">Confirm email</Text>
          <Text className="font-inter mt-2 text-base text-textSecondary">
            Enter the verification code we sent to{" "}
            <Text className="text-text">{email || "your email"}</Text>.
          </Text>
        </View>

        <Input
          label="Verification code"
          autoCapitalize="characters"
          keyboardType="number-pad"
          value={code}
          onChangeText={setCode}
          maxLength={8}
        />

        {error ? <Text className="font-inter mb-4 text-sm text-error">{error}</Text> : null}

        <Button title="Verify & continue" loading={loading} onPress={onSubmit} />

        <Text className="font-inter mt-6 text-center text-xs leading-5 text-textSecondary">
          Tip: In Supabase, enable email confirmations and use the OTP template so users receive a
          6-digit code. If you only use magic links, open the link on this device to complete
          verification.
        </Text>
      </KeyboardAwareView>
    </SafeAreaWrapper>
  );
}
