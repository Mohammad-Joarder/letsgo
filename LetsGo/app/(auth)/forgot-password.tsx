import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS, BORDER_RADIUS } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { resetPassword } from "@/lib/auth";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async () => {
    if (!email.trim()) { setError("Email is required"); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError("Enter a valid email"); return; }
    setError("");
    setIsLoading(true);
    try {
      await resetPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not send reset email.");
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.content}>
          <View style={styles.successIcon}>
            <Text style={{ fontSize: 40 }}>📬</Text>
          </View>
          <Text style={styles.title}>Check your inbox</Text>
          <Text style={styles.subtitle}>
            We sent a password reset link to{"\n"}
            <Text style={styles.emailText}>{email}</Text>
          </Text>
          <Button label="Back to Sign In" onPress={() => router.replace("/(auth)/sign-in")} size="lg" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <View style={styles.content}>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>
          Enter your email and we'll send you a reset link.
        </Text>
        <Input
          label="Email address"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          error={error}
        />
        <Button label="Send Reset Link" onPress={handleReset} isLoading={isLoading} size="lg" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  back: { marginTop: 12, marginLeft: 28 },
  backText: { fontFamily: FONTS.interMedium, fontSize: 15, color: COLORS.textSecondary },
  content: { flex: 1, paddingHorizontal: 28, paddingTop: 40 },
  successIcon: {
    width: 80, height: 80, borderRadius: 24, backgroundColor: COLORS.surface2,
    alignItems: "center", justifyContent: "center", marginBottom: 24,
  },
  title: {
    fontFamily: FONTS.soraBold, fontSize: 28, color: COLORS.text,
    marginBottom: 10, letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: FONTS.interRegular, fontSize: 15, color: COLORS.textSecondary,
    lineHeight: 22, marginBottom: 32,
  },
  emailText: { fontFamily: FONTS.interSemiBold, color: COLORS.text },
});
