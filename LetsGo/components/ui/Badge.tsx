import { Text, View, type ViewProps } from "react-native";

export type BadgeProps = ViewProps & {
  label: string;
  tone?: "default" | "success" | "warning" | "muted";
  className?: string;
};

const tones: Record<NonNullable<BadgeProps["tone"]>, { wrap: string; text: string }> = {
  default: { wrap: "bg-surface2 border-border", text: "text-text" },
  success: { wrap: "bg-primary/15 border-primary/40", text: "text-primary" },
  warning: { wrap: "bg-accent/15 border-accent/40", text: "text-accent" },
  muted: { wrap: "bg-background border-border", text: "text-textSecondary" },
};

export function Badge({ label, tone = "default", className = "", ...rest }: BadgeProps) {
  const t = tones[tone];
  return (
    <View
      className={`self-start rounded-full border px-3 py-1 ${t.wrap} ${className}`}
      {...rest}
    >
      <Text className={`font-inter text-xs font-semibold uppercase tracking-wide ${t.text}`}>
        {label}
      </Text>
    </View>
  );
}
