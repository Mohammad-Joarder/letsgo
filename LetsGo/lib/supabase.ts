import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;

const supabaseUrl = (
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  extra?.EXPO_PUBLIC_SUPABASE_URL ??
  ""
).trim();

const supabaseAnonKey = (
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  ""
).trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** Path segment after project host; keep in sync with Edge default in create-connect-account. */
export const STRIPE_CONNECT_RETURN_SUFFIX = "/functions/v1/create-connect-account-return";

/** HTTPS URL Stripe accepts for Connect return/refresh; must match WebBrowser.openAuthSessionAsync redirect. */
export function getStripeConnectReturnUrl(): string | null {
  const base = supabaseUrl.replace(/\/$/, "");
  if (!base) return null;
  return `${base}${STRIPE_CONNECT_RETURN_SUFFIX}`;
}

let client: SupabaseClient | null = null;

function getOrCreateClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file (see .env.example)."
    );
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const real = getOrCreateClient();
    const value = Reflect.get(real, prop, receiver);
    if (typeof value === "function") {
      return value.bind(real);
    }
    return value;
  },
});
