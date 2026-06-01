/** @type {import('expo/config').ExpoConfig} */

const APP_BUNDLE_ID = "com.letsgoau.app";
const APPLE_PAY_MERCHANT_ID = "merchant.com.letsgoau.app";

/** EAS project — required for `eas build` (cannot be auto-written when config is app.config.js). */
const EAS_PROJECT_ID = "121440e1-7b96-4621-98b3-9c13dd04821a";

module.exports = {
  name: "Lets Go",
  slug: "letsgo",
  version: "1.0.3",
  orientation: "portrait",
  scheme: "letsgo",
  userInterfaceStyle: "dark",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#FFFFFF",
  },
  ios: {
    buildNumber: "4",
    bundleIdentifier: APP_BUNDLE_ID,
    icon: "./assets/icon.png",
    supportsTablet: true,
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
      /** App Store export compliance — only standard HTTPS/TLS (exempt). See APPSTORE.md */
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      UIBackgroundModes: ["location"],
      NSLocationWhenInUseUsageDescription:
        "Lets Go uses your location to set pickup points and show nearby drivers.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "Background location is used while you are online as a driver so riders can see your position during trips.",
      NSMicrophoneUsageDescription:
        "Optional trip recording stores audio on your device for your own safety review.",
      NSPhotoLibraryUsageDescription:
        "Lets Go needs photo access for rider ID verification and driver onboarding documents.",
      NSCameraUsageDescription:
        "Lets Go uses the camera to capture driver licence, vehicle, and profile photos during onboarding.",
    },
  },
  android: {
    package: APP_BUNDLE_ID,
    versionCode: 4,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#FFFFFF",
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
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 280,
        resizeMode: "contain",
        backgroundColor: "#FFFFFF",
        dark: {
          image: "./assets/splash-icon.png",
          imageWidth: 280,
          resizeMode: "contain",
          backgroundColor: "#FFFFFF",
        },
      },
    ],
    "expo-router",
    "expo-font",
    "expo-web-browser",
    "@react-native-community/datetimepicker",
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#00D4AA",
      },
    ],
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
        merchantIdentifier: APPLE_PAY_MERCHANT_ID,
        enableGooglePay: false,
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Lets Go needs access to your photos to upload driver verification documents and rider ID images.",
        cameraPermission:
          "Lets Go uses the camera to capture driver licence, vehicle, and profile photos during onboarding.",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appBundleId: APP_BUNDLE_ID,
    applePayMerchantId: APPLE_PAY_MERCHANT_ID,
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? EAS_PROJECT_ID,
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
    EXPO_PUBLIC_DRIVER_FF_OVERRIDES: process.env.EXPO_PUBLIC_DRIVER_FF_OVERRIDES,
  },
};
