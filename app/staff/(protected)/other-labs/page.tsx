// app/(doctor)/doctor/page.tsx
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

import { redirect } from "next/navigation";
import Image from "next/image";
import { getDoctorSession } from "@/lib/doctorSession";
import { getSupabase } from "@/lib/supabase";

const ACCENT = "#44969b";

type Med = {
  id: string;
  generic_name: string;
  strength: string | null;
  form: string | null;
  is_active: boolean | null;
};

// ✅ Next 15: searchParams must be awaited in server components
export default async function DoctorHome({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Guard
  const session = await getDoctorSession();
  if (!session) {
    redirect(`/doctor/login?next=${encodeURIComponent("/doctor")}`);
  }

  // Await searchParams and normalize ?patient=...
  const sp = await searchParams;
  const raw = Array.isArray(sp?.patient) ? sp.patient?.[0] : sp?.patient || "";
  const q = String(raw).trim();
  if (q) {
    redirect(`/doctor/patient/${encodeURIComponent(q.toUpperCase())}`);
  }

  // Build display name
  const docName =
    session.display_name ||
    (session.credentials ? `${session.name}, ${session.credentials}` : session.name);

  // Fetch meds (active only), alphabetical
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("meds")
    .select("id, generic_name, strength, form, is_active")
    .eq("is_active", true)
    .order("generic_name", { ascending: true });

  const meds: Med[] = Array.isArray(data) ? (data as Med[]) : [];

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center text-center gap-3">
        <Image src="/wellserv-logo.png" alt="WellServ" width={300} height={140} priority />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Doctor Console</h1>
          <p className="text-sm text-gray-500">Search a patient to open the workspace</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>
            Signed in as <b>{docName}</b>
          </span>
          <form action="/api/doctor/logout" method="post">
            <button
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50"
              title="Sign out"
            >
              Log out
            </button>
          </form>
        </div>
      </div>

      {/* Quick Search */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="p-6">
          <h2 className="text-base font-semibold text-gray-800">Quick Search</h2>
          <p className="text-sm text-gray-500 mb-4">
            Enter <b>Patient ID</b> (e.g., <code>SATOH010596</code>) then press Enter.
          </p>

          <form method="GET" action="/doctor" className="flex items-stretch gap-2">
            <input
              name="patient"
              placeholder="Type patient ID… then press Enter"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
            />
            <button
              type="submit"
              className="rounded-md px-4 py-2 text-sm text-white"
              style={{ backgroundColor: ACCENT }}
            >
              Open
            </button>
          </form>
        </div>
      </section>

      {/* Available Medications */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-medium text-gray-800">Available Medications in Pharmacy</h3>
          <p className="text-xs text-gray-500 mt-1">
            These names will also appear as you type inside the Prescription panel.
          </p>
        </div>

        <div className="p-6">
          {error ? (
            <p className="text-sm text-red-600">Failed to load medications.</p>
          ) : meds.length === 0 ? (
            <p className="text-sm text-gray-500">No active medications found.</p>
          ) : (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-12 bg-gray-50 text-xs font-medium text-gray-700 px-3 py-2">
                <div className="col-span-6">Generic name</div>
                <div className="col-span-3">Strength</div>
                <div className="col-span-3">Form</div>
              </div>
              <div className="max-h-[420px] overflow-auto divide-y divide-gray-200">
                {meds.map((m) => (
                  <div key={m.id} className="grid grid-cols-12 px-3 py-2 text-sm">
                    <div className="col-span-6 font-medium text-gray-800">{m.generic_name}</div>
                    <div className="col-span-3 text-gray-700">{m.strength || "—"}</div>
                    <div className="col-span-3 text-gray-700">{m.form || "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
