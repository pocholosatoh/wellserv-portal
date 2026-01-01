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
function up(s?: string) {
  return (s || "").toUpperCase();
}
function getCookie(name: string) {
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : "";
}

function flagOn(name: string) {
  return (
    (typeof window !== "undefined" ? (window as any)?.__env__?.[name] : undefined) ??
    (typeof process !== "undefined" ? (process.env as any)?.[name] : undefined) ??
    (getCookie(name) || "")
  );
}

/** Price helpers on client (for live display only; server recomputes for truth) */
type Catalog = {
  tests: { id: string; code: string; name: string; price?: number | null }[];
  packages: { id: string; code: string; name: string; price?: number | null }[];
  packageMap: Record<string, string[]>;
  packageMapById: Record<string, string[]>;
};

const DISCOUNT_RATE = 0.2;
const QUICK_ADD_CODES = {
  consult: { promo: "CONSULT-P", regular: "CONSULT-R" },
  ecg: { promo: "ECG-P", regular: "ECG-R" },
};

function parseCsvTokens(value: string) {
  return (value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function serializeCsvTokens(tokens: string[]) {
  return tokens.join(", ");
}

function removeTokenCodes(tokens: string[], codes: string[]) {
  const removeSet = new Set(codes.map((c) => c.toUpperCase()));
  return tokens.filter((t) => !removeSet.has(t.toUpperCase()));
}

function replaceTokenCodes(tokens: string[], codes: string[], nextCode: string) {
  const removeSet = new Set(codes.map((c) => c.toUpperCase()));
  let insertIndex = -1;
  const next: string[] = [];

  tokens.forEach((t) => {
    if (removeSet.has(t.toUpperCase())) {
      if (insertIndex === -1) insertIndex = next.length;
      return;
    }
    next.push(t);
  });

  if (insertIndex === -1) {
    next.push(nextCode);
  } else {
    next.splice(insertIndex, 0, nextCode);
  }

  return next;
}

export default function Reception() {
  const router = useRouter();

  // branch lock
  const [branch, setBranch] = useState<"SI" | "SL" | "">("");
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
  const [discountEnabled, setDiscountEnabled] = useState(false);

  const [requested, setRequested] = useState(""); // CSV string
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [manualAdd, setManualAdd] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<string>("");

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<any | null>(null);
  const [editCsv, setEditCsv] = useState("");
  const [editManual, setEditManual] = useState<number>(0);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [quickAddWarning, setQuickAddWarning] = useState<string | null>(null);

  // Konsulta / Claim toggles (Edit modal)
  const [editPhilhealth, setEditPhilhealth] = useState<boolean>(false);
  const [editDiscountEnabled, setEditDiscountEnabled] = useState(false);

  async function openEdit(id: string) {
    try {
      const r = await fetch(`/api/staff/encounters/get?id=${id}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Load failed");
      setEditRow(j.row);
      setEditCsv(j.row?.notes_frontdesk || "");
      setEditManual(Number(j.row?.price_manual_add || 0));
      setEditPhilhealth(!!(j.row?.yakap_flag || j.row?.is_philhealth_claim));
      setEditDiscountEnabled(!!j.row?.discount_enabled);
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
          discount_enabled: editDiscountEnabled,
          yakap_flag: editPhilhealth,
          is_philhealth_claim: editPhilhealth,
        }),
      });
      const j = await resp.json();
      if (!resp.ok || !j?.ok) throw new Error(j?.error || "Save failed");
      setEditOpen(false);
      setEditRow(null);
      await loadTodayList(branch as "SI" | "SL");
    } catch (e: any) {
      alert(e?.message || "Failed to save");
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteEncounter() {
    if (!editRow?.id || deleteBusy) return;
    const ok = confirm("Delete this intake from today’s list? This removes it from the database.");
    if (!ok) return;
    setDeleteBusy(true);
    try {
      const resp = await fetch("/api/staff/encounters/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: editRow.id }),
      });
      const j = await resp.json();
      if (!resp.ok || !j?.ok) throw new Error(j?.error || "Delete failed");
      setEditOpen(false);
      setEditRow(null);
      if (branch === "SI" || branch === "SL") {
        await Promise.all([loadTodayList(branch), loadConsultQueue(branch)]);
      }
    } catch (e: any) {
      alert(e?.message || "Failed to delete");
    } finally {
      setDeleteBusy(false);
    }
  }

  useEffect(() => {
    setRole((getCookie("staff_role") || "").toLowerCase());
  }, []);

  // UI toggles
  const [openForm, setOpenForm] = useState(false);
  const [lookupBadge, setLookupBadge] = useState<null | string>(null);

  // catalog for live pricing
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  useEffect(() => {
    // branch from cookies (guard ALL => require explicit choice)
    const b = (readCookie("staff_branch") || "").toUpperCase();
    if (b === "SI" || b === "SL") {
      setBranch(b as "SI" | "SL");
      setBranchLocked(true);
    } else {
      setBranch(""); // require selection
      setBranchLocked(false);
    }

    // fetch catalog
    (async () => {
      try {
        const res = await fetch("/api/catalog/lab");
        const j = await res.json();
        if (res.ok) setCatalog(j);
      } catch {}
    })();
  }, []);

  // initial loads
  useEffect(() => {
    if (branch === "SI" || branch === "SL") {
      loadTodayList(branch);
      loadConsultQueue(branch);
    }
  }, [branch]);

  // PID generator
  useEffect(() => {
    const mmddyy = toMMDDYY(birthday);
    const sur = up(surname).replace(/[^A-Z]/g, "");
    setPid(sur && mmddyy ? `${sur}${mmddyy}` : "");
  }, [surname, birthday]);

  // auto-lookup
  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      if (!pid || pid.length < 6) return;
      try {
        const res = await fetch(`/api/staff/patients/lookup?patient_id=${pid}`, {
          signal: ctrl.signal,
        });
        const j = await res.json();
        if (res.ok && j?.found) {
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
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [pid]);

  const requestedTokens = useMemo(() => parseCsvTokens(requested), [requested]);
  const requestedTokenUpper = useMemo(
    () => new Set(requestedTokens.map((t) => t.toUpperCase())),
    [requestedTokens],
  );
  const packageIdByCode = useMemo(() => {
    const map = new Map<string, string>();
    (catalog?.packages || []).forEach((p) => map.set(p.code.toUpperCase(), p.id));
    return map;
  }, [catalog]);

  const testIdByCode = useMemo(() => {
    const map = new Map<string, string>();
    (catalog?.tests || []).forEach((t) => map.set(t.code.toUpperCase(), t.id));
    return map;
  }, [catalog]);

  const packagePriceById = useMemo(() => {
    const map = new Map<string, number>();
    (catalog?.packages || []).forEach((p) => map.set(p.id, Number(p.price || 0)));
    return map;
  }, [catalog]);

  const testPriceById = useMemo(() => {
    const map = new Map<string, number>();
    (catalog?.tests || []).forEach((t) => map.set(t.id, Number(t.price || 0)));
    return map;
  }, [catalog]);

  const hasPromoPackageSelected = useMemo(() => {
    for (const pkgId of selectedPackageIds) {
      const price = packagePriceById.get(pkgId);
      if (price != null && price >= 999) return true;
    }
    return false;
  }, [selectedPackageIds, packagePriceById]);

  const consultChecked =
    requestedTokenUpper.has(QUICK_ADD_CODES.consult.promo) ||
    requestedTokenUpper.has(QUICK_ADD_CODES.consult.regular);
  const ecgChecked =
    requestedTokenUpper.has(QUICK_ADD_CODES.ecg.promo) ||
    requestedTokenUpper.has(QUICK_ADD_CODES.ecg.regular);

  useEffect(() => {
    if (!consultChecked && !ecgChecked) return;
    let nextTokens = requestedTokens;
    let changed = false;

    if (consultChecked) {
      const target = hasPromoPackageSelected
        ? QUICK_ADD_CODES.consult.promo
        : QUICK_ADD_CODES.consult.regular;
      if (!ensureQuickAddCodeExists(target)) return;
      nextTokens = replaceTokenCodes(
        nextTokens,
        [QUICK_ADD_CODES.consult.promo, QUICK_ADD_CODES.consult.regular],
        target,
      );
      changed = true;
    }

    if (ecgChecked) {
      const target = hasPromoPackageSelected
        ? QUICK_ADD_CODES.ecg.promo
        : QUICK_ADD_CODES.ecg.regular;
      if (!ensureQuickAddCodeExists(target)) return;
      nextTokens = replaceTokenCodes(
        nextTokens,
        [QUICK_ADD_CODES.ecg.promo, QUICK_ADD_CODES.ecg.regular],
        target,
      );
      changed = true;
    }

    const nextCsv = serializeCsvTokens(nextTokens);
    if (nextCsv !== requested) setRequested(nextCsv);
    if (changed) setQuickAddWarning(null);
  }, [
    consultChecked,
    ecgChecked,
    hasPromoPackageSelected,
    requestedTokens,
    requested,
    packageIdByCode,
    testIdByCode,
  ]);

  // Live pricing preview
  const liveTotals = useMemo(() => {
    const packageMapById = catalog?.packageMapById || {};
    let packageTotal = 0;
    const packageMemberSet = new Set<string>();
    for (const pkgId of selectedPackageIds) {
      const price = packagePriceById.get(pkgId);
      if (price != null) packageTotal += price;
      const members = packageMapById[pkgId];
      if (members) members.forEach((m) => packageMemberSet.add(String(m)));
    }

    const nonPackageTestIds = new Set<string>();
    for (const testId of selectedTestIds) {
      if (packageMemberSet.has(testId)) continue;
      if (testPriceById.has(testId)) nonPackageTestIds.add(testId);
    }

    let nonPackageTestsTotal = 0;
    for (const testId of nonPackageTestIds) {
      nonPackageTestsTotal += testPriceById.get(testId)!;
    }

    const manualRaw = Number(manualAdd || 0);
    const manual = Math.max(0, Number.isFinite(manualRaw) ? manualRaw : 0);
    const discountBase = nonPackageTestsTotal + manual;
    const discount = discountEnabled ? Math.round(discountBase * DISCOUNT_RATE) : 0;

    const grossTotal = packageTotal + nonPackageTestsTotal + manual;
    const auto = Math.round(packageTotal + nonPackageTestsTotal);
    const manualRounded = Math.round(manual);
    const final = Math.round(grossTotal - discount);

    return { auto, manual: manualRounded, discount, final };
  }, [
    catalog,
    selectedPackageIds,
    selectedTestIds,
    packagePriceById,
    testPriceById,
    manualAdd,
    discountEnabled,
  ]);

  function resolveQuickAddId(code: string) {
    const key = code.toUpperCase();
    return packageIdByCode.get(key) || testIdByCode.get(key) || null;
  }

  function ensureQuickAddCodeExists(code: string) {
    if (!catalog) {
      setQuickAddWarning("Catalog not loaded yet. Please retry.");
      return false;
    }
    const id = resolveQuickAddId(code);
    if (!id) {
      setQuickAddWarning(`Quick add code "${code}" not found in catalog.`);
      return false;
    }
    return true;
  }

  function updateQuickAdd(kind: "consult" | "ecg", nextChecked: boolean) {
    const codes = QUICK_ADD_CODES[kind];
    const removeCodes = [codes.promo, codes.regular];
    let nextTokens = requestedTokens;

    if (nextChecked) {
      const target = hasPromoPackageSelected ? codes.promo : codes.regular;
      if (!ensureQuickAddCodeExists(target)) return;
      nextTokens = replaceTokenCodes(nextTokens, removeCodes, target);
      setQuickAddWarning(null);
    } else {
      nextTokens = removeTokenCodes(nextTokens, removeCodes);
    }

    setRequested(serializeCsvTokens(nextTokens));
  }

  // Data loaders
  const [list, setList] = useState<any[]>([]);
  async function loadTodayList(b: "SI" | "SL") {
    try {
      const res = await fetch(`/api/staff/encounters/today?branch=${b}`, { cache: "no-store" });
      const j = await res.json();
      if (res.ok) setList(j.rows || []);
    } catch {}
  }

  const [consultList, setConsultList] = useState<any[]>([]);
  const [cqBusy, setCqBusy] = useState(false);

  async function loadConsultQueue(b: "SI" | "SL") {
    try {
      const res = await fetch(`/api/staff/encounters/today?branch=${b}&consultOnly=1`, {
        cache: "no-store",
      });
      const j = await res.json();
      if (res.ok) setConsultList(j.rows || []);
    } catch {}
  }

  async function toggleConsult(encounterId: string, enable: boolean) {
    setCqBusy(true);
    try {
      const res = await fetch("/api/staff/encounters/consult/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ encounter_id: encounterId, branch, enable }),
      });
      const j = await res.json();
      if (!res.ok || j?.error) throw new Error(j?.error || "Toggle failed");
      await loadConsultQueue(branch as "SI" | "SL");
    } catch (e: any) {
      alert(e?.message || "Toggle failed");
    } finally {
      setCqBusy(false);
    }
  }

  function makeReorderedIds(list: any[], idx: number, dir: "up" | "down") {
    const arr = [...list];
    const swapWith = dir === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= arr.length) return null;
    const tmp = arr[idx];
    arr[idx] = arr[swapWith];
    arr[swapWith] = tmp;
    return arr.map((x) => x.id);
  }

  async function reorderConsult(ids: string[]) {
    setCqBusy(true);
    try {
      const res = await fetch("/api/staff/encounters/consult/reorder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ branch, ids }),
      });
      const j = await res.json();
      if (!res.ok || j?.error) throw new Error(j?.error || "Reorder failed");
      await loadConsultQueue(branch as "SI" | "SL");
    } catch (e: any) {
      alert(e?.message || "Reorder failed");
    } finally {
      setCqBusy(false);
    }
  }

  // Save handler with loud post-submit feedback
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (branch !== "SI" && branch !== "SL") {
      alert("Please select a branch (SI or SL).");
      return;
    }
    if (!pid || !birthday) {
      alert("Complete the patient details first.");
      return;
    }

    setSaving(true);
    const full_name = `${up(surname)}, ${up(firstname)}`.trim();

    // Build the common payload you already send
    const basePayload = {
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
      package_ids: selectedPackageIds,
      test_ids: selectedTestIds,
      yakap_flag: yakap,
      price_manual_add: Number(manualAdd || 0),
      discount_enabled: discountEnabled,
      queue_now: queueNow,
    };

    // Feature flag: require encounter first (runtime via cookie/window.__env__/process)
    const sendEncounter =
      String(flagOn("NEXT_PUBLIC_RECEPTION_WRITE_ENCOUNTER_ID")).toLowerCase() === "true";

    try {
      let encounter_id: string | undefined;

      if (sendEncounter) {
        // 1) Create or fetch the encounter FIRST
        const encRes = await fetch("/api/staff/encounters/create-or-get", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            branch_code: branch,
            policy: "today-same-branch",
            // ✅ Send full patient block so server can UPSERT new patients
            patient: {
              patient_id: pid,
              full_name,
              sex,
              birthday_mmddyyyy: birthday,
              contact,
              address,
            },
            // Optional context that your endpoint will persist on the new encounter
            requested_tests_csv: requested || "",
            yakap_flag: !!yakap,
          }),
        });

        const encJ = await encRes.json();
        if (!encRes.ok || !encJ?.ok || !encJ?.encounter_id) {
          throw new Error(encJ?.error || "Could not create encounter; please retry.");
        }
        encounter_id = encJ.encounter_id;
      }

      // 2) Now call your existing intake endpoint, including encounter_id when available
      const res = await fetch("/api/staff/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...basePayload, ...(encounter_id ? { encounter_id } : {}) }),
      });
      const j = await res.json();

      if (!res.ok || !j?.ok) throw new Error(j?.error || "Failed to save");

      // Loud feedback on Sheets append (unchanged UX)
      if (j.sheet_status === "ok") {
        alert("✅ Saved. Running sheet updated successfully.");
      } else if (j.sheet_status === "skipped") {
        alert(
          "⚠️ Saved, but NOT appended to the running sheet.\n" +
            (j.sheet_reason || "Sheets append was skipped by the server."),
        );
      } else if (j.sheet_status === "failed") {
        alert(
          "❌ Saved, but running sheet APPEND FAILED.\n" +
            (j.sheet_error || "See server logs for details."),
        );
      }

      // Reset form (same as today)
      setSurname("");
      setFirstname("");
      setSex("M");
      setBirthday("");
      setContact("");
      setAddress("");
      setPid("");
      setRequested("");
      setSelectedPackageIds([]);
      setSelectedTestIds([]);
      setManualAdd(0);
      setYakap(false);
      setQueueNow(false);
      setDiscountEnabled(false);
      setLookupBadge(null);
      setOpenForm(false);

      // Refresh lists
      if (branch === "SI" || branch === "SL") {
        await loadTodayList(branch);
        await loadConsultQueue(branch);
      }
    } catch (err: any) {
      alert(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const saveDisabled =
    saving ||
    !(branch === "SI" || branch === "SL") ||
    !surname.trim() ||
    !firstname.trim() ||
    !birthday ||
    !pid;

  return (
    <main className="mx-auto max-w-4xl p-3 md:p-4 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-semibold">
          Reception {branch ? `— ${branch}` : ""}
        </h1>
        <button
          className="w-full rounded border px-3 py-2 text-sm hover:bg-gray-50 md:text-base sm:w-auto"
          onClick={() => setOpenForm((x) => !x)}
        >
          {openForm ? "Hide Intake Form" : "New / Update (Toggle)"}
        </button>
      </header>

      {/* Collapsible Intake Panel */}
      {openForm && (
        <form onSubmit={handleSubmit} className="space-y-4 border rounded p-3 md:p-4">
          {/* Branch select (locked unless ALL) */}
          <label className="block text-sm">
            <span className="text-sm">Branch</span>
            <select
              value={branch}
              disabled={branchLocked}
              onChange={(e) => setBranch(e.target.value as any)}
              className="border rounded px-2 py-2 w-full"
              required
            >
              <option value="" disabled>
                Select branch…
              </option>
              <option value="SI">San Isidro (SI)</option>
              <option value="SL">San Leonardo (SL)</option>
            </select>
            {(!branch || (branch !== "SI" && branch !== "SL")) && (
              <div className="text-xs text-rose-600 mt-1">Branch is required.</div>
            )}
          </label>

          {/* Names */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-sm">Surname</span>
              <input
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                className="border rounded px-2 py-2 w-full"
                required
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm">First name</span>
              <input
                value={firstname}
                onChange={(e) => setFirstname(e.target.value)}
                className="border rounded px-2 py-2 w-full"
                required
              />
            </label>
          </div>

          {/* PID + badges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="space-y-1">
              <span className="text-sm">Patient ID</span>
              <input value={pid} readOnly className="border rounded px-2 py-2 w-full bg-gray-50" />
              {lookupBadge && <div className="text-xs text-emerald-700 mt-1">{lookupBadge}</div>}
            </label>

            <label className="space-y-1">
              <span className="text-sm">Sex</span>
              <select
                value={sex}
                onChange={(e) => setSex(e.target.value as any)}
                className="border rounded px-2 py-2 w-full"
              >
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm">Birthday (MM/DD/YYYY)</span>
              <input
                value={birthday}
                onChange={(e) => setBirthday(maskMMDDYYYY(e.target.value))}
                className="border rounded px-2 py-2 w-full"
                inputMode="numeric"
                maxLength={10}
                placeholder="MM/DD/YYYY"
                required
              />
            </label>
          </div>

          {/* Contact / Address */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-sm">Contact (mobile)</span>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="border rounded px-2 py-2 w-full"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm">Address (city only)</span>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="border rounded px-2 py-2 w-full"
              />
            </label>
          </div>

          {/* Tests Picker */}
          <label className="space-y-1 block">
            <span className="text-sm">Requested tests / packages</span>
            <TestPicker
              value={requested}
              onChange={setRequested}
              onSelectionChange={(next) => {
                setSelectedPackageIds(next.packageIds);
                setSelectedTestIds(next.testIds);
              }}
            />
          </label>

          {/* Quick Add */}
          <div className="rounded border bg-slate-50 p-3 space-y-2">
            <div className="text-sm font-medium">Quick Add</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={consultChecked}
                  onChange={(e) => updateQuickAdd("consult", e.target.checked)}
                />
                Consult{" "}
                <span className="text-xs text-gray-500">
                  ({hasPromoPackageSelected ? "Promo" : "Regular"})
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={ecgChecked}
                  onChange={(e) => updateQuickAdd("ecg", e.target.checked)}
                />
                ECG{" "}
                <span className="text-xs text-gray-500">
                  ({hasPromoPackageSelected ? "Promo" : "Regular"})
                </span>
              </label>
            </div>
          <div className="text-xs text-gray-500">
            Auto-uses promo when any package with price 999+ is selected.
          </div>
          {quickAddWarning && <div className="text-xs text-amber-700">{quickAddWarning}</div>}
        </div>

          {/* PhilHealth + Queue */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={yakap} onChange={(e) => setYakap(e.target.checked)} />
              PhilHealth (YAKAP)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={discountEnabled}
                onChange={(e) => setDiscountEnabled(e.target.checked)}
              />
              Apply Discount (Senior/PWD)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={queueNow}
                onChange={(e) => setQueueNow(e.target.checked)}
              />
              Queue now for extraction
            </label>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
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
                onChange={(e) => setManualAdd(Number(e.target.value))}
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
              disabled={saveDisabled}
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
                    {(x.yakap_flag || x.is_philhealth_claim) && (
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
                    <button
                      onClick={() => toggleConsult(x.id, true)}
                      className="ml-2 border rounded px-2 py-1"
                      title="Add to Consult Queue"
                    >
                      To Consult
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td className="py-6 text-gray-500" colSpan={6}>
                    No patients yet today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ===================== CONSULT QUEUE (Doctor) ===================== */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Consult Queue (Today) {branch ? `— ${branch}` : ""}</h2>
          <button
            className="rounded px-3 py-1.5 border hover:bg-gray-50 disabled:opacity-60"
            onClick={() => branch && loadConsultQueue(branch as "SI" | "SL")}
            disabled={cqBusy}
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3 w-14">#</th>
                <th className="py-2 pr-3">Patient</th>
                <th className="py-2 pr-3">Contact</th>
                <th className="py-2 pr-3">Yakap</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {consultList.map((r, idx) => (
                <tr key={r.id} className="border-b">
                  <td className="py-2 pr-3 font-semibold">{r.queue_number ?? "-"}</td>
                  <td className="py-2 pr-3">
                    <div className="font-medium">{r.full_name || r.patient_id}</div>
                    <div className="text-xs text-gray-500">{r.patient_id}</div>
                  </td>
                  <td className="py-2 pr-3">{r.contact || "-"}</td>
                  <td className="py-2 pr-3">
                    {r.yakap_flag ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs">
                        PhilHealth
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-2 pr-3">{r.consult_status || "-"}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2 justify-center">
                      <button
                        className="border rounded px-2 py-1 disabled:opacity-50"
                        disabled={cqBusy || idx === 0}
                        onClick={async () => {
                          const ids = makeReorderedIds(consultList, idx, "up");
                          if (ids) await reorderConsult(ids);
                        }}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        className="border rounded px-2 py-1 disabled:opacity-50"
                        disabled={cqBusy || idx === consultList.length - 1}
                        onClick={async () => {
                          const ids = makeReorderedIds(consultList, idx, "down");
                          if (ids) await reorderConsult(ids);
                        }}
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        className="border rounded px-2 py-1 disabled:opacity-50"
                        disabled={cqBusy}
                        onClick={() => toggleConsult(r.id, false)}
                        title="Remove from consult queue"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {consultList.length === 0 && (
                <tr>
                  <td className="py-6 text-gray-500" colSpan={6}>
                    No patients in consult queue yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Edit Encounter</h3>
              <button onClick={() => setEditOpen(false)} className="text-gray-500">
                ✕
              </button>
            </div>

            <label className="space-y-1 block">
              <span className="text-sm">Requested tests / packages (CSV)</span>
              <input
                className="border rounded px-2 py-2 w-full"
                value={editCsv}
                onChange={(e) => setEditCsv(e.target.value)}
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
                onChange={(e) => setEditManual(Number(e.target.value))}
              />
            </label>

            {/* Unified PhilHealth (YAKAP) toggle — writes to both yakap_flag & is_philhealth_claim */}
            <div className="flex items-center gap-6 pt-1">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={editPhilhealth}
                  onChange={(e) => setEditPhilhealth(e.target.checked)}
                />
                <span>PhilHealth (YAKAP)</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={editDiscountEnabled}
                  onChange={(e) => setEditDiscountEnabled(e.target.checked)}
                />
                <span>Apply Discount (Senior/PWD)</span>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setEditOpen(false)} className="border rounded px-3 py-2">
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="rounded px-4 py-2 bg-accent text-white disabled:opacity-60"
                disabled={editSaving || deleteBusy}
              >
                {editSaving ? "Saving…" : "Save changes"}
              </button>
              <button
                onClick={deleteEncounter}
                className="rounded px-4 py-2 border border-rose-500 text-rose-600 disabled:opacity-60"
                disabled={editSaving || deleteBusy}
              >
                {deleteBusy ? "Deleting…" : "Delete intake"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
