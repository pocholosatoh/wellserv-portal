"use client";

import { useEffect, useRef, useState } from "react";
import NoteTemplatesModal from "./NoteTemplatesModal";

export default function NotesPanel({
  patientId: _patientId,
  consultationId,
  modeDefault = "soap",
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
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateType, setTemplateType] = useState<"SOAP" | "MARKDOWN">("SOAP");

  // timer to auto-hide "Saved"
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearSavedTimer = () => {
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
  };
  const flashSaved = (ms = 2000) => {
    clearSavedTimer();
    setSaving("saved");
    savedTimerRef.current = setTimeout(() => {
      setSaving("idle");
      savedTimerRef.current = null;
    }, ms);
  };

  useEffect(() => {
    setMode(modeDefault as any);
  }, [modeDefault]);

  useEffect(() => {
    setTemplateType(mode === "soap" ? "SOAP" : "MARKDOWN");
  }, [mode]);

  // Prefill editor when consultationId becomes available (or changes)
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

        if (cancelled) return;

        const gotMd = (j?.notes_markdown ?? "") as string;
        const gotSoap = (j?.notes_soap ?? null) as any;

        setMd(gotMd || "");
        setSoap(gotSoap || {});

        // Choose sensible mode based on existing data (don’t override if both empty)
        if (gotMd && !gotSoap) setMode("markdown");
        else if (!gotMd && gotSoap) setMode("soap");

        // fresh load -> not saved yet
        clearSavedTimer();
        setSaving("idle");
      } catch (e: any) {
        if (!cancelled) setErr(e.message || "Failed to load notes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [consultationId]);

  // Save handler
  async function save() {
    if (!consultationId) return;
    clearSavedTimer();
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
    if (res.ok && j?.ok !== false) {
      // success: show "Saved" briefly
      flashSaved(2000);
    } else {
      setSaving("idle");
      setErr(j?.error || "Failed to save notes.");
    }
  }

  // Optional autosave
  useEffect(() => {
    if (!autosave || !consultationId) return;
    const t = setTimeout(save, 800);
    return () => clearTimeout(t);
  }, [autosave, consultationId, mode, md, soap]);

  // Any editor change should immediately hide "Saved"
  const onMdChange = (v: string) => {
    if (saving === "saved") {
      clearSavedTimer();
      setSaving("idle");
    }
    setMd(v);
  };
  const onSoapChange = (k: "S" | "O" | "A" | "P", v: string) => {
    if (saving === "saved") {
      clearSavedTimer();
      setSaving("idle");
    }
    setSoap(prev => ({ ...prev, [k]: v }));
  };

  // Cleanup timer on unmount
  useEffect(() => clearSavedTimer, []);

  const openTemplates = (type: "SOAP" | "MARKDOWN") => {
    setTemplateType(type);
    setTemplateOpen(true);
  };

  const handleInsertSoap = (tpl: { S?: string; O?: string; A?: string; P?: string }) => {
    if (saving === "saved") {
      clearSavedTimer();
      setSaving("idle");
    }
    setSoap({
      S: tpl.S ?? "",
      O: tpl.O ?? "",
      A: tpl.A ?? "",
      P: tpl.P ?? "",
    });
  };

  const handleInsertMarkdown = (content: string) => {
    if (saving === "saved") {
      clearSavedTimer();
      setSaving("idle");
    }
    setMd(content || "");
  };

  return (
    <div className="space-y-2">
      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm">Notes mode:</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("soap")}
            className={`px-2 py-1 rounded border text-sm ${mode === "soap" ? "bg-black text-white" : ""}`}
          >
            SOAP
          </button>
          <button
            type="button"
            onClick={() => setMode("markdown")}
            className={`px-2 py-1 rounded border text-sm ${mode === "markdown" ? "bg-black text-white" : ""}`}
          >
            Markdown/Free Text
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {mode === "soap" ? (
            <button
              type="button"
              onClick={() => openTemplates("SOAP")}
              disabled={!consultationId}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-[#2e6468] hover:border-[#2e6468] disabled:opacity-60"
            >
              SOAP Templates
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openTemplates("MARKDOWN")}
              disabled={!consultationId}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-[#2e6468] hover:border-[#2e6468] disabled:opacity-60"
            >
              Markdown Templates
            </button>
          )}
          <span className="text-xs text-gray-500">
            {loading ? "Loading…" : saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : ""}
          </span>
        </div>
      </div>

      {mode === "markdown" ? (
        <textarea
          className="w-full border rounded p-2 h-48 text-sm"
          placeholder="Type doctor notes… (Markdown/Free Text)"
          value={md}
          onChange={(e) => onMdChange(e.target.value)}
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
                onChange={(e) => onSoapChange(k, e.target.value)}
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

      <NoteTemplatesModal
        open={templateOpen}
        type={templateType}
        onClose={() => setTemplateOpen(false)}
        onInsertSoap={handleInsertSoap}
        onInsertMarkdown={handleInsertMarkdown}
        currentSoap={soap}
        currentMarkdown={md}
      />
    </div>
  );
}
