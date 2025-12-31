import { useCallback, useMemo } from "react";
import { Redirect, Slot, usePathname, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PatientTabsHeader, type PatientTabKey } from "../../src/components/PatientTabsHeader";
import { useSession } from "../../src/providers/SessionProvider";

const tabRoutes: Record<PatientTabKey, Href> = {
  home: "/",
  results: "/results",
  logs: "/logs",
  prescriptions: "/prescriptions",
  followups: "/followups",
  pharmacy: "/delivery",
};

function getActiveTab(pathname: string): PatientTabKey {
  if (pathname.startsWith("/results")) return "results";
  if (pathname.startsWith("/logs")) return "logs";
  if (pathname.startsWith("/prescriptions")) return "prescriptions";
  if (pathname.startsWith("/followups")) return "followups";
  if (pathname.startsWith("/delivery")) return "pharmacy";
  return "home";
}

export default function RootLayout() {
  const { session, isLoading } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = useMemo(() => getActiveTab(pathname || "/"), [pathname]);
  const showHeader = pathname !== "/" && pathname !== "/index";

  const handleTabPress = useCallback(
    (tab: PatientTabKey) => {
      const target = tabRoutes[tab];
      if (!target || target === pathname) return;
      router.navigate(target);
    },
    [pathname, router],
  );

  if (isLoading) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}
      >
        <ActivityIndicator size="large" color="#111827" />
        <Text style={{ marginTop: 12, color: "#111827" }}>Loading...</Text>
      </View>
    );
  }

  if (!session?.patientId) {
    return <Redirect href="/login" />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top", "left", "right"]}>
        {showHeader && <PatientTabsHeader activeTab={activeTab} onTabPress={handleTabPress} />}
        <View style={{ flex: 1 }}>
          <Slot />
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
