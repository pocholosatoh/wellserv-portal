import { useMemo } from "react";
import { Stack, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { colors, spacing, radii } from "@wellserv/theme";
import { ParameterCard } from "../../../src/components/logs/ParameterCard";
import { patientTabsContentContainerStyle } from "../../../src/components/PatientTabsLayout";
import { usePatientMonitoring } from "../../../src/hooks/usePatientMonitoring";
import {
  LOG_PARAMETER_LIST,
  isMonitoringActive,
  normalizeMonitoringKey,
} from "../../../src/lib/logging";

const GENERAL_INSTRUCTIONS =
  "Log your readings at the same time every day. Follow your doctor\'s guidance and contact support if anything looks unusual.";

export default function LogsHomeScreen() {
  const router = useRouter();
  const monitoringQuery = usePatientMonitoring();
  const monitoringRows = monitoringQuery.data ?? [];

  const activeKeys = useMemo(() => {
    const set = new Set<string>();
    monitoringRows.forEach((row) => {
      const key = normalizeMonitoringKey(row);
      if (!key) return;
      if (isMonitoringActive(row)) set.add(key);
    });
    return set;
  }, [monitoringRows]);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Stack.Screen options={{ headerShown: false, headerShadowVisible: false, title: "" }} />
      <ScrollView contentContainerStyle={patientTabsContentContainerStyle}>
        <View
          style={{
            backgroundColor: colors.gray[100],
            borderRadius: radii.lg,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: colors.gray[200],
            marginBottom: spacing.lg,
          }}
        >
          <Text style={{ fontWeight: "700", fontSize: 16, marginBottom: spacing.xs }}>
            General instructions
          </Text>
          <Text style={{ color: colors.gray[600], lineHeight: 20 }}>{GENERAL_INSTRUCTIONS}</Text>
        </View>

        <View style={{ gap: spacing.md }}>
          {LOG_PARAMETER_LIST.map((param) => (
            <ParameterCard
              key={param.key}
              title={param.label}
              iconName={param.icon}
              isActive={activeKeys.has(param.key)}
              onPress={() => router.push(`/logs/${param.key}`)}
            />
          ))}
        </View>

        {monitoringQuery.isLoading ? (
          <View style={{ alignItems: "center", marginTop: spacing.md }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ marginTop: spacing.sm, color: colors.gray[500] }}>
              Checking monitoring status...
            </Text>
          </View>
        ) : null}

        {monitoringQuery.error ? (
          <Text style={{ marginTop: spacing.md, color: colors.gray[500], textAlign: "center" }}>
            Monitoring status is unavailable right now.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
