import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stack, useRouter } from "expo-router";
import * as Location from "expo-location";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, radii, spacing } from "@wellserv/theme";
import { getApiBaseUrl } from "../lib/api";
import { useSession } from "../providers/SessionProvider";
import { PatientDeliveryInfo, useDeliveryInfo } from "../hooks/useDeliveryInfo";
import { PatientTabsLayout } from "../components/PatientTabsLayout";

type DeliveryScreenProps = Record<string, never>;

type AddressFormProps = {
  patient: PatientDeliveryInfo;
  onSaved: (updated: PatientDeliveryInfo) => void;
  onError?: (message: string) => void;
};

type DeliveryOrderScreenProps = {
  patient: PatientDeliveryInfo;
  onOrderSuccess: (updated: PatientDeliveryInfo) => void;
  onEditAddress: () => void;
  onError?: (message: string) => void;
};

type ToastState = {
  message: string;
} | null;

const DATE_FMT = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  const dt = new Date(iso);
  if (Number.isNaN(+dt)) return iso;
  return DATE_FMT.format(dt);
}

function round6(n: number) {
  return Math.round(n * 1_000_000) / 1_000_000;
}

function hasAddress(row?: PatientDeliveryInfo | null) {
  if (!row) return false;
  const label = String(row.delivery_address_label || "").trim();
  const text = String(row.delivery_address_text || "").trim();
  return Boolean(label && text && row.delivery_lat != null && row.delivery_lng != null);
}

function successCopy() {
  return "Your delivery request has been received. A WELLSERV representative will call to confirm your order.";
}

