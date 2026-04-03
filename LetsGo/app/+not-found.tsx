import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 items-center justify-center px-8">
        <Text className="font-sora-display text-3xl font-bold text-text">Lost?</Text>
        <Text className="font-inter mt-3 text-center text-textSecondary">
          This screen does not exist in Lets Go yet.
        </Text>
        <View className="mt-10 w-full">
          <Button title="Back to start" variant="primary" onPress={() => router.replace("/(auth)")} />
        </View>
      </View>
    </SafeAreaWrapper>
  );
}
