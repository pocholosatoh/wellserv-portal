import { Stack, Link } from "expo-router";
import { FlatList, TouchableOpacity, View, Text } from "react-native";
import { useSession } from "../../src/providers/SessionProvider";
import { usePrescriptions } from "@wellserv/data";
import { colors, spacing } from "@wellserv/theme";

export default function PrescriptionsScreen() {
  const { client, session } = useSession();
  const query = usePrescriptions(client, session?.patientId);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Stack.Screen options={{ title: "Prescriptions" }} />
      <FlatList
        contentContainerStyle={{ padding: spacing.lg }}
        data={query.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Link href={{ pathname: "/prescriptions/[id]", params: { id: item.id } }} asChild>
            <TouchableOpacity
              style={{
                padding: 16,
                borderRadius: 18,
                backgroundColor: "#f9fafb",
                marginBottom: spacing.sm,
              }}
            >
              <Text style={{ fontWeight: "600" }}>{item.issuedAt.slice(0, 10)}</Text>
              <Text style={{ color: colors.gray[500], marginTop: 4 }}>
                {item.items.map((it) => it.drug).join(", ")}
              </Text>
            </TouchableOpacity>
          </Link>
        )}
        ListEmptyComponent={
          <Text style={{ textAlign: "center", marginTop: spacing.lg, color: colors.gray[500] }}>
            {query.isLoading ? "Loading..." : "No prescriptions yet"}
          </Text>
        }
      />
    </View>
  );
}
