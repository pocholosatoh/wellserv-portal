import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { createSupabaseClient, createSecureStoreAdapter } from "@wellserv/data";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, PATIENT_ACCESS_CODE } from "../lib/env";
import Constants from "expo-constants";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

type SessionValue = {
  patientId: string;
};

type SessionContextValue = {
  client: SupabaseClient | null;
  session: SessionValue | null;
  isLoading: boolean;
  pushToken: string | null;
  signIn: (patientId: string, accessCode: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue>({
  client: null,
  session: null,
  isLoading: true,
  pushToken: null,
  signIn: async () => {},
  signOut: async () => {},
});

const STORAGE_KEY = "wellserv.session";

async function registerPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    return null;
  }
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  return token.data;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const storage = useMemo(() => createSecureStoreAdapter("wellserv"), []);
  const client = useMemo(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    return createSupabaseClient({
      supabaseUrl: SUPABASE_URL,
      supabaseKey: SUPABASE_ANON_KEY,
      storage,
    });
  }, [storage]);

  const [session, setSession] = useState<SessionValue | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    storage
      .getItem(STORAGE_KEY)
      .then((value) => {
        if (value) {
          setSession(JSON.parse(value));
        }
      })
      .finally(() => setIsLoading(false));
  }, [storage]);

  useEffect(() => {
    registerPushToken()
      .then((token) => setPushToken(token))
      .catch((err) => console.warn("Push registration failed", err));
  }, []);

  const signIn = useCallback(
    async (rawPatientId: string, accessCode: string) => {
      if (!client) throw new Error("Supabase not configured");
      if (!rawPatientId) throw new Error("Enter Patient ID");
      if (!accessCode) throw new Error("Enter access code");
      const expected = PATIENT_ACCESS_CODE?.trim();
      if (expected && accessCode.trim() !== expected) {
        throw new Error("Invalid access code");
      }

      const normalized = rawPatientId.trim().toUpperCase();
      const { data, error } = await client
        .from("patients")
        .select("patient_id")
        .ilike("patient_id", normalized)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const { data: visitRow, error: visitError } = await client
          .from("results_wide")
          .select("patient_id")
          .ilike("patient_id", normalized)
          .order("date_of_test", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (visitError) throw visitError;
        if (!visitRow?.patient_id) {
          throw new Error("No matching Patient ID");
        }
        const payload = { patientId: visitRow.patient_id };
        await storage.setItem(STORAGE_KEY, JSON.stringify(payload));
        setSession(payload);
        return;
      }

      const payload = { patientId: data.patient_id ?? normalized };
      await storage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setSession(payload);
    },
    [client, storage]
  );

  const signOut = useCallback(async () => {
    console.log("SIGN OUT: clearing session");
    await storage.removeItem(STORAGE_KEY);
    setSession(null);
    router.replace("/login");
  }, [storage, router]);

  useEffect(() => {
    if (!PATIENT_ACCESS_CODE) {
      Alert.alert("Portal access code missing", "Set EXPO_PUBLIC_PATIENT_ACCESS_CODE in .env.mobile");
    }
  }, []);

  return (
    <SessionContext.Provider value={{ client, session, isLoading, pushToken, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
