// app/api/prescriptions/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin as getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabase = typeof getSupabaseAdmin === "function" ? getSupabaseAdmin() : (getSupabaseAdmin as any);
const DEFAULT_SIGNATURE_BUCKET = "dr_signatures";

function toBucketPath(raw: string | null | undefined): { bucket: string; path: string } | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s.startsWith("http://") && !s.startsWith("https://")) {
    if (s.includes("/")) {
      const [bucket, ...rest] = s.split("/");
      return { bucket, path: rest.join("/") };
    }
    return { bucket: DEFAULT_SIGNATURE_BUCKET, path: s };
  }
  const marker = "/object/";
  const i = s.indexOf(marker);
  if (i === -1) return null;
  const tail = s.slice(i + marker.length);
  const parts = tail.split("/");
  if (parts.length >= 3 && (parts[0] === "public" || parts[0] === "private")) {
    return { bucket: parts[1], path: parts.slice(2).join("/") };
  }
  if (parts.length >= 2) {
    return { bucket: parts[0], path: parts.slice(1).join("/") };
  }
  return null;
}

function buildPatientName(p: any): string | null {
  if (!p) return null;
  return (
    p.full_name ||
    p.name ||
    [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ") ||
    [p.last_name, p.first_name].filter(Boolean).join(", ") ||
    null
  );
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const rxId = params.id;

    // 1) Prescription
    const { data: rx, error: rxErr } = await supabase
      .from("prescriptions")
      .select("id, patient_id, doctor_id, notes_for_patient, created_at")
      .eq("id", rxId)
      .single();

    if (rxErr || !rx) {
      return NextResponse.json({ error: "Prescription not found" }, { status: 404 });
    }

    // 2) Patient (case-insensitive match on patient_id)
    const pid = String(rx.patient_id ?? "").trim();
    const { data: patient, error: pErr } = await supabase
      .from("patients")
      .select("*")
      // ilike = case-insensitive; no % means exact match ignoring case
      .ilike("patient_id", pid)
      .maybeSingle();

    if (pErr) {
      console.warn("patient fetch error:", pErr.message, "patient_id:", rx.patient_id);
    }
    // If ilike didn’t return (some drivers require %), try robust OR with upper/lower
    let p = patient;
    if (!p) {
      const { data: p2, error: pErr2 } = await supabase
        .from("patients")
        .select("*")
        .or(
          [
            `patient_id.eq.${pid}`,
            `patient_id.eq.${pid.toUpperCase()}`,
            `patient_id.eq.${pid.toLowerCase()}`
          ].join(",")
        )
        .maybeSingle();
      if (pErr2) console.warn("patient fallback fetch error:", pErr2.message);
      p = p2 ?? null;
    }

    const patient_name = buildPatientName(p);
    const patient_birthday = p?.birthday ?? null;
    const patient_sex = p?.sex ?? p?.gender ?? null;

    // 3) Doctor
    const { data: doctor, error: dErr } = await supabase
      .from("doctors")
      .select("display_name, credentials, specialty, prc_no, signature_image_url")
      .eq("doctor_id", rx.doctor_id)
      .single();
    if (dErr) console.warn("doctor fetch error:", dErr.message);

    // 4) Items
    const { data: items, error: iErr } = await supabase
      .from("prescription_items")
      .select(
        "id, generic_name, strength, form, route, dose_amount, dose_unit, frequency_code, duration_days, quantity, instructions, created_at"
      )
      .eq("prescription_id", rxId)
      .order("created_at", { ascending: true });
    if (iErr) console.warn("items fetch error:", iErr.message);

    // 5) Signed signature URL (24h)
    let signature_url: string | null = null;
    const bp = toBucketPath(doctor?.signature_image_url);
    if (bp) {
      const { data: signed, error: sErr } = await supabase.storage
        .from(bp.bucket)
        .createSignedUrl(bp.path, 60 * 60 * 24);
      if (!sErr && signed?.signedUrl) signature_url = signed.signedUrl;
      else if (sErr) console.warn("signature sign error:", sErr.message);
    }

    return NextResponse.json({
      id: rx.id,
      created_at: rx.created_at,
      notes_for_patient: rx.notes_for_patient ?? null,
      patient: {
        id: p?.patient_id ?? null,  // expose your PK
        full_name: patient_name,
        birthday: patient_birthday,
        sex: patient_sex,
      },
      doctor: {
        display_name: doctor?.display_name ?? null,
        designations: [doctor?.credentials, doctor?.specialty].filter(Boolean).join(", "),
        prc_no: doctor?.prc_no ?? null,
        signature_url,
      },
      items: items ?? [],
    });
  } catch (e: any) {
    console.error("Error in /api/prescriptions/[id]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
