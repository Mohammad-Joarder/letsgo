export default {
  expo: {
    name: "Let's Go",
    slug: "lets-go",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "letsgo",
    userInterfaceStyle: "dark",
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "contain",
      backgroundColor: "#0A0E1A",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.letsgo.app",
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "Let's Go needs your location to show nearby drivers and calculate routes.",
        NSLocationAlwaysUsageDescription:
          "Let's Go uses your location in the background to track your trip.",
        NSCameraUsageDescription:
          "Let's Go needs camera access to upload your profile photo and documents.",
        NSPhotoLibraryUsageDescription:
          "Let's Go needs photo library access to upload your documents.",
        NSMicrophoneUsageDescription:
          "Let's Go may use the microphone for the trip recording safety feature.",
      },
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "AIzaSyAFpB2iu9OlJFMP6PtB2VPyjY0CAESC7sw",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#0A0E1A",
      },
      package: "com.letsgo.app",
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "RECORD_AUDIO",
        "VIBRATE",
        "RECEIVE_BOOT_COMPLETED",
      ],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY || "AIzaSyAFpB2iu9OlJFMP6PtB2VPyjY0CAESC7sw",
        },
      },
    },
    web: {
      bundler: "metro",
      output: "static",
    },
    plugins: [
      "expo-router",
      "expo-font",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#0A0E1A",
          image: "./assets/images/splash.png",
          imageWidth: 200,
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Allow Let's Go to use your location for rides.",
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/notification-icon.png",
          color: "#00D4AA",
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      supabaseUrl: "https://vbvlytmfnozsjldzgdcr.supabase.co",
      supabaseAnonKey:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZidmx5dG1mbm96c2psZHpnZGNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MTM4NDksImV4cCI6MjA5MDQ4OTg0OX0.R_vQ78QQpzYyMgMcRxzqfaHmT9EHqr2RakG4qNG4cNU",
      googleMapsApiKey: "AIzaSyAFpB2iu9OlJFMP6PtB2VPyjY0CAESC7sw",
      eas: {
        projectId: "your-eas-project-id",
      },
    },
  },
};
