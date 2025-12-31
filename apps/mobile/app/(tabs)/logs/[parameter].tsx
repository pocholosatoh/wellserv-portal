import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, radii, spacing } from "@wellserv/theme";
import { MeasuredAtRow } from "../../../src/components/logs/MeasuredAtRow";
import { patientTabsContentContainerStyle } from "../../../src/components/PatientTabsLayout";
import { useLatestEncounter } from "../../../src/hooks/useLatestEncounter";
import { usePatientMonitoring } from "../../../src/hooks/usePatientMonitoring";
import { usePatientVitals } from "../../../src/hooks/usePatientVitals";
import {
  LOG_PARAMETERS,
  LogParameterKey,
  getMonitoringInstructions,
  normalizeMonitoringKey,
} from "../../../src/lib/logging";
import { apiFetch } from "../../../src/lib/http";

type ToastState = { message: string } | null;

type LogColumn = {
  key: string;
  label: string;
  flex: number;
  align?: "left" | "right";
};

const logTimestampFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function parseNumeric(value: string) {
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function formatLogTimestamp(iso: string) {
  const dt = new Date(iso);
  if (Number.isNaN(+dt)) return iso;
  return logTimestampFormatter.format(dt);
}

export default function LogParameterScreen() {
  const { parameter } = useLocalSearchParams<{ parameter?: string }>();
  const key = Array.isArray(parameter) ? parameter[0] : parameter;
  const parameterKey = (key || "").toLowerCase() as LogParameterKey;
  const config = LOG_PARAMETERS[parameterKey];
  const vitalsKey = config ? parameterKey : "";

  const monitoringQuery = usePatientMonitoring();
  const latestEncounterQuery = useLatestEncounter();
  const vitalsQuery = usePatientVitals(vitalsKey, 10);

  const [measuredAt, setMeasuredAt] = useState<Date | null>(null);
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [weight, setWeight] = useState("");
  const [glucose, setGlucose] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const encounterId = latestEncounterQuery.data?.encounterId ?? null;
  const encounterMissing = !latestEncounterQuery.isLoading && !encounterId;

  const monitoringRow = useMemo(() => {
    const rows = monitoringQuery.data ?? [];
    return rows.find((row) => normalizeMonitoringKey(row) === parameterKey) ?? null;
  }, [monitoringQuery.data, parameterKey]);

  const instructions =
    getMonitoringInstructions(monitoringRow) ?? config?.genericInstructions ?? "";

  const columns = useMemo<LogColumn[]>(() => {
    if (parameterKey === "bp") {
      return [
        { key: "time", label: "Time", flex: 1.6, align: "left" },
        { key: "systolic", label: "Systolic", flex: 1, align: "right" },
        { key: "diastolic", label: "Diastolic", flex: 1, align: "right" },
      ];
    }
    if (parameterKey === "weight") {
      return [
        { key: "time", label: "Time", flex: 1.6, align: "left" },
        { key: "weight", label: "Weight (kg)", flex: 1, align: "right" },
      ];
    }
    return [
      { key: "time", label: "Time", flex: 1.6, align: "left" },
      { key: "glucose", label: "Glucose (mg/dL)", flex: 1, align: "right" },
    ];
  }, [parameterKey]);

  const systolicValue = parseNumeric(systolic);
  const diastolicValue = parseNumeric(diastolic);
  const weightValue = parseNumeric(weight);
  const glucoseValue = parseNumeric(glucose);

  const hasRequiredValues = useMemo(() => {
    if (parameterKey === "bp") {
      return systolicValue != null && diastolicValue != null;
    }
    if (parameterKey === "weight") {
      return weightValue != null;
    }
    return glucoseValue != null;
  }, [parameterKey, systolicValue, diastolicValue, weightValue, glucoseValue]);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    setFormError(null);
    if (!config) return;

    if (encounterMissing) {
      setFormError("No encounter found. Please contact support.");
      return;
    }

    if (!hasRequiredValues) {
      if (parameterKey === "bp") {
        setFormError("Enter both systolic and diastolic values.");
      } else if (parameterKey === "weight") {
        setFormError("Enter a weight value.");
      } else {
        setFormError("Enter a glucose value.");
      }
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        parameter_key: parameterKey,
        measured_at: measuredAt ? measuredAt.toISOString() : undefined,
      };

      if (parameterKey === "bp") {
        payload.systolic_bp = systolicValue;
        payload.diastolic_bp = diastolicValue;
      } else if (parameterKey === "weight") {
        payload.weight_kg = weightValue;
      } else {
        payload.blood_glucose_mgdl = glucoseValue;
      }

      const res = await apiFetch("/api/mobile/patient/vitals", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        const rawMessage = String(json?.error || "Failed to save log.");
        if (res.status === 403 || /row[-\s]?level security|rls/i.test(rawMessage)) {
          setFormError("Self-logging isn't enabled yet. Please contact support.");
        } else if (res.status === 404) {
          setFormError("No encounter found. Please contact support.");
        } else {
          setFormError(rawMessage);
        }
        return;
      }

      setMeasuredAt(null);
      setSystolic("");
      setDiastolic("");
      setWeight("");
      setGlucose("");
      showToast("Log saved.");
      vitalsQuery.refetch();
    } catch (err) {
      setFormError("Could not save your log. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    config,
    encounterMissing,
    hasRequiredValues,
    measuredAt,
    parameterKey,
    systolicValue,
    diastolicValue,
    weightValue,
    glucoseValue,
    showToast,
    vitalsQuery,
  ]);

  if (!config) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <Stack.Screen options={{ headerShown: false, headerShadowVisible: false, title: "" }} />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.lg,
          }}
        >
          <Text style={{ color: colors.gray[600], textAlign: "center" }}>
            This log type is not available.
          </Text>
        </View>
      </View>
    );
  }

  const logRows = vitalsQuery.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Stack.Screen options={{ headerShown: false, headerShadowVisible: false, title: "" }} />
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={patientTabsContentContainerStyle}>
          <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: spacing.sm }}>
            {config.label}
          </Text>

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
            <Text style={{ fontWeight: "700", marginBottom: spacing.xs }}>Instructions</Text>
            <Text style={{ color: colors.gray[600], lineHeight: 20 }}>{instructions}</Text>
          </View>

          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: radii.lg,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.gray[200],
              marginBottom: spacing.lg,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: spacing.sm }}>
              Log now
            </Text>
            <MeasuredAtRow
              value={measuredAt}
              onChange={setMeasuredAt}
              disabled={encounterMissing}
            />

            <View style={{ marginTop: spacing.md, gap: spacing.md }}>
              {parameterKey === "bp" ? (
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontWeight: "700",
                        color: colors.gray[800],
                        marginBottom: spacing.xs,
                      }}
                    >
                      Systolic
                    </Text>
                    <TextInput
                      placeholder="120"
                      keyboardType="number-pad"
                      value={systolic}
                      onChangeText={(value) => {
                        setSystolic(value);
                        setFormError(null);
                      }}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.gray[300],
                        borderRadius: radii.md,
                        padding: 12,
                        backgroundColor: "#fff",
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontWeight: "700",
                        color: colors.gray[800],
                        marginBottom: spacing.xs,
                      }}
                    >
                      Diastolic
                    </Text>
                    <TextInput
                      placeholder="80"
                      keyboardType="number-pad"
                      value={diastolic}
                      onChangeText={(value) => {
                        setDiastolic(value);
                        setFormError(null);
                      }}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.gray[300],
                        borderRadius: radii.md,
                        padding: 12,
                        backgroundColor: "#fff",
                      }}
                    />
                  </View>
                </View>
              ) : null}

              {parameterKey === "weight" ? (
                <View>
                  <Text
                    style={{ fontWeight: "700", color: colors.gray[800], marginBottom: spacing.xs }}
                  >
                    Weight (kg)
                  </Text>
                  <TextInput
                    placeholder="65.5"
                    keyboardType="decimal-pad"
                    value={weight}
                    onChangeText={(value) => {
                      setWeight(value);
                      setFormError(null);
                    }}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.gray[300],
                      borderRadius: radii.md,
                      padding: 12,
                      backgroundColor: "#fff",
                    }}
                  />
                </View>
              ) : null}

              {parameterKey === "glucose" ? (
                <View>
                  <Text
                    style={{ fontWeight: "700", color: colors.gray[800], marginBottom: spacing.xs }}
                  >
                    Blood glucose (mg/dL)
                  </Text>
                  <TextInput
                    placeholder="110"
                    keyboardType="number-pad"
                    value={glucose}
                    onChangeText={(value) => {
                      setGlucose(value);
                      setFormError(null);
                    }}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.gray[300],
                      borderRadius: radii.md,
                      padding: 12,
                      backgroundColor: "#fff",
                    }}
                  />
                </View>
              ) : null}
            </View>

            {latestEncounterQuery.error ? (
              <Text style={{ color: colors.gray[600], marginTop: spacing.md }}>
                We couldn&apos;t verify your encounter right now.
              </Text>
            ) : null}

            {encounterMissing ? (
              <Text style={{ color: colors.gray[600], marginTop: spacing.md }}>
                No encounter found. Please contact support.
              </Text>
            ) : null}

            {formError ? (
              <Text style={{ color: "#b91c1c", marginTop: spacing.sm }}>{formError}</Text>
            ) : null}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!hasRequiredValues || encounterMissing || submitting}
              style={{
                marginTop: spacing.md,
                backgroundColor: colors.primary,
                paddingVertical: 12,
                borderRadius: radii.md,
                alignItems: "center",
                opacity: !hasRequiredValues || encounterMissing || submitting ? 0.6 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {submitting ? "Saving..." : "Save log"}
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={{
              backgroundColor: colors.gray[50],
              borderRadius: radii.lg,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.gray[200],
              marginBottom: spacing.lg,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: spacing.sm }}>
              Recent logs
            </Text>

            {vitalsQuery.isLoading ? (
              <View style={{ alignItems: "center" }}>
                <ActivityIndicator color={colors.primary} />
                <Text style={{ marginTop: spacing.sm, color: colors.gray[500] }}>
                  Loading logs...
                </Text>
              </View>
            ) : null}

            {vitalsQuery.error ? (
              <View style={{ alignItems: "center" }}>
                <Text style={{ color: colors.gray[600], textAlign: "center" }}>
                  We couldn&apos;t load your logs right now.
                </Text>
                <TouchableOpacity
                  onPress={() => vitalsQuery.refetch()}
                  style={{
                    marginTop: spacing.sm,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: colors.gray[300],
                    backgroundColor: "#fff",
                  }}
                >
                  <Text style={{ color: colors.gray[700], fontWeight: "600" }}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {!vitalsQuery.isLoading && !vitalsQuery.error && logRows.length === 0 ? (
              <Text style={{ color: colors.gray[500], textAlign: "center" }}>No logs yet.</Text>
            ) : null}

            {!vitalsQuery.isLoading && !vitalsQuery.error && logRows.length > 0 ? (
              <View style={{ gap: spacing.xs }}>
                <View
                  style={{
                    flexDirection: "row",
                    paddingBottom: spacing.xs,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.gray[200],
                  }}
                >
                  {columns.map((col) => (
                    <Text
                      key={col.key}
                      style={{
                        flex: col.flex,
                        fontSize: 12,
                        fontWeight: "700",
                        color: colors.gray[600],
                        textAlign: col.align ?? "left",
                      }}
                    >
                      {col.label}
                    </Text>
                  ))}
                </View>

                {logRows.map((row) => (
                  <View
                    key={row.id}
                    style={{
                      flexDirection: "row",
                      paddingVertical: spacing.xs,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.gray[100],
                    }}
                  >
                    {columns.map((col) => {
                      let value = "";
                      if (col.key === "time") {
                        value = formatLogTimestamp(row.measured_at);
                      } else if (col.key === "systolic") {
                        value = row.systolic_bp != null ? String(row.systolic_bp) : "—";
                      } else if (col.key === "diastolic") {
                        value = row.diastolic_bp != null ? String(row.diastolic_bp) : "—";
                      } else if (col.key === "weight") {
                        value = row.weight_kg != null ? String(row.weight_kg) : "—";
                      } else {
                        value =
                          row.blood_glucose_mgdl != null ? String(row.blood_glucose_mgdl) : "—";
                      }
                      return (
                        <Text
                          key={`${row.id}-${col.key}`}
                          style={{
                            flex: col.flex,
                            color: colors.gray[700],
                            textAlign: col.align ?? "left",
                          }}
                        >
                          {value}
                        </Text>
                      );
                    })}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>

        {toast ? (
          <View
            style={{
              position: "absolute",
              left: spacing.lg,
              right: spacing.lg,
              bottom: spacing.lg,
              backgroundColor: "rgba(20,20,20,0.92)",
              padding: 14,
              borderRadius: 16,
              shadowColor: "#000",
              shadowOpacity: 0.16,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <Text style={{ color: "#fff", textAlign: "center" }}>{toast.message}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
