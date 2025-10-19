// app/staff/(public)/login/page.tsx
import { Suspense } from "react";
import LoginFormClient from "./LoginFormClient";

export const dynamic = "force-dynamic";

export default function StaffLoginPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold mb-4">Staff Sign In</h1>
      <Suspense fallback={<div className="text-gray-500">Loading…</div>}>
        <LoginFormClient />
      </Suspense>
    </main>
  );
}
