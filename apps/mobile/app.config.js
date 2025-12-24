const iosAppId = process.env.ADMOB_IOS_APP_ID ?? "";
const androidAppId = process.env.ADMOB_ANDROID_APP_ID ?? "";

const config = {
  expo: {
    name: "Wellserv Mobile",
    slug: "wellserv-mobile",
    version: "0.1.0",
    orientation: "portrait",
    scheme: "wellserv",
    userInterfaceStyle: "light",
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      bundleIdentifier: "com.wellserv.mobile",
      supportsTablet: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        GADApplicationIdentifier: iosAppId,
      },
    },
    android: {
      package: "com.wellserv.mobile",
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#ffffff",
      },
      intentFilters: [
        {
          action: "VIEW",
          data: [{ scheme: "wellserv" }],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    plugins: [
      "expo-router",
      ["expo-notifications", { icon: "./assets/icon.png" }],
      "expo-font",
      "expo-secure-store",
    ],
    extra: {
      eas: { projectId: "f10e5a6f-4ed3-4215-8569-4911a1960016" },
      supabaseUrl: "${EXPO_PUBLIC_SUPABASE_URL}",
      supabaseAnonKey: "${EXPO_PUBLIC_SUPABASE_ANON_KEY}",
      patientAccessCode: "${EXPO_PUBLIC_PATIENT_ACCESS_CODE}",
      router: {},
    },
    experiments: { typedRoutes: true },
    owner: "pocholosatoh",
  },
};

export default config;
