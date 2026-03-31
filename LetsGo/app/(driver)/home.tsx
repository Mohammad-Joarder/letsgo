import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS, BORDER_RADIUS } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";

export default function DriverHomeScreen() {
  const { profile } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const firstName = profile?.full_name?.split(" ")[0] ?? "Driver";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {firstName}</Text>
          <Text style={styles.subGreeting}>
            {isOnline ? "You're online — accepting trips" : "Go online to start earning"}
          </Text>
        </View>
        <View style={[styles.statusDot, isOnline && styles.statusDotOnline]} />
      </View>

      {/* Map placeholder */}
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapIcon}>🗺️</Text>
        <Text style={styles.mapText}>Live map loads in Phase 3</Text>
      </View>

      {/* Online toggle */}
      <View style={styles.bottomPanel}>
        {/* Stats row */}
        {isOnline && (
          <View style={styles.statsRow}>
            {[{ label: "Trips today", value: "0" }, { label: "Earned today", value: "$0.00" }, { label: "Rating", value: "5.0 ★" }].map((stat) => (
              <View key={stat.label} style={styles.statItem}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.toggleBtn, isOnline && styles.toggleBtnOnline]}
          onPress={() => setIsOnline(!isOnline)}
          activeOpacity={0.85}
        >
          <View style={[styles.toggleDot, isOnline && styles.toggleDotOnline]} />
          <Text style={[styles.toggleLabel, isOnline && styles.toggleLabelOnline]}>
            {isOnline ? "GO OFFLINE" : "GO ONLINE"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderColor: COLORS.border,
  },
  greeting: { fontFamily: FONTS.soraSemiBold, fontSize: 18, color: COLORS.text },
  subGreeting: { fontFamily: FONTS.interRegular, fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  statusDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.textMuted },
  statusDotOnline: { backgroundColor: COLORS.success },
  mapPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface },
  mapIcon: { fontSize: 60, marginBottom: 12 },
  mapText: { fontFamily: FONTS.interRegular, fontSize: 14, color: COLORS.textMuted },
  bottomPanel: {
    backgroundColor: COLORS.surface, padding: 24, paddingBottom: 8,
    borderTopWidth: 1, borderColor: COLORS.border, gap: 16,
  },
  statsRow: { flexDirection: "row", justifyContent: "space-around" },
  statItem: { alignItems: "center" },
  statValue: { fontFamily: FONTS.soraSemiBold, fontSize: 16, color: COLORS.text },
  statLabel: { fontFamily: FONTS.interRegular, fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  toggleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: COLORS.surface2, borderRadius: BORDER_RADIUS.xl,
    paddingVertical: 18, borderWidth: 1.5, borderColor: COLORS.border,
  },
  toggleBtnOnline: { backgroundColor: "rgba(0, 212, 170, 0.1)", borderColor: COLORS.primary },
  toggleDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.textMuted },
  toggleDotOnline: { backgroundColor: COLORS.primary },
  toggleLabel: { fontFamily: FONTS.soraBold, fontSize: 16, color: COLORS.textSecondary, letterSpacing: 1.5 },
  toggleLabelOnline: { color: COLORS.primary },
});
