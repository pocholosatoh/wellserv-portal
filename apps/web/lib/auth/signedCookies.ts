import { createHmac, timingSafeEqual } from "crypto";

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

function base64UrlEncode(buf: Buffer | Uint8Array) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(padLength), "base64");
}

function signPayload(payload: string) {
  const secret = getCookieSecret();
  const sig = createHmac("sha256", secret).update(payload).digest();
  return base64UrlEncode(sig);
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function encodeSignedValue(value: string) {
  const payload = base64UrlEncode(Buffer.from(value, "utf8"));
  const sig = signPayload(payload);
  return `${payload}${SEP}${sig}`;
}

export function decodeSignedValue(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const idx = raw.lastIndexOf(SEP);
  if (idx <= 0) return null;
  const payload = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  if (!payload || !sig) return null;
  const expected = signPayload(payload);
  if (!safeEqual(sig, expected)) return null;
  try {
    return base64UrlDecode(payload).toString("utf8");
  } catch {
    return null;
  }
}

type CookieStore = {
  get(name: string): { value: string } | undefined;
};

export function readSignedCookie(store: CookieStore, name: string): string | null {
  const raw = store.get(name)?.value || "";
  const decoded = decodeSignedValue(raw);
  return decoded ?? null;
}

export function setSignedCookie(
  res: { cookies: { set: (opts: any) => void } },
  name: string,
  value: string,
  opts: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none";
    path?: string;
    maxAge?: number;
  },
) {
  res.cookies.set({
    name,
    value: encodeSignedValue(value),
    httpOnly: opts.httpOnly ?? true,
    secure: opts.secure ?? false,
    sameSite: opts.sameSite ?? "lax",
    path: opts.path ?? "/",
    maxAge: opts.maxAge,
  });
}

export function clearSignedCookie(
  res: { cookies: { set: (opts: any) => void } },
  name: string,
  opts: { httpOnly?: boolean; secure?: boolean; sameSite?: "lax" | "strict" | "none"; path?: string },
) {
  res.cookies.set({
    name,
    value: "",
    httpOnly: opts.httpOnly ?? true,
    secure: opts.secure ?? false,
    sameSite: opts.sameSite ?? "lax",
    path: opts.path ?? "/",
    maxAge: 0,
  });
}
