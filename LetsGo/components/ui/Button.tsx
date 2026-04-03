import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";

type Variant = "primary" | "secondary" | "ghost";

export type ButtonProps = PressableProps & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  textClassName?: string;
  className?: string;
};

const base =
  "min-h-[52px] items-center justify-center rounded-2xl px-6 active:opacity-90 disabled:opacity-40";

const variants: Record<Variant, { wrap: string; text: string }> = {
  primary: {
    wrap: "bg-primary",
    text: "font-inter text-base font-semibold text-background",
  },
  secondary: {
    wrap: "border border-border bg-surface2",
    text: "font-inter text-base font-semibold text-text",
  },
  ghost: {
    wrap: "bg-transparent",
    text: "font-inter text-base font-semibold text-primary",
  },
};

export function Button({
  title,
  variant = "primary",
  loading,
  disabled,
  className = "",
  textClassName = "",
  ...rest
}: ButtonProps) {
  const v = variants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      className={`${base} ${v.wrap} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#0A0E1A" : "#00D4AA"} />
      ) : (
        <Text className={`${v.text} ${textClassName}`}>{title}</Text>
      )}
    </Pressable>
  );
}
