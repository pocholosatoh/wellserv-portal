import { useCallback, useMemo, useState } from "react";
import { Stack, Link } from "expo-router";
import { ActivityIndicator, FlatList, TouchableOpacity, View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@wellserv/theme";
import { usePatientResults } from "../hooks/usePatientResults";
import type { Report, ResultItem } from "../../../shared/types/patient-results";

function formatDate(date: string) {
  if (!date) return "—";
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString();
}

function abnormalCount(report: Report) {
  return report.sections.reduce((sum, sec) => {
    return (
      sum +
      sec.items.filter((it) => it.flag === "H" || it.flag === "L" || it.flag === "A").length
    );
  }, 0);
}

function ResultItemRow({ item }: { item: ResultItem }) {
  return (
    <View style={{ paddingVertical: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", columnGap: 8 }}>
        <Text style={{ fontWeight: "600", flex: 1 }}>{item.label}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", columnGap: 6 }}>
          {!!item.flag && (
            <Text style={{ color: colors.accent, fontWeight: "700" }}>{item.flag}</Text>
          )}
          <Text style={{ fontWeight: "500" }}>
            {item.value}
            {item.unit ? ` ${item.unit}` : ""}
          </Text>
        </View>
      </View>
      {item.ref && (item.ref.low != null || item.ref.high != null) && (
        <Text style={{ color: colors.gray[500], marginTop: 2 }}>
          Ref: {item.ref.low ?? "—"} to {item.ref.high ?? "—"}
        </Text>
      )}
    </View>
  );
}

export default function ResultsScreen() {
  const { reports, patientOnly, isLoading, isFetching, error, refetch } = usePatientResults();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const data = useMemo(() => reports ?? [], [reports]);

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}
        edges={["top", "left", "right"]}
      >
        <ActivityIndicator color={colors.primary} />
        <Text style={{ marginTop: spacing.sm, color: colors.gray[500] }}>Loading results…</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", padding: spacing.lg }}
        edges={["top", "left", "right"]}
      >
        <Text style={{ color: colors.gray[600], textAlign: "center", marginBottom: spacing.md }}>
          Something went wrong loading your lab results.
          {"\n"}
          {error}
        </Text>
        <TouchableOpacity
          onPress={() => refetch()}
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

  const isEmpty = patientOnly || data.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ title: "Results" }} />
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
        <Link href="/prescriptions" asChild>
          <TouchableOpacity
            style={{
              backgroundColor: colors.gray[100],
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: colors.gray[700], fontWeight: "600" }}>Prescriptions</Text>
          </TouchableOpacity>
        </Link>
      </View>
      {isEmpty ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg }}>
          <Text style={{ color: colors.gray[500], textAlign: "center" }}>
            No lab results yet. Your profile is registered but there are no completed lab visits.
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, index) =>
            item.visit.date_of_test || item.visit.barcode || `visit-${index}`
          }
          contentContainerStyle={{
            padding: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.xl,
          }}
          renderItem={({ item, index }) => {
            const key = item.visit.date_of_test || item.visit.barcode || `visit-${index}`;
            const open = expanded[key] ?? index === 0;
            const flagged = abnormalCount(item);
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
                <TouchableOpacity onPress={() => toggle(key)} style={{ paddingVertical: 4 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700" }}>
                        {formatDate(item.visit.date_of_test)}
                      </Text>
                      <Text style={{ color: colors.gray[500], marginTop: 2 }}>
                        {item.visit.branch || "Branch not specified"}
                      </Text>
                      <Text style={{ color: colors.gray[600], marginTop: 6 }}>
                        {item.sections.length} sections · {flagged} flagged
                      </Text>
                    </View>
                    <Text style={{ color: colors.primary, fontWeight: "700" }}>
                      {open ? "Hide" : "View"}
                    </Text>
                  </View>
                </TouchableOpacity>

                {open && (
                  <View style={{ marginTop: spacing.sm }}>
                    {item.sections.map((section) => (
                      <View
                        key={section.name}
                        style={{
                          paddingVertical: spacing.sm,
                          borderTopWidth: 1,
                          borderTopColor: colors.gray[100],
                        }}
                      >
                        <Text style={{ fontWeight: "700", marginBottom: 6 }}>{section.name}</Text>
                        {section.items.map((it) => (
                          <ResultItemRow key={it.key || it.label} item={it} />
                        ))}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
          refreshing={isLoading || isFetching}
          onRefresh={() => refetch()}
        />
      )}
    </SafeAreaView>
  );
}

// Legacy detail screen preserved outside of router but now powered by the new hook.
export function ResultDetailScreen() {
  const { reports, isLoading } = usePatientResults();
  const first = reports?.[0];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fff", padding: spacing.lg }}>
      <Stack.Screen options={{ title: "Result Detail" }} />
      {!first && (
        <Text style={{ color: colors.gray[600] }}>
          {isLoading ? "Loading..." : "Result not found"}
        </Text>
      )}
      {first && (
        <>
          <Text style={{ fontSize: 22, fontWeight: "600", marginBottom: spacing.sm }}>
            {formatDate(first.visit.date_of_test)}
          </Text>
          <Text style={{ color: colors.gray[500], marginBottom: spacing.md }}>
            {first.visit.branch || "Branch not specified"}
          </Text>
          {first.sections.map((section) => (
            <View key={section.name} style={{ marginBottom: spacing.md }}>
              <Text style={{ fontWeight: "700", marginBottom: 6 }}>{section.name}</Text>
              {section.items.map((it) => (
                <ResultItemRow key={it.key || it.label} item={it} />
              ))}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}
