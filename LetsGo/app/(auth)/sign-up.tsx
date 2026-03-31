import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signUp } from "@/lib/auth";

export default function SignUpScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = "Full name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Enter a valid email";
    if (!phone.trim()) e.phone = "Phone number is required";
    else if (phone.replace(/\D/g, "").length < 9) e.phone = "Enter a valid Australian number";
    if (!password) e.password = "Password is required";
    else if (password.length < 8) e.password = "Password must be at least 8 characters";
    if (password !== confirmPassword) e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignUp = async () => {
    if (!validate()) return;
    setIsLoading(true);
    try {
      await signUp(
        email.trim().toLowerCase(),
        password,
        fullName.trim(),
        phone.trim(),
        "rider" // temporary — role chosen in next step
      );
      // Navigate to OTP verification
      router.push({
        pathname: "/(auth)/verify-otp",
        params: { email: email.trim().toLowerCase(), fullName: fullName.trim(), phone: phone.trim() },
      });
    } catch (error: any) {
      Alert.alert(
        "Sign Up Failed",
        error.message?.includes("already registered")
          ? "This email is already registered. Try signing in instead."
          : error.message || "Something went wrong. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join Let's Go in under a minute</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Full name"
            placeholder="Your full name"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoCorrect={false}
            error={errors.fullName}
          />
          <Input
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.email}
          />
          <Input
            label="Phone number"
            placeholder="04XX XXX XXX"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            error={errors.phone}
            hint="Australian mobile number"
          />
          <Input
            label="Password"
            placeholder="Min. 8 characters"
            value={password}
            onChangeText={setPassword}
            isPassword
            error={errors.password}
          />
          <Input
            label="Confirm password"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isPassword
            error={errors.confirmPassword}
          />
        </View>

        <Button
          label="Create Account"
          onPress={handleSignUp}
          isLoading={isLoading}
          size="lg"
        />

        <View style={styles.signInRow}>
          <Text style={styles.signInText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/sign-in")}>
            <Text style={styles.signInLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 40 },
  back: { marginTop: 12, marginBottom: 32 },
  backText: { fontFamily: FONTS.interMedium, fontSize: 15, color: COLORS.textSecondary },
  header: { marginBottom: 32 },
  title: { fontFamily: FONTS.soraBold, fontSize: 32, color: COLORS.text, marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontFamily: FONTS.interRegular, fontSize: 15, color: COLORS.textSecondary },
  form: { marginBottom: 8 },
  signInRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 24 },
  signInText: { fontFamily: FONTS.interRegular, fontSize: 14, color: COLORS.textSecondary },
  signInLink: { fontFamily: FONTS.interSemiBold, fontSize: 14, color: COLORS.primary },
});
