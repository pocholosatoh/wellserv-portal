// app/(doctor)/doctor/login/page.tsx
"use client";

import { useState } from "react";

export default function DoctorLoginPage() {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch("/api/doctor/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, pin }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErr(json?.error || "Login failed.");
        setLoading(false);
        return;
      }

      // If there's a ?next=... param, go there; else go to /doctor
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || "/doctor";
      window.location.href = next;
    } catch (e) {
      console.error(e);
      setErr("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold mb-4">Doctor Login</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Doctor Code</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g., JRR"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">PIN</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="4–6 digits"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            type="password"
            required
          />
        </div>
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button
          className="w-full rounded bg-black text-white py-2 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
