import { View } from "react-native";
import { AppLogo } from "@/components/branding/AppLogo";

/**
 * Centered brand strip for auth flows only — avoids noisy corner badges.
 * Lockup sits in a dark surface frame so the artwork reads as one intentional card.
 */
export function AuthBrandHeader() {
  return (
    <View className="mb-2 items-center">
      <View className="mb-5 h-1 w-10 rounded-full bg-primary" />
      <View
        className="rounded-2xl border border-border bg-surface px-5 py-4"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 16,
          elevation: 6,
        }}
      >
        <AppLogo width={168} height={56} />
      </View>
    </View>
  );
}
