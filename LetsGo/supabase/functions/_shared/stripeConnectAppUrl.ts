/**
 * URLs the HTTPS return page may redirect to. Includes Expo tunnel https URLs
 * (Linking.createURL can return https://*.exp.direct/... in some setups).
 */
export function isAllowedAppContinueUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const p = u.protocol.toLowerCase();
    if (p === "letsgo:" || p === "exp:" || p === "exps:" || p === "exp+letsgo:") {
      return true;
    }
    if (p === "https:" || p === "http:") {
      const host = u.hostname.toLowerCase();
      if (host.endsWith(".exp.direct") || host.endsWith(".expo.dev")) return true;
    }
    return false;
  } catch {
    return false;
  }
}
