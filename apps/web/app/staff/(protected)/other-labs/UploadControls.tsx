"use client";
import { useEffect, useRef, useState } from "react";

const MAX_MB = 20;
const MAX_BYTES = MAX_MB * 1024 * 1024;

export default function UploadControls() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = fileRef.current;
    if (!el) return;
    const onChange = () => {
      setError(null);
      const files = el.files ? Array.from(el.files) : [];
      const tooBig = files.find((f) => f.size > MAX_BYTES);
      if (tooBig) {
        setError(`"${tooBig.name}" exceeds ${MAX_MB} MB. Please choose a smaller file.`);
        el.value = ""; // clear selection
        setCount(0);
        return;
      }
      setCount(files.length);
    };
    el.addEventListener("change", onChange);
    return () => el.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="block">
      <span className="text-sm font-medium">Files</span>
      <input
        id="files"
        ref={fileRef}
        type="file"
        name="files"
        multiple
        required
        accept="image/*,application/pdf"
        className="mt-1 w-full"
      />
      <p className="text-xs text-gray-500 mt-1">
        {count > 0
          ? `${count} file${count > 1 ? "s" : ""} selected.`
          : `You can select multiple files. Max ${MAX_MB} MB each.`}
      </p>
      {error && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          className="rounded-lg border px-3 py-1.5 hover:bg-gray-50"
          onClick={() => fileRef.current?.click()}
        >
          Select files…
        </button>
      </div>
    </div>
  );
}
