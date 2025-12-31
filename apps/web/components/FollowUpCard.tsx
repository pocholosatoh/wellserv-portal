// app/(patient)/FollowUpCard.tsx
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/session";
import { HUB_BY_NAME } from "@/lib/hubs";
import { fmtManilaDate, phTodayYMD, compareYMD } from "@/lib/time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FollowupRow = {
  id: string;
  patient_id: string;
  return_branch: string | null;
  due_date: string; // YYYY-MM-DD
  valid_until: string; // YYYY-MM-DD
  intended_outcome: string | null;
  expected_tests: string | null;
  status: "scheduled" | "completed" | "canceled" | "skipped";
};

function badge(dueYMD: string, validUntilYMD: string) {
  const today = phTodayYMD();
  if (compareYMD(dueYMD, today) === 0) return { text: "today", cls: "bg-amber-100 text-amber-800" };
  if (compareYMD(dueYMD, today) < 0 && compareYMD(validUntilYMD, today) >= 0)
    return { text: "overdue", cls: "bg-red-100 text-red-700" };
  return null;
}

function parseExpectedTokens(raw?: string | null) {
  return (raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default async function FollowUpCard() {
  const s = await getSession();
  if (!s || s.role !== "patient") return null;

  const accent = process.env.NEXT_PUBLIC_ACCENT_COLOR || "#44969b";

  const sb = supabaseAdmin();
  const { data } = await sb
    .from("followups")
    .select(
      "id, patient_id, return_branch, due_date, valid_until, intended_outcome, expected_tests, status",
    )
    .eq("patient_id", s.patient_id) // <-- use sub
    .eq("status", "scheduled")
    .order("due_date", { ascending: true })
    .limit(1);

  const f: FollowupRow | undefined = (data ?? [])[0];

  const rightLabel = f ? fmtManilaDate(f.due_date) : "—";
  const rightBadge = f ? badge(f.due_date, f.valid_until) : null;
  const hub = f?.return_branch ? HUB_BY_NAME[f.return_branch] : undefined;
  const expectedTokens = parseExpectedTokens(f?.expected_tests);

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-[0_18px_45px_rgba(15,23,42,0.08)] ring-1 ring-black/0 transition hover:-translate-y-0.5 hover:shadow-[0_26px_60px_rgba(15,23,42,0.12)]">
      <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />
      <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
        <div className="text-base font-semibold text-slate-800">Follow-Up</div>
        <div className="flex items-center gap-2 text-xs">
          {rightBadge && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shadow-sm ${rightBadge.cls}`}
            >
              {rightBadge.text}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
            Next: {rightLabel}
          </span>
        </div>
      </div>

      <div className="space-y-3 px-5 pb-5 pt-4 text-sm text-slate-600 sm:px-6">
        {!f && (
          <>
            <div className="text-slate-600">No follow-up scheduled.</div>
            <div className="text-xs text-slate-500">
              If you were advised to return, please call the clinic.
            </div>
          </>
        )}

        {f && (
          <>
            <div className="text-slate-700">
              <span className="font-semibold text-slate-800">When:</span>{" "}
              {fmtManilaDate(f.due_date)}
            </div>
            <div className="text-slate-700">
              <span className="font-semibold text-slate-800">Where:</span>{" "}
              {hub?.label ?? f.return_branch ?? "—"}
            </div>
            {expectedTokens.length > 0 && (
              <div className="text-slate-700">
                <span className="font-semibold text-slate-800">Bring / Tests:</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {expectedTokens.map((tok) => (
                    <span
                      key={tok}
                      className="rounded-full bg-white/80 px-2 py-0.5 font-mono text-xs text-slate-700 ring-1 ring-slate-200"
                    >
                      {tok}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {f.intended_outcome && (
              <div className="text-slate-700">
                <span className="font-semibold text-slate-800">Doctor’s goal:</span>{" "}
                {f.intended_outcome}
              </div>
            )}
          </>
        )}

        {/* CTA row: render links only when available (no onClick) */}
        <div className="flex flex-wrap items-center gap-3 pt-2 text-[13px] text-slate-500">
          {hub?.tel ? (
            <a
              href={`tel:${hub.tel}`}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-3 py-1 font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
            >
              Call clinic{hub?.label ? ` (${hub.label})` : ""}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-200 px-3 py-1 text-slate-400">
              Call clinic
            </span>
          )}
          {hub?.mapsUrl && (
            <>
              <a
                href={hub.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-3 py-1 font-medium text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
              >
                View on Maps
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
