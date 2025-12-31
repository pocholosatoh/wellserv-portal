import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSession } from "../src/providers/SessionProvider";
import { colors, fontSizes, radii, spacing } from "@wellserv/theme";
import { AuthCard } from "../src/components/AuthCard";
import { SafeAreaView } from "react-native-safe-area-context";

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
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoiding}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <AuthCard
              title="Patient Portal"
              subtitle="Enter your Patient ID and PIN to view your results."
              footer={
                <View style={styles.footerLinks}>
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
                  <TouchableOpacity
                    style={styles.linkSpacing}
                    onPress={() => router.push("/forgot-pin" as any)}
                  >
                    <Text style={styles.linkText}>Forgot PIN?</Text>
                  </TouchableOpacity>
                </View>
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
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Continue</Text>
                )}
              </TouchableOpacity>
            </AuthCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  keyboardAvoiding: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing["2xl"],
  },
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
  footerLinks: {
    alignItems: "flex-start",
  },
  linkSpacing: {
    marginTop: spacing.sm,
  },
  errorText: {
    color: "#b42318",
    marginBottom: spacing.sm,
    fontSize: fontSizes.sm,
  },
});
