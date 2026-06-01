import { postEdgeFunctionWithUserJwt } from "@/lib/edgeFunctionFetch";

export async function edgeAbrLookup(
  accessToken: string,
  params: { abn: string; persist: boolean }
): Promise<Record<string, unknown>> {
  return postEdgeFunctionWithUserJwt("abr-lookup-abn", params, accessToken, 30_000);
}

export async function edgeRegisterDevice(
  accessToken: string,
  body: { fingerprint: string; metadata?: Record<string, unknown> }
): Promise<Record<string, unknown>> {
  return postEdgeFunctionWithUserJwt("register-driver-device", body, accessToken, 25_000);
}

export async function edgeEvaluateFraud(accessToken: string): Promise<Record<string, unknown>> {
  return postEdgeFunctionWithUserJwt("evaluate-driver-fraud", {}, accessToken, 30_000);
}
