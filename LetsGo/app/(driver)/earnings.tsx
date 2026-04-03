import { Text, View } from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";

export default function DriverEarningsScreen() {
  return (
    <SafeAreaWrapper edges={["top", "left", "right"]}>
      <View className="flex-1 bg-background px-6 pt-6">
        <Text className="font-sora-display text-2xl font-bold text-text">Earnings</Text>
        <Text className="font-inter mt-2 text-sm text-textSecondary">
          Weekly summaries and payouts will appear here in Phase 3 and Phase 5.
        </Text>
        <View className="mt-10 flex-1 items-center justify-center rounded-3xl border border-border bg-surface">
          <Text className="font-inter text-center text-textSecondary">No earnings data yet</Text>
        </View>
      </View>
    </SafeAreaWrapper>
  );
}
