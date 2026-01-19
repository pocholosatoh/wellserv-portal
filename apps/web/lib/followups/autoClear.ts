import { addDaysYMD, compareYMD, toYMDManila } from "@/lib/time";
import { getSupabase } from "@/lib/supabase";

type AutoClearArgs = {
  db: ReturnType<typeof getSupabase>;
  patientId: string | null;
  closingConsultationId: string | null;
  consultVisitAt: string | Date | null;
  consultType: string | null;
  consultBranch?: string | null;
  skipFollowupAutoclear?: boolean;
};

type AutoClearResult = {
  cleared: boolean;
  reason:
    | "skipped"
    | "missing_data"
    | "not_followup"
    | "no_active"
    | "already_closed"
    | "same_consult"
    | "outside_window"
    | "cleared";
};

// Example: due=2024-02-15, tol=30 -> window 2024-01-16..2024-03-16
export function isConsultWithinFollowupWindow(
  dueDateYmd: string,
  toleranceDays: number,
  consultDateYmd: string,
): boolean {
  const safeTolerance = Number.isFinite(toleranceDays) ? Math.max(0, Math.trunc(toleranceDays)) : 0;
  const windowStart = addDaysYMD(dueDateYmd, -safeTolerance);
  const windowEnd = addDaysYMD(dueDateYmd, safeTolerance);
  return compareYMD(consultDateYmd, windowStart) >= 0 && compareYMD(consultDateYmd, windowEnd) <= 0;
}

export async function autoClearActiveFollowupIfQualified(
  args: AutoClearArgs,
): Promise<AutoClearResult> {
  const {
    db,
    patientId,
    closingConsultationId,
    consultVisitAt,
    consultType,
    skipFollowupAutoclear = false,
  } = args;

  if (skipFollowupAutoclear) return { cleared: false, reason: "skipped" };
  if (!patientId || !closingConsultationId || !consultVisitAt) {
    return { cleared: false, reason: "missing_data" };
  }

  const normalizedType = String(consultType || "").trim().toLowerCase();
  if (normalizedType !== "followup") {
    return { cleared: false, reason: "not_followup" };
  }

  const { data: followup, error } = await db
    .from("followups")
    .select(
      "id, due_date, tolerance_days, status, deleted_at, closed_by_consultation_id, completion_note, created_from_consultation_id",
    )
    .eq("patient_id", patientId)
    .eq("status", "scheduled")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!followup) return { cleared: false, reason: "no_active" };

  if (followup.closed_by_consultation_id) {
    return { cleared: false, reason: "already_closed" };
  }

  if (followup.created_from_consultation_id === closingConsultationId) {
    return { cleared: false, reason: "same_consult" };
  }

  const consultDateYmd = toYMDManila(consultVisitAt);
  const toleranceDays = Number(followup.tolerance_days ?? 0);
  if (!isConsultWithinFollowupWindow(followup.due_date, toleranceDays, consultDateYmd)) {
    return { cleared: false, reason: "outside_window" };
  }

  const completionNote = followup.completion_note
    ? `${followup.completion_note}; auto_completed_by_consult_finish`
    : "auto_completed_by_consult_finish";

  const { error: upErr } = await db
    .from("followups")
    .update({
      status: "completed",
      closed_by_consultation_id: closingConsultationId,
      completion_note: completionNote,
      updated_at: new Date().toISOString(),
    })
    .eq("id", followup.id)
    .eq("status", "scheduled")
    .is("deleted_at", null);

  if (upErr) throw upErr;
  return { cleared: true, reason: "cleared" };
}
