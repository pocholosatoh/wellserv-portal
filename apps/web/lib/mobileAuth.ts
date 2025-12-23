import { SignJWT, jwtVerify } from "jose";
import { getSession } from "@/lib/session";

type MobileAuthSource = "bearer" | "cookie" | "bearer_invalid" | "none";

type MobilePatientAuth = {
  patient_id: string;
  source: MobileAuthSource;
};

const TOKEN_ISSUER = "wellserv-mobile";
const TOKEN_AUDIENCE = "wellserv-mobile";

function getMobileJwtSecret() {
  const secret =
    process.env.MOBILE_JWT_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("MOBILE_JWT_SECRET missing");
  }
  return new TextEncoder().encode(secret);
}

export async function signMobileToken(patientId: string) {
  const secret = getMobileJwtSecret();
  return new SignJWT({ role: "patient", patient_id: patientId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setSubject(patientId)
    .setExpirationTime("30d")
    .sign(secret);
}

async function getBearerPatient(req: Request): Promise<MobilePatientAuth | null> {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice("bearer ".length).trim();
  if (!token) return { patient_id: "", source: "bearer_invalid" };

  try {
    const secret = getMobileJwtSecret();
    const { payload } = await jwtVerify(token, secret, {
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });
    const patient_id = typeof payload.patient_id === "string" ? payload.patient_id : "";
    if (!patient_id) return { patient_id: "", source: "bearer_invalid" };
    return { patient_id, source: "bearer" };
  } catch {
    return { patient_id: "", source: "bearer_invalid" };
  }
}

export async function getMobilePatient(req: Request): Promise<MobilePatientAuth | null> {
  const bearer = await getBearerPatient(req);
  if (bearer?.patient_id) {
    console.log("[mobile] auth source", bearer.source);
    return bearer;
  }

  const session = await getSession().catch(() => null);
  if (session?.role === "patient" && session.patient_id) {
    const auth = { patient_id: String(session.patient_id), source: "cookie" as const };
    console.log("[mobile] auth source", auth.source);
    return auth;
  }

  if (bearer?.source === "bearer_invalid") {
    console.log("[mobile] auth source", bearer.source);
  } else {
    console.log("[mobile] auth source", "none");
  }
  return null;
}
