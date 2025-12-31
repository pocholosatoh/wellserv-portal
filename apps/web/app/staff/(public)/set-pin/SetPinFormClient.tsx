// app/staff/(public)/set-pin/SetPinFormClient.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { parseStaffLoginCode } from "@/lib/auth/staffCode";

type Stage = "identify" | "pin" | "done";

export default function SetPinFormClient() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("identify");
  const [loginCode, setLoginCode] = useState("");
  const [birthday, setBirthday] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staffNo, setStaffNo] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fieldClass =
    "mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent";
  const primaryButtonClass =
    "w-full rounded-lg border border-transparent bg-accent p-3 text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:opacity-60";

  useEffect(() => {
    setMessage(null);
  }, [stage]);

  function validateLookup() {
    if (!birthday) return "Birthday is required.";
    try {
      parseStaffLoginCode(loginCode);
    } catch (e: any) {
      return e?.message || "Invalid login code.";
    }
    return null;
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const localErr = validateLookup();
    if (localErr) {
      setError(localErr);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/staff/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login_code: loginCode.trim().toUpperCase(),
          birthday,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        throw new Error(j?.error || "Lookup failed");
      }
      setStaffNo(j.staff_no || null);
      setLoginCode((j.login_code || loginCode).toUpperCase());
      setStage("pin");
    } catch (err: any) {
      setError(err?.message || "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  function validatePinInputs() {
    if (!/^[0-9]{4}$/.test(pin.trim())) return "PIN must be exactly 4 digits.";
    if (
      [
        "0000",
        "1234",
        "1111",
        "2222",
        "3333",
        "4444",
        "5555",
        "6666",
        "7777",
        "8888",
        "9999",
      ].includes(pin.trim())
    ) {
      return "Please avoid obvious PINs like 0000 or 1234.";
    }
    if (pin.trim() !== confirmPin.trim()) return "PIN entries must match.";
    return null;
  }

  async function handleSetPin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const localErr = validatePinInputs();
    if (localErr) {
      setError(localErr);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/staff/set-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login_code: loginCode.trim().toUpperCase(),
          birthday,
          pin: pin.trim(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        throw new Error(j?.error || "Unable to set PIN");
      }
      setMessage("PIN saved. Redirecting to login…");
      setStage("done");
      setTimeout(() => {
        router.replace("/staff/login");
        router.refresh();
      }, 900);
    } catch (err: any) {
      setError(err?.message || "Unable to set PIN");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center p-4">
      <div className="w-full max-w-lg rounded-2xl border bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Staff Portal</p>
            <h1 className="text-xl font-semibold text-gray-900">First-time PIN Setup</h1>
          </div>
          <Link href="/staff/login" className="text-xs text-accent font-semibold hover:underline">
            Back to Login
          </Link>
        </div>

        {stage === "identify" && (
          <form onSubmit={handleLookup} className="space-y-3">
            <p className="text-sm text-gray-600">
              Confirm your identity with your login code and birthday to start.
            </p>
            <label className="block">
              <span className="text-sm text-gray-700">Login Code</span>
              <input
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value.toUpperCase())}
                className={`${fieldClass} uppercase`}
                placeholder="ADM-CHL / REC-ANN / RMT-JDS"
                autoComplete="off"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Birthday</span>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className={fieldClass}
                required
              />
            </label>
            <button type="submit" disabled={loading} className={primaryButtonClass}>
              {loading ? "Checking…" : "Continue"}
            </button>
          </form>
        )}

        {stage === "pin" && (
          <form onSubmit={handleSetPin} className="space-y-3">
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-gray-700">
              <div className="font-semibold">Verified</div>
              <div>Staff No: {staffNo || "—"}</div>
              <div>Login Code: {loginCode}</div>
            </div>
            <label className="block">
              <span className="text-sm text-gray-700">New PIN</span>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className={fieldClass}
                placeholder="4 digits"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Confirm PIN</span>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className={fieldClass}
                placeholder="Re-enter PIN"
                required
              />
            </label>
            <button type="submit" disabled={loading} className={primaryButtonClass}>
              {loading ? "Saving…" : "Save PIN"}
            </button>
          </form>
        )}

        {stage === "done" && (
          <div className="space-y-3">
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message || "PIN saved. You can now log in."}
            </div>
            <Link
              href="/staff/login"
              className="block rounded-lg border border-transparent bg-accent p-3 text-center text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white"
            >
              Go to Login
            </Link>
          </div>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>
    </div>
  );
}
