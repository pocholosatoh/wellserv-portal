import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const RESULT_OPTIONS = ["ALLOW", "DENY", "ERROR"] as const;
const ACTION_OPTIONS = ["READ", "WRITE", "VERIFY", "SIGN"] as const;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

const DATE_FMT = new Intl.DateTimeFormat("en-PH", {
  timeZone: process.env.APP_TZ || "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

type AuditRow = {
  created_at: string | null;
  route: string | null;
  method: string | null;
  action: string | null;
  result: string | null;
  actor_role: string | null;
  actor_id: string | null;
  patient_id: string | null;
  branch_id: string | null;
  status_code: number | null;
  request_id: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return DATE_FMT.format(dt);
}

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const raw = params[key];
  if (Array.isArray(raw)) return String(raw[0] || "").trim();
  return String(raw || "").trim();
}

function normalizeEnum(value: string, allowed: readonly string[]) {
  const v = String(value || "")
    .trim()
    .toUpperCase();
  return allowed.includes(v) ? v : "";
}

function parseLimit(value: string) {
  const raw = Number.parseInt(String(value || ""), 10);
  if (Number.isNaN(raw) || raw <= 0) return DEFAULT_LIMIT;
  return Math.min(raw, MAX_LIMIT);
}

function parseDateParam(value: string, endOfDay: boolean) {
  const raw = String(value || "").trim();
  if (!raw) return { iso: null, input: "", error: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return {
      iso: `${raw}T${endOfDay ? "23:59:59.999Z" : "00:00:00Z"}`,
      input: raw,
      error: null,
    };
  }
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) {
    return { iso: null, input: "", error: `Invalid ${endOfDay ? "end" : "start"} date` };
  }
  const iso = dt.toISOString();
  return { iso, input: iso.slice(0, 10), error: null };
}

function resultBadge(result?: string | null) {
  const value = String(result || "").toUpperCase();
  if (value === "ALLOW") return "bg-emerald-100 text-emerald-800";
  if (value === "DENY") return "bg-rose-100 text-rose-800";
  if (value === "ERROR") return "bg-amber-100 text-amber-800";
  return "bg-gray-100 text-gray-700";
}

export default async function StaffAuditLogPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session || session.role !== "staff") {
    redirect("/staff/login");
  }

  const prefix = (session.staff_role_prefix || "").toUpperCase();
  const staffRole = (session.staff_role || "").toLowerCase();
  const isAdmin = prefix === "ADM" || staffRole === "admin";
  if (!isAdmin) {
    redirect("/staff");
  }

  const sp = (await searchParams) || {};
  const startRaw = readParam(sp, "start");
  const endRaw = readParam(sp, "end");
  const resultRaw = readParam(sp, "result");
  const actionRaw = readParam(sp, "action");
  const limitRaw = readParam(sp, "limit");

  const start = parseDateParam(startRaw, false);
  const end = parseDateParam(endRaw, true);
  const result = normalizeEnum(resultRaw, RESULT_OPTIONS);
  const action = normalizeEnum(actionRaw, ACTION_OPTIONS);
  const limit = parseLimit(limitRaw);

  let rows: AuditRow[] = [];
  let fetchError: string | null = null;
  const filterError =
    start.error || end.error ? [start.error, end.error].filter(Boolean).join(". ") : null;

  if (!filterError) {
    try {
      const supa = getSupabase();
      let query = supa
        .from("audit_log")
        .select(
          "created_at, route, method, action, result, actor_role, actor_id, patient_id, branch_id, status_code, request_id",
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (start.iso) query = query.gte("created_at", start.iso);
      if (end.iso) query = query.lte("created_at", end.iso);
      if (result) query = query.eq("result", result);
      if (action) query = query.eq("action", action);

      const { data, error } = await query;
      if (error) throw error;
      rows = (data || []) as AuditRow[];
    } catch (err: any) {
      fetchError = err?.message || "Failed to load audit log.";
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-600">
          Metadata-only audit events (route, method, action/result, IDs). No PHI is displayed.
        </p>
      </header>

      <section className="rounded-2xl bg-white p-6 shadow-sm space-y-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6" method="get">
          <label className="text-sm font-medium text-gray-700">
            Start
            <input
              type="date"
              name="start"
              defaultValue={start.input}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            End
            <input
              type="date"
              name="end"
              defaultValue={end.input}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Result
            <select
              name="result"
              defaultValue={result}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {RESULT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Action
            <select
              name="action"
              defaultValue={action}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="limit" value={limit} />
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-[#2e6468] px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              Apply
            </button>
          </div>
        </form>
        <p className="text-xs text-gray-500">Showing up to {limit} newest events.</p>
      </section>

      {filterError && (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {filterError}
        </p>
      )}

      {fetchError && (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {fetchError}
        </p>
      )}

      <section className="overflow-auto rounded-2xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="text-left font-medium px-3 py-2">Time</th>
              <th className="text-left font-medium px-3 py-2">Result</th>
              <th className="text-left font-medium px-3 py-2">Action</th>
              <th className="text-left font-medium px-3 py-2">Method</th>
              <th className="text-left font-medium px-3 py-2">Route</th>
              <th className="text-left font-medium px-3 py-2">Actor Role</th>
              <th className="text-left font-medium px-3 py-2">Actor ID</th>
              <th className="text-left font-medium px-3 py-2">Branch ID</th>
              <th className="text-left font-medium px-3 py-2">Patient ID</th>
              <th className="text-left font-medium px-3 py-2">Status</th>
              <th className="text-left font-medium px-3 py-2">Request ID</th>
            </tr>
          </thead>
          <tbody>
            {!filterError && !fetchError && rows.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-sm text-gray-500" colSpan={11}>
                  No audit events found for the selected filters.
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <tr key={`${row.request_id || row.created_at || "row"}-${idx}`} className="border-t">
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.created_at)}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${resultBadge(
                      row.result,
                    )}`}
                  >
                    {String(row.result || "—").toUpperCase()}
                  </span>
                </td>
                <td className="px-3 py-2">{String(row.action || "—").toUpperCase()}</td>
                <td className="px-3 py-2 font-mono">{String(row.method || "—").toUpperCase()}</td>
                <td className="px-3 py-2 break-all text-xs">{row.route || "—"}</td>
                <td className="px-3 py-2">{row.actor_role || "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.actor_id || "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.branch_id || "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.patient_id || "—"}</td>
                <td className="px-3 py-2">{row.status_code ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.request_id || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
