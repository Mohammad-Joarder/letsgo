import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareView } from "@/components/shared/KeyboardAwareView";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { requestPasswordReset } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Check your .env file.");
      return;
    }
    if (!email.trim()) {
      setError("Enter the email for your account.");
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send reset email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <KeyboardAwareView contentContainerClassName="px-8 pb-8 pt-4">
        <View className="mb-8">
          <Text className="font-sora-display text-3xl font-bold text-text">Reset password</Text>
          <Text className="font-inter mt-2 text-base text-textSecondary">
            We will email you a link to choose a new password (check spam).
          </Text>
        </View>

        {done ? (
          <View className="gap-6">
            <Text className="font-inter text-base leading-6 text-text">
              If an account exists for {email.trim()}, you will receive reset instructions shortly.
            </Text>
            <Button title="Back to sign in" variant="secondary" onPress={() => router.replace("/(auth)/sign-in")} />
          </View>
        ) : (
          <>
            <Input
              label="Email"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            {error ? <Text className="font-inter mb-4 text-sm text-error">{error}</Text> : null}
            <Button title="Send reset email" loading={loading} onPress={onSubmit} />
          </>
        )}

        <Link href="/(auth)/sign-in" asChild>
          <Pressable className="mt-8 self-center py-2">
            <Text className="font-inter text-sm text-primary">Back to sign in</Text>
          </Pressable>
        </Link>
      </KeyboardAwareView>
    </SafeAreaWrapper>
  );
}
