const IOS_TEST_APP_ID = "ca-app-pub-3940256099942544~1458002511";
const ANDROID_TEST_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const isProductionBuild =
  process.env.EAS_BUILD_PROFILE === "production" ||
  process.env.APP_ENV === "production" ||
  process.env.NODE_ENV === "production";

function resolveAppId(primaryValue, fallbackValue, testValue) {
  const candidate = primaryValue || fallbackValue || testValue;
  if (!candidate || candidate.includes("/") || !candidate.includes("~")) return testValue;
  return candidate;
}

function requireProdValue(name, value) {
  if (isProductionBuild && !value) {
    throw new Error(`Missing ${name} for production build`);
  }
  return value;
}

function requireNonTestProdValue(name, value, testValue) {
  if (isProductionBuild && value === testValue) {
    throw new Error(`Test ${name} is not allowed in production builds`);
  }
  return value;
}

const iosAppId = requireNonTestProdValue(
  "ADMOB_IOS_APP_ID",
  resolveAppId(
    process.env.ADMOB_IOS_APP_ID,
    process.env.EXPO_PUBLIC_ADMOB_APP_ID_IOS,
    IOS_TEST_APP_ID,
  ),
  IOS_TEST_APP_ID,
);
const androidAppId = requireNonTestProdValue(
  "ADMOB_ANDROID_APP_ID",
  resolveAppId(
    process.env.ADMOB_ANDROID_APP_ID,
    process.env.EXPO_PUBLIC_ADMOB_APP_ID_ANDROID,
    ANDROID_TEST_APP_ID,
  ),
  ANDROID_TEST_APP_ID,
);

requireProdValue("EXPO_PUBLIC_API_BASE_URL", process.env.EXPO_PUBLIC_API_BASE_URL);
requireProdValue(
  "EXPO_PUBLIC_ADMOB_REWARDED_ID_IOS",
  process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID_IOS,
);
requireProdValue(
  "EXPO_PUBLIC_ADMOB_REWARDED_ID_ANDROID",
  process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID_ANDROID,
);

const config = {
  expo: {
    name: "WELLSERV Patient",
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
        CFBundleDisplayName: "WS Patient",
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription:
          "We use your location to autofill delivery coordinates.",
      },
    },
    android: {
      package: "com.wellserv.mobile",
      label: "WELLSERV Patient",
      googleServicesFile: "./google-services.json",
      icon: "./assets/icon.png",
      adaptiveIcon: {
        foregroundImage: "./assets/icon-android-foreground.png",
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
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: androidAppId,
          iosAppId: iosAppId,
          delayAppMeasurementInit: true,
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            windowSoftInputMode: "adjustResize",
          },
        },
      ],
    ],
    extra: {
      eas: { projectId: "f10e5a6f-4ed3-4215-8569-4911a1960016" },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      patientAccessCode: process.env.EXPO_PUBLIC_PATIENT_ACCESS_CODE,
      webApiBaseUrl: process.env.EXPO_PUBLIC_WEB_API_BASE_URL,
      webAppUrl: process.env.EXPO_PUBLIC_WEB_APP_URL,
      router: {},
    },
    experiments: { typedRoutes: true },
    owner: "pocholosatoh",
  },
};

export default config;
