import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { useSession } from "../src/providers/SessionProvider";
import { colors, radii, spacing } from "@wellserv/theme";

export default function LoginScreen() {
  const { session, signIn, isLoading } = useSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ patient_id?: string }>();
  const [patientId, setPatientId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (params?.patient_id) {
      setPatientId(String(params.patient_id).toUpperCase());
    }
  }, [params?.patient_id]);

  if (!isLoading && session) {
    return <Redirect href="/(tabs)" />;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await signIn(patientId, pin);
    } catch (e: any) {
      if (e?.code === "PIN_REQUIRED") {
        router.push({
          pathname: "/set-pin" as any,
          params: { patient_id: patientId.trim().toUpperCase() },
        });
        setSubmitting(false);
        return;
      }
      setError(e?.message ?? "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Stack.Screen options={{ title: "Patient Login" }} />
      <View style={{ flex: 1, paddingHorizontal: spacing.lg, justifyContent: "center" }}>
        <Text style={{ fontSize: 24, fontWeight: "600", marginBottom: spacing.md, color: colors.primary }}>
          Sign in to Wellserv
        </Text>
        <TextInput
          placeholder="Patient ID"
          value={patientId}
          onChangeText={setPatientId}
          autoCapitalize="characters"
          style={{
            borderWidth: 1,
            borderColor: colors.gray[300],
            borderRadius: radii.md,
            padding: 12,
            marginBottom: spacing.sm,
          }}
        />
        <TextInput
          placeholder="4-digit PIN"
          value={pin}
          onChangeText={setPin}
          secureTextEntry
          keyboardType="number-pad"
          maxLength={4}
          style={{
            borderWidth: 1,
            borderColor: colors.gray[300],
            borderRadius: radii.md,
            padding: 12,
            marginBottom: spacing.md,
          }}
        />
        {error && (
          <Text style={{ color: "red", marginBottom: spacing.sm }}>
            {error}
          </Text>
        )}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          style={{
            backgroundColor: colors.primary,
            borderRadius: radii.md,
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "600" }}>Sign In</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: "/set-pin" as any,
              params: { patient_id: patientId.trim().toUpperCase() },
            })
          }
          style={{ marginTop: spacing.md, alignSelf: "flex-start" }}
        >
          <Text style={{ color: colors.primary, fontWeight: "600" }}>
            No PIN yet? Set up your PIN
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
