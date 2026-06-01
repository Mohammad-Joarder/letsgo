/** Color palettes — see LetsGo_Color_Themes.md */

export type ColorTheme = "dark" | "light";

export type AppColors = {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  background: string;
  surface: string;
  surface2: string;
  surface3: string;
  border: string;
  borderLight: string;
  accent: string;
  accentLight: string;
  success: string;
  successLight: string;
  error: string;
  errorLight: string;
  warning: string;
  warningLight: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  overlay: string;
  overlayLight: string;
  transparent: string;
};

export const COLORS_DARK: AppColors = {
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
  warningLight: "#FCD34D",
  text: "#FFFFFF",
  textSecondary: "#8A94A6",
  textMuted: "#4A5568",
  overlay: "rgba(0, 0, 0, 0.65)",
  overlayLight: "rgba(0, 0, 0, 0.35)",
  transparent: "transparent",
};

export const COLORS_LIGHT: AppColors = {
  primary: "#00B894",
  primaryDark: "#009578",
  primaryLight: "#00D4AA",
  background: "#F8F9FC",
  surface: "#FFFFFF",
  surface2: "#F0F2F8",
  surface3: "#E8ECF5",
  border: "#E2E6F0",
  borderLight: "#EEF1F8",
  accent: "#FF5722",
  accentLight: "#FF7043",
  success: "#16A34A",
  successLight: "#22C55E",
  error: "#DC2626",
  errorLight: "#EF4444",
  warning: "#D97706",
  warningLight: "#F59E0B",
  text: "#0D1117",
  textSecondary: "#5A6478",
  textMuted: "#9BA3B4",
  overlay: "rgba(13, 17, 23, 0.62)",
  overlayLight: "rgba(13, 17, 23, 0.28)",
  transparent: "transparent",
};

export function getColors(theme: ColorTheme): AppColors {
  return theme === "dark" ? COLORS_DARK : COLORS_LIGHT;
}

export type MapStyleEntry = {
  elementType?: string;
  featureType?: string;
  stylers: { color: string }[];
};

export const MAP_STYLE_DARK: MapStyleEntry[] = [
  { elementType: "geometry", stylers: [{ color: "#0A0E1A" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0A0E1A" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8A94A6" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1C2438" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#131929" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#243050" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1C2438" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#0D1520" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0D1A2D" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#131929" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8A94A6" }],
  },
];

export const MAP_STYLE_LIGHT: MapStyleEntry[] = [
  { elementType: "geometry", stylers: [{ color: "#F8F9FC" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#F8F9FC" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5A6478" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#E2E6F0" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#E8ECF5" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#E2E6F0" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#0D1117" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#E8F5E8" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#C8D8F0" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#F0F2F8" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#5A6478" }],
  },
];

export function getMapStyle(theme: ColorTheme): MapStyleEntry[] {
  return theme === "dark" ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
}
