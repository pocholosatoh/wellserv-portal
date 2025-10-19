"use client";

import { useEffect, useMemo, useState } from "react";
import TestPicker from "@/app/staff/_components/TestPicker";
import { useRouter } from "next/navigation";

/** Helpers */
function readCookie(name: string) {
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : "";
}
function maskMMDDYYYY(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const mm = digits.slice(0, 2);
  const dd = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  let out = mm;
  if (dd) out += "/" + dd;
  if (yyyy) out += "/" + yyyy;
  return out;
}
function toMMDDYY(mmddyyyy: string): string {
  const m = mmddyyyy.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const mm = String(m[1]).padStart(2, "0");
  const dd = String(m[2]).padStart(2, "0");
  const yy = String(m[3]).slice(-2);
  return `${mm}${dd}${yy}`;
}
function up(s?: string) { return (s || "").toUpperCase(); }

// after imports / helpers
function getCookie(name: string) {
  const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[2]) : "";
}

/** Price helpers on client (for live display only; server recomputes for truth) */
type Catalog = {
  tests: { code: string; name: string; price?: number | null }[];
  packages: { code: string; name: string; price?: number | null }[];
  packageMap: Record<string, string[]>;
};

export default function Reception() {
  const router = useRouter();

  // branch lock
  const [branch, setBranch] = useState<"SI" | "SL">("SI");
  const [branchLocked, setBranchLocked] = useState(true);

  // form state
  const [surname, setSurname] = useState("");
  const [firstname, setFirstname] = useState("");
  const [sex, setSex] = useState<"M" | "F">("M");
  const [birthday, setBirthday] = useState(""); // MM/DD/YYYY
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [pid, setPid] = useState(""); // generated
  const [yakap, setYakap] = useState(false);
  const [queueNow, setQueueNow] = useState(false);

  const [requested, setRequested] = useState(""); // CSV string
  const [manualAdd, setManualAdd] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<string>("");

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<any | null>(null);
  const [editCsv, setEditCsv] = useState("");
  const [editManual, setEditManual] = useState<number>(0);
  const [editSaving, setEditSaving] = useState(false);

  async function openEdit(id: string) {
    try {
      const r = await fetch(`/api/staff/encounters/get?id=${id}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Load failed");
      setEditRow(j.row);
      setEditCsv(j.row?.notes_frontdesk || "");
      setEditManual(Number(j.row?.price_manual_add || 0));
      setEditOpen(true);
    } catch (e: any) {
      alert(e?.message || "Failed to open");
    }
  }

  async function saveEdit() {
    if (!editRow?.id || editSaving) return;
    setEditSaving(true);
    try {
      const resp = await fetch("/api/staff/encounters/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editRow.id,
          requested_tests_csv: editCsv,
          price_manual_add: editManual,
        }),
      });
      const j = await resp.json();
      if (!resp.ok || !j?.ok) throw new Error(j?.error || "Save failed");
      setEditOpen(false);
      setEditRow(null);
      await loadTodayList(branch);   // refresh table to reflect latest
    } catch (e: any) {
      alert(e?.message || "Failed to save");
    } finally {
      setEditSaving(false);
    }
  }

  useEffect(() => {
    setRole((getCookie("staff_role") || "").toLowerCase());
  }, []);

  // UI
  const [openForm, setOpenForm] = useState(false);
  const [lookupBadge, setLookupBadge] = useState<null | string>(null); // "Existing patient loaded" etc.

  // catalog for live pricing
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  useEffect(() => {
    // branch from cookies
    const b = (readCookie("staff_branch") || "SI").toUpperCase();
    setBranch((b === "ALL" ? "SI" : b) as "SI" | "SL");
    setBranchLocked(b !== "ALL");

    // fetch catalog
    (async () => {
      try {
        const res = await fetch("/api/catalog/lab");
        const j = await res.json();
        if (res.ok) setCatalog(j);
      } catch {}
    })();
  }, []);

  // initial load once (no polling)
  useEffect(() => { loadTodayList(branch); }, [branch]);

  // generate pid whenever surname/birthday changes
  useEffect(() => {
    const mmddyy = toMMDDYY(birthday);
    const sur = up(surname).replace(/[^A-Z]/g, "");
    setPid(sur && mmddyy ? `${sur}${mmddyy}` : "");
  }, [surname, birthday]);

  // auto lookup when pid is valid
  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      if (!pid || pid.length < 6) return;
      try {
        const res = await fetch(`/api/staff/patients/lookup?patient_id=${pid}`, { signal: ctrl.signal });
        const j = await res.json();
        if (res.ok && j?.found) {
          // split "SURNAME, FIRST"
          const full = String(j.patient.full_name || "");
          const parts = full.split(",");
          const sur = parts[0]?.trim() || full;
          const first = parts[1]?.trim() || "";
          setSurname(sur);
          setFirstname(first);
          setSex((j.patient.sex || "M") as "M" | "F");
          setBirthday(j.patient.birthday || birthday);
          setContact(j.patient.contact || "");
          setAddress(j.patient.address || "");
          setLookupBadge("Existing patient loaded");
        } else {
          setLookupBadge(null);
        }
      } catch {}
    };
    const t = setTimeout(run, 600);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [pid]);

  // live pricing (client preview) — matches server logic
  const liveTotals = useMemo(() => {
    if (!catalog) return { auto: 0, final: Math.max(0, Number(manualAdd || 0)) };
    const tokens = (requested || "").split(",").map(s => s.trim()).filter(Boolean);
    const tokenUpper = new Set(tokens.map(t => t.toUpperCase()));

    // package prices and members
    const packPrice = new Map<string, number>();
    for (const p of catalog.packages) packPrice.set(p.code.toUpperCase(), Number(p.price || 0));
    const testPrice = new Map<string, number>();
    for (const t of catalog.tests) testPrice.set(t.code.toUpperCase(), Number(t.price || 0));

    let auto = 0;
    // apply packages first
    for (const tok of tokenUpper) {
      if (packPrice.has(tok)) {
        auto += packPrice.get(tok)!;
        const members = catalog.packageMap[tok];
        if (members) {
          for (const m of members) tokenUpper.delete(m.toUpperCase());
        }
      }
    }
    // add remaining tests
    for (const tok of tokenUpper) {
      if (testPrice.has(tok)) auto += testPrice.get(tok)!;
    }
    const manual = Math.max(0, Number(manualAdd || 0));
    return { auto, final: auto + manual };
  }, [requested, manualAdd, catalog]);

  async function loadTodayList(b: "SI" | "SL" = branch) {
    try {
      const res = await fetch(`/api/staff/encounters/today?branch=${b}`, { cache: "no-store" });
      const j = await res.json();
      if (res.ok) setList(j.rows || []);
    } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;            // guard against double-clicks
    if (!pid || !birthday) return;

    setSaving(true);
    const full_name = `${up(surname)}, ${up(firstname)}`.trim();
    const payload = {
      branch_code: branch,
      patient: {
        patient_id: pid,
        full_name,
        sex,
        birthday_mmddyyyy: birthday,
        contact,
        address,
      },
      requested_tests_csv: requested,
      yakap_flag: yakap,
      price_manual_add: Number(manualAdd || 0),
      queue_now: queueNow,
    };

    try {
      const res = await fetch("/api/staff/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();

      if (!res.ok || !j?.ok) throw new Error(j?.error || "Failed to save");

      // after a successful save:
      setSurname("");
      setFirstname("");
      setSex("M");
      setBirthday("");
      setContact("");
      setAddress("");
      setPid("");
      setRequested("");
      setManualAdd(0);
      setYakap(false);
      setQueueNow(false);
      setLookupBadge(null);
      setOpenForm(false);

      await loadTodayList(branch);  // refresh table now
      
    } catch (err: any) {
      alert(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // Today list (client fetch to keep it simple)
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/staff/encounters/today?branch=${branch}`, { cache: "no-store" });
        const j = await res.json();
        if (res.ok) setList(j.rows || []);
      } catch {}
    };
    load();
  }, [branch]); // reload on branch change

  return (
    <main className="mx-auto max-w-4xl p-4 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reception — {branch}</h1>
        <button
          className="rounded px-3 py-1.5 border hover:bg-gray-50"
          onClick={() => setOpenForm(x => !x)}
        >
          {openForm ? "Hide Intake Form" : "New / Update (Toggle)"}
        </button>
      </header>

      {/* Collapsible Intake Panel */}
      {openForm && (
        <form onSubmit={handleSubmit} className="space-y-4 border rounded p-4">
          {/* Branch select (locked unless ALL) */}
          <label className="block text-sm">
            <span className="text-sm">Branch</span>
            <select
              value={branch}
              disabled={branchLocked}
              onChange={(e) => setBranch(e.target.value as any)}
              className="border rounded px-2 py-2 w-full"
            >
              <option value="SI">San Isidro (SI)</option>
              <option value="SL">San Leonardo (SL)</option>
            </select>
          </label>

          {/* Names */}
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-sm">Surname</span>
              <input value={surname} onChange={(e)=>setSurname(e.target.value)} className="border rounded px-2 py-2 w-full" required />
            </label>
            <label className="space-y-1">
              <span className="text-sm">First name</span>
              <input value={firstname} onChange={(e)=>setFirstname(e.target.value)} className="border rounded px-2 py-2 w-full" required />
            </label>
          </div>

          {/* PID + badges */}
          <div className="grid grid-cols-3 gap-3">
            <label className="space-y-1 col-span-1">
              <span className="text-sm">Patient ID</span>
              <input value={pid} readOnly className="border rounded px-2 py-2 w-full bg-gray-50" />
              {lookupBadge && <div className="text-xs text-emerald-700 mt-1">{lookupBadge}</div>}
            </label>

            <label className="space-y-1">
              <span className="text-sm">Sex</span>
              <select value={sex} onChange={(e)=>setSex(e.target.value as any)} className="border rounded px-2 py-2 w-full">
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm">Birthday (MM/DD/YYYY)</span>
              <input
                value={birthday}
                onChange={(e)=>setBirthday(maskMMDDYYYY(e.target.value))}
                className="border rounded px-2 py-2 w-full"
                inputMode="numeric"
                maxLength={10}
                placeholder="MM/DD/YYYY"
                required
              />
            </label>
          </div>

          {/* Contact / Address */}
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-sm">Contact (mobile)</span>
              <input value={contact} onChange={(e)=>setContact(e.target.value)} className="border rounded px-2 py-2 w-full" />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Address (city only)</span>
              <input value={address} onChange={(e)=>setAddress(e.target.value)} className="border rounded px-2 py-2 w-full" />
            </label>
          </div>

          {/* Tests Picker */}
          <label className="space-y-1 block">
            <span className="text-sm">Requested tests / packages</span>
            <TestPicker value={requested} onChange={setRequested} />
          </label>

          {/* PhilHealth + Queue */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={yakap} onChange={(e)=>setYakap(e.target.checked)} />
              PhilHealth (YAKAP)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={queueNow} onChange={(e)=>setQueueNow(e.target.checked)} />
              Queue now for extraction
            </label>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-3 gap-3 items-end">
            <div>
              <div className="text-sm text-gray-600 mb-1">Auto Total</div>
              <div className="font-semibold">₱ {liveTotals.auto.toFixed(2)}</div>
            </div>
            <label className="space-y-1">
              <span className="text-sm">Manual add (optional)</span>
              <input
                type="number"
                step="0.01"
                min={0}
                value={manualAdd}
                onChange={(e)=>setManualAdd(Number(e.target.value))}
                className="border rounded px-2 py-2 w-full"
                placeholder="0.00"
              />
            </label>
            <div>
              <div className="text-sm text-gray-600 mb-1">Final Total</div>
              <div className="text-xl font-bold">₱ {liveTotals.final.toFixed(2)}</div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              className="rounded px-4 py-2 bg-accent text-white disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      {/* Today list (Reception view-only) */}
      <section className="space-y-2">
        <h2 className="font-semibold">Today’s Patients</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Patient ID</th>
                <th className="py-2 pr-3">Full name</th>
                <th className="py-2 pr-3">Contact</th>
                <th className="py-2 pr-3">Tests / Packages</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((x: any) => (
                <tr key={x.id} className="border-b align-top">
                  <td className="py-2 pr-3">{x.patient_id}</td>
                  <td className="py-2 pr-3">{x.full_name}</td>
                  <td className="py-2 pr-3">{x.contact || "-"}</td>
                  <td className="py-2 pr-3 whitespace-pre-wrap">{x.notes_frontdesk || "-"}</td>
                  <td className="py-2 pr-3 font-semibold">
                    ₱ {Number(x.total_price || 0).toFixed(2)}
                    {x.yakap_flag && (
                      <span
                        className="ml-2 inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs"
                        title="PhilHealth (YAKAP)"
                      >
                        PhilHealth
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {role === "admin" && (
                      <button
                        onClick={() => openEdit(x.id)}
                        className="border rounded px-2 py-1"
                        title="Edit tests & price"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                  
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td className="py-6 text-gray-500" colSpan={5}>No patients yet today.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Edit Encounter</h3>
              <button onClick={() => setEditOpen(false)} className="text-gray-500">✕</button>
            </div>

            <label className="space-y-1 block">
              <span className="text-sm">Requested tests / packages (CSV)</span>
              <input
                className="border rounded px-2 py-2 w-full"
                value={editCsv}
                onChange={(e)=>setEditCsv(e.target.value)}
                placeholder="e.g., CBC, FBS, COMP"
              />
            </label>

            <label className="space-y-1 block">
              <span className="text-sm">Manual add (optional)</span>
              <input
                type="number"
                step="0.01"
                min={0}
                className="border rounded px-2 py-2 w-full"
                value={editManual}
                onChange={(e)=>setEditManual(Number(e.target.value))}
              />
            </label>

            <div className="flex justify-end gap-2">
              <button onClick={()=>setEditOpen(false)} className="border rounded px-3 py-2">Cancel</button>
              <button
                onClick={saveEdit}
                className="rounded px-4 py-2 bg-accent text-white disabled:opacity-60"
                disabled={editSaving}
              >
                {editSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
