import { useEffect, useMemo, useRef, useState } from "react";
import { Stack, Link } from "expo-router";
import { Animated, View, Text, TouchableOpacity, ScrollView, Image, Linking } from "react-native";
import { FontAwesome, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSession } from "../../src/providers/SessionProvider";
import { usePatientProfile } from "@wellserv/data";
import { usePatientPrescriptions } from "../../src/hooks/usePatientPrescriptions";
import { usePatientResults } from "../../src/hooks/usePatientResults";
import { usePatientFollowups } from "../../src/hooks/usePatientFollowups";
import { useHubs } from "../../src/hooks/useHubs";
import { colors, spacing } from "@wellserv/theme";
import icon from "../../assets/icon.png";

export default function HomeScreen() {
  const { session, client, signOut } = useSession();
  const patientId = session?.patientId;
  const profileQuery = usePatientProfile(client, patientId, { session });
  const patientResults = usePatientResults({ limit: 1 });
  const rxQuery = usePatientPrescriptions();
  const followupQuery = usePatientFollowups();
  const hubsQuery = useHubs();
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const isLoggedIn = !!patientId;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const queryStates = [
    { isLoading: profileQuery.isLoading, error: profileQuery.error },
    { isLoading: patientResults.isLoading, error: patientResults.error },
    { isLoading: rxQuery.isLoading, error: rxQuery.error },
    { isLoading: followupQuery.isLoading, error: followupQuery.error },
    { isLoading: hubsQuery.isLoading, error: hubsQuery.error },
  ];
  const totalQueries = queryStates.length;
  const doneCount = queryStates.reduce(
    (acc, query) => acc + (!query.isLoading || query.error ? 1 : 0),
    0,
  );
  const progress = totalQueries ? doneCount / totalQueries : 1;
  const allDone = doneCount === totalQueries;
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
    if (__DEV__) {
      console.log("HOME session:", session);
    }
  }, [session]);

  useEffect(() => {
    if (!isLoggedIn) {
      setHasTimedOut(false);
      return;
    }
    if (allDone) return;
    const timer = setTimeout(() => {
      setHasTimedOut(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [allDone, isLoggedIn]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const formatLongDate = (iso?: string | null) => {
    if (!iso) return "—";
    const dt = new Date(iso);
    if (Number.isNaN(+dt)) return iso;
    return dt.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const latestReport = patientResults.reports?.[0];
  const latestResultDate = patientResults.isLoading
    ? "Loading..."
    : formatLongDate(latestReport?.visit?.date_of_test) || "—";
  const resultsReady =
    !!latestReport &&
    latestReport.sections.some((section) => section.items && section.items.length > 0);
  const resultsReadyMark = resultsReady ? "✓" : "";

  const latestPrescription = useMemo(() => rxQuery.data?.[0], [rxQuery.data]);
  const formatShortNumeric = (iso?: string | null) => {
    if (!iso) return "—";
    const dt = new Date(iso);
    if (Number.isNaN(+dt)) return iso;
    return dt.toLocaleDateString("en-US");
  };

  const latestPrescriptionDate = rxQuery.isLoading
    ? "Loading..."
    : formatShortNumeric(latestPrescription?.issuedAt);

  const doctorDisplay = useMemo(() => {
    const raw = latestPrescription?.doctorName || latestPrescription?.doctorNamePlain || "";
    return raw.trim();
  }, [latestPrescription]);

  const followup = followupQuery.followup;
  const hasFollowup = !!followup;
  const followupDateLabel = hasFollowup ? formatLongDate(followup.dueDate) : "";
  const followupBranchLabel =
    followup?.returnBranchLabel?.trim() || followup?.returnBranch?.trim() || "";
  const hubs = hubsQuery.data ?? [];
  const showDashboard = !isLoggedIn || allDone || hasTimedOut;

  if (isLoggedIn && !showDashboard) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <Stack.Screen
          options={{
            title: "Home",
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
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- React Native Image uses accessibilityLabel instead of alt */}
          <Image
            source={icon}
            style={{ width: 96, height: 96, marginBottom: spacing.lg }}
            resizeMode="contain"
            accessibilityLabel="Wellserv logo"
          />
          <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: spacing.md }}>
            Loading your dashboard...
          </Text>
          <View
            style={{
              width: "80%",
              maxWidth: 320,
              height: 10,
              borderRadius: 999,
              backgroundColor: colors.gray[200],
              overflow: "hidden",
            }}
          >
            <Animated.View
              style={{
                height: "100%",
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
                backgroundColor: colors.primary,
                borderRadius: 999,
              }}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Stack.Screen
        options={{
          title: "Home",
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
        {profileQuery.error && (
          <Text style={{ color: colors.gray[500], marginBottom: spacing.md }}>
            We couldn&apos;t load your profile details right now.
          </Text>
        )}

        <View style={{ flexDirection: "row", columnGap: 12, marginBottom: spacing.lg }}>
          <Link href="/results" asChild>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                borderRadius: 18,
                padding: 16,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: spacing.sm,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "600", marginBottom: 8, color: "#fff" }}>Results</Text>
                  <Text style={{ color: "#fff", marginBottom: 4 }}>Latest: {latestResultDate}</Text>
                  <Text style={{ color: "#fff" }}>
                    Results ready for viewing: {resultsReadyMark}
                  </Text>
                  {patientResults.error && (
                    <Text style={{ color: "#fff", marginTop: 6 }}>
                      We couldn&apos;t load your latest results.
                    </Text>
                  )}
                </View>
                <MaterialCommunityIcons
                  name="microscope"
                  size={28}
                  color="rgba(255, 255, 255, 0.9)"
                  style={{ marginTop: 2 }}
                />
              </View>
            </TouchableOpacity>
          </Link>
          <Link href="/prescriptions" asChild>
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: "#f3f4f6",
                borderRadius: 18,
                padding: 16,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: spacing.sm,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "600", marginBottom: 8 }}>Prescriptions</Text>
                  <Text style={{ color: colors.gray[700], marginBottom: 4 }}>
                    Latest: {latestPrescriptionDate}
                  </Text>
                  {!!doctorDisplay && (
                    <Text style={{ color: colors.gray[800] }}>
                      From your Doctor:{"\n"}
                      {doctorDisplay}
                    </Text>
                  )}
                  {rxQuery.error && (
                    <Text style={{ color: colors.gray[600], marginTop: 6 }}>
                      We couldn&apos;t load your prescriptions.
                    </Text>
                  )}
                </View>
                <MaterialCommunityIcons
                  name="stethoscope"
                  size={28}
                  color={colors.primary}
                  style={{ marginTop: 2 }}
                />
              </View>
            </TouchableOpacity>
          </Link>
        </View>

        <Link href="/delivery" asChild>
          <TouchableOpacity
            style={{
              backgroundColor: "#e0f2f1",
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.gray[100],
              marginBottom: spacing.lg,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700", marginBottom: 6, color: colors.gray[900] }}>
                Online Pharmacy
              </Text>
              <Text style={{ color: colors.gray[700], lineHeight: 18 }}>
                Register your delivery address and request doorstep delivery for your prescriptions.
              </Text>
            </View>
            <MaterialCommunityIcons name="pill" size={28} color={colors.primary} />
          </TouchableOpacity>
        </Link>

        <Link href="/logs" asChild>
          <TouchableOpacity
            style={{
              backgroundColor: "#f3f4f6",
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.gray[100],
              marginBottom: spacing.lg,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700", marginBottom: 6, color: colors.gray[900] }}>
                Logs
              </Text>
              <Text style={{ color: colors.gray[700], lineHeight: 18 }}>
                Record your blood pressure, weight, or glucose readings.
              </Text>
            </View>
            <MaterialCommunityIcons name="clipboard-text" size={28} color={colors.primary} />
          </TouchableOpacity>
        </Link>

        <Link href="/followups" asChild>
          <TouchableOpacity
            style={{
              backgroundColor: "#f3f4f6",
              borderRadius: 18,
              padding: 16,
              marginBottom: spacing.lg,
              borderWidth: 1,
              borderColor: colors.gray[100],
              opacity: followupQuery.followup ? 1 : 0.9,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: spacing.md,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", marginBottom: 8 }}>Follow-ups</Text>
                {followupQuery.isLoading && (
                  <Text style={{ color: colors.gray[700] }}>Loading follow-up...</Text>
                )}
                {followupQuery.error && (
                  <Text style={{ color: colors.gray[600] }}>
                    We couldn&apos;t load your follow-up details.
                  </Text>
                )}
                {hasFollowup && (
                  <>
                    <Text style={{ color: colors.gray[700], marginBottom: 4 }}>
                      Scheduled: {followupDateLabel}
                    </Text>
                    {!!followupBranchLabel && (
                      <Text style={{ color: colors.gray[700] }}>Branch: {followupBranchLabel}</Text>
                    )}
                  </>
                )}
                {!followupQuery.isLoading && !hasFollowup && !followupQuery.error && (
                  <Text style={{ color: colors.gray[600], marginTop: 6 }}>
                    No follow-up scheduled yet.
                  </Text>
                )}
              </View>
              <MaterialCommunityIcons
                name="calendar-clock"
                size={28}
                color={colors.primary}
                style={{ marginTop: 2 }}
              />
            </View>
          </TouchableOpacity>
        </Link>

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

        <TouchableOpacity
          style={{
            marginTop: spacing.xl,
            paddingVertical: spacing.sm,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottomWidth: 1,
            borderBottomColor: colors.gray[200],
          }}
          onPress={() => setIsSupportOpen((prev) => !prev)}
        >
          <Text style={{ fontWeight: "700", color: colors.gray[800] }}>Help & Support</Text>
          <Feather
            name={isSupportOpen ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.gray[600]}
          />
        </TouchableOpacity>

        {isSupportOpen && (
          <View style={{ marginTop: spacing.md }}>
            <Text style={{ marginBottom: spacing.md, color: colors.gray[800] }}>
              Do you have a concern? Contact us via our health hubs or social channels below:
            </Text>

            {hubsQuery.isLoading ? (
              <Text style={{ marginTop: spacing.md, color: colors.gray[500] }}>
                Loading hubs...
              </Text>
            ) : hubsQuery.error ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={{ color: colors.gray[500] }}>
                  We couldn&apos;t load the hubs list.
                </Text>
                <TouchableOpacity onPress={() => hubsQuery.refetch()} style={{ marginTop: 6 }}>
                  <Text style={{ color: colors.primary, fontWeight: "600" }}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : hubs.length ? (
              hubs.map((hub) => (
                <View
                  key={hub.code}
                  style={{
                    marginTop: spacing.md,
                    padding: spacing.md,
                    borderRadius: 12,
                    backgroundColor: colors.gray[50],
                    borderWidth: 1,
                    borderColor: colors.gray[100],
                  }}
                >
                  <Text style={{ fontWeight: "700", color: colors.gray[900] }}>{hub.name}</Text>

                  {hub.address && (
                    <Text style={{ marginTop: 4, color: colors.gray[700] }}>{hub.address}</Text>
                  )}

                  {hub.contact && (
                    <Text style={{ marginTop: 2, color: colors.gray[700] }}>
                      Contact: {hub.contact}
                    </Text>
                  )}
                </View>
              ))
            ) : (
              <Text style={{ marginTop: spacing.md, color: colors.gray[500] }}>
                No active health hubs available.
              </Text>
            )}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.lg,
                marginTop: spacing.lg,
              }}
            >
              <TouchableOpacity onPress={() => Linking.openURL("https://m.me/100882935339577")}>
                <MaterialCommunityIcons
                  name="facebook-messenger"
                  size={28}
                  color={colors.primary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  Linking.openURL("https://www.facebook.com/wellservmedicalcorporation")
                }
              >
                <FontAwesome name="facebook-square" size={28} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => Linking.openURL("https://www.wellserv.co")}>
                <Feather name="globe" size={28} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text
          style={{
            marginTop: spacing.xl,
            marginBottom: spacing.lg,
            textAlign: "center",
            fontSize: 12,
            color: colors.gray[400],
          }}
        >
          © {new Date().getFullYear()} WELLSERV Mobile
        </Text>
      </ScrollView>
    </View>
  );
}
