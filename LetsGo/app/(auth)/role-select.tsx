import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS, BORDER_RADIUS } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { updateProfileRole, createRiderRecord, createDriverRecord } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Role = "rider" | "driver";

export default function RoleSelectScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const roles = [
    {
      id: "rider" as Role,
      icon: "🧍",
      title: "I'm a Rider",
      description: "Book premium rides across Australia instantly",
      perks: ["Request rides in seconds", "Live driver tracking", "Safe & verified drivers"],
    },
    {
      id: "driver" as Role,
      icon: "🚗",
      title: "I'm a Driver",
      description: "Earn on your schedule with flexible hours",
      perks: ["Set your own hours", "Weekly payouts", "Earn more with every trip"],
    },
  ];

  const handleConfirm = async () => {
    if (!selectedRole) return;
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session not found");

      await updateProfileRole(user.id, selectedRole);

      if (selectedRole === "rider") {
        await createRiderRecord(user.id);
        router.replace("/(rider)/home");
      } else {
        await createDriverRecord(user.id);
        router.replace("/(auth)/driver-pending");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not set your role. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>How will you use{"\n"}Let's Go?</Text>
          <Text style={styles.subtitle}>You can only choose one — choose wisely!</Text>
        </View>

        <View style={styles.cards}>
          {roles.map((role) => {
            const isSelected = selectedRole === role.id;
            return (
              <TouchableOpacity
                key={role.id}
                onPress={() => setSelectedRole(role.id)}
                activeOpacity={0.85}
                style={[styles.card, isSelected && styles.cardSelected]}
              >
                {/* Selected indicator */}
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>

                <Text style={styles.cardIcon}>{role.icon}</Text>
                <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                  {role.title}
                </Text>
                <Text style={styles.cardDescription}>{role.description}</Text>

                <View style={styles.perksList}>
                  {role.perks.map((perk) => (
                    <View key={perk} style={styles.perkRow}>
                      <Text style={[styles.perkDot, isSelected && styles.perkDotSelected]}>✓</Text>
                      <Text style={styles.perkText}>{perk}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Button
          label={selectedRole === "driver" ? "Apply as Driver" : "Get Started"}
          onPress={handleConfirm}
          isLoading={isLoading}
          disabled={!selectedRole}
          size="lg"
          style={styles.cta}
        />

        <Text style={styles.noteText}>
          {selectedRole === "driver"
            ? "Your account will be reviewed before you can go online."
            : "You can start booking immediately after signing up."}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 40 },
  header: { marginBottom: 28 },
  title: {
    fontFamily: FONTS.soraBold, fontSize: 30, color: COLORS.text,
    letterSpacing: -0.5, lineHeight: 38, marginBottom: 10,
  },
  subtitle: { fontFamily: FONTS.interRegular, fontSize: 14, color: COLORS.textSecondary },
  cards: { gap: 14, marginBottom: 28 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.xl,
    padding: 20, borderWidth: 1.5, borderColor: COLORS.border,
  },
  cardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(0, 212, 170, 0.05)",
  },
  radio: {
    position: "absolute", top: 16, right: 16,
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
  },
  radioSelected: { borderColor: COLORS.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  cardIcon: { fontSize: 32, marginBottom: 10 },
  cardTitle: {
    fontFamily: FONTS.soraSemiBold, fontSize: 18, color: COLORS.text, marginBottom: 6,
  },
  cardTitleSelected: { color: COLORS.primary },
  cardDescription: {
    fontFamily: FONTS.interRegular, fontSize: 13, color: COLORS.textSecondary, marginBottom: 14,
  },
  perksList: { gap: 6 },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  perkDot: { fontFamily: FONTS.interBold, fontSize: 12, color: COLORS.textMuted },
  perkDotSelected: { color: COLORS.primary },
  perkText: { fontFamily: FONTS.interRegular, fontSize: 13, color: COLORS.textSecondary },
  cta: { marginBottom: 14 },
  noteText: {
    textAlign: "center", fontFamily: FONTS.interRegular,
    fontSize: 12, color: COLORS.textMuted, lineHeight: 18,
  },
});
