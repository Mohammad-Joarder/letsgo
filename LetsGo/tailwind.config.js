/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#00D4AA",
        background: "#0A0E1A",
        surface: "#131929",
        surface2: "#1C2438",
        border: "#1E2D45",
        accent: "#FF6B35",
        success: "#22C55E",
        error: "#EF4444",
        warning: "#F59E0B",
        textPrimary: "#FFFFFF",
        textSecondary: "#8A94A6",
        textMuted: "#4A5568",
      },
      fontFamily: {
        "sora-regular": ["Sora_400Regular"],
        "sora-medium": ["Sora_500Medium"],
        "sora-semibold": ["Sora_600SemiBold"],
        "sora-bold": ["Sora_700Bold"],
        "inter-regular": ["Inter_400Regular"],
        "inter-medium": ["Inter_500Medium"],
        "inter-semibold": ["Inter_600SemiBold"],
        "inter-bold": ["Inter_700Bold"],
      },
    },
  },
  plugins: [],
};
