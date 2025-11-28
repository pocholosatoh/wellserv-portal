import { useMemo, useState, useCallback } from "react";
import { Stack, Link, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, TouchableOpacity, View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePatientPrescriptions } from "../hooks/usePatientPrescriptions";
import { colors, spacing } from "@wellserv/theme";
import type { Prescription } from "@wellserv/core";

export default function PrescriptionsScreen() {
  const query = usePatientPrescriptions();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const list = query.data ?? [];
    const byDate = new Map<string, (Prescription & { doctorName?: string })[]>();
    list.forEach((rx) => {
      const key = rx.issuedAt?.slice(0, 10) || "Unknown date";
      byDate.set(key, [...(byDate.get(key) || []), rx as Prescription & { doctorName?: string }]);
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
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }} edges={["top", "left", "right"]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ marginTop: spacing.sm, color: colors.gray[500] }}>Loading prescriptions…</Text>
      </SafeAreaView>
    );
  }

  if (query.error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", padding: spacing.lg }} edges={["top", "left", "right"]}>
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
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ title: "Prescriptions" }} />
      <View
        style={{
          flexDirection: "row",
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
        }}
      >
        <Link href="/" asChild>
          <TouchableOpacity
            style={{
              backgroundColor: colors.gray[100],
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: colors.gray[700], fontWeight: "600" }}>Home</Text>
          </TouchableOpacity>
        </Link>
        <Link href="/results" asChild>
          <TouchableOpacity
            style={{
              backgroundColor: colors.gray[100],
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: colors.gray[700], fontWeight: "600" }}>Results</Text>
          </TouchableOpacity>
        </Link>
      </View>
      <FlatList
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xl,
        }}
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
                    <Text style={{ fontSize: 16, fontWeight: "700" }}>{item.date}</Text>
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
                      <Text style={{ fontWeight: "700", marginBottom: 6 }}>
                        Prescription {idx + 1}
                      </Text>
                      {rx.items.map((it, i) => (
                        <View key={`${it.drug}-${i}`} style={{ paddingVertical: 4 }}>
                          <Text style={{ fontWeight: "600" }}>{it.drug}</Text>
                          {!!it.sig && (
                            <Text style={{ color: colors.gray[500], marginTop: 2 }}>{it.sig}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

// Legacy detail screen preserved outside of router
export function PrescriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const list = usePatientPrescriptions();

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
