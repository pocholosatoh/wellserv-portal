import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, Text } from "react-native";
import { useMemo } from "react";
import { useSession } from "../../src/providers/SessionProvider";
import { useLabResults } from "@wellserv/data";
import { colors, spacing } from "@wellserv/theme";

export default function ResultDetailScreen() {
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
