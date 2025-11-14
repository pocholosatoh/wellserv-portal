"use client";

import { useEffect, useState } from "react";
import ReportViewer from "@/components/ReportViewer";
import OtherLabsViewer from "@/components/OtherLabsViewer";

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
                // READ route that SIGNS URLs (not /upload) – no patient_id here
                apiPath={`/api/staff/other-labs?expires=3600&v=${Date.now()}`}
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
