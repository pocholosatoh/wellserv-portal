// app/(doctor)/doctor/patient/[patientId]/OtherLabsCard.tsx
"use client";
import { useState, type PropsWithChildren } from "react";

export default function OtherLabsCard({
  children,
  showHeader = true,         // NEW: let the parent decide to hide duplicate title
}: PropsWithChildren<{ showHeader?: boolean }>) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl border border-gray-300 shadow-sm">
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <h3 className="font-semibold text-gray-800">Other Labs</h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="rounded-full border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>
      )}

      {/* When header is hidden, keep a small top padding so content doesn't stick to the border */}
      {open && <div className={showHeader ? "px-4 pb-4" : "px-4 pt-4 pb-4"}>{children}</div>}
    </div>
  );
}
