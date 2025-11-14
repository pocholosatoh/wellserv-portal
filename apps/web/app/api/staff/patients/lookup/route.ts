import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

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
  const pid = (url.searchParams.get("patient_id") || "").toUpperCase().trim();
  if (!pid) return NextResponse.json({ found: false });

  const db = supa();
  const { data } = await db
    .from("patients")
    .select("patient_id,full_name,sex,birthday,contact,address,updated_at,last_updated")
    .eq("patient_id", pid)
    .maybeSingle();

  if (!data) return NextResponse.json({ found: false });

  return NextResponse.json({
    found: true,
    patient: {
      patient_id: data.patient_id,
      full_name: data.full_name || "",
      sex: (data.sex || "").toUpperCase(),
      birthday: isoToMMDDYYYY(data.birthday as any),
      contact: data.contact || "",
      address: data.address || "",
      last_updated: data.updated_at || data.last_updated || null,
    }
  });
}
