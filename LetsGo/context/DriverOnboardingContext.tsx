/**
 * Multi-step driver onboarding state.
 * Persists across app restarts via AsyncStorage.
 * Wraps only the onboarding stack — not the entire app.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OnboardingFormData = {
  // Step 1 — personal
  fullName: string;
  dateOfBirth: string;
  phone: string;

  // Step 2 — licence (non-document fields)
  licenseNumber: string;
  licenseExpiry: string;

  // Step 3 — vehicle
  make: string;
  model: string;
  color: string;
  year: string;
  plate: string;
  category: string;
  rideType: string;
  seats: string;
  regExpiry: string;

  // Step 7 — bank
  bsb: string;
  accountNumber: string;

  // Background consent
  consentChecked: boolean;
  signatureUri: string | null;
};

type DriverOnboardingContextValue = {
  form: OnboardingFormData;
  setField: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
  resetForm: () => void;
  /** Last step the user reached — used to highlight progress. */
  highWaterStep: number;
  setHighWaterStep: (step: number) => void;
  loaded: boolean;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_FORM: OnboardingFormData = {
  fullName: "",
  dateOfBirth: "",
  phone: "",
  licenseNumber: "",
  licenseExpiry: "",
  make: "",
  model: "",
  color: "Black",
  year: String(new Date().getFullYear()),
  plate: "",
  category: "sedan",
  rideType: "economy",
  seats: "4",
  regExpiry: "",
  bsb: "",
  accountNumber: "",
  consentChecked: false,
  signatureUri: null,
};

const STORAGE_KEY = "letsgo_driver_onboarding_form_v1";
const HWS_KEY = "letsgo_driver_onboarding_hws_v1";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const DriverOnboardingContext = createContext<DriverOnboardingContextValue | null>(null);

export function DriverOnboardingProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<OnboardingFormData>(DEFAULT_FORM);
  const [highWaterStep, setHighWaterStepState] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rehydrate on mount
  useEffect(() => {
    void (async () => {
      try {
        const [raw, hws] = await AsyncStorage.multiGet([STORAGE_KEY, HWS_KEY]);
        const rawForm = raw[1];
        const rawHws = hws[1];
        if (rawForm) {
          const parsed = JSON.parse(rawForm) as Partial<OnboardingFormData>;
          setForm((prev) => ({ ...prev, ...parsed }));
        }
        if (rawHws) {
          const n = Number.parseInt(rawHws, 10);
          if (Number.isFinite(n) && n >= 1) setHighWaterStepState(n);
        }
      } catch {
        // corrupt storage — start fresh
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Debounced persist on form change (skip signatureUri — too large for AsyncStorage)
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const { signatureUri: _uri, ...persistable } = form;
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [form, loaded]);

  const setField = useCallback(
    <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetForm = useCallback(async () => {
    setForm(DEFAULT_FORM);
    setHighWaterStepState(1);
    await AsyncStorage.multiRemove([STORAGE_KEY, HWS_KEY]);
  }, []);

  const setHighWaterStep = useCallback(
    (step: number) => {
      const next = Math.max(highWaterStep, step);
      setHighWaterStepState(next);
      void AsyncStorage.setItem(HWS_KEY, String(next));
    },
    [highWaterStep]
  );

  return (
    <DriverOnboardingContext.Provider
      value={{ form, setField, resetForm, highWaterStep, setHighWaterStep, loaded }}
    >
      {children}
    </DriverOnboardingContext.Provider>
  );
}

export function useDriverOnboarding(): DriverOnboardingContextValue {
  const ctx = useContext(DriverOnboardingContext);
  if (!ctx)
    throw new Error("useDriverOnboarding must be used inside <DriverOnboardingProvider>");
  return ctx;
}
