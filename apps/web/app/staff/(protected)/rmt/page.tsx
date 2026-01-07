// app/staff/(protected)/rmt/page.tsx
import { cookies } from "next/headers";
import { readSignedCookie } from "@/lib/auth/signedCookies";
import RmtBoardClient from "@/app/staff/_components/RmtBoardClient";
import { getSupabase } from "@/lib/supabase";

type Row = {
  id: string;
  patient_id: string;
  full_name: string;
  branch_code: "SI" | "SL";
  status: "intake" | "for-extract" | "for-processing" | "done";
  priority: number;
  notes_frontdesk: string | null;
  created_at: string;
  visit_date_local: string;
};

const supaServer = () => getSupabase();

function todayISOin(tz = process.env.APP_TZ || "Asia/Manila") {
  // en-CA gives YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// ====== UPDATED LOADER: read from base table so notes_frontdesk is fresh ======
async function loadToday(branch: "SI" | "SL"): Promise<Row[]> {
  const supabase = supaServer();
  const today = todayISOin();

  const { data: encs, error } = await supabase
    .from("encounters")
    .select("id,patient_id,branch_code,status,priority,notes_frontdesk,created_at,visit_date_local")
    .eq("branch_code", branch)
    .eq("visit_date_local", today)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;

  const pids = (encs || []).map((e: any) => e.patient_id);
  let names: Record<string, string> = {};
  if (pids.length) {
    const { data: pats } = await supabase
      .from("patients")
      .select("patient_id,full_name")
      .in("patient_id", pids);
    (pats || []).forEach((r: any) => (names[r.patient_id] = r.full_name));
  }

  return (encs || []).map((e: any) => ({
    ...e,
    full_name: names[e.patient_id] || "",
  })) as Row[];
}

function StatusPill({ s }: { s: Row["status"] }) {
  const map: Record<Row["status"], string> = {
    intake: "bg-gray-200 text-gray-800",
    "for-extract": "bg-amber-100 text-amber-800",
    "for-processing": "bg-blue-100 text-blue-800",
    done: "bg-emerald-100 text-emerald-800",
  };
  const label: Record<Row["status"], string> = {
    intake: "Intake",
    "for-extract": "For Extract",
    "for-processing": "Specimen Received",
    done: "Done",
  };
  return <span className={`px-2 py-1 rounded text-xs ${map[s]}`}>{label[s]}</span>;
}

export default async function RmtBoard() {
  const c = await cookies();
  const cookieBranch = (readSignedCookie(c, "staff_branch") || "SI").toUpperCase();
  const branch = (cookieBranch === "ALL" ? "SI" : cookieBranch) as "SI" | "SL";
  const role = (readSignedCookie(c, "staff_role") || "").toLowerCase();

  const items = await loadToday(branch);

  return (
    <main className="mx-auto max-w-4xl p-4 space-y-4">
      <h1 className="text-2xl font-semibold">RMT Workboard — {branch}</h1>
      <RmtBoardClient initialItems={items} role={role} branch={branch} />
    </main>
  );
}
