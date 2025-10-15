"use client";

import { useEffect, useMemo, useState } from "react";
import { BRANCHES } from "@/lib/hubs";
import { phTodayYMD, addDaysYMD, isDueTodayYMD, isOverdueYMD, isPastGraceYMD } from "@/lib/time";

type Followup = {
  id: string;
  patient_id: string;
  created_from_consultation_id: string;
  closed_by_consultation_id: string | null;
  return_branch: string | null;
  due_date: string;
  tolerance_days: number;
  valid_until: string;
  intended_outcome: string | null;
  expected_tests: string | null;
  status: "scheduled" | "completed" | "canceled" | "skipped";
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
};

type Attempt = {
  id: string;
  attempted_at: string;
  channel: string;
  outcome: string;
  notes: string | null;
  attempted_by_name: string | null;
};

const STATUS_FILTERS = ["all", "scheduled", "completed", "canceled", "skipped"] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

export default function StaffFollowupsPage() {
  // Filters
  const today = phTodayYMD();
  const [start, setStart] = useState<string>(addDaysYMD(today, -7));
  const [end, setEnd] = useState<string>(addDaysYMD(today, +7));
  const [hub, setHub] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [onlyDueToday, setOnlyDueToday] = useState(false);
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  // Data & UI
  const [rows, setRows] = useState<Followup[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Attempts state
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [attemptsById, setAttemptsById] = useState<Record<string, Attempt[]>>({});
  const [loadingAttempts, setLoadingAttempts] = useState<Record<string, boolean>>({});
  const [attemptErr, setAttemptErr] = useState<Record<string, string | null>>({});

  async function load() {
    setErr(null);
    setBusy(true);
    try {
      const url = new URL("/api/followups/list", window.location.origin);
      url.searchParams.set("start", start);
      url.searchParams.set("end", end);
      if (hub) url.searchParams.set("branch", hub);
      if (statusFilter !== "all") url.searchParams.set("status", statusFilter);

      const res = await fetch(url.toString(), { cache: "no-store" });
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      setRows(j.followups ?? []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load follow-ups");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { load(); }, [start, end, hub, statusFilter]);

  // Client-side chips for Due Today / Overdue
  const filtered = useMemo(() => {
    return rows.filter((f) => {
      if (onlyDueToday && !isDueTodayYMD(f.due_date, today)) return false;
      if (onlyOverdue && !isOverdueYMD(f.due_date, today)) return false;
      return true;
    });
  }, [rows, onlyDueToday, onlyOverdue, today]);

  async function fetchAttempts(fid: string) {
    setAttemptErr((m) => ({ ...m, [fid]: null }));
    setLoadingAttempts((m) => ({ ...m, [fid]: true }));
    try {
      const u = new URL("/api/followups/attempts/list", window.location.origin);
      u.searchParams.set("followup_id", fid);
      const r = await fetch(u.toString(), { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j?.error || `HTTP ${r.status}`);
      setAttemptsById((m) => ({ ...m, [fid]: (j.attempts as Attempt[]) || [] }));
    } catch (e: any) {
      setAttemptErr((m) => ({ ...m, [fid]: e?.message || "Failed to load attempts" }));
    } finally {
      setLoadingAttempts((m) => ({ ...m, [fid]: false }));
    }
  }

  function toggle(fid: string) {
    setOpen((prev) => {
      const s = new Set(prev);
      if (s.has(fid)) s.delete(fid);
      else {
        s.add(fid);
        if (!attemptsById[fid]) void fetchAttempts(fid);
      }
      return s;
    });
  }

  const headerInitials =
    (document.querySelector("[data-staff-initials]") as HTMLElement)?.getAttribute("data-staff-initials") || "";
  const lastUsed = localStorage.getItem("followups:lastAttemptName") || "";
  const defaultName = headerInitials || lastUsed;

  /** ACTIONS **/
  async function logAttempt(f: Followup) {
    const channel = prompt("Channel (call/sms/messenger/email/other):", "call")?.trim();
    if (!channel) return;
    const outcome = prompt("Outcome (reached_confirmed/reached_declined/no_answer/wrong_number/callback_requested/other):", "reached_confirmed")?.trim();
    if (!outcome) return;
    const notes = prompt("Notes (optional):", "") ?? "";
    const name = prompt("Your name (for audit):", defaultName) ?? defaultName;
    if (name) localStorage.setItem("followups:lastAttemptName", name);

    const r = await fetch("/api/followups/attempts/log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        followup_id: f.id,
        channel,
        outcome,
        notes,
        attempted_by_name: name || null,
      }),
    });
    const j = await r.json();
    if (!r.ok || j.error) {
      alert(j?.error || `HTTP ${r.status}`);
      return;
    }
    // refresh attempts if panel open
    if (open.has(f.id)) await fetchAttempts(f.id);
    alert("Logged.");
  }

  async function reschedule(f: Followup) {
    const newDate = prompt("New return date (YYYY-MM-DD):", f.due_date)?.trim();
    if (!newDate) return;

    const r = await fetch("/api/followups/reschedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        followup_id: f.id,
        patient_id: f.patient_id,
        created_from_consultation_id: f.created_from_consultation_id,
        new_due_date: newDate,
        return_branch: f.return_branch,
        intended_outcome: f.intended_outcome,
        expected_tests: f.expected_tests,
      }),
    });
    const j = await r.json();
    if (!r.ok || j.error) { alert(j?.error || `HTTP ${r.status}`); return; }
    await load();
    if (open.has(f.id)) await fetchAttempts(f.id);
  }

  async function cancelF(f: Followup) {
    const reason = prompt("Cancel reason (canceled_rescheduled/declined/duplicate/transferred/wrong_number/other):", "declined")?.trim();
    if (!reason) return;
    const r = await fetch("/api/followups/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ followup_id: f.id, reason }),
    });
    const j = await r.json();
    if (!r.ok || j.error) { alert(j?.error || `HTTP ${r.status}`); return; }
    await load();
    if (open.has(f.id)) await fetchAttempts(f.id);
  }

  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold">Follow-Ups</h1>

      {/* Filters */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Start</label>
            <input type="date" className="w-full border rounded px-2 py-1 text-sm" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">End</label>
            <input type="date" className="w-full border rounded px-2 py-1 text-sm" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Hub</label>
            <select className="w-full border rounded px-2 py-1 text-sm" value={hub} onChange={(e) => setHub(e.target.value)}>
              <option value="">All</option>
              {BRANCHES.map((h) => (<option key={h} value={h}>{h}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Status</label>
            <select className="w-full border rounded px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              {STATUS_FILTERS.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyDueToday} onChange={(e) => setOnlyDueToday(e.target.checked)} />
            Only Due Today
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} />
            Only Overdue
          </label>

          <button type="button" onClick={load} disabled={busy} className="ml-auto rounded border px-3 py-1.5 text-sm">
            {busy ? "Loading…" : "Refresh"}
          </button>
          {err && <div className="text-sm text-red-600">{err}</div>}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="text-left font-medium px-3 py-2 w-10"></th>
              <th className="text-left font-medium px-3 py-2">Due</th>
              <th className="text-left font-medium px-3 py-2">Patient</th>
              <th className="text-left font-medium px-3 py-2">Hub</th>
              <th className="text-left font-medium px-3 py-2">Intended</th>
              <th className="text-left font-medium px-3 py-2">Tests</th>
              <th className="text-left font-medium px-3 py-2">Status</th>
              <th className="text-left font-medium px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => {
              const isOpen = open.has(f.id);
              const dueToday = isDueTodayYMD(f.due_date, today);
              const overdue = isOverdueYMD(f.due_date, today);
              const pastGrace = isPastGraceYMD(f.valid_until, today);

              return (
                <Fragment key={f.id}>
                  <tr className="border-t align-top">
                    <td className="px-3 py-2">
                      <button
                        className="h-6 w-6 grid place-items-center rounded hover:bg-gray-100"
                        aria-expanded={isOpen}
                        onClick={() => toggle(f.id)}
                        title={isOpen ? "Hide attempts" : "Show attempts"}
                      >
                        <span className="inline-block transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▸</span>
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span>{f.due_date}</span>
                        {dueToday && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">today</span>}
                        {overdue && !pastGrace && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">overdue</span>}
                        {pastGrace && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">past-grace</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">{f.patient_id}</td>
                    <td className="px-3 py-2">{f.return_branch ?? "—"}</td>
                    <td className="px-3 py-2">{f.intended_outcome ?? "—"}</td>
                    <td className="px-3 py-2">{f.expected_tests ?? "—"}</td>
                    <td className="px-3 py-2">{f.status}{f.cancel_reason ? ` (${f.cancel_reason})` : ""}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button className="rounded border px-2 py-1" onClick={() => logAttempt(f)}>Log attempt</button>
                        {f.status === "scheduled" && (
                          <>
                            <button className="rounded border px-2 py-1" onClick={() => reschedule(f)}>Reschedule</button>
                            <button className="rounded border px-2 py-1" onClick={() => cancelF(f)}>Cancel</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Attempts row */}
                  {isOpen && (
                    <tr className="border-t bg-gray-50/60">
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2" colSpan={7}>
                        {loadingAttempts[f.id] ? (
                          <div className="text-gray-600">Loading attempts…</div>
                        ) : attemptErr[f.id] ? (
                          <div className="text-red-600">Failed to load: {attemptErr[f.id]}</div>
                        ) : (attemptsById[f.id]?.length || 0) === 0 ? (
                          <div className="text-gray-600">No attempts yet.</div>
                        ) : (
                          <ul className="space-y-2">
                            {attemptsById[f.id]!.map(a => (
                              <li key={a.id} className="rounded border bg-white p-2 shadow-sm">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-gray-500">{new Date(a.attempted_at).toLocaleString()}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-white">{a.channel}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">{a.outcome}</span>
                                  {a.attempted_by_name && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 border">{a.attempted_by_name}</span>}
                                </div>
                                {a.notes ? <div className="mt-1 text-sm">{a.notes}</div> : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={8}>
                  No follow-ups in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

import { Fragment } from "react";
