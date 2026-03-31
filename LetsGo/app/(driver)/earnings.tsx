import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS, BORDER_RADIUS } from "@/lib/constants";

export default function DriverEarningsScreen() {
  const summaryCards = [
    { label: "This Week", value: "$0.00", sub: "0 trips" },
    { label: "Total Earned", value: "$0.00", sub: "All time" },
    { label: "Pending Payout", value: "$0.00", sub: "Next Tuesday" },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Earnings</Text>
      </View>

      <View style={styles.cards}>
        {summaryCards.map((card) => (
          <View key={card.label} style={styles.card}>
            <Text style={styles.cardLabel}>{card.label}</Text>
            <Text style={styles.cardValue}>{card.value}</Text>
            <Text style={styles.cardSub}>{card.sub}</Text>
          </View>
        ))}
      </View>

      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>💰</Text>
        <Text style={styles.emptyTitle}>No earnings yet</Text>
        <Text style={styles.emptySubtext}>
          Go online and complete your first trip to start earning.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20, borderBottomWidth: 1, borderColor: COLORS.border },
  title: { fontFamily: FONTS.soraBold, fontSize: 26, color: COLORS.text, letterSpacing: -0.5 },
  cards: { flexDirection: "row", padding: 16, gap: 10 },
  card: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg,
    padding: 14, borderWidth: 1, borderColor: COLORS.border,
  },
  cardLabel: { fontFamily: FONTS.interRegular, fontSize: 11, color: COLORS.textSecondary, marginBottom: 6 },
  cardValue: { fontFamily: FONTS.soraBold, fontSize: 18, color: COLORS.primary, marginBottom: 2 },
  cardSub: { fontFamily: FONTS.interRegular, fontSize: 11, color: COLORS.textMuted },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontFamily: FONTS.soraSemiBold, fontSize: 20, color: COLORS.text },
  emptySubtext: { fontFamily: FONTS.interRegular, fontSize: 14, color: COLORS.textSecondary, textAlign: "center", lineHeight: 20 },
});
