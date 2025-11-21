// app/(doctor)/doctor/page.tsx
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getDoctorSession } from "@/lib/doctorSession";
import { getSupabase } from "@/lib/supabase";
import { readTodayEncounters } from "@/lib/todayEncounters";

const ACCENT = "#44969b";

type SearchParams =
  | { [key: string]: string | string[] | undefined }
  | undefined;

type Props = {
  searchParams?: Promise<SearchParams>; // Next 15: async
};

type Med = {
  id: string;
  generic_name: string;
  strength: string | null;
  form: string | null;
  is_active: boolean | null;
};

async function fetchConsultQueue(branch: "SI" | "SL") {
  return await readTodayEncounters({
    branch,
    consultOnly: true,
    includeDone: true,
  });
}

function TypeBadge({ type }: { type?: string | null }) {
  const isFPE = String(type || "").toUpperCase() === "FPE";
  if (!type) return <>—</>;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
        isFPE ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-800"
      }`}
      title={isFPE ? "First Patient Encounter" : "Follow-up"}
    >
      {isFPE ? "FPE" : "Follow-up"}
    </span>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  const s = String(status || "").toLowerCase();
  const cls =
    s === "done"
      ? "bg-emerald-100 text-emerald-800"
      : s === "in-progress"
      ? "bg-blue-100 text-blue-800"
      : "bg-amber-100 text-amber-800";
  const label =
    s === "done" ? "Done" : s === "in-progress" ? "In progress" : s ? s : "—";
  return <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>{label}</span>;
}


export default async function DoctorHome({ searchParams }: Props) {
  // Guard
  const session = await getDoctorSession();
  if (!session) {
    redirect(`/doctor/login?next=${encodeURIComponent("/doctor")}`);
  }

  // Next 15: await searchParams first
  const sp = (await searchParams) || {};
  const raw = (Array.isArray(sp.patient) ? sp.patient?.[0] : sp.patient) || "";
  const q = String(raw || "").trim();
  if (q) {
    redirect(`/doctor/patient/${encodeURIComponent(q.toUpperCase())}`);
  }

  // Build display name
  const docName =
    (session as any).display_name ||
    ((session as any).credentials
      ? `${(session as any).name}, ${(session as any).credentials}`
      : (session as any).name);

  const branch = session.branch as "SI" | "SL";

  // ====== LOAD QUEUE ======
  const queue = await fetchConsultQueue(branch);

  // ====== LOAD MEDS ======
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("meds")
    .select<"id, generic_name, strength, form, is_active", Med>(
      "id, generic_name, strength, form, is_active"
    )
    .eq("is_active", true)
    .order("generic_name", { ascending: true });

  const meds: Med[] = Array.isArray(data) ? data : [];

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      
      {/* ================= HERO ================= */}
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

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">ECG Inbox</h2>
            <p className="text-sm text-gray-600">
              Review pending ECG strips, finalize interpretations, and ensure encounters are linked for PhilHealth YAKAP.
            </p>
          </div>
          <Link
            href="/doctor/ecg"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-400 hover:text-gray-900"
          >
            Open ECG Inbox →
          </Link>
        </div>
      </section>

      {/* ================= CONSULT QUEUE (TOP) ================= */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-800">Consult Queue — {branch}</h3>
            <p className="text-xs text-gray-500 mt-1">
              Patients queued for today. Open a patient to start the consultation inside the workspace.
            </p>
          </div>
          <form action={`/doctor?ts=${Date.now()}`}>
            <button className="rounded-md border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50">
              Refresh
            </button>
          </form>
          {/* Switch branch (set cookie directly) */}
          <form
            action={async (formData: FormData) => {
              "use server";
              const { cookies, headers } = await import("next/headers");

              const b = String(formData.get("branch") || "SI").toUpperCase();
              const isProd = process.env.NODE_ENV === "production";

              // Set/overwrite the cookie on the server (no API call needed)
              const c = await cookies();
              c.set({
                name: "doctor_branch",
                value: b === "SL" ? "SL" : "SI",
                httpOnly: true,
                sameSite: "lax",
                secure: isProd,
                path: "/",
                maxAge: 60 * 60 * 12, // 12 hours
              });

              // Force a reload so the queue refetches for the new branch
              const { redirect } = await import("next/navigation");
              redirect("/doctor");
            }}
            className="flex items-center gap-2"
          >
            <input type="hidden" name="branch" value={branch === "SI" ? "SL" : "SI"} />
            <button
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50"
              type="submit"
              title="Switch branch"
            >
              Switch to {branch === "SI" ? "SL" : "SI"}
            </button>
          </form>


        </div>

        <div className="p-6">
          <div className="rounded-lg border border-gray-200 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left bg-gray-50 text-xs font-medium text-gray-700">
                  <th className="py-2 px-3 w-14">#</th>
                  <th className="py-2 px-3">Patient</th>
                  <th className="py-2 px-3">Contact</th>
                  <th className="py-2 px-3">PhilHealth</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {queue.map((r: any) => (
                  <tr key={r.id}>
                    <td className="py-2 px-3 font-semibold">{r.queue_number ?? "-"}</td>
                    <td className="py-2 px-3">
                      <div className="font-medium text-gray-900">{r.full_name || r.patient_id}</div>
                      <div className="text-xs text-gray-500">{r.patient_id}</div>
                    </td>
                    <td className="py-2 px-3">{r.contact || "—"}</td>
                    <td className="py-2 px-3">
                      {r.yakap_flag ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs">
                          PhilHealth
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="py-2 px-3">
                      {/* NEW: FPE / Follow-up badge */}
                      <TypeBadge type={r.consult_type} />
                    </td>

                    <td className="py-2 px-3">
                      {/* NEW: status pill; tries consult_status first, falls back to status */}
                      <StatusPill status={r.consult_status || r.status} />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <Link
                        href={`/doctor/patient/${encodeURIComponent(r.patient_id)}`}
                        className="inline-block rounded-md border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50"
                        title="Open workspace"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
                {queue.length === 0 && (
                  <tr>
                    <td className="py-6 px-3 text-gray-500 text-center" colSpan={6}>
                      No patients in the consult queue yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>


      {/* ================= QUICK SEARCH ================= */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="p-6">
          <h2 className="text-base font-semibold text-gray-800">Quick Search</h2>
          <p className="text-sm text-gray-500 mb-4">
            <b>Tip:</b> Use the <b>Consult Queue</b> above to open today’s patients. This search is
            for viewing other patient records only (it won’t link to today’s queue/encounter).
          </p>
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

      {/* ================= AVAILABLE MEDS ================= */}
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
