"use client";
import { useEffect, useState } from "react";
import { BRANCHES } from "@/lib/hubs";

export default function BranchPicker({
  consultationId,
  initialBranch,
  fallbackBranch,
  onChange,
}: {
  consultationId: string | null;
  initialBranch?: string | null;
  fallbackBranch?: string | null;
  onChange?: (value: string) => void;
}) {
  const codeMap: Record<string, string> = {
    SI: "San Isidro",
    SL: "San Leonardo",
  };

  const normalize = (val?: string | null) => {
    const v = (val || "").trim();
    if (!v) return "";
    const upper = v.toUpperCase();
    if (codeMap[upper]) return codeMap[upper];
    return v;
  };

  const [branch, setBranch] = useState<string>(normalize(initialBranch ?? fallbackBranch));

  async function saveBranch(next: string) {
    const val = normalize(next);
    setBranch(val);
    onChange?.(val);
    if (!consultationId) return;
    await fetch("/api/consultations/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: consultationId, branch: val }),
    });
  }

  // Keep local state in sync when upstream default changes (e.g., from login branch)
  useEffect(() => {
    const normalized = normalize(initialBranch ?? fallbackBranch);
    setBranch(normalized);
  }, [initialBranch, fallbackBranch]);

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-600">Branch:</label>
      <select
        className="border rounded px-2 py-1 text-sm"
        value={branch}
        onChange={(e) => saveBranch(e.target.value)}
        disabled={!consultationId}
      >
        <option value="">Select…</option>
        {BRANCHES.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
    </div>
  );
}
