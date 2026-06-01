import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ColorTheme } from "@/lib/colors";

export const THEME_STORAGE_KEY = "letsgo_color_theme";

export async function loadStoredColorTheme(): Promise<ColorTheme | null> {
  const raw = await AsyncStorage.getItem(THEME_STORAGE_KEY);
  if (raw === "dark" || raw === "light") return raw;
  return null;
}

export async function saveColorTheme(theme: ColorTheme): Promise<void> {
  await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
}
