import type { ride_type } from "./types";

export const COLORS = {
  primary: "#00D4AA",
  background: "#0A0E1A",
  surface: "#131929",
  surface2: "#1C2438",
  text: "#FFFFFF",
  textSecondary: "#8A94A6",
  accent: "#FF6B35",
  success: "#22C55E",
  error: "#EF4444",
  border: "#1E2D45",
} as const;

export const RIDE_TYPES: {
  id: ride_type;
  label: string;
  description: string;
  seats: number;
}[] = [
  { id: "economy", label: "Economy", description: "Affordable everyday rides", seats: 4 },
  { id: "comfort", label: "Comfort", description: "Extra space & newer cars", seats: 4 },
  { id: "premium", label: "Premium", description: "Top-rated drivers", seats: 4 },
  { id: "xl", label: "XL", description: "Groups & extra luggage", seats: 6 },
];

export const APP_TAGLINE = "Get there, your way.";

/** Matches on-logo tagline — use on welcome / marketing surfaces. */
export const BRAND_TAGLINE = "Ride Smart. Pay Less.";
