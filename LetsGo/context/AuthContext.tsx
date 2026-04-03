import type { Session, User } from "@supabase/supabase-js";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { DriverApprovalStatus, DriverRow, Profile, UserRole } from "@/lib/types";

type AuthContextValue = {
  initialized: boolean;
  profileLoading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  driverApproval: DriverApprovalStatus | null;
  configError: string | null;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

async function fetchDriverApproval(userId: string): Promise<DriverApprovalStatus | null> {
  const { data, error } = await supabase
    .from("drivers")
    .select("approval_status")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (data as DriverRow).approval_status;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [driverApproval, setDriverApproval] = useState<DriverApprovalStatus | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const loadProfileForUser = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      setDriverApproval(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    try {
      const p = await fetchProfile(userId);
      setProfile(p);
      if (p?.role === "driver") {
        const status = await fetchDriverApproval(userId);
        setDriverApproval(status);
      } else {
        setDriverApproval(null);
      }
    } catch (e) {
      console.error("[Lets Go] Profile load failed:", e);
      setProfile(null);
      setDriverApproval(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const uid = session?.user?.id;
    await loadProfileForUser(uid);
  }, [loadProfileForUser, session?.user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!isSupabaseConfigured) {
        if (!cancelled) {
          setConfigError(
            "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env (see .env.example)."
          );
          setInitialized(true);
        }
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (cancelled) return;
        setSession(data.session);
        await loadProfileForUser(data.session?.user?.id);
      } catch (e) {
        if (!cancelled) {
          console.error("[Lets Go] Session restore failed:", e);
          setSession(null);
          setProfile(null);
          setDriverApproval(null);
        }
      } finally {
        if (!cancelled) setInitialized(true);
      }
    }

    void boot();

    if (!isSupabaseConfigured) {
      return () => {
        cancelled = true;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      await loadProfileForUser(nextSession?.user?.id);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadProfileForUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      initialized,
      profileLoading,
      session,
      user: session?.user ?? null,
      profile,
      driverApproval,
      configError,
      refreshProfile,
    }),
    [initialized, profileLoading, session, profile, driverApproval, configError, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return ctx;
}

export type { UserRole };
