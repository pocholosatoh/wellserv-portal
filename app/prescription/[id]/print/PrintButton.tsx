"use client";

export default function PrintButton() {
  return (
    <button
      className="px-4 py-2 rounded bg-black text-white text-sm"
      onClick={() => window.print()}
    >
      Print
    </button>
  );
}
