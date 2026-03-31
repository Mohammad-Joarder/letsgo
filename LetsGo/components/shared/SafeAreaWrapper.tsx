import React from "react";
import { View, StyleSheet, ViewStyle, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "@/lib/constants";

// ─── SafeAreaWrapper ──────────────────────────────────────────

interface SafeAreaWrapperProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: ("top" | "bottom" | "left" | "right")[];
}

export function SafeAreaWrapper({
  children,
  style,
  edges = ["top", "bottom"],
}: SafeAreaWrapperProps) {
  return (
    <SafeAreaView
      style={[styles.safeArea, style]}
      edges={edges}
    >
      {children}
    </SafeAreaView>
  );
}

// ─── KeyboardAwareView ────────────────────────────────────────

interface KeyboardAwareViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  scrollable?: boolean;
}

export function KeyboardAwareView({
  children,
  style,
  scrollable = false,
}: KeyboardAwareViewProps) {
  const content = scrollable ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ flexGrow: 1 }}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, style]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      {content}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
