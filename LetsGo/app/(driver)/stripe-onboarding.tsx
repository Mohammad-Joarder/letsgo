import * as Clipboard from "expo-clipboard";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { SafeAreaWrapper } from "@/components/shared/SafeAreaWrapper";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import { createConnectAccount, syncDriverStripeConnect } from "@/lib/driverEdge";
import { getStripeConnectReturnUrl, STRIPE_CONNECT_RETURN_SUFFIX } from "@/lib/supabase";

const STRIPE_RETURN_PATH_MARKER = "stripe-connect-return";

function isStripeConnectReturnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.includes(STRIPE_RETURN_PATH_MARKER)) return true;
  if (url.includes("create-connect-account-return")) return true;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith(".exp.direct") || u.hostname.endsWith(".expo.dev")) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Ask Edge to mirror Stripe account state into Postgres (works even if webhooks are missing). */
async function pullStripeConnectIntoDb(): Promise<void> {
  try {
    const res = await syncDriverStripeConnect();
    if (!res.ok && res.error) {
      console.warn("[Lets Go] sync-driver-stripe-connect:", res.error);
    }
  } catch (e) {
    console.warn("[Lets Go] sync-driver-stripe-connect invoke failed:", e);
  }
}

export default function DriverStripeOnboardingScreen() {
  const router = useRouter();
  const { refreshProfile, suppressDriverStripeGate, driverStripeConnectOnboarded } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const [copiedHint, setCopiedHint] = useState(false);

  const returnUrl = useMemo(() => getStripeConnectReturnUrl(), []);
  const appContinueUrl = useMemo(() => Linking.createURL(STRIPE_RETURN_PATH_MARKER), []);

  const awaitingHandoffRef = useRef(false);
  const handoffDoneRef = useRef(false);

  const mono = useMemo(
    () =>
      Platform.select({
        ios: "Menlo",
        android: "monospace",
        default: "monospace",
      }) as string,
    []
  );

  const goHomeAfterConnect = useCallback(() => {
    suppressDriverStripeGate(25 * 60 * 1000);
    router.replace("/(driver)/(tabs)/home" as Href);
  }, [router, suppressDriverStripeGate]);

  const completeStripeHandoff = useCallback(async () => {
    if (handoffDoneRef.current) return;
    handoffDoneRef.current = true;
    awaitingHandoffRef.current = false;
    try {
      await WebBrowser.dismissBrowser();
    } catch {
      /* already dismissed */
    }
    await pullStripeConnectIntoDb();
    await refreshProfile();
    goHomeAfterConnect();
  }, [refreshProfile, goHomeAfterConnect]);

  useEffect(() => {
    const onUrl = (event: { url: string }) => {
      if (!awaitingHandoffRef.current) return;
      if (!isStripeConnectReturnUrl(event.url)) return;
      void completeStripeHandoff();
    };
    const sub = Linking.addEventListener("url", onUrl);
    return () => sub.remove();
  }, [completeStripeHandoff]);

  const finishedOnboardingRefresh = useCallback(async () => {
    setError(null);
    setStatusHint(null);
    setRefreshBusy(true);
    try {
      await pullStripeConnectIntoDb();
      const { driverStripeConnectOnboarded: onboarded } = await refreshProfile();
      if (onboarded === true) {
        goHomeAfterConnect();
        return;
      }
      setStatusHint(
        "Stripe still shows this account as incomplete, or the sync function is not deployed. " +
          "Finish every step in Stripe, deploy sync-driver-stripe-connect, then tap here again."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshBusy(false);
    }
  }, [refreshProfile, goHomeAfterConnect]);

  const copyReturnUrl = useCallback(async () => {
    if (!returnUrl) return;
    await Clipboard.setStringAsync(returnUrl);
    setCopiedHint(true);
    setTimeout(() => setCopiedHint(false), 2500);
  }, [returnUrl]);

  const openStripe = useCallback(async () => {
    setError(null);
    setStatusHint(null);
    setLoading(true);
    handoffDoneRef.current = false;
    try {
      if (!returnUrl) {
        throw new Error("Supabase URL missing — cannot build Stripe return URL.");
      }
      const res = await createConnectAccount({
        app_continue_url: appContinueUrl,
      });
      if (!res.ok || !res.onboarding_url) {
        throw new Error(res.error ?? "Could not start Stripe onboarding");
      }
      awaitingHandoffRef.current = true;
      try {
        if (Platform.OS === "web") {
          await WebBrowser.openBrowserAsync(res.onboarding_url);
        } else {
          const authResult = await WebBrowser.openAuthSessionAsync(res.onboarding_url, returnUrl);
          if (authResult.type === "success" && authResult.url && isStripeConnectReturnUrl(authResult.url)) {
            await completeStripeHandoff();
          }
        }
      } finally {
        if (!handoffDoneRef.current) {
          awaitingHandoffRef.current = false;
        }
      }
      if (!handoffDoneRef.current) {
        await pullStripeConnectIntoDb();
        const { driverStripeConnectOnboarded: onboarded } = await refreshProfile();
        if (onboarded === true) {
          goHomeAfterConnect();
        }
      }
    } catch (e) {
      awaitingHandoffRef.current = false;
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [returnUrl, appContinueUrl, refreshProfile, goHomeAfterConnect, completeStripeHandoff]);

  return (
    <SafeAreaWrapper edges={["top", "left", "right", "bottom"]}>
      <View className="flex-1 bg-background px-6 pt-8">
        <Text className="font-sora-display text-2xl font-bold text-text">Payouts</Text>
        <Text className="font-inter mt-2 text-sm leading-6 text-textSecondary">
          {driverStripeConnectOnboarded
            ? "Your bank and tax details are stored in Stripe. Use the button below to update them or refresh your account status."
            : "Connect a Stripe Express account so Lets Go can transfer your earnings. Stripe hosts onboarding — you will verify identity and bank details there."}
        </Text>

        <Card className="mt-8">
          <Text className="font-inter text-xs font-semibold uppercase text-textSecondary">
            Return URL (HTTPS)
          </Text>
          <Text className="font-inter mt-2 text-xs leading-5 text-textSecondary">
            Deploy Edge functions: <Text className="text-text">create-connect-account</Text>,{" "}
            <Text className="text-text">create-connect-account-return</Text>, and{" "}
            <Text className="text-text">sync-driver-stripe-connect</Text>. The return page redirects back
            into this app; sync updates your payout flag from Stripe even without webhooks.
          </Text>
          {returnUrl ? (
            <View className="mt-2">
              <Text
                selectable
                className="text-xs leading-5 text-primary"
                style={{ fontFamily: mono }}
              >
                {returnUrl.endsWith(STRIPE_CONNECT_RETURN_SUFFIX)
                  ? `${returnUrl.slice(0, -STRIPE_CONNECT_RETURN_SUFFIX.length)}\n${STRIPE_CONNECT_RETURN_SUFFIX}`
                  : returnUrl}
              </Text>
              <Text className="font-inter mt-1 text-[11px] leading-4 text-textSecondary">
                Path uses a digit: /v1/ (number one), not the letter L.
              </Text>
              <Button
                title={copiedHint ? "Copied" : "Copy full return URL"}
                variant="ghost"
                className="mt-2 min-h-0 py-3"
                textClassName="text-sm"
                onPress={() => void copyReturnUrl()}
              />
            </View>
          ) : (
            <Text className="font-inter mt-2 text-xs text-textSecondary">Configure EXPO_PUBLIC_SUPABASE_URL</Text>
          )}
        </Card>

        {error ? (
          <Text className="font-inter mt-4 text-sm text-error">{error}</Text>
        ) : null}
        {statusHint ? (
          <Text className="font-inter mt-3 text-sm leading-5 text-textSecondary">{statusHint}</Text>
        ) : null}

        <View className="mt-10 gap-3">
          <Button title="Continue with Stripe" loading={loading} onPress={() => void openStripe()} />
          <Button
            title={refreshBusy ? "Checking Stripe…" : "I finished onboarding — refresh"}
            variant="ghost"
            disabled={loading || refreshBusy}
            loading={refreshBusy}
            onPress={() => void finishedOnboardingRefresh()}
          />
          <Button
            title="Sign out"
            variant="ghost"
            disabled={loading || refreshBusy}
            onPress={() => void signOut()}
          />
        </View>
      </View>
    </SafeAreaWrapper>
  );
}
