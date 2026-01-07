


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."packaging_type" AS ENUM (
    'box',
    'bundle',
    'pack',
    'bag',
    'bottle'
);


ALTER TYPE "public"."packaging_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clean_blank"("t" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare s text;
begin
  if t is null then return null; end if;
  s := btrim(t);
  if s = '' then return null; end if;
  if lower(s) in ('-', 'n/a', 'na', 'null') then return null; end if;
  return s;
end; $$;


ALTER FUNCTION "public"."clean_blank"("t" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."consultations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "text" NOT NULL,
    "doctor_id" "uuid",
    "visit_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "plan_shared" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "doctor_name_at_time" "text",
    "branch" "text",
    "encounter_id" "uuid",
    "hub_code" "text",
    "type" "text" DEFAULT 'FPE'::"text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "started_by_user_id" "uuid",
    "finalized_by_doctor_id" "uuid",
    "finalized_at" timestamp with time zone,
    "signing_doctor_id" "uuid",
    "signing_doctor_name" "text",
    "signing_doctor_prc_no" "text",
    "signing_doctor_philhealth_md_id" "text",
    CONSTRAINT "consultations_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'final'::"text"]))),
    CONSTRAINT "consultations_type_check" CHECK (("type" = ANY (ARRAY['FPE'::"text", 'FollowUp'::"text", 'Tele'::"text", 'WalkInLabOnly'::"text"])))
);


ALTER TABLE "public"."consultations" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consult_find_today_ph"("p_patient_id" "text") RETURNS SETOF "public"."consultations"
    LANGUAGE "sql" STABLE
    AS $$
  select *
  from consultations
  where patient_id = p_patient_id
    and (visit_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date
  order by visit_at desc
$$;


ALTER FUNCTION "public"."consult_find_today_ph"("p_patient_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."doctor_login"("p_code" "text", "p_pin" "text") RETURNS TABLE("doctor_id" "uuid", "display_name" "text", "code" "text")
    LANGUAGE "sql" STABLE
    AS $$
  select d.doctor_id, d.display_name, d.code
  from public.doctors d
  where d.active = true
    and d.code = p_code
    and d.pin_hash = crypt(p_pin, d.pin_hash)
$$;


ALTER FUNCTION "public"."doctor_login"("p_code" "text", "p_pin" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_upper_patient_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.patient_id := upper(new.patient_id);
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_upper_patient_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_ecg_reports_validate_and_fill"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  strip_patient text;
  enc_patient   text;
  d_active      boolean;
  d_name        text;
  d_full        text;
  d_creds       text;
  d_prc         text;
  d_ph_md_id    text;
  snap_name     text;
  snap_license  text;
begin
  -- external_results.patient_id
  select er.patient_id into strip_patient
  from public.external_results er
  where er.id = new.external_result_id;

  if strip_patient is null then
    raise exception 'external_result_id % not found in external_results', new.external_result_id;
  end if;

  -- encounters.patient_id
  select e.patient_id into enc_patient
  from public.encounters e
  where e.id = new.encounter_id;

  if enc_patient is null then
    raise exception 'encounter_id % not found in encounters', new.encounter_id;
  end if;

  -- enforce same patient across all 3 records
  if new.patient_id is null then
    new.patient_id := strip_patient;
  end if;

  if new.patient_id <> strip_patient then
    raise exception 'ecg_reports.patient_id (%) does not match strip patient_id (%)',
      new.patient_id, strip_patient;
  end if;

  if new.patient_id <> enc_patient then
    raise exception 'ecg_reports.patient_id (%) does not match encounter patient_id (%)',
      new.patient_id, enc_patient;
  end if;

  -- doctor must exist and be active; also fetch snapshot fields
  select active, display_name, full_name, credentials, prc_no, philhealth_md_id
    into d_active, d_name, d_full, d_creds, d_prc, d_ph_md_id
  from public.doctors
  where doctor_id = new.doctor_id;

  if d_active is null then
    raise exception 'doctor_id % not found in doctors', new.doctor_id;
  end if;

  if d_active = false then
    raise exception 'doctor_id % is inactive; cannot sign ECG report', new.doctor_id;
  end if;

  -- snapshot auto-fill if not provided
  if coalesce(nullif(trim(new.interpreted_name), ''), '') = '' then
    -- prefer display_name; else full_name + credentials
    if coalesce(nullif(trim(d_name), ''), '') <> '' then
      snap_name := d_name;
    else
      snap_name := coalesce(nullif(trim(d_full), ''), '');
      if coalesce(nullif(trim(d_creds), ''), '') <> '' then
        if snap_name = '' then
          snap_name := d_creds;
        else
          snap_name := snap_name || ', ' || d_creds;
        end if;
      end if;
      if snap_name = '' then
        snap_name := 'Doctor';
      end if;
    end if;
    new.interpreted_name := snap_name;
  end if;

  if coalesce(nullif(trim(new.interpreted_license), ''), '') = '' then
    -- prefer PRC; else PhilHealth MD ID (if any)
    if coalesce(nullif(trim(d_prc), ''), '') <> '' then
      snap_license := d_prc;
    elsif coalesce(nullif(trim(d_ph_md_id), ''), '') <> '' then
      snap_license := d_ph_md_id;
    else
      snap_license := null;
    end if;
    new.interpreted_license := snap_license;
  end if;

  -- ensure interpreted_at is set
  if new.interpreted_at is null then
    new.interpreted_at := now();
  end if;

  return new;
end
$$;


ALTER FUNCTION "public"."fn_ecg_reports_validate_and_fill"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_section_rmt_for_test"("p_hub_code" "text", "p_analyte_key" "text", "p_date_of_test" "date") RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  with analyte as (
    select section
    from public.ranges
    where analyte_key = p_analyte_key
  )
  select sa.staff_id
  from analyte a
  join public.section_assignments sa
    on sa.section = a.section
   and sa.hub_code = p_hub_code
   and sa.effective_from <= p_date_of_test
   and (sa.effective_to is null or sa.effective_to >= p_date_of_test)
  order by sa.effective_from desc   -- newest applicable assignment wins
  limit 1;
$$;


ALTER FUNCTION "public"."get_section_rmt_for_test"("p_hub_code" "text", "p_analyte_key" "text", "p_date_of_test" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_encounter_checkin"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  insert into public.encounter_events(encounter_id, event_type, actor_role)
  values (new.id, 'checkin', 'system');
  return new;
end$$;


ALTER FUNCTION "public"."log_encounter_checkin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_encounter_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.status is distinct from old.status then
    insert into public.encounter_events(encounter_id, event_type, actor_role)
    values (
      new.id,
      case new.status
        when 'for-extract' then 'queued'
        when 'extracted' then 'start_extraction'
        when 'for-processing' then 'specimen_received'
        when 'done' then 'done'
        when 'cancelled' then 'cancelled'
        else 'status_change'
      end,
      'system'
    );
  end if;
  return new;
end$$;


ALTER FUNCTION "public"."log_encounter_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_config_import"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  merge into config c
  using (
    select btrim(key) as key, coalesce(value,'') as value
    from config_import
    where btrim(coalesce(key,'')) <> ''
  ) i
  on (c.key = i.key)

  when not matched then
    insert (key, value) values (i.key, i.value)

  when matched then update set
    value = i.value;

  truncate table config_import;
end;
$$;


ALTER FUNCTION "public"."merge_config_import"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_patients_import"() RETURNS TABLE("inserted" integer, "updated" integer)
    LANGUAGE "plpgsql"
    AS $$
declare 
  v_ins int := 0;
  v_upd int := 0;
begin
  /* INSERT new rows + UPDATE existing rows (fill blanks only) in one go via CTEs */
  with src as (
    select
      upper(btrim(pi.patient_id))                                   as patient_id,
      clean_blank(pi.full_name)                                     as full_name,
      clean_blank(pi.sex)                                           as sex,
      /* Sheets birthday MM/DD/YYYY -> DATE (nullable-safe) */
      case 
        when clean_blank(pi.birthday) is null then null
        else to_date(clean_blank(pi.birthday), 'MM/DD/YYYY')
      end                                                          as birthday,
      clean_blank(pi.contact)                                       as contact,
      clean_blank(pi.address)                                       as address,
      clean_blank(pi.email)                                         as email,
      clean_blank(pi.height_ft)                                     as height_ft,
      clean_blank(pi.height_inch)                                   as height_inch,
      clean_blank(pi.weight_kg)                                     as weight_kg,
      clean_blank(pi.systolic_bp)                                   as systolic_bp,
      clean_blank(pi.diastolic_bp)                                  as diastolic_bp,
      clean_blank(pi.chief_complaint)                               as chief_complaint,
      clean_blank(pi.present_illness_history)                       as present_illness_history,
      clean_blank(pi.past_medical_history)                          as past_medical_history,
      clean_blank(pi.past_surgical_history)                         as past_surgical_history,
      clean_blank(pi.allergies_text)                                as allergies_text,
      clean_blank(pi.medications_current)                           as medications_current,
      clean_blank(pi.family_hx)                                     as family_hx,
      clean_blank(pi.smoking_hx)                                    as smoking_hx,
      clean_blank(pi.alcohol_hx)                                    as alcohol_hx,
      /* keep as TEXT to match patients.last_updated text */
      clean_blank(pi.last_updated)                                  as last_updated
    from public.patients_import pi
  ),
  src_ok as (
    select * from src where coalesce(patient_id,'') <> ''
  ),
  upd as (
    update public.patients p
       set full_name                 = coalesce(p.full_name,                 s.full_name),
           sex                       = coalesce(p.sex,                       s.sex),
           birthday                  = coalesce(p.birthday,                  s.birthday),
           contact                   = coalesce(p.contact,                   s.contact),
           address                   = coalesce(p.address,                   s.address),
           email                     = coalesce(p.email,                     s.email),
           height_ft                 = coalesce(p.height_ft,                 s.height_ft),
           height_inch               = coalesce(p.height_inch,               s.height_inch),
           weight_kg                 = coalesce(p.weight_kg,                 s.weight_kg),
           systolic_bp               = coalesce(p.systolic_bp,               s.systolic_bp),
           diastolic_bp              = coalesce(p.diastolic_bp,              s.diastolic_bp),
           chief_complaint           = coalesce(p.chief_complaint,           s.chief_complaint),
           present_illness_history   = coalesce(p.present_illness_history,   s.present_illness_history),
           past_medical_history      = coalesce(p.past_medical_history,      s.past_medical_history),
           past_surgical_history     = coalesce(p.past_surgical_history,     s.past_surgical_history),
           allergies_text            = coalesce(p.allergies_text,            s.allergies_text),
           medications_current       = coalesce(p.medications_current,       s.medications_current),
           family_hx                 = coalesce(p.family_hx,                 s.family_hx),
           smoking_hx                = coalesce(p.smoking_hx,                s.smoking_hx),
           alcohol_hx                = coalesce(p.alcohol_hx,                s.alcohol_hx),
           last_updated              = coalesce(p.last_updated,              s.last_updated),
           updated_at                = now()
      from src_ok s
     where p.patient_id = s.patient_id
       /* run only if at least one NULL will be filled */
       and (
            (p.full_name               is null and s.full_name               is not null) or
            (p.sex                     is null and s.sex                     is not null) or
            (p.birthday                is null and s.birthday                is not null) or
            (p.contact                 is null and s.contact                 is not null) or
            (p.address                 is null and s.address                 is not null) or
            (p.email                   is null and s.email                   is not null) or
            (p.height_ft               is null and s.height_ft               is not null) or
            (p.height_inch             is null and s.height_inch             is not null) or
            (p.weight_kg               is null and s.weight_kg               is not null) or
            (p.systolic_bp             is null and s.systolic_bp             is not null) or
            (p.diastolic_bp            is null and s.diastolic_bp            is not null) or
            (p.chief_complaint         is null and s.chief_complaint         is not null) or
            (p.present_illness_history is null and s.present_illness_history is not null) or
            (p.past_medical_history    is null and s.past_medical_history    is not null) or
            (p.past_surgical_history   is null and s.past_surgical_history   is not null) or
            (p.allergies_text          is null and s.allergies_text          is not null) or
            (p.medications_current     is null and s.medications_current     is not null) or
            (p.family_hx               is null and s.family_hx               is not null) or
            (p.smoking_hx              is null and s.smoking_hx              is not null) or
            (p.alcohol_hx              is null and s.alcohol_hx              is not null) or
            (p.last_updated            is null and s.last_updated            is not null)
       )
    returning 1
  ),
  ins as (
    insert into public.patients (
      patient_id, full_name, sex, birthday, contact, address, email,
      height_ft, height_inch, weight_kg, systolic_bp, diastolic_bp,
      chief_complaint, present_illness_history, past_medical_history,
      past_surgical_history, allergies_text, medications_current,
      family_hx, smoking_hx, alcohol_hx, last_updated
    )
    select
      s.patient_id, s.full_name, s.sex, s.birthday, s.contact, s.address, s.email,
      s.height_ft, s.height_inch, s.weight_kg, s.systolic_bp, s.diastolic_bp,
      s.chief_complaint, s.present_illness_history, s.past_medical_history,
      s.past_surgical_history, s.allergies_text, s.medications_current,
      s.family_hx, s.smoking_hx, s.alcohol_hx, s.last_updated
    from src_ok s
    where not exists (select 1 from public.patients p where p.patient_id = s.patient_id)
    returning 1
  )
  select (select count(*) from ins), (select count(*) from upd)
    into v_ins, v_upd;

  /* Delete processed import rows WITHOUT referencing CTEs */
  delete from public.patients_import pi
  where coalesce(upper(btrim(pi.patient_id)),'') <> '';

  return query select v_ins, v_upd;
end;
$$;


ALTER FUNCTION "public"."merge_patients_import"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_ranges_import"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  with cleaned as (
    select
      lower(btrim(analyte_key))                       as analyte_key,
      clean_blank(label)                              as label,
      clean_blank(section)                            as section,
      clean_blank(unit)                               as unit,
      clean_blank(type)                               as type,
      num_or_null(decimals)                           as decimals,
      case
        when clean_blank(sex) is null then ''
        when lower(clean_blank(sex)) in ('any','all','*','both') then ''
        when upper(clean_blank(sex)) like 'M%' then 'M'
        when upper(clean_blank(sex)) like 'F%' then 'F'
        else ''  -- unknown -> treat as both sexes
      end                                             as sex,
      coalesce(num_or_null(age_min), -1)              as age_min,
      coalesce(num_or_null(age_max), 999)             as age_max,
      num_or_null(low)                                as low,
      num_or_null(high)                               as high,
      clean_blank(normal_values)                      as normal_values,
      clean_blank(scaling_order)                      as scaling_order
    from ranges_import
    where btrim(coalesce(analyte_key,'')) <> ''
  ),
  -- keep only ONE row per composite key, preferring rows with more filled fields
  dedup as (
    select distinct on (analyte_key, sex, age_min, age_max)
      analyte_key, label, section, unit, type,
      coalesce(decimals, 0)                           as decimals,
      sex, age_min, age_max, low, high, normal_values, scaling_order
    from cleaned
    order by
      analyte_key, sex, age_min, age_max,
      (label is null),
      (section is null),
      (unit is null),
      (type is null),
      (decimals is null),
      (low is null),
      (high is null),
      (normal_values is null),
      (scaling_order is null)
  )
  merge into ranges r
  using dedup i
  on (r.analyte_key=i.analyte_key and r.sex=i.sex and r.age_min=i.age_min and r.age_max=i.age_max)

  when not matched then
    insert (analyte_key, label, section, unit, type, decimals, sex, age_min, age_max, low, high, normal_values, scaling_order)
    values (i.analyte_key, i.label, i.section, i.unit, i.type, i.decimals, i.sex, i.age_min, i.age_max, i.low, i.high, i.normal_values, i.scaling_order)

  when matched then update set
    label         = coalesce(i.label,         r.label),
    section       = coalesce(i.section,       r.section),
    unit          = coalesce(i.unit,          r.unit),
    type          = coalesce(i.type,          r.type),
    decimals      = coalesce(i.decimals,      r.decimals),
    low           = coalesce(i.low,           r.low),
    high          = coalesce(i.high,          r.high),
    normal_values = coalesce(i.normal_values, r.normal_values),
    scaling_order = coalesce(i.scaling_order, r.scaling_order);

  -- only truncate if everything above succeeded
  truncate table ranges_import;
end;
$$;


ALTER FUNCTION "public"."merge_ranges_import"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."merge_results_wide_import"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$begin
  merge into results_wide t
  using (
    select
      upper(btrim(patient_id)) as patient_id,
      btrim(coalesce(date_of_test,'')) as date_of_test,
      btrim(coalesce(barcode,'')) as barcode,
      -- NEW: pull from import
      encounter_id,                                                    -- NEW
      full_name, age, sex, birthday, contact, address, notes,
      hema_100, hema_wbc, hema_lymph, hema_mid, hema_gran, hema_rbc, hema_hgb, hema_hct,
      hema_mcv, hema_mch, hema_mchc, hema_plt, hema_bt, hema_remarks,
      chem_ogbase, chem_og1st, chem_og2nd, chem_fbs, chem_rbs, chem_chole, chem_trigly,
      chem_hdl, chem_ldl, chem_vldl, chem_bun, chem_crea, chem_bua, chem_ast, chem_alt,
      chem_hba1c, chem_tsh, chem_ft3, chem_ft4, chem_t3, chem_t4, chem_psa, chem_remarks,
      ua_color, ua_trans, ua_glu, ua_pro, ua_ph, ua_sg, ua_blood, ua_bilirubin, ua_urobili,
      ua_ketones, ua_nitrites, ua_le, ua_cast, ua_casttype, ua_crystals, ua_crystalstype,
      ua_epi, ua_muc, ua_ura, ua_pho, ua_bac, ua_pus, ua_rbc, ua_remarks,
      fa_color, fa_cons, fa_pus, fa_rbc, fa_bac, fa_yeast, fa_fat, fa_para, fa_paratype, fa_fobt, fa_remarks,
      sero_dengns1, sero_dengm, sero_dengg, sero_hepab, sero_rpv, sero_hiv, sero_hcv, sero_pt, sero_remarks,
      branch
    from results_wide_import
    where btrim(coalesce(patient_id,'')) <> ''
      and btrim(coalesce(date_of_test,'')) <> ''
      and btrim(coalesce(barcode,'')) <> ''
  ) s
  on (t.patient_id = s.patient_id and t.date_of_test = s.date_of_test and t.barcode = s.barcode)

  when not matched then
    insert (patient_id, date_of_test, barcode,
            encounter_id,                                                   -- NEW (target list)
            full_name, age, sex, birthday, contact, address, notes,
            hema_100, hema_wbc, hema_lymph, hema_mid, hema_gran, hema_rbc, hema_hgb, hema_hct,
            hema_mcv, hema_mch, hema_mchc, hema_plt, hema_bt, hema_remarks,
            chem_ogbase, chem_og1st, chem_og2nd, chem_fbs, chem_rbs, chem_chole, chem_trigly,
            chem_hdl, chem_ldl, chem_vldl, chem_bun, chem_crea, chem_bua, chem_ast, chem_alt,
            chem_hba1c, chem_tsh, chem_ft3, chem_ft4, chem_t3, chem_t4, chem_psa, chem_remarks,
            ua_color, ua_trans, ua_glu, ua_pro, ua_ph, ua_sg, ua_blood, ua_bilirubin, ua_urobili,
            ua_ketones, ua_nitrites, ua_le, ua_cast, ua_casttype, ua_crystals, ua_crystalstype,
            ua_epi, ua_muc, ua_ura, ua_pho, ua_bac, ua_pus, ua_rbc, ua_remarks,
            fa_color, fa_cons, fa_pus, fa_rbc, fa_bac, fa_yeast, fa_fat, fa_para, fa_paratype, fa_fobt, fa_remarks,
            sero_dengns1, sero_dengm, sero_dengg, sero_hepab, sero_rpv, sero_hiv, sero_hcv, sero_pt, sero_remarks,
            branch)
    values (s.patient_id, s.date_of_test, s.barcode,
            s.encounter_id,                                                -- NEW (values)
            s.full_name, s.age, s.sex, s.birthday, s.contact, s.address, s.notes,
            s.hema_100, s.hema_wbc, s.hema_lymph, s.hema_mid, s.hema_gran, s.hema_rbc, s.hema_hgb, s.hema_hct,
            s.hema_mcv, s.hema_mch, s.hema_mchc, s.hema_plt, s.hema_bt, s.hema_remarks,
            s.chem_ogbase, s.chem_og1st, s.chem_og2nd, s.chem_fbs, s.chem_rbs, s.chem_chole, s.chem_trigly,
            s.chem_hdl, s.chem_ldl, s.chem_vldl, s.chem_bun, s.chem_crea, s.chem_bua, s.chem_ast, s.chem_alt,
            s.chem_hba1c, s.chem_tsh, s.chem_ft3, s.chem_ft4, s.chem_t3, s.chem_t4, s.chem_psa, s.chem_remarks,
            s.ua_color, s.ua_trans, s.ua_glu, s.ua_pro, s.ua_ph, s.ua_sg, s.ua_blood, s.ua_bilirubin, s.ua_urobili,
            s.ua_ketones, s.ua_nitrites, s.ua_le, s.ua_cast, s.ua_casttype, s.ua_crystals, s.ua_crystalstype,
            s.ua_epi, s.ua_muc, s.ua_ura, s.ua_pho, s.ua_bac, s.ua_pus, s.ua_rbc, s.ua_remarks,
            s.fa_color, s.fa_cons, s.fa_pus, s.fa_rbc, s.fa_bac, s.fa_yeast, s.fa_fat, s.fa_para, s.fa_paratype, s.fa_fobt, s.fa_remarks,
            s.sero_dengns1, s.sero_dengm, s.sero_dengg, s.sero_hepab, s.sero_rpv, s.sero_hiv, s.sero_hcv, s.sero_pt, s.sero_remarks,
            s.branch)

  when matched then
    update set
      encounter_id = coalesce(s.encounter_id, t.encounter_id),              -- NEW: keep existing if s.encounter_id null
      full_name=s.full_name, age=s.age, sex=s.sex, birthday=s.birthday, contact=s.contact, address=s.address, notes=s.notes,
      hema_100=s.hema_100, hema_wbc=s.hema_wbc, hema_lymph=s.hema_lymph, hema_mid=s.hema_mid, hema_gran=s.hema_gran, hema_rbc=s.hema_rbc, hema_hgb=s.hema_hgb, hema_hct=s.hema_hct,
      hema_mcv=s.hema_mcv, hema_mch=s.hema_mch, hema_mchc=s.hema_mchc, hema_plt=s.hema_plt, hema_bt=s.hema_bt, hema_remarks=s.hema_remarks,
      chem_ogbase=s.chem_ogbase, chem_og1st=s.chem_og1st, chem_og2nd=s.chem_og2nd, chem_fbs=s.chem_fbs, chem_rbs=s.chem_rbs, chem_chole=s.chem_chole, chem_trigly=s.chem_trigly,
      chem_hdl=s.chem_hdl, chem_ldl=s.chem_ldl, chem_vldl=s.chem_vldl, chem_bun=s.chem_bun, chem_crea=s.chem_crea, chem_bua=s.chem_bua, chem_ast=s.chem_ast, chem_alt=s.chem_alt,
      chem_hba1c=s.chem_hba1c, chem_tsh=s.chem_tsh, chem_ft3=s.chem_ft3, chem_ft4=s.chem_ft4, chem_t3=s.chem_t3, chem_t4=s.chem_t4, chem_psa=s.chem_psa, chem_remarks=s.chem_remarks,
      ua_color=s.ua_color, ua_trans=s.ua_trans, ua_glu=s.ua_glu, ua_pro=s.ua_pro, ua_ph=s.ua_ph, ua_sg=s.ua_sg, ua_blood=s.ua_blood, ua_bilirubin=s.ua_bilirubin, ua_urobili=s.ua_urobili,
      ua_ketones=s.ua_ketones, ua_nitrites=s.ua_nitrites, ua_le=s.ua_le, ua_cast=s.ua_cast, ua_casttype=s.ua_casttype, ua_crystals=s.ua_crystals, ua_crystalstype=s.ua_crystalstype,
      ua_epi=s.ua_epi, ua_muc=s.ua_muc, ua_ura=s.ua_ura, ua_pho=s.ua_pho, ua_bac=s.ua_bac, ua_pus=s.ua_pus, ua_rbc=s.ua_rbc, ua_remarks=s.ua_remarks,
      fa_color=s.fa_color, fa_cons=s.fa_cons, fa_pus=s.fa_pus, fa_rbc=s.fa_rbc, fa_bac=s.fa_bac, fa_yeast=s.fa_yeast, fa_fat=s.fa_fat, fa_para=s.fa_para, fa_paratype=s.fa_paratype, fa_fobt=s.fa_fobt, fa_remarks=s.fa_remarks,
      sero_dengns1=s.sero_dengns1, sero_dengm=s.sero_dengm, sero_dengg=s.sero_dengg, sero_hepab=s.sero_hepab, sero_rpv=s.sero_rpv, sero_hiv=s.sero_hiv, sero_hcv=s.sero_hcv, sero_pt=s.sero_pt, sero_remarks=s.sero_remarks,
      branch=s.branch;

  -- Clear staging so repeated uploads are always fresh
  truncate table results_wide_import;
end;$$;


ALTER FUNCTION "public"."merge_results_wide_import"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_results_flat"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.patient_id   := upper(btrim(new.patient_id));
  new.barcode      := btrim(coalesce(new.barcode,''));
  new.date_of_test := btrim(coalesce(new.date_of_test,''));
  new.analyte_key  := lower(btrim(new.analyte_key)); -- keys are snake_case
  return new;
end; $$;


ALTER FUNCTION "public"."normalize_results_flat"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_results_wide"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.patient_id   := upper(btrim(new.patient_id));
  new.barcode      := btrim(coalesce(new.barcode,''));
  new.date_of_test := btrim(coalesce(new.date_of_test,''));
  return new;
end; $$;


ALTER FUNCTION "public"."normalize_results_wide"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."num_or_null"("t" "text") RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
declare s text;
begin
  s := clean_blank(t);
  if s is null then return null; end if;
  if s ~ '^\s*-?\d+(\.\d+)?\s*$' then
    return s::numeric;
  end if;
  return null;
end; $_$;


ALTER FUNCTION "public"."num_or_null"("t" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."patients_uppercase_pid"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.patient_id := upper(btrim(new.patient_id));
  return new;
end; $$;


ALTER FUNCTION "public"."patients_uppercase_pid"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_patient_ages"() RETURNS "void"
    LANGUAGE "sql"
    AS $$
  update public.patients
  set age = floor(extract(year from age(current_date, birthday)))
  where birthday is not null
    -- only touch rows that actually need a change:
    and age is distinct from floor(extract(year from age(current_date, birthday)));
$$;


ALTER FUNCTION "public"."recompute_patient_ages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_results_flat_from_wide"("p_since" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_limit" integer DEFAULT NULL::integer) RETURNS TABLE("inserted" integer, "updated" integer)
    LANGUAGE "plpgsql"
    AS $$
declare
  v_ins int := 0;
  v_upd int := 0;
begin
  -- be gentle about locks
  perform set_config('lock_timeout','2s', true);

  with
  -- Only the analyte keys we care about
  rkeys as (
    select distinct analyte_key from ranges
  ),

  -- Narrow results_wide to recently changed rows; optionally cap volume
  wide as (
    select *
    from results_wide w
    where p_since is null or w.updated_at >= p_since
    order by w.updated_at
    limit coalesce(p_limit, 2147483647)
  ),

  -- Explode wide → tall using keys present in JSONB
  src as (
    select
      upper(btrim(w.patient_id))                   as patient_id,
      btrim(coalesce(w.date_of_test,''))           as date_of_test,
      btrim(coalesce(w.barcode,''))                as barcode,
      r.analyte_key,
      nullif(trim(to_jsonb(w)->>r.analyte_key),'') as value,
      w.notes,
      w.branch,
      w.encounter_id                               as encounter_id
    from wide w
    join rkeys r on (to_jsonb(w) ? r.analyte_key)
  ),

  -- Basic validations
  src_ok as (
    select *
    from src
    where value is not null
      and patient_id <> ''
      and date_of_test <> ''
  ),

  -- Deduplicate within this batch
  src_uniq as (
    select
      patient_id, date_of_test, barcode, analyte_key,
      max(value)        as value,
      max(notes)        as notes,
      max(branch)       as branch,
      max(encounter_id) as encounter_id
    from src_ok
    group by 1,2,3,4
  ),

  -- Only perform updates that actually change something
  upd as (
    update results_flat f
       set value        = s.value,
           notes        = s.notes,
           branch       = s.branch,
           encounter_id = coalesce(s.encounter_id, f.encounter_id),
           updated_at   = now()
           -- NOTE: we intentionally do NOT touch performed_by_staff_id here,
           -- so the original performer remains the same even if values/notes change.
      from src_uniq s
     where f.patient_id   = s.patient_id
       and f.date_of_test = s.date_of_test
       and f.barcode      = s.barcode
       and f.analyte_key  = s.analyte_key
       and (
            f.value        is distinct from s.value
         or f.notes        is distinct from s.notes
         or f.branch       is distinct from s.branch
         or (s.encounter_id is not null and f.encounter_id is distinct from s.encounter_id)
       )
    returning 1
  ),

  -- Insert only genuinely new rows (anti-join is faster than NOT EXISTS on big tables)
  ins as (
    insert into results_flat (
      patient_id,
      date_of_test,
      barcode,
      analyte_key,
      value,
      notes,
      branch,
      encounter_id,
      performed_by_staff_id       -- NEW: tag performer at insert time
    )
    select
      s.patient_id,
      s.date_of_test,
      s.barcode,
      s.analyte_key,
      s.value,
      s.notes,
      s.branch,
      s.encounter_id,
      -- NEW: resolve RMT based on hub/branch, analyte, and date_of_test (Option B)
      public.get_section_rmt_for_test(
        s.branch,                 -- assumes branch matches hubs.code
        s.analyte_key,
        s.date_of_test::date      -- date_of_test is text; cast to date
      ) as performed_by_staff_id
    from src_uniq s
    left join results_flat f
      on  f.patient_id   = s.patient_id
      and f.date_of_test = s.date_of_test
      and f.barcode      = s.barcode
      and f.analyte_key  = s.analyte_key
    where f.patient_id is null
    returning 1
  )

  select (select count(*) from ins), (select count(*) from upd)
  into v_ins, v_upd;

  return query select v_ins, v_upd;
end;
$$;


ALTER FUNCTION "public"."refresh_results_flat_from_wide"("p_since" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_age_from_birthday"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.birthday IS NULL THEN
    NEW.age := NULL;
  ELSE
    NEW.age := FLOOR(EXTRACT(year FROM age(current_date, NEW.birthday)));
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_age_from_birthday"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_current_timestamp_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_last_updated_ph"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.last_updated := timezone('Asia/Manila', now());
  return new;
end;
$$;


ALTER FUNCTION "public"."set_last_updated_ph"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_note_templates_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


ALTER FUNCTION "public"."set_note_templates_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."supplies_dispense"("p_branch_code" "text", "p_item_id" "uuid", "p_qty_pcs" integer, "p_staff_id" "uuid" DEFAULT NULL::"uuid", "p_patient_id" "uuid" DEFAULT NULL::"uuid", "p_encounter_id" "uuid" DEFAULT NULL::"uuid", "p_reference" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text") RETURNS TABLE("inventory_id" "uuid", "remaining_pcs" integer)
    LANGUAGE "plpgsql"
    AS $$
declare
  v_inventory_id uuid;
  v_remaining integer;
begin
  if p_qty_pcs is null or p_qty_pcs <= 0 then
    raise exception 'qty must be > 0';
  end if;

  -- Lock the inventory row for this branch+item
  select si.id, si.remaining_pcs
    into v_inventory_id, v_remaining
  from public.supplies_inventory si
  where si.branch_code = p_branch_code
    and si.item_id = p_item_id
  for update;

  if v_inventory_id is null then
    raise exception 'No inventory row for branch % and item %', p_branch_code, p_item_id;
  end if;

  if v_remaining < p_qty_pcs then
    raise exception 'Insufficient stock. Remaining %, requested %', v_remaining, p_qty_pcs;
  end if;

  update public.supplies_inventory
    set remaining_pcs = remaining_pcs - p_qty_pcs,
        last_dispensed_at = now(),
        updated_by_staff_id = p_staff_id
  where id = v_inventory_id;

  insert into public.supplies_dispenses (
    inventory_id,
    qty_pcs,
    dispensed_by_staff_id,
    patient_id,
    encounter_id,
    reference,
    notes
  ) values (
    v_inventory_id,
    p_qty_pcs,
    p_staff_id,
    p_patient_id,
    p_encounter_id,
    p_reference,
    p_notes
  );

  select si.remaining_pcs into v_remaining
  from public.supplies_inventory si
  where si.id = v_inventory_id;

  inventory_id := v_inventory_id;
  remaining_pcs := v_remaining;
  return next;
end;
$$;


ALTER FUNCTION "public"."supplies_dispense"("p_branch_code" "text", "p_item_id" "uuid", "p_qty_pcs" integer, "p_staff_id" "uuid", "p_patient_id" "uuid", "p_encounter_id" "uuid", "p_reference" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."supplies_dispense_fefo"("p_branch_code" "text", "p_item_id" "uuid", "p_qty_pcs" integer, "p_staff_id" "uuid" DEFAULT NULL::"uuid", "p_patient_id" "uuid" DEFAULT NULL::"uuid", "p_encounter_id" "uuid" DEFAULT NULL::"uuid", "p_reference" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text") RETURNS TABLE("dispensed_total" integer, "remaining_after_available" integer)
    LANGUAGE "plpgsql"
    AS $$
declare
  v_need int := p_qty_pcs;
  v_batch record;
  v_take int;
  v_remaining_available int;
begin
  if p_qty_pcs is null or p_qty_pcs <= 0 then
    raise exception 'qty must be > 0';
  end if;

  -- Total AVAILABLE across non-expired batches
  select coalesce(sum(remaining_pcs), 0)::int
    into v_remaining_available
  from public.supplies_batches
  where branch_code = p_branch_code
    and item_id = p_item_id
    and remaining_pcs > 0
    and expiry_date >= current_date;

  if v_remaining_available < v_need then
    raise exception 'Insufficient AVAILABLE stock. Remaining %, requested %', v_remaining_available, v_need;
  end if;

  -- Consume earliest AVAILABLE expiry first (FEFO)
  for v_batch in
    select id, remaining_pcs, expiry_date
    from public.supplies_batches
    where branch_code = p_branch_code
      and item_id = p_item_id
      and remaining_pcs > 0
      and expiry_date >= current_date
    order by expiry_date asc, created_at asc
    for update
  loop
    exit when v_need <= 0;

    v_take := least(v_need, v_batch.remaining_pcs);

    update public.supplies_batches
      set remaining_pcs = remaining_pcs - v_take,
          updated_by_staff_id = p_staff_id
    where id = v_batch.id;

    insert into public.supplies_dispenses (
      batch_id,
      qty_pcs,
      dispensed_by_staff_id,
      patient_id,
      encounter_id,
      reference,
      notes
    ) values (
      v_batch.id,
      v_take,
      p_staff_id,
      p_patient_id,
      p_encounter_id,
      p_reference,
      p_notes
    );

    v_need := v_need - v_take;
  end loop;

  -- Remaining AVAILABLE after dispense
  select coalesce(sum(remaining_pcs), 0)::int
    into v_remaining_available
  from public.supplies_batches
  where branch_code = p_branch_code
    and item_id = p_item_id
    and remaining_pcs > 0
    and expiry_date >= current_date;

  dispensed_total := p_qty_pcs;
  remaining_after_available := v_remaining_available;
  return next;
end;
$$;


ALTER FUNCTION "public"."supplies_dispense_fefo"("p_branch_code" "text", "p_item_id" "uuid", "p_qty_pcs" integer, "p_staff_id" "uuid", "p_patient_id" "uuid", "p_encounter_id" "uuid", "p_reference" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."supplies_receive"("p_branch_code" "text", "p_item_id" "uuid", "p_added_pcs" integer, "p_expiry_date" "date", "p_staff_id" "uuid" DEFAULT NULL::"uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS TABLE("batch_id" "uuid", "remaining_pcs" integer)
    LANGUAGE "plpgsql"
    AS $$
declare
  v_id uuid;
  v_remaining int;
begin
  if p_added_pcs is null or p_added_pcs <= 0 then
    raise exception 'added pcs must be > 0';
  end if;
  if p_expiry_date is null then
    raise exception 'expiry_date is required';
  end if;

  -- Try to lock existing batch for same expiry
  select sb.id, sb.remaining_pcs
    into v_id, v_remaining
  from public.supplies_batches sb
  where sb.branch_code = p_branch_code
    and sb.item_id = p_item_id
    and sb.expiry_date = p_expiry_date
  for update;

  if v_id is null then
    insert into public.supplies_batches as sb (
      branch_code, item_id, expiry_date,
      total_pcs, remaining_pcs,
      created_by_staff_id, updated_by_staff_id
    ) values (
      p_branch_code, p_item_id, p_expiry_date,
      p_added_pcs, p_added_pcs,
      p_staff_id, p_staff_id
    )
    returning sb.id, sb.remaining_pcs into v_id, v_remaining;
  else
    update public.supplies_batches sb
      set total_pcs = sb.total_pcs + p_added_pcs,
          remaining_pcs = sb.remaining_pcs + p_added_pcs,
          updated_by_staff_id = p_staff_id
    where sb.id = v_id;

    select sb.remaining_pcs
      into v_remaining
    from public.supplies_batches sb
    where sb.id = v_id;
  end if;

  batch_id := v_id;
  remaining_pcs := v_remaining;
  return next;
end;
$$;


ALTER FUNCTION "public"."supplies_receive"("p_branch_code" "text", "p_item_id" "uuid", "p_added_pcs" integer, "p_expiry_date" "date", "p_staff_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_patient_flat_vitals"("p_patient_id" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  v record;
  new_height_ft integer;
  new_height_inch integer;
  height_cm_val numeric(5,2);
begin
  select *
    into v
  from public.vitals_latest_per_patient
  where patient_id = p_patient_id;

  if not found then
    update public.patients
       set height_ft   = null,
           height_inch = null,
           weight_kg   = null,
           systolic_bp = null,
           diastolic_bp= null,
           last_updated = to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD"T"HH24:MI:SS')
     where patient_id = p_patient_id;
    return;
  end if;

  height_cm_val := v.height_cm;
  if height_cm_val is not null then
    new_height_ft := floor(height_cm_val / 30.48);
    new_height_inch := round((height_cm_val - (new_height_ft * 30.48)) / 2.54);
  else
    new_height_ft := null;
    new_height_inch := null;
  end if;

  update public.patients p
     set height_ft   = case when height_cm_val is not null then new_height_ft::text else null end,
         height_inch = case when height_cm_val is not null then new_height_inch::text else null end,
         weight_kg   = case when v.weight_kg is not null then v.weight_kg::text else null end,
         systolic_bp = case when v.systolic_bp is not null then v.systolic_bp::text else null end,
         diastolic_bp= case when v.diastolic_bp is not null then v.diastolic_bp::text else null end,
         last_updated = to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD"T"HH24:MI:SS')
   where p.patient_id = p_patient_id;
end;
$$;


ALTER FUNCTION "public"."sync_patient_flat_vitals"("p_patient_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_psm_auto_enable_from_patient_vitals"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  has_bp boolean;
  has_weight boolean;
  has_glucose boolean;
begin
  if new.source <> 'patient' then
    return new;
  end if;

  has_bp := (new.systolic_bp is not null) or (new.diastolic_bp is not null);
  has_weight := (new.weight_kg is not null);
  has_glucose := (new.blood_glucose_mgdl is not null);

  if has_bp then
    insert into public.patient_self_monitoring (
      patient_id, parameter_key, enabled, doctor_requested,
      consultation_id, encounter_id,
      last_set_by, last_set_by_user, last_set_at
    )
    values (
      new.patient_id, 'bp', true, false,
      new.consultation_id, new.encounter_id,
      'patient', new.created_by, now()
    )
    on conflict (patient_id, parameter_key)
    do update set
      enabled = true,
      -- do not overwrite doctor_requested if already true
      doctor_requested = public.patient_self_monitoring.doctor_requested,
      -- keep the strongest context we have
      encounter_id = coalesce(excluded.encounter_id, public.patient_self_monitoring.encounter_id),
      consultation_id = coalesce(excluded.consultation_id, public.patient_self_monitoring.consultation_id),
      last_set_by = 'patient',
      last_set_by_user = excluded.last_set_by_user,
      last_set_at = now();
  end if;

  if has_weight then
    insert into public.patient_self_monitoring (
      patient_id, parameter_key, enabled, doctor_requested,
      consultation_id, encounter_id,
      last_set_by, last_set_by_user, last_set_at
    )
    values (
      new.patient_id, 'weight', true, false,
      new.consultation_id, new.encounter_id,
      'patient', new.created_by, now()
    )
    on conflict (patient_id, parameter_key)
    do update set
      enabled = true,
      doctor_requested = public.patient_self_monitoring.doctor_requested,
      encounter_id = coalesce(excluded.encounter_id, public.patient_self_monitoring.encounter_id),
      consultation_id = coalesce(excluded.consultation_id, public.patient_self_monitoring.consultation_id),
      last_set_by = 'patient',
      last_set_by_user = excluded.last_set_by_user,
      last_set_at = now();
  end if;

  if has_glucose then
    insert into public.patient_self_monitoring (
      patient_id, parameter_key, enabled, doctor_requested,
      consultation_id, encounter_id,
      last_set_by, last_set_by_user, last_set_at
    )
    values (
      new.patient_id, 'glucose', true, false,
      new.consultation_id, new.encounter_id,
      'patient', new.created_by, now()
    )
    on conflict (patient_id, parameter_key)
    do update set
      enabled = true,
      doctor_requested = public.patient_self_monitoring.doctor_requested,
      encounter_id = coalesce(excluded.encounter_id, public.patient_self_monitoring.encounter_id),
      consultation_id = coalesce(excluded.consultation_id, public.patient_self_monitoring.consultation_id),
      last_set_by = 'patient',
      last_set_by_user = excluded.last_set_by_user,
      last_set_at = now();
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."tg_psm_auto_enable_from_patient_vitals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."tg_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_vitals_autofill_and_bmi"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  last_height numeric(5,2);
  height_m numeric;
begin
  -- If height missing, try carry-forward latest height for this patient.
  if new.height_cm is null and new.patient_id is not null then
    select vs.height_cm
      into last_height
    from public.vitals_snapshots vs
    where vs.patient_id = new.patient_id
      and vs.height_cm is not null
      and (tg_op = 'INSERT' or vs.id <> new.id)
    order by vs.measured_at desc
    limit 1;

    if last_height is not null then
      new.height_cm := last_height;
    end if;
  end if;

  -- Auto-calc BMI if weight + height available.
  if new.weight_kg is not null and new.height_cm is not null then
    height_m := (new.height_cm / 100.0);
    if height_m > 0 then
      new.bmi := round((new.weight_kg / (height_m * height_m))::numeric, 2);
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."tg_vitals_autofill_and_bmi"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_vitals_snapshots_sync_patients"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.sync_patient_flat_vitals(coalesce(new.patient_id, old.patient_id));
  return null;
end;
$$;


ALTER FUNCTION "public"."tg_vitals_snapshots_sync_patients"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."config" (
    "key" "text" NOT NULL,
    "value" "text"
);


ALTER TABLE "public"."config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."config_import" (
    "key" "text",
    "value" "text"
);


ALTER TABLE "public"."config_import" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consent_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "version" integer NOT NULL,
    "body" "text" NOT NULL,
    "effective_from" "date" NOT NULL,
    "retired_at" "date"
);


ALTER TABLE "public"."consent_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consultation_diagnoses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "consultation_id" "uuid" NOT NULL,
    "encounter_id" "uuid" NOT NULL,
    "patient_id" "text" NOT NULL,
    "icd10_code" "text" NOT NULL,
    "icd10_text_snapshot" "text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "certainty" "text",
    "acuity" "text",
    "onset_date" "date",
    "resolved_date" "date",
    "notes" "text",
    "source" "text" DEFAULT 'doctor'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."consultation_diagnoses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doctor_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "consultation_id" "uuid" NOT NULL,
    "notes_markdown" "text",
    "notes_soap" "jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."doctor_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."doctors" (
    "doctor_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text",
    "display_name" "text",
    "pin_hash" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "full_name" "text",
    "credentials" "text",
    "specialty" "text",
    "affiliations" "text",
    "prc_no" "text",
    "ptr_no" "text",
    "s2_no" "text",
    "signature_image_url" "text",
    "philhealth_md_id" "text"
);


ALTER TABLE "public"."doctors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ecg_cases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "text" NOT NULL,
    "encounter_id" "uuid",
    "external_result_id" "uuid",
    "uploaded_by" "text" NOT NULL,
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "note" "text",
    CONSTRAINT "ecg_cases_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_review'::"text", 'signed'::"text", 'returned'::"text"])))
);


ALTER TABLE "public"."ecg_cases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ecg_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "text" NOT NULL,
    "external_result_id" "uuid" NOT NULL,
    "encounter_id" "uuid" NOT NULL,
    "doctor_id" "uuid" NOT NULL,
    "interpreted_name" "text" NOT NULL,
    "interpreted_license" "text",
    "interpreted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rhythm" "text",
    "heart_rate" "text",
    "pr_interval" "text",
    "qrs_duration" "text",
    "qtc" "text",
    "axis" "text",
    "findings" "text",
    "impression" "text" NOT NULL,
    "recommendations" "text",
    "status" "text" DEFAULT 'final'::"text" NOT NULL
);


ALTER TABLE "public"."ecg_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."encounter_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "encounter_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "actor_role" "text",
    "actor_id" "text",
    "ts" timestamp with time zone DEFAULT "now"(),
    "remarks" "text"
);


ALTER TABLE "public"."encounter_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."encounter_orders" (
    "encounter_id" "uuid" NOT NULL,
    "notes" "text"
);


ALTER TABLE "public"."encounter_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."encounters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "text" NOT NULL,
    "branch_code" "text" NOT NULL,
    "visit_date_local" "date" NOT NULL,
    "status" "text" DEFAULT 'intake'::"text" NOT NULL,
    "priority" integer DEFAULT 0,
    "is_philhealth_claim" boolean DEFAULT false,
    "yakap_flag" boolean DEFAULT false,
    "claim_notes" "text",
    "notes_frontdesk" "text",
    "locked_to_rmt" boolean DEFAULT false,
    "staging_synced" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "total_price" numeric(12,2),
    "price_auto_total" numeric(12,2),
    "price_manual_add" numeric(12,2),
    "visited_at" timestamp with time zone,
    "consult_status" "text",
    "queue_number" integer,
    "for_consult" boolean DEFAULT false NOT NULL,
    "current_consultation_id" "uuid",
    "in_consult_started_at" timestamp with time zone,
    "case_no" "text",
    "tcn" "text",
    "discount_enabled" boolean DEFAULT false NOT NULL,
    "discount_rate" numeric DEFAULT 0.2 NOT NULL,
    "discount_amount" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "encounters_branch_code_check" CHECK (("branch_code" = ANY (ARRAY['SI'::"text", 'SL'::"text"]))),
    CONSTRAINT "encounters_consult_status_check" CHECK ((("consult_status" IS NULL) OR ("consult_status" = ANY (ARRAY['queued_for_consult'::"text", 'in_consult'::"text", 'done'::"text", 'cancelled'::"text"])))),
    CONSTRAINT "encounters_discount_amount_nonnegative" CHECK (("discount_amount" >= 0)),
    CONSTRAINT "encounters_status_check" CHECK (("status" = ANY (ARRAY['intake'::"text", 'for-extract'::"text", 'extracted'::"text", 'for-processing'::"text", 'done'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."encounters" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."encounters_today_v" AS
 SELECT "id",
    "patient_id",
    "branch_code",
    "visit_date_local",
    "status",
    "priority",
    "is_philhealth_claim",
    "yakap_flag",
    "claim_notes",
    "notes_frontdesk",
    "locked_to_rmt",
    "staging_synced",
    "created_at",
    "updated_at"
   FROM "public"."encounters"
  WHERE (("visit_date_local" = ("timezone"('Asia/Manila'::"text", "now"()))::"date") AND ("status" <> 'cancelled'::"text"));


ALTER VIEW "public"."encounters_today_v" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."external_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "text" NOT NULL,
    "provider" "text",
    "taken_at" "date",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "uploaded_by" "text",
    "note" "text",
    "url" "text" NOT NULL,
    "content_type" "text",
    "type" "text" NOT NULL,
    "encounter_id" "uuid",
    "category" "text" DEFAULT 'other'::"text" NOT NULL,
    "subtype" "text",
    "impression" "text",
    "reported_at" timestamp with time zone,
    "performer_name" "text",
    "performer_role" "text",
    "performer_license" "text",
    "source" "text" DEFAULT 'upload'::"text" NOT NULL,
    CONSTRAINT "external_results_type_not_blank" CHECK (("length"(TRIM(BOTH FROM "type")) > 0))
);


ALTER TABLE "public"."external_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."followup_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "followup_id" "uuid" NOT NULL,
    "attempted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "channel" "text" NOT NULL,
    "outcome" "text" NOT NULL,
    "notes" "text",
    "attempted_by_name" "text",
    "staff_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."followup_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."followups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "text" NOT NULL,
    "created_from_consultation_id" "uuid" NOT NULL,
    "closed_by_consultation_id" "uuid",
    "return_branch" "text",
    "due_date" "date" NOT NULL,
    "tolerance_days" integer DEFAULT 7 NOT NULL,
    "valid_until" "date" GENERATED ALWAYS AS (("due_date" + '30 days'::interval)) STORED,
    "intended_outcome" "text",
    "expected_tests" "text",
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "cancel_reason" "text",
    "completion_note" "text",
    "created_by" "text",
    "updated_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."followups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hubs" (
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "contact" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "kpp_id" "text",
    "hci_accreditation_no" "text"
);


ALTER TABLE "public"."hubs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."icd10" (
    "code" "text" NOT NULL,
    "title" "text" NOT NULL
);


ALTER TABLE "public"."icd10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."icd10_catalog" (
    "icd10_code" "text" NOT NULL,
    "short_title" "text",
    "long_title" "text",
    "chapter" "text",
    "block" "text",
    "is_billable" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."icd10_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medical_certificate_supporting_items" (
    "id" bigint NOT NULL,
    "certificate_id" "uuid" NOT NULL,
    "ordinal" integer DEFAULT 0 NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "text",
    "label" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."medical_certificate_supporting_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."medical_certificate_supporting_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."medical_certificate_supporting_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."medical_certificate_supporting_items_id_seq" OWNED BY "public"."medical_certificate_supporting_items"."id";



CREATE TABLE IF NOT EXISTS "public"."medical_certificates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "certificate_no" "text" NOT NULL,
    "patient_id" "text" NOT NULL,
    "encounter_id" "uuid" NOT NULL,
    "consultation_id" "uuid" NOT NULL,
    "issued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valid_until" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "patient_full_name" "text" NOT NULL,
    "patient_birthdate" "date",
    "patient_age" numeric,
    "patient_sex" "text",
    "patient_address" "text",
    "diagnosis_source" "text" DEFAULT 'consultation'::"text" NOT NULL,
    "diagnosis_text" "text",
    "remarks" "text",
    "advice" "text",
    "findings_summary" "text",
    "physical_exam" "jsonb" NOT NULL,
    "supporting_data" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "patient_snapshot" "jsonb" NOT NULL,
    "consultation_snapshot" "jsonb",
    "doctor_snapshot" "jsonb" NOT NULL,
    "doctor_id" "uuid" NOT NULL,
    "doctor_branch" "text",
    "qr_token" "text" NOT NULL,
    "verification_code" "text" NOT NULL,
    "printed_at" timestamp with time zone,
    "void_reason" "text",
    "created_by_doctor_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "medical_certificates_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'issued'::"text", 'void'::"text"])))
);


ALTER TABLE "public"."medical_certificates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "generic_name" "text",
    "strength" "text",
    "form" "text",
    "price" numeric(10,2),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."meds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."note_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "doctor_id" "uuid",
    "title" "text" NOT NULL,
    "template_type" "text" NOT NULL,
    "soap_template" "jsonb",
    "markdown_template" "text",
    "is_system" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "note_templates_content_check" CHECK (((("template_type" = 'SOAP'::"text") AND ("soap_template" IS NOT NULL)) OR (("template_type" = 'MARKDOWN'::"text") AND ("markdown_template" IS NOT NULL)))),
    CONSTRAINT "note_templates_template_type_check" CHECK (("template_type" = ANY (ARRAY['SOAP'::"text", 'MARKDOWN'::"text"])))
);


ALTER TABLE "public"."note_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."note_templates" IS 'Reusable templates for doctor notes (SOAP or Markdown/Free Text).';



COMMENT ON COLUMN "public"."note_templates"."soap_template" IS 'JSONB object with keys S, O, A, P for SOAP-style notes.';



COMMENT ON COLUMN "public"."note_templates"."markdown_template" IS 'Free-text/Markdown template for notes_markdown.';



CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "encounter_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "code_or_name" "text" NOT NULL,
    "qty" integer DEFAULT 1,
    "unit_price" numeric(12,2),
    "price_override" numeric(12,2),
    "source" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "order_items_kind_check" CHECK (("kind" = ANY (ARRAY['test'::"text", 'package'::"text", 'manual'::"text"]))),
    CONSTRAINT "order_items_source_check" CHECK (("source" = ANY (ARRAY['frontdesk'::"text", 'rmt'::"text"])))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."package_items" (
    "package_code" "text" NOT NULL,
    "test_code" "text" NOT NULL,
    "package_id" "uuid" NOT NULL,
    "test_id" "uuid" NOT NULL
);


ALTER TABLE "public"."package_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packages" (
    "package_code" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "package_price" numeric(12,2),
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "encounter_id" "uuid" NOT NULL,
    "consultation_id" "uuid" NOT NULL,
    "patient_id" "text" NOT NULL,
    "doctor_id" "uuid" NOT NULL,
    "template_slug" "text" NOT NULL,
    "template_version" integer NOT NULL,
    "doctor_attest" boolean DEFAULT false NOT NULL,
    "doctor_signature_url" "text",
    "patient_method" "text" NOT NULL,
    "patient_signature_url" "text",
    "patient_typed_name" "text",
    "consent_hash" "text" NOT NULL,
    "ip_hash" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "signer_kind" "text" DEFAULT 'patient'::"text",
    "signer_name" "text",
    "signer_relation" "text",
    CONSTRAINT "patient_consents_patient_method_check" CHECK (("patient_method" = ANY (ARRAY['drawn'::"text", 'typed'::"text"]))),
    CONSTRAINT "patient_consents_signer_kind_check" CHECK (("signer_kind" = ANY (ARRAY['patient'::"text", 'guardian'::"text", 'representative'::"text"])))
);


ALTER TABLE "public"."patient_consents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_pin_reset_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "text" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."patient_pin_reset_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_self_monitoring" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "text" NOT NULL,
    "parameter_key" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "doctor_requested" boolean DEFAULT false NOT NULL,
    "frequency" "text",
    "instructions" "text",
    "consultation_id" "uuid",
    "encounter_id" "uuid",
    "doctor_id" "uuid",
    "last_set_by" "text" DEFAULT 'system'::"text" NOT NULL,
    "last_set_by_user" "uuid",
    "last_set_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "patient_self_monitoring_parameter_key_check" CHECK (("parameter_key" = ANY (ARRAY['bp'::"text", 'weight'::"text", 'glucose'::"text"])))
);


ALTER TABLE "public"."patient_self_monitoring" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patients" (
    "patient_id" "text" NOT NULL,
    "full_name" "text",
    "sex" "text",
    "birthday" "date",
    "contact" "text",
    "address" "text",
    "email" "text",
    "height_ft" "text",
    "height_inch" "text",
    "weight_kg" "text",
    "systolic_bp" "text",
    "diastolic_bp" "text",
    "chief_complaint" "text",
    "present_illness_history" "text",
    "past_medical_history" "text",
    "past_surgical_history" "text",
    "allergies_text" "text",
    "medications_current" "text",
    "family_hx" "text",
    "smoking_hx" "text",
    "alcohol_hx" "text",
    "last_updated" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "age" integer,
    "philhealth_pin" "text",
    "membership_type" "text",
    "atc_code" "text",
    "delivery_address_label" "text",
    "delivery_address_text" "text",
    "delivery_lat" numeric(10,7),
    "delivery_lng" numeric(10,7),
    "delivery_notes" "text",
    "last_delivery_used_at" timestamp with time zone,
    "last_delivery_success_at" timestamp with time zone,
    "pin_hash" "text",
    "pin_set_at" timestamp with time zone,
    "last_login_at" timestamp with time zone
);


