import { useAuth } from "@/hooks/useAuth";

export function useProfile() {
  const { profile, refreshProfile, initialized } = useAuth();
  return { profile, refreshProfile, initialized };
}
