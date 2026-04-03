import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { signOut } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";

export default function DriverAccountScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const [loading, setLoading] = useState(false);

  async function onSignOut() {
    setLoading(true);
    try {
      await signOut();
      router.replace("/(auth)");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaWrapper edges={["top", "left", "right"]}>
      <View className="flex-1 bg-background px-6 pt-6">
        <Text className="font-sora-display text-2xl font-bold text-text">Account</Text>

        <Card className="mt-8 flex-row items-center gap-4">
          <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={56} />
          <View className="flex-1">
            <Text className="font-sora text-lg font-semibold text-text">
              {profile?.full_name ?? "Driver"}
            </Text>
            <Text className="font-inter text-sm text-textSecondary">{profile?.email}</Text>
          </View>
        </Card>

        <Card className="mt-4">
          <Text className="font-inter text-sm text-textSecondary">
            Vehicle, documents, and Stripe Connect onboarding will be added in Phase 7 and Phase 5.
          </Text>
        </Card>

        <View className="mt-auto pb-8">
          <Button title="Sign out" variant="ghost" loading={loading} onPress={onSignOut} />
        </View>
      </View>
    </SafeAreaWrapper>
  );
}
