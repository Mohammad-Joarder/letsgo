import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { FareEstimateOption } from "@/lib/bookingTypes";
import { RIDE_META } from "@/lib/rideMeta";

const C = {
  primary: "#00D4AA",
  background: "#0A0E1A",
  surface2: "#1C2438",
  border: "#1E2D45",
  text: "#FFFFFF",
  textSecondary: "#8A94A6",
};

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
        style={({ pressed }) => [
          styles.card,
          selected ? styles.cardSelected : styles.cardIdle,
          pressed && styles.cardPressed,
        ]}
      >
        <View style={styles.row}>
          <View style={[styles.iconWrap, selected ? styles.iconWrapSelected : styles.iconWrapIdle]}>
            <Ionicons
              name={meta.icon as keyof typeof Ionicons.glyphMap}
              size={22}
              color={selected ? C.primary : C.textSecondary}
            />
          </View>
          <View style={styles.mid}>
            <Text style={styles.title}>{meta.label}</Text>
            <Text style={styles.subtitle}>
              {meta.seats} seats · ~{estMin} min
            </Text>
          </View>
          <View style={styles.priceCol}>
            <Text style={styles.price}>${option.estimated_fare.toFixed(2)}</Text>
          </View>
        </View>
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
  cardSelected: {
    borderColor: C.primary,
    backgroundColor: "rgba(0, 212, 170, 0.1)",
  },
  cardIdle: {
    borderColor: C.border,
    backgroundColor: "rgba(28, 36, 56, 0.9)",
  },
  cardPressed: {
    opacity: 0.9,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    borderRadius: 12,
    padding: 8,
  },
  iconWrapSelected: {
    backgroundColor: "rgba(0, 212, 170, 0.25)",
  },
  iconWrapIdle: {
    backgroundColor: "rgba(10, 14, 26, 0.8)",
  },
  mid: {
    flex: 1,
  },
  title: {
    fontFamily: "Sora_600SemiBold",
    fontSize: 16,
    fontWeight: "600",
    color: C.text,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    fontSize: 12,
    color: C.textSecondary,
  },
  priceCol: {
    alignItems: "flex-end",
  },
  price: {
    fontFamily: "Sora_600SemiBold",
    fontSize: 18,
    fontWeight: "700",
    color: C.text,
  },
});