export const DeliveryScreen: React.FC<DeliveryScreenProps> = () => {
  const { session, isLoading: sessionLoading } = useSession();
  const patientId = session?.patientId;
  const router = useRouter();
  const deliveryQuery = useDeliveryInfo();
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mode, setMode] = useState<"register" | "order">("register");

  const handleTabPress = useCallback(
    (tab: string) => {
      switch (tab) {
        case "home":
          router.replace("/");
          break;
        case "results":
          router.replace("/results");
          break;
        case "prescriptions":
          router.replace("/prescriptions");
          break;
        case "followups":
          router.replace("/followups");
          break;
        case "pharmacy":
          router.replace("/delivery");
          break;
        default:
          break;
      }
    },
    [router]
  );

  useEffect(() => {
    setMode(hasAddress(deliveryQuery.data) ? "order" : "register");
  }, [deliveryQuery.data]);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const headerSubtitle = useMemo(() => {
    if (mode === "register") return "Register your delivery address so we can reach you.";
    return "Review your saved address and request a delivery.";
  }, [mode]);

  if (sessionLoading || deliveryQuery.isLoading || !patientId || deliveryQuery.error) {
    const body = () => {
      if (sessionLoading || deliveryQuery.isLoading) {
        return (
          <>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ marginTop: spacing.sm, color: colors.gray[600] }}>
              Loading your delivery details...
            </Text>
          </>
        );
      }
      if (!patientId) {
        return (
          <>
            <Text style={{ color: colors.gray[700], textAlign: "center", marginBottom: spacing.md }}>
              Please sign in to manage delivery requests.
            </Text>
            <TouchableOpacity
              onPress={() => router.replace("/login")}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 12,
                paddingHorizontal: 18,
                borderRadius: radii.md,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Go to login</Text>
            </TouchableOpacity>
          </>
        );
      }
      if (deliveryQuery.error) {
        return (
          <>
            <Text style={{ color: colors.gray[700], marginBottom: spacing.md }}>
              We could not load your delivery info right now.
              {"\n"}
              {String(deliveryQuery.error)}
            </Text>
            <TouchableOpacity
              onPress={() => deliveryQuery.refetch()}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 12,
                paddingHorizontal: 18,
                borderRadius: radii.md,
                alignSelf: "flex-start",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Retry</Text>
            </TouchableOpacity>
          </>
        );
      }
      if (!deliveryQuery.data) {
        return (
          <>
            <Text style={{ color: colors.gray[700], marginBottom: spacing.md }}>
              No delivery information found for your account.
            </Text>
            <TouchableOpacity
              onPress={() => deliveryQuery.refetch()}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 12,
                paddingHorizontal: 18,
                borderRadius: radii.md,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Reload</Text>
            </TouchableOpacity>
          </>
        );
      }
      return (
        <>
          <Text style={{ color: colors.gray[700], marginBottom: spacing.md }}>
            No delivery information found for your account.
          </Text>
          <TouchableOpacity
            onPress={() => deliveryQuery.refetch()}
            style={{
              backgroundColor: colors.primary,
              paddingVertical: 12,
              paddingHorizontal: 18,
              borderRadius: radii.md,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Reload</Text>
          </TouchableOpacity>
        </>
      );
    };

    return (
      <PatientTabsLayout activeTab="pharmacy" onTabPress={handleTabPress}>
        {(contentContainerStyle) => (
          <View
            style={[
              { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", padding: spacing.lg },
              contentContainerStyle,
            ]}
          >
            <Stack.Screen options={{ title: "Medication Delivery" }} />
            {body()}
          </View>
        )}
      </PatientTabsLayout>
    );
  }

  const handleSaved = async () => {
    await deliveryQuery.refetch();
    setMode("order");
    showToast("Delivery address saved.");
  };

  const handleOrderSuccess = async () => {
    await deliveryQuery.refetch();
    showToast(successCopy());
  };

  const patient = deliveryQuery.data;
  if (!patient) {
    return (
      <PatientTabsLayout activeTab="pharmacy" onTabPress={handleTabPress}>
        {(contentContainerStyle) => (
          <View
            style={[
              { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", padding: spacing.lg },
              contentContainerStyle,
            ]}
          >
            <Stack.Screen options={{ title: "Medication Delivery" }} />
            <Text style={{ color: colors.gray[700], textAlign: "center" }}>
              Unable to load your delivery information right now.
            </Text>
          </View>
        )}
      </PatientTabsLayout>
    );
  }

  return (
    <PatientTabsLayout activeTab="pharmacy" onTabPress={handleTabPress}>
      {(contentContainerStyle) => (
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <Stack.Screen options={{ title: "Medication Delivery" }} />
          <ScrollView contentContainerStyle={contentContainerStyle}>
            <View
              style={{
                backgroundColor: "#f3f4f6",
                borderRadius: 22,
                padding: spacing.lg,
                borderWidth: 1,
                borderColor: colors.gray[200],
                marginBottom: spacing.md,
              }}
            >
              <Text style={{ fontSize: 22, fontWeight: "700", color: colors.gray[900] }}>
                Medication Delivery
              </Text>
              <Text style={{ color: colors.gray[600], marginTop: spacing.xs }}>{headerSubtitle}</Text>
            </View>

            {mode === "register" ? (
              <AddressForm
                patient={patient}
                onSaved={() => {
                  handleSaved();
                }}
                onError={(message) => showToast(message)}
              />
            ) : (
              <DeliveryOrderScreen
                patient={patient}
                onOrderSuccess={() => {
                  handleOrderSuccess();
                }}
                onEditAddress={() => setMode("register")}
                onError={(message) => showToast(message)}
              />
            )}
          </ScrollView>

          {toast && (
            <View
              style={{
                position: "absolute",
                left: spacing.lg,
                right: spacing.lg,
                bottom: spacing.lg,
                backgroundColor: "rgba(20,20,20,0.92)",
                padding: 14,
                borderRadius: 16,
                shadowColor: "#000",
                shadowOpacity: 0.16,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <Text style={{ color: "#fff", textAlign: "center" }}>{toast.message}</Text>
            </View>
          )}
        </View>
      )}
    </PatientTabsLayout>
  );
};

const AddressForm: React.FC<AddressFormProps> = ({ patient, onSaved, onError }) => {
  const [label, setLabel] = useState(patient.delivery_address_label || "");
  const [address, setAddress] = useState(patient.delivery_address_text || "");
  const [notes, setNotes] = useState(patient.delivery_notes || "");
  const [lat, setLat] = useState(patient.delivery_lat != null ? String(patient.delivery_lat) : "");
  const [lng, setLng] = useState(patient.delivery_lng != null ? String(patient.delivery_lng) : "");
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patientId = patient.patient_id;

  const pinLocation = useCallback(async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        throw new Error("Location permission denied. Please allow access or enter coordinates manually.");
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const newLat = round6(pos.coords.latitude);
      const newLng = round6(pos.coords.longitude);
      setLat(String(newLat));
      setLng(String(newLng));
      setError(null);
    } catch (e: any) {
      const msg =
        e?.message ||
        "Unable to fetch your location. Please try again or enter coordinates manually.";
      setError(msg);
      if (onError) onError(msg);
    } finally {
      setLocating(false);
    }
  }, [onError]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const delivery_address_label = label.trim();
      const delivery_address_text = address.trim();
      const delivery_lat = lat ? Number(lat) : null;
      const delivery_lng = lng ? Number(lng) : null;
      const delivery_notes = notes.trim() || null;

      if (!delivery_address_label || !delivery_address_text) {
        throw new Error("Please fill in your address label and full address.");
      }
      if (delivery_lat === null || delivery_lng === null || Number.isNaN(delivery_lat) || Number.isNaN(delivery_lng)) {
        throw new Error("Please provide valid latitude and longitude.");
      }

      const baseUrl = getApiBaseUrl();
      if (!baseUrl) throw new Error("API base URL not configured");

      const cookieHeader = `role=patient; patient_id=${encodeURIComponent(patientId)}`;
      const res = await fetch(`${baseUrl}/api/mobile/patient/delivery-address`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader,
        },
        credentials: "include",
        body: JSON.stringify({
          delivery_address_label,
          delivery_address_text,
          delivery_lat,
          delivery_lng,
          delivery_notes,
          patientId,
        }),
      });

      const json: { patient?: PatientDeliveryInfo; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || json.error || !json.patient) {
        throw new Error(json.error || "Failed to save delivery address.");
      }

      onSaved(json.patient);
    } catch (e: any) {
      const msg = e?.message || "Unable to save your address. Please try again.";
      setError(msg);
      if (onError) onError(msg);
    } finally {
      setSaving(false);
    }
  }, [address, label, lat, lng, notes, onError, onSaved, patientId]);

  return (
    <View
      style={{
        backgroundColor: "#f9fafb",
        borderRadius: 18,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.gray[200],
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: spacing.sm, color: colors.gray[900] }}>
        Register your delivery address
      </Text>
      <Text style={{ color: colors.gray[600], marginBottom: spacing.lg }}>
        We will use this address for your med deliveries.
      </Text>

      <View style={{ gap: spacing.md }}>
        <View>
          <Text style={{ fontWeight: "700", color: colors.gray[800], marginBottom: spacing.xs }}>
            Address label *
          </Text>
          <TextInput
            placeholder="Home, Office, etc."
            value={label}
            onChangeText={setLabel}
            style={{
              borderWidth: 1,
              borderColor: colors.gray[300],
              borderRadius: radii.md,
              padding: 12,
              backgroundColor: "#fff",
            }}
          />
        </View>

        <View>
          <Text style={{ fontWeight: "700", color: colors.gray[800], marginBottom: spacing.xs }}>
            Full address *
          </Text>
          <TextInput
            multiline
            numberOfLines={3}
            placeholder="Street, Barangay, City / landmarks"
            value={address}
            onChangeText={setAddress}
            textAlignVertical="top"
            style={{
              borderWidth: 1,
              borderColor: colors.gray[300],
              borderRadius: radii.md,
              padding: 12,
              backgroundColor: "#fff",
              minHeight: 96,
            }}
          />
        </View>

        <View style={{ gap: spacing.xs }}>
          <Text style={{ fontWeight: "700", color: colors.gray[800] }}>Latitude / Longitude *</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
            <TextInput
              placeholder="Lat"
              keyboardType="decimal-pad"
              value={lat}
              onChangeText={setLat}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.gray[300],
                borderRadius: radii.md,
                padding: 12,
                backgroundColor: "#fff",
              }}
            />
            <TextInput
              placeholder="Lng"
              keyboardType="decimal-pad"
              value={lng}
              onChangeText={setLng}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.gray[300],
                borderRadius: radii.md,
                padding: 12,
                backgroundColor: "#fff",
              }}
            />
          </View>
          <TouchableOpacity
            onPress={pinLocation}
            disabled={locating}
            style={{
              alignSelf: "flex-start",
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.gray[300],
              backgroundColor: "#fff",
              marginTop: spacing.xs,
              opacity: locating ? 0.9 : 1,
            }}
          >
            <Text style={{ fontWeight: "700", color: colors.gray[800] }}>
              {locating ? "Locating..." : "Pin my location"}
            </Text>
          </TouchableOpacity>
          <Text style={{ color: colors.gray[500], fontSize: 12 }}>
            Use decimal coordinates or pin your current location.
          </Text>
        </View>

        <View>
          <Text style={{ fontWeight: "700", color: colors.gray[800], marginBottom: spacing.xs }}>
            Notes / landmarks (optional)
          </Text>
          <TextInput
            multiline
            numberOfLines={3}
            placeholder="Blue gate, beside sari-sari store"
            value={notes}
            onChangeText={setNotes}
            textAlignVertical="top"
            style={{
              borderWidth: 1,
              borderColor: colors.gray[300],
              borderRadius: radii.md,
              padding: 12,
              backgroundColor: "#fff",
              minHeight: 80,
            }}
          />
        </View>

        {error && <Text style={{ color: "red" }}>{error}</Text>}

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{
            backgroundColor: colors.primary,
            paddingVertical: 14,
            borderRadius: radii.md,
            alignItems: "center",
            opacity: saving ? 0.9 : 1,
          }}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "700" }}>Save address</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const DeliveryOrderScreen: React.FC<DeliveryOrderScreenProps> = ({
  patient,
  onOrderSuccess,
  onEditAddress,
  onError,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOrder = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const baseUrl = getApiBaseUrl();
      if (!baseUrl) throw new Error("API base URL not configured");

      const cookieHeader = `role=patient; patient_id=${encodeURIComponent(patient.patient_id)}`;
      const res = await fetch(`${baseUrl}/api/mobile/patient/delivery-request`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader,
        },
        credentials: "include",
        body: JSON.stringify({ patientId: patient.patient_id }),
      });

      const json: { patient?: PatientDeliveryInfo; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || json.error || !json.patient) {
        throw new Error(json.error || "Unable to submit request.");
      }

      onOrderSuccess(json.patient);
    } catch (e: any) {
      const msg = e?.message || "Unable to submit request.";
      setError(msg);
      if (onError) onError(msg);
    } finally {
      setSubmitting(false);
    }
  }, [onError, onOrderSuccess, patient.patient_id]);

  return (
    <View
      style={{
        backgroundColor: "#f9fafb",
        borderRadius: 18,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.gray[200],
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: spacing.sm, color: colors.gray[900] }}>
        Saved delivery address
      </Text>

      <View style={{ gap: spacing.xs, marginBottom: spacing.lg }}>
        <Text style={{ fontWeight: "700", color: colors.gray[800] }}>
          {patient.delivery_address_label || "No label"}
        </Text>
        <Text style={{ color: colors.gray[700], lineHeight: 20 }}>
          {patient.delivery_address_text || "No address saved."}
        </Text>
        <Text style={{ color: colors.gray[700] }}>
          Notes: {patient.delivery_notes || "None"}
        </Text>
        <Text style={{ color: colors.gray[500], fontSize: 12 }}>
          Lat/Lng: {patient.delivery_lat ?? "-"}, {patient.delivery_lng ?? "-"}
        </Text>
      </View>

      <View style={{ marginBottom: spacing.md }}>
        <Text style={{ color: colors.gray[700] }}>
          Last requested: {formatDate(patient.last_delivery_used_at)}
        </Text>
        <Text style={{ color: colors.gray[700], marginTop: 4 }}>
          Last delivered: {formatDate(patient.last_delivery_success_at)}
        </Text>
      </View>

      {error && <Text style={{ color: "red", marginBottom: spacing.sm }}>{error}</Text>}

      <TouchableOpacity
        onPress={handleOrder}
        disabled={submitting}
        style={{
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: radii.md,
          alignItems: "center",
          opacity: submitting ? 0.9 : 1,
        }}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "700" }}>Order meds for delivery</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onEditAddress}
        style={{
          marginTop: spacing.sm,
          paddingVertical: 12,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.gray[300],
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <Text style={{ fontWeight: "700", color: colors.gray[800] }}>Update address</Text>
      </TouchableOpacity>
    </View>
  );
};

export default DeliveryScreen;
