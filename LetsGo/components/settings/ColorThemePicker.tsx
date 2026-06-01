import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { COLORS_DARK, COLORS_LIGHT, type ColorTheme } from "@/lib/colors";
import { useTheme } from "@/hooks/useTheme";

const OPTIONS: {
  id: ColorTheme;
  label: string;
  subtitle: string;
  preview: { background: string; primary: string; surface: string };
}[] = [
  {
    id: "dark",
    label: "Dark",
    subtitle: "Revolut meets Uber",
    preview: {
      background: COLORS_DARK.background,
      primary: COLORS_DARK.primary,
      surface: COLORS_DARK.surface,
    },
  },
  {
    id: "light",
    label: "Light",
    subtitle: "Stripe meets Apple",
    preview: {
      background: COLORS_LIGHT.background,
      primary: COLORS_LIGHT.primary,
      surface: COLORS_LIGHT.surface,
    },
  },
];

export function ColorThemePicker() {
  const { colorTheme, setColorTheme, colors } = useTheme();

  return (
    <Card className="p-0 px-4 py-4">
      <Text className="font-inter text-sm font-semibold text-text">Color theme</Text>
      <Text className="font-inter mt-1 text-xs text-textSecondary">
        Applies across the app — backgrounds, accents, and maps.
      </Text>
      <View className="mt-4 flex-row gap-3">
        {OPTIONS.map((opt) => {
          const selected = colorTheme === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => void setColorTheme(opt.id)}
              className={`flex-1 rounded-2xl border p-3 active:opacity-90 ${
                selected ? "border-primary bg-primary/10" : "border-border bg-surface2/40"
              }`}
            >
              <View
                className="mb-3 h-14 overflow-hidden rounded-xl border border-border/60"
                style={{ backgroundColor: opt.preview.background }}
              >
                <View
                  className="absolute bottom-2 left-2 right-2 flex-row gap-1.5"
                  style={{ height: 28 }}
                >
                  <View
                    className="flex-1 rounded-md"
                    style={{ backgroundColor: opt.preview.surface }}
                  />
                  <View className="w-8 rounded-md" style={{ backgroundColor: opt.preview.primary }} />
                </View>
              </View>
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-2">
                  <Text className="font-inter text-sm font-semibold text-text">{opt.label}</Text>
                  <Text className="font-inter mt-0.5 text-[10px] text-textSecondary">{opt.subtitle}</Text>
                </View>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                ) : (
                  <View className="h-[22px] w-[22px] rounded-full border border-border" />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}
