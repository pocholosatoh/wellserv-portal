import { getSession } from "@/lib/session";
import Link from "next/link";

const CARDS: {
  href: string;
  label: string;
  badge: string;
  icon: React.ReactNode;
}[] = [
  {
    href: "/staff/followups",
    label: "Follow-ups",
    badge: "Open",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M5 7h14M5 12h14M5 17h9" />
      </svg>
    ),
  },
  {
    href: "/staff/other-labs",
    label: "Other Labs / Send-outs",
    badge: "Uploads",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 4h16v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" />
        <path d="M8 4v3a4 4 0 0 0 8 0V4" />
      </svg>
    ),
  },
  {
    href: "/staff/patienthistory",
    label: "Patient History",
    badge: "Records",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
        <path d="M9 12h6M9 16h6M9 8h3" />
      </svg>
    ),
  },
  {
    href: "/staff/portal",
    label: "Portal",
    badge: "Results",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 0 0 18M12 3a15 15 0 0 1 0 18" />
      </svg>
    ),
  },
  {
    href: "/staff/prescriptions",
    label: "Prescriptions",
    badge: "Rx",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M7 7h7m-7 4h7M7 15h4" />
        <path d="M17 3h-9a2 2 0 0 0-2 2v14l4-2 4 2 4-2 4 2V5a2 2 0 0 0-2-2h-3Z" />
      </svg>
    ),
  },
  {
    href: "/staff/rmt/hemaupload",
    label: "RMT Hema Upload",
    badge: "Hema",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 3v12" />
        <path d="M8 11l4 4 4-4" />
        <rect x="3" y="17" width="18" height="4" rx="1" />
      </svg>
    ),
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
  const staffBranch =
    s.staff_branch === "ALL" ? "ALL BRANCHES" : (s.staff_branch || "").toUpperCase();

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
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                Staff Hub
              </h1>
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
          {CARDS.map((c) => (
            <ActionCard
              key={c.href}
              href={c.href}
              heading={c.label}
              badge={c.badge}
              accent={accent}
              icon={c.icon}
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
}: {
  href: string;
  heading: string;
  badge: string;
  accent: string;
  icon: React.ReactNode;
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
          Open
        </div>
      </div>
    </Link>
  );
}
