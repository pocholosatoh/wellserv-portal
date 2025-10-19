// app/staff/(protected)/layout.tsx
import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import StaffNav from "../_components/StaffNavi";
import { getSession } from "@/lib/session";
import BranchPicker from "../_components/BranchPicker";


export const dynamic = "force-dynamic";

export default async function StaffProtectedLayout({ children }: { children: ReactNode }) {
  // ✅ keep your existing auth gate (expects session.role === "staff")
  const s = await getSession();
  if (!s || s.role !== "staff") {
    redirect("/staff/login");
  }

  // Initials you already show in StaffNavi
  const initials =
    (typeof s.name === "string" && s.name.trim().slice(0, 6).toUpperCase()) ||
    (typeof s.sub === "string" && s.sub.slice(0, 6)) ||
    null;

  // 🔎 In Next 15+, cookies() can be async in RSC — await it
  const c = await cookies(); // <-- important
  const staffRole = c.get("staff_role")?.value || "";          // "reception" | "rmt" | "admin"
  const staffBranch = c.get("staff_branch")?.value || "";      // "SI" | "SL" | "ALL"
  const staffInitials = c.get("staff_initials")?.value || "";  // e.g., "CHL"

  const branchLabel = staffBranch === "ALL" ? "ALL BRANCHES" : (staffBranch || "").toUpperCase();
  const canSeeReception = staffRole === "reception" || staffRole === "admin";
  const canSeeRmt = staffRole === "rmt" || staffRole === "admin";

  return (
    <div className="min-h-dvh bg-[#f8fafb]">
      {/* Your existing top nav */}
      <StaffNav initials={initials} />

      {/* 🧭 role-gated sub-nav */}
      <div className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-2 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded pill-accent px-2 py-1">
            Signed in: <span className="font-medium">{staffInitials || "—"}</span>
          </span>
          <span className="rounded pill-accent px-2 py-1">
            Role: <span className="font-medium capitalize">{staffRole || "—"}</span>
          </span>
          <span className="rounded pill-accent px-2 py-1">
            Branch: <span className="font-medium">{branchLabel || "—"}</span>
          </span>

          <div className="ml-auto flex items-center gap-3">
            <BranchPicker />
            {canSeeReception && (
              <a href="/staff/reception" className="rounded px-3 py-1.5 border hover:bg-gray-50">
                Reception
              </a>
            )}
            {canSeeRmt && (
              <a href="/staff/rmt" className="rounded px-3 py-1.5 border hover:bg-gray-50">
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
