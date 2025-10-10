"use client";

import { useState } from "react";

export default function QuickPatientJump({ accent = "#44969b" }: { accent?: string }) {
  const [value, setValue] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    window.location.assign(`/doctor/patient/${encodeURIComponent(v)}`);
  }

  return (
    <form onSubmit={go} className="flex items-stretch gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Jump to Patient ID…"
        className="w-56 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-md px-3 py-1.5 text-sm text-white"
        style={{ backgroundColor: accent }}
      >
        Go
      </button>
    </form>
  );
}
