// app/(doctor)/doctor/page.tsx
"use client";

import { useState } from "react";

export default function DoctorHome() {
  const [patientId, setPatientId] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pid = patientId.trim();
    if (pid) {
      // Simple client-side redirect
      window.location.href = `/doctor/patient/${encodeURIComponent(pid)}`;
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Doctor Workspace</h1>
      <p className="mb-4">Enter a patient ID to open the workspace:</p>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          className="border rounded px-3 py-2 flex-1"
          placeholder="e.g., 2024-000123"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          required
        />
        <button className="rounded bg-black text-white px-4 py-2">Open</button>
      </form>

      <div className="mt-6">
        <p className="text-sm mb-2">Shortcut examples:</p>
        <ul className="list-disc pl-6">
          <li>
            <a
              className="text-blue-600 underline"
              href="/doctor/patient/ABC123"
            >
              /doctor/patient/ABC123
            </a>
          </li>
        </ul>
      </div>

      <form method="post" action="/api/doctor/logout" className="mt-10">
        <button className="text-sm text-gray-600 underline">Logout</button>
      </form>
    </div>
  );
}
