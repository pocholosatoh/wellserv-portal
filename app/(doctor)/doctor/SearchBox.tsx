// app/(doctor)/doctor/SearchBox.tsx
"use client";

import { useState } from "react";

export default function SearchBox({ accent = "#44969b" }: { accent?: string }) {
  const [term, setTerm] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const value = term.trim();
    if (!value) return;

    // naive: treat the whole input as the patientId/code
    const dest = `/doctor/patient/${encodeURIComponent(value)}`;
    window.location.assign(dest);
  }

  return (
    <form onSubmit={go} className="flex items-stretch gap-2">
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Type patient ID… then press Enter"
        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none"
        style={{ boxShadow: `inset 0 0 0 2px transparent` }}
      />
      <button
        className="rounded-md px-4 py-2 text-sm text-white"
        style={{ backgroundColor: accent }}
        type="submit"
      >
        Open
      </button>
    </form>
  );
}
