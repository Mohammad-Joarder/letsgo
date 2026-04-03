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
        text: "#FFFFFF",
        textSecondary: "#8A94A6",
        accent: "#FF6B35",
        success: "#22C55E",
        error: "#EF4444",
        border: "#1E2D45",
      },
      fontFamily: {
        sora: ["Sora_600SemiBold"],
        "sora-display": ["Sora_700Bold"],
        inter: ["Inter_400Regular"],
        "inter-medium": ["Inter_500Medium"],
        "inter-semibold": ["Inter_600SemiBold"],
      },
    },
  },
  plugins: [],
};
