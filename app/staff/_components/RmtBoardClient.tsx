"use client";

import { useMemo, useState } from "react";

type Status = "intake" | "for-extract" | "for-processing" | "done";

export type RmtRow = {
  id: string;
  patient_id: string;
  full_name: string;
  branch_code: "SI" | "SL";
  status: Status;
  priority: number;
  notes_frontdesk: string | null;
  created_at: string;
  visit_date_local: string;
};

export default function RmtBoardClient({
  initialItems,
  role,
  branch,
}: {
  initialItems: RmtRow[];
  role: string; // "admin" | "rmt" | ...
  branch: "SI" | "SL";
}) {
  const [items, setItems] = useState<RmtRow[]>(initialItems || []);
  const [tab, setTab] = useState<Status | "all">("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );

  const counts = useMemo(() => {
    const c: Record<Status, number> = {
      intake: 0,
      "for-extract": 0,
      "for-processing": 0,
      done: 0,
    };
    items.forEach((x) => (c[x.status] = (c[x.status] || 0) + 1));
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    if (tab === "all") return items;
    return items.filter((x) => x.status === tab);
  }, [items, tab]);

  // Drag helpers
  function onDragStart(id: string) {
    setDragId(id);
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }
  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const arr = [...filtered]; // currently visible list
    const full = [...items];

    const dragIndexFull = full.findIndex((x) => x.id === dragId);
    const targetIndexFull = full.findIndex((x) => x.id === targetId);
    if (dragIndexFull < 0 || targetIndexFull < 0) return;

    // Reorder in the full list using the visible indexes’ relative order
    const [moved] = full.splice(dragIndexFull, 1);
    full.splice(targetIndexFull, 0, moved);
    setItems(full);
    setSaving("idle");
  }

  async function saveOrder() {
    try {
      setSaving("saving");
      const res = await fetch("/api/staff/encounters/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch,
          ids: items.map((x) => x.id), // whole list order = priority order
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaving("saved");
      setTimeout(() => setSaving("idle"), 1200);
    } catch {
      setSaving("error");
      setTimeout(() => setSaving("idle"), 1500);
    }
  }

  const tabBtn =
    "px-3 py-1.5 rounded border text-sm hover:bg-gray-50 whitespace-nowrap";
  const tabActive = "px-3 py-1.5 rounded border text-sm bg-gray-900 text-white";

  return (
    <div className="space-y-4">
      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={tab === "all" ? tabActive : tabBtn}
          onClick={() => setTab("all")}
        >
          All ({items.length})
        </button>
        <button
          className={tab === "intake" ? tabActive : tabBtn}
          onClick={() => setTab("intake")}
        >
          Intake ({counts["intake"]})
        </button>
        <button
          className={tab === "for-extract" ? tabActive : tabBtn}
          onClick={() => setTab("for-extract")}
        >
          For Extract ({counts["for-extract"]})
        </button>
        <button
          className={tab === "for-processing" ? tabActive : tabBtn}
          onClick={() => setTab("for-processing")}
        >
          Processing ({counts["for-processing"]})
        </button>
        <button
          className={tab === "done" ? tabActive : tabBtn}
          onClick={() => setTab("done")}
        >
          Done ({counts["done"]})
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={saveOrder}
            className="rounded px-3 py-1.5 border bg-white hover:bg-gray-50"
            title="Persist current order as priority"
          >
            Save Order
          </button>
          {saving === "saving" && (
            <span className="text-sm text-gray-600">Saving…</span>
          )}
          {saving === "saved" && (
            <span className="text-sm text-emerald-700">Saved ✓</span>
          )}
          {saving === "error" && (
            <span className="text-sm text-red-600">Failed</span>
          )}
        </div>
      </div>

      {/* list (draggable) */}
      <ul className="space-y-2">
        {filtered.map((x) => (
          <li
            key={x.id}
            draggable
            onDragStart={() => onDragStart(x.id)}
            onDragOver={onDragOver}
            onDrop={() => onDrop(x.id)}
            className={`border rounded p-3 flex items-center justify-between gap-3 ${
              dragId === x.id ? "opacity-60" : ""
            }`}
            title="Drag to reorder"
          >
            <div className="min-w-0">
              <div className="font-medium truncate">
                {x.patient_id} — {x.full_name}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                <StatusPill s={x.status} />
                <span>{x.notes_frontdesk || "No notes"}</span>
                <span>• Priority {x.priority}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Admin can queue (set for-extract) from Intake */}
              {role === "admin" && x.status === "intake" && (
                <form action="/api/staff/encounters/status" method="post">
                  <input type="hidden" name="id" value={x.id} />
                  <input type="hidden" name="status" value="for-extract" />
                  <button className="border rounded px-2 py-1">
                    Queue (For Extract)
                  </button>
                </form>
              )}

              {/* Skip extraction: allow from intake or for-extract */}
              {(x.status === "intake" || x.status === "for-extract") && (
                <form action="/api/staff/encounters/status" method="post">
                  <input type="hidden" name="id" value={x.id} />
                  <input type="hidden" name="status" value="for-processing" />
                  <input type="hidden" name="note" value="skip_extraction" />
                  <button className="border rounded px-2 py-1" title="Specimen not needed">
                    Skip Extraction
                  </button>
                </form>
              )}

              {/* RMT actions */}
              {x.status === "for-extract" && (
                <form action="/api/staff/encounters/status" method="post">
                  <input type="hidden" name="id" value={x.id} />
                  <input type="hidden" name="status" value="for-processing" />
                  <button className="border rounded px-2 py-1">
                    Specimen Received
                  </button>
                </form>
              )}

              {x.status === "for-processing" && (
                <form action="/api/staff/encounters/status" method="post">
                  <input type="hidden" name="id" value={x.id} />
                  <input type="hidden" name="status" value="done" />
                  <button className="rounded px-2 py-1 bg-emerald-600 text-white">
                    Done
                  </button>
                </form>
              )}

              {/* Print */}
              <a
                href={`/staff/print/label/${x.id}`}
                target="_blank"
                rel="noreferrer"
                className="border rounded px-2 py-1"
              >
                Label
              </a>
              <a
                href={`/staff/print/request/${x.id}`}
                target="_blank"
                rel="noreferrer"
                className="border rounded px-2 py-1"
              >
                A5 Request
              </a>
            </div>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <p className="text-gray-500">No encounters in this filter.</p>
      )}
    </div>
  );
}

function StatusPill({ s }: { s: Status }) {
  const map: Record<Status, string> = {
    intake: "bg-gray-200 text-gray-800",
    "for-extract": "bg-amber-100 text-amber-800",
    "for-processing": "bg-blue-100 text-blue-800",
    done: "bg-emerald-100 text-emerald-800",
  };
  const label: Record<Status, string> = {
    intake: "Intake",
    "for-extract": "For Extract",
    "for-processing": "Specimen Received",
    done: "Done",
  };
  return (
    <span className={`px-2 py-1 rounded text-xs ${map[s]}`}>{label[s]}</span>
  );
}
