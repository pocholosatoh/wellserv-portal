// app/staff/(protected)/layout.tsx
import type { ReactNode } from "next/dist/compiled/react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import StaffNav from "../_components/StaffNavi";
import { getSession } from "@/lib/session";
import BranchPicker from "../_components/BranchPicker";

export const dynamic = "force-dynamic";

export default async function StaffProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Gate: must be staff
  const s = await getSession();
  if (!s || s.role !== "staff") {
    redirect("/staff/login");
  }

  // In Next 15, cookies() is async in RSC
  const c = await cookies();

  const staffRole = c.get("staff_role")?.value || s.staff_role || "";
  const staffBranch = c.get("staff_branch")?.value || s.staff_branch || "";
  const staffInitials = c.get("staff_initials")?.value || s.staff_initials || "";

  // What we show in the nav
  const initials = staffInitials || null;
  const branchLabel =
    staffBranch === "ALL" ? "ALL BRANCHES" : (staffBranch || "").toUpperCase();

  const canSeeReception = staffRole === "reception" || staffRole === "admin";
  const canSeeRmt = staffRole === "rmt" || staffRole === "admin";

  return (
    <div className="min-h-dvh bg-[#f8fafb]">
      {/* Top nav */}
      <StaffNav initials={initials} />

      {/* Role / branch strip */}
      <div className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 text-sm md:flex-row md:flex-wrap md:items-center md:gap-3 md:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded pill-accent px-2 py-1">
              Signed in: <span className="font-medium">{staffInitials || "—"}</span>
            </span>
            <span className="rounded pill-accent px-2 py-1">
              Role: <span className="font-medium capitalize">{staffRole || "—"}</span>
            </span>
            <span className="rounded pill-accent px-2 py-1">
              Branch: <span className="font-medium">{branchLabel || "—"}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:ml-auto">
            <BranchPicker />
            {canSeeReception && (
              <a
                href="/staff/reception"
                className="rounded border px-3 py-1.5 hover:bg-gray-50"
              >
                Reception
              </a>
            )}
            {canSeeRmt && (
              <a
                href="/staff/rmt"
                className="rounded border px-3 py-1.5 hover:bg-gray-50"
              >
                RMT Workboard
              </a>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
    </div>
  );
}
