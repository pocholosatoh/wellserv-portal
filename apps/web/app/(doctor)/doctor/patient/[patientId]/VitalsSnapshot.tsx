import { sbListVitalsByPatient, type VitalsSnapshotRow } from "@/lib/supabase";
import { fmtManila } from "@/lib/time";

// Staff vitals snapshot: /staff/patienthistory (app/staff/(protected)/patienthistory/page.tsx),
// which uses patient_id from the selected patient record to call /api/staff/vitals.
// Data source: Supabase vitals_snapshots (measured_at, bp, hr, rr, temp_c, height_cm, weight_kg,
// bmi, o2sat, notes, created_by_initials).

const DEFAULT_LIMIT = 20;

type NormalizedVitals = {
  id: string;
  measured_at: string;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  hr: number | null;
  rr: number | null;
  temp_c: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  bmi: number | null;
  o2sat: number | null;
  blood_glucose_mgdl: number | null;
  notes: string | null;
  source: string | null;
  created_by_initials: string | null;
  created_at: string | null;
};

type Metric = {
  label: string;
  value: string;
};

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function formatNumber(value: number, digits = 1) {
  const factor = Math.pow(10, digits);
  const rounded = Math.round(value * factor) / factor;
  const fixed = rounded.toFixed(digits);
  return fixed.replace(/\.0+$/, "");
}

function formatBp(sys: number | null, dia: number | null) {
  if (sys == null && dia == null) return null;
  const sysVal = sys == null ? "-" : formatNumber(sys, 0);
  const diaVal = dia == null ? "-" : formatNumber(dia, 0);
  return `${sysVal}/${diaVal} mmHg`;
}

function formatHeight(cm: number | null) {
  if (cm == null || !Number.isFinite(cm) || cm <= 0) return null;
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  if (!Number.isFinite(ft) || !Number.isFinite(inch)) return null;
  return `${ft}ft ${inch}in`;
}

function formatRecorder(row: NormalizedVitals) {
  const initials = row.created_by_initials?.trim();
  const source = row.source?.trim();
  if (initials && source) return `${initials} (${source})`;
  if (initials) return initials;
  if (source) return source;
  return "—";
}

function resolveBmi(row: NormalizedVitals) {
  if (row.bmi != null) return row.bmi;
  if (row.weight_kg == null || row.height_cm == null || row.height_cm <= 0) return null;
  const meters = row.height_cm / 100;
  return meters > 0 ? row.weight_kg / (meters * meters) : null;
}

function normalizeSnapshot(row: VitalsSnapshotRow): NormalizedVitals {
  return {
    id: String(row.id),
    measured_at: String(row.measured_at ?? row.created_at ?? ""),
    systolic_bp: toNum(row.systolic_bp),
    diastolic_bp: toNum(row.diastolic_bp),
    hr: toNum(row.hr),
    rr: toNum(row.rr),
    temp_c: toNum(row.temp_c),
    height_cm: toNum(row.height_cm),
    weight_kg: toNum(row.weight_kg),
    bmi: toNum(row.bmi),
    o2sat: toNum(row.o2sat),
    blood_glucose_mgdl: toNum(row.blood_glucose_mgdl),
    notes: toText(row.notes),
    source: toText(row.source),
    created_by_initials: toText(row.created_by_initials),
    created_at: toText(row.created_at),
  };
}

function toTimestamp(value: string | null | undefined) {
  if (!value) return 0;
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

function buildMetrics(row: NormalizedVitals): Metric[] {
  const metrics: Metric[] = [];
  const bp = formatBp(row.systolic_bp, row.diastolic_bp);
  if (bp) metrics.push({ label: "BP", value: bp });
  if (row.hr != null) metrics.push({ label: "HR", value: `${formatNumber(row.hr, 0)} bpm` });
  if (row.rr != null) metrics.push({ label: "RR", value: `${formatNumber(row.rr, 0)}/min` });
  if (row.temp_c != null)
    metrics.push({ label: "Temp", value: `${formatNumber(row.temp_c, 1)} C` });
  if (row.o2sat != null) metrics.push({ label: "SpO2", value: `${formatNumber(row.o2sat, 0)}%` });
  if (row.weight_kg != null)
    metrics.push({ label: "Weight", value: `${formatNumber(row.weight_kg, 1)} kg` });
  if (row.blood_glucose_mgdl != null) {
    metrics.push({
      label: "Blood Glucose",
      value: `${formatNumber(row.blood_glucose_mgdl, 1)} mg/dL`,
    });
  }
  const height = formatHeight(row.height_cm);
  if (height) metrics.push({ label: "Height", value: height });
  const bmi = resolveBmi(row);
  if (bmi != null) metrics.push({ label: "BMI", value: formatNumber(bmi, 1) });
  return metrics;
}

export default async function VitalsSnapshot({
  patientId,
  limit = DEFAULT_LIMIT,
}: {
  patientId: string;
  limit?: number;
}) {
  const rows = await sbListVitalsByPatient(patientId, { limit }).catch(() => []);
  const snapshots = rows
    .map(normalizeSnapshot)
    .sort((a, b) => {
      const byMeasured = toTimestamp(b.measured_at) - toTimestamp(a.measured_at);
      if (byMeasured !== 0) return byMeasured;
      const byCreated = toTimestamp(b.created_at) - toTimestamp(a.created_at);
      if (byCreated !== 0) return byCreated;
      return String(b.id).localeCompare(String(a.id));
    });

  const latest = snapshots[0] ?? null;
  const history = latest ? snapshots.filter((snap) => snap.id !== latest.id) : snapshots;

  return (
    <section className="rounded-xl border border-gray-200 bg-white/95 shadow-sm overflow-hidden">
      <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="font-medium text-gray-800">Vitals Snapshot</h2>
        <span className="text-xs text-gray-500">Latest + history</span>
      </header>

      <div className="p-4 space-y-4">
        {!latest && <div className="text-sm text-gray-500">No vitals recorded yet.</div>}

        {latest && (
          <div className="rounded-lg border border-[#44969b]/20 bg-[#44969b]/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#2e6468]">
                Latest
              </span>
              <span className="text-xs text-gray-600">{fmtManila(latest.measured_at)}</span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {buildMetrics(latest).map((metric) => (
                <div key={metric.label}>
                  <div className="text-xs text-gray-500">{metric.label}</div>
                  <div className="font-medium text-gray-800">{metric.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-600">
              Recorded by <span className="font-medium text-gray-800">{formatRecorder(latest)}</span>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              History
            </div>
            <div className="mt-2 space-y-2">
              {history.map((snap) => {
                const metrics = buildMetrics(snap);
                return (
                  <div key={snap.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium text-gray-800">
                        {fmtManila(snap.measured_at)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Recorded by {formatRecorder(snap)}
                      </div>
                    </div>
                    {metrics.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-700">
                        {metrics.map((metric) => (
                          <span
                            key={`${snap.id}-${metric.label}`}
                            className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5"
                          >
                            <span className="font-medium">{metric.label}:</span> {metric.value}
                          </span>
                        ))}
                      </div>
                    )}
                    {snap.notes && (
                      <div className="mt-2 text-xs text-gray-500">Notes: {snap.notes}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
