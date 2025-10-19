"use client";

export default function PrintButton({ label }: { label: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="rounded bg-accent text-white px-3 py-1.5"
    >
      {label}
    </button>
  );
}
