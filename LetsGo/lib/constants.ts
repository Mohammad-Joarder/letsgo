// ============================================================
// Let's Go — App Constants & Design System
// ============================================================

export const COLORS = {
  primary: "#00D4AA",
  primaryDark: "#00A886",
  primaryLight: "#33DDBB",
  background: "#0A0E1A",
  surface: "#131929",
  surface2: "#1C2438",
  surface3: "#243050",
  border: "#1E2D45",
  borderLight: "#2A3D5C",
  accent: "#FF6B35",
  accentLight: "#FF8C5A",
  success: "#22C55E",
  successLight: "#4ADE80",
  error: "#EF4444",
  errorLight: "#F87171",
  warning: "#F59E0B",
  text: "#FFFFFF",
  textSecondary: "#8A94A6",
  textMuted: "#4A5568",
  overlay: "rgba(0, 0, 0, 0.6)",
  overlayLight: "rgba(0, 0, 0, 0.3)",
  transparent: "transparent",
};

export const FONTS = {
  soraRegular: "Sora_400Regular",
  soraMedium: "Sora_500Medium",
  soraSemiBold: "Sora_600SemiBold",
  soraBold: "Sora_700Bold",
  interRegular: "Inter_400Regular",
  interMedium: "Inter_500Medium",
  interSemiBold: "Inter_600SemiBold",
  interBold: "Inter_700Bold",
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const SUPABASE_URL = "https://vbvlytmfnozsjldzgdcr.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZidmx5dG1mbm96c2psZHpnZGNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MTM4NDksImV4cCI6MjA5MDQ4OTg0OX0.R_vQ78QQpzYyMgMcRxzqfaHmT9EHqr2RakG4qNG4cNU";
export const GOOGLE_MAPS_API_KEY = "AIzaSyAFpB2iu9OlJFMP6PtB2VPyjY0CAESC7sw";

export const RIDE_TYPES = {
  economy: {
    id: "economy" as const,
    label: "Economy",
    description: "Affordable everyday rides",
    icon: "🚗",
    seats: 4,
    color: COLORS.textSecondary,
  },
  comfort: {
    id: "comfort" as const,
    label: "Comfort",
    description: "Newer cars, extra legroom",
    icon: "🚙",
    seats: 4,
    color: COLORS.primary,
  },
  premium: {
    id: "premium" as const,
    label: "Premium",
    description: "Luxury vehicles, top-rated drivers",
    icon: "🏎️",
    seats: 4,
    color: COLORS.warning,
  },
  xl: {
    id: "xl" as const,
    label: "XL",
    description: "Spacious rides for groups",
    icon: "🚐",
    seats: 6,
    color: COLORS.accent,
  },
};

export const DRIVER_TIERS = {
  standard: { label: "Standard", color: COLORS.textSecondary, bonusPercent: 0 },
  silver: { label: "Silver", color: "#C0C0C0", bonusPercent: 5 },
  gold: { label: "Gold", color: "#FFD700", bonusPercent: 8 },
  platinum: { label: "Platinum", color: "#E5E4E2", bonusPercent: 12 },
};

export const TIER_THRESHOLDS = {
  standard: 0,
  silver: 20,
  gold: 50,
  platinum: 100,
};

export const PLATFORM_CONFIG = {
  currency: "AUD",
  currencySymbol: "$",
  country: "AU",
  emergencyNumber: "000",
  minCancellationFreeSeconds: 120, // 2 min after driver accepted
  driverSearchRadiusKm: 5,
  driverSearchTimeoutSeconds: 15,
  locationUpdateIntervalMs: 2000,
  maxSurgeMultiplier: 3.0,
  platformName: "Let's Go",
};

export const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0A0E1A" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0A0E1A" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8A94A6" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8A94A6" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8A94A6" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#0D1520" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1C2438" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#131929" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#243050" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1C2438" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#FFFFFF" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#131929" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8A94A6" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0D1A2D" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
];
