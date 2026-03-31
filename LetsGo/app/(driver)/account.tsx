import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { COLORS, FONTS, BORDER_RADIUS } from "@/lib/constants";
import { Avatar } from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";

export default function DriverAccountScreen() {
  const { profile, signOut } = useAuth();

  const menuItems = [
    { icon: "🚗", label: "My Vehicle", onPress: () => {} },
    { icon: "📄", label: "Documents", onPress: () => {} },
    { icon: "💳", label: "Payment & Payouts", onPress: () => {} },
    { icon: "⭐", label: "Ratings & Reviews", onPress: () => {} },
    { icon: "🔔", label: "Notifications", onPress: () => {} },
    { icon: "🧭", label: "Navigation Preferences", onPress: () => {} },
    { icon: "❓", label: "Help & Support", onPress: () => {} },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <Avatar name={profile?.full_name} size={64} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.full_name ?? "Driver"}</Text>
            <Text style={styles.profileEmail}>{profile?.email}</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingStar}>★</Text>
              <Text style={styles.ratingValue}>5.0</Text>
              <Text style={styles.tierBadge}> · Standard</Text>
            </View>
          </View>
        </View>

        <View style={styles.menu}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.menuItem, index < menuItems.length - 1 && styles.menuItemBorder]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
        <Text style={styles.version}>Let's Go v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  profileCard: {
    flexDirection: "row", alignItems: "center", padding: 24, gap: 16,
    borderBottomWidth: 1, borderColor: COLORS.border,
  },
  profileInfo: { flex: 1 },
  profileName: { fontFamily: FONTS.soraSemiBold, fontSize: 18, color: COLORS.text, marginBottom: 2 },
  profileEmail: { fontFamily: FONTS.interRegular, fontSize: 13, color: COLORS.textSecondary, marginBottom: 6 },
  ratingRow: { flexDirection: "row", alignItems: "center" },
  ratingStar: { color: COLORS.warning, fontSize: 14 },
  ratingValue: { fontFamily: FONTS.interSemiBold, fontSize: 13, color: COLORS.text },
  tierBadge: { fontFamily: FONTS.interRegular, fontSize: 13, color: COLORS.textSecondary },
  menu: {
    backgroundColor: COLORS.surface, margin: 16, borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.border, overflow: "hidden",
  },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
  menuItemBorder: { borderBottomWidth: 1, borderColor: COLORS.border },
  menuIcon: { fontSize: 20, width: 28, textAlign: "center" },
  menuLabel: { flex: 1, fontFamily: FONTS.interMedium, fontSize: 15, color: COLORS.text },
  menuChevron: { fontSize: 20, color: COLORS.textMuted },
  signOutBtn: {
    margin: 16, marginTop: 4, padding: 16, borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surface, borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)", alignItems: "center",
  },
  signOutText: { fontFamily: FONTS.interSemiBold, fontSize: 15, color: COLORS.error },
  version: { textAlign: "center", fontFamily: FONTS.interRegular, fontSize: 12, color: COLORS.textMuted, marginBottom: 32, marginTop: 4 },
});
