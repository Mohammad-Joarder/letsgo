import type { Href } from "expo-router";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { Text, View } from "react-native";
import { AdminDriverComplianceReviewPanel } from "@/components/admin/AdminDriverComplianceReviewPanel";
import { Button } from "@/components/ui/Button";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { useAuth } from "@/hooks/useAuth";

export default function AdminComplianceDriverReviewScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { driverId } = useLocalSearchParams<{ driverId: string }>();
  const id = typeof driverId === "string" ? driverId : Array.isArray(driverId) ? driverId[0] : "";

  const afterAction = useCallback(() => {
    router.replace("/(auth)/admin-compliance" as Href);
  }, [router]);

  if (!id) {
    return (
      <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
        <View className="flex-1 justify-center px-6">
          <Text className="font-inter text-center text-base text-textSecondary">Missing driver id in the URL.</Text>
          <Button title="Back to queue" className="mt-6" variant="secondary" onPress={() => router.replace("/(auth)/admin-compliance" as Href)} />
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <AdminDriverComplianceReviewPanel
      driverId={id}
      accessToken={session?.access_token}
      onBack={() => router.back()}
      onCompleted={afterAction}
    />
  );
}
