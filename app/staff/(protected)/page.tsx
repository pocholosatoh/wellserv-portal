import { getSession } from "@/lib/session";
import Link from "next/link";

const CARDS = [
  { href: "/staff/followups", label: "Follow-ups", badge: "Open" },
  { href: "/staff/other-labs", label: "Other Labs/Send-outs", badge: "Uploads" },
  { href: "/staff/patienthistory", label: "Patient History", badge: "Records" },
  { href: "/staff/portal", label: "Portal", badge: "Results" },
  { href: "/staff/prescriptions", label: "Prescriptions", badge: "Rx" },
  { href: "/staff/rmt/hemaupload", label: "RMT Hema Upload", badge: "Hema" },
];

export default async function StaffHome() {
  const s = await getSession();
  if (!s || s.role !== "staff") return null;
  const accent = process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b";

  return (
    <main className="min-h-dvh p-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Staff Hub</h1>
          </div>
          <form action="/api/auth/logout?who=staff" method="post">
            <button className="rounded-lg px-3 py-2 border">Logout</button>
          </form>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map(c => (
            <Link key={c.href} href={c.href} className="rounded-2xl border shadow-sm p-5 hover:shadow-md transition focus:outline-none focus:ring-2 focus:ring-offset-2" style={{ borderTop: `6px solid ${accent}` }}>
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold">{c.label}</h2>
                <span className="text-xs bg-gray-100 rounded-full px-3 py-1">{c.badge}</span>
              </div>
              <div className="mt-4 text-sm text-gray-600">Open</div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
