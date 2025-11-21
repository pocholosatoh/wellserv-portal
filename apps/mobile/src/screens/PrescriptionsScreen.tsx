import { useMemo } from "react";
import { Stack, Link, useLocalSearchParams } from "expo-router";
import { FlatList, TouchableOpacity, View, Text, ScrollView } from "react-native";
import { useSession } from "../providers/SessionProvider";
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

// Legacy detail screen preserved outside of router
export function PrescriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { client, session } = useSession();
  const list = usePrescriptions(client, session?.patientId);

  const prescription = useMemo(() => list.data?.find((rx) => rx.id === id), [list.data, id]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fff", padding: spacing.lg }}>
      <Stack.Screen options={{ title: "Prescription" }} />
      {!prescription && (
        <Text style={{ color: colors.gray[600] }}>
          {list.isLoading ? "Loading..." : "Prescription not found"}
        </Text>
      )}
      {prescription && (
        <>
          <Text style={{ fontSize: 22, fontWeight: "600", marginBottom: spacing.sm }}>
            Issued {prescription.issuedAt.slice(0, 10)}
          </Text>
          <View style={{ rowGap: spacing.sm }}>
            {prescription.items.map((item, idx) => (
              <View
                key={`${item.drug}-${idx}`}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.gray[200],
                }}
              >
                <Text style={{ fontWeight: "600" }}>{item.drug}</Text>
                <Text style={{ color: colors.gray[500], marginTop: 4 }}>{item.sig}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}
