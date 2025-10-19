"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginFormClient() {
  const router = useRouter();
  const search = useSearchParams();
  const nextPath = search.get("next") || "/staff";

  // --- FORM STATE (all fields you need) ---
  const [code, setCode] = useState("");           // e.g. "REC-SI-CHL"
  const [tag, setTag] = useState("");             // e.g. "CHL"
  const [portalCode, setPortalCode] = useState(""); // shared secret from env on server
  const [remember, setRemember] = useState(true); // keep me signed in
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- OPTIONAL: quick client-side format check for nicer UX ---
  function validateLocally() {
    const CODE = code.trim().toUpperCase();
    const TAG = tag.trim().toUpperCase();
    const okShape = /^(RMT|REC|ADM)-(SI|SL|ALL)-[A-Z]{2,5}$/.test(CODE);
    if (!okShape) return "Access Code must look like REC-SI-CHL";
    const suffix = CODE.split("-").pop();
    if (TAG !== suffix) return "Your initials must match the code suffix.";
    if (!portalCode.trim()) return "Portal Access Code is required.";
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
          code: code.trim().toUpperCase(),
          tag: tag.trim().toUpperCase(),
          remember,
          portalCode: portalCode.trim(), // server checks vs STAFF_PORTAL_ACCESS_CODE
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        throw new Error(j?.error || "Login failed");
      }
      // success → go to next (or /staff)
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
          Enter the staff access code, your initials, and the portal access code.
        </p>

        {/* ACCESS CODE */}
        <label className="block">
          <span className="text-sm text-gray-700">Access Code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="mt-1 w-full rounded-lg border p-3 uppercase"
            placeholder="REC-SI-CHL (ROLE-BRANCH-INITIALS)"
            autoComplete="off"
            required
          />
        </label>

        {/* INITIALS */}
        <label className="block">
          <span className="text-sm text-gray-700">Your Initials</span>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value.toUpperCase())}
            className="mt-1 w-full rounded-lg border p-3 uppercase"
            placeholder="CHL"
            autoComplete="off"
            required
          />
        </label>

        {/* PORTAL ACCESS CODE */}
        <label className="block">
          <span className="text-sm text-gray-700">Portal Access Code</span>
          <input
            type="password"
            value={portalCode}
            onChange={(e) => setPortalCode(e.target.value)}
            className="mt-1 w-full rounded-lg border p-3"
            placeholder="Enter the shared portal code"
            autoComplete="off"
            required
          />
        </label>

        {/* REMEMBER ME */}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Keep me signed in
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-lg bg-accent p-3 text-white disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        {error && <p className="text-red-600 text-sm">{error}</p>}
      </form>
    </div>
  );
}