ALTER TABLE "public"."patients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patients_import" (
    "patient_id" "text" NOT NULL,
    "full_name" "text",
    "age" "text",
    "sex" "text",
    "birthday" "text",
    "contact" "text",
    "address" "text",
    "email" "text",
    "height_ft" "text",
    "height_inch" "text",
    "weight_kg" "text",
    "systolic_bp" "text",
    "diastolic_bp" "text",
    "chief_complaint" "text",
    "present_illness_history" "text",
    "past_medical_history" "text",
    "past_surgical_history" "text",
    "allergies_text" "text",
    "medications_current" "text",
    "family_hx" "text",
    "smoking_hx" "text",
    "alcohol_hx" "text",
    "last_updated" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."patients_import" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prescription_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "prescription_id" "uuid" NOT NULL,
    "med_id" "uuid",
    "generic_name" "text",
    "strength" "text",
    "form" "text",
    "route" "text",
    "dose_amount" numeric,
    "dose_unit" "text",
    "frequency_code" "text",
    "duration_days" integer,
    "quantity" numeric,
    "instructions" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "unit_price" numeric,
    "brand_name" "text"
);


ALTER TABLE "public"."prescription_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prescriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "consultation_id" "uuid" NOT NULL,
    "patient_id" "text" NOT NULL,
    "doctor_id" "uuid",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "notes_for_patient" "text",
    "show_prices" boolean DEFAULT false NOT NULL,
    "discount_type" "text",
    "discount_value" numeric,
    "discount_expires_at" timestamp with time zone,
    "discount_applied_by" "text",
    "final_total" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "want_pharmacy_order" boolean DEFAULT false NOT NULL,
    "order_requested_at" timestamp with time zone,
    "delivery_address" "text",
    "supersedes_prescription_id" "uuid",
    "is_superseded" boolean DEFAULT false NOT NULL,
    "active" boolean DEFAULT false NOT NULL,
    "valid_days" integer DEFAULT 30 NOT NULL,
    "valid_until" timestamp with time zone,
    CONSTRAINT "prescriptions_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['percent'::"text", 'amount'::"text"]))),
    CONSTRAINT "prescriptions_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'signed'::"text"])))
);


