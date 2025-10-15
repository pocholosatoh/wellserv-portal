// app/staff/(public)/login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function StaffLogin() {
  const [code, setCode] = useState("");
  const [tag, setTag] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nextTo, setNextTo] = useState("/staff"); // default
  const router = useRouter();

  // Read ?next= without useSearchParams (avoids Suspense requirement)
  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      const n = qs.get("next");
      if (n) setNextTo(n);
    } catch {/* no-op */}
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/staff/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, tag, remember }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j?.error || "Login failed");
        setLoading(false);
        return;
      }
      router.push(nextTo || "/staff");
    } catch {
      setErr("Network error");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div
        className="w-full max-w-md rounded-2xl shadow-lg p-6"
        style={{ borderTop: `6px solid ${process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b"}` }}
      >
        <img
          src="/watermark.png"
          alt="WELLSERV"
          className="block h-40 w-auto max-w-[260px] object-contain mx-auto pointer-events-none select-none"
        />
        <h1 className="text-2xl font-semibold mb-1 text-center">Staff Login</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">
          Enter the staff access code and your initials/name.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Access Code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 w-full rounded-lg border p-3"
              placeholder="Shared staff code"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Your Initials / Name</span>
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="mt-1 w-full rounded-lg border p-3"
              placeholder="e.g. COL"
              required
            />
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span className="text-sm">Keep me signed in</span>
          </label>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <button
            disabled={loading}
            className="w-full rounded-lg p-3 text-white font-medium"
            style={{ backgroundColor: process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b" }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
