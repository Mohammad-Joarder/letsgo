import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { FareEstimateOption } from "@/lib/bookingTypes";
import { RIDE_META } from "@/lib/rideMeta";

type Props = {
  option: FareEstimateOption;
  index: number;
  selected: boolean;
  durationMin?: number;
  onPress: () => void;
};

export function RideTypeCard({ option, index, selected, durationMin, onPress }: Props) {
  const meta = RIDE_META[option.ride_type];
  const estMin = durationMin != null ? durationMin + meta.estMinBase : meta.estMinBase + 8;

  return (
    <Animated.View entering={FadeInDown.delay(index * 70).springify()}>
      <Pressable
        onPress={onPress}
        className={`mb-3 rounded-2xl border-2 p-4 active:opacity-90 ${
          selected
            ? "border-primary bg-primary/10 shadow-lg shadow-primary/25"
            : "border-border bg-surface2/90"
        }`}
      >
        <View className="flex-row items-center gap-3">
          <View
            className={`rounded-xl p-2 ${selected ? "bg-primary/25" : "bg-background/80"}`}
          >
            <Ionicons
              name={meta.icon as keyof typeof Ionicons.glyphMap}
              size={22}
              color={selected ? "#00D4AA" : "#8A94A6"}
            />
          </View>
          <View className="flex-1">
            <Text className="font-sora text-base font-semibold text-text">{meta.label}</Text>
            <Text className="font-inter mt-0.5 text-xs text-textSecondary">
              {meta.seats} seats · ~{estMin} min
            </Text>
          </View>
          <View className="items-end">
            <Text className="font-sora text-lg font-bold text-text">
              ${option.estimated_fare.toFixed(2)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
