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
  due_date: string;      // YYYY-MM-DD
  valid_until: string;   // YYYY-MM-DD
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

export default async function FollowUpCard() {
  const s = await getSession();
  if (!s || s.role !== "patient") return null;

  const sb = supabaseAdmin();
  const { data } = await sb
    .from("followups")
    .select("id, patient_id, return_branch, due_date, valid_until, intended_outcome, expected_tests, status")
    .eq("patient_id", s.sub) // <-- use sub
    .eq("status", "scheduled")
    .order("due_date", { ascending: true })
    .limit(1);

  const f: FollowupRow | undefined = (data ?? [])[0];

  const rightLabel = f ? fmtManilaDate(f.due_date) : "—";
  const rightBadge = f ? badge(f.due_date, f.valid_until) : null;
  const hub = f?.return_branch ? HUB_BY_NAME[f.return_branch] : undefined;

  return (
    <div
      className="rounded-xl border shadow-sm overflow-hidden"
      style={{ borderTopWidth: 6, borderTopColor: "#44969b" }}
    >
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="font-semibold">Follow-Up</div>
        <div className="flex items-center gap-2">
          {rightBadge && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${rightBadge.cls}`}>
              {rightBadge.text}
            </span>
          )}
          <span className="text-[11px] text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">
            Next: {rightLabel}
          </span>
        </div>
      </div>

      <div className="px-4 pb-3 pt-2 space-y-1 text-sm">
        {!f && (
          <>
            <div className="text-gray-600">No follow-up scheduled.</div>
            <div className="text-xs text-gray-500">If you were advised to return, please call the clinic.</div>
          </>
        )}

        {f && (
          <>
            <div className="text-gray-800">
              <span className="font-medium">When:</span> {fmtManilaDate(f.due_date)}
            </div>
            <div className="text-gray-800">
              <span className="font-medium">Where:</span> {hub?.label ?? f.return_branch ?? "—"}
            </div>
            {f.expected_tests && (
              <div className="text-gray-800">
                <span className="font-medium">Bring / Tests:</span> {f.expected_tests}
              </div>
            )}
            {f.intended_outcome && (
              <div className="text-gray-800">
                <span className="font-medium">Doctor’s goal:</span> {f.intended_outcome}
              </div>
            )}
          </>
        )}

        {/* CTA row: render links only when available (no onClick) */}
        <div className="pt-2 flex items-center gap-3">
          {hub?.tel ? (
            <a href={`tel:${hub.tel}`} className="text-[13px] underline">
              Call clinic:{hub?.label ? ` (${hub.label})` : ""}
            </a>
          ) : (
            <span className="text-[13px] text-gray-400">Call clinic</span>
          )}
          {hub?.mapsUrl && (
            <>
              <span className="text-gray-300">·</span>
              <a
                href={hub.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] underline"
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
