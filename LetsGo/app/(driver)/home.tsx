import { Text, View } from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Badge } from "@/components/ui/Badge";
import { useProfile } from "@/hooks/useProfile";

export default function DriverHomeScreen() {
  const { profile } = useProfile();

  return (
    <SafeAreaWrapper edges={["top", "left", "right"]}>
      <View className="flex-1 bg-background px-6 pt-4">
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="font-inter text-sm text-textSecondary">Driver</Text>
            <Text className="font-sora text-xl font-semibold text-text">
              {profile?.full_name ?? "Partner"}
            </Text>
          </View>
          <Badge label="Offline" tone="muted" />
        </View>

        <View className="flex-1 items-center justify-center rounded-3xl border border-dashed border-border bg-surface/60">
          <Text className="font-sora text-lg font-semibold text-text">Dashboard map</Text>
          <Text className="font-inter mt-2 px-6 text-center text-sm text-textSecondary">
            Phase 3 adds online mode, trip offers, and live navigation from this screen.
          </Text>
        </View>
      </View>
    </SafeAreaWrapper>
  );
}
