import { Image, Text, View } from "react-native";

export type AvatarProps = {
  uri?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
};

function initials(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${a}${b}`.toUpperCase() || "?";
}

export function Avatar({ uri, name, size = 44, className = "" }: AvatarProps) {
  const dimension = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri }}
        className={`border border-border bg-surface2 ${className}`}
        style={dimension}
      />
    );
  }
  return (
    <View
      className={`items-center justify-center border border-border bg-surface2 ${className}`}
      style={dimension}
    >
      <Text className="font-sora text-sm font-semibold text-primary">{initials(name)}</Text>
    </View>
  );
}
