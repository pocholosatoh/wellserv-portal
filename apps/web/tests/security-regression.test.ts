import { beforeEach, describe, expect, it, vi } from "vitest";

// Security regression tests: guard denials, patient scoping, rate limits, and audit DENY metadata.
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/doctorSession", () => ({ getDoctorSession: vi.fn() }));
vi.mock("@/lib/mobileAuth", () => ({ getMobilePatient: vi.fn() }));
vi.mock("@/lib/audit/logAuditEvent", () => ({
  auditActionForRequest: (_pathname: string, method: string) => {
    const verb = method.toUpperCase();
    return verb === "GET" || verb === "HEAD" || verb === "OPTIONS" ? "READ" : "WRITE";
  },
  isPhiRoute: (pathname: string) => pathname.toLowerCase().startsWith("/api/patient-results"),
  logAuditEvent: vi.fn(),
}));

import { GET as healthGet } from "@/app/api/health/route";
import { guard } from "@/lib/auth/guard";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { getDoctorSession } from "@/lib/doctorSession";
import { getMobilePatient } from "@/lib/mobileAuth";
import { getSession } from "@/lib/session";

const mockGetSession = vi.mocked(getSession);
const mockGetDoctorSession = vi.mocked(getDoctorSession);
const mockGetMobilePatient = vi.mocked(getMobilePatient);
const mockLogAuditEvent = vi.mocked(logAuditEvent);

beforeEach(() => {
  mockGetSession.mockReset();
  mockGetDoctorSession.mockReset();
  mockGetMobilePatient.mockReset();
  mockLogAuditEvent.mockReset();
});

describe("security regression", () => {
  it("rejects unauthenticated access to a guarded PHI route", async () => {
    mockGetSession.mockResolvedValue(null);
    mockGetDoctorSession.mockResolvedValue(null);
    mockGetMobilePatient.mockResolvedValue(null);

    const req = new Request("http://localhost/api/patient-results?patient_id=pid-1", {
      method: "GET",
    });
    const result = await guard(req, {
      allow: ["patient", "staff", "doctor"],
      requirePatientId: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("denies patients requesting another patient_id", async () => {
    mockGetMobilePatient.mockResolvedValue({ patient_id: "patient-1", source: "bearer" });
    mockGetDoctorSession.mockResolvedValue(null);
    mockGetSession.mockResolvedValue(null);

    const req = new Request("http://localhost/api/patient-results?patient_id=patient-2", {
      method: "GET",
    });
    const result = await guard(req, {
      allow: ["patient", "staff", "doctor"],
      requirePatientId: true,
      allowMobileToken: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("returns 429 after the health endpoint limit", async () => {
    const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    let lastResponse: Response | null = null;

    for (let i = 0; i < 30; i += 1) {
      lastResponse = await healthGet(
        new Request("http://localhost/api/health", {
          headers: { "x-forwarded-for": ip },
        }),
      );
    }

    expect(lastResponse?.status).toBe(200);

    const blocked = await healthGet(
      new Request("http://localhost/api/health", {
        headers: { "x-forwarded-for": ip },
      }),
    );

    expect(blocked.status).toBe(429);
  });

  it("emits a DENY audit entry when guard rejects PHI access", async () => {
    mockGetMobilePatient.mockResolvedValue({ patient_id: "patient-1", source: "bearer" });
    mockGetDoctorSession.mockResolvedValue(null);
    mockGetSession.mockResolvedValue(null);

    const req = new Request("http://localhost/api/patient-results?patient_id=patient-2", {
      method: "GET",
    });
    const result = await guard(req, {
      allow: ["patient", "staff", "doctor"],
      requirePatientId: true,
      allowMobileToken: true,
    });

    expect(result.ok).toBe(false);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "DENY",
        status_code: 403,
        route: "/api/patient-results",
        meta: expect.objectContaining({ reason: "Forbidden", source: "guard" }),
      }),
    );
  });
});
