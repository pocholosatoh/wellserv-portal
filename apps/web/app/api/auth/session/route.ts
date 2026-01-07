import { NextResponse } from "next/server";
import { guard } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await guard(req, { allow: ["patient", "staff", "doctor"] });
  if (!auth.ok) return auth.response;

  const { actor } = auth;
  if (actor.kind === "staff") {
    return NextResponse.json({
      actor: {
        kind: "staff",
        role: actor.role,
        role_prefix: actor.role_prefix,
        branch: actor.branch,
        initials: actor.initials,
        is_admin: actor.is_admin,
      },
    });
  }
  if (actor.kind === "doctor") {
    return NextResponse.json({
      actor: {
        kind: "doctor",
        branch: actor.branch,
        display_name: actor.display_name || actor.name || null,
      },
    });
  }
  return NextResponse.json({ actor: { kind: "patient" } });
}
