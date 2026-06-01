import AsyncStorage from "@react-native-async-storage/async-storage";

const STEP_KEY = "letsgo_driver_onboarding_step_v1";
const DRAFT_VEHICLE_KEY = "letsgo_driver_onboarding_vehicle_draft_v1";

export type VehicleDraft = {
  make: string;
  model: string;
  color: string;
  year: number;
  plate_number: string;
  category: "sedan" | "suv" | "van" | "luxury";
  ride_type: "economy" | "comfort" | "premium" | "xl";
  seat_count: number;
  registration_expiry: string;
};

export async function saveOnboardingStep(step: number): Promise<void> {
  await AsyncStorage.setItem(STEP_KEY, String(Math.max(1, Math.min(10, step))));
}

export async function loadOnboardingStep(): Promise<number> {
  const raw = await AsyncStorage.getItem(STEP_KEY);
  const n = raw ? Number.parseInt(raw, 10) : 1;
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > 10) return 10;
  return n;
}

export async function clearOnboardingProgress(): Promise<void> {
  await AsyncStorage.multiRemove([STEP_KEY, DRAFT_VEHICLE_KEY]);
}

export async function saveVehicleDraft(d: Partial<VehicleDraft>): Promise<void> {
  const prev = await loadVehicleDraft();
  await AsyncStorage.setItem(DRAFT_VEHICLE_KEY, JSON.stringify({ ...prev, ...d }));
}

export async function loadVehicleDraft(): Promise<Partial<VehicleDraft>> {
  const raw = await AsyncStorage.getItem(DRAFT_VEHICLE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<VehicleDraft>;
  } catch {
    return {};
  }
}
