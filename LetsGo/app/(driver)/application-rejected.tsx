import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { signOut } from "@/lib/auth";

export default function DriverApplicationRejectedScreen() {
  const router = useRouter();

  async function onSignOut() {
    await signOut();
    router.replace("/(auth)");
  }

  return (
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 justify-center px-8">
        <Text className="font-sora-display text-3xl font-bold text-text">Application not approved</Text>
        <Text className="font-inter mt-3 text-base leading-6 text-textSecondary">
          We could not approve your driver profile at this time. Please review any document feedback on the status
          screen, or contact support if you believe this is a mistake.
        </Text>
        <Card className="mt-8">
          <Text className="font-inter text-sm leading-6 text-textSecondary">
            You can sign out and return later with an updated application when invited to re-apply.
          </Text>
        </Card>
        <View className="mt-10 gap-3">
          <Button title="View status & documents" onPress={() => router.replace("/(driver)/onboarding-status" as Href)} />
          <Button title="Help & support" variant="secondary" onPress={() => router.push("/(driver)/help" as Href)} />
          <Button title="Sign out" variant="ghost" onPress={() => void onSignOut()} />
        </View>
      </View>
    </SafeAreaWrapper>
  );
}