ALTER TABLE "public"."prescriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ranges" (
    "analyte_key" "text" NOT NULL,
    "label" "text",
    "section" "text",
    "unit" "text",
    "type" "text",
    "decimals" integer,
    "sex" "text" DEFAULT ''::"text" NOT NULL,
    "age_min" numeric DEFAULT '-1'::integer NOT NULL,
    "age_max" numeric DEFAULT 999 NOT NULL,
    "low" numeric,
    "high" numeric,
    "normal_values" "text",
    "scaling_order" "text"
);


ALTER TABLE "public"."ranges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ranges_import" (
    "analyte_key" "text",
    "label" "text",
    "section" "text",
    "unit" "text",
    "type" "text",
    "decimals" "text",
    "sex" "text",
    "age_min" "text",
    "age_max" "text",
    "low" "text",
    "high" "text",
    "normal_values" "text",
    "scaling_order" "text"
);


ALTER TABLE "public"."ranges_import" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."results_flat" (
    "patient_id" "text" NOT NULL,
    "date_of_test" "text" NOT NULL,
    "barcode" "text" DEFAULT ''::"text" NOT NULL,
    "analyte_key" "text" NOT NULL,
    "value" "text",
    "notes" "text",
    "branch" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "encounter_id" "text",
    "performed_by_staff_id" "uuid"
);


