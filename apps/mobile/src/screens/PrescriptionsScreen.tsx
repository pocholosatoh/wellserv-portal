import { useMemo, useState, useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, ScrollView, TouchableOpacity, View, Text, Image } from "react-native";
import { Stack } from "expo-router";
import { usePatientPrescriptions, type MobilePrescription } from "../hooks/usePatientPrescriptions";
import { colors, spacing } from "@wellserv/theme";
import icon from "../../assets/icon.png";
import { patientTabsContentContainerStyle } from "../components/PatientTabsLayout";

function formatPrescriptionDate(iso?: string | null) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(+dt)) return iso;
  return dt.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function PrescriptionsScreen() {
  const query = usePatientPrescriptions();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const contentContainerStyle = patientTabsContentContainerStyle;

  const grouped = useMemo(() => {
    const list = query.data ?? [];
    const byDate = new Map<string, MobilePrescription[]>();
    list.forEach((rx) => {
      const key = rx.issuedAt?.slice(0, 10) || "Unknown date";
      byDate.set(key, [...(byDate.get(key) || []), rx]);
    });
    return Array.from(byDate.entries())
      .map(([date, prescriptions]) => ({ date, prescriptions }))
      .sort((a, b) => (a.date > b.date ? -1 : 1));
  }, [query.data]);

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (query.isLoading) {
    return (
      <View style={{ flex: 1 }}>
        <Stack.Screen options={{ headerShown: false, headerShadowVisible: false, title: "" }} />
        <View
          style={[
            { flex: 1, alignItems: "center", justifyContent: "center" },
            contentContainerStyle,
          ]}
        >
          <ActivityIndicator color={colors.primary} />
          <Text style={{ marginTop: spacing.sm, color: colors.gray[500] }}>Loading prescriptions…</Text>
        </View>
      </View>
    );
  }

  if (query.error) {
    return (
      <View style={{ flex: 1 }}>
        <Stack.Screen options={{ headerShown: false, headerShadowVisible: false, title: "" }} />
        <View
          style={[
            { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
            contentContainerStyle,
          ]}
        >
          <Text style={{ color: colors.gray[600], textAlign: "center", marginBottom: spacing.md }}>
            Something went wrong loading your prescriptions.
            {"\n"}
            {String(query.error?.message || query.error)}
          </Text>
          <TouchableOpacity
            onPress={() => query.refetch()}
            style={{
              backgroundColor: colors.primary,
              paddingVertical: 12,
              paddingHorizontal: 18,
              borderRadius: 12,
              marginTop: spacing.sm,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false, headerShadowVisible: false, title: "" }} />
      <FlatList
        contentContainerStyle={contentContainerStyle}
        data={grouped}
        keyExtractor={(item) => item.date}
        ListEmptyComponent={
          <Text style={{ textAlign: "center", marginTop: spacing.lg, color: colors.gray[500] }}>
            No prescriptions yet
          </Text>
        }
        renderItem={({ item }) => {
          const open = expanded[item.date] ?? grouped[0]?.date === item.date;
          const totalItems = item.prescriptions.reduce((sum, rx) => sum + rx.items.length, 0);
          const doctorName = item.prescriptions[0]?.doctorName;
          return (
            <View
              style={{
                backgroundColor: colors.gray[50],
                borderRadius: 18,
                padding: spacing.md,
                marginBottom: spacing.md,
                borderWidth: 1,
                borderColor: colors.gray[100],
              }}
            >
              <TouchableOpacity onPress={() => toggle(item.date)} style={{ paddingVertical: 4 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700" }}>
                      {formatPrescriptionDate(item.date)}
                    </Text>
                    <Text style={{ color: colors.gray[600], marginTop: 4 }}>
                      {totalItems} item{totalItems === 1 ? "" : "s"}
                      {doctorName ? ` · Doctor: ${doctorName}` : ""}
                    </Text>
                  </View>
                  <Text style={{ color: colors.primary, fontWeight: "700" }}>
                    {open ? "Hide" : "View"}
                  </Text>
                </View>
              </TouchableOpacity>

              {open && (
                <View style={{ marginTop: spacing.sm }}>
                  {item.prescriptions.map((rx, idx) => (
                    <View
                      key={rx.id}
                      style={{
                        paddingVertical: spacing.sm,
                        borderTopWidth: idx === 0 ? 0 : 1,
                        borderTopColor: colors.gray[100],
                      }}
                    >
                      <Text style={{ fontWeight: "700", marginBottom: 6 }}>Medications</Text>
                      {rx.items.map((it, i) => (
                        <View key={`${it.drug}-${i}`} style={{ paddingVertical: 4 }}>
                          <Text style={{ fontWeight: "600" }}>
                            {i + 1}. {it.drug}
                          </Text>
                          {!!it.sig && (
                            <Text style={{ color: colors.gray[500], marginTop: 2 }}>{it.sig}</Text>
                          )}
                          {!!it.instructions && (
                            <Text style={{ color: colors.gray[600], marginTop: 2 }}>
                              Notes: {it.instructions}
                            </Text>
                          )}
                        </View>
                      ))}
                      {!!rx.notesForPatient && (
                        <Text style={{ color: colors.gray[700], marginTop: spacing.sm }}>
                          Doctor&apos;s Instructions: {rx.notesForPatient}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

// Legacy detail screen preserved outside of router
export function PrescriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const list = usePatientPrescriptions();

  const prescription = useMemo(() => list.data?.find((rx) => rx.id === id), [list.data, id]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fff", padding: spacing.lg }}>
      <Stack.Screen
        options={{
          title: "Prescription",
          headerRight: () => (
            // eslint-disable-next-line jsx-a11y/alt-text -- React Native Image uses accessibilityLabel instead of alt
            <Image
              source={icon}
              style={{ width: 28, height: 28, marginRight: spacing.sm }}
              resizeMode="contain"
              accessibilityLabel="Wellserv logo"
            />
          ),
        }}
      />
      {!prescription && (
        <Text style={{ color: colors.gray[600] }}>
          {list.isLoading ? "Loading..." : "Prescription not found"}
        </Text>
      )}
      {prescription && (
        <>
          <Text style={{ fontSize: 22, fontWeight: "600", marginBottom: spacing.sm }}>
            Issued {formatPrescriptionDate(prescription.issuedAt)}
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
                <Text style={{ fontWeight: "600" }}>
                  {idx + 1}. {item.drug}
                </Text>
                <Text style={{ color: colors.gray[500], marginTop: 4 }}>{item.sig}</Text>
                {!!item.instructions && (
                  <Text style={{ color: colors.gray[600], marginTop: 4 }}>
                    Notes: {item.instructions}
                  </Text>
                )}
              </View>
            ))}
            {!!prescription.notesForPatient && (
              <Text style={{ color: colors.gray[700], marginTop: spacing.sm }}>
                Doctor&apos;s Instructions: {prescription.notesForPatient}
              </Text>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
