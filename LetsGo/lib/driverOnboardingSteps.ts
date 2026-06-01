import type { Href } from "expo-router";

export type DriverOnboardingStepDef = {
  step: number;
  route: Href;
  slug: string;
  title: string;
  shortTitle: string;
};

export const DRIVER_ONBOARDING_STEPS: readonly DriverOnboardingStepDef[] = [
  {
    step: 1,
    slug: "step1-personal",
    route: "/(driver)/onboarding/step1-personal" as Href,
    title: "Personal details",
    shortTitle: "Personal",
  },
  {
    step: 2,
    slug: "step2-license",
    route: "/(driver)/onboarding/step2-license" as Href,
    title: "Driver licence",
    shortTitle: "Licence",
  },
  {
    step: 3,
    slug: "step3-vehicle",
    route: "/(driver)/onboarding/step3-vehicle" as Href,
    title: "Vehicle",
    shortTitle: "Vehicle",
  },
  {
    step: 4,
    slug: "step4-vehicle-docs",
    route: "/(driver)/onboarding/step4-vehicle-docs" as Href,
    title: "Vehicle documents",
    shortTitle: "Documents",
  },
  {
    step: 5,
    slug: "step5-vehicle-photo",
    route: "/(driver)/onboarding/step5-vehicle-photo" as Href,
    title: "Vehicle photo",
    shortTitle: "Vehicle photo",
  },
  {
    step: 6,
    slug: "step6-profile-photo",
    route: "/(driver)/onboarding/step6-profile-photo" as Href,
    title: "Profile photo",
    shortTitle: "Profile photo",
  },
  {
    step: 7,
    slug: "step-background-consent",
    route: "/(driver)/onboarding/step-background-consent" as Href,
    title: "Background check",
    shortTitle: "Consent",
  },
  {
    step: 8,
    slug: "step7-bank",
    route: "/(driver)/onboarding/step7-bank" as Href,
    title: "Bank details",
    shortTitle: "Bank",
  },
  {
    step: 9,
    slug: "step8-review",
    route: "/(driver)/onboarding/step8-review" as Href,
    title: "Review",
    shortTitle: "Review",
  },
  {
    step: 10,
    slug: "step9-submitted",
    route: "/(driver)/onboarding/step9-submitted" as Href,
    title: "Submit application",
    shortTitle: "Submit",
  },
] as const;

export const DRIVER_ONBOARDING_HUB_ROUTE = "/(driver)/onboarding-status" as Href;

export const DRIVER_ONBOARDING_TOTAL_STEPS = DRIVER_ONBOARDING_STEPS.length;

export function onboardingStepByNumber(step: number): DriverOnboardingStepDef | undefined {
  return DRIVER_ONBOARDING_STEPS.find((s) => s.step === step);
}

export function onboardingStepRoute(step: number): Href {
  return onboardingStepByNumber(step)?.route ?? DRIVER_ONBOARDING_STEPS[0].route;
}

export function previousOnboardingStepRoute(step: number): Href | null {
  if (step <= 1) return null;
  return onboardingStepRoute(step - 1);
}

export function nextOnboardingStepRoute(step: number): Href | null {
  if (step >= DRIVER_ONBOARDING_TOTAL_STEPS) return null;
  return onboardingStepRoute(step + 1);
}
