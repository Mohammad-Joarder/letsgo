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
  /** Set when `profile.role === "driver"` after the drivers row is loaded; otherwise `null`. */
  driverStripeConnectOnboarded: boolean | null;
  configError: string | null;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

async function fetchDriverState(userId: string): Promise<{
  approval: DriverApprovalStatus;
  stripeConnectOnboarded: boolean;
} | null> {
  const { data, error } = await supabase
    .from("drivers")
    .select("approval_status, stripe_connect_onboarded")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as DriverRow;
  return {
    approval: row.approval_status,
    stripeConnectOnboarded: Boolean(row.stripe_connect_onboarded),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [driverApproval, setDriverApproval] = useState<DriverApprovalStatus | null>(null);
  const [driverStripeConnectOnboarded, setDriverStripeConnectOnboarded] = useState<boolean | null>(
    null
  );
  const [configError, setConfigError] = useState<string | null>(null);

  const loadProfileForUser = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      setDriverApproval(null);
      setDriverStripeConnectOnboarded(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    try {
      const p = await fetchProfile(userId);
      setProfile(p);
      if (p?.role === "driver") {
        const d = await fetchDriverState(userId);
        setDriverApproval(d?.approval ?? null);
        setDriverStripeConnectOnboarded(d ? d.stripeConnectOnboarded : null);
      } else {
        setDriverApproval(null);
        setDriverStripeConnectOnboarded(null);
      }
    } catch (e) {
      console.error("[Lets Go] Profile load failed:", e);
      setProfile(null);
      setDriverApproval(null);
      setDriverStripeConnectOnboarded(null);
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
          setDriverStripeConnectOnboarded(null);
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
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      // Never await Supabase calls inside this callback — it runs under an auth lock and
      // deadlocks getSession(), signOut(), and refresh (see auth-js onAuthStateChange docs).
      setTimeout(() => {
        void loadProfileForUser(nextSession?.user?.id);
      }, 0);
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
      driverStripeConnectOnboarded,
      configError,
      refreshProfile,
    }),
    [
      initialized,
      profileLoading,
      session,
      profile,
      driverApproval,
      driverStripeConnectOnboarded,
      configError,
      refreshProfile,
    ]
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
