// app/staff/(protected)/layout.tsx
import { ReactNode } from "react";
import StaffNav from "../_components/StaffNavi";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StaffProtectedLayout({ children }: { children: ReactNode }) {
  const s = await getSession();
  if (!s || s.role !== "staff") {
    redirect("/staff/login");
  }

  const initials =
    (typeof s.name === "string" && s.name.trim().slice(0, 6).toUpperCase()) ||
    (typeof s.sub === "string" && s.sub.slice(0, 6)) ||
    null;

  return (
    <div className="min-h-dvh bg-[#f8fafb]">
      <StaffNav initials={initials} />
      <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
    </div>
  );
}
