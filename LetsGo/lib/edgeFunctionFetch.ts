import Constants from "expo-constants";

/**
 * Direct POST to Supabase Edge (bypasses supabase.functions.invoke).
 * React Native + AbortSignal is more reliable than the client's invoke timeout for hung requests.
 */
function getSupabasePublicConfig(): { url: string; anonKey: string } {
  const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
  const url = (
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    extra?.EXPO_PUBLIC_SUPABASE_URL ??
    ""
  )
    .trim()
    .replace(/\/$/, "");
  const anonKey = (
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim();
  return { url, anonKey };
}

function rejectAfter(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

/**
 * RN fetch sometimes ignores AbortSignal; Promise.race still completes our await so the UI unblocks.
 */
async function postEdgeFunctionRaw<T>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  bearerToken: string
): Promise<T> {
  const { url: base, anonKey } = getSupabasePublicConfig();
  if (!base || !anonKey) {
    throw new Error("Supabase is not configured (URL / anon key).");
  }
  const url = `${base}/functions/v1/${functionName}`;
  const bearer = bearerToken.trim();
  const ac = new AbortController();
  const bodyReadCap = Math.min(30_000, Math.max(10_000, timeoutMs - 2000));
  const timeoutMsg = `${functionName}: timed out — check connection and try again.`;

  const run = async (): Promise<T> => {
    const res = await fetch(url, {
      method: "POST",
      signal: ac.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
        apikey: anonKey,
      },
      body: JSON.stringify(body),
    });
    const text = await Promise.race([
      res.text(),
      rejectAfter(bodyReadCap, `${functionName}: response body timed out`),
    ]);
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`${functionName}: invalid response from server`);
    }
    if (!res.ok) {
      const err = data as { error?: string; message?: string };
      const msg =
        typeof err?.error === "string"
          ? err.error
          : typeof err?.message === "string"
            ? err.message
            : text.slice(0, 200);
      throw new Error(`${functionName} (${res.status}): ${msg}`);
    }
    return data as T;
  };

  const runPromise = run();
  try {
    return await Promise.race([
      runPromise,
      rejectAfter(timeoutMs, timeoutMsg).finally(() => {
        try {
          ac.abort();
        } catch {
          /* ignore */
        }
      }),
    ]);
  } catch (e) {
    void runPromise.catch(() => {
      /* race already settled; ignore late failure from in-flight fetch */
    });
    if (e instanceof Error && (e.name === "AbortError" || e.message.includes("aborted"))) {
      throw new Error(timeoutMsg);
    }
    throw e;
  }
}

/** Public Edge function (e.g. verify_jwt = false). Uses anon JWT in Authorization. */
export async function postEdgeFunctionJson<T>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<T> {
  const { anonKey } = getSupabasePublicConfig();
  if (!anonKey) {
    throw new Error("Supabase is not configured (URL / anon key).");
  }
  return postEdgeFunctionRaw<T>(functionName, body, timeoutMs, anonKey);
}

/**
 * Authenticated Edge function (verify_jwt). Uses the user's access token in Authorization.
 * Prefer this over supabase.functions.invoke on React Native — invoke can hang past its timeout.
 */
export async function postEdgeFunctionWithUserJwt<T>(
  functionName: string,
  body: Record<string, unknown>,
  accessToken: string,
  timeoutMs: number
): Promise<T> {
  return postEdgeFunctionRaw<T>(functionName, body, timeoutMs, accessToken);
}
