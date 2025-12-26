export function getApiBaseUrl() {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";
  if (!baseUrl) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL is not configured");
  }
  return baseUrl;
}
