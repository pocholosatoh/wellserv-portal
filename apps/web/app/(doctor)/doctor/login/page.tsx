// app/(doctor)/doctor/login/page.tsx
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function DoctorLoginPage() {
  const search = useSearchParams();
  const next = search.get("next") || "/doctor";

  // shared branch picker (used for both regular and reliever logins)
  const [branch, setBranch] = useState<"SI" | "SL">("SI");

  // ----- Regular login -----
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onRegularLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/doctor/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, pin, branch }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j?.error || "Login failed.");
        setLoading(false);
        return;
      }
      window.location.href = next;
    } catch {
      setErr("Network error. Try again.");
      setLoading(false);
    }
  }

  // ----- Reliever login -----
  const [reliefName, setReliefName] = useState("");
  const [reliefCreds, setReliefCreds] = useState("");
  const [reliefLicense, setReliefLicense] = useState("");
  const [reliefPhic, setReliefPhic] = useState(""); // NEW
  const [reliefPass, setReliefPass] = useState("");
  const [reliefLoading, setReliefLoading] = useState(false);
  const [reliefErr, setReliefErr] = useState<string | null>(null);

  async function onRelieverLogin(e: React.FormEvent) {
    e.preventDefault();
    setReliefErr(null);
    setReliefLoading(true);
    try {
      const res = await fetch("/api/doctor/reliever/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: reliefName,
          credentials: reliefCreds,
          passcode: reliefPass,
          license_no: reliefLicense || undefined,
          philhealth_md_id: reliefPhic || undefined,
          branch: branch || "SI",
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setReliefErr(j?.error || "Invalid passcode.");
        setReliefLoading(false);
        return;
      }
      window.location.href = next;
    } catch {
      setReliefErr("Network error. Try again.");
      setReliefLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-start sm:items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-sm">
        <img
          src="/wellserv-logo.png"
          alt="WELLSERV"
          style={{ display: "block", margin: "35px auto 20px", height: 120, objectFit: "contain" }}
        />
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold">Doctor Sign In</h1>
              <p className="text-xs text-gray-600 mt-1">
                Use your code & PIN, or continue as a reliever.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-700">Branch</label>
              <select
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                value={branch}
                onChange={(e) => setBranch(e.target.value as "SI" | "SL")}
              >
                <option value="SI">SI</option>
                <option value="SL">SL</option>
              </select>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-8">
          {/* Regular login */}
          <form onSubmit={onRegularLogin} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <h2 className="text-sm font-semibold">Doctor Code + PIN</h2>
            </div>

            <div>
              <label className="block text-xs mb-1 text-gray-700">Doctor Code</label>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="e.g., JRR"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-700">PIN</label>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                placeholder="4–6 digits"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            {err && <p className="text-xs text-red-600">{err}</p>}

            <button
              className="w-full rounded-md bg-[#44969b] text-white py-2 text-sm font-medium hover:opacity-95 disabled:opacity-50"
              disabled={loading}
              type="submit"
            >
              {loading ? "Signing in…" : "Sign in - Choose the correct branch above"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="h-px bg-gray-200 flex-1" />
            <div className="text-[10px] tracking-wide text-gray-500">or</div>
            <div className="h-px bg-gray-200 flex-1" />
          </div>

          {/* Reliever login */}
          <form onSubmit={onRelieverLogin} className="space-y-3">
            <h2 className="text-sm font-semibold">I’m a Reliever / Visiting Doctor</h2>

            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="Full name (no 'Dr.' — e.g., Juan Dela Cruz)"
              value={reliefName}
              onChange={(e) => setReliefName(e.target.value)}
              required
            />

            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="Designations / Credentials (e.g., MD, FPCP)"
              value={reliefCreds}
              onChange={(e) => setReliefCreds(e.target.value)}
              required
            />

            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="License / PRC No."
              value={reliefLicense}
              onChange={(e) => setReliefLicense(e.target.value)}
              required
            />

            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="PhilHealth MD ID (optional)"
              value={reliefPhic}
              onChange={(e) => setReliefPhic(e.target.value)}
            />

            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="Shared passcode (ask staff)"
              value={reliefPass}
              onChange={(e) => setReliefPass(e.target.value)}
              type="password"
              required
            />

            {reliefErr && <p className="text-xs text-red-600">{reliefErr}</p>}

            <button
              className="w-full rounded-md border border-gray-600 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              disabled={reliefLoading}
              type="submit"
            >
              {reliefLoading
                ? "Continuing…"
                : "Continue as Reliever - Choose the correct branch above"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
