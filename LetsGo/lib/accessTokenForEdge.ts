import { supabase } from "@/lib/supabase";

/** Seconds — refresh before Edge gateway rejects JWT as expired. */
const EXPIRY_SKEW_SEC = 120;

/**
 * Returns a user access_token suitable for Authorization on JWT-verified Edge functions.
 * Refreshes when expired or within skew of expiring.
 */
export async function getUserAccessTokenForEdge(): Promise<string> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message ?? "Session error.");
  }
  if (!session?.access_token) {
    throw new Error("Sign in required.");
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = session.expires_at ?? 0;

  if (exp > now + EXPIRY_SKEW_SEC) {
    return session.access_token;
  }

  if (!session.refresh_token) {
    if (exp <= now) {
      throw new Error("Session expired. Please sign in again.");
    }
    return session.access_token;
  }

  const { data: refreshed, error: rErr } = await supabase.auth.refreshSession();
  if (rErr && exp <= now) {
    throw new Error("Session expired. Please sign in again.");
  }
  if (rErr && exp > now) {
    return session.access_token;
  }

  const t = refreshed.session?.access_token;
  if (t) return t;

  const {
    data: { session: s2 },
  } = await supabase.auth.getSession();
  const t2 = s2?.access_token;
  if (!t2) {
    throw new Error("Could not refresh session. Please sign in again.");
  }
  return t2;
}

/** After a 401 from Edge, force refresh and return new token or throw. */
export async function refreshUserAccessTokenForEdge(): Promise<string> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    throw new Error(
      `Could not refresh your session (${error.message}). Please sign out and sign in again.`
    );
  }
  const t = data.session?.access_token;
  if (t) return t;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const t2 = session?.access_token;
  if (!t2) {
    throw new Error("Sign in again to continue.");
  }
  return t2;
}
