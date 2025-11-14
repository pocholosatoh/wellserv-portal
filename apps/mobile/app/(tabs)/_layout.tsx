import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { colors } from "@wellserv/theme";
import { useSession } from "../../src/providers/SessionProvider";

export default function TabsLayout() {
  const { session, isLoading } = useSession();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray[400],
        headerTintColor: colors.primary,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="results" options={{ title: "Results" }} />
      <Tabs.Screen name="prescriptions" options={{ title: "Prescriptions" }} />
    </Tabs>
  );
}
