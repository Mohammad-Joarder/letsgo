import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { COLORS, FONTS, BORDER_RADIUS } from "@/lib/constants";

// ─── Badge ────────────────────────────────────────────────────

type BadgeVariant = "primary" | "success" | "error" | "warning" | "neutral" | "accent";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  style?: ViewStyle;
}

const badgeColors: Record<BadgeVariant, { bg: string; text: string }> = {
  primary: { bg: "rgba(0, 212, 170, 0.15)", text: COLORS.primary },
  success: { bg: "rgba(34, 197, 94, 0.15)", text: COLORS.success },
  error: { bg: "rgba(239, 68, 68, 0.15)", text: COLORS.error },
  warning: { bg: "rgba(245, 158, 11, 0.15)", text: COLORS.warning },
  neutral: { bg: COLORS.surface2, text: COLORS.textSecondary },
  accent: { bg: "rgba(255, 107, 53, 0.15)", text: COLORS.accent },
};

export function Badge({ label, variant = "neutral", size = "md", style }: BadgeProps) {
  const colors = badgeColors[variant];
  return (
    <View
      style={[
        badgeStyles.container,
        { backgroundColor: colors.bg },
        size === "sm" && badgeStyles.sm,
        style,
      ]}
    >
      <Text
        style={[
          badgeStyles.label,
          { color: colors.text },
          size === "sm" && badgeStyles.labelSm,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    alignSelf: "flex-start",
  },
  sm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  label: {
    fontFamily: FONTS.interSemiBold,
    fontSize: 12,
  },
  labelSm: {
    fontSize: 10,
  },
});

// ─── Avatar ───────────────────────────────────────────────────

interface AvatarProps {
  name?: string;
  uri?: string | null;
  size?: number;
  style?: ViewStyle;
}

export function Avatar({ name, uri, size = 44, style }: AvatarProps) {
  const initials = name
    ? name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <View
      style={[
        avatarStyles.container,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      <Text style={[avatarStyles.initials, { fontSize: size * 0.38 }]}>
        {initials}
      </Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  initials: {
    fontFamily: FONTS.soraSemiBold,
    color: COLORS.primary,
  },
});

// ─── LoadingSpinner ───────────────────────────────────────────

import { ActivityIndicator } from "react-native";

interface LoadingSpinnerProps {
  size?: "small" | "large";
  color?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({
  size = "large",
  color = COLORS.primary,
  fullScreen = false,
}: LoadingSpinnerProps) {
  if (fullScreen) {
    return (
      <View style={spinnerStyles.fullScreen}>
        <ActivityIndicator size={size} color={color} />
      </View>
    );
  }
  return <ActivityIndicator size={size} color={color} />;
}

const spinnerStyles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
