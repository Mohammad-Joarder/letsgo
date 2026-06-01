import { type Href, Redirect } from "expo-router";

/**
 * Legacy route after role selection — Phase 7 onboarding lives under (driver).
 */
export default function DriverReviewPendingScreen() {
  return <Redirect href={"/(driver)/onboarding-status" as Href} />;
}
