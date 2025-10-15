import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE = process.env.SESSION_COOKIE_NAME || "wellserv_session";
const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

export type Role = "doctor" | "staff" | "patient";
export type Session = {
  sub: string;           // id (patient_id, staff tag, doctor_id)
  role: Role;
  name?: string | null;
  operator_tag?: string | null; // for staff
  iat?: number;          // jose will set this
};

export async function setSession(payload: Omit<Session,"iat">, days = 7) {
  const token = await new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secret);

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/",
    maxAge: 60 * 60 * 24 * days,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as Session;
  } catch { return null; }
}
