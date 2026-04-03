import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";
import { signOut } from "@/lib/auth";

export default function AdminOnlyScreen() {
  const router = useRouter();

  async function onSignOut() {
    await signOut();
    router.replace("/(auth)");
  }

  return (
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 justify-center px-8">
        <Text className="font-sora-display text-3xl font-bold text-text">Admin access</Text>
        <Text className="font-inter mt-4 text-base leading-6 text-textSecondary">
          Lets Go admin tools live in the web admin panel (React + Vite). Sign in there with your
          admin account to manage trips, drivers, and pricing.
        </Text>
        <View className="mt-10">
          <Button title="Sign out" variant="secondary" onPress={onSignOut} />
        </View>
      </View>
    </SafeAreaWrapper>
  );
}
