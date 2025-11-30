import { redirect } from "next/navigation";
import RegisterStaffForm from "./RegisterStaffForm";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function StaffRegisterPage() {
  const session = await getSession();
  if (!session || session.role !== "staff") {
    redirect("/staff/login");
  }

  const prefix = (session.staff_role_prefix || "").toUpperCase();
  const staffRole = (session.staff_role || "").toLowerCase();
  const isAdmin = prefix === "ADM" || staffRole === "admin";
  if (!isAdmin) {
    redirect("/staff");
  }

  return (
    <main className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Register Staff</h1>
        <p className="mt-2 text-sm text-gray-600">
          Admin-only. Create staff records with their login code. PIN setup is done separately by the staff member.
        </p>
      </div>
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <RegisterStaffForm />
      </div>
    </main>
  );
}
