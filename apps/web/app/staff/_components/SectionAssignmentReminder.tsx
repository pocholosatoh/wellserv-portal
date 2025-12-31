"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const COOKIE_NAME = "section_assignment_reminder";

function readCookie(name: string) {
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : "";
}

function writeCookie(name: string, value: string, maxAgeSeconds = 60 * 60 * 24) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}`;
}

export default function SectionAssignmentReminder({ rolePrefix }: { rolePrefix?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const prefix = (rolePrefix || "").toUpperCase();
    if (prefix !== "RMT") return;
    const flag = readCookie(COOKIE_NAME);
    if (flag && flag !== "seen") {
      setOpen(true);
      writeCookie(COOKIE_NAME, "seen");
    }
  }, [rolePrefix]);

  function close() {
    writeCookie(COOKIE_NAME, "seen");
    setOpen(false);
  }

  function openAssignments() {
    close();
    router.push("/staff/section-assignments");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-gray-900">Reminder</h2>
        <p className="mt-2 text-sm text-gray-700">
          Please review your Section Assignments to make sure your current sections and branch are
          correct.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={close}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white"
          >
            Close
          </button>
          <button
            type="button"
            onClick={openAssignments}
            className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white"
          >
            Open Section Assignments
          </button>
        </div>
      </div>
    </div>
  );
}
