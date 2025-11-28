import { getSupabase } from "@/lib/supabase";

type PrescriptionRow = {
  id: string;
  patient_id: string;
  doctor_id?: string | null;
  consultation_id?: string | null;
  status?: string | null;
  show_prices?: boolean | null;
  notes_for_patient?: string | null;
  discount_type?: string | null;
  discount_value?: number | null;
  discount_expires_at?: string | null;
  discount_applied_by?: string | null;
  final_total?: number | null;
  want_pharmacy_order?: boolean | null;
  order_requested_at?: string | null;
  delivery_address?: string | null;
  valid_days?: number | null;
  valid_until?: string | null;
  supersedes_prescription_id?: string | null;
  is_superseded?: boolean | null;
  active?: boolean | null;
  created_at: string;
  updated_at?: string | null;
};

type PrescriptionItemRow = {
  id: string;
  prescription_id: string;
  med_id?: string | null;
  generic_name?: string | null;
  brand_name?: string | null;
  strength?: string | null;
  form?: string | null;
  route?: string | null;
  dose_amount?: number | null;
  dose_unit?: string | null;
  frequency_code?: string | null;
  duration_days?: number | null;
  quantity?: number | null;
  instructions?: string | null;
  unit_price?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export async function getPatientPrescriptions(patient_id: string) {
  const supabase = getSupabase();

  const { data: rxList, error: rxErr } = await supabase
    .from("prescriptions")
    .select(
      `
        id,
        patient_id,
        doctor_id,
        consultation_id,
        doctors(display_name, credentials),
        consultations(signing_doctor_name),
        status,
        show_prices,
        notes_for_patient,
        discount_type,
        discount_value,
        discount_expires_at,
        discount_applied_by,
        final_total,
        want_pharmacy_order,
        order_requested_at,
        delivery_address,
        valid_days,
        valid_until,
        supersedes_prescription_id,
        is_superseded,
        active,
        created_at,
        updated_at
        `
    )
    .eq("patient_id", patient_id)
    .eq("status", "signed")
    .eq("is_superseded", false)
    .order("created_at", { ascending: false });

  if (rxErr) {
    throw new Error(rxErr.message);
  }

  const filteredList = (rxList || []).filter((r) => r.is_superseded === false);

  if (!filteredList.length) {
    return { prescriptions: [] as Array<PrescriptionRow & { items: PrescriptionItemRow[] }> };
  }

  const ids = filteredList.map((r) => r.id);
  const { data: items, error: itErr } = await supabase
    .from("prescription_items")
    .select(
      `
        id,
        prescription_id,
        med_id,
        generic_name,
        brand_name,
        strength,
        form,
        route,
        dose_amount,
        dose_unit,
        frequency_code,
        duration_days,
        quantity,
        instructions,
        unit_price,
        created_at,
        updated_at
        `
    )
    .in("prescription_id", ids)
    .order("created_at", { ascending: true });

  if (itErr) {
    throw new Error(itErr.message);
  }

  const byRx = new Map<string, PrescriptionItemRow[]>();
  for (const it of items || []) {
    const arr = byRx.get(it.prescription_id) || [];
    arr.push(it);
    byRx.set(it.prescription_id, arr);
  }

  const out = filteredList.map((r) => ({
    ...r,
    items: byRx.get(r.id) || [],
  }));

  return { prescriptions: out };
}