ALTER TABLE "public"."results_flat" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."results_wide" (
    "barcode" "text" DEFAULT ''::"text" NOT NULL,
    "patient_id" "text" NOT NULL,
    "full_name" "text",
    "age" "text",
    "sex" "text",
    "birthday" "text",
    "contact" "text",
    "address" "text",
    "date_of_test" "text" NOT NULL,
    "notes" "text",
    "hema_100" "text",
    "hema_wbc" "text",
    "hema_lymph" "text",
    "hema_mid" "text",
    "hema_gran" "text",
    "hema_rbc" "text",
    "hema_hgb" "text",
    "hema_hct" "text",
    "hema_mcv" "text",
    "hema_mch" "text",
    "hema_mchc" "text",
    "hema_plt" "text",
    "hema_bt" "text",
    "hema_remarks" "text",
    "chem_ogbase" "text",
    "chem_og1st" "text",
    "chem_og2nd" "text",
    "chem_fbs" "text",
    "chem_rbs" "text",
    "chem_chole" "text",
    "chem_trigly" "text",
    "chem_hdl" "text",
    "chem_ldl" "text",
    "chem_vldl" "text",
    "chem_bun" "text",
    "chem_crea" "text",
    "chem_bua" "text",
    "chem_ast" "text",
    "chem_alt" "text",
    "chem_hba1c" "text",
    "chem_tsh" "text",
    "chem_ft3" "text",
    "chem_ft4" "text",
    "chem_t3" "text",
    "chem_t4" "text",
    "chem_psa" "text",
    "chem_remarks" "text",
    "ua_color" "text",
    "ua_trans" "text",
    "ua_glu" "text",
    "ua_pro" "text",
    "ua_ph" "text",
    "ua_sg" "text",
    "ua_blood" "text",
    "ua_bilirubin" "text",
    "ua_urobili" "text",
    "ua_ketones" "text",
    "ua_nitrites" "text",
    "ua_le" "text",
    "ua_cast" "text",
    "ua_casttype" "text",
    "ua_crystals" "text",
    "ua_crystalstype" "text",
    "ua_epi" "text",
    "ua_muc" "text",
    "ua_ura" "text",
    "ua_pho" "text",
    "ua_bac" "text",
    "ua_pus" "text",
    "ua_rbc" "text",
    "ua_remarks" "text",
    "fa_color" "text",
    "fa_cons" "text",
    "fa_pus" "text",
    "fa_rbc" "text",
    "fa_bac" "text",
    "fa_yeast" "text",
    "fa_fat" "text",
    "fa_para" "text",
    "fa_paratype" "text",
    "fa_fobt" "text",
    "fa_remarks" "text",
    "sero_dengns1" "text",
    "sero_dengm" "text",
    "sero_dengg" "text",
    "sero_hepab" "text",
    "sero_rpv" "text",
    "sero_hiv" "text",
    "sero_hcv" "text",
    "sero_pt" "text",
    "sero_remarks" "text",
    "branch" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "encounter_id" "text"
);


