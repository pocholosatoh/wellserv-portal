import { createSecureStoreAdapter } from "@wellserv/data";

export const SESSION_STORAGE_KEY = "wellserv.session";
export const SESSION_TOKEN_KEY = "wellserv.session.token";

const storage = createSecureStoreAdapter("wellserv");
let cachedToken: string | null | undefined;

export async function getStoredSessionToken() {
  if (cachedToken !== undefined) return cachedToken;
  const value = await storage.getItem(SESSION_TOKEN_KEY);
  cachedToken = value || null;
  return cachedToken;
}

export async function setStoredSessionToken(token: string | null) {
  cachedToken = token;
  if (token) {
    await storage.setItem(SESSION_TOKEN_KEY, token);
  } else {
    await storage.removeItem(SESSION_TOKEN_KEY);
  }
}
