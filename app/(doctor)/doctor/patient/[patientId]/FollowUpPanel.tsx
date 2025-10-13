"use client";
import { useEffect, useState } from "react";
import { BRANCHES } from "@/lib/hubs";

type Followup = {
  id: string;
  due_date: string;
  return_branch: string | null;
  intended_outcome: string | null;
  expected_tests: string | null;
  status: "scheduled" | "completed" | "canceled" | "skipped";
  cancel_reason?: string | null;
};

export default function FollowUpPanel({
  patientId,
  consultationId,
  defaultBranch,
}: {
  patientId: string;
  consultationId: string | null;
  defaultBranch?: string | null;
}) {
  const [active, setActive] = useState<Followup | null>(null);
  const [history, setHistory] = useState<Followup[]>([]);
  const [attachChecked, setAttachChecked] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // new follow-up fields
  const [due, setDue] = useState("");
  const [branch, setBranch] = useState(defaultBranch ?? "");
  const [intended, setIntended] = useState("");
  const [tests, setTests] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canSave = consultationId && (attachChecked || due);

  async function load() {
    setErr(null);
    try {
      const res = await fetch(`/api/followups/list?start=1900-01-01&end=2100-01-01`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const all: Followup[] = (json.followups ?? []).filter((f: any) => f.patient_id === patientId);
      const act = all.find((f) => f.status === "scheduled") ?? null;
      const hist = all
        .filter((f) => f.status !== "scheduled")
        .slice(-3)
        .reverse();
      setActive(act);
      setHistory(hist);
    } catch (e: any) {
      setErr(e?.message || "Failed to load follow-ups");
    }
  }

  useEffect(() => { load(); }, [patientId]);

  async function onSave() {
    if (!consultationId) return;
    setBusy(true); setErr(null);
    try {
      // complete current if checkbox ticked
      if (attachChecked && active?.id) {
        const r = await fetch("/api/followups/attach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            followup_id: active.id,
            closed_by_consultation_id: consultationId,
          }),
        });
        const j = await r.json();
        if (j.error) throw new Error(j.error);
      }

      // new follow-up
      if (due) {
        const r = await fetch("/api/followups/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patient_id: patientId,
            created_from_consultation_id: consultationId,
            return_branch: branch || null,
            due_date: due,
            intended_outcome: intended,
            expected_tests: tests,
          }),
        });
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        setDue(""); setIntended(""); setTests("");
      }

      setAttachChecked(false);
      setShowNew(false);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border p-4 shadow-card">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-semibold">Follow-Up</h3>
      </div>

      {/* Active / none */}
      {!active && (
        <div className="text-sm text-gray-600 mb-3">
          No active scheduled follow-up.
        </div>
      )}
      {active && (
        <div className="mb-4 space-y-1 text-sm">
          <div>
            <span className="font-medium">Scheduled:</span> {active.due_date}
            {active.return_branch ? <> · {active.return_branch}</> : null}
          </div>
          {active.intended_outcome && (
            <div><span className="font-medium">Intended:</span> {active.intended_outcome}</div>
          )}
          {active.expected_tests && (
            <div><span className="font-medium">Tests:</span> {active.expected_tests}</div>
          )}
          {active.status === "canceled" && (
            <div className="text-red-600">Canceled ({active.cancel_reason ?? "—"})</div>
          )}
          <label className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              checked={attachChecked}
              onChange={(e) => setAttachChecked(e.target.checked)}
              disabled={!consultationId}
            />
            <span className="text-sm">Mark this consult as the follow-up</span>
          </label>
        </div>
      )}

      {/* Collapsible new follow-up */}
      <button
        type="button"
        onClick={() => setShowNew(!showNew)}
        className="flex items-center gap-1 text-xs text-gray-700 mb-2 select-none"
      >
        <span className="text-lg leading-none">
          {showNew ? "▾" : "▸"}
        </span>
        Make new follow-up below
      </button>

      {showNew && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2 pl-4 border-l border-gray-200">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Return date</label>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Return branch</label>
            <select
              className="w-full border rounded px-2 py-1 text-sm"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option value="">Select…</option>
              {BRANCHES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Intended outcome</label>
            <input
              type="text"
              value={intended}
              onChange={(e) => setIntended(e.target.value)}
              placeholder="e.g., Lower LDL if statin effective"
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Expected tests / bring-backs</label>
            <input
              type="text"
              value={tests}
              onChange={(e) => setTests(e.target.value)}
              placeholder="e.g., FBS + Lipid; bring BP log"
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
        </div>
      )}

      {/* Save button always visible */}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || busy}
          className="rounded bg-[#44969b] text-white px-3 py-2 text-sm disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save Follow-Up Changes"}
        </button>
        {err && <div className="text-sm text-red-600">{err}</div>}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-gray-500 mb-1">Recent history</div>
          <ul className="text-sm space-y-1">
            {history.map((h) => (
              <li key={h.id}>
                {h.due_date} · {h.status}
                {h.intended_outcome ? <> · {h.intended_outcome}</> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
