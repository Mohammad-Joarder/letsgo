import { useTheme } from "@/hooks/useTheme";

export function useMapStyle() {
  const { mapStyle } = useTheme();
  return mapStyle;
}
