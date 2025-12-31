import { Redirect } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { useSession } from "../src/providers/SessionProvider";

export default function Index() {
  const { session, isLoading } = useSession();

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

  if (session?.patientId) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/login" />;
}
