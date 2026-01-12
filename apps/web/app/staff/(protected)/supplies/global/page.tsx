import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import SuppliesGlobalClient from "../SuppliesGlobalClient";

export const dynamic = "force-dynamic";

export default async function StaffGlobalSuppliesPage() {
  const s = await getSession();
  if (!s || s.role !== "staff") {
    redirect("/staff/login");
  }

  const staffRole = String(s.staff_role || "").toLowerCase();
  const staffRolePrefix = String(s.staff_role_prefix || "").toUpperCase();
  const isAdmin = staffRole === "admin" || staffRolePrefix === "ADM";

  if (!isAdmin) {
    redirect("/staff/supplies");
  }

  return (
    <main className="space-y-6">
      <SuppliesGlobalClient />
    </main>
  );
}
