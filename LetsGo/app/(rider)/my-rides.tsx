import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS } from "@/lib/constants";

export default function MyRidesScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Trips</Text>
      </View>
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🕐</Text>
        <Text style={styles.emptyTitle}>No trips yet</Text>
        <Text style={styles.emptySubtext}>
          Your past and upcoming trips will appear here.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20, borderBottomWidth: 1, borderColor: COLORS.border },
  title: { fontFamily: FONTS.soraBold, fontSize: 26, color: COLORS.text, letterSpacing: -0.5 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontFamily: FONTS.soraSemiBold, fontSize: 20, color: COLORS.text },
  emptySubtext: { fontFamily: FONTS.interRegular, fontSize: 14, color: COLORS.textSecondary, textAlign: "center", lineHeight: 20 },
});