ALTER TABLE "public"."results_wide" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."results_wide_import" (
    "barcode" "text" NOT NULL,
    "patient_id" "text" NOT NULL,
    "full_name" "text",
    "age" "text",
    "sex" "text",
    "birthday" "text",
    "contact" "text",
    "address" "text",
    "date_of_test" "text" NOT NULL,
    "notes" "text",
    "hema_100" "text",
    "hema_wbc" "text",
    "hema_lymph" "text",
    "hema_mid" "text",
    "hema_gran" "text",
    "hema_rbc" "text",
    "hema_hgb" "text",
    "hema_hct" "text",
    "hema_mcv" "text",
    "hema_mch" "text",
    "hema_mchc" "text",
    "hema_plt" "text",
    "hema_bt" "text",
    "hema_remarks" "text",
    "chem_ogbase" "text",
    "chem_og1st" "text",
    "chem_og2nd" "text",
    "chem_fbs" "text",
    "chem_rbs" "text",
    "chem_chole" "text",
    "chem_trigly" "text",
    "chem_hdl" "text",
    "chem_ldl" "text",
    "chem_vldl" "text",
    "chem_bun" "text",
    "chem_crea" "text",
    "chem_bua" "text",
    "chem_ast" "text",
    "chem_alt" "text",
    "chem_hba1c" "text",
    "chem_tsh" "text",
    "chem_ft3" "text",
    "chem_ft4" "text",
    "chem_t3" "text",
    "chem_t4" "text",
    "chem_psa" "text",
    "chem_remarks" "text",
    "ua_color" "text",
    "ua_trans" "text",
    "ua_glu" "text",
    "ua_pro" "text",
    "ua_ph" "text",
    "ua_sg" "text",
    "ua_blood" "text",
    "ua_bilirubin" "text",
    "ua_urobili" "text",
    "ua_ketones" "text",
    "ua_nitrites" "text",
    "ua_le" "text",
    "ua_cast" "text",
    "ua_casttype" "text",
    "ua_crystals" "text",
    "ua_crystalstype" "text",
    "ua_epi" "text",
    "ua_muc" "text",
    "ua_ura" "text",
    "ua_pho" "text",
    "ua_bac" "text",
    "ua_pus" "text",
    "ua_rbc" "text",
    "ua_remarks" "text",
    "fa_color" "text",
    "fa_cons" "text",
    "fa_pus" "text",
    "fa_rbc" "text",
    "fa_bac" "text",
    "fa_yeast" "text",
    "fa_fat" "text",
    "fa_para" "text",
    "fa_paratype" "text",
    "fa_fobt" "text",
    "fa_remarks" "text",
    "sero_dengns1" "text",
    "sero_dengm" "text",
    "sero_dengg" "text",
    "sero_hepab" "text",
    "sero_rpv" "text",
    "sero_hiv" "text",
    "sero_hcv" "text",
    "sero_pt" "text",
    "sero_remarks" "text",
    "branch" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "encounter_id" "text"
);


ALTER TABLE "public"."results_wide_import" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."section_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hub_code" "text" NOT NULL,
    "section" "text" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "effective_from" "date" NOT NULL,
    "effective_to" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_staff_id" "uuid"
);


ALTER TABLE "public"."section_assignments" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."staff_no_seq"
    AS integer
    START WITH 4
    INCREMENT BY 1
    MINVALUE 0
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."staff_no_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_no" "text" DEFAULT "to_char"("nextval"('"public"."staff_no_seq"'::"regclass"), 'FM0000'::"text") NOT NULL,
    "login_code" "text" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "birthday" "date" NOT NULL,
    "sex" "text" NOT NULL,
    "credentials" "text",
    "prc_number" "text",
    "position_title" "text",
    "date_started" "date",
    "pin_hash" "text",
    "pin_set_at" timestamp with time zone,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_staff_id" "uuid",
    "updated_by_staff_id" "uuid",
    "middle_name" "text",
    CONSTRAINT "staff_login_code_has_role_prefix" CHECK ((POSITION(('-'::"text") IN ("login_code")) > 1))
);


ALTER TABLE "public"."staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplies_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "branch_code" "text" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "expiry_date" "date" NOT NULL,
    "total_pcs" integer NOT NULL,
    "remaining_pcs" integer NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_staff_id" "uuid",
    "updated_by_staff_id" "uuid",
    CONSTRAINT "supplies_batches_remaining_le_total" CHECK (("remaining_pcs" <= "total_pcs")),
    CONSTRAINT "supplies_batches_remaining_pcs_check" CHECK (("remaining_pcs" >= 0)),
    CONSTRAINT "supplies_batches_total_pcs_check" CHECK (("total_pcs" >= 0))
);


ALTER TABLE "public"."supplies_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplies_dispenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "inventory_id" "uuid" NOT NULL,
    "qty_pcs" integer NOT NULL,
    "dispensed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dispensed_by_staff_id" "uuid",
    "patient_id" "uuid",
    "encounter_id" "uuid",
    "reference" "text",
    "notes" "text",
    "batch_id" "uuid",
    CONSTRAINT "supplies_dispenses_qty_pcs_check" CHECK (("qty_pcs" > 0))
);


ALTER TABLE "public"."supplies_dispenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplies_inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "branch_code" "text" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "packaging_count" integer NOT NULL,
    "total_pcs" integer NOT NULL,
    "remaining_pcs" integer NOT NULL,
    "expiry_date" "date",
    "last_dispensed_at" timestamp with time zone,
    "last_received_at" timestamp with time zone,
    "reorder_level_pcs" integer,
    "hub_code" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_staff_id" "uuid",
    "updated_by_staff_id" "uuid",
    CONSTRAINT "supplies_inventory_packaging_count_check" CHECK (("packaging_count" >= 0)),
    CONSTRAINT "supplies_inventory_remaining_le_total" CHECK (("remaining_pcs" <= "total_pcs")),
    CONSTRAINT "supplies_inventory_remaining_pcs_check" CHECK (("remaining_pcs" >= 0)),
    CONSTRAINT "supplies_inventory_reorder_level_pcs_check" CHECK ((("reorder_level_pcs" IS NULL) OR ("reorder_level_pcs" >= 0))),
    CONSTRAINT "supplies_inventory_total_pcs_check" CHECK (("total_pcs" >= 0))
);


ALTER TABLE "public"."supplies_inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplies_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_name" "text" NOT NULL,
    "packaging_type" "public"."packaging_type" NOT NULL,
    "pcs_per_package" integer NOT NULL,
    "sku" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_staff_id" "uuid",
    CONSTRAINT "supplies_items_pcs_per_package_check" CHECK (("pcs_per_package" > 0))
);


