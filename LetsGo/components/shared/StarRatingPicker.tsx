import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

type Props = {
  value: number;
  onChange: (stars: number) => void;
  size?: number;
};

/** Visible 1–5 star control (Ionicons); avoids Unicode ★/☆ which often fail to render on device fonts. */
export function StarRatingPicker({ value, onChange, size = 40 }: Props) {
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={`${n} star${n === 1 ? "" : "s"}`}
        >
          <Ionicons
            name={n <= value ? "star" : "star-outline"}
            size={size}
            color={n <= value ? "#FFB800" : "#5C6678"}
          />
        </Pressable>
      ))}
    </View>
  );
}
