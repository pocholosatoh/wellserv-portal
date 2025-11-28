import { useEffect } from "react";
import { Stack, Link } from "expo-router";
import { View, Text, TouchableOpacity, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../../src/providers/SessionProvider";
import { usePatientProfile } from "@wellserv/data";
import { usePatientPrescriptions } from "../../src/hooks/usePatientPrescriptions";
import { usePatientResults } from "../../src/hooks/usePatientResults";
import { formatShortDate } from "@wellserv/core";
import { colors, spacing } from "@wellserv/theme";
import icon from "../../assets/icon.png";

export default function HomeScreen() {
  const { session, client, signOut } = useSession();
  const patientId = session?.patientId;
  const profileQuery = usePatientProfile(client, patientId);
  const patientResults = usePatientResults({ limit: 1 });
  const rxQuery = usePatientPrescriptions();
  const greetingName = (() => {
    const toTitle = (s: string) => {
      if (!s) return s;
      return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    };

    const full = profileQuery.data?.fullName?.trim();
    if (full) {
      // If stored as "LAST, FIRST ..." prefer the portion after the comma.
      if (full.includes(",")) {
        const afterComma = full.split(",")[1]?.trim();
        if (afterComma) return toTitle(afterComma.split(/\s+/)[0] || afterComma);
      }
      return toTitle(full.split(/\s+/)[0] || full);
    }
    return patientId || "Guest";
  })();

  useEffect(() => {
    console.log("HOME session:", session);
  }, [session]);

  const latestReport = patientResults.reports?.[0];
  const latestResultDate = patientResults.isLoading
    ? "Loading..."
    : formatShortDate(latestReport?.visit?.date_of_test) || "—";
  const resultsReady =
    !!latestReport &&
    latestReport.sections.some((section) => section.items && section.items.length > 0);
  const resultsReadyMark = resultsReady ? "✓" : "";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ title: "Home" }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.sm,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "600", flex: 1 }} numberOfLines={1}>
            Hello, {greetingName} 👋
          </Text>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- React Native Image uses accessibilityLabel instead of alt */}
          <Image
            source={icon}
            style={{ width: 40, height: 40, marginLeft: spacing.md }}
            resizeMode="contain"
            accessibilityLabel="Wellserv logo"
          />
        </View>
        <Text style={{ color: colors.gray[500], marginBottom: spacing.md }}>
          Patient ID: {patientId ?? "—"}
        </Text>

        <View style={{ flexDirection: "row", columnGap: 12, marginBottom: spacing.lg }}>
          <Link href="/(tabs)/results" asChild>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: colors.primaryLight,
                borderRadius: 18,
                padding: 16,
              }}
            >
              <Text style={{ fontWeight: "600", marginBottom: 8 }}>Results</Text>
              <Text style={{ color: colors.gray[700], marginBottom: 4 }}>
                Latest: {latestResultDate}
              </Text>
              <Text style={{ color: colors.gray[800] }}>
                Results ready: {resultsReadyMark}
              </Text>
            </TouchableOpacity>
          </Link>
          <Link href="/(tabs)/prescriptions" asChild>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: "#f3f4f6",
                borderRadius: 18,
                padding: 16,
              }}
            >
              <Text style={{ fontWeight: "600", marginBottom: 8 }}>Prescriptions</Text>
              <Text>{rxQuery.data?.[0]?.issuedAt?.slice(0, 10) ?? "—"}</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <TouchableOpacity
          onPress={signOut}
          style={{
            borderWidth: 1,
            borderColor: colors.gray[300],
            borderRadius: 16,
            padding: 14,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.gray[600], fontWeight: "500" }}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
