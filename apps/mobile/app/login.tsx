import { Redirect, Stack } from "expo-router";
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { useSession } from "../src/providers/SessionProvider";
import { colors, radii, spacing } from "@wellserv/theme";

export default function LoginScreen() {
  const { session, signIn, isLoading } = useSession();
  const [patientId, setPatientId] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && session) {
    return <Redirect href="/(tabs)" />;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await signIn(patientId, accessCode);
    } catch (e: any) {
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
          placeholder="Access code"
          value={accessCode}
          onChangeText={setAccessCode}
          secureTextEntry
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
      </View>
    </View>
  );
}
