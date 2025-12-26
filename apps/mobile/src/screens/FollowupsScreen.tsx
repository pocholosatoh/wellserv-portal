import { Stack } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  View,
  Text,
  Image,
} from "react-native";
import { colors, spacing } from "@wellserv/theme";
import { usePatientFollowups } from "../hooks/usePatientFollowups";
import icon from "../../assets/icon.png";
import { patientTabsContentContainerStyle } from "../components/PatientTabsLayout";

function formatLongDate(iso?: string | null) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(+dt)) return iso;
  return dt.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function FollowupsScreen() {
  const { followup, isLoading, error, refetch, isFetching } = usePatientFollowups();
  const contentContainerStyle = patientTabsContentContainerStyle;

  if (isLoading) {
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
          <Text style={{ marginTop: spacing.sm, color: colors.gray[500] }}>
            Loading follow-ups…
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
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
            We couldn&apos;t load your follow-up details right now.
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
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false, headerShadowVisible: false, title: "" }} />
      <FlatList
        data={[followup || {}]}
        keyExtractor={() => "followup-card"}
        contentContainerStyle={contentContainerStyle}
        renderItem={() => (
          <View
            style={{
              backgroundColor: "#f3f4f6",
              borderRadius: 18,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.gray[100],
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: spacing.sm }}>
              Scheduled Follow-up date: {formatLongDate(followup?.dueDate)}
            </Text>
            <View style={{ rowGap: 10 }}>
              <Text style={{ color: colors.gray[700] }}>
                Branch: {followup?.returnBranchLabel || followup?.returnBranch || "—"}
              </Text>
              {followup?.doctorName && (
                <Text style={{ color: colors.gray[800], fontWeight: "600" }}>
                  By Doctor: <Text style={{ fontWeight: "500" }}>{followup.doctorName}</Text>
                </Text>
              )}
              {followup?.intendedOutcome && (
                <Text style={{ color: colors.gray[800], fontWeight: "600" }}>
                  The Dr. wants to:{" "}
                  <Text style={{ fontWeight: "500" }}>{followup.intendedOutcome}</Text>
                </Text>
              )}
              {followup?.expectedTests.length ? (
                <View>
                  <Text style={{ color: colors.gray[800], fontWeight: "600", marginBottom: 6 }}>
                    Retest the following:
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {followup.expectedTests.map((tok) => (
                      <View
                        key={tok}
                        style={{
                          backgroundColor: "#fff",
                          borderRadius: 12,
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderWidth: 1,
                          borderColor: colors.gray[200],
                        }}
                      >
                        <Text style={{ color: colors.gray[700], fontFamily: "Menlo" }}>{tok}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {!followup && (
                <Text style={{ color: colors.gray[600], marginTop: spacing.sm }}>
                  No follow-up scheduled yet.
                </Text>
              )}
              {isFetching && <Text style={{ color: colors.gray[500] }}>Refreshing…</Text>}
            </View>
          </View>
        )}
      />
    </View>
  );
}
