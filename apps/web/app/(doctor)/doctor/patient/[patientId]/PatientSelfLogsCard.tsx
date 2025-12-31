"use client";

import { useEffect, useMemo, useState } from "react";

const PARAMETERS = [
  { key: "bp", label: "BP" },
  { key: "weight", label: "Weight" },
  { key: "glucose", label: "Glucose" },
] as const;

type ParameterKey = (typeof PARAMETERS)[number]["key"];

type MonitoringRow = {
  parameter_key: ParameterKey;
  enabled?: boolean | null;
  instructions?: string | null;
  frequency?: string | null;
};

type LogRow = {
  id: string;
  measured_at: string | null;
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  weight_kg?: number | null;
  blood_glucose_mgdl?: number | null;
};

type LogGroups = {
  bp: LogRow[];
  weight: LogRow[];
  glucose: LogRow[];
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const dt = new Date(value);
  return Number.isNaN(dt.getTime())
    ? value
    : dt.toLocaleString("en-PH", { timeZone: "Asia/Manila" });
}

function formatValue(key: ParameterKey, row: LogRow) {
  if (key === "bp") {
    const sys = row.systolic_bp ?? null;
    const dia = row.diastolic_bp ?? null;
    if (sys == null && dia == null) return "-";
    const sysVal = sys == null ? "-" : String(sys);
    const diaVal = dia == null ? "-" : String(dia);
    return `${sysVal}/${diaVal} mmHg`;
  }
  if (key === "weight") {
    return row.weight_kg == null ? "-" : `${row.weight_kg} kg`;
  }
  return row.blood_glucose_mgdl == null ? "-" : `${row.blood_glucose_mgdl} mg/dL`;
}

export default function PatientSelfLogsCard({
  patientId,
  monitoringApiPath = "/api/doctor/patient-self-monitoring",
  logsApiPath = "/api/doctor/patient-self-monitoring/logs",
}: {
  patientId: string;
  monitoringApiPath?: string;
  logsApiPath?: string;
}) {
  const [open, setOpen] = useState(true);
  const [monitoring, setMonitoring] = useState<MonitoringRow[]>([]);
  const [logs, setLogs] = useState<LogGroups | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let abort = false;
    setLoading(true);
    setErr(null);

    const monitoringUrl =
      `${monitoringApiPath}${monitoringApiPath.includes("?") ? "&" : "?"}` +
      `patient_id=${encodeURIComponent(patientId)}`;
    const logsUrl =
      `${logsApiPath}${logsApiPath.includes("?") ? "&" : "?"}` +
      `patient_id=${encodeURIComponent(patientId)}`;

    const monitoringReq = fetch(monitoringUrl, { cache: "no-store" }).then((res) =>
      res.json().then((body) => ({ res, body })),
    );

    const logsReq = fetch(logsUrl, { cache: "no-store" }).then((res) =>
      res.json().then((body) => ({ res, body })),
    );

    Promise.all([monitoringReq, logsReq])
      .then(([m, l]) => {
        if (!m.res.ok) throw new Error(m.body?.error || `HTTP ${m.res.status}`);
        if (!l.res.ok) throw new Error(l.body?.error || `HTTP ${l.res.status}`);
        if (!abort) {
          setMonitoring(Array.isArray(m.body?.monitoring) ? m.body.monitoring : []);
          setLogs(l.body?.logs || { bp: [], weight: [], glucose: [] });
        }
      })
      .catch((e: any) => {
        if (!abort) setErr(e?.message || "Failed to load");
      })
      .finally(() => {
        if (!abort) setLoading(false);
      });

    return () => {
      abort = true;
    };
  }, [patientId]);

  const monitoringMap = useMemo(() => {
    const out: Record<ParameterKey, MonitoringRow | null> = {
      bp: null,
      weight: null,
      glucose: null,
    };
    monitoring.forEach((row) => {
      const key = row.parameter_key;
      if (key && key in out) out[key] = row;
    });
    return out;
  }, [monitoring]);

  const hasMonitoringEnabled = monitoring.some((row) => Boolean(row?.enabled));
  const hasLogs =
    (logs?.bp?.length ?? 0) > 0 ||
    (logs?.weight?.length ?? 0) > 0 ||
    (logs?.glucose?.length ?? 0) > 0;

  if (!loading && !err && !hasMonitoringEnabled && !hasLogs) return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white/95 shadow-sm overflow-hidden">
      <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="font-medium text-gray-800">Patient Self-Logs</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
        >
          {open ? "Hide" : "Show"}
        </button>
      </header>

      {open && (
        <div className="p-4">
          {loading && <div className="text-sm text-gray-500">Loading patient self-logs...</div>}
          {err && <div className="text-sm text-red-600">Failed to load: {err}</div>}

          {!loading && !err && (
            <div className="grid gap-3">
              {PARAMETERS.map((p) => {
                const meta = monitoringMap[p.key];
                const entries = logs?.[p.key] ?? [];
                return (
                  <div key={p.key} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-gray-800">{p.label}</div>
                      {meta?.enabled ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                          Prescribed
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">Not prescribed</span>
                      )}
                    </div>

                    {meta?.enabled && (meta?.frequency || meta?.instructions) && (
                      <div className="mt-1 text-xs text-gray-600">
                        {meta?.frequency && (
                          <div>
                            <span className="font-medium">Frequency:</span> {meta.frequency}
                          </div>
                        )}
                        {meta?.instructions && (
                          <div>
                            <span className="font-medium">Instructions:</span> {meta.instructions}
                          </div>
                        )}
                      </div>
                    )}

                    {entries.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-sm">
                        {entries.map((entry) => (
                          <li key={entry.id} className="flex items-center justify-between gap-3">
                            <span className="text-gray-600">
                              {formatDateTime(entry.measured_at)}
                            </span>
                            <span className="font-medium text-gray-800">
                              {formatValue(p.key, entry)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-2 text-sm text-gray-500">No patient logs yet.</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
