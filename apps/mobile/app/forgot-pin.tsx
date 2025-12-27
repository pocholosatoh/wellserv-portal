import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fontSizes, radii, spacing } from "@wellserv/theme";
import { AuthCard } from "../src/components/AuthCard";
import { apiFetch } from "../src/lib/http";
import { getApiBaseUrl } from "../src/lib/api";

type Step = "verify" | "reset";

function formatBirthdayInput(value: string) {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

export default function ForgotPinScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("verify");
  const [patientId, setPatientId] = useState("");
  const [contact, setContact] = useState("");
  const [birthday, setBirthday] = useState("");
  const [token, setToken] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isResetStep = useMemo(() => step === "reset", [step]);

  async function handleVerify() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      if (!patientId || !contact || !birthday) {
        throw new Error("Please complete all fields.");
      }
      const baseUrl = getApiBaseUrl();
      if (!baseUrl) {
        throw new Error("API base URL not configured");
      }
      const res = await apiFetch("/api/mobile/patient/forgot-pin/verify", {
        method: "POST",
        body: JSON.stringify({
          patient_id: patientId.trim().toUpperCase(),
          contact: contact.trim(),
          birthday: birthday.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error || !json?.token) {
        throw new Error("We couldn't verify your details. Please check and try again.");
      }
      setToken(String(json.token));
      setStep("reset");
    } catch (e: any) {
      setError(e?.message || "We couldn't verify your details. Please check and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      if (!newPin || !confirmPin) {
        throw new Error("Enter and confirm your new PIN.");
      }
      if (newPin !== confirmPin) {
        throw new Error("PINs do not match.");
      }
      if (!/^[0-9]{4}$/.test(newPin)) {
        throw new Error("PIN must be exactly 4 digits.");
      }
      const res = await apiFetch("/api/mobile/patient/forgot-pin/reset", {
        method: "POST",
        body: JSON.stringify({
          patient_id: patientId.trim().toUpperCase(),
          token,
          new_pin: newPin,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        throw new Error("Unable to reset PIN. Please try again.");
      }
      setSuccess("PIN reset successfully. You can now log in.");
      setTimeout(() => {
        router.replace({
          pathname: "/login",
          params: { patient_id: patientId.trim().toUpperCase() },
        });
      }, 400);
    } catch (e: any) {
      setError(e?.message || "Unable to reset PIN. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Forgot PIN" }} />
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
              title={isResetStep ? "Reset your PIN" : "Forgot your PIN?"}
              subtitle={
                isResetStep
                  ? "Enter a new 4-digit PIN for your account."
                  : "Verify your details to reset your PIN."
              }
              footer={
                <TouchableOpacity
                  onPress={() =>
                    router.replace({
                      pathname: "/login",
                      params: { patient_id: patientId.trim().toUpperCase() },
                    })
                  }
                >
                  <Text style={styles.linkTextMuted}>Back to login</Text>
                </TouchableOpacity>
              }
            >
              {!isResetStep ? (
                <>
                  <View style={styles.field}>
                    <Text style={styles.label}>Patient ID</Text>
                    <TextInput
                      placeholder="Enter your Patient ID"
                      value={patientId}
                      onChangeText={(val) => {
                        setPatientId(val);
                        setError(null);
                      }}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Phone Number</Text>
                    <TextInput
                      placeholder="Enter your phone number"
                      value={contact}
                      onChangeText={(val) => {
                        setContact(val);
                        setError(null);
                      }}
                      keyboardType="phone-pad"
                      autoCorrect={false}
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Birthday</Text>
                    <TextInput
                      placeholder="YYYY-MM-DD"
                      value={birthday}
                      onChangeText={(val) => {
                        setBirthday(formatBirthdayInput(val));
                        setError(null);
                      }}
                      keyboardType="numbers-and-punctuation"
                      autoCorrect={false}
                      maxLength={10}
                      style={styles.input}
                    />
                  </View>
                  {error && <Text style={styles.errorText}>{error}</Text>}
                  <TouchableOpacity
                    onPress={handleVerify}
                    disabled={submitting}
                    style={[styles.primaryButton, submitting && styles.buttonDisabled]}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Verify</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.field}>
                    <Text style={styles.label}>New 4-digit PIN</Text>
                    <TextInput
                      placeholder="Choose a 4-digit PIN"
                      value={newPin}
                      onChangeText={(val) => {
                        setNewPin(val);
                        setError(null);
                      }}
                      secureTextEntry
                      keyboardType="number-pad"
                      maxLength={4}
                      style={styles.input}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Confirm PIN</Text>
                    <TextInput
                      placeholder="Re-enter your PIN"
                      value={confirmPin}
                      onChangeText={(val) => {
                        setConfirmPin(val);
                        setError(null);
                      }}
                      secureTextEntry
                      keyboardType="number-pad"
                      maxLength={4}
                      style={styles.input}
                    />
                  </View>
                  {error && <Text style={styles.errorText}>{error}</Text>}
                  {success && <Text style={styles.successText}>{success}</Text>}
                  <TouchableOpacity
                    onPress={handleReset}
                    disabled={submitting}
                    style={[styles.primaryButton, submitting && styles.buttonDisabled]}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Reset PIN</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
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
  linkTextMuted: {
    color: colors.gray[700],
    fontWeight: "600",
    fontSize: fontSizes.base,
  },
  errorText: {
    color: "#b42318",
    marginBottom: spacing.sm,
    fontSize: fontSizes.sm,
  },
  successText: {
    color: colors.primary,
    marginBottom: spacing.sm,
    fontSize: fontSizes.sm,
  },
});
