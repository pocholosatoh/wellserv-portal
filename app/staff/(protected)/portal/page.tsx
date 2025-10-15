"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ReportViewer from "@/components/ReportViewer";
import OtherLabsViewer from "@/components/OtherLabsViewer";
import StaffNavi from "@/app/staff/_components/StaffNavi";

function findSearchInput(): HTMLInputElement | null {
  return (
    document.querySelector<HTMLInputElement>('input[placeholder="Enter Patient ID"]') ||
    document.querySelector<HTMLInputElement>('input[name="patient_id"]') ||
    null
  );
}
function findViewButtonNear(el: HTMLElement | null): HTMLButtonElement | HTMLInputElement | null {
  if (!el) return null;
  const container = el.closest("form, div, section") || el.parentElement || el;
  const btns = container.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
    'button, input[type="button"], input[type="submit"]'
  );
  for (const b of Array.from(btns)) {
    const label =
      (b as HTMLButtonElement).innerText?.trim() ||
      (b as HTMLInputElement).value?.trim() ||
      "";
    if (label.toLowerCase() === "view") return b;
  }
  return Array.from(btns)[0] || null;
}

const norm = (s: string) => s.trim().toUpperCase();

function StaffNav() {
  const pathname = usePathname();
  const items = [
    { href: "/staff/portal", label: "Portal" },
    { href: "/staff/followups", label: "Follow-ups" },
    { href: "/staff/other-labs", label: "Other Labs" },
    { href: "/staff/patienthistory", label: "Patient History" },
    { href: "/staff/prescriptions", label: "Prescriptions" },
    { href: "/staff/rmt/hemaupload", label: "RMT Hema Upload" },
  ];

  const accent = process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b";

  return (
    <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b">
      <div className="px-4 md:px-6 py-2 flex flex-wrap items-center gap-2 text-sm">
        {items.map((it) => {
          const active = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={[
                "relative rounded-lg border px-3 py-1.5 transition",
                active
                  ? "text-white"
                  : "hover:bg-gray-50",
              ].join(" ")}
              style={{
                backgroundColor: active ? accent : undefined,
                borderColor: active ? accent : undefined,
              }}
            >
              {it.label}
              {/* animated underline on hover & active */}
              <span
                className="pointer-events-none absolute left-2 right-2 -bottom-[3px] h-[2px] origin-left scale-x-0 transition-transform group-hover:scale-x-100"
                style={{
                  backgroundColor: active ? "#0000" : accent,
                }}
              />
            </Link>
          );
        })}

        <span className="ml-auto" />
        <form action="/api/auth/logout?who=staff" method="post">
          <button className="px-3 py-1.5 rounded-lg border hover:bg-gray-50">Logout</button>
        </form>
      </div>
    </nav>
  );
}

export default function StaffPortalPage() {
  const [activePid, setActivePid] = useState<string>("");
  const [showOtherLabs, setShowOtherLabs] = useState<boolean>(false);

  // Mirror ReportViewer's search box so we can show the side "Other Labs" for that patient
  useEffect(() => {
    const input = findSearchInput();
    if (!input) return;

    const viewBtn = findViewButtonNear(input);

    const apply = () => {
      const submitted = norm(input.value || "");
      if (submitted) {
        setActivePid(submitted);
        setShowOtherLabs(true);
      } else {
        setShowOtherLabs(false);
      }
    };

    const onClick = () => setTimeout(apply, 0);
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Enter") setTimeout(apply, 0); };
    const onInput = () => { if (!norm(input.value)) setShowOtherLabs(false); };

    input.addEventListener("keydown", onKeyDown);
    input.addEventListener("input", onInput);
    viewBtn?.addEventListener("click", onClick, { capture: true });

    return () => {
      input.removeEventListener("keydown", onKeyDown);
      input.removeEventListener("input", onInput);
      viewBtn?.removeEventListener("click", onClick, { capture: true } as any);
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Left: ReportViewer (point to STAFF endpoint) */}
        <section className="lg:col-span-2 rounded-xl border bg-white/95 shadow-sm overflow-hidden">
          <div className="p-4">
            <ReportViewer apiPath="/api/staff/patient-results" />
          </div>
        </section>

        {/* Right: Other Labs (staff endpoint, explicit patientId) */}
        <aside className="lg:col-span-1 space-y-4 print-hide">
          {showOtherLabs && activePid ? (
            <section className="rounded-xl border bg-white/95 shadow-sm overflow-hidden">
              <header className="px-4 py-3 border-b">
                <h2 className="font-medium text-gray-800">Other Labs</h2>
              </header>
              <div className="p-4">
                <OtherLabsViewer
                  patientId={activePid}
                  useSession={false}
                  apiPath="/api/staff/other-labs/upload"
                  showIfEmpty
                  emptyText="No other labs available."
                />
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
