import type { StorageAdapter } from "../types";

type SecureStoreModule = typeof import("expo-secure-store");

let modulePromise: Promise<SecureStoreModule> | null = null;

async function loadModule(): Promise<SecureStoreModule> {
  if (!modulePromise) {
    modulePromise = import("expo-secure-store");
  }
  return modulePromise;
}

export function createSecureStoreAdapter(namespace = "wellserv"): StorageAdapter {
  const prefix = `${namespace}_auth`;

  const sanitize = (value: string) => value.replace(/[^A-Za-z0-9._-]/g, "_");
  const buildKey = (key?: string) => {
    if (!key || !key.trim()) {
      throw new Error("SecureStoreAdapter: key is required");
    }
    const safePrefix = sanitize(prefix);
    const safeKey = sanitize(key.trim());
    return `${safePrefix}_${safeKey}`;
  };

  return {
    async getItem(key) {
      const store = await loadModule();
      const fullKey = buildKey(key);
      return store.getItemAsync(fullKey);
    },
    async setItem(key, value) {
      const store = await loadModule();
      const fullKey = buildKey(key);
      await store.setItemAsync(fullKey, value);
    },
    async removeItem(key) {
      const store = await loadModule();
      const fullKey = buildKey(key);
      await store.deleteItemAsync(fullKey);
    },
  };
}
