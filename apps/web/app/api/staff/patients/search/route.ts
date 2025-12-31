import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

function isoToMMDDYYYY(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(+d)) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = d.getFullYear();
  return `${mm}/${dd}/${yy}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const limit = Number(url.searchParams.get("limit") || 5);

  if (!q) return NextResponse.json({ rows: [] });

  const db = getSupabase();
  const { data } = await db
    .from("patients")
    .select("patient_id,full_name,sex,birthday,contact,address")
    .or(`patient_id.ilike.%${q}%,full_name.ilike.%${q}%`)
    .limit(limit);

  const rows = (data || []).map((r) => ({
    patient_id: r.patient_id,
    full_name: r.full_name || "",
    sex: (r.sex || "").toUpperCase(),
    birthday: isoToMMDDYYYY(r.birthday as any),
    contact: r.contact || "",
    address: r.address || "",
  }));

  return NextResponse.json({ rows });
}
