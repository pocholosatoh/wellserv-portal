"use client";

import { useEffect, useRef, useState } from "react";

type Soap = { S: string; O: string; A: string; P: string };

export default function NotesPanel({
  patientId,
  consultationId: cidProp,
}: {
  patientId: string;
  consultationId?: string | null;
}) {
  const [mode, setMode] = useState<"markdown" | "soap">("markdown");
  const [consultationId, setConsultationId] = useState<string | null>(cidProp ?? null);

  const [markdown, setMarkdown] = useState("");
  const [soap, setSoap] = useState<Soap>({ S: "", O: "", A: "", P: "" });

  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  // When parent gives us a consultationId, save it and load any existing notes once.
  useEffect(() => {
    if (!cidProp) return;
    setConsultationId(cidProp);
    (async () => {
      try {
        const r = await fetch(`/api/consultations/details?id=${encodeURIComponent(cidProp)}`);
        const j = await r.json();
        if (r.ok && j?.notes) {
          if (j.notes.notes_markdown) {
            setMode("markdown");
            setMarkdown(j.notes.notes_markdown || "");
          } else if (j.notes.notes_soap) {
            setMode("soap");
            setSoap({
              S: j.notes.notes_soap.S || "",
              O: j.notes.notes_soap.O || "",
              A: j.notes.notes_soap.A || "",
              P: j.notes.notes_soap.P || "",
            });
          }
        }
        setErr(null);
      } catch (e) {
        console.error(e);
        setErr("Failed to load existing notes.");
      }
    })();
  }, [cidProp]);

  // Fallback (rare): if no consultationId was provided, create one ourselves.
  useEffect(() => {
    if (cidProp != null) return; // parent already handled it
    (async () => {
      try {
        const res = await fetch("/api/consultations/upsert-today", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientId }),
        });
        const json = await res.json();
        if (res.ok && json?.consultation?.id) {
          const cid = json.consultation.id as string;
          setConsultationId(cid);
          // Load existing notes, if any
          const r = await fetch(`/api/consultations/details?id=${encodeURIComponent(cid)}`);
          const j = await r.json();
          if (r.ok && j?.notes) {
            if (j.notes.notes_markdown) {
              setMode("markdown");
              setMarkdown(j.notes.notes_markdown || "");
            } else if (j.notes.notes_soap) {
              setMode("soap");
              setSoap({
                S: j.notes.notes_soap.S || "",
                O: j.notes.notes_soap.O || "",
                A: j.notes.notes_soap.A || "",
                P: j.notes.notes_soap.P || "",
              });
            }
          }
          setErr(null);
        } else {
          setErr(json?.error || "Failed to create consultation.");
        }
      } catch (e) {
        console.error(e);
        setErr("Network error while creating consultation.");
      }
    })();
  }, [cidProp, patientId]);

  function queueSave() {
    setSaving("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      if (!consultationId) return;
      const body =
        mode === "markdown"
          ? { consultationId, mode, notesMarkdown: markdown }
          : { consultationId, mode, notesSOAP: soap };
      const res = await fetch("/api/doctor-notes/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSaving(res.ok ? "saved" : "idle");
    }, 800);
  }

  return (
    <div>
      {err && <p className="text-sm text-red-600 mb-2">{err}</p>}

      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm text-gray-600">Notes mode:</span>
        <button
          className={`px-2 py-1 rounded border ${mode === "markdown" ? "bg-black text-white" : ""}`}
          onClick={() => setMode("markdown")}
          type="button"
        >
          Markdown
        </button>
        <button
          className={`px-2 py-1 rounded border ${mode === "soap" ? "bg-black text-white" : ""}`}
          onClick={() => setMode("soap")}
          type="button"
        >
          SOAP
        </button>

        <span className="ml-auto text-xs text-gray-500">
          {saving === "saving" && "Saving…"}
          {saving === "saved" && "Saved"}
        </span>
      </div>

      {mode === "markdown" ? (
        <textarea
          className="w-full h-48 border rounded p-2 text-sm"
          placeholder="Type doctor notes… (Markdown allowed: bullets, headings)"
          value={markdown}
          onChange={(e) => {
            setMarkdown(e.target.value);
            queueSave();
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {(["S", "O", "A", "P"] as const).map((k) => (
            <div key={k}>
              <label className="text-xs text-gray-600">{k}</label>
              <textarea
                className="w-full h-20 border rounded p-2 text-sm"
                value={(soap as any)[k]}
                onChange={(e) => {
                  const v = e.target.value;
                  setSoap((prev) => ({ ...prev, [k]: v }));
                  queueSave();
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
