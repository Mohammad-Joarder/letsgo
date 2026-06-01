import Constants from "expo-constants";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_DRIVER_REGISTRATION_FEATURE_FLAGS,
  type DriverRegistrationFeatureFlags,
  type DriverRegistrationFlagKey,
  DRIVER_REGISTRATION_FLAG_KEYS,
  parseDriverFfOverridesFromEnv,
} from "@/lib/driverRegistrationFeatureFlags";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type FeatureFlagsContextValue = {
  driverRegistration: DriverRegistrationFeatureFlags;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(undefined);

const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;

function mergeDriverRegistrationFlags(
  remote: Partial<Record<DriverRegistrationFlagKey, boolean>>,
  envOverrides: Partial<DriverRegistrationFeatureFlags>
): DriverRegistrationFeatureFlags {
  const out = { ...DEFAULT_DRIVER_REGISTRATION_FEATURE_FLAGS };
  for (const k of DRIVER_REGISTRATION_FLAG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(envOverrides, k)) {
      out[k] = Boolean(envOverrides[k]);
    } else if (Object.prototype.hasOwnProperty.call(remote, k)) {
      out[k] = Boolean(remote[k]);
    }
  }
  return out;
}

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [remote, setRemote] = useState<Partial<Record<DriverRegistrationFlagKey, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const envOverrides = useMemo(() => {
    const raw = process.env.EXPO_PUBLIC_DRIVER_FF_OVERRIDES ?? extra?.EXPO_PUBLIC_DRIVER_FF_OVERRIDES;
    return parseDriverFfOverridesFromEnv(raw);
  }, []);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setRemote({});
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase.from("app_feature_flags").select("flag_key, enabled");
      if (qErr) throw qErr;
      const map: Partial<Record<DriverRegistrationFlagKey, boolean>> = {};
      for (const row of data ?? []) {
        const key = row.flag_key as string;
        if (DRIVER_REGISTRATION_FLAG_KEYS.includes(key as DriverRegistrationFlagKey)) {
          map[key as DriverRegistrationFlagKey] = Boolean(row.enabled);
        }
      }
      setRemote(map);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load feature flags";
      setError(msg);
      setRemote({});
      if (__DEV__) {
        console.warn("[LetsGo] Feature flags fetch failed (using defaults + env overrides):", e);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const driverRegistration = useMemo(
    () => mergeDriverRegistrationFlags(remote, envOverrides),
    [remote, envOverrides]
  );

  const value = useMemo<FeatureFlagsContextValue>(
    () => ({
      driverRegistration,
      loading,
      error,
      refresh: load,
    }),
    [driverRegistration, loading, error, load]
  );

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlagsContext(): FeatureFlagsContextValue {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) {
    throw new Error("useFeatureFlagsContext must be used within FeatureFlagsProvider");
  }
  return ctx;
}
