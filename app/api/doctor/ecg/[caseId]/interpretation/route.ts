import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

type RouteContext = { params: Promise<{ caseId: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const supa = getSupabaseServer();
    const body = await req.json();
    const { caseId } = await context.params;

    const {
      action, // "save" | "sign"
      heart_rate, rhythm, pr, qrs, qt, qtc, axis,
      findings, impression, recommendations,
      signature_name, signature_license,
    } = body || {};

    if (!["save", "sign"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // TODO: derive from session
    const doctor_id = "doctor@example.com";
    const now = new Date().toISOString();

    const { data: interp, error } = await supa
      .from("ecg_interpretations")
      .insert({
        ecg_case_id: caseId,
        doctor_id,
        read_started_at: now,
        signed_at: action === "sign" ? now : null,
        heart_rate, rhythm, pr, qrs, qt, qtc, axis,
        findings, impression, recommendations,
        signature_name, signature_license,
      })
      .select("id")
      .single();

    if (error) throw error;

    if (action === "sign") {
      // Load linked external_result_id
      const { data: ecgCase, error: caseErr } = await supa
        .from("ecg_cases")
        .select("external_result_id")
        .eq("id", caseId)
        .single();

      if (caseErr) throw caseErr;

      if (ecgCase?.external_result_id) {
        const { error: updErr } = await supa
          .from("external_results")
          .update({
            category: "ecg",
            subtype: "ECG_12LEAD",
            impression: impression || null,
            reported_at: now,
            performer_name: signature_name || null,
            performer_role: "Physician",
            performer_license: signature_license || null,
          })
          .eq("id", ecgCase.external_result_id);

        if (updErr) throw updErr;
      }

      await supa.from("ecg_cases").update({ status: "signed" }).eq("id", caseId);
    } else {
      await supa.from("ecg_cases").update({ status: "in_review" }).eq("id", caseId);
    }

    return NextResponse.json({ ok: true, id: interp.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Bad Request" }, { status: 400 });
  }
}
