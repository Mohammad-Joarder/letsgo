import type { ViewStyle } from "react-native";
import type { AppColors, ColorTheme } from "@/lib/colors";

/** Backdrop behind sheets and dialogs — dims content clearly in both themes. */
export function getModalScrimStyle(colors: AppColors): ViewStyle {
  return { backgroundColor: colors.overlay };
}

/** Bottom sheet / modal panel — solid surface with elevation (never semi-transparent background). */
export function getSheetPanelStyle(colors: AppColors, theme: ColorTheme): ViewStyle {
  const shadow =
    theme === "light"
      ? {
          shadowColor: "#0D1117",
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.16,
          shadowRadius: 32,
          elevation: 28,
        }
      : {
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.5,
          shadowRadius: 24,
          elevation: 24,
        };

  return {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
    ...shadow,
  };
}

export function getSheetHandleStyle(colors: AppColors): ViewStyle {
  return {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    opacity: themeHandleOpacity(colors),
    alignSelf: "center",
    marginBottom: 12,
  };
}

function themeHandleOpacity(_colors: AppColors): number {
  return 0.55;
}

/** Centered dialog (booking spinner, alerts). */
export function getDialogCardStyle(colors: AppColors, theme: ColorTheme): ViewStyle {
  const shadow =
    theme === "light"
      ? {
          shadowColor: "#0D1117",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 24,
          elevation: 16,
        }
      : {
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4,
          shadowRadius: 20,
          elevation: 20,
        };

  return {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 28,
    paddingVertical: 24,
    minWidth: 260,
    ...shadow,
  };
}

/** Full-width docked panel on trip maps (awaiting pickup, searching footer). */
export function getTripBottomDockStyle(colors: AppColors, theme: ColorTheme): ViewStyle {
  const base = getSheetPanelStyle(colors, theme);
  return {
    ...base,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  };
}

/** Floating card on top of maps — opaque for readability over map tiles. */
export function getMapFloatingPanelStyle(colors: AppColors, theme: ColorTheme): ViewStyle {
  const shadow =
    theme === "light"
      ? {
          shadowColor: "#0D1117",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 16,
          elevation: 8,
        }
      : {
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
          elevation: 10,
        };

  return {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  };
}

/** @gorhom/bottom-sheet chrome */
export function getBottomSheetChrome(colors: AppColors, theme: ColorTheme) {
  return {
    backgroundStyle: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      ...(theme === "light"
        ? {
            shadowColor: "#0D1117",
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.12,
            shadowRadius: 24,
          }
        : {
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.4,
            shadowRadius: 16,
          }),
    } as ViewStyle,
    handleIndicatorStyle: {
      backgroundColor: colors.textMuted,
      width: 40,
      opacity: 0.5,
    } as ViewStyle,
    backdropOpacity: theme === "light" ? 0.52 : 0.58,
  };
}
