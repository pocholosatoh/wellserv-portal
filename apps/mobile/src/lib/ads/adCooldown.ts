import * as SecureStore from "expo-secure-store";

export const LAST_REWARDED_AD_TS_KEY = "LAST_REWARDED_AD_TS";
export const AD_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export async function getLastAdTimestamp(): Promise<number | null> {
  try {
    const value = await SecureStore.getItemAsync(LAST_REWARDED_AD_TS_KEY);
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  } catch (error) {
    console.warn("Failed to read ad cooldown timestamp", error);
    return null;
  }
}

export async function setLastAdTimestamp(ts: number): Promise<void> {
  try {
    await SecureStore.setItemAsync(LAST_REWARDED_AD_TS_KEY, String(ts));
  } catch (error) {
    console.warn("Failed to save ad cooldown timestamp", error);
  }
}

export async function hasActiveAdCooldown(now: number = Date.now()): Promise<boolean> {
  const last = await getLastAdTimestamp();
  if (!last) return false;
  return now - last < AD_COOLDOWN_MS;
}
