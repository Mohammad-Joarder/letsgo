import "../global.css";

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { Sora_400Regular, Sora_600SemiBold, Sora_700Bold } from "@expo-google-fonts/sora";
import { useFonts } from "expo-font";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import * as SplashScreen from "expo-splash-screen";
import { Slot } from "expo-router";
import type { ReactElement, ReactNode } from "react";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StripeProvider } from "@stripe/stripe-react-native";
import * as WebBrowser from "expo-web-browser";
import { AuthProvider, useAuthContext } from "@/context/AuthContext";
import { getStripePublishableKey } from "@/lib/stripeConfig";

SplashScreen.preventAutoHideAsync();

function RootContent() {
  const { initialized, configError } = useAuthContext();

  if (!initialized && !configError) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="font-inter text-sm text-textSecondary">Loading…</Text>
      </View>
    );
  }

  if (configError) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Text className="font-sora text-center text-xl font-semibold text-text">Configuration needed</Text>
        <Text className="font-inter mt-3 text-center text-base leading-6 text-textSecondary">
          {configError}
        </Text>
      </View>
    );
  }

  return (
    <StripeAppShell>
      <Slot />
    </StripeAppShell>
  );
}

function StripeAppShell({ children }: { children: ReactNode }) {
  const pk = getStripePublishableKey() ?? "";
  return (
    <StripeProvider publishableKey={pk} merchantIdentifier="merchant.com.letsgo.app" urlScheme="letsgo">
      {children as ReactElement}
    </StripeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Sora_400Regular,
    Sora_600SemiBold,
    Sora_700Bold,
  });

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <BottomSheetModalProvider>
          <RootContent />
        </BottomSheetModalProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
