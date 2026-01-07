"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "staff_branch_local";

type Branch = "SI" | "SL" | "ALL";

export default function BranchPicker({
  role,
  branch,
}: {
  role?: string | null;
  branch?: Branch | string | null;
}) {
  const [current, setCurrent] = useState<Branch>("SI");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? (window.localStorage.getItem(STORAGE_KEY) || "").toUpperCase()
        : "";
    const initial =
      (stored === "SI" || stored === "SL" || stored === "ALL"
        ? (stored as Branch)
        : ((branch || "SI").toUpperCase() as Branch)) || "SI";
    setCurrent(initial);
    setReady(true);
  }, [branch]);

  // Only admins (or people with ALL) should see the picker
  const normalizedRole = (role || "").toLowerCase();
  const normalizedBranch = (branch || "").toString().toUpperCase() as Branch;
  const canPick = normalizedRole === "admin" || normalizedBranch === "ALL";
  if (!ready || !canPick) return null;

  async function setBranchAndReload(next: "SI" | "SL") {
    try {
      await fetch("/api/staff/branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: next }),
      });
    } catch {
      // fallback: keep client state only
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    setCurrent(next);
    setTimeout(() => window.location.reload(), 10);
  }

  const btn =
    "rounded-md border border-gray-300 bg-white px-3 py-1.5 shadow-sm transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white";
  const active =
    "rounded-md border border-accent bg-accent px-3 py-1.5 text-white shadow-sm transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white";

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Branch</span>
      <button
        type="button"
        className={current === "SI" ? active : btn}
        aria-pressed={current === "SI"}
        onClick={() => setBranchAndReload("SI")}
        title="San Isidro"
      >
        SI
      </button>
      <button
        type="button"
        className={current === "SL" ? active : btn}
        aria-pressed={current === "SL"}
        onClick={() => setBranchAndReload("SL")}
        title="San Leonardo"
      >
        SL
      </button>
    </div>
  );
}
