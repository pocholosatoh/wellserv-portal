"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type TemplateType = "SOAP" | "MARKDOWN";
type SoapTemplate = { S?: string; O?: string; A?: string; P?: string };
type NoteTemplate = {
  id: string;
  doctor_id: string | null;
  title: string;
  template_type: TemplateType;
  soap_template?: SoapTemplate | null;
  markdown_template?: string | null;
  is_system?: boolean | null;
};

type Props = {
  open: boolean;
  type: TemplateType;
  onClose: () => void;
  onInsertSoap: (tpl: SoapTemplate) => void;
  onInsertMarkdown: (text: string) => void;
  currentSoap?: SoapTemplate;
  currentMarkdown?: string;
};

function sortTemplates(list: NoteTemplate[]) {
  return [...list].sort((a, b) => {
    const sysA = a.is_system ? 1 : 0;
    const sysB = b.is_system ? 1 : 0;
    if (sysA !== sysB) return sysB - sysA;
    return (a.title || "").localeCompare(b.title || "");
  });
}

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function NoteTemplatesModal({
  open,
  type,
  onClose,
  onInsertSoap,
  onInsertMarkdown,
  currentSoap,
  currentMarkdown,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [templates, setTemplates] = useState<NoteTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 250);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSoap, setNewSoap] = useState<SoapTemplate>({ S: "", O: "", A: "", P: "" });
  const [newMarkdown, setNewMarkdown] = useState("");

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) || templates[0] || null,
    [selectedId, templates],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      setToast(null);
      try {
        const params = new URLSearchParams({
          type,
        });
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
        const res = await fetch(`/api/doctor-note-templates?${params.toString()}`);
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Failed to load templates");
        if (cancelled) return;
        const rows = Array.isArray(j?.templates) ? (j.templates as NoteTemplate[]) : [];
        const sorted = sortTemplates(rows);
        setTemplates(sorted);
        if (sorted.length) {
          const keep = sorted.find((t) => t.id === selectedId);
          setSelectedId(keep ? keep.id : sorted[0].id);
        } else {
          setSelectedId(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load templates");
          setTemplates([]);
          setSelectedId(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [open, type, debouncedSearch]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setCreateOpen(false);
      setNewTitle("");
      setNewSoap({ S: "", O: "", A: "", P: "" });
      setNewMarkdown("");
      setError(null);
      setToast(null);
    }
  }, [open, type]);

  const insertLabel = type === "SOAP" ? "Insert SOAP Template" : "Insert Markdown Template";
  const modalTitle = type === "SOAP" ? "SOAP Templates" : "Markdown Templates";
  const createLabel = type === "SOAP" ? "SOAP" : "Markdown/Free Text";

  const handleInsert = () => {
    if (!selected) return;
    const hasExisting =
      type === "SOAP"
        ? Boolean(
            currentSoap &&
              (currentSoap.S?.trim() ||
                currentSoap.O?.trim() ||
                currentSoap.A?.trim() ||
                currentSoap.P?.trim()),
          )
        : Boolean(currentMarkdown && currentMarkdown.trim());
    if (hasExisting) {
      const confirmed = window.confirm(
        "Inserting this template will overwrite your current notes. Continue?",
      );
      if (!confirmed) return;
    }
    if (type === "SOAP") {
      const tpl = selected.soap_template || {};
      onInsertSoap({
        S: tpl.S ?? "",
        O: tpl.O ?? "",
        A: tpl.A ?? "",
        P: tpl.P ?? "",
      });
    } else {
      onInsertMarkdown(selected.markdown_template || "");
    }
    onClose();
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    setToast(null);
    try {
      const res = await fetch("/api/doctor-note-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_type: type,
          title: newTitle,
          soap_template: type === "SOAP" ? newSoap : undefined,
          markdown_template: type === "MARKDOWN" ? newMarkdown : undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to save template");
      const tpl = j?.template as NoteTemplate;
      if (tpl?.id) {
        setTemplates((prev) => sortTemplates([...(prev || []), tpl]));
        setSelectedId(tpl.id);
        setToast("Template saved");
        setCreateOpen(false);
        setNewTitle("");
        setNewSoap({ S: "", O: "", A: "", P: "" });
        setNewMarkdown("");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to save template");
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 px-3 py-6 sm:items-center">
      <div className="absolute inset-0" aria-hidden="true" onClick={onClose} />
      <div className="relative z-10 mx-auto w-full max-w-5xl rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Templates</p>
            <h2 className="text-lg font-semibold text-gray-900">{modalTitle}</h2>
            <p className="text-xs text-gray-500">
              System templates first, then your saved templates. Search by title.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        {error && <div className="px-5 py-2 text-sm text-red-600">{error}</div>}
        {toast && <div className="px-5 py-2 text-sm text-emerald-600">{toast}</div>}

        <div className="grid gap-4 px-5 py-4 md:grid-cols-5">
          <div className="md:col-span-2 space-y-3">
            <div className="relative">
              <input
                type="search"
                placeholder="Search templates…"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#44969b] focus:outline-none"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {loading && (
                <span className="absolute right-3 top-2.5 text-xs text-gray-500">Loading…</span>
              )}
            </div>
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {templates.length === 0 && !loading ? (
                <div className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500">
                  No templates found.
                </div>
              ) : (
                templates.map((tpl) => {
                  const isSelected = tpl.id === selected?.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setSelectedId(tpl.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        isSelected
                          ? "border-[#44969b] bg-[#eef7f7]"
                          : "border-gray-200 hover:border-[#44969b] hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-sm text-gray-900">
                          {tpl.title || "Untitled"}
                        </div>
                        <span
                          className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 ${
                            tpl.is_system
                              ? "bg-slate-100 text-slate-700"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {tpl.is_system ? "System" : "Custom"}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {tpl.template_type === "SOAP" ? "SOAP template" : "Markdown / Free text"}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="md:col-span-3 space-y-3">
            {selected ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase text-gray-500">
                      {selected.is_system ? "System template" : "Your template"}
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">{selected.title}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleInsert}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                  >
                    {insertLabel}
                  </button>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 max-h-[360px] overflow-y-auto">
                  {type === "SOAP" ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {(["S", "O", "A", "P"] as const).map((k) => (
                        <div key={k} className="rounded-lg border border-gray-200 bg-white p-3">
                          <div className="text-xs font-semibold text-gray-500 mb-1">{k}</div>
                          <div className="text-sm whitespace-pre-wrap text-gray-800">
                            {(selected.soap_template as any)?.[k] || "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm whitespace-pre-wrap text-gray-800">
                      {selected.markdown_template || "—"}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                Choose a template on the left to preview and insert.
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={() => setCreateOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            <span>Create New {createLabel} Template</span>
            <span className="text-lg leading-none text-gray-500">{createOpen ? "−" : "+"}</span>
          </button>

          {createOpen && (
            <div className="mt-3 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Template Title</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#44969b] focus:outline-none"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={`e.g. ${type === "SOAP" ? "URI follow-up" : "Discharge instructions"}`}
                />
              </div>

              {type === "SOAP" ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(["S", "O", "A", "P"] as const).map((k) => (
                    <div key={k}>
                      <label className="block text-xs text-gray-600 mb-1">{k}</label>
                      <textarea
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#44969b] focus:outline-none"
                        rows={3}
                        value={(newSoap as any)[k] || ""}
                        onChange={(e) => setNewSoap((prev) => ({ ...prev, [k]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Template Content (Markdown/Free Text)
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#44969b] focus:outline-none"
                    rows={5}
                    value={newMarkdown}
                    onChange={(e) => setNewMarkdown(e.target.value)}
                    placeholder="Write your markdown template here…"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  {creating
                    ? "Saving…"
                    : "Templates you create are private to your login; other doctors won’t see them."}
                </div>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-70"
                >
                  Save Template
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