ALTER TABLE "public"."supplies_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tests_catalog" (
    "test_code" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "default_price" numeric(12,2),
    "is_active" boolean DEFAULT true,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."tests_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_hubs" (
    "user_id" "uuid" NOT NULL,
    "hub_code" "text" NOT NULL,
    "role" "text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_hubs_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'doctor'::"text", 'staff'::"text"])))
);


ALTER TABLE "public"."user_hubs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_latest_consent_per_encounter" AS
 SELECT DISTINCT ON ("encounter_id") "encounter_id",
    "consultation_id",
    "id" AS "consent_id",
    "created_at",
    "consent_hash"
   FROM "public"."patient_consents"
  ORDER BY "encounter_id", "created_at" DESC;


ALTER VIEW "public"."v_latest_consent_per_encounter" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_supplies_inventory_summary" AS
 SELECT "branch_code",
    "item_id",
    ("sum"("total_pcs"))::integer AS "total_pcs_all",
    ("sum"("remaining_pcs"))::integer AS "remaining_pcs_all",
    ("sum"("total_pcs") FILTER (WHERE ("expiry_date" >= CURRENT_DATE)))::integer AS "total_pcs_available",
    ("sum"("remaining_pcs") FILTER (WHERE ("expiry_date" >= CURRENT_DATE)))::integer AS "remaining_pcs_available",
    "min"("expiry_date") FILTER (WHERE (("expiry_date" >= CURRENT_DATE) AND ("remaining_pcs" > 0))) AS "nearest_expiry_date",
    "count"(*) FILTER (WHERE (("expiry_date" >= CURRENT_DATE) AND ("remaining_pcs" > 0))) AS "active_batches_count"
   FROM "public"."supplies_batches" "b"
  GROUP BY "branch_code", "item_id";


ALTER VIEW "public"."v_supplies_inventory_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_supplies_next_expiries" AS
 SELECT "branch_code",
    "item_id",
    "expiry_date",
    ("sum"("remaining_pcs"))::integer AS "remaining_pcs"
   FROM "public"."supplies_batches" "b"
  WHERE ("expiry_date" >= CURRENT_DATE)
  GROUP BY "branch_code", "item_id", "expiry_date"
  ORDER BY "branch_code", "item_id", "expiry_date";


ALTER VIEW "public"."v_supplies_next_expiries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vitals_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "consultation_id" "uuid",
    "encounter_id" "uuid" NOT NULL,
    "patient_id" "text" NOT NULL,
    "measured_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "systolic_bp" integer,
    "diastolic_bp" integer,
    "hr" integer,
    "rr" integer,
    "temp_c" numeric(4,1),
    "height_cm" numeric(5,2),
    "weight_kg" numeric(5,2),
    "bmi" numeric(5,2),
    "o2sat" integer,
    "notes" "text",
    "source" "text" DEFAULT 'doctor'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_initials" "text" NOT NULL,
    "blood_glucose_mgdl" numeric(6,1),
    CONSTRAINT "vitals_snapshots_consult_required_check" CHECK (((("source" = ANY (ARRAY['staff'::"text", 'doctor'::"text"])) AND ("consultation_id" IS NOT NULL)) OR ("source" = ANY (ARRAY['patient'::"text", 'system'::"text"])))),
    CONSTRAINT "vitals_snapshots_source_check" CHECK (("source" = ANY (ARRAY['doctor'::"text", 'staff'::"text", 'patient'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."vitals_snapshots" OWNER TO "postgres";


COMMENT ON COLUMN "public"."vitals_snapshots"."blood_glucose_mgdl" IS 'Patient self-logged blood glucose in mg/dL (or staff/doctor if needed).';



CREATE OR REPLACE VIEW "public"."vitals_by_encounter" AS
 SELECT "v"."id",
    "v"."consultation_id",
    "v"."encounter_id",
    "v"."patient_id",
    "v"."measured_at",
    "v"."systolic_bp",
    "v"."diastolic_bp",
    "v"."hr",
    "v"."rr",
    "v"."temp_c",
    "v"."height_cm",
    "v"."weight_kg",
    "v"."bmi",
    "v"."o2sat",
    "v"."notes",
    "v"."source",
    "v"."created_by",
    "v"."created_at",
    "v"."created_by_initials",
    "c"."visit_at",
    "c"."branch",
    "e"."branch_code",
    "e"."visit_date_local"
   FROM (("public"."vitals_snapshots" "v"
     LEFT JOIN "public"."consultations" "c" ON (("c"."id" = "v"."consultation_id")))
     LEFT JOIN "public"."encounters" "e" ON (("e"."id" = "v"."encounter_id")));


ALTER VIEW "public"."vitals_by_encounter" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vitals_latest_patient_self_by_param" AS
 SELECT "psm"."patient_id",
    "psm"."parameter_key",
    "psm"."enabled",
    "psm"."doctor_requested",
    "psm"."frequency",
    "psm"."instructions",
    "psm"."consultation_id" AS "prescribed_consultation_id",
    "psm"."encounter_id" AS "prescribed_encounter_id",
    "psm"."doctor_id",
    "psm"."updated_at" AS "monitoring_updated_at",
    "v"."id" AS "latest_vital_id",
    "v"."measured_at" AS "latest_measured_at",
    "v"."encounter_id" AS "latest_encounter_id",
    "v"."systolic_bp",
    "v"."diastolic_bp",
    "v"."weight_kg",
    "v"."blood_glucose_mgdl"
   FROM ("public"."patient_self_monitoring" "psm"
     LEFT JOIN LATERAL ( SELECT "vs"."id",
            "vs"."consultation_id",
            "vs"."encounter_id",
            "vs"."patient_id",
            "vs"."measured_at",
            "vs"."systolic_bp",
            "vs"."diastolic_bp",
            "vs"."hr",
            "vs"."rr",
            "vs"."temp_c",
            "vs"."height_cm",
            "vs"."weight_kg",
            "vs"."bmi",
            "vs"."o2sat",
            "vs"."notes",
            "vs"."source",
            "vs"."created_by",
            "vs"."created_at",
            "vs"."created_by_initials",
            "vs"."blood_glucose_mgdl"
           FROM "public"."vitals_snapshots" "vs"
          WHERE (("vs"."patient_id" = "psm"."patient_id") AND ("vs"."source" = 'patient'::"text") AND ((("psm"."parameter_key" = 'bp'::"text") AND (("vs"."systolic_bp" IS NOT NULL) OR ("vs"."diastolic_bp" IS NOT NULL))) OR (("psm"."parameter_key" = 'weight'::"text") AND ("vs"."weight_kg" IS NOT NULL)) OR (("psm"."parameter_key" = 'glucose'::"text") AND ("vs"."blood_glucose_mgdl" IS NOT NULL))))
          ORDER BY "vs"."measured_at" DESC
         LIMIT 1) "v" ON (true));


ALTER VIEW "public"."vitals_latest_patient_self_by_param" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vitals_latest_per_patient" AS
 SELECT DISTINCT ON ("patient_id") "id" AS "snapshot_id",
    "patient_id",
    "consultation_id",
    "encounter_id",
    "measured_at",
    "systolic_bp",
    "diastolic_bp",
    "hr",
    "rr",
    "temp_c",
    "height_cm",
    "weight_kg",
    "bmi",
    "o2sat",
    "notes",
    "source",
    "created_by_initials",
    "created_at"
   FROM "public"."vitals_snapshots"
  ORDER BY "patient_id", "measured_at" DESC;


ALTER VIEW "public"."vitals_latest_per_patient" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."yakap_map_components" (
    "yakap_code" "text" NOT NULL,
    "analyte_key" "text" NOT NULL,
    "sex" "text" NOT NULL,
    "position" integer NOT NULL,
    "is_optional" boolean DEFAULT false NOT NULL,
    CONSTRAINT "yakap_map_components_sex_check" CHECK (("sex" = ANY (ARRAY['ANY'::"text", 'M'::"text", 'F'::"text"])))
);


ALTER TABLE "public"."yakap_map_components" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."yakap_map_tests" (
    "yakap_code" "text" NOT NULL,
    "yakap_name" "text" NOT NULL,
    "internal_code" "text" NOT NULL,
    "type" "text" NOT NULL,
    CONSTRAINT "yakap_map_tests_type_check" CHECK (("type" = ANY (ARRAY['single'::"text", 'multi'::"text"])))
);


ALTER TABLE "public"."yakap_map_tests" OWNER TO "postgres";


ALTER TABLE ONLY "public"."medical_certificate_supporting_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."medical_certificate_supporting_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."config"
    ADD CONSTRAINT "config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."consent_templates"
    ADD CONSTRAINT "consent_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consent_templates"
    ADD CONSTRAINT "consent_templates_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."consultation_diagnoses"
    ADD CONSTRAINT "consultation_diagnoses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doctor_notes"
    ADD CONSTRAINT "doctor_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doctors"
    ADD CONSTRAINT "doctors_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."doctors"
    ADD CONSTRAINT "doctors_pkey" PRIMARY KEY ("doctor_id");



ALTER TABLE ONLY "public"."ecg_cases"
    ADD CONSTRAINT "ecg_cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ecg_reports"
    ADD CONSTRAINT "ecg_reports_external_result_id_key" UNIQUE ("external_result_id");



ALTER TABLE ONLY "public"."ecg_reports"
    ADD CONSTRAINT "ecg_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."encounter_events"
    ADD CONSTRAINT "encounter_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."encounter_orders"
    ADD CONSTRAINT "encounter_orders_pkey" PRIMARY KEY ("encounter_id");



ALTER TABLE ONLY "public"."encounters"
    ADD CONSTRAINT "encounters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_results"
    ADD CONSTRAINT "external_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."followup_attempts"
    ADD CONSTRAINT "followup_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."followups"
    ADD CONSTRAINT "followups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hubs"
    ADD CONSTRAINT "hubs_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."icd10_catalog"
    ADD CONSTRAINT "icd10_catalog_pkey" PRIMARY KEY ("icd10_code");



ALTER TABLE ONLY "public"."icd10"
    ADD CONSTRAINT "icd10_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."medical_certificate_supporting_items"
    ADD CONSTRAINT "medical_certificate_supporting_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medical_certificates"
    ADD CONSTRAINT "medical_certificates_certificate_no_key" UNIQUE ("certificate_no");



ALTER TABLE ONLY "public"."medical_certificates"
    ADD CONSTRAINT "medical_certificates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medical_certificates"
    ADD CONSTRAINT "medical_certificates_qr_token_key" UNIQUE ("qr_token");



ALTER TABLE ONLY "public"."medical_certificates"
    ADD CONSTRAINT "medical_certificates_verification_code_key" UNIQUE ("verification_code");



ALTER TABLE ONLY "public"."meds"
    ADD CONSTRAINT "meds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."note_templates"
    ADD CONSTRAINT "note_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."package_items"
    ADD CONSTRAINT "package_items_pkey" PRIMARY KEY ("package_code", "test_code");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_package_code_uq" UNIQUE ("package_code");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_consents"
    ADD CONSTRAINT "patient_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_pin_reset_tokens"
    ADD CONSTRAINT "patient_pin_reset_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_pin_reset_tokens"
    ADD CONSTRAINT "patient_pin_reset_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."patient_self_monitoring"
    ADD CONSTRAINT "patient_self_monitoring_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patients_import"
    ADD CONSTRAINT "patients_import_pkey" PRIMARY KEY ("patient_id");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_pkey" PRIMARY KEY ("patient_id");



ALTER TABLE ONLY "public"."prescription_items"
    ADD CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prescriptions"
    ADD CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ranges"
    ADD CONSTRAINT "ranges_pkey" PRIMARY KEY ("analyte_key", "sex", "age_min", "age_max");



ALTER TABLE ONLY "public"."results_flat"
    ADD CONSTRAINT "results_flat_pkey" PRIMARY KEY ("patient_id", "date_of_test", "barcode", "analyte_key");



ALTER TABLE ONLY "public"."results_flat"
    ADD CONSTRAINT "results_flat_unique_visit_analyte" UNIQUE ("patient_id", "date_of_test", "barcode", "analyte_key");



ALTER TABLE ONLY "public"."results_wide"
    ADD CONSTRAINT "results_wide_pkey" PRIMARY KEY ("patient_id", "date_of_test", "barcode");



ALTER TABLE ONLY "public"."section_assignments"
    ADD CONSTRAINT "section_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_login_code_key" UNIQUE ("login_code");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_staff_no_key" UNIQUE ("staff_no");



ALTER TABLE ONLY "public"."supplies_batches"
    ADD CONSTRAINT "supplies_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplies_dispenses"
    ADD CONSTRAINT "supplies_dispenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplies_inventory"
    ADD CONSTRAINT "supplies_inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplies_items"
    ADD CONSTRAINT "supplies_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tests_catalog"
    ADD CONSTRAINT "tests_catalog_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."tests_catalog"
    ADD CONSTRAINT "tests_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tests_catalog"
    ADD CONSTRAINT "tests_catalog_test_code_uq" UNIQUE ("test_code");



ALTER TABLE ONLY "public"."user_hubs"
    ADD CONSTRAINT "user_hubs_pkey" PRIMARY KEY ("user_id", "hub_code", "role");



ALTER TABLE ONLY "public"."vitals_snapshots"
    ADD CONSTRAINT "vitals_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."yakap_map_components"
    ADD CONSTRAINT "yakap_map_components_pkey" PRIMARY KEY ("yakap_code", "analyte_key", "sex");



ALTER TABLE ONLY "public"."yakap_map_tests"
    ADD CONSTRAINT "yakap_map_tests_pkey" PRIMARY KEY ("yakap_code");



CREATE INDEX "consent_templates_slug_idx" ON "public"."consent_templates" USING "btree" ("slug");



CREATE UNIQUE INDEX "doctor_notes_consultation_id_key" ON "public"."doctor_notes" USING "btree" ("consultation_id");



CREATE INDEX "ecg_cases_patient_idx" ON "public"."ecg_cases" USING "btree" ("patient_id", "uploaded_at" DESC);



CREATE INDEX "ecg_cases_status_idx" ON "public"."ecg_cases" USING "btree" ("status", "uploaded_at" DESC);



CREATE INDEX "ecg_reports_doctor_idx" ON "public"."ecg_reports" USING "btree" ("doctor_id", "interpreted_at" DESC);



CREATE INDEX "ecg_reports_encounter_idx" ON "public"."ecg_reports" USING "btree" ("encounter_id");



CREATE INDEX "ecg_reports_ext_result_idx" ON "public"."ecg_reports" USING "btree" ("external_result_id");



CREATE INDEX "ecg_reports_patient_idx" ON "public"."ecg_reports" USING "btree" ("patient_id", "interpreted_at" DESC);



CREATE INDEX "ext_results_category_idx" ON "public"."external_results" USING "btree" ("category", "subtype", "taken_at" DESC);



CREATE INDEX "ext_results_ecg_recent_idx" ON "public"."external_results" USING "btree" ("uploaded_at" DESC) WHERE ("type" = 'ECG'::"text");



CREATE INDEX "ext_results_ecg_taken_idx" ON "public"."external_results" USING "btree" ("taken_at" DESC, "uploaded_at" DESC) WHERE ("type" = 'ECG'::"text");



CREATE INDEX "ext_results_encounter_idx" ON "public"."external_results" USING "btree" ("encounter_id");



CREATE INDEX "ext_results_patient_date_idx" ON "public"."external_results" USING "btree" ("patient_id", "taken_at" DESC, "uploaded_at" DESC);



CREATE INDEX "ext_results_patient_type_idx" ON "public"."external_results" USING "btree" ("patient_id", "type", "taken_at" DESC);



CREATE INDEX "idx_consultation_diagnoses_consult" ON "public"."consultation_diagnoses" USING "btree" ("consultation_id");



CREATE INDEX "idx_consultations_branch" ON "public"."consultations" USING "btree" ("branch");



CREATE INDEX "idx_consultations_encounter" ON "public"."consultations" USING "btree" ("encounter_id");



CREATE INDEX "idx_consultations_patient_date" ON "public"."consultations" USING "btree" ("patient_id", "visit_at" DESC);



CREATE INDEX "idx_doctor_notes_consult" ON "public"."doctor_notes" USING "btree" ("consultation_id");



CREATE INDEX "idx_doctors_code" ON "public"."doctors" USING "btree" ("code");



CREATE INDEX "idx_doctors_name" ON "public"."doctors" USING "btree" ("display_name");



CREATE INDEX "idx_enc_consult_hub_date_status" ON "public"."encounters" USING "btree" ("branch_code", "visit_date_local", "consult_status");



CREATE INDEX "idx_encounter_events_by_enc" ON "public"."encounter_events" USING "btree" ("encounter_id");



CREATE INDEX "idx_encounters_day_branch_priority" ON "public"."encounters" USING "btree" ("visit_date_local", "branch_code", "priority" DESC);



CREATE INDEX "idx_encounters_patient" ON "public"."encounters" USING "btree" ("patient_id", "visit_date_local");



CREATE INDEX "idx_encounters_patient_day" ON "public"."encounters" USING "btree" ("patient_id", "visit_date_local");



CREATE INDEX "idx_encounters_today" ON "public"."encounters" USING "btree" ("visit_date_local", "branch_code", "status");



CREATE INDEX "idx_encounters_today_branch" ON "public"."encounters" USING "btree" ("visit_date_local", "branch_code");



CREATE INDEX "idx_events_enc_ts" ON "public"."encounter_events" USING "btree" ("encounter_id", "ts");



CREATE INDEX "idx_flat_pid_date" ON "public"."results_flat" USING "btree" ("patient_id", "date_of_test");



CREATE INDEX "idx_followups_due" ON "public"."followups" USING "btree" ("due_date");



CREATE INDEX "idx_followups_patient" ON "public"."followups" USING "btree" ("patient_id");



CREATE INDEX "idx_followups_status" ON "public"."followups" USING "btree" ("status");



CREATE INDEX "idx_icd10_code" ON "public"."icd10" USING "btree" ("code");



CREATE INDEX "idx_icd10_title_trigram" ON "public"."icd10" USING "gin" ("title" "public"."gin_trgm_ops");



CREATE INDEX "idx_med_cert_consultation" ON "public"."medical_certificates" USING "btree" ("consultation_id");



CREATE INDEX "idx_med_cert_encounter" ON "public"."medical_certificates" USING "btree" ("encounter_id");



CREATE INDEX "idx_med_cert_patient" ON "public"."medical_certificates" USING "btree" ("patient_id");



CREATE INDEX "idx_med_cert_qr_token" ON "public"."medical_certificates" USING "btree" ("qr_token");



CREATE INDEX "idx_med_cert_supporting_certificate" ON "public"."medical_certificate_supporting_items" USING "btree" ("certificate_id");



CREATE INDEX "idx_meds_active" ON "public"."meds" USING "btree" ("is_active");



CREATE INDEX "idx_meds_generic" ON "public"."meds" USING "btree" ("generic_name");



CREATE INDEX "idx_order_items_by_enc" ON "public"."order_items" USING "btree" ("encounter_id");



CREATE INDEX "idx_order_items_enc" ON "public"."order_items" USING "btree" ("encounter_id");



CREATE INDEX "idx_package_items_package_id" ON "public"."package_items" USING "btree" ("package_id");



CREATE INDEX "idx_package_items_test_id" ON "public"."package_items" USING "btree" ("test_id");



CREATE INDEX "idx_pin_reset_expires_at" ON "public"."patient_pin_reset_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_pin_reset_patient_id_created_at" ON "public"."patient_pin_reset_tokens" USING "btree" ("patient_id", "created_at" DESC);



CREATE INDEX "idx_pin_reset_used_at" ON "public"."patient_pin_reset_tokens" USING "btree" ("used_at");



CREATE INDEX "idx_prescription_items_prescription" ON "public"."prescription_items" USING "btree" ("prescription_id");



CREATE INDEX "idx_prescriptions_consult_status" ON "public"."prescriptions" USING "btree" ("consultation_id", "status");



CREATE INDEX "idx_prescriptions_consultation_id" ON "public"."prescriptions" USING "btree" ("consultation_id");



CREATE INDEX "idx_prescriptions_patient_status_date" ON "public"."prescriptions" USING "btree" ("patient_id", "status", "created_at" DESC);



CREATE INDEX "idx_psm_doctor_requested" ON "public"."patient_self_monitoring" USING "btree" ("doctor_requested", "patient_id");



CREATE INDEX "idx_psm_patient" ON "public"."patient_self_monitoring" USING "btree" ("patient_id");



CREATE INDEX "idx_results_flat_encounter" ON "public"."results_flat" USING "btree" ("encounter_id");



CREATE INDEX "idx_results_flat_performed_by" ON "public"."results_flat" USING "btree" ("performed_by_staff_id");



CREATE INDEX "idx_results_flat_pk_like" ON "public"."results_flat" USING "btree" ("patient_id", "date_of_test", "barcode", "analyte_key");



CREATE INDEX "idx_results_wide_barcode" ON "public"."results_wide" USING "btree" ("barcode");



CREATE INDEX "idx_results_wide_patient" ON "public"."results_wide" USING "btree" ("patient_id");



CREATE INDEX "idx_results_wide_updated" ON "public"."results_wide" USING "btree" ("updated_at");



CREATE INDEX "idx_vitals_consult" ON "public"."vitals_snapshots" USING "btree" ("consultation_id", "measured_at" DESC);



CREATE INDEX "idx_vitals_consult_measured" ON "public"."vitals_snapshots" USING "btree" ("consultation_id", "measured_at" DESC);



CREATE INDEX "idx_vitals_created_by_initials" ON "public"."vitals_snapshots" USING "btree" ("created_by_initials");



CREATE INDEX "idx_vitals_encounter_measured" ON "public"."vitals_snapshots" USING "btree" ("encounter_id", "measured_at" DESC);



CREATE INDEX "idx_vitals_patient_measured" ON "public"."vitals_snapshots" USING "btree" ("patient_id", "measured_at" DESC);



CREATE INDEX "idx_vitals_patient_source_measured" ON "public"."vitals_snapshots" USING "btree" ("patient_id", "source", "measured_at" DESC);



CREATE INDEX "idx_wide_pid_date" ON "public"."results_wide" USING "btree" ("patient_id", "date_of_test");



CREATE INDEX "idx_yakap_components_order" ON "public"."yakap_map_components" USING "btree" ("yakap_code", "position");



CREATE INDEX "patient_consents_consult_idx" ON "public"."patient_consents" USING "btree" ("consultation_id");



CREATE INDEX "patient_consents_encounter_idx" ON "public"."patient_consents" USING "btree" ("encounter_id");



CREATE INDEX "patient_consents_patient_idx" ON "public"."patient_consents" USING "btree" ("patient_id");



CREATE UNIQUE INDEX "patients_import_uq" ON "public"."patients_import" USING "btree" ("patient_id");



CREATE UNIQUE INDEX "results_wide_import_uq" ON "public"."results_wide_import" USING "btree" ("patient_id", "date_of_test", "barcode");



CREATE UNIQUE INDEX "section_assignments_one_active_per_hub_section" ON "public"."section_assignments" USING "btree" ("hub_code", "section") WHERE ("effective_to" IS NULL);



CREATE INDEX "staff_last_name_idx" ON "public"."staff" USING "btree" ("last_name");



CREATE INDEX "staff_login_code_idx" ON "public"."staff" USING "btree" ("login_code");



CREATE INDEX "supplies_batches_branch_item_exp_idx" ON "public"."supplies_batches" USING "btree" ("branch_code", "item_id", "expiry_date");



CREATE INDEX "supplies_batches_expiry_idx" ON "public"."supplies_batches" USING "btree" ("expiry_date");



CREATE INDEX "supplies_dispenses_batch_id_idx" ON "public"."supplies_dispenses" USING "btree" ("batch_id");



CREATE INDEX "supplies_dispenses_dispensed_at_idx" ON "public"."supplies_dispenses" USING "btree" ("dispensed_at");



CREATE INDEX "supplies_dispenses_inventory_id_idx" ON "public"."supplies_dispenses" USING "btree" ("inventory_id");



CREATE INDEX "supplies_inventory_branch_code_idx" ON "public"."supplies_inventory" USING "btree" ("branch_code");



CREATE UNIQUE INDEX "supplies_inventory_branch_item_unique" ON "public"."supplies_inventory" USING "btree" ("branch_code", "item_id");



CREATE INDEX "supplies_inventory_expiry_date_idx" ON "public"."supplies_inventory" USING "btree" ("expiry_date");



CREATE INDEX "supplies_inventory_item_id_idx" ON "public"."supplies_inventory" USING "btree" ("item_id");



CREATE UNIQUE INDEX "supplies_items_item_name_ci_unique" ON "public"."supplies_items" USING "btree" ("lower"("item_name"));



CREATE UNIQUE INDEX "uniq_active_signed_per_consultation" ON "public"."prescriptions" USING "btree" ("consultation_id") WHERE (("status" = 'signed'::"text") AND ("active" IS TRUE));



CREATE UNIQUE INDEX "uniq_consult_patient_phday" ON "public"."consultations" USING "btree" ("patient_id", ((("visit_at" AT TIME ZONE 'Asia/Manila'::"text"))::"date"));



CREATE UNIQUE INDEX "uniq_draft_per_consultation" ON "public"."prescriptions" USING "btree" ("consultation_id") WHERE ("status" = 'draft'::"text");



CREATE UNIQUE INDEX "uniq_followups_one_active_per_patient" ON "public"."followups" USING "btree" ("patient_id") WHERE ("status" = 'scheduled'::"text");



CREATE UNIQUE INDEX "uq_diag_one_primary_per_consult" ON "public"."consultation_diagnoses" USING "btree" ("consultation_id") WHERE "is_primary";



CREATE UNIQUE INDEX "uq_enc_consult_queue_active" ON "public"."encounters" USING "btree" ("branch_code", "visit_date_local", "queue_number") WHERE (("consult_status" = ANY (ARRAY['queued_for_consult'::"text", 'in_consult'::"text"])) AND ("queue_number" IS NOT NULL));



CREATE UNIQUE INDEX "uq_encounters_current_consult" ON "public"."encounters" USING "btree" ("current_consultation_id") WHERE ("current_consultation_id" IS NOT NULL);



CREATE UNIQUE INDEX "ux_psm_patient_param" ON "public"."patient_self_monitoring" USING "btree" ("patient_id", "parameter_key");



CREATE OR REPLACE TRIGGER "patients_age_biub" BEFORE INSERT OR UPDATE OF "birthday" ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."set_age_from_birthday"();



CREATE OR REPLACE TRIGGER "set_note_templates_updated_at" BEFORE UPDATE ON "public"."note_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_note_templates_updated_at"();



CREATE OR REPLACE TRIGGER "set_public_staff_updated_at" BEFORE UPDATE ON "public"."staff" FOR EACH ROW EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "trg_consultations_set_updated_at" BEFORE UPDATE ON "public"."consultations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_doctor_notes_set_updated_at" BEFORE UPDATE ON "public"."doctor_notes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_doctors_set_updated_at" BEFORE UPDATE ON "public"."doctors" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ecg_reports_validate_and_fill" BEFORE INSERT OR UPDATE ON "public"."ecg_reports" FOR EACH ROW EXECUTE FUNCTION "public"."fn_ecg_reports_validate_and_fill"();



CREATE OR REPLACE TRIGGER "trg_encounters_checkin" AFTER INSERT ON "public"."encounters" FOR EACH ROW EXECUTE FUNCTION "public"."log_encounter_checkin"();



CREATE OR REPLACE TRIGGER "trg_encounters_status" AFTER UPDATE OF "status" ON "public"."encounters" FOR EACH ROW EXECUTE FUNCTION "public"."log_encounter_status_change"();



CREATE OR REPLACE TRIGGER "trg_encounters_updated" BEFORE UPDATE ON "public"."encounters" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_meds_set_updated_at" BEFORE UPDATE ON "public"."meds" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_patients_last_updated" BEFORE UPDATE ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."set_last_updated_ph"();



CREATE OR REPLACE TRIGGER "trg_patients_updated" BEFORE UPDATE ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_patients_upper" BEFORE INSERT OR UPDATE ON "public"."patients" FOR EACH ROW EXECUTE FUNCTION "public"."patients_uppercase_pid"();



CREATE OR REPLACE TRIGGER "trg_prescription_items_set_updated_at" BEFORE UPDATE ON "public"."prescription_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_prescriptions_set_updated_at" BEFORE UPDATE ON "public"."prescriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_psm_auto_enable_from_patient_vitals" AFTER INSERT ON "public"."vitals_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."tg_psm_auto_enable_from_patient_vitals"();



CREATE OR REPLACE TRIGGER "trg_psm_set_updated_at" BEFORE UPDATE ON "public"."patient_self_monitoring" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_results_flat_normalize" BEFORE INSERT OR UPDATE ON "public"."results_flat" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_results_flat"();



CREATE OR REPLACE TRIGGER "trg_results_flat_updated" BEFORE UPDATE ON "public"."results_flat" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_results_wide_normalize" BEFORE INSERT OR UPDATE ON "public"."results_wide" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_results_wide"();



CREATE OR REPLACE TRIGGER "trg_results_wide_updated" BEFORE UPDATE ON "public"."results_wide" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_rx_upper_patient" BEFORE INSERT OR UPDATE ON "public"."prescriptions" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_upper_patient_id"();



CREATE OR REPLACE TRIGGER "trg_supplies_batches_updated_at" BEFORE UPDATE ON "public"."supplies_batches" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_supplies_inventory_updated_at" BEFORE UPDATE ON "public"."supplies_inventory" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_supplies_items_updated_at" BEFORE UPDATE ON "public"."supplies_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_vitals_autofill_and_bmi" BEFORE INSERT OR UPDATE OF "weight_kg", "height_cm" ON "public"."vitals_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."tg_vitals_autofill_and_bmi"();



CREATE OR REPLACE TRIGGER "trg_vitals_snapshots_sync" AFTER INSERT OR DELETE OR UPDATE ON "public"."vitals_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."tg_vitals_snapshots_sync_patients"();



ALTER TABLE ONLY "public"."consultation_diagnoses"
    ADD CONSTRAINT "consultation_diagnoses_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consultation_diagnoses"
    ADD CONSTRAINT "consultation_diagnoses_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("doctor_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_signing_doctor_id_fkey" FOREIGN KEY ("signing_doctor_id") REFERENCES "public"."doctors"("doctor_id");



ALTER TABLE ONLY "public"."doctor_notes"
    ADD CONSTRAINT "doctor_notes_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doctor_notes"
    ADD CONSTRAINT "doctor_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."doctors"("doctor_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ecg_cases"
    ADD CONSTRAINT "ecg_cases_external_result_id_fkey" FOREIGN KEY ("external_result_id") REFERENCES "public"."external_results"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ecg_reports"
    ADD CONSTRAINT "ecg_reports_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("doctor_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ecg_reports"
    ADD CONSTRAINT "ecg_reports_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ecg_reports"
    ADD CONSTRAINT "ecg_reports_external_result_id_fkey" FOREIGN KEY ("external_result_id") REFERENCES "public"."external_results"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."encounter_events"
    ADD CONSTRAINT "encounter_events_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."encounter_orders"
    ADD CONSTRAINT "encounter_orders_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."encounters"
    ADD CONSTRAINT "encounters_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("patient_id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."doctor_notes"
    ADD CONSTRAINT "fk_doctor_notes_consult" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prescription_items"
    ADD CONSTRAINT "fk_items_rx" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."followup_attempts"
    ADD CONSTRAINT "followup_attempts_followup_id_fkey" FOREIGN KEY ("followup_id") REFERENCES "public"."followups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medical_certificate_supporting_items"
    ADD CONSTRAINT "medical_certificate_supporting_items_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "public"."medical_certificates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medical_certificates"
    ADD CONSTRAINT "medical_certificates_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id");



ALTER TABLE ONLY "public"."medical_certificates"
    ADD CONSTRAINT "medical_certificates_created_by_doctor_id_fkey" FOREIGN KEY ("created_by_doctor_id") REFERENCES "public"."doctors"("doctor_id");



ALTER TABLE ONLY "public"."medical_certificates"
    ADD CONSTRAINT "medical_certificates_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("doctor_id");



ALTER TABLE ONLY "public"."medical_certificates"
    ADD CONSTRAINT "medical_certificates_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id");



ALTER TABLE ONLY "public"."medical_certificates"
    ADD CONSTRAINT "medical_certificates_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("patient_id");



ALTER TABLE ONLY "public"."note_templates"
    ADD CONSTRAINT "note_templates_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("doctor_id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."package_items"
    ADD CONSTRAINT "package_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."package_items"
    ADD CONSTRAINT "package_items_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests_catalog"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."patient_consents"
    ADD CONSTRAINT "patient_consents_consultations_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_consents"
    ADD CONSTRAINT "patient_consents_doctors_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("doctor_id");



ALTER TABLE ONLY "public"."patient_consents"
    ADD CONSTRAINT "patient_consents_encounters_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_consents"
    ADD CONSTRAINT "patient_consents_patients_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("patient_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_self_monitoring"
    ADD CONSTRAINT "patient_self_monitoring_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."patient_self_monitoring"
    ADD CONSTRAINT "patient_self_monitoring_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."prescription_items"
    ADD CONSTRAINT "prescription_items_med_id_fkey" FOREIGN KEY ("med_id") REFERENCES "public"."meds"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."prescription_items"
    ADD CONSTRAINT "prescription_items_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prescriptions"
    ADD CONSTRAINT "prescriptions_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prescriptions"
    ADD CONSTRAINT "prescriptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("doctor_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."prescriptions"
    ADD CONSTRAINT "prescriptions_supersedes_prescription_id_fkey" FOREIGN KEY ("supersedes_prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."results_flat"
    ADD CONSTRAINT "results_flat_performed_by_staff_fk" FOREIGN KEY ("performed_by_staff_id") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."section_assignments"
    ADD CONSTRAINT "section_assignments_created_by_fkey" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."section_assignments"
    ADD CONSTRAINT "section_assignments_hub_fkey" FOREIGN KEY ("hub_code") REFERENCES "public"."hubs"("code");



ALTER TABLE ONLY "public"."section_assignments"
    ADD CONSTRAINT "section_assignments_staff_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_created_by_staff_id_fkey" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_updated_by_staff_id_fkey" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."supplies_batches"
    ADD CONSTRAINT "supplies_batches_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."supplies_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."supplies_dispenses"
    ADD CONSTRAINT "supplies_dispenses_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "public"."supplies_inventory"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."supplies_inventory"
    ADD CONSTRAINT "supplies_inventory_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."supplies_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_hubs"
    ADD CONSTRAINT "user_hubs_hub_code_fkey" FOREIGN KEY ("hub_code") REFERENCES "public"."hubs"("code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vitals_snapshots"
    ADD CONSTRAINT "vitals_snapshots_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vitals_snapshots"
    ADD CONSTRAINT "vitals_snapshots_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."yakap_map_components"
    ADD CONSTRAINT "yakap_map_components_yakap_code_fkey" FOREIGN KEY ("yakap_code") REFERENCES "public"."yakap_map_tests"("yakap_code") ON DELETE CASCADE;



CREATE POLICY "doctor can insert own certificates" ON "public"."medical_certificates" FOR INSERT WITH CHECK (("doctor_id" = "auth"."uid"()));



CREATE POLICY "doctor can insert supporting items they own" ON "public"."medical_certificate_supporting_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."medical_certificates" "c"
  WHERE (("c"."id" = "medical_certificate_supporting_items"."certificate_id") AND ("c"."doctor_id" = "auth"."uid"())))));



CREATE POLICY "doctor can read own certificates" ON "public"."medical_certificates" FOR SELECT USING (("doctor_id" = "auth"."uid"()));



CREATE POLICY "doctor can read supporting items they own" ON "public"."medical_certificate_supporting_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."medical_certificates" "c"
  WHERE (("c"."id" = "medical_certificate_supporting_items"."certificate_id") AND ("c"."doctor_id" = "auth"."uid"())))));



