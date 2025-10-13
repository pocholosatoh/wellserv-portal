"use client";
import { useState } from "react";
import { BRANCHES } from "@/lib/hubs";

export default function BranchPicker({
  consultationId,
  initialBranch,
}: {
  consultationId: string | null;
  initialBranch?: string | null;
}) {
  const [branch, setBranch] = useState<string>(initialBranch ?? "");

  async function saveBranch(next: string) {
    setBranch(next);
    if (!consultationId) return;
    await fetch("/api/consultations/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: consultationId, branch: next }),
    });
  }

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
