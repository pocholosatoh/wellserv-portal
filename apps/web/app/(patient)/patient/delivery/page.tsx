// apps/web/app/(patient)/patient/delivery/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@supabase/supabase-js";
import { DeliveryFormClient, type DeliveryInfo } from "./DeliveryFormClient";

function supa() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function PatientDeliveryPage() {
  const session = await getSession();
  if (!session || session.role !== "patient") redirect("/login?next=/patient/delivery");

  const db = supa();
  const { data } = await db
    .from("patients")
    .select(
      "patient_id, full_name, delivery_address_label, delivery_address_text, delivery_lat, delivery_lng, delivery_notes, last_delivery_used_at, last_delivery_success_at",
    )
    .eq("patient_id", session.patient_id)
    .limit(1)
    .maybeSingle();

  const accent = process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b";

  return (
    <main className="min-h-dvh bg-[#f8fafb] px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Patient Portal</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">Meds Delivery</h1>
              <p className="mt-1 text-sm text-slate-600">
                Request doorstep delivery for your prescriptions. A representative will confirm via
                call.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/patient"
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:border-slate-300 hover:bg-white"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-white/80 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <DeliveryFormClient accent={accent} initial={data ?? null} />
        </section>
      </div>
    </main>
  );
}
