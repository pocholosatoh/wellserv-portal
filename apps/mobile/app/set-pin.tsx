import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  GestureResponderEvent,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { colors, fontSizes, radii, spacing } from "@wellserv/theme";
import { AuthCard } from "../src/components/AuthCard";
import { getApiBaseUrl } from "../src/lib/api";
import { apiFetch } from "../src/lib/http";
import { SafeAreaView } from "react-native-safe-area-context";

const PRIVACY_ACCEPTED_KEY = "privacyAccepted";

export default function SetPinScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ patient_id?: string }>();
  const initialPatientId = useMemo(
    () => (params?.patient_id ? String(params.patient_id).toUpperCase() : ""),
    [params?.patient_id],
  );

  const [patientId, setPatientId] = useState(initialPatientId);
  const [accessCode, setAccessCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  useEffect(() => {
    if (initialPatientId && !patientId) {
      setPatientId(initialPatientId);
    }
  }, [initialPatientId, patientId]);

  useEffect(() => {
    let mounted = true;
    SecureStore.getItemAsync(PRIVACY_ACCEPTED_KEY)
      .then((value: string | null) => {
        if (mounted && value === "true") {
          setPrivacyAccepted(true);
        }
      })
      .catch(() => null);
    return () => {
      mounted = false;
    };
  }, []);

  async function handlePrivacyToggle() {
    const nextValue = !privacyAccepted;
    setPrivacyAccepted(nextValue);
    if (nextValue) {
      await SecureStore.setItemAsync(PRIVACY_ACCEPTED_KEY, "true");
    } else {
      await SecureStore.deleteItemAsync(PRIVACY_ACCEPTED_KEY);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      if (!patientId) {
        throw new Error("Enter Patient ID");
      }
      if (!accessCode) {
        throw new Error("Enter the general access code provided by the clinic");
      }
      if (!privacyAccepted) {
        throw new Error("Please accept the Data Privacy Notice to continue");
      }
      if (!pin || !confirmPin) {
        throw new Error("Enter and confirm your PIN");
      }
      if (pin !== confirmPin) {
        throw new Error("PINs do not match");
      }

      const baseUrl = getApiBaseUrl();
      if (!baseUrl) {
        throw new Error("API base URL not configured");
      }

      const res = await apiFetch("/api/mobile/patient/set-pin", {
        method: "POST",
        body: JSON.stringify({
          patient_id: patientId.trim().toUpperCase(),
          general_access_code: accessCode.trim().toLowerCase(),
          pin,
          confirmPin,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        throw new Error(json?.error || json?.message || "Unable to set PIN");
      }

      setSuccess(json?.message || "PIN set successfully. You can now log in with your PIN.");
      setTimeout(() => {
        router.replace({
          pathname: "/login",
          params: { patient_id: patientId.trim().toUpperCase() },
        });
      }, 400);
    } catch (e: any) {
      setError(e?.message ?? "Unable to set PIN");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Create your PIN" }} />
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
              title="Create your PIN"
              subtitle="Enter your Patient ID and General Access Code to set up a 4-digit PIN."
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
                <Text style={styles.label}>General Access Code</Text>
                <TextInput
                  placeholder="Enter the code from your clinic"
                  value={accessCode}
                  onChangeText={(val) => {
                    setAccessCode(val);
                    setError(null);
                  }}
                  keyboardType="default"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>4-digit PIN</Text>
                <TextInput
                  placeholder="Choose a 4-digit PIN"
                  value={pin}
                  onChangeText={(val) => {
                    setPin(val);
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

              <Pressable style={styles.consentRow} onPress={handlePrivacyToggle}>
                <View style={[styles.checkbox, privacyAccepted && styles.checkboxChecked]}>
                  {privacyAccepted ? <Text style={styles.checkboxMark}>✓</Text> : null}
                </View>
                <Text style={styles.consentText}>
                  I consent to the processing of my personal and health information for identity
                  verification and results release as described in the{" "}
                  <Text
                    style={styles.consentLink}
                    onPress={(event: GestureResponderEvent) => {
                      event.stopPropagation?.();
                      setPrivacyModalOpen(true);
                    }}
                  >
                    Data Privacy Notice
                  </Text>
                  .
                </Text>
              </Pressable>

              {error && <Text style={styles.errorText}>{error}</Text>}
              {success && <Text style={styles.successText}>{success}</Text>}

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting || !privacyAccepted}
                style={[
                  styles.primaryButton,
                  (submitting || !privacyAccepted) && styles.buttonDisabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save PIN</Text>
                )}
              </TouchableOpacity>
            </AuthCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal
        visible={privacyModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPrivacyModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Data Privacy Notice</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
              <Text style={styles.modalText}>
                We collect and process your personal and health information to verify your identity
                and release your results in the Patient Portal.
              </Text>
              <Text style={styles.modalText}>
                Your information may include your Patient ID, access code, and other details you
                provide in this app. We use this data only for portal access, identity verification,
                and to deliver your results securely.
              </Text>
              <Text style={styles.modalText}>
                We take reasonable security measures to protect your data. You may contact the
                clinic if you have questions about how your information is handled.
              </Text>
            </ScrollView>
            <TouchableOpacity style={styles.modalButton} onPress={() => setPrivacyModalOpen(false)}>
              <Text style={styles.modalButtonText}>I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.gray[400],
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    marginRight: spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxMark: {
    color: "#fff",
    fontSize: fontSizes.base,
    fontWeight: "700",
  },
  consentText: {
    flex: 1,
    fontSize: fontSizes.sm,
    color: colors.gray[700],
    lineHeight: 20,
  },
  consentLink: {
    color: colors.primary,
    fontWeight: "600",
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
    opacity: 0.6,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.5)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: fontSizes.lg,
    fontWeight: "700",
    marginBottom: spacing.sm,
    color: "#111827",
  },
  modalBody: {
    marginBottom: spacing.md,
  },
  modalText: {
    fontSize: fontSizes.base,
    color: colors.gray[700],
    marginBottom: spacing.sm,
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: fontSizes.base,
  },
});
