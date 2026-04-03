import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { AuthBrandHeader } from "@/components/branding/AuthBrandHeader";
import { KeyboardAwareView } from "@/components/shared/KeyboardAwareView";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signUpWithEmail } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function SignUpScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Check your .env file.");
      return;
    }
    if (!fullName.trim() || !email.trim() || !phone.trim() || password.length < 8) {
      setError("Please fill all fields. Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await signUpWithEmail(email.trim(), password, {
        full_name: fullName.trim(),
        phone: phone.trim(),
      });
      router.push({
        pathname: "/(auth)/verify-otp",
        params: { email: email.trim() },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <KeyboardAwareView contentContainerClassName="px-8 pb-8 pt-6">
        <AuthBrandHeader />
        <View className="mb-8">
          <Text className="font-sora-display text-3xl font-bold text-text">Create account</Text>
          <Text className="font-inter mt-2 text-base text-textSecondary">
            Join Lets Go in under a minute.
          </Text>
        </View>

        <Input label="Full name" autoComplete="name" value={fullName} onChangeText={setFullName} />
        <Input
          label="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Input
          label="Phone"
          autoComplete="tel"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <Input
          label="Password"
          secureTextEntry
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text className="font-inter mb-4 text-sm text-error">{error}</Text> : null}

        <Button title="Continue" loading={loading} onPress={onSubmit} />

        <View className="mt-10 flex-row flex-wrap items-center justify-center gap-1">
          <Text className="font-inter text-sm text-textSecondary">Already have an account?</Text>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable>
              <Text className="font-inter text-sm font-semibold text-primary">Sign in</Text>
            </Pressable>
          </Link>
        </View>
      </KeyboardAwareView>
    </SafeAreaWrapper>
  );
}
