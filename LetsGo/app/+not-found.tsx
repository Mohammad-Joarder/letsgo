import { View, Text, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { COLORS, FONTS } from "@/lib/constants";

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🚗</Text>
      <Text style={styles.title}>Lost your way?</Text>
      <Text style={styles.subtitle}>This screen doesn't exist.</Text>
      <Link href="/(auth)" style={styles.link}>
        <Text style={styles.linkText}>Go back home</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center", gap: 12 },
  emoji: { fontSize: 60 },
  title: { fontFamily: FONTS.soraBold, fontSize: 24, color: COLORS.text },
  subtitle: { fontFamily: FONTS.interRegular, fontSize: 15, color: COLORS.textSecondary },
  link: { marginTop: 8 },
  linkText: { fontFamily: FONTS.interSemiBold, fontSize: 15, color: COLORS.primary },
});
