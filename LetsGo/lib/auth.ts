import * as Linking from "expo-linking";
import { Platform } from "react-native";
import type { AuthError } from "@supabase/supabase-js";
import Constants from "expo-constants";
import type { UserRole } from "./types";
import { supabase } from "./supabase";

const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;

function truthyEnv(v: string | undefined): boolean {
  const t = v?.trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes";
}

/**
 * Redirect used in confirmation / magic-link emails. Must be listed in Supabase:
 * Authentication → URL Configuration → Redirect URLs (e.g. letsgo://**, exp://** for Expo Go).
 *
 * Set EXPO_PUBLIC_AUTH_EMAIL_REDIRECT in .env if the default does not match your allowlist.
 * Prefer a URL with a real host segment, e.g. letsgo://verify-otp (not letsgo:///--/(auth)/…).
 */
function getEmailConfirmationRedirect(email: string): string {
  const fromEnv =
    process.env.EXPO_PUBLIC_AUTH_EMAIL_REDIRECT ?? extra?.EXPO_PUBLIC_AUTH_EMAIL_REDIRECT;
  if (fromEnv?.trim()) {
    const base = fromEnv.trim();
    if (base.includes("email=")) return base;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}email=${encodeURIComponent(email)}`;
  }

  const q = { email };
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.location?.origin) {
      const u = new URL("/(auth)/verify-otp", window.location.origin);
      u.searchParams.set("email", email);
      return u.toString();
    }
  }

  // Expo Go: keep Linking.createURL so links stay exp://<host>:port/--/… and open the dev bundle.
  if (Constants.appOwnership === "expo") {
    return Linking.createURL("/(auth)/verify-otp", { queryParams: q });
  }

  const scheme =
    typeof Constants.expoConfig?.scheme === "string" && Constants.expoConfig.scheme.length > 0
      ? Constants.expoConfig.scheme
      : "letsgo";
  // Dev/production client: Linking.createURL yields letsgo:///--/(auth)/verify-otp, which parses
  // with an empty URL host. Supabase GoTrue can reject that redirect_to and fail to send mail.
  // Same idea as requestPasswordReset (letsgo://reset-password): use scheme://verify-otp?email=…
  return `${scheme}://verify-otp?email=${encodeURIComponent(email)}`;
}

/**
 * Never replace the server message — Supabase/GoTrue often returns a generic line while the real
 * reason is in Logs. We append Resend/SMTP checks that match Supabase docs.
 */
function formatSignUpError(error: AuthError): Error {
  const msg = (error.message ?? "Sign up failed").trim();
  const meta = [error.code ? `code: ${error.code}` : "", error.status != null ? `HTTP ${error.status}` : ""]
    .filter(Boolean)
    .join(" · ");
  const head = meta ? `${msg} (${meta})` : msg;

  const isMailServerFailure =
    error.status === 500 &&
    (error.code === "unexpected_failure" || /confirmation mail|confirmation email/i.test(msg));

  const mail500Hint = isMailServerFailure
    ? "\n\nThis 500 almost always means Supabase could not send mail on the server (not an app bug). In the dashboard: (1) Logs → filter by **auth** / **gotrue** and open the failed signup row for the real SMTP or hook error. (2) Authentication → **Hooks** → if **Send Email** is enabled, fix the hook URL/secret or turn it off to use SMTP only. (3) Authentication → Emails → **SMTP Settings** → use Resend: host smtp.resend.com, port 465 (SSL) or 587, user resend, password = Resend API key; sender address must use a domain verified in Resend. Send a test email from that screen. (4) To test redirect only: set EXPO_PUBLIC_AUTH_SIGNUP_OMIT_EMAIL_REDIRECT=true — if signup then works, fix **Site URL** and **Redirect URLs** under Authentication → URL Configuration."
    : "";

  const genericHint = isMailServerFailure
    ? "\n\n— Redirect URLs: keep letsgo://** and exp://**; Site URL must match how you ship the app."
    : "\n\n— If using Resend: Host smtp.resend.com, Port 465 (SSL) or 587, Username resend, Password = your Resend API key. Sender email must be on a domain verified in Resend (not noreply@resend.dev for bulk). In Supabase: Authentication → Emails → SMTP Settings, then check logs for the exact SMTP failure.\n— Redirect URLs: keep letsgo://** and exp://**; Site URL should be your web origin or https://localhost if testing web.";

  const hint = `${mail500Hint}${genericHint}`;

  if (__DEV__) {
    console.warn("[LetsGo signUp]", { message: error.message, code: error.code, status: error.status });
  }

  return new Error(head + hint);
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  metadata: { full_name: string; phone: string }
) {
  const omitRedirect =
    truthyEnv(process.env.EXPO_PUBLIC_AUTH_SIGNUP_OMIT_EMAIL_REDIRECT) ||
    truthyEnv(extra?.EXPO_PUBLIC_AUTH_SIGNUP_OMIT_EMAIL_REDIRECT);
  const emailRedirectTo = omitRedirect ? undefined : getEmailConfirmationRedirect(email.trim());
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      ...(emailRedirectTo ? { emailRedirectTo } : {}),
      data: {
        full_name: metadata.full_name,
        phone: metadata.phone,
      },
    },
  });
  if (error) throw formatSignUpError(error);
  return data;
}

export async function verifyEmailOtp(email: string, token: string) {
  const trimmed = token.replace(/\s/g, "");
  const tryTypes = ["signup", "email"] as const;
  let lastError: Error | null = null;
  for (const type of tryTypes) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: trimmed,
      type,
    });
    if (!error) return data;
    lastError = error;
  }
  if (lastError) throw lastError;
  return null;
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "letsgo://reset-password",
  });
  if (error) throw error;
}

export async function signOut() {
  // `local` avoids revoking all devices over the network; faster and less likely to hang offline.
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
}

export async function createRiderProfile(params: {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
}) {
  const { error: profileError } = await supabase.from("profiles").insert({
    id: params.userId,
    role: "rider",
    full_name: params.fullName,
    email: params.email,
    phone: params.phone,
  });
  if (profileError) throw profileError;

  const { error: riderError } = await supabase.from("riders").insert({
    id: params.userId,
  });
  if (riderError) throw riderError;
}

export async function createDriverProfile(params: {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
}) {
  const { error: profileError } = await supabase.from("profiles").insert({
    id: params.userId,
    role: "driver",
    full_name: params.fullName,
    email: params.email,
    phone: params.phone,
  });
  if (profileError) throw profileError;

  const { error: driverError } = await supabase.from("drivers").insert({
    id: params.userId,
    approval_status: "pending",
    current_status: "offline",
    is_online: false,
  });
  if (driverError) throw driverError;

  const { error: vehicleError } = await supabase.from("vehicles").insert({
    driver_id: params.userId,
    make: "Pending",
    model: "Setup",
    color: "—",
    year: new Date().getFullYear(),
    plate_number: "PENDING",
    category: "sedan",
    ride_type: "economy",
    is_active: true,
    is_approved: true,
  });
  if (vehicleError) throw vehicleError;
}

export async function completeRoleSelection(
  role: Exclude<UserRole, "admin">,
  meta: { userId: string; fullName: string; email: string; phone: string }
) {
  if (role === "rider") {
    await createRiderProfile({
      userId: meta.userId,
      fullName: meta.fullName,
      email: meta.email,
      phone: meta.phone,
    });
    return;
  }
  await createDriverProfile({
    userId: meta.userId,
    fullName: meta.fullName,
    email: meta.email,
    phone: meta.phone,
  });
}
