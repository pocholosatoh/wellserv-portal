import { NextResponse } from "next/server";
import { guard } from "@/lib/auth/guard";

export async function GET(req: Request) {
  const auth = await guard(req, { allow: ["staff", "doctor", "patient"], requireBranch: false });
  if (!auth.ok) return auth.response;

  const actor = auth.actor;
  const actorType = actor.kind;
  const actorId = actor.kind === "patient" ? actor.patient_id : actor.id;

  const branch =
    actor.kind === "doctor"
      ? actor.branch
      : actor.kind === "staff"
        ? actor.branch || null
        : null;

  return NextResponse.json({
    ok: true,
    actorType,
    actorId,
    branch,
    hub: branch,
  });
}
