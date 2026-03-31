import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleSheet,
  View,
} from "react-native";
import { COLORS, FONTS, BORDER_RADIUS } from "@/lib/constants";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
  style?: ViewStyle;
  labelStyle?: TextStyle;
}

const sizeStyles: Record<Size, { container: ViewStyle; label: TextStyle }> = {
  sm: {
    container: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: BORDER_RADIUS.sm },
    label: { fontSize: 13, fontFamily: FONTS.interSemiBold },
  },
  md: {
    container: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: BORDER_RADIUS.md },
    label: { fontSize: 15, fontFamily: FONTS.interSemiBold },
  },
  lg: {
    container: { paddingVertical: 18, paddingHorizontal: 32, borderRadius: BORDER_RADIUS.lg },
    label: { fontSize: 17, fontFamily: FONTS.soraSemiBold },
  },
};

const variantStyles: Record<
  Variant,
  { container: ViewStyle; label: TextStyle }
> = {
  primary: {
    container: { backgroundColor: COLORS.primary },
    label: { color: "#0A0E1A" },
  },
  secondary: {
    container: { backgroundColor: COLORS.surface2 },
    label: { color: COLORS.text },
  },
  ghost: {
    container: { backgroundColor: "transparent" },
    label: { color: COLORS.primary },
  },
  danger: {
    container: { backgroundColor: COLORS.error },
    label: { color: COLORS.text },
  },
  outline: {
    container: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: COLORS.primary,
    },
    label: { color: COLORS.primary },
  },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled = false,
  icon,
  iconPosition = "left",
  fullWidth = true,
  style,
  labelStyle,
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.base,
        sizeStyles[size].container,
        variantStyles[variant].container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? "#0A0E1A" : COLORS.primary}
        />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === "left" && (
            <View style={styles.iconLeft}>{icon}</View>
          )}
          <Text
            style={[
              sizeStyles[size].label,
              variantStyles[variant].label,
              labelStyle,
            ]}
          >
            {label}
          </Text>
          {icon && iconPosition === "right" && (
            <View style={styles.iconRight}>{icon}</View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  fullWidth: {
    width: "100%",
  },
  disabled: {
    opacity: 0.45,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
