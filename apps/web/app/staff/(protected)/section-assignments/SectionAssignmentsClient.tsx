"use client";

import { useEffect, useMemo, useState } from "react";

type Hub = { code: string; name: string };
type Staff = { id: string; first_name: string; last_name: string; login_code: string };

function staffLabel(s: Staff) {
  const name = [s.first_name, s.last_name].filter(Boolean).join(" ").trim();
  return `${name || "Unnamed"} (${s.login_code || "RMT"})`;
}

function buildAssignmentMap(sections: string[], assignments: Record<string, string | null>) {
  const out: Record<string, string | null> = {};
  sections.forEach((sec) => {
    out[sec] = assignments?.[sec] ?? null;
  });
  return out;
}

export default function SectionAssignmentsClient({
  role,
  initialHub,
}: {
  role: "admin" | "rmt";
  initialHub?: string;
}) {
  const [selectedHub, setSelectedHub] = useState(initialHub || "");
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [rmts, setRmts] = useState<Staff[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string | null>>({});
  const [original, setOriginal] = useState<Record<string, string | null>>({});
  const [editableHubs, setEditableHubs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Remember last hub for admins to reduce clicks next visit
  useEffect(() => {
    if (role !== "admin") return;
    const stored =
      typeof window !== "undefined" ? localStorage.getItem("sectionAssignments:lastHub") : null;
    if (stored) setSelectedHub(stored);
  }, [role]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const qs = selectedHub ? `?hub_code=${encodeURIComponent(selectedHub)}` : "";
        const res = await fetch(`/api/staff/section-assignments${qs}`, { cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !j?.ok) {
          throw new Error(j?.error || "Failed to load data");
        }

        const hub = j?.hub_code || selectedHub || "";
        const secs = Array.isArray(j.sections) ? j.sections : [];
        const assigns = buildAssignmentMap(secs, j.assignments || {});

        setSelectedHub(hub);
        setHubs(Array.isArray(j.hubs) ? j.hubs : []);
        setSections(secs);
        setRmts(Array.isArray(j.rmts) ? j.rmts : []);
        setAssignments(assigns);
        setOriginal(assigns);
        setEditableHubs(Array.isArray(j.editable_hubs) ? j.editable_hubs : []);

        if (role === "admin" && typeof window !== "undefined" && hub) {
          localStorage.setItem("sectionAssignments:lastHub", hub);
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Unable to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedHub, role]);

  const canEdit = editableHubs.includes(selectedHub);
  const isDirty = useMemo(() => {
    return sections.some((sec) => (assignments?.[sec] ?? null) !== (original?.[sec] ?? null));
  }, [sections, assignments, original]);

  const saveDisabled = !canEdit || saving || loading || !isDirty;

  async function saveChanges() {
    if (saveDisabled) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await fetch("/api/staff/section-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hub_code: selectedHub, assignments }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        throw new Error(j?.error || "Save failed");
      }

      const updated = buildAssignmentMap(sections, j.assignments || assignments);
      setAssignments(updated);
      setOriginal(updated);
      setSuccess(
        "Section assignments updated. These assignments will persist until you change them.",
      );
    } catch (e: any) {
      setError(e?.message || "Failed to save assignments");
    } finally {
      setSaving(false);
    }
  }

  function onSelect(section: string, staffId: string) {
    setAssignments((prev) => ({
      ...prev,
      [section]: staffId || null,
    }));
    setSuccess(null);
  }

  const currentHub = hubs.find((h) => h.code === selectedHub) || null;
  const editingNote = canEdit
    ? `Editing ${currentHub?.name || selectedHub || "selected hub"}`
    : "Read-only for this hub";

  const selectClass =
    "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500";

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">Section Assignments</h1>
        <p className="text-sm text-gray-600">
          These assignments are used to tag who ran each test. They persist until changed.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      )}

      <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-gray-800">Hub</div>
            {role === "rmt" && (
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 ring-1 ring-gray-200">
                {currentHub?.name || selectedHub || "Current hub"}
              </div>
            )}
            {role === "admin" && (
              <select
                value={selectedHub}
                onChange={(e) => setSelectedHub(e.target.value)}
                className={selectClass}
                disabled={loading}
              >
                {hubs.map((h) => (
                  <option key={h.code} value={h.code}>
                    {h.name} ({h.code})
                  </option>
                ))}
              </select>
            )}
            <div className="text-xs text-gray-600">{editingNote}</div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span className="rounded-md bg-gray-50 px-3 py-2 ring-1 ring-gray-200">
              {loading ? "Loading sections…" : `${sections.length} sections`}
            </span>
            <span className="rounded-md bg-gray-50 px-3 py-2 ring-1 ring-gray-200">
              {rmts.length} active RMTs
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
                >
                  Section
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
                >
                  Assigned RMT
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading && (
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-600" colSpan={2}>
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && sections.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-sm text-gray-600" colSpan={2}>
                    No sections found.
                  </td>
                </tr>
              )}
              {!loading &&
                sections.map((section) => (
                  <tr key={section}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{section}</td>
                    <td className="px-4 py-3">
                      <select
                        value={assignments?.[section] || ""}
                        onChange={(e) => onSelect(section, e.target.value)}
                        className={selectClass}
                        disabled={!canEdit || saving}
                      >
                        <option value="">Unassigned</option>
                        {rmts.map((r) => (
                          <option key={r.id} value={r.id}>
                            {staffLabel(r)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {!canEdit && (
            <div className="text-sm text-gray-600">Editing is limited to your current hub.</div>
          )}
          <button
            type="button"
            onClick={saveChanges}
            disabled={saveDisabled}
            className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : isDirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </div>
    </div>
  );
}
