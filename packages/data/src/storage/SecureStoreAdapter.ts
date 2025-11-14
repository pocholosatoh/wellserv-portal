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
  const prefix = `${namespace}:auth`;

  return {
    async getItem(key) {
      const store = await loadModule();
      return store.getItemAsync(`${prefix}:${key}`);
    },
    async setItem(key, value) {
      const store = await loadModule();
      await store.setItemAsync(`${prefix}:${key}`, value);
    },
    async removeItem(key) {
      const store = await loadModule();
      await store.deleteItemAsync(`${prefix}:${key}`);
    },
  };
}
