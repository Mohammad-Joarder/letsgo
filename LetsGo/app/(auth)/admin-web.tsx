import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS, BORDER_RADIUS } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { signOut } from "@/lib/auth";
import { router } from "expo-router";

export default function AdminWebScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Text style={{ fontSize: 48 }}>🖥️</Text>
        </View>
        <Text style={styles.title}>Admin Panel</Text>
        <Text style={styles.subtitle}>
          The Let's Go admin panel is only available on the web. Please visit the admin portal from your desktop browser.
        </Text>
        <View style={styles.urlBox}>
          <Text style={styles.urlLabel}>Admin Portal</Text>
          <Text style={styles.urlText}>admin.letsgo.app</Text>
        </View>
        <Button
          label="Sign Out"
          onPress={async () => { await signOut(); router.replace("/(auth)"); }}
          variant="outline"
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, paddingHorizontal: 28, alignItems: "center", justifyContent: "center", gap: 16 },
  iconWrapper: {
    width: 88, height: 88, borderRadius: 24, backgroundColor: COLORS.surface2,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  title: { fontFamily: FONTS.soraBold, fontSize: 28, color: COLORS.text, letterSpacing: -0.5 },
  subtitle: {
    fontFamily: FONTS.interRegular, fontSize: 15, color: COLORS.textSecondary,
    textAlign: "center", lineHeight: 22,
  },
  urlBox: {
    width: "100%", backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg,
    padding: 16, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", marginVertical: 8,
  },
  urlLabel: { fontFamily: FONTS.interRegular, fontSize: 12, color: COLORS.textMuted, marginBottom: 4 },
  urlText: { fontFamily: FONTS.soraSemiBold, fontSize: 16, color: COLORS.primary },
});