CREATE POLICY "doctor can update own certificates" ON "public"."medical_certificates" FOR UPDATE USING (("doctor_id" = "auth"."uid"())) WITH CHECK (("doctor_id" = "auth"."uid"()));



CREATE POLICY "doctor can update supporting items they own" ON "public"."medical_certificate_supporting_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."medical_certificates" "c"
  WHERE (("c"."id" = "medical_certificate_supporting_items"."certificate_id") AND ("c"."doctor_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."medical_certificates" "c"
  WHERE (("c"."id" = "medical_certificate_supporting_items"."certificate_id") AND ("c"."doctor_id" = "auth"."uid"())))));



ALTER TABLE "public"."ecg_cases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ecg_cases_all" ON "public"."ecg_cases" USING (true) WITH CHECK (true);



CREATE POLICY "ecg_doctor_insert_self" ON "public"."ecg_reports" FOR INSERT TO "authenticated" WITH CHECK ((((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = ANY (ARRAY['doctor'::"text", 'admin'::"text"])) AND (((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = 'admin'::"text") OR ("doctor_id" = ((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'doctor_id'::"text"))::"uuid"))));



CREATE POLICY "ecg_doctor_read_all" ON "public"."ecg_reports" FOR SELECT TO "authenticated" USING (((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = ANY (ARRAY['doctor'::"text", 'admin'::"text"])));



CREATE POLICY "ecg_patient_read_final" ON "public"."ecg_reports" FOR SELECT TO "authenticated" USING ((((("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'role'::"text") = 'patient'::"text") AND ("patient_id" = (("current_setting"('request.jwt.claims'::"text", true))::"jsonb" ->> 'patient_id'::"text")) AND ("status" = 'final'::"text")));



ALTER TABLE "public"."ecg_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ext_insert_any" ON "public"."external_results" FOR INSERT WITH CHECK (true);



CREATE POLICY "ext_read_staff_doctors" ON "public"."external_results" FOR SELECT USING (true);



CREATE POLICY "ext_update_any" ON "public"."external_results" FOR UPDATE USING (true) WITH CHECK (true);



ALTER TABLE "public"."external_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_pin_reset_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service role full access" ON "public"."medical_certificate_supporting_items" USING (true) WITH CHECK (true);



CREATE POLICY "service role full access" ON "public"."medical_certificates" USING (true) WITH CHECK (true);



ALTER TABLE "public"."supplies_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplies_dispenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplies_inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplies_items" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."clean_blank"("t" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."clean_blank"("t" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."clean_blank"("t" "text") TO "service_role";



GRANT ALL ON TABLE "public"."consultations" TO "anon";
GRANT ALL ON TABLE "public"."consultations" TO "authenticated";
GRANT ALL ON TABLE "public"."consultations" TO "service_role";



GRANT ALL ON FUNCTION "public"."consult_find_today_ph"("p_patient_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."consult_find_today_ph"("p_patient_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."consult_find_today_ph"("p_patient_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."doctor_login"("p_code" "text", "p_pin" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."doctor_login"("p_code" "text", "p_pin" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."doctor_login"("p_code" "text", "p_pin" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_upper_patient_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_upper_patient_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_upper_patient_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_ecg_reports_validate_and_fill"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_ecg_reports_validate_and_fill"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_ecg_reports_validate_and_fill"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_section_rmt_for_test"("p_hub_code" "text", "p_analyte_key" "text", "p_date_of_test" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_section_rmt_for_test"("p_hub_code" "text", "p_analyte_key" "text", "p_date_of_test" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_section_rmt_for_test"("p_hub_code" "text", "p_analyte_key" "text", "p_date_of_test" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_encounter_checkin"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_encounter_checkin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_encounter_checkin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_encounter_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_encounter_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_encounter_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_config_import"() TO "anon";
GRANT ALL ON FUNCTION "public"."merge_config_import"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_config_import"() TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_patients_import"() TO "anon";
GRANT ALL ON FUNCTION "public"."merge_patients_import"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_patients_import"() TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_ranges_import"() TO "anon";
GRANT ALL ON FUNCTION "public"."merge_ranges_import"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_ranges_import"() TO "service_role";



GRANT ALL ON FUNCTION "public"."merge_results_wide_import"() TO "anon";
GRANT ALL ON FUNCTION "public"."merge_results_wide_import"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."merge_results_wide_import"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_results_flat"() TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_results_flat"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_results_flat"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_results_wide"() TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_results_wide"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_results_wide"() TO "service_role";



GRANT ALL ON FUNCTION "public"."num_or_null"("t" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."num_or_null"("t" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."num_or_null"("t" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."patients_uppercase_pid"() TO "anon";
GRANT ALL ON FUNCTION "public"."patients_uppercase_pid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."patients_uppercase_pid"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recompute_patient_ages"() TO "anon";
GRANT ALL ON FUNCTION "public"."recompute_patient_ages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_patient_ages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_results_flat_from_wide"("p_since" timestamp with time zone, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_results_flat_from_wide"("p_since" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_results_flat_from_wide"("p_since" timestamp with time zone, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_age_from_birthday"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_age_from_birthday"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_age_from_birthday"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_current_timestamp_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_current_timestamp_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_current_timestamp_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_last_updated_ph"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_last_updated_ph"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_last_updated_ph"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_note_templates_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_note_templates_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_note_templates_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."supplies_dispense"("p_branch_code" "text", "p_item_id" "uuid", "p_qty_pcs" integer, "p_staff_id" "uuid", "p_patient_id" "uuid", "p_encounter_id" "uuid", "p_reference" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."supplies_dispense"("p_branch_code" "text", "p_item_id" "uuid", "p_qty_pcs" integer, "p_staff_id" "uuid", "p_patient_id" "uuid", "p_encounter_id" "uuid", "p_reference" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."supplies_dispense"("p_branch_code" "text", "p_item_id" "uuid", "p_qty_pcs" integer, "p_staff_id" "uuid", "p_patient_id" "uuid", "p_encounter_id" "uuid", "p_reference" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."supplies_dispense_fefo"("p_branch_code" "text", "p_item_id" "uuid", "p_qty_pcs" integer, "p_staff_id" "uuid", "p_patient_id" "uuid", "p_encounter_id" "uuid", "p_reference" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."supplies_dispense_fefo"("p_branch_code" "text", "p_item_id" "uuid", "p_qty_pcs" integer, "p_staff_id" "uuid", "p_patient_id" "uuid", "p_encounter_id" "uuid", "p_reference" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."supplies_dispense_fefo"("p_branch_code" "text", "p_item_id" "uuid", "p_qty_pcs" integer, "p_staff_id" "uuid", "p_patient_id" "uuid", "p_encounter_id" "uuid", "p_reference" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."supplies_receive"("p_branch_code" "text", "p_item_id" "uuid", "p_added_pcs" integer, "p_expiry_date" "date", "p_staff_id" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."supplies_receive"("p_branch_code" "text", "p_item_id" "uuid", "p_added_pcs" integer, "p_expiry_date" "date", "p_staff_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."supplies_receive"("p_branch_code" "text", "p_item_id" "uuid", "p_added_pcs" integer, "p_expiry_date" "date", "p_staff_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_patient_flat_vitals"("p_patient_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_patient_flat_vitals"("p_patient_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_patient_flat_vitals"("p_patient_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_psm_auto_enable_from_patient_vitals"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_psm_auto_enable_from_patient_vitals"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_psm_auto_enable_from_patient_vitals"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_vitals_autofill_and_bmi"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_vitals_autofill_and_bmi"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_vitals_autofill_and_bmi"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_vitals_snapshots_sync_patients"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_vitals_snapshots_sync_patients"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_vitals_snapshots_sync_patients"() TO "service_role";



GRANT ALL ON TABLE "public"."config" TO "anon";
GRANT ALL ON TABLE "public"."config" TO "authenticated";
GRANT ALL ON TABLE "public"."config" TO "service_role";



GRANT ALL ON TABLE "public"."config_import" TO "anon";
GRANT ALL ON TABLE "public"."config_import" TO "authenticated";
GRANT ALL ON TABLE "public"."config_import" TO "service_role";



GRANT ALL ON TABLE "public"."consent_templates" TO "anon";
GRANT ALL ON TABLE "public"."consent_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."consent_templates" TO "service_role";



GRANT ALL ON TABLE "public"."consultation_diagnoses" TO "anon";
GRANT ALL ON TABLE "public"."consultation_diagnoses" TO "authenticated";
GRANT ALL ON TABLE "public"."consultation_diagnoses" TO "service_role";



GRANT ALL ON TABLE "public"."doctor_notes" TO "anon";
GRANT ALL ON TABLE "public"."doctor_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."doctor_notes" TO "service_role";



GRANT ALL ON TABLE "public"."doctors" TO "anon";
GRANT ALL ON TABLE "public"."doctors" TO "authenticated";
GRANT ALL ON TABLE "public"."doctors" TO "service_role";



GRANT ALL ON TABLE "public"."ecg_cases" TO "anon";
GRANT ALL ON TABLE "public"."ecg_cases" TO "authenticated";
GRANT ALL ON TABLE "public"."ecg_cases" TO "service_role";



GRANT ALL ON TABLE "public"."ecg_reports" TO "anon";
GRANT ALL ON TABLE "public"."ecg_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."ecg_reports" TO "service_role";



GRANT ALL ON TABLE "public"."encounter_events" TO "anon";
GRANT ALL ON TABLE "public"."encounter_events" TO "authenticated";
GRANT ALL ON TABLE "public"."encounter_events" TO "service_role";



GRANT ALL ON TABLE "public"."encounter_orders" TO "anon";
GRANT ALL ON TABLE "public"."encounter_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."encounter_orders" TO "service_role";



GRANT ALL ON TABLE "public"."encounters" TO "anon";
GRANT ALL ON TABLE "public"."encounters" TO "authenticated";
GRANT ALL ON TABLE "public"."encounters" TO "service_role";



GRANT ALL ON TABLE "public"."encounters_today_v" TO "anon";
GRANT ALL ON TABLE "public"."encounters_today_v" TO "authenticated";
GRANT ALL ON TABLE "public"."encounters_today_v" TO "service_role";



GRANT ALL ON TABLE "public"."external_results" TO "anon";
GRANT ALL ON TABLE "public"."external_results" TO "authenticated";
GRANT ALL ON TABLE "public"."external_results" TO "service_role";



GRANT ALL ON TABLE "public"."followup_attempts" TO "anon";
GRANT ALL ON TABLE "public"."followup_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."followup_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."followups" TO "anon";
GRANT ALL ON TABLE "public"."followups" TO "authenticated";
GRANT ALL ON TABLE "public"."followups" TO "service_role";



GRANT ALL ON TABLE "public"."hubs" TO "anon";
GRANT ALL ON TABLE "public"."hubs" TO "authenticated";
GRANT ALL ON TABLE "public"."hubs" TO "service_role";



GRANT ALL ON TABLE "public"."icd10" TO "anon";
GRANT ALL ON TABLE "public"."icd10" TO "authenticated";
GRANT ALL ON TABLE "public"."icd10" TO "service_role";



GRANT ALL ON TABLE "public"."icd10_catalog" TO "anon";
GRANT ALL ON TABLE "public"."icd10_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."icd10_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."medical_certificate_supporting_items" TO "anon";
GRANT ALL ON TABLE "public"."medical_certificate_supporting_items" TO "authenticated";
GRANT ALL ON TABLE "public"."medical_certificate_supporting_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."medical_certificate_supporting_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."medical_certificate_supporting_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."medical_certificate_supporting_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."medical_certificates" TO "anon";
GRANT ALL ON TABLE "public"."medical_certificates" TO "authenticated";
GRANT ALL ON TABLE "public"."medical_certificates" TO "service_role";



GRANT ALL ON TABLE "public"."meds" TO "anon";
GRANT ALL ON TABLE "public"."meds" TO "authenticated";
GRANT ALL ON TABLE "public"."meds" TO "service_role";



GRANT ALL ON TABLE "public"."note_templates" TO "anon";
GRANT ALL ON TABLE "public"."note_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."note_templates" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."package_items" TO "anon";
GRANT ALL ON TABLE "public"."package_items" TO "authenticated";
GRANT ALL ON TABLE "public"."package_items" TO "service_role";



GRANT ALL ON TABLE "public"."packages" TO "anon";
GRANT ALL ON TABLE "public"."packages" TO "authenticated";
GRANT ALL ON TABLE "public"."packages" TO "service_role";



GRANT ALL ON TABLE "public"."patient_consents" TO "anon";
GRANT ALL ON TABLE "public"."patient_consents" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_consents" TO "service_role";



GRANT ALL ON TABLE "public"."patient_pin_reset_tokens" TO "anon";
GRANT ALL ON TABLE "public"."patient_pin_reset_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_pin_reset_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."patient_self_monitoring" TO "anon";
GRANT ALL ON TABLE "public"."patient_self_monitoring" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_self_monitoring" TO "service_role";



GRANT ALL ON TABLE "public"."patients" TO "anon";
GRANT ALL ON TABLE "public"."patients" TO "authenticated";
GRANT ALL ON TABLE "public"."patients" TO "service_role";



GRANT ALL ON TABLE "public"."patients_import" TO "anon";
GRANT ALL ON TABLE "public"."patients_import" TO "authenticated";
GRANT ALL ON TABLE "public"."patients_import" TO "service_role";



GRANT ALL ON TABLE "public"."prescription_items" TO "anon";
GRANT ALL ON TABLE "public"."prescription_items" TO "authenticated";
GRANT ALL ON TABLE "public"."prescription_items" TO "service_role";



GRANT ALL ON TABLE "public"."prescriptions" TO "anon";
GRANT ALL ON TABLE "public"."prescriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."prescriptions" TO "service_role";



GRANT ALL ON TABLE "public"."ranges" TO "anon";
GRANT ALL ON TABLE "public"."ranges" TO "authenticated";
GRANT ALL ON TABLE "public"."ranges" TO "service_role";



GRANT ALL ON TABLE "public"."ranges_import" TO "anon";
GRANT ALL ON TABLE "public"."ranges_import" TO "authenticated";
GRANT ALL ON TABLE "public"."ranges_import" TO "service_role";



GRANT ALL ON TABLE "public"."results_flat" TO "anon";
GRANT ALL ON TABLE "public"."results_flat" TO "authenticated";
GRANT ALL ON TABLE "public"."results_flat" TO "service_role";



GRANT ALL ON TABLE "public"."results_wide" TO "anon";
GRANT ALL ON TABLE "public"."results_wide" TO "authenticated";
GRANT ALL ON TABLE "public"."results_wide" TO "service_role";



GRANT ALL ON TABLE "public"."results_wide_import" TO "anon";
GRANT ALL ON TABLE "public"."results_wide_import" TO "authenticated";
GRANT ALL ON TABLE "public"."results_wide_import" TO "service_role";



GRANT ALL ON TABLE "public"."section_assignments" TO "anon";
GRANT ALL ON TABLE "public"."section_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."section_assignments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."staff_no_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."staff_no_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."staff_no_seq" TO "service_role";



GRANT ALL ON TABLE "public"."staff" TO "anon";
GRANT ALL ON TABLE "public"."staff" TO "authenticated";
GRANT ALL ON TABLE "public"."staff" TO "service_role";



GRANT ALL ON TABLE "public"."supplies_batches" TO "anon";
GRANT ALL ON TABLE "public"."supplies_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."supplies_batches" TO "service_role";



GRANT ALL ON TABLE "public"."supplies_dispenses" TO "anon";
GRANT ALL ON TABLE "public"."supplies_dispenses" TO "authenticated";
GRANT ALL ON TABLE "public"."supplies_dispenses" TO "service_role";



GRANT ALL ON TABLE "public"."supplies_inventory" TO "anon";
GRANT ALL ON TABLE "public"."supplies_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."supplies_inventory" TO "service_role";



GRANT ALL ON TABLE "public"."supplies_items" TO "anon";
GRANT ALL ON TABLE "public"."supplies_items" TO "authenticated";
GRANT ALL ON TABLE "public"."supplies_items" TO "service_role";



GRANT ALL ON TABLE "public"."tests_catalog" TO "anon";
GRANT ALL ON TABLE "public"."tests_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."tests_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."user_hubs" TO "anon";
GRANT ALL ON TABLE "public"."user_hubs" TO "authenticated";
GRANT ALL ON TABLE "public"."user_hubs" TO "service_role";



GRANT ALL ON TABLE "public"."v_latest_consent_per_encounter" TO "anon";
GRANT ALL ON TABLE "public"."v_latest_consent_per_encounter" TO "authenticated";
GRANT ALL ON TABLE "public"."v_latest_consent_per_encounter" TO "service_role";



GRANT ALL ON TABLE "public"."v_supplies_inventory_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_supplies_inventory_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_supplies_inventory_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_supplies_next_expiries" TO "anon";
GRANT ALL ON TABLE "public"."v_supplies_next_expiries" TO "authenticated";
GRANT ALL ON TABLE "public"."v_supplies_next_expiries" TO "service_role";



GRANT ALL ON TABLE "public"."vitals_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."vitals_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."vitals_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."vitals_by_encounter" TO "anon";
GRANT ALL ON TABLE "public"."vitals_by_encounter" TO "authenticated";
GRANT ALL ON TABLE "public"."vitals_by_encounter" TO "service_role";



GRANT ALL ON TABLE "public"."vitals_latest_patient_self_by_param" TO "anon";
GRANT ALL ON TABLE "public"."vitals_latest_patient_self_by_param" TO "authenticated";
GRANT ALL ON TABLE "public"."vitals_latest_patient_self_by_param" TO "service_role";



GRANT ALL ON TABLE "public"."vitals_latest_per_patient" TO "anon";
GRANT ALL ON TABLE "public"."vitals_latest_per_patient" TO "authenticated";
GRANT ALL ON TABLE "public"."vitals_latest_per_patient" TO "service_role";



GRANT ALL ON TABLE "public"."yakap_map_components" TO "anon";
GRANT ALL ON TABLE "public"."yakap_map_components" TO "authenticated";
GRANT ALL ON TABLE "public"."yakap_map_components" TO "service_role";



GRANT ALL ON TABLE "public"."yakap_map_tests" TO "anon";
GRANT ALL ON TABLE "public"."yakap_map_tests" TO "authenticated";
GRANT ALL ON TABLE "public"."yakap_map_tests" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







