import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";

// ─── Rider Home (Phase 2 will replace this) ───────────────────

export default function RiderHomeScreen() {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.content}>
        {/* Map placeholder */}
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapIcon}>🗺️</Text>
          <Text style={styles.mapText}>Map loads in Phase 2</Text>
        </View>

        {/* Greeting */}
        <View style={styles.overlay}>
          <Text style={styles.greeting}>Good day, {firstName}! 👋</Text>
          <Text style={styles.subtext}>Where would you like to go?</Text>

          {/* Search bar stub */}
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <Text style={styles.searchPlaceholder}>Where are you going?</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1 },
  mapPlaceholder: {
    flex: 1, backgroundColor: COLORS.surface,
    alignItems: "center", justifyContent: "center",
  },
  mapIcon: { fontSize: 60, marginBottom: 12 },
  mapText: { fontFamily: FONTS.interRegular, fontSize: 14, color: COLORS.textMuted },
  overlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.surface, padding: 24,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: COLORS.border,
  },
  greeting: { fontFamily: FONTS.soraSemiBold, fontSize: 20, color: COLORS.text, marginBottom: 4 },
  subtext: { fontFamily: FONTS.interRegular, fontSize: 14, color: COLORS.textSecondary, marginBottom: 16 },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: COLORS.surface2, borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: COLORS.border,
  },
  searchIcon: { fontSize: 18 },
  searchPlaceholder: { fontFamily: FONTS.interRegular, fontSize: 15, color: COLORS.textMuted },
});
