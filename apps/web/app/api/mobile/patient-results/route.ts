import { NextResponse } from "next/server";
import { buildAllReports } from "@/lib/api/patient-results-core";
import { guard } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Minimal mobile-friendly endpoint that reuses buildAllReports and returns the same shape
// as /api/patient-results. Requires an authenticated patient session.
export async function POST(req: Request) {
  const endpoint = "/api/mobile/patient-results";
  try {
    const logStatus = (status: number) => {
      if (process.env.NODE_ENV !== "production") {
        console.log("[mobile] patient-results", endpoint, status);
      }
    };
    const auth = await guard(req, {
      allow: ["patient"],
      allowMobileToken: true,
      requirePatientId: true,
    });
    if (!auth.ok) {
      logStatus(401);
      return auth.response;
    }
    const actor = auth.actor;
    if (process.env.NODE_ENV !== "production") {
      console.log("[mobile] patient-results", endpoint, { hasActor: !!actor });
    }
    if (actor.kind !== "patient") {
      logStatus(403);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const limit = body?.limit != null ? Number(body.limit) : undefined;
    const visitDateRaw = body?.visitDate || body?.visit_date || body?.date;
    const visitDate = visitDateRaw ? String(visitDateRaw) : undefined;

    const patientId = auth.patientId || actor.patient_id;
    const requestedId = body?.patientId || body?.patient_id || null;
    if (requestedId && String(requestedId).trim() !== String(patientId).trim()) {
      logStatus(403);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pid = String(patientId).trim();

    const json = await buildAllReports(pid, limit, visitDate);
    logStatus(200);
    return NextResponse.json(json, { status: 200 });
  } catch (e: any) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[mobile] patient-results", endpoint, 500);
    }
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
