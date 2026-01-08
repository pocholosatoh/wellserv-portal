import { getSession } from "@/lib/session";
import Link from "next/link";

const CARDS: {
  href: string;
  label: string;
  badge: string;
  icon: React.ReactNode;
  description?: string;
}[] = [
  {
    href: "/staff/followups",
    label: "Follow-ups",
    badge: "Queue",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M5 6h14" />
        <path d="M5 10h10" />
        <path d="M5 14h7" />
        <path d="m15 18 2 2 4-4" />
      </svg>
    ),
    description: "Manage post-consult follow-ups.",
  },
  {
    href: "/staff/self-monitoring",
    label: "Self-Monitoring",
    badge: "Queue",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 12h3l2-4 3 8 2-4h3" />
      </svg>
    ),
    description: "Patients prescribed for self-logging.",
  },
  {
    href: "/staff/other-labs",
    label: "Other Labs / Send-outs",
    badge: "Uploads",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
        <path d="M9 13h6" />
        <path d="M9 17h6" />
      </svg>
    ),
    description: "Upload and send-out lab results.",
  },
  {
    href: "/staff/patienthistory",
    label: "Patient Vitals + Hx",
    badge: "Vitals",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M5 5h9l3 3v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
        <path d="M9 12h6" />
        <path d="M9 16h4" />
        <path d="M9 8h3" />
        <path d="m16 14 2 2 3-3" />
      </svg>
    ),
    description: "Check recent vitals and history.",
  },
  {
    href: "/staff/portal",
    label: "Portal",
    badge: "Results",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 0 0 18M12 3a15 15 0 0 1 0 18" />
      </svg>
    ),
    description: "Results viewer by patient ID.",
  },
  {
    href: "/staff/prescriptions",
    label: "Prescriptions",
    badge: "Rx",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M7 7h7" />
        <path d="M7 11h6" />
        <path d="M7 15h4" />
        <path d="M17 3h-9a2 2 0 0 0-2 2v14l4-2 4 2 4-2 4 2V5a2 2 0 0 0-2-2h-3Z" />
      </svg>
    ),
    description: "View and print prescriptions.",
  },
  {
    href: "/staff/med-orders",
    label: "Med Orders",
    badge: "Orders",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M8 4h8a2 2 0 0 1 2 2v13l-4-2-4 2-4-2V6a2 2 0 0 1 2-2Z" />
        <path d="M9 9h6" />
        <path d="M9 13h4" />
        <path d="m12 9 2 3-2 3-2-3Z" />
      </svg>
    ),
    description: "Track medication orders and status.",
  },
  {
    href: "/staff/supplies",
    label: "Supplies",
    badge: "Stocks",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M3 7h18" />
        <path d="M5 7v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" />
        <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
        <path d="M9 12h6" />
      </svg>
    ),
    description: "Receive stock and dispense supplies.",
  },
  {
    href: "/staff/medcerts",
    label: "Medical Certs",
    badge: "Certs",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M6 4h10a2 2 0 0 1 2 2v12l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2Z" />
        <path d="M9 9h6" />
        <path d="M9 12h5" />
        <path d="m10 15 2 2 3-3" />
      </svg>
    ),
    description: "Issue and review medical certificates.",
  },
  {
    href: "/staff/rmt/hemaupload",
    label: "RMT Hema Upload",
    badge: "Hema",
    icon: (
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M12 3v12" />
        <path d="M8 11l4 4 4-4" />
        <rect x="3" y="17" width="18" height="4" rx="1" />
      </svg>
    ),
    description: "Upload Hema results for encoding.",
  },
];

function initialsOf(tag?: string) {
  return (tag || "").slice(0, 3).toUpperCase() || "ST";
}

