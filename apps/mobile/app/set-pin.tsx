import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";
import { colors, radii, spacing } from "@wellserv/theme";
import { PATIENT_ACCESS_CODE } from "../src/lib/env";
import { getApiBaseUrl } from "../src/lib/api";

export default function SetPinScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ patient_id?: string }>();
  const initialPatientId = useMemo(
    () => (params?.patient_id ? String(params.patient_id).toUpperCase() : ""),
    [params?.patient_id]
  );

  const [patientId, setPatientId] = useState(initialPatientId);
  const [accessCode, setAccessCode] = useState(PATIENT_ACCESS_CODE || "");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialPatientId && !patientId) {
      setPatientId(initialPatientId);
    }
  }, [initialPatientId, patientId]);

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

      const res = await fetch(`${baseUrl}/api/mobile/patient/set-pin`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          patient_id: patientId.trim().toUpperCase(),
          general_access_code: accessCode.trim(),
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
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Stack.Screen options={{ title: "Set PIN" }} />
      <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: spacing.md, color: colors.primary }}>
          Create your PIN
        </Text>
        <Text style={{ color: colors.gray[600], marginBottom: spacing.lg }}>
          Enter your Patient ID, the general access code, and choose a 4-digit PIN to sign in securely next time.
        </Text>

        <TextInput
          placeholder="Patient ID"
          value={patientId}
          onChangeText={(val) => {
            setPatientId(val);
            setError(null);
          }}
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
          placeholder="General access code"
          value={accessCode}
          onChangeText={(val) => {
            setAccessCode(val);
            setError(null);
          }}
          secureTextEntry
          style={{
            borderWidth: 1,
            borderColor: colors.gray[300],
            borderRadius: radii.md,
            padding: 12,
            marginBottom: spacing.sm,
          }}
        />
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
          style={{
            borderWidth: 1,
            borderColor: colors.gray[300],
            borderRadius: radii.md,
            padding: 12,
            marginBottom: spacing.sm,
          }}
        />
        <TextInput
          placeholder="Confirm PIN"
          value={confirmPin}
          onChangeText={(val) => {
            setConfirmPin(val);
            setError(null);
          }}
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
        {success && (
          <Text style={{ color: colors.primary, marginBottom: spacing.sm }}>
            {success}
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
            opacity: submitting ? 0.9 : 1,
          }}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "600" }}>Save PIN</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            router.replace({
              pathname: "/login",
              params: { patient_id: patientId.trim().toUpperCase() },
            })
          }
          style={{ marginTop: spacing.lg }}
        >
          <Text style={{ color: colors.gray[700], fontWeight: "600" }}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
