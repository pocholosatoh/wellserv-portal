"use client";

export default function PrintButton({ label }: { label: string }) {
  const handleClick = () => {
    window.dispatchEvent(new Event("prepare-print"));
    window.print();
  };

  return (
    <button
      onClick={handleClick}
      className="rounded bg-accent text-white px-3 py-1.5"
    >
      {label}
    </button>
  );
}
