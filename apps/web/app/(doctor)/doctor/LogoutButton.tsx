"use client";

import { useState } from "react";

const LOGOUT_API = "/api/doctor/logout"; // ← change if your route differs

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  async function onClick() {
    try {
      setLoading(true);
      await fetch(LOGOUT_API, { method: "POST" });
      // Send them back to the doctor login
      window.location.href = "/doctor/login";
    } catch {
      // Fallback: hard refresh if something odd happens
      window.location.href = "/doctor/login";
    }
  }
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
      title="Sign out"
    >
      {loading ? "Signing out…" : "Log out"}
    </button>
  );
}
