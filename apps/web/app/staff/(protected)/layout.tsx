// app/staff/(protected)/layout.tsx
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import StaffNav from "../_components/StaffNavi";
import { getSession } from "@/lib/session";
import BranchPicker from "../_components/BranchPicker";
import SectionAssignmentReminder from "../_components/SectionAssignmentReminder";
import { readSignedCookie } from "@/lib/auth/signedCookies";

export const dynamic = "force-dynamic";

export default async function StaffProtectedLayout({ children }: { children: ReactNode }) {
  const s = await getSession();
  if (!s || s.role !== "staff") {
    redirect("/staff/login");
  }

  const c = await cookies();

  const staffRole = readSignedCookie(c, "staff_role") || s.staff_role || "";
  const staffBranch = readSignedCookie(c, "staff_branch") || s.staff_branch || "";
  const staffInitials = readSignedCookie(c, "staff_initials") || s.staff_initials || "";
  const staffRolePrefix = readSignedCookie(c, "staff_role_prefix") || s.staff_role_prefix || "";

  const initials = staffInitials || null;
  const branchLabel = staffBranch === "ALL" ? "ALL BRANCHES" : (staffBranch || "").toUpperCase();

  const canSeeReception = staffRole === "reception" || staffRole === "admin";
  const canSeeRmt = staffRole === "rmt" || staffRole === "admin";

  return (
    <div className="staff-shell min-h-dvh bg-[#f8fafb]">
      <StaffNav
        initials={initials}
        rolePrefix={staffRolePrefix || null}
        role={staffRole || null}
      />
      <SectionAssignmentReminder rolePrefix={staffRolePrefix || null} />
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur">
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
            <BranchPicker role={staffRole} branch={staffBranch as any} />
            {canSeeReception && (
              <a
                href="/staff/reception"
                className="rounded-md border border-gray-300 px-3 py-1.5 shadow-sm transition hover:bg-gray-50"
              >
                Reception
              </a>
            )}
            {canSeeRmt && (
              <a
                href="/staff/rmt"
                className="rounded-md border border-gray-300 px-3 py-1.5 shadow-sm transition hover:bg-gray-50"
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
