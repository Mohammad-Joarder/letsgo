import * as SystemUI from "expo-system-ui";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { View, type ViewStyle } from "react-native";
import type { AppColors, ColorTheme, MapStyleEntry } from "@/lib/colors";
import { getColors, getMapStyle } from "@/lib/colors";
import { loadStoredColorTheme, saveColorTheme } from "@/lib/themeStorage";
import { colorsToThemeVars } from "@/lib/themeVars";

type ThemeContextValue = {
  colorTheme: ColorTheme;
  colors: AppColors;
  mapStyle: MapStyleEntry[];
  themeVars: ViewStyle;
  themeReady: boolean;
  setColorTheme: (theme: ColorTheme) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>("dark");
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const stored = await loadStoredColorTheme();
      if (stored) setColorThemeState(stored);
      setThemeReady(true);
    })();
  }, []);

  const colors = useMemo(() => getColors(colorTheme), [colorTheme]);
  const mapStyle = useMemo(() => getMapStyle(colorTheme), [colorTheme]);
  const themeVars = useMemo(() => colorsToThemeVars(colors), [colors]);

  useEffect(() => {
    if (!themeReady) return;
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background, themeReady]);

  const setColorTheme = useCallback(async (theme: ColorTheme) => {
    setColorThemeState(theme);
    await saveColorTheme(theme);
  }, []);

  const value = useMemo(
    () => ({
      colorTheme,
      colors,
      mapStyle,
      themeVars,
      themeReady,
      setColorTheme,
    }),
    [colorTheme, colors, mapStyle, themeVars, themeReady, setColorTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, themeVars]} className="flex-1">
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return ctx;
}
