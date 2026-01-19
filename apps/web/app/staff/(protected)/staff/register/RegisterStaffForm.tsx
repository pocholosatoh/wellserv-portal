// app/staff/(protected)/staff/register/RegisterStaffForm.tsx
"use client";

import { useMemo, useState } from "react";
import { parseStaffLoginCode } from "@/lib/auth/staffCode";

type SuccessInfo = { staff_no: string; login_code: string };

export default function RegisterStaffForm() {
  const [loginCode, setLoginCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [sex, setSex] = useState("F");
  const [credentials, setCredentials] = useState("");
  const [prcNumber, setPrcNumber] = useState("");
  const [positionTitle, setPositionTitle] = useState("");
  const [dateStarted, setDateStarted] = useState("");
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const fieldClass =
    "mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-transparent";
  const checkboxClass =
    "h-4 w-4 rounded border-gray-300 text-accent focus:ring-2 focus:ring-accent/30 focus:ring-offset-1 focus:ring-offset-white";

  const age = useMemo(() => {
    if (!birthday) return "";
    const b = new Date(birthday);
    if (Number.isNaN(b.getTime())) return "";
    const now = new Date();
    let years = now.getFullYear() - b.getFullYear();
    const beforeBirthday =
      now.getMonth() < b.getMonth() ||
      (now.getMonth() === b.getMonth() && now.getDate() < b.getDate());
    if (beforeBirthday) years -= 1;
    return years >= 0 && Number.isFinite(years) ? years : "";
  }, [birthday]);

  function validateLocally() {
    try {
      parseStaffLoginCode(loginCode);
    } catch (e: any) {
      return e?.message || "Invalid login code.";
    }
    if (!firstName.trim() || !lastName.trim() || !middleName.trim()) {
      return "First, middle, and last name are required.";
    }
    if (!birthday) return "Birthday is required.";
    if (!sex) return "Sex is required.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const localErr = validateLocally();
    if (localErr) {
      setError(localErr);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/staff/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login_code: loginCode.trim().toUpperCase(),
          first_name: firstName.trim(),
          middle_name: middleName.trim(),
          last_name: lastName.trim(),
          birthday,
          sex,
          credentials: credentials.trim() || null,
          prc_number: prcNumber.trim() || null,
          position_title: positionTitle.trim() || null,
          date_started: dateStarted || null,
          active,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        throw new Error(j?.error || "Failed to register staff");
      }
      setSuccess({ staff_no: j.staff_no, login_code: j.login_code });
      setLoginCode("");
      setFirstName("");
      setMiddleName("");
      setLastName("");
      setBirthday("");
      setSex("F");
      setCredentials("");
      setPrcNumber("");
      setPositionTitle("");
      setDateStarted("");
      setActive(true);
    } catch (err: any) {
      setError(err?.message || "Failed to register staff");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm text-gray-700">Login Code</span>
          <input
            value={loginCode}
            onChange={(e) => setLoginCode(e.target.value.toUpperCase())}
            className={`${fieldClass} uppercase`}
            placeholder="ADM-CHL / REC-ANN / RMT-JDS"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Sex</span>
          <select
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            className={fieldClass}
            required
          >
            <option value="F">Female</option>
            <option value="M">Male</option>
            <option value="X">Prefer not to say</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-sm text-gray-700">First Name</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={fieldClass}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Middle Name</span>
          <input
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
            className={fieldClass}
            placeholder="Middle name"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Last Name</span>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={fieldClass}
            required
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-2">
          <span className="text-sm text-gray-700">Birthday</span>
          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            className={fieldClass}
            required
          />
        </label>
        <div>
          <span className="text-sm text-gray-700">Age</span>
          <div className="mt-1 flex h-[52px] items-center rounded-lg border bg-gray-50 px-3 text-gray-700">
            {age !== "" ? `${age} yrs` : "—"}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm text-gray-700">Credentials (optional)</span>
          <input
            value={credentials}
            onChange={(e) => setCredentials(e.target.value)}
            className={fieldClass}
            placeholder="RMT, MD"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">PRC No. (optional)</span>
          <input
            value={prcNumber}
            onChange={(e) => setPrcNumber(e.target.value)}
            className={fieldClass}
            placeholder="PRC Number"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm text-gray-700">Position Title (optional)</span>
          <input
            value={positionTitle}
            onChange={(e) => setPositionTitle(e.target.value)}
            className={fieldClass}
            placeholder="Medtech / Reception"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Date Started (optional)</span>
          <input
            type="date"
            value={dateStarted}
            onChange={(e) => setDateStarted(e.target.value)}
            className={fieldClass}
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className={checkboxClass}
        />
        Active (can log in)
      </label>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg border border-transparent bg-accent p-3 text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:opacity-60"
      >
        {loading ? "Saving…" : "Register Staff"}
      </button>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {success && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 space-y-1">
          <div className="font-semibold">Staff saved</div>
          <div>Staff No: {success.staff_no}</div>
          <div>Login Code: {success.login_code}</div>
          <div className="text-xs text-emerald-800">
            Remind them to set their PIN on the Set PIN page before first login.
          </div>
        </div>
      )}
    </form>
  );
}
