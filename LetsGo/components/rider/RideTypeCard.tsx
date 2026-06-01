import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import { RideTypeImage } from "@/components/rider/RideTypeImage";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import type { FareEstimateOption } from "@/lib/bookingTypes";
import { RIDE_META } from "@/lib/rideMeta";

const SPRING = { damping: 20, stiffness: 280, mass: 0.7 };

function hexWithAlpha(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

type Props = {
  option: FareEstimateOption;
  index: number;
  selected: boolean;
  durationMin?: number;
  onPress: () => void;
};

export function RideTypeCard({ option, index, selected, durationMin, onPress }: Props) {
  const { colors, colorTheme } = useTheme();
  const meta = RIDE_META[option.ride_type];
  const estMin = durationMin != null ? durationMin + meta.estMinBase : meta.estMinBase + 8;
  const selectedBg = hexWithAlpha(colors.primary, "22");
  const selectedIconBg = hexWithAlpha(colors.primary, "33");
  const checkIconColor = colorTheme === "light" ? "#FFFFFF" : colors.background;

  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(selected ? 1 : 0, SPRING);
  }, [selected, progress]);

  const cardAnim = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], [colors.border, colors.primary]),
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.surface2, selectedBg]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 1.02]) }],
  }));

  const iconWrapAnim = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.surface3, selectedIconBg]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 1.06]) }],
  }));

  const checkAnim = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.6, 1]) }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(18)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${meta.label}, ${meta.tagline}`}
      >
        <Animated.View style={[styles.card, cardAnim]}>
          <View style={styles.row}>
            <Animated.View style={[styles.iconWrap, iconWrapAnim]}>
              <RideTypeImage type={option.ride_type} size={52} />
            </Animated.View>
            <View style={styles.mid}>
              <Text style={[styles.title, { color: colors.text }]}>{meta.label}</Text>
              <Text style={[styles.tagline, { color: colors.textSecondary }]}>{meta.tagline}</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {meta.seats} seats · ~{estMin} min
              </Text>
            </View>
            <View style={styles.priceCol}>
              <Text style={[styles.price, { color: colors.text }]}>
                ${option.estimated_fare.toFixed(2)}
              </Text>
              <Animated.View style={[styles.check, checkAnim, { backgroundColor: colors.primary }]}>
                <MaterialCommunityIcons name="check" size={14} color={checkIconColor} />
              </Animated.View>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  mid: {
    flex: 1,
  },
  title: {
    fontFamily: "Sora_600SemiBold",
    fontSize: 16,
    fontWeight: "600",
  },
  tagline: {
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    fontSize: 12,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    fontSize: 11,
  },
  priceCol: {
    alignItems: "flex-end",
    gap: 8,
  },
  price: {
    fontFamily: "Sora_600SemiBold",
    fontSize: 18,
    fontWeight: "700",
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
});
