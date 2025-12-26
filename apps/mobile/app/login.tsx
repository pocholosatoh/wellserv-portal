import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSession } from "../src/providers/SessionProvider";
import { colors, fontSizes, radii, spacing } from "@wellserv/theme";
import { AuthCard } from "../src/components/AuthCard";

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
    <>
      <Stack.Screen options={{ title: "Patient Portal" }} />
      <AuthCard
        title="Patient Portal"
        subtitle="Enter your Patient ID and PIN to view your results."
        footer={
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/set-pin" as any,
                params: { patient_id: patientId.trim().toUpperCase() },
              })
            }
          >
            <Text style={styles.linkText}>First time? Set up PIN</Text>
          </TouchableOpacity>
        }
      >
        <View style={styles.field}>
          <Text style={styles.label}>Patient ID</Text>
          <TextInput
            placeholder="Enter your Patient ID"
            value={patientId}
            onChangeText={setPatientId}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>PIN</Text>
          <TextInput
            placeholder="4-digit PIN"
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={4}
            style={styles.input}
          />
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          style={[styles.primaryButton, submitting && styles.buttonDisabled]}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Continue</Text>}
        </TouchableOpacity>
      </AuthCard>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.gray[600],
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: fontSizes.base,
    backgroundColor: "#fff",
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: fontSizes.base,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  linkText: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: fontSizes.base,
  },
  errorText: {
    color: "#b42318",
    marginBottom: spacing.sm,
    fontSize: fontSizes.sm,
  },
});
