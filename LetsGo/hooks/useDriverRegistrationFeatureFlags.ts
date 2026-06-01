import { useFeatureFlagsContext } from "@/context/FeatureFlagsContext";

/** Remote + env-merged flags for driver registration / compliance features. */
export function useDriverRegistrationFeatureFlags() {
  const { driverRegistration, loading, error, refresh } = useFeatureFlagsContext();
  return { flags: driverRegistration, loading, error, refresh };
}
