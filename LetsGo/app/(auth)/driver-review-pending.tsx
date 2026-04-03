import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { signOut } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";

export default function DriverReviewPendingScreen() {
  const router = useRouter();
  const { driverApproval, refreshProfile } = useAuth();
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
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 justify-center px-8">
        <Badge
          label={driverApproval === "under_review" ? "Under review" : "Pending"}
          tone="warning"
          className="mb-4"
        />
        <Text className="font-sora-display text-3xl font-bold text-text">Application received</Text>
        <Text className="font-inter mt-3 text-base leading-6 text-textSecondary">
          Thanks for applying to drive with Lets Go. Our team will review your details — you will
          get a notification once you are approved.
        </Text>

        <Card className="mt-8">
          <Text className="font-inter text-sm leading-6 text-textSecondary">
            Next steps: complete vehicle and document checks from your driver profile once
            onboarding is available. For now, relax — we will email you when it is time.
          </Text>
        </Card>

        <View className="mt-10 gap-3">
          <Button
            title="Refresh status"
            variant="secondary"
            onPress={async () => {
              await refreshProfile();
            }}
          />
          <Button title="Sign out" variant="ghost" loading={loading} onPress={onSignOut} />
        </View>
      </View>
    </SafeAreaWrapper>
  );
}
