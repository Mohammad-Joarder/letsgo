import { vars } from "nativewind";
import type { AppColors } from "@/lib/colors";

function hexToRgbTriplet(hex: string): string {
  const h = hex.replace("#", "");
  return `${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)}`;
}

export function colorsToThemeVars(c: AppColors) {
  return vars({
    "--color-primary": hexToRgbTriplet(c.primary),
    "--color-background": hexToRgbTriplet(c.background),
    "--color-surface": hexToRgbTriplet(c.surface),
    "--color-surface2": hexToRgbTriplet(c.surface2),
    "--color-text": hexToRgbTriplet(c.text),
    "--color-text-secondary": hexToRgbTriplet(c.textSecondary),
    "--color-accent": hexToRgbTriplet(c.accent),
    "--color-success": hexToRgbTriplet(c.success),
    "--color-error": hexToRgbTriplet(c.error),
    "--color-warning": hexToRgbTriplet(c.warning),
    "--color-border": hexToRgbTriplet(c.border),
  });
}
