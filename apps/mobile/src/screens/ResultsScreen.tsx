import { useMemo } from "react";
import { Stack, Link, useLocalSearchParams } from "expo-router";
import { FlatList, TouchableOpacity, View, Text, ScrollView } from "react-native";
import { useSession } from "../providers/SessionProvider";
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

// Legacy detail screen preserved outside of router
export function ResultDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { client, session } = useSession();
  const results = useLabResults(client, session?.patientId);

  const result = useMemo(() => results.data?.find((r) => r.id === id), [results.data, id]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fff", padding: spacing.lg }}>
      <Stack.Screen options={{ title: "Result Detail" }} />
      {!result && (
        <Text style={{ color: colors.gray[600] }}>
          {results.isLoading ? "Loading..." : "Result not found"}
        </Text>
      )}
      {result && (
        <>
          <Text style={{ fontSize: 22, fontWeight: "600", marginBottom: spacing.sm }}>{result.name}</Text>
          <Text style={{ color: colors.gray[500], marginBottom: spacing.md }}>
            {result.collectedAt}
          </Text>
          {result.summary && (
            <Text style={{ fontSize: 16, lineHeight: 24 }}>{result.summary}</Text>
          )}
          {result.pdfUrl && (
            <Text style={{ marginTop: spacing.lg, color: colors.primary }}>
              PDF: {result.pdfUrl}
            </Text>
          )}
        </>
      )}
    </ScrollView>
  );
}
