import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS, BORDER_RADIUS } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { signOut } from "@/lib/auth";

export default function DriverPendingScreen() {
  const steps = [
    { icon: "📋", label: "Application submitted", done: true },
    { icon: "🔍", label: "Identity verification", done: false },
    { icon: "🚗", label: "Vehicle inspection", done: false },
    { icon: "✅", label: "Account approved", done: false },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        {/* Status badge */}
        <View style={styles.statusBadge}>
          <View style={styles.pulseDot} />
          <Text style={styles.statusText}>Under Review</Text>
        </View>

        <Text style={styles.title}>Application{"\n"}Submitted!</Text>
        <Text style={styles.subtitle}>
          Our team will review your application within 24 hours. We'll notify you by email when you're approved.
        </Text>

        {/* Steps */}
        <View style={styles.stepsCard}>
          {steps.map((step, index) => (
            <View key={index} style={styles.stepRow}>
              <View style={[styles.stepIcon, step.done && styles.stepIconDone]}>
                <Text style={styles.stepEmoji}>{step.done ? "✓" : step.icon}</Text>
              </View>
              <Text style={[styles.stepLabel, step.done && styles.stepLabelDone]}>
                {step.label}
              </Text>
              {index < steps.length - 1 && (
                <View style={[styles.stepLine, step.done && styles.stepLineDone]} />
              )}
            </View>
          ))}
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 While you wait, make sure you have your driving license, vehicle registration, and insurance documents ready to upload.
          </Text>
        </View>

        <Button
          label="Sign Out"
          onPress={async () => {
            await signOut();
            router.replace("/(auth)");
          }}
          variant="ghost"
          size="md"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, paddingHorizontal: 28, paddingTop: 48, alignItems: "center" },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: BORDER_RADIUS.full,
    marginBottom: 28,
  },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.warning },
  statusText: { fontFamily: FONTS.interSemiBold, fontSize: 13, color: COLORS.warning },
  title: {
    fontFamily: FONTS.soraBold, fontSize: 32, color: COLORS.text,
    textAlign: "center", letterSpacing: -0.5, lineHeight: 40, marginBottom: 14,
  },
  subtitle: {
    fontFamily: FONTS.interRegular, fontSize: 15, color: COLORS.textSecondary,
    textAlign: "center", lineHeight: 22, marginBottom: 36,
  },
  stepsCard: {
    width: "100%", backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.xl,
    padding: 20, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border,
    gap: 16,
  },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surface2,
    alignItems: "center", justifyContent: "center",
  },
  stepIconDone: { backgroundColor: "rgba(0, 212, 170, 0.15)" },
  stepEmoji: { fontSize: 16 },
  stepLabel: { fontFamily: FONTS.interMedium, fontSize: 14, color: COLORS.textSecondary, flex: 1 },
  stepLabelDone: { color: COLORS.primary },
  stepLine: { position: "absolute", left: 17, top: 36, width: 2, height: 16, backgroundColor: COLORS.border },
  stepLineDone: { backgroundColor: COLORS.primary },
  infoBox: {
    width: "100%", backgroundColor: COLORS.surface2, borderRadius: BORDER_RADIUS.lg,
    padding: 16, marginBottom: 32, borderWidth: 1, borderColor: COLORS.border,
  },
  infoText: { fontFamily: FONTS.interRegular, fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
});
