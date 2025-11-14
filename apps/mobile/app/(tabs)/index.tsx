import { Stack, Link } from "expo-router";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useSession } from "../../src/providers/SessionProvider";
import { usePatientProfile, useLabResults, usePrescriptions } from "@wellserv/data";
import { colors, spacing } from "@wellserv/theme";

export default function HomeScreen() {
  const { session, client, signOut } = useSession();
  const patientId = session?.patientId;
  const profileQuery = usePatientProfile(client, patientId);
  const resultsQuery = useLabResults(client, patientId);
  const rxQuery = usePrescriptions(client, patientId);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Stack.Screen options={{ title: "Home" }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={{ fontSize: 22, fontWeight: "600", marginBottom: spacing.sm }}>
          Hello, {profileQuery.data?.fullName ?? patientId}
        </Text>
        <Text style={{ color: colors.gray[500], marginBottom: spacing.md }}>
          Last visit: {profileQuery.data?.lastVisit ?? "—"}
        </Text>

        <View style={{ flexDirection: "row", columnGap: 12, marginBottom: spacing.lg }}>
          <Link href="/(tabs)/results" asChild>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: colors.primaryLight,
                borderRadius: 18,
                padding: 16,
              }}
            >
              <Text style={{ fontWeight: "600", marginBottom: 8 }}>Results</Text>
              <Text>{resultsQuery.data?.[0]?.name ?? "—"}</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/(tabs)/prescriptions" asChild>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: "#f3f4f6",
                borderRadius: 18,
                padding: 16,
              }}
            >
              <Text style={{ fontWeight: "600", marginBottom: 8 }}>Prescriptions</Text>
              <Text>{rxQuery.data?.[0]?.issuedAt?.slice(0, 10) ?? "—"}</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <TouchableOpacity
          onPress={signOut}
          style={{
            borderWidth: 1,
            borderColor: colors.gray[300],
            borderRadius: 16,
            padding: 14,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.gray[600], fontWeight: "500" }}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
