import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase, Profile, UserRole } from "@/lib/supabase";
import { getProfile } from "@/lib/auth";

// ─── State & Actions ──────────────────────────────────────────

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

type AuthAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_SESSION"; payload: { session: Session | null; user: User | null } }
  | { type: "SET_PROFILE"; payload: Profile | null }
  | { type: "SIGN_OUT" };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_SESSION":
      return {
        ...state,
        session: action.payload.session,
        user: action.payload.user,
        isAuthenticated: !!action.payload.session,
        isLoading: false,
      };
    case "SET_PROFILE":
      return { ...state, profile: action.payload };
    case "SIGN_OUT":
      return {
        session: null,
        user: null,
        profile: null,
        isLoading: false,
        isAuthenticated: false,
      };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────

interface AuthContextValue extends AuthState {
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, {
    session: null,
    user: null,
    profile: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const profile = await getProfile(userId);
      dispatch({ type: "SET_PROFILE", payload: profile });
    } catch (error) {
      console.error("Error loading profile:", error);
      dispatch({ type: "SET_PROFILE", payload: null });
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (state.user?.id) {
      await loadProfile(state.user.id);
    }
  }, [state.user?.id, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    dispatch({ type: "SIGN_OUT" });
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      dispatch({
        type: "SET_SESSION",
        payload: { session, user: session?.user ?? null },
      });
      if (session?.user) {
        loadProfile(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        dispatch({
          type: "SET_SESSION",
          payload: { session, user: session?.user ?? null },
        });

        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          dispatch({ type: "SET_PROFILE", payload: null });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  return (
    <AuthContext.Provider value={{ ...state, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
