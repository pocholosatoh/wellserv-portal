"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import UploadControls from "./UploadControls";

type Props = {
  action: (formData: FormData) => Promise<void>; // server action coming from page.tsx
};

// Small helper
const norm = (s: string) => s.trim();

export default function UploadFormClient({ action }: Props) {
  const pidRef = useRef<HTMLInputElement | null>(null);
  const providerRef = useRef<HTMLInputElement | null>(null);
  const [pid, setPid] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "missing" | "invalid">("idle");

  // Track the patient_id input (read-only)
  useEffect(() => {
    const id = setInterval(() => {
      setPid(pidRef.current?.value?.trim() || "");
    }, 350);
    return () => clearInterval(id);
  }, []);

  // Live patient existence check via your API route
  useEffect(() => {
    if (!pid) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    const h = setTimeout(async () => {
      try {
        const res = await fetch(`/api/patient/exists?patient_id=${encodeURIComponent(pid)}`);
        if (!res.ok) {
          setStatus("invalid");
          return;
        }
        const data = await res.json();
        setStatus(data.exists ? "ok" : "missing");
      } catch {
        setStatus("invalid");
      }
    }, 350);
    return () => clearTimeout(h);
  }, [pid]);

  const color =
    status === "ok"
      ? "text-emerald-700"
      : status === "missing"
      ? "text-red-700"
      : status === "checking"
      ? "text-gray-500"
      : status === "invalid"
      ? "text-orange-700"
      : "text-gray-500";

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <label className="block">
          <span className="text-sm font-medium">Patient ID</span>
          <input
            ref={pidRef}
            name="patient_id"
            required
            className="mt-1 w-full rounded-lg border p-2"
            placeholder="e.g., SATOH010596"
          />
        </label>

        <div className={`text-sm ${color}`}>
          {status === "idle" && "Enter a Patient ID to check…"}
          {status === "checking" && "Checking Patient ID…"}
          {status === "ok" && "✅ Patient found"}
          {status === "missing" && "❌ No patient found"}
          {status === "invalid" && "⚠️ Error checking patient ID"}
        </div>

        <label className="block">
          <span className="text-sm font-medium">Provider (optional)</span>
          <input
            ref={providerRef}
            name="provider"
            className="mt-1 w-full rounded-lg border p-2"
            placeholder="e.g., Hi-Precision, Medical City"
          />
        </label>

        {/* Quick preset */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600">Quick provider:</span>
          <button
            type="button"
            className="px-3 py-1.5 rounded-full border hover:bg-gray-50 text-sm"
            onClick={() => {
              if (providerRef.current) {
                providerRef.current.value = "Sto. Domingo Diagnostic & Medical Center";
              }
            }}
          >
            Sto. Domingo Diagnostic &amp; Medical Center
          </button>
        </div>

        <label className="block">
          <span className="text-sm font-medium">Date Taken (optional)</span>
          <input type="date" name="taken_at" className="mt-1 w-full rounded-lg border p-2" />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Note (optional)</span>
          <textarea
            name="note"
            rows={3}
            className="mt-1 w-full rounded-lg border p-2"
            placeholder="Any remarks"
          />
        </label>

        {/* File selector (your existing control) */}
        <UploadControls />
      </div>

      <button
        className="rounded-lg border px-4 py-2 hover:bg-gray-50"
        type="submit"
        disabled={status === "missing" || status === "invalid" || status === "checking"}
        title={
          status === "missing"
            ? "No patient found"
            : status === "checking"
            ? "Checking patient…"
            : undefined
        }
      >
        Upload
      </button>
    </form>
  );
}
