// app/staff/(public)/login/LoginFormClient.tsx
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { parseStaffLoginCode } from "@/lib/auth/staffCode";

const BRANCHES: Array<{ key: "SI" | "SL" | "ALL"; label: string }> = [
  { key: "SI", label: "San Isidro" },
  { key: "SL", label: "San Leonardo" },
  { key: "ALL", label: "All Branches" },
];

export default function LoginFormClient() {
  const router = useRouter();
  const search = useSearchParams();
  const nextPath = search.get("next") || "/staff";

  const [loginCode, setLoginCode] = useState("");
  const [pin, setPin] = useState("");
  const [branch, setBranch] = useState<"SI" | "SL" | "ALL">("SI");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsPin, setNeedsPin] = useState(false);
  const fieldClass =
    "mt-1 w-full rounded-lg border border-gray-300 bg-white p-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent";
  const buttonClass =
    "rounded-lg border border-gray-300 bg-white px-3 py-2 text-center shadow-sm transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white";

  function validateLocally() {
    try {
      parseStaffLoginCode(loginCode);
    } catch (e: any) {
      return e?.message || "Invalid login code.";
    }
    if (!/^[0-9]{4}$/.test(pin.trim())) return "PIN must be 4 digits.";
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNeedsPin(false);
    const localErr = validateLocally();
    if (localErr) {
      setError(localErr);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login_code: loginCode.trim().toUpperCase(),
          pin: pin.trim(),
          branch,
          remember,
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        if (j?.needsPinSetup) {
          setNeedsPin(true);
        }
        throw new Error(j?.error || "Login failed");
      }

      router.replace(nextPath);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm space-y-4"
      >
        <img
          src="/logo.png"
          alt="WELLSERV"
          className="block h-40 w-auto max-w-[260px] object-contain mx-auto pointer-events-none select-none"
        />
        <h1 className="text-2xl font-semibold text-center">Staff Login</h1>
        <p className="text-sm text-gray-600 text-center">
          Use your staff login code and 4-digit PIN. Branch applies to this session only.
        </p>

        {/* LOGIN CODE */}
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

        {/* PIN */}
        <label className="block">
          <span className="text-sm text-gray-700">PIN</span>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className={fieldClass}
            placeholder="4-digit PIN"
            autoComplete="off"
            required
          />
        </label>

        {/* BRANCH */}
        <div className="space-y-2">
          <span className="text-sm text-gray-700">Branch</span>
          <div className="grid grid-cols-3 gap-2 text-sm">
            {BRANCHES.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => setBranch(b.key)}
                className={[
                  buttonClass,
                  branch === b.key ? "bg-accent text-white border-accent hover:bg-accent" : "",
                ].join(" ")}
                aria-pressed={branch === b.key}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* REMEMBER ME */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 focus:ring-offset-white"
          />
          Keep me signed in
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-lg border border-transparent bg-accent p-3 text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex items-center justify-between">
            <span>First time?</span>
            <Link href="/staff/set-pin" className="text-accent font-semibold hover:underline">
              Set your PIN
            </Link>
          </div>
          {needsPin && (
            <div className="rounded-md bg-orange-50 px-3 py-2 text-[13px] text-orange-700">
              Please set up your PIN first via the Set PIN page.
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
