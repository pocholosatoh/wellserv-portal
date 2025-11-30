import { Suspense } from "react";
import SetPinFormClient from "./SetPinFormClient";

export const dynamic = "force-dynamic";

export default function SetPinPage() {
  return (
    <main className="relative min-h-dvh bg-gradient-to-b from-[#f1fafb] via-white to-white px-4 py-8 sm:py-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,_rgba(68,150,155,0.25),transparent_70%)] blur-3xl" />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-2xl shadow-[rgba(68,150,155,0.15)] backdrop-blur-md sm:p-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">Set Your PIN</h1>
          <p className="text-sm text-slate-600 sm:text-base">
            First-time staff setup requires your login code and birthday. A 4-digit PIN will be used for
            future logins.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white/95 p-5 shadow-lg sm:p-6">
          <Suspense fallback={<div className="text-gray-500">Loading…</div>}>
            <SetPinFormClient />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
