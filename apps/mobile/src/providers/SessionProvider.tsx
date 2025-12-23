import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { createSupabaseClient, createSecureStoreAdapter } from "@wellserv/data";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/env";
import Constants from "expo-constants";
import { getApiBaseUrl } from "../lib/api";
import { apiFetch } from "../lib/http";
import { SESSION_STORAGE_KEY, setStoredSessionToken } from "../lib/sessionStorage";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

type SessionValue = {
  patientId: string;
  fullName?: string | null;
  birthday?: string | null;
  sex?: string | null;
  token?: string | null;
};

type SessionContextValue = {
  client: SupabaseClient | null;
  session: SessionValue | null;
  isLoading: boolean;
  pushToken: string | null;
  signIn: (patientId: string, pin: string) => Promise<{ ok: true; patientId: string }>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue>({
  client: null,
  session: null,
  isLoading: true,
  pushToken: null,
  signIn: async () => ({ ok: true, patientId: "" }),
  signOut: async () => {},
});

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
    Promise.resolve(storage.getItem(SESSION_STORAGE_KEY))
      .then((value) => {
        if (value) {
          const parsed = JSON.parse(value);
          setSession(parsed);
          if (parsed?.token) {
            setStoredSessionToken(parsed.token);
          }
        }
      })
      .finally(() => setIsLoading(false));
  }, [storage]);

  useEffect(() => {
    registerPushToken()
      .then((token) => setPushToken(token))
      .catch((err) => console.warn("Push registration failed", err));
  }, []);

  useEffect(() => {
    const baseUrl = getApiBaseUrl();
    console.log(`API_BASE_URL=${baseUrl}`);
  }, []);

  const signIn: SessionContextValue["signIn"] = useCallback(
    async (rawPatientId, pin) => {
      if (!rawPatientId) throw new Error("Enter Patient ID");
      if (!pin) throw new Error("Enter your PIN");
      const baseUrl = getApiBaseUrl();
      if (!baseUrl) throw new Error("API base URL not configured");

      const normalized = rawPatientId.trim().toUpperCase();

      let res: Response;
      try {
        res = await apiFetch("/api/mobile/patient/login", {
          method: "POST",
          body: JSON.stringify({ patient_id: normalized, pin }),
        });
      } catch (error) {
        console.warn("PATIENT LOGIN FAILED", error);
        throw new Error("Could not reach the server. Please try again.");
      }

      let json: any = {};
      try {
        json = await res.json();
      } catch (error) {
        console.warn("PATIENT LOGIN PARSE ERROR", error);
      }
      const token =
        (typeof json?.token === "string" && json.token) ||
        (typeof json?.access_token === "string" && json.access_token) ||
        (typeof json?.accessToken === "string" && json.accessToken) ||
        null;
      if (__DEV__) {
        const hasSetCookie = !!res.headers.get("set-cookie");
        console.log("LOGIN DEBUG: set-cookie", hasSetCookie, "token", !!token);
        console.log("LOGIN DEBUG: token returned", !!token);
      }

      if (json?.code === "PIN_REQUIRED") {
        const err: any = new Error(json?.message || "You must set up a PIN first.");
        err.code = "PIN_REQUIRED";
        err.patientId = normalized;
        throw err;
      }

      if (!res.ok || json?.error) {
        throw new Error(json?.error || json?.message || "Login failed");
      }

      const payload: SessionValue = {
        patientId: json?.patient?.patient_id || normalized,
        fullName: json?.patient?.full_name ?? null,
        birthday: json?.patient?.birthday ?? null,
        sex: json?.patient?.sex ?? null,
        token,
      };

      await storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
      await setStoredSessionToken(token);
      setSession(payload);

      return { ok: true as const, patientId: payload.patientId };
    },
    [storage]
  );

  const signOut = useCallback(async () => {
    console.log("SIGN OUT: clearing session");
    // Best UX: always clear local session, even if server call fails.
    if (session) {
      try {
        getApiBaseUrl();
        await apiFetch("/api/mobile/auth/signout", { method: "POST" });
      } catch (err) {
        console.warn("Failed to clear server session", err);
      }
    } else {
      console.log("SIGN OUT: no session, skipping server call");
    }

    await storage.removeItem(SESSION_STORAGE_KEY);
    await setStoredSessionToken(null);
    setSession(null);
    router.replace("/login");
  }, [storage, router, session]);

  return (
    <SessionContext.Provider value={{ client, session, isLoading, pushToken, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
