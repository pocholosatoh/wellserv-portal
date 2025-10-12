"use client";
import { useEffect, useState } from "react";
import ReportViewer from "@/components/ReportViewer";
import OtherLabsViewer from "@/components/OtherLabsViewer";

/** Find ReportViewer’s search controls. Adjust selectors if you later change the UI. */
function findSearchInput(): HTMLInputElement | null {
  return (
    document.querySelector<HTMLInputElement>('input[placeholder="Enter Patient ID"]') ||
    document.querySelector<HTMLInputElement>('input[name="patient_id"]') ||
    null
  );
}
function findViewButtonNear(el: HTMLElement | null): HTMLButtonElement | HTMLInputElement | null {
  if (!el) return null;
  // 1) Sibling/parent area
  const container = el.closest("form, div, section") || el.parentElement || el;
  // 2) Buttons that look like “View”
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
  // 3) Fallback: any button next to input
  return Array.from(btns)[0] || null;
}

const norm = (s: string) => s.trim(); // or s.trim().toUpperCase()

export default function StaffPortalPage() {
  const [activePid, setActivePid] = useState<string>("");
  const [showOtherLabs, setShowOtherLabs] = useState<boolean>(false);

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

    // Trigger when clicking the View button
    const onClick = (e: Event) => {
      // don’t interfere with ReportViewer — just read the value
      setTimeout(apply, 0); // let any internal handlers run first
    };
    // Trigger when pressing Enter in the input
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        setTimeout(apply, 0);
      }
    };
    // If user clears the input afterwards, hide the pane
    const onInput = () => {
      if (!norm(input.value)) setShowOtherLabs(false);
    };

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
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Left: ReportViewer (your main search + results) */}
        <div className="lg:col-span-2 space-y-4">
          <section className="rounded-xl border bg-white/95 shadow-sm overflow-hidden">
            <div className="p-4">
              <ReportViewer apiPath="/api/patient-results" />
            </div>
          </section>
        </div>

        {/* Right: appears only after clicking View (or pressing Enter) with a non-empty ID */}
        <div className="lg:col-span-1 space-y-4">
          {showOtherLabs && activePid ? (
            <section className="rounded-xl border bg-white/95 shadow-sm overflow-hidden">
              <header className="px-4 py-3 border-b">
                <h2 className="font-medium text-gray-800">Other Labs</h2>
              </header>
              <div className="p-4">
                <OtherLabsViewer patientId={activePid} showIfEmpty={true}
                  emptyText="No other labs available."/>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
