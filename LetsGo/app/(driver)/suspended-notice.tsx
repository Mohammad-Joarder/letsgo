import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { signOut } from "@/lib/auth";

export default function DriverSuspendedNoticeScreen() {
  const router = useRouter();

  async function onSignOut() {
    await signOut();
    router.replace("/(auth)");
  }

  return (
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 justify-center px-8">
        <Text className="font-sora-display text-3xl font-bold text-text">Account suspended</Text>
        <Text className="font-inter mt-3 text-base leading-6 text-textSecondary">
          Your driver account is temporarily suspended. You cannot receive trip offers until the suspension is lifted
          by the operations team.
        </Text>
        <Card className="mt-8">
          <Text className="font-inter text-sm leading-6 text-textSecondary">
            If you need clarification, open Help & support from this device after signing back in, or email the address
            in your welcome materials.
          </Text>
        </Card>
        <View className="mt-10 gap-3">
          <Button title="Help & support" onPress={() => router.push("/(driver)/help" as Href)} />
          <Button title="Sign out" variant="ghost" onPress={() => void onSignOut()} />
        </View>
      </View>
    </SafeAreaWrapper>
  );
}
