import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS } from "@/lib/constants";

const { width, height } = Dimensions.get("window");

export default function WelcomeScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Animate floating dots
    const animateDot = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animateDot(dot1, 0);
    animateDot(dot2, 600);
    animateDot(dot3, 1200);
  }, []);

  const dotTranslate = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });

  return (
    <View style={styles.container}>
      {/* Background */}
      <View style={StyleSheet.absoluteFill} />

      {/* Glow orbs */}
      <View style={styles.glowTopRight} />
      <View style={styles.glowBottomLeft} />

      {/* Speed lines decoration */}
      <View style={styles.speedLinesContainer}>
        {[...Array(5)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.speedLine,
              {
                top: 120 + i * 18,
                width: 40 + i * 20,
                opacity: 0.06 + i * 0.015,
              },
            ]}
          />
        ))}
      </View>

      <SafeAreaView style={styles.safeArea}>
        {/* Top section — Logo */}
        <Animated.View
          style={[
            styles.logoSection,
            {
              opacity: fadeAnim,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          {/* Logo mark */}
          <View style={styles.logoMark}>
            <Text style={styles.logoArrow}>›</Text>
          </View>

          <Text style={styles.appName}>Let's Go</Text>
          <Text style={styles.tagline}>Get there, your way.</Text>
        </Animated.View>

        {/* Middle — animated floating dots */}
        <View style={styles.dotsSection}>
          {[dot1, dot2, dot3].map((dot, i) => (
            <Animated.View
              key={i}
              style={[
                styles.floatingDot,
                {
                  transform: [{ translateY: dotTranslate(dot) }],
                  opacity: dot.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.3, 1, 0.3],
                  }),
                },
              ]}
            />
          ))}
        </View>

        {/* Bottom section — CTAs */}
        <Animated.View
          style={[
            styles.ctaSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.ctaSubtext}>
            Premium rides across Australia
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/(auth)/sign-up")}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonLabel}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push("/(auth)/sign-in")}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonLabel}>Sign In</Text>
          </TouchableOpacity>

          <Text style={styles.termsText}>
            By continuing, you agree to our{" "}
            <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 32,
  },
  glowTopRight: {
    position: "absolute",
    top: -80,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(0, 212, 170, 0.07)",
  },
  glowBottomLeft: {
    position: "absolute",
    bottom: 80,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(0, 212, 170, 0.05)",
  },
  speedLinesContainer: {
    position: "absolute",
    right: 32,
    top: 0,
    alignItems: "flex-end",
  },
  speedLine: {
    height: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 1,
    marginBottom: 6,
  },
  logoSection: {
    alignItems: "center",
    paddingTop: 40,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  logoArrow: {
    fontSize: 42,
    color: "#0A0E1A",
    fontFamily: FONTS.soraBold,
    marginLeft: 6,
    lineHeight: 48,
  },
  appName: {
    fontSize: 42,
    fontFamily: FONTS.soraBold,
    color: COLORS.text,
    letterSpacing: -1,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 17,
    fontFamily: FONTS.interRegular,
    color: COLORS.textSecondary,
    letterSpacing: 0.2,
  },
  dotsSection: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingVertical: 40,
  },
  floatingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  ctaSection: {
    gap: 14,
  },
  ctaSubtext: {
    textAlign: "center",
    fontFamily: FONTS.interRegular,
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 18,
    alignItems: "center",
  },
  primaryButtonLabel: {
    fontSize: 17,
    fontFamily: FONTS.soraSemiBold,
    color: "#0A0E1A",
    letterSpacing: 0.2,
  },
  secondaryButton: {
    paddingVertical: 18,
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  secondaryButtonLabel: {
    fontSize: 17,
    fontFamily: FONTS.soraSemiBold,
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  termsText: {
    textAlign: "center",
    fontFamily: FONTS.interRegular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 6,
    lineHeight: 18,
  },
  termsLink: {
    color: COLORS.primary,
  },
});
