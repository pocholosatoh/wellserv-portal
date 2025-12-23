export function getApiBaseUrl() {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";
  if (!baseUrl && __DEV__) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL missing");
  }
  return baseUrl;
}
