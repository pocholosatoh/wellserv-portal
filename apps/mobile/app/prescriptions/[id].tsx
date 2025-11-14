import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useMemo } from "react";
import { useSession } from "../../src/providers/SessionProvider";
import { usePrescriptions } from "@wellserv/data";
import { colors, spacing } from "@wellserv/theme";

export default function PrescriptionDetailScreen() {
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
