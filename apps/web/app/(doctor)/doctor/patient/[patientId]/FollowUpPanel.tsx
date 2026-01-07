"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BRANCHES } from "@/lib/hubs";
import LabTestQuickSearch from "./LabTestQuickSearch";

type Followup = {
  id: string;
  due_date: string;
  return_branch: string | null;
  intended_outcome: string | null;
  expected_tests: string | null;
  status: "scheduled" | "completed" | "canceled" | "skipped";
  cancel_reason?: string | null;
};

function parseExpectedTokens(raw?: string | null) {
  return (raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isUuid(v?: string | null) {
  return (
    !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function getDoctorId(explicitId?: string | null) {
  if (explicitId && isUuid(explicitId)) return explicitId;
  return null;
}

export default function FollowUpPanel({
  patientId,
  consultationId,
  defaultBranch,
  doctorId,
}: {
  patientId: string;
  consultationId: string | null;
  defaultBranch?: string | null;
  doctorId?: string | null;
}) {
  const sp = useSearchParams();
  const urlCid = useMemo(() => {
    const c = sp.get("c");
    return c && c.trim() ? c.trim() : null;
  }, [sp]);
  const [resolvedConsultationId, setResolvedConsultationId] = useState<string | null>(
    urlCid || consultationId || null,
  );
  const [active, setActive] = useState<Followup | null>(null);
  const [history, setHistory] = useState<Followup[]>([]);
  const [attachChecked, setAttachChecked] = useState(false);
  const [formMode, setFormMode] = useState<"new" | "edit" | null>(null);

  // new follow-up fields
  const [due, setDue] = useState("");
  const [branch, setBranch] = useState(defaultBranch ?? "");
  const [intended, setIntended] = useState("");
  const [tests, setTests] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isEditing = formMode === "edit";
  const isCreating = formMode === "new";
  const formOpen = formMode !== null;
  const isLocked = !resolvedConsultationId;
  const canSave =
    resolvedConsultationId && (attachChecked || (isCreating && due) || (isEditing && due));
  const activeExpectedTokens = useMemo(
    () => parseExpectedTokens(active?.expected_tests),
    [active?.expected_tests],
  );

  async function load() {
    setErr(null);
    try {
      const res = await fetch(
        `/api/followups/list?start=1900-01-01&end=2100-01-01&patient_id=${encodeURIComponent(patientId)}`,
      );
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

  useEffect(() => {
    setResolvedConsultationId(urlCid || consultationId || null);
  }, [urlCid, consultationId]);

  useEffect(() => {
    load();
  }, [patientId]);
  useEffect(() => {
    resetForm();
    setAttachChecked(false);
  }, [patientId, defaultBranch]);

  function resetForm() {
    setFormMode(null);
    setDue("");
    setIntended("");
    setTests("");
    setBranch(defaultBranch ?? "");
  }

  function startNew() {
    setFormMode((prev) => {
      if (prev === "new") return null;
      setDue("");
      setIntended("");
      setTests("");
      setBranch(defaultBranch ?? "");
      return "new";
    });
  }

  function startEdit() {
    if (!active) return;
    setFormMode("edit");
    setDue(active.due_date || "");
    setBranch(active.return_branch ?? "");
    setIntended(active.intended_outcome ?? "");
    setTests(active.expected_tests ?? "");
  }

  async function onSave() {
    if (!resolvedConsultationId) return;
    const actorId = getDoctorId(doctorId);
    setBusy(true);
    setErr(null);
    try {
      if (isEditing && active?.id) {
        const payload: Record<string, any> = {
          followup_id: active.id,
          patient_id: patientId,
          due_date: due,
          return_branch: branch || null,
          intended_outcome: intended,
          expected_tests: tests,
        };
        if (actorId) payload.updated_by = actorId;
        const r = await fetch("/api/followups/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = await r.json();
        if (j.error) throw new Error(j.error);
      }

      // complete current if checkbox ticked
      if (attachChecked && active?.id) {
        const payload: Record<string, any> = {
          followup_id: active.id,
          closed_by_consultation_id: resolvedConsultationId,
        };
        if (actorId) payload.updated_by = actorId;
        const r = await fetch("/api/followups/attach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = await r.json();
        if (j.error) throw new Error(j.error);
      }

      // new follow-up
      if (isCreating && due) {
        const payload: Record<string, any> = {
          patient_id: patientId,
          created_from_consultation_id: resolvedConsultationId,
          return_branch: branch || null,
          due_date: due,
          intended_outcome: intended,
          expected_tests: tests,
        };
        if (actorId) payload.created_by = actorId;
        const r = await fetch("/api/followups/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        setDue("");
        setIntended("");
        setTests("");
      }

      setAttachChecked(false);
      resetForm();
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
        <h3 className="font-semibold">Follow-Ups</h3>
      </div>

      <fieldset disabled={isLocked} className={isLocked ? "opacity-60" : ""}>
        {/* Active / none */}
        {!active && (
          <div className="text-sm text-gray-600 mb-3">No active scheduled follow-up.</div>
        )}
        {active && (
          <div className="mb-4 space-y-1 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-medium">Scheduled:</span> {active.due_date}
                {active.return_branch ? <> · {active.return_branch}</> : null}
              </div>
              <button
                type="button"
                className="rounded border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-50"
                onClick={startEdit}
                disabled={busy}
              >
                {isEditing ? "Editing…" : "Edit"}
              </button>
            </div>
            {active.intended_outcome && (
              <div>
                <span className="font-medium">Intended:</span> {active.intended_outcome}
              </div>
            )}
            {activeExpectedTokens.length > 0 && (
              <div>
                <span className="font-medium">Tests:</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {activeExpectedTokens.map((tok) => (
                    <span
                      key={tok}
                      className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-mono"
                    >
                      {tok}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {active.status === "canceled" && (
              <div className="text-red-600">Canceled ({active.cancel_reason ?? "—"})</div>
            )}
            <label className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={attachChecked}
                onChange={(e) => setAttachChecked(e.target.checked)}
                disabled={!resolvedConsultationId}
              />
              <span className="text-sm">Mark this consult as the follow-up</span>
            </label>
          </div>
        )}

        {/* Collapsible new follow-up */}
        <button
          type="button"
          onClick={startNew}
          className="group mb-3 inline-flex items-center gap-2 rounded-full border border-[#44969b]/60 bg-[#44969b]/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#2e6468] select-none"
          aria-expanded={isCreating}
          aria-controls="doctor-followup-form"
          disabled={isEditing}
        >
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#2e6468] shadow-sm transition-transform duration-200"
            style={{ transform: isCreating ? "rotate(90deg)" : "rotate(0deg)" }}
            aria-hidden
          >
            ▸
          </span>
          {isCreating ? "Hide follow-up form" : "Make new follow-up"}
        </button>

        {formOpen && (
          <div
            id="doctor-followup-form"
            className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2 pl-4 border-l border-gray-200"
          >
            <div className="md:col-span-2 text-xs text-gray-500 -mb-1">
              {isEditing
                ? "Editing current scheduled follow-up"
                : "Create a new scheduled follow-up"}
            </div>
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
                  <option key={b} value={b}>
                    {b}
                  </option>
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
              <LabTestQuickSearch value={tests} onChange={setTests} />
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
            {busy ? "Saving…" : isEditing ? "Save Edits" : "Save Follow-Up Changes"}
          </button>
          {formOpen && (
            <button
              type="button"
              onClick={resetForm}
              disabled={busy}
              className="text-sm text-gray-600 underline"
            >
              Cancel
            </button>
          )}
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
      </fieldset>
    </div>
  );
}
