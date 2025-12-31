import { redirect } from "next/navigation";
import SectionAssignmentsClient from "./SectionAssignmentsClient";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SectionAssignmentsPage() {
  const session = await getSession();
  if (!session || session.role !== "staff") {
    redirect("/staff/login");
  }

  const prefix = (session.staff_role_prefix || "").toUpperCase();
  const staffRole = (session.staff_role || "").toLowerCase();
  const branch = (session.staff_branch || "").toUpperCase();
  const isAdmin = prefix === "ADM" || staffRole === "admin";
  const isRmt = prefix === "RMT" || staffRole === "rmt";

  if (!isAdmin && !isRmt) {
    redirect("/staff");
  }

  return (
    <main className="space-y-6">
      <SectionAssignmentsClient role={isAdmin ? "admin" : "rmt"} initialHub={branch || undefined} />
    </main>
  );
}
