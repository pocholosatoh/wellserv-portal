// app/staff/_components/StaffNavi.tsx (create this once)
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function StaffNavi({
    initials,
  }: {
    initials?: string | null;
  }) {
  const pathname = usePathname();
  const accent = process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b";

  const items = [
    { href: "/staff", label: "Home" },                 // hub
    { href: "/staff/portal", label: "Portal" },
    { href: "/staff/followups", label: "Follow-ups" },
    { href: "/staff/other-labs", label: "Other Labs" },
    { href: "/staff/patienthistory", label: "Patient History" },
    { href: "/staff/prescriptions", label: "Prescriptions" },
    { href: "/staff/rmt/hemaupload", label: "RMT Hema Upload" },
  ];

  return (
    <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b print:hidden">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-2 flex flex-wrap items-center gap-2 text-sm">
        {items.map((it) => {
          const active = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={[
                "group relative rounded-lg border px-3 py-1.5 transition",
                active ? "text-white" : "hover:bg-gray-50",
              ].join(" ")}
              style={{
                backgroundColor: active ? accent : undefined,
                borderColor: active ? accent : undefined,
              }}
            >
              {it.label}
              {/* underline animation on hover (hidden when active) */}
              <span
                className="pointer-events-none absolute left-2 right-2 -bottom-[3px] h-[2px] origin-left scale-x-0 transition-transform duration-200 ease-out group-hover:scale-x-100"
                style={{ backgroundColor: active ? "transparent" : accent }}
              />
            </Link>
          );
        })}

        <span className="ml-auto" />

        {/* who is logged in */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-600">
          <span>Logged in as</span>
          <span
            className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 font-semibold text-gray-800 bg-gray-100 border"
            data-staff-initials={initials || ""} 
            title="Staff initials"
          >
            {initials || "STAFF"}
          </span>
        </div>

        <form action="/api/auth/logout?who=staff" method="post">
          <button className="ml-2 px-3 py-1.5 rounded-lg border hover:bg-gray-50">
            Logout
          </button>
        </form>
      </div>
    </nav>
  );
}