const SEP = ".";

function getCookieSecret(): string {
  const secret =
    process.env.SESSION_COOKIE_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.JWT_SECRET ||
    process.env.MOBILE_JWT_SECRET;
  if (!secret) {
    throw new Error("Missing SESSION_COOKIE_SECRET (or AUTH_SECRET/NEXTAUTH_SECRET/JWT_SECRET)");
  }
  return secret;
}

function base64UrlEncode(bytes: Uint8Array) {
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const b64 = padded + "=".repeat(padLength);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

async function signPayload(payload: string) {
  const secret = getCookieSecret();
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return base64UrlEncode(new Uint8Array(sigBuf));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function readSignedCookie(
  store: { get(name: string): { value: string } | undefined },
  name: string,
): Promise<string | null> {
  const raw = store.get(name)?.value || "";
  const idx = raw.lastIndexOf(SEP);
  if (idx <= 0) return null;
  const payload = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  if (!payload || !sig) return null;
  const expected = await signPayload(payload);
  if (!safeEqual(sig, expected)) return null;
  try {
    return new TextDecoder().decode(base64UrlDecode(payload));
  } catch {
    return null;
  }
}
