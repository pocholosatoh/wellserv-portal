// app/api/meds/search/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  let query = supabase.from("meds").select("*").eq("is_active", true).limit(20);

  if (q) {
    // very simple filter: contains on generic/strength/form
    query = query.or(
      `generic_name.ilike.%${q}%,strength.ilike.%${q}%,form.ilike.%${q}%`
    );
  }

  const { data, error } = await query.order("generic_name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data });
}
