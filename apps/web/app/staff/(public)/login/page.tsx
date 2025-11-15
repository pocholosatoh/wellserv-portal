// app/staff/(public)/login/page.tsx
import { Suspense } from "react";
import LoginFormClient from "./LoginFormClient";

export const dynamic = "force-dynamic";

export default function StaffLoginPage() {
  return (
    <main className="relative min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(68,150,155,0.2),_rgba(255,255,255,0))] px-4 py-10">
      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm" />
      <div className="relative z-10 mx-auto max-w-xl">
        <div className="mb-8 text-center">
          <img src="/wellserv-logo.png" alt="Wellserv" className="mx-auto h-16 w-auto" />
          <h1 className="mt-4 text-2xl font-semibold text-slate-800">Staff Portal</h1>
          <p className="text-sm text-slate-500">Sign in to manage consultations and patient records.</p>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/90 p-6 shadow-xl shadow-[rgba(68,150,155,0.15)]">
          <Suspense fallback={<div className="text-gray-500">Loading…</div>}>
            <LoginFormClient />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
