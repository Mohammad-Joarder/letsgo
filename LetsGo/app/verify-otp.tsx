import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";

/**
 * Deep-link entry for signup confirmation: letsgo://verify-otp?email=...
 * (see lib/auth.ts). Forwards to the real screen under (auth).
 */
export default function VerifyOtpDeepLinkScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string | string[] }>();
  const resolved =
    typeof email === "string" ? email : Array.isArray(email) && email[0] ? email[0] : "";

  useEffect(() => {
    if (resolved) {
      router.replace({ pathname: "/(auth)/verify-otp", params: { email: resolved } });
    } else {
      router.replace("/(auth)/verify-otp");
    }
  }, [resolved, router]);

  return null;
}
