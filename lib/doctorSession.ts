// lib/doctorSession.ts
import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "doctor_session";

const raw = process.env.DOCTOR_SESSION_SECRET;
if (!raw) {
  throw new Error("DOCTOR_SESSION_SECRET is not set.");
}
const secret = new TextEncoder().encode(raw);

// 👇 helper so we don't set Secure on localhost
const isProd = process.env.NODE_ENV === "production";

type DocSessionPayload = {
  id: string;
  code: string;
  name: string;
  role: "regular" | "relief";
  credentials?: string;
  display_name?: string;
};

export async function setDoctorSession(payload: DocSessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("3d")
    .sign(secret);

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,              // ✅ only secure in production 
    sameSite: "lax",
    path: "/",                   // ✅ ensure cookie is sent on /doctor pages
    maxAge: 60 * 60 * 24 * 3,
  });
}

export async function getDoctorSession(): Promise<DocSessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as DocSessionPayload;
  } catch {
    return null;
  }
}

export async function clearDoctorSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}
