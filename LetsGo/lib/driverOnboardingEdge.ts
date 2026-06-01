import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

export type SubmitDriverOnboardingResponse = {
  ok: boolean;
  already_submitted?: boolean;
  error?: string;
};

export async function submitDriverOnboardingApplication(): Promise<SubmitDriverOnboardingResponse> {
  return invokeEdgeFunction<SubmitDriverOnboardingResponse>("submit-driver-onboarding", {});
}
