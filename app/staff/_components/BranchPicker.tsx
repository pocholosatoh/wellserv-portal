"use client";

import { useEffect, useState } from "react";

function readCookie(name: string) {
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : "";
}

function writeCookie(name: string, value: string, maxAgeSeconds = 60 * 60 * 24 * 30) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}`;
}

export default function BranchPicker() {
  const [role, setRole] = useState<string>("");
  const [branch, setBranch] = useState<"SI" | "SL" | "ALL">("SI");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const r = (readCookie("staff_role") || "").toLowerCase();
    const b = (readCookie("staff_branch") || "SI").toUpperCase() as "SI" | "SL" | "ALL";
    setRole(r);
    setBranch(b);
    setReady(true);
  }, []);

  // Only admins (or people with ALL) should see the picker
  const canPick = role === "admin" || branch === "ALL";
  if (!ready || !canPick) return null;

  function setBranchAndReload(next: "SI" | "SL") {
    writeCookie("staff_branch", next);
    // small delay to ensure cookie is flushed before reload
    setTimeout(() => window.location.reload(), 10);
  }

  const btn = "rounded px-3 py-1.5 border hover:bg-gray-50";
  const active = "rounded px-3 py-1.5 border bg-gray-900 text-white";

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
        Branch
      </span>
      <button
        type="button"
        className={branch === "SI" ? active : btn}
        aria-pressed={branch === "SI"}
        onClick={() => setBranchAndReload("SI")}
        title="San Isidro"
      >
        SI
      </button>
      <button
        type="button"
        className={branch === "SL" ? active : btn}
        aria-pressed={branch === "SL"}
        onClick={() => setBranchAndReload("SL")}
        title="San Leonardo"
      >
        SL
      </button>
    </div>
  );
}
