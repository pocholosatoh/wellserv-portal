// app/staff/_components/StaffNavi.tsx (create this once)
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function StaffNavi({
  initials,
  rolePrefix,
}: {
  initials?: string | null;
  rolePrefix?: string | null;
}) {
  const pathname = usePathname();
  const accent = process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b";
  const prefix = (rolePrefix || "").toUpperCase();
  const canRegister = prefix === "ADM";
  const canManageAssignments = prefix === "ADM" || prefix === "RMT";

  const items = [
    { href: "/staff", label: "Home" }, // hub
    { href: "/staff/portal", label: "Portal" },
    { href: "/staff/followups", label: "Follow-ups" },
    { href: "/staff/self-monitoring", label: "Self-Monitoring" },
    { href: "/staff/other-labs", label: "Other Labs" },
    { href: "/staff/patienthistory", label: "Patient Vitals and Hx" },
    { href: "/staff/prescriptions", label: "Prescriptions" },
    { href: "/staff/med-orders", label: "Med Orders" },
    { href: "/staff/medcerts", label: "Medical Certs" },
    { href: "/staff/rmt/hemaupload", label: "RMT Hema Upload" },
    ...(canManageAssignments
      ? [{ href: "/staff/section-assignments", label: "Section Assignments" }]
      : []),
    ...(canRegister ? [{ href: "/staff/staff/register", label: "Register Staff" }] : []),
  ];

  return (
    <nav className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur shadow-sm print:hidden">
      <div className="mx-auto max-w-7xl px-4 py-2 text-sm md:px-6">
        <div className="-mx-1 flex gap-2 overflow-x-auto pb-2 px-1 sm:mx-0 sm:flex-wrap sm:pb-0 sm:px-0">
          {items.map((it) => {
            const active = pathname === it.href;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={[
                  "group relative shrink-0 rounded-md border border-gray-200 bg-white/70 px-3 py-1.5 text-gray-800 shadow-sm transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white",
                  active ? "text-white" : "hover:bg-gray-50",
                ].join(" ")}
                style={{
                  backgroundColor: active ? accent : undefined,
                  borderColor: active ? accent : undefined,
                }}
              >
                {it.label}
                <span
                  className="pointer-events-none absolute left-2 right-2 -bottom-[3px] h-[2px] origin-left scale-x-0 transition-transform duration-200 ease-out group-hover:scale-x-100"
                  style={{ backgroundColor: active ? "transparent" : accent }}
                />
              </Link>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0 sm:justify-end">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span>Logged in as</span>
            <span
              className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-gray-200 bg-gray-50 px-2 font-semibold text-gray-800"
              data-staff-initials={initials || ""}
              title="Staff initials"
            >
              {initials || "STAFF"}
            </span>
          </div>

          <form action="/api/auth/logout?who=staff" method="post" className="w-full sm:w-auto">
            <button className="w-full rounded-md border border-gray-300 px-3 py-1.5 shadow-sm transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white">
              Logout
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
