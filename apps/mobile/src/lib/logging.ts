export const LOG_PARAMETERS = {
  bp: {
    key: "bp",
    label: "Blood Pressure",
    icon: "heart-pulse",
    genericInstructions:
      "Sit quietly for 5 minutes, keep your arm at heart level, and record both numbers.",
  },
  weight: {
    key: "weight",
    label: "Weight",
    icon: "scale-bathroom",
    genericInstructions: "Weigh yourself at the same time each day, ideally before eating.",
  },
  glucose: {
    key: "glucose",
    label: "Blood Glucose (Self)",
    icon: "water-outline",
    genericInstructions: "Use your glucometer as instructed and log the reading in mg/dL.",
  },
} as const;

export type LogParameterKey = keyof typeof LOG_PARAMETERS;

export const LOG_PARAMETER_LIST = Object.values(LOG_PARAMETERS);

export function normalizeMonitoringKey(row: Record<string, any> | null | undefined) {
  if (!row) return null;
  const raw =
    row.parameter_key ??
    row.parameterKey ??
    row.param_key ??
    row.paramKey ??
    row.parameter ??
    row.key ??
    null;
  if (!raw) return null;
  return String(raw).trim().toLowerCase();
}

export function isMonitoringActive(row: Record<string, any> | null | undefined) {
  if (!row) return false;
  const value =
    row.enabled ??
    row.is_enabled ??
    row.isEnabled ??
    row.active ??
    row.is_active ??
    row.isActive ??
    false;
  return Boolean(value);
}

export function getMonitoringInstructions(row: Record<string, any> | null | undefined) {
  if (!row) return null;
  const raw = row.instructions ?? row.note ?? row.notes ?? row.doctor_instructions ?? null;
  if (!raw) return null;
  const text = String(raw).trim();
  return text || null;
}
