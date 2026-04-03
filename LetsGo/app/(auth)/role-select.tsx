import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { completeRoleSelection } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { UserRole } from "@/lib/types";

type Choice = Exclude<UserRole, "admin">;

export default function RoleSelectScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const phone = (user?.user_metadata?.phone as string | undefined) ?? "";
  const email = user?.email ?? "";

  async function onContinue() {
    setError(null);
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured.");
      return;
    }
    if (!user?.id || !choice) {
      setError("Select how you want to use Lets Go.");
      return;
    }
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      setError("Your profile is missing details. Please sign up again with name, email, and phone.");
      return;
    }
    setLoading(true);
    try {
      await completeRoleSelection(choice, {
        userId: user.id,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
      await refreshProfile();
      if (choice === "driver") {
        router.replace("/(auth)/driver-review-pending");
      } else {
        router.replace("/(rider)/(tabs)/home" as Href);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete registration.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 px-8 pb-10 pt-4">
        <View className="mb-8">
          <Text className="font-sora-display text-3xl font-bold text-text">How will you ride?</Text>
          <Text className="font-inter mt-2 text-base text-textSecondary">
            Choose rider to book trips, or driver to earn on your schedule.
          </Text>
        </View>

        <Pressable onPress={() => setChoice("rider")}>
          <Card
            className={`mb-4 border-2 ${choice === "rider" ? "border-primary" : "border-border"}`}
          >
            <Text className="font-sora text-lg font-semibold text-text">Rider</Text>
            <Text className="font-inter mt-1 text-sm text-textSecondary">
              Request rides, track drivers live, and pay securely.
            </Text>
          </Card>
        </Pressable>

        <Pressable onPress={() => setChoice("driver")}>
          <Card
            className={`mb-6 border-2 ${choice === "driver" ? "border-primary" : "border-border"}`}
          >
            <Text className="font-sora text-lg font-semibold text-text">Driver</Text>
            <Text className="font-inter mt-1 text-sm text-textSecondary">
              Go online, accept offers, and get paid weekly.
            </Text>
          </Card>
        </Pressable>

        {error ? <Text className="font-inter mb-4 text-sm text-error">{error}</Text> : null}

        <View className="mt-auto">
          <Button title="Continue" loading={loading} disabled={!choice} onPress={onContinue} />
        </View>
      </View>
    </SafeAreaWrapper>
  );
}
