"use client";

import { useEffect, useState } from "react";

export default function NotesPanel({
  patientId,
  consultationId,
  modeDefault = "markdown",
  autosave = false,
}: {
  patientId: string;
  consultationId: string | null;
  modeDefault?: "markdown" | "soap";
  autosave?: boolean;
}) {
  const [mode, setMode] = useState<"markdown" | "soap">(modeDefault as any);
  const [md, setMd] = useState("");
  const [soap, setSoap] = useState<{ S?: string; O?: string; A?: string; P?: string }>({});
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setMode(modeDefault as any);
  }, [modeDefault]);

  // 👉 Prefill editor when consultationId becomes available (or changes)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!consultationId) return;
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/doctor-notes/get?consultation_id=${encodeURIComponent(consultationId)}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error || "Failed to load notes.");

        // Only update if this effect hasn't been superseded
        if (cancelled) return;

        const gotMd = (j?.notes_markdown ?? "") as string;
        const gotSoap = (j?.notes_soap ?? null) as any;

        setMd(gotMd || "");
        setSoap(gotSoap || {});

        // Choose a sensible mode based on what exists (don’t override user preference if both empty)
        if (gotMd && !gotSoap) setMode("markdown");
        else if (!gotMd && gotSoap) setMode("soap");
        // else keep current mode

      } catch (e: any) {
        if (!cancelled) setErr(e.message || "Failed to load notes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [consultationId]);

  async function save() {
    if (!consultationId) return;
    setSaving("saving");
    setErr(null);
    const res = await fetch("/api/doctor-notes/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consultationId,
        mode,
        notesMarkdown: mode === "markdown" ? md : undefined,
        notesSOAP: mode === "soap" ? soap : undefined,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok) {
      setSaving("saved");
    } else {
      setSaving("idle");
      setErr(j?.error || "Failed to save notes.");
    }
  }

  // Optional autosave (kept off by default)
  useEffect(() => {
    if (!autosave || !consultationId) return;
    const t = setTimeout(save, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosave, consultationId, mode, md, soap]);

  return (
    <div className="space-y-2">
      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="flex items-center gap-2">
        <div className="text-sm">Notes mode:</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("markdown")}
            className={`px-2 py-1 rounded border text-sm ${mode === "markdown" ? "bg-black text-white" : ""}`}
          >
            Markdown
          </button>
          <button
            type="button"
            onClick={() => setMode("soap")}
            className={`px-2 py-1 rounded border text-sm ${mode === "soap" ? "bg-black text-white" : ""}`}
          >
            SOAP
          </button>
        </div>

        <span className="ml-auto text-xs text-gray-500">
          {loading ? "Loading…" : saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : ""}
        </span>
      </div>

      {mode === "markdown" ? (
        <textarea
          className="w-full border rounded p-2 h-48 text-sm"
          placeholder="Type doctor notes… (Markdown allowed: bullets, headings)"
          value={md}
          onChange={(e) => setMd(e.target.value)}
          disabled={!consultationId}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {(["S", "O", "A", "P"] as const).map((k) => (
            <div key={k}>
              <label className="block text-xs text-gray-600 mb-1">{k}</label>
              <textarea
                className="w-full border rounded p-2 h-24"
                value={(soap as any)[k] || ""}
                onChange={(e) => setSoap((prev) => ({ ...prev, [k]: e.target.value }))}
                disabled={!consultationId}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          className="rounded border px-3 py-2 text-sm"
          onClick={save}
          disabled={!consultationId}
        >
          Save Notes
        </button>
      </div>
    </div>
  );
}
