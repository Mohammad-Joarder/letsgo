/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: "Lets Go",
  slug: "letsgo",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "letsgo",
  userInterfaceStyle: "dark",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/images/brand/logo-full.png",
    resizeMode: "contain",
    backgroundColor: "#FFFFFF",
  },
  ios: {
    bundleIdentifier: "com.letsgo.app",
    supportsTablet: true,
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    },
    infoPlist: {
      UIBackgroundModes: ["location"],
      NSLocationWhenInUseUsageDescription:
        "Lets Go uses your location to set pickup points and show nearby drivers.",
    },
  },
  android: {
    package: "com.letsgo.app",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0A0E1A",
    },
    edgeToEdgeEnabled: true,
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
      },
    },
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-web-browser",
    "@react-native-community/datetimepicker",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Lets Go uses your location to set pickup points and show nearby drivers.",
      },
    ],
    [
      "@stripe/stripe-react-native",
      {
        merchantIdentifier: "merchant.com.letsgo.app",
        enableGooglePay: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_AUTH_EMAIL_REDIRECT: process.env.EXPO_PUBLIC_AUTH_EMAIL_REDIRECT,
    EXPO_PUBLIC_AUTH_SIGNUP_OMIT_EMAIL_REDIRECT:
      process.env.EXPO_PUBLIC_AUTH_SIGNUP_OMIT_EMAIL_REDIRECT,
    EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
    EXPO_PUBLIC_DEV_END_TRIP_ANYWHERE: process.env.EXPO_PUBLIC_DEV_END_TRIP_ANYWHERE,
    EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    EXPO_PUBLIC_ALLOW_CASH_BOOKING: process.env.EXPO_PUBLIC_ALLOW_CASH_BOOKING,
  },
};
