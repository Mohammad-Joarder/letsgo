import { useMemo } from "react";
import { useTheme } from "@/hooks/useTheme";
import {
  getBottomSheetChrome,
  getDialogCardStyle,
  getMapFloatingPanelStyle,
  getModalScrimStyle,
  getSheetHandleStyle,
  getSheetPanelStyle,
  getTripBottomDockStyle,
} from "@/lib/modalStyles";

export function useModalChrome() {
  const { colors, colorTheme } = useTheme();

  return useMemo(
    () => ({
      colors,
      colorTheme,
      scrim: getModalScrimStyle(colors),
      sheet: getSheetPanelStyle(colors, colorTheme),
      handle: getSheetHandleStyle(colors),
      dialog: getDialogCardStyle(colors, colorTheme),
      mapPanel: getMapFloatingPanelStyle(colors, colorTheme),
      tripDock: getTripBottomDockStyle(colors, colorTheme),
      bottomSheet: getBottomSheetChrome(colors, colorTheme),
      placeholderColor: colors.textMuted,
      iconOnPrimary: colorTheme === "light" ? "#FFFFFF" : colors.background,
    }),
    [colors, colorTheme]
  );
}
