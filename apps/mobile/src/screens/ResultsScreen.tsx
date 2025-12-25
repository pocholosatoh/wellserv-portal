import { useCallback, useMemo, useState, type ReactElement } from "react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, ScrollView, TouchableOpacity, View, Text, Image } from "react-native";
import { colors, spacing } from "@wellserv/theme";
import { usePatientResults } from "../hooks/usePatientResults";
import type { Report, ResultItem } from "../../../shared/types/patient-results";
import icon from "../../assets/icon.png";
import { type PatientTabKey } from "../components/PatientTabsHeader";
import { PatientTabsLayout } from "../components/PatientTabsLayout";
import { ResultsAdGateModal } from "../components/ResultsAdGateModal";
import { hasActiveAdCooldown } from "../lib/ads/adCooldown";

function formatDate(date: string) {
  if (!date) return "—";
  const normalize = (raw: string) => {
    const cleaned = raw.trim();
    // Try ISO / native parsing first
    const d = new Date(cleaned);
    if (!Number.isNaN(d.getTime())) return d;
    // Fallback: parse common numeric formats like MM/DD/YYYY or YYYY-MM-DD
    const slash = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slash) {
      const [_, m, day, y] = slash;
      return new Date(Number(y), Number(m) - 1, Number(day));
    }
    const dash = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (dash) {
      const [_, y, m, day] = dash;
      return new Date(Number(y), Number(m) - 1, Number(day));
    }
    return null;
  };

  const parsed = normalize(date);
  if (!parsed) return date;

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${months[parsed.getMonth()]} ${parsed.getDate()}, ${parsed.getFullYear()}`;
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
  const formatRef = (low?: number | null, high?: number | null) => {
    const hasLow = low != null;
    const hasHigh = high != null;
    if (hasLow && hasHigh) return `${low} \u2013 ${high}`;
    if (hasHigh) return `<${high}`;
    if (hasLow) return `>${low}`;
    return null;
  };

  const refText = item.ref ? formatRef(item.ref.low, item.ref.high) : null;

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
      {refText && (
        <Text
          style={{
            color: colors.gray[500],
            marginTop: 2,
            alignSelf: "flex-end",
            textAlign: "right",
          }}
        >
          Ref: {refText}
        </Text>
      )}
    </View>
  );
}

export default function ResultsScreen() {
  const { reports, patientOnly, isLoading, isFetching, error, refetch } = usePatientResults();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [adGateVisible, setAdGateVisible] = useState(false);
  const [adGateChecked, setAdGateChecked] = useState(false);
  const router = useRouter();

  const data = useMemo(() => reports ?? [], [reports]);

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleTabPress = useCallback(
    (tab: PatientTabKey) => {
      switch (tab) {
        case "home":
          router.replace("/");
          break;
        case "results":
          router.replace("/results");
          break;
        case "prescriptions":
          router.replace("/prescriptions");
          break;
        case "followups":
          router.replace("/followups");
          break;
        case "pharmacy":
          router.replace("/delivery");
          break;
        default:
          break;
      }
    },
    [router]
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const checkCooldown = async () => {
        const cooldownActive = await hasActiveAdCooldown();
        if (!active) return;
        if (cooldownActive) {
          console.log("ad_skipped_due_to_cooldown");
          setAdGateVisible(false);
        } else {
          setAdGateVisible(true);
        }
        setAdGateChecked(true);
      };

      checkCooldown();

      return () => {
        active = false;
      };
    }, [])
  );

  const isEmpty = patientOnly || data.length === 0;

  return (
    <PatientTabsLayout activeTab="results" onTabPress={handleTabPress}>
      {(contentContainerStyle) => {
        let content: ReactElement;

        if (error) {
          content = (
            <View
              style={[
                { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
                contentContainerStyle,
              ]}
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
                  marginTop: spacing.sm,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>Retry</Text>
              </TouchableOpacity>
            </View>
          );
        } else if (isLoading && data.length === 0) {
          content = (
            <View style={[{ flex: 1 }, contentContainerStyle]}>
              <View style={{ alignItems: "center", marginBottom: spacing.md }}>
                <ActivityIndicator color={colors.primary} />
                <Text style={{ marginTop: spacing.sm, color: colors.gray[500] }}>Loading results…</Text>
              </View>
              {Array.from({ length: 3 }).map((_, index) => (
                <View
                  key={`results-skeleton-${index}`}
                  style={{
                    backgroundColor: colors.gray[100],
                    borderRadius: 18,
                    padding: spacing.md,
                    marginBottom: spacing.md,
                  }}
                >
                  <View
                    style={{
                      height: 16,
                      backgroundColor: colors.gray[200],
                      borderRadius: 8,
                      marginBottom: spacing.sm,
                      width: "60%",
                    }}
                  />
                  <View
                    style={{
                      height: 12,
                      backgroundColor: colors.gray[200],
                      borderRadius: 8,
                      marginBottom: spacing.sm,
                      width: "40%",
                    }}
                  />
                  <View
                    style={{
                      height: 12,
                      backgroundColor: colors.gray[200],
                      borderRadius: 8,
                      width: "50%",
                    }}
                  />
                </View>
              ))}
            </View>
          );
        } else if (isEmpty) {
          content = (
            <View
              style={[
                { flex: 1, alignItems: "center", justifyContent: "center" },
                contentContainerStyle,
              ]}
            >
              <Text style={{ color: colors.gray[500], textAlign: "center" }}>
                No lab results yet. Your profile is registered but there are no completed lab visits.
              </Text>
            </View>
          );
        } else {
          content = (
            <FlatList
              data={data}
              keyExtractor={(item, index) =>
                item.visit.date_of_test || item.visit.barcode || `visit-${index}`
              }
              contentContainerStyle={contentContainerStyle}
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
                      <View
                        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                      >
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
          );
        }

        return (
          <View style={{ flex: 1 }}>
            {content}
            {adGateChecked && adGateVisible && (
              <ResultsAdGateModal
                visible={true}
                onClose={() => {
                  setTimeout(() => setAdGateVisible(false), 0);
                }}
              />
            )}
          </View>
        );
      }}
    </PatientTabsLayout>
  );
}

// Legacy detail screen preserved outside of router but now powered by the new hook.
export function ResultDetailScreen() {
  const { reports, isLoading } = usePatientResults();
  const first = reports?.[0];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fff", padding: spacing.lg }}>
      <Stack.Screen
        options={{
          title: "Result Detail",
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
