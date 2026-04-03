import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { AuthBrandHeader } from "@/components/branding/AuthBrandHeader";
import { KeyboardAwareView } from "@/components/shared/KeyboardAwareView";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signInWithEmail } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Check your .env file.");
      return;
    }
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <KeyboardAwareView contentContainerClassName="px-8 pb-8 pt-6">
        <AuthBrandHeader />
        <View className="mb-8">
          <Text className="font-sora-display text-3xl font-bold text-text">Welcome back</Text>
          <Text className="font-inter mt-2 text-base text-textSecondary">
            Sign in to book premium rides.
          </Text>
        </View>

        <Input
          label="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Input
          label="Password"
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text className="font-inter mb-4 text-sm text-error">{error}</Text> : null}

        <Button title="Sign In" loading={loading} onPress={onSubmit} />

        <Link href="/(auth)/forgot-password" asChild>
          <Pressable className="mt-4 self-center py-2">
            <Text className="font-inter text-sm text-primary">Forgot password?</Text>
          </Pressable>
        </Link>

        <View className="mt-10 flex-row flex-wrap items-center justify-center gap-1">
          <Text className="font-inter text-sm text-textSecondary">New here?</Text>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable>
              <Text className="font-inter text-sm font-semibold text-primary">Create an account</Text>
            </Pressable>
          </Link>
        </View>
      </KeyboardAwareView>
    </SafeAreaWrapper>
  );
}
