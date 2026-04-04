import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/** Seconds before access_token expiry when we proactively refresh (gateway rejects expired JWTs). */
const ACCESS_TOKEN_REFRESH_SKEW_SEC = 120;
const REFRESH_SESSION_CAP_MS = 20_000;

async function refreshSessionCapped(expiresAt: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const refreshed = await Promise.race([
    supabase.auth.refreshSession(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), REFRESH_SESSION_CAP_MS)),
  ]);
  if (refreshed === null) {
    if (expiresAt <= now) {
      throw new Error("Could not refresh session. Check your connection and try again.");
    }
    return;
  }
  const { error } = refreshed;
  if (error && expiresAt <= now) {
    throw new Error("Session expired. Please sign in again.");
  }
}

/**
 * Edge Functions with verify_jwt see the Bearer from getSession(); stale tokens → 401 Invalid JWT.
 * Refreshes when the token is expired or within skew of expiring.
 */
async function ensureFreshAccessTokenForEdge(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.expires_at) {
    return;
  }
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at > now + ACCESS_TOKEN_REFRESH_SKEW_SEC) {
    return;
  }
  if (!session.refresh_token) {
    if (session.expires_at <= now) {
      throw new Error("Session expired. Please sign in again.");
    }
    return;
  }
  await refreshSessionCapped(session.expires_at);
}

async function readHttpErrorDetail(error: FunctionsHttpError): Promise<string> {
  const res = error.context as Response;
  let raw = "";
  try {
    raw = (await res.clone().text()).trim();
  } catch {
    return "";
  }
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as {
      error?: string | { message?: string };
      message?: string;
      msg?: string;
    };
    if (typeof parsed.error === "string") return parsed.error;
    if (parsed.error && typeof parsed.error === "object" && typeof parsed.error.message === "string") {
      return parsed.error.message;
    }
    if (typeof parsed.message === "string") return parsed.message;
    if (typeof parsed.msg === "string") return parsed.msg;
  } catch {
    // not JSON
  }
  return raw;
}

/**
 * Invokes a Supabase Edge Function. On non-2xx, parses the response body so
 * callers see the server's `error` / `message` instead of only the generic
 * "Edge Function returned a non-2xx status code".
 */
const DEFAULT_EDGE_TIMEOUT_MS = 55_000;

export type InvokeEdgeOptions = {
  timeoutMs?: number;
  /**
   * Skip getSession/refreshSession before invoke. Use for functions with verify_jwt=false
   * (e.g. get-fare-estimate) so a stuck or contended auth refresh cannot block fare loading.
   */
  skipAuthRefresh?: boolean;
};

export async function invokeEdgeFunction<T>(
  name: string,
  body: Record<string, unknown> = {},
  options?: InvokeEdgeOptions
): Promise<T> {
  if (!options?.skipAuthRefresh) {
    await ensureFreshAccessTokenForEdge();
  }

  const timeout = options?.timeoutMs ?? DEFAULT_EDGE_TIMEOUT_MS;
  let { data, error } = await supabase.functions.invoke(name, { body, timeout });

  if (error instanceof FunctionsHttpError && error.context.status === 401 && !options?.skipAuthRefresh) {
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    if (s?.expires_at != null) {
      await refreshSessionCapped(s.expires_at);
    } else {
      await Promise.race([
        supabase.auth.refreshSession(),
        new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), REFRESH_SESSION_CAP_MS)),
      ]);
    }
    const retry = await supabase.functions.invoke(name, { body, timeout });
    data = retry.data;
    error = retry.error;
  }

  if (!error) {
    return data as T;
  }

  if (error instanceof FunctionsFetchError) {
    const aborted =
      error.context?.name === "AbortError" || String(error.context?.message ?? "").includes("aborted");
    throw new Error(
      aborted
        ? `${name}: request timed out — check your connection and try again.`
        : `${name}: ${error.message}`
    );
  }

  if (error instanceof FunctionsHttpError) {
    const status = (error.context as Response).status;
    const detail = await readHttpErrorDetail(error);
    throw new Error(
      detail ? `${name} (${status}): ${detail}` : `${name} (${status}): ${error.message}`
    );
  }

  throw new Error(error.message ?? `${name} failed`);
}