export default async function StaffHome() {
  const s = await getSession();
  if (!s || s.role !== "staff") return null;

  const accent = process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b";
  const staffInitials = s.staff_initials || "";
  const staffRole = (s.staff_role || "").toUpperCase();
  const staffRolePrefix = (s.staff_role_prefix || "").toUpperCase();
  const staffBranch =
    s.staff_branch === "ALL" ? "ALL BRANCHES" : (s.staff_branch || "").toUpperCase();
  const isAdmin = staffRolePrefix === "ADM" || staffRole === "ADMIN";
  const canRegister = staffRolePrefix === "ADM";
  const canManageAssignments = staffRolePrefix === "ADM" || staffRolePrefix === "RMT";

  const cards = [
    ...CARDS,
    ...(canManageAssignments
      ? [
          {
            href: "/staff/section-assignments",
            label: "Section Assignments",
            badge: "Assign",
            icon: (
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="6" cy="6" r="2" />
                <circle cx="18" cy="6" r="2" />
                <circle cx="12" cy="18" r="2" />
                <path d="M7.5 7.5 11 16" />
                <path d="m16.5 7.5-3.5 8.5" />
              </svg>
            ),
            description: "Assign staff per lab section.",
          },
        ]
      : []),
    ...(canRegister
      ? [
          {
            href: "/staff/staff/register",
            label: "Register Staff",
            badge: "Admin",
            icon: (
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="9" cy="8" r="3" />
                <path d="M4 20a5 5 0 0 1 10 0" />
                <path d="M17 9v6" />
                <path d="M14 12h6" />
              </svg>
            ),
            description: "Create new staff login codes.",
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            href: "/staff/audit",
            label: "Audit Log",
            badge: "Admin",
            icon: (
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M12 3 5 6v6c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
                <path d="M9 8h6" />
                <path d="M9 12h6" />
                <path d="M9 16h6" />
              </svg>
            ),
            description: "Review audit metadata (no PHI).",
          },
        ]
      : []),
  ];

  return (
    <main className="min-h-dvh bg-[rgb(248,250,251)]">
      {/* Hero */}
      <section
        className="relative isolate"
        style={{
          background:
            "linear-gradient(135deg, rgba(68,150,155,0.12) 0%, rgba(68,150,155,0.05) 45%, rgba(255,255,255,0.0) 100%)",
        }}
      >
        <div className="mx-auto max-w-5xl px-4 pt-8 pb-6 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div
              className="h-14 w-14 shrink-0 rounded-2xl grid place-items-center text-white text-xl font-semibold shadow-sm"
              style={{ backgroundColor: accent }}
              aria-hidden
            >
              {initialsOf(staffInitials)}
            </div>

            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Staff Hub</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <Pill label={`Role: ${staffRole || "—"}`} />
                <Pill label={`Branch: ${staffBranch || "—"}`} />
                <Pill label={`Signed in: ${staffInitials || "—"}`} />
              </div>
            </div>

            <form
              action="/api/auth/logout?who=staff"
              method="post"
              className="w-full sm:ml-auto sm:w-auto"
            >
              <button
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm transition hover:bg-gray-50 active:scale-[0.99]"
                type="submit"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Cards */}
      <section className="mx-auto max-w-5xl px-6 pb-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <ActionCard
              key={c.href}
              href={c.href}
              heading={c.label}
              badge={c.badge}
              accent={accent}
              icon={c.icon}
              description={c.description}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

/* ---------- UI bits ---------- */

function Pill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 bg-white/70 ring-1 ring-gray-200 shadow-sm text-gray-700">
      {label}
    </span>
  );
}

function ActionCard({
  href,
  heading,
  badge,
  accent,
  icon,
  description,
}: {
  href: string;
  heading: string;
  badge: string;
  accent: string;
  icon: React.ReactNode;
  description?: string;
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white/80 shadow-sm ring-1 ring-black/0 transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2"
    >
      {/* accent stripe */}
      <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="grid h-10 w-10 place-items-center rounded-xl text-white"
              style={{ backgroundColor: accent }}
              aria-hidden
            >
              {icon}
            </span>
            <h2 className="text-base font-semibold text-gray-900">{heading}</h2>
          </div>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-700">
            {badge}
          </span>
        </div>

        <div className="mt-4 text-sm text-gray-600 opacity-90 group-hover:opacity-100">
          {description || "Open"}
        </div>
      </div>
    </Link>
  );
}
