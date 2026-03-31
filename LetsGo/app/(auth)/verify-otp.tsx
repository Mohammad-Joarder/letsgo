import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Keyboard,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS, BORDER_RADIUS } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { verifyOtp } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const OTP_LENGTH = 6;

export default function VerifyOtpScreen() {
  const { email, fullName, phone } = useLocalSearchParams<{
    email: string;
    fullName: string;
    phone: string;
  }>();

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleChange = (value: string, index: number) => {
    const digit = value.replace(/[^0-9]/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    if (newOtp.every((d) => d !== "") && digit) {
      Keyboard.dismiss();
      handleVerify(newOtp.join(""));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code?: string) => {
    const token = code || otp.join("");
    if (token.length !== OTP_LENGTH) {
      Alert.alert("Incomplete", "Please enter the full 6-digit code.");
      return;
    }
    setIsLoading(true);
    try {
      await verifyOtp(email, token);
      // Navigate to role selection
      router.replace({
        pathname: "/(auth)/role-select",
        params: { email, fullName, phone },
      });
    } catch (error: any) {
      Alert.alert(
        "Invalid Code",
        "The code you entered is incorrect or has expired. Please try again."
      );
      setOtp(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      setResendCountdown(60);
      setCanResend(false);
      Alert.alert("Code Sent", "A new verification code has been sent to your email.");
    } catch {
      Alert.alert("Error", "Could not resend code. Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Text style={styles.icon}>✉️</Text>
        </View>

        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{"\n"}
          <Text style={styles.emailText}>{email}</Text>
        </Text>

        {/* OTP Inputs */}
        <View style={styles.otpRow}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
              value={digit}
              onChangeText={(v) => handleChange(v, index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              autoFocus={index === 0}
              selectTextOnFocus
            />
          ))}
        </View>

        <Button
          label="Verify Email"
          onPress={() => handleVerify()}
          isLoading={isLoading}
          size="lg"
          style={styles.verifyBtn}
        />

        {/* Resend */}
        <View style={styles.resendRow}>
          <Text style={styles.resendText}>Didn't receive it? </Text>
          {canResend ? (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendLink}>Resend code</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.resendCountdown}>
              Resend in {resendCountdown}s
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  back: { marginTop: 12, marginLeft: 28 },
  backText: { fontFamily: FONTS.interMedium, fontSize: 15, color: COLORS.textSecondary },
  content: { flex: 1, paddingHorizontal: 28, paddingTop: 48, alignItems: "center" },
  iconWrapper: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: COLORS.surface2, alignItems: "center",
    justifyContent: "center", marginBottom: 24,
  },
  icon: { fontSize: 36 },
  title: {
    fontFamily: FONTS.soraBold, fontSize: 28, color: COLORS.text,
    marginBottom: 12, letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: FONTS.interRegular, fontSize: 15, color: COLORS.textSecondary,
    textAlign: "center", lineHeight: 22, marginBottom: 40,
  },
  emailText: { fontFamily: FONTS.interSemiBold, color: COLORS.text },
  otpRow: { flexDirection: "row", gap: 10, marginBottom: 36 },
  otpBox: {
    width: 48, height: 56, borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface2, borderWidth: 1.5,
    borderColor: COLORS.border, fontFamily: FONTS.soraBold,
    fontSize: 22, color: COLORS.text,
  },
  otpBoxFilled: { borderColor: COLORS.primary },
  verifyBtn: { width: "100%", marginBottom: 24 },
  resendRow: { flexDirection: "row", alignItems: "center" },
  resendText: { fontFamily: FONTS.interRegular, fontSize: 14, color: COLORS.textSecondary },
  resendLink: { fontFamily: FONTS.interSemiBold, fontSize: 14, color: COLORS.primary },
  resendCountdown: { fontFamily: FONTS.interMedium, fontSize: 14, color: COLORS.textMuted },
});
