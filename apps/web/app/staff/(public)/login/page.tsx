// app/staff/(public)/login/page.tsx
import { Suspense } from "react";
import LoginFormClient from "./LoginFormClient";

export const dynamic = "force-dynamic";

export default function StaffLoginPage() {
  return (
    <main className="relative min-h-dvh bg-gradient-to-b from-[#f1fafb] via-white to-white px-4 py-8 sm:py-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,_rgba(68,150,155,0.25),transparent_70%)] blur-3xl" />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-2xl shadow-[rgba(68,150,155,0.15)] backdrop-blur-md sm:flex-row sm:p-10">
        <div className="flex flex-1 flex-col items-center justify-center text-center sm:items-start sm:text-left">
          <img src="/wellserv-logo.png" alt="Wellserv" className="mb-4 h-14 w-auto sm:h-16" />
          <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">Staff Portal</h1>
          <p className="mt-3 text-sm text-slate-500 sm:text-base">
            Access encounters, results, and prescriptions securely from any device. Please keep your
            login credentials private.
          </p>
          <div className="mt-6 hidden rounded-2xl bg-slate-50 p-4 text-left text-sm text-slate-500 sm:block">
            Tip: Use the latest version of Chrome or Edge for the best experience. Contact IT if you
            need help resetting your password.
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4">
          <div className="rounded-2xl border border-slate-100 bg-white/95 p-5 shadow-lg sm:p-6">
            <Suspense fallback={<div className="text-gray-500">Loading…</div>}>
              <LoginFormClient />
            </Suspense>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-center text-xs text-slate-500 sm:hidden">
            Tip: Use the latest version of Chrome or Edge for the best experience.
          </div>
        </div>
      </div>
    </main>
  );
}
