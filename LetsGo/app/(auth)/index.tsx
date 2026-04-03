import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { ImageBackground, StyleSheet, Text, View } from "react-native";
import { AppLogo } from "@/components/branding/AppLogo";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";
import { BRAND_TAGLINE } from "@/lib/constants";
import { BRAND } from "@/lib/brandAssets";

export default function WelcomeScreen() {
  return (
    <SafeAreaWrapper className="bg-background" edges={["top", "left", "right", "bottom"]}>
      <ImageBackground
        accessibilityRole="image"
        accessibilityLabel="City skyline background"
        source={BRAND.welcomeHero}
        style={styles.hero}
        resizeMode="cover"
      >
        <LinearGradient
          colors={["#0A0E1AEE", "#0A0E1ACC", "#0A0E1AF2"]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["#00D4AA40", "transparent"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.55 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View className="flex-1 justify-between px-8 pb-10 pt-4">
          <View className="flex-1 justify-center">
            <View
              className="items-center self-center rounded-3xl border border-white/20 bg-white px-6 py-8 shadow-2xl shadow-black/60"
              style={styles.logoCard}
            >
              <AppLogo width={280} height={100} />
            </View>
            <Text className="font-inter mt-8 text-center text-base leading-6 text-textSecondary">
              {BRAND_TAGLINE}
            </Text>
            <Text className="font-inter mt-3 text-center text-sm text-textSecondary/80">
              Premium rides. Australia-wide.
            </Text>
          </View>

          <View className="gap-4">
            <Link href="/(auth)/sign-in" asChild>
              <Button title="Sign In" variant="primary" />
            </Link>
            <Link href="/(auth)/sign-up" asChild>
              <Button title="Create Account" variant="secondary" />
            </Link>
          </View>
        </View>
      </ImageBackground>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    width: "100%",
    minHeight: "100%",
  },
  logoCard: {
    maxWidth: "100%",
    elevation: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
  },
});
