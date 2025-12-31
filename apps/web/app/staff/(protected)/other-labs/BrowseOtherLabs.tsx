"use client";
import { useState } from "react";
import OtherLabsViewer from "@/components/OtherLabsViewer";

export default function BrowseOtherLabs() {
  const [pid, setPid] = useState("");
  return (
    <div className="mt-8 space-y-3">
      <label className="block text-sm">
        <span className="text-gray-700">Browse uploads for Patient ID</span>
        <input
          value={pid}
          onChange={(e) => setPid(e.target.value)}
          placeholder="e.g., SATOH010596"
          className="mt-1 w-full rounded-lg border p-2"
        />
      </label>

      {pid ? (
        <OtherLabsViewer patientId={pid} showIfEmpty={true} />
      ) : (
        <div className="text-sm text-gray-500">
          Enter a Patient ID to view their uploaded other labs.
        </div>
      )}
    </div>
  );
}
