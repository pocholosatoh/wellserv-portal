import { Stack, Link } from "expo-router";
import { FlatList, TouchableOpacity, View, Text } from "react-native";
import { useSession } from "../../src/providers/SessionProvider";
import { useLabResults } from "@wellserv/data";
import { colors, spacing } from "@wellserv/theme";

export default function ResultsScreen() {
  const { client, session } = useSession();
  const query = useLabResults(client, session?.patientId);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Stack.Screen options={{ title: "Results" }} />
      <FlatList
        contentContainerStyle={{ padding: spacing.lg }}
        data={query.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Link href={{ pathname: "/results/[id]", params: { id: item.id } }} asChild>
            <TouchableOpacity
              style={{
                padding: 16,
                borderRadius: 18,
                backgroundColor: "#f9fafb",
                marginBottom: spacing.sm,
              }}
            >
              <Text style={{ fontWeight: "600", marginBottom: 4 }}>{item.name}</Text>
              <Text style={{ color: colors.gray[500] }}>{item.collectedAt}</Text>
            </TouchableOpacity>
          </Link>
        )}
        ListEmptyComponent={
          <Text style={{ textAlign: "center", marginTop: spacing.lg, color: colors.gray[500] }}>
            {query.isLoading ? "Loading..." : "No results yet"}
          </Text>
        }
      />
    </View>
  );
}
